// Office Live — game loop, camera, input, lighting and the public API for the timesheet app.
import { TEAM, STATUS } from './data.js';
import { T, W, H, DOOR } from './world.js';
import { loadSprites } from './sprites.js';
import { buildWorldArt, OBJECTS, LIGHTS, drawScreen, VOID } from './art.js';
import { Actor } from './actors.js';
import * as UI from './ui.js';
import * as Live from './supabase.js';
import * as TVR from './tv.js';
import * as Out from './outside.js';

const cvs = document.getElementById('game'), ctx = cvs.getContext('2d');
const stage = document.getElementById('stage');

const game = {
  keys: {}, actors: [], selected: null, hover: null, showNames: true, live: false,
  brewing: 0, printing: 0, particles: [],
  lightMode: 'auto', day: 1, doorOpen: 0, userZoom: 1,
  cam: { x: W / 2, y: H / 2, z: 1 }, view: { w: 0, h: 0, dpr: 1, fit: 1 },
  listeners: {},
};

/* ---------------- public-ish game methods ---------------- */
game.emit = (ev, data) => (game.listeners[ev] || []).forEach(f => f(data));
game.setStatus = (id, st) => {
  const a = game.actors.find(x => x.id === id);
  if (!a || !STATUS[st] || a.status === st) return false;
  const was = a.status;
  a.setStatus(st);
  if (st === 'offline') UI.toast(`${a.short} saiu do escritório`, STATUS.offline.color);
  else if (was === 'offline') UI.toast(`${a.short} chegou`, STATUS.working.color);
  else UI.toast(st === 'break' ? `${a.short} foi tomar um café ☕` : `${a.short} voltou ao trabalho`, STATUS[st].color);
  game.emit('status', { id, status: st });
  if (a.outside && st === 'working') Out.leaveOutside(); // the timer is running again: back to the office
  UI.refreshPanel();
  return true;
};
// View-only for now: selecting someone shows their card and the camera follows them.
game.select = a => {
  if (a.mode === 'gone') { UI.toast(`${a.short} está fora agora`, STATUS.offline.color); return; }
  game.selected = a;
  UI.showCard(a); UI.refreshPanel();
};
game.deselect = () => {
  if (!game.selected) return;
  game.selected = null;
  UI.showCard(null); UI.refreshPanel();
};
game.cycleLight = () => {
  const order = ['auto', 'day', 'dusk', 'night'];
  game.lightMode = order[(order.indexOf(game.lightMode) + 1) % order.length];
  UI.refreshPanel();
};
game.dust = (x, y) => game.particles.push({ x: x + (Math.random() - 0.5) * 8, y: y - 1, vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 6, life: 0.5, max: 0.5, kind: 'dust' });
game.onArrive = a => {
  game.emit('arrive', { id: a.id });
  if (a === game.returning) { game.returning = null; game.select(a); }
};

/* ---------------- going outside (outside.js) ----------------
   Anyone not working (on a break, or clocked out) can go out: clicking the office door walks them out (or,
   if they're already out of the office, puts them straight on the street), and they stroll until they walk
   back in or their timer starts again. Signed in it's your own character; in demo mode (or if the account
   isn't linked to one) it's whoever is selected. Signed-in colleagues see each other there (street sync below). */
const OFFICE_DOOR = { x: 3 * T - 6, y: 6, w: 2 * T + 12, h: 2 * T + 8 };
const overOfficeDoor = (x, y) => x >= OFFICE_DOOR.x && x < OFFICE_DOOR.x + OFFICE_DOOR.w && y >= OFFICE_DOOR.y && y < OFFICE_DOOR.y + OFFICE_DOOR.h;
const me = () => (game.live && game.meId && game.actors.find(a => a.id === game.meId)) || game.selected
  || (!game.live && game.actors.find(a => a.status === 'break' && a.mode !== 'gone')) || null;
function fade(mid) {
  const f = document.getElementById('fade');
  f.classList.add('on');
  setTimeout(() => { mid(); f.classList.remove('on'); }, 350);
}
game.walkOut = () => {
  const a = me();
  if (!a) { UI.toast(game.live ? 'Não achei seu personagem' : 'Clique em alguém em pausa e depois na porta', STATUS.offline.color); return; }
  if (a.outside || a.leaving) return;
  if (a.status === 'working') { UI.toast(`${a.short}: pause o ponto pra sair ☕`, STATUS.break.color); return; }
  if (a.mode === 'gone') { a.plan = []; a.path = []; a.outside = true; game.onExit(a); return; } // clocked out: straight to the street
  a.leaving = true; a.plan = []; a.path = [];
  game.select(a);
  UI.toast(`${a.short} está saindo…`, STATUS.break.color);
};
game.onExit = a => fade(() => {
  game.deselect();
  Out.enterOutside(a, back);
  document.body.classList.add('outside');
  const w = Out.out.walker; game.cam.x = w.x; game.cam.y = w.y;
  UI.toast(`${a.short} saiu pra rua · setas/WASD ou clique pra andar`, STATUS.break.color);
});
function back(a) {
  fade(() => {
    a.outside = false; game.keys = {};
    document.body.classList.remove('outside');
    game.cam.x = W / 2; game.cam.y = H / 2;
    if (a.status !== 'offline') game.returning = a;
  });
}
game.comeBack = () => Out.leaveOutside();

/* ---------------- street sync (multiplayer) ----------------
   While signed in, join the private "office-street" channel: receive colleagues' positions all the time
   (so the office can hide whoever is outside) and, while you're out as your own character, send yours
   ~8x a second when it changes plus a heartbeat every 2 s. 'bye' when you go back in. */
let street = null, streetOut = false, lastSent = 0, lastSig = '';
async function joinStreet() {
  if (street) return;
  try { street = await Live.streetJoin(Out.remoteUpdate); }
  catch (err) { street = null; console.warn('street', err); }
}
function leaveStreet() {
  if (street) { if (streetOut && game.meId) street.send('bye', { id: game.meId }); street.leave(); }
  street = null; streetOut = false; Out.others.clear();
}
function syncStreet(now) {
  if (!street || !game.meId) return;
  const w = Out.out.active ? Out.out.walker : null;
  if (!w || w.id !== game.meId || w.fade < 0) {
    if (streetOut) { street.send('bye', { id: game.meId }); streetOut = false; }
    return;
  }
  streetOut = true;
  const msg = { id: w.id, x: Math.round(w.x), y: Math.round(w.y), dir: w.dir, run: !!game.keys.run };
  const sig = msg.x + ',' + msg.y + ',' + msg.dir;
  if ((sig !== lastSig && now - lastSent > 120) || now - lastSent > 2000) { street.send('pos', msg); lastSent = now; lastSig = sig; }
}
addEventListener('pagehide', () => { if (street && streetOut && game.meId) street.send('bye', { id: game.meId }); });

const deskOwner = {};
const S = { // read by animated art
  get day() { return game.day; }, get doorOpen() { return game.doorOpen; }, get brewing() { return game.brewing > 0; },
  get actors() { return game.actors; }, get tv() { return TVR.tv; }, counts: { working: 0, break: 0, offline: 0 },
  seatTaken: s => !!s.occupant,
  deskState(d) {
    if (d.kind === 'boss') return 'off';
    const occ = d.seatRef.occupant;
    if (occ && occ.status === 'working') return 'on';
    const own = deskOwner[d.id];
    return own && own.status !== 'offline' ? 'saver' : 'off';
  },
};

/* ---------------- input ---------------- */
const MOVE = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
addEventListener('keyup', e => { if (MOVE[e.code]) game.keys[MOVE[e.code]] = false; });
addEventListener('blur', () => { game.keys = {}; });
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (MOVE[e.code] && Out.out.active) { game.keys[MOVE[e.code]] = true; e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.code === 'Escape') { game.deselect(); TVR.close(); }
  if (e.code === 'KeyN') game.showNames = !game.showNames;
  if (e.code === 'KeyL') game.cycleLight();
  if (e.code === 'Equal' || e.code === 'NumpadAdd') game.userZoom = Math.min(2.5, game.userZoom * 1.15);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') game.userZoom = Math.max(0.6, game.userZoom / 1.15);
});

const toWorld = (sx, sy) => {
  const { w, h } = game.view, c = game.cam;
  return { x: c.x + (sx - w / 2) / c.z, y: c.y + (sy - h / 2) / c.z };
};
const toScreen = (wx, wy) => {
  const { w, h } = game.view, c = game.cam;
  return { x: w / 2 + (wx - c.x) * c.z, y: h / 2 + (wy - c.y) * c.z };
};
function pick(wx, wy) {
  let best = null;
  for (const a of game.actors) if (a.hit(wx, wy) && !Out.isOutside(a.id) && (!best || a.sortY > best.sortY)) best = a;
  return best;
}
cvs.addEventListener('mousemove', e => {
  const r = cvs.getBoundingClientRect(), w = toWorld(e.clientX - r.left, e.clientY - r.top);
  if (Out.out.active) { game.hover = null; cvs.style.cursor = Out.overDoor(w.x, w.y) ? 'pointer' : 'default'; return; }
  game.hover = pick(w.x, w.y);
  cvs.style.cursor = game.hover || TVR.overTV(w.x, w.y) || overOfficeDoor(w.x, w.y) ? 'pointer' : 'default';
});
cvs.addEventListener('mouseleave', () => { game.hover = null; });
cvs.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const r = cvs.getBoundingClientRect(), w = toWorld(e.clientX - r.left, e.clientY - r.top);
  if (Out.out.active) { Out.clickOutside(w.x, w.y); return; }
  const a = pick(w.x, w.y);
  if (a) game.select(a);
  else if (TVR.overTV(w.x, w.y)) TVR.open();
  else if (overOfficeDoor(w.x, w.y)) game.walkOut();
  else game.deselect();
});
cvs.addEventListener('wheel', e => { e.preventDefault(); game.userZoom = Math.min(2.5, Math.max(0.6, game.userZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); }, { passive: false });

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1), r = stage.getBoundingClientRect();
  game.view = { w: r.width, h: r.height, dpr, fit: Math.min(r.width / W, r.height / H) };
  cvs.width = Math.round(r.width * dpr); cvs.height = Math.round(r.height * dpr);
  cvs.style.width = r.width + 'px'; cvs.style.height = r.height + 'px';
}
// observe the stage itself: on a slow first load the stylesheet can arrive after the first measurement
new ResizeObserver(resize).observe(stage);

/* ---------------- lighting ---------------- */
function autoDay() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  if (h < 6 || h >= 19.5) return 0;
  if (h < 8) return (h - 6) / 2;
  if (h >= 17) return 1 - (h - 17) / 2.5;
  return 1;
}
const [dark, dg] = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; })();
function drawNight(present) {
  const night = 1 - game.day;
  if (night < 0.02) return;
  dg.globalCompositeOperation = 'source-over';
  dg.clearRect(0, 0, W, H);
  dg.fillStyle = `rgba(6,10,28,${0.68 * night})`; dg.fillRect(0, 0, W, H);
  dg.globalCompositeOperation = 'destination-out';
  const lit = [];
  for (const L of LIGHTS) {
    const on = L.when === 'always' || (L.when === 'present' && present) || (L.when === 'desk' && S.deskState(L.desk) !== 'off') || (L.when === 'tv' && TVR.tv.on);
    if (!on) continue;
    lit.push(L);
    const gr = dg.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    gr.addColorStop(0, `rgba(0,0,0,${L.a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    dg.fillStyle = gr; dg.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.drawImage(dark, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const L of lit) {
    const gr = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.8);
    gr.addColorStop(0, `rgba(${L.col},${0.13 * night})`); gr.addColorStop(1, `rgba(${L.col},0)`);
    ctx.fillStyle = gr; ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------------- particles ---------------- */
const motes = Array.from({ length: 40 }, () => ({ x: 24 * T + Math.random() * 9 * T, y: 7 * T + Math.random() * 16 * T, p: Math.random() * 7 }));
function updateParticles(dt, t) {
  if (game.brewing > 0 && Math.random() < dt * 10) game.particles.push({ x: 10 * T + 16 + (Math.random() - 0.5) * 4, y: 2 * T - 6, vx: (Math.random() - 0.5) * 3, vy: -10, life: 1.4, max: 1.4, kind: 'steam' });
  for (const p of game.particles) { p.life -= dt; p.x += p.vx * dt + (p.kind === 'steam' ? Math.sin(t * 3 + p.y) * 0.15 : 0); p.y += p.vy * dt; }
  game.particles = game.particles.filter(p => p.life > 0);
}
function drawParticles(t) {
  if (game.day > 0.3) {
    ctx.fillStyle = `rgba(255,240,210,${0.35 * game.day})`;
    for (const m of motes) ctx.fillRect(Math.round(m.x + Math.sin(t * 0.3 + m.p) * 14), Math.round(m.y + Math.cos(t * 0.2 + m.p) * 10), 1, 1);
  }
  for (const p of game.particles) {
    const k = p.life / p.max;
    ctx.fillStyle = p.kind === 'steam' ? `rgba(255,255,255,${0.5 * k})` : `rgba(190,180,165,${0.6 * k})`;
    const s = p.kind === 'steam' ? (k > 0.5 ? 1 : 2) : 2;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
}

/* ---------------- overlay (screen space) ---------------- */
function pill(x, y, text, color, dotColor) {
  ctx.font = '600 11px "Pixelify Sans", "Segoe UI", system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + (dotColor ? 22 : 14), h = 17;
  x = Math.round(x - w / 2); y = Math.round(y - h);
  ctx.fillStyle = 'rgba(9,15,29,.82)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  if (dotColor) { ctx.fillStyle = dotColor; ctx.fillRect(x + 7, y + 6, 5, 5); }
  ctx.fillStyle = '#e9eef7'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + (dotColor ? 16 : 7), y + h / 2 + 1);
  return { x, y, w, h };
}
function drawOverlay(t) {
  const z = game.cam.z;
  for (const a of [...game.actors].sort((p, q) => p.sortY - q.sortY)) {
    if (a.mode === 'gone' || a.alpha < 0.5 || Out.isOutside(a.id)) continue;
    const s = toScreen(a.headX, a.headY);
    const typing = a.status === 'working' && a.mode === 'sit' && a.seat === a.ownSeat;
    let top = s.y - 3;
    if (game.showNames || a === game.hover || a === game.selected) {
      const label = a.short + (typing ? ' ' + '·'.repeat(1 + (Math.floor(t * 3) % 3)) : '');
      const r = pill(s.x, s.y - 3, label, a === game.selected ? '#ffd27a' : a === game.hover ? '#ffffff' : 'rgba(138,180,255,.35)', STATUS[a.status].color);
      if (a.project && a.status === 'working') { ctx.fillStyle = a.project.color; ctx.fillRect(r.x + 5, r.y + r.h - 3, r.w - 10, 2); }
      top = r.y - 2;
    }
    if (a.emote) {
      ctx.font = `${Math.round(14 + Math.min(6, z * 2))}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const bob = Math.sin(t * 6) * 1.5;
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(s.x - 15, top - 28 + bob, 30, 25, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s.x - 4, top - 4 + bob); ctx.lineTo(s.x + 4, top - 4 + bob); ctx.lineTo(s.x, top + 1 + bob); ctx.fill();
      ctx.fillText(a.emote.icon, s.x, top - 6 + bob);
      ctx.textAlign = 'left';
    }
  }
}

/* ---------------- main loop ---------------- */
let last = performance.now(), panelT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  const { w, h, dpr, fit } = game.view;

  // simulation
  for (const a of game.actors) a.update(dt, game);
  game.brewing = Math.max(0, game.brewing - dt); game.printing = Math.max(0, game.printing - dt);
  const target = { auto: autoDay(), day: 1, dusk: 0.45, night: 0 }[game.lightMode];
  game.day += (target - game.day) * Math.min(1, dt * 2);
  const nearDoor = game.actors.some(a => a.mode !== 'gone' && a.x > DOOR.x0 - 20 && a.x < DOOR.x1 + 20 && a.y < 3.6 * T);
  game.doorOpen += ((nearDoor ? 1 : 0) - game.doorOpen) * Math.min(1, dt * 6);
  updateParticles(dt, t);
  if ((panelT -= dt) <= 0) { panelT = 1; S.counts = UI.refreshPanel(); }

  if (Out.out.active) Out.updateOutside(dt, game.keys);
  Out.tickRemotes(dt);
  syncStreet(now);
  const outside = Out.out.active, BW = outside ? Out.OW : W, BH = outside ? Out.OH : H;

  // camera follows whoever is selected (or the walker, outside)
  if (game.selected?.mode === 'gone') game.deselect();
  const p = outside ? Out.out.walker : game.selected;
  const baseZ = outside ? h / Out.OH : p ? Math.max(fit * 1.3, 2) : fit * 0.98;
  const zt = Math.max(outside ? baseZ * 0.8 : fit * 0.6, baseZ * game.userZoom);
  const c = game.cam;
  c.z += (zt - c.z) * Math.min(1, dt * 4);
  let cx = p ? p.x : BW / 2, cy = p ? p.y - 24 : BH / 2;
  const hw = w / 2 / c.z, hh = h / 2 / c.z;
  cx = BW > hw * 2 ? Math.min(BW - hw, Math.max(hw, cx)) : BW / 2;
  cy = BH > hh * 2 ? Math.min(BH - hh, Math.max(hh, cy)) : BH / 2;
  c.x += (cx - c.x) * Math.min(1, dt * 5); c.y += (cy - c.y) * Math.min(1, dt * 5);

  // world
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = VOID; ctx.fillRect(0, 0, cvs.width, cvs.height);
  const k = dpr * c.z;
  ctx.setTransform(k, 0, 0, k, Math.round(dpr * (w / 2 - c.x * c.z)), Math.round(dpr * (h / 2 - c.y * c.z)));
  ctx.imageSmoothingEnabled = false;
  if (outside) {
    Out.drawOutside(ctx, t, game.day);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wk = Out.out.walker, s = toScreen(wk.headX, wk.headY);
    for (const r of Out.visibleOthers()) {
      if (r.alpha < 0.5) continue;
      const who = game.actors.find(x => x.id === r.id), rs = toScreen(r.x, r.headY);
      pill(rs.x, rs.y - 3, who ? who.short : r.id, 'rgba(138,180,255,.6)', STATUS[who ? who.status : 'break'].color);
    }
    if (wk.alpha > 0.5) pill(s.x, s.y - 3, wk.a.short, '#ffd27a', STATUS[wk.a.status].color);
    TVR.place(toScreen, true);
    requestAnimationFrame(frame);
    return;
  }
  ctx.drawImage(world.floor, 0, 0);
  if (game.day > 0.05) { ctx.globalAlpha = game.day * (0.75 + 0.25 * Math.sin(t * 0.4)); ctx.drawImage(world.shafts, 0, 0); ctx.globalAlpha = 1; }

  if (p) { // selection ring on the floor
    const ry = p.mode === 'sit' ? p.seat.standY : p.y;
    ctx.strokeStyle = `rgba(255,210,122,${0.55 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(p.x, ry - 1, 13, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }

  const items = OBJECTS.map(o => ({ s: o.sortY, o }));
  for (const a of game.actors) if (a.mode !== 'gone' && !Out.isOutside(a.id)) items.push({ s: a.sortY, a });
  items.sort((A, B) => A.s - B.s);
  for (const it of items) {
    if (it.o) {
      it.o.draw(ctx, t, S);
      const d = it.o.desk;
      if (d && d.screens.length) {
        const st = S.deskState(d), who = d.seatRef.occupant || deskOwner[d.id];
        d.screens.forEach((sc, i) => drawScreen(ctx, sc, who ? who.screens[i] : 'sheet', t, d.tx + i * 3, st));
      }
    } else {
      const a = it.a;
      const ring = a === game.selected ? '#ffd27a' : a === game.hover ? '#ffffff' : null;
      a.draw(ctx, t, ring);
    }
  }
  drawParticles(t);
  const present = game.actors.some(a => a.mode !== 'gone');
  drawNight(present);
  if (game.day > 0.02 && game.day < 0.98) { ctx.fillStyle = `rgba(255,130,60,${0.07 * Math.sin(Math.PI * game.day)})`; ctx.fillRect(0, 0, W, H); }

  // screen-space overlay
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawOverlay(t);
  TVR.place(toScreen);
  requestAnimationFrame(frame);
}

/* ---------------- live statuses (Supabase) ---------------- */
let pollTimer = null;
function applyPresence(rows) {
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  for (const a of game.actors) {
    const row = byId[a.id], st = row ? row.status : 'offline';
    if (game.setStatus(a.id, st) && row?.since) a.since = row.since.getTime();
    a.project = row?.project || null;
  }
}
async function poll() {
  try { applyPresence(await Live.fetchPresence()); }
  catch (err) { console.warn('presence', err); UI.toast('Não consegui ler o ponto agora; tento de novo em instantes', '#e07a5f'); }
}
function startLive() {
  game.live = true; document.body.classList.add('live');
  clearInterval(pollTimer); pollTimer = setInterval(poll, Live.POLL_MS);
  joinStreet();
  UI.refreshPanel();
}
const findMe = () => Live.whoAmI().then(id => { game.meId = id; }, err => { game.meId = null; console.warn('office_me', err); });
game.connect = async (email, password) => {
  await Live.signIn(email, password);
  findMe();
  startLive();
  await poll();
  TVR.refresh();
  UI.toast('Conectado ao ponto: status ao vivo', STATUS.working.color);
};
game.disconnect = async () => {
  clearInterval(pollTimer); pollTimer = null;
  leaveStreet();
  await Live.signOut();
  game.meId = null;
  game.live = false; document.body.classList.remove('live');
  for (const a of game.actors) a.project = null;
  TVR.refresh();
  UI.toast('Desconectado: modo demonstração', STATUS.offline.color);
  UI.refreshPanel();
};

/* ---------------- boot ---------------- */
let world;
async function boot() {
  try {
    await loadSprites(TEAM.map(t => t.id));
  } catch (err) {
    document.getElementById('intro').querySelector('p').textContent = 'Erro ao carregar sprites: ' + err.message + ' — rode via servidor local (run.bat).';
    throw err;
  }
  world = buildWorldArt();
  // signed in already? start from the real statuses so nobody walks in/out on load
  let presence = null;
  try { if (await Live.currentUser()) presence = await Live.fetchPresence(); } catch (err) { console.warn('presence', err); }
  const byId = Object.fromEntries((presence || []).map(r => [r.id, r]));
  game.actors = TEAM.map(d => {
    const row = byId[d.id];
    const a = new Actor(presence ? { ...d, status: row ? row.status : 'offline' } : d);
    if (row?.since) a.since = row.since.getTime();
    a.project = row?.project || null;
    return a;
  });
  for (const a of game.actors) deskOwner[a.desk] = a;
  resize();
  game.cam.z = game.view.fit * 0.98;
  UI.initUI(game);
  if (presence) { startLive(); findMe(); }
  S.counts = UI.refreshPanel();
  UI.runIntro(game.actors);
  requestAnimationFrame(frame);
  TVR.initTV();
}
boot();

/* ---------------- API for the timesheet app ----------------
   OfficeLive.setStatus('raffael', 'working' | 'break' | 'offline')
   OfficeLive.team()                 -> [{ id, name, status, since }]
   OfficeLive.on('status', cb)       -> also 'arrive'
   OfficeLive.select('jose') / OfficeLive.deselect()                       */
window.OfficeLive = {
  setStatus: (id, st) => game.setStatus(id, st),
  team: () => game.actors.map(a => ({ id: a.id, name: a.name, status: a.status, since: a.since })),
  select: id => { const a = game.actors.find(x => x.id === id); if (a) game.select(a); },
  deselect: () => game.deselect(),
  on: (ev, cb) => { (game.listeners[ev] = game.listeners[ev] || []).push(cb); },
};

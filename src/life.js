// Small bits of office life layered on top of the status AI (actors.js):
// tiredness after long stretches, coffee cups piling up, long breaks (Zzz / phone), project switches,
// kitchen chat, reactions to the TV and a robot vacuum that cleans at night.
import { T, solid, findPath } from './world.js';

const HOUR = 3600e3;
const CHAT = ['💬', '😂', '🤣', '☕', '👍', '😅', '⚽', '🍕', '🙌', '👀'];
const TV_SPOT = { x: 32 * T, y: 16 * T };

/* ---------------- per-frame update ---------------- */
let chatIn = 4, reply = null;
export function updateLife(dt, t, game, tv) {
  const now = Date.now();
  for (const a of game.actors) {
    a.look = null; a.bodyDy = 0; a.bodyDx = 0;
    if (a.mode === 'gone' || a.outside) { a.act = null; continue; }
    const worked = a.status === 'working' ? (now - a.since) / HOUR : 0;

    // tired after 2h+ at the desk: stretch, yawn or rub the eyes every minute or two
    const atDesk = a.status === 'working' && a.mode === 'sit' && a.seat === a.ownSeat;
    if (atDesk && worked >= 2) {
      if (a.tiredIn == null) a.tiredIn = 20 + Math.random() * 60;
      if (!a.act && (a.tiredIn -= dt) <= 0) {
        a.tiredIn = 45 + Math.random() * 75;
        const kind = ['stretch', 'yawn', 'rub'][(Math.random() * 3) | 0];
        a.act = { kind, t0: t, len: kind === 'stretch' ? 1.8 : 2.2 };
        a.setEmote({ stretch: '🙆', yawn: '🥱', rub: '😪' }[kind], a.act.len);
      }
    } else a.tiredIn = null;
    if (a.act) {
      const k = (t - a.act.t0) / a.act.len;
      if (k >= 1 || !atDesk) a.act = null;
      else if (a.act.kind === 'stretch') a.bodyDy = -Math.round(3 * Math.sin(Math.PI * k));           // arms up, body lifts
      else if (a.act.kind === 'yawn') a.bodyDy = -Math.round(1.5 + 1.5 * Math.sin(k * Math.PI * 4)); // leans back, sways
      else a.bodyDx = Math.round(Math.sin(t * 18));                                                   // rubbing the eyes
    }

    // long break: dozing or scrolling the phone in the kitchen
    a.lazy = a.status === 'break' && a.mode === 'sit' && a.seat?.kind === 'kitchen' && now - a.since > HOUR
      ? (Math.floor(a.phase * 10) % 2 ? 'zzz' : 'phone') : null;
    if (a.lazy === 'zzz') a.bodyDy = Math.round(Math.sin(t * 1.2 + a.phase)); // slow breathing

    // the TV: heads turn to it, people nod and tap their feet while something plays
    if (tv.playing && a.mode !== 'walk' && Math.hypot(a.x - TV_SPOT.x, a.y - TV_SPOT.y) < 10 * T && !a.act && a.lazy !== 'zzz') {
      const groove = Math.floor(a.phase * 7) % 4 !== 0; // most people get into it
      const beat = Math.floor(t * 3.6 + a.phase) % 2;   // ~108 bpm
      if (a.mode === 'sit') {
        if (a.glanceIn == null) a.glanceIn = Math.random() * 8;
        if ((a.glanceIn -= dt) <= 0) { a.glanceUntil = t + 2 + Math.random() * 3; a.glanceIn = 8 + Math.random() * 14; }
        if (t < (a.glanceUntil || 0)) a.look = a.x < TV_SPOT.x ? 'right' : 'left';
        if (groove) a.bodyDy = beat;
      } else if (groove) a.bodyDy = beat ? 0 : -1; // tapping along
      if (groove && Math.random() < dt / 30) a.setEmote(Math.random() < 0.5 ? '🎵' : '🎶', 1.6);
    } else a.glanceIn = null;
  }

  // kitchen chat: two people on a break trade emoji
  if ((chatIn -= dt) <= 0) {
    chatIn = 5 + Math.random() * 5;
    const k = game.actors.filter(a => a.status === 'break' && a.mode === 'sit' && a.seat?.kind === 'kitchen' && !a.lazy);
    if (k.length >= 2) {
      const i = (Math.random() * k.length) | 0, A = k[i], B = k[(i + 1 + ((Math.random() * (k.length - 1)) | 0)) % k.length];
      A.setEmote(CHAT[(Math.random() * CHAT.length) | 0], 2.2);
      reply = { who: B, at: t + 1.4 };
    }
  }
  if (reply && t >= reply.at) { if (reply.who.status === 'break') reply.who.setEmote(CHAT[(Math.random() * CHAT.length) | 0], 2); reply = null; }

  updateVacuum(dt, game);
}

/* ---------------- project switch ---------------- */
export function projectSwitch(a, from, to, t) {
  a.swoosh = { from: from?.color || '#6b7489', to: to?.color || '#6b7489', name: to?.name || 'Sem projeto', t0: t };
}

/* ---------------- world-space drawing ---------------- */
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

// paper cups next to the mug: one more for every 1.5 h of the current stretch (up to 4)
export function drawDeskCups(g, d, owner) {
  if (!owner || owner.status !== 'working' || d.kind === 'boss') return;
  const n = Math.min(4, Math.floor((Date.now() - owner.since) / (1.5 * HOUR)));
  if (!n) return;
  const ox = d.tx * T, oy = d.ty * T - 30, L = 30;
  const bx = d.face === 'up' ? ox + 4 : ox + 104, by = d.face === 'up' ? oy + L + 30 : oy + L + 36;
  for (let i = 0; i < n; i++) {
    const x = bx + (i % 2) * 7, y = by - Math.floor(i / 2) * 7 - (i % 2) * 2; // two little stacks
    px(g, x, y - 7, 6, 8, '#2a1c12'); px(g, x + 1, y - 6, 4, 6, '#f4efe6'); px(g, x + 1, y - 4, 4, 2, '#b5643c'); px(g, x + 1, y - 7, 4, 1, '#ffffff');
  }
}

// a phone glowing in the hands of whoever is scrolling on a long break
export function drawActorExtras(g, a, t) {
  if (a.lazy === 'phone' && a.seat) {
    const x = a.x + (a.seat.face === 'up' ? 3 : -2), y = a.seat.hipY - 10;
    px(g, x, y, 5, 7, '#14161b'); px(g, x + 1, y + 1, 3, 5, (Math.floor(t * 2 + a.phase) % 3) ? '#7fb8e6' : '#c3e88d');
  }
}

// a desk monitor tinted with the running project's colour (flashes when the project changes)
export function drawScreenTint(g, sc, who, t, state) {
  if (state !== 'on' || !who?.project || who.status !== 'working') return;
  px(g, sc.x, sc.y, sc.w, 2, who.project.color);
  const sw = who.swoosh, k = sw ? (t - sw.t0) / 1.2 : 1;
  if (k < 1) { g.globalAlpha = 0.65 * (1 - k); px(g, sc.x, sc.y, sc.w, sc.h, sw.to); g.globalAlpha = 1; }
}

/* ---------------- robot vacuum (night only) ---------------- */
const vac = { x: 22 * T, y: 18.7 * T, path: [], wait: 0, on: false, a: 0 };
function updateVacuum(dt, game) {
  vac.on = game.day < 0.3;
  vac.a += ((vac.on ? 1 : 0) - vac.a) * Math.min(1, dt * 2);
  if (vac.a < 0.02) return;
  if (!vac.path.length) {
    if ((vac.wait -= dt) > 0) return;
    for (let i = 0; i < 20; i++) { // a random reachable tile in the open office / corridor
      const tx = 11 + ((Math.random() * 22) | 0), ty = 7 + ((Math.random() * 16) | 0);
      if (solid[ty]?.[tx] !== 0) continue;
      const p = findPath(Math.floor(vac.x / T), Math.floor((vac.y - 2) / T), tx, ty);
      if (p?.length) { vac.path = p; break; }
    }
    vac.wait = 1 + Math.random() * 3;
  }
  let rem = 26 * dt;
  while (rem > 0 && vac.path.length) {
    const p = vac.path[0], dx = p.x - vac.x, dy = p.y - vac.y, d = Math.hypot(dx, dy);
    if (d <= rem) { vac.x = p.x; vac.y = p.y; vac.path.shift(); rem -= d; } else { vac.x += dx / d * rem; vac.y += dy / d * rem; rem = 0; }
  }
}
export const vacuumItem = {
  get sortY() { return vac.y - 6; },
  draw(g, t) {
    if (vac.a < 0.02) return;
    g.globalAlpha = vac.a;
    const x = Math.round(vac.x), y = Math.round(vac.y - 6);
    g.fillStyle = 'rgba(8,12,24,.3)'; g.beginPath(); g.ellipse(x, y + 3, 10, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#14161b'; g.beginPath(); g.ellipse(x, y, 9, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3f48'; g.beginPath(); g.ellipse(x, y - 1, 8, 4, 0, 0, Math.PI * 2); g.fill();
    px(g, x - 3, y - 3, 6, 1, '#5d6470');
    px(g, x - 1, y - 2, 2, 2, Math.floor(t * 2) % 2 ? '#4fd8ff' : '#1b6b88'); // status LED
    if (vac.path.length) px(g, x - 9 + (Math.floor(t * 12) % 3), y + 3, 2, 1, 'rgba(200,220,240,.35)'); // brush
    g.globalAlpha = 1;
  },
};

/* ---------------- screen-space overlay ---------------- */
// Zzz over sleepers, the 📁 → 📁 swoosh when a project changes
export function drawLifeOverlay(g, t, toScreen, game, z) {
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const a of game.actors) {
    if (a.mode === 'gone' || a.outside || a.alpha < 0.5) continue;
    const s = toScreen(a.headX, a.headY);
    if (a.lazy === 'zzz') {
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.6 + i / 3 + a.phase) % 1);
        g.globalAlpha = Math.sin(Math.PI * k);
        g.font = `700 ${Math.round(11 + i * 4 + z * 1.5)}px "Pixelify Sans", system-ui, sans-serif`;
        const zx = s.x + 18 + k * 16 + i * 4, zy = s.y - 26 - k * 26;
        g.lineWidth = 3; g.strokeStyle = 'rgba(9,15,29,.85)'; g.strokeText('z', zx, zy);
        g.fillStyle = '#e6eeff'; g.fillText('z', zx, zy);
      }
      g.globalAlpha = 1;
    }
    const sw = a.swoosh;
    if (sw) {
      const k = (t - sw.t0) / 2.6;
      if (k >= 1) { a.swoosh = null; continue; }
      const y = s.y - 48 - 6 * Math.min(1, k * 4), fadeA = k < 0.8 ? 1 : (1 - k) / 0.2;
      g.globalAlpha = fadeA;
      folder(g, s.x - 22, y, sw.from); folder(g, s.x + 22, y, sw.to);
      const ax = s.x - 10 + 20 * Math.min(1, k * 2.5); // the arrow shoots across
      g.fillStyle = '#ffffff'; g.fillRect(s.x - 10, y - 1, ax - (s.x - 10), 2);
      g.beginPath(); g.moveTo(ax + 4, y); g.lineTo(ax - 1, y - 4); g.lineTo(ax - 1, y + 4); g.fill();
      g.font = '600 11px "Pixelify Sans", system-ui, sans-serif';
      const w = g.measureText(sw.name).width + 12;
      g.fillStyle = 'rgba(9,15,29,.85)'; g.beginPath(); g.roundRect(s.x - w / 2, y - 30, w, 16, 5); g.fill();
      g.fillStyle = sw.to; g.fillRect(s.x - w / 2 + 4, y - 17, w - 8, 2);
      g.fillStyle = '#e9eef7'; g.fillText(sw.name, s.x, y - 18);
      g.globalAlpha = 1;
    }
  }
  g.textAlign = 'left';
}
function folder(g, x, y, col) {
  g.fillStyle = '#0b1120'; g.fillRect(x - 9, y - 7, 18, 14);
  g.fillStyle = col; g.fillRect(x - 8, y - 4, 16, 10); g.fillRect(x - 8, y - 6, 7, 3);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 8, y - 4, 16, 2);
}

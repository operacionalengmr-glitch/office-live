// DOM side panel (mock timesheet), character card, toasts and the loading screen.
import { STATUS } from './data.js';
import { portrait, frame, CW } from './sprites.js';

const $ = s => document.querySelector(s);
let game, rows = {};

// project names come from the database: escape before putting them in HTML
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const projectHTML = a => (a.project && a.status === 'working'
  ? `<span class="pjdot" style="background:${a.project.color}"></span>Trabalhando em <b>${esc(a.project.name)}</b>${a.project.client ? ` <small>· ${esc(a.project.client)}</small>` : ''}`
    + (a.project.task ? `<div class="tk">↳ ${esc(a.project.task)}</div>` : '')
  : '');

export function fmtDur(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), h = Math.floor(m / 60);
  return h ? `${h}h${String(m % 60).padStart(2, '0')}` : `${m}min`;
}

export function initUI(g) {
  game = g;
  const list = $('#list');
  for (const a of g.actors) {
    const li = document.createElement('li');
    li.tabIndex = 0; li.dataset.id = a.id;
    li.innerHTML = `<div class="av"></div>
      <div class="who"><b>${a.short}</b><small>${a.role}</small></div>
      <div class="tm"></div>
      <div class="st">${Object.entries(STATUS).map(([k, v]) => `<button data-s="${k}" title="${v.label}">${v.label}</button>`).join('')}</div>`;
    li.querySelector('.av').appendChild(portrait(a.id, 44));
    li.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) { g.setStatus(a.id, b.dataset.s); e.stopPropagation(); return; }
      g.select(a);
    });
    li.addEventListener('keydown', e => { if (e.key === 'Enter') g.select(a); });
    list.appendChild(li);
    rows[a.id] = li;
  }
  $('#cardClose').addEventListener('click', () => g.deselect());
  $('#lightBtn').addEventListener('click', () => g.cycleLight());
  const dlg = $('#login'), form = dlg.querySelector('form'), err = dlg.querySelector('.err');
  $('#liveBtn').addEventListener('click', () => {
    if (g.live) { g.disconnect(); return; }
    err.textContent = ''; dlg.hidden = false; form.email.focus();
  });
  dlg.querySelector('.cancel').addEventListener('click', () => { dlg.hidden = true; });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; err.textContent = '';
    try {
      await g.connect(form.email.value.trim(), form.password.value);
      form.password.value = ''; dlg.hidden = true;
    } catch (ex) {
      err.textContent = /invalid/i.test(ex.message || '') ? 'E-mail ou senha incorretos.' : 'Não consegui conectar: ' + (ex.message || ex);
    } finally { btn.disabled = false; }
  });
  $('#namesBtn').addEventListener('click', () => { g.showNames = !g.showNames; });
  $('#outBtn').addEventListener('click', () => g.comeBack());
  refreshPanel();
}

export function refreshPanel() {
  const now = Date.now(), counts = { working: 0, break: 0, offline: 0 };
  for (const a of game.actors) {
    counts[a.status]++;
    const li = rows[a.id];
    li.classList.toggle('sel', game.selected === a);
    li.classList.toggle('gone', a.status === 'offline');
    li.querySelectorAll('.st button').forEach(b => b.classList.toggle('on', b.dataset.s === a.status));
    li.querySelector('.tm').innerHTML = `<i style="background:${STATUS[a.status].color}"></i>${STATUS[a.status].label} · ${fmtDur(now - a.since)}`
      + (a.project && a.status === 'working' ? `<br><span class="pjdot" style="background:${a.project.color}"></span><span class="pjn">${esc(a.project.name)}</span>${a.project.task ? ` · ${esc(a.project.task)}` : ''}` : '');
  }
  if (game.selected) $('#card .pj').innerHTML = projectHTML(game.selected);
  $('#counts').innerHTML = Object.entries(counts).map(([k, n]) => `<span><i style="background:${STATUS[k].color}"></i>${n} ${STATUS[k].label.toLowerCase()}</span>`).join('');
  const d = new Date();
  $('#clock').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const lb = $('#liveBtn');
  lb.textContent = game.live ? '🟢 Ao vivo · sair' : '🔌 Conectar ao ponto';
  lb.classList.toggle('on', game.live);
  $('.phead h2 span').textContent = game.live ? 'ao vivo' : 'demo';
  $('#lightBtn').textContent = { auto: '🌗 Auto', day: '☀️ Dia', dusk: '🌇 Fim de tarde', night: '🌙 Noite' }[game.lightMode];
  return counts;
}

export function showCard(a) {
  const card = $('#card');
  if (!a) { card.classList.remove('show'); return; }
  const c = card.querySelector('canvas'); c.replaceWith(portrait(a.id, 84));
  card.querySelector('.nm').textContent = a.name;
  card.querySelector('.rl').textContent = `${a.role} · ${a.dept}`;
  card.querySelector('.pj').innerHTML = projectHTML(a);
  const q = card.querySelector('q'); q.textContent = a.quote; q.style.display = a.quote ? '' : 'none';
  card.style.setProperty('--accent', a.color);
  card.classList.add('show');
}

export function toast(text, color = '#8ab4ff') {
  const el = document.createElement('div');
  el.className = 'toast'; el.style.setProperty('--c', color); el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

// Loading screen: the whole team walks across, like a game's loading screen.
export function runIntro(actors) {
  const ov = $('#intro'), c = ov.querySelector('canvas'), g = c.getContext('2d');
  let start = performance.now(), done = false;
  const close = () => { if (done) return; done = true; ov.classList.add('out'); setTimeout(() => ov.remove(), 700); };
  ov.addEventListener('click', close);
  setTimeout(close, 3600);
  const fit = () => { c.width = Math.ceil(innerWidth / 3); c.height = 90; };
  fit();
  (function loop(now) {
    if (done && !ov.isConnected) return;
    const t = (now - start) / 1000;
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false;
    actors.forEach((a, i) => {
      const x = ((t * 46 + i * 34) % (c.width + 60)) - 50;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x + CW / 2, 80, 10, 3, 0, 0, 7); g.fill();
      g.drawImage(frame(a.id, 'walk', 'right', Math.floor(t * 8 + i)), Math.round(x), 80 - 62);
    });
    requestAnimationFrame(loop);
  })(start);
}

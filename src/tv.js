// Office TV: a shared YouTube queue. Everyone with the game open sees and hears the same video at the same
// point. The state lives in Supabase (supabase/office_tv.sql): when a video started (server clock) or where it
// was paused, so each viewer seeks to "now". Changes arrive over Realtime, with a slow poll as a fallback.
// A single YouTube player is laid over the TV in the office, or over the remote's screen while it is open
// (it is only moved with CSS, never re-parented, so it does not reload).
import { TEAM } from './data.js';
import { TV } from './art.js';
import * as Live from './supabase.js';
import { toast, esc } from './ui.js';

const $ = s => document.querySelector(s);
export const tv = { on: false, thumb: null, progress: 0 }; // read by the TV's art

let player = null, ready = false, st = null, queue = [], canEdit = false, skew = 0;
let loaded = null, thumbId = null, endedFor = null, autoMuted = false, stuck = 0, refreshing = null, again = false, isOpen = false;
const pref = (() => { try { return JSON.parse(localStorage.getItem('office-tv')) || {}; } catch { return {}; } })();
if (typeof pref.vol !== 'number') pref.vol = 60;
const savePref = () => { try { localStorage.setItem('office-tv', JSON.stringify(pref)); } catch { } };

const paused = () => st?.paused_pos != null;
const pos = () => !st?.video_id ? 0 : paused() ? st.paused_pos : (Date.now() + skew - Date.parse(st.started_at)) / 1000;
const who = id => TEAM.find(t => t.id === id)?.short || id || '';
const fmt = s => { s = Math.max(0, s | 0); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0, ss = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; };

// youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/, music.youtube.com, or a bare 11-char id
export function parseYouTube(s) {
  s = s.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u; try { u = new URL(s.includes('://') ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1, 12);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/) || [])[1];
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

async function titleOf(id) {
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (r.ok) return (await r.json()).title || null;
  } catch { }
  return null;
}

/* ---------------- shared state ---------------- */
export async function refresh() {
  if (refreshing) { again = true; return refreshing; }
  refreshing = (async () => {
    do {
      again = false;
      try {
        const t0 = Date.now(), d = await Live.tvGet(), t1 = Date.now();
        skew = Date.parse(d.now) - (t0 + t1) / 2;
        st = d.state; queue = d.queue || []; canEdit = !!d.can_edit;
      } catch (err) { console.warn('tv', err); }
    } while (again);
    refreshing = null;
    sync(); render();
  })();
  return refreshing;
}

async function act(fn, args, done) {
  if (!canEdit) { toast('Conecte ao ponto para controlar a TV', '#6b7489'); return false; }
  try { await Live.tvCall(fn, args); await refresh(); if (done) toast(done, '#8ab4ff'); return true; }
  catch (err) { toast('TV: ' + (/full/.test(err.message) ? 'a fila está cheia (50)' : err.message || err), '#e07a5f'); return false; }
}

/* ---------------- player ---------------- */
// bring the local player in line with the shared state; runs on every change and every few seconds
function sync() {
  tv.on = !!st?.video_id;
  if (tv.on && thumbId !== st.video_id) {
    const id = thumbId = st.video_id, im = new Image();
    tv.thumb = null; im.onload = () => { if (thumbId === id) tv.thumb = im; };
    im.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  }
  if (!ready) return;
  const S = YT.PlayerState;
  if (!tv.on) { if (loaded) { player.stopVideo(); loaded = null; } return; }
  const p = pos();
  if (st.video_id !== loaded) {
    loaded = st.video_id;
    if (paused()) player.cueVideoById({ videoId: loaded, startSeconds: p });
    else player.loadVideoById({ videoId: loaded, startSeconds: p });
    return;
  }
  const s = player.getPlayerState(), drift = Math.abs((player.getCurrentTime() || 0) - p);
  if (paused()) {
    if (s === S.PLAYING || s === S.BUFFERING) player.pauseVideo();
    else if (s === S.PAUSED && drift > 1.5) player.seekTo(p, true);
    return;
  }
  const dur = player.getDuration();
  if (dur && p > dur + 3) { ended(); return; }
  if (s === S.ENDED) return;
  if (s !== S.PLAYING && s !== S.BUFFERING) {
    // backup for browsers that don't send onAutoplayBlocked: still paused/cued after three tries while the tab is
    // visible. Not UNSTARTED: YouTube reports that during ads, which play with sound.
    stuck = (s === S.PAUSED || s === S.CUED) && !document.hidden ? stuck + 1 : 0;
    if (stuck >= 3) { stuck = 0; autoplayBlocked(); return; }
    player.seekTo(p, true); player.playVideo();
  } else { stuck = 0; if (drift > 2.5) player.seekTo(p, true); }
}

// the video is over (or can't play): whoever is signed in moves the queue on; the entry id makes it happen once
function ended() {
  if (!st?.entry_id || endedFor === st.entry_id) return;
  endedFor = st.entry_id;
  if (canEdit) Live.tvCall('skip', { p_entry: st.entry_id }).catch(err => console.warn('tv', err));
}

// browsers block autoplay with sound until the page gets a click: YouTube tells us (onAutoplayBlocked),
// then we play muted and unmute on the next click. (Guessing from a timer muted the TV during ads and slow buffering.)
function autoplayBlocked() {
  if (!tv.on || paused()) return;
  if (!autoMuted) toast('📺 O navegador segurou o som da TV: clique em qualquer lugar para ouvir', '#8ab4ff');
  autoMuted = true; player.mute(); player.playVideo(); render();
}
function applyVolume() {
  if (!ready) return;
  player.setVolume(pref.vol);
  if (pref.muted || autoMuted) player.mute(); else player.unMute();
}
const wake = () => { if (autoMuted) { autoMuted = false; applyVolume(); sync(); render(); } };
addEventListener('pointerdown', wake, true);
addEventListener('keydown', wake, true);

function loadAPI() {
  return new Promise(res => {
    if (window.YT?.Player) return res();
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
}

/* ---------------- placement (called every frame) ---------------- */
const stage = document.getElementById('stage');
let lastRect = '';
export function place(toScreen, away) { // away: the office isn't on screen (street scene)
  const el = $('#tvScreen'), show = tv.on && (isOpen || !away);
  let r;
  if (isOpen) r = $('#remote .slot').getBoundingClientRect();
  else {
    const s = TV.screen, a = toScreen(s.x, s.y), b = toScreen(s.x + s.w, s.y + s.h), o = stage.getBoundingClientRect();
    r = { left: o.left + a.x, top: o.top + a.y, width: b.x - a.x, height: b.y - a.y };
  }
  const k = [r.left, r.top, r.width, r.height].map(Math.round).join() + isOpen + show;
  if (k === lastRect) return;
  lastRect = k;
  Object.assign(el.style, { left: Math.round(r.left) + 'px', top: Math.round(r.top) + 'px', width: Math.round(r.width) + 'px', height: Math.round(r.height) + 'px' });
  el.classList.toggle('big', isOpen); el.classList.toggle('on', show);
}
export const overTV = (x, y) => { const b = TV.box; return b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h; };

/* ---------------- remote ---------------- */
export function open() { isOpen = true; $('#remote').hidden = false; render(); }
export function close() { isOpen = false; $('#remote').hidden = true; }
export const toggle = () => (isOpen ? close() : open());

function render() {
  const R = $('#remote');
  R.classList.toggle('edit', canEdit);
  R.querySelector('.slot').classList.toggle('on', tv.on);
  R.querySelector('.ttl').textContent = tv.on ? st.title || 'Vídeo do YouTube' : 'Nada tocando';
  R.querySelector('.by').textContent = tv.on && st.added_by ? `colocado por ${who(st.added_by)}` : '';
  R.querySelector('[data-a=toggle]').textContent = paused() ? '▶ Tocar' : '⏸ Pausar';
  R.querySelector('[data-a=toggle]').disabled = !tv.on;
  R.querySelector('[data-a=skip]').disabled = !tv.on;
  R.querySelector('[data-a=mute]').textContent = pref.muted || autoMuted ? '🔇' : '🔊';
  R.querySelector('[type=range]').value = pref.vol;
  R.querySelector('.qhead small').textContent = queue.length ? `· ${queue.length}` : '';
  R.querySelector('[data-a=clear]').disabled = !queue.length;
  R.querySelector('.queue').innerHTML = queue.length
    ? queue.map((q, i) => `<li><img src="https://i.ytimg.com/vi/${q.video_id}/default.jpg" alt=""><div><b>${i + 1}. ${esc(q.title || q.video_id)}</b><small>${esc(who(q.added_by))}</small></div><button data-rm="${q.id}" title="Tirar da fila">✕</button></li>`).join('')
    : '<li class="empty">A fila está vazia</li>';
  const tb = $('#tvBtn'), hush = tv.on && autoMuted;
  tb.classList.toggle('on', tv.on); tb.classList.toggle('hush', hush);
  tb.textContent = hush ? '🔇 TV · clique pra ouvir' : '📺 TV';
  tick();
}
function tick() {
  const dur = ready && tv.on ? player.getDuration() : 0, p = pos();
  tv.progress = dur ? Math.min(1, p / dur) : 0;
  if (isOpen) {
    $('#remote .time').textContent = tv.on ? `${fmt(Math.min(p, dur || p))}${dur ? ' / ' + fmt(dur) : ''}` : '';
    $('#remote .bar i').style.width = (tv.progress * 100).toFixed(1) + '%';
  }
}

function wire() {
  const R = $('#remote');
  $('#tvBtn').addEventListener('click', toggle);
  R.querySelector('.x').addEventListener('click', close);
  R.querySelector('[data-a=toggle]').addEventListener('click', () => act(paused() ? 'play' : 'pause'));
  R.querySelector('[data-a=skip]').addEventListener('click', () => act('skip', { p_entry: st?.entry_id ?? null }));
  R.querySelector('[data-a=clear]').addEventListener('click', () => act('clear', undefined, 'Fila limpa'));
  R.querySelector('[data-a=mute]').addEventListener('click', () => { pref.muted = !(pref.muted || autoMuted); autoMuted = false; savePref(); applyVolume(); render(); });
  R.querySelector('[type=range]').addEventListener('input', e => { pref.vol = +e.target.value; pref.muted = false; autoMuted = false; savePref(); applyVolume(); R.querySelector('[data-a=mute]').textContent = '🔊'; });
  R.querySelector('.queue').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) act('remove', { p_id: +b.dataset.rm }); });
  const form = R.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = parseYouTube(form.url.value);
    if (!id) { toast('Isso não parece um link do YouTube', '#e07a5f'); return; }
    const btn = form.querySelector('button'); btn.disabled = true;
    const title = await titleOf(id);
    if (await act('add', { p_video_id: id, p_title: title }, `📺 ${title || 'Vídeo'} entrou na fila`)) form.url.value = '';
    btn.disabled = false;
  });
}

export async function initTV() {
  wire(); render();
  // after a dropped connection (sleep, Wi-Fi, background tab) Realtime rejoins on its own: catch up on what we missed
  try { await Live.tvSubscribe(() => refresh(), status => { if (status === 'SUBSCRIBED') refresh(); }); }
  catch (err) { console.warn('tv realtime', err); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  addEventListener('online', () => refresh());
  setInterval(refresh, 30000); setInterval(sync, 4000); setInterval(tick, 500);
  await refresh();
  await loadAPI();
  player = new YT.Player('tvPlayer', {
    width: '100%', height: '100%',
    playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3 },
    events: {
      onReady: () => { ready = true; applyVolume(); sync(); render(); },
      onStateChange: e => { if (e.data === YT.PlayerState.ENDED) ended(); },
      onAutoplayBlocked: autoplayBlocked,
      onError: () => { if (!tv.on) return; toast('📺 Esse vídeo não pode tocar fora do YouTube; pulando', '#e07a5f'); ended(); },
    },
  });
}

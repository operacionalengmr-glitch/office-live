// Music under the Smart Fit (the Resenha and its dungeon). One exploration track loops while you walk around;
// it's picked on the speaker in the hub and remembered in this browser (0 = off). Battle tracks alternate
// 1, 2, 1, 2… each time a battle starts (startBattle / endBattle), crossfading in and out of exploration.
export const EXPLORE = ['Explore 1', 'Explore 2', 'Explore 3'];
const EXPLORE_SRC = ['assets/audio/explore1.m4a', 'assets/audio/explore2.m4a', 'assets/audio/explore3.m4a'];
const BATTLE_SRC = ['assets/audio/battle1.m4a', 'assets/audio/battle2.m4a'];
const VOLUME = 0.5, FADE_MS = 700;

const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : +v; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { } };

export const music = { explore: load('resenha.music.explore', 1), mode: null, battleNext: load('resenha.music.battle', 0) };
let current = null;

function fade(audio, to, done) {
  const from = audio.volume, t0 = performance.now();
  clearInterval(audio._fade);
  audio._fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / FADE_MS);
    audio.volume = from + (to - from) * k;
    if (k >= 1) { clearInterval(audio._fade); done?.(); }
  }, 40);
}
function play(src) {
  if (current && current._src === src) return;
  const old = current;
  if (old) fade(old, 0, () => old.pause());
  current = null;
  if (!src) return;
  const a = new Audio(src);
  a._src = src; a.loop = true; a.volume = 0;
  a.play().catch(() => { }); // blocked until the first click on the page; the TP click / any click counts
  fade(a, VOLUME);
  current = a;
}

export function startExplore() { music.mode = 'explore'; play(music.explore ? EXPLORE_SRC[music.explore - 1] : null); }
// n: 1..3, or 0 to switch the music off
export function setExplore(n) {
  music.explore = n; save('resenha.music.explore', n);
  if (music.mode === 'explore') startExplore();
}
export const nextExplore = () => setExplore((music.explore + 1) % (EXPLORE.length + 1));
export function startBattle() {
  music.mode = 'battle';
  play(BATTLE_SRC[music.battleNext]);
  music.battleNext = (music.battleNext + 1) % BATTLE_SRC.length; save('resenha.music.battle', music.battleNext);
}
export const endBattle = () => startExplore();
export function stop() { music.mode = null; play(null); }
export const playing = () => !!current && !current.paused;

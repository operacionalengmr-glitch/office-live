// Combat sound effects, synthesized with WebAudio (no files): thuds, swooshes, clangs, zaps, chimes and jingles.
// Each sound is a few short voices (an oscillator or noise, through an optional filter, with a fast attack and
// an exponential decay) into one gain + compressor. The context is created on the first sound, after the
// player has already clicked/typed, so browsers allow it.
const VOL = 0.32;
let ac = null, out = null, nbuf = null;
const last = {};
function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC(); out = ac.createGain(); out.gain.value = VOL;
    const comp = ac.createDynamicsCompressor(); out.connect(comp).connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function noise(c) {
  if (!nbuf) { nbuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(); s.buffer = nbuf; return s;
}
function v({ type = 'sine', f = 440, f2 = f, dur = 0.15, vol = 0.5, at = 0, filter, q = 1, ff = 1000, ff2 = ff, attack = 0.004 }) {
  const c = ctx(); if (!c) return;
  const t = c.currentTime + at, g = c.createGain();
  let src;
  if (type === 'noise') src = noise(c);
  else { src = c.createOscillator(); src.type = type; src.frequency.setValueAtTime(f, t); if (f2 !== f) src.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); }
  let node = src;
  if (filter) { const bq = c.createBiquadFilter(); bq.type = filter; bq.Q.value = q; bq.frequency.setValueAtTime(ff, t); if (ff2 !== ff) bq.frequency.exponentialRampToValueAtTime(Math.max(20, ff2), t + dur); node.connect(bq); node = bq; }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  node.connect(g).connect(out);
  src.start(t); src.stop(t + attack + dur + 0.05);
}
const thud = (f = 150, vol = 0.9) => { v({ f, f2: f * 0.3, dur: 0.16, vol }); v({ type: 'noise', dur: 0.06, vol: 0.5, filter: 'lowpass', ff: 3000, ff2: 300 }); };
const S = {
  swoosh: () => v({ type: 'noise', dur: 0.14, vol: 0.35, filter: 'bandpass', q: 1.4, ff: 500, ff2: 3000, attack: 0.03 }),
  dash: () => v({ type: 'noise', dur: 0.2, vol: 0.2, filter: 'bandpass', q: 0.8, ff: 300, ff2: 1300, attack: 0.05 }),
  wood: () => { v({ type: 'triangle', f: 420, f2: 160, dur: 0.09, vol: 0.5 }); thud(); },                  // bat, T-square
  punch: () => { v({ f: 130, f2: 50, dur: 0.12, vol: 0.85 }); v({ type: 'noise', dur: 0.05, vol: 0.45, filter: 'lowpass', ff: 1800 }); },
  metal: () => { v({ type: 'square', f: 1800, f2: 1500, dur: 0.1, vol: 0.1 }); v({ type: 'triangle', f: 2700, f2: 2400, dur: 0.25, vol: 0.14, at: 0.005 }); thud(); }, // wrench
  concrete: () => { thud(120); v({ type: 'noise', dur: 0.4, vol: 0.3, filter: 'lowpass', ff: 900, ff2: 200, at: 0.03 }); },   // rebar, slabs
  crit: () => { v({ f: 90, f2: 30, dur: 0.35, vol: 1 }); v({ type: 'noise', dur: 0.3, vol: 0.4, filter: 'highpass', ff: 2500, ff2: 7000, at: 0.01 }); v({ type: 'square', f: 660, f2: 990, dur: 0.12, vol: 0.07, at: 0.02 }); },
  fire: () => { v({ type: 'noise', dur: 0.35, vol: 0.45, filter: 'lowpass', ff: 600, ff2: 3000, attack: 0.02 }); v({ f: 110, f2: 60, dur: 0.2, vol: 0.5 }); },
  ice: () => { for (let i = 0; i < 4; i++) v({ type: 'triangle', f: 2400 + i * 500, f2: 1800 + i * 400, dur: 0.12, vol: 0.12, at: i * 0.03 }); v({ type: 'noise', dur: 0.15, vol: 0.25, filter: 'highpass', ff: 4000 }); },
  elec: () => { for (let i = 0; i < 5; i++) v({ type: 'square', f: 200 + Math.random() * 900, f2: 100 + Math.random() * 400, dur: 0.05, vol: 0.11, at: i * 0.035 }); v({ type: 'noise', dur: 0.2, vol: 0.2, filter: 'bandpass', ff: 3000, q: 3 }); },
  magic: () => { [880, 1175, 1568].forEach((f, i) => v({ f, f2: f * 1.5, dur: 0.18, vol: 0.13, at: i * 0.05 })); v({ f: 140, f2: 60, dur: 0.18, vol: 0.45 }); },
  blade: () => { v({ type: 'noise', dur: 0.12, vol: 0.4, filter: 'highpass', ff: 3000, ff2: 6000 }); v({ type: 'sawtooth', f: 1200, f2: 600, dur: 0.08, vol: 0.07 }); },
  hurt: () => { v({ f: 110, f2: 40, dur: 0.2, vol: 0.9 }); v({ type: 'noise', dur: 0.08, vol: 0.5, filter: 'lowpass', ff: 1400 }); },
  block: () => { v({ type: 'triangle', f: 900, f2: 700, dur: 0.12, vol: 0.22 }); v({ f: 160, f2: 80, dur: 0.1, vol: 0.5 }); },
  perfectGuard: () => { v({ type: 'triangle', f: 1600, f2: 1500, dur: 0.4, vol: 0.28 }); v({ type: 'triangle', f: 2400, f2: 2350, dur: 0.5, vol: 0.16, at: 0.01 }); v({ f: 200, f2: 90, dur: 0.12, vol: 0.5 }); },
  parry: () => { S.perfectGuard(); v({ type: 'square', f: 1320, f2: 1980, dur: 0.15, vol: 0.1, at: 0.06 }); },
  perfect: () => [1047, 1319, 1568, 2093].forEach((f, i) => v({ type: 'triangle', f, dur: 0.12, vol: 0.17, at: i * 0.04 })),
  dodge: () => v({ type: 'noise', dur: 0.18, vol: 0.25, filter: 'bandpass', q: 2, ff: 2000, ff2: 600, attack: 0.02 }),
  ko: () => { v({ f: 70, f2: 28, dur: 0.6, vol: 1 }); v({ type: 'noise', dur: 0.5, vol: 0.35, filter: 'lowpass', ff: 700, ff2: 120, at: 0.05 }); },
  heal: () => [523, 659, 784, 1047].forEach((f, i) => v({ f, dur: 0.25, vol: 0.15, at: i * 0.07 })),
  buff: () => { v({ type: 'triangle', f: 330, f2: 990, dur: 0.35, vol: 0.17, attack: 0.05 }); v({ f: 660, f2: 1320, dur: 0.3, vol: 0.1, at: 0.08 }); },
  charge: () => v({ type: 'sawtooth', f: 90, f2: 360, dur: 0.6, vol: 0.12, filter: 'lowpass', ff: 600, ff2: 2400, attack: 0.1 }),
  cast: () => v({ type: 'triangle', f: 300, f2: 1200, dur: 0.3, vol: 0.14, attack: 0.08 }),
  warn: () => { v({ type: 'square', f: 880, dur: 0.08, vol: 0.11 }); v({ type: 'square', f: 880, dur: 0.08, vol: 0.11, at: 0.12 }); },
  blip: () => v({ type: 'square', f: 1200, f2: 1400, dur: 0.04, vol: 0.05 }),
  tick: () => v({ type: 'square', f: 900, dur: 0.025, vol: 0.045 }),
  error: () => v({ type: 'square', f: 220, f2: 180, dur: 0.12, vol: 0.07 }),
  encounter: () => { v({ type: 'sawtooth', f: 110, f2: 55, dur: 0.5, vol: 0.2, filter: 'lowpass', ff: 1800, ff2: 300 }); v({ type: 'noise', dur: 0.4, vol: 0.3, filter: 'highpass', ff: 1500, ff2: 6000, attack: 0.15 }); },
  victory: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => v({ type: 'square', f, dur: i === 5 ? 0.45 : 0.1, vol: 0.08, at: i * 0.1 })),
  defeat: () => [392, 330, 262, 196].forEach((f, i) => v({ type: 'triangle', f, dur: 0.3, vol: 0.15, at: i * 0.18 })),
  levelup: () => [784, 988, 1175, 1568].forEach((f, i) => v({ type: 'square', f, dur: 0.12, vol: 0.07, at: 0.9 + i * 0.07 })),
};
// play a sound by name; the same one at most every 35 ms (multi-hits and area skills would stack)
export function sfx(name) {
  const now = performance.now(); if (now - (last[name] || 0) < 35) return; last[name] = now;
  try { S[name]?.(); } catch { }
}

// Each class's weapon, as pixel art in the characters' style (dark outline, 3-tone shading, a highlight),
// drawn in the walker's hand. Sprites point right from the grip; the pose comes from the swing progress:
// wind-up (raise it back) → strike (fast arc with a smear trail, the hit lands mid-strike) → follow-through.
// Fists jab forward instead of rotating.
const PAL = { o: '#1c1f27', k: '#1c1f27' };
const SPRITES = {
  bat: { grip: [2, 3], pal: { w: '#e2c08e', m: '#c8a070', d: '#8a6038', h: '#fff0c8', g: '#3a2a1e' }, rows: [
    '..............ooooooo...',
    'oooo.....ooooohhhhhhhoo.',
    'ogggooooommmmmhwwwwwwwwo',
    'ogggmmmmmmmmmmmmmmmmmmmo',
    'ogggdddddddddmmmmmmmmmmo',
    'oooo.....oooooddddddddo.',
    '..............oooooooo..'] },
  fists: { grip: [3, 3], pal: { w: '#f2efe8', m: '#d8d2c4', d: '#a8a090', h: '#c9483b' }, rows: [
    '.oooooo.',
    'owwwwwwo',
    'ohwhwhwo',
    'ommmmmmo',
    'ommmmmmo',
    'oddddddo',
    '.oooooo.'] },
  rebar: { grip: [3, 2], pal: { h: '#d88a5a', m: '#a0583a', d: '#5a3020', y: '#f2c14e' }, rows: [
    '.oooooo.....................',
    'oykykyoooooooooooooooooooooo',
    'oykykyhmhmhmhmhmhmhmhmhmhmho',
    'oykykydddddddddddddddddddddo',
    '.oooooooooooooooooooooooooo.'] },
  wrench: { grip: [3, 4], pal: { h: '#e9eef7', m: '#9aa1ac', d: '#5d6470', r: '#c9483b', s: '#8e2a2a' }, rows: [
    '...............ooo...',
    '..............ohhmo..',
    'oooooooooooooohhmmo..',
    'orrrrrrrhhhhhhhmo....',
    'orrrrrrrmmmmmmmmo....',
    'osssssssddddddddmo...',
    'oooooooooooooooohmmo.',
    '..............ommmmo.',
    '...............oooo..'] },
  tsquare: { grip: [2, 4], pal: { h: '#e2c08e', m: '#a0703f', w: '#d8ecff', t: '#2d6cdf' }, rows: [
    'oooo....................',
    'ohmo....................',
    'ohmoooooooooooooooooooo.',
    'ohmwwwwwwwwwwwwwwwwwwwwo',
    'ohmtwtwtwtwtwtwtwtwtwtwo',
    'ohmoooooooooooooooooooo.',
    'ohmo....................',
    'ohmo....................',
    'oooo....................'] },
};
const cache = {};
function sprite(kind) {
  if (cache[kind] !== undefined) return cache[kind];
  const s = SPRITES[kind]; if (!s) return (cache[kind] = null);
  const c = document.createElement('canvas'); c.width = Math.max(...s.rows.map(r => r.length)); c.height = s.rows.length;
  const g = c.getContext('2d');
  s.rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = s.pal[ch] || PAL[ch]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
  return (cache[kind] = { c, grip: s.grip, len: c.width - s.grip[0], tip: s.pal.h || s.pal.w });
}
export const weaponKinds = Object.keys(SPRITES);

const ease = k => k * k * (3 - 2 * k);
const REST = 1.75, RAISED = -2.3, FOLLOW = 1.15, SWING = 0.35;
// angle of the weapon for a swing with `left` seconds remaining (0 = resting)
function poseAngle(left) {
  if (left <= 0) return REST;
  const p = 1 - left / SWING;
  if (p < 0.35) return REST + (RAISED - REST) * ease(p / 0.35);
  if (p < 0.6) { const k = (p - 0.35) / 0.25; return RAISED + (FOLLOW - RAISED) * k * k; }
  return FOLLOW + (REST - FOLLOW) * ease((p - 0.6) / 0.4);
}

// w: walker (x, y, dir, mode, animT); swing: seconds left of the current swing; kind: class weapon
export function drawWeapon(g, w, swing, kind, t = 0) {
  const sp = sprite(kind); if (!sp) return;
  const side = w.dir === 'left' ? -1 : 1, bob = w.mode === 'walk' ? (Math.floor(w.animT) % 2) : Math.floor(t * 1.4) % 2;
  const hx = Math.round(w.x + 8 * side), hy = Math.round(w.y - 25 + bob);
  g.save(); g.imageSmoothingEnabled = false;
  if (kind === 'fists') { // jab: the wrapped fist shoots forward and back
    const p = swing > 0 ? 1 - swing / SWING : 0, fwd = p > 0.3 && p < 0.75 ? Math.sin((p - 0.3) / 0.45 * Math.PI) * 12 : 0;
    g.translate(hx + (fwd + 1) * side, hy + 1); g.scale(side, 1);
    if (fwd > 4) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-fwd - 2, -2, fwd, 3); }
    g.drawImage(sp.c, -sp.grip[0], -sp.grip[1]);
    g.restore(); return;
  }
  const ang = poseAngle(swing);
  g.translate(hx, hy); g.scale(side, 1);
  const p = swing > 0 ? 1 - swing / SWING : 0;
  if (p > 0.35 && p < 0.75) { // smear along the arc of the tip
    const a1 = poseAngle(swing), a0 = Math.max(RAISED, a1 - 1.6), r = sp.len;
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, r - 3, a0, a1); g.stroke();
    g.strokeStyle = sp.tip; g.globalAlpha = 0.5; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r - 1, a0 + 0.3, a1); g.stroke(); g.globalAlpha = 1;
  }
  g.rotate(ang);
  g.drawImage(sp.c, -sp.grip[0], -sp.grip[1]);
  g.restore();
}
// world position of the weapon tip during the swing (where hit sparks come from)
export function weaponTip(w, swing, kind) {
  const sp = sprite(kind), side = w.dir === 'left' ? -1 : 1, a = poseAngle(swing), r = sp ? sp.len : 16;
  return { x: w.x + 8 * side + Math.cos(a) * r * side, y: w.y - 25 + Math.sin(a) * r };
}

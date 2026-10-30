// Loads the atlases cut from the character sheets (tools/extract_sprites.py) and derives
// the in-game frames from the front / side / back poses: breathing idle, walk cycles
// (leg lift for front/back; the sheet's own side walk when it has one, else a scissor
// stride) and the seated upper-body crop.
import manifest from '../assets/sprites/manifest.js';

export const CW = manifest.cellW, CH = manifest.cellH, FOOT = manifest.foot;

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function toCanvas(img) { const c = canvas(CW, CH); c.getContext('2d').putImageData(img, 0, 0); return c; }
function flipX(src) { const c = canvas(src.width, src.height), g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; }

function measure(d) {
  let top = CH, bot = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (d.data[(y * CW + x) * 4 + 3]) { if (y < top) top = y; if (y > bot) bot = y; }
  const h = bot - top + 1;
  return { top, bot, h, hip: top + Math.round(h * 0.6), knee: top + Math.round(h * 0.8), neck: top + Math.round(h * 0.36) };
}

// out(x, y) = src(fn(x, y)); fn returns [sx, sy] or null; optional colour multiplier
function remap(src, fn, out = new ImageData(CW, CH), mul = 1, rows = [0, CH]) {
  const s = src.data, o = out.data;
  for (let y = rows[0]; y < rows[1]; y++) for (let x = 0; x < CW; x++) {
    const p = fn(x, y); if (!p) continue;
    const [sx, sy] = p; if (sx < 0 || sy < 0 || sx >= CW || sy >= CH) continue;
    const i = (sy * CW + sx) * 4; if (!s[i + 3]) continue;
    const j = (y * CW + x) * 4;
    o[j] = s[i] * mul; o[j + 1] = s[i + 1] * mul; o[j + 2] = s[i + 2] * mul; o[j + 3] = 255;
  }
  return out;
}

const breath = (d, m) => remap(d, (x, y) => (y < m.neck ? [x, y - 1] : [x, y]));

function legLift(d, m, leftLeg) {
  const cx = CW / 2;
  return remap(d, (x, y) => {
    if (y < m.hip) return [x, y + 1];                       // body bob
    const lifted = leftLeg ? x < cx : x >= cx;
    return lifted && y >= m.knee - 1 ? [x, y + 2] : [x, y];
  });
}

function stride(d, m, farForward) {
  const out = new ImageData(CW, CH), S = 4, legRows = [m.hip, CH];
  const sh = y => Math.round(S * Math.max(0, y - m.hip) / Math.max(1, FOOT - m.hip));
  const fwd = (x, y) => [x + sh(y), y], back = (x, y) => [x - sh(y), y];
  // far leg is darker and drawn first
  if (farForward) { remap(d, fwd, out, 0.72, legRows); remap(d, back, out, 1, legRows); }
  else { remap(d, back, out, 0.72, legRows); remap(d, fwd, out, 1, legRows); }
  remap(d, (x, y) => [x, y], out, 1, [0, m.hip]);
  return out;
}
const bobUp = (d, m) => remap(d, (x, y) => (y < m.hip ? [x, y + 1] : [x, y]));

export const SPR = {};

export async function loadSprites(ids) {
  await Promise.all(ids.map(async id => {
    const info = manifest.chars[id];
    if (!info) throw new Error('no sprite for ' + id);
    const img = await loadImg(`assets/sprites/${id}.png`);
    const c = canvas(img.width, img.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const cell = i => g.getImageData(i * CW, 0, CW, CH);
    const base = { down: cell(info.anims.front[0]), left: cell(info.anims.side[0]), up: cell(info.anims.back[0]) };
    const frames = { stand: {}, walk: {}, sit: {} }, meta = {};
    for (const dir of ['down', 'left', 'up']) {
      const d = base[dir], m = measure(d); meta[dir] = m;
      frames.stand[dir] = [toCanvas(d), toCanvas(breath(d, m))];
      frames.walk[dir] = dir === 'left'
        ? [toCanvas(stride(d, m, true)), toCanvas(bobUp(d, m)), toCanvas(stride(d, m, false)), toCanvas(bobUp(d, m))]
        : [toCanvas(legLift(d, m, true)), toCanvas(d), toCanvas(legLift(d, m, false)), toCanvas(d)];
      frames.sit[dir] = frames.stand[dir];
    }
    // hand-drawn side walk cycle from the sheet beats the synthesized stride
    if (info.anims.walk) frames.walk.left = info.anims.walk.map(i => toCanvas(cell(i)));
    for (const k of ['stand', 'walk', 'sit']) frames[k].right = frames[k].left.map(flipX);
    meta.right = meta.left;
    SPR[id] = { frames, meta };
  }));
}

export function frame(id, pose, dir, i) {
  const f = SPR[id].frames[pose][dir], n = f.length;
  return f[((i % n) + n) % n]; // i can be negative (rAF timestamps may predate the start time)
}

// 1px silhouette outline in a given colour, cached per frame canvas
export function outline(src, color) {
  src._ol = src._ol || {};
  if (src._ol[color]) return src._ol[color];
  const c = canvas(CW + 2, CH + 2), g = c.getContext('2d');
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(src, dx, dy);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return (src._ol[color] = c);
}

// head-and-shoulders portrait for the UI
export function portrait(id, size = 64) {
  const m = SPR[id].meta.down, src = SPR[id].frames.stand.down[0];
  const ch = Math.round(m.h * 0.46), cw = ch;
  const c = canvas(size, size), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, CW / 2 - cw / 2, m.top - 1, cw, cw, 0, 0, size, size);
  return c;
}

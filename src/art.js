// Procedural pixel art for the office: floor, 3/4 walls, furniture, animated screens and lights.
// Everything static is painted once into offscreen canvases; objects are y-sorted with the people.
import { T, MW, MH, W, H, floorT, wallT, DESKS, PROPS, SEATS, rng } from './world.js';

export const VOID = '#0a1120';
const OUT = '#1c1f27';

/* ---------------- helpers ---------------- */
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
export function shade(hex, f) {
  const n = parseInt(hex.slice(1, 7), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
  return '#' + [r, gg, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function pe(g, cx, cy, rx, ry, c) { // pixel ellipse
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); g.fillRect(Math.round(cx - w), Math.round(cy + y), Math.max(1, w * 2), 1); }
}
function peO(g, cx, cy, rx, ry, c, line = OUT) { pe(g, cx, cy, rx + 1, ry + 1, line); pe(g, cx, cy, rx, ry, c); }
function block(g, x, y, w, top, front, c) {
  R(g, x, y, w, top + front, c.line);
  R(g, x + 1, y + 1, w - 2, top - 1, c.top);
  R(g, x + 1, y + 1, w - 2, 1, c.hi);
  R(g, x + 1, y + top - 2, w - 2, 1, shade(c.top, -0.07));
  R(g, x + 1, y + top, w - 2, front - 1, c.front);
  R(g, x + 1, y + top, w - 2, 1, c.frontHi);
  R(g, x + 1, y + top + front - 2, w - 2, 1, c.frontLo);
}
const shadow = (g, x, y, w, h, a = 0.22) => { g.fillStyle = `rgba(8,12,24,${a})`; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill(); };
export { cv, R, pe, peO, block, shadow, OUT, LEAF }; // shared with the street scene (outside.js)

// 3x5 pixel font for signs and labels
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '&': '010101010101011', ':': '000010000010000', '.': '000000000000010', '-': '000000111000000', ' ': '000000000000000', '%': '101001010100101',
};
export function ptext(g, s, x, y, c, sc = 1) {
  g.fillStyle = c;
  for (const ch of s.toUpperCase()) {
    const f = FONT[ch] || FONT[' '];
    for (let i = 0; i < 15; i++) if (f[i] === '1') g.fillRect(x + (i % 3) * sc, y + ((i / 3) | 0) * sc, sc, sc);
    x += 4 * sc;
  }
}
export const ptextW = (s, sc = 1) => s.length * 4 * sc - sc;

/* ---------------- palettes ---------------- */
const DESK = { line: '#3a2616', top: '#c99f70', hi: '#e2be8f', front: '#a27a50', frontHi: '#b88d60', frontLo: '#7d5b39' };
const WALNUT = { line: '#21140c', top: '#7d5237', hi: '#a06f4c', front: '#5a3924', frontHi: '#6f4a31', frontLo: '#3f2819' };
const OAK = { line: '#3a2616', top: '#c48e5c', hi: '#dfae7c', front: '#93633b', frontHi: '#a8754a', frontLo: '#714a2a' };
const STONE = { line: '#4b525c', top: '#d7dbe0', hi: '#f2f4f6', front: '#efede8', frontHi: '#ffffff', frontLo: '#c9c6bf' };
const WALL = { cap: '#b9c0ca', capHi: '#d9dee5', capLo: '#8b93a0', face: '#ebe6dc', faceHi: '#f3efe7', faceSh: '#d7d0c3', base: '#5e6571', baseHi: '#7a828f' };
const LEAF = ['#1f4228', '#2f6b3a', '#3f8a46', '#5aa957', '#86c86e'];

/* ---------------- skylines (windows) ---------------- */
const skyCache = {};
function skyline(w, h, night, seed) {
  const k = [w, h, night, seed].join(); if (skyCache[k]) return skyCache[k];
  const [c, g] = cv(w, h), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, h);
  if (night) { gr.addColorStop(0, '#0b1230'); gr.addColorStop(1, '#2b3566'); } else { gr.addColorStop(0, '#7fb8e6'); gr.addColorStop(1, '#d6ecf8'); }
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (night) for (let i = 0; i < w * h / 60; i++) R(g, r() * w, r() * h * 0.5, 1, 1, 'rgba(255,255,255,.6)');
  else { R(g, w * 0.2, h * 0.18, 8, 2, 'rgba(255,255,255,.8)'); R(g, w * 0.2 + 3, h * 0.18 - 2, 6, 2, 'rgba(255,255,255,.8)'); }
  for (let layer = 0; layer < 2; layer++) {
    let x = -2;
    while (x < w) {
      const bw = 6 + (r() * 12 | 0), bh = h * (0.25 + r() * (layer ? 0.45 : 0.6));
      const col = night ? (layer ? '#141b31' : '#1f2847') : (layer ? '#6f849c' : '#94a9c0');
      R(g, x, h - bh, bw, bh, col);
      for (let yy = h - bh + 2; yy < h - 1; yy += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 2)
        if (r() < (night ? 0.35 : 0.5)) R(g, xx, yy, 1, 1, night ? (r() < 0.8 ? '#ffd98a' : '#9fd3ff') : (layer ? '#8aa0b8' : '#b6c8d9'));
      x += bw + (r() * 2 | 0);
    }
  }
  return (skyCache[k] = c);
}
function drawWindowView(g, x, y, w, h, day, seed) {
  g.drawImage(skyline(w, h, true, seed), x, y);
  if (day > 0) { g.globalAlpha = day; g.drawImage(skyline(w, h, false, seed), x, y); g.globalAlpha = 1; }
}
function windowFrame(g, x, y, w, h) {
  R(g, x - 2, y - 2, w + 4, h + 4, '#5b6370'); R(g, x - 1, y - 1, w + 2, h + 2, '#8d96a3');
  R(g, x - 3, y + h + 1, w + 6, 3, '#c9ced6'); R(g, x - 3, y + h + 1, w + 6, 1, '#eef1f4');
}
function windowGlass(g, x, y, w, h) { // roller blind, reflections + mullions, drawn over the view
  const bh = Math.round(h * 0.42);
  R(g, x, y, w, bh, 'rgba(236,234,226,.93)'); R(g, x, y + bh - 2, w, 2, '#b9b6ad');
  for (let yy = y + 3; yy < y + bh - 2; yy += 4) R(g, x, yy, w, 1, 'rgba(200,197,188,.6)');
  g.fillStyle = 'rgba(255,255,255,.10)';
  for (let i = -h; i < w; i += 14) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.lineTo(x + i + h + 4, y); g.lineTo(x + i + 4, y + h); g.fill(); }
  for (let xx = x + 15; xx < x + w - 4; xx += 16) R(g, xx, y, 1, h, '#8d96a3');
}

/* ---------------- floor ---------------- */
export function buildFloor() {
  const [c, g] = cv(W, H), r = rng(7);
  R(g, 0, 0, W, H, VOID);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const px = x * T, py = y * T, f = floorT[y][x];
    if (f === 'tile') { // charcoal carpet tiles, pile direction alternating like the real office
      const base = shade((x + y) % 2 ? '#5a5f68' : '#555a62', r() * 0.03 - 0.015);
      R(g, px, py, T, T, base);
      const horiz = (x + y) % 2;
      for (let i = 2; i < T; i += 3) horiz ? R(g, px, py + i, T, 1, shade(base, -0.05)) : R(g, px + i, py, 1, T, shade(base, -0.05));
      for (let i = 0; i < 18; i++) R(g, px + r() * 31, py + r() * 31, 1, 1, r() < 0.5 ? shade(base, 0.1) : shade(base, -0.12));
      R(g, px, py, T, 1, '#4a4e55'); R(g, px, py, 1, T, '#4a4e55');
    } else if (f === 'wood') {
      const tones = ['#a06c43', '#9a6740', '#a87347', '#94623c', '#9d6a42'];
      for (let i = 0; i < 4; i++) {
        const yy = py + i * 8, tone = tones[(x * 3 + y * 7 + i * 2) % 5];
        R(g, px, yy, T, 8, tone); R(g, px, yy, T, 1, shade(tone, 0.12)); R(g, px, yy + 7, T, 1, '#6e4529');
        const seam = (x * 13 + y * 5 + i * 11) % 32; R(g, px + seam, yy, 1, 7, '#6e4529');
        for (let k = 0; k < 3; k++) R(g, px + r() * 30, yy + 2 + r() * 4, 3 + r() * 5, 1, shade(tone, -0.08));
      }
    } else if (f === 'kit') {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const dark = (x * 2 + i + y * 2 + j) % 2;
        R(g, px + i * 16, py + j * 16, 16, 16, dark ? '#c6ced8' : '#ebe8e2');
        R(g, px + i * 16, py + j * 16, 16, 1, dark ? '#b6bfca' : '#d9d5cd');
      }
    } else if (f === 'wc') {
      R(g, px, py, T, T, '#e1e8ee');
      for (let i = 0; i < T; i += 8) { R(g, px, py + i, T, 1, '#c8d2db'); R(g, px + i, py, 1, T, '#c8d2db'); }
    } else if (f === 'carpet') {
      R(g, px, py, T, T, '#36425f');
      for (let j = 0; j < T; j += 8) for (let i = 0; i < T; i += 8) { R(g, px + i + 3, py + j + 3, 2, 2, '#3f4c6c'); R(g, px + i + 4, py + j + 2, 1, 1, '#45537a'); }
      if (r() < 0.3) R(g, px + r() * 30, py + r() * 30, 1, 1, '#2d3750');
    }
  }
  // rug in the bosses' lounge
  const rx = 2 * T + 8, ry = 12 * T + 18, rw = 6 * T - 16, rh = 4 * T + 4;
  R(g, rx, ry, rw, rh, '#5b3a33'); R(g, rx + 3, ry + 3, rw - 6, rh - 6, '#b78a5c'); R(g, rx + 5, ry + 5, rw - 10, rh - 10, '#7a4b3c');
  for (let i = rx + 10; i < rx + rw - 10; i += 10) for (let j = ry + 10; j < ry + rh - 10; j += 10) { R(g, i, j, 4, 4, '#93604a'); R(g, i + 1, j + 1, 2, 2, '#c9a26e'); }
  // door mat
  R(g, 3 * T + 4, 2 * T + 2, 2 * T - 8, 20, '#2b2f37'); R(g, 3 * T + 6, 2 * T + 4, 2 * T - 12, 16, '#3a404b');
  ptext(g, 'M&R', 4 * T - ptextW('M&R') / 2, 2 * T + 9, '#9aa4b2');
  // thresholds
  R(g, 11 * T, 6 * T + 30, 3 * T, 2, '#5c3b24'); R(g, 10 * T + 4, 14 * T, 24, 2 * T, 'rgba(0,0,0,.08)');
  // ambient occlusion next to walls
  for (let y = 1; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (wallT[y][x] || floorT[y][x] === 'void') continue;
    const px = x * T, py = y * T;
    if (wallT[y - 1][x]) { const gr = g.createLinearGradient(0, py, 0, py + 14); gr.addColorStop(0, 'rgba(10,14,30,.38)'); gr.addColorStop(1, 'rgba(10,14,30,0)'); g.fillStyle = gr; g.fillRect(px, py, T, 14); }
    if (wallT[y][x - 1]) { const gr = g.createLinearGradient(px, 0, px + 8, 0); gr.addColorStop(0, 'rgba(10,14,30,.28)'); gr.addColorStop(1, 'rgba(10,14,30,0)'); g.fillStyle = gr; g.fillRect(px, py, 8, T); }
    if (wallT[y][x + 1]) { const gr = g.createLinearGradient(px + T, 0, px + T - 8, 0); gr.addColorStop(0, 'rgba(10,14,30,.28)'); gr.addColorStop(1, 'rgba(10,14,30,0)'); g.fillStyle = gr; g.fillRect(px + T - 8, py, 8, T); }
  }
  return c;
}

// sun shafts from the east curtain wall and the north windows (drawn over the floor in daytime)
export function buildShafts() {
  const [c, g] = cv(W, H);
  const shaft = (pts, x0, y0, x1, y1, a) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(255,236,190,${a})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.fill();
  };
  for (let y = 7; y < 22; y += 2) {
    const y0 = y * T + 6, y1 = y0 + 2 * T - 14, L = 7 * T;
    shaft([[33 * T, y0], [33 * T, y1], [33 * T - L, y1 + L * 0.4], [33 * T - L, y0 + L * 0.4]], 33 * T, 0, 33 * T - L, 0, 0.16);
  }
  for (const [x0, x1] of [[6 * T + 6, 8 * T + 26], [21 * T + 6, 22 * T + 26]]) {
    const L = 3 * T;
    shaft([[x0, 2 * T], [x1, 2 * T], [x1 + L * 0.3, 2 * T + L], [x0 + L * 0.3, 2 * T + L]], 0, 2 * T, 0, 2 * T + L, 0.18);
  }
  // keep light out of walls/void
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (wallT[y][x] || floorT[y][x] === 'void') g.fillRect(x * T, y * T, T, T);
  return c;
}

/* ---------------- object factory ---------------- */
export const OBJECTS = [];
export const LIGHTS = [];
export const TV = { screen: null, box: null }; // world rects, filled when the TV prop is built
function addObj(x, y, w, h, sortY, paint, anim) {
  const [c, g] = cv(w, h); paint(g);
  const o = { x, y, w, h, sortY, c, anim, draw(ctx, t, S) { ctx.drawImage(c, x, y); if (anim) anim(ctx, t, S, o); } };
  OBJECTS.push(o); return o;
}

/* ---------------- walls ---------------- */
function wallFace(g, x, y, w, h) { // generic painted face, y..y+h, with cap above already drawn
  R(g, x, y, w, h, WALL.face); R(g, x, y, w, 3, WALL.faceSh); R(g, x, y + 3, w, 1, '#e2dccf');
  R(g, x, y + h - 6, w, 6, WALL.base); R(g, x, y + h - 6, w, 1, WALL.baseHi); R(g, x, y + h - 1, w, 1, '#3c424c');
}
function cap(g, x, y, w, h) { R(g, x, y, w, h, WALL.cap); R(g, x, y, w, 1, WALL.capHi); R(g, x, y + h - 1, w, 1, WALL.capLo); }

function buildWalls() {
  // --- north outer wall (rows 0-1) ---
  addObj(0, 0, W, 2 * T, 2 * T, g => {
    cap(g, 0, 0, W, 6); wallFace(g, 0, 6, W, 2 * T - 6);
    // entrance: plaque + glass door frame
    R(g, 3 * T - 4, 8, 2 * T + 8, 2 * T - 8, '#3a404a'); R(g, 3 * T - 2, 10, 2 * T + 4, 2 * T - 10, '#566070');
    R(g, 3 * T, 12, 2 * T, 2 * T - 12, '#18202e');
    R(g, 34, 20, 52, 22, '#1d2a45'); R(g, 35, 21, 50, 20, '#253659'); ptext(g, 'M&R', 60 - ptextW('M&R', 2) / 2, 24, '#e9eef7', 2);
    ptext(g, 'ENGENHARIA', 60 - ptextW('ENGENHARIA') / 2, 36, '#8ab4ff');
    // windows (views are animated)
    windowFrame(g, 6 * T + 6, 14, 2 * T + 20, 34); windowFrame(g, 21 * T + 6, 14, 2 * T + 20, 34);
    // kitchen upper cabinets + backsplash
    for (let i = 0; i < 10; i++) {
      const x = (9 + i) * T;
      R(g, x, 8, T, 22, '#5f6670'); R(g, x + 1, 9, T - 2, 20, '#f2f0eb'); R(g, x + 1, 9, T - 2, 1, '#ffffff'); R(g, x + 1, 27, T - 2, 2, '#d8d4cc');
      R(g, x + (i % 2 ? 4 : T - 6), 20, 2, 5, '#8a8f97');
    }
    R(g, 9 * T, 30, 10 * T, 1, '#ffe3a1');
    for (let yy = 31; yy < 58; yy += 6) for (let xx = 9 * T + ((yy / 6 | 0) % 2) * 6; xx < 19 * T; xx += 12) { R(g, xx, yy, 12, 6, '#d6d3cc'); R(g, xx + 1, yy + 1, 10, 4, '#f6f5f1'); }
    R(g, 9 * T, 30, 10 * T, 2, 'rgba(255,214,140,.35)');
    // WC tiles + mirror
    for (let yy = 10; yy < 58; yy += 8) for (let xx = 26 * T; xx < 33 * T; xx += 8) { R(g, xx, yy, 8, 8, '#b8cbd8'); R(g, xx + 1, yy + 1, 7, 7, '#d4e3ec'); }
    R(g, 31 * T + 2, 12, 2 * T - 4, 26, '#9aa3ad'); R(g, 31 * T + 4, 14, 2 * T - 8, 22, '#cfe1ec');
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(31 * T + 8, 16, 3, 18); g.fillRect(31 * T + 14, 16, 1, 18);
    // kitchen: framed print + menu board
    R(g, 24 * T + 4, 16, 22, 26, '#2a2f38'); R(g, 24 * T + 6, 18, 18, 22, '#f2e7d0'); pe(g, 24 * T + 15, 27, 5, 5, '#e07a5f'); R(g, 24 * T + 8, 34, 14, 3, '#3d8a6a');
  }, (g, t, S) => {
    drawWindowView(g, 6 * T + 6, 14, 2 * T + 20, 34, S.day, 3); windowGlass(g, 6 * T + 6, 14, 2 * T + 20, 34);
    drawWindowView(g, 21 * T + 6, 14, 2 * T + 20, 34, S.day, 9); windowGlass(g, 21 * T + 6, 14, 2 * T + 20, 34);
    // sliding glass doors
    const o = S.doorOpen * 28, x0 = 3 * T, y0 = 12, h = 2 * T - 12;
    drawWindowView(g, x0, y0, 2 * T, h, S.day, 21);
    for (const [px, dir] of [[x0 - o, 1], [x0 + T + o, -1]]) {
      g.save(); g.beginPath(); g.rect(x0, y0, 2 * T, h); g.clip();
      R(g, px, y0, T, h, 'rgba(160,200,225,.55)'); R(g, px, y0, T, 2, '#9aa4b1'); R(g, px, y0, 2, h, '#9aa4b1'); R(g, px + T - 2, y0, 2, h, '#9aa4b1');
      R(g, px + (dir > 0 ? T - 6 : 4), y0 + h / 2 - 6, 2, 12, '#dfe5ec');
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(px + 6, y0 + 4, 3, h - 8);
      g.restore();
    }
  });

  // --- internal wall row 6 (two segments around the corridor opening) ---
  const top = 6 * T - 22;
  addObj(T, top, 10 * T, T + 22, 7 * T, g => {
    cap(g, 0, 0, 10 * T, 6); wallFace(g, 0, 6, 10 * T, T + 16);
    // built-in bookshelf
    const bx = T, bw = 6 * T;
    R(g, bx - 2, 7, bw + 4, 41, '#3a2416'); R(g, bx, 9, bw, 37, '#6b4329');
    const books = ['#c9483b', '#3f6fb5', '#e2b94a', '#4c9a6a', '#8a5bb5', '#d7d0c3', '#2f3b52', '#b86b3d'], r = rng(5);
    for (const sy of [10, 22, 34]) {
      R(g, bx, sy + 10, bw, 2, '#4d2f1d');
      let x = bx + 2;
      while (x < bx + bw - 4) {
        if (r() < 0.1) { pe(g, x + 4, sy + 7, 3, 3, '#e3c26a'); R(g, x + 3, sy + 9, 3, 1, '#a07d2c'); x += 10; continue; }
        const bwid = 2 + (r() * 3 | 0), bh = 7 + (r() * 3 | 0), col = books[(r() * books.length) | 0];
        R(g, x, sy + 10 - bh, bwid, bh, col); R(g, x, sy + 10 - bh, 1, bh, shade(col, 0.2)); x += bwid + (r() < 0.2 ? 2 : 0);
      }
    }
    // certificate
    R(g, 8 * T + 2, 12, 24, 18, '#2c2f36'); R(g, 8 * T + 4, 14, 20, 14, '#f4ecd8'); R(g, 8 * T + 7, 17, 14, 1, '#9a8a62'); R(g, 8 * T + 7, 20, 10, 1, '#9a8a62'); pe(g, 8 * T + 19, 24, 2, 2, '#c9483b');
    R(g, 10 * T - 4, 6, 4, T + 16, '#5c3b24'); // door post
  });
  addObj(14 * T, top, 19 * T, T + 22, 7 * T, g => {
    cap(g, 0, 0, 19 * T, 6); wallFace(g, 0, 6, 19 * T, T + 16);
    R(g, 0, 6, 4, T + 16, '#5c3b24');
    // whiteboard
    const wx = T, ww = 4 * T;
    R(g, wx - 2, 8, ww + 4, 32, '#8c95a1'); R(g, wx, 10, ww, 28, '#fbfcfd'); R(g, wx - 2, 40, ww + 4, 3, '#aab2bd');
    g.strokeStyle = '#3f6fb5'; g.lineWidth = 1; g.strokeRect(wx + 6.5, 14.5, 18, 9); g.strokeRect(wx + 40.5, 14.5, 18, 9); g.strokeRect(wx + 22.5, 27.5, 18, 7);
    R(g, wx + 25, 19, 15, 1, '#3f6fb5'); R(g, wx + 31, 24, 1, 3, '#3f6fb5'); R(g, wx + 49, 24, 1, 6, '#c9483b'); R(g, wx + 41, 30, 8, 1, '#c9483b');
    ptext(g, 'SPRINT', wx + 72, 13, '#2a2f38');
    const notes = ['#ffe17a', '#ff9fb3', '#9fe0ff', '#b6f09c'];
    for (let i = 0; i < 6; i++) R(g, wx + 72 + (i % 3) * 16, 21 + (i / 3 | 0) * 9, 12, 7, notes[i % 4]);
    R(g, wx + 20, 41, 6, 1, '#c9483b'); R(g, wx + 28, 41, 6, 1, '#3f6fb5');
    // TV frame (dashboard animated)
    R(g, 6.5 * T - 2, 7, 4 * T + 4, 36, '#101216'); R(g, 6.5 * T - 1, 8, 4 * T + 2, 34, '#23262d');
    R(g, 8.5 * T - 6, 43, 12, 3, '#3a3f48');
    // poster
    R(g, 12 * T + 2, 10, 28, 32, '#2a2f38'); R(g, 12 * T + 4, 12, 24, 28, '#1d2a45');
    ptext(g, 'M&R', 12 * T + 16 - ptextW('M&R') / 2, 18, '#8ab4ff'); R(g, 12 * T + 8, 26, 16, 1, '#8ab4ff');
    for (let i = 0; i < 4; i++) R(g, 12 * T + 8 + i * 4, 36 - i * 2 - 2, 3, i * 2 + 2, '#4fd18b');
    // kanban cork board
    const kx = 14 * T, kw = 4 * T;
    R(g, kx - 2, 8, kw + 4, 34, '#6e4a2e'); R(g, kx, 10, kw, 30, '#c09363');
    const r = rng(17);
    for (let i = 0; i < kw; i += 2) for (let j = 10; j < 40; j += 2) if (r() < 0.12) R(g, kx + i, j, 1, 1, '#a87d4f');
    ['TODO', 'DOING', 'DONE'].forEach((l, i) => ptext(g, l, kx + 4 + i * 42, 12, '#3a2416'));
    for (let i = 0; i < 9; i++) { const col = i % 3; R(g, kx + 4 + col * 42 + (r() * 6 | 0), 19 + (i / 3 | 0) * 7, 16 + (r() * 10 | 0), 5, notes[(i + col) % 4]); }
  }, (g, t, S) => {
    tvDashboard(g, 20.5 * T, top + 8 + 1, 4 * T, 32, t, S);
    clock(g, 19 * T + 16, top + 22, 1);
  });

  // --- WC partition wall (x=25, rows 2-4) ---
  addObj(25 * T + 9, 0, 14, 5 * T, 5 * T, g => {
    R(g, 0, 0, 14, 5 * T - 22, WALL.capLo); R(g, 1, 0, 12, 5 * T - 22, WALL.cap); R(g, 1, 0, 1, 5 * T - 22, WALL.capHi);
    R(g, 0, 5 * T - 22, 14, 22, WALL.faceSh); R(g, 1, 5 * T - 22, 12, 16, WALL.face); R(g, 0, 5 * T - 6, 14, 6, WALL.base);
    R(g, 3, 5 * T - 18, 8, 8, '#2d4f95'); ptext(g, 'WC', 3, 5 * T - 16, '#ffffff');
  });

  // --- glass wall of the bosses' room (x=10) ---
  const glass = (y0, y1, endFace) => addObj(10 * T + 10, y0, 12, y1 - y0, y1, g => {
    const h = y1 - y0 - (endFace ? 22 : 0);
    R(g, 0, 0, 12, h, '#6f7a88'); R(g, 1, 0, 10, h, 'rgba(178,220,242,.75)'); R(g, 2, 0, 1, h, 'rgba(255,255,255,.7)');
    for (let yy = 12; yy < h; yy += 32) R(g, 0, yy, 12, 2, '#6f7a88');
    if (endFace) {
      R(g, 0, h, 12, 22, '#6f7a88'); R(g, 1, h + 1, 10, 20, 'rgba(178,220,242,.65)'); R(g, 3, h + 3, 1, 14, 'rgba(255,255,255,.8)');
    }
  });
  glass(7 * T - 22, 14 * T, true);
  glass(16 * T - 22, 23 * T, false);

  // --- outer side walls & south wall (only the cap is visible) ---
  addObj(18, 0, 14, H, H + 2, g => { R(g, 0, 0, 14, H, WALL.capLo); R(g, 1, 0, 12, H, WALL.cap); R(g, 12, 0, 1, H, WALL.capHi); });
  addObj(33 * T, 0, 16, H, H + 2, g => {
    R(g, 0, 0, 16, H, '#5b6370'); R(g, 0, 0, 2, H, WALL.capHi);
  }, (g, t, S) => { // curtain wall glass picks up the sky colour
    const day = S.day;
    g.fillStyle = day > 0.5 ? 'rgba(170,215,245,.85)' : `rgba(${40 + day * 120},${60 + day * 130},${110 + day * 120},.9)`;
    g.fillRect(33 * T + 3, 7 * T - 22, 11, 16 * T + 22);
    for (let y = 7 * T - 22; y < 23 * T; y += 2 * T) R(g, 33 * T + 2, y, 13, 2, '#5b6370');
    R(g, 33 * T + 5, 7 * T - 22, 1, 16 * T + 22, 'rgba(255,255,255,.5)');
  });
  addObj(0, 23 * T, W, 16, H + 3, g => { R(g, 0, 0, W, 16, WALL.capLo); R(g, 0, 1, W, 12, WALL.cap); R(g, 0, 1, W, 1, WALL.capHi); });
}

function clock(g, x, y, big) {
  const d = new Date(), r = big ? 9 : 7;
  peO(g, x, y, r, r, '#f6f4ef', '#2a2f38');
  const hand = (ang, len, col) => { for (let i = 0; i <= len; i++) R(g, x + Math.round(Math.sin(ang) * i), y - Math.round(Math.cos(ang) * i), 1, 1, col); };
  hand((d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, r - 4, '#2a2f38');
  hand(d.getMinutes() / 60 * Math.PI * 2, r - 2, '#2a2f38');
  hand(d.getSeconds() / 60 * Math.PI * 2, r - 2, '#c9483b');
}

function tvDashboard(g, x, y, w, h, t, S) {
  R(g, x, y, w, h, '#0f1626');
  ptext(g, 'TIMESHEET', x + 3, y + 2, '#8ab4ff');
  const c = S.counts;
  ptext(g, String(c.working), x + w - 34, y + 2, '#4fd18b'); ptext(g, String(c.break), x + w - 22, y + 2, '#f2c14e'); ptext(g, String(c.offline), x + w - 10, y + 2, '#6b7489');
  const n = S.actors.length, bw = Math.floor((w - 8) / n);
  S.actors.forEach((a, i) => {
    const col = a.status === 'working' ? '#4fd18b' : a.status === 'break' ? '#f2c14e' : '#3a4256';
    const hh = Math.min(18, 3 + a.hoursToday * 2.2 + (a.status === 'working' ? Math.sin(t * 2 + i) * 0.6 : 0));
    R(g, x + 4 + i * bw, y + h - 4 - hh, bw - 2, hh, col);
    R(g, x + 4 + i * bw, y + h - 4 - hh, bw - 2, 1, shade(col, 0.35));
  });
  R(g, x + 3, y + h - 3, w - 6, 1, '#2a3550');
  g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, y, w, h / 2);
}

/* ---------------- monitor screens ---------------- */
const SYN = ['#7fd1ff', '#c3e88d', '#ffcb6b', '#f78c6c', '#c792ea', '#89ddff'];
export function drawScreen(g, s, type, t, seed, state) {
  const { x, y, w, h } = s;
  if (state === 'off') { R(g, x, y, w, h, '#10131a'); R(g, x + 2, y + 2, 6, 1, '#1d2230'); R(g, x + w - 3, y + h - 2, 1, 1, '#d96b4a'); return; }
  if (state === 'saver') {
    R(g, x, y, w, h, '#0c1220');
    const px = x + 3 + Math.abs(((t * 6 + seed * 7) % ((w - 14) * 2)) - (w - 14)), py = y + 3 + Math.abs(((t * 4 + seed * 3) % ((h - 9) * 2)) - (h - 9));
    ptext(g, 'M&R', px | 0, py | 0, '#3d5a8f'); return;
  }
  if (type === 'code') {
    R(g, x, y, w, h, '#1b2130'); R(g, x, y, 5, h, '#151a26');
    const scroll = Math.floor(t * 1.6);
    for (let i = 0; i < (h - 2) / 3; i++) {
      const k = i + scroll + seed * 31, rr = rng(k)();
      const ind = (k * 7 % 4) * 2, len = 4 + (rr * (w - 14)) | 0;
      R(g, x + 1, y + 2 + i * 3, 2, 1, '#3b4560');
      R(g, x + 7 + ind, y + 2 + i * 3, Math.min(len, w - 9 - ind), 1, SYN[k % SYN.length]);
      if (rr > 0.6) R(g, x + 7 + ind + len + 2, y + 2 + i * 3, Math.max(0, Math.min(6, w - 11 - ind - len)), 1, SYN[(k + 2) % SYN.length]);
    }
    if ((t * 2 | 0) % 2) R(g, x + 9, y + h - 4, 2, 2, '#e9eef7');
  } else if (type === 'chart') {
    R(g, x, y, w, h, '#f3f6fa'); R(g, x, y, w, 3, '#2d4f95');
    const n = 6;
    for (let i = 0; i < n; i++) {
      const v = 0.35 + 0.55 * Math.abs(Math.sin(i * 1.7 + seed + t * 0.25));
      const bh = Math.round(v * (h - 9)); R(g, x + 3 + i * ((w - 6) / n), y + h - 2 - bh, (w - 6) / n - 2, bh, i % 2 ? '#5d8fd6' : '#f2a65a');
    }
    g.strokeStyle = '#c9483b'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i <= 8; i++) { const px = x + 2 + i * (w - 4) / 8, py = y + 6 + (h - 10) * (0.5 + 0.35 * Math.sin(i * 0.9 + t * 0.6 + seed)); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  } else if (type === 'rhino') { // beige viewport with a red curved surface
    R(g, x, y, w, h, '#c9c2a8'); R(g, x, y, w, 3, '#e8e4d6'); R(g, x, y + 3, 3, h - 3, '#dcd7c4');
    for (let xx = x + 6; xx < x + w; xx += 5) R(g, xx, y + 3, 1, h - 3, '#bdb69c');
    const ph = t * 0.5 + seed;
    for (let i = 0; i < w - 8; i++) {
      const cy = y + h / 2 + Math.sin(i * 0.22 + ph) * (h * 0.22), th = 3 + Math.round(Math.cos(i * 0.15 + ph) * 2);
      R(g, x + 5 + i, cy - th, 1, th * 2, i % 4 ? '#c8352b' : '#9e241d');
      R(g, x + 5 + i, cy - th, 1, 1, '#e86a5c');
    }
  } else if (type === 'grasshopper') { // node graph with wires
    R(g, x, y, w, h, '#d8d2b8'); R(g, x, y, w, 3, '#efe9d6');
    const nodes = [[4, 6], [4, 14], [15, 9], [24, 5], [24, 15]];
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 0.6; g.beginPath();
    for (const [a, b] of [[0, 2], [1, 2], [2, 3], [2, 4]]) {
      const [x0, y0] = nodes[a], [x1, y1] = nodes[b];
      g.moveTo(x + x0 + 6, y + y0 + 2); g.bezierCurveTo(x + x0 + 10, y + y0 + 2, x + x1 - 4, y + y1 + 2, x + x1, y + y1 + 2);
    }
    g.stroke();
    nodes.forEach(([nx, ny], k) => { R(g, x + nx, y + ny, 7, 5, '#5a5a5a'); R(g, x + nx + 1, y + ny + 1, 5, 3, k === 2 ? '#e8b33a' : '#f2efe4'); });
    if ((t * 2 + seed | 0) % 3 === 0) R(g, x + 16, y + 10, 2, 2, '#c9483b');
  } else if (type === 'cad') { // dark modelspace with a floor plan
    R(g, x, y, w, h, '#1d2733'); R(g, x, y, w, 3, '#2f3c4d');
    g.strokeStyle = '#e8b33a'; g.lineWidth = 1; g.strokeRect(x + 5.5, y + 5.5, w - 12, h - 9);
    R(g, x + 6 + ((w - 12) / 2 | 0), y + 6, 1, h - 10, '#6fb3e0'); R(g, x + 6, y + 6 + ((h - 9) / 2 | 0), w - 12, 1, '#6fb3e0');
    R(g, x + 9, y + 9, 6, 4, '#3d8a6a');
    const cx = x + 6 + ((t * 9 + seed * 5) % (w - 12)), cy = y + 6 + ((t * 5 + seed * 3) % (h - 9));
    R(g, cx - 2, cy, 5, 1, '#ffffff'); R(g, cx, cy - 2, 1, 5, '#ffffff');
  } else if (type === 'kanban') {
    R(g, x, y, w, h, '#e9edf3'); R(g, x, y, w, 3, '#6b4fa0');
    const cols = 3, cw = (w - 4) / cols;
    for (let c = 0; c < cols; c++) {
      R(g, x + 2 + c * cw, y + 5, cw - 2, h - 7, '#d6dce6');
      for (let i = 0; i < 3; i++) {
        const k = (i + c + Math.floor(t / 3 + seed)) % 4;
        if (k === 3) continue;
        R(g, x + 3 + c * cw, y + 6 + i * 5, cw - 4, 4, ['#ffe17a', '#9fe0ff', '#ff9fb3'][k]);
      }
    }
  } else { // sheet
    R(g, x, y, w, h, '#ffffff'); R(g, x, y, w, 3, '#1f7a4a');
    for (let yy = y + 4; yy < y + h; yy += 3) R(g, x, yy, w, 1, '#dfe5ec');
    for (let xx = x + 6; xx < x + w; xx += 8) R(g, xx, y + 3, 1, h - 3, '#dfe5ec');
    const r = rng(seed * 13);
    for (let i = 0; i < 10; i++) R(g, x + 7 + (r() * (w - 12) / 8 | 0) * 8, y + 5 + (r() * (h - 7) / 3 | 0) * 3, 6, 1, ['#5d8fd6', '#4fd18b', '#f2a65a'][i % 3]);
    const cur = Math.floor(t * 0.8 + seed);
    g.strokeStyle = '#1f7a4a'; g.strokeRect(x + 6.5 + (cur % 4) * 8, y + 4.5 + ((cur >> 2) % Math.max(1, (h - 6) / 3 | 0)) * 3, 8, 3);
  }
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, y, w, h / 2 | 0);
}

/* ---------------- chairs (also used by people sitting in them) ---------------- */
export function drawChair(g, s, part) { // part: 'all' | 'base' | 'back'
  const x = s.tx * T, y = s.ty * T;
  const kit = s.kind === 'kitchen', boss = s.kind === 'boss';
  const fab = kit ? '#a87347' : boss ? '#3b2a24' : '#2e3442', hi = shade(fab, 0.18), line = kit ? '#4a2f1b' : '#14171d';
  const back = () => {
    if (s.face === 'up') { // backrest towards the camera
      const by = boss ? -4 : 4, bh = boss ? 20 : 13;
      R(g, x + 6, y + by, 20, bh, line); R(g, x + 7, y + by + 1, 18, bh - 2, fab); R(g, x + 7, y + by + 1, 18, 1, hi);
      if (!kit) R(g, x + 9, y + by + 3, 14, bh - 6, shade(fab, 0.06));
      else for (let i = 0; i < 3; i++) R(g, x + 9 + i * 5, y + by + 3, 3, bh - 6, shade(fab, -0.12));
    } else {
      const by = boss ? -18 : -10, bh = boss ? 26 : 20;
      R(g, x + 6, y + by, 20, bh, line); R(g, x + 7, y + by + 1, 18, bh - 2, shade(fab, -0.1)); R(g, x + 7, y + by + 1, 18, 2, hi);
      if (kit) for (let i = 0; i < 3; i++) R(g, x + 9 + i * 5, y + by + 4, 3, bh - 7, shade(fab, -0.22));
    }
  };
  const base = () => {
    g.fillStyle = 'rgba(8,12,24,.22)'; g.beginPath(); g.ellipse(x + 16, y + 27, 12, 4, 0, 0, Math.PI * 2); g.fill();
    if (kit) { R(g, x + 8, y + 18, 2, 10, line); R(g, x + 22, y + 18, 2, 10, line); }
    else {
      R(g, x + 15, y + 18, 2, 7, '#5a606b');
      R(g, x + 7, y + 25, 18, 2, '#22252c'); R(g, x + 6, y + 27, 3, 2, '#111'); R(g, x + 23, y + 27, 3, 2, '#111'); R(g, x + 14, y + 28, 4, 2, '#111');
    }
    const sy = s.face === 'up' ? 10 : 12;
    R(g, x + 6, y + sy, 20, 9, line); R(g, x + 7, y + sy + 1, 18, 7, fab); R(g, x + 7, y + sy + 1, 18, 2, hi);
  };
  if (part === 'base') { if (s.face === 'down') back(); base(); }
  else if (part === 'back') { if (s.face === 'up') back(); }
  else { if (s.face === 'down') { back(); base(); } else { base(); back(); } }
}

/* ---------------- desks ---------------- */
function buildDesk(d, i) {
  const ox = d.tx * T, oy = d.ty * T - 30, r = rng(100 + i);
  const boss = d.kind === 'boss', C = boss ? WALNUT : DESK, L = 30; // L: local y of the desk footprint top
  const o = addObj(ox, oy, 160, 64 + 30, (d.ty + 2) * T, g => {
    shadow(g, 4, L + 52, 154, 12, 0.25);
    if (boss) { R(g, 6, L + 50, 4, 12, '#30343c'); R(g, 150, L + 50, 4, 12, '#30343c'); }
    else for (const lx of [5, 149]) { // black O-frame legs
      R(g, lx, L + 46, 6, 16, '#15171c'); R(g, lx + 1, L + 46, 4, 14, '#2a2d34'); R(g, lx + 2, L + 49, 2, 9, '#15171c');
      R(g, lx - 2, L + 60, 10, 2, '#15171c');
    }
    if (d.id.startsWith('mb')) { // wooden divider between back-to-back desks, like the office
      R(g, 0, L - 20, 160, 24, '#4a2f1b'); R(g, 1, L - 19, 158, 22, '#9a6a43'); R(g, 1, L - 19, 158, 2, '#b98557');
      for (let k = 0; k < 10; k++) R(g, 4 + r() * 140, L - 15 + r() * 14, 12 + r() * 18, 1, '#8a5d3a');
    }
    if (boss) block(g, 2, L + 2, 156, 38, 14, C);
    else {
      block(g, 2, L + 2, 156, 40, 6, C);
      R(g, 4, L + 48, 152, 3, '#15171c'); // metal rail under the top
      for (let k = 0; k < 14; k++) R(g, 6 + r() * 140, L + 6 + r() * 32, 10 + r() * 22, 1, shade(C.top, -0.06));
    }
    if (boss) { for (let k = 0; k < 8; k++) R(g, 6 + r() * 140, L + 6 + r() * 30, 10 + r() * 20, 1, shade(C.top, -0.08)); R(g, 70, L + 43, 20, 6, '#c9a650'); R(g, 71, L + 44, 18, 4, '#e4c46e'); }
    const mug = (mx, my, col) => { R(g, mx, my, 7, 8, OUT); R(g, mx + 1, my + 1, 5, 6, col); R(g, mx + 1, my + 1, 5, 1, '#3b2414'); R(g, mx + 6, my + 3, 2, 3, OUT); };
    const papers = (px, py) => { R(g, px + 1, py + 1, 16, 12, 'rgba(0,0,0,.15)'); R(g, px, py, 16, 12, '#c9ced6'); R(g, px + 1, py, 15, 11, '#fbfbf8'); for (let k = 0; k < 4; k++) R(g, px + 3, py + 2 + k * 2, 8 + (k % 2) * 3, 1, '#9aa3ad'); };
    const succ = (px, py) => { R(g, px, py + 5, 8, 6, '#b5643c'); R(g, px, py + 5, 8, 1, '#d9875e'); pe(g, px + 4, py + 3, 4, 3, LEAF[2]); pe(g, px + 3, py + 2, 2, 2, LEAF[3]); R(g, px + 5, py, 1, 3, LEAF[4]); };
    const phone = (px, py) => { R(g, px, py, 6, 10, OUT); R(g, px + 1, py + 1, 4, 8, '#2b3a55'); };
    const bottle = (px, py) => { R(g, px, py, 6, 14, OUT); R(g, px + 1, py + 1, 4, 12, '#b8c0ca'); R(g, px + 1, py + 1, 1, 12, '#e6eaee'); R(g, px + 1, py, 4, 2, '#5d6470'); };
    const headset = (px, py) => { pe(g, px + 6, py + 4, 6, 4, OUT); pe(g, px + 6, py + 4, 5, 3, '#c9483b'); pe(g, px + 6, py + 5, 3, 2, DESK.top); R(g, px, py + 4, 3, 5, '#22252c'); R(g, px + 9, py + 4, 3, 5, '#22252c'); };
    const mugCol = ['#e0582b', '#e9e4da', '#d9452b', '#2a2f38'][i % 4];
    if (d.face === 'up') {
      for (const mx of [40, 82]) { // dual monitors facing the camera
        R(g, mx + 15, L + 4, 6, 8, '#3c414b'); R(g, mx + 9, L + 11, 18, 3, '#2a2e36');
        R(g, mx, L - 20, 38, 26, '#14161b'); R(g, mx + 1, L - 19, 36, 24, '#262a32'); R(g, mx + 1, L + 4, 36, 1, '#3a3f49');
        d.screens.push({ x: ox + mx + 2, y: oy + L - 18, w: 34, h: 21 });
      }
      R(g, 59, L + 23, 42, 8, OUT); R(g, 60, L + 24, 40, 6, '#2c3038');
      for (let k = 0; k < 9; k++) for (let j = 0; j < 2; j++) R(g, 61 + k * 4, L + 25 + j * 2, 3, 1, '#4c5260');
      R(g, 106, L + 24, 12, 9, '#3a4150'); R(g, 109, L + 25, 5, 6, '#e1e4e8');
      mug(18 + r() * 8, L + 14, mugCol); papers(124, L + 18 + r() * 6); bottle(30, L + 2);
      if (r() < 0.5) succ(146, L + 4); else headset(140, L + 6);
      if (r() < 0.5) phone(28, L + 26);
    } else {
      if (boss) { // big monitor back + lamp
        R(g, 100, L - 22, 44, 30, '#cfd4db'); R(g, 101, L - 21, 42, 28, '#e7eaee'); R(g, 119, L + 7, 6, 6, '#b8bec6');
        R(g, 18, L - 12, 2, 20, '#2a2a2a'); R(g, 12, L - 16, 14, 6, '#2d4f95'); R(g, 12, L - 16, 14, 1, '#5d8fd6');
      } else { // dual monitor backs on a clamp arm; the person's head shows above them
        R(g, 76, L + 2, 8, 6, '#15171c'); R(g, 78, L - 4, 4, 8, '#2a2d34');
        for (const mx of [42, 82]) {
          R(g, mx, L - 16, 36, 22, '#0f1115'); R(g, mx + 1, L - 15, 34, 20, '#262930'); R(g, mx + 1, L - 15, 34, 1, '#3a3e47');
          R(g, mx + 13, L - 9, 10, 8, '#1d2026'); R(g, mx + 14, L - 8, 8, 1, '#30343c');
        }
        R(g, 62, L + 26, 36, 6, OUT); R(g, 63, L + 27, 34, 4, '#2c3038'); // keyboard peeking out
      }
      papers(18, L + 22); mug(128 + r() * 10, L + 22, mugCol); bottle(10, L + 6);
      if (!boss && r() < 0.5) headset(140, L + 4); else succ(146, L + 4);
      if (r() < 0.6) phone(44, L + 26);
    }
  });
  o.desk = d;
  d.glow = d.face === 'up' ? { x: ox + 80, y: oy + L - 8 } : { x: ox + 80, y: oy + L - 16 };
}

/* ---------------- props ---------------- */
function plant(g, v, bx, by) { // bx,by: bottom-centre of the pot
  shadow(g, bx - 11, by - 5, 22, 8, 0.25);
  if (v === 1) { // snake plant, dark pot
    R(g, bx - 7, by - 14, 14, 13, OUT); R(g, bx - 6, by - 13, 12, 12, '#4a4f59'); R(g, bx - 6, by - 13, 3, 12, '#5d636e'); R(g, bx - 6, by - 13, 12, 2, '#2b2f36');
    const blades = [[-5, 26, -1], [-2, 34, 0], [1, 30, 1], [4, 24, 1], [-1, 20, -1], [3, 36, 0]];
    for (const [dx, hgt, lean] of blades) for (let k = 0; k < hgt; k++) {
      const x = bx + dx + Math.round(lean * k / 10), w = k > hgt - 4 ? 1 : 3;
      R(g, x - 1, by - 13 - k, w + 1, 1, OUT); R(g, x, by - 13 - k, w - 1 || 1, 1, k % 6 < 3 ? LEAF[2] : LEAF[1]); if (w === 3) R(g, x + 1, by - 13 - k, 1, 1, '#c9c76a');
    }
  } else if (v === 2) { // monstera bush, terracotta pot
    g.fillStyle = OUT; g.beginPath(); g.moveTo(bx - 9, by - 15); g.lineTo(bx + 9, by - 15); g.lineTo(bx + 7, by); g.lineTo(bx - 7, by); g.fill();
    g.fillStyle = '#b5643c'; g.beginPath(); g.moveTo(bx - 8, by - 14); g.lineTo(bx + 8, by - 14); g.lineTo(bx + 6, by - 1); g.lineTo(bx - 6, by - 1); g.fill();
    R(g, bx - 9, by - 16, 18, 3, '#d9875e'); R(g, bx - 9, by - 16, 18, 1, '#e9a27a');
    const leaves = [[0, -30, 12, 9, 1], [-8, -24, 8, 6, 2], [8, -25, 8, 6, 2], [-4, -38, 7, 6, 3], [6, -36, 7, 5, 3], [0, -22, 7, 5, 3], [-10, -32, 6, 5, 2], [10, -31, 6, 5, 1]];
    for (const [dx, dy, rx, ry, c] of leaves) { peO(g, bx + dx, by + dy, rx, ry, LEAF[c], LEAF[0]); R(g, bx + dx - rx + 3, by + dy - 1, rx, 1, LEAF[c + 1] || LEAF[4]); R(g, bx + dx, by + dy, 1, ry, LEAF[0]); }
  } else { // fiddle leaf, white pot
    R(g, bx - 8, by - 16, 16, 15, OUT); R(g, bx - 7, by - 15, 14, 14, '#ecebe6'); R(g, bx + 3, by - 15, 4, 14, '#cfcdc6'); R(g, bx - 7, by - 15, 14, 2, '#3b2a20');
    R(g, bx, by - 44, 1, 30, '#5a4330');
    const leaves = [[-5, -20], [5, -25], [-5, -30], [5, -35], [-3, -41], [3, -46]];
    leaves.forEach(([dx, dy], k) => { peO(g, bx + dx, by + dy, 5, 3, LEAF[k % 2 ? 2 : 3], LEAF[0]); R(g, bx + dx - 2, by + dy - 1, 3, 1, LEAF[4]); });
  }
}

function buildProp(p) {
  const x = p.tx * T, y = p.ty * T, w = p.w * T, h = p.h * T, sortY = (p.ty + p.h) * T;
  switch (p.kind) {
    case 'plant': addObj(x, y - 40, T, T + 40, sortY, g => plant(g, p.v, 16, 40 + 28)); break;
    case 'counter': addObj(x, y - 40, w, T + 40, sortY, g => {
      block(g, 0, 40, w, 16, 16, STONE);
      for (let i = 0; i < p.w; i++) { R(g, i * T, 57, 1, 14, '#c9c6bf'); R(g, i * T + (i % 2 ? 4 : T - 6), 61, 2, 5, '#8a8f97'); }
      R(g, 0, 69, w, 3, '#3c424c');
      const r = rng(3); for (let k = 0; k < 60; k++) R(g, r() * w, 42 + r() * 12, 1, 1, '#c3c8ce');
      // coffee machine (tile 10)
      R(g, 36, 14, 24, 34, OUT); R(g, 37, 15, 22, 32, '#2a2d34'); R(g, 37, 15, 22, 4, '#4a4f59'); R(g, 41, 22, 14, 6, '#15171b'); R(g, 43, 30, 10, 3, '#3a3f48');
      R(g, 44, 38, 8, 7, '#e9e4da'); R(g, 45, 39, 6, 1, '#6b3e22'); R(g, 37, 45, 22, 2, '#4a4f59');
      // sink (tile 12)
      R(g, 70, 44, 22, 9, '#7f8a96'); R(g, 71, 45, 20, 7, '#a9b3be'); R(g, 80, 32, 2, 12, '#b8c0ca'); R(g, 80, 32, 7, 2, '#b8c0ca');
      // fruit bowl (tile 14)
      pe(g, 144, 48, 9, 3, '#e9e4da'); pe(g, 140, 45, 3, 3, '#e8b33a'); pe(g, 146, 44, 3, 3, '#c9483b'); pe(g, 150, 46, 3, 2, '#7cc46a');
      // kettle (tile 15)
      R(g, 166, 34, 12, 14, OUT); R(g, 167, 35, 10, 12, '#d9dde2'); R(g, 167, 35, 10, 2, '#2a2d34'); R(g, 177, 38, 3, 6, OUT);
      // microwave (tiles 16-17)
      R(g, 200, 26, 44, 24, OUT); R(g, 201, 27, 42, 22, '#e1e4e8'); R(g, 204, 30, 28, 16, '#1b1f27'); R(g, 205, 31, 10, 2, '#3a4150'); R(g, 235, 31, 5, 2, '#4fd18b'); R(g, 235, 36, 5, 8, '#b8bec6');
      // herbs (tile 18)
      for (const hx of [292, 304]) { R(g, hx, 40, 9, 8, '#b5643c'); pe(g, hx + 4, 37, 5, 4, LEAF[3]); pe(g, hx + 3, 35, 2, 2, LEAF[4]); }
    }, (g, t, S) => { R(g, x + 39, y - 40 + 17, 2, 1, (t * 2 | 0) % 2 || !S.brewing ? '#4fd18b' : '#ff5a4a'); });
      LIGHTS.push({ x: x + 5 * T, y: y + 4, r: 120, col: '255,214,140', a: 0.5, when: 'present' }); break;
    case 'fridge': addObj(x, y - 46, w, T + 46, sortY, g => {
      shadow(g, 2, 66, 60, 10);
      R(g, 4, 0, 56, 74, OUT); R(g, 5, 1, 54, 72, '#cdd3da'); R(g, 5, 1, 54, 2, '#eef1f4'); R(g, 45, 1, 14, 72, '#b5bcc5');
      R(g, 5, 24, 54, 1, '#8a929c'); R(g, 50, 8, 2, 12, '#7d858f'); R(g, 50, 30, 2, 24, '#7d858f'); R(g, 5, 70, 54, 3, '#4a5058');
      R(g, 14, 32, 8, 10, '#ffe17a'); R(g, 26, 36, 7, 7, '#ff9fb3'); pe(g, 18, 12, 2, 2, '#c9483b'); pe(g, 30, 14, 2, 2, '#3f6fb5');
    }); break;
    case 'vending': addObj(x, y - 46, w, T + 46, sortY, g => {
      shadow(g, 2, 66, 60, 10);
      R(g, 4, 0, 56, 74, OUT); R(g, 5, 1, 54, 72, '#2b3242'); R(g, 5, 1, 54, 8, '#c9483b'); ptext(g, 'SNACKS', 9, 3, '#ffffff');
      R(g, 9, 12, 32, 46, '#0e1420');
      const cols = ['#e8b33a', '#c9483b', '#3f6fb5', '#7cc46a', '#c792ea', '#f78c6c'];
      for (let rr = 0; rr < 5; rr++) { R(g, 9, 20 + rr * 9, 32, 1, '#4a5263'); for (let c = 0; c < 5; c++) R(g, 11 + c * 6, 14 + rr * 9, 4, 6, cols[(rr * 2 + c) % 6]); }
      R(g, 45, 14, 10, 14, '#11161f'); for (let k = 0; k < 9; k++) R(g, 46 + (k % 3) * 3, 16 + (k / 3 | 0) * 4, 2, 2, '#8a93a5');
      R(g, 9, 61, 32, 7, '#11161f'); R(g, 45, 34, 10, 4, '#e8b33a');
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(12, 12, 4, 46);
    }); LIGHTS.push({ x: x + 32, y: y + 12, r: 70, col: '160,200,255', a: 0.6, when: 'always' }); break;
    case 'kitTable': addObj(x, y - 6, w, T + 6, sortY, g => {
      shadow(g, 4, 22, w - 8, 12, 0.25);
      R(g, 6, 22, 3, 14, OAK.line); R(g, w - 9, 22, 3, 14, OAK.line);
      block(g, 2, 4, w - 4, 18, 8, OAK);
      R(g, 34, 9, 6, 6, '#ffffff'); R(g, 35, 10, 4, 1, '#6b3e22'); pe(g, 78, 13, 7, 3, '#f2efe8'); pe(g, 78, 12, 3, 1, '#e07a5f');
      R(g, 116, 8, 8, 7, '#c9ced6'); R(g, 117, 6, 6, 3, '#ffffff'); R(g, 120, 10, 6, 6, '#e9e4da');
    }); LIGHTS.push({ x: x + w / 2, y: y + 8, r: 110, col: '255,214,140', a: 0.55, when: 'present' }); break;
    case 'cooler': addObj(x, y - 46, T, T + 46, sortY, g => {
      shadow(g, 4, 68, 24, 8);
      R(g, 8, 2, 16, 22, '#2a5f8f'); R(g, 9, 3, 14, 20, 'rgba(120,190,240,.9)'); R(g, 11, 4, 2, 16, 'rgba(255,255,255,.6)'); R(g, 12, 0, 8, 3, '#2a5f8f');
      R(g, 6, 24, 20, 48, OUT); R(g, 7, 25, 18, 46, '#eef1f4'); R(g, 20, 25, 5, 46, '#d3d8de'); R(g, 10, 34, 3, 3, '#3f6fb5'); R(g, 17, 34, 3, 3, '#c9483b'); R(g, 9, 40, 12, 2, '#b8c0ca');
    }); break;
    case 'coatRack': addObj(x, y - 40, T, T + 40, sortY, g => {
      shadow(g, 6, 64, 20, 6); R(g, 15, 4, 2, 62, '#3a2616'); R(g, 10, 66, 12, 2, '#3a2616');
      R(g, 8, 8, 8, 22, '#2d4f95'); R(g, 9, 9, 6, 20, '#3f6fb5'); R(g, 17, 10, 7, 18, '#5a4330'); R(g, 18, 11, 5, 16, '#7a5c40'); pe(g, 16, 4, 5, 2, '#3a2616');
    }); break;
    case 'bench': addObj(x, y - 6, w, T + 6, sortY, g => {
      shadow(g, 4, 24, w - 8, 8); R(g, 6, 18, 3, 12, '#2a2e36'); R(g, w - 9, 18, 3, 12, '#2a2e36');
      block(g, 2, 8, w - 4, 10, 6, OAK); for (let i = 8; i < w - 6; i += 8) R(g, i, 9, 1, 9, OAK.frontLo);
    }); break;
    case 'stall': addObj(x, y - 30, w, h + 30, sortY, g => {
      R(g, 0, 0, w, h + 26, '#5f6b78'); R(g, 1, 1, w - 2, h + 24, '#b9c6d2'); R(g, 1, 1, w - 2, 2, '#dfe7ee');
      R(g, 6, 24, w - 12, h, '#4f5b68'); R(g, 7, 25, w - 14, h - 2, '#9fb0c0'); R(g, 7, 25, w - 14, 1, '#c9d6e2');
      R(g, w - 16, 25 + h / 2, 4, 6, '#2a2f38'); R(g, w - 15, 26 + h / 2, 2, 2, '#4fd18b');
      R(g, 0, h + 26, w, 4, 'rgba(0,0,0,.2)');
    }); break;
    case 'sinks': addObj(x, y - 18, w, T + 18, sortY, g => {
      block(g, 0, 18, w, 16, 14, STONE); R(g, 0, 47, w, 3, '#3c424c');
      for (const sx of [10, 42]) { pe(g, sx + 6, 26, 7, 4, '#8f9aa6'); pe(g, sx + 6, 26, 6, 3, '#c6d0da'); R(g, sx + 5, 12, 2, 10, '#b8c0ca'); R(g, sx + 5, 12, 5, 2, '#b8c0ca'); }
    }); break;
    case 'sofa': addObj(x, y - 22, w, T + 22, sortY, g => {
      const L = '#1f2f3a', B = '#3c5a6b', Hh = '#52758a';
      shadow(g, 2, 42, w - 4, 12);
      R(g, 6, 0, w - 12, 24, L); R(g, 7, 1, w - 14, 22, B); R(g, 7, 1, w - 14, 2, Hh); R(g, w / 2, 3, 1, 18, L);
      R(g, 6, 22, w - 12, 18, L); R(g, 7, 23, w - 14, 10, Hh); R(g, 7, 33, w - 14, 6, shade(B, -0.15)); R(g, w / 2, 23, 1, 10, L);
      for (const ax of [0, w - 12]) { R(g, ax, 8, 12, 38, L); R(g, ax + 1, 9, 10, 36, B); R(g, ax + 1, 9, 10, 2, Hh); }
      R(g, 22, 8, 16, 12, '#e8b33a'); R(g, 23, 9, 14, 10, '#f2c14e');
    }); break;
    case 'coffeeTable': addObj(x, y - 4, w, T + 4, sortY, g => {
      shadow(g, 4, 22, w - 8, 8); R(g, 8, 16, 2, 10, '#2a2e36'); R(g, w - 10, 16, 2, 10, '#2a2e36');
      R(g, 4, 6, w - 8, 12, '#5d6c7a'); R(g, 5, 7, w - 10, 10, 'rgba(170,205,225,.95)'); R(g, 7, 8, 10, 1, '#ffffff');
      R(g, 30, 9, 14, 6, '#c9483b'); R(g, 31, 10, 12, 4, '#f2efe8'); R(g, 14, 9, 6, 6, '#e9e4da');
    }); break;
    case 'lamp': addObj(x, y - 48, T, T + 48, sortY, g => {
      shadow(g, 8, 70, 16, 6); R(g, 15, 14, 2, 56, '#2a2a2a'); R(g, 10, 70, 12, 2, '#2a2a2a');
      g.fillStyle = OUT; g.beginPath(); g.moveTo(8, 16); g.lineTo(24, 16); g.lineTo(20, 2); g.lineTo(12, 2); g.fill();
      g.fillStyle = '#f2e3c2'; g.beginPath(); g.moveTo(9, 15); g.lineTo(23, 15); g.lineTo(19, 3); g.lineTo(13, 3); g.fill();
    }); LIGHTS.push({ x: x + 16, y: y - 20, r: 110, col: '255,200,130', a: 0.75, when: 'always' }); break;
    case 'printer': addObj(x, y - 22, T, T + 22, sortY, g => {
      shadow(g, 2, 44, 28, 8);
      R(g, 2, 8, 28, 40, OUT); R(g, 3, 9, 26, 38, '#e3e6ea'); R(g, 3, 9, 26, 10, '#c9ced6'); R(g, 6, 4, 20, 6, '#f8f8f5'); R(g, 6, 12, 20, 4, '#2a2e36');
      R(g, 20, 22, 7, 4, '#1b2130'); R(g, 5, 30, 22, 1, '#aab2bd'); R(g, 5, 38, 22, 1, '#aab2bd');
    }, (g, t) => R(g, x + 22, y - 22 + 23, 2, 2, (t * 1.5 | 0) % 2 ? '#4fd18b' : '#1b2130')); break;
    case 'cabinet': addObj(x, y - 24, T, T + 24, sortY, g => {
      shadow(g, 2, 48, 28, 8);
      R(g, 3, 0, 26, 54, OUT); R(g, 4, 1, 24, 52, '#9aa3ae'); R(g, 4, 1, 24, 2, '#c3cad3');
      for (let k = 0; k < 3; k++) { R(g, 5, 6 + k * 16, 22, 14, '#b3bbc5'); R(g, 5, 6 + k * 16, 22, 1, '#d4dae1'); R(g, 12, 11 + k * 16, 8, 2, '#5d6470'); R(g, 13, 8 + k * 16, 6, 2, '#f4f4ef'); }
    }); break;
    case 'tv': { // TV on a media console; the YouTube player is laid over TV.screen (see tv.js)
      const ox = x, oy = y - 30;
      TV.screen = { x: ox + 5, y: oy + 13, w: 54, h: 31 };
      TV.box = { x: ox, y: oy + 8, w: 64, h: 80 };
      addObj(ox, oy, w, h + 30, sortY, g => {
        shadow(g, 3, 78, 58, 10);
        R(g, 8, 79, 3, 5, WALNUT.line); R(g, 53, 79, 3, 5, WALNUT.line);
        block(g, 4, 55, 56, 9, 15, WALNUT);
        R(g, 32, 65, 1, 13, WALNUT.line); R(g, 27, 70, 3, 1, '#c9a46a'); R(g, 35, 70, 3, 1, '#c9a46a');
        R(g, 28, 49, 8, 6, OUT); R(g, 29, 49, 6, 5, '#3a3f48'); R(g, 20, 55, 24, 2, '#22262e');
        R(g, 2, 10, 60, 40, OUT); R(g, 3, 11, 58, 38, '#1d2129'); R(g, 3, 11, 58, 1, '#3a404c');
        R(g, 5, 13, 54, 31, '#07090d'); R(g, 29, 46, 6, 1, '#3a404c');
      }, (g, t, S) => {
        const s = TV.screen;
        if (S.tv.on) { // shown under the player while it loads, and when the player is off screen
          R(g, s.x, s.y, s.w, s.h, '#0b0f18');
          if (S.tv.thumb) g.drawImage(S.tv.thumb, s.x, s.y, s.w, s.h);
          R(g, s.x, s.y + s.h - 2, s.w, 2, 'rgba(0,0,0,.6)'); R(g, s.x, s.y + s.h - 2, Math.round(s.w * S.tv.progress), 2, '#ff3b30');
        }
        R(g, ox + 55, oy + 46, 2, 1, S.tv.on ? '#4fd18b' : (t * 0.8 | 0) % 2 ? '#d96b4a' : '#5a2a20');
      });
      LIGHTS.push({ x: x + T, y: y - 2, r: 90, col: '170,200,255', a: 0.6, when: 'tv' }); break;
    }
    case 'bin': addObj(x, y - 4, T, T + 4, sortY, g => {
      shadow(g, 8, 26, 16, 6); R(g, 9, 12, 14, 16, OUT); R(g, 10, 13, 12, 14, '#5d6470'); R(g, 10, 13, 12, 2, '#3a3f48'); R(g, 13, 10, 4, 4, '#f4f4ef');
    }); break;
  }
}

/* ---------------- lights for the night overlay ---------------- */
function buildLights() {
  for (const [x, y] of [[16.5, 10.5], [22.5, 10.5], [28.5, 10.5], [16.5, 17.5], [22.5, 17.5], [28.5, 17.5], [12, 10], [12, 18], [5, 11], [5, 19.5], [4, 3.5], [29, 3.5], [21, 4]])
    LIGHTS.push({ x: x * T, y: y * T, r: 150, col: '255,236,200', a: 0.85, when: 'present' });
  for (const d of DESKS) LIGHTS.push({ x: d.glow.x, y: d.glow.y, r: 64, col: '150,200,255', a: 0.7, when: 'desk', desk: d });
}

export function buildWorldArt() {
  buildWalls();
  DESKS.forEach(buildDesk);
  PROPS.forEach(buildProp);
  for (const s of SEATS) {
    const o = addObj(s.tx * T, s.ty * T - 20, T, T + 20, s.sortY, () => { }, null);
    o.draw = (ctx, t, S) => { if (!S.seatTaken(s)) drawChair(ctx, s, 'all'); };
  }
  buildLights();
  return { floor: buildFloor(), shafts: buildShafts() };
}

// Under the Smart Fit: the Resenha living room (hub) and, through its "RESENHA" door, a procedurally generated
// dungeon in the spirit of Yakuza 7's underground and Persona's floors: wet concrete rooms and corridors, pipes,
// barrels and dim lamps. Each floor starts by the exit back to the room; find the staircase down to go deeper.
// HUD: a minimap (explored tiles, you as an arrow, the stairs once seen) and a status card (face, HP, MP, level).
import { T, rng, findPath } from './world.js';
import { cv, R, pe, peO, shadow, shade, ptext, ptextW, OUT, LEAF } from './art.js';
import { CW, FOOT, SPR, frame, portrait, loadStill, tinted } from './sprites.js';
import { loadHero, xpToNext } from './rpg.js';
import * as Battle from './battle.js';
import { drawWeapon } from './weapons.js';
import * as Ui from './wardrobe.js';
import * as Music from './music.js';

const WALK = 74, RUN = 146;
const NPC_ID = 'resenha_host'; // drawn from the reference picture (tools/extract_still.py)
let hostLoading = null;
const DUN_W = 44, DUN_H = 34;

/* ---------------- shared helpers ---------------- */
const grid = (w, h, v) => Array.from({ length: h }, () => Array(w).fill(v));
function blockedIn(solid, x, y) {
  for (const [px, py] of [[x - 7, y - 7], [x + 6, y - 7], [x - 7, y - 1], [x + 6, y - 1]]) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (ty < 0 || ty >= solid.length || tx < 0 || tx >= solid[0].length || solid[ty][tx]) return true;
  }
  return false;
}
const center = (g, s, cx, y, col, sc = 1) => ptext(g, s, Math.round(cx - ptextW(s, sc) / 2), y, col, sc);

/* ---------------- the Resenha living room ---------------- */
const HUB_W = 18, HUB_H = 12;
const HUB_DOOR = { x0: 8 * T, x1: 10 * T };          // back wall, cols 8-9
const HUB_STAIRS = { tx: 1, ty0: 5, ty1: 6 };          // left wall, up to the Smart Fit
const HUB_NPC = { tx: 13, ty: 3 };                  // the host, behind the bar counter
const HUB_BENCHES = [11, 14];                       // wooden benches in front of the bar (2 tiles each, row 5)
const HUB_WARDROBE = { tx: 1, ty: 9 };              // bottom left, 2 tiles wide (rows 8-9); you stand in front of it
const HUB_RING = { x0: 10, x1: 15, y0: 7, y1: 10 }; // sparring mat
const HOST_SPOT = { x: 13.5 * T, y: 5 * T + 22 }, WARD_SPOT = { x: 2 * T, y: 10 * T + 22 };
const overHost = (x, y) => Math.abs(x - HOST_SPOT.x) < 16 && y > 4 * T - 62 && y < 4 * T + 6;
const overWardrobe = (x, y) => x > HUB_WARDROBE.tx * T && x < (HUB_WARDROBE.tx + 2) * T && y > 10 * T - 96 && y < 10 * T;
const HUB_SPEAKER = { tx: 7, ty: 2 };               // bluetooth speaker on a side table: click it to change the music

// plush emerald velvet, so the sofas stand out from the wood and the red rug
const VD = '#0b2422', VB = '#1d5750', VL = '#2a7468', VH = '#4fa292', VS = '#123a36';
function rr(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function cushion(g, x, y, w, h, r = 4) { // rounded puffy cushion: outline, body, top light, soft bottom shade
  rr(g, x, y, w, h, r + 1, VD); rr(g, x + 1, y + 1, w - 2, h - 2, r, VL); rr(g, x + 2, y + 2, w - 4, Math.max(2, h * 0.35), r, VH); R(g, x + 3, y + h - 4, w - 6, 2, VB);
}
function pillow(g, x, y, c, w = 14, h = 12) {
  rr(g, x, y, w, h, 4, OUT); rr(g, x + 1, y + 1, w - 2, h - 2, 3, c); rr(g, x + 2, y + 2, w - 5, 3, 2, shade(c, 0.3)); R(g, x + w / 2 - 1, y + h / 2, 2, 2, shade(c, -0.3));
}
function legs(g, xs, y, h = 5) { for (const x of xs) { R(g, x, y, 3, h, '#2a1a10'); R(g, x, y, 1, h, '#6b4024'); R(g, x, y + h - 1, 3, 1, '#c9a26e'); } }
function sofaBack(g, w) { // w x 46, seen from behind (it faces the coffee table): a rounded backrest towards the camera
  shadow(g, 2, 37, w - 4, 11, 0.4);
  pillow(g, 13, 2, '#e0b25a'); pillow(g, w - 29, 3, '#e87a5d'); pillow(g, w / 2 - 6, 4, '#f2efe8', 12, 10);
  rr(g, 0, 9, w, 32, 9, VD); rr(g, 1, 10, w - 2, 30, 8, VB);
  rr(g, 4, 11, w - 8, 9, 6, VL); rr(g, 6, 12, w - 12, 3, 3, VH); // the rolled top of the backrest
  for (let k = 0; k < 6; k++) for (let j = 0; j < 2; j++) { const x = Math.round(12 + (w - 24) * (k + (j ? 0.5 : 0)) / 5.5), y = 24 + j * 7; if (x < w - 10) { R(g, x, y, 2, 2, VS); R(g, x - 3, y + 1, 2, 1, VS); R(g, x + 3, y + 1, 2, 1, VS); } } // button tufting
  for (const ax of [0, w - 11]) { rr(g, ax, 7, 11, 33, 5, VD); rr(g, ax + 1, 8, 9, 31, 4, VL); rr(g, ax + 2, 9, 7, 5, 3, VH); }
  R(g, 4, 37, w - 8, 3, VS);
  legs(g, [6, w - 9], 39, 6);
}
function sofaSide(g) { // 32x72, two tiles long, facing right (towards the coffee table)
  shadow(g, 1, 61, 31, 11, 0.4);
  rr(g, 0, 5, 13, 62, 6, VD); rr(g, 1, 6, 11, 60, 5, VB); rr(g, 2, 7, 5, 58, 3, VL); R(g, 3, 8, 2, 56, VH); // backrest seen from above
  cushion(g, 10, 14, 21, 22, 5); cushion(g, 10, 36, 21, 22, 5);
  pillow(g, 9, 17, '#e87a5d', 8, 15);
  // a mustard throw over the far cushion, with a fringe
  rr(g, 13, 39, 18, 15, 3, '#b8862a'); rr(g, 13, 39, 18, 13, 3, '#e0b25a'); R(g, 15, 41, 14, 2, '#f2cf7a'); for (let x = 14; x < 31; x += 2) R(g, x, 54, 1, 2, '#e0b25a');
  for (const ay of [2, 56]) { rr(g, 0, ay, 32, 13, 6, VD); rr(g, 1, ay + 1, 30, 11, 5, VB); rr(g, 2, ay + 2, 28, 5, 3, VL); R(g, 4, ay + 3, 24, 1, VH); }
  R(g, 2, 65, 28, 3, VS);
  legs(g, [3, 26], 68, 4);
}
function armchair(g) { // 32x48 facing left
  shadow(g, 2, 37, 28, 11, 0.4);
  rr(g, 18, 3, 14, 37, 6, VD); rr(g, 19, 4, 12, 35, 5, VB); rr(g, 22, 5, 6, 33, 3, VL); R(g, 24, 6, 2, 31, VH);
  cushion(g, 3, 14, 19, 20, 5);
  pillow(g, 14, 15, '#e0b25a', 8, 13);
  for (const ay of [7, 30]) { rr(g, 1, ay, 30, 10, 5, VD); rr(g, 2, ay + 1, 28, 8, 4, VB); rr(g, 3, ay + 2, 26, 3, 2, VL); }
  R(g, 3, 38, 26, 2, VS); legs(g, [4, 25], 40, 5);
}
function speaker(g) { // 32x56: side table with a bluetooth speaker on top
  shadow(g, 3, 48, 26, 8, 0.3);
  R(g, 4, 34, 24, 8, OUT); R(g, 5, 35, 22, 6, '#4a3324'); R(g, 5, 35, 22, 1, '#6b4a33'); R(g, 7, 41, 2, 13, '#2a1e18'); R(g, 23, 41, 2, 13, '#2a1e18');
  R(g, 7, 12, 18, 24, OUT); R(g, 8, 13, 16, 22, '#1d1f24'); R(g, 8, 13, 16, 2, '#3a3d45');
  R(g, 9, 17, 14, 14, '#c9483b'); for (let y = 18; y < 31; y += 2) for (let x = 10; x < 23; x += 2) R(g, x, y, 1, 1, '#8e2a2a');
  R(g, 14, 32, 4, 1, '#e9eef7');
}
function plantPot(g) { // 32x56
  shadow(g, 6, 48, 20, 8, 0.25);
  R(g, 9, 38, 14, 14, OUT); R(g, 10, 39, 12, 12, '#2a2c33'); R(g, 10, 39, 12, 2, '#3a3d45');
  for (const [dx, dy, rx, ry, c] of [[0, 26, 10, 8, 1], [-6, 18, 6, 5, 2], [6, 16, 6, 5, 2], [0, 10, 5, 5, 3], [-8, 28, 5, 4, 3], [8, 28, 5, 4, 1]]) peO(g, 16 + dx, dy, rx, ry, LEAF[c], LEAF[0]);
}
function floorLamp(g) { // 32x80: the bulb sits inside the shade, which glows from within
  shadow(g, 8, 72, 16, 6, 0.3);
  R(g, 15, 22, 2, 52, '#2a2a2a'); R(g, 10, 74, 12, 3, '#2a2a2a'); R(g, 11, 73, 10, 1, '#4a4a4a');
  g.fillStyle = OUT; g.beginPath(); g.moveTo(5, 22); g.lineTo(27, 22); g.lineTo(22, 4); g.lineTo(10, 4); g.fill();
  g.fillStyle = '#ffd9a0'; g.beginPath(); g.moveTo(6, 21); g.lineTo(26, 21); g.lineTo(21, 5); g.lineTo(11, 5); g.fill();
  g.fillStyle = '#fff3d6'; g.beginPath(); g.moveTo(9, 20); g.lineTo(23, 20); g.lineTo(19, 8); g.lineTo(13, 8); g.fill();
  R(g, 14, 15, 4, 5, '#ffffff'); R(g, 6, 20, 20, 2, '#ffe0a8');
}
function tableLamp(g) { // 32x56: little side table with a lamp and a book
  shadow(g, 4, 48, 24, 8, 0.3);
  R(g, 4, 32, 24, 7, OUT); R(g, 5, 33, 22, 5, '#5a3420'); R(g, 5, 33, 22, 1, '#8a5a34'); R(g, 7, 38, 2, 15, '#2a1810'); R(g, 23, 38, 2, 15, '#2a1810'); R(g, 7, 46, 18, 2, '#2a1810');
  R(g, 18, 29, 8, 4, '#2d4f95'); R(g, 18, 29, 8, 1, '#5d8fd6');
  R(g, 9, 26, 6, 6, OUT); R(g, 10, 27, 4, 5, '#c9a26e');
  g.fillStyle = OUT; g.beginPath(); g.moveTo(4, 26); g.lineTo(20, 26); g.lineTo(17, 12); g.lineTo(7, 12); g.fill();
  g.fillStyle = '#ffd9a0'; g.beginPath(); g.moveTo(5, 25); g.lineTo(19, 25); g.lineTo(16, 13); g.lineTo(8, 13); g.fill();
  g.fillStyle = '#fff3d6'; g.beginPath(); g.moveTo(8, 24); g.lineTo(16, 24); g.lineTo(14, 16); g.lineTo(10, 16); g.fill();
}
function coffeeTable(g, w) { // w x 40: low wooden table with a tray, candle, snacks and a deck of cards
  shadow(g, 2, 30, w - 4, 10, 0.35);
  R(g, 4, 24, 3, 12, '#2a1810'); R(g, w - 7, 24, 3, 12, '#2a1810');
  R(g, 0, 10, w, 16, OUT); R(g, 1, 11, w - 2, 14, '#6b4024'); R(g, 1, 11, w - 2, 2, '#9a6a3e'); R(g, 1, 23, w - 2, 2, '#4a2a16');
  R(g, 6, 14, 18, 8, '#1c1f27'); R(g, 7, 15, 16, 6, '#3a3d45'); // tray
  R(g, 9, 13, 4, 6, '#f2efe8'); R(g, 10, 11, 2, 2, '#ffd23a'); R(g, 10, 10, 2, 1, '#fff3d6'); // candle
  pe(g, 18, 17, 4, 2, '#e0b25a'); R(g, 16, 16, 2, 1, '#f2c14e'); R(g, 19, 16, 2, 1, '#f2c14e'); // bowl of chips
  R(g, w - 22, 14, 7, 9, '#ffffff'); R(g, w - 21, 15, 5, 7, '#c9483b'); R(g, w - 13, 15, 6, 8, '#ffffff'); R(g, w - 11, 17, 2, 2, '#1c1f27'); // cards
  R(g, w - 30, 13, 4, 7, '#7a4a28'); R(g, w - 30, 13, 4, 2, '#e9e4da'); // a mug
}
function backBar(g, w) { // w x 62: shelves of bottles in front of a mirror, against the wall
  R(g, 0, 2, w, 58, OUT); R(g, 1, 3, w - 2, 56, '#2a1810');
  R(g, 5, 7, w - 10, 40, '#14202c'); for (let x = 12; x < w - 10; x += 26) { g.fillStyle = 'rgba(160,210,255,.07)'; g.beginPath(); g.moveTo(x, 7); g.lineTo(x + 10, 7); g.lineTo(x - 2, 47); g.lineTo(x - 12, 47); g.fill(); }
  const cols = ['#4fd18b', '#c9483b', '#e0b25a', '#9fd3ff', '#7a3ad0', '#f2efe8', '#c8873a', '#2f8f8a'];
  for (const [sy, n] of [[20, 0], [33, 3], [46, 5]]) {
    R(g, 3, sy, w - 6, 3, '#5a3420'); R(g, 3, sy, w - 6, 1, '#8a5a34');
    for (let x = 8, k = n; x < w - 10; x += 7 + ((k * 5) % 3), k++) { const c = cols[k % cols.length], h = 7 + (k * 7) % 5; R(g, x, sy - h, 4, h, OUT); R(g, x + 1, sy - h + 1, 2, h - 1, c); R(g, x + 1, sy - h - 2, 2, 2, OUT); R(g, x + 1, sy - h + 2, 1, 2, 'rgba(255,255,255,.5)'); }
  }
  R(g, 3, 50, w - 6, 9, '#3a2216'); for (let x = 6; x < w - 6; x += 22) R(g, x, 51, 18, 7, '#2a1810');
}
function barCounter(g, w) { // w x 50: polished top, panelled front and a brass foot rail
  shadow(g, 0, 42, w, 10, 0.4);
  R(g, 0, 8, w, 10, OUT); R(g, 1, 9, w - 2, 8, '#5a3420'); R(g, 1, 9, w - 2, 2, '#9a6a3e'); R(g, 1, 16, w - 2, 1, '#2a1810');
  R(g, 2, 18, w - 4, 26, '#2a1810'); for (let x = 6; x < w - 8; x += 24) { R(g, x, 21, 20, 18, '#3a2216'); R(g, x, 21, 20, 1, '#4a2f1a'); }
  R(g, 0, 38, w, 3, '#8a6a3a'); R(g, 0, 38, w, 1, '#e0c08a'); for (let x = 10; x < w; x += 40) R(g, x, 41, 2, 4, '#8a6a3a');
  R(g, 2, 44, w - 4, 4, '#1a0e08');
  // on top: beer tap, glasses, a bottle and a bowl of peanuts
  R(g, 22, -2, 6, 12, OUT); R(g, 23, -1, 4, 10, '#e0b25a'); R(g, 21, -4, 8, 3, '#1c1f27'); R(g, 23, -6, 4, 3, '#c9483b');
  for (const x of [40, 47, 96, 140]) { R(g, x, 4, 5, 8, '#9fd3ff'); R(g, x + 1, 5, 3, 3, 'rgba(255,255,255,.6)'); R(g, x + 1, 8, 3, 3, '#e0b25a'); }
  R(g, 118, -1, 5, 12, OUT); R(g, 119, 0, 3, 11, '#4fd18b'); R(g, 119, -3, 3, 3, OUT);
  pe(g, 70, 11, 6, 3, '#e9e4da'); R(g, 66, 9, 8, 2, '#c8873a');
}
function bench(g, w) { // w x 26: low wooden bench
  shadow(g, 2, 18, w - 4, 8, 0.3);
  R(g, 0, 6, w, 9, OUT); R(g, 1, 7, w - 2, 7, '#a0703f'); R(g, 1, 7, w - 2, 2, '#c99a62'); for (let x = 8; x < w; x += 14) R(g, x, 7, 1, 7, '#7a4a28');
  R(g, 1, 14, w - 2, 3, '#6b4024');
  for (const lx of [4, w - 8]) { R(g, lx, 17, 4, 8, '#3a2216'); R(g, lx, 17, 1, 8, '#6b4024'); }
}
function wardrobe(g) { // 64x96: big wooden wardrobe with a mirror; clothes peek through the half-open door
  shadow(g, 2, 86, 60, 10, 0.35);
  R(g, 0, 4, 64, 84, OUT); R(g, 1, 5, 62, 82, '#5a3420'); R(g, 1, 5, 62, 3, '#8a5a34'); R(g, 0, 0, 64, 6, OUT); R(g, 1, 1, 62, 4, '#6b4024');
  R(g, 4, 10, 27, 70, '#2a1810'); // open door: hanging clothes inside
  R(g, 5, 13, 25, 2, '#9aa1ac');
  const cl = ['#c9483b', '#2d4f95', '#e9e4da', '#1c1f27', '#4fd18b', '#e0b25a'];
  for (let k = 0; k < 6; k++) { const x = 6 + k * 4; R(g, x, 15, 4, 32 + (k % 3) * 6, OUT); R(g, x + 1, 16, 2, 30 + (k % 3) * 6, cl[k]); }
  R(g, 5, 66, 25, 12, '#3a2216'); R(g, 8, 70, 7, 5, '#1c1f27'); R(g, 18, 70, 8, 5, '#7a4a28'); // shoes
  R(g, 33, 10, 27, 70, '#6b4024'); R(g, 34, 11, 25, 68, '#7a4a28'); R(g, 37, 15, 19, 46, '#9fb7cc'); R(g, 38, 16, 17, 44, '#c9dbe9'); R(g, 40, 18, 3, 30, '#ffffff'); // mirror door
  R(g, 35, 66, 23, 10, '#6b4024'); R(g, 34, 45, 2, 6, '#e0b25a');
  R(g, 2, 86, 6, 4, '#2a1810'); R(g, 56, 86, 6, 4, '#2a1810');
}

function buildHub() {
  const solid = grid(HUB_W, HUB_H, 0), objs = [];
  for (let y = 0; y < HUB_H; y++) for (let x = 0; x < HUB_W; x++) if (y < 2 || y > 10 || x < 1 || x > 16) solid[y][x] = 1;
  const block = (tx, ty, w = 1, h = 1) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) solid[y][x] = 1; };
  const obj = (x, y, w, h, sortY, paint) => { const [c, g] = cv(w, h); paint(g); objs.push({ x, y, sortY, c }); };
  const at = (tx, ty, w, h, paint, fw = 1, fh = 1) => obj(tx * T + (fw * T - w) / 2, (ty + fh) * T - h, w, h, (ty + fh) * T, paint);
  const [bg, g] = cv(HUB_W * T, HUB_H * T);
  R(g, 0, 0, HUB_W * T, HUB_H * T, '#07090f');
  // dark wood floor
  for (let y = 2 * T; y < 11 * T; y += 8) { const row = y / 8 | 0; R(g, T, y, 16 * T, 8, ['#3b2a20', '#35261d', '#402e23'][row % 3]); R(g, T, y + 7, 16 * T, 1, '#24180f'); for (let x = T + (row * 29) % 56; x < 17 * T; x += 56) R(g, x, y, 1, 7, '#24180f'); }
  // the lounge rug: warm, with a border and a diamond pattern
  const rx = 2 * T + 16, ry = 5 * T + 12, rw = 7 * T - 8, rh = 5 * T - 4;
  R(g, rx, ry, rw, rh, '#2a0e14'); R(g, rx + 3, ry + 3, rw - 6, rh - 6, '#7a2a34'); R(g, rx + 8, ry + 8, rw - 16, rh - 16, '#5a1e28'); R(g, rx + 10, ry + 10, rw - 20, rh - 20, '#8a3440');
  for (let x = rx + 22; x < rx + rw - 16; x += 26) for (let y = ry + 22; y < ry + rh - 16; y += 26) { R(g, x, y - 2, 2, 6, '#a8564a'); R(g, x - 2, y, 6, 2, '#a8564a'); R(g, x, y, 2, 2, '#c9a26e'); }
  for (let x = rx + 2; x < rx + rw - 2; x += 4) { R(g, x, ry - 3, 2, 3, '#c9a26e'); R(g, x, ry + rh, 2, 3, '#c9a26e'); }
  // sparring mat in the lower right: where the host's practice fights happen
  const mx = HUB_RING.x0 * T + 6, my = HUB_RING.y0 * T + 4, mw = (HUB_RING.x1 - HUB_RING.x0 + 1) * T - 12, mh = (HUB_RING.y1 - HUB_RING.y0 + 1) * T - 8;
  R(g, mx, my, mw, mh, '#1e2a36'); R(g, mx + 2, my + 2, mw - 4, mh - 4, '#24384a');
  for (let x = mx + 2; x < mx + mw - 2; x += 32) R(g, x, my + 2, 1, mh - 4, '#1e2f3e');
  R(g, mx + 6, my + 6, mw - 12, 2, '#e9e4da'); R(g, mx + 6, my + mh - 8, mw - 12, 2, '#e9e4da'); R(g, mx + 6, my + 6, 2, mh - 12, '#e9e4da'); R(g, mx + mw - 8, my + 6, 2, mh - 12, '#e9e4da');
  R(g, mx + 6, my + 6, 6, 6, '#c9483b'); R(g, mx + mw - 12, my + mh - 12, 6, 6, '#2d6cdf');
  center(g, 'TREINO', mx + mw / 2, my + mh / 2 - 4, 'rgba(233,228,218,.25)', 2);
  // back wall: dark brick, neon strip, the TV, the RESENHA door
  R(g, 0, 0, HUB_W * T, 2 * T, '#1a1416');
  for (let y = 4; y < 2 * T - 6; y += 6) for (let x = ((y / 6 | 0) % 2) * 10; x < HUB_W * T; x += 20) { R(g, x, y, 19, 5, '#2a1e20'); R(g, x, y, 19, 1, '#36272a'); }
  R(g, 0, 2 * T - 6, HUB_W * T, 6, '#0d0a0b'); R(g, 0, 2, HUB_W * T, 2, '#ff3d7f');
  R(g, 3 * T + 4, 8, 3 * T - 8, 36, '#0c0d10'); R(g, 3 * T + 6, 10, 3 * T - 12, 32, '#1b2b4a'); R(g, 3 * T + 10, 14, 30, 4, '#9fd3ff'); R(g, 3 * T + 10, 22, 50, 12, '#2d6cdf');
  R(g, HUB_DOOR.x0 - 6, 6, HUB_DOOR.x1 - HUB_DOOR.x0 + 12, 2 * T - 6, '#ff3d7f');
  R(g, HUB_DOOR.x0 - 3, 9, HUB_DOOR.x1 - HUB_DOOR.x0 + 6, 2 * T - 9, '#3a0d1d');
  R(g, HUB_DOOR.x0, 22, HUB_DOOR.x1 - HUB_DOOR.x0, 2 * T - 22, '#120509'); R(g, HUB_DOOR.x0 + T - 1, 22, 2, 2 * T - 22, '#3a0d1d');
  R(g, HUB_DOOR.x0 + T - 8, 40, 3, 6, '#c9a26e'); R(g, HUB_DOOR.x0 + T + 5, 40, 3, 6, '#c9a26e');
  // the floor behind the bar is darker
  R(g, 11 * T, 2 * T, 6 * T, 3 * T, '#22160f'); for (let y = 2 * T; y < 5 * T; y += 8) R(g, 11 * T, y + 7, 6 * T, 1, '#160d08');
  // side and bottom walls
  R(g, 18, 0, 14, HUB_H * T, '#1a1416'); R(g, 30, 0, 2, HUB_H * T, '#2a1e20');
  R(g, (HUB_W - 1) * T, 0, 14, HUB_H * T, '#1a1416'); R(g, (HUB_W - 1) * T, 0, 2, HUB_H * T, '#2a1e20');
  R(g, 0, 11 * T, HUB_W * T, 14, '#1a1416'); R(g, 0, 11 * T, HUB_W * T, 2, '#2a1e20');
  // stairs up to the Smart Fit, rising to the left
  for (let k = 0; k < 4; k++) R(g, HUB_STAIRS.tx * T + k * 8, HUB_STAIRS.ty0 * T, 8, 2 * T, shade('#5d6470', 0.12 * (3 - k)));
  R(g, HUB_STAIRS.tx * T, HUB_STAIRS.ty0 * T - 2, T + 6, 2, '#c9ced6'); R(g, HUB_STAIRS.tx * T, (HUB_STAIRS.ty1 + 1) * T, T + 6, 2, '#c9ced6');
  ptext(g, 'SMART', HUB_STAIRS.tx * T + 2, HUB_STAIRS.ty0 * T - 16, '#ffffff'); ptext(g, 'FIT', HUB_STAIRS.tx * T + 6, HUB_STAIRS.ty0 * T - 9, '#f5c400');
  // top left, as it was: plant, TV console, music speaker
  block(3, 2, 4, 1); at(3, 2, 4 * T, 30, c => { shadow(c, 2, 20, 4 * T - 4, 10, 0.3); R(c, 0, 4, 4 * T, 22, OUT); R(c, 1, 5, 4 * T - 2, 20, '#2a1e20'); R(c, 1, 5, 4 * T - 2, 2, '#3a2a2d'); R(c, 20, 10, 30, 10, '#0d0a0b'); R(c, 80, 10, 10, 12, '#c9483b'); }, 4, 1);
  block(1, 2); at(1, 2, 32, 56, plantPot);
  block(HUB_SPEAKER.tx, HUB_SPEAKER.ty); at(HUB_SPEAKER.tx, HUB_SPEAKER.ty, 32, 56, speaker);
  // the bar, top right: back shelves, the host behind the counter, wooden benches in front
  block(11, 2, 6, 3);
  at(11, 2, 6 * T, 62, c => backBar(c, 6 * T), 6, 1);
  at(11, 4, 6 * T, 50, c => barCounter(c, 6 * T), 6, 1);
  for (const bx of HUB_BENCHES) { block(bx, 5, 2, 1); at(bx, 5, 2 * T - 4, 26, c => bench(c, 2 * T - 4), 2, 1); }
  // the lounge: sofas around a coffee table on the rug, with a reading lamp
  block(5, 7, 2, 1); at(5, 7, 2 * T, 40, c => coffeeTable(c, 2 * T), 2, 1);
  block(4, 9, 4, 1); at(4, 9, 4 * T, 46, c => sofaBack(c, 4 * T), 4, 1);
  block(3, 6, 1, 2); at(3, 6, 32, 72, sofaSide, 1, 2);
  block(8, 7); at(8, 7, 32, 48, armchair);
  block(3, 9); at(3, 9, 32, 56, tableLamp);
  block(16, 6); at(16, 6, 32, 56, plantPot);
  block(16, 10); at(16, 10, 32, 80, floorLamp);
  // the wardrobe, bottom left (change class here)
  block(HUB_WARDROBE.tx, HUB_WARDROBE.ty - 1, 2, 2); at(HUB_WARDROBE.tx, HUB_WARDROBE.ty - 1, 64, 96, wardrobe, 2, 2);
  objs.sort((a, b) => a.sortY - b.sortY);
  // lamps: [x, y] ceiling fixtures (light pools below), [x, y, 'pool'] just a pool of light (pendants), [x, y, 'shade'] lit from inside a lampshade
  const lamps = [[9 * T, 1 * T], [4.5 * T, 1.5 * T], [12.5 * T, 2.6 * T, 'pool'], [15.5 * T, 2.6 * T, 'pool'], [6 * T, 7 * T, 'pool'], [16.5 * T, 11 * T - 68, 'shade'], [3.5 * T - 4, 10 * T - 37, 'shade']];
  return { kind: 'hub', w: HUB_W, h: HUB_H, solid, objs, bg, lamps, seen: null };
}

/* ---------------- procedural dungeon ---------------- */
function genFloor(depth, seed) {
  const r = rng(seed), W = DUN_W, H = DUN_H;
  const solid = grid(W, H, 1), rooms = [];
  for (let tries = 0; tries < 400 && rooms.length < 10; tries++) {
    const w = 5 + (r() * 7 | 0), h = 4 + (r() * 5 | 0), x = 2 + (r() * (W - w - 4) | 0), y = 3 + (r() * (H - h - 5) | 0);
    if (rooms.some(o => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  const carve = (x, y) => { if (x > 0 && y > 2 && x < W - 1 && y < H - 1) solid[y][x] = 0; };
  for (const m of rooms) for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) carve(x, y);
  const corridor = (a, b) => { // L-shaped, two tiles wide
    const hFirst = r() < 0.5;
    const hor = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { carve(x, y); carve(x, y + 1); } };
    const ver = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { carve(x, y); carve(x + 1, y); } };
    if (hFirst) { hor(a.cy, a.cx, b.cx); ver(b.cx, a.cy, b.cy); } else { ver(a.cx, a.cy, b.cy); hor(b.cy, a.cx, b.cx); }
  };
  for (let i = 1; i < rooms.length; i++) {
    let best = 0, bd = 1e9;
    for (let j = 0; j < i; j++) { const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy); if (d < bd) { bd = d; best = j; } }
    corridor(rooms[best], rooms[i]);
  }
  for (let k = 0; k < 2 && rooms.length > 3; k++) corridor(rooms[r() * rooms.length | 0], rooms[r() * rooms.length | 0]); // a couple of loops
  // stairs: exit in the first room, the way down in the room farthest from it (walking distance)
  const start = rooms[0], dist = grid(W, H, -1), q = [[start.cx, start.cy]]; dist[start.cy][start.cx] = 0;
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!solid[ny]?.[nx] && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]); } } }
  const far = rooms.slice(1).reduce((a, m) => (dist[m.cy][m.cx] > dist[a.cy][a.cx] ? m : a), rooms[1] || rooms[0]);
  const up = { tx: start.x + 1, ty: start.cy }, down = { tx: far.cx, ty: far.cy };
  // props: barrels and crates against room walls (never on stairs, doorways or corridors), lamps over room walls
  const objs = [], props = [], lamps = [];
  const free = (x, y) => !solid[y][x] && !(x === up.tx && y === up.ty) && !(x === down.tx && y === down.ty) && Math.abs(x - up.tx) + Math.abs(y - up.ty) > 2;
  for (const m of rooms) {
    const n = 1 + (r() * 3 | 0);
    for (let k = 0; k < n; k++) {
      const edge = r() < 0.5, x = edge ? (r() < 0.5 ? m.x : m.x + m.w - 1) : m.x + 1 + (r() * (m.w - 2) | 0), y = edge ? m.y + 1 + (r() * (m.h - 2) | 0) : (r() < 0.5 ? m.y : m.y + m.h - 1);
      // keep doorways open: skip tiles with corridor floor right outside the room
      const outside = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([ox, oy]) => ox < m.x || ox >= m.x + m.w || oy < m.y || oy >= m.y + m.h);
      if (!free(x, y) || outside.some(([ox, oy]) => !solid[oy][ox])) continue;
      props.push({ tx: x, ty: y, kind: r() < 0.6 ? 'barrel' : 'crate', tipped: r() < 0.25 });
    }
    lamps.push([(m.x + (r() * m.w | 0) + 0.5) * T, m.y * T - 4]);
  }
  for (const p of props) solid[p.ty][p.tx] = 1;
  // delinquents patrolling rooms (never the first one): more of them the deeper you go
  const enemies = [], others = rooms.slice(1);
  for (let i = 0; i < Math.min(5, 2 + Math.floor(depth / 2)) && others.length; i++) {
    const m = others[r() * others.length | 0];
    for (let k = 0; k < 12; k++) {
      const x = m.x + 1 + (r() * (m.w - 2) | 0), y = m.y + 1 + (r() * (m.h - 2) | 0);
      if (solid[y][x] || (x === down.tx && y === down.ty)) continue;
      enemies.push({ x: (x + 0.5) * T, y: (y + 0.7) * T, room: m, dir: 'down', mode: 'stand', animT: r() * 4, wait: r() * 2, goal: null, alert: 0, stun: 0, sprite: 'capanga' });
      break;
    }
  }
  return { kind: 'dungeon', depth, w: W, h: H, solid, rooms, up, down, props, lamps, enemies, seen: grid(W, H, 0), seed };
}

function barrel(g, tipped) { // 32x44
  shadow(g, 4, 34, 24, 8, 0.35);
  if (tipped) { R(g, 2, 18, 28, 18, OUT); R(g, 3, 19, 26, 16, '#a9aeb5'); R(g, 3, 19, 26, 3, '#d6dbe0'); R(g, 9, 19, 2, 16, '#7d838a'); R(g, 21, 19, 2, 16, '#7d838a'); pe(g, 4, 27, 3, 8, '#6b7078'); return; }
  R(g, 6, 6, 20, 30, OUT); R(g, 7, 7, 18, 28, '#a9aeb5'); R(g, 7, 7, 5, 28, '#d6dbe0'); R(g, 20, 7, 5, 28, '#7d838a');
  R(g, 7, 14, 18, 2, '#7d838a'); R(g, 7, 26, 18, 2, '#7d838a'); pe(g, 16, 7, 9, 3, '#8a9098'); pe(g, 16, 7, 7, 2, '#5d6470');
}
function crate(g) { // 32x44
  shadow(g, 3, 34, 26, 8, 0.35);
  R(g, 4, 10, 24, 26, OUT); R(g, 5, 11, 22, 24, '#8a6a42'); R(g, 5, 11, 22, 3, '#a8845a');
  R(g, 5, 22, 22, 2, '#5e4529'); R(g, 15, 11, 2, 24, '#5e4529'); R(g, 5, 11, 2, 24, '#6e5232');
}

function paintFloor(F) {
  const { w, h, solid } = F, r = rng(F.seed + 7);
  const [bg, g] = cv(w * T, h * T);
  R(g, 0, 0, w * T, h * T, '#08090b');
  const isWall = (x, y) => y < 0 || y >= h || x < 0 || x >= w || solid[y][x] === 1 && !F.props.some(p => p.tx === x && p.ty === y);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x * T, py = y * T;
    if (!isWall(x, y)) { // wet concrete
      const base = shade('#3b3e42', r() * 0.06 - 0.03);
      R(g, px, py, T, T, base); R(g, px, py, T, 1, '#33363a'); R(g, px, py, 1, T, '#33363a');
      for (let k = 0; k < 8; k++) R(g, px + r() * 31, py + r() * 31, 1, 1, r() < 0.5 ? '#46494e' : '#2e3034');
      if (r() < 0.07) { g.fillStyle = 'rgba(120,150,170,.18)'; g.beginPath(); g.ellipse(px + 16, py + 18, 10 + r() * 8, 4 + r() * 3, 0, 0, Math.PI * 2); g.fill(); }
      if (r() < 0.05) { R(g, px + 4 + r() * 20, py + 6 + r() * 20, 8, 1, '#26282b'); }
      continue;
    }
    const floorBelow = y + 1 < h && !isWall(x, y + 1);
    const nearFloor = [[1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => !isWall(x + dx, y + dy));
    if (floorBelow) { // concrete wall face with a rusty pipe
      R(g, px, py, T, T, '#4d5156'); R(g, px, py, T, 4, '#2a2c30'); R(g, px, py + T - 3, T, 3, '#25272a');
      if ((x * 7 + y) % 4 === 0) R(g, px, py + 4, 1, T - 7, '#3d4045');
      R(g, px, py + 10, T, 4, '#6b4f3a'); R(g, px, py + 10, T, 1, '#8a6a4f');
      if ((x + y * 3) % 9 === 0) { R(g, px + 12, py + 14, 3, 14, '#3a3d42'); }
    } else if (nearFloor) { R(g, px, py, T, T, '#25272b'); R(g, px, py, T, 1, '#34373c'); }
  }
  // stairs: the exit (up, green light) and the way down (dark well with a red marker)
  const up = F.up, dn = F.down;
  for (let k = 0; k < 4; k++) R(g, up.tx * T + k * 8, up.ty * T + 2, 8, T - 4, shade('#6b7078', 0.12 * (3 - k)));
  R(g, up.tx * T, up.ty * T, T, 2, '#4fd18b'); ptext(g, 'SAIDA', up.tx * T - 2, up.ty * T - 8, '#4fd18b');
  R(g, dn.tx * T - 4, dn.ty * T - 4, T + 8, T + 8, '#e8b33a'); for (let k = 0; k < T + 8; k += 8) R(g, dn.tx * T - 4 + k, dn.ty * T - 4, 4, T + 8, '#1b1b1b');
  for (let k = 0; k < 4; k++) R(g, dn.tx * T, dn.ty * T + k * 8, T, 8, shade('#2a2c30', -0.2 * k));
  F.bg = bg;
  F.objs = F.props.map(p => { const [c, gg] = cv(32, 44); p.kind === 'barrel' ? barrel(gg, p.tipped) : crate(gg); return { x: p.tx * T, y: (p.ty + 1) * T - 44, sortY: (p.ty + 1) * T, c }; }).sort((a, b) => a.sortY - b.sortY);
}

/* ---------------- state ---------------- */
let hub = null, onLeave = null, swap = 0, banner = null, dark = null, dg = null, speakerFlash = 0;
const SPK = { x: (HUB_SPEAKER.tx + 0.5) * T, y: (HUB_SPEAKER.ty + 1) * T };
function useSpeaker() { Music.nextExplore(); speakerFlash = 2.5; }
const portraits = {};
export const dun = { active: false, scene: null, walker: null, hero: null, depth: 0, runSeed: 0 };

class Walker {
  constructor(actor) { this.a = actor; this.id = actor.id; this.dir = 'down'; this.mode = 'stand'; this.path = []; this.animT = 0; this.alpha = 0; this.x = 0; this.y = 0; this.target = null; }
  get headX() { return this.x; }
  get headY() { return this.y - SPR[this.id].meta.down.h - 4; }
  setDir(dx, dy) { if (Math.abs(dx) > Math.abs(dy) * 1.1) this.dir = dx < 0 ? 'left' : 'right'; else if (Math.abs(dy) > 0.01) this.dir = dy < 0 ? 'up' : 'down'; }
}

function place(x, y, dir) { const w = dun.walker; w.x = x; w.y = y; w.dir = dir; w.path = []; w.target = null; }
function goHub(from) {
  if (!hub) hub = buildHub();
  dun.scene = hub; dun.depth = 0;
  if (from === 'gym') place((HUB_STAIRS.tx + 1.6) * T, (HUB_STAIRS.ty0 + 1) * T + 8, 'right');
  else place((HUB_DOOR.x0 + HUB_DOOR.x1) / 2, 3 * T + 20, 'down');
  dun.hero.rest(); // the living room is where you recover HP and MP
  banner = { text: from === 'defeat' ? 'Você acordou na Resenha' : 'Sala da Resenha', t: 2.2 };
}
function goFloor(depth) {
  const F = genFloor(depth, dun.runSeed + depth * 977);
  paintFloor(F);
  dun.scene = F; dun.depth = depth;
  place((F.up.tx + 1.5) * T, F.up.ty * T + 24, 'right');
  banner = { text: `Resenha B${depth}F`, t: 2.2 };
}
function transition(fn) { swap = 0.4; fn(); }

export function enterDun(actor, leave, from = 'tp') {
  hostLoading ||= loadStill(NPC_ID, 'assets/sprites/resenha_host.png').catch(err => console.warn('host sprite', err));
  onLeave = leave;
  dun.walker = new Walker(actor); dun.walker.alpha = 1; dun.active = true;
  dun.hero = loadHero(actor.id);
  hostLoading.then(() => tinted(NPC_ID, 'capanga', [170, 30, 42], 215)); // the enemy: the host's build in a red shirt (+ cap and shades on top)
  goHub(from);
  Music.startExplore();
}
// how: 'gym' (stairs up to the Smart Fit) or 'office' (HUD button / timer started)
export function leaveDun(how = 'gym') {
  if (!dun.active) return;
  const a = dun.walker.a;
  Battle.abortBattle(); Ui.closeUi();
  dun.hero?.save();
  dun.active = false; dun.walker = null; dun.scene = null;
  Music.stop();
  onLeave?.(a, how);
}
export const size = () => ({ w: dun.scene.w * T, h: dun.scene.h * T });

/* ---------------- triggers and clicks ---------------- */
const tileOf = w => ({ tx: Math.floor(w.x / T), ty: Math.floor((w.y - 4) / T) });
function triggers(w, vx, vy) {
  const S = dun.scene;
  if (S.kind === 'hub') {
    if (w.y < 2 * T + 14 && w.x > HUB_DOOR.x0 + 6 && w.x < HUB_DOOR.x1 - 6 && (vy < 0 || w.target === 'door')) { transition(() => { dun.runSeed = (Date.now() & 0xffffff); goFloor(1); }); return true; }
    const t = tileOf(w);
    if (t.tx <= HUB_STAIRS.tx && t.ty >= HUB_STAIRS.ty0 && t.ty <= HUB_STAIRS.ty1 && (vx < 0 || w.target === 'stairs')) { leaveDun('gym'); return true; }
    return false;
  }
  const t = tileOf(w);
  if (t.tx === S.down.tx && t.ty === S.down.ty) { transition(() => goFloor(S.depth + 1)); return true; }
  if (t.tx === S.up.tx && t.ty === S.up.ty && (vx < 0 || w.target === 'up')) { transition(() => goHub('dungeon')); return true; }
  return false;
}
export const battleKey = code => Battle.battle.active && Battle.battleKey(code);
export function overInteractive(x, y) {
  const S = dun.scene; if (!S) return false;
  if (Battle.battle.active) return Battle.overBattleTarget(x, y);
  if (S.kind === 'hub' && (overHost(x, y) || overWardrobe(x, y))) return true;
  if (S.kind === 'hub') return Math.abs(x - SPK.x) < 18 && y > SPK.y - 46 && y < SPK.y + 4 || (y < 2 * T + 20 && x > HUB_DOOR.x0 - 6 && x < HUB_DOOR.x1 + 6) || (x < (HUB_STAIRS.tx + 1) * T && y > HUB_STAIRS.ty0 * T && y < (HUB_STAIRS.ty1 + 1) * T);
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  return (tx === S.down.tx && ty === S.down.ty && S.seen[ty][tx]) || (tx === S.up.tx && ty === S.up.ty);
}
// (x, y) world coords, (sx, sy) screen coords (for the battle menu)
export function clickDun(x, y, sx, sy) {
  const w = dun.walker, S = dun.scene; if (!w || swap > 0) return;
  if (Battle.battle.active) { Battle.battleClick(x, y, sx, sy); return; }
  let tx = Math.max(0, Math.min(S.w - 1, Math.floor(x / T))), ty = Math.max(0, Math.min(S.h - 1, Math.floor((y - 2) / T)));
  let fx = x, fy = null, target = null;
  if (S.kind === 'hub' && Math.abs(x - SPK.x) < 18 && y > SPK.y - 46 && y < SPK.y + 4) {
    if (Math.hypot(w.x - SPK.x, w.y - SPK.y) < 64) { useSpeaker(); return; }
    tx = HUB_SPEAKER.tx; ty = HUB_SPEAKER.ty + 1; fx = SPK.x; fy = (HUB_SPEAKER.ty + 1) * T + 22; target = 'speaker';
  } else if (S.kind === 'hub' && (overHost(x, y) || overWardrobe(x, y))) {
    const host = overHost(x, y), spot = host ? HOST_SPOT : WARD_SPOT;
    if (Math.hypot(w.x - spot.x, w.y - spot.y) < 40) { w.dir = 'up'; host ? useHost() : useWardrobe(); return; }
    tx = Math.floor(spot.x / T); ty = Math.floor(spot.y / T); fx = spot.x; fy = spot.y; target = host ? 'host' : 'wardrobe';
  } else if (S.kind === 'hub') {
    if (y < 2 * T + 20 && x > HUB_DOOR.x0 - 6 && x < HUB_DOOR.x1 + 6) { tx = 8; ty = 2; fx = (HUB_DOOR.x0 + HUB_DOOR.x1) / 2; fy = 2 * T + 10; target = 'door'; }
    else if (x < (HUB_STAIRS.tx + 1) * T && y > HUB_STAIRS.ty0 * T && y < (HUB_STAIRS.ty1 + 1) * T) { tx = HUB_STAIRS.tx; ty = HUB_STAIRS.ty0; fx = HUB_STAIRS.tx * T + 16; fy = HUB_STAIRS.ty0 * T + 24; target = 'stairs'; }
  } else if (tx === S.up.tx && ty === S.up.ty) { fx = (tx + 0.5) * T; fy = ty * T + 24; target = 'up'; }
  else if (tx === S.down.tx && ty === S.down.ty) { fx = (tx + 0.5) * T; fy = ty * T + 24; }
  if (S.solid[ty][tx]) { let ok = false; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (S.solid[ty + dy]?.[tx + dx] === 0) { tx += dx; ty += dy; ok = true; break; } if (!ok) return; }
  const st = tileOf(w), p = findPath(st.tx, st.ty, tx, ty, S.solid);
  if (!p) return;
  if (p.length) p[p.length - 1] = { x: fx, y: fy ?? p[p.length - 1].y }; else p.push({ x: fx, y: fy ?? w.y });
  w.path = p; w.target = target;
}

/* ---------------- update ---------------- */
function freeNear(S, x, y, minT, maxT, taken = []) {
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, d = (minT + Math.random() * (maxT - minT)) * T, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8;
    if (!blockedIn(S.solid, px, py) && taken.every(o => Math.hypot(o.x - px, o.y - py) > 36)) return { x: px, y: py };
  }
  return { x, y: y + T };
}
function startFight(e) {
  const S = dun.scene, w = dun.walker;
  w.path = []; w.target = null;
  Battle.startBattle({
    walker: w, hero: dun.hero, mapEnemy: e, depth: S.depth,
    blocked: (x, y) => blockedIn(S.solid, x, y),
    freeNear: (x, y, a, b, taken) => freeNear(S, x, y, a, b, taken),
    onEnd: res => {
      if (dun.scene !== S) return;
      if (res.result === 'win') S.enemies = S.enemies.filter(o => o !== e);
      else if (res.result === 'fled') { e.stun = 4; e.alert = 0; }
      else if (res.result === 'lose') transition(() => goHub('defeat'));
    },
  });
}
function useWardrobe() { Ui.openWardrobe(dun.hero, c => { banner = { text: `Agora você é ${c.name}`, t: 2 }; }); }
function useHost() { Ui.openHost(dun.hero, spar); }
// practice fight on the mat: n delinquents of the given strength; win or lose, you get back up healed
function spar(n, level) {
  const S = dun.scene, w = dun.walker;
  place((HUB_RING.x0 + 1.5) * T, (HUB_RING.y0 + 2) * T + 8, 'right');
  Battle.startBattle({
    walker: w, hero: dun.hero, mapEnemy: null, depth: level, count: n,
    blocked: (x, y) => blockedIn(S.solid, x, y),
    freeNear: (x, y, a, b, taken) => freeNear(S, (HUB_RING.x0 + 4) * T, (HUB_RING.y0 + 2) * T, 0.6, 1.8, taken),
    onEnd: () => { if (dun.scene !== S) return; dun.hero.rest(); banner = { text: 'Fim do treino', t: 1.8 }; },
  });
}
function updateEnemies(dt) {
  const S = dun.scene, w = dun.walker;
  for (const e of S.enemies) {
    e.stun = Math.max(0, e.stun - dt);
    const d = Math.hypot(e.x - w.x, e.y - w.y);
    if (e.stun <= 0 && d < 5 * T) e.alert = Math.min(1, e.alert + dt * 2.5); else if (d > 9 * T) e.alert = Math.max(0, e.alert - dt);
    let goal, speed = 38;
    if (e.alert > 0.6) { goal = { x: w.x, y: w.y }; speed = 90; }
    else {
      e.wait -= dt;
      if (!e.goal || e.wait <= 0) { const m = e.room; e.goal = { x: (m.x + 0.5 + Math.random() * (m.w - 1)) * T, y: (m.y + 0.7 + Math.random() * (m.h - 1)) * T }; e.wait = 2 + Math.random() * 3; }
      goal = e.goal;
    }
    const dx = goal.x - e.x, dy = goal.y - e.y, dd = Math.hypot(dx, dy);
    if (dd > 2) {
      const st = Math.min(dd, speed * dt), nx = e.x + dx / dd * st, ny = e.y + dy / dd * st;
      if (!blockedIn(S.solid, nx, e.y)) e.x = nx; if (!blockedIn(S.solid, e.x, ny)) e.y = ny;
      e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      e.mode = 'walk'; e.animT += dt * (speed > 50 ? 11 : 7);
    } else { e.mode = 'stand'; e.animT += dt; }
    if (e.stun <= 0 && d < 24 && swap <= 0) { startFight(e); return; }
  }
}
export function updateDun(dt, keys) {
  const w = dun.walker, S = dun.scene;
  swap = Math.max(0, swap - dt); speakerFlash = Math.max(0, speakerFlash - dt);
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (Battle.battle.active) { Battle.updateBattle(dt, keys); return; }
  let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0), moving = false;
  if (swap > 0.2 || Ui.isOpen()) { vx = vy = 0; }
  if (vx || vy) {
    w.path = []; w.target = null;
    const n = Math.hypot(vx, vy), sp = (keys.run ? RUN : WALK) * dt; vx /= n; vy /= n;
    if (!blockedIn(S.solid, w.x + vx * sp, w.y)) w.x += vx * sp;
    if (!blockedIn(S.solid, w.x, w.y + vy * sp)) w.y += vy * sp;
    w.setDir(vx, vy); moving = true;
    if (swap <= 0 && triggers(w, vx, vy)) return;
  } else if (w.path.length) {
    let rem = WALK * dt;
    while (rem > 0 && w.path.length) {
      const p = w.path[0], dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy);
      if (d < 0.01) { w.path.shift(); continue; }
      w.setDir(dx, dy);
      if (d <= rem) { w.x = p.x; w.y = p.y; w.path.shift(); rem -= d; } else { w.x += dx / d * rem; w.y += dy / d * rem; rem = 0; }
    }
    moving = true;
    if (!w.path.length && w.target === 'speaker') { w.target = null; w.dir = 'up'; useSpeaker(); }
    if (!w.path.length && (w.target === 'host' || w.target === 'wardrobe')) { const k = w.target; w.target = null; w.dir = 'up'; k === 'host' ? useHost() : useWardrobe(); }
    if (!w.path.length && swap <= 0 && triggers(w, 0, 0)) return;
  }
  w.mode = moving ? 'walk' : 'stand';
  w.animT += dt * (moving ? (keys.run ? 13 : 8) : 1);
  if (S.kind === 'dungeon') updateEnemies(dt);
  if (S.seen) { const t = tileOf(w); for (let y = t.ty - 5; y <= t.ty + 5; y++) for (let x = t.tx - 6; x <= t.tx + 6; x++) if (S.seen[y]?.[x] === 0 && (x - t.tx) ** 2 + (y - t.ty) ** 2 <= 36) S.seen[y][x] = 1; }
}

/* ---------------- draw (world) ---------------- */
function drawPerson(g, t, id, x, y, dir, mode, animT, alpha = 1) {
  if (!SPR[id]) return;
  g.globalAlpha = alpha;
  const fr = mode === 'walk' ? frame(id, 'walk', dir, Math.floor(animT)) : frame(id, 'stand', dir, Math.floor(t * 1.4) % 2);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y - 1, 10, 3.5, 0, 0, Math.PI * 2); g.fill();
  g.drawImage(fr, Math.round(x - CW / 2), Math.round(y - FOOT));
  g.globalAlpha = 1;
}
export const inBattle = () => Battle.battle.active;
// others: colleagues in the Resenha room (multiplayer); not drawn on dungeon floors or while sparring
export function drawDun(g, t, others = []) {
  const S = dun.scene, w = dun.walker, sh = Battle.battleShake();
  g.save(); g.translate(Math.round(sh.x), Math.round(sh.y));
  g.drawImage(S.bg, 0, 0);
  const items = S.objs.map(o => ({ s: o.sortY, o }));
  items.push({ s: w.y, w });
  if (S.kind === 'hub') items.push({ s: (HUB_NPC.ty + 1) * T, npc: true });
  if (S.kind === 'hub' && !Battle.battle.active) for (const r of others) items.push({ s: r.y, remote: r });
  if (S.kind === 'dungeon' && !Battle.battle.active) for (const e of S.enemies) items.push({ s: e.y, enemy: e });
  for (const d of Battle.battleDrawables(t)) items.push({ s: d.s, draw: d.draw });
  items.sort((a, b) => a.s - b.s);
  for (const it of items) {
    if (it.o) g.drawImage(it.o.c, it.o.x, it.o.y);
    else if (it.draw) it.draw(g);
    else if (it.remote) { const r = it.remote; drawPerson(g, t, r.id, r.x, r.y, r.dir, r.mode, r.animT, r.alpha); }
    else if (it.enemy) {
      const e = it.enemy; drawPerson(g, t, e.sprite, e.x, e.y, e.dir, e.mode, e.animT);
      if (e.alert > 0.6 && e.stun <= 0) { R(g, e.x - 4, e.y - 70, 8, 12, '#1c1f27'); R(g, e.x - 3, e.y - 69, 6, 10, '#ffd23a'); R(g, e.x - 1, e.y - 67, 2, 5, '#1c1f27'); R(g, e.x - 1, e.y - 61, 2, 2, '#1c1f27'); }
    }
    else if (it.npc) { if (SPR[NPC_ID]) drawPerson(g, t, NPC_ID, (HUB_NPC.tx + 0.5) * T, (HUB_NPC.ty + 1) * T - 2, 'down', 'stand', 0); }
    else {
      const kind = dun.hero.cls.weapon.kind, P = Battle.heroPose(t, w); // fighting poses during battles
      const fr = w.mode === 'walk' ? frame(w.id, 'walk', w.dir, Math.floor(w.animT)) : frame(w.id, 'stand', w.dir, Math.floor(t * 1.4) % 2);
      for (const tr of Battle.heroTrail()) Battle.paintGhost(g, fr, tr.x, tr.y, dun.hero.cls.color, tr.a);
      const wpn = () => drawWeapon(g, w, P ? P.swing : 0, kind, t);
      Battle.paintFighter(g, fr, w.x, w.y, P, w.alpha, w.dir === 'up' ? wpn : null, w.dir !== 'up' ? wpn : null);
    }
  }
  Battle.drawBattleWorld(g, t);
  if (S.kind === 'hub') {
    // neon sign over the door
    const on = (t * 3 | 0) % 17 !== 0, cx = (HUB_DOOR.x0 + HUB_DOOR.x1) / 2;
    g.fillStyle = on ? 'rgba(255,61,127,.25)' : 'rgba(255,61,127,.08)'; g.fillRect(cx - 52, 2, 104, 18);
    R(g, cx - 46, 5, 92, 13, '#1a0610'); center(g, 'RESENHA', cx, 8, on ? '#ff6fa3' : '#7a2a4a', 2);
    const sx = SPK.x - 9, sy = SPK.y - 46, live = Music.music.explore && Music.playing();
    R(g, SPK.x - 2, SPK.y - 18, 4, 2, live ? '#4fd18b' : '#5a1414');
    if (live) for (let k = 0; k < 5; k++) { const hgt = 2 + Math.round(5 * Math.abs(Math.sin(t * (5 + k) + k * 1.7))); R(g, sx + k * 4, sy + 8 - hgt, 3, hgt, ['#ff6fa3', '#f2c14e', '#4fd18b', '#9fd3ff', '#ff6fa3'][k]); }
  } else {
    const dn = S.down; // bobbing marker over the way down
    if (S.seen[dn.ty][dn.tx]) { const y = dn.ty * T - 14 + Math.sin(t * 4) * 3; g.fillStyle = '#ff3b3b'; g.beginPath(); g.moveTo(dn.tx * T + 8, y); g.lineTo(dn.tx * T + 24, y); g.lineTo(dn.tx * T + 16, y + 9); g.fill(); }
  }
  // lighting: dark room with warm lamp pools and a light around you
  const W = S.w * T, H = S.h * T;
  if (!dark || dark.width !== W || dark.height !== H) [dark, dg] = cv(W, H);
  dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, W, H);
  dg.fillStyle = S.kind === 'hub' ? 'rgba(4,2,8,.4)' : 'rgba(2,3,6,.5)'; dg.fillRect(0, 0, W, H);
  dg.globalCompositeOperation = 'destination-out';
  const glow = (x, y, r, a) => { const gr = dg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.fillRect(x - r, y - r, r * 2, r * 2); };
  glow(w.x, w.y - 20, S.kind === 'hub' ? 240 : 280, 1);
  for (const [x, y, k] of S.lamps) glow(x, k ? y : y + 40, k === 'shade' ? 140 : 170, 0.9);
  if (Battle.battle.active) glow(w.x, w.y - 10, 340, 0.9);
  if (S.kind === 'dungeon') { glow((S.down.tx + 0.5) * T, (S.down.ty + 0.5) * T, 60, 0.7); glow((S.up.tx + 0.5) * T, (S.up.ty + 0.5) * T, 50, 0.6); }
  g.drawImage(dark, 0, 0);
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, k] of S.lamps) {
    const cy = k ? y : y + 30, warm = k || S.kind !== 'hub', gr = g.createRadialGradient(x, cy, 0, x, cy, 90);
    gr.addColorStop(0, k === 'shade' ? 'rgba(255,200,120,.22)' : warm ? 'rgba(255,190,110,.12)' : 'rgba(255,90,150,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 90, cy - 90, 180, 180);
  }
  g.globalCompositeOperation = 'source-over';
  for (const [x, y, k] of S.lamps) if (!k) { R(g, x - 5, y - 2, 10, 4, '#2a2c30'); R(g, x - 3, y + 2, 6, 2, S.kind === 'hub' ? '#ff9cc2' : '#ffe0a0'); }
  if (swap > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, swap / 0.25)})`; g.fillRect(0, 0, W, H); }
  g.restore();
}

/* ---------------- HUD (screen space) ---------------- */
function arrow(ctx, x, y, dir, s, col) {
  const a = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir];
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, -s - 1.5); ctx.lineTo(s + 1.5, s + 1.5); ctx.lineTo(-s - 1.5, s + 1.5); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(0, s * 0.45); ctx.lineTo(-s, s); ctx.fill();
  ctx.restore();
}
function minimap(ctx, vw, vh, t) {
  const S = dun.scene, w = dun.walker, small = vw < 600;
  const X = 12, Y = small ? 52 : 70, MW = small ? 150 : 200, MH = small ? 120 : 160, cell = small ? 3 : 4;
  // location label with a pin, then the progress diamonds
  ctx.font = `600 ${small ? 12 : 15}px "Pixelify Sans", system-ui, sans-serif`; ctx.textBaseline = 'middle';
  const label = S.kind === 'hub' ? 'Sala da Resenha' : `Resenha B${S.depth}F`;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(X, Y, MW, 40);
  ctx.strokeStyle = '#e9eef7'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X + 12, Y + 10, 5, Math.PI, 0); ctx.lineTo(X + 12, Y + 19); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = '#e9eef7'; ctx.fillText(label, X + 24, Y + 12);
  for (let i = 0; i < 12; i++) { const dx = X + 12 + i * 11, dy = Y + 30; ctx.fillStyle = i < Math.max(1, S.depth || 0) ? '#f2c14e' : '#4a4f59'; ctx.beginPath(); ctx.moveTo(dx, dy - 4); ctx.lineTo(dx + 4, dy); ctx.lineTo(dx, dy + 4); ctx.lineTo(dx - 4, dy); ctx.fill(); }
  // the map box, centred on you
  const bx = X, by = Y + 44;
  ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(bx, by, MW, MH);
  ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, MW - 1, MH - 1);
  ctx.save(); ctx.beginPath(); ctx.rect(bx + 1, by + 1, MW - 2, MH - 2); ctx.clip();
  const ptx = w.x / T, pty = (w.y - 8) / T, ox = bx + MW / 2 - ptx * cell, oy = by + MH / 2 - pty * cell;
  ctx.fillStyle = '#9da2aa';
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const walk = !S.solid[y][x] || (S.props && S.props.some(p => p.tx === x && p.ty === y));
    if (walk && (!S.seen || S.seen[y][x])) ctx.fillRect(Math.floor(ox + x * cell), Math.floor(oy + y * cell), cell, cell);
  }
  if (S.kind === 'dungeon') {
    const mark = (tile, col) => { const mx = ox + (tile.tx + 0.5) * cell, my = oy + (tile.ty + 0.5) * cell; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(mx - 4, my - 5); ctx.lineTo(mx + 4, my - 5); ctx.lineTo(mx - 4, my + 5); ctx.lineTo(mx + 4, my + 5); ctx.fill(); };
    if (S.seen[S.down.ty][S.down.tx]) mark(S.down, '#ff3b3b');
    ctx.fillStyle = '#ff4040';
    for (const e of S.enemies) if (Math.hypot(e.x - w.x, e.y - w.y) < 8 * T) { ctx.beginPath(); ctx.arc(ox + e.x / T * cell, oy + (e.y - 8) / T * cell, cell * 0.9, 0, Math.PI * 2); ctx.fill(); }
    mark(S.up, '#4fd18b');
  } else {
    ctx.strokeStyle = '#ff3d7f'; ctx.lineWidth = 2; const mx = ox + 9 * cell, my = oy + 1.6 * cell; ctx.beginPath(); ctx.moveTo(mx - 6, my + 4); ctx.lineTo(mx, my - 2); ctx.lineTo(mx + 6, my + 4); ctx.stroke();
  }
  arrow(ctx, bx + MW / 2, by + MH / 2, w.dir, small ? 5 : 6, '#f2c14e');
  ctx.restore();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(bx + MW / 2, by, 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a8f99'; ctx.stroke();
  ctx.fillStyle = '#e9eef7'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', bx + MW / 2, by + 1); ctx.textAlign = 'left';
}
function statusCard(ctx, vw, vh) {
  const w = dun.walker, h = dun.hero, small = vw < 600, s = small ? 0.75 : 1;
  const CWd = 320 * s, CHt = 100 * s, x = vw - CWd - 12, y = vh - CHt - 12;
  const font = (wt, px) => `${wt} ${px * s}px "Pixelify Sans", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,.88)'; ctx.beginPath(); ctx.moveTo(x + 18 * s, y); ctx.lineTo(x + CWd, y); ctx.lineTo(x + CWd - 18 * s, y + CHt); ctx.lineTo(x, y + CHt); ctx.closePath(); ctx.fill();
  const p = portraits[w.id] || (portraits[w.id] = portrait(w.id, 76));
  ctx.imageSmoothingEnabled = false; ctx.drawImage(p, x + 16 * s, y + 6 * s, 70 * s, 70 * s);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f2c14e'; ctx.font = font(700, 12); ctx.fillText(`Lv. ${h.level}`, x + 18 * s, y + 92 * s);
  ctx.fillStyle = '#2a2d34'; ctx.fillRect(x + 54 * s, y + 86 * s, 34 * s, 4 * s); ctx.fillStyle = '#f2c14e'; ctx.fillRect(x + 54 * s, y + 86 * s, 34 * s * (h.xp / xpToNext(h.level)), 4 * s);
  const tx = x + 98 * s, bw = 190 * s;
  ctx.fillStyle = '#cfd3da'; ctx.font = font(600, 11);
  let title = `${w.a.short} · ${h.cls.name} R${h.job.rank} · ${h.cls.weapon.name}`;
  if (ctx.measureText(title).width > CWd - 120 * s) title = `${w.a.short} · ${h.cls.name} R${h.job.rank}`;
  ctx.fillText(title, tx, y + 16 * s);
  ctx.font = font(700, 28); ctx.fillStyle = '#ffffff'; ctx.fillText(String(h.hp), tx, y + 44 * s);
  const hw = ctx.measureText(String(h.hp)).width; ctx.font = font(600, 13); ctx.fillStyle = '#9aa1ac'; ctx.fillText(`/ ${h.maxHp}`, tx + hw + 6 * s, y + 44 * s);
  ctx.fillStyle = '#4a1010'; ctx.fillRect(tx, y + 50 * s, bw, 7 * s); ctx.fillStyle = h.hp / h.maxHp < 0.3 ? '#ff5a3a' : '#e03a3a'; ctx.fillRect(tx, y + 50 * s, bw * h.hp / h.maxHp, 7 * s);
  ctx.font = font(700, 18); ctx.fillStyle = '#4fe0d0'; ctx.fillText(String(h.mp), tx, y + 78 * s);
  const mw = ctx.measureText(String(h.mp)).width; ctx.font = font(600, 11); ctx.fillStyle = '#7fb7b1'; ctx.fillText(`/ ${h.maxMp} MP`, tx + mw + 5 * s, y + 78 * s);
  ctx.fillStyle = '#103634'; ctx.fillRect(tx, y + 83 * s, bw * 0.7, 5 * s); ctx.fillStyle = '#3fc9bb'; ctx.fillRect(tx, y + 83 * s, bw * 0.7 * h.mp / h.maxMp, 5 * s);
  if (h.money) { ctx.font = font(600, 11); ctx.fillStyle = '#f2c14e'; ctx.textAlign = 'right'; ctx.fillText(`R$ ${h.money}`, x + CWd - 26 * s, y + 92 * s); ctx.textAlign = 'left'; }
}
export function drawDunHud(ctx, vw, vh, t, toScreen) {
  if (!dun.active) return;
  const S = dun.scene, w = dun.walker;
  // the host says hi when you're close
  if (S.kind === 'hub') {
    const nx = (HUB_NPC.tx + 0.5) * T, ny = (HUB_NPC.ty + 1) * T;
    if (Math.hypot(w.x - nx, w.y - ny) < 80) {
      const p = toScreen(nx, ny - 62), lines = ['Fala! Bem-vindo à Resenha.', 'Entra pela porta e acha a escada', 'pra descer cada andar.'];
      ctx.font = '600 12px "Pixelify Sans", system-ui, sans-serif'; ctx.textBaseline = 'middle';
      const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 20, bh = lines.length * 16 + 10;
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(p.x - bw / 2, p.y - bh, bw, bh, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y); ctx.lineTo(p.x, p.y + 6); ctx.fill();
      ctx.fillStyle = '#1c1f27'; lines.forEach((l, i) => ctx.fillText(l, p.x - bw / 2 + 10, p.y - bh + 13 + i * 16));
    }
  }
  if (S.kind === 'hub' && (speakerFlash > 0 || Math.hypot(w.x - SPK.x, w.y - SPK.y) < 90)) {
    const p = toScreen(SPK.x, SPK.y - 52), n = Music.music.explore;
    const title = n ? '♪ ' + Music.EXPLORE[n - 1] : 'Som desligado', hint = 'clique na caixinha pra trocar';
    ctx.textBaseline = 'middle';
    ctx.font = '700 14px "Pixelify Sans", system-ui, sans-serif'; const tw = ctx.measureText(title).width;
    ctx.font = '600 10px "Pixelify Sans", system-ui, sans-serif'; const hw = ctx.measureText(hint).width;
    const bw = Math.max(tw, hw) + 24, bh = 40;
    ctx.fillStyle = 'rgba(12,8,14,.92)'; ctx.beginPath(); ctx.roundRect(p.x - bw / 2, p.y - bh, bw, bh, 7); ctx.fill();
    ctx.strokeStyle = n ? '#ff3d7f' : '#5d6470'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = '700 14px "Pixelify Sans", system-ui, sans-serif'; ctx.fillStyle = n ? '#ffb3cf' : '#9aa1ac'; ctx.fillText(title, p.x - bw / 2 + 12, p.y - bh + 14);
    ctx.font = '600 10px "Pixelify Sans", system-ui, sans-serif'; ctx.fillStyle = '#9aa1ac'; ctx.fillText(hint, p.x - bw / 2 + 12, p.y - bh + 30);
  }
  minimap(ctx, vw, vh, t);
  statusCard(ctx, vw, vh);
  Battle.drawBattleHud(ctx, vw, vh, t, toScreen);
  if (banner) {
    const a = Math.min(1, banner.t / 0.4, (2.2 - banner.t) / 0.3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = '700 28px "Pixelify Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(vw / 2 - 170, vh * 0.28 - 26, 340, 52);
    ctx.fillStyle = '#f2c14e'; ctx.fillText(banner.text, vw / 2, vh * 0.28);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}
export const npcName = 'Anfitrião';
export const npcHead = () => (dun.scene?.kind === 'hub' && SPR[NPC_ID] ? { x: (HUB_NPC.tx + 0.5) * T, y: (HUB_NPC.ty + 1) * T - SPR[NPC_ID].meta.down.h - 6 } : null);

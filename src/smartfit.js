// Smart Fit Av. João Câncio, inside (layout and look taken from the gym's 360° tour).
// Ground floor: glass front with the entrance, reception (black/yellow desk, turnstiles, lockers, double-height
// ceiling), Smart Spa, musculação (Matrix machines) and peso livre (rubber floor, racks, plate-loaded machines).
// First floor (mezzanine, blue-lit ceiling): cardio with treadmills facing the railing over the reception,
// ellipticals and bikes, spinning, lockers and the sala de ginástica (mirrors, wooden stage, blue rings).
// Stairs on the left wall link the floors; the front door goes back out to the street.
import { T, findPath } from './world.js';
import { cv, R, pe, shadow, shade, ptext, ptextW, OUT } from './art.js';
import { CW, FOOT, SPR, frame } from './sprites.js';

export const GMW = 30, GMH = 18, GW = GMW * T, GH = GMH * T;
const WALK = 74, RUN = 146;
const Y = '#f5c400', YD = '#c99a00', YL = '#ffd84a', BLK = '#16171b', BLK2 = '#24262c', BLK3 = '#33363d';
const DOOR = { x0: 6 * T, x1: 8 * T };                 // entrance, ground floor front wall
// Stairs (cols 1-2, rows 10-15, same spot on both floors). Ground floor: you go up by stepping onto the bottom
// step from below (row 16); the rest is solid, so you can't walk over the flight. First floor: the stairwell is
// fenced off except its top step at col 2, which you reach from the right (col 3); walk left onto it to go down.
const STAIRS = { x0: 1, x1: 2, top: 10, bottom: 15 };
const VOID = { x0: 1, x1: 11, y0: 2, y1: 7 };          // first floor opening over the reception
const BASEMENT = { x0: 27, x1: 28, top: 15, bottom: 16 }; // ground floor stairs down (end of the peso livre): walk down into them

/* ---------------- small painters ---------------- */
const center = (g, s, cx, y, col, sc = 1) => ptext(g, s, Math.round(cx - ptextW(s, sc) / 2), y, col, sc);
function logo(g, x, y, sc = 1) { // "smart" white + "fit" yellow with the smile under it
  ptext(g, 'SMART', x, y, '#ffffff', sc);
  const fx = x + ptextW('SMART', sc) + 3 * sc;
  ptext(g, 'FIT', fx, y, Y, sc);
  R(g, fx, y + 6 * sc, ptextW('FIT', sc), sc, Y); R(g, fx + ptextW('FIT', sc) - sc, y + 5 * sc, sc, sc, Y);
}
function woodFloor(g, x0, y0, w, h, seed) {
  const tones = ['#b98a52', '#b2834c', '#c09258', '#ab7d48'];
  for (let y = y0; y < y0 + h; y += 8) {
    const row = (y / 8) | 0;
    R(g, x0, y, w, 8, tones[(row + seed) % 4]); R(g, x0, y + 7, w, 1, '#8f6537');
    for (let x = x0 + ((row * 37) % 48); x < x0 + w; x += 48) R(g, x, y, 1, 7, '#8f6537');
  }
}
function rubberFloor(g, x0, y0, w, h) {
  R(g, x0, y0, w, h, '#3a3d44');
  for (let y = y0; y < y0 + h; y += 32) for (let x = x0; x < x0 + w; x += 32) {
    R(g, x, y, 32, 1, '#30333a'); R(g, x, y, 1, 32, '#30333a');
    for (let k = 0; k < 10; k++) R(g, x + ((x * 7 + y * 3 + k * 11) % 30) + 1, y + ((x * 5 + k * 13) % 30) + 1, 1, 1, '#444851');
  }
}
function frontWall(g, upper) {
  R(g, 0, 0, GW, 2 * T, BLK); R(g, 0, 0, GW, 4, '#2a2c33'); R(g, 0, 4, GW, 2, YD);
  R(g, 0, 2 * T - 6, GW, 6, '#0e0f12');
  if (!upper) { // glass storefront looking out to the avenue at night
    R(g, T, 10, GW - 2 * T, 2 * T - 18, '#0c1626');
    for (let x = T; x < GW - T; x += 48) { R(g, x, 10, 2, 2 * T - 18, '#05080e'); R(g, x + 8, 14, 3, 2 * T - 26, 'rgba(255,255,255,.07)'); }
    for (let x = T + 20; x < GW - T; x += 90) { pe(g, x, 26, 3, 3, '#ffe9a8'); R(g, x - 1, 29, 2, 14, '#2a3140'); }
    R(g, T, 2 * T - 14, GW - 2 * T, 4, '#1e2b3d');
    // entrance: glass double door under a yellow portal
    R(g, DOOR.x0 - 6, 6, DOOR.x1 - DOOR.x0 + 12, 2 * T - 6, Y); R(g, DOOR.x0 - 6, 6, DOOR.x1 - DOOR.x0 + 12, 2, YL);
    R(g, DOOR.x0, 12, DOOR.x1 - DOOR.x0, 2 * T - 12, '#122033'); R(g, DOOR.x0 + T - 1, 12, 2, 2 * T - 12, '#05080e');
    R(g, DOOR.x0 + T - 7, 30, 2, 14, '#c9ced6'); R(g, DOOR.x0 + T + 5, 30, 2, 14, '#c9ced6');
    R(g, DOOR.x0 + 6, 16, 4, 2 * T - 24, 'rgba(255,255,255,.12)');
  } else { // dark wall with a blue LED strip
    R(g, 0, 18, GW, 2, '#3d7bff'); R(g, 0, 20, GW, 2, 'rgba(61,123,255,.35)');
  }
}
function sideWalls(g) {
  R(g, 18, 0, 14, GH, '#2a2c33'); R(g, 30, 0, 2, GH, '#3a3d45');
  R(g, GW - T, 0, 14, GH, '#2a2c33'); R(g, GW - T, 0, 2, GH, '#3a3d45');
  R(g, 0, 17 * T, GW, 16, '#2a2c33'); R(g, 0, 17 * T, GW, 2, '#3a3d45'); R(g, 0, 17 * T + 16, GW, GH - 17 * T - 16, '#0a1120');
}
function zoneSign(g, cx, y, text, dark) { // hanging sign seen from below, drawn over everything
  const w = ptextW(text) + 14;
  R(g, cx - w / 2 - 1, y - 1, w + 2, 13, OUT); R(g, cx - w / 2, y, w, 11, dark ? BLK : Y);
  center(g, text, cx, y + 3, dark ? Y : BLK);
  R(g, cx - w / 2 + 3, y - 10, 1, 9, '#5d6470'); R(g, cx + w / 2 - 4, y - 10, 1, 9, '#5d6470');
}

/* sprites (each painted into its own canvas; foot = bottom of the footprint) */
function matrixMachine(g) { // 32x56, selectorized, black with yellow details
  shadow(g, 2, 46, 28, 8, 0.3);
  R(g, 4, 4, 11, 46, OUT); R(g, 5, 5, 9, 44, BLK2); R(g, 5, 5, 9, 2, BLK3);
  R(g, 6, 14, 7, 22, '#0d0e11'); for (let k = 0; k < 7; k++) R(g, 6, 15 + k * 3, 7, 1, '#2e3138');
  R(g, 7, 9, 5, 2, Y); R(g, 7, 38, 5, 6, '#0d0e11'); R(g, 8, 39, 3, 1, Y);
  R(g, 14, 32, 16, 5, OUT); R(g, 15, 33, 14, 3, '#2b2d33');
  R(g, 16, 25, 12, 8, '#1c1d22'); R(g, 16, 25, 12, 1, BLK3);
  R(g, 25, 12, 4, 21, '#1c1d22'); R(g, 25, 12, 4, 1, BLK3); R(g, 22, 16, 9, 2, '#4a4e57');
  R(g, 14, 46, 16, 3, '#0d0e11'); R(g, 4, 50, 11, 2, '#0d0e11');
}
function treadmill(g) { // 32x72, console towards the top (facing the railing)
  shadow(g, 2, 58, 28, 12, 0.3);
  R(g, 5, 18, 22, 48, OUT); R(g, 6, 19, 20, 46, '#2a2c32'); R(g, 9, 22, 14, 42, '#121316');
  for (let y = 26; y < 62; y += 6) R(g, 9, y, 14, 1, '#1d1f24');
  R(g, 6, 19, 2, 46, '#55595f'); R(g, 24, 19, 2, 46, '#55595f'); R(g, 9, 62, 14, 2, Y);
  R(g, 6, 6, 2, 14, '#6b7078'); R(g, 24, 6, 2, 14, '#6b7078');
  R(g, 3, 2, 26, 10, OUT); R(g, 4, 3, 24, 8, '#3a3d45'); R(g, 8, 4, 16, 5, '#2d6cdf'); R(g, 9, 5, 6, 1, '#9fd3ff');
}
function elliptical(g) { // 32x56
  shadow(g, 3, 44, 26, 10, 0.3);
  R(g, 10, 20, 12, 30, OUT); R(g, 11, 21, 10, 28, '#2e3036'); R(g, 7, 30, 6, 4, '#55595f'); R(g, 19, 36, 6, 4, '#55595f');
  R(g, 8, 6, 2, 22, '#8a9098'); R(g, 22, 6, 2, 22, '#8a9098'); R(g, 11, 4, 10, 7, OUT); R(g, 12, 5, 8, 4, '#2d6cdf');
  pe(g, 16, 46, 7, 4, '#1c1d22'); R(g, 12, 45, 8, 2, Y);
}
function bike(g, spin) { // 32x48
  shadow(g, 4, 38, 24, 8, 0.3);
  R(g, 14, 18, 4, 22, '#3a3d45'); R(g, 9, 38, 14, 3, '#1c1d22');
  if (spin) { pe(g, 16, 30, 6, 6, '#c3c8ce'); pe(g, 16, 30, 3, 3, '#6b7078'); }
  else { R(g, 11, 26, 10, 10, OUT); R(g, 12, 27, 8, 8, '#2e3036'); R(g, 13, 28, 6, 2, Y); }
  R(g, 10, 14, 12, 4, OUT); R(g, 11, 15, 10, 2, '#24262c');
  R(g, 13, 4, 6, 6, OUT); R(g, 14, 5, 4, 3, spin ? '#55595f' : '#2d6cdf'); R(g, 15, 9, 2, 6, '#6b7078');
}
function plateMachine(g) { // 32x56, yellow plate-loaded frame
  shadow(g, 1, 44, 30, 10, 0.3);
  R(g, 3, 8, 4, 42, OUT); R(g, 4, 9, 2, 40, Y); R(g, 25, 8, 4, 42, OUT); R(g, 26, 9, 2, 40, Y);
  R(g, 3, 6, 26, 5, OUT); R(g, 4, 7, 24, 3, Y); R(g, 4, 7, 24, 1, YL);
  R(g, 10, 28, 12, 6, '#1c1d22'); R(g, 10, 14, 4, 15, '#1c1d22');
  pe(g, 5, 30, 4, 6, '#0d0e11'); pe(g, 27, 30, 4, 6, '#0d0e11'); R(g, 4, 46, 24, 3, '#0d0e11');
}
function powerRack(g) { // 64x88 (2x2 footprint)
  shadow(g, 2, 74, 60, 12, 0.3);
  for (const x of [6, 54]) { R(g, x, 4, 5, 78, OUT); R(g, x + 1, 5, 3, 76, '#2a2c32'); }
  for (const x of [6, 54]) { R(g, x, 34, 5, 50, OUT); R(g, x + 1, 35, 3, 48, '#1c1d22'); }
  R(g, 6, 2, 53, 4, OUT); R(g, 7, 3, 51, 2, '#3a3d45');
  R(g, 0, 30, 64, 3, '#9aa0a8'); pe(g, 4, 31, 3, 8, Y); pe(g, 60, 31, 3, 8, Y); pe(g, 4, 31, 1, 6, '#0d0e11'); pe(g, 60, 31, 1, 6, '#0d0e11');
  R(g, 24, 54, 16, 22, '#1c1d22'); R(g, 24, 54, 16, 1, BLK3); R(g, 4, 82, 56, 4, '#0d0e11');
}
function bench(g) { // 32x40
  shadow(g, 4, 30, 24, 8, 0.3);
  R(g, 10, 6, 12, 28, OUT); R(g, 11, 7, 10, 26, '#1c1d22'); R(g, 11, 7, 10, 2, BLK3); R(g, 8, 32, 16, 3, '#55595f');
}
function dumbbellRack(g, w) { // w x 44
  shadow(g, 2, 34, w - 4, 10, 0.3);
  R(g, 2, 10, w - 4, 28, OUT); R(g, 3, 11, w - 6, 26, '#2a2c32');
  for (const yy of [13, 25]) { R(g, 3, yy + 9, w - 6, 2, '#1c1d22'); for (let x = 6; x < w - 8; x += 9) { R(g, x, yy, 3, 7, '#0d0e11'); R(g, x + 3, yy + 2, 2, 3, Y); R(g, x + 5, yy, 3, 7, '#0d0e11'); } }
}
function massageChair(g) { // 32x48
  shadow(g, 3, 38, 26, 8, 0.3);
  R(g, 6, 4, 20, 22, OUT); R(g, 7, 5, 18, 20, '#1c1d22'); R(g, 9, 7, 14, 2, '#3a3d45');
  R(g, 4, 24, 24, 14, OUT); R(g, 5, 25, 22, 12, '#24262c'); R(g, 5, 25, 4, 12, '#3a3d45'); R(g, 23, 25, 4, 12, '#3a3d45');
  R(g, 10, 38, 12, 6, '#1c1d22');
}
function pillar(g) { // 32x72 yellow column, black base
  shadow(g, 2, 62, 28, 8, 0.3);
  R(g, 8, 0, 16, 66, OUT); R(g, 9, 1, 14, 64, Y); R(g, 9, 1, 3, 64, YL); R(g, 20, 1, 3, 64, YD);
  R(g, 8, 60, 16, 6, BLK); R(g, 13, 20, 6, 4, '#1f7a3a'); R(g, 14, 21, 4, 2, '#ffffff');
}
function lockers(g, w) { // w x 56, yellow cubbies
  shadow(g, 0, 48, w, 8, 0.3);
  R(g, 0, 2, w, 50, OUT); R(g, 1, 3, w - 2, 48, Y);
  for (let x = 1; x < w - 1; x += 16) for (let y = 3; y < 50; y += 12) { R(g, x, y, 16, 1, YD); R(g, x, y, 1, 12, YD); R(g, x + 11, y + 5, 2, 2, '#1c1d22'); }
  R(g, 1, 3, w - 2, 1, YL);
}

/* ---------------- floors ---------------- */
function makeFloor(upper) {
  const solid = Array.from({ length: GMH }, (_, y) => Array.from({ length: GMW }, (_, x) => (y < 2 || y > 16 || x < 1 || x > 28 ? 1 : 0)));
  const block = (tx, ty, w = 1, h = 1) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) solid[y][x] = 1; };
  const objs = [], signs = [];
  const obj = (x, y, w, h, sortY, paint) => { const [c, g] = cv(w, h); paint(g); objs.push({ x, y, sortY, c }); };
  const at = (tx, ty, w, h, paint, fw = 1, fh = 1) => obj(tx * T + (fw * T - w) / 2, (ty + fh) * T - h, w, h, (ty + fh) * T, paint);
  const [bg, g] = cv(GW, GH);
  R(g, 0, 0, GW, GH, '#0a1120');
  return { upper, solid, block, objs, signs, obj, at, bg, g };
}

function buildGround() {
  const F = makeFloor(false), { g, block, at, obj } = F;
  woodFloor(g, T, 2 * T, 17 * T, 15 * T, 0);
  rubberFloor(g, 18 * T, 2 * T, 11 * T, 15 * T);
  R(g, 18 * T, 2 * T, 2, 15 * T, '#8f6537');
  // reception: entrance mat, logo wall, desk, lockers, turnstile line
  R(g, DOOR.x0 + 2, 2 * T + 2, DOOR.x1 - DOOR.x0 - 4, 26, '#25272d'); logo(g, DOOR.x0 + 8, 2 * T + 12);
  frontWall(g, false); sideWalls(g);
  // stairs going up towards the front (top step = row 10)
  for (let ty = STAIRS.bottom; ty >= STAIRS.top; ty--) {
    const y = ty * T, k = STAIRS.bottom - ty;
    R(g, STAIRS.x0 * T, y, 2 * T, T, shade('#6b6f78', 0.06 * k)); R(g, STAIRS.x0 * T, y, 2 * T, 3, shade('#8a9098', 0.06 * k));
    R(g, STAIRS.x0 * T, y + T - 4, 2 * T, 4, '#3a3d45'); R(g, STAIRS.x0 * T + 2, y + 4, 2 * T - 4, 2, Y);
  }
  R(g, (STAIRS.x1 + 1) * T - 3, STAIRS.top * T, 3, 6 * T, '#c9ced6'); // handrail
  R(g, STAIRS.x0 * T, STAIRS.top * T, 2 * T, 3, '#c9ced6');               // guard at the top end
  ptext(g, 'SOBE', STAIRS.x0 * T + 18, 16 * T + 10, '#ffffff');
  block(STAIRS.x0, STAIRS.top, 2, STAIRS.bottom - STAIRS.top); // only the bottom step is walkable
  // logo wall behind the desk (cols 1-4, row 3)
  block(1, 3, 4, 1);
  at(1, 3, 4 * T, 70, c => {
    R(c, 0, 0, 4 * T, 70, '#4a4e57'); R(c, 0, 0, 4 * T, 2, '#6b7078'); R(c, 0, 66, 4 * T, 4, '#2a2c33');
    R(c, 16, 16, 96, 22, BLK); logo(c, 26, 22, 2);
    R(c, 104, 46, 10, 12, '#e8622a'); R(c, 12, 46, 14, 10, '#f2efe8');
  }, 4, 1);
  // angled black desk with the yellow front (cols 2-4, row 5)
  block(2, 5, 3, 1);
  at(2, 5, 3 * T, 52, c => {
    shadow(c, 0, 40, 3 * T, 12, 0.3);
    R(c, 0, 8, 3 * T, 18, OUT); R(c, 1, 9, 3 * T - 2, 16, BLK2); R(c, 1, 9, 3 * T - 2, 2, BLK3);
    c.fillStyle = OUT; c.beginPath(); c.moveTo(0, 24); c.lineTo(3 * T, 24); c.lineTo(3 * T - 10, 48); c.lineTo(8, 48); c.fill();
    c.fillStyle = BLK; c.beginPath(); c.moveTo(1, 25); c.lineTo(3 * T - 1, 25); c.lineTo(3 * T - 11, 47); c.lineTo(9, 47); c.fill();
    c.fillStyle = Y; c.beginPath(); c.moveTo(36, 25); c.lineTo(3 * T - 1, 25); c.lineTo(3 * T - 11, 47); c.lineTo(52, 47); c.fill();
    R(c, 14, 0, 18, 12, OUT); R(c, 15, 1, 16, 9, '#2d6cdf'); R(c, 60, 4, 16, 8, Y);
  }, 3, 1);
  // lockers on the left wall (cols 1-2, row 7)
  block(1, 7, 2, 1); at(1, 7, 2 * T, 56, c => lockers(c, 2 * T), 2, 1);
  // railing with turnstiles on row 8 (cols 1-11); the turnstiles (7-9) let you through
  for (let tx = 1; tx <= 11; tx++) if (tx < 7 || tx > 9) block(tx, 8);
  obj(T, 8 * T - 14, 11 * T, 30, 8 * T + 10, c => {
    R(c, 0, 2, 11 * T, 3, '#c9ced6'); R(c, 0, 4, 11 * T, 1, '#8a9098');
    for (let x = 0; x <= 11 * T; x += 32) if (x < 6 * T - 4 || x > 9 * T + 4) R(c, x, 4, 2, 24, '#8a9098');
    for (let x = 4; x < 11 * T; x += 32) if (x < 6 * T - 8 || x > 9 * T) R(c, x, 8, 26, 18, 'rgba(180,215,235,.25)');
    for (const x of [6 * T - 10, 9 * T + 2]) { R(c, x, 4, 8, 24, OUT); R(c, x + 1, 5, 6, 22, BLK2); R(c, x + 1, 8, 6, 2, '#4fd18b'); } // open gates, out of the way
  });
  // Smart Spa: frosted partitions (cols 12 and 16, row 6 with the door at col 14), wood inside, massage chairs
  woodFloor(g, 13 * T, 2 * T, 3 * T, 4 * T, 2);
  R(g, 13 * T, 2 * T, 3 * T, 4 * T, 'rgba(120,70,20,.18)');
  // col 12 down to row 7 also closes the reception, so the only way in is through the turnstiles
  block(12, 2, 1, 6); block(16, 2, 1, 5); block(12, 6, 2, 1); block(15, 6, 2, 1);
  const frost = (x, y, w, h) => obj(x, y - 30, w, h + 30, y + h, c => { R(c, 0, 0, w, h + 30, '#5d6470'); R(c, 1, 1, w - 2, h + 28, 'rgba(225,232,236,.85)'); R(c, 1, 1, w - 2, 2, '#ffffff'); });
  frost(12 * T + 12, 2 * T, 8, 6 * T); frost(16 * T + 12, 2 * T, 8, 5 * T);
  // front partition (the frosted glass with the Smart Spa lotus), seen edge-on from above: thin, translucent
  obj(12 * T + 12, 6 * T + 6, 2 * T - 12, 28, 7 * T, c => { R(c, 0, 0, 2 * T - 12, 28, '#5d6470'); R(c, 1, 1, 2 * T - 14, 26, 'rgba(225,232,236,.55)'); center(c, 'SMART', (2 * T - 12) / 2, 6, '#5d6470'); center(c, 'SPA', (2 * T - 12) / 2, 14, '#3a3f48'); });
  obj(15 * T, 6 * T + 6, 2 * T - 12, 28, 7 * T, c => { R(c, 0, 0, 2 * T - 12, 28, '#5d6470'); R(c, 1, 1, 2 * T - 14, 26, 'rgba(225,232,236,.55)'); });
  for (const tx of [13, 14, 15]) { block(tx, 3); at(tx, 3, 32, 48, massageChair); }
  // musculação: three rows of Matrix machines, yellow columns in the aisle
  for (const ty of [10, 13, 15]) for (let tx = 4; tx <= 16; tx += 2) { block(tx, ty); at(tx, ty, 32, 56, matrixMachine); }
  for (const tx of [9, 15]) { block(tx, 12); at(tx, 12, 32, 72, pillar); }
  // peso livre: dumbbells under the front mirror, benches, power racks by the right wall, plate-loaded machines
  R(g, 19 * T, 2 * T - 4, 7 * T, 4, '#9fd3ff');
  block(19, 2, 7, 1); at(19, 2, 7 * T, 44, c => dumbbellRack(c, 7 * T), 7, 1);
  for (const tx of [20, 23]) { block(tx, 5); at(tx, 5, 32, 40, bench); }
  for (const ty of [3, 6, 9]) { block(26, ty, 2, 2); at(26, ty, 64, 88, powerRack, 2, 2); }
  for (const ty of [12, 15]) for (const tx of [19, 21, 23, 25]) { block(tx, ty); at(tx, ty, 32, 56, plateMachine); }
  for (const ty of [6, 11]) { block(18, ty); at(18, ty, 32, 72, pillar); }
  R(g, GW - T - 4, 3 * T, 4, 13 * T, '#9fd3ff'); R(g, GW - T - 6, 3 * T, 2, 13 * T, '#ffffff'); // mirror + LED strip
  // stairs down to the basement (the Resenha): hazard frame, steps going down towards the back wall
  { const x = BASEMENT.x0 * T, y = BASEMENT.top * T, w = 2 * T, h = 2 * T;
    R(g, x - 4, y - 4, w + 8, h + 4, '#e8b33a'); for (let k = 0; k < w + 8; k += 8) R(g, x - 4 + k, y - 4, 4, 4, '#1b1b1b');
    for (let k = 0; k < 8; k++) R(g, x, y + k * 8, w, 8, shade('#4a4e57', -0.09 * k));
    for (let k = 0; k < 8; k++) R(g, x, y + k * 8, w, 1, '#6b7078');
    R(g, x - 4, y, 3, h, '#c9ced6'); R(g, x + w + 1, y, 3, h, '#c9ced6');
  }
  F.signs.push([10 * T, 9 * T + 2, 'MUSCULACAO'], [23 * T, 7 * T + 8, 'PESO LIVRE'], [4 * T, 9 * T + 2, 'ESCADA', true], [28 * T, 14 * T + 4, 'SUBSOLO', true]);
  return F;
}

function buildUpper(ground) {
  const F = makeFloor(true), { g, block, at, obj } = F;
  woodFloor(g, T, 2 * T, 28 * T, 15 * T, 1);
  // the opening over the reception: the ground floor seen from above, darker, behind a glass railing
  const vx = VOID.x0 * T, vy = VOID.y0 * T, vw = (VOID.x1 - VOID.x0 + 1) * T, vh = (VOID.y1 - VOID.y0 + 1) * T;
  g.drawImage(ground.bg, vx, vy, vw, vh, vx, vy, vw, vh);
  for (const o of ground.objs) if (o.sortY <= (VOID.y1 + 2) * T && o.x < vx + vw) g.drawImage(o.c, o.x, o.y);
  R(g, vx, vy, vw, vh, 'rgba(4,8,20,.55)');
  block(VOID.x0, VOID.y0, VOID.x1 - VOID.x0 + 1, VOID.y1 - VOID.y0 + 1);
  frontWall(g, true); sideWalls(g);
  // stairwell going down (top step = row 10)
  for (let ty = STAIRS.top; ty <= STAIRS.bottom; ty++) {
    const k = ty - STAIRS.top;
    R(g, STAIRS.x0 * T, ty * T, 2 * T, T, shade('#6b6f78', -0.07 * k)); R(g, STAIRS.x0 * T, ty * T, 2 * T, 3, shade('#8a9098', -0.07 * k));
  }
  block(STAIRS.x0, STAIRS.top + 1, 2, STAIRS.bottom - STAIRS.top); // the flight below the top step
  block(STAIRS.x0, STAIRS.top);                                     // top step: only col 2, reached from the right
  block(STAIRS.x0, 8, 2, 2);                                        // fenced corner above the stairwell
  R(g, STAIRS.x0 * T, STAIRS.top * T - 3, 2 * T, 3, '#c9ced6');    // guard rail across the top
  ptext(g, 'DESCE', STAIRS.x1 * T + 4, STAIRS.top * T + 12, '#ffffff');
  R(g, STAIRS.x1 * T + 6, STAIRS.top * T + 22, 10, 2, Y); R(g, STAIRS.x1 * T + 6, STAIRS.top * T + 20, 2, 6, Y); // arrow pointing left
  obj((STAIRS.x1 + 1) * T - 4, (STAIRS.top + 1) * T - 18, 6, 5 * T + 18, (STAIRS.bottom + 1) * T, c => { R(c, 0, 0, 6, 5 * T + 18, '#8a9098'); R(c, 1, 0, 2, 5 * T + 18, '#c9ced6'); });
  // glass railing along the opening (row 8 edge and the right edge at col 12)
  obj(vx, 8 * T - 22, vw + 4, 26, 8 * T, c => {
    R(c, 0, 0, vw + 4, 3, '#c9ced6'); for (let x = 0; x <= vw; x += 32) R(c, x, 2, 2, 22, '#8a9098');
    R(c, 0, 4, vw + 4, 18, 'rgba(180,215,235,.25)');
  });
  for (let ty = VOID.y0; ty <= VOID.y1; ty++) obj((VOID.x1 + 1) * T - 2, ty * T - 22, 5, T + 22, (ty + 1) * T - 1, c => { R(c, 0, 0, 5, T + 22, 'rgba(180,215,235,.35)'); R(c, 0, 0, 2, T + 22, '#c9ced6'); });
  // cardio: treadmills facing the railing, a second row, ellipticals, bikes; TVs hanging over the first row
  for (let tx = 3; tx <= 11; tx++) { block(tx, 8, 1, 2); at(tx, 8, 32, 72, treadmill, 1, 2); }
  for (let tx = 4; tx <= 11; tx++) { block(tx, 11, 1, 2); at(tx, 11, 32, 72, treadmill, 1, 2); }
  for (const tx of [4, 6, 8, 10]) { block(tx, 14); at(tx, 14, 32, 56, elliptical); }
  for (let tx = 4; tx <= 11; tx++) { block(tx, 16); at(tx, 16, 32, 48, c => bike(c, false)); }
  for (const tx of [12]) for (const ty of [10, 14]) { block(tx, ty); at(tx, ty, 32, 72, pillar); }
  // sala de ginástica: glass wall on row 11 (door at col 16), left wall at col 13, stage, mirrors, blue rings
  R(g, 14 * T, 2 * T, 15 * T, 9 * T, 'rgba(10,14,30,.22)');
  R(g, 17 * T, 3 * T, 9 * T, 4 * T, '#8f6537'); woodFloor(g, 17 * T + 3, 3 * T + 3, 9 * T - 6, 4 * T - 8, 3); R(g, 17 * T, 7 * T - 5, 9 * T, 5, '#2a2c33');
  R(g, 14 * T, 2 * T - 4, 15 * T, 4, '#9fd3ff'); R(g, GW - T - 4, 2 * T, 4, 9 * T, '#9fd3ff');
  block(13, 2, 1, 10);
  obj(13 * T + 10, 2 * T - 30, 12, 10 * T + 30, 12 * T, c => { R(c, 0, 0, 12, 10 * T + 30, '#2a2c33'); R(c, 1, 0, 10, 10 * T + 30, '#3a3d45'); });
  for (let tx = 14; tx <= 28; tx++) if (tx !== 16) block(tx, 11);
  obj(14 * T, 11 * T - 6, 15 * T, 38, 12 * T, c => {
    for (const [a, b] of [[0, 2 * T], [3 * T, 15 * T]]) { R(c, a, 0, b - a, 38, '#3a3d45'); R(c, a, 2, b - a, 34, 'rgba(160,200,235,.35)'); R(c, a, 0, b - a, 3, '#c9ced6'); }
    R(c, 2 * T - 4, 0, 4, 38, Y); R(c, 3 * T, 0, 4, 38, Y); // open doorway with yellow jambs
    center(c, 'SALA DE', 9 * T, 10, '#ffffff'); center(c, 'GINASTICA', 9 * T, 18, Y);
  });
  block(27, 3, 1, 6); at(27, 3, 32, 6 * T, c => { R(c, 2, 4, 28, 6 * T - 6, OUT); R(c, 3, 5, 26, 6 * T - 8, '#2a2c32'); for (let y = 10; y < 6 * T - 8; y += 12) { R(c, 5, y, 22, 6, ['#3d7bff', Y, '#c9483b'][(y / 12 | 0) % 3]); } }, 1, 6);
  // spinning by the gym room, lockers along the back
  for (const ty of [13, 15]) for (const tx of [21, 23, 25, 27]) { block(tx, ty); at(tx, ty, 32, 48, c => bike(c, true)); }
  block(14, 16, 6, 1); at(14, 16, 6 * T, 56, c => lockers(c, 6 * T), 6, 1);
  F.signs.push([7 * T, 13 * T + 4, 'CARDIO'], [24 * T, 12 * T + 10, 'BICICLETAS', true]);
  F.tvs = [4, 7, 10].map(tx => ({ x: tx * T - 14, y: 7 * T - 12 }));
  F.rings = [[19 * T, 4 * T], [23 * T, 4 * T], [21 * T, 6 * T + 10]];
  return F;
}

/* ---------------- walker ---------------- */
class GymWalker {
  constructor(actor) { this.a = actor; this.id = actor.id; this.dir = 'down'; this.mode = 'stand'; this.path = []; this.animT = 0; this.alpha = 0; this.fade = 1; this.goOut = false; this.x = 0; this.y = 0; }
  get headX() { return this.x; }
  get headY() { return this.y - SPR[this.id].meta.down.h - 4; }
  setDir(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy) * 1.1) this.dir = dx < 0 ? 'left' : 'right';
    else if (Math.abs(dy) > 0.01) this.dir = dy < 0 ? 'up' : 'down';
  }
}
function blockedIn(F, x, y) {
  for (const [px, py] of [[x - 7, y - 7], [x + 6, y - 7], [x - 7, y - 1], [x + 6, y - 1]]) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= GMW || ty >= GMH || F.solid[ty][tx]) return true;
  }
  return false;
}
const atDoor = (gy, w) => gy.floor === 0 && w.x > DOOR.x0 + 6 && w.x < DOOR.x1 - 6 && w.y < 2 * T + 14;
const onBottomStep = w => w.x > STAIRS.x0 * T + 4 && w.x < (STAIRS.x1 + 1) * T - 4 && w.y > STAIRS.bottom * T + 4 && w.y < (STAIRS.bottom + 1) * T;
const onTopStep = w => w.x > STAIRS.x1 * T + 2 && w.x < (STAIRS.x1 + 1) * T - 4 && w.y > STAIRS.top * T + 4 && w.y < (STAIRS.top + 1) * T;
const onStairs = w => (gym.floor === 0 ? onBottomStep(w) : onTopStep(w));

/* ---------------- scene API ---------------- */
let floors = null, onLeave = null, swap = 0;
export const gym = { active: false, walker: null, floor: 0 };

// from: undefined (street door) or 'basement' (coming up from the Resenha)
export function enterGym(actor, leave, from) {
  if (!floors) { const g0 = buildGround(); floors = [g0, buildUpper(g0)]; for (const F of floors) F.objs.sort((a, b) => a.sortY - b.sortY); }
  onLeave = leave;
  const w = new GymWalker(actor);
  w.x = (DOOR.x0 + DOOR.x1) / 2; w.y = 2 * T + 10; w.path = [{ x: w.x, y: 4 * T + 10 }]; w.dir = 'down';
  if (from === 'basement') { w.x = (BASEMENT.x0 + 1) * T; w.y = (BASEMENT.top - 1) * T + 20; w.path = []; w.dir = 'up'; w.alpha = 1; }
  Object.assign(gym, { active: true, walker: w, floor: 0 });
}
// how: 'street' (walked out the front door), 'down' (took the stairs to the basement) or 'office' (HUD button / timer started)
export function leaveGym(how = 'street') {
  if (!gym.active) return;
  const a = gym.walker.a;
  gym.active = false; gym.walker = null;
  onLeave?.(a, how);
}
function changeFloor(to) {
  const w = gym.walker;
  gym.floor = to; swap = 0.35; w.path = []; w.goOut = false;
  if (to === 1) { w.x = (STAIRS.x1 + 1.5) * T; w.y = STAIRS.top * T + 24; w.dir = 'right'; } // beside the stairwell
  else { w.x = (STAIRS.x0 + 1) * T; w.y = (STAIRS.bottom + 1) * T + 24; w.dir = 'down'; }    // below the flight
}

export const overDoor = (x, y) => gym.floor === 0 && x >= DOOR.x0 - 6 && x < DOOR.x1 + 6 && y < 2 * T + 24;
export const overBasement = (x, y) => gym.floor === 0 && x >= BASEMENT.x0 * T - 4 && x < (BASEMENT.x1 + 1) * T + 4 && y >= BASEMENT.top * T - 4;
const onBasement = w => gym.floor === 0 && w.x > BASEMENT.x0 * T + 4 && w.x < (BASEMENT.x1 + 1) * T - 4 && w.y > BASEMENT.bottom * T + 4;
export const overStairs = (x, y) => x >= STAIRS.x0 * T && x < (STAIRS.x1 + 1) * T && y >= STAIRS.top * T && y < (STAIRS.bottom + 1) * T;

export function clickGym(x, y) {
  const w = gym.walker; if (!w || w.fade < 0) return;
  const F = floors[gym.floor];
  let tx = Math.max(1, Math.min(GMW - 2, Math.floor(x / T))), ty = Math.max(2, Math.min(16, Math.floor((y - 2) / T)));
  let fx = x, fy = null, goOut = false, stairs = false;
  let basement = false;
  if (overDoor(x, y)) { tx = 6; ty = 2; fx = (DOOR.x0 + DOOR.x1) / 2; fy = 2 * T + 8; goOut = true; }
  else if (overBasement(x, y)) { tx = BASEMENT.x0; ty = BASEMENT.bottom; fx = (BASEMENT.x0 + 1) * T; fy = BASEMENT.bottom * T + 22; basement = true; }
  else if (overStairs(x, y)) {
    stairs = true;
    if (gym.floor === 0) { tx = STAIRS.x0; ty = STAIRS.bottom; fx = (STAIRS.x0 + 1) * T; fy = STAIRS.bottom * T + 22; }
    else { tx = STAIRS.x1; ty = STAIRS.top; fx = STAIRS.x1 * T + 16; fy = STAIRS.top * T + 22; }
  }
  if (F.solid[ty][tx]) { let found = false; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1]]) if (F.solid[ty + dy]?.[tx + dx] === 0) { tx += dx; ty += dy; found = true; break; } if (!found) return; }
  const p = findPath(Math.floor(w.x / T), Math.floor((w.y - 2) / T), tx, ty, F.solid);
  if (!p) return;
  if (p.length) p[p.length - 1] = { x: fx, y: fy ?? p[p.length - 1].y }; else p.push({ x: fx, y: fy ?? w.y });
  w.path = p; w.goOut = goOut; w.toStairs = stairs; w.toBasement = basement;
}

export function updateGym(dt, keys) {
  const w = gym.walker, F = floors[gym.floor];
  swap = Math.max(0, swap - dt);
  w.alpha = Math.max(0, Math.min(1, w.alpha + dt * 2.5 * w.fade));
  if (w.fade < 0) { w.y -= 20 * dt; w.dir = 'up'; w.mode = 'walk'; w.animT += dt * 8; if (w.alpha <= 0) leaveGym('street'); return; }
  let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0), moving = false;
  if (vx || vy) {
    w.path = []; w.goOut = false; w.toStairs = false; w.toBasement = false;
    const n = Math.hypot(vx, vy), sp = (keys.run ? RUN : WALK) * dt; vx /= n; vy /= n;
    if (!blockedIn(F, w.x + vx * sp, w.y)) w.x += vx * sp;
    if (!blockedIn(F, w.x, w.y + vy * sp)) w.y += vy * sp;
    w.setDir(vx, vy); moving = true;
    if (vy < 0 && atDoor(gym, w)) w.goOut = true;
    if (vy > 0 && onBasement(w)) { leaveGym('down'); return; }
    if (swap <= 0 && ((gym.floor === 0 && vy < 0 && onBottomStep(w)) || (gym.floor === 1 && vx < 0 && onTopStep(w)))) { changeFloor(1 - gym.floor); return; }
  } else if (w.path.length) {
    let rem = WALK * dt;
    while (rem > 0 && w.path.length) {
      const p = w.path[0], dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy);
      if (d < 0.01) { w.path.shift(); continue; }
      w.setDir(dx, dy);
      if (d <= rem) { w.x = p.x; w.y = p.y; w.path.shift(); rem -= d; } else { w.x += dx / d * rem; w.y += dy / d * rem; rem = 0; }
    }
    moving = true;
    if (!w.path.length && w.toStairs && onStairs(w)) { w.toStairs = false; changeFloor(1 - gym.floor); return; }
    if (!w.path.length && w.toBasement && onBasement(w)) { w.toBasement = false; leaveGym('down'); return; }
  }
  if (w.goOut && !w.path.length && atDoor(gym, w)) w.fade = -1;
  w.mode = moving ? 'walk' : 'stand';
  w.animT += dt * (moving ? (keys.run ? 13 : 8) : 1);
}

// others: colleagues on this floor (multiplayer), drawn like you
export function drawGym(g, t, others = []) {
  const F = floors[gym.floor], w = gym.walker;
  g.drawImage(F.bg, 0, 0);
  const items = F.objs.map(o => ({ s: o.sortY, o }));
  if (w) items.push({ s: w.y, w });
  for (const r of others) items.push({ s: r.y, w: r });
  items.sort((a, b) => a.s - b.s);
  for (const it of items) {
    if (it.o) { g.drawImage(it.o.c, it.o.x, it.o.y); continue; }
    const w = it.w;
    g.globalAlpha = w.alpha;
    const fr = w.mode === 'walk' ? frame(w.id, 'walk', w.dir, Math.floor(w.animT)) : frame(w.id, 'stand', w.dir, Math.floor(t * 1.4) % 2);
    g.fillStyle = 'rgba(8,12,24,.3)'; g.beginPath(); g.ellipse(w.x, w.y - 1, 10, 3.5, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(fr, Math.round(w.x - CW / 2), Math.round(w.y - FOOT));
    g.globalAlpha = 1;
  }
  // overhead: lights, TVs, hanging signs
  if (F.upper) {
    g.fillStyle = 'rgba(40,90,230,.10)'; g.fillRect(0, 2 * T, GW, 15 * T);
    for (const tv of F.tvs) { R(g, tv.x + 12, tv.y - 10, 2, 10, '#5d6470'); R(g, tv.x, tv.y, 28, 17, OUT); R(g, tv.x + 1, tv.y + 1, 26, 15, '#1b2b4a'); R(g, tv.x + 3, tv.y + 3, 10 + Math.round(6 * Math.sin(t * 2 + tv.x)), 2, '#9fd3ff'); R(g, tv.x + 3, tv.y + 8, 18, 5, '#2d6cdf'); }
    g.strokeStyle = `rgba(80,150,255,${0.75 + 0.2 * Math.sin(t * 2)})`; g.lineWidth = 2;
    for (const [x, y] of F.rings) { g.beginPath(); g.ellipse(x, y, 30, 10, 0, 0, Math.PI * 2); g.stroke(); }
  } else {
    g.fillStyle = 'rgba(255,240,200,.05)'; for (let x = 3 * T; x < 28 * T; x += 4 * T) g.fillRect(x, 2 * T, 8, 15 * T);
  }
  for (const [x, y, text, dark] of F.signs) zoneSign(g, x, y, text, dark);
  if (swap > 0) { g.fillStyle = `rgba(6,10,20,${swap / 0.35})`; g.fillRect(0, 0, GW, GH); }
}

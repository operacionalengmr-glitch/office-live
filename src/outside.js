// The street outside the Empresarial Excelsior (Av. João Câncio da Silva, João Pessoa): from the Supermercado
// Manaíra on the left to the shops at no. 628 on the right. Someone on a break walks out of the office door and
// lands at the Excelsior's entrance; walking back into it (or the HUD button) returns them to the office.
// Our side of the street (even numbers) is shown as facades along the top; the far side (odd numbers) as roofs
// with their signs on the parapet along the bottom. Ground + facades and the far side are painted once; cars,
// trees, poles and the walker are y-sorted every frame, and the power lines go over everything.
import { T, rng, findPath } from './world.js';
import { cv, R, pe, peO, shadow, shade, ptext, ptextW, OUT, LEAF } from './art.js';
import { CW, FOOT, SPR, frame } from './sprites.js';

export const OMW = 64, OMH = 22, OW = OMW * T, OH = OMH * T;
const NB = 8 * T;             // our facades meet the sidewalk
const CURB = 11 * T - 4, ROAD0 = 11 * T + 10, ROAD1 = 17 * T, SB = 19 * T; // road, far-side buildings
// Where each place starts along the avenue, as seen from the street looking at the Excelsior (from the map):
// left = Paraíba Suplementos and Av. Manoel Morais, right = TNS, Armazém Paraíba and the Supermercado Manaíra end.
// Across the avenue the Smart Fit sits in front of the Excelsior, a little to its left.
const X = { side0: 320, side1: 448, neighbour: 480, excelsior: 608, houses: 992, tns: 1312, armazem: 1504, lot: 1824 };
const DOOR = { x0: 22 * T, x1: 24 * T, tx: 23, ty: 8 };  // Excelsior entrance (top of the black stairs)
const OLD_DOOR_X0 = 928; // the Excelsior block below is painted in its original coordinates and shifted into place
const WALK = 74, RUN = 146;

/* ---------------- collision grid ---------------- */
const solid = Array.from({ length: OMH }, (_, y) => Array(OMW).fill(y < 8 || y >= 19 ? 1 : 0));
const block = (tx, ty, w = 1, h = 1) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) solid[y][x] = 1; };
function blockedOut(x, y) {
  if (x < 16 || x > OW - 16) return true;
  for (const [px, py] of [[x - 7, y - 7], [x + 6, y - 7], [x - 7, y - 1], [x + 6, y - 1]]) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= OMW || ty >= OMH || solid[ty][tx]) return true;
  }
  return false;
}

/* ---------------- small painters ---------------- */
const CARS = ['#c9ccd1', '#2b2f36', '#e8e6df', '#5d6470', '#8e2a2a', '#3f6fb5', '#a9aeb5'];
function carRear(g, x, y, col) { // parked nose-in: we see the back
  shadow(g, x + 1, y + 26, 42, 10, 0.3);
  R(g, x + 5, y + 29, 7, 5, '#15171b'); R(g, x + 32, y + 29, 7, 5, '#15171b');
  R(g, x + 3, y + 3, 38, 28, OUT); R(g, x + 4, y + 4, 36, 26, col); R(g, x + 4, y + 4, 36, 1, shade(col, 0.35));
  R(g, x + 7, y + 6, 30, 10, '#1c2733'); R(g, x + 9, y + 7, 9, 2, 'rgba(255,255,255,.28)');
  R(g, x + 4, y + 18, 7, 4, '#c9302c'); R(g, x + 33, y + 18, 7, 4, '#c9302c');
  R(g, x + 16, y + 20, 12, 5, '#e8e6df'); R(g, x + 4, y + 26, 36, 4, shade(col, -0.35));
}
function carSide(col, right) { // driving: 64x32, facing right (or left)
  const [c, g] = cv(64, 32);
  shadow(g, 4, 23, 56, 9, 0.3);
  R(g, 14, 4, 34, 11, OUT); R(g, 15, 5, 32, 10, col); R(g, 17, 6, 13, 7, '#1c2733'); R(g, 32, 6, 13, 7, '#1c2733');
  R(g, 2, 12, 60, 14, OUT); R(g, 3, 13, 58, 12, col); R(g, 3, 13, 58, 1, shade(col, 0.35)); R(g, 3, 21, 58, 3, shade(col, -0.3));
  R(g, 31, 14, 1, 7, shade(col, -0.3)); R(g, 58, 15, 3, 3, '#ffe9a8'); R(g, 3, 15, 3, 3, '#c9302c');
  for (const wx of [15, 49]) { pe(g, wx, 25, 5, 5, '#15171b'); pe(g, wx, 25, 2, 2, '#8a8f97'); }
  if (right) return c;
  const [f, fg] = cv(64, 32); fg.translate(64, 0); fg.scale(-1, 1); fg.drawImage(c, 0, 0); return f;
}
function moto(g, x, y, col, rider) { // side view, ~30x26
  shadow(g, x, y + 20, 30, 6, 0.3);
  pe(g, x + 6, y + 20, 5, 5, '#15171b'); pe(g, x + 24, y + 20, 5, 5, '#15171b');
  R(g, x + 6, y + 12, 18, 6, OUT); R(g, x + 7, y + 13, 16, 4, col); R(g, x + 20, y + 8, 3, 6, '#2a2e36'); R(g, x + 9, y + 10, 9, 3, '#1b1b1b');
  if (rider) { R(g, x + 10, y - 4, 8, 14, '#2f6b3a'); pe(g, x + 14, y - 7, 4, 4, '#f2f2f2'); R(g, x + 12, y + 8, 4, 6, '#2a3550'); }
}
function tree(g, bx, by, big = 1) { // street tree: trunk + leafy canopy
  shadow(g, bx - 22 * big, by - 6, 44 * big, 12, 0.25);
  R(g, bx - 3, by - 40, 6, 40, '#5a4330'); R(g, bx - 3, by - 40, 2, 40, '#7a5c40');
  const k = [[0, -62, 22, 16, 1], [-16, -52, 14, 11, 2], [16, -54, 14, 11, 2], [-8, -72, 13, 10, 3], [10, -70, 13, 10, 3], [0, -48, 14, 9, 3], [-22, -60, 9, 8, 2], [22, -62, 9, 8, 1]];
  for (const [dx, dy, rx, ry, c] of k) { peO(g, bx + dx * big, by + dy * big, rx * big, ry * big, LEAF[c], LEAF[0]); R(g, bx + dx * big - rx * big + 4, by + dy * big - 2, rx * big, 1, LEAF[c + 1] || LEAF[4]); }
}
function palm(g, bx, by) {
  shadow(g, bx - 12, by - 5, 24, 8, 0.25);
  for (let i = 0; i < 50; i++) R(g, bx - 2 + Math.round(Math.sin(i / 14) * 3), by - i, 5, 1, i % 6 < 2 ? '#8a6a48' : '#a07e58');
  const top = by - 50;
  for (const [dx, dy] of [[-18, 6], [18, 6], [-14, -6], [14, -6], [0, -10], [-22, 0], [22, 0]]) {
    g.strokeStyle = LEAF[2]; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, top); g.quadraticCurveTo(bx + dx / 2, top + dy - 8, bx + dx, top + dy + 4); g.stroke();
    g.strokeStyle = LEAF[3]; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, top - 1); g.quadraticCurveTo(bx + dx / 2, top + dy - 9, bx + dx, top + dy + 3); g.stroke();
  }
}
const windows = (g, x, y, w, h, cw, ch, gx, gy, col, lit) => {
  for (let yy = y; yy + ch <= y + h; yy += ch + gy) for (let xx = x; xx + cw <= x + w; xx += cw + gx) R(g, xx, yy, cw, ch, lit && ((xx * 7 + yy * 13) % 5 === 0) ? lit : col);
};
const center = (g, s, cx, y, col, sc = 1) => ptext(g, s, Math.round(cx - ptextW(s, sc) / 2), y, col, sc);

/* ---------------- our side: facades ---------------- */
function paintBack(g) {
  const sky = g.createLinearGradient(0, 0, 0, NB);
  sky.addColorStop(0, '#7fb8e6'); sky.addColorStop(1, '#d6ecf8');
  g.fillStyle = sky; g.fillRect(0, 0, OW, NB);
  const r = rng(11);
  for (let i = 0; i < 9; i++) { const cx = r() * OW, cy = 14 + r() * 50; for (let k = 0; k < 4; k++) pe(g, cx + k * 9 - 14, cy + (k % 2) * 3, 9, 5, 'rgba(255,255,255,.85)'); }
  // skyline of apartment towers behind the street
  for (let x = -20; x < OW;) {
    const w = 46 + r() * 50 | 0, top = 6 + r() * 70 | 0, col = ['#ece7dc', '#d9cdb4', '#f2f1ec', '#c9b89a', '#b8c4cf', '#e3d2c0'][r() * 6 | 0];
    R(g, x, top, w, NB - top, shade(col, -0.25)); R(g, x + 1, top + 1, w - 2, NB - top, col);
    windows(g, x + 5, top + 8, w - 10, NB - top - 10, 4, 5, 4, 5, shade(col, -0.35));
    x += w + 10 + (r() * 40 | 0);
  }

  const at = (dx, paint) => { g.save(); g.translate(dx, 0); paint(); g.restore(); };
  // Armazém Paraíba's own parking lot, at the right end (towards the Supermercado Manaíra)
  { const top = NB - 34, x0 = X.lot, w = OW - X.lot;
    R(g, x0, top, w, 34, '#d8d2c4'); R(g, x0, top, w, 2, '#ece7dc'); for (let xx = x0; xx < OW; xx += 24) R(g, xx, top, 2, 34, '#c6bfae');
    R(g, x0 + 20, top - 30, 72, 24, '#1b1b1b'); R(g, x0 + 22, top - 28, 68, 20, '#f2c230'); center(g, 'ESTACIONAMENTO', x0 + 56, top - 25, '#1b1b1b'); center(g, 'CLIENTES', x0 + 56, top - 17, '#c8352b');
    R(g, x0 + 54, top - 6, 4, 6, '#3a3f48');
  }
  // 580 · Armazém Paraíba: yellow supermarket with a red awning
  at(X.armazem, () => { const x0 = 0, w = 320, top = NB - 112;
    R(g, x0, top, w, 112, '#f2c230'); R(g, x0, top, w, 3, '#ffd95a'); R(g, x0, top + 3, w, 1, '#c99d1c');
    windows(g, x0 + 110, top + 12, 200, 40, 6, 8, 4, 6, '#e0b02a');
    pe(g, x0 + 52, top + 32, 36, 22, '#1b1b1b'); pe(g, x0 + 52, top + 32, 33, 19, '#f7d046');
    center(g, 'ARMAZEM', x0 + 52, top + 19, '#1b1b1b'); center(g, 'PARAIBA', x0 + 52, top + 28, '#c8352b', 2);
    R(g, x0, top + 64, w, 9, '#c8352b'); R(g, x0, top + 64, w, 1, '#e86a5c'); R(g, x0, top + 73, w, 2, '#7a1c14');
    R(g, x0, top + 75, w, 37, '#e9e4da');
    for (let x = x0 + 8; x < x0 + w - 30; x += 38) { R(g, x, top + 79, 30, 31, '#2a3340'); R(g, x + 3, top + 81, 6, 27, 'rgba(255,255,255,.12)'); R(g, x + 12, top + 92, 12, 10, ['#e8b33a', '#7cc46a', '#c9483b'][(x / 38 | 0) % 3]); }
    for (const lx of [220, 280]) { pe(g, x0 + lx, top + 34, 13, 13, '#1b1b1b'); pe(g, x0 + lx, top + 34, 10, 10, '#e8b33a'); R(g, x0 + lx - 6, top + 32, 12, 3, '#c8352b'); }
  });
  // TNS: three floors, blue sign
  at(X.tns - 320, () => { const x0 = 320, w = 192, top = NB - 152;
    R(g, x0, top, w, 152, '#e7dcd8'); R(g, x0, top, w, 3, '#f5eeeb');
    R(g, x0 + 40, top + 12, w - 52, 28, '#4a4f59'); for (let i = 0; i < 6; i++) R(g, x0 + 40, top + 14 + i * 4, w - 52, 1, '#6b7280');
    R(g, x0 + 40, top + 48, w - 52, 30, '#9fb4c6'); for (let xx = x0 + 40; xx < x0 + w - 12; xx += 20) R(g, xx, top + 48, 1, 30, '#6d8296');
    R(g, x0 + 28, top + 92, w - 34, 5, '#2b2f36');
    R(g, x0 + 32, top + 97, w - 42, 55, '#3a4552'); for (let xx = x0 + 32; xx < x0 + w - 10; xx += 22) { R(g, xx, top + 97, 1, 55, '#566273'); R(g, xx + 3, top + 100, 5, 48, 'rgba(255,255,255,.08)'); }
    R(g, x0 + 54, top + 50, 36, 34, '#1d3f9a'); for (let i = 0; i < 4; i++) R(g, x0 + 58, top + 56 + i * 4, 28 - i * 6, 2, '#ffffff'); center(g, 'TNS', x0 + 72, top + 74, '#ffffff');
  });
  // houses behind tan walls (orange roofs on the map) between TNS and the Excelsior
  const house = (x0, w, roof, wall, num) => {
    R(g, x0 + 12, NB - 92, w - 24, 8, shade(roof, -0.3)); R(g, x0 + 8, NB - 86, w - 16, 26, roof);
    for (let yy = NB - 82; yy < NB - 60; yy += 5) R(g, x0 + 8, yy, w - 16, 1, shade(roof, -0.18));
    R(g, x0 + 14, NB - 60, w - 28, 22, '#ece7dd'); R(g, x0 + 24, NB - 56, 16, 12, '#7a5c40'); R(g, x0 + w - 40, NB - 56, 16, 12, '#7a5c40');
    R(g, x0, NB - 40, w, 40, wall); for (let yy = NB - 36; yy < NB; yy += 8) R(g, x0, yy, w, 1, shade(wall, -0.08));
    for (let xx = x0; xx < x0 + w; xx += 16) R(g, xx, NB - 40, 1, 40, shade(wall, -0.08));
    R(g, x0 + w - 48, NB - 36, 40, 36, '#6b5a48'); for (let xx = x0 + w - 46; xx < x0 + w - 8; xx += 5) R(g, xx, NB - 34, 2, 34, '#83705c');
    R(g, x0 + 14, NB - 30, 18, 9, shade(wall, -0.05)); ptext(g, num, x0 + 17, NB - 28, '#5a4a38');
  };
  house(X.houses, 96, '#a3552f', '#d9cbb0', '618');
  house(X.houses + 96, 96, '#c0703f', '#ece5d6', '614');
  house(X.houses + 192, 128, '#b5643c', '#e1d2b0', '610');
  // 620 · Empresarial Excelsior: blue tiled tower on a red podium
  at(X.excelsior - 832, () => { const x0 = 832, x1 = 1216, top = NB - 118;
    R(g, 896, 0, 256, top + 12, '#26359a');
    for (let yy = 0; yy < top + 12; yy += 4) R(g, 896, yy, 256, 1, '#2c3da8');
    for (let xx = 896; xx < 1152; xx += 4) R(g, xx, 0, 1, top + 12, '#23318d');
    R(g, 978, 0, 92, top + 8, '#eef0f2');
    for (let yy = 4; yy < top; yy += 22) { R(g, 978, yy + 12, 92, 4, '#ffffff'); R(g, 986, yy, 24, 12, '#3c4a5a'); R(g, 1038, yy, 24, 12, '#3c4a5a'); R(g, 986, yy + 9, 24, 3, '#5d6f80'); R(g, 1038, yy + 9, 24, 3, '#5d6f80'); }
    R(g, 896, top + 10, 256, 3, 'rgba(10,14,40,.35)');
    R(g, x0, top, x1 - x0, 118, '#d8282b');
    for (let yy = top; yy < NB; yy += 4) R(g, x0, yy, x1 - x0, 1, '#cc2326');
    R(g, x0, top, x1 - x0, 2, '#ef4a4a');
    ptext(g, 'EMPRESARIAL', 852, top + 12, '#f4f1ec', 2); ptext(g, 'EXCELSIOR', 852, top + 26, '#f4f1ec', 2); ptext(g, '620', 852, top + 40, '#f4f1ec');
    R(g, 834, top + 14, 4, 30, '#f4f1ec'); R(g, 840, top + 10, 3, 22, '#c9c2b8');
    // garage
    R(g, 840, NB - 58, 84, 58, '#9a1c1f'); R(g, 846, NB - 54, 72, 54, '#cfd3d8');
    for (let yy = NB - 52; yy < NB; yy += 4) R(g, 846, yy, 72, 1, '#aeb4bb');
    // entrance
    R(g, OLD_DOOR_X0 + 2, NB - 62, 60, 6, '#2b2f36');
    R(g, OLD_DOOR_X0 + 6, NB - 56, 52, 56, '#1d2430'); R(g, OLD_DOOR_X0 + 31, NB - 56, 2, 56, '#3a4250'); R(g, OLD_DOOR_X0 + 10, NB - 52, 6, 46, 'rgba(255,255,255,.12)'); R(g, OLD_DOOR_X0 + 38, NB - 52, 6, 46, 'rgba(255,255,255,.08)');
    // glass storefront with a black awning and a terrace rail
    R(g, 992, NB - 70, 224, 10, '#16181c'); R(g, 992, NB - 61, 224, 2, '#3a3f48');
    R(g, 996, NB - 59, 216, 59, '#26313d');
    for (let xx = 996; xx < 1212; xx += 36) { R(g, xx, NB - 59, 2, 59, '#11151b'); R(g, xx + 5, NB - 56, 6, 50, 'rgba(255,255,255,.09)'); }
    for (const [px, txt] of [[1012, 'ALUGA'], [1052, 'VENDE'], [1124, 'ALUGA']]) { R(g, px, NB - 50, 26, 12, '#f4f1ec'); ptext(g, txt, px + 3, NB - 47, '#c62828'); }
    R(g, 992, NB - 18, 224, 2, '#c9ced6'); for (let xx = 994; xx < 1216; xx += 18) R(g, xx, NB - 18, 2, 18, '#a9b0b9');
  });
  // neighbour: white tiled wall, beige block behind
  { const x0 = X.neighbour, w = 128;
    R(g, x0 + 10, NB - 130, w - 20, 80, '#cbbfa8'); windows(g, x0 + 18, NB - 122, w - 36, 64, 12, 10, 8, 8, '#8f846f');
    R(g, x0, NB - 54, w, 54, '#eef0f2'); for (let yy = NB - 50; yy < NB; yy += 8) R(g, x0, yy, w, 1, '#d6dbe0'); for (let xx = x0; xx < x0 + w; xx += 8) R(g, xx, NB - 54, 1, 54, '#d6dbe0');
  }
  R(g, X.side1, NB - 30, X.neighbour - X.side1, 30, '#d6d0c2'); // corner wall
  // 628: a row of shops under apartment towers, left of the corner; Paraíba Suplementos is the one on the corner
  // (the row is painted in its original coordinates, shifted so it ends at the corner, and clipped at the left edge)
  at(X.side0 - OW, () => { const x0 = 1344, x1 = OW, top = NB - 112;
    g.beginPath(); g.rect(OW - X.side0, 0, X.side0, NB); g.clip();
    R(g, 1420, 0, 260, top, '#e7d7b5'); windows(g, 1430, 8, 240, top - 14, 10, 12, 10, 10, '#2f6b4a');
    R(g, 1760, 10, 220, top - 10, '#f2f1ec'); windows(g, 1772, 18, 196, top - 24, 8, 10, 12, 10, '#5d6f80');
    R(g, x0, top, x1 - x0, 112, '#f1f1ee'); R(g, x0, top, x1 - x0, 3, '#ffffff'); R(g, x0, top + 40, x1 - x0, 2, '#d6d6d0');
    const shops = [
      { w: 134, bg: '#2d4f95', a: 'LOJA 628', c: '#ffffff' },
      { w: 170, bg: '#fbfaf6', a: 'NOSSA OTICA', c: '#b8902e', sc: 2 },
      { w: 150, bg: '#f3efe6', a: 'ARTIGOS', b: 'RELIGIOSOS', c: '#5a3f8f' },
      { w: 90, bg: '#111111', a: 'KA', c: '#ffffff', sc: 3 },
      { w: 160, bg: '#141414', a: 'PARAIBA', b: 'SUPLEMENTOS', c: '#e53935' },
    ];
    let x = x0;
    for (const s of shops) {
      R(g, x + 2, top + 44, s.w - 4, 26, s.bg); R(g, x + 2, top + 44, s.w - 4, 1, 'rgba(255,255,255,.25)');
      if (s.b) { center(g, s.a, x + s.w / 2, top + 48, s.c); center(g, s.b, x + s.w / 2, top + 57, s.c); }
      else center(g, s.a, x + s.w / 2, top + 57 - 2.5 * (s.sc || 1), s.c, s.sc || 1);
      R(g, x + 6, top + 72, s.w - 12, 40, '#2c3542');
      for (let xx = x + 6; xx < x + s.w - 6; xx += 26) { R(g, xx, top + 72, 2, 40, '#1b2129'); R(g, xx + 5, top + 76, 5, 32, 'rgba(255,255,255,.09)'); }
      R(g, x + 14, top + 92, s.w - 28, 10, shade(s.bg === '#141414' || s.bg === '#111111' ? '#c9483b' : s.c, 0.3));
      R(g, x, top + 44, 2, 68, '#d6d6d0');
      x += s.w;
    }
  });
  // Av. Manoel Morais going away between the buildings
  { const a = X.side0, b = X.side1, mid = (a + b) / 2, top = NB - 112;
    g.fillStyle = '#d4cfc2'; g.beginPath(); g.moveTo(a - 6, NB); g.lineTo(b + 6, NB); g.lineTo(mid + 30, top); g.lineTo(mid - 30, top); g.fill();
    g.fillStyle = '#5b5f66'; g.beginPath(); g.moveTo(a + 8, NB); g.lineTo(b - 8, NB); g.lineTo(mid + 20, top); g.lineTo(mid - 20, top); g.fill();
    for (let k = 0; k < 6; k++) { const t0 = k / 6, y = NB - 6 - t0 * (NB - top - 10); R(g, mid - 1, y - 8 * (1 - t0), 2, Math.max(2, 8 * (1 - t0)), '#e9e6de'); }
    for (let k = 0; k < 5; k++) { const y = top + 6 + k * 20; R(g, mid - 26 - k * 7, y, 4, 10, '#8a9098'); R(g, mid + 22 + k * 7, y, 4, 10, '#8a9098'); }
  }

  /* ground: sidewalk, ramp, stairs, bays, road */
  R(g, 0, NB, OW, CURB - NB, '#d9d4c8');
  for (let yy = NB; yy < CURB; yy += 16) R(g, 0, yy, OW, 1, '#ccc6b8');
  for (let xx = 0; xx < OW; xx += 16) R(g, xx, NB, 1, CURB - NB, '#d2ccbf');
  for (const [a, b] of [[0, 304], [800, 992], [1840, 2032]]) {
    R(g, a, NB, b - a, 2 * T, '#cfcab9'); for (let xx = a; xx <= b; xx += 64) R(g, xx, NB, 2, 2 * T, '#e8b33a');
  }
  R(g, 1984, NB + 4, 56, 56, '#3f6fb5'); R(g, 2004, NB + 18, 16, 3, '#ffffff'); pe(g, 2012, NB + 14, 3, 3, '#ffffff'); R(g, 2010, NB + 21, 4, 14, '#ffffff'); pe(g, 2012, NB + 40, 8, 6, '#ffffff'); pe(g, 2012, NB + 40, 5, 3, '#3f6fb5');
  // Excelsior garage ramp + black stairs
  R(g, 622, NB, 72, 44, '#9aa0a8'); for (let yy = NB + 4; yy < NB + 44; yy += 6) R(g, 622, yy, 72, 1, '#8a9098');
  g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(616, NB); g.lineTo(622, NB); g.lineTo(622, NB + 44); g.lineTo(616, NB + 44); g.fill();
  g.beginPath(); g.moveTo(694, NB); g.lineTo(702, NB); g.lineTo(702, NB + 44); g.lineTo(694, NB + 44); g.fill();
  for (let i = 0; i < 5; i++) { R(g, DOOR.x0 + 4 - i * 2, NB + i * 6, 56 + i * 4, 6, '#2a2d34'); R(g, DOOR.x0 + 4 - i * 2, NB + i * 6, 56 + i * 4, 1, '#4a4f59'); }
  for (const rx of [DOOR.x0 - 6, DOOR.x0 + 66]) { R(g, rx, NB - 6, 2, 36, '#b8c0ca'); }
  // curb, blue bike lane, asphalt, markings
  R(g, 0, CURB, OW, 4, '#b9b4a8'); R(g, 0, CURB + 4, OW, 10, '#3f6fb5');
  for (let xx = 10; xx < OW; xx += 28) R(g, xx, CURB + 7, 4, 4, '#c9483b');
  R(g, 0, ROAD0, OW, ROAD1 - ROAD0, '#5b5f66');
  const rr = rng(5); for (let k = 0; k < 2600; k++) R(g, rr() * OW, ROAD0 + rr() * (ROAD1 - ROAD0), 1, 1, rr() < 0.5 ? '#53575e' : '#646870');
  R(g, 0, ROAD0 + 3, OW, 2, '#e9e6de');
  for (let xx = 0; xx < OW; xx += 48) R(g, xx, 14 * T - 1, 24, 3, '#e9e6de');
  R(g, 0, ROAD1 - 6, OW, 3, '#e8b33a');
  for (let yy = ROAD0 + 10; yy < ROAD1 - 12; yy += 16) R(g, OW - 214, yy, 64, 9, '#e9e6de'); // crosswalk by the Manaíra
  // far sidewalk: grass strip + paving
  R(g, 0, ROAD1, OW, 12, '#7cb35a'); for (let k = 0; k < 700; k++) R(g, rr() * OW, ROAD1 + rr() * 12, 1, 2, rr() < 0.5 ? '#5f9a45' : '#94c870');
  R(g, 0, ROAD1 + 12, OW, SB - ROAD1 - 12, '#d4cfc2'); for (let xx = 0; xx < OW; xx += 16) R(g, xx, ROAD1 + 12, 1, SB - ROAD1 - 12, '#c9c3b5');
  // Av. Manoel Morais crosses both sidewalks; zebra crossings to keep walking along the avenue, one across it
  for (const [y0, y1, z0, z1] of [[NB, CURB + 14, NB + 18, NB + 62], [ROAD1, SB, ROAD1 + 16, SB - 8]]) {
    R(g, X.side0, y0, X.side1 - X.side0, y1 - y0, '#5b5f66');
    for (let k = 0; k < 300; k++) R(g, X.side0 + rr() * (X.side1 - X.side0), y0 + rr() * (y1 - y0), 1, 1, rr() < 0.5 ? '#53575e' : '#646870');
    R(g, X.side0 - 3, y0, 3, y1 - y0, '#b9b4a8'); R(g, X.side1, y0, 3, y1 - y0, '#b9b4a8');
    for (let xx = X.side0 + 8; xx < X.side1 - 8; xx += 16) R(g, xx, z0, 9, z1 - z0, '#e9e6de');
  }
  for (let yy = ROAD0 + 10; yy < ROAD1 - 12; yy += 16) R(g, X.side1 + 12, yy, 64, 9, '#e9e6de'); // crosswalk at the corner
}

/* ---------------- far side: roofs with their signs on the parapet ---------------- */
function paintFar(g) {
  const lot = (x0, w, parapet, roof) => { R(g, x0, SB, w, 22, parapet); R(g, x0, SB, w, 2, shade(parapet, 0.3)); R(g, x0, SB + 20, w, 2, shade(parapet, -0.35)); R(g, x0, SB + 22, w, OH - SB - 22, roof); };
  const ac = (x, y) => { R(g, x, y, 14, 10, '#8a9098'); R(g, x + 1, y + 1, 12, 8, '#c3c8ce'); pe(g, x + 7, y + 5, 3, 3, '#6b7280'); };
  const tile = (x0, w) => { for (let yy = SB + 26; yy < OH; yy += 6) R(g, x0, yy, w, 1, '#93502f'); };
  // tall buildings past Av. Manoel Morais (left end)
  lot(0, X.side0, '#cfc6b4', '#b7bcc2');
  for (let xx = 16; xx < X.side0 - 60; xx += 90) { R(g, xx, SB + 36, 64, 44, '#a3a8ae'); windows(g, xx + 4, SB + 40, 56, 36, 6, 6, 4, 4, '#7d838a'); }
  // Av. Manoel Morais continues away from us on this side too
  R(g, X.side0, SB, X.side1 - X.side0, OH - SB, '#5b5f66');
  R(g, X.side0 - 3, SB, 3, OH - SB, '#b9b4a8'); R(g, X.side1, SB, 3, OH - SB, '#b9b4a8');
  for (let yy = SB + 10; yy < OH; yy += 22) R(g, (X.side0 + X.side1) / 2 - 1, yy, 2, 11, '#e9e6de');
  // garage wall from the corner
  lot(X.side1, 160, '#9a958c', '#b7bcc2'); for (let xx = X.side1; xx < X.side1 + 160; xx += 12) R(g, xx, SB + 4 + (xx % 3) * 3, 8, 4, '#857f74');
  R(g, X.side1 + 60, SB + 4, 14, 14, '#ffffff'); pe(g, X.side1 + 67, SB + 11, 6, 6, '#c62828'); pe(g, X.side1 + 67, SB + 11, 4, 4, '#ffffff'); R(g, X.side1 + 65, SB + 8, 4, 6, '#1b1b1b');
  // Smart Fit: across the avenue, in front of the Excelsior and a little to its left
  lot(608, 256, '#f5c400', '#d4cfc2'); R(g, 608, SB + 15, 256, 7, '#1b1b1b'); ptext(g, 'SMART FIT', 680, SB + 3, '#1b1b1b', 2);
  ac(640, SB + 44); ac(720, SB + 52); ac(800, SB + 44);
  // 623 · Repondo by Alfamec
  lot(864, 96, '#e8622a', '#cfd3d8'); for (let xx = 866; xx < 960; xx += 4) for (let yy = SB + 2; yy < SB + 20; yy += 4) R(g, xx, yy, 1, 1, '#b84a1c');
  R(g, 868, SB + 3, 88, 16, '#141414'); pe(g, 878, SB + 11, 5, 5, '#e8622a'); ptext(g, 'REPONDO', 886, SB + 6, '#e8622a', 1); ptext(g, 'BY ALFAMEC', 886, SB + 12, '#f4f1ec');
  ac(906, SB + 50);
  // 613 · Confraria da Pizza
  lot(960, 160, '#20302b', '#d8ccb4'); ptext(g, 'CONFRARIA', 976, SB + 3, '#f4f1ec', 2); ptext(g, 'DA PIZZA', 1072, SB + 13, '#f4f1ec');
  ac(1000, SB + 44); ac(1072, SB + 60);
  // houses and small shops
  lot(1120, 64, '#ffffff', '#b5643c'); for (let xx = 1120; xx < 1184; xx += 8) for (let yy = SB; yy < SB + 22; yy += 8) if (((xx + yy) / 8) % 2 < 1) R(g, xx, yy, 8, 8, '#c62828');
  tile(1120, 64);
  lot(1184, 64, '#e7a6c7', '#d9d4c8'); pe(g, 1216, SB + 11, 9, 8, '#b56a8f'); ptext(g, 'CB', 1211, SB + 9, '#ffffff');
  lot(1248, 96, '#f2efe8', '#b5643c'); tile(1248, 96);
  pe(g, 1296, SB + 11, 34, 9, '#7a3f1c'); pe(g, 1296, SB + 11, 32, 7, '#f08a2a'); center(g, 'BOLERIA', 1296, SB + 6, '#5a2a10'); center(g, 'DO NORDESTE', 1296, SB + 12, '#5a2a10');
  // big parking lots (the map is all cars here): an open lot, then the market's behind a blue fence
  R(g, 1344, SB, 448, OH - SB, '#6b6f76');
  for (let row = 0; row < 2; row++) for (let xx = 1350; xx < 1788; xx += 32) {
    const y = SB + 30 + row * 48; R(g, xx, y, 2, 40, '#e9e6de');
    if ((xx / 32 + row * 3 | 0) % 5 !== 2) { R(g, xx + 6, y + 4, 20, 32, CARS[(xx / 32 + row | 0) % CARS.length]); R(g, xx + 8, y + 10, 16, 8, '#1c2733'); }
  }
  R(g, 1344, SB + 16, 256, 4, '#e9e4da'); R(g, 1344, SB + 16, 256, 1, '#ffffff'); // low wall of the open lot
  R(g, 1440, SB + 2, 40, 14, '#1d3f9a'); ptext(g, 'E', 1456, SB + 6, '#ffffff', 1);
  for (let xx = 1600; xx < 1792; xx += 6) R(g, xx, SB, 1, 22, '#2a5f9f'); R(g, 1600, SB, 192, 2, '#2a5f9f'); R(g, 1600, SB + 10, 192, 1, '#2a5f9f');
  // Supermercado Manaíra on the corner (right end)
  lot(1792, 256, '#1f4fa8', '#c9cdd2');
  center(g, 'SUPERMERCADO', 1912, SB + 3, '#ffffff'); center(g, 'MANAIRA', 1912, SB + 10, '#ffffff', 2);
  pe(g, 1814, SB + 11, 9, 8, '#ffffff'); pe(g, 1814, SB + 11, 6, 5, '#e53935'); R(g, 2018, SB + 4, 24, 14, '#f2a65a'); ptext(g, '65', 2024, SB + 8, '#1f4fa8');
  for (let xx = 1802; xx < 2042; xx += 40) ac(xx, SB + 40 + (xx % 3) * 12);
}

/* ---------------- props (y-sorted) ---------------- */
const OBJS = [], POLES = [], LAMPS = [];
function obj(x, y, w, h, sortY, paint) { const [c, g] = cv(w, h); paint(g); OBJS.push({ x, y, sortY, c }); }
// our sidewalk: props stand on the row next to the buildings, leaving two rows to walk along
const NS = NB + T + 12;
function parkedCar(tx, col) { block(tx, 8, 2, 1); obj(tx * T + 10, NB + 8, 44, 36, NS, g => carRear(g, 0, 0, col)); }
function buildProps() {
  // our side: parked cars, a bus stop, a tree, a palm, a feather flag
  [57, 59].forEach((tx, i) => parkedCar(tx, CARS[i + 1])); // Armazém's lot (the accessible bay stays free)
  [25, 27, 29].forEach((tx, i) => parkedCar(tx, CARS[[0, 3, 5][i]])); // in front of the Excelsior
  [2, 5].forEach((tx, i) => parkedCar(tx, CARS[(i + 2) % CARS.length])); // in front of the shops past the corner
  block(45, 8, 3, 1); // bus stop between TNS and the Armazém
  obj(45 * T + 4, NB - 50, 92, 96, NS, g => {
    shadow(g, 4, 84, 84, 10, 0.25); R(g, 6, 30, 3, 58, '#2a2e36'); R(g, 82, 30, 3, 58, '#2a2e36');
    R(g, 0, 22, 92, 12, '#7a1c14'); R(g, 0, 22, 92, 8, '#c8352b'); R(g, 10, 36, 72, 30, 'rgba(180,210,230,.45)'); R(g, 12, 66, 68, 6, '#5d4a3a');
  });
  block(41, 8); obj(41 * T - 16, NB - 64, 64, 96, NS, g => tree(g, 32, 92));
  block(34, 8); obj(34 * T - 16, NB - 30, 64, 62, NS, g => palm(g, 32, 60));
  obj(8 * T, NB - 24, 26, 60, NS, g => { R(g, 4, 2, 2, 56, '#3a3f48'); g.fillStyle = '#5a3f8f'; g.beginPath(); g.moveTo(6, 2); g.quadraticCurveTo(24, 6, 18, 46); g.lineTo(6, 46); g.fill(); R(g, 9, 10, 2, 30, '#c9b6e8'); });
  // street name sign at the corner
  block(14, 8); obj(14 * T - 8, NB - 70, 56, 104, NS, g => {
    shadow(g, 14, 98, 20, 6, 0.3); R(g, 23, 20, 3, 80, '#5d6470');
    R(g, 0, 4, 52, 18, '#1f6b3a'); R(g, 1, 5, 50, 16, '#2f8a4f'); ptext(g, 'AV MANOEL', 6, 7, '#ffffff'); ptext(g, 'MORAIS', 14, 14, '#ffffff');
  });
  // far sidewalk: poles with street lamps, trees, palms, the Repondo/Clindente pylon, motorbikes
  for (const tx of [5, 15, 25, 35, 45, 55]) {
    block(tx, 17); const bx = tx * T + 16, by = 17 * T + 22;
    POLES.push({ x: bx, y: by - 130 }); LAMPS.push({ x: bx - 2, y: by - 112 });
    obj(bx - 30, by - 136, 44, 142, by, g => {
      shadow(g, 18, 132, 16, 6, 0.3); R(g, 27, 6, 6, 130, '#b9b4a8'); R(g, 27, 6, 2, 130, '#d2cdc2'); R(g, 17, 8, 26, 3, '#8a8f97');
      R(g, 22, 22, 16, 12, '#6b7280'); R(g, 23, 23, 14, 10, '#9aa0a8');
      R(g, 6, 24, 22, 2, '#5d6470'); R(g, 2, 22, 10, 5, '#3a3f48'); R(g, 3, 26, 8, 2, '#fff3c4');
    });
  }
  for (const tx of [44, 52]) { block(tx, 18); obj(tx * T - 16, 18 * T - 74, 64, 100, 18 * T + 24, g => tree(g, 32, 98, 0.95)); }
  for (const tx of [19, 22, 26]) { block(tx, 18); obj(tx * T - 16, 18 * T - 36, 64, 62, 18 * T + 24, g => palm(g, 32, 60)); }
  block(29, 18); obj(29 * T - 24, 18 * T - 110, 80, 136, 18 * T + 24, g => {
    shadow(g, 30, 128, 20, 6, 0.3); R(g, 37, 50, 8, 82, '#cfd3d8'); R(g, 37, 50, 2, 82, '#e9ecef');
    R(g, 2, 2, 76, 24, '#141414'); pe(g, 12, 14, 6, 6, '#e8622a'); ptext(g, 'REPONDO', 22, 8, '#e8622a'); ptext(g, 'BY ALFAMEC', 22, 15, '#f4f1ec');
    R(g, 2, 26, 76, 26, '#2f9a4f'); R(g, 2, 26, 76, 2, '#5cc57a'); pe(g, 12, 39, 6, 6, '#ffffff'); ptext(g, 'CLINDENTE', 22, 32, '#ffffff'); ptext(g, 'ODONTOLOGIA', 22, 41, '#c9f0d4');
  });
  block(31, 18); obj(31 * T, 18 * T - 50, 24, 76, 18 * T + 22, g => { R(g, 3, 4, 2, 70, '#3a3f48'); g.fillStyle = '#7a1c24'; g.beginPath(); g.moveTo(5, 4); g.quadraticCurveTo(22, 10, 18, 60); g.lineTo(5, 60); g.fill(); ptext(g, 'A', 9, 20, '#f4f1ec'); ptext(g, 'L', 9, 28, '#f4f1ec'); ptext(g, 'F', 9, 36, '#f4f1ec'); });
  block(23, 18, 2, 1); obj(23 * T, 18 * T - 6, 64, 32, 18 * T + 26, g => { moto(g, 2, 4, '#1b1b1b'); moto(g, 30, 4, '#c62828'); });
  OBJS.sort((a, b) => a.sortY - b.sortY);
}

/* ---------------- traffic ---------------- */
const LANES = [{ y: 13 * T + 18, dir: -1 }, { y: 15 * T + 26, dir: 1 }];
const traffic = [];
function buildTraffic() {
  const r = rng(23);
  for (let i = 0; i < 4; i++) {
    const L = LANES[i % 2], col = CARS[(r() * CARS.length) | 0];
    traffic.push({ x: r() * OW, y: L.y, dir: L.dir, v: 70 + r() * 40, sp: 0, c: carSide(col, L.dir > 0), w: 64 });
  }
  const L = LANES[1]; traffic.push({ x: OW * 0.3, y: L.y + 4, dir: 1, v: 95, sp: 0, moto: true, w: 30 });
}
function updateTraffic(dt, w) {
  for (const c of traffic) {
    // stop for the walker (or the car ahead) in the same lane
    let block = false;
    if (w && Math.abs(w.y - c.y) < 26) { const d = (w.x - c.x) * c.dir; if (d > 0 && d < c.w / 2 + 50) block = true; }
    for (const o of traffic) if (o !== c && o.dir === c.dir && Math.abs(o.y - c.y) < 10) { const d = (o.x - c.x) * c.dir; if (d > 0 && d < (c.w + o.w) / 2 + 14) block = true; }
    c.sp += ((block ? 0 : c.v) - c.sp) * Math.min(1, dt * (block ? 6 : 1.2));
    c.x += c.sp * c.dir * dt;
    if (c.dir < 0 && c.x < -80) c.x = OW + 40 + Math.random() * 400;
    if (c.dir > 0 && c.x > OW + 80) c.x = -40 - Math.random() * 400;
  }
}

/* ---------------- the walker ---------------- */
class Walker {
  constructor(actor) {
    this.a = actor; this.id = actor.id; this.x = DOOR.tx * T; this.y = NB + 6; this.dir = 'down';
    this.mode = 'walk'; this.path = [{ x: this.x, y: 10 * T + 8 }]; this.animT = 0; this.alpha = 0; this.fade = 1; this.goIn = false;
  }
  get headX() { return this.x; }
  get headY() { return this.y - SPR[this.id].meta.down.h - 4; }
  setDir(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy) * 1.1) this.dir = dx < 0 ? 'left' : 'right';
    else if (Math.abs(dy) > 0.01) this.dir = dy < 0 ? 'up' : 'down';
  }
  update(dt, keys) {
    this.alpha = Math.max(0, Math.min(1, this.alpha + dt * 2.5 * this.fade));
    if (this.fade < 0) { this.y -= 20 * dt; this.dir = 'up'; this.mode = 'walk'; this.animT += dt * 8; return; }
    let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    let moving = false;
    if (vx || vy) {
      this.path = []; this.goIn = false;
      const n = Math.hypot(vx, vy), sp = (keys.run ? RUN : WALK) * dt;
      vx /= n; vy /= n;
      if (!blockedOut(this.x + vx * sp, this.y)) this.x += vx * sp;
      if (!blockedOut(this.x, this.y + vy * sp)) this.y += vy * sp;
      this.setDir(vx, vy); moving = true;
      if (vy < 0 && atDoor(this)) this.goIn = true;
    } else if (this.path.length) {
      let rem = WALK * dt;
      while (rem > 0 && this.path.length) {
        const p = this.path[0], dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
        if (d < 0.01) { this.path.shift(); continue; }
        this.setDir(dx, dy);
        if (d <= rem) { this.x = p.x; this.y = p.y; this.path.shift(); rem -= d; } else { this.x += dx / d * rem; this.y += dy / d * rem; rem = 0; }
      }
      moving = true;
    }
    if (this.goIn && !this.path.length && atDoor(this)) this.fade = -1;
    this.mode = moving ? 'walk' : 'stand';
    this.animT += dt * (moving ? (keys.run ? 13 : 8) : 1);
  }
  draw(g, t) { drawWalker(g, t, this); }
}
function drawWalker(g, t, w) {
  g.globalAlpha = w.alpha;
  const fr = w.mode === 'walk' ? frame(w.id, 'walk', w.dir, Math.floor(w.animT)) : frame(w.id, 'stand', w.dir, Math.floor(t * 1.4) % 2);
  g.fillStyle = 'rgba(8,12,24,.3)'; g.beginPath(); g.ellipse(w.x, w.y - 1, 10, 3.5, 0, 0, Math.PI * 2); g.fill();
  g.drawImage(fr, Math.round(w.x - CW / 2), Math.round(w.y - FOOT));
  g.globalAlpha = 1;
}
const atDoor = w => w.x > DOOR.x0 + 4 && w.x < DOOR.x1 - 4 && w.y < NB + T;

/* ---------------- colleagues on the street (multiplayer) ----------------
   Positions arrive over Realtime (main.js); each one eases towards its last reported spot and fades
   out if it stops reporting. Drawn only while you're outside yourself. */
const REMOTE_TIMEOUT = 6000;
export const others = new Map(); // id -> { id, x, y, tx, ty, dir, mode, animT, alpha, gone, seen, run }
export function remoteUpdate(m) {
  if (!m || !SPR[m.id]) return;
  let r = others.get(m.id);
  if (m.bye) { if (r) r.gone = true; return; }
  if (!r) { r = { id: m.id, x: m.x, y: m.y, dir: m.dir || 'down', mode: 'stand', animT: 0, alpha: 0 }; others.set(m.id, r); }
  Object.assign(r, { tx: m.x, ty: m.y, faceTo: m.dir, run: !!m.run, gone: false, seen: performance.now() });
}
export function tickRemotes(dt) { // called every frame by main.js, inside or out
  const now = performance.now();
  for (const [id, r] of others) {
    if (now - r.seen > REMOTE_TIMEOUT) r.gone = true;
    r.alpha = Math.max(0, Math.min(1, r.alpha + dt * (r.gone ? -3 : 3)));
    if (r.gone && r.alpha <= 0) { others.delete(id); continue; }
    const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
    if (d > 200) { r.x = r.tx; r.y = r.ty; } // jumped (e.g. just walked out): don't slide across the map
    else if (d > 0.5) {
      const step = Math.min(d, Math.max((r.run ? RUN : WALK) * 1.15, d * 3) * dt);
      r.x += dx / d * step; r.y += dy / d * step;
      if (Math.abs(dx) > Math.abs(dy) * 1.1) r.dir = dx < 0 ? 'left' : 'right'; else r.dir = dy < 0 ? 'up' : 'down';
    }
    const moving = d > 1.5;
    if (!moving && r.faceTo) r.dir = r.faceTo;
    r.mode = moving ? 'walk' : 'stand';
    r.animT += dt * (moving ? (r.run ? 13 : 8) : 1);
    r.headY = r.y - SPR[id].meta.down.h - 4;
  }
}
// ids of colleagues currently out on the street (hidden from the office scene meanwhile)
export const isOutside = id => { const r = others.get(id); return !!r && !r.gone; };
export const visibleOthers = () => [...others.values()].filter(r => r.alpha > 0.05 && (!out.walker || r.id !== out.walker.id));

/* ---------------- scene API ---------------- */
let bg = null, far = null, onLeave = null;
export const out = { active: false, walker: null };

export function enterOutside(actor, leave) {
  if (!bg) {
    const [b, bgg] = cv(OW, OH); paintBack(bgg); bg = b;
    const [f, fgg] = cv(OW, OH); paintFar(fgg); far = f;
    buildProps(); buildTraffic();
  }
  onLeave = leave; out.walker = new Walker(actor); out.active = true;
}
export function leaveOutside() {
  if (!out.active) return;
  const a = out.walker.a;
  out.active = false; out.walker = null;
  onLeave?.(a);
}
export const overDoor = (x, y) => x >= DOOR.x0 - 4 && x < DOOR.x1 + 4 && y >= NB - 64 && y < NB + 30;

// click: walk there; clicking the Excelsior's door walks in
export function clickOutside(x, y) {
  const w = out.walker; if (!w || w.fade < 0) return;
  const toDoor = overDoor(x, y);
  let tx = toDoor ? DOOR.tx : Math.floor(x / T), ty = toDoor ? DOOR.ty : Math.floor((y - 2) / T);
  tx = Math.max(0, Math.min(OMW - 1, tx)); ty = Math.max(8, Math.min(18, ty));
  if (solid[ty][tx]) { for (const dy of [1, -1, 2, -2]) if (solid[ty + dy]?.[tx] === 0) { ty += dy; break; } }
  const p = findPath(Math.floor(w.x / T), Math.floor((w.y - 2) / T), tx, ty, solid);
  if (!p) return;
  if (p.length) p[p.length - 1] = toDoor ? { x: DOOR.tx * T, y: NB + 10 } : { x: Math.max(10, Math.min(OW - 10, x)), y: p[p.length - 1].y };
  w.path = p; w.goIn = toDoor;
}

export function updateOutside(dt, keys) {
  const w = out.walker;
  w.update(dt, keys);
  updateTraffic(dt, w);
  if (w.fade < 0 && w.alpha <= 0) leaveOutside();
}

let dark = null, dg = null;
export function drawOutside(g, t, day) {
  const w = out.walker;
  g.drawImage(bg, 0, 0);
  const items = OBJS.map(o => ({ s: o.sortY, o }));
  for (const c of traffic) items.push({ s: c.y, c });
  if (w) items.push({ s: w.y, w });
  for (const r of visibleOthers()) items.push({ s: r.y, w: r });
  items.sort((a, b) => a.s - b.s);
  for (const it of items) {
    if (it.o) g.drawImage(it.o.c, it.o.x, it.o.y);
    else if (it.c) { const c = it.c; if (c.moto) moto(g, Math.round(c.x - 15), Math.round(c.y - 22), '#2a5f9f', true); else g.drawImage(c.c, Math.round(c.x - 32), Math.round(c.y - 28)); }
    else drawWalker(g, t, it.w);
  }
  g.drawImage(far, 0, 0);
  // power lines between the poles, over everything
  g.strokeStyle = 'rgba(30,32,38,.75)'; g.lineWidth = 1;
  for (const off of [0, 6, 11]) {
    g.beginPath();
    POLES.forEach((p, i) => { const y = p.y + off; if (!i) g.moveTo(-10, y + 6); g.quadraticCurveTo((p.x + (POLES[i - 1]?.x ?? -10)) / 2, y + 14, p.x, y); });
    g.quadraticCurveTo(OW - 40, POLES[POLES.length - 1].y + off + 14, OW + 10, POLES[POLES.length - 1].y + off + 6);
    g.stroke();
  }
  // evening: darken, keep street lamps and car lights glowing
  const night = 1 - day;
  if (night < 0.02) return;
  if (!dark) [dark, dg] = cv(OW, OH);
  dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, OW, OH);
  dg.fillStyle = `rgba(6,10,28,${0.7 * night})`; dg.fillRect(0, 0, OW, OH);
  dg.globalCompositeOperation = 'destination-out';
  const glow = (x, y, r, a) => { const gr = dg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const L of LAMPS) { glow(L.x, L.y + 30, 150, 0.9); glow(L.x, L.y + 110, 90, 0.6); }
  for (const c of traffic) if (!c.moto) glow(c.x + c.dir * 40, c.y - 10, 60, 0.7);
  glow(876, NB - 30, 120, 0.7); glow(736, NB - 20, 70, 0.8);
  g.drawImage(dark, 0, 0);
}

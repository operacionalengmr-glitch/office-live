// Office layout, collision grid, desks/seats/interactables and pathfinding.
// Tile coordinates: x right, y down. Walls in 3/4 view rise *above* their footprint tile.

export const T = 32, MW = 34, MH = 24, W = MW * T, H = MH * T;

export function rng(seed) {
  let a = seed;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const grid = v => Array.from({ length: MH }, () => Array(MW).fill(v));
function fill(a, x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) a[y][x] = v; }

export const solid = grid(0);
const officeSolid = solid;
export const floorT = grid('void');
export const wallT = grid(0); // 1 wall, 2 glass, 3 entrance door

function wall(x0, y0, x1, y1, v = 1) { fill(wallT, x0, y0, x1, y1, v); fill(solid, x0, y0, x1, y1, 1); }
function open(x0, y0, x1, y1, f) { fill(wallT, x0, y0, x1, y1, 0); fill(solid, x0, y0, x1, y1, 0); fill(floorT, x0, y0, x1, y1, f); }

// rooms
fill(floorT, 1, 2, 8, 5, 'wood');     // entrance
fill(floorT, 9, 2, 24, 5, 'kit');     // kitchen
fill(floorT, 26, 2, 32, 5, 'wc');     // WC
fill(floorT, 1, 7, 9, 22, 'carpet');  // bosses' room
fill(floorT, 11, 7, 13, 22, 'wood');  // corridor
fill(floorT, 14, 7, 32, 22, 'tile');  // open office (carpet)
fill(floorT, 31, 7, 32, 22, 'wood');  // wooden walkway along the windows

// walls
wall(0, 0, MW - 1, 1);
wall(0, 0, 0, MH - 1); wall(MW - 1, 0, MW - 1, MH - 1); wall(0, MH - 1, MW - 1, MH - 1);
wall(25, 2, 25, 5); open(25, 5, 25, 5, 'wc');
wall(1, 6, 32, 6); open(11, 6, 13, 6, 'wood');
wall(10, 7, 10, 22, 2); open(10, 14, 10, 15, 'wood');
wallT[1][3] = 3; wallT[1][4] = 3;

/* ---------- desks ---------- */
export const DESKS = [], deskById = {};
function addDesk(id, tx, ty, face, kind = 'work') {
  const seat = face === 'up' ? { tx: tx + 2, ty: ty + 2 } : { tx: tx + 2, ty: ty - 1 };
  const d = { id, tx, ty, w: 5, h: 2, face, kind, seat, screens: [] };
  DESKS.push(d); deskById[id] = d; fill(solid, tx, ty, tx + 4, ty + 1, 1);
  return d;
}
const COLS = [14, 20, 26];
['r1a', 'r1b', 'r1c'].forEach((id, i) => addDesk(id, COLS[i], 7, 'up'));
['mta', 'mtb', 'mtc'].forEach((id, i) => addDesk(id, COLS[i], 12, 'down'));
['mba', 'mbb', 'mbc'].forEach((id, i) => addDesk(id, COLS[i], 14, 'up'));
['r3a', 'r3b', 'r3c'].forEach((id, i) => addDesk(id, COLS[i], 20, 'down'));
addDesk('boss2', 3, 9, 'down', 'boss');
addDesk('boss1', 3, 18, 'up', 'boss');

/* ---------- props (furniture with a footprint) ---------- */
export const PROPS = [];
function prop(kind, tx, ty, w = 1, h = 1, extra = {}) {
  const p = Object.assign({ kind, tx, ty, w, h }, extra);
  PROPS.push(p); fill(solid, tx, ty, tx + w - 1, ty + h - 1, 1); return p;
}
prop('counter', 9, 2, 10, 1);
prop('fridge', 19, 2, 2, 1);
prop('vending', 22, 2, 2, 1);
prop('kitTable', 13, 4, 5, 1);
prop('cooler', 7, 2);
prop('plant', 1, 2, 1, 1, { v: 2 });
prop('coatRack', 1, 5);
prop('bench', 5, 5, 2, 1);
prop('plant', 8, 5, 1, 1, { v: 0 });
prop('stall', 26, 2, 2, 2);
prop('stall', 28, 2, 2, 2);
prop('sinks', 31, 2, 2, 1);
prop('plant', 32, 5, 1, 1, { v: 1 });
// bosses' room
prop('sofa', 3, 13, 4, 1);
prop('coffeeTable', 4, 15, 2, 1);
prop('plant', 1, 7, 1, 1, { v: 2 });
prop('plant', 9, 7, 1, 1, { v: 1 });
prop('plant', 1, 22, 1, 1, { v: 0 });
prop('lamp', 9, 22);
prop('plant', 8, 13, 1, 1, { v: 1 });
// open office
prop('plant', 31, 7, 1, 1, { v: 0 });
prop('plant', 32, 7, 1, 1, { v: 2 });
prop('printer', 32, 10);
prop('cabinet', 32, 12);
prop('cabinet', 32, 13);
prop('tv', 31, 15, 2, 2);
prop('plant', 32, 18, 1, 1, { v: 1 });
prop('cabinet', 32, 19);
prop('plant', 32, 22, 1, 1, { v: 2 });
prop('plant', 19, 22, 1, 1, { v: 0 });
prop('plant', 25, 22, 1, 1, { v: 1 });
prop('plant', 11, 7, 1, 1, { v: 1 });
prop('bin', 13, 22);

/* ---------- seats ---------- */
export const SEATS = [];
function addSeat(tx, ty, face, kind, desk = null) {
  const s = { id: SEATS.length, tx, ty, face, kind, desk };
  s.x = (tx + 0.5) * T;
  s.standY = (ty + 0.7) * T;
  s.hipY = face === 'up' ? ty * T + 18 : ty * T + 30; // where the cropped upper body is cut
  s.sortY = face === 'up' ? ty * T + 24 : ty * T + 12;
  SEATS.push(s); if (desk) desk.seatRef = s;
  return s;
}
DESKS.forEach(d => addSeat(d.seat.tx, d.seat.ty, d.face, d.kind === 'boss' ? 'boss' : 'desk', d));
export const KITCHEN_SEATS = [[13, 3, 'down'], [15, 3, 'down'], [17, 3, 'down'], [13, 5, 'up'], [15, 5, 'up'], [17, 5, 'up']]
  .map(([x, y, f]) => addSeat(x, y, f, 'kitchen'));

/* ---------- things you can use with E ---------- */
export const SPOTS = {
  coffee: { kind: 'coffee', tx: 10, ty: 3, face: 'up', label: 'Pegar café', icon: '☕' },
  water: { kind: 'water', tx: 7, ty: 3, face: 'up', label: 'Beber água', icon: '💧' },
  vending: { kind: 'vending', tx: 22, ty: 3, face: 'up', label: 'Lanche', icon: '🍫' },
  printer: { kind: 'printer', tx: 31, ty: 10, face: 'right', label: 'Imprimir', icon: '🖨️' },
  fridge: { kind: 'fridge', tx: 20, ty: 3, face: 'up', label: 'Geladeira', icon: '🥤' },
  sink: { kind: 'sink', tx: 31, ty: 3, face: 'up', label: 'Lavar as mãos', icon: '🫧' },
};
for (const s of Object.values(SPOTS)) { s.x = (s.tx + 0.5) * T; s.y = (s.ty + 0.6) * T; }

export const EXIT = { tx: 3, ty: 2, x: 4 * T, y: 2 * T + 14 };
export const DOOR = { x0: 3 * T, x1: 5 * T };

/* ---------- pathfinding (A*, 8-dir, no corner cutting) ---------- */
// `solid` defaults to the office; the street scene passes its own grid
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export function findPath(sx, sy, tx, ty, solid = officeSolid) {
  const MW = solid[0].length, MH = solid.length;
  if (solid[ty]?.[tx] !== 0) return null;
  const N = MW * MH, g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const hf = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const s = sy * MW + sx, t = ty * MW + tx, openL = [[hf(sx, sy), s]]; g[s] = 0;
  while (openL.length) {
    let bi = 0; for (let i = 1; i < openL.length; i++) if (openL[i][0] < openL[bi][0]) bi = i;
    const cur = openL.splice(bi, 1)[0][1];
    if (closed[cur]) continue; closed[cur] = 1;
    if (cur === t) break;
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (const [dx, dy] of D8) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || solid[ny][nx]) continue;
      if (dx && dy && (solid[cy][nx] || solid[ny][cx])) continue;
      const n = ny * MW + nx, ng = g[cur] + (dx && dy ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; came[n] = cur; openL.push([ng + hf(nx, ny), n]); }
    }
  }
  if (s !== t && came[t] < 0) return null;
  const out = []; let c = t; while (c !== s) { out.push(c); c = came[c]; } out.reverse();
  return out.map(i => ({ x: (i % MW + 0.5) * T, y: (((i / MW) | 0) + 0.7) * T }));
}

export function nearestFree(x, y) {
  const tx = Math.floor(x / T), ty = Math.floor((y - 2) / T);
  if (solid[ty]?.[tx] === 0) return { tx, ty };
  for (let r = 1; r <= 3; r++) for (const [dx, dy] of D8) {
    const nx = tx + dx * r, ny = ty + dy * r; if (solid[ny]?.[nx] === 0) return { tx: nx, ty: ny };
  }
  return { tx, ty };
}

// feet box collision for free (keyboard) movement
export function blocked(x, y) {
  for (const [px, py] of [[x - 7, y - 7], [x + 6, y - 7], [x - 7, y - 1], [x + 6, y - 1]]) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH || solid[ty][tx]) return true;
  }
  return false;
}

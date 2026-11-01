// Turn-based battles in the dungeon (and sparring in the Resenha), in the spirit of Yakuza: Like a Dragon. Turns
// go by agility. On your turn (no time limit) you can walk freely inside a circle around where your turn began
// (positioning matters: melee reaches enemies up to ATTACK_RANGE away, ranged skills CAST_RANGE, and an enemy
// only hits you if it can walk up to you on its turn) and pick a command — Atacar, Habilidades (MP, from your
// class), Guarda (half damage, a little MP back) or Fugir. Pressing Space / clicking right as a blow lands makes
// yours a perfect hit, and an enemy's a perfect guard or a parry. Skills can hit one enemy, the target and those
// near it, a line, or everyone; they inflict ailments (burn, bleed, stun, sleep…), buff you, heal, counter or
// charge a blow for the next turn. Win to get XP, job XP and money.
import { T } from './world.js';
import { CW, FOOT, SPR, frame, portrait } from './sprites.js';
import { sfx } from './sfx.js';
import * as Music from './music.js';
import { ENEMIES, STATUS, BUFF_NAME, MAGIC_EL, RANGED_EL, EL_NAME } from './rpg.js';

const MOVE_R = 3.2 * T, ATTACK_RANGE = 5 * T, CAST_RANGE = 7 * T, ENEMY_STEP = 4 * T, REACH = 30, AROUND = 1.8 * T;
const HERO_SPEED = 74, DASH = 300, ENEMY_SPEED = 120, READY = 0.24; // READY: wind-up held before your blow (anticipation, and time to react)
const ATK_WIN = 0.13, GUARD_WIN = 0.18, PARRY_WIN = 0.07; // timing windows (seconds before the impact)
const EL_COLOR = { fire: '#ff8a3a', ice: '#9fe6ff', elec: '#f5f06a', magic: '#c9a0ff', bullet: '#ffe9a0', blade: '#ffffff', blunt: '#ffd27a' };
export const battle = { active: false };
let B = null;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = a => a[Math.random() * a.length | 0];
const HIT_SFX = { stars: 'wood', punch: 'punch', concrete: 'concrete', sparks: 'metal', blueprint: 'wood' };
const EL_SFX = { fire: 'fire', ice: 'ice', elec: 'elec', magic: 'magic', blade: 'blade', bullet: 'blade', blunt: 'wood' };
const faces = {};
const BASIC = { name: 'Ataque', target: 'one', power: 1, el: 'blunt', basic: true };

/* ---------------- start / end ---------------- */
// ctx: { walker, hero, mapEnemy, depth, count?, blocked(x, y), freeNear(x, y, minTiles, maxTiles, taken), onEnd(result) }
export function startBattle(ctx) {
  const w = ctx.walker, def = ENEMIES.delinquente;
  const count = ctx.count || 1 + (ctx.depth >= 2 && Math.random() < 0.5 ? 1 : 0) + (ctx.depth >= 4 && Math.random() < 0.4 ? 1 : 0);
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const spot = i === 0 && ctx.mapEnemy && dist(ctx.mapEnemy, w) > 2.2 * T ? { x: ctx.mapEnemy.x, y: ctx.mapEnemy.y } : ctx.freeNear(w.x, w.y, 2.5, 4.5, enemies);
    const hp = Math.round(def.hp * (1 + 0.15 * (ctx.depth - 1)));
    enemies.push({ def, name: count > 1 ? `${def.name} ${'ABCDE'[i]}` : def.name, x: spot.x, y: spot.y, home: { ...spot }, hp, maxHp: hp, dir: 'down', mode: 'stand', animT: 0, hurt: 0, alive: true, fade: 1, turns: 0, fx: {}, ghost: hp, gw: 0, downT: 0, koT: 0, atkScale: 1 + 0.12 * (ctx.depth - 1) });
  }
  B = { ...ctx, enemies, phase: 'intro', t: 0, anchor: { x: w.x, y: w.y }, order: [], current: null, menu: 'root', target: 0, popups: [], guard: false, swing: 0, banner: { text: ctx.count ? 'TREINO!' : 'ENCONTRO!', t: 1.2 }, result: null, xp: 0, money: 0, buffs: {}, ail: {}, charge: null, bolt: null, wave: null, parts: [], stop: 0, shake: 0, trail: [], ha: null, flash: 0, special: false, hitAt: 0.35, slow: 0, kick: 0, cut: null, tw: null, pg: null, ws: false, lastMenu: null, menuT0: 0, hitK: 0 };
  battle.active = true;
  for (const e of enemies) face(e, w);
  w.path = []; w.mode = 'stand';
  Music.startBattle(); sfx('encounter');
}
function finish(result) {
  const cb = B.onEnd, r = { result, xp: B.xp, money: B.money };
  battle.active = false; B = null;
  Music.endBattle();
  cb?.(r);
}

/* ---------------- turn flow ---------------- */
function face(e, target) { const dx = target.x - e.x, dy = target.y - e.y; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }
const buff = k => B.buffs[k]?.v ?? 1;
const heroAgi = () => B.hero.agi * buff('agi') * (B.ail.cold ? 0.5 : 1);
const enemyAgi = e => e.def.agi * (e.fx.cold ? 0.5 : 1);
function nextTurn() {
  if (B.enemies.every(e => !e.alive)) return win();
  if (B.hero.hp <= 0) return lose();
  if (!B.order.length) B.order = [{ hero: true, agi: heroAgi() + rnd(0, 3) }, ...B.enemies.filter(e => e.alive).map(e => ({ e, agi: enemyAgi(e) + rnd(0, 3) }))].sort((a, b) => b.agi - a.agi);
  const next = B.order.shift();
  if (next.e && !next.e.alive) return nextTurn();
  B.current = next;
  return next.hero ? heroTurn() : enemyTurn(next.e);
}
function heroTurn() {
  const w = B.walker, h = B.hero;
  for (const k of Object.keys(B.buffs)) if (--B.buffs[k].t <= 0) delete B.buffs[k];
  if (B.buffs.regen) { const n = Math.round(h.maxHp * 0.08); h.hp = Math.min(h.maxHp, h.hp + n); popup(w.x, w.y - 56, '+' + n, '#7dff9a'); }
  if (tickAilments(B.ail, h.maxHp, n => { h.hp = Math.max(0, h.hp - n); popup(w.x, w.y - 56, String(n), '#ff6b6b'); })) return;
  if (h.hp <= 0) return lose();
  B.anchor = { x: w.x, y: w.y }; B.guard = false; B.menu = 'root';
  B.target = Math.max(0, B.enemies.findIndex(e => e.alive));
  if (B.ail.stun || B.ail.sleep) { popup(w.x, w.y - 74, B.ail.stun ? 'Atordoado!' : 'Dormindo…', '#ffd23a'); delete B.ail.stun; return endHeroTurn(); }
  if (B.charge) { // the charged blow lands now
    const { skill } = B.charge; let e = B.charge.e; B.charge = null;
    if (!e.alive) e = targetEnemy(); if (!e) return endHeroTurn();
    B.pending = skill; return act(e, true);
  }
  B.phase = 'command'; B.tw = null; B.lastMenu = null;
}
// damage over time + duration countdown; returns true when the unit died from it (caller stops)
function tickAilments(fx, maxHp, hurt) {
  for (const id of ['burn', 'bleed', 'poison']) if (fx[id]) hurt(Math.max(2, Math.round(maxHp * { burn: 0.07, bleed: 0.06, poison: 0.05 }[id])));
  for (const k of Object.keys(fx)) if (k !== 'stun' && k !== 'sleep' && --fx[k] <= 0) delete fx[k];
  return false;
}
function enemyTurn(e) {
  tickAilments(e.fx, e.maxHp, n => { e.hp = Math.max(0, e.hp - n); e.hurt = 0.3; popup(e.x, e.y - 50, String(n), '#ff9f80'); });
  if (e.hp <= 0) { ko(e); return endHeroTurn(); }
  let skip = null;
  if (e.fx.stun) { skip = 'Atordoado!'; delete e.fx.stun; }
  else if (e.fx.sleep) { skip = 'Zzz…'; if (--e.fx.sleep <= 0) delete e.fx.sleep; }
  else if (e.fx.shock && Math.random() < 0.5) skip = 'Paralisado!';
  if (skip) { popup(e.x, e.y - 70, skip, STATUS.stun.color); return endHeroTurn(); }
  B.phase = 'enemy'; B.step = 'move'; B.moved = 0; B.t = 0;
  B.tw = { kind: 'def', used: false }; B.pg = null; B.ws = false; // you can time a guard against this attack
}
function win() {
  B.xp = B.enemies.reduce((s, e) => s + e.def.xp, 0); B.money = B.enemies.reduce((s, e) => s + e.def.money, 0);
  const r = B.hero.gainXp(B.xp); B.ups = r.ups; B.rankUps = r.rankUps; B.hero.money += B.money; B.hero.save();
  B.phase = 'victory'; B.t = 0; B.walker.dir = 'down';
  sfx('victory'); if (B.ups) sfx('levelup');
}
function lose() { B.hero.hp = 0; B.hero.save(); B.phase = 'defeat'; B.t = 0; B.flash = 0.2; sfx('defeat'); }
function popup(x, y, text, color = '#ffffff', big = false) {
  const near = B.popups.filter(p => p.t < 0.4 && Math.abs(p.x - x) < 20 && Math.abs(p.y - y) < 30).length; // stack multi-hits
  B.popups.push({ x, y: y - near * 16, text, color, big, t: 0, dx: rnd(-8, 8) });
}
function ko(e) {
  e.alive = false; e.fx = {}; e.koT = 0; e.koDir = e.x >= B.walker.x ? 1 : -1; // falls away from you
  popup(e.x, e.y - 30, 'K.O.', '#ff5a5a');
  e.downT = 0; sfx('ko');
  if (!aliveTargets().length) { B.stop = 0.12; B.slow = 0.75; B.flash = 0.2; B.shake = 8; B.kick += 0.12; } // the finishing blow: a freeze, then slow motion
}

/* ---------------- effects: particles, hit-stop, screen shake ---------------- */
// burst kinds: class flavours (stars, punch, concrete, sparks, blueprint) and damage types (fire, ice, elec, magic, blade, bullet), plus heal, buff, dust
function burst(x, y, kind, n = 10, big = 1) {
  const P = B.parts, R = (a, b) => rnd(a, b) * big;
  const add = o => P.push({ x, y, vx: 0, vy: 0, g: 0, life: 0.6, t: 0, s: 2, c: '#fff', shape: 'sq', ...o });
  if (kind === 'stars' || kind === 'blunt') { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = R(60, 150); add({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 220, c: pick(['#ffd23a', '#fff0c8', '#ffffff']), shape: 'star', s: 3, life: 0.5 }); } add({ shape: 'ring', c: '#ffffff', life: 0.25, s: 4 }); }
  else if (kind === 'punch') { add({ shape: 'ring', c: '#ffffff', life: 0.22, s: 3 }); add({ shape: 'ring', c: '#ffd27a', life: 0.32, s: 2, t: -0.06 }); for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = R(80, 170); add({ vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: '#ffffff', s: 2, life: 0.25 }); } }
  else if (kind === 'concrete') { for (let i = 0; i < n; i++) { const a = rnd(3.4, 6.0), v = R(70, 170); add({ vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420, c: pick(['#9aa1ac', '#c9ced6', '#6d737d']), s: pick([2, 3, 4]), life: 0.8 }); } for (let i = 0; i < 5; i++) add({ x: x + rnd(-14, 14), y: y + rnd(-4, 10), vx: rnd(-20, 20), vy: rnd(-25, -5), c: 'rgba(200,196,186,.55)', shape: 'puff', s: rnd(5, 9) * big, life: 0.9 }); }
  else if (kind === 'sparks' || kind === 'fire') { const fire = kind === 'fire'; for (let i = 0; i < n + 4; i++) { const a = fire ? rnd(3.6, 5.8) : rnd(0, 6.28), v = R(90, 220); add({ vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: fire ? -60 : 380, c: pick(fire ? ['#ff8a3a', '#ffd23a', '#ff5a3a'] : ['#ffd23a', '#fff3b0', '#ff9a3a']), shape: 'streak', s: 2, life: fire ? 0.6 : 0.45 }); } }
  else if (kind === 'blueprint' || kind === 'magic') { const bp = kind === 'blueprint' || B.hero.cls.fx === 'blueprint'; add({ shape: 'grid', c: bp ? '#6fb6ff' : '#c9a0ff', life: 0.45, s: 18 * big }); for (let i = 0; i < n; i++) add({ x: x + rnd(-18, 18), y: y + rnd(-16, 12), vy: rnd(-50, -20), c: pick(bp ? ['#6fb6ff', '#d8ecff', '#2d6cdf'] : ['#c9a0ff', '#ffffff', '#ff9cf0']), shape: bp ? 'line' : 'star', s: bp ? rnd(4, 9) : 2, life: 0.7 }); }
  else if (kind === 'elec') { for (let i = 0; i < 4; i++) add({ shape: 'bolt', c: pick(['#f5f06a', '#ffffff']), life: 0.25, s: rnd(14, 22) * big, a: rnd(0, 6.28) }); }
  else if (kind === 'ice') { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = R(50, 130); add({ vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, c: pick(['#9fe6ff', '#ffffff', '#5fb8e6']), shape: 'shard', s: 3, life: 0.6 }); } }
  else if (kind === 'blade' || kind === 'bullet') { add({ shape: 'slash', c: '#ffffff', life: 0.2, s: 22 * big, a: rnd(-0.8, -0.3) }); for (let i = 0; i < n / 2; i++) add({ vx: rnd(-80, 80), vy: rnd(-80, 20), g: 300, c: '#e03a3a', s: 2, life: 0.4 }); }
  else if (kind === 'heal' || kind === 'buff') { for (let i = 0; i < n; i++) add({ x: x + rnd(-14, 14), y: y + rnd(-10, 30), vy: rnd(-60, -30), c: kind === 'heal' ? pick(['#7dff9a', '#c8ffd4']) : pick(['#9fd3ff', '#ffffff']), shape: kind === 'heal' ? 'plus' : 'sq', s: 3, life: 0.8 }); }
  else if (kind === 'dust') { for (let i = 0; i < n; i++) add({ x: x + rnd(-6, 6), vx: rnd(-30, 30), vy: rnd(-20, -5), c: 'rgba(170,160,150,.5)', shape: 'puff', s: rnd(3, 5), life: 0.45 }); }
}
function impact(crit) { B.stop = Math.max(B.stop, crit ? 0.11 : 0.06); B.shake = Math.max(B.shake, crit ? 7 : 3.5); if (crit) B.flash = Math.max(B.flash, 0.14); B.kick += crit ? 0.07 : 0.03; }
export const battleShake = () => (B && B.shake > 0 ? { x: rnd(-1, 1) * B.shake, y: rnd(-1, 1) * B.shake * 0.6 } : { x: 0, y: 0 });
/* ---------------- fighter poses ----------------
   Every fighter (your character, whoever it is, and each enemy) is drawn through a pose built from the battle
   state each frame: lean (skew from the feet up), squash/stretch, hop, sidestep, fall, and a hit flash (a white
   silhouette, then red). So any sprite sheet gets a fighting stance, wind-ups, lunges, recoils, dodges, guard
   crouches, knock-downs and victory hops without extra frames. */
const ease = k => k * k * (3 - 2 * k);
const sils = new WeakMap();
function silhouette(fr, color) {
  let m = sils.get(fr); if (!m) sils.set(fr, m = {});
  if (!m[color]) { const c = document.createElement('canvas'); c.width = fr.width; c.height = fr.height; const g = c.getContext('2d'); g.drawImage(fr, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); m[color] = c; }
  return m[color];
}
const pose0 = f => ({ f, dx: 0, ax: 0, dy: 0, sx: 1, sy: 1, lean: 0, rot: 0, flash: 0, flashColor: '#ffffff' });
const faceOf = (o, tx) => (o.dir === 'left' ? -1 : o.dir === 'right' ? 1 : tx !== undefined && tx < o.x ? -1 : 1);
// strike curve (p 0..1): wind-up (lean back, squash) → strike (lunge `reach` px, stretch) → recover
function strikeCurve(P, p, reach) {
  if (p < 0.35) { const k = ease(p / 0.35); P.lean = -0.15 * k; P.sy = 1 - 0.07 * k; P.sx = 1 + 0.05 * k; P.dx = -2 * k; }
  else if (p < 0.6) { const k = (p - 0.35) / 0.25; P.lean = -0.15 + 0.4 * k; P.sy = 0.93 + 0.13 * k; P.sx = 1.05 - 0.1 * k; P.dx = -2 + (reach + 2) * k; }
  else { const k = ease((p - 0.6) / 0.4); P.lean = 0.25 * (1 - k); P.sy = 1.06 - 0.06 * k; P.sx = 0.95 + 0.05 * k; P.dx = reach * (1 - k); }
}
// your character's pose (null outside battles); P.swing drives the weapon
export function heroPose(t, w) {
  if (!B) return null;
  const tgt = B.phase === 'enemy' ? B.current.e : targetEnemy() || B.victim, P = pose0(faceOf(w, tgt?.x));
  P.swing = B.swing; P.hand = B.hitK % 2;
  const bob = Math.sin(t * 7); P.sy = 1 + bob * 0.022; P.sx = 1 - bob * 0.014; // fighting stance: bouncing on the toes
  if (w.mode === 'walk') P.lean = 0.07;
  if (B.guard && B.phase !== 'command') { P.sy = 0.92; P.sx = 1.05; P.lean = -0.05; }
  if (B.charge) { P.sy = 0.9 + 0.02 * Math.sin(t * 30); P.sx = 1.06; P.lean = 0.06; P.ax = rnd(-0.7, 0.7); P.flash = 0.25 + 0.2 * Math.sin(t * 18); P.flashColor = '#ffd23a'; }
  if (B.phase === 'action' && B.step === 'dash') { P.lean = 0.22; P.sy = 1.04; P.sx = 0.96; }
  else if (B.swing > 0) strikeCurve(P, 1 - B.swing / 0.35, B.step === 'cast' ? 1 : 5);
  if (B.phase === 'action' && B.step === 'ready') P.ax = rnd(-0.6, 0.6); // coiled, trembling before the blow
  if (B.phase === 'action' && B.step === 'cast') P.dy = -4 * Math.sin(Math.min(1, B.t / 0.7) * Math.PI);
  const a = B.ha;
  if (a) {
    const k = Math.min(1, a.t / a.dur), r = (1 - k) * (1 - k), s = Math.sin(k * Math.PI);
    if (a.kind === 'hurt') { P.lean = -0.24 * r; P.dx = -7 * r; P.sy = 1 - 0.05 * r; P.flash = a.t < 0.09 ? 1 : 0.65 * r; P.flashColor = a.t < 0.09 ? '#ffffff' : '#ff3030'; }
    else if (a.kind === 'block') { P.dx = -4 * r; P.sy = 0.92; P.sx = 1.05; P.flash = 0.6 * r; P.flashColor = '#9fd3ff'; }
    else if (a.kind === 'pguard') { P.dx = -2 * r; P.sy = 0.94; P.sx = 1.04; P.flash = 0.85 * r; P.flashColor = '#ffd23a'; }
    else if (a.kind === 'dodge') { P.ax = a.side * 16 * s; P.dy = -5 * s; P.lean = -0.12 * s; }
    else if (a.kind === 'cheer') { P.dy = -8 * s; P.sy = 1 + 0.08 * s; P.sx = 1 - 0.05 * s; P.flash = 0.35 * s; P.flashColor = a.color; }
  }
  if (B.phase === 'victory') { const h = B.t < 1.25 ? Math.abs(Math.sin(B.t * 5)) : 0; P.dy = -9 * h; P.sy = 1 + 0.05 * h; P.lean = 0; P.swing = 0.2275; } // hops with the weapon raised
  if (B.phase === 'defeat') { const k = ease(Math.min(1, B.t / 0.45)); P.rot = -P.f * Math.PI / 2 * k; P.lean = 0; P.dx = 0; P.swing = 0; }
  return P;
}
function enemyPose(e, t) {
  const w = B.walker, P = pose0(e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : e.x <= w.x ? 1 : -1);
  const bob = Math.sin(t * 6 + e.x * 0.05); P.sy = 1 + bob * 0.02; P.sx = 1 - bob * 0.012;
  if (e.mode === 'walk') P.lean = 0.1;
  if (B.phase === 'enemy' && B.current.e === e && B.step === 'swing') {
    const hit = B.hitAt, up = hit - 0.1;
    if (B.t < up) { const k = ease(B.t / up); P.lean = -0.17 * k; P.sy = 1 - 0.08 * k; P.sx = 1 + 0.06 * k; P.dx = -3 * k; if (B.special) { P.flash = 0.25 + 0.25 * Math.sin(t * 40); P.flashColor = '#ff3030'; P.ax = rnd(-0.8, 0.8); } }
    else if (B.t < hit + 0.02) { const k = Math.min(1, (B.t - up) / 0.12); P.lean = -0.17 + 0.45 * k; P.sy = 0.92 + 0.14 * k; P.sx = 1.06 - 0.11 * k; P.dx = -3 + 11 * k; }
    else { const k = ease(Math.min(1, (B.t - hit - 0.02) / 0.35)); P.lean = 0.28 * (1 - k); P.sy = 1.06 - 0.06 * k; P.sx = 0.95 + 0.05 * k; P.dx = 8 * (1 - k); }
  }
  if (e.alive && e.fx.stun) P.rot = 0.08 * Math.sin(t * 9);
  if (e.alive && e.fx.sleep) { P.lean = 0.12; P.sy = 0.94; }
  if (e.hurt > 0) { const r = e.hurt / 0.3; P.lean = -0.22 * r; P.dx = -5 * r; P.flash = e.hurt > 0.22 ? 1 : 0.5 * r; P.flashColor = e.hurt > 0.22 ? '#ffffff' : '#ff5050'; }
  if (e.alive && e.downT > 0) { // knocked down by a critical: falls, bounces, gets back up
    const d = 0.9 - e.downT, a = d < 0.18 ? ease(d / 0.18) : d < 0.6 ? 1 : 1 - ease((d - 0.6) / 0.3);
    P.rot = e.koDir * Math.PI / 2 * a; P.lean = 0; P.dx = 0; if (d > 0.18 && d < 0.3) P.dy = -2 * Math.sin((d - 0.18) / 0.12 * Math.PI);
  }
  if (!e.alive) { const k = Math.min(1, e.koT / 0.4); P.rot = e.koDir * Math.PI / 2 * ease(k); P.dy = -6 * Math.sin(k * Math.PI); P.lean = 0; P.dx = 0; P.flash = Math.max(0, 0.8 - e.koT * 3); P.flashColor = '#ffffff'; }
  return P;
}
function applyPose(g, x, y, P) {
  g.translate(Math.round(x + P.f * P.dx + P.ax), Math.round(y + P.dy));
  if (P.rot) g.rotate(P.rot);
  g.transform(P.sx, 0, -P.f * P.lean, P.sy, 0, 0);
  g.translate(-x, -y);
}
// one fighter: shadow on the floor, then the sprite (with `behind` / `front` drawn under the same pose, e.g. the
// weapon) and the hit flash
export function paintFighter(g, fr, x, y, P, alpha = 1, behind = null, front = null) {
  const air = P ? Math.max(0, -P.dy) : 0, lying = P ? Math.abs(Math.sin(P.rot)) : 0, shx = P ? x + P.f * P.dx + P.ax : x;
  g.fillStyle = `rgba(0,0,0,${0.35 * alpha})`; g.beginPath(); g.ellipse(shx + (P ? P.rot * 14 : 0), y - 1, Math.max(4, 10 - air * 0.4 + lying * 16), Math.max(1.5, 3.5 - air * 0.12), 0, 0, Math.PI * 2); g.fill();
  g.save(); if (P) applyPose(g, x, y, P);
  g.globalAlpha = alpha; behind?.();
  const px = Math.round(x - CW / 2), py = Math.round(y - FOOT);
  g.drawImage(fr, px, py);
  if (P && P.flash > 0) { g.globalAlpha = alpha * Math.min(1, P.flash); g.drawImage(silhouette(fr, P.flashColor), px, py); g.globalAlpha = alpha; }
  front?.();
  g.restore(); g.globalAlpha = 1;
}
// afterimages behind you while you dash in
export const heroTrail = () => (B ? B.trail : []);
export function paintGhost(g, fr, x, y, color, a) { g.globalAlpha = a; g.drawImage(silhouette(fr, color), Math.round(x - CW / 2), Math.round(y - FOOT)); g.globalAlpha = 1; }

/* ---------------- damage ---------------- */
function hitEnemy(e, s, k = 0) {
  const h = B.hero, el = s.el || 'blunt', magic = MAGIC_EL.has(el);
  let p = s.rand ? rnd(s.rand[0], s.rand[1]) : (s.power ?? 1);
  if (s.lowHp) p *= 1 + (1 - h.hp / h.maxHp);
  if (s.bonus && e.fx[s.bonus[0]]) p *= s.bonus[1];
  const stat = magic ? h.mag * buff('mag') : h.atk * buff('atk');
  const def = e.def.def * (e.fx.defDown ? 0.5 : 1) * (e.fx.rage ? 0.5 : 1);
  let dmg = Math.max(1, stat * p * rnd(0.9, 1.1) - def * 0.6);
  const weak = e.def.weak?.[el] || 1; dmg *= weak;
  const crit = Math.random() < 0.08 + (s.crit || 0);
  if (crit) dmg *= 1.5;
  const perfect = B.tw?.kind === 'atk' && B.tw.ok; // timed press
  if (perfect) dmg *= 1.3;
  dmg = Math.round(dmg);
  e.gw = 0.35; e.hp = Math.max(0, e.hp - dmg); e.hurt = 0.3;
  if (e.fx.sleep) delete e.fx.sleep; // a hit wakes them up
  popup(e.x, e.y - 50, String(dmg), crit ? '#ffd23a' : EL_COLOR[el] && el !== 'blunt' ? EL_COLOR[el] : '#ffffff', crit || dmg > 40);
  burst(e.x, e.y - 28, el === 'blunt' ? (B.hero.cls.fx || 'stars') : el, crit ? 16 : 10, crit ? 1.3 : 1); impact(crit);
  sfx(el === 'blunt' ? HIT_SFX[B.hero.cls.fx] || 'wood' : EL_SFX[el] || 'wood'); if (crit) sfx('crit');
  if (perfect && k === 0) { popup(e.x - 20, e.y - 86, 'PERFEITO!', '#ffd23a', true); sfx('perfect'); B.flash = Math.max(B.flash, 0.08); }
  if (k === 0 && crit) popup(e.x, e.y - 72, 'CRÍTICO!', '#ffd23a');
  if (k === 0 && weak > 1) popup(e.x + 24, e.y - 64, 'FRACO!', '#7dff9a');
  if (!RANGED_EL.has(el)) { // knockback from melee
    const kb = 6 / Math.max(1, dist(e, B.walker)); e.x += (e.x - B.walker.x) * kb; e.y += (e.y - B.walker.y) * kb;
    if (B.blocked(e.x, e.y)) { e.x -= (e.x - B.walker.x) * kb; e.y -= (e.y - B.walker.y) * kb; }
  }
  if (crit && e.hp > 0 && !RANGED_EL.has(el) && !e.downT) { e.downT = 0.9; e.koDir = e.x >= B.walker.x ? 1 : -1; popup(e.x + 20, e.y - 40, 'Caiu!', '#ffb36b'); }
  if (!e.hp) ko(e);
}
function inflict(e, [id, chance]) {
  if (!e.alive || Math.random() >= chance) return;
  e.fx[id] = STATUS[id].turns; popup(e.x, e.y - 84, STATUS[id].name, STATUS[id].color);
}
function hitHero(e, power, special) {
  const w = B.walker, h = B.hero, pg = B.pg; B.pg = null;
  if (pg === 'parry') { // perfect timing: no damage, and you hit back
    popup(w.x, w.y - 92, 'CONTRA-ATAQUE!', '#ffd23a', true); sfx('parry');
    B.ha = { kind: 'pguard', t: 0, dur: 0.3 }; B.flash = Math.max(B.flash, 0.12); burst((w.x + e.x) / 2, w.y - 30, 'sparks', 14);
    B.swing = 0.35; hitEnemy(e, { power: 1.2, el: 'blunt' }); return;
  }
  if (!pg && e.fx.confused && Math.random() < 0.5) { popup(e.x, e.y - 70, 'Tonto… errou!', STATUS.confused.color); sfx('swoosh'); return; }
  if (!pg && Math.random() < 0.05 + Math.max(0, heroAgi() - enemyAgi(e)) * 0.01 + (B.buffs.eva ? 0.35 : 0)) { popup(w.x, w.y - 56, 'Esquivou!', '#9fd3ff'); B.ha = { kind: 'dodge', t: 0, dur: 0.38, side: w.x >= e.x ? 1 : -1 }; sfx('dodge'); return; }
  const atk = e.def.atk * e.atkScale * (e.fx.fear ? 0.65 : 1) * (e.fx.rage ? 1.4 : 1) * (e.fx.cold ? 0.85 : 1) * (e.fx.atkDown ? 0.7 : 1);
  let dmg = Math.max(1, Math.round(atk * power * rnd(0.85, 1.15) - h.def * buff('def') * 0.5));
  if (pg === 'guard') dmg = Math.max(1, Math.round(dmg * 0.25));
  else if (B.guard) dmg = Math.max(1, Math.round(dmg / 2));
  const counter = B.buffs.counter; if (counter) dmg = Math.max(1, Math.round(dmg / 2));
  if (dmg >= h.hp && B.buffs.guardian) { dmg = h.hp - 1; delete B.buffs.guardian; popup(w.x, w.y - 92, 'Aguentou firme!', '#7dff9a'); }
  h.hp = Math.max(0, h.hp - dmg); impact(power > 1);
  popup(w.x, w.y - 56, String(dmg), '#ff6b6b', power > 1);
  if (pg === 'guard') { popup(w.x, w.y - 92, 'DEFESA PERFEITA!', '#9fd3ff', true); sfx('perfectGuard'); burst((w.x + e.x) / 2, w.y - 30, 'sparks', 10); B.ha = { kind: 'pguard', t: 0, dur: 0.3 }; }
  else if (B.guard) { popup(w.x, w.y - 76, 'Guarda', '#9fd3ff'); sfx('block'); burst(w.x, w.y - 28, 'punch', 6); B.ha = { kind: 'block', t: 0, dur: 0.3 }; }
  else { sfx('hurt'); burst(w.x, w.y - 28, 'punch', 8); B.ha = { kind: 'hurt', t: 0, dur: 0.42 }; }
  if (special?.status && h.hp > 0 && !pg && !B.buffs.resist && Math.random() < special.status[1]) { const [id] = special.status; B.ail[id] = STATUS[id].turns; popup(w.x, w.y - 92, STATUS[id].name, STATUS[id].color); }
  if (counter && h.hp > 0) { delete B.buffs.counter; popup(w.x, w.y - 92, 'Revide!', '#ffd27a'); B.swing = 0.35; hitEnemy(e, { power: 1.3, el: 'blunt' }); }
}

/* ---------------- commands ---------------- */
function aliveTargets() { return B.enemies.filter(e => e.alive); }
function targetEnemy() { const al = B.enemies; const i = B.target; for (let k = 0; k < al.length; k++) { const e = al[(i + k) % al.length]; if (e.alive) return e; } return null; }
function choose(action) {
  if (B.phase !== 'command') return;
  if (action === 'attack') { B.pending = BASIC; B.menu = 'target'; sfx('blip'); }
  else if (action === 'skills') { B.menu = 'skills'; sfx('blip'); }
  else if (action === 'guard') { B.guard = true; B.hero.mp = Math.min(B.hero.maxMp, B.hero.mp + 2); popup(B.walker.x, B.walker.y - 56, 'Guarda', '#9fd3ff'); sfx('block'); endHeroTurn(); }
  else if (action === 'flee') {
    if (Math.random() < 0.55 + (heroAgi() - 7) * 0.03) { popup(B.walker.x, B.walker.y - 56, 'Fugiu!', '#ffffff'); sfx('dash'); B.phase = 'fled'; B.t = 0; }
    else { popup(B.walker.x, B.walker.y - 56, 'Não deu pra fugir!', '#ff9f80'); sfx('error'); endHeroTurn(); }
  }
}
function chooseSkill(i) {
  const s = B.hero.skills()[i];
  if (!s) return;
  if (B.hero.mp < s.mp) { popup(B.walker.x, B.walker.y - 56, 'MP insuficiente', '#4fe0d0'); sfx('error'); return; }
  B.pending = s; sfx('blip');
  if (s.target === 'self') { B.hero.mp -= s.mp; selfSkill(s); endHeroTurn(); }
  else if (s.target === 'all') { const e = targetEnemy(); if (!e) return; B.hero.mp -= s.mp; if (s.charge) { B.charge = { skill: s, e }; cutin(s.name, 'Carregando', '#ffd23a'); sfx('charge'); popup(B.walker.x, B.walker.y - 52, 'Carregando…', '#ffd23a'); burst(B.walker.x, B.walker.y - 20, 'buff', 10); endHeroTurn(); } else act(e, false); }
  else B.menu = 'target';
}
function selfSkill(s) {
  const w = B.walker, h = B.hero;
  cutin(s.name, B.hero.cls.name, '#f2c14e');
  B.ha = { kind: 'cheer', t: 0, dur: 0.5, color: s.heal || s.rand ? '#7dff9a' : '#9fd3ff' };
  if (s.roulette) return roulette();
  const heal = s.rand ? rnd(s.rand[0], s.rand[1]) : s.heal;
  if (heal) { const n = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * heal)); h.hp += n; popup(w.x, w.y - 56, '+' + n, '#7dff9a', true); burst(w.x, w.y - 20, 'heal', 14); sfx('heal'); }
  if (s.buff || s.randomBuff) { burst(w.x, w.y - 20, 'buff', 12); sfx('buff'); }
  if (s.cleanse) B.ail = {};
  const add = (k, v) => { B.buffs[k] = { v: v === true ? 1 : v, t: 3 }; popup(w.x + 20, w.y - 64 - Object.keys(B.buffs).length * 4, BUFF_NAME[k], '#9fd3ff'); };
  if (s.buff) for (const [k, v] of Object.entries(s.buff)) add(k, v);
  if (s.randomBuff) { const [k, v] = pick([['atk', 1.5], ['def', 1.7], ['agi', 1.6], ['mag', 1.5], ['eva', true]]); add(k, v); }
}
function roulette() {
  const w = B.walker, h = B.hero, r = Math.random(); sfx('magic');
  if (r < 0.35) { popup(w.x, w.y - 96, 'JACKPOT!', '#ffd23a', true); for (const e of aliveTargets()) hitEnemy(e, { power: 2.6, el: 'blunt' }); }
  else if (r < 0.6) { popup(w.x, w.y - 96, 'Banca paga: vida cheia', '#7dff9a'); h.hp = h.maxHp; }
  else if (r < 0.8) { popup(w.x, w.y - 96, 'Todos atordoados!', '#ffd23a'); for (const e of aliveTargets()) e.fx.stun = 1; }
  else { const n = Math.round(h.maxHp * 0.2); h.hp = Math.max(1, h.hp - n); popup(w.x, w.y - 96, 'A casa ganhou…', '#ff6b6b'); popup(w.x, w.y - 56, String(n), '#ff6b6b'); }
}
const isRanged = s => RANGED_EL.has(s.el) || (!s.power && !s.rand); // pure ailment skills are cast from where you stand
function confirmTarget() {
  const e = targetEnemy(), s = B.pending;
  if (!e) return;
  if (dist(e, B.walker) > (isRanged(s) ? CAST_RANGE : ATTACK_RANGE)) { popup(B.walker.x, B.walker.y - 56, 'Longe demais!', '#ff9f80'); sfx('error'); return; }
  if (!s.basic) B.hero.mp -= s.mp;
  if (s.charge) { B.charge = { skill: s, e }; cutin(s.name, 'Carregando', '#ffd23a'); sfx('charge'); popup(B.walker.x, B.walker.y - 52, 'Carregando…', '#ffd23a'); return endHeroTurn(); }
  act(e, false);
}
// play the pending skill/attack against e (dash in for melee, cast from here for ranged/'all')
function act(e, charged) {
  const s = B.pending, w = B.walker;
  B.phase = 'action'; B.t = 0; B.victim = e; B.hitDone = false;
  B.tw = { kind: 'atk', used: false, ok: false }; B.hitK = 0; // you can time this blow
  if (!s.basic) cutin(charged ? s.name + '!' : s.name, charged ? 'Golpe carregado' : B.hero.cls.name, charged ? '#ffd23a' : '#f2c14e');
  if (isRanged(s) || s.target === 'all') {
    B.step = 'cast'; w.setDir(e.x - w.x, e.y - w.y); B.swing = 0.35; sfx(isRanged(s) ? 'cast' : 'swoosh');
    const targets = s.target === 'all' ? aliveTargets() : [e];
    if (isRanged(s)) B.bolt = { targets, t: 0, color: s.el === 'magic' && B.hero.cls.fx === 'blueprint' ? '#6fb6ff' : EL_COLOR[s.el] || '#c9a0ff' }; else { B.wave = { t: 0 }; burst(w.x, w.y, 'dust', 10); }
    return;
  }
  B.step = 'dash'; sfx('dash');
  const ang = Math.atan2(w.y - e.y, w.x - e.x);
  B.dashTo = { x: e.x + Math.cos(ang) * 26, y: e.y + Math.sin(ang) * 14 };
  if (B.blocked(B.dashTo.x, B.dashTo.y)) B.dashTo = { x: w.x, y: w.y };
}
function resolve() {
  const s = B.pending, e = B.victim, w = B.walker;
  let targets;
  if (s.target === 'all') targets = aliveTargets();
  else if (s.target === 'around') targets = aliveTargets().filter(o => o === e || dist(o, e) < AROUND);
  else if (s.target === 'line') {
    const dx = e.x - w.x, dy = e.y - w.y, L = Math.hypot(dx, dy) || 1;
    targets = aliveTargets().filter(o => { const u = ((o.x - w.x) * dx + (o.y - w.y) * dy) / L, v = Math.abs((o.x - w.x) * dy - (o.y - w.y) * dx) / L; return o === e || (u > 0 && u < L + T && v < 22); });
  } else targets = e.alive ? [e] : [];
  // multi-hit skills land one blow at a time (the weapon swings again for each), ailments after the last one
  const hits = s.power || s.rand ? s.hits || 1 : 0, gap = 0.13;
  B.queue = [];
  for (let k = 0; k < hits; k++) B.queue.push({ at: B.t + k * gap, run: () => { B.hitK = k; if (k > 0 && B.step === 'swing') { B.swing = 0.35 * 0.55; sfx('swoosh'); } for (const o of targets) if (o.alive) hitEnemy(o, s, k); } });
  B.queue.push({ at: B.t + Math.max(0, hits - 1) * gap, run: () => { for (const o of targets) { if (s.status) inflict(o, s.status); if (s.randomStatus) inflict(o, pick(s.randomStatus)); } } });
  B.endAt = B.t + Math.max(0, hits - 1) * gap + (B.step === 'cast' ? 0.5 : 0.42);
}
function endHeroTurn() { B.phase = 'pause'; B.t = 0; B.menu = 'root'; B.tw = null; }
function cutin(text, sub, color) { B.cut = { text, sub, color, t: 0 }; }
// time left until the current blow lands (yours or the enemy's), or null when there's nothing to time
function timeToImpact() {
  if (B.phase === 'action' && !B.hitDone) return B.step === 'ready' ? READY - B.t + 0.075 : B.step === 'swing' ? 0.18 - B.t : B.step === 'cast' ? 0.32 - B.t : 1;
  if (B.phase === 'enemy' && !B.hitDone) return B.step === 'swing' ? B.hitAt - B.t : 1;
  return null;
}
// the timing button (Space / Enter / F / click) during a blow, one try each: on yours, a perfect hit (+30%); on
// the enemy's, a perfect guard (a quarter of the damage) or, right at the impact, a parry (no damage + a counter)
function press() {
  const tti = timeToImpact();
  if (!B.tw || B.tw.used || tti === null) return;
  B.tw.used = true;
  const w = B.walker;
  if (B.tw.kind === 'atk') { if (tti >= 0 && tti <= ATK_WIN) B.tw.ok = true; else popup(w.x, w.y - 80, 'Cedo!', '#9aa1ac'); }
  else if (tti >= 0 && tti <= PARRY_WIN) B.pg = 'parry';
  else if (tti >= 0 && tti <= GUARD_WIN) B.pg = 'guard';
  else popup(w.x, w.y - 80, 'Cedo!', '#9aa1ac');
}

/* ---------------- input ---------------- */
// returns true when the key was used by the battle UI
export function battleKey(code) {
  if (!B) return false;
  if (B.phase === 'victory' || B.phase === 'defeat') { if (code === 'Enter' || code === 'Space') { B.t = 99; return true; } return false; }
  if ((B.phase === 'action' || B.phase === 'enemy') && (code === 'Space' || code === 'Enter' || code === 'KeyF')) { press(); return true; }
  if (B.phase !== 'command') return false;
  const n = /^(Digit|Numpad)([1-9])$/.exec(code)?.[2] - 1;
  const hasN = Number.isInteger(n);
  if (B.menu === 'root' && hasN && n < 4) { choose(['attack', 'skills', 'guard', 'flee'][n]); return true; }
  if (B.menu === 'skills') { if (hasN) { chooseSkill(n); return true; } if (code === 'Escape' || code === 'Backspace') { B.menu = 'root'; return true; } }
  if (B.menu === 'target') {
    if (code === 'Tab' || code === 'KeyQ' || code === 'KeyE') { const al = B.enemies; for (let k = 1; k <= al.length; k++) { const i = (B.target + (code === 'KeyQ' ? -k : k) + al.length * 3) % al.length; if (al[i].alive) { B.target = i; break; } } sfx('tick'); return true; }
    if (code === 'Enter' || code === 'Space') { confirmTarget(); return true; }
    if (code === 'Escape' || code === 'Backspace') { B.menu = B.pending.basic ? 'root' : 'skills'; return true; }
  }
  return false;
}
let menuRects = [];
// world (wx, wy) and screen (sx, sy) coordinates of a click
export function battleClick(wx, wy, sx, sy) {
  if (!B) return;
  if (B.phase === 'victory' || B.phase === 'defeat') { B.t = 99; return; }
  if (B.phase === 'action' || B.phase === 'enemy') { press(); return; }
  if (B.phase !== 'command') return;
  const hit = menuRects.find(m => sx >= m.x && sx <= m.x + m.w && sy >= m.y && sy <= m.y + m.h);
  if (hit) { hit.run(); return; }
  const i = B.enemies.findIndex(e => e.alive && Math.abs(wx - e.x) < 16 && wy > e.y - 56 && wy < e.y + 4);
  if (i >= 0) {
    B.target = i;
    if (B.menu === 'target') confirmTarget();
    else if (B.menu === 'root') { B.pending = BASIC; confirmTarget(); }
  }
}
export const overBattleTarget = (wx, wy) => !!B && B.enemies.some(e => e.alive && Math.abs(wx - e.x) < 16 && wy > e.y - 56 && wy < e.y + 4);

/* ---------------- update ---------------- */
function moveToward(o, to, speed, dt) {
  const dx = to.x - o.x, dy = to.y - o.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const s = Math.min(d, speed * dt), nx = o.x + dx / d * s, ny = o.y + dy / d * s;
  if (!B.blocked(nx, o.y)) o.x = nx; if (!B.blocked(o.x, ny)) o.y = ny;
  o.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  o.mode = 'walk'; o.animT = (o.animT || 0) + dt * 10;
  return d - s < 1;
}
export function updateBattle(dt, keys) {
  if (!B) return;
  const w = B.walker;
  if (B.cut && (B.cut.t += dt) > 1.3) B.cut = null;
  if (B.slow > 0) { B.slow -= dt; dt *= 0.3; } // slow motion after the finishing blow
  B.shake = Math.max(0, B.shake - dt * 30);
  for (const p of B.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  B.parts = B.parts.filter(p => p.t < p.life);
  B.flash = Math.max(0, B.flash - dt);
  if (B.stop > 0) { B.stop -= dt; return; } // hit-stop: everything freezes for a beat on impact
  B.t += dt;
  if (B.ha && (B.ha.t += dt) > B.ha.dur) B.ha = null;
  for (const tr of B.trail) tr.a -= dt * 2.6; B.trail = B.trail.filter(tr => tr.a > 0);
  if (B.phase === 'action' && B.step === 'dash' && Math.abs(B.t - (B.trailT ?? -1)) > 0.03) { B.trail.push({ x: w.x, y: w.y, a: 0.45 }); B.trailT = B.t; }
  if (B.charge && Math.random() < dt * 30) B.parts.push({ x: w.x + rnd(-12, 12), y: w.y - rnd(0, 10), vx: 0, vy: rnd(-70, -40), g: 0, life: 0.5, t: 0, s: 2, c: pick(['#ffd23a', '#fff3b0']), shape: 'sq' });
  if (B.banner) { B.banner.t -= dt; if (B.banner.t <= 0) B.banner = null; }
  for (const p of B.popups) p.t += dt; B.popups = B.popups.filter(p => p.t < 1.3);
  for (const e of B.enemies) {
    e.hurt = Math.max(0, e.hurt - dt); e.downT = Math.max(0, e.downT - dt);
    if ((e.gw -= dt) <= 0) e.ghost = Math.max(e.hp, e.ghost - e.maxHp * 0.9 * dt); // the pale chunk of HP drains after a beat
    if (!e.alive && (e.koT += dt) > 0.55) e.fade = Math.max(0, e.fade - dt * 2.2);
    if (e.mode === 'stand') e.animT += dt;
  }
  if (!(B.phase === 'action' && B.step === 'ready')) B.swing = Math.max(0, B.swing - dt); // held raised during the wind-up
  if (B.bolt) B.bolt.t += dt; if (B.wave) B.wave.t += dt;
  w.mode = 'stand';

  if (B.phase === 'intro') { if (B.t > 1.1) nextTurn(); return; }
  if (B.phase === 'pause') { if (B.t > 0.5) nextTurn(); return; }
  if (B.phase === 'victory' || B.phase === 'defeat') { if (B.t > 3.2) finish(B.phase === 'victory' ? 'win' : 'lose'); return; }
  if (B.phase === 'fled') { if (B.t > 0.8) finish('fled'); return; }

  if (B.phase === 'command') {
    let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx || vy) { // free movement inside the circle
      const n = Math.hypot(vx, vy), s = HERO_SPEED * dt; vx /= n; vy /= n;
      const nx = w.x + vx * s, ny = w.y + vy * s;
      if (!B.blocked(nx, w.y) && Math.hypot(nx - B.anchor.x, w.y - B.anchor.y) <= MOVE_R) w.x = nx;
      if (!B.blocked(w.x, ny) && Math.hypot(w.x - B.anchor.x, ny - B.anchor.y) <= MOVE_R) w.y = ny;
      w.setDir(vx, vy); w.mode = 'walk'; w.animT += dt * 8;
    } else { const e = targetEnemy(); if (e) w.setDir(e.x - w.x, e.y - w.y); }
    for (const e of aliveTargets()) { // enemies shuffle around their spot while you think
      if (e.fx.sleep || e.fx.stun || e.downT > 0) { e.mode = 'stand'; continue; }
      if (!e.wander || dist(e, e.wander) < 2) e.wander = { x: e.home.x + rnd(-14, 14), y: e.home.y + rnd(-10, 10) };
      if (B.blocked(e.wander.x, e.wander.y)) e.wander = { ...e.home };
      moveToward(e, e.wander, 18, dt); face(e, w); if (dist(e, e.wander) < 2) e.mode = 'stand';
    }
    return;
  }

  if (B.phase === 'action') {
    const e = B.victim;
    if (B.step === 'dash') { if (moveToward(w, B.dashTo, DASH, dt) || B.t > 1.2) { B.step = 'ready'; B.t = 0; B.swing = 0.35 * 0.7; w.setDir(e.x - w.x, e.y - w.y); } else { w.mode = 'walk'; w.animT += dt * 14; if (Math.random() < dt * 20) burst(w.x, w.y, 'dust', 2); } }
    else if (B.step === 'ready') { if (B.t > READY) { B.step = 'swing'; B.t = 0.105; sfx('swoosh'); } }
    else {
      if ((B.step === 'swing' && B.t > 0.18 || B.step === 'cast' && B.t > 0.32) && !B.hitDone) { B.hitDone = true; resolve(); }
      while (B.queue?.length && B.t >= B.queue[0].at) B.queue.shift().run();
      if (B.hitDone && !B.queue?.length && B.t > B.endAt) { B.hitDone = false; B.bolt = B.wave = null; for (const o of B.enemies) o.home = { x: o.x, y: o.y }; endHeroTurn(); }
    }
    return;
  }

  if (B.phase === 'enemy') {
    const e = B.current.e;
    if (B.step === 'swing' && !B.ws && B.t > B.hitAt - 0.1) { B.ws = true; sfx('swoosh'); }
    if (B.step === 'move') {
      if (e.downT > 0) { B.t = 0; return; } // still getting up
      const d = dist(e, w), aim = { x: w.x + (e.x < w.x ? -24 : 24), y: w.y };
      const before = { x: e.x, y: e.y };
      const arrived = d <= REACH || moveToward(e, aim, ENEMY_SPEED * (e.fx.cold ? 0.6 : 1), dt);
      B.moved += Math.hypot(e.x - before.x, e.y - before.y);
      if (Math.random() < dt * 14) burst(e.x, e.y, 'dust', 1);
      if (dist(e, w) <= REACH + 4 || arrived) { // squares up; a special move gets a longer, telegraphed wind-up
        e.mode = 'stand'; face(e, w); B.step = 'swing'; B.t = 0; e.turns++;
        const sp = e.def.special; B.special = !!(sp && !e.fx.silence && e.turns % sp.every === 0); B.hitAt = B.special ? 0.62 : 0.35; B.ws = false;
        if (B.special) { cutin(sp.name, e.name, '#ff5a5a'); sfx('warn'); }
      }
      else if (B.moved >= ENEMY_STEP * (e.fx.cold ? 0.6 : 1) || B.t > 2) { e.mode = 'stand'; popup(e.x, e.y - 56, 'Não alcança…', '#cfd3da'); e.home = { x: e.x, y: e.y }; endHeroTurn(); }
    } else if (B.step === 'swing' && B.t > B.hitAt && !B.hitDone) {
      B.hitDone = true;
      hitHero(e, B.special ? e.def.special.power : 1, B.special ? e.def.special : null);
    } else if (B.step === 'swing' && B.hitDone && B.t > B.hitAt + 0.5) { B.hitDone = false; e.home = { x: e.x, y: e.y }; endHeroTurn(); }
  }
}

/* ---------------- drawing ---------------- */
export function battleDrawables(t) {
  if (!B) return [];
  return B.enemies.filter(e => e.fade > 0 && SPR[e.def.sprite]).map(e => ({
    s: e.y, draw: g => {
      const fr = e.mode === 'walk' ? frame(e.def.sprite, 'walk', e.dir, Math.floor(e.animT)) : frame(e.def.sprite, 'stand', e.dir, Math.floor(t * 1.4) % 2);
      paintFighter(g, fr, e.x, e.y, enemyPose(e, t), e.fade);
      if (e.alive && (e.fx.sleep || e.fx.stun)) { // little stars / Zzz over the head
        g.fillStyle = e.fx.sleep ? '#9fd3ff' : '#ffd23a';
        for (let k = 0; k < 3; k++) { const a = t * 3 + k * 2.1; g.fillRect(Math.round(e.x + Math.cos(a) * 10) - 1, Math.round(e.y - 62 + Math.sin(a) * 3) - 1, 3, 3); }
      }
    },
  }));
}
export function drawBattleWorld(g, t) {
  if (!B) return;
  const w = B.walker;
  if (B.phase === 'command') {
    g.save(); g.setLineDash([5, 4]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(242,193,78,.75)';
    g.beginPath(); g.ellipse(B.anchor.x, B.anchor.y, MOVE_R, MOVE_R * 0.62, 0, 0, Math.PI * 2); g.stroke(); g.restore();
    const r = B.menu === 'target' && isRanged(B.pending) ? CAST_RANGE : ATTACK_RANGE;
    g.strokeStyle = 'rgba(255,90,90,.35)'; g.setLineDash([2, 5]); g.beginPath(); g.ellipse(w.x, w.y, r, r * 0.62, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    const e = targetEnemy();
    if (e && B.menu !== 'skills') {
      const ay = Math.round(e.y - 82 + Math.sin(t * 6) * 2.5); g.fillStyle = '#1c1f27'; g.beginPath(); g.moveTo(e.x - 6, ay - 1); g.lineTo(e.x + 6, ay - 1); g.lineTo(e.x, ay + 7); g.fill(); g.fillStyle = '#ff4a4a'; g.beginPath(); g.moveTo(e.x - 4, ay); g.lineTo(e.x + 4, ay); g.lineTo(e.x, ay + 5); g.fill(); // target arrow
      g.strokeStyle = `rgba(255,70,70,${0.7 + 0.3 * Math.sin(t * 8)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(e.x, e.y - 1, 14, 6, 0, 0, Math.PI * 2); g.stroke();
      if (B.menu === 'target' && B.pending.target === 'around') { g.strokeStyle = 'rgba(255,120,90,.45)'; g.setLineDash([3, 3]); g.beginPath(); g.ellipse(e.x, e.y, AROUND, AROUND * 0.62, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      if (B.menu === 'target' && B.pending.target === 'line') { g.strokeStyle = 'rgba(255,120,90,.45)'; g.lineWidth = 14; g.beginPath(); g.moveTo(w.x, w.y - 4); g.lineTo(e.x, e.y - 4); g.stroke(); }
    }
    g.lineWidth = 1;
  }
  if (B.bolt) { // projectile for ranged skills
    const k = Math.min(1, B.bolt.t / 0.32);
    for (const e of B.bolt.targets) {
      const x = w.x + (e.x - w.x) * k, y = w.y - 26 + (e.y - 26 - (w.y - 26)) * k;
      g.globalCompositeOperation = 'lighter'; g.fillStyle = B.bolt.color;
      g.globalAlpha = 0.35; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      if (k >= 1) { g.globalAlpha = Math.max(0, 1 - (B.bolt.t - 0.32) * 2.5); g.beginPath(); g.arc(e.x, e.y - 26, 18, 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
  }
  const tti = timeToImpact(); // timing cue: a ring closing in on the impact, gold inside the window
  if (B.tw && !B.tw.used && tti !== null && tti >= 0 && tti < 0.6) {
    const o = B.tw.kind === 'atk' ? B.victim : w, inWin = tti <= (B.tw.kind === 'atk' ? ATK_WIN : GUARD_WIN), r = 9 + tti * 70;
    g.strokeStyle = inWin ? '#ffd23a' : 'rgba(255,255,255,.75)'; g.lineWidth = inWin ? 2.5 : 1.5; g.beginPath(); g.ellipse(o.x, o.y - 26, r, r * 0.9, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,210,60,.55)'; g.lineWidth = 1; g.beginPath(); g.ellipse(o.x, o.y - 26, 9, 8, 0, 0, Math.PI * 2); g.stroke();
  }
  if (B.guard && B.phase !== 'command') { g.strokeStyle = `rgba(159,211,255,${0.35 + 0.15 * Math.sin(t * 6)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(w.x, w.y - 26, 18, 30, 0, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1; }
  if (B.phase === 'action' && B.step === 'cast' && B.t < 0.34 && B.bolt) { // energy gathering in the hand
    const f = faceOf(w, B.victim?.x); g.globalCompositeOperation = 'lighter'; g.fillStyle = B.bolt.color;
    g.globalAlpha = 0.35; g.beginPath(); g.arc(w.x + f * 10, w.y - 27, 9 + 3 * Math.sin(t * 30), 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.9; g.beginPath(); g.arc(w.x + f * 10, w.y - 27, 3 + B.t * 8, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  if (B.phase === 'enemy' && B.step === 'swing') {
    const e = B.current.e, f = e.x <= w.x ? 1 : -1;
    if (B.special && B.t < B.hitAt - 0.1) { const y = Math.round(e.y - 76 + Math.sin(t * 20) * 1.5); g.fillStyle = '#1c1f27'; g.fillRect(e.x - 4, y - 1, 8, 15); g.fillStyle = '#ff3b3b'; g.fillRect(e.x - 3, y, 6, 8); g.fillRect(e.x - 3, y + 10, 6, 3); } // telegraph
    const k = (B.t - (B.hitAt - 0.1)) / 0.22;
    if (k > 0 && k < 1) { const a0 = f > 0 ? -1.3 : Math.PI + 1.3; g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(e.x + f * 8, e.y - 28, 18, Math.min(a0, a0 + f * 2.4 * ease(k)), Math.max(a0, a0 + f * 2.4 * ease(k))); g.stroke(); g.lineWidth = 1; } // swoosh of the blow
  }
  for (const p of B.parts) {
    if (p.t < 0) continue;
    const k = p.t / p.life, x = Math.round(p.x), y = Math.round(p.y);
    g.globalAlpha = Math.max(0, 1 - k * k); g.fillStyle = p.c; g.strokeStyle = p.c;
    if (p.shape === 'sq') g.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    else if (p.shape === 'star') { g.fillRect(x - 1, y - p.s, 2, p.s * 2); g.fillRect(x - p.s, y - 1, p.s * 2, 2); }
    else if (p.shape === 'plus') { g.fillRect(x - 1, y - 3, 2, 6); g.fillRect(x - 3, y - 1, 6, 2); }
    else if (p.shape === 'streak') { g.lineWidth = p.s; g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * 0.04, y - p.vy * 0.04); g.stroke(); }
    else if (p.shape === 'puff') { g.beginPath(); g.arc(x, y, p.s * (1 + k), 0, Math.PI * 2); g.fill(); }
    else if (p.shape === 'ring') { g.lineWidth = p.s * (1 - k) + 1; g.beginPath(); g.ellipse(x, y, 6 + k * 26, 4 + k * 18, 0, 0, Math.PI * 2); g.stroke(); }
    else if (p.shape === 'line') { g.fillRect(x - p.s / 2, y, p.s, 1); g.fillRect(x, y - p.s / 2, 1, p.s); }
    else if (p.shape === 'shard') { g.beginPath(); g.moveTo(x, y - p.s); g.lineTo(x + p.s / 2, y); g.lineTo(x, y + p.s); g.lineTo(x - p.s / 2, y); g.fill(); }
    else if (p.shape === 'grid') { g.lineWidth = 1; const r = p.s * (0.6 + k * 0.6); g.strokeRect(x - r, y - r * 0.7, r * 2, r * 1.4); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * r * 0.66, y - r * 0.7); g.lineTo(x + i * r * 0.66, y + r * 0.7); g.moveTo(x - r, y + i * r * 0.46); g.lineTo(x + r, y + i * r * 0.46); g.stroke(); } }
    else if (p.shape === 'bolt') { g.lineWidth = 2; g.beginPath(); let bx = x, by = y; g.moveTo(bx, by); for (let i = 0; i < 4; i++) { bx += Math.cos(p.a) * p.s / 4 + rnd(-4, 4); by += Math.sin(p.a) * p.s / 4 + rnd(-4, 4); g.lineTo(bx, by); } g.stroke(); }
    else if (p.shape === 'slash') { g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.moveTo(x - Math.cos(p.a) * p.s, y - Math.sin(p.a) * p.s); g.lineTo(x + Math.cos(p.a) * p.s, y + Math.sin(p.a) * p.s); g.stroke(); }
  }
  g.globalAlpha = 1; g.lineWidth = 1;
  if (B.wave) { const r = B.wave.t * 260; g.strokeStyle = `rgba(255,210,122,${Math.max(0, 1 - B.wave.t * 1.4)})`; g.lineWidth = 3; g.beginPath(); g.ellipse(w.x, w.y, r, r * 0.62, 0, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1; }
}

function bar(ctx, x, y, w, h, k, col, back) { ctx.fillStyle = back; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, k)), h); }
const TARGET_NAME = { one: 'um alvo', around: 'área', all: 'todos', line: 'linha', self: 'você' };
export function drawBattleHud(ctx, vw, vh, t, toScreen) {
  if (!B) return;
  if (B.flash > 0) { ctx.fillStyle = B.phase === 'defeat' ? `rgba(255,40,40,${B.flash * 1.6})` : `rgba(255,255,255,${B.flash * 2.2})`; ctx.fillRect(0, 0, vw, vh); } // impact flash
  const hk = B.hero.hp / B.hero.maxHp;
  if (hk < 0.3 && B.phase !== 'victory') { // low HP: the screen edges pulse red
    const a = (0.3 - hk) / 0.3 * (0.35 + 0.15 * Math.sin(t * 6)), gr = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    gr.addColorStop(0, 'rgba(200,0,0,0)'); gr.addColorStop(1, `rgba(200,0,0,${a})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, vh);
  }
  const font = (wt, px) => `${wt} ${px}px "Pixelify Sans", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  // enemy names, HP and ailments over their heads
  for (const e of B.enemies) {
    if (!e.alive) continue;
    const p = toScreen(e.x, e.y - 60);
    ctx.font = font(600, 11); const tw = ctx.measureText(e.name).width;
    ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(p.x - Math.max(tw, 60) / 2 - 6, p.y - 16, Math.max(tw, 60) + 12, 24);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(e.name, p.x, p.y - 9);
    bar(ctx, p.x - 30, p.y, 60, 4, e.ghost / e.maxHp, '#fff1c0', '#3a1010'); ctx.fillStyle = '#e03a3a'; ctx.fillRect(p.x - 30, p.y, 60 * Math.max(0, e.hp / e.maxHp), 4);
    const tags = Object.keys(e.fx).filter(k => STATUS[k]);
    ctx.font = font(600, 9);
    tags.forEach((k, i) => { const y = p.y + 12 + i * 12, s = STATUS[k].name, sw = ctx.measureText(s).width + 8; ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(p.x - sw / 2, y - 5, sw, 11); ctx.fillStyle = STATUS[k].color; ctx.fillText(s, p.x, y + 1); });
    ctx.textAlign = 'left';
  }
  // damage numbers
  for (const pp of B.popups) {
    const p = toScreen(pp.x, pp.y), k = pp.t / 1.3, pop = pp.t < 0.1 ? 1.7 - 7 * pp.t : 1; // numbers pop in big, hop, then float up
    const px = p.x + (pp.dx || 0) * k * 3, py = p.y - k * 30 - (pp.t < 0.1 ? 0 : Math.sin(Math.min(1, (pp.t - 0.1) / 0.25) * Math.PI) * 6);
    ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    ctx.font = font(700, Math.round((pp.big ? 26 : 18) * pop)); ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(pp.text, px, py); ctx.fillStyle = pp.color; ctx.fillText(pp.text, px, py);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  // your buffs and ailments, in a column left of the status card
  const chips = [...Object.keys(B.buffs).map(k => [BUFF_NAME[k], '#9fd3ff']), ...Object.keys(B.ail).map(k => [STATUS[k].name, STATUS[k].color])];
  if (B.charge) chips.unshift(['Carregado', '#ffd23a']);
  const small = vw < 600, s = small ? 0.85 : 1, cardW = (small ? 0.75 : 1) * 320;
  ctx.font = font(600, 11);
  chips.forEach(([txt, col], i) => { const x = vw - cardW - 24 - ctx.measureText(txt).width - 12, y = vh - 24 - i * 20; ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x, y - 8, ctx.measureText(txt).width + 12, 17); ctx.fillStyle = col; ctx.fillText(txt, x + 6, y + 1); });
  // turn order: who acts now (big) and who's next this round
  if (B.current && B.phase !== 'victory' && B.phase !== 'defeat' && B.phase !== 'fled') {
    const q = [B.current, ...B.order].filter(o => o.hero || o.e.alive).slice(0, 6), total = 34 + (q.length - 1) * 30, x0 = vw - 16 - total;
    q.forEach((o, i) => {
      const id = o.hero ? B.walker.id : o.e.def.sprite, sz = i ? 26 : 34, x = i ? x0 + 38 + (i - 1) * 30 : x0, y = i ? 66 : 62; // under the HUD buttons
      if (!SPR[id]) return;
      const img = faces[id] || (faces[id] = portrait(id, 34));
      ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(x - 2, y - 2, sz + 4, sz + 4);
      ctx.fillStyle = i === 0 ? '#f2c14e' : o.hero ? '#5d8fd6' : '#c9483b'; ctx.fillRect(x - 2, y + sz, sz + 4, 2);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(img, x, y, sz, sz);
      if (!o.hero && B.enemies.length > 1) { ctx.font = font(700, 10); ctx.fillStyle = '#ffffff'; ctx.fillText(o.e.name.slice(-1), x + 2, y + sz - 5); }
    });
  }
  // timing hint while a blow is coming
  const tti = timeToImpact();
  if (B.tw && !B.tw.used && tti !== null && tti >= 0 && tti < 0.6) {
    const msg = B.tw.kind === 'atk' ? 'ESPAÇO no impacto: golpe perfeito' : 'ESPAÇO na hora do golpe: defesa perfeita';
    ctx.font = font(700, 13); const mw2 = ctx.measureText(msg).width;
    ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(vw / 2 - mw2 / 2 - 10, 100, mw2 + 20, 22);
    ctx.fillStyle = tti <= (B.tw.kind === 'atk' ? ATK_WIN : GUARD_WIN) ? '#ffd23a' : '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(msg, vw / 2, 111); ctx.textAlign = 'left';
  }
  // whose turn
  const who = B.phase === 'command' ? 'SUA VEZ' : B.phase === 'enemy' ? `Vez: ${B.current.e.name}` : '';
  if (who) {
    ctx.font = font(700, 18); const tw = ctx.measureText(who).width;
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(vw / 2 - tw / 2 - 18, 58, tw + 36, 30);
    ctx.fillStyle = B.phase === 'command' ? '#f2c14e' : '#ff8a7a'; ctx.textAlign = 'center'; ctx.fillText(who, vw / 2, 73); ctx.textAlign = 'left';
  }
  // command list, Yakuza-style, above the status card
  menuRects = [];
  if (B.phase === 'command') {
    if (B.menu !== B.lastMenu) { B.lastMenu = B.menu; B.menuT0 = t; } // the list slides in on every change
    const mw = 290 * s, xm = vw - mw - 12, items = [];
    if (B.menu === 'root') items.push(['1', 'Atacar', () => choose('attack')], ['2', 'Habilidades', () => choose('skills')], ['3', 'Guarda', () => choose('guard')], ['4', 'Fugir', () => choose('flee')]);
    else if (B.menu === 'skills') { B.hero.skills().forEach((sk, i) => items.push([String(i + 1), sk.name, () => chooseSkill(i), B.hero.mp < sk.mp, `${sk.mp} MP`, `${sk.el ? EL_NAME[sk.el] + ' · ' : ''}${TARGET_NAME[sk.target]}`])); items.push(['Esc', 'Voltar', () => { B.menu = 'root'; }]); }
    else if (B.menu === 'target') items.push(['Tab', 'Trocar alvo', () => battleKey('Tab')], ['Enter', `${B.pending.name}!`, () => confirmTarget()], ['Esc', 'Voltar', () => { B.menu = B.pending.basic ? 'root' : 'skills'; }]);
    const ih = 30 * s, y0 = vh - (small ? 84 : 116) - items.length * (ih + 4) - 10;
    items.forEach(([k, label, run, off, right, sub], i) => {
      const y = y0 + i * (ih + 4), sl = ease(Math.max(0, Math.min(1, (t - B.menuT0 - i * 0.035) / 0.14))), x = xm + (1 - sl) * 90;
      ctx.globalAlpha = sl;
      ctx.fillStyle = 'rgba(0,0,0,.86)'; ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + mw, y); ctx.lineTo(x + mw - 10, y + ih); ctx.lineTo(x, y + ih); ctx.fill();
      ctx.fillStyle = off ? '#5d6470' : '#f2c14e'; ctx.fillRect(x + 12, y + 6 * s, 30 * s, ih - 12 * s);
      ctx.fillStyle = '#111'; ctx.font = font(700, 11 * s); ctx.textAlign = 'center'; ctx.fillText(k, x + 12 + 15 * s, y + ih / 2); ctx.textAlign = 'left';
      ctx.fillStyle = off ? '#7d858f' : '#ffffff'; ctx.font = font(600, (sub ? 13 : 14) * s); ctx.fillText(label, x + 52 * s, y + (sub ? ih / 2 - 5 * s : ih / 2));
      if (sub) { ctx.font = font(400, 9 * s); ctx.fillStyle = '#9aa1ac'; ctx.fillText(sub, x + 52 * s, y + ih / 2 + 8 * s); }
      if (right) { ctx.font = font(700, 11 * s); ctx.fillStyle = off ? '#5d6470' : '#4fe0d0'; ctx.textAlign = 'right'; ctx.fillText(right, x + mw - 18 * s, y + ih / 2); ctx.textAlign = 'left'; }
      ctx.globalAlpha = 1;
      menuRects.push({ x: xm, y, w: mw, h: ih, run: off ? () => popup(B.walker.x, B.walker.y - 56, 'MP insuficiente', '#4fe0d0') : run });
    });
    const hint = B.menu === 'root' ? 'Ande dentro do círculo · clique num inimigo pra atacar' : B.menu === 'target' && !B.pending.basic ? B.pending.desc : '';
    if (hint) { ctx.font = font(600, 11); const hw = ctx.measureText(hint).width; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(vw - hw - 24, y0 - 22, hw + 12, 16); ctx.fillStyle = '#cfd3da'; ctx.fillText(hint, vw - hw - 18, y0 - 14); }
  }
  // skill name cut-in, sliding in from the left (gold: yours, red: an enemy's special)
  if (B.cut) {
    const c = B.cut, k = c.t, slide = k < 0.16 ? ease(k / 0.16) : k > 1.05 ? 1 - ease(Math.min(1, (k - 1.05) / 0.22)) : 1;
    const bw = Math.min(460, vw * 0.7), bh = 46, y = Math.round(Math.max(vh * 0.2, 236)), x = Math.round(-bw * (1 - slide));
    ctx.fillStyle = 'rgba(0,0,0,.9)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw - 26, y + bh); ctx.lineTo(x, y + bh); ctx.fill();
    ctx.fillStyle = c.color; ctx.fillRect(x, y, bw - 1, 3); ctx.fillRect(x, y + bh - 3, bw - 25, 3);
    ctx.font = font(600, 11); ctx.fillStyle = '#9aa1ac'; ctx.fillText(c.sub, x + 24, y + 13);
    ctx.font = font(700, 22); ctx.fillStyle = c.color; ctx.fillText(c.text, x + 24, y + 31);
  }
  // banners
  if (B.banner) {
    const a = Math.min(1, B.banner.t / 0.3);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(160,20,30,.85)'; ctx.fillRect(0, vh * 0.32 - 30, vw, 60);
    ctx.font = font(700, 34); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(B.banner.text, vw / 2, vh * 0.32); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  if (B.phase === 'victory' || B.phase === 'defeat') {
    const win = B.phase === 'victory', a = Math.min(1, B.t / 0.4);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(vw / 2 - 190, vh * 0.3 - 50, 380, win ? 150 : 90);
    ctx.font = font(700, 30); ctx.textAlign = 'center'; ctx.fillStyle = win ? '#f2c14e' : '#ff6b6b'; ctx.fillText(win ? 'VITÓRIA!' : 'VOCÊ APAGOU…', vw / 2, vh * 0.3 - 18);
    ctx.font = font(600, 15); ctx.fillStyle = '#ffffff';
    if (win) {
      const kx = Math.min(1, B.t / 0.9); ctx.fillText(`+${Math.round(B.xp * kx)} XP   +R$ ${Math.round(B.money * kx)}`, vw / 2, vh * 0.3 + 16); // counts up
      if (B.ups) { ctx.fillStyle = '#7dff9a'; ctx.fillText(`Subiu para o nível ${B.hero.level}! Vida e MP cheios`, vw / 2, vh * 0.3 + 42); }
      if (B.rankUps) { ctx.fillStyle = '#9fd3ff'; ctx.fillText(`${B.hero.cls.name}: rank ${B.hero.job.rank}!`, vw / 2, vh * 0.3 + (B.ups ? 66 : 42)); }
    } else ctx.fillText(B.count ? 'Fim do treino' : 'Você acorda na Sala da Resenha', vw / 2, vh * 0.3 + 16);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}
// camera framing for main.js: the action (you and your target / the attacker), a little closer during blows,
// closest in the slow motion of a finishing blow; zoomKick() hands over the punch-in of the latest hits
export function battleFocus() {
  if (!B) return null;
  const w = B.walker, o = B.phase === 'action' ? B.victim : B.phase === 'enemy' ? B.current.e : B.phase === 'command' ? targetEnemy() : null;
  const z = B.slow > 0 ? 1.16 : B.phase === 'victory' ? 1.12 : B.phase === 'action' ? 1.08 : B.phase === 'enemy' ? 1.04 : 1, k = B.phase === 'command' ? 0.3 : 0.5;
  return o ? { x: w.x + (o.x - w.x) * k, y: w.y + (o.y - w.y) * k, z } : { x: w.x, y: w.y, z };
}
export const battleState = () => B; // for debugging from the console
export function zoomKick() { if (!B) return 0; const k = Math.min(0.15, B.kick); B.kick = 0; return k; }
// leaving the basement mid-fight (HUD button, timer started): drop the battle without results
export function abortBattle() { if (!B) return; battle.active = false; B = null; }

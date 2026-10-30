// People in the office: movement, animation, and the small "life" AI that turns a
// timesheet status (working / break / offline) into walking, sitting and coffee runs.
import { T, KITCHEN_SEATS, SPOTS, EXIT, deskById, findPath, nearestFree, blocked } from './world.js';
import { CW, FOOT, SPR, frame, outline } from './sprites.js';
import { drawChair } from './art.js';

const WALK_AI = 58, WALK = 74, RUN = 146;
const ERRANDS = ['water', 'coffee', 'printer', 'vending', 'fridge'];

export class Actor {
  constructor(def) {
    Object.assign(this, def);
    this.x = 0; this.y = 0; this.dir = 'down'; this.mode = 'stand';
    this.path = []; this.plan = []; this.seat = null; this.alpha = 1;
    this.animT = 0; this.phase = Math.random() * 10; this.emote = null; this.carry = null;
    this.controlled = false; this.running = false; this.waitT = 0;
    this.errandIn = 60 + Math.random() * 140;
    this.since = Date.now() - (def.status === 'working' ? (1 + Math.random() * 4) * 3600e3 : (4 + Math.random() * 20) * 60e3);
    this.hoursToday = def.status === 'offline' ? 0 : 1 + Math.random() * 5;
    this.ownSeat = deskById[def.desk].seatRef;
    if (def.status === 'offline') { this.mode = 'gone'; this.alpha = 0; }
    else if (def.status === 'working') this.sitAt(this.ownSeat);
    else { const s = KITCHEN_SEATS.find(k => !k.occupant); if (s) this.sitAt(s); else this.placeAt(EXIT.x, EXIT.y + T); this.carry = 'coffee'; }
  }

  /* ---------- basic actions ---------- */
  placeAt(x, y) { this.x = x; this.y = y; }
  sitAt(s) {
    if (s.occupant && s.occupant !== this) return false;
    this.leaveSeat();
    s.occupant = this; s.claim = null; this.seat = s; this.mode = 'sit'; this.dir = s.face; this.path = [];
    this.x = s.x; this.y = s.standY;
    return true;
  }
  leaveSeat() { if (this.seat) { if (this.seat.occupant === this) this.seat.occupant = null; this.seat = null; } }
  standUp() { if (this.mode === 'sit') { const s = this.seat; this.leaveSeat(); this.x = s.x; this.y = s.standY; this.mode = 'stand'; } }

  goTo(tx, ty, x, y) {
    if (this.mode === 'sit') this.standUp();
    const st = nearestFree(this.x, this.y);
    const p = findPath(st.tx, st.ty, tx, ty);
    if (!p) return false;
    if (p.length) p[p.length - 1] = { x: x ?? p[p.length - 1].x, y: y ?? p[p.length - 1].y };
    else p.push({ x: x ?? this.x, y: y ?? this.y });
    this.path = p; this.mode = 'walk';
    return true;
  }
  setEmote(icon, secs = 2.5) { this.emote = { icon, until: performance.now() + secs * 1000 }; }

  get sortY() { return this.mode === 'sit' ? this.seat.sortY + 1 : this.y; }
  get headX() { return this.x; }
  get headY() { return this.mode === 'sit' ? this.seat.hipY - this.sitH() - 4 : this.y - SPR[this.id].meta.down.h - 4; }
  sitH() { return Math.round(SPR[this.id].meta[this.seat ? this.seat.face : 'down'].h * 0.6); }
  hit(wx, wy) {
    if (this.mode === 'gone') return false;
    if (this.mode === 'sit') return Math.abs(wx - this.x) < 13 && wy > this.seat.hipY - this.sitH() && wy < this.seat.hipY + 4;
    return Math.abs(wx - this.x) < 12 && wy > this.y - SPR[this.id].meta.down.h && wy < this.y + 2;
  }

  /* ---------- status → plan ---------- */
  setStatus(st) {
    if (st === this.status) return;
    this.status = st; this.since = Date.now();
    this.plan = []; this.waitT = 0; this.leaving = false;
    if (!this.controlled) { this.path = []; if (this.mode === 'walk') this.mode = 'stand'; }
  }

  makePlan(game) {
    const st = this.status;
    if (this.outside) return; // out on the street (outside.js); comes back in through 'appear'
    if (this.leaving) { this.plan.push({ type: 'go', spot: EXIT }, { type: 'vanish', out: true }); return; }
    if (this.mode === 'gone') {
      if (st === 'offline') return;
      this.plan.push({ type: 'appear' });
      return;
    }
    if (st === 'offline') { this.plan.push({ type: 'go', spot: EXIT }, { type: 'vanish' }); return; }
    if (st === 'working') {
      if (this.seat === this.ownSeat) {
        if (this.errandIn <= 0) {
          this.errandIn = 90 + Math.random() * 200;
          const spot = SPOTS[ERRANDS[(Math.random() * ERRANDS.length) | 0]];
          this.plan.push({ type: 'go', spot }, { type: 'wait', t: 2.5 + Math.random() * 2, spot }, { type: 'go', seat: this.ownSeat }, { type: 'sit', seat: this.ownSeat });
        }
        return;
      }
      this.plan.push({ type: 'go', seat: this.ownSeat }, { type: 'sit', seat: this.ownSeat });
      return;
    }
    // break
    if (this.seat && this.seat.kind === 'kitchen') return;
    if (!this.carry) this.plan.push({ type: 'go', spot: SPOTS.coffee }, { type: 'wait', t: 3, spot: SPOTS.coffee });
    const free = KITCHEN_SEATS.filter(s => !s.occupant && !s.claim);
    if (free.length) {
      const s = free[(Math.random() * free.length) | 0]; s.claim = this;
      this.plan.push({ type: 'go', seat: s }, { type: 'sit', seat: s });
    } else this.plan.push({ type: 'go', spot: SPOTS.vending }, { type: 'wait', t: 20, spot: SPOTS.vending });
  }

  runStep(dt, game) {
    const s = this.plan[0];
    if (!s) return;
    if (!s.started) {
      s.started = true;
      if (s.type === 'go') {
        const target = s.seat ? { tx: s.seat.tx, ty: s.seat.ty, x: s.seat.x, y: s.seat.standY } : { tx: s.spot.tx, ty: s.spot.ty, x: s.spot.x, y: s.spot.y };
        if (s.seat && s.seat.occupant && s.seat.occupant !== this) { this.plan = []; return; }
        if (!this.goTo(target.tx, target.ty, target.x, target.y)) { this.plan.shift(); return; }
      } else if (s.type === 'wait') {
        this.waitT = s.t; this.dir = s.spot.face; this.mode = 'stand';
        this.setEmote(s.spot.icon, s.t);
        if (s.spot.kind === 'coffee') game.brewing = s.t;
        if (s.spot.kind === 'printer') game.printing = s.t;
      } else if (s.type === 'appear') {
        this.x = EXIT.x; this.y = EXIT.y; this.mode = 'stand'; this.dir = 'down'; this.alpha = 0;
      }
    }
    switch (s.type) {
      case 'go': if (!this.path.length) { this.mode = 'stand'; this.plan.shift(); } break;
      case 'sit': if (!this.sitAt(s.seat)) { this.plan = []; } else this.plan.shift(); break;
      case 'wait':
        this.waitT -= dt;
        if (this.waitT <= 0) { if (s.spot.kind === 'coffee') this.carry = 'coffee'; if (s.spot.kind === 'vending') this.carry = 'snack'; this.plan.shift(); }
        break;
      case 'appear': this.alpha = Math.min(1, this.alpha + dt * 2); if (this.alpha >= 1) { this.plan.shift(); game.onArrive?.(this); } break;
      case 'vanish':
        this.dir = 'up'; this.alpha -= dt * 2;
        if (this.alpha <= 0) {
          this.alpha = 0; this.mode = 'gone'; this.carry = null; this.plan.shift();
          if (s.out) { this.leaving = false; this.outside = true; game.onExit?.(this); }
        }
        break;
    }
  }

  /* ---------- per-frame ---------- */
  update(dt, game) {
    if (this.emote && performance.now() > this.emote.until) this.emote = null;
    if (this.status === 'working' && this.seat === this.ownSeat) { this.errandIn -= dt; this.hoursToday += dt / 3600; }
    if (this.status === 'break' && this.seat?.kind === 'kitchen' && Math.random() < dt / 25) this.setEmote(this.carry === 'snack' ? '🍫' : '☕', 2);
    if (this.carry && this.status === 'working' && this.seat === this.ownSeat && Math.random() < dt / 120) this.carry = null;

    if (this.controlled) {
      this.plan = [];
      const k = game.keys;
      if (this.mode === 'sit' && (k.up || k.down || k.left || k.right)) this.standUp();
      if (this.mode === 'walk' || this.mode === 'stand') this.moveByKeys(dt, game);
      if (this.pendingSeat && !this.path.length && this.mode !== 'sit') {
        const s = this.pendingSeat; this.pendingSeat = null;
        if (Math.hypot(this.x - s.x, this.y - s.standY) < 6) this.sitAt(s);
      }
    } else {
      if (!this.plan.length) this.makePlan(game);
      this.runStep(dt, game);
    }
    if (this.path.length) this.followPath(dt, this.controlled ? (this.running ? RUN : WALK) : WALK_AI);
    if (this.mode === 'walk' && !this.path.length && !this.keyMoving) this.mode = 'stand';
    this.animT += dt * (this.mode === 'walk' ? (this.running ? 13 : 8) : 1);
  }

  moveByKeys(dt, game) {
    const k = game.keys;
    let vx = (k.right ? 1 : 0) - (k.left ? 1 : 0), vy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    this.keyMoving = !!(vx || vy);
    this.running = k.run;
    if (!this.keyMoving) return;
    this.path = []; game.clickTarget = null; this.pendingSeat = null;
    const n = Math.hypot(vx, vy); vx /= n; vy /= n;
    const sp = (k.run ? RUN : WALK) * dt;
    if (!blocked(this.x + vx * sp, this.y)) this.x += vx * sp;
    if (!blocked(this.x, this.y + vy * sp)) this.y += vy * sp;
    this.setDir(vx, vy); this.mode = 'walk';
    if (k.run && Math.random() < dt * 14) game.dust(this.x, this.y);
  }

  setDir(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy) * 1.1) this.dir = dx < 0 ? 'left' : 'right';
    else if (Math.abs(dy) > 0.01) this.dir = dy < 0 ? 'up' : 'down';
  }

  followPath(dt, speed) {
    let rem = speed * dt;
    while (rem > 0 && this.path.length) {
      const p = this.path[0], dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
      if (d < 0.01) { this.path.shift(); continue; }
      this.setDir(dx, dy);
      if (d <= rem) { this.x = p.x; this.y = p.y; this.path.shift(); rem -= d; }
      else { this.x += dx / d * rem; this.y += dy / d * rem; rem = 0; }
    }
    this.mode = this.path.length ? 'walk' : 'stand';
  }

  /* ---------- drawing ---------- */
  draw(g, t, ring) {
    if (this.mode === 'gone') return;
    g.globalAlpha = this.alpha;
    const breathI = Math.floor(t * 1.4 + this.phase) % 2;
    if (this.mode === 'sit') {
      const s = this.seat, m = SPR[this.id].meta[s.face], h = this.sitH();
      const typing = this.status === 'working' && s === this.ownSeat && ((t + this.phase) % 5) < 3;
      const dy = typing ? Math.floor(t * 7 + this.phase) % 2 : 0;
      const fr = frame(this.id, 'sit', s.face, breathI);
      drawChair(g, s, 'base');
      const dx = Math.round(s.x - CW / 2), y0 = s.hipY - h + dy;
      if (ring) g.drawImage(outline(fr, ring), 0, m.top, CW + 2, h + 1, dx - 1, y0 - 1, CW + 2, h + 1);
      g.drawImage(fr, 0, m.top, CW, h, dx, y0, CW, h);
      drawChair(g, s, 'back');
    } else {
      const pose = this.mode === 'walk' ? 'walk' : 'stand';
      const fi = pose === 'walk' ? Math.floor(this.animT) : breathI;
      const fr = frame(this.id, pose, this.dir, fi);
      g.fillStyle = 'rgba(8,12,24,.28)'; g.beginPath(); g.ellipse(this.x, this.y - 1, 10, 3.5, 0, 0, Math.PI * 2); g.fill();
      const dx = Math.round(this.x - CW / 2), dy = Math.round(this.y - FOOT);
      if (ring) g.drawImage(outline(fr, ring), dx - 1, dy - 1);
      g.drawImage(fr, dx, dy);
    }
    g.globalAlpha = 1;
  }
}

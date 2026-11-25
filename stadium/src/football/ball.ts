// Ball physics, kicking, and what happens when the ball meets a body.
import { chance, gauss, rnd, rndRange } from "../core/rng";
import { DT, type Actor } from "../core/types";
import { clamp } from "../core/vec";
import type { World } from "../core/world";
import { HL, HW, PITCH, TUNE } from "./config";
import type { MatchState, TeamIdx } from "./types";
import { dirOf, inBox, isDown, keeperOf, other, playing, setOwner } from "./util";

export type KickKind = "pass" | "shot" | "clear" | "cross" | "header" | "throw" | "penalty";

/** Freeze offside positions for the kicking team at the moment the ball is played. */
function snapshotOffside(w: World, m: MatchState, by: Actor): void {
  const s = w.state, team = by.fb!.team, dir = dirOf(m, team);
  const opp = playing(s, m, other(team)).map((a) => a.x * dir).sort((a, b) => b - a);
  const line = Math.max(opp.length > 1 ? opp[1] : -HL, m.ball.x * dir, 0);
  const margins: Record<string, number> = {};
  for (const a of playing(s, m, team)) {
    if (a.id === by.id) continue;
    const mg = a.x * dir - line;
    if (mg > -1.0) margins[a.id] = mg;
  }
  m.offside = { team, margins };
}

/** Send the ball towards a point. `speed` is horizontal m/s, `vz` the upward component. */
export function kick(w: World, m: MatchState, by: Actor, tx: number, ty: number, speed: number, vz: number, kind: KickKind): void {
  const s = w.state, b = m.ball, tick = s.tick;
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
  b.owner = null; b.held = false;
  b.vx = (dx / d) * speed; b.vy = (dy / d) * speed; b.vz = vz;
  if (vz > 0 && b.z < 0.05) b.z = 0.05;
  b.lastTouch = by.id;
  b.lastTouchTeam = by.fb ? by.fb.team : -1;
  b.freeUntil = tick + 4;
  b.shot = null;
  if (by.fb) {
    const fb = by.fb;
    fb.kickLock = tick + 20;
    m.possession = fb.team;
    if (kind === "throw" || !by.fb || m.phase !== "live") m.offside = null;
    else snapshotOffside(w, m, by);
    if (kind === "pass" || kind === "cross" || kind === "throw") m.stats[fb.team].passes++;
  } else m.offside = null;

  if (kind === "shot" || kind === "penalty" || kind === "header") {
    // Which goal is it heading for, and will it be on target?
    const goalSign = b.vx > 0 ? 1 : -1;
    const t = b.vx !== 0 ? (goalSign * HL - b.x) / b.vx : 99;
    const yc = b.y + b.vy * t;
    const zc = b.z + b.vz * t - 0.5 * TUNE.gravity * t * t;
    const onTarget = t > 0 && t < 4 && Math.abs(yc) < PITCH.goalW / 2 - 0.1 && zc < PITCH.goalH - 0.1;
    const team: TeamIdx | -1 = by.fb ? by.fb.team : -1;
    b.shot = { by: by.id, team, at: tick, saveTried: false, onTarget, pen: kind === "penalty" };
    b.lastShot = { by: by.id, team, at: tick };
    if (kind !== "header" || onTarget) {
      if (team !== -1 && m.phase !== "shootout") { m.stats[team].shots++; if (onTarget) m.stats[team].onTarget++; }
    }
    // Tell the keeper defending that goal.
    const defTeam = ([0, 1] as TeamIdx[]).find((tt) => dirOf(m, tt) === -goalSign)!;
    const gk = m.phase === "shootout" ? keeperOf(s, m, other(m.shootout!.turn)) : keeperOf(s, m, defTeam);
    if (gk && t > 0 && t < 4) {
      const g = gk.fb!;
      let react = 0.1 + 0.22 * (1 - g.keeping) + rnd(s.rng.match) * 0.06;
      let aimY = clamp(yc, -PITCH.goalW / 2 - 0.4, PITCH.goalW / 2 + 0.4);
      if (kind === "penalty") {
        // He has to guess.
        react = 0.03;
        const right = chance(s.rng.match, 0.3 + 0.2 * g.keeping);
        const side = Math.abs(yc) < 0.8 ? 0 : Math.sign(yc);
        const guess = right ? side : chance(s.rng.match, 0.2) ? 0 : side === 0 ? (chance(s.rng.match, 0.5) ? 1 : -1) : -side;
        aimY = guess * (PITCH.goalW / 2 - 0.9);
      }
      if (g.bribed && chance(s.rng.match, 0.75)) { aimY = -aimY || (chance(s.rng.match, 0.5) ? 2.5 : -2.5); react += 0.35; }
      g.diveAt = tick + Math.round(react * 60);
      g.diveX = goalSign * (HL - 0.5);
      g.diveY = aimY;
    }
    w.bus.emit({ type: "fb_shot", t: tick, by: by.id, team, onTarget, dist: Math.hypot(goalSign * HL - b.x, b.y), kind });
  }
}

/** A foot pass along the ground or through the air to a point, with human error. */
export function passTo(w: World, m: MatchState, by: Actor, tx: number, ty: number, opts: { loft?: boolean; kind?: KickKind; maxSpeed?: number; pressure?: boolean } = {}): void {
  const fb = by.fb!, rng = w.state.rng.match, b = m.ball;
  let dx = tx - b.x, dy = ty - b.y;
  const D = Math.hypot(dx, dy) || 1;
  let sigma = (0.026 + 0.1 * (1 - fb.passing)) * (opts.pressure ? 1.6 : 1) * (opts.loft ? 1.5 : 1);
  if (fb.bribed) sigma *= 3.5;
  if (fb.wiredUntil > w.state.tick) sigma *= 1.6;
  const ang = Math.atan2(dy, dx) + gauss(rng) * sigma;
  const Dn = D * (1 + gauss(rng) * sigma * 0.8);
  dx = Math.cos(ang) * Dn; dy = Math.sin(ang) * Dn;
  if (opts.loft) {
    const T = 0.55 + Dn / 26;
    kick(w, m, by, b.x + dx, b.y + dy, (Dn / T) * 0.92, (TUNE.gravity * T) / 2, opts.kind ?? "pass");
  } else {
    const v = Math.min(Math.sqrt(4.5 * 4.5 + 2 * TUNE.rollDecel * Dn), opts.maxSpeed ?? 17);
    kick(w, m, by, b.x + dx, b.y + dy, v, 0, opts.kind ?? "pass");
  }
}

/** A shot at a point in the goal mouth. `aimZ` is the height it should cross the line. */
export function shootAt(w: World, m: MatchState, by: Actor, goalSign: number, aimY: number, aimZ: number, speed: number, kind: KickKind, sigmaScale = 1): void {
  const fb = by.fb, rng = w.state.rng.match, b = m.ball;
  const gx = goalSign * HL;
  const D = Math.hypot(gx - b.x, aimY - b.y) || 1;
  let sigma = fb ? 0.065 + 0.16 * (1 - fb.shooting) : 0.16;
  sigma *= sigmaScale;
  if (fb?.bribed) sigma *= 3.5;
  const ang = Math.atan2(aimY - b.y, gx - b.x) + gauss(rng) * sigma;
  const t = D / speed;
  const z = Math.max(0, aimZ + Math.abs(gauss(rng)) * sigma * D * 1.0);
  const vz = (z - b.z + 0.5 * TUNE.gravity * t * t) / t;
  kick(w, m, by, b.x + Math.cos(ang) * D, b.y + Math.sin(ang) * D, speed, vz, kind);
}

export type DeadBall =
  | { k: "goal"; sign: number }
  | { k: "goal_line"; sign: number; y: number }
  | { k: "touch"; x: number; y: number };

/** Advance the ball one tick. Returns what happened if it left the field of play. */
export function stepBall(w: World, m: MatchState): DeadBall | null {
  const s = w.state, b = m.ball, tick = s.tick;

  if (b.owner) {
    const o = s.actors[b.owner];
    const lost = !o || (o.fb && (o.fb.status !== "playing" || isDown(o, tick))) || (!o.fb && o.downUntil > tick);
    if (lost) { b.owner = null; b.held = false; b.vx = (o?.vx ?? 0) * 0.5; b.vy = (o?.vy ?? 0) * 0.5; }
    else {
      const reach = b.held ? 0.2 : 0.6;
      const tx = o.x + Math.cos(o.facing) * reach, ty = o.y + Math.sin(o.facing) * reach;
      b.x += (tx - b.x) * 0.45; b.y += (ty - b.y) * 0.45;
      b.vx = o.vx; b.vy = o.vy; b.z = b.held ? 1.0 : 0; b.vz = 0;
    }
  } else {
    const px = b.x;
    if (b.z > 0 || b.vz > 0) {
      b.vz -= TUNE.gravity * DT; b.z += b.vz * DT;
      const k = 1 - TUNE.airDrag * DT; b.vx *= k; b.vy *= k;
      if (b.z <= 0) {
        b.z = 0; b.vz = -b.vz * TUNE.bounce;
        if (b.vz < 1.3) b.vz = 0;
        b.vx *= 0.82; b.vy *= 0.82;
      }
    } else {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - TUNE.rollDecel * DT); b.vx *= ns / sp; b.vy *= ns / sp; }
    }
    b.x += b.vx * DT; b.y += b.vy * DT;

    // Goal frame: posts and crossbar.
    if (Math.abs(px) <= HL && Math.abs(b.x) > HL) {
      const ay = Math.abs(b.y);
      const post = Math.abs(ay - PITCH.goalW / 2) < 0.16 && b.z < PITCH.goalH + 0.1;
      const bar = ay < PITCH.goalW / 2 && Math.abs(b.z - PITCH.goalH) < 0.14;
      if (post || bar) {
        b.x = Math.sign(b.x) * (HL - 0.05); b.vx = -b.vx * 0.45; b.vy = b.vy * 0.6 + gauss(s.rng.match) * 2;
        if (bar) b.vz = Math.abs(b.vz) * 0.3 + 1;
        w.bus.emit({ type: "fb_woodwork", t: tick, by: b.shot?.by ?? b.lastTouch, bar });
        b.shot = null;
      }
    }
    if (tick >= b.freeUntil) contact(w, m);
  }

  // Leaving the field.
  if (Math.abs(b.x) > HL + 0.11 && !b.owner) {
    const sign = Math.sign(b.x);
    if (Math.abs(b.y) < PITCH.goalW / 2 && b.z < PITCH.goalH) return { k: "goal", sign };
    return { k: "goal_line", sign, y: b.y };
  }
  if (Math.abs(b.x) > HL + 0.11 && b.owner) {
    // Carried over the goal line.
    const sign = Math.sign(b.x);
    if (Math.abs(b.y) < PITCH.goalW / 2) return { k: "goal", sign };
    return { k: "goal_line", sign, y: b.y };
  }
  if (Math.abs(b.y) > HW + 0.11) return { k: "touch", x: clamp(b.x, -HL, HL), y: Math.sign(b.y) * HW };
  return null;
}

/** The free ball has reached somebody. */
function contact(w: World, m: MatchState): void {
  const s = w.state, b = m.ball, tick = s.tick, rng = s.rng.match;
  const shootout = m.phase === "shootout";
  let best: Actor | null = null, bestD = 99, bestKind = "";

  for (const t of [0, 1] as TeamIdx[]) {
    for (const a of playing(s, m, t)) {
      const fb = a.fb!;
      if (fb.kickLock > tick || isDown(a, tick)) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 2) continue;
      let kind = "";
      const ownGoalDir = -dirOf(m, t);
      if (fb.role === "GK" && b.z < 2.6 && (shootout ? t !== m.shootout!.turn : inBox(a.x, a.y, ownGoalDir))) {
        if (d < (fb.diveUntil > tick ? TUNE.diveReach : TUNE.keeperReach)) kind = "keeper";
      } else if (shootout) continue;
      if (!kind) {
        if (b.z <= TUNE.controlHeight && d < TUNE.controlReach) kind = "control";
        else if (b.z > TUNE.controlHeight && b.z <= TUNE.headHeight && d < 0.85 && b.vz < -1) {
          // Let it drop unless he is under pressure or in either penalty area.
          let crowded = inBox(a.x, a.y, 1) || inBox(a.x, a.y, -1);
          if (!crowded) for (const o of playing(s, m, other(t))) if (Math.hypot(o.x - a.x, o.y - a.y) < 2.6) { crowded = true; break; }
          if (crowded) kind = "header";
        }
      }
      if (kind && d < bestD) { best = a; bestD = d; bestKind = kind; }
    }
  }

  if (!best) {
    // Anyone else on the pitch (officials, intruders) just gets hit by it.
    if (b.z < 1.8 && Math.hypot(b.vx, b.vy) > 2) {
      for (const id in s.actors) {
        const a = s.actors[id];
        if (a.fb || Math.abs(a.x) > HL + 2 || Math.abs(a.y) > HW + 2) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + 0.2) {
          deflect(m, 0.35, rng);
          b.lastTouch = a.id; b.lastTouchTeam = -1; b.freeUntil = tick + 10; b.shot = null; m.offside = null;
          w.bus.emit({ type: "fb_ball_hit", t: tick, actor: a.id });
          break;
        }
      }
    }
    return;
  }

  const fb = best.fb!, speed = Math.hypot(b.vx, b.vy);
  // Offside is judged when a player in an offside position becomes involved.
  if (m.offside && m.phase === "live") {
    if (fb.team === m.offside.team && best.id in m.offside.margins) {
      m.pending.push({ kind: "offside", t: tick, x: best.x, y: best.y, team: fb.team, actor: best.id, margin: m.offside.margins[best.id] });
    }
    m.offside = null;
  }

  if (bestKind === "keeper") {
    const isShot = (b.shot && !b.shot.saveTried) || speed > 9;
    if (isShot) {
      if (b.shot) b.shot.saveTried = true;
      let p = clamp(0.5 + 0.44 * fb.keeping - Math.max(0, speed - 16) * 0.012 - (b.z > 1.6 ? 0.08 : 0), 0.08, 0.96);
      if (b.shot?.pen) p *= 0.55;
      if (fb.bribed) p *= 0.2;
      if (!chance(rng, p)) { fb.kickLock = tick + 30; return; } // through his hands
      const shooter = b.shot?.by ?? b.lastTouch;
      m.stats[fb.team].saves++;
      const hold = chance(rng, 0.25 + 0.5 * fb.keeping - Math.max(0, speed - 14) * 0.02);
      if (hold && !shootout) {
        setOwner(m, best, tick); b.held = true; fb.releaseAt = tick + 100 + Math.floor(rnd(rng) * 90);
      } else {
        // Parried: away from goal and out wide.
        const away = Math.sign(-best.x) || 1, side = b.y >= best.y ? 1 : -1;
        const sp = rndRange(rng, 4, 9);
        b.vx = away * sp * rndRange(rng, -0.6, 0.6); b.vy = side * sp * rndRange(rng, 0.6, 1); b.vz = rndRange(rng, 1.5, 4);
        // Never palm it into his own net: if it is heading for the line, it must miss the post.
        if (b.vx * away < 0) {
          const tl = (HL - Math.abs(b.x)) / Math.abs(b.vx);
          if (Math.abs(b.y + b.vy * tl) < PITCH.goalW / 2 + 0.4) b.vx = -b.vx;
        }
        b.lastTouch = best.id; b.lastTouchTeam = fb.team; b.freeUntil = tick + 8; fb.kickLock = tick + 25;
      }
      b.shot = null;
      w.bus.emit({ type: "fb_save", t: tick, by: best.id, shooter, held: hold });
    } else {
      setOwner(m, best, tick); b.held = true; b.shot = null;
      fb.releaseAt = tick + 100 + Math.floor(rnd(rng) * 90);
    }
    return;
  }

  if (bestKind === "header") {
    w.bus.emit({ type: "fb_header", t: tick, by: best.id });
    m.possession = fb.team;
    // Resolved by the player's brain next tick: it is his ball in the air.
    headBall(w, m, best);
    return;
  }

  // Control on the ground.
  const rel = Math.hypot(b.vx - best.vx, b.vy - best.vy);
  const limit = 9 + 13 * fb.control;
  if (b.shot || rel > limit) {
    if (b.shot) {
      const sp = Math.hypot(b.vx, b.vy) * rndRange(rng, 0.25, 0.5), ang = Math.atan2(b.vy, b.vx) + gauss(rng) * 1.4;
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.vz = rnd(rng) * 3;
    } else deflect(m, 0.3, rng);
    b.lastTouch = best.id; b.lastTouchTeam = fb.team; b.freeUntil = tick + 8; fb.kickLock = tick + 14;
    if (b.shot) w.bus.emit({ type: "fb_block", t: tick, by: best.id });
    b.shot = null;
    return;
  }
  setOwner(m, best, tick);
  b.shot = null;
  if (m.passTo === best.id) m.passTo = null;
}

function deflect(m: MatchState, keep: number, rng: import("../core/rng").RngState): void {
  const b = m.ball;
  const sp = Math.hypot(b.vx, b.vy) * keep, ang = Math.atan2(b.vy, b.vx) + Math.PI + gauss(rng) * 1.1;
  b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.vz = Math.abs(b.vz) * 0.3 + rnd(rng) * 1.5;
}

/** A header: at goal if close, clear if defending, otherwise nod it on to a team-mate. */
function headBall(w: World, m: MatchState, a: Actor): void {
  const s = w.state, fb = a.fb!, rng = s.rng.match, dir = dirOf(m, fb.team);
  const gd = Math.hypot(dir * HL - a.x, a.y);
  if (gd < 11 && a.x * dir > 0) {
    const aimY = (chance(rng, 0.5) ? 1 : -1) * rndRange(rng, 0.5, PITCH.goalW / 2 - 0.5);
    shootAt(w, m, a, dir, aimY, rndRange(rng, 0.3, 1.6), rndRange(rng, 11, 15), "header", 1.9);
  } else if (a.x * dir < -HL * 0.35) {
    // A defensive header. In his own six-yard area he will often just put it behind.
    if (a.x * dir < -HL + 7 && chance(rng, 0.45)) kick(w, m, a, a.x - dir * 8, a.y + (a.y >= 0 ? 1 : -1) * rndRange(rng, 6, 12), rndRange(rng, 8, 11), rndRange(rng, 2, 4), "clear");
    else kick(w, m, a, a.x + dir * rndRange(rng, 9, 15), a.y + gauss(rng) * 6, rndRange(rng, 9, 12), rndRange(rng, 3, 5), "clear");
  } else {
    let mate: Actor | null = null, md = 14;
    for (const o of playing(s, m, fb.team)) {
      if (o.id === a.id || o.fb!.role === "GK") continue;
      const d = Math.hypot(o.x - a.x, o.y - a.y);
      if (d > 3 && d < md) { md = d; mate = o; }
    }
    if (mate) kick(w, m, a, mate.x, mate.y, 8 + md * 0.3, -2, "pass");
    else kick(w, m, a, a.x + dir * 8, a.y + gauss(rng) * 4, 9, 3, "clear");
  }
  fb.kickLock = s.tick + 30;
  m.ball.freeUntil = s.tick + 14;
}

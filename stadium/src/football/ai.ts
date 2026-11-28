// What each footballer decides to do, and how he moves.
import { chance, gauss, rnd, rndRange } from "../core/rng";
import { DT, type Actor } from "../core/types";
import { clamp, pointSegment } from "../core/vec";
import type { World } from "../core/world";
import { maybePhantomFoul } from "./authority";
import { kick, passTo, shootAt } from "./ball";
import { FORMATIONS, HL, HW, PITCH, TUNE } from "./config";
import type { MatchState, TeamIdx, TeamMods } from "./types";
import { dirOf, hash01, inBox, intercept, isDown, keeperOf, other, playing, topSpeed } from "./util";

const tmp = { x: 0, y: 0 };

/** Rough chance of scoring from here: distance, angle, and bodies in the way. */
export function shotValue(x: number, y: number, dir: number, opps: Actor[]): number {
  const gx = dir * HL;
  const d = Math.hypot(gx - x, y);
  const a1 = Math.atan2(PITCH.goalW / 2 - y, Math.abs(gx - x)), a2 = Math.atan2(-PITCH.goalW / 2 - y, Math.abs(gx - x));
  const ang = Math.abs(a1 - a2);
  let v = 0.95 * Math.exp(-d / 6.5) * clamp(ang / 0.45, 0.2, 1);
  for (const o of opps) {
    if (o.fb!.role === "GK") continue;
    const ps = pointSegment(o.x, o.y, x, y, gx, 0);
    if (ps.d < 0.9 && ps.t * d < 9 && ps.t > 0.02) v *= 0.55;
  }
  return v;
}

/** The furthest forward an attacker of `team` can stand without being offside (team frame x). */
export function offsideLine(m: MatchState, opps: Actor[], dir: number): number {
  let a = -99, b = -99;
  for (const o of opps) { const x = o.x * dir; if (x > a) { b = a; a = x; } else if (x > b) b = x; }
  return Math.max(b, m.ball.x * dir, 0);
}

/** Where this player's formation slot wants him, given where the ball is. */
export function slotTarget(m: MatchState, a: Actor, attacking: boolean, offLine: number, ballX = m.ball.x, ballY = m.ball.y): { x: number; y: number } {
  const fb = a.fb!, team = m.teams[fb.team], dir = dirOf(m, fb.team);
  const slot = FORMATIONS[team.formation][fb.slot] ?? FORMATIONS[team.formation][6];
  const bx = ballX * dir, by = ballY * dir;
  const shift = clamp(bx * 0.55 + (attacking ? 5 : -4) + team.mentality * 4, -HL * 0.5, HL * 0.52);
  let px = slot.x * HL * 0.6 + shift;
  let py = slot.y * HW * (attacking ? 0.92 : 0.72) + by * 0.28;
  if (fb.role === "FWD") {
    if (attacking && bx > -12) px = Math.max(px, Math.min(offLine - 0.6, bx + 16));
    else px = Math.max(px, -4);
  } else if (fb.role === "DEF") {
    if (!attacking) px = Math.min(px, Math.max(bx - 5, -HL + 6));
    px = Math.min(px, HL * 0.15 + team.mentality * 6);
  } else if (attacking && bx > 8) {
    px = Math.max(px, bx - 9 + slot.x * 6);
  }
  if (attacking && px > bx) px = Math.min(px, offLine - 0.6 + (fb.role === "FWD" ? ((a.fb!.number * 7 + Math.floor(m.clock / 4)) % 5) * 0.32 - 0.3 : 0));
  px = clamp(px, -HL + 2.5, HL - 2.5);
  py = clamp(py, -HW + 1.5, HW - 1.5);
  return { x: px * dir, y: py * dir };
}

/** Move towards the player's target with limited acceleration. */
export function steer(a: Actor, tick: number, speedScale = 1, arrive = 1.2): void {
  const fb = a.fb!;
  if (fb.controlled) return; // whoever is at the controls moves him
  if (isDown(a, tick)) { a.vx *= 0.8; a.vy *= 0.8; a.x += a.vx * DT; a.y += a.vy * DT; return; }
  const dx = fb.tx - a.x, dy = fb.ty - a.y, d = Math.hypot(dx, dy);
  const max = topSpeed(a, tick) * (fb.sprint ? 1 : TUNE.jog) * speedScale;
  const want = d < 0.08 ? 0 : Math.min(max, (d / arrive) * max + 0.4);
  const wx = d > 0 ? (dx / d) * want : 0, wy = d > 0 ? (dy / d) * want : 0;
  const ax = wx - a.vx, ay = wy - a.vy, al = Math.hypot(ax, ay), lim = TUNE.accel * DT;
  if (al > lim) { a.vx += (ax / al) * lim; a.vy += (ay / al) * lim; } else { a.vx = wx; a.vy = wy; }
  a.x += a.vx * DT; a.y += a.vy * DT;
  const sp = Math.hypot(a.vx, a.vy);
  if (sp > 0.6) a.facing = Math.atan2(a.vy, a.vx);
  // Running tires you out; standing lets you recover a little.
  const effort = sp / (TUNE.speedBase + TUNE.speedPace);
  fb.fatigue = clamp(fb.fatigue + (effort * effort * 0.0016 * (1.5 - fb.stamina) - 0.00012) * DT * 6, 0, 1);
}

interface PassOption { mate: Actor; x: number; y: number; u: number; loft: boolean; D: number }

/** Score every team-mate as a pass target and return the best. */
export function bestPass(w: World, m: MatchState, a: Actor, mates: Actor[], opps: Actor[], offLine: number, opts: { maxD?: number; noOffside?: boolean } = {}): PassOption | null {
  const fb = a.fb!, dir = dirOf(m, fb.team), rng = w.state.rng.match, b = m.ball;
  const tm = m.mods ? m.mods.team[fb.team] : null;
  let best: PassOption | null = null;
  for (const mate of mates) {
    if (mate.id === a.id || isDown(mate, w.state.tick)) continue;
    const mfb = mate.fb!;
    // Running off the pitch, or a man they've given up on: he doesn't get it.
    if (mfb.boltAt || (tm && tm.shun === mate.id)) continue;
    const variants = mfb.role === "FWD" && mate.x * dir > -5 && offLine < HL - 13 ? 2 : 1;
    for (let v = 0; v < variants; v++) {
      // v = 1: a ball into space behind the defence for him to run on to.
      const lead = v === 1 ? rndRange(rng, 6, 11) : 0;
      const tx = mate.x + mate.vx * 0.45 + dir * lead, ty = mate.y + mate.vy * 0.45;
      const D = Math.hypot(tx - b.x, ty - b.y);
      if (D < 4 || D > (opts.maxD ?? 44)) continue;
      const mg = mate.x * dir - offLine;
      if (!opts.noOffside && mate.x * dir > b.x * dir && mg > 0.3 + Math.abs(gauss(rng)) * 0.9) continue;
      const progress = clamp(((tx - b.x) * dir) / 20, -0.7, 1);
      let risk = 0, open = 8;
      for (const o of opps) {
        const ps = pointSegment(o.x, o.y, b.x, b.y, tx, ty);
        const reach = ps.d - ps.t * D * 0.27;
        if (ps.t > 0.04) risk += reach < 0.7 ? 1 : clamp(1 - (reach - 0.7) / 2.6, 0, 1) * 0.3;
        const od = Math.hypot(o.x - tx, o.y - ty);
        if (od < open) open = od;
      }
      let loft = false;
      if (risk >= 0.9 && D > 20 && open > 4) { loft = true; risk = 0.6 + (open < 5.5 ? 0.2 : 0); }
      if (D > 26) loft = true;
      let u = 0.3 + 0.42 * progress + 0.25 * (open / 8) - 0.78 * risk - (D > 28 ? 0.12 : 0) - (loft ? 0.18 : 0);
      u += shotValue(tx, ty, dir, opps) * 1.3;
      if (v === 1) u += 0.1;
      if (mfb.role === "GK") u -= 0.35;
      if (mfb.star) u += 0.06;
      if (tm && tm.feed > 0 && tm.clumsy.includes(mate.id)) u += 0.35 * tm.feed;
      if (!best || u > best.u) best = { mate, x: tx, y: ty, u, loft, D };
    }
  }
  return best;
}

/** How much worse (or better) this man's aim is for what's been done to his side. 1 = as he always was. */
function aimOf(tm: TeamMods | null, a: Actor): number {
  if (!tm) return 1;
  return (1 + 0.9 * tm.lost + 0.3 * tm.ragged + 0.25 * tm.hyper - 0.1 * tm.keen) * (tm.clumsy.includes(a.id) ? 2.2 : 1);
}

function doPass(w: World, m: MatchState, a: Actor, p: PassOption, pressure: boolean): void {
  const tm = m.mods ? m.mods.team[a.fb!.team] : null;
  passTo(w, m, a, p.x, p.y, { loft: p.loft, pressure, wild: tm ? aimOf(tm, a) : undefined });
  m.passTo = p.mate.id;
}

function doShoot(w: World, m: MatchState, a: Actor, opps: Actor[], pressure: boolean): void {
  const fb = a.fb!, dir = dirOf(m, fb.team), rng = w.state.rng.match;
  const gk = opps.find((o) => o.fb!.role === "GK");
  const side = gk ? (gk.y > 0 ? -1 : 1) : chance(rng, 0.5) ? 1 : -1;
  const aimY = (chance(rng, 0.78) ? side : -side) * rndRange(rng, PITCH.goalW / 2 - 1.3, PITCH.goalW / 2 - 0.55);
  const d = Math.hypot(dir * HL - a.x, a.y);
  const speed = rndRange(rng, 19, 23) + fb.shooting * 3;
  const spread = (pressure ? 1.35 : 1) * (1 + d / 60), tm = m.mods ? m.mods.team[fb.team] : null;
  shootAt(w, m, a, dir, aimY, rndRange(rng, 0.15, 1.5), speed, "shot", tm ? spread * (0.6 + 0.4 * aimOf(tm, a)) : spread);
}

/** The man on the ball chooses: shoot, pass, run with it, or get rid. */
function carrierThink(w: World, m: MatchState, a: Actor, mates: Actor[], opps: Actor[], offLine: number): void {
  const s = w.state, tick = s.tick, fb = a.fb!, rng = s.rng.match, dir = dirOf(m, fb.team), team = m.teams[fb.team];
  const held = tick - fb.gotBallAt;
  let dn = 99, nearest: Actor | null = null;
  for (const o of opps) { const d = Math.hypot(o.x - a.x, o.y - a.y); if (d < dn) { dn = d; nearest = o; } }
  const pressure = dn < 2.7;
  const xg = shotValue(a.x, a.y, dir, opps);
  const ment = team.mentality;
  const tm = m.mods ? m.mods.team[fb.team] : null;
  let bar = 0.105 - ment * 0.02;
  if (tm) {
    // Up for it: he'll have a go from further out than is wise.
    bar -= 0.03 * tm.keen + 0.02 * tm.hyper;
    if (fb.role !== "GK" && held >= 4) {
      // Wrong boots: the ball gets away from him.
      if (tm.clumsy.length && tm.clumsy.includes(a.id) && chance(rng, 0.1)) {
        kick(w, m, a, a.x + Math.cos(a.facing) * 5 + gauss(rng) * 2, a.y + Math.sin(a.facing) * 5 + gauss(rng) * 2, rndRange(rng, 4.5, 7), 0, "clear");
        fb.kickLock = tick + 34; m.passTo = null;
        w.bus.emit({ type: "fb_heavy_touch", t: tick, by: a.id, team: fb.team });
        return;
      }
      // No idea what he's doing, and once in a while that's unplayable: a hit from nowhere the keeper never saw coming.
      if (tm.lost > 0 && a.x * dir > 2 && a.x * dir < HL - 9 && chance(rng, 0.006 * tm.lost)) {
        const aimY = (chance(rng, 0.5) ? 1 : -1) * rndRange(rng, 1.2, PITCH.goalW / 2 - 0.5);
        shootAt(w, m, a, dir, aimY, rndRange(rng, 0.4, 1.7), rndRange(rng, 23, 26), "shot", 0.7);
        const gk = keeperOf(s, m, other(fb.team));
        if (gk && gk.fb!.diveAt) gk.fb!.diveAt += 16;
        w.bus.emit({ type: "fb_fluke", t: tick, by: a.id, team: fb.team });
        return;
      }
    }
  }

  if (held >= 6) {
    const want = xg > bar || (xg > 0.035 && chance(rng, 0.035 + 0.03 * Math.max(0, ment) + (fb.star ? 0.02 : 0)));
    if (want) {
      // Square it if someone is much better placed.
      let better: PassOption | null = null;
      if (xg < 0.3) {
        const p = bestPass(w, m, a, mates, opps, offLine, { maxD: 16 });
        if (p && shotValue(p.x, p.y, dir, opps) > xg * 1.8 && p.u > 0.5) better = p;
      }
      if (better) doPass(w, m, a, better, pressure); else doShoot(w, m, a, opps, pressure);
      return;
    }
  }

  // Take a touch or two before looking up, unless someone is closing in.
  const settle = 26 + ((a.fb!.number * 13 + fb.gotBallAt) % 40);
  const look = held >= (pressure ? 16 : settle);
  let pass = look || held >= 22 ? bestPass(w, m, a, mates, opps, offLine) : null;
  // Confused: he's sure somebody was meant to be there. He passes to whoever is.
  if (tm && tm.lost > 0 && pass && mates.length > 2 && chance(rng, 0.3 * tm.lost)) {
    const o = mates[Math.floor(rnd(rng) * mates.length)];
    if (o !== a && o.fb!.role !== "GK" && !o.fb!.boltAt) pass = { mate: o, x: o.x, y: o.y, u: 9, loft: false, D: Math.hypot(o.x - a.x, o.y - a.y) };
  }

  // Out wide in the final third with bodies in the box: swing a cross in.
  if (look && fb.role !== "GK" && a.x * dir > HL - 17 && Math.abs(a.y) > 8.5) {
    let inBoxMates = 0;
    for (const o of mates) if (o !== a && inBox(o.x, o.y, dir)) inBoxMates++;
    if (inBoxMates >= 1 && chance(rng, 0.2 + 0.08 * inBoxMates + (pressure ? 0.15 : 0))) {
      passTo(w, m, a, dir * (HL - rndRange(rng, 4.5, 9)), -Math.sign(a.y) * rndRange(rng, -2.5, 3), { loft: true, kind: "cross", pressure });
      m.passTo = null;
      return;
    }
  }
  // How inviting is the grass ahead?
  let ahead = 12;
  for (const o of opps) {
    const fx = (o.x - a.x) * dir, fy = Math.abs(o.y - a.y);
    if (fx > 0 && fy < 3.5 && fx < ahead) ahead = fx;
  }
  const ownThird = a.x * dir < -HL / 3;
  let dribbleU = 0.44 + 0.24 * clamp(ahead / 10, 0, 1) + 0.25 * (fb.control - 0.6) + (fb.role === "FWD" ? 0.08 : 0)
    - (pressure ? 0.28 : 0) - Math.min(held / 260, 0.3) - (ownThird ? 0.12 : 0) + (fb.wiredUntil > tick ? 0.25 : 0);
  if (fb.role === "GK") dribbleU = -1;

  if (pass && pass.u > dribbleU + (look ? 0 : 0.35)) { doPass(w, m, a, pass, pressure); return; }
  if (pressure && ownThird && (!pass || pass.u < 0.2)) {
    // Row Z. Near his own byline he will settle for a corner or a throw.
    if (a.x * dir < -HL + 9 && chance(rng, 0.5)) kick(w, m, a, a.x - dir * 6, a.y + (a.y > 0 ? 1 : -1) * 14, rndRange(rng, 12, 16), rndRange(rng, 2, 5), "clear");
    else kick(w, m, a, a.x + dir * rndRange(rng, 22, 34), a.y + (a.y > 0 ? 1 : -1) * rndRange(rng, 0, 14), rndRange(rng, 17, 21), rndRange(rng, 6, 9), "clear");
    return;
  }
  if (fb.role === "GK" && pass) { doPass(w, m, a, pass, pressure); return; }

  // Run with it: towards goal, bending away from the nearest defender in the way.
  let ty = a.y + (0 - a.y) * (a.x * dir > HL * 0.45 ? 0.5 : 0.08);
  if (nearest && (nearest.x - a.x) * dir > -0.5 && dn < 5) ty += (a.y >= nearest.y ? 1 : -1) * (5.5 - dn) * 1.4;
  fb.tx = clamp(a.x + dir * 7, -HL + 1, HL - 1);
  fb.ty = clamp(ty, -HW + 1.2, HW - 1.2);
  fb.sprint = ahead > 4 || dn > 3.5;
}

/** One man sends another flying: nobody is going to rule on it, so it's settled on the spot. Cartoon physics:
 *  he goes a long way and he gets up again. */
function clatter(w: World, m: MatchState, a: Actor, victim: Actor, power: number, offBall: boolean): void {
  const tick = w.state.tick, vf = victim.fb!;
  const dx = victim.x - a.x, dy = victim.y - a.y, d = Math.hypot(dx, dy) || 1, sp = 16 + 34 * power;
  vf.stunUntil = Math.max(vf.stunUntil, tick + 60 + Math.floor(150 * power));
  victim.vx = (dx / d) * sp; victim.vy = (dy / d) * sp;
  w.bus.emit({ type: "fb_clattered", t: tick, by: a.id, on: victim.id, team: a.fb!.team, power, offBall });
}

function tackle(w: World, m: MatchState, a: Actor, carrier: Actor, tm: TeamMods | null = null, lunge = false): void {
  const s = w.state, tick = s.tick, fb = a.fb!, cf = carrier.fb!, rng = s.rng.match, b = m.ball;
  if (tm) return tackleMod(w, m, a, carrier, tm, lunge);
  fb.tackleLock = tick + TUNE.tackleCooldown;
  const wired = fb.wiredUntil > tick;
  // Coming from behind is harder to win and likelier to foul.
  const cdir = Math.atan2(carrier.vy, carrier.vx), toMe = Math.atan2(a.y - carrier.y, a.x - carrier.x);
  const behind = Math.hypot(carrier.vx, carrier.vy) > 1.5 && Math.abs(Math.atan2(Math.sin(toMe - cdir), Math.cos(toMe - cdir))) > 2.1;
  const pWin = clamp(0.3 + 0.5 * (fb.tackling - cf.control) + (behind ? -0.12 : 0.06) + (cf.star ? -0.06 : 0), 0.1, 0.72);
  let pFoul = clamp(0.1 + 0.26 * fb.aggression + (behind ? 0.16 : 0) - 0.14 * fb.tackling, 0.03, 0.7);
  // Defenders are careful in their own area. Unless they are off their heads.
  if (inBox(carrier.x, carrier.y, -dirOf(m, fb.team))) pFoul *= 0.4;
  if (wired) pFoul = Math.min(0.8, pFoul + 0.35);
  const r = rnd(rng);
  if (r < pWin) {
    cf.stunUntil = tick + 24;
    if (chance(rng, 0.55)) {
      b.owner = a.id; b.lastTouch = a.id; b.lastTouchTeam = fb.team; m.possession = fb.team; fb.gotBallAt = tick;
    } else {
      b.owner = null; const ang = Math.atan2(a.vy, a.vx) + gauss(rng) * 0.8, sp = rndRange(rng, 3, 7);
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.lastTouch = a.id; b.lastTouchTeam = fb.team; b.freeUntil = tick + 6;
    }
    m.offside = null; m.passTo = null;
    maybePhantomFoul(w, m, a, carrier);
  } else if (r < pWin + (1 - pWin) * pFoul) {
    const severity = clamp(rnd(rng) * rnd(rng) * 1.3 + fb.aggression * 0.25 + (behind ? 0.2 : 0) + (wired ? 0.45 : 0), 0, 1.6);
    cf.stunUntil = tick + 50 + Math.floor(severity * 60);
    fb.stunUntil = tick + 20;
    b.owner = null; b.vx = carrier.vx * 0.4; b.vy = carrier.vy * 0.4; b.freeUntil = tick + 6;
    m.pending.push({ kind: "foul", t: tick, x: carrier.x, y: carrier.y, team: fb.team, actor: a.id, victim: carrier.id, severity });
  } else {
    fb.stunUntil = tick + 30; // sold
  }
}

/** The same challenge by a man whose side has been got at (or with nobody refereeing). Kept apart from the
 *  ordinary one so that a match nobody has interfered with rolls exactly the dice it always did. */
function tackleMod(w: World, m: MatchState, a: Actor, carrier: Actor, tm: TeamMods, lunge: boolean): void {
  const s = w.state, tick = s.tick, fb = a.fb!, cf = carrier.fb!, rng = s.rng.match, b = m.ball;
  const law = m.mods!.lawless ? Math.min(1, m.mods!.lawless * (1 + 0.5 * tm.hyper)) : 0;
  const clumsy = tm.clumsy.length > 0 && tm.clumsy.includes(a.id);
  fb.tackleLock = tick + Math.round(TUNE.tackleCooldown * (1 - 0.2 * tm.hyper + 0.6 * tm.slow - 0.1 * tm.keen));
  const wired = fb.wiredUntil > tick;
  const cdir = Math.atan2(carrier.vy, carrier.vx), toMe = Math.atan2(a.y - carrier.y, a.x - carrier.x);
  const behind = Math.hypot(carrier.vx, carrier.vy) > 1.5 && Math.abs(Math.atan2(Math.sin(toMe - cdir), Math.cos(toMe - cdir))) > 2.1;
  const pWin = clamp(0.3 + 0.5 * (fb.tackling - cf.control) + (behind ? -0.12 : 0.06) + (cf.star ? -0.06 : 0)
    + 0.03 * tm.hyper + 0.06 * tm.keen - 0.1 * tm.slow - 0.08 * tm.lost - (clumsy ? 0.15 : 0) - (lunge ? 0.12 : 0), 0.06, 0.8);
  let pFoul = clamp(0.1 + 0.26 * fb.aggression + (behind ? 0.16 : 0) - 0.14 * fb.tackling + 0.08 * tm.hyper + 0.05 * tm.keen + (lunge ? 0.04 : 0) + (clumsy ? 0.1 : 0), 0.03, 0.85);
  // Defenders are careful in their own area. Less so the more wound up they are.
  if (inBox(carrier.x, carrier.y, -dirOf(m, fb.team))) pFoul *= Math.min(1, 0.4 + 0.45 * tm.hyper + 0.1 * tm.keen);
  if (wired) pFoul = Math.min(0.8, pFoul + 0.35);
  // Nobody to blow up for it: they stop pretending to go for the ball.
  if (law) pFoul = Math.max(pFoul, 0.4 + 0.5 * law);
  if (lunge) {
    // He leaves the ground a couple of yards out and arrives studs first.
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    a.vx = (dx / d) * 9; a.vy = (dy / d) * 9;
    w.bus.emit({ type: "fb_lunge", t: tick, by: a.id, on: carrier.id, team: fb.team });
  }
  const r = rnd(rng);
  if (r < pWin) {
    cf.stunUntil = tick + 24;
    if (chance(rng, 0.55 + 0.1 * tm.hyper)) {
      b.owner = a.id; b.lastTouch = a.id; b.lastTouchTeam = fb.team; m.possession = fb.team; fb.gotBallAt = tick;
    } else {
      b.owner = null; const ang = Math.atan2(a.vy, a.vx) + gauss(rng) * 0.8, sp = rndRange(rng, 3, 7);
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.lastTouch = a.id; b.lastTouchTeam = fb.team; b.freeUntil = tick + 6;
    }
    m.offside = null; m.passTo = null;
    maybePhantomFoul(w, m, a, carrier);
  } else if (r < pWin + (1 - pWin) * pFoul) {
    const severity = clamp(rnd(rng) * rnd(rng) * 1.3 + fb.aggression * 0.25 + (behind ? 0.2 : 0) + (wired ? 0.45 : 0) + 0.05 * tm.hyper + 0.03 * tm.keen + (lunge ? 0.03 : 0) + 0.6 * law, 0, 1.9);
    cf.stunUntil = tick + 50 + Math.floor(severity * 60);
    fb.stunUntil = tick + (law ? 8 : 20);
    b.owner = null; b.vx = carrier.vx * 0.4; b.vy = carrier.vy * 0.4; b.freeUntil = tick + 6;
    if (law) clatter(w, m, a, carrier, law, false);
    m.pending.push({ kind: "foul", t: tick, x: carrier.x, y: carrier.y, team: fb.team, actor: a.id, victim: carrier.id, severity });
  } else {
    fb.stunUntil = tick + (lunge ? 70 : 30); // sold, and if he dived in he's still sliding
  }
}

/** Runs a keeper's planned dive. Returns true while he is committed to it. */
export function keeperDive(a: Actor, tick: number): boolean {
  const fb = a.fb!;
  if (fb.diveAt && tick >= fb.diveAt) { fb.diveUntil = tick + 42; fb.diveAt = 0; }
  if (fb.diveUntil <= tick) return false;
  const dx = fb.diveX - a.x, dy = fb.diveY - a.y, d = Math.hypot(dx, dy);
  if (d > 0.05) { const st = Math.min(d, TUNE.diveSpeed * DT); a.x += (dx / d) * st; a.y += (dy / d) * st; a.vx = (dx / d) * 3; a.vy = (dy / d) * 3; }
  return true;
}

function keeperLogic(w: World, m: MatchState, a: Actor, mates: Actor[], opps: Actor[], chaser: boolean, offLine: number): void {
  const s = w.state, tick = s.tick, fb = a.fb!, b = m.ball, rng = s.rng.match, dir = dirOf(m, fb.team);
  const gx = -dir * HL;
  if (keeperDive(a, tick)) return;
  if (b.owner === a.id) {
    if (b.held) {
      fb.tx = gx + dir * 5; fb.ty = a.y * 0.9; fb.sprint = false;
      if (tick >= fb.releaseAt) {
        const p = bestPass(w, m, a, mates, opps, offLine, { maxD: 24, noOffside: true });
        if (p && p.u > 0.25 && !p.loft && !fb.bribed) { passTo(w, m, a, p.x, p.y, { kind: "throw", maxSpeed: 13 }); m.passTo = p.mate.id; }
        else {
          const tgt = mates.filter((o) => o.fb!.role === "FWD" || o.fb!.role === "MID");
          const t = tgt.length ? tgt[Math.floor(rnd(rng) * tgt.length)] : a;
          passTo(w, m, a, clamp(t.x + dir * 4, -HL + 4, HL - 4) * 0.5 + dir * 6, t.y, { loft: true, kind: "clear" });
          m.offside = null;
        }
      }
      steer(a, tick, 0.6);
      return;
    }
    carrierThink(w, m, a, mates, opps, offLine);
    steer(a, tick, TUNE.carrySlow);
    return;
  }
  const bd = Math.hypot(b.x - gx, b.y);
  const inMyBox = inBox(b.x, b.y, -dir);
  if (chaser && !b.owner && inMyBox) {
    intercept(b, a, topSpeed(a, tick), tmp); fb.tx = tmp.x; fb.ty = tmp.y; fb.sprint = true;
  } else if (b.owner && inMyBox && bd < 10 && s.actors[b.owner]?.fb?.team !== fb.team) {
    // One on one: come out and make himself big.
    const k = clamp(1 - 3.2 / bd, 0.2, 0.75);
    fb.tx = gx + (b.x - gx) * k; fb.ty = b.y * k; fb.sprint = true;
  } else {
    const r = clamp(bd * 0.13, 0.9, 4.4);
    fb.tx = gx + ((b.x - gx) / (bd || 1)) * r; fb.ty = (b.y / (bd || 1)) * r;
    fb.sprint = bd < 22;
  }
  steer(a, tick, 1, 0.5);
}

/** One tick of thinking and moving for both teams during open play. */
export function stepPlayers(w: World, m: MatchState): void {
  const s = w.state, tick = s.tick, b = m.ball;
  const lists = [playing(s, m, 0), playing(s, m, 1)];
  const owner = b.owner ? s.actors[b.owner] : null;
  const ownerTeam: number = owner?.fb ? owner.fb.team : -1;
  const mods = m.mods;

  for (const t of [0, 1] as TeamIdx[]) {
    const mates = lists[t], opps = lists[other(t)], dir = dirOf(m, t);
    const offLine = offsideLine(m, opps, dir);
    const attacking = ownerTeam === t || (ownerTeam === -1 && m.possession === t);
    // What's been done to this side (nothing, in a match nobody has interfered with: every number below is
    // then exactly what it always was, and no extra dice are rolled).
    const tm: TeamMods | null = mods ? mods.team[t] : null;
    const law = mods ? mods.lawless : 0;
    const pace = tm ? 1 + 0.06 * tm.hyper + 0.03 * tm.keen - 0.16 * tm.slow - 0.08 * tm.ragged : 1;
    const think = tm ? Math.max(4, Math.round(TUNE.thinkEvery * (1 + 1.5 * tm.slow + 0.6 * tm.lost + 0.5 * tm.ragged - 0.35 * tm.keen - 0.2 * tm.hyper))) : TUNE.thinkEvery;
    const reach = tm ? TUNE.tackleReach * (1 + 0.85 * tm.hyper + 0.5 * law) : TUNE.tackleReach;

    // Who goes to the ball?
    let chaser: Actor | null = null, cover: Actor | null = null, bt = 99, ct = 99;
    if (ownerTeam !== t && !(b.held && ownerTeam !== -1)) {
      for (const a of mates) {
        if (isDown(a, tick)) continue;
        const fb = a.fb!;
        if (fb.boltAt) continue;
        let time: number;
        if (owner) time = Math.hypot(owner.x - a.x, owner.y - a.y) / topSpeed(a, tick);
        else time = intercept(b, a, topSpeed(a, tick), tmp) - (m.passTo === a.id ? 0.6 : 0);
        if (fb.role === "GK" && !(inBox(b.x, b.y, -dir) && !owner)) time += 50;
        if (time < bt) { cover = chaser; ct = bt; chaser = a; bt = time; }
        else if (time < ct) { cover = a; ct = time; }
      }
      // While a team-mate's pass is on its way, only the receiver (or anyone clearly nearer) goes.
      if (!owner && attacking && m.passTo && chaser && chaser.id !== m.passTo) {
        const rec = s.actors[m.passTo];
        if (rec?.fb?.team === t && rec.fb.status === "playing" && !isDown(rec, tick)) {
          const rt = intercept(b, rec, topSpeed(rec, tick), tmp);
          if (rt < bt + 0.7) chaser = rec;
        }
      }
      if (attacking || cover?.fb!.role === "GK") cover = null;
      if (tm) {
        // Heavy legs: nobody bothers covering. Confused: now and then a loose ball is everybody's and nobody's
        // ("yours!" "no, yours!"), for a second at a time.
        if (tm.slow >= 0.5) cover = null;
        if (tm.lost > 0 && !owner && chaser && chaser.fb!.role !== "GK" && hash01(t + 3, Math.floor(tick / 70)) < 0.45 * tm.lost) chaser = null;
      }
    }

    for (const a of mates) {
      const fb = a.fb!;
      if (fb.controlled) continue;
      if (fb.boltAt) {
        // Caught short: off towards the tunnel as fast as he can manage, and nothing else matters.
        if (b.owner === a.id) { b.owner = null; b.held = false; }
        fb.tx = clamp(a.x * 0.4, -6, 6); fb.ty = -HW - 3; fb.sprint = true; fb.intent = "position";
        if (isDown(a, tick)) fb.stunUntil = 0;
        steer(a, tick, 1.05);
        continue;
      }
      if (fb.role === "GK") { keeperLogic(w, m, a, mates, opps, chaser === a, offLine); continue; }
      if (isDown(a, tick)) { steer(a, tick); continue; }
      const clumsy = tm !== null && tm.clumsy.length > 0 && tm.clumsy.includes(a.id);
      const sp = clumsy ? pace * 0.9 : pace;
      // Wrong boots: every so often, at full tilt, his feet go from under him.
      if (clumsy && Math.hypot(a.vx, a.vy) > 4.2 && chance(s.rng.match, 0.0008)) {
        fb.stunUntil = tick + 60;
        if (b.owner === a.id) { b.owner = null; b.vx = a.vx * 0.7; b.vy = a.vy * 0.7; b.freeUntil = tick + 6; }
        w.bus.emit({ type: "fb_slip", t: tick, by: a.id, team: t });
        steer(a, tick);
        continue;
      }

      if (b.owner === a.id) {
        fb.intent = "carry";
        if (tick >= fb.thinkAt) { fb.thinkAt = tick + think; carrierThink(w, m, a, mates, opps, offLine); }
        if (b.owner === a.id) steer(a, tick, TUNE.carrySlow * sp, 0.6); else steer(a, tick, sp);
        continue;
      }
      if (chaser === a) {
        fb.sprint = true;
        if (owner) {
          fb.intent = "press";
          // Get goal-side of him rather than chasing his heels.
          const gx = -dir * HL;
          const gd = Math.hypot(gx - owner.x, owner.y) || 1;
          const lead = clamp(Math.hypot(owner.x - a.x, owner.y - a.y) * 0.25, 0, 1.6);
          fb.tx = b.x + owner.vx * 0.2 + ((gx - owner.x) / gd) * lead;
          fb.ty = b.y + owner.vy * 0.2 + ((0 - owner.y) / gd) * lead;
          if (!b.held && tick >= fb.tackleLock) {
            const bd = Math.hypot(b.x - a.x, b.y - a.y);
            if (bd < reach) tackle(w, m, a, owner, tm, bd >= TUNE.tackleReach);
          }
        } else {
          fb.intent = attacking ? "receive" : "chase";
          intercept(b, a, topSpeed(a, tick), tmp); fb.tx = tmp.x; fb.ty = tmp.y;
        }
        steer(a, tick, sp, 0.35);
        continue;
      }
      if (cover === a && owner) {
        if (tm && tm.hyper >= 0.5) {
          // Relentless: the second man doesn't hold off and cover, he goes in as well.
          fb.tx = b.x + owner.vx * 0.2; fb.ty = b.y + owner.vy * 0.2; fb.sprint = true; fb.intent = "press";
          if (!b.held && tick >= fb.tackleLock) {
            const bd = Math.hypot(b.x - a.x, b.y - a.y);
            if (bd < reach) tackle(w, m, a, owner, tm, bd >= TUNE.tackleReach);
          }
          steer(a, tick, sp, 0.35);
          continue;
        }
        const gx = -dir * HL, gd = Math.hypot(gx - b.x, b.y) || 1;
        fb.tx = b.x + ((gx - b.x) / gd) * 4.5; fb.ty = b.y + ((0 - b.y) / gd) * 4.5; fb.sprint = true; fb.intent = "press";
        steer(a, tick, sp);
        continue;
      }

      fb.intent = "position";
      if (tick >= fb.thinkAt) {
        fb.thinkAt = tick + think;
        const p = slotTarget(m, a, attacking, offLine);
        // His wrong idea of the moment, if his side has been got at: a steady number per man per few seconds.
        const whim = tm && (tm.lost > 0 || tm.ragged > 0 || tm.swarm > 0) ? hash01(fb.number * 31 + t, Math.floor((tick + fb.number * 37) / 260)) : 1;
        const marks = !tm || (whim >= 0.9 * tm.lost && whim >= 0.75 * tm.ragged);
        if (!attacking && fb.role !== "FWD" && marks) {
          // Pick up the nearest runner in my area, goal-side.
          let mark: Actor | null = null, md = 8;
          for (const o of opps) {
            if (o.fb!.role === "GK") continue;
            const d = Math.hypot(o.x - p.x, o.y - p.y);
            if (d < md) { md = d; mark = o; }
          }
          if (mark) {
            const gx = -dir * HL, gd = Math.hypot(gx - mark.x, mark.y) || 1;
            let k = fb.role === "DEF" ? 0.6 : 0.4;
            if (tm) k *= 1 - 0.7 * tm.slow;
            p.x += (mark.x + ((gx - mark.x) / gd) * 1.4 - p.x) * k;
            p.y += (mark.y + ((0 - mark.y) / gd) * 1.4 - p.y) * k;
          }
        }
        if (tm) {
          // Late runs: a tired side's forwards and midfield arrive after the move has gone.
          if (tm.slow > 0 && attacking && fb.role !== "DEF") p.x -= dir * 6 * tm.slow;
          if (tm.ragged > 0) {
            // No warm-up, no team talk: he's roughly where he should be, give or take ten yards.
            const w2 = hash01(fb.number * 17 + t, Math.floor((tick + fb.number * 53) / 330));
            p.x += (whim - 0.5) * 28 * tm.ragged; p.y += (w2 - 0.5) * 22 * tm.ragged;
          }
          if (tm.lost > 0) {
            // Wrong runs: the wrong flank, or drawn to the ball like everybody else.
            if (whim < 0.38 * tm.lost) p.y = -p.y;
            else if (whim < 0.9 * tm.lost) { p.x += (b.x - p.x) * 0.72; p.y += (b.y - p.y) * 0.72; }
          }
          if (tm.swarm > 0 && Math.hypot(b.x - a.x, b.y - a.y) < 24 && whim < tm.swarm) { p.x = b.x + (whim - 0.5) * 5; p.y = b.y + (hash01(fb.number, 7) - 0.5) * 5; }
        }
        // Keep a little space between team-mates. (A confused side doesn't: that's the bunching.)
        if (!tm || tm.lost < 0.5) for (const o of mates) {
          if (o === a) continue;
          const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
          if (d < 2.2 && d > 0.01) { p.x += (dx / d) * (2.2 - d) * 0.5; p.y += (dy / d) * (2.2 - d) * 0.5; }
        }
        // A keeper with the ball in his hands gets some room.
        if (b.held && owner && ownerTeam !== t) {
          const d = Math.hypot(p.x - owner.x, p.y - owner.y);
          if (d < 9) { p.x += -dir * (9 - d); }
        }
        if (tm) { p.x = clamp(p.x, -HL + 1.5, HL - 1.5); p.y = clamp(p.y, -HW + 1, HW - 1); }
        fb.tx = p.x; fb.ty = p.y;
        const d = Math.hypot(p.x - a.x, p.y - a.y);
        fb.sprint = tm ? d > 7 + 9 * tm.slow - 3 * tm.hyper || (attacking && fb.role === "FWD" && d > 2.5 + 6 * tm.slow) : d > 7 || (attacking && fb.role === "FWD" && d > 2.5);
        // No referee: whoever's standing nearest gets it, ball or no ball. More of it the longer it goes on.
        if (law > 0.3 && chance(s.rng.match, (0.035 + 0.11 * law) * (1 + tm!.hyper))) {
          for (const o of opps) {
            if (o.fb!.role === "GK" || isDown(o, tick) || Math.hypot(o.x - a.x, o.y - a.y) > 1.9) continue;
            if (b.owner === o.id) { b.owner = null; b.vx = o.vx * 0.4; b.vy = o.vy * 0.4; b.freeUntil = tick + 6; }
            clatter(w, m, a, o, law, true);
            break;
          }
        }
      }
      steer(a, tick, sp);
    }
  }
}

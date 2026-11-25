// Dead-ball situations: who takes them, where everyone stands, and the kick itself.
import { chance, rnd, rndRange } from "../core/rng";
import type { Actor } from "../core/types";
import { clamp } from "../core/vec";
import type { World } from "../core/world";
import { bestPass, offsideLine, slotTarget, steer } from "./ai";
import { kick, passTo, shootAt } from "./ball";
import { FORMATIONS, HL, HW, PITCH } from "./config";
import type { MatchState, Restart, RestartType, TeamIdx } from "./types";
import { dirOf, keeperOf, other, playing } from "./util";

/** Line up a substitution for the next dead ball. If nobody can come on, the team plays short. */
export function queueSub(w: World, m: MatchState, off: Actor, reason: string): void {
  const s = w.state, fb = off.fb!, team = m.teams[fb.team];
  const reserved = new Set(team.pendingSubs.map((p) => p.on));
  const bench = team.squad.map((id) => s.actors[id]).filter((a) => a.fb!.status === "bench" && !reserved.has(a.id));
  const pick = bench.find((a) => a.fb!.role === fb.role) ?? bench.find((a) => (a.fb!.role === "GK") === (fb.role === "GK")) ?? (fb.role === "GK" ? bench[0] : undefined);
  fb.goneReason = reason;
  if (team.subsLeft - team.pendingSubs.length > 0 && pick) team.pendingSubs.push({ off: off.id, on: pick.id });
  else if (reason !== "tactical" && fb.status === "playing") { fb.status = "gone"; off.x = 0; off.y = -HW - 8; }
}

function processSubs(w: World, m: MatchState): void {
  const s = w.state;
  for (const t of [0, 1] as TeamIdx[]) {
    const team = m.teams[t], dir = dirOf(m, t);
    for (const sub of team.pendingSubs) {
      const off = s.actors[sub.off], on = s.actors[sub.on];
      if (on.fb!.status !== "bench") continue;
      on.fb!.status = "playing"; on.fb!.slot = off.fb!.slot;
      if (off.fb!.role === "GK") on.fb!.role = "GK";
      else if (on.fb!.role === "GK") on.fb!.role = off.fb!.role;
      on.x = -dir * 3; on.y = -HW; on.fb!.tx = on.x; on.fb!.ty = on.y;
      off.fb!.status = "gone"; off.fb!.goneReason ??= "subbed";
      off.x = -dir * 8; off.y = -HW - 4.5; off.vx = off.vy = 0;
      team.subsLeft--; m.stoppage += 2;
      w.bus.emit({ type: "fb_sub", t: s.tick, team: t, on: on.id, off: off.id, reason: off.fb!.goneReason });
    }
    team.pendingSubs = [];
    // A team must have someone in goal.
    if (!keeperOf(s, m, t)) {
      const out = playing(s, m, t);
      if (!out.length) continue;
      const benchGk = team.squad.map((id) => s.actors[id]).find((a) => a.fb!.status === "bench" && a.fb!.role === "GK");
      if (benchGk && team.subsLeft > 0) {
        const sac = out.filter((a) => a.fb!.role === "FWD").pop() ?? out[out.length - 1];
        sac.fb!.status = "gone"; sac.fb!.goneReason = "subbed"; sac.x = -dir * 8; sac.y = -HW - 4.5;
        benchGk.fb!.status = "playing"; benchGk.fb!.slot = 0; benchGk.x = -dir * (HL - 2); benchGk.y = 0;
        team.subsLeft--;
        w.bus.emit({ type: "fb_sub", t: s.tick, team: t, on: benchGk.id, off: sac.id, reason: "keeper" });
      } else {
        const vol = out.find((a) => a.fb!.role === "MID") ?? out[0];
        vol.fb!.role = "GK"; vol.fb!.slot = 0;
        w.bus.emit({ type: "fb_emergency_keeper", t: s.tick, team: t, id: vol.id });
      }
    }
  }
}

function pickTaker(w: World, m: MatchState, type: RestartType, team: TeamIdx, x: number, y: number): Actor | null {
  const s = w.state, all = playing(s, m, team), out = all.filter((a) => a.fb!.role !== "GK");
  if (!all.length) return null;
  const best = (f: (a: Actor) => number, pool = out) => pool.slice().sort((p, q) => f(q) - f(p))[0] ?? all[0];
  const nearest = () => best((a) => -Math.hypot(a.x - x, a.y - y));
  switch (type) {
    case "kickoff": return out.find((a) => a.fb!.role === "FWD") ?? nearest();
    case "drop_ball": return nearest();
    case "goal_kick": return keeperOf(s, m, team) ?? nearest();
    case "corner": return best((a) => a.fb!.passing, out.filter((a) => a.fb!.role !== "DEF" && !a.fb!.star));
    case "penalty": return best((a) => a.fb!.shooting * 0.6 + a.fb!.composure * 0.4);
    case "free_kick": {
      const d = Math.hypot(dirOf(m, team) * HL - x, y);
      return d < 19 ? best((a) => a.fb!.shooting) : nearest();
    }
    default: return nearest();
  }
}

export function beginRestart(w: World, m: MatchState, type: RestartType, team: TeamIdx, x: number, y: number, delaySec: number): void {
  const s = w.state, b = m.ball, dir = dirOf(m, team);
  processSubs(w, m);
  if (type === "goal_kick") { x = -dir * (HL - PITCH.sixL); y = (y >= 0 ? 1 : -1) * (PITCH.sixW / 4); }
  else if (type === "corner") { x = Math.sign(x) * (HL - 0.4); y = Math.sign(y) * (HW - 0.4); }
  else if (type === "penalty") { x = dir * (HL - PITCH.penSpot); y = 0; }
  else if (type === "kickoff") { x = 0; y = 0; }
  else { x = clamp(x, -HL + 0.3, HL - 0.3); y = clamp(y, -HW + 0.2, HW - 0.2); }
  b.x = x; b.y = y; b.z = 0; b.vx = b.vy = b.vz = 0; b.owner = null; b.held = false; b.shot = null;
  m.passTo = null; m.offside = null;
  m.pending = m.pending.filter((c) => c.kind === "goal");
  for (const t of [0, 1] as TeamIdx[]) for (const a of playing(s, m, t)) { a.fb!.diveAt = 0; a.fb!.diveUntil = 0; a.fb!.intent = "setpiece"; }
  const taker = pickTaker(w, m, type, team, x, y);
  m.restart = { type, team, x, y, taker: taker?.id ?? null, readyAt: s.tick + Math.round(delaySec * 60) };
  m.phase = "restart";
  m.possession = team;
  if (type === "corner") m.stats[team].corners++;
  w.bus.emit({ type: "fb_restart", t: s.tick, restart: type, team });
}

/** A dead ball rolling around: it moves, but nothing it does counts. */
function looseBall(w: World, m: MatchState): void {
  const b = m.ball, dt = 1 / 60;
  if (b.z > 0 || b.vz > 0) {
    b.vz -= 9.8 * dt; b.z += b.vz * dt;
    if (b.z <= 0) { b.z = 0; b.vz = -b.vz * 0.5; if (b.vz < 1.3) b.vz = 0; b.vx *= 0.82; b.vy *= 0.82; }
  } else {
    const sp = Math.hypot(b.vx, b.vy), ns = Math.max(0, sp - 3.4 * dt);
    if (sp > 0) { b.vx *= ns / sp; b.vy *= ns / sp; }
  }
  const px = b.x;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (Math.abs(px) <= HL && Math.abs(b.x) > HL && Math.abs(b.y) < PITCH.goalW / 2 && b.z < PITCH.goalH) {
    b.vx = 0; b.vy = 0; b.x = Math.sign(b.x) * (HL + 0.9);
    w.bus.emit({ type: "fb_dead_ball_net", t: w.state.tick, by: b.lastTouch });
  }
  if (Math.abs(b.x) > HL + 6 || Math.abs(b.y) > HW + 6) { b.vx = b.vy = 0; }
}

const CORNER_SPOTS = [[4, 1.5], [6.5, -1.5], [8.5, 2.5], [5, -4], [10, -0.5]];
const rolePri: Record<string, number> = { FWD: 0, MID: 1, DEF: 2, GK: 9 };

function setTargets(w: World, m: MatchState, r: Restart): void {
  const s = w.state, b = m.ball;
  const lists = [playing(s, m, 0), playing(s, m, 1)];
  for (const t of [0, 1] as TeamIdx[]) {
    const mates = lists[t], opps = lists[other(t)], dir = dirOf(m, t), taking = t === r.team;
    const offLine = offsideLine(m, opps, dir);
    const order = mates.filter((a) => a.fb!.role !== "GK" && a.id !== r.taker).sort((p, q) => rolePri[p.fb!.role] - rolePri[q.fb!.role] || p.fb!.slot - q.fb!.slot);
    for (const a of mates) {
      const fb = a.fb!;
      let x: number, y: number;
      if (a.id === r.taker) {
        const back = r.type === "throw_in" ? 0 : 0.5;
        x = r.x - dir * back; y = r.y + (r.type === "throw_in" ? Math.sign(r.y) * 0.3 : 0);
        if (r.type === "corner") { x = r.x + Math.sign(r.x) * 0.3; y = r.y + Math.sign(r.y) * 0.3; }
      } else if (fb.role === "GK") {
        x = -dir * (HL - 1.2); y = 0;
      } else if (r.type === "kickoff") {
        const slot = FORMATIONS[m.teams[t].formation][fb.slot];
        let px = Math.min(-0.9, slot.x * HL * 0.5 - 7), py = slot.y * HW * 0.8;
        if (!taking && Math.hypot(px, py) < PITCH.circleR + 0.8) px = -(PITCH.circleR + 1);
        x = px * dir; y = py * dir;
      } else if (r.type === "corner") {
        const gs = Math.sign(r.x), sy = Math.sign(r.y);
        const i = order.indexOf(a);
        if (taking) {
          if (i < CORNER_SPOTS.length) { x = gs * (HL - CORNER_SPOTS[i][0]); y = sy * CORNER_SPOTS[i][1]; }
          else if (i < CORNER_SPOTS.length + 2) { x = gs * (HL - 15); y = (i % 2 ? 6 : -6); }
          else { x = gs * -2; y = (i % 2 ? 9 : -9); }
        } else {
          // Back markers first: defenders, then midfielders; one forward stays up.
          const j = order.length - 1 - i;
          if (i === 0) { x = gs * (HL - 26); y = 0; }
          else if (j < CORNER_SPOTS.length) { x = gs * (HL - CORNER_SPOTS[j][0] + 1.1); y = sy * CORNER_SPOTS[j][1] * 0.85; }
          else { x = gs * (HL - 3 - (j - CORNER_SPOTS.length) * 1.5); y = ((j % 2) * 2 - 1) * (2 + j * 0.6); }
        }
      } else {
        const vbx = r.type === "goal_kick" ? dirOf(m, r.team) * -6 : b.x;
        const p = slotTarget(m, a, taking, offLine, vbx, r.type === "goal_kick" ? 0 : b.y);
        x = p.x; y = p.y;
        if (r.type === "penalty") {
          const gs = dirOf(m, r.team);
          if (x * gs > HL - PITCH.boxL - 1) x = gs * (HL - PITCH.boxL - 1 - Math.abs(y) * 0.05);
          const d = Math.hypot(x - r.x, y - r.y);
          if (d < PITCH.circleR) x -= gs * (PITCH.circleR - d + 0.5);
        }
        if (r.type === "throw_in" && taking) {
          const i = order.slice().sort((p1, p2) => Math.hypot(p1.x - r.x, p1.y - r.y) - Math.hypot(p2.x - r.x, p2.y - r.y)).indexOf(a);
          if (i < 2) { x = r.x + (i === 0 ? dir * 5 : -dir * 4); y = r.y - Math.sign(r.y) * (5 + i * 2); }
        }
      }
      // The other side has to give room.
      if (!taking && fb.role !== "GK" || (!taking && r.type !== "penalty" && fb.role === "GK" && false)) {
        const need = r.type === "throw_in" ? 2.5 : r.type === "kickoff" ? 0 : 6.6;
        const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy);
        if (d < need) {
          if (d < 0.01) { x = r.x - dir * need; }
          else { x = r.x + (dx / d) * need; y = r.y + (dy / d) * need; }
        }
      }
      fb.tx = clamp(x, -HL - 1, HL + 1); fb.ty = clamp(y, -HW - 1, HW + 1);
      fb.sprint = Math.hypot(fb.tx - a.x, fb.ty - a.y) > 9;
    }
  }
}

export function takePenalty(w: World, m: MatchState, taker: Actor, goalSign: number): void {
  const rng = w.state.rng.match, fb = taker.fb!;
  const side = chance(rng, 0.1) ? 0 : chance(rng, 0.5) ? 1 : -1;
  const aimY = side * (PITCH.goalW / 2 - 0.85);
  // Nerve shows up as error; reuse the shooting spread, scaled by composure.
  shootAt(w, m, taker, goalSign, aimY, rndRange(rng, 0.3, 1.5), 22, "penalty", 0.55 + (1 - fb.composure) * 1.3);
}

function execute(w: World, m: MatchState, r: Restart): void {
  const s = w.state, rng = s.rng.match, b = m.ball;
  const taker = r.taker ? s.actors[r.taker] : null;
  m.phase = "live"; m.restart = null;
  if (!taker || taker.fb!.status !== "playing") return;
  const fb = taker.fb!, team = r.team, dir = dirOf(m, team);
  const mates = playing(s, m, team), opps = playing(s, m, other(team));
  const offLine = offsideLine(m, opps, dir);
  b.x = r.x; b.y = r.y; b.z = 0;
  fb.gotBallAt = s.tick;
  const nearestMate = () => mates.filter((a) => a.id !== taker.id && a.fb!.role !== "GK")
    .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];

  switch (r.type) {
    case "kickoff": {
      const mid = mates.filter((a) => a.fb!.role === "MID").sort((p, q) => Math.abs(p.y) - Math.abs(q.y))[0] ?? nearestMate();
      if (mid) { passTo(w, m, taker, mid.x, mid.y); m.passTo = mid.id; }
      w.bus.emit({ type: "fb_kickoff", t: s.tick, team, period: m.period });
      break;
    }
    case "throw_in": {
      const p = bestPass(w, m, taker, mates, opps, offLine, { maxD: 17, noOffside: true });
      const tgt = p ? { x: p.x, y: p.y, id: p.mate.id } : (() => { const n = nearestMate(); return n ? { x: n.x, y: n.y, id: n.id } : null; })();
      if (tgt) { passTo(w, m, taker, tgt.x, tgt.y, { kind: "throw", maxSpeed: 12 }); m.passTo = tgt.id; }
      break;
    }
    case "goal_kick": {
      const p = chance(rng, 0.3) ? bestPass(w, m, taker, mates, opps, offLine, { maxD: 18, noOffside: true }) : null;
      if (p && p.u > 0.3 && !p.loft) { passTo(w, m, taker, p.x, p.y, { kind: "throw" }); m.passTo = p.mate.id; }
      else {
        const pool = mates.filter((a) => a.fb!.role === "FWD" || a.fb!.role === "MID");
        const t = pool.length ? pool[Math.floor(rnd(rng) * pool.length)] : taker;
        passTo(w, m, taker, t.x + dir * 3, t.y, { loft: true, kind: "throw" });
        m.passTo = t.id;
      }
      break;
    }
    case "corner": {
      const gs = Math.sign(r.x), sy = Math.sign(r.y);
      passTo(w, m, taker, gs * (HL - rndRange(rng, 4, 8.5)), sy * rndRange(rng, -1.5, 3), { loft: true, kind: "cross" });
      m.offside = null;
      break;
    }
    case "free_kick": {
      const gd = Math.hypot(dir * HL - b.x, b.y);
      if (gd < 19 && Math.abs(b.y) < 13) {
        const gk = keeperOf(s, m, other(team));
        const side = gk && gk.y > 0 ? -1 : 1;
        shootAt(w, m, taker, dir, side * rndRange(rng, 1.6, PITCH.goalW / 2 - 0.5), rndRange(rng, 0.9, 1.9), 20, "shot", 1.05);
      } else {
        const p = bestPass(w, m, taker, mates, opps, offLine);
        if (p && p.u > 0.15) { passTo(w, m, taker, p.x, p.y, { loft: p.loft }); m.passTo = p.mate.id; }
        else kick(w, m, taker, b.x + dir * 26, b.y * 0.5, 19, 8, "clear");
      }
      break;
    }
    case "penalty":
      takePenalty(w, m, taker, dir);
      m.offside = null;
      break;
    case "drop_ball": {
      const n = nearestMate();
      if (n) { passTo(w, m, taker, n.x, n.y); m.passTo = n.id; }
      break;
    }
  }
}

export function stepRestart(w: World, m: MatchState): void {
  const s = w.state, tick = s.tick, r = m.restart!;
  if ((tick & 7) === 0 || tick === r.readyAt) setTargets(w, m, r);
  for (const t of [0, 1] as TeamIdx[]) for (const a of playing(s, m, t)) steer(a, tick, 1, 0.6);
  // Play is stopped: a dead ball can still be kicked about by whoever stopped it.
  const b = m.ball;
  if (!b.owner && (Math.hypot(b.vx, b.vy) > 0.05 || b.z > 0)) {
    looseBall(w, m);
  }
  if (m.halted) { r.readyAt = Math.max(r.readyAt, tick + 150); return; }
  if (tick < r.readyAt) return;
  // Put the ball back where it should be before anyone takes it.
  b.x = r.x; b.y = r.y; b.z = 0; b.vx = b.vy = b.vz = 0;
  const taker = r.taker ? s.actors[r.taker] : null;
  if (taker && taker.fb!.status === "playing") {
    const d = Math.hypot(taker.fb!.tx - taker.x, taker.fb!.ty - taker.y);
    if (d > 1 && tick < r.readyAt + 300) return;
    if (d > 1) { taker.x = taker.fb!.tx; taker.y = taker.fb!.ty; }
  } else {
    // The taker has gone missing; find another.
    const nt = pickTaker(w, m, r.type, r.team, r.x, r.y);
    if (nt && nt.id !== r.taker) { r.taker = nt.id; r.readyAt = tick + 60; return; }
  }
  execute(w, m, r);
}

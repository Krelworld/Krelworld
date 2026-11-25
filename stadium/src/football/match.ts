// The match as a whole: periods, the clock, dead balls, extra time and penalties.
import { DT, type Actor } from "../core/types";
import { clamp } from "../core/vec";
import type { World } from "../core/world";
import { keeperDive, steer, stepPlayers } from "./ai";
import { stepOfficials } from "./authority";
import { stepBall, type DeadBall } from "./ball";
import { FORMATIONS, HL, HW, PITCH } from "./config";
import { beginRestart, queueSub, stepRestart, takePenalty } from "./restarts";
import type { MatchState, TeamIdx } from "./types";
import { dirOf, keeperOf, other, playing } from "./util";

export const periodSeconds = (m: MatchState): number => (m.period <= 2 ? m.cfg.halfSeconds : m.cfg.halfSeconds / 3);
const minuteSeconds = (m: MatchState): number => m.cfg.halfSeconds / 45;
const PERIOD_BASE = [0, 0, 45, 90, 105, 120];

/** Match minute as shown on the scoreboard. */
export function matchMinute(m: MatchState): number {
  return PERIOD_BASE[Math.min(m.period, 5)] + Math.floor(m.clock / minuteSeconds(m));
}
export function clockLabel(m: MatchState): string {
  if (m.period >= 5) return "PENS";
  const len = m.period <= 2 ? 45 : 15, base = PERIOD_BASE[m.period];
  const mins = m.clock / minuteSeconds(m);
  const sec = Math.floor((mins % 1) * 60).toString().padStart(2, "0");
  if (mins >= len) return `${base + len}+${Math.floor(mins - len) + 1}`;
  return `${base + Math.floor(mins)}:${sec}`;
}

function handleDead(w: World, m: MatchState, dead: DeadBall): void {
  const s = w.state, tick = s.tick, b = m.ball;
  if (dead.k === "goal") {
    const team = ([0, 1] as TeamIdx[]).find((t) => dirOf(m, t) === dead.sign)!;
    // A shot that goes in off a defender still belongs to the shooter.
    const ls = b.lastShot && b.lastShot.team === team && tick - b.lastShot.at < 100 ? b.lastShot : null;
    const by = ls ? ls.by : b.lastTouch;
    const ownGoal = !ls && b.lastTouchTeam === other(team);
    m.physicalGoals[team]++;
    b.vx = b.vy = b.vz = 0; b.z = 0; b.x = dead.sign * (HL + 0.9); b.owner = null; b.held = false; b.shot = null;
    m.pending.push({ kind: "goal", t: tick, x: b.x, y: b.y, team, actor: by, ownGoal });
    m.phase = "goal_pause"; m.phaseUntil = tick + 270; m.next = null; m.offside = null; m.passTo = null;
    w.bus.emit({ type: "fb_goal_line", t: tick, team, by });
    return;
  }
  if (dead.k === "goal_line") {
    const defending = ([0, 1] as TeamIdx[]).find((t) => dirOf(m, t) === -dead.sign)!;
    if (b.shot && b.shot.team !== -1) w.bus.emit({ type: "fb_miss", t: tick, by: b.shot.by, team: b.shot.team });
    if (b.lastTouchTeam === defending) beginRestart(w, m, "corner", other(defending), dead.sign * HL, (dead.y >= 0 ? 1 : -1) * HW, 4);
    else beginRestart(w, m, "goal_kick", defending, dead.sign * HL, dead.y, 3);
    return;
  }
  const to: TeamIdx = b.lastTouchTeam === -1 ? (m.possession === 0 ? 1 : 0) : other(b.lastTouchTeam);
  beginRestart(w, m, "throw_in", to, dead.x, dead.y, 2);
}

function updateManagers(w: World, m: MatchState): void {
  const s = w.state, len = m.cfg.halfSeconds;
  const progress = clamp((Math.min(m.period, 2) - 1 + clamp(m.clock / len, 0, 1)) / 2, 0, 1);
  for (const t of [0, 1] as TeamIdx[]) {
    const team = m.teams[t], diff = m.score[t] - m.score[other(t)];
    const men = playing(s, m, t).length - playing(s, m, other(t)).length;
    const want = clamp(-diff * 0.4 * (0.3 + progress) + men * 0.1 + (m.period > 2 ? 0.1 : 0), -0.7, 1);
    team.mentality += (want - team.mentality) * 0.5;
    // Fresh legs.
    if (m.period >= 2) {
      const frac = m.period === 2 ? m.clock / len : 1;
      const allowed = frac > 0.66 ? 3 : frac > 0.33 ? 2 : 0;
      let made = 5 - team.subsLeft + team.pendingSubs.length;
      const queued = new Set(team.pendingSubs.map((p) => p.off));
      const tired = playing(s, m, t).filter((a) => a.fb!.role !== "GK" && a.fb!.fatigue > 0.45 && !queued.has(a.id) && !a.fb!.star)
        .sort((p, q) => q.fb!.fatigue - p.fb!.fatigue);
      while (made < allowed && tired.length) { queueSub(w, m, tired.shift()!, "tactical"); made++; }
    }
  }
}

function finish(w: World, m: MatchState): void {
  m.phase = "finished";
  if (m.shootout && m.shootout.scored[0] !== m.shootout.scored[1]) m.winner = m.shootout.scored[0] > m.shootout.scored[1] ? 0 : 1;
  else m.winner = m.score[0] === m.score[1] ? -1 : m.score[0] > m.score[1] ? 0 : 1;
  w.bus.emit({ type: "fb_match_end", t: w.state.tick, winner: m.winner, score: [...m.score], pens: m.shootout ? [...m.shootout.scored] : null });
}

export function endPeriod(w: World, m: MatchState): void {
  const s = w.state, tick = s.tick;
  w.bus.emit({ type: "fb_period_end", t: tick, period: m.period, score: [...m.score] });
  m.restart = null; m.pending = [];
  m.ball.owner = null; m.ball.held = false; m.ball.vx = m.ball.vy = m.ball.vz = 0; m.ball.z = 0; m.ball.shot = null;
  const level = m.score[0] === m.score[1];
  if (m.period === 2 && (!m.cfg.knockout || !level)) return finish(w, m);
  if (m.period === 4 && !level) return finish(w, m);
  m.phase = "break";
  m.phaseUntil = tick + Math.round((m.period === 1 ? m.cfg.halfTimeSeconds : m.period === 3 ? 4 : 8) * 60);
}

function placeForKickoff(w: World, m: MatchState): void {
  const s = w.state;
  for (const t of [0, 1] as TeamIdx[]) {
    const dir = dirOf(m, t);
    for (const a of playing(s, m, t)) {
      const fb = a.fb!, slot = FORMATIONS[m.teams[t].formation][fb.slot] ?? { x: 0, y: 0 };
      const px = fb.role === "GK" ? -HL + 1.5 : Math.min(-1.5, slot.x * HL * 0.5 - 8);
      a.x = px * dir; a.y = slot.y * HW * 0.8 * dir; a.vx = a.vy = 0;
      fb.tx = a.x; fb.ty = a.y; fb.stunUntil = 0; fb.diveAt = 0; fb.diveUntil = 0;
    }
  }
}

function startNextPeriod(w: World, m: MatchState): void {
  const s = w.state;
  m.period++;
  m.clock = 0; m.stoppage = 0; m.addedAnnounced = 0;
  if (m.period === 5) return startShootout(w, m);
  m.dir0 = m.dir0 === 1 ? -1 : 1;
  if (m.cfg.venue) { w.bus.emit({ type: "fb_period_start", t: s.tick, period: m.period }); beginRestart(w, m, "kickoff", m.period % 2 === 1 ? m.firstKick : other(m.firstKick), 0, 0, 6); return; }
  if (m.period === 2) for (const t of [0, 1] as TeamIdx[]) for (const a of playing(s, m, t)) a.fb!.fatigue = Math.max(0, a.fb!.fatigue - 0.15);
  placeForKickoff(w, m);
  w.bus.emit({ type: "fb_period_start", t: s.tick, period: m.period });
  beginRestart(w, m, "kickoff", m.period % 2 === 1 ? m.firstKick : other(m.firstKick), 0, 0, 2.5);
}

// ---------- Penalty shootout ----------
function startShootout(w: World, m: MatchState): void {
  const s = w.state;
  const order = ([0, 1] as TeamIdx[]).map((t) =>
    playing(s, m, t).sort((p, q) => (p.fb!.role === "GK" ? -1 : p.fb!.shooting) < (q.fb!.role === "GK" ? -1 : q.fb!.shooting) ? 1 : -1).map((a) => a.id),
  ) as [string[], string[]];
  m.shootout = { order, taken: [0, 0], scored: [0, 0], turn: 0, end: 1, kickAt: s.tick + 300, resolveAt: 0, taker: order[0][0] ?? null, scoredFlag: false };
  m.phase = "shootout";
  spotBall(m);
  w.bus.emit({ type: "fb_shootout_start", t: s.tick });
}

function spotBall(m: MatchState): void {
  const b = m.ball, so = m.shootout!;
  b.x = so.end * (HL - PITCH.penSpot); b.y = 0; b.z = 0; b.vx = b.vy = b.vz = 0; b.owner = null; b.held = false; b.shot = null;
}

function shootoutDecided(m: MatchState): boolean {
  const so = m.shootout!, [n0, n1] = so.taken, [s0, s1] = so.scored;
  if (n0 <= 5 && n1 <= 5) return s0 > s1 + (5 - n1) || s1 > s0 + (5 - n0);
  return n0 === n1 && s0 !== s1;
}

function stepShootout(w: World, m: MatchState): void {
  const s = w.state, tick = s.tick, so = m.shootout!, b = m.ball;
  const defKeeper = keeperOf(s, m, other(so.turn));
  for (const t of [0, 1] as TeamIdx[]) {
    const list = playing(s, m, t);
    list.forEach((a, i) => {
      const fb = a.fb!;
      if (a.id === so.taker) { fb.tx = b.owner || so.resolveAt ? a.x : so.end * (HL - PITCH.penSpot - 1.2); fb.ty = 0; }
      else if (a === defKeeper) { if (keeperDive(a, tick)) return; if (!so.resolveAt) { fb.tx = so.end * (HL - 0.3); fb.ty = 0; } }
      else if (fb.role === "GK") { fb.tx = so.end * (HL - 5); fb.ty = 11; }
      else { fb.tx = (t === 0 ? -1 : 1) * (1.5 + (i % 2) * 1.2); fb.ty = (i - list.length / 2) * 1.3; }
      fb.sprint = false;
      steer(a, tick, 0.8, 0.6);
    });
  }
  const taker = so.taker ? s.actors[so.taker] : null;
  if (!so.resolveAt) {
    if (tick < so.kickAt) return;
    if (taker && taker.fb!.status === "playing") {
      if (Math.hypot(taker.fb!.tx - taker.x, taker.fb!.ty - taker.y) > 1 && tick < so.kickAt + 240) return;
      so.scoredFlag = false;
      takePenalty(w, m, taker, so.end);
    }
    so.resolveAt = tick + 150;
    return;
  }
  const dead = stepBall(w, m);
  if (dead) { if (dead.k === "goal") so.scoredFlag = true; b.vx = b.vy = b.vz = 0; b.x = clamp(b.x, -HL - 0.9, HL + 0.9); }
  if (tick < so.resolveAt) return;
  so.taken[so.turn]++;
  if (so.scoredFlag) so.scored[so.turn]++;
  w.bus.emit({ type: "fb_shootout_kick", t: tick, by: so.taker, team: so.turn, scored: so.scoredFlag, tally: [...so.scored], taken: [...so.taken] });
  if (shootoutDecided(m)) return finish(w, m);
  so.turn = other(so.turn);
  const ord = so.order[so.turn];
  so.taker = ord.length ? ord[so.taken[so.turn] % ord.length] : null;
  so.kickAt = tick + 240; so.resolveAt = 0;
  if (defKeeper) { defKeeper.fb!.diveAt = 0; defKeeper.fb!.diveUntil = 0; }
  spotBall(m);
}

// ---------- Main step ----------
function idle(w: World, m: MatchState, tx?: (a: Actor, t: TeamIdx, i: number) => void): void {
  const s = w.state;
  for (const t of [0, 1] as TeamIdx[]) playing(s, m, t).forEach((a, i) => { if (tx) tx(a, t, i); a.fb!.sprint = false; steer(a, s.tick, 0.85, 0.8); });
}

export function stepMatch(w: World): void {
  const s = w.state, m = s.match!, tick = s.tick;
  switch (m.phase) {
    case "pre":
      idle(w, m);
      if (tick >= m.phaseUntil) {
        w.bus.emit({ type: "fb_period_start", t: tick, period: 1 });
        beginRestart(w, m, "kickoff", m.firstKick, 0, 0, 1.5);
      }
      break;
    case "restart":
      m.clock += DT;
      if (m.halted) m.stoppage += DT * 0.8;
      stepRestart(w, m);
      break;
    case "live": {
      m.clock += DT;
      if (m.halted) {
        // Stopped from outside: drop ball to whoever had it when play resumes.
        const team: TeamIdx = m.possession === -1 ? 0 : m.possession;
        beginRestart(w, m, "drop_ball", team, m.ball.x, m.ball.y, 3);
        m.stoppage += 1;
        break;
      }
      stepPlayers(w, m);
      const dead = stepBall(w, m);
      if (m.possession !== -1) m.stats[m.possession].possession++;
      if (dead && m.phase === "live") handleDead(w, m, dead);
      if (tick >= m.mentalityAt) { m.mentalityAt = tick + 1200; updateManagers(w, m); }
      break;
    }
    case "goal_pause": {
      m.clock += DT;
      const scorers = m.next?.type === "kickoff" ? other(m.next.team) : -1;
      idle(w, m, (a, t, i) => {
        const fb = a.fb!, dir = dirOf(m, t);
        if (t === scorers) { fb.tx = m.ball.x * 0.82 + ((i % 3) - 1) * 1.5; fb.ty = clamp(m.ball.y + (i - 5) * 1.1, -HW + 1, HW - 1); }
        else if (fb.role !== "GK") { const slot = FORMATIONS[m.teams[t].formation][fb.slot]; if (slot) { fb.tx = Math.min(-1.5, slot.x * HL * 0.5 - 8) * dir; fb.ty = slot.y * HW * 0.8 * dir; } }
      });
      if (tick >= m.phaseUntil && !m.pending.some((c) => c.kind === "goal")) {
        const n = m.next ?? { type: "kickoff" as const, team: 0 as TeamIdx, x: 0, y: 0 };
        m.next = null;
        beginRestart(w, m, n.type, n.team, n.x, n.y, n.type === "kickoff" ? 2.5 : 3);
      }
      break;
    }
    case "break":
      if (m.cfg.venue) { idle(w, m, () => {}); if (tick >= m.phaseUntil) startNextPeriod(w, m); break; }
      idle(w, m, (a, t, i) => {
        const dir = dirOf(m, t);
        if (m.period === 1) { a.fb!.tx = -dir * (1 + (i % 4)); a.fb!.ty = -HW - 6 - Math.floor(i / 4) * 1.2; }
        else { a.fb!.tx = -dir * (6 + (i % 4) * 1.2); a.fb!.ty = -HW + 2 + Math.floor(i / 4) * 1.2; }
      });
      if (tick >= m.phaseUntil) startNextPeriod(w, m);
      break;
    case "shootout":
      stepShootout(w, m);
      break;
    case "finished":
      idle(w, m);
      return;
  }
  stepOfficials(w, m);

  // Time.
  if (m.phase === "live" || m.phase === "restart") {
    const len = periodSeconds(m), min = minuteSeconds(m);
    if (!m.addedAnnounced && m.clock >= len) {
      m.addedAnnounced = clamp(Math.round((m.stoppage / min) * 2 + 1), 1, 9);
      if (m.period > 2) m.addedAnnounced = Math.min(m.addedAnnounced, 2);
      w.bus.emit({ type: "fb_added", t: tick, minutes: m.addedAnnounced, period: m.period });
    }
    if (m.addedAnnounced) {
      const over = m.clock - (len + m.addedAnnounced * min);
      if (over >= 0) {
        const safe = m.phase === "restart" ? m.restart!.type !== "penalty" : Math.abs(m.ball.x) < HL - 16;
        if (safe || over > 7) endPeriod(w, m);
      }
    }
  }
}

// The officials. Things physically happen on the pitch; they only count once an
// official has seen them and ruled. The scoreboard, cards and restarts all come
// from rulings, never directly from the physics.
import { chance, gauss } from "../core/rng";
import { DT, type Actor } from "../core/types";
import { clamp } from "../core/vec";
import type { World } from "../core/world";
import { HL, HW } from "./config";
import { beginRestart, queueSub } from "./restarts";
import type { Candidate, MatchState, TeamIdx } from "./types";
import { dirOf, inBox, other, playing } from "./util";

const available = (a: Actor | undefined, tick: number): boolean =>
  !!a && !!a.off && !a.off.incapacitated && a.downUntil <= tick;
const attentive = (a: Actor | undefined, tick: number): boolean =>
  available(a, tick) && a!.off!.distractedUntil <= tick;

/** How much the referee leans towards `team` (-1..1). */
function favour(ref: Actor, team: TeamIdx): number {
  const b = ref.off!.bias;
  return clamp(b[team] - b[other(team)], -1, 1);
}

export function sendOff(w: World, m: MatchState, a: Actor, reason: string): void {
  const fb = a.fb!;
  fb.status = "gone"; fb.goneReason = reason;
  if (m.ball.owner === a.id) { m.ball.owner = null; m.ball.held = false; }
  a.x = 0; a.y = -HW - 8; a.vx = a.vy = 0;
}

function ruleFoul(w: World, m: MatchState, c: Candidate): void {
  const s = w.state, tick = s.tick, rng = s.rng.match;
  const ref = s.actors[m.officials.referee];
  const offender = s.actors[c.actor!], victim = c.victim ? s.actors[c.victim] : undefined;
  const fav = favour(ref, c.team);
  const d = Math.hypot(ref.x - c.x, ref.y - c.y);
  let pSee = clamp(1.12 - d / 50 + (c.severity ?? 0) * 0.15, 0.45, 0.985);
  if (!attentive(ref, tick)) pSee *= 0.08;
  if (!available(ref, tick)) pSee = 0;
  pSee *= 1 - 0.8 * Math.max(0, fav);
  if (m.mods) pSee = Math.min(0.99, pSee * m.mods.see[c.team]);
  if (c.phantom) pSee = 1;
  if (!chance(rng, pSee)) {
    w.bus.emit({ type: "fb_foul_missed", t: tick, by: c.actor, on: c.victim, severity: c.severity, team: c.team });
    return;
  }
  let sev = (c.severity ?? 0) + 0.35 * (ref.off!.strictness - 0.5) - 0.5 * fav;
  if (m.mods) sev += m.mods.card[c.team];
  m.stats[c.team].fouls++;
  const penalty = inBox(c.x, c.y, -dirOf(m, c.team));
  let card: "none" | "yellow" | "second_yellow" | "red" = "none";
  if (offender?.fb && !c.phantom) {
    if (sev > 1.38) card = "red";
    else if (sev > 0.84) card = offender.fb.yellows >= 1 ? "second_yellow" : "yellow";
    if (card !== "none") m.stoppage += 3;
    if (card === "yellow" || card === "second_yellow") { offender.fb.yellows++; m.stats[c.team].yellows++; }
    if (card === "red" || card === "second_yellow") { m.stats[c.team].reds++; sendOff(w, m, offender, "sent_off"); }
  }
  w.bus.emit({ type: "fb_foul", t: tick, by: c.actor, on: c.victim, team: c.team, card, penalty, phantom: !!c.phantom });

  // Is he hurt?
  if (victim?.fb && !c.phantom && (c.severity ?? 0) > 0.9 && chance(rng, 0.18)) {
    const leaves = chance(rng, 0.4);
    victim.fb.stunUntil = tick + 360;
    m.stoppage += 6;
    w.bus.emit({ type: "fb_injury", t: tick, id: victim.id, team: victim.fb.team, leaves });
    if (leaves) queueSub(w, m, victim, "injured");
  }
  beginRestart(w, m, penalty ? "penalty" : "free_kick", other(c.team), c.x, c.y, penalty ? 5 : card !== "none" ? 4 : 2.4);
  if (m.mods && offender?.fb && victim?.fb && !c.phantom) confront(w, m, offender, victim, card !== "none");
}

/**
 * A wound-up side doesn't take a decision quietly. One of them (the nearest who isn't already involved) runs
 * over while the free kick waits: at the man who did it if their own lad is on the floor, at the referee if
 * the decision went against them. A referee who is doing his job books him for it now and then.
 */
function confront(w: World, m: MatchState, offender: Actor, victim: Actor, carded: boolean): void {
  const s = w.state, tick = s.tick, rng = s.rng.match, md = m.mods!;
  const vt = victim.fb!.team, ot = offender.fb!.team;
  // The fouled side squares up to the man who did it; the punished side has it out with the referee.
  const side: TeamIdx | -1 = md.team[vt].hyper > 0 && chance(rng, 0.3 * md.team[vt].hyper) ? vt
    : md.team[ot].hyper > 0 && chance(rng, (carded ? 0.4 : 0.15) * md.team[ot].hyper) ? ot : -1;
  if (side === -1) return;
  const target = side === vt ? offender : s.actors[m.officials.referee];
  if (!target || (target.fb && target.fb.status !== "playing")) return;
  let who: Actor | null = null, bd = 30;
  for (const a of playing(s, m, side)) {
    if (a === offender || a === victim || a.fb!.role === "GK" || a.fb!.controlled || a.fb!.boltAt || a.fb!.stunUntil > tick) continue;
    const d = Math.hypot(a.x - target.x, a.y - target.y);
    if (d < bd) { bd = d; who = a; }
  }
  if (!who) return;
  who.fb!.beefWith = target.id; who.fb!.beefUntil = tick + 210;
  if (m.restart) m.restart.readyAt += 90;
  // Booked for it, if the referee is in any mood to (a compromised one lets his favourites shout).
  let card: "none" | "yellow" | "second_yellow" = "none";
  const ref = s.actors[m.officials.referee];
  if (chance(rng, clamp(0.08 + 0.4 * (ref.off!.strictness - 0.5) + 0.5 * md.card[side] - 0.4 * favour(ref, side), 0, 0.8))) {
    card = who.fb!.yellows >= 1 ? "second_yellow" : "yellow";
    who.fb!.yellows++; m.stats[side].yellows++; m.stoppage += 3;
    if (card === "second_yellow") { m.stats[side].reds++; sendOff(w, m, who, "sent_off"); }
  }
  w.bus.emit({ type: "fb_confrontation", t: tick, by: who.id, on: target.id, team: side, card });
}

/** A referee who favours the team that just lost the ball may see a foul that was not there. */
export function maybePhantomFoul(w: World, m: MatchState, tackler: Actor, carrier: Actor): void {
  const s = w.state, ref = s.actors[m.officials.referee];
  if (!attentive(ref, s.tick)) return;
  const fav = favour(ref, carrier.fb!.team);
  if (fav > 0.05 && chance(s.rng.match, 0.3 * fav)) {
    m.pending.push({ kind: "foul", t: s.tick, x: carrier.x, y: carrier.y, team: tackler.fb!.team, actor: tackler.id, victim: carrier.id, severity: 0.3, phantom: true });
  }
}

function ruleOffside(w: World, m: MatchState, c: Candidate): void {
  const s = w.state, tick = s.tick;
  const ref = s.actors[m.officials.referee];
  const ars = m.officials.assistants.map((id) => s.actors[id]);
  const ar = ars.find((a) => a.off!.half === (Math.sign(c.x) || 1)) ?? ars[0];
  const margin = c.margin ?? 0;
  const perceived = margin + gauss(s.rng.match) * 0.3 - 0.6 * favour(ref, c.team);
  if (attentive(ar, tick) && available(ref, tick) && perceived > 0.12) {
    m.stats[c.team].offsides++;
    w.bus.emit({ type: "fb_offside", t: tick, by: c.actor, team: c.team, wrong: margin <= 0, margin });
    beginRestart(w, m, "free_kick", other(c.team), c.x, c.y, 2.2);
  } else if (margin > 0.12) {
    w.bus.emit({ type: "fb_offside_missed", t: tick, by: c.actor, team: c.team, margin });
  }
}

/** Returns true once someone has ruled. */
function ruleGoal(w: World, m: MatchState, c: Candidate): boolean {
  const s = w.state, tick = s.tick, rng = s.rng.match;
  const ref = s.actors[m.officials.referee];
  let by = ref;
  if (m.mods && m.mods.lawless) {
    // No recognised referee at all. The ball's in the net and everybody saw it, but nobody can give it: the
    // goal goes on a list for whoever takes charge next, and they kick off again among themselves.
    (m.unrecognised ??= []).push(c);
    w.bus.emit({ type: "fb_goal_pending", t: tick, team: c.team, by: c.actor, og: !!c.ownGoal, pending: pendingCount(m) });
    m.next = { type: "kickoff", team: other(c.team), x: 0, y: 0 };
    return true;
  }
  if (!available(ref, tick)) {
    // Nobody in charge. After a while the fourth official takes it upon himself.
    if (tick < c.t + 240) return false;
    by = s.actors[m.officials.fourth];
  }
  const scorer = c.actor ? s.actors[c.actor] : undefined;
  const legit = !!scorer?.fb && scorer.fb.status === "playing";
  if (!legit) {
    const noticed = chance(rng, by === ref ? (attentive(ref, tick) ? 0.97 : 0.4) : 0.6);
    if (noticed) {
      w.bus.emit({ type: "fb_no_goal", t: tick, reason: "intruder", by: c.actor, team: c.team, official: by.id });
      const defending = other(c.team);
      m.next = { type: "goal_kick", team: defending, x: -dirOf(m, defending) * HL, y: 0 };
      return true;
    }
  }
  m.score[c.team]++;
  if (legit && !c.ownGoal) scorer!.fb!.goals++;
  m.stoppage += 2.5;
  w.bus.emit({ type: "fb_goal", t: tick, team: c.team, by: c.actor, og: !!c.ownGoal, legit, score: [m.score[0], m.score[1]], official: by.id });
  m.next = { type: "kickoff", team: other(c.team), x: 0, y: 0 };
  return true;
}

const pendingCount = (m: MatchState): [number, number] => {
  const n: [number, number] = [0, 0];
  for (const c of m.unrecognised ?? []) n[c.team]++;
  return n;
};

/**
 * Somebody with authority finally rules on the goals that went in while there was nobody to give them:
 * each one stands or it never happened. Returns how many were given to each side.
 */
export function settleUnrecognised(w: World, m: MatchState, official: string | null, give: (c: Candidate) => boolean, only?: TeamIdx): [number, number] {
  const s = w.state, tick = s.tick, given: [number, number] = [0, 0];
  // Any goal still waiting for a ruling the ordinary way is in the same boat.
  const waiting = m.pending.filter((c) => c.kind === "goal");
  if (waiting.length) { m.pending = m.pending.filter((c) => c.kind !== "goal"); (m.unrecognised ??= []).push(...waiting); if (m.phase === "goal_pause" && !m.next) m.next = { type: "kickoff", team: other(waiting[0].team), x: 0, y: 0 }; }
  // One side's goals only, if asked: the rest stay on the list for somebody else.
  const all = m.unrecognised ?? [], list = only === undefined ? all : all.filter((c) => c.team === only);
  const rest = only === undefined ? [] : all.filter((c) => c.team !== only);
  if (rest.length) m.unrecognised = rest; else delete m.unrecognised;
  for (const c of list) {
    const scorer = c.actor ? s.actors[c.actor] : undefined;
    if (give(c)) {
      m.score[c.team]++; given[c.team]++;
      if (scorer?.fb && !c.ownGoal) scorer.fb.goals++;
      w.bus.emit({ type: "fb_goal", t: tick, team: c.team, by: c.actor, og: !!c.ownGoal, legit: !!scorer?.fb, score: [m.score[0], m.score[1]], official, late: true });
    } else {
      w.bus.emit({ type: "fb_no_goal", t: tick, reason: "unrecognised", by: c.actor, team: c.team, official });
    }
  }
  return given;
}

function moveTo(a: Actor, tx: number, ty: number, speed: number): void {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.3) { a.vx = a.vy = 0; return; }
  const st = Math.min(d, speed * DT);
  a.vx = (dx / d) * speed; a.vy = (dy / d) * speed;
  a.x += (dx / d) * st; a.y += (dy / d) * st; a.facing = Math.atan2(dy, dx);
}

export function stepOfficials(w: World, m: MatchState): void {
  const s = w.state, tick = s.tick, b = m.ball;

  // Rulings.
  if (m.pending.length) {
    const keep: Candidate[] = [];
    for (const c of m.pending) {
      if (c.kind === "goal") { if (!ruleGoal(w, m, c)) keep.push(c); }
      else if (m.phase !== "live") { /* play had already stopped */ }
      else if (m.mods && m.mods.lawless) {
        // Nobody to rule on it. It happened; that's all anyone can say.
        if (c.kind === "foul") w.bus.emit({ type: "fb_foul_unjudged", t: tick, by: c.actor, on: c.victim, severity: c.severity, team: c.team });
      }
      else if (c.kind === "foul") ruleFoul(w, m, c);
      else ruleOffside(w, m, c);
    }
    m.pending = keep;
  }

  // Positions.
  const ref = s.actors[m.officials.referee];
  if (available(ref, tick) && !(m.cfg.venue && (m.phase === "pre" || m.phase === "break"))) {
    if (m.phase === "live" || m.phase === "restart") {
      const tx = clamp(b.x - Math.sign(b.x || 1) * 4, -HL + 3, HL - 3), ty = clamp(b.y + (b.y > 0 ? -7 : 7), -HW + 2, HW - 2);
      if (Math.hypot(tx - ref.x, ty - ref.y) > 2.5) moveTo(ref, tx, ty, 5.6); else ref.vx = ref.vy = 0;
    } else if (m.phase === "break" || m.phase === "finished") moveTo(ref, 0, -HW - 6, 3);
    else ref.vx = ref.vy = 0;
  }
  for (const id of m.officials.assistants) {
    const ar = s.actors[id], off = ar.off!;
    if (!available(ar, tick)) continue;
    if (m.cfg.venue && (m.phase === "pre" || m.phase === "break")) continue;
    const defTeam = ([0, 1] as TeamIdx[]).find((t) => dirOf(m, t) === -off.half)!;
    const xs = playing(s, m, defTeam).map((p) => p.x * off.half).sort((p, q) => q - p);
    const line = Math.max(xs.length > 1 ? xs[1] : 0, b.x * off.half, 0);
    moveTo(ar, clamp(line, 0, HL) * off.half, off.line * (HW + 1), 6.5);
  }
}

/** Something unpleasant happens to an official; used by the sandbox later. */
export function refereeAvailable(w: World, m: MatchState): boolean {
  return available(w.state.actors[m.officials.referee], w.state.tick);
}

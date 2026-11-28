// Ways the outside world can interfere with a match. The sandbox calls these;
// the match never calls the sandbox.
import type { Id } from "../core/types";
import type { World } from "../core/world";
import { settleUnrecognised } from "./authority";
import { kick } from "./ball";
import { HW } from "./config";
import { queueSub } from "./restarts";
import type { Candidate, MatchMods, TeamIdx } from "./types";

/** Take a player out of the game (arrest, injury, a bus that never arrived). His team may bring on a substitute. */
export function removePlayer(w: World, id: Id, reason: string): boolean {
  const m = w.state.match, a = w.state.actors[id];
  if (!m || !a?.fb || a.fb.status !== "playing") return false;
  a.fb.status = "gone"; a.fb.goneReason = reason;
  if (m.ball.owner === id) { m.ball.owner = null; m.ball.held = false; }
  a.x = 0; a.y = -26 - 8; a.vx = a.vy = 0;
  w.bus.emit({ type: "fb_removed", t: w.state.tick, id, team: a.fb.team, reason });
  queueSub(w, m, a, reason);
  return true;
}

/** Pay a player to throw it. */
export function bribePlayer(w: World, id: Id, on = true): void {
  const a = w.state.actors[id];
  if (a?.fb) { a.fb.bribed = on; w.bus.emit({ type: "fb_bribed", t: w.state.tick, id, on, secret: true }); }
}

/** Make a player reckless for a while. */
export function wirePlayer(w: World, id: Id, seconds: number): void {
  const a = w.state.actors[id];
  if (a?.fb) a.fb.wiredUntil = w.state.tick + Math.round(seconds * 60);
}

export function distractReferee(w: World, seconds: number): void {
  const m = w.state.match; if (!m) return;
  w.state.actors[m.officials.referee].off!.distractedUntil = w.state.tick + Math.round(seconds * 60);
  w.bus.emit({ type: "fb_ref_distracted", t: w.state.tick, seconds });
}

/** Positive favours the team, negative is against them. -1..1. */
export function biasReferee(w: World, team: TeamIdx, amount: number): void {
  const m = w.state.match; if (!m) return;
  w.state.actors[m.officials.referee].off!.bias[team] = amount;
}

export function floorReferee(w: World, seconds: number): void {
  const m = w.state.match; if (!m) return;
  const ref = w.state.actors[m.officials.referee];
  ref.downUntil = w.state.tick + Math.round(seconds * 60);
  w.bus.emit({ type: "fb_ref_down", t: w.state.tick, seconds });
}

/** Anybody at all kicks the ball: a fan, a steward, a dog. Returns false if they are not close enough. */
export function intruderKick(w: World, actorId: Id, dirX: number, dirY: number, speed: number, vz = 0): boolean {
  const m = w.state.match, a = w.state.actors[actorId];
  if (!m || !a || a.downUntil > w.state.tick) return false;
  const b = m.ball;
  if (b.held || Math.hypot(b.x - a.x, b.y - a.y) > 1.3 || b.z > 1.2) return false;
  const l = Math.hypot(dirX, dirY) || 1;
  kick(w, m, a, b.x + (dirX / l) * 10, b.y + (dirY / l) * 10, speed, vz, "shot");
  m.passTo = null;
  w.bus.emit({ type: "fb_intruder_kick", t: w.state.tick, actor: actorId });
  return true;
}

/** Stop play from outside the game (an intruder, a dog, an incident). */
export function haltPlay(w: World, reason: string): void {
  const m = w.state.match;
  if (!m || m.halted || m.phase === "finished" || m.phase === "shootout") return;
  m.halted = reason;
  w.bus.emit({ type: "fb_halted", t: w.state.tick, reason });
}
export function resumePlay(w: World): void {
  const m = w.state.match;
  if (!m || !m.halted) return;
  m.halted = null;
  w.bus.emit({ type: "fb_resumed", t: w.state.tick });
}

/** A player sets off for the tunnel at a run and takes no further part (whoever sent him removes him when he
 *  gets there, with removePlayer). */
export function boltPlayer(w: World, id: Id): boolean {
  const m = w.state.match, a = w.state.actors[id];
  if (!m || !a?.fb || a.fb.status !== "playing" || a.fb.controlled || a.fb.boltAt) return false;
  a.fb.boltAt = w.state.tick; a.fb.stunUntil = 0;
  a.fb.tx = Math.max(-6, Math.min(6, a.x * 0.4)); a.fb.ty = -HW - 3; a.fb.sprint = true;
  if (m.ball.owner === id) { m.ball.owner = null; m.ball.held = false; }
  w.bus.emit({ type: "fb_bolted", t: w.state.tick, id, team: a.fb.team });
  return true;
}

/** A player pulls up (a muscle, his dignity): on the floor for a while, and tired after. */
export function pullUp(w: World, id: Id, seconds: number): void {
  const a = w.state.actors[id];
  if (!a?.fb || a.fb.status !== "playing") return;
  a.fb.stunUntil = Math.max(a.fb.stunUntil, w.state.tick + Math.round(seconds * 60));
  a.fb.fatigue = Math.min(1, a.fb.fatigue + 0.3);
  w.bus.emit({ type: "fb_pulled_up", t: w.state.tick, id, team: a.fb.team });
}

/** What has been done to the sides and the officiating, as plain numbers (see MatchMods). null: nothing. */
export function setMods(w: World, mods: MatchMods | null): void {
  const m = w.state.match; if (!m) return;
  if (mods) m.mods = mods; else delete m.mods;
}

/** Goals that went in with nobody refereeing, waiting to be recognised: [England's, theirs]. */
export function unrecognised(w: World): [number, number] {
  const n: [number, number] = [0, 0];
  for (const c of w.state.match?.unrecognised ?? []) n[c.team]++;
  return n;
}

/** Whoever is now in charge rules on those goals: each stands or never happened. Returns those given. */
export function recognise(w: World, official: Id | null, give: (c: Candidate) => boolean, only?: TeamIdx): [number, number] {
  const m = w.state.match;
  return m ? settleUnrecognised(w, m, official, give, only) : [0, 0];
}

/**
 * New men in charge: `referee` takes the whistle and `fourth` the board (either may be an official somebody
 * has just found). Whoever was referee before is no longer anything to do with this match.
 */
export function appointOfficials(w: World, referee: Id, fourth: Id): boolean {
  const s = w.state, m = s.match;
  const up = s.actors[referee], side = s.actors[fourth];
  if (!m || !up?.off || !side?.off || referee === fourth) return false;
  up.off.job = "referee"; up.off.incapacitated = false; up.off.distractedUntil = 0; up.off.bias = [0, 0];
  side.off.job = "fourth";
  m.officials.referee = up.id; m.officials.fourth = side.id;
  w.bus.emit({ type: "fb_ref_replaced", t: s.tick, referee: up.id, fourth: side.id });
  return true;
}

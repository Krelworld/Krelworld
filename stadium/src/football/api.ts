// Ways the outside world can interfere with a match. The sandbox calls these;
// the match never calls the sandbox.
import type { Id } from "../core/types";
import type { World } from "../core/world";
import { kick } from "./ball";
import { queueSub } from "./restarts";
import type { TeamIdx } from "./types";

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

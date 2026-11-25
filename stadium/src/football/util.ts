import type { Actor, Id, WorldState } from "../core/types";
import { HL, PITCH, TUNE } from "./config";
import type { Ball, MatchState, TeamIdx } from "./types";

export const dirOf = (m: MatchState, t: TeamIdx): number => (t === 0 ? m.dir0 : -m.dir0);
export const other = (t: TeamIdx): TeamIdx => (t === 0 ? 1 : 0);

export function playing(s: WorldState, m: MatchState, t: TeamIdx): Actor[] {
  const out: Actor[] = [];
  for (const id of m.teams[t].squad) { const a = s.actors[id]; if (a.fb!.status === "playing") out.push(a); }
  return out;
}
export const keeperOf = (s: WorldState, m: MatchState, t: TeamIdx): Actor | undefined =>
  playing(s, m, t).find((a) => a.fb!.role === "GK");

export const topSpeed = (a: Actor, tick: number): number => {
  const f = a.fb!;
  return (TUNE.speedBase + TUNE.speedPace * f.pace) * (1 - 0.2 * f.fatigue) * (f.wiredUntil > tick ? 1.08 : 1);
};

export const inBox = (x: number, y: number, goalDir: number): boolean =>
  x * goalDir > HL - PITCH.boxL && x * goalDir <= HL + 0.5 && Math.abs(y) < PITCH.boxW / 2;

export const isDown = (a: Actor, tick: number) => a.fb!.stunUntil > tick || a.downUntil > tick;

/**
 * Where a free ball will be over the next few seconds, and the first point this
 * player could get to in time. Returns the time in seconds (Infinity if never).
 */
export function intercept(ball: Ball, a: Actor, speed: number, out: { x: number; y: number }): number {
  let x = ball.x, y = ball.y, z = ball.z, vx = ball.vx, vy = ball.vy, vz = ball.vz;
  const step = 0.1;
  for (let t = 0; t <= 4; t += step) {
    if (z <= TUNE.controlHeight) {
      const d = Math.hypot(x - a.x, y - a.y) - TUNE.controlReach * 0.6;
      if (d <= speed * t + 0.15) { out.x = x; out.y = y; return t; }
    }
    // advance the prediction
    const sp = Math.hypot(vx, vy);
    if (z > 0 || vz > 0) {
      vz -= TUNE.gravity * step; z += vz * step;
      if (z < 0) { z = 0; vz = -vz * TUNE.bounce; if (vz < 1.2) vz = 0; vx *= 0.8; vy *= 0.8; }
    } else if (sp > 0) {
      const ns = Math.max(0, sp - TUNE.rollDecel * step);
      vx *= ns / sp; vy *= ns / sp;
    }
    x += vx * step; y += vy * step;
  }
  out.x = x; out.y = y;
  return Math.hypot(x - a.x, y - a.y) / speed + 4;
}

export function setOwner(m: MatchState, a: Actor | null, tick: number): void {
  const b = m.ball;
  b.owner = a ? a.id : null;
  if (a) {
    b.lastTouch = a.id;
    b.lastTouchTeam = a.fb ? a.fb.team : -1;
    b.vz = 0; b.z = 0;
    if (a.fb) { m.possession = a.fb.team; a.fb.gotBallAt = tick; }
  } else b.held = false;
}

export const nameOf = (s: WorldState, id: Id | null): string => (id && s.actors[id] ? s.actors[id].name : "someone");

// Kick-off happens when it can, not when it's scheduled. At the appointed time the
// referee looks round: if a team is missing, he is unwell, the pitch is not clear or
// the fire alarm is going, it waits. Every wait makes the stewards keener.
import { haltPlay, resumePlay } from "../football/api";
import type { World } from "../core/world";
import { areaAt, SPOTS, VENUE } from "./layout";
import { appearance } from "../core/identity";
import { crime } from "./security";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";

export const DELAY_SECONDS = 45;
export const MAX_DELAYS = 6;
/** Fewer than this many able players and a team cannot take the field. */
const MIN_PLAYERS = 7;

export type DelayReason = "late" | "referee" | "pitch" | "alarm" | "safety";

/** How sharp the stewards are: 0 normal, up to 5 after a terrible afternoon. */
export function securityLevel(w: World): number {
  return Math.min(5, w.state.stadium!.flags.securityLevel ?? 0);
}
export function raiseSecurity(w: World, by = 1): void {
  const f = w.state.stadium!.flags;
  const was = securityLevel(w);
  f.securityLevel = Math.min(5, (f.securityLevel ?? 0) + by);
  if (securityLevel(w) > was) w.bus.emit({ type: "security_level", t: w.state.tick, level: securityLevel(w) });
}

export const alarmRinging = (w: World): boolean => (w.state.stadium!.flags.alarmUntil ?? 0) > w.state.tick;

/** How many of a team could play if the whistle went now, and how many are still out of the ground. */
function teamStatus(w: World, team: 0 | 1): { able: number; missing: number } {
  const s = w.state, m = s.match!;
  const squad = m.teams[team].squad.map((id) => s.actors[id]).filter((a) => a?.fb && a.fb.status === "playing");
  const out = squad.filter((a) => a.hiddenIn || !VENUE.inside(a.x, a.y) || a.downUntil > s.tick);
  return { able: squad.length - out.length, missing: out.length };
}

function pitchClear(w: World): boolean {
  const s = w.state, st = s.stadium!;
  const pc = s.actors[st.pc];
  if (pc && !pc.hiddenIn && areaAt(pc.x, pc.y).id === "pitch") {
    const role = appearance(s, pc).role;
    if (role !== "referee" && role !== "footballer") return false;
  }
  const dog = st.dog ? s.actors[st.dog.id] : undefined;
  if (st.dog?.state === "loose" && dog && areaAt(dog.x, dog.y).pitch) return false;
  if (st.smoke.some((c) => c.until > s.tick && areaAt(c.x, c.y).pitch)) return false;
  return true;
}

/** What, if anything, is holding up the kick-off. */
export function holdUp(w: World): DelayReason | null {
  const s = w.state, st = s.stadium!, m = s.match!, f = st.flags;
  if (alarmRinging(w)) return "alarm";
  if (f.breachAt && !f.breachInspected) return "safety";
  if (teamStatus(w, 0).missing >= 3 || teamStatus(w, 1).missing >= 3) return "late";
  // A team whose coach has crashed get a few minutes to pull themselves together.
  if (f.teamShaken && !f.crashDelayed) return "late";
  const ref = s.actors[m.officials.referee];
  // Twice the referee gets a chance to recover; after that the fourth official steps up.
  const refOk = ref?.off && !ref.off.incapacitated && ref.downUntil <= s.tick;
  if (!refOk && (f.refDelays ?? 0) < 2) return "referee";
  if (!pitchClear(w)) return "pitch";
  return null;
}

/** Call every tick. Moves the kick-off back while something is wrong. */
export function stepKickoff(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match!, f = st.flags, tick = s.tick;

  // The fire alarm stops a match in progress, and it starts again when the bell does.
  if (alarmRinging(w)) {
    if (m.phase === "live" || m.phase === "restart") { if (!m.halted) haltPlay(w, "alarm"); }
  } else if (m.halted === "alarm") resumePlay(w);

  if (m.phase !== "pre" || st.ending) return;
  if (m.phaseUntil - tick > 2) return;
  const delays = f.kickoffDelays ?? 0;
  const why = holdUp(w);
  if (why && delays < MAX_DELAYS) {
    f.kickoffDelays = delays + 1;
    if (why === "referee") f.refDelays = (f.refDelays ?? 0) + 1;
    if (why === "safety") f.breachInspected = 1;
    if (why === "late") { f.awayOnFoot = 1; if (f.teamShaken) f.crashDelayed = 1; } // they give up waiting for the bus and walk
    m.phaseUntil = tick + DELAY_SECONDS * 60;
    raiseSecurity(w);
    w.bus.emit({ type: "kickoff_delayed", t: tick, reason: why, n: delays + 1 });
    return;
  }
  // Out of patience. If a side still can't field a team, the referee abandons it.
  for (const team of [1, 0] as const) {
    if (teamStatus(w, team).able < MIN_PLAYERS) {
      f.forfeit = team === 1 ? 1 : 2;
      m.phase = "finished";
      m.winner = team === 1 ? 0 : 1;
      w.bus.emit({ type: "forfeit", t: tick, team: m.teams[team].short });
      w.bus.emit({ type: "fb_match_end", t: tick, winner: m.winner, score: [...m.score], pens: null });
      return;
    }
  }
  if (delays > 0) w.bus.emit({ type: "kickoff_at_last", t: tick, delays });
}

// ---------- Fire alarm call points ----------
export function alarmPointNear(a: Actor): number {
  const pts = SPOTS.alarmPoints;
  for (let i = 0; i < pts.length; i++) if (Math.hypot(a.x - pts[i].x, a.y - pts[i].y) < 1.6) return i;
  return -1;
}

export function installKickoff(): void {
  registerVerb("alarm", {
    check: (w, act, actor) => {
      const i = alarmPointNear(actor);
      if (i < 0) return "no alarm here";
      if (w.state.stadium!.flags[`alarmUsed${i}`]) return "the glass is already broken";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, i = alarmPointNear(actor);
      st.flags[`alarmUsed${i}`] = 1;
      // A false alarm takes a while to find, less each time: they learn which points to check.
      const n = (st.flags.alarms ?? 0) + 1;
      st.flags.alarms = n;
      st.flags.alarmUntil = s.tick + 60 * Math.max(15, 35 - n * 6);
      const p = SPOTS.alarmPoints[i];
      w.bus.emit({ type: "fire_alarm", t: s.tick, by: actor.id, x: p.x, y: p.y, n });
      // Only staff will care who did it, and only if they saw.
      crime(w, actor, "setting off the fire alarm", 1, undefined, false);
    },
  });
}

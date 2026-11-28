// Football states (Option E). Plans don't script the match and the match doesn't know about plans. Between
// them is this small vocabulary: a plan writes a state ("Portugal are hyperaggressive", "the referee leans
// England's way"), the football reads the states and plays differently, and two states at once do more
// than either alone (the curated combinations below, not everything-times-everything). England can still
// lose with every state in their favour.
//
// Keep the vocabulary small. A new state needs a visible behaviour on the pitch, a badge, and a line of
// commentary, or it isn't one.
import type { World } from "../core/world";

export type TeamIdx = 0 | 1;
/** What a side can be. */
export type TeamStateId =
  | "hyper"       // lunging tackles, relentless press: wins loose balls, gives away fouls and cards
  | "lethargic"   // slow to recover, late runs
  | "confused"    // wrong runs, bad marking, bunching
  | "sick"        // men leaving the pitch at a run
  | "late"        // arrived late: no warm-up, shapeless for the first minutes
  | "kitchaos"    // wrong boots, wrong shirts: a man or two playing in something absurd
  | "motivated";  // sharper, celebrates everything, may get rash
/** What the officiating can be. */
export type RefStateId =
  | "biased"      // leans one way (team = the side he favours)
  | "none"        // no recognised referee on the pitch: THERE ARE NO MORE RULES
  | "grozz";      // Grozz is the referee
export type StateId = TeamStateId | RefStateId;

export interface FState { id: StateId; team?: TeamIdx; from: number; until: number; cause: string }

export const STATE_INFO: Record<StateId, { short: string; long: (side: string) => string }> = {
  hyper: { short: "WIRED", long: (s) => `${s} are flying into everything.` },
  lethargic: { short: "SLEEPY", long: (s) => `${s} can barely lift their feet.` },
  confused: { short: "LOST", long: (s) => `${s} don't know where they're meant to be.` },
  sick: { short: "SICK", long: (s) => `${s} keep leaving at a run.` },
  late: { short: "LATE", long: (s) => `${s} got here late. No warm-up.` },
  kitchaos: { short: "WRONG KIT", long: (s) => `${s} are not wearing what they packed.` },
  motivated: { short: "UP FOR IT", long: (s) => `${s} are up for it.` },
  biased: { short: "BENT REF", long: (s) => `The referee leans ${s}' way.` },
  none: { short: "NO REF", long: () => "There is no referee. There are no more rules." },
  grozz: { short: "YOU'RE REF", long: () => "Grozz is the referee." },
};

const list = (w: World): FState[] => (w.state.stadium!.fstates ??= []);

/** A plan writes a state. secs 0: for the rest of the match. Writing one that's already there extends it. */
export function setState(w: World, id: StateId, team: TeamIdx | undefined, secs: number, cause: string): void {
  const s = w.state, l = list(w), until = secs ? s.tick + Math.round(secs * 60) : Number.MAX_SAFE_INTEGER;
  const old = l.find((x) => x.id === id && x.team === team);
  if (old) { old.until = Math.max(old.until, until); return; }
  l.push({ id, team, from: s.tick, until, cause });
  w.bus.emit({ type: "fstate", t: s.tick, id, team, on: true, cause, short: STATE_INFO[id].short, text: STATE_INFO[id].long(sideName(w, team)) });
}
export function clearState(w: World, id: StateId, team?: TeamIdx): void {
  const l = list(w), i = l.findIndex((x) => x.id === id && x.team === team);
  if (i < 0) return;
  l.splice(i, 1);
  w.bus.emit({ type: "fstate", t: w.state.tick, id, team, on: false });
}
export function hasState(w: World, id: StateId, team?: TeamIdx): boolean {
  const t = w.state.tick;
  return (w.state.stadium!.fstates ?? []).some((x) => x.id === id && (team === undefined || x.team === team) && x.until > t && x.from <= t);
}
export const sideName = (w: World, team: TeamIdx | undefined): string => (team === undefined ? "" : team === 0 ? "England" : w.state.match?.teams[1].name ?? "They");

/** Run from the game step: expire what's run out. */
export function stepStates(w: World): void {
  const l = w.state.stadium!.fstates; if (!l || w.state.tick % 30 !== 0) return;
  for (let i = l.length - 1; i >= 0; i--) if (l[i].until <= w.state.tick) { const x = l[i]; l.splice(i, 1); w.bus.emit({ type: "fstate", t: w.state.tick, id: x.id, team: x.team, on: false }); }
}

export interface Badge { id: StateId; team?: TeamIdx; short: string; text: string }
/** What's in force, for the scoreboard: one small badge each. */
export function badges(w: World): Badge[] {
  const t = w.state.tick;
  return (w.state.stadium!.fstates ?? []).filter((x) => x.until > t && x.from <= t).map((x) => ({ id: x.id, team: x.team, short: STATE_INFO[x.id].short, text: STATE_INFO[x.id].long(sideName(w, x.team)) }));
}

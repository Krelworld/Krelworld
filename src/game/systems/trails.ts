import type { GameState, Line } from "../../data/types";
import { TRAILS, type TrailClue, type TrailDef, type TrailPlace } from "../../content/trails";

/**
 * Explore-before-the-dungeon trails (Chapters 2 and 4): the Cronster's cuddle-token hunt, generalised.
 * The first clue is out in Krelford; once it's found the rest are indoors (any order), one per room.
 * The chapter's `s_trail` step (done: trail_<id>_done) sits before its dungeon, so the door stays locked till then.
 */

export { TRAILS };
export type { TrailClue, TrailDef, TrailPlace };

export const clueFlag = (t: TrailDef, i: number) => `trail_${t.id}_${i}`;
export const trailDoneFlag = (t: TrailDef) => `trail_${t.id}_done`;

/** The hub building each indoor place is reached through (for the objective arrow). */
const DOOR: Record<Exclude<TrailPlace, "FIELD">, string> = { HOME: "HOME", PUB: "PUB", CLUB: "PUB", KREDDLE: "KREDDLE_BRIDGE", POLSON: "POLSON_ROAD" };

export function trailFor(chapter: number): TrailDef | null {
  return TRAILS.find((t) => t.chapter === chapter) ?? null;
}

/** Finished (or never needed: the chapter's already cleared). */
export function trailComplete(s: GameState, t: TrailDef): boolean {
  return !!s.flags[trailDoneFlag(t)] || !!s.flags[`ch${t.chapter}_clear`];
}

/** This chapter's trail, if it's open right now, and what's left to find. */
export function activeTrail(s: GameState) {
  const t = trailFor(s.chapter);
  if (!t || !s.flags[t.startFlag] || trailComplete(s, t)) return null;
  const left = t.clues.map((clue, i) => ({ clue, i })).filter(({ i }) => !s.flags[clueFlag(t, i)]);
  return {
    trail: t,
    got: t.clues.length - left.length,
    total: t.clues.length,
    outdoorLeft: left.filter(({ clue }) => clue.where === "FIELD"),
    indoorLeft: left.filter(({ clue }) => clue.where !== "FIELD"),
  };
}

/** The clue lying at `where` right now (indoor ones only turn up once the outdoor one's found). */
export function clueAt(s: GameState, where: TrailPlace): { trail: TrailDef; clue: TrailClue; i: number } | null {
  const a = activeTrail(s);
  if (!a) return null;
  if (where !== "FIELD" && a.outdoorLeft.length) return null;
  const hit = (where === "FIELD" ? a.outdoorLeft : a.indoorLeft).find(({ clue }) => clue.where === where);
  return hit ? { trail: a.trail, clue: hit.clue, i: hit.i } : null;
}

/** The prop for clue i (the trail's props, in turn). */
export function clueTex(t: TrailDef, i: number) {
  return t.tex[i % t.tex.length];
}

/**
 * Pick up the clue at `where`. Returns everything to say (the clue's lines, then "the rest are indoors" after the
 * outdoor one, or the finale after the last), and the toast; null if there's nothing here.
 */
export function takeClue(s: GameState, where: TrailPlace): { lines: Line[]; title: string; toast: string; done: boolean } | null {
  const c = clueAt(s, where);
  if (!c) return null;
  const t = c.trail;
  s.flags[clueFlag(t, c.i)] = true;
  const got = t.clues.filter((_, i) => s.flags[clueFlag(t, i)]).length;
  const done = got === t.clues.length;
  if (done) s.flags[trailDoneFlag(t)] = true;
  const lines = [...c.clue.lines];
  if (done) lines.push(...t.done);
  else if (where === "FIELD" && !t.clues.some((x, i) => x.where === "FIELD" && !s.flags[clueFlag(t, i)])) lines.push(...t.indoors);
  return { lines, title: t.title, toast: `${t.label} ${got}/${t.clues.length}${done ? " · The way in is open." : ""}`, done };
}

/** "the Krezz Arms (under the bar), your house (...) and Kreddle (...)" */
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join("; ")} and ${xs[xs.length - 1]}`);

/** The objective while the trail's open: what to look for, roughly where, and where the arrow points. */
export function trailObjective(s: GameState): { text: string; target?: string } | null {
  const a = activeTrail(s);
  if (!a) return null;
  const t = a.trail;
  const n = `${t.label} ${a.got}/${a.total}`;
  if (a.outdoorLeft.length) {
    const c = a.outdoorLeft[0].clue;
    return { text: `${t.title} (${n}): find the first ${t.item}. It's ${c.hint}. It glows.`, target: c.near };
  }
  const left = a.indoorLeft.map(({ clue }) => clue);
  return {
    text: `${t.title} (${n}): the rest are indoors, one per place. Walk in and look round: ${listOf(left.map((c) => c.hint))}`,
    target: DOOR[left[0].where as Exclude<TrailPlace, "FIELD">],
  };
}

/**
 * Saves from before the trails existed (flag `trails_v1` missing): any trail that had already started, or whose
 * chapter is behind you, counts as done, so a door that was already open stays open. New games set the flag.
 */
export function settleOldTrails(s: GameState) {
  if (s.flags.trails_v1) return;
  s.flags.trails_v1 = true;
  for (const t of TRAILS) {
    if (s.chapter > t.chapter || (s.chapter === t.chapter && s.flags[t.startFlag])) s.flags[trailDoneFlag(t)] = true;
  }
}

import { GUNS, gunMax } from "../combat/Guns";
import type { GameState, Line } from "../../data/types";
import { ARCS, arcFor, arcsFor, type Arc, type ArcStep } from "../../content/arcs";
import { DUNGEONS } from "../../data/dungeons";

export const stepFlag = (a: Arc, st: ArcStep) => `arcstep_${a.id}_${st.id}`;
export const spotFlag = (a: Arc, st: ArcStep, i: number) => `arcspot_${a.id}_${st.id}_${i}`;

/** Is this step finished? Arena steps finish from the arena flag; collect steps when every item is picked up. */
export function stepDone(s: GameState, a: Arc, st: ArcStep): boolean {
  if (s.flags[stepFlag(a, st)]) return true;
  if (st.step.kind === "arena") {
    const f = DUNGEONS[st.step.dungeon]?.arenaFlag;
    return !!(f && s.flags[f]);
  }
  if (st.step.kind === "collect") return st.step.spots.every((_, i) => s.flags[spotFlag(a, st, i)]);
  return false;
}

export function arcAvailable(s: GameState, a?: Arc): boolean {
  if (!s.flags.met_emergency) return false;
  // a chapter's plot story waits while that chapter's required side quests are still to do (they come first)
  if (a && PLOT_ARCS.has(a.id) && a.id !== "arc_krunchers" && sideQuestsFirst(s)) return false;
  if (a?.requires && !s.flags[a.requires] && !(a.minChapter && s.chapter > a.minChapter)) return false;
  return !a || s.chapter >= (a.minChapter ?? 1);
}

function stepOf(s: GameState, a: Arc): { arc: Arc; step: ArcStep; index: number } | null {
  if (!arcAvailable(s, a) || s.flags[`${a.id}_done`]) return null;
  const index = a.steps.findIndex((st) => !stepDone(s, a, st));
  if (index < 0) return null;
  return { arc: a, step: a.steps[index], index };
}

/** Current step of every open story for this player. */
export function currentArcSteps(s: GameState) {
  return arcsFor(s.player)
    .map((a) => stepOf(s, a))
    .filter((x): x is { arc: Arc; step: ArcStep; index: number } => !!x);
}

/** The player's own story's current step (first open story if they have none). */
export function currentArcStep(s: GameState) {
  return currentArcSteps(s)[0] ?? null;
}

export function arcStepAt(s: GameState, at: string) {
  return currentArcSteps(s).find((c) => c.step.at === at) ?? null;
}

export function completeStep(s: GameState, a: Arc, st: ArcStep) {
  s.flags[stepFlag(a, st)] = true;
}

/** Pay out every story whose steps are all done. Returns the reward text (once per story). */
export function maybeFinishArc(s: GameState): string | null {
  const out: string[] = [];
  for (const a of arcsFor(s.player)) {
    if (s.flags[`${a.id}_done`]) continue;
    if (!a.steps.every((st) => stepDone(s, a, st))) continue;
    s.flags[`${a.id}_done`] = true;
    s.coins += a.reward.coins;
    if (a.reward.gun && GUNS[a.reward.gun]) {
      // a new gun, or a full refill of it if you already have one
      s.guns = s.guns ?? {};
      s.guns[a.reward.gun] = gunMax(GUNS[a.reward.gun], s);
      s.gun = a.reward.gun;
    }
    out.push(`${a.title} complete: +${a.reward.coins} Krezzcoin. ${a.reward.desc}`);
  }
  return out.length ? out.join(" ") : null;
}

export { ARCS, arcFor, arcsFor };

/** The chapter whose dungeon a side quest must be finished before. Krebon's story (which swaps your character) is never required. */
const DUE: Record<string, number> = {
  arc_polson_fit: 3,
  arc_crocodile: 3,
  arc_pudding_spy: 4,
  arc_kreblis_news: 4,
  arc_flenky_sigma: 4,
  arc_klerble: 6,
  arc_50p: 6,
};
export function arcDue(a: Arc): number | null {
  // optional: Krebon's story (it swaps your character) and Boggor's photos
  if (a.id === "arc_krebon" || a.id === "arc_boggor") return null;
  if (DUE[a.id]) return DUE[a.id];
  return a.player === "ALL" ? Math.max(2, a.minChapter ?? 2) : 2;
}

/** Stories that ARE the chapter plot (not side quests): they run inside the chapter, after its briefing. */
export const PLOT_ARCS = new Set(["arc_cronster", "arc_klerble", "arc_krunchers"]);

/** Side quests that must be done this chapter, with where each one is up to (plot stories excluded). */
export function requiredArcSteps(s: GameState) {
  // (plot stories are left out before their availability is looked at: that check depends on this one)
  return arcsFor(s.player)
    .filter((a) => !PLOT_ARCS.has(a.id))
    .map((a) => stepOf(s, a))
    .filter((c): c is { arc: Arc; step: ArcStep; index: number } => {
      if (!c) return false;
      const d = arcDue(c.arc);
      return d !== null && d <= s.chapter;
    });
}

/** The Cronster's cuddle tokens: the step, and how many of the outdoor / indoor ones are still to find. */
export function tokenTrail(s: GameState) {
  const a = ARCS.find((x) => x.id === "arc_cronster");
  const st = a?.steps.find((x) => x.id === "tokens");
  if (!a || !st || st.step.kind !== "collect") return null;
  const spots = st.step.spots;
  const cur = currentArcSteps(s).find((c) => c.arc.id === a.id && c.step.id === "tokens");
  if (!cur) return null;
  const left = (inside: boolean) => spots.map((sp, i) => ({ sp, i })).filter(({ sp, i }) => !!sp.inside === inside && !s.flags[spotFlag(a, st, i)]);
  return { arc: a, step: st, spots, outdoorLeft: left(false), indoorLeft: left(true) };
}

/** Pick up the indoor token at CLUB or POLSON (if it's there to find). Returns what to say, or null. */
export function takeIndoorToken(s: GameState, where: "CLUB" | "POLSON"): { lines: Line[]; toast: string } | null {
  const t = tokenTrail(s);
  if (!t || t.outdoorLeft.length) return null;
  const hit = t.indoorLeft.find(({ sp }) => sp.inside === where);
  if (!hit) return null;
  s.flags[spotFlag(t.arc, t.step, hit.i)] = true;
  const got = t.spots.filter((_, i) => s.flags[spotFlag(t.arc, t.step, i)]).length;
  const k = t.step.step as Extract<ArcStep["step"], { kind: "collect" }>;
  return { lines: k.pickup, toast: `${k.label}: ${hit.sp.name} (${got}/${t.spots.length})${got === t.spots.length ? " · Take them to Sergeant Swig." : ""}` };
}

/**
 * Required side quests happen in the quiet time at the start of a chapter, before its plot gets going:
 * true while any are left AND the chapter's first story beat hasn't happened yet (so a save already
 * mid-plot isn't suddenly frozen; there they still just have to be done before the dungeon).
 */
export function sideQuestsFirst(s: GameState): boolean {
  if (s.chapter < 2 || s.chapter >= 7) return false;
  if (!requiredArcSteps(s).length) return false;
  const first = FIRST_BEAT[s.chapter];
  return !!first && !s.flags[first];
}

/** The flag set by each chapter's first plot beat (its briefing / meeting / broadcast). */
const FIRST_BEAT: Record<number, string> = {
  2: "fragmar_briefed",
  3: "cronster_briefed",
  4: "vig_crobley_news",
  5: "krebon_question",
  6: "arcstep_arc_klerble_brief",
};

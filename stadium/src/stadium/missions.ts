// Missions (Option E). The world and its schemes stay as they are; what changes is that Grozz is never left
// wondering what he's meant to be doing. A mission is a plan with a name, what it buys in the football, and
// three to six plain steps, one at a time, each with a place to go. One is active and pinned on screen; two
// or three others are on offer as cards. Following the steps is easy on purpose. What two finished plans do
// to the same football match is the part nobody's told.
//
// A mission never does anything itself: its steps only watch the world (usually a scheme's state), so any
// way of making a step true counts, in any order, and wandering off costs nothing.
import type { World } from "../core/world";
import { registerVerb } from "../core/verbs";
import { PACE, VENUE } from "./layout";
import { schemeState, type SchemeState } from "./schemes";

export interface Stage {
  /** What to do, as an instruction, under 60 characters: "Shove the loose keg". */
  text: string;
  /** Where that is, if it's a place or a person (the pointer follows it). */
  where?: (w: World, sc: SchemeState | undefined) => { x: number; y: number } | null;
  done: (w: World, sc: SchemeState | undefined) => boolean;
}
export interface MissionDef {
  id: string;
  /** The scheme whose state the steps read, if any. */
  scheme?: string;
  /** The card's name: "The Visitors' Special". */
  title: string;
  /** The intention, one line: "Make Portugal's drinks less refreshing." */
  goal: string;
  /** What it buys in the match, one line: "Portugal start the match sick." */
  buys: string;
  /** Offered outside from the start, or only once he's been in the ground. */
  zone: "out" | "in";
  /** Lower is offered sooner. */
  rank: number;
  on: () => boolean;
  stages: Stage[];
  /** It's over (well or badly) whatever the steps say: the scheme played out, say. */
  over?: (w: World, sc: SchemeState | undefined) => boolean;
  /** It can't be done any more, and why (the card says so and another takes its place). */
  dead?: (w: World, sc: SchemeState | undefined) => string | null;
  /** Other missions this one is worth doing with, and a hint of why: shown once both are known. */
  with?: Record<string, string>;
}
export interface MissionState {
  active?: string;
  /** Mission -> the step he's on (how many are done). */
  stage: Record<string, number>;
  /** Mission -> the tick it was finished at. */
  done: Record<string, number>;
  /** Mission -> the tick its card was first shown. */
  seen: Record<string, number>;
  /** He's chosen for himself at least once (after that the game never picks for him). */
  chose?: number;
}

const DEFS: MissionDef[] = [];
export function defineMission(d: MissionDef): void { const i = DEFS.findIndex((x) => x.id === d.id); if (i >= 0) DEFS[i] = d; else DEFS.push(d); }
const ms = (w: World): MissionState | undefined => w.state.stadium!.missions;
const scOf = (w: World, d: MissionDef) => (d.scheme ? schemeState(w, d.scheme) : undefined);
const beenIn = (w: World) => { const st = w.state.stadium!, pc = w.state.actors[st.pc]; return !!st.admitted || !!st.flags.beenIn || (!!pc && VENUE.inside(pc.x, pc.y)); };

/** How many cards are on the table at once, outside and in. */
const HAND = 3;

/** The missions on offer now: the three soonest outside ones not yet done with, and three more once inside. */
export function offered(w: World): MissionDef[] {
  const m = ms(w); if (!m) return [];
  const open = (d: MissionDef) => d.on() && !m.done[d.id];
  const pick = (zone: "out" | "in") => DEFS.filter((d) => d.zone === zone && open(d)).sort((a, b) => a.rank - b.rank).slice(0, HAND);
  // The one he's on always stays on the table.
  const out = [...pick("out"), ...(beenIn(w) ? pick("in") : [])];
  const act = m.active ? DEFS.find((d) => d.id === m.active) : undefined;
  if (act && open(act) && !out.includes(act)) out.unshift(act);
  return out;
}

export function installMissions(): void {
  registerVerb("mission", {
    check: (w, act) => { const m = ms(w); return m && offered(w).some((d) => d.id === act.arg) ? null : "not on offer"; },
    perform: (w, act) => { const m = ms(w)!; m.active = act.arg; m.chose = w.state.tick; w.bus.emit({ type: "mission_pick", t: w.state.tick, mission: act.arg, title: DEFS.find((d) => d.id === act.arg)?.title }); announce(w, true); },
  });
  // "Head in": stop the kick-off waiting (the soft clock, game.ts).
  registerVerb("headin", {
    check: (w) => (PACE.soft && !w.state.stadium!.flags.koGo ? null : "it's already on its way"),
    perform: (w) => { w.state.stadium!.flags.koGo = w.state.tick; w.bus.emit({ type: "ko_go", t: w.state.tick, why: "chose" }); },
  });
}

export function initMissions(w: World): void {
  w.state.stadium!.missions = { stage: {}, done: {}, seen: {} };
}

/** Say the step he's on (once per change). */
function announce(w: World, picked = false): void {
  const m = ms(w)!, d = DEFS.find((x) => x.id === m.active); if (!d) return;
  const n = m.stage[d.id] ?? 0, s = d.stages[n];
  if (s) w.bus.emit({ type: "mission_stage", t: w.state.tick, mission: d.id, title: d.title, n, of: d.stages.length, text: s.text, picked });
}

export function stepMissions(w: World): void {
  const s = w.state, st = s.stadium!, m = st.missions;
  if (!m || s.tick % 15 !== 0) return;
  const pc = s.actors[st.pc];
  if (pc && VENUE.inside(pc.x, pc.y) && !pc.heldBy) st.flags.beenIn = st.flags.beenIn || s.tick;
  const hand = offered(w);
  for (const d of hand) {
    if (!m.seen[d.id]) { m.seen[d.id] = s.tick; w.bus.emit({ type: "mission_card", t: s.tick, mission: d.id, title: d.title, goal: d.goal }); }
    const sc = scOf(w, d);
    // Steps are taken in order, but a later one already true carries the earlier ones with it (he found
    // another way round): the step he's on is the one after the last that's true.
    let n = 0;
    for (let i = 0; i < d.stages.length; i++) if (d.stages[i].done(w, sc)) n = i + 1; else if (i >= n + 1) break;
    const was = m.stage[d.id] ?? 0;
    if (n > was) {
      m.stage[d.id] = n;
      if (m.active === d.id && n < d.stages.length) announce(w);
    }
    const dead = d.dead?.(w, sc) ?? null;
    if (n >= d.stages.length || d.over?.(w, sc) || dead) {
      m.done[d.id] = s.tick;
      w.bus.emit({ type: "mission_done", t: s.tick, mission: d.id, title: d.title, buys: d.buys, ok: n >= d.stages.length && !dead, why: dead ?? "" });
      if (m.active === d.id) m.active = undefined;
    }
  }
  // Nothing pinned at the very start: the game picks the first (a first-time player is never without a
  // plan). Once one's been pulled off, the next is his to choose: the cards come up and the bar asks.
  if (!m.active && !m.chose && !Object.keys(m.done).length) {
    const next = offered(w)[0];
    if (next) { m.active = next.id; announce(w, true); }
  }
}

export interface Pinned { id: string; title: string; text: string; n: number; of: number; where: { x: number; y: number } | null }
/** The pinned line: the active mission's current step and where it is. */
export function pinned(w: World): Pinned | null {
  const m = ms(w); if (!m?.active) return null;
  const d = DEFS.find((x) => x.id === m.active); if (!d) return null;
  const n = m.stage[d.id] ?? 0, s = d.stages[n]; if (!s) return null;
  return { id: d.id, title: d.title, text: s.text, n, of: d.stages.length, where: s.where?.(w, scOf(w, d)) ?? null };
}

export interface Card { id: string; title: string; goal: string; buys: string; active: boolean; n: number; steps: { text: string; done: boolean; now: boolean }[]; with: string[] }
/** The cards on the table, for the Plans sheet. Steps not yet reached are shown (the plan is not a secret). */
export function cards(w: World): Card[] {
  const m = ms(w); if (!m) return [];
  const hand = offered(w), known = new Set([...hand.map((d) => d.id), ...Object.keys(m.done)]);
  return hand.map((d) => {
    const n = m.stage[d.id] ?? 0;
    return { id: d.id, title: d.title, goal: d.goal, buys: d.buys, active: m.active === d.id, n, steps: d.stages.map((s, i) => ({ text: s.text, done: i < n, now: i === n })), with: Object.entries(d.with ?? {}).filter(([o]) => known.has(o) && o !== d.id).map(([, t]) => t) };
  });
}
/** What's been pulled off today, for the menu and the full-time page. */
export function achieved(w: World): { title: string; buys: string }[] {
  const m = ms(w); if (!m) return [];
  return Object.keys(m.done).sort((a, b) => m.done[a] - m.done[b]).map((id) => DEFS.find((d) => d.id === id)).filter((d): d is MissionDef => !!d && (m.stage[d.id] ?? 0) >= d.stages.length).map((d) => ({ title: d.title, buys: d.buys }));
}

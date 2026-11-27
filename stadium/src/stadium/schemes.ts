// Authored schemes (Option D). The world stays a place with a handful of cheap shared rules (custody,
// obligation, attraction, attention: frozen as they are); the big, match-changing sequences are no longer
// hoped for out of those rules colliding. Each is written down as a scheme: a few things to notice (clues),
// a few conditions that can be arranged in any order and often in more than one way, a moment at which
// they're counted, and a choreographed payoff picked by which of them were true. A scheme reads the shared
// rules' state for its conditions; it never asks the rules to work the consequences out.
//
// This file is the small engine every scheme shares: what's been learnt, which conditions hold, the
// actions a scheme adds, the beat sequencer, and what the notebook and Instinct show (only what Grozz has
// found out; an unknown link is a question mark, never an arrow to the next thing).
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import { linkCause, rootCause } from "./cause";

export interface SchemeState {
  clues: Record<string, number>;
  /** Condition id -> how it came to be true ("" or missing: it isn't). */
  met: Record<string, string>;
  vars: Record<string, number>;
  variant?: string; beat?: number; beatAt?: number; done?: boolean;
  cause?: number;
}
export interface Clue { id: string; note: string; mutter?: string }
export interface Cond { id: string; /** In the notebook once the clue's known. */ clue: string; known: string; unknown: string; test: (w: World, sc: SchemeState) => string }
export interface SchemeAction {
  id: string; label: string; hint: string; priority: number;
  /** Null: it's on offer. Anything else: not here, not now. */
  can: (w: World, pc: Actor, sc: SchemeState) => string | null;
  run: (w: World, pc: Actor, sc: SchemeState) => void;
}
export interface Beat {
  /** Seconds it holds. */
  secs: number;
  /** The camera cuts there (a distant beat); otherwise it happens in the world and nothing is taken away. */
  cut?: boolean; caption?: string;
  at: (w: World, sc: SchemeState) => { x: number; y: number };
  go?: (w: World, sc: SchemeState) => void;
  /** Joins the chain Grozz gets the credit for. */
  link?: string;
}
export interface Variant { id: string; when: (sc: SchemeState) => boolean; beats: Beat[] }
export interface Thing { x: number; y: number; z?: number; board?: string; mark?: string; bow?: boolean; cup?: boolean }
export interface SchemeDef {
  id: string; title: string;
  on: () => boolean;
  clues: Clue[]; conds: Cond[]; actions: SchemeAction[]; variants: Variant[];
  init: (w: World, sc: SchemeState) => void;
  /** Its people's routines, its clock, and the moment it's counted. Twice a second. */
  step: (w: World, sc: SchemeState) => void;
  /** What's worth a board or an Instinct label, from what's been learnt. */
  things: (w: World, sc: SchemeState) => Thing[];
}

const DEFS: SchemeDef[] = [];
export function defineScheme(d: SchemeDef): void { if (!DEFS.some((x) => x.id === d.id)) DEFS.push(d); }
const live = (w: World) => DEFS.filter((d) => d.on() && w.state.stadium!.schemes?.[d.id]);
export const schemeState = (w: World, id: string): SchemeState | undefined => w.state.stadium!.schemes?.[id];

/** Grozz has found something out. Once. */
export function learn(w: World, def: SchemeDef, sc: SchemeState, id: string, quiet = false): void {
  if (sc.clues[id]) return;
  const c = def.clues.find((x) => x.id === id);
  if (!c) return;
  sc.clues[id] = w.state.tick;
  w.bus.emit({ type: "scheme_clue", t: w.state.tick, scheme: def.id, clue: id, note: c.note, mutter: quiet ? undefined : c.mutter });
}

/** Start a payoff: the variant's beats run from now, whatever else is going on. */
export function play(w: World, def: SchemeDef, sc: SchemeState, at?: { x: number; y: number }): void {
  const v = def.variants.find((x) => x.when(sc));
  if (!v || sc.variant) return;
  sc.variant = v.id; sc.beat = -1; sc.beatAt = w.state.tick;
  // Only what Grozz had a hand in is his chain.
  if (Object.values(sc.met).some((h) => h)) sc.cause = sc.cause || rootCause(w, def.title.toUpperCase(), at, "authored");
  let t = 0;
  w.bus.emit({ type: "scheme_play", t: w.state.tick, scheme: def.id, variant: v.id, beats: v.beats.map((b) => { const p = b.at(w, sc), o = { at: t, ms: Math.round(b.secs * 1000), cut: !!b.cut, caption: b.caption ?? "", x: p.x, y: p.y }; t += b.secs; return o; }) });
}

export function installSchemes(): void {
  registerVerb("scheme", {
    check: (w, act, actor) => {
      const [sid, aid] = (act.arg ?? "").split(":"), def = DEFS.find((d) => d.id === sid), sc = schemeState(w, sid), a = def?.actions.find((x) => x.id === aid);
      if (!def || !sc || !a || !def.on()) return "nothing to do";
      return a.can(w, actor, sc);
    },
    perform: (w, act, actor) => {
      const [sid, aid] = (act.arg ?? "").split(":"), def = DEFS.find((d) => d.id === sid)!, sc = schemeState(w, sid)!;
      def.actions.find((x) => x.id === aid)!.run(w, actor, sc);
    },
  });
}

export function initSchemes(w: World): void {
  const st = w.state.stadium!;
  st.schemes = {};
  for (const d of DEFS) {
    if (!d.on()) continue;
    const sc: SchemeState = { clues: {}, met: {}, vars: {} };
    st.schemes[d.id] = sc;
    d.init(w, sc);
  }
}

export function stepSchemes(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!st.schemes) return;
  for (const d of live(w)) {
    const sc = st.schemes[d.id];
    // A payoff under way: one beat at a time, on the sim's clock (the camera is the view's business).
    if (sc.variant && !sc.done) {
      const v = d.variants.find((x) => x.id === sc.variant)!;
      while (!sc.done && tick >= (sc.beatAt ?? 0)) {
        sc.beat = (sc.beat ?? -1) + 1;
        const b = v.beats[sc.beat];
        if (!b) { sc.done = true; w.bus.emit({ type: "scheme_done", t: tick, scheme: d.id, variant: v.id }); break; }
        b.go?.(w, sc);
        if (b.link && sc.cause) linkCause(w, sc.cause, b.link, b.at(w, sc), "authored");
        sc.beatAt = (sc.beatAt ?? tick) + Math.round(b.secs * 60);
      }
    }
    if (tick % 30 !== 0) continue;
    d.step(w, sc);
    if (sc.variant) continue;
    for (const c of d.conds) {
      const how = c.test(w, sc), was = sc.met[c.id] ?? "";
      if (how === was) continue;
      sc.met[c.id] = how;
      w.bus.emit({ type: "scheme_cond", t: tick, scheme: d.id, cond: c.id, on: !!how, how, text: c.known });
    }
  }
}

/** What a scheme adds to what Grozz can do just here. */
export function schemeOptions(w: World, pc: Actor): { label: string; priority: number; arg: string }[] {
  const out: { label: string; priority: number; arg: string }[] = [];
  for (const d of live(w)) { const sc = schemeState(w, d.id)!; for (const a of d.actions) if (a.can(w, pc, sc) === null) out.push({ label: a.label, priority: a.priority, arg: `${d.id}:${a.id}` }); }
  return out;
}
export function schemeHint(arg: string | undefined): string {
  const [sid, aid] = (arg ?? "").split(":");
  return DEFS.find((d) => d.id === sid)?.actions.find((a) => a.id === aid)?.hint ?? "";
}

/** The notebook: per scheme Grozz has got wind of, what he knows, and how much he doesn't. */
export function notebook(w: World): { title: string; lines: { ok: boolean; text: string }[]; done: boolean }[] {
  return live(w).map((d) => {
    const sc = schemeState(w, d.id)!;
    const lines = d.clues.filter((c) => sc.clues[c.id]).sort((a, b) => sc.clues[a.id] - sc.clues[b.id]).map((c) => ({ ok: true, text: c.note }));
    for (const c of d.conds) {
      if (sc.clues[c.clue]) { if (sc.met[c.id]) lines.push({ ok: true, text: c.known }); }
      else lines.push({ ok: false, text: c.unknown });
    }
    return { title: d.title, lines, done: !!sc.done };
  }).filter((n) => n.lines.some((l) => l.ok));
}

export function schemeThings(w: World): Thing[] {
  return live(w).flatMap((d) => d.things(w, schemeState(w, d.id)!));
}

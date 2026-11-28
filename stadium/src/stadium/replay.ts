// Record and replay a match day. The simulation is deterministic for a seed, so a day is fully described by
// how it began (seed, venue, campaign, pace) and what the player did: the stick, tick by tick (only when it
// changes), and every action the view asked for, with the way Grozz was facing at the time. In the browser
// every day is recorded (it's small); `window.__recording()` hands it over, and `replay()` plays it back
// headless to the same state, which is what the QA harness, bug reports and critics work from.
import type { Action } from "../core/types";
import { dispatch, dispatchHooks } from "../core/verbs";
import type { Campaign } from "./campaign";
import { PACE, setPace } from "./layout";

export interface Recording {
  v: 1; seed: string; venue: string; campaign: Campaign; calm: boolean; soft?: boolean; kickoffAt: number;
  /** [tick, moveX, moveY], whenever the stick changed. */
  moves: [number, number, number][];
  /** [tick, facing, action]: everything the player asked for from outside the simulation step. */
  acts: [number, number, Action][];
  /** Ticks at which the run stopped being replayable (a checkpoint was loaded, a debug jump). */
  broken?: number;
}

interface Rec { r: Recording; lx: number; ly: number }
let current: { w: any; rec: Rec } | null = null;
let lastRec: Recording | null = null;
/** The recording of the day most recently started (also in node, for tests and tools). */
export const latestRecording = (): Recording | null => lastRec;
/** True while the simulation itself is stepping (actions taken inside the step are the simulation's own). */
export const stepping = { on: false };

// Exact values: the simulation is sensitive to the last bit, and JSON keeps doubles exactly.
const q = (n: number) => n;

export function startRecording(g: { w: any; venue: string; campaign: Campaign }, seed: string): void {
  const rec: Rec = { r: { v: 1, seed, venue: g.venue, campaign: structuredClone(g.campaign), calm: PACE.calm, soft: PACE.soft, kickoffAt: PACE.base, moves: [], acts: [] }, lx: 0, ly: 0 };
  current = { w: g.w, rec };
  lastRec = rec.r;
  if (typeof window !== "undefined") (window as any).__fingerprint = () => fingerprint(g.w);
  if (typeof window !== "undefined") (window as any).__recording = () => { const cur = current; return cur && cur.w === g.w ? cur.rec.r : null; };
}

/** Called at the top of every step: what the stick says now. */
export function recordTick(w: any): void {
  const cur = current;
  if (!cur || cur.w !== w) return;
  const pc = w.state.actors[w.state.stadium.pc], c = cur.rec;
  if (!pc) return;
  const mx = q(pc.moveX ?? 0), my = q(pc.moveY ?? 0);
  if (mx !== c.lx || my !== c.ly) { c.r.moves.push([w.state.tick, mx, my]); c.lx = mx; c.ly = my; }
}

dispatchHooks.push((w, a) => {
  const cur = current;
  if (!cur || cur.w !== w || stepping.on) return;
  const pc = w.state.actors[a.actor];
  if (!pc || a.actor !== w.state.stadium?.pc) return;
  cur.rec.r.acts.push([w.state.tick, q(pc.facing), structuredClone(a)]);
});

/** Mark the recording as no longer a faithful account (the state was changed by something it can't see). */
export function breakRecording(w: any): void { const cur = current; if (cur && cur.w === w && cur.rec.r.broken === undefined) cur.rec.r.broken = w.state.tick; }

/** A fingerprint of the state that matters: if two runs agree on this, they played out the same. */
export function fingerprint(w: any): string {
  const s = w.state, st = s.stadium, m = s.match;
  const ids = Object.keys(s.actors).sort();
  let h = 2166136261;
  const mix = (v: number | string) => { const str = String(v); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  mix(s.tick); mix(m ? `${m.score[0]}-${m.score[1]}` : "");
  for (const id of ids) { const a = s.actors[id]; mix(id); mix(Math.round(a.x * 10)); mix(Math.round(a.y * 10)); mix(a.dead ? 1 : 0); mix(a.money ?? 0); }
  for (const id of Object.keys(s.items).sort()) { const it = s.items[id]; mix(id); mix(it.loc.k); mix((it.loc as any).a ?? (it.loc as any).c ?? Math.round(((it.loc as any).x ?? 0) * 10)); }
  mix(st?.chainBest?.links?.length ?? 0);
  return h.toString(16);
}

/** Play a recording back headless, to its last input or to `until`. The caller supplies createGame/stepGame
 *  (to keep this file free of the game module's imports). */
export function replay<G extends { w: any }>(r: Recording, make: (seed: string, venue: any, c: Campaign) => G, step: (g: G) => void, until?: number, each?: (g: G) => void): G {
  setPace({ kickoffAt: r.kickoffAt, calm: r.calm, soft: r.soft });
  const g = make(r.seed, r.venue, structuredClone(r.campaign)), s = g.w.state;
  const end = until ?? Math.max(r.moves.at(-1)?.[0] ?? 0, r.acts.at(-1)?.[0] ?? 0) + 1;
  let mi = 0, ai = 0;
  while (s.tick < end && !s.stadium.ending) {
    const pc = s.actors[s.stadium.pc];
    while (ai < r.acts.length && r.acts[ai][0] <= s.tick) { const [, f, a] = r.acts[ai++]; if (pc) pc.facing = f; dispatch(g.w, structuredClone(a)); }
    while (mi < r.moves.length && r.moves[mi][0] <= s.tick) { const [, x, y] = r.moves[mi++]; if (pc) { pc.moveX = x; pc.moveY = y; } }
    step(g);
    each?.(g);
  }
  return g;
}

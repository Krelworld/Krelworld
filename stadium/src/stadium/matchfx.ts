// The one doorway from authored schemes into the football. Schemes never script goals or results: they
// change a few visible things about who is fit to play and whether play is going, and the match simulation
// carries on from there by itself (England can still lose). Keep this small; add a line only when a scheme
// that exists needs it.
import type { World } from "../core/world";
import type { Id } from "../core/types";
import { haltPlay, removePlayer, resumePlay, wirePlayer } from "../football/api";

export const matchfx = {
  /** playerAvailable: he's out, and his team may bring somebody on. */
  withdraw: (w: World, id: Id, reason: string): boolean => removePlayer(w, id, reason),
  /** playerCondition: it catches up with him so many seconds from now (he leaves the pitch at a run). */
  dose: (w: World, id: Id, inSecs: number, effect = "laxative"): void => { w.state.stadium!.dosed[id] = { effect, at: w.state.tick + Math.round(60 * inSecs) }; },
  /** playerCondition: full of himself for a while. */
  lift: (w: World, id: Id, secs: number): void => { const a = w.state.actors[id]; if (a?.fb) { a.fb.fatigue = 0; wirePlayer(w, id, secs); } },
  /** matchInterrupted. */
  halt: (w: World, reason: string): void => haltPlay(w, reason),
  resume: (w: World): void => resumePlay(w),
};

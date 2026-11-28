// The one doorway from authored schemes into the football. Schemes never script goals or results: they
// change a few visible things about who is fit to play and whether play is going, and the match simulation
// carries on from there by itself (England can still lose). Keep this small; add a line only when a scheme
// that exists needs it.
import type { World } from "../core/world";
import type { Id } from "../core/types";
import { boltPlayer, distractReferee, haltPlay, pullUp, removePlayer, resumePlay, wirePlayer } from "../football/api";
import { beginRestart } from "../football/restarts";
import type { TeamIdx } from "../football/types";
import { dirOf, inBox, other } from "../football/util";

export const matchfx = {
  /** playerAvailable: he's out, and his team may bring somebody on. */
  withdraw: (w: World, id: Id, reason: string): boolean => removePlayer(w, id, reason),
  /** playerCondition: it catches up with him so many seconds from now (he leaves the pitch at a run). */
  dose: (w: World, id: Id, inSecs: number, effect = "laxative"): void => { w.state.stadium!.dosed[id] = { effect, at: w.state.tick + Math.round(60 * inSecs) }; },
  /** playerCondition: it's caught up with him now. He sets off for the tunnel at a run, where everyone can see
   *  him go, and a few seconds later he's out of the match the way a dose always ended (rules.ts). */
  runOff: (w: World, id: Id, secs = 5): boolean => {
    if (!boltPlayer(w, id)) return false;
    w.state.stadium!.dosed[id] = { effect: "laxative", at: w.state.tick + Math.round(60 * secs) };
    return true;
  },
  /** playerCondition: he's pulled something. On the floor for so many seconds, and heavy-legged after. */
  pull: (w: World, id: Id, secs: number): void => pullUp(w, id, secs),
  /** playerCondition: full of himself for a while. */
  lift: (w: World, id: Id, secs: number): void => { const a = w.state.actors[id]; if (a?.fb) { a.fb.fatigue = 0; wirePlayer(w, id, secs); } },
  /** matchInterrupted. */
  halt: (w: World, reason: string): void => haltPlay(w, reason),
  resume: (w: World): void => resumePlay(w),
  /** refereeAttention: he's got something else on his mind for so many seconds, and misses most of what happens. */
  refBusy: (w: World, secs: number): void => distractReferee(w, secs),
  /** refereeAvailable: he's off the pitch (led off, taken away). Back on in so many seconds, the way he comes
   *  back from anything else (rules.ts brings him on and says so); with no seconds, not at all. */
  standDown: (w: World, secs = 0): void => {
    const s = w.state, r = s.actors[s.match!.officials.referee];
    if (!r?.off) return;
    r.off.incapacitated = true;
    s.stadium!.flags.refBackAt = secs ? s.tick + Math.round(60 * secs) : 0;
    w.bus.emit({ type: "ref_stood_down", t: s.tick, seconds: secs });
  },
  /** playerHeld: somebody's got him by the arm. The match stops steering him (he stands, or walks where he's
   *  led) until he's let go. */
  hold: (w: World, id: Id, on: boolean): void => { const a = w.state.actors[id]; if (a?.fb) a.fb.controlled = on || undefined; },
  /** matchSanction: a free kick against a side where the offence was, a penalty if that's in their own box.
   *  Somebody still has to put it away. */
  penalise: (w: World, team: TeamIdx, x: number, y: number): "penalty" | "free_kick" | null => {
    const m = w.state.match;
    if (!m || (m.phase !== "live" && m.phase !== "restart")) return null;
    const kind = inBox(x, y, -dirOf(m, team)) ? "penalty" : "free_kick";
    beginRestart(w, m, kind, other(team), x, y, kind === "penalty" ? 5 : 3);
    return kind;
  },
};

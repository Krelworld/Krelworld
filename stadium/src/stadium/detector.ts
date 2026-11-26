// The final: after a tournament of fat bald men in disguise, the authorities install a penis
// detector at the turnstiles. Show your ticket and the steward asks you to pop it in the slot.
// Your own is on file: you're caught. The censored bar from the pub toilet, or the dog held up
// to the slot, gets you through.
import { moveItem } from "../core/items";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { SPOTS, TURNSTILES, VENUE } from "./layout";
import { say } from "./npc";
import { finishArrest } from "./security";

/** The turnstile you're being checked at (index + 1), if any. */
export const detectorGate = (w: World): number => w.state.stadium!.flags.detectorGate ?? 0;
const turnstileSpot = (i: number) => SPOTS.turnstiles[i - 1];
const carrying = (w: World, a: Actor, def: string) => [a.hand, ...a.pockets].some((id) => id && w.state.items[id]?.def === def);
export const hasBar = (w: World, a: Actor) => carrying(w, a, "censored_bar");
export const dogWithYou = (w: World, a: Actor): boolean => {
  const d = w.state.stadium!.dog, dog = d ? w.state.actors[d.id] : undefined;
  return !!d && !!dog && d.state === "led" && Math.hypot(dog.x - a.x, dog.y - a.y) < 4;
};
const stewardAt = (w: World, i: number) => {
  const p = turnstileSpot(i);
  return Object.values(w.state.actors).filter((a) => a.npc?.job === "turnstile" && !a.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
};

/** Called by the turnstile once the ticket and everything else checks out. Returns true if the
 *  detector now has to be passed before the gate opens. */
export function startDetector(w: World, by: Actor, gate: string, steward: Actor): boolean {
  if (!VENUE.features.penisDetector || by.id !== w.state.stadium!.pc) return false;
  w.state.stadium!.flags.detectorGate = TURNSTILES.indexOf(gate) + 1;
  say(w, steward, "Right. Penis detector, sir. Pop it in the slot, please.", 5);
  w.bus.emit({ type: "detector_wait", t: w.state.tick, by: by.id });
  return true;
}

export function installDetector(): void {
  registerVerb("detector", {
    check: (w, act, actor) => {
      const i = detectorGate(w);
      if (!i || Math.hypot(actor.x - turnstileSpot(i).x, actor.y - turnstileSpot(i).y) > 3.5) return "no detector here";
      if (act.arg === "bar" && !hasBar(w, actor)) return "you've nothing to put in it";
      if (act.arg === "dog" && !dogWithYou(w, actor)) return "no dog";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, i = detectorGate(w), stw = stewardAt(w, i), gate = TURNSTILES[i - 1];
      st.flags.detectorGate = 0;
      if (act.arg === "own") {
        // It's on file.
        w.bus.emit({ type: "detector", t: s.tick, by: actor.id, result: "caught" });
        if (stw) say(w, stw, "That's him! That's the fat bald fella! It's a match!", 5);
        st.flags.detectorCaught = 1;
        finishArrest(w, actor, "The penis detector matched you in under a second. Apparently there's a file. Apparently it's thick. The steward who read out the result has asked for counselling.");
        return;
      }
      // The bar, or the dog: through you go.
      st.gates[gate] = { until: s.tick + 60 * 4, for: actor.id };
      if (act.arg === "dog") {
        w.bus.emit({ type: "detector", t: s.tick, by: actor.id, result: "dog" });
        if (stw) say(w, stw, "Bit small. Bit hairy. Go on, then.", 4);
        // They let the dog through as well, apparently.
        st.flags.serviceDog = 1;
      } else {
        w.bus.emit({ type: "detector", t: s.tick, by: actor.id, result: "bar" });
        if (stw) say(w, stw, "Jesus Christ. Go on through, sir. Go on.", 4);
        const bar = [actor.hand, ...actor.pockets].find((id) => id && s.items[id]?.def === "censored_bar");
        void bar; void moveItem; // it comes back out again
      }
    },
  });
}

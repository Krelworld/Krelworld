// The pub toilet cubicle has a hole in the partition. Knock, and a voice from the next stall
// asks if you want some fun. Say yes and something comes through, under a black censor bar.
// With a knife on you, you can take it. The bar goes in your pocket; what it's for is up to you.
import { canPocket, hasProp, moveItem, spawnItem } from "../core/items";
import type { Actor, Item } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { areaAt } from "./layout";

/** Where the hole has got to: 0 quiet, 1 offered, 2 it's through, 3 cut off (done for the day), 4 declined. */
export const holeState = (w: World): number => w.state.stadium!.flags.gloryHole ?? 0;
export const inCubicle = (a: Actor): boolean => areaAt(a.x, a.y).id === "pub_cubicle";

/** A sharp weapon anywhere on you: in your hand or a pocket. */
export function knifeOn(w: World, a: Actor): Item | undefined {
  for (const id of [a.hand, ...a.pockets]) {
    const it = id ? w.state.items[id] : undefined;
    if (it && hasProp(it, "sharp") && hasProp(it, "weapon")) return it;
  }
  return undefined;
}

export function installGloryHole(): void {
  registerVerb("hole", {
    check: (w, act, actor) => {
      if (!inCubicle(actor)) return "no hole here";
      const st = holeState(w);
      switch (act.arg) {
        case "knock": return st === 0 || st === 4 || st === 3 ? null : "already talking";
        case "yes": case "no": return st === 1 ? null : "nobody asked";
        case "chop": return st !== 2 ? "nothing to cut" : knifeOn(w, actor) ? null : "you'd need a knife";
        case "leave": return null;
        default: return "eh?";
      }
    },
    perform: (w, act, actor) => {
      const s = w.state, f = s.stadium!.flags, tick = s.tick;
      const emit = (what: string) => w.bus.emit({ type: "glory_hole", t: tick, what, by: actor.id });
      switch (act.arg) {
        case "knock":
          if (f.gloryHole === 3) { emit("after"); return; }
          f.gloryHole = 1; emit("offer"); return;
        case "no": f.gloryHole = 4; emit("no"); return;
        case "yes": f.gloryHole = 2; emit("yes"); return;
        case "chop": {
          f.gloryHole = 3;
          const bar = spawnItem(s, "censored_bar", { k: "ground", x: actor.x, y: actor.y });
          if (canPocket(actor, bar)) moveItem(s, bar.id, { k: "pocket", a: actor.id });
          else if (!actor.hand) moveItem(s, bar.id, { k: "hand", a: actor.id });
          actor.effects.bloody = Math.max(actor.effects.bloody ?? 0, tick + 60 * 120);
          emit("chop");
          return;
        }
        case "leave":
          if (f.gloryHole === 2) emit("rude");
          if (f.gloryHole === 1 || f.gloryHole === 2) f.gloryHole = 4;
          return;
      }
    },
  });
}

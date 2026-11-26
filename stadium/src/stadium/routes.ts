// The naughty ways in. A drain from the pub cellar to the grate in the England dressing room
// showers (you'll want a wrench for the cellar hatch); the scaffold on the corner, up and across
// the roof and down a ladder into the tunnel; the players' entrance off the alley, which opens to
// the kit man's swipe card; and the stretcher: get yourself knocked out inside the ground and the
// first-aiders carry you to the medical room, right by the dressing rooms.
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { SPOTS, VENUE } from "./layout";
import { crime } from "./security";

const near = (a: Actor, p: { x: number; y: number } | undefined, r: number) => !!p && Math.hypot(a.x - p.x, a.y - p.y) < r;
const carrying = (w: World, a: Actor, def: string) => [a.hand, ...a.pockets].some((id) => id && w.state.items[id]?.def === def);

export const atCellar = (a: Actor) => near(a, (SPOTS as any).cellar, 1.6);
export const atGrate = (a: Actor) => near(a, (SPOTS as any).grate, 1.6);
export const atScaffold = (a: Actor) => near(a, (SPOTS as any).scaffold, 2.2);
export const hasCard = (w: World, a: Actor) => carrying(w, a, "kit_card");

export function installRoutes(): void {
  registerVerb("drain", {
    check: (w, _act, actor) => {
      if (atGrate(actor)) return null;
      if (!atCellar(actor)) return "no way down here";
      return carrying(w, actor, "wrench") || w.state.stadium!.flags.hatchOpen ? null : "the hatch is bolted: you'd need a wrench";
    },
    perform: (w, _act, actor) => {
      const s = w.state, down = atCellar(actor), to = down ? (SPOTS as any).grate : (SPOTS as any).cellar;
      if (down) s.stadium!.flags.hatchOpen = 1;
      actor.x = to.x + 0.6; actor.y = to.y + 0.4;
      actor.downUntil = s.tick + 30;
      w.bus.emit({ type: "crawled", t: s.tick, by: actor.id, to: down ? "grate" : "cellar" });
    },
  });
  // Down the drain there's a long-dead fan in an '86 shirt. His wallet's still in his pocket.
  registerVerb("drainwallet", {
    check: (w) => (w.state.stadium!.flags.drainWallet ? "already had it" : null),
    perform: (w, _act, actor) => { w.state.stadium!.flags.drainWallet = 1; actor.money += 20; w.bus.emit({ type: "stole", t: w.state.tick, by: actor.id, from: "", what: "cash", amount: 20 }); },
  });
  registerVerb("scaffold", {
    check: (_w, _act, actor) => (atScaffold(actor) ? null : "nothing to climb"),
    perform: (w, _act, actor) => {
      const s = w.state, to = (SPOTS as any).roofDrop;
      actor.x = to.x; actor.y = to.y; actor.downUntil = s.tick + 40;
      w.bus.emit({ type: "roof_run", t: s.tick, by: actor.id });
      // Somebody on the gantry might have seen a fat man running across the roof.
      if (s.rng && (s.tick & 3) === 0) crime(w, actor, "running across the stadium roof", 1);
    },
  });
}

/** Knocked out inside the ground: the first-aiders stretcher you to the medical room. */
export function stretcher(w: World, a: Actor): boolean {
  const bed = (SPOTS as any).medBed;
  if (!bed || !VENUE.inside(a.x, a.y)) return false;
  a.x = bed.x; a.y = bed.y + 1;
  w.bus.emit({ type: "stretchered", t: w.state.tick, who: a.id });
  return true;
}

// Bicycles: a couple of unlocked ones about the place. Get on and you're nearly twice as quick as
// running, quicker than any steward. You come off it if you're grabbed, knocked down, or hide.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { hasProp, moveItem, spawnItem } from "../core/items";
import { registerVerb } from "../core/verbs";
import { SPOTS } from "./layout";

export const BIKE_SPEED = 9.5, BIKE_SPRINT = 11.5;

export function installBike(): void {
  registerVerb("ride", {
    check: (w, act, actor, item) => {
      if (actor.bike) return "already on one";
      if (!item || !hasProp(item, "rideable") || item.loc.k !== "ground") return "nothing to ride";
      if (Math.hypot(item.loc.x - actor.x, item.loc.y - actor.y) > 1.9) return "too far";
      if (actor.dragging || actor.heldBy || actor.seated || actor.hiddenIn) return "not now";
      return null;
    },
    perform: (w, act, actor, item) => {
      actor.bike = item!.id;
      item!.facing = actor.facing;
      w.bus.emit({ type: "bike_on", t: w.state.tick, who: actor.id });
    },
  });
  registerVerb("getoff", {
    check: (w, act, actor) => (actor.bike ? null : "not on a bike"),
    perform: (w, act, actor) => getOff(w, actor, false),
  });
}

export function getOff(w: World, a: Actor, thrown: boolean): void {
  const it = a.bike ? w.state.items[a.bike] : undefined;
  a.bike = undefined;
  if (it) { moveItem(w.state, it.id, { k: "ground", x: a.x, y: a.y }); it.facing = thrown ? a.facing + 1.6 : a.facing; it.fallen = thrown; }
  w.bus.emit({ type: "bike_off", t: w.state.tick, who: a.id, thrown });
}

/** The bike goes where its rider goes; anything that stops him riding puts him off it. */
export function stepBikes(w: World): void {
  const s = w.state;
  for (const id in s.actors) {
    const a = s.actors[id];
    if (!a.bike) continue;
    const it = s.items[a.bike];
    if (!it || it.loc.k === "gone") { a.bike = undefined; continue; }
    if (a.heldBy || a.hiddenIn || a.dead || a.seated || a.dragging || a.downUntil > s.tick || a.knock) { getOff(w, a, !!(a.heldBy || a.downUntil > s.tick || a.knock)); continue; }
    if (it.loc.k === "ground") { it.loc.x = a.x; it.loc.y = a.y; } else moveItem(s, it.id, { k: "ground", x: a.x, y: a.y });
    it.facing = a.facing; it.fallen = false;
  }
}

/** Leaning against a wall: one in the alley behind the ground, one up the east street. */
export function spawnBikes(w: World, sp: typeof SPOTS): void {
  for (const at of [sp.bike1, sp.bike2]) {
    const b = spawnItem(w.state, "bicycle", { k: "ground", x: at.x, y: at.y });
    b.facing = 0;
  }
}

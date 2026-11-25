// Every deliberate thing an actor does is an Action dispatched here. One entry
// point means actions can be validated, announced, and recorded for replay.
import { canPocket, defOf, hasProp, moveItem } from "./items";
import type { Action, Actor, Id, Item, VerbId, WorldState } from "./types";
import type { World } from "./world";

export const REACH = 1.6;

export interface VerbDef {
  /** Returns a reason the action is impossible, or null if it can go ahead. */
  check(w: World, a: Action, actor: Actor, item: Item | undefined): string | null;
  perform(w: World, a: Action, actor: Actor, item: Item | undefined): void;
}

const near = (a: Actor, x: number, y: number) => Math.hypot(a.x - x, a.y - y) <= REACH;
const holds = (actor: Actor, item: Item | undefined) =>
  !!item && (actor.hand === item.id || actor.pockets.includes(item.id));
const targetActor = (s: WorldState, a: Action): Actor | undefined =>
  a.target?.k === "actor" ? s.actors[a.target.id] : undefined;

/** Put an item into the actor's hand, pocketing whatever was there if it fits. */
function intoHand(s: WorldState, actor: Actor, item: Item): boolean {
  if (actor.hand && actor.hand !== item.id) {
    const old = s.items[actor.hand];
    if (canPocket(actor, old)) moveItem(s, old.id, { k: "pocket", a: actor.id });
    else moveItem(s, old.id, { k: "ground", x: actor.x, y: actor.y });
  }
  moveItem(s, item.id, { k: "hand", a: actor.id });
  return true;
}

export const VERBS: Record<VerbId, VerbDef> = {
  take: {
    check: (w, a, actor, item) => {
      if (!item) return "nothing to take";
      if (item.loc.k !== "ground") return "not lying around";
      if (!near(actor, item.loc.x, item.loc.y)) return "too far";
      if (defOf(item).size === "huge") return "too big to carry";
      return null;
    },
    perform: (w, a, actor, item) => {
      if (!actor.hand) moveItem(w.state, item!.id, { k: "hand", a: actor.id });
      else if (canPocket(actor, item!)) moveItem(w.state, item!.id, { k: "pocket", a: actor.id });
      else intoHand(w.state, actor, item!);
    },
  },
  drop: {
    check: (w, a, actor, item) => (holds(actor, item) || isWorn(actor, item) ? null : "not carrying it"),
    perform: (w, a, actor, item) => moveItem(w.state, item!.id, { k: "ground", x: actor.x, y: actor.y }),
  },
  wear: {
    check: (w, a, actor, item) => {
      if (!holds(actor, item)) return "not carrying it";
      if (!hasProp(item!, "wearable") || !defOf(item!).slot) return "cannot be worn";
      return null;
    },
    perform: (w, a, actor, item) => {
      const slot = defOf(item!).slot!;
      const old = actor.worn[slot];
      if (old) moveItem(w.state, old, { k: "ground", x: actor.x, y: actor.y });
      moveItem(w.state, item!.id, { k: "worn", a: actor.id, slot });
    },
  },
  remove: {
    // Works on yourself, or on someone else within reach (a steward pulling a shirt off).
    check: (w, a, actor, item) => {
      if (!item || item.loc.k !== "worn") return "not being worn";
      const wearer = w.state.actors[item.loc.a];
      if (wearer.id !== actor.id && !near(actor, wearer.x, wearer.y)) return "too far";
      return null;
    },
    perform: (w, a, actor, item) => {
      const wearerId = (item!.loc as { a: Id }).a;
      if (wearerId === actor.id) intoHand(w.state, actor, item!);
      else moveItem(w.state, item!.id, { k: "ground", x: actor.x, y: actor.y });
    },
  },
  consume: {
    check: (w, a, actor, item) => {
      if (!holds(actor, item)) return "not carrying it";
      return hasProp(item!, "consumable") || hasProp(item!, "substance") ? null : "not edible";
    },
    perform: (w, a, actor, item) => {
      const d = defOf(item!);
      const s = w.state;
      if (d.props.includes("alcohol")) addEffect(s, actor, "drunk", 90);
      if (d.effect) addEffect(s, actor, d.effect, 120);
      if (item!.spiked) addEffect(s, actor, defOf({ def: item!.spiked } as Item).effect ?? item!.spiked, 120);
      moveItem(s, item!.id, { k: "gone" });
    },
  },
  throw: {
    check: (w, a, actor, item) => {
      if (actor.hand !== item?.id) return "not in hand";
      return hasProp(item!, "throwable") || defOf(item!).size === "small" ? null : "cannot be thrown";
    },
    perform: (w, a, actor, item) => {
      // Aimed at a distance: enough speed to land there, given the arc.
      const sp = a.dist !== undefined ? Math.min(Math.max(a.dist / 0.95, 4), 19) : 9 + 7 * (a.power ?? 0.7);
      const l = Math.hypot(a.dirX ?? 0, a.dirY ?? 0);
      const dx = l ? a.dirX! / l : Math.cos(actor.facing), dy = l ? a.dirY! / l : Math.sin(actor.facing);
      actor.facing = Math.atan2(dy, dx);
      moveItem(w.state, item!.id, { k: "air", x: actor.x, y: actor.y, z: 1.5, vx: dx * sp, vy: dy * sp, vz: 3.2, by: actor.id });
    },
  },
  give: {
    check: (w, a, actor, item) => {
      const to = targetActor(w.state, a);
      if (!holds(actor, item)) return "not carrying it";
      if (!to) return "nobody to give it to";
      return near(actor, to.x, to.y) ? null : "too far";
    },
    // Whether the receiver accepts (a bribe, a spiked drink) is decided by whoever
    // listens for the event; the item simply changes hands here.
    perform: (w, a, actor, item) => {
      const to = targetActor(w.state, a)!;
      if (!to.hand) moveItem(w.state, item!.id, { k: "hand", a: to.id });
      else if (canPocket(to, item!)) moveItem(w.state, item!.id, { k: "pocket", a: to.id });
      else moveItem(w.state, item!.id, { k: "ground", x: to.x, y: to.y });
    },
  },
  show: {
    check: (w, a, actor, item) => {
      const to = targetActor(w.state, a);
      if (!holds(actor, item)) return "not carrying it";
      return to && near(actor, to.x, to.y) ? null : "nobody close enough to show";
    },
    perform: () => { /* reaction belongs to listeners */ },
  },
  use: {
    // Item on item. For now: a substance spikes food or drink within reach.
    check: (w, a, actor, item) => {
      const tgt = a.target?.k === "item" ? w.state.items[a.target.id] : undefined;
      if (!holds(actor, item)) return "not carrying it";
      if (!tgt) return "nothing to use it on";
      if (hasProp(item!, "substance") && hasProp(tgt, "spikable")) {
        const l = tgt.loc;
        const p = l.k === "ground" ? l : l.k === "hand" || l.k === "pocket" ? w.state.actors[l.a] : null;
        return p && near(actor, p.x, p.y) ? null : "too far";
      }
      return "that does nothing";
    },
    perform: (w, a, actor, item) => {
      const tgt = w.state.items[(a.target as { id: Id }).id];
      tgt.spiked = item!.def;
      moveItem(w.state, item!.id, { k: "gone" });
    },
  },
  strike: {
    // Bare hands, or whatever is in hand. Kicking the ball is handled by the match.
    check: (w, a, actor) => {
      const to = targetActor(w.state, a);
      return to && near(actor, to.x, to.y) ? null : "nobody in reach";
    },
    perform: (w, a, actor) => {
      const to = targetActor(w.state, a)!;
      const weapon = actor.hand ? hasProp(w.state.items[actor.hand], "weapon") : false;
      to.downUntil = Math.max(to.downUntil, w.state.tick + (weapon ? 600 : 150));
    },
  },
};

function isWorn(actor: Actor, item: Item | undefined): boolean {
  return !!item && Object.values(actor.worn).includes(item.id);
}

function addEffect(s: WorldState, actor: Actor, effect: string, seconds: number): void {
  actor.effects[effect] = Math.max(actor.effects[effect] ?? 0, s.tick + seconds * 60);
}

export function registerVerb(id: VerbId, def: VerbDef): void { VERBS[id] = def; }

export interface DispatchResult { ok: boolean; reason?: string }

/** Try an action. On success it is announced on the bus and, if the actor is being recorded, stored. */
export function dispatch(w: World, a: Action): DispatchResult {
  const actor = w.state.actors[a.actor];
  if (!actor) return { ok: false, reason: "no such actor" };
  if (actor.downUntil > w.state.tick) return { ok: false, reason: "out of action" };
  const item = a.item ? w.state.items[a.item] : undefined;
  if (a.item && (!item || item.loc.k === "gone")) return { ok: false, reason: "that is gone" };
  const verb = VERBS[a.verb];
  const reason = verb.check(w, a, actor, item);
  if (reason) {
    w.bus.emit({ type: "action_failed", t: w.state.tick, action: a, reason });
    return { ok: false, reason };
  }
  verb.perform(w, a, actor, item);
  const rec = w.state.recordings[actor.id];
  if (rec) rec.push({ t: w.state.tick, x: actor.x, y: actor.y, action: structuredClone(a) });
  w.bus.emit({ type: "action", t: w.state.tick, action: a, itemDef: item?.def });
  return { ok: true };
}

/** Verbs that are currently possible for this actor with this item and target. Drives the context button. */
export function possibleVerbs(w: World, base: Omit<Action, "verb">): VerbId[] {
  const actor = w.state.actors[base.actor];
  if (!actor || actor.downUntil > w.state.tick) return [];
  const item = base.item ? w.state.items[base.item] : undefined;
  return Object.keys(VERBS).filter((v) => VERBS[v].check(w, { ...base, verb: v }, actor, item) === null);
}

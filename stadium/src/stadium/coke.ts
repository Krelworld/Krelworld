// Gear. A bag holds a few lines; each one makes Grozz faster and far nastier for a minute and a bit:
// his punches land twice as hard and throw people further, he shrugs off what comes back, and a steward
// who grabs him is as likely to end up on the floor as holding him. When it wears off there's a short
// comedown, and the view offers another line while there's any left. Doing one where security can see
// is its own offence. (Planting a bag on someone and grassing them up is in police.ts; this file is the
// using.)
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { moveItem } from "../core/items";
import { registerVerb } from "../core/verbs";
import { chance, pick } from "../core/rng";
import { canSee, crime, isSecurity } from "./security";

export const LINES_PER_BAG = 4;
export const LINE_SECONDS = 75;
export const COMEDOWN_SECONDS = 20;

export const wired = (w: World, a: Actor) => (a.effects.wired ?? 0) > w.state.tick;
export const linesLeft = (it: Item) => it.uses ?? LINES_PER_BAG;
/** The bag he'd use: one with something left in it, in his hand or pockets. */
export function gearOn(w: World, a: Actor): Item | undefined {
  return [a.hand, ...a.pockets].map((id) => (id ? w.state.items[id] : undefined)).find((i) => i?.def === "powder" && linesLeft(i) > 0);
}

export function installCoke(): void {
  registerVerb("line", {
    check: (w, _act, actor) => {
      if (actor.heldBy) return "not with someone holding you";
      if (actor.hiddenIn || actor.chute) return "not now";
      return gearOn(w, actor) ? null : "no gear";
    },
    perform: (w, _act, actor) => {
      const s = w.state, it = gearOn(w, actor)!, left = linesLeft(it) - 1;
      it.uses = left;
      actor.effects.wired = Math.max(actor.effects.wired ?? 0, s.tick) + LINE_SECONDS * 60;
      delete actor.effects.comedown;
      actor.hurt = Math.max(0, (actor.hurt ?? 0) - 2);
      if (left <= 0) moveItem(s, it.id, { k: "gone" });
      w.bus.emit({ type: "line", t: s.tick, by: actor.id, left });
      // Racking one up in front of a steward or a copper is asking for it.
      const saw = Object.values(s.actors).find((a) => a.npc && isSecurity(a) && !a.dead && a.downUntil <= s.tick && canSee(w, a, actor, 10));
      if (saw) crime(w, actor, "taking drugs in the ground", 1, undefined, false);
    },
  });
}

/** The comedown: when it wears off, a short sluggish spell. */
export function stepCoke(w: World): void {
  const s = w.state, st = s.stadium!, pc = s.actors[st.pc];
  if (!pc || s.tick % 15 !== 0) return;
  const on = wired(w, pc);
  if (st.flags.wasWired && !on) { pc.effects.comedown = s.tick + COMEDOWN_SECONDS * 60; w.bus.emit({ type: "comedown", t: s.tick, by: pc.id }); }
  st.flags.wasWired = on ? 1 : 0;
}

/** Grabbed while wired: as often as not he throws them off before they've got a grip. */
export function shrugOff(w: World, g: Actor, t: Actor): boolean {
  if (!wired(w, t) || !chance(w.state.rng.world, 0.45)) return false;
  const s = w.state, dx = g.x - t.x, dy = g.y - t.y, dl = Math.hypot(dx, dy) || 1;
  g.knock = { vx: (dx / dl) * 15, vy: (dy / dl) * 15, from: s.tick, until: s.tick + 24 };
  g.downUntil = Math.max(g.downUntil, s.tick + 70);
  w.bus.emit({ type: "shrugged_off", t: s.tick, by: t.id, who: g.id });
  w.bus.emit({ type: "pc_say", t: s.tick, by: t.id, text: pick(s.rng.world, ["GET OFF ME!", "Not today, sunshine!", "Have it!"]) });
  return true;
}

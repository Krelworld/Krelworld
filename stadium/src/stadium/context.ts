// What the player could do right now, given where he is and what he holds.
// The view shows the best one on the action button and the rest in a list.
import { appearance } from "../core/identity";
import { defOf, hasProp } from "../core/items";
import type { Action, Actor, Item } from "../core/types";
import { possibleVerbs } from "../core/verbs";
import type { World } from "../core/world";
import { areaAt } from "./layout";
import { climbPointNear, turnstileNear, SHOPS } from "./rules";
import { cargoOpen } from "./vehicles";

export interface Option {
  label: string;
  /** Higher goes on the main button. Zero or less never does. */
  priority: number;
  action?: Action;
  /** Opens a sheet instead of acting straight away. */
  sheet?: { kind: "shop" | "bribe" | "bet"; who: string };
}

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const itemName = (it: Item) => defOf(it).name;
export const personName = (a: Actor) => (a.fb ? `${a.name} (${a.fb.team === 0 ? "England" : "opposition"} ${a.fb.number})` : a.off ? (a.off.job === "referee" ? "the referee" : a.name.toLowerCase()) : a.name);

export function options(w: World, pc: Actor): Option[] {
  const s = w.state, out: Option[] = [];
  const base = { actor: pc.id };
  const ok = (a: Action) => possibleVerbs(w, a as Omit<Action, "verb">).includes(a.verb);
  const push = (label: string, priority: number, action: Action) => { if (ok(action)) out.push({ label, priority, action }); };

  if (pc.heldBy) return [{ label: "Struggle", priority: 100, action: { verb: "struggle", ...base } }];
  if (pc.hiddenIn) return [{ label: "Climb out", priority: 100, action: { verb: "unhide", ...base } }];
  if (pc.seated) out.push({ label: "Stand up", priority: 90, action: { verb: "stand", ...base } });

  const hand = pc.hand ? s.items[pc.hand] : undefined;

  // The ball.
  const m = s.match;
  if (m && !pc.seated) push("Kick the ball", 85, { verb: "kick", ...base });

  // Things on the ground and fixtures.
  for (const id in s.items) {
    const it = s.items[id], l = it.loc;
    if (l.k !== "ground") continue;
    const d = Math.hypot(l.x - pc.x, l.y - pc.y);
    if (d > 2.6) continue;
    const def = defOf(it);
    if (def.size !== "huge") push(`Pick up ${lc(def.name)}`, 70 - d, { verb: "take", ...base, item: it.id });
    if (hasProp(it, "container") && it.def !== "locker") {
      const v = Object.values(s.stadium!.vehicles).find((vv) => vv.cargo === it.id);
      if (!v || cargoOpen(v)) push("Hide in the back of the lorry", 72 - d, { verb: "hide", ...base, target: { k: "item", id: it.id } });
    }
    if (hasProp(it, "spikable")) {
      for (const sub of [pc.hand, ...pc.pockets]) {
        if (!sub || !hasProp(s.items[sub], "substance")) continue;
        push(`Put ${lc(defOf(s.items[sub]).name)} in ${lc(def.name)}`, 75 - d, { verb: "use", ...base, item: sub, target: { k: "item", id: it.id } });
      }
    }
  }

  // People.
  const people = Object.values(s.actors)
    .filter((a) => a.id !== pc.id && !a.hiddenIn && (a.npc || a.fb || a.off) && (!a.fb || a.fb.status !== "gone"))
    .map((a) => ({ a, d: Math.hypot(a.x - pc.x, a.y - pc.y) }))
    .filter((p) => p.d < 3.6)
    .sort((p, q) => p.d - q.d)
    .slice(0, 3);
  for (const { a, d } of people) {
    const name = personName(a), n = a.npc;
    if (n?.shop === "bookies") out.push({ label: "Place a bet", priority: 80 - d, sheet: { kind: "bet", who: a.id } });
    else if (n?.shop) out.push({ label: `Buy from ${n.shop === "ticket" ? "the ticket office" : SHOPS[n.shop].name.toLowerCase().replace(/^the /, "the ")}`, priority: 80 - d, sheet: { kind: "shop", who: a.id } });
    if (n?.job === "turnstile") {
      const ticket = [pc.hand, ...pc.pockets].find((id) => id && s.items[id].def === "ticket");
      if (ticket) push(`Show your ticket to ${name}`, 82 - d, { verb: "show", ...base, item: ticket, target: { k: "actor", id: a.id } });
    }
    if (n && n.job !== "player" && n.job !== "official") push(`Talk to ${name}`, (n.job === "fan" ? 12 : n.job === "local" ? 25 : 40) - d, { verb: "talk", ...base, target: { k: "actor", id: a.id } });
    if (pc.money > 0 && d < 2.2) out.push({ label: `Offer ${name} money`, priority: 5, sheet: { kind: "bribe", who: a.id } });
    if (n && n.job !== "player" && n.job !== "official" && !n.shop) push(`Pickpocket ${name}`, 6, { verb: "pickpocket", ...base, target: { k: "actor", id: a.id } });
    if (hand && d < 1.7) push(`Give ${lc(itemName(hand))} to ${name}`, 3, { verb: "give", ...base, item: hand.id, target: { k: "actor", id: a.id } });
    const weapon = hand && hasProp(hand, "weapon");
    push(weapon ? `Stab ${name}` : `Punch ${name}`, -1, { verb: "strike", ...base, target: { k: "actor", id: a.id } });
  }

  // Dressed as the referee, on the pitch: make some decisions.
  if (appearance(s, pc).role === "referee" && areaAt(pc.x, pc.y).pitch) {
    const opp = Object.values(s.actors).filter((a) => a.fb?.team === 1 && a.fb.status === "playing" && Math.hypot(a.x - pc.x, a.y - pc.y) < 7)
      .sort((p, q) => Math.hypot(p.x - pc.x, p.y - pc.y) - Math.hypot(q.x - pc.x, q.y - pc.y))[0];
    push("Award England a penalty", 60, { verb: "rule", ...base, arg: "penalty" });
    if (opp) push(`Send off ${opp.name}`, 58, { verb: "rule", ...base, arg: "sendoff", target: { k: "actor", id: opp.id } });
    push("Disallow their goal", 62, { verb: "rule", ...base, arg: "disallow" });
    push("Blow for full time", 20, { verb: "rule", ...base, arg: "fulltime" });
    push("Stop play", 15, { verb: "rule", ...base, arg: "stop" });
  }

  // Places.
  if (turnstileNear(pc) && !pc.seated) out.push({ label: "Climb over the turnstile", priority: 4, action: { verb: "vault", ...base } });
  if (climbPointNear(pc) && !pc.seated) out.push({ label: "Squeeze through the loose panel", priority: 50, action: { verb: "vault", ...base } });
  if (areaAt(pc.x, pc.y).seats && !pc.seated) push("Sit down and watch", 45, { verb: "sit", ...base });

  out.sort((p, q) => q.priority - p.priority);
  return out;
}

export function primary(opts: Option[]): Option | null {
  return opts.find((o) => o.priority > 0) ?? null;
}

/** What the bag sheet offers for one item. */
export function itemOptions(w: World, pc: Actor, it: Item): Option[] {
  const base = { actor: pc.id, item: it.id };
  const out: Option[] = [];
  const add = (label: string, verb: string) => { if (possibleVerbs(w, base).includes(verb)) out.push({ label, priority: 1, action: { verb, ...base } }); };
  const def = defOf(it);
  add("Hold", "hold");
  add("Put in pocket", "pocket");
  add(def.slot ? `Put on` : "Wear", "wear");
  if (it.loc.k === "worn") add("Take off", "remove");
  add(def.props.includes("food") ? "Eat" : def.props.includes("liquid") ? "Drink" : "Take", "consume");
  add("Drop", "drop");
  return out;
}

/** Who the throw button would aim at: the nearest person roughly in front, or the referee if seated. */
export function throwTarget(w: World, pc: Actor, pickedId: string | null): Actor | null {
  const s = w.state;
  if (pickedId && s.actors[pickedId]) {
    const a = s.actors[pickedId];
    if (Math.hypot(a.x - pc.x, a.y - pc.y) < 22 && !a.hiddenIn) return a;
  }
  let best: Actor | null = null, bestScore = 1e9;
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.id === pc.id || a.hiddenIn || (a.fb && a.fb.status !== "playing")) continue;
    if (a.seated && !a.fb) continue;
    const dx = a.x - pc.x, dy = a.y - pc.y, d = Math.hypot(dx, dy);
    if (d < 1.5 || d > 20) continue;
    const ang = Math.cos(Math.atan2(dy, dx) - pc.facing);
    if (!pc.seated && ang < 0.75) continue;
    const score = d * (pc.seated ? 1 : 2 - ang) - (a.off?.job === "referee" ? 6 : 0) - (a.fb && s.match?.ball.owner === a.id ? 4 : 0);
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function looksOutOfPlace(w: World, pc: Actor): boolean {
  const ar = areaAt(pc.x, pc.y);
  if (ar.access === "public") return false;
  const role = appearance(w.state, pc).role;
  if (ar.roles?.length) return !ar.roles.includes(role);
  return ar.access !== "ticket" && role !== "steward" && role !== "police";
}

/** Where to throw so it arrives where a moving target will be. */
export function aimThrow(pc: Actor, t: Actor): { dirX: number; dirY: number; dist: number } {
  let x = t.x, y = t.y;
  for (let i = 0; i < 3; i++) {
    const d = Math.hypot(x - pc.x, y - pc.y), flight = Math.min(1, d / Math.max(4, d / 0.95) + 0.05);
    x = t.x + t.vx * flight * 0.9; y = t.y + t.vy * flight * 0.9;
  }
  return { dirX: x - pc.x, dirY: y - pc.y, dist: Math.hypot(x - pc.x, y - pc.y) };
}

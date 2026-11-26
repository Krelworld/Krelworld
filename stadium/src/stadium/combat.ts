// Fighting, made simple and nasty. Blows add up until someone is knocked out (from behind it's one
// blow and nobody hears); the knocked out lie there for a good while and the dead for good. Either
// can be gone through for money, drugs, weapons and the clothes off their back, dragged somewhere
// quiet and stuffed in a bin or a cubicle. Some people hit back.
import { canPocket, defOf, moveItem, spawnItem } from "../core/items";
import { chance, pick } from "../core/rng";
import type { Actor, Item } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { areaAt, SOLID } from "./layout";
import { say } from "./npc";
import { alert, canSee, crime, isSecurity } from "./security";
import { stretcher } from "./routes";

/** How long someone stays knocked out. */
export const KO_SECONDS = 50;
/** How long a blow that doesn't knock you out keeps you staggering. */
const STAGGER_TICKS = 36;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;

/** Is the attacker behind the victim (the victim facing away)? */
export function fromBehind(by: Actor, t: Actor): boolean {
  const toBy = Math.atan2(by.y - t.y, by.x - t.x);
  return Math.cos(toBy - t.facing) < -0.35;
}

/** Blows it takes to put someone down. */
export function toughness(t: Actor): number {
  const j = t.npc?.job;
  if (j === "armed") return 5;
  if (isSecurity(t)) return 3;
  if (t.fb || t.off) return 3;
  if (t.npc?.mounted) return 4;
  return hash(t.id) % 5 === 0 ? 4 : 2; // the odd big lad takes some putting down
}

export const knockedOut = (w: World, a: Actor): boolean => (a.effects.ko ?? 0) > w.state.tick;
export const incapacitated = (w: World, a: Actor): boolean => !!a.dead || knockedOut(w, a);

/** Knock someone out cold. */
export function knockOut(w: World, t: Actor, by: Actor | null, quiet: boolean): void {
  const s = w.state, until = s.tick + KO_SECONDS * 60;
  t.effects.ko = until;
  t.downUntil = Math.max(t.downUntil, until);
  t.heldBy = undefined;
  if (t.npc) { t.npc.plan = []; t.npc.goal = null; t.npc.mode = "routine"; t.npc.target = null; t.npc.gawk = undefined; }
  for (const id in s.actors) { const h = s.actors[id]; if (h.heldBy === t.id) h.heldBy = undefined; }
  w.bus.emit({ type: "knockout", t: s.tick, who: t.id, by: by?.id, quiet });
}

/** A blow lands (the strike verb calls this). Returns whether they went down for good. */
export function land(w: World, by: Actor, t: Actor, weapon: boolean, heavy = false, sneak = false): "takedown" | "ko" | "hurt" {
  const s = w.state;
  // From behind, bare-handed: the choke. If you went for one, a target who has half turned still counts.
  const behind = fromBehind(by, t) || (sneak && Math.cos(Math.atan2(by.y - t.y, by.x - t.x) - t.facing) < 0.2);
  if (behind && !weapon && !t.fb) { knockOut(w, t, by, true); return "takedown"; }
  t.hurt = (t.hurt ?? 0) + (weapon || heavy ? 3 : 1);
  if (t.hurt >= toughness(t)) { knockOut(w, t, by, false); return "ko"; }
  t.downUntil = Math.max(t.downUntil, s.tick + STAGGER_TICKS);
  // Some hit back: a big lad nearly always, an ordinary fan sometimes. Security grab you instead.
  if (t.npc && (t.npc.job === "fan" || t.npc.job === "local") && chance(s.rng.world, hash(t.id) % 5 === 0 ? 0.85 : 0.35)) {
    t.npc.retaliateAt = s.tick + STAGGER_TICKS + 12;
    t.npc.retaliateOn = by.id;
  }
  return "hurt";
}

/** What someone has on them worth taking, made up once (from their id, so it's the same every time). */
function stock(w: World, t: Actor): void {
  if (t.looted) return;
  t.looted = true;
  if (!t.npc) return;
  const s = w.state, h = hash(t.id), job = t.npc.job;
  const add = (def: string) => spawnItem(s, def, { k: "pocket", a: t.id });
  if (job === "fan" || job === "local") {
    if (h % 4 === 0) add("powder");
    if (h % 11 === 3) add("knife");
    if (h % 5 === 1 && !t.pockets.some((id) => s.items[id].def === "ticket")) add("ticket");
  }
  if (isSecurity(t) && job !== "police" && job !== "armed" && h % 2 === 0) add("staff_pass");
  if (isSecurity(t) && job !== "armed" && job !== "cleanup") add("radio");
}

/** Everything that can be taken off someone, including what they're wearing. */
export function lootable(w: World, t: Actor): Item[] {
  stock(w, t);
  const s = w.state;
  return [t.hand, ...t.pockets, ...Object.values(t.worn)].filter((x): x is string => !!x).map((id) => s.items[id]).filter((it) => it && it.def !== "face");
}

/** Places a body can go and not be seen: bins, the cubicles, lockers. */
export function hidingPlaceNear(w: World, a: Actor): string | null {
  const ar = areaAt(a.x, a.y);
  if (ar.private) return ar.id;
  for (const wl of SOLID) {
    if (!wl.prop || wl.w > 1.4 || wl.h > 1.0) continue; // bins and the like
    const cx = wl.x + wl.w / 2, cy = wl.y + wl.h / 2;
    if (Math.hypot(a.x - cx, a.y - cy) < 1.6 && wl.w > 0.6) return `bin@${cx.toFixed(1)},${cy.toFixed(1)}`;
  }
  return null;
}

export function installCombat(): void {
  registerVerb("loot", {
    check: (w, act, actor) => {
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      if (!t || !incapacitated(w, t) || t.hiddenIn) return "they'd notice";
      if (Math.hypot(t.x - actor.x, t.y - actor.y) > 2.4) return "too far";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, t = s.actors[(act.target as { id: string }).id];
      const take = (it: Item) => {
        if (canPocket(actor, it)) moveItem(s, it.id, { k: "pocket", a: actor.id });
        else if (!actor.hand) moveItem(s, it.id, { k: "hand", a: actor.id });
        else moveItem(s, it.id, { k: "ground", x: actor.x, y: actor.y });
      };
      const items = lootable(w, t);
      let money = 0;
      if (act.arg === "money" || act.arg === "all") { money = t.money; actor.money += t.money; t.money = 0; }
      if (act.arg === "all") for (const it of items) if (defOf(it).size === "small" || it.loc.k === "worn") take(it);
      if (act.arg && act.arg !== "money" && act.arg !== "all") { const it = s.items[act.arg]; if (it && items.includes(it)) take(it); }
      w.bus.emit({ type: "looted", t: s.tick, by: actor.id, who: t.id, money, what: act.arg });
      const seen = w.state.stadium && Object.values(s.actors).some((o) => o.npc && o !== t && !incapacitated(w, o) && o.npc.job !== "dog" && canSee(w, o, actor, 10));
      if (seen) crime(w, actor, "robbing someone lying on the floor", 2, t);
    },
  });
  registerVerb("drag", {
    check: (w, act, actor) => {
      if (actor.dragging) return null; // letting go
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      if (!t || !incapacitated(w, t) || t.hiddenIn) return "nothing to drag";
      return Math.hypot(t.x - actor.x, t.y - actor.y) > 2.4 ? "too far" : null;
    },
    perform: (w, act, actor) => {
      if (actor.dragging) { w.bus.emit({ type: "dropped_body", t: w.state.tick, by: actor.id, who: actor.dragging }); actor.dragging = undefined; return; }
      actor.dragging = (act.target as { id: string }).id;
      w.bus.emit({ type: "dragging", t: w.state.tick, by: actor.id, who: actor.dragging });
    },
  });
  registerVerb("hidebody", {
    check: (w, _act, actor) => (actor.dragging && hidingPlaceNear(w, actor) ? null : "nowhere to put it"),
    perform: (w, _act, actor) => {
      const b = w.state.actors[actor.dragging!];
      b.hiddenIn = hidingPlaceNear(w, actor)!;
      // Out of sight, out of the match: a stashed body stays stashed.
      b.effects.ko = Number.MAX_SAFE_INTEGER; b.downUntil = Number.MAX_SAFE_INTEGER;
      actor.dragging = undefined;
      w.bus.emit({ type: "hid_body", t: w.state.tick, by: actor.id, who: b.id, where: b.hiddenIn });
    },
  });
  registerVerb("finish", {
    // Stamp on his head while he's down: it goes everywhere.
    check: (w, act, actor) => {
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      return t && incapacitated(w, t) && !t.splat && !t.hiddenIn && Math.hypot(t.x - actor.x, t.y - actor.y) < 1.8 ? null : "not down";
    },
    perform: (w, act, actor) => {
      const s = w.state, t = s.actors[(act.target as { id: string }).id];
      const wasAlive = !t.dead;
      t.splat = s.tick;
      actor.effects.bloody = Math.max(actor.effects.bloody ?? 0, s.tick + 60 * 240);
      actor.facing = Math.atan2(t.y - actor.y, t.x - actor.x);
      if (wasAlive) {
        t.dead = true; t.downUntil = Number.MAX_SAFE_INTEGER;
        s.stadium!.flags.killings = (s.stadium!.flags.killings ?? 0) + 1;
        w.bus.emit({ type: "killed", t: s.tick, who: t.id, by: actor.id, x: t.x, y: t.y, footballer: !!t.fb, referee: t.off?.job === "referee", stamp: true });
      }
      w.bus.emit({ type: "headsplat", t: s.tick, who: t.id, by: actor.id, x: t.x, y: t.y });
      crime(w, actor, wasAlive ? "stamping on a man's head until it burst" : "stamping on a dead man's head", wasAlive ? 4 : 3, t);
    },
  });
}

/** Each step: bodies follow whoever is dragging them; the knocked out wake; some hit back. */
export function stepCombat(w: World): void {
  const s = w.state, tick = s.tick;
  for (const id in s.actors) {
    const a = s.actors[id];
    // Dragging: the body comes along behind, feet first.
    if (a.dragging) {
      const b = s.actors[a.dragging];
      if (!b || b.hiddenIn || !incapacitated(w, b) || a.downUntil > tick || a.hiddenIn) a.dragging = undefined;
      else {
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
        if (d > 0.9) { b.x += (dx / d) * (d - 0.9); b.y += (dy / d) * (d - 0.9); }
        b.facing = Math.atan2(dy, dx);
      }
    }
    // Waking up, groggy and angry: security come for you, fans leg it.
    if (a.effects.ko && tick >= a.effects.ko) {
      delete a.effects.ko; a.hurt = 0;
      w.bus.emit({ type: "woke", t: tick, who: a.id });
      const pc = s.actors[s.stadium!.pc];
      if (a.npc && pc) {
        say(w, a, pick(s.rng.world, ["Ugh... what hit me?", "My head...", "Where am I?", "Who did that? WHO DID THAT?"]), 3);
        if (isSecurity(a) && Math.hypot(pc.x - a.x, pc.y - a.y) < 15) alert(w, a, pc, 2, 1.5);
      }
    }
    // Hitting back.
    const n = a.npc;
    if (n?.retaliateAt && tick >= n.retaliateAt) {
      const t = s.actors[n.retaliateOn ?? ""];
      n.retaliateAt = 0;
      if (t && a.downUntil <= tick && !incapacitated(w, a) && Math.hypot(t.x - a.x, t.y - a.y) < 2.2) {
        say(w, a, pick(s.rng.world, ["Have some of that!", "You what?!", "Come on then!", "Fuckin' 'ave that!", "You cunt!", "Come on then, you fat cunt!"]), 2);
        a.facing = Math.atan2(t.y - a.y, t.x - a.x);
        hitPlayerBack(w, a, t);
      }
    }
  }
}

/** An NPC lands one on someone (usually you). */
function hitPlayerBack(w: World, a: Actor, t: Actor): void {
  const s = w.state;
  const dx = t.x - a.x, dy = t.y - a.y, dl = Math.hypot(dx, dy) || 1;
  t.knock = { vx: (dx / dl) * 11, vy: (dy / dl) * 11, from: s.tick, until: s.tick + 22 };
  w.bus.emit({ type: "struck", t: s.tick, by: a.id, who: t.id, weapon: false, dx: dx / dl, dy: dy / dl });
  t.hurt = (t.hurt ?? 0) + 1;
  if (t.id === s.stadium!.pc && t.hurt >= 5) {
    // Knocked out yourself: you come round with lighter pockets.
    t.effects.ko = s.tick + 8 * 60; t.downUntil = s.tick + 8 * 60; t.hurt = 0;
    const lost = Math.floor(t.money / 2); t.money -= lost;
    w.bus.emit({ type: "knockout", t: s.tick, who: t.id, by: a.id, quiet: false, lost });
    stretcher(w, t);
  } else t.downUntil = Math.max(t.downUntil, s.tick + 24);
  if (t.id === s.stadium!.pc) crime(w, a, "brawling", 1, t);
}

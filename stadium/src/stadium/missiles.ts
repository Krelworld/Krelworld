// Things to throw and shoot.
//   Bricks: from piles round the building site, the alley and the car park. Heavier than a pint so
//   they don't go as far, but one to the head puts a man down, and they go through a window.
//   Windows: two in the outer wall of the South concourse. Put a brick through one (thrown, or by
//   hand) and you can climb in. Loud, though: anyone close comes to look.
//   Fart canisters: thrown, they burst into a stench that clears everyone out of about seven metres
//   for twenty seconds, stewards included (Hitman's emetic gas: relocation, not harm).
//   The sniper rifle: hidden on the hotel roof from the semi-final on. Through the scope in first
//   person. Three rounds. Every shot kills, every shot is heard all round the ground, and armed
//   police are on their way after the first one.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { chance, pick, rnd } from "../core/rng";
import { registerVerb } from "../core/verbs";
import { defOf, hasProp, moveItem, spawnItem } from "../core/items";
import { haltPlay, removePlayer, resumePlay } from "../football/api";
import { say } from "./npc";
import { crime, isSecurity } from "./security";
import { knockOut, incapacitated } from "./combat";
import { callArmed } from "./knife";
import { areaAt, SPOTS, VENUE } from "./layout";
import { lineOfSight } from "./nav";

export const RIFLE_RANGE = 75;
const GAG = ["Oh my GOD. What is that?!", "Jesus! Who's shat themselves?", "I'm gonna be sick!", "That's not human!", "My eyes! My EYES!", "It's in my mouth! It's in my MOUTH!", "Something's died in here!", "Run! Run for your lives!"];

/** The windows in the concourse wall you can put a brick through. */
export const windows = (): { x: number; y: number }[] => {
  const qf = [{ x: -40, y: 44.5 }, { x: 34, y: 44.5 }];
  return VENUE.id === "sf" ? qf.map((p) => ({ x: -p.x, y: p.y })) : qf;
};
export const windowBroken = (w: World, i: number) => !!w.state.stadium!.flags[`win_${i}`];
export function windowNear(a: Actor, r = 1.8): number {
  const ws = windows();
  for (let i = 0; i < ws.length; i++) if (Math.hypot(a.x - ws[i].x, a.y - ws[i].y) < r) return i;
  return -1;
}
const SMASHERS = new Set(["brick", "hammer", "wrench", "bottle", "chair", "pint_glass"]);

function smash(w: World, i: number, by: Actor | undefined): void {
  const s = w.state, st = s.stadium!, p = windows()[i];
  if (windowBroken(w, i)) return;
  st.flags[`win_${i}`] = s.tick || 1;
  w.bus.emit({ type: "window_smashed", t: s.tick, i, x: p.x, y: p.y, by: by?.id });
  if (by) crime(w, by, "smashing a window", 2, undefined, false);
  // The noise: stewards close by come and look.
  for (const id in s.actors) {
    const g = s.actors[id];
    if (!isSecurity(g) || g.npc!.mode !== "routine" || g.downUntil > s.tick || Math.hypot(g.x - p.x, g.y - p.y) > 14) continue;
    g.npc!.plan = [{ k: "go", x: p.x + (rnd(s.rng.world) - 0.5) * 2, y: p.y - 1.5 }, { k: "wait", s: 8 }];
  }
}

/** Where brick piles are: a few bricks lying by each. */
export function spawnBricks(w: World): void {
  const s = w.state, m = VENUE.id === "sf" ? -1 : 1;
  const piles = [{ x: 50, y: 48.2 }, { x: -66, y: 30 }, { x: 52, y: 79 }, { x: -24.5, y: 76 }];
  for (const p of piles) for (let k = 0; k < 3; k++) spawnItem(s, "brick", { k: "ground", x: m * p.x + (k - 1) * 0.45, y: p.y + (k % 2) * 0.3 });
  // A stink canister in the skip, and the surplus shop sells them.
  spawnItem(s, "fart_can", { k: "ground", x: m * -63.4, y: -17.2 });
  // The rifle: on the hotel roof, from the semi-final.
  if (VENUE.id !== "qf") { const rf = spawnItem(s, "rifle", { k: "ground", x: m * 88.5, y: -36 }); rf.onRoof = "hotel"; rf.ammo = 3; }
}

export function installMissiles(w: World): void {
  registerVerb("smashwindow", {
    check: (w2, _act, actor) => {
      const i = windowNear(actor);
      if (i < 0) return "no window here";
      if (windowBroken(w2, i)) return "it's already smashed";
      const h = actor.hand ? w2.state.items[actor.hand] : undefined;
      return h && SMASHERS.has(h.def) ? null : "you need something heavy";
    },
    perform: (w2, _act, actor) => { const i = windowNear(actor); actor.facing = Math.atan2(windows()[i].y - actor.y, windows()[i].x - actor.x); smash(w2, i, actor); },
  });
  registerVerb("climbwindow", {
    check: (w2, _act, actor) => { const i = windowNear(actor); return i >= 0 && windowBroken(w2, i) ? null : "no way through"; },
    perform: (w2, _act, actor) => {
      const s = w2.state, p = windows()[windowNear(actor)];
      const inside = VENUE.inside(actor.x, actor.y);
      actor.x = p.x; actor.y = inside ? p.y + 1.6 : p.y - 1.5; actor.vx = actor.vy = 0;
      actor.downUntil = Math.max(actor.downUntil, s.tick + 45);
      if (!inside) { s.stadium!.admitted = true; s.stadium!.flags.inByWindow = 1; }
      w2.bus.emit({ type: "climbed_window", t: s.tick, by: actor.id, inside: !inside });
      crime(w2, actor, "climbing through a broken window", 1);
    },
  });
  registerVerb("shoot", {
    check: (w2, act, actor) => {
      const gun = actor.hand ? w2.state.items[actor.hand] : undefined;
      if (!gun || !hasProp(gun, "gun")) return "no gun";
      if ((gun.ammo ?? 3) <= 0) return "out of bullets";
      const t = act.target?.k === "actor" ? w2.state.actors[act.target.id] : undefined;
      if (!t || t === actor || t.dead || t.hiddenIn) return null; // a miss is still a shot
      return null;
    },
    perform: (w2, act, actor) => {
      const s = w2.state, st = s.stadium!, gun = s.items[actor.hand!], r = s.rng.world;
      gun.ammo = (gun.ammo ?? 3) - 1;
      const t = act.target?.k === "actor" ? s.actors[act.target.id] : undefined;
      const d = t ? Math.hypot(t.x - actor.x, t.y - actor.y) : RIFLE_RANGE;
      const clear = !!t && d <= RIFLE_RANGE && (actor.roof || lineOfSight(actor.x, actor.y, t.x, t.y));
      // Further away, harder to hit (the sway's already in where you aimed; this is the bullet's drop and the wind).
      const hit = clear && chance(r, d < 30 ? 0.95 : d < 50 ? 0.8 : 0.6);
      w2.bus.emit({ type: "gunshot", t: s.tick, by: actor.id, x: actor.x, y: actor.y, who: hit ? t!.id : undefined, sniper: true, tx: t?.x, ty: t?.y });
      if (hit && t) {
        t.dead = true; t.downUntil = Number.MAX_SAFE_INTEGER; t.effects.bloody = s.tick + 60 * 600;
        if (t.npc) { t.npc.plan = []; t.npc.mode = "routine"; t.npc.target = null; }
        if (t.fb) removePlayer(w2, t.id, "injured");
        w2.bus.emit({ type: "killed", t: s.tick, who: t.id, by: actor.id, x: t.x, y: t.y, shot: true, footballer: !!t.fb, referee: t.id === s.match!.officials.referee });
        if (t.fb && areaAt(t.x, t.y).pitch && (s.match!.phase === "live" || s.match!.phase === "restart")) haltPlay(w2, "shot");
      }
      // Everyone hears it. The armed police come.
      crime(w2, actor, hit ? (t!.fb ? "shooting a footballer" : "shooting a man dead") : "firing a rifle", 4, hit ? t : undefined);
      callArmed(w2, actor.x, actor.y);
      st.flags.shots = (st.flags.shots ?? 0) + 1;
      for (const id in s.actors) {
        const a = s.actors[id], n = a.npc;
        if (!n || a.dead || a.downUntil > s.tick || isSecurity(a) || n.job === "dog" || Math.hypot(a.x - actor.x, a.y - actor.y) > 60) continue;
        if (n.mode !== "routine" || a.seated || !chance(r, 0.5)) continue;
        const from = t && hit ? t : actor, ang = Math.atan2(a.y - from.y, a.x - from.x);
        n.plan = [{ k: "say", text: pick(r, ["GUN! He's got a GUN!", "Get down! GET DOWN!", "Oh my God!", "Run!"]) }, { k: "go", x: a.x + Math.cos(ang) * 14, y: a.y + Math.sin(ang) * 14, run: true }];
      }
    },
  });

  w.bus.on((e) => {
    const s = w.state, st = s.stadium!;
    if ((e.type === "item_landed" || e.type === "item_hit") && e.itemDef === "brick") {
      // Through a window?
      const ws = windows();
      for (let i = 0; i < ws.length; i++) if (Math.abs(e.x - ws[i].x) < 1.6 && Math.abs(e.y - ws[i].y) < 1.6) smash(w, i, s.actors[e.by]);
    }
    if (e.type === "item_hit" && e.itemDef === "brick") {
      const t = s.actors[e.target], by = s.actors[e.by];
      if (t?.npc && !t.dead && t.npc.job !== "dog") { knockOut(w, t, by ?? null, false); t.effects.bloody = Math.max(t.effects.bloody ?? 0, s.tick + 60 * 120); }
    }
    if ((e.type === "item_landed" || e.type === "item_hit") && e.itemDef === "fart_can") {
      st.smoke.push({ x: e.x, y: e.y, r: 7, until: s.tick + 60 * 20, kind: "stench" });
      moveItem(s, e.item, { k: "gone" });
      w.bus.emit({ type: "stench", t: s.tick, x: e.x, y: e.y, by: e.by, pitch: !!areaAt(e.x, e.y).pitch });
      const by = s.actors[e.by];
      if (by) crime(w, by, "letting off a stink bomb", 1, undefined, false);
      if (areaAt(e.x, e.y).pitch && s.match && (s.match.phase === "live" || s.match.phase === "restart")) { haltPlay(w, "stench"); st.flags.stenchHalt = 1; }
    }
  });
}

/** Everyone in a stench cloud gets out of it, gagging. Stewards leave their posts too. */
export function stepStench(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, r = s.rng.world;
  const clouds = st.smoke.filter((c) => c.kind === "stench" && c.until > tick);
  if (st.flags.stenchHalt && !clouds.some((c) => areaAt(c.x, c.y).pitch)) { st.flags.stenchHalt = 0; if (s.match?.halted === "stench") resumePlay(w); }
  if (!clouds.length || tick % 15 !== 0) return;
  let gagged = 0;
  for (const id in s.actors) {
    const a = s.actors[id], n = a.npc;
    if (!n || a.dead || a.hiddenIn || a.heldBy || incapacitated(w, a) || n.job === "dog" || id === st.pc) continue;
    if (n.mode === "chase" || n.mode === "escort") continue;
    const c = clouds.find((k) => Math.hypot(a.x - k.x, a.y - k.y) < k.r);
    if (!c) continue;
    if ((n.stenchUntil ?? 0) > tick) continue;
    const ang = Math.atan2(a.y - c.y, a.x - c.x) + (rnd(r) - 0.5) * 0.6, out = c.r + 3 + rnd(r) * 3;
    a.seated = false; n.sitting = false;
    n.plan = [{ k: "go", x: c.x + Math.cos(ang) * out, y: c.y + Math.sin(ang) * out, run: true }, { k: "wait", s: Math.max(4, (c.until - tick) / 60 + 2) }];
    n.stenchUntil = c.until + 60 * 3;
    n.goal = null; n.path = [];
    if (gagged < 2 && !n.bubble && chance(r, 0.5)) { say(w, a, pick(r, GAG), 2.2); gagged++; }
  }
}

export function rifleOf(w: World, a: Actor): Item | undefined {
  const it = a.hand ? w.state.items[a.hand] : undefined;
  return it && defOf(it).props.includes("gun") ? it : undefined;
}

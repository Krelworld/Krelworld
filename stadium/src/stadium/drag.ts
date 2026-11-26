// Grozz in a frock gets what women get at the football. Every so often a bloke leers at him; now and
// then one comes over and gets handsy. Then (and only then) Grozz can flatten him: the people who saw
// it are on his side, and the stewards let it go ("he had that coming"). Throw the first punch at a
// man who's only looked at you and it's assault like any other. Satire, but it's also a mechanic: a
// disguise that draws a particular kind of attention, and a fight you're allowed to win.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { chance, pick } from "../core/rng";
import { canSee, isSecurity } from "./security";
import { say } from "./npc";
import { isWoman } from "./lech";

export const LEERS = [
  "Alright, darlin'? Big girl, aren't ya?",
  "Phwoar. I like 'em with a bit of meat on 'em.",
  "Smile, love. Might never happen.",
  "Give us a twirl, sweetheart.",
  "Here, gorgeous, let me buy you a drink.",
  "Cor, you've got shoulders on you, love. I like that.",
];
export const HANDSY = ["Come here, you. Don't be shy.", "Ooh, what's under that dress then?", "Go on, just a little squeeze."];
export const GIVE_UP = "Frigid cow!";
export const CHEER_F = "Good on ya, love! Dirty pervert had it coming!";
export const CHEER_M = "Fair enough, love. He had that coming.";

/** Dressed as a woman: the frock, or the long blonde wig. */
export function inDrag(w: World, a: Actor): boolean {
  const s = w.state, outer = a.worn.outer ? s.items[a.worn.outer]?.def : undefined, head = a.worn.head ? s.items[a.worn.head]?.def : undefined;
  return outer === "dress" || head === "long_wig";
}

export interface Creep { id: string; phase: "leer" | "advance" | "touch"; until: number; touchedAt?: number }

/** Is this man fair game right now: he's come at you and laid hands on you (or is about to)? */
export function isCreep(w: World, t: Actor): boolean {
  const c = w.state.stadium!.creep;
  return !!c && c.id === t.id && (c.phase === "touch" || c.phase === "advance") && c.until > w.state.tick;
}

export function stepCreeps(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, r = s.rng.world, pc = s.actors[st.pc];
  if (!pc || tick % 30 !== 0) return;
  const c = st.creep;
  if (c) {
    const a = s.actors[c.id];
    const gone = !a || a.dead || a.downUntil > tick || a.hiddenIn || !inDrag(w, pc) || pc.hiddenIn || pc.heldBy;
    if (gone || tick > c.until) {
      if (a && !gone && c.phase !== "leer") say(w, a, GIVE_UP, 2.5);
      if (a?.npc) a.npc.plan = [];
      st.creep = undefined;
      st.flags.creepNext = tick + 60 * (20 + Math.floor(r.a % 20));
      return;
    }
    if (c.phase === "leer") return;
    const d = Math.hypot(a.x - pc.x, a.y - pc.y);
    if (d > 10) { c.until = tick; return; }
    // Coming over, then hanging on to you.
    a.npc!.plan = d > 1.1 ? [{ k: "go", x: pc.x, y: pc.y, run: false }] : [];
    a.facing = Math.atan2(pc.y - a.y, pc.x - a.x);
    if (d <= 1.3 && (c.phase === "advance" || (tick - (c.touchedAt ?? 0) > 60 * 4))) {
      c.phase = "touch"; c.touchedAt = tick; c.until = Math.max(c.until, tick + 60 * 8);
      say(w, a, pick(r, HANDSY), 2.5);
      w.bus.emit({ type: "groped", t: tick, by: a.id, who: pc.id, x: pc.x, y: pc.y });
    }
    return;
  }
  if (!inDrag(w, pc) || pc.seated || pc.hiddenIn || pc.heldBy || pc.roof || tick < (st.flags.creepNext ?? 60 * 20)) return;
  if (!chance(r, 0.12)) return;
  const men = Object.values(s.actors).filter((a) => a.npc && (a.npc.job === "fan" || a.npc.job === "local") && !isWoman(a) && !a.dead && a.downUntil <= tick
    && !a.seated && !a.hiddenIn && a.npc.mode === "routine" && Math.hypot(a.x - pc.x, a.y - pc.y) < 11 && Math.hypot(a.x - pc.x, a.y - pc.y) > 1.5 && canSee(w, a, pc, 11));
  if (!men.length) return;
  const a = pick(r, men);
  a.facing = Math.atan2(pc.y - a.y, pc.x - a.x);
  say(w, a, pick(r, LEERS), 3);
  const advance = chance(r, 0.45);
  st.creep = { id: a.id, phase: advance ? "advance" : "leer", until: tick + 60 * (advance ? 14 : 3) };
  w.bus.emit({ type: "leered", t: tick, by: a.id, who: pc.id, advance });
  if (!advance) st.flags.creepNext = tick + 60 * (12 + Math.floor(r.a % 12));
}

/** He's flattened the man who had his hands on him. Nobody's calling it assault. */
export function selfDefence(w: World, by: Actor, creep: Actor): void {
  const s = w.state, st = s.stadium!, tick = s.tick, r = s.rng.world;
  st.creep = undefined;
  st.flags.creepNext = tick + 60 * 25;
  // Somebody close says so: a woman if there's one about, else a steward or a bloke.
  const near = Object.values(s.actors).filter((a) => a.npc && a.id !== creep.id && !a.dead && a.downUntil <= tick && Math.hypot(a.x - by.x, a.y - by.y) < 12 && canSee(w, a, by, 12));
  const woman = near.find((a) => isWoman(a)), other = near.find((a) => isSecurity(a)) ?? near.find((a) => !isWoman(a) && (a.npc!.job === "fan" || a.npc!.job === "local"));
  if (woman) say(w, woman, CHEER_F, 3);
  else if (other) say(w, other, CHEER_M, 3);
  for (const g of near) if (isSecurity(g) && g.npc!.target === by.id && g.npc!.crime <= 2) { g.npc!.sus[by.id] = 0; }
  w.bus.emit({ type: "self_defence", t: tick, by: by.id, who: creep.id, x: creep.x, y: creep.y });
  void chance; void r;
}

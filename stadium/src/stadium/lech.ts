// Grozz has a mouth on him. Shout something at a woman and she gives it back: tells him where to go,
// slaps him, or (if her fella's about) her fella comes over to sort him out. Stewards don't like it.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { chance, pick } from "../core/rng";
import { registerVerb } from "../core/verbs";
import { say } from "./npc";
import { crime } from "./security";

export const isWoman = (a: Actor) => !!a.female || a.name === "Barmaid";

export function installLech(): void {
  registerVerb("lech", {
    check: (w, act, actor) => {
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      if (!t?.npc || !isWoman(t) || t.dead || t.downUntil > w.state.tick || t.hiddenIn) return "nobody to leer at";
      return Math.hypot(t.x - actor.x, t.y - actor.y) < 5 ? null : "too far away";
    },
    perform: (w, act, actor) => {
      const s = w.state, t = s.actors[(act.target as { id: string }).id], r = s.rng.world, tick = s.tick;
      w.bus.emit({ type: "lech", t: tick, by: actor.id, who: t.id });
      t.facing = Math.atan2(actor.y - t.y, actor.x - t.x);
      // Her fella, if he's close: he's coming over.
      const fella = Object.values(s.actors).find((o) => o.npc && !o.female && (o.npc.job === "fan" || o.npc.job === "local") && !o.dead && o.downUntil <= tick
        && Math.hypot(o.x - t.x, o.y - t.y) < 4 && o.npc.team === t.npc!.team);
      const near = Math.hypot(t.x - actor.x, t.y - actor.y) < 1.8;
      if (fella && chance(r, 0.6)) {
        say(w, t, "Oi! My fella's gonna batter you!", 2.5);
        fella.npc!.retaliateAt = tick + 40; fella.npc!.retaliateOn = actor.id;
        fella.npc!.plan = [{ k: "go", x: actor.x, y: actor.y, run: true }];
      } else if (near && chance(r, 0.4)) {
        // A slap: it stings, he staggers.
        actor.downUntil = Math.max(actor.downUntil, tick + 25);
        w.bus.emit({ type: "slapped", t: tick, by: t.id, who: actor.id, x: actor.x, y: actor.y });
        say(w, t, pick(r, ["Piss off, you fat creep!", "Touch me and I'll have your bollocks off."]), 2.5);
      } else say(w, t, pick(r, ["Piss off, you fat creep!", "In your dreams, baldy.", "Ew. Get away from me.", "Touch me and I'll have your bollocks off."]), 2.5);
      // Only staff care, and only a little.
      crime(w, actor, "lewd comments", 1, undefined, false);
    },
  });
}

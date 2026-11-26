// The police horse. Drag the officer off it, climb on, and gallop: anyone in front goes flying,
// low walls (barriers, counters, turnstiles) get jumped, and the pitch is right there.
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { BOUNDS, SOLID } from "./layout";
import { knockOut } from "./combat";
import { say } from "./npc";
import { crime } from "./security";

export interface Horse { x: number; y: number; facing: number; speed: number; rider: string | null; officer: string }

const WALK = 7, GALLOP = 16, R = 0.85;

export const mountedOfficer = (w: World): Actor | undefined => Object.values(w.state.actors).find((a) => a.npc?.mounted && !a.dead);
export const horseNear = (w: World, a: Actor, r = 2.4): boolean => { const h = w.state.stadium!.horse; return !!h && !h.rider && Math.hypot(h.x - a.x, h.y - a.y) < r; };
export const riding = (w: World, a: Actor): boolean => w.state.stadium!.horse?.rider === a.id;

export function installHorse(): void {
  registerVerb("unseat", {
    // Pull the officer off his horse.
    check: (w, _act, actor) => {
      const o = mountedOfficer(w);
      return o && o.downUntil <= w.state.tick && Math.hypot(o.x - actor.x, o.y - actor.y) < 2.4 ? null : "no rider in reach";
    },
    perform: (w, _act, actor) => {
      const s = w.state, o = mountedOfficer(w)!;
      o.npc!.mounted = false;
      s.stadium!.horse = { x: o.x, y: o.y, facing: o.facing, speed: 0, rider: null, officer: o.id };
      // He comes off sideways and hits the deck hard.
      o.x += Math.cos(o.facing + Math.PI / 2) * 1.2; o.y += Math.sin(o.facing + Math.PI / 2) * 1.2;
      o.downUntil = s.tick + 60 * 6;
      w.bus.emit({ type: "unseated", t: s.tick, who: o.id, by: actor.id, x: o.x, y: o.y });
      crime(w, actor, "pulling a police officer off his horse", 3, o);
    },
  });
  registerVerb("mount", {
    check: (w, _act, actor) => (horseNear(w, actor) && !actor.dragging ? null : "no horse here"),
    perform: (w, _act, actor) => {
      const h = w.state.stadium!.horse!;
      h.rider = actor.id;
      actor.x = h.x; actor.y = h.y;
      w.bus.emit({ type: "mounted", t: w.state.tick, by: actor.id });
      if (actor.id === w.state.stadium!.pc) crime(w, actor, "stealing a police horse", 3);
    },
  });
  registerVerb("dismount", {
    check: (w, _act, actor) => (riding(w, actor) ? null : "not on a horse"),
    perform: (w, _act, actor) => {
      const h = w.state.stadium!.horse!;
      h.rider = null; h.speed = 0;
      actor.x = h.x + Math.cos(h.facing + Math.PI / 2) * 1.1; actor.y = h.y + Math.sin(h.facing + Math.PI / 2) * 1.1;
      w.bus.emit({ type: "dismounted", t: w.state.tick, by: actor.id });
    },
  });
}

/** Read the rider's stick before the world moves people (the rider doesn't walk). */
export function takeReins(w: World): { mx: number; my: number } | null {
  const h = w.state.stadium!.horse;
  if (!h?.rider) return null;
  const r = w.state.actors[h.rider];
  if (!r || r.downUntil > w.state.tick) { if (h) h.rider = null; return null; }
  const out = { mx: r.moveX, my: r.moveY };
  r.moveX = 0; r.moveY = 0;
  return out;
}

export function stepHorse(w: World, reins: { mx: number; my: number } | null): void {
  const s = w.state, st = s.stadium!, h = st.horse, tick = s.tick, dt = 1 / 60;
  if (!h) return;
  if (h.rider && reins) {
    const m = Math.hypot(reins.mx, reins.my);
    const want = m < 0.1 ? 0 : m > 0.6 ? GALLOP : WALK;
    h.speed += Math.max(-14 * dt, Math.min((want > h.speed ? 11 : 14) * dt, want - h.speed));
    if (m > 0.1) {
      const a = Math.atan2(reins.my, reins.mx);
      let d = a - h.facing; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      h.facing += Math.max(-6 * dt, Math.min(6 * dt, d));
    }
  } else {
    h.speed = Math.max(0, h.speed - 10 * dt);
    // Left alone, the officer gets back up and back on.
    const o = s.actors[h.officer];
    if (o && !o.dead && o.downUntil <= tick && !o.heldBy && Math.hypot(o.x - h.x, o.y - h.y) < 1.6 && !(o.effects.ko && o.effects.ko > tick)) {
      o.npc!.mounted = true; o.x = h.x; o.y = h.y; st.horse = undefined;
      w.bus.emit({ type: "remounted", t: tick, who: o.id });
      return;
    }
  }
  const nx = h.x + Math.cos(h.facing) * h.speed * dt, ny = h.y + Math.sin(h.facing) * h.speed * dt;
  // Walls stop it, unless they're low enough to jump.
  const blocked = SOLID.some((wl) => wl.h3 > 1.3 && nx + R > wl.x && nx - R < wl.x + wl.w && ny + R > wl.y && ny - R < wl.y + wl.h);
  if (blocked) h.speed *= -0.2; else { h.x = nx; h.y = ny; }
  if (h.speed > 1 && (tick % 30 === 0) && SOLID.some((wl) => wl.h3 <= 1.3 && Math.hypot(wl.x + wl.w / 2 - h.x, wl.y + wl.h / 2 - h.y) < 1.5)) w.bus.emit({ type: "horse_jump", t: tick, x: h.x, y: h.y });
  h.x = Math.max(BOUNDS.x + 1, Math.min(BOUNDS.x + BOUNDS.w - 1, h.x));
  h.y = Math.max(BOUNDS.y + 1, Math.min(BOUNDS.y + BOUNDS.h - 1, h.y));
  if (h.rider) {
    const r = s.actors[h.rider];
    r.x = h.x; r.y = h.y; r.facing = h.facing;
    r.vx = Math.cos(h.facing) * h.speed; r.vy = Math.sin(h.facing) * h.speed;
    // Trampling: whoever is in front at speed goes down; at a gallop they stay down.
    if (h.speed > 3) {
      for (const id in s.actors) {
        const a = s.actors[id];
        if (a === r || a.hiddenIn || a.seated || a.dead || a.downUntil > tick || a.npc?.mounted) continue;
        const dx = a.x - h.x, dy = a.y - h.y, ahead = dx * Math.cos(h.facing) + dy * Math.sin(h.facing), side = Math.abs(-dx * Math.sin(h.facing) + dy * Math.cos(h.facing));
        if (ahead < -0.3 || ahead > 1.4 || side > 0.9) continue;
        const l = Math.hypot(dx, dy) || 1;
        a.knock = { vx: (dx / l) * 12 + Math.cos(h.facing) * h.speed, vy: (dy / l) * 12 + Math.sin(h.facing) * h.speed, from: tick, until: tick + 26 };
        w.bus.emit({ type: "struck", t: tick, by: r.id, who: a.id, weapon: true, dx: dx / l, dy: dy / l, horse: true });
        if (h.speed > 7) knockOut(w, a, r, false); else a.downUntil = tick + 90;
        if (a.npc && h.speed <= 7) say(w, a, "Jesus! The horse!", 2);
        if (a.fb && a.fb.status === "playing") a.fb.stunUntil = tick + 400;
        if (tick % 4 === 0) crime(w, r, "trampling people with a police horse", 3, a);
      }
    }
  }
}

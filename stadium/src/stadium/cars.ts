// Cars. Kick one (a parked one goes off: alarm, and the stewards look over), or, when one's stopped
// in the ring-road traffic (someone's stood in front of it), drag the driver out and have it. Drive it
// GTA-style: walls stop you with a crunch, people go under it. Get out and leave it where it is.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { pick } from "../core/rng";
import { registerVerb } from "../core/verbs";
import { areaAt, SOLID, VENUE } from "./layout";
import { say, spawnStaff } from "./npc";
import { crime, isSecurity } from "./security";
import { knockOut } from "./combat";

export interface MyCar { kind: string; x: number; y: number; facing: number; speed: number; driving: boolean; damage: number }
const DT = 1 / 60, MAX = 17, R = 1.1;

/** Parked cars (furniture) and traffic cars near a point: what you could kick. */
export function carsNear(w: World, x: number, y: number, r: number): { id: string; x: number; y: number; moving: boolean; traffic: boolean }[] {
  const st = w.state.stadium!, out: { id: string; x: number; y: number; moving: boolean; traffic: boolean }[] = [];
  for (const c of st.traffic ?? []) if (Math.hypot(c.x - x, c.y - y) < r) out.push({ id: c.id, x: c.x, y: c.y, moving: c.speed > 1.5, traffic: true });
  for (const f of VENUE.furniture) if (f.key === "parkedcar" && Math.hypot(f.x - x, f.y - y) < r) out.push({ id: `parked@${f.x},${f.y}`, x: f.x, y: f.y, moving: false, traffic: false });
  const m = st.myCar;
  if (m && !m.driving && Math.hypot(m.x - x, m.y - y) < r) out.push({ id: "mine", x: m.x, y: m.y, moving: false, traffic: false });
  return out.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}

export function installCars(): void {
  registerVerb("kickcar", {
    check: (w, act, actor) => (actor.hiddenIn || actor.heldBy ? "not now" : carsNear(w, actor.x, actor.y, 2.6).some((c) => c.id === act.arg) ? null : "no car here"),
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, c = carsNear(w, actor.x, actor.y, 2.6).find((k) => k.id === act.arg)!;
      actor.facing = Math.atan2(c.y - actor.y, c.x - actor.x);
      const alarm = !c.traffic;
      if (alarm) { st.flags.carAlarmUntil = s.tick + 60 * 8; st.flags.carAlarmX = c.x; st.flags.carAlarmY = c.y; }
      w.bus.emit({ type: "car_kicked", t: s.tick, by: actor.id, x: c.x, y: c.y, alarm, traffic: c.traffic });
      // The alarm turns heads: stewards close by come and look.
      if (alarm) for (const g of Object.values(s.actors)) {
        if (!isSecurity(g) || g.downUntil > s.tick || Math.hypot(g.x - c.x, g.y - c.y) > 22 || g.npc!.mode !== "routine") continue;
        g.npc!.gawk = { x: c.x, y: c.y, until: s.tick + 60 * 6, filming: false };
        g.npc!.plan = [{ k: "go", x: c.x + 1.5, y: c.y + 1.5 }, { k: "wait", s: 4 }];
      }
      crime(w, actor, "kicking a car", 1, undefined, true);
    },
  });
  registerVerb("carjack", {
    check: (w, act, actor) => {
      if (actor.hiddenIn || actor.heldBy || actor.bike || w.state.stadium!.myCar?.driving) return "not now";
      const c = (w.state.stadium!.traffic ?? []).find((k) => k.id === act.arg);
      if (!c) return "no car";
      if (c.speed > 1.5) return "it's moving";
      return Math.hypot(c.x - actor.x, c.y - actor.y) < 2.8 ? null : "too far";
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, c = st.traffic!.find((k) => k.id === act.arg)!;
      st.traffic = st.traffic!.filter((k) => k !== c);
      // The driver, dragged out onto the road.
      const side = c.dir === 1 ? -1 : 1;
      const drv = spawnStaff(w, "local", "fan", c.kind === "taxi" ? "Cabbie" : c.kind === "policecar" ? "PC Dobbs" : pick(s.rng.world, ["Driver", "Bloke in a Fiesta", "Motorist"]), c.x, c.y + side * 1.4);
      drv.npc!.post = undefined;
      drv.downUntil = s.tick + 90; drv.facing = Math.atan2(actor.y - drv.y, actor.x - drv.x);
      drv.npc!.retaliateAt = s.tick + 100; drv.npc!.retaliateOn = actor.id;
      say(w, drv, c.kind === "taxi" ? "Oi! That's my cab, you fat bastard!" : "OI! THAT'S MY CAR!", 3);
      st.myCar = { kind: c.kind, x: c.x, y: c.y, facing: c.dir === 1 ? 0 : Math.PI, speed: 0, driving: true, damage: 0 };
      enter(w, actor);
      w.bus.emit({ type: "carjacked", t: s.tick, by: actor.id, kind: c.kind, x: c.x, y: c.y });
      crime(w, actor, c.kind === "policecar" ? "stealing a police car" : "carjacking", c.kind === "policecar" ? 3 : 2, drv);
    },
  });
  registerVerb("getincar", {
    check: (w, act, actor) => { const m = w.state.stadium!.myCar; return m && !m.driving && !actor.hiddenIn && Math.hypot(m.x - actor.x, m.y - actor.y) < 2.8 ? null : "no car"; },
    perform: (w, act, actor) => { w.state.stadium!.myCar!.driving = true; enter(w, actor); },
  });
  registerVerb("getoutcar", {
    check: (w, act, actor) => (w.state.stadium!.myCar?.driving && actor.hiddenIn === "car" ? null : "not driving"),
    perform: (w, act, actor) => getOut(w, actor),
  });
}

function enter(w: World, a: Actor): void {
  const m = w.state.stadium!.myCar!;
  a.hiddenIn = "car"; a.x = m.x; a.y = m.y; a.moveX = a.moveY = 0; a.dragging = undefined;
  w.bus.emit({ type: "car_in", t: w.state.tick, who: a.id });
}

export function getOut(w: World, a: Actor): void {
  const m = w.state.stadium!.myCar!;
  m.driving = false; m.speed = 0;
  a.hiddenIn = undefined;
  // Out of the driver's door, onto whichever side is clear.
  const sx = -Math.sin(m.facing), sy = Math.cos(m.facing);
  a.x = m.x + sx * 1.6; a.y = m.y + sy * 1.6;
  w.bus.emit({ type: "car_out", t: w.state.tick, who: a.id });
}

/** Driving: steer at the stick, push for throttle. Walls stop you; people go under the wheels. */
export function driveCar(w: World, pc: Actor): void {
  const s = w.state, st = s.stadium!, m = st.myCar;
  if (!m?.driving || pc.hiddenIn !== "car") return;
  const ix = pc.moveX, iy = pc.moveY, mag = Math.min(1, Math.hypot(ix, iy));
  if (mag > 0.15) {
    let diff = Math.atan2(iy, ix) - m.facing;
    while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > 2.4) m.speed = Math.max(-5, m.speed - 12 * DT);
    else {
      m.facing += Math.max(-1, Math.min(1, diff)) * Math.min(3.2, 0.6 + Math.abs(m.speed) * 0.25) * DT * Math.sign(m.speed || 1);
      m.speed = Math.min(MAX, m.speed + 10 * mag * DT);
    }
  } else m.speed *= 1 - 1.8 * DT;
  const nx = m.x + Math.cos(m.facing) * m.speed * DT, ny = m.y + Math.sin(m.facing) * m.speed * DT;
  const hit = SOLID.find((wl) => nx + R > wl.x && nx - R < wl.x + wl.w && ny + R * 0.6 > wl.y && ny - R * 0.6 < wl.y + wl.h);
  if (hit) {
    if (Math.abs(m.speed) > 5) { m.damage++; w.bus.emit({ type: "car_crash", t: s.tick, x: nx, y: ny, hard: Math.abs(m.speed) > 11 }); }
    m.speed = -m.speed * 0.25;
  } else { m.x = nx; m.y = ny; }
  pc.x = m.x; pc.y = m.y; pc.facing = m.facing; pc.vx = Math.cos(m.facing) * m.speed; pc.vy = Math.sin(m.facing) * m.speed;
  // Anyone in front at speed goes down; fast enough, they don't get up for a while.
  if (Math.abs(m.speed) > 3) for (const a of Object.values(s.actors)) {
    if (a === pc || a.hiddenIn || a.dead || a.seated || a.downUntil > s.tick + 30) continue;
    const dx = a.x - m.x, dy = a.y - m.y;
    const along = dx * Math.cos(m.facing) + dy * Math.sin(m.facing), across = -dx * Math.sin(m.facing) + dy * Math.cos(m.facing);
    if (along < -1.6 || along > 2.3 || Math.abs(across) > 1.1) continue;
    const sp = Math.abs(m.speed);
    a.knock = { vx: Math.cos(m.facing) * sp * 1.1 + (across > 0 ? 1 : -1) * -Math.sin(m.facing) * 6, vy: Math.sin(m.facing) * sp * 1.1 + (across > 0 ? 1 : -1) * Math.cos(m.facing) * 6, from: s.tick, until: s.tick + 30 };
    if (sp > 10) knockOut(w, a, pc, false); else a.downUntil = s.tick + 120;
    m.speed *= 0.85;
    w.bus.emit({ type: "car_hit", t: s.tick, who: a.id, x: a.x, y: a.y, hard: sp > 10 });
    crime(w, pc, "running someone over", sp > 10 ? 3 : 2, a);
  }
  void areaAt;
}

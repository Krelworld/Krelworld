// The opposition's team bus: parked at the hotel, boards before kick-off, drives
// up the service road and through the gate to the loading bay. It can be hidden
// in, tampered with, or stolen and driven.
import { appearance } from "../core/identity";
import { hasProp, moveItem, spawnItem } from "../core/items";
import { chance, rndRange } from "../core/rng";
import { DT, type Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { removePlayer } from "../football/api";
import { areaAt, breakable, KICKOFF_AT, SOLID, SPOTS, VENUE, type Wall } from "./layout";
import { raiseSecurity } from "./kickoff";
import { mayPass, newNpc, say } from "./npc";
import { canSee, crime } from "./security";
import type { Vehicle } from "./state";

export const BUS_LEN = 11, BUS_WID = 2.8;
export const DEPART_BEFORE_KICKOFF = 200; // seconds

const fwd = (v: Vehicle) => ({ x: Math.cos(v.facing), y: Math.sin(v.facing) });
/** Where the door is: front, on the left-hand side. */
export const busDoor = (v: Vehicle) => {
  const f = fwd(v), side = { x: f.y, y: -f.x };
  return { x: v.x + f.x * (BUS_LEN / 2 - 1.6) + side.x * (BUS_WID / 2 + 0.8), y: v.y + f.y * (BUS_LEN / 2 - 1.6) + side.y * (BUS_WID / 2 + 0.8) };
};
export const busRear = (v: Vehicle) => { const f = fwd(v); return { x: v.x - f.x * (BUS_LEN / 2 + 0.7), y: v.y - f.y * (BUS_LEN / 2 + 0.7) }; };
export const holdOpen = (v: Vehicle) => !v.drivenBy && (v.state === "parked" || v.state === "loading" || v.state === "unloading");

export function createBus(w: World, team: string): Vehicle {
  const s = w.state, st = s.stadium!;
  const [x, y] = VENUE.busRoute;
  const hold = spawnItem(s, "bus_hold", { k: "ground", x, y });
  const cab = spawnItem(s, "bus_cab", { k: "ground", x, y });
  const driver = spawnActorNear(w, x + 3, y + 2);
  const v: Vehicle = {
    id: "bus", kind: "bus", x, y, facing: Math.atan2(VENUE.busRoute[3] - y, VENUE.busRoute[2] - x), route: VENUE.busRoute.slice(), ri: 2, speed: 0,
    state: "parked", until: 60 * (KICKOFF_AT - DEPART_BEFORE_KICKOFF), cargo: hold.id, driver: driver.id, cycle: 0, inspected: false, team, cab: cab.id,
  };
  st.vehicles.bus = v;
  return v;
}

function spawnActorNear(w: World, x: number, y: number): Actor {
  const s = w.state;
  const id = `a${s.nextId++}`;
  const a: Actor = {
    id, kind: "npc", name: "Bus driver", faceId: id, x, y, vx: 0, vy: 0, facing: Math.PI, radius: 0.4, speed: 1.5,
    moveX: 0, moveY: 0, hand: null, pockets: [], worn: {}, money: 20, downUntil: 0, effects: {},
    npc: newNpc("driver", "catering", { post: { x, y }, lines: ["Mind the paintwork.", "Team bus. Not a taxi."] }),
  };
  s.actors[id] = a;
  return a;
}

/** Everyone aboard (or hidden in the hold) moves with the bus. */
function carry(w: World, v: Vehicle): void {
  const s = w.state, rear = busRear(v);
  moveItem(s, v.cargo, { k: "ground", x: rear.x, y: rear.y });
  if (v.cab) moveItem(s, v.cab, { k: "ground", x: v.x, y: v.y });
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.hiddenIn === v.cargo || a.hiddenIn === v.cab) { a.x = v.x; a.y = v.y; a.vx = a.vy = 0; if (a.fb) { a.fb.tx = a.x; a.fb.ty = a.y; } }
  }
}

const passengers = (w: World, v: Vehicle) => Object.values(w.state.actors).filter((a) => a.hiddenIn === v.cab);

function letOff(w: World, v: Vehicle, scatter = 1.2): void {
  const door = busDoor(v), r = w.state.rng.world;
  for (const a of passengers(w, v)) {
    if (a.id === v.drivenBy) continue;
    a.hiddenIn = undefined;
    a.x = door.x + rndRange(r, -scatter, scatter); a.y = door.y + rndRange(r, -scatter, scatter);
    if (a.fb) { a.fb.tx = a.x; a.fb.ty = a.y; }
  }
}

export function stepBus(w: World, v: Vehicle): void {
  const s = w.state, st = s.stadium!, tick = s.tick, m = s.match!;
  const driver = s.actors[v.driver];
  if (v.drivenBy) { carry(w, v); return; }
  switch (v.state) {
    case "parked":
      // The driver loads the bags while the team finish breakfast.
      if (driver && !driver.hiddenIn && driver.npc && !driver.npc.plan.length) { const r = busRear(v); driver.npc.plan.push({ k: "go", x: r.x + 0.5, y: r.y + 1 }, { k: "wait", s: 6 }, { k: "go", ...busDoor(v) }, { k: "wait", s: 5 }); }
      if (tick >= v.until) { v.state = "loading"; v.until = tick + 60 * 40; st.flags.boarding = 1; if (driver) say(w, driver, "Right, lads. On the bus."); }
      break;
    case "loading": {
      // Boarding: the squad walk to the door and climb on (see the team walk).
      const squad = m.teams[1].squad.map((id) => s.actors[id]).filter((a) => a.fb!.status !== "gone");
      const aboard = squad.filter((a) => a.hiddenIn === v.cab).length;
      if (driver && !driver.hiddenIn && driver.npc) { driver.npc.plan = [{ k: "go", ...busDoor(v) }]; if (Math.hypot(driver.x - busDoor(v).x, driver.y - busDoor(v).y) < 1.5) driver.hiddenIn = v.cab; }
      if ((aboard >= squad.length || tick >= v.until) && driver?.hiddenIn === v.cab) {
        v.state = "driving"; v.ri = 2; st.flags.boarding = 0;
        w.bus.emit({ type: "bus_departs", t: tick, team: v.team });
      }
      break;
    }
    case "driving": {
      const tx = v.route[v.ri], ty = v.route[v.ri + 1];
      const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
      let want = d < 6 ? 3 : 8;
      if (blockedAhead(w, v)) {
        v.blocked = (v.blocked ?? 0) + 1;
        want = v.blocked > 180 ? 1 : 0;
        if (v.blocked % 120 === 1 && driver) say(w, driver, "Out the way!");
        if (v.blocked > 180) nudge(w, v);
      } else v.blocked = 0;
      v.speed += Math.sign(want - v.speed) * Math.min(Math.abs(want - v.speed), 5 * DT);
      // Tampered brakes give out on the hill down to the gate.
      if (v.tampered && !v.crashed && v.ri >= 4 && v.speed > 5) { crash(w, v); break; }
      if (Math.abs(v.x - SPOTS.serviceGate.x) < 10 && Math.abs(v.y - SPOTS.serviceGate.y) < 4) st.gates.servicegate = { until: tick + 60 * 6, for: null };
      if (d < 0.4) {
        v.ri += 2;
        if (v.ri >= v.route.length) { v.state = "unloading"; v.until = tick + 60 * 6; v.speed = 0; letOff(w, v); st.flags.busArrived = 1; w.bus.emit({ type: "bus_arrives", t: tick, team: v.team }); }
        break;
      }
      const step = Math.min(d, v.speed * DT);
      v.x += (dx / d) * step; v.y += (dy / d) * step;
      v.facing = Math.atan2(dy, dx);
      runOver(w, v, null);
      break;
    }
    case "unloading":
      if (tick >= v.until) {
        v.state = "parked";
        v.until = Number.MAX_SAFE_INTEGER;
        // The driver goes for a cup of tea and leaves the bus where it is.
        if (driver) { driver.hiddenIn = undefined; const dr = busDoor(v); driver.x = dr.x; driver.y = dr.y; driver.npc!.plan = [{ k: "go", ...SPOTS.kitchenSpot }, { k: "wait", s: 3600 }]; driver.npc!.post = SPOTS.kitchenSpot; }
      }
      break;
  }
  carry(w, v);
}

/** Creeping forward, people get pushed aside rather than run down. */
function nudge(w: World, v: Vehicle): void {
  const s = w.state, f = fwd(v);
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.hiddenIn || a.fb || a.off) continue;
    const ax = a.x - v.x, ay = a.y - v.y, along = ax * f.x + ay * f.y, across = -ax * f.y + ay * f.x;
    if (along > 0 && along < BUS_LEN / 2 + 1.5 && Math.abs(across) < BUS_WID / 2 + 0.7) { a.x += -f.y * Math.sign(across || 1) * 0.1; a.y += f.x * Math.sign(across || 1) * 0.1; }
  }
}

function blockedAhead(w: World, v: Vehicle): boolean {
  const s = w.state, f = fwd(v);
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.hiddenIn || a.fb || a.off) continue;
    const ax = a.x - v.x, ay = a.y - v.y, along = ax * f.x + ay * f.y, across = Math.abs(-ax * f.y + ay * f.x);
    if (along > BUS_LEN / 2 && along < BUS_LEN / 2 + 7 && across < BUS_WID / 2 + 0.6) return true;
  }
  return false;
}

/** The bus crashes: the squad are thrown about, some badly hurt, everybody late. */
function crash(w: World, v: Vehicle, wall = false): void {
  const s = w.state, st = s.stadium!, m = s.match!, r = s.rng.world;
  v.crashed = true; v.state = "unloading"; v.until = Number.MAX_SAFE_INTEGER; v.speed = 0;
  st.smoke.push({ x: v.x, y: v.y, r: 4, until: s.tick + 60 * 30 });
  const hurt: string[] = [];
  const aboard = passengers(w, v).filter((a) => a.fb).length;
  for (const a of passengers(w, v)) {
    if (!a.fb) continue;
    if (chance(r, 0.4)) {
      hurt.push(a.name);
      if (a.fb.status === "playing") removePlayer(w, a.id, "injured");
      else { a.fb.status = "gone"; a.fb.goneReason = "injured"; }
    } else a.fb.fatigue = Math.min(1, a.fb.fatigue + 0.35);
  }
  letOff(w, v, 2.5);
  const driver = s.actors[v.driver];
  if (driver && driver.hiddenIn === v.cab) { driver.hiddenIn = undefined; driver.downUntil = s.tick + 60 * 120; }
  if (!wall) st.flags.busCrash = 1;
  if (aboard) st.flags.teamShaken = 1;
  w.bus.emit({ type: "bus_crash", t: s.tick, team: v.team, hurt, wall });
  // Was anyone seen at the bus? The tampering may yet be traced.
  const by = st.flags.busTamperedBy ? s.actors["pc"] : undefined;
  if (by && st.flags.busTamperSeen) crime(w, by, "tampering with the team bus", 3);
}

// ---------- Beep Beep: the horn and the dive (after Krelworld's BeepBeepScene) ----------
/** Everyone in front freezes like a rabbit in the headlights, so they can't dive out of the way. */
export function honk(w: World, v: Vehicle, by: Actor): void {
  const s = w.state, st = s.stadium!, f = fwd(v);
  st.flags.hornReady = s.tick + 150;
  for (const id in s.actors) {
    const a = s.actors[id];
    if (!a.npc || a.hiddenIn || a.dead || a.npc.job === "dog") continue;
    const ax = a.x - v.x, ay = a.y - v.y, along = ax * f.x + ay * f.y, across = Math.abs(-ax * f.y + ay * f.x);
    if (along < 0 || along > 30 || across > 7) continue;
    a.effects.frozen = s.tick + 100;
    if (st.dives?.[a.id]) delete st.dives[a.id];
  }
  w.bus.emit({ type: "horn", t: s.tick, by: by.id, x: v.x, y: v.y });
}

/** Seen coming, people decide once: dive for the gutter, or stand there (brave, or on their phone). */
function dodgers(w: World, v: Vehicle): void {
  const s = w.state, st = s.stadium!, tick = s.tick, f = fwd(v), r = s.rng.world;
  st.dives ??= {};
  for (const id in st.dives) {
    const d = st.dives[id], a = s.actors[id];
    if (!a || a.dead) { delete st.dives[id]; continue; }
    const dx = d.x - a.x, dy = d.y - a.y, l = Math.hypot(dx, dy);
    if (l < 0.15 || tick > d.until) {
      // Lying in the gutter, feeling clever.
      delete st.dives[id];
      a.downUntil = Math.max(a.downUntil, tick + 100);
      w.bus.emit({ type: "dodged", t: tick, who: id });
      continue;
    }
    const step = Math.min(l, 4.2 * DT);
    a.x += (dx / l) * step; a.y += (dy / l) * step; a.facing = Math.atan2(dy, dx);
  }
  if (v.speed < 3) return;
  const reach = BUS_LEN / 2 + 4 + v.speed * 0.6;
  for (const id in s.actors) {
    const a = s.actors[id];
    if (!a.npc || a.hiddenIn || a.dead || a.seated || a.fb || a.off || a.npc.job === "dog" || a.downUntil > tick || st.dives[id]) continue;
    if ((a.effects.frozen ?? 0) > tick || (a.effects.dodgeCheck ?? 0) > tick) continue;
    const ax = a.x - v.x, ay = a.y - v.y, along = ax * f.x + ay * f.y, across = -ax * f.y + ay * f.x;
    if (along < BUS_LEN / 2 || along > reach || Math.abs(across) > BUS_WID / 2 + 0.8) continue;
    a.effects.dodgeCheck = tick + 180;
    const dodgy = a.npc.job === "fan" || a.npc.job === "local" ? 0.55 : 0.4;
    if (!chance(r, dodgy)) continue;
    let side = across >= 0 ? 1 : -1;
    const tx = a.x + -f.y * side * (BUS_WID / 2 + 1.6 - Math.abs(across)), ty = a.y + f.x * side * (BUS_WID / 2 + 1.6 - Math.abs(across));
    void side;
    st.dives[id] = { x: tx, y: ty, until: tick + 45 };
    a.npc.plan = [{ k: "wait", s: 3 }]; a.npc.goal = null;
    say(w, a, "!", 0.8);
    w.bus.emit({ type: "dive", t: tick, who: id });
  }
}

/** Anyone in the way gets knocked down; at speed, badly. */
function runOver(w: World, v: Vehicle, by: Actor | null): void {
  if (v.speed < 1.5) return;
  const s = w.state, f = fwd(v);
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.hiddenIn || a.downUntil > s.tick || a.id === by?.id) continue;
    const ax = a.x - v.x, ay = a.y - v.y, along = ax * f.x + ay * f.y, across = -ax * f.y + ay * f.x;
    if (Math.abs(along) > BUS_LEN / 2 + 0.3 || Math.abs(across) > BUS_WID / 2 + 0.3) continue;
    const hard = v.speed > 6;
    a.downUntil = s.tick + (hard ? 60 * 60 : 150);
    a.x += -f.y * Math.sign(across || 1) * 2; a.y += f.x * Math.sign(across || 1) * 2;
    if (a.fb && hard && a.fb.status === "playing") removePlayer(w, a.id, "injured");
    if (a.fb) a.fb.stunUntil = s.tick + 200;
    const dodger = !!s.stadium!.dives?.[a.id];
    if (dodger) delete s.stadium!.dives![a.id];
    w.bus.emit({ type: "bus_hit", t: s.tick, who: a.id, hard, by: by?.id, dodger });
    if (by) busCrime(w, v, by, hard ? "running people over with a team bus" : "driving a bus at people", hard ? 3 : 2);
  }
}

/** Crimes committed with the bus are blamed on whoever's bus it is, unless the driver is seen. */
function busCrime(w: World, v: Vehicle, by: Actor, what: string, severity: number): void {
  const s = w.state, st = s.stadium!;
  const seenDriver = Object.values(s.actors).some((a) => a.npc && a.npc.job !== "player" && canSee(w, a, { ...by, x: v.x, y: v.y, hiddenIn: undefined } as Actor, 4));
  const blamed = seenDriver ? appearance(s, by).team : v.team ?? null;
  st.incidents.push({ t: s.tick, what, by: by.id, blamed, severity, seenBy: 1 });
  w.bus.emit({ type: "incident", t: s.tick, what, by: by.id, blamed, severity, seen: 1 });
  if (blamed && blamed !== "ENG" && !st.flags.busSanctionAt) st.flags.busSanctionAt = s.tick + 60 * 15;
}

// ---------- The player at the wheel ----------
export function driveBus(w: World, v: Vehicle, pc: Actor): void {
  const s = w.state, st = s.stadium!;
  // Steer towards the stick; push further for more throttle; pull back to brake and reverse.
  const ix = pc.moveX, iy = pc.moveY, mag = Math.min(1, Math.hypot(ix, iy));
  const f = fwd(v);
  if (pc.drive) {
    // From the cab: wheel and pedals, relative to the bus.
    const { steer, throttle } = pc.drive;
    v.facing += steer * Math.min(1.3, 0.2 + Math.abs(v.speed) * 0.12) * DT * Math.sign(v.speed || 1);
    if (throttle > 0.05) v.speed = Math.min(13, v.speed + (v.speed < 0 ? 9 : 5) * throttle * DT);
    else if (throttle < -0.05) v.speed = v.speed > 0.3 ? Math.max(0, v.speed - 10 * -throttle * DT) : Math.max(-4, v.speed - 4 * -throttle * DT);
    else v.speed *= 1 - 0.7 * DT;
  } else if (mag > 0.15) {
    const want = Math.atan2(iy, ix);
    let diff = want - v.facing;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const backwards = Math.abs(diff) > 2.3;
    if (backwards) v.speed = Math.max(-4, v.speed - 8 * DT);
    else {
      v.facing += Math.max(-1, Math.min(1, diff)) * Math.min(1.4, 0.25 + Math.abs(v.speed) * 0.12) * DT * Math.sign(v.speed || 1);
      v.speed = Math.min(13, v.speed + 5 * mag * DT);
    }
  } else v.speed *= 1 - 1.5 * DT;
  const nx = v.x + Math.cos(v.facing) * v.speed * DT, ny = v.y + Math.sin(v.facing) * v.speed * DT;
  // Walls (and shut gates) stop a bus, with a crunch.
  const bump = busHitsWall(w, nx, ny, v.facing, pc);
  if (bump && v.speed > BREACH_SPEED && breakable(bump.wall)) { breach(w, v, pc, bump); return; }
  if (bump) {
    if (Math.abs(v.speed) > 6) { w.bus.emit({ type: "bus_wall", t: s.tick, x: nx, y: ny }); st.flags.busDamage = (st.flags.busDamage ?? 0) + 1; }
    v.speed = -v.speed * 0.25;
  } else { v.x = nx; v.y = ny; }
  v.state = "driving";
  dodgers(w, v);
  runOver(w, v, pc);
  // The gate guard waves a team bus through if the driver looks like he belongs to the team.
  if (Math.abs(v.x - SPOTS.serviceGate.x) < 12 && Math.abs(v.y - SPOTS.serviceGate.y) < 5 && !st.flags.gateRefused) {
    const ap = appearance(s, pc);
    if (ap.team === v.team || ap.role === "footballer") st.gates.servicegate = { until: s.tick + 60 * 4, for: null };
    else if (!(st.gates.servicegate && st.gates.servicegate.until > s.tick)) {
      st.flags.gateRefused = 1;
      const guard = Object.values(s.actors).find((a) => a.npc?.job === "gateguard");
      if (guard) { say(w, guard, "That's not the driver!"); crime(w, pc, "stealing the team bus", 2); }
    }
  }
  pc.x = v.x; pc.y = v.y; void f;
  carry(w, v);
}

function busHitsWall(w: World, x: number, y: number, facing: number, pc: Actor): { wall: Wall; x: number; y: number } | null {
  const c = Math.cos(facing), s = Math.sin(facing);
  for (const k of [0.42, 0, -0.42]) {
    const px = x + c * BUS_LEN * k, py = y + s * BUS_LEN * k, r = BUS_WID / 2;
    for (const wl of SOLID) {
      if (wl.gate && mayPass(w, pc, wl.gate)) continue;
      if (wl.gate === "servicegate" && w.state.stadium!.gates.servicegate?.until > w.state.tick) continue;
      const cx = Math.max(wl.x, Math.min(px, wl.x + wl.w)), cy = Math.max(wl.y, Math.min(py, wl.y + wl.h));
      if (Math.hypot(px - cx, py - cy) < r) return { wall: wl, x: cx, y: cy };
    }
  }
  return null;
}

/** Fast enough and a bus goes through a wall rather than bouncing off it. */
export const BREACH_SPEED = 8;
const HOLE_R = 2.8;

/** Through the wall. The bus is finished; the driver is shaken; everybody heard it. */
function breach(w: World, v: Vehicle, pc: Actor, hit: { wall: Wall; x: number; y: number }): void {
  const s = w.state, st = s.stadium!, tick = s.tick, wl = hit.wall;
  // The hole sits on the wall's centre line, where the bus hit it.
  const hx = wl.w >= wl.h ? hit.x : wl.x + wl.w / 2, hy = wl.w >= wl.h ? wl.y + wl.h / 2 : hit.y;
  st.breaches.push({ x: hx, y: hy, r: HOLE_R, t: tick });
  const fast = v.speed;
  // The bus ends up half in the hole.
  v.x += Math.cos(v.facing) * 1.2; v.y += Math.sin(v.facing) * 1.2;
  st.smoke.push({ x: hx, y: hy, r: 5, until: tick + 60 * 20 });
  const into = areaAt(hx + Math.cos(v.facing) * 3, hy + Math.sin(v.facing) * 3);
  const intoGround = VENUE.inside(hx + Math.cos(v.facing) * 3, hy + Math.sin(v.facing) * 3);
  w.bus.emit({ type: "breach", t: tick, x: hx, y: hy, by: pc.id, into: into.name, ground: intoGround, speed: fast });
  // Anyone in the bus gets the same treatment as a crash; the driver climbs out of the wreck.
  v.drivenBy = undefined;
  pc.hiddenIn = undefined;
  crash(w, v, true);
  const back = { x: v.x - Math.cos(v.facing) * (BUS_LEN / 2 + 1.2), y: v.y - Math.sin(v.facing) * (BUS_LEN / 2 + 1.2) };
  const d = busDoor(v);
  // Out through the door, unless the door is in the wall: then out the back.
  const doorFree = !SOLID.some((q) => d.x > q.x - 0.4 && d.x < q.x + q.w + 0.4 && d.y > q.y - 0.4 && d.y < q.y + q.h + 0.4);
  pc.x = doorFree ? d.x : back.x; pc.y = doorFree ? d.y : back.y;
  pc.downUntil = tick + 60 * (fast > 11.5 ? 6 : 3.5);
  st.flags.leftBusAt = tick;
  st.flags.breachAt = tick;
  // Taking out a stadium wall at full tilt is not always walked away from.
  if (fast > 12.2 && chance(s.rng.world, 0.15)) {
    st.ending = { kind: "hospital", title: "Taken to hospital", text: "You drove a team bus through a stadium wall at nearly thirty miles an hour. The airbag was, it turns out, a pillow someone had left on the dashboard." };
    w.bus.emit({ type: "ending", t: tick, kind: "hospital" });
    return;
  }
  busCrime(w, v, pc, intoGround ? "driving a bus through the stadium wall" : "driving a bus through a wall", 3);
  raiseSecurity(w, 2);
  // Police and stewards head for the hole.
  for (const id in s.actors) {
    const a = s.actors[id], n = a.npc;
    if (!n || (n.job !== "police" && n.job !== "patrol" && n.job !== "chief")) continue;
    if (Math.hypot(a.x - hx, a.y - hy) > 70) continue;
    n.plan = [{ k: "go", x: hx + (a.x < hx ? -2.5 : 2.5), y: hy + (a.y < hy ? -2.5 : 2.5), run: true }, { k: "wait", s: 40 }];
    n.lastSeen = { x: hx, y: hy, t: tick };
  }
}

export function installBus(): void {
  registerVerb("drive", {
    check: (w, act, actor) => {
      const v = w.state.stadium!.vehicles.bus;
      if (!v || v.crashed) return "no bus";
      if (v.drivenBy) return "already driving";
      const driver = w.state.actors[v.driver];
      if (driver && driver.hiddenIn === v.cab) return "the driver's in his seat";
      const door = busDoor(v);
      return Math.hypot(actor.x - door.x, actor.y - door.y) < 2.4 ? null : "too far from the door";
    },
    perform: (w, act, actor) => {
      const s = w.state, v = s.stadium!.vehicles.bus;
      v.drivenBy = actor.id; actor.hiddenIn = v.cab; actor.seated = false;
      s.stadium!.flags.gateRefused = 0;
      w.bus.emit({ type: "bus_stolen", t: s.tick, by: actor.id });
      const seen = Object.values(s.actors).some((a) => a.npc && a.npc.job !== "player" && canSee(w, a, actor, 14));
      if (seen) crime(w, actor, "getting into the team bus", 1, undefined, false);
    },
  });
  registerVerb("horn", {
    check: (w, act, actor) => {
      const v = w.state.stadium!.vehicles.bus;
      if (v?.drivenBy !== actor.id) return "not driving";
      return w.state.tick >= (w.state.stadium!.flags.hornReady ?? 0) ? null : "still honking";
    },
    perform: (w, act, actor) => honk(w, w.state.stadium!.vehicles.bus, actor),
  });
  registerVerb("getout", {
    check: (w, act, actor) => (w.state.stadium!.vehicles.bus?.drivenBy === actor.id ? null : "not driving"),
    perform: (w, act, actor) => {
      const v = w.state.stadium!.vehicles.bus;
      v.drivenBy = undefined; v.speed = 0; v.state = "parked"; v.until = Number.MAX_SAFE_INTEGER;
      actor.hiddenIn = undefined;
      w.state.stadium!.dives = {};
      letOff(w, v);
      const d = busDoor(v); actor.x = d.x; actor.y = d.y;
      w.state.stadium!.flags.leftBusAt = w.state.tick;
    },
  });
  // Tampering: a sharp or metal tool, a parked bus, and nobody watching.
  registerVerb("tamper", {
    check: (w, act, actor, item) => {
      const v = w.state.stadium!.vehicles.bus;
      if (!v || v.state === "driving" || v.drivenBy) return "the bus is moving";
      if (!item || actor.hand !== item.id || !(hasProp(item, "sharp") || hasProp(item, "metal"))) return "you need a tool in your hand";
      const r = busRear(v);
      return Math.hypot(actor.x - v.x, actor.y - v.y) < BUS_LEN / 2 + 1.5 || Math.hypot(actor.x - r.x, actor.y - r.y) < 2 ? null : "too far";
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, v = st.vehicles.bus;
      v.tampered = true;
      st.flags.busTamperedBy = 1;
      actor.downUntil = s.tick + 120; // it takes a minute under there
      const seen = Object.values(s.actors).some((a) => a.npc && a.npc.job !== "player" && canSee(w, a, actor, 12));
      if (seen) { st.flags.busTamperSeen = 1; crime(w, actor, "tampering with the team bus", 2); }
      w.bus.emit({ type: "bus_tampered", t: s.tick, by: actor.id, seen });
    },
  });
}

/** The governing body's view of a team whose bus misbehaves. */
export function stepBusSanctions(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match!, tick = s.tick;
  if (st.flags.busSanctionAt && tick >= st.flags.busSanctionAt && !st.flags.busSanctioned) {
    st.flags.busSanctioned = 1;
    // A forfeited goal: taken off their tally, or given to England if they haven't got one.
    if (m.score[1] > 0) m.score[1]--; else m.score[0]++;
    w.bus.emit({ type: "bus_sanction", t: tick, team: st.vehicles.bus?.team, against: 1 });
  }
  // If the driver turns out to be English, it all comes back the other way.
  if (st.flags.busSanctioned === 1 && st.incidents.some((i) => i.what.includes("bus") && i.blamed === "ENG")) {
    st.flags.busSanctioned = 2;
    if (m.score[0] > 0) m.score[0]--; else m.score[1]++;
    w.bus.emit({ type: "bus_sanction", t: tick, team: "ENG", against: 0, reversed: true });
  }
}


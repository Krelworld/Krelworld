// People with routines of their own. They carry on whether or not the player is watching.
import { bootHuntGoal } from "./bootbag";
import { banter } from "./chatter";
import { appearance } from "../core/identity";
import { chance, pick, rnd, rndRange } from "../core/rng";
import { DT, type Actor, type Role } from "../core/types";
import { spawnActor, type World } from "../core/world";
import { HL } from "../football/config";
import { AREAS, areaAt, areaById, KICKOFF_AT, SOLID, SPOTS, TURNSTILES, VENUE } from "./layout";
import { findPath } from "./nav";
import type { Job, Npc, Task } from "./state";

export const secs = (w: World): number => (w.state.tick - w.state.stadium!.arrivedAt) / 60;

export function newNpc(job: Job, role: Role, extra: Partial<Npc> = {}): Npc {
  return {
    job, role, plan: [], path: [], pathI: 0, goal: null, waitUntil: 0, stage: 0, sitting: false,
    bubble: null, nextBark: 0, mode: "routine", sus: {}, target: null, lastSeen: null, crime: 0,
    intent: null, modeUntil: 0, paidUntil: 0, refused: [], hasTicket: false, ...extra,
  };
}

const SPEED: Partial<Record<Job, number>> = { fan: 1.7, local: 1.4, police: 1.8, patrol: 1.6, cleaner: 1.3 };
const RUN: Partial<Record<Job, number>> = { police: 6.3, pitchsteward: 6.2, patrol: 6, corridor: 6, turnstile: 5.7, doorguard: 5.7, gateguard: 5.6, chief: 5.3 };
export const walkSpeed = (n: Npc) => SPEED[n.job] ?? 1.5;
export const runSpeed = (n: Npc) => RUN[n.job] ?? 3.6;

let pathBudget = 0;
export function resetPathBudget(): void { pathBudget = 8; }

export function say(w: World, a: Actor, text: string, seconds = 3.5): void {
  if (!a.npc || typeof text !== "string" || !text) return;
  a.npc.bubble = { text, until: w.state.tick + Math.round(seconds * 60) };
  w.bus.emit({ type: "say", t: w.state.tick, by: a.id, text });
}

/** Set off towards a point. Returns false if no path could be planned yet. */
export function goTo(a: Actor, x: number, y: number, run = false): void {
  const n = a.npc!;
  n.goal = { x, y, run };
  n.path = []; n.pathI = 0;
  n.sitting = false; a.seated = false;
}

/** Walk along the current path. Returns true once there (or if there is nowhere to go). */
export function follow(w: World, a: Actor): boolean {
  const n = a.npc!;
  if (!n.goal) { a.moveX = a.moveY = 0; return true; }
  if (!n.path.length) {
    if (pathBudget <= 0) { a.moveX = a.moveY = 0; return false; }
    pathBudget--;
    n.path = findPath(a.x, a.y, n.goal.x, n.goal.y);
    n.pathI = 0;
    if (!n.path.length) { n.goal = null; a.moveX = a.moveY = 0; return true; }
  }
  const tx = n.path[n.pathI], ty = n.path[n.pathI + 1];
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  const last = n.pathI >= n.path.length - 2;
  if (d < (last ? 0.35 : 0.7)) {
    if (last) { n.goal = null; n.path = []; a.moveX = a.moveY = 0; return true; }
    n.pathI += 2;
    return false;
  }
  const sp = n.goal.run ? runSpeed(n) : walkSpeed(n);
  a.speed = sp;
  const slow = last && d < 1 ? Math.max(0.35, d) : 1;
  a.moveX = (dx / d) * slow; a.moveY = (dy / d) * slow;
  return false;
}

/** Run the front task of the plan. */
function runPlan(w: World, a: Actor): void {
  const n = a.npc!, tick = w.state.tick;
  const t = n.plan[0];
  if (!t) return;
  switch (t.k) {
    case "go":
      if (!n.goal || n.goal.x !== t.x || n.goal.y !== t.y) {
        if (Math.hypot(a.x - t.x, a.y - t.y) < 0.4) { n.plan.shift(); return; }
        goTo(a, t.x, t.y, t.run);
      }
      if (follow(w, a)) n.plan.shift();
      return;
    case "wait":
      a.moveX = a.moveY = 0;
      if (n.face !== undefined && n.post && Math.hypot(a.x - n.post.x, a.y - n.post.y) < 0.8) a.facing = n.face;
      if (n.gawk && tick < n.gawk.until) a.facing = Math.atan2(n.gawk.y - a.y, n.gawk.x - a.x);
      else if (n.group && Math.hypot(n.group.x - a.x, n.group.y - a.y) > 0.3) {
        a.facing = Math.atan2(n.group.y - a.y, n.group.x - a.x);
        // Now and then someone in a group says something.
        if (n.act === "chat" && tick > n.nextBark && (tick + a.id.length * 97) % 600 === 0 && chance(w.state.rng.world, 0.35)) {
          const pc = w.state.actors[w.state.stadium!.pc];
          if (pc && Math.hypot(pc.x - a.x, pc.y - a.y) < 18) banter(w, a);
          n.nextBark = tick + 60 * 20;
        }
      }
      if (!n.waitUntil) n.waitUntil = tick + Math.round(t.s * 60);
      if (tick >= n.waitUntil) { n.waitUntil = 0; n.plan.shift(); }
      return;
    case "sit":
      a.moveX = a.moveY = 0; n.sitting = true; a.seated = true; n.plan.shift();
      return;
    case "say":
      say(w, a, t.text); n.plan.shift();
      return;
    case "despawn":
      for (const id of [a.hand, ...a.pockets, ...Object.values(a.worn)]) if (id) delete w.state.items[id];
      delete w.state.actors[a.id];
      return;
  }
}

/** Somewhere to stand in an area that isn't inside a table or a wall. */
const SOLID_CLEAR = 0.7;
function clearSpot(w: World, areaId: string, pad: number): { x: number; y: number } {
  let p = randIn(w, areaId, pad);
  for (let i = 0; i < 8; i++) {
    if (!SOLID.some((q) => p.x > q.x - SOLID_CLEAR && p.x < q.x + q.w + SOLID_CLEAR && p.y > q.y - SOLID_CLEAR && p.y < q.y + q.h + SOLID_CLEAR)) return p;
    p = randIn(w, areaId, pad);
  }
  return p;
}



/** Hang about in an area: join a group already standing there if there's room, or start one. */
/** Where people stand in the pub: at the bar, round the tables, under the telly, by the pool table.
 *  Drinkers settle at these and stay a while, instead of milling about the whole floor. */
const PUB_SPOTS = [{ x: -46.5, y: 69 }, { x: -41.5, y: 69 }, { x: -58, y: 75.4 }, { x: -58, y: 80 }, { x: -53.5, y: 80.4 }, { x: -39.5, y: 77.8 }, { x: -51, y: 74.9 }];
const PUB_CAP = 11;

function hangOut(w: World, a: Actor, areaId: string, seconds: number): void {
  const n = a.npc!, s = w.state, r = s.rng.world;
  let centre: { x: number; y: number } | null = null;
  if (areaId === "pub" && !VENUE.features.fanZone) {
    // A full pub spills into the yard; otherwise you join the quietest spot and stop there longer.
    const at = PUB_SPOTS.map((p) => ({ p, k: 0 }));
    let inside = 0;
    for (const id in s.actors) {
      const o = s.actors[id].npc;
      if (!o?.group || id === a.id || areaAt(o.group.x, o.group.y).id !== "pub") continue;
      inside++;
      const e = at.find((q) => q.p.x === o.group!.x && q.p.y === o.group!.y); if (e) e.k++;
    }
    if (inside >= PUB_CAP) areaId = "pub_yard";
    else {
      const open = at.filter((q) => q.k < 3);
      centre = (open.length ? pick(r, open) : pick(r, at)).p;
      seconds *= 1.6;
    }
  }
  if (!centre && chance(r, 0.75)) {
    const counts = new Map<string, { c: { x: number; y: number }; k: number }>();
    for (const id in s.actors) {
      const o = s.actors[id].npc;
      if (!o?.group || id === a.id || o.plan[0]?.k !== "wait" && o.plan[1]?.k !== "wait") continue;
      if (areaAt(o.group.x, o.group.y).id !== areaId) continue;
      const key = `${o.group.x.toFixed(1)},${o.group.y.toFixed(1)}`;
      const e = counts.get(key) ?? { c: o.group, k: 0 };
      e.k++; counts.set(key, e);
    }
    const open = [...counts.values()].filter((e) => e.k < 5);
    if (open.length) centre = pick(r, open).c;
  }
  centre ??= clearSpot(w, areaId, 2.5);
  const ang = rndRange(r, 0, Math.PI * 2), rad = rndRange(r, 0.8, 1.2);
  n.group = centre;
  const inPub = areaId === "pub" || areaId === "pub_yard";
  const roll = rnd(r);
  n.act = inPub ? (roll < 0.5 ? "drink" : roll < 0.85 ? "chat" : "idle") : roll < 0.4 ? "chat" : roll < 0.55 ? "cheer" : roll < 0.72 ? "smoke" : roll < 0.85 ? "drink" : "idle";
  n.plan.push({ k: "go", x: centre.x + Math.cos(ang) * rad, y: centre.y + Math.sin(ang) * rad }, { k: "wait", s: seconds });
}

const randIn = (w: World, areaId: string, pad = 1) => {
  const ar = areaById(areaId), r = w.state.rng.world;
  return { x: ar.x + pad + rnd(r) * (ar.w - pad * 2), y: ar.y + pad + rnd(r) * (ar.h - pad * 2) };
};

/** Decide what to do next when the plan runs out. Purely about routine, never about the player. */
function routine(w: World, a: Actor): void {
  const n = a.npc!, s = w.state, r = s.rng.world, t = secs(w), m = s.match!;
  n.group = undefined; n.act = undefined;
  const later = (...ts: Task[]) => n.plan.push(...ts);
  const finished = m.phase === "finished";
  switch (n.job) {
    case "fan": {
      if (finished && n.stage < 9) {
        n.stage = 9; n.sitting = false; a.seated = false;
        const ts = pick(r, [-6, 0, 6]);
        later({ k: "go", x: ts, y: 42.5 }, { k: "go", x: ts, y: 47 }, { k: "go", x: VENUE.id === "sf" ? rndRange(r, -80, 64) : rndRange(r, -64, 80), y: 94 }, { k: "despawn" });
        return;
      }
      if (n.stage === 0) {
        // Most hang about outside first: the pub, the approach, the car park. Then they go in, in a rush near the end.
        n.goInAt ??= KICKOFF_AT - (chance(r, 0.25) ? rndRange(r, 140, 240) : rndRange(r, 20, 140));
        if (t >= n.goInAt) { n.stage = 1; return; }
        const where = n.team === 1 ? pick(r, ["plaza", "carpark", "plaza"]) : pick(r, ["pub", "pub", "pub_yard", "plaza", "plaza"]);
        hangOut(w, a, VENUE.features.fanZone && where === "pub" ? "plaza" : where, Math.min(rndRange(r, 15, 45), Math.max(1, n.goInAt - t)));
        return;
      }
      if (n.stage === 1) {
        n.stage = 2;
        const ts = pick(r, [-6, 0, 6]);
        later({ k: "go", x: ts + rndRange(r, -0.4, 0.4), y: 48 }, { k: "wait", s: rndRange(r, 0.5, 2) }, { k: "go", x: ts, y: 46 }, { k: "go", x: ts, y: 42.5 });
        return;
      }
      if (n.stage === 2 || n.stage === 4) {
        n.stage = 3;
        later({ k: "go", x: n.seat!.x, y: n.seat!.y }, { k: "sit" });
        return;
      }
      if (n.stage === 3 && m.phase === "break" && m.period === 1) {
        // Half-time: about a quarter go for a pint or the toilet. Decided once.
        if (chance(r, 0.25)) {
          n.stage = 4; n.sitting = false; a.seated = false;
          later({ k: "wait", s: rndRange(r, 2, 25) },
            chance(r, 0.5) ? { k: "go", x: SPOTS.barS.x + rndRange(r, -5, 5), y: SPOTS.barS.y - rnd(r) * 1.2 } : { k: "go", x: rndRange(r, 7, 13), y: rndRange(r, 39.5, 43) },
            { k: "wait", s: rndRange(r, 15, 45) });
        } else n.stage = 6;
        return;
      }
      if (n.stage === 6 && m.phase !== "break") n.stage = 3;
      if (n.stage === 3 || n.stage === 6) { n.sitting = true; a.seated = true; return; }
      return;
    }
    case "local": {
      // Drinks in the pub; wanders the approach; watches the match on the pub telly.
      if (m.phase !== "pre" && !finished) hangOut(w, a, "pub", rndRange(r, 40, 120));
      else if (chance(r, 0.6)) hangOut(w, a, "pub", rndRange(r, 20, 80));
      else hangOut(w, a, "plaza", rndRange(r, 10, 40));
      return;
    }
    case "doorguard": {
      // Stands at the staff door. At some grounds he nips out for a smoke and props it open.
      if (n.stage === 0 && VENUE.features.doorSmokes) {
        if (t > (s.stadium!.flags.nextSmoke ?? 110)) {
          n.stage = 1;
          s.stadium!.flags.nextSmoke = t + 170 + rnd(r) * 60;
          later({ k: "say", text: "Back in five. Don't tell the gaffer." }, { k: "go", x: SPOTS.cabinDoor.x, y: SPOTS.cabinDoor.y }, { k: "wait", s: rndRange(r, 40, 55) }, { k: "go", ...n.post! });
          s.stadium!.gates.staffdoor = { until: s.tick + 60 * 70, for: null };
          return;
        }
      }
      if (n.stage === 1) { n.stage = 0; s.stadium!.gates.staffdoor = { until: 0, for: null }; }
      later({ k: "go", ...n.post! }, { k: "wait", s: 4 });
      return;
    }
    case "patrol": {
      const loop = VENUE.patrolLoop;
      const p = loop[n.stage % loop.length]; n.stage++;
      later({ k: "go", x: p.x, y: p.y }, { k: "wait", s: rndRange(r, 2, 8) });
      return;
    }
    case "police": {
      if (n.stay && n.post) { later({ k: "go", ...n.post }, { k: "wait", s: rndRange(r, 10, 20) }); return; }
      const spots = VENUE.policeSpots;
      later({ k: "go", ...spots[n.stage++ % spots.length] }, { k: "wait", s: rndRange(r, 6, 20) });
      return;
    }
    case "corridor": {
      const spots = VENUE.corridorSpots;
      later({ k: "go", ...spots[n.stage++ % spots.length] }, { k: "wait", s: rndRange(r, 8, 20) });
      return;
    }
    case "cleaner": {
      const spots = VENUE.cleanerSpots;
      later({ k: "go", ...spots[n.stage++ % spots.length] }, { k: "wait", s: rndRange(r, 6, 14) });
      return;
    }
    case "kitman": {
      // Wally the kit man: a pint in the pub, out the back along the alley, in through the players'
      // entrance with his swipe card, sorts the kit, and round again. Follow him, or lift the card.
      const pubSpot = { x: SPOTS.pubBarman.x + rndRange(r, -2, 2), y: SPOTS.pubBarman.y + 3.6 };
      const legs: Task[][] = [
        [{ k: "go", ...pubSpot }, { k: "say", text: "Usual, please. Quick one." }, { k: "wait", s: rndRange(r, 20, 35) }],
        [{ k: "go", x: SPOTS.playersDoor.x - 1.2, y: SPOTS.playersDoor.y + 2 }, { k: "go", ...SPOTS.playersDoor }, { k: "go", ...SPOTS.kitRoom }],
        [{ k: "say", text: "Forty shirts, forty pairs of socks, one of them always missing." }, { k: "wait", s: rndRange(r, 25, 40) }],
        [{ k: "go", ...SPOTS.playersDoor }, { k: "go", x: SPOTS.playersDoor.x - 1.2, y: SPOTS.playersDoor.y + 6 }],
      ];
      later(...legs[n.stage++ % legs.length]);
      return;
    }
    case "mascot": {
      // Lenny the Lion: a fag in the alley with his head off until just before kick-off, then in
      // through the players' entrance and out of the tunnel to wave at the crowd along the touchline.
      if (n.stage === 0 && t < KICKOFF_AT - 100) {
        later({ k: "go", ...SPOTS.mascotSmoke }, { k: "wait", s: Math.min(20, Math.max(1, KICKOFF_AT - 100 - t)) });
        n.act = "smoke";
        return;
      }
      if (n.stage === 0) {
        n.stage = 1;
        later({ k: "go", x: SPOTS.playersDoor.x - 1.2, y: SPOTS.playersDoor.y + 2 }, { k: "go", ...SPOTS.playersDoor }, { k: "go", ...SPOTS.kitRoom },
          { k: "go", ...SPOTS.tunnelBottom }, { k: "go", ...SPOTS.tunnelTop });
        return;
      }
      const spots = [{ x: -20, y: 26.6 }, { x: 0, y: 26.6 }, { x: 20, y: 26.6 }, { x: 38.6, y: 12 }, { x: 38.6, y: -12 }, { x: 24, y: -26.8 }, { x: -24, y: -26.8 }, { x: -38.6, y: -12 }, { x: -38.6, y: 12 }];
      const p = spots[n.stage++ % spots.length];
      later({ k: "go", x: VENUE.id === "sf" ? -p.x : p.x, y: p.y }, { k: "wait", s: rndRange(r, 8, 18) });
      n.act = "cheer";
      return;
    }
    default:
      // Staff at a post: go back to it and stay there.
      if (n.post) later({ k: "go", ...n.post }, { k: "wait", s: 5 });
      else later({ k: "wait", s: 5 });
  }
}

/** Footballers and officials before kick-off and at half-time: in and out of the dressing rooms. */
function teamWalk(w: World, a: Actor): void {
  const s = w.state, m = s.match!, n = a.npc!, st = s.stadium!;
  if (m.cfg.venue !== true || (m.phase !== "pre" && m.phase !== "break")) { n.goal = null; n.path = []; return; }
  // The away team come by bus: wait at the hotel, then board when it's time.
  const bus = st.vehicles.bus;
  if (a.fb?.team === 1 && m.phase === "pre" && bus && !st.flags.busArrived && !st.flags.awayOnFoot && !bus.crashed && !bus.drivenBy) {
    if (a.hiddenIn === bus.cab) return;
    const hunt = st.flags.boarding ? bootHuntGoal(w, a) : null;
    if (hunt) {
      // Not without his boots (bootbag.ts): round the coach looking for them.
      if (!n.goal || Math.hypot(n.goal.x - hunt.x, n.goal.y - hunt.y) > 0.8) goTo(a, hunt.x, hunt.y);
    } else if (st.flags.boarding) {
      const door = { x: bus.x + Math.cos(bus.facing) * 3.9 + Math.sin(bus.facing) * 2.2, y: bus.y + Math.sin(bus.facing) * 3.9 - Math.cos(bus.facing) * 2.2 };
      if (Math.hypot(a.x - door.x, a.y - door.y) < 1.6) { a.hiddenIn = bus.cab; return; }
      if (!n.goal || Math.hypot(n.goal.x - door.x, n.goal.y - door.y) > 1) goTo(a, door.x, door.y);
    } else {
      const k = a.fb.number;
      const tx = SPOTS.hotelLobby.x + ((k % 5) - 2) * 1.6, ty = SPOTS.hotelLobby.y + (Math.floor(k / 5) - 1) * 1.6;
      if (Math.hypot(a.x - tx, a.y - ty) > 0.5 && (!n.goal || Math.hypot(n.goal.x - tx, n.goal.y - ty) > 0.5)) goTo(a, tx, ty);
    }
    const done = follow(w, a);
    a.fb.tx = done ? a.x : n.path[n.pathI] ?? a.x; a.fb.ty = done ? a.y : n.path[n.pathI + 1] ?? a.y; a.fb.sprint = false;
    a.moveX = a.moveY = 0;
    return;
  }
  if (a.hiddenIn && a.fb) return;
  const left = (m.phaseUntil - s.tick) / 60;
  const out = left < (m.phase === "pre" ? 55 : 30) || (m.phase === "break" && m.period !== 1);
  let tx: number, ty: number;
  if (out) {
    // Line up on the halfway line, spread across.
    const idx = a.fb ? a.fb.slot + (a.fb.team === 0 ? 0 : 11) : a.off!.job === "referee" ? 22 : a.off!.line > 0 ? 23 : 24;
    tx = (a.fb ? (a.fb.team === 0 ? -1 : 1) * (3 + (idx % 11) * 1.6) : (idx - 23) * 3);
    ty = -18 + (idx % 3);
    if (a.fb && a.fb.status !== "playing") { tx = (a.fb.team === 0 ? -8 : 8) + (a.fb.number % 5); ty = -HL * 0 - 28.6; }
  } else {
    const room = a.fb ? (a.fb.team === 0 ? SPOTS.homeRoom : SPOTS.awayRoom) : SPOTS.refRoom;
    const k = a.fb ? a.fb.number : a.off!.line + 2;
    tx = room.x + ((k % 5) - 2) * 1.6; ty = room.y + (Math.floor(k / 5) - 1) * 1.6;
  }
  const there = Math.hypot(a.x - tx, a.y - ty) < 0.4;
  if (!there && (!n.goal || Math.abs(n.goal.x - tx) > 0.1 || Math.abs(n.goal.y - ty) > 0.1)) goTo(a, tx, ty);
  if (n.goal) n.goal.run = false;
  // Follow the path, but let the match move footballers (it steers them to fb.tx/ty).
  const arrived = there || follow(w, a);
  const wx = arrived ? tx : n.path[n.pathI] ?? tx, wy = arrived ? ty : n.path[n.pathI + 1] ?? ty;
  if (a.fb) {
    a.fb.tx = wx; a.fb.ty = wy; a.fb.sprint = false; a.moveX = a.moveY = 0;
  } else {
    const dx = wx - a.x, dy = wy - a.y, d = Math.hypot(dx, dy);
    if (d > 0.05) { const st = Math.min(d, 2.2 * DT); a.x += (dx / d) * st; a.y += (dy / d) * st; a.facing = Math.atan2(dy, dx); a.vx = (dx / d) * 2.2; a.vy = (dy / d) * 2.2; }
    else { a.vx = a.vy = 0; }
    a.moveX = a.moveY = 0;
  }
}

export function stepNpc(w: World, a: Actor): void {
  const n = a.npc!, tick = w.state.tick;
  if (n.bubble && tick > n.bubble.until) n.bubble = null;
  if (a.dead) { a.moveX = a.moveY = 0; return; }
  if (n.job === "armed") return; // armed officers are moved by knife.ts
  if (n.job === "player" || n.job === "official") { teamWalk(w, a); return; }
  if (n.job === "dog") return; // the dog has a mind of its own (see dog.ts)
  if (a.downUntil > tick || a.heldBy || (a.effects.frozen ?? 0) > tick) { a.moveX = a.moveY = 0; return; }
  if (n.mode !== "routine") return; // security behaviour moves them
  if (!n.plan.length) routine(w, a);
  runPlan(w, a);
}

// ---------- Spawning ----------
const FAN_NAMES = ["Gaz", "Dean", "Lee", "Wayne", "Kev", "Darren", "Steve", "Clive", "Nige", "Trev", "Baz", "Carl", "Del", "Ricky"];
const FAN_NAMES_F = ["Shaz", "Tracey", "Bev", "Kerry", "Stacey", "Leanne", "Donna", "Jade", "Chantelle", "Debbie"];
const AWAY_NAMES = ["Rui", "João", "Tiago", "Bruno", "Paulo", "Nuno", "Miguel", "Diogo"];
const AWAY_NAMES_F = ["Ana", "Inês", "Sofia", "Beatriz", "Marta", "Rita"];
export const FEMALE_LOCALS = new Set(["Sue", "Lisa", "Barmaid"]);

export function spawnFan(w: World, away: boolean, seated: boolean): Actor {
  const s = w.state, r = s.rng.world;
  const standId = away ? "stand_e" : pick(r, ["stand_s", "stand_s", "stand_w", "stand_n"]);
  const seat = randIn(w, standId, 1.2);
  // Arrivals come off the far pavement and cross the ring road (the traffic waits for them).
  const start = seated ? seat : { x: VENUE.id === "sf" ? rndRange(r, -85, 66) : rndRange(r, -66, 85), y: rndRange(r, 93, 95) };
  // About one in four: a woman.
  const female = r.a % 4 === 1;
  const a = spawnActor(s, "npc", female ? pick(r, away ? AWAY_NAMES_F : FAN_NAMES_F) : pick(r, away ? AWAY_NAMES : FAN_NAMES), start.x, start.y, {
    npc: newNpc("fan", "fan", { seat, hasTicket: true, team: away ? 1 : 0 }), speed: 1.5, radius: 0.4, money: Math.round(rndRange(r, 10, 80)),
  });
  if (female) a.female = true;
  const n = a.npc!;
  n.lines = away ? ["Força!", "Your keeper's a joke.", "We will win this easy."] : FAN_POOL;
  if (seated) { n.stage = 3; n.sitting = true; a.seated = true; }
  a.facing = away ? Math.PI : -Math.PI / 2;
  return a;
}

export const FAN_POOL = [
  "Their number 10's the only one who can play. Take him out and they've got nothing.",
  "Ref's from Belgium. You know what that means.",
  "I've had nine pints and I can still see better than the linesman.",
  "Their keeper likes a bet. Everyone knows it.",
  "If we go out to this lot I'm emigrating.",
  "Fifty quid for a ticket. Robbery.",
];

export const STAFF_LINES: Partial<Record<Job, string[]>> = {
  local: [
    "That beer lorry goes straight in the back of the ground. Nobody ever checks it.",
    "Lost my ticket in here once. Someone had it off me in the queue.",
    "The steward on the staff door's always out the back having a fag.",
    "Can't get a ticket for love nor money. Watching it on the telly.",
    "Lenny the Lion has a fag round the back of the stand every match. Head off and everything. Ruined my childhood.",
    "My mate got knocked spark out in the West End last season. Woke up next to the dressing rooms.",
  ],
  barman: ["Their goalkeeper was in here last night. Put two hundred quid on himself to concede.", "What can I get you?"],
  seller: ["Tickets, sixty quid. Cash.", "Shirts, scarves, masks."],
  cleaner: ["Ref has his tea at half-time. Two sugars. Same urn every match.", "Mind your feet, I've just done that."],
  worker: ["Mind the crates.", "Same run every match. Pub, ground, pub, ground."],
  driver: ["I'm not stopping. I've got a schedule."],
  turnstile: ["Tickets out, please.", "Keep it moving."],
  doorguard: ["Staff only, mate.", "This door's not for you."],
  gateguard: ["Deliveries only."],
  pitchsteward: ["Stay in your seat, please."],
  patrol: ["Move along."],
  police: ["Evening.", "Behave yourself today, eh?"],
  corridor: ["You lost, pal?"],
  cook: ["Get out of my kitchen."],
  chief: ["What do you want?"],
  kitman: ["Can't stop, the gaffer wants the kit ironed.", "Swipe card's the only way in the back. Don't even think about it.", "Hamper's full of dirty socks. Nobody looks in there."],
  groundsman: ["Off my grass.", "Drain runs from the pub cellar right under the dressing rooms. Old Victorian brick. Rats the size of dogs.", "Left me wrench somewhere. Hatch in the pub cellar's seized solid."],
  press: ["Can I get a quick word for the cameras?", "Lost my press pass here last season. That thing gets you through any turnstile.", "We're live in five, keep it clean."],
};

export function spawnStaff(w: World, job: Job, role: Role, name: string, x: number, y: number, extra: Partial<Npc> = {}, look: Partial<Actor> = {}): Actor {
  const a = spawnActor(w.state, "npc", name, x, y, { npc: newNpc(job, role, { post: { x, y }, lines: STAFF_LINES[job], ...extra }), speed: 1.5, radius: 0.4, ...look });
  return a;
}

/** Does this person currently look like someone who may use this gate? */
export function mayPass(w: World, a: Actor, gate: string): boolean {
  const st = w.state.stadium!, g = st.gates[gate];
  if (g && g.until > w.state.tick && (g.for === null || g.for === a.id)) return true;
  if (a.npc) {
    const n = a.npc;
    if (n.job === "player" || n.job === "official") return true;
    if (n.job === "dog") { const sd = w.state.stadium!.dog; return !!g && g.until > w.state.tick && (g.for === null || (sd?.state === "led" && g.for === w.state.stadium!.pc)); }
    if (TURNSTILES.includes(gate)) return n.hasTicket || ["steward", "police", "cleaner", "catering"].includes(n.role);
    return ["steward", "police", "catering", "cleaner", "medic"].includes(n.role);
  }
  // The player: only through gates opened for him, or the staff door if he looks like staff and nobody is checking.
  // The security office: staff (or anyone with a pass) come and go. From inside, the door opens
  // unless you're being held there and the man holding you is up and about.
  if (gate === "officedoor") {
    const s = w.state, inside = a.y < -48.25;
    if ([a.hand, ...a.pockets].some((id) => id && s.items[id]?.def === "staff_pass") || ["steward", "police"].includes(appearance(s, a).role)) return true;
    if (!inside) return false;
    const chief = Object.values(s.actors).find((o) => o.npc?.job === "chief");
    const guarded = (!!st.detainedUntil || !!st.custody) && !!chief && !chief.dead && chief.downUntil <= s.tick && !chief.hiddenIn && Math.hypot(chief.x - a.x, chief.y - a.y) < 9;
    return !guarded;
  }
  if (gate === "playersdoor") return [a.hand, ...a.pockets].some((id) => id && w.state.items[id]?.def === "kit_card");
  if (gate === "staffdoor") {
    const role = appearance(w.state, a).role;
    return ["steward", "police"].includes(role) && st.doorPass === a.id;
  }
  return false;
}

export function areaIds(): string[] { return AREAS.map((x) => x.id); }

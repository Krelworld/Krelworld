// People with routines of their own. They carry on whether or not the player is watching.
import { appearance } from "../core/identity";
import { chance, pick, rnd, rndRange } from "../core/rng";
import { DT, type Actor, type Role } from "../core/types";
import { spawnActor, type World } from "../core/world";
import { HL } from "../football/config";
import { AREAS, areaById, KICKOFF_AT, SPOTS, TURNSTILES, VENUE } from "./layout";
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
const RUN: Partial<Record<Job, number>> = { police: 5.9, pitchsteward: 5.8, patrol: 5.6, corridor: 5.6, turnstile: 5.3, doorguard: 5.3, gateguard: 5.2, chief: 5 };
export const walkSpeed = (n: Npc) => SPEED[n.job] ?? 1.5;
export const runSpeed = (n: Npc) => RUN[n.job] ?? 3.6;

let pathBudget = 0;
export function resetPathBudget(): void { pathBudget = 8; }

export function say(w: World, a: Actor, text: string, seconds = 3.5): void {
  if (!a.npc) return;
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

const randIn = (w: World, areaId: string, pad = 1) => {
  const ar = areaById(areaId), r = w.state.rng.world;
  return { x: ar.x + pad + rnd(r) * (ar.w - pad * 2), y: ar.y + pad + rnd(r) * (ar.h - pad * 2) };
};

/** Decide what to do next when the plan runs out. Purely about routine, never about the player. */
function routine(w: World, a: Actor): void {
  const n = a.npc!, s = w.state, r = s.rng.world, t = secs(w), m = s.match!;
  const later = (...ts: Task[]) => n.plan.push(...ts);
  const finished = m.phase === "finished";
  switch (n.job) {
    case "fan": {
      if (finished && n.stage < 9) {
        n.stage = 9; n.sitting = false; a.seated = false;
        const ts = pick(r, [-6, 0, 6]);
        later({ k: "go", x: ts, y: 42.5 }, { k: "go", x: ts, y: 47 }, { k: "go", x: rndRange(r, -80, 80), y: 88 }, { k: "despawn" });
        return;
      }
      if (n.stage === 0) {
        // Most hang about outside first: the pub, the approach, the car park. Then they go in, in a rush near the end.
        n.goInAt ??= KICKOFF_AT - (chance(r, 0.25) ? rndRange(r, 140, 240) : rndRange(r, 20, 140));
        if (t >= n.goInAt) { n.stage = 1; return; }
        const where = n.team === 1 ? pick(r, ["plaza", "carpark", "plaza"]) : pick(r, ["pub", "pub", "pub_yard", "plaza", "plaza"]);
        later({ k: "go", ...randIn(w, where, 2) }, { k: "wait", s: Math.min(rndRange(r, 10, 35), Math.max(1, n.goInAt - t)) });
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
      if (m.phase !== "pre" && !finished) later({ k: "go", ...randIn(w, "pub", 3) }, { k: "wait", s: rndRange(r, 40, 120) });
      else if (chance(r, 0.6)) later({ k: "go", ...randIn(w, "pub", 3) }, { k: "wait", s: rndRange(r, 20, 80) });
      else later({ k: "go", ...randIn(w, "plaza", 2) }, { k: "wait", s: rndRange(r, 10, 40) });
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
    if (st.flags.boarding) {
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
const FAN_NAMES = ["Gaz", "Dean", "Lee", "Wayne", "Kev", "Darren", "Shaz", "Tracey", "Bev", "Steve", "Clive", "Nige", "Trev", "Baz"];
const AWAY_NAMES = ["Rui", "João", "Tiago", "Bruno", "Ana", "Inês", "Paulo", "Nuno", "Sofia", "Miguel"];

export function spawnFan(w: World, away: boolean, seated: boolean): Actor {
  const s = w.state, r = s.rng.world;
  const standId = away ? "stand_e" : pick(r, ["stand_s", "stand_s", "stand_w", "stand_n"]);
  const seat = randIn(w, standId, 1.2);
  const start = seated ? seat : { x: rndRange(r, -85, 85), y: rndRange(r, 86, 91) };
  const a = spawnActor(s, "npc", away ? pick(r, AWAY_NAMES) : pick(r, FAN_NAMES), start.x, start.y, {
    npc: newNpc("fan", "fan", { seat, hasTicket: true, team: away ? 1 : 0 }), speed: 1.5, radius: 0.4, money: Math.round(rndRange(r, 10, 80)),
  });
  const n = a.npc!;
  n.lines = away ? ["Força!", "Your keeper's a joke.", "We will win this easy."] : FAN_POOL;
  if (seated) { n.stage = 3; n.sitting = true; a.seated = true; }
  a.facing = away ? Math.PI : -Math.PI / 2;
  return a;
}

const FAN_POOL = [
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
  if (gate === "staffdoor") {
    const role = appearance(w.state, a).role;
    return ["steward", "police"].includes(role) && st.doorPass === a.id;
  }
  return false;
}

export function areaIds(): string[] { return AREAS.map((x) => x.id); }

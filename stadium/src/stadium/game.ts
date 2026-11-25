// A match day at one stadium: setting it up, running it, and the checkpoints.
import { ITEM_DEFS, spawnItem } from "../core/items";
import { pick, rndRange, seedRng } from "../core/rng";
import type { Actor, WorldState } from "../core/types";
import { createWorld, spawnActor, stepWorld, type World } from "../core/world";
import { createMatch, TEAMS } from "../football/setup";
import { BOUNDS, KICKOFF_AT, SPOTS, WALLS } from "./layout";
import { mayPass, newNpc, resetPathBudget, secs, spawnFan, spawnStaff, stepNpc } from "./npc";
import { installBetting, installSettlement } from "./betting";
import { installReactions, installRules, stepRules } from "./rules";
import { isSecurity, stepDetention, stepSecurity } from "./security";
import type { StadiumState } from "./state";
import { lorryHits, stepVehicle } from "./vehicles";

export interface Checkpoint { id: "arrival" | "admission" | "kickoff" | "halftime"; label: string; tick: number; state: WorldState }

export interface Game {
  w: World;
  checkpoints: Checkpoint[];
  opp: string;
}

let rulesInstalled = false;

export const HALF_SECONDS = 450;
export const HALFTIME_SECONDS = 150;

export function createGame(seed: string, oppKey = "POR"): Game {
  if (!rulesInstalled) { installRules(); installBetting(); rulesInstalled = true; }
  const opp = TEAMS[oppKey];
  // The opposition shirt on sale outside is this opponent's.
  Object.assign(ITEM_DEFS.shirt_opp, { name: `${opp.name} shirt`, team: opp.short, colour: opp.colour, colour2: opp.colour2 });

  const w = createWorld(seed);
  const s = w.state, r = s.rng.world;
  const locker = spawnItem(s, "locker", { k: "ground", x: SPOTS.locker.x, y: SPOTS.locker.y });
  const st: StadiumState = {
    pc: "pc", arrivedAt: 0, gates: {}, vehicles: {}, banned: [], wanted: [], incidents: [], admitted: false, warnings: 0,
    ending: null, flags: {}, doorPass: null, detainedUntil: 0, policeCalled: false, locker: locker.id, dosed: {}, smoke: [],
  };
  s.stadium = st;

  const m = createMatch(w, TEAMS.ENG, opp, { preSeconds: KICKOFF_AT, venue: true, halfSeconds: HALF_SECONDS, halfTimeSeconds: HALFTIME_SECONDS, knockout: true });
  // Teams and officials start in their dressing rooms.
  for (const t of [0, 1] as const) {
    const room = t === 0 ? SPOTS.homeRoom : SPOTS.awayRoom;
    m.teams[t].squad.forEach((id, i) => {
      const a = s.actors[id];
      a.x = room.x + ((i % 5) - 2) * 1.6; a.y = room.y + (Math.floor(i / 5) - 1) * 1.6;
      a.fb!.tx = a.x; a.fb!.ty = a.y;
      a.npc = newNpc("player", "footballer");
    });
  }
  const offIds = [m.officials.referee, ...m.officials.assistants, m.officials.fourth];
  offIds.forEach((id, i) => { const a = s.actors[id]; a.x = SPOTS.refRoom.x + (i - 1.5) * 1.6; a.y = SPOTS.refRoom.y; a.npc = newNpc("official", "referee"); });

  // The player.
  const pc = spawnActor(s, "protagonist", "Barry", SPOTS.arrival.x, SPOTS.arrival.y, { id: "pc", radius: 0.55, speed: 2.2, money: 150 });
  pc.facing = -Math.PI / 2;
  spawnItem(s, "shirt_eng", { k: "worn", a: pc.id, slot: "inner" });

  // Staff.
  const staff = (job: Parameters<typeof spawnStaff>[1], role: Parameters<typeof spawnStaff>[2], name: string, at: { x: number; y: number }, facing: number, extra = {}) => {
    const a = spawnStaff(w, job, role, name, at.x, at.y, extra);
    a.facing = facing; a.npc!.face = facing;
    if (role === "steward") spawnItem(s, "hivis", { k: "worn", a: a.id, slot: "outer" });
    if (role === "police") spawnItem(s, "police_hat", { k: "worn", a: a.id, slot: "head" });
    return a;
  };
  const N = -Math.PI / 2, S = Math.PI / 2, E = 0, W = Math.PI;
  [-6, 0, 6].forEach((x, i) => staff("turnstile", "steward", ["Steward Dennis", "Steward Pauline", "Steward Gary"][i], { x, y: 43.1 }, S));
  staff("doorguard", "steward", "Steward Clive", SPOTS.doorPost, S);
  staff("gateguard", "steward", "Steward Mick", SPOTS.gatePost, E);
  const pitchPosts = [[-24, 27.4, S], [0, 27.4, S], [24, 27.4, S], [-24, -27.4, N], [24, -27.4, N], [-40.6, -10, W], [-40.6, 10, W], [40.6, 0, E]] as const;
  pitchPosts.forEach(([x, y, f], i) => staff("pitchsteward", "steward", `Steward ${["Ken", "Lorraine", "Phil", "Jim", "Ray", "Sandra", "Tony", "Bob"][i]}`, { x, y }, f));
  staff("patrol", "steward", "Steward Alan", { x: -30, y: 41 }, E);
  staff("patrol", "steward", "Steward Denise", { x: 30, y: 41 }, W);
  staff("corridor", "steward", "Steward Brian", SPOTS.corridorPost, S);
  staff("chief", "steward", "Head of Security", SPOTS.chiefDesk, N);
  staff("police", "police", "PC Hargreaves", { x: -20, y: 57 }, S);
  staff("police", "police", "PC Okafor", { x: 30, y: 56 }, S);
  staff("barman", "catering", "Landlord", SPOTS.pubBarman, S, { shop: "pub" });
  staff("barman", "catering", "Barmaid", SPOTS.barSman, N, { shop: "bar" });
  staff("seller", "none", "Ticket office", SPOTS.ticketSeller, S, { shop: "ticket" });
  staff("seller", "none", "Stallholder", SPOTS.merchSeller, S, { shop: "merch" });
  staff("seller", "none", "Rose", SPOTS.charity, S, { shop: "charity", lines: ["All proceeds to the donkey sanctuary.", "Chef's whites came in this morning. Fits a big lad."] });
  staff("seller", "none", "Sarge", SPOTS.surplus, S, { shop: "surplus", lines: ["Flares are for boats. Officially.", "Cash only. No questions."] });
  staff("seller", "none", "Lucky Lionel", SPOTS.bookie, S, { shop: "bookies", lines: ["England? Brave. I like it.", "Odds change when the score does, sunshine.", "No refunds on acts of God. Or acts of you."] });
  staff("seller", "none", "Kiosk", SPOTS.kiosk, N, { shop: "bookies", lines: ["Bets close fifteen seconds after a goal.", "Next goal's the one everyone wants."] });
  staff("cleaner", "cleaner", "Cleaner", { x: -30, y: 40 }, E);
  staff("cook", "catering", "Cook", SPOTS.kitchenSpot, S);

  // Locals: no ticket, plenty of opinions.
  for (let i = 0; i < 8; i++) {
    const p = i < 5 ? { x: rndRange(r, -58, -38), y: rndRange(r, 69, 78) } : { x: rndRange(r, -40, 40), y: rndRange(r, 50, 58) };
    const a = spawnStaff(w, "local", "fan", pick(r, ["Big Kev", "Tel", "Mad Dog", "Sue", "Grandad", "Spencer", "Lisa", "Wolfie"]), p.x, p.y);
    a.money = Math.round(rndRange(r, 15, 90));
    a.npc!.post = undefined;
  }

  // The beer lorry and its crew.
  const cargo = spawnItem(s, "lorry_cargo", { k: "ground", x: -28, y: 70 });
  const driver = spawnStaff(w, "driver", "catering", "Lorry driver", -28, 74);
  spawnStaff(w, "worker", "catering", "Drayman", -30, 70).npc!.post = undefined;
  st.vehicles.lorry = { id: "lorry", kind: "lorry", x: -28, y: 74, facing: S, route: [-28, 74], ri: 0, speed: 0, state: "loading", until: 60 * 45, cargo: cargo.id, driver: driver.id, cycle: 0, inspected: false };

  // Things lying about, for whoever finds them.
  spawnItem(s, "hivis", { k: "ground", x: SPOTS.cabinHook.x, y: SPOTS.cabinHook.y });
  spawnItem(s, "laxative", { k: "ground", x: -56.5, y: 63.4 });
  spawnItem(s, "powder", { k: "ground", x: -60.6, y: 63.2 });
  spawnItem(s, "knife", { k: "ground", x: -38.5, y: -57 });
  spawnItem(s, "ref_kit", { k: "ground", x: -3.5, y: -59 });
  spawnItem(s, "whistle", { k: "ground", x: 3.5, y: -59 });
  spawnItem(s, "cooler_home", { k: "ground", x: -24.5, y: -58.5 });
  spawnItem(s, "cooler_away", { k: "ground", x: 24.5, y: -58.5 });
  spawnItem(s, "tea_urn", { k: "ground", x: 1, y: -59 });

  // Supporters already in their seats; more arrive over the next few minutes.
  for (let i = 0; i < 24; i++) giveFanThings(w, spawnFan(w, i % 6 === 5, true));

  installReactions(w);
  installSettlement(w);
  const g: Game = { w, checkpoints: [], opp: oppKey };
  saveCheckpoint(g, "arrival", "Arrival outside the ground");
  return g;
}

function giveFanThings(w: World, a: Actor): void {
  const s = w.state;
  const t = spawnItem(s, "ticket", { k: "pocket", a: a.id });
  t.owner = a.id;
  if (a.seated) t.used = true;
  const shirt = a.npc!.team === 1 ? "shirt_opp" : "shirt_eng";
  spawnItem(s, shirt, { k: "worn", a: a.id, slot: a.npc!.team === 1 ? "outer" : "inner" });
}

/** Push an actor out of any wall it is not allowed through. */
function collide(w: World, a: Actor): void {
  const r = a.radius;
  for (const wl of WALLS) {
    if (a.x + r < wl.x || a.x - r > wl.x + wl.w || a.y + r < wl.y || a.y - r > wl.y + wl.h) continue;
    if (wl.gate && mayPass(w, a, wl.gate)) continue;
    const cx = Math.max(wl.x, Math.min(a.x, wl.x + wl.w)), cy = Math.max(wl.y, Math.min(a.y, wl.y + wl.h));
    let dx = a.x - cx, dy = a.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d < 1e-6) {
      // Centre inside the wall: push out the shortest way.
      const opts = [a.x - wl.x, wl.x + wl.w - a.x, a.y - wl.y, wl.y + wl.h - a.y];
      const k = opts.indexOf(Math.min(...opts));
      if (k === 0) a.x = wl.x - r; else if (k === 1) a.x = wl.x + wl.w + r; else if (k === 2) a.y = wl.y - r; else a.y = wl.y + wl.h + r;
      continue;
    }
    dx /= d; dy /= d;
    a.x = cx + dx * r; a.y = cy + dy * r;
  }
  a.x = Math.max(BOUNDS.x + 1, Math.min(BOUNDS.x + BOUNDS.w - 1, a.x));
  a.y = Math.max(BOUNDS.y + 1, Math.min(BOUNDS.y + BOUNDS.h - 1, a.y));
}

/** One fixed step of everything. */
export function stepGame(g: Game): void {
  const w = g.w, s = w.state, st = s.stadium!;
  if (st.ending) return;
  resetPathBudget();
  const t = secs(w);

  // Supporters keep arriving until just after kick-off.
  if (s.tick % (t < 150 ? 40 : 90) === 0 && t < KICKOFF_AT + 60 && Object.values(s.actors).filter((a) => a.npc?.job === "fan").length < 78) {
    const away = s.rng.world.a % 5 === 0;
    giveFanThings(w, spawnFan(w, away, false));
  }

  for (const id in s.actors) {
    const a = s.actors[id];
    if (!a.npc) continue;
    if (isSecurity(a)) stepSecurity(w, a);
    stepNpc(w, a);
  }
  const pc = s.actors[st.pc];
  if (pc && (pc.heldBy || pc.hiddenIn || pc.seated)) { pc.moveX = pc.moveY = 0; }
  const pcSpeed = pc ? pc.speed : 0;
  if (pc) {
    const wired = pc.effects.wired > s.tick, drunk = pc.effects.drunk > s.tick;
    const run = Math.hypot(pc.moveX, pc.moveY) > 0.9;
    pc.speed = (run ? 4.0 : 2.2) * (wired ? 1.2 : 1) * (drunk ? 0.92 : 1);
  }
  stepWorld(w);
  if (pc) pc.speed = pcSpeed;

  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.fb || a.off || a.hiddenIn || a.heldBy) continue;
    collide(w, a);
  }
  for (const id in st.vehicles) {
    stepVehicle(w, st.vehicles[id]);
    for (const hit of lorryHits(w, st.vehicles[id])) w.bus.emit({ type: "run_over", t: s.tick, who: hit.id });
  }
  stepRules(w);
  stepDetention(w);
  checkpoints(g);
  endings(g);
}

function checkpoints(g: Game): void {
  const s = g.w.state, st = s.stadium!, m = s.match!, pc = s.actors[st.pc];
  if (!st.admitted && pc && pc.y < 44 && pc.y > -61 && pc.x > -56 && pc.x < 56 && !pc.hiddenIn) {
    st.admitted = true;
    saveCheckpoint(g, "admission", "Inside the ground");
  }
  if (m.phase === "restart" && m.period === 1 && !g.checkpoints.some((c) => c.id === "kickoff") && m.restart?.type === "kickoff") saveCheckpoint(g, "kickoff", "Kick-off");
  if (m.phase === "break" && m.period === 1 && !g.checkpoints.some((c) => c.id === "halftime")) saveCheckpoint(g, "halftime", "Half-time");
}

function endings(g: Game): void {
  const s = g.w.state, st = s.stadium!, m = s.match!;
  if (st.ending || m.phase !== "finished") return;
  const pens = m.shootout ? ` (${m.shootout.scored[0]}–${m.shootout.scored[1]} on penalties)` : "";
  const line = `England ${m.score[0]}, ${m.teams[1].name} ${m.score[1]}${pens}.`;
  st.ending = m.winner === 0
    ? { kind: "through", title: "England are through", text: line }
    : { kind: "eliminated", title: "England are out", text: line };
  g.w.bus.emit({ type: "ending", t: s.tick, kind: st.ending.kind });
}

export function saveCheckpoint(g: Game, id: Checkpoint["id"], label: string): void {
  g.checkpoints = g.checkpoints.filter((c) => c.id !== id);
  g.checkpoints.push({ id, label, tick: g.w.state.tick, state: structuredClone(g.w.state) });
}

/** Back to a checkpoint. The match is re-rolled so nobody can bet on a result they have already seen. */
export function loadCheckpoint(g: Game, id: Checkpoint["id"]): void {
  const cp = g.checkpoints.find((c) => c.id === id);
  if (!cp) return;
  g.w.state = structuredClone(cp.state);
  g.w.state.rng.match = seedRng(`${Date.now()}:${Math.random()}`);
  const order: Checkpoint["id"][] = ["arrival", "admission", "kickoff", "halftime"];
  const keep = new Set(order.slice(0, order.indexOf(id) + 1));
  g.checkpoints = g.checkpoints.filter((c) => keep.has(c.id));
}

// A match day at one stadium: setting it up, running it, and the checkpoints.
import { ITEM_DEFS, spawnItem } from "../core/items";
import { pick, rndRange, seedRng } from "../core/rng";
import type { Actor, WorldState } from "../core/types";
import { createWorld, spawnActor, stepWorld, type World } from "../core/world";
import { createMatch, TEAMS } from "../football/setup";
import { BOUNDS, KICKOFF_AT, setBreaches, setVenue, SOLID, SPOTS, VENUE, type Venue } from "./layout";
import { newCampaign, type Campaign } from "./campaign";
import { mayPass, newNpc, resetPathBudget, secs, spawnFan, spawnStaff, stepNpc } from "./npc";
import { installBetting, installSettlement } from "./betting";
import { installPolice, stepTipoffs } from "./police";
import { createDog, installDog, stepDog } from "./dog";
import { stepKit } from "./kit";
import { createBus, driveBus, installBus, stepBus, stepBusSanctions } from "./bus";
import { installKickoff, stepKickoff } from "./kickoff";
import { installKnife, stepArmed } from "./knife";
import { installReactions, installRules, SHOPS, stepRules } from "./rules";
import { isSecurity, stepDetention, stepSecurity } from "./security";
import type { StadiumState } from "./state";
import { lorryHits, stepVehicle } from "./vehicles";

export interface Checkpoint { id: "arrival" | "admission" | "kickoff" | "halftime"; label: string; tick: number; state: WorldState }

export interface Game {
  w: World;
  checkpoints: Checkpoint[];
  opp: string;
  venue: Venue["id"];
  /** The tournament so far, as it stood when this match day began. */
  campaign: Campaign;
}

let rulesInstalled = false;

export const HALF_SECONDS = 450;
export const HALFTIME_SECONDS = 150;

export function createGame(seed: string, venueId: Venue["id"] = "qf", campaign: Campaign = newCampaign()): Game {
  if (!rulesInstalled) { installRules(); installBetting(); installPolice(); installBus(); installDog(); installKickoff(); installKnife(); rulesInstalled = true; }
  setVenue(venueId);
  const oppKey = VENUE.opp;
  const opp = TEAMS[oppKey];
  const oppShirt = `shirt_${oppKey.toLowerCase()}`;
  // The stall outside sells this opponent's shirt.
  SHOPS.merch.stock = { [oppShirt]: 45, shirt_eng: 45, mask: 8 };
  Object.assign(ITEM_DEFS.kit_opp, { name: `${opp.name} playing kit`, team: opp.short, colour: opp.colour, colour2: opp.colour2 });

  const w = createWorld(seed);
  const s = w.state, r = s.rng.world;
  const locker = spawnItem(s, "locker", { k: "ground", x: SPOTS.locker.x, y: SPOTS.locker.y });
  const st: StadiumState = {
    pc: "pc", arrivedAt: 0, gates: {}, vehicles: {}, banned: [], wanted: [], incidents: [], admitted: false, warnings: 0,
    ending: null, flags: {}, doorPass: null, detainedUntil: 0, policeCalled: false, locker: locker.id, dosed: {}, smoke: [], breaches: [], tipoffs: [], dog: null,
  };
  s.stadium = st;

  const m = createMatch(w, TEAMS.ENG, opp, { preSeconds: KICKOFF_AT, venue: true, halfSeconds: HALF_SECONDS, halfTimeSeconds: HALFTIME_SECONDS, knockout: true });
  // England start in their dressing room; the opposition at their hotel, waiting for the bus.
  for (const t of [0, 1] as const) {
    const room = t === 0 ? SPOTS.homeRoom : SPOTS.hotelLobby;
    m.teams[t].squad.forEach((id, i) => {
      const a = s.actors[id];
      a.x = room.x + ((i % 5) - 2) * 1.6; a.y = room.y + (Math.floor(i / 5) - 1) * 1.6;
      a.fb!.tx = a.x; a.fb!.ty = a.y;
      a.npc = newNpc("player", "footballer");
    });
  }
  const offIds = [m.officials.referee, ...m.officials.assistants, m.officials.fourth];
  offIds.forEach((id, i) => { const a = s.actors[id]; a.x = SPOTS.refRoom.x + (i - 1.5) * 1.6; a.y = SPOTS.refRoom.y; a.npc = newNpc("official", "referee"); });

  // The player, with whatever he chose to bring.
  const pc = spawnActor(s, "protagonist", "Barry", SPOTS.arrival.x, SPOTS.arrival.y, { id: "pc", radius: 0.55, speed: 2.2, money: campaign.money });
  pc.facing = -Math.PI / 2;
  const load = campaign.loadout.includes("shirt_eng") ? campaign.loadout : ["shirt_eng", ...campaign.loadout];
  for (const d of load) {
    const def = ITEM_DEFS[d];
    if (!def) continue;
    if (def.slot && !pc.worn[d === "shirt_eng" && def.slot === "inner" ? "inner" : def.slot]) spawnItem(s, d, { k: "worn", a: pc.id, slot: def.slot });
    else if (def.size === "small" && pc.pockets.length < 3) spawnItem(s, d, { k: "pocket", a: pc.id });
    else if (!pc.hand) spawnItem(s, d, { k: "hand", a: pc.id });
    else if (def.size === "small") spawnItem(s, d, { k: "pocket", a: pc.id });
  }
  // Fame travels. A known face is barred before he arrives, and stewards have his description.
  if (campaign.notoriety >= 1) {
    st.banned.push(pc.faceId);
    st.wanted.push({ face: pc.faceId, team: null, role: "fan", outer: null, look: "", severity: Math.min(1, 0.4 + campaign.notoriety * 0.2), until: 60 * 60 * 120, what: "being a known troublemaker" });
  }

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
  staff("patrol", "steward", "Steward Alan", VENUE.patrolLoop[0], E);
  staff("patrol", "steward", "Steward Denise", VENUE.patrolLoop[3], W);
  staff("corridor", "steward", "Steward Brian", SPOTS.corridorPost, S);
  staff("chief", "steward", "Head of Security", SPOTS.chiefDesk, N);
  staff("police", "police", "PC Hargreaves", VENUE.policeSpots[0], S);
  staff("police", "police", "PC Okafor", VENUE.policeSpots[3], S);
  if (campaign.notoriety >= 2) staff("police", "police", "PC Sharma", { x: SPOTS.turnstiles[1].x + 3, y: 47 }, S);
  staff("barman", "catering", "Landlord", SPOTS.pubBarman, S, { shop: "pub" });
  staff("barman", "catering", "Barmaid", SPOTS.barSman, N, { shop: "bar" });
  staff("seller", "none", "Ticket office", SPOTS.ticketSeller, S, { shop: "ticket" });
  staff("seller", "none", "Stallholder", SPOTS.merchSeller, S, { shop: "merch" });
  staff("seller", "none", "Rose", SPOTS.charity, S, { shop: "charity", lines: ["All proceeds to the donkey sanctuary.", "Chef's whites came in this morning. Fits a big lad."] });
  staff("seller", "none", "Sarge", SPOTS.surplus, S, { shop: "surplus", lines: ["Flares are for boats. Officially.", "Cash only. No questions."] });
  staff("seller", "none", "Lucky Lionel", SPOTS.bookie, S, { shop: "bookies", lines: ["England? Brave. I like it.", "Odds change when the score does, sunshine.", "No refunds on acts of God. Or acts of you."] });
  staff("seller", "none", "Kiosk", SPOTS.kiosk, N, { shop: "bookies", lines: ["Bets close fifteen seconds after a goal.", "Next goal's the one everyone wants."] });
  staff("cleaner", "cleaner", "Cleaner", VENUE.cleanerSpots[0], E);
  staff("cook", "catering", "Cook", SPOTS.kitchenSpot, S);

  // Locals: no ticket, plenty of opinions.
  for (let i = 0; i < 26; i++) {
    const p = i % 3 !== 2 ? { x: rndRange(r, -58, -38), y: rndRange(r, 69, 78) } : { x: rndRange(r, -40, 40), y: rndRange(r, 50, 58) };
    const a = spawnStaff(w, "local", "fan", pick(r, ["Big Kev", "Tel", "Mad Dog", "Sue", "Grandad", "Spencer", "Lisa", "Wolfie"]), p.x, p.y);
    a.money = Math.round(rndRange(r, 15, 90));
    a.npc!.post = undefined;
  }

  // The beer lorry and its crew.
  const [lx, ly] = VENUE.delivery.route;
  const cargo = spawnItem(s, "lorry_cargo", { k: "ground", x: lx, y: ly - 4 });
  const driver = spawnStaff(w, "driver", "catering", VENUE.id === "qf" ? "Lorry driver" : "Van driver", lx, ly);
  spawnStaff(w, "worker", "catering", VENUE.id === "qf" ? "Drayman" : "Caterer", lx - 2 * Math.sign(lx || 1), ly - 4).npc!.post = undefined;
  createBus(w, oppKey);
  st.vehicles.lorry = { id: "lorry", kind: "lorry", x: lx, y: ly, facing: S, route: [lx, ly], ri: 0, speed: 0, state: "loading", until: 60 * 45, cargo: cargo.id, driver: driver.id, cycle: 0, inspected: false };

  // Things lying about, for whoever finds them. (Positions are for the quarter-final; the semi-final is mirrored.)
  const vx = (x: number) => (VENUE.id === "sf" ? -x : x);
  spawnItem(s, "hivis", { k: "ground", x: SPOTS.cabinHook.x, y: SPOTS.cabinHook.y });
  // The police van, with a spare uniform in the back.
  const box = spawnItem(s, "police_box", { k: "ground", x: SPOTS.policeVan.x, y: SPOTS.policeVan.y });
  spawnItem(s, "police_uniform", { k: "in", c: box.id });
  spawnItem(s, "police_hat", { k: "in", c: box.id });
  if (VENUE.features.staffPass) {
    spawnItem(s, "staff_pass", { k: "ground", x: SPOTS.cabinHook.x - 1.2 * Math.sign(SPOTS.cabinHook.x), y: SPOTS.cabinHook.y + 1.5 });
    // Every steward carries one, which makes them worth robbing.
    for (const id in s.actors) { const a = s.actors[id]; if (a.npc && a.npc.role === "steward") spawnItem(s, "staff_pass", { k: "pocket", a: a.id }); }
  }
  spawnItem(s, "laxative", { k: "ground", x: vx(-56.5), y: 63.4 });
  spawnItem(s, "powder", { k: "ground", x: vx(-60.6), y: 63.2 });
  spawnItem(s, "knife", { k: "ground", x: vx(-38.5), y: -57 });
  spawnItem(s, "ref_kit", { k: "ground", x: vx(-3.5), y: -59 });
  spawnItem(s, "whistle", { k: "ground", x: vx(3.5), y: -59 });
  // Kit hampers in the dressing rooms, with a spare strip in each.
  const homeHamper = spawnItem(s, "kit_hamper", { k: "ground", x: SPOTS.homeRoom.x + 5 * Math.sign(SPOTS.homeRoom.x), y: SPOTS.homeRoom.y + 4 });
  spawnItem(s, "kit_eng", { k: "in", c: homeHamper.id });
  const awayHamper = spawnItem(s, "kit_hamper", { k: "ground", x: SPOTS.awayRoom.x + 5 * Math.sign(SPOTS.awayRoom.x), y: SPOTS.awayRoom.y + 4 });
  spawnItem(s, "kit_opp", { k: "in", c: awayHamper.id });
  spawnItem(s, "cooler_home", { k: "ground", x: vx(-24.5), y: -58.5 });
  spawnItem(s, "cooler_away", { k: "ground", x: vx(24.5), y: -58.5 });
  spawnItem(s, "tea_urn", { k: "ground", x: vx(1), y: -59 });

  // Supporters already in their seats; more arrive over the next few minutes.
  for (let i = 0; i < 70; i++) giveFanThings(w, spawnFan(w, i % 6 === 5, true));

  createDog(w);
  installReactions(w);
  installSettlement(w);
  const g: Game = { w, checkpoints: [], opp: oppKey, venue: venueId, campaign };
  saveCheckpoint(g, "arrival", "Arrival outside the ground");
  return g;
}

function giveFanThings(w: World, a: Actor): void {
  const s = w.state;
  const t = spawnItem(s, "ticket", { k: "pocket", a: a.id });
  t.owner = a.id;
  if (a.seated) t.used = true;
  const shirt = a.npc!.team === 1 ? `shirt_${VENUE.opp.toLowerCase()}` : "shirt_eng";
  spawnItem(s, shirt, { k: "worn", a: a.id, slot: a.npc!.team === 1 ? "outer" : "inner" });
}

/** Push an actor out of any wall it is not allowed through. */
function collide(w: World, a: Actor): void {
  const r = a.radius;
  for (const wl of SOLID) {
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

/** Walking supporters at once (on top of the painted crowd in the stands). */
export const MAX_FANS = 240;
const fanCount = (s: World["state"]) => { let n = 0; for (const id in s.actors) if (s.actors[id].npc?.job === "fan" && !s.actors[id].dead) n++; return n; };

/** One fixed step of everything. */
export function stepGame(g: Game): void {
  const w = g.w, s = w.state, st = s.stadium!;
  if (st.ending) return;
  setBreaches(st.breaches);
  resetPathBudget();
  const t = secs(w);

  // Supporters keep arriving until just after kick-off.
  if (s.tick % (t < 150 ? 10 : t < KICKOFF_AT ? 20 : 60) === 0 && t < KICKOFF_AT + 60 && fanCount(s) < MAX_FANS) {
    const away = s.rng.world.a % 5 === 0;
    giveFanThings(w, spawnFan(w, away, false));
  }

  const pc = s.actors[st.pc];
  const bus = st.vehicles.bus;
  if (bus && pc && bus.drivenBy === pc.id) driveBus(w, bus, pc);
  for (const id in s.actors) {
    const a = s.actors[id];
    if (!a.npc) continue;
    if (isSecurity(a)) stepSecurity(w, a);
    stepNpc(w, a);
  }
  if (pc && (pc.heldBy || pc.hiddenIn || pc.seated)) { pc.moveX = pc.moveY = 0; }
  const pcSpeed = pc ? pc.speed : 0;
  if (pc) {
    const wired = pc.effects.wired > s.tick, drunk = pc.effects.drunk > s.tick;
    // A fat man can sprint, briefly. Running drains his breath; walking gets it back.
    const f = st.flags;
    f.stamina ??= 1;
    const wantRun = Math.hypot(pc.moveX, pc.moveY) > 0.9;
    const run = wantRun && f.stamina > 0.02 && !f.winded;
    f.stamina = Math.max(0, Math.min(1, f.stamina + (run ? -0.11 : 0.08) / 60 * (wired ? 0.5 : 1)));
    if (f.stamina <= 0.02 && !f.winded) { f.winded = 1; g.w.bus.emit({ type: "winded", t: s.tick, who: pc.id }); }
    if (f.winded && f.stamina > 0.35) f.winded = 0;
    pc.speed = (run ? 6.4 : 4.4) * (wired ? 1.15 : 1) * (drunk ? 0.92 : 1) * (f.winded ? 0.75 : 1);
  }
  stepWorld(w);
  if (pc) pc.speed = pcSpeed;

  for (const id in s.actors) {
    const a = s.actors[id];
    if ((a.fb && !a.fb.controlled) || a.off || a.hiddenIn || a.heldBy) continue;
    collide(w, a);
  }
  for (const id in st.vehicles) {
    const v = st.vehicles[id];
    if (v.kind === "bus") { stepBus(w, v); continue; }
    stepVehicle(w, v);
    for (const hit of lorryHits(w, v)) w.bus.emit({ type: "run_over", t: s.tick, who: hit.id });
  }
  stepBusSanctions(w);
  stepDog(w);
  stepKit(w);
  stepKickoff(w);
  stepArmed(w);
  stepRules(w);
  stepTipoffs(w);
  stepDetention(w);
  checkpoints(g);
  endings(g);
}

function checkpoints(g: Game): void {
  const s = g.w.state, st = s.stadium!, m = s.match!, pc = s.actors[st.pc];
  if (!st.admitted && pc && VENUE.inside(pc.x, pc.y) && !pc.hiddenIn) {
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
  const forfeit = st.flags.forfeit;
  const line = forfeit === 1 ? `${m.teams[1].name} couldn't put eleven men on the pitch, or even seven. The match is awarded to England without a ball being kicked.`
    : forfeit === 2 ? "England couldn't field a team. The match is awarded to the other lot."
    : `England ${m.score[0]}, ${m.teams[1].name} ${m.score[1]}${pens}.`;
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
  setVenue(g.venue);
  g.w.state = structuredClone(cp.state);
  g.w.state.rng.match = seedRng(`${Date.now()}:${Math.random()}`);
  const order: Checkpoint["id"][] = ["arrival", "admission", "kickoff", "halftime"];
  const keep = new Set(order.slice(0, order.indexOf(id) + 1));
  g.checkpoints = g.checkpoints.filter((c) => keep.has(c.id));
}

// A match day at one stadium: setting it up, running it, and the checkpoints.
import { ITEM_DEFS, spawnItem } from "../core/items";
import { pick, rndRange, seedRng } from "../core/rng";
import type { Actor, WorldState } from "../core/types";
import { createWorld, spawnActor, stepWorld, type World } from "../core/world";
import { createMatch, TEAMS } from "../football/setup";
import { arrivalSpot, BOUNDS, KICKOFF_AT, PACE, rushAt, setBreaches, setVenue, SOLID, SPOTS, VENUE, type Venue } from "./layout";
import { newCampaign, type Campaign } from "./campaign";
import { mayPass, newNpc, resetPathBudget, say, secs, spawnFan, spawnStaff, stepNpc } from "./npc";
import { installBetting, installSettlement } from "./betting";
import { installPolice, stepTipoffs } from "./police";
import { createDog, installDog, stepDog } from "./dog";
import { stepKit } from "./kit";
import { BUS_LEN, BUS_WID, createBus, driveBus, installBus, stepBus, stepBusSanctions } from "./bus";
import { installKickoff, stepKickoff } from "./kickoff";
import { installKnife, stepArmed } from "./knife";
import { installGloryHole } from "./gloryhole";
import { stepTraffic } from "./traffic";
import { installCombat, stepCombat } from "./combat";
import { installHorse, stepHorse, takeReins } from "./horse";
import { installRoutes } from "./routes";
import { hearLead, installEntries, spawnEntries, stepEntries } from "./entries";
import { installDetector } from "./detector";
import { installCoverup, stepCoverups } from "./coverup";
import { FEMALE_LOCALS } from "./npc";
import { installLech } from "./lech";
import { stepChat } from "./chatter";
import { clampToRoof, installRoofs } from "./roofs";
import { installMissiles, spawnBricks, stepStench } from "./missiles";
import { installChainHooks, installKegs, spawnKegs, stepKegs, stepPawnSeek } from "./kegs";
import { installBallOut, installBallWatch, stepBallOut } from "./ballout";
import { spawnBootBag, stepBootBag } from "./bootbag";
import { installCoke, stepCoke } from "./coke";
import { installLulls, stepLulls } from "./lulls";
import { installFixes, stepFixes } from "./fixes";
import { installWitness, stepSnitches } from "./witness";
import { installPhone, stepPhone } from "./phone";
import { installNaked, stepNaked } from "./naked";
import { noteKnockout, spawnScenarios, stepScenarios } from "./scenarios";
import { driveCar, installCars } from "./cars";
import { BIKE_SPEED, BIKE_SPRINT, installBike, stepBikes } from "./bike";
import { installReactions, installRules, SHOPS, stepRules } from "./rules";
import { changedClothes, isSecurity, stepDetention, stepHeat, stepRadio, stepSecurity } from "./security";
import type { StadiumState } from "./state";
import { LORRY_LEN, LORRY_WID, lorryHits, stepVehicle } from "./vehicles";
import { stepCreeps } from "./drag";

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
  if (!rulesInstalled) { installRules(); installBetting(); installPolice(); installBus(); installDog(); installKickoff(); installKnife(); installGloryHole(); installCombat(); installHorse(); installRoutes(); installEntries(); installDetector(); installCoverup(); installBike(); installLech(); installCars(); installWitness(); installPhone(); installNaked(); installRoofs(); installKegs(); installBallOut(); installCoke(); rulesInstalled = true; }
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
  const pc = spawnActor(s, "protagonist", "Grozz", arrivalSpot().x, arrivalSpot().y, { id: "pc", radius: 0.55, speed: 2.2, money: campaign.money });
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
  // PC Hargreaves is on horseback.
  staff("police", "police", "PC Hargreaves", VENUE.policeSpots[0], S).npc!.mounted = true;
  staff("police", "police", "PC Okafor", VENUE.policeSpots[3], S);
  if (campaign.notoriety >= 2) staff("police", "police", "PC Sharma", { x: SPOTS.turnstiles[1].x + 3, y: 47 }, S);
  staff("barman", "catering", "Landlord", SPOTS.pubBarman, S, { shop: "pub" });
  staff("barman", "catering", "Barmaid", SPOTS.barSman, N, { shop: "bar" });
  staff("seller", "none", "Ticket office", SPOTS.ticketSeller, S, { shop: "ticket" });
  staff("seller", "none", "Stallholder", SPOTS.merchSeller, S, { shop: "merch" });
  staff("seller", "none", "Rose", SPOTS.charity, S, { shop: "charity", lines: ["Chef's whites came in this morning. Fits a big lad. Nobody stops a man in whites in a kitchen.", "All proceeds to the donkey sanctuary.", "Lovely frock on the dummy, that. Big sizes in the back."] });
  staff("seller", "none", "Sarge", SPOTS.surplus, S, { shop: "surplus", lines: ["Sold a ladder to a fella last week. Said the stand roof's the best seat in the house. Up there with a brick, you'd be king.", "Them stink cans are army grade. Clears a room. Clears a stand.", "Flares are for boats. Officially.", "Cash only. No questions."] });
  staff("seller", "none", "Lionel", SPOTS.bookie, S, { shop: "pawn", lines: ["Their keeper was in here pawning his watch. He likes a bet, that one. Owes half the bookies in town.", "Wallets, phones, passes, shirts. I don't ask. You don't tell.", "Shut the bookie's down after the last World Cup. This pays better.", "Anything with a face on it, I'm not touching."] });
  staff("seller", "none", "Kiosk", SPOTS.kiosk, N, { shop: "kiosk", lines: ["Pies are hot. Ish.", "We've run out of Bovril. Don't start."] });
  staff("cleaner", "cleaner", "Cleaner", VENUE.cleanerSpots[0], E);
  staff("cook", "catering", "Cook", SPOTS.kitchenSpot, S);
  // The people with hooks. Del sells tickets cheaper than the office and carries plenty more.
  const del = staff("seller", "none", "Dodgy Del", SPOTS.tout, S, { shop: "tout", lines: ["Tickets, tickets. Buy or sell.", "Forty-five, cash, don't look at me like that.", "Old Bill's on the horse today. Mind his back end."] });
  del.money = 220;
  for (let i = 0; i < 3; i++) spawnItem(s, "ticket", { k: "pocket", a: del.id });
  // Wally the kit man and his swipe card.
  const wally = staff("kitman", "catering", "Wally the kit man", SPOTS.pubBarman, S, { post: undefined });
  wally.x += 2; wally.y += 3.6;
  spawnItem(s, "kit_card", { k: "pocket", a: wally.id });
  // The telly: a reporter doing pieces to camera on the approach, with his cameraman.
  staff("press", "none", "Reporter", SPOTS.reporter, S);
  staff("press", "none", "Cameraman", SPOTS.cameraman, N, { lines: ["The builders on that scaffold by the car park walk right over the roof and down into the tunnel. Best shot in the ground.", "Mind the cable.", "Rolling."] });
  // Old Reg the groundsman, at his shed. His wrench is lying about nearby.
  staff("groundsman", "none", "Old Reg", SPOTS.shed, E);
  spawnItem(s, "wrench", { k: "ground", x: SPOTS.shed.x + 1.4, y: SPOTS.shed.y + 2.4 });
  // Somebody's old pay-as-you-go, dropped behind the pub bins.
  spawnItem(s, "burner", { k: "ground", x: SPOTS.pubYard.x + 2.2, y: SPOTS.pubYard.y + 1.6 });
  spawnEntries(w, staff);
  spawnScenarios(w);
  spawnBricks(w);
  spawnKegs(w);
  // The gate and door stewards carry their own radios in the game (worth nicking, worth pawning).
  if (PACE.calm) for (const id in s.actors) { const a = s.actors[id]; if (a.npc && ["turnstile", "doorguard", "gateguard"].includes(a.npc.job)) spawnItem(s, "radio", { k: "pocket", a: a.id }); }
  // Things to hit people with: empties on the pub tables and round the bins, chairs in the pub,
  // pint glasses on the concourse bar, and the corner flags.
  const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
  for (const [x, y] of [[-57.2, 73.9], [-52.6, 79], [-58.9, 78.3], [-58.5, 0.5], [-58, -30], [-23.6, 79.2], [5.4, 73.4], [-28, 72.4]] as const) spawnItem(s, "bottle", { k: "ground", x: mx(x), y });
  for (const [x, y] of [[-59.4, 73.6], [-56.6, 78.2], [-55, 78.8]] as const) spawnItem(s, "chair", { k: "ground", x: mx(x), y });
  // A cue left on the pool table.
  if (!VENUE.features.fanZone) spawnItem(s, "pool_cue", { k: "ground", x: mx(-49.6), y: 74 });
  for (const [x, y] of [[-15.5, 41.4], [-10.5, 41.6], [-44, 68.6]] as const) spawnItem(s, "pint_glass", { k: "ground", x: mx(x), y });
  for (const [x, y] of [[-36, -23], [36, -23], [-36, 23], [36, 23]] as const) spawnItem(s, "corner_flag", { k: "ground", x, y });

  // Locals: no ticket, plenty of opinions.
  for (let i = 0; i < 26; i++) {
    const p = i % 3 !== 2 ? { x: rndRange(r, -58, -38), y: rndRange(r, 69, 78) } : { x: rndRange(r, -40, 40), y: rndRange(r, 50, 58) };
    const a = spawnStaff(w, "local", "fan", pick(r, ["Big Kev", "Tel", "Mad Dog", "Sue", "Grandad", "Spencer", "Lisa", "Wolfie"]), p.x, p.y);
    a.money = Math.round(rndRange(r, 15, 90));
    a.npc!.post = undefined;
    if (FEMALE_LOCALS.has(a.name)) a.female = true;
  }

  // The beer lorry and its crew.
  const [lx, ly] = VENUE.delivery.route;
  const cargo = spawnItem(s, "lorry_cargo", { k: "ground", x: lx, y: ly - 4 });
  const driver = spawnStaff(w, "driver", "catering", VENUE.id !== "sf" ? "Lorry driver" : "Van driver", lx, ly);
  spawnStaff(w, "worker", "catering", VENUE.id !== "sf" ? "Drayman" : "Caterer", lx - 2 * Math.sign(lx || 1), ly - 4).npc!.post = undefined;
  createBus(w, oppKey);
  spawnBootBag(w);
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
  for (let i = 0; i < (PACE.calm ? 30 : 70); i++) giveFanThings(w, spawnFan(w, i % 6 === 5, true));

  createDog(w);
  installReactions(w);
  installChainHooks(w);
  installBallWatch(w);
  installLulls(w);
  installMissiles(w);
  installFixes(w);
  // A change of clothes out of sight shakes off whoever was after you.
  w.bus.on((e) => {
    if (e.type === "action" && e.action.actor === st.pc && ["wear", "remove", "strip", "dress"].includes(e.action.verb)) changedClothes(w, s.actors[st.pc]);
  });
  w.bus.on((e) => { if (e.type === "knockout") noteKnockout(w, e.who, e.by); });
  // Flatten one of the stewards hunting you while they're searching and the search is shorter
  // (Chinatown Wars: take out your pursuers to shake the heat).
  w.bus.on((e) => {
    if (e.type !== "knockout") return;
    const v = s.actors[e.who], f = st.flags;
    if (!v?.npc || !isSecurity(v) || v.npc.target !== st.pc || !f.evadeUntil || f.evadeUntil <= s.tick) return;
    f.evadeUntil = Math.max(s.tick + 60, f.evadeUntil - 60 * 4);
    w.bus.emit({ type: "heat_shed", t: s.tick, who: v.id });
  });
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

/** Vehicles are solid to walk into (not just to be run over by): the lorry and the coach while
 *  they're stood or crawling, the traffic, your own car when you're out of it, the vans by the
 *  ground. Only for you: everyone else's routes are planned round the walls, and a crowd bunched
 *  behind a parked lorry would be worse than the odd fan stepping through one. Something moving
 *  quickly isn't a wall; it's what knocks you down. */
function vehicleBoxes(w: World, pc: Actor): { x: number; y: number; ang: number; hl: number; hw: number }[] {
  const st = w.state.stadium!, out: { x: number; y: number; ang: number; hl: number; hw: number }[] = [];
  for (const id in st.vehicles) {
    const v = st.vehicles[id];
    if (v.speed > 1.5 || v.drivenBy === pc.id || (v.state === "driving" && v.kind === "lorry" && v.speed > 0.5)) continue;
    out.push(v.kind === "bus" ? { x: v.x, y: v.y, ang: v.facing, hl: BUS_LEN / 2, hw: BUS_WID / 2 } : { x: v.x, y: v.y, ang: v.facing, hl: LORRY_LEN / 2, hw: LORRY_WID / 2 });
  }
  for (const c of st.traffic ?? []) out.push({ x: c.x, y: c.y, ang: 0, hl: 2.1, hw: 0.85 });
  const m = st.myCar;
  if (m && !m.driving) out.push({ x: m.x, y: m.y, ang: m.facing, hl: 2.1, hw: 0.9 });
  const mx = VENUE.id === "sf" ? -1 : 1;
  out.push({ x: 32 * mx, y: 54.9, ang: 0, hl: 2.6, hw: 0.7 }, { x: 46 * mx, y: 52.2, ang: 0, hl: 2.6, hw: 0.8 }); // the police van, the burger van
  return out;
}
function collideVehicles(w: World, a: Actor): void {
  if (a.hiddenIn || a.heldBy || a.roof || a.bike || w.state.stadium!.horse?.rider === a.id) return;
  const r = a.radius;
  for (const b of vehicleBoxes(w, a)) {
    const c = Math.cos(b.ang), sn = Math.sin(b.ang), dx = a.x - b.x, dy = a.y - b.y;
    const al = dx * c + dy * sn, ac = -dx * sn + dy * c;
    const pl = b.hl + r - Math.abs(al), pw = b.hw + r - Math.abs(ac);
    if (pl <= 0 || pw <= 0) continue;
    if (pl < pw) { const d = Math.sign(al || 1) * pl; a.x += c * d; a.y += sn * d; }
    else { const d = Math.sign(ac || 1) * pw; a.x += -sn * d; a.y += c * d; }
  }
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
  const every = PACE.calm ? (t < rushAt() ? 45 : t < KICKOFF_AT ? 12 : 60) : t < 150 ? 10 : t < KICKOFF_AT ? 20 : 60;
  if (s.tick % every === 0 && t < KICKOFF_AT + 60 && fanCount(s) < MAX_FANS) {
    const away = s.rng.world.a % 5 === 0;
    giveFanThings(w, spawnFan(w, away, false));
  }

  const pc = s.actors[st.pc];
  const bus = st.vehicles.bus;
  if (bus && pc && bus.drivenBy === pc.id) driveBus(w, bus, pc);
  if (pc && st.myCar?.driving) driveCar(w, pc);
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
    f.stamina = 1; // running out of breath was no fun
    void wired;
    if (f.stamina <= 0.02 && !f.winded) { f.winded = 1; g.w.bus.emit({ type: "winded", t: s.tick, who: pc.id }); }
    if (f.winded && f.stamina > 0.35) f.winded = 0;
    const comedown = (pc.effects.comedown ?? 0) > s.tick && !wired;
    pc.speed = (run ? 7.3 : 5.2) * (wired ? 1.3 : comedown ? 0.85 : 1) * (drunk ? 0.92 : 1) * (f.winded ? 0.75 : 1) * (pc.dragging ? 0.45 : 1);
    if (pc.bike) pc.speed = (wantRun ? BIKE_SPRINT : BIKE_SPEED) * (drunk ? 0.85 : 1);
  }
  const reins = takeReins(w);
  stepWorld(w);
  stepHorse(w, reins);
  if (pc) pc.speed = pcSpeed;

  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.knock) {
      // Sent flying by a blow: fast at first, sliding to a stop; walls still stop you.
      if (s.tick >= a.knock.until || a.hiddenIn || a.heldBy) delete a.knock;
      else { const k = (a.knock.until - s.tick) / (a.knock.until - a.knock.from); a.x += (a.knock.vx * k * k) / 60; a.y += (a.knock.vy * k * k) / 60; }
    }
    if ((a.fb && !a.fb.controlled && !a.knock) || a.off || a.hiddenIn || a.heldBy) continue;
    if (a.roof && clampToRoof(a)) continue; // up on a roof: no walls, just the edges
    collide(w, a);
    if (a.id === st.pc) collideVehicles(w, a);
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
  stepTraffic(w);
  stepCombat(w);
  stepCreeps(w);
  stepKegs(w);
  stepPawnSeek(w);
  stepBallOut(w);
  stepBootBag(w);
  stepCoke(w);
  stepLulls(w);
  stepOpening(w);
  stepEntries(w);
  stepCoverups(w);
  stepChat(w);
  stepStench(w);
  stepFixes(w);
  stepSnitches(w);
  stepPhone(w);
  stepNaked(w);
  stepScenarios(w);
  stepBikes(w);
  stepRadio(w);
  stepHeat(w);
  stepArmed(w);
  stepRules(w);
  stepTipoffs(w);
  stepDetention(w);
  checkpoints(g);
  endings(g);
}

/** The report's first five minutes, after the keg: a lead overheard, a warning in the world before the
 *  gate rush, and the rush itself as cover ("crowds cover trouble"). Game build only. */
function stepOpening(w: World): void {
  if (!PACE.calm) return;
  const s = w.state, st = s.stadium!, tick = s.tick, t = tick / 60, pc = s.actors[st.pc];
  if (!pc) return;
  // 2:30: someone near you tells their mate the turnstiles get rammed later (a lead, not a marker).
  if (!st.flags.gossipRush && t >= 150 && tick % 30 === 0) {
    const fan = Object.values(s.actors).filter((a) => a.npc && (a.npc.job === "fan" || a.npc.job === "local") && !a.hiddenIn && !a.dead && a.downUntil <= tick && !a.npc.bubble)
      .sort((p, q) => Math.hypot(p.x - pc.x, p.y - pc.y) - Math.hypot(q.x - pc.x, q.y - pc.y))[0];
    if (fan && Math.hypot(fan.x - pc.x, fan.y - pc.y) < 10) {
      st.flags.gossipRush = tick;
      const line = "Wait for the rush at the turnstiles. Gets rammed just before kick-off. Stewards can't see a thing in that crush.";
      say(w, fan, line, 6);
      hearLead(w, line);
    } else if (t > 240) st.flags.gossipRush = tick;
  }
  // Two minutes before the rush: the turnstile stewards brace themselves, out loud.
  if (!st.flags.rushWarn && t >= rushAt() - 120) {
    st.flags.rushWarn = tick;
    const stw = Object.values(s.actors).filter((a) => a.npc?.job === "turnstile" && !a.dead);
    stw.forEach((a, i) => { if (i === 0) say(w, a, "Two minutes, lads. Then the whole lot come at once.", 5); else if (i === 1) say(w, a, "Christ. Here we go.", 4); });
    w.bus.emit({ type: "rush_soon", t: tick });
  }
  // In the crush: packed in with four or more around you during the rush, stewards beyond arm's reach
  // can't pick you out (security.ts reads this).
  if (tick % 10 === 0 && t >= rushAt() && t < KICKOFF_AT + 30) {
    let n = 0;
    for (const id in s.actors) { const a = s.actors[id]; if (a.npc && a.id !== pc.id && !a.hiddenIn && Math.hypot(a.x - pc.x, a.y - pc.y) < 2.5) n++; }
    if (n >= 4) st.flags.crowdCover = tick + 12;
  }
}

function checkpoints(g: Game): void {
  const s = g.w.state, st = s.stadium!, m = s.match!, pc = s.actors[st.pc];
  if (!st.admitted && pc && VENUE.inside(pc.x, pc.y) && !pc.hiddenIn) {
    st.admitted = true;
    saveCheckpoint(g, "admission", "Inside the ground");
  }
  if (m.phase === "restart" && m.period === 1 && !g.checkpoints.some((c) => c.id === "kickoff") && m.restart?.type === "kickoff") saveCheckpoint(g, "kickoff", "Kick-off");
  // Half-time isn't saved by itself in the game (it might be a disaster you'd be stuck with); the menu
  // offers to keep it. The tests keep the old automatic save.
  if (!PACE.calm && m.phase === "break" && m.period === 1 && !g.checkpoints.some((c) => c.id === "halftime")) saveCheckpoint(g, "halftime", "Half-time");
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
    ? { kind: "through", title: VENUE.id === "final" ? "England are world champions" : "England are through", text: line }
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

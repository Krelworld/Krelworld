import assert from "node:assert/strict";
import { test } from "node:test";
import { appearance } from "../src/core/identity";
import { spawnItem } from "../src/core/items";
import type { Actor } from "../src/core/types";
import { dispatch } from "../src/core/verbs";
import { createGame, loadCheckpoint, stepGame, type Game } from "../src/stadium/game";
import { areaAt, SPOTS } from "../src/stadium/layout";
import { canSee, witnessesOf } from "../src/stadium/security";
import { callArmed } from "../src/stadium/knife";
import { aimThrow } from "../src/stadium/context";

const pcOf = (g: Game) => g.w.state.actors[g.w.state.stadium!.pc];
const find = (g: Game, pred: (a: Actor) => boolean) => Object.values(g.w.state.actors).find(pred)!;
const run = (g: Game, seconds: number, each?: () => void) => { for (let i = 0; i < seconds * 60; i++) { each?.(); stepGame(g); } };
/** Walk the player straight towards a point. */
function walk(g: Game, x: number, y: number, maxSeconds = 30): void {
  const pc = pcOf(g);
  run(g, maxSeconds, () => {
    const dx = x - pc.x, dy = y - pc.y, d = Math.hypot(dx, dy);
    if (d < 0.4) { pc.moveX = pc.moveY = 0; return; }
    pc.moveX = (dx / d) * 0.8; pc.moveY = (dy / d) * 0.8;
  });
  pc.moveX = pc.moveY = 0;
}

test("a bought ticket gets you through the turnstile, once", () => {
  const g = createGame("ticket");
  const pc = pcOf(g);
  const seller = find(g, (a) => a.npc?.shop === "ticket");
  walk(g, SPOTS.ticketWindow.x, SPOTS.ticketWindow.y, 20);
  assert.equal(dispatch(g.w, { verb: "buy", actor: pc.id, target: { k: "actor", id: seller.id }, arg: "ticket" }).ok, true);
  assert.equal(pc.money, 90);
  const ticket = pc.hand!;
  walk(g, 0, 46.3, 20);
  const steward = find(g, (a) => a.npc?.job === "turnstile" && Math.abs(a.x) < 1);
  assert.equal(dispatch(g.w, { verb: "show", actor: pc.id, item: ticket, target: { k: "actor", id: steward.id } }).ok, true);
  assert.equal(g.w.state.items[ticket].used, true);
  walk(g, 0, 40, 10);
  assert.ok(pc.y < 44, `should be inside, is at ${pc.y.toFixed(1)}`);
  assert.equal(g.w.state.stadium!.admitted, true);
  assert.ok(g.checkpoints.some((c) => c.id === "admission"));
});

test("without a ticket the turnstile stays shut", () => {
  const g = createGame("noticket");
  walk(g, 0, 46.3, 20);
  walk(g, 0, 40, 6);
  assert.ok(pcOf(g).y > 44.5);
});

test("hiding in the beer lorry can carry you into the loading bay", () => {
  // The gate guard sometimes looks in the back; try a few match days.
  let inside = 0, caught = 0;
  for (const seed of ["lorry1", "lorry2", "lorry3", "lorry4", "lorry5", "lorry6"]) {
    const g = createGame(seed);
    const pc = pcOf(g), s = g.w.state, v = s.stadium!.vehicles.lorry;
    pc.x = -28; pc.y = 68.6;
    run(g, 1);
    assert.equal(v.state, "loading");
    // Wait until the drayman has gone inside with a crate, then climb in.
    const mate = find(g, (a) => a.npc?.job === "worker");
    const away = () => witnessesOf(g.w, pc.x, pc.y, [pc.id], false).length === 0;
    let hid = false;
    run(g, 44, () => { if (!hid && away() && v.state === "loading" && dispatch(g.w, { verb: "hide", actor: pc.id, target: { k: "item", id: v.cargo } }).ok) hid = true; });
    assert.ok(hid);
    run(g, 100, () => {
      if (v.state !== "unloading" || !pc.hiddenIn) return;
      const rear = { x: v.x + 4.1, y: v.y };
      if (witnessesOf(g.w, rear.x, rear.y, [pc.id], false).length === 0) dispatch(g.w, { verb: "unhide", actor: pc.id });
    });
    if (areaAt(pc.x, pc.y).id === "loading") inside++;
    if (s.stadium!.incidents.some((i) => i.what === "stowaway")) caught++;
  }
  assert.ok(inside >= 1, "at least once he should get in unseen");
  assert.ok(inside + caught >= 4, `got in ${inside}, caught ${caught}`);
});

test("a hi-vis vest gets you waved through the staff door", () => {
  const g = createGame("vest");
  const pc = pcOf(g);
  spawnItem(g.w.state, "hivis", { k: "worn", a: pc.id, slot: "outer" });
  pc.x = 59.5; pc.y = 54;
  run(g, 1);
  walk(g, 59.5, 47, 12);
  assert.ok(pc.y < 50, `should be through the door, is at ${pc.y.toFixed(1)}`);
});

test("the staff door is shut to a fan, but the guard props it open for a smoke", () => {
  const g = createGame("smoke");
  const pc = pcOf(g), st = g.w.state.stadium!;
  pc.x = 59.5; pc.y = 54;
  walk(g, 59.5, 47, 5);
  assert.ok(pc.y > 50);
  pc.x = 59.5; pc.y = 54;
  run(g, 200, () => { if (st.gates.staffdoor?.until > g.w.state.tick && st.gates.staffdoor.for === null && pc.y > 50) { pc.moveX = 0; pc.moveY = -0.8; } });
  assert.ok(pc.y < 50, "should slip in while the door is propped open");
});

test("someone on the pitch near the ball makes the referee stop play", () => {
  const g = createGame("halt");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  assert.equal(m.phase === "live" || m.phase === "restart", true);
  run(g, 20, () => {});
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  // Wait for live play, then appear next to the ball.
  run(g, 30, () => { if (m.phase === "live" && !events.includes("fb_halted")) { pc.x = m.ball.x + 2; pc.y = m.ball.y + 2; } });
  assert.ok(events.includes("fb_halted"));
});

test("running on to the pitch stops play and gets you caught", () => {
  const g = createGame("invader");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 1);
  // Skip to well after kick-off.
  pc.x = -20; pc.y = 33;
  run(g, 360);
  assert.equal(m.phase === "live" || m.phase === "restart", true);
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  // Run for the ball.
  run(g, 8, () => { const dx = m.ball.x - pc.x, dy = m.ball.y - pc.y, d = Math.hypot(dx, dy) || 1; pc.moveX = dx / d; pc.moveY = dy / d; });
  pc.moveX = pc.moveY = 0;
  run(g, 15);
  assert.ok(events.includes("caught"), "a steward should catch him");
  assert.ok(events.includes("detained") || events.includes("ejected") || s.stadium!.ending?.kind === "arrested" || pc.heldBy, "and take him away");
});

test("a pie thrown from the stand distracts the referee and is noticed", () => {
  const g = createGame("pie");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  pc.x = -5; pc.y = 29;
  run(g, 380);
  const ref = s.actors[m.officials.referee];
  // Wait for him to stand still at a dead ball, then get to the nearest front row.
  run(g, 120, () => {
    if (s.tick % 30 || Math.hypot(ref.vx, ref.vy) > 0.3 || m.phase !== "restart") return;
    if (Math.abs(ref.y) > 6) { pc.x = ref.x; pc.y = Math.sign(ref.y) * 28.6; }
  });
  // Stand him close enough and throw.
  ref.x = pc.x; ref.y = 22;
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  // A few goes: he is moving, and some throws miss.
  for (let i = 0; i < 6 && !events.some((e) => e.type === "item_hit"); i++) {
    // Hold him still (he is quick on his feet) for the length of the throw.
    ref.x = pc.x + 2; ref.y = pc.y - Math.sign(pc.y) * 6; ref.vx = ref.vy = 0; ref.downUntil = s.tick + 70;
    const pie = spawnItem(s, "pie", { k: "hand", a: pc.id });
    assert.equal(dispatch(g.w, { verb: "throw", actor: pc.id, item: pie.id, ...aimThrow(pc, ref) }).ok, true);
    run(g, 1.5);
  }
  assert.ok(events.some((e) => e.type === "item_hit" && e.target === ref.id), "should hit the referee");
  assert.ok(ref.off!.distractedUntil > s.tick);
  assert.ok(s.stadium!.incidents.some((i) => i.by === pc.id));
});

test("an opposition shirt takes the blame until a steward pulls it off", () => {
  const g = createGame("falseflag");
  const s = g.w.state, pc = pcOf(g);
  spawnItem(s, "shirt_por", { k: "worn", a: pc.id, slot: "outer" });
  pc.x = 0; pc.y = 41;
  run(g, 1);
  const victim = find(g, (a) => a.npc?.job === "patrol");
  victim.x = pc.x + 1; victim.y = pc.y; victim.facing = Math.PI;
  dispatch(g.w, { verb: "strike", actor: pc.id, target: { k: "actor", id: victim.id } });
  const inc = s.stadium!.incidents.at(-1)!;
  assert.equal(inc.blamed, "POR");
  run(g, 20);
  assert.equal(s.stadium!.incidents.at(-1)!.blamed, "ENG", "caught and unmasked");
});

test("going back to a checkpoint restores the world", () => {
  const g = createGame("cp");
  const pc = pcOf(g);
  pc.money = 3;
  run(g, 2);
  loadCheckpoint(g, "arrival");
  assert.equal(pcOf(g).money, 150);
  assert.equal(g.w.state.tick, 0);
});

test("stewards cannot see through walls", () => {
  const g = createGame("walls");
  const s = g.w.state, pc = pcOf(g);
  const corridor = find(g, (a) => a.npc?.job === "corridor");
  corridor.x = 0; corridor.y = -43; corridor.facing = Math.PI / 2;
  pc.x = 30; pc.y = 41; // behind the back wall of the South Stand
  assert.equal(canSee(g.w, corridor, pc, 200), false);
  pc.x = 0; pc.y = -40;
  assert.equal(canSee(g.w, corridor, pc), true);
  assert.ok(s);
});

test("struggling free is rare, and hammering the button does not help", () => {
  let freed = 0;
  for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]) {
    const g = createGame(seed);
    const s = g.w.state, pc = pcOf(g);
    pc.x = 0; pc.y = -43; // in the players' corridor, where he should not be
    run(g, 20, () => { if (pc.heldBy) dispatch(g.w, { verb: "struggle", actor: pc.id }); });
    if (g.w.bus.recent.some((e) => e.type === "broke_free")) freed++;
    assert.ok(s);
  }
  assert.ok(freed <= 4, `broke free in ${freed} of 8`);
});

test("dressed as the referee, with the real one flat out, you can give England a penalty", () => {
  const g = createGame("impostor");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  spawnItem(s, "whistle", { k: "pocket", a: pc.id });
  const ref = s.actors[m.officials.referee];
  ref.downUntil = s.tick + 60 * 60;
  pc.x = 0; pc.y = 5;
  let given = false;
  for (let i = 0; i < 5 && !given; i++) {
    run(g, 1, () => {});
    if (m.phase === "live" || m.phase === "restart") {
      dispatch(g.w, { verb: "rule", actor: pc.id, arg: "penalty" });
      given = m.restart?.type === "penalty" && m.restart.team === 0;
    }
  }
  assert.ok(given, "a penalty to England should usually be accepted with nobody to object");
  assert.ok((s.stadium!.flags.impostorRulings ?? 0) >= 1);
});

test("the real referee does not stand for a second referee for long", () => {
  const g = createGame("tworefs");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  const ref = s.actors[m.officials.referee];
  run(g, 8, () => { pc.x = ref.x + 3; pc.y = ref.y + 3; });
  assert.ok(events.includes("two_refs"));
});

test("bets settle on the official result and pay whoever holds the slip", () => {
  const g = createGame("bets");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 360);
  pc.x = 0; pc.y = 32; pc.seated = true;
  const before = pc.money;
  assert.equal(dispatch(g.w, { verb: "bet", actor: pc.id, arg: "winner:ENG", amount: 50 }).ok, true);
  assert.equal(dispatch(g.w, { verb: "bet", actor: pc.id, arg: "winner:OPP", amount: 50 }).ok, false, "no betting on England going out");
  assert.equal(dispatch(g.w, { verb: "bet", actor: pc.id, arg: "next:NONE", amount: 50 }).ok, true);
  assert.equal(dispatch(g.w, { verb: "bet", actor: pc.id, arg: "next:ENG", amount: 500 }).ok, false, "stake limit");
  assert.equal(pc.money, before - 100);
  while (m.phase !== "finished" && s.tick < 60 * 60 * 45) stepGame(g);
  const slips = [pc.hand, ...pc.pockets].filter(Boolean).map((id) => s.items[id!]).filter((it) => it.bet);
  assert.equal(slips.length, 2);
  assert.ok(slips.every((it) => it.bet!.result), "both settled");
  const won = slips.filter((it) => it.bet!.result === "won");
  const expected = won.reduce((t, it) => t + Math.round(it.bet!.stake * it.bet!.odds), 0);
  assert.equal(pc.money, before - 100 + expected, "winning slips paid out, losing ones did not");
});

test("a disguise changes the description; a balaclava gets you looked at", () => {
  const g = createGame("disguise");
  const s = g.w.state, pc = pcOf(g);
  pc.x = 0; pc.y = 41;
  run(g, 1);
  const victim = find(g, (a) => a.npc?.job === "patrol");
  victim.x = pc.x + 1; victim.y = pc.y; victim.facing = Math.PI;
  dispatch(g.w, { verb: "strike", actor: pc.id, target: { k: "actor", id: victim.id } });
  const wd = s.stadium!.wanted.at(-1)!;
  spawnItem(s, "flat_cap", { k: "worn", a: pc.id, slot: "head" });
  spawnItem(s, "sunglasses", { k: "worn", a: pc.id, slot: "face" });
  const ap = appearance(s, pc);
  assert.notEqual(ap.look, wd.look, "the outfit no longer matches the description");
  assert.ok(ap.faceCover >= 0.5 && !ap.faceHidden);
  const bal = spawnItem(s, "balaclava", { k: "hand", a: pc.id });
  dispatch(g.w, { verb: "wear", actor: pc.id, item: bal.id });
  assert.ok(appearance(s, pc).sinister && appearance(s, pc).faceHidden);
});

test("a smoke flare on the pitch stops play and hides you", () => {
  const g = createGame("flare");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  run(g, 30, () => {});
  pc.x = 12; pc.y = 29; // away from the stewards along the front
  const flare = spawnItem(s, "flare", { k: "hand", a: pc.id });
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  run(g, 20, () => { if (m.phase === "live" && pc.hand === flare.id) dispatch(g.w, { verb: "throw", actor: pc.id, item: flare.id, dirX: 0, dirY: -1, dist: 12 }); });
  assert.ok(events.includes("smoke"));
  assert.ok(events.includes("fb_halted"));
  const c = s.stadium!.smoke[0];
  const steward = find(g, (a) => a.npc?.job === "patrol");
  steward.x = c.x; steward.y = c.y - 10; steward.facing = Math.PI / 2;
  pc.x = c.x; pc.y = c.y + 2;
  assert.equal(canSee(g.w, steward, pc, 30), false, "nobody sees through the smoke");
});

// ---------- The semi-final and carrying things over ----------
import { afterMatch, loadoutProblem, newCampaign } from "../src/stadium/campaign";
import { VENUE } from "../src/stadium/layout";

function semi(seed: string, notoriety = 1, loadout: string[] = ["shirt_eng"]) {
  const c = newCampaign();
  c.fixture = 1; c.notoriety = notoriety; c.money = 200; c.stash = loadout.slice(); c.loadout = loadout.slice();
  return createGame(seed, "sf", c);
}

test("the semi-final is a different ground with a different opponent", () => {
  const g = semi("sf1", 0);
  assert.equal(VENUE.id, "sf");
  assert.equal(g.w.state.match!.teams[1].short, "BRA");
  assert.ok(VENUE.features.faceCameras && VENUE.features.metalDetectors && VENUE.features.staffPass);
  assert.equal(pcOf(g).money, 200);
});

test("the face cameras flag a barred face; sunglasses and a cap get past them", () => {
  const g = semi("sf2", 1);
  const s = g.w.state, pc = pcOf(g);
  const ticket = spawnItem(s, "ticket", { k: "pocket", a: pc.id });
  const steward = find(g, (a) => a.npc?.job === "turnstile" && Math.abs(a.x) < 1);
  pc.x = 0; pc.y = 46.3;
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  dispatch(g.w, { verb: "show", actor: pc.id, item: ticket.id, target: { k: "actor", id: steward.id } });
  assert.ok(events.includes("camera_flag"));
  assert.equal(s.items[ticket.id].used, undefined, "not let in");
  spawnItem(s, "sunglasses", { k: "worn", a: pc.id, slot: "face" });
  steward.npc!.sus = {};
  let inside = false;
  for (let i = 0; i < 12 && !inside; i++) {
    dispatch(g.w, { verb: "show", actor: pc.id, item: ticket.id, target: { k: "actor", id: steward.id } });
    inside = !!s.items[ticket.id].used;
  }
  assert.ok(inside, "half a face is enough to fool the camera");
});

test("metal detectors always find a knife", () => {
  for (const seed of ["md1", "md2", "md3"]) {
    const g = semi(seed, 0, ["shirt_eng", "knife"]);
    const s = g.w.state, pc = pcOf(g);
    assert.ok(pc.pockets.some((id) => s.items[id].def === "knife"), "brought the knife");
    const ticket = spawnItem(s, "ticket", { k: "pocket", a: pc.id });
    const steward = find(g, (a) => a.npc?.job === "turnstile" && Math.abs(a.x) < 1);
    pc.x = 0; pc.y = 46.3;
    dispatch(g.w, { verb: "show", actor: pc.id, item: ticket.id, target: { k: "actor", id: steward.id } });
    assert.ok(!pc.pockets.some((id) => s.items[id].def === "knife"), "confiscated");
  }
});

test("at the semi-final the staff door needs a pass as well as the vest", () => {
  const g = semi("sf3", 0);
  const s = g.w.state, pc = pcOf(g);
  spawnItem(s, "hivis", { k: "worn", a: pc.id, slot: "outer" });
  pc.x = SPOTS.staffDoor.x; pc.y = 54;
  walk(g, SPOTS.staffDoor.x, 47, 8);
  assert.ok(pc.y > 50, "no pass, no entry");
  spawnItem(s, "staff_pass", { k: "pocket", a: pc.id });
  pc.x = SPOTS.staffDoor.x; pc.y = 54;
  run(g, 1);
  walk(g, SPOTS.staffDoor.x, 47, 10);
  assert.ok(pc.y < 50, "with a pass he is waved through");
});

test("the loose panel by the car park gets you in without a ticket", () => {
  const g = semi("sf4", 0);
  const pc = pcOf(g);
  const c = VENUE.climbPoints[0];
  pc.x = c.x; pc.y = c.y + 1.5;
  assert.equal(dispatch(g.w, { verb: "vault", actor: pc.id }).ok, true);
  run(g, 2);
  assert.ok(VENUE.inside(pc.x, pc.y));
});

test("after a win, money, kept items and notoriety carry over", () => {
  const g = createGame("carry");
  const s = g.w.state, pc = pcOf(g);
  pc.money = 77;
  spawnItem(s, "sunglasses", { k: "worn", a: pc.id, slot: "face" });
  spawnItem(s, "ticket", { k: "pocket", a: pc.id });
  s.stadium!.flags.ejections = 1;
  const next = afterMatch(g.campaign, g.w, "test");
  assert.equal(next.fixture, 1);
  assert.equal(next.money, 77);
  assert.ok(next.stash.includes("sunglasses"));
  assert.ok(!next.stash.includes("ticket"), "tickets don't carry over");
  assert.equal(next.notoriety, 1);
  assert.equal(loadoutProblem(["shirt_eng", "hammer", "knife", "flare", "staff_pass", "laxative"]), "That won't all fit in your pockets.");
  assert.equal(loadoutProblem(["shirt_eng", "chef_whites", "hivis"]) !== null, true);
});

// ---------- Planting, tip-offs and fake police ----------
test("plant powder on their star, tip off the police, and he is arrested at the next stoppage", () => {
  const g = createGame("plant");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  const star = m.teams[1].squad.map((id) => s.actors[id]).find((a) => a.fb!.star)!;
  // In the away dressing room before kick-off.
  pc.x = star.x - Math.cos(star.facing) * 1; pc.y = star.y - Math.sin(star.facing) * 1;
  const powder = spawnItem(s, "powder", { k: "pocket", a: pc.id });
  let planted = false;
  for (let i = 0; i < 10 && !planted; i++) {
    if (powder.loc.k !== "pocket" || powder.loc.a !== pc.id) { pc.pockets.push(powder.id); powder.loc = { k: "pocket", a: pc.id }; }
    pc.x = star.x - Math.cos(star.facing); pc.y = star.y - Math.sin(star.facing);
    dispatch(g.w, { verb: "plant", actor: pc.id, item: powder.id, target: { k: "actor", id: star.id } });
    planted = star.pockets.includes(powder.id);
  }
  assert.ok(planted, "planted");
  // Find a police officer and tell him.
  const cop = find(g, (a) => a.npc?.job === "police");
  pc.x = cop.x + 1; pc.y = cop.y;
  for (const id in s.actors) { const n = s.actors[id].npc; if (n) { n.sus = {}; n.mode = n.mode === "player" as any ? n.mode : n.mode; } }
  assert.equal(dispatch(g.w, { verb: "report", actor: pc.id, target: { k: "actor", id: star.id } }).ok, true);
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  run(g, 420);
  assert.ok(events.includes("tipoff_arrest"), "found and arrested");
  assert.equal(star.fb!.status, "gone");
  assert.equal(star.fb!.goneReason, "arrested");
});

test("a fake police officer can arrest a steward if no real officer is watching", () => {
  let worked = 0;
  for (const seed of ["fc1", "fc2", "fc3", "fc4", "fc5", "fc6"]) {
    const g = createGame(seed);
    const s = g.w.state, pc = pcOf(g);
    spawnItem(s, "police_uniform", { k: "worn", a: pc.id, slot: "outer" });
    const corridor = find(g, (a) => a.npc?.job === "corridor");
    pc.x = corridor.x + 1; pc.y = corridor.y;
    const events: string[] = [];
    g.w.bus.on((e) => events.push(e.type));
    dispatch(g.w, { verb: "arrest", actor: pc.id, target: { k: "actor", id: corridor.id } });
    if (events.includes("false_arrest")) worked++;
  }
  assert.ok(worked >= 2 && worked <= 6, `worked ${worked} of 6`);
});

test("the police uniform is in the van, and confiscated things can be taken back from the locker", () => {
  const g = createGame("van");
  const s = g.w.state, pc = pcOf(g);
  const box = Object.values(s.items).find((i) => i.def === "police_box")!;
  const uniform = Object.values(s.items).find((i) => i.def === "police_uniform")!;
  pc.x = (box.loc as any).x + 1; pc.y = (box.loc as any).y;
  assert.equal(dispatch(g.w, { verb: "takeout", actor: pc.id, item: uniform.id }).ok, true);
  assert.equal(uniform.loc.k === "hand" || uniform.loc.k === "pocket", true);
  const knife = spawnItem(s, "knife", { k: "in", c: s.stadium!.locker });
  pc.x = SPOTS.locker.x - 1; pc.y = SPOTS.locker.y;
  assert.equal(dispatch(g.w, { verb: "takeout", actor: pc.id, item: knife.id }).ok, true);
});

// ---------- The team bus ----------
test("the away team ride the bus from the hotel and arrive before kick-off", () => {
  const g = createGame("busride");
  const s = g.w.state, m = s.match!;
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  run(g, 300);
  assert.ok(events.includes("bus_departs") && events.includes("bus_arrives"));
  assert.ok(!events.includes("kickoff_delayed"));
  const away = m.teams[1].squad.slice(0, 11).map((id) => s.actors[id]);
  assert.ok(away.every((a) => !a.hiddenIn && VENUE.inside(a.x, a.y)), "all eleven inside the ground");
});

test("a tampered bus crashes, players are hurt, and kick-off is delayed", () => {
  const g = createGame("tamper");
  const s = g.w.state, pc = pcOf(g), v = s.stadium!.vehicles.bus;
  const knife = spawnItem(s, "knife", { k: "hand", a: pc.id });
  pc.x = v.x; pc.y = v.y + 2.2;
  assert.equal(dispatch(g.w, { verb: "tamper", actor: pc.id, item: knife.id }).ok, true);
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  run(g, 335);
  assert.ok(events.some((e) => e.type === "bus_crash"));
  assert.ok(events.some((e) => e.type === "kickoff_delayed" && e.reason === "late"), "kick-off waits");
});

test("drive the bus at people and their team are docked a goal; caught, and it reverses", () => {
  const g = createGame("busjack");
  const s = g.w.state, pc = pcOf(g), v = s.stadium!.vehicles.bus, m = s.match!;
  run(g, 200); // after it has arrived and the driver has gone for his tea
  const door = { x: v.x + Math.cos(v.facing) * 3.9 + Math.sin(v.facing) * 2.2, y: v.y + Math.sin(v.facing) * 3.9 - Math.cos(v.facing) * 2.2 };
  pc.x = door.x; pc.y = door.y;
  run(g, 3);
  assert.equal(dispatch(g.w, { verb: "drive", actor: pc.id }).ok, true);
  // Put a cleaner in front of it and floor it.
  const victim = find(g, (a) => a.npc?.job === "cleaner");
  victim.x = v.x + Math.cos(v.facing) * 9; victim.y = v.y + Math.sin(v.facing) * 9;
  victim.npc!.plan = [{ k: "wait", s: 30 }];
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  run(g, 3, () => { pc.moveX = Math.cos(v.facing); pc.moveY = Math.sin(v.facing); });
  pc.moveX = pc.moveY = 0;
  assert.ok(events.some((e) => e.type === "bus_hit" && e.who === victim.id), "ran him down");
  const blamed = s.stadium!.incidents.filter((i) => i.what.includes("bus")).map((i) => i.blamed);
  assert.ok(blamed.includes("POR"), `blamed on ${blamed.join(",")}`);
  run(g, 20);
  assert.ok(events.some((e) => e.type === "bus_sanction" && !e.reversed), "the governing body acts");
  const before = [...m.score];
  for (const i of s.stadium!.incidents) if (i.what.includes("bus")) i.blamed = "ENG";
  run(g, 1);
  assert.ok(events.some((e) => e.type === "bus_sanction" && e.reversed), "and reverses it");
  assert.notDeepEqual(m.score, before);
});

// ---------- The dog ----------
test("untie the dog, let it go, and it bites someone", () => {
  const g = createGame("dog");
  const s = g.w.state, pc = pcOf(g), st = s.stadium!;
  const dog = s.actors[st.dog!.id];
  pc.x = dog.x + 1; pc.y = dog.y;
  assert.equal(dispatch(g.w, { verb: "untie", actor: pc.id }).ok, true);
  walk(g, -20, 58, 15);
  assert.ok(Math.hypot(dog.x - pc.x, dog.y - pc.y) < 3, "the dog follows on its lead");
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  assert.equal(dispatch(g.w, { verb: "release", actor: pc.id }).ok, true);
  run(g, 20);
  assert.ok(events.includes("dog_bite"), "it goes for somebody");
});

test("a dog on the pitch stops play", () => {
  const g = createGame("pitchdog");
  const s = g.w.state, st = s.stadium!, m = s.match!;
  run(g, 400);
  const dog = s.actors[st.dog!.id];
  st.dog!.state = "loose";
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  run(g, 10, () => { if (!events.includes("fb_halted") && m.phase === "live") { dog.x = m.ball.x + 3; dog.y = m.ball.y; } });
  assert.ok(events.includes("fb_halted"));
});

// ---------- Playing in the kit ----------
import { HL } from "../src/football/config";
import { dirOf } from "../src/football/util";

test("in an England kit on the pitch you join the team, and a goal you score counts", () => {
  const g = createGame("kit");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  spawnItem(s, "kit_eng", { k: "worn", a: pc.id, slot: "outer" });
  // Keep the referee looking the other way for the test.
  const ref = s.actors[m.officials.referee];
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  let scored = false;
  run(g, 60, () => {
    ref.off!.distractedUntil = s.tick + 60;
    if (m.phase !== "live" || scored) return;
    const dir = dirOf(m, 0);
    // Stand by the opposition's goal with the ball at his feet, and shoot.
    pc.x = dir * (HL - 6); pc.y = 0; pc.facing = dir > 0 ? 0 : Math.PI;
    if (pc.fb && !m.ball.owner) {
      m.ball.x = pc.x + dir * 0.6; m.ball.y = 0; m.ball.z = 0; m.ball.vx = m.ball.vy = 0;
      for (const a of m.teams[1].squad.map((id) => s.actors[id])) if (a.fb!.role === "GK") { a.x = dir * (HL - 0.5); a.y = 12; }
      scored = dispatch(g.w, { verb: "kick", actor: pc.id, dirX: dir, dirY: 0 }).ok;
    }
  });
  assert.ok(events.some((e) => e.type === "joined_match"), "joined the team");
  assert.ok(events.some((e) => e.type === "fb_goal" && e.by === pc.id && e.legit), "and his goal stands");
});

test("the referee eventually counts twelve", () => {
  const g = createGame("twelve");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  spawnItem(s, "kit_eng", { k: "worn", a: pc.id, slot: "outer" });
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  const ref = s.actors[m.officials.referee];
  run(g, 120, () => { if (!events.includes("twelfth_man")) { pc.x = ref.x + 4; pc.y = ref.y; } });
  assert.ok(events.includes("twelfth_man"));
});

// ---------- Kick-off delays ----------
test("a fire alarm at kick-off time delays it, and the stewards get keener", () => {
  const g = createGame("alarm");
  const s = g.w.state, pc = pcOf(g), m = s.match!, st = s.stadium!;
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  run(g, 320);
  const p = SPOTS.alarmPoints[0];
  pc.x = p.x; pc.y = p.y;
  assert.equal(dispatch(g.w, { verb: "alarm", actor: pc.id }).ok, true);
  assert.equal(dispatch(g.w, { verb: "alarm", actor: pc.id }).ok, false, "one go per call point");
  run(g, 15);
  assert.equal(m.phase, "pre");
  const d = events.find((e) => e.type === "kickoff_delayed");
  assert.ok(d && d.reason === "alarm", "delayed for the alarm");
  assert.ok((st.flags.securityLevel ?? 0) >= 1);
  run(g, 90);
  assert.notEqual(m.phase, "pre", "kicks off once the alarm stops");
});

test("an alarm during play stops the match until it is silenced", () => {
  const g = createGame("alarm2");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  assert.ok(m.phase === "live" || m.phase === "restart");
  const p = SPOTS.alarmPoints[1];
  pc.x = p.x; pc.y = p.y;
  dispatch(g.w, { verb: "alarm", actor: pc.id });
  run(g, 1);
  assert.equal(m.halted, "alarm");
  run(g, 40);
  assert.notEqual(m.halted, "alarm");
});

test("a poorly referee holds things up twice, then the fourth official takes over", () => {
  const g = createGame("refdelay");
  const s = g.w.state, m = s.match!;
  const ref = s.actors[m.officials.referee];
  run(g, 300);
  ref.off!.incapacitated = true;
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  run(g, 140);
  const refDelays = events.filter((e) => e.type === "kickoff_delayed" && e.reason === "referee").length;
  assert.equal(refDelays, 2);
  assert.notEqual(m.phase, "pre");
});

test("if they can't raise seven players, the referee gives England the match", () => {
  const g = createGame("forfeit");
  const s = g.w.state, m = s.match!, st = s.stadium!;
  run(g, 100);
  // Nobody of theirs ever turns up.
  for (const id of m.teams[1].squad) { const a = s.actors[id]; a.x = 85; a.y = -30; }
  const events: string[] = [];
  g.w.bus.on((e) => events.push(e.type));
  run(g, 560, () => { for (const id of m.teams[1].squad) { const a = s.actors[id]; a.x = 85; a.y = -30; } });
  assert.equal(events.filter((e) => e === "kickoff_delayed").length, 6);
  assert.ok(events.includes("forfeit"));
  assert.equal(st.ending?.kind, "through");
});

// ---------- Through the wall ----------
function busAt(g: Game, x: number, y: number, facing: number) {
  const s = g.w.state, pc = pcOf(g), v = s.stadium!.vehicles.bus;
  v.x = x; v.y = y; v.facing = facing; v.speed = 0; v.state = "driving";
  v.drivenBy = pc.id; pc.hiddenIn = v.cab; pc.x = x; pc.y = y;
  for (const a of Object.values(s.actors)) if (a.npc && a.id !== pc.id && Math.abs(a.x - x) < 6 && a.y > 44 && a.y < y + 8) { a.x = x + 20; }
  return v;
}

test("floor it into the outer wall and the bus makes a hole you can walk through", () => {
  const g = createGame("breach");
  const s = g.w.state, pc = pcOf(g), st = s.stadium!;
  run(g, 60);
  const v = busAt(g, -28, 59.5, -Math.PI / 2);
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  run(g, 4, () => { if (v.drivenBy) { pc.moveX = 0; pc.moveY = -1; } else pc.moveX = pc.moveY = 0; });
  assert.equal(st.breaches.length, 1, "a hole");
  assert.ok(v.crashed && !v.drivenBy && !pc.hiddenIn);
  assert.ok(events.some((e) => e.type === "breach" && e.ground));
  assert.ok((st.flags.securityLevel ?? 0) >= 2);
  assert.ok(st.incidents.some((i) => i.what.includes("wall") && i.severity === 3));
  if (st.ending) return; // the rare hospital trip
  run(g, 5);
  walk(g, -26.2, 40, 12);
  assert.equal(areaAt(pc.x, pc.y).id, "concourse_s", `got in: at ${pc.x.toFixed(1)},${pc.y.toFixed(1)}`);
});

test("driven gently into a wall, the bus just bumps it", () => {
  const g = createGame("bump");
  const s = g.w.state, pc = pcOf(g), st = s.stadium!;
  run(g, 60);
  const v = busAt(g, -28, 54, -Math.PI / 2);
  run(g, 4, () => { pc.moveX = 0; pc.moveY = -0.35; });
  assert.equal(st.breaches.length, 0);
  assert.ok(!v.crashed);
});

// ---------- The dog, on command ----------
function leadDog(g: Game) {
  const s = g.w.state, pc = pcOf(g), d = s.stadium!.dog!;
  const dog = s.actors[d.id];
  d.state = "led"; dog.x = pc.x - 1; dog.y = pc.y;
  return { d, dog };
}

test("with the dog at the turnstile, 'it's a service dog' sometimes works and lets you both in", () => {
  let ok = 0, no = 0;
  for (let k = 0; k < 8; k++) {
    const g = createGame(`svc${k}`);
    const s = g.w.state, pc = pcOf(g);
    const t = find(g, (a) => a.npc?.job === "turnstile");
    pc.x = t.x; pc.y = t.y + 1.6;
    leadDog(g);
    const res = dispatch(g.w, { verb: "servicedog", actor: pc.id, target: { k: "actor", id: t.id } });
    assert.equal(res.ok, true);
    if (s.stadium!.flags.serviceDog) {
      ok++;
      const ticket = spawnItem(s, "ticket", { k: "hand", a: pc.id });
      dispatch(g.w, { verb: "show", actor: pc.id, item: ticket.id, target: { k: "actor", id: t.id } });
      assert.ok(Object.values(s.stadium!.gates).some((gt) => gt.for === pc.id && gt.until > s.tick), "gate opens with the dog");
    } else {
      no++;
      assert.equal(dispatch(g.w, { verb: "servicedog", actor: pc.id, target: { k: "actor", id: t.id } }).ok, false, "not twice to the same steward");
    }
  }
  assert.ok(ok > 0 && no > 0, `${ok} believed, ${no} not`);
});

test("held by a steward, set the dog on him: he lets go, gets mauled, and the dog comes back", () => {
  const g = createGame("sic");
  const s = g.w.state, pc = pcOf(g), st = s.stadium!;
  run(g, 30);
  const stw = find(g, (a) => a.npc?.job === "patrol");
  pc.x = stw.x + 1; pc.y = stw.y;
  pc.heldBy = stw.id; stw.npc!.target = pc.id; stw.npc!.mode = "escort"; stw.npc!.intent = "eject";
  stw.npc!.escortTo = { x: SPOTS.ejectPoint.x, y: SPOTS.ejectPoint.y }; stw.npc!.escortAt = s.tick;
  const { d } = leadDog(g);
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  assert.equal(dispatch(g.w, { verb: "sic", actor: pc.id, target: { k: "actor", id: stw.id } }).ok, true);
  run(g, 4);
  assert.ok(events.some((e) => e.type === "broke_free" && e.from === stw.id), "he let go");
  assert.ok(events.some((e) => e.type === "mauled" && e.who === stw.id));
  assert.ok(stw.downUntil > s.tick, "he's down");
  assert.ok(events.some((e) => e.type === "mauled") && d.state !== "sicced", `dog is ${d.state}`);
  assert.ok(st.incidents.some((i) => i.what.includes("dog")));
});

test("set on a footballer, the dog leaves him with an injury", () => {
  const g = createGame("sicfb");
  const s = g.w.state, pc = pcOf(g), m = s.match!;
  run(g, 400);
  const star = s.actors[m.teams[1].squad[9]];
  pc.x = star.x; pc.y = star.y + 6;
  leadDog(g);
  const events: any[] = [];
  g.w.bus.on((e) => events.push(e));
  dispatch(g.w, { verb: "sic", actor: pc.id, target: { k: "actor", id: star.id } });
  run(g, 15);
  const mauled = events.find((e) => e.type === "mauled" && e.who === star.id);
  assert.ok(mauled, "mauled");
  assert.ok(typeof mauled.injury === "string" && mauled.injury.length > 3);
});

// ---------- Knives ----------
test("a knife kills; the face comes off and passes you off as him", () => {
  const g = createGame("knife");
  const s = g.w.state, pc = pcOf(g), st = s.stadium!;
  run(g, 20);
  const knife = spawnItem(s, "knife", { k: "hand", a: pc.id });
  const victim = find(g, (a) => a.npc?.job === "local");
  pc.x = victim.x + 0.8; pc.y = victim.y;
  assert.equal(dispatch(g.w, { verb: "strike", actor: pc.id, item: knife.id, target: { k: "actor", id: victim.id } }).ok, true);
  assert.ok(victim.dead);
  assert.ok(appearance(s, pc).alarming, "covered in blood");
  run(g, 1);
  assert.equal(dispatch(g.w, { verb: "flay", actor: pc.id, arg: "face", target: { k: "actor", id: victim.id } }).ok, true);
  assert.equal(dispatch(g.w, { verb: "flay", actor: pc.id, arg: "face", target: { k: "actor", id: victim.id } }).ok, false, "only one face");
  const face = Object.values(s.items).find((i) => i.def === "face")!;
  assert.ok(face && face.label?.includes(victim.name));
  run(g, 3);
  dispatch(g.w, { verb: "wear", actor: pc.id, item: face.id });
  assert.equal(appearance(s, pc).faceId, victim.faceId);
  assert.ok(appearance(s, pc).grisly);
  assert.ok((st.flags.killings ?? 0) >= 1);
});

test("armed police, once called, shoot a man who keeps hold of his knife and keeps moving", () => {
  let shot = 0;
  for (let k = 0; k < 3 && !shot; k++) {
    const g = createGame(`armed${k}`);
    const s = g.w.state, pc = pcOf(g), st = s.stadium!;
    run(g, 20);
    const knife = spawnItem(s, "knife", { k: "hand", a: pc.id });
    callArmed(g.w, pc.x, pc.y);
    run(g, 42);
    assert.ok(st.flags.armedDeployed, "they come");
    // Stand by the van, knife out, and jog on the spot.
    const o = find(g, (a) => a.npc?.job === "armed");
    run(g, 20, () => { pc.x = o.x + 6; pc.y = o.y; pc.moveX = Math.sin(s.tick * 0.1); pc.moveY = 0; pc.downUntil = 0; pc.hand = knife.id; });
    if (st.ending?.kind === "shot") shot++;
  }
  assert.ok(shot > 0, "shot");
});

test("drop the knife and stand still for armed police and you're arrested instead", () => {
  const g = createGame("comply");
  const s = g.w.state, pc = pcOf(g), st = s.stadium!;
  run(g, 20);
  callArmed(g.w, pc.x, pc.y);
  run(g, 42);
  pc.effects.bloody = s.tick + 6000;
  const o = find(g, (a) => a.npc?.job === "armed");
  run(g, 10, () => { pc.x = o.x + 5; pc.y = o.y; pc.moveX = pc.moveY = 0; });
  assert.equal(st.ending?.kind, "arrested");
});

test("at the semi-final, a steward's hands get you through the staff door", () => {
  const g = createGame("palm", "sf");
  const s = g.w.state, pc = pcOf(g), st = s.stadium!;
  run(g, 20);
  const stw = find(g, (a) => a.npc?.role === "steward" && a.npc.job === "patrol");
  stw.dead = true;
  const hands = spawnItem(s, "hands", { k: "pocket", a: pc.id });
  hands.of = stw.id;
  const vest = spawnItem(s, "hivis", { k: "hand", a: pc.id });
  dispatch(g.w, { verb: "wear", actor: pc.id, item: vest.id });
  run(g, 2);
  pc.x = SPOTS.staffDoor.x; pc.y = SPOTS.staffDoor.y + 1.5;
  run(g, 2);
  assert.equal(st.doorPass, pc.id, "waved through");
});

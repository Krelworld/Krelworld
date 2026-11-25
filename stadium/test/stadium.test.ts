import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnItem } from "../src/core/items";
import type { Actor } from "../src/core/types";
import { dispatch } from "../src/core/verbs";
import { createGame, loadCheckpoint, stepGame, type Game } from "../src/stadium/game";
import { areaAt, SPOTS } from "../src/stadium/layout";
import { canSee, witnessesOf } from "../src/stadium/security";
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
  assert.ok(s.stadium!.detainedUntil > 0 || s.stadium!.ending?.kind === "arrested" || pc.heldBy, "and take him away");
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
  spawnItem(s, "shirt_opp", { k: "worn", a: pc.id, slot: "outer" });
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

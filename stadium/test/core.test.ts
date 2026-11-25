import assert from "node:assert/strict";
import { test } from "node:test";
import { appearance, looksPermitted } from "../src/core/identity";
import { spawnItem } from "../src/core/items";
import { rnd, seedRng } from "../src/core/rng";
import { Stepper } from "../src/core/stepper";
import type { Zone } from "../src/core/types";
import { dispatch, possibleVerbs } from "../src/core/verbs";
import { createWorld, restore, snapshot, spawnActor, startRecording, stepWorld } from "../src/core/world";

test("random streams repeat for the same seed and differ for others", () => {
  const a = seedRng("x"), b = seedRng("x"), c = seedRng("y");
  const A = [rnd(a), rnd(a), rnd(a)], B = [rnd(b), rnd(b), rnd(b)], C = [rnd(c), rnd(c), rnd(c)];
  assert.deepEqual(A, B);
  assert.notDeepEqual(A, C);
  assert.ok(A.every((v) => v >= 0 && v < 1));
});

test("items: take, pocket, wear and the one-thing-in-hand rule", () => {
  const w = createWorld(1);
  const fan = spawnActor(w.state, "protagonist", "Fan", 0, 0);
  const pie = spawnItem(w.state, "pie", { k: "ground", x: 0.5, y: 0 });
  const pint = spawnItem(w.state, "pint", { k: "ground", x: 0.5, y: 0.5 });
  assert.equal(dispatch(w, { verb: "take", actor: fan.id, item: pie.id }).ok, true);
  assert.equal(fan.hand, pie.id);
  // Taking a pint with a pie in hand: the pie goes in a pocket, the pint in the hand.
  assert.equal(dispatch(w, { verb: "take", actor: fan.id, item: pint.id }).ok, true);
  assert.equal(fan.hand, pint.id);
  assert.deepEqual(fan.pockets, [pie.id]);
  // Out of reach.
  const far = spawnItem(w.state, "knife", { k: "ground", x: 30, y: 0 });
  assert.equal(dispatch(w, { verb: "take", actor: fan.id, item: far.id }).reason, "too far");
});

test("properties decide what is possible, not item names", () => {
  const w = createWorld(1);
  const fan = spawnActor(w.state, "protagonist", "Fan", 0, 0);
  const steward = spawnActor(w.state, "npc", "Steward", 1, 0);
  const lax = spawnItem(w.state, "laxative", { k: "hand", a: fan.id });
  const pint = spawnItem(w.state, "pint", { k: "hand", a: steward.id });
  // A substance can be used on anything spikable.
  assert.ok(possibleVerbs(w, { actor: fan.id, item: lax.id, target: { k: "item", id: pint.id } }).includes("use"));
  assert.equal(dispatch(w, { verb: "use", actor: fan.id, item: lax.id, target: { k: "item", id: pint.id } }).ok, true);
  assert.equal(pint.spiked, "laxative");
  assert.equal(lax.loc.k, "gone");
  // Drinking it applies both the drink and what was put in it.
  assert.equal(dispatch(w, { verb: "consume", actor: steward.id, item: pint.id }).ok, true);
  assert.ok(steward.effects.drunk > 0 && steward.effects.laxative > 0);
  // A ticket cannot be eaten.
  const ticket = spawnItem(w.state, "ticket", { k: "hand", a: fan.id });
  assert.equal(dispatch(w, { verb: "consume", actor: fan.id, item: ticket.id }).ok, false);
});

test("identity: an outer shirt hides the one underneath until someone pulls it off", () => {
  const w = createWorld(1);
  const fan = spawnActor(w.state, "protagonist", "Fan", 0, 0);
  const steward = spawnActor(w.state, "npc", "Steward", 1, 0);
  spawnItem(w.state, "shirt_eng", { k: "worn", a: fan.id, slot: "inner" });
  assert.equal(appearance(w.state, fan).team, "ENG");
  const opp = spawnItem(w.state, "shirt_opp", { k: "hand", a: fan.id });
  dispatch(w, { verb: "wear", actor: fan.id, item: opp.id });
  assert.equal(appearance(w.state, fan).team, "OPP");
  assert.equal(appearance(w.state, fan).faceId, fan.id, "the face never changes");
  dispatch(w, { verb: "remove", actor: steward.id, item: opp.id });
  assert.equal(appearance(w.state, fan).team, "ENG");
});

test("access: clothing lends authority, a ticket gets you through a gate", () => {
  const w = createWorld(1);
  const fan = spawnActor(w.state, "protagonist", "Fan", 0, 0);
  const stand: Zone = { id: "stand", name: "Stand", x: 0, y: 0, w: 1, h: 1, access: "ticket" };
  const tunnel: Zone = { id: "tunnel", name: "Tunnel", x: 0, y: 0, w: 1, h: 1, access: "staff" };
  const pitch: Zone = { id: "pitch", name: "Pitch", x: 0, y: 0, w: 1, h: 1, access: "pitch" };
  assert.equal(looksPermitted(w.state, fan, stand), false);
  spawnItem(w.state, "ticket", { k: "pocket", a: fan.id });
  assert.equal(looksPermitted(w.state, fan, stand), true);
  assert.equal(looksPermitted(w.state, fan, tunnel), false);
  spawnItem(w.state, "hivis", { k: "worn", a: fan.id, slot: "outer" });
  assert.equal(looksPermitted(w.state, fan, tunnel), true);
  assert.equal(looksPermitted(w.state, fan, pitch), false);
  spawnItem(w.state, "ref_kit", { k: "worn", a: fan.id, slot: "outer" });
  assert.equal(appearance(w.state, fan).role, "referee");
  assert.equal(looksPermitted(w.state, fan, pitch), true);
});

test("thrown items fly, land or hit someone, and announce it", () => {
  const w = createWorld(1);
  const fan = spawnActor(w.state, "protagonist", "Fan", 0, 0);
  const ref = spawnActor(w.state, "npc", "Referee", 6, 0);
  const pie = spawnItem(w.state, "pie", { k: "hand", a: fan.id });
  const seen: string[] = [];
  w.bus.on((e) => seen.push(e.type));
  dispatch(w, { verb: "throw", actor: fan.id, item: pie.id, dirX: 1, dirY: 0, power: 0.6 });
  for (let i = 0; i < 120; i++) stepWorld(w);
  assert.ok(seen.includes("item_hit"), "the pie should reach the referee");
  assert.equal(pie.loc.k, "ground");
  assert.equal(ref.id, (w.bus.recent.find((e) => e.type === "item_hit") as any).target);
});

test("actions and movement are recorded for replay", () => {
  const w = createWorld(1);
  const fan = spawnActor(w.state, "protagonist", "Fan", 0, 0);
  const pie = spawnItem(w.state, "pie", { k: "ground", x: 0, y: 0 });
  startRecording(w.state, fan.id);
  fan.moveX = 1;
  for (let i = 0; i < 60; i++) stepWorld(w);
  fan.moveX = 0;
  dispatch(w, { verb: "take", actor: fan.id, item: pie.id }); // too far now: not recorded
  const rec = w.state.recordings[fan.id];
  assert.equal(rec.filter((r) => r.action).length, 0);
  assert.equal(rec.length, 2, "one waypoint every half second");
  assert.ok(Math.abs(fan.x - 3) < 1e-6, "three metres in a second at walking speed");
});

test("a checkpoint restores exactly, and the world replays identically from it", () => {
  const w = createWorld("cp");
  const fan = spawnActor(w.state, "protagonist", "Fan", 0, 0);
  spawnItem(w.state, "pint", { k: "hand", a: fan.id });
  fan.moveX = 0.5; fan.moveY = 0.3;
  for (let i = 0; i < 100; i++) stepWorld(w);
  const cp = snapshot(w);
  for (let i = 0; i < 200; i++) stepWorld(w);
  const first = JSON.stringify(w.state);
  restore(w, cp);
  assert.equal(w.state.tick, 100);
  for (let i = 0; i < 200; i++) stepWorld(w);
  assert.equal(JSON.stringify(w.state), first);
  assert.deepEqual(JSON.parse(JSON.stringify(cp)), cp, "state survives being saved as text");
});

test("the stepper turns frame time into whole steps, and fast-forward runs more of them", () => {
  const st = new Stepper();
  let n = 0;
  st.advance(0.1, () => n++);
  assert.equal(n, 6);
  st.timeScale = 4; n = 0;
  st.advance(0.1, () => n++);
  assert.equal(n, 24);
});

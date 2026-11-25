import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorld, restore, snapshot, spawnActor, stepWorld } from "../src/core/world";
import { bribePlayer, floorReferee, intruderKick, removePlayer } from "../src/football/api";
import { HL } from "../src/football/config";
import { createMatch, TEAMS } from "../src/football/setup";
import { playing } from "../src/football/util";

function play(seed: string, opts: { knockout?: boolean; until?: (w: ReturnType<typeof createWorld>) => boolean } = {}) {
  const w = createWorld(seed);
  const m = createMatch(w, TEAMS.ENG, TEAMS.POR, { halfSeconds: 120, halfTimeSeconds: 1, knockout: opts.knockout ?? true });
  const events: any[] = [];
  w.bus.on((e) => events.push(e));
  let guard = 0;
  while (m.phase !== "finished" && guard++ < 60 * 60 * 20 && !(opts.until && opts.until(w))) stepWorld(w);
  return { w, m, events };
}

test("a match runs to a finish and a knockout tie always has a winner", () => {
  for (const seed of ["a", "b", "c", "d"]) {
    const { m } = play(seed);
    assert.equal(m.phase, "finished");
    assert.notEqual(m.winner, -1, "knockout matches cannot end level");
  }
});

test("the same seed gives the same match", () => {
  const a = play("same"), b = play("same");
  assert.deepEqual(a.m.score, b.m.score);
  assert.equal(a.w.state.tick, b.w.state.tick);
  assert.equal(JSON.stringify(a.w.state), JSON.stringify(b.w.state));
});

test("a mid-match checkpoint replays to the same result", () => {
  const w = createWorld("cp");
  const m = createMatch(w, TEAMS.ENG, TEAMS.POR, { halfSeconds: 90, halfTimeSeconds: 1 });
  for (let i = 0; i < 4000; i++) stepWorld(w);
  const cp = snapshot(w);
  while (w.state.match!.phase !== "finished") stepWorld(w);
  const first = JSON.stringify(w.state.match!.score) + w.state.tick;
  restore(w, cp);
  while (w.state.match!.phase !== "finished") stepWorld(w);
  assert.equal(JSON.stringify(w.state.match!.score) + w.state.tick, first);
  assert.ok(m);
});

test("the scoreboard only changes when an official rules", () => {
  const { events, m } = play("rulings");
  const lines = events.filter((e) => e.type === "fb_goal_line").length;
  const rulings = events.filter((e) => e.type === "fb_goal").length;
  assert.equal(m.score[0] + m.score[1], rulings);
  assert.equal(m.physicalGoals[0] + m.physicalGoals[1], lines);
  for (const e of events.filter((e) => e.type === "fb_goal")) assert.ok(e.official, "every goal names the official who gave it");
});

test("a goal scored by a spectator is not given by an attentive referee", () => {
  const w = createWorld("intruder");
  const m = createMatch(w, TEAMS.ENG, TEAMS.POR, { halfSeconds: 120 });
  while (m.phase !== "live") stepWorld(w);
  const events: any[] = [];
  w.bus.on((e) => events.push(e));
  // Put the ball in front of an open goal with a fat man standing over it.
  const b = m.ball;
  for (const a of playing(w.state, m, 1)) { a.x = -20; a.y = 15; }
  for (const a of playing(w.state, m, 0)) { a.x = -10; a.y = -15; }
  b.owner = null; b.held = false; b.x = HL - 3; b.y = 0; b.z = 0; b.vx = b.vy = b.vz = 0; b.freeUntil = 0;
  const fan = spawnActor(w.state, "protagonist", "A supporter", HL - 3.6, 0);
  assert.equal(intruderKick(w, fan.id, 1, 0, 14), true);
  for (let i = 0; i < 400 && !events.some((e) => e.type === "fb_no_goal" || e.type === "fb_goal"); i++) stepWorld(w);
  assert.equal(m.physicalGoals[0], 1, "the ball did cross the line");
  assert.equal(m.score[0], 0, "but it does not count");
  assert.ok(events.some((e) => e.type === "fb_no_goal" && e.reason === "intruder"));
});

test("with the referee unconscious, a goal waits for another official to rule", () => {
  const w = createWorld("refdown");
  const m = createMatch(w, TEAMS.ENG, TEAMS.POR, { halfSeconds: 120 });
  while (m.phase !== "live") stepWorld(w);
  const events: any[] = [];
  w.bus.on((e) => events.push(e));
  floorReferee(w, 60);
  const b = m.ball, striker = playing(w.state, m, 0).find((a) => a.fb!.role === "FWD")!;
  for (const a of playing(w.state, m, 1)) { a.x = -25; a.y = 15; }
  b.owner = null; b.held = false; b.x = HL - 0.4; b.y = 0; b.z = 0; b.vx = 8; b.vy = 0; b.vz = 0;
  b.lastTouch = striker.id; b.lastTouchTeam = 0; b.freeUntil = w.state.tick + 100;
  for (let i = 0; i < 60; i++) stepWorld(w);
  assert.equal(m.physicalGoals[0], 1);
  assert.equal(m.score[0], 0, "nobody has ruled yet");
  for (let i = 0; i < 400; i++) stepWorld(w);
  assert.equal(m.score[0], 1);
  assert.equal(events.find((e) => e.type === "fb_goal").official, m.officials.fourth);
});

test("removing a player brings on a substitute at the next stoppage", () => {
  const w = createWorld("remove");
  const m = createMatch(w, TEAMS.ENG, TEAMS.POR, { halfSeconds: 120 });
  while (m.phase !== "live") stepWorld(w);
  const star = playing(w.state, m, 1).find((a) => a.fb!.star)!;
  assert.equal(removePlayer(w, star.id, "arrested"), true);
  assert.equal(playing(w.state, m, 1).length, 10);
  const events: any[] = [];
  w.bus.on((e) => events.push(e));
  for (let i = 0; i < 60 * 240 && !events.some((e) => e.type === "fb_sub"); i++) stepWorld(w);
  assert.equal(playing(w.state, m, 1).length, 11);
  assert.equal(playing(w.state, m, 1).some((a) => a.fb!.star), false);
  assert.equal(star.fb!.goneReason, "arrested");
});

test("a bribed goalkeeper is flagged and still takes part", () => {
  const w = createWorld("bribe");
  const m = createMatch(w, TEAMS.ENG, TEAMS.POR, { halfSeconds: 60 });
  const gk = playing(w.state, m, 1).find((a) => a.fb!.role === "GK")!;
  bribePlayer(w, gk.id);
  assert.equal(gk.fb!.bribed, true);
  for (let i = 0; i < 3000; i++) stepWorld(w);
  assert.equal(gk.fb!.status, "playing");
});

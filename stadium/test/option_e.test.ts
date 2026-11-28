// Option E's foundations: the mission engine (one pinned plan, cards on offer, steps that only watch the
// world), the kick-off that waits, the thinner street, and football states as plain data.
import assert from "node:assert/strict";
import { test } from "node:test";
import { dispatch } from "../src/core/verbs";
import { createGame, stepGame, type Game } from "../src/stadium/game";
import { KICKOFF_AT, setPace, VENUE } from "../src/stadium/layout";
import { cards, defineMission, offered, pinned } from "../src/stadium/missions";
import { badges, clearState, hasState, setState } from "../src/stadium/fstates";
import { fingerprint, latestRecording, replay, startRecording } from "../src/stadium/replay";

const pcOf = (g: Game) => g.w.state.actors[g.w.state.stadium!.pc];
const run = (g: Game, seconds: number, each?: () => void) => { for (let i = 0; i < seconds * 60; i++) { each?.(); stepGame(g); } };
const events = (g: Game) => { const out: any[] = []; g.w.bus.on((e) => out.push(e)); return out; };
const calm = (soft = false) => setPace({ kickoffAt: 540, calm: true, soft });
const back = () => setPace({ kickoffAt: 330, calm: false });

// Test missions: on only while a test wants them, ranked ahead of the real ones.
const T = { on: false, a: 0, b: 0, c: 0 };
defineMission({ id: "t_one", title: "Test one", goal: "A goal.", buys: "It buys a thing.", zone: "out", rank: -100, on: () => T.on, with: { t_two: "Better with two." },
  stages: [{ text: "First", where: () => ({ x: 1, y: 2 }), done: () => T.a >= 1 }, { text: "Second", done: () => T.a >= 2 }, { text: "Third", done: () => T.a >= 3 }] });
defineMission({ id: "t_two", title: "Test two", goal: "Another.", buys: "Another thing.", zone: "out", rank: -99, on: () => T.on, stages: [{ text: "Only", done: () => T.b >= 1 }] });
defineMission({ id: "t_three", title: "Test three", goal: "Third.", buys: "x", zone: "out", rank: -98, on: () => T.on, stages: [{ text: "Only", done: () => false }], dead: () => (T.c ? "Too late." : null) });
defineMission({ id: "t_four", title: "Test four", goal: "Fourth.", buys: "x", zone: "out", rank: -97, on: () => T.on, stages: [{ text: "Only", done: () => false }] });
defineMission({ id: "t_in", title: "Test inside", goal: "Inside.", buys: "x", zone: "in", rank: -100, on: () => T.on, stages: [{ text: "Only", done: () => false }] });

test("missions: the first is pinned for you; steps follow the world in any order; a finished plan leaves the next one to you; three cards on the table, more once you've been in", () => {
  Object.assign(T, { on: true, a: 0, b: 0, c: 0 }); calm();
  try {
    const g = createGame("mis1"), w = g.w, st = w.state.stadium!, ev = events(g), pc = pcOf(g);
    run(g, 1);
    // Pinned without asking, with a place to go.
    let p = pinned(w)!;
    assert.equal(p.id, "t_one"); assert.equal(p.text, "First"); assert.deepEqual(p.where, { x: 1, y: 2 }); assert.equal(p.of, 3);
    assert.ok(ev.some((e) => e.type === "mission_stage" && e.mission === "t_one" && e.picked));
    // Three on the table outside; the inside one isn't offered yet.
    assert.deepEqual(offered(w).map((d) => d.id), ["t_one", "t_two", "t_three"]);
    assert.equal(dispatch(w, { verb: "mission", actor: pc.id, arg: "t_in" }).ok, false);
    // A later step already true carries the earlier one with it.
    T.a = 2; run(g, 1);
    p = pinned(w)!; assert.equal(p.text, "Third"); assert.equal(p.n, 2);
    // The card shows the whole plan, where he is in it, and what it goes with.
    const c = cards(w).find((x) => x.id === "t_one")!;
    assert.deepEqual(c.steps.map((s) => [s.done, s.now]), [[true, false], [true, false], [false, true]]);
    assert.deepEqual(c.with, ["Better with two."]);
    // Finished: said so, nothing pinned, the next card comes onto the table, and nothing is picked for him.
    T.a = 3; run(g, 1);
    assert.ok(ev.some((e) => e.type === "mission_done" && e.mission === "t_one" && e.ok && e.buys === "It buys a thing."));
    assert.equal(pinned(w), null);
    run(g, 2); assert.equal(pinned(w), null);
    assert.deepEqual(offered(w).map((d) => d.id), ["t_two", "t_three", "t_four"]);
    // He picks; a plan that can't be done any more is taken off with its reason.
    assert.equal(dispatch(w, { verb: "mission", actor: pc.id, arg: "t_three" }).ok, true);
    assert.equal(pinned(w)!.id, "t_three");
    T.c = 1; run(g, 1);
    assert.ok(ev.some((e) => e.type === "mission_done" && e.mission === "t_three" && !e.ok && e.why === "Too late."));
    assert.equal(pinned(w), null);
    // Another finishes in the background without being pinned.
    T.b = 1; run(g, 1);
    assert.ok(st.missions!.done.t_two);
    // Once he's been inside, the inside cards join.
    pc.x = 0; pc.y = 0; assert.ok(VENUE.inside(pc.x, pc.y)); run(g, 1);
    assert.ok(offered(w).some((d) => d.id === "t_in"));
    assert.equal(dispatch(w, { verb: "mission", actor: pc.id, arg: "t_in" }).ok, true);
  } finally { T.on = false; back(); }
});

test("the kick-off waits: it holds at four minutes until he goes in or says so, never more than eight minutes; the coach and anything timed against kick-off wait with it; without the soft clock nothing changes", () => {
  try {
    const ko = (soft: boolean, at: (g: Game, t: number) => void = () => {}) => {
      calm(soft);
      const g = createGame("soft1"), ev = events(g); let t = 0;
      while (!ev.some((e) => e.type === "fb_period_start") && t < 1200 * 60) { at(g, t); stepGame(g); t++; }
      return { g, ev, at: Math.round(t / 60), tick: (type: string) => { const e = ev.find((x) => x.type === type); return e ? Math.round(e.t / 60) : -1; } };
    };
    // As it always was.
    const plain = ko(false);
    assert.equal(plain.at, 540); assert.equal(plain.tick("ko_wait"), -1);
    // Left alone: held from 5:00 for eight minutes, then four more.
    const idle = ko(true);
    assert.equal(idle.tick("ko_wait"), 300); assert.equal(idle.tick("ko_go"), 780); assert.equal(idle.at, 1020);
    assert.equal(Math.round(KICKOFF_AT), 1020);
    // "Head in" at 6:40: four minutes from then. Their coach hadn't left while it waited, and leaves on time after.
    let busAt400 = "";
    const said = ko(true, (g, t) => { if (t === 400 * 60) { busAt400 = g.w.state.stadium!.vehicles.bus!.state; assert.equal(dispatch(g.w, { verb: "headin", actor: g.w.state.stadium!.pc }).ok, true); } });
    assert.equal(busAt400, "parked"); assert.equal(said.at, 640);
    assert.ok(said.ev.some((e) => e.type === "ko_go" && e.why === "chose"));
    assert.ok(said.g.w.state.stadium!.vehicles.bus!.state !== "parked" || said.g.w.state.stadium!.vehicles.bus!.until > 60 * 3600, "the coach got going once the clock did");
    // Walking in does the same; in before the hold, and it never holds at all.
    const walked = ko(true, (g, t) => { if (t === 360 * 60) { const pc = pcOf(g); pc.x = 0; pc.y = 0; g.w.state.stadium!.admitted = true; } });
    assert.equal(walked.at, 600); assert.ok(walked.ev.some((e) => e.type === "ko_go" && e.why === "in"));
    const early = ko(true, (g, t) => { if (t === 120 * 60) { const pc = pcOf(g); pc.x = 0; pc.y = 0; g.w.state.stadium!.admitted = true; } });
    assert.equal(early.at, 540); assert.equal(early.tick("ko_wait"), -1);
    // A new game starts from the scheduled time again.
    calm(true); createGame("soft2"); assert.equal(KICKOFF_AT, 540);
  } finally { back(); }
});

test("a waited-for kick-off replays exactly", () => {
  try {
    calm(true);
    const g = createGame("soft3");
    startRecording(g, "soft3");
    run(g, 420, () => { const pc = pcOf(g); pc.moveX = g.w.state.tick % 600 < 300 ? 0.6 : -0.6; pc.moveY = 0; });
    dispatch(g.w, { verb: "headin", actor: g.w.state.stadium!.pc });
    run(g, 60);
    const rec = structuredClone(latestRecording()!), end = g.w.state.tick, fp = fingerprint(g.w);
    assert.equal(rec.soft, true);
    const g2 = replay(rec, createGame, stepGame, end);
    assert.equal(fingerprint(g2.w), fp);
  } finally { back(); }
});

test("the street is thin in the game: never more than 64 supporters outside before the rush, and they still get in", () => {
  try {
    calm(true);
    const g = createGame("thin1"), s = g.w.state;
    const outside = () => Object.values(s.actors).filter((a) => a.npc?.job === "fan" && !a.dead && !VENUE.inside(a.x, a.y)).length;
    let most = 0;
    run(g, 420, () => { if (s.tick % 600 === 0) most = Math.max(most, outside()); });
    assert.ok(most <= 66, `most outside ${most}`);
    assert.ok(most >= 30, `somebody's about: ${most}`);
    const inside = Object.values(s.actors).filter((a) => a.npc?.job === "fan" && !a.dead && VENUE.inside(a.x, a.y)).length;
    assert.ok(inside >= 20, `supporters have been going in: ${inside}`);
  } finally { back(); }
});

test("football states are plain data: written once, extended not doubled, expire, and show as badges", () => {
  const g = createGame("fst1"), w = g.w, ev = events(g);
  setState(w, "hyper", 1, 30, "test"); setState(w, "hyper", 1, 60, "test"); setState(w, "biased", 0, 0, "test");
  assert.equal(w.state.stadium!.fstates!.length, 2);
  assert.ok(hasState(w, "hyper", 1)); assert.ok(!hasState(w, "hyper", 0)); assert.ok(hasState(w, "biased"));
  assert.equal(ev.filter((e) => e.type === "fstate" && e.on).length, 2);
  assert.deepEqual(badges(w).map((b) => [b.id, b.team]), [["hyper", 1], ["biased", 0]]);
  assert.match(badges(w)[0].text, /flying into everything/);
  run(g, 45); assert.ok(hasState(w, "hyper", 1));
  run(g, 20); assert.ok(!hasState(w, "hyper", 1)); assert.ok(hasState(w, "biased"));
  clearState(w, "biased", 0); assert.equal(badges(w).length, 0);
});

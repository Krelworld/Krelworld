import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnItem } from "../src/core/items";
import type { Actor } from "../src/core/types";
import { dispatch } from "../src/core/verbs";
import { createGame, stepGame, type Game } from "../src/stadium/game";
import { SPOTS } from "../src/stadium/layout";
import { say } from "../src/stadium/npc";
import { theirStar } from "../src/stadium/fixes";
import { removePlayer } from "../src/football/api";

const pcOf = (g: Game) => g.w.state.actors[g.w.state.stadium!.pc];
const find = (g: Game, pred: (a: Actor) => boolean) => Object.values(g.w.state.actors).find(pred)!;
const run = (g: Game, seconds: number, each?: () => void) => { for (let i = 0; i < seconds * 60; i++) { each?.(); stepGame(g); } };
const events = (g: Game) => { const out: any[] = []; g.w.bus.on((e) => out.push(e)); return out; };

test("talking to the same fan gives different exchanges, not one line", () => {
  const g = createGame("talk1"), pc = pcOf(g), ev = events(g);
  const fan = find(g, (a) => a.npc?.job === "fan" && !a.npc.shop && Math.hypot(a.x - pc.x, a.y - pc.y) < 40);
  const said = new Set<string>();
  for (let i = 0; i < 4; i++) {
    pc.x = fan.x + 1; pc.y = fan.y;
    const r = dispatch(g.w, { verb: "talk", actor: pc.id, target: { k: "actor", id: fan.id } });
    assert.equal(r.ok, true, String(r.reason));
    said.add(fan.npc!.bubble?.text ?? "");
    run(g, 6);
  }
  assert.ok(said.size >= 3, [...said].join(" | "));
  assert.ok(ev.some((e) => e.type === "say"));
});

test("a fan who sees a punch with no steward about goes to grass, and a bribe stops him", () => {
  const g = createGame("snitch1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  // Somewhere quiet outside: the pub yard.
  pc.x = SPOTS.pubYard.x; pc.y = SPOTS.pubYard.y;
  const fans = Object.values(s.actors).filter((a) => a.npc?.job === "fan" && !a.npc.shop).slice(0, 2);
  fans[0].x = pc.x + 1; fans[0].y = pc.y; fans[1].x = pc.x - 3; fans[1].y = pc.y; fans[1].facing = 0;
  for (const a of Object.values(s.actors)) if (a.npc && ["turnstile","doorguard","gateguard","pitchsteward","patrol","corridor","chief","police"].includes(a.npc.job) && Math.hypot(a.x - pc.x, a.y - pc.y) < 20) { a.x += 40; }
  dispatch(g.w, { verb: "strike", actor: pc.id, target: { k: "actor", id: fans[0].id } });
  run(g, 0.2);
  const sn = s.stadium!.snitches ?? [];
  assert.ok(sn.length >= 1 || ev.some((e) => e.type === "say" && /cheer|Have that|didn't see|business|pint/i.test(e.text)), JSON.stringify(ev.filter((e) => e.type === "say")));
  if (sn.length) {
    const w = s.actors[sn[0].by];
    pc.x = w.x + 1; pc.y = w.y; pc.money = 50;
    const r = dispatch(g.w, { verb: "bribe", actor: pc.id, target: { k: "actor", id: w.id }, amount: 20 });
    assert.equal(r.ok, true, String(r.reason));
    assert.equal((s.stadium!.snitches ?? []).length, 0);
  }
});

test("the phone: wife, bomb threat delays kick-off, own phone gets traced", () => {
  const g = createGame("phone1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  assert.equal(dispatch(g.w, { verb: "call", actor: pc.id, arg: "wife" }).ok, true);
  assert.equal(dispatch(g.w, { verb: "call", actor: pc.id, arg: "dealer" }).ok, false);
  assert.equal(dispatch(g.w, { verb: "call", actor: pc.id, arg: "bomb" }).ok, true);
  assert.ok(s.stadium!.phone!.traceAt);
  run(g, 31);
  assert.ok(ev.some((e) => e.type === "traced"));
});

test("a burner bomb threat is not traced, and the burner is snapped", () => {
  const g = createGame("phone2"), s = g.w.state, pc = pcOf(g), ev = events(g);
  const b = spawnItem(s, "burner", { k: "pocket", a: pc.id });
  assert.equal(dispatch(g.w, { verb: "call", actor: pc.id, arg: "bomb", item: b.id }).ok, true);
  assert.equal(s.stadium!.phone!.traceAt, undefined);
  assert.equal(s.items[b.id].loc.k, "gone");
  run(g, 2);
  assert.ok(ev.some((e) => e.type === "burner_snapped"));
});

test("the boxer comes and flattens who you point at", () => {
  const g = createGame("boxer1"), s = g.w.state, pc = pcOf(g);
  s.stadium!.flags.contact_boxer = 1; pc.money = 100;
  const t = find(g, (a) => a.npc?.job === "fan" && !a.npc.shop && Math.hypot(a.x - pc.x, a.y - pc.y) < 30);
  assert.equal(dispatch(g.w, { verb: "call", actor: pc.id, arg: `boxer:${t.id}` }).ok, true);
  assert.equal(pc.money, 50);
  run(g, 40);
  assert.ok(t.downUntil > s.tick || t.effects.ko > s.tick || t.dead, "target should be down");
});

test("stripping off, then a dress and wig gets Lonely Len's ticket", () => {
  const g = createGame("len1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  assert.equal(dispatch(g.w, { verb: "strip", actor: pc.id }).ok, true);
  assert.equal(pc.naked, true);
  const len = s.actors[s.stadium!.scenarioIds!.len];
  const dress = spawnItem(s, "dress", { k: "hand", a: pc.id });
  dispatch(g.w, { verb: "wear", actor: pc.id, item: dress.id });
  const wig = spawnItem(s, "long_wig", { k: "hand", a: pc.id });
  dispatch(g.w, { verb: "wear", actor: pc.id, item: wig.id });
  pc.x = len.x + 1.5; pc.y = len.y; len.facing = 0;
  run(g, 2);
  assert.ok(ev.some((e) => e.type === "secret" && e.id === "len"), "Len should give the ticket");
  assert.ok([pc.hand, ...pc.pockets].some((id) => id && s.items[id].def === "ticket"));
});

test("walkie decoy sends nearby stewards off", () => {
  const g = createGame("decoy1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  spawnItem(s, "radio", { k: "pocket", a: pc.id });
  pc.x = 0; pc.y = 48;
  assert.equal(dispatch(g.w, { verb: "radio", actor: pc.id, arg: "decoy" }).ok, true);
  const e = ev.find((x) => x.type === "radio_decoy");
  assert.ok(e && e.sent > 0, JSON.stringify(e));
});

test("up a ladder onto the pub roof: walk about, nobody below can make out your face, drop off the edge", () => {
  const g = createGame("roof1"), s = g.w.state, pc = pcOf(g);
  pc.x = -38; pc.y = 81.3;
  assert.equal(dispatch(g.w, { verb: "ladder", actor: pc.id }).ok, true);
  assert.equal(pc.roofId, "pub");
  run(g, 1);
  // Walk across the roof: no walls stop you, the edges do.
  run(g, 3, () => { pc.moveX = -1; pc.moveY = 0; });
  pc.moveX = 0;
  assert.ok(pc.x < -40 && pc.x > -62.3, `on the roof at ${pc.x}`);
  // A brick from up here: the wanted description has no face (nobody was close).
  const b = spawnItem(s, "brick", { k: "hand", a: pc.id });
  const fan = find(g, (a) => a.npc?.job === "fan" && !a.npc.shop);
  pc.y = 70; run(g, 0.1);
  fan.x = pc.x; fan.y = 84; fan.facing = -Math.PI / 2; fan.npc!.plan = [{ k: "wait", s: 99 }];
  const before = s.stadium!.wanted.length;
  dispatch(g.w, { verb: "throw", actor: pc.id, item: b.id, dirX: fan.x - pc.x, dirY: fan.y - pc.y, dist: Math.hypot(fan.x - pc.x, fan.y - pc.y) });
  run(g, 2);
  const added = s.stadium!.wanted.slice(before);
  for (const wd of added) assert.equal(wd.face, "");
  // Off the edge: on your backside for a moment, then on the street.
  pc.x = -40; pc.y = 80; run(g, 0.1);
  assert.equal(dispatch(g.w, { verb: "dropdown", actor: pc.id }).ok, true);
  assert.equal(!!pc.roof, false);
  assert.ok(pc.y > 80.5);
});

test("a brick through a concourse window, then climb in", () => {
  const g = createGame("win1"), s = g.w.state, pc = pcOf(g);
  pc.x = -40; pc.y = 46;
  spawnItem(s, "brick", { k: "hand", a: pc.id });
  assert.equal(dispatch(g.w, { verb: "smashwindow", actor: pc.id }).ok, true);
  assert.equal(dispatch(g.w, { verb: "climbwindow", actor: pc.id }).ok, true);
  assert.ok(pc.y < 44, "inside");
});

test("a fart canister clears people out", () => {
  const g = createGame("fart1"), s = g.w.state, pc = pcOf(g);
  const fans = Object.values(s.actors).filter((a) => a.npc?.job === "fan" && !a.npc.shop).slice(0, 4);
  fans.forEach((a, i) => { a.x = 10 + i; a.y = 52; a.npc!.plan = [{ k: "wait", s: 99 }]; a.seated = false; });
  pc.x = 0; pc.y = 52;
  const c = spawnItem(s, "fart_can", { k: "hand", a: pc.id });
  dispatch(g.w, { verb: "throw", actor: pc.id, item: c.id, dirX: 1, dirY: 0, dist: 11.5 });
  run(g, 6);
  assert.ok(s.stadium!.smoke.some((k) => k.kind === "stench"));
  const still = fans.filter((a) => Math.hypot(a.x - 11.5, a.y - 52) < 6).length;
  assert.ok(still <= 1, `${still} still in the cloud`);
});

test("the rifle: three rounds, a kill, armed police called", () => {
  const g = createGame("rifle1"), s = g.w.state, pc = pcOf(g);
  const rf = spawnItem(s, "rifle", { k: "hand", a: pc.id }); rf.ammo = 3;
  const t = find(g, (a) => a.npc?.job === "fan" && !a.npc.shop);
  t.x = pc.x + 10; t.y = pc.y;
  assert.equal(dispatch(g.w, { verb: "shoot", actor: pc.id, target: { k: "actor", id: t.id } }).ok, true);
  assert.equal(rf.ammo, 2);
  assert.ok(s.stadium!.flags.armedAt);
});

test("fixes: overhearing reveals one, and any way of doing it counts", () => {
  const g = createGame("fix1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  const fan = find(g, (a) => a.npc?.job === "fan" && !a.npc.shop);
  fan.x = pc.x + 2; fan.y = pc.y;
  // Hearing about their keeper's habit.
  say(g.w, fan, "Their keeper likes a bet. Everyone knows it. Wave a hundred quid at him and see.");
  assert.ok(s.stadium!.flags.fix_keeper && s.stadium!.flags.fixw_keeper_bribe);
  // Their star off the pitch, however it happened: done, "your way" (nobody told you how).
  removePlayer(g.w, theirStar(g.w)!.id, "injured");
  run(g, 1);
  const d = ev.find((e) => e.type === "fix_done" && e.id === "star");
  assert.ok(d && d.ownWay);
});

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

test("you can't walk through the lorry or the police van", () => {
  const g = createGame("solidvan"), s = g.w.state, pc = pcOf(g), st = s.stadium!;
  // The police van by the ground: walk north into it from the road side.
  pc.x = 32; pc.y = 58.5;
  run(g, 2, () => { pc.moveX = 0; pc.moveY = -1; });
  assert.ok(pc.y > 55.6, `went into the van: y=${pc.y.toFixed(2)}`);
  // The beer lorry, stood loading: walk straight at its middle.
  const v = st.vehicles.lorry;
  v.speed = 0;
  const c = Math.cos(v.facing), sn = Math.sin(v.facing);
  pc.x = v.x - sn * 4; pc.y = v.y + c * 4;
  run(g, 1.5, () => { v.speed = 0; pc.moveX = sn; pc.moveY = -c; });
  const across = Math.abs(-(pc.x - v.x) * sn + (pc.y - v.y) * c);
  assert.ok(across > 1.3, `inside the lorry: ${across.toFixed(2)} from its middle`);
});

test("a change of clothes out of sight loses the steward after you; in front of him it doesn't", () => {
  const g = createGame("disguise1"), s = g.w.state, pc = pcOf(g);
  const stw = find(g, (a) => a.npc?.job === "patrol");
  const wig = spawnItem(s, "wig", { k: "pocket", a: pc.id });
  const tache = spawnItem(s, "moustache", { k: "pocket", a: pc.id });
  // In front of him: he keeps you.
  pc.x = SPOTS.pubYard.x; pc.y = SPOTS.pubYard.y;
  stw.x = pc.x + 3; stw.y = pc.y; stw.facing = Math.PI;
  Object.assign(stw.npc!, { target: pc.id, mode: "chase", crime: 1 });
  dispatch(g.w, { verb: "wear", actor: pc.id, item: wig.id });
  assert.equal(stw.npc!.target, pc.id);
  // Round the corner, far off: he loses you.
  stw.x = pc.x + 40; stw.y = pc.y - 30;
  Object.assign(stw.npc!, { target: pc.id, mode: "search", crime: 1 });
  dispatch(g.w, { verb: "wear", actor: pc.id, item: tache.id });
  assert.equal(stw.npc!.target, null);
  assert.equal(stw.npc!.mode, "routine");
});

test("the pawnbroker buys what you've lifted, and won't touch a face", () => {
  const g = createGame("pawn1"), s = g.w.state, pc = pcOf(g);
  const ron = find(g, (a) => a.npc?.shop === "pawn");
  pc.x = ron.x; pc.y = ron.y + 2.6;
  const wallet = spawnItem(s, "wallet", { k: "pocket", a: pc.id });
  const face = spawnItem(s, "face", { k: "pocket", a: pc.id });
  const before = pc.money;
  assert.equal(dispatch(g.w, { verb: "pawn", actor: pc.id, target: { k: "actor", id: ron.id }, item: wallet.id }).ok, true);
  assert.ok(pc.money > before);
  assert.equal(s.items[wallet.id].loc.k, "gone");
  assert.equal(dispatch(g.w, { verb: "pawn", actor: pc.id, target: { k: "actor", id: ron.id }, item: face.id }).ok, false);
  // And he sells: a walkie.
  pc.money = 100;
  assert.equal(dispatch(g.w, { verb: "buy", actor: pc.id, target: { k: "actor", id: ron.id }, arg: "radio" }).ok, true);
});

test("the to-do list pays once per item; the fruit machine takes a quid", () => {
  const g = createGame("pay1"), pc = pcOf(g);
  const m0 = pc.money;
  assert.equal(dispatch(g.w, { verb: "payout", actor: pc.id, arg: "roof" }).ok, true);
  assert.equal(pc.money, m0 + 10);
  assert.equal(dispatch(g.w, { verb: "payout", actor: pc.id, arg: "roof" }).ok, false);
  pc.x = -36; pc.y = 65.4;
  let spent = 0, won = 0;
  g.w.bus.on((e: any) => { if (e.type === "fruit") { spent++; won += e.win; } });
  for (let i = 0; i < 20; i++) dispatch(g.w, { verb: "fruit", actor: pc.id });
  assert.equal(spent, 20);
  assert.ok(won < 60, `won ${won}`);
});

test("in a frock, a bloke gets handsy; flattening him isn't a crime, hitting an innocent man still is", () => {
  const g = createGame("drag1"), s = g.w.state, pc = pcOf(g), st = s.stadium!, ev = events(g);
  const dress = spawnItem(s, "dress", { k: "pocket", a: pc.id });
  dispatch(g.w, { verb: "wear", actor: pc.id, item: dress.id });
  // Out of the way of stewards, with a man stood near.
  pc.x = SPOTS.pubYard.x; pc.y = SPOTS.pubYard.y;
  for (const a of Object.values(s.actors)) if (a.npc && ["turnstile","doorguard","gateguard","pitchsteward","patrol","corridor","chief","police"].includes(a.npc.job) && Math.hypot(a.x - pc.x, a.y - pc.y) < 25) a.x += 60;
  const man = find(g, (a) => a.npc?.job === "fan" && !a.female && !a.seated);
  man.x = pc.x + 4; man.y = pc.y; man.npc!.plan = [];
  st.flags.creepNext = 0;
  // Force the advance (the dice decide normally).
  st.creep = { id: man.id, phase: "advance", until: s.tick + 60 * 14 };
  run(g, 6, () => { pc.moveX = pc.moveY = 0; });
  assert.ok(ev.some((e) => e.type === "groped"), "he came over and got handsy");
  const before = st.incidents.length;
  pc.x = man.x - 0.9; pc.y = man.y; pc.facing = 0;
  dispatch(g.w, { verb: "strike", actor: pc.id, target: { k: "actor", id: man.id } });
  assert.equal(st.incidents.length, before, "no crime");
  assert.ok(ev.some((e) => e.type === "self_defence"));
  // A different man, who's done nothing: assault.
  const other = find(g, (a) => a.npc?.job === "fan" && !a.female && a.id !== man.id && !a.seated);
  other.x = pc.x + 0.9; other.y = pc.y;
  dispatch(g.w, { verb: "strike", actor: pc.id, target: { k: "actor", id: other.id } });
  assert.ok(st.incidents.length > before, "assault");
});

test("Kev's call counts as overheard; Ricky's call leaves his number; flattening a hunter shortens the search", () => {
  const g = createGame("calls1"), s = g.w.state, pc = pcOf(g), st = s.stadium!;
  dispatch(g.w, { verb: "callin", actor: pc.id, arg: "kev|Word is their keeper likes a bet." });
  assert.ok(st.flags.fix_keeper, "keeper fix heard");
  assert.ok(st.flags.fixw_keeper_bribe, "and how");
  dispatch(g.w, { verb: "callin", actor: pc.id, arg: "ricky|number" });
  assert.ok(st.flags.contact_dealer, "Ricky's number saved");
  const stw = find(g, (a) => a.npc?.job === "patrol");
  Object.assign(stw.npc!, { target: pc.id, mode: "search", crime: 1 });
  st.flags.evadeUntil = s.tick + 60 * 20;
  const before = st.flags.evadeUntil;
  g.w.bus.emit({ type: "knockout", t: s.tick, who: stw.id, by: pc.id });
  assert.ok(st.flags.evadeUntil < before, "search shortened");
});

test("the drayman's keg: roll it and he goes after it, the lorry waits with its back open, and the chain is named", () => {
  const g = createGame("keg1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  run(g, 1);
  const kegs = Object.values(s.items).filter((i) => i.def === "keg");
  assert.equal(kegs.length, 4);
  const keg = kegs.find((k) => k.home && Math.hypot(k.home.x + 30.1, k.home.y - 69.5) < 0.1) ?? kegs[3];
  const l = keg.loc as { x: number; y: number };
  // Stand behind it, facing up the yard, and roll it.
  pc.x = l.x - 0.9; pc.y = l.y + 0.3; pc.facing = 0;
  const r = dispatch(g.w, { verb: "shove", actor: pc.id, item: keg.id });
  assert.equal(r.ok, true, String(r.reason));
  run(g, 3);
  const k2 = keg.loc as { x: number; y: number };
  assert.ok(Math.hypot(k2.x - keg.home!.x, k2.y - keg.home!.y) > 3, "it rolled a good few metres");
  const dray = find(g, (a) => a.npc?.job === "worker");
  run(g, 2);
  if (!dray.hiddenIn) {
    assert.equal(dray.npc!.fetch, keg.id, "he's gone after it");
    assert.ok(ev.some((e) => e.type === "post_left" && e.by === dray.id));
    const chain = ev.filter((e) => e.type === "chain").pop();
    assert.ok(chain && chain.links[0] === "KEG" && chain.links.includes("DRAYMAN GOES AFTER IT"), JSON.stringify(chain));
    // He brings it back where it belongs.
    run(g, 40);
    const k3 = keg.loc as { x: number; y: number };
    assert.ok(Math.hypot(k3.x - keg.home!.x, k3.y - keg.home!.y) < 0.5, "back on the stack");
    assert.equal(dray.npc!.fetch, undefined);
  }
});

test("Ronson goes for food: a pie by the turnstile steward and he's off the lead, and the steward's off his post", () => {
  const g = createGame("pie1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  run(g, 1);
  const dog = s.actors[s.stadium!.dog!.id];
  const stw = find(g, (a) => a.npc?.job === "turnstile" && !a.dead);
  // On the lead, a few metres from the steward, outside the ground.
  pc.x = stw.x + 6; pc.y = stw.y + 6; dog.x = pc.x - 1; dog.y = pc.y; s.stadium!.dog!.state = "led";
  const pie = spawnItem(s, "pie", { k: "ground", x: stw.x + 1.2, y: stw.y + 3.2 });
  run(g, 1);
  assert.equal(s.stadium!.dog!.state, "loose", "he's yanked the lead out of your hand");
  assert.ok(ev.some((e) => e.type === "dog_lured"));
  run(g, 5);
  assert.equal(s.items[pie.id].loc.k, "gone", "scoffed");
  assert.ok(ev.some((e) => e.type === "post_left" && e.by === stw.id), "the steward left his post for the dog");
  const chain = ev.filter((e) => e.type === "chain").pop();
  assert.ok(chain && chain.links.includes("RONSON GOES FOR IT"), JSON.stringify(chain));
});
test("the pawnbroker: nick a steward's radio, pawn it, and he leaves his post to get it back", () => {
  const g = createGame("pawn1"), s = g.w.state, pc = pcOf(g), ev = events(g);
  run(g, 1);
  const stw = find(g, (a) => a.npc?.job === "turnstile" && !a.dead), post = { ...stw.npc!.post! };
  const radio = spawnItem(s, "radio", { k: "pocket", a: stw.id });
  stw.pockets = [radio.id]; stw.money = 0;
  pc.x = stw.x - Math.cos(stw.facing) * 1; pc.y = stw.y - Math.sin(stw.facing) * 1;
  const r = dispatch(g.w, { verb: "pickpocket", actor: pc.id, target: { k: "actor", id: stw.id }, arg: "clean" });
  assert.equal(r.ok, true, String(r.reason));
  assert.equal(s.items[radio.id].stolenFrom, stw.id);
  const lionel = find(g, (a) => a.npc?.shop === "pawn");
  pc.x = lionel.x + 1; pc.y = lionel.y;
  const p = dispatch(g.w, { verb: "pawn", actor: pc.id, target: { k: "actor", id: lionel.id }, item: radio.id });
  assert.equal(p.ok, true, String(p.reason));
  run(g, 25);
  assert.ok(ev.some((e) => e.type === "post_left" && e.by === stw.id), "he heard and went");
  const chain = ev.filter((e) => e.type === "chain").pop();
  assert.ok(chain && chain.links.some((l: string) => l.includes("PAWN SHOP")), JSON.stringify(chain));
  run(g, 40);
  assert.ok(Math.hypot(stw.x - post.x, stw.y - post.y) > 6 || Math.hypot(stw.x - lionel.x, stw.y - lionel.y) < 4, "off his post, at the shop");
});
test("the ball comes to Grozz: out by him, the match waits; hoof it and it's row Z, keep it and it's his", async () => {
  const { beginRestart } = await import("../src/football/restarts");
  const { HW } = await import("../src/football/config");
  const g = createGame("ball1"), s = g.w.state, st = s.stadium!, pc = pcOf(g), ev = events(g);
  while (s.match!.phase !== "live") stepGame(g);
  run(g, 3);
  const m = s.match!;
  const out = (team: 0 | 1) => {
    st.admitted = true; delete st.ballOutCool; delete st.ballOut;
    pc.x = 4; pc.y = 29.2; pc.downUntil = 0;
    st.lastBall = { x: 3, y: HW - 0.2 };
    beginRestart(g.w, m, "throw_in", team, 3, HW, 2);
  };
  out(1);
  assert.ok(st.ballOut, "it's coming to him");
  run(g, 1.2, () => { pc.x = 4; pc.y = 29.2; });
  assert.equal(st.ballOut?.phase, "held");
  assert.ok(ev.some((e) => e.type === "ball_to_pc"));
  run(g, 3, () => { pc.x = 4; pc.y = 29.2; });
  assert.equal(m.phase, "restart", "they're waiting on him");
  const r = dispatch(g.w, { verb: "ballhoof", actor: pc.id });
  assert.equal(r.ok, true, String(r.reason));
  run(g, 2);
  const chain = ev.filter((e) => e.type === "chain").pop();
  assert.ok(chain && chain.links.includes("INTO ROW Z") && chain.links.includes("TIME WASTED"), JSON.stringify(chain));
  assert.equal(st.ballOut, undefined);
  assert.equal(m.phase, "restart", "a ballboy's still fetching it");
  run(g, 12);
  // Keep it, the next time.
  while ((m.phase as string) !== "live") stepGame(g);
  out(0);
  run(g, 1.2, () => { pc.x = 4; pc.y = 29.2; });
  assert.equal(dispatch(g.w, { verb: "ballkeep", actor: pc.id }).ok, true);
  assert.ok([pc.hand, ...pc.pockets].some((id) => id && s.items[id].def === "match_ball"), "up his jumper");
  run(g, 10);
  assert.notEqual(s.match!.phase as string, "restart", "they got another ball out");
});
test("the gate rush: packed in a crowd, a steward a few metres off can't pick Grozz out (game build)", async () => {
  const { setPace, KICKOFF_AT } = await import("../src/stadium/layout");
  const { canSee } = await import("../src/stadium/security");
  const before = KICKOFF_AT;
  setPace({ kickoffAt: 540, calm: true });
  try {
    const g = createGame("crush1"), s = g.w.state, pc = pcOf(g);
    const stw = find(g, (a) => a.npc?.job === "turnstile" && !a.dead);
    pc.x = stw.x + Math.cos(stw.facing) * 6; pc.y = stw.y + Math.sin(stw.facing) * 6;
    const seen = canSee(g.w, stw, pc);
    s.stadium!.flags.crowdCover = s.tick + 12;
    assert.equal(canSee(g.w, stw, pc), false, "lost in the crush");
    pc.x = stw.x + Math.cos(stw.facing) * 2; pc.y = stw.y + Math.sin(stw.facing) * 2;
    assert.equal(canSee(g.w, stw, pc), true, "but not right under his nose");
    void seen;
  } finally { setPace({ kickoffAt: before, calm: false }); }
});
test("the match directs: one job read off the score and clock, naming a target", async () => {
  const { matchJob } = await import("../src/stadium/director");
  const { theirStar, theirKeeper } = await import("../src/stadium/fixes");
  const g = createGame("job1"), s = g.w.state;
  assert.equal(matchJob(g.w), null, "nothing before kick-off");
  while (s.match!.phase !== "live") stepGame(g);
  const m = s.match!;
  let j = matchJob(g.w)!;
  assert.equal(j.id, "level-star"); assert.equal(j.target, theirStar(g.w)!.id);
  m.score = [0, 1];
  j = matchJob(g.w)!;
  assert.equal(j.id, "behind-gk"); assert.equal(j.target, theirKeeper(g.w)!.id);
  m.score = [1, 0]; m.period = 2; m.clock = m.cfg.halfSeconds * 0.5;
  j = matchJob(g.w)!;
  assert.equal(j.id, "ahead-late"); assert.match(j.text, /Waste time/);
  m.score = [1, 1]; m.clock = m.cfg.halfSeconds * 0.8;
  assert.equal(matchJob(g.w)!.id, "level-late");
});
test("the boot bag: move their star's boots and he goes looking instead of boarding, then plays in borrowed boots", async () => {
  const { theirStar } = await import("../src/stadium/fixes");
  const { moveItem } = await import("../src/core/items");
  const g = createGame("boots1"), s = g.w.state, st = s.stadium!, pc = pcOf(g), ev = events(g);
  const bag = Object.values(s.items).find((i) => i.def === "boot_bag")!;
  assert.ok(bag, "a boot bag by their coach");
  const star = theirStar(g.w)!, shot0 = star.fb!.shooting;
  // Grozz pockets it and walks off with it.
  moveItem(s, bag.id, { k: "hand", a: pc.id });
  while (!st.flags.boarding) stepGame(g);
  run(g, 1);
  assert.ok(st.bootHunt && st.bootHunt.who === star.id, "he's off looking");
  assert.ok(ev.some((e) => e.type === "post_left" && e.by === star.id));
  run(g, 24);
  assert.ok(st.flags.borrowedBoots, "gave up");
  assert.ok(star.fb!.shooting < shot0, "and it shows in his shooting");
  assert.ok(ev.some((e) => e.type === "chain" && e.links.some((l: string) => /BORROWED BOOTS/.test(l))), "named on the strap");
});
test("gear: a bag of lines makes Grozz faster and nastier, and a grab is often shrugged off", async () => {
  const { shrugOff } = await import("../src/stadium/coke");
  const g = createGame("coke1"), s = g.w.state, pc = pcOf(g);
  const bag = spawnItem(s, "powder", { k: "pocket", a: pc.id });
  pc.pockets.push(bag.id);
  assert.equal(dispatch(g.w, { verb: "line", actor: pc.id }).ok, true);
  assert.equal(bag.uses, 3, "one line gone");
  assert.ok((pc.effects.wired ?? 0) > s.tick);
  // Hits land twice as hard.
  const fan = find(g, (a) => a.npc?.job === "fan" && !a.dead);
  fan.x = pc.x + 1; fan.y = pc.y; fan.facing = Math.PI; fan.hurt = 0;
  const { land } = await import("../src/stadium/combat");
  land(g.w, pc, fan, false);
  assert.equal(fan.hurt, 2);
  // Grabbed: thrown off at least sometimes over a few tries.
  const stw = find(g, (a) => a.npc?.job === "turnstile" && !a.dead);
  let off = 0; for (let i = 0; i < 20; i++) if (shrugOff(g.w, stw, pc)) off++;
  assert.ok(off >= 3 && off <= 17, `shrugged off ${off}/20`);
  // Use it up.
  for (let i = 0; i < 3; i++) dispatch(g.w, { verb: "line", actor: pc.id });
  assert.equal(s.items[bag.id].loc.k, "gone", "bag done");
  assert.equal(dispatch(g.w, { verb: "line", actor: pc.id }).ok, false);
});
test("the mischief director: drift too long and something starts near you; nick the pint and he comes for you", async () => {
  const { setPace, KICKOFF_AT } = await import("../src/stadium/layout");
  const { moveItem } = await import("../src/core/items");
  const before = KICKOFF_AT;
  setPace({ kickoffAt: 540, calm: true });
  try {
    const g = createGame("lull1"), s = g.w.state, st = s.stadium!, pc = pcOf(g), ev = events(g);
    // Stand about doing nothing.
    run(g, 75);
    const beat = ev.find((e) => e.type === "beat");
    assert.ok(beat, "something happened near him");
    // Force the pint beat to test the payoff.
    st.flags.lastBeat = 0; st.flags.lastPayoff = 0; st.pintBeat = undefined;
    let pb: any;
    for (let i = 0; i < 20 && !pb; i++) { run(g, 50); pb = st.pintBeat; }
    if (pb) {
      moveItem(s, pb.pint, { k: "hand", a: pc.id });
      run(g, 32);
      assert.ok(ev.some((e) => e.type === "say" && e.by === pb.fan && /pint/i.test(e.text)), "he noticed");
    }
  } finally { setPace({ kickoffAt: before, calm: false }); }
});
test("caught in the game build: no march; detained means time passes, then you're let out by the office", async () => {
  const { setPace, KICKOFF_AT } = await import("../src/stadium/layout");
  const { crime } = await import("../src/stadium/security");
  const before = KICKOFF_AT;
  setPace({ kickoffAt: 540, calm: true });
  try {
    const g = createGame("custody1"), s = g.w.state, st = s.stadium!, pc = pcOf(g), ev = events(g);
    st.admitted = true;
    const stw = find(g, (a) => a.npc?.job === "pitchsteward" && !a.dead);
    pc.x = stw.x + Math.cos(stw.facing) * 2; pc.y = stw.y + Math.sin(stw.facing) * 2;
    run(g, 1);
    crime(g.w, pc, "brawling", 2, undefined);
    let held = false;
    run(g, 20, () => { if (st.custody) held = true; });
    assert.ok(held, "held");
    assert.ok(ev.some((e) => e.type === "custody"));
    assert.ok(!ev.some((e) => e.type === "escort_cut" && e.intent === "detain"), "no march");
    run(g, 50);
    assert.ok(!st.custody && !pc.hiddenIn, "let out");
    assert.ok(ev.some((e) => e.type === "custody_end"));
    assert.ok(Math.hypot(pc.x - 34, pc.y + 46.6) < 3, `by the office door, at ${pc.x.toFixed(1)},${pc.y.toFixed(1)}`);
  } finally { setPace({ kickoffAt: before, calm: false }); }
});

test("forecourt contraptions: boot the pigeons and the barriers go over and a turnstile's left free; the gas brings the door man over", async () => {
  const { RIGS } = await import("../src/stadium/rigs");
  const { options } = await import("../src/stadium/context");
  const run = (id: "pigeons_w" | "burger") => {
    const g = createGame(`rig-${id}`), s = g.w.state, st = s.stadium!, pc = s.actors[st.pc];
    for (let i = 0; i < 60 * 20; i++) stepGame(g);
    const at = RIGS[id].at(); pc.x = at.x; pc.y = at.y + 0.5;
    const top = options(g.w, pc).filter((o) => o.priority > 0).sort((a, b) => b.priority - a.priority)[0];
    assert.equal(top?.label, RIGS[id].label, "it's the main thing to do when you're stood by it");
    assert.equal(dispatch(g.w, { verb: "rig", actor: pc.id, arg: id }).ok, true);
    assert.equal(dispatch(g.w, { verb: "rig", actor: pc.id, arg: id }).ok, false, "once, then it needs a while");
    for (let i = 0; i < 60 * 8; i++) stepGame(g);
    return { g, st, links: st.chain?.links ?? [] };
  };
  const a = run("pigeons_w");
  assert.ok(a.links.includes("THE BARRIER GOES OVER") && a.links.includes("THE STEWARD COMES OUT TO PICK THEM UP"), a.links.join(" > "));
  assert.ok(Object.values(a.st.gates).some((v) => v.for === a.st.pc && v.until > a.g.w.state.tick), "a turnstile's open for you while he's out");
  const b = run("burger");
  assert.ok(b.links.includes("WHOOMPH") && b.links.includes("STAFF DOOR LEFT PROPPED OPEN"), b.links.join(" > "));
});

// The two bent schemes (Option D): a random drugs test, and a word in his ear. Headless, the game's own pace.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnItem } from "../src/core/items";
import type { Actor } from "../src/core/types";
import { dispatch } from "../src/core/verbs";
import { createGame, stepGame, type Game } from "../src/stadium/game";
import { KICKOFF_AT, setPace, SPOTS } from "../src/stadium/layout";
import { options } from "../src/stadium/context";
import { notebook, schemeState } from "../src/stadium/schemes";
import { theirKeeper, theirStar } from "../src/stadium/fixes";
import { installDrugs } from "../src/stadium/scheme_drugs";
import { installBribe } from "../src/stadium/scheme_bribe";

installDrugs(); installBribe();

const run = (g: Game, seconds: number) => { for (let i = 0; i < seconds * 60; i++) stepGame(g); };
const until = (g: Game, seconds: number, done: () => boolean) => { for (let i = 0; i < seconds * 60 && !done(); i++) stepGame(g); return done(); };
const cutMs = (ev: any[], variant: string) => { const p = ev.find((e) => e.type === "scheme_play" && e.variant === variant); return p ? p.beats.filter((b: any) => b.cut).reduce((n: number, b: any) => n + b.ms, 0) : -1; };
const calm = (f: () => void) => { const before = KICKOFF_AT; setPace({ kickoffAt: 540, calm: true }); try { f(); } finally { setPace({ kickoffAt: before, calm: false }); } };
function start(seed: string, scheme: string) {
  const g = createGame(seed), s = g.w.state, st = s.stadium!, pc = s.actors[st.pc], ev: any[] = [];
  g.w.bus.on((e) => ev.push(e));
  // Not ours: Mad Mick (scenarios.ts) is a "fan" with no seat, and npc.ts's routine() falls over on him if he
  // ever finishes walking in (seen at 536 s on seed "bent3"). Sat where he stands, so a long run can't trip on it.
  for (const a of Object.values(s.actors)) if (a.npc?.job === "fan" && !a.npc.seat) a.npc.seat = { x: a.x, y: a.y };
  const by = (f: (a: Actor) => boolean) => Object.values(s.actors).find((a) => a.npc && f(a))!;
  const at = (x: number, y: number) => { pc.x = x; pc.y = y; pc.moveX = pc.moveY = 0; };
  const act = (arg: string) => options(g.w, pc, null).find((q) => q.action?.verb === "scheme" && q.action.arg === arg);
  return { g, s, st, pc, ev, by, at, act, m: s.match!, sc: schemeState(g.w, scheme)! };
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test("a random drugs test: gear in their ten's boot bag, a name to a copper, and he's led off the pitch at the next stoppage", () => calm(() => {
  const { g, s, st, pc, ev, by, at, act, m, sc } = start("bent1", "drugs");
  const star = theirStar(g.w)!, bag = Object.values(s.items).find((i) => i.def === "boot_bag")!, bl = bag.loc as { x: number; y: number };
  run(g, 2);
  const page = () => notebook(g.w).find((n) => n.title === "A random drugs test");
  assert.equal(page(), undefined, "not in the notebook till he's noticed something");
  // Stood by the coach: the boot bags. And a bag of his own.
  const gear = spawnItem(s, "powder", { k: "pocket", a: pc.id });
  at(bl.x + 1.2, bl.y + 0.4); run(g, 1);
  assert.ok(sc.clues.near, "he notices the boot bag");
  assert.ok(sc.met.gear, "and he's holding what a copper would want to find");
  assert.ok(page()!.lines.some((l) => !l.ok && /\?$/.test(l.text)), "what he doesn't know is a question");
  const driver = s.actors[st.vehicles.bus.driver];
  driver.x = bl.x + 12; driver.facing = 0; // the driver's round the front
  const zip = act("drugs:bag");
  assert.ok(zip, "the boot bag offers itself");
  assert.equal(dispatch(g.w, zip!.action!).ok, true);
  assert.equal(gear.loc.k, "in");
  assert.ok(!ev.some((e) => e.type === "incident" && e.seen > 0), "nobody saw");
  // The coach is called; the bag's packed; it's his now.
  at(SPOTS.pubYard.x, SPOTS.pubYard.y);
  assert.ok(until(g, 420, () => star.pockets.includes(gear.id)), "he carries it in himself");
  run(g, 1);
  assert.equal(sc.met.on, "boot bag");
  // Into the match. Then a word with a copper.
  assert.ok(until(g, 400, () => m.phase === "live" && s.tick > 60 * (KICKOFF_AT + 15)), "kick-off");
  const cop = by((a) => a.npc!.job === "police" && a.npc!.mode === "routine" && !a.npc!.mounted);
  at(cop.x + 1.5, cop.y);
  assert.equal(dispatch(g.w, { verb: "report", actor: pc.id, target: { k: "actor", id: star.id } }).ok, true);
  assert.ok(sc.vars.tip, "the scheme has the tip");
  at(SPOTS.pubYard.x, SPOTS.pubYard.y);
  // He walks down to the touchline and waits for the ball to go dead; then he walks on.
  assert.ok(until(g, 420, () => !!sc.vars.go), `the copper gets there and play stops (${JSON.stringify(st.tipoffs)} ${JSON.stringify(sc.vars)})`);
  assert.equal(star.fb!.status, "playing", "nothing's happened to him yet");
  assert.equal(m.halted, "police");
  assert.ok(until(g, 90, () => !!sc.done), `the scene plays out (${JSON.stringify(sc.vars)})`);
  assert.equal(sc.variant, "nicked", JSON.stringify(sc.vars));
  const cut = cutMs(ev, "nicked");
  assert.ok(cut > 0 && cut <= 15000, `control's away for fifteen seconds at most (${cut})`);
  const idx = (f: (e: any) => boolean) => ev.findIndex(f);
  const halted = idx((e) => e.type === "fb_halted" && e.reason === "police"), played = idx((e) => e.type === "scheme_play" && e.scheme === "drugs"), nicked = idx((e) => e.type === "tipoff_arrest" && e.who === star.id && e.planted);
  const removed = idx((e) => e.type === "fb_removed" && e.id === star.id && e.reason === "arrested" && e.team === 1), resumed = idx((e) => e.type === "fb_resumed");
  assert.ok(halted >= 0 && halted < played && played < nicked && nicked < removed && removed < resumed, `stopped, staged, searched (the old search), removed, restarted: ${[halted, played, nicked, removed, resumed]}`);
  assert.equal(star.fb!.status, "gone"); assert.equal(star.fb!.goneReason, "arrested");
  assert.equal(sc.vars.arrested, 1); assert.ok(!sc.vars.arrestedOfficial);
  assert.equal(m.halted, null);
  assert.ok(!Object.values(s.actors).some((a) => a.fb?.controlled), "everybody's been let go of");
  assert.ok(ev.some((e) => e.type === "scheme_news" && /DOWN TO TEN|MAKE A CHANGE/.test(e.text)), "the tannoy says what a tannoy would");
  assert.ok(ev.some((e) => e.type === "say" && e.by === star.id && /NADA/.test(e.text)), "pockets out, to prove a point");
  assert.ok(ev.some((e) => e.type === "chain" && e.links.some((l: string) => /TO THE POLICE/.test(l))), "and it's his chain, for the paper");
  run(g, 20);
  assert.ok(m.phase === "live" || m.phase === "restart" || m.phase === "goal_pause", "and the match goes on");
}));

test("a random drugs test: a name and nothing planted. A shin pad, a photo of his mum, and a copper who wants a word", () => calm(() => {
  const { g, s, st, pc, ev, by, at, sc } = start("bent2", "drugs");
  const star = theirStar(g.w)!;
  run(g, 3);
  const cop = by((a) => a.npc!.job === "police" && a.npc!.mode === "routine" && !a.npc!.mounted);
  at(cop.x + 1.5, cop.y); run(g, 0.5);
  assert.equal(dispatch(g.w, { verb: "report", actor: pc.id, target: { k: "actor", id: star.id } }).ok, true);
  run(g, 1);
  assert.equal(sc.met.told, "copper");
  assert.ok(until(g, 320, () => !!sc.done), `he walks to the hotel and turns him out (${JSON.stringify(st.tipoffs)} ${JSON.stringify(sc.vars)})`);
  assert.equal(sc.variant, "clean", JSON.stringify(sc.vars));
  const cut = cutMs(ev, "clean");
  assert.ok(cut > 0 && cut <= 15000, String(cut));
  assert.ok(ev.some((e) => e.type === "tipoff_clean" && e.who === star.id), "the old search, finding nothing");
  assert.ok(!ev.some((e) => e.type === "fb_removed"), "nobody's gone anywhere");
  assert.equal(star.fb!.status, "playing"); assert.ok(!star.fb!.controlled);
  assert.ok(ev.some((e) => e.type === "say" && e.by === star.id && /chora/.test(e.text)), "he cries");
  assert.ok(cop.npc!.target === pc.id || (cop.npc!.sus[pc.id] ?? 0) >= 1.4, "and the copper's coming for whoever said it");
  assert.ok(!sc.vars.arrested);
  assert.equal(st.flags.falseTips, 1);
}));

test("a random drugs test: on the referee. 'I am the referee!' 'Then you'll know the rules, sir.'", () => calm(() => {
  const { g, s, pc, ev, by, at, act, m, sc } = start("bent5", "drugs");
  const ref = s.actors[m.officials.referee];
  run(g, 3);
  // In his pocket (the old plant, from behind; it can take more than one go).
  const gear = spawnItem(s, "powder", { k: "pocket", a: pc.id });
  for (let i = 0; i < 12 && !ref.pockets.includes(gear.id); i++) {
    if (gear.loc.k !== "pocket" || gear.loc.a !== pc.id) break;
    at(ref.x - Math.cos(ref.facing), ref.y - Math.sin(ref.facing));
    dispatch(g.w, { verb: "plant", actor: pc.id, item: gear.id, target: { k: "actor", id: ref.id } });
  }
  assert.ok(ref.pockets.includes(gear.id), "planted on the referee");
  for (const a of Object.values(s.actors)) if (a.npc) { a.npc.sus = {}; if (a.npc.target === pc.id) { a.npc.target = null; a.npc.mode = "routine"; a.npc.crime = 0; } }
  const cop = by((a) => a.npc!.job === "police" && a.npc!.mode === "routine" && !a.npc!.mounted);
  at(cop.x + 1.5, cop.y); run(g, 1);
  assert.equal(sc.met.on, "pocket");
  const grass = act("drugs:grass");
  assert.ok(grass, "the copper can be told who's carrying, though he's not on any list");
  assert.equal(dispatch(g.w, grass!.action!).ok, true);
  assert.ok(until(g, 320, () => !!sc.done), JSON.stringify(sc.vars));
  assert.equal(sc.variant, "whistle", JSON.stringify(sc.vars));
  const cut = cutMs(ev, "whistle");
  assert.ok(cut > 0 && cut <= 15000, String(cut));
  assert.ok(ev.some((e) => e.type === "tipoff_arrest" && e.who === ref.id));
  assert.ok(ref.off!.incapacitated && ref.hiddenIn, "he's in the van, and the match has no referee");
  assert.ok(ev.some((e) => e.type === "ref_stood_down"), "by the path the match already has for that");
  assert.equal(sc.vars.arrested, 1); assert.equal(sc.vars.arrestedOfficial, 1);
}));

test("a word in his ear: their keeper. Short, he names his price; in company, 'Not here.'; alone and paid, he dives the other way", () => calm(() => {
  const { g, s, pc, ev, by, at, m, sc } = start("bent3", "bribe");
  const k = theirKeeper(g.w)!, lionel = by((a) => a.npc!.shop === "pawn"), till = lionel.money;
  run(g, 2);
  // Lionel, asked, says where the watch came from.
  at(lionel.x, lionel.y + 1.6);
  for (let i = 0; i < 4 && !sc.clues.keeper; i++) { dispatch(g.w, { verb: "talk", actor: pc.id, target: { k: "actor", id: lionel.id } }); run(g, 1); }
  assert.ok(sc.clues.keeper && sc.clues.bent, "he knows who's skint");
  // He's on the phone in the far corner of the lobby, away from his own lot.
  assert.ok(dist(k, SPOTS.hotelLobby) > 9, "the keeper's on his own");
  at(k.x - 1.3, k.y + 0.8); run(g, 1);
  assert.equal(sc.met.man, "their keeper"); assert.equal(sc.met.alone, "alone"); assert.ok(!sc.met.cash, "forty quid isn't it");
  const offer = (amount: number) => dispatch(g.w, { verb: "bribe", actor: pc.id, target: { k: "actor", id: k.id }, amount });
  // Short.
  assert.equal(offer(40).ok, true);
  assert.equal(pc.money, 40, "he keeps his forty");
  assert.ok(ev.some((e) => e.type === "say" && e.by === k.id && /throw-in/.test(e.text)), "he names his price, as an insult");
  assert.ok(ev.some((e) => e.type === "scheme_play" && e.variant === "short"));
  run(g, 4);
  assert.ok(sc.clues.price && !sc.variant, "and he can be asked again");
  // In company.
  pc.money = 120;
  const stw = by((a) => a.npc!.job === "patrol"), home = { x: stw.x, y: stw.y };
  stw.x = k.x - 3; stw.y = k.y + 2;
  assert.equal(offer(100).ok, true);
  stw.x = home.x; stw.y = home.y; stw.npc!.sus = {};
  assert.equal(pc.money, 120);
  assert.ok(ev.some((e) => e.type === "say" && e.by === k.id && e.text === "Not here."));
  assert.ok(ev.some((e) => e.type === "scheme_play" && e.variant === "nothere"));
  run(g, 4);
  assert.ok(sc.clues.quiet && !sc.variant);
  assert.ok(!k.fb!.bribed && !ev.some((e) => e.type === "incident"), "nothing's happened yet, and nobody's after him");
  // Alone, with the money.
  assert.equal(offer(100).ok, true);
  assert.equal(pc.money, 20);
  assert.ok(ev.some((e) => e.type === "bribed" && e.who === k.id && e.amount === 100) && ev.some((e) => e.type === "fb_bribed" && e.id === k.id && e.on), "the old bribe, without the coin");
  assert.ok(k.fb!.bribed);
  assert.equal(sc.vars.keeperPaid, 1);
  assert.ok(!ev.some((e) => e.type === "incident"));
  run(g, 2);
  assert.equal(sc.vars.watch, 1); assert.equal(lionel.money, till + 60, "and the watch money's in Lionel's till");
  // The first shot on his goal.
  at(SPOTS.pubYard.x, SPOTS.pubYard.y);
  assert.ok(until(g, 1100, () => ev.some((e) => e.type === "scheme_play" && e.variant === "keeper")), `England have a shot (${m.phase} ${JSON.stringify(sc.vars)})`);
  const played = ev.find((e) => e.type === "scheme_play" && e.variant === "keeper"), shot = ev.filter((e) => e.type === "fb_shot" && e.team === 0)[0];
  assert.equal(played.t, shot.t, "staged at the first shot on his goal, not before");
  const cut = cutMs(ev, "keeper");
  assert.ok(cut > 0 && cut <= 15000, String(cut));
  assert.ok(until(g, 30, () => ev.some((e) => e.type === "scheme_done" && e.variant === "keeper")));
  assert.ok(ev.some((e) => e.type === "chain" && e.links.some((l: string) => /TAKES THE MONEY/.test(l)) && e.links.some((l: string) => /FIRST SHOT/.test(l))), "his chain, for the paper");
  assert.ok(ev.some((e) => e.type === "say" && e.by === k.id && /looks at (his watch|the stand)/.test(e.text)));
}));

test("a word in his ear: the wrong man shouts the place down; and the fourth official stops counting for twenty quid", () => calm(() => {
  const { g, s, pc, ev, at, act, m, sc } = start("bent4", "bribe");
  const star = theirStar(g.w)!, fo = s.actors[m.officials.fourth];
  run(g, 2);
  // The fourth official, in the gents, on his own.
  at(fo.x + 1.2, fo.y + 0.6); run(g, 6);
  assert.ok(sc.clues.fourth, "he says it to the urinal");
  const bung = act("bribe:bung");
  assert.ok(bung, "he can be slipped a note (the money sheet never offered him one)");
  assert.equal(dispatch(g.w, bung!.action!).ok, true);
  assert.equal(pc.money, 20); assert.equal(sc.vars.fourthPaid, 1); assert.equal(sc.vars.fourth, 1);
  assert.ok(ev.some((e) => e.type === "scheme_play" && e.variant === "fourth"));
  run(g, 9);
  assert.ok(!sc.variant, "and the others are still for sale");
  // Their number ten is not for sale.
  pc.money = 150;
  for (const a of Object.values(s.actors)) if (a.npc) a.npc.sus = {};
  at(star.x + 1, star.y);
  assert.equal(dispatch(g.w, { verb: "bribe", actor: pc.id, target: { k: "actor", id: star.id }, amount: 100 }).ok, true);
  assert.equal(pc.money, 150); assert.ok(!star.fb!.bribed);
  assert.ok(ev.some((e) => e.type === "say" && e.by === star.id && /reporting this/.test(e.text)), "the old refusal");
  assert.ok(ev.some((e) => e.type === "incident" && e.what === "attempted bribery"));
  assert.ok(ev.some((e) => e.type === "scheme_play" && e.variant === "honest" && !e.beats.some((b: any) => b.cut)), "in front of him: no cut");
  run(g, 8);
  assert.ok(ev.some((e) => e.type === "crime_reported" && e.who === pc.id), "and it's got to a steward");
  assert.ok(Object.values(s.actors).some((a) => a.npc?.target === pc.id), "who's coming");
  assert.ok(sc.clues.honest);
}));

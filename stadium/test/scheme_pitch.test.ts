// The two schemes that happen on the pitch: Grozz as a referee, and Grozz as a footballer. Headless, in the
// game build (calm), with a short run-up to kick-off so each case is a match in play within a few seconds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moveItem, spawnItem } from "../src/core/items";
import { dispatch } from "../src/core/verbs";
import { HL } from "../src/football/config";
import { dirOf } from "../src/football/util";
import { sendOff } from "../src/football/authority";
import { kill } from "../src/stadium/knife";
import { options } from "../src/stadium/context";
import { theirStar } from "../src/stadium/fixes";
import { createGame, stepGame, type Game } from "../src/stadium/game";
import { areaAt, KICKOFF_AT, setPace, VENUE } from "../src/stadium/layout";
import { matchfx } from "../src/stadium/matchfx";
import { installReferee } from "../src/stadium/scheme_referee";
import { installTwelfth } from "../src/stadium/scheme_twelfth";
import { notebook, schemeState } from "../src/stadium/schemes";

installReferee();
installTwelfth();

const run = (g: Game, seconds: number, each?: () => void) => { for (let i = 0; i < seconds * 60; i++) { each?.(); stepGame(g); } };
const until = (g: Game, seconds: number, done: () => boolean, each?: () => void) => { for (let i = 0; i < seconds * 60 && !done(); i++) { each?.(); stepGame(g); } return done(); };
/** A match in play, with nothing odd going on, and everything that happens from here written down. */
function kickedOff(seed: string) {
  const g = createGame(seed), w = g.w, s = w.state, m = s.match!, st = s.stadium!, pc = s.actors[st.pc], ev: any[] = [];
  assert.ok(until(g, 240, () => m.phase === "live" && m.clock > 3 && !m.halted), "it kicks off");
  w.bus.on((e) => ev.push(e));
  const ref = s.actors[m.officials.referee], fourth = s.actors[m.officials.fourth];
  const stand = (x: number, y: number) => { pc.x = x; pc.y = y; pc.moveX = pc.moveY = 0; };
  const cuts = (id: string) => ev.filter((e) => e.type === "scheme_play" && e.scheme === id).flatMap((e) => e.beats).filter((b: any) => b.cut).reduce((n: number, b: any) => n + b.ms, 0);
  const news = (re: RegExp) => ev.some((e) => e.type === "scheme_news" && re.test(e.text));
  const rule = (arg: string) => { const o = options(w, pc, null).find((q) => q.action?.verb === "rule" && q.action.arg === arg); assert.ok(o, `the black shirt offers "${arg}"`); return dispatch(w, o!.action!).ok; };
  return { g, w, s, m, st, pc, ev, ref, fourth, stand, cuts, news, rule };
}
const calm = async (f: () => void) => { const before = KICKOFF_AT; setPace({ kickoffAt: 120, calm: true }); try { f(); } finally { setPace({ kickoffAt: before, calm: false }); } };
const lines = (ev: any[]) => ev.filter((e) => e.type === "say" || e.type === "scheme_line").map((e) => e.text as string);

test("two referees: the real one's caught short, Grozz referees, he comes back, and the fourth official backs the man with the only whistle", () => calm(() => {
  const { g, w, s, m, st, pc, ev, ref, stand, cuts, news, rule } = kickedOff("ref-crowned"), sc = schemeState(w, "referee")!;
  // The spare kit, and the referee's own whistle off the bench in his room (so he comes back without one).
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  const own = Object.values(s.items).find((i) => i.def === "whistle" && i.label)!;
  moveItem(s, own.id, { k: "pocket", a: pc.id });
  // What his half-time tea does to him, a minute early.
  st.dosed[ref.id] = { effect: "laxative", at: s.tick + 60 };
  assert.ok(until(g, 5, () => ref.off!.incapacitated), "he's caught short");
  stand(0, 8); run(g, 4);
  assert.equal(sc.variant, undefined, "nothing's counted while there's only one referee");
  assert.equal(sc.met.away, "caught short");
  assert.ok(news(/A NEW REFEREE/), "he walks on and is taken for one");
  // The old powers, and they stand: a penalty, and a stoppage on demand.
  assert.equal(rule("penalty"), true);
  assert.ok(ev.some((e) => e.type === "fb_restart" && e.restart === "penalty" && e.team === 0), "England have a penalty");
  run(g, 12);
  assert.equal(rule("stop"), true);
  assert.ok(ev.some((e) => e.type === "fb_halted" && e.reason === "impostor"), "play stops because he says so");
  // The real one comes back on: now there are two.
  assert.ok(until(g, 90, () => !!sc.variant), "it's counted when the real one's back");
  assert.ok(ev.some((e) => e.type === "ref_back"));
  assert.equal(sc.variant, "crowned", JSON.stringify(sc.met));
  assert.equal(sc.met.backed, "whistle");
  run(g, 14);
  assert.ok(lines(ev).includes("He is still doing up his shorts."), lines(ev).slice(-12).join(" | "));
  assert.ok(ev.some((e) => e.type === "fb_halted" && e.reason === "two_refs") && ev.some((e) => e.type === "two_refs"));
  // While they argue a ruling's only a claim.
  const before = ev.filter((e) => e.type === "impostor_ruling").length;
  assert.equal(rule("penalty"), true);
  assert.ok(ev.some((e) => e.type === "impostor_claim" && e.kind === "penalty"));
  assert.equal(ev.filter((e) => e.type === "impostor_ruling").length, before, "nothing's given while they argue");
  assert.ok(until(g, 60, () => !!sc.done, () => stand(0, 8)), "the fourth official says which");
  assert.ok(cuts("referee") > 0 && cuts("referee") <= 15000, `the camera's away ${cuts("referee")} ms`);
  assert.ok(ev.some((e) => e.type === "ref_stood_down"), "the real referee is led off");
  assert.equal(ref.off!.incapacitated, true);
  assert.equal(ev.filter((e) => e.type === "impostor_ruling").length, before + 1, "and what Grozz blew for last is given");
  assert.ok(ev.filter((e) => e.type === "fb_restart" && e.restart === "penalty" && e.team === 0).length >= 2);
  assert.ok(ev.some((e) => e.type === "chain" && e.links.some((l: string) => /LED OFF/.test(l))), "and it's his chain, for the paper");
  assert.ok(notebook(w).some((n) => n.title === "Two referees, one goal" && n.done));
  assert.ok(!ev.some((e) => e.type === "caught"), "nobody lays a hand on him");
}));

test("two referees, nothing arranged: the nearer whistle's obeyed once, then the fourth official backs the real one and Grozz is walked off", () => calm(() => {
  const { g, w, s, pc, ev, stand, cuts, news, rule } = kickedOff("ref-two"), sc = schemeState(w, "referee")!;
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  spawnItem(s, "whistle", { k: "pocket", a: pc.id }); // the pawned spare: the referee's own is still on his bench
  stand(0, 8);
  assert.ok(until(g, 12, () => !!sc.variant, () => stand(0, 8)));
  assert.equal(sc.variant, "two", JSON.stringify(sc.met));
  run(g, 10, () => stand(0, 8));
  assert.equal(rule("penalty"), true);
  assert.equal(ev.filter((e) => e.type === "impostor_ruling" && e.kind === "penalty").length, 1, "the first whistle is obeyed");
  assert.equal(rule("stop"), true);
  assert.ok(ev.some((e) => e.type === "impostor_claim" && e.kind === "stop"), "the second is an argument");
  assert.ok(until(g, 60, () => !!sc.done, () => stand(0, 8)));
  assert.ok(cuts("referee") > 0 && cuts("referee") <= 15000);
  assert.ok(news(/BACKS THE THIN ONE/) && news(/STANDING OVATION/));
  assert.equal(ev.filter((e) => e.type === "impostor_ruling").length, 1, "exactly one of his rulings stood");
  assert.ok(ev.some((e) => e.type === "fb_halted" && e.reason === "two_refs") && ev.some((e) => e.type === "fb_resumed"), "play stopped for it, and went on");
  assert.ok(until(g, 40, () => ev.some((e) => e.type === "caught" && e.who === pc.id)), "and the stewards walk him off");
}));

test("a whistle and no kit: a fat man with a whistle stops play once and is thrown out of the ground", () => calm(() => {
  const { g, w, s, m, pc, ev, stand, cuts } = kickedOff("ref-fatman"), sc = schemeState(w, "referee")!;
  spawnItem(s, "whistle", { k: "pocket", a: pc.id });
  stand(0, 25.6); run(g, 0.1);
  const blow = options(w, pc, null).find((q) => q.action?.verb === "scheme" && q.action.arg === "referee:blow");
  assert.ok(blow, "the whistle offers itself");
  assert.equal(dispatch(w, blow!.action!).ok, true);
  assert.equal(sc.variant, "fatman");
  run(g, 1);
  assert.ok(ev.some((e) => e.type === "fb_halted" && e.reason === "whistle"), "everybody stops");
  assert.ok(until(g, 45, () => ev.some((e) => e.type === "ejected" && e.who === pc.id)), "thrown out");
  assert.ok(until(g, 12, () => !!sc.done));
  assert.ok(ev.some((e) => e.type === "fb_resumed") && !m.halted, "and the match goes on without him");
  assert.equal(cuts("referee"), 0);
  assert.equal(VENUE.inside(pc.x, pc.y), false);
  assert.ok(sc.clues.kit, "and he learns what was missing");
}));

test("the twelfth man: their captain's withdrawn, Grozz is him in their shirt, and puts it in their own net", () => calm(() => {
  const { g, w, s, m, pc, ev, stand, cuts, news } = kickedOff("twelfth-theirs"), sc = schemeState(w, "twelfth")!;
  const star = theirStar(w)!, surname = star.name.split(" ").pop()!.toUpperCase();
  assert.equal(matchfx.withdraw(w, star.id, "unwell"), true); // what the keg does to him
  spawnItem(s, "kit_opp", { k: "worn", a: pc.id, slot: "outer" });
  const dir = dirOf(m, 0), score = m.score[0]; // England attack this way: that's the net a Portugal shirt defends
  let kicked = false;
  assert.ok(until(g, 60, () => ev.some((e) => e.type === "fb_goal" && e.by === pc.id), () => {
    if (kicked) return;
    stand(dir * (HL - 6), 0);
    if (m.phase !== "live" || !pc.fb || m.ball.owner || m.halted) return;
    m.ball.x = pc.x + dir * 0.6; m.ball.y = 0; m.ball.z = 0; m.ball.vx = m.ball.vy = 0;
    for (const a of m.teams[1].squad.map((id) => s.actors[id])) if (a.fb!.role === "GK" && a.fb!.status === "playing") { a.x = dir * (HL - 0.5); a.y = 12; }
    kicked = dispatch(w, { verb: "kick", actor: pc.id, dirX: dir, dirY: 0 }).ok;
  }), "he puts it in");
  assert.equal(sc.variant, "theirs", JSON.stringify(sc.met));
  assert.equal(sc.met.gap, "unwell");
  const goal = ev.find((e) => e.type === "fb_goal" && e.by === pc.id);
  assert.equal(goal.og, true); assert.equal(goal.team, 0); assert.equal(goal.legit, true);
  assert.ok(news(new RegExp(`${surname} RETURNS FROM SICKBED, SCORES AT THE WRONG END`)), JSON.stringify(ev.filter((e) => e.type === "scheme_news")));
  assert.ok(lines(ev).includes("That's OUR net! You're on OUR side!"));
  assert.ok(cuts("twelfth") > 0 && cuts("twelfth") <= 15000);
  assert.ok(until(g, 30, () => ev.some((e) => e.type === "caught" && e.who === pc.id)), "then somebody looks at his face");
  run(g, 20);
  assert.equal(m.score[0], score + 1, "and the own goal stands");
  assert.ok(!ev.some((e) => e.type === "twelfth_man"), "nobody ever counted twelve");
  assert.ok(ev.some((e) => e.type === "chain" && e.links.some((l: string) => /NET HIS SHIRT DEFENDS/.test(l))));
}));

test("the twelfth man, nothing arranged: counted at the next restart, led off, and in an England shirt it's England who pay", () => calm(() => {
  const { g, w, s, m, pc, ev, stand, cuts, news } = kickedOff("twelfth-counted"), sc = schemeState(w, "twelfth")!;
  spawnItem(s, "kit_eng", { k: "worn", a: pc.id, slot: "outer" });
  const dir = dirOf(m, 0);
  stand(-dir * (HL - 6), 4); // stood in England's own box
  assert.ok(until(g, 5, () => !!sc.variant, () => stand(-dir * (HL - 6), 4)));
  assert.equal(sc.variant, "counted", JSON.stringify(sc.met));
  assert.ok(until(g, 90, () => ev.some((e) => e.type === "twelfth_man"), () => stand(-dir * (HL - 6), 4)), "counted at a restart");
  const at = ev.findIndex((e) => e.type === "twelfth_man");
  assert.ok(ev.slice(at).some((e) => e.type === "fb_restart" && e.restart === "penalty" && e.team === 1), "a penalty against England");
  assert.ok(ev.some((e) => e.type === "fb_halted" && e.reason === "twelfth"));
  assert.ok(news(/TWELVE MEN. PENALTY AGAINST ENGLAND/));
  assert.ok(until(g, 40, () => ev.some((e) => e.type === "caught" && e.who === pc.id)), "and he's led off");
  run(g, 2);
  assert.ok(ev.some((e) => e.type === "fb_resumed") && !m.halted, "the match goes on");
  assert.ok(cuts("twelfth") > 0 && cuts("twelfth") <= 15000);
  assert.ok(sc.clues.count, "and he learns who was counting");
}));

/** Grozz, by a goal, with the ball at his feet and the keeper out of the way: the kick is his own. */
function shoot(k: ReturnType<typeof kickedOff>, sign: number): boolean {
  const { g, w, s, m, pc, ev, stand } = k;
  let kicked = false;
  return until(g, 60, () => ev.some((e) => e.type === "fb_goal" && e.by === pc.id), () => {
    if (kicked) return;
    stand(sign * (HL - 6), 0);
    if (m.phase !== "live" || !pc.fb || m.ball.owner || m.halted) return;
    m.ball.x = pc.x + sign * 0.6; m.ball.y = 0; m.ball.z = 0; m.ball.vx = m.ball.vy = 0;
    for (const t of m.teams) for (const a of t.squad.map((id) => s.actors[id])) if (a.fb!.role === "GK" && a.fb!.status === "playing" && a.x * sign > 0) { a.x = sign * (HL - 0.5); a.y = 12; }
    kicked = dispatch(w, { verb: "kick", actor: pc.id, dirX: sign, dirY: 0 }).ok;
  });
}

test("the twelfth man: an England man's sent off, Grozz takes the shirt, and the goal he scores stands", () => calm(() => {
  const k = kickedOff("twelfth-eleven"), { g, w, s, m, pc, ev, news } = k, sc = schemeState(w, "twelfth")!;
  const off = m.teams[0].squad.map((id) => s.actors[id]).find((a) => a.fb!.status === "playing" && a.fb!.role === "DEF")!;
  sendOff(w, m, off, "sent_off"); // what a red card does
  spawnItem(s, "kit_eng", { k: "worn", a: pc.id, slot: "outer" });
  const score = m.score[0];
  assert.ok(shoot(k, dirOf(m, 0)), "he scores");
  assert.equal(sc.variant, "eleven", JSON.stringify(sc.met));
  const goal = ev.find((e) => e.type === "fb_goal" && e.by === pc.id);
  assert.equal(goal.og, false); assert.equal(goal.team, 0);
  assert.ok(news(/RETURNS FROM HIS RED CARD AND SCORES. IT STANDS/), JSON.stringify(ev.filter((e) => e.type === "scheme_news")));
  run(g, 70);
  assert.ok(lines(ev).includes("That's never him. Say nothing. He's ours."));
  assert.equal(m.score[0] >= score + 1, true, "nobody takes it back");
  assert.ok(!ev.some((e) => e.type === "twelfth_man"));
}));

test("the twelfth man with the cameras on the fourth official: about forty seconds before the count catches up, and no penalty", () => calm(() => {
  const { g, w, s, pc, ev, stand, cuts } = kickedOff("twelfth-twelve"), sc = schemeState(w, "twelfth")!;
  // Arranged through the other scheme: tell the reporter to film the referee, and she sets up pitchside.
  const rep = Object.values(s.actors).find((a) => a.name === "Reporter")!;
  stand(rep.x + 1.2, rep.y);
  assert.equal(dispatch(w, { verb: "scheme", actor: pc.id, arg: "referee:film" }).ok, true);
  assert.ok(until(g, 60, () => areaAt(rep.x, rep.y).pitch === true), `she gets pitchside (${rep.x.toFixed(0)},${rep.y.toFixed(0)})`);
  run(g, 20);
  assert.equal(areaAt(rep.x, rep.y).pitch, true, "and stays there");
  spawnItem(s, "kit_eng", { k: "worn", a: pc.id, slot: "outer" });
  const here = () => stand(0, 10);
  assert.ok(until(g, 10, () => !!sc.variant, here));
  assert.equal(sc.variant, "twelve", JSON.stringify(sc.met));
  assert.equal(sc.met.blind, "on camera");
  const t0 = s.tick;
  run(g, 25, here);
  assert.ok(!ev.some((e) => e.type === "twelfth_man") && !!pc.fb, "still on after twenty-five seconds");
  rep.x = 60; rep.y = 60; rep.npc!.plan = [{ k: "wait", s: 600 }]; // the cameras go
  for (const a of Object.values(s.actors)) if (a.name === "Cameraman") { a.x = 60; a.y = 62; a.npc!.plan = [{ k: "wait", s: 600 }]; }
  assert.ok(until(g, 90, () => ev.some((e) => e.type === "twelfth_man"), here), "and then he's counted");
  assert.ok((s.tick - t0) / 60 < 75);
  assert.ok(!ev.some((e) => e.type === "fb_restart" && e.restart === "penalty"), "nobody's penalised for it");
  assert.ok(cuts("twelfth") <= 15000);
}));

test("the referee's nicked: the tannoy asks, and Grozz in the kit is the referee, no questions", () => calm(() => {
  const { g, w, s, pc, ev, ref, stand, cuts, news, rule } = kickedOff("ref-invited"), sc = schemeState(w, "referee")!;
  w.bus.emit({ type: "tipoff_arrest", t: s.tick, who: ref.id, item: "powder", planted: true }); // what the police say when they find it on him
  assert.ok(news(/IS THERE A QUALIFIED REFEREE/));
  assert.equal(ref.off!.incapacitated, true);
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  spawnItem(s, "whistle", { k: "pocket", a: pc.id });
  assert.ok(until(g, 10, () => !!sc.done, () => stand(0, 8)));
  assert.equal(sc.variant, "invited", JSON.stringify(sc.met));
  assert.ok(cuts("referee") > 0 && cuts("referee") <= 15000);
  for (const kind of ["stop", "penalty", "stop", "penalty"]) { run(g, 8, () => stand(0, 8)); assert.equal(rule(kind), true); }
  assert.equal(ev.filter((e) => e.type === "impostor_ruling").length, 4, "every one of them stands");
  run(g, 10, () => stand(0, 8));
  assert.ok(!ev.some((e) => e.type === "caught" || e.type === "spotted"), "and nobody comes for him");
}));

test("the referee's dead and Grozz is wearing him: nobody asks, until the fourth official looks too closely", () => calm(() => {
  const { g, w, s, pc, ev, ref, fourth, stand, rule } = kickedOff("ref-him"), sc = schemeState(w, "referee")!;
  // Done where he gets changed alone, so nobody sees it: killed, and his face taken the way the knife takes one.
  ref.x = 0; ref.y = -54;
  kill(w, ref);
  const face = spawnItem(s, "face", { k: "worn", a: pc.id, slot: "face" });
  face.of = ref.faceId; face.label = `${ref.name}'s face`;
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  const far = () => stand(fourth.x + 20, 12);
  assert.ok(until(g, 14, () => !!sc.done, far), JSON.stringify([sc.variant, sc.met, s.stadium!.ending]));
  assert.equal(sc.variant, "him", JSON.stringify(sc.met));
  assert.ok(lines(ev).includes("You all right, ref? You look tired."));
  assert.equal(rule("penalty"), true);
  assert.ok(ev.some((e) => e.type === "impostor_ruling" && e.kind === "penalty"), "his word's the referee's");
  stand(fourth.x + 1.5, fourth.y); run(g, 1, () => stand(fourth.x + 1.5, fourth.y));
  assert.equal(sc.vars.slip, 1);
  assert.ok(lines(ev).includes("That's his face. That's not his head."));
}));

test("the kit and no whistle: nobody obeys a man who shouts peep", () => calm(() => {
  const { g, w, s, pc, ev, stand, rule, news } = kickedOff("ref-peep"), sc = schemeState(w, "referee")!;
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  assert.ok(until(g, 5, () => !!sc.variant, () => stand(0, 8)));
  assert.equal(sc.variant, "peep");
  run(g, 3, () => stand(0, 8));
  assert.equal(rule("penalty"), true);
  assert.ok(!ev.some((e) => e.type === "impostor_ruling"), "nothing's given");
  assert.ok(until(g, 40, () => ev.some((e) => e.type === "caught" && e.who === pc.id), () => stand(0, 8)), "and the stewards come");
  until(g, 12, () => !!sc.done);
  assert.ok(news(/NO WHISTLE, NO REFEREE/) && sc.clues.whistle);
}));

test("coke in the referee's tea: he stays on, off his face, and the fourth official would rather have the fat one", () => calm(() => {
  const { g, w, s, st, pc, ev, ref, stand, cuts, news } = kickedOff("ref-wired"), sc = schemeState(w, "referee")!;
  st.dosed[ref.id] = { effect: "wired", at: s.tick + 30 }; // what powder in the urn does to him
  assert.ok(until(g, 3, () => ref.off!.strictness >= 1));
  spawnItem(s, "ref_kit", { k: "worn", a: pc.id, slot: "outer" });
  spawnItem(s, "whistle", { k: "pocket", a: pc.id });
  assert.ok(until(g, 5, () => !!sc.variant, () => stand(0, 8)));
  assert.equal(sc.variant, "crowned", JSON.stringify(sc.met));
  assert.equal(sc.met.backed, "wired");
  assert.ok(until(g, 60, () => !!sc.done, () => stand(0, 8)));
  assert.ok(lines(ev).includes("Please. We will take the fat one.") && lines(ev).includes("The fat one. The other's eating his whistle."));
  assert.ok(ev.some((e) => e.type === "ref_stood_down") && news(/BACKS THE FAT ONE/));
  assert.ok(cuts("referee") <= 15000);
}));

// The one-tap interferences (pranks.ts): bins, signs, a tyre, fuse boxes, the tannoy and the rest. Headless, in
// the game build (calm). For every one of them: it's offered at the thing with a line saying what it will do;
// doing it shows at once and sets somebody else going through the shared rules, credited to Grozz; it can't be
// done again until it's over, and it is over, by itself, inside a minute and a half; and nothing it starts
// fires so often that the game would stutter, and nobody says the same thing over and over. Then the ones
// that touch the football, getting seen at it, and that the same day played twice is the same day.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Actor } from "../src/core/types";
import { dispatch } from "../src/core/verbs";
import { causeById, treeOf } from "../src/stadium/cause";
import { options } from "../src/stadium/context";
import { hasState } from "../src/stadium/fstates";
import { createGame, stepGame, type Game } from "../src/stadium/game";
import { areaAt, setPace, VENUE } from "../src/stadium/layout";
import { whatItDoes } from "../src/stadium/outcomes";
import { PRANK_IDS, SAY } from "../src/stadium/pranks";
import { RIGS } from "../src/stadium/rigs";

const calm = (f: () => void) => { setPace({ kickoffAt: 540, calm: true }); try { f(); } finally { setPace({ kickoffAt: 330, calm: false }); } };
const run = (g: Game, seconds: number) => { for (let i = 0; i < seconds * 60; i++) stepGame(g); };
const until = (g: Game, seconds: number, done: () => boolean) => { for (let i = 0; i < seconds * 60 && !done(); i++) stepGame(g); return done(); };
/** The rules everybody obeys (machine.ts and its neighbours): a knock-on has to come through one of these. */
const SHARED = new Set(["custody", "obligation", "attraction", "attention", "access", "belief", "need"]);
/** Every line anybody says about one of these. */
const LINES = new Set(Object.values(SAY).flat());
/** More of any one thing than this in a second is a loop, not a consequence. */
const SANE_PER_SECOND = 10;

/** Put Grozz where he'd stand to do it: at the thing, or for the ones on the pitch side of the wall, in the front row behind it. */
function standAt(g: Game, id: string): { at: { x: number; y: number }; pc: Actor } {
  const w = g.w, s = w.state, st = s.stadium!, pc = s.actors[st.pc], def = RIGS[id];
  def.on?.(w); // (the horse's whereabouts are kept as he moves)
  const at = def.at();
  let x = at.x, y = at.y;
  if (areaAt(x, y).pitch) { if (Math.abs(y) > 20) y = Math.sign(y) * 28.4; else x = Math.sign(x) * 41.4; }
  if (id === "horse") x += 1.3;
  assert.ok(!areaAt(x, y).pitch, `${id}: he can stand at it without being on the pitch side`);
  assert.ok(Math.hypot(x - at.x, y - at.y) < def.r, `${id}: where he stands is within reach`);
  if (VENUE.inside(x, y)) st.admitted = true;
  pc.x = x; pc.y = y; pc.moveX = pc.moveY = 0; pc.vx = pc.vy = 0; pc.seated = false; pc.heldBy = undefined;
  return { at, pc };
}
const offer = (g: Game, id: string) => { const w = g.w, pc = w.state.actors[w.state.stadium!.pc]; return options(w, pc, null).find((o) => o.action?.verb === "rig" && o.action.arg === id); };
/** Everything that happens from here, and how many of each sort in each second. */
function listen(g: Game) {
  const ev: any[] = [], per: Record<string, Record<number, number>> = {};
  g.w.bus.on((e: any) => { ev.push(e); const sec = Math.floor(g.w.state.tick / 60); (per[e.type] ??= {})[sec] = (per[e.type][sec] ?? 0) + 1; });
  const worst = () => Object.entries(per).map(([type, m]) => ({ type, n: Math.max(...Object.values(m)) })).sort((a, b) => b.n - a.n)[0];
  return { ev, worst };
}

test("every one is offered at the thing, on the big button, with a short line saying what it will do", () => calm(() => {
  const g = createGame("pranks-offered"), w = g.w, s = w.state, pc = s.actors[s.stadium!.pc];
  run(g, 4);
  assert.ok(PRANK_IDS.length >= 20, `at least fifteen of them (and then some): ${PRANK_IDS.length}`);
  for (const id of PRANK_IDS) {
    const { at } = standAt(g, id);
    stepGame(g);
    const opts = options(w, pc, null), o = opts.find((q) => q.action?.verb === "rig" && q.action.arg === id);
    assert.ok(o, `${id}: offered where it is`);
    assert.equal(opts[0], o, `${id}: it's the one on the big button (not "${opts[0]?.label}")`);
    assert.ok(o!.label.length > 3 && o!.label.length <= 30, `${id}: a label that fits the button: "${o!.label}"`);
    const line = whatItDoes(w, pc, o!);
    assert.ok(line.length > 10, `${id}: says what it does`);
    assert.ok(line.length <= 72, `${id}: in under 72 characters (${line.length}): "${line}"`);
    assert.ok(!/[—–]/.test(line + o!.label), `${id}: no dashes`);
    // Six metres off, it isn't on offer at all.
    pc.x = at.x + 6; pc.y = at.y + 6;
    assert.equal(offer(g, id), undefined, `${id}: not from across the road`);
  }
}));

for (const id of PRANK_IDS) {
  test(`${id}: shows at once, sets somebody going (credited to Grozz), can't be repeated, ends by itself, and nothing loops`, () => calm(() => {
    const g = createGame(`prank-${id}`), w = g.w, s = w.state, st = s.stadium!;
    run(g, 6);
    const { pc } = standAt(g, id);
    stepGame(g);
    const { ev, worst } = listen(g), t0 = s.tick;
    const o = offer(g, id);
    assert.ok(o, "offered");
    assert.equal(dispatch(w, o!.action!).ok, true, "he does it");
    const r = st.rigs![id];
    assert.ok(r.ready - t0 >= 60 * 40, "not for another forty seconds at the least");
    // Hammering the button does nothing: it isn't offered, and it won't go.
    for (let i = 0; i < 120; i++) {
      stepGame(g);
      if (i % 10 === 0) { assert.equal(offer(g, id), undefined, "not offered again while it's going"); assert.equal(dispatch(w, { verb: "rig", actor: pc.id, arg: id } as any).ok, false, "and it won't go again"); }
    }
    assert.equal(ev.filter((e) => e.type === "rigged" && e.rig === id).length, 1, "done once");
    // On screen inside two seconds: the event the picture and the noise hang off, and the thing in its changed state.
    assert.ok(ev.some((e) => e.type === "rig" && e.rig === id && e.t - t0 <= 120), "something to see and hear straight away");
    run(g, 1);
    assert.ok(r.step !== 0, "and it's still in the state he left it");
    // The knock-on: a tree rooted in what Grozz did, with a link made by one of the shared rules, and somebody off doing something about it.
    run(g, 57);
    const root = causeById(w, r.cause)?.root ?? 0, tree = treeOf(w, root), ids = new Set(tree.map((c) => c.id));
    assert.ok(tree.length >= 3, `a chain of at least three: ${tree.map((c) => c.label).join(" > ")}`);
    assert.match(tree[0].label, /^GROZZ /, "that starts with him");
    assert.equal(tree[0].rule, "act");
    assert.ok(tree.some((c) => SHARED.has(c.rule)), `through a shared rule: ${tree.map((c) => `${c.label} [${c.rule}]`).join(" > ")}`);
    assert.ok(ev.some((e) => e.type === "chain" && e.root === root && e.by === pc.id), "the strap is told it was him");
    assert.ok(ev.some((e) => ["post_left", "drawn", "fixed", "urge"].includes(e.type) && ids.has(e.cause)) || tree.some((c) => c.who && c.rule !== "act" && SHARED.has(c.rule)), "and somebody really did go and do something because of it");
    // It ends by itself, with nothing of it left over.
    run(g, 30);
    assert.equal(r.step, 0, "it's over inside a minute and a half");
    assert.equal((st.problems ?? []).filter((p) => p.key === id).length, 0, "and nobody's still seeing to it");
    assert.ok(!s.match?.halted, "and the football isn't waiting on it");
    assert.ok(ev.filter((e) => e.type === "rig" && e.rig === id).length <= 12, "a handful of cues for the picture, not a stream");
    // What's said about it is rationed: a line every ten seconds at the most, and never the same one twice running.
    const said = ev.filter((e) => e.type === "say" && LINES.has(e.text));
    for (let i = 1; i < said.length; i++) {
      assert.ok(said[i].t - said[i - 1].t >= 600, `ten seconds between lines: "${said[i - 1].text}" then "${said[i].text}" after ${((said[i].t - said[i - 1].t) / 60).toFixed(1)}s`);
      assert.notEqual(said[i].text, said[i - 1].text, "not the same line twice running");
    }
    const most = worst();
    assert.ok(most.n <= SANE_PER_SECOND, `nothing fires more than ${SANE_PER_SECOND} times in a second (${most.type}: ${most.n})`);
  }));
}

test("the ones that touch the football: play stops and starts again by itself, and the states are written, not scripted", () => calm(() => {
  const g = createGame("pranks-football"), w = g.w, s = w.state, st = s.stadium!, m = s.match!, pc = s.actors[st.pc];
  assert.ok(until(g, 760, () => m.phase === "live" && m.clock > 4 && !m.halted), "it kicks off");
  const { ev, worst } = listen(g);
  const live = () => until(g, 60, () => (m.phase === "live" || m.phase === "restart") && !m.halted);
  const go = (id: string) => {
    // (Whoever saw the last one has had his word with Grozz by now; this is about the football.)
    st.wanted = []; st.warnings = 0; for (const a of Object.values(s.actors)) if (a.npc) a.npc.sus = {};
    assert.ok(live(), `${id}: play is going`);
    standAt(g, id); stepGame(g);
    const o = offer(g, id);
    assert.ok(o, `${id}: offered during the match`);
    const line = whatItDoes(w, pc, o!);
    assert.ok(line.length <= 72, `${id}: the line in play still fits (${line.length})`);
    const n = ev.length;
    assert.equal(dispatch(w, o!.action!).ok, true);
    return { line, since: () => ev.slice(n) };
  };
  const score = () => m.score.join("-");

  // Sprinklers: stopped, the side defending that end soaked (whichever side that is this half), back on once the valve's shut.
  {
    const before = score(), { line, since } = go("sprinklers");
    assert.match(line, /^Play stops\. (England's|Their) end gets soaked/);
    run(g, 1);
    assert.equal(m.halted, "sprinklers");
    const end = Math.sign(RIGS.sprinklers.at().x);
    const keepers = Object.values(s.actors).filter((a) => a.fb?.role === "GK" && a.fb.slot === 0);
    const wet = keepers.sort((a, b) => Math.abs(a.x - end * 36) - Math.abs(b.x - end * 36))[0].fb!.team;
    assert.ok(hasState(w, "lethargic", wet), "the side whose goal is at that end are the soaked ones");
    assert.ok(!hasState(w, "lethargic", wet === 0 ? 1 : 0), "and only them");
    assert.equal(/England's/.test(line), wet === 0, "and the line said whose end it was");
    assert.ok(until(g, 30, () => !m.halted), "play restarts by itself");
    const e = since();
    assert.ok(e.some((x) => x.type === "fixed" && x.key === "sprinklers"), "because a steward shut the valve");
    assert.ok(e.some((x) => x.type === "post_left"), "having left the touchline to do it");
    assert.equal(score(), before, "nobody scored while it was stopped");
    assert.ok(until(g, 60, () => !hasState(w, "lethargic")), "and they dry off");
  }
  // A second ball: stopped, and the referee's eye is off the game.
  {
    const { line, since } = go("ball");
    assert.match(line, /Play stops/);
    assert.ok(until(g, 3, () => m.halted === "two_balls"), "play stops when it lands");
    assert.ok(s.actors[m.officials.referee].off!.distractedUntil > s.tick, "the referee's looking at the wrong ball");
    assert.ok(until(g, 30, () => !m.halted), "and it restarts once it's been fetched");
    assert.ok(since().some((x) => x.type === "fixed" && x.key === "ball"));
  }
  // The floodlight fuse: dark, and it stays stopped till somebody has been to the box.
  {
    const { line, since } = go("lights");
    assert.match(line, /^Play stops in the dark/);
    run(g, 1);
    assert.equal(m.halted, "floodlights");
    assert.ok(until(g, 45, () => !m.halted), "the lights come back");
    const e = since(), fixed = e.find((x) => x.type === "fixed" && x.key === "lights"), back = e.find((x) => x.type === "fb_resumed");
    assert.ok(fixed, "a steward walked to the box");
    assert.ok(back.t >= fixed.t, "and not before he got there");
  }
  // The stretcher: stopped for nobody, and on again.
  {
    const { since } = go("medics");
    run(g, 1);
    assert.equal(m.halted, "medics");
    assert.ok(Object.values(s.actors).filter((a) => a.name.startsWith("First-aider")).length === 2, "two of them on the pitch");
    assert.ok(until(g, 20, () => !m.halted), "and off again");
    assert.ok(until(g, 30, () => !Object.values(s.actors).some((a) => a.name.startsWith("First-aider"))), "back down the tunnel");
    assert.ok(since().some((x) => x.type === "fb_resumed"));
  }
  // Their tactics board: play carries on, and they're lost for a bit.
  {
    const { line, since } = go("dugout");
    assert.match(line, /^Their eleven/);
    assert.ok(until(g, 4, () => hasState(w, "confused", 1)), "the visitors are written down as lost");
    assert.ok(!hasState(w, "confused", 0), "England aren't");
    assert.ok(!m.halted, "and nothing stops for it");
    assert.ok(since().some((x) => x.type === "fstate" && x.id === "confused" && x.on), "the scoreboard's told");
    assert.ok(until(g, 60, () => !hasState(w, "confused", 1)), "it wears off");
  }
  const most = worst();
  assert.ok(most.n <= 14, `nothing looped during the match either (${most.type}: ${most.n})`);
}));

test("seen at it by a steward it's a minor offence: clocked, then a word, never the cells; unseen, it's nothing", () => calm(() => {
  // Unseen: the skip's down an alley with nobody in it.
  {
    const g = createGame("pranks-unseen"), w = g.w, s = w.state;
    run(g, 5);
    standAt(g, "skip"); stepGame(g);
    for (const a of Object.values(s.actors)) if (a.npc && Math.hypot(a.x + 65.5, a.y + 18) < 30) { a.x = 0; a.y = 70; }
    const { ev } = listen(g);
    assert.equal(dispatch(w, offer(g, "skip")!.action!).ok, true);
    run(g, 20);
    const inc = ev.find((e) => e.type === "incident");
    assert.ok(inc && inc.severity === 1, "it's on the day's list as something minor");
    assert.equal(inc.seen, 0, "but nobody saw");
    assert.ok(!ev.some((e) => e.type === "caught"), "so nobody comes");
  }
  // Seen: a steward stood six metres off, looking straight at him.
  {
    const g = createGame("pranks-seen"), w = g.w, s = w.state, st = s.stadium!;
    run(g, 5);
    const { at, pc } = standAt(g, "bin_e");
    const alan = Object.values(s.actors).find((a) => a.npc?.job === "patrol")!;
    alan.x = at.x - 5; alan.y = at.y + 3; alan.facing = Math.atan2(pc.y - alan.y, pc.x - alan.x); alan.npc!.plan = [{ k: "wait", s: 60 }]; alan.npc!.goal = null;
    const { ev } = listen(g);
    assert.equal(dispatch(w, offer(g, "bin_e")!.action!).ok, true);
    const inc = ev.find((e) => e.type === "incident");
    assert.ok(inc.severity === 1 && inc.seen >= 1, "seen, and minor");
    assert.ok(ev.some((e) => e.type === "say" && e.by === alan.id && /I saw that/.test(e.text)), "he says he saw");
    assert.ok(alan.npc!.mode !== "routine", "and he's watching now");
    run(g, 30);
    const caught = ev.filter((e) => e.type === "caught");
    assert.ok(caught.every((e) => e.intent === "warn"), `the worst of it is a talking-to: ${caught.map((e) => e.intent).join(", ")}`);
    assert.ok(!st.custody && !st.ending, "not the cells, and not the end of his day");
    assert.ok(st.rigs!.bin_e.step !== 0 || ev.some((e) => e.type === "fixed" && e.key === "bin_e"), "and the bin's still over (till Lionel's swept up)");
  }
}));

test("the same day twice is the same day", () => calm(() => {
  const day = () => {
    const g = createGame("pranks-twice"), w = g.w, s = w.state, st = s.stadium!;
    run(g, 5);
    for (const id of ["bin_w", "sign_e", "tannoy", "sprinklers", "sinks"]) { standAt(g, id); stepGame(g); assert.equal(dispatch(w, offer(g, id)!.action!).ok, true, id); run(g, 7); }
    run(g, 25);
    return JSON.stringify({
      who: Object.values(s.actors).map((a) => [a.id, Math.round(a.x * 1000), Math.round(a.y * 1000)]),
      causes: (st.causes ?? []).map((c) => [c.id, c.parent, c.label, c.t]),
      rigs: st.rigs, rng: s.rng,
    });
  };
  assert.equal(day(), day());
}));

test("the words: every headline is Grozz's, and there isn't an em dash in the file", () => {
  const src = readFileSync(new URL("../src/stadium/pranks.ts", import.meta.url), "utf8");
  assert.ok(!src.includes("—"), "no em dashes in what the player reads");
  for (const id of PRANK_IDS) {
    assert.match(RIGS[id].first ?? "", /^GROZZ [A-Z]/, `${id}: a headline that says who did it`);
    assert.ok(RIGS[id].does, `${id}: has its line`);
  }
  for (const [k, pool] of Object.entries(SAY)) {
    assert.ok(new Set(pool).size >= 4, `${k}: four ways of saying it at the least`);
    assert.ok(src.includes(`SAY.${k}`), `${k}: and somebody says it`);
  }
});

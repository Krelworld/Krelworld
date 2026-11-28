// The Visitors' Special: the first mission, and the hydration plant it runs on (src/stadium/scheme_special.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnItem } from "../src/core/items";
import type { Actor } from "../src/core/types";
import { dispatch } from "../src/core/verbs";
import { createGame, stepGame, type Game } from "../src/stadium/game";
import { arrivalSpot, PLANT, setPace, SOLID, VENUE } from "../src/stadium/layout";
import { options, type Option } from "../src/stadium/context";
import { hasState } from "../src/stadium/fstates";
import { cards, pinned } from "../src/stadium/missions";
import { findPath } from "../src/stadium/nav";
import { whatItDoes } from "../src/stadium/outcomes";
import { schemeState, schemeThings } from "../src/stadium/schemes";
import { plantSpots, plantView, plantWatched, SERVE_SECS, TOKENS } from "../src/stadium/scheme_special";

const run = (g: Game, seconds: number, each?: () => void) => { for (let i = 0; i < seconds * 60; i++) { each?.(); stepGame(g); } };
const events = (g: Game) => { const out: any[] = []; g.w.bus.on((e) => out.push(e)); return out; };
/** The game as the build runs it: nine minutes to kick-off, the calm street. */
const calm = <T>(f: () => T, soft = false): T => { setPace({ kickoffAt: 540, calm: true, soft }); try { return f(); } finally { setPace({ kickoffAt: 330, calm: false }); } };
const main = (g: Game, pc: Actor): Option | undefined => options(g.w, pc, null).filter((o) => o.priority > 0).sort((a, b) => b.priority - a.priority)[0];
const opt = (g: Game, pc: Actor, re: RegExp) => options(g.w, pc, null).find((o) => re.test(o.label));

/** A game with Grozz stood at the plant and the drayman out of the way (sat in his cab), the pipes already looked at. */
function atPlant(seed: string, o: { looked?: boolean; dray?: "gone" | "here" } = {}) {
  const g = createGame(seed), w = g.w, s = w.state, st = s.stadium!, pc = s.actors[st.pc], ev = events(g), sp = plantSpots();
  const dray = Object.values(s.actors).find((a) => a.npc?.job === "worker")!, lorry = st.vehicles.lorry;
  run(g, 1);
  if ((o.dray ?? "gone") === "gone") { dray.hiddenIn = lorry.cargo; lorry.until = s.tick + 60 * 3600; }
  const sc = schemeState(w, "special")!;
  const stand = (p: "home" | "away" | "front") => { const q = p === "home" ? sp.atHome : p === "away" ? sp.atAway : sp.front; pc.x = q.x; pc.y = q.y; pc.moveX = pc.moveY = 0; };
  const give = (def: string) => { if (pc.hand) { delete s.items[pc.hand]; pc.hand = null; } return spawnItem(s, def, { k: "hand", a: pc.id }); };
  const press = (re: RegExp) => { const q = opt(g, pc, re); assert.ok(q?.action, `no option matching ${re} (there are: ${options(w, pc, null).map((x) => x.label).join(" | ")})`); return dispatch(w, q!.action!); };
  stand("front");
  if (o.looked ?? true) { assert.equal(press(/^Look at the pipes$/).ok, true); assert.ok(sc.clues.pipes); }
  return { g, w, s, st, pc, ev, sp, sc, dray, stand, give, press };
}

/** Somebody who does only what the pinned step says: walks at where it points, and presses the big button when
 *  the big button says what the step says. Returns what he pressed and when the mission finished. */
function follow(g: Game, maxSecs: number) {
  const w = g.w, s = w.state, st = s.stadium!, pc = s.actors[st.pc];
  const WANT = [null, /^Roll the keg$/, /^Look at the pipes$/, /^Take a Rocket Tonic$/, /^Put in VISITORS pipe$/, null];
  const pressed: { n: number; label: string; hint: string; t: number; ok: boolean }[] = [], steps: string[] = [];
  let wait = 0;
  for (let i = 0; i < maxSecs * 60 && !st.missions!.done.special; i++) {
    const pin = pinned(w);
    pc.moveX = pc.moveY = 0;
    if (pin && pin.id === "special") {
      if (steps[steps.length - 1] !== pin.text) steps.push(pin.text);
      const m = main(g, pc), want = WANT[pin.n];
      if (wait > 0) wait--;
      else if (m?.action && want?.test(m.label)) {
        // (A second's thought before each press, and four to watch what the keg does.)
        pressed.push({ n: pin.n, label: m.label, hint: whatItDoes(w, pc, m), t: s.tick / 60, ok: dispatch(w, m.action).ok });
        wait = pin.n === 1 ? 240 : 60;
      } else if (pin.where) {
        const dx = pin.where.x - pc.x, dy = pin.where.y - pc.y, d = Math.hypot(dx, dy);
        // (An amble, not a run: under the 0.9 that makes him sprint.)
        if (d > 0.3) { pc.moveX = (dx / d) * 0.5; pc.moveY = (dy / d) * 0.5; }
      }
    }
    stepGame(g);
  }
  return { pressed, steps, doneAt: (st.missions!.done.special ?? 0) / 60 };
}

test("the Visitors' Special: following only the steps and the big button, Portugal's drinks are served inside three minutes", () => calm(() => {
  const g = createGame("special-1"), w = g.w, s = w.state, st = s.stadium!, ev = events(g), sc = schemeState(w, "special")!;
  run(g, 0.5);
  const first = pinned(w)!;
  assert.equal(first.id, "special", "it's the plan a new player is given");
  assert.equal(first.text, "See what that idiot with the kegs is doing");
  assert.match(cards(w).find((c) => c.id === "special")!.goal, /Portugal's drinks/);
  assert.ok(!cards(w).some((c) => c.id === "home"), "Home Advantage isn't dealt yet");
  const r = follow(g, 240);
  assert.deepEqual(r.steps, ["See what that idiot with the kegs is doing", "Roll the loose keg", "While he's gone, look at the pipes", "Take a Rocket Tonic, or find something worse", "Put it in the VISITORS pipe", "Watch what it does to them"]);
  assert.deepEqual(r.pressed.filter((p) => p.ok).map((p) => p.label).filter((l, i, a) => a.indexOf(l) === i), ["Roll the keg", "Look at the pipes", "Take a Rocket Tonic", "Put in VISITORS pipe"]);
  assert.ok(r.doneAt > 0 && r.doneAt < 180, `finished at ${r.doneAt.toFixed(1)}s`);
  // Every press said what it would do first, briefly.
  for (const p of r.pressed) { assert.ok(p.hint.length > 8 && p.hint.length <= 72, `"${p.label}": "${p.hint}"`); assert.ok(!/—/.test(p.hint + p.label)); }
  assert.equal(r.pressed.find((p) => p.n === 4)!.hint, "Portugal drink the Rocket Tonic. Wired till half-time. Wired men foul.");
  // What he was told in plain English, and what he made of it.
  assert.ok(ev.some((e) => e.type === "scheme_cond" && e.text === "Whatever goes in here reaches Portugal's drinks."));
  assert.ok(ev.some((e) => e.type === "scheme_clue" && e.scheme === "special" && e.mutter === "Useful."));
  // The payoff: a cut of four to six seconds, hatch then hotel dock, captions under fifty characters.
  const cut = ev.find((e) => e.type === "scheme_play" && e.scheme === "special")!;
  const ms = cut.beats.reduce((n: number, b: any) => n + b.ms, 0);
  assert.ok(ms >= 4000 && ms <= 6000, `the cut is ${ms} ms`);
  assert.ok(cut.beats.every((b: any) => b.cut && b.caption.length < 50));
  assert.equal(cut.beats[cut.beats.length - 1].caption, "MEANWHILE: PORTUGAL'S DRINKS");
  assert.ok(Math.hypot(cut.beats[1].x - PLANT.dock.x, cut.beats[1].y - PLANT.dock.y) < 0.01, "it ends on the hotel's dock");
  // The state: written when the drinks were served, half a minute after the token went in; announced; and his chain.
  const put = ev.find((e) => e.type === "special_in")!, served = ev.find((e) => e.type === "special_served")!, fs = ev.find((e) => e.type === "fstate" && e.id === "hyper")!;
  assert.ok(served.t - put.t >= SERVE_SECS * 60 && served.t - put.t < SERVE_SECS * 60 + 30, "half a minute after it went in");
  assert.equal(fs.t, served.t); assert.equal(fs.team, 1); assert.equal(fs.cause, "The Visitors' Special");
  assert.ok(hasState(w, "hyper", 1) && !hasState(w, "hyper", 0));
  assert.ok(ev.some((e) => e.type === "scheme_news" && e.t === served.t && /^PORTUGAL'S HOTEL/.test(e.text)));
  assert.ok(ev.some((e) => e.type === "chain" && e.links.join(" > ") === "GROZZ PUTS ROCKET TONIC IN THE VISITORS PIPE > PORTUGAL DRINK THE ROCKET TONIC"));
  assert.ok(ev.some((e) => e.type === "mission_done" && e.mission === "special" && e.ok));
  assert.equal(s.match!.phase, "pre", "all of it before kick-off");
  // And then the second card over the same plant is dealt.
  run(g, 1);
  const home = cards(w).find((c) => c.id === "home");
  assert.ok(home, "Home Advantage is on the table once the first plan's done");
  assert.match(home!.buys, /can go wrong/);
  assert.ok(sc.vars.done_away && !sc.vars.done_home);
  void st;
}, true)); // (with the kick-off that waits, as the game build has it)

test("the plant: stood at a hatch with a token, the hatch is the big button, and each pipe names itself", () => calm(() => {
  const { g, pc, stand, give, sc, w } = atPlant("special-2");
  // Nothing in his hands: the free tin is the big button. With one: the pipe he's stood at.
  assert.equal(main(g, pc)!.label, "Take a Rocket Tonic");
  give("sleepy_syrup");
  stand("away"); assert.equal(main(g, pc)!.label, "Put in VISITORS pipe");
  assert.equal(whatItDoes(w, pc, main(g, pc)!), "Portugal drink the Sleepy Syrup. Half asleep till half-time.");
  stand("front"); assert.equal(main(g, pc)!.label, "Put in VISITORS pipe", "in the middle it's still the visitors': the wrong pipe takes walking to");
  assert.ok(!opt(g, pc, /HOME pipe/), "one pipe at a time: the one he's stood at");
  stand("home"); assert.equal(main(g, pc)!.label, "Put in HOME pipe");
  assert.equal(whatItDoes(w, pc, main(g, pc)!), "England drink the Sleepy Syrup. Half asleep till half-time.");
  // (The big button shows a label's first four words: the pipe has to be among them.)
  for (const o of options(w, pc, null).filter((q) => q.action?.verb === "scheme")) assert.match(o.label.split(" ").slice(0, 4).join(" "), /pipes?$|Tonic$/, o.label);
  // Off the coach, beside it, nothing's offered: he hasn't walked up to it.
  const a = arrivalSpot(); pc.x = a.x; pc.y = a.y;
  assert.ok(!options(w, pc, null).some((o) => o.action?.verb === "scheme" && String(o.action.arg).startsWith("special:")));
  // The board: nothing while the button says it all; when it's served, once a pipe's loaded; and with the free
  // tin gone and his hands empty, what else the thing takes. One at a time, short.
  const board = (ww: typeof w) => schemeThings(ww).filter((t) => t.board && Math.abs(t.x - plantSpots().cx) < 0.1).map((t) => t.board!);
  const fresh = atPlant("special-2b", { looked: false });
  assert.deepEqual(board(fresh.w), [], "no board till he's looked");
  assert.equal(main(fresh.g, fresh.pc)!.label, "Look at the pipes");
  fresh.press(/^Look at the pipes$/);
  assert.deepEqual(board(fresh.w), [], "nor while the free tin's there to take");
  fresh.press(/^Take a Rocket Tonic$/);
  assert.deepEqual(board(fresh.w), [], "nor with it in his hand");
  fresh.press(/^Put in VISITORS pipe$/);
  assert.equal(board(fresh.w).length, 1); assert.match(board(fresh.w)[0], /^VISITORS · SERVED IN 0:(30|29)$/);
  run(fresh.g, SERVE_SECS + 1);
  assert.deepEqual(board(fresh.w), ["ALSO TAKES SYRUP, POWDER, WORSE"]);
  void sc;
}));

test("the plant: each token is one football state, on whichever side's pipe it went down", () => calm(() => {
  const want: Record<string, [string, string, boolean]> = {
    rocket_tonic: ["hyper", "motivated", false], sleepy_syrup: ["lethargic", "lethargic", false], dodgy_electrolytes: ["confused", "confused", false],
    powder: ["hyper", "hyper", true], ronson_filth: ["sick", "sick", true],
  };
  assert.deepEqual(TOKENS.map((t) => t.def).sort(), Object.keys(want).sort());
  for (const tk of TOKENS) for (const pipe of ["away", "home"] as const) {
    const { g, w, pc, ev, stand, give, press, sc } = atPlant(`special-tk-${tk.def}-${pipe}`);
    const [away, home, whole] = want[tk.def], id = pipe === "away" ? away : home, team = pipe === "away" ? 1 : 0;
    const it = give(tk.def); stand(pipe);
    const o = main(g, pc)!;
    assert.equal(o.label, `Put in ${pipe === "away" ? "VISITORS" : "HOME"} pipe`);
    const hint = whatItDoes(w, pc, o);
    assert.ok(hint.startsWith(`${pipe === "away" ? "Portugal" : "England"} drink the ${tk.name}.`) && hint.length <= 72, hint);
    assert.equal(/all match/.test(hint), whole, hint);
    assert.equal(dispatch(w, o.action!).ok, true);
    assert.equal(it.loc.k, "gone", "it's gone into the machine");
    assert.equal(plantView(w)!.pipes[pipe]!.token, tk.def);
    run(g, SERVE_SECS - 1);
    assert.ok(!hasState(w, id as any, team), "not before the drinks are served");
    run(g, 2);
    assert.ok(hasState(w, id as any, team), `${tk.def} down the ${pipe} pipe: ${id}`);
    assert.ok(!hasState(w, id as any, team === 1 ? 0 : 1), "and only that side");
    assert.equal(!!sc.vars[`half_${pipe}`], !whole, "the cheap ones last a half");
    assert.equal(ev.filter((e) => e.type === "scheme_news" && e.scheme === "special").length, 1, "said once");
    assert.equal(plantView(w)!.pipes[pipe], null, "and the pipe's empty again");
    assert.equal(plantView(w)!.got[pipe], tk.def);
  }
}));

test("the plant: the wrong pipe does it to England, and the lever undoes it until the drinks are served", () => calm(() => {
  // Down the wrong pipe and left there: England get it.
  { const { g, w, pc, ev, stand, give, press } = atPlant("special-wrong-1");
    give("sleepy_syrup"); stand("home");
    assert.equal(press(/^Put in HOME pipe$/).ok, true);
    run(g, 6);
    assert.ok(ev.some((e) => e.type === "scheme_line" && /Wrong pipe/.test(e.text)), "he notices");
    assert.equal(main(g, pc)!.label, "Flush the HOME pipe", "and putting it right is the big button");
    assert.equal(whatItDoes(w, pc, main(g, pc)!), "It comes back out. Nobody drinks it.");
    run(g, SERVE_SECS);
    assert.ok(hasState(w, "lethargic", 0), "England are half asleep"); assert.ok(!hasState(w, "lethargic", 1));
    assert.ok(ev.some((e) => e.type === "scheme_news" && /^ENGLAND'S DRESSING ROOM/.test(e.text)));
    assert.ok(!opt(g, pc, /^Flush/), "too late for the lever");
    assert.equal(pinned(w)!.id, "special", "and the plan's still to do"); }
  // Flushed in time: nothing's served, the token's back in his hand, and it can go down the right one.
  { const { g, w, s, pc, ev, stand, give, press, sc } = atPlant("special-wrong-2");
    give("sleepy_syrup"); stand("home");
    press(/^Put in HOME pipe$/);
    run(g, 10);
    assert.equal(pc.hand, null);
    assert.equal(press(/^Flush the HOME pipe$/).ok, true);
    assert.equal(s.items[pc.hand!]?.def, "sleepy_syrup", "it comes back out");
    assert.equal(plantView(w)!.pipes.home, null);
    run(g, SERVE_SECS + 5);
    assert.ok(!hasState(w, "lethargic", 0) && !(s.stadium!.fstates ?? []).length, "nobody drank anything");
    assert.ok(!ev.some((e) => e.type === "special_served"));
    stand("away");
    assert.equal(main(g, pc)!.label, "Put in VISITORS pipe");
    dispatch(w, main(g, pc)!.action!);
    // The lever's there for the right pipe too, but never as the big button: a second tap mustn't undo the first.
    run(g, 6);
    assert.ok(opt(g, pc, /^Flush the VISITORS pipe$/)); assert.ok((opt(g, pc, /^Flush the VISITORS pipe$/)!.priority) <= 0);
    assert.notEqual(main(g, pc)?.label, "Flush the VISITORS pipe");
    run(g, SERVE_SECS);
    assert.ok(hasState(w, "lethargic", 1) && !hasState(w, "lethargic", 0));
    assert.ok(sc.vars.done_away && !sc.vars.done_home); }
  // One token per pipe at a time; a later serving replaces an earlier one.
  { const { g, w, pc, stand, give, press } = atPlant("special-wrong-3");
    give("rocket_tonic"); stand("away"); press(/^Put in VISITORS pipe$/);
    give("ronson_filth"); run(g, 2);
    assert.ok(!opt(g, pc, /^Put in/), "the pipe's full");
    run(g, SERVE_SECS);
    assert.ok(hasState(w, "hyper", 1));
    press(/^Put in VISITORS pipe$/); run(g, SERVE_SECS + 1);
    assert.ok(hasState(w, "sick", 1) && !hasState(w, "hyper", 1), "the last drink wins"); }
}));

test("the plant: not while the drayman's looking", () => calm(() => {
  const { g, w, s, pc, ev, sp, sc, dray, stand, give } = atPlant("special-watch", { looked: false, dray: "here" });
  // He's stood three metres off, facing it, with nothing else on his mind.
  const watch = () => { dray.hiddenIn = undefined; dray.x = sp.cx - 0.5; dray.y = sp.y1 + 4; dray.facing = -Math.PI / 2; dray.npc!.plan = [{ k: "wait", s: 60 }]; dray.npc!.mode = "routine"; dray.npc!.fetch = undefined; dray.npc!.duty = undefined; dray.npc!.gawk = undefined; };
  const away = () => { dray.x = sp.cx - 0.5; dray.y = sp.y1 + 5; dray.facing = Math.PI / 2; };
  watch();
  assert.ok(plantWatched(w), "he's minding it");
  const look = main(g, pc)!;
  assert.equal(look.label, "Look at the pipes");
  assert.equal(whatItDoes(w, pc, look), "Not while the drayman's looking.");
  assert.equal(dispatch(w, look.action!).ok, true);
  assert.ok(!sc.clues.pipes, "he learns nothing");
  assert.equal(ev.filter((e) => e.type === "special_no").length, 1);
  assert.ok(ev.some((e) => e.type === "say" && e.by === dray.id), "and is told so");
  // His back turned: the same press works.
  away();
  assert.ok(!plantWatched(w));
  assert.equal(dispatch(w, look.action!).ok, true);
  assert.ok(sc.clues.pipes);
  // The crate, a hatch and the lever are all his to mind.
  watch();
  dispatch(w, main(g, pc)!.action!);
  assert.equal(pc.hand, null, "no tin while he's looking"); assert.equal(sc.vars.crate, 1);
  const it = give("rocket_tonic"); stand("away");
  const put = main(g, pc)!;
  assert.equal(whatItDoes(w, pc, put), "Portugal drink the Rocket Tonic. Not while the drayman's looking.");
  dispatch(w, put.action!);
  assert.equal(it.loc.k, "hand", "it stays in his hand"); assert.equal(plantView(w)!.pipes.away, null);
  away(); dispatch(w, put.action!); assert.equal(it.loc.k, "gone");
  watch();
  const fl = opt(g, pc, /^Flush the VISITORS pipe$/)!;
  dispatch(w, fl.action!);
  assert.ok(plantView(w)!.pipes.away, "nor the lever");
  // He never says the same thing twice running.
  const said = ev.filter((e) => e.type === "say" && e.by === dray.id).map((e) => e.text);
  assert.ok(said.length >= 3); for (let i = 1; i < said.length; i++) assert.notEqual(said[i], said[i - 1]);
  void s;
}));

test("the plant: seen from inside the ground before kick-off, it's on the big screen; a half's worth is gone at half-time", () => calm(() => {
  const { g, w, s, pc, ev, stand, give, press, sc } = atPlant("special-screen");
  give("dodgy_electrolytes"); stand("away"); press(/^Put in VISITORS pipe$/);
  give("powder"); stand("home"); press(/^Put in HOME pipe$/);
  // He's in his seat when they're served.
  pc.x = 0; pc.y = 33; s.stadium!.admitted = true;
  assert.ok(VENUE.inside(pc.x, pc.y));
  run(g, SERVE_SECS + 1);
  const news = ev.filter((e) => e.type === "scheme_news" && e.scheme === "special").map((e) => e.text);
  assert.ok(news.some((t) => /^BIG SCREEN: [A-Z' -]+ WARMING UP\. AT THE WRONG END\.$/.test(t)), news.join(" / "));
  assert.ok(news.some((t) => /^ENGLAND'S DRESSING ROOM/.test(t)));
  assert.ok(news.every((t) => t.length <= 64));
  assert.ok(hasState(w, "confused", 1) && hasState(w, "hyper", 0));
  // On to half-time: the electrolytes have worn off Portugal; England are on the powder till the end.
  // (The whistle's gone for the break. Playing fifteen minutes of football to get here would prove nothing more.)
  s.match!.phase = "break"; s.match!.period = 1; s.match!.phaseUntil = s.tick + 60 * 30;
  run(g, 1);
  assert.ok(!hasState(w, "confused", 1), "worn off"); assert.ok(hasState(w, "hyper", 0), "the powder hasn't");
  assert.ok(ev.some((e) => e.type === "scheme_news" && /^HALF-TIME: THE DODGY ELECTROLYTES HAS WORN OFF PORTUGAL$/.test(e.text)));
  assert.equal(sc.vars.got_away, 0); assert.equal(sc.vars.got_home, 4);
}));

test("Home Advantage: the same plant, England's pipe, once the first plan's done", () => calm(() => {
  const { g, w, s, pc, ev, stand, give, press } = atPlant("special-home");
  give("rocket_tonic"); stand("away"); press(/^Put in VISITORS pipe$/);
  run(g, SERVE_SECS + 2);
  assert.ok(s.stadium!.missions!.done.special);
  const card = cards(w).find((c) => c.id === "home")!;
  assert.ok(card, "dealt");
  assert.deepEqual(card.steps.map((x) => x.text), ["Find something for England's drinks", "Put it in the HOME pipe", "Wait for England's drinks to be served"]);
  assert.equal(dispatch(w, { verb: "mission", actor: pc.id, arg: "home" }).ok, true);
  run(g, 0.5);
  assert.equal(pinned(w)!.text, "Find something for England's drinks");
  // The tonic's behind the bar now the free one's gone.
  const land = Object.values(s.actors).find((a) => a.npc?.shop === "pub")!;
  pc.x = land.x; pc.y = land.y + 1.6;
  assert.equal(dispatch(w, { verb: "buy", actor: pc.id, target: { k: "actor", id: land.id }, arg: "rocket_tonic" }).ok, true);
  run(g, 0.5);
  assert.equal(pinned(w)!.text, "Put it in the HOME pipe");
  stand("home");
  assert.equal(main(g, pc)!.label, "Put in HOME pipe");
  dispatch(w, main(g, pc)!.action!);
  run(g, 8);
  assert.ok(ev.some((e) => e.type === "scheme_play" && e.variant === "home" && e.beats[e.beats.length - 1].caption === "MEANWHILE: ENGLAND'S DRINKS"));
  assert.ok(ev.some((e) => e.type === "scheme_line" && /Get that down you/.test(e.text)));
  assert.notEqual(main(g, pc)?.label, "Flush the HOME pipe", "on purpose this time: the lever isn't the big button");
  run(g, SERVE_SECS);
  assert.ok(hasState(w, "motivated", 0) && hasState(w, "hyper", 1));
  assert.ok(ev.some((e) => e.type === "mission_done" && e.mission === "home" && e.ok));
  void give;
}));

test("the plant: Ronson, fed, leaves a token behind; and the yard still works round it", () => calm(() => {
  const { g, w, s, st, pc, ev, sc, stand, press } = atPlant("special-filth");
  // (However he came by his dinner: dog.ts marks the three seconds he spends on it.)
  const dog = s.actors[st.dog!.id];
  st.dog!.eatUntil = s.tick + 180;
  run(g, 9);
  const filth = Object.values(s.items).find((i) => i.def === "ronson_filth");
  assert.ok(filth && filth.loc.k === "ground" && Math.hypot(filth.loc.x - dog.x, filth.loc.y - dog.y) < 2, "where he ate");
  assert.ok(ev.some((e) => e.type === "special_filth")); assert.ok(sc.clues.filth);
  pc.x = (filth!.loc as any).x; pc.y = (filth!.loc as any).y + 0.5;
  assert.equal(dispatch(w, { verb: "take", actor: pc.id, item: filth!.id }).ok, true);
  stand("away"); press(/^Put in VISITORS pipe$/);
  run(g, SERVE_SECS + 1);
  assert.ok(hasState(w, "sick", 1));

  // The plant stands clear of where he's dropped, of the lorry's run, and of the ways in and out of the yard.
  const a = arrivalSpot(), body = SOLID.filter((q) => q.prop && q.x < PLANT.x1 + 0.01 && q.x + q.w > PLANT.x0 - 0.01 && q.y < PLANT.y1 + 0.01 && q.y + q.h > PLANT.y0 - 0.01);
  assert.ok(body.length >= 1, "it's solid");
  for (const q of SOLID) assert.ok(!(a.x + 0.55 > q.x && a.x - 0.55 < q.x + q.w && a.y + 0.55 > q.y && a.y - 0.55 < q.y + q.h), "nothing's been built on the spot he arrives at");
  const R = VENUE.delivery.route;
  for (let i = 0; i + 3 < R.length; i += 2) for (const p of [PLANT.home, PLANT.homeLeg, PLANT.awayLeg, PLANT.dock]) {
    const [x0, y0, x1, y1] = [R[i], R[i + 1], R[i + 2], R[i + 3]], t = Math.max(0, Math.min(1, ((p.x - x0) * (x1 - x0) + (p.y - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2 || 1)));
    assert.ok(Math.hypot(p.x - (x0 + (x1 - x0) * t), p.y - (y0 + (y1 - y0) * t)) > 2.5, "not on the lorry's road");
  }
  for (const [from, to] of [[{ x: -28, y: 72 }, { x: -20, y: 55 }], [{ x: -34.8, y: 68 }, { x: -28, y: 69.5 }], [{ x: -28, y: 70 }, { x: 0, y: 50 }], [{ x: 83, y: -7 }, { x: 76.2, y: -12.6 }]])
    assert.ok(findPath(from.x, from.y, to.x, to.y).length > 0, `a way from ${from.x},${from.y} to ${to.x},${to.y}`);
}));

test("the Visitors' Special is the same every time for the same seed", () => calm(() => {
  const go = () => { const g = createGame("special-det"), ev = events(g), r = follow(g, 240), s = g.w.state, pc = s.actors[s.stadium!.pc]; run(g, 5);
    return JSON.stringify({ r, vars: schemeState(g.w, "special")!.vars, fs: s.stadium!.fstates, pc: [pc.x, pc.y], rng: s.rng.world, n: ev.length, news: ev.filter((e) => e.type === "scheme_news") }); };
  const a = go(), b = go();
  assert.equal(a, b);
  assert.ok(JSON.parse(a).r.doneAt > 0);
}, true));

// THE VISITORS' SPECIAL. The first plan a new player meets, and the contraption it runs on.
//
// In the top corner of the pub yard, beside where the coach drops Grozz, stands the hydration plant: a
// ludicrous service manifold with two enormous pipes, HOME HYDRATION and VISITORS HYDRATION, each with a
// hatch. Nothing about it is plumbing. Whatever goes in a hatch reaches that team's drinks: the visitors'
// line comes up on the hotel's dock, England's in their dressing room. The machine takes anything and asks
// nothing. The things that go in are tokens, each worth exactly one football state (fstates.ts):
//
//   TOKEN               VISITORS pipe            HOME pipe                 lasts
//   Rocket Tonic        hyper                    motivated                 to half-time
//   Sleepy Syrup        lethargic                lethargic                 to half-time
//   Dodgy Electrolytes  confused                 confused                  to half-time
//   Powder              hyper                    hyper (cards)             the match
//   Ronson Filth        sick                     sick                      the match
//
// One token per pipe at a time. The drinks are served half a minute after a pipe is loaded (the board on
// the plant counts it down); until then the flush lever spits the token back out, so the wrong pipe can be
// undone. Served is when the state is written and the news says so. A side's drinks carry one thing: a
// later serving replaces an earlier one. The plant is the drayman's to mind, so nothing at it works while
// he's looking: roll a keg, wait for the lorry to take him, or catch him with his back turned.
//
// Two missions read this file's state: "special" (the visitors' pipe: six steps, the first three minutes of
// the game) and "home" (the same plant, England's pipe, offered once the first is done).
// For other schemes to read (schemeState(w, "special")?.vars):
//   got_away / got_home     the token (1..5, the table's order) that side is playing on, 0 for none;
//   done_away / done_home   the tick a serving first reached that side.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { canPocket, moveItem, spawnItem } from "../core/items";
import { PACE, PLANT, VENUE } from "./layout";
import { say as say0 } from "./npc";
import { SHOPS } from "./rules";
import { draymanWatching } from "./beer";
import { linkCause, rootCause } from "./cause";
import { clearState, setState, sideName, type TeamIdx, type TeamStateId } from "./fstates";
import { defineMission } from "./missions";
import { defineScheme, learn, type SchemeAction, type SchemeDef, type SchemeState, type Thing } from "./schemes";

type P = { x: number; y: number };
export type Pipe = "home" | "away";
export interface Token { def: string; name: string; away: TeamStateId; home: TeamStateId; whole: boolean }
/** The table at the top of the file. A pipe's `in_`/`got_` var is an index into this, plus one. */
export const TOKENS: Token[] = [
  { def: "rocket_tonic", name: "Rocket Tonic", away: "hyper", home: "motivated", whole: false },
  { def: "sleepy_syrup", name: "Sleepy Syrup", away: "lethargic", home: "lethargic", whole: false },
  { def: "dodgy_electrolytes", name: "Dodgy Electrolytes", away: "confused", home: "confused", whole: false },
  { def: "powder", name: "Powder", away: "hyper", home: "hyper", whole: true },
  { def: "ronson_filth", name: "Ronson Filth", away: "sick", home: "sick", whole: true },
];
const PIPES: Pipe[] = ["away", "home"];
const PIPE_NAME: Record<Pipe, string> = { home: "HOME", away: "VISITORS" };
/** Seconds from a pipe being loaded to the drinks being served. Long enough to flush a mistake. */
export const SERVE_SECS = 30;
/** How long the first cut holds on the hatch, and how long on the far end. */
const CUT_HATCH = 1.6, CUT_END = 3.4;
/** Seconds after loading that the far end's crate gets its mark (the view draws it from this). */
export const STAMP_SECS = CUT_HATCH + 1.1;
const REACH = 1.7;
const WORD: Record<TeamStateId, string> = { hyper: "Wired", lethargic: "Half asleep", confused: "Lost", sick: "Sick", motivated: "Up for it", late: "Late", kitchaos: "In the wrong kit" };

const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
const m2 = (p: P): P => ({ x: mx(p.x), y: p.y });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const say = (w: World, a: Actor, text: string, secs = 3): void => { say0(w, a, text, secs); if (a.npc) a.npc.told = w.state.tick + Math.round(secs * 60); };
const drayman = (w: World) => Object.values(w.state.actors).find((a) => a.npc?.job === "worker" && !a.dead);
const pcOf = (w: World) => w.state.actors[w.state.stadium!.pc];
const mmss = (t: number) => { const s = Math.max(0, Math.ceil(t / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const teamOf = (p: Pipe): TeamIdx => (p === "home" ? 0 : 1);
const stateOf = (p: Pipe, i: number): TeamStateId => TOKENS[i - 1][p];

/** Where the plant's parts are at this ground. */
export function plantSpots() {
  const cx = mx((PLANT.x0 + PLANT.x1) / 2);
  return {
    x0: Math.min(mx(PLANT.x0), mx(PLANT.x1)), x1: Math.max(mx(PLANT.x0), mx(PLANT.x1)), y0: PLANT.y0, y1: PLANT.y1, cx, flip: VENUE.id === "sf",
    home: m2(PLANT.home), away: m2(PLANT.away), crate: m2(PLANT.crate), homeLeg: m2(PLANT.homeLeg), awayLeg: m2(PLANT.awayLeg), dock: m2(PLANT.dock), homeEnd: m2(PLANT.homeEnd),
    /** Where to stand to use it: in front of the middle, and in front of each hatch. */
    front: { x: cx, y: PLANT.y1 + 0.8 }, atHome: { x: mx(PLANT.home.x), y: PLANT.y1 + 0.8 }, atAway: { x: mx(PLANT.away.x), y: PLANT.y1 + 0.8 },
  };
}
const hatch = (p: Pipe): P => m2(PLANT[p]);
/** The far end of a pipe: the crate on the hotel's dock, the cooler in England's dressing room. */
const farEnd = (p: Pipe): P => m2(p === "home" ? PLANT.homeEnd : PLANT.dock);

const carried = (w: World, a: Actor): Item[] => [a.hand, ...a.pockets].filter((x): x is string => !!x).map((id) => w.state.items[id]).filter((i) => !!i);
const tokenIdx = (it: Item | undefined) => (it ? TOKENS.findIndex((t) => t.def === it.def) + 1 : 0);
/** The tokens he could put in just now: the one in his hand if he's holding one, else whatever's in his pockets. */
function offerable(w: World, pc: Actor): Item[] {
  const hand = pc.hand ? w.state.items[pc.hand] : undefined;
  if (tokenIdx(hand)) return [hand!];
  return carried(w, pc).filter((i) => tokenIdx(i));
}
/** The pipe whose hatch he's stood at, if he's in front of the plant and in reach. The visitors' unless he's
 *  plainly at England's (the left third of the front): the wrong pipe should take walking to. */
function pipeAt(pc: Actor): Pipe | null {
  // (In front of it, not round the side: he's dropped off beside the thing, and that isn't "at" it.)
  if (pc.seated || pc.hiddenIn || pc.y < PLANT.y1 - 0.1 || Math.abs(pc.x - mx((PLANT.x0 + PLANT.x1) / 2)) > (PLANT.x1 - PLANT.x0) / 2 + 0.3) return null;
  const dh = dist(pc, hatch("home")), da = dist(pc, hatch("away"));
  return Math.min(dh, da) > REACH ? null : dh < da - 0.4 ? "home" : "away";
}
const specialDone = (w: World) => !!w.state.stadium!.missions?.done.special;
/** England's pipe loaded before the visitors' ever was, on the first plan: that's the wrong pipe. */
const mistake = (w: World, sc: SchemeState) => !!sc.vars.in_home && !sc.vars.put_away && !specialDone(w);
/** Seconds after he's got a keg back that he's still fussing with his stack, and not with his plant. */
const FUSS_SECS = 20;
/** Is the drayman stood looking at his plant? Not while he's after a keg, nor for a bit once he's got it back:
 *  one rolled keg has to be time enough to look, take and load, on a phone, the first time. */
export function plantWatched(w: World): Actor | undefined {
  const sc = w.state.stadium!.schemes?.special;
  if (sc && w.state.tick < (sc.vars.fuss ?? 0)) return undefined;
  return draymanWatching(w, plantSpots().front);
}

// (A pool, taken in turn: nobody says the same thing twice running.)
const NO = ["Oi! Hands off the hydration!", "Staff only, that. Do you look like staff?", "Leave my manifold alone, fatso.", "That's for athletes. Look at the state of you.", "I can see you, you know."];
/** He's been seen at it: the drayman says so, and nothing happens. */
function seen(w: World, pc: Actor, d: Actor, sc: SchemeState): void {
  say(w, d, NO[(sc.vars.nos = (sc.vars.nos ?? 0) + 1) % NO.length], 3);
  d.facing = Math.atan2(pc.y - d.y, pc.x - d.x);
  w.bus.emit({ type: "special_no", t: w.state.tick, by: pc.id, who: d.id });
}

function load(w: World, pc: Actor, sc: SchemeState, pipe: Pipe, it: Item): void {
  const s = w.state, tick = s.tick, i = tokenIdx(it), tk = TOKENS[i - 1], h = hatch(pipe), end = farEnd(pipe), first = !sc.vars[`cut_${pipe}`];
  moveItem(s, it.id, { k: "gone" });
  sc.vars[`in_${pipe}`] = i; sc.vars[`at_${pipe}`] = tick; sc.vars[`due_${pipe}`] = tick + SERVE_SECS * 60; sc.vars[`put_${pipe}`] = tick; sc.vars[`cut_${pipe}`] = 1;
  sc.vars[`cause_${pipe}`] = rootCause(w, `GROZZ PUTS ${tk.name.toUpperCase()} IN THE ${PIPE_NAME[pipe]} PIPE`, h, "process");
  learn(w, DEF, sc, "any", true);
  w.bus.emit({ type: "special_in", t: tick, pipe, token: tk.def, first, x: h.x, y: h.y, ex: end.x, ey: end.y });
  w.bus.emit({ type: "scheme_did", t: tick, scheme: "special", what: "load", pipe, x: h.x, y: h.y });
  // The payoff: the camera follows it in at the hatch, then out at the far end where the crate gets its mark.
  // (The first time down each pipe. After that, just the far end.)
  const cap = `MEANWHILE: ${sideName(w, teamOf(pipe)).toUpperCase()}'S DRINKS`;
  const beats = first ? [{ at: 0, ms: CUT_HATCH * 1000, cut: true, caption: "IN IT GOES", x: h.x, y: h.y - 0.6 }, { at: CUT_HATCH, ms: CUT_END * 1000, cut: true, caption: cap, x: end.x, y: end.y }]
    : [{ at: 0, ms: CUT_END * 1000, cut: true, caption: cap, x: end.x, y: end.y }];
  w.bus.emit({ type: "scheme_play", t: tick, scheme: "special", variant: pipe, beats });
  // What he makes of it, once the picture's back with him.
  sc.vars.lineAt = tick + Math.round((first ? CUT_HATCH + CUT_END : CUT_END) * 60) + 20;
  sc.vars.line = pipe === "away" ? 1 : mistake(w, sc) ? 2 : 3;
  if (sc.vars.line === 2) learn(w, DEF, sc, "wrong", true);
}

function flush(w: World, pc: Actor, sc: SchemeState, pipe: Pipe): void {
  const s = w.state, i = sc.vars[`in_${pipe}`], tk = TOKENS[i - 1], h = hatch(pipe);
  sc.vars[`in_${pipe}`] = 0; sc.vars[`due_${pipe}`] = 0;
  // A mistake undone is undone: it never counted as put in, and the token comes back out.
  sc.vars[`put_${pipe}`] = sc.vars[`served_${pipe}`] ?? 0;
  const it = spawnItem(s, tk.def, { k: "ground", x: pc.x, y: pc.y });
  if (!pc.hand) moveItem(s, it.id, { k: "hand", a: pc.id }); else if (canPocket(pc, it)) moveItem(s, it.id, { k: "pocket", a: pc.id });
  linkCause(w, sc.vars[`cause_${pipe}`], "AND FLUSHES IT BACK OUT", h, "process");
  w.bus.emit({ type: "special_flush", t: s.tick, pipe, token: tk.def, x: h.x, y: h.y });
  w.bus.emit({ type: "scheme_did", t: s.tick, scheme: "special", what: "flush", pipe, x: h.x, y: h.y });
}

const NEWS: Record<TeamStateId, string> = {
  hyper: "'THE LADS CAN'T SIT STILL'", lethargic: "'HALF THE SQUAD'S ASLEEP'", confused: "'NOBODY CAN FIND THE COACH'", sick: "'A QUEUE FOR EVERY TOILET'",
  motivated: "'THEY'RE UP FOR IT'", late: "", kitchaos: "",
};
const SCREEN: Record<TeamStateId, string> = {
  hyper: "HE HASN'T BLINKED YET", lethargic: "LYING DOWN", confused: "AT THE WRONG END", sick: "NEXT TO A BUCKET", motivated: "", late: "", kitchaos: "",
};
/** One of theirs, for the big screen to pick on: the same man every time for the same match. */
const theirMan = (w: World) => { const sq = w.state.match!.teams[1].squad.map((id) => w.state.actors[id]).filter((a) => a?.fb && a.fb.role !== "GK"); return (sq[3] ?? sq[0])?.name.split(" ").pop()?.toUpperCase() ?? "THEIR NUMBER SEVEN"; };
const inGround = (w: World) => { const pc = pcOf(w); return !!pc && VENUE.inside(pc.x, pc.y) && !pc.heldBy; };

/** The drinks go out: that side is playing on whatever was in the pipe. */
function serve(w: World, sc: SchemeState, pipe: Pipe): void {
  const s = w.state, tick = s.tick, i = sc.vars[`in_${pipe}`], tk = TOKENS[i - 1], team = teamOf(pipe), id = tk[pipe], side = sideName(w, team), ph = s.match?.phase;
  const old = sc.vars[`got_${pipe}`];
  if (old) clearState(w, stateOf(pipe, old), team);
  setState(w, id, team, 0, pipe === "away" ? "The Visitors' Special" : "Home Advantage");
  sc.vars[`in_${pipe}`] = 0; sc.vars[`due_${pipe}`] = 0; sc.vars[`got_${pipe}`] = i; sc.vars[`served_${pipe}`] = tick;
  sc.vars[`done_${pipe}`] = sc.vars[`done_${pipe}`] || tick;
  // A token that lasts a half runs out at the next half-time (there isn't one after the first).
  sc.vars[`half_${pipe}`] = !tk.whole && (ph === "pre" || s.match!.period === 1) && ph !== "break" ? 1 : 0;
  linkCause(w, sc.vars[`cause_${pipe}`], `${side.toUpperCase()} DRINK THE ${tk.name.toUpperCase()}`, farEnd(pipe), "process");
  w.bus.emit({ type: "special_served", t: tick, pipe, token: tk.def, state: id, team });
  // In the ground before kick-off he sees it for himself on the big screen; anywhere else, it's word from the hotel.
  if (pipe === "away" && ph === "pre" && inGround(w) && SCREEN[id]) screen(w, sc, id);
  else w.bus.emit({ type: "scheme_news", t: tick, scheme: "special", text: pipe === "away" ? `${side.toUpperCase()}'S HOTEL: ${NEWS[id]}` : `ENGLAND'S DRESSING ROOM: ${NEWS[id]}` });
}
function screen(w: World, sc: SchemeState, id: TeamStateId): void {
  sc.vars.tv = sc.vars.served_away;
  w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: "special", text: `BIG SCREEN: ${theirMan(w)} WARMING UP. ${SCREEN[id]}.` });
}

// ---------------------------------------------------------------- what he can do at it

const at = (w: World, pc: Actor, sc: SchemeState) => (pc.id === w.state.stadium!.pc && !sc.vars.off ? pipeAt(pc) : null);
function actions(): SchemeAction[] {
  const out: SchemeAction[] = [
    { id: "look", label: "Look at the pipes", hint: "A proper look at where they go.", priority: 78,
      can: (w, pc, sc) => (!sc.clues.pipes && at(w, pc, sc) ? null : "no"),
      run: (w, pc, sc) => {
        const d = plantWatched(w); if (d) return seen(w, pc, d, sc);
        learn(w, DEF, sc, "pipes");
        // Said plainly, once, where the tick for a condition goes.
        w.bus.emit({ type: "scheme_cond", t: w.state.tick, scheme: "special", cond: "pipes", on: true, how: "looked", text: `Whatever goes in here reaches ${sideName(w, 1)}'s drinks.` });
      } },
    { id: "take", label: "Take a Rocket Tonic", hint: "The drayman's. The first one's free.", priority: 77,
      can: (w, pc, sc) => (sc.clues.pipes && (sc.vars.crate ?? 0) > 0 && at(w, pc, sc) && !carried(w, pc).some((i) => tokenIdx(i)) && (!pc.hand || pc.pockets.length < 3) ? null : "no"),
      run: (w, pc, sc) => {
        const d = plantWatched(w); if (d) return seen(w, pc, d, sc);
        sc.vars.crate--;
        const it = spawnItem(w.state, "rocket_tonic", pc.hand ? { k: "pocket", a: pc.id } : { k: "hand", a: pc.id });
        w.bus.emit({ type: "special_take", t: w.state.tick, by: pc.id, item: it.id });
      } },
  ];
  for (const pipe of PIPES) {
    // (The big button shows a label's first four words, so the pipe's name is in them. The line over it names the token.)
    const open = (w: World, pc: Actor, sc: SchemeState) => !!sc.clues.pipes && !sc.vars[`in_${pipe}`] && at(w, pc, sc) === pipe;
    out.push({
      id: `put_${pipe}`, label: `Put in ${PIPE_NAME[pipe]} pipe`, hint: "", priority: 82,
      can: (w, pc, sc) => (open(w, pc, sc) && offerable(w, pc).length ? null : "no"),
      run: (w, pc, sc) => { const d = plantWatched(w); if (d) return seen(w, pc, d, sc); load(w, pc, sc, pipe, offerable(w, pc)[0]); },
    });
    // With more than one token in his pockets, the others are in the list.
    TOKENS.forEach((tk, k) => out.push({
      id: `put_${pipe}_${k + 1}`, label: `Put in ${PIPE_NAME[pipe]} pipe: ${tk.name}`, hint: "", priority: 0,
      can: (w, pc, sc) => (open(w, pc, sc) && offerable(w, pc).slice(1).some((i) => i.def === tk.def) && offerable(w, pc)[0].def !== tk.def ? null : "no"),
      run: (w, pc, sc) => { const d = plantWatched(w); if (d) return seen(w, pc, d, sc); load(w, pc, sc, pipe, offerable(w, pc).find((i) => i.def === tk.def)!); },
    }));
    // The lever. Never the big button (a second tap would undo the first), except to put the wrong pipe right.
    const fl = (id: string, priority: number, when: (w: World, sc: SchemeState) => boolean): SchemeAction => ({
      id, label: `Flush the ${PIPE_NAME[pipe]} pipe`, hint: "", priority,
      can: (w, pc, sc) => (sc.vars[`in_${pipe}`] && at(w, pc, sc) && when(w, sc) ? null : "no"),
      run: (w, pc, sc) => { const d = plantWatched(w); if (d) return seen(w, pc, d, sc); flush(w, pc, sc, pipe); },
    });
    out.push(fl(`flush_${pipe}`, 0, (w, sc) => !(pipe === "home" && mistake(w, sc))));
    if (pipe === "home") out.push(fl("unflush_home", 79, mistake));
  }
  return out;
}

/** What pressing it will do, for the line over the button (outcomes.ts). Null: not one of this file's. */
export function specialHint(w: World, pc: Actor, arg: string | undefined): string | null {
  const [sid, aid] = (arg ?? "").split(":");
  if (sid !== "special") return null;
  const watched = !!plantWatched(w), no = "Not while the drayman's looking.";
  const put = /^put_(home|away)(?:_(\d))?$/.exec(aid), fl = /flush_(home|away)$/.exec(aid);
  if (put) {
    const pipe = put[1] as Pipe, tk = put[2] ? TOKENS[Number(put[2]) - 1] : TOKENS[tokenIdx(offerable(w, pc)[0]) - 1], side = sideName(w, teamOf(pipe));
    if (!tk) return "";
    const st = tk[pipe];
    if (watched) return `${side} drink the ${tk.name}. ${no}`;
    return `${side} drink the ${tk.name}. ${WORD[st]} ${tk.whole ? "all match" : "till half-time"}.${st === "hyper" ? " Wired men foul." : ""}`;
  }
  if (watched) return no;
  if (fl) return "It comes back out. Nobody drinks it.";
  return DEF.actions.find((a) => a.id === aid)?.hint ?? "";
}

/** While a token's in his hand: where it would go (itemhelp.ts lights these up). */
export function specialTargets(w: World, pc: Actor, it: Item): { x: number; y: number; label: string }[] {
  const sc = w.state.stadium!.schemes?.special;
  if (!sc || !DEF.on() || !sc.clues.pipes || !tokenIdx(it)) return [];
  const sp = plantSpots();
  // One place, and not once he's stood at it (the button says it there): their pipe, until they've had a drink.
  if (dist(pc, sp.front) < 3.5) return [];
  return [sc.vars.done_away && !sc.vars.in_home ? { ...sp.atHome, label: "The HOME pipe" } : { ...sp.atAway, label: "The VISITORS pipe" }];
}

export interface PipeView { token: string; name: string; since: number; due: number; stamped: boolean }
/** The plant as the view needs it: what's in each pipe and since when, what each far end last got, the crate. */
export function plantView(w: World): { on: boolean; known: boolean; crate: number; watched: boolean; pipes: Record<Pipe, PipeView | null>; got: Record<Pipe, string> } | null {
  const sc = w.state.stadium?.schemes?.special;
  if (!sc || !DEF.on()) return null;
  const tick = w.state.tick;
  const pv = (p: Pipe): PipeView | null => { const i = sc.vars[`in_${p}`]; return i ? { token: TOKENS[i - 1].def, name: TOKENS[i - 1].name, since: (tick - sc.vars[`at_${p}`]) / 60, due: (sc.vars[`due_${p}`] - tick) / 60, stamped: tick - sc.vars[`at_${p}`] >= STAMP_SECS * 60 } : null; };
  const got = (p: Pipe) => (sc.vars[`got_${p}`] ? TOKENS[sc.vars[`got_${p}`] - 1].def : "");
  return { on: true, known: !!sc.clues.pipes, crate: sc.vars.crate ?? 0, watched: !!plantWatched(w), pipes: { home: pv("home"), away: pv("away") }, got: { home: got("home"), away: got("away") } };
}

// ---------------------------------------------------------------- the scheme

/** Home Advantage is dealt once the first plan's done (missions ask `on()` with no world to look at). */
let homeOpen = false;
const looseKeg = (w: World): P | null => {
  const lx = mx(-30.1), it = Object.values(w.state.items).find((i) => i.def === "keg" && i.home && Math.abs(i.home.x - lx) < 0.05 && i.loc.k === "ground");
  return it && it.loc.k === "ground" ? { x: it.loc.x, y: it.loc.y } : null;
};

const DEF: SchemeDef = {
  id: "special", title: "The Visitors' Special",
  on: () => PACE.calm,
  clues: [
    { id: "pipes", note: "The VISITORS pipe runs to their drinks. The HOME pipe runs to ours.", mutter: "Useful." },
    { id: "any", note: "The machine takes anything. It doesn't ask.", mutter: "" },
    { id: "wrong", note: "The lever spits it back out, till the drinks are served.", mutter: "" },
    { id: "filth", note: "Feed Ronson and he leaves something behind. The machine takes that too.", mutter: "" },
  ],
  conds: [],
  actions: actions(),
  variants: [],
  init: (w, sc) => {
    const s = w.state, opp = sideName(w, 1);
    sc.vars.crate = 1;
    homeOpen = false;
    // Where the other tokens are sold (the free one's in the crate by the plant; the filth is Ronson's).
    SHOPS.pub.stock.rocket_tonic = 4; SHOPS.kiosk.stock.rocket_tonic = 4; SHOPS.kiosk.stock.dodgy_electrolytes = 3;
    SHOPS.charity.stock.sleepy_syrup = 5; SHOPS.surplus.stock.dodgy_electrolytes = 6; SHOPS.dealer.stock.sleepy_syrup = 10;
    w.bus.on((e: any) => { const d = drayman(w); if (e.type === "post_left" && d && e.by === d.id && !sc.vars.away) sc.vars.away = s.tick; });
    missions(opp);
  },
  step: (w, sc) => {
    const s = w.state, st = s.stadium!, tick = s.tick, pc = s.actors[st.pc], m = s.match;
    if (!pc) return;
    sc.vars.off = m?.phase === "finished" ? 1 : 0;
    homeOpen = specialDone(w);
    if (homeOpen && !sc.vars.homeFrom) sc.vars.homeFrom = st.missions!.done.special;
    // The first two steps: he's had a look at the man with the kegs; the man's stopped minding his yard.
    const d = drayman(w), keg = looseKeg(w);
    // (Close enough to have gone over for a look: the coach drops him four metres from the man.)
    if (!sc.vars.seen && ((d && !d.hiddenIn && dist(pc, d) < 2.6) || (keg && dist(pc, keg) < 3.2))) sc.vars.seen = tick;
    if (!sc.vars.away && (!d || d.hiddenIn || d.npc!.fetch || d.downUntil > tick)) sc.vars.away = tick;
    if (d?.npc!.fetch) sc.vars.fuss = tick + 60 * FUSS_SECS;

    // The drinks go out.
    for (const p of PIPES) if (sc.vars[`in_${p}`] && tick >= sc.vars[`due_${p}`] && !sc.vars.off) serve(w, sc, p);
    // Half-time: what only lasts a half has worn off.
    if (m?.phase === "break" && m.period === 1 && !sc.vars.brk) {
      sc.vars.brk = tick;
      for (const p of PIPES) if (sc.vars[`half_${p}`] && sc.vars[`got_${p}`]) {
        const i = sc.vars[`got_${p}`];
        clearState(w, stateOf(p, i), teamOf(p)); sc.vars[`got_${p}`] = 0; sc.vars[`half_${p}`] = 0;
        w.bus.emit({ type: "scheme_news", t: tick, scheme: "special", text: `HALF-TIME: THE ${TOKENS[i - 1].name.toUpperCase()} HAS WORN OFF ${sideName(w, teamOf(p)).toUpperCase()}` });
      }
    }
    // He's in the ground before kick-off with their drinks already served: the big screen shows him his work.
    if (sc.vars.got_away && sc.vars.tv !== sc.vars.served_away && m?.phase === "pre" && inGround(w) && tick > sc.vars.served_away + 60 * 4) { const id = stateOf("away", sc.vars.got_away); if (SCREEN[id]) screen(w, sc, id); else sc.vars.tv = sc.vars.served_away; }

    // What he says once the cut's over.
    if (sc.vars.lineAt && tick >= sc.vars.lineAt) {
      w.bus.emit({ type: "scheme_line", t: tick, text: sc.vars.line === 1 ? "Heh heh heh." : sc.vars.line === 2 ? "...Wrong pipe. That's ours." : "Get that down you, lads." });
      sc.vars.lineAt = 0;
    }

    // Ronson, fed, leaves something where he ate. The machine takes anything.
    const dg = st.dog, dog = dg ? s.actors[dg.id] : undefined;
    if (dg && dog && (dg.eatUntil ?? 0) > tick && sc.vars.ate !== dg.eatUntil && (sc.vars.filths ?? 0) < 3) { sc.vars.ate = dg.eatUntil!; sc.vars.filthAt = dg.eatUntil! + 60 * 5; }
    if (sc.vars.filthAt && tick >= sc.vars.filthAt && dog) {
      sc.vars.filthAt = 0; sc.vars.filths = (sc.vars.filths ?? 0) + 1;
      const it = spawnItem(s, "ronson_filth", { k: "ground", x: dog.x - 0.5, y: dog.y + 0.3 });
      if (dist(pc, dog) < 14) learn(w, DEF, sc, "filth", true);
      w.bus.emit({ type: "special_filth", t: tick, item: it.id, x: dog.x, y: dog.y });
    }
  },
  things: (w, sc) => {
    const out: Thing[] = [], sp = plantSpots(), tick = w.state.tick;
    if (sc.vars.off) return out;
    const live = PIPES.filter((p) => sc.vars[`in_${p}`]).sort((a, b) => sc.vars[`due_${a}`] - sc.vars[`due_${b}`]);
    // One short board, and only when it has something to say that the button doesn't: when what's loaded is
    // served; or, once the free tin's gone and his hands are empty, what else the thing will take.
    let board: string | undefined;
    if (live.length) board = `${live.length > 1 ? "BOTH PIPES" : PIPE_NAME[live[0]]} · SERVED IN ${mmss(sc.vars[`due_${live[0]}`] - tick)}`;
    else if (sc.clues.pipes && !sc.vars.crate && !holding(w)) board = "ALSO TAKES SYRUP, POWDER, WORSE";
    out.push({ x: sp.cx, y: sp.y1, z: 2.5, board, mark: sc.clues.pipes ? (live.length ? "loaded" : "takes anything") : "the drayman minds it" });
    if (!sc.clues.pipes) return out;
    // Where the other tokens are, for a man who goes looking (Instinct).
    const who = (f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => a.npc && !a.dead && f(a));
    for (const [shop, label] of [["pub", "Rocket Tonic, £4"], ["charity", "Sleepy Syrup, £5"], ["surplus", "Dodgy Electrolytes, £6"]] as const) { const a = who((q) => q.npc!.shop === shop); if (a) out.push({ x: a.x, y: a.y, z: 1.9, mark: label }); }
    const dg = w.state.stadium!.dog, dog = dg ? w.state.actors[dg.id] : undefined;
    if (dog && !(sc.vars.filths ?? 0)) out.push({ x: dog.x, y: dog.y, z: 1.1, mark: "feed him. Then wait" });
    return out;
  },
};

// ---------------------------------------------------------------- the two missions

const holding = (w: World) => { const pc = pcOf(w); return !!pc && carried(w, pc).some((i) => tokenIdx(i)); };
function missions(opp: string): void {
  defineMission({
    id: "special", scheme: "special", title: "The Visitors' Special",
    goal: `Make ${opp}'s drinks less refreshing.`,
    buys: `${opp} play on whatever went in their pipe.`,
    zone: "out", rank: 1, on: () => PACE.calm,
    stages: [
      { text: "See what that idiot with the kegs is doing", done: (_w, sc) => !!sc?.vars.seen,
        where: (w) => { const d = drayman(w); return d && !d.hiddenIn ? { x: d.x, y: d.y } : looseKeg(w); } },
      // (Pointed just north of the keg: right on top of it he's also on top of the drayman's hose.)
      { text: "Roll the loose keg", done: (_w, sc) => !!sc?.vars.away, where: (w) => { const k = looseKeg(w); return k ? { x: k.x, y: k.y - 1 } : null; } },
      // (All three at the visitors' hatch: he walks to it once, and the wrong pipe is a walk away.)
      { text: "While he's gone, look at the pipes", done: (_w, sc) => !!sc?.clues.pipes, where: () => plantSpots().atAway },
      { text: "Take a Rocket Tonic, or find something worse", done: (w, sc) => holding(w) || !!sc?.vars.put_away, where: (_w, sc) => (sc?.vars.crate ? plantSpots().atAway : null) },
      { text: "Put it in the VISITORS pipe", done: (_w, sc) => !!sc?.vars.put_away, where: () => plantSpots().atAway },
      { text: "Watch what it does to them", done: (_w, sc) => !!sc?.vars.done_away, where: (_w, sc) => (sc?.vars.in_away || sc?.vars.done_away ? null : plantSpots().atAway) },
    ],
    over: (w) => w.state.match?.phase === "finished",
    with: {
      bribe: "Wired, they foul. A paid referee sees every one.",
      referee: "Wired men foul. Somebody in black has to book them.",
      visitors: "The keg does their captain. The pipe does the other ten.",
      home: "One side slowed down, the other wound up.",
    },
  });
  defineMission({
    id: "home", scheme: "special", title: "Home Advantage",
    goal: "Put something in England's drinks.",
    buys: "England play on whatever went in. It can go wrong.",
    zone: "out", rank: 6, on: () => PACE.calm && homeOpen,
    stages: [
      { text: "Find something for England's drinks", done: (w, sc) => holding(w) || (sc?.vars.put_home ?? 0) > (sc?.vars.homeFrom ?? 0) },
      { text: "Put it in the HOME pipe", done: (_w, sc) => (sc?.vars.put_home ?? 0) > (sc?.vars.homeFrom ?? 0), where: () => plantSpots().atHome },
      { text: "Wait for England's drinks to be served", done: (_w, sc) => (sc?.vars.served_home ?? 0) > (sc?.vars.homeFrom ?? 0) },
    ],
    over: (w) => w.state.match?.phase === "finished",
    with: {
      bribe: "A wired side fouls. Unless the referee isn't looking.",
      referee: "Wired men foul. Not if you're the one with the whistle.",
      special: "One side wound up, the other slowed down.",
    },
  });
}

export function installSpecial(): void { defineScheme(DEF); }

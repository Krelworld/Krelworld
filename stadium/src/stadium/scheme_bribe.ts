// A WORD IN HIS EAR. An authored scheme, on at every ground.
//
// Money's always been offerable (the bribe sheet, rules.ts), and it's always been a toss of a coin. This is
// who the coin was never needed for. Three men at every match are skint, each known to somebody who'd know:
//   THEIR KEEPER         pawned his watch at Cash Kings and owes half the bookies in town (Lionel). A hundred.
//                        He's on the phone to one of them in the far corner of the hotel lobby till the coach goes;
//   THE REFEREE          three ex-wives and a boat (Dodgy Del). A hundred and fifty. He has a fag in the mouth of
//                        the tunnel before kick-off;
//   THE FOURTH OFFICIAL  forty quid a match to hold a board up (the cleaner lent him a tenner). Twenty. Pre-match
//                        nerves: he's in the gents on the concourse.
// Three things are counted the moment the money's held out, however it was come by (pawned, lifted, won):
//   THE MAN     one of those three. Anyone else is honest, shouts the place down, and Grozz is wanted;
//   THE MONEY   his price. Short of it he says what he'd want, as an insult, and can be asked again;
//   ALONE       none of his own lot, no steward and no copper in earshot. In company he says "Not here."
//               and looks at whoever's listening: get him on his own, or get them gone, and ask again.
// All three, and he takes it. What that changes is what the old bribe always changed (the keeper lets them
// in, the referee leans England's way); the scene is kept for the first moment it shows: the first shot on
// that keeper's goal (and his watch is out of Lionel's window by then: the money stays in the world), the
// referee's first call that could have gone either way. The fourth official's payoff is what he stops doing.
// For the other schemes to read (schemeState(w, "bribe")?.vars); 1 once he's been paid, never unset:
//   keeperPaid   their goalkeeper (his fb.bribed is true as well);
//   refPaid      the referee (his off.bias leans to England as well);
//   fourthPaid   the fourth official: he's stopped counting heads at restarts, and if two referees are
//                arguing he backs the one who paid him. (`fourth` is the same flag under its older name.)
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { dispatch } from "../core/verbs";
import { AREAS, PACE, SPOTS, VENUE } from "./layout";
import { lineOfSight } from "./nav";
import { say as say0 } from "./npc";
import { bribeFix } from "./rules";
import { alert, isSecurity } from "./security";
import { theirKeeper } from "./fixes";
import { linkCause, rootCause } from "./cause";
import { defineScheme, learn, play, schemeState, type Beat, type SchemeDef, type SchemeState, type Thing } from "./schemes";

type P = { x: number; y: number };
const KEEPER = 1, REF = 2, FOURTH = 3, EAR = 6;
const PRICE = [100, 100, 150, 20], PAID = ["", "keeperPaid", "refPaid", "fourthPaid"], CLUE = ["", "keeper", "ref", "fourth"], NAME = ["", "their keeper", "the referee", "the fourth official"];
const SRC = ["cash", "pawned", "lifted", "won"];
const say = (w: World, a: Actor | undefined, text: string, secs = 3): void => { if (!a?.npc) return; say0(w, a, text, secs); a.npc.told = w.state.tick + Math.round(secs * 60); };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const tr = (pt: string, es: string) => (VENUE.opp === "ARG" ? es : pt);
const pcOf = (w: World) => w.state.actors[w.state.stadium!.pc];
const who = (w: World, f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => a.npc && !a.dead && f(a));
const men = (w: World): (Actor | undefined)[] => { const m = w.state.match!; return [undefined, theirKeeper(w), w.state.actors[m.officials.referee], w.state.actors[m.officials.fourth]]; };
const bent = (w: World, a: Actor | undefined) => (a ? Math.max(0, men(w).findIndex((x) => x?.id === a.id)) : 0);
const up = (w: World, a: Actor | undefined): a is Actor => !!a && !a.dead && a.downUntil <= w.state.tick && !a.hiddenIn && !a.heldBy && a.fb?.status !== "gone" && !a.off?.incapacitated;
/** Who'd hear it said: his own lot, a steward, a copper. A few yards, and not through a wall. */
const ears = (w: World, a: Actor): Actor[] => Object.values(w.state.actors)
  .filter((o) => o.id !== a.id && o.id !== w.state.stadium!.pc && !o.dead && !o.hiddenIn && o.downUntil <= w.state.tick && dist(o, a) < EAR && (isSecurity(o) || (a.fb ? !!o.fb && o.fb.team === a.fb.team && o.fb.status !== "gone" : !!o.off)) && lineOfSight(o.x, o.y, a.x, a.y))
  .sort((p, q) => dist(p, a) - dist(q, a));
/** One of the three Grozz knows about, not yet paid, within arm's reach. */
const reach = (w: World, sc: SchemeState) => { const pc = pcOf(w); return men(w).find((a, i) => i > 0 && up(w, a) && !!pc && !!sc.clues[CLUE[i]] && !sc.vars[PAID[i]] && dist(a, pc) < 3); };
const manOf = (w: World, sc: SchemeState) => (sc.vars.man ? men(w)[sc.vars.man] : w.state.actors[w.state.match!.teams[1].squad[sc.vars.who]]);
const mate = (w: World, sc: SchemeState) => { const t = manOf(w, sc); return t ? w.state.match!.teams[1].squad.map((id) => w.state.actors[id]).filter((a) => a?.fb?.status === "playing" && a.id !== t.id).sort((p, q) => dist(p, t) - dist(q, t))[0] : undefined; };
const sg = () => Math.sign(SPOTS.hotelLobby.x) || 1;
/** Where each of them is to be found on his own before kick-off. */
const CORNER = (): P => ({ x: SPOTS.hotelLobby.x + 5 * sg(), y: SPOTS.hotelLobby.y - 12 });
const FAG = (): P => ({ x: SPOTS.tunnelTop.x + 1.1, y: SPOTS.tunnelTop.y - 1.4 });
const GENTS = (): P => { const a = AREAS.find((x) => x.id === "toilet_s"); return a ? { x: a.x + a.w * 0.56, y: a.y + 1.6 } : SPOTS.refRoom; };
const news = (w: World, text: string) => w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: "bribe", text });
const mutter = (w: World, text: string) => w.bus.emit({ type: "scheme_line", t: w.state.tick, text });
const has = (sc: SchemeState, id: string) => !!sc.met[id];
const at: Beat["at"] = (w, sc) => { const a = manOf(w, sc) ?? pcOf(w); return { x: a?.x ?? 0, y: a?.y ?? 0 }; };
const me: Beat["at"] = (w) => pcOf(w) ?? { x: 0, y: 0 };
const B = (secs: number, where: Beat["at"], go?: Beat["go"], o: Partial<Beat> = {}): Beat => ({ secs, at: where, go, cut: true, ...o });

function know(w: World, sc: SchemeState, id: string, quiet = false): void { learn(w, DEF, sc, id, quiet); if (CLUE.includes(id)) learn(w, DEF, sc, "bent", true); }
/** A line a man says to nobody while Grozz is in earshot: how the scheme's parts are found out. */
function aside(w: World, sc: SchemeState, key: string, a: Actor | undefined, lines: [string, string][]): void {
  const s = w.state, pc = pcOf(w), n = sc.vars[`n_${key}`] ?? 0;
  if (!a?.npc || !pc || n >= lines.length || dist(a, pc) > 7 || pc.hiddenIn || s.tick < (sc.vars.hush ?? 0) || (a.npc.bubble && a.npc.bubble.until > s.tick) || a.npc.mode !== "routine") return;
  say(w, a, lines[n][0], 4.2);
  sc.vars[`n_${key}`] = n + 1; sc.vars.hush = s.tick + 60 * 14;
  know(w, sc, lines[n][1]);
}
/** Stood where he stands before kick-off (the team walk leaves a staged man be). */
function post(w: World, a: Actor, p: P, face: number): void {
  if (dist(a, p) > 0.3) { a.x = p.x; a.y = p.y; a.vx = a.vy = 0; if (a.fb) { a.fb.tx = p.x; a.fb.ty = p.y; } }
  a.facing = face; a.npc!.staged = w.state.tick + 90;
}
/** The conditions as they stood when the money was held out (or as they stood when it was taken, for a payoff kept till later). */
function count(w: World, sc: SchemeState, man: number, cash: boolean, alone: boolean, t: Actor): void {
  Object.assign(sc.vars, { offer: w.state.tick, man, who: w.state.match!.teams[1].squad.indexOf(t.id), cash: cash ? 1 : 0, alone: alone ? 1 : 0 });
  for (const c of DEF.conds) sc.met[c.id] = c.test(w, sc);
}
/** It gets to a steward the way a grass's shout does (witness.ts): the nearest couple come for him. */
function tell(w: World, from: Actor | undefined): void {
  const s = w.state, pc = pcOf(w), o = from ?? pc;
  if (!pc) return;
  const near = Object.values(s.actors).filter((g) => isSecurity(g) && !g.dead && g.downUntil <= s.tick && !g.hiddenIn && dist(g, o) < 45).sort((p, q) => dist(p, o) - dist(q, o)).slice(0, 2);
  for (const g of near) { alert(w, g, pc, 2, 1.6); g.npc!.lastSeen = { x: pc.x, y: pc.y, t: s.tick }; }
  if (near[0]) w.bus.emit({ type: "crime_reported", t: s.tick, by: from?.id, who: pc.id, to: near[0].id });
}

/** The money's held out (rules.ts asks before it tosses its coin). */
function judge(w: World, by: Actor, t: Actor, amount: number): "take" | "refuse" | "done" | undefined {
  const s = w.state, sc = schemeState(w, "bribe"), man = bent(w, t);
  if (!sc || !DEF.on() || by.id !== s.stadium!.pc || (!man && (sc.variant || t.fb?.team !== 1))) return undefined;
  if (sc.variant) { say(w, t, "Give me a minute, will you."); return "done"; }
  if (man && sc.vars[PAID[man]]) { say(w, t, "You've had what you paid for. Hop it."); return "done"; }
  const ear = ears(w, t)[0];
  count(w, sc, man, amount >= PRICE[man], !ear, t);
  // An honest man: the old refusal, and then he makes sure everybody knows.
  if (!man) { play(w, DEF, sc, t); return "refuse"; }
  know(w, sc, CLUE[man], true);
  if (ear) {
    t.facing = Math.atan2(ear.y - t.y, ear.x - t.x); say(w, t, "Not here.", 2.6);
    if (ear.npc && isSecurity(ear)) ear.npc.sus[by.id] = Math.max(ear.npc.sus[by.id] ?? 0, 0.6);
    play(w, DEF, sc, t); return "done";
  }
  if (amount < PRICE[man]) {
    say(w, t, ["", "For that? I wouldn't let in a throw-in. A hundred.", "For that? I'd not add on a minute. One-fifty.", "For that? I'd not hold the board up straight. Twenty."][man], 4);
    play(w, DEF, sc, t); return "done";
  }
  sc.vars[PAID[man]] = 1;
  sc.cause = sc.cause || rootCause(w, "A WORD IN HIS EAR", t, "authored");
  linkCause(w, sc.cause, `${NAME[man].toUpperCase()} TAKES THE MONEY`, t, "authored");
  if (man !== FOURTH) { sc.vars.offer = 0; return "take"; } // rules.ts does what it always did; the scene's for when it shows
  by.money -= amount; t.money += amount; sc.vars.fourth = 1;
  say(w, t, "Ta. I've gone blind in one eye. You choose which.", 4);
  w.bus.emit({ type: "bribed", t: s.tick, by: by.id, who: t.id, amount });
  play(w, DEF, sc, t); return "done";
}
/** A payoff that was kept back: the first moment it shows. */
function show(w: World, sc: SchemeState, man: number): boolean {
  const t = men(w)[man];
  if (sc.variant || !up(w, t)) return false;
  count(w, sc, man, true, true, t);
  play(w, DEF, sc, t);
  return !!sc.variant;
}

const DEF: SchemeDef = {
  id: "bribe", title: "A word in his ear",
  on: () => PACE.calm,
  clues: [
    { id: "bent", note: "One or two men in football are for sale. Most aren't.", mutter: "" },
    { id: "keeper", note: "Their keeper's pawned his watch. He owes half the bookies in town.", mutter: "Skint. A keeper." },
    { id: "ref", note: "The referee's got three ex-wives and a boat.", mutter: "A boat." },
    { id: "fourth", note: "The fourth official's on forty quid. He borrows off the cleaner.", mutter: "" },
    { id: "honest", note: "Ask an honest one and he screams the place down.", mutter: "" },
    { id: "quiet", note: "Never in company. He's got to be on his own.", mutter: "On his own, then." },
    { id: "price", note: "A board-holder's twenty. A keeper's a ton. A referee's one-fifty.", mutter: "" },
    { id: "watch", note: "The keeper's watch is out of Lionel's window. Paid cash.", mutter: "My cash." },
  ],
  conds: [
    { id: "man", clue: "bent", known: "A man who'd take it is within reach.", unknown: "Who'd take it?",
      test: (w, sc) => (sc.vars.offer ? NAME[sc.vars.man] : NAME[bent(w, reach(w, sc))]) },
    { id: "cash", clue: "price", known: "He's carrying what it costs.", unknown: "What does a man like that cost?",
      test: (w, sc) => { const r = reach(w, sc); return (sc.vars.offer ? sc.vars.cash : r && pcOf(w).money >= PRICE[bent(w, r)]) ? SRC[sc.vars.src ?? 0] : ""; } },
    { id: "alone", clue: "quiet", known: "Nobody else is listening.", unknown: "Where do you say a thing like that?",
      test: (w, sc) => { const r = reach(w, sc); return (sc.vars.offer ? sc.vars.alone : r && !ears(w, r).length) ? "alone" : ""; } },
  ],
  actions: [
    // The sheet doesn't offer a fourth official money (nobody ever thought to); he takes it the same way.
    { id: "bung", label: "Slip the fourth official a note", hint: "Forty quid a match. Nobody pays him to count.", priority: 44,
      can: (w, pc, sc) => { const f = men(w)[FOURTH]; return !sc.variant && !sc.vars.fourthPaid && pc.money > 0 && up(w, f) && dist(pc, f) < 2.2 ? null : "no"; },
      run: (w, pc) => { dispatch(w, { verb: "bribe", actor: pc.id, target: { k: "actor", id: men(w)[FOURTH]!.id }, amount: Math.min(pc.money, PRICE[FOURTH]) }); } },
  ],
  variants: [
    // The first shot on his goal. He goes the other way, with feeling, and then he looks at the time.
    { id: "keeper", when: (sc) => has(sc, "man") && has(sc, "cash") && has(sc, "alone") && sc.vars.man === KEEPER, beats: [
      B(2.4, at, undefined, { caption: "MEANWHILE: IN THEIR GOAL", link: "THE FIRST SHOT ON HIS GOAL" }),
      B(2.6, at, (w, sc) => {
        const k = manOf(w, sc), pc = pcOf(w); if (!k) return;
        if (pc) k.facing = Math.atan2(pc.y - k.y, pc.x - k.x);
        say(w, k, sc.vars.goal ? `(looks at his ${sc.vars.watch ? "watch" : "bare wrist"}) ${tr("Ui. Já é tão tarde?", "Uy. ¿Ya es tan tarde?")}` : `(looks at the stand) ${tr("Calma! Estou a tentar!", "¡Tranquilo! ¡Lo intento!")}`);
        if (sc.cause) linkCause(w, sc.cause, sc.vars.goal ? "HE DIVES THE WRONG WAY AND CHECKS HIS WATCH" : "HE DOES HIS BEST TO LET IT IN. IT WON'T GO", k, "authored");
      }),
      B(2.6, at, (w, sc) => say(w, mate(w, sc), sc.vars.goal ? tr("Estavas a ver as HORAS?!", "¿Estabas mirando la HORA?!") : tr("Com quem estás a falar, pá?", "¿Con quién hablás, che?"))),
      { secs: 3, at: me, go: (w, sc) => { sc.vars.result = sc.vars.goal ? 3 : 1; mutter(w, sc.vars.goal ? "Money well spent." : "I paid for that, you tart."); news(w, sc.vars.goal ? "THEIR KEEPER SAYS HE WAS UNSIGHTED. BY WHAT, HE CAN'T SAY." : "THEIR KEEPER HAS APOLOGISED. NOBODY KNOWS WHO TO."); } },
    ] },
    // The first call that could have gone either way.
    { id: "referee", when: (sc) => has(sc, "man") && has(sc, "cash") && has(sc, "alone") && sc.vars.man === REF, beats: [
      B(2.4, at, (w, sc) => say(w, manOf(w, sc), sc.vars.call === 2 ? "Free kick, England. Don't look at me like that." : "Play on! He slipped! Onto an elbow!"), { caption: "MEANWHILE: THE MAN IN THE MIDDLE", link: "THE REFEREE SEES IT ENGLAND'S WAY" }),
      B(2.6, at, (w, sc) => say(w, mate(w, sc), tr("Árbitro! Isso foi um COTOVELO!", "¡Árbitro! ¡Eso fue un CODO!"))),
      B(2.4, at, (w, sc) => say(w, manOf(w, sc), "I saw what I saw. And I saw nothing.")),
      { secs: 3, at: me, go: (w, sc) => { sc.vars.result = 3; mutter(w, "Lovely. He can keep the boat."); news(w, "THE REFEREE IS HAVING WHAT HE CALLS ONE OF THOSE DAYS."); } },
    ] },
    // What he does from now on is nothing. It's there for anyone who needs him not to be looking.
    { id: "fourth", when: (sc) => has(sc, "man") && has(sc, "cash") && has(sc, "alone"), beats: [
      { secs: 1.6, at },
      { secs: 3.2, at, link: "THE FOURTH OFFICIAL STOPS COUNTING", go: (w, sc) => say(w, manOf(w, sc), "Eleven? Twelve? I just hold the board, me.", 3.2) },
      { secs: 2.4, at: me, go: (w, sc) => { sc.vars.result = 2; mutter(w, "Cheapest man in football."); } },
    ] },
    // In company: a look, and no more. (He can be asked again.)
    { id: "nothere", when: (sc) => has(sc, "man") && !has(sc, "alone"), beats: [{ secs: 2.4, at, go: (w, sc) => { know(w, sc, "quiet"); } }] },
    // Not enough: he's said what he'd want. (And again.)
    { id: "short", when: (sc) => has(sc, "man"), beats: [{ secs: 2.6, at, go: (w, sc) => { know(w, sc, "price"); mutter(w, "Cheeky sod."); } }] },
    // The wrong man.
    { id: "honest", when: (sc) => !!sc.vars.offer, beats: [
      { secs: 1.6, at },
      { secs: 3.2, at, link: "HE ASKS THE WRONG MAN", go: (w, sc) => { const t = manOf(w, sc); say(w, t, tr("SEGURANÇA! Este gordo quer comprar-me!", "¡SEGURIDAD! ¡Este gordo me quiere comprar!"), 3.2); tell(w, t); } },
      { secs: 2.6, at: me, go: (w, sc) => { sc.vars.result = -2; know(w, sc, "honest"); mutter(w, "An honest footballer. Of all the luck."); news(w, "STEWARDS: LOOK OUT FOR A LARGE MAN WITH AN ENVELOPE."); } },
    ] },
    { id: "none", when: () => true, beats: [] },
  ],
  init: (w) => {
    bribeFix.judge = judge;
    w.bus.on((e: any) => {
      const s = w.state, sc = s.stadium ? schemeState(w, "bribe") : undefined;
      if (!sc) return;
      if (e.type === "say" && /pawning his watch/.test(e.text ?? "")) know(w, sc, "keeper", true); // Lionel, asked
      if (e.type === "pawned") sc.vars.src = 1; else if (e.type === "stole" && e.what === "cash") sc.vars.src = 2; else if (e.type === "fruit" && e.win) sc.vars.src = 3;
      if (e.type === "fb_goal" && e.team === 0 && sc.vars.shot && s.tick - sc.vars.shot < 60 * 6) sc.vars.goal = 1;
      if (e.type === "fb_shot" && e.team === 0 && sc.vars.keeperPaid && !sc.vars.keeperShown) { sc.vars.shot = s.tick; sc.vars.goal = 0; if (show(w, sc, KEEPER)) sc.vars.keeperShown = 1; }
      if (((e.type === "fb_foul_missed" && e.team === 0) || (e.type === "fb_foul" && e.team === 1)) && sc.vars.refPaid && !sc.vars.refShown) { sc.vars.call = e.type === "fb_foul" ? 2 : 1; if (show(w, sc, REF)) sc.vars.refShown = 1; }
    });
  },
  step: (w, sc) => {
    const s = w.state, st = s.stadium!, m = s.match!, tick = s.tick, pc = pcOf(w), [, k, ref, fo] = men(w), bus = st.vehicles.bus;
    if (!pc) return;
    // Every payoff but the last leaves the others still for sale.
    if (sc.done) { sc.variant = undefined; sc.done = false; sc.beat = undefined; sc.vars.offer = 0; }
    // Where each of them is before kick-off, on his own, and what he says to himself there.
    if (m.phase !== "pre" || (m.phaseUntil - tick) / 60 <= 80) sc.vars.out = 1; // once they've gone to line up they don't come back, however late it kicks off
    const early = !sc.vars.out;
    if (up(w, k) && m.phase === "pre" && bus?.state === "parked" && !st.flags.busArrived && !st.flags.awayOnFoot) { post(w, k, CORNER(), -Math.PI / 2); aside(w, sc, "gk", k, [["Next week. On my mother's life. Next week!", "keeper"]]); }
    if (up(w, ref) && early) { post(w, ref, FAG(), Math.PI / 2); aside(w, sc, "ref", ref, [["Boat wants a new engine. Boats always do.", "ref"]]); }
    if (up(w, fo) && early) { post(w, fo, GENTS(), -Math.PI / 2); aside(w, sc, "fo", fo, [["Forty quid a match. Forty. To hold a board up.", "fourth"]]); }
    // And what's said about them by people who'd know.
    const lionel = who(w, (a) => a.npc!.shop === "pawn");
    aside(w, sc, "lion", lionel, [["Their keeper's watch is in my window. Likes a bet, him.", "keeper"], ["Mind who you ask. An honest one screams the place down.", "honest"]]);
    aside(w, sc, "del", who(w, (a) => a.npc!.shop === "tout"), [["That ref? Three ex-wives and a boat. He takes offers.", "ref"], ["Never in company, mind. Get your man on his own.", "quiet"]]);
    aside(w, sc, "mop", who(w, (a) => a.npc!.job === "cleaner"), [["Fourth official tapped me for a tenner. Me. A cleaner.", "fourth"]]);
    // The money stays in the world: the first thing a paid keeper does with it is get his watch back.
    if (sc.vars.keeperPaid && !sc.vars.watch && k && lionel && k.money >= 60) { k.money -= 60; lionel.money += 60; sc.vars.watch = 1; if (sc.cause) linkCause(w, sc.cause, "HIS WATCH COMES OUT OF CASH KINGS", lionel, "authored"); }
    if (sc.vars.watch) aside(w, sc, "watch", lionel, [["He's been in. Paid cash. Wouldn't say where from.", "watch"]]);
  },
  things: (w, sc) => {
    const out: Thing[] = [], pre = w.state.match!.phase === "pre", r = reach(w, sc), e = r && sc.clues.quiet ? ears(w, r)[0] : undefined;
    men(w).forEach((a, i) => { if (i && pre && up(w, a) && sc.clues[CLUE[i]] && !sc.vars[PAID[i]]) out.push({ x: a.x, y: a.y, z: 1.9, mark: ["", "on to his bookie", "a crafty fag", "pre-match nerves"][i] }); });
    if (e) out.push({ x: e.x, y: e.y, z: 1.9, mark: "in earshot" });
    return out;
  },
};

export function installBribe(): void { defineScheme(DEF); }

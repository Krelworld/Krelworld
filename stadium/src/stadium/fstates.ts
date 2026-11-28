// Football states (Option E). Plans don't script the match and the match doesn't know about plans. Between
// them is this small vocabulary: a plan writes a state ("Portugal are hyperaggressive", "the referee leans
// England's way"), the football reads the states and plays differently, and two states at once do more
// than either alone (the curated combinations below, not everything-times-everything). England can still
// lose with every state in their favour.
//
// Keep the vocabulary small. A new state needs a visible behaviour on the pitch, a badge, and a line of
// commentary, or it isn't one.
//
// How it reaches the football: every half second stepStates turns whatever is in force into a handful of
// plain numbers (football/types MatchMods) and hands them to the match. The players read those numbers and
// nothing else; the football never looks in here. With nothing in force there are no numbers, and the match
// plays exactly as it would if this file didn't exist.
import { appearance } from "../core/identity";
import { spawnItem } from "../core/items";
import { chance, rnd, rndRange } from "../core/rng";
import type { Actor, Id } from "../core/types";
import { spawnActor, type World } from "../core/world";
import { appointOfficials, recognise, setMods, unrecognised } from "../football/api";
import { periodSeconds } from "../football/match";
import { beginRestart } from "../football/restarts";
import type { Candidate, MatchMods, TeamMods } from "../football/types";
import { areaAt, PACE } from "./layout";
import { matchfx } from "./matchfx";
import { newNpc } from "./npc";
import { schemeState } from "./schemes";

export type TeamIdx = 0 | 1;
/** What a side can be. */
export type TeamStateId =
  | "hyper"       // lunging tackles, relentless press: wins loose balls, gives away fouls and cards
  | "lethargic"   // slow to recover, late runs
  | "confused"    // wrong runs, bad marking, bunching
  | "sick"        // men leaving the pitch at a run
  | "late"        // arrived late: no warm-up, shapeless for the first minutes
  | "kitchaos"    // wrong boots, wrong shirts: a man or two playing in something absurd
  | "motivated";  // sharper, celebrates everything, may get rash
/** What the officiating can be. */
export type RefStateId =
  | "biased"      // leans one way (team = the side he favours)
  | "none"        // no recognised referee on the pitch: THERE ARE NO MORE RULES
  | "grozz";      // Grozz is the referee
export type StateId = TeamStateId | RefStateId;

export interface FState {
  id: StateId; team?: TeamIdx; from: number; until: number; cause: string;
  /** The tick it first showed in play (the commentators say so once). */
  seen?: number;
  /** kitchaos: the men in the wrong boots. */
  who?: Id[];
}

export const STATE_INFO: Record<StateId, { short: string; long: (side: string) => string }> = {
  hyper: { short: "WIRED", long: (s) => `${s} are flying into everything.` },
  lethargic: { short: "SLEEPY", long: (s) => `${s} can barely lift their feet.` },
  confused: { short: "LOST", long: (s) => `${s} don't know where they're meant to be.` },
  sick: { short: "SICK", long: (s) => `${s} keep leaving at a run.` },
  late: { short: "LATE", long: (s) => `${s} got here late. No warm-up.` },
  kitchaos: { short: "WRONG KIT", long: (s) => `${s} are not wearing what they packed.` },
  motivated: { short: "UP FOR IT", long: (s) => `${s} are up for it.` },
  biased: { short: "BENT REF", long: (s) => `The referee leans ${s}' way.` },
  none: { short: "NO REF", long: () => "There is no referee. There are no more rules." },
  grozz: { short: "YOU'RE REF", long: () => "Grozz is the referee." },
};

/** What the commentators say the first time a state shows in play. Once each, and no more than this. */
const SEEN: Record<StateId, (side: string) => string> = {
  hyper: (s) => `${s} are flying into everything. Somebody has put something in something.`,
  lethargic: (s) => `${s} look like men who've had a big lunch and were promised a lie down.`,
  confused: (s) => `${s} appear to be playing three formations at once. None of them is this one.`,
  sick: (s) => `${s} do not look well. One of them keeps glancing at the tunnel.`,
  late: (s) => `${s} got here ten minutes ago. There was no warm-up, and you can tell.`,
  kitchaos: (s) => `Somebody in the ${s} side is wearing boots that are not his. Possibly not anyone's.`,
  motivated: (s) => `${s} look properly up for this. Somebody has had a word.`,
  biased: (s) => `The referee is giving ${s} the benefit of every doubt. And of several certainties.`,
  none: () => "There is no referee. Play continues, in the sense that nobody has stopped it.",
  grozz: () => "A new referee has come on. He is a considerably larger man than the last one.",
};

const list = (w: World): FState[] => (w.state.stadium!.fstates ??= []);

/** A plan writes a state. secs 0: for the rest of the match. Writing one that's already there extends it. */
export function setState(w: World, id: StateId, team: TeamIdx | undefined, secs: number, cause: string): void {
  const s = w.state, l = list(w), until = secs ? s.tick + Math.round(secs * 60) : Number.MAX_SAFE_INTEGER;
  const old = l.find((x) => x.id === id && x.team === team);
  if (old) { old.until = Math.max(old.until, until); return; }
  l.push({ id, team, from: s.tick, until, cause });
  w.bus.emit({ type: "fstate", t: s.tick, id, team, on: true, cause, short: STATE_INFO[id].short, text: STATE_INFO[id].long(sideName(w, team)) });
}
export function clearState(w: World, id: StateId, team?: TeamIdx): void {
  const l = list(w), i = l.findIndex((x) => x.id === id && x.team === team);
  if (i < 0) return;
  l.splice(i, 1);
  w.bus.emit({ type: "fstate", t: w.state.tick, id, team, on: false });
}
export function hasState(w: World, id: StateId, team?: TeamIdx): boolean {
  const t = w.state.tick;
  return (w.state.stadium!.fstates ?? []).some((x) => x.id === id && (team === undefined || x.team === team) && x.until > t && x.from <= t);
}
export const sideName = (w: World, team: TeamIdx | undefined): string => (team === undefined ? "" : team === 0 ? "England" : w.state.match?.teams[1].name ?? "They");

export interface Badge { id: StateId; team?: TeamIdx; short: string; text: string }
/** What's in force, for the scoreboard: one small badge each. */
export function badges(w: World): Badge[] {
  const t = w.state.tick;
  return (w.state.stadium!.fstates ?? []).filter((x) => x.until > t && x.from <= t).map((x) => ({ id: x.id, team: x.team, short: STATE_INFO[x.id].short, text: STATE_INFO[x.id].long(sideName(w, x.team)) }));
}

// ---------- Reading the world ----------
const find = (w: World, id: StateId, team?: TeamIdx): FState | undefined => { const t = w.state.tick; return (w.state.stadium!.fstates ?? []).find((x) => x.id === id && x.team === team && x.until > t && x.from <= t); };
const other = (t: TeamIdx): TeamIdx => (t === 0 ? 1 : 0);
const pcOf = (w: World): Actor | undefined => w.state.actors[w.state.stadium!.pc];
const refOf = (w: World): Actor | undefined => w.state.actors[w.state.match!.officials.referee];
/** The match is being played: a ball, two sides, and something for a referee to do. */
const inPlay = (w: World): boolean => { const m = w.state.match!; return (m.phase === "live" || m.phase === "restart" || m.phase === "goal_pause") && m.period <= 4; };
const fit = (w: World, a: Actor | undefined): boolean => !!a?.off && !a.dead && !a.hiddenIn && !a.off.incapacitated && a.downUntil <= w.state.tick;
/** The appointed referee is on his feet and on the job. */
const refFit = (w: World): boolean => fit(w, refOf(w));

/** Grozz is the referee: in the black, on the pitch, with the real one out of it, and nobody arguing. Where
 *  the referee scheme is running it has the say on whether he's believed (scheme_referee.ts, vars.stands);
 *  without it he's taken for one for exactly as long as the real one isn't about (rules.ts, impostorRuling). */
function grozzRefs(w: World): boolean {
  const s = w.state, pc = pcOf(w);
  if (!pc || pc.dead || pc.hiddenIn || pc.heldBy || !inPlay(w) || refFit(w)) return false;
  if (areaAt(pc.x, pc.y).pitch !== true || appearance(s, pc).role !== "referee") return false;
  const sc = schemeState(w, "referee");
  return sc ? (sc.vars.stands ?? 0) >= 1 : true;
}
/** Whose shirt Grozz is playing in, if he's playing. */
const grozzPlays = (w: World): TeamIdx | -1 => { const pc = pcOf(w); return pc?.fb && pc.fb.status === "playing" ? pc.fb.team : -1; };

// ---------- Curated combinations ----------
// Not everything times everything: these twelve, each with a name, a line for the scoreboard (under 70
// characters), a line for the commentator, and something it actually does (in modsOf and the steps below).
// Each plan is easy to follow. What two of them do to the same match is the part nobody's told.
interface Ctx {
  has: (id: StateId, team?: TeamIdx) => boolean;
  play: boolean;
  /** A real, appointed referee is refereeing. */
  refOn: boolean;
  none: boolean; grozz: boolean;
  /** The side the referee has been got at for, or -1. */
  bent: TeamIdx | -1;
  /** He's been rumbled, and is making a show of being fair. */
  warned: boolean;
  plays: TeamIdx | -1;
}
function ctxOf(w: World): Ctx {
  const st = w.state.stadium!, play = !!w.state.match && inPlay(w);
  const has = (id: StateId, team?: TeamIdx) => hasState(w, id, team);
  const none = has("none"), grozz = has("grozz");
  return {
    has, play, none, grozz, refOn: play && !none && !grozz && refFit(w),
    bent: find(w, "biased", 0) ? 0 : find(w, "biased", 1) ? 1 : -1,
    warned: (st.flags.fsWarnUntil ?? 0) > w.state.tick, plays: w.state.match ? grozzPlays(w) : -1,
  };
}
const both = (c: Ctx, a: StateId, b: StateId): TeamIdx | false => (c.has(a, 1) && c.has(b, 1) ? 1 : c.has(a, 0) && c.has(b, 0) ? 0 : false);

interface ComboDef {
  id: string; name: string;
  /** In force? A side, if it's about one. */
  when: (c: Ctx) => TeamIdx | boolean;
  /** For the scoreboard. Under 70 characters. */
  text: (side: string) => string;
  /** For the commentator. */
  call: (side: string) => string;
}
export const COMBOS: ComboDef[] = [
  { id: "licence", name: "LICENSED TO KICK",
    when: (c) => c.has("hyper", 0) && c.bent === 0 && !c.warned && !c.none && !c.grozz,
    text: () => "England are kicking lumps out of them. The referee admires the passion.",
    call: () => "England are going through the back of everything. The referee keeps finding something interesting on his watch." },
  { id: "gift", name: "BOOK THE LOT",
    when: (c) => c.has("hyper", 1) && c.bent === 0 && !c.warned && !c.none && !c.grozz,
    text: (s) => `${s} are flying in. The referee could not be more pleased.`,
    call: (s) => `${s} are flying into tackles in front of a referee who has been hoping they would.` },
  { id: "bookings", name: "THE BOOK IS OUT",
    when: (c) => (c.refOn && c.has("hyper", 0) && (c.bent !== 0 || c.warned) ? 0 : c.refOn && c.has("hyper", 1) && c.bent !== 1 && (c.bent !== 0 || c.warned) ? 1 : false),
    text: (s) => `${s} are wound up and the referee can count. His book is out.`,
    call: (s) => `${s} are wound up, and this referee has a pencil. Every one of these is going to cost a little more than the last.` },
  { id: "heat", name: "UNDER THE SPOTLIGHT",
    when: (c) => c.warned && c.bent !== -1 && c.refOn,
    text: () => "The crowd has noticed. The referee is now being fair. Aggressively.",
    call: () => "Even the home end is laughing at that one. The referee has seen the big screen, and he has gone very upright." },
  { id: "carnage", name: "CARNAGE",
    when: (c) => c.has("hyper", 1) && c.none,
    text: (s) => `No referee, and ${s} have had the hotel water. God help us all.`,
    call: (s) => `${s} have worked out that nobody is refereeing this. They were excitable to begin with.` },
  { id: "bearpit", name: "BEAR PIT",
    when: (c) => c.has("hyper", 0) && c.none,
    text: () => "England are wired and there is nobody to stop them. Avert your eyes.",
    call: () => "England have noticed there is no referee. I would ask younger viewers to look at something else for a minute." },
  { id: "playon", name: "PLAY ON, LADS",
    when: (c) => c.has("hyper", 0) && c.grozz,
    text: () => "England are flying in. The new referee says play on. He would.",
    call: () => "England are leaving a foot in everywhere and the new referee waves it all on. He seems to be enjoying himself." },
  { id: "farce", name: "FARCE",
    when: (c) => both(c, "confused", "kitchaos"),
    text: (s) => `${s}: the wrong boots, in the wrong places. Nothing is where it was left.`,
    call: (s) => `${s} don't know where they should be, and the one man who does can't stand up. They keep passing it to him.` },
  { id: "school", name: "PLAYGROUND RULES",
    when: (c) => both(c, "hyper", "confused"),
    text: (s) => `${s} are all chasing the ball at once. Like a primary school.`,
    call: (s) => `Nine of the ${s} side are within ten yards of the ball. The tenth is shouting at them, and he is their goalkeeper.` },
  { id: "hamstring", name: "NO WARM-UP",
    when: (c) => both(c, "hyper", "late"),
    text: () => "No warm-up, then flat out from the whistle. That will be a hamstring.",
    call: (s) => `${s} came straight off the coach and into this at a sprint. Physios everywhere are wincing.` },
  { id: "luggage", name: "LOST LUGGAGE",
    when: (c) => both(c, "late", "confused"),
    text: (s) => `${s} arrived late and still have not found the pitch.`,
    call: (s) => `${s} got here late, got told something complicated, and have not recovered from either.` },
  { id: "tolerated", name: "THEIR WORST SIGNING",
    when: (c) => c.plays === 1 && c.play && (c.none || (c.bent === 0 && !c.warned)),
    text: () => "Their new signing is dreadful. Nobody official seems to mind.",
    call: (s) => `${s} have a very large man on who keeps running the wrong way with it. No official has so much as looked at him.` },
];
export interface Combo { id: string; name: string; team?: TeamIdx; text: string; call: string }
function combosOf(w: World, c: Ctx): Combo[] {
  const out: Combo[] = [];
  for (const d of COMBOS) {
    const r = d.when(c);
    if (r === false) continue;
    const team = r === true ? undefined : r, side = sideName(w, team === undefined ? 1 : team);
    out.push({ id: d.id, name: d.name, team, text: d.text(side), call: d.call(side) });
  }
  return out;
}
/** The combinations in force right now, with a short line each. */
export function combos(w: World): Combo[] { return w.state.match ? combosOf(w, ctxOf(w)) : []; }

/** Goals that went in with no referee and are waiting for somebody to recognise them: [England's, theirs].
 *  Not on the scoreboard yet; the scoreboard might show a "?". */
export function pending(w: World): [number, number] { return unrecognised(w); }

/** kitchaos: the men of that side in the wrong boots. */
export function afflicted(w: World, team: TeamIdx): Id[] { return find(w, "kitchaos", team)?.who ?? []; }
/** kitchaos: a plan that knows exactly whose boots it swapped says so (otherwise it's their star and maybe one more). */
export function pickOn(w: World, team: TeamIdx, ids: Id[]): void { const x = find(w, "kitchaos", team); if (x) x.who = ids.slice(0, 4); }

/** Grozz is playing in their shirt and the officiating is in no state to care: nobody official looks at him
 *  twice, and his own side put up with him for longer (scheme_twelfth.ts reads this). */
export function leeway(w: World): boolean { const c = ctxOf(w); return COMBOS.find((d) => d.id === "tolerated")!.when(c) !== false; }

// ---------- What the states do to the football ----------
/** The no-referee flow (THERE ARE NO MORE RULES, pending goals, Grozz as the derived referee) is written but
 *  has not been played through in the full game, so it is switched off: "none" and "grozz" are never derived,
 *  and writing them does nothing to the football. Turn it on only with tests that run it end to end. */
const NO_REF_FLOW = false;
const BIAS = 0.75, LATE_SECS = 150, SICK_MAX = 4, HEAT_MAX = 3, LOST = 0.55;
const blank = (): TeamMods => ({ hyper: 0, slow: 0, lost: 0, ragged: 0, keen: 0, swarm: 0, feed: 0, clumsy: [], shun: null });
const onPitch = (w: World, id: Id): boolean => { const a = w.state.actors[id]; return !!a?.fb && a.fb.status === "playing"; };
/** How far a late arrival has still to go before it's worn off: 1 at kick-off, 0 a couple of minutes in. */
function lateness(w: World, x: FState, stuck: boolean): number {
  if (!x.seen) return 1;
  const k = 1 - (w.state.tick - x.seen) / (60 * LATE_SECS);
  return stuck ? Math.max(k, 0.45) : k;
}

/** The numbers the match plays by, from what's in force. null: nothing is, and the match is left alone. */
function modsOf(w: World, c: Ctx, cs: Combo[]): MatchMods | null {
  const s = w.state, st = s.stadium!, f = st.flags, m = s.match!;
  const on = (id: string, team?: TeamIdx) => cs.some((x) => x.id === id && (team === undefined || x.team === team));
  const mods: MatchMods = { team: [blank(), blank()], lawless: 0, card: [0, 0], see: [1, 1] };
  let any = false;
  for (const t of [0, 1] as TeamIdx[]) {
    const T = mods.team[t];
    if (c.has("hyper", t)) T.hyper = 1;
    if (c.has("lethargic", t)) T.slow = 1;
    if (c.has("confused", t)) T.lost = LOST;
    if (c.has("motivated", t)) T.keen = 1;
    // Sick: it's mostly the men who leave (stepSick), but nobody with his stomach in knots is sprinting either.
    if (c.has("sick", t)) T.slow = Math.max(T.slow, 0.25);
    const late = find(w, "late", t);
    if (late) { const k = Math.max(0, lateness(w, late, on("luggage", t))); T.ragged = k; T.slow = Math.max(T.slow, 0.8 * k); }
    // LOST LUGGAGE: late and confused, they never do find their places, and what they were told makes it worse.
    if (on("luggage", t)) T.lost = Math.min(1, T.lost + 0.15);
    const kit = find(w, "kitchaos", t);
    if (kit?.who) T.clumsy = kit.who.filter((id) => onPitch(w, id));
    // FARCE: nobody knows where to stand and the man they keep finding is the one who can't stay upright;
    // by now two more of them have somebody else's boots on as well.
    if (on("farce", t)) {
      T.feed = 1;
      const more = m.teams[t].squad.filter((id) => onPitch(w, id) && s.actors[id].fb!.role !== "GK" && !s.actors[id].fb!.controlled && !T.clumsy.includes(id));
      T.clumsy = [...T.clumsy, ...more.slice(-2)];
    }
    // PLAYGROUND RULES: wound up and no idea where to be, so they all go where the ball is.
    if (on("school", t)) T.swarm = 0.75;
    // Grozz in their shirt: after the third one into his own net they stop giving it to him. Unless nobody
    // official minds, in which case nor, somehow, do they.
    if (c.plays === t && (f.pcOwnGoals ?? 0) >= 3 && !on("tolerated")) T.shun = st.pc;
    if (T.hyper || T.slow || T.lost || T.ragged || T.keen || T.swarm || T.feed || T.clumsy.length || T.shun) any = true;
  }
  // THERE ARE NO MORE RULES: it starts as a few late ones and gets worse the longer nobody stops it.
  const none = find(w, "none");
  if (NO_REF_FLOW && none && c.play) {
    mods.lawless = Math.min(1, 0.25 + 0.75 * ((s.tick - none.from) / (60 * 40)));
    // CARNAGE / BEAR PIT: a wired side with no referee doesn't work up to it.
    if (on("carnage") || on("bearpit")) mods.lawless = Math.min(1, Math.max(mods.lawless, 0.65) + 0.15);
    any = true;
  }
  // LICENSED TO KICK: he doesn't see England's, and what he can't help seeing isn't worth a card.
  if (on("licence")) { mods.see[0] = 0.3; mods.card[0] = -0.45; any = true; }
  // BOOK THE LOT: theirs he sees from the other end of the ground, and he's had the pencil sharpened.
  if (on("gift")) { mods.see[1] = 1.2; mods.card[1] = 0.1; any = true; }
  // THE BOOK IS OUT: a straight referee and a side that won't calm down. Each foul he gives costs more than the last.
  for (const t of [0, 1] as TeamIdx[]) if (on("bookings", t) && !(on("heat") && c.bent === t)) { mods.card[t] += Math.min(0.16, 0.012 * (f[`fsBook${t}`] ?? 0)); any = true; }
  // A wound-up side down to seven: one more red and he has to abandon it, and then nobody gets what they came
  // for. From here he keeps the card in his pocket and writes names down instead.
  for (const t of [0, 1] as TeamIdx[]) if (mods.team[t].hyper && m.teams[t].squad.filter((id) => onPitch(w, id)).length <= 7) { mods.card[t] -= 0.8; any = true; }
  // UNDER THE SPOTLIGHT: rumbled, he gives everything against the side he was paid to help, to show that he can.
  if (on("heat") && c.bent !== -1) { mods.see[c.bent] = 1.3; mods.card[c.bent] += 0.35; any = true; }
  // PLAY ON, LADS: Grozz with the whistle has never seen an England foul in his life.
  if (on("playon")) { mods.see[0] = 0; mods.card[0] = -1; any = true; }
  return any ? mods : null;
}

// ---------- The referee: bent, absent, or Grozz ----------
/** The state says he leans; make the man on the pitch lean (football/api biasReferee is the same lever). And
 *  the other way about: however he came to lean (a bung, a debug button), the state says so. */
function stepBias(w: World): void {
  const s = w.state, f = s.stadium!.flags, ref = refOf(w);
  if (!ref?.off) return;
  const warned = (f.fsWarnUntil ?? 0) > s.tick;
  for (const t of [0, 1] as TeamIdx[]) {
    const k = `fsBent${t}`;
    if (!find(w, "biased", t) && !f[k] && ref.off.bias[t] > 0.05) setState(w, "biased", t, 0, "the referee has been got at");
    if (find(w, "biased", t)) { f[k] = 1; ref.off.bias[t] = warned ? 0 : Math.max(BIAS, ref.off.bias[t]); }
    else if (f[k]) { f[k] = 0; ref.off.bias[t] = 0; }
  }
}

/** Something blatant went the bent referee's way and everybody saw. Enough of those and he's rumbled: for a
 *  minute or so he overcorrects, then he drifts back to what he was paid for. */
function heat(w: World, amount: number): void {
  const s = w.state, f = s.stadium!.flags;
  if ((f.fsWarnUntil ?? 0) > s.tick) return;
  f.fsHeat = (f.fsHeat ?? 0) + amount;
  if (f.fsHeat < HEAT_MAX) return;
  f.fsHeat = 0; f.fsWarnUntil = s.tick + Math.round(60 * rndRange(s.rng.world, 60, 90));
  w.bus.emit({ type: "ref_warned", t: s.tick, until: f.fsWarnUntil });
}

const hooked = new WeakSet<object>();
/** What the states need to hear from the match as it happens. Listeners aren't saved state, so it's put on
 *  whichever bus this world has the first time it's stepped. */
function hook(w: World): void {
  if (hooked.has(w.bus)) return;
  hooked.add(w.bus);
  w.bus.on((e) => {
    const st = w.state.stadium, m = w.state.match;
    if (!st || !m || !st.fstates?.length) return;
    const f = st.flags;
    if (e.type === "fb_foul" || e.type === "fb_foul_missed") {
      const bent = find(w, "biased", 0) ? 0 : find(w, "biased", 1) ? 1 : -1;
      // Only the ones the whole ground saw: a tackle that should have been a card, waved away.
      if (e.type === "fb_foul_missed" && bent === e.team && (e.severity ?? 0) > 0.8) heat(w, e.severity);
      if (e.type === "fb_foul" && e.phantom && bent !== -1 && bent !== e.team) heat(w, e.penalty ? 2.2 : 0.9);
      if (e.type === "fb_foul" && !e.phantom && hasState(w, "hyper", e.team)) f[`fsBook${e.team}`] = (f[`fsBook${e.team}`] ?? 0) + 1;
    }
    if (e.type === "fb_confrontation" && e.card !== "none") f[`fsBook${e.team}`] = (f[`fsBook${e.team}`] ?? 0) + 1;
  });
}

/** An official nobody had heard of an hour ago, in whatever was left in the kit room. */
function reserve(w: World, at: { x: number; y: number }): Actor {
  const s = w.state, f = s.stadium!.flags, n = (f.fsReserves = (f.fsReserves ?? 0) + 1);
  const a = spawnActor(s, "official", "Reserve official", at.x, at.y, {
    id: `off_reserve${n}`, radius: 0.38,
    off: { job: "fourth", line: 0, half: 0, distractedUntil: 0, incapacitated: false, bias: [0, 0], strictness: 0.6 },
  });
  a.npc = newNpc("official", "referee");
  if (PACE.calm) spawnItem(s, "ref_kit", { k: "worn", a: a.id, slot: "outer" });
  return a;
}
/** Somebody takes the whistle: the fourth official if he's in any state to, with a reserve holding his board;
 *  a reserve straight on if he isn't. Whoever was referee is nothing to do with this match any more, and nor
 *  is whatever he was paid. */
function replaceReferee(w: World): Actor {
  const s = w.state, m = s.match!, f = s.stadium!.flags;
  const fourth = s.actors[m.officials.fourth], side = { x: fourth?.x ?? 0, y: fourth?.y ?? -26 };
  const res = reserve(w, side);
  const up = fit(w, fourth) ? fourth : res;
  appointOfficials(w, up.id, up === res ? m.officials.fourth : res.id);
  f.refBackAt = 0; f.fsHeat = 0; f.fsWarnUntil = 0;
  for (const t of [0, 1] as TeamIdx[]) { clearState(w, "biased", t); f[`fsBent${t}`] = 0; }
  w.bus.emit({ type: "ref_replaced", t: s.tick, referee: up.id, promoted: up !== res });
  return up;
}

export type NoRefEnd = "grozz" | "replacement" | "administrators" | "returned";
/** A goal nobody was there to give, looked at afterwards by somebody who wasn't there either. */
const lenient = (w: World) => (c: Candidate): boolean => { const a = c.actor ? w.state.actors[c.actor] : undefined; return chance(w.state.rng.world, a?.fb && a.fb.status === "playing" ? 0.65 : 0.1); };

function beginNone(w: World, written: boolean): void {
  const s = w.state, f = s.stadium!.flags, r = s.rng.world;
  if (!written) setState(w, "none", undefined, 0, "the referee is gone");
  f.fsNoneUntil = s.tick + Math.round(60 * rndRange(r, 45, 75));
  // Decided now, so it's the same every time from the same seed: 1 the fourth official, 2 the administrators.
  f.fsNoneHow = rnd(r) < 0.55 ? 1 : 2;
  f.fsOvertime = 0;
  w.bus.emit({ type: "noref", t: s.tick, on: true, text: "THERE ARE NO MORE RULES" });
}

/** It ends, one way or another, and whoever now has the say rules on what went in while nobody did. */
function endNone(w: World, how: NoRefEnd): void {
  const s = w.state, m = s.match!, f = s.stadium!.flags, tick = s.tick, had = unrecognised(w);
  let given: [number, number] = [0, 0], settled = true;
  clearState(w, "none");
  f.fsNoneUntil = 0; f.fsNoneHow = 0; f.fsRefGone = 0;
  if (how === "grozz") {
    // They're his to give or not (rules.ts: "give", "disallow"). If he can't be bothered, he gives England's.
    settled = false;
    if (had[0] + had[1] > 0) f.fsGrozzDue = tick + 60 * 15;
  } else if (how === "returned") {
    given = recognise(w, m.officials.referee, lenient(w));
  } else if (how === "replacement") {
    const up = replaceReferee(w);
    given = recognise(w, up.id, lenient(w));
  } else {
    // The administrators: stop it, strike everything since the referee went from the record, find a referee
    // (the real one if he's only indisposed, otherwise whoever's holding the board), and start again from the middle.
    const ref = refOf(w), back = !!ref?.off && !ref.dead && !ref.hiddenIn && ((f.refBackAt ?? 0) > 0 || !ref.off.incapacitated);
    given = recognise(w, null, () => false);
    if (back) { ref!.off!.incapacitated = false; ref!.downUntil = Math.min(ref!.downUntil, tick); f.refBackAt = 0; w.bus.emit({ type: "ref_back", t: tick }); }
    else replaceReferee(w);
    if (m.phase === "live" || m.phase === "restart" || m.phase === "goal_pause") {
      for (const t of [0, 1] as TeamIdx[]) for (const id of m.teams[t].squad) { const a = s.actors[id]; if (a.fb!.status === "playing") a.fb!.stunUntil = Math.min(a.fb!.stunUntil, tick + 60); }
      m.next = null;
      beginRestart(w, m, "drop_ball", m.possession === 1 ? 1 : 0, 0, 0, 4);
      matchfx.halt(w, "administrators");
      f.fsAdminUntil = tick + 60 * 10;
    }
  }
  const left = unrecognised(w);
  w.bus.emit({ type: "noref", t: tick, on: false, how, given, wiped: settled ? [had[0] - given[0], had[1] - given[1]] : [0, 0], pending: left });
}

/** No recognised referee while the match is being played, and Grozz isn't being one: THERE ARE NO MORE RULES.
 *  It lasts three quarters of a minute to a minute and a quarter and then it ends, every time. */
function stepReferee(w: World): void {
  const s = w.state, m = s.match!, f = s.stadium!.flags, tick = s.tick;
  if (!NO_REF_FLOW) return;
  if (f.fsAdminUntil && tick >= f.fsAdminUntil) { f.fsAdminUntil = 0; if (m.halted === "administrators") matchfx.resume(w); }
  const play = inPlay(w), gone = play && !refFit(w), grozz = grozzRefs(w), none = find(w, "none");
  if (gone) f.fsRefGone ||= tick; else if (f.fsRefGone) f.fsRefGone = 0;

  if (grozz) { if (!find(w, "grozz")) setState(w, "grozz", undefined, 0, "he's in the black, and the real one's away"); }
  else if (find(w, "grozz")) { clearState(w, "grozz"); f.fsGrozzDue = 0; }
  // Goals left over from before he took charge, and he hasn't said: England's stand. Obviously.
  if (grozz && f.fsGrozzDue && tick >= f.fsGrozzDue) { f.fsGrozzDue = 0; recognise(w, s.stadium!.pc, (c) => c.team === 0); }

  if (none) {
    // A plan can write "none" itself; then the referee really is stood down, so the state is true of the world.
    if (!f.fsNoneUntil) { if (!play) return; if (refFit(w)) matchfx.standDown(w); beginNone(w, true); return; }
    if (grozz) return endNone(w, "grozz");
    if (!play) return endNone(w, refFit(w) ? "returned" : "replacement");
    if (!gone) return endNone(w, "returned");
    if (m.halted) { f.fsNoneUntil += 30; return; }
    if (tick >= f.fsNoneUntil) return endNone(w, f.fsNoneHow === 2 ? "administrators" : "replacement");
    // Time's up and nobody to blow for it (the match won't end a half while this lasts).
    if (!f.fsOvertime && m.addedAnnounced && m.clock >= periodSeconds(m) + m.addedAnnounced * (m.cfg.halfSeconds / 45)) { f.fsOvertime = 1; w.bus.emit({ type: "noref_overtime", t: tick, period: m.period }); }
    return;
  }
  // A couple of seconds' grace: a referee who's merely been knocked over and is getting up isn't an interregnum.
  if (gone && !grozz && !m.halted && tick - f.fsRefGone >= 120) beginNone(w, false);
}

// ---------- The team states that need running ----------
/** Sick: every so often one of them can't wait, and goes. The old dose does the rest (rules.ts, st.dosed). */
function stepSick(w: World, t: TeamIdx): void {
  const s = w.state, st = s.stadium!, f = st.flags, m = s.match!, r = s.rng.world, k = `fsSickAt${t}`;
  if (m.phase !== "live") return;
  if (!f[k]) { f[k] = s.tick + Math.round(60 * rndRange(r, 8, 25)); return; }
  if (s.tick < f[k]) return;
  f[k] = s.tick + Math.round(60 * rndRange(r, 50, 100));
  const squad = m.teams[t].squad.map((id) => s.actors[id]);
  // The keg, the cooler and this are all the same stomach: four of them in a match is plenty.
  const already = squad.filter((a) => a.fb!.goneReason === "toilet" || a.fb!.goneReason === "unwell" || st.dosed[a.id]?.effect === "laxative").length;
  if (already >= SICK_MAX) return;
  const well = squad.filter((a) => a.fb!.status === "playing" && a.fb!.role !== "GK" && !a.fb!.controlled && !a.fb!.boltAt && !st.dosed[a.id]);
  if (well.length) matchfx.runOff(w, well[Math.floor(rnd(r) * well.length)].id);
}

/** Wrong kit: whose. Their star for preference (he's the one worth doing it to), and often one more. */
function pickVictims(w: World, x: FState): void {
  const s = w.state, r = s.rng.world;
  const out = s.match!.teams[x.team!].squad.map((id) => s.actors[id]).filter((a) => a.fb!.status === "playing" && a.fb!.role !== "GK" && !a.fb!.controlled);
  const who = out.filter((a) => a.fb!.star).slice(0, 1);
  const rest = out.filter((a) => !who.includes(a));
  if (rest.length && (!who.length || chance(r, 0.5))) who.push(rest[Math.floor(rnd(r) * rest.length)]);
  x.who = who.map((a) => a.id);
}

/** Run from the game step. Expires what's run out, works out what the referee situation is, and every half
 *  second tells the match what it's playing under. */
export function stepStates(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match;
  if (!m || s.tick % 30 !== 0) return;
  hook(w);
  const l = st.fstates;
  if (l) for (let i = l.length - 1; i >= 0; i--) if (l[i].until <= s.tick) { const x = l[i]; l.splice(i, 1); w.bus.emit({ type: "fstate", t: s.tick, id: x.id, team: x.team, on: false }); }
  if (m.phase === "finished") { if (m.mods) setMods(w, null); return; }
  stepReferee(w);
  stepBias(w);
  // Nothing written, nothing derived, nothing to tell the match: the usual case, and it costs next to nothing.
  if (!st.fstates?.length) { if (m.mods) setMods(w, null); return; }

  let c = ctxOf(w);
  const live = m.phase === "live" && m.period <= 4;
  for (const x of [...st.fstates!]) {
    // The first time it shows in play, the commentators notice. Once.
    if (live && !x.seen) {
      x.seen = s.tick;
      if (x.id === "kitchaos" && !x.who) pickVictims(w, x);
      w.bus.emit({ type: "fstate_seen", t: s.tick, id: x.id, team: x.team, text: SEEN[x.id](sideName(w, x.team)) });
    }
    if (x.id === "sick" && x.team !== undefined) stepSick(w, x.team);
    // Late wears off: a couple of minutes in they've found their places (unless they never knew them).
    if (x.id === "late" && x.seen && lateness(w, x, !!both(c, "late", "confused")) <= 0) clearState(w, "late", x.team);
  }
  c = ctxOf(w);
  for (const t of [0, 1] as TeamIdx[]) if (st.flags[`fsBook${t}`] && !c.has("hyper", t)) st.flags[`fsBook${t}`] = 0;
  const cs = combosOf(w, c);
  for (const x of cs) {
    // Told once, the first time it comes into force. After that it's for the player to remember.
    const k = `fsC_${x.id}${x.team ?? ""}`;
    if (st.flags[k]) continue;
    st.flags[k] = s.tick;
    w.bus.emit({ type: "fcombo", t: s.tick, id: x.id, name: x.name, team: x.team, text: x.text, call: x.call });
  }
  // NO WARM-UP: cold muscles at full tilt. Every so often one of them pulls up, clutching the back of a leg.
  for (const t of [0, 1] as TeamIdx[]) if (live && cs.some((x) => x.id === "hamstring" && x.team === t) && chance(s.rng.world, 0.03)) {
    const run = m.teams[t].squad.map((id) => s.actors[id]).filter((a) => a.fb!.status === "playing" && a.fb!.role !== "GK" && !a.fb!.controlled && a.fb!.stunUntil <= s.tick && Math.hypot(a.vx, a.vy) > 4.5);
    if (run.length) matchfx.pull(w, run[Math.floor(rnd(s.rng.world) * run.length)].id, 4.5);
  }
  // Their own lot have started to wonder about the big lad.
  if (c.plays !== -1 && (st.flags.pcOwnGoals ?? 0) >= 2 && !st.flags.fsSuspect) { st.flags.fsSuspect = s.tick; w.bus.emit({ type: "sabotage_suspected", t: s.tick, team: c.plays, tolerated: cs.some((x) => x.id === "tolerated") }); }
  setMods(w, modsOf(w, c, cs));
}

// THE TWELFTH MAN. An authored scheme, built on what the game already does when Grozz pulls on a playing kit.
//
// In a team's kit, on the pitch, he's playing: the ball's real, his kick's real, and a goal he puts in
// either net is given like anybody's (in their shirt, into their net, it's their own goal). The scheme only
// decides who notices him. Three things, each ordinary and none of them required:
//   THE KIT    a spare strip in each dressing-room hamper, England's and theirs. Wally the kit man minds them;
//   THE GAP    a side with a man gone (withdrawn "unwell" by the keg, sent off, nicked, on the bog, in the
//              physio's room, dead) has a shirt nobody's wearing. Grozz isn't a twelfth man then: he's that
//              man, back. His own side know better and say nothing;
//   THE COUNT  the fourth official counts heads at every restart. Not while he's being filmed, not while
//              two referees are arguing, not if he's been paid, not when the game's stopped anyway.
// It's counted when he steps on in a kit during play. With a gap he plays until somebody gets a proper look
// at his face. Without one he's a twelfth man: on till the count catches up (about forty seconds if the
// official's busy), or counted at the very next restart, led off, and his side pay for it where he stood.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { appearance } from "../core/identity";
import { areaAt, PACE, VENUE } from "./layout";
import { say as say0 } from "./npc";
import { alert } from "./security";
import { linkCause } from "./cause";
import { matchfx } from "./matchfx";
import { defineScheme, learn, play, schemeState, type Beat, type SchemeDef, type SchemeState, type Thing } from "./schemes";

type P = { x: number; y: number };
type Side = 0 | 1;
const ID = "twelfth";
const say = (w: World, a: Actor | undefined, text: string, secs = 3.2): void => { if (!a?.npc || a.dead) return; say0(w, a, text, secs); a.npc.told = w.state.tick + Math.round(secs * 60); };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const pcOf = (w: World) => w.state.actors[w.state.stadium!.pc];
const fourth = (w: World) => w.state.actors[w.state.match!.officials.fourth];
const who = (w: World, f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => a.npc && !a.dead && f(a));
const squad = (w: World, t: Side) => w.state.match!.teams[t].squad.map((id) => w.state.actors[id]).filter((a) => a?.fb && !a.fb.controlled);
const name = (w: World, t: Side) => w.state.match!.teams[t].name;
/** Whoever of a side is stood nearest Grozz (not the keeper): he's the one who says it. */
const man = (w: World, t: Side, skip = 0) => squad(w, t).filter((a) => a.fb!.status === "playing" && a.fb!.role !== "GK").sort((p, q) => dist(p, pcOf(w)) - dist(q, pcOf(w)))[skip];
const keeper = (w: World, t: Side) => squad(w, t).find((a) => a.fb!.status === "playing" && a.fb!.role === "GK");
const stewards = (w: World) => { const s = w.state; for (const id in s.actors) { const g = s.actors[id]; if (g.npc?.job === "pitchsteward" && !g.dead) alert(w, g, pcOf(w), 2, 2); } };
const news = (w: World, text: string): void => { w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: ID, text }); };
const mutter = (w: World, text: string): void => { w.bus.emit({ type: "scheme_line", t: w.state.tick, text }); };
const has = (sc: SchemeState, id: string) => !!sc.met[id];
const hampers = (w: World) => Object.values(w.state.items).filter((i) => i.def === "kit_hamper" && i.loc.k === "ground").map((i) => i.loc as P);

/** Whose kit he's got on, as a side in the match. */
function side(w: World): Side | null {
  const m = w.state.match!, ap = appearance(w.state, pcOf(w));
  if (ap.role !== "footballer") return null;
  return ap.team === m.teams[0].short ? 0 : ap.team === m.teams[1].short || ap.team === "OPP" ? 1 : null;
}
/** What each way of losing a man looks like when he "comes back": the line a team-mate has for it, and the headline. */
const BACK: Record<string, [string, string]> = {
  unwell: ["Skipper! You're better? You look... inflated.", "RETURNS FROM SICKBED"],
  toilet: ["Back off the bog already? Wash your hands.", "RETURNS FROM THE TOILET"],
  sent_off: ["He sent you off! ...Nobody's looking. Stay.", "RETURNS FROM HIS RED CARD"],
  arrested: ["They let you out? Christ. Good brief.", "RETURNS FROM THE CELLS"],
  injured: ["Leg's better, then. Rest of you looks worse.", "RETURNS FROM THE PHYSIO"],
  killed: ["You were dead. I SAW you dead.", "RETURNS FROM THE DEAD"],
  missing: ["You made it! Did you eat the coach?", "TURNS UP AT LAST"],
};
/** The man of that side whose shirt is going spare: gone for a reason that isn't the manager's, or never turned up. */
function gone(w: World, t: Side): { a: Actor; why: string } | null {
  const all = squad(w, t), a = all.filter((x) => x.fb!.status === "gone" && BACK[x.fb!.goneReason ?? ""]).pop();
  if (a) return { a, why: a.fb!.goneReason! };
  const lost = w.state.match!.phase === "pre" ? undefined : all.find((x) => x.fb!.status === "playing" && (x.hiddenIn || !VENUE.inside(x.x, x.y)));
  return lost ? { a: lost, why: "missing" } : null;
}
/** Why the fourth official isn't counting heads just now. All of it is somebody else's doing. */
function blind(w: World): string {
  const s = w.state, f = fourth(w), r = schemeState(w, "referee");
  if (f.downUntil > s.tick || f.off!.incapacitated) return "flat out";
  if (r?.variant && !r.done && (r.variant === "two" || r.variant === "crowned")) return "two referees";
  const b = schemeState(w, "bribe")?.vars;
  if (r?.vars.paid || b?.fourth || b?.fourthPaid) return "paid";
  if (Object.values(s.actors).some((a) => a.npc?.job === "press" && !a.dead && areaAt(a.x, a.y).pitch)) return "on camera";
  return s.match!.halted ? "a stoppage" : "";
}

function aside(w: World, sc: SchemeState, key: string, a: Actor | undefined, text: string, clue: string): void {
  const s = w.state, pc = pcOf(w);
  if (!a?.npc || sc.vars[`n_${key}`] || dist(a, pc) > 7 || pc.hiddenIn || s.tick < (sc.vars.quiet ?? 0) || (a.npc.bubble && a.npc.bubble.until > s.tick) || a.npc.mode !== "routine" || a.downUntil > s.tick) return;
  say(w, a, text, 4.2);
  sc.vars[`n_${key}`] = 1; sc.vars.quiet = s.tick + 60 * 16;
  learn(w, DEF, sc, clue);
}

const mine = (sc: SchemeState) => (sc.vars.team ? 1 : 0) as Side;
/** The man he's taken for, if there is one. */
const as = (w: World, sc: SchemeState) => (sc.vars.as ? w.state.actors[w.state.match!.teams[mine(sc)].squad[sc.vars.as - 1]] : undefined);
const why = (sc: SchemeState) => Object.keys(BACK)[(sc.vars.why ?? 1) - 1];
const W = (secs: number, go?: Beat["go"], o: Partial<Beat> = {}): Beat => ({ secs, at: (w) => pcOf(w), go, ...o });
const C = (secs: number, text: (w: World, sc: SchemeState) => string, link: string): Beat => ({ secs, at: (w) => fourth(w), cut: true, caption: "THE FOURTH OFFICIAL", link, go: (w, sc) => say(w, fourth(w), text(w, sc)) });
/** England know he's not one of theirs, and say nothing: he's on their side. One of them forgets. */
const lads = (): Beat[] => [
  W(2.8, (w) => say(w, man(w, 0), "That's never him. Say nothing. He's ours.")),
  W(2.8, (w) => { say(w, man(w, 0, 1) ?? man(w, 0), "On your head, Deano! ...That's not Deano."); mutter(w, "On me 'ead."); }),
];

const DEF: SchemeDef = {
  id: ID, title: "The twelfth man",
  on: () => PACE.calm,
  clues: [
    { id: "kit", note: "A spare strip in each dressing-room hamper, ours and theirs. Wally minds them.", mutter: "Comes in XXL, does it?" },
    { id: "count", note: "The fourth official counts heads at every restart. Unless he's busy.", mutter: "" },
    { id: "spare", note: "A side with a man gone has a shirt nobody's wearing.", mutter: "A shirt going spare." },
    { id: "theirs", note: "In their shirt he's one of theirs. Nobody tackles his own man.", mutter: "Their net's that way." },
  ],
  conds: [
    { id: "kit", clue: "kit", known: "He's in a playing kit.", unknown: "What gets a fat man on the pitch?", test: (w) => { const t = side(w); return t === null ? "" : t ? "opp" : "eng"; } },
    { id: "gap", clue: "spare", known: "There's a shirt going spare.", unknown: "How do twelve look like eleven?", test: (w) => { const t = side(w); return (t !== null ? gone(w, t) : gone(w, 1) ?? gone(w, 0))?.why ?? ""; } },
    { id: "blind", clue: "count", known: "The fourth official isn't counting just now.", unknown: "Who counts them, and when?", test: (w) => blind(w) },
  ],
  actions: [],
  variants: [
    // An England shirt and an England man gone: there are eleven, so nobody counts twelve.
    { id: "eleven", when: (sc) => sc.met.kit === "eng" && has(sc, "gap"), beats: [
      C(2.6, () => "Nine, ten, eleven. Eleven. Lovely.", "ELEVEN ENGLAND SHIRTS. ONE'S AN XXL"), ...lads(),
    ] },
    // Their shirt and their man gone: he's that man, back. Their net's the one his shirt defends.
    { id: "theirs", when: (sc) => sc.met.kit === "opp" && has(sc, "gap"), beats: [
      C(2.6, () => "Eleven of theirs. One's had a big lunch.", "THEIR MISSING MAN IS BACK. HE'S GROWN"),
      W(2.8, (w, sc) => say(w, man(w, 1), BACK[why(sc)][0])),
      W(2.6, (w, sc) => { mutter(w, "Their net's that way."); learn(w, DEF, sc, "theirs", true); }),
    ] },
    // No gap, and the fourth official's got something else to look at: a twelfth man, for a bit.
    { id: "twelve", when: (sc) => has(sc, "kit") && has(sc, "blind"), beats: [
      C(2.6, (_w, sc) => (sc.met.blind === "on camera" ? "Is this my good side? ...Count what?" : sc.met.blind === "paid" ? "I make it eleven. I've been told eleven." : "Not now. I'm watching this."), "A TWELFTH MAN, AND NOBODY'S COUNTING"),
      W(2.8, (w, sc) => say(w, man(w, mine(sc)), mine(sc) ? "Twelve of us? ...I do not count. I play." : "Twelve of us. Say nothing. Not our job.")),
    ] },
    // No gap, and he's counting: twelve, at the next restart.
    { id: "counted", when: (sc) => has(sc, "kit"), beats: [
      C(2.6, () => "Nine, ten, eleven... hang on.", "THE FOURTH OFFICIAL IS COUNTING"),
      W(2.8, (w, sc) => { say(w, man(w, mine(sc)), "Get off, you lump! He counts at restarts!"); learn(w, DEF, sc, "count", true); }),
    ] },
  ],
  init: (w) => { w.bus.on((e: any) => { const sc = schemeState(w, ID); if (sc) hear(w, sc, e); }); },
  step: (w, sc) => {
    const s = w.state, m = s.match!, tick = s.tick, pc = pcOf(w), f = fourth(w);
    if (!pc) return;
    const t = side(w);
    if (hampers(w).some((p) => dist(pc, p) < 2.6) || t !== null) learn(w, DEF, sc, "kit", t !== null);
    if (t === 1) learn(w, DEF, sc, "theirs");
    if (!sc.variant) {
      const wally = who(w, (a) => a.npc!.job === "kitman");
      aside(w, sc, "wa", wally, "Spare strip in each hamper, ours and theirs. I count them.", "kit");
      aside(w, sc, "wa2", wally, "Man goes off, his shirt's going spare. I never get it back.", "spare");
      aside(w, sc, "fo", f, "Restarts. That's when I count heads. Every restart.", "count");
      aside(w, sc, "st", who(w, (a) => a.npc!.job === "pitchsteward" && dist(a, pc) < 7), "Fourth official counts them at restarts. When he's looking.", "count");
      return;
    }
    if (sc.vars.over || !pc.fb) return;
    const v = sc.variant;
    // With a gap he's that man, until one of his own or the referee has had a proper look at his face.
    if ((v === "eleven" || v === "theirs") && !sc.vars.seen) {
      const r = s.actors[m.officials.referee], close = (r && !r.dead && dist(r, pc) < 4) || squad(w, mine(sc)).some((a) => a.fb!.status === "playing" && dist(a, pc) < 2);
      if (close) sc.vars.face = (sc.vars.face ?? 0) + 1 - appearance(s, pc).faceCover;
      if ((sc.vars.face ?? 0) >= 24 || (sc.vars.seenAt && tick >= sc.vars.seenAt)) {
        sc.vars.seen = 1;
        say(w, man(w, mine(sc)), mine(sc) ? "That is not him. Who is under there?" : "Ref's looking. We never saw him. Right?");
        stewards(w); linkCause(w, sc.cause, "SOMEBODY GETS A PROPER LOOK AT HIS FACE", pc); news(w, `${name(w, mine(sc)).toUpperCase()}'S BIG LAD ISN'T ON THE TEAM SHEET`);
      }
    }
    // Without one, it's the count: at a restart, when the fourth official's eyes are his own again.
    const restart = sc.vars.restart; sc.vars.restart = 0;
    if (v === "counted" && restart && !sc.vars.seen) counted(w, sc, true);
    if (v === "twelve" && !sc.vars.seen && ((restart && (!blind(w) || tick > sc.vars.until!)) || tick > sc.vars.until! + 60 * 20)) counted(w, sc, false);
  },
  things: (w, sc) => {
    const out: Thing[] = [], f = fourth(w);
    if (sc.clues.kit && side(w) === null) for (const p of hampers(w)) out.push({ x: p.x, y: p.y, z: 1.2, mark: "a spare strip" });
    if (sc.clues.count && !sc.vars.over) out.push({ x: f.x, y: f.y, z: 1.9, mark: sc.met.blind ? "not counting" : "counts at restarts" });
    return out;
  },
};

/** Twelve. He's led off; counted cold, his side pay for it where he was stood. */
function counted(w: World, sc: SchemeState, cold: boolean): void {
  const s = w.state, pc = pcOf(w), t = mine(sc);
  sc.vars.seen = 1; s.stadium!.flags.twelfthNoticed = 1;
  say(w, fourth(w), cold ? "Twelve. TWELVE. Referee!" : "...ten, eleven, twelve. Oh, hell.");
  matchfx.halt(w, "twelfth");
  w.bus.emit({ type: "twelfth_man", t: s.tick, team: t, disallowed: false });
  const kick = cold ? matchfx.penalise(w, t, pc.x, pc.y) : null;
  if (kick) say(w, man(w, t), t ? "For that? He is not even ours!" : "You've cost us, you fat prat.");
  linkCause(w, sc.cause, kick ? `TWELVE MEN: ${kick === "penalty" ? "A PENALTY" : "A FREE KICK"} AGAINST ${name(w, t).toUpperCase()}` : "THE COUNT CATCHES UP WITH HIM", pc);
  news(w, kick ? `TWELVE MEN. ${kick === "penalty" ? "PENALTY" : "FREE KICK"} AGAINST ${name(w, t).toUpperCase()}` : "TWELVE. THE COUNT CATCHES UP. OFF HE GOES");
  stewards(w);
}

/** What the scheme takes from the world's own events. */
function hear(w: World, sc: SchemeState, e: any): void {
  const s = w.state, tick = s.tick, m = s.match!, pc = pcOf(w);
  if (!pc) return;
  if ((e.type === "fb_removed" || (e.type === "fb_foul" && (e.card === "red" || e.card === "second_yellow")) || (e.type === "impostor_ruling" && e.kind === "sendoff")) && VENUE.inside(pc.x, pc.y)) learn(w, DEF, sc, "spare");
  // The moment it's counted: he's on, in a kit, and it's a match.
  if (e.type === "joined_match" && !sc.variant) {
    const t = e.team as Side, g = gone(w, t);
    for (const c of DEF.conds) sc.met[c.id] = c.test(w, sc);
    sc.vars.team = t; sc.vars.hold = 1; sc.vars.at = tick; sc.vars.until = tick + 60 * 40;
    if (g) { sc.vars.as = m.teams[t].squad.indexOf(g.a.id) + 1; sc.vars.why = Object.keys(BACK).indexOf(g.why) + 1; }
    play(w, DEF, sc, pc);
  }
  if (!sc.variant || sc.vars.over) return;
  if (e.type === "fb_restart" && !sc.vars.seen && tick > (sc.vars.at ?? 0) + 60) sc.vars.restart = 1;
  // Off the pitch, held, or the half's over: the officials have their eyes back.
  if (e.type === "left_match") { sc.vars.over = 1; sc.vars.hold = 0; if (m.halted === "twelfth") matchfx.resume(w); }
  // His goal. The match gave it; the scheme only says whose it was.
  if (e.type === "fb_goal" && e.by === pc.id) {
    const t = mine(sc), him = as(w, sc), tag = him ? `${him.name.split(" ").pop()!.toUpperCase()} ${BACK[why(sc)][1]}` : `${name(w, t).toUpperCase()}'S TWELFTH MAN`;
    if (e.og) { say(w, keeper(w, t), "That's OUR net! You're on OUR side!"); say(w, man(w, t), t ? "He is looking at his shirt. He knows." : "Wrong way, you fat pillock!"); }
    else { say(w, man(w, t), t ? "Golo! The big one! I love him!" : "GET IN! ...Sorry, who are you?"); say(w, keeper(w, t ? 0 : 1), "Count them! Somebody count them!"); }
    mutter(w, e.team === 0 ? "Heh heh heh." : "Bollocks.");
    news(w, e.og ? `${tag}, SCORES AT THE WRONG END` : `${tag} AND SCORES. IT STANDS`);
    linkCause(w, sc.cause, e.og ? "HE PUTS IT IN THE NET HIS SHIRT DEFENDS. IT STANDS" : "HE SCORES. IT STANDS", pc);
    if (!sc.vars.seenAt) sc.vars.seenAt = tick + 60 * 7;
  }
}

export function installTwelfth(): void { defineScheme(DEF); }

// TWO REFEREES, ONE GOAL. An authored scheme, built on what the game already lets Grozz do in a black shirt.
//
// A man in the referee's kit, on the pitch, with a whistle, is obeyed for exactly as long as the real
// referee isn't looking. Four things, each ordinary and none of them required, decide how it goes:
//   THE KIT        the spare hangs in the officials' room. Without it he's a fat man with a whistle;
//   THE WHISTLE    the referee's own is on the bench by the urn; his spare is in Cash Kings (he owes money).
//                  Without one he's a man who shouts "peep";
//   THE REAL ONE   wherever he's actually got to, however he got there: caught short on his tea, off his
//                  face on it, flat out, stuffed in a bin, dead, nicked, or just busy with a booking;
//   THE FOURTH     the fourth official can't tell one man in black from another, so he goes by what's in
//                  front of him: who's got a whistle, who's paid him, who looks better with a camera pitchside.
// While the real one's away Grozz IS the referee (the old ruling powers, and they stand). It's counted the
// moment there are two referees on one pitch: when the real one comes back, or Grozz walks on under his
// nose. Both blow, three men point three ways, the fourth official is asked. Nothing here gives a goal.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { appearance } from "../core/identity";
import { dispatch } from "../core/verbs";
import { areaAt, PACE, SPOTS } from "./layout";
import { say as say0 } from "./npc";
import { SHOPS } from "./rules";
import { alert } from "./security";
import { linkCause, rootCause } from "./cause";
import { matchfx } from "./matchfx";
import { defineScheme, learn, play, schemeState, type Beat, type SchemeDef, type SchemeState, type Thing } from "./schemes";

type P = { x: number; y: number };
const ID = "referee", OWN = "The referee's own whistle", PRICE = 6, BUNG = 20;
const KINDS = ["penalty", "sendoff", "disallow", "fulltime", "stop"];
const RULED: Record<string, string> = { penalty: "HE GIVES ENGLAND A PENALTY", sendoff: "HE SENDS ONE OF THEIRS OFF", disallow: "HE CHALKS OFF THEIR GOAL", fulltime: "HE BLOWS FOR FULL TIME", stop: "HE STOPS PLAY, BECAUSE HE CAN" };
const say = (w: World, a: Actor | undefined, text: string, secs = 3.2): void => { if (!a?.npc || a.dead) return; say0(w, a, text, secs); a.npc.told = w.state.tick + Math.round(secs * 60); };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const pcOf = (w: World) => w.state.actors[w.state.stadium!.pc];
const ref = (w: World): Actor | undefined => w.state.actors[w.state.match!.officials.referee];
const fourth = (w: World) => w.state.actors[w.state.match!.officials.fourth];
const who = (w: World, f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => a.npc && !a.dead && f(a));
const press = (w: World) => Object.values(w.state.actors).filter((a) => a.npc?.job === "press" && !a.dead);
const lying = (w: World, def: string, label?: string): Item | undefined => Object.values(w.state.items).find((i) => i.def === def && i.loc.k === "ground" && (!label || i.label === label));
const spot = (i: Item | undefined): P | undefined => (i?.loc.k === "ground" ? i.loc : undefined);
const carries = (w: World, a: Actor, def: string) => [a.hand, ...a.pockets].some((id) => id && w.state.items[id]?.def === def);
const inPlay = (w: World) => ["live", "restart", "goal_pause"].includes(w.state.match!.phase);
const onPitch = (pc: Actor) => areaAt(pc.x, pc.y).pitch === true && !pc.hiddenIn && !pc.heldBy;
const looks = (w: World) => appearance(w.state, pcOf(w)).role === "referee";
/** Whoever of a side is stood nearest Grozz: he's the one who says it. */
const man = (w: World, team: 0 | 1) => { const s = w.state, pc = pcOf(w); return s.match!.teams[team].squad.map((id) => s.actors[id]).filter((a) => a?.fb?.status === "playing" && !a.fb.controlled).sort((p, q) => dist(p, pc) - dist(q, pc))[0]; };
const flag = (w: World) => w.state.match!.officials.assistants.map((id) => w.state.actors[id]).sort((p, q) => dist(p, pcOf(w)) - dist(q, pcOf(w)))[0];
const stewards = (w: World, crime = 2) => { const s = w.state; if (onPitch(pcOf(w))) for (const id in s.actors) { const g = s.actors[id]; if (g.npc?.job === "pitchsteward" && !g.dead) alert(w, g, pcOf(w), crime, 2); } };
const news = (w: World, text: string, clip?: string): void => { w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: ID, text, clip }); };
const mutter = (w: World, text: string): void => { w.bus.emit({ type: "scheme_line", t: w.state.tick, text }); };
const has = (sc: SchemeState, id: string) => !!sc.met[id];

/** Where the real referee's got to, read off the state he's actually in. However he got there counts. */
function where(w: World, sc: SchemeState): string {
  const s = w.state, r = ref(w), t = s.tick;
  if (!r?.off || sc.vars.nicked || r.npc?.job !== "official") return "nicked";
  if (r.dead) return appearance(s, pcOf(w)).faceId === r.faceId ? "wearing him" : "dead";
  if (r.hiddenIn) return "stuffed out of sight";
  if (r.downUntil > t) return "flat out";
  if (r.off.incapacitated) return "caught short";
  if (r.off.strictness >= 1) return "wired";
  return r.off.distractedUntil > t || (sc.vars.booking ?? 0) > t ? "looking elsewhere" : "";
}
/** On the pitch and able to argue (a man chewing his own whistle is still there). */
const here = (how: string) => how === "" || how === "wired";
const WAS = ["", "caught short", "flat out", "stuffed out of sight", "wired"];
const ENTER: [string, string][] = [
  ["Who the bloody hell are you?", "Two of them. One is very wide."],
  ["Five minutes on the khazi. FIVE. Who's that?", "He is still doing up his shorts."],
  ["Some bastard hit me. ...Who's THAT?", "The thin one has a lump on his head."],
  ["I woke up in a BIN. Who is that?", "The thin one smells of bins."],
  ["CARDS! Cards for all of you! And HIM!", "Please. We will take the fat one."],
];
/** His own whistle is still where he left it (he'll have it on him when he comes out). */
const ownWhistle = (w: World) => { const p = spot(lying(w, "whistle", OWN)); return !!p && dist(p, SPOTS.refRoom) < 8; };
/** The bent-officials scheme pays him too, if it's in the game: the same money, read from where it's kept. */
const paidElsewhere = (w: World) => { const b = schemeState(w, "bribe")?.vars; return !!(b?.fourth || b?.fourthPaid); };
/** Why the fourth official would say it's the fat one. */
function backing(w: World, sc: SchemeState): string {
  const pc = pcOf(w);
  if (where(w, sc) === "wired") return "wired";
  if (carries(w, pc, "whistle") && !ownWhistle(w)) return "whistle";
  if (sc.vars.paid || paidElsewhere(w)) return "paid";
  return press(w).some((a) => areaAt(a.x, a.y).pitch) ? "camera" : "";
}
const VERDICT: Record<string, string> = {
  wired: "The fat one. The other's eating his whistle.", whistle: "One whistle between you. It's his. So: him.",
  paid: "The big lad. It's always been the big lad.", camera: "The one with his shorts done up. We're on telly.",
  "": "The thin one. He's got the cards. And a watch.",
};

function aside(w: World, sc: SchemeState, key: string, a: Actor | undefined, text: string, clue: string, max = 2): void {
  const s = w.state, pc = pcOf(w), n = sc.vars[`n_${key}`] ?? 0;
  if (!a?.npc || n >= max || dist(a, pc) > 7 || pc.hiddenIn || s.tick < (sc.vars.quiet ?? 0) || (a.npc.bubble && a.npc.bubble.until > s.tick) || a.npc.mode !== "routine" || a.downUntil > s.tick) return;
  say(w, a, text, 4.2);
  sc.vars[`n_${key}`] = n + 1; sc.vars.quiet = s.tick + 60 * 16;
  learn(w, DEF, sc, clue);
}

const W = (secs: number, go?: Beat["go"], o: Partial<Beat> = {}): Beat => ({ secs, at: (w) => pcOf(w), go, ...o });
const C = (secs: number, go?: Beat["go"], o: Partial<Beat> = {}): Beat => ({ secs, at: (w) => fourth(w), go, cut: true, ...o });

/** The fourth official's said his piece: one of them stays. */
function verdict(w: World, sc: SchemeState): void {
  const s = w.state, pc = pcOf(w), k = KINDS[(sc.vars.claim ?? 0) - 1];
  sc.vars.held = 0; sc.vars.stands = 0; sc.vars.judged = 1;
  if (sc.variant !== "crowned") {
    say(w, ref(w), "Off. And that's my spare shirt. Off.");
    stewards(w);
    linkCause(w, sc.cause, "THE FOURTH OFFICIAL BACKS THE REAL ONE", pc);
    return news(w, "THE FOURTH OFFICIAL BACKS THE THIN ONE");
  }
  say(w, ref(w), "Me? ME? I've done four cup finals!");
  matchfx.standDown(w, 90);
  // Whatever he blew for last is what's given, by the ordinary ruling.
  const all = s.match!.teams.flatMap((t) => t.squad), to = all[(sc.vars.claimT ?? 0) - 1];
  sc.vars.stands = 2;
  if (k) dispatch(w, { verb: "rule", actor: pc.id, arg: k, ...(to ? { target: { k: "actor" as const, id: to } } : {}) });
  linkCause(w, sc.cause, "THE REAL REFEREE IS LED OFF HIS OWN PITCH", pc);
  news(w, "THE FOURTH OFFICIAL BACKS THE FAT ONE. THE REAL ONE IS LED OFF");
}

/** Two referees: the arrival, both blowing, the argument (rulings are claims), the fourth official, and who's left. */
const farce = (): Beat[] => [
  W(3, (w, sc) => {
    const st = w.state.stadium!;
    // Nobody's heard him blow yet: the first whistle is obeyed, and after that it's an argument.
    sc.vars.held = sc.vars.ruled ? 1 : 0; sc.vars.stands = sc.vars.ruled ? 0 : 1;
    matchfx.halt(w, "two_refs"); matchfx.refBusy(w, 50);
    st.flags.twoRefs = (st.flags.twoRefs ?? 0) + 1;
    w.bus.emit({ type: "two_refs", t: w.state.tick, by: st.pc });
    say(w, ref(w), ENTER[sc.vars.was ?? 0][0]);
  }, { link: "NOW THERE ARE TWO REFEREES" }),
  W(3, (w, sc) => { say(w, man(w, 1), ENTER[sc.vars.was ?? 0][1]); mutter(w, "Referee."); }),
  W(3, (w) => {
    say(w, ref(w), ownWhistle(w) ? "PEEP! I've got the cards. Look. Cards!" : "Some sod's had my whistle! ...Peep!");
    say(w, man(w, 0), "Our ball! That way!"); say(w, flag(w), "Flag's up. Couldn't tell you what for.");
    if (w.state.match!.halted === "two_refs") matchfx.resume(w);
  }, { link: "BOTH BLOW. THREE MEN POINT THREE WAYS" }),
  W(28),
  C(2.6, (w) => say(w, fourth(w), "Which one's the referee? Why ask me?"), { caption: "THE FOURTH OFFICIAL" }),
  C(2.8, (w, sc) => { say(w, fourth(w), VERDICT[sc.met.backed ?? ""]); learn(w, DEF, sc, "fourth", true); }),
  W(3.2, verdict),
  W(3, (w, sc) => { if (sc.variant === "crowned") return mutter(w, "Play on."); mutter(w, "They're clapping. They're clapping ME."); news(w, "WALKED OFF TO A STANDING OVATION"); }),
];

const DEF: SchemeDef = {
  id: ID, title: "Two referees, one goal",
  on: () => PACE.calm,
  clues: [
    { id: "kit", note: "The referee's spare kit hangs in his room. Black. Roomy.", mutter: "Black's slimming." },
    { id: "whistle", note: "No whistle, no referee. His is by the urn; his spare's in Cash Kings.", mutter: "" },
    { id: "tea", note: "He has a tea from the urn at half-time. He drinks whatever's in it.", mutter: "" },
    { id: "alone", note: "He gets changed alone, door shut. Nobody would hear a thing.", mutter: "" },
    { id: "owes", note: "He owes money all over town. The police would love a look in his pockets.", mutter: "" },
    { id: "fourth", note: "The fourth official can't tell one man in black from another.", mutter: "Nor can I." },
  ],
  conds: [
    { id: "look", clue: "kit", known: "He looks like a referee.", unknown: "What makes a man a referee?", test: (w) => (looks(w) ? "kit" : "") },
    { id: "sound", clue: "whistle", known: "He's got a whistle.", unknown: "Why would anyone do as he says?", test: (w) => (carries(w, pcOf(w), "whistle") ? "whistle" : "") },
    { id: "away", clue: "tea", known: "The real referee's out of it.", unknown: "Where's the real one?", test: (w, sc) => where(w, sc) },
    { id: "backed", clue: "fourth", known: "The fourth official would say it's the fat one.", unknown: "Two men in black. Who says which?", test: (w, sc) => backing(w, sc) },
  ],
  actions: [
    { id: "blow", label: "Blow the whistle", hint: "Everybody stops for a whistle. Once.", priority: 61,
      can: (w, pc, sc) => (!sc.variant && inPlay(w) && onPitch(pc) && carries(w, pc, "whistle") && !["referee", "footballer"].includes(appearance(w.state, pc).role) ? null : "no"),
      run: (w, pc, sc) => count(w, sc) },
    { id: "bung", label: `Slip the fourth official £${BUNG}`, hint: "He'll remember which referee is which.", priority: 57,
      can: (w, pc, sc) => { const f = fourth(w); return !schemeState(w, "bribe") && !sc.variant && !sc.vars.paid && pc.money >= BUNG && f.npc?.mode === "routine" && f.downUntil <= w.state.tick && dist(pc, f) < 2.6 ? null : "no"; },
      run: (w, pc, sc) => { const f = fourth(w); pc.money -= BUNG; f.money += BUNG; sc.vars.paid = 1; say(w, f, "For that, he's whoever you say he is.", 4); learn(w, DEF, sc, "fourth", true); } },
    { id: "film", label: "Tell her to film the referee", hint: "A man on camera minds how he looks.", priority: 70,
      can: (w, pc, sc) => { const r = who(w, (a) => a.name === "Reporter"); return !sc.variant && !sc.vars.film && r && r.npc!.mode === "routine" && dist(pc, r) < 2.6 ? null : "no"; },
      run: (w, pc, sc) => {
        sc.vars.film = 1;
        press(w).forEach((a, i) => { const n = a.npc!; n.hasTicket = true; n.waitUntil = 0; n.drawn = undefined; n.drawnUntil = w.state.tick + 60 * 1500; n.plan = [{ k: "go", x: 2 + i * 1.8, y: 26.6, run: true }, { k: "wait", s: 1500 }]; });
        say(w, who(w, (a) => a.name === "Reporter"), "The referee? What's he done? ...Kev. Pitchside.", 4);
      } },
  ],
  variants: [
    // The referee's dead and Grozz has his face on: not a referee, THIS referee. It's on slightly wrong.
    { id: "him", when: (sc) => has(sc, "look") && sc.met.away === "wearing him", beats: [
      W(2.8, (w) => say(w, man(w, 0), "You all right, ref? You look tired."), { link: "THE REFEREE'S BACK. HE LOOKS TIRED" }),
      W(2.8, (w) => say(w, man(w, 1), "Referee. Your face. It is... on crooked?")),
      W(2.6, (w) => { mutter(w, "Play on."); news(w, `${(ref(w)?.name ?? "THE REFEREE").toUpperCase()} CARRIES ON. NOBODY LOOKS TWICE`); }),
    ] },
    // The real one's been led away by the police: the tannoy asked, and here's a man in black.
    { id: "invited", when: (sc) => has(sc, "look") && has(sc, "sound") && sc.met.away === "nicked", beats: [
      C(2.8, (w) => say(w, fourth(w), "Any referee in the ground? ...You'll do."), { caption: "THE FOURTH OFFICIAL", link: "NO REFEREE. THE TANNOY ASKS FOR ONE" }),
      W(2.8, (w) => say(w, man(w, 0), "They've sent a big one. Afternoon, ref.")),
      W(2.6, (w) => { mutter(w, "Play on."); news(w, "A QUALIFIED OFFICIAL HAS COME FORWARD. APPARENTLY"); }),
    ] },
    { id: "crowned", when: (sc) => has(sc, "look") && has(sc, "sound") && has(sc, "backed"), beats: farce() },
    { id: "two", when: (sc) => has(sc, "look") && has(sc, "sound"), beats: farce() },
    // The kit and no whistle: nobody obeys a man who shouts it.
    { id: "peep", when: (sc) => has(sc, "look"), beats: [
      W(2.6, (w, sc) => { sc.vars.held = 1; mutter(w, "Peep."); }, { link: "A REFEREE WITH NO WHISTLE" }),
      W(2.8, (w) => say(w, man(w, 0), "Did he just SAY 'peep'?")),
      W(2.8, (w) => say(w, man(w, 1), "Where we come from, referees have a whistle.")),
      W(2.6, (w, sc) => { const r = ref(w); say(w, r && here(where(w, sc)) ? r : fourth(w), "Stewards. The wide one in the spare shirt."); stewards(w); learn(w, DEF, sc, "whistle"); news(w, "LAUGHED OFF: NO WHISTLE, NO REFEREE"); }),
    ] },
    // A whistle and no kit: a fat man with a whistle. Everyone stops, once.
    { id: "fatman", when: (sc) => has(sc, "sound"), beats: [
      W(3, (w) => { matchfx.halt(w, "whistle"); say(w, ref(w) ?? fourth(w), "Who blew that? I never blew that."); }, { link: "A FAT MAN BLOWS A WHISTLE. PLAY STOPS" }),
      W(3, (w) => say(w, man(w, 1), "The fat one. There. With the whistle.")),
      W(2.4, (w, sc) => { if (w.state.match!.halted === "whistle") matchfx.resume(w); say(w, ref(w) ?? fourth(w), "Get him off my pitch. And out."); stewards(w, 1); learn(w, DEF, sc, "kit"); news(w, "ONE BLAST, ONE STOPPAGE. OUT HE GOES"); }),
    ] },
  ],
  init: (w) => {
    const own = lying(w, "whistle");
    if (own) own.label = OWN;
    SHOPS.pawn.stock.whistle = PRICE;
    w.bus.on((e: any) => { const sc = schemeState(w, ID); if (sc) hear(w, sc, e); });
  },
  step: (w, sc) => {
    const s = w.state, tick = s.tick, pc = pcOf(w), f = fourth(w);
    if (!pc) return;
    const on = onPitch(pc), look = looks(w), how = where(w, sc);
    for (const [def, clue] of [["ref_kit", "kit"], ["whistle", "whistle"], ["tea_urn", "tea"]] as const) { const p = spot(lying(w, def)); if (p && dist(pc, p) < 2.6) learn(w, DEF, sc, clue); }
    if (look) learn(w, DEF, sc, "kit", true);
    if (sc.variant) {
      const v = sc.variant;
      if (v === "peep" && (!on || !look)) sc.vars.held = 0;
      // Backed, he carries on while the real one's kept off; invited or wearing him, nobody asks at all.
      if (v === "crowned" && sc.done) sc.vars.stands = on && look && !here(how) ? 2 : 0;
      if (v === "invited" || (v === "him" && !sc.vars.slip)) sc.vars.stands = on && look && (v === "invited" || how === "wearing him") ? 2 : 0;
      // The one thing that makes a borrowed face slip: somebody official looking at it from a yard away.
      if (v === "him" && !sc.vars.slip && on && f.downUntil <= tick && dist(f, pc) < 3) {
        sc.vars.slip = 1; sc.vars.stands = 0;
        say(w, f, "That's his face. That's not his head.", 4);
        stewards(w, 3); linkCause(w, sc.cause, "THE FOURTH OFFICIAL LOOKS TOO CLOSELY", f); news(w, "THE REFEREE'S FACE COMES AWAY IN THE FOURTH OFFICIAL'S HAND");
      }
      return;
    }
    // What people say to nobody, in his hearing: more than one way to be rid of a referee.
    const lionel = who(w, (a) => a.npc!.shop === "pawn"), cleaner = who(w, (a) => a.npc!.job === "cleaner");
    aside(w, sc, "cl", cleaner, "Ref's room: an urn, a spare kit, his whistle. I dust them.", "kit", 1);
    aside(w, sc, "cl2", cleaner, "Ref has his tea at half-time. Drinks anything, that man.", "tea", 1);
    if (SHOPS.pawn.stock.whistle) aside(w, sc, "li", lionel, `Referee's spare whistle, that. Dog track had him. £${PRICE}.`, "whistle", 1);
    aside(w, sc, "li2", lionel, "That referee owes everyone. Old Bill would love his pockets.", "owes", 1);
    aside(w, sc, "co", who(w, (a) => a.npc!.job === "corridor"), "Ref gets changed alone. Door shut. Temper on him, too.", "alone", 1);
    aside(w, sc, "fo", f, "Black shirt, whistle: that's a referee. I don't do faces.", "fourth", 1);
    sc.vars.stands = 0;
    if (!on || !look || !inPlay(w)) return;
    const sound = carries(w, pc, "whistle");
    if ((how !== "wearing him" && !sound) || how === "wearing him" || how === "nicked") return count(w, sc);
    if (here(how)) { if (how === "wired" || !sc.vars.reign) sc.vars.was = WAS.indexOf(how); return count(w, sc); }
    // The real one's elsewhere, so the man in black with the whistle is the referee, for as long as that lasts.
    sc.vars.stands = 1;
    if (!sc.vars.reign) { sc.vars.reign = tick; sc.vars.was = Math.max(0, WAS.indexOf(how)); sc.cause = sc.cause || rootCause(w, "A NEW REFEREE WALKS ON", pc, "authored"); }
    const t = tick - sc.vars.reign;
    if (t === 0) say(w, man(w, 1), "The referee has got... wider.");
    if (t === 90) say(w, f, "Black shirt. Whistle. Carry on.");
    if (t === 180) { say(w, man(w, 0), "His whistle, his rules. Ref's ball."); mutter(w, "Play on."); news(w, "A NEW REFEREE. NOBODY ASKS"); }
  },
  things: (w, sc) => {
    const out: Thing[] = [], kit = spot(lying(w, "ref_kit")), wh = spot(lying(w, "whistle", OWN)), urn = lying(w, "tea_urn"), up = spot(urn), li = who(w, (a) => a.npc!.shop === "pawn"), f = fourth(w);
    if (kit && sc.clues.kit) out.push({ ...kit, z: 1.2, mark: "the spare kit" });
    if (wh && sc.clues.whistle) out.push({ ...wh, z: 1.2, mark: "his whistle" });
    if (up && sc.clues.tea) out.push({ ...up, z: 1.5, mark: urn!.spiked ? "something in it" : "his half-time tea" });
    if (li && sc.clues.whistle && SHOPS.pawn.stock.whistle) out.push({ x: li.x, y: li.y, z: 1.9, mark: "his spare whistle" });
    if (sc.clues.fourth && !sc.done) out.push({ x: f.x, y: f.y, z: 1.9, mark: sc.met.backed ? "would back the fat one" : "can't tell them apart" });
    return out;
  },
};

/** It's counted: what holds, now, is what the payoff goes by. */
function count(w: World, sc: SchemeState): void {
  for (const c of DEF.conds) sc.met[c.id] = c.test(w, sc);
  sc.vars.at = w.state.tick;
  play(w, DEF, sc, pcOf(w));
}

/** What the scheme takes from the world's own events. */
function hear(w: World, sc: SchemeState, e: any): void {
  const s = w.state, tick = s.tick, m = s.match!, pc = pcOf(w), arguing = (sc.variant === "two" || sc.variant === "crowned") && !sc.vars.judged;
  if (e.type === "action" && e.action?.verb === "buy" && e.action.arg === "whistle") { delete SHOPS.pawn.stock.whistle; learn(w, DEF, sc, "whistle", true); }
  if (e.type === "fb_foul" && e.card && e.card !== "none") sc.vars.booking = tick + 60 * 7;
  if (e.type === "spiked" && s.items[e.item]?.def === "tea_urn") learn(w, DEF, sc, "tea", true);
  // Led away by the police (a real one tipped off, or Grozz in the uniform): the match has no referee.
  if ((e.type === "tipoff_arrest" || e.type === "false_arrest") && e.who === m.officials.referee && !sc.vars.nicked) {
    sc.vars.nicked = tick; matchfx.standDown(w);
    news(w, "TANNOY: IS THERE A QUALIFIED REFEREE IN THE GROUND?", "tannoy_teamnews");
  }
  if (e.type === "impostor_ruling") {
    sc.vars.ruled = (sc.vars.ruled ?? 0) + 1;
    linkCause(w, sc.cause, RULED[e.kind] ?? "HE GIVES A DECISION", pc);
    if (arguing) { sc.vars.stands = 0; sc.vars.held = 1; say(w, man(w, 0), "Nearest whistle wins. Come on!"); }
  }
  if (e.type === "impostor_claim") {
    if (!arguing) { mutter(w, "PEEP!"); return say(w, man(w, 0), "Peep! Ha! Do another."); }
    const n = (sc.vars.claims = (sc.vars.claims ?? 0) + 1);
    sc.vars.claim = KINDS.indexOf(e.kind) + 1; sc.vars.claimT = e.target ? m.teams.flatMap((t) => t.squad).indexOf(e.target) + 1 : 0;
    say(w, ref(w), ["PEEP! I blew first!", "PEEP! No it is NOT!", "PEEP! Ignore the fat one!"][n % 3]);
    say(w, n % 2 ? flag(w) : man(w, 1), n % 2 ? "I'm flagging both ways. To be safe." : "Two whistles. We will stand here.");
  }
  // A fat man with a whistle isn't worth a cell: thrown out of the ground instead.
  if (e.type === "caught" && e.who === pc?.id && sc.variant === "fatman" && !sc.vars.out && tick < (sc.vars.at ?? 0) + 60 * 90) {
    const g = s.actors[e.by];
    sc.vars.out = 1;
    if (g?.npc && g.npc.intent === "detain" && g.npc.crime < 3) g.npc.intent = "eject";
  }
}

/** A mission card may tell Grozz outright what he'd otherwise have to overhear (mission_defs.ts): quietly, and once. */
export function teachReferee(w: World, ...ids: string[]): void { const sc = schemeState(w, ID); if (sc) for (const id of ids) learn(w, DEF, sc, id, true); }

export function installReferee(): void { defineScheme(DEF); }

// A RANDOM DRUGS TEST. An authored scheme, on at every ground.
//
// A copper who's given a name turns that man's pockets out. Any man: their number ten, one of ours, the
// referee. Three ordinary things, every one of which the game already did by itself, decide what he finds:
//   THE GEAR     anything a copper would nick a man for. Spliff Ricky delivers (his number's on the pub bog
//                wall, or a fan gives you it), there's a bag in the bogs, and people carry it;
//   WHERE IT IS  on him. Slipped in his pocket from behind (the old plant), put in his hand, or zipped into
//                their ten's boot bag while it sits by the coach, so he carries it in himself;
//   THE NAME     given to a copper, to his face or on 999 (a burner leaves no name behind).
// It's counted when the copper gets to him. A man on the pitch isn't touched while the ball's alive: the
// copper stands at the mouth of the tunnel looking at his watch till play stops, by itself or because
// somebody stopped it (a dog, a streaker, the alarm, a referee who shouldn't be one). Then he walks on.
// The search, the arrest and the removal are the ones police.ts has always done; this file holds them back
// for a few seconds (flags.searchHold) and puts the scene round them.
//   gear + name, on one of theirs   pockets out to prove a point, the bag on the grass, led off in his boots;
//   gear + name, on one of ours     exactly as good, on the wrong side;
//   gear + name, on an official     "I am the referee!" "Then you'll know the rules, sir.";
//   a name and no gear              a shin pad, a photo of his mum, tears, and a copper who wants a word;
//   gear and no name                at half-time the kit man finds it. And keeps it.
// For the other schemes to read (schemeState(w, "drugs")?.vars), set when police.ts really makes the arrest:
//   arrested = 1          somebody on the pitch's books has been led away (a footballer's fb.status is "gone");
//   arrestedOfficial = 1  it was a match official (his off.incapacitated is true: the match has no referee);
//   arrestedOurs = 1      it was an England player.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { hasProp, moveItem } from "../core/items";
import { dispatch } from "../core/verbs";
import { areaAt, PACE, SPOTS, VENUE } from "./layout";
import { say as say0, spawnStaff } from "./npc";
import { alert, crime } from "./security";
import { linkCause } from "./cause";
import { matchfx } from "./matchfx";
import { defineScheme, learn, play, schemeState, type Beat, type SchemeDef, type SchemeState, type Thing } from "./schemes";

type P = { x: number; y: number };
type Go = NonNullable<Beat["go"]>;
const say = (w: World, a: Actor | undefined, text: string, secs = 3): void => { if (!a) return; say0(w, a, text, secs); if (a.npc) a.npc.told = w.state.tick + Math.round(secs * 60); };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
/** In his own language: Portuguese (Portugal, Brazil), Spanish (Argentina), or English (ours, and officials). */
const tongue = (sc: SchemeState, pt: string, es: string, en: string) => (sc.vars.eng ? en : VENUE.opp === "ARG" ? es : pt);
const pcOf = (w: World) => w.state.actors[w.state.stadium!.pc];
const who = (w: World, f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => a.npc && !a.dead && f(a));
const carried = (w: World, a: Actor): Item[] => [a.hand, ...a.pockets].filter((x): x is string => !!x).map((id) => w.state.items[id]).filter((i) => !!i);
const hot = (i: Item) => hasProp(i, "illicit") || hasProp(i, "weapon");
/** What the search would find on him (police.ts looks for exactly this). */
const dirty = (w: World, a: Actor | undefined) => (a ? carried(w, a).find(hot) : undefined);
/** Everyone a match can lose: both squads and the officials. */
const subjects = (w: World): Actor[] => { const m = w.state.match!, o = m.officials; return [...m.teams[1].squad, ...m.teams[0].squad, o.referee, ...o.assistants, o.fourth].map((id) => w.state.actors[id]).filter((a) => a && !a.dead && a.fb?.status !== "gone" && !a.off?.incapacitated); };
const carrier = (w: World) => subjects(w).find((a) => dirty(w, a));
const bag = (w: World) => Object.values(w.state.items).find((i) => i.def === "boot_bag");
const stash = (w: World) => Object.values(w.state.items).find((i) => i.loc.k === "in" && w.state.items[i.loc.c]?.def === "boot_bag");
const tipOf = (w: World, sc: SchemeState) => (sc.vars.tip ? w.state.stadium!.tipoffs[sc.vars.tip - 1] : undefined);
const cast = (w: World, sc: SchemeState) => { const t = tipOf(w, sc), s = w.state; return { cop: t ? s.actors[t.officer] : undefined, man: t ? s.actors[t.target] : undefined }; };
const kitman = (w: World) => who(w, (a) => a.npc!.job === "cook" && a.name.endsWith("the kit man"));
const copNear = (w: World, pc: Actor, r: number) => who(w, (a) => a.npc!.job === "police" && a.npc!.mode === "routine" && dist(a, pc) < r);
/** The ball's in play and he's out there with it. */
const inPlay = (w: World, a: Actor) => { const ph = w.state.match!.phase; return (ph === "live" || ph === "restart" || ph === "goal_pause") && (a.fb ? a.fb.status === "playing" : true) && !!areaAt(a.x, a.y).pitch; };
const mates = (w: World, sc: SchemeState): Actor[] => { const { man } = cast(w, sc), at = { x: sc.vars.x, y: sc.vars.y }; return !man?.fb ? [] : subjects(w).filter((a) => a.fb && a.fb.team === man.fb!.team && a.fb.status === "playing" && a.id !== man.id).sort((p, q) => dist(p, at) - dist(q, at)).slice(0, 2); };
const NUM = ["NOBODY", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
const called = (a?: Actor) => (a?.name ?? "A PLAYER").toUpperCase();
const news = (w: World, text: string, clip?: string) => w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: "drugs", text, clip });
const mutter = (w: World, text: string) => w.bus.emit({ type: "scheme_line", t: w.state.tick, text });
const chain = (w: World, sc: SchemeState, text: string, at?: P) => { if (sc.cause) linkCause(w, sc.cause, text, at, "authored"); };

/** A line a man says to nobody while Grozz is in earshot: how the scheme's parts are found out. */
function aside(w: World, sc: SchemeState, key: string, a: Actor | undefined, lines: [string, string][]): void {
  const s = w.state, pc = pcOf(w), n = sc.vars[`n_${key}`] ?? 0;
  if (!a?.npc || !pc || n >= lines.length || dist(a, pc) > 7 || pc.hiddenIn || s.tick < (sc.vars.hush ?? 0) || (a.npc.bubble && a.npc.bubble.until > s.tick) || a.npc.mode !== "routine") return;
  say(w, a, lines[n][0], 4.2);
  sc.vars[`n_${key}`] = n + 1; sc.vars.hush = s.tick + 60 * 14;
  learn(w, DEF, sc, lines[n][1]);
}
function pin(w: World, a: Actor | undefined, p: P, secs: number, face?: P): void {
  if (!a) return;
  a.hiddenIn = undefined; a.x = p.x; a.y = p.y; a.vx = a.vy = 0; a.moveX = a.moveY = 0;
  if (face) a.facing = Math.atan2(face.y - p.y, face.x - p.x);
  if (a.fb) { a.fb.tx = p.x; a.fb.ty = p.y; }
  if (a.npc) { a.npc.staged = w.state.tick + Math.round(60 * secs); a.npc.plan = [{ k: "wait", s: secs }]; a.npc.waitUntil = 0; a.npc.goal = null; a.npc.path = []; }
}
/** Sent somewhere, and told to stay there. */
const send = (a: Actor, p: P, run = false) => { const n = a.npc!, t = n.plan[0]; if (t?.k !== "go" || t.x !== p.x || t.y !== p.y) { n.plan = [{ k: "go", x: p.x, y: p.y, run }, { k: "wait", s: 60 }]; n.waitUntil = 0; } };
const here: Beat["at"] = (_w, sc) => ({ x: sc.vars.x, y: sc.vars.y });
const touch: Beat["at"] = (w, sc) => (sc.vars.pitch ? { x: SPOTS.tunnelTop.x + 0.9, y: SPOTS.tunnelTop.y + 1.5 } : here(w, sc));
const me: Beat["at"] = (w) => pcOf(w) ?? { x: 0, y: 0 };
const B = (secs: number, at: Beat["at"], go?: Beat["go"], o: Partial<Beat> = {}): Beat => ({ secs, at, go, cut: true, ...o });
const has = (sc: SchemeState, id: string) => !!sc.met[id];
const copSays = (text: string): Go => (w, sc) => say(w, cast(w, sc).cop, text);
const manSays = (pt: string, es: string, en: string): Go => (w, sc) => say(w, cast(w, sc).man, tongue(sc, pt, es, en));

/** The copper's got to him. From here it's a scene; nothing's found, and nobody's gone, till police.ts says so. */
function begin(w: World, sc: SchemeState, cop: Actor, man: Actor): void {
  const s = w.state, m = s.match!, pitch = inPlay(w, man), at = pitch && man.fb ? { x: 0.9, y: 0 } : { x: man.x, y: man.y };
  Object.assign(sc.vars, { go: s.tick, found: dirty(w, man) ? 1 : 0, eng: man.fb?.team === 1 ? 0 : 1, off: man.off ? 1 : 0, pitch: pitch ? 1 : 0, x: at.x, y: at.y, over: 0 });
  matchfx.hold(w, man.id, true);
  if (!pitch) return void pin(w, man, at, 40, cop);
  if (!m.halted) matchfx.halt(w, "police");
  say(w, cop, "Hold the game. Police business.", 4);
  if (man.off?.job === "referee") say(w, man, "(blows his own whistle) ...Yes, officer?", 4);
  send(cop, { x: at.x - 1.3, y: at.y }, true);
  news(w, "PLAY IS SUSPENDED. PLEASE REMAIN IN YOUR SEATS.", "tannoy_teamnews");
}
/** Everybody on their marks, and the cut. */
function action(w: World, sc: SchemeState, cop: Actor, man: Actor): void {
  const at = here(w, sc), cp = { x: at.x - 1.3, y: at.y };
  pin(w, man, at, 30, cp); pin(w, cop, cp, 30, at);
  if (sc.vars.pitch) mates(w, sc).forEach((a, i) => { matchfx.hold(w, a.id, true); pin(w, a, { x: at.x + 2.2, y: at.y + (i ? -1.7 : 1.7) }, 30, at); });
  play(w, DEF, sc, at);
  chain(w, sc, sc.vars.pitch ? "PLAY STOPS. A COPPER WALKS ONTO THE PITCH" : "A COPPER WANTS A WORD", at);
}
/** Let go: police.ts does the search it always did, this same tick, wherever the scene has got them to. */
const search: Go = (w, sc) => {
  const st = w.state.stadium!, { cop, man } = cast(w, sc), at = touch(w, sc);
  if (sc.vars.pitch && sc.vars.found) { pin(w, cop, { x: at.x - 1, y: at.y - 0.6 }, 4, at); pin(w, man, at, 4); }
  sc.vars.searched = 1; st.flags.searchHold = 0;
  if (man) { matchfx.hold(w, man.id, false); man.moveX = man.moveY = 0; if (man.npc) man.npc.staged = 0; }
};
/** Whatever happened, the game goes on. */
function wrap(w: World, sc: SchemeState): void {
  const m = w.state.match!;
  for (const a of mates(w, sc)) matchfx.hold(w, a.id, false);
  sc.vars.over = 1;
  if (m.halted === "police") matchfx.resume(w);
}
const ARREST: Beat[] = [
  B(2.2, here, copSays("Random drugs test, sir. Pockets."), { caption: "A RANDOM DRUGS TEST" }),
  // He turns them out himself, to prove a point. The point lands on the grass.
  B(2.6, here, (w, sc) => { const { man } = cast(w, sc), it = dirty(w, man); manSays("Querem ver? Olhem! Nada! NADA!", "¿Quieren ver? ¡Miren! ¡Nada! ¡NADA!", "Go on, then! Look! Nothing! NOTH...")(w, sc); if (man && it) moveItem(w.state, it.id, { k: "ground", x: man.x + 0.5, y: man.y + 0.4 }); }, { link: "HE TURNS HIS OWN POCKETS OUT. SOMETHING LANDS ON THE GRASS" }),
  B(2.4, here, (w, sc) => { const { man } = cast(w, sc), it = man && Object.values(w.state.items).find((i) => hot(i) && i.loc.k === "ground" && dist(i.loc, man) < 1.5); manSays("...Isso já estava na relva.", "...Eso ya estaba en el pasto.", "...That was already on the grass.")(w, sc); if (man && it) moveItem(w.state, it.id, { k: "pocket", a: man.id }); }),
  B(2.6, here, copSays("You do not have to say anything. It's on my little card.")),
  // Led off in his boots; his mates see him off.
  B(2.6, here, (w, sc) => {
    const { cop, man } = cast(w, sc), t = touch(w, sc), ms = mates(w, sc);
    manSays("Liguem à minha mãe! E ao cônsul!", "¡Llamen a mi vieja! ¡Y al cónsul!", "Ring me mum! Then ring me agent!")(w, sc);
    say(w, ms[0], tongue(sc, "Bravo, craque. Bravo.", "Bravo, crack. Bravo.", "Well done, mate. No, really. Well done."), 2.6); say(w, ms[1], "(slow clap)", 2.6);
    if (!sc.vars.pitch || !man || !cop?.npc) return;
    const d = dist(man, t) || 1; man.moveX = ((t.x - man.x) / d) * 0.7; man.moveY = ((t.y - man.y) / d) * 0.7;
    cop.npc.staged = 0; send(cop, { x: t.x - 1, y: t.y - 0.6 });
  }, { link: "LED OFF IN HIS BOOTS, TO A SLOW HANDCLAP" }),
  B(2.4, touch, search),
  { secs: 3, at: me, go: (w, sc) => {
    const m = w.state.match!, { man } = cast(w, sc), t = man?.fb?.team ?? 1, left = m.teams[t].squad.filter((id) => w.state.actors[id]?.fb?.status === "playing").length, side = m.teams[t].name.toUpperCase();
    wrap(w, sc); sc.vars.result = sc.vars.eng ? -3 : 3;
    news(w, `${side} ${left < 11 ? `DOWN TO ${NUM[left] ?? left}` : "MAKE A CHANGE"}. ${called(man)} IS HELPING POLICE.`, "tannoy_teamnews");
    chain(w, sc, `${side} LOSE ${called(man)} TO THE POLICE`, man);
    mutter(w, sc.vars.eng ? "That was one of ours. Bollocks." : "Heh heh heh.");
  } },
];
const role = (a?: Actor) => (a?.off?.job === "referee" ? "the REFEREE" : a?.off?.job === "fourth" ? "the FOURTH OFFICIAL" : "a LINESMAN");

const DEF: SchemeDef = {
  id: "drugs", title: "A random drugs test",
  on: () => PACE.calm,
  clues: [
    { id: "ricky", note: "Spliff Ricky delivers. His number's on the wall of the pub bogs.", mutter: "Ricky." },
    { id: "gear", note: "A bag off Ricky's thirty quid. A copper who finds one has had a good day.", mutter: "" },
    { id: "near", note: "Their boot bags sit by the coach at the hotel. Their ten's is on top.", mutter: "" },
    { id: "tip", note: "Give a copper a name and he turns that man's pockets out. Any man's.", mutter: "Any man's." },
    { id: "stop", note: "They'll walk onto a pitch for it. Not till the ball's dead.", mutter: "" },
  ],
  conds: [
    { id: "gear", clue: "ricky", known: "He's got hold of something a copper would love.", unknown: "What gets a man in shorts nicked?", test: (w, sc) => (pcOf(w) && dirty(w, pcOf(w)) ? "on him" : sc.vars.placed ? "placed" : "") },
    { id: "on", clue: "near", known: "It's on a man who's on the team sheet.", unknown: "How do you get that close to one of them?", test: (w, sc) => { const c = carrier(w); return c ? (c.hand && hot(w.state.items[c.hand]) ? "hand" : sc.vars.bag ? "boot bag" : "pocket") : stash(w) ? "boot bag" : ""; } },
    { id: "told", clue: "tip", known: "A copper's got a name.", unknown: "Who goes through a footballer's pockets?", test: (_w, sc) => (sc.vars.tip ? (sc.vars.phone ? "999" : "copper") : "") },
  ],
  actions: [
    { id: "bag", label: "Zip the gear into the boot bag", hint: "In with the boots. He carries it in himself.", priority: 78,
      can: (w, pc, sc) => { const b = bag(w), g = carried(w, pc).find((i) => i.def === "powder"); return !sc.variant && g && b && ((b.loc.k === "ground" && dist(pc, b.loc) < 2.4) || (b.loc.k === "hand" && b.loc.a === pc.id)) ? null : "no"; },
      run: (w, pc, sc) => {
        const b = bag(w)!, g = carried(w, pc).find((i) => i.def === "powder")!;
        moveItem(w.state, g.id, { k: "in", c: b.id }); g.plantedBy = pc.id; sc.vars.bag = 1; sc.vars.placed = 1;
        w.bus.emit({ type: "scheme_did", t: w.state.tick, scheme: "drugs", what: "bag", x: pc.x, y: pc.y });
        crime(w, pc, "going through the team's kit", 1, undefined, false); // only if the driver or a steward's looking
      } },
    // The sheet a copper's handed only lists their players; one of ours, or the referee, has to be said out loud.
    { id: "grass", label: "Tell the copper who's carrying", hint: "He goes and looks. Whoever it is.", priority: 16,
      can: (w, pc, sc) => { const c = carrier(w); return !sc.variant && c && (c.off || c.fb?.team === 0) && copNear(w, pc, 3.6) && !w.state.stadium!.tipoffs.some((t) => t.target === c.id && t.stage !== "done") ? null : "no"; },
      run: (w, pc) => { dispatch(w, { verb: "report", actor: pc.id, target: { k: "actor", id: carrier(w)!.id } }); } },
  ],
  variants: [
    { id: "nicked", when: (sc) => has(sc, "told") && !!sc.vars.found && !sc.vars.eng, beats: ARREST },
    // Exactly as well, on the wrong side.
    { id: "own", when: (sc) => has(sc, "told") && !!sc.vars.found && !sc.vars.off, beats: ARREST },
    { id: "whistle", when: (sc) => has(sc, "told") && !!sc.vars.found, beats: [
      B(2.2, here, copSays("Random drugs test, sir. Pockets."), { caption: "A RANDOM DRUGS TEST" }),
      B(2.4, here, (w, sc) => say(w, cast(w, sc).man, `I am ${role(cast(w, sc).man)}!`)),
      B(2.4, here, copSays("Then you'll know the rules, sir.")),
      B(2.8, here, (w, sc) => say(w, cast(w, sc).man, "Whistle. Cards. A coin. And... oh. Oh dear."), { link: "WHISTLE, CARDS, A COIN, AND A BAG OF SOMETHING" }),
      B(2.6, here, (w, sc) => say(w, cast(w, sc).man, "(shows himself the red card)"), { link: "HE SENDS HIMSELF OFF" }),
      B(2.4, touch, search),
      { secs: 3, at: me, go: (w, sc) => { const { man } = cast(w, sc); wrap(w, sc); sc.vars.result = 2; news(w, "THE MATCH OFFICIAL HAS BEEN UNAVOIDABLY DETAINED.", "tannoy_teamnews"); chain(w, sc, `${role(man).toUpperCase()} IS TAKEN AWAY IN A VAN`, man); mutter(w, "Nobody's refereeing that. Good."); } },
    ] },
    // A name, and nothing to find.
    { id: "clean", when: (sc) => has(sc, "told"), beats: [
      B(2.2, here, copSays("Random drugs test, sir. Pockets."), { caption: "A RANDOM DRUGS TEST" }),
      B(2.6, here, copSays("One shin pad. One photograph of his mum."), { link: "A SHIN PAD AND A PHOTOGRAPH OF HIS MOTHER" }),
      B(2.8, here, manSays("A minha mãezinha... (chora)", "Mi viejita... (llora)", "That's me mum, that. (sobs)")),
      B(2.6, here, search),
      { secs: 3, at: me, go: (w, sc) => {
        const pc = pcOf(w), tip = tipOf(w, sc), { cop } = cast(w, sc);
        wrap(w, sc); sc.vars.result = -1; learn(w, DEF, sc, "ricky", true);
        news(w, "POLICE THANK THE PUBLIC. ONE MEMBER OF IT IN PARTICULAR.");
        if (!cop?.npc || !pc || tip?.by !== pc.id) return void say(w, cop, "Anonymous. It's always anonymous.", 3.5);
        say(w, cop, "Right. Who gave me that name? The fat lad.", 3.5);
        alert(w, cop, pc, 1, 1.4); chain(w, sc, "THE COPPER WANTS A WORD WITH WHOEVER SAID IT", cop); mutter(w, "Ah.");
      } },
    ] },
    // Gear, and nobody told: the kit man does the laundry.
    { id: "kitman", when: (sc) => has(sc, "on"), beats: [
      B(2.6, here, (w, sc) => { const at = here(w, sc), k = spawnStaff(w, "cook", "catering", tongue(sc, "Zé the kit man", "Pepe the kit man", "Nobby the kit man"), at.x, at.y, { lines: ["Busy. Busy busy busy.", "I've ironed the socks. Both sides."] }); pin(w, k, at, 9); say(w, k, "Dirty kit in the basket, lads. ...Hello."); }, { caption: "MEANWHILE: HALF-TIME, THE DRESSING ROOM" }),
      B(2.6, here, (w) => { const it = dirty(w, carrier(w)), k = kitman(w); if (it && k) moveItem(w.state, it.id, k.hand ? { k: "gone" } : { k: "hand", a: k.id }); say(w, k, "Finders keepers. I'll just check it's safe."); }, { link: "THE KIT MAN GOES THROUGH THE SHORTS" }),
      B(2.8, here, (w, sc) => {
        const k = kitman(w), at = here(w, sc); if (!k?.npc) return;
        if (k.hand) moveItem(w.state, k.hand, { k: "gone" });
        say(w, k, "RIGHT! WHO WANTS THEIR BOOTS DONE? ALL OF YOU!", 3.5); k.speed = 3.4; k.npc.staged = 0;
        k.npc.plan = [0, 1, 2, 3].flatMap((i) => [{ k: "go" as const, x: at.x + (i % 2 ? -3 : 3), y: at.y, run: true }, { k: "say" as const, text: i % 2 ? "Socks! Give me your socks!" : "I can hear my own hair." }]);
      }, { link: "A KIT MAN WHO HAS NEVER WORKED SO HARD" }),
      { secs: 2.6, at: me, go: (w, sc) => { sc.vars.result = 1; learn(w, DEF, sc, "tip", true); news(w, "NO ARRESTS AT HALF-TIME. ONE VERY BUSY KIT MAN."); mutter(w, "Thirty quid. Up a kit man's nose."); } },
    ] },
    { id: "none", when: () => true, beats: [] },
  ],
  init: (w) => {
    w.bus.on((e: any) => {
      const s = w.state, st = s.stadium, sc = schemeState(w, "drugs");
      if (!st || !sc) return;
      if (e.type === "contact" && e.id === "dealer") learn(w, DEF, sc, "ricky", true);
      if (e.type === "planted" && e.by === st.pc) sc.vars.placed = 1;
      const t = s.actors[e.who ?? e.on];
      if ((e.type === "tipoff_arrest" || e.type === "false_arrest") && (t?.fb || t?.off)) { sc.vars.arrested = 1; if (t.off) sc.vars.arrestedOfficial = 1; if (t.fb?.team === 0) sc.vars.arrestedOurs = 1; }
      // No referee: the match goes on the way it does without one (matchfx.standDown is that path, and says so on
      // the bus). The two-referees scheme does the same for itself when it's on; once is enough.
      if (e.type === "tipoff_arrest" && t?.off?.job === "referee" && !schemeState(w, "referee")) matchfx.standDown(w);
      // A name, for a man on the team sheet: the search waits for the scene.
      if (e.type === "tipoff" && !sc.vars.tip && !sc.variant && (t?.fb || t?.off)) { sc.vars.tip = st.tipoffs.length; sc.vars.phone = e.phone ? 1 : 0; st.flags.searchHold = s.tick + 120; learn(w, DEF, sc, "tip", true); }
    });
  },
  step: (w, sc) => {
    const s = w.state, st = s.stadium!, m = s.match!, tick = s.tick, pc = pcOf(w);
    if (!pc) return;
    // What people say to nobody, in Grozz's hearing. Ricky has a voice; so has everyone who knows him.
    if (!sc.variant) {
      aside(w, sc, "land", who(w, (a) => a.npc!.shop === "pub"), [["Spliff Ricky's barred. His number's still on my bog wall.", "ricky"]]);
      aside(w, sc, "ricky", who(w, (a) => a.npc!.shop === "dealer"), [["Thirty a bag. Don't sneeze near a copper with it.", "gear"]]);
      aside(w, sc, "cop", sc.vars.tip ? undefined : copNear(w, pc, 7), [["Give me a name and I'll turn his pockets out. Anyone's.", "tip"], ["Footballers? We wait till the ball's dead. Then we go on.", "stop"]]);
      aside(w, sc, "drv", st.vehicles.bus?.state === "parked" ? s.actors[st.vehicles.bus.driver] : undefined, [["Boot bags by the back wheel. Their ten's on top.", "near"]]);
      if (areaAt(pc.x, pc.y).id === "pub_toilet" && !st.flags.contact_dealer) { dispatch(w, { verb: "callin", actor: pc.id, arg: "ricky" }); mutter(w, "RICKY. And a number. In biro."); }
      if (carried(w, pc).some((i) => i.def === "powder")) learn(w, DEF, sc, "gear", true);
      const b = bag(w); if (b && b.loc.k === "ground" && dist(pc, b.loc) < 3) learn(w, DEF, sc, "near");
    }
    // The boot bag goes where the boots go: packed, or found, it's his, and so is what's in it.
    const b = bag(w), g = stash(w), owner = b?.owner ? s.actors[b.owner] : undefined;
    if (b && b.loc.k !== "gone") sc.vars.bagDown = b.loc.k === "ground" ? 1 : 0;
    else if (g && owner && sc.vars.bagDown) { moveItem(s, g.id, { k: "pocket", a: owner.id }); w.bus.emit({ type: "planted", t: tick, by: pc.id, on: owner.id, item: g.def }); }

    // A name's been given. Keep the search back till the copper's there and the ball's dead; then it's a scene.
    const tip = tipOf(w, sc), { cop, man } = cast(w, sc);
    if (tip && !sc.vars.searched) {
      if (!sc.variant && (tip.stage === "done" || !cop?.npc || cop.dead || !man || man.dead || man.fb?.status === "gone" || m.phase === "finished" || m.phase === "shootout")) {
        // It's lapsed (or been dealt with the old way): let go of everything.
        st.flags.searchHold = 0; if (man) matchfx.hold(w, man.id, false); if (sc.vars.go) wrap(w, sc);
        sc.vars.tip = 0; sc.vars.go = 0;
      } else if (cop?.npc && man) {
        st.flags.searchHold = tick + 120;
        const waiting = tip.stage === "waiting" && cop.npc.mode === "routine" && !man.hiddenIn;
        if (!sc.vars.go) {
          const live = inPlay(w, man);
          if (waiting && has(sc, "told") && (!live || m.phase === "restart" || man.off?.job === "referee")) begin(w, sc, cop, man);
          else if (waiting && live) {
            // Stood at the mouth of the tunnel till play stops. Anybody can see what he's waiting for.
            cop.npc.plan = [{ k: "wait", s: 1 }]; cop.facing = Math.atan2(man.y - cop.y, man.x - cop.x);
            if (tick >= (sc.vars.nag ?? 0)) { sc.vars.nag = tick + 60 * 13; say(w, cop, ["(looks at his watch)", "Ball goes dead, I go on. Not before.", "Kick it out, one of you. I'm on overtime."][(sc.vars.nags = (sc.vars.nags ?? 0) + 1) % 3]); if (dist(pc, cop) < 12) learn(w, DEF, sc, "stop"); }
          }
        } else if (!sc.variant) {
          if (sc.vars.pitch && !m.halted) matchfx.halt(w, "police");
          const at = man.fb ? here(w, sc) : { x: man.x, y: man.y }, cp = { x: at.x - 1.3, y: at.y }, d = dist(man, at);
          if (!man.fb) { sc.vars.x = at.x; sc.vars.y = at.y; }
          else if (sc.vars.pitch) { man.moveX = d > 0.8 ? ((at.x - man.x) / d) * 0.8 : 0; man.moveY = d > 0.8 ? ((at.y - man.y) / d) * 0.8 : 0; }
          if (sc.vars.pitch && dist(cop, cp) > 1.2) send(cop, cp, true);
          if ((dist(cop, cp) < 2 && d < 1.3) || tick > sc.vars.go + 60 * 26) action(w, sc, cop, man);
        } else if (sc.vars.pitch && !m.halted && !sc.vars.over) matchfx.halt(w, "police");
      }
    }
    // Nobody told: at half-time the kit man goes through the shorts.
    if (m.phase === "break" && m.period === 1) sc.vars.brk = sc.vars.brk || tick;
    const c = carrier(w);
    if (!sc.variant && !sc.vars.tip && sc.vars.brk && m.phase === "break" && tick > sc.vars.brk + 60 * 45 && c?.fb && has(sc, "on")) {
      const room = c.fb.team === 0 ? SPOTS.homeRoom : SPOTS.awayRoom;
      Object.assign(sc.vars, { eng: c.fb.team === 0 ? 1 : 0, x: room.x, y: room.y + 2.4 });
      play(w, DEF, sc, room);
    }
  },
  things: (w, sc) => {
    const out: Thing[] = [], s = w.state, b = bag(w), tip = tipOf(w, sc), cop = tip ? s.actors[tip.officer] : undefined;
    if (b && b.loc.k === "ground" && sc.clues.near && !s.stadium!.flags.bootChecked) out.push({ x: b.loc.x, y: b.loc.y, z: 1.2, mark: stash(w) ? "gear in with the boots" : "their ten's boots" });
    if (cop && tip!.stage === "waiting" && !sc.vars.go && s.match!.phase === "live") out.push({ x: cop.x, y: cop.y, z: 2.1, mark: "waiting for the ball to go dead" });
    return out;
  },
};

export function installDrugs(): void { defineScheme(DEF); }

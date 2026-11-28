// More things that go off when you touch them, all round the district and inside the ground: bins, signs,
// the police van, the phone box, fuse boxes, a valve, the tannoy. Built the way rigs.ts builds its five
// (the same verb, the same one tap, the same readiness), and like them each is only the first push: what
// follows is somebody's problem (machine.ts), a crowd pulled somewhere (attraction), a man off his post
// (leavePost), a thing people believe, a queue for the gents, or play stopped through matchfx. Nothing
// here is a rule. Each one ends by itself, and can't be done again until it has.
// Where one honestly touches the football it goes through the two doorways everything else uses: matchfx
// (play stopped, the referee's eye off it) and a football state (fstates.ts). It never scripts what happens next.
// Seen at it by staff, it's a minor offence (security.ts): clocked the first time, a word the second.
// What people say about one is rationed (cue, below): one line every ten seconds per thing at the most, never
// the same line twice running, because a street of people saying the same thing is noise.
// Game build only (PACE.calm), so the older tests see the forecourt they were written against.
import type { World } from "../core/world";
import type { Actor, Id } from "../core/types";
import { spawnItem } from "../core/items";
import { chance, pick } from "../core/rng";
import { areaAt, PACE, SPOTS, VENUE } from "./layout";
import { say, spawnStaff } from "./npc";
import { carry, linkCause } from "./cause";
import { attention, free, leavePost, problem, stim } from "./machine";
import { urge } from "./social";
import { matchfx } from "./matchfx";
import { setState, sideName, type TeamIdx } from "./fstates";
import { dirOf } from "../football/util";
import { flinch, people, registerRig, RIGS, type RigCtx, type RigDef, type RigState } from "./rigs";

type At = { x: number; y: number };
const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
const P = (x: number, y: number): At => ({ x: mx(x), y });
const dist = (a: At, b: At) => Math.hypot(a.x - b.x, a.y - b.y);
const SUR = (a: Actor) => (a.name.split(" ").pop() ?? "").toUpperCase();
const game = (w: World) => PACE.calm && !!w.state.stadium;
const notFinal = (w: World) => game(w) && VENUE.id !== "final";
const named = (w: World, name: string) => Object.values(w.state.actors).find((a) => a.name === name && !a.dead);
const keeper = (w: World, shop: string) => Object.values(w.state.actors).find((a) => a.npc?.shop === shop && !a.dead);
/** Nothing else on: he can be given this. */
const idle = (w: World, a: Actor | undefined): a is Actor => free(w, a) && !a.npc!.duty && !a.npc!.drawn && !a.fb && !a.off;
/** The nearest of a sort with nothing else on. */
const nearest = (w: World, at: At, f: (a: Actor) => boolean): Actor | undefined =>
  Object.values(w.state.actors).filter((a) => idle(w, a) && f(a)).sort((p, q) => dist(p, at) - dist(q, at))[0];
const job = (...jobs: string[]) => (a: Actor) => jobs.includes(a.npc!.job);
const playing = (w: World) => { const m = w.state.match; return !!m && (m.phase === "live" || m.phase === "restart"); };
/** Stop the football for this, if it's being played and nothing else has stopped it. */
function stop(w: World, why: string): boolean {
  const m = w.state.match;
  if (!m || !playing(w) || m.halted) return false;
  matchfx.halt(w, why);
  return m.halted === why;
}
const restart = (w: World, why: string) => { if (w.state.match?.halted === why) matchfx.resume(w); };
/** Whose problem it is, when it's somebody's in particular: he sees to it when he's free (machine.ts), not only if he's free this second. */
const whose = (a: Actor | undefined) => (a && !a.dead ? a.id : undefined);
/** The side defending the half a thing is in (teams change ends at half-time). */
const defending = (w: World, x: number): TeamIdx => (dirOf(w.state.match!, 0) === -(Math.sign(x) || -1) ? 0 : 1);

/** A line waiting to be said about one of these: by somebody in particular, or by whoever turns up to see to its problem. */
interface Cue { rig: string; who?: Id; need?: string; text: string; at: number; until: number }
export interface PrankState {
  /** Supporters pulled out of their seats by something here: sent back when it's over. */
  strays: Id[]; until: number; stims: number[];
  /** What's waiting to be said, when each thing was last spoken about, and the last line picked for it. */
  cues: Cue[]; said: Record<string, number>; last: Record<string, string>;
}
const mine = (w: World): PrankState => (w.state.stadium!.pranks ??= { strays: [], until: 0, stims: [], cues: [], said: {}, last: {} });
/** A crowd pulled by one of these may come out of the stands: remember the pull, so they're seen back to their seats. */
function watch(w: World, stimId: number, secs: number): void {
  const p = mine(w);
  p.stims.push(stimId); p.until = Math.max(p.until, w.state.tick + 60 * (secs + 45));
}
/** How long between two lines about the same thing. */
const LINE_GAP = 60 * 10;
/** Somebody has something to say about it: a person, or (given a problem's key) whoever is stood there seeing to it.
 *  Said when its turn comes (stepPranks), which may be a few seconds on, or never if the moment's gone. */
function cue(w: World, rig: string, who: Actor | string | undefined, pool: readonly string[], inSecs = 0): void {
  if (!who) return;
  const p = mine(w), tick = w.state.tick;
  let text = pick(w.state.rng.world, pool as string[]);
  if (text === p.last[rig]) text = pool[(pool.indexOf(text) + 1) % pool.length];
  p.last[rig] = text;
  const at = tick + Math.round(60 * inSecs);
  p.cues.push({ rig, ...(typeof who === "string" ? { need: who } : { who: who.id }), text, at, until: at + 60 * (typeof who === "string" ? 80 : 14) });
}

/** What people say, by what it's about. Four ways of saying each at the least. */
export const SAY: Record<string, readonly string[]> = {
  binPub: ["Every match day. EVERY match day.", "I only put that out this morning.", "That's the council's bin. I'm not paying for it.", "Animals. I serve animals."],
  binPawn: ["I've a shop to run! Animals!", "Who's paying for this? Nobody. As usual.", "There was a perfectly good pie in there.", "Forty years on this street. Look at it."],
  signFan: ["Entrance is this way, look. Says so.", "Hang on, it's THIS way now.", "They've moved the entrance. Typical.", "This way, lads. The sign says."],
  signStw: ["Who's turned this round? There's a queue at a WALL.", "Every match. Every single match.", "It points at the BINS. Who does this?", "Round it goes. And stay round."],
  van: ["Flat as a pancake. And the jack's in the OTHER van.", "Who carries a jack? I don't carry a jack.", "That was fine when I parked it.", "Thirty-eight quid, a tyre. Out of MY budget."],
  phoneA: ["Three Lions. ...Hello? HELLO?", "Three Lions, we're busy. ...Hello?", "If this is about the karaoke, no. ...Hello?", "Three Lions. Speak up! ...Anyone?"],
  phoneB: ["Heavy breathing. On a MATCH day.", "Nobody there. Nobody's EVER there.", "Kids. It'll be kids.", "Hung up. I ran for that."],
  soldFan: ["SOLD OUT? I've come from Carlisle!", "Sold out? It was open a minute ago!", "Sold OUT? I took the day off!", "It can't be sold out. I can see empty seats!"],
  soldDel: ["Sold out, is it? Seventy now. Each.", "Form an orderly queue, gents. Cash.", "Funny thing, I've two left. Call it eighty.", "Supply and demand, my son. Ninety."],
  soldStw: ["It's NOT sold out! Who's turned that round?", "Calm down! There's hundreds left!", "It says TICKETS on the other side. Look.", "Nobody panic. It's a bit of card."],
  fusePunter: ["Who's turned the lights off?", "Oi! The telly's gone off!", "I can't see me pint!", "Power cut! Everybody out!"],
  fuseBoss: ["Who's had the fuse out? I'll have his hands.", "Thirty years I've had this pub. Thirty years.", "It doesn't pull ITSELF out.", "The fridges are on that. The FRIDGES."],
  buntTrip: ["Who put that THERE?", "Me knee! Me good knee!", "I've gone over on the flags!", "That's a lawsuit, that is."],
  buntStw: ["Health and safety nightmare, this.", "Who's had the bunting down? It's a World Cup!", "Thirteen metres of it. In the wet.", "It took Dennis a morning to hang that."],
  cableRep: ["We've lost the feed! We were LIVE!", "We're off air! Find the cable!", "Dead air! That's my career, that is!", "The studio's gone! Who's touched the truck?"],
  cableFix: ["Who's pulled this out? WHO?", "It doesn't fall out. It's a LOCKING plug.", "Twelve million viewers. One plug.", "Back in. Don't anybody breathe on it."],
  horseA: ["Don't feed him, sir, he's got a delicate... oh. He's had it.", "Not kebab, sir. Anything but... well. Too late.", "He's on a special diet, that horse. Was.", "Sir, he can't have chilli sauce. Oh no."],
  horseB: ["He's never done that before.", "Stand back. Further than that.", "That's coming out of somebody's wages.", "Don't look at me. Look at HIM."],
  horseMop: ["I'm not paid enough. I am NOT paid enough.", "A shovel. I need a shovel and a pay rise.", "The roses'll love it. I don't.", "Every week. A different animal."],
  skipReg: ["Forty years. Forty years and they set fire to me skip.", "That's me good skip!", "There's a mower in there! Was.", "Who lights a SKIP? In the rain?"],
  gasMaid: ["It's gone off. It's just FOAM.", "Nothing. Not a drop. Don't look at me like that.", "The lager's off. No, ALL of it.", "It's hissing. Why's it hissing?"],
  gasFix: ["Who's been at my cellar tap?", "It was ON. I know it was on.", "Lefty loosey. There.", "Somebody's turned this. That's theft, that."],
  barRow: ["One at a time! It's only lager!", "Back from the bar! BACK from the bar!", "Nobody's dying of thirst! Queue!", "It's a bar, not a lifeboat!"],
  tannoyMaid: ["Free? Who said FREE?", "Nothing's free! Who told you free?", "Free pints? In THIS ground?", "I never said free. I've never said free."],
  tannoyFiesta: ["That's MY car! That's my Fiesta!", "Car on fire? Mine's in the car park!", "Not the Fiesta. NOT the Fiesta!", "I've only just had it valeted!"],
  tannoyFire: ["There's no fire. There's not even a Fiesta.", "Car park's fine. Who rang that in?", "Not so much as a warm bonnet.", "I ran for that. There's nothing."],
  tannoyChild: ["Has anyone seen Mike Hunt? ...Oh, very good. Very funny.", "Mike Hunt? Anybody? ...Why are you all laughing?", "Calling Mike Hunt. Has anyone... oh. Oh, I see.", "Mike Hunt! Is Mike Hunt here? ...Right. Who wrote this?"],
  lights: ["It's the big red one. ...Which big red one?", "Who's got a torch? Has ANYONE got a torch?", "Don't touch anything. I said DON'T touch it.", "It says floodlights. Somebody's pulled it clean out."],
  sprinklers: ["REG! Where's the... oh. Lefty loosey.", "I'm soaked. I'm SOAKED.", "It's meant to be on a timer!", "Righty tighty. Righty. TIGHTY."],
  scoreFan: ["SEVEN? When did they score SEVEN?", "Seven-nil? I only went for a pie!", "Nil-SEVEN? I've been here the whole time!", "Seven. I knew it. I KNEW it."],
  scoreStw: ["Seven-nil. Very funny. There's meant to be a lock on this.", "Who's been at the scoreboard? It's not a toy.", "Nil-seven. As if. ...As if.", "There's a keypad. Nobody uses the keypad."],
  ball: ["Whose is this? ...Well, whose is THAT one?", "Two balls. Brilliant. Which one's ours?", "Not that one. The OTHER one. Probably.", "I'll take this. No, you play with that."],
  hoarding: ["That's a four-grand advert, that.", "Give us a hand! ...No? Nobody?", "It was bolted down. It WAS.", "Up you come. Mind the lager logo."],
  medicA: ["Who's down? ...Nobody's down.", "Where's the casualty? ...There's no casualty.", "Stretcher for... who? Anyone?", "Somebody shouted. Who's hurt? Nobody?"],
  medicStw: ["Who's it for? ...Well, somebody shouted.", "Nobody? Then what are you two doing on?", "Off, the pair of you. They're all fine.", "False alarm. Again. Off you go."],
  dugout: ["That's not a formation. ...Is it?", "Every week. And always the same drawing.", "Wipe it off before the telly sees.", "They've been playing to THAT?"],
  sinks: ["Who does this? Who DOES this?", "Every week. In me good shoes.", "Plugs in, taps on. A classic.", "It's coming under the door. It's in the bar."],
};

// ---------------------------------------------------------------- outside

/** A wheelie bin, booted over: rubbish across the pavement (a mess, and whoever's bin it is has to come out to it),
 *  and something in it the dog would like. */
function bin(x: number, y: number, dx: number, its: (w: World) => Actor | undefined, label: string, lines: readonly string[], does: string): RigDef {
  return {
    label: "Boot the bin over", first: "GROZZ BOOTS A BIN OVER", r: 2.2, cool: 110, at: () => P(x, y), on: game, does, offence: "booting a bin over",
    step: (w, c) => {
      const s = w.state, spill = { x: c.at.x + mx(dx), y: c.at.y + 0.8 };
      c.emit({ over: true, to: spill });
      flinch(w, c.at, 5, 3);
      // Half a pie in among it. (It's been in a bin. Whoever eats it will know about it.)
      const old = c.r.item ? s.items[c.r.item] : undefined;
      if (!old || old.loc.k !== "ground") {
        const pie = spawnItem(s, "pie", { k: "ground", x: spill.x + mx(0.5 * Math.sign(dx)), y: spill.y + 0.3 });
        pie.label = "A pie out of the bin"; pie.spiked = "laxative"; c.r.item = pie.id;
      }
      const owner = its(w);
      problem(w, "mess", spill, { owner: whose(owner), key: c.id, cause: c.link("RUBBISH ALL OVER THE PAVEMENT", spill), fixSecs: 11, label: owner ? label : undefined });
      cue(w, c.id, c.id, lines);
      c.hold(85, 4);
    },
  };
}

/** A wayfinding sign, turned round: the next few supporters follow it to a blank wall and queue there
 *  (and a queue's a queue: others join). A turnstile steward has to come out and turn it back. */
function sign(x: number, y: number, wx: number, wy: number): RigDef {
  return {
    label: "Turn the sign round", first: "GROZZ TURNS THE SIGN ROUND", r: 2.2, cool: 120, at: () => P(x, y), on: notFinal,
    does: "Fans follow it to a blank wall. A gate steward comes to turn it back.", offence: "turning a sign round",
    step: (w, c) => {
      const wall = P(wx, wy);
      if (c.step === 1) {
        c.emit({ turn: true, to: wall });
        const lost = people(w, c.at, 20, (a) => a.npc!.job === "fan" && !a.seated && !VENUE.inside(a.x, a.y) && idle(w, a)).slice(0, 2);
        lost.forEach((a, i) => {
          a.npc!.group = undefined;
          a.npc!.plan = [{ k: "go", x: wall.x + (i ? 0.9 : -0.9), y: wall.y }, { k: "wait", s: 22 }];
          carry(a, c.r.cause ?? 0, c.tick, 40);
          w.bus.emit({ type: "flinch", t: c.tick, who: a.id, x: c.at.x, y: c.at.y });
        });
        cue(w, c.id, lost[0], SAY.signFan);
        c.link(lost.length ? "FANS FOLLOW IT TO A BRICK WALL" : "IT POINTS AT A BRICK WALL NOW", wall);
        stim(w, "queue", { x: wall.x, y: wall.y + 0.5 }, { r: 11, secs: 30, cap: 6, cause: c.r.cause, dx: 0, dy: 1 });
        c.next(12);
        return;
      }
      const stw = nearest(w, c.at, job("turnstile"));
      if (stw) { problem(w, "fallen", { x: c.at.x, y: c.at.y + 0.5 }, { owner: stw.id, key: c.id, cause: c.r.cause, fixSecs: 7, label: `${SUR(stw)} COMES OUT TO TURN IT BACK` }); cue(w, c.id, c.id, SAY.signStw); }
      c.hold(70, 6);
    },
  };
}

const dawson = (w: World) => named(w, "PC Dawson");
/** A tyre on the police van (the near back wheel): the copper minding it gets down to change it, head down. */
const vanTyre: RigDef = {
  label: "Let the tyre down", first: "GROZZ LETS THE VAN'S TYRE DOWN", r: 2.2, cool: 130,
  at: () => ({ x: SPOTS.policeVan.x - mx(1.7), y: SPOTS.policeVan.y + 1.15 }),
  on: (w) => notFinal(w) && !!dawson(w),
  does: "The copper gets down to change the wheel. Half a minute, head down.", offence: "letting a police van's tyre down",
  step: (w, c) => {
    if (c.step === 1) { c.emit({ hiss: true }); c.next(2.2); return; }
    const cop = dawson(w);
    c.emit({ flat: true });
    c.link("THE VAN SITS DOWN ON ONE CORNER");
    problem(w, "fallen", { x: c.at.x - mx(0.6), y: c.at.y + 0.3 }, { owner: whose(cop), key: c.id, cause: c.r.cause, fixSecs: 24, label: "DAWSON GETS DOWN TO CHANGE THE WHEEL" });
    cue(w, c.id, c.id, SAY.van);
    c.hold(75, 8);
  },
};

/** The phone box: ring the pub. The landlord leaves the bar to answer it, and the pumps are nobody's for a bit.
 *  (If he's out seeing to something else it rings till he's back behind the bar, or a quarter of a minute's gone.) */
const phone: RigDef = {
  label: "Ring the pub", first: "GROZZ RINGS THE PUB", r: 2.2, cool: 110, at: () => P(-30, 83.4), on: game,
  does: "The landlord leaves the bar to answer it. Nobody's minding the pumps.", offence: "making nuisance calls",
  step: (w, c) => {
    const s = w.state, boss = keeper(w, "pub");
    if (c.step === 1) { c.emit({ ring: true, to: SPOTS.pubBarman }); c.r.v = 0; c.next(1.6); return; }
    if (c.r.v) { c.emit({ hung: true }); c.done(); return; }
    if (!idle(w, boss) || !boss.npc!.post || dist(boss, boss.npc!.post) > 4) {
      if (c.step < 8) { c.next(2); return; }
      c.link("IT RINGS AND RINGS. NOBODY COMES"); c.emit({ hung: true }); c.done(); return;
    }
    const at = { x: SPOTS.pubBar.x + mx(8.6), y: SPOTS.pubBar.y + 3.2 };
    boss.npc!.plan = [{ k: "go", x: at.x, y: at.y, run: true }, { k: "wait", s: 13 }, { k: "go", ...boss.npc!.post }];
    cue(w, c.id, boss, SAY.phoneA, 3); cue(w, c.id, boss, SAY.phoneB, 13.5);
    const cause = leavePost(w, boss, c.link("THE LANDLORD LEAVES THE BAR TO ANSWER IT", boss), 26);
    // The bar with nobody behind it: whoever's near helps himself, and there's the one he was pulling.
    const e = stim(w, "freebie", { x: SPOTS.pubBar.x, y: SPOTS.pubBar.y + 0.4 }, { r: 12, secs: 15, cap: 4, cause, what: "the unattended pumps" });
    watch(w, e.id, 15);
    const old = c.r.item ? s.items[c.r.item] : undefined;
    if (!old || old.loc.k !== "ground") { const pint = spawnItem(s, "pint", { k: "ground", x: SPOTS.pubBar.x + mx(1.4), y: SPOTS.pubBar.y - 0.7 }); pint.label = "The pint he was pulling"; c.r.item = pint.id; }
    c.r.v = 1; c.next(24);
  },
};

/** The ticket office sign, flipped to SOLD OUT: the queue gives up and goes to the tout, and there's a row at the window. */
const soldOut: RigDef = {
  label: "Flip to SOLD OUT", first: "GROZZ FLIPS THE SIGN TO SOLD OUT", r: 2, cool: 130,
  at: () => ({ x: SPOTS.ticketWindow.x + mx(4.2), y: SPOTS.ticketWindow.y + 0.4 }), on: game,
  does: "The queue gives up and goes to the tout. A steward comes to the row.", offence: "tampering with the ticket office sign",
  step: (w, c) => {
    const s = w.state, win = { x: SPOTS.ticketWindow.x, y: SPOTS.ticketWindow.y + 0.7 };
    if (c.step === 1) {
      c.emit({ flip: true });
      const near = flinch(w, win, 9, 3).filter((a) => a.npc!.job === "fan" || a.npc!.job === "local")[0];
      const del = keeper(w, "tout");
      if (del) {
        const e = stim(w, "freebie", { x: del.x, y: del.y + 0.3 }, { r: 30, secs: 22, cap: 5, cause: c.r.cause, what: "the tout's last tickets" });
        watch(w, e.id, 22);
      }
      // One of them has something to say about it: whoever was at the window, or the man with tickets to shift.
      if (near && (!del || !free(w, del) || chance(s.rng.world, 0.5))) cue(w, c.id, near, SAY.soldFan); else if (del && free(w, del)) cue(w, c.id, del, SAY.soldDel);
      c.next(3.5); return;
    }
    problem(w, "row", win, { key: c.id, cause: c.link("A ROW AT THE TICKET WINDOW", win), fixSecs: 10, label: "A STEWARD COMES OUT TO THE TICKET OFFICE" });
    cue(w, c.id, c.id, SAY.soldStw);
    c.hold(65, 6);
  },
};

/** The pub's main fuse, on the yard wall: lights out, everybody comes outside with their pints, and the landlord goes to the box. */
const pubFuse: RigDef = {
  label: "Pull the pub's fuse", first: "GROZZ PULLS THE PUB'S FUSE", r: 2.1, cool: 140, at: () => P(-33.6, 76.6),
  on: (w) => game(w) && !VENUE.features.fanZone,
  does: "Lights out. The pub empties into the street. He goes to the box.", offence: "pulling the pub's fuse",
  step: (w, c) => {
    const s = w.state;
    if (c.step === 1) {
      c.emit({ out: true });
      const inPub = Object.values(s.actors).filter((a) => idle(w, a) && (a.npc!.job === "fan" || a.npc!.job === "local") && !a.npc!.shop && areaAt(a.x, a.y).id.startsWith("pub") && areaAt(a.x, a.y).id !== "pub_yard").slice(0, 12);
      inPub.forEach((a, i) => {
        a.npc!.group = undefined;
        a.npc!.plan = [{ k: "wait", s: 0.4 + i * 0.25 }, { k: "go", x: mx(-50 + (i % 6) * 1.5), y: 82 + Math.floor(i / 6) * 1.1 }, { k: "wait", s: 20 }];
        carry(a, c.r.cause ?? 0, c.tick, 40);
      });
      cue(w, c.id, inPub[0], SAY.fusePunter);
      if (inPub.length) c.link("EVERYBODY COMES OUTSIDE WITH THEIR PINTS", { x: mx(-46), y: 82 });
      c.next(1.4); return;
    }
    const boss = keeper(w, "pub");
    problem(w, "fallen", { x: c.at.x + mx(0.9), y: c.at.y }, { owner: whose(boss), key: c.id, cause: c.r.cause, fixSecs: 12, label: boss ? "THE LANDLORD GOES OUT TO THE FUSE BOX" : undefined });
    cue(w, c.id, c.id, SAY.fuseBoss);
    c.hold(60, 10);
  },
};

// (Across the way in, strung between the corners of the two shops either side of it: everybody going to the ground walks under it.)
const BUNT = { x0: -5, x1: 8, y: 62 };
/** The bunting across the approach, pulled down over the paving: people go over it, till a steward gathers it up. */
const bunting: RigDef = {
  label: "Pull the bunting down", first: "GROZZ PULLS THE BUNTING DOWN", r: 2.2, cool: 110, at: () => P(BUNT.x0 + 0.9, BUNT.y - 0.5), on: game,
  does: "People go full length over it. A gate steward comes to pick it up.", offence: "pulling the bunting down",
  step: (w, c) => {
    const s = w.state, x0 = Math.min(mx(BUNT.x0), mx(BUNT.x1)), x1 = Math.max(mx(BUNT.x0), mx(BUNT.x1)), mid = { x: (x0 + x1) / 2, y: BUNT.y - 0.6 };
    if (c.step === 1) { c.emit({ down: true }); c.r.v = 0; c.next(0.3); return; }
    // While it's lying there: whoever walks across it goes full length (four at most).
    if ((c.r.v ?? 0) < 4) for (const a of Object.values(s.actors)) {
      if (!free(w, a) || a.fb || a.off || a.seated || !["fan", "local"].includes(a.npc!.job) || a.x < x0 || a.x > x1 || Math.abs(a.y - (BUNT.y + 0.3)) > 0.55 || Math.hypot(a.vx, a.vy) < 0.3) continue;
      a.downUntil = c.tick + 80;
      w.bus.emit({ type: "bowled", t: c.tick, who: a.id, by: c.r.by, x: a.x, y: a.y });
      if (!c.r.v) { c.link(`${SUR(a)} GOES FULL LENGTH OVER IT`, a); cue(w, c.id, a, SAY.buntTrip, 1.2); }
      c.r.v = (c.r.v ?? 0) + 1;
      break;
    }
    if (c.step === 6) {
      const stw = nearest(w, mid, job("turnstile"));
      if (stw) { problem(w, "fallen", mid, { owner: stw.id, key: c.id, cause: c.r.cause, fixSecs: 8, label: `${SUR(stw)} COMES OUT TO GATHER IT UP` }); cue(w, c.id, c.id, SAY.buntStw); }
    }
    // It's a hazard till it's been picked up (or half a minute's gone).
    if (c.step > 20 && (c.step > 130 || !s.stadium!.problems?.some((p) => p.key === c.id))) { c.hold(1); return; }
    c.next(0.3);
  },
};

/** The TV truck's cable: the broadcast goes down, and the reporter and the camera run to the truck to find out why. */
const cable: RigDef = {
  label: "Unplug the TV truck", first: "GROZZ PULLS THE PLUG ON THE TELLY", r: 2.2, cool: 150, at: () => P(47.4, 66.2), on: game,
  does: "The telly goes off air. Reporter and camera run to the truck.", offence: "unplugging the outside broadcast",
  step: (w, c) => {
    const rep = named(w, "Reporter"), cam = named(w, "Cameraman");
    c.emit({ spark: true });
    c.link("THE BROADCAST GOES DOWN");
    const spot = { x: c.at.x + mx(0.6), y: c.at.y + 0.9 };
    if (rep) {
      if (free(w, rep)) cue(w, c.id, rep, SAY.cableRep);
      problem(w, "fallen", spot, { owner: rep.id, key: c.id, cause: c.r.cause, fixSecs: 12, label: "THE REPORTER RUNS TO THE TRUCK" });
      cue(w, c.id, c.id, SAY.cableFix);
    }
    if (idle(w, cam) && cam.npc!.post) {
      cam.npc!.plan = [{ k: "wait", s: 1.2 }, { k: "go", x: spot.x - mx(1.6), y: spot.y + 1.2, run: true }, { k: "wait", s: 14 }, { k: "go", ...cam.npc!.post }];
      leavePost(w, cam, c.link("THE CAMERA GOES WITH HIM", cam), 40);
    }
    c.hold(85, 6);
  },
};

const rider = (w: World) => Object.values(w.state.actors).find((a) => a.npc?.mounted && !a.dead);
/** Where the mounted copper is (kept from tick to tick, so the table's `at` has no world to ask). */
let HORSE: At = { x: 0, y: -999 };
/** Something for the police horse. What follows lands exactly where the mounted copper's stood. */
const horse: RigDef = {
  label: "Kebab for the horse", first: "GROZZ FEEDS THE POLICE HORSE A KEBAB", r: 2.4, cool: 140, at: () => HORSE,
  on: (w) => { const o = game(w) ? rider(w) : undefined; if (o) HORSE = { x: o.x, y: o.y }; return !!o && o.downUntil <= w.state.tick && o.npc!.mode === "routine"; },
  does: "Give it four seconds. Then nobody stands near that copper.",
  step: (w, c) => {
    const s = w.state, cop = rider(w);
    if (!cop) { c.done(); return; }
    if (c.step === 1) {
      c.emit({ feed: true, who: cop.id });
      cue(w, c.id, cop, SAY.horseA);
      if (free(w, cop)) cop.npc!.plan.unshift({ k: "wait", s: 4 });
      c.next(3.4); return;
    }
    const at = { x: cop.x - Math.cos(cop.facing) * 1.1, y: cop.y - Math.sin(cop.facing) * 1.1 + 0.2 };
    c.emit({ plop: true, to: at, who: cop.id });
    const cause = c.link("THE HORSE DOES WHAT HORSES DO", at);
    flinch(w, at, 6, 4);
    // It's a mess, and it's a stink: somebody's got to shovel it, and nobody will stand near it (him included).
    problem(w, "mess", at, { key: c.id, cause, fixSecs: 10 });
    s.stadium!.smoke.push({ x: at.x, y: at.y, r: 2.6, until: c.tick + 60 * 8, kind: "stench" });
    carry(cop, cause, c.tick, 30);
    cue(w, c.id, cop, SAY.horseB, 7); cue(w, c.id, c.id, SAY.horseMop, 12);
    c.hold(55, 12);
  },
};

/** The skip in the alley, set alight: smoke you can't see through, a scene, and Old Reg running from his shed with a bucket. */
const skip: RigDef = {
  label: "Torch the skip", first: "GROZZ SETS FIRE TO THE SKIP", r: 2.6, cool: 150, at: () => P(-65.5, -18), on: game,
  does: "Smoke nobody can see through. Old Reg runs over from his shed.", offence: "setting fire to a skip",
  step: (w, c) => {
    const s = w.state, top = { x: c.at.x, y: c.at.y - 0.9 };
    if (c.step === 1) { c.emit({ light: true }); c.next(2); return; }
    c.emit({ fire: true });
    const cause = c.link("THE SKIP GOES UP");
    s.stadium!.smoke.push({ x: top.x, y: top.y, r: 4.6, until: c.tick + 60 * 24 });
    stim(w, "spectacle", c.at, { r: 34, secs: 20, cause, cap: 3 });
    const reg = named(w, "Old Reg");
    problem(w, "fallen", { x: c.at.x + mx(2.4), y: c.at.y + 0.6 }, { owner: whose(reg), key: c.id, cause, fixSecs: 13, label: reg ? "OLD REG RUNS FOR A BUCKET" : undefined });
    cue(w, c.id, c.id, SAY.skipReg);
    c.hold(75, 20);
  },
};

// ---------------------------------------------------------------- inside the ground

function barRow(w: World, c: RigCtx, label: string): void {
  problem(w, "row", { x: SPOTS.barS.x, y: SPOTS.barS.y - 0.5 }, { key: `${c.id}_row`, cause: c.link(label, SPOTS.barS), fixSecs: 9, label: "A STEWARD COMES TO CALM THE BAR" });
  cue(w, c.id, `${c.id}_row`, SAY.barRow);
}

/** The gas tap at the end of the concourse bar: no lager, a row, and the barmaid off round the end to find out why. */
const gas: RigDef = {
  label: "Turn the lager off", first: "GROZZ TURNS THE LAGER OFF", r: 2, cool: 130, at: () => ({ x: SPOTS.barS.x - mx(7.9), y: 42 }), on: game,
  does: "No lager. A row at the bar, and she leaves it to find the tap.", offence: "turning the gas off at the bar",
  step: (w, c) => {
    const s = w.state, maid = keeper(w, "bar");
    if (c.step === 1) {
      c.emit({ off: true, to: SPOTS.barSman });
      if (maid && free(w, maid)) cue(w, c.id, maid, SAY.gasMaid);
      flinch(w, SPOTS.barS, 7, 3);
      c.next(2); return;
    }
    barRow(w, c, "NO LAGER. A ROW AT THE BAR");
    problem(w, "fallen", { x: c.at.x, y: c.at.y + 0.6 }, { owner: whose(maid), key: c.id, cause: c.r.cause, fixSecs: 9, label: maid ? "THE BARMAID GOES TO FIND THE GAS TAP" : undefined });
    cue(w, c.id, c.id, SAY.gasFix);
    // The one she was pulling when it went, left on the bar.
    const old = c.r.item ? s.items[c.r.item] : undefined;
    if (!old || old.loc.k !== "ground") { const pint = spawnItem(s, "pint", { k: "ground", x: SPOTS.barS.x + mx(1.6), y: SPOTS.barS.y + 0.5 }); pint.label = "The last pint before the gas went"; c.r.item = pint.id; }
    c.hold(60, 8);
  },
};

/** What goes out over the tannoy, and the four words of it that fit on the button. */
export const TANNOY = ["Free pints at the concourse bar", "There is a car on fire in the car park", "Would Mike Hunt come to the stewards' point"];
const TANNOY_SHORT = ["Free pints", "Car on fire", "Lost: Mike Hunt"];
const TANNOY_DOES = ["Fans leave their seats for the bar. There are no free pints.", "A copper and the telly run to the car park. Half a minute.", "A steward leaves the touchline to ask for him. Out loud."];
/** The tannoy microphone on the concourse wall. Three things to say into it, one after another; people believe a tannoy. */
const tannoy: RigDef = {
  label: "Use the tannoy", first: "GROZZ GETS ON THE TANNOY", r: 2, cool: 45, at: () => P(-55.2, 2), on: game,
  says: (w) => `Tannoy: "${TANNOY_SHORT[(w.state.stadium!.rigs?.tannoy?.n ?? 0) % 3]}"`,
  does: (w) => TANNOY_DOES[(w.state.stadium!.rigs?.tannoy?.n ?? 0) % 3], offence: "misusing the tannoy",
  step: (w, c) => {
    const msg = (c.r.n ?? 0) % 3;
    if (c.step === 1) { c.emit({ msg, text: TANNOY[msg] }); attention(w, c.at, 10, 2.5); c.next(1.8); return; }
    if (c.step > 2) { barRow(w, c, "THERE ARE NO FREE PINTS, AND IT'S HER FAULT"); c.r.n = (c.r.n ?? 0) + 1; c.done(); return; }
    if (msg === 0) {
      // Free pints: whoever fancies one goes to the bar. There aren't any, which is the barmaid's problem.
      const e = stim(w, "freebie", { x: SPOTS.barS.x, y: 38.7 }, { r: 60, secs: 22, cap: 7, cause: c.link("\"FREE PINTS AT THE BAR\"", SPOTS.barS), what: "free pints" });
      watch(w, e.id, 22);
      const maid = keeper(w, "bar");
      if (maid && free(w, maid)) cue(w, c.id, maid, SAY.tannoyMaid, 5);
      c.next(11); return;
    }
    if (msg === 1) {
      // A car on fire: the copper outside goes to look, the telly runs to film it, and somebody thinks it's his.
      const park = P(43, 74), cause = c.link("\"A CAR ON FIRE IN THE CAR PARK\"", park);
      stim(w, "spectacle", park, { r: 46, secs: 24, cause, cap: 2 });
      const cop = nearest(w, park, (a) => a.npc!.job === "police" && !a.npc!.mounted);
      if (cop) { problem(w, "fallen", park, { owner: cop.id, key: `${c.id}_fire`, cause, fixSecs: 9, label: `${SUR(cop)} GOES TO FIND THE FIRE` }); cue(w, c.id, `${c.id}_fire`, SAY.tannoyFire); }
      const fan = people(w, c.at, 60, (a) => a.npc!.job === "fan" && a.npc!.team !== 1 && !!a.npc!.seat && idle(w, a))[0];
      if (fan) {
        fan.npc!.stage = 2; fan.npc!.group = undefined;
        fan.npc!.plan = [{ k: "wait", s: 1.2 }, { k: "go", x: park.x + mx(1.5), y: park.y + 1.2, run: true }, { k: "wait", s: 6 }];
        cue(w, c.id, fan, SAY.tannoyFiesta);
        carry(fan, linkCause(w, cause, `${SUR(fan)} RUNS TO SAVE HIS FIESTA`, fan, "belief") || cause, c.tick, 60);
      }
    } else {
      // A lost child: a steward has to go into the stand and ask for him by name. Out loud.
      const stw = nearest(w, c.at, job("pitchsteward", "patrol"));
      const cause = c.link("\"WOULD MIKE HUNT COME TO THE STEWARDS' POINT\"");
      if (stw) {
        const to = areaAt(stw.x, stw.y).pitch ? { x: stw.x + Math.sign(stw.x || 1) * (Math.abs(stw.x) > 38 ? 3.4 : 0), y: stw.y + (Math.abs(stw.x) > 38 ? 2 : Math.sign(stw.y) * 3.4) } : { x: stw.x, y: stw.y + 3 };
        problem(w, "fallen", to, { owner: stw.id, key: `${c.id}_child`, cause, fixSecs: 8, label: `${SUR(stw)} GOES LOOKING FOR MIKE HUNT` });
        cue(w, c.id, `${c.id}_child`, SAY.tannoyChild);
      }
    }
    c.r.n = (c.r.n ?? 0) + 1;
    c.done();
  },
};

/** The floodlight fuse on the concourse wall: lights out, play stopped, and a steward hunting for the switch. */
const lights: RigDef = {
  label: "Pull the floodlight fuse", first: "GROZZ PULLS THE FLOODLIGHT FUSE", r: 2, cool: 120, at: () => P(-49.5, 43.2), on: game,
  does: (w) => (playing(w) ? "Play stops in the dark till a steward finds the switch." : "Dark all over the ground till a steward finds the switch."), offence: "pulling the floodlight fuse",
  step: (w, c) => {
    c.emit({ out: true });
    if (stop(w, "floodlights")) c.link("LIGHTS OUT. PLAY STOPPED"); else c.link("LIGHTS OUT ALL OVER THE GROUND");
    const stw = nearest(w, c.at, job("patrol")) ?? nearest(w, c.at, job("turnstile", "pitchsteward"));
    if (stw) { problem(w, "fallen", { x: c.at.x, y: c.at.y - 0.3 }, { owner: stw.id, key: c.id, cause: c.r.cause, fixSecs: 7, label: `${SUR(stw)} GOES TO FIND THE SWITCH` }); cue(w, c.id, c.id, SAY.lights); }
    // Dark till he's been to the box (or, if nobody comes, till the back-up cuts in).
    c.hold(40, 6);
  },
  undo: (w) => restart(w, "floodlights"),
};

/** How far out from the stand's front wall (at 28) the pitchside things sit: far enough to be seen over it from the
 *  front row, near enough to reach. Grozz stays his side of the wall. */
const VERGE = 26.2, REACH = 3;
/** The sprinkler valve below the South Stand: that end's sprinklers come on, play stops, and whoever defends that
 *  end stands in it till the nearest touchline steward has run to shut it (and plays the next bit soaked). */
const sprinklers: RigDef = {
  label: "Open the sprinkler valve", first: "GROZZ TURNS THE SPRINKLERS ON", r: REACH, cool: 120, at: () => P(-31, VERGE), on: game,
  does: (w) => (playing(w) ? `Play stops. ${defending(w, mx(-31)) === 0 ? "England's" : "Their"} end gets soaked. A steward runs to shut it.` : "That end of the pitch gets a soaking. A steward runs to shut it."),
  offence: "turning the sprinklers on",
  step: (w, c) => {
    const s = w.state, mid = { x: Math.sign(c.at.x) * 20, y: 12 };
    c.emit({ on: true });
    if (stop(w, "sprinklers")) c.link("SPRINKLERS ON. PLAY STOPPED", mid); else c.link("THE SPRINKLERS COME ON", mid);
    if (playing(w)) {
      // Heavy shirts, heavy legs: the side stood in it are slow for a bit once it restarts.
      const t = defending(w, c.at.x);
      setState(w, "lethargic", t, 40, "the sprinklers");
      c.link(`${sideName(w, t).toUpperCase()} GET A SOAKING`, mid);
    }
    // Whoever's stood on the grass at that end gets it.
    const wet = Object.values(s.actors).filter((a) => a.npc?.job === "pitchsteward" && free(w, a) && a.x * c.at.x > 0).sort((p, q) => dist(p, c.at) - dist(q, c.at)).slice(0, 3);
    for (const a of wet) w.bus.emit({ type: "flinch", t: c.tick, who: a.id, x: a.x * 0.7, y: a.y * 0.7 });
    const stw = nearest(w, c.at, job("pitchsteward"));
    problem(w, "fallen", { x: c.at.x + mx(0.4), y: c.at.y - 0.6 }, { owner: stw?.id, key: c.id, cause: c.r.cause, fixSecs: 7, label: stw ? `${SUR(stw)} RUNS TO SHUT THE VALVE` : "A STEWARD RUNS TO SHUT THE VALVE" });
    cue(w, c.id, c.id, SAY.sprinklers);
    c.hold(26, 8);
  },
  undo: (w) => restart(w, "sprinklers"),
};

/** The scoreboard's control box on the East concourse: a wrong score goes up, and somebody has to come and put it right. */
const score: RigDef = {
  label: "Scoreboard: England 0-7", first: "GROZZ PUTS 0-7 ON THE SCOREBOARD", r: 2, cool: 130, at: () => P(55.2, 3), on: game,
  does: "The crowd believes it. A steward leaves his post to put it right.", offence: "tampering with the scoreboard",
  step: (w, c) => {
    c.emit({ wrong: true });
    const cause = c.link("ENGLAND 0, THEM 7, SAYS THE BOARD");
    cue(w, c.id, flinch(w, c.at, 12, 4).filter((a) => a.npc!.job === "fan")[0], SAY.scoreFan);
    stim(w, "spectacle", c.at, { r: 10, secs: 8, cause, cap: 2 });
    const stw = nearest(w, c.at, job("patrol", "pitchsteward"));
    if (stw) { problem(w, "fallen", { x: c.at.x - mx(0.4), y: c.at.y }, { owner: stw.id, key: c.id, cause, fixSecs: 9, label: `${SUR(stw)} COMES TO PUT THE SCORE RIGHT` }); cue(w, c.id, c.id, SAY.scoreStw); }
    c.hold(55, 10);
  },
};

/** Where the second ball comes down: just inside the touchline, where it can be seen from the stand it was thrown from. */
export const secondBall = (): At => { const a = RIGS.ball.at(); return { x: a.x - mx(3), y: 20.5 }; };
/** The bag of spare balls below the South Stand: a second ball on the pitch. Play stops, the referee can't take his
 *  eyes off the wrong one, and a touchline steward has to go on for it. */
const ball: RigDef = {
  label: "Throw another ball on", first: "GROZZ THROWS A SECOND BALL ON", r: REACH, cool: 100, at: () => P(10, VERGE), on: game,
  does: (w) => (playing(w) ? "Two balls. Play stops, the referee dithers, a steward fetches it." : "It bounces across the pitch. A steward leaves the line to fetch it."),
  offence: "throwing a ball onto the pitch",
  step: (w, c) => {
    const to = secondBall();
    if (c.step === 1) { c.emit({ thrown: true, to }); c.next(1.1); return; }
    c.emit({ landed: true, to });
    if (stop(w, "two_balls")) { c.link("TWO BALLS ON THE PITCH. PLAY STOPPED", to); matchfx.refBusy(w, 14); c.link("THE REFEREE CAN'T TELL WHICH ONE'S HIS", to); }
    else c.link("A BALL BOUNCES ACROSS THE PITCH", to);
    const stw = nearest(w, to, job("pitchsteward"));
    problem(w, "fallen", to, { owner: stw?.id, key: c.id, cause: c.r.cause, fixSecs: 4, label: stw ? `${SUR(stw)} GOES ON TO FETCH IT` : "A STEWARD GOES ON TO FETCH IT" });
    cue(w, c.id, c.id, SAY.ball);
    c.hold(26, 5);
  },
  undo: (w) => restart(w, "two_balls"),
};

/** An advertising hoarding in front of the West End, shoved flat across the touchline. A steward has to come and stand it up. */
const hoarding: RigDef = {
  label: "Shove the hoarding over", first: "GROZZ FLATTENS A HOARDING", r: 2.6, cool: 100, at: () => P(-40.1, 0), on: game,
  does: "Flat on the touchline. A steward leaves his spot to lift it.", offence: "pushing an advertising hoarding over",
  step: (w, c) => {
    const flat = { x: c.at.x + mx(1.3), y: c.at.y };
    c.emit({ fall: true, to: flat });
    for (const a of people(w, flat, 1.3)) { a.downUntil = c.tick + 80; w.bus.emit({ type: "bowled", t: c.tick, who: a.id, by: c.r.by, x: a.x, y: a.y }); }
    flinch(w, flat, 8, 4);
    const cause = c.link("FLAT ACROSS THE TOUCHLINE, WHERE THE LINESMAN RUNS", flat);
    stim(w, "spectacle", flat, { r: 9, secs: 7, cause, cap: 1 });
    problem(w, "fallen", flat, { key: c.id, cause, fixSecs: 9, label: "A STEWARD COMES TO STAND IT UP" });
    cue(w, c.id, c.id, SAY.hoarding);
    c.hold(50, 5);
  },
};

/** The first-aid point by the tunnel: shout for the medics. Two of them run on, play stops, and nobody's down. */
const medics: RigDef = {
  label: "Shout for the medics", first: "GROZZ SHOUTS FOR THE MEDICS", r: REACH, cool: 100, at: () => P(4.2, -VERGE), on: game,
  does: (w) => (playing(w) ? "Two run on from the tunnel. Play stops. Nobody's down." : "Two run on from the tunnel for nobody at all."), offence: "calling the stretcher out for nobody",
  step: (w, c) => {
    if (c.step === 1) {
      c.emit({ shout: true });
      if (stop(w, "medics")) c.link("PLAY STOPPED FOR THE STRETCHER", { x: 0, y: -20 });
      // Out of the tunnel mouth, onto the grass where the shout came from, and back the way they came.
      const from = { x: SPOTS.tunnelTop.x, y: SPOTS.tunnelTop.y - 1.5 }, down = { x: 0, y: -20.5 };
      [0, 1].forEach((i) => {
        const a = spawnStaff(w, "cleanup", "medic", i ? "First-aider Glenda" : "First-aider Barry", from.x + (i ? 0.6 : -0.6), from.y - i * 0.8, { post: undefined, lines: [] });
        a.npc!.plan = [{ k: "go", x: down.x + (i ? 1.2 : -1.2), y: down.y + i * 0.6, run: true }, { k: "wait", s: i ? 5.5 : 5 }, { k: "go", x: from.x, y: from.y }, { k: "despawn" }];
        if (!i) { c.link("TWO MEDICS RUN ON FOR NOBODY", a); cue(w, c.id, a, SAY.medicA, 3); }
      });
      // And the nearest man on the touchline goes over to see who it's for.
      const stw = nearest(w, down, job("pitchsteward"));
      if (stw) { problem(w, "fallen", { x: down.x + mx(2.6), y: down.y }, { owner: stw.id, key: c.id, cause: c.r.cause, fixSecs: 5, label: `${SUR(stw)} GOES OVER TO SEE WHO'S DOWN` }); cue(w, c.id, c.id, SAY.medicStw, 6); }
      c.next(13); return;
    }
    restart(w, "medics");
    c.emit({ reset: true });
    c.done();
  },
};

/** Their tactics board, on its easel at the end of the visitors' dugout. Grozz draws on it what Grozz would draw.
 *  Done while they're playing, the eleven take it for instructions for a bit; and a steward has to come and wipe it. */
const dugout: RigDef = {
  label: "Draw on their tactics board", first: "GROZZ DRAWS A KNOB ON THEIR TACTICS BOARD", r: REACH, cool: 130, at: () => P(11.2, -VERGE), on: game,
  does: (w) => (playing(w) ? "Their eleven play to it for a bit. A steward comes to wipe it off." : "Nobody's playing yet. A steward leaves the touchline to wipe it."),
  offence: "drawing on the visitors' tactics board",
  step: (w, c) => {
    if (c.step === 1) { c.emit({ draw: true }); c.next(1.4); return; }
    c.emit({ drawn: true });
    const cause = c.link("IT'S THE ONLY FORMATION ON THE BOARD");
    if (playing(w)) { setState(w, "confused", 1, 45, "the tactics board"); c.link(`${sideName(w, 1).toUpperCase()} LINE UP IN IT`, { x: 0, y: -12 }); }
    flinch(w, c.at, 7, 2);
    const stw = nearest(w, c.at, job("pitchsteward"));
    problem(w, "fallen", { x: c.at.x + mx(0.9), y: c.at.y + 0.9 }, { owner: stw?.id, key: c.id, cause, fixSecs: 8, label: stw ? `${SUR(stw)} COMES TO WIPE IT OFF` : "A STEWARD COMES TO WIPE IT OFF" });
    cue(w, c.id, c.id, SAY.dugout);
    c.hold(50, 8);
  },
};

const gents = (w: World) => (w.state.stadium!.loos ?? []).find((l) => l.id === "gents");
/** The sinks in the gents, plugged, taps on: a flood to mop, one working toilet for a while, and the sound of running water. */
const sinks: RigDef = {
  label: "Flood the gents", first: "GROZZ FLOODS THE GENTS", r: 1.8, cool: 140, at: () => P(8.1, 40.3),
  on: (w) => notFinal(w), does: "A flood to mop, one toilet working, and a queue. A minute.", offence: "flooding the gents",
  step: (w, c) => {
    const loo = gents(w), pool = { x: c.at.x + mx(0.5), y: c.at.y + 1.2 };
    c.emit({ flood: true, to: pool });
    const cause = c.link("THE GENTS IS UNDER TWO INCHES OF WATER", pool);
    if (loo) { c.r.v = loo.cap; loo.cap = 1; }
    problem(w, "mess", pool, { key: c.id, cause, fixSecs: 12 });
    cue(w, c.id, c.id, SAY.sinks);
    // It's the sound of it: four of them nearby suddenly have to go, and there's one toilet working.
    const lot = people(w, c.at, 28, (a) => a.npc!.job === "fan" && !a.npc!.need && idle(w, a)).slice(0, 4);
    lot.forEach((a, i) => urge(w, a, 3 + i * 2.5, cause));
    c.hold(80, 30);
  },
  undo: (w, r) => { const loo = gents(w); if (loo && r.v) loo.cap = r.v; },
};

export const PRANKS: Record<string, RigDef> = {
  bin_w: bin(-34.3, 81.7, -1.4, (w) => keeper(w, "pub"), "THE LANDLORD COMES OUT WITH A BROOM", SAY.binPub, "Rubbish everywhere. The landlord leaves the bar to sweep it. A minute."),
  bin_e: bin(46.9, 73.5, 1.4, (w) => keeper(w, "pawn"), "LIONEL COMES OUT WITH A BROOM", SAY.binPawn, "Rubbish everywhere. Lionel leaves his shop to sweep it. A minute."),
  sign_w: sign(-24.6, 60.3, -49, 45.9),
  sign_e: sign(24.5, 60.2, 37, 45.9),
  van: vanTyre, phone, soldout: soldOut, fuse: pubFuse, bunting, cable, horse, skip,
  gas, tannoy, lights, sprinklers, score, ball, hoarding, medics, dugout, sinks,
};
export const PRANK_IDS = Object.keys(PRANKS);
/** Where the bunting hangs (for the picture of it). */
export const buntingLine = () => ({ x0: mx(BUNT.x0), x1: mx(BUNT.x1), y: BUNT.y });

export function installPranks(): void {
  for (const id of PRANK_IDS) if (RIGS[id] !== PRANKS[id]) registerRig(id, PRANKS[id]);
}

/** Whoever's turn it is to speak, speaks: one line per thing per ten seconds, and only by somebody who's up and there. */
function stepCues(w: World, pr: PrankState): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!pr.cues.length) return;
  const keep: Cue[] = [];
  for (const q of pr.cues) {
    if (tick > q.until) continue;
    if (tick < q.at || tick - (pr.said[q.rig] ?? -1e9) < LINE_GAP) { keep.push(q); continue; }
    let a: Actor | undefined;
    if (q.need) {
      const pb = st.problems?.find((p) => p.key === q.need);
      if (!pb) continue; // seen to (or given up on) before he'd a chance to say it
      if (pb.stage < 1 || !pb.by) { keep.push(q); continue; }
      a = s.actors[pb.by];
    } else a = s.actors[q.who!];
    if (!a?.npc || a.dead) continue;
    if (a.downUntil > tick || a.hiddenIn) { keep.push(q); continue; }
    say(w, a, q.text, 3);
    pr.said[q.rig] = tick;
  }
  pr.cues = keep;
}

/** The housekeeping: the horse's whereabouts, who says what and when, people sent to put things right get a move
 *  on, and supporters pulled out of their seats by one of these are seen back to them. */
export function stepPranks(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!PACE.calm) return;
  if (tick % 6 === 0) { const o = rider(w); if (o) HORSE = { x: o.x, y: o.y }; }
  if (tick % 10 !== 0 || !st.rigs) return;
  const pr = st.pranks;
  if (pr) stepCues(w, pr);
  // Sent for by one of these, he doesn't dawdle (he's got a job to get back to).
  for (const p of st.problems ?? []) {
    const id = p.key?.replace(/_(row|fire|child)$/, "");
    if (!id || !PRANKS[id] || !p.by || p.stage !== 0) continue;
    const a = s.actors[p.by], n = a?.npc;
    if (!n) continue;
    for (const t of n.plan) if (t.k === "go" && dist(t, p) < 3) t.run = true;
    if (n.goal && dist(n.goal, p) < 3) n.goal.run = true;
  }
  if (!pr || tick % 60 !== 0) return;
  if (pr.stims.length) {
    for (const e of st.stims ?? []) if (pr.stims.includes(e.id)) for (const id of e.who) if (!pr.strays.includes(id)) pr.strays.push(id);
  }
  for (const id of pr.strays) {
    const a = s.actors[id], n = a?.npc;
    // Sat down where he stood when it ended, nowhere near his seat: up, and back to it.
    if (!a || !n || n.job !== "fan" || !n.seat || !a.seated || n.stage !== 3 || dist(a, n.seat) < 2.5 || !free(w, a)) continue;
    a.seated = false; n.sitting = false; n.stage = 2;
  }
  if (tick > pr.until) { pr.strays = []; pr.stims = []; }
}

export type { RigState };

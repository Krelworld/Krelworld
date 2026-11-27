// More ways in, Hitman-style: each one is a person with a routine, a thing they carry, or a place
// they leave something, and somebody in the world who'll tell you about it if you ask.
//
// - The maintenance ladder up the back of the South Stand. At the top you jump: with Para Steve's
//   parachute you float down onto the pitch; without one, you don't.
// - Lenny the Lion, the mascot, has a fag in the service alley before the game with his head off.
//   His costume covers your face and gets you pitchside and into the tunnel.
// - The TV reporter's press pass gets you through a turnstile without a ticket.
// - The laundry hamper by the players' entrance: climb in, and Wally wheels you into the kit room.
//
// Leads: talking to people turns up "mission stories", logged so you can see what you've heard.
import type { Actor } from "../core/types";
import { moveItem, spawnItem } from "../core/items";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { spawnBikes } from "./bike";
import { KICKOFF_AT, SPOTS } from "./layout";
import { knockOn } from "./kegs";
import { say, secs } from "./npc";
import { incapacitated } from "./combat";
import { crime } from "./security";

const near = (a: { x: number; y: number }, p: { x: number; y: number } | undefined, r: number) => !!p && Math.hypot(a.x - p.x, a.y - p.y) < r;
const carrying = (w: World, a: Actor, def: string) => [a.hand, ...a.pockets].some((id) => id && w.state.items[id]?.def === def);
const sp = () => SPOTS as any;

export const atLadder = (a: Actor) => near(a, sp().ladder, 1.8);
export const hasChute = (w: World, a: Actor) => carrying(w, a, "parachute") || (!!a.worn.body && w.state.items[a.worn.body]?.def === "parachute");

/** Mission stories: what you can learn, and the line that teaches it. */
export const LEADS: { id: string; title: string; how: string; hint: RegExp }[] = [
  { id: "drain", title: "The old drain", how: "From the pub cellar hatch to the England showers. The hatch needs a wrench: Old Reg's is by his shed.", hint: /drain runs|cellar's seized/i },
  { id: "card", title: "The kit man's swipe card", how: "Wally's card opens the players' entrance off the alley. He drinks in the pub between runs.", hint: /swipe card/i },
  { id: "hamper", title: "The laundry hamper", how: "Get in the hamper by the players' entrance. Wally wheels it into the kit room on his next run.", hint: /hamper/i },
  { id: "scaffold", title: "The scaffold", how: "Up the scaffold by the car park, across the roof, down the ladder into the tunnel.", hint: /scaffold/i },
  { id: "ladder", title: "The stand roof", how: "A maintenance ladder runs up the back of the South Stand. Jump from the top with a parachute and you land on the pitch.", hint: /ladder up the back/i },
  { id: "chute", title: "Para Steve's chute", how: "Para Steve's doing the half-time display jump. His kit bag's on the floor by his van in the car park.", hint: /chute's in the bag|half-time jump/i },
  { id: "mascot", title: "Lenny the Lion", how: "The mascot has a fag in the service alley before kick-off, head off. His costume gets you pitchside and down the tunnel, and nobody sees your face.", hint: /lenny/i },
  { id: "press", title: "The press pass", how: "The TV reporter's press pass gets you through a turnstile with no ticket.", hint: /press pass/i },
  { id: "lorry", title: "The beer lorry", how: "The beer lorry goes straight into the loading bay. Nobody checks the back.", hint: /beer lorry/i },
  { id: "smoker", title: "The staff door", how: "The steward on the staff door nips out for a smoke and props it open.", hint: /having a fag|nips out/i },
  { id: "stretcher", title: "The stretcher", how: "Get knocked out inside the ground and the first-aiders take you to the medical room, next to the dressing rooms.", hint: /woke up next to the dressing rooms/i },
  { id: "tout", title: "Dodgy Del", how: "Del sells real tickets cheap, and keeps the cash in his pocket.", hint: /tickets, tickets/i },
];

/** Heard something useful? Note it down. */
export function hearLead(w: World, line: string): void {
  const st = w.state.stadium!;
  for (const l of LEADS) if (l.hint.test(line) && !st.flags[`lead_${l.id}`]) {
    st.flags[`lead_${l.id}`] = w.state.tick || 1;
    w.bus.emit({ type: "lead", t: w.state.tick, id: l.id, title: l.title });
  }
}

export function installEntries(): void {
  registerVerb("jump", {
    check: (_w, _act, actor) => (actor.roof && actor.roofId === "stand" ? null : "nowhere to jump from"),
    perform: (w, _act, actor) => {
      const s = w.state, st = s.stadium!;
      actor.roof = false; actor.roofId = undefined;
      if (hasChute(w, actor)) {
        // Over the edge, the canopy opens, and the wind takes you over the stand and down onto the pitch.
        const id = [actor.hand, ...actor.pockets, actor.worn.body].find((i) => i && s.items[i]?.def === "parachute")!;
        moveItem(s, id, { k: "gone" });
        const to = sp().pitchSpot as { x: number; y: number }, c = { x: to.x + 8, y: 0 };
        actor.chute = { x0: actor.x, y0: actor.y, x1: c.x, y1: c.y, t0: s.tick, t1: s.tick + 60 * 7 };
        actor.downUntil = actor.chute.t1;
        w.bus.emit({ type: "chute_open", t: s.tick, by: actor.id });
        return;
      }
      // No parachute. It's a long way down.
      actor.dead = true; actor.downUntil = Number.MAX_SAFE_INTEGER;
      actor.y -= 2.5;
      w.bus.emit({ type: "killed", t: s.tick, who: actor.id, by: actor.id, x: actor.x, y: actor.y, fall: true });
      if (actor.id === st.pc && !st.ending) {
        st.ending = { kind: "fell", title: "Splat", text: "You jumped off the roof of the South Stand without a parachute. You were in the air for a little under two seconds. The man you landed next to has asked for a refund." };
        w.bus.emit({ type: "ending", t: s.tick, kind: "fell" });
      }
    },
  });
}

/** Each step: the parachute descent, Lenny's costume, the laundry run. */
export function stepEntries(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  const pc = s.actors[st.pc];
  if (!pc) return;
  if (pc.chute) {
    const c = pc.chute, k = Math.min(1, (tick - c.t0) / (c.t1 - c.t0)), e = k * k * (3 - 2 * k);
    pc.x = c.x0 + (c.x1 - c.x0) * e + Math.sin(k * 9) * 1.5 * (1 - k);
    pc.y = c.y0 + (c.y1 - c.y0) * e;
    pc.vx = pc.vy = 0;
    if (k >= 1) {
      pc.chute = undefined; pc.downUntil = tick + 40;
      w.bus.emit({ type: "chute_land", t: tick, by: pc.id, x: pc.x, y: pc.y });
      crime(w, pc, "parachuting onto the pitch", 2);
    }
  }
  // The laundry run: if you're in the hamper when Wally comes back out through the players'
  // entrance, he wheels it in with him and leaves it in the kit room.
  const hamper = Object.values(s.items).find((i) => i.def === "laundry");
  const wally = Object.values(s.actors).find((a) => a.npc?.job === "kitman" && !a.dead);
  if (hamper && hamper.loc.k === "ground" && wally && wally.downUntil <= tick) {
    const out = sp().hamperOut, room = sp().kitRoom;
    const inHamper = pc.hiddenIn === hamper.id;
    // Only on his way in (the second leg of his round).
    if (inHamper && !st.flags.wheeling && near(hamper.loc, out, 2) && near(wally, out, 2.6) && wally.npc!.stage % 4 === 2) {
      // He takes the handles: "Heavy today..."
      st.flags.wheeling = 1;
      say(w, wally, "Christ, they've packed this one heavy.", 2);
    }
    if (st.flags.wheeling) {
      if (!inHamper) st.flags.wheeling = 0;
      else {
        // The hamper goes where Wally goes, a step behind him, until he's in the kit room.
        moveItem(s, hamper.id, { k: "ground", x: wally.x - Math.cos(wally.facing) * 0.9, y: wally.y - Math.sin(wally.facing) * 0.9 });
        if (near(wally, room, 1.6)) {
          st.flags.wheeling = 0;
          moveItem(s, hamper.id, { k: "ground", x: room.x + 1.4, y: room.y + 2.2 });
          w.bus.emit({ type: "hamper_ride", t: tick, by: pc.id });
        }
      }
    } else if (!inHamper && !near(hamper.loc, out, 1) && wally && near(wally, out, 2) && tick % 60 === 0) {
      // Out again with an empty one.
      moveItem(s, hamper.id, { k: "ground", x: out.x, y: out.y });
    }
  }
  knockOns(w);
}

/** Chain reactions: take something from someone and the world notices, and the noticing opens a
 *  gap somewhere else. Each fires once. */
function knockOns(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, f = st.flags, t = secs(w);
  const byName = (name: string) => Object.values(s.actors).find((a) => a.name === name && !a.dead);
  const has = (a: Actor, def: string) => [a.hand, ...a.pockets].some((id) => id && s.items[id]?.def === def);
  // Para Steve's chute: he checks his bag every so often. Gone? The display's off, and he goes
  // looking round the approach for whoever had it, leaving his van.
  const steve = byName("Para Steve");
  if (steve && !f.chuteGone && tick % 600 === 300 && !incapacitated(w, steve)) {
    const bag = Object.values(s.items).find((i) => i.def === "kitbag");
    const inBag = bag && Object.values(s.items).some((i) => i.def === "parachute" && i.loc.k === "in" && i.loc.c === bag.id);
    if (bag && !inBag) {
      f.chuteGone = tick;
      say(w, steve, "Where's my chute? WHERE'S MY BLOODY CHUTE?", 4);
      w.bus.emit({ type: "display_cancelled", t: tick });
      knockOn(w, steve, "search", 70, "STEVE'S CHUTE GONE", "HALF-TIME JUMP OFF", "STEVE LEAVES HIS VAN");
      steve.npc!.post = undefined;
      steve.npc!.plan = [{ k: "go", x: 40, y: 56 }, { k: "wait", s: 6 }, { k: "go", x: 10, y: 54 }, { k: "wait", s: 6 }, { k: "go", x: -20, y: 56 }, { k: "wait", s: 8 }, { k: "go", ...sp().para }, { k: "wait", s: 3600 }];
      if (VENUE_SIGN() < 0) for (const k of steve.npc!.plan) if ("x" in k) (k as { x: number }).x = -(k as { x: number }).x;
    }
  }
  // Lenny: if he isn't on his way in a minute before kick-off, the tannoy asks for him and the
  // corridor steward goes out the back to fetch him (off his post). Still missing after kick-off:
  // "unwell".
  const lenny = Object.values(s.actors).find((a) => a.npc?.job === "mascot");
  const lennyGone = !lenny || lenny.dead || incapacitated(w, lenny) || !lenny.worn.outer || s.items[lenny.worn.outer]?.def !== "mascot_suit";
  if (lennyGone && !f.lennyCalled && t > KICKOFF_AT - 60) {
    f.lennyCalled = tick;
    w.bus.emit({ type: "mascot_missing", t: tick });
    const brian = Object.values(s.actors).find((a) => a.npc?.job === "corridor" && !a.dead);
    if (brian && !incapacitated(w, brian)) {
      say(w, brian, "Bloody mascot. I'll go and find him.", 3);
      knockOn(w, brian, "search", 50, "LENNY MISSING", "CORRIDOR STEWARD LEAVES HIS POST");
      brian.npc!.plan = [{ k: "go", ...sp().kitRoom }, { k: "go", ...sp().playersDoor }, { k: "go", ...sp().mascotSmoke }, { k: "wait", s: 25 }, { k: "go", ...sp().playersDoor }, { k: "go", ...sp().corridorPost }];
    }
  }
  if (lennyGone && f.lennyCalled && !f.lennyOff && t > KICKOFF_AT + 30) { f.lennyOff = tick; w.bus.emit({ type: "mascot_off", t: tick }); }
  // Wally's card: he finds out at the door on his way in. He props it open ("back in a sec") and
  // goes to the security office to report it.
  const wally = Object.values(s.actors).find((a) => a.npc?.job === "kitman" && !a.dead);
  if (wally && !f.cardGone && !incapacitated(w, wally) && near(wally, sp().playersDoor, 2.2) && !has(wally, "kit_card") && wally.npc!.stage % 4 === 2) {
    f.cardGone = tick;
    say(w, wally, "Me card! Some bastard's had me card! ...I'll prop it. Back in a sec.", 4);
    st.gates.playersdoor = { until: tick + 60 * 90, for: null };
    w.bus.emit({ type: "card_stolen", t: tick });
    knockOn(w, wally, "report", 60, "WALLY'S CARD GONE", "PLAYERS' DOOR PROPPED OPEN");
    wally.npc!.plan = [{ k: "go", ...sp().kitRoom }, { k: "go", ...sp().chiefDesk }, { k: "wait", s: 40 }];
  }
  // The reporter's press pass: he notices, and PC Okafor comes over to take a statement.
  const rep = byName("Reporter");
  if (rep && !f.passGone && tick % 600 === 0 && !incapacitated(w, rep) && !has(rep, "press_pass") && t > 20) {
    f.passGone = tick;
    say(w, rep, "My pass! Someone's had my press pass! Officer!", 4);
    w.bus.emit({ type: "pass_stolen", t: tick });
    const cop = Object.values(s.actors).find((a) => a.npc?.job === "police" && !a.npc.mounted && !a.dead && !incapacitated(w, a));
    if (cop) cop.npc!.plan = [{ k: "go", x: rep.x + 1, y: rep.y + 0.5 }, { k: "say", text: "Right, sir. Start from the beginning." }, { k: "wait", s: 45 }];
    knockOn(w, cop, "report", 55, "PRESS PASS GONE", "COPPER LEAVES HIS POST");
  }
}
const VENUE_SIGN = () => Math.sign((SPOTS as any).para.x) || 1;

/** The people and things these routes need. */
export function spawnEntries(w: World, staff: (job: any, role: any, name: string, at: { x: number; y: number }, facing: number, extra?: object) => Actor): void {
  const s = w.state, S = Math.PI / 2, W = Math.PI;
  // Para Steve and his kit bag, with the chute in it.
  staff("para", "none", "Para Steve", sp().para, W, { lines: [
    "We're doing the half-time jump if the wind drops. Chute's in the bag, don't touch it.",
    "There's a ladder up the back of the South Stand. Maintenance. Went up for a look at the wind. Long way down.",
    "Never jump without the chute, son. You'd go through that roof like a dropped pie.",
  ] });
  const bag = spawnItem(s, "kitbag", { k: "ground", x: sp().kitbag.x, y: sp().kitbag.y });
  spawnItem(s, "parachute", { k: "in", c: bag.id });
  // Lenny the Lion: a fag in the alley with his head off, then in through the players' entrance.
  const lenny = staff("mascot", "catering", "Lenny the Lion", sp().mascotSmoke, S, { post: undefined, lines: [
    "Don't tell the kids I smoke. Lenny doesn't smoke. Lenny loves everybody.",
    "Forty quid a match to dance about in this. I'm boiling in here.",
  ] });
  spawnItem(s, "mascot_suit", { k: "worn", a: lenny.id, slot: "outer" });
  // The reporter's press pass.
  const rep = Object.values(s.actors).find((a) => a.name === "Reporter");
  if (rep) spawnItem(s, "press_pass", { k: "pocket", a: rep.id });
  // The laundry hamper by the players' entrance.
  spawnItem(s, "laundry", { k: "ground", x: sp().hamperOut.x, y: sp().hamperOut.y });
  spawnBikes(w, sp());
  void W;
}

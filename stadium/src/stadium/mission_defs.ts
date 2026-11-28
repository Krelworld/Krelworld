// The mission cards (Option E): the plans Grozz can be walked through, one step at a time. The engine is
// missions.ts; the schemes underneath are the scheme_*.ts files, untouched. Nothing here does anything to
// the world: every step only reads it, so however a thing came to be true, it counts.
//
// Rules these cards are written to:
//   - a step says what to press in the words on the button that does it ("Roll the keg", not "shove");
//   - `where` is the live position of the person or thing, so the pointer follows a man who walks off;
//   - if what a step needs has been taken off him, the pointer goes to where it can be got back (the
//     confiscation locker, a shop), never nowhere;
//   - a step that has several ways through names the end and points at the cheapest way from where he
//     stands; the scheme's own clues carry the others, and the card teaches those outright once it's the
//     pinned plan, so nobody has to stumble on a cleaner to find out about the tea urn.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { hasProp } from "../core/items";
import { areaAt, PACE, SPOTS, VENUE } from "./layout";
import { hoseAt, hoseWatched } from "./beer";
import { SHOPS } from "./rules";
import { defineMission } from "./missions";
import { schemeState, type SchemeState } from "./schemes";
import { teachVisitors } from "./scheme_visitors";
import { teachReferee } from "./scheme_referee";
import { teachTwelfth } from "./scheme_twelfth";

type P = { x: number; y: number };
type Sc = SchemeState | undefined;
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const stOf = (w: World) => w.state.stadium!;
const pcOf = (w: World): Actor => w.state.actors[stOf(w).pc];
const at = (a: P | undefined | null): P | null => (a ? { x: a.x, y: a.y } : null);
const who = (w: World, f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => a.npc && !a.dead && f(a));
const shopkeeper = (w: World, shop: string) => who(w, (a) => a.npc!.shop === shop);
const carried = (w: World, a: Actor): Item[] => [a.hand, ...a.pockets].filter((x): x is string => !!x).map((id) => w.state.items[id]).filter(Boolean);
const holds = (w: World, def: string) => carried(w, pcOf(w)).find((i) => i.def === def);
const lying = (w: World, f: (i: Item) => boolean): (Item & { loc: { k: "ground"; x: number; y: number } })[] => Object.values(w.state.items).filter((i) => i.loc.k === "ground" && f(i)) as any;
const nearest = <T extends P>(from: P, list: T[]): T | undefined => list.slice().sort((p, q) => dist(p, from) - dist(q, from))[0];
const nearestItem = (w: World, f: (i: Item) => boolean): P | null => { const pc = pcOf(w), l = lying(w, f).map((i) => i.loc); return at(nearest(pc, l)); };
/** In a box (a hamper, the locker): where the box stands. */
const boxed = (w: World, def: string, box?: string): P | null => {
  for (const i of Object.values(w.state.items)) {
    if (i.def !== def || i.loc.k !== "in") continue;
    const c = w.state.items[i.loc.c];
    if (c?.loc.k === "ground" && (!box || c.def === box)) return at(c.loc);
  }
  return null;
};
/** Taken off him and put in the confiscation locker in the security office: that's where it is. */
const inLocker = (w: World, def: string): P | null => { const l = w.state.items[stOf(w).locker]; return Object.values(w.state.items).some((i) => i.def === def && i.loc.k === "in" && i.loc.c === stOf(w).locker) && l?.loc.k === "ground" ? at(l.loc) : null; };
const inPlay = (w: World) => ["live", "restart", "goal_pause"].includes(w.state.match!.phase);
const finished = (w: World) => w.state.match!.phase === "finished" || w.state.match!.phase === "shootout";
const fullTime = (w: World) => (finished(w) ? "It's full time." : null);
/** The pinned plan has got as far as step n (counting from nought): the moment to tell him what he'd otherwise overhear. */
const reached = (w: World, id: string, n: number) => { const m = stOf(w).missions; return !!m && m.active === id && (m.stage[id] ?? 0) >= n; };

// ---------------------------------------------------------------------------------------------------------
// Getting about. The back of the ground (dressing rooms, officials, the corridor) is walled off from the
// stands: the only walk in from a seat is the players' tunnel, and the straight line to that is across the
// pitch. So the pointer takes him round the concourse a leg at a time; from outside, it's the scaffold.

// (Everything behind the Main Stand's back wall is backstage, whatever the floor plan calls the strip along
// the far wall of each room; so are the tunnel and the staff corridor that run out of it.)
const backstage = (w: World) => { const pc = pcOf(w), a = areaAt(pc.x, pc.y).id; return VENUE.inside(pc.x, pc.y) && !pc.hiddenIn && (pc.y < -38 || a === "tunnel" || a === "staffway"); };
const TUNNEL = { mouth: { x: 0, y: -27.4 }, foot: { x: 0, y: -36.5 } };
function wayBackstage(w: World): P | null {
  const pc = pcOf(w), sx = pc.x < 0 ? -1 : 1;
  if (backstage(w)) return null;
  if (stOf(w).custody) return null;
  if (!VENUE.inside(pc.x, pc.y)) return at(SPOTS.scaffold);
  // Already on the grass: the mouth of the tunnel, and in.
  if (areaAt(pc.x, pc.y).pitch) return Math.abs(pc.x) < 2 && pc.y < -26 ? TUNNEL.foot : TUNNEL.mouth;
  // The Main Stand side: along the front row to the tunnel wall, round the end of it, and down.
  if (pc.y <= -27) return Math.abs(pc.x) < 2 ? TUNNEL.foot : Math.abs(pc.x) < 6 ? TUNNEL.mouth : { x: sx * 4.2, y: -28.6 };
  // Either end: up the concourse to the corner by the Main Stand.
  if (Math.abs(pc.x) >= 40) return { x: sx * 45, y: -32 };
  // The south side: along the concourse to the nearer end.
  return { x: sx * 53, y: 36 };
}
/** Somewhere backstage, by way of getting backstage. */
const via = (w: World, p: P | null): P | null => wayBackstage(w) ?? p;
/** What he's got ON (a kit over his arm makes him look the part to a steward, and nobody else). */
const wearing = (w: World, def: string) => { const o = pcOf(w).worn.outer; return !!o && w.state.items[o]?.def === def; };
const side = (w: World): 0 | 1 | null => (wearing(w, "kit_eng") ? 0 : wearing(w, "kit_opp") ? 1 : null);
/** Where to stand till it kicks off, and where to walk to when it has. */
const walkOn = (w: World, to: P): P | null => (inPlay(w) ? to : via(w, TUNNEL.foot));

// ---------------------------------------------------------------------------------------------------------
// GET IN. The honest way, on forty quid, costs him the shirt off his back.

const ticket = (w: World) => carried(w, pcOf(w)).find((i) => i.def === "ticket" && !i.void && (!i.used || i.usedBy === stOf(w).pc));
const inGround = (w: World) => { const pc = pcOf(w), st = stOf(w); return VENUE.inside(pc.x, pc.y) && !st.custody && !pc.heldBy && !pc.hiddenIn; };
const DEL = 45;
const delSelling = (w: World) => { const d = shopkeeper(w, "tout"); return d && d.pockets.some((id) => w.state.items[id]?.def === "ticket") ? d : undefined; };
/** Just through the nearest turnstile: the steward scans the ticket as he walks at it, and the pointer takes him on in. */
const throughTurnstile = (w: World): P => { const t = nearest(pcOf(w), SPOTS.turnstiles)!; return { x: t.x, y: t.y - 2.9 }; };

// ---------------------------------------------------------------------------------------------------------
// The schemes' own people and things, found the way the schemes find them.

const drayman = (w: World) => who(w, (a) => a.npc!.job === "worker");
const reporter = (w: World) => who(w, (a) => a.name === "Reporter");
const giftKeg = (w: World) => lying(w, (i) => i.def === "keg" && i.label === "the visitors' keg")[0];
const lorry = (w: World) => Object.values(stOf(w).vehicles).find((v) => v.kind === "lorry");
const fouled = (w: World, sc: Sc) => !!(sc?.vars.sent ? sc.vars.foul : stOf(w).beer?.load || stOf(w).beer?.hose === "sewer");
const referee = (w: World) => w.state.actors[w.state.match!.officials.referee];
const fourth = (w: World) => w.state.actors[w.state.match!.officials.fourth];
const up = (w: World, a: Actor | undefined): a is Actor => !!a && !a.dead && a.downUntil <= w.state.tick && !a.hiddenIn && a.fb?.status !== "gone" && !a.off?.incapacitated;
const OWN_WHISTLE = "The referee's own whistle";
const ownWhistle = (w: World) => lying(w, (i) => i.def === "whistle" && i.label === OWN_WHISTLE && dist(i.loc as P, SPOTS.refRoom) < 8)[0];
const urn = (w: World) => lying(w, (i) => i.def === "tea_urn")[0];

export function installMissionDefs(): void {
  defineMission({
    id: "getin", title: "Get in",
    goal: "Get into the ground. A ticket's the honest way. The back of the beer lorry isn't.",
    buys: "Nothing, by itself. But a match can't be got at from the car park.",
    zone: "out", rank: 2, on: () => PACE.calm,
    stages: [
      { text: "Sell your England shirt to Lionel at Cash Kings (£15)",
        where: (w) => at(shopkeeper(w, "pawn")),
        done: (w) => pcOf(w).money >= DEL || !!ticket(w) || inGround(w) },
      { text: "Buy a ticket from Dodgy Del (£45)",
        where: (w) => at(delSelling(w) ?? shopkeeper(w, "ticket")),
        done: (w) => !!ticket(w) || inGround(w) },
      { text: "Show your ticket at a turnstile. Or hide in the beer lorry",
        where: (w) => throughTurnstile(w),
        done: (w) => inGround(w) },
    ],
    dead: (w) => fullTime(w),
    with: {
      visitors: "The lorry that takes their keg in would take a fat man an' all.",
      referee: "His room's round the back. So's everything else worth having.",
    },
  });

  defineMission({
    id: "visitors", scheme: "visitors", title: "A Keg for the Visitors",
    goal: "Send their dressing room the pub's gift keg, with something in it.",
    buys: "Their captain toasts it on camera and goes home unwell. Miss a part out and he passes it on, or enjoys it.",
    zone: "out", rank: 4, on: () => PACE.calm && VENUE.id === "qf",
    stages: [
      { text: "Roll the keg: the drayman leaves his hose to fetch it",
        where: (w) => nearestItem(w, (i) => i.def === "keg" && !i.label && !stOf(w).kegCarry?.[i.id]),
        done: (w, sc) => {
          if (reached(w, "visitors", 0)) teachVisitors(w, "gift", "hose", "tankard", "press", "shiny");
          return fouled(w, sc) || !!sc?.vars.sent || !!drayman(w)?.npc!.fetch || !!stOf(w).rolling?.some((r) => r.by === stOf(w).pc && (r.vx || r.vy));
        } },
      { text: "Hose into the drain before he's back",
        // If he is back, it's the keg again.
        where: (w) => (hoseWatched(w) ? nearestItem(w, (i) => i.def === "keg" && !i.label && !stOf(w).kegCarry?.[i.id]) ?? hoseAt() : hoseAt()),
        done: (w, sc) => fouled(w, sc) || !!sc?.vars.sent },
      { text: "Buy the '66 tankard from Cash Kings (£25)",
        where: (w) => at(shopkeeper(w, "pawn")),
        done: (w, sc) => !!holds(w, "tankard") || !!(sc?.vars.bought || sc?.vars.tankard || sc?.vars.late) },
      { text: "Hang the tankard on the keg with the bow",
        // Gone already: it can go on the next run, off the back of the lorry.
        where: (w, sc) => { const k = giftKeg(w), v = lorry(w), c = v && w.state.items[v.cargo]; return !holds(w, "tankard") && !sc?.vars.bought ? at(shopkeeper(w, "pawn")) : sc?.vars.sent ? (c?.loc.k === "ground" ? at(c.loc) : null) : at(k?.loc); },
        done: (_w, sc) => !!(sc?.vars.tankard || sc?.vars.late) },
      { text: "Tell her about the keg: the reporter, out the front",
        where: (w) => at(reporter(w)),
        done: (_w, sc) => !!sc?.vars.press },
      { text: "Wait for the lorry to take it in",
        where: (w) => at(giftKeg(w)?.loc),
        done: (_w, sc) => !!sc?.vars.sent },
    ],
    over: (_w, sc) => !!sc?.done,
    dead: (w, sc) => fullTime(w) ?? (sc?.vars.sent && !sc.vars.foul ? "It's gone in with nothing in it but beer." : null),
    with: {
      signing: "Their captain's shirt will be going spare.",
      special: "Sick from the keg and sick from the tap.",
      getin: "The lorry that takes the keg takes passengers.",
    },
  });

  defineMission({
    id: "referee", scheme: "referee", title: "Whistleblower",
    goal: "Referee the match yourself.",
    buys: "A minute and a half of England penalties on demand. Get it wrong and you're clapped off.",
    zone: "in", rank: 1, on: () => PACE.calm,
    stages: [
      { text: "Get backstage: the players' tunnel, or climb the scaffold",
        where: (w) => wayBackstage(w),
        done: (w) => backstage(w) || wearing(w, "ref_kit") },
      { text: "Pick up the referee's kit in his room and put it on",
        where: (w) => (holds(w, "ref_kit") ? null : via(w, nearestItem(w, (i) => i.def === "ref_kit") ?? at(SPOTS.refRoom))),
        done: (w) => wearing(w, "ref_kit") },
      { text: "Pick up the referee's whistle, on the bench by the urn",
        where: (w) => { const o = ownWhistle(w); return o ? via(w, at(o.loc)) : inLocker(w, "whistle") ?? nearestItem(w, (i) => i.def === "whistle") ?? (SHOPS.pawn.stock.whistle ? at(shopkeeper(w, "pawn")) : null); },
        done: (w) => !!holds(w, "whistle") },
      { text: "Get the real referee out of it",
        // The cheapest way from here: something in his tea if he's carrying something, else leave him no whistle, else pay the man who chooses.
        where: (w) => { const sub = carried(w, pcOf(w)).some((i) => hasProp(i, "substance")), u = urn(w), o = ownWhistle(w); return via(w, sub && u ? at(u.loc) : o ? at(o.loc) : at(fourth(w))); },
        done: (w, sc) => {
          if (reached(w, "referee", 3)) teachReferee(w, "tea", "alone", "owes", "fourth");
          const r = referee(w), b = schemeState(w, "bribe")?.vars;
          return !!sc?.variant || !!sc?.vars.nicked || !up(w, r) || r.off!.strictness >= 1 || !!stOf(w).dosed[r.id] || !!urn(w)?.spiked
            || (!!holds(w, "whistle") && !ownWhistle(w)) || !!(sc?.vars.paid || b?.fourthPaid);
        } },
      { text: "Wait in the tunnel. At kick-off, walk on",
        where: (w) => walkOn(w, { x: 0, y: -18 }),
        // (Not the instant it's counted: once the players have turned to look, and his word's being taken.)
        done: (_w, sc) => !!sc?.vars.stands },
      { text: "Award England a penalty",
        where: (w) => (areaAt(pcOf(w).x, pcOf(w).y).pitch ? null : walkOn(w, { x: 0, y: -18 })),
        done: (w) => (stOf(w).flags.impostorRulings ?? 0) >= 1 },
    ],
    over: (_w, sc) => !!sc?.done && ["two", "peep", "fatman"].includes(sc.variant ?? ""),
    dead: (w) => fullTime(w),
    with: {
      twelfth: "A referee who can't count to twelve either.",
      signing: "A referee who can't see an own goal.",
      home: "England flying into everything, and the whistle's yours.",
      drugs: "Get the real one nicked and nobody argues.",
      bribe: "The fourth official says which of you is the referee. He's twenty quid.",
    },
  });

  defineMission({
    id: "twelfth", scheme: "twelfth", title: "Twelfth Man",
    goal: "Get on the pitch in England's kit.",
    buys: "An extra England player till somebody counts. Counted cold, it's a free kick against England.",
    zone: "in", rank: 2, on: () => PACE.calm,
    stages: [
      { text: "Get backstage: the players' tunnel, or climb the scaffold",
        where: (w) => wayBackstage(w),
        done: (w) => backstage(w) || side(w) === 0 },
      { text: "Take the England playing kit from the hamper, put it on",
        where: (w) => (holds(w, "kit_eng") ? null : via(w, boxed(w, "kit_eng") ?? nearestItem(w, (i) => i.def === "kit_eng") ?? at(SPOTS.homeRoom))),
        done: (w) => {
          if (reached(w, "twelfth", 1)) teachTwelfth(w, "kit", "count", "spare");
          return side(w) === 0;
        } },
      { text: "At kick-off, break the glass on the fire alarm",
        // Nobody counts heads while the bell's going. (Nor if he's been paid, or filmed: then this is done already.)
        where: (w) => { const f = stOf(w).flags, pc = pcOf(w), free = SPOTS.alarmPoints.filter((_p, i) => !f[`alarmUsed${i}`]); return via(w, !f.alarmUsed4 ? at(SPOTS.alarmPoints[4]) : at(nearest(pc, free)) ?? at(fourth(w))); },
        done: (w, sc) => !!sc?.variant || (inPlay(w) && (!!sc?.met.blind || (sc?.met.kit === "eng" && !!sc.met.gap))) },
      { text: "Walk on while nobody's counting",
        where: (w) => walkOn(w, { x: 0, y: -18 }),
        done: (_w, sc) => ["eleven", "twelve"].includes(sc?.variant ?? "") },
    ],
    over: (_w, sc) => !!sc?.variant && (sc.variant === "counted" || sc.vars.team === 1),
    dead: (w) => fullTime(w),
    with: {
      bribe: "Twenty quid and the fourth official makes it eleven.",
      referee: "While two referees argue, nobody's counting anybody.",
      home: "Twelve of them, and every one off his head.",
      signing: "One shirt at a time. Pick a side.",
    },
  });

}


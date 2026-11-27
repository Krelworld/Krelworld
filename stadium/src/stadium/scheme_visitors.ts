// A KEG FOR THE VISITORS. The first authored scheme (the quarter-final, the pub yard).
//
// Every match the Three Lions sends one keg, with a bow on, to the visiting team's dressing room. Tradition.
// Three things, each ordinary and each arrangeable in more than one way, decide what happens when the
// visitors open it:
//   WHAT'S IN IT   the drayman's filling hose down the drain while his back is turned (roll a keg, Ronson and
//                  a pie, a queue: anything that takes him off it);
//   THE TANKARD    the '66 tankard the first pint is drunk from. It's in Cash Kings' window. Buy it and hang
//                  it on the keg, send it on a later run, or drink enough in the pub that the landlord can
//                  afford to redeem it himself;
//   THE CAMERAS    with the press there the captain can't say no. Tell the reporter (she wants something
//                  shiny first), or have her in the yard for some other reason when it leaves.
// The lorry takes the keg at a set time; the team arrive on their coach; then it's counted, and one of five
// payoffs plays. None of them is a dead end and only one of them is what Grozz wanted.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { moveItem, spawnItem } from "../core/items";
import { KICKOFF_AT, PACE, SPOTS, VENUE } from "./layout";
import { say as say0 } from "./npc";
import { SHOPS } from "./rules";
import { theirStar } from "./fixes";
import { linkCause, rootCause } from "./cause";
import { matchfx } from "./matchfx";
import { defineScheme, learn, play, type Beat, type SchemeDef, type SchemeState } from "./schemes";

const say = (w: World, a: Actor, text: string, secs = 3.5): void => { say0(w, a, text, secs); if (a.npc) a.npc.told = w.state.tick + Math.round(secs * 60); };
const KEG_LABEL = "the visitors' keg";
const HOME = { x: -25.6, y: 71.4 };
const ROOM = { x: 17, y: -53.4 };
const PRICE = 25, ROUND = 15;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const who = (w: World, f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => a.npc && !a.dead && f(a));
const drayman = (w: World) => who(w, (a) => a.npc!.job === "worker");
const landlord = (w: World) => who(w, (a) => a.npc!.shop === "pub");
const lionel = (w: World) => who(w, (a) => a.npc!.shop === "pawn");
const reporter = (w: World) => who(w, (a) => a.npc!.job === "press");
const keg = (w: World): Item | undefined => Object.values(w.state.items).find((i) => i.label === KEG_LABEL && i.loc.k === "ground");
const lorryOf = (w: World) => Object.values(w.state.stadium!.vehicles).find((v) => v.kind === "lorry");
const atPub = (v: { x: number; y: number }) => dist(v, { x: VENUE.delivery.route[0], y: VENUE.delivery.route[1] }) < 3;
const tGift = () => 60 * Math.max(100, KICKOFF_AT - 330);
const holding = (w: World, pc: Actor): Item | undefined => [pc.hand, ...pc.pockets].map((id) => (id ? w.state.items[id] : undefined)).find((i) => i?.def === "tankard");
const mm = (t: number) => { const s = Math.max(0, Math.ceil(t / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const mates = (w: World): Actor[] => { const s = w.state, star = theirStar(w); return s.match!.teams[1].squad.map((id) => s.actors[id]).filter((a) => a?.fb && a.fb.status === "playing" && a.id !== star?.id && a.fb.role !== "GK").slice(0, 2); };

/** A line a man says to nobody while Grozz is in earshot: how the scheme's parts are found out. */
function aside(w: World, sc: SchemeState, key: string, a: Actor | undefined, text: string, clue: string, max = 2): void {
  const s = w.state, pc = s.actors[s.stadium!.pc], n = sc.vars[`n_${key}`] ?? 0;
  if (!a || !pc || n >= max || dist(a, pc) > 7 || pc.hiddenIn || s.tick < (sc.vars.quiet ?? 0) || (a.npc!.bubble && a.npc!.bubble.until > s.tick) || a.npc!.mode !== "routine") return;
  say(w, a, text, 4.2);
  sc.vars[`n_${key}`] = n + 1; sc.vars.quiet = s.tick + 60 * 16;
  learn(w, DEF, sc, clue);
}

function pin(w: World, a: Actor | undefined, p: { x: number; y: number }, secs: number): void {
  if (!a) return;
  a.hiddenIn = undefined; a.x = p.x; a.y = p.y; a.vx = a.vy = 0; a.moveX = a.moveY = 0;
  if (a.fb) { a.fb.tx = p.x; a.fb.ty = p.y; }
  if (a.npc) { a.npc.staged = w.state.tick + Math.round(60 * secs); a.npc.plan = [{ k: "wait", s: secs }]; a.npc.goal = null; a.npc.path = []; }
}
const SPOT = { star: { x: 16.2, y: -54.6 }, m1: { x: 18.6, y: -54 }, m2: { x: 14.8, y: -52.8 }, rep: { x: 19.4, y: -52.2 } };
const cast = (w: World) => { const [m1, m2] = mates(w); return { star: theirStar(w), m1, m2, rep: reporter(w) }; };
const line = (who2: "star" | "m1" | "m2" | "rep", text: string, secs = 3) => (w: World) => { const a = cast(w)[who2]; if (a) say(w, a, text, secs); };
const room = () => ROOM;
const atStar = () => SPOT.star;
const stage = (w: World, secs: number, press: boolean) => { const c = cast(w); pin(w, c.star, SPOT.star, secs); pin(w, c.m1, SPOT.m1, secs); pin(w, c.m2, SPOT.m2, secs); if (press) pin(w, c.rep, SPOT.rep, secs); };

const B = (secs: number, at: Beat["at"], go?: Beat["go"], o: Partial<Beat> = {}): Beat => ({ secs, at, go, cut: true, ...o });
const has = (sc: SchemeState, id: string) => !!sc.met[id];

const DEF: SchemeDef = {
  id: "visitors", title: "A keg for the visitors",
  on: () => PACE.calm && VENUE.id === "qf",
  clues: [
    { id: "gift", note: "The keg with the bow goes to the visitors' dressing room. Every match.", mutter: "A keg. For them." },
    { id: "hose", note: "Whatever's in the hose is what's in the kegs.", mutter: "" },
    { id: "tankard", note: "The first pint's drunk from the '66 tankard. Lionel's got it in his window.", mutter: "No cup, no toast." },
    { id: "press", note: "The reporter's got nothing to film. With a camera on him, a captain can't say no.", mutter: "" },
    { id: "shiny", note: "She won't come for a keg. She'll come for something shiny.", mutter: "" },
    { id: "float", note: "The landlord would have the tankard back himself, if the till ran to it.", mutter: "" },
  ],
  conds: [
    { id: "foul", clue: "hose", known: "The visitors' keg is full of drain.", unknown: "What goes in the keg?", test: (w, sc) => (sc.vars.sent ? (sc.vars.foul ? "drain" : "") : w.state.stadium!.beer?.load ? "drain" : "") },
    { id: "tankard", clue: "tankard", known: "The tankard's going with it.", unknown: "What do they drink it from?", test: (_w, sc) => (sc.vars.tankard ? "yes" : "") },
    { id: "press", clue: "press", known: "The cameras are following the keg.", unknown: "Who'd make them drink it?", test: (_w, sc) => (sc.vars.press ? "yes" : "") },
  ],
  actions: [
    { id: "hang", label: "Hang the tankard on the keg", hint: "It goes with the keg. The captain drinks from it.", priority: 79,
      can: (w, pc, sc) => { const k = keg(w); return !sc.vars.sent && !sc.vars.tankard && k && holding(w, pc) && dist(pc, k.loc as { x: number; y: number }) < 2.3 ? null : "no"; },
      run: (w, pc, sc) => { const t = holding(w, pc)!; moveItem(w.state, t.id, { k: "gone" }); sc.vars.tankard = 1; w.bus.emit({ type: "scheme_did", t: w.state.tick, scheme: "visitors", what: "hang", ...HOME }); } },
    { id: "after", label: "Send the tankard after the keg", hint: "On this run. It'll catch the keg up at the ground.", priority: 79,
      can: (w, pc, sc) => { const v = lorryOf(w), c = v && w.state.items[v.cargo]; return sc.vars.sent && !sc.vars.tankard && !sc.vars.late && !sc.variant && v && v.state === "loading" && atPub(v) && c?.loc.k === "ground" && holding(w, pc) && dist(pc, c.loc) < 2.6 ? null : "no"; },
      run: (w, pc, sc) => { moveItem(w.state, holding(w, pc)!.id, { k: "gone" }); sc.vars.late = 1; w.bus.emit({ type: "scheme_did", t: w.state.tick, scheme: "visitors", what: "after", x: pc.x, y: pc.y }); } },
    { id: "tip", label: "Tell her about the keg", hint: "She'll follow it, if there's a picture in it.", priority: 71,
      can: (w, pc, sc) => { const r = reporter(w); return sc.clues.gift && !sc.vars.press && !sc.variant && r && r.npc!.mode === "routine" && dist(pc, r) < 2.6 ? null : "no"; },
      run: (w, pc, sc) => {
        const r = reporter(w)!;
        r.facing = Math.atan2(pc.y - r.y, pc.x - r.x);
        learn(w, DEF, sc, "press", true);
        if (sc.vars.tankard || sc.vars.late) { say(w, r, "A trophy and a foreigner? That's a package. Kev! Camera!", 4); sc.vars.press = 1; r.npc!.plan = [{ k: "go", ...VENUE.delivery.gateStop, run: true }, { k: "wait", s: 900 }]; }
        else { say(w, r, "A keg in a van isn't a picture. Find me something shiny.", 4); learn(w, DEF, sc, "shiny"); }
      } },
  ],
  variants: [
    // What he wanted: foul, in the tankard, on camera.
    { id: "full", when: (sc) => has(sc, "foul") && has(sc, "tankard") && has(sc, "press"), beats: [
      B(2.4, room, (w) => { stage(w, 22, true); line("m1", "A gift! From the pub of the English!")(w); }, { caption: "MEANWHILE: THE AWAY DRESSING ROOM", link: "THE KEG IS OPENED IN THE AWAY DRESSING ROOM" }),
      B(2.6, () => SPOT.rep, line("rep", "The '66 tankard. First pint's the captain's. Tradition.")),
      B(2.4, atStar, line("star", "Now? Before the match?")),
      B(2.4, () => SPOT.m2, line("m2", "The cameras, capitão. Drink.")),
      B(2.6, atStar, line("star", "...Saúde."), { link: "THE CAPTAIN TOASTS, ON CAMERA" }),
      B(2.8, atStar, (w) => { const st = theirStar(w); line("star", "It tastes of... England.")(w); if (st) w.bus.emit({ type: "spew", t: w.state.tick, who: st.id, x: st.x, y: st.y, first: false }); }),
      { secs: 3.2, at: (w) => w.state.actors[w.state.stadium!.pc], go: (w) => w.bus.emit({ type: "scheme_line", t: w.state.tick, text: "Heh heh heh." }) },
      { secs: 4, at: atStar, link: "PORTUGAL'S CAPTAIN WITHDRAWN, 'UNWELL'", go: (w, sc) => {
        const st = theirStar(w), [a, b] = mates(w);
        if (st) matchfx.withdraw(w, st.id, "unwell");
        if (a) matchfx.dose(w, a.id, Math.max(40, KICKOFF_AT - w.state.tick / 60 + 70));
        if (b) matchfx.dose(w, b.id, Math.max(90, KICKOFF_AT - w.state.tick / 60 + 190));
        sc.vars.result = 3;
        w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: "visitors", text: `TEAM NEWS: ${(st?.name.split(" ").pop() ?? "THEIR CAPTAIN").toUpperCase()} WITHDRAWN, "UNWELL"`, clip: "tannoy_teamnews" });
      } },
    ] },
    // No cameras: a captain delegates.
    { id: "quiet", when: (sc) => has(sc, "foul") && has(sc, "tankard"), beats: [
      B(2.4, room, (w) => { stage(w, 14, false); line("m1", "A gift! And the famous tankard.")(w); }, { caption: "MEANWHILE: THE AWAY DRESSING ROOM", link: "THE KEG IS OPENED IN THE AWAY DRESSING ROOM" }),
      B(2.6, atStar, line("star", "No cameras? Then you drink it, Rui.")),
      B(2.8, () => SPOT.m1, (w) => { const a = cast(w).m1; line("m1", "Saúde. ...Oh. Oh no.")(w); if (a) w.bus.emit({ type: "spew", t: w.state.tick, who: a.id, x: a.x, y: a.y, first: false }); }, { link: "RUI DRINKS IT INSTEAD" }),
      { secs: 3, at: room, go: (w, sc) => { const a = cast(w).m1; if (a) matchfx.dose(w, a.id, Math.max(30, KICKOFF_AT - w.state.tick / 60 + 45)); sc.vars.result = 2; learn(w, DEF, sc, "press"); w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: "visitors", text: "NOBODY WAS FILMING. THE CAPTAIN PASSED IT ON." }); } },
    ] },
    // Foul, and nothing to drink it from.
    { id: "dry", when: (sc) => has(sc, "foul"), beats: [
      B(2.6, room, (w) => { stage(w, 9, false); line("m1", "A keg. And no cup. We are not animals.")(w); }, { caption: "MEANWHILE: THE AWAY DRESSING ROOM" }),
      B(2.6, () => SPOT.m2, line("m2", "Leave it. It can be a seat.")),
      { secs: 2, at: room, go: (w, sc) => { sc.vars.result = 1; learn(w, DEF, sc, "tankard"); w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: "visitors", text: "IT WENT UNDRUNK. NOBODY TOASTS FROM NOTHING." }); } },
    ] },
    // Everything arranged except the point of it.
    { id: "lovely", when: (sc) => has(sc, "tankard") && has(sc, "press"), beats: [
      B(2.6, room, (w) => { stage(w, 12, true); line("rep", "The '66 tankard. First pint's the captain's.")(w); }, { caption: "MEANWHILE: THE AWAY DRESSING ROOM" }),
      B(2.8, atStar, line("star", "Saúde. ...That is a very good pint.")),
      B(2.6, () => SPOT.m1, line("m1", "He is smiling. He never smiles."), { link: "PORTUGAL'S CAPTAIN HAS NEVER FELT BETTER" }),
      { secs: 2, at: room, go: (w, sc) => { const st = theirStar(w); if (st) matchfx.lift(w, st.id, 300); sc.vars.result = -1; learn(w, DEF, sc, "hose"); w.bus.emit({ type: "scheme_news", t: w.state.tick, scheme: "visitors", text: "A LOVELY GESTURE. HE'S NEVER FELT BETTER." }); } },
    ] },
    // Nothing arranged: the keg's a keg.
    { id: "none", when: () => true, beats: [] },
  ],
  init: (w, sc) => {
    const s = w.state;
    const k = spawnItem(s, "keg", { k: "ground", ...HOME });
    k.home = { ...HOME }; k.label = KEG_LABEL;
    const d = drayman(w); if (d) k.owner = d.id;
    SHOPS.pawn.stock.tankard = PRICE;
    w.bus.on((e: any) => {
      if (e.type === "bus_arrives") sc.vars.teamAt = s.tick;
      if (e.type === "hose") learn(w, DEF, sc, "hose", true);
      if (e.type !== "action" || e.action?.verb !== "buy" || e.action.actor !== s.stadium!.pc) return;
      const seller = e.action.target?.k === "actor" ? s.actors[e.action.target.id] : undefined;
      if (e.action.arg === "tankard") { delete SHOPS.pawn.stock.tankard; sc.vars.bought = 1; learn(w, DEF, sc, "tankard", true); }
      else if (seller?.npc?.shop === "pub") sc.vars.spend = (sc.vars.spend ?? 0) + (SHOPS.pub.stock[e.action.arg] ?? 0);
    });
  },
  step: (w, sc) => {
    const s = w.state, st = s.stadium!, tick = s.tick, pc = s.actors[st.pc];
    if (!pc || sc.done) return;
    const d = drayman(w), ll = landlord(w), li = lionel(w), rep = reporter(w), v = lorryOf(w), k = keg(w);
    const loadingAtPub = !!v && v.state === "loading" && atPub(v);

    // What people say to nobody, in Grozz's hearing.
    if (!sc.vars.sent) {
      if (k && dist(pc, k.loc as { x: number; y: number }) < 2.6) learn(w, DEF, sc, "gift");
      aside(w, sc, "dray", d && !d.npc!.fetch ? d : undefined, "That one with the bow's for the Portuguese. Dressing room. Tradition.", "gift");
      aside(w, sc, "land", ll, sc.vars.tankard ? "Sixty years we've sent them a keg. They never send it back." : "They can't toast it without the '66 tankard. Lionel's got that. Don't ask.", sc.vars.tankard ? "gift" : "tankard");
      if (!sc.vars.tankard && !sc.vars.bought) aside(w, sc, "lion", li, "That tankard? Pub's. He'll be back for it when he's flush. Twenty-five.", "tankard", 1);
      aside(w, sc, "rep", sc.vars.press ? undefined : rep, "Nothing. Not a thing to point a camera at. I'd kill for a trophy.", "press");
    }

    // Enough over the bar, and the landlord goes and gets it himself.
    if ((sc.vars.spend ?? 0) >= ROUND && !sc.vars.bought && !sc.vars.tankard && !sc.vars.sent && !sc.vars.redeem && ll && li && ll.npc!.mode === "routine") {
      sc.vars.redeem = 1; sc.vars.bought = 1;
      say(w, ll, "Go on, then: that's the tankard money. Mind the bar.", 4);
      learn(w, DEF, sc, "float");
      ll.npc!.plan = [{ k: "go", x: li.x, y: li.y + 2.6, run: true }, { k: "wait", s: 3 }];
      sc.cause = sc.cause || rootCause(w, "GROZZ DRINKS THE TILL FULL", ll, "authored");
    }
    if (sc.vars.redeem === 1 && ll && li && dist(ll, li) < 3.6) {
      sc.vars.redeem = 2; delete SHOPS.pawn.stock.tankard;
      say(w, li, "Twenty-five. It's looked lovely in the window.", 3.5);
      linkCause(w, sc.cause, "THE LANDLORD REDEEMS THE '66 TANKARD", li, "authored");
      ll.npc!.plan = [{ k: "wait", s: 2.5 }, { k: "go", x: HOME.x + 0.9, y: HOME.y + 0.5, run: true }, { k: "wait", s: 4 }];
    }
    if (sc.vars.redeem === 2 && ll && dist(ll, HOME) < 2.4) {
      sc.vars.redeem = 3;
      if (!sc.vars.sent) { sc.vars.tankard = 1; say(w, ll, "There. Like '66 never happened to anyone else.", 4); learn(w, DEF, sc, "tankard", true); w.bus.emit({ type: "scheme_did", t: tick, scheme: "visitors", what: "hang", ...HOME }); }
      else say(w, ll, "Gone already. It'll have to go behind the bar.", 4);
    }

    // The keg's run: the first time the lorry leaves the pub after its time, with the bow on.
    if (!sc.vars.sent && v && k && tick >= tGift() - 60 * 14) {
      if (loadingAtPub && v.until - tick < 60 * 12 && v.until >= tGift() && !sc.vars.called && d && dist(k.loc as { x: number; y: number }, HOME) < 9) {
        sc.vars.called = 1;
        say(w, d, "And the one with the bow. Mind the bow.", 3.5);
        if (dist(pc, d) < 10) learn(w, DEF, sc, "gift");
      }
      if (sc.vars.ls && !loadingAtPub && v.state === "driving" && tick >= tGift() && dist(k.loc as { x: number; y: number }, HOME) < 9) {
        sc.vars.sent = tick; sc.vars.foul = st.beer?.load ? 1 : 0;
        // It's on the lorry and off his hands: nobody's to go looking for it.
        k.owner = undefined; k.home = undefined;
        moveItem(s, k.id, { k: "gone" });
        if (!sc.vars.press && rep && dist(rep, v) < 13) { sc.vars.press = 1; say(w, rep, "What's that with a bow on? Kev: follow that keg.", 4); rep.npc!.plan = [{ k: "go", ...VENUE.delivery.gateStop, run: true }, { k: "wait", s: 900 }]; learn(w, DEF, sc, "press", true); }
        if (sc.vars.foul || sc.vars.tankard || sc.vars.press) {
          sc.cause = sc.cause || rootCause(w, "A KEG FOR THE VISITORS", v, "authored");
          linkCause(w, sc.cause, sc.vars.foul ? "IT LEAVES THE PUB FULL OF DRAIN" : "IT LEAVES THE PUB", v, "authored");
        }
        w.bus.emit({ type: "scheme_did", t: tick, scheme: "visitors", what: "sent", x: v.x, y: v.y, foul: !!sc.vars.foul, tankard: !!sc.vars.tankard, press: !!sc.vars.press });
      }
    }
    sc.vars.ls = loadingAtPub ? 1 : 0;
    if (sc.vars.sent && v && v.state === "unloading" && !atPub(v)) {
      if (!sc.vars.delivered) { sc.vars.delivered = tick; const k2 = spawnItem(s, "keg", { k: "ground", ...ROOM }); k2.label = "the visitors' keg, delivered"; }
      if (sc.vars.late === 1 && tick > sc.vars.lateAt!) { sc.vars.late = 2; sc.vars.tankard = 1; }
    }
    if (sc.vars.late === 1 && !sc.vars.lateAt) sc.vars.lateAt = tick + 60 * 5;

    // Counted when the team are in and the keg's there: before kick-off, or failing that at half-time.
    const ph = s.match?.phase;
    if (!sc.variant && sc.vars.delivered && sc.vars.teamAt && tick > sc.vars.delivered + 60 * 6 && tick > sc.vars.teamAt + 60 * 16 && ((ph === "pre" && tick < 60 * (KICKOFF_AT - 14)) || (ph === "break" && s.match!.period === 1)) && sc.vars.late !== 1)
      play(w, DEF, sc, ROOM);
  },
  things: (w, sc) => {
    const out: import("./schemes").Thing[] = [], tick = w.state.tick, k = keg(w), v = lorryOf(w), rep = reporter(w), li = lionel(w);
    if (k && !sc.vars.sent) {
      const p = k.loc as { x: number; y: number };
      const dep = v && v.state === "loading" && atPub(v) ? v.until : 0;
      const when = dep && dep >= tGift() ? `GOES IN ${mm(dep - tick)}` : tick < tGift() ? `NOT BEFORE ${mm(tGift() - tick)}` : "NEXT RUN";
      out.push({ x: p.x, y: p.y, z: 1.5, bow: true, cup: !!sc.vars.tankard, board: `FOR THE VISITORS · ${when}`, mark: sc.clues.gift ? (sc.met.foul ? "full of drain" : sc.clues.hose ? "filled from the hose" : "to their dressing room") : undefined });
    }
    if (sc.vars.delivered) out.push({ x: ROOM.x, y: ROOM.y, bow: true, cup: !!sc.vars.tankard });
    if (li && sc.clues.tankard && !sc.vars.bought && !sc.vars.tankard) out.push({ x: li.x, y: li.y, z: 1.9, mark: "the '66 tankard" });
    if (rep && sc.clues.press && !sc.vars.press) out.push({ x: rep.x, y: rep.y, z: 1.9, mark: sc.clues.shiny ? "wants something shiny" : "nothing to film" });
    return out;
  },
};

export function installVisitors(): void { defineScheme(DEF); }

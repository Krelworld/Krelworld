// The beer line: lorry -> hose -> kegs -> the ground's bars -> supporters -> the gents.
// A process carries whatever it's fed. Put the drayman's filling hose down the sewer and the kegs fill
// with that instead; nothing happens then. The kegs go to the ground, the bars put them on, and from
// there every pint served is what you put in: supporters are sick where they stand, each mess is
// somebody's to mop up (so stewards and cleaners are pulled about by it), the gents fills, the bar
// gets the blame, and the tannoy says what the tannoy says. Early, and it runs all match.
// The lesson is the delay and the persistence: change what a line carries and everyone downstream gets it.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import { pick, rndRange } from "../core/rng";
import { PACE, SPOTS, VENUE } from "./layout";
import { say } from "./npc";
import { linkCause, rootCause } from "./cause";
import { free, problem, stim } from "./machine";
import { urge } from "./social";

export interface Beer {
  hose: "lorry" | "sewer"; at: number; cause: number;
  /** The kegs in the yard are full of it; it's due at the ground by; the ground's bars are on it from. */
  load?: number; due?: number; foulAt?: number;
  sick: number; next: number; revolt?: boolean; told?: boolean;
}

const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** Where the hose runs from the lorry to the kegs, with the drain cover beside it. */
export const hoseAt = () => ({ x: mx(-29.5), y: 70.7 });
export const hasBeerLine = () => PACE.calm && VENUE.id === "qf";
const beer = (w: World): Beer => (w.state.stadium!.beer ??= { hose: "lorry", at: 0, cause: 0, sick: 0, next: 0 });
const drayman = (w: World) => Object.values(w.state.actors).find((a) => a.npc?.job === "worker" && !a.dead);

/** Is the drayman stood there looking at it (his hose, the back of his lorry)? Away after a keg, or with
 *  his head turned, he isn't. His attention is the gate on everything in his yard. */
export const hoseWatched = (w: World): Actor | undefined => draymanWatching(w, hoseAt());
export function draymanWatching(w: World, h: { x: number; y: number }): Actor | undefined {
  const d = drayman(w), tick = w.state.tick;
  if (!d || !free(w, d) || d.npc!.duty || dist(d, h) > 7.5) return undefined;
  if (d.npc!.gawk && d.npc!.gawk.until > tick && dist(d.npc!.gawk, h) > 3) return undefined;
  // Nor with his back to it, unless he's right on top of it.
  const dd = dist(d, h);
  if (dd > 2.5 && Math.cos(Math.atan2(h.y - d.y, h.x - d.x) - d.facing) < 0.15) return undefined;
  return d;
}

export function installBeer(): void {
  registerVerb("hose", {
    check: (w, _act, actor) => {
      if (!hasBeerLine()) return "nothing to do";
      if (dist(actor, hoseAt()) > 2.4) return "too far";
      if (beer(w).hose !== "lorry") return "it's done";
      return null;
    },
    perform: (w, _act, actor) => {
      const s = w.state, b = beer(w), d = hoseWatched(w);
      if (d) {
        say(w, d, pick(s.rng.world, ["Oi! Hands off my line!", "Leave that hose alone, fatso.", "Touch that again and you'll wear it."]), 3);
        d.facing = Math.atan2(actor.y - d.y, actor.x - d.x);
        w.bus.emit({ type: "hose_no", t: s.tick, by: actor.id, who: d.id });
        return;
      }
      b.hose = "sewer"; b.at = s.tick;
      b.cause = rootCause(w, "GROZZ PUTS THE BEER LINE DOWN THE SEWER", hoseAt(), "process");
      w.bus.emit({ type: "hose", t: s.tick, by: actor.id, ...hoseAt() });
    },
  });
}

const GENTS = () => ({ x: mx(11), y: 41.6 });
const SICK = ["BLEURGH.", "This lager's OFF.", "Tastes like a drain!", "I've had worse. ...No. No, I haven't.", "Oh God. Oh God, it's coming back up.", "Who's pulled this, a plumber?"];

export function stepBeer(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, b = st.beer;
  if (!b || tick % 30 !== 0) return;
  const d = drayman(w), r = s.rng.world;
  if (b.hose === "sewer") {
    // Eight seconds of that and the kegs are full of it.
    if (!b.load && tick - b.at > 60 * 8) {
      b.load = tick; b.due = tick + 60 * 70;
      b.cause = linkCause(w, b.cause, "THE KEGS FILL UP", hoseAt(), "process") || b.cause;
      w.bus.emit({ type: "kegs_foul", t: tick, ...hoseAt() });
    }
    // He's back, and after a bit he notices: it's his to put right. Too late for what's in the kegs.
    if (d && free(w, d) && !d.npc!.duty && dist(d, hoseAt()) < 4.5 && tick - b.at > 60 * 16)
      problem(w, "fallen", hoseAt(), { owner: d.id, key: "hose", fixSecs: 5, cause: b.cause, label: b.load ? "DRAYMAN PUTS HIS HOSE BACK, NONE THE WISER" : "DRAYMAN CATCHES IT IN TIME", line: b.load ? "Who's been at my hose? ...Bit ripe round here." : "Who's been at my hose?!" });
  }
  // Off to the ground with the lorry (or, failing that, on a sack truck by and by).
  if (b.load && !b.foulAt) {
    const lorry = Object.values(st.vehicles).find((v) => v.kind === "lorry");
    const arrived = lorry && lorry.state === "unloading" && tick - b.load > 60 * 10;
    if (arrived || tick > (b.due ?? 0)) {
      b.foulAt = tick + 60 * 5; b.next = b.foulAt;
      b.cause = linkCause(w, b.cause, "DELIVERED TO THE GROUND", lorry ?? SPOTS.loadingBay, "process") || b.cause;
    }
  }
  if (!b.foulAt || tick < b.next || b.sick >= 18 || s.match?.phase === "finished") return;
  // Somebody inside with a pint finds out. Near Grozz for preference, so he gets to see his work.
  const pc = s.actors[st.pc];
  const pool = Object.values(s.actors).filter((a) => a.npc?.job === "fan" && free(w, a) && !a.npc.duty && VENUE.inside(a.x, a.y) && (a.effects.sick ?? 0) < tick);
  if (!pool.length) { b.next = tick + 60 * 4; return; }
  const near = pc ? pool.filter((a) => dist(a, pc) < 26 && dist(a, pc) > 2) : [];
  const v = near.length ? pick(r, near) : pick(r, pool);
  b.sick++;
  v.effects.sick = tick + 60 * 45;
  say(w, v, pick(r, SICK), 3);
  const at = { x: v.x, y: v.y };
  v.npc!.group = undefined;
  v.npc!.plan = [{ k: "wait", s: 1.4 }];
  urge(w, v, 1.5, b.cause); // and then it's the gents, with everybody else
  w.bus.emit({ type: "spew", t: tick, who: v.id, ...at, first: b.sick === 1 });
  let c = b.cause;
  if (b.sick === 1) c = linkCause(w, c, "FIRST PINT SERVED", at, "process") || c;
  c = linkCause(w, c, b.sick === 1 ? `${(v.name.split(" ").pop() ?? "").toUpperCase()} IS SICK ON HIS OWN SHOES` : b.sick === 4 ? "THE LAGER'S OFF" : b.sick === 9 ? "THE GENTS IS FULL" : `SICK IN THE STANDS (${b.sick})`, v, "process") || c;
  b.cause = c;
  // Every one of them is a mess for somebody to see to.
  problem(w, "mess", at, { cause: c, fixSecs: 9, line: pick(r, ["Code brown. I repeat, code brown.", "Not again. Mop!", "I don't get paid enough."]) });
  stim(w, "spectacle", at, { r: 7, secs: 4, cause: c, cap: 0 });
  // The bar gets the blame.
  if (b.sick === 6 && !b.revolt) {
    b.revolt = true;
    const bar = SPOTS.barS;
    const mob = Object.values(s.actors).filter((a) => a.npc?.job === "fan" && free(w, a) && !a.npc.duty && dist(a, bar) < 30 && !a.seated).sort((p, q) => dist(p, bar) - dist(q, bar)).slice(0, 5);
    mob.forEach((a, k) => { a.npc!.group = undefined; a.npc!.plan = [{ k: "go", x: bar.x + (k - 2) * 0.9, y: bar.y + 1.2 }, { k: "say", text: pick(r, ["WE WANT OUR MONEY BACK!", "Seven quid for THAT?", "Get the manager. GET THE MANAGER."]) }, { k: "wait", s: 22 }]; a.npc!.why = "angry"; a.npc!.whyUntil = tick + 60 * 25; });
    const cc = linkCause(w, c, "THE BAR GETS IT IN THE NECK", bar, "process") || c;
    problem(w, "row", { x: bar.x, y: bar.y + 1.5 }, { cause: cc, fixSecs: 16, line: "Calm down! It's only lager!" });
    stim(w, "spectacle", bar, { r: 40, secs: 25, cause: cc, cap: 2 });
    st.flags.barShut = tick;
    b.cause = cc;
  }
  if (b.sick === 10 && !b.told) { b.told = true; w.bus.emit({ type: "lager_off", t: tick }); b.cause = linkCause(w, b.cause, "THE TANNOY ADVISES AGAINST THE LAGER", undefined, "process") || b.cause; }
  b.next = tick + Math.round(60 * (b.told ? rndRange(r, 14, 22) : rndRange(r, 5, 9)));
}

/** A pint bought inside once the kegs are on is what was put in them. */
export function installBeerWatch(w: World): void {
  w.bus.on((e: any) => {
    const st = w.state.stadium, b = st?.beer;
    if (!st || !b?.foulAt || w.state.tick < b.foulAt || e.type !== "action" || e.action?.verb !== "buy" || e.action.arg !== "pint") return;
    const buyer = w.state.actors[e.action.actor];
    if (!buyer || !VENUE.inside(buyer.x, buyer.y)) return;
    const it = [buyer.hand, ...buyer.pockets].map((id) => (id ? w.state.items[id] : undefined)).find((i) => i?.def === "pint" && !i.spiked);
    if (it) { it.spiked = "laxative"; it.label = "Pint of… lager"; }
  });
  // The drayman's put it back: the line carries beer again (what's already in the kegs is in the kegs).
  w.bus.on((e: any) => {
    const b = w.state.stadium?.beer;
    if (b && e.type === "fixed" && e.key === "hose" && b.hose === "sewer") { b.hose = "lorry"; w.bus.emit({ type: "hose_back", t: w.state.tick, ...hoseAt() }); }
  });
}

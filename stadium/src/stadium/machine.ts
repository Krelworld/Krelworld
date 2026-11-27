// The living machine: a few rules everybody obeys, so what Grozz learns in one place works in another.
//   Custody    things have owners and a place they belong; an owner who finds his thing moved goes after it.
//   Obligation a problem (a thing out of place, barriers down, sick on the floor, a row) is somebody's to
//              fix; he leaves what he was doing, fixes it, and goes back. One problem each: a second waits.
//   Attraction something worth a look or worth having (a spectacle, a smell, something free, a queue) pulls
//              in the people who want that, up to a number, and lets them go again.
//   Attention  a noise or a scene turns nearby heads for a few seconds (and they don't see behind them).
// Whatever any of them does carries the cause that set it off (cause.ts), so a steward leaving his
// turnstile to fetch his flask still knows it started with Grozz's throw.
// No planner: each rule hands a person a short plan and his routine picks up when it runs out.
import type { World } from "../core/world";
import type { Actor, Id, Item } from "../core/types";
import { defOf, moveItem, spawnItem } from "../core/items";
import { registerVerb } from "../core/verbs";
import { chance, pick } from "../core/rng";
import { areaAt, PACE, SPOTS, TURNSTILES, VENUE } from "./layout";
import { isSecurity } from "./security";
import { say } from "./npc";
import type { Npc } from "./state";
import { carry, linkCause, rootCause, running, type RuleFamily } from "./cause";

export type StimTag = "spectacle" | "smell" | "freebie" | "queue";
export interface Stim {
  id: number; tag: StimTag; x: number; y: number; r: number; until: number; cause: number;
  /** How many it has pulled in, of how many it can; who they are. */
  n: number; cap: number; who: Id[];
  /** How long they stay, the name of the thing ("burgers"), and for a queue which way it trails. */
  secs: number; what?: string; dx?: number; dy?: number;
}
export type ProblemKind = "displaced" | "lost" | "fallen" | "mess" | "row" | "statement";
export interface Problem {
  id: number; kind: ProblemKind; x: number; y: number; cause: number; since: number;
  owner?: Id; item?: Id; by?: Id; stage: number; until: number; fixSecs: number;
  /** What to call it on the strap when someone takes it on; what he says; and a key for whoever's listening for "fixed". */
  label?: string; line?: string; key?: string;
}

type At = { x: number; y: number };
const dist = (a: At, b: At) => Math.hypot(a.x - b.x, a.y - b.y);
const SUR = (a: Actor) => (a.name.split(" ").pop() ?? "").toUpperCase();
const thing = (it: Item) => (it.label ?? defOf(it).name).toLowerCase().replace(/^(the|a|an) /, "").replace(/^.*'s /, "");
/** Getting on with his day: up, about, not after anybody, not already seeing to something. */
export const free = (w: World, a: Actor | undefined): a is Actor => !!a?.npc && !a.dead && !a.hiddenIn && a.downUntil <= w.state.tick && a.npc.mode === "routine" && !a.heldBy;
const hash = (id: string) => { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; };

const M = (w: World) => {
  const st = w.state.stadium!;
  st.stims ??= []; st.problems ??= [];
  return st as typeof st & { stims: Stim[]; problems: Problem[] };
};
const seq = (w: World) => (w.state.stadium!.machineSeq = (w.state.stadium!.machineSeq ?? 0) + 1);

// ---------------------------------------------------------------- leaving a post

/** Whoever it is has left what he was minding. What that opens up is the same whatever took him away. */
export function leavePost(w: World, a: Actor, cause: number, secs: number, why: Npc["why"] = "search"): number {
  const s = w.state, st = s.stadium!, n = a.npc!, tick = s.tick, post = n.post;
  n.why = why; n.whyUntil = tick + 60 * secs;
  carry(a, cause, tick, secs + 10);
  // In the game, a beat to react before he goes (the double-take the view plays), so you see the cause land.
  if (PACE.calm && n.plan.length && n.plan[0].k !== "wait") n.plan.unshift({ k: "wait", s: 0.75 });
  w.bus.emit({ type: "post_left", t: tick, by: a.id, why, x: a.x, y: a.y, cause, ambient: !cause });
  const on = post && dist(a, post) < 4;
  let c = cause;
  if (n.job === "worker") {
    const lorry = Object.values(st.vehicles).find((v) => v.kind === "lorry");
    if (lorry && (lorry.state === "loading" || lorry.state === "unloading") && dist(lorry, a) < 15) c = linkCause(w, cause, "LORRY LEFT OPEN", lorry, "access") || c;
  } else if (!on) return c;
  else if (n.job === "turnstile") {
    const i = SPOTS.turnstiles.map((t, k) => ({ k, d: dist(t, post!) })).sort((p, q) => p.d - q.d)[0]?.k ?? 0;
    st.gates[TURNSTILES[i]] = { until: tick + 60 * (secs + 6), for: st.pc };
    c = linkCause(w, cause, "HIS TURNSTILE LEFT ON FREE-WHEEL", post, "access") || c;
  } else if (n.job === "doorguard") {
    st.gates.staffdoor = { until: tick + 60 * (secs + 6), for: null };
    c = linkCause(w, cause, "STAFF DOOR LEFT PROPPED OPEN", post, "access") || c;
  } else if (n.job === "police" && dist(post!, SPOTS.policeVan) < 6) c = linkCause(w, cause, "THE POLICE VAN LEFT UNWATCHED", post, "access") || c;
  else if (n.job === "pitchsteward") c = linkCause(w, cause, "A GAP ON THE TOUCHLINE", post, "access") || c;
  else if (n.job === "gateguard") c = linkCause(w, cause, "SERVICE GATE LEFT UNWATCHED", post, "access") || c;
  else if (n.job === "corridor") c = linkCause(w, cause, "TUNNEL CORRIDOR LEFT UNWATCHED", post, "access") || c;
  return c;
}

// ---------------------------------------------------------------- attention and attraction

/** Something worth a look, a sniff or a place in line. Heads turn at once; who comes over is the step's business. */
export function stim(w: World, tag: StimTag, at: At, o: { r?: number; secs?: number; cause?: number; cap?: number; what?: string; dx?: number; dy?: number } = {}): Stim {
  const s = w.state, m = M(w);
  const e: Stim = { id: seq(w), tag, x: at.x, y: at.y, r: o.r ?? 14, until: s.tick + 60 * (o.secs ?? 14), cause: o.cause ?? 0, n: 0, cap: o.cap ?? 3, who: [], secs: o.secs ?? 14, what: o.what, dx: o.dx, dy: o.dy };
  m.stims.push(e);
  if (tag === "spectacle") attention(w, at, Math.min(e.r, 11), 3.2);
  return e;
}

/** Heads turn. Someone looking at this isn't looking at that (canSee goes by where they face). */
export function attention(w: World, at: At, r: number, secs: number): void {
  const s = w.state;
  for (const id in s.actors) {
    const a = s.actors[id], n = a.npc;
    if (!n || !free(w, a) || a.fb || a.off || n.job === "dog" || dist(a, at) > r || dist(a, at) < 0.6) continue;
    if (n.gawk && n.gawk.until > s.tick) continue;
    n.gawk = { until: s.tick + Math.round(60 * secs), x: at.x, y: at.y, filming: false };
    // Only those stood still turn on the spot; the rest glance as they go.
    if (!n.goal) a.facing = Math.atan2(at.y - a.y, at.x - a.x);
  }
}

/** How likely this person is to come over for that, from where he is. */
function appetite(a: Actor, e: Stim, d: number): number {
  const n = a.npc!;
  if (a.fb || a.off || n.job === "dog" || n.shop || n.job === "chief" || n.job === "player") return 0;
  switch (e.tag) {
    case "spectacle": return n.job === "press" ? 1 : (n.job === "fan" || n.job === "local") && d < 9 ? 0.2 : 0;
    case "smell": return n.job === "doorguard" ? 1 : isSecurity(a) && n.job !== "turnstile" && n.job !== "police" && hash(a.id) % 3 === 0 ? 0.6 : n.job === "fan" && d < 8 ? 0.15 : 0;
    case "freebie": return n.job === "fan" || n.job === "local" ? 0.75 : 0;
    // Social proof: the longer it is, the more it must be for something.
    case "queue": return (n.job === "fan" || n.job === "local") && d < 10 ? Math.min(0.9, 0.3 + 0.14 * e.n) : 0;
  }
}

function stepAttraction(w: World): void {
  const s = w.state, m = M(w), tick = s.tick, r = s.rng.world;
  for (const e of m.stims) {
    if (e.until <= tick) {
      // It's over: anyone still stood there goes back to what he was doing.
      for (const id of e.who) { const a = s.actors[id]; if (a?.npc && a.npc.drawn === e.id) { a.npc.drawn = undefined; if (free(w, a)) a.npc.plan = a.npc.post ? [{ k: "go", ...a.npc.post }] : []; } }
      continue;
    }
    if (e.n >= e.cap) continue;
    const cands = Object.values(s.actors).filter((a) => free(w, a) && !a.npc!.duty && !a.npc!.drawn && (a.npc!.drawnUntil ?? 0) <= tick && dist(a, e) < e.r && dist(a, e) > 1.2)
      .sort((p, q) => dist(p, e) - dist(q, e));
    for (const a of cands) {
      if (e.n >= e.cap) break;
      const n = a.npc!, d = dist(a, e);
      if (!chance(r, appetite(a, e, d))) continue;
      const k = e.n++; e.who.push(a.id);
      n.drawn = e.id; n.drawnUntil = tick + 60 * 50;
      // Where he stands: in line behind the last one, or somewhere round it.
      const ang = (hash(a.id) % 628) / 100;
      const to = e.tag === "queue" ? { x: e.x + (e.dx ?? 0) * 0.95 * (k + 1), y: e.y + (e.dy ?? 1) * 0.95 * (k + 1) } : { x: e.x + Math.cos(ang) * (1.6 + (k % 3) * 0.5), y: e.y + Math.abs(Math.sin(ang)) * 1.4 + 0.9 };
      const stay = Math.max(6, (e.until - tick) / 60);
      n.plan = [{ k: "go", x: to.x, y: to.y, run: n.job === "press" }, { k: "wait", s: stay }, ...(n.post ? [{ k: "go" as const, ...n.post }] : [])];
      n.group = undefined;
      let c = e.cause;
      const fam: RuleFamily = "attraction";
      if (e.tag === "spectacle" && n.job === "press") { c = linkCause(w, c, a.name === "Cameraman" ? "THE CAMERA FOLLOWS" : "THE REPORTER SMELLS A STORY", a, fam) || c; n.gawk = { until: e.until, x: e.x, y: e.y, filming: true }; }
      else if (e.tag === "smell") c = linkCause(w, c, `${SUR(a)} WANDERS OVER FOR ONE`, a, fam) || c;
      else if (e.tag === "freebie") c = linkCause(w, c, `FANS PILE OVER FOR ${(e.what ?? "IT").toUpperCase()}`, a, fam) || c;
      else if (e.tag === "queue") {
        if (k === 0 || k === 3 || k === e.cap - 1) c = linkCause(w, c, k === 0 ? `${SUR(a)} JOINS THE QUEUE` : k === 3 ? "THE QUEUE HAS A LIFE OF ITS OWN" : "THE QUEUE GOES ROUND THE CORNER", a, fam) || c;
        if (k === 0) say(w, a, pick(r, ["This the queue, mate?", "What's this for? ...Go on then.", "Is this the queue?"]), 2.5);
        if (k === 3) { e.until = Math.max(e.until, tick + 60 * 40); stim(w, "spectacle", e, { r: 40, secs: 30, cause: c, cap: 2 }); }
      }
      w.bus.emit({ type: "drawn", t: tick, who: a.id, tag: e.tag, x: e.x, y: e.y, cause: c });
      if (n.post || n.job === "worker") leavePost(w, a, c, stay + 6);
      else carry(a, c, tick, stay + 10);
    }
  }
  m.stims = m.stims.filter((e) => e.until > tick);
}

// ---------------------------------------------------------------- problems and whose they are

/** Something's wrong and somebody ought to see to it. The same problem twice is the same problem. */
export function problem(w: World, kind: ProblemKind, at: At, o: Partial<Pick<Problem, "owner" | "item" | "cause" | "fixSecs" | "label" | "line" | "key">> = {}): Problem {
  const m = M(w), dup = m.problems.find((p) => (o.item && p.item === o.item) || (o.key && p.key === o.key) || (p.kind === kind && !o.item && !o.key && dist(p, at) < 2));
  if (dup) return dup;
  const p: Problem = { id: seq(w), kind, x: at.x, y: at.y, cause: o.cause ?? 0, since: w.state.tick, stage: 0, until: 0, fixSecs: o.fixSecs ?? 8, owner: o.owner, item: o.item, label: o.label, line: o.line, key: o.key };
  m.problems.push(p);
  return p;
}

const KEG_SEEN = ["Oi! Where's that going?", "Bloody hell, my keg!", "Who's rolled that?!"];
const KEG_GOT = ["Bloody kids.", "Every bloody week.", "Who's touching my kegs?"];

/** Who should see to it: its owner, or else the nearest of the right sort with nothing else on. */
function responder(w: World, p: Problem): Actor | undefined {
  const s = w.state;
  if (p.owner) { const o = s.actors[p.owner]; return free(w, o) && !o.npc!.duty ? o : undefined; }
  const ok = (a: Actor) => free(w, a) && !a.npc!.duty && !a.npc!.drawn;
  const near = (f: (a: Actor) => boolean, r: number) => Object.values(s.actors).filter((a) => ok(a) && f(a) && dist(a, p) < r).sort((x, y) => dist(x, p) - dist(y, p))[0];
  const steward = (a: Actor) => isSecurity(a) && a.npc!.job !== "police" && a.npc!.job !== "chief" && a.npc!.job !== "armed";
  switch (p.kind) {
    case "fallen": return near((a) => a.npc!.job === "turnstile", 14) ?? near(steward, 18);
    case "mess": return near((a) => a.npc!.job === "cleaner", 45) ?? near(steward, 26);
    case "row": return near(steward, 30);
    case "statement": return near((a) => a.npc!.job === "police" && !a.npc!.mounted, 45) ?? near(steward, 30);
    default: return undefined;
  }
}

function take(w: World, p: Problem, a: Actor): void {
  const s = w.state, n = a.npc!, r = s.rng.world, it = p.item ? s.items[p.item] : undefined;
  p.by = a.id; p.stage = 0; n.duty = p.id;
  n.group = undefined;
  const label = p.label ?? (p.kind === "displaced" ? `${SUR(a)} GOES AFTER IT` : p.kind === "lost" ? `${SUR(a)} LOOKS FOR HIS ${it ? thing(it).toUpperCase() : "THINGS"}`
    : p.kind === "mess" ? `${SUR(a)} SENT TO MOP IT UP` : p.kind === "row" ? "A STEWARD COMES TO BREAK IT UP" : p.kind === "statement" ? `${SUR(a)} TAKES A STATEMENT` : `${SUR(a)} COMES TO SORT IT OUT`);
  const c = linkCause(w, p.cause, label, a, p.owner ? "custody" : "obligation") || p.cause;
  p.cause = c;
  if (p.kind === "displaced" && it) { n.fetch = it.id; n.plan = [{ k: "go", x: (it.loc as At).x, y: (it.loc as At).y }]; say(w, a, it.def === "keg" ? pick(r, KEG_SEEN) : `Oi! Who's moved my ${thing(it)}?`, 2.5); }
  else if (p.kind === "lost") n.plan = [];
  else n.plan = [{ k: "go", x: p.x + (hash(a.id) % 2 ? 0.9 : -0.9), y: p.y + 0.8 }];
  leavePost(w, a, c, p.kind === "displaced" ? 30 : p.fixSecs + 14, p.kind === "displaced" ? "fetch" : p.kind === "statement" ? "report" : p.kind === "row" ? "angry" : "search");
}

function done(w: World, p: Problem): void {
  const s = w.state, m = M(w), a = p.by ? s.actors[p.by] : undefined;
  m.problems = m.problems.filter((q) => q !== p);
  if (a?.npc) {
    a.npc.duty = undefined; a.npc.fetch = undefined; a.npc.why = undefined;
    if (free(w, a) && a.npc.post) a.npc.plan = [{ k: "go", ...a.npc.post }];
  }
  w.bus.emit({ type: "fixed", t: s.tick, kind: p.kind, key: p.key, item: p.item, by: p.by, x: p.x, y: p.y, cause: p.cause });
}

/** He can't find it. He says so, and if it's worth reporting he reports it. */
function giveUp(w: World, p: Problem, a: Actor, it: Item | undefined): void {
  const s = w.state;
  say(w, a, it ? `Some bastard's had my ${thing(it)}!` : "Some bastard's had it!", 3.5);
  w.bus.emit({ type: "gave_up", t: s.tick, who: a.id, item: it?.id, cause: p.cause });
  const c = p.cause;
  done(w, p);
  if (it) { it.home = undefined; it.stolenFrom ??= a.id; }
  if (!isSecurity(a)) problem(w, "statement", a, { cause: linkCause(w, c, `${SUR(a)} REPORTS IT STOLEN`, a, "custody") || c, fixSecs: 20, line: "Right. Start from the beginning." });
}

function work(w: World, p: Problem): void {
  const s = w.state, st = s.stadium!, tick = s.tick, r = s.rng.world;
  const a = p.by ? s.actors[p.by] : undefined;
  if (!a?.npc || a.dead) { p.by = undefined; return; }
  const n = a.npc;
  if (a.downUntil > tick || a.hiddenIn || n.mode !== "routine") return; // busy: he'll come back to it
  const it = p.item ? s.items[p.item] : undefined;
  const pc = s.actors[st.pc];
  if (p.kind === "displaced") {
    if (!it || it.loc.k === "gone") return done(w, p);
    const mine = st.kegCarry?.[it.id] === a.id, home = it.home ?? { x: p.x, y: p.y };
    if (mine) {
      if (it.loc.k !== "ground") { delete st.kegCarry![it.id]; p.kind = "lost"; p.stage = 0; return; }
      if (!n.plan.length || dist(a, home) < 0.9) { delete st.kegCarry![it.id]; moveItem(s, it.id, { k: "ground", x: home.x, y: home.y }); return done(w, p); }
      return;
    }
    if (it.loc.k !== "ground") { p.kind = "lost"; p.stage = 0; n.plan = []; return; }
    if (st.rolling?.some((q) => q.id === it.id)) { if (!n.plan.length) n.plan = [{ k: "go", x: it.loc.x, y: it.loc.y }]; return; }
    if (dist(a, it.loc) < 1.15) {
      (st.kegCarry ??= {})[it.id] = a.id;
      n.plan = [{ k: "go", x: home.x, y: home.y + 0.6 }];
      say(w, a, it.def === "keg" ? pick(r, KEG_GOT) : pick(r, ["There it is.", "Who put that there?", "Every bloody week."]), 2.5);
    } else if (!n.plan.length) n.plan = [{ k: "go", x: it.loc.x, y: it.loc.y }];
    return;
  }
  if (p.kind === "lost") {
    if (!it || it.loc.k === "gone") return giveUp(w, p, a, undefined);
    // Turned up on the floor somewhere he can see: he goes and gets it.
    if (it.loc.k === "ground" && dist(a, it.loc) < 12) { p.kind = "displaced"; n.fetch = it.id; n.plan = [{ k: "go", x: it.loc.x, y: it.loc.y }]; say(w, a, `Who put my ${thing(it)} over there?!`, 2.5); n.why = "fetch"; return; }
    const holder = it.loc.k === "hand" ? s.actors[it.loc.a] : undefined;
    if (p.stage === 0) {
      if (holder && holder.id !== a.id && dist(a, holder) < 11) { p.stage = 1; p.until = tick + 60 * 12; say(w, a, `OI! That's MY ${thing(it)}!`, 2.5); n.why = "angry"; }
      else { p.stage = 2; p.until = tick + 60 * 13; const h = it.home ?? p; n.plan = [{ k: "go", x: h.x + 1.5, y: h.y + 0.8 }, { k: "wait", s: 2.5 }, { k: "go", x: h.x - 1.6, y: h.y + 1 }, { k: "wait", s: 2.5 }, { k: "go", x: h.x, y: h.y + 0.7 }, { k: "wait", s: 3 }]; say(w, a, `Where's my ${thing(it)}?`, 2.5); }
      return;
    }
    if (p.stage === 1) {
      if (!holder || holder.id === a.id) { p.stage = 0; return; }
      if (dist(a, holder) < 1.5) {
        // He has it back off him. From Grozz, a steward remembers the cheek.
        moveItem(s, it.id, { k: "ground", x: a.x + Math.cos(a.facing) * 0.4, y: a.y + Math.sin(a.facing) * 0.4 });
        say(w, a, pick(r, ["I'll have that back. Cheeky sod.", "Give it here.", "Mine, that."]), 2.5);
        if (holder.id === pc?.id && isSecurity(a)) n.sus[pc.id] = Math.min(1.2, (n.sus[pc.id] ?? 0) + 0.3);
        if (holder.npc) { say(w, holder, pick(r, ["I found it!", "Alright, alright!"]), 2); stim(w, "spectacle", a, { r: 10, secs: 6, cause: p.cause, cap: 1 }); }
        w.bus.emit({ type: "took_back", t: tick, by: a.id, from: holder.id, item: it.id });
        p.kind = "displaced"; n.fetch = it.id; n.plan = []; return;
      }
      if (tick > p.until || dist(a, holder) > 16) { p.stage = 2; p.until = tick + 60 * 4; n.plan = []; return; }
      if (!n.goal || tick % 30 === 0) n.plan = [{ k: "go", x: holder.x, y: holder.y, run: true }];
      return;
    }
    if (tick > p.until) giveUp(w, p, a, it);
    return;
  }
  // The rest: go there, see to it, go back.
  if (p.stage === 0) { if (dist(a, p) < 2 || !n.plan.length) { p.stage = 1; p.until = tick + 60 * p.fixSecs; n.plan = [{ k: "wait", s: p.fixSecs }]; if (p.line) say(w, a, p.line, 3); a.facing = Math.atan2(p.y - a.y, p.x - a.x); } return; }
  if (tick > p.until) done(w, p);
}

/** Owned things out of place, and whether their owners have noticed. */
function stepCustody(w: World): void {
  const s = w.state, st = s.stadium!, m = M(w), tick = s.tick;
  for (const id in s.items) {
    const it = s.items[id];
    if (!it.owner || !it.home || it.def === "boot_bag") continue;
    const owner = s.actors[it.owner];
    if (!owner?.npc || owner.dead || owner.fb) continue;
    const l = it.loc, ground = l.k === "ground";
    if (ground && dist(l, it.home) <= 1.4) continue;
    if (l.k === "hand" && l.a === owner.id) continue;
    if (st.kegCarry?.[id] || st.rolling?.some((q) => q.id === id) || m.problems.some((p) => p.item === id)) continue;
    if (!free(w, owner) || owner.npc.duty || owner.npc.drawn) continue;
    // He notices if he's by where it should be, or it's in plain sight near him.
    if (!(dist(owner, it.home) < 9 || (ground && dist(owner, l) < 10))) continue;
    const recent = it.cause && tick - (it.causeAt ?? 0) < 60 * 150 ? it.cause : 0;
    const cause = recent || (it.movedBy === st.pc ? rootCause(w, `${thing(it).toUpperCase()} GONE`, it.home) : 0);
    problem(w, ground ? "displaced" : "lost", ground ? l : it.home, { owner: owner.id, item: id, cause });
  }
}

/** The Invisible Queue: stand like you're queuing and somebody will join. Then somebody else. */
export function installMachineVerbs(): void {
  registerVerb("queue", {
    check: (w, _act, actor) => {
      if (actor.seated || actor.roof || !areaAt(actor.x, actor.y).outside) return "not here";
      if (M(w).stims.some((e) => e.tag === "queue")) return "there's a queue already";
      return null;
    },
    perform: (w, _act, actor) => {
      const c = rootCause(w, "GROZZ QUEUES FOR NOTHING", actor);
      const e = stim(w, "queue", actor, { r: 10, secs: 14, cap: 9, cause: c, dx: -Math.cos(actor.facing), dy: -Math.sin(actor.facing) });
      w.state.stadium!.flags.queueStim = e.id;
      w.bus.emit({ type: "queued", t: w.state.tick, by: actor.id, x: actor.x, y: actor.y });
    },
  });
}

export function installMachine(w: World): void {
  // Money stays in the world: every till has a float (and whatever you spend goes in it).
  for (const a of Object.values(w.state.actors)) if (a.npc?.shop) a.money = Math.max(a.money, a.npc.shop === "pawn" ? 160 : 40);
  // What Grozz picks up, he's moved: remember it, for when its owner notices.
  w.bus.on((e: any) => {
    const st = w.state.stadium;
    if (!st || e.type !== "action" || e.action?.actor !== st.pc || !e.action.item) return;
    const it = w.state.items[e.action.item];
    if (!it?.owner || !it.home) return;
    it.movedBy = st.pc;
    const run = running(w);
    if (run) { it.cause = run; it.causeAt = w.state.tick; }
  });
}

/** Once, when the day starts: who owns what. */
function init(w: World): void {
  const s = w.state, st = s.stadium!;
  if (st.flags.machineInit) return;
  st.flags.machineInit = 1;
  const dray = Object.values(s.actors).find((a) => a.npc?.job === "worker");
  if (dray) for (const id in s.items) if (s.items[id].def === "keg" && s.items[id].home) s.items[id].owner = dray.id;
  if (!PACE.calm || VENUE.id === "final") return;
  // Ordinary things that are somebody's (the same rule as the kegs, for whoever thinks to try it):
  // each turnstile steward's flask of tea on the wall by his gate, and the reporter's spare pass on the camera case.
  for (const a of Object.values(s.actors)) {
    if (a.npc?.job !== "turnstile" || !a.npc.post) continue;
    const home = { x: a.npc.post.x + 1.5, y: a.npc.post.y + 2.6 };
    const it = spawnItem(s, "flask", { k: "ground", ...home });
    it.owner = a.id; it.home = home; it.label = `${a.name.split(" ").pop()}'s flask`;
  }
  const rep = Object.values(s.actors).find((a) => a.name === "Reporter"), cam = Object.values(s.actors).find((a) => a.name === "Cameraman");
  if (rep && cam) {
    const home = { x: cam.x + 1.1, y: cam.y + 0.5 };
    const it = spawnItem(s, "press_pass", { k: "ground", ...home });
    it.owner = rep.id; it.home = home; it.label = "the reporter's spare pass";
  }
}

export function stepMachine(w: World): void {
  const s = w.state, tick = s.tick;
  if (!s.stadium) return;
  init(w);
  const m = M(w);
  // Carried back: it goes where he goes.
  const st = s.stadium;
  if (st.kegCarry) for (const kid in st.kegCarry) {
    const a = s.actors[st.kegCarry[kid]], it = s.items[kid];
    if (!a || !it || a.dead || a.downUntil > tick || a.hiddenIn || it.loc.k !== "ground") { delete st.kegCarry[kid]; continue; }
    it.loc.x = a.x + Math.cos(a.facing) * 0.45; it.loc.y = a.y + Math.sin(a.facing) * 0.45;
  }
  if (tick % 10 !== 0) return;
  if (tick % 20 === 0) stepCustody(w);
  for (const p of m.problems.slice()) {
    if (!p.by) { const a = responder(w, p); if (a) take(w, p, a); else if (tick - p.since > 60 * 120) m.problems = m.problems.filter((q) => q !== p); continue; }
    work(w, p);
  }
  // A queue with nobody at the front isn't one, till it's long enough not to care.
  const pc = s.actors[st.pc];
  for (const e of m.stims) if (e.tag === "queue" && e.n < 4 && pc && !pc.hiddenIn && dist(pc, e) < 1.4) e.until = Math.max(e.until, tick + 60 * 6);
  if (tick % 30 === 0) stepAttraction(w);
}

/** A VENUE-mirrored x, for things placed by hand. */
export const mx = (x: number) => (VENUE.id === "sf" ? -x : x);

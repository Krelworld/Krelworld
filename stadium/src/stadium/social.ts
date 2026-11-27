// More rules than "somebody walks somewhere". Each of these existed already as a one-off (a steward who
// wouldn't take a second bribe, the ref's laxative, the hi-vis getting you waved through); here each is
// one rule that anybody obeys, so Grozz can change what people hold against each other, what their
// bodies make them do, what a place can cope with, who they'll take orders from and what the stewards
// officially think of him.
//   Grievance   people remember who wronged them: they won't deal with him, and when they meet, they row.
//   Need        what goes in has to come out: a pint means the gents, soon; a bad pint means it now.
//   Capacity    the gents holds so many. The rest queue, and a queue that long ends up the wall.
//   Authority   people do what they're told by someone who outranks them, till they find out he didn't.
//   Recognition hand something in and, officially, you're the honest one (and its owner has to go and get it).
import type { World } from "../core/world";
import type { Actor, Id } from "../core/types";
import { registerVerb } from "../core/verbs";
import { appearance } from "../core/identity";
import { defOf, moveItem } from "../core/items";
import { chance, pick, rndRange } from "../core/rng";
import { SPOTS, VENUE } from "./layout";
import { isSecurity } from "./security";
import { say } from "./npc";
import { carried, carry, linkCause, rootCause } from "./cause";
import { free, leavePost, problem, stim } from "./machine";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
const SUR = (a: Actor) => (a.name.split(" ").pop() ?? "").toUpperCase();

// ---------------------------------------------------------------- grievance

/** How much this person has against that one (0 nothing, 1 words, 2 or more it comes to blows). */
export const grudge = (a: Actor | undefined, against: Id): number => a?.npc?.grudge?.[against] ?? 0;
/** He's been wronged, and he'll remember who by. */
export function grieve(w: World, a: Actor, against: Actor, weight: number, cause = 0): void {
  if (!a.npc || a.id === against.id) return;
  const g = (a.npc.grudge ??= {});
  g[against.id] = Math.min(3, (g[against.id] ?? 0) + weight);
  if (cause) carry(a, cause, w.state.tick, 120);
  w.bus.emit({ type: "grievance", t: w.state.tick, who: a.id, against: against.id, n: g[against.id] });
}

function stepGrievance(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, r = s.rng.world, pc = s.actors[st.pc];
  for (const id in s.actors) {
    const a = s.actors[id], n = a.npc;
    if (!n?.grudge || !free(w, a) || n.duty || (n.rowAt ?? 0) > tick) continue;
    for (const bid in n.grudge) {
      const b = s.actors[bid], g = n.grudge[bid];
      if (!b || b.dead || b.hiddenIn || g < 1 || dist(a, b) > 6) continue;
      n.rowAt = tick + 60 * 40;
      if (b.id === pc?.id) {
        // He's seen you. Words; and if it's bad enough, he's coming over.
        say(w, a, pick(r, ["Oi. I want a word with you.", "You've got a nerve, showing your face.", "That's him. That's the one."]), 3);
        if (g >= 2) { n.retaliateAt = tick + 50; n.retaliateOn = pc.id; n.grudge[bid] = 1; }
        if (isSecurity(a)) n.sus[pc.id] = Math.max(n.sus[pc.id] ?? 0, Math.min(0.9, 0.3 * g));
      } else if (b.npc && free(w, b)) {
        // The two of them have it out, where everyone can see.
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        a.npc!.plan = [{ k: "go", x: mid.x - 0.5, y: mid.y }, { k: "say", text: pick(r, ["You! I've been looking for you!", "Say it to my face, then.", "You owe me, pal."]) }, { k: "wait", s: 9 }, ...(n.post ? [{ k: "go" as const, ...n.post }] : [])];
        b.npc.plan = [{ k: "wait", s: 1.6 }, { k: "say", text: pick(r, ["Me? What have I done?", "Not this again.", "Come on then, if you think you're hard enough."]) }, { k: "wait", s: 8 }, ...(b.npc.post ? [{ k: "go" as const, ...b.npc.post }] : [])];
        const c = linkCause(w, carried(w, a), `${SUR(a)} HAS IT OUT WITH ${SUR(b)}`, mid, "grievance");
        if (n.post) leavePost(w, a, c, 14, "angry"); else { n.why = "angry"; n.whyUntil = tick + 60 * 12; }
        if (b.npc.post) leavePost(w, b, c, 12, "angry");
        stim(w, "spectacle", mid, { r: 14, secs: 10, cause: c, cap: 2 });
        problem(w, "row", mid, { cause: c, fixSecs: 8, line: "Oi! Pack it in, the pair of you." });
        n.grudge[bid] = g - 0.75;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- need and capacity

export interface Loo { id: string; x: number; y: number; qx: number; qy: number; cap: number; users: Id[]; queue: Id[]; shut?: boolean }
const loos = (w: World): Loo[] => (w.state.stadium!.loos ??= VENUE.id === "final" ? [] : [
  { id: "gents", x: mx(11), y: 41.6, qx: mx(4.6), qy: 41.4, cap: 3, users: [], queue: [] },
  ...(VENUE.features.fanZone ? [] : [{ id: "pub", x: mx(-58), y: 65, qx: mx(-55.8), qy: 69.6, cap: 2, users: [], queue: [] }]),
]);
export const looNear = (w: World, a: { x: number; y: number }, r = 2.6): Loo | undefined => loos(w).find((l) => dist({ x: l.qx, y: l.qy }, a) < r);

/** He'll need to go, in so many seconds. (Sooner wins.) */
export function urge(w: World, a: Actor, secs: number, cause = 0): void {
  if (!a.npc || a.fb || a.off) return;
  const at = w.state.tick + Math.round(60 * secs);
  if (!a.npc.need || a.npc.need.at > at) a.npc.need = { at, stage: 0, since: 0 };
  if (cause) carry(a, cause, w.state.tick, secs + 90);
}

function stepNeeds(w: World): void {
  const s = w.state, tick = s.tick, r = s.rng.world, L = loos(w);
  if (!L.length) return;
  // The ordinary run of it: now and then somebody who's been drinking has to go.
  if (tick % (60 * 25) === 0) {
    const drinkers = Object.values(s.actors).filter((a) => a.npc?.act === "drink" && !a.npc.need && free(w, a) && L.some((l) => dist(l, a) < 30));
    if (drinkers.length) urge(w, pick(r, drinkers), rndRange(r, 2, 12));
  }
  for (const l of L) { l.users = l.users.filter((id) => s.actors[id]?.npc?.need?.loo === l.id && s.actors[id].npc!.need!.stage === 2); l.queue = l.queue.filter((id) => s.actors[id]?.npc?.need?.loo === l.id && s.actors[id].npc!.need!.stage === 1); }
  for (const id in s.actors) {
    const a = s.actors[id], n = a.npc, nd = n?.need;
    if (!n || !nd || nd.at > tick) continue;
    if (a.dead || a.hiddenIn || a.downUntil > tick || n.mode !== "routine") continue;
    if (nd.stage === 0) {
      if (n.duty) continue;
      // The nearest one he can get to: inside the ground it's the gents, outside it's the pub's.
      const inside = VENUE.inside(a.x, a.y);
      const l = L.filter((q) => (q.id === "gents") === inside || L.length === 1).sort((p, q) => dist(p, a) - dist(q, a))[0];
      if (!l) { n.need = undefined; continue; }
      nd.loo = l.id; nd.stage = 1; nd.since = tick; l.queue.push(a.id);
      n.group = undefined; n.drawn = undefined;
      const c = linkCause(w, carried(w, a), `${SUR(a)} HAS TO GO`, a, "need");
      // He only says so if it's your doing (or he's leaving a post): the ordinary run of it happens without comment.
      if (c || n.post) say(w, a, pick(r, ["Back in a minute. Bursting.", "Hold that thought. Need the gents.", "Nature calls."]), 2.5);
      if (n.post && (isSecurity(a) || n.job === "worker")) leavePost(w, a, c, 40); else if (c) carry(a, c, tick, 60);
      n.plan = [{ k: "go", x: l.qx, y: l.qy }, { k: "wait", s: 40 }];
      continue;
    }
    const l = L.find((q) => q.id === nd.loo);
    if (!l) { n.need = undefined; continue; }
    if (nd.stage === 1) {
      const k = l.queue.indexOf(a.id);
      // The clock on his bladder only starts once he's got there and found he can't get in.
      if (dist(a, { x: l.qx, y: l.qy }) > 6) { nd.since = tick; if (tick - nd.at > 60 * 60) { n.need = undefined; l.queue = l.queue.filter((q) => q !== a.id); } continue; }
      // In, if there's room and it's open and he's at the front.
      if (!l.shut && l.users.length < l.cap && k === 0 && dist(a, { x: l.qx, y: l.qy }) < 2.2) {
        l.queue.shift(); l.users.push(a.id); nd.stage = 2; nd.since = tick;
        n.plan = [{ k: "go", x: l.x + rndRange(r, -2, 2), y: l.y + rndRange(r, -1, 1) }, { k: "wait", s: 12 }];
        continue;
      }
      // Otherwise he stands in line, and there's only so long anybody can.
      const spot = { x: l.qx + (l.id === "gents" ? -1 : 1) * 0.9 * Math.max(0, k) * (VENUE.id === "sf" ? -1 : 1), y: l.qy + (k % 2) * 0.3 };
      if (!n.goal && dist(a, spot) > 0.8) n.plan = [{ k: "go", x: spot.x, y: spot.y }, { k: "wait", s: 30 }];
      if (l.queue.length === 4 && k === 3) linkCause(w, carried(w, a), l.shut ? "THE GENTS IS SHUT AND THE QUEUE'S GROWING" : "A QUEUE FOR THE GENTS", { x: l.qx, y: l.qy }, "capacity");
      if (tick - nd.since > 60 * (l.shut ? 14 : 32)) {
        // He can't wait. Up the nearest wall it goes, and that's somebody's to mop.
        l.queue = l.queue.filter((q) => q !== a.id);
        say(w, a, pick(r, ["Can't wait. Sorry. CAN'T WAIT.", "Look away, lads.", "It's this or my trousers."]), 3);
        const at = { x: a.x + rndRange(r, -1.5, 1.5), y: a.y + 1.2 };
        n.plan = [{ k: "go", x: at.x, y: at.y }, { k: "wait", s: 5 }, ...(n.post ? [{ k: "go" as const, ...n.post }] : [])];
        const c = linkCause(w, carried(w, a), `${SUR(a)} CAN'T WAIT`, at, "capacity");
        problem(w, "mess", at, { cause: c, fixSecs: 8, line: "Oh, for... Mop! MOP!" });
        w.bus.emit({ type: "spew", t: tick, who: a.id, x: at.x, y: at.y, wee: true });
        n.need = undefined;
      }
      continue;
    }
    // Done. Back to wherever he was.
    if (tick - nd.since > 60 * 13) { n.need = undefined; n.plan = n.post ? [{ k: "go", ...n.post }] : []; }
  }
}

// ---------------------------------------------------------------- authority and recognition

/** Where somebody stands: 0 the public, 1 a steward, 2 the police and the chief. */
const rank = (a: Actor) => (!a.npc ? 0 : a.npc.job === "police" || a.npc.job === "chief" || a.npc.job === "armed" ? 2 : isSecurity(a) ? 1 : 0);

export function installSocial(): void {
  // Tell somebody what to do. He does it if you outrank him (by what you're wearing) and he's no reason to doubt you.
  registerVerb("order", {
    check: (w, act, actor) => {
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      if (!t?.npc || t.fb || t.off || t.npc.shop) return "nobody to tell";
      if (dist(t, actor) > 3.2) return "too far";
      if (appearance(w.state, actor).authority <= rank(t)) return "he'd not take that from you";
      if (!free(w, t) || t.npc.duty) return "he's busy";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, tick = s.tick, r = s.rng.world, t = s.actors[(act.target as { id: Id }).id], n = t.npc!;
      // He knows you, or you look wrong: no.
      if (grudge(t, actor.id) >= 1 || (n.sus[actor.id] ?? 0) > 0.5 || appearance(s, actor).alarming) {
        say(w, t, pick(r, ["Hang on. Who are you, exactly?", "I know you. You're not staff.", "Let's see some ID, pal."]), 3);
        if (isSecurity(t)) n.sus[actor.id] = Math.min(1.2, (n.sus[actor.id] ?? 0) + 0.4);
        return;
      }
      const c = rootCause(w, rank(t) ? `GROZZ SENDS ${SUR(t)} ON AN ERRAND` : "GROZZ MOVES THEM ALONG", t, "authority");
      if (rank(t)) {
        // Staff: sent to see the boss, who never sent for him. He'll be a while, and he'll work it out.
        const boss = VENUE.inside(t.x, t.y) ? SPOTS.chiefDesk : SPOTS.cabinDoor;
        say(w, t, pick(r, ["Now? ...Right. On my way.", "What's he want this time?", "Cover for me, then."]), 2.5);
        n.plan = [{ k: "go", x: boss.x + 1, y: boss.y + 1.4 }, { k: "wait", s: 10 }, { k: "say", text: "Nobody sent for me. ...Who WAS that?" }, ...(n.post ? [{ k: "go" as const, ...n.post }] : [])];
        leavePost(w, t, c, 50);
        n.ordered = { by: actor.id, at: tick + 60 * 45 };
      } else {
        // The public: they move along, him and whoever's stood with him.
        const lot = Object.values(s.actors).filter((a) => a.npc && rank(a) === 0 && !a.npc.shop && !a.fb && !a.off && a.npc.job !== "dog" && free(w, a) && dist(a, t) < 4.5).slice(0, 6);
        say(w, t, pick(r, ["Alright, alright, we're going.", "We weren't doing owt.", "Jobsworth."]), 2.5);
        for (const a of lot) {
          const ang = Math.atan2(a.y - actor.y, a.x - actor.x) + rndRange(r, -0.4, 0.4);
          a.npc!.group = undefined;
          a.npc!.plan = [{ k: "go", x: a.x + Math.cos(ang) * 14, y: a.y + Math.sin(ang) * 14 }, { k: "wait", s: 18 }];
          carry(a, c, tick, 30);
        }
        linkCause(w, c, `${lot.length} OF THEM SHIFT`, t, "authority");
      }
      w.bus.emit({ type: "ordered", t: tick, by: actor.id, who: t.id });
    },
  });
  // Hand in something that's somebody's. Officially you found it; its owner has to go to the cabin for it.
  registerVerb("handin", {
    check: (w, act, actor) => {
      const s = w.state, t = act.target?.k === "actor" ? s.actors[act.target.id] : undefined, it = actor.hand ? s.items[actor.hand] : undefined;
      if (!t?.npc || !isSecurity(t) || dist(t, actor) > 3) return "nobody to hand it to";
      if (!it?.owner || !s.actors[it.owner]?.npc || it.owner === t.id) return "nothing to hand in";
      if (!free(w, t)) return "he's busy";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, tick = s.tick, t = s.actors[(act.target as { id: Id }).id], it = s.items[actor.hand!], owner = s.actors[it.owner!];
      const name = (it.label ?? defOf(it).name).toLowerCase().replace(/^(the|a|an) /, "").replace(/^.*'s /, "");
      const at = { x: SPOTS.cabinHook.x + (SPOTS.cabinHook.x > 0 ? -1.4 : 1.4), y: SPOTS.cabinHook.y + 1.2 };
      moveItem(s, it.id, { k: "ground", ...at });
      it.movedBy = undefined; it.stolenFrom = undefined;
      const c = rootCause(w, `GROZZ HANDS IN ${owner.name.split(" ").pop()!.toUpperCase()}'S ${name.toUpperCase()}`, t, "recognition");
      it.cause = c; it.causeAt = tick;
      say(w, t, pick(s.rng.world, ["Good lad. It'll be at the cabin. Wish there were more like you.", "Honest of you. I'll radio it in.", "Lost property. Cabin. I'll let him know."]), 3.5);
      // On the record, he's one of the good ones: whoever's near thinks better of him, and forgets what they had.
      for (const g of Object.values(s.actors)) if (g.npc && isSecurity(g) && dist(g, actor) < 12) { g.npc.sus[actor.id] = 0; if (g.npc.grudge) delete g.npc.grudge[actor.id]; }
      s.stadium!.flags.goodCitizen = tick + 60 * 120;
      linkCause(w, c, "ON THE RECORD: A MODEL SUPPORTER", t, "recognition");
      // And the owner's told where it is. It's a long way to the cabin.
      if (free(w, owner)) problem(w, "displaced", at, { owner: owner.id, item: it.id, cause: c });
      w.bus.emit({ type: "handed_in", t: tick, by: actor.id, to: t.id, item: it.id });
    },
  });
  // The sign on the door of the gents.
  registerVerb("loosign", {
    check: (w, _act, actor) => (looNear(w, actor) ? null : "nothing to do"),
    perform: (w, _act, actor) => {
      const l = looNear(w, actor)!;
      l.shut = !l.shut;
      if (l.shut) rootCause(w, "GROZZ HANGS UP 'OUT OF ORDER'", { x: l.qx, y: l.qy }, "capacity");
      w.bus.emit({ type: "loo_sign", t: w.state.tick, by: actor.id, loo: l.id, shut: l.shut, x: l.qx, y: l.qy });
    },
  });
}

export function installSocialWatch(w: World): void {
  w.bus.on((e: any) => {
    const s = w.state, st = s.stadium;
    if (!st) return;
    // Give a man a pint and he drinks it (a copper pours it away). Then he needs the gents: sooner, if it was off.
    if (e.type === "action" && e.action?.verb === "give" && e.action.target?.k === "actor") {
      const t = s.actors[e.action.target.id], it = e.action.item ? s.items[e.action.item] : undefined;
      if (!t?.npc || !it || (it.def !== "pint" && it.def !== "pie") || t.fb || t.off) return;
      const by = s.actors[e.action.actor], foul = !!it.spiked;
      moveItem(s, it.id, { k: "gone" });
      if (t.npc.job === "police") { say(w, t, "On duty, sir. I'll dispose of that.", 3); return; }
      say(w, t, it.def === "pie" ? "Ooh. Ta very much." : isSecurity(t) ? "Go on, then. Don't tell the chief." : "Cheers, big man.", 2.5);
      if (by?.id === st.pc && t.npc.grudge?.[by.id]) t.npc.grudge[by.id] = Math.max(0, t.npc.grudge[by.id] - 1);
      if (it.def === "pint" || foul) {
        const c = by?.id === st.pc ? rootCause(w, `${SUR(t)} GETS A ${foul ? "FUNNY-TASTING " : ""}${it.def === "pie" ? "PIE" : "PINT"} OFF GROZZ`, t, "need") : 0;
        urge(w, t, foul ? rndRange(s.rng.world, 6, 10) : rndRange(s.rng.world, 28, 40), c);
      }
    }
    // Things that leave a grudge.
    if (e.type === "took_back") { const a = s.actors[e.by], b = s.actors[e.from]; if (a && b) grieve(w, a, b, 1, carried(w, a)); }
    if (e.type === "pawn_back") { const shop = Object.values(s.actors).find((a) => a.npc?.shop === "pawn"); const pc = s.actors[st.pc]; if (shop && pc) grieve(w, shop, pc, 1); }
    if (e.type === "bowled" && e.by === st.pc) { const v = s.actors[e.who], pc = s.actors[st.pc]; if (v?.npc && pc && dist(v, pc) < 7 && chance(s.rng.world, 0.6)) grieve(w, v, pc, 1); }
  });
}

export function stepSocial(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (tick % 30 !== 0) return;
  stepNeeds(w);
  if (tick % 60 === 0) stepGrievance(w);
  // The one sent on an errand has worked out who sent him.
  if (tick % 60 === 0) for (const id in s.actors) {
    const a = s.actors[id], o = a.npc?.ordered;
    if (!o || tick < o.at) continue;
    a.npc!.ordered = undefined;
    const by = s.actors[o.by];
    if (by) { grieve(w, a, by, 1.5); a.npc!.sus[by.id] = Math.max(a.npc!.sus[by.id] ?? 0, 0.6); }
  }
  void st;
}

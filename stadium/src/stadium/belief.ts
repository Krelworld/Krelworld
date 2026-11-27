// Belief: what people think is true, which needn't be. Tell one person something, or write it where it
// will be read, and it goes from mouth to mouth, losing detail as it goes; whoever it concerns acts on
// it. Stewards who hear their pay's been cut go and moan about it. Fans who hear there's free beer go and
// find there isn't, and come back wanting a word with whoever said so. A reporter told their No.10's
// crocked goes to stand outside their hotel.
// It's a process like any other: it has a source, it carries the cause that started it, and it can come
// back round to Grozz.
import type { World } from "../core/world";
import type { Actor, Id } from "../core/types";
import { registerVerb } from "../core/verbs";
import { chance, pick } from "../core/rng";
import { SPOTS, VENUE } from "./layout";
import { isSecurity } from "./security";
import { say } from "./npc";
import { carry, linkCause, rootCause } from "./cause";
import { free, leavePost, stim } from "./machine";

export type RumourKind = "freebie" | "paycut" | "injury";
export interface Rumour {
  id: number; kind: RumourKind; x: number; y: number; cause: number; born: number;
  /** Who's heard it, and at how many removes; who's done something about it; who Grozz told. */
  holders: Record<Id, number>; acted: Id[]; source?: Id;
  /** How many each has told (nobody tells everyone). */
  told?: Record<Id, number>;
  /** Found out to be rubbish (by whom), and whether Grozz has been pointed out for it. */
  bust?: number; blamed?: boolean;
}

const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const SUR = (a: Actor) => (a.name.split(" ").pop() ?? "").toUpperCase();

/** What you can tell people, how it's said at each remove, and where it sends them. */
export const RUMOURS: Record<RumourKind, { tell: string; says: string[]; at: () => { x: number; y: number }; who: (a: Actor) => boolean }> = {
  freebie: { tell: "Free pints at the Three Lions", says: ["Free pints at the Three Lions! Landlord's had a win!", "Free pints at the pub, apparently.", "Summat's free at the pub.", "Summat's free somewhere."], at: () => ({ x: SPOTS.pubBar.x, y: SPOTS.pubBar.y + 1.6 }), who: (a) => a.npc!.job === "fan" || a.npc!.job === "local" },
  paycut: { tell: "The stewards are getting a pay cut", says: ["They're cutting the stewards' pay. Today.", "Stewards are getting their pay cut.", "Summat about the stewards' pay.", "Summat about pay."], at: () => ({ x: mx(-9.5), y: 59.2 }), who: (a) => isSecurity(a) && a.npc!.job !== "police" && a.npc!.job !== "chief" && a.npc!.job !== "armed" },
  injury: { tell: "Their No.10's done his hamstring at the hotel", says: ["Their No.10's done his hamstring. At the hotel.", "Their No.10's crocked, they reckon.", "One of theirs is injured.", "Someone's injured."], at: () => ({ x: SPOTS.busPark.x - 4, y: SPOTS.busPark.y + 5 }), who: (a) => a.npc!.job === "press" },
};

const list = (w: World): Rumour[] => (w.state.stadium!.rumours ??= []);

/** Start one. `from` is who Grozz told (nobody, if he wrote it up). */
export function startRumour(w: World, kind: RumourKind, at: { x: number; y: number }, cause: number, from?: Actor): Rumour {
  const st = w.state.stadium!;
  const r: Rumour = { id: (st.machineSeq = (st.machineSeq ?? 0) + 1), kind, x: RUMOURS[kind].at().x, y: RUMOURS[kind].at().y, cause, born: w.state.tick, holders: {}, acted: [], source: from?.id };
  if (kind === "paycut") { r.x = at.x; r.y = at.y; }
  list(w).push(r);
  if (from) hear(w, r, from, 0);
  return r;
}

/** Someone hears it. If it's his business, he does something about it. */
export function hear(w: World, r: Rumour, a: Actor, hops: number): void {
  const s = w.state, n = a.npc;
  if (!n || r.holders[a.id] !== undefined) return;
  r.holders[a.id] = hops;
  (n.heardR ??= []).push(r.id);
  carry(a, r.cause, s.tick, 30);
  const heard = Object.keys(r.holders).length;
  if (heard === 3) r.cause = linkCause(w, r.cause, "IT'S GOING ROUND", a, "belief") || r.cause;
  if (heard === 8) r.cause = linkCause(w, r.cause, "EVERYBODY'S HEARD IT", a, "belief") || r.cause;
  if (r.bust || !RUMOURS[r.kind].who(a) || !free(w, a) || n.duty || n.drawn) return;
  const cap = r.kind === "paycut" ? 3 : r.kind === "injury" ? 2 : 9;
  if (r.acted.length >= cap) return;
  const k = r.acted.push(a.id) - 1, rng = s.rng.world;
  if (r.kind === "paycut") {
    n.plan = [{ k: "go", x: r.x + (k - 1) * 1.1, y: r.y + 0.6 }, { k: "say", text: pick(rng, k ? ["Six quid an hour and they CUT it?", "I'm not standing in the rain for this.", "Who told you? ...Typical."] : ["PAY CUT?! Nobody told me!", "Right. That's it. I'm ringing the union."]) }, { k: "wait", s: 22 }, ...(n.post ? [{ k: "go" as const, ...n.post }] : [])];
    const c = linkCause(w, r.cause, k ? (k === 1 ? "ANOTHER ONE COMES TO MOAN" : "HALF THE STEWARDS ARE AT IT") : `${SUR(a)} STOPS WORK TO MOAN`, a, "belief") || r.cause;
    leavePost(w, a, c, 30, "angry");
  } else if (r.kind === "freebie") {
    n.group = undefined;
    n.plan = [{ k: "go", x: r.x + ((k % 5) - 2) * 0.9, y: r.y + Math.floor(k / 5) * 0.9, run: true }, { k: "wait", s: 7 }];
    const c = k === 0 ? linkCause(w, r.cause, "FANS HEAD FOR THE FREE PINTS", a, "belief") || r.cause : r.cause;
    if (k === 2) stim(w, "spectacle", { x: r.x, y: r.y }, { r: 30, secs: 20, cause: c, cap: 2 });
    carry(a, c, s.tick, 60);
    // Nobody keeps free beer to himself: he shouts it to whoever's stood by him as he goes.
    if (hops < 3) {
      if (!n.bubble) say(w, a, RUMOURS.freebie.says[Math.min(3, hops)], 2.6);
      const mates = Object.values(s.actors).filter((b) => b.npc && b !== a && r.holders[b.id] === undefined && free(w, b) && !b.fb && !b.off && b.npc.job !== "dog" && dist(a, b) < 4.5).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 2);
      (r.told ??= {})[a.id] = 2;
      for (const b of mates) hear(w, r, b, hops + 1);
    }
  } else {
    n.plan = [{ k: "go", x: r.x + k * 1.3, y: r.y, run: true }, { k: "say", text: k ? "Rolling." : "We're live outside the team hotel, where the news is grim." }, { k: "wait", s: 35 }, ...(n.post ? [{ k: "go" as const, ...n.post }] : [])];
    const c = linkCause(w, r.cause, k ? "THE CAMERA GOES WITH HIM" : "THE REPORTER RUNS TO THE HOTEL", a, "belief") || r.cause;
    leavePost(w, a, c, 45);
  }
}

export function installBelief(): void {
  registerVerb("rumour", {
    check: (w, act, actor) => {
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      if (!t?.npc || !RUMOURS[act.arg as RumourKind]) return "nobody to tell";
      if (dist(t, actor) > 3) return "too far";
      if (!free(w, t)) return "he's not listening";
      if (list(w).some((r) => r.kind === act.arg && w.state.tick - r.born < 60 * 120)) return "you've said that already";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, t = s.actors[(act.target as { id: Id }).id], kind = act.arg as RumourKind;
      const c = rootCause(w, kind === "freebie" ? "GROZZ INVENTS FREE PINTS" : kind === "paycut" ? "GROZZ INVENTS A PAY CUT" : "GROZZ INVENTS AN INJURY", actor, "belief");
      say(w, t, pick(s.rng.world, ["Never! ...Really?", "You what? Who told you?", "Get away. Seriously?"]), 2.5);
      startRumour(w, kind, t, c, t);
      w.bus.emit({ type: "rumour", t: s.tick, by: actor.id, kind, to: t.id });
    },
  });
}

export function stepBelief(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, rng = s.rng.world;
  if (!st.rumours?.length || tick % 45 !== 0) return;
  const pc = s.actors[st.pc];
  for (const r of st.rumours) {
    const age = (tick - r.born) / 60;
    if (age > 150) continue;
    // Mouth to mouth: each holder may pass it to someone stood near, a remove further on.
    for (const id of Object.keys(r.holders)) {
      const a = s.actors[id], hops = r.holders[id];
      if (hops >= 3 || ((r.told ??= {})[id] ?? 0) >= 2 || !a?.npc || a.dead || a.hiddenIn || a.downUntil > tick || !chance(rng, r.bust ? 0.1 : 0.3)) continue;
      const to = Object.values(s.actors).find((b) => b.npc && b !== a && r.holders[b.id] === undefined && !b.dead && !b.hiddenIn && !b.fb && !b.off && b.npc.job !== "dog" && b.downUntil <= tick && dist(a, b) < 3.2
        && (r.kind !== "injury" || b.npc.job === "press" || b.npc.job === "fan"));
      if (!to) continue;
      if (!a.npc.bubble) say(w, a, RUMOURS[r.kind].says[Math.min(3, hops + 1)], 2.6);
      r.told![id] = (r.told![id] ?? 0) + 1;
      hear(w, r, to, hops + 1);
    }
    // The written-up kind is read by whoever it concerns nearby.
    if (r.kind === "paycut" && !r.source && r.acted.length < 2 && age > 2) {
      const g = Object.values(s.actors).filter((a) => a.npc && r.holders[a.id] === undefined && RUMOURS.paycut.who(a) && free(w, a) && dist(a, r) < 26)
        .sort((p, q) => (p.npc!.job === "turnstile" ? 0 : 1) - (q.npc!.job === "turnstile" ? 0 : 1) || dist(p, r) - dist(q, r))[r.acted.length === 0 ? 0 : 1];
      if (g) hear(w, r, g, 0);
    }
    // Free pints: the first ones there find out, and take it back with them.
    if (r.kind === "freebie" && !r.bust) {
      const there = r.acted.map((id) => s.actors[id]).find((a) => a && !a.dead && dist(a, r) < 3.5 && a.npc!.plan[0]?.k === "wait");
      if (there && age > 6) {
        r.bust = tick;
        say(w, there, pick(rng, ["There's no free pints!", "Six quid a pint, same as ever!", "Who said free? WHO SAID FREE?"]), 3);
        r.cause = linkCause(w, r.cause, "THERE ARE NO FREE PINTS", there, "belief") || r.cause;
        for (const id of r.acted) { const a = s.actors[id]; if (a?.npc && free(w, a)) { a.npc.why = "angry"; a.npc.whyUntil = tick + 60 * 20; } }
      }
    }
    // It comes home: the one Grozz told points him out, if Grozz is daft enough to be stood there.
    if (r.bust && !r.blamed && r.source && tick - r.bust > 60 * 5 && pc) {
      const src = s.actors[r.source];
      if (src?.npc && free(w, src) && dist(src, pc) < 9 && !pc.hiddenIn) {
        r.blamed = true;
        say(w, src, pick(rng, ["It was HIM. The fat one. He told me.", "Him! That's the lying sod there!"]), 3.5);
        r.cause = linkCause(w, r.cause, `${SUR(src)} POINTS AT GROZZ`, src, "belief") || r.cause;
        const mob = r.acted.map((id) => s.actors[id]).filter((a) => a?.npc && free(w, a) && dist(a, pc) < 14).slice(0, 2);
        for (const a of mob) { a.npc!.retaliateAt = tick + 45; a.npc!.retaliateOn = pc.id; }
        for (const g of Object.values(s.actors)) if (g.npc && isSecurity(g) && free(w, g) && dist(g, pc) < 12) g.npc.sus[pc.id] = Math.min(1, (g.npc.sus[pc.id] ?? 0) + 0.3);
      }
    }
  }
}

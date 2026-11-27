// Contraptions on the forecourt (Rube Goldberg, Hitman's set pieces, the Goose's one-tap mischief):
// things that are already there, each one tap away, each setting off the next. Every one ends with
// somebody leaving his post (the one rule the kegs teach) and each can knock on into another:
//   pigeons by the queue -> they go up over it -> a fan ducks into the end barrier -> the barriers go
//     over like dominoes -> the turnstile steward comes out to pick them up -> his turnstile left free;
//   the burger van's gas, turned right up -> WHOOMPH -> the pigeons by the police van go up -> one
//     craps on a copper -> he goes off for a napkin -> the van's left open; and the smell of free
//     burnt burgers brings Clive off the staff door;
//   the newsboard: chalk up a stewards' pay cut -> the nearest two come over to read it and moan.
// They come back after a while (the pigeons land again, the barriers get stood up). Game and tests alike.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import { pick } from "../core/rng";
import { SPOTS, TURNSTILES, VENUE } from "./layout";
import { isSecurity } from "./security";
import { say } from "./npc";
import { chainLink, chainStart, knockOn } from "./kegs";

export type RigId = "pigeons_w" | "barriers" | "pigeons_e" | "burger" | "board";
export interface RigState { ready: number; step: number; next: number; by?: string; who?: string[] }

const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
const BARRIERS = [-9, -3, 3, 9];

export const RIGS: Record<RigId, { label: string; r: number; at: () => { x: number; y: number }; cool: number }> = {
  pigeons_w: { label: "Boot the pigeons", r: 2.6, at: () => ({ x: mx(-15), y: 55.5 }), cool: 80 },
  barriers: { label: "Shove the crowd barrier over", r: 2.2, at: () => ({ x: mx(-9), y: 50.9 }), cool: 70 },
  pigeons_e: { label: "Boot the pigeons", r: 2.6, at: () => ({ x: mx(34), y: 58.2 }), cool: 80 },
  burger: { label: "Turn the burger van's gas right up", r: 2.6, at: () => ({ x: mx(46), y: 54.2 }), cool: 120 },
  board: { label: "Chalk \"STEWARDS' PAY CUT\" on the board", r: 2.2, at: () => ({ x: mx(-9.5), y: 59.2 }), cool: 150 },
};
export const RIG_IDS = Object.keys(RIGS) as RigId[];

const rigs = (w: World) => (w.state.stadium!.rigs ??= {}) as Record<string, RigState>;
export const rigReady = (w: World, id: RigId): boolean => (rigs(w)[id]?.ready ?? 0) <= w.state.tick && !(rigs(w)[id]?.step > 0);
/** The contraption within reach of someone, if any is ready. */
export function rigNear(w: World, a: Actor): RigId | undefined {
  if (VENUE.id === "final" || !w.state.stadium) return undefined;
  return RIG_IDS.find((id) => rigReady(w, id) && Math.hypot(RIGS[id].at().x - a.x, RIGS[id].at().y - a.y) < RIGS[id].r);
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const free = (w: World, a: Actor) => !!a.npc && !a.dead && !a.hiddenIn && a.downUntil <= w.state.tick && a.npc.mode === "routine";
const people = (w: World, at: { x: number; y: number }, r: number, f: (a: Actor) => boolean = () => true) =>
  Object.values(w.state.actors).filter((a) => free(w, a) && !a.fb && !a.off && a.npc!.job !== "dog" && dist(a, at) < r && f(a)).sort((p, q) => dist(p, at) - dist(q, at));
const surname = (a: Actor) => (a.name.split(" ").pop() ?? "").toUpperCase();

/** Start one: by Grozz (a new chain), or knocked on from another (a link in the one running). */
function fire(w: World, id: RigId, by: string, first?: string, direct = false): void {
  const r = (rigs(w)[id] ??= { ready: 0, step: 0, next: 0 });
  r.step = 1; r.next = w.state.tick; r.by = by; r.who = [];
  r.ready = w.state.tick + 60 * RIGS[id].cool;
  const at = RIGS[id].at();
  if (first) { if (direct) chainStart(w, by, first, at); else chainLink(w, first, at); }
}

export function installRigs(): void {
  registerVerb("rig", {
    check: (w, act, actor) => {
      const id = act.arg as RigId;
      if (!RIGS[id]) return "nothing to do";
      if (!rigReady(w, id)) return "not now";
      if (dist(RIGS[id].at(), actor) > RIGS[id].r + 0.4) return "too far";
      return null;
    },
    perform: (w, act, actor) => {
      const id = act.arg as RigId;
      const first = { pigeons_w: "GROZZ BOOTS THE PIGEONS", pigeons_e: "GROZZ BOOTS THE PIGEONS", barriers: "GROZZ SHOVES A BARRIER", burger: "GROZZ TURNS THE GAS RIGHT UP", board: "GROZZ CHALKS UP A PAY CUT" }[id];
      fire(w, id, actor.id, first, true);
      w.bus.emit({ type: "rigged", t: w.state.tick, by: actor.id, rig: id, ...RIGS[id].at() });
    },
  });
}

/** Someone leaves his post to deal with it, and comes back after. */
function offPost(w: World, a: Actor, to: { x: number; y: number }, secs: number, line: string, first: string, ...links: string[]): void {
  const n = a.npc!, back = n.post ?? { x: a.x, y: a.y };
  n.plan = [{ k: "go", x: to.x, y: to.y }, { k: "say", text: line }, { k: "wait", s: secs }, { k: "go", ...back }];
  knockOn(w, a, "search", secs + 8, first, ...links);
  // A turnstile left unmanned: it's on free-wheel for Grozz until he's back.
  if (n.job === "turnstile") {
    const i = SPOTS.turnstiles.map((t, k) => ({ k, d: dist(t, back) })).sort((p, q) => p.d - q.d)[0]?.k ?? 0;
    w.state.stadium!.gates[TURNSTILES[i]] = { until: w.state.tick + 60 * (secs + 6), for: w.state.stadium!.pc };
    chainLink(w, "HIS TURNSTILE LEFT ON FREE-WHEEL", back);
  }
  if (n.job === "doorguard") {
    w.state.stadium!.gates.staffdoor = { until: w.state.tick + 60 * (secs + 6), for: null };
    chainLink(w, "STAFF DOOR LEFT PROPPED OPEN", back);
  }
}

function flinch(w: World, at: { x: number; y: number }, r: number, n: number): Actor[] {
  const out = people(w, at, r).slice(0, n);
  for (const a of out) w.bus.emit({ type: "flinch", t: w.state.tick, who: a.id, x: at.x, y: at.y });
  return out;
}

export function stepRigs(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!st.rigs) return;
  for (const id of RIG_IDS) {
    const r = st.rigs[id];
    if (!r || r.step <= 0 || tick < r.next) continue;
    const at = RIGS[id].at(), step = r.step;
    const next = (secs: number) => { r.step = step + 1; r.next = tick + Math.round(60 * secs); };
    const done = () => { r.step = 0; };
    const emit = (extra: Record<string, unknown> = {}) => w.bus.emit({ type: "rig", t: tick, rig: id, step, ...at, ...extra });
    switch (id) {
      case "pigeons_w":
      case "pigeons_e": {
        const to = id === "pigeons_w" ? { x: mx(-6), y: 49.5 } : { x: SPOTS.policeVan.x, y: SPOTS.policeVan.y };
        if (step === 1) { emit({ to }); flinch(w, at, 5, 3); next(1.3); break; }
        if (step === 2) {
          emit({ to, land: true });
          if (id === "pigeons_w") {
            chainLink(w, "THEY GO UP OVER THE QUEUE", to);
            const ducker = flinch(w, to, 6, 4)[0];
            if (ducker) say(w, ducker, pick(s.rng.world, ["Rats with wings!", "Get 'em off me!", "AAAH! In me hair!"]), 2.5);
            if (rigReady(w, "barriers")) fire(w, "barriers", r.by!, ducker ? `${surname(ducker)} DUCKS INTO THE BARRIER` : "SOMEONE DUCKS INTO THE BARRIER");
          } else {
            // One of them craps on a copper, who goes off to clean himself up.
            const cop = people(w, to, 16, (a) => a.npc!.job === "police" && !a.npc!.mounted)[0] ?? people(w, to, 12, (a) => isSecurity(a))[0];
            if (cop) {
              offPost(w, cop, { x: mx(46), y: 54.6 }, 20, pick(s.rng.world, ["Napkin. Now. NAPKIN.", "It's in me collar. It's IN ME COLLAR."]),
                `ONE CRAPS ON ${cop.npc!.job === "police" ? "A COPPER" : "A STEWARD"}`, "HE GOES OFF FOR A NAPKIN", ...(dist(cop, SPOTS.policeVan) < 16 ? ["THE POLICE VAN LEFT UNWATCHED"] : []));
              say(w, cop, pick(s.rng.world, ["Oh, you are JOKING me.", "On me hat. ON ME HAT.", "That's assaulting a police officer, that."]), 3);
            } else chainLink(w, "THEY GO UP OVER THE VANS", to);
          }
          done(); break;
        }
        break;
      }
      case "barriers": {
        // Over they go, one after another, along the queue.
        if (step <= BARRIERS.length) {
          const bx = mx(BARRIERS[step - 1]), b = { x: bx, y: 50.6 };
          emit({ i: step - 1, x: bx, y: 50.6 });
          flinch(w, b, 2.5, 2);
          for (const a of people(w, b, 1.1)) { a.downUntil = tick + 80; w.bus.emit({ type: "bowled", t: tick, who: a.id, by: r.by, x: a.x, y: a.y }); }
          chainLink(w, ["THE BARRIER GOES OVER", "AND THE NEXT", "AND THE NEXT ONE", "AND THE LAST ONE, CLANG"][step - 1], b);
          next(0.45); break;
        }
        // The middle turnstile's man comes out to stand them back up.
        const mid = { x: 0, y: 51.6 };
        const g = people(w, mid, 14, (a) => a.npc!.job === "turnstile").sort((p, q) => Math.abs(p.x) - Math.abs(q.x))[0] ?? people(w, mid, 16, (a) => isSecurity(a) && a.npc!.job !== "police")[0];
        if (g) offPost(w, g, mid, 18, pick(s.rng.world, ["Who did that?! Right, give us a hand.", "Every bloody match. Lift your end.", "Health and safety, this. Health and SAFETY."]), "THE STEWARD COMES OUT TO PICK THEM UP");
        r.step = -1; r.next = tick + 60 * 40; // they're stood back up later
        break;
      }
      case "burger": {
        if (step === 1) { emit({ hiss: true }); next(2); break; }
        if (step === 2) {
          emit({ boom: true });
          chainLink(w, "WHOOMPH", at);
          const pc = s.actors[st.pc];
          for (const a of people(w, at, 2.4)) { a.downUntil = tick + 90; w.bus.emit({ type: "bowled", t: tick, who: a.id, by: r.by, x: a.x, y: a.y }); }
          flinch(w, at, 9, 5);
          // Too close and Grozz goes over too (no eyebrows, mind).
          if (pc && dist(pc, at) < 2.8 && !pc.heldBy) { pc.effects.singed = tick + 60 * 20; pc.downUntil = tick + 50; pc.vx = pc.vy = 0; }
          if (rigReady(w, "pigeons_e")) fire(w, "pigeons_e", r.by!, "THE PIGEONS GO UP");
          next(3); break;
        }
        if (step === 3) {
          // Free (burnt) burgers: the smell brings the staff door's man off his door.
          const clive = people(w, at, 24, (a) => a.npc!.job === "doorguard")[0] ?? people(w, at, 14, (a) => a.npc!.job === "fan")[0];
          if (clive) offPost(w, clive, { x: at.x + 1.2, y: at.y + 0.8 }, 22, pick(s.rng.world, ["Is that free? It's free if it's on fire.", "Bit well done. I'll have two.", "Smells like my nan's house. Lovely."]), "THE SMELL OF BURNT ONIONS", `${surname(clive)} WANDERS OVER FOR ONE`);
          done(); break;
        }
        break;
      }
      case "board": {
        if (step === 1) { emit({ chalk: true }); next(2.5); break; }
        // The two nearest come over to read it, and have a moan (a turnstile man if there's one going).
        const pool = people(w, at, 26, (a) => isSecurity(a) && a.npc!.job !== "police" && a.npc!.job !== "chief");
        const ts = pool.find((a) => a.npc!.job === "turnstile"), other = pool.find((a) => a !== ts);
        const two = [ts, other].filter(Boolean) as Actor[];
        two.forEach((g, k) => offPost(w, g, { x: at.x + (k ? 1.1 : -1.1), y: at.y + 0.6 }, 24, k ? pick(s.rng.world, ["Six quid an hour and they CUT it?", "I'm not standing in the rain for this."]) : pick(s.rng.world, ["PAY CUT?! Nobody told me!", "Right. That's it. I'm ringing the union."]), k ? "ANOTHER ONE COMES TO MOAN" : "A STEWARD STOPS TO READ IT"));
        if (!two.length) chainLink(w, "NOBODY'S READ IT YET", at);
        done(); break;
      }
    }
  }
  // The barriers get stood back up.
  const b = st.rigs.barriers;
  if (b && b.step === -1 && tick >= b.next) { b.step = 0; w.bus.emit({ type: "rig", t: tick, rig: "barriers", step: 0, reset: true, ...RIGS.barriers.at() }); }
}

// Things on the forecourt that go off when you touch them: pigeons, the crowd barriers, the burger van's
// gas, the newsboard. Each is only the first push. What happens next is the machine's business
// (machine.ts, belief.ts): barriers on the floor are a problem that's somebody's to fix, a fireball is a
// spectacle the reporter runs to and a smell the hungry follow, a pay cut on the board is a rumour. So
// they join up with each other and with everything else without being told to.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import { pick } from "../core/rng";
import { SPOTS, VENUE } from "./layout";
import { isSecurity } from "./security";
import { say } from "./npc";
import { linkCause, rootCause } from "./cause";
import { free, leavePost, problem, stim } from "./machine";
import { startRumour } from "./belief";

/** The five here, plus whatever pranks.ts registers. */
export type RigId = string;
export interface RigState { ready: number; step: number; next: number; by?: string; cause?: number;
  /** For the registered ones: how many times it's been done, when it must be over by, a thing it left lying about, a number of its own. */
  n?: number; until?: number; item?: string; v?: number }
/** What a registered one's step is handed: where it's got to, and the usual ways on from there. */
export interface RigCtx {
  id: RigId; r: RigState; at: { x: number; y: number }; step: number; tick: number;
  next: (secs: number) => void; done: () => void;
  /** Wait (at least `min` seconds, at most `max`) for whoever's been given it to put it right; then `undo` runs and it's ready again. */
  hold: (max: number, min?: number) => void;
  emit: (extra?: Record<string, unknown>) => void;
  link: (label: string, where?: { x: number; y: number } | Actor) => number;
}
export interface RigDef {
  label: string; r: number; at: () => { x: number; y: number }; cool: number;
  /** Registered ones only: the headline, whether it's there at all (this build, this ground, right now), a label that changes, its step and its putting-right. */
  first?: string; on?: (w: World) => boolean; says?: (w: World) => string;
  step?: (w: World, c: RigCtx) => void; undo?: (w: World, r: RigState) => void;
}

const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
const BARRIERS = [-9, -3, 3, 9];
const CORE = ["pigeons_w", "barriers", "pigeons_e", "burger", "board"];

export const RIGS: Record<RigId, RigDef> = {
  pigeons_w: { label: "Boot the pigeons", r: 2.6, at: () => ({ x: mx(-15), y: 55.5 }), cool: 80 },
  barriers: { label: "Shove the crowd barrier over", r: 2.2, at: () => ({ x: mx(-9), y: 50.9 }), cool: 70 },
  pigeons_e: { label: "Boot the pigeons", r: 2.6, at: () => ({ x: mx(34), y: 58.2 }), cool: 80 },
  burger: { label: "Turn the burger van's gas right up", r: 2.6, at: () => ({ x: mx(46), y: 54.2 }), cool: 120 },
  board: { label: "Chalk \"STEWARDS' PAY CUT\" on the board", r: 2.2, at: () => ({ x: mx(-9.5), y: 59.2 }), cool: 150 },
};
export const RIG_IDS: RigId[] = Object.keys(RIGS);
const FIRST: Record<RigId, string> = { pigeons_w: "GROZZ BOOTS THE PIGEONS", pigeons_e: "GROZZ BOOTS THE PIGEONS", barriers: "GROZZ SHOVES A BARRIER", burger: "GROZZ TURNS THE GAS RIGHT UP", board: "GROZZ CHALKS UP A PAY CUT" };
/** Add one (pranks.ts): the same verb, the same readiness, the same one tap. */
export function registerRig(id: RigId, def: RigDef): void { if (!RIGS[id]) RIG_IDS.push(id); RIGS[id] = def; }

const rigs = (w: World) => (w.state.stadium!.rigs ??= {}) as Record<string, RigState>;
/** There (in this build, at this ground), not mid-way through, and not too soon after the last time. */
export const rigReady = (w: World, id: RigId): boolean => !!RIGS[id] && (rigs(w)[id]?.ready ?? 0) <= w.state.tick && !rigs(w)[id]?.step && (RIGS[id].on ? RIGS[id].on!(w) : true);
export const rigLabel = (w: World, id: RigId): string => RIGS[id].says?.(w) ?? RIGS[id].label;
/** The one within reach of someone, if any is ready (the nearest, if there are two). */
export function rigNear(w: World, a: Actor): RigId | undefined {
  if (!w.state.stadium) return undefined;
  let best: RigId | undefined, bd = Infinity;
  for (const id of RIG_IDS) {
    if (VENUE.id === "final" && CORE.includes(id)) continue;
    const at = RIGS[id].at(), d = Math.hypot(at.x - a.x, at.y - a.y);
    if (d < RIGS[id].r && d < bd && rigReady(w, id)) { best = id; bd = d; }
  }
  return best;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export const people = (w: World, at: { x: number; y: number }, r: number, f: (a: Actor) => boolean = () => true) =>
  Object.values(w.state.actors).filter((a) => free(w, a) && !a.fb && !a.off && a.npc!.job !== "dog" && dist(a, at) < r && f(a)).sort((p, q) => dist(p, at) - dist(q, at));
const surname = (a: Actor) => (a.name.split(" ").pop() ?? "").toUpperCase();

/** Set one off: by Grozz (a root), or by whatever knocked into it (a child of that). */
function fire(w: World, id: RigId, by: string, cause: number): void {
  const r = (rigs(w)[id] ??= { ready: 0, step: 0, next: 0 });
  r.step = 1; r.next = w.state.tick; r.by = by; r.cause = cause;
  r.ready = w.state.tick + 60 * RIGS[id].cool;
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
      fire(w, id, actor.id, rootCause(w, FIRST[id] ?? RIGS[id].first ?? RIGS[id].label.toUpperCase(), RIGS[id].at()));
      w.bus.emit({ type: "rigged", t: w.state.tick, by: actor.id, rig: id, ...RIGS[id].at() });
    },
  });
}

export function flinch(w: World, at: { x: number; y: number }, r: number, n: number): Actor[] {
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
    const link = (label: string, where: { x: number; y: number } | Actor = at): number => (r.cause = linkCause(w, r.cause, label, where, "physics") || r.cause || 0);
    const def = RIGS[id];
    if (def.step) {
      const hold = (max: number, min = 0) => { r.step = -1; r.next = tick + Math.round(60 * min); r.until = tick + Math.round(60 * max); r.ready = Math.max(r.ready, r.until + 60 * 4); };
      def.step(w, { id, r, at, step, tick, next, done, hold, emit, link });
      continue;
    }
    switch (id) {
      case "pigeons_w":
      case "pigeons_e": {
        const to = id === "pigeons_w" ? { x: mx(-6), y: 49.5 } : { x: SPOTS.policeVan.x, y: SPOTS.policeVan.y };
        if (step === 1) { emit({ to }); flinch(w, at, 5, 3); next(1.3); break; }
        emit({ to, land: true });
        if (id === "pigeons_w") {
          link("THEY GO UP OVER THE QUEUE", to);
          const ducker = flinch(w, to, 6, 4)[0];
          if (ducker) say(w, ducker, pick(s.rng.world, ["Rats with wings!", "Get 'em off me!", "AAAH! In me hair!"]), 2.5);
          if (rigReady(w, "barriers")) fire(w, "barriers", r.by!, link(ducker ? `${surname(ducker)} DUCKS INTO THE BARRIER` : "SOMEONE DUCKS INTO THE BARRIER", ducker ?? to));
        } else {
          // One of them craps on whoever's stood under them: a copper, for preference. He goes to clean himself up.
          const cop = people(w, to, 16, (a) => a.npc!.job === "police" && !a.npc!.mounted)[0] ?? people(w, to, 12, (a) => isSecurity(a))[0];
          if (cop) {
            const c = link(`ONE CRAPS ON ${cop.npc!.job === "police" ? "A COPPER" : "A STEWARD"}`, cop);
            say(w, cop, pick(s.rng.world, ["Oh, you are JOKING me.", "On me hat. ON ME HAT.", "That's assaulting a police officer, that."]), 3);
            cop.npc!.plan = [{ k: "go", x: mx(46), y: 54.6 }, { k: "say", text: pick(s.rng.world, ["Napkin. Now. NAPKIN.", "It's in me collar. It's IN ME COLLAR."]) }, { k: "wait", s: 20 }, ...(cop.npc!.post ? [{ k: "go" as const, ...cop.npc!.post }] : [])];
            leavePost(w, cop, linkCause(w, c, "HE GOES OFF FOR A NAPKIN", cop, "obligation") || c, 28);
          } else link("THEY GO UP OVER THE VANS", to);
        }
        done(); break;
      }
      case "barriers": {
        // Over they go, one after another, along the queue.
        if (step <= BARRIERS.length) {
          const bx = mx(BARRIERS[step - 1]), b = { x: bx, y: 50.6 };
          emit({ i: step - 1, x: bx, y: 50.6 });
          flinch(w, b, 2.5, 2);
          for (const a of people(w, b, 1.1)) { a.downUntil = tick + 80; w.bus.emit({ type: "bowled", t: tick, who: a.id, by: r.by, x: a.x, y: a.y }); }
          link(["THE BARRIER GOES OVER", "AND THE NEXT", "AND THE NEXT ONE", "AND THE LAST ONE, CLANG"][step - 1], b);
          next(0.45); break;
        }
        // Now they're a problem, and a noise: somebody has to stand them up, and people look.
        const mid = { x: 0, y: 51.6 };
        stim(w, "spectacle", mid, { r: 26, secs: 16, cause: r.cause, cap: 2 });
        problem(w, "fallen", mid, { cause: r.cause, fixSecs: 18, key: "barriers", label: "THE STEWARD COMES OUT TO PICK THEM UP", line: pick(s.rng.world, ["Who did that?! Right, give us a hand.", "Every bloody match. Lift your end.", "Health and safety, this. Health and SAFETY."]) });
        r.step = -1; r.next = tick + 60 * 8;
        break;
      }
      case "burger": {
        if (step === 1) { emit({ hiss: true }); next(2); break; }
        if (step === 2) {
          emit({ boom: true });
          link("WHOOMPH");
          const pc = s.actors[st.pc];
          for (const a of people(w, at, 2.4)) { a.downUntil = tick + 90; w.bus.emit({ type: "bowled", t: tick, who: a.id, by: r.by, x: a.x, y: a.y }); }
          flinch(w, at, 9, 5);
          // Too close and Grozz goes over too (no eyebrows, mind).
          if (pc && dist(pc, at) < 2.8 && !pc.heldBy) { pc.effects.singed = tick + 60 * 20; pc.downUntil = tick + 50; pc.vx = pc.vy = 0; }
          if (rigReady(w, "pigeons_e")) fire(w, "pigeons_e", r.by!, link("THE PIGEONS GO UP"));
          // A fireball's worth a look.
          stim(w, "spectacle", at, { r: 48, secs: 28, cause: r.cause, cap: 3 });
          next(3); break;
        }
        // And burnt onions carry. Whoever's hungry follows his nose.
        stim(w, "smell", { x: at.x + 1.2, y: at.y + 0.8 }, { r: 26, secs: 24, cause: link("THE SMELL OF BURNT ONIONS"), cap: 2, what: "burnt burgers" });
        const clive = people(w, at, 26, (a) => a.npc!.job === "doorguard")[0];
        if (clive) say(w, clive, pick(s.rng.world, ["Is that free? It's free if it's on fire.", "Bit well done. I'll have two.", "Smells like my nan's house. Lovely."]), 3.5);
        done(); break;
      }
      case "board": {
        if (step === 1) { emit({ chalk: true }); next(2.5); break; }
        // Written up, it's a rumour like any other: whoever it concerns reads it, and tells the rest.
        startRumour(w, "paycut", at, r.cause ?? 0);
        done(); break;
      }
    }
  }
  // A registered one that's waiting to be put right: once whoever's problem it was has seen to it (or it's been long enough).
  for (const id of RIG_IDS) {
    const r = st.rigs[id], def = RIGS[id];
    if (!r || r.step !== -1 || !def.step) continue;
    if (tick < (r.until ?? 0) && (tick < r.next || st.problems?.some((p) => p.key === id))) continue;
    def.undo?.(w, r);
    r.step = 0;
    w.bus.emit({ type: "rig", t: tick, rig: id, step: 0, reset: true, ...def.at() });
  }
  // The barriers are back up once somebody's seen to them (or, eventually, anyway).
  const b = st.rigs.barriers;
  if (b && b.step === -1 && tick >= b.next && (!st.problems?.some((p) => p.key === "barriers") || tick > b.ready)) { b.step = 0; w.bus.emit({ type: "rig", t: tick, rig: "barriers", step: 0, reset: true, ...RIGS.barriers.at() }); }
}

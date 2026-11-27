// The ball comes to Grozz. When it goes out near him (in the stand, by the touchline) it comes to him,
// and the whole match waits on a fat man: throw it back, hoof it into row Z, or keep it. Players shout
// for it, the ref waves, a steward comes; hoof it or keep it and the touchline steward leaves his post
// (the same rule as the kegs). The ball itself is the engine's; this only borrows it while play is dead.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { canPocket, spawnItem, moveItem } from "../core/items";
import { registerVerb } from "../core/verbs";
import { HL, HW } from "../football/config";
import { chance, pick } from "../core/rng";
import { say } from "./npc";
import { chainLink, knockOn } from "./kegs";

export interface BallOut {
  phase: "fly" | "held" | "back" | "hoof";
  t0: number; t1: number;
  fx: number; fy: number; tx: number; ty: number; h: number;
  team: 0 | 1;
}

const offPitch = (a: Actor) => Math.abs(a.x) > HL + 0.6 || Math.abs(a.y) > HW + 0.6;
const edgeDist = (a: Actor) => Math.max(Math.abs(a.x) - HL, Math.abs(a.y) - HW, 0);
const taker = (w: World) => { const r = w.state.match?.restart; return r?.taker ? w.state.actors[r.taker] : undefined; };
const referee = (w: World) => Object.values(w.state.actors).find((a) => a.off?.job === "referee" && !a.dead && a.downUntil <= w.state.tick);
const fanNear = (w: World, x: number, y: number, r: number, not?: string) =>
  Object.values(w.state.actors).filter((a) => a.npc?.job === "fan" && !a.dead && a.id !== not && Math.hypot(a.x - x, a.y - y) < r)
    .sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0];

/** Who's at the touchline nearest you, and free to come over. */
function touchlineSteward(w: World, pc: Actor): Actor | undefined {
  return Object.values(w.state.actors).filter((a) => a.npc?.job === "pitchsteward" && a.npc.post && a.npc.mode === "routine" && !a.dead && a.downUntil <= w.state.tick)
    .sort((p, q) => Math.hypot(p.x - pc.x, p.y - pc.y) - Math.hypot(q.x - pc.x, q.y - pc.y))[0];
}

function sendSteward(w: World, pc: Actor, line: string, first: string): void {
  const g = touchlineSteward(w, pc);
  if (!g?.npc) return;
  g.npc.plan = [{ k: "go", x: pc.x + 1, y: pc.y + 0.5 }, { k: "say", text: line }, { k: "wait", s: 6 }, { k: "go", ...g.npc.post! }];
  knockOn(w, g, "angry", 25, first, "TOUCHLINE LEFT EMPTY");
}

/** Per game: watch for the ball going out near him. */
export function installBallWatch(w: World): void {
  w.bus.on((e) => {
    if (e.type !== "fb_restart" || !["throw_in", "corner", "goal_kick"].includes(e.restart)) return;
    const s = w.state, st = s.stadium!, m = s.match, pc = s.actors[st.pc];
    if (!m || !pc || pc.dead || pc.fb || pc.heldBy || pc.hiddenIn || pc.roof || pc.off || !st.admitted || st.detainedUntil > s.tick) return;
    if (st.ballOut || s.tick < (st.ballOutCool ?? 0) || !st.lastBall || !offPitch(pc) || edgeDist(pc) > 22) return;
    const from = st.lastBall, d = Math.hypot(from.x - pc.x, from.y - pc.y);
    // Right by you: it's yours. A bit further: a big hoof out of play still finds you, sometimes.
    if (d > 30 || (d > 13 && !chance(s.rng.world, 0.45))) return;
    st.ballOut = { phase: "fly", t0: s.tick, t1: s.tick + 46, fx: from.x, fy: from.y, tx: pc.x, ty: pc.y, h: 2.6, team: e.team };
    st.ballOutCool = s.tick + 60 * 150;
  });
}

/** Once: what he can do with it. */
export function installBallOut(): void {
  const holding = (w: World, a: Actor) => w.state.stadium!.ballOut?.phase === "held" && a.id === w.state.stadium!.pc;
  registerVerb("ballback", {
    check: (w, _act, a) => (holding(w, a) ? null : "no ball"),
    perform: (w, _act, a) => {
      const s = w.state, st = s.stadium!, bo = st.ballOut!, r = s.match!.restart;
      const to = r ? { x: r.x, y: r.y } : { x: Math.sign(a.x) * (HL - 2), y: Math.sign(a.y) * (HW - 2) };
      Object.assign(bo, { phase: "back", t0: s.tick, t1: s.tick + 50, fx: a.x, fy: a.y, tx: to.x, ty: to.y, h: 2.2 });
      const t = taker(w);
      if (t) say(w, t, pick(s.rng.world, ["Cheers, big man.", "Ta, mate.", "Nice one."]), 2);
      // Giving it back to their lot in a hurry: our end aren't having it.
      const f = fanNear(w, a.x, a.y, 9);
      if (f) say(w, f, bo.team === 1 ? pick(s.rng.world, ["What you giving it THEM for?!", "Waste some time, you mug!"]) : "Good lad.", 3);
      w.bus.emit({ type: "ball_back", t: s.tick, by: a.id });
    },
  });
  registerVerb("ballhoof", {
    check: (w, _act, a) => (holding(w, a) ? null : "no ball"),
    perform: (w, _act, a) => {
      const s = w.state, st = s.stadium!, bo = st.ballOut!;
      // Away from the pitch, as far as he can welly it.
      const nx = Math.abs(a.x) - HL > Math.abs(a.y) - HW ? Math.sign(a.x) : 0, ny = nx ? 0 : Math.sign(a.y) || 1;
      const ang = Math.atan2(ny, nx) + (s.rng.world.a % 7 - 3) * 0.08;
      const tx = a.x + Math.cos(ang) * 24, ty = a.y + Math.sin(ang) * 24;
      Object.assign(bo, { phase: "hoof", t0: s.tick, t1: s.tick + 80, fx: a.x, fy: a.y, tx, ty, h: 9 });
      say(w, a, pick(s.rng.world, ["Row Z!", "Have that!", "Fetch!"]), 2);
      const t = taker(w);
      if (t) say(w, t, pick(s.rng.world, ["Oh, you absolute…", "Are you SERIOUS?!", "Ref! REF!"]), 3);
      knockOn(w, undefined, "angry", 0, "THE BALL COMES TO GROZZ", "INTO ROW Z", ...(bo.team === 1 ? ["TIME WASTED"] : []));
      w.bus.emit({ type: "ball_hoofed", t: s.tick, by: a.id });
    },
  });
  registerVerb("ballkeep", {
    check: (w, _act, a) => (holding(w, a) ? null : "no ball"),
    perform: (w, _act, a) => {
      const s = w.state;
      keep(w, a);
      const t = taker(w);
      if (t) say(w, t, pick(s.rng.world, ["Keep it then, you fat ****!", "We've got another, you know!", "Unbelievable."]), 3);
      knockOn(w, undefined, "search", 0, "THE BALL COMES TO GROZZ", "UP HIS JUMPER");
      sendSteward(w, a, "The ball. Hand it over, sunshine.", "STEWARD COMES FOR THE BALL");
    },
  });
}

/** Up his jumper. They get another ball out; it takes a minute. */
function keep(w: World, a: Actor): void {
  const s = w.state, st = s.stadium!, m = s.match!, r = m.restart;
  const it = spawnItem(s, "match_ball", { k: "ground", x: a.x, y: a.y });
  moveItem(s, it.id, !a.hand ? { k: "hand", a: a.id } : canPocket(a, it) ? { k: "pocket", a: a.id } : { k: "ground", x: a.x, y: a.y });
  if (r) { m.ball.x = r.x; m.ball.y = r.y; m.ball.z = 0; r.readyAt = s.tick + 60 * 6; }
  delete st.ballOut;
  w.bus.emit({ type: "ball_kept", t: s.tick, by: a.id });
}

export function stepBallOut(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match, tick = s.tick;
  if (!m) return;
  const b = m.ball;
  if (m.phase === "live") st.lastBall = { x: b.x, y: b.y };
  const bo = st.ballOut;
  if (!bo) return;
  const pc = s.actors[st.pc], r = m.restart;
  // The match moved on without it (a stoppage, half-time): let it go.
  if (!r || m.phase !== "restart" || !pc || pc.dead || pc.heldBy) {
    delete st.ballOut;
    return;
  }
  b.vx = b.vy = b.vz = 0; b.owner = null;
  const k = Math.min(1, (tick - bo.t0) / Math.max(1, bo.t1 - bo.t0));
  const arc = (tx: number, ty: number) => { b.x = bo.fx + (tx - bo.fx) * k; b.y = bo.fy + (ty - bo.fy) * k; b.z = 4 * bo.h * k * (1 - k) + (bo.phase === "fly" ? 1.2 * k : bo.phase === "back" || bo.phase === "hoof" ? 1.2 * (1 - k) : 0); };
  switch (bo.phase) {
    case "fly": {
      arc(pc.x, pc.y);
      r.readyAt = Math.max(r.readyAt, tick + 60);
      if (k >= 1) {
        Object.assign(bo, { phase: "held", t0: tick, t1: tick });
        w.bus.emit({ type: "ball_to_pc", t: tick, by: pc.id, team: bo.team });
        const f = fanNear(w, pc.x, pc.y, 6);
        if (f) say(w, f, pick(s.rng.world, ["Go on, give it a welly!", "Keep it! Keep it!", "Don't you dare give it back!"]), 3);
      }
      break;
    }
    case "held": {
      b.x = pc.x; b.y = pc.y + 0.05; b.z = pc.seated ? 0.9 : 1.2;
      r.readyAt = Math.max(r.readyAt, tick + 60);
      const held = tick - bo.t0, t = taker(w);
      if (held === 80 && t) say(w, t, pick(s.rng.world, ["Ball, mate!", "Over here, big man!", "Chuck it, then!"]), 2);
      if (held === 60 * 6) {
        if (t) say(w, t, pick(s.rng.world, ["Give us the ball, you fat ****!", "Any time today!", "BALL!"]), 3);
        const ref = referee(w);
        if (ref) say(w, ref, "Come on, sir. Ball back, please.", 3);
        chainLink(w, "THE WHOLE MATCH WAITS ON GROZZ");
      }
      // Nobody waits for ever: the ballboy brings another and you've kept the first one.
      if (held >= 60 * 14) {
        keep(w, pc);
        sendSteward(w, pc, "That's the match ball. Hand it over.", "STEWARD COMES FOR THE BALL");
      }
      break;
    }
    case "back": {
      arc(bo.tx, bo.ty);
      if (k >= 1) { r.readyAt = tick + 30; delete st.ballOut; }
      break;
    }
    case "hoof": {
      arc(bo.tx, bo.ty);
      r.readyAt = Math.max(r.readyAt, tick + 60);
      if (k >= 1) {
        // Where it lands, somebody gets it on the head.
        const f = fanNear(w, bo.tx, bo.ty, 2.2);
        if (f) {
          f.downUntil = Math.max(f.downUntil, tick + 90);
          say(w, f, pick(s.rng.world, ["OW! My head!", "Who threw that?!", "Me pint!"]), 3);
          chainLink(w, `BONKS ${f.name.split(" ").pop()!.toUpperCase()}`, f);
        }
        b.z = 0;
        // A ballboy fetches it, or another ball: a good few seconds of nothing.
        r.readyAt = tick + 60 * 7;
        delete st.ballOut;
        sendSteward(w, pc, pick(s.rng.world, ["Any more of that and you're out.", "Do that again and you're going home."]), "STEWARD COMES OVER");
      }
      break;
    }
  }
}

// The walkie-talkie. Every steward carries one. Take it off one you've flattened and you can call it in:
// "I'm in here with a fan who I've had to knock out." Security take a steward's word for it, send two
// lads with a trolley, and help cover it up: the body goes, nobody raises the alarm, and the office
// door is held open for you.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import { findPath } from "./nav";
import { say, spawnStaff } from "./npc";
import { incapacitated } from "./combat";

const RANGE = 12;
const CREW = ["Steward Mick", "Steward Dougie", "Steward Tel", "Steward Carl"];

export const hasRadio = (w: World, a: Actor) => [a.hand, ...a.pockets].some((id) => id && w.state.items[id]?.def === "radio");

/** Bodies (out cold or dead) close enough to call in, not yet reported or covered up. */
export function reportable(w: World, pc: Actor): Actor[] {
  const st = w.state.stadium!;
  return Object.values(w.state.actors).filter((a) => a !== pc && !a.hiddenIn && a.npc?.job !== "dog" && a.npc?.job !== "cleanup" && incapacitated(w, a)
    && !st.coverups?.some((c) => c.body === a.id) && Math.hypot(a.x - pc.x, a.y - pc.y) < RANGE);
}

/** A point some way back along the walk from the body to somewhere public: where the crew appear. */
function crewStart(bx: number, by: number): { x: number; y: number } {
  // The back corridor: where every steward comes from in the end.
  const p = findPath(bx, by, 0, -44);
  let left = 9, x = bx, y = by;
  for (let i = 0; i + 1 < p.length; i += 2) {
    const d = Math.hypot(p[i] - x, p[i + 1] - y);
    if (d >= left) { const k = left / d; return { x: x + (p[i] - x) * k, y: y + (p[i + 1] - y) * k }; }
    left -= d; x = p[i]; y = p[i + 1];
  }
  return { x, y };
}

export function installCoverup(): void {
  registerVerb("radio", {
    check: (w, act, actor) => {
      if (!hasRadio(w, actor)) return "no radio";
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      return t && reportable(w, actor).includes(t) ? null : "nobody to report";
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, t = s.actors[(act.target as { id: string }).id];
      // Reported: nobody who stumbles on him now raises the alarm.
      st.flags[`found_${t.id}`] = 1;
      (st.coverups ??= []).push({ body: t.id, crew: [], at: s.tick + 60 * 5, stage: 0, by: actor.id });
      // Detained in the office? The man on the radio is one of us, apparently.
      if (st.detainedUntil) { st.detainedUntil = 0; st.policeCalled = false; }
      w.bus.emit({ type: "radio_call", t: s.tick, by: actor.id, who: t.id, dead: !!t.dead, x: t.x, y: t.y });
    },
  });
}

export function stepCoverups(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!st.coverups?.length) return;
  for (const c of st.coverups) {
    const body = s.actors[c.body];
    if (!body || (c.stage < 2 && body.hiddenIn)) { c.stage = 9; continue; }
    if (c.stage === 0 && tick >= c.at) {
      // Two lads turn up from the way any steward would come.
      const from = crewStart(body.x, body.y);
      c.from = from;
      c.crew = [0, 1].map((i) => {
        const a = spawnStaff(w, "cleanup", "steward", CREW[(tick + i) % CREW.length], from.x + i * 0.7, from.y, { lines: ["Nothing to see here."] });
        a.npc!.plan = [{ k: "go", x: body.x + (i ? 0.9 : -0.9), y: body.y + 0.3, run: true }];
        return a.id;
      });
      c.stage = 1; c.at = tick + 60 * 25;
      w.bus.emit({ type: "coverup_coming", t: tick, who: c.body, x: from.x, y: from.y });
    } else if (c.stage === 1) {
      const crew = c.crew.map((id) => s.actors[id]).filter(Boolean);
      const there = crew.every((a) => Math.hypot(a.x - body.x, a.y - body.y) < 1.8);
      if (there || tick >= c.at) {
        // Running late (stuck behind a door, say): they just get there.
        if (!there) crew.forEach((a, i) => { a.x = body.x + (i ? 0.9 : -0.9); a.y = body.y + 0.3; a.npc!.plan = []; });
        crew.forEach((a) => { a.facing = Math.atan2(body.y - a.y, body.x - a.x); a.npc!.plan = [{ k: "wait", s: 3 }]; });
        if (crew[0]) say(w, crew[0], body.dead ? "Christ. Right. We never saw nothing. We'll help cover this up for you." : "Okay. We'll help cover this up for you. Off you go, mate.", 4);
        c.stage = 2; c.at = tick + 60 * 3;
      }
    } else if (c.stage === 2 && tick >= c.at) {
      // Gone: on the trolley, under a sheet, out the back.
      body.hiddenIn = "coverup";
      body.dragging = undefined;
      for (const id in s.actors) if (s.actors[id].dragging === body.id) s.actors[id].dragging = undefined;
      st.gates.officedoor = { until: tick + 60 * 90, for: c.by };
      const back = c.from ?? { x: body.x, y: body.y + 9 };
      for (const id of c.crew) { const a = s.actors[id]; if (a?.npc) a.npc.plan = [{ k: "go", x: back.x, y: back.y }, { k: "despawn" }]; }
      w.bus.emit({ type: "covered_up", t: tick, who: c.body, x: body.x, y: body.y, dead: !!body.dead });
      c.stage = 9;
    }
  }
  st.coverups = st.coverups.filter((c) => c.stage !== 9);
}

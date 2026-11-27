// Roofs. Up a ladder and you're above it all: on the roofs of the pub, the shops, the team hotel and
// the South Stand. From up there you can watch the routines below, lob things down, and you're hard
// to make out: people rarely look up, and from the ground you're "a fat bloke on a roof", not a face.
// Balance (Assassin's Creed, Dishonored, Hitman's perches): ladders are the only way up, and they're
// slow; stewards who are after you wait at the foot of the ladder, then come up after you; and the
// quick way off (dropping over the edge) leaves you on your backside for a second or two.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import { VENUE } from "./layout";
import { crime } from "./security";

export interface Roof {
  id: string; name: string; x0: number; y0: number; x1: number; y1: number; h: number; ladders: { bx: number; by: number; tx: number; ty: number }[];
  /** Where the roof is in the building's painted picture, top to bottom, as fractions of its height
   *  (the painted fronts are much taller than the footprint's height suggests): the view draws people
   *  up here inside that band, so they stand on the slates and not in the air behind the ridge. */
  band?: [number, number];
  /** A hipped roof: how much narrower it is at the ridge, as a fraction of its width off each side. */
  hip?: number;
}

const QF_ROOFS: Roof[] = [
  { id: "stand", name: "The South Stand roof", x0: -48, y0: 40.2, x1: 48, y1: 45.6, h: 5, ladders: [{ bx: -36, by: 46.3, tx: -36, ty: 45.1 }] },
  { id: "pub", name: "The pub roof", band: [0.21, 0.58], hip: 0.22, x0: -62.3, y0: 61.7, x1: -34.2, y1: 80.3, h: 3.5, ladders: [{ bx: -38, by: 81.3, tx: -38, ty: 79.6 }] },
  { id: "charity", name: "The charity shop roof", band: [0.05, 0.55], x0: -18.3, y0: 61.7, x1: -3.7, y1: 72.3, h: 3, ladders: [{ bx: -6, by: 73.3, tx: -6, ty: 71.6 }] },
  { id: "surplus", name: "The army surplus roof", band: [0.03, 0.47], x0: 7.7, y0: 61.7, x1: 22.3, y1: 72.3, h: 3, ladders: [{ bx: 20.2, by: 73.3, tx: 20.2, ty: 71.6 }] },
  { id: "hotel", name: "The hotel roof", band: [0.01, 0.64], x0: 73.8, y0: -40.3, x1: 91.8, y1: -14.3, h: 6, ladders: [{ bx: 76.2, by: -13.3, tx: 76.2, ty: -15.2 }] },
];

/** The roofs at this ground (the semi-final ground is the quarter-final's mirror image, and its pub is open-air). */
export function roofs(): Roof[] {
  if (VENUE.id !== "sf") return QF_ROOFS;
  return QF_ROOFS.filter((r) => r.id !== "pub").map((r) => ({ ...r, x0: -r.x1, x1: -r.x0, ladders: r.ladders.map((l) => ({ bx: -l.bx, by: l.by, tx: -l.tx, ty: l.ty })) }));
}
export const roofOf = (a: Actor) => (a.roofId ? roofs().find((r) => r.id === a.roofId) : undefined);
export const roofHeight = (a: Actor) => (a.roof ? roofOf(a)?.h ?? 5 : 0);

/** The foot of a ladder within reach, or the top of one if you're up there. */
export function ladderNear(a: Actor, reach = 1.8): { roof: Roof; l: Roof["ladders"][number] } | null {
  for (const roof of roofs()) for (const l of roof.ladders) {
    if (a.roof && a.roofId === roof.id && Math.hypot(a.x - l.tx, a.y - l.ty) < reach) return { roof, l };
    if (!a.roof && Math.hypot(a.x - l.bx, a.y - l.by) < reach) return { roof, l };
  }
  return null;
}

/** How close to an edge (for dropping off), and where you'd land: just outside it. */
export function edgeDrop(a: Actor): { x: number; y: number; d: number } | null {
  const r = roofOf(a);
  if (!r) return null;
  const [xa, xb] = roofSpan(r, a.y);
  const opts = [
    { d: a.x - xa, x: r.x0 - 0.8, y: a.y }, { d: xb - a.x, x: r.x1 + 0.8, y: a.y },
    { d: a.y - r.y0, x: a.x, y: r.y0 - 0.8 }, { d: r.y1 - a.y, x: a.x, y: r.y1 + 0.8 },
  ].sort((p, q) => p.d - q.d);
  return opts[0];
}

/** How far back on the roof (0 at the back edge, 1 at the front). */
export const roofDepth = (r: Roof, y: number) => Math.max(0, Math.min(1, (y - r.y0 - 0.3) / Math.max(0.1, r.y1 - r.y0 - 0.6)));
/** The roof's walkable width at this depth: the full footprint at the eaves, narrower up a hipped roof. */
export function roofSpan(r: Roof, y: number): [number, number] {
  const cut = (r.hip ?? 0) * (1 - roofDepth(r, y)) * (r.x1 - r.x0);
  return [r.x0 + 0.5 + cut, r.x1 - 0.5 - cut];
}

/** Keep someone on a roof on it (walls don't apply up there). */
export function clampToRoof(a: Actor): boolean {
  const r = roofOf(a);
  if (!a.roof || !r) return false;
  a.y = Math.max(r.y0 + 0.3, Math.min(r.y1 - 0.3, a.y));
  const [xa, xb] = roofSpan(r, a.y);
  a.x = Math.max(xa, Math.min(xb, a.x));
  return true;
}

/** Up (or down) a ladder: a second and a bit, during which you're stuck on it. */
export function climb(w: World, a: Actor, up: boolean, roof: Roof, l: Roof["ladders"][number]): void {
  const s = w.state;
  a.moveX = a.moveY = 0; a.vx = a.vy = 0; a.dragging = undefined;
  if (up) { a.roof = true; a.roofId = roof.id; a.x = l.tx; a.y = l.ty; }
  else { a.roof = false; a.roofId = undefined; a.x = l.bx; a.y = l.by; }
  // A steward takes a moment on the ladder; you've the camera's cut to cover yours.
  if (a.npc) a.downUntil = Math.max(a.downUntil, s.tick + 50);
  w.bus.emit({ type: "roof", t: s.tick, by: a.id, up, roof: roof.id, name: roof.name });
}

export function installRoofs(): void {
  registerVerb("ladder", {
    check: (_w, _act, actor) => (ladderNear(actor) ? null : actor.roof ? "you need to be at the top of the ladder" : "no ladder here"),
    perform: (w, _act, actor) => {
      const near = ladderNear(actor)!;
      climb(w, actor, !actor.roof, near.roof, near.l);
      if (!actor.roof) return;
      // Somebody saw a man go up a ladder he'd no business going up.
      crime(w, actor, near.roof.id === "stand" ? "climbing up the outside of the stand" : "climbing onto a roof", 1, undefined, false);
    },
  });
  registerVerb("dropdown", {
    check: (_w, _act, actor) => { const e = edgeDrop(actor); return e && e.d < 1.6 ? null : "get to the edge first"; },
    perform: (w, _act, actor) => {
      const s = w.state, r = roofOf(actor)!, e = edgeDrop(actor)!;
      actor.roof = false; actor.roofId = undefined; actor.x = e.x; actor.y = e.y; actor.vx = actor.vy = 0;
      // The higher it is, the longer you're on the floor, and it hurts.
      actor.downUntil = Math.max(actor.downUntil, s.tick + Math.round(r.h * 14));
      if (r.h >= 5) actor.hurt = (actor.hurt ?? 0) + 1;
      w.bus.emit({ type: "dropped", t: s.tick, by: actor.id, h: r.h, x: e.x, y: e.y, inside: VENUE.inside(e.x, e.y) });
      if (VENUE.inside(e.x, e.y)) crime(w, actor, "jumping off the stand roof into the ground", 1);
    },
  });
}

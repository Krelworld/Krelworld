// PHONE MODE: aiming for thumbs (research M1, M2). Pure maths, no Phaser, so it is unit-tested.
//
//  - The target is the nearest enemy, biased toward where the stick points ("whichever foe you're moving toward"),
//    and sticky: it keeps its target until that one dies, leaves range or the screen, or another is clearly better.
//  - With no enemy about, holding FIRE falls back to the nearest barrel or crate (never auto-fire: see autoFireOk).
//  - Sliding FIRE aims by hand; a slide that points within a few degrees of an enemy snaps onto it.
//  - Auto-fire only shoots at an enemy that is in the gun's range, on screen, with no explosive barrel next to you in
//    the way (shots in this game fly through pillars and furniture, so those don't block; a barrel by your feet would
//    blow up in your face).
//  - The phone's default firing (HOLD, the user's choice after playing: "both auto firing and auto aiming. It was so
//    easy") aims only at what is IN FRONT of you: an enemy within CONE_DEG of the way you face (the way you last moved),
//    that you can see (its body on screen) and that no wall or pillar hides. You aim by turning with the stick; once
//    FIRE is held on one it stays locked (you can strafe round it) until it dies, leaves reach or can't be seen. EASY
//    firing keeps the old aim (anything about, all round you).
import type { AimAssist } from "./settings";

export interface Pt {
  x: number;
  y: number;
}

/** Something to aim at, in world coordinates. */
export interface AimTarget {
  id: number | string;
  x: number;
  y: number;
  /** Its radius (hit size). */
  r: number;
  kind: "enemy" | "object";
  /** World velocity (px/s), for leading a moving target ("strong" aim assist). */
  vx?: number;
  vy?: number;
}

export interface AimTune {
  /** How much the stick's direction counts (0: nearest only). */
  bias: number;
  /** A new target must score below this times the current one's score to take over (1: no stickiness). */
  keep: number;
  /** A slide snaps onto an enemy within this many degrees either side (0: never). */
  snapDeg: number;
  /** Aim where a moving target is going to be. */
  lead: boolean;
}

export const AIM_TUNE: Readonly<Record<AimAssist, AimTune>> = Object.freeze({
  off: { bias: 0, keep: 1, snapDeg: 0, lead: false },
  normal: { bias: 0.35, keep: 0.6, snapDeg: 15, lead: false },
  strong: { bias: 0.5, keep: 0.45, snapDeg: 25, lead: true },
});

/** The target is picked from this far (world px; the game's own touch auto-aim used 520). */
export const ACQUIRE = 520;
/** A slide-aim starts when the thumb is this far (CSS px) from where it landed on FIRE (research M2: 24, test 18-30). */
export const SLIDE_PX = 24;
/** A barrel this close to you (world px) is not shot through (a barrel hurts you within 80 px). */
export const BARREL_DANGER = 115;
/** Auto-fire: how far the golden melee combo reaches (its magnet range is a swing's reach plus 120). */
export const MELEE_REACH = 200;

/** HOLD firing: the game aims only at an enemy within this many degrees either side of the way you face (the user's
 *  choice: "within about 35 degrees")... */
export const CONE_DEG = 35;
/** ...and keeps one it is already on until it is this far round (so a target on the cone's edge doesn't flicker). */
export const CONE_KEEP_DEG = 45;

const TAU = Math.PI * 2;
/** The smallest signed difference between two angles (radians). */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Is a point inside a rectangle (with a margin)? */
export function onScreen(p: Pt, view: { x: number; y: number; w: number; h: number } | null, margin = 16): boolean {
  if (!view) return true;
  return p.x >= view.x - margin && p.x <= view.x + view.w + margin && p.y >= view.y - margin && p.y <= view.y + view.h + margin;
}

/** Is any real part of it in view (its centre no further outside the view than half its radius)? A big boss half on
 *  screen counts; a small enemy just off the edge doesn't. */
export function inView(t: Pt & { r: number }, view: { x: number; y: number; w: number; h: number } | null): boolean {
  return onScreen(t, view, Math.max(0, t.r) / 2);
}

/** A wall, pillar or other solid block (world px, top-left and size). */
export interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Does the segment a→b pass through the rectangle (shrunk by `inset` each side, so a shot grazing a corner is fine)? */
export function segHitsRect(a: Pt, b: Pt, r: WallRect, inset = 4): boolean {
  const x0 = r.x + inset;
  const y0 = r.y + inset;
  const x1 = r.x + r.w - inset;
  const y1 = r.y + r.h - inset;
  if (x1 <= x0 || y1 <= y0) return false;
  // Liang-Barsky clipping
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ];
  for (const [pp, q] of edges) {
    if (pp === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / pp;
    if (pp < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

/**
 * Can you see it from where you stand: no wall or pillar between you, and (with `room`, the floor inside the walls)
 * it is inside the room, not behind the room's own walls.
 */
export function lineOfSight(me: Pt, t: Pt, walls: readonly WallRect[], room?: WallRect | null): boolean {
  if (room && (t.x < room.x || t.x > room.x + room.w || t.y < room.y || t.y > room.y + room.h)) return false;
  for (const w of walls) {
    // (a block you are standing in or touching doesn't hide everything: only one between you and it counts)
    if (me.x >= w.x && me.x <= w.x + w.w && me.y >= w.y && me.y <= w.y + w.h) continue;
    if (t.x >= w.x && t.x <= w.x + w.w && t.y >= w.y && t.y <= w.y + w.h) continue;
    if (segHitsRect(me, t, w)) return false;
  }
  return true;
}

/** Is it within `deg` degrees either side of `facing` (radians)? Something right on top of you always is. */
export function inCone(me: Pt, t: Pt, facing: number, deg: number): boolean {
  const dx = t.x - me.x;
  const dy = t.y - me.y;
  if (Math.hypot(dx, dy) < 1) return true;
  return Math.abs(angleDiff(Math.atan2(dy, dx), facing)) <= (deg * Math.PI) / 180;
}

/**
 * How good a target is (lower is better): its distance, made shorter when it lies the way the stick points.
 * `stick` is the stick's vector (magnitude 0..1); a resting stick (under 0.3) gives no bias.
 */
export function targetScore(me: Pt, t: Pt, stick: Pt, bias: number): number {
  const dx = t.x - me.x;
  const dy = t.y - me.y;
  const d = Math.hypot(dx, dy);
  const m = Math.hypot(stick.x, stick.y);
  if (!bias || m < 0.3 || d < 1) return d;
  const align = (dx * stick.x + dy * stick.y) / (d * m);
  return d * (1 - bias * align);
}

export interface PickInput {
  me: Pt;
  stick: Pt;
  enemies: AimTarget[];
  /** Barrels and crates, for FIRE held with no enemy about. */
  objects?: AimTarget[];
  /** The current target's id (sticky), or null. */
  prev: AimTarget["id"] | null;
  tune: AimTune;
  /** The camera's view in world coordinates (targets must be on screen), or null for "anywhere". */
  view?: { x: number; y: number; w: number; h: number } | null;
  reach?: number;
  /** The gun's reach (world px). When some enemy is inside it, only those count: a target the gun can't reach never
   *  holds the aim (and auto-fire) while another one walks up inside it (F3). */
  fireRange?: number;
  /**
   * HOLD firing (the phone default): the way you face (radians). Set, only targets within `coneDeg` of it count (the one
   * already aimed at stays until `keepDeg`), and only ones `visible` says yes to. Null / unset: all round you (EASY).
   */
  facing?: number | null;
  coneDeg?: number;
  keepDeg?: number;
  /** HOLD firing, FIRE held: the one already aimed at stays locked on wherever it goes (you can strafe round it), as
   *  long as it stays in reach and visible. A new one is only ever picked inside the cone. */
  lockPrev?: boolean;
  /** HOLD firing: can you really see it (body on screen, no wall in between)? Unset: on screen by its centre (EASY). */
  visible?: (t: AimTarget) => boolean;
}

/** The target to aim at: an enemy (sticky, stick-biased), else a barrel or crate, else null. */
export function pickTarget(i: PickInput): AimTarget | null {
  const reach = i.reach ?? ACQUIRE;
  const facing = typeof i.facing === "number" ? i.facing : null;
  const cone = i.coneDeg ?? CONE_DEG;
  const keep = Math.max(cone, i.keepDeg ?? CONE_KEEP_DEG);
  const ahead = (t: AimTarget) => facing === null || (i.lockPrev && t.id === i.prev) || inCone(i.me, t, facing, t.id === i.prev ? keep : cone);
  const look = i.visible ?? ((t: AimTarget) => onScreen(t, i.view ?? null));
  const seen = (t: AimTarget) => Math.hypot(t.x - i.me.x, t.y - i.me.y) <= reach + t.r && ahead(t) && look(t);
  const fr = i.fireRange;
  const inGun = (t: AimTarget) => fr === undefined || Math.hypot(t.x - i.me.x, t.y - i.me.y) <= fr + t.r;
  const gunHasOne = fr !== undefined && i.enemies.some((e) => seen(e) && inGun(e));
  const ok = (t: AimTarget) => seen(t) && (t.kind !== "enemy" || !gunHasOne || inGun(t));
  let best: AimTarget | null = null;
  let bs = Infinity;
  let prev: AimTarget | null = null;
  let ps = Infinity;
  for (const e of i.enemies) {
    if (!ok(e)) continue;
    const s = targetScore(i.me, e, i.stick, i.tune.bias);
    if (e.id === i.prev) {
      prev = e;
      ps = s;
    }
    if (s < bs) {
      bs = s;
      best = e;
    }
  }
  // sticky: the one you're on stays unless another is clearly better
  if (prev && best && best !== prev && !(bs < ps * i.tune.keep)) return prev;
  if (best) return best;
  let ob: AimTarget | null = null;
  let od = Infinity;
  for (const o of i.objects ?? []) {
    if (!ok(o)) continue;
    const d = Math.hypot(o.x - i.me.x, o.y - i.me.y);
    if (d < od) {
      od = d;
      ob = o;
    }
  }
  return ob;
}

/** A slide's angle, snapped onto the enemy nearest that direction (within the tune's degrees), and which one. */
export function snapAim(me: Pt, angle: number, enemies: AimTarget[], tune: AimTune, reach = ACQUIRE, view?: { x: number; y: number; w: number; h: number } | null, visible?: (t: AimTarget) => boolean): { angle: number; snapped: AimTarget | null } {
  if (!tune.snapDeg) return { angle, snapped: null };
  const lim = (tune.snapDeg * Math.PI) / 180;
  let best: AimTarget | null = null;
  let bd = Infinity;
  for (const e of enemies) {
    const dx = e.x - me.x;
    const dy = e.y - me.y;
    const d = Math.hypot(dx, dy);
    if (d > reach + e.r || !(visible ? visible(e) : onScreen(e, view ?? null))) continue;
    const off = Math.abs(angleDiff(Math.atan2(dy, dx), angle));
    if (off <= lim && off < bd) {
      bd = off;
      best = e;
    }
  }
  return best ? { angle: Math.atan2(best.y - me.y, best.x - me.x), snapped: best } : { angle, snapped: null };
}

/** Where to aim at a target: where it is, or (leading) where it will be when a shot of this speed gets there. */
export function aimPointFor(me: Pt, t: AimTarget, shotSpeed: number, lead: boolean): Pt {
  if (!lead || !shotSpeed || (!t.vx && !t.vy)) return { x: t.x, y: t.y };
  const d = Math.hypot(t.x - me.x, t.y - me.y);
  const s = Math.min(0.6, d / shotSpeed);
  return { x: t.x + (t.vx ?? 0) * s, y: t.y + (t.vy ?? 0) * s };
}

/** How far the segment a→b passes from point p, and how far along it (0..1) the nearest point is. */
export function segDist(a: Pt, b: Pt, p: Pt): { d: number; t: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const L = vx * vx + vy * vy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
  return { d: Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y), t };
}

export interface AutoFireInput {
  me: Pt;
  target: AimTarget | null;
  /** The weapon's reach (world px). */
  range: number;
  view?: { x: number; y: number; w: number; h: number } | null;
  /** Live explosive barrels (world). */
  barrels?: AimTarget[];
}

/** Auto-fire: shoot only at an enemy in range, on screen, with no barrel next to you in the line of fire. */
export function autoFireOk(i: AutoFireInput): boolean {
  const t = i.target;
  if (!t || t.kind !== "enemy") return false;
  const d = Math.hypot(t.x - i.me.x, t.y - i.me.y);
  if (d > i.range + t.r) return false;
  if (!onScreen(t, i.view ?? null, 0)) return false;
  return !barrelInTheWay(i.me, t, i.barrels ?? []);
}

/** A live barrel close to you that a shot at this target would pass through (it would blow up on you). */
export function barrelInTheWay(me: Pt, t: Pt, barrels: AimTarget[]): boolean {
  const dt = Math.hypot(t.x - me.x, t.y - me.y);
  for (const b of barrels) {
    const db = Math.hypot(b.x - me.x, b.y - me.y);
    if (db > BARREL_DANGER || db > dt) continue;
    const s = segDist(me, t, b);
    if (s.d <= b.r + 8) return true;
  }
  return false;
}

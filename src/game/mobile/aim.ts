// PHONE MODE: aiming for thumbs (research M1, M2). Pure maths, no Phaser, so it is unit-tested.
//
//  - The target is the nearest enemy, biased toward where the stick points ("whichever foe you're moving toward"),
//    and sticky: it keeps its target until that one dies, leaves range or the screen, or another is clearly better.
//  - With no enemy about, holding FIRE falls back to the nearest barrel or crate (never auto-fire: see autoFireOk).
//  - Sliding FIRE aims by hand; a slide that points within a few degrees of an enemy snaps onto it.
//  - Auto-fire only shoots at an enemy that is in the gun's range, on screen, with no explosive barrel next to you in
//    the way (shots in this game fly through pillars and furniture, so those don't block; a barrel by your feet would
//    blow up in your face).
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
}

/** The target to aim at: an enemy (sticky, stick-biased), else a barrel or crate, else null. */
export function pickTarget(i: PickInput): AimTarget | null {
  const reach = i.reach ?? ACQUIRE;
  const ok = (t: AimTarget) => Math.hypot(t.x - i.me.x, t.y - i.me.y) <= reach + t.r && onScreen(t, i.view ?? null);
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
export function snapAim(me: Pt, angle: number, enemies: AimTarget[], tune: AimTune, reach = ACQUIRE, view?: { x: number; y: number; w: number; h: number } | null): { angle: number; snapped: AimTarget | null } {
  if (!tune.snapDeg) return { angle, snapped: null };
  const lim = (tune.snapDeg * Math.PI) / 180;
  let best: AimTarget | null = null;
  let bd = Infinity;
  for (const e of enemies) {
    const dx = e.x - me.x;
    const dy = e.y - me.y;
    const d = Math.hypot(dx, dy);
    if (d > reach + e.r || !onScreen(e, view ?? null)) continue;
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

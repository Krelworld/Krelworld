// PHONE MODE: where the touch controls go, in real CSS px. Pure maths (no DOM), so it is unit-tested.
//
// Rules (audit section 3, research M3/M5):
//  - every control is anchored to a corner of the SAFE area: max(left inset, right inset) on both sides, so nothing
//    jumps when the phone is turned round; the bottom keeps the home-indicator strip (21 px) clear.
//  - sizes and offsets scale with the screen height, clamp(h / 390, 0.85, 1.15), times the S/M/L setting
//    (0.85 / 1 / 1.2), and no control is ever drawn smaller than 52 px.
//  - the touchable area is the drawing plus 10 px on every side (never into the bottom strip).
//  - on screens with a notch or cutout (side insets), nothing is drawn within 60 px of a short edge between 30% and
//    70% of the height (the Dynamic Island, either side).
//  - left-handed mirrors the thumb controls (pause and the fullscreen offer stay top right, clear of the HUD's face).
import type { PhoneSettings } from "./settings";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  w: number;
  h: number;
  insets: Insets;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The design height (iPhone 14 landscape). */
export const BASE_H = 390;
/** No control is drawn smaller than this (CSS px). */
export const MIN_CONTROL = 52;
/** The touchable area reaches this far past the drawing on every side. */
export const HIT_SLOP = 10;
/** The home-indicator strip at the bottom: nothing touchable in it. */
export const BOTTOM_CLEAR = 21;
/** The Dynamic Island band: nothing drawn this close to a short edge (an iPhone's 47 px inset + 13)... */
export const ISLAND_GAP = 60;
/** ...or, on a screen reporting a smaller side inset (an Android camera cutout: 16-40 px), this far past the inset
 *  (the 60 px band is sized for the Dynamic Island; a fixed 60 pushed SPECIAL into DODGE on Android: F5). */
export const ISLAND_MARGIN = 13;

/** How close to a short edge a control may be drawn in the island band, for this screen's side insets. */
export function islandGap(vp: Viewport): number {
  return Math.min(ISLAND_GAP, Math.max(vp.insets.left, vp.insets.right, 0) + ISLAND_MARGIN);
}
/** ...between these fractions of the height. */
export const ISLAND_BAND: readonly [number, number] = [0.3, 0.7];
/** A drawing that only reaches this far into the band counts as clear of it. */
export const ISLAND_GRAZE = 6;

/** Does this screen have a notch / island / cutout on a short edge? (It reports side insets if so.) */
export function islandSides(vp: Viewport): boolean {
  return Math.max(vp.insets.left, vp.insets.right) > 0;
}
export const SIZE_K: Readonly<Record<PhoneSettings["buttonSize"], number>> = { S: 0.85, M: 1, L: 1.2 };
/** The stick zone: this much of the window's width, from the thumb's side (gutter included). */
export const STICK_ZONE_FRAC = 0.45;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How much to scale the controls on this screen with these settings. */
export function controlScale(h: number, size: PhoneSettings["buttonSize"]): number {
  return clamp(h / BASE_H, 0.85, 1.15) * (SIZE_K[size] ?? 1);
}

/** The safe area: inside the side insets (the larger of the two, both sides) and above the home-indicator strip. */
export function safeRect(vp: Viewport): Rect {
  const side = Math.max(0, vp.insets.left, vp.insets.right);
  const top = Math.max(0, vp.insets.top);
  const bottom = vp.h - Math.max(BOTTOM_CLEAR, vp.insets.bottom);
  return { x: side, y: top, w: Math.max(0, vp.w - 2 * side), h: Math.max(0, bottom - top) };
}

/**
 * A control's slot. `in` is the distance from the safe area's right edge to the control's centre; `up` from the safe
 * bottom (corner "br") or `down` from the safe top (corner "tr"). All at scale 1 (an 844x390 screen, size M).
 */
export interface SlotSpec {
  corner: "br" | "tr";
  in: number;
  up?: number;
  down?: number;
  size: number;
  /** Mirror for left-handed play (default true). */
  mirror?: boolean;
}

/** The slots (research "right-hand cluster, layout v2"; offsets from the bottom-right safe corner). */
export const SLOTS = {
  /** The prime corner: ACTION in walk mode (FIRE / JUMP in combat, stage 2). */
  prime: { corner: "br", in: 52, up: 52, size: 84 },
  left: { corner: "br", in: 148, up: 44, size: 60 },
  upLeft: { corner: "br", in: 122, up: 126, size: 60 },
  up: { corner: "br", in: 34, up: 150, size: 60 },
  ready: { corner: "br", in: 34, up: 226, size: 60 },
  heal: { corner: "br", in: 118, up: 204, size: 56 },
  /** ACTION in combat rooms (only with a prompt). */
  combatAction: { corner: "br", in: 212, up: 104, size: 56 },
  /** Walk mode's one extra (SANMIK when playing as Mikey): straight above ACTION. */
  walkExtra: { corner: "br", in: 52, up: 150, size: 56 },
  pause: { corner: "tr", in: 26, down: 32, size: 52, mirror: false },
  /** Android, after leaving fullscreen: the offer to go back in, left of pause. */
  fullscreen: { corner: "tr", in: 92, down: 32, size: 52, mirror: false },
  /** The same offer in a fight (the weapon chip is left of pause there): under pause, clear of READY. */
  fullscreenFight: { corner: "tr", in: 26, down: 86, size: 44, mirror: false },
} as const satisfies Record<string, SlotSpec>;

export type SlotId = keyof typeof SLOTS;

export interface Placed {
  /** Centre of the drawing. */
  cx: number;
  cy: number;
  /** Drawn diameter. */
  size: number;
  /** A drawing that is not round (a chip): its width and height (else `size` both ways). */
  w?: number;
  h?: number;
  /** The touchable rectangle. */
  hit: Rect;
}

/** Put one control on the screen. */
export function placeControl(vp: Viewport, spec: SlotSpec, settings: Pick<PhoneSettings, "leftHanded" | "buttonSize">): Placed {
  const s = controlScale(vp.h, settings.buttonSize);
  const size = Math.max(MIN_CONTROL, spec.size * s);
  const r = size / 2;
  const safe = safeRect(vp);
  let cx = safe.x + safe.w - spec.in * s;
  let cy = spec.corner === "br" ? safe.y + safe.h - (spec.up ?? 0) * s : safe.y + (spec.down ?? 0) * s;
  // whole drawing inside the safe area
  cx = clamp(cx, safe.x + r, safe.x + safe.w - r);
  cy = clamp(cy, safe.y + r, safe.y + safe.h - r);
  // keep clear of the Dynamic Island band on both short edges (only where the screen has a notch or cutout, which
  // is what side insets mean; a control merely grazing the band's edge stays where it is)
  const [b0, b1] = ISLAND_BAND;
  if (islandSides(vp) && cy + r > vp.h * b0 + ISLAND_GRAZE && cy - r < vp.h * b1 - ISLAND_GRAZE) {
    const gap = islandGap(vp);
    if (vp.w - (cx + r) < gap) cx = vp.w - gap - r;
    if (cx - r < gap) cx = gap + r;
  }
  if (settings.leftHanded && spec.mirror !== false) cx = vp.w - cx;
  return { cx, cy, size, hit: hitRect(vp, cx, cy, size) };
}

/** The drawing plus the slop, kept on screen and out of the bottom strip. */
export function hitRect(vp: Viewport, cx: number, cy: number, size: number): Rect {
  const safe = safeRect(vp);
  const x0 = Math.max(0, cx - size / 2 - HIT_SLOP);
  const x1 = Math.min(vp.w, cx + size / 2 + HIT_SLOP);
  const y0 = Math.max(0, cy - size / 2 - HIT_SLOP);
  const y1 = Math.min(safe.y + safe.h, cy + size / 2 + HIT_SLOP);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Every slot at once. */
export function layoutSlots(vp: Viewport, settings: Pick<PhoneSettings, "leftHanded" | "buttonSize">): Record<SlotId, Placed> {
  const out = {} as Record<SlotId, Placed>;
  for (const id of Object.keys(SLOTS) as SlotId[]) out[id] = placeControl(vp, SLOTS[id], settings);
  // the fight's fullscreen offer: 12 px under pause whatever the screen (52 px minimum sizes pushed it into pause on
  // screens under about 400 px tall: F8)
  const pz = out.pause;
  const fs = out.fullscreenFight;
  const minCy = pz.cy + pz.size / 2 + 12 + fs.size / 2;
  if (fs.cy < minCy) out.fullscreenFight = { ...fs, cy: minCy, hit: hitRect(vp, fs.cx, minCy, fs.size) };
  return out;
}

/**
 * Where a touch becomes the stick: the thumb's 45% of the window, the black gutter included, below the top HUD strip
 * and above the home-indicator strip.
 */
export function stickZone(vp: Viewport, settings: Pick<PhoneSettings, "leftHanded">): Rect {
  const safe = safeRect(vp);
  const w = Math.round(vp.w * STICK_ZONE_FRAC);
  const top = Math.max(vp.insets.top, Math.round(vp.h * 0.2));
  const bottom = safe.y + safe.h;
  return { x: settings.leftHanded ? vp.w - w : 0, y: top, w, h: Math.max(0, bottom - top) };
}

export interface StickGeometry {
  /** Base diameter. */
  base: number;
  /** Knob diameter. */
  knob: number;
  /** How far the knob travels from the centre (the base's radius). */
  travel: number;
  /** Dead zone (px): radial for "2d", horizontal for "x". */
  dead: number;
  /** Full speed at this distance (60% of the travel for "2d", 35% for "x": research M6). */
  full: number;
  /** "2d": any direction; "x": left and right only (side-scrolling rooms). */
  axis: "2d" | "x";
}

export function stickGeometry(h: number, size: PhoneSettings["buttonSize"], axis: "2d" | "x" = "2d"): StickGeometry {
  const base = Math.round(Math.max(96, 112 * controlScale(h, size)));
  const travel = base / 2;
  return { base, knob: Math.round(base * 0.45), travel, dead: 8, full: travel * (axis === "x" ? 0.35 : 0.6), axis };
}

/**
 * The stick's output for a thumb this far from the base: dead zone, then speed ramps from zero to full. An "x" stick
 * only reads left and right (y is always 0).
 */
export function stickVector(dx: number, dy: number, g: Pick<StickGeometry, "dead" | "full"> & { axis?: "2d" | "x" }): { x: number; y: number; mag: number } {
  if (g.axis === "x") {
    const ax = Math.abs(dx);
    if (ax <= g.dead) return { x: 0, y: 0, mag: 0 };
    const mag = Math.min(1, (ax - g.dead) / Math.max(1, g.full - g.dead));
    return { x: Math.sign(dx) * mag, y: 0, mag };
  }
  const len = Math.hypot(dx, dy);
  if (len <= g.dead || len === 0) return { x: 0, y: 0, mag: 0 };
  const mag = Math.min(1, (len - g.dead) / Math.max(1, g.full - g.dead));
  return { x: (dx / len) * mag, y: (dy / len) * mag, mag };
}

/** Follow: when the thumb goes past the rim, the base is dragged along so reversing is a short move. */
export function followBase(base: { x: number; y: number }, finger: { x: number; y: number }, travel: number): { x: number; y: number } {
  const dx = finger.x - base.x;
  const dy = finger.y - base.y;
  const d = Math.hypot(dx, dy);
  if (d <= travel) return base;
  const k = (d - travel) / d;
  return { x: base.x + dx * k, y: base.y + dy * k };
}

/** Where the faint idle stick sits (a hint of where to put the thumb), mirrored for left-handed play. */
export function ghostStick(vp: Viewport, settings: Pick<PhoneSettings, "leftHanded" | "buttonSize">): { x: number; y: number } {
  const s = controlScale(vp.h, settings.buttonSize);
  const g = stickGeometry(vp.h, settings.buttonSize);
  const safe = safeRect(vp);
  const r = g.base / 2;
  let x = Math.max(safe.x + 103 * s, r + 4);
  const y = Math.min(safe.y + safe.h - 79 * s, safe.y + safe.h - r - 4);
  if (settings.leftHanded) x = vp.w - x;
  return { x, y };
}

// ---------------------------------------------------------------- a cluster's shared touch surface (research M3)

/** Inside a cluster, a touch in a gap goes to the nearest control within this many px of its drawing. */
export const GAP_REACH = 20;

/**
 * A group control's touch area: its drawing plus `reach` on every side (kept on screen and out of the bottom strip).
 * `corner`: the prime corner also runs out to the screen's right edge (left for left-handed play) and down to the
 * home-indicator strip (research: hit areas may reach the physical edge outside the island band).
 */
export function groupHit(vp: Viewport, p: Pick<Placed, "cx" | "cy" | "size" | "w" | "h">, reach: number, corner = false): Rect {
  const safe = safeRect(vp);
  const fw = p.w ?? p.size;
  const fh = p.h ?? p.size;
  let x0 = Math.max(0, p.cx - fw / 2 - reach);
  let x1 = Math.min(vp.w, p.cx + fw / 2 + reach);
  const y0 = Math.max(0, p.cy - fh / 2 - reach);
  let y1 = Math.min(safe.y + safe.h, p.cy + fh / 2 + reach);
  if (corner) {
    if (p.cx > vp.w / 2) x1 = vp.w;
    else x0 = 0;
    y1 = safe.y + safe.h;
  }
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export interface RouteCandidate {
  id: string;
  /** Centre and half-size of the drawing (a circle when w = h). */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Its own touch area (drawing + the 10 px slop). */
  hit: Rect;
}

/** How far a point is from a drawing's edge (0 inside it). Round drawings (w = h) are circles; chips rectangles. */
export function edgeDistance(c: Pick<RouteCandidate, "cx" | "cy" | "w" | "h">, x: number, y: number): number {
  if (Math.abs(c.w - c.h) < 0.5) return Math.max(0, Math.hypot(x - c.cx, y - c.cy) - c.w / 2);
  const dx = Math.max(0, Math.abs(x - c.cx) - c.w / 2);
  const dy = Math.max(0, Math.abs(y - c.cy) - c.h / 2);
  return Math.hypot(dx, dy);
}

/**
 * Which control of a cluster a touch at (x, y) belongs to (research M3): inside one or more touch areas (drawing +
 * slop), the nearest centre; in a gap, the control whose drawing is nearest, if it is within `reach`; else null.
 */
export function routeTouch(x: number, y: number, cands: readonly RouteCandidate[], reach = GAP_REACH): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const c of cands) {
    if (!inRect(c.hit, x, y)) continue;
    const d = Math.hypot(x - c.cx, y - c.cy);
    if (d < bd) {
      bd = d;
      best = c.id;
    }
  }
  if (best) return best;
  for (const c of cands) {
    const d = edgeDistance(c, x, y);
    if (d <= reach && d < bd) {
      bd = d;
      best = c.id;
    }
  }
  return best;
}

/**
 * The idle stick off the player (stage 2; the gate's note: at 750x340 it sat over the player at Home's far left).
 * `at` is the ring's resting centre, `r` its radius; if the ring (with a margin) covers the player, it moves to the
 * nearest clear place inside the stick zone: beside the player (the side away from the screen edge first), then above
 * or below. Null when nowhere in the zone is clear (the caller then shows it see-through where it is).
 */
export function ghostClear(at: { x: number; y: number }, r: number, player: Rect | null, zone: Rect, margin = 8): { x: number; y: number } | null {
  const ring = (p: { x: number; y: number }): Rect => ({ x: p.x - r - margin, y: p.y - r - margin, w: 2 * (r + margin), h: 2 * (r + margin) });
  if (!player || !overlaps(ring(at), player)) return at;
  const inZone = (p: { x: number; y: number }) => p.x - r >= zone.x && p.x + r <= zone.x + zone.w && p.y - r >= zone.y && p.y + r <= zone.y + zone.h;
  const cands = [
    { x: player.x + player.w + r + margin + 2, y: at.y },
    { x: player.x - r - margin - 2, y: at.y },
    { x: at.x, y: player.y - r - margin - 2 },
    { x: at.x, y: player.y + player.h + r + margin + 2 },
  ].filter((p) => inZone(p) && !overlaps(ring(p), player));
  if (!cands.length) return null;
  cands.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
  return cands[0];
}

/** Is a point inside a rectangle? */
export function inRect(r: Rect | null | undefined, x: number, y: number): boolean {
  return !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Do two rectangles overlap (by more than a touch)? */
export function overlaps(a: Rect | null | undefined, b: Rect | null | undefined): boolean {
  return !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * The part of a tap area that lies outside the stick zone (inside the zone the zone's own tap rule handles it): the
 * larger of the strip beside the zone and the strip above it. Null if nothing is left.
 */
export function outsideZone(r: Rect, zone: Rect): Rect | null {
  if (!overlaps(r, zone)) return r.w > 0 && r.h > 0 ? r : null;
  const zr = zone.x + zone.w;
  // beside: to the right of a left-hand zone, or to the left of a right-hand one
  const side: Rect | null =
    zone.x <= 0 ? (r.x + r.w > zr ? { x: zr, y: r.y, w: r.x + r.w - zr, h: r.h } : null) : r.x < zone.x ? { x: r.x, y: r.y, w: zone.x - r.x, h: r.h } : null;
  const above: Rect | null = r.y < zone.y ? { x: r.x, y: r.y, w: r.w, h: zone.y - r.y } : null;
  const area = (q: Rect | null) => (q ? q.w * q.h : 0);
  const best = area(side) >= area(above) ? side : above;
  return best && best.w > 0 && best.h > 0 ? best : null;
}

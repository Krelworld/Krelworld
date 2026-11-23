// PHONE MODE: where the touch controls go, in real CSS px. Pure maths (no DOM), so it is unit-tested.
//
// Rules (audit section 3, research M3/M5):
//  - every control is anchored to a corner of the SAFE area: max(left inset, right inset) on both sides, so nothing
//    jumps when the phone is turned round; the bottom keeps the home-indicator strip (21 px) clear.
//  - sizes and offsets scale with the screen height, clamp(h / 390, 0.85, 1.15), times the S/M/L setting
//    (0.85 / 1 / 1.2), and no control is ever drawn smaller than 52 px.
//  - the touchable area is the drawing plus 10 px on every side (never into the bottom strip).
//  - nothing is drawn within 60 px of a short edge between 30% and 70% of the height (the Dynamic Island, either side).
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
/** The Dynamic Island band: nothing drawn this close to a short edge... */
export const ISLAND_GAP = 60;
/** ...between these fractions of the height. */
export const ISLAND_BAND: readonly [number, number] = [0.3, 0.7];
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
} as const satisfies Record<string, SlotSpec>;

export type SlotId = keyof typeof SLOTS;

export interface Placed {
  /** Centre of the drawing. */
  cx: number;
  cy: number;
  /** Drawn diameter. */
  size: number;
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
  // keep clear of the Dynamic Island band on both short edges
  const [b0, b1] = ISLAND_BAND;
  if (cy + r > vp.h * b0 && cy - r < vp.h * b1) {
    if (vp.w - (cx + r) < ISLAND_GAP) cx = vp.w - ISLAND_GAP - r;
    if (cx - r < ISLAND_GAP) cx = ISLAND_GAP + r;
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
  /** Radial dead zone (px). */
  dead: number;
  /** Full speed at this distance (60% of the travel). */
  full: number;
}

export function stickGeometry(h: number, size: PhoneSettings["buttonSize"]): StickGeometry {
  const base = Math.round(Math.max(96, 112 * controlScale(h, size)));
  const travel = base / 2;
  return { base, knob: Math.round(base * 0.45), travel, dead: 8, full: travel * 0.6 };
}

/** The stick's output for a thumb this far from the base: radial dead zone, then speed ramps from zero to full. */
export function stickVector(dx: number, dy: number, g: Pick<StickGeometry, "dead" | "full">): { x: number; y: number; mag: number } {
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

/** Is a point inside a rectangle? */
export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

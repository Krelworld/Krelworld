// PHONE MODE: the pure maths of readability.ts (no Phaser, so it is unit-tested in node). See readability.ts.
import type { PhoneSettings } from "./settings";

/** No text under this many CSS px on the screen (normal text size): labels, hints, menus (research M7: 11). */
export const MIN_TEXT_CSS = 11;
/**
 * Reading text (dialogue body, choices, subtitles, Messenger pings, book and chat reading) is this many CSS px on the
 * screen (research M7: 16 to 17 px on a 390 px tall screen; Ren'Py's phone preset, 46 px at 1080p, the BBC).
 */
export const READ_TEXT_CSS = 16;
/** The speaker's name over a line: a little smaller than the line itself, bigger than a label. */
export const NAME_TEXT_CSS = 14;
/** The word on a menu button the thumb aims at: bigger than small print. */
export const BUTTON_TEXT_CSS = 12.5;
/** The "large" text size multiplies the floor (and the reading size) by this. */
export const LARGE_TEXT_K = 1.25;
/** Tap areas at least this many CSS px each way. */
export const MIN_HIT_CSS = 44;
/** An interactive object at least this fraction of the screen both ways is a backdrop (tap-anywhere zone, modal). */
export const BACKDROP_FRAC = 0.45;
/** How often (frames) the floor is re-checked against texts whose scale or camera zoom changed. */
export const SWEEP_EVERY = 20;

/** "?mobileread=1" (also "on", "true", empty) → true, "0" / "off" / "false" → false, absent → null. */
export function parseReadParam(search: string | undefined): boolean | null {
  if (!search) return null;
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (!q.has("mobileread")) return null;
  const v = (q.get("mobileread") ?? "").trim().toLowerCase();
  return !(v === "0" || v === "off" || v === "false" || v === "no");
}

/** The address wins over the setting. */
export function readabilityWanted(setting: boolean, param: boolean | null): boolean {
  return param ?? setting;
}

/** The floor in CSS px for a text size setting. */
export function minTextCss(textSize: PhoneSettings["textSize"]): number {
  return textSize === "large" ? MIN_TEXT_CSS * LARGE_TEXT_K : MIN_TEXT_CSS;
}

/** The reading size in CSS px for a text size setting (16, or 20 with "large"). */
export function readTextCss(textSize: PhoneSettings["textSize"]): number {
  return textSize === "large" ? READ_TEXT_CSS * LARGE_TEXT_K : READ_TEXT_CSS;
}

/** The speaker name size in CSS px for a text size setting. */
export function nameTextCss(textSize: PhoneSettings["textSize"]): number {
  return textSize === "large" ? NAME_TEXT_CSS * LARGE_TEXT_K : NAME_TEXT_CSS;
}

/** The CSS px floor for a text's role (a label, a menu button's word, a speaker name, reading text). */
export function roleTextCss(role: "read" | "name" | "button" | undefined, textSize: PhoneSettings["textSize"]): number {
  const base = role === "read" ? READ_TEXT_CSS : role === "name" ? NAME_TEXT_CSS : role === "button" ? BUTTON_TEXT_CSS : MIN_TEXT_CSS;
  return textSize === "large" ? base * LARGE_TEXT_K : base;
}

/** Game px that show at least `css` CSS px at canvas scale `k` (what a layout asks for: "16 CSS px" or "44 CSS px"). */
export function gamePx(k: number, css: number): number {
  return textFloorPx(k, 1, css);
}

/**
 * The smallest font (game px) that still shows `minCss` CSS px tall: canvas scale `k` (CSS px per game px) times the
 * text's total scale `factor` (own x containers x camera zoom).
 */
export function textFloorPx(k: number, factor: number, minCss: number): number {
  const kk = k > 0.05 ? k : 0.72;
  const f = factor > 0 ? factor : 1;
  return Math.ceil(minCss / (kk * f) - 1e-6);
}

/** The font a text is drawn at: what it asked for, raised to the floor when the floor is on. */
export function flooredSize(requested: number, floor: number, on: boolean): number {
  return on ? Math.max(requested, floor) : requested;
}

/** A text's scale for the floor: tiny scales are effects (pop-ins, shrinking credits), not reading text. */
export function usableFactor(f: number): number {
  if (!Number.isFinite(f) || f < 0.5) return 1;
  return Math.min(3, f);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far to grow a box (each side) so it is at least minW x minH, about its middle. */
export function growBy(b: Pick<Box, "w" | "h">, minW: number, minH: number): { ex: number; ey: number } {
  return { ex: Math.max(0, (minW - b.w) / 2), ey: Math.max(0, (minH - b.h) / 2) };
}

/** Distance from a point to a box (0 inside). */
export function distToBox(b: Box, x: number, y: number): number {
  const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
  const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

/**
 * The snap rule on screen-space boxes (game px): among the candidates whose box grown to minW x minH contains the
 * point, the one whose drawn box is nearest. Null when none does. (The live version works in each object's own
 * space so rotation, containers and scroll factors are right; this is the same rule for the tests.)
 */
export function snapTarget<T>(cands: { id: T; box: Box }[], x: number, y: number, minW: number, minH: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const c of cands) {
    const { ex, ey } = growBy(c.box, minW, minH);
    if (ex === 0 && ey === 0) continue;
    if (x < c.box.x - ex || x > c.box.x + c.box.w + ex || y < c.box.y - ey || y > c.box.y + c.box.h + ey) continue;
    const d = distToBox(c.box, x, y);
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

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
  /**
   * The fight's pocket (thumb-feel round, the user: "the specials, when they do activate, are tiny to press"): the
   * fart, the fizzy bongo and the SanMik change, each a full-size button in its own fixed place at the cluster's
   * upper left, shown only while it can be used (they were 32 px chips under the health bars, top left).
   */
  pocketFart: { corner: "br", in: 206, up: 186, size: 60 },
  pocketBongo: { corner: "br", in: 206, up: 266, size: 60 },
  pocketSanmik: { corner: "br", in: 286, up: 226, size: 60 },
  /** Walk mode's one extra (SANMIK when playing as Mikey): straight above ACTION. */
  walkExtra: { corner: "br", in: 52, up: 150, size: 56 },
  /** Walk mode's BIKE (town and the Kreddle Strip): left of ACTION, on the thumb's resting line. */
  walkBike: { corner: "br", in: 148, up: 44, size: 60 },
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
  /**
   * A group control's shared touch area stops at this page y (the fight cluster's top row under pause and the weapon
   * chip: their own touch areas stay theirs).
   */
  clipTop?: number;
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

/** A stick base's centre kept inside the stick zone (a "follows" stick dragged past its edge stops at it). */
export function keepInZone(p: { x: number; y: number }, zone: Rect): { x: number; y: number } {
  if (zone.w <= 0 || zone.h <= 0) return p;
  return { x: clamp(p.x, zone.x, zone.x + zone.w), y: clamp(p.y, zone.y, zone.y + zone.h) };
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

// ---------------------------------------------------------------- the fight cluster (s4b: it hugs the thumb's edge)
//
// The user, on an iPhone in the Wildern Cafeteria: "Do you think it's good that the buttons can start creeping to the
// centre of the screen?" With SANMIK, FART / BONGO, HEAL, READY, SPECIAL, DODGE, SWAP and FIRE all up, the pocket and
// ACTION sat 206 to 286 px in from the edge, over the middle of the fight. The fight's buttons are now three tight
// columns in the bottom-right safe corner (mirrored for left-handed play), each column as low as FIRE and the cell
// left of it allow, 12 px between drawings (research M5). At 844x390:
//
//          col 2    col 1    col 0
//           [ ]      FART             (each column stacks upward as far as pause and the weapon chip allow; left-handed,
//          SANMIK    HEAL    READY     the HUD's top-left block)
//          ACTION    DODGE   SPECIAL
//                 SWAP        FIRE    (FIRE / JUMP the big corner button; side rooms: FIRE where SWAP is)
//
// No cell's centre is further in than FIGHT_REACH (x the drawn size). Each button has a fixed home cell, so nothing
// moves when another comes or goes; the pocket's homes are the cells left over nearest the edge (FART, then SANMIK),
// and BONGO's is HEAL's (the fizzy bongo only shows while HEAL doesn't: one drink button at a time). Only when there
// are more buttons up than cells (big buttons on a short screen) does a button without a cell take a free one nearest
// the edge, and if none is left the pocket is drawn smaller (POCKET_MIN, 44 px) in a gap rather than further in.

/** No fight button's centre is further than this from the safe edge (CSS px at scale 1, 844x390, size M). */
export const FIGHT_REACH = 200;
/** A pocket button with no cell left is drawn this small (a comfortable 44 px target), never further in. */
export const POCKET_MIN = 44;
/** The cluster's button size at scale 1. */
export const CLUSTER_SIZE = 60;
/** Between two drawings: at least 12 px (research M5), scaled up with the buttons. */
export const CLUSTER_GAP = 12;
/** From the safe edge to column 0's centre (scale 1). */
export const CLUSTER_EDGE = 44;

export type FightRole = "prime" | "second" | "dodge" | "special" | "ready" | "heal" | "action" | "fart" | "bongo" | "sanmik";
/** The pocket: drawn smaller when there are more buttons than cells. */
export const POCKET_ROLES = ["fart", "bongo", "sanmik"] as const;
/** The pocket buttons with homes of their own, in priority order (the first takes the spare cell nearest the edge). */
export const POCKET_HOMES = ["fart", "sanmik"] as const;
/**
 * The fixed buttons' home cells: "b1" is the cell left of FIRE; "c<col>.<n>" the n-th cell up column col (0 = the edge
 * column). BONGO's home is HEAL's.
 */
export const FIGHT_HOMES: Readonly<Record<"second" | "dodge" | "special" | "ready" | "heal" | "action", string>> = {
  second: "b1",
  special: "c0.0",
  ready: "c0.1",
  dodge: "c1.0",
  heal: "c1.1",
  action: "c2.0",
};

export interface FightCell {
  id: string;
  cx: number;
  cy: number;
  size: number;
  /** Distance from the safe edge on the thumb's side to the centre. */
  in: number;
}

/** The fight's weapon chip: top, 24 px left of pause (research M16 / layout v2), its touch area up to the top edge. */
export function weaponChip(vp: Viewport, settings: Pick<PhoneSettings, "buttonSize">, pause: Placed): Placed {
  const s = controlScale(vp.h, settings.buttonSize);
  const w = Math.round(Math.max(120, 140 * s));
  const h = Math.round(Math.max(44, 44 * s));
  const right = pause.cx - pause.size / 2 - Math.max(16, 24 * s);
  const top = Math.max(safeRect(vp).y, 0) + 6 * s;
  const cx = right - w / 2;
  const cy = top + h / 2;
  return { cx, cy, size: h, w, h, hit: { x: cx - w / 2 - 10, y: 0, w: w + 20, h: cy + h / 2 + 10 } };
}

/** Does a round drawing (centre, radius) reach into a rectangle? */
export function circleHits(cx: number, cy: number, r: number, k: Rect): boolean {
  const dx = Math.max(k.x - cx, 0, cx - (k.x + k.w));
  const dy = Math.max(k.y - cy, 0, cy - (k.y + k.h));
  return dx * dx + dy * dy < r * r - 1e-9;
}

/**
 * Left-handed fights: the HUD's top-left block the cluster stays off (the canvas on the page, CSS px): the face, the
 * name and money, the bars and KREZZ / WONK beside them (UIScene's phone block, down to y 62 game px), and one line of
 * the status line under them (UIScene.phoneHudBlock draws it at 68, 110), whatever it says (combat.ts adds any more).
 */
export function hudKeepOut(canvas: Rect): Rect[] {
  const k = canvas.w / 960;
  const g = (x: number, y: number, w: number, h: number): Rect => ({ x: canvas.x + x * k, y: canvas.y + y * k, w: w * k, h: h * k });
  return [{ ...g(0, 0, 380, 62), y: 0, h: canvas.y + 62 * k }, g(68, 108, 230, 20)];
}

/** How far in a fight button may sit on this screen (FIGHT_REACH x the cluster's scale, minimum sizes included). */
export function fightReach(vp: Viewport, settings: Pick<PhoneSettings, "buttonSize">): number {
  const s = controlScale(vp.h, settings.buttonSize);
  return FIGHT_REACH * Math.max(s, MIN_CONTROL / CLUSTER_SIZE);
}

const mirrorRect = (vp: Viewport, r: Rect): Rect => ({ x: vp.w - r.x - r.w, y: r.y, w: r.w, h: r.h });

/**
 * The fight cluster's cells, worked out right-handed (the caller mirrors): FIRE's corner, the cell left of it, and three
 * columns from the edge in, each starting as low as FIRE and that cell allow (12 px clear) and stacking upward; every
 * cell clear of `keepOut` (right-handed page rects), inside the safe area and within FIGHT_REACH.
 */
export function fightGrid(vp: Viewport, settings: Pick<PhoneSettings, "buttonSize">, keepOut: readonly Rect[] = []): { prime: Placed; cells: FightCell[]; gap: number } {
  const s = controlScale(vp.h, settings.buttonSize);
  const prime = placeControl(vp, SLOTS.prime, { leftHanded: false, buttonSize: settings.buttonSize });
  const size = Math.max(MIN_CONTROL, CLUSTER_SIZE * s);
  const r = size / 2;
  const gap = CLUSTER_GAP * Math.max(1, s);
  const pitch = size + gap;
  const safe = safeRect(vp);
  const right = safe.x + safe.w;
  const bottom = safe.y + safe.h;
  let x0 = right - Math.max(CLUSTER_EDGE * s, r + 4);
  // (one edge column for every height: clear of the Dynamic Island band wherever the screen has a notch or cutout)
  if (islandSides(vp)) x0 = Math.min(x0, vp.w - islandGap(vp) - r);
  const reach = fightReach(vp, settings);
  const cells: FightCell[] = [];
  const ok = (cx: number, cy: number) =>
    cy - r >= safe.y - 1e-9 &&
    cy + r <= bottom + 1e-9 &&
    cx - r >= safe.x &&
    right - cx <= reach + 1e-6 &&
    // (keepOut is touch areas, pause's and the chip's 10 px slop included: the round drawing stays out of them)
    !keepOut.some((k) => circleHits(cx, cy, r, k));
  // the cell left of FIRE, its bottom level with FIRE's
  const yb = Math.min(prime.cy + prime.size / 2 - r, bottom - r);
  const xb = prime.cx - prime.size / 2 - gap - r;
  const blockers: { cx: number; cy: number; r: number }[] = [{ cx: prime.cx, cy: prime.cy, r: prime.size / 2 }];
  if (ok(xb, yb)) {
    cells.push({ id: "b1", cx: xb, cy: yb, size, in: right - xb });
    blockers.push({ cx: xb, cy: yb, r });
  }
  // the columns: each starts as low as FIRE and that cell allow, then stacks upward a pitch at a time
  for (let col = 0; col < 3; col++) {
    const cx = x0 - col * pitch;
    let cy = bottom - r;
    for (const b of blockers) {
      const need = b.r + r + gap;
      const dx = Math.abs(cx - b.cx);
      if (dx < need) cy = Math.min(cy, b.cy - Math.sqrt(need * need - dx * dx));
    }
    for (let n = 0; n < 8 && cy - r >= safe.y - 1e-9; n++, cy -= pitch) if (ok(cx, cy)) cells.push({ id: `c${col}.${n}`, cx, cy, size, in: right - cx });
  }
  return { prime, cells, gap };
}

/**
 * Where each fight button goes now. `shown`: the buttons that are up (FIRE / JUMP always has the corner).
 * `keepOut`: page rects nothing may be drawn on (the touch areas of pause, the weapon chip and the fullscreen offer;
 * left-handed, the HUD's top-left block), as they are on the page. Buttons that are not up get their home too (for
 * the Controls picture, and so a button popping in lands where it always does).
 */
export function fightCluster(
  vp: Viewport,
  settings: Pick<PhoneSettings, "leftHanded" | "buttonSize">,
  shown: Iterable<FightRole>,
  keepOut: readonly Rect[] = [],
): Partial<Record<FightRole, Placed>> {
  const up = new Set(shown);
  const ko = settings.leftHanded ? keepOut.map((k) => mirrorRect(vp, k)) : [...keepOut];
  const { prime, cells, gap } = fightGrid(vp, settings, ko);
  const byId = new Map(cells.map((c) => [c.id, c]));
  const nearest = (a: FightCell, b: FightCell) => a.in - b.in || b.cy - a.cy;
  // the homes: the fixed buttons' cells, then the pocket's (the cells left over, nearest the edge first)
  const homeOf = new Map<FightRole, FightCell>();
  for (const [role, id] of Object.entries(FIGHT_HOMES) as [FightRole, string][]) {
    const c = byId.get(id);
    if (c) homeOf.set(role, c);
  }
  const homes = new Set(Object.values(FIGHT_HOMES));
  const spare = cells.filter((c) => !homes.has(c.id)).sort(nearest);
  POCKET_HOMES.forEach((role, i) => {
    if (spare[i]) homeOf.set(role, spare[i]);
  });
  // (a fizzy bongo only shows while HEAL doesn't: one drink button, one place)
  const healHome = homeOf.get("heal");
  if (healHome) homeOf.set("bongo", healHome);
  const core = (Object.keys(FIGHT_HOMES) as FightRole[]).filter((r) => up.has(r));
  const pocket = POCKET_ROLES.filter((r) => up.has(r));
  const out: Partial<Record<FightRole, FightCell>> = {};
  const taken = new Set<string>();
  const take = (role: FightRole, c: FightCell) => {
    out[role] = c;
    taken.add(c.id);
  };
  const free = () => cells.filter((c) => !taken.has(c.id)).sort(nearest);
  const placedNow = (): FightCell[] => [{ id: "prime", cx: prime.cx, cy: prime.cy, size: prime.size, in: 0 }, ...(Object.values(out) as FightCell[])];
  const size = cells[0]?.size ?? Math.max(MIN_CONTROL, CLUSTER_SIZE * controlScale(vp.h, settings.buttonSize));
  // the fixed buttons that are up: home; else (more buttons than cells) a free cell nearest the edge; else a gap
  for (const role of core) {
    const h = homeOf.get(role);
    if (h && !taken.has(h.id)) take(role, h);
  }
  for (const role of core) {
    if (out[role]) continue;
    const f = free()[0];
    const spot = f ?? squeeze(vp, settings, placedNow(), ko, gap, size) ?? squeeze(vp, settings, placedNow(), ko, gap, POCKET_MIN) ?? squeeze(vp, settings, placedNow(), ko, 4, POCKET_MIN);
    if (spot) take(role, spot);
  }
  // the pocket: each at home while there are cells enough; with more pocket buttons up than cells left, all of them
  // are drawn smaller (POCKET_MIN) and fitted in the room the fixed buttons leave, nearest the edge, never further in
  if (pocket.length <= free().length) {
    for (const role of pocket) {
      const h = homeOf.get(role);
      if (h && !taken.has(h.id)) take(role, h);
    }
    for (const role of pocket) if (!out[role]) take(role, free()[0]);
  } else {
    for (const role of pocket) {
      // (12 px clear where it can be; if not, the last resort is a tighter gap rather than no button)
      const spot = squeeze(vp, settings, placedNow(), ko, gap, POCKET_MIN) ?? squeeze(vp, settings, placedNow(), ko, 4, POCKET_MIN);
      if (spot) take(role, spot);
    }
  }
  // buttons that are not up: their home (where they will pop in)
  for (const role of [...Object.keys(FIGHT_HOMES), ...POCKET_ROLES] as FightRole[]) if (!out[role] && homeOf.get(role)) out[role] = homeOf.get(role);
  const fin = (cx: number, cy: number, sz: number): Placed => {
    // (the shared touch area stops under pause / the chip, so their own touch areas stay theirs)
    let t = -Infinity;
    for (const k of ko) if (k.x < cx + sz / 2 + GAP_REACH && cx - sz / 2 - GAP_REACH < k.x + k.w && k.y + k.h <= cy - sz / 2 + 1e-9) t = Math.max(t, k.y + k.h);
    const x = settings.leftHanded ? vp.w - cx : cx;
    const p: Placed = { cx: x, cy, size: sz, hit: hitRect(vp, x, cy, sz) };
    if (Number.isFinite(t) && t > cy - sz / 2 - GAP_REACH) p.clipTop = t;
    return p;
  };
  const res: Partial<Record<FightRole, Placed>> = { prime: fin(prime.cx, prime.cy, prime.size) };
  for (const [role, c] of Object.entries(out) as [FightRole, FightCell][]) res[role] = fin(c.cx, c.cy, c.size);
  return res;
}

/** A gap for a button of this size: the free spot nearest the edge (lowest first), clear of every drawn button. */
function squeeze(vp: Viewport, settings: Pick<PhoneSettings, "buttonSize">, placed: readonly FightCell[], keepOut: readonly Rect[], gap: number, size: number): FightCell | null {
  const safe = safeRect(vp);
  const right = safe.x + safe.w;
  const reach = fightReach(vp, settings);
  const r = size / 2;
  const g = gap;
  const island = islandSides(vp);
  for (let inn = r + 4; inn <= reach + 1e-6; inn += 2) {
    const cx = right - inn;
    if (island && cx + r > vp.w - islandGap(vp)) continue;
    for (let cy = safe.y + safe.h - r - 4; cy - r >= safe.y; cy -= 2) {
      if (keepOut.some((k) => circleHits(cx, cy, r, k))) continue;
      if (placed.some((p) => Math.hypot(p.cx - cx, p.cy - cy) < p.size / 2 + r + g)) continue;
      return { id: `gap${Math.round(inn)},${Math.round(cy)}`, cx, cy, size, in: inn };
    }
  }
  return null;
}

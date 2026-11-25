import { describe, expect, it } from "vitest";
import {
  BOTTOM_CLEAR,
  controlScale,
  followBase,
  ghostStick,
  HIT_SLOP,
  ISLAND_GAP,
  ISLAND_GRAZE,
  layoutSlots,
  MIN_CONTROL,
  placeControl,
  safeRect,
  SLOTS,
  stickGeometry,
  stickVector,
  outsideZone,
  overlaps,
  stickZone,
  type Viewport,
} from "../src/game/mobile/layout";
import { DEFAULT_PHONE_SETTINGS } from "../src/game/mobile/settings";

/** iPhone 14 landscape in a home-screen app: 47 px each side (notch / rounded corners), 21 px home indicator. */
const IPHONE: Viewport = { w: 844, h: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 } };
/** The same phone turned the other way round (the notch on the right). */
const IPHONE_FLIPPED: Viewport = { w: 844, h: 390, insets: { top: 0, right: 47, bottom: 21, left: 0 } };
const SAFARI_BARS: Viewport = { w: 750, h: 340, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
const ANDROID: Viewport = { w: 740, h: 360, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
const BIG: Viewport = { w: 932, h: 430, insets: { top: 0, right: 59, bottom: 21, left: 59 } };
const M = DEFAULT_PHONE_SETTINGS;

describe("phone layout: scale", () => {
  it("is 1 on the 390 px design height, and clamps for short and tall screens", () => {
    expect(controlScale(390, "M")).toBe(1);
    expect(controlScale(300, "M")).toBe(0.85);
    expect(controlScale(600, "M")).toBe(1.15);
    expect(controlScale(390, "S")).toBe(0.85);
    expect(controlScale(390, "L")).toBe(1.2);
  });
});

describe("phone layout: safe area", () => {
  it("uses the larger side inset on both sides, and keeps the home-indicator strip clear", () => {
    expect(safeRect(IPHONE)).toEqual({ x: 47, y: 0, w: 750, h: 369 });
    // (turned round: the same safe area, so nothing jumps)
    expect(safeRect(IPHONE_FLIPPED)).toEqual(safeRect(IPHONE));
    // no insets at all: still the 21 px strip
    expect(safeRect(ANDROID)).toEqual({ x: 0, y: 0, w: 740, h: 360 - BOTTOM_CLEAR });
  });
});

describe("phone layout: controls", () => {
  it("ACTION sits in the prime corner on an iPhone 14 (research layout v2: (745, 317), 84 px)", () => {
    const p = placeControl(IPHONE, SLOTS.prime, M);
    expect(p.cx).toBe(745);
    expect(p.cy).toBe(317);
    expect(p.size).toBe(84);
  });

  it("pause is top right, inside the safe edge", () => {
    const p = placeControl(IPHONE, SLOTS.pause, M);
    expect(p.cx + p.size / 2).toBeLessThanOrEqual(797);
    expect(p.cy - p.size / 2).toBe(6);
  });

  it("the touchable area is the drawing plus 10 px each side, never in the bottom 21 px", () => {
    for (const vp of [IPHONE, SAFARI_BARS, ANDROID, BIG]) {
      const all = layoutSlots(vp, M);
      for (const p of Object.values(all)) {
        expect(p.hit.y + p.hit.h).toBeLessThanOrEqual(vp.h - BOTTOM_CLEAR + 1e-9);
        expect(p.hit.x).toBeGreaterThanOrEqual(0);
        expect(p.hit.x + p.hit.w).toBeLessThanOrEqual(vp.w);
        expect(p.hit.w).toBeLessThanOrEqual(p.size + 2 * HIT_SLOP + 1e-9);
      }
      const a = all.prime;
      expect(a.hit.x).toBeCloseTo(a.cx - a.size / 2 - HIT_SLOP);
      // (with no side inset the slop on the screen-edge side is cut off at the edge itself)
      if (vp.insets.right > HIT_SLOP) expect(a.hit.w).toBeCloseTo(a.size + 2 * HIT_SLOP);
      else expect(a.hit.x + a.hit.w).toBeLessThanOrEqual(vp.w);
    }
  });

  it("nothing is ever drawn under 52 px, whatever the screen or size setting", () => {
    for (const vp of [IPHONE, SAFARI_BARS, ANDROID, BIG, { w: 640, h: 300, insets: { top: 0, right: 0, bottom: 0, left: 0 } }]) {
      for (const size of ["S", "M", "L"] as const) {
        for (const p of Object.values(layoutSlots(vp, { leftHanded: false, buttonSize: size }))) expect(p.size).toBeGreaterThanOrEqual(MIN_CONTROL);
      }
    }
  });

  it("every drawing stays inside the safe area", () => {
    for (const vp of [IPHONE, IPHONE_FLIPPED, SAFARI_BARS, ANDROID, BIG]) {
      const safe = safeRect(vp);
      for (const lh of [false, true]) {
        for (const p of Object.values(layoutSlots(vp, { leftHanded: lh, buttonSize: "L" }))) {
          expect(p.cx - p.size / 2).toBeGreaterThanOrEqual(safe.x - 1e-9);
          expect(p.cx + p.size / 2).toBeLessThanOrEqual(safe.x + safe.w + 1e-9);
          expect(p.cy - p.size / 2).toBeGreaterThanOrEqual(safe.y - 1e-9);
          expect(p.cy + p.size / 2).toBeLessThanOrEqual(safe.y + safe.h + 1e-9);
        }
      }
    }
  });

  it("with a notch, nothing is drawn within 60 px of a short edge in the middle band (the Dynamic Island)", () => {
    for (const vp of [IPHONE, IPHONE_FLIPPED, BIG]) {
      for (const lh of [false, true]) {
        for (const size of ["S", "M", "L"] as const) {
          for (const p of Object.values(layoutSlots(vp, { leftHanded: lh, buttonSize: size }))) {
            const r = p.size / 2;
            if (p.cy + r > vp.h * 0.3 + ISLAND_GRAZE && p.cy - r < vp.h * 0.7 - ISLAND_GRAZE) {
              expect(p.cx - r).toBeGreaterThanOrEqual(ISLAND_GAP - 1e-9);
              expect(vp.w - (p.cx + r)).toBeGreaterThanOrEqual(ISLAND_GAP - 1e-9);
            }
          }
        }
      }
    }
  });

  it("Android cutouts (small side insets) push a control only past the inset, never into its neighbour (F5)", () => {
    const gap = (a: { cx: number; cy: number; size: number }, b: { cx: number; cy: number; size: number }) => Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.size / 2 - b.size / 2;
    const ids = ["prime", "left", "upLeft", "up", "heal", "combatAction"] as const;
    for (const [w, h, inset] of [
      [740, 360, 16],
      [740, 360, 24],
      [740, 360, 32],
      [740, 360, 40],
      [844, 390, 30],
      [915, 412, 28],
    ]) {
      const vp: Viewport = { w, h, insets: { top: 0, left: inset, right: inset, bottom: 0 } };
      for (const size of ["M", "L"] as const) {
        const s = layoutSlots(vp, { leftHanded: false, buttonSize: size });
        for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) expect(gap(s[ids[a]], s[ids[b]])).toBeGreaterThanOrEqual(12);
        // READY's own slot (placed again in a fight round pause and SPECIAL) and HEAL
        if (size === "M") expect(gap(s.ready, s.heal)).toBeGreaterThanOrEqual(12);
        // still clear of the cutout: past the inset, with a margin
        for (const p of Object.values(s)) expect(vp.w - (p.cx + p.size / 2)).toBeGreaterThanOrEqual(inset);
      }
    }
  });

  it("the fight's fullscreen offer sits 12 px under pause on every phone height (F8)", () => {
    for (const vp of [ANDROID, SAFARI_BARS, { ...SAFARI_BARS, w: 844 }, IPHONE, BIG]) {
      for (const size of ["S", "M", "L"] as const) {
        const s = layoutSlots(vp, { leftHanded: false, buttonSize: size });
        expect(s.fullscreenFight.cy - s.fullscreenFight.size / 2 - (s.pause.cy + s.pause.size / 2)).toBeGreaterThanOrEqual(12 - 1e-9);
      }
    }
  });

  it("without a notch the band is not needed: ACTION keeps the corner on a short Safari screen", () => {
    const p = placeControl(SAFARI_BARS, SLOTS.prime, M);
    const s = controlScale(340, "M");
    expect(p.cx).toBeCloseTo(750 - 52 * s);
  });

  it("left-handed mirrors the thumb controls but leaves pause top right", () => {
    const r = layoutSlots(IPHONE, { leftHanded: false, buttonSize: "M" });
    const l = layoutSlots(IPHONE, { leftHanded: true, buttonSize: "M" });
    expect(l.prime.cx).toBeCloseTo(IPHONE.w - r.prime.cx);
    expect(l.prime.cy).toBe(r.prime.cy);
    expect(l.walkExtra.cx).toBeCloseTo(IPHONE.w - r.walkExtra.cx);
    expect(l.pause.cx).toBe(r.pause.cx);
  });

  it("size L is bigger than M is bigger than S, for the big controls", () => {
    const s = placeControl(IPHONE, SLOTS.prime, { leftHanded: false, buttonSize: "S" });
    const m = placeControl(IPHONE, SLOTS.prime, { leftHanded: false, buttonSize: "M" });
    const l = placeControl(IPHONE, SLOTS.prime, { leftHanded: false, buttonSize: "L" });
    expect(s.size).toBeLessThan(m.size);
    expect(m.size).toBeLessThan(l.size);
  });
});

describe("phone layout: the stick", () => {
  it("its zone is the left 45% including the gutter, under the HUD strip, above the home-indicator strip", () => {
    const z = stickZone(IPHONE, M);
    expect(z.x).toBe(0);
    expect(z.w).toBe(Math.round(844 * 0.45));
    expect(z.y).toBe(78);
    expect(z.y + z.h).toBe(390 - 21);
    const zl = stickZone(IPHONE, { leftHanded: true });
    expect(zl.x + zl.w).toBe(844);
  });

  it("dead zone, then speed ramps from zero, full at 60% of the travel", () => {
    const g = stickGeometry(390, "M");
    expect(g.base).toBe(112);
    expect(stickVector(5, 0, g)).toEqual({ x: 0, y: 0, mag: 0 });
    expect(stickVector(g.dead + 0.001, 0, g).mag).toBeLessThan(0.01);
    expect(stickVector(g.full, 0, g).mag).toBe(1);
    expect(stickVector(0, -200, g)).toEqual({ x: 0, y: -1, mag: 1 });
    const half = stickVector((g.dead + g.full) / 2, 0, g);
    expect(half.mag).toBeCloseTo(0.5);
    // radial, not per axis: a diagonal has the same magnitude
    const d = stickVector(30 / Math.SQRT2, 30 / Math.SQRT2, g);
    expect(d.mag).toBeCloseTo(stickVector(30, 0, g).mag);
  });

  it("the base follows a thumb that goes past the rim", () => {
    expect(followBase({ x: 100, y: 100 }, { x: 130, y: 100 }, 56)).toEqual({ x: 100, y: 100 });
    const b = followBase({ x: 100, y: 100 }, { x: 200, y: 100 }, 56);
    expect(b.x).toBeCloseTo(144);
    expect(b.y).toBe(100);
  });

  it("the idle hint stick sits bottom left on screen (mirrored for left-handed)", () => {
    const g = ghostStick(IPHONE, M);
    expect(g).toEqual({ x: 150, y: 290 });
    expect(ghostStick(IPHONE, { leftHanded: true, buttonSize: "M" }).x).toBe(844 - 150);
    const a = ghostStick(ANDROID, M);
    expect(a.x - 56).toBeGreaterThanOrEqual(0);
  });
});

// (the phone settings store is tested in mobileSettings.test.ts)

describe("phone layout: the side-room stick and the tap areas (round 1)", () => {
  it("an \"x\" stick reads only left and right, full speed at 35% of the travel (research M6)", () => {
    const g = stickGeometry(390, "M", "x");
    expect(g.axis).toBe("x");
    expect(g.full).toBeCloseTo(g.travel * 0.35);
    expect(stickVector(0, -200, g)).toEqual({ x: 0, y: 0, mag: 0 });
    expect(stickVector(g.full, -50, g)).toEqual({ x: 1, y: 0, mag: 1 });
    expect(stickVector(-g.full, 30, g).x).toBe(-1);
    expect(stickVector(5, 0, g).mag).toBe(0);
    // the walking stick is unchanged
    expect(stickGeometry(390, "M").full).toBeCloseTo(stickGeometry(390, "M").travel * 0.6);
  });

  it("a tap area keeps only its part outside the stick zone (inside, the zone's own tap rule decides) (R1)", () => {
    const zone = { x: 0, y: 78, w: 380, h: 291 };
    // the prompt bubble wholly inside the zone: nothing outside it
    expect(outsideZone({ x: 120, y: 200, w: 100, h: 30 }, zone)).toBe(null);
    // straddling the zone's right edge: the strip beside it
    expect(outsideZone({ x: 350, y: 200, w: 100, h: 30 }, zone)).toEqual({ x: 380, y: 200, w: 70, h: 30 });
    // above the zone (the HUD strip): untouched
    expect(outsideZone({ x: 100, y: 20, w: 100, h: 30 }, zone)).toEqual({ x: 100, y: 20, w: 100, h: 30 });
    // reaching down into the zone from above: the part above it
    expect(outsideZone({ x: 100, y: 40, w: 100, h: 60 }, zone)).toEqual({ x: 100, y: 40, w: 100, h: 38 });
    // left-handed (the zone on the right): the strip to its left
    expect(outsideZone({ x: 440, y: 200, w: 40, h: 30 }, { x: 464, y: 78, w: 380, h: 291 })).toEqual({ x: 440, y: 200, w: 24, h: 30 });
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, null)).toBe(false);
  });
});

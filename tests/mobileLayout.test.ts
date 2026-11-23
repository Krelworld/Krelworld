import { afterEach, describe, expect, it } from "vitest";
import {
  BOTTOM_CLEAR,
  controlScale,
  followBase,
  ghostStick,
  HIT_SLOP,
  ISLAND_GAP,
  layoutSlots,
  MIN_CONTROL,
  placeControl,
  safeRect,
  SLOTS,
  stickGeometry,
  stickVector,
  stickZone,
  type Viewport,
} from "../src/game/mobile/layout";
import { DEFAULT_PHONE_SETTINGS, normalizePhoneSettings, onPhoneSettingsChange, phoneSettings, resetPhoneSettingsForTests, updatePhoneSettings, usePhoneSettingsStore } from "../src/game/mobile/settings";

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

  it("nothing is drawn within 60 px of a short edge in the middle band (the Dynamic Island)", () => {
    for (const vp of [IPHONE, SAFARI_BARS, ANDROID, BIG]) {
      for (const lh of [false, true]) {
        for (const p of Object.values(layoutSlots(vp, { leftHanded: lh, buttonSize: "M" }))) {
          const r = p.size / 2;
          if (p.cy + r > vp.h * 0.3 && p.cy - r < vp.h * 0.7) {
            expect(p.cx - r).toBeGreaterThanOrEqual(ISLAND_GAP - 1e-9);
            expect(vp.w - (p.cx + r)).toBeGreaterThanOrEqual(ISLAND_GAP - 1e-9);
          }
        }
      }
    }
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

describe("phone settings", () => {
  afterEach(() => resetPhoneSettingsForTests());

  it("defaults: right-handed, medium, 30%", () => {
    expect(phoneSettings()).toEqual({ leftHanded: false, buttonSize: "M", opacity: 0.3 });
  });

  it("cleans up whatever it is given", () => {
    expect(normalizePhoneSettings(null)).toEqual(DEFAULT_PHONE_SETTINGS);
    expect(normalizePhoneSettings({ leftHanded: "yes", buttonSize: "XL", opacity: 5 })).toEqual({ leftHanded: false, buttonSize: "M", opacity: 0.8 });
    expect(normalizePhoneSettings({ leftHanded: true, buttonSize: "S", opacity: 0 })).toEqual({ leftHanded: true, buttonSize: "S", opacity: 0.2 });
  });

  it("tells listeners about changes and saves them through the store part 2 provides", () => {
    const seen: unknown[] = [];
    const saved: unknown[] = [];
    onPhoneSettingsChange((s) => seen.push({ ...s }));
    usePhoneSettingsStore({ load: () => ({ leftHanded: true }), save: (s) => saved.push({ ...s }) });
    expect(phoneSettings().leftHanded).toBe(true);
    updatePhoneSettings({ buttonSize: "L" });
    updatePhoneSettings({ buttonSize: "L" });
    expect(seen).toEqual([
      { leftHanded: true, buttonSize: "M", opacity: 0.3 },
      { leftHanded: true, buttonSize: "L", opacity: 0.3 },
    ]);
    expect(saved).toEqual([{ leftHanded: true, buttonSize: "L", opacity: 0.3 }]);
  });
});

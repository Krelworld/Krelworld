import { describe, expect, it } from "vitest";
import {
  BACKDROP_FRAC,
  distToBox,
  flooredSize,
  growBy,
  LARGE_TEXT_K,
  MIN_HIT_CSS,
  MIN_TEXT_CSS,
  minTextCss,
  parseReadParam,
  readabilityWanted,
  snapTarget,
  textFloorPx,
  usableFactor,
} from "../src/game/mobile/readable";

describe("readability: the switch", () => {
  it("?mobileread=1 / 0 in the address; absent = follow the setting", () => {
    expect(parseReadParam("")).toBe(null);
    expect(parseReadParam("?debug")).toBe(null);
    expect(parseReadParam("?mobileread=1")).toBe(true);
    expect(parseReadParam("?mobileread")).toBe(true);
    expect(parseReadParam("?mobile=1&mobileread=on")).toBe(true);
    expect(parseReadParam("?mobileread=0")).toBe(false);
    expect(parseReadParam("?mobileread=off")).toBe(false);
    expect(readabilityWanted(false, null)).toBe(false);
    expect(readabilityWanted(true, null)).toBe(true);
    expect(readabilityWanted(false, true)).toBe(true);
    expect(readabilityWanted(true, false)).toBe(false);
  });

  it("ships with the floor at 11 CSS px (13.75 large) and taps at 44 (stage 2, research M7)", () => {
    expect(MIN_TEXT_CSS).toBe(11);
    expect(minTextCss("normal")).toBe(11);
    expect(minTextCss("large")).toBe(11 * LARGE_TEXT_K);
    expect(MIN_HIT_CSS).toBe(44);
    expect(BACKDROP_FRAC).toBeLessThan(0.5);
  });
});

describe("readability: the font floor", () => {
  it("is worked out from the real canvas scale", () => {
    // iPhone 14 home-screen app (k 0.722), small Android (0.667), Safari with bars (0.630)
    expect(textFloorPx(0.722, 1, 10)).toBe(14);
    expect(textFloorPx(0.667, 1, 10)).toBe(15);
    expect(textFloorPx(0.63, 1, 10)).toBe(16);
    // a laptop-sized canvas would need nothing raised under 10 px
    expect(textFloorPx(1.333, 1, 10)).toBe(8);
    for (const k of [0.6, 0.63, 0.667, 0.7, 0.722, 0.75, 0.8]) for (const f of [0.5, 1, 1.5, 2]) expect(textFloorPx(k, f, 10) * k * f).toBeGreaterThanOrEqual(10 - 1e-9);
  });

  it("takes the text's own scale and the camera zoom into account", () => {
    expect(textFloorPx(0.722, 2, 10)).toBe(7);
    expect(textFloorPx(0.722, 0.5, 10)).toBe(28);
  });

  it("raises only what is too small, and only when on", () => {
    expect(flooredSize(9, 14, true)).toBe(14);
    expect(flooredSize(20, 14, true)).toBe(20);
    expect(flooredSize(9, 14, false)).toBe(9);
  });

  it("treats tiny scales as effects (pop-ins), not reading text", () => {
    expect(usableFactor(0)).toBe(1);
    expect(usableFactor(0.2)).toBe(1);
    expect(usableFactor(0.5)).toBe(0.5);
    expect(usableFactor(1.4)).toBe(1.4);
    expect(usableFactor(9)).toBe(3);
    expect(usableFactor(NaN)).toBe(1);
  });

  it("falls back to a sane scale before the canvas is measured", () => {
    expect(textFloorPx(0, 1, 10)).toBe(14);
  });
});

describe("readability: the tap snap", () => {
  const minGame = 44 / 0.722; // 61 game px
  it("grows small boxes about their middle to the minimum, never shrinks", () => {
    expect(growBy({ w: 289, h: 22 }, minGame, minGame).ex).toBe(0);
    expect(growBy({ w: 289, h: 22 }, minGame, minGame).ey).toBeCloseTo((minGame - 22) / 2);
    expect(growBy({ w: 100, h: 100 }, minGame, minGame)).toEqual({ ex: 0, ey: 0 });
  });

  it("measures the distance to a box", () => {
    const b = { x: 0, y: 0, w: 10, h: 10 };
    expect(distToBox(b, 5, 5)).toBe(0);
    expect(distToBox(b, 13, 14)).toBe(5);
  });

  it("a touch in the gap between two rows goes to the nearer one; outside both grown areas, to nothing", () => {
    // two 22 px rows 25 px apart (the pause menu)
    const rows = [
      { id: "SAVE", box: { x: 335, y: 400, w: 289, h: 22 } },
      { id: "QUIT", box: { x: 335, y: 425, w: 289, h: 22 } },
    ];
    expect(snapTarget(rows, 480, 423, minGame, minGame)).toBe("SAVE");
    expect(snapTarget(rows, 480, 424.5, minGame, minGame)).toBe("QUIT");
    expect(snapTarget(rows, 480, 462, minGame, minGame)).toBe("QUIT");
    expect(snapTarget(rows, 480, 520, minGame, minGame)).toBe(null);
  });

  it("a small close button gets a 44 CSS px tap area without moving", () => {
    const x = [{ id: "close", box: { x: 900, y: 20, w: 25, h: 21 } }];
    // 15 game px below its bottom edge: inside the grown area
    expect(snapTarget(x, 912, 56, minGame, minGame)).toBe("close");
    expect(snapTarget(x, 912, 75, minGame, minGame)).toBe(null);
  });

  it("controls that are already big enough are left alone", () => {
    expect(snapTarget([{ id: "big", box: { x: 0, y: 0, w: 200, h: 80 } }], 100, 90, minGame, minGame)).toBe(null);
  });
});

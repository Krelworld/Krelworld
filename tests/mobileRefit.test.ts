// The phone shell checks the fit again (s4b): the user, opening the Home Screen app on an iPhone, once got the game in a
// smaller box with a black strip along the bottom, which fixed itself later.
import { describe, expect, it } from "vitest";
import { boxStale, FIT_CHECK_MS, fitStale, REFIT_MS } from "../src/game/mobile/shell";

describe("phone shell: the fit, checked again", () => {
  it("is checked at once and a few times more after launch, a rotation, pageshow and coming back", () => {
    expect(REFIT_MS).toEqual([0, 250, 750, 1500]);
    expect(FIT_CHECK_MS).toBeLessThanOrEqual(500);
  });

  it("a canvas drawn at FIT's size for its box is right; one fitted to an older, shorter box is not", () => {
    // iPhone 14 landscape: 844x390, FIT gives 693.3 x 390
    expect(fitStale({ w: 693.3, h: 390 }, { w: 844, h: 390 })).toBe(false);
    // fitted while the box was 340 tall (the black strip along the bottom)
    expect(fitStale({ w: 604.4, h: 340 }, { w: 844, h: 390 })).toBe(true);
    // a wide box: FIT by the height; a narrow one: by the width
    expect(fitStale({ w: 960, h: 540 }, { w: 1200, h: 540 })).toBe(false);
    expect(fitStale({ w: 480, h: 270 }, { w: 480, h: 600 })).toBe(false);
    // no box yet: nothing to say
    expect(fitStale({ w: 0, h: 0 }, { w: 0, h: 0 })).toBe(false);
  });

  it("the game's box is short of the screen (100dvh worked out too early) only when it really differs", () => {
    expect(boxStale({ w: 844, h: 390 }, { w: 844, h: 390 })).toBe(false);
    expect(boxStale({ w: 844, h: 389.5 }, { w: 844, h: 390 })).toBe(false);
    expect(boxStale({ w: 844, h: 356 }, { w: 844, h: 390 })).toBe(true);
    expect(boxStale({ w: 844, h: 390 }, { w: 0, h: 0 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { WHACK_COST, WHACK_JACKPOT, whackKrokens } from "../src/game/systems/kreddle";

describe("Whack-a-Drongus payout", () => {
  it("scales with the score, capped, with a high-score bonus", () => {
    expect(whackKrokens(0, false)).toBe(0);
    expect(whackKrokens(0, true)).toBe(0);
    expect(whackKrokens(199, false)).toBe(0);
    expect(whackKrokens(200, false)).toBe(1);
    expect(whackKrokens(2000, false)).toBe(10);
    expect(whackKrokens(2000, true)).toBe(13);
    expect(whackKrokens(999999, false)).toBe(25);
    expect(whackKrokens(-50, false)).toBe(0);
  });

  it("never pays more than it costs to get rich quick", () => {
    expect(WHACK_COST).toBeGreaterThan(0);
    expect(WHACK_JACKPOT.coins).toBeLessThan(WHACK_COST * 3);
  });
});

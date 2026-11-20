import { describe, expect, it } from "vitest";
import { newGameState } from "../src/game/systems/state";
import { activeTrail, settleOldTrails, trailFor, trailObjective, TRAILS } from "../src/game/systems/trails";
import { CHAPTERS } from "../src/content/chapters/chapters";

// The chapter 2 and 4 clue trails were taken out (overkill); the system is kept, empty.
describe("explore-before-the-dungeon trails (none active)", () => {
  it("no chapter has a trail, and no chapter step waits on one", () => {
    expect(TRAILS.length).toBe(0);
    for (let n = 1; n <= 7; n++) expect(trailFor(n)).toBeNull();
    for (const ch of CHAPTERS) expect(ch.steps.some((st) => st.id === "s_trail")).toBe(false);
  });

  it("a save mid-way through an old trail just carries on (nothing active, nothing blocking)", () => {
    for (const n of [2, 4]) {
      const s = newGameState("FLENKY");
      s.chapter = n;
      Object.assign(s.flags, { trails_v1: true, trail_ch2_receipts_start: true, trail_ch4_wrappers_start: true });
      settleOldTrails(s);
      expect(activeTrail(s)).toBeNull();
      expect(trailObjective(s)).toBeNull();
    }
  });
});

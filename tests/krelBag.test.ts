import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));
vi.mock("../src/game/audio/Synth", () => ({ synth: { play: () => {} } }));
vi.mock("../src/game/gfx/Vfx", () => ({ hasVfx: () => false, vfx: () => {} }));
vi.mock("../src/game/combat/KrelCinema", () => ({ krelCinema: () => {} }));
vi.mock("../src/game/combat/KrelArt", () => ({ Actor: class {}, Victim: class {}, bit: () => {}, prop: () => {}, MEATY: [] }));
const meta: Record<string, unknown> = { settings: { gore: true } };
vi.mock("../src/game/G", () => ({ G: { meta, saveMeta: () => {} } }));

// Kreltalities come out of a shuffle bag: never a repeat until you've seen them all.
describe("Kreltality picking", () => {
  it("shows every finisher once before any repeats, across several cycles", async () => {
    const { pick, FINISHERS } = await import("../src/game/combat/Kreltality");
    const { BOSS_ONLY } = await import("../src/game/combat/KrelFinishers");
    const boss = { id: "brand" } as Parameters<typeof pick>[0];
    const n = FINISHERS.length;
    let prev: string | undefined;
    for (let cycle = 0; cycle < 4; cycle++) {
      const got = Array.from({ length: n }, () => pick(boss));
      expect(new Set(got).size).toBe(n);
      expect(got[0]).not.toBe(prev); // no back-to-back across the refill
      prev = got[n - 1];
    }
    // without a boss, boss-only ones never come up, and the rest still don't repeat
    meta.krelSeen = [];
    const pool = FINISHERS.filter((f) => !(BOSS_ONLY as string[]).includes(f));
    const got = Array.from({ length: pool.length }, () => pick({} as Parameters<typeof pick>[0]));
    expect(new Set(got).size).toBe(pool.length);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));
vi.mock("../src/game/audio/Synth", () => ({ synth: { play: () => {} } }));
vi.mock("../src/game/gfx/Vfx", () => ({ hasVfx: () => false, vfx: () => {} }));
vi.mock("../src/game/combat/KrelCinema", () => ({ krelCinema: () => {} }));
vi.mock("../src/game/combat/KrelArt", () => ({ Actor: class {}, Victim: class {}, bit: () => {}, prop: () => {}, MEATY: [] }));
const meta: { settings: { gore: boolean }; krelSeen?: string[] } = { settings: { gore: true } };
vi.mock("../src/game/G", () => ({ G: { meta, saveMeta: () => {} } }));

// Kreltalities come out of a shuffle bag: never a repeat until you've seen them all.
describe("Kreltality picking", () => {
  it("shows every finisher (GET WELL SOON included) once before any repeats, across several cycles", async () => {
    const { pick, FINISHERS } = await import("../src/game/combat/Kreltality");
    const n = FINISHERS.length;
    expect(FINISHERS).toContain("asbestos");
    let prev: string | undefined;
    for (let cycle = 0; cycle < 4; cycle++) {
      const got = Array.from({ length: n }, () => pick());
      expect(new Set(got).size).toBe(n);
      expect(got[0]).not.toBe(prev); // no back-to-back across the refill
      prev = got[n - 1];
    }
  });
  it("with gore off, cycles the tame set without repeats", async () => {
    const { pick } = await import("../src/game/combat/Kreltality");
    const { ELEGANT } = await import("../src/game/combat/KrelFinishers");
    meta.settings.gore = false;
    meta.krelSeen = [];
    const tame = ELEGANT.filter((f) => f !== "asbestos");
    const got = Array.from({ length: tame.length }, () => pick());
    expect(new Set(got).size).toBe(tame.length);
    expect(got).not.toContain("asbestos");
    meta.settings.gore = true;
  });
});

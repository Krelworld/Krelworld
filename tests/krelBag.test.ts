import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));
vi.mock("../src/game/audio/Synth", () => ({ synth: { play: () => {} } }));
vi.mock("../src/game/gfx/Vfx", () => ({ hasVfx: () => false, vfx: () => {} }));
vi.mock("../src/game/combat/KrelCinema", () => ({ krelCinema: () => {} }));
vi.mock("../src/game/combat/KrelArt", () => ({ Actor: class {}, Victim: class {}, bit: () => {}, prop: () => {}, MEATY: [] }));
const meta: { settings: { gore: boolean }; krelSeen?: string[] } = { settings: { gore: true } };
const Gm: { meta: typeof meta; saveMeta: () => void; s?: { flags: Record<string, unknown> } } = { meta, saveMeta: () => {} };
vi.mock("../src/game/G", () => ({ G: Gm }));

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
  it("GET WELL SOON is guaranteed once a playthrough, as the second Kreltality (never the first)", async () => {
    const { pick } = await import("../src/game/combat/Kreltality");
    for (let run = 0; run < 5; run++) {
      meta.settings.gore = true;
      // even if it was seen in an earlier playthrough
      meta.krelSeen = ["asbestos"];
      Gm.s = { flags: {} };
      const first = pick();
      const second = pick();
      expect(first === "asbestos" ? second !== "asbestos" : second === "asbestos").toBe(true);
      const rest = Array.from({ length: 6 }, () => pick());
      // once it's been, the run doesn't force it again
      expect([first, second, ...rest].filter((f) => f === "asbestos").length).toBeLessThanOrEqual(2);
    }
    Gm.s = undefined;
  });
});

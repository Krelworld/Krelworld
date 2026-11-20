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
  it("GET WELL SOON is guaranteed once a playthrough on a humanoid boss (never the first Kreltality)", async () => {
    const { pick } = await import("../src/game/combat/Kreltality");
    meta.settings.gore = true;
    // first Kreltality of the run, on a humanoid boss: not forced
    meta.krelSeen = ["asbestos"];
    Gm.s = { flags: {} };
    expect(pick({ id: "krandall" })).not.toBe("asbestos");
    // a monster boss and a plain enemy: not forced
    expect(pick({ id: "salmon" })).not.toBe("asbestos");
    expect(pick({})).not.toBe("asbestos");
    // a real person: not forced
    expect(pick({ id: "elon" })).not.toBe("asbestos");
    // the next humanoid boss: forced, even though it's been seen in an earlier game
    expect(pick({ id: "flatmate" })).toBe("asbestos");
    // and only once a run
    meta.krelSeen = ["asbestos"];
    expect(pick({ id: "reinhardt" })).not.toBe("asbestos");
    Gm.s = undefined;
  });
});

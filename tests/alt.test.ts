import { afterEach, describe, expect, it } from "vitest";
import { ALT, isAlt, setAltForTests, storageKey } from "../src/game/variant";
import { newGameState } from "../src/game/systems/state";
import { evalCond, lineText } from "../src/game/systems/conditions";
import { resolveLine } from "../src/game/systems/narrative";
import { boothTarget, pursuerId } from "../src/game/systems/sanmik";
import { bump } from "../src/game/systems/stats";
import { say } from "../src/content/dsl";
import { KR_HOME } from "../src/content/krunchers";
import { BOOTH_ALT } from "../src/content/alt";
import type { Line } from "../src/data/types";

// The ALT build (VITE_KREL_ALT=1): see src/game/variant.ts.
afterEach(() => setAltForTests(ALT));

describe("the ALT build switch", () => {
  it("is off in tests (no VITE_KREL_ALT), and the normal build keeps its storage keys", () => {
    expect(ALT).toBe(false);
    expect(isAlt()).toBe(false);
    expect(storageKey("krelworld.save")).toBe("krelworld.save");
  });

  it("cond.alt: a line can be ALT-only or normal-only", () => {
    const s = newGameState("FLENKY");
    setAltForTests(false);
    expect(evalCond({ alt: false }, s)).toBe(true);
    expect(evalCond({ alt: true }, s)).toBe(false);
    expect(evalCond(undefined, s)).toBe(true);
    setAltForTests(true);
    expect(evalCond({ alt: false }, s)).toBe(false);
    expect(evalCond({ alt: true }, s)).toBe(true);
    expect(evalCond({ alt: true, player: "MIKEY" }, s)).toBe(false);
    expect(resolveLine(say("MIKEY", "x", { cond: { alt: false } }), s)).toBeNull();
  });

  it("line.alt replaces the text in the ALT build only; variants still win; altVariants win over them", () => {
    const l: Line = say("MIKEY", "normal", { alt: "alt text", variants: { MIKEY: "mikey normal", KREBON: "krebon" }, altVariants: { MIKEY: "mikey alt" } });
    const f = newGameState("FLENKY");
    const m = newGameState("MIKEY");
    const k = newGameState("KREBON");
    setAltForTests(false);
    expect(resolveLine(l, f)!.t).toBe("normal");
    expect(resolveLine(l, m)!.t).toBe("mikey normal");
    expect(lineText(l, "KREBON")).toBe("krebon");
    setAltForTests(true);
    expect(resolveLine(l, f)!.t).toBe("alt text");
    expect(resolveLine(l, m)!.t).toBe("mikey alt");
    expect(resolveLine(l, k)!.t).toBe("krebon");
  });

  it("the Kruncher group-chat line: Luke gets it next (Jenko if you're Luke); the normal text is untouched", () => {
    const line = KR_HOME.find((l) => l.t.includes("we should beat up Mikey too"))!;
    setAltForTests(false);
    expect(resolveLine(line, newGameState("FLENKY"))!.t).toContain("beat up Mikey too");
    setAltForTests(true);
    expect(resolveLine(line, newGameState("FLENKY"))!.t).toContain("beat up Luke");
    expect(resolveLine(line, newGameState("CRONGUS"))!.t).toContain("beat up Jenko");
  });

  it("the follower: Mikey normally (Polson for Mikey); Polson for everyone in ALT, nobody when he's not about", () => {
    const f = newGameState("FLENKY");
    f.chapter = 3;
    const m = newGameState("MIKEY");
    m.chapter = 3;
    setAltForTests(false);
    expect(pursuerId(f)).toBe("MIKEY");
    expect(pursuerId(m)).toBe("POLSON");
    setAltForTests(true);
    expect(pursuerId(f)).toBe("POLSON");
    expect(pursuerId(m)).toBe("POLSON");
    for (const ch of [2, 5]) {
      f.chapter = ch;
      expect(pursuerId(f)).toBeNull();
    }
    f.chapter = 4;
    f.flags.polson_dead = true;
    expect(pursuerId(f)).toBeNull();
  });

  it("the Frustration Booth: Mikey normally; Luke and Jenko take turns in ALT, never yourself", () => {
    const f = newGameState("FLENKY");
    const c = newGameState("CRONGUS");
    const m = newGameState("MIKEY");
    setAltForTests(false);
    expect(boothTarget(f)).toBe("MIKEY");
    setAltForTests(true);
    expect(boothTarget(f)).toBe("CRONGUS");
    expect(boothTarget(c)).toBe("FLENKY");
    expect(boothTarget(m)).toBe("CRONGUS");
    bump(m, "bully_sessions");
    expect(boothTarget(m)).toBe("FLENKY");
    for (const cast of Object.values(BOOTH_ALT)) expect(cast.barks.length).toBeGreaterThan(3);
  });
});

import { describe, expect, it } from "vitest";
import { ARC, fall, flap, GRADE_AT, gradeWonk, OVER, randomZone, sweetSpot, TIME, WONK_POWER, wonkForm, type Flappy, type WonkZone } from "../src/game/combat/wonkGrade";

/** Seeded RNG so the simulated players are repeatable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Play one wonk with a bot that flaps when the gauge falls past its target, after a reaction delay. */
function play(rnd: () => number, z: WonkZone, target: number, jitterMs: number): "PERFECT" | "GREAT" | "GOOD" | "over" | "under" {
  const g: Flappy = { gauge: 0, vel: 0 };
  const sw = sweetSpot(z);
  let t = 0, inZone = 0, sweet = 0, entered = -1;
  let pending: number | null = null;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  for (;;) {
    t += 16;
    if (pending === null && g.vel <= 0 && g.gauge <= target) pending = t + Math.abs(gauss()) * jitterMs;
    if (pending !== null && t >= pending) {
      flap(g);
      pending = null;
    }
    fall(g, 16);
    if (g.gauge >= z.lo && g.gauge <= z.hi) {
      inZone += 16;
      if (entered < 0) entered = t;
    }
    if (entered >= 0 && g.gauge >= sw.lo && g.gauge <= sw.hi) sweet += 16;
    if (g.gauge >= OVER) return "over";
    if (inZone >= z.need) return gradeWonk(wonkForm(sweet, t - entered, sw.hi - sw.lo));
    if (t >= TIME) return "under";
  }
}

function odds(kind: "casual" | "decent", n = 3000) {
  const rnd = rng(kind === "casual" ? 7 : 11);
  const out: Record<string, number> = { PERFECT: 0, GREAT: 0, GOOD: 0, over: 0, under: 0 };
  for (let i = 0; i < n; i++) {
    const z = randomZone(rnd);
    const sw = sweetSpot(z);
    // casual: flap whenever it drops into the middle of the zone, sloppy timing.
    // decent: flap low enough that the top of the arc sits on the sweet spot, tighter timing.
    const target = kind === "casual" ? (z.lo + z.hi) / 2 + (rnd() - 0.5) * 0.06 : sw.hi - ARC + (rnd() - 0.5) * 0.03;
    out[play(rnd, z, target, kind === "casual" ? 110 : 55)]++;
  }
  for (const k of Object.keys(out)) out[k] /= n;
  return out;
}

describe("wonk grading", () => {
  it("grades by form thresholds", () => {
    expect(gradeWonk(1)).toBe("PERFECT");
    expect(gradeWonk(GRADE_AT.PERFECT)).toBe("PERFECT");
    expect(gradeWonk(GRADE_AT.PERFECT - 0.01)).toBe("GREAT");
    expect(gradeWonk(GRADE_AT.GREAT)).toBe("GREAT");
    expect(gradeWonk(GRADE_AT.GREAT - 0.01)).toBe("GOOD");
    expect(gradeWonk(0)).toBe("GOOD");
  });

  it("form is the sweet-spot share, normalised to what one flap arc can manage", () => {
    expect(wonkForm(0, 0, 0.1)).toBe(0);
    expect(wonkForm(1000, 1000, 0.5)).toBe(1);
    // a band thinner than the arc can only be held for sqrt(h / ARC) of the time; doing that is full marks
    const h = 0.05;
    const best = Math.sqrt(h / ARC);
    expect(wonkForm(best * 1000, 1000, h)).toBeCloseTo(1, 5);
    expect(wonkForm(best * 500, 1000, h)).toBeCloseTo(0.5, 5);
  });

  it("the sweet spot is the middle of the zone, never wider than it", () => {
    const wide = sweetSpot({ lo: 0.3, hi: 0.54 });
    expect(wide.lo).toBeCloseTo(0.37);
    expect(wide.hi).toBeCloseTo(0.47);
    const narrow = sweetSpot({ lo: 0.4, hi: 0.47 });
    expect(narrow).toEqual({ lo: 0.4, hi: 0.47 });
  });

  it("power scales with the grade, and PERFECT beats the old flat perfect (1x)", () => {
    expect(WONK_POWER.GOOD).toBeLessThan(WONK_POWER.GREAT);
    expect(WONK_POWER.GREAT).toBeLessThan(WONK_POWER.PERFECT);
    expect(WONK_POWER.PERFECT).toBeGreaterThan(1);
  });

  it("PERFECT is rare for a casual masher and roughly 1 in 4 for a decent player", () => {
    const casual = odds("casual");
    const decent = odds("decent");
    expect(casual.PERFECT).toBeLessThan(0.15);
    expect(casual.GOOD + casual.GREAT).toBeGreaterThan(0.75);
    expect(decent.PERFECT).toBeGreaterThan(0.15);
    expect(decent.PERFECT).toBeLessThan(0.4);
    expect(decent.PERFECT).toBeGreaterThan(casual.PERFECT);
  });
});

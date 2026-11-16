import { describe, expect, it } from "vitest";
import { fall, flap, OVER, styledZone, styleGauge, WONK_STYLES, wonkStyleFor, zoneAt, type Flappy, type WonkStyle } from "../src/game/combat/wonkGrade";

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

/** A sloppy first-timer: flaps somewhere round the middle of the zone, with a slow, wobbly reaction. */
function sloppySuccess(st: WonkStyle, n = 1500) {
  const rnd = rng(21);
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const z = styledZone(st, rnd);
    const g = styleGauge({ gauge: 0, vel: 0 } as Flappy, st);
    let t = 0;
    let inZone = 0;
    let pending: number | null = null;
    const target = (z.lo + z.hi) / 2 + (rnd() - 0.5) * 0.3;
    for (;;) {
      t += 16;
      const at = zoneAt(z, st, t);
      if (pending === null && g.vel <= 0 && g.gauge <= target) pending = t + rnd() * 450;
      if (pending !== null && t >= pending) {
        flap(g);
        pending = null;
      }
      fall(g, 16);
      if (g.gauge >= at.lo && g.gauge <= at.hi) inZone += 16;
      if (g.gauge >= OVER) break;
      if (inZone >= z.need) {
        ok++;
        break;
      }
      if (t >= st.time) break;
    }
  }
  return ok / n;
}

describe("wonk variety", () => {
  it("the first wonk ever is the gentle one; later ones vary", () => {
    expect(wonkStyleFor(0).id).toBe("gentle");
    const rnd = rng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(wonkStyleFor(5, rnd).id);
    expect(seen.size).toBeGreaterThan(2);
  });

  it("styled zones (drift included) never touch the floor or the over-wonk line", () => {
    const rnd = rng(5);
    for (const st of Object.values(WONK_STYLES)) {
      for (let i = 0; i < 300; i++) {
        const z = styledZone(st, rnd);
        for (let ms = 0; ms < 12000; ms += 250) {
          const at = zoneAt(z, st, ms);
          expect(at.lo).toBeGreaterThanOrEqual(0.2);
          expect(at.hi).toBeLessThan(OVER);
        }
      }
    }
  });

  it("a gauge takes its style's physics", () => {
    const g = styleGauge({ gauge: 0.5, vel: 0 } as Flappy, WONK_STYLES.heavy);
    flap(g);
    expect(g.vel).toBe(WONK_STYLES.heavy.flap);
    fall(g, 100);
    expect(g.vel).toBeCloseTo(WONK_STYLES.heavy.flap - WONK_STYLES.heavy.grav * 0.1, 5);
  });

  it("the gentle wonk is clearly easier for a sloppy first-timer than the classic one", () => {
    const gentle = sloppySuccess(WONK_STYLES.gentle);
    const classic = sloppySuccess(WONK_STYLES.classic);
    expect(gentle).toBeGreaterThan(classic + 0.1);
    expect(gentle).toBeGreaterThan(0.7);
  });
});

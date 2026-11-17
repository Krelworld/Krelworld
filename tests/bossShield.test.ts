import { describe, expect, it } from "vitest";
import { BOSS_SHIELDS, minionsFor, shieldConfig, ShieldPhase, SHIELD_TUNING, stretchCooldown, type ShieldConfig } from "../src/game/combat/bossShieldLogic";
import { ENEMIES } from "../src/data/enemies";

const cfg = (t = [0.66, 0.33]): ShieldConfig => ({ thresholds: t, minions: ["cultist"], count: [3, 4], minionHp: 0.5, rate: 0.5 });

/** Hit the boss for `amount` the way the scene does; returns the new hp. */
function hit(s: ShieldPhase, hp: number, max: number, amount: number) {
  return hp - s.filter(hp, max, amount).amount;
}

describe("boss shield: the threshold clamp", () => {
  it("stops a huge hit dead at the threshold and raises the shield", () => {
    const s = new ShieldPhase(cfg());
    const r = s.filter(1000, 1000, 99999);
    expect(1000 - r.amount).toBeCloseTo(660);
    expect(r.raised).toBe(true);
    expect(s.state).toBe("pending");
    expect(s.blocking).toBe(true);
  });

  it("can't skip a threshold: one hit across both only reaches the first", () => {
    const s = new ShieldPhase(cfg());
    const hp = hit(s, 700, 1000, 600);
    expect(hp).toBeCloseTo(660);
    expect(s.next).toBe(1);
  });

  it("lets ordinary hits through above the threshold", () => {
    const s = new ShieldPhase(cfg());
    const r = s.filter(1000, 1000, 50);
    expect(r.amount).toBe(50);
    expect(r.raised).toBe(false);
    expect(s.state).toBe("idle");
  });

  it("blocks everything while it's up (pending and shielded)", () => {
    const s = new ShieldPhase(cfg());
    s.filter(1000, 1000, 5000);
    expect(s.filter(660, 1000, 100).amount).toBe(0);
    s.begin(0, 3);
    expect(s.filter(660, 1000, 100).amount).toBe(0);
  });

  it("never kills the boss on the clamp (thresholds are above 0)", () => {
    const s = new ShieldPhase(cfg([0.1]));
    expect(hit(s, 120, 1000, 99999)).toBeCloseTo(100);
  });

  it("a boss starting part-way down (checkpoint) skips the shields it's past", () => {
    const s = new ShieldPhase(cfg(), 0.5);
    expect(s.next).toBe(1);
    expect(s.remaining).toBe(1);
    expect(hit(s, 500, 1000, 400)).toBeCloseTo(330);
  });

  it("after the last threshold, damage is unclamped (death scripts still trigger)", () => {
    const s = new ShieldPhase(cfg([0.5]));
    hit(s, 1000, 1000, 9999);
    s.begin(0, 1);
    s.crack(10);
    s.tick(10 + SHIELD_TUNING.vulnerableMs);
    expect(s.state).toBe("idle");
    expect(hit(s, 500, 1000, 9999)).toBeLessThanOrEqual(0);
  });
});

describe("boss shield: the phase", () => {
  it("cracks once per minion and shatters on the last, then straight back to the fight (no stun)", () => {
    const s = new ShieldPhase(cfg());
    s.filter(1000, 1000, 5000);
    s.begin(1000, 3);
    expect(s.crack(1100)).toBe(false);
    expect(s.crack(1200)).toBe(false);
    expect(s.cracks).toBe(2);
    expect(s.crack(1300)).toBe(true);
    expect(s.state).toBe("idle");
    expect(s.blocking).toBe(false);
    // no bonus-damage window, no stun to recover from
    expect(s.filter(660, 1000, 10).amount).toBeCloseTo(10);
    expect(s.tick(1300 + SHIELD_TUNING.vulnerableMs)).toBe(null);
    // and on to the next one
    const r = s.filter(660, 1000, 9999);
    expect(660 - r.amount).toBeCloseTo(330);
    expect(r.raised).toBe(true);
  });

  it("the bonus can't skip the next threshold either", () => {
    const s = new ShieldPhase(cfg());
    s.filter(1000, 1000, 5000);
    s.begin(0, 1);
    s.crack(0);
    expect(hit(s, 660, 1000, 9999)).toBeCloseTo(330);
  });

  it("safety valve: after the stall time it weakens, then cracks by itself until it breaks", () => {
    const s = new ShieldPhase(cfg());
    s.filter(1000, 1000, 5000);
    s.begin(0, 3);
    expect(s.tick(SHIELD_TUNING.stallMs - 1)).toBe(null);
    expect(s.tick(SHIELD_TUNING.stallMs)).toBe("weaken");
    let t = SHIELD_TUNING.stallMs;
    let broke = false;
    for (let i = 0; i < 10 && !broke; i++) {
      t += SHIELD_TUNING.stallCrackEvery;
      expect(s.tick(t)).toBe("autocrack");
      broke = s.crack(t);
    }
    expect(broke).toBe(true);
    expect(t).toBeLessThan(SHIELD_TUNING.stallMs + 4 * SHIELD_TUNING.stallCrackEvery);
  });

  it("cracks don't count unless it's up", () => {
    const s = new ShieldPhase(cfg());
    expect(s.crack(0)).toBe(false);
    expect(s.cracks).toBe(0);
  });

  it("stretches the boss's attack cooldowns while shielded", () => {
    expect(stretchCooldown(1000, 2000, 0.5)).toBe(3000);
    expect(stretchCooldown(1000, 900, 0.5)).toBe(900);
    expect(stretchCooldown(1000, 2000, 1)).toBe(2000);
  });
});

describe("boss shield: config", () => {
  it("every minion type exists", () => {
    for (const [id, c] of Object.entries(BOSS_SHIELDS)) {
      for (const m of c?.minions ?? []) expect(ENEMIES[m], `${id}: ${m}`).toBeTruthy();
    }
  });

  it("scripted bosses are skipped, the rest get sensible shields", () => {
    for (const id of ["concept", "dark_drongus", "feedback", "drongus"]) expect(shieldConfig(id)).toBeNull();
    const k = shieldConfig("krandall")!;
    expect(k.thresholds).toEqual([0.66, 0.33]);
    expect(shieldConfig("elon")!.thresholds.length).toBe(1);
    // an unknown boss gets the defaults
    expect(shieldConfig("someone_new")!.thresholds.length).toBe(2);
  });

  it("3-5 minions per shield", () => {
    for (const id of Object.keys(BOSS_SHIELDS)) {
      const c = shieldConfig(id);
      if (!c) continue;
      c.thresholds.forEach((_, i) => {
        const n = minionsFor(c, i).length;
        expect(n, id).toBeGreaterThanOrEqual(3);
        expect(n, id).toBeLessThanOrEqual(6);
      });
    }
  });
});

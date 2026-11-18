import { describe, expect, it } from "vitest";
import { clampDifficulty, DEFAULT_DIFFICULTY, DIFFICULTY_LEVELS, diffFor, LEGACY_DIFFICULTY, scaleCooldown, scaleCount, scaleInt, type DifficultyDef } from "../src/game/systems/difficulty";
import { migrateState, newGameState, serialize, deserialize } from "../src/game/systems/state";
import { DEFAULT_SHIELD, SHIELD_TUNING, shieldForDifficulty } from "../src/game/combat/bossShieldLogic";

type NumKey = { [K in keyof DifficultyDef]: DifficultyDef[K] extends number ? K : never }[keyof DifficultyDef];
/** +1: the number goes up as it gets harder; -1: it goes down. Every lever must be listed. */
const DIRECTION: Record<Exclude<NumKey, "level" | "color">, 1 | -1> = {
  enemyHp: 1,
  bossHp: 1,
  damageTaken: 1,
  telegraph: -1,
  aggression: 1,
  enemySpeed: 1,
  projectileSpeed: 1,
  enemyCount: 1,
  healDrops: -1,
  ammoDrops: -1,
  ammoDryKills: 1,
  coins: 1,
  krezzGain: -1,
  iframes: -1,
  timing: -1,
  shieldStall: 1,
  shieldMinions: 1,
};

describe("difficulty table", () => {
  it("has five levels numbered 1-5, each named and described", () => {
    expect(DIFFICULTY_LEVELS.map((d) => d.level)).toEqual([1, 2, 3, 4, 5]);
    for (const d of DIFFICULTY_LEVELS) {
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.blurb.length).toBeGreaterThan(10);
    }
  });

  it("level 2 is exactly the original balance", () => {
    const d = DIFFICULTY_LEVELS[1];
    for (const k of Object.keys(DIRECTION) as (keyof typeof DIRECTION)[]) {
      if (k === "ammoDryKills") expect(d[k]).toBe(6); // the old "a guaranteed ammo after 6 dry kills"
      else if (k === "shieldMinions") expect(d[k]).toBe(0);
      else expect(d[k], k).toBe(1);
    }
  });

  it("every lever is listed and moves one way only as it gets harder", () => {
    const numeric = Object.keys(DIFFICULTY_LEVELS[0]).filter((k) => typeof (DIFFICULTY_LEVELS[0] as unknown as Record<string, unknown>)[k] === "number" && k !== "level" && k !== "color");
    expect(numeric.sort()).toEqual(Object.keys(DIRECTION).sort());
    for (const [k, dir] of Object.entries(DIRECTION) as [keyof typeof DIRECTION, 1 | -1][]) {
      for (let i = 1; i < DIFFICULTY_LEVELS.length; i++) {
        const a = DIFFICULTY_LEVELS[i - 1][k];
        const b = DIFFICULTY_LEVELS[i][k];
        expect((b - a) * dir, `${k} ${i}->${i + 1}`).toBeGreaterThanOrEqual(0);
      }
      // and it actually does something across the range
      expect(DIFFICULTY_LEVELS[4][k], k).not.toBe(DIFFICULTY_LEVELS[0][k]);
    }
  });

  it("isn't an HP sponge: the top level leans on behaviour more than health", () => {
    const top = DIFFICULTY_LEVELS[4];
    expect(top.enemyHp).toBeLessThanOrEqual(1.3);
    expect(top.damageTaken - 1).toBeGreaterThan(top.enemyHp - 1);
    expect(top.aggression - 1).toBeGreaterThan(top.enemyHp - 1);
    // warnings never drop below human reaction time territory
    expect(top.telegraph).toBeGreaterThanOrEqual(0.75);
  });

  it("helpers are the identity at the original balance", () => {
    expect(scaleCount(3, 1)).toBe(3);
    expect(scaleCount(0, 1.4)).toBe(0);
    expect(scaleCount(1, 0.5, () => 0.99)).toBe(1); // never below one
    expect(scaleCount(2, 1.5, () => 0.99)).toBe(3);
    expect(scaleCount(3, 1.1, () => 0)).toBe(4); // 3.3: the fraction rolled in
    expect(scaleCooldown(100, 1100, 1)).toBe(1100);
    expect(scaleCooldown(100, 1100, 2)).toBe(600);
    expect(scaleInt(7, 1)).toBe(7);
    expect(scaleInt(7, 0.1)).toBe(1);
    const same = shieldForDifficulty(DEFAULT_SHIELD, DIFFICULTY_LEVELS[1]);
    expect(same.cfg).toBe(DEFAULT_SHIELD);
    expect(same.tune).toBe(SHIELD_TUNING);
    const hard = shieldForDifficulty(DEFAULT_SHIELD, DIFFICULTY_LEVELS[4]);
    expect(hard.cfg.count).toEqual(DEFAULT_SHIELD.count.map((n) => n + 1));
    expect(hard.tune.stallMs).toBeGreaterThan(SHIELD_TUNING.stallMs);
  });

  it("clamps junk to the old balance", () => {
    expect(clampDifficulty(undefined)).toBe(LEGACY_DIFFICULTY);
    expect(clampDifficulty(0)).toBe(2);
    expect(clampDifficulty(6)).toBe(2);
    expect(clampDifficulty(2.5)).toBe(2);
    expect(clampDifficulty("4")).toBe(2);
    expect(clampDifficulty(5)).toBe(5);
    expect(diffFor(null).level).toBe(2);
    expect(diffFor({ difficulty: 4 }).level).toBe(4);
  });
});

describe("difficulty in the save", () => {
  it("new games default to 3 (or what was picked)", () => {
    expect(DEFAULT_DIFFICULTY).toBe(3);
    expect(newGameState("FLENKY").difficulty).toBe(3);
    expect(newGameState("FLENKY", 0, undefined, 5).difficulty).toBe(5);
    expect(newGameState("FLENKY", 0, undefined, 1).difficulty).toBe(1);
  });

  it("old saves (no difficulty) come back on the original balance, 2", () => {
    const old: Record<string, unknown> = { ...newGameState("GRONNY"), version: 3 };
    delete old.difficulty;
    expect(migrateState(old)!.difficulty).toBe(2);
    expect(migrateState({ ...old, difficulty: 99 })!.difficulty).toBe(2);
    expect(migrateState({ ...old, difficulty: 4 })!.difficulty).toBe(4);
  });

  it("round-trips through a save", () => {
    const s = newGameState("KREBON", 0, undefined, 1);
    expect(deserialize(serialize(s))!.difficulty).toBe(1);
  });
});

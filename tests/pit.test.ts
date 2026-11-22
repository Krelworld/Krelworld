import { describe, expect, it } from "vitest";
import {
  beatenBosses,
  bossWaveHp,
  cleanPit,
  cloneState,
  flagDiff,
  gauntletBossFor,
  gauntletPool,
  gauntletScale,
  gauntletWave,
  GAUNTLET_BOSSES,
  GAUNTLET_KILL_COIN_MULT,
  GAUNTLET_POOLS,
  HEAT_TIERS,
  heatScale,
  isBossWave,
  loanableGuns,
  loanablePerks,
  milestoneBonus,
  practiceEarnings,
  recordGauntlet,
  recordRematch,
  REMATCHES,
  rematchesOpen,
  rematchPay,
  runPay,
  settlePractice,
  wavePay,
} from "../src/game/systems/pit";
import { DIFFICULTY_LEVELS } from "../src/game/systems/difficulty";
import { migrateState, newGameState } from "../src/game/systems/state";
import { DUNGEONS } from "../src/data/dungeons";
import { ENEMIES } from "../src/data/enemies";
import { BOSS_TEXT } from "../src/content/bosses";
import { GUNS } from "../src/data/guns";
import type { GameState } from "../src/data/types";

const VERY_HARD = DIFFICULTY_LEVELS[DIFFICULTY_LEVELS.length - 1];

/** A run part-way through the story (Chapter 4, a few side arcs done). */
function midGame(): GameState {
  const s = newGameState("GRONNY");
  s.chapter = 4;
  Object.assign(s.flags, { ch1_clear: true, ch2_clear: true, ch3_clear: true, arc_fl_brand: true, crystal_krandall: true, krokens: 12, met_emergency: true });
  s.coins = 900;
  s.guns = { pistol: 60, smg: 100 };
  s.gun = "pistol";
  s.upgrades = { pk_dmg: 1, hp: 2 };
  s.bottles = 2;
  s.bongos = 1;
  s.quests = { q_flenky: 1 };
  s.archiveUnlocked = ["arch_squeeze"];
  s.tvWatched = ["kmtv_1"];
  return s;
}

describe("the gauntlet's scaling curve", () => {
  it("ramps every lever, wave on wave, and never eases off", () => {
    for (let n = 1; n < 40; n++) {
      const a = gauntletScale(n);
      const b = gauntletScale(n + 1);
      for (const k of ["hp", "dmg", "speed", "aggression", "elite", "count"] as const) expect(b[k], `${k} @ wave ${n + 1}`).toBeGreaterThanOrEqual(a[k]);
      expect(b.hp).toBeGreaterThan(a.hp);
      expect(b.dmg).toBeGreaterThan(a.dmg);
    }
  });

  it("starts gentle and is well past VERY HARD by waves 15-20", () => {
    const w1 = gauntletScale(1);
    expect(w1.hp).toBeLessThan(1);
    expect(w1.dmg).toBeLessThan(1);
    expect(w1.count).toBeGreaterThanOrEqual(3);
    const w15 = gauntletScale(15);
    const w20 = gauntletScale(20);
    // (on top of whatever difficulty you're on; VERY HARD alone is 1.25x HP, 1.7x damage, 1.4x aggression)
    expect(w15.hp).toBeGreaterThan(VERY_HARD.enemyHp * 2.5);
    expect(w15.dmg).toBeGreaterThan(VERY_HARD.damageTaken);
    expect(w15.aggression).toBeGreaterThan(VERY_HARD.aggression);
    expect(w20.hp).toBeGreaterThan(4.5);
    expect(w20.dmg).toBeGreaterThan(2.5);
    expect(w20.elite).toBeGreaterThan(0.45);
    expect(w20.count).toBeGreaterThan(VERY_HARD.enemyCount * 10);
  });

  it("caps the things that would just be unfair", () => {
    const w99 = gauntletScale(99);
    expect(w99.speed).toBeLessThanOrEqual(1.5);
    expect(w99.aggression).toBeLessThanOrEqual(2.2);
    expect(w99.elite).toBeLessThanOrEqual(0.6);
    // (the dungeon caps live enemies at 28)
    expect(w99.count).toBeLessThanOrEqual(24);
  });

  it("every 5th wave is a boss, tougher each time round", () => {
    expect([1, 2, 3, 4, 5, 6, 10, 15, 16].map(isBossWave)).toEqual([false, false, false, false, true, false, true, true, false]);
    expect(bossWaveHp(10)).toBeGreaterThan(bossWaveHp(5));
    expect(bossWaveHp(20)).toBeGreaterThan(bossWaveHp(15));
  });

  it("waves are the right size, from the right pool", () => {
    const s = midGame();
    const pool = gauntletPool(s);
    for (let n = 1; n <= 30; n++) {
      const comp = gauntletWave(n, pool, mulberry(n));
      expect(comp.reduce((a, [, c]) => a + c, 0)).toBe(gauntletScale(n).count);
      for (const [t] of comp) {
        expect(pool).toContain(t);
        expect(ENEMIES[t], t).toBeTruthy();
      }
    }
  });
});

describe("no spoilers", () => {
  it("only enemies from chapters you've cleared", () => {
    const s = newGameState("FLENKY");
    s.flags.ch1_clear = true;
    const pool = gauntletPool(s);
    const later = GAUNTLET_POOLS.filter((p) => p.flag && p.flag !== "ch1_clear").flatMap((p) => p.enemies);
    for (const e of later) expect(pool).not.toContain(e);
    for (const p of GAUNTLET_POOLS) for (const e of p.enemies) expect(ENEMIES[e], e).toBeTruthy();
  });

  it("boss waves only bring back bosses you've beaten", () => {
    const s = midGame();
    const beaten = beatenBosses(s);
    expect(beaten).toEqual(["krandall", "hoard", "cronster", "brand"]);
    for (let n = 5; n <= 60; n += 5) expect(beaten).toContain(gauntletBossFor(n, beaten)!);
    expect(gauntletBossFor(5, [])).toBeNull();
    expect(gauntletBossFor(4, beaten)).toBeNull();
    for (const b of GAUNTLET_BOSSES) expect(BOSS_TEXT[b.id], b.id).toBeTruthy();
  });

  it("rematches open only once you've cleared them", () => {
    const s = newGameState("FLENKY");
    expect(rematchesOpen(s)).toEqual([]);
    s.flags.ch1_clear = true;
    expect(rematchesOpen(s).map((r) => r.id)).toEqual(["wildern", "krandall"]);
  });
});

describe("payouts", () => {
  it("each wave pays more than the last, and the milestones pay extra", () => {
    for (let n = 1; n < 30; n++) expect(wavePay(n + 1).coins + (milestoneBonus(n).coins - milestoneBonus(n + 1).coins)).toBeGreaterThan(wavePay(n).coins - 1);
    expect(milestoneBonus(5)).toEqual({ coins: 25, krokens: 1 });
    expect(milestoneBonus(10)).toEqual({ coins: 75, krokens: 3 });
    expect(milestoneBonus(20)).toEqual({ coins: 250, krokens: 6 });
    expect(milestoneBonus(25).coins).toBeGreaterThan(0);
    expect(milestoneBonus(7)).toEqual({ coins: 0, krokens: 0 });
    expect(wavePay(10).milestone).toBe(true);
    expect(wavePay(9).milestone).toBe(false);
  });

  it("scales with difficulty's rewards, like chapter rewards do", () => {
    for (const d of DIFFICULTY_LEVELS) expect(wavePay(10, d.rewards).coins).toBe(Math.round(wavePay(10).coins * d.rewards));
    expect(runPay(10, VERY_HARD.rewards).coins).toBeGreaterThan(runPay(10, 1).coins);
  });

  it("keeps the economy sane (docs/ECONOMY.md: ~10,600 a playthrough, ~25,000 on the shelf)", () => {
    // a decent run to wave 10: worth a couple of shop levels, not the shop
    const r10 = runPay(10, 1);
    expect(r10.coins).toBeGreaterThan(150);
    expect(r10.coins).toBeLessThan(400);
    // even wave 20 on VERY HARD is a fraction of the shelf
    expect(runPay(20, VERY_HARD.rewards).coins).toBeLessThan(2000);
    // an hour of farming (~4 runs to wave 12, with kill drops at the Pit's rate) stays under ~3,000:
    // more than the story's ~1,000-1,500 an hour, a long way short of trivialising a ~25,000 shelf
    const dropsPerRun = (() => {
      let n = 0;
      for (let w = 1; w <= 12; w++) n += gauntletScale(w).count * 5 * 1.1 * GAUNTLET_KILL_COIN_MULT;
      return n;
    })();
    const hour = 4 * (runPay(12, 1).coins + dropsPerRun);
    expect(hour).toBeGreaterThan(1200);
    expect(hour).toBeLessThan(3000);
    // Krokens: a few a run (the whole game hands out ~300-450)
    expect(runPay(10).krokens).toBeLessThanOrEqual(5);
  });

  it("rematches pay half the original clear, times the Heat", () => {
    const wildern = REMATCHES.find((r) => r.id === "wildern")!;
    expect(wildern.basePay).toBe(200);
    expect(rematchPay(wildern, 1).coins).toBe(100);
    expect(rematchPay(wildern, 1.5).coins).toBe(150);
    expect(rematchPay(wildern, 3, 1.4).coins).toBe(420);
    expect(rematchPay(wildern, 1).krokens).toBe(0);
    expect(rematchPay(wildern, 3).krokens).toBeGreaterThan(rematchPay(wildern, 2).krokens);
    // Heat toughens them up as it pays more
    let prev = heatScale(1);
    expect(prev).toEqual({ hp: 1, dmg: 1, aggression: 1, speed: 1 });
    for (const t of HEAT_TIERS.slice(1)) {
      const h = heatScale(t.heat);
      expect(h.hp).toBeGreaterThan(prev.hp);
      expect(h.dmg).toBeGreaterThan(prev.dmg);
      prev = h;
    }
  });
});

describe("rematch cards", () => {
  it("every rematch is a real stretch of a real dungeon, ending on a boss", () => {
    for (const r of REMATCHES) {
      const d = DUNGEONS[r.dungeon];
      expect(d, r.id).toBeTruthy();
      expect(r.from, r.id).toBeGreaterThanOrEqual(0);
      expect(r.to, r.id).toBeGreaterThanOrEqual(r.from);
      expect(d.rooms[r.to], r.id).toBeTruthy();
      expect(d.rooms[r.to].boss, `${r.id} ends on a boss`).toBeTruthy();
      // (never the finale)
      expect(d.chapter).not.toBe(7);
    }
  });

  it("the Pit's own rooms exist and go back to the Pit", () => {
    for (const id of ["pit_gauntlet", "pit_range"]) expect(DUNGEONS[id].returnAt).toBe("PIT");
  });
});

describe("practice never touches the story", () => {
  it("a rematch hands back only coins, Krokens, ammo, consumables and the Pit's records", () => {
    const snap = midGame();
    const live = cloneState(snap);
    // everything the dungeon code might do to a run on the way through (all of it story)
    live.chapter = 5;
    Object.assign(live.flags, {
      ch4_clear: true,
      crystal_cronster: true,
      dclr_ministry_0: true,
      golden_found: true,
      arc_kz_troll: true,
      krel_krandall: true,
      cnt_kills_total: 40,
      dseq_boss_defeated: true,
      mollor_freed: true,
      crobley_factory_done: true,
      met_meeting_ch4: true,
      tv_broadcast_ch4: true,
    });
    delete live.flags.met_emergency;
    live.quests.q_flenky = 3;
    live.archiveUnlocked.push("arch_cheesegate");
    live.tvWatched.push("news_1");
    live.revisions.push("rev_1");
    live.drongusResentment += 10;
    live.relationships.POLSON = 5;
    live.upgrades.pk_armor = 3;
    live.guns = { pistol: 20, smg: 160, bfk: 30 };
    live.coins += 180;
    live.flags.krokens = 14;
    live.bottles = 0;
    live.bongos = 0;
    live.pit = { bestWave: 0, runs: 1, earned: 180, rematch: { wildern: 2 } };
    live.phase = "dungeon";

    const out = settlePractice(snap, live, "rematch");
    expect(flagDiff(snap.flags, out.flags)).toEqual(["krokens"]);
    expect(out.chapter).toBe(snap.chapter);
    expect(out.quests).toEqual(snap.quests);
    expect(out.archiveUnlocked).toEqual(snap.archiveUnlocked);
    expect(out.tvWatched).toEqual(snap.tvWatched);
    expect(out.revisions).toEqual(snap.revisions);
    expect(out.drongusResentment).toBe(snap.drongusResentment);
    expect(out.relationships).toEqual(snap.relationships);
    expect(out.upgrades).toEqual(snap.upgrades);
    expect(out.phase).toBe("hub");
    // what does come back out
    expect(out.coins).toBe(1080);
    expect(out.flags.krokens).toBe(14);
    expect(out.guns).toEqual({ pistol: 20, smg: 160 });
    expect(out.bottles).toBe(0);
    expect(out.pit).toEqual({ bestWave: 0, runs: 1, earned: 180, rematch: { wildern: 2 } });
    expect(practiceEarnings(snap, out)).toEqual({ coins: 180, krokens: 2 });
    // and the snapshot itself was never touched
    expect(snap.chapter).toBe(4);
  });

  it("the gauntlet's the same, and practice can't cost you money", () => {
    const snap = midGame();
    const live = cloneState(snap);
    live.coins = 10;
    live.flags.ch5_clear = true;
    const out = settlePractice(snap, live, "gauntlet");
    expect(out.coins).toBe(snap.coins);
    expect(flagDiff(snap.flags, out.flags)).toEqual([]);
  });

  it("the test range gives everything back exactly as it was", () => {
    const snap = midGame();
    const live = cloneState(snap);
    for (const id of loanableGuns()) live.guns![id] = GUNS[id].maxAmmo;
    for (const p of loanablePerks()) live.upgrades[p.key] = p.max;
    live.gun = "bfk";
    live.coins += 500;
    live.flags.krokens = 99;
    live.bottles = 0;
    live.pit = { bestWave: 50, runs: 9, earned: 9999, rematch: {} };
    const out = settlePractice(snap, live, "range");
    const strip = (s: GameState) => ({ ...s, playtimeMs: 0, pit: undefined });
    expect(strip(out)).toEqual({ ...strip(snap), phase: "hub" });
    expect(out.pit).toEqual(cleanPit(snap.pit));
  });

  it("records best waves and hottest Heats", () => {
    const p = cleanPit(undefined);
    expect(recordGauntlet(p, 6, 90)).toBe(true);
    expect(recordGauntlet(p, 4, 50)).toBe(false);
    expect(p).toMatchObject({ bestWave: 6, runs: 2, earned: 140 });
    expect(recordRematch(p, "wildern", 2, 200)).toBe(true);
    expect(recordRematch(p, "wildern", 1.5, 100)).toBe(false);
    expect(p.rematch.wildern).toBe(2);
  });
});

describe("saves", () => {
  it("old saves (no Pit record) still load, and a bad one is cleaned up", () => {
    const old = JSON.parse(JSON.stringify(newGameState("KREBON"))) as Record<string, unknown>;
    delete old.pit;
    const s = migrateState(old)!;
    expect(s).toBeTruthy();
    expect(s.pit).toBeUndefined();
    const bad = migrateState({ ...old, pit: { bestWave: "lots", runs: -3, earned: 12.7, rematch: { wildern: 2, x: "hot", y: -1 }, met: "yes" } })!;
    expect(bad.pit).toEqual({ bestWave: 0, runs: 0, earned: 12, rematch: { wildern: 2 } });
  });
});

/** A small seeded RNG (the wave picker takes one). */
function mulberry(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

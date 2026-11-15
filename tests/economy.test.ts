import { describe, expect, it } from "vitest";
import { GUNS } from "../src/data/guns";
import { ammoUnitCost, BANK_PERKS } from "../src/game/systems/armoury";
import { GENERIC_UPGRADES, upgradeCost } from "../src/game/systems/stats";
import { krokenPrice, KROKEN_PRICES, KROKEN_REFILL } from "../src/game/systems/kreddle";
import { PRIZE, PRIZES } from "../src/content/kreddle";
import { newGameState } from "../src/game/systems/state";

// The price shape from docs/ECONOMY.md: cheap things early, the game-changers need saving for.

describe("economy", () => {
  const s = newGameState("FLENKY");

  it("the game-changers cost a real chunk", () => {
    const perk = (id: string) => BANK_PERKS.find((p) => p.id === id)!.cost;
    expect(perk("pk_autoaim")).toBeGreaterThanOrEqual(1200);
    expect(GUNS.bfk.shop!).toBeGreaterThanOrEqual(1500);
    // a full stack of damage or armour costs more than any single gun but the BFK
    const stack = (id: string) => {
      const p = BANK_PERKS.find((b) => b.id === id)!;
      return Array.from({ length: p.max }, (_, l) => p.cost * (l + 1)).reduce((a, b) => a + b, 0);
    };
    expect(stack("pk_dmg")).toBeGreaterThan(GUNS.flamer.shop!);
    expect(stack("pk_armor")).toBeGreaterThan(GUNS.flamer.shop!);
  });

  it("first levels are cheap, later ones climb", () => {
    for (const u of GENERIC_UPGRADES) {
      expect(upgradeCost(s, 0, u.base)).toBeLessThanOrEqual(120);
      for (let l = 1; l < u.max; l++) expect(upgradeCost(s, l, u.base)).toBeGreaterThan(upgradeCost(s, l - 1, u.base));
    }
    expect(upgradeCost(newGameState("KREZMAR"), 2, 100)).toBeLessThan(upgradeCost(s, 2, 100));
  });

  it("every gun you can refill has a sensible box price", () => {
    for (const g of Object.values(GUNS)) {
      if (g.maxAmmo >= 9999) continue;
      const u = ammoUnitCost(g.id);
      expect(u).toBeGreaterThanOrEqual(10);
      // filling a gun from empty never costs more than a third of buying the BFK
      expect(Math.ceil(g.maxAmmo / g.pickup) * u).toBeLessThanOrEqual(GUNS.bfk.shop! / 3);
    }
  });

  it("Kroken prices: every prize has one, levels cost more, owned guns are a refill", () => {
    for (const p of PRIZES) expect(KROKEN_PRICES[p.id]).toBeDefined();
    const t = newGameState("FLENKY");
    const armor = PRIZE.armor;
    const first = krokenPrice(t, armor);
    t.upgrades.kd_armor = 1;
    expect(krokenPrice(t, armor)).toBeGreaterThan(first);
    expect(krokenPrice(t, PRIZE.violence)).toBeLessThan(krokenPrice(t, PRIZE.fairy));
    t.guns = { disco: 4 };
    expect(krokenPrice(t, PRIZE.g_disco)).toBe(KROKEN_REFILL);
  });
});

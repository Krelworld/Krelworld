import { describe, expect, it } from "vitest";
import { GUNS, type GunDef } from "../src/data/guns";
import { ammoQuote, ammoUnitCost, buyAmmo, firstLoaded, gunRatings, gunUpgrades, moveGun, nextLoaded, orderedGuns, STAT_KEYS, toPips } from "../src/game/systems/armoury";
import { migrateState, newGameState } from "../src/game/systems/state";

const ALL = Object.values(GUNS);

describe("gun rack ratings (1-5)", () => {
  it("toPips maps min to 1, max to 5, and clamps", () => {
    expect(toPips(0, 0, 10)).toBe(1);
    expect(toPips(10, 0, 10)).toBe(5);
    expect(toPips(5, 0, 10)).toBe(3);
    expect(toPips(-3, 0, 10)).toBe(1);
    expect(toPips(99, 0, 10)).toBe(5);
    expect(toPips(4, 4, 4)).toBe(3);
  });

  it("every gun rates 1..5 on every stat, and each stat's extremes hit 1 and 5", () => {
    for (const k of STAT_KEYS) {
      const vals = ALL.map((g) => gunRatings(g)[k]);
      for (const v of vals) expect(v >= 1 && v <= 5 && Number.isInteger(v)).toBe(true);
      expect(Math.min(...vals)).toBe(1);
      expect(Math.max(...vals)).toBe(5);
    }
  });

  it("matches what the guns are", () => {
    expect(gunRatings(GUNS.chem_flamer).damage).toBe(5);
    expect(gunRatings(GUNS.kreddler).rate).toBe(5);
    expect(gunRatings(GUNS.bfk).rate).toBe(1);
    expect(gunRatings(GUNS.sniper).range).toBe(5);
    expect(gunRatings(GUNS.chainsaw).range).toBe(1);
    expect(gunRatings(GUNS.rail).accuracy).toBe(5);
    expect(gunRatings(GUNS.pistol).special).toBe(1);
    expect(gunRatings(GUNS.bfk).special).toBe(5);
    expect(gunRatings(GUNS.sniper).damage).toBeGreaterThan(gunRatings(GUNS.pistol).damage);
    expect(gunRatings(GUNS.smg).accuracy).toBeGreaterThan(gunRatings(GUNS.shotgun).accuracy);
  });

  it("normalises against the list it's given", () => {
    const a = { ...GUNS.pistol, id: "a", dmg: 10 } as GunDef;
    const b = { ...GUNS.pistol, id: "b", dmg: 20 } as GunDef;
    expect(gunRatings(a, [a, b]).damage).toBe(1);
    expect(gunRatings(b, [a, b]).damage).toBe(5);
    expect(gunRatings(a, [a, b]).range).toBe(3); // all equal: middle
  });
});

describe("weapon order", () => {
  const withGuns = (guns: Record<string, number>) => {
    const s = newGameState("KREZMAR");
    s.guns = { ...guns };
    return s;
  };

  it("defaults to strongest first; saved order first, unlisted owned guns after", () => {
    const s = withGuns({ pistol: 5, rocket: 3, smg: 0 });
    expect(orderedGuns(s)).toEqual(["rocket", "smg", "pistol"]);
    s.gunOrder = ["pistol", "nope", "flamer"];
    expect(orderedGuns(s)).toEqual(["pistol", "rocket", "smg"]);
  });

  it("moveGun reorders and saves the full order", () => {
    const s = withGuns({ pistol: 5, rocket: 3, smg: 2 });
    moveGun(s, "pistol", 0);
    expect(s.gunOrder).toEqual(["pistol", "rocket", "smg"]);
    moveGun(s, "pistol", 2);
    expect(orderedGuns(s)).toEqual(["rocket", "smg", "pistol"]);
    moveGun(s, "smg", -5);
    expect(orderedGuns(s)).toEqual(["smg", "rocket", "pistol"]);
  });

  it("first loaded and next loaded follow the order and skip empty guns", () => {
    const s = withGuns({ pistol: 5, rocket: 0, smg: 2, shotgun: 4 });
    s.gunOrder = ["rocket", "smg", "pistol", "shotgun"];
    expect(firstLoaded(s)).toBe("smg");
    expect(nextLoaded(s, "smg")).toBe("pistol");
    expect(nextLoaded(s, "shotgun")).toBe("smg"); // wraps, skipping the empty rocket
    s.guns = { rocket: 0 };
    expect(nextLoaded(s, "rocket")).toBeNull();
    expect(firstLoaded(s)).toBeNull();
  });

  it("old saves get an empty order; junk is dropped", () => {
    const s = migrateState({ ...newGameState("KREZMAR"), gunOrder: undefined })!;
    expect(s.gunOrder).toEqual([]);
    const t = migrateState({ ...newGameState("KREZMAR"), gunOrder: ["smg", 4, "zzz", "smg", "pistol"] })!;
    expect(t.gunOrder).toEqual(["smg", "pistol"]);
  });
});

describe("rack ammo and upgrades", () => {
  it("buys ammo with the Exchange's box price, up to full", () => {
    const s = newGameState("KREZMAR");
    s.guns = { pistol: 0 };
    s.coins = 1000;
    const q = ammoQuote(s, "pistol");
    expect(q.unit).toBe(ammoUnitCost("pistol"));
    expect(q.boxes).toBe(Math.ceil(GUNS.pistol.maxAmmo / GUNS.pistol.pickup));
    expect(buyAmmo(s, "pistol")).toBe(q.boxes);
    expect(s.guns.pistol).toBe(GUNS.pistol.maxAmmo);
    expect(s.coins).toBe(1000 - q.fill);
    expect(buyAmmo(s, "pistol")).toBe(0);
    expect(ammoQuote(s, "pistol").full).toBe(true);
  });

  it("can't buy what you can't afford", () => {
    const s = newGameState("KREZMAR");
    s.guns = { sniper: 0 };
    s.coins = ammoUnitCost("sniper") - 1;
    expect(buyAmmo(s, "sniper")).toBe(0);
    expect(s.guns.sniper).toBe(0);
  });

  it("lists applied gun upgrades and what's still for sale", () => {
    const s = newGameState("KREZMAR");
    expect(gunUpgrades(s).applied).toEqual([]);
    s.upgrades.pk_rof = 3;
    s.upgrades.kd_gold = 1;
    const u = gunUpgrades(s);
    expect(u.applied.map((a) => a.u.key).sort()).toEqual(["kd_gold", "pk_rof"]);
    expect(u.available.some((a) => a.key === "pk_rof")).toBe(false);
    expect(u.available.some((a) => a.key === "pk_ammo")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { GUNS } from "../src/data/guns";
import { CHARACTERS } from "../src/data/characters";
import { applyLoadout, loadoutSummary, sanitizeLoadout, snapshotLoadout } from "../src/game/systems/carry";
import { gunMaxFor } from "../src/game/systems/armoury";
import { MemoryStore, newGameState, SaveManager } from "../src/game/systems/state";

const gunIds = Object.keys(GUNS).filter((id) => id !== "chem_flamer");

/** A finished run with some kit and some story. */
function finished() {
  const s = newGameState("FLENKY");
  s.chapter = 7;
  s.flags = { game_complete: true, ch3_clear: true };
  s.quests = { q1: 2 };
  s.guns = { [gunIds[0]]: 3, [gunIds[1]]: 0, chem_flamer: 40 };
  s.gun = gunIds[0];
  s.gunOrder = [gunIds[1], gunIds[0]];
  s.upgrades = { hp: 2, pk_ammo: 1, fairies: 3, fl1: 1, fl2: 1 };
  s.coins = 1234;
  s.bottles = 5;
  s.bongos = 3;
  return s;
}

describe("carried loadout (finish the game, keep your kit)", () => {
  it("snapshots gear but no story, and leaves out the raid flamethrower", () => {
    const lo = snapshotLoadout(finished(), 42)!;
    expect(lo.from).toBe("FLENKY");
    expect(Object.keys(lo.guns).sort()).toEqual([gunIds[0], gunIds[1]].sort());
    expect(lo.gun).toBe(gunIds[0]);
    expect(lo.gunOrder).toEqual([gunIds[1], gunIds[0]]);
    expect(lo.upgrades).toEqual({ hp: 2, pk_ammo: 1, fairies: 3, fl1: 1, fl2: 1 });
    expect(lo).toMatchObject({ coins: 1234, bottles: 5, bongos: 3, at: 42 });
    expect(lo as any).not.toHaveProperty("flags");
    expect(lo as any).not.toHaveProperty("chapter");
  });

  it("debug-mode runs don't save a loadout", () => {
    const s = finished();
    s.flags.debug_mode = true;
    expect(snapshotLoadout(s)).toBeNull();
  });

  it("a new game with the same lad starts with the kit, guns full, story fresh", () => {
    const lo = snapshotLoadout(finished())!;
    const s = newGameState("FLENKY");
    expect(applyLoadout(s, lo)).toBe(true);
    expect(s.chapter).toBe(1);
    expect(s.flags).toEqual({});
    expect(s.quests).toEqual({});
    expect(s.upgrades).toMatchObject({ hp: 2, pk_ammo: 1, fairies: 3, fl1: 1, fl2: 1 });
    for (const id of [gunIds[0], gunIds[1]]) expect(s.guns![id]).toBe(gunMaxFor(GUNS[id], s));
    expect(s.guns!.chem_flamer).toBeUndefined();
    expect(s.gun).toBe(gunIds[0]);
    expect(s.gunOrder!.slice(0, 2)).toEqual([gunIds[1], gunIds[0]]);
    expect(s.coins).toBe(1234);
    expect(s.bottles).toBe(5);
    expect(s.bongos).toBe(3);
  });

  it("another lad keeps the shared kit but not Flenky's skill tree", () => {
    const lo = snapshotLoadout(finished())!;
    const other = Object.keys(CHARACTERS).find((id) => id !== "FLENKY" && CHARACTERS[id].playable && CHARACTERS[id].branch?.length)!;
    const s = newGameState(other as any);
    applyLoadout(s, lo);
    expect(s.upgrades.hp).toBe(2);
    expect(s.upgrades.fl1).toBeUndefined();
    expect(s.upgrades.fl2).toBeUndefined();
    expect(Object.keys(s.guns!)).toContain(gunIds[0]);
  });

  it("no loadout: a new game is untouched", () => {
    const s = newGameState("FLENKY");
    const before = JSON.stringify(s);
    expect(applyLoadout(s, undefined)).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("survives the meta save, and repairs junk from storage", () => {
    const store = new MemoryStore();
    const saves = new SaveManager(store);
    const m = saves.loadMeta();
    expect(m.carry).toBeUndefined();
    m.carry = snapshotLoadout(finished())!;
    saves.saveMeta(m);
    expect(saves.loadMeta().carry).toEqual(m.carry);
    // old metas without it, and junk
    store.setItem("krelworld.meta", JSON.stringify({ ngPlusUnlocked: true }));
    expect(saves.loadMeta().carry).toBeUndefined();
    const fixed = sanitizeLoadout({ from: "NOBODY", guns: { nope: 5, [gunIds[0]]: "x", [gunIds[1]]: 7 }, gun: "nope", gunOrder: [gunIds[1], 3, gunIds[1]], upgrades: { hp: NaN, dmg: 2 }, coins: -5 })!;
    expect(fixed).toMatchObject({ from: "FLENKY", guns: { [gunIds[1]]: 7 }, gun: undefined, gunOrder: [gunIds[1]], upgrades: { dmg: 2 }, coins: 0, bottles: 0, bongos: 0 });
    expect(loadoutSummary(fixed)).toBe("1 gun · 1 upgrade · 0 coins");
  });
});

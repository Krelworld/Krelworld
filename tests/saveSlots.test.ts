import { describe, expect, it } from "vitest";
import { MemoryStore, migrateSlots, newGameState, SaveManager, serialize } from "../src/game/systems/state";
import { AUTO_KEY, formatPlaytime, formatSavedAt, mostRecentSlot, parseSlot, slotKey, SLOTS_MIGRATED_KEY, summarizeSlot } from "../src/game/systems/saveSlots";

describe("save slots: storage", () => {
  it("AUTO is the old single-save key; manual slots have their own", () => {
    expect(slotKey("auto")).toBe("krelworld.save");
    expect(slotKey("auto")).toBe(AUTO_KEY);
    expect(new Set([slotKey(1), slotKey(2), slotKey(3), slotKey("auto")]).size).toBe(4);
  });

  it("each slot saves and loads on its own, and stamps the time", () => {
    let t = 1000;
    const sm = new SaveManager(new MemoryStore(), () => t);
    const a = newGameState("KREBON");
    a.coins = 5;
    sm.save(a);
    t = 2000;
    const b = newGameState("MIKEY");
    b.chapter = 4;
    sm.save(b, 2);
    expect(sm.load()!.player).toBe("KREBON");
    expect(sm.load()!.savedAt).toBe(1000);
    expect(sm.load(2)!.player).toBe("MIKEY");
    expect(sm.load(2)!.chapter).toBe(4);
    expect(sm.load(1)).toBeNull();
    expect(sm.load(3)).toBeNull();
    expect(sm.hasSave()).toBe(true);
    // newest wins CONTINUE
    expect(sm.latest()).toBe(2);
    sm.clear(2);
    expect(sm.load(2)).toBeNull();
    expect(sm.latest()).toBe("auto");
    sm.clear();
    expect(sm.hasSave()).toBe(false);
    expect(sm.latest()).toBeNull();
  });

  it("only a manual slot alone still counts as a save", () => {
    const sm = new SaveManager(new MemoryStore());
    sm.save(newGameState("FLENKY"), 3);
    expect(sm.hasSave()).toBe(true);
    expect(sm.latest()).toBe(3);
  });

  it("where / objective survive a round trip; junk in them is dropped", () => {
    const store = new MemoryStore();
    const sm = new SaveManager(store);
    const s = newGameState("SCROMBUS");
    s.where = "Krelford · The Krezz Arms";
    s.objective = "Go to the pub";
    sm.save(s, 1);
    expect(sm.load(1)!.where).toBe("Krelford · The Krezz Arms");
    expect(sm.load(1)!.objective).toBe("Go to the pub");
    store.setItem(slotKey(2), JSON.stringify({ ...newGameState("SCROMBUS"), where: 42, objective: {}, savedAt: "yesterday" }));
    const j = sm.load(2)!;
    expect(j.where).toBeUndefined();
    expect(j.objective).toBeUndefined();
    expect(j.savedAt).toBeUndefined();
  });
});

describe("save slots: migration from the single save", () => {
  it("an old save becomes AUTO and is copied into SLOT 1, once", () => {
    const store = new MemoryStore();
    const old = newGameState("KREZMAR");
    old.chapter = 3;
    old.playtimeMs = 3_600_000;
    delete (old as any).savedAt;
    store.setItem("krelworld.save", serialize(old));
    const sm = new SaveManager(store);
    expect(sm.load("auto")!.chapter).toBe(3);
    expect(sm.load(1)!.chapter).toBe(3);
    expect(sm.load(1)!.player).toBe("KREZMAR");
    expect(store.getItem(SLOTS_MIGRATED_KEY)).toBeTruthy();
    // deleting slot 1 later doesn't bring it back
    sm.clear(1);
    new SaveManager(store);
    expect(sm.load(1)).toBeNull();
    // and an undated old save still loads first on CONTINUE
    expect(sm.latest()).toBe("auto");
  });

  it("nothing to migrate: no slot appears", () => {
    const store = new MemoryStore();
    expect(migrateSlots(store)).toBe(false);
    expect(new SaveManager(store).hasSave()).toBe(false);
  });

  it("a garbage old save is not copied", () => {
    const store = new MemoryStore();
    store.setItem("krelworld.save", "{nope");
    expect(migrateSlots(store)).toBe(false);
    expect(store.getItem(slotKey(1))).toBeNull();
  });

  it("never overwrites a slot that's already filled", () => {
    const store = new MemoryStore();
    store.setItem("krelworld.save", serialize(newGameState("FLENKY")));
    store.setItem(slotKey(2), serialize(newGameState("MIKEY")));
    expect(migrateSlots(store)).toBe(false);
    expect(store.getItem(slotKey(1))).toBeNull();
  });
});

describe("save slots: summary", () => {
  it("formats playtime as h:mm", () => {
    expect(formatPlaytime(0)).toBe("0:00");
    expect(formatPlaytime(59_000)).toBe("0:00");
    expect(formatPlaytime(5 * 60_000)).toBe("0:05");
    expect(formatPlaytime(2 * 3_600_000 + 14 * 60_000 + 30_000)).toBe("2:14");
    expect(formatPlaytime(NaN)).toBe("0:00");
  });

  it("formats when it was saved", () => {
    const now = new Date(2026, 10, 18, 15, 0).getTime();
    expect(formatSavedAt(new Date(2026, 10, 18, 14, 5).getTime(), now)).toBe("Today 14:05");
    expect(formatSavedAt(new Date(2026, 10, 17, 9, 2).getTime(), now)).toBe("Yesterday 09:02");
    expect(formatSavedAt(new Date(2026, 10, 3, 22, 40).getTime(), now)).toBe("3 Nov 2026 · 22:40");
    expect(formatSavedAt(undefined, now)).toBe("");
  });

  it("empty slots say so", () => {
    const e = summarizeSlot(2, null);
    expect(e.empty).toBe(true);
    expect(e.label).toBe("SLOT 2");
    expect(summarizeSlot("auto", null).label).toBe("AUTO");
  });

  it("a filled slot shows who, which chapter, where, difficulty, NG+, playtime, coins", () => {
    const s = newGameState("MIKEY", 1, undefined, 4);
    s.chapter = 3;
    s.playtimeMs = 75 * 60_000;
    s.coins = 1234;
    s.where = "Da Drongus Dungeon · room 3/6";
    s.objective = "Find the crystal";
    s.savedAt = new Date(2026, 10, 18, 14, 5).getTime();
    const x = summarizeSlot(1, s, new Date(2026, 10, 18, 20, 0).getTime());
    expect(x.empty).toBe(false);
    expect(x.playerName).toMatch(/MIKEY/);
    expect(x.chapter).toBe(3);
    expect(x.chapterLine).toBe("CH 3 · THE CUDDLE CRONSTER");
    expect(x.where).toBe("Da Drongus Dungeon · room 3/6");
    expect(x.objective).toBe("Find the crystal");
    expect(x.difficultyText).toBe("Difficulty 4/5");
    expect(x.ngPlus).toBe(1);
    expect(x.playtime).toBe("1:15");
    expect(x.coins).toBe(1234);
    expect(x.savedText).toBe("Today 14:05");
  });

  it("old saves without the new fields still summarise", () => {
    const s = newGameState("FLENKY");
    const x = summarizeSlot("auto", s);
    expect(x.where).toBe("Krelford");
    expect(x.savedText).toBe("");
    expect(x.chapterLine).toBe("CH 1 · THE GREAT SILENCE");
  });

  it("a finished run says THE END", () => {
    const s = newGameState("FLENKY");
    s.phase = "ended";
    expect(summarizeSlot(1, s).chapterLine).toMatch(/THE END/);
  });

  it("mostRecentSlot picks the newest; undated saves lose to dated ones", () => {
    const a = { ...newGameState("FLENKY"), savedAt: 5 };
    const b = { ...newGameState("FLENKY"), savedAt: 9 };
    const old = newGameState("FLENKY");
    expect(mostRecentSlot([{ id: "auto", s: a }, { id: 1, s: b }, { id: 2, s: null }])).toBe(1);
    expect(mostRecentSlot([{ id: "auto", s: old }, { id: 3, s: old }])).toBe("auto");
    expect(mostRecentSlot([{ id: "auto", s: null }])).toBeNull();
  });

  it("parseSlot", () => {
    expect(parseSlot("auto")).toBe("auto");
    expect(parseSlot("2")).toBe(2);
    expect(parseSlot(4)).toBeNull();
  });
});

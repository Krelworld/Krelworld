// Stage 3 fix round 1: the pure rules behind the texture budget's families, retries and offline copy (R1-R4), and the
// sound pool's reuse, letting go and stray-song check (R5-R8).
import { describe, expect, it } from "vitest";
import { family, HOLD_MAX_MS, HOLD_SCENES, offlineCacheName, parkable, retryDelay } from "../src/game/mobile/artLogic";
import { isStray, KEEP_PER_KIND, MUSIC_POOL, pickSlot, RETIRE_MS, sparesToDrop, VOICE_POOL, type PoolSlot } from "../src/game/mobile/audioLogic";

describe("texture budget fixes (artLogic)", () => {
  it("a boss's sheets are one family (R3): the fighting sheet brings its death, down and move sheets and its close-up", () => {
    expect(family("bossanim_troll").sort()).toEqual(["bossdie_troll", "bossdown_troll", "bossmove_troll", "kcv_troll"].sort());
    expect(family("bossdie_dark_drongus")).toContain("bossanim_dark_drongus");
    expect(family("bossdie_dark_drongus")).toContain("bossmove_dark_drongus");
    for (const k of family("bossanim_pudding_demon")) expect(parkable(k), k).toBe(true);
    for (const k of ["tvface_MARK", "vs_brand", "kcv_brand", "spr_FLENKY", "fe_still_dawn"]) expect(family(k), k).toEqual([]);
  });

  it("a failed fetch is retried after 2, 4, 8, 16 then every 30 s, never at once (R2)", () => {
    expect(retryDelay(0)).toBe(0);
    expect([1, 2, 3, 4, 5, 6, 20].map(retryDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it("the offline copy is named after the art (new art never comes from an old copy)", () => {
    const a = offlineCacheName(JSON.stringify({ images: { x: { file: "a.png" } } }));
    expect(a).toMatch(/^krel-art-[0-9a-z]+$/);
    expect(offlineCacheName(JSON.stringify({ images: { x: { file: "a.png" } } }))).toBe(a);
    expect(offlineCacheName(JSON.stringify({ images: { x: { file: "b.png" } } }))).not.toBe(a);
  });

  it("the VS card and the finisher close-up wait a moment at most for their pictures (R4)", () => {
    expect(HOLD_SCENES).toEqual(expect.arrayContaining(["VsSplash", "KrelCine"]));
    expect(HOLD_MAX_MS).toBeGreaterThanOrEqual(500);
    expect(HOLD_MAX_MS).toBeLessThanOrEqual(1500);
  });
});

const slot = (o: Partial<PoolSlot>): PoolSlot => ({ kind: "music", busy: false, pooled: false, played: false, routed: true, ...o });

describe("sound pool fixes (audioLogic)", () => {
  it("four songs and two voices are unlocked by the first tap (R5)", () => {
    expect(MUSIC_POOL).toBe(4);
    expect(VOICE_POOL).toBe(2);
  });

  it("a new song gets a free pooled element first, then a spare that has played, never a busy one or one no tap unlocked", () => {
    const items = [slot({ pooled: true, busy: true }), slot({ played: true }), slot({ pooled: true }), slot({ kind: "voice", pooled: true })];
    expect(pickSlot(items, "music", true)).toBe(2);
    items[2].busy = true;
    expect(pickSlot(items, "music", true)).toBe(1);
    items[1].busy = true;
    expect(pickSlot(items, "music", true)).toBe(-1);
    expect(pickSlot([slot({})], "music", true)).toBe(-1);
    expect(pickSlot(items, "voice", true)).toBe(3);
  });

  it("once the route proved silent, songs and voices only get elements that are not routed (R7)", () => {
    const items = [slot({ kind: "voice", pooled: true, routed: true }), slot({ kind: "voice", played: true, routed: false })];
    expect(pickSlot(items, "voice", false)).toBe(1);
    expect(pickSlot([items[0]], "voice", false)).toBe(-1);
    expect(pickSlot([items[0]], "voice", true)).toBe(0);
  });

  it("lets go of free spares that never played, and of free spares beyond the keep, never a pooled or busy one (R5, R6)", () => {
    const items = [slot({ pooled: true }), slot({ busy: true }), slot({}), slot({ played: true }), slot({ kind: "voice", busy: true })];
    expect(sparesToDrop(items)).toEqual([2]);
    const many = Array.from({ length: KEEP_PER_KIND + 3 }, () => slot({ played: true }));
    expect(sparesToDrop(many)).toEqual([KEEP_PER_KIND, KEEP_PER_KIND + 1, KEEP_PER_KIND + 2]);
  });

  it("a song in its fade-out, or one just handed out, is never stopped as a stray; a real stray is (R8)", () => {
    const base = { current: false, fading: false, src: "music/x.mp3", now: 10000, lastCurrentAt: 0, takenAt: 0 };
    expect(isStray(base)).toBe(true);
    expect(isStray({ ...base, current: true })).toBe(false);
    expect(isStray({ ...base, fading: true })).toBe(false);
    expect(isStray({ ...base, src: "" })).toBe(false);
    expect(isStray({ ...base, src: "data:audio/wav;base64,xx" })).toBe(false);
    // (the current song a moment ago: Synth's fade-out can outlive its fading set)
    expect(isStray({ ...base, lastCurrentAt: 10000 - RETIRE_MS + 1 })).toBe(false);
    expect(isStray({ ...base, lastCurrentAt: 10000 - RETIRE_MS })).toBe(true);
    expect(isStray({ ...base, takenAt: 10000 - 100 })).toBe(false);
  });
});

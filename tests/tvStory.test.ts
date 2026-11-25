import { describe, expect, it } from "vitest";
import { ALL_EPISODES, STORY_EPISODES } from "../src/content/television/channels";

// the game's source, as text (to check the story actually plays each broadcast)
const SRC = import.meta.glob(["../src/**/*.ts", "!../src/content/television/**", "!../src/game/scenes/TVScene.ts"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

describe("the story's TV broadcasts", () => {
  it("are all real episodes", () => {
    for (const id of STORY_EPISODES) expect(ALL_EPISODES.some((e) => e.id === id)).toBe(true);
  });
  it("are each played by the story somewhere (so they can turn up on demand once seen)", () => {
    const src = Object.values(SRC).join("\n");
    for (const id of STORY_EPISODES) expect(new RegExp(`(tv|episode): "${id}"`).test(src)).toBe(true);
  });
});

describe("shows taken off the telly", () => {
  it("are gone", () => {
    for (const id of ["krews_sunak_bomb", "krews_cookie", "news_1", "shopping"]) expect(ALL_EPISODES.some((e) => e.id === id)).toBe(false);
  });
});

describe("Peep Show", () => {
  it("is an ordinary show you can watch from the start (and from the title)", () => {
    const e = ALL_EPISODES.find((x) => x.id === "beep_show");
    expect(e).toBeTruthy();
    expect(e!.unlockFlag).toBeUndefined();
    expect(STORY_EPISODES.has("beep_show")).toBe(false);
  });
});

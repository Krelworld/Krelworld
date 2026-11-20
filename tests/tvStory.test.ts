import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { ALL_EPISODES, STORY_EPISODES } from "../src/content/television/channels";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

describe("the story's TV broadcasts", () => {
  it("are all real episodes", () => {
    for (const id of STORY_EPISODES) expect(ALL_EPISODES.some((e) => e.id === id)).toBe(true);
  });
  it("are each played by the story somewhere (so they can turn up on demand once seen)", () => {
    const src = walk("src")
      .filter((f) => f.endsWith(".ts") && !f.includes("television") && !f.endsWith("TVScene.ts"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    for (const id of STORY_EPISODES) expect(new RegExp(`(tv|episode): "${id}"`).test(src)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { CINE, cineKeys, type CineStep } from "../src/content/cine";
import { CHAPTERS } from "../src/content/chapters/chapters";
import { BOSS_TEXT } from "../src/content/bosses";
import type { Line } from "../src/data/types";
import manifestJson from "../public/art/manifest.json";
import dungeonSrc from "../src/game/scenes/DungeonScene.ts?raw";
import hubSrc from "../src/game/scenes/HubScene.ts?raw";
import vignetteSrc from "../src/game/scenes/VignetteScene.ts?raw";
import superSrc from "../src/game/combat/Super.ts?raw";

const manifest = manifestJson as unknown as Record<string, Record<string, unknown>>;
const has = (k: string) => Object.values(manifest).some((cat) => k in cat);

describe("anime cine beats (chapters 1-5)", () => {
  it("every still, cut-in and eye shot a beat uses is registered art", () => {
    expect(cineKeys().filter((k) => !has(k))).toEqual([]);
  });

  it("every gore-off still is registered art", () => {
    const missing: string[] = [];
    const walk = (st: CineStep) => {
      if ("par" in st) st.par.forEach(walk);
      else if ("still" in st && st.goreOff && !has(st.goreOff)) missing.push(st.goreOff);
    };
    Object.values(CINE).forEach((b) => b.forEach(walk));
    expect(missing).toEqual([]);
  });

  it("every cine named in the chapter and boss scripts exists", () => {
    const lines: Line[] = [];
    for (const ch of CHAPTERS) lines.push(...ch.intro, ...ch.outro, ...Object.values(ch.playerScene).flat());
    for (const b of Object.values(BOSS_TEXT)) lines.push(...b.intro, ...b.outro);
    const named = lines.map((l) => l.cine).filter((c): c is string => !!c);
    expect(named.length).toBeGreaterThan(20);
    expect(named.filter((c) => !CINE[c])).toEqual([]);
  });

  it("the scenes only name beats that exist", () => {
    const src = [dungeonSrc, hubSrc, vignetteSrc, superSrc].join("\n");
    const used = [...src.matchAll(/playCine\(this|playCine\(sc/g)].length;
    expect(used).toBeGreaterThan(0);
    const names = [...src.matchAll(/(?:playCine\([a-z]+, |cine: )"([a-z0-9_]+)"/g)].map((m) => m[1]);
    expect(names.filter((c) => !CINE[c])).toEqual([]);
  });
});

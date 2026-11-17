import { describe, expect, it } from "vitest";
import { KREL_BEATS } from "../src/game/combat/krelBeats";
import manifestJson from "../public/art/manifest.json";

// The Kreltality art: the lads' 16-frame action sheets and the victims' reaction sheets (combat/KrelArt.ts).
const manifest = manifestJson as unknown as { sheets: Record<string, { file: string; frameWidth: number; frameHeight: number }> };
const pngs = import.meta.glob("../public/art/krel/*.png", { query: "?inline", import: "default", eager: true }) as Record<string, string>;
/** width and height out of a PNG's header */
const pngSize = (file: string) => {
  const url = pngs[`../public/art/${file}`];
  if (!url) throw new Error(`no ${file}`);
  const head = atob(url.slice(url.indexOf(",") + 1, url.indexOf(",") + 1 + 32));
  const u32 = (o: number) => ((head.charCodeAt(o) << 24) | (head.charCodeAt(o + 1) << 16) | (head.charCodeAt(o + 2) << 8) | head.charCodeAt(o + 3)) >>> 0;
  return { w: u32(16), h: u32(20) };
};

describe("Kreltality art", () => {
  it("each lad's key poses land on frames of his 16-frame row, in order", () => {
    for (const [lad, verbs] of Object.entries(KREL_BEATS)) {
      for (const [verb, b] of Object.entries(verbs)) {
        expect(b, `${lad} ${verb}`).toHaveLength(9);
        expect(b![0], `${lad} ${verb}`).toBe(0);
        // the wind-up and the strike each get frames of their own; a late strike can share its follow-through's
        for (let i = 1; i <= 6; i++) expect(b![i], `${lad} ${verb} ${i}`).toBeGreaterThan(b![i - 1]);
        for (let i = 7; i < 9; i++) expect(b![i], `${lad} ${verb} ${i}`).toBeGreaterThanOrEqual(b![i - 1]);
        expect(b![8], `${lad} ${verb}`).toBeLessThanOrEqual(15);
      }
    }
  });

  it("the action sheets are 9 or 16 frames across, 10 rows down", () => {
    for (const [key, e] of Object.entries(manifest.sheets).filter(([k]) => k.startsWith("krelact_"))) {
      const { w, h } = pngSize(e.file);
      expect([9, 16], key).toContain(w / 96);
      expect(h, key).toBe(800);
      // a lad with key poses listed has his 16-frame sheet
      const lad = key.slice("krelact_".length);
      if (KREL_BEATS[lad]) expect(w, key).toBe(16 * 96);
    }
  });

  it("each victim's reaction sheet is three rows of its own boss's cell", () => {
    const vics = Object.entries(manifest.sheets).filter(([k]) => k.startsWith("krelvic_"));
    expect(vics.length).toBeGreaterThan(0);
    for (const [key, e] of vics) {
      const boss = manifest.sheets[`bossanim_${key.slice("krelvic_".length)}`];
      expect(boss, key).toBeTruthy();
      expect([e.frameWidth, e.frameHeight], key).toEqual([boss.frameWidth, boss.frameHeight]);
      const { w, h } = pngSize(e.file);
      expect(h, key).toBe(e.frameHeight * 3);
      expect(w % e.frameWidth, key).toBe(0);
    }
  });
});

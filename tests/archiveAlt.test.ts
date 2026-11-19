import { afterEach, describe, expect, it } from "vitest";
import { ALT, setAltForTests } from "../src/game/variant";
import { ARCHIVE, ARCHIVE_BY_ID } from "../src/content/archive/historicalScenes";
import { ARCHIVE_UNDATED, MIKEY_ARCHIVE_ALT, weaveMikeyAlt } from "../src/content/archive/mikeyAltQuotes";
import { CANON } from "../src/content/archive/canonQuotes";
import { resolveLine } from "../src/game/systems/narrative";
import { newGameState } from "../src/game/systems/state";

// The ALT build's Historical Archive: Mikey in the Krelworld-era chat, and no dates or times (mikeyAltQuotes.ts).
afterEach(() => setAltForTests(ALT));

const mikeyLines = (list: typeof ARCHIVE) => list.flatMap((e) => e.original.filter((l) => l.s === "MIKEY" && l.cond?.alt === true));
const CLOCK = /\b\d{1,2}:\d{2}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

describe("the ALT Archive", () => {
  it("the normal build's Archive has none of Mikey's ALT lines, and keeps its dates and footnotes", () => {
    expect(ALT).toBe(false);
    expect(mikeyLines(ARCHIVE)).toHaveLength(0);
    expect(ARCHIVE_BY_ID.arch_scrombus_arrival.footnote).toContain("21:46 on 31 December 2024");
    expect(ARCHIVE_BY_ID.arch_motto.original.some((l) => l.t === "Nine days later:")).toBe(true);
  });

  it("the ALT Archive has every one of them, each where it was meant to go", () => {
    const alt = weaveMikeyAlt(ARCHIVE);
    const want = Object.values(MIKEY_ARCHIVE_ALT).flatMap((d) => d.flatMap((x) => x.lines));
    expect(want.length).toBeGreaterThanOrEqual(40);
    expect(mikeyLines(alt).map((l) => l.t).sort()).toEqual([...want].sort());
    for (const [id, drops] of Object.entries(MIKEY_ARCHIVE_ALT)) {
      const e = alt.find((a) => a.id === id)!;
      expect(e, id).toBeTruthy();
      expect(e.era).toBe("KRELWORLD");
      for (const d of drops) {
        const i = e.original.findIndex((l) => l.canon === d.after);
        expect(i, `${id} after ${d.after}`).toBeGreaterThanOrEqual(0);
        expect(e.original[i + 1].t, `${id} after ${d.after}`).toBe(d.lines[0]);
      }
    }
  });

  it("his lines only resolve in the ALT build", () => {
    const l = mikeyLines(weaveMikeyAlt(ARCHIVE))[0];
    const s = newGameState("KREBON");
    setAltForTests(false);
    expect(resolveLine(l, s)).toBeNull();
    setAltForTests(true);
    expect(resolveLine(l, s)!.t).toBe(l.t);
  });

  it("no dates or clock times in the ALT Archive's footnotes, annotations or reenactment directions", () => {
    const alt = weaveMikeyAlt(ARCHIVE);
    for (const e of alt) {
      for (const t of [e.footnote ?? "", e.drongusAnnotation ?? "", ...e.original.filter((l) => l.dir).map((l) => l.t)]) expect(CLOCK.test(t), `${e.id}: ${t}`).toBe(false);
      for (const l of e.original.filter((x) => x.dir)) expect(/\b(days?|weeks?|minutes?|hours?) later\b/i.test(l.t), `${e.id}: ${l.t}`).toBe(false);
    }
    for (const id of Object.keys(ARCHIVE_UNDATED)) expect(ARCHIVE_BY_ID[id], id).toBeTruthy();
    // canon quotes keep their source timestamps for the normal build; the ALT Archive never shows them
    expect(Object.values(CANON).some((c) => c.sourceTimestamp)).toBe(true);
  });
});

import { CHAPTERS } from "../src/content/chapters/chapters";
import { migrateState } from "../src/game/systems/state";
describe("the founding is optional", () => {
  it("chapter 1 has no compulsory Archive step", () => {
    const ch1 = (CHAPTERS as any[]).find((c) => c.n === 1);
    expect(ch1.steps.some((st: any) => st.target === "ARCHIVE")).toBe(false);
  });
  it("old saves past the Emergency Session get the side quests", () => {
    const s = migrateState({ player: "FLENKY", chapter: 1, flags: { met_emergency: true } })!;
    expect(s.flags.ministerial_quests).toBe(true);
  });
});

describe("cuddle tokens: two batches", () => {
  it("old saves keep their indoor finds and drop the outdoor ones", () => {
    const s = migrateState({ player: "FLENKY", chapter: 3, version: 3, flags: { arcspot_arc_cronster_tokens_0: true, arcspot_arc_cronster_tokens_5: true } })!;
    expect(s.flags.arcspot_arc_cronster_tokens_0).toBeUndefined();
    expect(s.flags.arcspot_arc_cronster_tokens_1).toBe(true);
    const again = migrateState(JSON.parse(JSON.stringify(s)))!;
    expect(again.flags.arcspot_arc_cronster_tokens_1).toBe(true);
  });
});

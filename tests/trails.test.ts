import { describe, expect, it } from "vitest";
import { newGameState } from "../src/game/systems/state";
import { activeTrail, clueAt, clueFlag, settleOldTrails, takeClue, trailDoneFlag, trailFor, trailObjective, TRAILS } from "../src/game/systems/trails";
import { CHAPTERS } from "../src/content/chapters/chapters";
import { evalCond } from "../src/game/systems/conditions";
import type { GameState } from "../src/data/types";

function at(chapter: number, flags: Record<string, boolean> = {}): GameState {
  const s = newGameState("FLENKY");
  s.chapter = chapter;
  Object.assign(s.flags, { trails_v1: true }, flags);
  return s;
}

describe("explore-before-the-dungeon trails", () => {
  it("chapter 4 has a short trail: one clue outdoors, the rest indoors in different rooms", () => {
    for (const n of [4]) {
      const t = trailFor(n)!;
      expect(t, `chapter ${n}`).toBeTruthy();
      expect(t.clues.length).toBeGreaterThanOrEqual(4);
      expect(t.clues.length).toBeLessThanOrEqual(6);
      const out = t.clues.filter((c) => c.where === "FIELD");
      expect(out.length).toBe(1);
      expect(out[0].near).toBeTruthy();
      const rooms = t.clues.filter((c) => c.where !== "FIELD").map((c) => c.where);
      expect(new Set(rooms).size).toBe(rooms.length);
      // the chapter's s_trail step (before the dungeon) is finished by the trail's done flag
      const ch = CHAPTERS[n - 1];
      const i = ch.steps.findIndex((st) => st.id === "s_trail");
      expect(i).toBeGreaterThan(-1);
      expect(ch.steps[i + 1].id).toBe("s_dungeon");
      expect(ch.steps[i].done.flag).toBe(trailDoneFlag(t));
    }
    // chapter 3 keeps its own cuddle-token hunt; chapter 2's receipts trail was taken out
    expect(trailFor(3)).toBeNull();
    expect(trailFor(2)).toBeNull();
  });

  it("starts after the chapter's last beat, outdoor clue first, then the indoor ones in any order, then opens the door", () => {
    const t = trailFor(4)!;
    const s = at(4);
    expect(activeTrail(s)).toBeNull();
    s.flags[t.startFlag] = true;
    const a = activeTrail(s)!;
    expect(a.got).toBe(0);
    expect(trailObjective(s)!.target).toBe("POLICE");
    // indoor ones don't turn up till the outdoor one's found
    expect(clueAt(s, "HOME")).toBeNull();
    expect(takeClue(s, "HOME")).toBeNull();
    const first = takeClue(s, "FIELD")!;
    expect(first.toast).toBe(`${t.label} 1/${t.clues.length}`);
    expect(first.lines).toEqual(expect.arrayContaining(t.indoors));
    expect(clueAt(s, "FIELD")).toBeNull();
    // the rest, backwards (any order)
    const rooms = t.clues.filter((c) => c.where !== "FIELD").map((c) => c.where).reverse();
    rooms.forEach((w, k) => {
      expect(clueAt(s, w), w).toBeTruthy();
      expect(trailObjective(s)!.text).toContain(t.clues.find((c) => c.where === w)!.hint);
      const r = takeClue(s, w)!;
      expect(r.toast.startsWith(`${t.label} ${k + 2}/${t.clues.length}`)).toBe(true);
      expect(takeClue(s, w)).toBeNull();
      if (k === rooms.length - 1) {
        expect(r.done).toBe(true);
        expect(r.lines).toEqual(expect.arrayContaining(t.done));
      }
    });
    expect(s.flags[trailDoneFlag(t)]).toBe(true);
    expect(activeTrail(s)).toBeNull();
    expect(trailObjective(s)).toBeNull();
    const step = CHAPTERS[3].steps.find((st) => st.id === "s_trail")!;
    expect(evalCond(step.done, s)).toBe(true);
  });

  it("only the current chapter's trail is ever open", () => {
    const s = at(4, { fragmar_briefed: true, vig_crobley_presser: true });
    expect(activeTrail(s)!.trail.id).toBe(trailFor(4)!.id);
    expect(clueAt(s, "POLSON")).toBeNull(); // outdoor one first
    takeClue(s, "FIELD");
    expect(clueAt(s, "POLSON")!.trail.chapter).toBe(4);
    expect(clueAt(s, "CLUB")).toBeNull(); // not on this trail
  });

  it("a cleared chapter never needs its trail", () => {
    const t = trailFor(4)!;
    const s = at(4, { [t.startFlag]: true, ch4_clear: true });
    expect(activeTrail(s)).toBeNull();
  });

  it("saves from before the trails existed keep an already-open door open", () => {
    // mid chapter 2, briefing done (the door was open): done. Chapter 4, before its presser: still to play.
    const s = newGameState("KREBLIS");
    s.chapter = 4;
    s.flags.vig_crobley_news = true;
    settleOldTrails(s);
    expect(s.flags[trailDoneFlag(trailFor(4)!)]).toBeFalsy();
    s.flags.vig_crobley_presser = true;
    expect(activeTrail(s)).toBeTruthy();
    const s2 = newGameState("KREBLIS");
    s2.chapter = 2;
    s2.flags.fragmar_briefed = true;
    settleOldTrails(s2);
    expect(activeTrail(s2)).toBeNull();
    // and once settled, a save isn't settled again (a trail in progress stays in progress)
    const s3 = at(4, { vig_crobley_presser: true });
    s3.flags[clueFlag(trailFor(4)!, 0)] = true;
    settleOldTrails(s3);
    expect(activeTrail(s3)!.got).toBe(1);
  });

  it("every clue has lines and sits on the map", () => {
    for (const t of TRAILS)
      for (const c of t.clues) {
        expect(c.lines.length).toBeGreaterThan(0);
        expect(c.hint.length).toBeGreaterThan(5);
        if (c.where === "FIELD") expect(c.x > 0 && c.x < 2560 && c.y > 0 && c.y < 1792).toBe(true);
      }
  });
});

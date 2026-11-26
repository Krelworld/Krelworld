// Phone mode, stage 3 wave 2: the minigames by touch (src/game/mobile/gamesLogic.ts, the pure part).
import { describe, expect, it } from "vitest";
import {
  CROC_COLUMNS,
  GAME_CUES,
  GAME_LINES_AS_WRITTEN,
  GAME_NARRATOR_TIPS,
  GAME_STORY_LINES,
  GAME_UI_TEXTS,
  GAME_WORDING,
  MAX_AUDIO_LAG,
  clearOfPause,
  crocColumn,
  crocLane,
  cueFor,
  liftOutOfStrip,
  rhythmLag,
  rsButtons,
  rsWord,
  underPause,
} from "../src/game/mobile/gamesLogic";
import { TOUCH_WORDING, touchWording } from "../src/game/mobile/wording";

/** What a phone shows for one of these captions: the minigames' rows first, then the rest (as installGames orders them). */
const phone = (t: string) => touchWording(t, [...GAME_WORDING, ...TOUCH_WORDING]);

const SOURCES = import.meta.glob(["../src/**/*.ts", "!../src/game/mobile/**"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

describe("the minigames' touch wording", () => {
  it("every caption it was written against still exists in the game, as written", () => {
    for (const { file, text } of GAME_LINES_AS_WRITTEN) {
      const src = SOURCES[`../${file}`];
      expect(src, file).toBeTruthy();
      expect(src.includes(JSON.stringify(text).slice(1, -1)) || src.includes(text), `${file}: ${text}`).toBe(true);
    }
  });

  it("each caption, on a phone, names no key and no mouse", () => {
    for (const { text } of GAME_LINES_AS_WRITTEN) {
      const out = phone(text);
      expect(out, text).not.toMatch(/\b(?:SPACE|Space|ESC|Esc|WASD|ARROWS|Click|CLICK|Tab|Shift)\b|A\/D|\[ E \/|\(G\)|\(D\)/);
    }
  });

  it("the words that matter are kept (only the keys go)", () => {
    expect(phone("Tap / SPACE to vent. The group chat has been a lot this week.")).toBe("Tap to vent. The group chat has been a lot this week.");
    expect(phone("Mash Tap / SPACE. Don't stop. The HGH is doing most of the work.")).toBe("Mash the screen (two thumbs!). Don't stop. The HGH is doing most of the work.");
    expect(phone("Click problems before they ROT (or arrows/WASD to pick, SPACE/E to fix). Fix them quickly in a row for a multiplier.")).toBe("Tap problems before they ROT. Fix them quickly in a row for a multiplier.");
    expect(phone("SPACE / TAP: ANGLE, then POWER. Grab coins mid-air: every miss, the seagulls nick more of them.")).toBe("Tap: ANGLE, then POWER. Grab coins mid-air: every miss, the seagulls nick more of them.");
    expect(phone("[2]")).toBe("");
    expect(phone("[3] Nobody cares Linda")).toBe("Nobody cares Linda");
    expect(phone("Drop all (D)")).toBe("Drop all");
    expect(phone("Re-up (G)")).toBe("Re-up");
    expect(phone("Move A/D or drag low · SPACE / tap high to throw underwear at Krebon · F / tap a mosher to PUNCH · knock stage invaders off with a throw")).toBe(
      "Drag low to move · tap high to throw underwear at Krebon · tap a mosher to PUNCH · knock stage invaders off with a throw",
    );
    expect(phone("PARACHUTE TO FREEDOM  [ E / SPACE / TAP ]")).toBe("PARACHUTE TO FREEDOM");
    expect(phone("TAP / SPACE: unblock the jets (3 of them, 6 good jabs each)")).toBe("Tap: unblock the jets (3 of them, 6 good jabs each)");
  });

  it("every row is anchored to its caption (it can't reach the middle of anything else)", () => {
    for (const r of GAME_WORDING) expect(r.re.source.startsWith("^"), r.id).toBe(true);
    for (const pats of [...Object.values(GAME_UI_TEXTS), ...Object.values(GAME_STORY_LINES)]) for (const p of pats) expect(p.source.startsWith("^"), p.source).toBe(true);
  });

  it("the squeeze's narrator tip swaps only its control words", () => {
    const line = "You hug her. Now: SQUEEZE. Hit the buttons as they come up, fast, before she gets bored.";
    expect(SOURCES["../src/game/systems/squeeze.ts"].includes(line)).toBe(true);
    expect(touchWording(line, GAME_NARRATOR_TIPS)).toBe("You hug her. Now: SQUEEZE. Tap the screen, fast, before she gets bored.");
  });
});

describe("rhythm lag", () => {
  it("is the sound output's delay plus the setting", () => {
    expect(rhythmLag({ baseLatency: 0.01, outputLatency: 0.032 }, 0)).toBe(0.042);
    expect(rhythmLag({ baseLatency: 0.01, outputLatency: 0.032 }, 50)).toBe(0.092);
    expect(rhythmLag(null, 0)).toBe(0);
  });
  it("a Bluetooth headset's big delay is capped; the setting can pull it back", () => {
    expect(rhythmLag({ baseLatency: 0.02, outputLatency: 0.4 }, 0)).toBe(MAX_AUDIO_LAG);
    expect(rhythmLag({ outputLatency: 0.1 }, -300)).toBe(-0.2);
    expect(rhythmLag({ outputLatency: 0 }, 999)).toBe(0.3);
  });
  it("ignores nonsense from the browser", () => {
    expect(rhythmLag({ baseLatency: Number.NaN, outputLatency: -1 }, Number.NaN)).toBe(0);
  });
});

describe("the crocodile's columns", () => {
  it("left third LEFT, middle CHOMP, right third RIGHT", () => {
    expect(crocLane(0)).toBe("L");
    expect(crocLane(339)).toBe("L");
    expect(crocLane(340)).toBe("C");
    expect(crocLane(619)).toBe("C");
    expect(crocLane(620)).toBe("R");
    expect(crocLane(959)).toBe("R");
  });
  it("the columns cover the screen under the note lane, edge to edge, with no gap", () => {
    const [l, c, r] = (["L", "C", "R"] as const).map(crocColumn);
    expect(l.x).toBe(0);
    expect(l.x + l.w).toBe(c.x);
    expect(c.x + c.w).toBe(r.x);
    expect(r.x + r.w).toBe(960);
    for (const k of [l, c, r]) {
      expect(k.y).toBe(CROC_COLUMNS.top);
      expect(k.y + k.h).toBe(540);
    }
  });
});

describe("RuneScape's thumb buttons", () => {
  const st = { over: false, logs: 0, gear: 100, ring: false, chopping: false, gary: "away" };
  it("CHOP always; DROP ALL only with logs; the re-up only when the game would take one", () => {
    expect(rsButtons(st, false)).toEqual({ chop: true, drop: false, reup: false, hot: false });
    expect(rsButtons({ ...st, logs: 3 }, false).drop).toBe(true);
    expect(rsButtons({ ...st, gear: 84 }, false).reup).toBe(true);
    expect(rsButtons({ ...st, gary: "here" }, false).reup).toBe(true);
    expect(rsButtons({ ...st, ring: true }, false).hot).toBe(true);
  });
  it("nothing in a conversation or once it's over", () => {
    expect(rsButtons(st, true)).toEqual({ chop: false, drop: false, reup: false, hot: false });
    expect(rsButtons({ ...st, over: true }, false).chop).toBe(false);
    expect(rsButtons(null, false).chop).toBe(false);
  });
  it("the re-up says the game's own word, without its key", () => {
    expect(rsWord("Re-up (G)")).toBe("RE-UP");
    expect(rsWord("Roll (G)")).toBe("ROLL");
    expect(rsWord("Pud (G)")).toBe("PUD");
    expect(rsWord(undefined)).toBe("RE-UP");
  });
});

describe("the corner under pause and the home-indicator strip", () => {
  it("a minigame's top-right button is moved left of the II", () => {
    const leave = { x: 868, y: 14, w: 72, h: 24 };
    expect(underPause(leave)).toBe(true);
    expect(leave.x + leave.w + clearOfPause(leave)).toBeLessThanOrEqual(872);
    expect(clearOfPause({ x: 400, y: 14, w: 100, h: 24 })).toBe(0);
    // (a whole-width bar is not a button)
    expect(underPause({ x: 0, y: 0, w: 960, h: 44 })).toBe(false);
  });
  it("a row in the strip is lifted out of it; one above it stays", () => {
    expect(liftOutOfStrip(533)).toBe(-25);
    expect(liftOutOfStrip(500)).toBe(0);
  });
});

describe("the first-time cues", () => {
  it("one per compulsory minigame, in touch words, shown once", () => {
    for (const m of ["bully", "deadlift", "girlfriends", "renovate", "runescape", "burpees", "facebook", "modulator", "crocodile", "cannon"]) {
      expect(GAME_CUES[m], m).toBeTruthy();
      expect(GAME_CUES[m]).not.toMatch(/SPACE|CLICK|KEY|ESC/);
    }
    expect(cueFor("bully", [])).toBe(GAME_CUES.bully);
    expect(cueFor("bully", ["bully"])).toBeNull();
    expect(cueFor("nope", [])).toBeNull();
    expect(cueFor(null, [])).toBeNull();
  });
});

import { PAUSE_GAP_MS, pausedSkip } from "../src/game/mobile/gamesLogic";
describe("the minigames' clock across a pause (review R1)", () => {
  it("ordinary frames, even slow ones, are played time; a pause or a lock counts as one frame", () => {
    expect(pausedSkip(16, 16)).toBe(0);
    expect(pausedSkip(PAUSE_GAP_MS, 16)).toBe(0);
    expect(pausedSkip(16000, 16)).toBe(16000 - 16);
    expect(pausedSkip(16000, 500)).toBe(16000 - 50);
    expect(pausedSkip(Number.NaN, 16)).toBe(0);
  });
});

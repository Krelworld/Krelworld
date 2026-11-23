import { afterEach, describe, expect, it } from "vitest";
import { addWording, hint, PROMPT_SCENES, rawText, TOUCH_WORDING, touchWording, UI_TEXTS } from "../src/game/mobile/wording";
import { setMobileForTests } from "../src/game/mobile/flag";
import { verbFromPrompt } from "../src/game/mobile/modes";

describe("touch wording: the table", () => {
  const cases: [string, string][] = [
    // the interact prompts of the walking scenes
    ["E: Watch KrelTV", "Tap: Watch KrelTV"],
    ["E: Talk to Gronny", "Tap: Talk to Gronny"],
    ["E / ATTACK: hit Gary", "Tap: hit Gary"],
    ["[E] Open", "Tap: Open"],
    ["E: Pick up: Cuddle token", "Tap: Pick up: Cuddle token"],
    ["E: Tip Candy (5 Krezzcoin)\n👀: Watch up close (10 Krezzcoin)", "Tap: Tip Candy (5 Krezzcoin)\n👀: Watch up close (10 Krezzcoin)"],
    ["E: THE KREDDLE EXCHANGE (🎟 3 Krokens · 💰 90 Krezzcoin)", "Tap: THE KREDDLE EXCHANGE (🎟 3 Krokens · 💰 90 Krezzcoin)"],
    // machine panels and pop-ups
    ["150 Krezzcoin a spin. SPACE or SPIN.", "150 Krezzcoin a spin. Tap SPIN."],
    ["200 Krezzcoin a go. SPACE / DROP to drop the claw.", "200 Krezzcoin a go. Tap DROP to drop the claw."],
    ["SPACE / tap to collect", "Tap to collect"],
    ["BRAWL! Tap / SPACE to swing", "BRAWL! Tap to swing"],
    ["ESC or ✕ to close", "✕ to close"],
    ["NEW SIDE QUEST: see the pause menu (Esc)", "NEW SIDE QUEST: see the pause menu (II)"],
    ["Press E to open", "Tap to open"],
    ["WASD to walk. E to talk/interact.", "Drag on the left to walk. Tap to talk/interact."],
    // key captions on their own become nothing (the button already says what it does)
    ["Space / E / click", ""],
    ["Tab", ""],
    ["Esc", ""],
    ["Enter", ""],
  ];
  it.each(cases)("%j → %j", (from, to) => {
    expect(touchWording(from)).toBe(to);
  });

  it("leaves text without key wording alone", () => {
    for (const t of ["Krelford, in the evening.", "Leave", "SETTINGS", "Escape to the country", "Tablet", "Enterprise", "The E-numbers", "SPACE INVADERS"]) expect(touchWording(t)).toBe(t);
  });

  it("is the same every time (no regex state carried between calls)", () => {
    expect(touchWording("E: Go outside")).toBe(touchWording("E: Go outside"));
    expect(touchWording("E: Go outside")).toBe("Tap: Go outside");
  });

  it("stage 2 can add rows", () => {
    const n = TOUCH_WORDING.length;
    addWording({ id: "test", re: /\bHOLD R\b/g, to: "HOLD KI" });
    expect(touchWording("HOLD R TO BLAST KI")).toBe("HOLD KI TO BLAST KI");
    TOUCH_WORDING.splice(n);
  });
});

describe("touch wording: hint() is phones only", () => {
  afterEach(() => setMobileForTests(false));
  it("unchanged on a laptop (and in node)", () => {
    expect(hint("E: Talk to Gronny")).toBe("E: Talk to Gronny");
  });
  it("touch wording on a phone", () => {
    setMobileForTests(true);
    expect(hint("E: Talk to Gronny")).toBe("Tap: Talk to Gronny");
  });
  it("the raw text stays readable for ACTION's verb", () => {
    const t = { text: "Tap: Talk to Gronny", __krelRaw: "E: Talk to Gronny" };
    expect(rawText(t)).toBe("E: Talk to Gronny");
    expect(verbFromPrompt(rawText(t))).toBe("TALK");
    expect(rawText({ text: "E: Go outside" })).toBe("E: Go outside");
    expect(rawText(null)).toBe("");
  });
});

describe("touch wording: never dialogue", () => {
  it("matches the UI texts it is meant for", () => {
    const ui: [string, string][] = [
      ["PolsonHome", "E: Pick up: a sock"],
      ["Pub", "Space / E / click"],
      ["Pub", "Esc"],
      ["Pub", "BRAWL! Tap / SPACE to swing · 3 still standing"],
      ["Kreddle", "150 Krezzcoin a spin. SPACE or SPIN."],
      ["Kreddle", "SPACE / tap to collect"],
      ["Home", "ESC or ✕ to close"],
    ];
    for (const [scene, text] of ui) expect(UI_TEXTS[scene].some((re) => re.test(text)), `${scene}: ${text}`).toBe(true);
  });

  it("is applied only in the walking scenes and their UI texts, never to conversation or story scenes", () => {
    const where = new Set<string>([...PROMPT_SCENES, ...Object.keys(UI_TEXTS)]);
    for (const k of ["Dialogue", "Meeting", "Cutscene", "Vignette", "TV", "Lair", "RoofCutscene", "Ending", "UI"]) expect(where.has(k)).toBe(false);
  });

  it("the UI patterns do not match the lines characters say that mention keys (left exactly as they are)", () => {
    const dialogue: [string, string][] = [
      ["Home", "TIP: WASD / arrows (or the stick) to walk. E to use things. Have a look round: the telly works, the bed saves your game."],
      ["Kreddle", "TIP: talk to the locals (E). Play the machines. Win things. And whatever you do, gamble at least once before you leave."],
    ];
    for (const [scene, line] of dialogue) for (const re of UI_TEXTS[scene] ?? []) expect(re.test(line), `${scene}: ${line}`).toBe(false);
  });
});

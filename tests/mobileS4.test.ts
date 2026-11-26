// Stage 4 (the full phone QA): the pure parts of its fixes. Phones only; nothing here runs on a laptop.
import { describe, expect, it } from "vitest";
import uiSrc from "../src/game/scenes/UIScene.ts?raw";
import dungeonSrc from "../src/game/scenes/DungeonScene.ts?raw";
import vignetteSrc from "../src/game/scenes/VignetteScene.ts?raw";
import drugsSrc from "../src/game/scenes/hub/drugs.ts?raw";
import finaleSrc from "../src/game/scenes/FinaleScene.ts?raw";
import finaleKSrc from "../src/content/finaleKrelford.ts?raw";
import { TOUCH_WORDING, UI_TEXTS, STORY_UI_LINES, touchWording } from "../src/game/mobile/wording";
import { COMBAT_WORDING, COMBAT_WORDING_FIRST, BRAWL_WORDING } from "../src/game/mobile/combatWording";
import { GAME_WORDING } from "../src/game/mobile/gamesLogic";
import { verbFromPrompt } from "../src/game/mobile/modes";
import { HUD_CHIP_TEXTS, posseWanted } from "../src/game/mobile/qaLogic";

// the table in the order a phone runs it (the "front" rows first, as index.ts / combat.ts add them)
const RULES = [...GAME_WORDING, ...[...COMBAT_WORDING_FIRST].reverse(), ...TOUCH_WORDING, ...COMBAT_WORDING, ...BRAWL_WORDING];
const KEYS = /\b(?:T|X|D|E|F|R|SPACE|Esc)\b(?= to |\)|$| \/ GUN)|\[E\]|PRESS\s+D|any key|click/;

describe("stage 4: UI text that named a key (s4-01 M1, s4-02 F2 F4 F6)", () => {
  const cases: [string, string, string][] = [
    // [source it comes from, the laptop text, the phone text]
    [uiSrc, "⚡ GOLDEN JUICE (T to transform)", "⚡ GOLDEN JUICE (GOLD in a fight)"],
    [dungeonSrc, "Now in your hand. X / GUN swaps back to the Fart Blaster (infinite ammo).", "Now in your hand. SWAP (or tap your gun up top) swaps back to the Fart Blaster (infinite ammo)."],
    [dungeonSrc, "Now in your hand. X / GUN cycles weapons.", "Now in your hand. SWAP cycles weapons."],
    [drugsSrc, "💊  PRESS  D  TO TAKE DRUGS", "💊  TAP TO TAKE DRUGS"],
    [drugsSrc, "(or tap the button)", ""],
    [vignetteSrc, "💊  PRESS  D", "💊  TAP HERE"],
    [finaleSrc, "any key · click · tap", "tap tap tap"],
    [finaleKSrc, "Inject each of the lads (walk up, press E). Don't get hit.", "Inject each of the lads (walk up, tap INJECT). Don't get hit."],
  ];
  for (const [src, from, to] of cases) {
    it(`${from} → ${to || "(nothing)"}`, () => {
      // (the game still says it: a renamed string fails here instead of silently showing a key)
      const probe = from.replace(/^Now in your hand\. /, "").replace(/ Don't get hit\.$/, "");
      expect(src.includes(probe), probe).toBe(true);
      expect(touchWording(from, RULES)).toBe(to);
      expect(KEYS.test(to), to).toBe(false);
    });
  }
  it("each is reached where the game shows it (the HUD chip, the town and cockpit pills, the finale's mash)", () => {
    expect(HUD_CHIP_TEXTS.some((r) => r.test("⚡ GOLDEN JUICE (T to transform)"))).toBe(true);
    expect(HUD_CHIP_TEXTS.some((r) => r.test("💦 TAP RUSH (+50% HP, +25% dmg)"))).toBe(false);
    expect(UI_TEXTS.Hub.some((r) => r.test("💊  PRESS  D  TO TAKE DRUGS"))).toBe(true);
    expect(UI_TEXTS.Hub.some((r) => r.test("(or tap the button)"))).toBe(true);
    expect(STORY_UI_LINES.Vignette.some((r) => r.test("💊  PRESS  D"))).toBe(true);
    expect(STORY_UI_LINES.Finale.some((r) => r.test("any key · click · tap"))).toBe(true);
  });
  it("ACTION's word: INJECT for the lads, OPEN for the staff toilet; the Cronster's hostages keep ACTION", () => {
    expect(verbFromPrompt("E: Inject Kreblis")).toBe("INJECT");
    expect(verbFromPrompt("E: Talk to STAFF TOILET (ENGAGED)")).toBe("OPEN");
    expect(verbFromPrompt("E: Talk to Gronny")).toBe("TALK");
    expect(touchWording("TIP: Free the hostages (walk up, press E) before he gets to them.", RULES)).toBe("TIP: Free the hostages (walk up, tap ACTION) before he gets to them.");
  });
  it("the crate's toast names the button it gets (OPEN); the flyover's skip is just SKIP ▸▸ (s4-01 m3)", () => {
    expect(touchWording("A weapons crate appeared. Press E to open it.", RULES)).toBe("A weapons crate appeared. Walk up and tap OPEN.");
    expect(touchWording("SKIP  ▸▸   (Space / Esc / tap)", RULES)).toBe("SKIP ▸▸");
  });
});

describe("stage 4: the posse fight by touch (s4-01 B1)", () => {
  it("the lit button is the move the fight asks for, and none between prompts", () => {
    expect(posseWanted({ prompt: "kick", promptUntil: 1234 })).toBe("kick");
    expect(posseWanted({ prompt: "shove", promptUntil: 0 })).toBe(null);
    expect(posseWanted({ prompt: "headbutt", promptUntil: 99 })).toBe(null);
    expect(posseWanted(null)).toBe(null);
  });
});

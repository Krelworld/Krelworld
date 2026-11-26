// Stage 4 (the full phone QA): the pure parts of its fixes. Phones only; nothing here runs on a laptop.
import { describe, expect, it } from "vitest";
import uiSrc from "../src/game/scenes/UIScene.ts?raw";
import dungeonSrc from "../src/game/scenes/DungeonScene.ts?raw";
import vignetteSrc from "../src/game/scenes/VignetteScene.ts?raw";
import drugsSrc from "../src/game/scenes/hub/drugs.ts?raw";
import finaleSrc from "../src/game/scenes/FinaleScene.ts?raw";
import finaleKSrc from "../src/content/finaleKrelford.ts?raw";
import hubSrc from "../src/game/scenes/HubScene.ts?raw";
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
    [hubSrc, "Press V any time to become SanMik (and back). Whoever you are, you stay that way.", "Tap the SANMIK button any time to become SanMik (and back). Whoever you are, you stay that way."],
  ];
  for (const [src, from, to] of cases) {
    it(`${from} → ${to || "(nothing)"}`, () => {
      // (the game still says it: a renamed string fails here instead of silently showing a key)
      const probe = from.replace(/^Now in your hand\. /, "").replace(/ Don't get hit\.$/, "").replace(/^Press V /, "");
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
    expect(verbFromPrompt("E: Untie Mollor")).toBe("FREE");
    expect(verbFromPrompt("E: Free Krezmar")).toBe("FREE");
    expect(verbFromPrompt("E: Open the weapons crate")).toBe("OPEN");
    expect(verbFromPrompt("E: Talk to Gronny")).toBe("TALK");
    expect(touchWording("TIP: Free the hostages (walk up, press E) before he gets to them.", RULES)).toBe("TIP: Free the hostages (walk up, tap FREE) before he gets to them.");
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

describe("stage 4: smaller fixes (pure parts)", () => {
  it("the bike on a phone goes where the thumb points; a laptop's bike is unchanged (s4-01 m7)", async () => {
    const { bikeVelocity } = await import("../src/game/systems/bike");
    // rolling down-right at speed, the stick pushed straight left for 0.3 s (18 frames)
    let a = { x: 200, y: 200 };
    let b = { x: 200, y: 200 };
    for (let i = 0; i < 18; i++) {
      a = bikeVelocity(a.x, a.y, -300, 0, 16.7, true);
      b = bikeVelocity(b.x, b.y, -300, 0, 16.7, false);
    }
    expect(Math.abs(a.y)).toBeLessThan(5);
    expect(a.x).toBeLessThan(-150);
    // (the laptop's ease: the old numbers, still drifting)
    expect(Math.abs(b.y)).toBeGreaterThan(20);
    // (node is not a phone: the default is the laptop's)
    const c = bikeVelocity(200, 200, -300, 0, 16.7);
    const d = bikeVelocity(200, 200, -300, 0, 16.7, false);
    expect(c).toEqual(d);
  });
  it("a BOMB HERE spot is tapped on its own circle, never grown to the school behind it (s4-01 M4)", async () => {
    const { GROUND_SPOT } = await import("../src/game/mobile/tapTargets");
    expect(GROUND_SPOT.test("E: Plant a bomb (2/4)")).toBe(true);
    expect(GROUND_SPOT.test("E: Enter Wildern Academy")).toBe(false);
  });
  it("Whack's rules line splits into two even lines with the same words (P6)", async () => {
    const { splitWhackRules } = await import("../src/game/mobile/qaLogic");
    const line = "HIGH SCORE: 120     ·     30 SECONDS     ·     1 🎟 KROKEN PER 200 POINTS (max 25) · NEW HIGH SCORE +3 🎟 · 1000+: 500 KREZZCOIN";
    const out = splitWhackRules(line)!;
    expect(out.split("\n")).toHaveLength(2);
    expect(out.split("\n")[1].startsWith("NEW HIGH SCORE")).toBe(true);
    expect(out.replace("\n", " · ")).toBe(line);
    expect(splitWhackRules("INSERT 100 KREZZCOIN")).toBe(null);
    expect(splitWhackRules(out)).toBe(null);
  });
  it("toasts: at most two; a toast over the player is seen through (rects overlap)", async () => {
    const { TOAST_MAX, overlaps } = await import("../src/game/mobile/qaLogic");
    expect(TOAST_MAX).toBe(2);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 15, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 15, y: 0, w: 10, h: 10 }, 6)).toBe(true);
  });
});

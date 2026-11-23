// Phone mode, stage 2: the conversation controls (SKIP / LOG / AUTO, choices), the reading sizes and how many lines
// the box holds at them (pagination), the narrator's control tips, the Phone settings page's helpers, and the idle
// stick kept off the player. All pure: no Phaser, no DOM.
import { describe, expect, it } from "vitest";
import {
  AUTO_AFTER_VOICE_MS,
  autoReady,
  backAction,
  CHOICE_GAP_CSS,
  CHOICE_GUARD_MS,
  CHOICE_ROW_CSS,
  choiceTapCounts,
  linesThatFit,
  pillRow,
  planChoices,
  readingMs,
} from "../src/game/mobile/dialogueLogic";
import { BUTTON_TEXT_CSS, gamePx, MIN_TEXT_CSS, NAME_TEXT_CSS, READ_TEXT_CSS, readTextCss, roleTextCss } from "../src/game/mobile/readable";
import { NARRATOR_TIPS, narratorTip, touchWording } from "../src/game/mobile/wording";
import { layoutNow, layoutStorage, sliderText, stepSlider } from "../src/game/mobile/settingsPage";
import { ghostClear, overlaps } from "../src/game/mobile/layout";

describe("conversations: AUTO", () => {
  it("gives a silent page about 20 characters a second plus a beat, 1.5 to 8 s", () => {
    expect(readingMs(0)).toBe(1500);
    expect(readingMs(30)).toBe(2700);
    expect(readingMs(100)).toBe(6200);
    expect(readingMs(1000)).toBe(8000);
    expect(readingMs(NaN)).toBe(1500);
  });

  it("never moves on while the page is still typing or the voice is still going", () => {
    expect(autoReady(99999, { fullAt: null, quietSince: 0, voiced: false, chars: 10 })).toBe(false);
    expect(autoReady(99999, { fullAt: 0, quietSince: null, voiced: true, chars: 10 })).toBe(false);
  });

  it("a voiced page goes 700 ms after the voice ends (and not before half its reading time)", () => {
    const c = { fullAt: 0, quietSince: 2000, voiced: true, chars: 40 };
    expect(autoReady(2000 + AUTO_AFTER_VOICE_MS - 1, c)).toBe(false);
    expect(autoReady(2000 + AUTO_AFTER_VOICE_MS, c)).toBe(true);
    // a voice that stopped at once never rushes a long line
    const long = { fullAt: 0, quietSince: 0, voiced: true, chars: 200 };
    expect(autoReady(1000, long)).toBe(false);
    expect(autoReady(readingMs(200) / 2, long)).toBe(true);
  });

  it("a silent page (narration, a later page of a long line) goes after its reading time", () => {
    const c = { fullAt: 1000, quietSince: 0, voiced: false, chars: 30 };
    expect(autoReady(1000 + readingMs(30) - 1, c)).toBe(false);
    expect(autoReady(1000 + readingMs(30), c)).toBe(true);
  });
});

describe("conversations: choices need a deliberate tap", () => {
  it("ignores presses that start within 150 to 200 ms of the rows appearing (S11)", () => {
    expect(CHOICE_GUARD_MS).toBeGreaterThanOrEqual(150);
    expect(CHOICE_GUARD_MS).toBeLessThanOrEqual(200);
    expect(choiceTapCounts(1000, { row: 0, t: 1000 + CHOICE_GUARD_MS - 1 }, 0)).toBe(false);
    expect(choiceTapCounts(1000, { row: 0, t: 1000 + CHOICE_GUARD_MS }, 0)).toBe(true);
  });

  it("counts only a touch that began and ended on the same row (M8)", () => {
    expect(choiceTapCounts(0, { row: 1, t: 500 }, 2)).toBe(false);
    expect(choiceTapCounts(0, null, 1)).toBe(false);
    // (the tap that ended the line before: it went down before the rows existed)
    expect(choiceTapCounts(1000, { row: 0, t: 900 }, 0)).toBe(false);
  });

  it("puts the rows above the box when they fit, else over the whole screen with the question on top", () => {
    const k = 0.63;
    const row = gamePx(k, CHOICE_ROW_CSS);
    const gap = gamePx(k, CHOICE_GAP_CSS);
    // two rows fit above the box (its top at 362)
    const two = planChoices([row, row], gap, 362);
    expect(two.replaceBox).toBe(false);
    expect(two.top + 2 * row + gap).toBeLessThanOrEqual(362 - 8);
    // four rows at Safari-with-bars size don't: they take the screen, the question above them
    const four = planChoices([row, row, row, row], gap, 362, 540, 8, 30);
    expect(four.replaceBox).toBe(true);
    expect(four.header).toBe(true);
    expect(four.top).toBeGreaterThanOrEqual(8 + 30 + gap);
    expect(four.top + 4 * row + 3 * gap).toBeLessThanOrEqual(540 - 8);
    // no room for the question: it goes (it's in the LOG)
    const six = planChoices(new Array(6).fill(row), gap, 362, 540, 8, 60);
    expect(six.header).toBe(false);
    // a box that isn't showing: the whole screen
    expect(planChoices([row], gap, 0).replaceBox).toBe(true);
  });

  it("rows are at least 48 CSS px and 8 to 12 apart", () => {
    expect(CHOICE_ROW_CSS).toBeGreaterThanOrEqual(48);
    expect(CHOICE_GAP_CSS).toBeGreaterThanOrEqual(8);
    expect(CHOICE_GAP_CSS).toBeLessThanOrEqual(12);
  });
});

describe("conversations: Android Back (R3 follow-up)", () => {
  const none = { logOpen: false, settingsOpen: false, guideOpen: false, conversation: false, pausable: false };
  it("closes the topmost phone overlay first", () => {
    expect(backAction({ ...none, logOpen: true, conversation: true, pausable: true })).toBe("close-log");
    expect(backAction({ ...none, settingsOpen: true })).toBe("close-settings");
    expect(backAction({ ...none, guideOpen: true })).toBe("close-guide");
  });
  it("opens the pause menu in a meeting / cutscene / vignette (the laptop's Esc), and never skips", () => {
    expect(backAction({ ...none, conversation: true, pausable: true })).toBe("pause-conversation");
    // a town conversation: the town is paused under it, and Esc does nothing there on a laptop either
    expect(backAction({ ...none, conversation: true, pausable: false })).toBe("default");
    expect(backAction(none)).toBe("default");
  });
});

describe("conversations: where the pills go", () => {
  const view = { w: 844, h: 390 };
  const safe = { top: 0, right: 47, bottom: 21, left: 47 };
  it("on the box's top edge, right end, inside the safe area", () => {
    const box = { x: 87, y: 261, w: 670, h: 120 };
    const p = pillRow(box, 200, 44, view, safe);
    expect(p.y + 44).toBeLessThanOrEqual(box.y);
    expect(p.x + 200).toBeLessThanOrEqual(box.x + box.w);
    expect(p.x + 200).toBeLessThanOrEqual(view.w - safe.right);
  });
  it("below the box when the box is at the top of the screen", () => {
    const box = { x: 87, y: 8, w: 670, h: 120 };
    const p = pillRow(box, 200, 44, view, safe);
    expect(p.y).toBeGreaterThanOrEqual(box.y + box.h);
  });
});

describe("reading sizes and the box (pagination)", () => {
  it("reading text 16 CSS px, names 14, buttons 12.5, labels 11 (large x1.25)", () => {
    expect(READ_TEXT_CSS).toBe(16);
    expect(NAME_TEXT_CSS).toBe(14);
    expect(BUTTON_TEXT_CSS).toBe(12.5);
    expect(MIN_TEXT_CSS).toBe(11);
    expect(roleTextCss("read", "normal")).toBe(16);
    expect(roleTextCss("read", "large")).toBe(20);
    expect(roleTextCss(undefined, "normal")).toBe(11);
    expect(readTextCss("large")).toBe(20);
  });

  it("works out game px from the canvas scale on every phone size", () => {
    for (const k of [0.63, 0.667, 0.722, 0.796]) {
      expect(gamePx(k, 16) * k).toBeGreaterThanOrEqual(16 - 1e-9);
      expect((gamePx(k, 16) - 1) * k).toBeLessThan(16);
    }
  });

  it("the box holds at least three lines of 16 CSS px text on every phone size (and two in a Messenger ping)", () => {
    // (the speech body runs from under the name, about 400, to 520; a line is about 1.15 x the font, spacing 0.22)
    for (const k of [0.63, 0.667, 0.722, 0.796]) {
      const px = gamePx(k, 16);
      const lineH = Math.ceil(px * 1.15);
      const spacing = Math.max(4, Math.round(px * 0.22));
      const nameH = Math.ceil(gamePx(k, 14) * 1.15);
      expect(linesThatFit(362 + 8 + nameH + 2, 520, lineH, spacing)).toBeGreaterThanOrEqual(3);
      expect(linesThatFit(208, 282, lineH, spacing)).toBeGreaterThanOrEqual(2);
    }
    // with large text it still never claims zero lines
    expect(linesThatFit(400, 520, 200, 10)).toBe(1);
    expect(linesThatFit(400, 520, 0, 10)).toBe(1);
  });
});

describe("narrator control tips (hard rule 3's exception)", () => {
  it("swaps Home's welcome tip and the 'walk up and press E' asides for touch wording", () => {
    expect(narratorTip("TIP: WASD / arrows (or the stick) to walk. E to use things. Have a look round: the telly works, the bed saves your game.")).toBe(
      "TIP: Drag on the left to walk. Tap things to use them. Have a look round: the telly works, the bed saves your game.",
    );
    expect(narratorTip("A night in. A relaxing episode of Peep Show is about to start. (The telly's on the left: walk up and press E.)")).toBe(
      "A night in. A relaxing episode of Peep Show is about to start. (The telly's on the left: walk up and tap it.)",
    );
    expect(narratorTip("Why not watch some lovely TV? (The telly's on the left. Walk up to it and press E.)")).toBe("Why not watch some lovely TV? (The telly's on the left. Walk up to it and tap it.)");
    expect(narratorTip("💡 TIP: THE GUN RACK (on the wall, right). Walk up to it and press E. It's where your guns live between dungeons.")).toBe(
      "💡 TIP: THE GUN RACK (on the wall, right). Walk up to it and tap it. It's where your guns live between dungeons.",
    );
    expect(narratorTip("TIP: talk to the locals (E). Play the machines. Win things.")).toBe("TIP: talk to the locals (tap them). Play the machines. Win things.");
    expect(narratorTip("HOW IT WORKS: walk up to the playground fence and press E to throw a sweetie.")).toBe("HOW IT WORKS: walk up to the playground fence and tap to throw a sweetie.");
    expect(narratorTip("Move left and right across the stage. Tap / SPACE to prance.")).toBe("Move left and right across the stage. Tap to prance.");
    expect(
      narratorTip("TIP: You can become SANMIK whenever you like. Press V (or the SANMIK button) and you're SanMik: afro, shades, drawn-on goatee, and a big YEE. Press it again to go back to being you."),
    ).toBe("TIP: You can become SANMIK whenever you like. Tap the SANMIK button and you're SanMik: afro, shades, drawn-on goatee, and a big YEE. Tap it again to go back to being you.");
    expect(narratorTip("HOLD the attack button (mouse / J / the fire button) to spray CHEMICAL FIRE. Walk EAST along the Strip.")).toBe("HOLD the attack button (the fire button) to spray CHEMICAL FIRE. Walk EAST along the Strip.");
  });

  it("leaves every other word alone, and every line with no tip in it", () => {
    for (const t of ["The chamber is quiet.", "He picks up a Les Paul from somewhere.", "TIP: Drink from the Great Tap before a mission for a TAP RUSH."]) expect(narratorTip(t)).toBe(t);
    // the combat tips are left for the combat controls (their button names): not in this table
    expect(narratorTip("TIP: Alistair only goes down to a headbutt. Wear him down, then get close and press F to HEADBUTT.")).toContain("press F");
    expect(narratorTip("TIP: She rolls along the floor. JUMP over her (W / up).")).toContain("(W / up)");
    expect(NARRATOR_TIPS.every((r) => r.id && r.re instanceof RegExp)).toBe(true);
  });
});

describe("touch wording added in stage 2", () => {
  it("the dialogue footer, the reaction card, the Difficulty / Banter hints, the title's key line", () => {
    expect(touchWording("▼ E / Space   ·   Tab skip")).toBe("▼");
    expect(touchWording("REACT  (1-5 or click)")).toBe("REACT");
    expect(touchWording("↑/↓ or 1–5 to pick · ENTER / A to go on · tap twice on touch")).toBe("Tap one, then tap it again to go on");
    expect(touchWording("↑/↓ or 1–3 to pick · ENTER / A to start · tap twice on touch")).toBe("Tap one, then tap it again to start");
    expect(touchWording("WASD · Mouse · Click · Space · E · Q · B · R · Esc")).toBe("");
    // (as the pixel font's clean-up hands it over: the en dash already " - ")
    expect(touchWording("↑/↓ or 1 - 5 to pick · ENTER / A to go on · tap twice on touch")).toBe("Tap one, then tap it again to go on");
    expect(touchWording("↑↓ choose · Enter load · Del delete · Esc back   (tap a slot to load it)")).toBe("Tap a slot to load it");
    expect(touchWording("Pick a slot to save to. AUTO saves itself as you play.   ↑↓ · Enter · Del · Esc")).toBe("Pick a slot to save to. AUTO saves itself as you play.");
  });
});

describe("the Phone settings page", () => {
  it("Phone layout: OFF stores the opt-out; AUTO and ON store nothing (a phone is a phone)", () => {
    expect(layoutStorage("off")).toBe("off");
    expect(layoutStorage("auto")).toBe("auto");
    expect(layoutStorage("on")).toBe("auto");
    expect(layoutNow(null, "device")).toBe("auto");
    expect(layoutNow(null, "address")).toBe("on");
    expect(layoutNow("off", "device")).toBe("off");
  });
  it("steps a slider on its grid, inside its range, and reads it out", () => {
    expect(stepSlider(0.3, 1, 0.2, 0.8, 0.1)).toBe(0.4);
    expect(stepSlider(0.8, 1, 0.2, 0.8, 0.1)).toBe(0.8);
    expect(stepSlider(0.2, -1, 0.2, 0.8, 0.1)).toBe(0.2);
    expect(stepSlider(0, -1, -300, 300, 5)).toBe(-5);
    expect(sliderText(0.3, "%")).toBe("30%");
    expect(sliderText(15, "ms")).toBe("+15 ms");
    expect(sliderText(-10, "ms")).toBe("-10 ms");
  });
});

describe("the idle stick stays off the player (gate note, 750x340 Home far left)", () => {
  const zone = { x: 0, y: 68, w: 337, h: 251 };
  it("stays where it is when the player is elsewhere", () => {
    const at = { x: 100, y: 250 };
    expect(ghostClear(at, 49, { x: 300, y: 100, w: 30, h: 60 }, zone)).toBe(at);
    expect(ghostClear(at, 49, null, zone)).toBe(at);
  });
  it("moves beside or above the player when it would cover them, inside the stick zone", () => {
    const at = { x: 100, y: 250 };
    const me = { x: 75, y: 215, w: 30, h: 70 };
    const p = ghostClear(at, 49, me, zone)!;
    expect(p).not.toBeNull();
    expect(overlaps({ x: p.x - 49, y: p.y - 49, w: 98, h: 98 }, me)).toBe(false);
    expect(p.x - 49).toBeGreaterThanOrEqual(zone.x);
    expect(p.y + 49).toBeLessThanOrEqual(zone.y + zone.h);
  });
  it("gives up (see-through in place) when nowhere in the zone is clear", () => {
    expect(ghostClear({ x: 100, y: 200 }, 49, { x: 0, y: 60, w: 337, h: 260 }, zone)).toBeNull();
  });
});

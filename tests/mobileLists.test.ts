// Phone mode, stage 2 part 2: the phone lists (research M10), the shops (S13), character select (P16) and the touch
// wording sweep. Pure rules only (the DOM and the scenes are covered by scripts/mobile-smoke.cjs --only lists,wording).
import { afterEach, describe, expect, it } from "vitest";
import { BTN_CSS, canPage, capPurse, CHAR_RETAP_MS, charTapStarts, dropSlot, esc, maxBoxes, moved, needsList, pageScroll, ROW_CSS, scrollToShow, stepQty, tileCols } from "../src/game/mobile/listLogic";
import { hint, NARRATOR_TIPS, narratorTip, STORY_UI_LINES, touchWording, UI_TEXTS } from "../src/game/mobile/wording";
import { setMobileForTests } from "../src/game/mobile/flag";

describe("phone lists: sizes and paging", () => {
  it("rows are 52 CSS px and buttons 44 (research M10)", () => {
    expect(ROW_CSS).toBe(52);
    expect(BTN_CSS).toBe(44);
  });
  it("a page is 85% of the view, kept inside the list", () => {
    expect(pageScroll(0, 200, 1000, 1)).toBe(170);
    expect(pageScroll(170, 200, 1000, -1)).toBe(0);
    expect(pageScroll(790, 200, 1000, 1)).toBe(800);
    expect(pageScroll(0, 40, 1000, 1)).toBe(ROW_CSS);
    expect(pageScroll(0, 200, 150, 1)).toBe(0);
  });
  it("page buttons are dim at the ends", () => {
    expect(canPage(0, 200, 1000, -1)).toBe(false);
    expect(canPage(0, 200, 1000, 1)).toBe(true);
    expect(canPage(800, 200, 1000, 1)).toBe(false);
  });
  it("the selected row is brought into view with the least movement, and left alone when it shows", () => {
    expect(scrollToShow(400, 52, 0, 200)).toBe(400 + 52 + 8 - 200);
    expect(scrollToShow(40, 52, 100, 200)).toBe(32);
    expect(scrollToShow(120, 52, 100, 200)).toBe(100);
  });
  it("a list that fits stays as the game draws it", () => {
    expect(needsList(7, 7)).toBe(false);
    expect(needsList(58, 7)).toBe(true);
  });
  it("tiles: two to four a row", () => {
    expect(tileCols(200)).toBe(2);
    expect(tileCols(420)).toBe(3);
    expect(tileCols(2000)).toBe(4);
  });
  it("markup is escaped", () => {
    expect(esc(`<b>"Krel's" & co</b>`)).toBe("&lt;b&gt;&quot;Krel&#39;s&quot; &amp; co&lt;/b&gt;");
  });
});

describe("the gun rack's reorder (drag the handle, or ▲ ▼)", () => {
  it("a drag lands on the nearest slot, inside the list", () => {
    expect(dropSlot(0, 110, 52, 7)).toBe(2);
    expect(dropSlot(3, -60, 52, 7)).toBe(2);
    expect(dropSlot(6, 400, 52, 7)).toBe(6);
    expect(dropSlot(0, -400, 52, 7)).toBe(0);
    expect(dropSlot(2, 10, 52, 7)).toBe(2);
  });
  it("moving an entry keeps every other one in order", () => {
    expect(moved(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moved(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moved(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("shops: ammo by the box (− / +)", () => {
  it("starts at the game's own rule: fill it as far as the money goes", () => {
    expect(maxBoxes(5000, 15, 5)).toBe(5);
    expect(maxBoxes(40, 15, 5)).toBe(2);
    expect(maxBoxes(10, 15, 5)).toBe(0);
  });
  it("the stepper stays between 1 and the most you can buy", () => {
    expect(stepQty(3, -1, 5)).toBe(2);
    expect(stepQty(1, -1, 5)).toBe(1);
    expect(stepQty(5, 1, 5)).toBe(5);
    expect(stepQty(2, 1, 0)).toBe(0);
  });
  it("the purse for exactly n boxes, and the rest put back after", () => {
    expect(capPurse(5000, 15, 3)).toEqual({ purse: 45, aside: 4955 });
    expect(capPurse(20, 15, 3)).toEqual({ purse: 20, aside: 0 });
  });
});

describe("character select on a phone (P16): a tap picks, PLAY AS starts", () => {
  it("the face that starts selected never starts on one tap", () => {
    expect(charTapStarts(0, 0, null, 5000)).toBe(false);
  });
  it("a tap on a new face only picks it", () => {
    expect(charTapStarts(4, 0, null, 5000)).toBe(false);
  });
  it("a second tap on the face you picked starts, but not a double-tap bounce", () => {
    expect(charTapStarts(4, 4, 4, CHAR_RETAP_MS)).toBe(true);
    expect(charTapStarts(4, 4, 4, 120)).toBe(false);
    expect(charTapStarts(3, 4, 4, 2000)).toBe(false);
  });
});

describe("the touch wording sweep (stage 2 part 2)", () => {
  afterEach(() => setMobileForTests(false));
  const cases: [string, string][] = [
    ["KIDS DISTRACTED: 12s\n📸 Snap the cameras (E)  1/3", "KIDS DISTRACTED: 12s\n📸 Snap the cameras (tap)  1/3"],
    ["🍬 Stand by the fence and press E to throw a sweetie\nThen snap the 📸 cameras while the kids are busy  0/3", "🍬 Stand by the fence and tap to throw a sweetie\nThen snap the 📸 cameras while the kids are busy  0/3"],
    ["25 seconds. Walk to each 📸 camera in the playground and press E to snap it.", "25 seconds. Walk to each 📸 camera in the playground and tap to snap it."],
    ["Higher or lower? (↑ / ↓) The long shot pays more.", "Higher or lower? The long shot pays more."],
    ["SKIP ▶▶  (Tab)", "SKIP ▶▶"],
    ["←/→ (or tap ◀ ▶) sets the Heat: enemies get tougher (×1.8 HP), the win pays more.", "Tap ◀ ▶ to set the Heat: enemies get tougher (×1.8 HP), the win pays more."],
    ["(click, or press 1 · 2 · 3 · 4)", "(tap one)"],
    ["(click, or press 1 / 2)", "(tap one)"],
    ["click to skip", "tap to skip"],
    ["click / Tab: skip", "tap: skip"],
    ["SKIP  ▸▸   (Space / Esc / tap)", "SKIP ▸▸"],
    ["⛶ FULLSCREEN   (Alt+Enter)", "⛶ FULLSCREEN"],
    ["↑↓ pick · ←→ channel · ENTER watch · ESC whatever's on", ""],
    ["DONE (ESC)", "DONE"],
    ["←/→ tabs · ↑/↓ pick · ENTER borrow / hand back · tap twice on touch", "Tap one, then tap it again to borrow or hand back"],
    ["Drag to set your order (or ▲▼). #1 is what you start a dungeon holding; X swaps down the list.", "Drag to order (or ▲▼). #1 is what you start with; SWAP goes down the list."],
    ["↑↓ pick · SHIFT+↑↓ move · B buy ammo · no shops left: ammo's HALF PRICE", "no shops left: ammo's HALF PRICE"],
    ["↑↓ pick · SHIFT+↑↓ move · B buy ammo", ""],
    ["Esc: skip scene", "SKIP SCENE ▸▸"],
    ["Drinking pussy juice (Q) knocks everything around you flying.", "Drinking pussy juice (HEAL) knocks everything around you flying."],
    ["The BFK acquired. Equipped. X to swap weapons.", "The BFK acquired. Equipped. Tap SWAP to swap weapons."],
    ["The Kreblar.  Press V to become SANMIK whenever you like.", "The Kreblar.  Tap the SANMIK button to become SANMIK whenever you like."],
    ["PLAYING AS: Flenky Jenky  (C)", "PLAYING AS: Flenky Jenky"],
    ["DIFFICULTY 3/5: Normal  (V)", "DIFFICULTY 3/5: Normal"],
  ];
  for (const [from, to] of cases) it(`"${from.slice(0, 50)}"`, () => expect(touchWording(from)).toBe(to));

  it("a laptop sees every line as written", () => {
    setMobileForTests(false);
    for (const [from] of cases) expect(hint(from)).toBe(from);
  });

  it("every UI_TEXTS pattern matches the laptop line it is for (and the rows say nothing a character says)", () => {
    const lines: [string, string][] = [
      ["Hub", "KIDS DISTRACTED: 9s\n📸 Snap the cameras (E)  0/3"],
      ["Hub", "🍬 Stand by the fence and press E to throw a sweetie\nThen snap the 📸 cameras while the kids are busy  0/3"],
      ["Kreddle", "Higher or lower? (↑ / ↓) The long shot pays more."],
      ["Home", "SKIP ▶▶  (Tab)"],
      ["Home", "↑↓ pick · SHIFT+↑↓ move · B buy ammo"],
      ["Pit", "←/→ (or tap ◀ ▶) sets the Heat: x"],
      ["Menu", "⛶ FULLSCREEN   (Alt+Enter)"],
      ["PitLoan", "DONE (ESC)"],
      ["CharSelect", "The Kreblar.  Press V to become SANMIK whenever you like."],
      ["ChapterSelect", "PLAYING AS: Flenky Jenky  (C)"],
    ];
    for (const [scene, line] of lines) expect(UI_TEXTS[scene].some((p) => ((p.lastIndex = 0), p.test(line))), `${scene}: ${line}`).toBe(true);
    const story: [string, string][] = [
      ["Ending", "(click, or press 1 · 2 · 3 · 4)"],
      ["Ending", "click to skip"],
      ["TV", "↑↓ pick · ←→ channel · ENTER watch · ESC whatever's on"],
      ["Lair", "Esc: skip scene"],
      ["*", "click / Tab: skip"],
      ["*", "SKIP  ▸▸   (Space / Esc / tap)"],
      ["RoofCutscene", "Esc: skip scene"],
    ];
    for (const [scene, line] of story) expect(STORY_UI_LINES[scene].some((p) => p.test(line)), `${scene}: ${line}`).toBe(true);
    // the playground's narrated how-to (a NARRATOR line, NARRATOR_TIPS' job) is not a Hub sign
    const narr = "HOW IT WORKS: walk up to the playground fence and press E to throw a sweetie. The kids fight over it for 25 seconds.";
    expect(UI_TEXTS.Hub.some((p) => p.test(narr))).toBe(false);
  });

  it("in story and conversation scenes only whole UI captions are reworded (every pattern matches a whole line)", () => {
    for (const pats of Object.values(STORY_UI_LINES)) for (const p of pats) expect(p.source.startsWith("^") && p.source.endsWith("$"), p.source).toBe(true);
    // and none is a line anyone says
    for (const line of ["“Press 1 for...SWASTIKA”", "Click.", "*click* A beautiful shot. The galvanised steel glistens. Boggor will weep."])
      for (const pats of Object.values(STORY_UI_LINES)) for (const p of pats) expect(p.test(line)).toBe(false);
  });

  it("characters' lines that mention keys are never touched by the narrator tips", () => {
    for (const line of ["“Press 1 for...SWASTIKA”", "ur last poste woz so tru!! (Y)", "the key change happens four times in a row, each one into the same key"]) {
      expect(narratorTip(line, NARRATOR_TIPS)).toBe(line);
    }
  });
});

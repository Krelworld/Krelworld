import { describe, expect, it } from "vitest";
import { ACTIONS } from "../src/game/systems/keybinds";
import { btnDown, firstDown, PAD_DEFAULTS, PAD_FIXED, PAD_START, padButtons, padLabel, withPadBinding } from "../src/game/systems/padbinds";

describe("gamepad bindings", () => {
  it("every action has a default pad button or is on the left stick", () => {
    for (const a of ACTIONS) expect(a.id in PAD_DEFAULTS || a.id in PAD_FIXED).toBe(true);
  });

  it("defaults never share a button, and never use Start (pause)", () => {
    const seen = new Map<number, string>();
    for (const [id, btns] of Object.entries(PAD_DEFAULTS)) {
      for (const b of btns) {
        expect(b).not.toBe(PAD_START);
        expect(seen.get(b), `${padLabel(b)} on ${id} and ${seen.get(b)}`).toBeUndefined();
        seen.set(b, id);
      }
    }
  });

  it("labels the standard layout", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(padLabel)).toEqual(["A", "B", "X", "Y", "LB", "RB", "LT", "RT"]);
  });

  it("rebinding takes the button and hands the old one to whoever had it", () => {
    const m = withPadBinding(undefined, "interact", 3); // X-interact moves to Y, which was special's backup
    expect(padButtons(m, "interact")).toEqual([3]);
    expect(padButtons(m, "special")).toEqual([6]);
    const m2 = withPadBinding(undefined, "burst", 2); // LB-burst moves to X: interact gets LB
    expect(padButtons(m2, "burst")).toEqual([2]);
    expect(padButtons(m2, "interact")).toEqual([4]);
    // no button ever ends up doing two jobs
    let cur: Record<string, number[]> | undefined;
    const ids = Object.keys(PAD_DEFAULTS);
    for (let i = 0; i < 40; i++) {
      cur = withPadBinding(cur, ids[(i * 7) % ids.length], (i * 5) % 16 === PAD_START ? 0 : (i * 5) % 16);
      const used = ids.flatMap((id) => padButtons(cur, id));
      expect(new Set(used).size).toBe(used.length);
    }
  });

  it("ignores junk in a saved map", () => {
    expect(padButtons({ attack: "nope" as unknown as number[] }, "attack")).toEqual(PAD_DEFAULTS.attack);
  });

  it("reads triggers past a third as pressed", () => {
    const pad = { buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })) };
    expect(firstDown(pad)).toBe(-1);
    pad.buttons[6].value = 0.5;
    expect(btnDown(pad, 6)).toBe(true);
    expect(firstDown(pad)).toBe(6);
  });
});

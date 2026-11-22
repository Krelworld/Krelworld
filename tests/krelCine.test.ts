import { describe, expect, it } from "vitest";
import manifestJson from "../public/art/manifest.json";
import { KC_HEADS, KCV_HEAD } from "../src/game/combat/krelCineData";

// The Kreltality close-ups show the boss you beat: every close-up has its head boxes and split sheets, and every
// Kreltality-able boss has its own close-up head.
const manifest = manifestJson as unknown as { sheets: Record<string, { frameWidth: number }> };
const FINS = ["spine", "explode", "halved", "headboot", "slit", "flatten", "vice", "bellybomb", "jawtrap", "pendulum", "ribcage", "freeze", "kebab", "lasergrid", "xray", "decap", "pump", "cinder", "piranha", "asbestos"];
const BOSSES = ["brand", "flatmate", "flirt", "fruity", "tank", "lantern", "hoard", "jam", "krandall", "pudding_demon", "rival", "troll", "elon", "reinhardt", "krozno", "cronster", "rik"];

describe("Kreltality close-ups", () => {
  it("every finisher's close-up comes split, with a head (or none) for each of its 9 frames", () => {
    for (const f of FINS) {
      expect(KC_HEADS[f], f).toBeDefined();
      expect(KC_HEADS[f].length, f).toBe(9);
      expect(manifest.sheets[`kca_${f}`], f).toBeDefined();
      expect(manifest.sheets[`kcf_${f}`], f).toBeDefined();
      // the wind-up always has the head in it
      expect(KC_HEADS[f][0].length, f).toBeGreaterThan(0);
      for (const fr of KC_HEADS[f]) for (const p of fr) expect(p.length).toBe(7);
    }
  });
  it("every boss has its own close-up head (terror, impact, hurt)", () => {
    for (const b of BOSSES) {
      expect(KCV_HEAD[b], b).toBeDefined();
      expect(manifest.sheets[`kcv_${b}`], b).toBeDefined();
    }
  });
});

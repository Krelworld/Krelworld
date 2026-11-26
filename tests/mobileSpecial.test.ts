// SPECIAL's feedback on a phone (s4b): the user tapped NUKE and "nothing happened", and didn't know what it does.
import { describe, expect, it } from "vitest";
import { SPECIAL_TIP_CHARS, specialCooling, specialCost, specialShown, specialTapCue, specialTip, specialWanted, specialWord } from "../src/game/mobile/combatLogic";
import { CHARACTERS } from "../src/data/characters";

const mikey = CHARACTERS.MIKEY;
const nuke = mikey.signature!;

describe("SPECIAL while it recharges", () => {
  it("reads the game's own numbers: Mikey's Nuclear Option costs 40 Krezz and recharges for 7 s", () => {
    expect(nuke.id).toBe("nuclear_option");
    expect(nuke.cost).toBe(40);
    expect(nuke.cooldown).toBe(7000);
    expect(specialCost(nuke.cost, "MIKEY", {})).toBe(40);
    expect(specialCost(nuke.cost, "MIKEY", { pq_done_pq_mikey: true })).toBe(25);
  });

  it("the sweep: how much of the recharge is still to go (0..1)", () => {
    // used at t = 1000: specialCd = 8000
    expect(specialCooling(1000, 8000, 7000)).toBe(1);
    expect(specialCooling(4500, 8000, 7000)).toBe(0.5);
    expect(specialCooling(8000, 8000, 7000)).toBe(0);
    expect(specialCooling(9000, 8000, 7000)).toBe(0);
    // never used (specialCd 0), or no cooldown at all
    expect(specialCooling(500, 0, 7000)).toBe(0);
    expect(specialCooling(500, 900, 0)).toBe(0);
  });

  it("stays on screen while it recharges, even with the Krezz spent (so the sweep and a tap can say why)", () => {
    expect(specialShown(true, 0, false)).toBe(true);
    expect(specialShown(false, 3000, false)).toBe(true);
    // the calm screen: not ready, not recharging: not there
    expect(specialShown(false, 0, false)).toBe(false);
    // HEADBUTT's 0.7 s beat needs no sweep
    expect(specialShown(false, 300, true)).toBe(false);
  });

  it("a tap that can't go says why: Krezz first (waiting won't fix it), then the recharge", () => {
    expect(specialTapCue({ krezz: 20, cost: 40, coolLeftMs: 0, banned: false, headbutt: false })).toBe("Not enough Krezz (needs 40)");
    expect(specialTapCue({ krezz: 20, cost: 40, coolLeftMs: 5000, banned: false, headbutt: false })).toBe("Not enough Krezz (needs 40)");
    expect(specialTapCue({ krezz: 100, cost: 40, coolLeftMs: 3200, banned: false, headbutt: false })).toBe("Recharging… 4s");
    expect(specialTapCue({ krezz: 100, cost: 40, coolLeftMs: 200, banned: false, headbutt: false })).toBe("Recharging… 1s");
    // it will go: nothing to say
    expect(specialTapCue({ krezz: 100, cost: 40, coolLeftMs: 0, banned: false, headbutt: false })).toBeNull();
    // HEADBUTT, and a decree (the game says that one itself)
    expect(specialTapCue({ krezz: 0, cost: 0, coolLeftMs: 500, banned: false, headbutt: true })).toBeNull();
    expect(specialTapCue({ krezz: 100, cost: 40, coolLeftMs: 0, banned: true, headbutt: false })).toBeNull();
    // the discounted cost is the one it names
    expect(specialTapCue({ krezz: 10, cost: specialCost(nuke.cost, "MIKEY", { pq_done_pq_mikey: true }), coolLeftMs: 0, banned: false, headbutt: false })).toBe("Not enough Krezz (needs 25)");
    // and the rule for showing it at all is unchanged
    expect(specialWanted(39, 40, false)).toBe(false);
  });
});

describe("the first time a special appears: what it does", () => {
  it("NUKE: the signature's name, what it does (no 'cursor' on a phone) and its cost", () => {
    const t = specialTip(specialWord(nuke.id), nuke, 40);
    expect(t.title).toBe("NUKE");
    expect(t.text).toBe("Nuclear Option: Carpet bomb the area where you're aiming. 40 Krezz.");
  });

  it("every lad's special makes a short toast from its own signature (UI text only)", () => {
    for (const c of Object.values(CHARACTERS)) {
      const sig = c.signature;
      if (!sig) continue;
      const t = specialTip(specialWord(sig.id), sig, sig.cost);
      expect(t.title).toBe(specialWord(sig.id));
      expect(t.title).not.toBe("SPECIAL");
      expect(t.text.startsWith(`${sig.name}: `)).toBe(true);
      expect(t.text).not.toMatch(/cursor|click/i);
      expect(t.text.endsWith(sig.cost > 0 ? `${sig.cost} Krezz.` : "No Krezz needed.")).toBe(true);
      // a glance: the description's first sentence, more only while it stays short
      const say = t.text.slice(sig.name.length + 2).replace(/ (\d+ Krezz|No Krezz needed)\.$/, "");
      const first = sig.desc.match(/[^.!?]+[.!?]+/)![0].trim();
      expect(say === first.replace(/around your cursor/i, "where you're aiming") || say.length <= SPECIAL_TIP_CHARS).toBe(true);
    }
  });

  it("a free special says so", () => {
    expect(specialTip("LOAN", { name: "Krez Loan", desc: "Instantly borrow a full Krezz tank and +50% damage for 8s. Interest is paid in health afterwards." }, 0).text).toBe(
      "Krez Loan: Instantly borrow a full Krezz tank and +50% damage for 8s. No Krezz needed.",
    );
  });
});

// The auto-fire audit (ga-02): Settings > Firing (AUTO / LIGHT / STILL / HOLD), LIGHT's slower pace and STILL's
// standing-still gate. All pure; the fights themselves are in the smoke test's "combat" section.
import { afterEach, describe, expect, it } from "vitest";
import { AutoPace, LIGHT_PACE, STILL_MS, STILL_STICK, StillGate } from "../src/game/mobile/combatLogic";
import { DEFAULT_PHONE_SETTINGS, FIRE_STYLES, chosenFromStored, fireStyle, normalizePhoneSettings, phoneSettings, phoneSettingsList, resetPhoneSettingsForTests, updatePhoneSettings } from "../src/game/mobile/settings";
import { FIRE_AUTO, FIRE_LIGHT, FIRE_MANUAL, FIRE_STILL, fireLine } from "../src/game/mobile/combatWording";

describe("Settings > Firing", () => {
  afterEach(() => resetPhoneSettingsForTests());

  it("defaults to AUTO, the stage 2 behaviour (the default is the user's call)", () => {
    expect(DEFAULT_PHONE_SETTINGS.firing).toBe("auto");
    expect(DEFAULT_PHONE_SETTINGS.autoFire).toBe(true);
    expect(fireStyle(phoneSettings())).toBe("auto");
  });

  it("auto-fire off (the stage 2 toggle, still stored by some phones) reads as HOLD whatever firing says", () => {
    expect(fireStyle({ autoFire: false, firing: "auto" })).toBe("hold");
    expect(fireStyle({ autoFire: false, firing: "light" })).toBe("hold");
    expect(fireStyle({ autoFire: true, firing: "still" })).toBe("still");
    expect(fireStyle({ autoFire: true, firing: "hold" })).toBe("hold");
    // a phone that turned auto-fire off in stage 2 keeps it off
    expect(fireStyle(normalizePhoneSettings(chosenFromStored({ v: 2, autoFire: false })))).toBe("hold");
  });

  it("cleans junk: only the four styles", () => {
    for (const f of FIRE_STYLES) expect(normalizePhoneSettings({ firing: f }).firing).toBe(f);
    expect(normalizePhoneSettings({ firing: "twin" }).firing).toBe("auto");
    expect(normalizePhoneSettings({ firing: 3 }).firing).toBe("auto");
  });

  it("the Firing row shows and sets the style, keeping autoFire in step (one row, no separate toggle)", () => {
    const list = phoneSettingsList();
    expect(list.find((e) => e.key === "autoFire")).toBeUndefined();
    const row = list.find((e) => e.key === "firing")!;
    expect(row.type).toBe("choice");
    expect(row.type === "choice" ? row.options.map((o) => o.value) : []).toEqual(["auto", "light", "still", "hold"]);
    expect(row.get()).toBe("auto");
    row.set("hold");
    expect(phoneSettings().autoFire).toBe(false);
    expect(row.get()).toBe("hold");
    row.set("light");
    expect(phoneSettings()).toMatchObject({ autoFire: true, firing: "light" });
    expect(row.get()).toBe("light");
    // the old toggle, turned off from elsewhere (the smoke test, a stage 2 save): the row says HOLD
    updatePhoneSettings({ autoFire: false });
    expect(row.get()).toBe("hold");
    row.set("still");
    expect(fireStyle(phoneSettings())).toBe("still");
  });

  it("the Controls picture's FIRE line follows the style", () => {
    expect(fireLine("auto")).toBe(FIRE_AUTO);
    expect(fireLine("hold")).toBe(FIRE_MANUAL);
    expect(fireLine("light")).toBe(FIRE_LIGHT);
    expect(fireLine("still")).toBe(FIRE_STILL);
    for (const l of [FIRE_AUTO, FIRE_MANUAL, FIRE_LIGHT, FIRE_STILL]) expect(l).not.toMatch(/\b(J|Space|click|mouse|key)\b/i);
  });
});

describe("LIGHT: auto-fire at a slower pace", () => {
  it("waits out the gun's cooldown and then more, so it fires at LIGHT_PACE of the gun's rate", () => {
    const p = new AutoPace();
    expect(p.ok(0)).toBe(true);
    // a shot at 1000 with a 240 ms cooldown: the gun is ready at 1240, LIGHT waits until 1000 + 240 / 0.6 = 1400
    p.shot(1000, 1240);
    expect(p.ok(1239)).toBe(false);
    expect(p.ok(1399)).toBe(false);
    expect(p.ok(1400)).toBe(true);
    // over many shots: shots per second = LIGHT_PACE x the gun's
    let t = 0;
    let n = 0;
    const cd = 230;
    const q = new AutoPace();
    while (t < 60000) {
      if (q.ok(t)) {
        n++;
        q.shot(t, t + cd);
      }
      t += 16;
    }
    const gunRate = 60000 / (Math.ceil(cd / 16) * 16);
    expect(n / gunRate).toBeGreaterThan(LIGHT_PACE - 0.06);
    expect(n / gunRate).toBeLessThan(LIGHT_PACE + 0.06);
  });

  it("resets (a new room starts ready)", () => {
    const p = new AutoPace();
    p.shot(0, 900);
    p.reset();
    expect(p.ok(1)).toBe(true);
  });
});

describe("STILL: auto-fire while you stand still (Archero)", () => {
  it("starts once the stick has rested STILL_MS, stops the moment it moves or you dodge", () => {
    const g = new StillGate();
    expect(g.update(0, 0, false)).toBe(false);
    expect(g.update(STILL_MS - 1, 0, false)).toBe(false);
    expect(g.update(STILL_MS, 0, false)).toBe(true);
    expect(g.update(STILL_MS + 16, 0.9, false)).toBe(false);
    expect(g.update(STILL_MS + 32, 0, false)).toBe(false);
    expect(g.update(STILL_MS * 2 + 32, 0, false)).toBe(true);
    expect(g.update(STILL_MS * 3, 0, true)).toBe(false);
  });

  it("a thumb resting on the stick (a little wobble) counts as still", () => {
    const g = new StillGate();
    g.update(0, STILL_STICK * 0.5, false);
    expect(g.update(STILL_MS, STILL_STICK * 0.9, false)).toBe(true);
    expect(g.update(STILL_MS + 16, STILL_STICK, false)).toBe(false);
  });
});

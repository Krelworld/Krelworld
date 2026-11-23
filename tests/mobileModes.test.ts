import { describe, expect, it } from "vitest";
import { addSceneRule, NONE, resolveMode, sameDecision, SCENE_RULES, verbFromPrompt, type GameView, type ModeDecision, type SceneState } from "../src/game/mobile/modes";
import { wakeCare } from "../src/game/mobile/shell";

const view = (scenes: (string | SceneState)[], extra: Partial<GameView> = {}): GameView => ({ scenes: scenes.map((s) => (typeof s === "string" ? { key: s } : s)), ...extra });

describe("phone layer modes: the scene table", () => {
  it("nothing running, the Enter gate, the title and the front-end screens: no controls", () => {
    for (const k of [[], ["Boot"], ["Enter"], ["Title"], ["CharSelect"], ["Difficulty"], ["Banter"], ["ChapterSelect"], ["Slots"]]) {
      expect(resolveMode(view(k)).mode).toBe("none");
    }
  });

  it("walking at home: stick, pause through the scene's own Esc path, ACTION only with a prompt", () => {
    const d = resolveMode(view(["UI", "Home"]));
    expect(d).toMatchObject({ mode: "walk", scene: "Home", pause: "edge", pauseButton: true, action: null, legacyPad: false });
    expect(resolveMode(view(["UI", { key: "Home", prompt: "E: Watch KrelTV" }])).action).toBe("WATCH");
  });

  it("the town, the Club, Kreddle and the Venue are walking scenes too (blocker B1)", () => {
    expect(resolveMode(view(["Hub", "UI"]))).toMatchObject({ mode: "walk", scene: "Hub", pause: "edge" });
    // on a laptop Esc walks you out of these: on a phone the button opens the pause menu
    for (const k of ["Club", "Kreddle", "Venue"]) expect(resolveMode(view(["UI", k]))).toMatchObject({ mode: "walk", scene: k, pause: "menu", pauseButton: true });
  });

  it("the Kreddle raid and rout pause through their own Esc path, and have no SANMIK", () => {
    expect(resolveMode(view(["UI", { key: "Kreddle", sub: "raid" }]), SCENE_RULES)).toMatchObject({ mode: "walk", pause: "edge", sanmik: false });
    expect(resolveMode(view(["UI", { key: "Kreddle", sub: "rout" }]), SCENE_RULES)).toMatchObject({ mode: "walk", pause: "edge" });
  });

  it("busy (a panel, a scripted moment): nothing at all, so the panel gets every touch", () => {
    expect(resolveMode(view(["UI", { key: "Home", busy: true, prompt: "E: Watch KrelTV" }]))).toEqual({ ...NONE, scene: "Home" });
  });

  it("an overlay over a walking scene wins: conversation, TV, pause menu, cutscene, 3D shot", () => {
    for (const o of ["Dialogue", "TV", "Menu", "Cutscene", "Meeting", "Vignette", "WeaponPick", "Tutorial", "__p3d_shot_3"]) {
      expect(resolveMode(view(["Hub", "UI", o])).mode).toBe("none");
      // (even if the overlay is listed under the walking scene)
      expect(resolveMode(view([o, "Hub", "UI"])).mode).toBe("none");
    }
  });

  it("SANMIK shows for Mikey in the walking scenes", () => {
    expect(resolveMode(view(["Hub", "UI"], { sanmikToggle: true })).sanmik).toBe(true);
    expect(resolveMode(view(["Hub", "UI"], { sanmikToggle: false })).sanmik).toBe(false);
  });

  it("combat: the canvas pad does it (stage 1), the layer takes no touches and shows no pause of its own", () => {
    expect(resolveMode(view(["Dungeon", "UI"]))).toMatchObject({ mode: "combat", legacyPad: true, pause: "edge", pauseButton: false });
    expect(resolveMode(view([{ key: "Dungeon", side: true }, "UI"]))).toMatchObject({ mode: "side", legacyPad: true });
    expect(resolveMode(view(["Finale"]))).toMatchObject({ mode: "brawl", legacyPad: true });
  });

  it("minigames are tap mode; card menus and boards none", () => {
    for (const k of ["Minigame", "Whack", "Drive", "BeepBeep"]) expect(resolveMode(view([k])).mode).toBe("tap");
    for (const k of ["Pub", "Pit", "PitLoan", "PolsonHome"]) expect(resolveMode(view([k, "UI"])).mode).toBe("none");
  });

  it("an unknown scene: none (taps go straight to the game, as today)", () => {
    expect(resolveMode(view(["SomethingNew"])).mode).toBe("none");
  });

  it("stage 2 can put a rule in front", () => {
    const rules = [...SCENE_RULES];
    const before = SCENE_RULES.length;
    addSceneRule({ name: "test", match: (k) => k === "Dungeon", decide: () => ({ mode: "combat", legacyPad: false }) });
    try {
      expect(resolveMode(view(["Dungeon", "UI"])).legacyPad).toBe(false);
    } finally {
      SCENE_RULES.splice(0, SCENE_RULES.length, ...rules);
    }
    expect(SCENE_RULES.length).toBe(before);
  });
});

describe("phone layer modes: fights, the stick, coming back (round 1 fixes)", () => {
  it("the Hub's shoving match on the bridge: ACTION says SHOVE with no prompt at all (R6)", () => {
    expect(resolveMode(view(["UI", { key: "Hub", sub: "shove" }]))).toMatchObject({ mode: "walk", action: "SHOVE", sanmik: false, pause: "edge" });
    // even when something else is in range (its prompt would have said INSPECT)
    expect(resolveMode(view(["UI", { key: "Hub", sub: "shove", prompt: "E: Inspect the Great Tap (dry)" }])).action).toBe("SHOVE");
  });

  it("live action is marked (fights, the raid, minigames, the finale); town is not (P1)", () => {
    expect(resolveMode(view(["Dungeon", "UI"])).live).toBe(true);
    expect(resolveMode(view([{ key: "Dungeon", side: true }, "UI"])).live).toBe(true);
    expect(resolveMode(view(["Finale"])).live).toBe(true);
    expect(resolveMode(view(["Whack"])).live).toBe(true);
    expect(resolveMode(view(["UI", { key: "Kreddle", sub: "raid" }])).live).toBe(true);
    expect(resolveMode(view(["Hub", "UI"])).live).toBe(false);
    expect(resolveMode(view(["UI", "Home"])).live).toBe(false);
    expect(resolveMode(view([{ key: "Dungeon", busy: true }, "UI", "Dialogue"])).live).toBe(false);
  });

  it("coming back: the pause menu where there is one, the carry-on card where there isn't, nothing in town (P1)", () => {
    expect(wakeCare(resolveMode(view(["Dungeon", "UI"])))).toBe("pause");
    expect(wakeCare(resolveMode(view(["UI", { key: "Kreddle", sub: "rout" }])))).toBe("pause");
    expect(wakeCare(resolveMode(view(["Finale"])))).toBe("card");
    expect(wakeCare(resolveMode(view(["BeepBeep"])))).toBe("card");
    expect(wakeCare(resolveMode(view(["Hub", "UI"])))).toBe(null);
    expect(wakeCare(resolveMode(view(["Hub", "UI", "Menu"])))).toBe(null);
    expect(wakeCare(null)).toBe(null);
  });

  it("the stick is the decision's: 2d in the walking scenes, none on the old pad or in menus", () => {
    expect(resolveMode(view(["Hub", "UI"])).stick).toBe("2d");
    expect(resolveMode(view(["Dungeon", "UI"])).stick).toBe(null);
    expect(resolveMode(view(["Title"])).stick).toBe(null);
  });

  it("two decisions are the same only if every field is, including fields a stage 2 rule adds (R7)", () => {
    const a = resolveMode(view(["Dungeon", "UI"]));
    const b = { ...a, ready: "WONK" } as ModeDecision;
    const c = { ...a, ready: null } as ModeDecision;
    expect(sameDecision(a, { ...a })).toBe(true);
    expect(sameDecision(b, a)).toBe(false);
    expect(sameDecision(a, b)).toBe(false);
    expect(sameDecision(b, c)).toBe(false);
    expect(sameDecision(b, { ...b })).toBe(true);
    // through a rule, as stage 2 would add one
    const rules = [...SCENE_RULES];
    try {
      addSceneRule({ name: "test", match: (k) => k === "Dungeon", decide: (s) => ({ mode: "combat", legacyPad: false, ready: s.side ? null : "WONK" }) });
      const d1 = resolveMode(view(["Dungeon", "UI"]));
      const d2 = resolveMode(view([{ key: "Dungeon", side: true }, "UI"]));
      expect(d1.ready).toBe("WONK");
      expect(d2.ready).toBe(null);
      // (the same in every listed field: only the rule's own field differs, and that is enough)
      expect(sameDecision(d1, d2)).toBe(false);
    } finally {
      SCENE_RULES.splice(0, SCENE_RULES.length, ...rules);
    }
  });
});

describe("phone layer: ACTION's word", () => {
  it("takes the verb from the prompt", () => {
    expect(verbFromPrompt("E: Talk to Gronny")).toBe("TALK");
    expect(verbFromPrompt("E: Enter Town Hall")).toBe("ENTER");
    expect(verbFromPrompt("E: 🍬 Throw a sweetie over the fence (3 left)")).toBe("THROW");
    expect(verbFromPrompt("E: Enter Krunch Gym")).toBe("ENTER");
    expect(verbFromPrompt("E / ATTACK: hit Alistair")).toBe("HIT");
    expect(verbFromPrompt("E: Tip Destiny (5 Krezzcoin)\n👀: Watch up close (10 Krezzcoin)")).toBe("TIP");
  });

  it("anything usable without a known verb says USE", () => {
    expect(verbFromPrompt("E: Jukebox (every tune you've heard)")).toBe("USE");
    expect(verbFromPrompt("E: Crobley Corp HQ")).toBe("USE");
  });

  it("places, machines and long verbs get a short, right word (P14)", () => {
    // both ways over the Kreddle bridge
    expect(verbFromPrompt("E: Cross the bridge back to Krelworld")).toBe("GO");
    expect(verbFromPrompt("E: The Kreddle Bridge")).toBe("GO");
    expect(verbFromPrompt("E: Kreddle Bridge")).toBe("GO");
    expect(verbFromPrompt("E: Polson Towers (pop round for a chat)")).toBe("VISIT");
    expect(verbFromPrompt("E: THE KREDDLE EXCHANGE (🎟 3 Krokens · 💰 120 Krezzcoin)")).toBe("ENTER");
    expect(verbFromPrompt("E: KRAZY REELS (slots) · 150 Krezzcoin a spin")).toBe("PLAY");
    expect(verbFromPrompt("E: WHEEL OF KREDDLE · 300 Krezzcoin a spin")).toBe("SPIN");
    expect(verbFromPrompt("E: Pussy Juice Vending (15 Krezzcoin: +1 bottle)")).toBe("BUY");
    expect(verbFromPrompt("E: Rummage")).toBe("SEARCH");
    expect(verbFromPrompt("E: Inspect the Great Tap (dry)")).toBe("LOOK");
    expect(verbFromPrompt("E: Drink from the Great Tap")).toBe("DRINK");
    // (a bridge mentioned later in a prompt is not the bridge)
    expect(verbFromPrompt("E: Talk to Gronny (by the bridge)")).toBe("TALK");
  });

  it("no prompt, or one you can't act on: no ACTION at all", () => {
    expect(verbFromPrompt(null)).toBe(null);
    expect(verbFromPrompt("")).toBe(null);
    expect(verbFromPrompt("Nobody will wonk-off with you now.")).toBe(null);
    expect(verbFromPrompt("Big Derek is right there. Not now.")).toBe(null);
  });
});

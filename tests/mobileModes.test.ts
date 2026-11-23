import { describe, expect, it } from "vitest";
import { addSceneRule, NONE, resolveMode, SCENE_RULES, verbFromPrompt, type GameView, type SceneState } from "../src/game/mobile/modes";

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

describe("phone layer: ACTION's word", () => {
  it("takes the verb from the prompt", () => {
    expect(verbFromPrompt("E: Talk to Gronny")).toBe("TALK");
    expect(verbFromPrompt("E: Enter Town Hall")).toBe("ENTER");
    expect(verbFromPrompt("E: 🍬 Throw a sweetie over the fence (3 left)")).toBe("THROW");
    expect(verbFromPrompt("E: Cross the bridge back to Krelworld")).toBe("CROSS");
    expect(verbFromPrompt("E / ATTACK: hit Alistair")).toBe("HIT");
    expect(verbFromPrompt("E: Tip Destiny (5 Krezzcoin)\n👀: Watch up close (10 Krezzcoin)")).toBe("TIP");
  });

  it("anything usable without a known verb says USE", () => {
    expect(verbFromPrompt("E: KRAZY REELS (slots) · 150 Krezzcoin a spin")).toBe("USE");
    expect(verbFromPrompt("E: Jukebox (every tune you've heard)")).toBe("USE");
  });

  it("no prompt, or one you can't act on: no ACTION at all", () => {
    expect(verbFromPrompt(null)).toBe(null);
    expect(verbFromPrompt("")).toBe(null);
    expect(verbFromPrompt("Nobody will wonk-off with you now.")).toBe(null);
    expect(verbFromPrompt("Big Derek is right there. Not now.")).toBe(null);
  });
});

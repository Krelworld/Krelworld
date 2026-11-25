// Phone combat (stage 2, part 1): aim selection, auto-fire rules, the right-hand cluster's layout and its shared touch
// surface (gap routing), tap / hold recognition, READY / HEAL and the Dungeon's mode rows. All pure.
import { describe, expect, it } from "vitest";
import dungeonsSrc from "../src/data/dungeons.ts?raw";
import bossesSrc from "../src/content/bosses.ts?raw";
import citadelSrc from "../src/content/citadel.ts?raw";
import clubSrc from "../src/game/scenes/ClubScene.ts?raw";
import squeezeSrc from "../src/game/systems/squeeze.ts?raw";
import combatBossesSrc from "../src/game/combat/Bosses.ts?raw";
import citadelSceneSrc from "../src/game/scenes/citadel/Citadel.ts?raw";
import heroSrc from "../src/game/combat/HeroPassengers.ts?raw";
import { ACQUIRE, AIM_TUNE, aimPointFor, angleDiff, autoFireOk, barrelInTheWay, BARREL_DANGER, pickTarget, snapAim, targetScore, type AimTarget } from "../src/game/mobile/aim";
import {
  DUNGEON_RULE,
  HEAL_BELOW,
  healWanted,
  HOLD_MS,
  HOLD_SLOP,
  HoldTracker,
  PICKER_RULE,
  READY,
  readyAbility,
  spamGap,
  MashQueue,
  SPAM_BURST_MS,
  SPAM_GAP_MS,
  specialFill,
  specialWord,
} from "../src/game/mobile/combatLogic";
import { edgeDistance, GAP_REACH, groupHit, HIT_SLOP, layoutSlots, routeTouch, safeRect, type RouteCandidate, type Viewport } from "../src/game/mobile/layout";
import { DEFAULT_PHONE_SETTINGS } from "../src/game/mobile/settings";
import { resolveMode, SCENE_RULES, type SceneRule } from "../src/game/mobile/modes";

const E = (id: number, x: number, y: number, r = 12, extra: Partial<AimTarget> = {}): AimTarget => ({ id, x, y, r, kind: "enemy", ...extra });
const O = (id: string, x: number, y: number, r = 14): AimTarget => ({ id, x, y, r, kind: "object" });
const ME = { x: 500, y: 400 };
const STILL = { x: 0, y: 0 };
const N = AIM_TUNE.normal;

describe("phone combat: aim selection (research M2)", () => {
  it("picks the nearest enemy with the stick at rest", () => {
    const t = pickTarget({ me: ME, stick: STILL, enemies: [E(1, 700, 400), E(2, 560, 400), E(3, 500, 650)], prev: null, tune: N });
    expect(t?.id).toBe(2);
  });

  it("biases toward where the stick points (a slightly farther enemy that way wins)", () => {
    const enemies = [E(1, 380, 400), E(2, 640, 400)]; // 120 left, 140 right
    expect(pickTarget({ me: ME, stick: STILL, enemies, prev: null, tune: N })?.id).toBe(1);
    expect(pickTarget({ me: ME, stick: { x: 1, y: 0 }, enemies, prev: null, tune: N })?.id).toBe(2);
    // aim assist off: no bias
    expect(pickTarget({ me: ME, stick: { x: 1, y: 0 }, enemies, prev: null, tune: AIM_TUNE.off })?.id).toBe(1);
    // a barely-pushed stick (under 0.3) doesn't count
    expect(targetScore(ME, { x: 640, y: 400 }, { x: 0.2, y: 0 }, N.bias)).toBe(140);
  });

  it("is sticky: keeps its target until another is clearly better, then switches", () => {
    const enemies = [E(1, 650, 400), E(2, 620, 400)];
    // 2 is nearer, but 1 is held (150 vs 120: not under 0.6 x 150)
    expect(pickTarget({ me: ME, stick: STILL, enemies, prev: 1, tune: N })?.id).toBe(1);
    // now 2 is much nearer: it takes over
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 650, 400), E(2, 540, 400)], prev: 1, tune: N })?.id).toBe(2);
    // off: no stickiness at all
    expect(pickTarget({ me: ME, stick: STILL, enemies, prev: 1, tune: AIM_TUNE.off })?.id).toBe(2);
    // the held one died (gone from the list): the nearest
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(2, 620, 400)], prev: 1, tune: N })?.id).toBe(2);
  });

  it("an enemy inside the gun's range wins over a sticky one outside it, so auto-fire never goes quiet (F3)", () => {
    // pistol (420): the far one (470 right) was the target; another comes in from the left
    const far = E(1, 970, 400);
    for (const d of [400, 350, 300]) {
      const t = pickTarget({ me: ME, stick: STILL, enemies: [far, E(2, 500 - d, 400)], prev: 1, tune: N, fireRange: 420 });
      expect(t?.id).toBe(2);
      expect(autoFireOk({ me: ME, target: t, range: 420 })).toBe(true);
    }
    // fleeing the chaser (stick pointing away) does not hold the aim on the far one either
    expect(pickTarget({ me: ME, stick: { x: 1, y: 0 }, enemies: [far, E(2, 100, 400)], prev: 1, tune: N, fireRange: 420 })?.id).toBe(2);
    // shotgun (230): 210 px away is shot, the 350 px one waits
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 850, 400), E(2, 290, 400)], prev: 1, tune: N, fireRange: 230 })?.id).toBe(2);
    // nobody inside the gun's range: the usual sticky pick (the ring still shows who's next)
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 970, 400), E(2, 0, 400)], prev: 1, tune: N, fireRange: 420 })?.id).toBe(1);
    // two inside the range: stickiness as before
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 650, 400), E(2, 620, 400)], prev: 1, tune: N, fireRange: 420 })?.id).toBe(1);
  });

  it("only considers enemies in reach and on screen", () => {
    const view = { x: 0, y: 0, w: 960, h: 540 };
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 500 + ACQUIRE + 40, 400)], prev: null, tune: N })).toBeNull();
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 1000, 400)], prev: null, tune: N, view, reach: 900 })).toBeNull();
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 900, 400)], prev: null, tune: N, view })?.id).toBe(1);
  });

  it("falls back to the nearest barrel or crate only when no enemy is about", () => {
    const objects = [O("b0", 560, 400), O("b1", 700, 400)];
    expect(pickTarget({ me: ME, stick: STILL, enemies: [], objects, prev: null, tune: N })?.id).toBe("b0");
    expect(pickTarget({ me: ME, stick: STILL, enemies: [E(1, 800, 400)], objects, prev: null, tune: N })?.id).toBe(1);
  });

  it("a slide snaps onto an enemy within 15 degrees (normal), 25 (strong), never with assist off", () => {
    const enemies = [E(1, 700, 400 + Math.tan((12 * Math.PI) / 180) * 200)];
    const s = snapAim(ME, 0, enemies, N);
    expect(s.snapped?.id).toBe(1);
    expect(Math.abs(angleDiff(s.angle, (12 * Math.PI) / 180))).toBeLessThan(0.001);
    const far = [E(1, 700, 400 + Math.tan((20 * Math.PI) / 180) * 200)];
    expect(snapAim(ME, 0, far, N).snapped).toBeNull();
    expect(snapAim(ME, 0, far, AIM_TUNE.strong).snapped?.id).toBe(1);
    expect(snapAim(ME, 0, enemies, AIM_TUNE.off)).toEqual({ angle: 0, snapped: null });
  });

  it("strong aim leads a moving target; normal aims where it is", () => {
    const t = E(1, 800, 400, 12, { vx: 0, vy: 100 });
    expect(aimPointFor(ME, t, 600, false)).toEqual({ x: 800, y: 400 });
    const lead = aimPointFor(ME, t, 600, true);
    expect(lead.x).toBe(800);
    expect(lead.y).toBeCloseTo(450, 5);
  });
});

describe("phone combat: auto-fire (research M1)", () => {
  const view = { x: 0, y: 0, w: 960, h: 540 };
  it("fires only at an enemy in the gun's range, on screen", () => {
    expect(autoFireOk({ me: ME, target: E(1, 800, 400), range: 400, view })).toBe(true);
    expect(autoFireOk({ me: ME, target: E(1, 950, 400), range: 400, view })).toBe(false); // 450 > 400 + 12
    expect(autoFireOk({ me: ME, target: E(1, 990, 400), range: 1000, view })).toBe(false); // off screen
    expect(autoFireOk({ me: ME, target: null, range: 400, view })).toBe(false);
  });

  it("never at barrels or crates", () => {
    expect(autoFireOk({ me: ME, target: O("b0", 560, 400), range: 400, view })).toBe(false);
  });

  it("holds fire when a barrel right by you is in the line (it would blow up in your face)", () => {
    const t = E(1, 800, 400);
    expect(barrelInTheWay(ME, t, [O("b", 560, 405)])).toBe(true);
    expect(autoFireOk({ me: ME, target: t, range: 400, view, barrels: [O("b", 560, 405)] })).toBe(false);
    // a barrel further than BARREL_DANGER, or off the line, doesn't stop it
    expect(barrelInTheWay(ME, t, [O("b", 500 + BARREL_DANGER + 20, 400)])).toBe(false);
    expect(barrelInTheWay(ME, t, [O("b", 560, 470)])).toBe(false);
  });

  it("in a room that bans holding the trigger, lets go briefly every two seconds", () => {
    expect(spamGap(1000, 0)).toBe(false);
    expect(spamGap(1000 + SPAM_BURST_MS - 1, 1000)).toBe(false);
    expect(spamGap(1000 + SPAM_BURST_MS + 10, 1000)).toBe(true);
    expect(spamGap(1000 + SPAM_BURST_MS + SPAM_GAP_MS + 10, 1000)).toBe(false);
  });
});

describe("phone combat: READY, HEAL, SPECIAL (research S1, S3)", () => {
  const base = { golden: false, cumeReady: false, canTransform: false, wonk: 0, fartLevel: 0 };
  it("READY offers the meter ability that's ready, in order", () => {
    expect(readyAbility(base)).toBeNull();
    expect(readyAbility({ ...base, fartLevel: 3 })).toBeNull();
    expect(readyAbility({ ...base, fartLevel: 4 })).toBe("ibs");
    expect(readyAbility({ ...base, fartLevel: 4, canTransform: true })).toBe("golden");
    expect(readyAbility({ ...base, fartLevel: 4, canTransform: true, wonk: 100 })).toBe("wonk");
    // golden: the beam (when its cooldown is over), nothing else
    expect(readyAbility({ ...base, golden: true, wonk: 100, cumeReady: true })).toBe("cume");
    expect(readyAbility({ ...base, golden: true, wonk: 100, cumeReady: false })).toBeNull();
    expect(Object.values(READY).map((r) => r.edge).sort()).toEqual(["burst", "cume", "fart", "transform"]);
  });

  it("HEAL pops in under 40% health with juice, not when healing is banned", () => {
    expect(HEAL_BELOW).toBe(0.4);
    expect(healWanted(35, 90, 2)).toBe(true);
    expect(healWanted(36, 90, 2)).toBe(false);
    expect(healWanted(10, 90, 0)).toBe(false);
    expect(healWanted(10, 90, 2, true)).toBe(false);
  });

  it("SPECIAL says the lad's special in one word and fills with Krezz", () => {
    expect(specialWord("banishment_dash")).toBe("DASH");
    expect(specialWord("nuclear_option")).toBe("NUKE");
    expect(specialWord("anything", true)).toBe("HEADBUTT");
    expect(specialWord(undefined)).toBe("SPECIAL");
    expect(specialFill(10, 40)).toBe(0.25);
    expect(specialFill(80, 40)).toBe(1);
    expect(specialFill(0, 0)).toBe(1);
  });
});

describe("phone combat: tap and hold (research S11)", () => {
  it("a quick still press is a tap; HOLD_MS is a hold; moving HOLD_SLOP first cancels", () => {
    const h = new HoldTracker();
    h.down(0, 0, 1000);
    expect(h.tick(1000 + HOLD_MS - 1)).toBeNull();
    expect(h.up(1100)).toBe("tap");
    h.down(0, 0, 2000);
    expect(h.tick(2000 + HOLD_MS)).toBe("hold");
    expect(h.tick(2000 + HOLD_MS + 50)).toBeNull(); // once
    expect(h.up(2600)).toBeNull();
    h.down(0, 0, 3000);
    expect(h.move(HOLD_SLOP - 1, 0)).toBeNull();
    expect(h.move(HOLD_SLOP + 1, 0)).toBe("cancel");
    expect(h.tick(3000 + HOLD_MS + 10)).toBeNull();
    expect(h.up(3500)).toBeNull();
    expect(HOLD_MS).toBe(300);
    expect(HOLD_SLOP).toBe(12);
  });
});

/** iPhone 14 landscape in a home-screen app, Safari with its bars, a small Android. */
const IPHONE: Viewport = { w: 844, h: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 } };
const SAFARI: Viewport = { w: 750, h: 340, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
const ANDROID: Viewport = { w: 740, h: 360, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
const CLUSTER = ["prime", "left", "upLeft", "up", "ready", "heal", "combatAction"] as const;

describe("phone combat: the right-hand cluster (layout v2)", () => {
  it("FIRE, SWAP, DODGE, SPECIAL, READY, HEAL sit where layout v2 puts them on an iPhone 14", () => {
    const s = layoutSlots(IPHONE, DEFAULT_PHONE_SETTINGS);
    expect([s.prime.cx, s.prime.cy, s.prime.size]).toEqual([745, 317, 84]);
    expect([s.left.cx, s.left.cy, s.left.size]).toEqual([649, 325, 60]);
    expect([s.upLeft.cx, s.upLeft.cy]).toEqual([675, 243]);
    // (UP and READY move in from the Dynamic Island band: 60 px from the edge)
    expect([s.up.cx, s.up.cy]).toEqual([754, 219]);
    expect([s.ready.cx, s.ready.cy]).toEqual([754, 143]);
    expect([s.heal.cx, s.heal.cy, s.heal.size]).toEqual([679, 165, 56]);
  });

  for (const [name, vp] of [
    ["844x390", IPHONE],
    ["750x340", SAFARI],
    ["740x360", ANDROID],
  ] as const) {
    it(`${name}: every combat control is at least 52 px, inside the safe area, and 12 px or more from the next`, () => {
      const s = layoutSlots(vp, DEFAULT_PHONE_SETTINGS);
      const safe = safeRect(vp);
      for (const id of CLUSTER) {
        const p = s[id];
        expect(p.size).toBeGreaterThanOrEqual(52);
        expect(p.cx - p.size / 2).toBeGreaterThanOrEqual(safe.x - 0.01);
        expect(p.cx + p.size / 2).toBeLessThanOrEqual(safe.x + safe.w + 0.01);
        expect(p.cy + p.size / 2).toBeLessThanOrEqual(safe.y + safe.h + 0.01);
      }
      for (let i = 0; i < CLUSTER.length; i++)
        for (let j = i + 1; j < CLUSTER.length; j++) {
          const a = s[CLUSTER[i]];
          const b = s[CLUSTER[j]];
          const gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.size / 2 - b.size / 2;
          expect(gap, `${CLUSTER[i]} / ${CLUSTER[j]}`).toBeGreaterThanOrEqual(12);
        }
    });
  }
});

describe("phone combat: the cluster's shared touch surface (research M3)", () => {
  const s = layoutSlots(IPHONE, DEFAULT_PHONE_SETTINGS);
  const cand = (id: keyof typeof s): RouteCandidate => {
    const p = s[id];
    return { id, cx: p.cx, cy: p.cy, w: p.size, h: p.size, hit: { x: p.cx - p.size / 2 - HIT_SLOP, y: p.cy - p.size / 2 - HIT_SLOP, w: p.size + 2 * HIT_SLOP, h: p.size + 2 * HIT_SLOP } };
  };
  const cands = [cand("prime"), cand("left"), cand("upLeft"), cand("up")];

  it("a touch on a control is that control", () => {
    expect(routeTouch(745, 317, cands)).toBe("prime");
    expect(routeTouch(675, 243, cands)).toBe("upLeft");
  });

  it("a touch in a gap goes to the nearest control within 20 px of its drawing", () => {
    // between DODGE (675,243 r30) and FIRE (745,317 r42), nearer FIRE's edge
    const x = 712;
    const y = 285;
    expect(edgeDistance(cands[0], x, y)).toBeLessThan(edgeDistance(cands[2], x, y));
    expect(routeTouch(x, y, cands)).toBe("prime");
    // more than 20 px from every drawing: nobody's
    expect(routeTouch(560, 120, cands)).toBeNull();
    expect(GAP_REACH).toBe(20);
  });

  it("where touch areas overlap, the nearest centre wins", () => {
    // a point inside both DODGE's and FIRE's slop
    const a = cands[2];
    const b = cands[0];
    const overl = { x: 705, y: 280 };
    const inA = overl.x >= a.hit.x && overl.x < a.hit.x + a.hit.w && overl.y >= a.hit.y && overl.y < a.hit.y + a.hit.h;
    const inB = overl.x >= b.hit.x && overl.x < b.hit.x + b.hit.w && overl.y >= b.hit.y && overl.y < b.hit.y + b.hit.h;
    expect(inA && inB).toBe(true);
    const nearer = Math.hypot(overl.x - a.cx, overl.y - a.cy) < Math.hypot(overl.x - b.cx, overl.y - b.cy) ? "upLeft" : "prime";
    expect(routeTouch(overl.x, overl.y, cands)).toBe(nearer);
  });

  it("the prime corner's touch area runs to the screen's edge and down to the home-indicator strip", () => {
    const p = s.prime;
    const hit = groupHit(IPHONE, p, GAP_REACH, true);
    expect(hit.x + hit.w).toBe(844);
    expect(hit.y + hit.h).toBe(369);
    expect(hit.x).toBe(p.cx - p.size / 2 - GAP_REACH);
    // left-handed (mirrored to the left): to the left edge instead
    const m = layoutSlots(IPHONE, { ...DEFAULT_PHONE_SETTINGS, leftHanded: true }).prime;
    expect(groupHit(IPHONE, m, GAP_REACH, true).x).toBe(0);
  });
});

describe("phone combat: the Dungeon's rows in the mode table", () => {
  const rules: SceneRule[] = [...SCENE_RULES.filter((r) => r.name !== "dungeon"), DUNGEON_RULE];
  rules.unshift(PICKER_RULE);
  const run = (scenes: { key: string; [k: string]: unknown }[]) => resolveMode({ scenes }, rules);

  it("a top-down room is combat: the phone stick (gutter included), no old pad, pause, live", () => {
    const d = run([{ key: "Dungeon", busy: false, side: false, prompt: null }, { key: "UI" }]);
    expect(d).toMatchObject({ mode: "combat", stick: "2d", legacyPad: false, pause: "edge", pauseButton: true, live: true, action: null, mash: false });
  });

  it("a prompt in the room gives ACTION its word", () => {
    expect(run([{ key: "Dungeon", prompt: "E: Watch KrelTV" }]).action).toBe("WATCH");
  });

  it("the mash overlay (WONK) keeps combat, flagged", () => {
    expect(run([{ key: "Dungeon", sub: "mash" }])).toMatchObject({ mode: "combat", mash: true, action: null });
  });

  it("a scripted moment: no buttons, and coming back to it asks for a tap (no pause route)", () => {
    expect(run([{ key: "Dungeon", busy: true }])).toMatchObject({ mode: "none", live: true, pause: null, scene: "Dungeon" });
  });

  it("side-scrolling rooms are ours too: an x-only stick, no old pad (stage 2 part 2)", () => {
    expect(run([{ key: "Dungeon", side: true }])).toMatchObject({ mode: "side", legacyPad: false, stick: "x", pause: "edge", pauseButton: true, live: true });
    expect(run([{ key: "Dungeon", side: true, busy: true }])).toMatchObject({ mode: "none", live: true });
  });

  it("the weapon picker over a fight keeps the fight's mode (picker)", () => {
    expect(run([{ key: "Dungeon" }, { key: "UI" }, { key: "WeaponPick" }])).toMatchObject({ mode: "combat", picker: true, scene: "Dungeon", pause: null });
    expect(run([{ key: "Dungeon", side: true }, { key: "WeaponPick" }])).toMatchObject({ mode: "side", picker: true, stick: "x" });
  });

  it("a conversation or the pause menu over the fight: no fight buttons", () => {
    expect(run([{ key: "Dungeon" }, { key: "Dialogue" }]).mode).toBe("none");
    expect(run([{ key: "Dungeon" }, { key: "Menu" }]).mode).toBe("none");
  });
});

describe("phone combat: touch wording for the fights (UI hints only)", async () => {
  const { touchWording, TOUCH_WORDING } = await import("../src/game/mobile/wording");
  const { COMBAT_WORDING, COMBAT_WORDING_FIRST, TUTORIAL_TEXT } = await import("../src/game/mobile/combatWording");
  const rules = [...COMBAT_WORDING_FIRST, ...TOUCH_WORDING, ...COMBAT_WORDING];
  it("the first dungeon's how-to-play rows name the phone's buttons, not the old pad's", () => {
    for (const t of ["ATTACK button (hold; aims at the nearest enemy)", "GUN button", "E button", "PJ button. The national drink.", "WONK button. Hitting things fills your WONK meter.", "Later on: ⚡T, then CUME."]) {
      expect(TUTORIAL_TEXT.test(t), t).toBe(true);
      const out = touchWording(t, rules);
      expect(out, t).not.toMatch(/ATTACK button|GUN button|^E button|PJ button|WONK button|⚡T/);
    }
    expect(touchWording("Esc pauses at any time; CONTROLS in the pause menu lets you rebind every key.", rules)).toBe("II (top right) pauses at any time.");
  });
  it("the weapon picker's how-to line and the finale's inject hint speak touch", () => {
    expect(touchWording("(the world's slowed right down) · Tap one · or ←/→ and SPACE · or 1–9 · or let go of SWAP on it · ESC to cancel", rules)).toBe("(the world's slowed right down) · Tap one, or slide onto one and let go · ✕ to close");
    expect(touchWording("Inject each of the lads (walk up, press E). Don't get hit.", rules)).toBe("Inject each of the lads (walk up, tap ACTION). Don't get hit.");
  });
});

describe("phone combat: the fights' toasts and narrated control tips (merged with the dialogue's narrator path)", async () => {
  const { touchWording, TOUCH_WORDING, narratorTip, NARRATOR_TIPS } = await import("../src/game/mobile/wording");
  const { COMBAT_WORDING, COMBAT_WORDING_FIRST, COMBAT_NARRATOR_TIPS } = await import("../src/game/mobile/combatWording");
  const rules = [...COMBAT_WORDING_FIRST, ...TOUCH_WORDING, ...COMBAT_WORDING];
  const SRC: Record<string, string> = {
    "src/data/dungeons.ts": dungeonsSrc,
    "src/content/bosses.ts": bossesSrc,
    "src/content/citadel.ts": citadelSrc,
    "src/game/scenes/ClubScene.ts": clubSrc,
    "src/game/systems/squeeze.ts": squeezeSrc,
  };
  const src = (f: string) => SRC[f];
  it("fight toasts name the phone's buttons", () => {
    expect(touchWording("WONK FULL. KREZZ FULL. Press R.", rules)).toBe("WONK FULL. KREZZ FULL. Tap WONK!");
    expect(touchWording("A weapons crate appeared. Press E to open it.", rules)).toBe("A weapons crate appeared. Tap ACTION to open it.");
    expect(touchWording("Get to Bob first and press E, or he'll cuddle them for health.", rules)).toBe("Get to Bob first and tap ACTION, or he'll cuddle them for health.");
    expect(touchWording("Alistair is dazed. Get close and HEADBUTT him (F / right click)!", rules)).toBe("Alistair is dazed. Get close and HEADBUTT him (tap HEADBUTT)!");
  });
  it("the Cronster's hostage tags and the Citadel's exchange sign lose their key (R3), matched whole when made", async () => {
    const { FIGHT_UI_LINES } = await import("../src/game/mobile/combatWording");
    const tag = "MOLLOR\n(tied up: E to free)";
    expect(FIGHT_UI_LINES.some((r) => r.test(tag))).toBe(true);
    expect(touchWording(tag, rules)).toBe("MOLLOR\n(tied up: tap ACTION to free)");
    const sign = "🎁 KREDDLE\nEXCHANGE (E)";
    expect(FIGHT_UI_LINES.some((r) => r.test(sign))).toBe(true);
    expect(touchWording(sign, rules)).not.toMatch(/\(E\)/);
    // the game still writes them that way (so the rows are not dead)
    expect(combatBossesSrc).toContain("(tied up: E to free)");
    expect(citadelSceneSrc).toContain('"🎁 KREDDLE\\nEXCHANGE (E)"');
    // the hero passengers' finisher has phone words and the phone's big buttons
    const hp = heroSrc;
    expect(hp).toMatch(/isMobile\(\) \? \(n > 1 \? "☠ ALL OF THEM" : "☠ KRELTALITY"\)/);
    expect(hp).toMatch(/phoneHooks\(\)\?\.finisher\?\.\(/);
  });
  it("every narrated fight tip still exists as written in the game and is reworded on a phone only by its control words", () => {
    const lines: [string, RegExp][] = [
      ["src/data/dungeons.ts", /"(SIDE-ON CONTROLS: [^"]+)"/],
      ["src/data/dungeons.ts", /"(CONTROLS: WASD move[^"]+)"/],
      ["src/content/bosses.ts", /"(TIP: Alistair only goes down to a headbutt\.[^"]+)"/],
      ["src/content/bosses.ts", /"(TIP: She rolls along the floor\.[^"]+)"/],
      ["src/content/bosses.ts", /"(TIP: Free the hostages[^"]+)"/],
      ["src/content/citadel.ts", /"(RUN AND GUN: [^"]+)"/],
      ["src/content/citadel.ts", /"(CLIMB: [^"]+)"/],
      ["src/game/scenes/ClubScene.ts", /"(He picks up a Les Paul[^"]+)"/],
      ["src/game/systems/squeeze.ts", /"(In a dungeon: press T[^"]+)"/],
      ["src/game/systems/squeeze.ts", /"(⚡ GOLDEN JUICE: ready\.[^"]+)"/],
    ];
    const all = [...NARRATOR_TIPS, ...COMBAT_NARRATOR_TIPS];
    for (const [f, re] of lines) {
      const m = src(f).match(re);
      expect(m, `${f} ${re}`).toBeTruthy();
      const out = narratorTip(m![1], all);
      expect(out, m![1]).not.toBe(m![1]);
      expect(out, out).not.toMatch(/\b(WASD|A \/ D|W \/ SPACE|press [EFT]\b|Press T\b|\(F\)|\(W \/ up\)|mouse)/);
    }
  });
});

describe("phone mash: every finger counts (F10)", () => {
  it("two thumbs in one frame are two presses, handed over one a frame", () => {
    const q = new MashQueue();
    const edges = new Set<string>();
    let got = 0;
    const gameFrame = () => {
      if (edges.delete("burst")) got++;
    };
    // two fingers land together
    q.press(2);
    if (q.next(edges.has("burst"))) edges.add("burst");
    gameFrame();
    // the next frame hands over the second
    if (q.next(edges.has("burst"))) edges.add("burst");
    gameFrame();
    if (q.next(edges.has("burst"))) edges.add("burst");
    gameFrame();
    expect(got).toBe(2);
    expect(q.delivered).toBe(2);
    // a flood is capped (nothing trails on long after the drumming stops), and clear() drops what's left
    q.press(20);
    expect(q.pending).toBe(4);
    q.clear();
    expect(q.next(false)).toBe(false);
  });
});

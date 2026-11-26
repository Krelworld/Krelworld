// The fight cluster (s4b): the user, on an iPhone in the Wildern Cafeteria: "Do you think it's good that the buttons can
// start creeping to the centre of the screen?" Every fight button now stays within FIGHT_REACH (200 px at scale 1) of
// the safe edge on the thumb's side, nothing overlaps, pause and the weapon chip keep their places, and each button
// keeps its home while others come and go.
import { describe, expect, it } from "vitest";
import {
  circleHits,
  controlScale,
  FIGHT_HOMES,
  FIGHT_REACH,
  GAP_REACH,
  fightCluster,
  fightGrid,
  fightReach,
  hudKeepOut,
  layoutSlots,
  MIN_CONTROL,
  POCKET_HOMES,
  POCKET_MIN,
  POCKET_ROLES,
  safeRect,
  weaponChip,
  type FightRole,
  type Placed,
  type Rect,
  type Viewport,
} from "../src/game/mobile/layout";
import type { ButtonSize } from "../src/game/mobile/settings";

const SCREENS: [string, Viewport][] = [
  ["iPhone 844x390 (47/47/21)", { w: 844, h: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 } }],
  ["Android 740x360", { w: 740, h: 360, insets: { top: 0, right: 0, bottom: 0, left: 0 } }],
  ["Android 740x360, 24 px cutout", { w: 740, h: 360, insets: { top: 0, right: 24, bottom: 0, left: 0 } }],
  ["Safari with its bars 750x340", { w: 750, h: 340, insets: { top: 0, right: 0, bottom: 0, left: 0 } }],
  ["big iPhone 932x430 (59/59/21)", { w: 932, h: 430, insets: { top: 0, right: 59, bottom: 21, left: 59 } }],
];
const IPHONE = SCREENS[0][1];
const SIZES: ButtonSize[] = ["S", "M", "L"];
const ROLES: FightRole[] = ["second", "dodge", "special", "ready", "heal", "action", "fart", "bongo", "sanmik"];
/** Everything that can be up at once: a fizzy bongo only shows while HEAL doesn't (one drink button at a time). */
const WITH_HEAL = ROLES.filter((r) => r !== "bongo");
const WITH_BONGO = ROLES.filter((r) => r !== "heal");

/** What the cluster must leave alone, as combat.ts gives it (right-handed): pause's and the weapon chip's touch areas. */
function keepOut(vp: Viewport, size: ButtonSize, fsOffer = false): Rect[] {
  const s = layoutSlots(vp, { leftHanded: false, buttonSize: size });
  const out = [s.pause.hit, weaponChip(vp, { buttonSize: size }, s.pause).hit];
  if (fsOffer) out.push(s.fullscreenFight.hit);
  return out;
}
/** Left-handed: the HUD's top-left block, over the canvas as Phaser's FIT centres it. */
function hudOf(vp: Viewport): Rect[] {
  const k = Math.min(vp.w / 960, vp.h / 540);
  return hudKeepOut({ x: (vp.w - 960 * k) / 2, y: (vp.h - 540 * k) / 2, w: 960 * k, h: 540 * k });
}
/** From the safe edge on the thumb's side to the centre. */
const inFrom = (vp: Viewport, p: Placed, left: boolean) => {
  const safe = safeRect(vp);
  return left ? p.cx - safe.x : safe.x + safe.w - p.cx;
};

describe("the fight cluster hugs the thumb's edge (s4b)", () => {
  for (const [name, vp] of SCREENS)
    for (const size of SIZES)
      for (const left of [false, true])
        for (const [what, roles] of [
          ["HEAL", WITH_HEAL],
          ["BONGO", WITH_BONGO],
          ["even HEAL and BONGO together", ROLES],
        ] as const)
        it(`${name}, size ${size}${left ? ", left-handed" : ""}: everything up (${what}), every button within reach, 12 px apart, pause and the chip clear`, () => {
          const st = { leftHanded: left, buttonSize: size };
          const ko = left ? hudOf(vp) : keepOut(vp, size);
          const c = fightCluster(vp, st, roles, ko);
          const reach = fightReach(vp, st);
          const safe = safeRect(vp);
          const placed = (["prime", ...roles] as FightRole[]).map((r) => [r, c[r]] as const);
          for (const [r, p] of placed) {
            expect(p, r).toBeTruthy();
            if (!p) continue;
            expect(inFrom(vp, p, left), `${r} within ${reach}`).toBeLessThanOrEqual(reach + 1e-6);
            // inside the safe area, above the home-indicator strip
            expect(p.cx - p.size / 2).toBeGreaterThanOrEqual(safe.x - 1e-6);
            expect(p.cx + p.size / 2).toBeLessThanOrEqual(safe.x + safe.w + 1e-6);
            expect(p.cy - p.size / 2).toBeGreaterThanOrEqual(safe.y - 1e-6);
            expect(p.cy + p.size / 2).toBeLessThanOrEqual(safe.y + safe.h + 1e-6);
            // a comfortable size: the pocket never under 44 px, the rest never under 52
            expect(p.size).toBeGreaterThanOrEqual((POCKET_ROLES as readonly string[]).includes(r) ? POCKET_MIN : MIN_CONTROL);
            // nothing drawn on pause, the weapon chip (their touch areas) or the HUD
            for (const k of ko) expect(circleHits(p.cx, p.cy, p.size / 2, k), `${r} on a keep-out`).toBe(false);
          }
          for (let i = 0; i < placed.length; i++)
            for (let j = i + 1; j < placed.length; j++) {
              const [ra, a] = placed[i];
              const [rb, b] = placed[j];
              if (!a || !b) continue;
              // (research M5: 12 px between drawings; only a pocket button squeezed into a gap as the last resort, with
              // more buttons up than cells, may sit closer, never on another)
              const squeezed = a.size === POCKET_MIN || b.size === POCKET_MIN;
              expect(Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.size / 2 - b.size / 2, `${ra} / ${rb}`).toBeGreaterThanOrEqual((squeezed ? 4 : 12) - 1e-6);
            }
        });

  it("at scale 1 (844x390, size M) no fight button's centre is more than 200 px from the safe right edge", () => {
    expect(controlScale(390, "M")).toBe(1);
    expect(fightReach(IPHONE, { buttonSize: "M" })).toBe(FIGHT_REACH);
    expect(FIGHT_REACH).toBe(200);
    const c = fightCluster(IPHONE, { leftHanded: false, buttonSize: "M" }, ROLES, keepOut(IPHONE, "M"));
    for (const r of ROLES) expect(797 - c[r]!.cx, r).toBeLessThanOrEqual(200);
    // ...and every one of them full size (60 px), even HEAL and BONGO together
    for (const r of ROLES) expect(c[r]!.size, r).toBe(60);
  });

  it("at size M every phone size here has a full-size cell for everything that can be up at once, both hands", () => {
    for (const [name, vp] of SCREENS)
      for (const left of [false, true])
        for (const roles of [WITH_HEAL, WITH_BONGO]) {
          const c = fightCluster(vp, { leftHanded: left, buttonSize: "M" }, roles, left ? hudOf(vp) : keepOut(vp, "M"));
          for (const r of roles) expect(c[r]!.size, `${name} ${left ? "left" : "right"} ${r}`).toBeGreaterThanOrEqual(MIN_CONTROL);
        }
  });

  it("pause and the weapon chip keep their top-right places (the slots are untouched)", () => {
    const s = layoutSlots(IPHONE, { leftHanded: false, buttonSize: "M" });
    expect([s.pause.cx, s.pause.cy, s.pause.size]).toEqual([771, 32, 52]);
    const chip = weaponChip(IPHONE, { buttonSize: "M" }, s.pause);
    expect([chip.cx, chip.cy, chip.w, chip.h]).toEqual([651, 28, 140, 44]);
    // left-handed, they stay top right too
    expect(layoutSlots(IPHONE, { leftHanded: true, buttonSize: "M" }).pause.cx).toBe(771);
  });

  it("the shared touch area of the top row stops under pause and the chip (their own touch areas stay theirs)", () => {
    const ko = keepOut(IPHONE, "M");
    let clipped = 0;
    for (const [name, vp] of SCREENS)
      for (const size of SIZES) {
        const ko = keepOut(vp, size);
        const c = fightCluster(vp, { leftHanded: false, buttonSize: size }, ROLES, ko);
        for (const p of Object.values(c)) {
          if (!p) continue;
          // the shared touch area reaches GAP_REACH past the drawing, but never up into pause's or the chip's
          const top = Math.max(p.cy - p.size / 2 - GAP_REACH, p.clipTop ?? -Infinity);
          if (p.clipTop !== undefined) clipped++;
          for (const k of ko) if (k.x < p.cx + p.size / 2 + GAP_REACH && p.cx - p.size / 2 - GAP_REACH < k.x + k.w && k.y + k.h <= p.cy - p.size / 2) expect(top, `${name} ${size}`).toBeGreaterThanOrEqual(k.y + k.h - 1e-6);
        }
      }
    expect(clipped).toBeGreaterThan(0);
  });

  it("layout: FIRE in the corner, SWAP left of it, SPECIAL / READY up the edge, DODGE / HEAL beside them, ACTION next in", () => {
    const c = fightCluster(IPHONE, { leftHanded: false, buttonSize: "M" }, ROLES, keepOut(IPHONE, "M"));
    expect([c.prime!.cx, c.prime!.cy, c.prime!.size]).toEqual([745, 317, 84]);
    expect(c.second!.cy).toBeGreaterThan(c.dodge!.cy);
    expect(c.second!.cx).toBeLessThan(c.prime!.cx);
    expect(c.special!.cx).toBeCloseTo(c.ready!.cx);
    expect(c.ready!.cy).toBeLessThan(c.special!.cy);
    expect(c.dodge!.cx).toBeLessThan(c.special!.cx);
    expect(c.heal!.cx).toBeCloseTo(c.dodge!.cx);
    expect(c.heal!.cy).toBeLessThan(c.dodge!.cy);
    expect(c.action!.cx).toBeLessThan(c.dodge!.cx);
    // three columns, 12 px apart
    expect(c.special!.cx - c.dodge!.cx).toBeCloseTo(72);
    expect(c.dodge!.cx - c.action!.cx).toBeCloseTo(72);
    expect(Object.keys(FIGHT_HOMES).sort()).toEqual(["action", "dodge", "heal", "ready", "second", "special"]);
  });

  it("the pocket takes the free cells nearest the edge in its order: FART, then SANMIK; BONGO goes where HEAL goes", () => {
    const vp = IPHONE;
    const ko = keepOut(vp, "M");
    const g = fightGrid(vp, { buttonSize: "M" }, ko);
    const homes = new Set(Object.values(FIGHT_HOMES));
    const spare = g.cells.filter((c) => !homes.has(c.id)).sort((a, b) => a.in - b.in || b.cy - a.cy);
    const c = fightCluster(vp, { leftHanded: false, buttonSize: "M" }, ROLES, ko);
    POCKET_HOMES.forEach((r, i) => expect([c[r]!.cx, c[r]!.cy], r).toEqual([spare[i].cx, spare[i].cy]));
    const b = fightCluster(vp, { leftHanded: false, buttonSize: "M" }, WITH_BONGO, ko);
    expect([b.bongo!.cx, b.bongo!.cy]).toEqual([c.heal!.cx, c.heal!.cy]);
    // (the pocket used to sit 206 and 286 px in)
    for (const r of POCKET_ROLES) expect(797 - b[r]!.cx, r).toBeLessThanOrEqual(188 + 1e-6);
  });

  for (const [name, vp] of SCREENS)
    for (const left of [false, true])
      it(`${name}${left ? ", left-handed" : ""}, size M: a button keeps its place whatever else comes or goes (fixed homes)`, () => {
        const st = { leftHanded: left, buttonSize: "M" as const };
        const ko = left ? hudOf(vp) : keepOut(vp, "M");
        const allH = fightCluster(vp, st, WITH_HEAL, ko);
        const allB = fightCluster(vp, st, WITH_BONGO, ko);
        for (let mask = 0; mask < 1 << ROLES.length; mask++) {
          const up = ROLES.filter((_, i) => mask & (1 << i));
          if (up.includes("heal") && up.includes("bongo")) continue;
          const all = up.includes("bongo") ? allB : allH;
          const c = fightCluster(vp, st, up, ko);
          for (const r of up) expect([c[r]!.cx, c[r]!.cy, c[r]!.size], `${r} with ${up.join(",")}`).toEqual([all[r]!.cx, all[r]!.cy, all[r]!.size]);
        }
      });

  it("more buttons than cells (size L on a short screen): the pocket is drawn smaller, never further in", () => {
    const vp = SCREENS[3][1];
    const st = { leftHanded: false, buttonSize: "L" as const };
    const ko = keepOut(vp, "L");
    const g = fightGrid(vp, st, ko);
    expect(g.cells.length).toBeLessThan(WITH_HEAL.length);
    const c = fightCluster(vp, st, WITH_HEAL, ko);
    const reach = fightReach(vp, st);
    for (const r of ["fart", "sanmik"] as const) {
      expect(c[r]!.size, r).toBe(POCKET_MIN);
      expect(750 - c[r]!.cx, r).toBeLessThanOrEqual(reach);
    }
    // the fixed buttons keep their full size
    for (const r of ["second", "dodge", "special", "ready", "heal", "action"] as const) expect(c[r]!.size, r).toBe(g.cells[0].size);
  });

  it("Android's fullscreen offer under pause: the edge column's top cell steps aside, nothing lands on the offer", () => {
    const vp = SCREENS[1][1];
    const ko = keepOut(vp, "M", true);
    const c = fightCluster(vp, { leftHanded: false, buttonSize: "M" }, WITH_HEAL, ko);
    for (const r of WITH_HEAL) for (const k of ko) expect(circleHits(c[r]!.cx, c[r]!.cy, c[r]!.size / 2, k), r).toBe(false);
    for (const r of WITH_HEAL) expect(c[r]!.size, r).toBeGreaterThanOrEqual(MIN_CONTROL);
  });
});

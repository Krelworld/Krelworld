// HOLD firing's aim (the phone default, the user's choice): only an enemy within CONE_DEG of the way you face, whose
// body is on screen, with no wall or pillar in between. EASY (no `facing`, no `visible`) keeps the old all-round aim.
import { describe, expect, it } from "vitest";
import { AIM_TUNE, CONE_DEG, CONE_KEEP_DEG, inCone, inView, lineOfSight, pickTarget, segHitsRect, snapAim, type AimTarget } from "../src/game/mobile/aim";

const ME = { x: 400, y: 400 };
const STILL = { x: 0, y: 0 };
const N = AIM_TUNE.normal;
const E = (id: number, x: number, y: number, r = 12): AimTarget => ({ id, x, y, r, kind: "enemy" });
const at = (deg: number, d = 200, id = 1) => E(id, ME.x + Math.cos((deg * Math.PI) / 180) * d, ME.y + Math.sin((deg * Math.PI) / 180) * d);
const RIGHT = 0;
const VIEW = { x: 0, y: 0, w: 960, h: 540 };

describe("the cone (about 35 degrees either side of where you face)", () => {
  it("is the user's 35 degrees, with a little hold-on beyond it", () => {
    expect(CONE_DEG).toBe(35);
    expect(CONE_KEEP_DEG).toBeGreaterThan(CONE_DEG);
    expect(CONE_KEEP_DEG).toBeLessThanOrEqual(50);
  });

  it("inCone: in front yes, to the side or behind no", () => {
    expect(inCone(ME, at(0), RIGHT, CONE_DEG)).toBe(true);
    expect(inCone(ME, at(34), RIGHT, CONE_DEG)).toBe(true);
    expect(inCone(ME, at(-34), RIGHT, CONE_DEG)).toBe(true);
    expect(inCone(ME, at(40), RIGHT, CONE_DEG)).toBe(false);
    expect(inCone(ME, at(90), RIGHT, CONE_DEG)).toBe(false);
    expect(inCone(ME, at(180), RIGHT, CONE_DEG)).toBe(false);
    // facing left: wraps round the angle
    expect(inCone(ME, at(170), Math.PI, CONE_DEG)).toBe(true);
    expect(inCone(ME, at(-170), Math.PI, CONE_DEG)).toBe(true);
    // something right on top of you always counts
    expect(inCone(ME, { x: ME.x + 0.5, y: ME.y }, Math.PI, CONE_DEG)).toBe(true);
  });

  it("HOLD picks the enemy in front, never the nearer one behind or beside you", () => {
    const behind = at(180, 90, 1);
    const beside = at(80, 100, 2);
    const ahead = at(20, 300, 3);
    const t = pickTarget({ me: ME, stick: STILL, enemies: [behind, beside, ahead], prev: null, tune: N, facing: RIGHT });
    expect(t?.id).toBe(3);
    // EASY (no facing): the nearest, all round you, as before
    expect(pickTarget({ me: ME, stick: STILL, enemies: [behind, beside, ahead], prev: null, tune: N })?.id).toBe(1);
  });

  it("nothing in front: no target (FIRE then shoots straight ahead)", () => {
    expect(pickTarget({ me: ME, stick: STILL, enemies: [at(120), at(-90, 150, 2)], prev: null, tune: N, facing: RIGHT })).toBeNull();
  });

  it("you aim by turning: the same enemies, another facing, another target", () => {
    const a = at(0, 250, 1);
    const b = at(90, 250, 2);
    expect(pickTarget({ me: ME, stick: STILL, enemies: [a, b], prev: null, tune: N, facing: 0 })?.id).toBe(1);
    expect(pickTarget({ me: ME, stick: STILL, enemies: [a, b], prev: null, tune: N, facing: Math.PI / 2 })?.id).toBe(2);
  });

  it("the one you are on stays until it is CONE_KEEP_DEG round, then it goes", () => {
    const t = at(40, 200, 7);
    expect(pickTarget({ me: ME, stick: STILL, enemies: [t], prev: null, tune: N, facing: RIGHT })).toBeNull();
    expect(pickTarget({ me: ME, stick: STILL, enemies: [t], prev: 7, tune: N, facing: RIGHT })?.id).toBe(7);
    expect(pickTarget({ me: ME, stick: STILL, enemies: [at(50, 200, 7)], prev: 7, tune: N, facing: RIGHT })).toBeNull();
  });

  it("barrels and crates obey the cone too (one behind you never takes the aim)", () => {
    const crate: AimTarget = { id: "b0", x: ME.x - 80, y: ME.y, r: 14, kind: "object" };
    expect(pickTarget({ me: ME, stick: STILL, enemies: [], objects: [crate], prev: null, tune: N, facing: RIGHT })).toBeNull();
    expect(pickTarget({ me: ME, stick: STILL, enemies: [], objects: [crate], prev: null, tune: N, facing: Math.PI })?.id).toBe("b0");
  });
});

describe("no lock off screen", () => {
  it("inView: its body (half its radius) must be in view", () => {
    expect(inView(E(1, 500, 300), VIEW)).toBe(true);
    expect(inView(E(1, -5, 300, 12), VIEW)).toBe(true);
    expect(inView(E(1, -7, 300, 12), VIEW)).toBe(false);
    expect(inView(E(1, 980, 300, 12), VIEW)).toBe(false);
    // a big boss half on screen counts
    expect(inView(E(1, 990, 300, 70), VIEW)).toBe(true);
  });

  it("HOLD with `visible`: an enemy off screen is never picked, even right in front", () => {
    const off = E(1, 1000, 400);
    const vis = (t: AimTarget) => inView(t, VIEW);
    expect(pickTarget({ me: { x: 900, y: 400 }, stick: STILL, enemies: [off], prev: null, tune: N, facing: RIGHT, visible: vis })).toBeNull();
    // EASY, old rule: its centre within 16 px of the screen
    expect(pickTarget({ me: { x: 900, y: 400 }, stick: STILL, enemies: [E(1, 970, 400)], prev: null, tune: N, view: VIEW })?.id).toBe(1);
  });
});

describe("no lock through walls", () => {
  const pillar = { x: 480, y: 360, w: 40, h: 80 };

  it("segHitsRect: through the middle yes, past it no, a graze on the corner no", () => {
    expect(segHitsRect(ME, { x: 600, y: 400 }, pillar)).toBe(true);
    expect(segHitsRect(ME, { x: 600, y: 300 }, pillar)).toBe(false);
    expect(segHitsRect(ME, { x: 460, y: 400 }, pillar)).toBe(false);
    expect(segHitsRect({ x: 400, y: 358 }, { x: 600, y: 358 }, pillar)).toBe(false);
  });

  it("lineOfSight: a pillar between hides it; one you stand against or it stands in doesn't hide everything", () => {
    expect(lineOfSight(ME, { x: 600, y: 400 }, [pillar])).toBe(false);
    expect(lineOfSight(ME, { x: 600, y: 300 }, [pillar])).toBe(true);
    expect(lineOfSight({ x: 490, y: 400 }, { x: 600, y: 400 }, [pillar])).toBe(true);
    expect(lineOfSight(ME, { x: 500, y: 400 }, [pillar])).toBe(true);
  });

  it("lineOfSight: outside the room (behind its walls) is hidden", () => {
    const room = { x: 24, y: 24, w: 912, h: 492 };
    expect(lineOfSight(ME, { x: 940, y: 300 }, [], room)).toBe(false);
    expect(lineOfSight(ME, { x: 900, y: 300 }, [], room)).toBe(true);
  });

  it("HOLD skips the enemy behind the pillar for the one in the open", () => {
    const hid = E(1, 600, 400);
    const open = E(2, 620, 280);
    const vis = (t: AimTarget) => lineOfSight(ME, t, [pillar]);
    expect(pickTarget({ me: ME, stick: STILL, enemies: [hid, open], prev: null, tune: N, facing: RIGHT, visible: vis })?.id).toBe(2);
    // and a slide never snaps onto it either
    expect(snapAim(ME, 0, [hid], N, 520, VIEW, vis).snapped).toBeNull();
    expect(snapAim(ME, 0, [hid], N, 520, VIEW).snapped?.id).toBe(1);
  });
});

describe("FIRE held: the lock stays while you strafe", () => {
  it("keeps the one it is on wherever it goes round you, while you hold FIRE; a new one only in front", () => {
    const side = at(100, 200, 7);
    // not held: out of the cone, it goes
    expect(pickTarget({ me: ME, stick: STILL, enemies: [side], prev: 7, tune: N, facing: RIGHT })).toBeNull();
    // held: it stays
    expect(pickTarget({ me: ME, stick: STILL, enemies: [side], prev: 7, tune: N, facing: RIGHT, lockPrev: true })?.id).toBe(7);
    // held, but nothing was locked: still only in front
    expect(pickTarget({ me: ME, stick: STILL, enemies: [side], prev: null, tune: N, facing: RIGHT, lockPrev: true })).toBeNull();
    // held, but it went behind a wall: it goes
    const hide = () => false;
    expect(pickTarget({ me: ME, stick: STILL, enemies: [side], prev: 7, tune: N, facing: RIGHT, lockPrev: true, visible: hide })).toBeNull();
  });
});

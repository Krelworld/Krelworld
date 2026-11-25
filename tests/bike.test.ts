import { describe, expect, it } from "vitest";
import { BIKE_SCENES, BIKE_SPEED, bikeTip, bikeVelocity, canRide, rideSpeed, reportBike, bikeAvailable, BIKE } from "../src/game/systems/bike";
import { ACTIONS } from "../src/game/systems/keybinds";
import { PAD_BIKE, PAD_BIKE_CLASH, PAD_DEFAULTS, PAD_FIXED } from "../src/game/systems/padbinds";
import { touchWording } from "../src/game/mobile/wording";
import { bikeButtonWanted, bikeFace } from "../src/game/mobile/bikeLogic";

/** Ride for `ms` at a fixed frame time, holding the stick at (sx, sy); returns the velocity. */
function ride(v: { x: number; y: number }, sx: number, sy: number, ms: number, top = rideSpeed(210)) {
  for (let t = 0; t < ms; t += 16) v = bikeVelocity(v.x, v.y, sx * top, sy * top, 16);
  return v;
}

describe("the bike: speed", () => {
  it("is 1.8x walking pace in town and on the Strip", () => {
    expect(BIKE_SPEED).toBe(1.8);
    expect(rideSpeed(210)).toBeCloseTo(378);
    expect(rideSpeed(230)).toBeCloseTo(414);
  });
  it("picks up over a moment (not instantly, not sluggish)", () => {
    const a = ride({ x: 0, y: 0 }, 1, 0, 100);
    const b = ride({ x: 0, y: 0 }, 1, 0, 800);
    expect(a.x).toBeGreaterThan(80);
    expect(a.x).toBeLessThan(250);
    expect(b.x).toBeGreaterThan(0.95 * 378);
    expect(b.x).toBeLessThanOrEqual(378);
  });
  it("coasts to a stop when you let go, and brakes harder when you turn round", () => {
    const full = { x: 378, y: 0 };
    const coast = ride(full, 0, 0, 200);
    const brake = ride(full, -1, 0, 200);
    expect(coast.x).toBeGreaterThan(0);
    expect(brake.x).toBeLessThan(coast.x);
    expect(ride(full, 0, 0, 2000)).toEqual({ x: 0, y: 0 });
  });
  it("steers diagonally at the same top speed", () => {
    const d = ride({ x: 0, y: 0 }, Math.SQRT1_2, Math.SQRT1_2, 2000);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(378, 0);
  });
});

describe("the bike: on and off", () => {
  it("only in the outdoor overworlds", () => {
    expect([...BIKE_SCENES]).toEqual(["Hub", "Kreddle"]);
    for (const scene of ["Home", "Club", "Venue", "Dungeon", "Pub", "Minigame", "Cutscene", "Finale", "PolsonHome"]) expect(canRide({ scene, busy: false })).toBe(false);
    expect(canRide({ scene: "Hub", busy: false })).toBe(true);
    expect(canRide({ scene: "Kreddle", busy: false })).toBe(true);
  });
  it("anything that needs you on foot gets you off (talking, doors, shops, cutscenes, fights, hidden)", () => {
    expect(canRide({ scene: "Hub", busy: true })).toBe(false);
    expect(canRide({ scene: "Hub", busy: false, cutscene: true })).toBe(false);
    expect(canRide({ scene: "Hub", busy: false, fight: true })).toBe(false);
    expect(canRide({ scene: "Hub", busy: false, hidden: true })).toBe(false);
  });
  it("tells the phone button when there's a bike, and goes stale when the scene stops", () => {
    reportBike("Hub", true, false);
    expect(bikeAvailable(BIKE.seen + 10)).toBe(true);
    expect(bikeAvailable(BIKE.seen + 1000)).toBe(false);
    reportBike("Hub", false, false);
    expect(bikeAvailable(BIKE.seen)).toBe(false);
  });
});

describe("the bike: controls", () => {
  it("has its own free key (Z), rebindable, clashing with nothing", () => {
    const bike = ACTIONS.find((a) => a.id === "bike")!;
    expect(bike.defaults).toEqual(["Z"]);
    const others = ACTIONS.filter((a) => a.id !== "bike").flatMap((a) => a.defaults);
    expect(others).not.toContain("Z");
  });
  it("is the left stick's click on a gamepad, kept off it when L3 does something in town", () => {
    expect(PAD_FIXED.bike).toMatch(/L3/);
    expect(PAD_BIKE).toBe(10);
    // L3's other default job (the golden transformation) only works in a fight
    const inTown = PAD_BIKE_CLASH.flatMap((a) => PAD_DEFAULTS[a] ?? []);
    expect(inTown).not.toContain(PAD_BIKE);
  });
  it("the first-time tip names the key on a laptop and the button on a phone", () => {
    const t = bikeTip("Z");
    expect(t.text).toBe("Press Z to hop on your bike, anywhere in town. Z again to get off.");
    expect(touchWording(t.text)).toBe("Tap RIDE (the bike button) to hop on your bike, anywhere in town. Tap WALK to get off.");
    expect(touchWording(bikeTip("↑").text)).not.toMatch(/↑/);
  });
  it("the phone button: up only in the walking controls with a bike about; says what a tap does", () => {
    expect(bikeButtonWanted("walk", false, true)).toBe(true);
    expect(bikeButtonWanted("walk", false, false)).toBe(false);
    expect(bikeButtonWanted("combat", false, true)).toBe(false);
    expect(bikeButtonWanted("walk", true, true)).toBe(false);
    expect(bikeFace(false)).toContain("RIDE");
    expect(bikeFace(true)).toContain("WALK");
  });
});

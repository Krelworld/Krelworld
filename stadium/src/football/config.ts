// Pitch geometry and tuning numbers. Metres and seconds. Pitch centre is (0, 0).
export const PITCH = {
  L: 72, W: 46,
  goalW: 6.4, goalH: 2.2,
  boxL: 11.5, boxW: 27.6,
  sixL: 3.8, sixW: 12.6,
  penSpot: 7.6,
  circleR: 6.2,
};
export const HL = PITCH.L / 2;
export const HW = PITCH.W / 2;

/** Formation slots in a team's own frame: x -1 (own goal) .. 1 (their goal), y -1 .. 1. */
export const FORMATIONS: Record<string, { role: "GK" | "DEF" | "MID" | "FWD"; x: number; y: number }[]> = {
  "4-4-2": [
    { role: "GK", x: -0.97, y: 0 },
    { role: "DEF", x: -0.58, y: -0.72 }, { role: "DEF", x: -0.64, y: -0.25 },
    { role: "DEF", x: -0.64, y: 0.25 }, { role: "DEF", x: -0.58, y: 0.72 },
    { role: "MID", x: -0.12, y: -0.78 }, { role: "MID", x: -0.2, y: -0.26 },
    { role: "MID", x: -0.2, y: 0.26 }, { role: "MID", x: -0.12, y: 0.78 },
    { role: "FWD", x: 0.34, y: -0.2 }, { role: "FWD", x: 0.34, y: 0.2 },
  ],
  "4-3-3": [
    { role: "GK", x: -0.97, y: 0 },
    { role: "DEF", x: -0.58, y: -0.72 }, { role: "DEF", x: -0.64, y: -0.25 },
    { role: "DEF", x: -0.64, y: 0.25 }, { role: "DEF", x: -0.58, y: 0.72 },
    { role: "MID", x: -0.18, y: -0.42 }, { role: "MID", x: -0.26, y: 0 }, { role: "MID", x: -0.18, y: 0.42 },
    { role: "FWD", x: 0.3, y: -0.68 }, { role: "FWD", x: 0.38, y: 0 }, { role: "FWD", x: 0.3, y: 0.68 },
  ],
};

export const TUNE = {
  // movement
  speedBase: 4.9, speedPace: 2.3, jog: 0.72, accel: 16, carrySlow: 0.9,
  // ball
  gravity: 9.8, rollDecel: 3.4, airDrag: 0.12, bounce: 0.5,
  controlReach: 0.95, controlHeight: 1.5, headHeight: 2.35,
  // decisions
  thinkEvery: 9,
  // tackling
  tackleReach: 1.15, tackleCooldown: 54,
  // keeper
  keeperReach: 1.05, diveReach: 1.55, diveSpeed: 7.2,
};

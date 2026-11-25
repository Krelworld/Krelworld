// The bike: ride round the outdoor overworlds (Krelford and the Kreddle Strip) faster than walking.
// Pure rules and numbers here (unit-tested); the sprites live in gfx/Bike.ts.

/** Riding speed as a multiple of walking speed. */
export const BIKE_SPEED = 1.8;
/** Time constants (ms, time to close ~63% of the gap): pick-up, coasting to a stop, and braking (turning round). */
export const BIKE_ACCEL_MS = 220;
export const BIKE_COAST_MS = 260;
export const BIKE_BRAKE_MS = 110;
/** Under this speed (px/s) the rider stops pedalling (feet on the pedals, idle pose). */
export const BIKE_PEDAL_MIN = 40;
/** World px travelled per frame of the rider's pedalling cycle, and per spoke frame. */
export const BIKE_PEDAL_PX = 26;
export const BIKE_SPOKE_PX = 7;
/** The bike's wheels sit this many art pixels below the rider's feet (his feet are on the pedals). */
export const BIKE_DROP = 6;
/** A bike left standing somewhere is put back outside Home once you're this far from it. */
export const BIKE_RETURN_PX = 720;

/** The scenes you can ride in: the outdoor walking overworlds only. */
export const BIKE_SCENES: readonly string[] = ["Hub", "Kreddle"];

/** What a scene knows about this moment (anything that stops you riding). */
export interface RideContext {
  scene: string;
  /** A conversation, a door, a shop, a panel, a scripted moment. */
  busy: boolean;
  cutscene?: boolean;
  /** The town's shoving match, the Kreddle raid, a beat-up: anything fight-like out in the open. */
  fight?: boolean;
  /** The avatar is hidden (a flyover, a cut-away). */
  hidden?: boolean;
}

/** Can you be on the bike right now? Any "no" gets you off it. */
export function canRide(c: RideContext): boolean {
  return BIKE_SCENES.includes(c.scene) && !c.busy && !c.cutscene && !c.fight && !c.hidden;
}

/** Top speed on the bike for a scene's walking speed. */
export function rideSpeed(walk: number): number {
  return walk * BIKE_SPEED;
}

/**
 * Ease a velocity toward a target, bike-style: a little pick-up, a gentle coast when you let go, and quick brakes when
 * you turn round. Returns the new velocity (pure; `dt` in ms).
 */
export function bikeVelocity(vx: number, vy: number, tx: number, ty: number, dt: number): { x: number; y: number } {
  const stopping = Math.abs(tx) < 1 && Math.abs(ty) < 1;
  const reversing = vx * tx + vy * ty < 0;
  const tau = reversing ? BIKE_BRAKE_MS : stopping ? BIKE_COAST_MS : BIKE_ACCEL_MS;
  const k = 1 - Math.exp(-Math.max(0, dt) / tau);
  let x = vx + (tx - vx) * k;
  let y = vy + (ty - vy) * k;
  if (stopping && Math.hypot(x, y) < 10) x = y = 0;
  return { x, y };
}

/**
 * The bike's state as the phone controls (and the tablets' pad) see it, written every frame by the scene you ride in.
 * `seen` is when it was last written (performance.now()), so a scene that stopped running reads as "no bike".
 */
export const BIKE = { scene: "", usable: false, riding: false, seen: -1e9 };

export function reportBike(scene: string, usable: boolean, riding: boolean) {
  BIKE.scene = scene;
  BIKE.usable = usable;
  BIKE.riding = riding;
  BIKE.seen = typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Is there a bike to get on (or off) right now? (Stale for 250 ms = the scene stopped.) */
export function bikeAvailable(now = typeof performance !== "undefined" ? performance.now() : Date.now()): boolean {
  return BIKE.usable && now - BIKE.seen < 250;
}

/** The first-time tip (a system hint, not dialogue). `key` is the bike key's name on a keyboard. */
export function bikeTip(key: string): { title: string; text: string } {
  return { title: "YOUR BIKE", text: `Press ${key} to hop on your bike, anywhere in town. ${key} again to get off.` };
}

// One camera model shared by the match and the stadium.
// The world is flat ground (x, y) plus height z, in metres. A view turns it into
// screen pixels. "Tilted" squashes depth and lifts things by their height, which
// gives the raised TV angle; "flat" looks straight down.

export type ViewMode = "flat" | "tilted";

export class Projection {
  /** Pixels per metre along the ground. */
  S = 16;
  mode: ViewMode = "tilted";
  /** Turn the world a quarter (long side of the pitch runs up the screen). */
  rot = false;

  /** The tilted view's depth squash and height lift. The stadium uses 1 and 1: a square floor
   *  with upright faces, the one consistent three-quarter view of top-down pixel-art games. */
  tiltK = 0.62;
  tiltKZ = 0.82;
  /** How much depth is squashed. 1 = none. */
  get K() { return this.mode === "tilted" ? this.tiltK : 1; }
  /** How far up the screen one metre of height goes, in ground metres. */
  get KZ() { return this.mode === "tilted" ? this.tiltKZ : 0.45; }
  get standing() { return this.mode === "tilted"; }

  u(x: number, y: number) { return this.rot ? y : x; }
  v(x: number, y: number) { return this.rot ? -x : y; }
  sx(x: number, y: number) { return this.u(x, y) * this.S; }
  sy(x: number, y: number, z = 0) { return (this.v(x, y) * this.K - z * this.KZ) * this.S; }
  /** Depth for draw order: things further down the screen are in front. */
  depth(x: number, y: number) { return this.v(x, y); }

  /** Screen rectangle for a ground rectangle (projection keeps axis-aligned rectangles rectangular). */
  rect(x: number, y: number, w: number, h: number): [number, number, number, number] {
    const xs = [this.sx(x, y), this.sx(x + w, y + h)], ys = [this.sy(x, y), this.sy(x + w, y + h)];
    return [Math.min(...xs), Math.min(...ys), Math.abs(xs[1] - xs[0]), Math.abs(ys[1] - ys[0])];
  }

  /** Screen direction for a ground direction (for aiming and facing). */
  dir(dx: number, dy: number) {
    const sx = this.u(dx, dy), sy = this.v(dx, dy) * this.K;
    const l = Math.hypot(sx, sy) || 1;
    return { x: sx / l, y: sy / l };
  }
  /** Ground direction for a screen direction (for joystick input). */
  ground(sx: number, sy: number) {
    // Screen up on a tilted view means "away" along the ground, at full speed.
    const u = sx, v = sy;
    return this.rot ? { x: -v, y: u } : { x: u, y: v };
  }
}

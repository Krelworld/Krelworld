// PHONE MODE: how a jump feels in the side-scrolling rooms (research M6, "Jumping (detailed)"). Pure: no Phaser, no
// DOM, so the numbers are unit-tested and measured at 30, 60 and 120 Hz. The laptop never runs any of this: the
// Player's own side branch stays as it was (its jump arc is in the "side" fingerprint chain).
//
// What a phone player gets, on top of the game's own jump (gravity 1500, take-off 660, air jump 580, 2 jumps):
//   - JUMP acts on touch-down, and a press is remembered for BUFFER_MS: pressed just before landing, it jumps on landing.
//   - Coyote time COYOTE_MS (the game's is 110): walked off a ledge, the first jump still works for a moment.
//   - Variable height: let go early and the climb is cut (a tap is a hop, a hold is the full jump, same as today).
//   - The second press in the air is the double jump, as now.
//   - Drop-through needs a deliberate input: the stick pulled down and JUMP, or the stick held well down (never a drift).

/** Phone-only tuning (scene milliseconds and game px/s; gravity and take-off speeds are the game's, unchanged). */
export const JUMP_TUNE = Object.freeze({
  /** A press with no jump available is remembered this long and fires on landing. */
  bufferMs: 150,
  /** With phone assist off: a press is good for about one slow frame only (no real buffer). */
  noAssistBufferMs: 40,
  /** After leaving a ledge without jumping, the first jump still works this long. */
  coyoteMs: 140,
  /** The game's own (laptop) coyote time, for comparison and the "assist off" setting. */
  gameCoyoteMs: 110,
  /** The game's numbers (Player.ts), never changed. */
  gravity: 1500,
  firstVy: 660,
  airVy: 580,
  /** Variable height: the climb is cut at the later of the release and this long after take-off... */
  minRiseMs: 80,
  /** ...to this upward speed (first jump) / this (the air jump), when it is still climbing faster. */
  cutVy: 300,
  airCutVy: 260,
  /** Air control: the time constant of the speed easing in the air (the game uses 140; on the ground 70). */
  airEaseMs: 100,
  groundEaseMs: 70,
  gameAirEaseMs: 140,
  /** A moving platform's speed is kept this long after you step or jump off it. */
  carryMs: 100,
  /** Drop-through: the stick held down past this (and sideways under dropSide) for dropHoldMs drops... */
  dropDown: 0.7,
  dropSide: 0.35,
  dropHoldMs: 150,
  /** ...or the stick pulled down past this while JUMP is pressed (on a platform) drops instead of jumping. */
  dropChordDown: 0.5,
  /** Right after a take-off, while still rising, "on the ground" is the physics not having stepped yet (a 120 / 144 Hz
   *  screen runs frames between the 60 Hz physics steps): it never gives the jumps back. */
  liftoffMs: 100,
  /** A gap between two steps longer than this means the player was not moving (a dodge, a hit-stop): a press made in
   *  it counts from the first step after it, as a held key does on a laptop. */
  pauseGapMs: 100,
  /** How long the platforms let you through once a drop starts (the game's own window). */
  dropWindowMs: 220,
  /** One-way platforms accept a landing this far below their top (the game's is 14). */
  ledgeTol: 20,
  gameLedgeTol: 14,
  /** Ledge pop: feet this far below a top, beside it and moving toward it, are put on it. */
  popPx: 8,
  /** Platform tops count this much wider each side than drawn (for the pop). */
  popWiden: 4,
  /** Corner correction: a head clipping a corner by up to this share of the body's width is nudged past it. */
  cornerShare: 0.4,
});

export type JumpKind = "first" | "air";

export interface JumpStepIn {
  /** Scene time, ms. */
  now: number;
  grounded: boolean;
  /** The body's vertical speed (game px/s, negative = up). */
  vy: number;
  /** Is JUMP (the button, or a pad's jump) held right now? */
  held: boolean;
  /**
   * How far the feet are above the take-off point now (px), if known. With it the cut is frame-rate independent: a
   * slow frame that reads the release late still gives the same hop (the climb left is worked out from the height).
   */
  rise?: number;
  /** Phone assist (S9): off gives the game's own coyote time and no buffer, but keeps tap = hop (that's the control). */
  assist?: boolean;
}

export interface JumpStepOut {
  /** Set the vertical speed to this (a jump started this frame). */
  jumpVy?: number;
  kind?: JumpKind;
  /** Set the vertical speed to this (the climb was cut: JUMP let go early). */
  cutVy?: number;
}

/**
 * The jump's state for one player. Feed it presses / releases as they happen (DOM time does not matter: the press is
 * stamped with the scene clock the caller passes), and call step() once a frame before the body moves.
 */
export class JumpBrain {
  jumps = 2;
  coyoteUntil = 0;
  /** The press waiting to be used (scene ms), or null. */
  pressAt: number | null = null;
  heldNow = false;
  releasedAt = 0;
  takeoffAt = -1;
  takeoffKind: JumpKind | null = null;
  cutDone = true;
  /** Was the last press used to drop through a platform instead? (the caller decides; this just stops it jumping) */
  wasGrounded = false;
  /** The scene time of the last step (-1: none yet). */
  lastStepAt = -1;

  press(now: number) {
    this.pressAt = now;
    this.heldNow = true;
  }

  release(now: number) {
    if (!this.heldNow) return;
    this.heldNow = false;
    this.releasedAt = now;
  }

  /** Forget everything held or pending (a room change, a mode change, the page hidden): no stuck jump. */
  reset() {
    this.pressAt = null;
    this.lastStepAt = -1;
    this.heldNow = false;
    this.cutDone = true;
    this.takeoffKind = null;
  }

  /** The press is spent another way (it became a drop-through). */
  consume() {
    this.pressAt = null;
    this.cutDone = true;
  }

  step(i: JumpStepIn): JumpStepOut {
    const T = JUMP_TUNE;
    const assist = i.assist !== false;
    const out: JumpStepOut = {};
    // (still on the ground the frame after a take-off only because the 60 Hz physics hasn't stepped yet: F1)
    const justUp = this.takeoffKind !== null && i.vy < 0 && i.now - this.takeoffAt < T.liftoffMs;
    const grounded = i.grounded && !justUp;
    // a press made while the player wasn't moving at all (no step ran: a dodge, a long hit-stop) is fresh on the first
    // step after it, not stale (F2)
    if (this.pressAt !== null && this.lastStepAt >= 0 && i.now - this.lastStepAt > T.pauseGapMs && this.pressAt >= this.lastStepAt) this.pressAt = i.now;
    this.lastStepAt = i.now;
    if (grounded) {
      this.jumps = 2;
      this.coyoteUntil = i.now + (assist ? T.coyoteMs : T.gameCoyoteMs);
    }
    // a stale press never fires (the buffer is short on purpose: older presses would surprise you). With assist off
    // a press still lasts one slow frame (it is stamped with the scene time of the frame before it was read)
    const buffer = assist ? T.bufferMs : T.noAssistBufferMs;
    if (this.pressAt !== null && i.now - this.pressAt > buffer) this.pressAt = null;
    if (this.pressAt !== null) {
      // (coyote is judged at the moment of the press, not at the frame that reads it: F6)
      const coyote = this.pressAt < this.coyoteUntil;
      if (grounded || coyote) {
        out.jumpVy = -T.firstVy;
        out.kind = "first";
        this.jumps = 1;
      } else if (this.jumps > 0) {
        out.jumpVy = -T.airVy;
        out.kind = "air";
        this.jumps = 0;
      }
      if (out.kind) {
        this.coyoteUntil = 0;
        this.pressAt = null;
        this.takeoffAt = i.now;
        this.takeoffKind = out.kind;
        this.cutDone = false;
        // (a press that came and went inside one frame counts as let go at take-off)
        if (!i.held) this.heldNow = false;
        return out;
      }
    }
    // variable height: let go early and the climb is cut, at the earliest minRiseMs after take-off
    if (!this.cutDone && this.takeoffKind) {
      if (i.vy >= 0) this.cutDone = true;
      else if (!i.held && !this.heldNow && i.now - this.takeoffAt >= T.minRiseMs) {
        const cap = this.takeoffKind === "air" ? T.airCutVy : T.cutVy;
        const vy0 = this.takeoffKind === "air" ? T.airVy : T.firstVy;
        if (i.rise !== undefined) {
          // the height the hop should reach: climbing until the cut moment, then cap^2 / 2g more
          const tc = Math.max(T.minRiseMs, this.releasedAt - this.takeoffAt) / 1000;
          const target = jumpHeight(vy0, tc * 1000, cap);
          const left = target - i.rise;
          const v = left > 0 ? Math.sqrt(2 * T.gravity * left) : 0;
          if (-i.vy > v + 1) out.cutVy = -v;
        } else if (-i.vy > cap) out.cutVy = -cap;
        this.cutDone = true;
      }
    }
    this.wasGrounded = grounded;
    return out;
  }
}

/** The speed easing time constant: quicker in the air on a phone so a thumb can correct a landing. */
export function easeMs(grounded: boolean, assist = true): number {
  if (grounded) return JUMP_TUNE.groundEaseMs;
  return assist ? JUMP_TUNE.airEaseMs : JUMP_TUNE.gameAirEaseMs;
}

/** Tracks how long the stick has been held well down (for the deliberate drop). */
export class DropRule {
  private downSince = -1;

  /**
   * raw: the stick's raw direction (x right, y down; 1 = the rim), even when the stick only drives left / right.
   * Returns "drop" when the player clearly asked to go down through a platform.
   */
  step(now: number, raw: { x: number; y: number } | null, jumpPressed: boolean, onPlatform: boolean): "drop" | null {
    const T = JUMP_TUNE;
    const down = !!raw && raw.y > T.dropDown && Math.abs(raw.x) < T.dropSide;
    if (down) {
      if (this.downSince < 0) this.downSince = now;
    } else this.downSince = -1;
    if (!onPlatform) return null;
    // (mostly straight down: a thumb that has sunk low while running right is still running and jumping: F7)
    if (jumpPressed && !!raw && raw.y > T.dropChordDown && Math.abs(raw.x) < T.dropSide) return "drop";
    if (down && now - this.downSince >= T.dropHoldMs) {
      this.downSince = now + 10_000; // once per hold
      return "drop";
    }
    return null;
  }

  reset() {
    this.downSince = -1;
  }
}

/** The height a jump reaches (px) given the take-off speed and when the climb is cut (closed form, for tests/report). */
export function jumpHeight(vy0: number, cutAtMs: number | null, cutTo: number, g = JUMP_TUNE.gravity): number {
  if (cutAtMs === null) return (vy0 * vy0) / (2 * g);
  const t = cutAtMs / 1000;
  const v = vy0 - g * t;
  if (v <= cutTo) return (vy0 * vy0) / (2 * g);
  const h1 = vy0 * t - 0.5 * g * t * t;
  return h1 + (cutTo * cutTo) / (2 * g);
}

/** One-way platforms: land on them from above (the game's rule, with the phone's deeper tolerance). */
export function oneWayLands(vy: number, bottom: number, top: number, tol: number): boolean {
  return vy >= 0 && bottom <= top + tol;
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Ledge pop: feet just below a top (within popPx), beside it (within widen px, or touching) and moving toward it =
 * placed on top. Returns the y to move the body up by (px), or 0.
 */
export function ledgePop(body: Box, vy: number, dirX: number, block: Box, oneWay: boolean): number {
  const T = JUMP_TUNE;
  if (vy < -60) return 0; // still climbing hard: not a missed landing
  const below = body.bottom - block.top;
  if (below <= 0 || below > T.popPx) return 0;
  const gapL = block.left - body.right; // block to the right of the body
  const gapR = body.left - block.right; // block to the left
  const widen = T.popWiden;
  if (oneWay) {
    // a platform's top counts popWiden wider each side (inside, the collider's own tolerance does it)
    if (gapL > 0 && gapL <= widen) return below + 0.5;
    if (gapR > 0 && gapR <= widen) return below + 0.5;
    return 0;
  }
  // a solid block: beside it (touching, or within widen) and pushing toward it
  if (gapL >= -1 && gapL <= widen && dirX > 0) return below + 0.5;
  if (gapR >= -1 && gapR <= widen && dirX < 0) return below + 0.5;
  return 0;
}

/**
 * Corner correction: rising into a solid block's bottom corner by a little = nudged sideways past it.
 * Returns the x shift (px), or 0.
 */
export function cornerNudge(body: Box, vy: number, dtMs: number, block: Box): number {
  if (vy >= 0) return 0;
  const reach = (-vy * dtMs) / 1000 + 2;
  if (block.bottom > body.top + 1 || block.bottom < body.top - reach) return 0;
  const w = body.right - body.left;
  const max = w * JUMP_TUNE.cornerShare;
  const ovL = block.right - body.left; // the block's right edge over the body's left
  const ovR = body.right - block.left; // the body's right edge under the block's left
  if (ovL > 0 && ovL <= max && block.left < body.left) return ovL + 0.5;
  if (ovR > 0 && ovR <= max && block.right > body.right) return -(ovR + 0.5);
  return 0;
}

/** The game's camera follow lerp (DungeonScene's startFollow: 0.12 a frame, tuned at 60 Hz). */
export const CAM_LERP = 0.12;

/** The same follow, per frame at any frame rate: 0.12 at 60 Hz, more per frame at 30 Hz, less at 120 Hz (F4). */
export function camLerp(dtMs: number, base = CAM_LERP): number {
  return 1 - Math.pow(1 - base, Math.max(1, dtMs) / (1000 / 60));
}

/** How far (px) a camera following at camLerp(dt) trails something moving steadily at vx px/s: added to the
 *  look-ahead so the player sits at 35% / 65% while running, whatever the frame rate (F4). */
export function camLagPx(vx: number, dtMs: number): number {
  const l = camLerp(dtMs);
  return (vx * (Math.max(1, dtMs) / 1000) * (1 - l)) / l;
}

/** The camera's horizontal look-ahead (research: player at 35% / 65% of the width), eased over time. */
export class LookAhead {
  /** The current follow offset (game px; Phaser: negative puts the view's centre right of the player). */
  x = 0;
  private dir = 1;
  private wantDir = 1;
  private wantSince = 0;

  constructor(
    readonly share = 0.15,
    readonly switchMs = 400,
    readonly easeMs = 400,
  ) {}

  step(now: number, dt: number, moveX: number, width: number): number {
    const d = moveX > 0.2 ? 1 : moveX < -0.2 ? -1 : 0;
    if (d && d !== this.dir) {
      if (d !== this.wantDir) {
        this.wantDir = d;
        this.wantSince = now;
      } else if (now - this.wantSince >= this.switchMs) this.dir = d;
    } else if (d === this.dir) this.wantDir = d;
    const target = -this.dir * this.share * width;
    const k = Math.min(1, dt / (this.easeMs / 3));
    this.x += (target - this.x) * k;
    return this.x;
  }

  facing() {
    return this.dir;
  }

  snap(dir: number, width: number) {
    this.dir = this.wantDir = dir >= 0 ? 1 : -1;
    this.x = -this.dir * this.share * width;
  }
}

/** Phone assist, after a pit: put back at least this far from the pit's edge (the game uses the last safe spot, often
 *  50-70 px short of it, and a held stick walked you straight back in: P2). */
export const PIT_MARGIN = 120;
/** ...and the stick no longer walks you toward it until it comes back to the middle or you press JUMP (this long at
 *  most): you stand at a safe spot facing the gap, and jump it when ready. */
export const PIT_STICK_LOCK_MS = 3000;

/**
 * Where to put the player back after falling into a pit (phone assist): PIT_MARGIN short of the edge they fell from,
 * on solid ground, never nearer the pit than the game's own spot. Pure.
 */
export function pitSafeX(fellX: number, safeX: number, inGap: (x: number, pad?: number) => boolean, roomW: number, margin = PIT_MARGIN): number {
  const dir = fellX >= safeX ? 1 : -1;
  let edge = fellX;
  for (let x = safeX, n = 0; n < 200; n++, x += dir * 4) {
    if (inGap(x)) {
      edge = x;
      break;
    }
  }
  let t = Math.max(40, Math.min(roomW - 40, edge - dir * margin));
  for (let n = 0; n < 60 && inGap(t, 50); n++) t -= dir * 8;
  if (inGap(t, 50) || t < 40 || t > roomW - 40) return safeX;
  // (never nearer the pit than where the game would have put you)
  return dir * (t - safeX) > 0 ? safeX : t;
}

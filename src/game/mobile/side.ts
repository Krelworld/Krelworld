// PHONE MODE: the side-scrolling rooms' movement on a phone (stage 2 part 2, research M6 / "Jumping (detailed)").
//
// The Player's side branch asks phoneHooks().sideMove() first on a phone (one guarded line in Player.ts); this answers
// it with the game's own movement plus the phone's jump feel (jump.ts: touch-down jump, buffer, coyote, tap = hop,
// deliberate drop-through, quicker air control, ledge pop, corner correction, a moving platform's speed kept a moment).
// Gravity, take-off speeds and run speed are the game's. The laptop never gets here.
//
// It also drives the camera's look-ahead (player at 35% / 65% of the width) from outside, every frame, in side rooms.

import type Phaser from "phaser";
import { synth } from "../audio/Synth";
import { sanmikYee } from "../gfx/sanmikForm";
import { phoneSettings } from "./settings";
import { JumpBrain, DropRule, LookAhead, JUMP_TUNE, PIT_STICK_LOCK_MS, easeMs, ledgePop, cornerNudge, camLerp, camLagPx, pitSafeX, type Box } from "./jump";

type Body = Phaser.Physics.Arcade.Body;
type StaticBody = Phaser.Physics.Arcade.StaticBody;

interface SidePlayer {
  x: number;
  y: number;
  spr: Phaser.Physics.Arcade.Sprite;
  jumps: number;
  coyoteUntil: number;
  dropUntil: number;
  world: { sc: Phaser.Scene; burst(x: number, y: number, c: number, n: number): void };
}

interface SideScene extends Phaser.Scene {
  side?: boolean;
  busy?: boolean;
  player?: SidePlayer;
  platforms?: Phaser.Physics.Arcade.StaticGroup | null;
  obstacles?: Phaser.Physics.Arcade.StaticGroup;
  sideLevel?: { floor?: Phaser.Physics.Arcade.StaticGroup | null; movers?: { rect: Phaser.GameObjects.Rectangle }[] } | null;
  now(): number;
}

interface ControlsLike {
  jump(): boolean;
  down?(n: string): boolean;
}

const box = (b: Body | StaticBody): Box => ({ left: b.left, right: b.right, top: b.top, bottom: b.bottom });

/** Measurements of the last jumps (for the smoke test and the report). */
export interface JumpLog {
  at: number;
  kind: "first" | "air";
  y0: number;
  apex: number;
  /** ms from the press to take-off (0 when the press itself took off). */
  waited: number;
  /** ms since the player left the ground (coyote) when it took off from the air as a first jump. */
  sinceGround: number;
}

export class SideMove {
  readonly brain = new JumpBrain();
  readonly drop = new DropRule();
  readonly look = new LookAhead();
  /** JUMP held by a finger (the button). */
  touchHeld = false;
  /** A pad / key jump held (a controller on the phone): its jump is always the full one until it lands. */
  private extHeld = false;
  /** The stick's raw direction (set by the touch layer each frame; y counts even though the stick drives x only). */
  raw: { x: number; y: number } | null = null;
  private carry = { v: 0, until: 0 };
  private moverPrev = new Map<unknown, number>();
  private player: unknown = null;
  private lastGroundAt = 0;
  private lastPressAt = -1;
  readonly log: JumpLog[] = [];
  private cur: JumpLog | null = null;
  private camFor: unknown = null;
  /** After a pit (phone assist): the stick is ignored until it comes back to the middle (scene ms it ends anyway). */
  private pitLockUntil = 0;
  pits = 0;

  /** JUMP pressed (touch-down), stamped with the scene clock. */
  press(sc: SideScene | null) {
    if (!sc) return;
    const t = sc.now();
    this.touchHeld = true;
    this.lastPressAt = t;
    this.brain.press(t);
  }

  release(sc: SideScene | null) {
    this.touchHeld = false;
    if (sc) this.brain.release(sc.now());
    else this.brain.release(0);
  }

  /** Everything held or pending goes (room change, mode change, page hidden): never a stuck jump. */
  reset() {
    this.touchHeld = false;
    this.extHeld = false;
    this.brain.reset();
    this.drop.reset();
    this.carry.until = 0;
    this.pitLockUntil = 0;
  }

  /**
   * SideLevel's pit (guarded hook): where to put the player back. Phone assist: PIT_MARGIN short of the edge, and the
   * stick held toward the pit no longer walks them straight back in (it waits for the thumb to come back to the middle).
   */
  pitRespawn(level: { inGap(x: number, pad?: number): boolean }, fellX: number, safeX: number, roomW: number, now: number): number {
    if (!phoneSettings().phoneAssist) return safeX;
    this.pits++;
    this.pitLockUntil = now + PIT_STICK_LOCK_MS;
    this.brain.consume();
    return pitSafeX(fellX, safeX, (x, pad) => level.inGap(x, pad), roomW);
  }

  /** On a one-way platform (not the floor)? */
  private onPlatform(sc: SideScene, b: Body): boolean {
    const g = sc.platforms;
    if (!g) return false;
    for (const o of g.getChildren()) {
      const pb = (o as unknown as { body: StaticBody }).body;
      if (!pb) continue;
      if (Math.abs(b.bottom - pb.top) <= 4 && b.right > pb.left && b.left < pb.right) return true;
    }
    return false;
  }

  /** Player.update's side branch on a phone. Returns true (handled). */
  sideMove(p: SidePlayer, body: Body, c: ControlsLike, mv: { x: number; y: number }, speed: number, dt: number, now: number): boolean {
    const sc = p.world.sc as SideScene;
    if (this.player !== p) {
      // a new room (a new Player): nothing carries over
      this.player = p;
      this.reset();
      this.brain.jumps = p.jumps;
      this.moverPrev.clear();
      this.log.length = 0;
      this.cur = null;
    }
    const assist = phoneSettings().phoneAssist;
    const grounded = body.blocked.down || body.touching.down;
    // (just put back after a pit: the stick waits for the thumb to come back to the middle)
    if (this.pitLockUntil) {
      const neutral = !this.raw || Math.abs(this.raw.x) < 0.2;
      if (neutral || now >= this.pitLockUntil) this.pitLockUntil = 0;
      else mv = { x: 0, y: mv.y };
    }
    if (grounded) this.lastGroundAt = now;
    // a controller or keyboard on the phone: its own jump (up / stick up), always the full height
    if (c.jump()) {
      this.brain.press(now);
      this.lastPressAt = now;
      this.extHeld = true;
    }
    if (grounded && body.velocity.y >= 0 && !this.brain.pressAt) this.extHeld = false;
    // drop through a platform: only a deliberate input (stick held well down, or stick down + JUMP)
    const onPlat = grounded && this.onPlatform(sc, body);
    const pending = this.brain.pressAt !== null;
    if (this.drop.step(now, this.raw, pending && this.touchHeld, onPlat) === "drop") {
      p.dropUntil = now + JUMP_TUNE.dropWindowMs;
      if (pending) this.brain.consume();
    }
    // (a pad's stick down still drops, as on a laptop: mv.y only comes from a pad or keys, the touch stick is x only)
    if (mv.y > 0.6) p.dropUntil = now + JUMP_TUNE.dropWindowMs;
    // moving platforms: their speed is kept a moment after you step or jump off (the game carries you while on one)
    this.moverCarry(sc, p, body, grounded, dt, now);
    // run: the game's easing, quicker in the air
    body.velocity.x += (mv.x * speed - body.velocity.x) * Math.min(1, dt / easeMs(grounded, assist));
    // jump
    const o = this.brain.step({ now, grounded, vy: body.velocity.y, held: this.touchHeld || this.extHeld, assist, rise: this.cur ? this.cur.y0 - body.bottom : undefined });
    if (o.jumpVy !== undefined) {
      body.setVelocityY(o.jumpVy);
      const first = o.kind === "first";
      synth.play(first ? "dodge" : "select");
      sanmikYee(sc, p.spr.x, p.spr.getTopCenter().y - 14, { cooldown: 650, size: 15, depth: 2000, follow: p.spr });
      if (!first) p.world.burst(p.x, p.y + 14, 0xffffff, 6);
      this.cur = { at: now, kind: o.kind!, y0: body.bottom, apex: body.bottom, waited: Math.max(0, now - this.lastPressAt), sinceGround: grounded ? 0 : now - this.lastGroundAt };
      this.log.push(this.cur);
      if (this.log.length > 20) this.log.shift();
    }
    if (o.cutVy !== undefined) body.setVelocityY(o.cutVy);
    if (this.cur) {
      this.cur.apex = Math.min(this.cur.apex, body.bottom);
      if (grounded && now - this.cur.at > 60) this.cur = null;
    }
    p.jumps = this.brain.jumps;
    p.coyoteUntil = this.brain.coyoteUntil;
    if (assist && !grounded) this.forgive(sc, p, body, mv, dt);
    return true;
  }

  private moverCarry(sc: SideScene, p: SidePlayer, body: Body, grounded: boolean, dt: number, now: number) {
    const movers = sc.sideLevel?.movers;
    if (!movers?.length) return;
    let on: number | null = null;
    for (const m of movers) {
      const r = m.rect;
      const prev = this.moverPrev.get(m);
      const v = prev === undefined || dt <= 0 ? 0 : (r.x - prev) / dt; // px per ms
      this.moverPrev.set(m, r.x);
      const top = r.y - r.height / 2;
      if (grounded && Math.abs(body.bottom - top) < 8 && p.x > r.x - r.width / 2 - 6 && p.x < r.x + r.width / 2 + 6) on = v;
    }
    if (on !== null) {
      this.carry.v = on;
      this.carry.until = now + JUMP_TUNE.carryMs;
    } else if (now < this.carry.until && !grounded) {
      // (only in the air: landing anywhere ends it)
      p.spr.x += this.carry.v * dt;
    } else if (grounded) this.carry.until = 0;
  }

  /** Ledge pop and corner correction (phone assist). */
  private forgive(sc: SideScene, p: SidePlayer, body: Body, mv: { x: number }, dt: number) {
    const b = box(body);
    const dir = Math.abs(mv.x) > 0.2 ? Math.sign(mv.x) : Math.sign(body.velocity.x);
    const vy = body.velocity.y;
    const solids: Box[] = [];
    for (const g of [sc.sideLevel?.floor, sc.obstacles]) {
      if (!g) continue;
      for (const o of g.getChildren()) {
        const sb = (o as unknown as { body?: StaticBody }).body;
        if (sb && sb.enable !== false) solids.push(box(sb));
      }
    }
    const plats: Box[] = [];
    if (sc.platforms && !(sc.now() < p.dropUntil)) {
      for (const o of sc.platforms.getChildren()) {
        const sb = (o as unknown as { body?: StaticBody }).body;
        if (sb && sb.enable !== false) plats.push(box(sb));
      }
    }
    for (const s of solids) {
      const up = ledgePop(b, vy, dir, s, false);
      if (up > 0) return this.popUp(p, body, up);
    }
    for (const s of plats) {
      const up = ledgePop(b, vy, dir, s, true);
      if (up > 0) return this.popUp(p, body, up);
    }
    if (vy < 0) {
      for (const s of solids) {
        const nx = cornerNudge(b, vy, dt, s);
        if (nx) {
          p.spr.x += nx;
          return;
        }
      }
    }
  }

  private popUp(p: SidePlayer, body: Body, up: number) {
    p.spr.y -= up;
    body.y -= up;
    if (body.velocity.y > 0) body.setVelocityY(0);
  }

  /** Every frame in a side room: the camera looks ahead of the player (35% / 65% of the width). */
  camera(sc: SideScene, dt: number, moveX: number) {
    const cam = sc.cameras?.main;
    if (!cam || !sc.player?.spr?.active) return;
    const w = cam.width || 960;
    const now = sc.now();
    const fx = this.look.step(now, dt, moveX, w);
    // vertical: a ±100 px band, and the view leads down a little while falling
    const body = sc.player.spr.body as Body;
    const falling = body && body.velocity.y > 200 && !(body.blocked.down || body.touching.down);
    const fy = falling ? -60 : 0;
    // (once per room: the room sets its own 80 x 60 dead zone when it starts)
    if (this.camFor !== sc.player) {
      this.camFor = sc.player;
      cam.setDeadzone(0, 200);
      this.look.snap(1, w);
    }
    // the follow itself: the game's 0.12 a frame made frame-rate independent, and the trail it leaves while running
    // added to the look-ahead, so the player sits at 35% / 65% at 30, 60 or 120 Hz (F4). (DungeonScene skips its own
    // small velocity lead in phone side rooms: this is the whole camera there.)
    const l = camLerp(dt);
    if (Math.abs(cam.lerp.x - l) > 1e-4 || Math.abs(cam.lerp.y - l) > 1e-4) cam.setLerp(l, l);
    const tx = fx - camLagPx(body?.velocity.x ?? 0, dt);
    const ox = cam.followOffset.x;
    const oy = cam.followOffset.y + (fy - cam.followOffset.y) * Math.min(1, dt / 200);
    if (Math.abs(ox - tx) > 0.05 || Math.abs(oy - cam.followOffset.y) > 0.05) cam.setFollowOffset(tx, oy);
  }

  snapshot() {
    return {
      touchHeld: this.touchHeld,
      jumps: this.brain.jumps,
      pressAt: this.brain.pressAt,
      coyoteUntil: this.brain.coyoteUntil,
      raw: this.raw,
      look: this.look.x,
      pits: this.pits,
      pitLock: this.pitLockUntil > 0,
      log: this.log.slice(-6),
    };
  }
}

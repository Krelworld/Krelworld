import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { charMeta, facingFrom, animateWalker, type Facing } from "./HD";
import { BIKE_DROP, BIKE_PEDAL_MIN, BIKE_PEDAL_PX, BIKE_RETURN_PX, BIKE_SPOKE_PX } from "../systems/bike";

/**
 * The bike, drawn round whoever is riding it. The art (public/art/props/bike.png, 64 px frames, the same scale as the
 * lads' sheets) comes in layers: the parts behind the rider and the parts in front of him, per direction.
 *   0-2 side view (east; west is mirrored), spokes turning · 3 parked on its stand
 *   4-5 facing us, in front of him (front wheel, bars, lamp) · 9 behind him (the back tyre)
 *   6-7 facing away, in front of him (back wheel, reflector) · 8 behind him (the bars poking out)
 * The rider is the scene's own avatar, untouched: his walk cycle is his pedalling, and the bike sits a few pixels below
 * his feet so they land on the pedals.
 */
export const BIKE_TEX = "bike";

/** Which frames make up each direction: behind / in front of the rider (null = none), and whether it's mirrored. */
export function bikeFrames(f: Facing, spoke: number, tread: number): { back: number | null; front: number | null; flip: boolean } {
  switch (f) {
    case "east":
      return { back: spoke % 3, front: null, flip: false };
    case "west":
      return { back: spoke % 3, front: null, flip: true };
    case "north":
      return { back: 8, front: 6 + (tread % 2), flip: false };
    default:
      return { back: 9, front: 4 + (tread % 2), flip: false };
  }
}

export class BikeRider {
  riding = false;
  private sc: Phaser.Scene;
  private back: Phaser.GameObjects.Sprite;
  private front: Phaser.GameObjects.Sprite;
  private parked: Phaser.GameObjects.Sprite;
  /** Where the bike lives when nobody's on it (outside Home), or null (it's never left standing about). */
  private home: { x: number; y: number } | null;
  private travelled = 0;
  private facing: Facing = "east";
  private tmp = new Phaser.Math.Vector2();
  readonly ok: boolean;

  constructor(scene: Phaser.Scene, home: { x: number; y: number } | null, scale = 1) {
    this.sc = scene;
    this.home = home;
    this.ok = scene.textures.exists(BIKE_TEX);
    const tex = this.ok ? BIKE_TEX : "__DEFAULT";
    this.back = scene.add.sprite(0, 0, tex, 0).setOrigin(0.5, 1).setVisible(false);
    this.front = scene.add.sprite(0, 0, tex, 4).setOrigin(0.5, 1).setVisible(false);
    this.parked = scene.add.sprite(0, 0, tex, 3).setOrigin(0.5, 1).setVisible(false);
    if (home && this.ok) this.park(home.x, home.y, false, scale);
  }

  /** The bike standing on its own (outside Home, or where you got off), if it's there. */
  parkedAt(): { x: number; y: number } | null {
    return this.parked.visible ? { x: this.parked.x, y: this.parked.y } : null;
  }

  isHome(): boolean {
    return !!this.home && this.parked.visible && this.parked.x === this.home.x && this.parked.y === this.home.y;
  }

  private park(x: number, y: number, flip: boolean, scale: number) {
    this.parked.setPosition(x, y).setFlipX(flip).setScale(scale).setDepth(y).setAlpha(1).setVisible(true);
  }

  /** Get on (the bell rings). */
  mount(rider: Phaser.GameObjects.Sprite) {
    if (this.riding || !this.ok) return;
    this.riding = true;
    this.parked.setVisible(false);
    this.travelled = 0;
    this.facing = (rider.getData("facing") as Facing) ?? "east";
    const sc = Math.abs(rider.scaleX) || 1;
    this.back.setScale(sc);
    this.front.setScale(sc);
    synth.play("bikebell");
    // a little bounce as you land on the saddle
    this.sc.tweens.add({ targets: [this.back, this.front], scaleY: { from: sc * 0.88, to: sc }, duration: 140, ease: "Back.Out" });
  }

  /** Get off. The bike is left standing beside you (it finds its own way home once you're far enough away). */
  dismount(rider: Phaser.GameObjects.Sprite, quiet = false) {
    if (!this.riding) return;
    this.riding = false;
    this.back.setVisible(false);
    this.front.setVisible(false);
    const feet = rider.getBottomCenter(this.tmp);
    const sc = Math.abs(rider.scaleX) || 1;
    const west = this.facing === "west";
    this.park(feet.x + (west ? 26 : -26) * sc, feet.y + BIKE_DROP * sc, west, sc);
    animateWalker(rider, 0, 0, false, this.sc.time.now);
    if (!quiet) synth.play("bikeoff");
  }

  /**
   * Every frame. Riding: draws the bike under the rider and works his legs (pedalling with the distance travelled).
   * Not riding: a bike left standing about goes home once you're well away from it.
   */
  update(rider: Phaser.GameObjects.Sprite, vx: number, vy: number, dt: number, now: number, steer?: { x: number; y: number }) {
    if (!this.ok) return;
    if (!this.riding) {
      if (this.parked.visible && this.home && !this.isHome()) {
        const d = Phaser.Math.Distance.Between(rider.x, rider.y, this.parked.x, this.parked.y);
        if (d > BIKE_RETURN_PX) this.park(this.home.x, this.home.y, false, this.parked.scaleY);
      } else if (this.parked.visible && !this.home) {
        const d = Phaser.Math.Distance.Between(rider.x, rider.y, this.parked.x, this.parked.y);
        if (d > BIKE_RETURN_PX) this.parked.setVisible(false);
      }
      return;
    }
    const speed = Math.hypot(vx, vy);
    this.travelled += (speed * dt) / 1000;
    const pedalling = speed > BIKE_PEDAL_MIN;
    // he faces where you steer (even against a wall), else where he's rolling
    if (steer && Math.hypot(steer.x, steer.y) > 0.1) this.facing = facingFrom(steer.x, steer.y, this.facing);
    else if (pedalling) this.facing = facingFrom(vx, vy, this.facing);
    rider.setData("facing", this.facing);
    // his legs: the walk cycle, one frame per stretch of road (so they slow down as you coast)
    const meta = charMeta(rider.scene, rider.texture.key);
    if (meta) {
      rider.setFlipX(false);
      const cyc = meta.walk[this.facing] ?? meta.walk.south;
      if (pedalling && cyc?.length) rider.setFrame(cyc[Math.floor(this.travelled / BIKE_PEDAL_PX) % cyc.length]);
      else rider.setFrame(meta.idle[this.facing] ?? 0);
    } else animateWalker(rider, vx, vy, pedalling, now);
    const fr = bikeFrames(this.facing, Math.floor(this.travelled / BIKE_SPOKE_PX), Math.floor(this.travelled / (BIKE_SPOKE_PX * 1.5)));
    const feet = rider.getBottomCenter(this.tmp);
    const sc = Math.abs(rider.scaleX) || 1;
    const y = feet.y + BIKE_DROP * sc;
    const vis = rider.visible;
    const d = rider.depth;
    for (const [spr, f, dz] of [
      [this.back, fr.back, -0.01],
      [this.front, fr.front, 0.01],
    ] as const) {
      if (f === null) {
        spr.setVisible(false);
        continue;
      }
      // (the mount bounce tweens scaleY; X follows the rider)
      spr.setFrame(f).setFlipX(fr.flip).setPosition(feet.x, y).setDepth(d + dz).setAlpha(rider.alpha).setVisible(vis);
      spr.scaleX = sc;
      if (!this.sc.tweens.isTweening(spr)) spr.scaleY = sc;
    }
  }

  /** How far below the avatar's feet its shadow should sit, and how wide (the bike is longer than the lad). */
  shadow(): { dy: number; sx: number } {
    return this.riding ? { dy: BIKE_DROP * (Math.abs(this.back.scaleX) || 1), sx: 1.7 } : { dy: 0, sx: 1 };
  }

  destroy() {
    this.back.destroy();
    this.front.destroy();
    this.parked.destroy();
  }
}

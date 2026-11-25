// PHONE MODE: frame rate in the heaviest rooms (phones only; a laptop never loads this file). Rules: perfLogic.ts.
//
//  - Off-screen pictures are not drawn. Phaser hands every Image and Sprite on the display list to the renderer each
//    frame, on screen or not; a phone's CPU pays for each one. The concept boss's ruined Krelford alone has 50 fires,
//    44 blood pools and 16 rain sheets across a world three times the screen. Here an Image / Sprite that sits wholly
//    outside the camera's view (with a margin; top-level objects that scroll with the world only) is skipped for that
//    camera. Nothing about it changes: it still animates, moves, collides and is drawn the moment it is in view.
//  - Blood pools on the floor: at most MAX_POOLS show in a fight; the oldest beyond that are hidden (not removed: the
//    game's own code may still hold them).
//  - A ring at the player's feet in the rooms where he is hard to find on a small screen (the concept boss's dark,
//    burning, rainy Krelford; any top-down room with a crowd on screen).
// (The concept boss's camera no longer zooms out below 1.0 on a phone: a guarded hook in KrelfordFinale.ts.)
import Phaser from "phaser";
import { CULL_MARGIN, offView, POOL_KEYS, poolsToHide, wantsMarker } from "./perfLogic";

type Bag = Record<string, any>;

export class PhonePerf {
  /** Objects skipped this frame (for ?mobilediag and the smoke test). */
  culled = 0;
  drawn = 0;
  private frameNo = -1;
  private lastCheck = 0;
  enabled = true;

  constructor(readonly game: Phaser.Game) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    for (const C of [Phaser.GameObjects.Image, Phaser.GameObjects.Sprite] as unknown as { prototype: Bag }[]) {
      const proto = C.prototype;
      if (proto.__krelCull) continue;
      const base = proto.willRender as (cam: Phaser.Cameras.Scene2D.Camera) => boolean;
      proto.willRender = function (this: Bag, cam: Phaser.Cameras.Scene2D.Camera) {
        if (!base.call(this, cam)) return false;
        if (!self.enabled || this.parentContainer || this.scrollFactorX !== 1 || this.scrollFactorY !== 1 || (cam as unknown as Bag).rotation !== 0) return true;
        self.count();
        const v = cam.worldView;
        const r = Math.hypot(this.displayWidth || 0, this.displayHeight || 0);
        if (offView(this.x, this.y, r, v.x, v.y, v.width, v.height, CULL_MARGIN)) {
          self.culled++;
          return false;
        }
        self.drawn++;
        return true;
      };
      proto.__krelCull = true;
    }
    game.events.on(Phaser.Core.Events.POST_STEP, () => this.frame());
  }

  /** Counts restart each frame. */
  private count() {
    const f = this.game.loop.frame;
    if (f !== this.frameNo) {
      this.frameNo = f;
      this.lastCulled = this.culled;
      this.lastDrawn = this.drawn;
      this.culled = 0;
      this.drawn = 0;
    }
  }
  lastCulled = 0;
  lastDrawn = 0;

  // ------------------------------------------------------------------ the player's ring

  private frame() {
    const sc = this.liveDungeon();
    if (!sc) return;
    const ring = (sc.__krelRing as Phaser.GameObjects.Graphics | undefined) ?? this.makeRing(sc);
    const p = (sc.player as Bag | undefined)?.spr as Bag | undefined;
    const now = performance.now();
    if (now - this.lastCheck > 500) {
      this.lastCheck = now;
      const room = sc.room as Bag | undefined;
      const want = !!p && !sc.side && wantsMarker(String((sc.dungeon as Bag | undefined)?.id ?? ""), (sc.children?.list?.length as number) ?? 0, !!room?.dark);
      ring.setData("want", want);
      this.capPools(sc);
    }
    const on = !!p && p.visible !== false && p.active !== false && ring.getData("want") === true && !sc.busy;
    ring.setVisible(on);
    if (!on) return;
    ring.setPosition(p!.x, p!.y + Math.abs(p!.displayHeight || 0) * 0.08);
    ring.setDepth((p!.depth ?? 10) - 0.05);
    ring.setAlpha(0.55 + 0.2 * Math.sin(now / 260));
  }

  /** Pools hidden so far (?mobilediag, the smoke test). */
  poolsHidden = 0;

  private capPools(sc: Bag) {
    const list = (sc.children?.list ?? []) as Bag[];
    const pools = list.filter((o) => o.visible && POOL_KEYS.has(o.texture?.key));
    for (const o of poolsToHide(pools)) {
      o.setVisible(false);
      o.anims?.stop?.();
      this.poolsHidden++;
    }
  }

  private makeRing(sc: Bag): Phaser.GameObjects.Graphics {
    const g = (sc as Phaser.Scene).add.graphics();
    g.lineStyle(3, 0x000000, 0.6);
    g.strokeEllipse(0, 0, 50, 22);
    g.lineStyle(2, 0x7dd3fc, 1);
    g.strokeEllipse(0, 0, 46, 19);
    g.setVisible(false);
    sc.__krelRing = g;
    (sc as Phaser.Scene).events.once("shutdown", () => {
      g.destroy();
      sc.__krelRing = undefined;
    });
    return g;
  }

  private liveDungeon(): Bag | null {
    try {
      if (!this.game.scene.isActive("Dungeon")) return null;
      return this.game.scene.getScene("Dungeon") as unknown as Bag;
    } catch {
      return null;
    }
  }
}

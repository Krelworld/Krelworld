import Phaser from "phaser";
import { G } from "../G";

/** Ambient set dressing shared by the overworld scenes: looping prop sheets, gentle neon. */

/** Calm-flash mode: no hard blinks, only slow breathing. */
export const calm = () => !!G.meta?.settings?.calmFlash;

/**
 * A looping prop sheet (`<key>_anim`, a strip of frames) as a sprite, started at a random frame so a row of the same
 * prop doesn't move in lockstep. Falls back to the still (or nothing) when the sheet isn't installed.
 */
export function loopProp(sc: Phaser.Scene, key: string, x: number, y: number, fps = 8, o: { still?: string; yoyo?: boolean; scale?: number } = {}): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null {
  if (!sc.textures.exists(key)) return o.still && sc.textures.exists(o.still) ? sc.add.image(x, y, o.still).setScale(o.scale ?? 1) : null;
  const ak = `${key}@${fps}${o.yoyo ? "y" : ""}`;
  if (!sc.anims.exists(ak)) sc.anims.create({ key: ak, frames: sc.anims.generateFrameNumbers(key, {}), frameRate: fps, repeat: -1, yoyo: !!o.yoyo });
  const s = sc.add.sprite(x, y, key, 0).setScale(o.scale ?? 1);
  s.play(ak);
  s.anims.setProgress(Math.random());
  return s;
}

import Phaser from "phaser";
import { G } from "../G";

/**
 * "Reduce flashing" (Settings): every camera flash in the game is drawn at a fraction of its brightness and
 * slower, so explosions, transformations and krezzes stop strobing the whole screen. Off by default.
 */
let installed = false;
export function installCalmFlash() {
  if (installed) return;
  installed = true;
  const F: any = (Phaser.Cameras.Scene2D.Effects as any).Flash.prototype;
  const start = F.start;
  F.start = function (duration = 250, red = 255, green = 255, blue = 255, force?: boolean, callback?: any, context?: any) {
    if (G.meta?.settings?.calmFlash) {
      const k = 0.22;
      return start.call(this, Math.max(duration, 300), red * k, green * k, blue * k, force, callback, context);
    }
    return start.call(this, duration, red, green, blue, force, callback, context);
  };
}

// PHONE MODE: Battery saver (the `batterySaver` setting, off by default): the game loop runs at most 30 times a
// second. Physics is a fixed 60 Hz step, so bodies move the same; it is Phaser's own frame limiter (the game config's
// `fps.limit`), switched on and off live. Phones only.
import type Phaser from "phaser";

export const BATTERY_FPS = 30;

type Loop = Phaser.Core.TimeStep & { fpsLimit: number; hasFpsLimit: boolean; _limitRate: number; running: boolean };

/** Cap (or uncap) the frame rate now. The loop is restarted only if it is running (a sleeping loop picks it up on wake). */
export function setFrameCap(game: Phaser.Game, on: boolean) {
  const loop = game.loop as Loop;
  if (!loop) return;
  const want = on ? BATTERY_FPS : 0;
  if (loop.fpsLimit === want && loop.hasFpsLimit === on) return;
  loop.fpsLimit = want;
  loop.hasFpsLimit = on;
  // (a little under 33.3 ms: Phaser steps once the time since the last step reaches this, so at 60 Hz it is every
  // second frame and at 120 Hz every fourth, even when the browser's frame times jitter by a millisecond)
  loop._limitRate = on ? 1000 / BATTERY_FPS - 5 : 0;
  // (the step function is chosen when the loop starts or wakes)
  if (loop.running) {
    try {
      loop.sleep();
      loop.wake();
      loop.resetDelta();
    } catch {
      /* not started yet: it starts with the limit */
    }
  }
}

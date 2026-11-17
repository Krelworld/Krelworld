import Phaser from "phaser";

/**
 * Run a full-screen overlay scene on top of `sc` and wait for it: the caller is paused under it (so nothing hits
 * you mid-card) and resumed after. The overlay has its own camera at zoom 1, so whatever the game camera's doing
 * (punch-ins, pans, slow-mo) the card is drawn the same. The overlay class is added to the game the first time.
 * The overlay ends itself by calling `data.done()`; it's safe if the caller shuts down in the meantime.
 */
export async function runOverlay<T extends object>(sc: Phaser.Scene, key: string, cls: typeof Phaser.Scene, data: T): Promise<void> {
  // a scene coming back from a dialogue (which pauses it) is resumed a frame later: give it a moment
  for (let i = 0; i < 40 && sc.sys && sc.sys.isPaused(); i++) await new Promise((r) => window.setTimeout(r, 25));
  return new Promise((res) => {
    const mgr = sc.sys?.game?.scene;
    if (!mgr || !sc.sys.isActive()) return res();
    if (!mgr.getScene(key)) mgr.add(key, cls, false);
    // one at a time: a card already up is ended first
    if (mgr.isActive(key)) mgr.stop(key);
    let fin = false;
    const pausedHere = sc.sys.isActive();
    const done = () => {
      if (fin) return;
      fin = true;
      if (mgr.isActive(key)) mgr.stop(key);
      if (pausedHere && sc.sys && sc.sys.isPaused()) sc.scene.resume();
      res();
    };
    // the caller going away (a death, a quit) ends it too
    sc.events.once("shutdown", done);
    mgr.start(key, { ...data, done });
    mgr.bringToTop(key);
    if (pausedHere) sc.scene.pause();
  });
}

/** Skipping a card: any key, a click or tap, or a pad button, once `after` ms have passed. Returns an off(). */
export function onSkip(sc: Phaser.Scene, after: number, fn: () => void): () => void {
  const t0 = performance.now();
  const go = () => {
    if (performance.now() - t0 >= after) fn();
  };
  const kb = sc.input.keyboard;
  kb?.on("keydown", go);
  sc.input.on("pointerdown", go);
  const pad = sc.input.gamepad;
  pad?.on("down", go);
  return () => {
    kb?.off("keydown", go);
    sc.input.off("pointerdown", go);
    pad?.off("down", go);
  };
}

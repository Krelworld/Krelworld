// PHONE MODE: keeping saves and holding the download (phones only; a laptop never loads this file).
//
//  - Saves: the game autosaves all the time (every room, every change of scene) and the shell saves when the page is
//    hidden or closed (shell.ts). Here the browser is asked, once per launch and silently, to keep the site's storage
//    (navigator.storage.persist(): Safari 17+ and Chrome grant or refuse without asking; Firefox would ask with a
//    permission box, so it is never asked there). Nothing is ever shown to the player. The answer is kept for
//    ?mobilediag. The page being frozen (Chrome's lifecycle "freeze", before a background tab is discarded) saves too.
//  - The download in an app's own browser (Messenger, Instagram...): the art is held until the player has seen "open
//    it in Safari / Chrome first" and chosen PLAY HERE ANYWAY (it would be downloaded again in the real browser).
import type Phaser from "phaser";
import { G } from "../G";
import type { PlatformInfo } from "./platform";

type Bag = Record<string, any>;

export interface StorageState {
  persisted: boolean | null;
  usageMB: number | null;
  quotaMB: number | null;
}

export const storageState: StorageState = { persisted: null, usageMB: null, quotaMB: null };

/** Ask once, quietly, for the site's storage to be kept (never where the browser would show a permission box). */
export function askToKeepSaves(p: Pick<PlatformInfo, "browser">) {
  const st = (navigator as unknown as Bag).storage as Bag | undefined;
  if (!st) return;
  const done = (v: boolean) => (storageState.persisted = v);
  try {
    void Promise.resolve(st.persisted?.())
      .then((already: boolean) => {
        if (already) return done(true);
        if (p.browser === "firefox" || typeof st.persist !== "function") return done(false);
        return Promise.resolve(st.persist()).then((v: boolean) => done(!!v));
      })
      .catch(() => undefined);
    void Promise.resolve(st.estimate?.())
      .then((e: Bag | undefined) => {
        if (!e) return;
        storageState.usageMB = Math.round(((e.usage as number) ?? 0) / 1048576);
        storageState.quotaMB = Math.round(((e.quota as number) ?? 0) / 1048576);
      })
      .catch(() => undefined);
  } catch {
    /* no storage manager */
  }
  // (Chrome freezes a background tab before it may discard it: save first)
  document.addEventListener("freeze", () => {
    try {
      if (G.hasRun()) G.save();
    } catch {
      /* never let a save break the page */
    }
  });
}

/**
 * Hold the boot's download (no new files start; the ones already on their way finish). Returns what lets it go.
 * Phaser's loader starts a file only while fewer than `maxParallelDownloads` are on their way, so 0 holds it.
 */
export function holdBootLoad(game: Phaser.Game): () => void {
  let loader: Bag | null = null;
  let was = 32;
  let released = false;
  let timer = 0;
  const grab = (): boolean => {
    if (released) return true;
    try {
      const boot = game.scene?.getScene?.("Boot") as unknown as Bag | null;
      const l = boot?.load as Bag | undefined;
      if (!l) return false;
      // (already past the boot: nothing to hold)
      if (!game.scene.isActive("Boot") && (game as unknown as Bag).isRunning) return true;
      loader = l;
      was = l.maxParallelDownloads || 32;
      l.maxParallelDownloads = 0;
      return true;
    } catch {
      return false;
    }
  };
  if (!grab()) {
    let tries = 0;
    timer = window.setInterval(() => {
      if (grab() || ++tries > 200) window.clearInterval(timer);
    }, 50);
  }
  return () => {
    if (released) return;
    released = true;
    window.clearInterval(timer);
    if (loader) loader.maxParallelDownloads = was;
  };
}

/** Is the boot's download held right now? (tests) */
export function bootLoadHeld(game: Phaser.Game): boolean {
  try {
    const l = (game.scene.getScene("Boot") as unknown as Bag | null)?.load as Bag | undefined;
    return !!l && l.maxParallelDownloads === 0;
  } catch {
    return false;
  }
}

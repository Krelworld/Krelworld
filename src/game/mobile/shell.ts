// PHONE MODE: the page around the game (phones only; a laptop never runs any of this).
//  - html.mobile and the phone CSS (no zoom, no selection, no callout, no tap flash, no rubber band, full height);
//  - the canvas centred once (the page's flex centring plus Phaser's own margins pushed it off-centre);
//  - portrait: the turn-your-phone screen; the game loop sleeps and the sound holds until it's sideways again
//    (except while the art is still loading, which carries on behind it so no time is lost);
//  - the page hidden (app switch, lock, another tab) or unloading: everything lets go, the loop sleeps, the music and
//    the sound context pause, and the game saves; all of it picks up again when the page comes back;
//  - Safari's bars collapsing (visualViewport) and rotations: the game re-measures;
//  - Android: the Enter-gate tap asks for fullscreen and locks landscape, and a small control offers it again if the
//    player leaves fullscreen (iPhone has no fullscreen: the Add to Home Screen guide, homeScreen.ts, is its route);
//  - the back gesture: one guard entry in the history, so a stray back swipe pauses the game instead of leaving it
//    (a second back while paused does leave).
import type Phaser from "phaser";
import { synth } from "../audio/Synth";
import { G } from "../G";
import { MOBILE_CSS, MOBILE_STYLE_ID } from "./css";
import { currentPlatform, type PlatformInfo } from "./platform";
import { isPortrait, RotateOverlay } from "./rotate";
import type { TouchLayer } from "./touchLayer";

type Hold = "portrait" | "hidden";

export class Shell {
  readonly platform: PlatformInfo;
  readonly rotate: RotateOverlay;
  private holds = new Set<Hold>();
  private slept = false;
  private heldAudio = false;
  private pausedMusic = false;
  private resizeTimer = 0;
  private fsEntered = false;
  private gateTapped = false;
  private guardArmed = false;
  private lastSave = 0;
  private booted = false;

  constructor(
    readonly game: Phaser.Game,
    readonly parent: HTMLElement,
    private layer: TouchLayer | null,
  ) {
    this.platform = currentPlatform();
    document.documentElement.classList.add("mobile");
    if (!document.getElementById(MOBILE_STYLE_ID)) {
      const st = document.createElement("style");
      st.id = MOBILE_STYLE_ID;
      st.textContent = MOBILE_CSS;
      document.head.appendChild(st);
    }
    // fullscreen takes #game (with the touch layer and this screen in it), not a new box around the canvas alone
    try {
      game.scale.fullscreenTarget = parent;
    } catch {
      /* not booted yet: set again on ready */
    }
    this.rotate = new RotateOverlay(parent, this.platform);
    this.checkOrientation();
    this.listen();
  }

  setLayer(layer: TouchLayer) {
    this.layer = layer;
  }

  // ------------------------------------------------------------------ listening

  private listen() {
    const onResize = () => this.scheduleResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    try {
      matchMedia("(orientation: portrait)").addEventListener("change", onResize);
    } catch {
      /* old Safari: resize covers it */
    }
    document.addEventListener("visibilitychange", () => this.setHold("hidden", document.visibilityState === "hidden"));
    window.addEventListener("pagehide", () => {
      this.setHold("hidden", true);
      this.save();
    });
    window.addEventListener("pageshow", () => {
      if (document.visibilityState !== "hidden") this.setHold("hidden", false);
    });
    // losing focus (a call, the notification shade): let go of every control
    window.addEventListener("blur", () => this.layer?.releaseAll());
    window.addEventListener("focus", () => this.layer?.rearm());
    // every finished touch: the sound context must be running (iPhone only starts it from a touchend), and the guard
    // against a stray back swipe goes back up once the player is playing again
    document.addEventListener("touchend", () => this.afterTouch(), { capture: true, passive: true });
    window.addEventListener("popstate", () => this.onBack());
    this.game.events.once("ready", () => {
      try {
        this.game.scale.fullscreenTarget = this.parent;
      } catch {
        /* keep Phaser's default */
      }
      this.scheduleResize();
    });
    this.game.scale.on("enterfullscreen", () => {
      this.fsEntered = true;
      this.layer?.setFullscreenOffer(false);
      this.lockLandscape();
      this.scheduleResize();
    });
    this.game.scale.on("leavefullscreen", () => {
      if (this.fsEntered && this.canFullscreen()) this.layer?.setFullscreenOffer(true);
      this.scheduleResize();
    });
  }

  /** Every game frame (phones only, from index.ts). */
  frame() {
    // the art finished loading while the phone was upright: now the loop can sleep
    if (this.holds.size && !this.slept && !this.booting()) this.applyHolds();
  }

  // ------------------------------------------------------------------ size and orientation

  private scheduleResize() {
    window.clearTimeout(this.resizeTimer);
    // (debounced: Safari fires a burst of these while its bars slide)
    this.resizeTimer = window.setTimeout(() => this.resize(), 120);
    this.checkOrientation();
  }

  private resize() {
    this.checkOrientation();
    try {
      this.game.scale.refresh();
    } catch {
      /* not booted yet */
    }
    this.layer?.layout();
  }

  private checkOrientation() {
    const vv = window.visualViewport;
    const w = window.innerWidth || vv?.width || 0;
    const h = window.innerHeight || vv?.height || 0;
    const up = w > 0 && h > 0 && isPortrait(w, h);
    if (up !== this.rotate.visible) {
      this.rotate.set(up);
      this.setHold("portrait", up);
    }
  }

  // ------------------------------------------------------------------ sleeping and waking

  /** The first load is still going (nothing but the Boot scene has run yet: it loads in its LOADING state). */
  private booting(): boolean {
    if (this.booted) return false;
    const g = this.game as Phaser.Game & { isRunning?: boolean };
    if (!g.isRunning) return true;
    try {
      this.booted = this.game.scene.getScenes(true).some((s) => s.sys.settings.key !== "Boot");
    } catch {
      return true;
    }
    return !this.booted;
  }

  private setHold(h: Hold, on: boolean) {
    const had = this.holds.has(h);
    if (on === had) return;
    if (on) this.holds.add(h);
    else this.holds.delete(h);
    if (on) {
      this.layer?.releaseAll();
      if (h === "hidden") this.save();
    }
    this.applyHolds();
  }

  private applyHolds() {
    // (portrait during the first load: the art keeps loading behind the screen; it sleeps once loading is done)
    const sleep = this.holds.has("hidden") || (this.holds.has("portrait") && !this.booting());
    if (sleep && !this.slept) {
      this.slept = true;
      try {
        this.game.loop.sleep();
      } catch {
        /* not started */
      }
    } else if (!sleep && this.slept) {
      this.slept = false;
      try {
        this.game.loop.wake();
        this.game.loop.resetDelta();
      } catch {
        /* ignore */
      }
    }
    // (the sound holds with the loop: nothing has started playing while the art is still loading)
    if (sleep) this.holdAudio();
    else if (this.heldAudio) this.releaseAudio();
    if (!this.holds.size) this.layer?.rearm();
  }

  private holdAudio() {
    if (this.heldAudio) return;
    this.heldAudio = true;
    const s = synth as unknown as { musicPaused?: boolean };
    try {
      // (the pause menu may have paused it already: then it is the menu's to resume, not ours)
      if (!s.musicPaused) {
        synth.pauseMusic();
        this.pausedMusic = true;
      }
    } catch {
      /* no music */
    }
    try {
      const c = synth.ctx;
      if (c && c.state === "running") void c.suspend().catch(() => undefined);
    } catch {
      /* no context */
    }
  }

  private releaseAudio() {
    this.heldAudio = false;
    if (this.pausedMusic) {
      this.pausedMusic = false;
      try {
        synth.resumeMusic();
      } catch {
        /* ignore */
      }
    }
    // iPhone: after a lock or an app switch the context can say "running" and stay silent. Suspend, then resume,
    // a moment after coming back (and the next touch tries again if it is still not running).
    window.setTimeout(() => {
      const c = synth.ctx;
      if (!c || this.holds.size) return;
      c.suspend()
        .catch(() => undefined)
        .then(() => (this.holds.size ? undefined : c.resume()))
        .catch(() => undefined);
    }, 150);
  }

  private afterTouch() {
    try {
      const c = synth.ctx;
      if (!c) synth.unlock();
      else if (c.state !== "running" && !this.holds.size) void c.resume().catch(() => undefined);
    } catch {
      /* no audio */
    }
    if (this.gateTapped && !this.guardArmed) this.armGuard();
    if (!this.gateTapped && this.onEnterGate()) this.enterGateTapped();
  }

  private save() {
    const t = Date.now();
    if (t - this.lastSave < 1000) return;
    this.lastSave = t;
    try {
      if (G.hasRun()) G.save();
    } catch {
      /* never let a save break leaving the page */
    }
  }

  // ------------------------------------------------------------------ the Enter gate, fullscreen, landscape

  private onEnterGate(): boolean {
    try {
      return this.game.scene.isActive("Enter");
    } catch {
      return false;
    }
  }

  private canFullscreen(): boolean {
    return this.platform.android && !this.platform.standalone && !!this.game.device?.fullscreen?.available;
  }

  /** Android, not in fullscreen now, and the browser can do it (the Add to Home Screen guide offers it). */
  canGoFullscreen(): boolean {
    try {
      return this.canFullscreen() && !this.game.scale.isFullscreen;
    } catch {
      return false;
    }
  }

  private enterGateTapped() {
    this.gateTapped = true;
    if (this.canFullscreen()) this.goFullscreen();
    this.armGuard();
  }

  /** Must run inside a touchend (the browser only allows fullscreen from one). */
  goFullscreen() {
    if (!this.canFullscreen() || this.game.scale.isFullscreen) return;
    try {
      this.game.scale.startFullscreen({ navigationUI: "hide" });
    } catch {
      /* refused: the game carries on in the browser */
    }
  }

  private lockLandscape() {
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      // "landscape", not "landscape-primary": both ways round work
      void o?.lock?.("landscape")?.catch(() => undefined);
    } catch {
      /* not allowed here */
    }
  }

  // ------------------------------------------------------------------ the back gesture

  private armGuard() {
    try {
      history.pushState({ krelGuard: true }, "");
      this.guardArmed = true;
    } catch {
      this.guardArmed = false;
    }
  }

  private onBack() {
    if (!this.guardArmed) return;
    this.guardArmed = false;
    // a stray back swipe pauses (where the game can pause); the guard goes back up with the next touch
    this.layer?.pause();
  }
}

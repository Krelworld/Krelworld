// PHONE MODE: the page around the game (phones only; a laptop never runs any of this).
//  - html.mobile and the phone CSS (no zoom, no selection, no callout, no tap flash, no rubber band, full height);
//  - the canvas centred once (the page's flex centring plus Phaser's own margins pushed it off-centre);
//  - portrait: the turn-your-phone screen; the game loop sleeps and the sound holds until it's sideways again
//    (except while the art is still loading, which carries on behind it so no time is lost);
//  - the page hidden (app switch, lock, another tab) or unloading: everything lets go, the loop sleeps, the music and
//    the sound context pause, and the game saves; all of it picks up again when the page comes back;
//  - the Add to Home Screen guide open: the loop sleeps under it (nothing can hurt you while you read);
//  - coming back to a fight (from any of the above): never straight into live action. Where the game has a pause
//    route it opens the pause menu; where it has none (the finale, the minigames) the loop stays asleep behind a
//    "tap to carry on" card. Town carries straight on;
//  - Safari's bars collapsing (visualViewport) and rotations: the game re-measures; and a few times after launch, a
//    rotation, pageshow and coming back, and whenever the screen differs from what the canvas was fitted to, it checks
//    the fit again (s4b: a home-screen launch once drew the game in a smaller box with a black strip at the bottom);
//  - Android: the Enter-gate tap asks for fullscreen and locks landscape, and a small control offers it again if the
//    player leaves fullscreen (iPhone has no fullscreen: the Add to Home Screen guide, homeScreen.ts, is its route).
//    Messages the game pins to <body> (the crash guard's notices) are moved into the fullscreen element so they show;
//  - the back gesture: one guard entry in the history, so a stray back swipe pauses the game instead of leaving it,
//    closes a phone overlay first (the conversation log, the Phone settings page, the guide), opens the pause menu in
//    a meeting / cutscene / vignette (the laptop's Esc), and does nothing where the game can't pause (the title, a
//    town conversation, a menu). A back while the pause menu is
//    showing leaves.
import type Phaser from "phaser";
import { synth } from "../audio/Synth";
import { G } from "../G";
import { MOBILE_CSS, MOBILE_STYLE_ID } from "./css";
import { currentPlatform, type PlatformInfo } from "./platform";
import { isPortrait, RotateOverlay } from "./rotate";
import type { TouchLayer } from "./touchLayer";
import type { ModeDecision } from "./modes";

/** Why the loop is asleep. Several can hold at once; it wakes when the last one lets go. */
export type Hold = "portrait" | "hidden" | "guide" | "resume";

/** What coming back to the game needs (pure; unit-tested): nothing, the pause menu, or the tap-to-carry-on card. */
export function wakeCare(d: Pick<ModeDecision, "live" | "pause" | "scene"> | null | undefined): "pause" | "card" | null {
  if (!d || !d.live) return null;
  return d.pause && d.scene ? "pause" : "card";
}

/** After launch, a rotation or resize, pageshow and coming back: the fit is checked again at these times (ms). */
export const REFIT_MS: readonly number[] = [0, 250, 750, 1500];
/** How often a running game compares the screen with what the canvas was fitted to (ms). */
export const FIT_CHECK_MS = 500;

/**
 * Is the canvas drawn at another size than Phaser's FIT gives for its box (pure; unit-tested)? `canvas` and `box` are
 * page CSS px; the game is 960x540.
 */
export function fitStale(canvas: { w: number; h: number }, box: { w: number; h: number }, game = { w: 960, h: 540 }, tol = 1.5): boolean {
  if (!(box.w > 0) || !(box.h > 0)) return false;
  const k = Math.min(box.w / game.w, box.h / game.h);
  return Math.abs(canvas.w - game.w * k) > tol || Math.abs(canvas.h - game.h * k) > tol;
}

/**
 * The game's box (#game, 100% / 100dvh) is not the screen (pure): iOS can work out 100dvh for a home-screen app before
 * its status bar and home indicator settle, leaving the box short until something else re-lays the page.
 */
export function boxStale(box: { w: number; h: number }, screen: { w: number; h: number }, tol = 1.5): boolean {
  if (!(screen.w > 0) || !(screen.h > 0)) return false;
  return Math.abs(box.h - screen.h) > tol || Math.abs(box.w - screen.w) > tol;
}

export class Shell {
  readonly platform: PlatformInfo;
  readonly rotate: RotateOverlay;
  private holds = new Set<Hold>();
  private slept = false;
  private heldAudio = false;
  private pausedMusic = false;
  private resizeTimer = 0;
  /** The re-fit checks pending, the screen size the canvas was last fitted to, when it was last compared. */
  private refitTimers: number[] = [];
  private fitKey = "";
  private nextFitCheck = 0;
  /** The box's height had to be set from the screen (100dvh was wrong): it follows the screen from then on. */
  private boxPinned = false;
  /** Tests and ?mobilediag: how many checks ran, and how many found the fit wrong and put it right. */
  readonly refits = { checks: 0, fixes: 0, pins: 0, last: "" };
  private fsEntered = false;
  private gateTapped = false;
  /** Touches that started while the Enter gate was up (the gate acts on touch-down; fullscreen needs a touchend). */
  private gateTouches = new Set<number>();
  private guardArmed = false;
  private lastSave = 0;
  private booted = false;
  private card: HTMLDivElement;
  /** The player tapped "carry on": this wake goes straight back to the game. */
  private carryOn = false;
  /** How the last wake was handled (tests). */
  lastWake: "pause" | "card" | null = null;

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
    this.card = this.makeCard();
    this.checkOrientation();
    this.listen();
  }

  setLayer(layer: TouchLayer) {
    this.layer = layer;
  }

  // ------------------------------------------------------------------ listening

  private listen() {
    const onResize = () => {
      this.scheduleResize();
      this.refitSoon("resize");
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    try {
      matchMedia("(orientation: portrait)").addEventListener("change", onResize);
    } catch {
      /* old Safari: resize covers it */
    }
    document.addEventListener("visibilitychange", () => {
      this.setHold("hidden", document.visibilityState === "hidden");
      if (document.visibilityState === "visible") this.refitSoon("visible");
    });
    window.addEventListener("pagehide", () => {
      this.setHold("hidden", true);
      this.save();
    });
    window.addEventListener("pageshow", () => {
      if (document.visibilityState !== "hidden") this.setHold("hidden", false);
      this.refitSoon("pageshow");
    });
    // losing focus (a call, the notification shade): let go of every control
    window.addEventListener("blur", () => this.layer?.releaseAll());
    window.addEventListener("focus", () => {
      if (!this.holds.size) this.layer?.rearm();
    });
    // the Enter gate starts on touch-down: note which touches began there (capture: before anything else sees them)
    document.addEventListener("touchstart", (e) => this.beforeTouch(e), { capture: true, passive: true });
    // every finished touch: the sound context must be running (iPhone only starts it from a touchend), and the guard
    // against a stray back swipe goes back up once the player is playing again
    document.addEventListener("touchend", (e) => this.afterTouch(e), { capture: true, passive: true });
    window.addEventListener("popstate", () => this.onBack());
    whenRunning(this.game, () => {
      try {
        this.game.scale.fullscreenTarget = this.parent;
      } catch {
        /* keep Phaser's default */
      }
      this.scheduleResize();
      this.refitSoon("launch");
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
    // the game pins a few messages to <body> (the crash guard's notices): in Android's fullscreen only #game shows, so
    // they go in there
    try {
      new MutationObserver((list) => {
        for (const m of list)
          for (const n of Array.from(m.addedNodes)) {
            if (n instanceof HTMLElement && n !== this.parent && n.parentNode === document.body && n.style.position === "fixed") this.parent.appendChild(n);
          }
      }).observe(document.body, { childList: true });
    } catch {
      /* no MutationObserver: notices stay on body */
    }
  }

  /** Every game frame (phones only, from index.ts). */
  frame() {
    // the art finished loading while the phone was upright: now the loop can sleep
    if (this.holds.size && !this.slept && !this.booting()) this.applyHolds();
    // (twice a second: has the screen changed from what the canvas was fitted to, with no event to say so?)
    const t = performance.now();
    if (t >= this.nextFitCheck) {
      this.nextFitCheck = t + FIT_CHECK_MS;
      if (this.fitKey && this.screenKey() !== this.fitKey) this.refitSoon("drift");
    }
  }

  // ------------------------------------------------------------------ the fit, checked again (s4b)

  /** The screen as the page sees it now (the visual viewport where there is one), as a key. */
  private screenKey(): string {
    const vv = window.visualViewport;
    return `${Math.round(vv?.width ?? window.innerWidth)}x${Math.round(vv?.height ?? window.innerHeight)}`;
  }

  /** Check the fit now and a few times more (REFIT_MS): a launch, a rotation, pageshow or coming back can settle late. */
  private refitSoon(why: string) {
    for (const id of this.refitTimers) window.clearTimeout(id);
    this.refitTimers = REFIT_MS.map((ms) => window.setTimeout(() => this.refit(why), ms));
  }

  /**
   * Measure, and put right only what is wrong (so nothing flickers): the box (#game) against the screen, then the
   * canvas against its box and Phaser's idea of it; then the touch layer's layout follows.
   */
  private refit(why: string) {
    this.refits.checks++;
    this.fitKey = this.screenKey();
    const parent = this.parent;
    let fixed = false;
    try {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      let box = parent.getBoundingClientRect();
      if (boxStale({ w: box.width, h: box.height }, { w: sw, h: sh }) && (this.boxPinned || box.height < sh)) {
        // (100dvh came out short: the box takes the screen's height in px, and keeps following it)
        parent.style.height = `${sh}px`;
        if (!this.boxPinned) this.refits.pins++;
        this.boxPinned = true;
        box = parent.getBoundingClientRect();
        fixed = true;
      }
      const cv = this.game.canvas?.getBoundingClientRect();
      const ps = this.game.scale.parentSize;
      const phaserStale = !!ps && (Math.abs(ps.width - box.width) > 1.5 || Math.abs(ps.height - box.height) > 1.5);
      if (fixed || phaserStale || (cv && fitStale({ w: cv.width, h: cv.height }, { w: box.width, h: box.height }))) {
        this.checkOrientation();
        // (refresh() alone keeps Phaser's last idea of the box: it is measured again first)
        this.game.scale.getParentBounds();
        this.game.scale.refresh();
        this.layer?.layout();
        fixed = true;
      }
    } catch {
      /* not booted yet: the next check */
    }
    if (fixed) {
      this.refits.fixes++;
      this.refits.last = why;
    }
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

  /** The sound is held (page hidden, or upright after the load): the context stays suspended until it lets go. */
  holdingAudio(): boolean {
    return this.heldAudio;
  }

  /** Is this hold on? */
  holding(h: Hold): boolean {
    return this.holds.has(h);
  }

  /** Put a hold on or take it off (the guide uses "guide"; the shell itself the rest). */
  setHold(h: Hold, on: boolean) {
    const had = this.holds.has(h);
    if (on === had) return;
    if (on) this.holds.add(h);
    else this.holds.delete(h);
    if (!on && h === "resume") {
      this.carryOn = true;
      this.setCardExtra(null);
      if (this.cardMusic) {
        this.cardMusic = false;
        try {
          synth.resumeMusic();
        } catch {
          /* no music */
        }
      }
    }
    if (on) {
      this.layer?.releaseAll();
      if (h === "hidden") this.save();
    }
    this.card.classList.toggle("show", this.holds.has("resume") && !this.holds.has("hidden") && !this.holds.has("portrait"));
    this.applyHolds();
  }

  private applyHolds() {
    if (this.layer) this.layer.held = this.holds.size > 0;
    // (portrait during the first load: the art keeps loading behind the screen; it sleeps once loading is done)
    const sleep = this.holds.has("hidden") || this.holds.has("guide") || this.holds.has("resume") || (this.holds.has("portrait") && !this.booting());
    if (sleep && !this.slept) {
      this.slept = true;
      try {
        this.game.loop.sleep();
      } catch {
        /* not started */
      }
    } else if (!sleep && this.slept) {
      // back to the game: never straight into a live fight
      const care = this.carryOn ? null : wakeCare(this.layer?.decision);
      this.carryOn = false;
      this.lastWake = care;
      if (care === "card") {
        // (no pause route here: stay asleep behind "tap to carry on")
        this.setHold("resume", true);
        return;
      }
      this.slept = false;
      try {
        this.game.loop.wake();
        this.game.loop.resetDelta();
      } catch {
        /* ignore */
      }
      // (the pause menu, the way the scene opens it; for the Esc path the scene reads it on its first frame)
      if (care === "pause") this.layer?.pause();
    }
    // the sound holds while hidden or upright (not under the guide or the carry-on card: the music may play on);
    // nothing has started playing while the art is still loading
    const quiet = this.holds.has("hidden") || (this.holds.has("portrait") && !this.booting());
    if (quiet) this.holdAudio();
    else if (this.heldAudio) this.releaseAudio();
    if (!this.holds.size) this.layer?.rearm();
  }

  private cardExtra: { label: string; fn: () => void } | null = null;

  private setCardExtra(x: { label: string; fn: () => void } | null) {
    this.cardExtra = x;
    const b = this.card?.querySelector(".kres-x") as HTMLElement | null;
    if (!b) return;
    b.textContent = x?.label ?? "";
    b.classList.toggle("on", !!x);
  }

  /**
   * Pause where the scene has no pause menu (the finale brawl's II): the "tap to carry on" card, with one extra
   * button (the laptop's Esc for that scene, e.g. SKIP FIGHT). Tapping elsewhere on the card carries on.
   */
  pauseCard(extra: { label: string; fn: () => void } | null = null) {
    this.setCardExtra(extra);
    this.setHold("resume", true);
    // (a pause: the song holds too, so a scene timed to it picks up in step; unless the pause menu already holds it)
    const s = synth as unknown as { musicPaused?: boolean };
    try {
      if (this.holds.has("resume") && !s.musicPaused) {
        synth.pauseMusic();
        this.cardMusic = true;
      }
    } catch {
      /* no music */
    }
  }

  /** The PAUSED card holds the song (pauseCard): picked up again when the player carries on. */
  private cardMusic = false;

  /** The "tap to carry on" card (a fight with no pause menu: the finale, the minigames). */
  private makeCard(): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "kres";
    el.setAttribute("role", "button");
    el.innerHTML = `<div class="kres-in"><div class="kres-t">PAUSED</div><div class="kres-s">Tap to carry on</div><div class="kres-x" role="button"></div></div>`;
    let down = false;
    let onX = false;
    el.addEventListener("touchstart", (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      down = true;
      onX = !!(e.target as HTMLElement | null)?.closest?.(".kres-x.on");
    }, { passive: false });
    el.addEventListener("touchmove", (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    }, { passive: false });
    el.addEventListener("touchend", (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (!down) return;
      down = false;
      // (the card's extra button, where a scene has one: the game wakes first, then it acts)
      const fn = onX ? this.cardExtra?.fn : null;
      this.setHold("resume", false);
      fn?.();
    }, { passive: false });
    el.addEventListener("touchcancel", () => (down = false));
    // (a mouse, for ?mobile=1 on a computer)
    el.addEventListener("click", () => this.setHold("resume", false));
    this.parent.appendChild(el);
    return el;
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
      if (!c || this.heldAudio) return;
      c.suspend()
        .catch(() => undefined)
        .then(() => (this.heldAudio ? undefined : c.resume()))
        .catch(() => undefined);
    }, 150);
  }

  private beforeTouch(e: TouchEvent) {
    if (this.gateTapped || !this.onEnterGate()) return;
    for (const t of Array.from(e.changedTouches)) this.gateTouches.add(t.identifier);
  }

  private afterTouch(e: TouchEvent) {
    try {
      const c = synth.ctx;
      if (!c) synth.unlock();
      else if (c.state !== "running" && !this.heldAudio) void c.resume().catch(() => undefined);
    } catch {
      /* no audio */
    }
    if (this.gateTapped && !this.guardArmed) this.armGuard();
    if (!this.gateTapped) {
      // (the gate acts on touch-down and fades out: a press held past the fade ends on the title, and still counts)
      const fromGate = Array.from(e.changedTouches ?? []).some((t) => this.gateTouches.has(t.identifier));
      if (fromGate || this.onEnterGate()) {
        this.gateTouches.clear();
        this.enterGateTapped();
      }
    }
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

  /** In the game's fullscreen now (Android). */
  inFullscreen(): boolean {
    try {
      return !!this.game.scale.isFullscreen;
    } catch {
      return false;
    }
  }

  /** Leave fullscreen (the guide's written steps need the browser's own menu bar). */
  leaveFullscreen() {
    try {
      if (this.game.scale.isFullscreen) this.game.scale.stopFullscreen();
    } catch {
      /* ignore */
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

  /** The pause menu (not the title's settings, not a shop) is showing. */
  private pauseMenuShowing(): boolean {
    try {
      const m = this.game.scene.getScene("Menu") as unknown as { mode?: string } | null;
      return this.game.scene.isActive("Menu") && m?.mode === "pause";
    } catch {
      return false;
    }
  }

  /** Phone overlays and conversations that answer Back first (dialogue.ts, settingsPage.ts, the guide): true = done. */
  private backHandlers: (() => boolean)[] = [];

  /** Something that answers Android's Back before the game does (in the order added). */
  addBackHandler(fn: () => boolean) {
    this.backHandlers.push(fn);
  }

  private onBack() {
    if (!this.guardArmed) return;
    this.guardArmed = false;
    // a phone overlay closes (the conversation log, the Phone settings page, the guide), or a conversation with a pause
    // menu opens it (dialogue.ts): the guard goes straight back up
    for (const fn of this.backHandlers) {
      let done = false;
      try {
        done = fn();
      } catch {
        done = false;
      }
      if (done) {
        this.armGuard();
        return;
      }
    }
    // a back while the pause menu is showing closes it, as its RESUME does (stage 4, DEFERRED R3: Android's edge swipe
    // is easily doubled, and the second Back used to leave KRELWORLD for the page before it, mid-fight or mid-scene)
    if (this.pauseMenuShowing()) {
      try {
        (this.game.scene.getScene("Menu") as unknown as { close?: () => void }).close?.();
      } catch {
        /* the menu went on its own */
      }
      this.armGuard();
      return;
    }
    // otherwise it pauses where the game can, and does nothing where it can't (the title, a conversation, a menu):
    // the guard goes straight back up (and again with the next touch, if the browser skips an entry made outside a tap)
    this.layer?.pause();
    this.armGuard();
  }

  /** Tests: the shell's state. */
  snapshot() {
    return { holds: [...this.holds], slept: this.slept, card: this.card.classList.contains("show"), guard: this.guardArmed, gate: this.gateTapped, lastWake: this.lastWake, refits: { ...this.refits, pinned: this.boxPinned } };
  }
}

/** Run once the game is running (now, if it already is: the phone code may arrive after the game has booted). */
export function whenRunning(game: Phaser.Game, fn: () => void) {
  if ((game as Phaser.Game & { isRunning?: boolean }).isRunning) fn();
  else game.events.once("ready", fn);
}

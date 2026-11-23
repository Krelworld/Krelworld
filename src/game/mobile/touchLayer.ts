// PHONE MODE: the touch layer. A transparent full-window layer of HTML controls above the canvas (inside #game, so it
// stays on screen in fullscreen), sized in real CSS px, usable in the black gutters. It feeds the game's existing
// TOUCH object (stick → TOUCH.mx/my, buttons → TOUCH.edges), so the game logic is unchanged.
//
// Rules it keeps (audit section 3, research M3):
//  - pointer-events none everywhere except on the controls that exist in the current mode;
//  - every control is a real element whose box is the drawing plus the slop; a touch that lands on it belongs to it
//    (by touch id) until it ends, wherever the thumb drifts; touchcancel releases without acting;
//  - controls call preventDefault on touchstart (no zoom, no magnifier, no ghost mouse events, and Phaser's window
//    listener ignores the touch, so the game never sees it twice);
//  - a quick tap in the stick zone that never became a drag is handed to the game as a tap at that point;
//  - mode changes, the page hiding, rotating and blur release everything at once (no stuck stick or button);
//  - per-frame DOM writes are transforms only.
import type Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { synth } from "../audio/Synth";
import {
  followBase,
  ghostStick,
  layoutSlots,
  stickGeometry,
  stickVector,
  stickZone,
  type Insets,
  type Placed,
  type Rect,
  type SlotId,
  type StickGeometry,
  type Viewport,
} from "./layout";
import { onPhoneSettingsChange, phoneSettings } from "./settings";
import { NONE, resolveMode, sameDecision, type LayerMode, type ModeDecision } from "./modes";
import { dropEdges, pressInteract, pressPause, pressSanmik, promptRect, readView } from "./observe";

/** A touch that moves less than this is still a tap (Android uses 8 dp, iOS 10 pt). */
export const TAP_SLOP = 10;
/** A touch held longer than this without moving is a resting thumb, not a tap. */
export const TAP_MS = 400;
/** A control that has just appeared ignores presses this long (research S11). */
export const ARM_MS = 160;

/** What a mode controller gets: the layer, the game and the current decision. */
export interface ModeContext {
  layer: TouchLayer;
  game: Phaser.Game;
  decision: ModeDecision;
}

/**
 * Stage 2+: the controls for one mode. The layer calls `enter` when the mode starts, `frame` every game frame while
 * it lasts, `release` when every input must let go (page hidden, rotated, blur), and `leave` when it ends.
 * Add elements under `layer.root`; read sizes from `layer.slots` / `layer.viewport`.
 */
export interface ModeController {
  id: LayerMode;
  enter?(ctx: ModeContext): void;
  frame?(ctx: ModeContext): void;
  release?(ctx: ModeContext): void;
  leave?(ctx: ModeContext): void;
}

const controllers = new Map<LayerMode, ModeController>();

/** Register (or replace) the controls for a mode. */
export function registerModeController(c: ModeController) {
  controllers.set(c.id, c);
}

type ButtonName = "action" | "sanmik" | "pause" | "fullscreen";

interface Btn {
  el: HTMLDivElement;
  face: HTMLDivElement;
  label: HTMLSpanElement | null;
  slot: SlotId;
  shown: boolean;
  armedAt: number;
  touches: Set<number>;
}

interface StickTouch {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  bx: number;
  by: number;
  moved: boolean;
  /** The mode moved on while it was down: it does nothing more, and is no tap. */
  dead: boolean;
}

interface FakeEvent {
  type: string;
  [k: string]: unknown;
}

type PhaserInput = {
  enabled: boolean;
  onTouchStart(e: FakeEvent): void;
  onTouchEnd(e: FakeEvent): void;
};

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class TouchLayer {
  readonly root: HTMLDivElement;
  readonly game: Phaser.Game;
  viewport: Viewport = { w: 844, h: 390, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  slots!: Record<SlotId, Placed>;
  zoneRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  geo!: StickGeometry;
  decision: ModeDecision = { ...NONE };
  /** Called when the player taps the fullscreen offer (set by the shell). */
  onFullscreen: (() => void) | null = null;

  private probe: HTMLDivElement;
  private zone: HTMLDivElement;
  private stickEl: HTMLDivElement;
  private baseEl: HTMLDivElement;
  private knobEl: HTMLDivElement;
  private capEl: HTMLDivElement;
  private bubble: HTMLDivElement;
  private btns: Record<ButtonName, Btn>;
  private stick: StickTouch | null = null;
  private zoneTaps = new Map<number, { x0: number; y0: number; t0: number; moved: boolean }>();
  private bubbleTouch: { id: number; x0: number; y0: number; moved: boolean } | null = null;
  private bubbleOn = false;
  private pendingUps: { ev: FakeEvent; steps: number }[] = [];
  private fakeId = 900000;
  private fsOffer = false;
  /** The player has walked with the stick this visit (the MOVE hint under the idle stick goes away). */
  private learnedMove = false;
  private insetsOverride: Insets | null = null;
  /** Edges this layer set, and when (dropped if the mode moves on before a scene reads them). */
  private myEdges = new Map<string, number>();
  private offSettings: () => void;

  constructor(game: Phaser.Game, parent: HTMLElement) {
    this.game = game;
    const root = document.createElement("div");
    root.className = "kt none";
    root.setAttribute("aria-hidden", "true");
    this.root = root;
    this.probe = this.div("kt-probe");
    this.zone = this.div("kt-zone");
    this.stickEl = this.div("kt-stick");
    this.baseEl = this.div("kt-base", this.stickEl);
    this.knobEl = this.div("kt-knob", this.stickEl);
    this.capEl = this.div("kt-cap", this.stickEl);
    this.capEl.textContent = "MOVE";
    this.bubble = this.div("kt-bubble");
    this.btns = {
      action: this.button("kt-action", "prime", true),
      sanmik: this.button("kt-sanmik", "walkExtra", true),
      pause: this.button("kt-pause", "pause", false),
      fullscreen: this.button("kt-fs", "fullscreen", false),
    };
    this.btns.sanmik.face.textContent = "SANMIK";
    this.btns.pause.face.innerHTML = `<span class="kt-bars"><i></i><i></i></span>`;
    this.btns.fullscreen.face.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="square"/></svg>`;
    parent.appendChild(root);
    this.bindZone();
    this.bindBubble();
    for (const n of Object.keys(this.btns) as ButtonName[]) this.bindButton(n);
    this.offSettings = onPhoneSettingsChange(() => this.layout());
    this.layout();
  }

  // ------------------------------------------------------------------ building

  private div(cls: string, parent: HTMLElement = this.root): HTMLDivElement {
    const d = document.createElement("div");
    d.className = cls;
    parent.appendChild(d);
    return d;
  }

  private button(cls: string, slot: SlotId, withLabel: boolean): Btn {
    const el = this.div(`kt-btn ${cls}`);
    const face = this.div("kt-face", el);
    let label: HTMLSpanElement | null = null;
    if (withLabel) {
      label = document.createElement("span");
      face.appendChild(label);
    }
    return { el, face, label, slot, shown: false, armedAt: 0, touches: new Set() };
  }

  // ------------------------------------------------------------------ layout

  /** Tests and screenshots: pretend the phone has these safe-area insets (emulators report none). */
  setInsetsOverride(i: Insets | null) {
    this.insetsOverride = i;
    this.layout();
  }

  private readInsets(): Insets {
    if (this.insetsOverride) return this.insetsOverride;
    try {
      const cs = getComputedStyle(this.probe);
      const n = (v: string) => Math.max(0, parseFloat(v) || 0);
      return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
    } catch {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
  }

  /** Work out every position again (resize, rotation, settings). */
  layout() {
    const w = this.root.clientWidth || window.innerWidth || 844;
    const h = this.root.clientHeight || window.innerHeight || 390;
    const st = phoneSettings();
    this.viewport = { w, h, insets: this.readInsets() };
    this.root.style.setProperty("--kt-a", String(st.opacity));
    this.slots = layoutSlots(this.viewport, st);
    this.geo = stickGeometry(h, st.buttonSize);
    this.zoneRect = stickZone(this.viewport, st);
    const z = this.zoneRect;
    this.zone.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.w / 100},${z.h / 100})`;
    const g = this.geo;
    for (const [el, d] of [
      [this.baseEl, g.base],
      [this.knobEl, g.knob],
    ] as const) {
      el.style.width = el.style.height = `${d}px`;
      el.style.marginLeft = el.style.marginTop = `${-d / 2}px`;
    }
    this.capEl.style.marginTop = `${-g.base / 2 - 22}px`;
    for (const n of Object.keys(this.btns) as ButtonName[]) this.placeButton(n);
    this.fitActionLabel();
    if (!this.stick) this.placeGhost();
  }

  private placeButton(n: ButtonName) {
    const b = this.btns[n];
    // (the fullscreen offer takes the corner when there is no pause button beside it)
    if (n === "fullscreen") b.slot = this.btns.pause.shown ? "fullscreen" : "pause";
    const p = this.slots[b.slot];
    b.el.style.width = `${p.hit.w}px`;
    b.el.style.height = `${p.hit.h}px`;
    b.el.style.transform = `translate(${p.hit.x}px,${p.hit.y}px)`;
    b.face.style.width = b.face.style.height = `${p.size}px`;
    b.face.style.left = `${p.cx - p.size / 2 - p.hit.x}px`;
    b.face.style.top = `${p.cy - p.size / 2 - p.hit.y}px`;
  }

  private placeGhost() {
    const p = ghostStick(this.viewport, phoneSettings());
    this.stickEl.style.transform = `translate(${p.x}px,${p.y}px)`;
    this.knobEl.style.transform = "translate(0px,0px)";
  }

  private fitActionLabel() {
    const b = this.btns.action;
    const text = b.label?.textContent ?? "";
    const size = this.slots.prime.size;
    const fs = Math.min(20, Math.max(10, (size - 12) / (Math.max(4, text.length) * 0.68)));
    b.face.style.fontSize = `${fs.toFixed(1)}px`;
  }

  // ------------------------------------------------------------------ modes

  /** Look at the game and show what fits (every game frame, phones only). */
  frame() {
    let d: ModeDecision;
    try {
      d = resolveMode(readView(this.game));
    } catch {
      d = { ...NONE };
    }
    this.apply(d);
    this.flushUps(false);
    this.updateBubble();
    const c = controllers.get(this.decision.mode);
    c?.frame?.({ layer: this, game: this.game, decision: this.decision });
  }

  /** Show a decision (the mode table's, or one forced by a test). */
  apply(d: ModeDecision) {
    if (sameDecision(d, this.decision)) return;
    const prev = this.decision;
    this.decision = d;
    const modeChanged = prev.mode !== d.mode || prev.scene !== d.scene || prev.legacyPad !== d.legacyPad;
    if (modeChanged) {
      const ctx = { layer: this, game: this.game, decision: prev };
      controllers.get(prev.mode)?.leave?.(ctx);
      this.releaseStick();
      // edges the layer set for the old scene, never read: drop them so they can't fire somewhere else later
      const t = now();
      for (const [n, at] of this.myEdges) if (t - at < 1500) dropEdges(n);
      this.myEdges.clear();
      this.root.className = `kt ${d.mode}${d.legacyPad ? " legacy" : ""}`;
      controllers.get(d.mode)?.enter?.({ layer: this, game: this.game, decision: d });
    }
    const walk = d.mode === "walk" && !d.legacyPad;
    const label = this.btns.action.label;
    if (label && d.action && label.textContent !== d.action) {
      label.textContent = d.action;
      this.fitActionLabel();
    }
    this.show("action", walk && !!d.action);
    this.show("sanmik", walk && d.sanmik);
    const pauseWas = this.btns.pause.shown;
    this.show("pause", !!d.pause && d.pauseButton && !d.legacyPad);
    if (pauseWas !== this.btns.pause.shown) this.placeButton("fullscreen");
    this.show("fullscreen", this.fsOffer && !d.legacyPad && (d.mode === "walk" || d.mode === "none" || d.mode === "tap"));
    this.stickEl.classList.toggle("ghost", walk && !this.stick);
    this.capEl.style.display = this.learnedMove ? "none" : "";
  }

  private show(n: ButtonName, on: boolean) {
    const b = this.btns[n];
    if (b.shown === on) return;
    b.shown = on;
    b.el.classList.toggle("show", on);
    if (on) {
      b.armedAt = now() + ARM_MS;
      if (n === "action") {
        // a little pop the moment there's something to do
        b.el.classList.remove("pop");
        void b.el.offsetWidth;
        b.el.classList.add("pop");
      }
    } else {
      // (a thumb still on it keeps owning its touch until it lifts; it just does nothing more)
      b.el.classList.remove("on");
    }
  }

  /** Android: offer to go back into fullscreen (after the player left it). */
  setFullscreenOffer(on: boolean) {
    this.fsOffer = on;
    const d = this.decision;
    this.show("fullscreen", on && !d.legacyPad && (d.mode === "walk" || d.mode === "none" || d.mode === "tap"));
  }

  // ------------------------------------------------------------------ the stick

  private bindZone() {
    const z = this.zone;
    z.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        kickAudio();
        for (const t of Array.from(e.changedTouches)) {
          if (this.decision.mode !== "walk" || this.decision.legacyPad) {
            // (the zone is about to switch off): this touch does nothing
            this.zoneTaps.set(t.identifier, { x0: t.clientX, y0: t.clientY, t0: now(), moved: true });
            continue;
          }
          if (!this.stick) this.startStick(t);
          else this.zoneTaps.set(t.identifier, { x0: t.clientX, y0: t.clientY, t0: now(), moved: false });
        }
      },
      { passive: false },
    );
    z.addEventListener(
      "touchmove",
      (e) => {
        if (e.cancelable) e.preventDefault();
        for (const t of Array.from(e.changedTouches)) {
          if (this.stick && t.identifier === this.stick.id) this.moveStick(t.clientX, t.clientY);
          else {
            const zt = this.zoneTaps.get(t.identifier);
            if (zt && Math.hypot(t.clientX - zt.x0, t.clientY - zt.y0) > TAP_SLOP) zt.moved = true;
          }
        }
      },
      { passive: false },
    );
    const end = (e: TouchEvent, cancelled: boolean) => {
      if (e.cancelable) e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (this.stick && t.identifier === this.stick.id) this.endStick(!cancelled);
        else {
          const zt = this.zoneTaps.get(t.identifier);
          this.zoneTaps.delete(t.identifier);
          if (zt && !cancelled && !zt.moved && now() - zt.t0 < TAP_MS) this.injectTap(zt.x0, zt.y0);
        }
      }
    };
    z.addEventListener("touchend", (e) => end(e, false), { passive: false });
    z.addEventListener("touchcancel", (e) => end(e, true), { passive: false });
  }

  private startStick(t: Touch) {
    const x = t.clientX;
    const y = t.clientY;
    this.stick = { id: t.identifier, x0: x, y0: y, t0: now(), bx: x, by: y, moved: false, dead: false };
    this.stickEl.classList.remove("ghost");
    this.stickEl.classList.add("live");
    this.stickEl.style.transform = `translate(${x}px,${y}px)`;
    this.knobEl.style.transform = "translate(0px,0px)";
  }

  private moveStick(x: number, y: number) {
    const s = this.stick;
    if (!s || s.dead) return;
    if (!s.moved && Math.hypot(x - s.x0, y - s.y0) > TAP_SLOP) s.moved = true;
    const g = this.geo;
    const nb = followBase({ x: s.bx, y: s.by }, { x, y }, g.travel);
    if (nb.x !== s.bx || nb.y !== s.by) {
      s.bx = nb.x;
      s.by = nb.y;
      this.stickEl.style.transform = `translate(${s.bx}px,${s.by}px)`;
    }
    const v = stickVector(x - s.bx, y - s.by, g);
    TOUCH.mx = v.x;
    TOUCH.my = v.y;
    if (v.mag > 0.5 && !this.learnedMove) {
      this.learnedMove = true;
      this.capEl.style.display = "none";
    }
    this.knobEl.style.transform = `translate(${x - s.bx}px,${y - s.by}px)`;
  }

  private endStick(mayTap: boolean) {
    const s = this.stick;
    if (!s) return;
    this.stick = null;
    if (!s.dead) {
      TOUCH.mx = 0;
      TOUCH.my = 0;
    }
    this.stickEl.classList.remove("live");
    this.placeGhost();
    this.stickEl.classList.toggle("ghost", this.decision.mode === "walk" && !this.decision.legacyPad);
    if (mayTap && !s.dead && !s.moved && now() - s.t0 < TAP_MS) this.injectTap(s.x0, s.y0);
  }

  /** The stick lets go now (its touch stays owned until it lifts, but does nothing more). */
  private releaseStick() {
    if (this.stick) {
      this.stick.dead = true;
      TOUCH.mx = 0;
      TOUCH.my = 0;
      this.stickEl.classList.remove("live");
      this.placeGhost();
    }
    for (const zt of this.zoneTaps.values()) zt.moved = true;
  }

  // ------------------------------------------------------------------ taps handed to the game

  /**
   * A tap in the stick zone that never became a drag: the game gets it as a real touch at that point (tapping a
   * person, a door, a canvas button on the left half). Down now, up two game frames later (so code that polls
   * "is the pointer down" in its update sees it).
   */
  injectTap(clientX: number, clientY: number) {
    const input = this.game.input as unknown as PhaserInput;
    const canvas = this.game.canvas;
    if (!input || !input.enabled || !canvas || typeof input.onTouchStart !== "function") return;
    const touch = {
      identifier: this.fakeId++,
      target: canvas,
      clientX,
      clientY,
      pageX: clientX + (window.scrollX || 0),
      pageY: clientY + (window.scrollY || 0),
      screenX: clientX,
      screenY: clientY,
      radiusX: 1,
      radiusY: 1,
      force: 1,
    };
    const ev = (type: string, live: boolean): FakeEvent => ({
      type,
      target: canvas,
      currentTarget: canvas,
      changedTouches: [touch],
      touches: live ? [touch] : [],
      targetTouches: live ? [touch] : [],
      timeStamp: now(),
      cancelable: false,
      defaultPrevented: false,
      isTrusted: false,
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {},
    });
    try {
      input.onTouchStart(ev("touchstart", true));
      this.pendingUps.push({ ev: ev("touchend", false), steps: 2 });
    } catch {
      /* the game is between scenes: the tap is lost, as a real one would be */
    }
  }

  private flushUps(all: boolean) {
    if (!this.pendingUps.length) return;
    const input = this.game.input as unknown as PhaserInput;
    const keep: { ev: FakeEvent; steps: number }[] = [];
    for (const u of this.pendingUps) {
      u.steps--;
      if (all || u.steps <= 0) {
        try {
          input.onTouchEnd({ ...u.ev, timeStamp: now() });
        } catch {
          /* ignore */
        }
      } else keep.push(u);
    }
    this.pendingUps = keep;
  }

  // ------------------------------------------------------------------ the prompt bubble

  private bindBubble() {
    const el = this.bubble;
    el.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        kickAudio();
        const t = e.changedTouches[0];
        if (t && !this.bubbleTouch) this.bubbleTouch = { id: t.identifier, x0: t.clientX, y0: t.clientY, moved: false };
      },
      { passive: false },
    );
    el.addEventListener(
      "touchmove",
      (e) => {
        if (e.cancelable) e.preventDefault();
        const bt = this.bubbleTouch;
        if (!bt) return;
        for (const t of Array.from(e.changedTouches)) if (t.identifier === bt.id && Math.hypot(t.clientX - bt.x0, t.clientY - bt.y0) > TAP_SLOP) bt.moved = true;
      },
      { passive: false },
    );
    const end = (e: TouchEvent, cancelled: boolean) => {
      if (e.cancelable) e.preventDefault();
      const bt = this.bubbleTouch;
      if (!bt) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== bt.id) continue;
        this.bubbleTouch = null;
        if (!cancelled && !bt.moved && this.bubbleOn && this.decision.mode === "walk" && this.decision.action) this.edge("interact");
      }
    };
    el.addEventListener("touchend", (e) => end(e, false), { passive: false });
    el.addEventListener("touchcancel", (e) => end(e, true), { passive: false });
  }

  /** Keep the invisible tap target on the scene's prompt bubble (transform only). */
  private updateBubble() {
    let r: Rect | null = null;
    if (this.decision.mode === "walk" && this.decision.action) {
      try {
        r = promptRect(this.game, this.decision);
      } catch {
        r = null;
      }
    }
    const on = !!r && r.w > 0 && r.h > 0;
    if (on !== this.bubbleOn) {
      this.bubbleOn = on;
      this.bubble.classList.toggle("show", on);
    }
    if (on && r) {
      const pad = 8;
      this.bubble.style.transform = `translate(${(r.x - pad).toFixed(1)}px,${(r.y - pad).toFixed(1)}px) scale(${((r.w + 2 * pad) / 100).toFixed(3)},${((r.h + 2 * pad) / 100).toFixed(3)})`;
    }
  }

  // ------------------------------------------------------------------ buttons

  private bindButton(n: ButtonName) {
    const b = this.btns[n];
    b.el.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        kickAudio();
        for (const t of Array.from(e.changedTouches)) {
          if (b.touches.has(t.identifier)) continue;
          b.touches.add(t.identifier);
          // just appeared, or switched off already: the touch is owned but does nothing
          if (!b.shown || now() < b.armedAt) continue;
          b.el.classList.add("on");
          if (b.touches.size === 1) this.press(n);
        }
      },
      { passive: false },
    );
    b.el.addEventListener(
      "touchmove",
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false },
    );
    const end = (e: TouchEvent, cancelled: boolean) => {
      if (e.cancelable) e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (!b.touches.delete(t.identifier)) continue;
        if (b.touches.size) continue;
        const wasOn = b.el.classList.contains("on");
        b.el.classList.remove("on");
        // fullscreen has to be asked for in a touchend (the browser only allows it there)
        if (n === "fullscreen" && wasOn && !cancelled && b.shown) this.onFullscreen?.();
      }
    };
    b.el.addEventListener("touchend", (e) => end(e, false), { passive: false });
    b.el.addEventListener("touchcancel", (e) => end(e, true), { passive: false });
  }

  private press(n: ButtonName) {
    if (n === "action") this.edge("interact");
    else if (n === "sanmik") this.edge("sanmik");
    else if (n === "pause") this.pause();
  }

  private edge(name: "interact" | "sanmik" | "pause") {
    if (name === "interact") pressInteract();
    else if (name === "sanmik") pressSanmik();
    this.myEdges.set(name, now());
  }

  /** Pause the way the current scene pauses (the button, and the phone's back gesture). */
  pause(): boolean {
    const d = this.decision;
    const ok = pressPause(this.game, d);
    if (ok && d.pause === "edge") this.myEdges.set("pause", now());
    return ok;
  }

  // ------------------------------------------------------------------ letting go

  /** Everything lets go at once: the page is hiding, the phone turned, the window lost focus. */
  releaseAll() {
    this.releaseStick();
    for (const b of Object.values(this.btns)) {
      b.el.classList.remove("on");
      // (touches stay owned until they end, but are disarmed)
      b.armedAt = Infinity;
    }
    if (this.bubbleTouch) this.bubbleTouch.moved = true;
    this.flushUps(true);
    controllers.get(this.decision.mode)?.release?.({ layer: this, game: this.game, decision: this.decision });
  }

  /** After a release: controls work again for new touches. */
  rearm() {
    const t = now() + ARM_MS;
    for (const b of Object.values(this.btns)) if (b.touches.size === 0) b.armedAt = t;
  }

  destroy() {
    this.releaseAll();
    this.offSettings();
    this.root.remove();
  }

  /** For tests: what the layer is showing. */
  snapshot() {
    const vis = (n: ButtonName) => this.btns[n].shown;
    return {
      decision: { ...this.decision },
      stick: this.stick ? { live: !this.stick.dead, x: this.stick.bx, y: this.stick.by } : null,
      ghost: this.stickEl.classList.contains("ghost"),
      buttons: { action: vis("action"), sanmik: vis("sanmik"), pause: vis("pause"), fullscreen: vis("fullscreen") },
      actionLabel: this.btns.action.label?.textContent ?? "",
      bubble: this.bubbleOn,
      zone: { ...this.zoneRect },
      slots: this.slots,
      viewport: this.viewport,
      touch: { mx: TOUCH.mx, my: TOUCH.my, enabled: TOUCH.enabled },
      pendingTaps: this.pendingUps.length,
    };
  }
}

/** The first touch on the layer must still unlock the sound (the game does it on its first pointerdown). */
function kickAudio() {
  try {
    if (!synth.ctx) synth.unlock();
  } catch {
    /* no audio */
  }
}

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
//  - nothing inside the stick zone takes touches but the zone: a touch that starts there is the stick the moment it
//    moves. A quick still tap there is the prompt's ACTION when it lands on the prompt bubble or on the thing the
//    prompt is about, and otherwise is handed to the game as a tap at that point;
//  - mode changes, the page hiding, rotating and blur release everything at once (no stuck stick or button); a finger
//    that was down then does nothing more until it lifts (by touch id: a new finger on the same button works at once);
//  - a control the player or the prompt's target is under goes see-through (research C9), in place;
//  - per-frame DOM writes are transforms and class toggles only, and only when something changed.
//
// Stage 2+: `addControl()` makes a control with all of the above (ownership, arming, pressed ring, buzz, slide, layout
// on every resize / Safari bar / left-handed / size change), and `registerModeController()` adds controls for a mode
// (several per mode, by id).
import type Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { synth } from "../audio/Synth";
import {
  followBase,
  GAP_REACH,
  ghostStick,
  groupHit,
  HIT_SLOP,
  inRect,
  layoutSlots,
  outsideZone,
  overlaps,
  routeTouch,
  stickGeometry,
  stickVector,
  stickZone,
  type Insets,
  type Placed,
  type Rect,
  type RouteCandidate,
  type SlotId,
  type StickGeometry,
  type Viewport,
} from "./layout";
import { onPhoneSettingsChange, phoneSettings } from "./settings";
import { NONE, resolveMode, sameDecision, type LayerMode, type ModeDecision } from "./modes";
import { dropEdges, playerRect, pressInteract, pressPause, pressSanmik, promptRect, readView, releaseLegacyPad, targetRect } from "./observe";
import { haptic, type HapticKind } from "./haptics";

/** A touch that moves less than this is still a tap (Android uses 8 dp, iOS 10 pt). */
export const TAP_SLOP = 10;
/** A touch held longer than this without moving is a resting thumb, not a tap. */
export const TAP_MS = 400;
/** A control that has just appeared ignores presses this long (research S11). */
export const ARM_MS = 160;
/** After the player has walked with the stick, the idle stick fades away this long after it was let go. */
export const GHOST_FADE_MS = 2500;

/** What a mode controller gets: the layer, the game and the current decision. */
export interface ModeContext {
  layer: TouchLayer;
  game: Phaser.Game;
  decision: ModeDecision;
}

/**
 * Stage 2+: controls for one mode. The layer calls `enter` when the mode starts, `frame` every game frame while it
 * lasts, `layout` whenever positions are worked out again (resize, Safari's bars, rotation, left-handed, size),
 * `release` when every input must let go (page hidden, rotated, blur), `rearm` when they may work again, and `leave`
 * when it ends. Controls made with `layer.addControl()` are re-placed by the layer itself; `layout` is for anything
 * else. Several controllers may serve one mode (each its own id).
 */
export interface ModeController {
  /** Unique; registering the same id again replaces that controller (with a warning). */
  id: string;
  /** The mode it serves (defaults to `id`, so `{ id: "combat" }` serves combat). */
  mode?: LayerMode;
  enter?(ctx: ModeContext): void;
  frame?(ctx: ModeContext): void;
  layout?(ctx: ModeContext): void;
  release?(ctx: ModeContext): void;
  rearm?(ctx: ModeContext): void;
  leave?(ctx: ModeContext): void;
}

const controllers = new Map<string, ModeController>();

/** Register the controls for a mode (several per mode, by id; the same id again replaces it). */
export function registerModeController(c: ModeController) {
  if (controllers.has(c.id) && controllers.get(c.id) !== c) console.warn(`phone layer: controller "${c.id}" replaced`);
  controllers.set(c.id, c);
}

/** Remove a controller (tests, or a stage that hands a mode back). */
export function unregisterModeController(id: string) {
  controllers.delete(id);
}

function controllersFor(mode: LayerMode): ModeController[] {
  const out: ModeController[] = [];
  for (const c of controllers.values()) if ((c.mode ?? c.id) === mode) out.push(c);
  return out;
}

// ------------------------------------------------------------------ controls

/** How a control behaves. Everything but `id` and `slot` is optional. */
export interface ControlSpec {
  /** Unique on the layer. */
  id: string;
  /** Where it sits (layout.ts SLOTS); re-placed on every layout. */
  slot: SlotId;
  /** Extra class(es) on the element (for its look: `kt-btn <className>`). */
  className?: string;
  /** Text on the face (fitted to the face), or `html` for an icon. */
  label?: string;
  html?: string;
  /** A buzz on press (Android, Vibration on). Default "tap"; null for none. */
  haptic?: HapticKind | null;
  /** Goes see-through while the player or the prompt's target is under it (research C9). Default true. */
  fade?: boolean;
  /** The first finger down on it (shown and armed). */
  onDown?(c: TouchControl): void;
  /** The last finger up. `cancelled`: touchcancel, or the layer let go (page hidden, blur, mode change). Runs inside
   *  the touchend, so fullscreen and other "user gesture" calls are allowed when not cancelled. */
  onUp?(c: TouchControl, info: { cancelled: boolean; ms: number }): void;
  /** The finger that pressed it moved (CSS px from where it landed): slide-to-aim, slide-to-dodge. */
  onSlide?(c: TouchControl, dx: number, dy: number, x: number, y: number): void;
  /**
   * Stage 2: controls in the same group share their touches (research M3, the per-side surface): a touch that lands
   * in the gap between them goes to the nearest one within GAP_REACH px of its drawing, and where touch areas
   * overlap the nearest centre wins. Each control's element then reaches GAP_REACH past its drawing.
   */
  group?: string;
  /** The prime corner: the touch area also runs out to the screen's right edge and down to the home-indicator strip. */
  toCorner?: boolean;
  /** Placed somewhere that isn't a round slot (a chip): its own rectangle, worked out on every layout. */
  place?(layer: TouchLayer): Placed | null;
  /** A word under the face (first-time captions, research S10). */
  caption?: string;
}

interface Owned {
  x0: number;
  y0: number;
  t0: number;
}

/** One on-screen control: an element whose box is its touch area, with the face drawn inside it. */
export class TouchControl {
  readonly el: HTMLDivElement;
  readonly face: HTMLDivElement;
  readonly labelEl: HTMLSpanElement;
  /** The caption under the face (empty: none). */
  readonly capEl: HTMLDivElement;
  slot: SlotId;
  shown = false;
  /** A finger is pressing it now. */
  pressed = false;
  /** The drawing on the page (CSS px), after the last layout. */
  faceRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Where it was placed last (centre, size, touch area). */
  placed: Placed | null = null;
  private html = "";
  private armedAt = 0;
  /** Fingers that count. */
  private live = new Map<number, Owned>();
  /** Fingers it owns that do nothing more (they were down when the layer let go, or landed before it was armed). */
  private dead = new Set<number>();
  private pressedAt = 0;
  private seeThrough = false;

  constructor(
    readonly layer: TouchLayer,
    readonly spec: ControlSpec,
  ) {
    this.slot = spec.slot;
    const el = document.createElement("div");
    el.className = `kt-btn ${spec.className ?? ""}`.trim();
    el.dataset.ctl = spec.id;
    const face = document.createElement("div");
    face.className = "kt-face";
    const label = document.createElement("span");
    if (spec.html) {
      face.innerHTML = spec.html;
      this.html = spec.html;
    } else face.appendChild(label);
    if (spec.label) label.textContent = spec.label;
    el.appendChild(face);
    const cap = document.createElement("div");
    cap.className = "kt-bcap";
    if (spec.caption) cap.textContent = spec.caption;
    el.appendChild(cap);
    layer.root.appendChild(el);
    this.el = el;
    this.face = face;
    this.labelEl = label;
    this.capEl = cap;
    this.bind();
  }

  /** Replace the face's drawing (an icon, a count); only touches the DOM when it changed. */
  setHtml(html: string) {
    if (html === this.html) return;
    this.html = html;
    this.face.innerHTML = html;
  }

  /** The caption under the face (null or "" hides it). */
  setCaption(text: string | null) {
    const t = text ?? "";
    if (this.capEl.textContent !== t) this.capEl.textContent = t;
  }

  get label(): string {
    return this.labelEl.textContent ?? "";
  }

  /** The word on the face (fitted to about 70% of the face's width). */
  setLabel(text: string) {
    if (this.labelEl.textContent === text) return;
    this.labelEl.textContent = text;
    this.fit();
  }

  /** Show or hide. Showing arms it after ARM_MS (a press that lands at once does nothing, research S11). */
  show(on: boolean, pop = false) {
    if (this.shown === on) return;
    this.shown = on;
    this.el.classList.toggle("show", on);
    if (on) {
      this.armedAt = now() + ARM_MS;
      this.place();
      if (pop) {
        this.el.classList.remove("pop");
        void this.el.offsetWidth;
        this.el.classList.add("pop");
      }
    } else this.letGo();
  }

  /** Move to another slot (placed at once). */
  setSlot(slot: SlotId) {
    if (this.slot === slot) return;
    this.slot = slot;
    this.place();
  }

  /** Put it where its slot is now. */
  place() {
    const p: Placed | null | undefined = this.spec.place ? this.spec.place(this.layer) : this.layer.slots?.[this.slot];
    if (!p) return;
    const fw = p.w ?? p.size;
    const fh = p.h ?? p.size;
    // (a group's controls reach GAP_REACH past the drawing; the prime corner runs out to the screen's corner)
    const hit = this.spec.group || this.spec.toCorner ? groupHit(this.layer.viewport, p, this.spec.group ? GAP_REACH : HIT_SLOP, !!this.spec.toCorner) : p.hit;
    this.placed = { ...p, hit };
    const b = this.el.style;
    b.width = `${hit.w}px`;
    b.height = `${hit.h}px`;
    b.transform = `translate(${hit.x}px,${hit.y}px)`;
    const f = this.face.style;
    f.width = `${fw}px`;
    f.height = `${fh}px`;
    f.left = `${p.cx - fw / 2 - hit.x}px`;
    f.top = `${p.cy - fh / 2 - hit.y}px`;
    const c = this.capEl.style;
    c.left = `${p.cx - hit.x}px`;
    c.top = `${p.cy + fh / 2 + 2 - hit.y}px`;
    this.faceRect = { x: p.cx - fw / 2, y: p.cy - fh / 2, w: fw, h: fh };
    this.fit();
  }

  /** Fit the word to the face: measured once per change, never under 10 px. */
  private fit() {
    if (this.spec.html || !this.labelEl.textContent) return;
    const size = this.placed?.size ?? this.layer.slots?.[this.slot]?.size ?? 84;
    const room = size * 0.7;
    let fs = 20;
    this.face.style.fontSize = `${fs}px`;
    const w = this.labelEl.offsetWidth;
    if (w > room && w > 0) fs = Math.max(10, Math.floor(fs * (room / w) * 10) / 10);
    else if (!w) fs = Math.min(20, Math.max(10, room / (Math.max(4, this.label.length) * 0.8)));
    this.face.style.fontSize = `${fs}px`;
  }

  /** See-through (the player or the target is under it). */
  setSeeThrough(on: boolean) {
    if (on === this.seeThrough) return;
    this.seeThrough = on;
    this.el.classList.toggle("see", on);
  }

  private bind() {
    const el = this.el;
    // (a touch belongs to whichever control it was routed to; its later events still arrive here, the element it
    // landed on, so they are passed on by touch id)
    const routed = new Map<number, TouchControl>();
    el.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        kickAudio();
        for (const t of Array.from(e.changedTouches)) {
          const owner = this.spec.group ? this.layer.routeTouch(this, t.clientX, t.clientY) : this;
          routed.set(t.identifier, owner);
          owner.touchStart(t);
        }
      },
      { passive: false },
    );
    el.addEventListener(
      "touchmove",
      (e) => {
        if (e.cancelable) e.preventDefault();
        for (const t of Array.from(e.changedTouches)) (routed.get(t.identifier) ?? this).touchMove(t);
      },
      { passive: false },
    );
    const end = (e: TouchEvent, cancelled: boolean) => {
      if (e.cancelable) e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const owner = routed.get(t.identifier) ?? this;
        routed.delete(t.identifier);
        owner.touchEnd(t, cancelled);
      }
    };
    el.addEventListener("touchend", (e) => end(e, false), { passive: false });
    el.addEventListener("touchcancel", (e) => end(e, true), { passive: false });
  }

  /** A finger lands on it (or was routed to it from a neighbour in its group). */
  touchStart(t: { identifier: number; clientX: number; clientY: number }) {
    if (this.live.has(t.identifier) || this.dead.has(t.identifier)) return;
    // just appeared, switched off already, or the layer is holding: owned, but does nothing
    if (!this.shown || now() < this.armedAt || this.layer.held) {
      this.dead.add(t.identifier);
      return;
    }
    this.live.set(t.identifier, { x0: t.clientX, y0: t.clientY, t0: now() });
    if (this.live.size === 1) {
      this.pressed = true;
      this.pressedAt = now();
      this.el.classList.add("on");
      if (this.spec.haptic !== null) haptic(this.spec.haptic ?? "tap");
      this.spec.onDown?.(this);
    }
  }

  touchMove(t: { identifier: number; clientX: number; clientY: number }) {
    if (!this.spec.onSlide) return;
    const o = this.live.get(t.identifier);
    if (o) this.spec.onSlide(this, t.clientX - o.x0, t.clientY - o.y0, t.clientX, t.clientY);
  }

  touchEnd(t: { identifier: number }, cancelled: boolean) {
    if (this.dead.delete(t.identifier)) return;
    if (!this.live.delete(t.identifier)) return;
    if (this.live.size) return;
    this.up(cancelled);
  }

  /** May a press land on it now (shown, armed, the layer not holding)? */
  get armed(): boolean {
    return this.shown && now() >= this.armedAt && !this.layer.held;
  }

  /** Ignore presses for a moment (its face just changed: research S1, never change a press under a thumb). */
  disarmFor(ms: number) {
    if (this.shown) this.armedAt = Math.max(this.armedAt, now() + ms);
  }

  private up(cancelled: boolean) {
    if (!this.pressed) return;
    this.pressed = false;
    this.el.classList.remove("on");
    this.spec.onUp?.(this, { cancelled, ms: now() - this.pressedAt });
  }

  /** Let go now: every finger on it does nothing more until it lifts (a new finger works at once). */
  letGo() {
    for (const id of this.live.keys()) this.dead.add(id);
    this.live.clear();
    this.up(true);
  }

  /** May be pressed again after a short pause (after the page comes back, or focus returns). */
  rearm() {
    if (this.shown) this.armedAt = Math.max(this.armedAt, now() + ARM_MS);
  }

  /** For tests. */
  state() {
    return { id: this.spec.id, shown: this.shown, pressed: this.pressed, live: this.live.size, dead: this.dead.size, slot: this.slot, see: this.seeThrough, label: this.label, face: { ...this.faceRect }, hit: this.placed ? { ...this.placed.hit } : null, caption: this.capEl.textContent ?? "" };
  }

  destroy() {
    this.letGo();
    this.el.remove();
  }
}

// ------------------------------------------------------------------ the layer

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
  /** The "Stick: stays put" setting: the base sits at its resting place and does not follow the thumb. */
  fixed: boolean;
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

type BuiltIn = "action" | "sanmik" | "pause" | "fullscreen";

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
  /** The shell is holding (page hidden, upright, the guide or the carry-on card up): no control acts. */
  held = false;
  /**
   * Stage 2: things on the page (CSS px) a control must not hide, set each frame by the mode's controllers (the
   * player in a fight, the target): a control over one goes see-through, like over the walking player.
   */
  occluders: Rect[] = [];

  private probe: HTMLDivElement;
  private zone: HTMLDivElement;
  private stickEl: HTMLDivElement;
  private baseEl: HTMLDivElement;
  private knobEl: HTMLDivElement;
  private capEl: HTMLDivElement;
  /** Tap areas outside the stick zone: the prompt bubble, and the thing the prompt is about. */
  private taps: Record<"bubble" | "target", { el: HTMLDivElement; on: boolean; key: string; touch: { id: number; x0: number; y0: number; moved: boolean } | null }>;
  /** The prompt bubble and the prompt's target on the page (whole, for the zone's tap rule), this frame. */
  private bubbleRect: Rect | null = null;
  private target: { tap: Rect; core: Rect } | null = null;
  private controls = new Map<string, TouchControl>();
  private builtIn: Record<BuiltIn, TouchControl>;
  private stick: StickTouch | null = null;
  private zoneTaps = new Map<number, { x0: number; y0: number; t0: number; moved: boolean }>();
  private pendingUps: { ev: FakeEvent; steps: number }[] = [];
  private fakeId = 900000;
  private fsOffer = false;
  /** The player has walked with the stick this visit: the MOVE hint goes, and the idle stick fades when not in use. */
  private learnedMove = false;
  private stickFreeAt = 0;
  private ghostOn: boolean | null = null;
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
    this.taps = {
      bubble: { el: this.div("kt-tap kt-bubble"), on: false, key: "", touch: null },
      target: { el: this.div("kt-tap kt-target"), on: false, key: "", touch: null },
    };
    parent.appendChild(root);
    this.bindZone();
    this.bindTap("bubble");
    this.bindTap("target");
    this.builtIn = {
      action: this.addControl({ id: "action", slot: "prime", className: "kt-action", haptic: "press", onDown: () => this.edge("interact") }),
      sanmik: this.addControl({ id: "sanmik", slot: "walkExtra", className: "kt-sanmik", label: "SANMIK", onDown: () => this.edge("sanmik") }),
      pause: this.addControl({ id: "pause", slot: "pause", className: "kt-pause", html: `<span class="kt-bars"><i></i><i></i></span>`, fade: false, onDown: () => this.pause() }),
      fullscreen: this.addControl({
        id: "fullscreen",
        slot: "fullscreen",
        className: "kt-fs",
        fade: false,
        html: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="square"/></svg>`,
        // (fullscreen has to be asked for in a touchend: the browser only allows it there)
        onUp: (c, i) => {
          if (!i.cancelled && c.shown) this.onFullscreen?.();
        },
      }),
    };
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

  /** A control on the layer (stage 2+: FIRE, DODGE, JUMP, chips...). Hidden until `show(true)`. */
  addControl(spec: ControlSpec): TouchControl {
    this.controls.get(spec.id)?.destroy();
    const c = new TouchControl(this, spec);
    this.controls.set(spec.id, c);
    if (this.slots) c.place();
    return c;
  }

  /** A control by id (the built-in ones are "action", "sanmik", "pause", "fullscreen"). */
  control(id: string): TouchControl | undefined {
    return this.controls.get(id);
  }

  removeControl(id: string) {
    this.controls.get(id)?.destroy();
    this.controls.delete(id);
  }

  /**
   * A touch landed on a group control's element at (x, y): which control of that group it belongs to (research M3:
   * the nearest centre where touch areas overlap, the nearest drawing within GAP_REACH in a gap). Only shown
   * controls take part; anything else stays with the control it landed on.
   */
  routeTouch(from: TouchControl, x: number, y: number): TouchControl {
    const g = from.spec.group;
    if (!g) return from;
    const cands: RouteCandidate[] = [];
    for (const c of this.controls.values()) {
      if (c.spec.group !== g || !c.shown || !c.placed) continue;
      const f = c.faceRect;
      cands.push({ id: c.spec.id, cx: f.x + f.w / 2, cy: f.y + f.h / 2, w: f.w, h: f.h, hit: { x: f.x - HIT_SLOP, y: f.y - HIT_SLOP, w: f.w + 2 * HIT_SLOP, h: f.h + 2 * HIT_SLOP } });
    }
    const id = routeTouch(x, y, cands, GAP_REACH);
    return (id && this.controls.get(id)) || from;
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
    this.geo = stickGeometry(h, st.buttonSize, this.decision.stick === "x" ? "x" : "2d");
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
    this.builtIn?.fullscreen.setSlot(this.builtIn.pause.shown ? "fullscreen" : "pause");
    for (const c of this.controls.values()) c.place();
    if (!this.stick) this.placeGhost();
    this.tapKeys();
    const ctx = { layer: this, game: this.game, decision: this.decision };
    for (const c of controllersFor(this.decision.mode)) c.layout?.(ctx);
  }

  private placeGhost() {
    const p = ghostStick(this.viewport, phoneSettings());
    this.stickEl.style.transform = `translate(${p.x}px,${p.y}px)`;
    this.knobEl.style.transform = "translate(0px,0px)";
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
    this.updateTaps();
    this.updateSeeThrough();
    this.updateGhost();
    const ctx = { layer: this, game: this.game, decision: this.decision };
    for (const c of controllersFor(this.decision.mode)) c.frame?.(ctx);
  }

  /** Show a decision (the mode table's, or one forced by a test). */
  apply(d: ModeDecision) {
    if (sameDecision(d, this.decision)) return;
    const prev = this.decision;
    this.decision = d;
    const modeChanged = prev.mode !== d.mode || prev.scene !== d.scene || prev.legacyPad !== d.legacyPad || prev.stick !== d.stick;
    if (modeChanged) {
      const ctx = { layer: this, game: this.game, decision: prev };
      for (const c of controllersFor(prev.mode)) c.leave?.(ctx);
      this.releaseStick();
      // edges the layer set for the old scene, never read: drop them so they can't fire somewhere else later
      const t = now();
      for (const [n, at] of this.myEdges) if (t - at < 1500) dropEdges(n);
      this.myEdges.clear();
      this.root.className = `kt ${d.mode}${d.legacyPad ? " legacy" : ""}${d.stick && !d.legacyPad ? ` stick stick-${d.stick}` : ""}`;
      if (prev.stick !== d.stick) this.geo = stickGeometry(this.viewport.h, phoneSettings().buttonSize, d.stick === "x" ? "x" : "2d");
      for (const c of controllersFor(d.mode)) c.enter?.({ layer: this, game: this.game, decision: d });
    }
    const walk = d.mode === "walk" && !d.legacyPad;
    const act = this.builtIn.action;
    if (d.action) act.setLabel(d.action);
    act.show(walk && !!d.action, true);
    this.builtIn.sanmik.show(walk && !!d.sanmik);
    const pauseWas = this.builtIn.pause.shown;
    this.builtIn.pause.show(!!d.pause && !!d.pauseButton && !d.legacyPad);
    if (pauseWas !== this.builtIn.pause.shown) this.builtIn.fullscreen.setSlot(this.builtIn.pause.shown ? "fullscreen" : "pause");
    this.builtIn.fullscreen.show(this.fsOffer && !d.legacyPad && (d.mode === "walk" || d.mode === "none" || d.mode === "tap"));
    this.capEl.style.display = this.learnedMove ? "none" : "";
    this.updateGhost();
  }

  /** Android: offer to go back into fullscreen (after the player left it). */
  setFullscreenOffer(on: boolean) {
    this.fsOffer = on;
    const d = this.decision;
    this.builtIn.fullscreen.show(on && !d.legacyPad && (d.mode === "walk" || d.mode === "none" || d.mode === "tap"));
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
          if (!this.decision.stick || this.decision.legacyPad || this.held) {
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
          if (zt && !cancelled && !zt.moved && now() - zt.t0 < TAP_MS) this.zoneTap(zt.x0, zt.y0);
        }
      }
    };
    z.addEventListener("touchend", (e) => end(e, false), { passive: false });
    z.addEventListener("touchcancel", (e) => end(e, true), { passive: false });
  }

  private startStick(t: Touch) {
    const x = t.clientX;
    const y = t.clientY;
    // floating (the default): the stick appears under the thumb; fixed: it stays at its resting place
    const fixed = phoneSettings().stick === "fixed";
    const b = fixed ? ghostStick(this.viewport, phoneSettings()) : { x, y };
    this.stick = { id: t.identifier, x0: x, y0: y, t0: now(), bx: b.x, by: b.y, moved: false, dead: false, fixed };
    this.stickEl.classList.add("live");
    this.updateGhost();
    this.stickEl.style.transform = `translate(${b.x}px,${b.y}px)`;
    this.knobEl.style.transform = "translate(0px,0px)";
    if (fixed) this.moveStick(x, y);
  }

  private moveStick(x: number, y: number) {
    const s = this.stick;
    if (!s || s.dead) return;
    if (!s.moved && Math.hypot(x - s.x0, y - s.y0) > TAP_SLOP) s.moved = true;
    const g = this.geo;
    const nb = s.fixed ? { x: s.bx, y: s.by } : followBase({ x: s.bx, y: s.by }, { x, y }, g.travel);
    if (nb.x !== s.bx || nb.y !== s.by) {
      s.bx = nb.x;
      s.by = nb.y;
      this.stickEl.style.transform = `translate(${s.bx}px,${s.by}px)`;
    }
    // (fixed: the knob stops at the rim; the direction still counts from anywhere in the zone)
    const v = stickVector(x - s.bx, y - s.by, g);
    TOUCH.mx = v.x;
    TOUCH.my = v.y;
    if (v.mag > 0.5 && !this.learnedMove) {
      this.learnedMove = true;
      this.capEl.style.display = "none";
    }
    let kx = x - s.bx;
    let ky = g.axis === "x" ? 0 : y - s.by;
    const kd = Math.hypot(kx, ky);
    if (kd > g.travel) {
      kx *= g.travel / kd;
      ky *= g.travel / kd;
    }
    this.knobEl.style.transform = `translate(${kx}px,${ky}px)`;
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
    // (only a real walk brings the resting stick back for a moment: a tap doesn't flash it up)
    if (s.moved) this.stickFreeAt = now();
    this.updateGhost();
    if (mayTap && !s.dead && !s.moved && now() - s.t0 < TAP_MS) this.zoneTap(s.x0, s.y0);
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

  /**
   * The idle stick: shown (with MOVE under it) until the player has walked with it; after that it fades away a moment
   * after the thumb lifts (nothing on screen that does nothing, research / priorities). Only in a stick mode.
   */
  private updateGhost() {
    const d = this.decision;
    const stickMode = !!d.stick && !d.legacyPad;
    const on = stickMode && !this.stick && (!this.learnedMove || now() - this.stickFreeAt < GHOST_FADE_MS);
    if (on === this.ghostOn) return;
    this.ghostOn = on;
    this.stickEl.classList.toggle("ghost", on);
  }

  // ------------------------------------------------------------------ taps: the prompt's ACTION, or the game

  /**
   * A quick still tap in the stick zone. On the prompt bubble or the thing the prompt is about: ACTION. Anywhere else:
   * handed to the game as a tap at that point (tapping a canvas button on the left half).
   */
  private zoneTap(x: number, y: number) {
    if (this.tapActs(x, y)) {
      haptic("press");
      this.edge("interact");
      return;
    }
    this.injectTap(x, y);
  }

  /** Does a tap here use the prompt's thing? */
  private tapActs(x: number, y: number): boolean {
    const d = this.decision;
    if (!promptMode(d) || !d.action || this.held) return false;
    return inRect(this.bubbleRect, x, y) || inRect(this.target?.tap, x, y);
  }

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

  /** The tap areas outside the zone (the bubble, the target): a quick still tap there is ACTION; a drag nothing. */
  private bindTap(which: "bubble" | "target") {
    const a = this.taps[which];
    const el = a.el;
    el.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        kickAudio();
        const t = e.changedTouches[0];
        if (t && !a.touch) a.touch = { id: t.identifier, x0: t.clientX, y0: t.clientY, moved: this.held };
      },
      { passive: false },
    );
    el.addEventListener(
      "touchmove",
      (e) => {
        if (e.cancelable) e.preventDefault();
        const bt = a.touch;
        if (!bt) return;
        for (const t of Array.from(e.changedTouches)) if (t.identifier === bt.id && Math.hypot(t.clientX - bt.x0, t.clientY - bt.y0) > TAP_SLOP) bt.moved = true;
      },
      { passive: false },
    );
    const end = (e: TouchEvent, cancelled: boolean) => {
      if (e.cancelable) e.preventDefault();
      const bt = a.touch;
      if (!bt) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== bt.id) continue;
        a.touch = null;
        if (!cancelled && !bt.moved && a.on && promptMode(this.decision) && this.decision.action && !this.held) {
          haptic("press");
          this.edge("interact");
        }
      }
    };
    el.addEventListener("touchend", (e) => end(e, false), { passive: false });
    el.addEventListener("touchcancel", (e) => end(e, true), { passive: false });
  }

  /** Keep the tap areas on the prompt bubble and on its target (transforms only, when they move). */
  private updateTaps() {
    let bubble: Rect | null = null;
    let target: { tap: Rect; core: Rect } | null = null;
    const d = this.decision;
    if (promptMode(d) && d.action && !d.legacyPad) {
      try {
        bubble = promptRect(this.game, d);
      } catch {
        bubble = null;
      }
      try {
        target = targetRect(this.game, d);
      } catch {
        target = null;
      }
    }
    const pad = 8;
    this.bubbleRect = bubble && bubble.w > 0 && bubble.h > 0 ? { x: bubble.x - pad, y: bubble.y - pad, w: bubble.w + 2 * pad, h: bubble.h + 2 * pad } : null;
    // (the target's tap area stays below the HUD strip, where the zone starts)
    if (target) {
      const top = this.zoneRect.y;
      const t = target.tap;
      const y0 = Math.max(t.y, top);
      target = y0 < t.y + t.h ? { tap: { x: t.x, y: y0, w: t.w, h: t.y + t.h - y0 }, core: target.core } : null;
    }
    this.target = target;
    this.tapKeys();
  }

  /** Place the two tap elements over the parts of the bubble / target that are outside the zone. */
  private tapKeys() {
    const set = (which: "bubble" | "target", r: Rect | null) => {
      const a = this.taps[which];
      const part = r ? outsideZone(r, this.zoneRect) : null;
      const on = !!part;
      if (on !== a.on) {
        a.on = on;
        a.el.classList.toggle("show", on);
        if (!on) a.touch && (a.touch.moved = true);
      }
      if (!part) return;
      const key = `${part.x.toFixed(1)},${part.y.toFixed(1)},${part.w.toFixed(1)},${part.h.toFixed(1)}`;
      if (key === a.key) return;
      a.key = key;
      a.el.style.transform = `translate(${part.x.toFixed(1)}px,${part.y.toFixed(1)}px) scale(${(part.w / 100).toFixed(3)},${(part.h / 100).toFixed(3)})`;
    };
    set("bubble", this.bubbleRect);
    set("target", this.target?.tap ?? null);
  }

  /** Controls the player, the prompt bubble or the prompt's target is under go see-through, in place (research C9). */
  private updateSeeThrough() {
    let me: Rect | null = null;
    const d = this.decision;
    if (d.mode === "walk") {
      try {
        me = playerRect(this.game, d);
      } catch {
        me = null;
      }
    }
    const core = this.target?.core ?? null;
    const extra = d.mode === "walk" ? [] : this.occluders;
    for (const c of this.controls.values()) {
      if (!c.shown || c.spec.fade === false) {
        c.setSeeThrough(false);
        continue;
      }
      c.setSeeThrough(overlaps(c.faceRect, me) || overlaps(c.faceRect, core) || overlaps(c.faceRect, this.bubbleRect) || extra.some((r) => overlaps(c.faceRect, r)));
    }
  }

  // ------------------------------------------------------------------ edges

  private edge(name: "interact" | "sanmik" | "pause") {
    if (name === "interact") pressInteract();
    else if (name === "sanmik") pressSanmik();
    this.myEdges.set(name, now());
  }

  /** Pause the way the current scene pauses (the button, the phone's back gesture, coming back to a fight). */
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
    for (const c of this.controls.values()) c.letGo();
    for (const a of Object.values(this.taps)) if (a.touch) a.touch.moved = true;
    this.flushUps(true);
    // (the old canvas pad in the dungeon, stage 1: its stick and ATTACK too, even if a conversation is over it now)
    releaseLegacyPad(this.game);
    const ctx = { layer: this, game: this.game, decision: this.decision };
    for (const c of controllersFor(this.decision.mode)) c.release?.(ctx);
  }

  /** After a release: controls work again for new touches (after a short pause). */
  rearm() {
    for (const c of this.controls.values()) c.rearm();
    const ctx = { layer: this, game: this.game, decision: this.decision };
    for (const c of controllersFor(this.decision.mode)) c.rearm?.(ctx);
  }

  destroy() {
    this.releaseAll();
    this.offSettings();
    for (const c of this.controls.values()) c.destroy();
    this.controls.clear();
    this.root.remove();
  }

  /** For tests: what the layer is showing. */
  snapshot() {
    const b = this.builtIn;
    return {
      decision: { ...this.decision },
      stick: this.stick ? { live: !this.stick.dead, x: this.stick.bx, y: this.stick.by } : null,
      ghost: this.stickEl.classList.contains("ghost"),
      buttons: { action: b.action.shown, sanmik: b.sanmik.shown, pause: b.pause.shown, fullscreen: b.fullscreen.shown },
      controls: [...this.controls.values()].map((c) => c.state()),
      actionLabel: b.action.label,
      bubble: !!this.bubbleRect,
      bubbleRect: this.bubbleRect,
      target: this.target,
      tapAreas: { bubble: this.taps.bubble.on, target: this.taps.target.on },
      zone: { ...this.zoneRect },
      slots: this.slots,
      viewport: this.viewport,
      touch: { mx: TOUCH.mx, my: TOUCH.my, enabled: TOUCH.enabled },
      pendingTaps: this.pendingUps.length,
    };
  }
}

/**
 * Modes where the prompt's bubble (and the thing it is about) can be tapped for ACTION: walking, and the top-down
 * fights (stage 2: "Tap: Untie Mollor" over the player's head does what it says, like ACTION).
 */
function promptMode(d: Pick<ModeDecision, "mode">): boolean {
  return d.mode === "walk" || d.mode === "combat";
}

/** The first touch on the layer must still unlock the sound (the game does it on its first pointerdown). */
function kickAudio() {
  try {
    if (!synth.ctx) synth.unlock();
  } catch {
    /* no audio */
  }
}

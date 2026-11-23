// PHONE MODE: readability. The game is a 960x540 picture shown at about 0.63 to 0.72 of its size on a phone, so an
// 11 px label ends up 7 to 8 CSS px and a 25 px tall menu row 18 px. Phones only:
//
//  1. A FONT FLOOR (the "Bigger text" setting, ON by default since stage 2). Every canvas text is drawn at least
//     MIN_TEXT_CSS (11) CSS px tall on the real screen (13.75 with the "large" text size): font px x the text's own
//     scale x its containers' scale x the camera zoom x the canvas scale. Applied where every Phaser Text is
//     (re)drawn (Text.updateText), so all 1,200 `add.text` calls get it without being edited; the size the game asked
//     for is kept, so turning it off puts every text back exactly. READING text (marked with `markReading()`: the
//     dialogue body, choices, Messenger pings, TV subtitles, the book and the group chat) gets READ_TEXT_CSS (16) instead,
//     and speaker names NAME_TEXT_CSS (14). The screens that would overflow are laid out for it (screens.ts,
//     dialogue.ts).
//  2. A MINIMUM TAP SIZE (always on in phone mode, whatever the text size). A touch that lands on nothing (or only on
//     a big backdrop such as a tap-anywhere zone) goes to the nearest small interactive object whose tap area, grown to
//     at least MIN_HIT_CSS (44) CSS px each way about its own middle, contains the touch. The drawing never moves, and
//     a touch that lands ON a control always goes to that control (so two close buttons can never steal each other's
//     taps: the nearest wins in the gap). The menus are spaced so every control gets its 44 px (screens.ts).
//
// The switch: the phone setting `readability` (settings.ts, default true; "Bigger text" on the Phone settings page),
// `textSize` normal / large; "?mobileread=1" / "?mobileread=0" in the address overrides it for one visit (not stored).
// On a laptop none of this is ever loaded (installMobile returns before it).
import Phaser from "phaser";
import { onPhoneSettingsChange, phoneSettings } from "./settings";
import { BACKDROP_FRAC, gamePx, growBy, MIN_HIT_CSS, minTextCss, nameTextCss, parseReadParam, readabilityWanted, readTextCss, roleTextCss, SWEEP_EVERY, textFloorPx, flooredSize, usableFactor, type Box } from "./readable";

export * from "./readable";

// ------------------------------------------------------------------ the live mechanism (phones only)

/** What a text is for: reading text and speaker names get a bigger floor than labels. */
export type TextRole = "read" | "name" | "button";

type AnyText = Phaser.GameObjects.Text & {
  __mfFactor?: number;
  __mfLast?: number;
  __mfRole?: TextRole;
  parentContainer?: Phaser.GameObjects.Container | null;
};
type AnyStyle = Phaser.GameObjects.TextStyle & { __mfReq?: number; __mfApplied?: string; fontSize: string | number };
type Bag = Record<string, any>;

let active: Readability | null = null;
let patched = false;
let reentry = false;

function patchOnce() {
  if (patched) return;
  patched = true;
  const T = Phaser.GameObjects.Text.prototype as unknown as Bag;
  const innerUpdate = T.updateText;
  T.updateText = function (this: AnyText) {
    const R = active;
    if (!R || reentry) return innerUpdate.call(this);
    return R.redraw(this, innerUpdate);
  };
  // (so a test can tell the floor was ever put in)
  T.updateText.__krelFloor = true;
  const innerScale = T.setScale;
  T.setScale = function (this: AnyText, x?: number, y?: number) {
    const r = innerScale.call(this, x, y);
    const R = active;
    if (R && R.on && !reentry) R.rescaled(this);
    return r;
  };
  const IP = Phaser.Input.InputPlugin.prototype as unknown as Bag;
  const innerHit = IP.hitTestPointer;
  IP.hitTestPointer = function (this: Bag, pointer: Phaser.Input.Pointer) {
    const over = innerHit.call(this, pointer);
    const R = active;
    if (!R || !pointer || !(pointer as unknown as Bag).wasTouch) return over;
    try {
      return R.snap(this, pointer, over);
    } catch {
      return over;
    }
  };
}

const tmpM = () => new Phaser.GameObjects.Components.TransformMatrix();

export class Readability {
  /** Is the floor (and the tap snap) on right now? */
  on = false;
  /** The address override for this visit (null: follow the setting). */
  readonly param: boolean | null;
  /** CSS px per game px (landscape). */
  k = 0.72;
  private frames = 0;
  private m1 = tmpM();
  private m2 = tmpM();
  private off: () => void;
  /** For tests / diagnostics: how many texts were raised by the last refresh, and how many snaps happened. */
  stats = { raised: 0, snaps: 0, refreshes: 0 };
  private changeListeners = new Set<() => void>();

  constructor(
    readonly game: Phaser.Game,
    search: string = typeof location !== "undefined" ? location.search : "",
  ) {
    this.param = parseReadParam(search);
    active = this;
    this.measure();
    // (the tap snap is on in phone mode whatever the text size: the patch goes in now)
    patchOnce();
    this.set(readabilityWanted(phoneSettings().readability, this.param));
    this.off = onPhoneSettingsChange((s, changed) => {
      if (changed.includes("readability")) this.set(readabilityWanted(s.readability, this.param));
      else if (changed.includes("textSize") && this.on) {
        this.refreshAll();
        this.changed();
      }
    });
  }

  /** The floor in CSS px now. */
  get minCss(): number {
    return minTextCss(phoneSettings().textSize);
  }

  /** The reading size in CSS px now (16, or 20 with large text). */
  get readCss(): number {
    return readTextCss(phoneSettings().textSize);
  }

  /** Game px a layout needs to show `css` CSS px at the canvas scale now (e.g. 44 for a tap row). */
  gameFor(css: number): number {
    return gamePx(this.k, css);
  }

  /**
   * The reading font for a layout (game px, at scale 1): READ_TEXT_CSS when the floor is on, else `fallback` (what
   * the game itself uses). Layouts that re-flow for reading text call this.
   */
  readPx(fallback: number): number {
    return this.on ? Math.max(fallback, gamePx(this.k, this.readCss)) : fallback;
  }

  /** The speaker-name font (game px): NAME_TEXT_CSS when the floor is on, else `fallback`. */
  namePx(fallback: number): number {
    return this.on ? Math.max(fallback, gamePx(this.k, nameTextCss(phoneSettings().textSize))) : fallback;
  }

  /** Something that lays itself out for the floor (screens.ts, dialogue.ts): told when the floor changes. */
  onChange(fn: () => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  private changed() {
    for (const fn of [...this.changeListeners]) {
      try {
        fn();
      } catch {
        /* one broken layout must not stop the others */
      }
    }
  }

  /** Turn it on or off (every text on every scene is redrawn at once, both ways). */
  set(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    if (on) patchOnce();
    if (patched) this.refreshAll();
    this.changed();
  }

  /** Every game frame (phones only). */
  frame() {
    if (!this.on) return;
    if (++this.frames % SWEEP_EVERY) return;
    if (this.measure()) {
      this.refreshAll();
      this.changed();
    } else this.sweep();
  }

  /** Re-read the canvas scale; true when the floor changed (Safari's bars came or went). Upright is ignored. */
  measure(): boolean {
    const sc = this.game.scale;
    const cb = sc?.canvasBounds;
    if (!cb || !cb.width || !sc.width) return false;
    if (typeof window !== "undefined" && window.innerHeight > window.innerWidth) return false;
    const k = cb.width / sc.width;
    const before = textFloorPx(this.k, 1, this.minCss);
    this.k = k;
    return textFloorPx(k, 1, this.minCss) !== before;
  }

  // ---------------------------------------------------------------- the font floor

  private requested(st: AnyStyle): number {
    const cur = String(st.fontSize);
    if (st.__mfApplied !== undefined && cur === st.__mfApplied && typeof st.__mfReq === "number") return st.__mfReq;
    st.__mfReq = undefined;
    st.__mfApplied = undefined;
    return parseFloat(cur) || 16;
  }

  /** The floor for one text (game px): reading text and names get theirs, everything else the label floor. */
  floorFor(t: AnyText): number {
    return textFloorPx(this.k, t.__mfFactor ?? 1, roleTextCss(t.__mfRole, phoneSettings().textSize));
  }

  /** Text.updateText, phones with readability ever turned on. */
  redraw(t: AnyText, inner: (this: AnyText) => unknown): unknown {
    const st = t.style as AnyStyle | undefined;
    if (!st || !t.scene || (!this.on && st.__mfApplied === undefined)) return inner.call(t);
    const req = this.requested(st);
    const want = flooredSize(req, this.floorFor(t), this.on);
    const cur = parseFloat(String(st.fontSize)) || 16;
    if (Math.abs(cur - want) < 0.01) return inner.call(t);
    st.fontSize = `${want}px`;
    st.__mfReq = req;
    st.__mfApplied = st.fontSize;
    reentry = true;
    try {
      // rebuilds the font string and its metrics, then draws (through the inner updateText)
      st.update(true);
    } finally {
      reentry = false;
    }
    if (want > req) this.stats.raised++;
    return t;
  }

  /** The text's total scale now: its own, its containers', the camera's zoom. */
  factorNow(t: AnyText): number {
    let s = Math.abs(t.scaleY || 0);
    for (let p = t.parentContainer; p; p = p.parentContainer) s *= Math.abs(p.scaleY || 0);
    const z = (t.scene as Phaser.Scene | undefined)?.cameras?.main?.zoom || 1;
    return s * z;
  }

  private tweening(t: AnyText): boolean {
    try {
      const tw = (t.scene as Phaser.Scene).tweens;
      if (tw.isTweening(t)) return true;
      for (let p = t.parentContainer; p; p = p.parentContainer) if (tw.isTweening(p)) return true;
    } catch {
      return false;
    }
    return false;
  }

  /** setScale on a text: a deliberate size, take it into account at once. */
  rescaled(t: AnyText) {
    if (!t.scene || this.tweening(t)) return;
    const f = usableFactor(this.factorNow(t));
    t.__mfLast = f;
    if (Math.abs(f - (t.__mfFactor ?? 1)) < 0.02) return;
    t.__mfFactor = f;
    t.updateText();
  }

  /** Every few frames: texts whose scale (or camera zoom) has settled at a new value get their floor again. */
  private sweep() {
    this.eachText(true, (t) => {
      const f = usableFactor(this.factorNow(t));
      const last = t.__mfLast;
      t.__mfLast = f;
      if (last === undefined || Math.abs(f - last) > 0.02) return; // still changing: wait for it to settle
      if (Math.abs(f - (t.__mfFactor ?? 1)) < 0.02 || this.tweening(t)) return;
      t.__mfFactor = f;
      t.updateText();
    });
  }

  /** Redraw every text in every scene (turning on, off, a new floor). */
  refreshAll() {
    this.stats.refreshes++;
    this.stats.raised = 0;
    this.eachText(false, (t) => {
      if (this.on && !this.tweening(t)) t.__mfFactor = usableFactor(this.factorNow(t));
      t.updateText();
    });
  }

  private eachText(visibleOnly: boolean, fn: (t: AnyText) => void) {
    const walk = (o: Bag) => {
      if (!o || o.active === false) return;
      if (visibleOnly && o.visible === false) return;
      if (o instanceof Phaser.GameObjects.Text) {
        try {
          fn(o as AnyText);
        } catch {
          /* a text mid-destroy */
        }
      } else if (o instanceof Phaser.GameObjects.Container) for (const c of o.list) walk(c as Bag);
    };
    for (const sc of this.game.scene.scenes as Phaser.Scene[]) {
      const sys = sc.sys;
      if (!sys || !sys.displayList) continue;
      if (visibleOnly && !(sys.isActive() || sys.isPaused()) ) continue;
      for (const o of sys.displayList.list) walk(o as Bag);
    }
  }

  // ---------------------------------------------------------------- the tap snap

  private isBackdrop(go: Bag, cam: Phaser.Cameras.Scene2D.Camera): boolean {
    const r = hitBox(go);
    if (!r) return false;
    const [sx, sy] = this.worldScale(go, cam);
    return r.w * sx >= BACKDROP_FRAC * this.game.scale.width && r.h * sy >= BACKDROP_FRAC * this.game.scale.height;
  }

  private worldScale(go: Bag, cam: Phaser.Cameras.Scene2D.Camera): [number, number] {
    const z = cam.zoom || 1;
    if (go.parentContainer) {
      const m = go.getWorldTransformMatrix(this.m1, this.m2) as Phaser.GameObjects.Components.TransformMatrix;
      return [Math.abs(m.scaleX) * z, Math.abs(m.scaleY) * z];
    }
    return [Math.abs(go.scaleX ?? 1) * z, Math.abs(go.scaleY ?? 1) * z];
  }

  /** InputPlugin.hitTestPointer, for touches: the nearest small control within its grown tap area. */
  snap(plugin: Bag, pointer: Phaser.Input.Pointer, over: Bag[]): Bag[] {
    const cams = plugin.cameras?.getCamerasBelowPointer?.(pointer) as Phaser.Cameras.Scene2D.Camera[] | undefined;
    const cam = (over.length ? (pointer.camera as Phaser.Cameras.Scene2D.Camera) : cams?.[0]) ?? plugin.cameras?.main;
    if (!cam) return over;
    if (over.some((o) => !this.isBackdrop(o, cam))) return over;
    const mgr = plugin.manager as Bag;
    const list = plugin._list as Bag[] | undefined;
    if (!list || !list.length) return over;
    const minGame = MIN_HIT_CSS / (this.k || 0.72);
    const wp = cam.getWorldPoint(pointer.x, pointer.y);
    const pt = new Phaser.Math.Vector2();
    let best: Bag | null = null;
    let bestD = Infinity;
    let bestLocal = { x: 0, y: 0 };
    for (const go of list) {
      if (over.includes(go) || !go.input || go.input.dropZone) continue;
      if (!mgr.inputCandidate(go, cam)) continue;
      const r = hitBox(go);
      if (!r) continue;
      const [sx, sy] = this.worldScale(go, cam);
      if (!sx || !sy) continue;
      const { ex, ey } = growBy({ w: r.w * sx, h: r.h * sy }, minGame, minGame);
      if (ex === 0 && ey === 0) continue;
      const px = wp.x + cam.scrollX * go.scrollFactorX - cam.scrollX;
      const py = wp.y + cam.scrollY * go.scrollFactorY - cam.scrollY;
      if (go.parentContainer) go.getWorldTransformMatrix(this.m1, this.m2).applyInverse(px, py, pt);
      else Phaser.Math.TransformXY(px, py, go.x, go.y, go.rotation, go.scaleX, go.scaleY, pt);
      const lx = pt.x + (go.displayOriginX ?? 0);
      const ly = pt.y + (go.displayOriginY ?? 0);
      const gx = ex / sx;
      const gy = ey / sy;
      if (lx < r.x - gx || lx > r.x + r.w + gx || ly < r.y - gy || ly > r.y + r.h + gy) continue;
      const dx = Math.max(r.x - lx, 0, lx - (r.x + r.w)) * sx;
      const dy = Math.max(r.y - ly, 0, ly - (r.y + r.h)) * sy;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = go;
        bestLocal = { x: Math.min(r.x + r.w, Math.max(r.x, lx)), y: Math.min(r.y + r.h, Math.max(r.y, ly)) };
      }
    }
    if (!best) return over;
    best.input.localX = bestLocal.x;
    best.input.localY = bestLocal.y;
    pointer.camera = cam;
    this.stats.snaps++;
    return [...over, best];
  }

  destroy() {
    this.off();
    if (active === this) active = null;
  }
}

/** An interactive object's tap area in its own space (rectangle; a circle's bounding square), or null. */
function hitBox(go: Bag): Box | null {
  const h = go.input?.hitArea as Bag | undefined;
  if (!h) return null;
  if (typeof h.width === "number" && typeof h.height === "number") return { x: h.x ?? 0, y: h.y ?? 0, w: h.width, h: h.height };
  if (typeof h.radius === "number") return { x: (h.x ?? 0) - h.radius, y: (h.y ?? 0) - h.radius, w: h.radius * 2, h: h.radius * 2 };
  return null;
}

/** The running mechanism (phones only), or null. */
export function readability(): Readability | null {
  return active;
}

/**
 * Mark a text as reading text ("read": 16 CSS px) or a speaker name ("name": 14) for the floor (null: a label again).
 * Phones only (the floor only exists there); harmless on a text that is already marked. Redraws it at once when the
 * floor is on.
 */
export function markReading(t: Phaser.GameObjects.Text | null | undefined, role: TextRole | null = "read") {
  const a = t as AnyText | null | undefined;
  if (!a || (a.__mfRole ?? null) === role) return;
  a.__mfRole = role ?? undefined;
  if (active?.on && a.scene) {
    try {
      a.updateText();
    } catch {
      /* a text mid-destroy */
    }
  }
}

// PHONE MODE: tap a thing to use it (stage 3, the user's top priority). In every walking scene (Home, the town,
// Kreddle, the Club, the Venue), a tap on a thing or a person walks the player there by the scene's own walking (the
// same speed and collisions as the stick: this only moves the stick's numbers, TOUCH.mx / my) and then uses it with
// the same edge ACTION sends. A tap on the floor walks there. Already in reach: used at once.
//
//   tap ──► pick (tapLogic.pickTarget over tapTargets' list) ──► route (tapLogic.findPath over the colliders)
//       ──► each frame: steer along it; the scene's prompt names the thing → ACTION; the stick, a conversation, a
//           menu, a cutscene, the page hiding → stop at once.
//
// Laptops never load this file (it is in the phone chunk).
import Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { pressInteract } from "./observe";
import { verbFromPrompt, type ModeDecision } from "./modes";
import type { Rect } from "./layout";
import { haptic } from "./haptics";
import { buildGrid, findPath, pickTarget, steer, type Pt } from "./tapLogic";
import { readWalk, tapScene, type WalkRead, type WorldTarget } from "./tapTargets";
import { registerModeController, TAP_MS, TAP_SLOP, type TouchLayer } from "./touchLayer";

/** A tap is at least this big on the page around a small thing (research: 44 CSS px), plus a little slop. */
export const TAP_MIN_CSS = 44;
export const TAP_PAD_CSS = 6;
/** Give up on a walk after this long (something keeps the player from getting there). */
const WALK_MAX_MS = 15000;
/** No nearer by 3 px in this long: stuck (route again, at most twice, then stop where you are). */
const STUCK_MS = 650;
/** After arriving, how long to wait for the scene's prompt to name the thing before stopping. */
const SETTLE_MS = 350;
/** The stick counts as moved (and takes over) past this much of its travel. */
const STICK_TAKES_OVER = 0.15;

interface Walk {
  read: WalkRead;
  target: WorldTarget | null;
  /** The goal, in plan space. */
  goal: Pt;
  path: Pt[];
  idx: number;
  t0: number;
  best: number;
  bestAt: number;
  replans: number;
  arrivedAt: number;
}

type Bag = Record<string, unknown>;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class TapUse {
  readonly game: Phaser.Game;
  readonly layer: TouchLayer;
  /** For tests: what happened last ("use" | "walk" | "floor" | "near" | "stick" | "mode" | "stuck" | "gone" | ...). */
  last: { what: string; key?: string; tag?: string; at: number } = { what: "", at: 0 };
  stats = { taps: 0, uses: 0, walks: 0, cancels: 0, routes: 0, routeMs: 0 };
  private walk: Walk | null = null;
  private ring: HTMLDivElement;
  private tag: HTMLDivElement;
  private dot: HTMLDivElement;
  private ringKey = "";
  private canvasTouches = new Map<number, { x0: number; y0: number; t0: number; moved: boolean }>();
  private wroteStick = false;

  constructor(game: Phaser.Game, layer: TouchLayer) {
    this.game = game;
    this.layer = layer;
    const mk = (cls: string) => {
      const e = document.createElement("div");
      e.className = cls;
      layer.root.insertBefore(e, layer.root.firstChild);
      return e;
    };
    this.dot = mk("ktu-dot");
    this.ring = mk("ktu-ring");
    this.tag = document.createElement("div");
    this.tag.className = "ktu-tag";
    layer.root.insertBefore(this.tag, this.ring.nextSibling);
    layer.worldTap = this;
    registerModeController({
      id: "tapuse",
      mode: "walk",
      frame: () => this.frame(),
      leave: () => {
        this.cancel("mode");
        if (!this.ring.classList.contains("used")) this.hideRing();
      },
      release: () => this.cancel("release"),
    });
    this.bindCanvas();
  }

  // ------------------------------------------------------------------ where taps come from

  /** Does tap-to-use run in this decision (a walking scene with things to tap; not a fight, not the shoving match)? */
  covers(d: ModeDecision): boolean {
    if (d.mode !== "walk" || d.legacyPad || d.action === "SHOVE" || d.input === "pad") return false;
    return tapScene(this.game, d.scene);
  }

  /**
   * A still tap on the page (CSS px) in a walking scene. Returns true if it meant something here (a thing, a person,
   * the floor); false leaves it to the game as before (a canvas button, a HUD tap).
   */
  tap(x: number, y: number): boolean {
    const d = this.layer.decision;
    if (this.layer.held || !this.covers(d)) return false;
    if (this.gameWants(x, y)) return false;
    const read = readWalk(this.game, d.scene);
    const sc = d.scene ? (this.game.scene.getScene(d.scene) as Phaser.Scene | null) : null;
    if (!read || !read.free || !sc) return false;
    const w = this.toWorld(sc, x, y);
    const k = this.pageScale(sc);
    if (!w || !k) return false;
    this.stats.taps++;
    const i = pickTarget(read.targets, w.x, w.y, TAP_MIN_CSS / k, TAP_PAD_CSS / k);
    if (i >= 0) {
      const t = read.targets[i];
      haptic("press");
      // already in reach (the prompt names it): use it now
      if (read.prompt && t.is(read.prompt)) {
        this.stop(false);
        this.use(t, read);
        this.flash(sc, t, true);
        return true;
      }
      this.start(read, t, t.goal);
      this.flash(sc, t, false);
      return true;
    }
    // the floor: walk there (not from the HUD strip along the top, and not onto yourself)
    if (y < this.layer.zoneRect.y) return false;
    const goal = { x: Math.min(read.area.x + read.area.w, Math.max(read.area.x, w.x - read.off.x)), y: Math.min(read.area.y + read.area.h, Math.max(read.area.y, w.y - read.off.y)) };
    if (Math.hypot(goal.x - read.me.x, goal.y - read.me.y) < 12) return true;
    haptic("tap");
    this.start(read, null, goal);
    this.flash(sc, null, false);
    return true;
  }

  /** Something of the game's own is under this point (a canvas button): the game gets the tap, not the walker. */
  private gameWants(x: number, y: number): boolean {
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / this.game.scale.width;
    if (!k) return false;
    const gx = (x - cb.x) / k;
    const gy = (y - cb.y) / k;
    for (const sc of this.game.scene.getScenes(true) as Phaser.Scene[]) {
      const list = ((sc.input as unknown as Bag | undefined)?._list as unknown[] | undefined) ?? [];
      const cam = sc.cameras?.main;
      if (!cam) continue;
      for (const o of list) {
        const g = o as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.GetBounds & { visible?: boolean; scrollFactorX?: number; scrollFactorY?: number; parentContainer?: { visible?: boolean } | null; input?: { enabled?: boolean } };
        if (!g.active || g.visible === false || !g.input?.enabled || g.parentContainer?.visible === false || typeof g.getBounds !== "function") continue;
        const b = g.getBounds();
        const sfx = g.scrollFactorX ?? 1;
        const sfy = g.scrollFactorY ?? 1;
        const z = cam.zoom || 1;
        const x0 = (b.x - cam.scrollX * sfx - cam.width / 2) * z + cam.x + cam.width / 2;
        const y0 = (b.y - cam.scrollY * sfy - cam.height / 2) * z + cam.y + cam.height / 2;
        if (gx >= x0 && gx <= x0 + b.width * z && gy >= y0 && gy <= y0 + b.height * z) return true;
      }
    }
    return false;
  }

  /** Taps that land on the canvas itself (outside the stick zone and the layer's controls). */
  private bindCanvas() {
    const cv = this.game.canvas;
    if (!cv) return;
    cv.addEventListener(
      "touchstart",
      (e) => {
        for (const t of Array.from(e.changedTouches)) this.canvasTouches.set(t.identifier, { x0: t.clientX, y0: t.clientY, t0: now(), moved: false });
      },
      { passive: true },
    );
    cv.addEventListener(
      "touchmove",
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          const c = this.canvasTouches.get(t.identifier);
          if (c && Math.hypot(t.clientX - c.x0, t.clientY - c.y0) > TAP_SLOP) c.moved = true;
        }
      },
      { passive: true },
    );
    const end = (e: TouchEvent, cancelled: boolean) => {
      for (const t of Array.from(e.changedTouches)) {
        const c = this.canvasTouches.get(t.identifier);
        this.canvasTouches.delete(t.identifier);
        if (c && !cancelled && !c.moved && now() - c.t0 < TAP_MS) this.tap(c.x0, c.y0);
      }
    };
    cv.addEventListener("touchend", (e) => end(e, false), { passive: true });
    cv.addEventListener("touchcancel", (e) => end(e, true), { passive: true });
  }

  // ------------------------------------------------------------------ walking there

  private start(read: WalkRead, target: WorldTarget | null, goalMe: Pt) {
    const goal = { x: goalMe.x + read.off.x, y: goalMe.y + read.off.y };
    const t = now();
    this.walk = { read, target, goal, path: [], idx: 0, t0: t, best: Infinity, bestAt: t, replans: 0, arrivedAt: 0 };
    this.route(read);
    this.stats.walks++;
    this.note(target ? "walk" : "floor", target);
  }

  /** (Re)plan from where the player is now. */
  private route(read: WalkRead) {
    const w = this.walk;
    if (!w) return;
    const t0 = now();
    const from = { x: read.me.x + read.off.x, y: read.me.y + read.off.y };
    if (!read.blockers.length) w.path = [{ x: Math.min(read.area.x + read.area.w, Math.max(read.area.x, w.goal.x)), y: Math.min(read.area.y + read.area.h, Math.max(read.area.y, w.goal.y)) }];
    else {
      const grid = buildGrid(read.area, read.blockers, read.half, 16);
      w.path = findPath(grid, from, w.goal).points;
    }
    w.idx = 0;
    w.best = Infinity;
    w.bestAt = now();
    this.stats.routes++;
    this.stats.routeMs = Math.max(this.stats.routeMs, now() - t0);
  }

  private frame() {
    const w = this.walk;
    if (!w) {
      this.fadeRing();
      return;
    }
    const d = this.layer.decision;
    // the stick takes over at once
    const raw = this.layer.stickRaw;
    if (raw && Math.hypot(raw.x, raw.y) > STICK_TAKES_OVER) return this.cancel("stick", false);
    if (this.layer.held) return this.cancel("held");
    const read = readWalk(this.game, d.scene);
    if (!read || read.key !== w.read.key || !read.free) return this.cancel("mode");
    const t = now();
    let target: WorldTarget | null = null;
    if (w.target) {
      const was = w.target;
      target = read.targets.find((x) => (was.src !== undefined ? x.src === was.src : x.key === was.key)) ?? null;
      if (!target) return this.cancel("gone");
      w.target = target;
      // in reach: the scene's prompt names it → use it, exactly as ACTION would
      if (read.prompt && target.is(read.prompt)) {
        this.stop(true);
        this.use(target, read);
        return;
      }
      // someone walking about: follow them
      if (target.moving) {
        const g = { x: target.goal.x + read.off.x, y: target.goal.y + read.off.y };
        if (Math.hypot(g.x - w.goal.x, g.y - w.goal.y) > 24) {
          w.goal = g;
          this.route(read);
        }
      }
    }
    const at = { x: read.me.x + read.off.x, y: read.me.y + read.off.y };
    const s = steer(at, w.path, w.idx, 10, 5);
    w.idx = s.idx;
    const left = w.path.length ? Math.hypot(w.path[w.path.length - 1].x - at.x, w.path[w.path.length - 1].y - at.y) : 0;
    if (s.done || !w.path.length) {
      this.writeStick(0, 0);
      if (!w.target) return this.finish("arrived");
      if (!w.arrivedAt) w.arrivedAt = t;
      if (t - w.arrivedAt > SETTLE_MS) this.finish("near");
      this.place(read);
      return;
    }
    // stuck against something: route again, twice, then stop as close as we got (the prompt shows what's there)
    if (left < w.best - 3) {
      w.best = left;
      w.bestAt = t;
    } else if (t - w.bestAt > STUCK_MS) {
      if (w.replans++ < 2) this.route(read);
      else return this.finish("stuck");
    }
    if (t - w.t0 > WALK_MAX_MS) return this.finish("timeout");
    this.writeStick(s.x, s.y);
    this.place(read);
  }

  private use(t: WorldTarget, read: WalkRead) {
    const verb = read.prompt ? verbFromPrompt(read.prompt) : null;
    this.note(verb ? "use" : "near", t);
    if (!verb) return;
    pressInteract();
    this.stats.uses++;
  }

  private writeStick(x: number, y: number) {
    TOUCH.mx = x;
    TOUCH.my = y;
    this.wroteStick = x !== 0 || y !== 0;
  }

  /** Stop walking (the stick's numbers back to rest, unless the stick itself has them now). */
  private stop(used: boolean) {
    if (this.walk && this.wroteStick) this.writeStick(0, 0);
    this.walk = null;
    this.dot.classList.remove("show");
    this.tag.classList.remove("show");
    if (used) this.usedFlash();
  }

  /** A white flash on the thing as it is used, fading out by itself, whatever opens next. */
  private usedFlash() {
    this.ring.classList.add("used");
    setTimeout(() => {
      if (!this.walk) this.ring.classList.remove("show", "used");
    }, 450);
  }

  private finish(why: string) {
    this.note(why, this.walk?.target ?? null);
    this.stop(false);
  }

  /** Something else takes over (the stick, a conversation or menu, the page hiding): stop at once. */
  cancel(why: string, zero = true) {
    if (!this.walk) return;
    this.stats.cancels++;
    this.note(why, this.walk.target);
    if (!zero) this.wroteStick = false;
    this.stop(false);
    this.hideRing();
  }

  private hideRing() {
    this.ring.classList.remove("show", "used");
    this.tag.classList.remove("show");
    this.ringHideAt = 0;
  }

  /** For tests and the smoke test: what the walker is doing. */
  state() {
    const w = this.walk;
    return { walking: !!w, target: w?.target?.key ?? null, tag: w?.target?.tag ?? null, path: w ? w.path.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) : [], last: { ...this.last }, stats: { ...this.stats }, ring: this.ring.classList.contains("show"), dot: this.dot.classList.contains("show") };
  }

  /** For tests: the things tappable in the walking scene now (world coordinates). */
  debugTargets(): { key: string; tag: string; core: Rect; goal: Pt; low: boolean }[] {
    const read = readWalk(this.game, this.layer.decision.scene);
    return read ? read.targets.map((t) => ({ key: t.key, tag: t.tag, core: { ...t.core }, goal: { ...t.goal }, low: !!t.low })) : [];
  }

  private note(what: string, t: WorldTarget | null) {
    this.last = { what, key: t?.key, tag: t?.tag, at: now() };
  }

  // ------------------------------------------------------------------ feedback: the ring, its tag, the floor marker

  /** The tapped thing lights up at once (inside the touch handler: the same frame), the floor marker shows the goal. */
  private flash(sc: Phaser.Scene, t: WorldTarget | null, used: boolean) {
    this.ringKey = "";
    this.ring.classList.remove("used", "show");
    this.tag.classList.remove("show");
    if (t) {
      // (restart the pop animation)
      void this.ring.offsetWidth;
      this.ring.classList.add("show");
      if (used) this.usedFlash();
      this.tag.textContent = t.tag;
      if (t.tag && !used) this.tag.classList.add("show");
      this.placeRing(sc, t.core);
    }
    this.ringHideAt = 0;
    const w = this.walk;
    if (w && !used) {
      const p = this.toPage(sc, w.goal.x - w.read.off.x, w.goal.y - w.read.off.y);
      if (p) {
        this.dot.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
        void this.dot.offsetWidth;
        this.dot.classList.add("show");
      }
    } else this.dot.classList.remove("show");
  }

  private ringHideAt = 0;

  /** Keep the ring on its thing (people move, the town's camera follows the player) and the marker on the floor. */
  private place(read: WalkRead) {
    const sc = this.game.scene.getScene(read.key) as Phaser.Scene | null;
    const w = this.walk;
    if (!sc || !w) return;
    if (w.target) this.placeRing(sc, w.target.core);
    const p = this.toPage(sc, w.goal.x - read.off.x, w.goal.y - read.off.y);
    if (p) this.dot.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
  }

  private placeRing(sc: Phaser.Scene, core: Rect) {
    const a = this.toPage(sc, core.x, core.y);
    const b = this.toPage(sc, core.x + core.w, core.y + core.h);
    if (!a || !b) return;
    // (at least a thumb's size, like the tap area)
    let w = Math.max(b.x - a.x, TAP_MIN_CSS);
    let h = Math.max(b.y - a.y, TAP_MIN_CSS);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    w += 8;
    h += 8;
    const key = `${cx.toFixed(0)},${cy.toFixed(0)},${w.toFixed(0)},${h.toFixed(0)}`;
    if (key === this.ringKey) return;
    this.ringKey = key;
    this.ring.style.width = `${w.toFixed(0)}px`;
    this.ring.style.height = `${h.toFixed(0)}px`;
    this.ring.style.transform = `translate(${(cx - w / 2).toFixed(1)}px,${(cy - h / 2).toFixed(1)}px)`;
    const tagY = Math.max(4, cy - h / 2 - 24);
    this.tag.style.transform = `translate(${cx.toFixed(1)}px,${tagY.toFixed(1)}px) translateX(-50%)`;
  }

  /** After a stop, the ring goes by itself a moment later. */
  private fadeRing() {
    if (!this.ring.classList.contains("show") || this.ring.classList.contains("used")) return;
    if (!this.ringHideAt) this.ringHideAt = now() + 450;
    if (now() >= this.ringHideAt) this.hideRing();
  }

  // ------------------------------------------------------------------ page ↔ world (the way Phaser draws it)

  private pageScale(sc: Phaser.Scene): number {
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / this.game.scale.width;
    return k * (sc.cameras?.main?.zoom || 1);
  }

  private toWorld(sc: Phaser.Scene, px: number, py: number): Pt | null {
    const cam = sc.cameras?.main;
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / this.game.scale.width;
    if (!cam || !k) return null;
    const z = cam.zoom || 1;
    const gx = (px - cb.x) / k;
    const gy = (py - cb.y) / k;
    return { x: (gx - cam.x - cam.width / 2) / z + cam.width / 2 + cam.scrollX, y: (gy - cam.y - cam.height / 2) / z + cam.height / 2 + cam.scrollY };
  }

  private toPage(sc: Phaser.Scene, x: number, y: number): Pt | null {
    const cam = sc.cameras?.main;
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / this.game.scale.width;
    if (!cam || !k) return null;
    const z = cam.zoom || 1;
    return { x: cb.x + ((x - cam.scrollX - cam.width / 2) * z + cam.x + cam.width / 2) * k, y: cb.y + ((y - cam.scrollY - cam.height / 2) * z + cam.y + cam.height / 2) * k };
  }
}

/** The ring, its tag and the floor marker (phones only; added with the rest of the phone CSS). */
export const TAP_USE_CSS = `
.ktu-ring{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;opacity:0;
  border:3px solid rgba(255,210,63,.95);box-shadow:0 0 0 2px rgba(0,0,0,.45),0 0 14px rgba(255,210,63,.55),inset 0 0 10px rgba(255,210,63,.35)}
.ktu-ring.show{opacity:1;animation:ktu-pop .2s ease-out}
.ktu-ring.used{border-color:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.45),0 0 22px rgba(255,255,255,.8);transition:opacity .4s;opacity:0}
.ktu-tag{position:absolute;left:0;top:0;pointer-events:none;opacity:0;white-space:nowrap;max-width:60vw;overflow:hidden;
  text-overflow:ellipsis;padding:3px 8px;border-radius:9px;background:rgba(10,6,20,.78);color:#ffd23f;font-size:13px;
  line-height:16px;text-shadow:0 1px 2px #000;box-shadow:0 0 0 1px rgba(255,210,63,.5)}
.ktu-tag.show{opacity:1}
.ktu-dot{position:absolute;left:0;top:0;width:30px;height:12px;margin:-6px 0 0 -15px;border-radius:50%;pointer-events:none;
  opacity:0;border:2px solid rgba(255,255,255,.75);background:rgba(255,255,255,.18);box-shadow:0 0 0 1px rgba(0,0,0,.35)}
.ktu-dot.show{opacity:1;animation:ktu-dot .9s ease-out infinite}
@keyframes ktu-pop{from{opacity:0;scale:.6}to{opacity:1;scale:1}}
@keyframes ktu-dot{0%{scale:.6}60%{scale:1.1}100%{scale:1}}
`;

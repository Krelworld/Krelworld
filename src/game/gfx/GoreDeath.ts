import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { G } from "../G";
import { BIT, MEATY, type Bit } from "../combat/KrelArt";
import { vfx, type VfxOpts } from "./Vfx";
import * as Juice from "./Juice";

/**
 * Cutscene deaths, staged properly: `goreDeath(scene, actor, kind, opts)`.
 *
 * The actor is left alone (hidden, its tweens stopped) and a corpse sprite takes its place in the same container (or
 * at the same depth), so everything here follows the camera rigs and stage containers the scenes already use. All the
 * blood, bits and the corpse are cleaned up with the actor when it is destroyed.
 *
 * Kinds:
 *  - shot      bullet impacts (hit-stop, a white flash on the body, the jerk), blood out of the back, then the body goes
 *              in stages: the knees, a slump, the fall, a twitch, and a pool spreading under it.
 *  - headshot  one round, and the top of the head comes off in chunks (cut from the character's own sprite), a neck
 *              fountain, the body stands there a beat too long, then goes.
 *  - blast     torn apart: the sprite is cut into chunks that fly, bounce and leave smears, with gibs off kp_bits.
 *  - crushed   flattened under whatever the scene dropped on them: a squirt out of both sides, an eye rolls away.
 *  - burned    on fire, flailing, charring black, down into a smoking heap (a skull and bones left in it).
 *  - fart      shot, and then the death fart (or, on someone already dead, just the death fart): the belly swells, the
 *              body jolts, a huge green-brown cloud, flies, a stain, the screen fogs.
 *  - collapse  no wound: the knees go and they fold up and fall (a heart attack, the life going out of someone).
 *
 * Characters with a drawn death (PixelLab, public/art/gore, see DRAWN) play their own frames, on-model, and the
 * effects are timed to them. Lads with death frames on their sheets use those for the fall.
 *
 * Gore off (G.meta.settings.gore === false): the same staging with no blood, no bits and no pool: impacts are hit
 * sparks and dust, a blast leaves a sooty cartoon figure that keels over, crushed is a pancake with stars, burned is
 * charred and smoking with no skull. Reduce flashing (calmFlash): the red flash is faint and slow (Juice.flash).
 */
export type GoreKind = "shot" | "headshot" | "blast" | "crushed" | "burned" | "fart" | "collapse";

export type Actor = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

export interface GoreOpts {
  /** x of the shooter / the blast, in the actor's own coordinate space: the body is knocked away from it */
  fromX?: number;
  /** or the direction the body is knocked (1 right, -1 left); default away from fromX, else right */
  dir?: 1 | -1;
  /** bullet impacts before the collapse (shot / fart; default 3) */
  hits?: number;
  /** ms between impacts (default 120) */
  gap?: number;
  /** wait this long first (ms) */
  delay?: number;
  /** where the floor is (the actor's coordinate space; default the actor's feet) */
  floorY?: number;
  /** comedic timing: longer holds, a twitch, a sad trombone */
  comedy?: boolean;
  /** use this drawn death sheet (DRAWN key) instead of the one matched by texture; false for none */
  drawn?: string | false;
  /** no red screen flash or camera shake (crowd deaths: the scene does its own) */
  quiet?: boolean;
  /** no blood pool (the body falls behind something) */
  noPool?: boolean;
  /** outside: nothing behind them for the blood to hit */
  outdoors?: boolean;
  /** some of it hits the lens (screen splats) */
  lens?: boolean;
  /** depth for an actor that isn't in a container (default the actor's own depth) */
  depth?: number;
  /** crushed: drop this texture on them first (it stays on top of what's left) */
  dropKey?: string;
}

/** A drawn death: one row of frames, 128x128, drawn from the character's own art so it lines up with their sprite. */
interface DrawnDeath {
  file: string;
  /** frames in the sheet (frame 0 is the reference pose) */
  frames: number;
  fw: number;
  fh: number;
  /** ms per frame (one each, or one for all) */
  ms: number[] | number;
  /** frames on which a round lands */
  hitFrames: number[];
  /** the frame the body lands on (the floor shakes, the pool starts) */
  landFrame: number;
  /** where the wounds are, as a fraction of the frame */
  chest: [number, number];
  /** sheet pixels per pixel of the actor's frame (both drawn at the same scale: 1) */
  k?: number;
  /** the pool, as a fraction of the frame (default under the chest, at the bottom) */
  pool?: [number, number] | null;
  /** gore off: the same frames with the blood painted out (else the drawn death is skipped) */
  clean?: string;
  /** gore off, no clean frames: the desk's top edge (frame px): they jerk and slump down behind it */
  deskTop?: number;
  /** a puff of dust where they land (not for someone going down behind a desk) */
  dust?: boolean;
  /** where the death fart comes out (fraction of the frame), when lying down */
  rear?: [number, number];
}

/** The drawn deaths, by the actor's texture. Kind-specific entries are `<kind>:<texture>`. */
const DRAWN: Record<string, DrawnDeath> = {
  // the KrelTV journalist at her desk: riddled, jerking, slides down behind the desk (the desk is in the frame)
  tvanchor_JOURNALIST: { file: "gore/gd_journo_shot.png", frames: 13, fw: 128, fh: 128, ms: [60, 70, 70, 70, 70, 70, 90, 110, 130, 150, 170, 200, 260], hitFrames: [2, 3, 4, 5, 6], landFrame: 11, chest: [0.5, 0.62], pool: null, dust: false, deskTop: 104 },
  // fat Polson: gut-shot, clutches it, wobbles, goes over backwards like a wardrobe
  spr_POLSON_FAT: { file: "gore/gd_polson_shot.png", frames: 13, fw: 128, fh: 128, ms: [60, 90, 140, 160, 160, 170, 170, 170, 180, 200, 140, 120, 400], hitFrames: [1], landFrame: 11, chest: [0.5, 0.78], pool: [0.5, 0.97], rear: [0.5, 0.86], clean: "gore/gd_polson_shot_clean.png" },
};
/** The drawn death fart (after the drawn fall), by texture. */
const DRAWN_FART: Record<string, DrawnDeath> = {
  spr_POLSON_FAT: { file: "gore/gd_polson_fart.png", frames: 9, fw: 128, fh: 128, ms: 120, hitFrames: [], landFrame: 4, chest: [0.5, 0.8], rear: [0.5, 0.86], clean: "gore/gd_polson_fart_clean.png" },
};

const sheetKey = (d: DrawnDeath) => d.file.replace(/^.*\//, "").replace(/\.png$/, "");

/** Load the drawn deaths with the rest of the art (BootScene's preload can call this; goreDeath loads lazily too). */
export function loadGoreArt(load: Phaser.Loader.LoaderPlugin, src: (f: string) => string = (f) => `art/${f}`) {
  for (const d of [...Object.values(DRAWN), ...Object.values(DRAWN_FART)].flatMap((d) => (d.clean ? [d, { ...d, file: d.clean }] : [d]))) {
    const key = sheetKey(d);
    if (!load.textureManager.exists(key)) load.spritesheet(key, src(d.file), { frameWidth: d.fw, frameHeight: d.fh });
  }
}

/** Fetch a drawn death's sheet if it isn't loaded (resolves false if it can't be had in time). */
function ensureSheet(sc: Phaser.Scene, d: DrawnDeath): Promise<boolean> {
  const key = sheetKey(d);
  if (sc.textures.exists(key)) return Promise.resolve(true);
  return new Promise((res) => {
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      res(sc.textures.exists(key));
    };
    sc.load.spritesheet(key, `art/${d.file}`, { frameWidth: d.fw, frameHeight: d.fh });
    sc.load.once(Phaser.Loader.Events.COMPLETE, fin);
    sc.time.delayedCall(2500, fin);
    sc.load.start();
  });
}

const goreOn = () => G.meta?.settings?.gore !== false;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** The texture's scale factor (gfx/HD.ts applies it when scale is set; reads return the real scale). */
const hdOf = (o: Actor) => ((o.texture?.customData as { hd?: number } | undefined)?.hd ?? 1) * ((o as unknown as { big?: number }).big ?? 1);
/** Set the real (on-screen) scale, whatever the texture's factor. */
const setReal = (o: Actor, sx: number, sy = sx) => o.setScale(sx / hdOf(o), sy / hdOf(o));

/** The visible box of a frame (alpha > 0), in frame pixels. Cached. */
const BOXES = new Map<string, { x: number; y: number; w: number; h: number }>();
function visibleBox(sc: Phaser.Scene, o: Actor) {
  const key = `${o.texture.key}#${o.frame.name}`;
  const have = BOXES.get(key);
  if (have) return have;
  const fw = o.frame.width;
  const fh = o.frame.height;
  let x0 = fw;
  let y0 = fh;
  let x1 = 0;
  let y1 = 0;
  const st = fw * fh > 20000 ? 3 : 2;
  try {
    for (let y = 0; y < fh; y += st)
      for (let x = 0; x < fw; x += st) {
        const a = sc.textures.getPixelAlpha(x, y, o.texture.key, o.frame.name);
        if (a && a > 16) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
  } catch {
    /* no pixel access: use the whole frame */
  }
  const box = x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0 + st, h: y1 - y0 + st } : { x: 0, y: 0, w: fw, h: fh };
  BOXES.set(key, box);
  return box;
}

// ------------------------------------------------------------------ hit-stop

/** Freeze the scene's tweens and timers for `ms` real milliseconds (nested calls share one freeze). */
export function hitStop(sc: Phaser.Scene, ms: number) {
  if (ms <= 0 || !sc.sys?.isActive()) return;
  const st = sc as unknown as { __gdHS?: { n: number; tw: number; tm: number } | null };
  if (!st.__gdHS) {
    st.__gdHS = { n: 0, tw: sc.tweens.timeScale, tm: sc.time.timeScale };
    sc.tweens.timeScale = 0.02;
    sc.time.timeScale = 0.02;
  }
  st.__gdHS.n++;
  window.setTimeout(() => {
    const h = st.__gdHS;
    if (!h) return;
    if (--h.n > 0) return;
    st.__gdHS = null;
    if (!sc.sys || !sc.sys.settings.active) return;
    sc.tweens.timeScale = h.tw;
    sc.time.timeScale = h.tm;
  }, ms);
}

// ------------------------------------------------------------------ the stage

/** Everything one death needs: where to put things, where the body is, and the clean-up list. */
class Stage {
  readonly gore = goreOn();
  readonly parent: Phaser.GameObjects.Container | null;
  readonly keep: Phaser.GameObjects.GameObject[] = [];
  readonly depth: number;
  body!: Phaser.GameObjects.Sprite;
  dir: 1 | -1 = 1;
  floor = 0;

  constructor(
    readonly sc: Phaser.Scene,
    readonly actor: Actor,
    readonly o: GoreOpts,
  ) {
    this.parent = actor.parentContainer ?? null;
    this.depth = o.depth ?? actor.depth;
    actor.once(Phaser.GameObjects.Events.DESTROY, () => this.clear());
  }

  clear() {
    for (const g of this.keep) if (g.active) g.destroy();
    this.keep.length = 0;
  }

  wait(ms: number) {
    return new Promise<void>((r) => this.sc.time.delayedCall(Math.max(0, ms), () => r()));
  }

  tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((r) => this.sc.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  /** Put an object in the actor's world: in its container (above or below the body), or at a depth near it. */
  put<T extends Phaser.GameObjects.GameObject>(g: T, layer: "over" | "under" | "top" = "over", keep = true): T {
    const d = g as unknown as Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.ScrollFactor;
    if (this.parent) {
      const ref = this.body?.parentContainer === this.parent ? this.body : this.actor;
      const at = this.parent.getIndex(ref);
      if (layer === "top") this.parent.add(g);
      else this.parent.addAt(g, layer === "under" ? Math.max(0, at) : at + 1);
    } else {
      d.setDepth?.(this.depth + (layer === "under" ? -0.5 : layer === "top" ? 6 : 2));
      const sf = this.actor.scrollFactorX;
      if (sf !== 1) d.setScrollFactor?.(sf, this.actor.scrollFactorY);
    }
    if (keep) this.keep.push(g);
    return g;
  }

  /** A drawn effect, placed like put() (it removes itself when done unless held). */
  fx(key: string, x: number, y: number, o: VfxOpts = {}, layer: "over" | "under" | "top" = "over") {
    const s = vfx(this.sc, key, x, y, o);
    if (!s) return null;
    // looping effects (stars, fire) don't end on their own: give them a life
    if (!o.hold && this.sc.anims.get(key)?.repeat === -1) this.sc.time.delayedCall((o.delay ?? 0) + (key === "vfx_fire" ? 2600 : 1400), () => s.active && this.sc.tweens.add({ targets: s, alpha: 0, duration: 300, onComplete: () => s.destroy() }));
    return this.put(s, layer, !!o.hold);
  }

  /** The on-screen scale of the body's container (to size screen-ish effects). */
  get k() {
    let k = 1;
    for (let p = this.parent; p; p = p.parentContainer) k *= p.scaleX;
    return k;
  }

  /** The actor swapped for a corpse sprite, feet at the origin. */
  makeBody(): Phaser.GameObjects.Sprite {
    const a = this.actor;
    const prev = a.getData?.("gd_body") as Phaser.GameObjects.Sprite | undefined;
    if (prev?.active) {
      this.body = prev;
      return prev;
    }
    const sc = this.sc;
    const b = sc.add.sprite(a.x, a.y, a.texture.key, a.frame.name);
    b.setFlipX(a.flipX).setFlipY(a.flipY).setAlpha(a.alpha);
    b.setOrigin(a.originX, a.originY);
    setReal(b, a.scaleX, a.scaleY);
    if (a.isTinted) b.setTint(a.tintTopLeft);
    if (this.parent) this.parent.addAt(b, this.parent.getIndex(a) + 1);
    else {
      b.setDepth(this.depth);
      b.setScrollFactor(a.scrollFactorX, a.scrollFactorY);
    }
    // stand them on their feet, so they fold up and fall from the floor
    if (b.originY !== 1) {
      const dh = b.displayHeight;
      b.setOrigin(b.originX, 1);
      b.y = a.y + (1 - a.originY) * dh;
    }
    sc.tweens.killTweensOf(a);
    if (a instanceof Phaser.GameObjects.Sprite) a.anims?.stop();
    a.setVisible(false);
    a.setData("gd_body", b);
    this.keep.push(b);
    this.body = b;
    return b;
  }

  /** Points on the body, in the actor's coordinate space (from its visible pixels). */
  spots() {
    const b = this.body;
    const box = visibleBox(this.sc, b);
    const sx = Math.abs(b.scaleX);
    const sy = Math.abs(b.scaleY);
    const fw = b.frame.width;
    const fh = b.frame.height;
    const cxF = box.x + box.w / 2 - fw * b.originX;
    const x = b.x + (b.flipX ? -cxF : cxF) * sx;
    const top = b.y - (fh - box.y) * sy;
    const h = box.h * sy;
    const w = box.w * sx;
    return { x, top, h, w, feet: b.y, head: top + h * 0.12, chest: top + h * 0.36, gut: top + h * 0.52 };
  }

  // -------------------------------------------------------------- the juice

  redFlash(alpha = 0.35, ms = 220) {
    if (this.o.quiet) return;
    if (this.gore) Juice.flash(this.sc, 0xb91c1c, ms, alpha, 4980);
    else Juice.flash(this.sc, 0xffffff, ms, alpha * 0.6, 4980);
  }

  shake(ms: number, k: number) {
    if (!this.o.quiet) Juice.shake(this.sc, ms, k);
  }

  /** A white flash on the body (the impact frame). */
  blink(ms = 45) {
    const b = this.body;
    const was = b.isTinted ? b.tintTopLeft : null;
    b.setTintFill(0xffffff);
    this.sc.time.delayedCall(ms, () => {
      if (!b.active) return;
      if (was !== null) b.setTint(was);
      else b.clearTint();
    });
  }

  /** Drops that fly, fall to the floor and stay there as small splats. */
  drops(x: number, y: number, n: number, o: { dir?: number; speed?: number; color?: number; size?: number; spread?: number } = {}) {
    const k = this.k > 0 ? 1 / this.k : 1;
    for (let i = 0; i < n; i++) {
      const col = o.color ?? pick([0xb91c1c, 0x7f1d1d, 0xdc2626, 0x991b1b]);
      const s = (o.size ?? 4) * rnd(0.6, 1.4) * k;
      const r = this.put(this.sc.add.rectangle(x, y, s, s, col), "over", false);
      const sp = (o.speed ?? 260) * rnd(0.4, 1.1) * k;
      const a = o.dir !== undefined ? (o.dir > 0 ? 0 : Math.PI) + rnd(-0.9, 0.5) * (o.dir > 0 ? 1 : -1) : rnd(-Math.PI, 0);
      const vx = Math.cos(a) * sp + rnd(-1, 1) * (o.spread ?? 0);
      const vy = Math.sin(a) * sp;
      const floor = this.floor + rnd(-4, 6) * k;
      const st = { t: 0 };
      const dur = rnd(500, 900);
      this.sc.tweens.add({
        targets: st,
        t: dur / 1000,
        duration: dur,
        onUpdate: () => r.setPosition(x + vx * st.t, Math.min(floor, y + vy * st.t + 700 * k * st.t * st.t)),
        onComplete: () => {
          if (!r.active) return;
          if (r.y >= floor - 1 && this.gore && o.color === undefined) {
            r.setSize(s * 2.2, s * 0.8).setFillStyle(0x7f1d1d, 0.9);
            this.keep.push(r);
          } else this.sc.tweens.add({ targets: r, alpha: 0, duration: 300, onComplete: () => r.destroy() });
        },
      });
    }
  }

  /** One piece of kp_bits (or a blob of colour) flung on an arc to the floor, spinning, bouncing once. */
  gib(name: Bit, x: number, y: number, size: number, vx: number, vy: number, stay = true) {
    const k = this.k > 0 ? 1 / this.k : 1;
    const g: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = this.sc.textures.exists("kp_bits")
      ? this.sc.add.image(x, y, "kp_bits", BIT[name]).setScale((size * k) / 32)
      : this.sc.add.circle(x, y, (size * k) / 4, 0x991b1b);
    this.put(g, "over", false);
    const floor = this.floor + rnd(-6, 8) * k;
    const st = { t: 0 };
    const spin = rnd(-900, 900);
    const dur = rnd(700, 1100);
    vx *= k;
    vy *= k;
    this.sc.tweens.add({
      targets: st,
      t: dur / 1000,
      duration: dur,
      onUpdate: () => {
        const ny = y + vy * st.t + 900 * k * st.t * st.t;
        g.setPosition(x + vx * st.t, Math.min(floor, ny));
        if (ny < floor) g.setAngle(spin * st.t);
      },
      onComplete: () => {
        if (!g.active) return;
        // a little bounce and a smear where it lands
        this.sc.tweens.add({ targets: g, y: g.y - 8 * k, yoyo: true, duration: 110, ease: "Quad.out" });
        if (this.gore && Math.random() < 0.5) this.smear(g.x, floor + 2 * k, 0.5);
        if (stay) this.keep.push(g);
        else this.sc.tweens.add({ targets: g, alpha: 0, delay: 1500, duration: 500, onComplete: () => g.destroy() });
      },
    });
    return g;
  }

  /** A flat smear of blood on the floor. */
  smear(x: number, y: number, s = 1) {
    const k = this.k > 0 ? 1 / this.k : 1;
    const e = this.put(this.sc.add.ellipse(x, y, 26 * s * k, 7 * s * k, 0x7f1d1d, 0.85), "under");
    e.setScale(0.2);
    this.sc.tweens.add({ targets: e, scale: 1, duration: 300, ease: "Quad.out" });
  }

  /** A pool of blood that keeps spreading under the body. */
  pool(x: number, y: number, size = 1, ms = 2600) {
    if (!this.gore || this.o.noPool) return;
    const k = this.k > 0 ? 1 / this.k : 1;
    const w = this.spots().w;
    const pw = Math.min(Math.max(40 * k, w * 0.8), 170 * k) * size;
    const e = this.put(this.sc.add.ellipse(x, y, pw, pw * 0.22, 0x6b0f14, 0.92), "under");
    const hi = this.put(this.sc.add.ellipse(x - pw * 0.12, y - 2 * k, pw * 0.35, pw * 0.06, 0xb91c1c, 0.7), "under");
    e.setScale(0.08);
    hi.setScale(0.08);
    this.sc.tweens.add({ targets: [e, hi], scale: 1, duration: ms, ease: "Sine.out" });
    this.fx("vfx_bloodpool", x, y, { scale: (pw / (90 * k)) * k, hold: true, delay: 200, alpha: 0.9 }, "under");
  }

  /** Blood on the wall/backdrop behind someone (the exit wounds). */
  backSplat(x: number, y: number, dir: number, n = 5) {
    if (!this.gore || this.o.outdoors) return;
    const k = this.k > 0 ? 1 / this.k : 1;
    for (let i = 0; i < n; i++) {
      const cx = x + dir * rnd(10, 60) * k;
      const cy = y + rnd(-30, 20) * k;
      const blob = this.put(this.sc.add.circle(cx, cy, rnd(3, 9) * k, pick([0x991b1b, 0x7f1d1d, 0xb91c1c]), 0.9), "under");
      blob.setScale(0.1);
      this.sc.tweens.add({ targets: blob, scale: 1, duration: 90 });
      // and it runs down
      if (Math.random() < 0.6) {
        const run = this.put(this.sc.add.rectangle(cx, cy, 2.5 * k, 2 * k, 0x7f1d1d, 0.85).setOrigin(0.5, 0), "under");
        this.sc.tweens.add({ targets: run, displayHeight: rnd(14, 40) * k, duration: rnd(1500, 3000), ease: "Sine.out" });
      }
    }
  }

  /** Blood spots on the screen (some of it hits the lens). */
  lens(n = 3) {
    if (!this.gore || !this.o.lens) return;
    for (let i = 0; i < n; i++) {
      const x = rnd(100, 860);
      const y = rnd(60, 380);
      const c = this.sc.add.container(x, y).setScrollFactor(0).setDepth(4960);
      const r = rnd(14, 34);
      c.add(this.sc.add.circle(0, 0, r, 0x7f1d1d, 0.75));
      for (let j = 0; j < 5; j++) c.add(this.sc.add.circle(rnd(-r, r) * 1.3, rnd(-r, r) * 1.3, rnd(2, 6), 0x991b1b, 0.7));
      const drip = this.sc.add.rectangle(rnd(-r / 2, r / 2), r * 0.5, 4, 4, 0x7f1d1d, 0.7).setOrigin(0.5, 0);
      c.add(drip);
      this.sc.tweens.add({ targets: drip, displayHeight: rnd(40, 120), duration: 2600 });
      this.sc.tweens.add({ targets: c, alpha: 0, delay: 3200, duration: 1500, onComplete: () => c.destroy() });
    }
  }

  // -------------------------------------------------------------- the bullet

  /** One round lands: hit-stop, a flash on the body, the jerk, blood out of the back (or sparks, gore off). */
  impact(x: number, y: number, big = 1, blink = true) {
    const sc = this.sc;
    const k = this.k > 0 ? 1 / this.k : 1;
    hitStop(sc, Math.round(40 + 30 * big));
    if (blink) this.blink();
    synth.play(pick(["squelch", "hit", "splat"]));
    if (this.gore) {
      if (Math.random() < 0.6) synth.play("blood_spray");
      // in the front, out of the back
      this.fx("vfx_blood", x, y, { scale: 1.1 * big * k, flipX: this.dir < 0 });
      this.fx("vfx_bloodspray", x + this.dir * 8 * k, y, { scale: 1.5 * big * k, flipX: this.dir < 0 });
      this.drops(x, y, Math.round(6 * big), { dir: this.dir, speed: 320 });
      this.backSplat(x, y, this.dir, Math.round(2 + 2 * big));
    } else {
      this.fx("vfx_hit", x, y, { scale: 1.2 * big * k });
      this.fx("vfx_dust", x, y, { scale: 0.8 * k });
    }
  }

  /** The jerk: knocked back, twisted, and (if `stay`) left a little further over. */
  jerk(amount = 1) {
    const b = this.body;
    const x0 = b.x;
    const a0 = b.angle;
    this.sc.tweens.add({ targets: b, x: x0 + (this.dir * 7 * amount) / Math.max(this.k, 0.01), angle: a0 + this.dir * rnd(6, 12) * amount, duration: 55, yoyo: true, ease: "Quad.out", onComplete: () => b.active && b.setAngle(a0 + this.dir * 2) });
  }

  // -------------------------------------------------------------- the fall

  /** Lads with death frames on their sheets: play them (true), else false. */
  async sheetFall(): Promise<boolean> {
    const b = this.body;
    const m = (b.texture.customData as { char?: { death?: Record<string, number[]> } } | undefined)?.char;
    const cyc = m?.death?.east ?? m?.death?.south;
    if (!cyc?.length) return false;
    for (const f of cyc) {
      if (!b.active) return true;
      b.setFrame(f);
      await this.wait(110);
    }
    return true;
  }

  /** Knees, slump, fall, land, twitch. `heavy` slows it (a wardrobe going over). */
  async stagedFall(heavy = 1) {
    const b = this.body;
    if (!b.active) return;
    const sx = Math.abs(b.scaleX) / hdOf(b);
    const sy = Math.abs(b.scaleY) / hdOf(b);
    const fx = b.scaleX < 0 ? -1 : 1;
    const comedy = !!this.o.comedy;
    const ft = this.dir;
    // the knees go
    synth.play(pick(["groan", "gurgle"]));
    await this.tween({ targets: b, scaleY: sy * 0.84, scaleX: fx * sx * 1.05, angle: -ft * 5, duration: 200 * heavy, ease: "Quad.out" });
    // a wobble (longer, for the laugh)
    await this.tween({ targets: b, angle: ft * 4, duration: (comedy ? 220 : 120) * heavy, yoyo: true, repeat: comedy ? 2 : 0, ease: "Sine.inOut" });
    if (await this.sheetFall()) {
      setReal(b, b.scaleX < 0 ? -sx * hdOf(b) : sx * hdOf(b), sy * hdOf(b));
      b.setAngle(0);
      this.land();
      return;
    }
    // the slump
    await this.tween({ targets: b, scaleY: sy * 0.72, angle: ft * 16, x: b.x + ft * 4, duration: 240 * heavy, ease: "Quad.in" });
    // and over
    const lift = b.displayWidth * 0.14;
    await this.tween({ targets: b, angle: ft * 90, scaleY: sy * 0.9, x: b.x + ft * b.displayHeight * 0.18, y: b.y - lift, duration: 330 * heavy, ease: "Quad.in" });
    this.land();
    await this.tween({ targets: b, angle: ft * 84, y: b.y - 6, duration: 90, yoyo: true, ease: "Quad.out" });
    if (comedy) {
      await this.wait(400);
      await this.tween({ targets: b, angle: ft * 87, duration: 60, yoyo: true, repeat: 2 });
    }
  }

  land() {
    const s = this.spots();
    synth.play("bodies_land");
    this.shake(260, 0.012);
    this.fx("vfx_dust", s.x, this.floor, { scale: 1.4 / Math.max(this.k, 0.01) });
  }
}

// ------------------------------------------------------------------ the kinds

async function shot(st: Stage, hits: number, big = 1) {
  const gap = st.o.gap ?? 120;
  st.redFlash(0.3, 200);
  st.shake(200, 0.01);
  for (let i = 0; i < hits; i++) {
    const s = st.spots();
    st.impact(s.x + rnd(-0.15, 0.15) * s.w, s.chest + rnd(-0.1, 0.25) * s.h, big);
    st.jerk(1 + (i === hits - 1 ? 0.6 : 0));
    await st.wait(gap);
  }
  if (!st.gore) synth.play("hurt_1");
}

async function drawnDeath(st: Stage, d: DrawnDeath) {
  const b = st.body;
  const a = st.actor;
  const key = sheetKey(d);
  const k = d.k ?? 1;
  b.setTexture(key, 0);
  b.setOrigin(0.5, 1);
  setReal(b, Math.abs(a.scaleX) * k, Math.abs(a.scaleY) * k);
  b.setFlipX(a.flipX);
  const sx = Math.abs(b.scaleX);
  const sy = Math.abs(b.scaleY);
  const at = (f: [number, number]) => ({ x: b.x + (f[0] - 0.5) * d.fw * sx * (b.flipX ? -1 : 1), y: b.y - (1 - f[1]) * d.fh * sy });
  st.redFlash(0.32, 220);
  st.shake(240, 0.012);
  for (let f = 1; f < d.frames; f++) {
    if (!b.active) return;
    b.setFrame(f);
    if (d.hitFrames.includes(f)) {
      const c = at(d.chest);
      // (the drawn frames carry their own impact flashes)
      st.impact(c.x + rnd(-14, 14) * sx, c.y + rnd(-14, 18) * sy, 1.1, false);
    }
    if (f === d.landFrame) {
      if (d.dust === false) {
        synth.play("bodies_land");
        st.shake(200, 0.01);
      } else st.land();
      if (d.pool) {
        const p = at(d.pool);
        st.pool(p.x, p.y, 1.2);
      }
    }
    const ms = Array.isArray(d.ms) ? d.ms[Math.min(f, d.ms.length - 1)] : d.ms;
    await st.wait(ms * (st.o.comedy && f > d.landFrame - 3 ? 1.3 : 1));
  }
}

/** Gore off, at a desk: the rounds hit (sparks), she jerks, and slumps down out of sight behind it. */
async function deskSlump(st: Stage, deskTop: number) {
  const sc = st.sc;
  const b = st.body;
  const fw = b.frame.width;
  const fh = b.frame.height;
  // the desk, cut off the frame and laid over her
  const desk = sc.add.image(b.x, b.y, b.texture.key, b.frame.name).setOrigin(b.originX, 1).setFlipX(b.flipX);
  setReal(desk, Math.abs(b.scaleX), Math.abs(b.scaleY));
  desk.setCrop(0, deskTop, fw, fh - deskTop);
  st.put(desk, "over");
  b.setCrop(0, 0, fw, deskTop);
  const hits = st.o.hits ?? 3;
  for (let i = 0; i < hits; i++) {
    const s = st.spots();
    st.impact(s.x + rnd(-0.12, 0.12) * s.w, s.top + s.h * rnd(0.35, 0.6), 1);
    st.jerk(1);
    await st.wait(st.o.gap ?? 110);
  }
  synth.play("hurt_1");
  const y0 = b.y;
  const sy = Math.abs(b.scaleY);
  // the slump: back in the chair, then down, the crop shrinking as she goes below the desk's edge
  await st.tween({ targets: b, angle: -st.dir * 6, y: y0 + 6 * sy, duration: 260, ease: "Quad.out" });
  const y1 = b.y;
  const drop = { d: 0 };
  await st.tween({
    targets: drop,
    d: deskTop,
    duration: 700,
    ease: "Quad.in",
    onUpdate: () => {
      if (!b.active) return;
      b.y = y1 + drop.d * sy;
      b.setCrop(0, 0, fw, Math.max(0, deskTop - drop.d - 6));
    },
  });
  b.setVisible(false);
  synth.play("bodies_land");
  st.shake(200, 0.01);
}

async function headshot(st: Stage) {
  const sc = st.sc;
  const b = st.body;
  const s = st.spots();
  const k = st.k > 0 ? 1 / st.k : 1;
  hitStop(sc, 130);
  st.redFlash(0.45, 260);
  st.shake(300, 0.02);
  synth.play("gun_sniper");
  st.blink(70);
  if (!st.gore) {
    // gore off: a ringing BONK, their head snaps back, stars, and down they go
    st.fx("vfx_hit", s.x, s.head, { scale: 1.6 * k });
    st.fx("vfx_stars", s.x, s.head - 10 * k, { scale: 1.4 * k });
    synth.play("whack_bonk");
    await st.tween({ targets: b, angle: st.dir * 14, duration: 80, yoyo: true });
    await st.wait(st.o.comedy ? 700 : 300);
    await st.stagedFall();
    return;
  }
  synth.play("splat");
  synth.play("bonecrack");
  synth.play("flesh_rip");
  // the top of the head comes off, cut from their own sprite
  const box = visibleBox(sc, b);
  const fw = b.frame.width;
  const fh = b.frame.height;
  const cut = box.y + box.h * 0.27;
  const pieces = 3;
  for (let i = 0; i < pieces; i++) {
    const cw = box.w / pieces;
    const chunk = sc.add.image(b.x, b.y, b.texture.key, b.frame.name).setOrigin(b.originX, 1).setFlipX(b.flipX);
    setReal(chunk, Math.abs(b.scaleX), Math.abs(b.scaleY));
    chunk.setCrop(box.x + cw * i, box.y, cw + 1, cut - box.y);
    if (b.isTinted) chunk.setTint(b.tintTopLeft);
    st.put(chunk, "over");
    const vx = st.dir * rnd(80, 260) + (i - 1) * 70;
    const st2 = { t: 0 };
    const x0 = chunk.x;
    const y0 = chunk.y;
    const dur = rnd(800, 1100);
    const floorOff = st.floor - (y0 - (fh - cut) * Math.abs(b.scaleY));
    sc.tweens.add({
      targets: st2,
      t: dur / 1000,
      duration: dur,
      onUpdate: () => {
        const dy = -420 * k * st2.t + 1100 * k * st2.t * st2.t;
        chunk.setPosition(x0 + vx * k * st2.t, y0 + Math.min(dy, floorOff + 20 * k));
        chunk.setAngle(st.dir * 700 * st2.t);
      },
    });
  }
  // the rest of them stands there without it
  b.setCrop(0, cut, fw, fh - cut);
  st.fx("vfx_gore", s.x, s.head, { scale: 1.6 * k });
  st.fx("vfx_bloodspray", s.x + st.dir * 10 * k, s.head, { scale: 2 * k, flipX: st.dir < 0 });
  for (const n of ["brain", "eyeball", "skull", "jaw", "tooth", "eyeball2", "brain"] as Bit[]) st.gib(n, s.x, s.head, rnd(14, 22), st.dir * rnd(60, 300), rnd(-420, -200));
  st.drops(s.x, s.head, 14, { speed: 380 });
  st.backSplat(s.x, s.head, st.dir, 8);
  st.lens(3);
  // the neck fountain
  const neck = { x: s.x, y: s.top + s.h * 0.27 };
  const fount = sc.time.addEvent({
    delay: 70,
    loop: true,
    callback: () => {
      if (!b.active) return;
      const n = st.spots();
      const ny = b.angle === 0 ? neck.y : n.chest;
      st.drops(b.angle === 0 ? neck.x : n.x, ny, 2, { speed: 260, spread: 40 });
    },
  });
  synth.play("gurgle");
  await st.wait(st.o.comedy ? 1300 : 700);
  await st.tween({ targets: b, angle: -st.dir * 6, duration: 160, yoyo: true });
  await st.stagedFall();
  fount.remove();
  const p = st.spots();
  st.pool(p.x, st.floor, 1.3);
}

async function blast(st: Stage) {
  const sc = st.sc;
  const b = st.body;
  const s = st.spots();
  const k = st.k > 0 ? 1 / st.k : 1;
  hitStop(sc, 150);
  st.redFlash(0.5, 300);
  st.shake(450, 0.03);
  synth.play("explode");
  synth.play("boom");
  if (!st.fx("vfx_boom", s.x, s.chest, { scale: 2 * k, add: true }, "top")) st.fx("vfx_bigboom", s.x, s.chest, { scale: 1.4 * k }, "top");
  st.fx("vfx_blastsmoke", s.x, s.chest, { scale: 1.6 * k, delay: 120 }, "top");
  if (!st.gore) {
    // gore off: a sooty cartoon figure, hair on end, a puff of smoke, a blink, and over
    b.setTint(0x2b2b2b);
    await st.tween({ targets: b, x: b.x + st.dir * 10 * k, duration: 80, yoyo: true, repeat: 2 });
    const puff = st.fx("vfx_smoke", s.x, s.head, { scale: 1.2 * k }, "top");
    void puff;
    synth.play("pfft");
    await st.wait(st.o.comedy ? 900 : 500);
    await st.stagedFall();
    const scorch = st.put(sc.add.ellipse(s.x, st.floor, s.w * 1.4, 10 * k, 0x111111, 0.5), "under");
    void scorch;
    return;
  }
  synth.play("flesh_rip");
  synth.play("bonecrack");
  synth.play("splat");
  // torn apart: the sprite in chunks (3 across, 4 down), off on their own arcs
  const box = visibleBox(sc, b);
  const fh = b.frame.height;
  const sx = Math.abs(b.scaleX);
  const sy = Math.abs(b.scaleY);
  const cols = 3;
  const rows = 4;
  const cw = box.w / cols;
  const rh = box.h / rows;
  b.setVisible(false);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const chunk = sc.add.image(b.x, b.y, b.texture.key, b.frame.name).setOrigin(b.originX, 1).setFlipX(b.flipX);
      setReal(chunk, sx, sy);
      chunk.setCrop(box.x + cw * c, box.y + rh * r, cw + 1, rh + 1);
      chunk.setTint(pick([0xffd0d0, 0xffb0b0, 0xff9a9a]));
      st.put(chunk, "over");
      // a chunk's own middle, for its arc
      const lx = (box.x + cw * (c + 0.5) - b.frame.width * b.originX) * sx * (b.flipX ? -1 : 1);
      const ly = -(fh - (box.y + rh * (r + 0.5))) * sy;
      const vx = (st.dir * rnd(120, 420) + (c - 1) * rnd(80, 200)) * k;
      const vy = -rnd(300, 620) * k;
      const spin = rnd(-1100, 1100);
      const t = { t: 0 };
      const dur = rnd(900, 1300);
      const x0 = chunk.x;
      const y0 = chunk.y;
      const groundAt = st.floor - y0 - ly - 6 * k;
      sc.tweens.add({
        targets: t,
        t: dur / 1000,
        duration: dur,
        onUpdate: () => {
          const dy = vy * t.t + 1300 * k * t.t * t.t;
          const landed = dy >= groundAt;
          chunk.setPosition(x0 + vx * t.t, y0 + Math.min(dy, groundAt));
          if (!landed) chunk.setAngle(spin * t.t);
        },
        onComplete: () => {
          if (!chunk.active) return;
          st.smear(chunk.x + lx, st.floor + 2 * k, 0.8);
        },
      });
    }
  for (let i = 0; i < 16; i++) st.gib(pick(MEATY), s.x + rnd(-10, 10) * k, s.chest + rnd(-20, 20) * k, rnd(14, 24), rnd(-1, 1) * 380 + st.dir * 120, -rnd(260, 620));
  st.fx("vfx_gore", s.x, s.chest, { scale: 2.2 * k });
  st.fx("vfx_bloodspray", s.x, s.chest, { scale: 2.4 * k });
  st.fx("vfx_bloodspray", s.x, s.chest, { scale: 2.2 * k, flipX: true });
  st.drops(s.x, s.chest, 30, { speed: 520 });
  st.lens(5);
  // it rains for a second
  for (let i = 0; i < 18; i++)
    sc.time.delayedCall(300 + i * 50, () => {
      if (!st.actor.scene) return;
      st.drops(s.x + rnd(-160, 160) * k, s.top - 120 * k, 1, { speed: 40 });
    });
  st.put(sc.add.ellipse(s.x, st.floor, s.w * 1.8, 14 * k, 0x1c1917, 0.55), "under");
  await st.wait(900);
  st.pool(s.x, st.floor, 1.5, 3000);
  await st.wait(500);
}

async function crushed(st: Stage) {
  const sc = st.sc;
  const b = st.body;
  const s = st.spots();
  const k = st.k > 0 ? 1 / st.k : 1;
  // whatever it is comes down on them
  if (st.o.dropKey && sc.textures.exists(st.o.dropKey)) {
    const rock = sc.add.image(s.x, s.top - 260 * k, st.o.dropKey).setOrigin(0.5, 1);
    rock.setScale((s.w * 1.3) / rock.width);
    rock.setAngle(rnd(-20, 20));
    st.put(rock, "top");
    await st.tween({ targets: rock, y: st.floor - s.h * 0.08, angle: rnd(-8, 8), duration: 320, ease: "Quad.in" });
    st.fx("vfx_dust", s.x, st.floor, { scale: 1.5 * k }, "top");
  }
  hitStop(sc, 90);
  st.redFlash(0.3, 200);
  st.shake(300, 0.022);
  synth.play("smash");
  const sx = Math.abs(b.scaleX) / hdOf(b);
  const sy = Math.abs(b.scaleY) / hdOf(b);
  const fx = b.scaleX < 0 ? -1 : 1;
  if (!st.gore) {
    // a pancake, with stars
    synth.play("whack_bonk");
    await st.tween({ targets: b, scaleY: sy * 0.25, scaleX: fx * sx * 1.5, duration: 90, ease: "Quad.in" });
    st.fx("vfx_dust", s.x, st.floor, { scale: 1.6 * k });
    st.fx("vfx_stars", s.x, st.floor - 30 * k, { scale: 1.2 * k });
    await st.wait(st.o.comedy ? 700 : 400);
    return;
  }
  synth.play("bonecrack");
  synth.play("splat");
  await st.tween({ targets: b, scaleY: sy * 0.14, scaleX: fx * sx * 1.65, duration: 80, ease: "Quad.in" });
  b.setTint(0xff9090);
  // out of both sides
  st.fx("vfx_bloodspray", s.x + 20 * k, st.floor - 8 * k, { scale: 1.8 * k });
  st.fx("vfx_bloodspray", s.x - 20 * k, st.floor - 8 * k, { scale: 1.8 * k, flipX: true });
  st.fx("vfx_gore", s.x, st.floor - 10 * k, { scale: 1.5 * k });
  st.drops(s.x, st.floor - 6 * k, 16, { dir: 1, speed: 360 });
  st.drops(s.x, st.floor - 6 * k, 16, { dir: -1, speed: 360 });
  for (let i = 0; i < 6; i++) st.gib(pick(["meat", "bonebroken", "tooth", "finger", "guts"] as Bit[]), s.x, st.floor - 10 * k, rnd(12, 20), rnd(-320, 320), -rnd(120, 300));
  // an eye pops out and rolls away
  const eye = st.gib("eyeball", s.x, st.floor - 8 * k, 16, st.dir * 120, -260);
  sc.time.delayedCall(1100, () => eye?.active && sc.tweens.add({ targets: eye, x: eye.x + st.dir * 60 * k, angle: st.dir * 720, duration: 1400, ease: "Quad.out" }));
  st.pool(s.x, st.floor, 1.6, 2000);
  await st.wait(st.o.comedy ? 1200 : 700);
}

async function burned(st: Stage) {
  const sc = st.sc;
  const b = st.body;
  const s = st.spots();
  const k = st.k > 0 ? 1 / st.k : 1;
  synth.play("gun_flamer");
  synth.play(pick(["scream_man", "scream_man_2"]));
  st.redFlash(0.25, 300);
  // on fire, flailing
  const flames: Phaser.GameObjects.Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const f = st.fx("vfx_fire", s.x + (i - 1) * s.w * 0.25, s.chest + i * 10 * k, { scale: 1.3 * k, add: true, delay: i * 120 }, "over");
    if (f) flames.push(f);
  }
  const x0 = b.x;
  const flail = sc.tweens.add({ targets: b, x: { from: x0 - 8 * k, to: x0 + 8 * k }, angle: { from: -8, to: 8 }, duration: 110, yoyo: true, repeat: -1 });
  const char = { t: 0 };
  sc.tweens.add({
    targets: char,
    t: 1,
    duration: 1800,
    onUpdate: () => {
      if (!b.active) return;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffa060), Phaser.Display.Color.ValueToColor(0x241612), 100, char.t * 100);
      b.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    },
  });
  const smoke = sc.time.addEvent({ delay: 220, loop: true, callback: () => st.fx("vfx_smoke", st.spots().x + rnd(-10, 10) * k, st.spots().top, { scale: 1 * k }, "top") });
  await st.wait(1600);
  flail.stop();
  b.setX(x0);
  // down into a heap
  const sy = Math.abs(b.scaleY) / hdOf(b);
  await st.stagedFall(1.2);
  await st.tween({ targets: b, scaleY: sy * 0.6, alpha: 0.9, duration: 500 });
  for (const f of flames) f.destroy();
  st.put(sc.add.ellipse(s.x + st.dir * s.h * 0.3, st.floor, s.h * 0.9, 14 * k, 0x111111, 0.6), "under");
  if (st.gore) {
    st.gib("skull", st.spots().x + st.dir * s.h * 0.35, st.floor - 20 * k, 18, st.dir * 30, -120);
    st.gib("bone", st.spots().x, st.floor - 20 * k, 16, -st.dir * 40, -100);
  }
  sc.time.delayedCall(3000, () => smoke.remove());
}

/** The death fart. On a corpse (or the actor, if they're somehow still up). */
async function deathFart(st: Stage, drawn: DrawnDeath | null) {
  const sc = st.sc;
  const b = st.body;
  const k = st.k > 0 ? 1 / st.k : 1;
  const s = st.spots();
  // where it comes out
  let rx = s.x;
  let ry = st.floor - s.h * 0.25;
  const pd = drawn ?? DRAWN[st.actor.texture.key];
  if (pd?.rear && b.texture.key.startsWith("gd_")) {
    rx = b.x + (pd.rear[0] - 0.5) * b.frame.width * Math.abs(b.scaleX);
    ry = b.y - (1 - pd.rear[1]) * b.frame.height * Math.abs(b.scaleY);
  }
  // a comic beat of silence
  await st.wait(st.o.comedy === false ? 300 : 700);
  synth.play("fart_ready");
  // the belly swells, the body rumbles
  const sx = Math.abs(b.scaleX) / hdOf(b);
  const sy = Math.abs(b.scaleY) / hdOf(b);
  const fx = b.scaleX < 0 ? -1 : 1;
  const rumble = sc.tweens.add({ targets: b, x: { from: b.x - 2 * k, to: b.x + 2 * k }, duration: 40, yoyo: true, repeat: -1 });
  await st.tween({ targets: b, scaleX: fx * sx * 1.12, scaleY: sy * 1.06, duration: 700, ease: "Sine.in" });
  rumble.stop();
  // BRAAAP
  hitStop(sc, 120);
  synth.play("fart");
  sc.time.delayedCall(140, () => synth.play("fart"));
  sc.time.delayedCall(420, () => synth.play("fart"));
  st.shake(700, 0.014);
  if (!Juice.calm()) Juice.flash(sc, 0x6b8e23, 500, 0.35, 4980);
  else Juice.flash(sc, 0x6b8e23, 900, 0.5, 4980);
  if (drawn && (await ensureSheet(sc, drawn))) {
    b.setTexture(sheetKey(drawn), 0);
    st.tween({ targets: b, scaleX: fx * sx, scaleY: sy, duration: 120, ease: "Back.out" });
    (async () => {
      for (let f = 1; f < drawn.frames; f++) {
        if (!b.active) return;
        b.setFrame(f);
        await st.wait(Array.isArray(drawn.ms) ? drawn.ms[f] ?? 120 : drawn.ms);
      }
    })();
  } else {
    // the jolt off the floor, then it all goes out of him
    st.tween({ targets: b, y: b.y - 14 * k, duration: 90, yoyo: true, ease: "Quad.out" });
    st.tween({ targets: b, scaleX: fx * sx * 0.94, scaleY: sy * 0.95, duration: 1400, ease: "Sine.out" });
  }
  // the cloud: green-brown, huge, and it hangs about
  for (let i = 0; i < 5; i++) {
    st.fx("vfx_fart", rx + rnd(-30, 30) * k, ry + rnd(-10, 10) * k, { scale: rnd(1.1, 1.7) * k, tint: pick([0x9caf3a, 0x8b7a2e, 0xa3b14a]), delay: i * 110, alpha: 0.75 }, "top");
  }
  for (let i = 0; i < 9; i++) {
    const c = st.put(sc.add.circle(rx, ry, rnd(10, 18) * k, pick([0x9caf3a, 0x7c6a2a, 0x8fa33a]), 0.4), "top");
    c.setScale(0.2);
    const a = rnd(Math.PI, Math.PI * 2);
    const dist = rnd(50, 150) * k;
    sc.tweens.add({ targets: c, x: rx + Math.cos(a) * dist, y: ry + Math.sin(a) * dist * 0.6 - 30 * k, scale: rnd(1.4, 2.2), alpha: 0.22, duration: rnd(900, 1500), ease: "Cubic.out" });
    sc.tweens.add({ targets: c, y: `-=${40 * k}`, alpha: 0, delay: 2600 + i * 140, duration: 2600, onComplete: () => c.destroy() });
  }
  // the noise, written out
  const word = st.put(sc.add.text(rx, ry - 60 * k, "PFFFRRRRRBBBT", { fontFamily: "Impact, sans-serif", fontSize: `${Math.round(34 * k)}px`, color: "#a3b14a", stroke: "#3b2a10", strokeThickness: Math.max(2, Math.round(6 * k)) }).setOrigin(0.5), "top");
  word.setScale(0.3);
  sc.tweens.add({ targets: word, scale: 1, angle: { from: -6, to: 6 }, duration: 220, ease: "Back.out" });
  sc.tweens.add({ targets: word, x: word.x + 3 * k, duration: 50, yoyo: true, repeat: 16 });
  sc.tweens.add({ targets: word, y: word.y - 40 * k, alpha: 0, delay: 1900, duration: 900, onComplete: () => word.destroy() });
  // the stain (and, gore on, what came with it)
  const stain = st.put(sc.add.ellipse(rx, Math.min(ry + 6 * k, st.floor), 30 * k, 12 * k, 0x5a3a14, 0.8), "under");
  stain.setScale(0.1);
  sc.tweens.add({ targets: stain, scale: st.gore ? 2.2 : 1.2, duration: 1800, ease: "Sine.out" });
  if (st.gore) {
    synth.play("squelch");
    for (let i = 0; i < 6; i++) st.gib("poo", rx, ry, rnd(12, 18), rnd(-260, 260), -rnd(200, 420));
    st.drops(rx, ry, 18, { speed: 300, color: pick([0x5a3a14, 0x7c5a1a]) });
  }
  // the flies arrive, and stay
  for (let i = 0; i < 5; i++) {
    const fly = st.put(sc.add.circle(rx, ry - 30 * k, 1.6 * Math.max(k, 0.6), 0x111111), "top");
    const r = rnd(14, 34) * k;
    const sp = rnd(500, 900);
    const ph = { a: rnd(0, Math.PI * 2) };
    sc.tweens.add({
      targets: ph,
      a: ph.a + Math.PI * 2,
      duration: sp,
      repeat: -1,
      delay: 900 + i * 200,
      onUpdate: () => fly.active && fly.setPosition(rx + Math.cos(ph.a) * r, ry - 26 * k + Math.sin(ph.a * 2) * r * 0.35),
    });
  }
  // a last little one
  sc.time.delayedCall(2400, () => synth.play("pfft"));
  await st.wait(1800);
}

// ------------------------------------------------------------------ the entry point

/**
 * Kill `actor` the way `kind` says. Resolves (with the corpse) once the body is down; pools and smoke carry on.
 * Call it on someone already dead to add to it (a death fart, a second blast).
 */
export async function goreDeath(sc: Phaser.Scene, actor: Actor, kind: GoreKind, opts: GoreOpts = {}): Promise<Phaser.GameObjects.Sprite | null> {
  if (!actor?.scene || !sc.sys?.isActive()) return null;
  // (a placeholder that isn't a sprite: it just goes)
  if (!actor.texture || !actor.frame) {
    (actor as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(false);
    return null;
  }
  if (opts.delay) await new Promise<void>((r) => sc.time.delayedCall(opts.delay!, () => r()));
  if (!actor.scene) return null;
  const st = new Stage(sc, actor, opts);
  const wasDead = !!(actor.getData?.("gd_body") as Phaser.GameObjects.GameObject | undefined)?.active;
  const b = st.makeBody();
  st.dir = opts.dir ?? (opts.fromX !== undefined ? (actor.x >= opts.fromX ? 1 : -1) : 1);
  // the floor is under their visible feet (sheets leave a little air under the frame)
  if (opts.floorY !== undefined) st.floor = opts.floorY;
  else {
    const box = visibleBox(sc, b);
    st.floor = b.y - Math.max(0, b.frame.height - (box.y + box.h)) * Math.abs(b.scaleY);
  }
  // a drawn death, if they have one and it's wanted
  const tex = actor.texture.key;
  const dKey = opts.drawn === false ? null : opts.drawn ?? (DRAWN[`${kind}:${tex}`] ? `${kind}:${tex}` : DRAWN[tex] && (kind === "shot" || kind === "fart") ? tex : null);
  // gore off: the drawn death's blood-free frames, if it has them
  const clean = (d: DrawnDeath | null) => (!d || st.gore ? d : d.clean ? { ...d, file: d.clean } : null);
  const drawnRaw = dKey ? DRAWN[dKey] ?? null : null;
  const drawn = clean(drawnRaw);
  const fartArt = clean(DRAWN_FART[tex] ?? null);
  try {
    if (wasDead) {
      if (kind === "fart") await deathFart(st, b.texture.key.startsWith("gd_") && b.visible ? fartArt : null);
      else if (kind === "blast") await blast(st);
      else if (kind === "burned") await burned(st);
      else {
        const s = st.spots();
        st.impact(s.x, s.feet - s.w * 0.2, 1);
        st.pool(s.x, st.floor, 1.2);
      }
      return b;
    }
    switch (kind) {
      case "shot":
      case "fart": {
        if (drawn && (await ensureSheet(sc, drawn))) await drawnDeath(st, drawn);
        else if (!st.gore && drawnRaw?.deskTop) await deskSlump(st, drawnRaw.deskTop);
        else {
          await shot(st, opts.hits ?? 3);
          await st.wait(opts.comedy ? 260 : 120);
          await st.stagedFall(kind === "fart" ? 1.4 : 1);
          const s = st.spots();
          st.pool(s.x + st.dir * s.w * 0.1, st.floor);
        }
        if (kind === "fart") await deathFart(st, drawn ? fartArt : null);
        break;
      }
      case "headshot":
        await headshot(st);
        break;
      case "blast":
        await blast(st);
        break;
      case "crushed":
        await crushed(st);
        break;
      case "burned":
        await burned(st);
        break;
      case "collapse":
        synth.play("groan");
        await st.stagedFall(1.3);
        break;
    }
    if (opts.comedy && kind !== "fart") synth.play("trombone");
  } catch {
    // the scene went away mid-death: nothing to do
  }
  return b.active ? b : null;
}

/** Is this actor already a corpse (goreDeath ran on it)? */
export function isDead(actor: Actor) {
  return !!(actor.getData?.("gd_body") as Phaser.GameObjects.GameObject | undefined)?.active;
}

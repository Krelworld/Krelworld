import Phaser from "phaser";
import { G } from "../../G";
import { vfx } from "../../gfx/Vfx";
import { FONT } from "../../ui/theme";

/**
 * KrelTV action clips: short PixelLab animations of the cast doing the violent bit of a script (a punch, a
 * shove, a chair thrown, a table flipped), drawn from their own close-up / presenter / body art so they stay on
 * model. public/art/tv/action/<name>.png, one horizontal strip each (frame 0 is the art they were drawn from),
 * keyed tva_<name> in the manifest's sheets; the props they throw are tva_prop_<name> and the impacts are the
 * tva_vfx_* effects (pow, smash, shatter, splat).
 *
 * The directors (Ensemble, Soap, Wedding, TVNews, TVPov) put a clip in the picture with clip(), fling props with
 * fling() and land them with impact(). Everything is cartoon slapstick; gore and flashing follow the settings.
 */

export const gore = () => G.meta?.settings?.gore !== false;
export const calm = () => !!G.meta?.settings?.calmFlash;

export function hasClip(sc: Phaser.Scene, name: string) {
  return sc.textures.exists(`tva_${name}`);
}

/** The animation for a clip at a frame rate (made once). Frames: the whole strip, or the ones listed. */
function anim(sc: Phaser.Scene, name: string, fps: number, frames?: number[]) {
  const key = `tva_${name}`;
  const id = `${key}@${fps}${frames ? `:${frames.join(",")}` : ""}`;
  if (!sc.anims.exists(id)) {
    sc.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const all = sc.textures.get(key).frameTotal - 1;
    const list = frames ?? Array.from({ length: all }, (_, i) => i);
    sc.anims.create({ key: id, frames: list.map((f) => ({ key, frame: f })), frameRate: fps, repeat: 0 });
  }
  return id;
}

export interface ClipOpts {
  fps?: number;
  /** which frames of the strip, in order (default: all of them) */
  frames?: number[];
  /** loop the clip */
  loop?: boolean;
  /** called as each frame of the animation shows (index into `frames`) */
  onFrame?: (i: number) => void;
  /** called when a one-shot finishes (the sprite stays on its last frame) */
  done?: () => void;
  delay?: number;
}

/** Play a clip on an existing sprite (it takes the clip's texture). */
export function playClip(sc: Phaser.Scene, s: Phaser.GameObjects.Sprite, name: string, o: ClipOpts = {}) {
  if (!hasClip(sc, name)) return false;
  const id = anim(sc, name, o.fps ?? 10, o.frames);
  const go = () => {
    if (!s.active) return;
    s.off(Phaser.Animations.Events.ANIMATION_UPDATE);
    s.play({ key: id, repeat: o.loop ? -1 : 0 });
    if (o.onFrame) {
      const list = sc.anims.get(id).frames;
      s.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, f: Phaser.Animations.AnimationFrame) => {
        // run outside Phaser's animation step, so a callback may cut the shot (destroy this sprite) safely
        const i = list.indexOf(f);
        sc.time.delayedCall(0, () => o.onFrame!(i));
      });
    }
    if (o.done) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sc.time.delayedCall(0, () => o.done!()));
  };
  if (o.delay) sc.time.delayedCall(o.delay, go);
  else go();
  return true;
}

/** A sprite of a clip's first frame (its feet / bottom edge at x,y), at a display height. */
export function clipSprite(sc: Phaser.Scene, name: string, x: number, y: number, height: number, ox = 0.5) {
  if (!hasClip(sc, name)) return null;
  const s = sc.add.sprite(x, y, `tva_${name}`, 0).setOrigin(ox, 1);
  s.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  s.setScale(height / s.height);
  return s;
}

export interface FlingOpts {
  ms?: number;
  /** turns while it flies */
  spin?: number;
  from?: number;
  to?: number;
  /** how high it arcs above the straight line (px) */
  arc?: number;
  ease?: string;
  done?: () => void;
}

/** A prop (tva_prop_<name>) thrown from one point to another: spinning, growing as it comes at us, on an arc. */
export function fling(sc: Phaser.Scene, put: <T extends Phaser.GameObjects.GameObject>(o: T) => T, name: string, from: { x: number; y: number }, to: { x: number; y: number }, o: FlingOpts = {}) {
  const key = `tva_prop_${name}`;
  if (!sc.textures.exists(key)) return null;
  sc.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  const p = put(sc.add.image(from.x, from.y, key).setScale(o.from ?? 2));
  const t = { k: 0 };
  const arc = o.arc ?? 60;
  sc.tweens.add({
    targets: t,
    k: 1,
    duration: o.ms ?? 520,
    ease: o.ease ?? "Linear",
    onUpdate: () => {
      if (!p.active) return;
      const k = t.k;
      p.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * arc);
      p.setScale((o.from ?? 2) + ((o.to ?? o.from ?? 2) - (o.from ?? 2)) * k);
      p.setAngle((o.spin ?? 540) * k);
    },
    onComplete: () => {
      // the shot was cut away from mid-flight: nothing lands
      if (!p.active) return;
      p.destroy();
      o.done?.();
    },
  });
  return p;
}

/**
 * The hit: an impact effect (pow / smash / shatter / splat) and a camera jolt; a white pop unless the player
 * asked for calm flashes.
 */
export function impact(sc: Phaser.Scene, put: <T extends Phaser.GameObjects.GameObject>(o: T) => T, kind: "pow" | "smash" | "shatter" | "splat", x: number, y: number, scale = 2.4, shake = 0.012) {
  const s = vfx(sc, `tva_vfx_${kind}`, x, y, { scale });
  if (s) put(s);
  sc.cameras.main.shake(calm() ? 160 : 280, calm() ? shake * 0.4 : shake);
  return s;
}

/** A bold comic-book word for the hit (POW!, CRASH!), which pops and goes. */
export function bang(sc: Phaser.Scene, put: <T extends Phaser.GameObjects.GameObject>(o: T) => T, word: string, x: number, y: number, size = 34, col = "#ffd23f") {
  const t = put(sc.add.text(x, y, word, { fontFamily: FONT, fontSize: `${size}px`, color: col, fontStyle: "bold", stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5).setAngle(-12 + Math.random() * 24).setScale(0.3));
  sc.tweens.add({ targets: t, scale: 1, duration: 140, ease: "Back.out" });
  sc.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 250, onComplete: () => t.destroy() });
  return t;
}

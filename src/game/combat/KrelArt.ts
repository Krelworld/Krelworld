import Phaser from "phaser";
import type { CharMeta } from "../gfx/HD";

/**
 * The Kreltalities' drawn art (PixelLab, public/art/krel): the props and gore pieces (kp_*), the 32px gore/bits sheet
 * (kp_bits), and each lad's finisher actions (krelact_<LAD>: one row of 9 frames per verb, 96x80, his east-facing
 * idle as frame 0 of every row). Everything here falls back to nothing (or the lad's own attack frames) when the art
 * isn't loaded, so the finishers still play.
 */

/** The actions, in the row order of the krelact_ sheets. */
export const VERBS = ["saw", "katana", "ray", "punch", "kick", "slam", "pull", "rip", "stomp", "det"] as const;
export type Verb = (typeof VERBS)[number];
const ACT_COLS = 9;

/** Cells of the kp_bits sheet (16 x 4, 32px). */
export const BIT = {
  heart: 0,
  heart2: 1,
  guts: 2,
  gutrope: 3,
  bone: 4,
  bonebroken: 5,
  skull: 6,
  meat: 7,
  meatbone: 8,
  eyeball: 9,
  poo: 10,
  gerbil: 11,
  tumour: 12,
  jaw: 13,
  brain: 14,
  shards: 15,
  tongue: 16,
  lungs: 17,
  vertebra: 18,
  piranha: 19,
  piranhabite: 20,
  drop: 21,
  splat: 22,
  bubble: 23,
  iceshard: 24,
  icechunk: 25,
  bomblight: 26,
  bomb: 27,
  star: 28,
  love: 29,
  tear: 30,
  hair: 31,
  kidney: 32,
  liver: 33,
  petroldrop: 34,
  rainbow: 35,
  rubble: 36,
  dust: 37,
  shred: 38,
  tooth: 39,
  finger: 40,
  eyeball2: 41,
  ear: 59,
  bloodyskull: 62,
} as const;
export type Bit = keyof typeof BIT;
/** The meaty ones, for flinging about. */
export const MEATY: Bit[] = ["meat", "meatbone", "guts", "gutrope", "kidney", "liver", "eyeball", "brain", "shred", "tooth", "finger", "ear", "bone", "bonebroken"];

export const hasArt = (sc: Phaser.Scene, key: string) => sc.textures.exists(key) && key !== "__MISSING";

/**
 * A prop image sized in world pixels: by height (h), or width (w), or both (stretched). The kp_ textures carry no
 * HD factor, so the scale set is the scale drawn; still, set it from the frame and never read it back.
 */
export function prop(sc: Phaser.Scene, key: string, x: number, y: number, o: { h?: number; w?: number; depth?: number; ox?: number; oy?: number; flip?: boolean } = {}) {
  if (!hasArt(sc, key)) return null;
  const im = sc.add.image(x, y, key).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
  const fw = im.frame.width;
  const fh = im.frame.height;
  const sx = o.w ? o.w / fw : o.h ? o.h / fh : 1;
  const sy = o.h ? o.h / fh : sx;
  im.setScale(o.w && !o.h ? sx : o.h && !o.w ? sy : sx, sy);
  if (o.flip) im.setFlipX(true);
  if (o.depth !== undefined) im.setDepth(o.depth);
  return im;
}

/** One piece off the gore/bits sheet, `size` world pixels across. */
export function bit(sc: Phaser.Scene, name: Bit, x: number, y: number, size: number, depth?: number) {
  if (!hasArt(sc, "kp_bits")) return null;
  const s = sc.add.image(x, y, "kp_bits", BIT[name]).setScale(size / 32);
  if (depth !== undefined) s.setDepth(depth);
  return s;
}

/**
 * The lad doing the finisher. `play(verb)` swaps his sprite onto his action sheet for the row and resolves when it ends;
 * `idle()` puts him back on his own sheet facing the way he's flipped; `cheer()` is his own victory row.
 * Lads without an action sheet (the super forms, anyone else) fall back to their own attack row for every verb.
 */
export class Actor {
  readonly base: string;
  readonly sheet: string | null;
  readonly meta: CharMeta | null;
  constructor(
    readonly sc: Phaser.Scene,
    readonly me: Phaser.GameObjects.Sprite,
  ) {
    this.base = me.texture.key;
    const tex = sc.textures.get(this.base);
    this.meta = ((tex.customData as { char?: CharMeta }).char ?? null) as CharMeta | null;
    const lad = /^spr_([A-Z]+)$/.exec(this.base)?.[1];
    const sheet = lad ? `krelact_${lad}` : "";
    this.sheet = sheet && hasArt(sc, sheet) ? sheet : null;
    if (this.sheet) {
      // the action sheet is drawn at the lad's own size: carry his HD factor and height over
      const cd = tex.customData as { hd?: number; tall?: number };
      const st = sc.textures.get(this.sheet);
      st.customData = { ...st.customData, hd: cd.hd ?? 1, tall: cd.tall ?? 1 };
      st.setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const v of VERBS) {
        const k = `${this.sheet}:${v}`;
        if (sc.anims.exists(k)) continue;
        const r = VERBS.indexOf(v) * ACT_COLS;
        sc.anims.create({ key: k, frames: sc.anims.generateFrameNumbers(this.sheet, { start: r, end: r + ACT_COLS - 1 }), frameRate: 14, repeat: 0 });
      }
    }
  }

  /** Stand facing right (dir 1) or left (-1), on his own sheet. */
  idle(dir?: 1 | -1) {
    const me = this.me;
    if (dir) me.setFlipX(dir < 0);
    me.anims.stop();
    if (me.texture.key !== this.base) me.setTexture(this.base);
    me.setOrigin(0.5, 0.5);
    me.setFrame(this.meta?.idle?.east ?? 0);
    return this;
  }

  /**
   * Play an action. `frames` picks part of the row ([from, to], inclusive); `hold` leaves him on the last frame
   * (otherwise he goes back to standing). Resolves when the row has played.
   */
  play(verb: Verb, o: { frames?: [number, number]; fps?: number; hold?: boolean; yoyo?: boolean } = {}): Promise<void> {
    const me = this.me;
    const sc = this.sc;
    return new Promise((res) => {
      if (!me.active) return res();
      let frames: Phaser.Types.Animations.AnimationFrame[];
      if (this.sheet) {
        const r = VERBS.indexOf(verb) * ACT_COLS;
        const [a, b] = o.frames ?? [0, ACT_COLS - 1];
        frames = [];
        for (let i = a; i <= b; i++) frames.push({ key: this.sheet, frame: r + i });
        me.setTexture(this.sheet, r + a);
        me.setOrigin(0.5, 0.6);
      } else {
        const atk = this.meta?.attack?.east ?? this.meta?.attack?.south;
        if (!atk?.length) return res();
        frames = atk.map((f) => ({ key: this.base, frame: f }));
      }
      const key = `krelact_tmp_${Math.random().toString(36).slice(2)}`;
      sc.anims.create({ key, frames, frameRate: o.fps ?? 14, repeat: 0, yoyo: !!o.yoyo });
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        sc.anims.remove(key);
        if (!o.hold && me.active) this.idle();
        res();
      };
      me.once(Phaser.Animations.Events.ANIMATION_COMPLETE, fin);
      me.play(key);
      // in case something else takes the sprite over mid-row
      sc.time.delayedCall(((frames.length * (o.yoyo ? 2 : 1)) / (o.fps ?? 14)) * 1000 + 600, fin);
    });
  }

  /** Walking (his own east walk cycle), until `idle()`. */
  walk() {
    const w = this.meta?.walk?.east;
    const me = this.me;
    if (!w?.length || !me.active) return;
    me.anims.stop();
    if (me.texture.key !== this.base) me.setTexture(this.base);
    me.setOrigin(0.5, 0.5);
    const key = `krelwalk_${this.base}`;
    if (!this.sc.anims.exists(key)) this.sc.anims.create({ key, frames: w.map((f) => ({ key: this.base, frame: f })), frameRate: 10, repeat: -1 });
    me.play(key);
  }

  /** His own victory row, looping until `idle()` (or the scene tidies up). */
  cheer() {
    const v = this.meta?.victory?.east ?? this.meta?.victory?.south;
    const me = this.me;
    if (!v?.length || !me.active) return;
    me.anims.stop();
    if (me.texture.key !== this.base) me.setTexture(this.base);
    me.setOrigin(0.5, 0.5);
    const key = `krelcheer_${this.base}`;
    if (!this.sc.anims.exists(key)) this.sc.anims.create({ key, frames: v.map((f) => ({ key: this.base, frame: f })), frameRate: 9, repeat: -1 });
    me.play(key);
  }
}

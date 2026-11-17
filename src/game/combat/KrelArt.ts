import Phaser from "phaser";
import type { CharMeta } from "../gfx/HD";
import { KREL_BEATS } from "./krelBeats";

/**
 * The Kreltalities' drawn art (PixelLab, public/art/krel): the props and gore pieces (kp_*), the 32px gore/bits sheet
 * (kp_bits), and each lad's finisher actions (krelact_<LAD>: one row per verb, 96x80, his east-facing stance as
 * frame 0 of every row; 16 frames a row, or 9 on the older sheets, told apart by the texture's width). Everything
 * here falls back to nothing (or the lad's own attack frames) when the art isn't loaded, so the finishers still play.
 *
 * The victims' drawn reactions (krelvic_<name>, see Victim below) are the same idea for whoever is being finished.
 */

/** The actions, in the row order of the krelact_ sheets. */
export const VERBS = ["saw", "katana", "ray", "punch", "kick", "slam", "pull", "rip", "stomp", "det"] as const;
export type Verb = (typeof VERBS)[number];
/** The width of an action cell; a sheet is ACT_COLS (16) of them across, or OLD_COLS (9) on the older sheets. */
const ACT_W = 96;
export const ACT_COLS = 16;
const OLD_COLS = 9;
/**
 * The finishers name frames by KEY POSE, 0..8 (the beats of the old 9-frame rows: 0 the stance, about 4 the top of
 * the wind-up, 5 onwards the strike, 8 the end of the follow-through). On a 16-frame sheet each key pose sits on the
 * frame listed in krelBeats.ts (matched to the old row's pose when the sheet was drawn), or spread evenly when it
 * isn't listed; the in-betweens (anticipation, the smear on the strike, the follow-through) fill the gaps.
 */
export function beatsOf(lad: string, verb: Verb, cols: number): number[] {
  if (cols === OLD_COLS) return [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const b = KREL_BEATS[lad]?.[verb];
  if (b && b.length === OLD_COLS) return b;
  return Array.from({ length: OLD_COLS }, (_, k) => Math.round((k * (cols - 1)) / (OLD_COLS - 1)));
}
/** Key poses [a, b] -> sheet frames, so that back-to-back ranges ([0,4] then [5,8]) play every frame between. */
export function framesFor(beats: number[], a: number, b: number): [number, number] {
  const end = beats[b];
  const start = a === 0 ? 0 : Math.min(end, beats[a - 1] + 1);
  return [Math.min(start, end), end];
}

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
  /** frames per row of his action sheet (16; 9 on the older sheets) */
  readonly cols: number = OLD_COLS;
  readonly lad: string;
  constructor(
    readonly sc: Phaser.Scene,
    readonly me: Phaser.GameObjects.Sprite,
  ) {
    this.base = me.texture.key;
    const tex = sc.textures.get(this.base);
    this.meta = ((tex.customData as { char?: CharMeta }).char ?? null) as CharMeta | null;
    const lad = /^spr_([A-Z]+)$/.exec(this.base)?.[1];
    this.lad = lad ?? "";
    const sheet = lad ? `krelact_${lad}` : "";
    this.sheet = sheet && hasArt(sc, sheet) ? sheet : null;
    if (this.sheet) {
      const w = sc.textures.get(this.sheet).getSourceImage().width;
      this.cols = Math.round(w / ACT_W) >= ACT_COLS ? ACT_COLS : OLD_COLS;
      // the action sheet is drawn at the lad's own size: carry his HD factor and height over
      const cd = tex.customData as { hd?: number; tall?: number };
      const st = sc.textures.get(this.sheet);
      st.customData = { ...st.customData, hd: cd.hd ?? 1, tall: cd.tall ?? 1 };
      st.setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const v of VERBS) {
        const k = `${this.sheet}:${v}`;
        if (sc.anims.exists(k)) continue;
        const r = VERBS.indexOf(v) * this.cols;
        sc.anims.create({ key: k, frames: sc.anims.generateFrameNumbers(this.sheet, { start: r, end: r + this.cols - 1 }), frameRate: (14 * this.cols) / OLD_COLS, repeat: 0 });
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
   * Play an action. `frames` picks part of the row by key pose ([from, to], inclusive, 0..8: see beatsOf); `hold`
   * leaves him on the last frame (otherwise he goes back to standing). `fps` is in key poses a second, so a range
   * takes as long on a 16-frame sheet as on a 9-frame one and the hit lands on the same beat. Resolves when it has played.
   */
  play(verb: Verb, o: { frames?: [number, number]; fps?: number; hold?: boolean; yoyo?: boolean } = {}): Promise<void> {
    const me = this.me;
    const sc = this.sc;
    return new Promise((res) => {
      if (!me.active) return res();
      let frames: Phaser.Types.Animations.AnimationFrame[];
      let fps = o.fps ?? 14;
      if (this.sheet) {
        const r = VERBS.indexOf(verb) * this.cols;
        const [ka, kb] = o.frames ?? [0, OLD_COLS - 1];
        const [a, b] = framesFor(beatsOf(this.lad, verb, this.cols), ka, kb);
        // the same time for the range whatever the sheet: more frames, played faster
        fps *= (b - a + 1) / (kb - ka + 1);
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
      sc.anims.create({ key, frames, frameRate: fps, repeat: 0, yoyo: !!o.yoyo });
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
      sc.time.delayedCall(((frames.length * (o.yoyo ? 2 : 1)) / fps) * 1000 + 600, fin);
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

/** The victims' drawn reactions, in the row order of the krelvic_ sheets. */
export const REACTIONS = ["terror", "grabbed", "impact"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** The reaction sheet for a victim's texture (boss_x, bossanim_x and p_x all share krelvic_x), if it's loaded. */
export function victimSheet(sc: Phaser.Scene, texKey: string): string | null {
  const k = `krelvic_${texKey.replace(/^(bossanim_|boss_|p_)/, "")}`;
  return hasArt(sc, k) ? k : null;
}

/**
 * The victim's drawn reactions (krelvic_<name>: a row each of terror, grabbed and impact, drawn off their own
 * sprite at its own cell size). `react()` lays the reaction over the body and follows it about (position, angle,
 * scale, flip, tint, alpha, the container it's rigged into), with the body hidden underneath; `release()` puts the
 * body back exactly as the finisher left it, ready for the slicing. With no sheet, both do nothing: the body plays
 * on as it always did. The impact row is drawn without blood, so it's the same with the gore off.
 */
export class Victim {
  readonly sheet: string | null;
  private spr: Phaser.GameObjects.Sprite | null = null;
  private hidden: number | null = null;
  private cols = 0;
  private kind: Reaction | null = null;
  /** bumped by every react/release, so a stale timer or callback does nothing */
  private turn = 0;
  private readonly sync = () => this.follow();
  constructor(
    readonly sc: Phaser.Scene,
    readonly body: Phaser.GameObjects.Image,
    texKey: string,
    private readonly keep: <T extends Phaser.GameObjects.GameObject>(o: T) => T,
  ) {
    this.sheet = victimSheet(sc, texKey);
    if (!this.sheet) return;
    const t = sc.textures.get(this.sheet);
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cols = Math.max(1, Math.round(t.getSourceImage().width / t.get(0).width));
  }

  get reacting() {
    return this.kind;
  }

  /**
   * Play a reaction over the body. `loop` keeps it going (terror trembles, grabbed struggles: the back half of the
   * row loops); otherwise it holds the last frame, or goes on to `then` (looping). `ms` releases it after that long.
   */
  react(kind: Reaction, o: { loop?: boolean; fps?: number; ms?: number; then?: Reaction } = {}) {
    const sc = this.sc;
    const body = this.body;
    if (!this.sheet || !body.active) return this;
    if (!this.spr || !this.spr.active) {
      const s = this.keep(sc.add.sprite(body.x, body.y, this.sheet, 0));
      if (body.parentContainer) body.parentContainer.addAt(s, body.parentContainer.getIndex(body) + 1);
      this.spr = s;
      sc.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sync);
    }
    const s = this.spr;
    if (this.hidden === null) {
      this.hidden = body.alpha;
      body.setAlpha(0);
    }
    this.kind = kind;
    const turn = ++this.turn;
    const r = REACTIONS.indexOf(kind) * this.cols;
    const n = this.cols;
    const fps = o.fps ?? (kind === "impact" ? 16 : 10);
    const key = `${this.sheet}:${kind}:${o.loop ? "loop" : "once"}`;
    if (!sc.anims.exists(key)) {
      const frames = sc.anims.generateFrameNumbers(this.sheet, { start: r, end: r + n - 1 });
      sc.anims.create({ key, frames, frameRate: fps, repeat: 0 });
      if (o.loop) {
        // the way in once, then the back half over and over
        sc.anims.create({ key: `${key}:tail`, frames: sc.anims.generateFrameNumbers(this.sheet, { start: r + Math.floor(n / 2), end: r + n - 1 }), frameRate: fps, repeat: -1, yoyo: true });
      }
    }
    s.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    s.play(key);
    if (o.loop) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.active && this.turn === turn && s.play(`${key}:tail`));
    else if (o.then) {
      const next = o.then;
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.active && this.turn === turn && this.react(next, { loop: true }));
    }
    this.follow();
    if (o.ms) sc.time.delayedCall(o.ms, () => this.turn === turn && this.release());
    return this;
  }

  /**
   * The moment of the hit: the impact row, and a short beat (`ms`) to see it before whatever comes next takes the
   * body apart. With no sheet there's no beat: it resolves at once, so the timing is as it always was.
   */
  hit(ms = 150): Promise<void> {
    if (!this.sheet || !this.body.active) return Promise.resolve();
    this.react("impact");
    return new Promise((r) => this.sc.time.delayedCall(ms, () => r()));
  }

  /** Back to the body (as the finisher has left it). */
  release() {
    this.kind = null;
    this.turn++;
    if (this.hidden !== null && this.body.active) {
      // only if nothing has touched its alpha since (a fade the finisher started stands)
      if (this.body.alpha === 0) this.body.setAlpha(this.hidden);
    }
    this.hidden = null;
    if (this.spr) {
      this.spr.anims.stop();
      this.spr.setVisible(false);
    }
    return this;
  }

  /** Tidy up (the stage destroys the sprite with the rest of its junk). */
  destroy() {
    this.release();
    this.sc.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sync);
    this.spr = null;
  }

  private follow() {
    const s = this.spr;
    const b = this.body;
    if (!s?.active) return;
    if (!b.active || this.kind === null) {
      if (!b.active) this.destroy();
      return;
    }
    // rigged into a container (or taken out of one) since: go with it
    if (b.parentContainer !== s.parentContainer) {
      s.parentContainer?.remove(s);
      if (b.parentContainer) b.parentContainer.addAt(s, b.parentContainer.getIndex(b) + 1);
      else this.sc.add.existing(s);
    }
    // the body's frame and the reaction's share a size; if not, keep the same height
    const k = b.frame.height / s.frame.height;
    s.setPosition(b.x, b.y);
    s.setAngle(b.angle);
    s.setFlipX(b.flipX);
    s.setOrigin(b.originX, b.originY);
    s.setDepth(b.depth);
    s.setVisible(b.visible);
    s.setAlpha(this.hidden ?? 1);
    s.tintTopLeft = b.tintTopLeft;
    s.tintTopRight = b.tintTopRight;
    s.tintBottomLeft = b.tintBottomLeft;
    s.tintBottomRight = b.tintBottomRight;
    // real scales (HD sheets multiply what's set: undo it)
    const hd = (s.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
    s.setScale((b.scaleX * k) / hd, (b.scaleY * k) / hd);
  }
}

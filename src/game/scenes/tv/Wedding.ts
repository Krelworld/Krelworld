import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../../systems/tv";
import { F, ShowDirector, type Perf, type Rect, type ShowHost } from "./ShowDirector";
import { synth } from "../../audio/Synth";

/**
 * A wedding video (The Best Man's Speech). Shot by the hired videographer: golden-hour grade, soft vignette and
 * light leaks, a gentle handheld float, slow dissolves between shots, a script title and a lower third
 * ("Jenko & Ruth · The Speeches"), cutaways to the guests on every laugh, and a slow push on the groom whenever
 * we hear what he's thinking. When it all goes wrong (the mole, the taser, the pig) we're suddenly on a guest's
 * camcorder: REC, timecode, date stamp, scanlines and a lot of shaking.
 *
 * Its own close-up sheets live under tvface_BM_<NAME> (so they never stand in for anyone in another show), 128px
 * frames laid out like the rest (0 neutral, 1 talk, 2 alarm, 3 blink, 4 gesture, 5 laugh, 6 special, lip shapes
 * at 8-14, gesture animations after).
 */

const FACES: Record<string, { key: string; base: number; lip: boolean; gest: [number, number][] }> = {
  FLENKY: { key: "tvface_BM_JENKO", base: 7, lip: false, gest: [[16, 8], [24, 8]] },
  GRONNY: { key: "tvface_BM_RORY", base: 7, lip: true, gest: [[16, 8], [24, 8]] },
  RUTH: { key: "tvface_BM_RUTH", base: 7, lip: false, gest: [] },
  "MOLE PERSON": { key: "tvface_BM_MOLE", base: 3, lip: false, gest: [] },
  "WEDDING GUEST": { key: "tvface_BM_GUEST", base: 6, lip: false, gest: [] },
};
/** Jenko's phone animation (the second in his sheet; the first, a collar tug, isn't used: he laughs in it). */
const PHONE = 1;
/** Rory's: the point, then the toast. */
const POINT = 0;
const TOAST = 1;

const SET = {
  manor: "tv_bm_manor",
  table: "tv_bm_table",
  front: "tv_bm_tablefront",
  guests: "tv_bm_guests",
  doors: "tv_bm_doors",
  slide: "tv_bm_bridge",
  night: "tv_bm_night",
  woman: "tv_bm_woman",
  security: "tv_bm_security",
  mole: "tv_bm_mole",
  pig: "tv_bm_pig",
};

/** Where the blank plaque sits in the bridge photo (texture pixels). */
const PLAQUE = { x: 94, y: 172, w: 58, h: 46 };

const SCRIPT_FONT = "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "'Courier New', Courier, monospace";

export class WeddingDirector extends ShowDirector {
  /** handheld float, layered on top of whatever push is running */
  private float = 0.7;
  private camcorder = false;
  private camLayer: Phaser.GameObjects.Container | null = null;
  private letterbox: Phaser.GameObjects.Rectangle[] = [];
  private olds: Phaser.GameObjects.Container[] = [];
  private maskG: Phaser.GameObjects.Graphics;
  private titles = 0;
  private vo = 0;
  private roryLines = 0;
  private recStarted = 0;
  private music = false;
  private shotKind = "";
  /** the pig has arrived (and stays in the corner of things) */
  private pig = false;
  private ended = false;

  constructor(sc: Phaser.Scene, r: Rect, beats: TVBeat[], host: ShowHost, ep: TVEpisode) {
    super(sc, r, beats, host, ep);
    this.maskG = sc.make.graphics({}).fillRect(r.SX, r.SY, r.SW, r.SH);
    // the operator's hands: a slow float on top of every move
    const t0 = sc.time.now;
    this.every(
      33,
      () => {
        const t = (this.sc.time.now - t0) / 1000;
        const a = this.float;
        const p = this.camProxy;
        const dx = (Math.sin(t * 0.9) * 3 + Math.sin(t * 2.3 + 1) * 1.4 + (this.camcorder ? Math.sin(t * 7.1) * 1.6 : 0)) * a;
        const dy = (Math.sin(t * 0.7 + 2) * 2.4 + Math.sin(t * 1.9) * 1.1 + (this.camcorder ? Math.sin(t * 6.3 + 3) * 1.4 : 0)) * a;
        this.cam.setScale(p.s).setPosition(p.fx * (1 - p.s) + dx, p.fy * (1 - p.s) + dy).setAngle(Math.sin(t * 0.6) * 0.35 * a);
      },
      -1,
      true,
    );
    this.grade();
  }

  destroy() {
    for (const o of this.olds) o.destroy();
    this.olds = [];
    this.maskG.destroy();
    super.destroy();
  }

  /** The push tween writes the camera itself; the float timer then re-applies it with the wobble. */
  protected push(to: number, ms: number, fx = this.cx, fy = this.cy, ease = "Sine.easeInOut") {
    this.camProxy.fx = fx;
    this.camProxy.fy = fy;
    this.sc.tweens.add({ targets: this.camProxy, s: to, duration: ms, ease });
  }

  // ------------------------------------------------------------------ the look

  /** Golden hour: a warm wash, a light leak in the corner, a soft vignette. Under the captions. */
  private grade() {
    const { SX, SY, SW, SH } = this.r;
    const warm = this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0xffa040, 0.1).setOrigin(0).setData("grade", 1));
    warm.setBlendMode(Phaser.BlendModes.ADD);
    const leak = this.over(this.sc.add.graphics().setData("grade", 1));
    for (let i = 0; i < 9; i++) {
      leak.fillStyle(0xffc070, 0.035);
      leak.fillCircle(SX + 40, SY + 30, 60 + i * 26);
    }
    leak.setBlendMode(Phaser.BlendModes.ADD);
    this.sc.tweens.add({ targets: leak, alpha: { from: 0.6, to: 1 }, duration: 3800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const v = this.over(this.sc.add.graphics().setData("grade", 1));
    for (let i = 0; i < 7; i++) {
      v.lineStyle(18, 0x2a1408, 0.08);
      v.strokeRect(SX + i * 12, SY + i * 12, SW - i * 24, SH - i * 24);
    }
    // the videographer's cinematic bars
    const top = this.over(this.sc.add.rectangle(SX, SY, SW, 30, 0x000000).setOrigin(0).setData("grade", 1));
    const bot = this.over(this.sc.add.rectangle(SX, SY + SH - 30, SW, 30, 0x000000).setOrigin(0, 0).setData("grade", 1));
    this.letterbox = [top, bot];
  }

  /** Back to the videographer: bars on, the camcorder overlay off. */
  private cinematic() {
    this.float = 0.7;
    if (!this.camcorder) return;
    this.camcorder = false;
    this.camLayer?.destroy();
    this.camLayer = null;
    for (const b of this.letterbox) b.setVisible(true);
  }

  /** A guest's camcorder: REC, the timecode running, a date stamp, scanlines. */
  private camcorderOn() {
    this.float = 2.6;
    if (this.camcorder) return;
    this.camcorder = true;
    for (const b of this.letterbox) b.setVisible(false);
    const { SX, SY, SW, SH } = this.r;
    const L = this.over(this.sc.add.container(0, 0));
    this.camLayer = L;
    const lines = this.sc.add.graphics();
    lines.fillStyle(0x000000, 0.13);
    for (let y = SY; y < SY + SH; y += 3) lines.fillRect(SX, y, SW, 1);
    L.add(lines);
    L.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x6080ff, 0.05).setOrigin(0));
    const dot = this.sc.add.circle(SX + 34, SY + 78, 7, 0xff2020);
    const rec = this.text(SX + 48, SY + 68, "REC", 18, "#ffffff", { fontFamily: MONO, fontStyle: "bold" });
    rec.setShadow(1, 1, "#000000", 0, false, true);
    L.add([dot, rec]);
    this.sc.tweens.add({ targets: dot, alpha: 0.1, duration: 500, yoyo: true, repeat: -1, ease: "Stepped" });
    const sp = this.text(SX + SW - 30, SY + 68, "SP ▮▮▮▯", 15, "#ffffff", { fontFamily: MONO, fontStyle: "bold" }).setOrigin(1, 0);
    sp.setShadow(1, 1, "#000000", 0, false, true);
    const tc = this.text(SX + SW - 30, SY + 88, "", 15, "#ffffff", { fontFamily: MONO, fontStyle: "bold" }).setOrigin(1, 0);
    tc.setShadow(1, 1, "#000000", 0, false, true);
    const date = this.text(SX + 28, SY + 92, "JUN 21 2025  7:52PM", 15, "#ffb347", { fontFamily: MONO, fontStyle: "bold" });
    date.setShadow(1, 1, "#3a1a00", 0, false, true);
    L.add([sp, tc, date]);
    // corner brackets
    const g = this.sc.add.graphics();
    g.lineStyle(2, 0xffffff, 0.8);
    const k = 18;
    for (const [x, y, sx, sy] of [[SX + 14, SY + 58, 1, 1], [SX + SW - 14, SY + 58, -1, 1], [SX + 14, SY + SH - 14, 1, -1], [SX + SW - 14, SY + SH - 14, -1, -1]]) {
      g.lineBetween(x, y, x + k * sx, y);
      g.lineBetween(x, y, x, y + k * sy);
    }
    L.add(g);
    if (!this.recStarted) this.recStarted = this.sc.time.now;
    const tick = () => {
      if (!tc.active) return;
      const s = Math.floor((this.sc.time.now - this.recStarted) / 1000) + 3 * 60 + 17;
      const f = Math.floor(((this.sc.time.now - this.recStarted) % 1000) / 40);
      tc.setText(`0:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(f).padStart(2, "0")}`);
    };
    tick();
    this.every(40, tick, -1, true);
  }

  /**
   * A dissolve: what's on screen now stays where it is and fades out over the next shot (the wedding video's
   * one transition). Call before building the new shot.
   */
  private dissolve(ms = 700) {
    if (!this.cam.list.length) return;
    const old = this.sc.add.container(this.cam.x, this.cam.y).setScale(this.cam.scaleX).setAngle(this.cam.angle).setDepth(4.5);
    old.setMask(this.maskG.createGeometryMask());
    for (const o of [...this.cam.list]) {
      this.cam.remove(o, false);
      old.add(o);
    }
    this.olds.push(old);
    this.sc.tweens.add({
      targets: old,
      alpha: 0,
      duration: ms,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.olds = this.olds.filter((c) => c !== old);
        old.destroy();
      },
    });
  }

  /** The lower third: a thin gold rule, the names in script, the occasion under them. */
  private lowerThird(name: string, sub: string, hold = 4200) {
    const { SX, SY, SH } = this.r;
    const x = SX + 34;
    const y = SY + SH - 168;
    const c = this.over(this.sc.add.container(0, 0).setAlpha(0));
    const g = this.sc.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x - 12, y - 6, 300, 68);
    g.lineStyle(1, 0xe8c27a, 0.95);
    g.lineBetween(x, y + 38, x + 250, y + 38);
    c.add(g);
    const n = this.text(x, y - 4, name, 30, "#fff6e4", { fontFamily: SCRIPT_FONT, fontStyle: "italic" });
    n.setShadow(0, 0, "#e8c27a", 8, false, true);
    const s = this.text(x + 2, y + 42, sub.toUpperCase(), 12, "#f2dcb0", { fontFamily: SERIF, fontStyle: "bold" });
    s.setLetterSpacing?.(3);
    c.add([n, s]);
    this.sc.tweens.add({ targets: c, alpha: 1, x: { from: -14, to: 0 }, duration: 900, ease: "Sine.easeOut" });
    this.later(hold, () => c.active && this.sc.tweens.add({ targets: c, alpha: 0, duration: 900, onComplete: () => c.destroy() }), true);
  }

  // ------------------------------------------------------------------ people

  /** A close-up from this show's own sheets (or their TV sprite if there isn't one). */
  private close(name: string, o: { side?: number; bg?: string | null; zoom?: number; blur?: number; expr?: number; scale?: number; dissolve?: boolean; ox?: number; oy?: number } = {}): Perf | null {
    const f = FACES[name];
    if (!f || !this.tex(f.key)) {
      if (o.dissolve) this.dissolve();
      return this.single(name, { side: o.side, bg: o.bg, zoom: o.zoom, blur: o.blur, expr: o.expr, recut: true });
    }
    if (o.dissolve) this.dissolve();
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const side = o.side ?? 0;
    this.backdrop(o.bg === undefined ? this.tex(SET.table) : o.bg, { zoom: o.zoom ?? 1.8, ox: -side * 100 + (o.ox ?? 0), oy: o.oy ?? -10, blur: o.blur ?? 3 });
    const x = SX + SW / 2 + side * SW * 0.22;
    const scale = o.scale ?? 3.1;
    const y = SY + SH + 4;
    const spr = this.add(this.sc.add.sprite(x, y, f.key, 0).setOrigin(0.5, 1).setScale(scale));
    const p: Perf = { name, spr, face: true, base: 0, scale, y, frames: f.base, gesturing: false, lip: f.lip, gest: f.gest, gUsed: 0 };
    this.perf = p;
    this.setBase(o.expr ?? F.NEUTRAL);
    this.idle(p);
    return p;
  }

  /** Someone small in a wider shot (a face sheet sprite), not made the performer. */
  private figure(name: string, x: number, y: number, scale: number, frame = 0) {
    const f = FACES[name];
    if (!f || !this.tex(f.key)) return null;
    const s = this.add(this.sc.add.sprite(x, y, f.key, frame).setOrigin(0.5, 1).setScale(scale));
    this.breathe(s, 1500 + (this.hash(name) % 700));
    return s;
  }

  private perfFor(name: string, s: Phaser.GameObjects.Sprite): Perf {
    const f = FACES[name];
    const p: Perf = { name, spr: s, face: true, base: 0, scale: s.scaleY, y: s.y, frames: f?.base ?? 3, gesturing: false, lip: !!f?.lip, gest: f?.gest ?? [], gUsed: 0 };
    this.perf = p;
    return p;
  }

  /** The top table, square on: Ruth, Jenko and Rory behind the flowers. Rory may be on his feet. */
  private topTable(standing: boolean, o: { dissolve?: boolean; rory?: number; jenko?: number; ruth?: number } = {}) {
    if (o.dissolve !== false) this.dissolve();
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex(SET.table), { zoom: 1.25, oy: 60, blur: 1 });
    const ground = SY + SH * 0.84;
    const ruth = this.figure("RUTH", SX + SW * 0.27, ground + 8, 1.75, o.ruth ?? 0);
    const jenko = this.figure("FLENKY", SX + SW * 0.5, ground + 14, 1.75, o.jenko ?? 0);
    const rory = this.figure("GRONNY", SX + SW * 0.74, ground - (standing ? 44 : 6), 1.85, o.rory ?? 0);
    const front = this.tex(SET.front);
    if (front) {
      const img = this.add(this.sc.add.image(this.cx, SY + SH + 8, front).setOrigin(0.5, 1));
      img.setScale((SW * 1.06) / img.width);
    }
    this.shotKind = "table";
    return { ruth, jenko, rory };
  }

  /** The guests, laughing (or gasping, or chanting): the crowd rocks in bands, out of step with each other. */
  private guests(mood: "laugh" | "big" | "gasp" | "chant" | "smirk", o: { dissolve?: boolean; zoom?: number; ox?: number; oy?: number } = {}) {
    if (o.dissolve) this.dissolve(500);
    this.clear();
    const key = this.tex(SET.guests);
    const z = o.zoom ?? 1.15;
    const base = this.backdrop(key, { zoom: z, ox: o.ox ?? 0, oy: o.oy ?? 0 });
    this.shotKind = "guests";
    if (!key) return;
    const tex = this.sc.textures.get(key).getSourceImage() as HTMLImageElement;
    const bands = 5;
    const top = tex.height * 0.36;
    const h = (tex.height - top) / bands;
    const amp = mood === "big" ? 3.2 : mood === "chant" ? 2.6 : mood === "laugh" ? 1.6 : mood === "gasp" ? 0 : 0.6;
    for (let i = 0; i < bands; i++) {
      const b = this.add(this.sc.add.image(base.x, base.y, key).setScale(base.scale));
      b.setCrop(0, top + i * h, tex.width, h + 1);
      if (amp) {
        const per = mood === "chant" ? 430 : 180 + i * 37;
        this.sc.tweens.add({ targets: b, y: b.y - amp * (1 + (i % 2) * 0.5), duration: per, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: i * 61 });
      }
    }
    if (mood === "gasp") this.crash(1.12, this.cx, this.cy);
    else this.push(z > 1.3 ? 1.04 : 1.1, 3800, this.cx, this.cy + 40);
  }

  /** Chanting, big across the picture: KISS HER! / RORY! */
  private chant(word: string, col: string) {
    const { SX, SY, SW, SH } = this.r;
    for (let i = 0; i < 6; i++) {
      this.later(i * 470, () => {
        const t = this.add(this.text(SX + SW * (0.25 + ((i * 37) % 50) / 100), SY + SH * (0.22 + ((i * 23) % 40) / 100), word, 34, col, { fontFamily: "Impact, Arial Black, sans-serif", stroke: "#2a1206", strokeThickness: 6 }).setOrigin(0.5));
        t.setAngle((i % 2 ? 1 : -1) * (4 + i));
        t.setScale(0.6);
        this.sc.tweens.add({ targets: t, scale: 1.25, alpha: { from: 1, to: 0 }, duration: 900, ease: "Quad.out", onComplete: () => t.destroy() });
      });
    }
  }

  /** Pulling at his collar: the shoulders jerk, the head ducks, again and again. */
  private tug(p: Perf) {
    p.spr.setFrame(F.GESTURE);
    p.base = F.GESTURE;
    this.sc.tweens.add({ targets: p.spr, y: p.y + 6, angle: -1.5, duration: 140, yoyo: true, repeat: 7, repeatDelay: 220, ease: "Quad.out" });
  }

  /** Beads of sweat running down the groom. */
  private sweat(p: Perf, n = 6) {
    for (let i = 0; i < n; i++) {
      this.later(200 + i * 420, () => {
        if (this.perf !== p) return;
        const x = p.spr.x + (Math.random() - 0.5) * 150;
        const d = this.add(this.sc.add.ellipse(x, p.spr.y - p.spr.displayHeight * 0.78, 5, 8, 0xbfe6ff, 0.9));
        this.sc.tweens.add({ targets: d, y: d.y + 70 + Math.random() * 40, alpha: 0, duration: 1400, ease: "Quad.in", onComplete: () => d.destroy() });
      });
    }
  }

  // ------------------------------------------------------------------ titles

  protected onTitle(t: string): number {
    this.titles++;
    if (this.titles === 1) return this.opening(t);
    return this.theEnd();
  }

  /** The video's opening: soft white, bokeh drifting, "Jenko & Ruth" in script, the date, the chapter. */
  private opening(t: string): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const bg = this.kenBurns(this.tex(SET.manor), { z: 1.5, x: 60, y: 20 }, { z: 1.3, x: -40, y: 10 }, 6000, { blur: 3 });
    bg.setAlpha(0.55);
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xfff4e0, 0.35).setOrigin(0));
    for (let i = 0; i < 16; i++) {
      const b = this.add(this.sc.add.circle(SX + Math.random() * SW, SY + Math.random() * SH, 8 + Math.random() * 22, 0xffe2a8, 0.18 + Math.random() * 0.2));
      b.setBlendMode(Phaser.BlendModes.ADD);
      this.sc.tweens.add({ targets: b, y: b.y - 40 - Math.random() * 60, x: b.x + (Math.random() - 0.5) * 50, alpha: 0, duration: 4000 + Math.random() * 2000 });
    }
    const names = this.add(this.text(this.cx, this.cy - 40, "Jenko & Ruth", 64, "#fffaf0", { fontFamily: SCRIPT_FONT, fontStyle: "italic" }).setOrigin(0.5).setAlpha(0));
    names.setShadow(0, 0, "#c9953a", 14, true, true);
    const date = this.add(this.text(this.cx, this.cy + 22, "21 · 06 · 2025", 18, "#7a4a1a", { fontFamily: SERIF, fontStyle: "bold" }).setOrigin(0.5).setAlpha(0));
    const sub = this.add(this.text(this.cx, this.cy + 60, t.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()), 22, "#5a3210", { fontFamily: SERIF, fontStyle: "italic" }).setOrigin(0.5).setAlpha(0));
    const rule = this.add(this.sc.add.rectangle(this.cx, this.cy + 40, 0, 1, 0xb88a3a));
    this.sc.tweens.add({ targets: names, alpha: 1, y: names.y + 8, duration: 1600, delay: 300, ease: "Sine.easeOut" });
    this.sc.tweens.add({ targets: rule, width: 220, duration: 1200, delay: 1200 });
    this.sc.tweens.add({ targets: date, alpha: 1, duration: 900, delay: 1500 });
    this.sc.tweens.add({ targets: sub, alpha: 1, duration: 900, delay: 2300 });
    if (!this.music) {
      this.music = true;
      synth.music("bm_wedding", true);
    }
    return 5200;
  }

  private theEnd(): number {
    this.ended = true;
    this.dissolve(1600);
    this.clear();
    this.cinematic();
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    const t = this.add(this.text(this.cx, this.cy - 10, "The End", 58, "#fff1d6", { fontFamily: SCRIPT_FONT, fontStyle: "italic" }).setOrigin(0.5).setAlpha(0));
    t.setShadow(0, 0, "#c9953a", 12, true, true);
    const s = this.add(this.text(this.cx, this.cy + 46, "with love, from the best man", 14, "#a08060", { fontFamily: SERIF, fontStyle: "italic" }).setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: t, alpha: 1, duration: 1800, delay: 600 });
    this.sc.tweens.add({ targets: s, alpha: 1, duration: 1400, delay: 1800 });
    this.later(3800, () => synth.stopMusic());
    return 4200;
  }

  // ------------------------------------------------------------------ shots

  protected onShot(set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    if (/MANOR/i.test(set)) return this.establish();
    return 0;
  }

  /** The drone-ish glide across the lawn and the manor, in the low sun. */
  private establish(): number {
    this.dissolve(1200);
    this.clear();
    this.kenBurns(this.tex(SET.manor), { z: 1.45, x: 120, y: 30 }, { z: 1.12, x: -60, y: 0 }, 7000);
    // the sun flaring as we pass it
    const { SX, SY, SW } = this.r;
    const sun = this.add(this.sc.add.circle(SX + SW * 0.62, SY + 110, 70, 0xffd080, 0.25));
    sun.setBlendMode(Phaser.BlendModes.ADD);
    this.sc.tweens.add({ targets: sun, x: sun.x - 120, alpha: 0.45, scale: 1.4, duration: 7000 });
    this.shotKind = "establish";
    return 1500;
  }

  // ------------------------------------------------------------------ dialogue

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (this.ended) return 0;
    const vo = /^V\.?\s*O\.?$/i.test(emotion);
    if (name === "FLENKY" && vo) return this.thought(text);
    if (name === "GRONNY") return this.rory(text, emotion);
    if (name === "MOLE PERSON") return this.mole(text, emotion);
    if (name === "WEDDING GUEST") return this.mutter(text, emotion);
    if (name === "CROWD") return this.crowd(text);
    const p = this.close(name, { dissolve: true });
    if (p) this.talk(p, name, text, emotion);
    return 0;
  }

  /**
   * What Jenko's thinking: hold on his face, mouth shut, a slow push the whole way through. He gets worse
   * every time.
   */
  private thought(text: string): number {
    this.vo++;
    const n = this.vo;
    if (n === 6) return this.phoneThought();
    const expr = n === 1 ? F.NEUTRAL : n === 2 ? F.LAUGH : n === 3 ? F.ALARM : n === 4 ? F.GESTURE : F.SPECIAL;
    const stay = this.perf?.name === "FLENKY" && this.shotKind === "jenko";
    const p = stay ? this.perf! : this.close("FLENKY", { side: -0.15, dissolve: true, expr, zoom: 2, ox: 60 });
    if (!p) return 0;
    this.shotKind = "jenko";
    this.setBase(expr);
    if (!stay) this.camProxy.s = 1;
    const len = Math.max(4000, text.length * 75);
    this.push(n >= 4 ? 1.3 : 1.2, len, p.spr.x, p.spr.y - 250);
    // a darker edge while we're in his head
    const { SX, SY, SW, SH } = this.r;
    const v = this.add(this.sc.add.graphics());
    for (let i = 0; i < 6; i++) {
      v.lineStyle(26, 0x000000, 0.07);
      v.strokeRect(SX - 20 + i * 14, SY - 20 + i * 14, SW + 40 - i * 28, SH + 40 - i * 28);
    }
    v.setAlpha(0);
    this.sc.tweens.add({ targets: v, alpha: 1, duration: 900 });
    if (n === 3) {
      this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 10, duration: 700, yoyo: true, repeat: 1, ease: "Sine.easeInOut" });
      this.sweat(p, 5);
    }
    if (n === 4) {
      p.spr.setTint(0xffd0c0);
      this.sweat(p, 8);
      this.tug(p);
    }
    if (n === 5) {
      this.sweat(p, 9);
      this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 1.5, duration: 60, yoyo: true, repeat: -1 });
    }
    // a blink in the middle, the way people do when they're trying to hold it together
    if (n <= 2) this.later(len * 0.5, () => this.perf === p && p.spr.frame.name == String(p.base) && (p.spr.setFrame(F.BLINK), this.later(140, () => p.spr.active && p.spr.setFrame(p.base))));
    return 0;
  }

  /** Rory's speech: on his feet at the top table, mostly in his single, the wide when he plays to the room. */
  private rory(text: string, emotion: string): number {
    this.roryLines++;
    const e = emotion.toLowerCase();
    const n = this.roryLines;
    let p: Perf | null = null;
    if (n === 1 || /gestures toward/.test(e)) {
      // the wide: everybody, and the groom's face
      const t = this.topTable(true, { rory: F.NEUTRAL, jenko: n === 1 ? F.NEUTRAL : F.NEUTRAL, ruth: F.NEUTRAL });
      if (t.rory) p = this.perfFor("GRONNY", t.rory);
      this.push(1.08, 6000, this.cx + 60, this.cy);
      if (n === 1) this.later(600, () => this.lowerThird("Rory", "Best Man", 3800), true);
    } else if (/arm around ruth|mine now/i.test(text + e) || this.shotKind === "couple") {
      p = this.couple(text);
    } else {
      const side = n % 2 ? 0.22 : -0.22;
      const expr = /catching his breath/.test(e) ? F.LAUGH : F.NEUTRAL;
      p = this.close("GRONNY", { side, dissolve: true, zoom: 1.9, ox: n * 30, expr });
      this.shotKind = "rory";
      if (p) this.push(1.1, 6000, p.spr.x, p.spr.y - 250);
    }
    if (!p) return 0;
    if (/catching his breath/.test(e)) {
      // still giggling: laugh, then into the line
      p.base = F.NEUTRAL;
      p.gesturing = true;
      p.spr.setFrame(F.LAUGH);
      this.sc.tweens.add({ targets: p.spr, angle: { from: -1.5, to: 1.5 }, duration: 140, yoyo: true, repeat: 4 });
      this.later(1100, () => {
        p!.gesturing = false;
        p!.spr.setAngle(0);
        if (this.perf === p) this.talk(p!, "GRONNY", text, "");
      });
      return 0;
    }
    if (/raising his arms|building momentum/.test(e)) this.later(400, () => this.perf === p && this.playGesture(p!, POINT, 1600));
    else if (/scrolling on his phone/.test(e)) this.later(300, () => this.perf === p && this.playGesture(p!, TOAST, 1500));
    this.talk(p, "GRONNY", text, emotion);
    return 0;
  }

  /** Rory and the bride, cheek to cheek. */
  private couple(text: string): Perf | null {
    const fresh = this.shotKind !== "couple";
    if (fresh) {
      this.dissolve(900);
      this.clear();
      this.cinematic();
      const { SX, SY, SW, SH } = this.r;
      this.backdrop(this.tex(SET.table), { zoom: 2.1, oy: -30, ox: -80, blur: 4 });
      const ruth = this.figure("RUTH", SX + SW * 0.71, SY + SH + 6, 2.45, F.SPECIAL);
      const rory = this.figure("GRONNY", SX + SW * 0.3, SY + SH + 8, 2.6, F.NEUTRAL);
      if (ruth) {
        ruth.setAngle(-7);
        this.sc.tweens.add({ targets: ruth, x: ruth.x - 18, angle: -10, duration: 2400, ease: "Sine.easeOut" });
      }
      // hearts drifting up through the soft focus
      for (let i = 0; i < 7; i++) {
        this.later(i * 500, () => {
          const h = this.add(this.text(SX + SW * (0.3 + Math.random() * 0.4), SY + SH * 0.7, "♥", 18 + Math.random() * 14, "#ff9fb8").setOrigin(0.5).setAlpha(0.8));
          this.sc.tweens.add({ targets: h, y: h.y - 200, alpha: 0, duration: 3000, ease: "Sine.easeOut", onComplete: () => h.destroy() });
        });
      }
      this.shotKind = "couple";
      this.push(1.12, 7000, this.cx, this.cy);
      if (!rory) return null;
      return this.perfFor("GRONNY", rory);
    }
    void text;
    return this.perf;
  }

  private mole(text: string, emotion: string): number {
    this.camcorderOn();
    const p = this.perf?.name === "MOLE PERSON" ? this.perf : this.close("MOLE PERSON", { bg: this.tex(SET.doors), zoom: 1.6, blur: 2, expr: F.NEUTRAL });
    if (!p) return 0;
    this.shotKind = "mole";
    this.crash(1.18, p.spr.x, p.spr.y - 230);
    this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 5, duration: 70, yoyo: true, repeat: -1 });
    // the paws going: the whole costume lurches with every word
    this.sc.tweens.add({ targets: p.spr, angle: { from: -4, to: 4 }, duration: 190, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    synth.play("shriek");
    this.talk(p, "MOLE PERSON", text, emotion);
    return 0;
  }

  /** "He doesn't have the bottle": leant in to the woman beside him. */
  private mutter(text: string, emotion: string): number {
    const p = this.twoGuests(false);
    if (!p) return 0;
    this.talk(p, "WEDDING GUEST", text, emotion);
    return 0;
  }

  private twoGuests(smirk: boolean): Perf | null {
    const fresh = this.shotKind !== "pair";
    const { SX, SY, SW, SH } = this.r;
    if (fresh) {
      this.dissolve();
      this.clear();
      this.backdrop(this.tex(SET.guests), { zoom: 2.4, ox: 120, oy: 60, blur: 3 });
      const w = this.tex(SET.woman);
      if (w) {
        const s = this.add(this.sc.add.image(SX + SW * 0.68, SY + SH + 6, w).setOrigin(0.5, 1).setScale(2.6));
        this.breathe(s as unknown as Phaser.GameObjects.Sprite, 1800);
      }
      const g = this.figure("WEDDING GUEST", SX + SW * 0.34, SY + SH + 6, 2.75, 1);
      this.shotKind = "pair";
      this.push(1.08, 5000, this.cx, this.cy);
      if (!g) return null;
      g.setAngle(6);
      const p = this.perfFor("WEDDING GUEST", g);
      p.base = F.NEUTRAL;
      return p;
    }
    const p = this.perf;
    if (p && smirk) {
      p.base = F.LAUGH;
      p.spr.setFrame(F.LAUGH);
      p.spr.setAngle(0);
      this.sc.tweens.add({ targets: p.spr, y: p.spr.y + 3, duration: 160, yoyo: true, repeat: 3 });
    }
    return p;
  }

  private crowd(text: string): number {
    const kiss = /KISS/i.test(text);
    this.guests("chant", { dissolve: false, zoom: 1.25, oy: -10 });
    this.chant(kiss ? "KISS HER!" : "RORY!", kiss ? "#ffd6e4" : "#ffe08a");
    synth.play("cheer");
    if (kiss && this.pig) {
      // the bride-to-be, in the corner of the shot, being pushed closer
      const s = this.pigSprite(this.r.SX + this.r.SW * 0.82, this.r.SY + this.r.SH + 10, 2.1);
      if (s) this.sc.tweens.add({ targets: s, x: s.x - 40, duration: 2400 });
    }
    return 0;
  }

  // ------------------------------------------------------------------ action

  protected onDirection(a: string): number {
    if (this.ended) return 0;
    if (/camera pans across a picturesque/i.test(a)) return 0;
    if (/stands at the head table/i.test(a)) {
      this.topTable(false);
      this.push(1.06, 6000, this.cx, this.cy);
      this.later(900, () => this.lowerThird("Jenko & Ruth", "The Speeches"), true);
      return 2600;
    }
    if (/clears his throat/i.test(a)) {
      const p = this.close("GRONNY", { side: 0.2, dissolve: true, zoom: 1.9, expr: F.NEUTRAL });
      this.shotKind = "rory";
      if (p) {
        this.push(1.06, 3000, p.spr.x, p.spr.y - 240);
        this.later(200, () => this.perf === p && this.playGesture(p, TOAST, 1600));
      }
      return 1600;
    }
    if (/zooms in on Jenko's nervous face/i.test(a)) return 0;
    if (/Jenko relaxes/i.test(a)) {
      const p = this.close("FLENKY", { side: -0.15, dissolve: true, expr: F.LAUGH, zoom: 2, ox: 60 });
      this.shotKind = "jenko";
      if (p) this.push(1.08, 3000, p.spr.x, p.spr.y - 250);
      return 900;
    }
    if (/shifts uncomfortably/i.test(a)) {
      const p = this.close("FLENKY", { side: -0.15, dissolve: true, expr: F.ALARM, zoom: 2, ox: 60 });
      this.shotKind = "jenko";
      if (p) {
        this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 14, angle: 2, duration: 500, yoyo: true, repeat: 1, ease: "Sine.easeInOut" });
        this.sweat(p, 4);
      }
      return 1200;
    }
    if (/turns red in the face/i.test(a)) {
      const p = this.close("FLENKY", { side: -0.15, dissolve: true, expr: F.GESTURE, zoom: 2, ox: 60 });
      this.shotKind = "jenko";
      if (p) {
        p.spr.setTint(0xffc8b8);
        this.tug(p);
        this.sweat(p, 6);
        this.push(1.15, 3000, p.spr.x, p.spr.y - 250);
      }
      return 1800;
    }
    if (/screen flashes to a plaque/i.test(a)) return this.slideshow();
    if (/crowd gasps/i.test(a)) {
      // the room, then the bride (her family is right here)
      this.guests("gasp", { dissolve: false, zoom: 1.25 });
      synth.play("gasp");
      this.later(1100, () => {
        const p = this.close("RUTH", { side: 0.25, dissolve: false, expr: F.ALARM, zoom: 2 });
        this.shotKind = "ruth";
        if (p) this.crash(1.15, p.spr.x, p.spr.y - 230);
      });
      return 2200;
    }
    if (/one man leans over/i.test(a)) {
      this.guests("smirk", { dissolve: true, zoom: 1.5, ox: 90, oy: 40 });
      this.push(1.35, 2400, this.cx + 80, this.cy + 40);
      return 1600;
    }
    if (/both smirk/i.test(a)) {
      this.twoGuests(true);
      this.later(1300, () => {
        // ...and look over at the groom
        const p = this.close("FLENKY", { side: -0.15, dissolve: true, expr: F.SPECIAL, zoom: 2, ox: 60 });
        this.shotKind = "jenko";
        if (p) this.push(1.1, 2000, p.spr.x, p.spr.y - 250);
      });
      return 2400;
    }
    if (/door bursts open/i.test(a)) return this.moleEntrance();
    if (/barrels into Jenko/i.test(a)) return this.tackle();
    if (/Security rushes in/i.test(a)) return this.security();
    if (/fits of laughter/i.test(a)) {
      const p = this.close("GRONNY", { side: 0.2, dissolve: false, expr: F.LAUGH, zoom: 1.9 });
      this.shotKind = "rory";
      if (p) {
        this.sc.tweens.add({ targets: p.spr, angle: { from: -2, to: 2 }, y: p.y + 4, duration: 150, yoyo: true, repeat: 10 });
        this.push(1.08, 2500, p.spr.x, p.spr.y - 240);
      }
      return 1400;
    }
    if (/mud-encrusted pig is wheeled in/i.test(a)) return this.pigEntrance();
    if (/stares in horror/i.test(a)) {
      const p = this.close("FLENKY", { side: 0, expr: F.ALARM, zoom: 2.1, bg: this.tex(SET.doors) });
      this.shotKind = "jenko";
      if (p) {
        this.crash(1.3, p.spr.x, p.spr.y - 260);
        this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 2, duration: 50, yoyo: true, repeat: -1 });
      }
      synth.play("tv_sting");
      return 1200;
    }
    if (/puts his arm around Ruth/i.test(a)) {
      this.couple("");
      return 1800;
    }
    if (/turns to Ruth with a grin/i.test(a)) {
      if (this.shotKind !== "couple") this.couple("");
      const p = this.perf;
      if (p && p.name === "GRONNY") {
        p.base = F.SPECIAL;
        p.spr.setFrame(F.SPECIAL);
        this.sc.tweens.add({ targets: p.spr, angle: 4, x: p.spr.x + 10, duration: 500, ease: "Sine.easeOut" });
        this.later(1300, () => {
          if (this.perf !== p) return;
          p.base = F.NEUTRAL;
          p.spr.setAngle(0);
        });
      }
      return 1300;
    }
    if (/playfully agrees/i.test(a)) {
      const p = this.close("RUTH", { side: 0.2, dissolve: true, expr: F.SPECIAL, zoom: 2.1 });
      this.shotKind = "ruth";
      if (p) {
        this.push(1.12, 2600, p.spr.x, p.spr.y - 230);
        this.later(500, () => p.spr.active && p.spr.setFrame(F.LAUGH));
        this.sc.tweens.add({ targets: p.spr, y: p.y + 5, duration: 220, yoyo: true, repeat: 3, delay: 500 });
        this.later(1500, () => p.spr.active && p.spr.setFrame(F.SPECIAL));
      }
      return 1600;
    }
    if (/pulls out his phone/i.test(a)) return this.phone(0);
    if (/books an Uber/i.test(a)) return this.phone(2);
    if (/fades to black/i.test(a)) return this.fadeOut();
    return 0;
  }

  protected onAudience(cue: string): number {
    if (this.ended) return 0;
    if (cue === "laugh") {
      this.guests("laugh", { dissolve: true, zoom: 1.2 + (this.roryLines % 3) * 0.12, ox: (this.roryLines % 2 ? 1 : -1) * 50 });
      return 600;
    }
    if (cue === "biglaugh") {
      this.guests("big", { dissolve: !this.camcorder, zoom: 1.15 });
      // tears of laughter
      return 600;
    }
    if (cue === "gasp" && this.shotKind === "slide") {
      // hold on the plaque: a jolt in
      this.crash(this.camProxy.s * 1.12, this.cx, this.cy);
      synth.play("crowd_gasp");
      return 0;
    }
    if (cue === "gasp") {
      this.guests("gasp", { dissolve: false, zoom: 1.25 });
      synth.play("crowd_gasp");
      return 500;
    }
    if (cue === "cheer" || cue === "whistle") {
      this.guests("chant", { dissolve: false, zoom: 1.2 });
      if (cue === "cheer") this.fx("vfx_confetti", this.cx, this.r.SY + 60, { scale: 3 });
      return 300;
    }
    return 0;
  }

  protected onSfx(id: string): number {
    if (id === "ding") return this.glass();
    if (id === "zap") {
      this.sc.cameras.main.flash(90, 200, 220, 255);
      return 0;
    }
    return 0;
  }

  protected onTransition(mode: string): number {
    if (mode === "fade") return 0;
    return super.onTransition(mode);
  }

  // ------------------------------------------------------------------ set pieces

  /** The insert: a knife tapping a champagne flute, the ring of it. */
  private glass(): number {
    this.dissolve(300);
    this.clear();
    const { SY, SH } = this.r;
    this.backdrop(this.tex(SET.table), { zoom: 3, oy: -60, blur: 6 });
    const g = this.add(this.sc.add.container(this.cx, SY + SH * 0.62));
    const gfx = this.sc.add.graphics();
    gfx.fillStyle(0xfff0c8, 0.35);
    gfx.fillTriangle(-40, -150, 40, -150, 0, 30);
    gfx.fillStyle(0xf3d27a, 0.85);
    gfx.fillTriangle(-30, -110, 30, -110, 0, 20);
    gfx.lineStyle(3, 0xffffff, 0.8);
    gfx.strokeTriangle(-40, -150, 40, -150, 0, 30);
    gfx.fillStyle(0xffffff, 0.7);
    gfx.fillRect(-3, 30, 6, 110);
    gfx.fillEllipse(0, 142, 90, 16);
    for (let i = 0; i < 8; i++) gfx.fillCircle(-12 + Math.random() * 24, -100 + Math.random() * 110, 2);
    g.add(gfx);
    const knife = this.add(this.sc.add.rectangle(this.cx + 120, SY + SH * 0.45, 130, 8, 0xd8dde4).setAngle(-20));
    for (let i = 0; i < 3; i++) {
      this.sc.tweens.add({ targets: knife, x: this.cx + 52, duration: 110, yoyo: true, delay: i * 330 });
      this.later(i * 330 + 110, () => {
        const ring = this.add(this.sc.add.circle(this.cx + 30, SY + SH * 0.4, 10).setStrokeStyle(2, 0xffffff, 0.9));
        this.sc.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
      });
    }
    this.push(1.1, 1400, this.cx, SY + SH * 0.4);
    this.shotKind = "glass";
    return 1100;
  }

  /** The slideshow: the screen at the side of the lawn, then the slide itself, and the plaque. */
  private slideshow(): number {
    this.dissolve(250);
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex(SET.guests), { zoom: 1.3, oy: 30, blur: 4, tint: 0xb08a70 });
    const sx = this.cx + 20;
    const sy = SY + SH * 0.38;
    const sw = 300;
    const sh = 225;
    const legs = this.add(this.sc.add.graphics());
    legs.lineStyle(4, 0x2a2a2a);
    legs.lineBetween(sx, sy + sh / 2, sx - 70, SY + SH);
    legs.lineBetween(sx, sy + sh / 2, sx + 70, SY + SH);
    legs.lineBetween(sx, sy + sh / 2, sx, SY + SH);
    this.add(this.sc.add.rectangle(sx, sy, sw + 16, sh + 16, 0x161616));
    const screen = this.add(this.sc.add.rectangle(sx, sy, sw, sh, 0xf8f8f8));
    const slide = this.tex(SET.slide);
    let img: Phaser.GameObjects.Image | null = null;
    if (slide) {
      img = this.add(this.sc.add.image(sx, sy, slide).setScale(sw / 320).setAlpha(0));
      this.plaqueText(img);
    }
    // the projector's beam
    const beam = this.add(this.sc.add.triangle(0, 0, SX + SW * 0.1, SY + SH, sx - sw / 2, sy - sh / 2, sx - sw / 2, sy + sh / 2, 0xfff4d0, 0.08).setOrigin(0));
    void beam;
    this.sc.cameras.main.flash(160, 255, 255, 255);
    synth.play("camera_flash");
    this.later(250, () => img && this.sc.tweens.add({ targets: [img, ...this.cam.list.filter((o) => o.getData?.("plaque"))], alpha: 1, duration: 300 }));
    this.later(300, () => screen.setFillStyle(0xffffff));
    this.shotKind = "slide";
    // push in until the slide fills the frame, then hold on the plaque
    this.later(500, () => this.push(SW / sw, 1300, sx, sy, "Quad.inOut"));
    this.later(1900, () => {
      this.dissolve(800);
      this.clear();
      const full = this.kenBurns(slide, { z: 1.0, x: 0, y: 0 }, { z: 2.3, x: 149, y: -270 }, 4200);
      this.plaqueText(full);
      for (const o of this.cam.list) if (o.getData?.("plaque")) (o as Phaser.GameObjects.Text).setAlpha(1);
    });
    return 5200;
  }

  /** "In loving memory of James Jenkins", engraved on the blank plaque of whichever copy of the photo. */
  private plaqueText(img: Phaser.GameObjects.Image) {
    const s = img.scale;
    const ox = img.x - (img.width * s) / 2;
    const oy = img.y - (img.height * s) / 2;
    const t = this.add(
      this.text(ox + (PLAQUE.x + PLAQUE.w / 2) * s, oy + (PLAQUE.y + PLAQUE.h / 2) * s, "IN LOVING\nMEMORY OF\nJAMES\nJENKINS", Math.max(4, 5.4 * s), "#3a2608", { fontFamily: SERIF, fontStyle: "bold", align: "center" })
        .setOrigin(0.5)
        .setAlpha(img.alpha)
        .setData("plaque", true),
    );
    t.setLineSpacing(-1 * s).setAngle(-3);
    // follow the photo while it moves
    const follow = () => {
      if (!t.active || !img.active) return;
      const k = img.scale / s;
      const nx = img.x - (img.width * img.scale) / 2;
      const ny = img.y - (img.height * img.scale) / 2;
      t.setPosition(nx + (PLAQUE.x + PLAQUE.w / 2) * img.scale, ny + (PLAQUE.y + PLAQUE.h / 2) * img.scale).setScale(k);
    };
    this.every(16, follow);
    return t;
  }

  /** The doors fly open and the mole comes sprinting down the aisle at us. */
  private moleEntrance(): number {
    this.camcorderOn();
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex(SET.doors), { zoom: 1.25, oy: 20 });
    this.sc.cameras.main.shake(300, 0.01);
    synth.play("door");
    const key = this.tex(SET.mole);
    if (key) {
      const m = this.add(this.sc.add.sprite(this.cx + 8, SY + SH * 0.62, key, 0).setOrigin(0.5, 1).setScale(0.5));
      let f = 0;
      const frames = this.sc.textures.get(key).frameTotal - 1;
      this.every(80, () => m.active && m.setFrame((f = (f + 1) % Math.max(1, frames))));
      this.sc.tweens.add({ targets: m, scale: 3.6, y: SY + SH + 160, duration: 2600, ease: "Quad.in" });
      this.sc.tweens.add({ targets: m, angle: { from: -6, to: 6 }, duration: 160, yoyo: true, repeat: -1 });
    }
    this.later(300, () => synth.play("shriek"));
    this.later(1200, () => this.crash(1.25, this.cx, SY + SH * 0.5));
    this.shotKind = "doors";
    void SX;
    void SW;
    return 2600;
  }

  /** It hits the groom: he goes over backwards out of the bottom of the frame. */
  private tackle(): number {
    const { SX, SY, SW, SH } = this.r;
    const p = this.close("FLENKY", { side: 0.1, expr: F.ALARM, zoom: 2, ox: 60 });
    this.shotKind = "jenko";
    const key = this.tex(SET.mole);
    if (key) {
      const m = this.add(this.sc.add.sprite(SX - 120, SY + SH * 0.85, key, 3).setOrigin(0.5, 1).setScale(3.4));
      this.sc.tweens.add({ targets: m, x: this.cx, duration: 520, ease: "Quad.in" });
    }
    this.later(520, () => {
      this.sc.cameras.main.shake(380, 0.02);
      this.sc.cameras.main.flash(80, 255, 255, 255);
      if (p) {
        p.gesturing = true;
        this.sc.tweens.add({ targets: p.spr, angle: 70, x: p.spr.x + 260, y: p.spr.y + 300, duration: 700, ease: "Quad.in" });
      }
      this.push(1.2, 300, this.cx, this.cy);
      synth.play("hurt_1");
    });
    void SW;
    return 1400;
  }

  /** Security: in from the side, the taser, the crackle, and the mole dragged off by its ankles. */
  private security(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex(SET.table), { zoom: 1.4, oy: 80, blur: 1 });
    const moleKey = this.tex(SET.mole);
    const m = moleKey ? this.add(this.sc.add.sprite(SX + SW * 0.62, SY + SH * 0.98, moleKey, 2).setOrigin(0.5, 1).setScale(2.6).setFlipX(true)) : null;
    const secKey = this.tex(SET.security);
    const s = secKey ? this.add(this.sc.add.image(SX - 80, SY + SH * 0.98, secKey).setOrigin(0.5, 1).setScale(2.8)) : null;
    if (s) {
      this.sc.tweens.add({ targets: s, x: SX + SW * 0.24, duration: 700, ease: "Quad.out" });
      this.sc.tweens.add({ targets: s, y: s.y - 6, duration: 120, yoyo: true, repeat: 2 });
    }
    // the zap: jagged blue lines from the taser to the mole, every frame for a second and a half
    const bolt = this.add(this.sc.add.graphics());
    this.later(800, () => {
      synth.play("zap");
      this.sc.cameras.main.flash(70, 180, 210, 255);
      let n = 0;
      this.every(
        45,
        () => {
          bolt.clear();
          if (!s || !m || n++ > 32) return;
          const x0 = s.x + s.displayWidth * 0.36;
          const y0 = s.y - s.displayHeight * 0.62;
          const x1 = m.x - 20;
          const y1 = m.y - m.displayHeight * 0.55;
          for (let k = 0; k < 2; k++) {
            bolt.lineStyle(k ? 2 : 4, k ? 0xffffff : 0x6aa8ff, 0.95);
            bolt.beginPath();
            bolt.moveTo(x0, y0);
            for (let i = 1; i < 8; i++) bolt.lineTo(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8 + (Math.random() - 0.5) * 26);
            bolt.lineTo(x1, y1);
            bolt.strokePath();
          }
          if (m) {
            m.setTint(n % 2 ? 0xbfe0ff : 0xffffff);
            m.x += (Math.random() - 0.5) * 8;
          }
        },
        34,
      );
    });
    // a quick insert: the mole, electrified
    this.later(1500, () => {
      const f = FACES["MOLE PERSON"];
      if (!this.tex(f.key)) return;
      const ins = this.add(this.sc.add.sprite(this.cx, SY + SH + 4, f.key, F.ALARM).setOrigin(0.5, 1).setScale(3.2));
      this.sc.tweens.add({ targets: ins, x: ins.x + 4, duration: 40, yoyo: true, repeat: 14 });
      this.later(700, () => ins.destroy());
    });
    // dragged off
    this.later(2400, () => {
      bolt.clear();
      if (m) {
        m.clearTint();
        m.setAngle(-80);
        this.sc.tweens.add({ targets: m, x: SX - 160, duration: 1500, ease: "Quad.in" });
      }
      if (s) {
        s.setFlipX(true);
        this.sc.tweens.add({ targets: s, x: SX - 260, duration: 1500, ease: "Quad.in" });
      }
    });
    this.shotKind = "security";
    return 3600;
  }

  private pigSprite(x: number, y: number, scale: number) {
    const key = this.tex(SET.pig);
    if (!key) return null;
    const s = this.add(this.sc.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(scale));
    const frames = this.sc.textures.get(key).frameTotal - 1;
    if (frames > 1) {
      let f = 0;
      this.every(130, () => s.active && s.setFrame((f = (f + 1) % frames)));
    }
    // flies
    for (let i = 0; i < 4; i++) {
      const fl = this.add(this.sc.add.circle(x, y - s.displayHeight * 0.7, 2, 0x111111));
      const r = 20 + i * 9;
      const ph = Math.random() * Math.PI * 2;
      this.every(40, () => {
        if (!fl.active) return;
        const t = this.sc.time.now / (300 + i * 60) + ph;
        fl.setPosition(s.x + Math.cos(t) * r, s.y - s.displayHeight * 0.75 + Math.sin(t * 1.7) * r * 0.5);
      });
    }
    return s;
  }

  /** Esther, wheeled in on a catering trolley, through the doors and up the aisle. */
  private pigEntrance(): number {
    this.pig = true;
    this.camcorderOn();
    this.dissolve(300);
    this.clear();
    const { SY, SH } = this.r;
    this.backdrop(this.tex(SET.doors), { zoom: 1.25, oy: 20 });
    synth.play("dooropen");
    const s = this.pigSprite(this.cx, SY + SH * 0.68, 0.7);
    if (s) {
      this.sc.tweens.add({ targets: s, scale: 2.9, y: SY + SH + 40, duration: 3400, ease: "Sine.easeIn" });
      this.sc.tweens.add({ targets: s, angle: { from: -1.5, to: 1.5 }, duration: 110, yoyo: true, repeat: -1 });
    }
    this.later(900, () => synth.play("groan"));
    this.later(2000, () => this.push(1.15, 1400, this.cx, SY + SH * 0.7));
    this.shotKind = "pig";
    return 3000;
  }

  /** The groom gets his phone out. */
  private phone(stage: number): number {
    this.cinematic();
    this.float = 0.4;
    const { SX, SY, SW, SH } = this.r;
    if (stage === 0) {
      const p = this.close("FLENKY", { side: -0.2, dissolve: true, expr: F.SPECIAL, zoom: 2.2, ox: 90 });
      this.shotKind = "jenko";
      if (p) {
        p.spr.clearTint();
        this.later(300, () => this.perf === p && this.playGesture(p, PHONE, 1800, () => p.spr.active && p.spr.setFrame((p.gest?.[PHONE]?.[0] ?? 24) + 7)));
        this.push(1.1, 3000, p.spr.x, p.spr.y - 230);
        // the party, carrying on behind him
        this.later(1500, () => synth.play("laugh"));
      }
      return 2400;
    }
    // over his shoulder: the app
    this.dissolve(500);
    this.clear();
    this.backdrop(this.tex(SET.table), { zoom: 2.2, blur: 6, tint: 0x9a8070 });
    const ph = this.add(this.sc.add.container(this.cx + 30, SY + SH * 0.5).setScale(0.86));
    ph.add(this.sc.add.rectangle(0, 0, 196, 380, 0x0c0c0c).setStrokeStyle(4, 0x3a3a3a));
    ph.add(this.sc.add.rectangle(0, 0, 178, 350, 0xf2f2f2));
    const map = this.sc.add.graphics();
    map.fillStyle(0xdfe7da);
    map.fillRect(-89, -175, 178, 210);
    map.fillStyle(0x9cc3e6);
    map.fillRect(-89, -60, 178, 46);
    map.lineStyle(6, 0xffffff);
    map.lineBetween(-89, -120, 89, -80);
    map.lineBetween(-30, -175, -10, 35);
    map.lineStyle(4, 0x111111);
    map.lineBetween(-20, -100, 50, -37);
    map.fillStyle(0x111111);
    map.fillCircle(-20, -100, 6);
    map.fillRect(46, -41, 9, 9);
    ph.add(map);
    ph.add(this.text(-80, -168, "Uber", 16, "#111111", { fontFamily: "Arial, sans-serif", fontStyle: "bold" }));
    const where = this.text(-78, 48, "Where to?", 15, "#555555", { fontFamily: "Arial, sans-serif" });
    ph.add(this.sc.add.rectangle(0, 58, 160, 30, 0xe6e6e6));
    ph.add(where);
    const dest = this.text(-78, 92, "", 12, "#111111", { fontFamily: "Arial, sans-serif", fontStyle: "bold" });
    ph.add(dest);
    const btn = this.sc.add.rectangle(0, 150, 160, 34, 0x111111).setAlpha(0);
    const btnT = this.text(0, 150, "Confirm UberX", 13, "#ffffff", { fontFamily: "Arial, sans-serif", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0);
    ph.add([btn, btnT]);
    const thumb = this.add(this.sc.add.ellipse(this.cx + 150, SY + SH + 40, 70, 110, 0xe8b48c));
    this.sc.tweens.add({ targets: ph, y: ph.y - 8, duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const typed = "Itchen Bridge, Southampton";
    let i = 0;
    this.later(500, () => {
      where.setText("");
      this.every(
        70,
        () => {
          i++;
          where.setText(typed.slice(0, Math.min(i, 13)) + (i < 13 ? "|" : ""));
          synth.play("tap");
        },
        12,
      );
    });
    this.later(1600, () => {
      dest.setText("Itchen Bridge\nSouthampton SO19\nUberX · 4 min · £11.20");
      this.sc.tweens.add({ targets: [btn, btnT], alpha: 1, duration: 200 });
      this.sc.tweens.add({ targets: thumb, x: this.cx + 30, y: SY + SH * 0.5 + 129 + 30, duration: 500, delay: 300, yoyo: true, hold: 150 });
    });
    this.later(2500, () => {
      btn.setFillStyle(0x2a7a2a);
      btnT.setText("Driver on the way");
      synth.play("notify");
    });
    this.push(1.07, 3200, this.cx + 30, SY + SH * 0.5);
    this.shotKind = "phone";
    void SX;
    void SW;
    return 3000;
  }

  /** Jenko's own thought over the phone: "I need to get to the bridge." */
  private phoneThought(): number {
    const p = this.perf;
    if (p && p.name === "FLENKY") {
      this.push(1.25, 5000, p.spr.x, p.spr.y - 230);
      return 0;
    }
    const q = this.close("FLENKY", { side: -0.2, dissolve: true, expr: F.SPECIAL, zoom: 2.2, ox: 90 });
    if (q) {
      const ph = (q.gest?.[PHONE]?.[0] ?? 24) + 7;
      q.gesturing = true;
      q.spr.setFrame(ph);
      this.push(1.25, 5000, q.spr.x, q.spr.y - 230);
    }
    this.shotKind = "jenko";
    return 0;
  }

  /** Out of the room and into the night: the bridge, the laughter and his best man's name behind him. */
  private fadeOut(): number {
    this.cinematic();
    this.dissolve(2400);
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const img = this.kenBurns(this.tex(SET.night), { z: 1.1, x: 0, y: 0 }, { z: 1.45, x: -60, y: 30 }, 6500);
    img.setAlpha(0.95);
    const dark = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0).setOrigin(0));
    this.sc.tweens.add({ targets: dark, fillAlpha: 1, duration: 5200, delay: 1400 });
    for (let i = 0; i < 4; i++) {
      this.later(600 + i * 900, () => {
        const t = this.add(this.text(this.cx + (i % 2 ? 90 : -90), SY + SH * (0.3 + i * 0.1), "RORY!", 26 - i * 4, "#ffe08a", { fontFamily: "Impact, Arial Black, sans-serif" }).setOrigin(0.5).setAlpha(0.5 - i * 0.1));
        this.sc.tweens.add({ targets: t, alpha: 0, scale: 1.5, duration: 1500, onComplete: () => t.destroy() });
      });
    }
    this.later(300, () => synth.play("laugh"));
    this.later(2400, () => synth.play("cheer"));
    this.shotKind = "night";
    void SW;
    return 5600;
  }
}

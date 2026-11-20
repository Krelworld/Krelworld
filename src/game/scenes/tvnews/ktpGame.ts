import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { vfx } from "../../gfx/Vfx";
import { FONT, PIXEL_FONT } from "../../ui/theme";
import { calm, gore } from "../tv/action";
import type { Rect } from "./NewsChrome";

/**
 * "Kill the Patient 2: No Alibi" (krews_kill_the_patient in src/content/television/extra/krews3.ts): the arcade game
 * the story is about, and the cabinet it lives in. NewsDirector (TVNews.ts) cuts to these two story kinds:
 *
 * - arcadegame: "game footage", a separate 16-bit side-scroller with its own HUD, score, combo counter and pop-ups.
 *   A disgruntled orderly in scrubs (PixelLab tva_ktp_fire / tva_ktp_run) rampages through a ward (tv_ktp_ward),
 *   adult patients in gowns (tva_ktp_flee, tva_ktp_patients) flee, beds fly, things explode. Modes follow the
 *   article: the level-1 title card, refusing to fire (the game-over screen), the cash payout, the reporters' +$1
 *   demo and the attract mode. Cartoon gore only, and with gore off the patients poof into stars and coins.
 * - cabinet: the KILL THE PATIENT 2 cabinet (tv_ktp_cabinet) close up on its marquee, its "$1 PER PATIENT" sign or
 *   the flap with its instruction label (only ever the plastic flap and the label). The lettering is drawn here.
 */

export type KtpKind = "arcadegame" | "cabinet";
export const KTP_KINDS: ReadonlySet<string> = new Set<KtpKind>(["arcadegame", "cabinet"]);

export type KtpMode = "level1" | "refuse" | "payout" | "demo" | "attract";
export type KtpFocus = "marquee" | "sign" | "flap";

export interface KtpScene {
  ktp?: KtpMode;
  focus?: KtpFocus;
}

export interface KtpCtx {
  sc: Phaser.Scene;
  r: Rect;
  stage: Phaser.GameObjects.Container;
  fx: Phaser.GameObjects.Container;
  later: (ms: number, fn: () => void) => Phaser.Time.TimerEvent;
  every: (ms: number, fn: () => void) => Phaser.Time.TimerEvent;
}

const ARCADE = { fontFamily: PIXEL_FONT, fontStyle: "bold", stroke: "#000000" } as const;

/** Where things are on the cabinet art (320x240). */
const CAB = { marquee: [125, 12, 110, 36], sign: [70, 82, 27, 48], slot: [201, 189], label: [180, 204, 26, 10], screen: [165, 113] } as const;

function anim(sc: Phaser.Scene, key: string, fps: number, loop: boolean, frames?: number[]) {
  const id = `${key}@ktp${fps}${loop ? "L" : ""}${frames ? frames.join(",") : ""}`;
  if (!sc.anims.exists(id) && sc.textures.exists(key)) {
    sc.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const n = sc.textures.get(key).frameTotal - 1;
    const list = frames ?? Array.from({ length: n }, (_, i) => i);
    sc.anims.create({ key: id, frames: list.map((f) => ({ key, frame: f })), frameRate: fps, repeat: loop ? -1 : 0 });
  }
  return id;
}

/** The game footage: one shot of the game, running on its own until the next cut. */
export class KtpGame {
  private sc: Phaser.Scene;
  private r: Rect;
  private play!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Container;
  private ward?: Phaser.GameObjects.TileSprite;
  private player?: Phaser.GameObjects.Sprite;
  private patients: Phaser.GameObjects.Sprite[] = [];
  private scoreText?: Phaser.GameObjects.Text;
  private cashText?: Phaser.GameObjects.Text;
  private comboText?: Phaser.GameObjects.Text;
  private score = 0;
  private cash = 0;
  private combo = 0;
  private scroll = 0;
  private firing = false;
  private over = false;
  private floor: number;
  private gunX: number;
  private pip?: { box: Phaser.GameObjects.Container; slot: { x: number; y: number }; scale: number };

  constructor(
    private c: KtpCtx,
    private mode: KtpMode,
  ) {
    this.sc = c.sc;
    this.r = c.r;
    const { SX, SY, SH } = this.r;
    this.floor = SY + SH - 80;
    this.gunX = SX + 130;
  }

  private put<T extends Phaser.GameObjects.GameObject>(o: T, into: Phaser.GameObjects.Container = this.play): T {
    into.add(o);
    return o;
  }

  private text(x: number, y: number, s: string, size: number, col: string, into?: Phaser.GameObjects.Container, stroke = 5) {
    return this.put(this.sc.add.text(x, y, s, { ...ARCADE, fontSize: `${size}px`, color: col, strokeThickness: stroke, align: "center" }).setOrigin(0.5), into ?? this.hud);
  }

  /** Draw the shot. Returns how long the picture wants held before the first line. */
  start(): number {
    const { sc, r } = this;
    const { SX, SY, SW, SH } = r;
    this.play = sc.add.container(0, 0);
    this.hud = sc.add.container(0, 0);
    this.c.stage.add([this.play, this.hud]);
    this.put(sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    if (sc.textures.exists("tv_ktp_ward")) {
      sc.textures.get("tv_ktp_ward").setFilter(Phaser.Textures.FilterMode.NEAREST);
      const s = (SH - 40) / 180;
      this.ward = this.put(sc.add.tileSprite(SX, SY + 40, SW, SH - 40, "tv_ktp_ward").setOrigin(0).setTileScale(s, s));
    }
    this.chromeOverlay();
    this.hudBar();
    if (this.mode === "level1") return this.titleScreen();
    this.spawnPlayer();
    if (this.mode === "refuse") return this.refuse();
    if (this.mode === "demo") return this.demo();
    if (this.mode === "payout") this.slotPip();
    this.rampage(this.mode === "attract");
    if (this.mode === "attract") this.attract();
    return 700;
  }

  /** A line of narration over the footage (n: its number in the scene). */
  line(n: number) {
    if (this.mode === "level1" && n === 1) this.instruction();
  }

  // ---------------------------------------------------------------- the look

  /** CRT scanlines, a vignette, a GAME FOOTAGE tag. */
  private chromeOverlay() {
    const { sc } = this;
    const { SX, SY, SW, SH } = this.r;
    const g = this.put(sc.add.graphics(), this.c.fx);
    for (let y = SY; y < SY + SH; y += 3) g.fillStyle(0x000000, 0.16).fillRect(SX, y, SW, 1);
    for (let i = 0; i < 6; i++) g.lineStyle(14, 0x000000, 0.08).strokeRect(SX + i * 7, SY + i * 7, SW - i * 14, SH - i * 14);
    const tag = this.put(sc.add.text(SX + 12, SY + 44, "GAME FOOTAGE · KILL THE PATIENT 2", { fontFamily: FONT, fontSize: "12px", color: "#111827", backgroundColor: "#facc15", padding: { x: 5, y: 2 }, fontStyle: "bold" }), this.c.fx);
    void tag;
    // the picture rolls now and then, like a camera pointed at an arcade screen
    this.c.every(2900, () => {
      if (calm()) return;
      const bar = this.put(sc.add.rectangle(SX, SY - 30, SW, 30, 0xffffff, 0.07).setOrigin(0), this.c.fx);
      sc.tweens.add({ targets: bar, y: SY + SH, duration: 900, onComplete: () => bar.destroy() });
    });
  }

  private hudBar() {
    const { sc } = this;
    const { SX, SY, SW } = this.r;
    this.put(sc.add.rectangle(SX, SY, SW, 40, 0x0b0b1a).setOrigin(0));
    this.put(sc.add.rectangle(SX, SY + 39, SW, 2, 0xdc2626).setOrigin(0));
    this.text(SX + 20, SY + 12, "1UP", 13, "#ef4444").setOrigin(0, 0.5);
    this.scoreText = this.text(SX + 20, SY + 28, "000000", 15, "#ffffff").setOrigin(0, 0.5);
    this.text(SX + SW / 2 - 40, SY + 12, "PATIENTS", 11, "#93c5fd");
    this.cashText = this.text(SX + SW / 2 - 40, SY + 28, this.mode === "payout" || this.mode === "demo" ? "PAID OUT $0" : "x 99", 14, this.mode === "payout" || this.mode === "demo" ? "#4ade80" : "#ffffff");
    this.text(SX + SW - 170, SY + 12, "HI 999999", 11, "#facc15");
  }

  private addScore(n: number) {
    this.score += n;
    this.scoreText?.setText(String(this.score).padStart(6, "0"));
  }

  // ---------------------------------------------------------------- the cast

  private spawnPlayer() {
    const { sc } = this;
    if (!sc.textures.exists("tva_ktp_fire")) return;
    this.player = this.put(sc.add.sprite(this.gunX, this.floor, "tva_ktp_fire", 0).setOrigin(0.5, 1).setScale(2.3));
    this.player.setDepth(10);
  }

  private run(on: boolean) {
    if (!this.player?.active) return;
    if (on) this.player.play(anim(this.sc, "tva_ktp_run", 12, true, [1, 2, 3, 4, 5, 6, 7, 8]));
    else this.player.setTexture("tva_ktp_fire", 0);
  }

  private fire(on: boolean) {
    if (!this.player?.active || this.firing === on) return;
    this.firing = on;
    if (on) this.player.play(anim(this.sc, "tva_ktp_fire", 18, true, [1, 2, 3, 4, 5, 6, 7, 8]));
    else this.player.stop().setTexture("tva_ktp_fire", 0);
  }

  /** A patient, at x: cowering where they were, then running for it (they always run away, to the right). */
  private patient(x: number, cower = 500) {
    const { sc } = this;
    if (!sc.textures.exists("tva_ktp_patients")) return null;
    const f = Math.floor(Math.random() * 8);
    const p = this.put(sc.add.sprite(x, this.floor + 4, "tva_ktp_patients", f).setOrigin(0.5, 1).setScale(2.1));
    p.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    p.setFlipX(Math.random() < 0.5);
    p.setData("alive", true);
    this.patients.push(p);
    // they jump in from behind a curtain
    p.setScale(2.1, 0.2);
    sc.tweens.add({ targets: p, scaleY: 2.1, duration: 160, ease: "Back.out" });
    this.c.later(cower, () => {
      if (!p.active || !p.getData("alive")) return;
      p.setFlipX(false).play(anim(sc, "tva_ktp_flee", 14, true, [1, 2, 3, 4, 5, 6, 7, 8]));
      sc.tweens.add({ targets: p, x: this.r.SX + this.r.SW + 80, duration: 2600 + Math.random() * 900, ease: "Linear", onComplete: () => p.destroy() });
    });
    return p;
  }

  /** A patient is shot: cartoon blood (or a poof of stars and coins), score, a pop-up, a bill out of the slot. */
  private kill(p: Phaser.GameObjects.Sprite) {
    if (!p.active || !p.getData("alive")) return;
    const { sc } = this;
    p.setData("alive", false);
    sc.tweens.killTweensOf(p);
    p.stop();
    const x = p.x;
    const y = p.y - p.displayHeight * 0.55;
    this.tracer(x, y);
    synth.play("splat");
    if (gore()) {
      const s1 = vfx(sc, "vfx_bloodspray", x, y, { scale: 1.6 });
      if (s1) this.put(s1);
      const s2 = vfx(sc, "vfx_blood", x + 10, y - 10, { scale: 1.8 });
      if (s2) this.put(s2);
      const pool = vfx(sc, "vfx_bloodpool", x, this.floor - 4, { scale: 1.6, hold: true });
      if (pool) this.put(pool).setDepth(1);
      // a cartoon splat on the wall behind
      const sp = vfx(sc, "tva_vfx_splat", x + 30, y - 40, { scale: 2, hold: true });
      if (sp) this.put(sp);
      this.bang(x, y - 60, ["SPLAT!", "SPLORCH!", "GLORP!", "BLAM!"][Math.floor(Math.random() * 4)], "#ff2a2a");
      // and off they go, spinning, like an arcade game
      p.setTint(0xff7777);
      sc.tweens.add({ targets: p, x: x + 120 + Math.random() * 120, y: p.y - 140, angle: 540, duration: 520, ease: "Quad.out" });
      sc.tweens.add({ targets: p, y: this.floor + 30, alpha: 0, delay: 520, duration: 380, ease: "Quad.in", onComplete: () => p.destroy() });
    } else {
      const s1 = vfx(sc, "vfx_pixeldeath", x, y, { scale: 1.8 });
      if (s1) this.put(s1);
      const s2 = vfx(sc, "vfx_coins", x, y - 10, { scale: 1.6 });
      if (s2) this.put(s2);
      const s3 = vfx(sc, "vfx_stars", x, y - 50, { scale: 2 });
      if (s3) this.put(s3);
      this.bang(x, y - 60, "POOF!", "#facc15");
      sc.tweens.add({ targets: p, scale: 0, alpha: 0, duration: 220, onComplete: () => p.destroy() });
    }
    this.addScore(100 * Math.max(1, this.combo + 1));
    this.combo++;
    this.comboUp();
    if (this.mode === "payout" || this.mode === "demo") {
      this.cash++;
      this.cashText?.setText(`PAID OUT $${this.cash}`);
      this.popup(x, y - 90, "+$1 PATIENT BONUS", "#4ade80", this.mode === "demo" ? 26 : 16);
      this.c.later(this.mode === "demo" ? 700 : 260, () => this.billOut());
      synth.play("coin");
    } else this.popup(x, y - 90, `+${100 * this.combo}`, "#fde047", 16);
  }

  private tracer(x: number, y: number) {
    const { sc } = this;
    if (!this.player?.active) return;
    const gx = this.player.x + 64;
    const gy = this.player.y - this.player.displayHeight * 0.42;
    const g = this.put(sc.add.graphics());
    g.lineStyle(3, 0xfff59d, 0.95).lineBetween(gx, gy, x, y + (Math.random() - 0.5) * 20);
    g.lineStyle(2, 0xffffff, 0.9).lineBetween(gx, gy + 6, x, y + 10);
    sc.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
    const m = vfx(sc, "vfx_muzzle", gx - 6, gy, { scale: 1.6 });
    if (m) this.put(m).setDepth(12);
  }

  private bang(x: number, y: number, word: string, col: string) {
    const t = this.text(x, y, word, 26, col, this.play, 6).setAngle(-14 + Math.random() * 28).setScale(0.3);
    this.sc.tweens.add({ targets: t, scale: 1, duration: 140, ease: "Back.out" });
    this.sc.tweens.add({ targets: t, alpha: 0, delay: 500, duration: 220, onComplete: () => t.destroy() });
  }

  private popup(x: number, y: number, s: string, col: string, size: number) {
    const t = this.text(Math.min(x, this.r.SX + this.r.SW - 120), y, s, size, col, this.play, 5);
    this.sc.tweens.add({ targets: t, y: y - 50, duration: 900, ease: "Quad.out" });
    this.sc.tweens.add({ targets: t, alpha: 0, delay: 700, duration: 300, onComplete: () => t.destroy() });
  }

  private comboUp() {
    const { sc } = this;
    const { SX, SY, SW } = this.r;
    if (this.combo < 2) return;
    if (!this.comboText) this.comboText = this.text(SX + SW - 120, SY + 100, "", 34, "#f97316", this.hud, 7).setAngle(-8);
    this.comboText.setText(`x${this.combo}\nCOMBO!!`);
    const s = Math.min(1.9, 1 + this.combo * 0.05);
    sc.tweens.killTweensOf(this.comboText);
    this.comboText.setScale(s * 1.4);
    sc.tweens.add({ targets: this.comboText, scale: s, duration: 160, ease: "Back.out" });
    if (!calm()) this.comboText.setColor(this.combo % 2 ? "#f97316" : "#fde047");
  }

  // ---------------------------------------------------------------- gameplay

  /** The level: run, stop, mow down whoever jumps out, run on. Beds fly; with `big`, everything explodes too. */
  private rampage(big: boolean) {
    const { sc } = this;
    const { SX, SW } = this.r;
    this.c.every(16, () => {
      if (this.ward?.active) this.ward.tilePositionX += this.scroll;
    });
    let phase = 0;
    const cycle = () => {
      if (this.over) return;
      phase++;
      // run a stretch
      this.scroll = 2.4;
      this.fire(false);
      this.run(true);
      this.c.later(900, () => {
        if (this.over) return;
        this.scroll = 0;
        this.player?.stop();
        // they pop out from behind the curtains
        const n = big ? 4 : 3;
        const ps: Phaser.GameObjects.Sprite[] = [];
        for (let i = 0; i < n; i++) {
          const p = this.patient(SX + SW * (0.42 + i * (0.5 / n)) + Math.random() * 20, 380 + i * 120);
          if (p) ps.push(p);
        }
        this.c.later(250, () => {
          this.fire(true);
          synth.play("gun_gatling");
        });
        ps.forEach((p, i) => this.c.later(450 + i * 260, () => this.kill(p)));
        if (phase % 2 === 0 || big) this.c.later(500, () => this.flyingBed());
        if (big) this.c.later(800, () => this.explosion(SX + SW * (0.55 + Math.random() * 0.3)));
        this.c.later(450 + n * 260 + 300, cycle);
      });
    };
    cycle();
    void sc;
  }

  private flyingBed() {
    const { sc } = this;
    const { SX, SW } = this.r;
    if (!sc.textures.exists("tva_prop_ktp_bed")) return;
    sc.textures.get("tva_prop_ktp_bed").setFilter(Phaser.Textures.FilterMode.NEAREST);
    const x0 = SX + SW * (0.5 + Math.random() * 0.3);
    const b = this.put(sc.add.image(x0, this.floor - 10, "tva_prop_ktp_bed").setOrigin(0.5, 1).setScale(2.2));
    this.explosion(x0, 1.2);
    sc.tweens.add({ targets: b, x: x0 + 140 + Math.random() * 160, y: this.floor - 260, angle: 360 + Math.random() * 360, duration: 700, ease: "Quad.out" });
    sc.tweens.add({ targets: b, y: this.floor + 200, delay: 700, duration: 500, ease: "Quad.in", onComplete: () => b.destroy() });
  }

  private explosion(x: number, scale = 2.2) {
    const { sc } = this;
    const s = vfx(sc, Math.random() < 0.5 ? "vfx_bigboom" : "vfx_boom", x, this.floor - 60, { scale });
    if (s) this.put(s).setDepth(20);
    const sm = vfx(sc, "vfx_smoke", x, this.floor - 90, { scale: 2, delay: 200 });
    if (sm) this.put(sm);
    synth.play("explode");
    sc.cameras.main.shake(calm() ? 120 : 220, calm() ? 0.003 : 0.008);
    if (!calm()) {
      const { SX, SY, SW, SH } = this.r;
      const f = this.put(sc.add.rectangle(SX, SY, SW, SH, 0xffa040, 0.35).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.c.fx);
      sc.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
    }
  }

  // ---------------------------------------------------------------- modes

  /** LEVEL 1: the title, then the level card. */
  private titleScreen(): number {
    const { sc } = this;
    const { SX, SY, SW, SH } = this.r;
    const card = this.put(sc.add.container(0, 0), this.hud);
    const bg = sc.add.rectangle(SX, SY + 40, SW, SH - 40, 0x07070f, 0.88).setOrigin(0);
    card.add(bg);
    const title = this.text(SX + SW / 2, SY + 110, "KILL THE PATIENT 2", 40, "#ef4444", card, 8);
    const sub = this.text(SX + SW / 2, SY + 152, "NO ALIBI", 26, "#facc15", card, 6);
    const cash = this.text(SX + SW / 2, SY + 184, "★ NOW WITH CASH PAYOUTS ★", 14, "#4ade80", card, 4);
    title.setScale(0.2);
    sc.tweens.add({ targets: title, scale: 1, duration: 420, ease: "Back.out" });
    synth.play("gunget");
    // the level card
    this.c.later(1400, () => {
      for (const o of [title, sub, cash]) o.setVisible(false);
      const l1 = this.text(SX + SW / 2, SY + 120, "LEVEL 1", 46, "#ffffff", card, 8);
      const l2 = this.text(SX + SW / 2, SY + 180, "KILL OR GAME OVER", 32, "#ef4444", card, 7);
      for (const o of [l1, l2]) {
        o.setScale(2.4).setAlpha(0);
        sc.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 260, ease: "Quad.out" });
      }
      synth.play("alarm");
      if (!calm()) sc.tweens.add({ targets: l2, alpha: 0.35, duration: 260, yoyo: true, repeat: -1, delay: 400 });
      sc.cameras.main.shake(180, calm() ? 0.002 : 0.006);
    });
    this.card = card;
    return 1900;
  }

  private card?: Phaser.GameObjects.Container;

  /** The gun is handed over, the instruction comes up, and then it's the level. */
  private instruction() {
    const { sc } = this;
    const { SX, SY, SW } = this.r;
    this.card?.destroy();
    this.card = undefined;
    this.spawnPlayer();
    synth.play("gunget");
    const box = this.put(sc.add.container(0, 0), this.hud);
    box.add(sc.add.rectangle(SX + SW / 2, SY + 112, SW - 80, 92, 0x0b0b1a, 0.92).setStrokeStyle(3, 0xfacc15));
    this.text(SX + SW / 2, SY + 84, "WEAPON GET: MACHINE GUN", 16, "#93c5fd", box, 4);
    const t = this.text(SX + SW / 2, SY + 124, "KILL AS MANY PATIENTS AS POSSIBLE,\nOR GAME OVER!", 19, "#ffffff", box, 5);
    if (!calm()) sc.tweens.add({ targets: t, alpha: 0.4, duration: 300, yoyo: true, repeat: -1 });
    if (this.player) {
      this.player.setScale(0.2);
      sc.tweens.add({ targets: this.player, scale: 2.3, duration: 300, ease: "Back.out" });
    }
    this.c.later(3200, () => {
      sc.tweens.add({ targets: box, alpha: 0, duration: 300, onComplete: () => box.destroy() });
      const go = this.text(SX + SW / 2, SY + 110, "GO!", 48, "#4ade80", this.hud, 8);
      sc.tweens.add({ targets: go, scale: 1.6, alpha: 0, delay: 500, duration: 400, onComplete: () => go.destroy() });
      this.rampage(false);
    });
  }

  /** The player won't fire: the clock runs out on him. */
  private refuse(): number {
    const { sc } = this;
    const { SX, SY, SW, SH } = this.r;
    const ps = [0.48, 0.66, 0.84].map((fx) => this.patient(SX + SW * fx, 999999));
    let t = 5;
    const timer = this.text(SX + SW - 60, SY + 28, "TIME 5", 14, "#ffffff");
    const warn = this.text(SX + SW / 2, SY + 92, "FIRE!!  FIRE!!", 24, "#ef4444", this.hud, 6);
    if (!calm()) sc.tweens.add({ targets: warn, alpha: 0.2, duration: 200, yoyo: true, repeat: -1 });
    const tick = this.c.every(450, () => {
      t--;
      timer.setText(`TIME ${Math.max(0, t)}`);
      synth.play("select");
      if (t > 0) return;
      tick.remove();
      this.over = true;
      warn.destroy();
      // the patients are fine; the screen goes red; the player loses
      for (const p of ps) if (p) p.stop();
      const red = this.put(sc.add.rectangle(SX, SY + 40, SW, SH - 40, 0x7f0000, 0).setOrigin(0), this.hud);
      sc.tweens.add({ targets: red, fillAlpha: 0.75, duration: 400 });
      const go = this.text(SX + SW / 2, SY + 130, "GAME OVER", 52, "#ffffff", this.hud, 9).setScale(3).setAlpha(0);
      sc.tweens.add({ targets: go, scale: 1, alpha: 1, duration: 300, ease: "Quad.out" });
      sc.cameras.main.shake(260, calm() ? 0.003 : 0.01);
      synth.play("trombone");
      this.c.later(700, () => {
        this.text(SX + SW / 2, SY + 196, "YOU SAVED THE PATIENTS.", 22, "#fde047", this.hud, 6);
        const lose = this.text(SX + SW / 2, SY + 232, "YOU LOSE.", 30, "#ef4444", this.hud, 7).setScale(0.3);
        sc.tweens.add({ targets: lose, scale: 1, duration: 200, ease: "Back.out" });
        synth.play("death");
      });
      this.c.later(1800, () => {
        let n = 9;
        const cont = this.text(SX + SW / 2, SY + 276, "CONTINUE? 9", 16, "#ffffff", this.hud, 4);
        this.c.every(800, () => cont.setText(`CONTINUE? ${Math.max(0, --n)}`));
      });
    });
    return 600;
  }

  /** The reporters' demo: one shot, one bonus, one dollar out of the cabinet. Again. */
  private demo(): number {
    const { SX, SW } = this.r;
    const go = () => {
      const p = this.patient(SX + SW * 0.62, 9000);
      this.c.later(700, () => {
        this.fire(true);
        synth.play("gun_smg");
        this.c.later(180, () => {
          if (p) this.kill(p);
          this.fire(false);
        });
      });
      // then we see the slot
      this.c.later(1500, () => this.slotCut());
    };
    go();
    this.c.every(3600, go);
    this.slotPip();
    return 400;
  }

  /** The bonus text, the bill: a full-screen cut to the cabinet slot. */
  private slotCut() {
    const { sc } = this;
    const { SX, SY, SW, SH } = this.r;
    if (!sc.textures.exists("tv_ktp_cabinet")) return;
    const box = this.put(sc.add.container(0, 0), this.c.fx);
    const scale = 5;
    const img = sc.add.image(SX + SW / 2 - (CAB.slot[0] - 160) * scale, SY + SH / 2 - (CAB.slot[1] - 120) * scale + 40, "tv_ktp_cabinet").setScale(scale);
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    box.add(img);
    box.add(sc.add.text(SX + 12, SY + 44, "MEANWHILE, BELOW THE CONTROLS", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", backgroundColor: "#dc2626", padding: { x: 5, y: 2 }, fontStyle: "bold" }));
    this.bill(box, SX + SW / 2, SY + SH / 2 + 40, 4.2, 120);
    this.c.later(1500, () => box.destroy());
  }

  /** A picture-in-picture of the cash slot (the payout), a bill coming out for every kill. */
  private slotPip() {
    const { sc } = this;
    const { SX, SY, SW } = this.r;
    if (!sc.textures.exists("tv_ktp_cabinet")) return;
    const w = 170;
    const h = 110;
    const x = SX + 14;
    const y = SY + 70;
    const box = this.put(sc.add.container(0, 0), this.hud);
    const m = sc.make.graphics({}).fillRect(x, y, w, h);
    const inner = sc.add.container(0, 0);
    inner.setMask(m.createGeometryMask());
    const scale = 2.6;
    const img = sc.add.image(x + w / 2 - (CAB.slot[0] - 160) * scale, y + h / 2 - (CAB.slot[1] - 120) * scale - 10, "tv_ktp_cabinet").setScale(scale);
    inner.add(img);
    box.add(inner);
    box.add(sc.add.rectangle(x, y, w, h).setOrigin(0).setStrokeStyle(3, 0xffffff));
    box.add(sc.add.text(x + 4, y + 4, "THE CASH SLOT", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", backgroundColor: "#16a34a", padding: { x: 3, y: 1 }, fontStyle: "bold" }));
    this.pip = { box: inner, slot: { x: x + w / 2, y: y + h / 2 - 10 }, scale };
    box.once(Phaser.GameObjects.Events.DESTROY, () => m.destroy());
  }

  private billOut() {
    if (!this.pip) return;
    this.bill(this.pip.box, this.pip.slot.x, this.pip.slot.y, this.pip.scale * 0.9, 40);
  }

  /** A dollar bill shooting out of the slot at (x, y) towards us. */
  private bill(into: Phaser.GameObjects.Container, x: number, y: number, scale: number, drop: number) {
    const { sc } = this;
    if (!sc.textures.exists("tva_prop_ktp_bill")) return;
    sc.textures.get("tva_prop_ktp_bill").setFilter(Phaser.Textures.FilterMode.NEAREST);
    const b = sc.add.image(x, y, "tva_prop_ktp_bill").setScale(scale, 0.1 * scale);
    into.add(b);
    synth.play("ding");
    sc.tweens.add({ targets: b, scaleY: scale, y: y + drop * 0.3, duration: 260, ease: "Quad.out" });
    sc.tweens.add({ targets: b, y: y + drop, angle: (Math.random() - 0.5) * 50, delay: 260, duration: 600, ease: "Bounce.out" });
    sc.tweens.add({ targets: b, alpha: 0, delay: 1400, duration: 300, onComplete: () => b.destroy() });
  }

  /** Attract mode: the slogan, INSERT COIN, the lot. */
  private attract() {
    const { sc } = this;
    const { SX, SY, SW } = this.r;
    const banner = this.put(sc.add.container(0, 0), this.hud);
    banner.add(sc.add.rectangle(SX + SW / 2, SY + 92, SW - 40, 70, 0x000000, 0.7).setStrokeStyle(3, 0xef4444));
    const t1 = this.text(SX + SW / 2, SY + 78, "BIGGER, BLOODIER", 26, "#ef4444", banner, 6);
    const t2 = this.text(SX + SW / 2, SY + 108, "AND LEGALLY INDEMNIFIED", 20, "#fde047", banner, 5);
    for (const [i, o] of [t1, t2].entries()) {
      o.setScale(0.1);
      sc.tweens.add({ targets: o, scale: 1, duration: 300, delay: i * 350, ease: "Back.out" });
    }
    const coin = this.text(SX + SW / 2, SY + 150, "INSERT COIN", 16, "#ffffff", this.hud, 4);
    sc.tweens.add({ targets: coin, alpha: 0, duration: calm() ? 900 : 400, yoyo: true, repeat: -1 });
    this.text(SX + 70, SY + 28, "ATTRACT MODE", 10, "#93c5fd").setOrigin(0, 0.5).setX(SX + 110);
  }
}

/** The cabinet, close: the marquee, the sign or the flap, with their lettering. */
export function ktpCabinet(c: KtpCtx, focus: KtpFocus | undefined, camTo: (s: number, x: number, y: number, ms: number) => void) {
  const { sc, r } = c;
  const { SX, SY, SW, SH } = r;
  const put = <T extends Phaser.GameObjects.GameObject>(o: T) => (c.stage.add(o), o);
  if (!sc.textures.exists("tv_ktp_cabinet")) return 0;
  sc.textures.get("tv_ktp_cabinet").setFilter(Phaser.Textures.FilterMode.NEAREST);
  const look: Record<KtpFocus, [number, number, number]> = { marquee: [180, 70, 2.5], sign: [118, 108, 3.2], flap: [195, 205, 4.6] };
  const [fx, fy, s] = look[focus ?? "marquee"];
  const ox = SX + SW / 2 - fx * s;
  const oy = SY + SH / 2 - 30 - fy * s;
  put(sc.add.image(ox, oy, "tv_ktp_cabinet").setOrigin(0).setScale(s));
  const at = (x: number, y: number) => ({ x: ox + x * s, y: oy + y * s });
  // the marquee, lit
  {
    const [mx, my, mw, mh] = CAB.marquee;
    const p = at(mx + mw / 2, my + mh / 2);
    const glow = put(sc.add.rectangle(p.x, p.y, mw * s, mh * s, 0xfff1d6, 1));
    const t1 = put(sc.add.text(p.x, p.y - mh * s * 0.18, "KILL THE PATIENT 2", { ...ARCADE, fontSize: `${Math.round(s * 9.5)}px`, color: "#b91c1c", strokeThickness: Math.round(s * 1.2) }).setOrigin(0.5));
    const t2 = put(sc.add.text(p.x, p.y + mh * s * 0.24, "NO ALIBI — NOW WITH CASH PAYOUTS", { ...ARCADE, fontSize: `${Math.round(s * 4.6)}px`, color: "#111111", stroke: "#facc15", strokeThickness: Math.round(s * 0.8) }).setOrigin(0.5));
    void t2;
    sc.tweens.add({ targets: glow, alpha: 0.86, duration: calm() ? 1600 : 140, yoyo: true, repeat: -1, repeatDelay: 900 });
    if (t1.width > mw * s * 0.95) t1.setScale((mw * s * 0.95) / t1.width);
    if (t2.width > mw * s * 0.95) t2.setScale((mw * s * 0.95) / t2.width);
  }
  // the screen flickers with the game
  {
    const p = at(CAB.screen[0], CAB.screen[1]);
    const g = put(sc.add.rectangle(p.x, p.y, 84 * s, 62 * s, 0x60a5fa, 0).setBlendMode(Phaser.BlendModes.ADD));
    c.every(160, () => g.setFillStyle([0x60a5fa, 0xef4444, 0xfde047][Math.floor(Math.random() * 3)], calm() ? 0.04 : Math.random() * 0.14));
  }
  // the sign taped to the side
  {
    const [sx, sy, sw, sh] = CAB.sign;
    const p = at(sx + sw / 2, sy + sh / 2);
    const pw = sw * s * 1.25;
    const ph = sh * s * 0.95;
    put(sc.add.rectangle(p.x, p.y, pw, ph, 0xf5f5f0).setAngle(-3).setStrokeStyle(1, 0x999999));
    const t = put(sc.add.text(p.x, p.y, "$1 PER\nPATIENT\n\nNO DAILY\nLIMIT", { fontFamily: FONT, fontSize: `${Math.round(s * 7)}px`, color: "#b91c1c", fontStyle: "bold", align: "center", lineSpacing: -2 }).setOrigin(0.5).setAngle(-3));
    t.setScale(Math.min(1, (pw * 0.86) / t.width, (ph * 0.9) / t.height));
  }
  // the label above the flap (the flap is just a grey plastic flap)
  {
    const [lx, ly, lw, lh] = CAB.label;
    const p = at(lx + lw / 2, ly + lh / 2);
    put(sc.add.rectangle(p.x, p.y, lw * s * 1.25, lh * s * 1.5, 0xffffff).setStrokeStyle(1, 0x333333));
    const t = put(sc.add.text(p.x, p.y, "FOR FULLY IMMERSIVE EXPERIENCE,\nINSERT PENIS INTO SENSOR\nWHEN PROMPTED.", { fontFamily: FONT, fontSize: `${Math.round(s * 2.2)}px`, color: "#111111", fontStyle: "bold", align: "center" }).setOrigin(0.5));
    if (t.width > lw * s * 1.2) t.setScale((lw * s * 1.2) / t.width);
  }
  camTo(1.06, SX + SW / 2, SY + SH / 2 - 30, 8000);
  return 900;
}

import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { vfx } from "../../gfx/Vfx";
import { FONT, PIXEL_FONT } from "../../ui/theme";
import { calm, gore } from "../tv/action";
import type { Rect } from "./NewsChrome";

/**
 * Clips of the media a news story is about, played over the newsreader's lines: the GB Krews reviews and outrages cut
 * away to the game, the programme or the video itself, the way Kill the Patient 2 does (ktpGame.ts). A show's NewsCfg
 * lists its clips (`clips`), and an `[INSERT <id> <n>]` beat in the script cuts to one and holds it over the next n
 * lines; each of those lines moves the footage on (`line(i)`), so the picture follows what's being described. The
 * words are untouched: only the pictures change.
 *
 * One footage director per medium, each a few PixelLab sprites (public/art/tv/clips, `tvc_*`) plus drawn HUDs:
 *
 * - fifa: "FIFA: Audience" (krews_fifa_audience). A third-person view of a bald fan from behind, in the stand, on the
 *   bus, in the boardroom, at the pitch invasion; COIN and DISDAIN are the only buttons. The missions the review
 *   describes are only ever shown as mission cards (text), never acted out.
 * - kart: a pre-release kart racer (krews_mario_tate). Generic parody racers (a builder-plumber, a granny, a frog) and
 *   the Tate kart (tv_k4_tate_kart) on a side-on track with a race HUD, items, the roster and the Bugatti's run-over.
 * - flight: Flight Simulator's "Crash Mode" (krews_crash_mode_live). The KrelAir jet over the clouds with a flight-sim
 *   HUD; the in-game collision is a cartoon (smoke, stars, points), with no one in it.
 * - gameshow: "Battle of the Morons" (krews_telly), the Department of Telly's flagship programme.
 * - musicvid: the Supreme Leader's "The Krezzing Hour" (news_1) on a video site, nine views.
 *
 * Calm flash mode stops the blinking and the white flashes; gore off turns the kart run-over into a pancake and stars.
 */

export type MediaKind = "fifa" | "kart" | "flight" | "gameshow" | "musicvid";

export interface MediaClipDef {
  medium: MediaKind;
  /** which bit of the footage (each medium's modes are listed on its class) */
  mode: string;
}

export interface MediaCtx {
  sc: Phaser.Scene;
  r: Rect;
  stage: Phaser.GameObjects.Container;
  fx: Phaser.GameObjects.Container;
  later: (ms: number, fn: () => void) => Phaser.Time.TimerEvent;
  every: (ms: number, fn: () => void) => Phaser.Time.TimerEvent;
}

const ARCADE = { fontFamily: PIXEL_FONT, fontStyle: "bold", stroke: "#000000" } as const;

/** The footage of one clip: drawn by start(), moved on by line(i) for each line said over it. */
export interface MediaClip {
  start(): number;
  line(i: number): void;
}

export function mediaClip(c: MediaCtx, def: MediaClipDef): MediaClip {
  switch (def.medium) {
    case "fifa":
      return new FifaFootage(c, def.mode);
    case "kart":
      return new KartFootage(c, def.mode);
    case "flight":
      return new FlightFootage(c, def.mode);
    case "gameshow":
      return new GameshowFootage(c, def.mode);
    default:
      return new MusicVideo(c, def.mode);
  }
}

/** Shared bits: the containers, arcade text, pop-ups, a GAME FOOTAGE tag and scanlines. */
abstract class Footage implements MediaClip {
  protected sc: Phaser.Scene;
  protected r: Rect;
  protected play!: Phaser.GameObjects.Container;
  protected hud!: Phaser.GameObjects.Container;

  constructor(
    protected c: MediaCtx,
    protected mode: string,
  ) {
    this.sc = c.sc;
    this.r = c.r;
  }

  start(): number {
    this.play = this.sc.add.container(0, 0);
    this.hud = this.sc.add.container(0, 0);
    this.c.stage.add([this.play, this.hud]);
    const { SX, SY, SW, SH } = this.r;
    this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    return this.open();
  }

  /** Draw the clip; returns how long to hold before the first line. */
  protected abstract open(): number;

  line(i: number) {
    this.onLine(i);
  }

  protected onLine(_i: number) {}

  protected get cx() {
    return this.r.SX + this.r.SW / 2;
  }

  protected put<T extends Phaser.GameObjects.GameObject>(o: T, into: Phaser.GameObjects.Container = this.play): T {
    into.add(o);
    return o;
  }

  protected text(x: number, y: number, s: string, size: number, col: string, into?: Phaser.GameObjects.Container, stroke = 5) {
    return this.put(this.sc.add.text(x, y, s, { ...ARCADE, fontSize: `${size}px`, color: col, strokeThickness: stroke, align: "center" }).setOrigin(0.5), into ?? this.hud);
  }

  protected has(key: string) {
    if (!this.sc.textures.exists(key)) return false;
    this.sc.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return true;
  }

  /** Scale a sprite to a width in screen pixels, whatever the art's own scale factor. */
  protected width<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite>(o: T, w: number): T {
    o.setScale(1);
    const d = o.displayWidth || 1;
    o.setScale(w / d);
    return o;
  }

  /** A full-picture backdrop (cover). */
  protected fill(key: string, zoom = 1, ox = 0, oy = 0) {
    const { SX, SY, SW, SH } = this.r;
    if (!this.has(key)) return this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x1f2937).setOrigin(0));
    const src = this.sc.textures.get(key).getSourceImage();
    const img = this.put(this.sc.add.image(SX + SW / 2 + ox, SY + SH / 2 + oy, key));
    return this.width(img, Math.max(SW, (SH * src.width) / src.height) * zoom);
  }

  protected anim(key: string, fps: number, loop: boolean, frames: number[]) {
    const id = `${key}@mc${fps}${loop ? "L" : ""}${frames.join(",")}`;
    if (!this.sc.anims.exists(id) && this.has(key)) this.sc.anims.create({ key: id, frames: frames.map((f) => ({ key, frame: f })), frameRate: fps, repeat: loop ? -1 : 0 });
    return id;
  }

  /** The broadcaster's tag in the corner: what this footage is. */
  protected tag(s: string, bg = "#facc15", col = "#111827") {
    const { SX, SY } = this.r;
    return this.put(this.sc.add.text(SX + 12, SY + 46, s, { fontFamily: FONT, fontSize: "12px", color: col, backgroundColor: bg, padding: { x: 5, y: 2 }, fontStyle: "bold" }), this.c.fx);
  }

  /** CRT scanlines and a vignette (a camera on a screen), and now and then a rolling bar. */
  protected scan(roll = true) {
    const { SX, SY, SW, SH } = this.r;
    const g = this.put(this.sc.add.graphics(), this.c.fx);
    for (let y = SY; y < SY + SH; y += 3) g.fillStyle(0x000000, 0.14).fillRect(SX, y, SW, 1);
    for (let i = 0; i < 6; i++) g.lineStyle(14, 0x000000, 0.07).strokeRect(SX + i * 7, SY + i * 7, SW - i * 14, SH - i * 14);
    if (!roll) return;
    this.c.every(3100, () => {
      if (calm()) return;
      const bar = this.put(this.sc.add.rectangle(SX, SY - 30, SW, 30, 0xffffff, 0.06).setOrigin(0), this.c.fx);
      this.sc.tweens.add({ targets: bar, y: SY + SH, duration: 900, onComplete: () => bar.destroy() });
    });
  }

  protected popup(x: number, y: number, s: string, col: string, size = 18) {
    const t = this.text(Math.max(this.r.SX + 90, Math.min(x, this.r.SX + this.r.SW - 110)), y, s, size, col, this.hud, 5);
    this.sc.tweens.add({ targets: t, y: y - 46, duration: 900, ease: "Quad.out" });
    this.sc.tweens.add({ targets: t, alpha: 0, delay: 800, duration: 300, onComplete: () => t.destroy() });
    return t;
  }

  protected bang(x: number, y: number, word: string, col: string, size = 28) {
    const t = this.text(x, y, word, size, col, this.play, 6).setAngle(-12 + Math.random() * 24).setScale(0.3);
    this.sc.tweens.add({ targets: t, scale: 1, duration: 140, ease: "Back.out" });
    this.sc.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 240, onComplete: () => t.destroy() });
  }

  /** A banner across the middle that pops in (and, unless calm, pulses). */
  protected banner(s: string, col: string, y: number, size = 34, pulse = false) {
    const t = this.text(this.cx, y, s, size, col, this.hud, 7).setScale(2.2).setAlpha(0);
    this.sc.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: "Quad.out" });
    if (pulse && !calm()) this.sc.tweens.add({ targets: t, alpha: 0.45, duration: 280, yoyo: true, repeat: -1, delay: 400 });
    return t;
  }

  protected flash(col = 0xffffff, a = 0.6) {
    const { SX, SY, SW, SH } = this.r;
    const f = this.put(this.sc.add.rectangle(SX, SY, SW, SH, col, calm() ? a * 0.25 : a).setOrigin(0), this.c.fx);
    this.sc.tweens.add({ targets: f, alpha: 0, duration: calm() ? 600 : 260, onComplete: () => f.destroy() });
  }

  protected shake(ms: number, amt: number) {
    this.sc.cameras.main.shake(calm() ? ms / 2 : ms, calm() ? amt / 3 : amt);
  }

  /** A box with lines of text (a menu or a mission card). */
  protected panel(x: number, y: number, w: number, h: number, edge: number, into = this.hud) {
    const box = this.put(this.sc.add.container(0, 0), into);
    box.add(this.sc.add.rectangle(x, y, w, h, 0x0b0b1a, 0.92).setStrokeStyle(3, edge));
    return box;
  }

  /** Clear the play area (keeping the HUD) for a new bit of the footage. */
  protected cut() {
    for (const o of [...this.play.list]) {
      this.sc.tweens.killTweensOf(o);
      o.destroy();
    }
    const { SX, SY, SW, SH } = this.r;
    this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
  }

  protected clearHud() {
    for (const o of [...this.hud.list]) {
      this.sc.tweens.killTweensOf(o);
      o.destroy();
    }
  }
}

// ==================================================================== FIFA: Audience

/**
 * Modes: "intro" (title, create-your-fan, the bus; then the stand with COIN and DISDAIN), "play" (the reporter's
 * run-down: hits, the goal you can't cheer, button mashing, the wanted level and stewards, the board), "story" (the
 * Eggy mission card and the chapter card), "invasion" (the pitch invasion and the birds in the rafters), "gameover".
 */
class FifaFootage extends Footage {
  private fan?: Phaser.GameObjects.Sprite;
  private scoreText?: Phaser.GameObjects.Text;
  private score = 0;
  private wanted?: Phaser.GameObjects.Text;
  private btnCoin?: Phaser.GameObjects.Text;
  private btnDis?: Phaser.GameObjects.Text;
  private loop?: Phaser.Time.TimerEvent;

  protected open(): number {
    this.scan();
    this.tag("GAME FOOTAGE · FIFA: AUDIENCE");
    switch (this.mode) {
      case "intro":
        this.titleCard();
        return 600;
      case "play":
        this.stand();
        this.hitRun();
        return 500;
      case "story":
        this.eggyCard();
        return 500;
      case "invasion":
        this.invasion();
        return 500;
      default:
        this.gameOver();
        return 500;
    }
  }

  protected onLine(i: number) {
    const m = this.mode;
    if (m === "intro" && i === 1) {
      this.stand();
      this.demo();
    }
    if (m === "play") {
      if (i === 1) this.goal();
      if (i === 2) this.mash();
      if (i === 3) this.steward();
      if (i === 4) this.board();
    }
    if (m === "story" && i === 1) this.chapter();
  }

  // ---- the look

  private hudBar() {
    const { SX, SY, SW } = this.r;
    this.put(this.sc.add.rectangle(SX, SY + 68, 250, 52, 0x0b1a10, 0.85).setOrigin(0).setStrokeStyle(2, 0x22c55e), this.hud);
    this.text(SX + 14, SY + 82, "HOME 0 - 4 AWAY  67:12", 12, "#bbf7d0").setOrigin(0, 0.5);
    this.scoreText = this.text(SX + 14, SY + 104, `SCORE ${String(this.score).padStart(6, "0")}`, 15, "#ffffff").setOrigin(0, 0.5);
    this.wanted = this.text(SX + SW - 18, SY + 72, "WANTED ☆☆☆☆☆", 14, "#fde047").setOrigin(1, 0.5);
    // the only two buttons
    const by = SY + 136;
    this.btnCoin = this.text(SX + 14, by, "[A] COIN", 15, "#facc15").setOrigin(0, 0.5);
    this.btnDis = this.text(SX + 126, by, "[B] DISDAIN", 15, "#f87171").setOrigin(0, 0.5);
  }

  private addScore(n: number) {
    this.score += n;
    this.scoreText?.setText(`SCORE ${String(this.score).padStart(6, "0")}`);
  }

  private press(b?: Phaser.GameObjects.Text) {
    if (!b?.active) return;
    this.sc.tweens.killTweensOf(b);
    b.setScale(1.35);
    this.sc.tweens.add({ targets: b, scale: 1, duration: 200 });
  }

  /** The fan, from behind, bottom left of the picture (the third-person camera). */
  private spawnFan(x: number, h: number) {
    if (!this.has("tvc_fifa_fan")) return;
    this.fan = this.put(this.sc.add.sprite(x, this.r.SY + this.r.SH + 14, "tvc_fifa_fan", 0).setOrigin(0.5, 1));
    this.fan.setScale(h / 128);
  }

  private throwAt(tx: number, ty: number, banana = Math.random() < 0.4, onHit?: () => void) {
    const fan = this.fan;
    if (!fan?.active) return;
    this.press(this.btnCoin);
    fan.play(this.anim("tvc_fifa_fan", 14, false, [1, 2, 3, 4, 5, 6, 5, 0]));
    this.c.later(300, () => {
      const hx = fan.x + fan.displayWidth * 0.32;
      const hy = fan.y - fan.displayHeight * 0.95;
      const p = banana && this.has("tvc_banana") ? this.put(this.sc.add.image(hx, hy, "tvc_banana").setScale(2)) : this.put(this.sc.add.circle(hx, hy, 5, 0xfacc15).setStrokeStyle(2, 0x92400e));
      synth.play("lob");
      this.sc.tweens.add({ targets: p, x: tx, duration: 520, ease: "Linear" });
      this.sc.tweens.add({ targets: p, y: Math.min(hy, ty) - 70, duration: 260, ease: "Quad.out", yoyo: false, onComplete: () => this.sc.tweens.add({ targets: p, y: ty, duration: 260, ease: "Quad.in" }) });
      this.sc.tweens.add({ targets: p, angle: 720, duration: 520 });
      this.c.later(530, () => {
        p.destroy();
        const s = vfx(this.sc, "vfx_hit", tx, ty, { scale: 1.6 });
        if (s) this.put(s);
        synth.play("hit");
        if (onHit) onHit();
        else {
          this.addScore(100);
          this.popup(tx, ty - 20, banana ? "BANANA'D! +150" : "HIT! +100", "#fde047");
        }
      });
    });
  }

  private disdain() {
    const fan = this.fan;
    if (!fan?.active) return;
    this.press(this.btnDis);
    fan.play(this.anim("tvc_fifa_fan", 8, false, [7, 8, 9, 10, 9, 10, 9, 10, 0]));
    synth.play("tap_fail");
    const b = this.text(fan.x + 70, fan.y - fan.displayHeight - 10, "BOOOOO!", 22, "#f87171", this.play, 6).setScale(0.3);
    this.sc.tweens.add({ targets: b, scale: 1, duration: 160, ease: "Back.out" });
    this.sc.tweens.add({ targets: b, alpha: 0, delay: 1300, duration: 300, onComplete: () => b.destroy() });
    this.popup(fan.x + 150, fan.y - fan.displayHeight - 40, "DISDAIN +50", "#fca5a5", 16);
    this.addScore(50);
  }

  // ---- intro

  private titleCard() {
    const { SX, SY, SW, SH } = this.r;
    this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x05210f).setOrigin(0));
    // a floodlit pitch behind the title
    if (this.has("bg_stadium")) this.fill("bg_stadium", 1.05).setAlpha(0.35);
    const t = this.text(this.cx, SY + 150, "FIFA: AUDIENCE", 48, "#ffffff", this.hud, 9).setScale(0.2);
    this.sc.tweens.add({ targets: t, scale: 1, duration: 420, ease: "Back.out" });
    const sub = this.text(this.cx, SY + 200, "THE MATCHDAY SIM", 18, "#4ade80", this.hud, 5);
    const ps = this.text(this.cx, SY + 270, "PRESS START", 18, "#fde047", this.hud, 5);
    if (!calm()) this.sc.tweens.add({ targets: ps, alpha: 0.2, duration: 380, yoyo: true, repeat: -1 });
    synth.play("whistle");
    // create your fan
    this.c.later(2100, () => {
      for (const o of [t, sub, ps]) o.destroy();
      this.cut();
      this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x0f172a).setOrigin(0));
      const box = this.panel(this.cx + 110, SY + 200, 250, 200, 0x22c55e, this.play);
      this.text(this.cx + 110, SY + 116, "CREATE YOUR FAN", 18, "#4ade80", box, 4);
      const rows = ["HAIR ........ NONE", "AGE ....... 40-50", "COMPLEXION . WHITE", "CHEER ....... N/A", "COINS ........ 99", "DISDAIN ..... MAX"];
      rows.forEach((s, i) => this.c.later(200 + i * 260, () => {
        this.text(this.cx + 110, SY + 148 + i * 22, s, 14, i === 3 ? "#9ca3af" : "#ffffff", box, 3);
        synth.play("select");
      }));
      if (this.has("tvc_fifa_fan")) {
        const f = this.put(this.sc.add.sprite(SX + 140, SY + 330, "tvc_fifa_fan", 0).setOrigin(0.5, 1).setScale(2));
        this.sc.tweens.add({ targets: f, scaleX: -2, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    });
    // the bus
    this.c.later(5600, () => this.bus());
  }

  private bus() {
    const { SX, SY, SW, SH } = this.r;
    this.cut();
    // inside the supporters' coach: windows down both sides, the aisle, the scenery going past
    this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x1e293b).setOrigin(0));
    const sky = this.put(this.sc.add.rectangle(SX, SY + 70, SW, 120, 0x93c5fd).setOrigin(0));
    void sky;
    const houses: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 9; i++) {
      const h = this.put(this.sc.add.rectangle(SX + i * 80, SY + 190, 60, 40 + ((i * 37) % 50), [0x9a3412, 0x78716c, 0x7c2d12][i % 3]).setOrigin(0, 1));
      houses.push(h);
    }
    this.c.every(16, () => {
      for (const h of houses) {
        h.x -= 6;
        if (h.x < SX - 70) h.x += 9 * 80;
      }
    });
    // window frames and the seats
    const g = this.put(this.sc.add.graphics());
    g.fillStyle(0x0f172a, 1);
    for (let x = SX; x < SX + SW; x += 112) g.fillRect(x, SY + 70, 14, 120);
    g.fillRect(SX, SY + 60, SW, 14).fillRect(SX, SY + 186, SW, 10);
    g.fillStyle(0x1d4ed8, 1);
    for (let i = 0; i < 4; i++) {
      g.fillRect(SX + 10 + i * 30, SY + 220 + i * 26, 90 - i * 10, 60);
      g.fillRect(SX + SW - 100 - i * 30 + i * 10, SY + 220 + i * 26, 90 - i * 10, 60);
    }
    this.spawnFan(this.cx, 300);
    if (this.fan) this.sc.tweens.add({ targets: this.fan, y: this.fan.y + 4, duration: 180, yoyo: true, repeat: -1 });
    this.text(this.cx + 120, SY + 96, "MATCHDAY", 30, "#ffffff", this.hud, 7);
    this.text(this.cx + 120, SY + 128, "OBJECTIVE: GET TO THE GROUND", 15, "#fde047", this.hud, 4);
    this.hudBar();
  }

  /** The stand, the pitch beyond, and him. */
  private stand() {
    this.cut();
    this.clearHud();
    this.fill("bg_stadium", 1.12, 0, 26);
    // the crowd in the rows below moves about
    this.spawnFan(this.r.SX + 170, 300);
    this.hudBar();
  }

  private crowdPoint() {
    const { SX, SY, SW } = this.r;
    return { x: SX + SW * (0.4 + Math.random() * 0.5), y: SY + 150 + Math.random() * 70 };
  }

  private demo() {
    this.c.later(300, () => {
      const p = this.crowdPoint();
      this.throwAt(p.x, p.y, false);
    });
    this.c.later(1500, () => {
      const p = this.crowdPoint();
      this.throwAt(p.x, p.y, true);
    });
    this.c.later(3000, () => this.disdain());
    this.c.later(5200, () => {
      const p = this.crowdPoint();
      this.throwAt(p.x, p.y, false);
    });
  }

  // ---- the run-down

  private hits = 0;

  private hitRun() {
    this.loop?.remove();
    this.loop = this.c.every(900, () => {
      const p = this.crowdPoint();
      this.throwAt(p.x, p.y, Math.random() < 0.4, () => {
        this.hits++;
        this.addScore(100 * this.hits);
        this.popup(p.x, p.y - 20, this.hits > 1 ? `HIT x${this.hits} COMBO! +${100 * this.hits}` : "HIT! +100", "#fde047");
        if (this.hits % 3 === 0) this.popup(p.x, p.y - 60, "ANY TEAM! BONUS", "#4ade80", 15);
      });
    });
  }

  private goal() {
    this.loop?.remove();
    const { SY } = this.r;
    this.flash(0xffffff, 0.4);
    synth.play("cheer");
    const g = this.banner("GOAL!!", "#4ade80", SY + 150, 52);
    this.c.later(1200, () => {
      const c = this.banner("CHEER: NOT AVAILABLE", "#9ca3af", SY + 200, 20);
      c.setStroke("#000000", 5);
      this.c.later(3600, () => this.sc.tweens.add({ targets: [g, c], alpha: 0, duration: 300, onComplete: () => (g.destroy(), c.destroy()) }));
      synth.play("tap_fail");
      this.c.later(900, () => this.disdain());
      this.c.later(2600, () => this.disdain());
    });
  }

  private mash() {
    const { SX, SY, SW } = this.r;
    const box = this.panel(this.cx + 60, SY + 180, 300, 110, 0xfacc15);
    this.text(this.cx + 60, SY + 146, "MASH [A]!!", 26, "#facc15", box, 6);
    const bar = this.put(this.sc.add.rectangle(this.cx - 70, SY + 196, 0, 18, 0xf97316).setOrigin(0, 0.5), box);
    box.add(this.sc.add.rectangle(this.cx - 70, SY + 196, 260, 18).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff));
    const n = this.text(this.cx + 60, SY + 222, "x0", 16, "#ffffff", box, 4);
    let k = 0;
    const t = this.c.every(90, () => {
      k++;
      bar.width = Math.min(260, k * 5);
      n.setText(`x${k}  MASH BONUS +${k * 10}`);
      if (k % 3 === 0) this.press(this.btnCoin);
      if (k % 4 === 0) synth.play("select", 0.5);
      if (k >= 52) {
        t.remove();
        this.addScore(k * 10);
        this.text(this.cx + 60, SY + 112, "MAX MASH!", 20, "#4ade80", box, 5);
      }
    });
    void SX;
    void SW;
  }

  private steward() {
    const { SX, SY, SW } = this.r;
    this.hud.list.filter((o) => o instanceof Phaser.GameObjects.Container).forEach((o) => o.destroy());
    this.wanted?.setText("WANTED ★★★☆☆").setColor("#ef4444");
    synth.play("alarm");
    if (!calm() && this.wanted) this.sc.tweens.add({ targets: this.wanted, alpha: 0.3, duration: 220, yoyo: true, repeat: 5 });
    for (let i = 0; i < 3; i++) {
      this.c.later(400 + i * 1500, () => {
        if (!this.has("tvc_fifa_steward")) return;
        const s = this.put(this.sc.add.image(SX + SW + 30, SY + 250 + i * 12, "tvc_fifa_steward").setOrigin(0.5, 1).setScale(2.6).setFlipX(true));
        this.sc.tweens.add({ targets: s, y: s.y - 6, duration: 110, yoyo: true, repeat: -1 });
        this.sc.tweens.add({ targets: s, x: SX + SW * 0.5, duration: 1100, ease: "Linear" });
        this.c.later(500, () =>
          this.throwAt(SX + SW * 0.62, s.y - 50, true, () => {
            this.sc.tweens.killTweensOf(s);
            this.sc.tweens.add({ targets: s, angle: 100, x: s.x + 40, y: s.y + 40, alpha: 0, duration: 500, ease: "Quad.in", onComplete: () => s.destroy() });
            this.addScore(250);
            this.popup(s.x, s.y - 120, "STEWARD DOWN +250", "#4ade80");
          }),
        );
      });
    }
  }

  private board() {
    const { SX, SY, SW, SH } = this.r;
    this.loop?.remove();
    this.cut();
    this.clearHud();
    this.flash(0x000000, 0.8);
    this.fill("tv_k1_boardroom", 1.05);
    this.spawnFan(SX + 160, 300);
    this.hudBar();
    this.wanted?.setText("CAUGHT").setColor("#ef4444");
    const box = this.panel(this.cx + 60, SY + 150, 360, 110, 0xffffff);
    this.text(this.cx + 60, SY + 116, "DISCIPLINARY HEARING", 16, "#fde047", box, 4);
    const say = this.text(this.cx + 60, SY + 158, "THE BOARD: You have", 18, "#ffffff", box, 4);
    this.c.later(1500, () => say.setText("THE BOARD: You have\n\"ONE MORE CHANCE\""));
    this.c.later(2200, () => this.throwAt(SX + SW * 0.6, SY + SH * 0.62, false));
    this.c.later(3300, () => this.disdain());
    this.c.later(5000, () => {
      say.setText("THE BOARD: You have\n\"ONE MORE CHANCE\" (x47)");
      synth.play("ding");
    });
  }

  // ---- the story

  private eggyCard() {
    const { SX, SY, SW, SH } = this.r;
    this.fill("tv_k1_stadium", 1.05).setAlpha(0.45);
    this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0.45).setOrigin(0));
    const box = this.panel(this.cx, SY + 190, SW - 90, 200, 0xf97316);
    this.text(this.cx, SY + 108, "MISSION 14: CALL IT OFF", 22, "#f97316", box, 5);
    this.text(this.cx, SY + 142, "HOME 0 - 4 AWAY", 18, "#ffffff", box, 4);
    // Eggy on the radio
    const face = this.put(this.sc.add.container(SX + 110, SY + 214), box);
    face.add(this.sc.add.ellipse(0, 0, 54, 64, 0xf1c9a5).setStrokeStyle(3, 0x000000));
    face.add(this.sc.add.rectangle(-10, -6, 6, 6, 0x000000));
    face.add(this.sc.add.rectangle(10, -6, 6, 6, 0x000000));
    face.add(this.sc.add.rectangle(0, 14, 18, 4, 0x7f1d1d));
    this.text(SX + 110, SY + 260, "EGGY", 14, "#fde047", box, 4);
    const t = this.text(this.cx + 50, SY + 214, "", 17, "#ffffff", box, 4);
    const line = "\"Get it called off, mate.\"";
    let k = 0;
    this.c.every(45, () => {
      if (k > line.length) return;
      t.setText(line.slice(0, k++));
      if (k % 3 === 0) synth.play("type", 0.4);
    });
    this.text(this.cx, SY + 276, "[A] ACCEPT     [B] DISDAIN", 15, "#9ca3af", box, 3);
  }

  private chapter() {
    const { SX, SY, SW, SH } = this.r;
    this.cut();
    this.clearHud();
    this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x0a0a0a).setOrigin(0));
    const bg = this.fill("tv_k1_stadium", 1.1);
    if (bg instanceof Phaser.GameObjects.Image) bg.setTint(0xdc6a5a);
    this.sc.tweens.add({ targets: bg, x: bg.x - 30, duration: 8000 });
    if (this.has("tvc_fifa_fan")) {
      const f = this.put(this.sc.add.sprite(this.cx, SY + SH + 10, "tvc_fifa_fan", 0).setOrigin(0.5, 1).setScale(2.8).setTintFill(0x000000));
      this.sc.tweens.add({ targets: f, scale: 3.1, duration: 8000 });
    }
    this.text(this.cx, SY + 100, "CHAPTER 3", 20, "#fca5a5", this.hud, 5);
    const t = this.text(this.cx, SY + 140, "RECLAIM WHAT'S\nRIGHTFULLY HIS", 32, "#ffffff", this.hud, 7).setAlpha(0);
    this.sc.tweens.add({ targets: t, alpha: 1, duration: 900 });
    synth.play("thunder");
  }

  // ---- the pitch invasion

  private invasion() {
    const { SX, SY, SW, SH } = this.r;
    this.fill("tv_k1_stadium", 1.1, 0, 10);
    this.banner("CUP WINNERS!", "#fde047", SY + 110, 34);
    // everyone pours on: little fans running across
    for (let i = 0; i < 14; i++) {
      this.c.later(i * 160, () => {
        if (!this.has("tvc_fifa_fan")) return;
        const y = SY + 220 + Math.random() * 120;
        const f = this.put(this.sc.add.sprite(SX - 20, y, "tvc_fifa_fan", 0).setOrigin(0.5, 1).setScale(0.35 + (y - SY - 200) / 400).setTint(Phaser.Display.Color.GetColor(150 + Math.random() * 100, 150 + Math.random() * 100, 150 + Math.random() * 100)));
        this.sc.tweens.add({ targets: f, x: SX + SW + 40, duration: 2600 + Math.random() * 1200 });
        this.sc.tweens.add({ targets: f, y: y - 6, duration: 120, yoyo: true, repeat: -1 });
      });
    }
    synth.play("cheer");
    // up to the rafters: the birds
    this.c.later(3300, () => {
      this.cut();
      this.clearHud();
      this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x1f2937).setOrigin(0));
      this.fill("bg_stadium", 1.6, 0, 120).setAlpha(0.55);
      const g = this.put(this.sc.add.graphics());
      g.fillStyle(0x374151, 1).fillRect(SX, SY + 150, SW, 22);
      for (let x = SX; x < SX + SW; x += 70) g.fillStyle(0x4b5563, 1).fillTriangle(x, SY + 172, x + 35, SY + 240, x + 70, SY + 172);
      const birds: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < 4; i++) {
        if (!this.has("tvc_fifa_pigeon")) break;
        const b = this.put(this.sc.add.image(SX + 200 + i * 70, SY + 152, "tvc_fifa_pigeon").setOrigin(0.5, 1).setScale(2.4).setFlipX(i % 2 === 0));
        birds.push(b);
        this.sc.tweens.add({ targets: b, angle: 6, duration: 300 + i * 50, yoyo: true, repeat: -1 });
      }
      this.spawnFan(SX + 140, 280);
      this.hudBar();
      const box = this.panel(this.cx + 80, SY + 260, 260, 76, 0xfacc15);
      this.text(this.cx + 80, SY + 240, "BIRDS NESTING", 16, "#fde047", box, 4);
      const pick = this.text(this.cx + 80, SY + 270, "> COIN    DISDAIN", 16, "#ffffff", box, 4);
      this.c.later(1000, () => {
        pick.setText("  COIN  > DISDAIN");
        synth.play("select");
      });
      this.c.later(1700, () => {
        box.destroy();
        this.disdain();
      });
      this.c.later(3000, () => {
        this.popup(SX + 360, SY + 120, "THE BIRDS DO NOT CARE", "#93c5fd", 16);
        birds.forEach((b, i) => {
          this.sc.tweens.killTweensOf(b);
          this.sc.tweens.add({ targets: b, x: b.x + 120 + i * 30, y: SY - 40, duration: 1200, delay: i * 120, ease: "Quad.in" });
        });
      });
    });
  }

  private gameOver() {
    const { SX, SY, SW, SH } = this.r;
    this.fill("bg_stadium", 1.12, 0, 26);
    this.spawnFan(SX + 170, 300);
    this.hudBar();
    const box = this.panel(this.cx + 60, SY + 150, 320, 70, 0xf97316);
    this.text(this.cx + 60, SY + 150, "OBJECTIVE: [REDACTED]", 18, "#f97316", box, 4);
    this.c.later(1200, () => {
      box.destroy();
      const red = this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x7f0000, 0).setOrigin(0), this.hud);
      this.sc.tweens.add({ targets: red, fillAlpha: 0.7, duration: 400 });
      this.banner("LEVEL FAILED", "#ffffff", SY + 130, 44);
      synth.play("trombone");
      this.c.later(800, () => this.banner("YOU CHOSE NOT TO.", "#fde047", SY + 184, 22));
      this.c.later(1500, () => this.banner("GAME OVER", "#ef4444", SY + 232, 36));
      this.c.later(2400, () => {
        let n = 9;
        const t = this.text(this.cx, SY + 280, "CONTINUE? 9", 16, "#ffffff", this.hud, 4);
        this.c.every(800, () => t.setText(`CONTINUE? ${Math.max(0, --n)}`));
      });
    });
  }
}

// ==================================================================== the kart racer

const RIVALS = [
  { key: "tvc_kart_plumber", name: "PLUMBER PETE", w: 150 },
  { key: "tvc_kart_granny", name: "NANA NITRO", w: 140 },
  { key: "tvc_kart_frog", name: "FROGGO", w: 130 },
];

/** Modes: "race" (the trailer: a lap with items and Tate in it), "roster" (character select), "runover" (the Bugatti). */
class KartFootage extends Footage {
  private track?: Phaser.GameObjects.TileSprite;
  private speed = 7;
  private roadY = 0;
  private karts: { s: Phaser.GameObjects.Image; name: string; alive: boolean }[] = [];
  private tate?: Phaser.GameObjects.Image;
  private kills = 0;
  private killText?: Phaser.GameObjects.Text;

  protected open(): number {
    this.scan();
    this.tag("GAME FOOTAGE · MARIO KART WORLD (PRE-RELEASE)");
    if (this.mode === "roster") {
      this.roster();
      return 500;
    }
    this.raceScene();
    if (this.mode === "runover") this.runover();
    else this.race();
    return 500;
  }

  private raceScene() {
    const { SX, SY, SW, SH } = this.r;
    if (this.has("tvc_kart_track")) {
      // the track art is 400x200, road at y≈128-150: keep the road above the subtitles and the news straps
      const s = 2.2;
      this.track = this.put(this.sc.add.tileSprite(SX, SY, SW, SH, "tvc_kart_track").setOrigin(0).setTileScale(s, s));
      this.track.tilePositionY = 26;
      this.roadY = SY + (146 - 26) * s;
    } else {
      this.put(this.sc.add.rectangle(SX, SY, SW, SH, 0x38bdf8).setOrigin(0));
      this.roadY = SY + SH - 110;
      this.put(this.sc.add.rectangle(SX, this.roadY - 50, SW, 60, 0x4b5563).setOrigin(0));
    }
    this.c.every(16, () => {
      if (this.track?.active) this.track.tilePositionX += this.speed;
    });
    this.hudBar();
  }

  private hudBar() {
    const { SX, SY, SW, SH } = this.r;
    this.put(this.sc.add.rectangle(SX + 10, SY + 66, 130, 50, 0x000000, 0.55).setOrigin(0), this.hud);
    this.text(SX + 20, SY + 80, "LAP 2/3", 16, "#ffffff").setOrigin(0, 0.5);
    this.text(SX + 20, SY + 102, "● x 10", 14, "#facc15").setOrigin(0, 0.5);
    // the item slot, top middle
    this.put(this.sc.add.rectangle(this.cx, SY + 92, 56, 56, 0x111827, 0.85).setStrokeStyle(3, 0xffffff), this.hud);
    const item = this.text(this.cx, SY + 92, "?", 30, "#fde047");
    const items = ["?", "★", "BANANA", "BOOST", "?"];
    let k = 0;
    this.c.every(calm() ? 600 : 160, () => item.setText(items[k++ % items.length]).setFontSize(items[k % items.length].length > 1 ? 11 : 30));
    // place
    this.place = this.text(SX + SW - 70, SY + 100, "3RD", 34, "#fde047", this.hud, 7);
    // mini-map
    const g = this.put(this.sc.add.graphics(), this.hud);
    g.lineStyle(4, 0xffffff, 0.8).strokeRoundedRect(SX + SW - 110, SY + 136, 90, 56, 20);
    const dot = this.put(this.sc.add.circle(SX + SW - 110, SY + 156, 5, 0xf97316), this.hud);
    this.sc.tweens.add({ targets: dot, x: SX + SW - 20, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private place?: Phaser.GameObjects.Text;

  private kart(key: string, x: number, lane: number, w: number) {
    if (!this.has(key)) return null;
    const s = this.put(this.sc.add.image(x, this.roadY + lane * 8, key).setOrigin(0.5, 1));
    this.width(s, w);
    s.setDepth(lane);
    this.sc.tweens.add({ targets: s, y: s.y - 3, duration: 90 + Math.random() * 40, yoyo: true, repeat: -1 });
    return s;
  }

  private tateKart(x: number, lane: number) {
    // the Tate kart art has margin: its wheels sit at y≈110 of 128
    if (!this.has("tv_k4_tate_kart")) return null;
    const w = 190;
    const s = this.put(this.sc.add.image(x, this.roadY + lane * 8 + 18 * (w / 128), "tv_k4_tate_kart").setOrigin(0.5, 1));
    this.width(s, w);
    this.sc.tweens.add({ targets: s, y: s.y - 3, duration: 80, yoyo: true, repeat: -1 });
    this.tate = s;
    return s;
  }

  private sortDepth() {
    this.play.sort("y");
  }

  private race() {
    const { SX, SW } = this.r;
    const xs = [0.62, 0.42, 0.82];
    RIVALS.forEach((rv, i) => {
      const s = this.kart(rv.key, SX + SW * xs[i], i === 1 ? 1 : 0, rv.w);
      if (s) this.karts.push({ s, name: rv.name, alive: true });
    });
    const t = this.tateKart(SX + 90, 1);
    this.sortDepth();
    synth.play("jet");
    // the karts jostle
    this.c.every(1300, () => {
      for (const k of this.karts) if (k.alive && k.s.active) this.sc.tweens.add({ targets: k.s, x: Phaser.Math.Clamp(k.s.x + (Math.random() - 0.5) * 80, SX + 80, SX + SW - 80), duration: 1000, ease: "Sine.easeInOut" });
    });
    if (!t) return;
    // Tate boosts up through the pack, drops a banana, takes the lead
    this.c.later(1400, () => {
      this.popup(t.x + 40, t.y - 150, "BOOST!", "#f97316");
      synth.play("jet");
      this.sc.tweens.add({ targets: t, x: SX + SW * 0.55, duration: 1400, ease: "Quad.out" });
      this.place?.setText("2ND");
    });
    this.c.later(3000, () => {
      if (!this.has("tvc_banana")) return;
      const b = this.put(this.sc.add.image(t.x - 70, t.y - 20, "tvc_banana").setScale(2.4).setOrigin(0.5, 1));
      // it stays on the road while the road goes past
      this.sc.tweens.add({ targets: b, x: SX - 60, duration: 1800, ease: "Linear" });
      const frog = this.karts.find((k) => k.name === "FROGGO");
      if (frog?.s.active) {
        this.sc.tweens.killTweensOf(frog.s);
        this.sc.tweens.add({ targets: frog.s, x: SX + 140, duration: 700 });
        this.c.later(700, () => {
          b.destroy();
          synth.play("pfft");
          this.bang(frog.s.x, frog.s.y - 110, "SPIN OUT!", "#fde047", 22);
          this.sc.tweens.add({ targets: frog.s, angle: 720, x: SX - 120, duration: 1100, ease: "Quad.in" });
        });
      }
    });
    this.c.later(4400, () => {
      this.sc.tweens.add({ targets: t, x: SX + SW * 0.85, duration: 1200, ease: "Sine.easeInOut" });
      this.place?.setText("1ST");
      this.popup(t.x, t.y - 150, "1ST PLACE", "#fde047", 22);
    });
  }

  private roster() {
    const { SX, SY, SW } = this.r;
    const g = this.put(this.sc.add.graphics());
    g.fillGradientStyle(0x7c3aed, 0x7c3aed, 0xdb2777, 0xdb2777, 1).fillRect(SX, SY, SW, this.r.SH);
    this.text(this.cx, SY + 76, "SELECT YOUR RACER", 24, "#ffffff", this.hud, 7);
    const all = [...RIVALS.map((r) => ({ key: r.key, name: r.name })), { key: "tv_k4_tate_kart", name: "???" }];
    const tile = 120;
    const gap = 10;
    const x0 = this.cx - (all.length * tile + (all.length - 1) * gap) / 2 + tile / 2;
    all.forEach((rv, i) => {
      const x = x0 + i * (tile + gap);
      const y = SY + 200;
      const box = this.put(this.sc.add.rectangle(x, y, tile, tile + 26, 0x111827, 0.9).setStrokeStyle(4, 0xffffff));
      const last = i === all.length - 1;
      const name = this.text(x, y + 62, rv.name, 12, "#ffffff", this.hud, 4);
      if (this.has(rv.key)) {
        const s = this.put(this.sc.add.image(x, y - 4, rv.key));
        this.width(s, last ? 140 : 96);
        if (last) s.setTintFill(0x000000);
        if (last) this.c.later(1700, () => {
          s.clearTint();
          box.setStrokeStyle(5, 0xf97316);
          name.setText("ANDREW TATE").setColor("#f97316");
          this.flash(0xffffff, 0.5);
          synth.play("gunget");
          const nc = this.banner("NEW CHALLENGER!", "#f97316", SY + 112, 28, true);
          void nc;
          this.c.later(1600, () => this.text(x, y - 74, "BAD GUY", 13, "#ef4444", this.hud, 4));
        });
      }
    });
    // the cursor walks along to the locked slot
    const cur = this.put(this.sc.add.rectangle(x0, SY + 200, tile + 12, tile + 38).setStrokeStyle(4, 0xfde047), this.hud);
    let k = 0;
    this.c.every(420, () => {
      if (k >= all.length - 1) return;
      k++;
      cur.x = x0 + k * (tile + gap);
      synth.play("select");
    });
  }

  private runover() {
    const { SX, SY, SW } = this.r;
    this.place?.setText("8TH");
    const mk = (i: number, x: number, lane: number) => {
      const rv = RIVALS[i % RIVALS.length];
      const s = this.kart(rv.key, x, lane, rv.w);
      if (s) this.karts.push({ s, name: rv.name, alive: true });
    };
    mk(0, SX + SW * 0.45, 0);
    mk(1, SX + SW * 0.7, 1);
    mk(2, SX + SW * 0.92, 0);
    const t = this.tateKart(SX - 120, 1);
    this.sortDepth();
    this.text(this.cx, SY + 140, "BUGATTI MODE", 20, "#f97316", this.hud, 6);
    this.killText = this.text(SX + 20, SY + 130, "KILLS 0", 16, "#ef4444").setOrigin(0, 0.5);
    synth.play("jet");
    if (!t) return;
    // he comes up from behind and through each of them
    this.karts.forEach((k, i) => {
      this.c.later(500 + i * 1100, () => {
        if (!t.active || !k.s.active) return;
        this.sc.tweens.add({
          targets: t,
          x: k.s.x + 20,
          duration: 700,
          ease: "Quad.in",
          onComplete: () => this.squash(k),
        });
      });
    });
    this.c.later(500 + this.karts.length * 1100 + 400, () => {
      if (t.active) this.sc.tweens.add({ targets: t, x: SX + SW + 160, duration: 900, ease: "Quad.in" });
      this.place?.setText("1ST");
      this.banner("PLAYERS ELIMINATED: 3", "#ef4444", SY + 200, 22);
    });
  }

  /** A kart is run over: flattened (and, with gore on, a cartoon splat). */
  private squash(k: { s: Phaser.GameObjects.Image; name: string; alive: boolean }) {
    if (!k.alive) return;
    k.alive = false;
    const s = k.s;
    this.sc.tweens.killTweensOf(s);
    const x = s.x;
    const y = s.y;
    synth.play("smash");
    this.shake(220, 0.01);
    const sy = s.scaleY;
    this.sc.tweens.add({ targets: s, scaleY: sy * 0.18, duration: 120, ease: "Quad.out" });
    this.sc.tweens.add({ targets: s, x: x - 400, delay: 500, duration: 900, ease: "Linear" });
    if (gore()) {
      const a = vfx(this.sc, "vfx_bloodspray", x, y - 30, { scale: 1.6 });
      if (a) this.put(a);
      const b = vfx(this.sc, "tva_vfx_splat", x + 20, y - 60, { scale: 1.8 });
      if (b) this.put(b);
      this.bang(x, y - 120, ["SPLAT!", "CRUNCH!", "K.O.!"][this.kills % 3], "#ff2a2a");
    } else {
      const a = vfx(this.sc, "vfx_stars", x, y - 50, { scale: 1.8 });
      if (a) this.put(a);
      const b = vfx(this.sc, "vfx_pixeldeath", x, y - 30, { scale: 1.6 });
      if (b) this.put(b);
      this.bang(x, y - 120, "FLATTENED!", "#facc15");
    }
    this.kills++;
    this.killText?.setText(`KILLS ${this.kills}`);
    this.popup(x, y - 160, this.kills > 1 ? `KILLSTREAK x${this.kills}!` : `${k.name} ELIMINATED`, "#f97316", 16);
  }
}

// ==================================================================== Flight Simulator: Crash Mode

/** Modes: "dlc" (cruising, then the CRASH MODE splash), "crash" (a cartoon mid-air for points), "land" (the menu), "sensor". */
class FlightFootage extends Footage {
  private sky?: Phaser.GameObjects.TileSprite;
  private plane?: Phaser.GameObjects.Image;
  private alt = 32000;
  private altText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;

  protected open(): number {
    this.scan();
    this.tag("GAME FOOTAGE · FLIGHT SIMULATOR: CRASH MODE DLC");
    if (this.mode === "land") {
      this.land();
      return 500;
    }
    this.cruise();
    if (this.mode === "dlc") this.c.later(1800, () => this.dlcSplash());
    if (this.mode === "crash") this.crash();
    if (this.mode === "sensor") this.sensor();
    return 500;
  }

  private cruise() {
    const { SX, SY, SW, SH } = this.r;
    const g = this.put(this.sc.add.graphics());
    g.fillGradientStyle(0x1e3a8a, 0x1e3a8a, 0x7dd3fc, 0x7dd3fc, 1).fillRect(SX, SY, SW, SH);
    if (this.has("pl_sky")) {
      const s = SH / 180;
      this.sky = this.put(this.sc.add.tileSprite(SX, SY, SW, SH, "pl_sky").setOrigin(0).setTileScale(s, s));
      this.c.every(16, () => {
        if (this.sky?.active) this.sky.tilePositionX += 1.4;
      });
    }
    if (this.has("p_plane_hd")) {
      this.plane = this.put(this.sc.add.image(this.cx - 20, SY + SH * 0.45, "p_plane_hd"));
      this.width(this.plane, 300);
      this.sc.tweens.add({ targets: this.plane, y: this.plane.y - 8, angle: -1.5, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.pfd();
  }

  /** The flight-sim instruments: speed and altitude tapes, heading, a little horizon, the score. */
  private pfd() {
    const { SX, SY, SW, SH } = this.r;
    const g = this.put(this.sc.add.graphics(), this.hud);
    g.fillStyle(0x000000, 0.45).fillRect(SX + 14, SY + 90, 64, 200).fillRect(SX + SW - 92, SY + 90, 78, 200);
    g.lineStyle(2, 0x4ade80, 0.9).strokeRect(SX + 14, SY + 90, 64, 200).strokeRect(SX + SW - 92, SY + 90, 78, 200);
    for (let i = 0; i < 8; i++) g.lineStyle(2, 0x4ade80, 0.7).lineBetween(SX + 60, SY + 100 + i * 25, SX + 78, SY + 100 + i * 25).lineBetween(SX + SW - 92, SY + 100 + i * 25, SX + SW - 74, SY + 100 + i * 25);
    this.text(SX + 46, SY + 80, "SPD", 11, "#4ade80", this.hud, 3);
    this.text(SX + 46, SY + 190, "480", 16, "#ffffff", this.hud, 4);
    this.text(SX + SW - 53, SY + 80, "ALT", 11, "#4ade80", this.hud, 3);
    this.altText = this.text(SX + SW - 53, SY + 190, "32000", 15, "#ffffff", this.hud, 4);
    this.text(this.cx, SY + 74, "HDG 270 · KRELFORD", 13, "#4ade80", this.hud, 3);
    this.scoreText = this.text(this.cx, SY + 250, "", 18, "#fde047", this.hud, 5);
    // the crosshair
    g.lineStyle(2, 0xfde047, 0.8).lineBetween(this.cx - 40, SY + SH / 2, this.cx - 12, SY + SH / 2).lineBetween(this.cx + 12, SY + SH / 2, this.cx + 40, SY + SH / 2);
    this.c.every(200, () => {
      this.alt += Math.round((Math.random() - 0.5) * 60);
      this.altText?.setText(String(this.alt));
    });
  }

  private dlcSplash() {
    const { SY } = this.r;
    this.flash(0xffffff, 0.5);
    synth.play("gunget");
    const box = this.panel(this.cx, SY + 190, 400, 150, 0xef4444);
    this.text(this.cx, SY + 136, "NEW! DLC", 16, "#fde047", box, 4);
    const t = this.text(this.cx, SY + 176, "CRASH MODE", 42, "#ef4444", box, 8).setScale(0.3);
    this.sc.tweens.add({ targets: t, scale: 1, duration: 300, ease: "Back.out" });
    this.text(this.cx, SY + 222, "DELIBERATELY CRASH YOUR AIRCRAFT.\nRACK UP THE POINTS.", 13, "#ffffff", box, 3);
    this.c.later(2600, () => this.text(this.cx, SY + 290, "★ PENIS SENSOR SUPPORT ★", 15, "#f472b6", this.hud, 4));
  }

  private crash() {
    const { SX, SY, SW, SH } = this.r;
    if (!this.has("p_plane_hd") || !this.plane) return;
    const other = this.put(this.sc.add.image(SX + SW + 200, SY + SH * 0.45, "p_plane_hd").setFlipX(true).setTint(0x9ae6ff));
    this.width(other, 300);
    const warn = this.banner("TRAFFIC! TRAFFIC!", "#ef4444", SY + 120, 24, true);
    synth.play("alarm");
    this.scoreText?.setText("CRASH MODE: AIM FOR THE OTHER PLANE");
    this.sc.tweens.add({ targets: other, x: this.cx + 140, duration: 1600, ease: "Quad.in" });
    this.sc.tweens.add({ targets: this.plane, x: this.cx - 20, duration: 1600 });
    this.c.later(1600, () => {
      warn.destroy();
      const p = this.plane;
      if (!p) return;
      this.sc.tweens.killTweensOf([p, other]);
      this.flash(0xffffff, 0.7);
      this.shake(400, 0.014);
      synth.play("explode");
      const a = vfx(this.sc, "vfx_bigboom", this.cx + 60, SY + SH * 0.45, { scale: 3 });
      if (a) this.put(a);
      const st = vfx(this.sc, "vfx_stars", this.cx + 60, SY + SH * 0.4, { scale: 2.6 });
      if (st) this.put(st);
      this.bang(this.cx + 60, SY + 120, "KA-BOOM!", "#f97316", 40);
      // a cartoon: both planes come out of it blackened, spinning, a puff of smoke each, and off the bottom
      for (const [o, dx] of [[p, -1], [other, 1]] as [Phaser.GameObjects.Image, number][]) {
        o.setTint(0x3f3f46);
        this.sc.tweens.add({ targets: o, x: o.x + dx * 160, y: SY + SH + 200, angle: dx * 540, duration: 1800, ease: "Quad.in" });
        this.c.every(140, () => {
          if (!o.active || o.y > SY + SH + 60) return;
          const sm = vfx(this.sc, "vfx_smoke", o.x, o.y, { scale: 1.4 });
          if (sm) this.put(sm);
        });
      }
      this.c.later(500, () => {
        this.scoreText?.setText("MID-AIR COLLISION! +5000");
        synth.play("coin");
      });
      this.c.later(1600, () => this.banner("COMBO x2 · ACHIEVEMENT UNLOCKED", "#fde047", SY + 210, 16));
    });
  }

  private land() {
    const { SX, SY, SW, SH } = this.r;
    const g = this.put(this.sc.add.graphics());
    g.fillGradientStyle(0x60a5fa, 0x60a5fa, 0xfde68a, 0xfde68a, 1).fillRect(SX, SY, SW, SH * 0.62);
    g.fillStyle(0x4d7c0f, 1).fillRect(SX, SY + SH * 0.62, SW, SH * 0.38);
    g.fillStyle(0x374151, 1).fillRect(SX, SY + SH * 0.7, SW, 46);
    const dashes = Array.from({ length: 8 }, (_, i) => this.put(this.sc.add.rectangle(SX + i * 80, SY + SH * 0.7 + 21, 40, 4, 0xffffff).setOrigin(0)));
    this.c.every(16, () => {
      for (const d of dashes) if (d.active && (d.x -= 6) < SX - 50) d.x += 8 * 80;
    });
    this.text(SX + SW - 120, SY + SH * 0.6, "KRELFORD INTL", 13, "#ffffff", this.play, 3);
    this.pfd();
    if (this.has("p_plane_hd")) {
      const p = this.put(this.sc.add.image(SX + 120, SY + 120, "p_plane_hd"));
      this.width(p, 260);
      p.setAngle(6);
      this.sc.tweens.add({ targets: p, x: this.cx, y: SY + SH * 0.7 - 6, angle: 0, duration: 2200, ease: "Sine.easeOut" });
      this.c.later(2200, () => {
        synth.play("ding");
        this.banner("LANDED · GOOD LANDING +200", "#4ade80", SY + 110, 18);
      });
    }
    this.c.later(3000, () => {
      const box = this.panel(this.cx, SY + 200, 380, 140, 0xf472b6);
      this.text(this.cx, SY + 148, "WHAT NEXT, CAPTAIN?", 16, "#fde047", box, 4);
      const opts = ["SEDUCE AIR STEWARDESS", "VISIT GENTLEMEN'S TABLE DANCING CLUB", "FILE FLIGHT REPORT"];
      const ts = opts.map((s, i) => this.text(this.cx - 170, SY + 180 + i * 26, `  ${s}`, 14, i === 2 ? "#6b7280" : "#ffffff", box, 3).setOrigin(0, 0.5));
      let k = 0;
      const mark = () => ts.forEach((t, i) => t.setText(`${i === k ? ">" : " "} ${opts[i]}`));
      mark();
      this.c.every(900, () => {
        k = (k + 1) % 2;
        mark();
        synth.play("select");
      });
    });
  }

  private sensor() {
    const { SX, SY } = this.r;
    const box = this.panel(SX + 190, SY + 160, 300, 120, 0xf472b6);
    this.text(SX + 190, SY + 116, "PENIS SENSOR: CONNECTED", 15, "#f472b6", box, 4);
    this.text(SX + 72, SY + 148, "VIBRATION", 12, "#ffffff", box, 3).setOrigin(0, 0.5);
    this.text(SX + 72, SY + 178, "MOISTURE", 12, "#ffffff", box, 3).setOrigin(0, 0.5);
    const vb = this.put(this.sc.add.rectangle(SX + 180, SY + 148, 10, 12, 0xf472b6).setOrigin(0, 0.5), box);
    const mb = this.put(this.sc.add.rectangle(SX + 180, SY + 178, 10, 12, 0x60a5fa).setOrigin(0, 0.5), box);
    const pct = this.text(SX + 190, SY + 204, "SYNCED WITH ON-SCREEN ACTIVITY", 11, "#9ca3af", box, 3);
    void pct;
    let t = 0;
    this.c.every(120, () => {
      t++;
      vb.width = 20 + Math.abs(Math.sin(t * 0.6)) * 100;
      mb.width = Math.min(120, 10 + t * 1.4);
    });
    // turbulence: the plane shakes, and so do the bars
    this.c.every(1700, () => {
      if (!this.plane?.active) return;
      this.sc.tweens.add({ targets: this.plane, x: this.plane.x + 6, duration: 50, yoyo: true, repeat: 5 });
      this.scoreText?.setText("TURBULENCE! SENSOR RESPONDING");
    });
  }
}

// ==================================================================== Battle of the Morons

/** Modes: "promo" (the title and the prize), "play" (a question round, then the prize). */
class GameshowFootage extends Footage {
  protected open(): number {
    this.fill("tvc_gameshow", 1.02);
    this.scan(false);
    this.tag("DEPARTMENT OF TELLY · BATTLE OF THE MORONS", "#7c3aed", "#ffffff");
    this.lights();
    if (this.mode === "promo") this.promo();
    else this.round();
    return 500;
  }

  protected onLine(i: number) {
    if (this.mode === "play" && i === 1) this.prize();
  }

  private lights() {
    const { SX, SY, SW } = this.r;
    for (let i = 0; i < 5; i++) {
      const b = this.put(this.sc.add.triangle(SX + 60 + i * (SW - 120) / 4, SY, 0, 0, -50, 340, 50, 340, [0xf472b6, 0x60a5fa, 0xfde047][i % 3], 0.12).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD));
      if (!calm()) this.sc.tweens.add({ targets: b, angle: { from: -18, to: 18 }, duration: 1400 + i * 200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private podiums() {
    const { SX, SY, SW } = this.r;
    this.text(SX + SW * 0.24, SY + 300, "TEAM DIM", 15, "#fca5a5", this.hud, 4);
    this.text(SX + SW * 0.76, SY + 300, "TEAM THICK", 15, "#93c5fd", this.hud, 4);
  }

  private promo() {
    const { SY } = this.r;
    const t1 = this.text(this.cx, SY + 120, "BATTLE OF", 26, "#ffffff", this.hud, 7).setScale(0.2);
    const t2 = this.text(this.cx, SY + 160, "THE MORONS", 44, "#fde047", this.hud, 9).setScale(0.2);
    this.sc.tweens.add({ targets: [t1, t2], scale: 1, duration: 420, ease: "Back.out" });
    synth.play("ding");
    this.c.later(1500, () => {
      this.banner("WEEKLY PRIZE: £50,000,000,000", "#4ade80", SY + 220, 22, true);
      synth.play("coin");
      const s = vfx(this.sc, "vfx_confetti", this.cx, SY + 120, { scale: 2.5 });
      if (s) this.put(s);
    });
    this.c.later(3600, () => this.text(this.cx, SY + 264, "THREE TELLIES IN EVERY ROOM · NO EXCUSES", 13, "#ffffff", this.hud, 4));
    this.podiums();
  }

  private round() {
    const { SX, SY, SW } = this.r;
    this.podiums();
    const q = this.panel(this.cx, SY + 120, 360, 64, 0xfde047);
    this.text(this.cx, SY + 120, "Q1: WHAT IS 2 + 2?", 22, "#ffffff", q, 5);
    const score = this.text(this.cx, SY + 220, "0 - 0", 26, "#fde047", this.hud, 6);
    const answer = (x: number, s: string, at: number) =>
      this.c.later(at, () => {
        synth.play("ding");
        const a = this.text(x, SY + 250, s, 20, "#ffffff", this.hud, 5);
        this.c.later(700, () => {
          synth.play("tap_fail");
          a.setColor("#ef4444");
          this.bang(x, SY + 210, "✗ WRONG", "#ef4444", 22);
        });
      });
    answer(SX + SW * 0.24, "\"FISH\"", 1200);
    answer(SX + SW * 0.76, "\"TUESDAY\"", 3000);
    this.c.later(4600, () => {
      q.destroy();
      const q2 = this.panel(this.cx, SY + 120, 380, 64, 0xfde047);
      this.text(this.cx, SY + 120, "Q2: WHAT COLOUR IS GREEN?", 20, "#ffffff", q2, 5);
      answer(SX + SW * 0.24, "\"LEFT\"", 900);
      this.c.later(2200, () => score.setText("0 - 0  (STILL)"));
    });
  }

  private prize() {
    const { SX, SY, SW } = this.r;
    this.clearHud();
    this.flash(0xffffff, 0.5);
    synth.play("cheer");
    const s = vfx(this.sc, "vfx_confetti", this.cx, SY + 100, { scale: 3 });
    if (s) this.put(s);
    // the big cheque
    const ch = this.put(this.sc.add.container(this.cx, SY + 190), this.hud);
    ch.add(this.sc.add.rectangle(0, 0, 400, 140, 0xfef9c3).setStrokeStyle(4, 0x166534));
    ch.add(this.sc.add.text(-186, -60, "BANK OF KRELFORD", { fontFamily: FONT, fontSize: "12px", color: "#166534", fontStyle: "bold" }));
    ch.add(this.sc.add.text(-186, -30, "PAY: THE WINNING MORONS", { fontFamily: FONT, fontSize: "15px", color: "#111827" }));
    ch.add(this.sc.add.text(0, 14, "£50,000,000,000", { ...ARCADE, fontSize: "34px", color: "#166534", strokeThickness: 0 }).setOrigin(0.5));
    ch.add(this.sc.add.text(186, 50, "THE DEPT. OF TELLY", { fontFamily: FONT, fontSize: "11px", color: "#6b7280", fontStyle: "italic" }).setOrigin(1, 0.5));
    ch.setScale(0.2).setAngle(-8);
    this.sc.tweens.add({ targets: ch, scale: 1, angle: -3, duration: 500, ease: "Back.out" });
    this.c.later(1800, () => this.text(this.cx, SY + 300, "MORE THAN THE GDP OF MANY SMALL COUNTRIES", 13, "#fde047", this.hud, 4));
    void SX;
    void SW;
  }
}

// ==================================================================== the Supreme Leader's music video

/** One mode: "krezzing" (The Krezzing Hour, on a video site, nine views). */
class MusicVideo extends Footage {
  protected open(): number {
    const { SX, SY, SW, SH } = this.r;
    const vh = 196;
    // the video: a purple room, lights going round, him dancing
    const g = this.put(this.sc.add.graphics());
    g.fillGradientStyle(0x2e1065, 0x2e1065, 0x831843, 0x831843, 1).fillRect(SX, SY, SW, vh + 40);
    for (let i = 0; i < 6; i++) {
      const b = this.put(this.sc.add.triangle(SX + 40 + i * 96, SY, 0, 0, -40, vh, 40, vh, [0xfde047, 0x22d3ee, 0xf472b6][i % 3], 0.16).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD));
      if (!calm()) this.sc.tweens.add({ targets: b, angle: { from: -25, to: 25 }, duration: 900 + i * 150, yoyo: true, repeat: -1 });
    }
    this.put(this.sc.add.ellipse(this.cx, SY + vh + 10, 300, 40, 0x000000, 0.35));
    if (this.has("spr_DRONGUS")) {
      const d = this.put(this.sc.add.sprite(this.cx, SY + vh + 20, "spr_DRONGUS", 0).setOrigin(0.5, 1));
      this.width(d, 190);
      d.play(this.anim("spr_DRONGUS", 8, true, [8, 9, 10, 11, 12, 13, 40, 41, 42, 41]));
      this.sc.tweens.add({ targets: d, x: d.x + 30, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    // the lyrics
    const lyr = ["♪ IT'S THE KREZZING HOUR ♪", "♪ KREZZ IT, KREZZ IT, KREZZ ♪", "♪ (NOBODY'S WATCHING) ♪", "♪ IT'S THE KREZZING HOUR ♪"];
    const ly = this.text(this.cx, SY + vh - 6, lyr[0], 18, "#ffffff", this.play, 5);
    let k = 0;
    this.c.every(1900, () => ly.setText(lyr[++k % lyr.length]));
    // the video site around it
    const ui = this.put(this.sc.add.container(0, 0), this.hud);
    ui.add(this.sc.add.rectangle(SX, SY + vh + 40, SW, SH - vh - 40, 0x0f0f0f).setOrigin(0));
    ui.add(this.sc.add.rectangle(SX, SY + vh + 36, SW, 4, 0x3f3f46).setOrigin(0));
    const prog = this.sc.add.rectangle(SX, SY + vh + 36, 40, 4, 0xef4444).setOrigin(0);
    ui.add(prog);
    this.sc.tweens.add({ targets: prog, width: SW * 0.5, duration: 14000 });
    ui.add(this.sc.add.text(SX + 14, SY + vh + 46, "The Krezzing Hour (Official Video)", { fontFamily: FONT, fontSize: "16px", color: "#ffffff", fontStyle: "bold" }));
    ui.add(this.sc.add.text(SX + 14, SY + vh + 68, "Supreme Leader · 9 views · 0 likes · Comments are turned off", { fontFamily: FONT, fontSize: "12px", color: "#a1a1aa" }));
    this.tag("KREZZTUBE", "#ef4444", "#ffffff");
    // and, after a while, the counter stays exactly where it is
    this.c.later(4200, () => this.popup(SX + SW - 160, SY + vh + 20, "VIEWS: 9", "#ffffff", 16));
    return 600;
  }
}

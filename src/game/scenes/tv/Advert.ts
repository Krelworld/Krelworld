import Phaser from "phaser";
import { beatDuration } from "../../systems/tv";
import { ShowDirector, type Perf } from "./ShowDirector";

/**
 * A glossy corporate TV advert (the Krelbank advert, content/television/extra/krelbank.ts). Shot the way a bank
 * shoots one, played straight: slow glides over bright stills (tv_kb_<set>), warm lens flares, the speaker
 * in a clean close-up against a soft background, inserts (the mug, a handshake, the pamphlet, the slide), and an
 * end card with the logo and the small print. No captions, no straps, nothing over the picture but the flares.
 *
 * The stills are 320x240 and fill the 560x420 screen at 1.75x, so a point (x, y) in a still is at
 * (SX + 1.75x, SY + 1.75y) before the camera moves.
 */

const K = 1.75;
const TEAL = 0x0f8f8a;
const TEAL_DARK = 0x0a5e5b;
const GOLD = 0xd9b45a;

type Scene = "tower" | "office" | "meeting" | "kitchen" | "board" | "branch" | "end";

function sceneOf(set: string): Scene {
  const s = set.toUpperCase();
  if (s.includes("TOWER")) return "tower";
  if (s.includes("MEETING")) return "meeting";
  if (s.includes("KITCHEN")) return "kitchen";
  if (s.includes("BOARDROOM")) return "board";
  if (s.includes("BRANCH")) return "branch";
  if (s.includes("END CARD")) return "end";
  return "office";
}

const STILL: Record<Scene, string> = {
  tower: "tv_kb_tower",
  office: "tv_kb_office",
  meeting: "tv_kb_meeting",
  kitchen: "tv_kb_kitchen",
  board: "tv_kb_board",
  branch: "tv_kb_branch",
  end: "tv_kb_office",
};

/** the boardroom's projection screen, in still pixels */
const SCREEN = { x: 196, y: 56, w: 60, h: 40 };

export class AdvertDirector extends ShowDirector {
  private scene: Scene = "office";
  private visits: Partial<Record<Scene, number>> = {};
  private line = 0;
  private glide = { s: 1, fx: 0, fy: 0 };
  private slide = 0;

  // ------------------------------------------------------------------ camera

  /** Still-pixel point -> screen point (camera at rest). */
  private at(x: number, y: number) {
    return { x: this.r.SX + x * K, y: this.r.SY + y * K };
  }

  /** Put the camera at scale s, centred on a screen point (kept inside the picture). */
  private apply() {
    const { SX, SY, SW, SH } = this.r;
    const { s, fx, fy } = this.glide;
    const x = Phaser.Math.Clamp(this.cx - fx * s, (SX + SW) * (1 - s), SX * (1 - s));
    const y = Phaser.Math.Clamp(this.cy - fy * s, (SY + SH) * (1 - s), SY * (1 - s));
    this.cam.setScale(s).setPosition(x, y);
  }

  /** A slow, smooth camera move: from one framing to another (points in still pixels). */
  private move(from: [number, number, number], to: [number, number, number], ms: number, ease = "Sine.easeInOut") {
    this.sc.tweens.killTweensOf(this.glide);
    const a = this.at(from[1], from[2]);
    const b = this.at(to[1], to[2]);
    this.glide = { s: from[0], fx: a.x, fy: a.y };
    this.apply();
    this.sc.tweens.add({ targets: this.glide, s: to[0], fx: b.x, fy: b.y, duration: ms, ease, onUpdate: () => this.apply() });
  }

  protected clear() {
    this.sc.tweens.killTweensOf(this.glide);
    super.clear();
  }

  /** A full-frame still at rest (the camera does the moving). */
  private still(key: string) {
    this.clear();
    return this.backdrop(this.tex(key));
  }

  // ------------------------------------------------------------------ the gloss

  /** A warm lens flare: a soft bloom, a streak and a few ghosts strung through the centre, drifting gently. */
  private flare(x: number, y: number, o: { ms?: number; drift?: number; strength?: number } = {}) {
    const a = o.strength ?? 1;
    const c = this.over(this.sc.add.container(0, 0));
    c.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const g = this.sc.add.graphics();
    const bloom = (r: number, col: number, al: number) => {
      for (let i = 6; i >= 1; i--) g.fillStyle(col, (al * 0.22) / i).fillCircle(0, 0, (r * i) / 3);
    };
    bloom(70, 0xffe2a8, 1);
    g.fillStyle(0xfffbe8, 0.55).fillCircle(0, 0, 10);
    g.fillStyle(0xfff3d0, 0.18).fillRect(-220, -1.5, 440, 3);
    g.fillStyle(0xfff3d0, 0.08).fillRect(-320, -4, 640, 8);
    const core = this.sc.add.container(x, y, [g]);
    c.add(core);
    // the ghosts: along the line from the flare through the middle of the frame
    const gx = this.cx - x;
    const gy = this.cy - y;
    const ghosts: [number, number, number, number][] = [
      [0.55, 16, 0x9fe8d8, 0.16],
      [0.9, 9, 0xffd28a, 0.2],
      [1.25, 26, 0x8fc8ff, 0.1],
      [1.6, 12, 0xffb87a, 0.14],
    ];
    for (const [t, r, col, al] of ghosts) {
      const h = this.sc.add.graphics();
      h.fillStyle(col, al).fillCircle(0, 0, r);
      h.lineStyle(1, col, al * 1.6).strokeCircle(0, 0, r);
      c.add(this.sc.add.container(x + gx * t, y + gy * t, [h]));
    }
    this.sc.tweens.add({ targets: c, alpha: a, duration: 700, ease: "Sine.easeOut" });
    const d = o.drift ?? 40;
    this.sc.tweens.add({ targets: c, x: d, y: d * 0.25, duration: o.ms ?? 6000, ease: "Sine.easeInOut" });
    this.sc.tweens.add({ targets: core, scale: { from: 0.94, to: 1.06 }, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    return c;
  }

  /** A soft light sweep across the frame (the glint off glass). */
  private glint(ms = 1600) {
    const { SX, SY, SH } = this.r;
    const g = this.sc.add.graphics();
    for (let i = 0; i < 5; i++) g.fillStyle(0xffffff, 0.05 * (5 - i)).fillRect(-14 - i * 10, -SH, 28 + i * 20, SH * 3);
    const s = this.over(this.sc.add.container(SX - 120, SY + SH / 2, [g]).setAngle(18).setBlendMode(Phaser.BlendModes.ADD));
    this.sc.tweens.add({ targets: s, x: SX + this.r.SW + 160, duration: ms, ease: "Sine.easeInOut", onComplete: () => s.destroy() });
  }

  /** The Krelbank mark: a teal roundel with a K in it, and the wordmark. */
  private logo(x: number, y: number, size: number, dark = false) {
    const c = this.sc.add.container(x, y);
    const r = size * 0.5;
    const g = this.sc.add.graphics();
    g.fillStyle(TEAL_DARK, 1).fillCircle(-size * 1.95, 2, r + 3);
    g.fillStyle(TEAL, 1).fillCircle(-size * 1.95, 0, r);
    g.lineStyle(2, GOLD, 1).strokeCircle(-size * 1.95, 0, r - 4);
    c.add(g);
    c.add(this.text(-size * 1.95, 1, "K", size * 0.62, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5));
    c.add(this.text(-size * 1.3, 0, "KRELBANK", size * 0.58, dark ? "#0a3d3b" : "#ffffff", { fontStyle: "bold" }).setOrigin(0, 0.5));
    c.add(this.sc.add.rectangle(-size * 1.3, size * 0.42, size * 3.35, 2, GOLD).setOrigin(0, 0.5));
    return c;
  }

  // ------------------------------------------------------------------ people

  /** Someone in a clean close-up against the room, soft behind them; the camera eases in on them. */
  private closeUp(name: string, scene: Scene, side = 0): Perf | null {
    const p = this.single(name, { bg: this.tex(STILL[scene]), side, zoom: 1.5, blur: 2.5, recut: true, scale: 3.2 });
    if (!p) return null;
    this.push(1.05, 7000, p.spr.x, p.spr.y - 250);
    if (name === "ADVISER") this.glances(p);
    return p;
  }

  /** A polite nod as they start. */
  private nod(p: Perf) {
    this.sc.tweens.add({ targets: p.spr, y: p.y + 5, duration: 220, yoyo: true, repeat: 1, ease: "Sine.easeInOut", delay: 120 });
  }

  /** The adviser glances about: his eyes flick the other way and back, his head turning a touch. */
  private glances(p: Perf) {
    const eyes = this.tex("tv_kb_adviser_eyes");
    if (!eyes) return;
    const e = this.add(this.sc.add.image(p.spr.x, p.spr.y, eyes).setOrigin(0.5, 1).setScale(p.scale).setVisible(false));
    let away = false;
    this.every(60, () => {
      if (!p.spr.active || this.perf !== p) return;
      e.setPosition(p.spr.x, p.spr.y).setScale(p.spr.scaleX, p.spr.scaleY).setAngle(p.spr.angle);
      e.setVisible(away && Number(p.spr.frame.name) !== 3);
    });
    const flick = () => {
      if (!p.spr.active || this.perf !== p) return;
      away = !away;
      this.sc.tweens.add({ targets: p.spr, angle: away ? -1.5 : 0, x: p.spr.x + (away ? -4 : 4), duration: 160, ease: "Sine.easeOut" });
      this.later(away ? 500 + Math.random() * 500 : 900 + Math.random() * 1300, flick);
    };
    this.later(500 + Math.random() * 600, flick);
  }

  // ------------------------------------------------------------------ inserts

  /** The boardroom slide, drawn onto the projection screen in the picture. */
  private drawSlide(n: number) {
    // drawn at 4x and scaled down, so the words stay sharp when the camera moves in on the screen
    const U = 4;
    const { x, y } = this.at(SCREEN.x, SCREEN.y);
    const w = SCREEN.w * K * U;
    const h = SCREEN.h * K * U;
    const c = this.add(this.sc.add.container(x, y).setScale(1 / U));
    c.add(this.sc.add.rectangle(0, 0, w, h, 0xffffff).setOrigin(0));
    c.add(this.sc.add.rectangle(0, 0, w, 56, TEAL).setOrigin(0));
    c.add(this.text(16, 28, n === 0 ? "PORTFOLIO DIVERSIFICATION" : "Q2 BALANCE SHEET", n === 0 ? 22 : 28, "#ffffff", { fontStyle: "bold" }).setOrigin(0, 0.5));
    c.add(this.text(w - 12, 28, "KRELBANK", 16, "#d9f2ef", { fontStyle: "bold" }).setOrigin(1, 0.5));
    const g = this.sc.add.graphics();
    c.add(g);
    if (n === 0) {
      // a pie chart and its key
      const cols = [TEAL, GOLD, 0x5aa9e6, 0x9aa5b1, 0x2c3e50];
      const parts = [0.34, 0.24, 0.18, 0.14, 0.1];
      let a0 = -Math.PI / 2;
      parts.forEach((p, i) => {
        g.fillStyle(cols[i], 1).slice(120, 170, 88, a0, a0 + p * Math.PI * 2, false).fillPath();
        a0 += p * Math.PI * 2;
        g.fillStyle(cols[i], 1).fillRect(250, 84 + i * 36, 22, 20);
        g.fillStyle(0x9aa5b1, 1).fillRect(284, 90 + i * 36, 90 + ((i * 29) % 40), 9);
      });
    } else {
      // the balance sheet: rows and a little bar chart
      const rows = ["Assets", "Liabilities", "Stock position", "Equity"];
      rows.forEach((r, i) => {
        c.add(this.text(16, 74 + i * 44, r, 22, "#1f2d3a").setOrigin(0, 0));
        c.add(this.text(272, 74 + i * 44, ["£4.2bn", "£3.9bn", "£0.6bn", "£0.3bn"][i], 22, "#1f2d3a", { fontStyle: "bold" }).setOrigin(1, 0));
        g.fillStyle(0xd7e3ea, 1).fillRect(12, 108 + i * 44, 264, 3);
      });
      const bars = [40, 56, 48, 72, 96];
      bars.forEach((b, i) => g.fillStyle(i === bars.length - 1 ? TEAL : 0x9fc9c6, 1).fillRect(300 + i * 24, 250 - b, 16, b));
      g.fillStyle(0x9aa5b1, 1).fillRect(292, 250, 128, 3);
    }
    return c;
  }

  /** The pamphlet on the desk, close: the cover, and the small print at the bottom. */
  private pamphlet() {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const desk = this.sc.add.graphics();
    desk.fillGradientStyle(0xf4f7f8, 0xf4f7f8, 0xdfe6ea, 0xdfe6ea, 1).fillRect(SX, SY, SW, SH);
    this.add(desk);
    const c = this.add(this.sc.add.container(this.cx + 10, this.cy - 6).setAngle(-4));
    const W = 300;
    const H = 360;
    c.add(this.sc.add.rectangle(6, 8, W, H, 0x000000, 0.12));
    c.add(this.sc.add.rectangle(0, 0, W, H, 0xffffff).setStrokeStyle(1, 0xd5dde2));
    c.add(this.sc.add.rectangle(0, -H / 2 + 26, W, 52, TEAL));
    c.add(this.logo(-W / 2 + 108, -H / 2 + 26, 26));
    const photo = this.tex("tv_kb_famphoto");
    if (photo) c.add(this.sc.add.image(0, -H / 2 + 112, photo).setDisplaySize(W - 24, 112));
    c.add(this.text(0, 14, "Your Home Loan,\nExplained", 22, "#0a3d3b", { fontStyle: "bold", align: "center" }).setOrigin(0.5));
    c.add(this.text(0, 68, "A guide for our valued customers", 12, "#4b6470").setOrigin(0.5));
    c.add(this.sc.add.rectangle(0, H / 2 - 66, W - 40, 1, 0xd5dde2));
    c.add(this.text(0, H / 2 - 40, "© Kreddle Exchange. All rights reserved.\nNo part of this publication may be reproduced\nwithout the prior written permission of the publisher.", 8, "#5b6b75", { align: "center" }).setOrigin(0.5));
    c.add(this.sc.add.rectangle(0, H / 2 - 8, W, 16, TEAL));
    // a pen beside it
    const pen = this.add(this.sc.add.container(SX + SW - 70, SY + SH - 120).setAngle(-58));
    pen.add(this.sc.add.rectangle(0, 0, 150, 9, 0x1f2d3a));
    pen.add(this.sc.add.rectangle(64, 0, 22, 9, GOLD));
    // ease down to the small print
    this.glide = { s: 1.02, fx: this.cx, fy: this.cy - 40 };
    this.apply();
    this.sc.tweens.add({ targets: this.glide, s: 1.75, fx: this.cx + 6, fy: this.cy + 140, duration: 2600, ease: "Sine.easeInOut", onUpdate: () => this.apply() });
  }

  /** The end card: the logo on a soft gradient, the sign-off, the small print. */
  private endCard() {
    this.clear();
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    const bg = this.sc.add.graphics();
    bg.fillGradientStyle(0xffffff, 0xffffff, 0xd9efec, 0xd9efec, 1).fillRect(SX, SY, SW, SH);
    this.add(bg);
    const lg = this.add(this.logo(this.cx + 30, this.cy - 40, 52, true).setAlpha(0).setScale(0.96));
    this.sc.tweens.add({ targets: lg, alpha: 1, scale: 1, duration: 900, ease: "Sine.easeOut" });
    const tag = this.add(this.text(this.cx, this.cy + 30, "We are Krelbank.", 18, "#0a5e5b").setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: tag, alpha: 1, duration: 800, delay: 700 });
    const small = this.add(
      this.text(
        this.cx,
        SY + SH - 92,
        "Krelbank plc. Registered in Krelworld. Lending is subject to status. Your home may be repossessed if you do not keep up\nrepayments on your mortgage. The value of investments can go down as well as up. Past performance is not a guide to\nfuture performance. Calls may be recorded for training and monitoring purposes. Terms and conditions apply.",
        7,
        "#5b6b75",
        { align: "center" },
      )
        .setOrigin(0.5)
        .setAlpha(0),
    );
    this.sc.tweens.add({ targets: small, alpha: 1, duration: 600, delay: 900 });
    this.flare(SX + 150, SY + 120, { ms: 7000, drift: 60, strength: 0.7 });
    this.later(500, () => this.glint(1800));
    void SW;
  }

  // ------------------------------------------------------------------ beats

  protected onTitle(): number {
    return 0;
  }

  protected onDirection(): number {
    return 0;
  }

  protected onShot(set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    this.scene = sceneOf(set);
    this.visits[this.scene] = (this.visits[this.scene] ?? 0) + 1;
    this.line = 0;
    this.clearGfx();
    switch (this.scene) {
      case "tower":
        // the establishing shot: a slow tilt up the tower into the sun
        this.still(STILL.tower);
        this.move([1.3, 160, 200], [1.04, 160, 110], 4200);
        this.flare(this.at(118, 58).x, this.at(118, 58).y, { ms: 4200, drift: 30 });
        this.later(1200, () => this.glint(1800));
        return 3800;
      case "office":
        this.still(STILL.office);
        // the brand on the teal wall
        this.add(this.logo(this.at(252, 66).x + 14, this.at(252, 66).y, 13).setScale(0.8));
        this.move([1.0, 160, 120], [1.12, 120, 110], 3200);
        this.flare(this.at(18, 84).x, this.at(18, 84).y, { ms: 5000 });
        return 1600;
      case "meeting":
        if (this.visits.meeting! > 1) return 0;
        this.still(STILL.meeting);
        this.move([1.0, 160, 130], [1.18, 150, 140], 3000);
        this.flare(this.at(300, 30).x, this.at(300, 30).y, { ms: 4000, drift: -30, strength: 0.6 });
        return 1700;
      case "kitchen":
        this.still(STILL.kitchen);
        this.move([1.0, 170, 120], [1.45, 95, 190], 2200);
        this.flare(this.at(290, 40).x, this.at(290, 40).y, { ms: 3000, drift: -20, strength: 0.6 });
        return 1700;
      case "board":
        this.still(STILL.board);
        this.drawSlide(0);
        this.slide = 0;
        this.move([1.0, 160, 140], [1.12, 210, 100], 5000);
        this.flare(this.at(60, 70).x, this.at(60, 70).y, { ms: 5000, strength: 0.5 });
        return 1600;
      case "branch":
        this.still(STILL.branch);
        this.move([1.0, 160, 120], [1.2, 220, 130], 3200);
        this.flare(this.at(30, 40).x, this.at(30, 40).y, { ms: 4000, strength: 0.6 });
        return 1700;
      case "end":
        this.endCard();
        return 600;
    }
  }

  protected onSpeak(name: string, text: string, emotion: string): number {
    const n = this.line++;
    const est = beatDuration({ type: "speaker", character: name, text }) * 820;
    const tail = (frac: number) => {
      const w = text.split(/\s+/);
      return w.slice(Math.floor(w.length * frac)).join(" ");
    };
    /** cut from an insert to the speaker part way through the line */
    const thenSpeaker = (ms: number, frac: number, side = 0) =>
      this.later(ms, () => {
        const p = this.closeUp(name, this.scene, side);
        if (p) this.talk(p, name, tail(frac), emotion);
      });
    switch (this.scene) {
      case "end":
        // the sign-off, over the card
        return 5600;
      case "meeting":
        if (this.visits.meeting! > 1 && n === 0) {
          // the promotion: a handshake across the table, then him
          this.still("tv_kb_handshake");
          const img = this.cam.list[0] as Phaser.GameObjects.Image;
          this.move([1.04, 160, 120], [1.12, 160, 118], 3000);
          this.sc.tweens.add({ targets: img, y: img.y + 5, duration: 260, yoyo: true, repeat: 2, ease: "Sine.easeInOut", delay: 300 });
          thenSpeaker(Math.min(2400, est * 0.3), 0.3);
          return 0;
        }
        if (n === 1) {
          // the meeting itself, over his words
          this.still(STILL.meeting);
          this.move([1.15, 120, 140], [1.3, 150, 140], 5000);
          return 0;
        }
        break;
      case "kitchen":
        // the mug, close, then him
        this.still("tv_kb_mug");
        this.move([1.0, 160, 120], [1.25, 150, 150], 2600);
        this.later(400, () => this.glint(1400));
        thenSpeaker(Math.min(1900, est * 0.5), 0.5);
        return 0;
      case "board":
        if (n === 0) return 0; // over the room and the slide
        // the balance sheet on the screen, then him
        this.still(STILL.board);
        this.drawSlide(1);
        this.move([2.2, SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2], [2.45, SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2 + 2], 3000);
        thenSpeaker(Math.min(2800, est * 0.3), 0.3);
        return 0;
      case "branch":
        if (name === "MR JONES") {
          this.pamphlet();
          thenSpeaker(Math.min(2600, est * 0.55), 0.55);
          return 0;
        }
        break;
      default:
        break;
    }
    const p = this.closeUp(name, this.scene);
    if (!p) return 0;
    if (name === "CEO") {
      this.nod(p);
      if (this.scene === "office") this.flare(this.r.SX + 70, this.r.SY + 90, { ms: 5000, strength: 0.7 });
    }
    this.talk(p, name, text, emotion);
    return 0;
  }

  protected onMusic(_id: string, mode: string): number {
    if (mode !== "fade") return 0;
    // fade the picture to white with the music
    const { SX, SY, SW, SH } = this.r;
    const w = this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff).setOrigin(0).setAlpha(0));
    this.sc.tweens.add({ targets: w, alpha: 1, duration: 1000 });
    return 1200;
  }
}

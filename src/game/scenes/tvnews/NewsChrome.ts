import Phaser from "phaser";
import { FONT } from "../../ui/theme";
import { synth } from "../../audio/Synth";
import { G } from "../../G";

/**
 * The broadcast graphics laid over a news picture: the channel ident, the channel bug and clock, LIVE tag, the
 * BREAKING NEWS banner, a headline strap and scrolling ticker, name straps per speaker, and the over-the-shoulder box.
 * Everything is drawn in code (it's the gallery's graphics, not the camera's), inside the rectangle it's given.
 */

export interface Rect {
  SX: number;
  SY: number;
  SW: number;
  SH: number;
}

export interface Brand {
  /** "KRUNCHE NEWS" */
  name: string;
  /** the short word on the ticker's tab */
  short: string;
  main: number;
  accent: number;
  /** clock the broadcast starts at, "18:02" */
  clock: string;
}

export const BRANDS: Record<string, Brand> = {
  gbk: { name: "KRUNCHE NEWS", short: "KRUNCHE", main: 0xc8102e, accent: 0x0b2a5c, clock: "18:00" },
  kreltv: { name: "KRELTV NEWS", short: "KRELTV", main: 0xb91c1c, accent: 0x111111, clock: "21:00" },
  gbksport: { name: "KRUNCHE NEWS SPORT", short: "SPORT", main: 0x15803d, accent: 0x0b2a5c, clock: "22:30" },
};

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
export const calm = () => !!G.meta.settings.calmFlash;

export class NewsChrome {
  readonly ui: Phaser.GameObjects.Container;
  private timers: Phaser.Time.TimerEvent[] = [];
  private bugBox?: Phaser.GameObjects.Container;
  private liveBox?: Phaser.GameObjects.Container;
  private tickerBox?: Phaser.GameObjects.Container;
  private strapBox?: Phaser.GameObjects.Container;
  private headlineBox?: Phaser.GameObjects.Container;
  private otsBox?: Phaser.GameObjects.Container;
  private headlineText = "";
  private minutes = 0;
  private clockText?: Phaser.GameObjects.Text;
  /** bottom of the picture that's free (above the headline strap and ticker) */
  readonly safeBottom: number;

  constructor(
    private sc: Phaser.Scene,
    private r: Rect,
    private brand: Brand,
    depth: number,
  ) {
    this.ui = sc.add.container(0, 0).setDepth(depth);
    const [h, m] = brand.clock.split(":").map(Number);
    this.minutes = h * 60 + m;
    this.safeBottom = r.SY + r.SH - 54;
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T, into: Phaser.GameObjects.Container = this.ui): T {
    into.add(o);
    return o;
  }

  private later(ms: number, fn: () => void) {
    const t = this.sc.time.delayedCall(ms, fn);
    this.timers.push(t);
    return t;
  }

  destroy() {
    for (const t of this.timers) t.remove();
    this.timers = [];
    this.sc.tweens.killTweensOf(this.ui.list);
    this.ui.destroy();
  }

  /** A wireframe globe, turning (redrawn every frame). Returns the graphics object. */
  globe(x: number, y: number, R: number, color: number, into: Phaser.GameObjects.Container = this.ui, alpha = 1) {
    // drawn about its own origin, so it scales and moves as one thing
    const g = this.add(this.sc.add.graphics({ x, y }), into);
    x = 0;
    y = 0;
    let ph = 0;
    const draw = () => {
      if (!g.active) return;
      ph += 0.045;
      g.clear();
      g.fillStyle(color, 0.18 * alpha).fillCircle(x, y, R);
      g.lineStyle(Math.max(1, R / 22), color, alpha);
      g.strokeCircle(x, y, R);
      for (const lat of [-0.6, -0.3, 0, 0.3, 0.6]) {
        const yy = y + lat * R;
        const w = Math.sqrt(1 - lat * lat) * R;
        g.strokeEllipse(x, yy, w * 2, R * 0.18 * (1 - Math.abs(lat)));
      }
      for (let k = 0; k < 6; k++) {
        const w = Math.abs(Math.cos(ph + (k * Math.PI) / 6)) * R;
        g.strokeEllipse(x, y, w * 2, R * 2);
      }
    };
    const ev = this.sc.time.addEvent({ delay: 33, loop: true, callback: draw });
    this.timers.push(ev);
    draw();
    return g;
  }

  /** The opening (or closing) titles: a spinning globe, the logo swooshing in, a light sweep. Returns its length. */
  ident(closing = false): number {
    const { SX, SY, SW, SH } = this.r;
    const c = this.add(this.sc.add.container(0, 0));
    const b = this.brand;
    const bg = this.add(this.sc.add.graphics(), c);
    bg.fillGradientStyle(b.accent, b.accent, 0x000000, 0x000000, 1).fillRect(SX, SY, SW, SH);
    // light rays behind the globe
    for (let i = 0; i < 10; i++) {
      const ray = this.add(this.sc.add.triangle(SX + SW / 2, SY + SH / 2, 0, 0, -26, -SH, 26, -SH, 0xffffff, 0.05).setOrigin(0, 0), c);
      ray.setAngle(i * 36).setBlendMode(Phaser.BlendModes.ADD);
      this.sc.tweens.add({ targets: ray, angle: ray.angle + 60, duration: 4000 });
    }
    const gl = this.globe(SX + SW / 2, SY + SH / 2 - 30, 96, 0xdbeafe, c, 0.9);
    gl.setScale(closing ? 1 : 0.2).setAlpha(0);
    this.sc.tweens.add({ targets: gl, alpha: 1, duration: 300 });
    // a red ribbon swoosh across
    const rib = this.add(this.sc.add.rectangle(SX - SW, SY + SH / 2 + 46, SW * 1.4, 30, b.main).setAngle(-6), c);
    this.sc.tweens.add({ targets: rib, x: SX + SW / 2, duration: 520, delay: 250, ease: "Cubic.out" });
    const logo = this.add(
      this.sc.add.text(SX + SW + 300, SY + SH / 2 + 44, b.name, { fontFamily: FONT, fontSize: "40px", color: "#ffffff", fontStyle: "bold", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5),
      c,
    );
    this.sc.tweens.add({ targets: logo, x: SX + SW / 2, duration: 600, delay: 380, ease: "Back.out" });
    // the light sweep across the logo
    const sweep = this.add(this.sc.add.rectangle(SX - 60, SY + SH / 2 + 44, 40, 120, 0xffffff, 0.55).setAngle(20).setBlendMode(Phaser.BlendModes.ADD), c);
    this.sc.tweens.add({ targets: sweep, x: SX + SW + 60, duration: 650, delay: 1050, ease: "Sine.inOut" });
    const sub = this.add(
      this.sc.add.text(SX + SW / 2, SY + SH / 2 + 92, closing ? "KEEP WATCHING" : "LIVE · KRELWORLD · ALWAYS", { fontFamily: FONT, fontSize: "14px", color: "#fde68a", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0),
      c,
    );
    this.sc.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 1100 });
    this.sc.tweens.add({ targets: gl, scale: closing ? 0.15 : 1, duration: closing ? 1800 : 900, ease: closing ? "Quad.in" : "Back.out" });
    synth.play("transform_sparkle");
    const len = closing ? 2100 : 3300;
    this.later(len - 350, () => this.sc.tweens.add({ targets: c, alpha: 0, duration: 340, onComplete: () => c.destroy() }));
    return len;
  }

  /** The channel bug, top right, and the clock under it. */
  bug() {
    if (this.bugBox) return;
    const { SX, SY, SW } = this.r;
    const c = (this.bugBox = this.add(this.sc.add.container(0, 0)));
    const w = 120;
    const x = SX + SW - w - 10;
    this.add(this.sc.add.rectangle(x, SY + 10, w, 24, this.brand.main, 0.92).setOrigin(0), c);
    this.add(this.sc.add.text(x + w - 6, SY + 14, this.brand.name, { fontFamily: FONT, fontSize: "12px", color: "#ffffff", fontStyle: "bold" }).setOrigin(1, 0), c);
    this.globe(x + 12, SY + 22, 8, 0xffffff, c);
    this.add(this.sc.add.rectangle(x + w - 46, SY + 34, 46, 17, 0x000000, 0.75).setOrigin(0), c);
    this.clockText = this.add(this.sc.add.text(x + w - 23, SY + 42, this.clock(), { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5), c);
    const ev = this.sc.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => {
        this.minutes++;
        this.clockText?.setText(this.clock());
      },
    });
    this.timers.push(ev);
    c.setAlpha(0);
    this.sc.tweens.add({ targets: c, alpha: 1, duration: 400 });
  }

  private clock() {
    const h = Math.floor(this.minutes / 60) % 24;
    const m = this.minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /** "● LIVE" (and where), top left. Pass "" to take it off. */
  live(where: string) {
    this.liveBox?.destroy();
    this.liveBox = undefined;
    if (where === "") return;
    const { SX, SY } = this.r;
    const c = (this.liveBox = this.add(this.sc.add.container(SX + 10, SY + 10)));
    const t = this.add(this.sc.add.text(26, 4, "LIVE", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold" }), c);
    const w = 34 + t.width;
    c.addAt(this.sc.add.rectangle(0, 0, w, 24, 0xdc2626).setOrigin(0), 0);
    const dot = this.add(this.sc.add.circle(14, 12, 5, 0xffffff), c);
    this.sc.tweens.add({ targets: dot, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    if (where) {
      const wt = this.add(this.sc.add.text(w + 8, 4, where.toUpperCase(), { fontFamily: FONT, fontSize: "12px", color: "#ffffff", fontStyle: "bold" }), c);
      c.addAt(this.sc.add.rectangle(w, 0, wt.width + 16, 24, 0x000000, 0.7).setOrigin(0), 0);
    }
    c.setX(SX - 260);
    this.sc.tweens.add({ targets: c, x: SX + 10, duration: 380, ease: "Cubic.out" });
  }

  /** The ticker along the bottom: a tab with the channel's short name, and headlines scrolling past. */
  ticker(lines: string[]) {
    if (this.tickerBox) return;
    const { SX, SY, SW, SH } = this.r;
    const c = (this.tickerBox = this.add(this.sc.add.container(0, 0)));
    const y = SY + SH - 22;
    this.add(this.sc.add.rectangle(SX, y, SW, 22, 0xf8fafc).setOrigin(0), c);
    const text = this.add(this.sc.add.text(SX + 70, y + 4, [...lines, ...lines].map((l) => l.toUpperCase()).join("   ●   ") + "   ●   ", { fontFamily: FONT, fontSize: "13px", color: "#111827", fontStyle: "bold" }), c);
    const tab = this.add(this.sc.add.rectangle(SX, y, 70, 22, this.brand.main).setOrigin(0), c);
    this.add(this.sc.add.text(SX + 35, y + 11, this.brand.short, { fontFamily: FONT, fontSize: "12px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5), c);
    void tab;
    const speed = 0.075; // px per ms
    const run = (first = false) => {
      if (!first) text.setX(SX + SW);
      const end = SX - text.width;
      this.sc.tweens.add({ targets: text, x: end, duration: (text.x - end) / speed, onComplete: () => run() });
    };
    run(true);
    // mask the scrolling text so it doesn't run under the tab
    c.setY(24);
    this.sc.tweens.add({ targets: c, y: 0, duration: 350, ease: "Cubic.out" });
  }

  /** The headline strap above the ticker (stays until changed). */
  headline(text: string, color = this.brand.accent) {
    this.headlineText = text;
    this.headlineBox?.destroy();
    const { SX, SY, SH } = this.r;
    const c = (this.headlineBox = this.add(this.sc.add.container(0, 0)));
    const y = SY + SH - 50;
    const t = this.add(this.sc.add.text(SX + 18, y + 5, text.toUpperCase(), { fontFamily: FONT, fontSize: "15px", color: "#ffffff", fontStyle: "bold" }), c);
    c.addAt(this.sc.add.rectangle(SX + 10, y, t.width + 18, 26, color, 0.95).setOrigin(0), 0);
    c.addAt(this.sc.add.rectangle(SX + 10, y, 5, 26, this.brand.main).setOrigin(0), 1);
    c.setAlpha(0);
    this.sc.tweens.add({ targets: c, alpha: 1, duration: 250 });
    if (this.strapBox) c.setVisible(false);
  }

  /** BREAKING NEWS: a red banner wipes in big, holds, then settles down into the headline strap. Returns its length. */
  breaking(text: string): number {
    const { SX, SY, SW, SH } = this.r;
    const c = this.add(this.sc.add.container(0, 0));
    const y = SY + SH / 2 - 40;
    const band = this.add(this.sc.add.rectangle(SX, y, SW, 80, 0xb91c1c).setOrigin(0).setScale(0, 1), c);
    const bt = this.add(this.sc.add.text(SX + SW / 2, y + 22, "BREAKING NEWS", { fontFamily: FONT, fontSize: "34px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0), c);
    const ht = this.add(this.sc.add.text(SX + SW / 2, y + 60, text.toUpperCase(), { fontFamily: FONT, fontSize: "14px", color: "#fde68a", fontStyle: "bold", align: "center", wordWrap: { width: SW - 30 } }).setOrigin(0.5).setAlpha(0), c);
    const sweep = this.add(this.sc.add.rectangle(SX - 60, y + 40, 50, 120, 0xffffff, 0.5).setAngle(18).setBlendMode(Phaser.BlendModes.ADD), c);
    this.sc.tweens.add({ targets: band, scaleX: 1, duration: 300, ease: "Cubic.out" });
    this.sc.tweens.add({ targets: [bt, ht], alpha: 1, duration: 200, delay: 220 });
    this.sc.tweens.add({ targets: bt, scale: { from: 1.25, to: 1 }, duration: 380, delay: 220, ease: "Back.out" });
    this.sc.tweens.add({ targets: sweep, x: SX + SW + 60, duration: 600, delay: 450 });
    // the banner flashes twice (gently, with reduced flashing on)
    if (!calm()) {
      const hi = this.add(this.sc.add.rectangle(SX, y, SW, 80, 0xffffff, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), c);
      this.sc.tweens.add({ targets: hi, fillAlpha: 0.22, duration: 150, yoyo: true, repeat: 2, delay: 600 });
    }
    synth.play("alarm");
    synth.play("news_breaking", 1, 1);
    this.later(2300, () =>
      this.sc.tweens.add({
        targets: c,
        alpha: 0,
        y: 60,
        duration: 350,
        onComplete: () => {
          c.destroy();
        },
      }),
    );
    this.later(2400, () => this.headline(`BREAKING: ${text.replace(/^BREAKING:\s*/i, "")}`, 0xb91c1c));
    return 2700;
  }

  /** A name strap for whoever's speaking: slides in, holds, slides out (the headline comes back after). */
  strap(name: string, role: string, ms = 3600) {
    this.strapBox?.destroy();
    const { SX, SY, SH } = this.r;
    const c = (this.strapBox = this.add(this.sc.add.container(0, 0)));
    const y = SY + SH - 76;
    const nt = this.add(this.sc.add.text(SX + 24, y + 4, name.toUpperCase(), { fontFamily: FONT, fontSize: "17px", color: "#111827", fontStyle: "bold" }), c);
    const rt = this.add(this.sc.add.text(SX + 24, y + 30, role, { fontFamily: FONT, fontSize: "13px", color: "#ffffff" }), c);
    const w = Math.max(nt.width, rt.width) + 26;
    c.addAt(this.sc.add.rectangle(SX + 10, y, w, 28, 0xffffff).setOrigin(0), 0);
    c.addAt(this.sc.add.rectangle(SX + 10, y + 26, w, 24, this.brand.accent).setOrigin(0), 1);
    c.addAt(this.sc.add.rectangle(SX + 10, y, 6, 50, this.brand.main).setOrigin(0), 2);
    this.headlineBox?.setVisible(false);
    c.setX(-w - 40);
    this.sc.tweens.add({ targets: c, x: 0, duration: 360, ease: "Cubic.out" });
    this.later(ms, () => {
      if (this.strapBox !== c) return;
      this.sc.tweens.add({
        targets: c,
        x: -w - 40,
        duration: 300,
        ease: "Cubic.in",
        onComplete: () => {
          c.destroy();
          if (this.strapBox === c) {
            this.strapBox = undefined;
            this.headlineBox?.setVisible(true);
          }
        },
      });
    });
  }

  /** Take the name strap off now (a new scene: it belonged to someone else). */
  clearStrap() {
    this.strapBox?.destroy();
    this.strapBox = undefined;
    this.headlineBox?.setVisible(true);
  }

  /** The over-the-shoulder box: a picture (texture + frame) and a caption, beside the presenter. Pass null to remove. */
  ots(pic: { key: string; frame?: number; crop?: [number, number, number, number] } | null, caption = "", side: "left" | "right" = "left", into?: Phaser.GameObjects.Container) {
    const old = this.otsBox;
    if (old) this.sc.tweens.add({ targets: old, scale: 0.6, alpha: 0, duration: 200, onComplete: () => old.destroy() });
    this.otsBox = undefined;
    if (!pic || !this.sc.textures.exists(pic.key)) return;
    const { SX, SY, SW } = this.r;
    const w = 200;
    const h = 136;
    const x = side === "left" ? SX + 26 + w / 2 : SX + SW - 26 - w / 2;
    const y = SY + 70 + h / 2;
    const c = (this.otsBox = this.add(this.sc.add.container(x, y), into ?? this.ui));
    this.add(this.sc.add.rectangle(0, 0, w + 8, h + 8, 0xffffff), c);
    this.add(this.sc.add.rectangle(0, 0, w, h, 0x0b1020), c);
    const img = this.add(this.sc.add.image(0, 0, pic.key, pic.frame), c);
    if (pic.crop) img.setCrop(...pic.crop);
    const fw = pic.crop ? pic.crop[2] : img.width;
    const fh = pic.crop ? pic.crop[3] : img.height;
    const s = Math.max(w / fw, h / fh);
    img.setScale(s);
    if (pic.crop) img.setPosition(-(pic.crop[0] + fw / 2 - img.width / 2) * s, -(pic.crop[1] + fh / 2 - img.height / 2) * s);
    const m = this.sc.make.graphics({}).fillRect(x - w / 2, y - h / 2, w, h);
    img.setMask(m.createGeometryMask());
    // a slow drift on the picture, like a graphic on a video wall
    this.sc.tweens.add({ targets: img, scale: s * 1.08, duration: 7000, ease: "Sine.inOut", yoyo: true, repeat: -1 });
    if (caption) {
      const t = this.add(this.sc.add.text(0, h / 2 - 2, caption.toUpperCase(), { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold", backgroundColor: hex(this.brand.main), padding: { x: 6, y: 3 } }).setOrigin(0.5, 1), c);
      void t;
    }
    c.setScale(0.5).setAlpha(0);
    this.sc.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: "Back.out" });
  }

  /** Hide everything but the bug (for a full-screen ident/sting). */
  setVisible(on: boolean) {
    this.ui.setVisible(on);
  }

  get headlineNow() {
    return this.headlineText;
  }
}

/** A press photographer's flash at (x, y): a small bright star at the camera itself, never a flash over the whole picture. */
export function cameraFlash(sc: Phaser.Scene, into: Phaser.GameObjects.Container, x: number, y: number, _rect?: Rect) {
  const k = calm() ? 0.35 : 1;
  const star = sc.add.star(x, y, 4, 2, 10, 0xffffff, 0.95 * k).setBlendMode(Phaser.BlendModes.ADD);
  const glow = sc.add.circle(x, y, 12, 0xffffff, 0.5 * k).setBlendMode(Phaser.BlendModes.ADD);
  into.add([glow, star]);
  sc.tweens.add({ targets: [star, glow], alpha: 0, scale: 1.6, duration: 180, onComplete: () => { star.destroy(); glow.destroy(); } });
  synth.play("camera_flash");
}

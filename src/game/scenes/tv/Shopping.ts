import Phaser from "phaser";
import { F, ShowDirector, type Perf } from "./ShowDirector";

/**
 * A shopping channel. Relentless: the presenter big on the left, gesturing at everything; the product on its
 * turntable on the right, spinning; a price panel, a phone number that never leaves the screen, a countdown to
 * the end of the offer and a stock counter that should be going down. The sponsor's message is a proper advert,
 * with a jingle-card look of its own.
 */

const STUDIO = "tv_shop_studio";

interface Product {
  key: string;
  scale: number;
  name: string;
  price: string;
  was?: string;
}

const WONK: Product = { key: "p_wonking", scale: 3, name: "WONKING MACHINE Mk II", price: "£49.99", was: "£299.99" };
const TREATS: Product = { key: "tv_prod_treats", scale: 1.9, name: "NAN'S CHOCCY DRAWER BUNDLE", price: "£12.99", was: "£13.00" };

export class ShoppingDirector extends ShowDirector {
  private product: Product = WONK;
  private ad = false;
  private stock = 3;
  private stockText: Phaser.GameObjects.Text | null = null;
  private priceText: Phaser.GameObjects.Text | null = null;
  private wasText: Phaser.GameObjects.Text | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private timerText: Phaser.GameObjects.Text | null = null;
  private secs = 600;
  private adLine = 0;

  // ------------------------------------------------------------------ the on-screen furniture

  /** Everything that stays up while we're in the studio. */
  private furniture() {
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    // the phone strap
    const strap = this.over(this.sc.add.container(SX, SY + SH - 44));
    strap.add(this.sc.add.rectangle(0, 0, SW, 44, 0xff2d8a).setOrigin(0));
    strap.add(this.sc.add.rectangle(0, 0, 150, 44, 0xffe14a).setOrigin(0));
    strap.add(this.text(75, 22, "☎ CALL NOW", 17, "#7a0040", { fontStyle: "bold" }).setOrigin(0.5));
    strap.add(this.text(162, 22, "0800 WONK WONK", 22, "#ffffff", { fontStyle: "bold", stroke: "#7a0040", strokeThickness: 4 }).setOrigin(0, 0.5));
    const lines = this.text(SW - 10, 22, "LINES OPEN", 13, "#ffffff", { fontStyle: "bold" }).setOrigin(1, 0.5);
    strap.add(lines);
    this.every(500, () => lines.setVisible(!lines.visible), -1, true);
    // the price panel
    const panel = this.over(this.sc.add.container(SX + SW - 142, SY + 12));
    panel.add(this.sc.add.rectangle(0, 0, 132, 140, 0x2a0a4a, 0.88).setOrigin(0).setStrokeStyle(3, 0xffe14a));
    this.nameText = this.text(66, 8, this.product.name, 11, "#ffffff", { fontStyle: "bold", align: "center", wordWrap: { width: 120 } }).setOrigin(0.5, 0);
    panel.add(this.nameText);
    this.wasText = this.text(66, 48, `WAS ${this.product.was ?? ""}`, 12, "#c8a8e8").setOrigin(0.5, 0);
    panel.add(this.wasText);
    const strike = this.sc.add.rectangle(66, 56, 90, 2, 0xff2d2d);
    panel.add(strike);
    this.priceText = this.text(66, 66, this.product.price, 30, "#ffe14a", { fontStyle: "bold" }).setOrigin(0.5, 0);
    panel.add(this.priceText);
    panel.add(this.text(66, 104, "or 6 easy Krezzcoin", 10, "#ffffff").setOrigin(0.5, 0));
    panel.add(this.text(66, 118, "ITEM 069-420", 10, "#c8a8e8").setOrigin(0.5, 0));
    // stock and countdown
    const stock = this.over(this.sc.add.container(SX + 12, SY + 12));
    stock.add(this.sc.add.rectangle(0, 0, 150, 30, 0xd01818).setOrigin(0));
    this.stockText = this.text(75, 15, `ONLY ${this.stock} LEFT!`, 16, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5);
    stock.add(this.stockText);
    this.sc.tweens.add({ targets: stock, scale: 1.06, duration: 300, yoyo: true, repeat: -1 });
    const clock = this.over(this.sc.add.container(SX + 12, SY + 48));
    clock.add(this.sc.add.rectangle(0, 0, 150, 26, 0x000000, 0.75).setOrigin(0));
    this.timerText = this.text(75, 13, "", 14, "#7fffd4", { fontStyle: "bold" }).setOrigin(0.5);
    clock.add(this.timerText);
    const tick = () => {
      this.secs = Math.max(0, this.secs - 1);
      this.timerText?.setText(`OFFER ENDS ${String(Math.floor(this.secs / 60)).padStart(2, "0")}:${String(this.secs % 60).padStart(2, "0")}`);
    };
    tick();
    this.every(1000, tick, -1, true);
    // a pulsing ON AIR dot
    const live = this.over(this.sc.add.circle(SX + SW - 152, SY + 160, 5, 0xff2020));
    this.sc.tweens.add({ targets: live, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  }

  private setStock(n: number) {
    this.stock = n;
    this.stockText?.setText(`ONLY ${n} LEFT!`);
    if (this.stockText) this.sc.tweens.add({ targets: this.stockText, scale: 1.4, duration: 120, yoyo: true });
  }

  /** The product on its turntable, turning. */
  private turntable(x: number, y: number, p = this.product, scale = 1) {
    this.add(this.sc.add.ellipse(x, y + 10, 210 * scale, 44 * scale, 0xe8e0ff).setStrokeStyle(3, 0xb090ff));
    this.add(this.sc.add.ellipse(x, y + 18, 210 * scale, 44 * scale, 0x8060c0).setDepth(-1));
    const key = this.tex(p.key) ?? "p_wonking";
    const s = this.add(this.sc.add.image(x, y + 8, key).setOrigin(0.5, 1).setScale(p.scale * scale));
    const proxy = { t: 0 };
    this.sc.tweens.add({
      targets: proxy,
      t: Math.PI * 2,
      duration: 3600,
      repeat: -1,
      onUpdate: () => {
        const c = Math.cos(proxy.t);
        s.setScale(p.scale * scale * Math.max(0.06, Math.abs(c)), p.scale * scale).setFlipX(c < 0);
      },
    });
    // sparkles
    this.every(260, () => {
      const sp = this.add(this.text(x + (Math.random() - 0.5) * 160 * scale, y - Math.random() * 150 * scale, "✦", 14 + Math.random() * 10, "#ffffff"));
      this.sc.tweens.add({ targets: sp, alpha: 0, scale: 1.6, duration: 600, onComplete: () => sp.destroy() });
    });
    return s;
  }

  // ------------------------------------------------------------------ shots

  protected onTitle(t: string): number {
    // the channel ident
    this.clear();
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x2a0a4a).setOrigin(0));
    const star = this.add(this.sc.add.star(this.cx, this.cy, 12, 90, 180, 0xff2d8a));
    this.sc.tweens.add({ targets: star, angle: 360, duration: 4000, repeat: -1 });
    const words = t.split(/\s+/);
    const top = words.slice(0, 2).join(" ");
    const rest = words.slice(2).join(" ");
    const a = this.add(this.text(this.cx, this.cy - 22, top, 34, "#ffe14a", { fontStyle: "bold", stroke: "#2a0a4a", strokeThickness: 7 }).setOrigin(0.5).setScale(0));
    const b = this.add(this.text(this.cx, this.cy + 22, rest, 18, "#ffffff", { fontStyle: "bold", stroke: "#2a0a4a", strokeThickness: 5 }).setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: a, scale: 1, duration: 500, ease: "Back.out" });
    this.sc.tweens.add({ targets: b, alpha: 1, duration: 400, delay: 500 });
    this.sfx("ding");
    void SW;
    return 2600;
  }

  protected onShot(_set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    this.studioWide();
    this.furniture();
    return 1600;
  }

  private studioWide() {
    this.clear();
    const { SY, SH } = this.r;
    this.backdrop(this.tex(STUDIO) ?? this.host.setTexture());
    this.turntable(this.r.SX + 272, SY + SH * 0.6, this.product, 0.8);
    this.push(1.1, 2600, this.r.SX + 272, SY + SH * 0.55);
  }

  /** The presenter on the left, the product on the right, as they talk. */
  private presenter(name: string): Perf | null {
    const p = this.single(name, { side: -1.25, bg: this.tex(STUDIO), zoom: 1.25, blur: 1.5, recut: true, scale: name === "HOST" ? 2.75 : 2.6 });
    if (!p) return null;
    const { SX, SY, SH } = this.r;
    this.turntable(SX + 400, SY + SH * 0.62);
    // presenters lean in to the lens
    this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 10, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    return p;
  }

  // ------------------------------------------------------------------ dialogue

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (name === "ANNOUNCER") return this.advert(text);
    if (this.ad) {
      // back from the break
      this.ad = false;
      this.furniture();
    }
    if (/Also available/i.test(text)) {
      this.product = TREATS;
      this.furniture();
      this.setStock(12);
    }
    let p = this.perf?.name === name ? this.perf : null;
    if (!p) p = this.presenter(name);
    if (!p) return 0;
    if (name === "HOST" && /!/.test(text)) {
      // the big sell: crash in on the product as the hand comes up
      this.later(500, () => this.burst(/reach-around/i.test(text) ? "NEW!\nREACH-AROUND" : /recycles/i.test(text) ? "♻ SELF-\nRECYCLING!" : "WOW!"));
    }
    if (/next ten minutes/i.test(text)) {
      this.secs = 599;
      this.later(1600, () => this.bonus());
    }
    if (/Lines are open/i.test(text)) this.nobodyCalls(p);
    if (name === "CO-HOST") {
      p.base = F.NEUTRAL;
      this.push(1.05, 3000, p.spr.x, p.spr.y - 200);
    }
    this.talk(p, name, text, emotion);
    return 0;
  }

  /** A starburst flash across the product. */
  private burst(t: string) {
    const { SX, SY } = this.r;
    const c = this.add(this.sc.add.container(SX + 318, SY + 150).setScale(0).setAngle(-12));
    c.add(this.sc.add.star(0, 0, 14, 44, 70, 0xffe14a).setStrokeStyle(3, 0xff2d8a));
    c.add(this.text(0, 0, t, 13, "#d01870", { fontStyle: "bold", align: "center" }).setOrigin(0.5));
    this.sc.tweens.add({ targets: c, scale: 1, duration: 300, ease: "Back.out" });
    this.sc.tweens.add({ targets: c, angle: 8, duration: 600, yoyo: true, repeat: -1, delay: 300 });
    this.sfx("pop");
  }

  /** "We'll throw in Big Bertha": the free gift card. */
  private bonus() {
    const { SX, SY, SW } = this.r;
    const c = this.over(this.sc.add.container(SX + SW / 2 + 60, SY + 200).setScale(0));
    c.add(this.sc.add.rectangle(0, 0, 230, 70, 0x18a058).setStrokeStyle(4, 0xffffff));
    c.add(this.text(0, -16, "FREE GIFT!", 20, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5));
    c.add(this.text(0, 12, "BIG BERTHA (2 yrs, crusty)", 13, "#e8ffe8").setOrigin(0.5));
    this.sc.tweens.add({ targets: c, scale: 1, duration: 300, ease: "Back.out" });
    this.later(3200, () => this.sc.tweens.add({ targets: c, alpha: 0, duration: 300 }), true);
  }

  /** "Nobody is calling": the callers board, at zero; the stock counter goes UP. */
  private nobodyCalls(p: Perf) {
    const { SX, SY } = this.r;
    const c = this.add(this.sc.add.container(SX + 410, SY + 170));
    c.add(this.sc.add.rectangle(0, 0, 200, 56, 0x000000, 0.85).setStrokeStyle(2, 0xff2d8a));
    c.add(this.text(0, -12, "CALLERS WAITING", 13, "#ff9ccf", { fontStyle: "bold" }).setOrigin(0.5));
    c.add(this.text(0, 12, "0", 22, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5));
    this.later(1600, () => this.setStock(4));
    this.later(2600, () => {
      if (!p.spr.active) return;
      p.base = F.BLINK;
      this.sc.tweens.add({ targets: p.spr, y: p.y + 12, duration: 800, ease: "Sine.easeOut" });
    });
  }

  /** The sponsor's message: its own little advert. */
  private advert(text: string): number {
    const first = !this.ad;
    this.ad = true;
    this.adLine++;
    const { SX, SY, SW, SH } = this.r;
    if (first) {
      this.clearGfx();
      this.clear();
      this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffd23f).setOrigin(0));
      const rays = this.add(this.sc.add.graphics({ x: this.cx, y: this.cy + 40 }));
      for (let i = 0; i < 18; i++) {
        rays.fillStyle(i % 2 ? 0xff8a1a : 0xffe680, 1);
        const a0 = (i / 18) * Math.PI * 2;
        const a1 = ((i + 1) / 18) * Math.PI * 2;
        rays.fillTriangle(0, 0, Math.cos(a0) * 600, Math.sin(a0) * 600, Math.cos(a1) * 600, Math.sin(a1) * 600);
      }
      this.sc.tweens.add({ targets: rays, angle: -360, duration: 16000, repeat: -1 });
      const pot = this.add(this.sc.add.image(this.cx, SY + SH * 0.78, this.tex("tv_prod_noodles") ?? "p_wonking").setOrigin(0.5, 1).setScale(3.2));
      this.sc.tweens.add({ targets: pot, y: pot.y - 14, angle: 4, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.over(this.text(SX + SW - 10, SY + SH - 8, "ADVERTISEMENT", 10, "#7a3a00").setOrigin(1, 1));
    }
    const slogans = ["UMAMI PUNANI!", "PACKS OF 6 OR 12", "TASTE THE FUN!"];
    const s = slogans[Math.min(slogans.length - 1, this.adLine - 1)];
    const t = this.add(this.text(this.cx, SY + 56, /Umami Punani\. Taste/i.test(text) ? "TASTE THE FUN!" : s, 36, "#d01818", { fontStyle: "bold", stroke: "#ffffff", strokeThickness: 7 }).setOrigin(0.5).setScale(0).setAngle(-5));
    this.sc.tweens.add({ targets: t, scale: 1, duration: 360, ease: "Back.out" });
    this.sc.tweens.add({ targets: t, alpha: 0, duration: 300, delay: 3800 });
    if (this.adLine === 2) {
      const tag = this.add(this.sc.add.container(SX + SW - 110, SY + SH * 0.5).setAngle(10));
      tag.add(this.sc.add.star(0, 0, 12, 40, 62, 0xff2d8a));
      tag.add(this.text(0, 0, "6 / 12", 16, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5));
    }
    return 0;
  }

  protected onSfx(id: string): number {
    if (id === "ding" && !this.ad && this.priceText) {
      // the price drops before your eyes
      this.wasText?.setText(`WAS ${this.product.price}`);
      this.priceText.setText("£39.99");
      this.sc.tweens.add({ targets: this.priceText, scale: 1.4, duration: 140, yoyo: true, repeat: 2 });
      this.sc.cameras.main.flash(80, 255, 255, 200);
    }
    if (id === "slurp" && this.ad) {
      const { SY, SH } = this.r;
      for (let i = 0; i < 6; i++) {
        const d = this.add(this.sc.add.circle(this.cx + (Math.random() - 0.5) * 60, SY + SH * 0.5, 5, 0xfff0c0));
        this.sc.tweens.add({ targets: d, y: d.y - 80 - Math.random() * 60, alpha: 0, duration: 700, delay: i * 80 });
      }
    }
    return 0;
  }
}

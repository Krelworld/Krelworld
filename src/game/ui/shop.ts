import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { FONT } from "./theme";

// The shop grid used by the Kreddle Exchange (MenuScene "bank") and Kreddle's Prize Counter / Home Furnishings:
// big cards with an icon, a name and a price; the selected card's one-liner and a big BUY button underneath.
// Keyboard (arrows + E/Enter/Space), mouse and touch (tap to pick, tap again or BUY to buy).

export type Currency = "coin" | "kroken";
/** buy: for sale · owned/maxed/full: nothing to buy · locked: not yet · toggle: a free switch (verb says what). */
export type ItemState = "buy" | "owned" | "maxed" | "full" | "locked" | "toggle";

export interface ShopItem {
  id: string;
  name: string;
  /** A texture key (drawn fitted into the card) or an emoji. */
  icon: string;
  iconTint?: number;
  /** One short line, shown only for the selected item. */
  desc: string;
  price: number;
  /** Can be bought with less than `price` (ammo fills as far as your money goes): the least it takes. */
  minPrice?: number;
  currency: Currency;
  state: ItemState;
  /** Level pips: [have, max]. */
  lvl?: [number, number];
  /** A fill bar (ammo): [have, max]. */
  bar?: [number, number];
  /** Corner ribbon, e.g. "NEW". */
  tag?: string;
  tagColor?: number;
  /** The BUY button's verb: BUY, FILL, HIRE… */
  verb?: string;
  /** Why it's locked (shown on the button). */
  lockReason?: string;
}

export interface ShopGridOpts {
  /** The card area. */
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  /** The bar under the cards: the selected item's line and the BUY button. */
  detail: { x: number; y: number; w: number; h: number };
  /** Where each balance is drawn (big, top right usually). */
  balances: { currency: Currency; x: number; y: number }[];
  balance: (c: Currency) => number;
  /** Do the purchase. Return true if it went through (then call setItems with the new state). */
  onBuy: (item: ShopItem) => boolean | Promise<boolean>;
  /** Pin everything to the screen (for scenes with a scrolling camera). */
  fixed?: boolean;
}

const COL = {
  card: 0x1d1a3a,
  cardSel: 0x3a2770,
  cardDim: 0x14121f,
  edge: 0x4c4785,
  gold: 0xffd23f,
  green: 0x22c55e,
  red: 0xff5a5a,
};

/** A stretchable PixelLab frame (gold-trimmed card, buy button, tab) if the art is loaded. */
export function kitFrame(scene: Phaser.Scene, key: "kd_card" | "kd_buy" | "kd_tab", x: number, y: number, w: number, h: number) {
  if (!scene.textures.exists(key)) return null;
  const m = key === "kd_card" ? 22 : key === "kd_buy" ? 30 : 24;
  const f = scene.add.nineslice(x, y, key, undefined, w, h, m, m, m, m);
  return f;
}

/** The currency glyph: the coin / Kroken token art if it's loaded, else an emoji. */
export function currencyIcon(scene: Phaser.Scene, x: number, y: number, c: Currency, size: number): Phaser.GameObjects.GameObject {
  const key = c === "coin" ? (scene.textures.exists("kd_coin") ? "kd_coin" : "p_coin") : scene.textures.exists("kd_kroken") ? "kd_kroken" : "p_token";
  if (scene.textures.exists(key)) return fitIcon(scene.add.image(x, y, key), size);
  return scene.add.text(x, y, c === "coin" ? "💰" : "🎟", { fontFamily: FONT, fontSize: `${Math.round(size * 0.8)}px` }).setOrigin(0.5);
}

function fitIcon(img: Phaser.GameObjects.Image, box: number) {
  const f = img.frame;
  img.setScale(box / Math.max(f.width, f.height, 1));
  return img;
}

/** A texture fitted into a square box, or an emoji the same size. */
export function shopIcon(scene: Phaser.Scene, x: number, y: number, icon: string, box: number, tint?: number): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  if (scene.textures.exists(icon)) {
    const img = fitIcon(scene.add.image(x, y, icon), box);
    if (tint !== undefined) img.setTint(tint);
    return img;
  }
  return scene.add.text(x, y, icon, { fontFamily: FONT, fontSize: `${Math.round(box * 0.72)}px`, padding: { x: 4, y: 4 } }).setOrigin(0.5);
}

interface Card {
  item: ShopItem;
  c: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  frame: Phaser.GameObjects.NineSlice | null;
  icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  price?: Phaser.GameObjects.Text;
  w: number;
  h: number;
}

export class ShopGrid {
  readonly root: Phaser.GameObjects.Container;
  private items: ShopItem[] = [];
  private sel = 0;
  private page = -1;
  private cards: Card[] = [];
  private pageLayer: Phaser.GameObjects.Container;
  private detailLayer: Phaser.GameObjects.Container;
  private balLayer: Phaser.GameObjects.Container;
  private balTexts: Partial<Record<Currency, Phaser.GameObjects.Text>> = {};
  private shown: Partial<Record<Currency, number>> = {};
  private busy = false;
  private bornAt: number;

  constructor(private scene: Phaser.Scene, private o: ShopGridOpts) {
    this.root = scene.add.container(0, 0);
    this.pageLayer = scene.add.container(0, 0);
    this.detailLayer = scene.add.container(0, 0);
    this.balLayer = scene.add.container(0, 0);
    this.root.add([this.pageLayer, this.detailLayer, this.balLayer]);
    this.bornAt = scene.time.now;
    this.drawBalances();
  }

  get perPage() {
    return this.o.cols * this.o.rows;
  }

  get selected(): ShopItem | undefined {
    return this.items[this.sel];
  }

  get index() {
    return this.sel;
  }

  /** Show these items (keeps the selection where it was, unless told otherwise). */
  setItems(items: ShopItem[], sel = this.sel) {
    this.items = items;
    this.sel = Phaser.Math.Clamp(sel, 0, Math.max(0, items.length - 1));
    this.page = -1;
    this.refresh();
  }

  /** Arrow keys: dx/dy in cards. Walks across pages. */
  move(dx: number, dy: number) {
    if (!this.items.length || this.busy) return;
    const n = this.items.length;
    let i = this.sel;
    if (dx) i = (i + dx + n) % n;
    if (dy) {
      const j = i + dy * this.o.cols;
      if (j >= 0 && j < n) i = j;
      else if (dy > 0 && Math.floor(i / this.o.cols) < Math.floor((n - 1) / this.o.cols)) i = n - 1;
      else return;
    }
    if (i === this.sel) return;
    this.sel = i;
    synth.play("select");
    this.refresh();
  }

  /** Buy the selected item (E / Enter / Space / the BUY button / a second tap). */
  async confirm() {
    // a key that opened the shop shouldn't also buy something
    if (this.busy || this.scene.time.now - this.bornAt < 250) return;
    const it = this.items[this.sel];
    if (!it) return;
    const card = this.cards.find((k) => k.item === it);
    if (it.state === "owned" || it.state === "maxed" || it.state === "full") {
      synth.play("select");
      if (card) this.wiggle(card, 3);
      return;
    }
    if (it.state === "locked") return this.deny(card);
    if (it.state === "buy" && this.o.balance(it.currency) < (it.minPrice ?? it.price)) return this.deny(card);
    this.busy = true;
    const before = this.o.balance(it.currency);
    let ok = false;
    try {
      ok = await this.o.onBuy(it);
    } finally {
      this.busy = false;
    }
    if (!ok) return this.deny(card);
    this.celebrate(it, before);
  }

  destroy() {
    this.root.destroy(true);
  }

  // ------------------------------------------------------------------ drawing

  private refresh() {
    const page = Math.floor(this.sel / this.perPage);
    if (page !== this.page) {
      this.page = page;
      this.drawPage();
    }
    for (const k of this.cards) this.paintCard(k, k.item === this.items[this.sel]);
    this.drawDetail();
    if (!this.busy) this.updateBalances(false);
    this.pin(this.root);
  }

  private drawPage() {
    const { scene, o } = this;
    this.pageLayer.removeAll(true);
    this.cards = [];
    const gap = 10;
    const pages = Math.max(1, Math.ceil(this.items.length / this.perPage));
    const arrows = pages > 1 ? 40 : 0;
    const cw = Math.floor((o.w - arrows * 2 - gap * (o.cols - 1)) / o.cols);
    const ch = Math.floor((o.h - gap * (o.rows - 1)) / o.rows);
    const x0 = o.x + arrows;
    const start = this.page * this.perPage;
    this.items.slice(start, start + this.perPage).forEach((it, k) => {
      const cx = x0 + (k % o.cols) * (cw + gap) + cw / 2;
      const cy = o.y + Math.floor(k / o.cols) * (ch + gap) + ch / 2;
      this.cards.push(this.makeCard(it, cx, cy, cw, ch, start + k));
    });
    if (!this.items.length) this.pageLayer.add(scene.add.text(o.x + o.w / 2, o.y + o.h / 2, "Nothing here yet.", { fontFamily: FONT, fontSize: "20px", color: "#9aa0b4" }).setOrigin(0.5));
    if (pages > 1) {
      const midY = o.y + o.h / 2;
      const arrow = (x: number, label: string, d: number) => {
        const r = scene.add.rectangle(x, midY, 34, Math.min(120, o.h), 0x2a2550, 0.9).setStrokeStyle(2, COL.edge).setInteractive({ useHandCursor: true });
        const t = scene.add.text(x, midY, label, { fontFamily: FONT, fontSize: "24px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5);
        r.on("pointerup", () => {
          const p = (this.page + d + pages) % pages;
          this.sel = Math.min(this.items.length - 1, p * this.perPage);
          synth.play("select");
          this.refresh();
        });
        this.pageLayer.add([r, t]);
      };
      arrow(o.x + 17, "◀", -1);
      arrow(o.x + o.w - 17, "▶", 1);
      this.pageLayer.add(scene.add.text(o.x + o.w - 17, midY + Math.min(60, o.h / 2) + 12, `${this.page + 1}/${pages}`, { fontFamily: FONT, fontSize: "12px", color: "#c4b5fd", fontStyle: "bold" }).setOrigin(0.5));
    }
  }

  private makeCard(it: ShopItem, x: number, y: number, w: number, h: number, index: number): Card {
    const { scene } = this;
    const c = scene.add.container(x, y);
    const bg = scene.add.graphics();
    c.add(bg);
    const frame = kitFrame(scene, "kd_card", 0, 0, w, h);
    if (frame) c.add(frame);
    const dead = it.state === "locked";
    const poor = it.state === "buy" && this.o.balance(it.currency) < (it.minPrice ?? it.price);
    const box = Math.min(w - 34, Math.round(h * (it.bar ? 0.3 : 0.4)));
    const iconY = -h / 2 + 10 + box / 2;
    const icon = shopIcon(scene, 0, iconY, it.icon, box, it.iconTint);
    icon.setAlpha(dead ? 0.25 : poor ? 0.55 : 1);
    c.add(icon);
    if (dead) c.add(scene.add.text(0, iconY, "🔒", { fontFamily: FONT, fontSize: `${Math.round(box * 0.5)}px` }).setOrigin(0.5));
    const name = scene.add.text(0, iconY + box / 2 + 6, it.name, {
      fontFamily: FONT,
      fontSize: w < 130 ? "14px" : "16px",
      color: dead ? "#7c7a96" : "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: w - 12, useAdvancedWrap: true },
      maxLines: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
    c.add(name);
    // level pips, top left
    if (it.lvl && it.lvl[1] > 1) {
      const [have, max] = it.lvl;
      const step = Math.min(12, (w - 40) / max);
      const inset = scene.textures.exists("kd_card") ? 10 : 0;
      for (let i = 0; i < max; i++) c.add(scene.add.circle(-w / 2 + 12 + inset + i * Math.min(step, (w - 40 - inset * 2) / max), -h / 2 + 11 + inset, 4, i < have ? COL.gold : 0x000000, 1).setStrokeStyle(1.5, i < have ? COL.gold : 0x6b6890));
    }
    if (it.tag) {
      const tin = scene.textures.exists("kd_card") ? 10 : 0;
      const t = scene.add.text(w / 2 - 6 - tin, -h / 2 + 5 + tin, it.tag, { fontFamily: FONT, fontSize: "11px", color: "#111111", fontStyle: "bold", backgroundColor: Phaser.Display.Color.IntegerToColor(it.tagColor ?? COL.gold).rgba, padding: { x: 4, y: 1 } }).setOrigin(1, 0);
      c.add(t);
    }
    if (it.bar) {
      const [have, max] = it.bar;
      const bw = w - 26;
      const by = h / 2 - 36;
      const f = max > 0 ? Phaser.Math.Clamp(have / max, 0, 1) : 1;
      c.add(scene.add.rectangle(-bw / 2, by, bw, 7, 0x000000, 0.8).setOrigin(0, 0.5).setStrokeStyle(1, 0x55527a));
      if (f > 0) c.add(scene.add.rectangle(-bw / 2, by, bw * f, 7, f < 0.25 ? COL.red : f < 0.6 ? 0xfacc15 : 0x67e8f9).setOrigin(0, 0.5));
    }
    // the bottom line: price, or what state it's in
    const py = h / 2 - 17;
    let price: Phaser.GameObjects.Text | undefined;
    if (it.state === "buy") {
      price = scene.add.text(9, py, it.price ? `${it.price}` : "FREE", { fontFamily: FONT, fontSize: "22px", color: poor ? "#ff6b6b" : it.currency === "kroken" ? "#67e8f9" : "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5);
      const glyph = currencyIcon(scene, 0, py, it.currency, 20) as Phaser.GameObjects.Image;
      glyph.setX(price.x - price.width / 2 - 12);
      c.add([glyph, price]);
    } else {
      const label = it.state === "owned" ? "✓ OWNED" : it.state === "maxed" ? "✓ MAX" : it.state === "full" ? "✓ FULL" : it.state === "locked" ? "LOCKED" : (it.verb ?? "");
      const col = it.state === "locked" ? "#7c7a96" : it.state === "toggle" ? "#67e8f9" : "#4ade80";
      c.add(scene.add.text(0, py, label, { fontFamily: FONT, fontSize: "17px", color: col, fontStyle: "bold" }).setOrigin(0.5));
    }
    const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      synth.unlock();
      if (this.busy) return;
      if (this.sel === index) void this.confirm();
      else {
        this.sel = index;
        synth.play("select");
        this.refresh();
      }
    });
    c.add(hit);
    this.pageLayer.add(c);
    const card: Card = { item: it, c, bg, frame, icon, price, w, h };
    return card;
  }

  private paintCard(k: Card, on: boolean) {
    const { item: it, bg, w, h, frame } = k;
    const done = it.state === "owned" || it.state === "maxed" || it.state === "full";
    bg.clear();
    if (frame) {
      // the gold card art; selected glows, locked is dimmed, owned goes a touch green
      frame.setTint(on ? 0xffffff : it.state === "locked" ? 0x6a6680 : done ? 0xc8ffd8 : 0xd8d0f0);
      if (on) {
        bg.fillStyle(0xffd23f, 0.28).fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 18);
        bg.fillStyle(0xff4fd8, 0.18).fillRoundedRect(-w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 22);
      }
    } else {
      const fill = on ? COL.cardSel : it.state === "locked" ? COL.cardDim : COL.card;
      const edge = on ? COL.gold : done ? 0x2f7a4a : COL.edge;
      bg.fillStyle(fill, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(on ? 4 : 2, edge, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      if (done) bg.fillStyle(COL.green, 0.08).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    }
    k.c.setScale(on ? 1.04 : 1);
    k.c.setDepth(on ? 2 : 1);
    if (on) this.pageLayer.bringToTop(k.c);
  }

  private drawDetail() {
    const { scene, o } = this;
    const d = o.detail;
    this.detailLayer.removeAll(true);
    const it = this.items[this.sel];
    const panelArt = kitFrame(scene, "kd_card", d.x + d.w / 2, d.y + d.h / 2, d.w, d.h);
    if (panelArt) this.detailLayer.add(panelArt);
    else {
      const g = scene.add.graphics();
      g.fillStyle(0x0d0b1c, 0.92).fillRoundedRect(d.x, d.y, d.w, d.h, 12).lineStyle(2, COL.edge, 1).strokeRoundedRect(d.x, d.y, d.w, d.h, 12);
      this.detailLayer.add(g);
    }
    if (!it) return;
    const bw = Math.min(250, Math.round(d.w * 0.34));
    const bh = d.h - 16;
    const textW = d.w - bw - 36;
    // the name in gold, and its one line underneath, centred in the bar
    const nm = scene.add.text(d.x + 24, 0, it.name, { fontFamily: FONT, fontSize: "20px", color: "#ffd23f", fontStyle: "bold", wordWrap: { width: textW }, maxLines: 1 } as Phaser.Types.GameObjects.Text.TextStyle);
    const ds = scene.add.text(d.x + 24, 0, it.desc, { fontFamily: FONT, fontSize: "16px", color: "#e5e1ff", wordWrap: { width: textW, useAdvancedWrap: true }, maxLines: 2 } as Phaser.Types.GameObjects.Text.TextStyle);
    const total = nm.height + 2 + (it.desc ? ds.height : 0);
    nm.setY(d.y + (d.h - total) / 2);
    ds.setY(nm.y + nm.height + 2);
    this.detailLayer.add([nm, ds]);
    // the BUY button
    const bx = d.x + d.w - bw / 2 - 10;
    const by = d.y + d.h / 2;
    const have = this.o.balance(it.currency);
    const can = it.state === "toggle" || (it.state === "buy" && have >= (it.minPrice ?? it.price));
    const done = it.state === "owned" || it.state === "maxed" || it.state === "full";
    const fill = can ? 0x15803d : done ? 0x1f3b2c : 0x3a1820;
    const art = kitFrame(scene, "kd_buy", bx, by, bw, bh);
    if (art) {
      // the glossy green casino button: red when you're short, dull when it's done
      art.setTint(can ? 0xffffff : done ? 0x7a8a80 : 0xff7a7a);
      this.detailLayer.add(art);
      if (can) scene.tweens.add({ targets: art, scaleX: 1.03, scaleY: 1.05, yoyo: true, repeat: -1, duration: 650, ease: "Sine.inOut" });
    } else {
      const btn = scene.add.graphics();
      btn.fillStyle(fill, 1).fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12).lineStyle(3, can ? 0x86efac : done ? 0x2f7a4a : 0x7f1d1d, 1).strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12);
      this.detailLayer.add(btn);
    }
    const txt = (s: string, col: string, size = 20) => scene.add.text(bx, by, s, { fontFamily: FONT, fontSize: `${size}px`, color: col, fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5);
    if (it.state === "buy") {
      // [VERB] [glyph] [price], or [NEED] [glyph] [shortfall], laid out as one centred row
      const size = can ? 22 : 18;
      const a = txt(can ? (it.verb ?? "BUY") : "NEED", can ? "#ffffff" : "#ffb4b4", size);
      const glyph = currencyIcon(scene, 0, by, it.currency, size + 4) as Phaser.GameObjects.Image;
      const b = txt(can ? `${it.price}` : `${it.price - have} MORE`, can ? "#ffd23f" : "#ffb4b4", size);
      const gw = size + 4;
      const w = a.width + 8 + gw + 6 + b.width;
      let x = bx - w / 2;
      a.setX(x + a.width / 2);
      x += a.width + 8;
      glyph.setX(x + gw / 2);
      x += gw + 6;
      b.setX(x + b.width / 2);
      this.detailLayer.add([a, glyph, b]);
    } else if (it.state === "toggle") this.detailLayer.add(txt(it.verb ?? "OK", "#ffffff"));
    else if (it.state === "locked") this.detailLayer.add(txt(`🔒 ${it.lockReason ?? "LOCKED"}`, "#a8a4c8", 15));
    else this.detailLayer.add(txt(it.state === "full" ? "✓ FULL" : it.state === "maxed" ? "✓ MAXED" : "✓ OWNED", "#86efac"));
    const hit = scene.add.rectangle(bx, by, bw, bh, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      synth.unlock();
      void this.confirm();
    });
    this.detailLayer.add(hit);
  }

  private drawBalances() {
    for (const b of this.o.balances) {
      const v = this.o.balance(b.currency);
      this.shown[b.currency] = v;
      const plate = this.scene.add.graphics();
      plate.fillStyle(0x000000, 0.55).fillRoundedRect(b.x - 128, b.y - 22, 140, 44, 22).lineStyle(2, b.currency === "coin" ? 0xb8860b : 0x0e7490, 1).strokeRoundedRect(b.x - 128, b.y - 22, 140, 44, 22);
      const icon = currencyIcon(this.scene, b.x - 104, b.y, b.currency, 30);
      const t = this.scene.add.text(b.x, b.y, `${v}`, { fontFamily: FONT, fontSize: "26px", color: b.currency === "coin" ? "#ffd23f" : "#67e8f9", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(1, 0.5);
      this.balLayer.add([plate, icon, t]);
      this.balTexts[b.currency] = t;
    }
  }

  /** Bring the balance readouts up to date (counting down if `roll`). */
  private updateBalances(roll: boolean) {
    for (const b of this.o.balances) {
      const t = this.balTexts[b.currency];
      if (!t) continue;
      const to = this.o.balance(b.currency);
      const from = this.shown[b.currency] ?? to;
      this.shown[b.currency] = to;
      if (!roll || from === to) {
        t.setText(`${to}`);
        continue;
      }
      const o = { v: from };
      this.scene.tweens.add({ targets: o, v: to, duration: 450, ease: "Cubic.out", onUpdate: () => t.setText(`${Math.round(o.v)}`), onComplete: () => t.setText(`${to}`) });
      this.scene.tweens.add({ targets: t, scale: { from: 1.25, to: 1 }, duration: 300, ease: "Back.out" });
      // the amount spent, floating off the balance
      const spent = this.scene.add.text(b.x - 58, b.y + 34, `${to - from > 0 ? "+" : "−"}${Math.abs(to - from)}`, { fontFamily: FONT, fontSize: "20px", color: to < from ? "#ff6b6b" : "#4ade80", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5);
      this.root.add(spent);
      this.pin(spent);
      this.scene.tweens.add({ targets: spent, y: spent.y + 18, alpha: 0, duration: 900, ease: "Cubic.out", onComplete: () => spent.destroy() });
    }
  }

  // ------------------------------------------------------------------ feedback

  private celebrate(it: ShopItem, before: number) {
    const { scene } = this;
    const spent = before - this.o.balance(it.currency);
    synth.play("coin");
    synth.play(spent >= 500 ? "cheer" : "ding");
    this.updateBalances(true);
    // the card that was bought (it's been redrawn by setItems by now; find it by id)
    const card = this.cards.find((k) => k.item.id === it.id) ?? this.cards.find((k) => k.item === this.items[this.sel]);
    if (!card) return;
    const m = card.c.getWorldTransformMatrix();
    const x = m.tx;
    const y = m.ty;
    const flash = scene.add.graphics();
    flash.fillStyle(0xffffff, 0.85).fillRoundedRect(-card.w / 2, -card.h / 2, card.w, card.h, 12);
    card.c.add(flash);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    scene.tweens.add({ targets: card.c, scale: { from: 1.22, to: 1.04 }, duration: 380, ease: "Back.out" });
    // a burst of coins/tokens from the card
    const bits: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < 10; i++) {
      const g = currencyIcon(scene, x, y, it.currency, 18) as Phaser.GameObjects.Image;
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const r = 60 + Math.random() * 40;
      this.root.add(g);
      bits.push(g);
      scene.tweens.add({ targets: g, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r - 20, alpha: 0, angle: Phaser.Math.Between(-180, 180), duration: 650, ease: "Cubic.out", onComplete: () => g.destroy() });
    }
    const pop = scene.add.text(x, y, it.state === "toggle" ? "✓" : "✓ GOT IT!", { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#4ade80", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
    this.root.add(pop);
    bits.push(pop);
    scene.tweens.add({ targets: pop, y: pop.y - 60, alpha: { from: 1, to: 0 }, scale: { from: 0.6, to: 1.15 }, duration: 900, ease: "Cubic.out", onComplete: () => pop.destroy() });
    for (const b of bits) this.pin(b);
  }

  private deny(card?: Card) {
    synth.play("tap_fail");
    if (card) this.wiggle(card, 7);
    for (const t of Object.values(this.balTexts)) {
      if (!t) continue;
      const it = this.items[this.sel];
      if (it && this.balTexts[it.currency] !== t) continue;
      t.setColor("#ff4d4d");
      this.scene.time.delayedCall(450, () => t.active && t.setColor(it?.currency === "kroken" ? "#67e8f9" : "#ffd23f"));
      this.scene.tweens.add({ targets: t, x: t.x + 5, yoyo: true, repeat: 3, duration: 45 });
    }
  }

  private wiggle(card: Card, px: number) {
    const x = card.c.x;
    this.scene.tweens.killTweensOf(card.c);
    this.scene.tweens.add({ targets: card.c, x: x + px, yoyo: true, repeat: 3, duration: 45, onComplete: () => card.c.setX(x) });
  }

  private pin(o: Phaser.GameObjects.GameObject) {
    if (!this.o.fixed) return;
    (o as unknown as { setScrollFactor?: (x: number, y?: number) => void }).setScrollFactor?.(0, 0);
    if (o instanceof Phaser.GameObjects.Container) for (const c of o.list) this.pin(c);
  }
}

/** A row of big tabs (icon + word). Returns the container. */
export function shopTabs(scene: Phaser.Scene, x: number, y: number, w: number, tabs: { id: string; label: string }[], active: string, onPick: (id: string) => void, accent = 0xff4fd8) {
  const c = scene.add.container(0, 0);
  const gap = 8;
  const tw = (w - gap * (tabs.length - 1)) / tabs.length;
  tabs.forEach((t, i) => {
    const cx = x + i * (tw + gap) + tw / 2;
    const on = t.id === active;
    const g = scene.add.graphics();
    const tabArt = kitFrame(scene, "kd_tab", cx, y, tw, 46);
    if (tabArt) {
      // gold-rimmed tab: the open one lit up in its colour, the rest dimmed
      tabArt.setTint(on ? 0xffffff : 0x8f86b0);
      c.add(tabArt);
      if (on) g.fillStyle(accent, 0.85).fillRoundedRect(cx - tw / 2 + 10, y - 13, tw - 20, 26, 6);
    } else g.fillStyle(on ? accent : 0x1d1a3a, on ? 1 : 0.95).fillRoundedRect(cx - tw / 2, y - 21, tw, 42, 10).lineStyle(2, on ? 0xffffff : COL.edge, 1).strokeRoundedRect(cx - tw / 2, y - 21, tw, 42, 10);
    const label = scene.add.text(cx, y, t.label, { fontFamily: FONT, fontSize: "19px", color: on ? "#ffffff" : "#c9c4ef", fontStyle: "bold", stroke: on ? "#000" : undefined, strokeThickness: on ? 3 : 0 }).setOrigin(0.5);
    const hit = scene.add.rectangle(cx, y, tw, 42, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      synth.unlock();
      if (!on) {
        synth.play("select");
        onPick(t.id);
      }
    });
    c.add([g, label, hit]);
  });
  return c;
}

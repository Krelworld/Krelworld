// PHONE MODE: the shops (research S13), from outside. Every shop in the game is ui/shop.ts's ShopGrid (the Kreddle
// Exchange, the Prize Counter, Home Furnishings): on a phone its pages of cards and its BUY bar give way to a phone
// list (lists.ts): a scrolling grid of tiles (every item, no pages), and beside it the picked item's detail with its own
// BUY button. A tap on a tile only picks it (on a laptop a second click buys: on a phone only BUY buys); BUY acts on
// release; ammo is bought by the box with − / + (the game's "fill it as far as your money goes" is the starting
// count). The shop's header, tabs, balances and ✕ stay the game's own. Phones only.
import type Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { ShopGrid, type ShopItem } from "../ui/shop";
import { ammoQuote } from "../systems/armoury";
import { PhoneList, type PDetail, type PRow } from "./lists";
import { capPurse, maxBoxes, stepQty } from "./listLogic";
import { covered } from "./listScenes";
import { touchWording } from "./wording";

type Bag = Record<string, any>;

/** The shop grid on screen now (the newest one whose scene is running and whose cards are still up). */
function liveGrid(grids: Set<Bag>, game: Phaser.Game): Bag | null {
  let best: Bag | null = null;
  for (const g of [...grids]) {
    if (!g.root?.active) {
      grids.delete(g);
      continue;
    }
    const key = g.scene?.sys?.settings?.key as string | undefined;
    if (!key || !game.scene.isActive(key) || covered(game, key)) continue;
    if (!g.root.visible) continue;
    best = g;
  }
  return best;
}

/** The price line on a tile. */
function priceText(it: ShopItem, poor: boolean): string {
  if (it.state === "buy") return `${it.currency === "kroken" ? "🎟" : "🪙"} ${it.price || "FREE"}${poor ? " ✗" : ""}`;
  if (it.state === "owned") return "✓ OWNED";
  if (it.state === "maxed") return "✓ MAX";
  if (it.state === "full") return "✓ FULL";
  if (it.state === "locked") return "🔒 LOCKED";
  return it.verb ?? "";
}

/** Ammo for one gun, by the box (the Exchange's "ammo_<gun>" cards): how many boxes a BUY can take. */
function ammoBoxes(it: ShopItem): { unit: number; max: number } | null {
  const m = /^ammo_(.+)$/.exec(it.id);
  if (!m || it.state !== "buy" || it.currency !== "coin") return null;
  try {
    const q = ammoQuote(G.s, m[1]);
    if (q.full || q.boxes <= 1) return null;
    return { unit: q.unit, max: maxBoxes(G.s.coins, q.unit, q.boxes) };
  } catch {
    return null;
  }
}

export class PhoneShops {
  private grids = new Set<Bag>();
  readonly list: PhoneList;
  private dirty = false;
  private qty = { key: "", n: 0 };
  private n = 0;

  constructor(
    readonly game: Phaser.Game,
    parent: HTMLElement,
  ) {
    this.list = new PhoneList(parent, game, "shop");
    this.install();
  }

  private install() {
    const proto = ShopGrid.prototype as unknown as Bag;
    if (proto.__mfShop) return;
    proto.__mfShop = true;
    const self = this;
    const setItems = proto.setItems;
    // (every new set of items: this grid is the phone's; its cards and BUY bar are under the phone list)
    proto.setItems = function (this: Bag, ...args: unknown[]) {
      const r = setItems.apply(this, args);
      self.grids.add(this);
      this.pageLayer?.setVisible(false);
      this.detailLayer?.setVisible(false);
      self.dirty = true;
      return r;
    };
    const refresh = proto.refresh;
    proto.refresh = function (this: Bag, ...args: unknown[]) {
      const r = refresh.apply(this, args);
      if (self.grids.has(this)) {
        this.pageLayer?.setVisible(false);
        this.detailLayer?.setVisible(false);
        self.dirty = true;
      }
      return r;
    };
    // the burst of coins from the bought card: its card is hidden on a phone, so the phone list says it instead
    const celebrate = proto.celebrate;
    proto.celebrate = function (this: Bag, it: ShopItem, before: number) {
      if (!self.grids.has(this)) return celebrate.call(this, it, before);
      const spent = before - this.o.balance(it.currency);
      synth.play("coin");
      synth.play(spent >= 500 ? "cheer" : "ding");
      this.updateBalances(true);
      self.list.flash(it.state === "toggle" ? "✓" : "✓ GOT IT!");
    };
    const deny = proto.deny;
    proto.deny = function (this: Bag, ...args: unknown[]) {
      const r = deny.apply(this, args);
      if (self.grids.has(this)) self.list.deny();
      return r;
    };
  }

  /** Every frame: the phone list follows the shop on screen. */
  frame() {
    this.n++;
    const g = liveGrid(this.grids, this.game);
    if (!g) {
      this.list.hide();
      return;
    }
    if (!this.list.isOpen || this.dirty || this.n % 30 === 0) {
      this.dirty = false;
      this.render(g);
    } else this.list.place();
  }

  private render(g: Bag) {
    const items = (g.items as ShopItem[]) ?? [];
    const sel = (g.sel as number) ?? 0;
    const bal = (c: ShopItem["currency"]) => Number(g.o.balance(c)) || 0;
    const redraw = () => (this.dirty = true);
    const rows: PRow[] = items.map((it, i) => {
      const poor = it.state === "buy" && bal(it.currency) < (it.minPrice ?? it.price);
      return {
        id: it.id,
        label: touchWording(it.name),
        icon: it.icon,
        right: priceText(it, poor),
        rightColor: it.state === "buy" ? (poor ? "#ff6b6b" : it.currency === "kroken" ? "#67e8f9" : "#ffd23f") : it.state === "locked" ? "#a8a4c8" : "#86efac",
        pips: it.lvl,
        bar: it.bar,
        tag: it.tag ? { text: it.tag, bg: `#${(it.tagColor ?? 0xffd23f).toString(16).padStart(6, "0")}` } : undefined,
        dim: it.state === "locked",
        selected: i === sel,
        onTap: () => {
          // a tap picks (and shows) it; only BUY buys
          if (g.sel === i || g.busy) return;
          g.sel = i;
          synth.play("select");
          g.refresh();
          redraw();
        },
      };
    });
    const it = items[sel];
    let detail: PDetail | undefined;
    if (it) {
      const have = bal(it.currency);
      const can = it.state === "toggle" || (it.state === "buy" && have >= (it.minPrice ?? it.price));
      const boxes = ammoBoxes(it);
      const qKey = `${it.id}|${boxes?.max ?? 0}`;
      if (this.qty.key !== qKey) this.qty = { key: qKey, n: boxes?.max ?? 0 };
      const n = boxes ? Math.max(boxes.max ? 1 : 0, Math.min(boxes.max, this.qty.n)) : 0;
      const price = boxes && n ? n * boxes.unit : it.price;
      const verb = it.verb ?? "BUY";
      const label =
        it.state === "buy"
          ? can
            ? `${boxes ? `BUY ${n} BOX${n === 1 ? "" : "ES"}` : verb} · ${it.currency === "kroken" ? "🎟" : "🪙"} ${price}`
            : `NEED ${it.currency === "kroken" ? "🎟" : "🪙"} ${(it.minPrice ?? it.price) - have} MORE`
          : it.state === "toggle"
            ? (it.verb ?? "OK")
            : it.state === "locked"
              ? `🔒 ${it.lockReason ?? "LOCKED"}`
              : it.state === "full"
                ? "✓ FULL"
                : it.state === "maxed"
                  ? "✓ MAXED"
                  : "✓ OWNED";
      detail = {
        icon: it.icon,
        title: touchWording(it.name),
        text: touchWording(it.desc),
        status: it.lvl && it.lvl[1] > 1 ? `Level ${it.lvl[0]} of ${it.lvl[1]}` : it.bar ? `Ammo ${it.bar[0]}/${it.bar[1]}` : undefined,
        qty: boxes && boxes.max > 1 ? { n, max: boxes.max, label: `${n} box${n === 1 ? "" : "es"}`, set: (v) => ((this.qty.n = stepQty(n, v > n ? 1 : -1, boxes.max)), redraw()) } : undefined,
        buy: {
          label,
          id: "shop-buy",
          kind: can ? "go" : "plain",
          disabled: !can,
          fn: () => void this.buy(g, it, boxes && n < boxes.max ? { unit: boxes.unit, n } : null),
        },
      };
    }
    this.list.show({
      id: `shop-${g.scene?.sys?.settings?.key ?? ""}`,
      memo: items.map((x) => x.id).join(",").slice(0, 120),
      rect: { x: g.o.x, y: g.o.y - 4, w: g.o.w, h: g.o.detail.y + g.o.detail.h - g.o.y + 4 },
      rows,
      tiles: true,
      detail,
      empty: "Nothing here yet.",
      accent: "#ff4fd8",
    });
  }

  /** BUY: the game's own purchase (its checks, its sounds, its balance roll); a count of boxes caps the purse. */
  private async buy(g: Bag, it: ShopItem, boxes: { unit: number; n: number } | null) {
    if (g.busy) return;
    const onBuy = g.o.onBuy;
    if (boxes) {
      // exactly n boxes: for this purchase the purse holds n boxes' worth, the rest is put straight back
      // (a save during the purchase waits until the money is all back)
      g.o.onBuy = (x: ShopItem) => {
        const s = G.s;
        const { purse, aside } = capPurse(s.coins, boxes.unit, boxes.n);
        const gs = G as unknown as Bag;
        const save = gs.save;
        const own = Object.prototype.hasOwnProperty.call(gs, "save");
        let saved = false;
        gs.save = () => void (saved = true);
        s.coins = purse;
        try {
          return onBuy(x);
        } finally {
          s.coins += aside;
          if (own) gs.save = save;
          else delete gs.save;
          if (saved) G.save();
        }
      };
    }
    try {
      await g.confirm();
    } finally {
      g.o.onBuy = onBuy;
      this.dirty = true;
    }
  }
}

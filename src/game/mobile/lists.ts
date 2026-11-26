// PHONE MODE: one native-scroll list for every long list (research M10), and the shop layout built on it (S13).
// A DOM card laid over the part of the canvas where the game draws its list: real CSS px, the browser's own momentum
// scrolling (`overflow-y:auto; touch-action:pan-y; overscroll-behavior:contain`), 52 px rows, 16 px words, a tap acts
// on release (never at the end of a scroll), ▲ / ▼ page buttons beside the list (a way that needs no drag), the
// selected row kept in view, the scroll position remembered per list. No touch on it reaches the game (keepTouches).
// A list that already fits on screen is left as the game draws it (the adapters in listScenes.ts decide).
//
// Phones only: only the phone chunk loads this file.
import type Phaser from "phaser";
import { keepTouches } from "./domTap";
import { haptic } from "./haptics";
import { BTN_CSS, canPage, dropSlot, esc, LIST_SLOP, pageScroll, ROW_CSS, scrollToShow } from "./listLogic";

export interface PAction {
  label: string;
  fn: () => void;
  /** go = the main thing (green), warn = leaves or costs something (red), on = a lit toggle / the open tab. */
  kind?: "go" | "warn" | "plain" | "on";
  disabled?: boolean;
  /** For tests and the smoke test. */
  id?: string;
}

export interface PRow {
  id: string;
  label: string;
  sub?: string;
  /** Right-hand text (a price, ammo, a state). */
  right?: string;
  rightColor?: string;
  /** A small coloured chip in front (a TV channel code). */
  chip?: { text: string; bg: string; fg?: string };
  /** A badge at the right end (NEW, ✓ SEEN). */
  badge?: { text: string; bg: string; fg?: string };
  /** An emoji, or a data URL (`texIcon`). */
  icon?: string;
  color?: string;
  dim?: boolean;
  selected?: boolean;
  /** Not tappable (a locked record). */
  disabled?: boolean;
  onTap?: () => void;
  /** Inline 44 px buttons at the right end (▲ ▼, BORROW). */
  actions?: PAction[];
  /** A section heading (not a row to tap). */
  heading?: boolean;
  /** Plain reading text that wraps (quests, the dialogue log); `who` above it. */
  text?: boolean;
  who?: string;
  whoColor?: string;
  italic?: boolean;
  /** Level pips [have, max] and a fill bar [have, max] (shop tiles). */
  pips?: [number, number];
  bar?: [number, number];
  /** A ribbon on a tile (NEW, EMPTY). */
  tag?: { text: string; bg: string };
  /** A drag handle (reorder by dragging it; the row's ▲ ▼ do the same without a drag). */
  grip?: boolean;
}

export interface PDetail {
  icon?: string;
  title: string;
  text: string;
  /** A line under the text (what you own, why it's locked). */
  status?: string;
  /** A quantity with − and + (ammo boxes). */
  qty?: { n: number; max: number; label: string; set: (n: number) => void };
  /** The one button that buys (separate from the tile: a tap on a tile only picks it). */
  buy?: PAction;
  /** Extra buttons under BUY. */
  more?: PAction[];
  /** The buttons right under the title, the words after them (a long detail: the gun rack). */
  actionsFirst?: boolean;
}

export interface PListSpec {
  /** Which list (the scroll position is remembered per id + memo). */
  id: string;
  memo?: string;
  /** Game px (960 x 540): where on the canvas the card goes. */
  rect: { x: number; y: number; w: number; h: number };
  title?: string;
  /** Long names may take two lines (row names and the title) instead of being cut off with "…" (the archive). */
  wrapLabels?: boolean;
  /** Left of the title (◀ BACK / ✕). */
  back?: PAction;
  /** Right of the title. */
  head?: PAction[];
  tabs?: { label: string; on: boolean; fn: () => void; color?: string }[];
  rows: PRow[];
  /** Tiles (a shop) instead of rows, this many a row (auto when 0). */
  tiles?: boolean;
  /** Two columns of rows (chapter select). */
  cols?: 1 | 2;
  /** A line under the list (the TV log, what's playing). */
  note?: string;
  foot?: PAction[];
  detail?: PDetail;
  empty?: string;
  /** Where a new list opens: the selected row (default), the top, or the bottom (the dialogue log). */
  start?: "selected" | "top" | "bottom";
  onReorder?: (id: string, to: number) => void;
  /** The card's accent colour. */
  accent?: string;
  /** See-through background (the game's art shows round it); default opaque. */
  glass?: boolean;
}

// ------------------------------------------------------------------ texture → picture (shop and rack icons)

const iconCache = new Map<string, string>();

/** A game texture as a picture for the DOM (cached; tinted like the game tints it). "" if it can't be had. */
export function texIcon(game: Phaser.Game, key: string, tint?: number): string {
  const ck = `${key}|${tint ?? ""}`;
  const hit = iconCache.get(ck);
  if (hit !== undefined) return hit;
  let out = "";
  try {
    const tm = game.textures;
    if (tm.exists(key)) {
      const frame = tm.getFrame(key);
      const src = frame.source.image as CanvasImageSource;
      const w = Math.max(1, frame.cutWidth);
      const h = Math.max(1, frame.cutHeight);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.drawImage(src, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
        if (tint !== undefined && tint !== 0xffffff) {
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = `#${tint.toString(16).padStart(6, "0")}`;
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = "destination-in";
          ctx.drawImage(src, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
        }
        out = cv.toDataURL();
      }
    }
  } catch {
    out = "";
  }
  iconCache.set(ck, out);
  return out;
}

/** An icon string (emoji, or a game texture key) as markup. */
function iconHtml(game: Phaser.Game, icon: string | undefined, tint?: number): string {
  if (!icon) return "";
  if (icon.startsWith("data:")) return `<img class="pl-img" alt="" src="${icon}">`;
  const pic = /^[\w.-]+$/.test(icon) ? texIcon(game, icon, tint) : "";
  if (pic) return `<img class="pl-img" alt="" src="${pic}">`;
  if (/^[\w.-]+$/.test(icon)) return "";
  return `<span class="pl-emo">${esc(icon)}</span>`;
}

// ------------------------------------------------------------------ styles

const CSS_ID = "krel-mobile-lists-css";
const CSS = `
.pl{position:fixed;left:0;top:0;z-index:30;display:none;box-sizing:border-box;touch-action:none;-webkit-user-select:none;user-select:none;
  font-family:system-ui,-apple-system,sans-serif;color:#fff;-webkit-tap-highlight-color:transparent}
.pl.show{display:flex}
.pl *{box-sizing:border-box}
.pl-card{display:flex;flex-direction:column;width:100%;height:100%;background:#120c20;border:2px solid var(--pl-acc,#ffd23f);border-radius:12px;overflow:hidden}
.pl.glass .pl-card{background:rgba(14,9,26,.9)}
.pl.wrapl .pl-l,.pl.wrapl .pl-title{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-height:1.15}
.pl-head{display:flex;align-items:center;gap:6px;flex:none;min-height:46px;padding:0 4px 0 10px;border-bottom:1px solid rgba(255,255,255,.12)}
.pl-title{flex:1;min-width:0;font:700 16px "Krel Bold",system-ui,sans-serif;color:var(--pl-acc,#ffd23f);letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-b{flex:none;min-width:44px;min-height:44px;padding:0 12px;border-radius:10px;border:2px solid rgba(255,255,255,.28);background:#2a1d45;color:#fff;
  font:700 13px "Krel Bold",system-ui,sans-serif;letter-spacing:.3px;display:flex;align-items:center;justify-content:center;text-align:center;touch-action:manipulation}
.pl-b.go{background:#15803d;border-color:#86efac}
.pl-b.warn{background:#7f1d1d;border-color:#fca5a5}
.pl-b.on{background:var(--pl-acc,#ffd23f);color:#120c20;border-color:var(--pl-acc,#ffd23f)}
.pl-b.off{opacity:.38}
.pl-b.prs,.pl-row.prs,.pl-tile.prs,.pl-tab.prs{filter:brightness(1.35);transform:scale(.97)}
.pl-tabs{display:flex;gap:6px;flex:none;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-x;
  padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.1);scrollbar-width:none}
.pl-tabs::-webkit-scrollbar{display:none}
.pl-tab{flex:none;min-width:52px;height:44px;padding:0 12px;border-radius:10px;border:2px solid var(--tc,#7fb3ff);background:rgba(255,255,255,.04);color:#e6ebff;
  font:700 13px "Krel Bold",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;white-space:nowrap;touch-action:pan-x}
.pl-tab.on{background:var(--tc,#ffd23f);color:#0a0a14}
.pl-main{flex:1;min-height:0;display:flex}
.pl-lw{flex:1;min-width:0;display:flex;position:relative}
.pl-list{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:4px 6px 8px 8px}
.pl-list.c2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:8px;align-content:start}
.pl-list.tl{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:8px;align-content:start;padding:8px}
.pl-pg{flex:none;width:50px;display:flex;flex-direction:column;justify-content:space-between;padding:4px 4px 4px 0}
.pl-pg .pl-b{width:44px;padding:0;font-size:16px}
.pl-row{display:flex;align-items:center;gap:8px;min-height:${ROW_CSS}px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.07);border-radius:8px;
  touch-action:pan-y;position:relative;background:transparent}
.pl-row.sel{background:rgba(255,210,63,.16);box-shadow:inset 3px 0 0 var(--pl-acc,#ffd23f)}
.pl-row.dim{opacity:.5}
.pl-list.c2 .pl-row.hd,.pl-list.tl .pl-row.hd{grid-column:1/-1}
.pl-row.hd{min-height:30px;padding:10px 4px 2px;border:0;font:700 13px "Krel Bold",system-ui,sans-serif;color:#86efac;letter-spacing:.5px;border-radius:0}
.pl-row.tx{display:block;min-height:0;padding:5px 4px;font-size:15px;line-height:1.35;border-radius:0}
.pl-row.tx b{display:block;font:700 13px "Krel Bold",system-ui,sans-serif;letter-spacing:.4px;margin-bottom:1px}
.pl-row.tx.it{font-style:italic;color:#b9bdd0}
.pl-row.drag{z-index:2;background:#2d2350;box-shadow:0 6px 18px rgba(0,0,0,.6);transition:none}
.pl-row.drop{box-shadow:inset 0 3px 0 #ffd23f}
.pl-row.dropb{box-shadow:inset 0 -3px 0 #ffd23f}
.pl-t{flex:1;min-width:0}
.pl-l{font-size:16px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-s{font-size:12.5px;line-height:1.25;color:#b9c1e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.pl-r{flex:none;font:700 13px "Krel Bold",system-ui,sans-serif;color:#ffd23f;text-align:right}
.pl-chip{flex:none;min-width:44px;padding:4px 5px;border-radius:5px;font:700 11px "Krel Bold",system-ui,sans-serif;text-align:center;color:#0a0a14}
.pl-badge{flex:none;padding:3px 7px;border-radius:5px;font:700 11.5px "Krel Bold",system-ui,sans-serif}
.pl-grip{flex:none;width:40px;height:44px;margin-left:-4px;display:flex;align-items:center;justify-content:center;color:#7c8aa8;font-size:20px;touch-action:none}
.pl-ic{flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center}
.pl-img{max-width:100%;max-height:100%;image-rendering:pixelated;object-fit:contain}
.pl-emo{font-size:26px;line-height:1}
.pl-acts{flex:none;display:flex;gap:4px}
.pl-acts .pl-b{padding:0 8px}
.pl-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;min-height:112px;padding:8px 4px 6px;
  border-radius:10px;border:2px solid #4c4785;background:#1d1a3a;touch-action:pan-y;text-align:center}
.pl-tile>*{flex:none}
.pl-tile.sel{border-color:#ffd23f;background:#3a2770;box-shadow:0 0 0 3px rgba(255,210,63,.25)}
.pl-tile.dim{opacity:.5}
.pl-tile .pl-ic{width:44px;height:44px}
.pl-tile .pl-emo{font-size:32px}
.pl-tile .pl-l{font-size:13.5px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.15}
.pl-tile .pl-r{font-size:14px;margin-top:auto;padding-top:2px}
.pl-tag{position:absolute;top:4px;right:4px;padding:1px 5px;border-radius:4px;font:700 10.5px "Krel Bold",system-ui,sans-serif;color:#111}
.pl-pips{position:absolute;top:6px;left:6px;display:flex;gap:2px}
.pl-pips i{width:7px;height:7px;border-radius:50%;border:1.5px solid #6b6890}
.pl-pips i.y{background:#ffd23f;border-color:#ffd23f}
.pl-bar{width:84%;height:6px;border-radius:3px;background:#000;border:1px solid #55527a;overflow:hidden}
.pl-bar i{display:block;height:100%;background:#67e8f9}
.pl-det{flex:none;width:38%;max-width:320px;display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-left:1px solid rgba(255,255,255,.12);overflow-y:auto;
  -webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
.pl-dh{display:flex;align-items:center;gap:8px}
.pl-dh .pl-ic{width:52px;height:52px}
.pl-dt{font:700 17px "Krel Bold",system-ui,sans-serif;color:#ffd23f;line-height:1.15}
.pl-dx{font-size:14px;line-height:1.35;color:#e5e1ff;white-space:pre-line}
.pl-ds{font-size:13px;line-height:1.3;color:#86efac}
.pl-q{display:flex;align-items:center;gap:6px}
.pl-q .pl-b{width:48px;padding:0;font-size:22px}
.pl-qn{flex:1;text-align:center;font:700 15px "Krel Bold",system-ui,sans-serif}
.pl-buy{min-height:52px;font-size:17px;margin-top:auto}
.pl-det.af .pl-buy{margin-top:0;flex:none}
.pl-det .pl-b{flex:none}
.pl-buy.deny{animation:pl-shake .3s}
@keyframes pl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.pl-got{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font:700 22px Impact,"Krel Bold",sans-serif;color:#4ade80;text-shadow:0 2px 0 #000;
  pointer-events:none;animation:pl-got .9s ease-out forwards}
@keyframes pl-got{from{opacity:1;transform:translate(-50%,-30%) scale(.7)}to{opacity:0;transform:translate(-50%,-120%) scale(1.15)}}
.pl-foot{flex:none;display:flex;align-items:center;gap:8px;min-height:44px;padding:3px 8px;border-top:1px solid rgba(255,255,255,.1)}
.pl-note{flex:1;min-width:0;font-size:13px;line-height:1.25;color:#facc15}
.pl-empty{padding:24px 10px;text-align:center;color:#8fa0d0;font-size:15px;line-height:1.4}
`;

function injectCss() {
  if (typeof document === "undefined" || document.getElementById(CSS_ID)) return;
  const st = document.createElement("style");
  st.id = CSS_ID;
  st.textContent = CSS;
  document.head.appendChild(st);
}

/** The home-indicator strip (CSS px): nothing tappable in it. */
const BOTTOM_STRIP = 21;

// ------------------------------------------------------------------ the list

/** One DOM list card (each list in listScenes.ts has its own). */
export class PhoneList {
  readonly el: HTMLDivElement;
  private fns: (() => void)[] = [];
  private spec: PListSpec | null = null;
  private sig = "";
  private placed = "";
  private memo = new Map<string, number>();
  private memoKey = "";
  private shownSel: string | null = null;
  private listEl: HTMLDivElement | null = null;
  private drag: { from: number; y0: number; row: HTMLElement; rows: HTMLElement[]; id: string; to: number; touch: number } | null = null;
  /** For the smoke test: renders, taps and page presses. */
  stats = { renders: 0, taps: 0, pages: 0, reorders: 0 };

  constructor(parent: HTMLElement, readonly game: Phaser.Game, readonly name: string) {
    injectCss();
    const el = document.createElement("div");
    el.className = "pl";
    el.dataset.list = name;
    keepTouches(el);
    parent.appendChild(el);
    this.el = el;
    this.bindTaps();
  }

  get isOpen(): boolean {
    return this.el.classList.contains("show");
  }

  get current(): PListSpec | null {
    return this.isOpen ? this.spec : null;
  }

  /** The scrolling list element (for tests). */
  get scroller(): HTMLDivElement | null {
    return this.listEl;
  }

  /** Show (or update) the card. Drawn again only when what it shows changed. */
  show(spec: PListSpec) {
    const sig = JSON.stringify(spec);
    const wasOpen = this.isOpen;
    this.spec = spec;
    // (shown and placed first: a scroll position can only be set on a list that is laid out)
    if (!wasOpen) {
      this.placed = "";
      this.el.classList.add("show");
    }
    this.place();
    if (sig !== this.sig || !wasOpen) {
      this.sig = sig;
      this.render(spec, !wasOpen);
    }
  }

  hide() {
    if (!this.isOpen) return;
    this.saveScroll();
    this.el.classList.remove("show");
    this.drag = null;
  }

  /** Over its part of the canvas (every frame while shown: only writes when the canvas moved). */
  place() {
    const s = this.spec;
    if (!s) return;
    const cv = this.game.canvas;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const k = r.width / 960;
    const ky = r.height / 540;
    const left = r.left + s.rect.x * k;
    const top = Math.max(0, r.top + s.rect.y * ky);
    const w = s.rect.w * k;
    const bottomMax = (window.visualViewport?.height ?? window.innerHeight) - BOTTOM_STRIP;
    const h = Math.max(120, Math.min(r.top + (s.rect.y + s.rect.h) * ky, bottomMax) - top);
    const key = `${left | 0},${top | 0},${w | 0},${h | 0}`;
    if (key === this.placed) return;
    this.placed = key;
    Object.assign(this.el.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    this.updatePager();
  }

  /** Scroll by a page (the ▲ ▼ buttons). */
  page(dir: -1 | 1) {
    const l = this.listEl;
    if (!l) return;
    this.stats.pages++;
    const to = pageScroll(l.scrollTop, l.clientHeight, l.scrollHeight, dir);
    try {
      l.scrollTo({ top: to, behavior: "smooth" });
    } catch {
      l.scrollTop = to;
    }
  }

  /** A short "✓ GOT IT!" over the card (a purchase went through). */
  flash(text = "✓ GOT IT!") {
    const d = document.createElement("div");
    d.className = "pl-got";
    d.textContent = text;
    this.el.querySelector(".pl-card")?.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }

  /** The BUY button shakes (not enough money, locked). */
  deny() {
    const b = this.el.querySelector(".pl-buy");
    if (!b) return;
    b.classList.remove("deny");
    void (b as HTMLElement).offsetWidth;
    b.classList.add("deny");
  }

  private saveScroll() {
    if (this.listEl && this.memoKey) this.memo.set(this.memoKey, this.listEl.scrollTop);
  }

  private act(a: PAction | undefined): string {
    if (!a) return "";
    const k = this.fns.push(a.disabled ? () => {} : a.fn) - 1;
    return `<button type="button" class="pl-b ${a.kind ?? ""}${a.disabled ? " off" : ""}" data-k="${k}"${a.id ? ` data-id="${esc(a.id)}"` : ""}>${esc(a.label)}</button>`;
  }

  private rowHtml(r: PRow, i: number): string {
    if (r.heading) return `<div class="pl-row hd"${r.color ? ` style="color:${esc(r.color)}"` : ""}>${esc(r.label)}</div>`;
    if (r.text)
      return `<div class="pl-row tx${r.italic ? " it" : ""}"${r.color ? ` style="color:${esc(r.color)}"` : ""}>${r.who ? `<b style="color:${esc(r.whoColor ?? "#ffd23f")}">${esc(r.who)}</b>` : ""}${esc(r.label)}</div>`;
    const k = r.onTap && !r.disabled ? this.fns.push(r.onTap) - 1 : -1;
    const cls = `pl-row${r.selected ? " sel" : ""}${r.dim ? " dim" : ""}`;
    const grip = r.grip ? `<span class="pl-grip" data-grip="${i}" aria-label="drag to move">⋮⋮</span>` : "";
    const chip = r.chip ? `<span class="pl-chip" style="background:${esc(r.chip.bg)};color:${esc(r.chip.fg ?? "#0a0a14")}">${esc(r.chip.text)}</span>` : "";
    const icon = r.icon ? `<span class="pl-ic">${iconHtml(this.game, r.icon)}</span>` : "";
    const right = r.right ? `<span class="pl-r"${r.rightColor ? ` style="color:${esc(r.rightColor)}"` : ""}>${esc(r.right)}</span>` : "";
    const badge = r.badge ? `<span class="pl-badge" style="background:${esc(r.badge.bg)};color:${esc(r.badge.fg ?? "#111")}">${esc(r.badge.text)}</span>` : "";
    const acts = r.actions?.length ? `<span class="pl-acts">${r.actions.map((a) => this.act(a)).join("")}</span>` : "";
    return `<div class="${cls}" data-row="${esc(r.id)}"${k >= 0 ? ` data-k="${k}"` : ""}>${grip}${chip}${icon}<div class="pl-t"><div class="pl-l"${r.color ? ` style="color:${esc(r.color)}"` : ""}>${esc(r.label)}</div>${r.sub ? `<div class="pl-s">${esc(r.sub)}</div>` : ""}</div>${right}${badge}${acts}</div>`;
  }

  private tileHtml(r: PRow): string {
    const k = r.onTap && !r.disabled ? this.fns.push(r.onTap) - 1 : -1;
    const pips = r.pips && r.pips[1] > 1 ? `<span class="pl-pips">${Array.from({ length: Math.min(10, r.pips[1]) }, (_, j) => `<i class="${j < r.pips![0] ? "y" : ""}"></i>`).join("")}</span>` : "";
    const tag = r.tag ? `<span class="pl-tag" style="background:${esc(r.tag.bg)}">${esc(r.tag.text)}</span>` : "";
    const bar = r.bar ? `<span class="pl-bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, r.bar[1] ? r.bar[0] / r.bar[1] : 1)))}%"></i></span>` : "";
    return `<div class="pl-tile${r.selected ? " sel" : ""}${r.dim ? " dim" : ""}" data-row="${esc(r.id)}"${k >= 0 ? ` data-k="${k}"` : ""}>${pips}${tag}<span class="pl-ic">${iconHtml(this.game, r.icon)}</span><span class="pl-l">${esc(r.label)}</span>${bar}${r.right ? `<span class="pl-r"${r.rightColor ? ` style="color:${esc(r.rightColor)}"` : ""}>${esc(r.right)}</span>` : ""}</div>`;
  }

  private render(s: PListSpec, opening: boolean) {
    this.saveScroll();
    this.stats.renders++;
    this.fns = [];
    const memoKey = `${s.id}|${s.memo ?? ""}`;
    const newList = opening || memoKey !== this.memoKey;
    this.memoKey = memoKey;
    this.el.classList.toggle("glass", !!s.glass);
    this.el.classList.toggle("wrapl", !!s.wrapLabels);
    this.el.style.setProperty("--pl-acc", s.accent ?? "#ffd23f");
    const head = s.title || s.back || s.head?.length ? `<div class="pl-head">${this.act(s.back)}<span class="pl-title">${esc(s.title ?? "")}</span>${(s.head ?? []).map((a) => this.act(a)).join("")}</div>` : "";
    const tabs = s.tabs?.length
      ? `<div class="pl-tabs">${s.tabs.map((t) => `<button type="button" class="pl-tab${t.on ? " on" : ""}" style="--tc:${esc(t.color ?? "#ffd23f")}" data-k="${this.fns.push(t.fn) - 1}">${esc(t.label)}</button>`).join("")}</div>`
      : "";
    const body = s.rows.length ? s.rows.map((r, i) => (s.tiles && !r.heading && !r.text ? this.tileHtml(r) : this.rowHtml(r, i))).join("") : `<div class="pl-empty">${esc(s.empty ?? "Nothing here yet.")}</div>`;
    const cls = s.tiles ? "pl-list tl" : s.cols === 2 ? "pl-list c2" : "pl-list";
    const pg = `<div class="pl-pg"><button type="button" class="pl-b" data-pg="-1" aria-label="page up">▲</button><button type="button" class="pl-b" data-pg="1" aria-label="page down">▼</button></div>`;
    let det = "";
    const d = s.detail;
    if (d) {
      const qty = d.qty
        ? `<div class="pl-q">${this.act({ label: "−", fn: () => d.qty!.set(d.qty!.n - 1), disabled: d.qty.n <= 1, id: "qty-" })}<span class="pl-qn">${esc(d.qty.label)}</span>${this.act({ label: "+", fn: () => d.qty!.set(d.qty!.n + 1), disabled: d.qty.n >= d.qty.max, id: "qty+" })}</div>`
        : "";
      const buy = d.buy ? this.act(d.buy).replace('class="pl-b', 'class="pl-b pl-buy') : "";
      const words = `<div class="pl-dx">${esc(d.text)}</div>${d.status ? `<div class="pl-ds">${esc(d.status)}</div>` : ""}`;
      const btns = `${qty}${buy}${(d.more ?? []).map((a) => this.act(a)).join("")}`;
      det = `<div class="pl-det${d.actionsFirst ? " af" : ""}"><div class="pl-dh">${d.icon ? `<span class="pl-ic">${iconHtml(this.game, d.icon)}</span>` : ""}<div class="pl-dt">${esc(d.title)}</div></div>${d.actionsFirst ? btns + words : words + btns}</div>`;
    }
    const foot = s.note || s.foot?.length ? `<div class="pl-foot">${s.note ? `<span class="pl-note">${esc(s.note)}</span>` : "<span class='pl-note'></span>"}${(s.foot ?? []).map((a) => this.act(a)).join("")}</div>` : "";
    this.el.innerHTML = `<div class="pl-card" role="dialog" aria-label="${esc(s.title ?? s.id)}">${head}${tabs}<div class="pl-main"><div class="pl-lw"><div class="${cls}">${body}</div>${pg}</div>${det}</div>${foot}</div>`;
    const list = this.el.querySelector(".pl-list") as HTMLDivElement;
    this.listEl = list;
    if (s.tiles) list.style.setProperty("--cols", "3");
    list.addEventListener("scroll", () => this.updatePager(), { passive: true });
    // where it opens: where it was (this list, this tab), else the selected row, the top or the bottom
    const sel = s.rows.find((r) => r.selected)?.id ?? null;
    const remembered = this.memo.get(memoKey);
    if (newList) {
      if (remembered !== undefined) list.scrollTop = remembered;
      else if (s.start === "bottom") list.scrollTop = list.scrollHeight;
      else if (s.start !== "top" && sel) this.showRow(sel, true);
    } else list.scrollTop = remembered ?? list.scrollTop;
    // the selected row stays in view when the selection moves (keys, a pad, or a redraw)
    if (sel && (newList ? remembered !== undefined : sel !== this.shownSel)) this.showRow(sel, false);
    this.shownSel = sel;
    this.updatePager();
  }

  private showRow(id: string, centre: boolean) {
    const l = this.listEl;
    if (!l) return;
    const row = Array.from(l.querySelectorAll<HTMLElement>("[data-row]")).find((e) => e.dataset.row === id);
    if (!row) return;
    const top = row.offsetTop - l.offsetTop;
    if (centre) l.scrollTop = Math.max(0, top - (l.clientHeight - row.offsetHeight) / 2);
    else l.scrollTop = scrollToShow(top, row.offsetHeight, l.scrollTop, l.clientHeight);
  }

  private updatePager() {
    const l = this.listEl;
    if (!l) return;
    const fits = l.scrollHeight <= l.clientHeight + 1;
    const pg = this.el.querySelector(".pl-pg") as HTMLElement | null;
    if (pg) pg.style.display = fits ? "none" : "flex";
    for (const b of Array.from(this.el.querySelectorAll<HTMLElement>("[data-pg]"))) b.classList.toggle("off", !canPage(l.scrollTop, l.clientHeight, l.scrollHeight, Number(b.dataset.pg) as -1 | 1));
  }

  /** Every tap on the card: acts on release, if the finger stayed within LIST_SLOP (so a scroll never presses). */
  private bindTaps() {
    const el = this.el;
    let t0: { x: number; y: number; id: number; target: HTMLElement | null } | null = null;
    let touched = 0;
    const tappable = (e: EventTarget | null) => (e instanceof Element ? (e.closest("[data-k],[data-pg]") as HTMLElement | null) : null);
    el.addEventListener(
      "touchstart",
      (e) => {
        const t = e.changedTouches[0];
        if (!t) return;
        const grip = e.target instanceof Element ? (e.target.closest("[data-grip]") as HTMLElement | null) : null;
        if (grip && this.spec?.onReorder) {
          this.startDrag(grip, t);
          t0 = null;
          return;
        }
        const target = tappable(e.target);
        t0 = { x: t.clientX, y: t.clientY, id: t.identifier, target };
        target?.classList.add("prs");
      },
      { passive: true },
    );
    el.addEventListener(
      "touchmove",
      (e) => {
        if (this.drag) {
          const t = Array.from(e.changedTouches).find((x) => x.identifier === this.drag!.touch);
          if (t) {
            if (e.cancelable) e.preventDefault();
            this.moveDrag(t.clientY);
          }
          return;
        }
        const t = Array.from(e.changedTouches).find((x) => x.identifier === t0?.id);
        if (t && t0 && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > LIST_SLOP) {
          t0.target?.classList.remove("prs");
          t0 = null;
        }
      },
      { passive: false },
    );
    el.addEventListener(
      "touchend",
      (e) => {
        if (this.drag) {
          if (Array.from(e.changedTouches).some((x) => x.identifier === this.drag!.touch)) this.endDrag(true);
          return;
        }
        const t = Array.from(e.changedTouches).find((x) => x.identifier === t0?.id);
        if (!t || !t0) return;
        const target = t0.target;
        target?.classList.remove("prs");
        t0 = null;
        if (!target) return;
        // (the finger lifted on the same thing it went down on)
        const under = document.elementFromPoint(t.clientX, t.clientY);
        if (under && !target.contains(under)) return;
        touched = performance.now();
        if (e.cancelable) e.preventDefault();
        this.fire(target);
      },
      { passive: false },
    );
    el.addEventListener("touchcancel", () => {
      t0?.target?.classList.remove("prs");
      t0 = null;
      if (this.drag) this.endDrag(false);
    });
    // (a mouse, with ?mobile=1 in a desktop browser's device emulation)
    el.addEventListener("click", (e) => {
      if (performance.now() - touched < 700) return;
      const target = tappable(e.target);
      if (target) this.fire(target);
    });
  }

  private fire(target: HTMLElement) {
    if (target.dataset.pg) {
      this.page(Number(target.dataset.pg) as -1 | 1);
      return;
    }
    if (target.classList.contains("off")) return;
    const fn = this.fns[Number(target.dataset.k)];
    if (!fn) return;
    this.stats.taps++;
    haptic("tap");
    try {
      fn();
    } catch (err) {
      console.warn("phone list", err);
    }
  }

  // ---------------------------------------------------------------- drag to reorder (the ⋮⋮ handle)

  private startDrag(grip: HTMLElement, t: Touch) {
    const row = grip.closest("[data-row]") as HTMLElement | null;
    if (!row || !this.listEl) return;
    const rows = Array.from(this.listEl.querySelectorAll<HTMLElement>(".pl-row[data-row]"));
    const from = rows.indexOf(row);
    if (from < 0) return;
    row.classList.add("drag");
    this.drag = { from, y0: t.clientY, row, rows, id: row.dataset.row ?? "", to: from, touch: t.identifier };
    haptic("press");
  }

  private moveDrag(y: number) {
    const d = this.drag;
    if (!d) return;
    const dy = y - d.y0;
    d.row.style.transform = `translateY(${dy}px)`;
    const to = dropSlot(d.from, dy, d.row.offsetHeight || ROW_CSS, d.rows.length);
    if (to !== d.to) {
      d.rows.forEach((r) => r.classList.remove("drop", "dropb"));
      if (to !== d.from) d.rows[to].classList.add(to < d.from ? "drop" : "dropb");
      d.to = to;
    }
    // near the list's edges the list scrolls under the finger
    const l = this.listEl;
    if (l) {
      const r = l.getBoundingClientRect();
      if (y < r.top + 30) l.scrollTop -= 8;
      else if (y > r.bottom - 30) l.scrollTop += 8;
    }
  }

  private endDrag(drop: boolean) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    d.row.style.transform = "";
    d.row.classList.remove("drag");
    d.rows.forEach((r) => r.classList.remove("drop", "dropb"));
    if (drop && d.to !== d.from && this.spec?.onReorder) {
      this.stats.reorders++;
      this.spec.onReorder(d.id, d.to);
    }
  }
}

/** Buttons and rows are at least this big (CSS px): exported for the tests. */
export const LIST_SIZES = { row: ROW_CSS, button: BTN_CSS };

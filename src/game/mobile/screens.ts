// PHONE MODE: the menu screens laid out for a phone, from outside (phones only; no scene file is edited). Each screen
// is re-laid out right after the game builds it (its scene's create / render / select, wrapped once), so every tap
// target in a menu gets at least 44 CSS px (the readability tap snap gives each control a 44 px tap area as long as
// its neighbours are at least 44 px away) and nothing overlaps when "Bigger text" raises the fonts:
//
//   Title       the menu in two columns of 48 px rows (CONTINUE across the top), the ADD TO HOME SCREEN corner
//               button 44 px tall, the key line gone (touch wording)
//   Menu        pause: two columns of 48 px rows under the objective (which wraps on its own lines, never into
//               RESUME), plus 📱 PHONE SETTINGS; settings: two columns of rows with 44 px − / + buttons, a 📱 PHONE
//               tab (the Phone settings page), no "Lock mouse"; the death menu, the difficulty and banter pages: 48 px
//               rows; every page's bottom buttons 44 px
//   CharSelect  the details panel re-flowed top to bottom (no "Proctus covers as" over the quote), PLAY AS 44 px
//   Difficulty / Banter   the cards wider and as tall as their words, the notes under them, bottom buttons 44 px
//   Slots       each slot's lines re-stacked to fit the bigger text, 🗑 44 px, BACK 44 px
//   TV          the subtitles are reading text (16 CSS px with "Bigger text")
//   Home        the laptop's group chat: the messages at reading size, newest at the bottom, as many as fit
//
// When "Bigger text" (or the canvas scale) changes, the open menu is drawn again (readability.onChange).
import Phaser from "phaser";
import { MenuScene } from "../scenes/MenuScene";
import { TitleScene } from "../scenes/TitleScene";
import { CharSelectScene } from "../scenes/CharSelectScene";
import { SaveSlotsScene } from "../scenes/SaveSlotsScene";
import { HomeScene } from "../scenes/HomeScene";
import { button } from "../ui/theme";
import { buttonsIn, isGameButton, resizeButton, type GameButton } from "./canvasUi";
import { gamePx, markReading, readability, type Readability } from "./readability";
import { wordText } from "./wording";
import { charTapStarts } from "./listLogic";

type Bag = Record<string, any>;
const W = 960;
const H = 540;
/** The home-indicator strip (CSS px) nothing tappable may sit in. */
const BOTTOM_CSS = 21;

/** The canvas scale now (CSS px per game px). */
function kNow(): number {
  return readability()?.k ?? 0.72;
}

/** Game px for `css` CSS px now. */
const g = (css: number) => gamePx(kNow(), css);

/** The lowest a tappable thing's bottom edge may go (game px): above the home-indicator strip. */
function safeBottom(): number {
  return H - g(BOTTOM_CSS) - 4;
}

/** Find a direct Text child whose text matches. */
function textIn(list: readonly unknown[], re: RegExp): Phaser.GameObjects.Text | null {
  for (const o of list as Bag[]) if (o?.type === "Text" && re.test(o.text)) return o as Phaser.GameObjects.Text;
  return null;
}

/** Resize a panel made by theme.ts's panel() (a NineSlice; the Graphics fallback is hidden and redrawn). */
function fitPanel(scene: Phaser.Scene, root: Phaser.GameObjects.Container | null, p: Bag | undefined, x: number, y: number, w: number, h: number) {
  if (!p) return;
  if (p.type === "NineSlice") {
    p.setSize(w, h);
    p.setPosition(x + w / 2, y + h / 2);
    return;
  }
  if (p.type === "Graphics" && root) {
    p.clear();
    p.fillStyle(0x141628, 0.95);
    p.fillRoundedRect(x, y, w, h, 10);
    p.lineStyle(2, 0xffd23f, 0.9);
    p.strokeRoundedRect(x, y, w, h, 10);
  }
  void scene;
}

/**
 * Lay buttons out in a grid (column-major: down the first column, then the next), each `bh` tall, rows `pitch` apart,
 * centred on `xs`, from `top`.
 */
function grid(btns: GameButton[], xs: number[], top: number, pitch: number, bh: number, bw: number) {
  const rows = Math.ceil(btns.length / xs.length);
  btns.forEach((b, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    resizeButton(b, bw, bh);
    b.setPosition(xs[col], top + row * pitch + pitch / 2);
  });
}

/** Rows that fit between `top` and `bottom`: the pitch (at least 48 CSS px, at most `maxCss`). */
function pitchFor(rows: number, top: number, bottom: number, maxCss = 56): number {
  const want = Math.floor((bottom - top) / Math.max(1, rows));
  return Math.max(g(48), Math.min(g(maxCss), want));
}

/** A menu button's word: a bit bigger than small print (12.5 CSS px with "Bigger text"; the floor draws it). */
function bigLabel(b: GameButton) {
  markReading(b.label, "button");
}

/** A bottom button: at least 44 CSS px tall, its bottom edge above the home-indicator strip. */
function liftButton(b: GameButton, w?: number) {
  const h = Math.max(b.height, g(44));
  resizeButton(b, w ?? b.width, h);
  const maxY = safeBottom() - h / 2;
  if (b.y > maxY) b.setY(maxY);
}

// ------------------------------------------------------------------ the pause menu and its pages (MenuScene)

type Menu = Phaser.Scene & Bag;

let openPhonePage: ((from: "pause" | "settings") => void) | null = null;

function layoutMenu(m: Menu) {
  const root = m.root as Phaser.GameObjects.Container;
  if (!root) return;
  const mode = m.mode as string;
  if (mode === "pause") return layoutPause(m, root);
  if (mode === "settings") return layoutSettings(m, root);
  if (mode === "death" || mode === "banter" || mode === "difficulty" || mode === "tribunal") return layoutList(m, root, mode);
  // every other page (log, quests, controls...): its bottom buttons 44 px and out of the bottom strip
  for (const b of buttonsIn(root.list)) if (b.y > 440) liftButton(b);
}

function layoutPause(m: Menu, root: Phaser.GameObjects.Container) {
  const list = root.list;
  const btns = buttonsIn(list);
  // 📱 PHONE SETTINGS, right after SETTINGS (the Phone settings page)
  const settingsAt = btns.findIndex((b) => /^SETTINGS$/.test(b.label.text));
  if (openPhonePage && !btns.some((b) => /PHONE SETTINGS/.test(b.label.text))) {
    const pb = button(m, 0, 0, "📱 PHONE SETTINGS", () => openPhonePage?.("pause"), { w: 400, h: 40 }) as GameButton;
    const after = settingsAt >= 0 ? btns[settingsAt] : btns[0];
    root.addAt(pb, after ? root.getIndex(after) + 1 : root.list.length);
    btns.splice(settingsAt >= 0 ? settingsAt + 1 : btns.length, 0, pb);
  }
  const title = textIn(list, /^PAUSED$/);
  const obj = textIn(list, /^Objective:/);
  const margin = 10;
  fitPanel(m, root, list.find((o) => (o as Bag).type === "NineSlice" || (o as Bag).type === "Graphics") as Bag, margin, margin, W - 2 * margin, H - 2 * margin);
  let top = margin + 6;
  if (title) {
    title.setY(top + title.height / 2);
    top += title.height;
  }
  if (obj) {
    obj.setWordWrapWidth(W - 80).setOrigin(0.5, 0).setY(top + 2);
    top = obj.y + obj.height;
  }
  top += g(6);
  // one column for a few rows, two for more, three when two would squeeze the rows under 48 CSS px
  let cols = btns.length > 5 ? 2 : 1;
  if (cols === 2 && (safeBottom() - top) / Math.ceil(btns.length / 2) < g(48)) cols = 3;
  const rows = Math.ceil(btns.length / cols);
  const pitch = pitchFor(rows, top, safeBottom(), 58);
  // (each row drawn at least 44 CSS px; up to 12 px between rows: SAVE GAME and QUIT TO TITLE are never a slip
  // apart, research S13)
  const bh = Math.max(g(44), pitch - g(12));
  for (const b of btns) bigLabel(b);
  const cw = cols === 3 ? 296 : cols === 2 ? 440 : 520;
  const xs = cols === 3 ? [W / 2 - 306, W / 2, W / 2 + 306] : cols === 2 ? [W / 2 - 228, W / 2 + 228] : [W / 2];
  grid(btns, xs, top, pitch, bh, cw);
}

function layoutSettings(m: Menu, root: Phaser.GameObjects.Container) {
  const list = root.list as Bag[];
  const btns = buttonsIn(list);
  const margin = 10;
  fitPanel(m, root, list.find((o) => o.type === "NineSlice" || o.type === "Graphics"), margin, margin, W - 2 * margin, H - 2 * margin);
  const title = textIn(list, /^SETTINGS$/);
  if (title) title.setY(margin + 4 + title.height / 2);
  const tabY = (title ? title.y + title.height / 2 : 40) + g(26);
  // the tabs: the game's two, and 📱 PHONE (the Phone settings page)
  const tabs = btns.filter((b) => Math.abs(b.y - 104) < 2);
  if (openPhonePage && tabs.length === 2) {
    const pb = button(m, 0, 0, "📱 PHONE", () => openPhonePage?.("settings"), { w: 190, h: 32, size: 14, color: 0x1e3a5f }) as GameButton;
    root.addAt(pb, root.getIndex(tabs[1]) + 1);
    tabs.push(pb);
  }
  tabs.forEach((b, i) => {
    resizeButton(b, 280, g(44));
    b.setPosition(W / 2 + (i - (tabs.length - 1) / 2) * 296, tabY);
  });
  // the bottom row: CONTROLS, ◀ BACK
  const bottom = btns.filter((b) => b.y > 440);
  const bh = g(44);
  const by = safeBottom() - bh / 2;
  bottom.forEach((b, i) => {
    resizeButton(b, 240, bh);
    b.setPosition(W / 2 + (i - (bottom.length - 1) / 2) * 260, by);
  });
  // the rows: label, value, − and + share a y (from 152, 38 apart); lay them out in two columns
  const rowsAt = new Map<number, Bag[]>();
  for (const o of list) {
    if (o === title || tabs.includes(o as GameButton) || bottom.includes(o as GameButton)) continue;
    if (!(o.type === "Text" || isGameButton(o)) || o.y < 140 || o.y > 440) continue;
    const y = Math.round(o.y);
    if (!rowsAt.has(y)) rowsAt.set(y, []);
    rowsAt.get(y)!.push(o);
  }
  // (a mouse lock makes no sense on a phone)
  const rows = [...rowsAt.entries()].sort((a, b) => a[0] - b[0]).map(([, os]) => os);
  const shown = rows.filter((os) => {
    const lab = os.find((o) => o.type === "Text" && o.originX === 0);
    if (lab && /^Lock mouse/.test(lab.text)) {
      for (const o of os) o.setVisible(false);
      for (const o of os) if (isGameButton(o)) o.bg.disableInteractive();
      return false;
    }
    return true;
  });
  const top = tabY + g(22) + g(6);
  const per = Math.ceil(shown.length / 2);
  const pitch = pitchFor(per, top, by - bh / 2 - g(4), 60);
  shown.forEach((os, i) => {
    const col = Math.floor(i / per);
    const y = top + (i % per) * pitch + pitch / 2;
    const x0 = col === 0 ? 24 : W / 2 + 12;
    const lab = os.find((o) => o.type === "Text" && o.originX === 0) as Phaser.GameObjects.Text | undefined;
    const val = os.find((o) => o.type === "Text" && o.originX !== 0) as Phaser.GameObjects.Text | undefined;
    const pm = os.filter(isGameButton) as GameButton[];
    const s = g(44);
    if (lab) lab.setPosition(x0 + 4, y).setWordWrapWidth(pm.length ? 236 : 420);
    if (pm.length === 2) {
      resizeButton(pm[0], s, s);
      resizeButton(pm[1], s, s);
      pm[0].setPosition(x0 + 270, y);
      pm[1].setPosition(x0 + 420, y);
      if (val) val.setPosition(x0 + 345, y);
    }
  });
}

/** Death, banter, difficulty, tribunal: the rows 48 CSS px apart, everything below them moved down to fit. */
function layoutList(m: Menu, root: Phaser.GameObjects.Container, mode: string) {
  const list = root.list as Bag[];
  const btns = buttonsIn(list);
  const back = btns.filter((b) => /BACK/.test(b.label.text) && b.y > 440);
  const rows = btns.filter((b) => !back.includes(b)).sort((a, b) => a.y - b.y);
  if (!rows.length) return;
  const margin = 10;
  fitPanel(m, root, list.find((o) => o.type === "NineSlice" || o.type === "Graphics"), margin, margin, W - 2 * margin, H - 2 * margin);
  // what sits above the rows stays (moved up a little); what sits below them follows them down
  const first = rows[0].y - rows[0].height / 2;
  const last = rows[rows.length - 1].y + rows[rows.length - 1].height / 2;
  const above = list.filter((o) => o.type === "Text" && o.y < first - 2);
  const below = list.filter((o) => o.type === "Text" && o.y > last + 2 && !rows.some((b) => (b.list as unknown[]).includes(o)));
  let top = margin + 4;
  for (const t of above.sort((a, b) => a.y - b.y)) {
    const oy = (t.originY ?? 0) * t.height;
    t.setY(top + oy);
    if (t.style?.wordWrapWidth) t.setWordWrapWidth(W - 80);
    top += t.height + 4;
  }
  top += g(4);
  const bottomLimit = back.length ? safeBottom() - g(44) - 4 : safeBottom();
  let pitch = g(mode === "death" ? 54 : 50);
  const bh = g(44);
  // (one column if it fits with room for what follows, else two: the difficulty page's five levels at 340 tall)
  const cols = rows.length > 3 && top + rows.length * pitch + g(40) > bottomLimit ? 2 : 1;
  const per = Math.ceil(rows.length / cols);
  if (cols === 2) pitch = Math.max(g(48), Math.min(pitch, Math.floor((bottomLimit - top - g(40)) / per)));
  rows.forEach((b, i) => {
    const col = Math.floor(i / per);
    resizeButton(b, cols === 2 ? 440 : Math.max(b.width, 460), bh);
    b.setPosition(cols === 2 ? W / 2 + (col === 0 ? -228 : 228) : W / 2, top + (i % per) * pitch + pitch / 2);
  });
  let y = top + per * pitch + 4;
  // (a box drawn behind a tip moves with its text)
  const boxes = list.filter((o) => o.type === "Rectangle" && o.y > last + 2 && !o.input);
  for (const t of below.sort((a, b) => a.y - b.y)) {
    t.setWordWrapWidth?.(W - 80);
    const oy = (t.originY ?? 0) * t.height;
    const ny = Math.min(y + oy, bottomLimit - t.height + oy);
    const dy = ny - t.y;
    for (const r of boxes) if (Math.abs(r.y - t.y) < 4) r.setY(r.y + dy).setSize?.(Math.max(r.width, W - 60), t.height + 16);
    t.setY(ny);
    y = ny - oy + t.height + 4;
  }
  for (const b of back) {
    liftButton(b, 240);
    b.setY(safeBottom() - b.height / 2);
  }
}

// ------------------------------------------------------------------ Difficulty and Banter (cards to pick from)

/**
 * The cards: wider, the number on the left, the name with its tag under it in a column, the blurb beside them, each
 * card as tall as its words; then the notes under the cards; the bottom buttons 44 px and out of the bottom strip.
 */
function layoutCards(sc: Phaser.Scene & Bag) {
  const rows = (sc.rows as { box: Bag; mark: Bag }[]) ?? [];
  if (!rows.length) return;
  const kids = sc.children.list as Bag[];
  const x0 = 26;
  const RW = W - 2 * x0;
  const nameW = 230;
  // ◀ back to the top left (where a phone's back is), the next step bottom right
  const btns = buttonsIn(kids).filter((b) => b.y > 400);
  const back = btns.find((b) => /◀/.test(b.label.text));
  const next = btns.find((b) => b !== back);
  if (back) {
    resizeButton(back, 210, g(44));
    back.setPosition(12 + 105, 6 + g(44) / 2);
  }
  if (next) liftButton(next);
  const head = textIn(kids, /^CHOOSE /);
  const sub = textIn(kids, /run\. /);
  if (head) head.setPosition(W / 2 + 60, 8 + head.height / 2);
  if (sub && head) sub.setPosition(W / 2 + 60, head.y + head.height / 2 + 1);
  let y = Math.max(back ? 6 + g(44) : 0, sub ? sub.y + sub.height : 70) + 4;
  const inRow = new Set<Bag>();
  for (const { box, mark } of rows) {
    const bx = box.x;
    const by = box.y;
    const texts = kids.filter((o) => o.type === "Text" && o !== mark && o.x >= bx - 2 && o.x <= bx + box.width + 2 && o.y >= by - 2 && o.y <= by + box.height + 2);
    for (const t of texts) inRow.add(t);
    const num = texts.find((t) => /^\d$/.test(t.text));
    const blurb = texts.find((t) => t.style?.wordWrapWidth);
    const tag = texts.find((t) => t.originX === 1);
    const name = texts.find((t) => t !== num && t !== blurb && t !== tag);
    if (blurb) blurb.setWordWrapWidth(RW - nameW - 20);
    if (tag) tag.setOrigin(0, 0);
    const left = (name?.height ?? 0) + (tag ? tag.height + 2 : 0);
    const h = Math.max(g(44), left + 10, (blurb?.height ?? 0) + 10);
    box.setPosition(x0, y).setSize(RW, h);
    box.updateDisplayOrigin?.();
    if (box.input?.hitArea) {
      box.input.hitArea.width = RW;
      box.input.hitArea.height = h;
    }
    if (num) num.setPosition(x0 + 30, y + h / 2);
    if (name) name.setPosition(x0 + 62, y + (h - left) / 2);
    if (tag && name) tag.setPosition(x0 + 62, name.y + name.height + 2);
    if (blurb) blurb.setPosition(x0 + nameW, y + (h - blurb.height) / 2);
    mark.setPosition(x0 - 13, y + h / 2);
    y += h + 3;
  }
  // the notes under the cards, beside the next button; what doesn't fit goes, the how-to line first
  const notes = kids
    .filter((o) => o.type === "Text" && !inRow.has(o) && o !== sub && o !== head && o.y > 300 && !rows.some((r) => r.mark === o) && !btns.some((b) => (b.list as unknown[]).includes(o)) && o.text.trim())
    .sort((a, b) => a.y - b.y);
  const right = next ? next.x - next.width / 2 - 10 : W - 20;
  const nextTop = next ? next.y - next.height / 2 : H;
  const howTo = notes.find((t) => /^Tap one, then/.test(t.text));
  // (the multipliers line: the blurbs already say it in words)
  const stats = notes.find((t) => /^\d\/\d vs /.test(t.text));
  const place = (...skip: (Bag | undefined)[]) => {
    let ny = y + 2;
    for (const t of notes) {
      if (skip.includes(t)) {
        t.setVisible(false);
        continue;
      }
      // (the whole width above the next button, beside it below its top)
      t.setOrigin(0, 0).setWordWrapWidth(W - 2 * x0).setPosition(x0, ny).setVisible(true);
      if (ny + t.height > nextTop - 2) t.setWordWrapWidth(right - x0);
      ny += t.height + 1;
    }
    return ny;
  };
  if (place() > H - 4 && place(howTo) > H - 4) place(howTo, stats);
}

// ------------------------------------------------------------------ save slots

/** A slot's five small lines become four (chapter and place on one), the objective kept to one line, 🗑 44 px. */
function layoutSlots(sl: Phaser.Scene & Bag) {
  const list = (sl.root?.list as Bag[]) ?? [];
  const rows = list.filter((o) => o.type === "Rectangle" && o.width >= 600 && o.height >= 80 && o.height <= 100);
  for (const bg of rows) {
    const y = bg.y;
    const left = bg.x - bg.width / 2;
    const near = (dy: number) => list.filter((o) => o.type === "Text" && Math.abs(o.y - (y + dy)) < 1.5);
    const l1 = near(-40);
    if (!l1.length) continue;
    const chapter = near(-22)[0];
    const where = near(-5)[0];
    const obj = near(11)[0];
    const bits = near(27)[0];
    const lh = Math.max(...l1.map((t) => t.height));
    const top = y - bg.height / 2 + 3;
    for (const t of l1) t.setY(top);
    const saved = l1.find((t) => t.originX === 1);
    const del = buttonsIn(list).find((b) => Math.abs(b.y - (y + 24)) < 2 && b.x > left + bg.width - 60);
    if (del) {
      const s = g(44);
      resizeButton(del, s, s);
      del.setPosition(left + bg.width - s / 2 - 6, y);
    }
    if (saved && del) saved.setX(del.x - del.width / 2 - 8);
    const tx = chapter?.x ?? left + 88;
    const right = (del ? del.x - del.width / 2 : left + bg.width) - 8;
    let ly = top + lh + 1;
    if (chapter) chapter.setY(ly);
    if (where && chapter) where.setPosition(chapter.x + chapter.width + 14, ly);
    ly += (chapter?.height ?? lh) + 1;
    if (obj) {
      obj.setY(ly).setFixedSize(Math.max(40, right - tx), 0);
      ly += obj.height + 1;
    }
    if (bits) bits.setY(ly);
  }
}

// ------------------------------------------------------------------ the title

function layoutTitle(t: Phaser.Scene) {
  const list = t.children.list as Bag[];
  const all = buttonsIn(list);
  const menu = all.filter((b) => Math.abs(b.x - W / 2) < 2 && b.y >= 200).sort((a, b) => a.y - b.y);
  // the title texts move up a little to make room
  const big = textIn(list, /^KRELWORLD$/);
  const sub = textIn(list, /^WONK 'TIL YOU KREZ$/);
  const tag = textIn(list, /^The craziest universe/);
  if (big) big.setY(56);
  if (sub) sub.setY(104);
  if (tag) tag.setY(122);
  const top = (tag ? tag.y + tag.height : 140) + g(4);
  const cont = menu[0] && /^CONTINUE/.test(menu[0].label.text) ? menu[0] : null;
  const rest = cont ? menu.slice(1) : menu;
  const rows = (cont ? 1 : 0) + Math.ceil(rest.length / 2);
  const pitch = pitchFor(rows, top, safeBottom(), 54);
  const bh = Math.max(g(44), pitch - g(10));
  for (const b of menu) bigLabel(b);
  let y = top;
  if (cont) {
    resizeButton(cont, 720, bh);
    cont.setPosition(W / 2, y + pitch / 2);
    y += pitch;
  }
  // two columns, across then down (NEW GAME next to LOAD, CHAPTER SELECT next to WATCH TV...)
  rest.forEach((b, i) => {
    resizeButton(b, 350, bh);
    b.setPosition(W / 2 + (i % 2 === 0 ? -182 : 182) * (rest.length === 1 ? 0 : 1), y + Math.floor(i / 2) * pitch + pitch / 2);
  });
  // the Add to Home Screen corner button: 44 px tall (P14)
  const ah = all.find((b) => /ADD TO HOME SCREEN/.test(b.label.text));
  if (ah) {
    const h = g(44);
    resizeButton(ah, 262, h);
    ah.setPosition(W - 140, 8 + h / 2);
  }
}

// ------------------------------------------------------------------ character select

/** The phone's character grid: smaller cards (3 x 3 of 118 x 114) so the details panel gets the width it needs. */
const CS = { x0: 12, y0: 80, cw: 118, ch: 112, gap: 6, face: 54 };
/** The details panel on a phone (the original: x 488, 456 wide). */
const CS_PANEL = { x: 388, w: 562 };

/** The face cards, once, after create(): every piece of a card moves and shrinks with it; ◀ BACK goes top left. */
function layoutCharGrid(cs: Phaser.Scene & Bag) {
  const cards = (cs.cards as Bag[]) ?? [];
  const kids = cs.children.list as Bag[];
  cards.forEach((card, i) => {
    const ox = card.x;
    const oy = card.y;
    const ow = card.width;
    const oh = card.height;
    const nx = CS.x0 + (i % 3) * (CS.cw + CS.gap);
    const ny = CS.y0 + Math.floor(i / 3) * (CS.ch + CS.gap);
    const fx = CS.cw / ow;
    const fy = CS.ch / oh;
    for (const o of kids) {
      if (o === card || o.parentContainer || typeof o.x !== "number") continue;
      if (o.x < ox || o.x > ox + ow || o.y < oy || o.y > oy + oh) continue;
      o.setPosition(nx + (o.x - ox) * fx, ny + (o.y - oy) * fy);
      if (o.type === "Image") o.setDisplaySize(CS.face, CS.face);
      // (a name a little wider than the card runs into the gap rather than onto the first name under it)
      if (o.type === "Text" && o.style?.wordWrapWidth) o.setWordWrapWidth(null);
    }
    card.setPosition(nx, ny);
    card.setSize(CS.cw, CS.ch);
    card.updateDisplayOrigin?.();
    if (card.input?.hitArea) {
      card.input.hitArea.width = CS.cw;
      card.input.hitArea.height = CS.ch;
    }
  });
  // ◀ BACK: top left, 44 px (where a phone's back is)
  for (const b of buttonsIn(kids)) {
    if (!/BACK/.test(b.label.text)) continue;
    resizeButton(b, 150, g(44));
    b.setPosition(12 + 75, 6 + g(44) / 2);
  }
  // (the kit line for a finished game sits under the grid)
  const kit = textIn(kids, /^🎒/);
  if (kit) kit.setPosition(CS.x0, CS.y0 + 3 * (CS.ch + CS.gap) + 2).setWordWrapWidth(3 * CS.cw + 2 * CS.gap);
}

/**
 * The details panel, after every select(): wider (the grid is smaller), the four stat bars in two columns, everything
 * flowed top to bottom with no overlaps ("Proctus covers as" never runs into the quote), PLAY AS under the grid.
 */
function layoutCharDetail(cs: Phaser.Scene & Bag) {
  const d = cs.detail as Phaser.GameObjects.Container;
  if (!d) return;
  const list = d.list as Bag[];
  const panel = list[0];
  const play = buttonsIn(list)[0];
  if (!panel || panel.type !== "Rectangle" || panel.__mfDone) return;
  panel.__mfDone = true;
  const dx = CS_PANEL.x - panel.x;
  const items = list.filter((o) => o !== panel && o !== play);
  for (const o of items) {
    o.setX(o.x + dx);
    if (o.type === "Text" && o.style?.wordWrapWidth) o.setWordWrapWidth(CS_PANEL.w - 32);
  }
  const top = panel.y;
  const bottom = H - 8;
  panel.setPosition(CS_PANEL.x, top).setSize(CS_PANEL.w, bottom - top);
  panel.updateDisplayOrigin?.();
  // the stat bars: a label and two rectangles per row; two to a row on a phone
  const labels = items.filter((o) => o.type === "Text" && /^(HEALTH|SPEED|DAMAGE|RANGE)$/.test(o.text));
  labels.forEach((t, j) => {
    const rects = items.filter((o) => o.type === "Rectangle" && Math.abs(o.y - (t.y + 3)) < 2);
    const bx = CS_PANEL.x + 16 + (j % 2) * 268;
    const y = labels[0].y + Math.floor(j / 2) * Math.max(18, t.height + 4);
    for (const r of rects) {
      const w0 = r.width;
      r.setPosition(bx + 74, y + Math.max(3, (t.height - 9) / 2)).setSize(Math.max(1, Math.round(w0 * 0.82)), r.height);
    }
    t.setPosition(bx, y);
  });
  // everything else, top to bottom in rows (a stat row's labels and bars together), with no overlaps
  const rows: Bag[][] = [];
  for (const o of items.slice().sort((a, b) => a.y - b.y)) {
    const r = rows.find((rr) => Math.abs(rr[0].y - o.y) <= 6);
    if (r) r.push(o);
    else rows.push([o]);
  }
  let y = top + 8;
  for (const r of rows) {
    const y0 = Math.min(...r.map((o) => o.y));
    const h = Math.max(...r.map((o) => (o.type === "Text" ? o.height : (o.height ?? 0) + 3)));
    for (const o of r) o.setY(o.y + (y - y0));
    y += h + 3;
  }
  // PLAY AS: under the grid, 44 px, out of the bottom strip
  if (play) {
    const bh = g(44);
    resizeButton(play, 3 * CS.cw + 2 * CS.gap, bh);
    play.setPosition(CS.x0 + (3 * CS.cw + 2 * CS.gap) / 2, safeBottom() - bh / 2);
    bigLabel(play);
  }
}

/**
 * P16: on a phone a tap on a face picks them and shows their details; PLAY AS starts with them (or a second tap on the
 * same face, as on the Difficulty and Banter screens, at least 300 ms after the first). Acts on release: a finger
 * that slides off a face does nothing. (On a laptop, hovering previews and a click picks at once, as before.)
 */

function tapThenPlay(cs: Phaser.Scene & Bag) {
  const cards = (cs.cards as Bag[]) ?? [];
  cs.__mfTapped = null;
  cs.__mfTappedAt = 0;
  cards.forEach((card, i) => {
    card.removeAllListeners("pointerover");
    card.removeAllListeners("pointerdown");
    let down = false;
    card.on("pointerdown", () => (down = true));
    card.on("pointerout", () => (down = false));
    card.on("pointerup", () => {
      if (!down) return;
      down = false;
      const now = cs.time.now as number;
      if (charTapStarts(i, cs.sel, cs.__mfTapped, now - cs.__mfTappedAt)) return cs.confirm();
      cs.select(i);
      cs.__mfTapped = i;
      cs.__mfTappedAt = now;
      // PLAY AS gives a little nod: that's the next step
      const play = buttonsIn((cs.detail?.list as unknown[]) ?? [])[0];
      if (play) cs.tweens.add({ targets: play, scale: { from: 1, to: 1.06 }, yoyo: true, repeat: 1, duration: 140 });
    });
  });
}

// ------------------------------------------------------------------ the Chapter Select password (title)

/**
 * The password box sits in the top quarter on a phone, where the landscape keyboard can't cover it (it opens over the
 * bottom half), and the text box is 44 px tall.
 */
function passwordUp(t: Phaser.Scene & Bag) {
  const kids = t.children.list as Bag[];
  const box = [...kids].reverse().find((o) => o.type === "Container" && o.depth === 1000 && (o.list as Bag[]).some((x) => x.type === "Text" && /CHAPTER SELECT/.test(x.text)));
  if (!box || box.__mfUp) return;
  box.__mfUp = true;
  const dy = -128;
  for (const o of box.list as Bag[]) if (!(o.type === "Rectangle" && o.width >= 900)) o.setY(o.y + dy);
  const inp = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).pop();
  if (!inp) return;
  const place = () => {
    const r = t.game.canvas.getBoundingClientRect();
    const sx = r.width / 960;
    const sy = r.height / 540;
    const h = Math.max(44, 32 * sy);
    Object.assign(inp.style, { left: `${r.left + 360 * sx}px`, top: `${r.top + (244 + dy) * sy - (h - 32 * sy) / 2}px`, width: `${240 * sx}px`, height: `${h}px` });
  };
  place();
  // (after the scene's own resize handler, which puts it back where a laptop has it)
  const again = () => setTimeout(place, 0);
  window.addEventListener("resize", again);
  const obs = new MutationObserver(() => {
    if (!inp.isConnected) {
      window.removeEventListener("resize", again);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// ------------------------------------------------------------------ Home's laptop (the group chat)

/** The group chat on the laptop: the messages at reading size, newest at the bottom, as many as fit. */
function layoutLaptop(h: Phaser.Scene) {
  if (!readability()?.on) return;
  const kids = h.children.list as Bag[];
  let root: Bag | null = null;
  for (let i = kids.length - 1; i >= 0 && !root; i--) if (kids[i].type === "Container" && textIn(kids[i].list, /^KRELWORLD GROUP CHAT$/)) root = kids[i];
  if (!root) return;
  const msgs = (root.list as Bag[]).filter((o) => o.type === "Text" && o.originY === 1 && o.style?.backgroundColor).sort((a, b) => b.y - a.y);
  let y = msgs.length ? msgs[0].y : 400;
  for (const t of msgs) {
    markReading(t as Phaser.GameObjects.Text);
    t.setY(y);
    t.setVisible(y - t.height >= 84);
    y -= t.height + 6;
  }
}

// ------------------------------------------------------------------ installing

export class PhoneScreens {
  constructor(
    readonly game: Phaser.Game,
    R: Readability,
    phonePage: (from: "pause" | "settings") => void,
  ) {
    openPhonePage = phonePage;
    patchScenes();
    // the open menu is drawn again when "Bigger text" or the canvas scale changes
    R.onChange(() => this.redraw());
  }

  /** Redraw what is open now (the pause menu or the settings it leads to, the title). */
  redraw() {
    const mgr = this.game.scene;
    try {
      if (mgr.isActive("Menu")) {
        const m = mgr.getScene("Menu") as Menu;
        m.render(m.mode);
      }
      if (mgr.isActive("Title")) (mgr.getScene("Title") as Phaser.Scene).scene.restart();
      if (mgr.isActive("CharSelect")) {
        const c = mgr.getScene("CharSelect") as Phaser.Scene & Bag;
        c.select(c.sel);
      }
    } catch (e) {
      console.warn("phone screens redraw", e);
    }
  }
}

let patched = false;

function wrap(proto: Bag, name: string, after: (self: Bag, args: unknown[]) => void) {
  const inner = proto[name];
  if (typeof inner !== "function") return;
  proto[name] = function (this: Bag, ...args: unknown[]) {
    const r = inner.apply(this, args);
    try {
      after(this, args);
    } catch (e) {
      console.warn(`phone layout (${name})`, e);
    }
    return r;
  };
}

function patchScenes() {
  if (patched) return;
  patched = true;
  wrap(MenuScene.prototype as unknown as Bag, "render", (m) => layoutMenu(m as Menu));
  wrap(TitleScene.prototype as unknown as Bag, "create", (t) => layoutTitle(t as unknown as Phaser.Scene));
  wrap(CharSelectScene.prototype as unknown as Bag, "select", (c) => layoutCharDetail(c as Phaser.Scene & Bag));
  wrap(SaveSlotsScene.prototype as unknown as Bag, "render", (sl) => {
    if (readability()?.on) layoutSlots(sl as Phaser.Scene & Bag);
    for (const b of buttonsIn(((sl.root as Bag)?.list as unknown[]) ?? [])) if (b.y > 440 && b.x > 300 && b.x < 660) liftButton(b);
  });
  wrap(HomeScene.prototype as unknown as Bag, "laptopPanel", (h) => layoutLaptop(h as unknown as Phaser.Scene));
  wrap(CharSelectScene.prototype as unknown as Bag, "create", (c) => {
    layoutCharGrid(c as Phaser.Scene & Bag);
    // (create() drew the first details before the grid moved: again, now)
    layoutCharDetail(c as Phaser.Scene & Bag);
    tapThenPlay(c as Phaser.Scene & Bag);
  });
  wrap(TitleScene.prototype as unknown as Bag, "askPassword", (t) => passwordUp(t as Phaser.Scene & Bag));
}

/** Scenes that are only a create(): their bottom buttons, and the TV's subtitles. Called when a scene is created. */
export function onSceneCreate(scene: Phaser.Scene) {
  const key = scene.sys.settings.key;
  if (key === "Difficulty" || key === "Banter") layoutCards(scene as Phaser.Scene & Bag);
  // the Lair's "Esc: skip scene": on a phone a button that does what Esc does there (the scene's own finish(true))
  if (key === "Lair") {
    const sc = scene as Phaser.Scene & Bag;
    const t = (scene.children.list as Bag[]).find((o) => o.type === "Text" && /^(?:Esc: skip scene|SKIP SCENE ▸▸)$/.test(o.text));
    if (t && typeof sc.finish === "function") {
      wordText(t as Phaser.GameObjects.Text);
      t.setPadding(10, 8, 10, 8).setBackgroundColor("#000000aa").setY(6).setInteractive({ useHandCursor: true });
      let down = false;
      t.on("pointerdown", () => (down = true));
      t.on("pointerup", () => {
        if (!down) return;
        down = false;
        sc.finish(true);
      });
    }
  }
  // the archive's ◀ LEAVE: 44 px, out of the home-indicator strip
  if (key === "Archive") for (const b of buttonsIn(scene.children.list)) if (/LEAVE/.test(b.label.text)) liftButton(b, 200);
  if (key === "TV") {
    markReading((scene as Bag).subs as Phaser.GameObjects.Text);
    // the key under each of the telly's buttons ("Space / click", "Tab", "D", "Esc"), and only those: the four
    // captions in the button column right of the picture (the telly's shows are never touched)
    const ui = (scene as Bag).ui as Phaser.GameObjects.Container | undefined;
    for (const o of [...((ui?.list as Bag[]) ?? []), ...(scene.children.list as Bag[])]) {
      const walk = (x: Bag) => {
        if (x.type === "Container") return (x.list as Bag[]).forEach(walk);
        if (x.type === "Text" && /^(?:Space \/ click|Tab|D|Esc)$/.test(x.text) && (x.parentContainer?.x ?? 0) + x.x > 780) wordText(x as Phaser.GameObjects.Text);
      };
      walk(o);
    }
  }
}

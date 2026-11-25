// PHONE MODE: conversations on a phone. Every conversation in the game (the town's Dialogue overlay, meetings,
// cutscenes, vignettes, the Lair, interiors, the Kreddle raid...) is drawn by one class, ui/DialogueBox.ts; this
// module drives it from outside, phones only (nothing in that file is edited):
//
//  - Tap anywhere still advances, and a tap while a line is typing completes it (the box's own rules, kept).
//  - SKIP / LOG / AUTO pills on the box's top edge (and II where the scene has a pause menu: meetings, cutscenes,
//    vignettes, as the laptop's Esc). SKIP is the laptop's Tab: it runs to the next choice or the end of the script,
//    every skipped line still does what it does (flags, sounds, callbacks, the log), and it never skips a choice (the
//    box stops skipping at every choice, reaction, broadcast and Kreltality). LOG lists the lines already shown in this
//    conversation in a native-scroll list. AUTO moves on after the voice has finished (or a reading time).
//  - Reading text at 16 CSS px when "Bigger text" is on: the box's own pagination is fed the phone sizes (the static
//    `layout`), so a long line is split into more boxes; the words are identical (the box's own page breaks).
//  - Choices: rows at least 48 CSS px tall, nearly full width, no key numbers, above the box when they fit and over
//    the whole screen when they don't; a choice needs a deliberate tap (pressed and released on the same row, at
//    least 180 ms after the rows appeared).
//  - Narrator control tips in touch wording (wording.ts NARRATOR_TIPS; never a character's line).
//  - Android Back: closes the log; in a conversation with a pause menu it opens it (the laptop's Esc); never skips.
import Phaser from "phaser";
import { DialogueBox } from "../ui/DialogueBox";
import { dialogueLog, type LogEntry } from "../ui/dialogueLog";
import { voice } from "../audio/Voice";
import { G } from "../G";
import { PIXEL_BOLD, PIXEL_FONT } from "../ui/theme";
import { gamePx, markReading, readability } from "./readability";
import { narratorTip, wordText } from "./wording";
import { bindTap, keepTouches } from "./domTap";
import { sizeShape } from "./canvasUi";
import { haptic } from "./haptics";
import type { Viewport } from "./layout";
import { autoReady, backAction, CHOICE_GAP_CSS, CHOICE_ROW_CSS, choiceTapCounts, linesThatFit, pillRow, planChoices, type AutoClock, type RowPress } from "./dialogueLogic";

type Bag = Record<string, any>;
/** The box with its private parts reachable (TypeScript's `private` is compile-time only). */
type Box = Bag;

const W = 960;
/** The box's frame in its own space (DialogueBox.drawBox): x 16, y 362, 928 x 166. */
const FRAME = { x: 16, y: 362, w: 928, h: 166 };
/** The lowest a line of text may reach in the box. */
const BODY_BOTTOM = 520;
/** Scenes whose dialogue box opens the pause menu on Esc (as DialogueBox's own PAUSABLE). */
export const PAUSABLE_SCENES = new Set(["Meeting", "Vignette", "Cutscene"]);

/** Scenes that cover a conversation when they run (its pills hide). */
const COVERING = ["Menu", "Slots", "TV", "KrelCue", "WeaponPick"];

/** Every box that has played and is not destroyed, oldest first. */
const boxes: Box[] = [];
let patched = false;

// ------------------------------------------------------------------ the phone sizes for the box

interface Metrics {
  key: string;
  read: number;
  name: number;
  spacing: number;
  lineH: number;
  nameH: number;
  bodyTop: number;
}
let metrics: Metrics | null = null;

/** The box's phone sizes now (null when "Bigger text" is off: the box keeps its own). */
function phoneMetrics(scene?: Phaser.Scene | null): Metrics | null {
  const R = readability();
  if (!R || !R.on) return null;
  const read = R.readPx(16);
  const name = R.namePx(16);
  const key = `${read}|${name}`;
  if (metrics && metrics.key === key) return metrics;
  if (!scene) return metrics;
  const spacing = Math.max(4, Math.round(read * 0.22));
  const m = scene.make.text({ x: -9999, y: -9999, text: "Ag", style: { fontFamily: PIXEL_FONT, fontSize: `${read}px` } }, false);
  const lineH = m.height;
  m.setStyle({ fontFamily: PIXEL_BOLD, fontSize: `${name}px` });
  const nameH = m.height;
  m.destroy();
  metrics = { key, read, name, spacing, lineH, nameH, bodyTop: FRAME.y + 8 + nameH + 2 };
  return metrics;
}

/** DialogueBox.layout on a phone with "Bigger text" on: the reading size, and as many lines as fit in the box. */
function phoneLayout(kind: "speech" | "dir" | "notify") {
  const m = phoneMetrics();
  if (!m) return null;
  const style = { fontFamily: PIXEL_FONT, fontSize: `${m.read}px`, lineSpacing: m.spacing };
  // (the Messenger bubble's blue body runs from 196 to 286; its text starts at 208)
  if (kind === "notify") return { width: 576, lines: linesThatFit(208, 282, m.lineH, m.spacing), style };
  if (kind === "dir") return { width: W - 80, lines: linesThatFit(384, BODY_BOTTOM, m.lineH, m.spacing), style };
  return { width: W - 200, lines: linesThatFit(m.bodyTop, BODY_BOTTOM, m.lineH, m.spacing), style };
}

// ------------------------------------------------------------------ patching the box (once, phones only)

function lastLogEntry(): LogEntry | null {
  const log = dialogueLog();
  return log.length ? log[log.length - 1] : null;
}

function patchBoxes() {
  if (patched) return;
  patched = true;
  const P = DialogueBox.prototype as unknown as Bag;
  const C = DialogueBox as unknown as Bag;

  const play = P.play;
  P.play = function (this: Box, ...a: unknown[]) {
    const i = boxes.indexOf(this);
    if (i >= 0) boxes.splice(i, 1);
    boxes.push(this);
    this.__mfConvStart = lastLogEntry();
    prepare(this);
    return play.apply(this, a);
  };
  const destroy = P.destroy;
  P.destroy = function (this: Box, ...a: unknown[]) {
    const i = boxes.indexOf(this);
    if (i >= 0) boxes.splice(i, 1);
    return destroy.apply(this, a);
  };
  const layout = C.layout;
  C.layout = function (this: unknown, kind: "speech" | "dir" | "notify") {
    return phoneLayout(kind) ?? layout.call(this, kind);
  };
  const shownText = P.shownText;
  P.shownText = function (this: Box, rl: Bag) {
    const r = shownText.call(this, rl);
    // hard rule 3's exception: the narrator's control tips in touch wording (never a character's line)
    if (rl && (rl.dir || rl.s === "NARRATOR") && r && typeof r.text === "string") r.text = narratorTip(r.text);
    return r;
  };
  const renderLine = P.renderLine;
  P.renderLine = function (this: Box, ...a: unknown[]) {
    const r = renderLine.apply(this, a);
    try {
      afterLine(this, a[0] as Bag);
    } catch {
      /* the box as it was */
    }
    return r;
  };
  const showNotify = P.showNotify;
  P.showNotify = function (this: Box, ...a: unknown[]) {
    const r = showNotify.apply(this, a);
    try {
      for (const o of this.overlay.list as Bag[]) if (o.type === "Text" && o.style?.wordWrapWidth >= 500) markReading(o as Phaser.GameObjects.Text);
    } catch {
      /* as it was */
    }
    return r;
  };
  const showChoices = P.showChoices;
  P.showChoices = function (this: Box, ...a: unknown[]) {
    // the question is shown whole before the rows (a tap meant to finish it can't land on a row)
    if (this.typing) this.finishTyping();
    const p = showChoices.apply(this, a);
    try {
      phoneChoices(this);
    } catch (e) {
      console.warn("phone choices", e);
    }
    return p;
  };
  const showReaction = P.showReaction;
  P.showReaction = function (this: Box, ...a: unknown[]) {
    const p = showReaction.apply(this, a);
    try {
      phoneReaction(this);
    } catch (e) {
      console.warn("phone reaction", e);
    }
    return p;
  };
  const clearOverlay = P.clearOverlay;
  P.clearOverlay = function (this: Box, ...a: unknown[]) {
    restoreBox(this);
    return clearOverlay.apply(this, a);
  };
}

/** A box that is about to play: reading roles on its texts, touch wording on its footer. */
function prepare(b: Box) {
  if (b.__mfPrepared) return;
  b.__mfPrepared = true;
  markReading(b.bodyText);
  markReading(b.nameText, "name");
  // "▼ E / Space · Tab skip" → "▼"
  if (b.hint) wordText(b.hint);
  phoneMetrics(b.scene);
  liftHint(b);
}

/** The page's safe bottom (CSS px: above the home-indicator strip), set by PhoneDialogue. */
let safeBottomCss: (() => number) | null = null;

/** The box's ▼ marker sits in the bottom 22 game px: on a phone it goes up out of the home-indicator strip (P15). */
function liftHint(b: Box) {
  const h = b.hint as Phaser.GameObjects.Text | undefined;
  if (!h || !safeBottomCss) return;
  const cb = b.scene.game.scale.canvasBounds;
  const k = cb.width / 960 || 0.72;
  const ry = ((b.root as Bag).y as number) ?? 0;
  const maxY = (safeBottomCss() - cb.y) / k - ry - h.height * (1 - (h.originY ?? 0.5)) - 2;
  if (h.y > maxY) h.setY(maxY);
}

/** After a line is drawn: with "Bigger text" on, the speaker's title goes on the name's row and the line under it. */
function afterLine(b: Box, rl: Bag | undefined) {
  if (!rl || rl.notify || rl.dir || rl.s === "NARRATOR") return;
  const m = phoneMetrics(b.scene);
  if (!m) return;
  const name = b.nameText as Phaser.GameObjects.Text;
  const title = b.titleText as Phaser.GameObjects.Text;
  name.setY(FRAME.y + 8);
  title.setPosition(name.x + name.width + 14, name.y + Math.max(0, name.height - title.height) - 1);
  (b.bodyText as Phaser.GameObjects.Text).setY(m.bodyTop);
}

// ------------------------------------------------------------------ choices and reactions

/** The box's own parts, hidden while choices take the screen (its dim stays; the question becomes their header). */
const BOX_PARTS = ["frame", "portraitFrame", "portrait", "nameText", "titleText", "hint"];

function restoreBox(b: Box) {
  const hidden = b.__mfHidden as Map<Bag, boolean> | undefined;
  if (!hidden) return;
  b.__mfHidden = undefined;
  for (const [o, vis] of hidden) o.setVisible?.(vis);
}

function hideBox(b: Box) {
  if (b.__mfHidden) return;
  const hidden = new Map<Bag, boolean>();
  for (const k of BOX_PARTS) {
    const o = b[k] as Bag | null | undefined;
    if (!o || typeof o.setVisible !== "function") continue;
    hidden.set(o, !!o.visible);
    o.setVisible(false);
  }
  b.__mfHidden = hidden;
}

/** A deliberate tap only: pressed and released on the same target, CHOICE_GUARD_MS after they appeared. */
function guardTaps(b: Box, targets: Bag[]) {
  let down: RowPress | null = null;
  // (kept on the box, so a test can stand in "the rows just appeared")
  b.__mfChoiceShownAt = performance.now();
  targets.forEach((o, i) => {
    o.removeAllListeners("pointerdown");
    o.on("pointerdown", () => {
      down = { row: i, t: performance.now() };
    });
    o.on("pointerup", () => {
      const ok = choiceTapCounts(b.__mfChoiceShownAt as number, down, i);
      down = null;
      if (!ok || !b.choiceHandler) return;
      haptic("tap");
      b.choiceHandler(i);
    });
  });
}

/** Choices: 48 CSS px rows, nearly full width, reading size, no key numbers, a deliberate tap. */
function phoneChoices(b: Box) {
  const ov = b.overlay as Phaser.GameObjects.Container;
  const list = ov.list as Bag[];
  const rows: { bg: Bag; t: Phaser.GameObjects.Text }[] = [];
  for (let i = 0; i < list.length - 1; i++) if (list[i].type === "Rectangle" && list[i].input && list[i + 1].type === "Text") rows.push({ bg: list[i], t: list[i + 1] as Phaser.GameObjects.Text });
  if (!rows.length) return;
  const R = readability();
  const k = R?.k ?? 0.72;
  const rowMin = gamePx(k, CHOICE_ROW_CSS);
  const gap = gamePx(k, CHOICE_GAP_CSS);
  const pad = gamePx(k, 8);
  const width = W - 60;
  rows.forEach(({ t }, i) => {
    // (the "1. " in front is for the number keys: not on a phone; the choice's own words are untouched)
    const pre = `${i + 1}. `;
    if (t.text.startsWith(pre)) t.setText(t.text.slice(pre.length));
    t.setWordWrapWidth(width - 2 * pad, true).setAlign("center");
    markReading(t);
  });
  const heights = rows.map(({ t }) => Math.max(rowMin, Math.ceil(t.height + 2 * pad)));
  const boxTop = FRAME.y + (b.root as Bag).y;
  const body = b.bodyText as Phaser.GameObjects.Text;
  const question = b.root.visible && body.visible && body.text.trim() ? body : null;
  const plan = planChoices(heights, gap, b.root.visible ? boxTop : 0, 540, 8, question ? question.height : 0);
  // (the overlay in screen space, wherever the box sits)
  ov.setY(-(b.root as Bag).y);
  let y = plan.top;
  rows.forEach(({ bg, t }, i) => {
    const h = heights[i];
    bg.setPosition(W / 2, y + h / 2);
    sizeShape(bg, width, h);
    t.setPosition(W / 2, y + h / 2);
    y += h + gap;
  });
  if (plan.replaceBox) {
    hideBox(b);
    // the question stays readable above the rows (or, with no room, in the LOG)
    if (question && plan.header) question.setPosition(40, 8 - (b.root as Bag).y).setWordWrapWidth(W - 80);
    else if (question) {
      (b.__mfHidden as Map<Bag, boolean>).set(question, true);
      question.setVisible(false);
    }
  }
  guardTaps(b, rows.map((r) => r.bg));
}

/** The Messenger reaction card: no key numbers, a deliberate tap, the message at reading size if it fits. */
function phoneReaction(b: Box) {
  const ov = b.overlay as Phaser.GameObjects.Container;
  const list = ov.list as Bag[];
  const circles = list.filter((o) => o.type === "Arc" && o.input);
  for (const o of list) {
    if (o.type !== "Text") continue;
    // the little "1".."5" by each circle
    if (/^[1-9]$/.test(o.text)) o.setVisible(false);
    // "REACT  (1-5 or click)" → "REACT"
    else if (/^REACT\b/.test(o.text)) wordText(o as Phaser.GameObjects.Text);
    // the message, in the grey bubble (172 to 252): reading size when it still fits
    else if (o.style?.wordWrapWidth >= 500) {
      markReading(o as Phaser.GameObjects.Text);
      if (o.height > 80) markReading(o as Phaser.GameObjects.Text, null);
    }
  }
  guardTaps(b, circles);
}

// ------------------------------------------------------------------ the pills, the log, AUTO

type PillId = "auto" | "log" | "skip" | "pause";
const PILL_W: Record<PillId, number> = { auto: 62, log: 54, skip: 70, pause: 50 };
const PILL_H = 44;
const PILL_GAP = 4;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export class PhoneDialogue {
  readonly el: HTMLDivElement;
  private pills = {} as Record<PillId, HTMLButtonElement>;
  private logEl: HTMLDivElement;
  private logList: HTMLDivElement;
  /** AUTO is on (for this visit; the game's own "Auto-advance dialogue" setting also counts). */
  auto = false;
  private clock: (AutoClock & { key: string }) | null = null;
  private shown = "";
  private lastState = "";
  private skEl!: HTMLDivElement;
  /** The SKIP confirm is up (since, performance.now()), or 0. */
  private skipAsk = 0;
  /** How long the SKIP confirm waits before it goes away by itself. */
  static readonly SKIP_ASK_MS = 5000;
  /** For tests: how many times each pill acted. */
  stats = { skips: 0, logs: 0, autos: 0, pauses: 0, autoAdvances: 0 };

  constructor(
    readonly game: Phaser.Game,
    parent: HTMLElement,
    private viewport: () => Viewport,
    private blocked: () => boolean = () => false,
  ) {
    patchBoxes();
    safeBottomCss = () => {
      const vp = this.viewport();
      return vp.h - Math.max(21, vp.insets.bottom);
    };
    const el = document.createElement("div");
    el.className = "kd";
    el.innerHTML = (["auto", "log", "skip", "pause"] as PillId[])
      .map((id) => `<button type="button" class="kd-pill kd-${id}" data-id="${id}" aria-label="${id === "pause" ? "pause" : id}"><span>${id === "auto" ? "AUTO" : id === "log" ? "LOG" : id === "skip" ? "SKIP ▸▸" : "II"}</span></button>`)
      .join("");
    keepTouches(el);
    for (const b of Array.from(el.querySelectorAll<HTMLButtonElement>(".kd-pill"))) {
      const id = b.dataset.id as PillId;
      b.style.width = `${PILL_W[id]}px`;
      this.pills[id] = b;
      bindTap(b, () => this.press(id));
    }
    parent.appendChild(el);
    this.el = el;
    // SKIP asks first (research M8): a stray tap on the pill above the box would lose a whole scene's jokes (P8)
    const sk = document.createElement("div");
    sk.className = "kd-sk";
    sk.innerHTML = `<button type="button" class="kd-sk-no">KEEP READING</button><button type="button" class="kd-sk-go">SKIP SCENE ▸▸</button>`;
    keepTouches(sk);
    parent.appendChild(sk);
    this.skEl = sk;
    bindTap(sk.querySelector(".kd-sk-no") as HTMLElement, () => this.closeSkip());
    bindTap(sk.querySelector(".kd-sk-go") as HTMLElement, () => {
      const b = this.current();
      this.closeSkip();
      if (!b || !this.showing(b) || b.choiceHandler) return;
      haptic("tap");
      this.stats.skips++;
      b.skipAll();
      this.lastState = "";
    });
    // the log: a native-scroll list over the game (research M10)
    const log = document.createElement("div");
    log.className = "kdl";
    log.innerHTML = `<div class="kdl-card" role="dialog" aria-label="Conversation so far"><div class="kdl-head"><span class="kdl-title">SO FAR</span><button type="button" class="kdl-x" aria-label="close">✕</button></div><div class="kdl-list"></div></div>`;
    keepTouches(log);
    parent.appendChild(log);
    this.logEl = log;
    this.logList = log.querySelector(".kdl-list") as HTMLDivElement;
    bindTap(log.querySelector(".kdl-x") as HTMLElement, () => this.closeLog());
    // a tap on the dark around the card closes it too
    bindTap(log, (e) => {
      if (e.target === log) this.closeLog();
    });
  }

  /** The conversation on screen now (the newest box still playing), or null. */
  current(): Box | null {
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (b.destroyed || !b.active || !b.scene?.sys) continue;
      return b;
    }
    return null;
  }

  /** Is that conversation showing and waiting on the player (not under a menu, a broadcast, a Kreltality...)? */
  showing(b: Box | null): boolean {
    if (!b || !b.active || b.destroyed || !b.root?.visible) return false;
    const sys = b.scene.sys;
    if (!sys.isActive() || sys.isPaused() || !sys.isVisible()) return false;
    // (a screen over it: the pause menu, the save slots, a broadcast, a Kreltality, the weapon picker)
    for (const k of COVERING) if (this.game.scene.isActive(k)) return false;
    if (this.ownControls(b)) return false;
    return !this.blocked();
  }

  private ownCheck = { at: 0, scene: "", on: false };

  /**
   * The Krezz Arms' table chats bring their own bar (NEXT LINE, SKIP THIS CONVO, END) where the pills would go: the
   * pills step aside while it shows (looked up a few times a second).
   */
  private ownControls(b: Box): boolean {
    const key = b.scene.scene.key as string;
    if (key !== "Pub") return false;
    const t = performance.now();
    if (this.ownCheck.scene === key && t - this.ownCheck.at < 250) return this.ownCheck.on;
    let on = false;
    for (const o of b.scene.children.list as Bag[]) {
      if (o.type !== "Container" || !o.visible) continue;
      for (const c of o.list as Bag[]) if (c.type === "Container" && c.visible && (c.list as Bag[]).some((x) => x.type === "Text" && /SKIP THIS CONVO/.test(x.text))) on = true;
      if (on) break;
    }
    this.ownCheck = { at: t, scene: key, on };
    return on;
  }

  get logOpen(): boolean {
    return this.logEl.classList.contains("show");
  }

  private press(id: PillId) {
    const b = this.current();
    if (!b || !this.showing(b)) return;
    haptic("tap");
    if (id === "skip") {
      if (b.choiceHandler) return;
      // (a second tap on SKIP while it asks: keep reading)
      if (this.skipAsk) this.closeSkip();
      else this.openSkip();
    } else if (id === "log") this.openLog();
    else if (id === "auto") {
      this.stats.autos++;
      if (G.meta.settings.autoAdvance) {
        // (the game's own setting was on: AUTO off means off)
        G.meta.settings.autoAdvance = false;
        G.saveMeta();
        this.auto = false;
      } else this.auto = !this.auto;
      this.clock = null;
    } else if (id === "pause") this.pauseConversation(b);
    this.lastState = "";
  }

  get skipAsking(): boolean {
    return this.skipAsk > 0;
  }

  private openSkip() {
    this.skipAsk = performance.now();
    this.skEl.classList.add("show");
    this.placeSkip();
  }

  closeSkip() {
    if (!this.skipAsk) return;
    this.skipAsk = 0;
    this.skEl.classList.remove("show");
  }

  /** The confirm sits right above the pill row, its right end under the thumb that pressed SKIP. */
  private placeSkip() {
    if (!this.skipAsk) return;
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(this.el.style.transform);
    const x = m ? +m[1] : 0;
    const y = m ? +m[2] : 0;
    const rowW = this.el.getBoundingClientRect().width || 200;
    const w = this.skEl.getBoundingClientRect().width || 300;
    const vp = this.viewport();
    const left = Math.max(vp.insets.left + 8, Math.min(vp.w - vp.insets.right - w - 8, x + rowW - w));
    this.skEl.style.transform = `translate(${Math.round(left)}px,${Math.round(Math.max(vp.insets.top + 4, y - 56))}px)`;
  }

  /** The laptop's Esc in a meeting, cutscene or vignette: the pause menu over it. */
  pauseConversation(b: Box | null = this.current()): boolean {
    if (!b || !PAUSABLE_SCENES.has(b.scene.scene.key) || !this.showing(b)) return false;
    this.stats.pauses++;
    const sc = b.scene;
    sc.scene.launch("Menu", { mode: "pause", caller: sc.scene.key });
    sc.scene.pause();
    return true;
  }

  /** The lines already shown in the current conversation (oldest first). */
  entries(b: Box | null = this.current()): LogEntry[] {
    const log = dialogueLog();
    if (!b) return [];
    const start = b.__mfConvStart as LogEntry | null;
    const i = start ? log.indexOf(start) + 1 : 0;
    return log.slice(i);
  }

  openLog() {
    const b = this.current();
    const rows = this.entries(b);
    this.stats.logs++;
    this.logList.innerHTML = rows.length
      ? rows
          .map((e) =>
            e.dir
              ? `<div class="kdl-row dir">${esc(e.text)}</div>`
              : `<div class="kdl-row"><b style="color:${e.color !== undefined ? "#" + e.color.toString(16).padStart(6, "0") : "#ffd23f"}">${esc(e.who)}</b>${esc(e.text)}</div>`,
          )
          .join("")
      : `<div class="kdl-row dir">Nothing yet.</div>`;
    this.logEl.classList.add("show");
    // newest at the bottom, in view
    this.logList.scrollTop = this.logList.scrollHeight;
  }

  closeLog() {
    this.logEl.classList.remove("show");
  }

  /** Android Back (shell.ts): what it does here. True when it did something. */
  onBack(): boolean {
    // (Back while SKIP asks: keep reading)
    if (this.skipAsk) {
      this.closeSkip();
      return true;
    }
    const b = this.current();
    const showing = this.showing(b);
    const a = backAction({ logOpen: this.logOpen, settingsOpen: false, guideOpen: false, conversation: showing, pausable: !!b && PAUSABLE_SCENES.has(b.scene.scene.key) });
    if (a === "close-log") {
      this.closeLog();
      return true;
    }
    if (a === "pause-conversation") return this.pauseConversation(b);
    return false;
  }

  /** Every game frame. DOM writes only when something changed. */
  frame() {
    const b = this.current();
    const on = this.showing(b);
    // (the confirm goes when the conversation does, when a choice comes up, or after a while)
    if (this.skipAsk && (!on || !b || b.choiceHandler || b.skipping || performance.now() - this.skipAsk > PhoneDialogue.SKIP_ASK_MS)) this.closeSkip();
    if (!on || !b) {
      if (this.shown) {
        this.el.classList.remove("show");
        this.shown = "";
      }
      if (this.logOpen && (!b || !b.active)) this.closeLog();
      this.clock = null;
      return;
    }
    const choosing = !!b.choiceHandler;
    const pausable = PAUSABLE_SCENES.has(b.scene.scene.key);
    const autoOn = this.auto || !!G.meta.settings.autoAdvance;
    const state = `${choosing}|${pausable}|${autoOn}|${!!b.skipping}`;
    const ids: PillId[] = choosing ? ["log"] : ["auto", "log", "skip"];
    if (pausable) ids.push("pause");
    if (state !== this.lastState) {
      this.lastState = state;
      for (const id of Object.keys(this.pills) as PillId[]) this.pills[id].classList.toggle("show", ids.includes(id));
      this.pills.auto.classList.toggle("lit", autoOn);
      this.pills.skip.classList.toggle("busy", !!b.skipping);
    }
    // on the box's top edge, at its right end (screen CSS px)
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / 960 || 0.72;
    const ry = (b.root as Bag).y as number;
    const box = { x: cb.x + FRAME.x * k, y: cb.y + (FRAME.y + ry) * k, w: FRAME.w * k, h: FRAME.h * k };
    const rowW = ids.reduce((a, id) => a + PILL_W[id], 0) + PILL_GAP * (ids.length - 1);
    const vp = this.viewport();
    // (while choosing, the rows sit on the box's top edge: LOG goes inside the box, bottom right, over the ▼)
    const at = choosing ? { x: Math.round(box.x + box.w - rowW - 4), y: Math.round(Math.min(box.y + box.h, vp.h - vp.insets.bottom) - PILL_H - 2) } : pillRow(box, rowW, PILL_H, { w: vp.w, h: vp.h }, vp.insets, 0);
    const where = `${at.x},${at.y}`;
    if (where !== this.shown) {
      this.el.style.transform = `translate(${at.x}px,${at.y}px)`;
      this.el.classList.add("show");
      this.shown = where;
      this.placeSkip();
    }
    this.autoStep(b, autoOn && !choosing && !this.logOpen);
  }

  /** AUTO: the page moves on after the voice (plus a beat), or after its reading time. */
  private autoStep(b: Box, on: boolean) {
    if (!on || b.skipping || b.choiceHandler) {
      this.clock = null;
      return;
    }
    const now = performance.now();
    const text = String(b.fullText ?? "");
    const key = `${b.lineNo}|${text}`;
    if (!this.clock || this.clock.key !== key) this.clock = { key, fullAt: null, quietSince: null, voiced: false, chars: text.length };
    const c = this.clock;
    if (b.typing) c.fullAt = null;
    else if (c.fullAt === null) c.fullAt = now;
    if (voice.busy()) {
      c.voiced = true;
      c.quietSince = null;
    } else if (c.quietSince === null) c.quietSince = now;
    if (!b.advanceResolve || b.typing) return;
    if (autoReady(now, c)) {
      this.clock = null;
      this.stats.autoAdvances++;
      b.advance();
    }
  }

  /** For tests and ?mobilediag. */
  snapshot() {
    const b = this.current();
    const pills = Object.fromEntries((Object.keys(this.pills) as PillId[]).map((id) => [id, this.el.classList.contains("show") && this.pills[id].classList.contains("show")]));
    const r = this.el.getBoundingClientRect();
    return {
      showing: this.showing(b),
      scene: b ? b.scene.scene.key : null,
      typing: !!b?.typing,
      waiting: !!b?.advanceResolve,
      skipping: !!b?.skipping,
      choosing: !!b?.choiceHandler,
      auto: this.auto,
      logOpen: this.logOpen,
      skipAsking: this.skipAsking,
      pills,
      row: { x: r.x, y: r.y, w: r.width, h: r.height },
      stats: { ...this.stats },
    };
  }
}

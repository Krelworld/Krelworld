// PHONE MODE: the pure rules of the phone dialogue controls (dialogue.ts), with no Phaser and no DOM, so they are
// unit-tested in node: how long AUTO waits, when a tap on a choice counts, how many lines fit in the box, where the
// choices go, and what Android's Back does in a conversation.

/** Research S11: a control that has just appeared ignores presses for 150 to 200 ms (a choice needs a deliberate tap). */
export const CHOICE_GUARD_MS = 180;
/** Research M8: choice rows at least 48 CSS px tall, 8 to 12 apart, nearly full width. */
export const CHOICE_ROW_CSS = 48;
export const CHOICE_GAP_CSS = 10;
/** AUTO waits this long after the voice has finished (the game's own auto-advance waits 700 ms too). */
export const AUTO_AFTER_VOICE_MS = 700;

/**
 * Reading time for a line nobody reads out (narration, a page after the first, a line with no voice): about 20
 * characters a second (Netflix) plus a beat to land (Ren'Py: 60 ms a character + 1.5 s), 1.5 to 8 s.
 */
export function readingMs(chars: number): number {
  const n = Math.max(0, Math.floor(chars || 0));
  return Math.min(8000, Math.max(1500, 1200 + 50 * n));
}

export interface AutoClock {
  /** ms timestamp when the page finished typing (null: still typing). */
  fullAt: number | null;
  /** ms timestamp since when the voice has been quiet (null: speaking now). */
  quietSince: number | null;
  /** Was a voice heard on this page at all? */
  voiced: boolean;
  /** Characters on the page. */
  chars: number;
}

/**
 * AUTO: may the page move on now? A voiced page waits for the voice to end plus AUTO_AFTER_VOICE_MS, and at least
 * half its reading time after it is fully shown (a voice that stops early, or a clip that fails, never rushes a
 * long line); a silent one waits its whole reading time from when it is fully shown.
 */
export function autoReady(now: number, c: AutoClock): boolean {
  if (c.fullAt === null || c.quietSince === null) return false;
  if (c.voiced) return now - c.quietSince >= AUTO_AFTER_VOICE_MS && now - c.fullAt >= Math.max(1000, readingMs(c.chars) / 2);
  return now - c.fullAt >= readingMs(c.chars);
}

/** A press on a choice row: where and when it started. */
export interface RowPress {
  row: number;
  t: number;
}

/**
 * Does a touch that ends on `row` at `upAt` pick it? Only if it began on that same row, at least CHOICE_GUARD_MS after
 * the rows appeared (so the tap that ended the previous line, or a thumb resting on the screen, never picks one).
 */
export function choiceTapCounts(shownAt: number, down: RowPress | null, upRow: number, guard = CHOICE_GUARD_MS): boolean {
  if (!down || down.row !== upRow || upRow < 0) return false;
  return down.t - shownAt >= guard;
}

/** How many lines of `lineH` (with `spacing` between them) fit from `top` to `bottom`. At least one. */
export function linesThatFit(top: number, bottom: number, lineH: number, spacing: number): number {
  if (!(lineH > 0)) return 1;
  return Math.max(1, Math.floor((bottom - top + spacing) / (lineH + spacing)));
}

export interface ChoicePlan {
  /** Top of the first row (game px, screen space). */
  top: number;
  /** Each row's height and the gap between rows. */
  rowH: number;
  gap: number;
  /** The rows don't fit above the dialogue box: they take the screen and the box steps aside. */
  replaceBox: boolean;
  /** With replaceBox: the question goes above the rows, as a header (it fits). */
  header: boolean;
}

/**
 * Where the choice rows go (game px, screen space). Above the dialogue box when they fit there (`boxTop` minus a
 * margin), else over the whole screen (research M8: on a short screen the choices replace the box), with the question
 * (`headerH` tall) above them when there is room for it.
 */
export function planChoices(rows: number[], gap: number, boxTop: number, screenH = 540, margin = 8, headerH = 0): ChoicePlan {
  const total = rows.reduce((a, b) => a + b, 0) + gap * Math.max(0, rows.length - 1);
  const rowH = rows.length ? Math.max(...rows) : 0;
  if (boxTop > 0 && total <= boxTop - 2 * margin) return { top: Math.round(boxTop - margin - total), rowH, gap, replaceBox: false, header: false };
  const header = headerH > 0 && margin + headerH + gap + total <= screenH - margin;
  const minTop = header ? margin + headerH + gap : margin;
  return { top: Math.max(minTop, Math.round((screenH - total + (header ? headerH + gap : 0)) / 2)), rowH, gap, replaceBox: true, header };
}

/** What Android's Back does in phone mode, first match wins. */
export type BackAction = "close-log" | "close-settings" | "close-guide" | "pause-conversation" | "default";

export interface BackState {
  logOpen: boolean;
  settingsOpen: boolean;
  guideOpen: boolean;
  /** A conversation is showing. */
  conversation: boolean;
  /** ...and its scene has a pause menu (meetings, cutscenes, vignettes: the laptop's Esc opens it there). */
  pausable: boolean;
}

/**
 * Back closes the topmost phone overlay; in a conversation whose scene can pause it opens the pause menu (the
 * laptop's Esc); in any other conversation it does nothing (the shell's default: the town is paused under it, and on
 * a laptop Esc does nothing there either). It never skips: Back means "get me out", and a skip cannot be undone.
 */
export function backAction(s: BackState): BackAction {
  if (s.logOpen) return "close-log";
  if (s.settingsOpen) return "close-settings";
  if (s.guideOpen) return "close-guide";
  if (s.conversation && s.pausable) return "pause-conversation";
  return "default";
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where the SKIP / LOG / AUTO pills go (CSS px, top-left of the row): on the dialogue box's top edge at its right
 * end, just above it (just below it when the box is at the top of the screen), kept inside the safe area and out of
 * the bottom strip.
 */
export function pillRow(box: Rect, rowW: number, rowH: number, view: { w: number; h: number }, safe: { top: number; right: number; bottom: number; left: number }, gap = 6): { x: number; y: number } {
  const right = Math.min(box.x + box.w, view.w - safe.right - 4);
  const x = Math.max(safe.left + 4, right - rowW);
  let y = box.y - rowH - gap;
  if (y < safe.top + 4) y = box.y + box.h + gap;
  y = Math.min(y, view.h - safe.bottom - rowH - 2);
  return { x: Math.round(x), y: Math.round(Math.max(safe.top + 2, y)) };
}

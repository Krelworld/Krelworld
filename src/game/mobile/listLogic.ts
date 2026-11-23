// PHONE MODE: the pure rules behind the phone's lists (lists.ts) and shops (shops.ts), kept apart so they are tested
// in node: rows, paging, keeping the selected row in view, where a dragged row lands, and how many boxes of ammo a
// quantity can be.

/** A list row's height (CSS px): 52, so a part row always shows at the bottom (research M10). */
export const ROW_CSS = 52;
/** The page buttons, tabs and inline buttons: 44 CSS px (research M10, Apple). */
export const BTN_CSS = 44;
/** A finger that moves further than this is scrolling, not tapping (domTap.ts uses the same). */
export const LIST_SLOP = 12;

/** Where a page button scrolls to: 85% of the view a press, so one row stays in sight across the jump. */
export function pageScroll(scrollTop: number, viewH: number, contentH: number, dir: -1 | 1): number {
  const max = Math.max(0, contentH - viewH);
  const step = Math.max(ROW_CSS, Math.round(viewH * 0.85));
  return Math.max(0, Math.min(max, Math.round(scrollTop + dir * step)));
}

/** Whether a page button does anything (for its dim look). */
export function canPage(scrollTop: number, viewH: number, contentH: number, dir: -1 | 1): boolean {
  return dir < 0 ? scrollTop > 1 : scrollTop + viewH < contentH - 1;
}

/**
 * The scroll that brings a row into view with as little movement as possible (`block: nearest`), with a margin so
 * the row is never flush against the edge. Unchanged if it is already in view.
 */
export function scrollToShow(rowTop: number, rowH: number, scrollTop: number, viewH: number, margin = 8): number {
  if (rowTop - margin < scrollTop) return Math.max(0, rowTop - margin);
  if (rowTop + rowH + margin > scrollTop + viewH) return Math.max(0, rowTop + rowH + margin - viewH);
  return scrollTop;
}

/** Where a row dragged by `dy` CSS px from slot `from` lands (rows `rowH` apart, `n` of them). */
export function dropSlot(from: number, dy: number, rowH: number, n: number): number {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(n - 1, from + Math.round(dy / Math.max(1, rowH))));
}

/** Move one entry of a list from `from` to `to` (a copy; the list a reorder shows while the finger is down). */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
  return out;
}

/**
 * Ammo by the box: the most boxes a BUY can take (what fills the gun, and what the money runs to; at least 0).
 * The game's own rule is "fill it as far as your money goes" (armoury.ts buyAmmo): that is the default quantity.
 */
export function maxBoxes(coins: number, unit: number, boxesToFill: number): number {
  if (unit <= 0) return Math.max(0, boxesToFill);
  return Math.max(0, Math.min(boxesToFill, Math.floor(coins / unit)));
}

/** A quantity stepper's next value (kept between 1 and max; 0 when nothing can be bought). */
export function stepQty(n: number, dir: -1 | 1, max: number): number {
  if (max <= 0) return 0;
  return Math.max(1, Math.min(max, n + dir));
}

/**
 * How to buy exactly `n` boxes with the game's own purchase (which buys while the money lasts): for the purchase,
 * the purse holds just `n` boxes' worth; the rest is set aside and put back straight after. Returns the purse to
 * use and what to put back.
 */
export function capPurse(coins: number, unit: number, n: number): { purse: number; aside: number } {
  const purse = Math.max(0, Math.min(coins, n * unit));
  return { purse, aside: coins - purse };
}

/** Grid columns for tiles `tileMin` px wide in `width` px (at least 2, at most 4). */
export function tileCols(width: number, tileMin = 128): number {
  return Math.max(2, Math.min(4, Math.floor(width / tileMin)));
}

/** A list that already fits stays as the game draws it (research M10 is for lists longer than the screen). */
export function needsList(rows: number, rowsThatFit: number): boolean {
  return rows > rowsThatFit;
}

/** HTML-escape a string for the list's markup. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Character select (P16): a second tap on the same face starts the game only this long after the first. */
export const CHAR_RETAP_MS = 300;

/**
 * Whether a tap on face `i` starts the game: only a second tap on the face the player picked by tapping (the face
 * that starts selected never starts on one tap), at least CHAR_RETAP_MS after it. PLAY AS always starts.
 */
export function charTapStarts(i: number, sel: number, tapped: number | null, sinceMs: number): boolean {
  return i === sel && tapped === i && sinceMs >= CHAR_RETAP_MS;
}

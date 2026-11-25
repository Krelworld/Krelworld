// PHONE MODE: the room name up top in a fight (stage 2 polish, N2). Phones only; nothing here runs on a laptop.
//
// The HUD's room line ("THE SANMIKVERSE (CATFORD, ALLEGEDLY) · Job Centre Plus (Catford Branch)") is centred at x 455
// for a laptop's small text. On a phone the text is bigger and the top-left block is wider (the name and the coins on
// one line, KREZZ and WONK beside the bars), so a long name ran over the player's name and the coins. Here, driven from
// outside the UI scene: when the line doesn't fit where it is, it is centred in the gap between the top-left block and
// the weapon chip, shortened to the room's own name (the part after the last " · "), and ellipsised if even that is too
// long; it is hidden when there is no real gap. The words themselves are never changed. Out of a fight (the town's
// "CHAPTER n · KRELFORD") it is put back exactly as the game made it.
import type Phaser from "phaser";

/** Where the UI scene puts the line (UIScene.create): centred on this x. */
const HOME_X = 455;
/** Space kept clear either side of the line (game px). */
const PAD = 10;
/** Below this much room the line is hidden. */
const MIN_W = 70;

interface UiLike extends Phaser.Scene {
  mode?: string;
  roomT?: Phaser.GameObjects.Text;
  nameT?: Phaser.GameObjects.Text;
  coinT?: Phaser.GameObjects.Text;
  coinIco?: Phaser.GameObjects.Image;
  hpT?: Phaser.GameObjects.Text;
  kzT?: Phaser.GameObjects.Text;
}

interface FitState {
  /** The text the game last set. */
  full: string;
  /** What we put up instead (the line as it is on screen after a fit). */
  shown: string;
  key: string;
  moved: boolean;
}

/** The room's own name: the part after the last " · " (the dungeon's name comes first). */
export function roomPart(full: string): string {
  const i = full.lastIndexOf(" · ");
  return i >= 0 ? full.slice(i + 3) : full;
}

/** The longest start of `text` that, with "…", measures no wider than `max` (by the given measure). */
export function ellipsise(text: string, max: number, width: (s: string) => number): string {
  if (width(text) <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (width(text.slice(0, mid).trimEnd() + "…") <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo).trimEnd() + "…" : "";
}

/**
 * Called once a frame (after the scenes have updated, before drawing). `right` is where the top-right controls begin
 * (game px; the toast column's right edge), or null if unknown.
 */
export function fitRoomName(game: Phaser.Game, right: number | null) {
  let ui: UiLike | null = null;
  try {
    if (!game.scene.isActive("UI")) return;
    ui = game.scene.getScene("UI") as UiLike;
  } catch {
    return;
  }
  const t = ui?.roomT;
  if (!ui || !t?.scene) return;
  const st: FitState = ((t as unknown as { __krelFit?: FitState }).__krelFit ??= { full: t.text, shown: t.text, key: "", moved: false });
  if (t.text !== st.shown) {
    // the game set a new line (a new room, or the town's chapter line)
    st.full = t.text;
    st.shown = t.text;
    st.key = "";
  }
  const restore = () => {
    if (!st.moved) return;
    st.moved = false;
    st.key = "";
    if (t.text !== st.full) t.setText(st.full);
    st.shown = st.full;
    t.setOrigin(0.5, 0).setX(HOME_X);
  };
  if (ui.mode !== "dungeon" || !t.visible || !st.full) return restore();
  // the gap: right of everything up top-left that shares the line's height, left of the top-right controls
  const top = t.y;
  const bottom = t.y + Math.max(t.height, 12);
  let left = 0;
  for (const o of [ui.nameT, ui.coinIco, ui.coinT, ui.hpT, ui.kzT]) {
    if (!o || !o.visible || !o.active) continue;
    if (o.type === "Text" && !(o as Phaser.GameObjects.Text).text) continue;
    const b = o.getBounds();
    if (b.y < bottom && b.y + b.height > top) left = Math.max(left, b.x + b.width);
  }
  const R = Math.min(950, right ?? 950) - PAD;
  const L = Math.ceil(left) + PAD;
  const key = `${st.full}|${L}|${Math.floor(R)}|${t.style.fontSize}`;
  if (key === st.key) return;
  st.key = key;
  const measure = (s: string) => {
    t.setText(s);
    return t.width;
  };
  // where the game put it, if it fits there
  const fw = measure(st.full);
  if (HOME_X - fw / 2 >= L && HOME_X + fw / 2 <= R) {
    t.setOrigin(0.5, 0).setX(HOME_X);
    st.shown = st.full;
    st.moved = false;
    return;
  }
  st.moved = true;
  const room = R - L;
  let out = "";
  if (room >= MIN_W) {
    if (fw <= room) out = st.full;
    else out = ellipsise(roomPart(st.full), room, measure);
  }
  t.setText(out);
  t.setOrigin(0.5, 0).setX(Math.round((L + R) / 2));
  st.shown = out;
}

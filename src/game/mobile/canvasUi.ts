// PHONE MODE: small helpers for re-laying out the game's own canvas UI from outside (dialogue choices, menus): resize
// a button made by theme.ts's button() or a plain interactive rectangle, keeping its tap area in step with its
// drawing. Phones only (the phone chunk is the only caller).
import type Phaser from "phaser";

type Bag = Record<string, any>;

/** A button made by theme.ts's button(): a container with `bg` (NineSlice art or a Rectangle) and `label` (Text). */
export interface GameButton extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export function isGameButton(o: unknown): o is GameButton {
  const c = o as Bag | null;
  return !!c && c.type === "Container" && !!c.bg && !!c.label && c.label.type === "Text";
}

/** Resize a NineSlice or a Rectangle about its origin, and its tap area with it. */
export function sizeShape(bg: Bag, w: number, h: number) {
  w = Math.round(w);
  h = Math.round(h);
  bg.setSize(w, h);
  // (a Rectangle's setSize leaves its origin and tap area behind; a NineSlice's updates both)
  if (typeof bg.updateDisplayOrigin === "function") bg.updateDisplayOrigin();
  const inp = bg.input as Bag | null | undefined;
  if (inp && !inp.customHitArea && inp.hitArea) {
    inp.hitArea.x = 0;
    inp.hitArea.y = 0;
    inp.hitArea.width = w;
    inp.hitArea.height = h;
  }
}

/** Resize a button() (drawing, tap area, the container's size the pad highlight uses, the label's wrap). */
export function resizeButton(b: GameButton, w: number, h: number) {
  sizeShape(b.bg as unknown as Bag, w, h);
  b.setSize(Math.round(w), Math.round(h));
  b.label.setWordWrapWidth(Math.max(20, Math.round(w) - 12));
}

/** The buttons directly in a container's list (or a scene's display list), in order. */
export function buttonsIn(list: readonly unknown[]): GameButton[] {
  return list.filter(isGameButton);
}

/** The label text of a button. */
export function buttonText(b: GameButton): string {
  return b.label.text;
}

// Placeholder people drawn with shapes until the pixel art arrives.
import type Phaser from "phaser";
import type { Projection } from "./projection";

export interface FigureStyle {
  shirt: number;
  trim: number;
  shorts: number;
  skin: number;
  /** Width multiplier: the protagonist is a big lad. */
  girth?: number;
  height?: number;
  ring?: number | null;
  down?: boolean;
  /** Slightly transparent (echoes later, people behind glass). */
  alpha?: number;
  hat?: number | null;
  vest?: number | null;
  /** Something over the face: a balaclava, a mask, glasses, a moustache. */
  face?: { colour: number; kind: "full" | "glasses" | "tache" } | null;
}

/** Draw one person standing at ground point (x, y) facing `facing` radians. */
export function drawFigure(g: Phaser.GameObjects.Graphics, P: Projection, x: number, y: number, facing: number, st: FigureStyle, tick = 0, moving = false): void {
  const S = P.S, gx = P.sx(x, y), gy = P.sy(x, y);
  const girth = st.girth ?? 1, H = (st.height ?? 1.8) * P.KZ * S, Wd = 0.5 * girth * S;
  const a = st.alpha ?? 1;
  // Shadow.
  g.fillStyle(0x000000, 0.28 * a).fillEllipse(gx, gy, Wd * 2.2, Wd * 0.9 * (P.standing ? 1 : 2));
  if (st.ring) g.lineStyle(2, st.ring, a).strokeEllipse(gx, gy, Wd * 2.9, Wd * (P.standing ? 1.25 : 2.9));

  if (!P.standing) {
    // Straight down: a disc with a head dot towards where they face.
    const d = P.dir(Math.cos(facing), Math.sin(facing));
    if (st.down) { g.fillStyle(st.shirt, a).fillEllipse(gx, gy, Wd * 2.6, Wd * 1.4); return; }
    g.fillStyle(st.shirt, a).fillCircle(gx, gy, Wd * 1.1).lineStyle(2, st.trim, a).strokeCircle(gx, gy, Wd * 1.1);
    if (st.vest) g.fillStyle(st.vest, a).fillCircle(gx, gy, Wd * 0.7);
    g.fillStyle(st.skin, a).fillCircle(gx + d.x * Wd * 0.7, gy + d.y * Wd * 0.7, Wd * 0.38);
    return;
  }

  if (st.down) {
    // Lying on the grass.
    g.fillStyle(st.shirt, a).fillEllipse(gx, gy - 2, H * 0.75, Wd * 1.1);
    g.fillStyle(st.skin, a).fillCircle(gx + H * 0.36, gy - 3, Wd * 0.5);
    return;
  }
  // Legs swing a little when moving.
  const swing = moving ? Math.sin(tick * 0.45) * Wd * 0.35 : 0;
  const legH = H * 0.4, bodyH = H * 0.42, headR = Math.max(3, H * 0.11);
  const side = Math.abs(Math.cos(facing)) > 0.7; // side-on: legs overlap more
  const lw = Wd * (side ? 0.45 : 0.55);
  g.fillStyle(st.skin, a)
    .fillRect(gx - lw - 1 + swing * 0.5, gy - legH, lw, legH)
    .fillRect(gx + 1 - swing * 0.5, gy - legH, lw, legH);
  g.fillStyle(st.shorts, a).fillRect(gx - Wd * 0.95, gy - legH - H * 0.12, Wd * 1.9, H * 0.14);
  // Body.
  const top = gy - legH - bodyH;
  g.fillStyle(st.shirt, a).fillRoundedRect(gx - Wd, top, Wd * 2, bodyH, Math.min(6, Wd * 0.6));
  if (st.vest) g.fillStyle(st.vest, a).fillRect(gx - Wd * 0.8, top + bodyH * 0.15, Wd * 1.6, bodyH * 0.7);
  g.fillStyle(st.trim, a).fillRect(gx - Wd, top, Wd * 2, Math.max(2, bodyH * 0.12));
  // Head, turned slightly towards where he faces.
  const hx = gx + Math.cos(facing) * (P.rot ? 0 : Wd * 0.18) + (P.rot ? Math.sin(facing) * Wd * 0.18 : 0);
  g.fillStyle(st.skin, a).fillCircle(hx, top - headR * 0.9, headR);
  if (st.face) {
    const hy = top - headR * 0.9;
    if (st.face.kind === "full") g.fillStyle(st.face.colour, a).fillCircle(hx, hy, headR * 1.02);
    else if (st.face.kind === "glasses") g.fillStyle(st.face.colour, a).fillRect(hx - headR * 0.85, hy - headR * 0.35, headR * 1.7, headR * 0.45);
    else g.fillStyle(st.face.colour, a).fillRect(hx - headR * 0.6, hy + headR * 0.25, headR * 1.2, headR * 0.3);
  }
  if (st.hat) g.fillStyle(st.hat, a).fillRect(hx - headR * 1.05, top - headR * 2.2, headR * 2.1, headR * 0.9);
}

/** Where to put a label above a figure. */
export function headTop(P: Projection, x: number, y: number, height = 1.8): number {
  return P.sy(x, y) - (P.standing ? height * P.KZ * P.S * 1.08 : P.S * 0.8);
}

// Draws the pitch, goals and ball for either view.
import type Phaser from "phaser";
import { HL, HW, PITCH } from "../football/config";
import type { Projection } from "./projection";

type G = Phaser.GameObjects.Graphics;

/** Draw a ground-level polyline through projected points. */
function poly(g: G, P: Projection, pts: [number, number][], close = false): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(P.sx(x, y), P.sy(x, y)) : g.moveTo(P.sx(x, y), P.sy(x, y))));
  if (close) g.closePath();
  g.strokePath();
}
function ring(g: G, P: Projection, cx: number, cy: number, r: number, a0 = 0, a1 = Math.PI * 2): void {
  const pts: [number, number][] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  poly(g, P, pts);
}

export function drawPitch(g: G, P: Projection, surround = true): void {
  g.clear();
  if (surround) {
    g.fillStyle(0x16241d).fillRect(...P.rect(-HL - 30, -HW - 30, PITCH.L + 60, PITCH.W + 60));
    g.fillStyle(0x24332b).fillRect(...P.rect(-HL - 4, -HW - 4, PITCH.L + 8, PITCH.W + 8));
  }
  const stripes = 12, sw = PITCH.L / stripes;
  for (let i = 0; i < stripes; i++) g.fillStyle(i % 2 ? 0x2f7d3b : 0x2a7436).fillRect(...P.rect(-HL + i * sw, -HW, sw, PITCH.W));
  g.lineStyle(2, 0xf2f6f2, 0.9);
  poly(g, P, [[-HL, -HW], [HL, -HW], [HL, HW], [-HL, HW]], true);
  poly(g, P, [[0, -HW], [0, HW]]);
  ring(g, P, 0, 0, PITCH.circleR);
  for (const sgn of [-1, 1]) {
    const gx = sgn * HL;
    const bx = gx - sgn * PITCH.boxL, sx = gx - sgn * PITCH.sixL;
    poly(g, P, [[gx, -PITCH.boxW / 2], [bx, -PITCH.boxW / 2], [bx, PITCH.boxW / 2], [gx, PITCH.boxW / 2]]);
    poly(g, P, [[gx, -PITCH.sixW / 2], [sx, -PITCH.sixW / 2], [sx, PITCH.sixW / 2], [gx, PITCH.sixW / 2]]);
    // The D.
    const ps = gx - sgn * PITCH.penSpot, dr = 5.6, edge = Math.acos((PITCH.boxL - PITCH.penSpot) / dr);
    ring(g, P, ps, 0, dr, sgn > 0 ? Math.PI - edge : -edge, sgn > 0 ? Math.PI + edge : edge);
    g.fillStyle(0xf2f6f2).fillCircle(P.sx(ps, 0), P.sy(ps, 0), 2.5);
  }
  g.fillStyle(0xf2f6f2).fillCircle(P.sx(0, 0), P.sy(0, 0), 2.5);
  // Nets sit behind everything.
  for (const sgn of [-1, 1]) drawNet(g, P, sgn);
}

function drawNet(g: G, P: Projection, sgn: number): void {
  const gx = sgn * HL, back = gx + sgn * 1.6, w = PITCH.goalW / 2, h = PITCH.goalH;
  if (!P.standing) {
    g.fillStyle(0xdfe7e1, 0.3).fillRect(...P.rect(Math.min(gx, back), -w, 1.6, PITCH.goalW));
    return;
  }
  const pt = (x: number, y: number, z: number) => ({ x: P.sx(x, y), y: P.sy(x, y, z) });
  const quads = [
    [pt(back, -w, 0), pt(back, w, 0), pt(back, w, h * 0.85), pt(back, -w, h * 0.85)], // back
    [pt(gx, -w, h), pt(gx, w, h), pt(back, w, h * 0.85), pt(back, -w, h * 0.85)], // roof
    [pt(gx, -w, 0), pt(back, -w, 0), pt(back, -w, h * 0.85), pt(gx, -w, h)], // side
    [pt(gx, w, 0), pt(back, w, 0), pt(back, w, h * 0.85), pt(gx, w, h)], // side
  ];
  for (const q of quads) {
    g.fillStyle(0xe8eee9, 0.16).fillPoints(q as unknown as Phaser.Math.Vector2[], true);
    g.lineStyle(1, 0xffffff, 0.35).strokePoints(q as unknown as Phaser.Math.Vector2[], true);
  }
}

/** Posts and crossbar. Drawn in the depth-sorted pass so players can pass in front or behind. */
export function drawGoalFrame(g: G, P: Projection, sgn: number): void {
  const gx = sgn * HL, w = PITCH.goalW / 2, h = PITCH.goalH;
  if (!P.standing) {
    g.lineStyle(3, 0xffffff, 1);
    poly(g, P, [[gx, -w], [gx, w]]);
    g.fillStyle(0xffffff).fillCircle(P.sx(gx, -w), P.sy(gx, -w), 2.5).fillCircle(P.sx(gx, w), P.sy(gx, w), 2.5);
    return;
  }
  g.lineStyle(3.5, 0xffffff, 1).beginPath();
  g.moveTo(P.sx(gx, -w), P.sy(gx, -w, 0)); g.lineTo(P.sx(gx, -w), P.sy(gx, -w, h));
  g.lineTo(P.sx(gx, w), P.sy(gx, w, h)); g.lineTo(P.sx(gx, w), P.sy(gx, w, 0));
  g.strokePath();
}

export function drawBall(g: G, P: Projection, x: number, y: number, z: number): void {
  const S = P.S;
  const sx = P.sx(x, y), sy = P.sy(x, y);
  const shadowR = 0.28 * S * (1 + z * 0.08);
  g.fillStyle(0x000000, Math.max(0.12, 0.38 - z * 0.05)).fillEllipse(sx, sy, shadowR * 2, shadowR * (P.standing ? 1 : 2));
  const r = 0.27 * S * (P.standing ? 1 : 1 + z * 0.08);
  const by = P.sy(x, y, z) - (P.standing ? r : 0);
  g.fillStyle(0xffffff, 1).fillCircle(sx, by, r).lineStyle(1.5, 0x111111, 1).strokeCircle(sx, by, r);
  g.fillStyle(0x111111, 1).fillCircle(sx - r * 0.25, by - r * 0.2, r * 0.3);
}

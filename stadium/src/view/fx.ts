// Little life that isn't in the simulation: pigeons pecking round the litter that scatter when
// anyone comes near, and smoke from the burger van's chimney. Drawn straight in pixels.
import Phaser from "phaser";
import type { Projection } from "./projection";

/** In the 3D world the air layer is told where each puff or bird is, so walls hide it properly (a no-op in 2D). */
const at3 = (g: unknown, x: number, y: number, bias = 0.1): void => { (g as { at?: (x: number, y: number, b: number) => void }).at?.(x, y, bias); };

interface Pigeon { x: number; y: number; z: number; vx: number; vy: number; vz: number; hx: number; hy: number; peck: number; flying: number; dark: boolean }

export class Fx {
  private ground: Phaser.GameObjects.Graphics;
  private air: Phaser.GameObjects.Graphics;
  private birds: Pigeon[] = [];
  private puffs: { x: number; y: number; z: number; r: number; a: number }[] = [];
  private venue = "";

  constructor(scene: Phaser.Scene, private P: Projection) {
    this.ground = scene.add.graphics().setDepth(0.38);
    this.air = scene.add.graphics().setDepth(9.7e6);
  }

  /** Flocks where the litter is: on the approach, by the pub and in the car park. */
  private seed(venue: string): void {
    this.venue = venue;
    const m = venue === "sf" ? -1 : 1;
    this.birds = [];
    const flocks: [number, number, number][] = [[-12, 55, 9], [14, 57, 7], [-30, 60, 6], [40, 76, 6], [-8, 80, 5]];
    for (const [x, y, n] of flocks) for (let i = 0; i < n; i++) {
      const hx = m * x + (Math.random() - 0.5) * 5, hy = y + (Math.random() - 0.5) * 3;
      this.birds.push({ x: hx, y: hy, z: 0, vx: 0, vy: 0, vz: 0, hx, hy, peck: Math.random() * 100, flying: 0, dark: Math.random() < 0.3 });
    }
  }

  private ripples: { x: number; y: number; r: number }[] = [];
  private breath: { x: number; y: number; z: number; r: number; a: number }[] = [];
  private packet = { x: -40, y: 58, vx: 1.2, vy: 0.2, spin: 0 };

  update(dms: number, venue: string, people: { x: number; y: number }[], vanAt: { x: number; y: number } | null, view: Phaser.Geom.Rectangle,
    puddles: { x: number; y: number }[] = [], heads: { x: number; y: number; h: number }[] = [], rain = true): void {
    if (venue !== this.venue) this.seed(venue);
    const P = this.P, dt = Math.min(0.05, dms / 1000), g = this.ground, a = this.air, S = P.S;
    g.clear(); a.clear();
    const t = performance.now() / 1000;
    for (const b of this.birds) {
      if (b.flying > 0) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.z = Math.max(0, b.z + b.vz * dt); b.flying -= dt;
        if (b.flying <= 0) {
          // Land somewhere near home again, pecking.
          b.hx += (Math.random() - 0.5) * 4; b.hy += (Math.random() - 0.5) * 2;
          b.x = b.hx; b.y = b.hy; b.z = 0;
        }
      } else {
        // Anyone within a couple of metres and the lot of them go.
        if (people.some((p) => Math.abs(p.x - b.x) < 2.3 && Math.abs(p.y - b.y) < 2.3)) {
          const ang = Math.random() * Math.PI * 2;
          b.vx = Math.cos(ang) * 7; b.vy = Math.sin(ang) * 4; b.vz = 6 + Math.random() * 3; b.flying = 1.6 + Math.random() * 2;
        } else if (Math.random() < 0.01) { b.x += (Math.random() - 0.5) * 0.4; b.y += (Math.random() - 0.5) * 0.3; }
      }
      const sx = P.sx(b.x, b.y), sy = P.sy(b.x, b.y, b.z);
      if (sx < view.x - 40 || sx > view.right + 40 || sy < view.y - 80 || sy > view.bottom + 40) continue;
      const body = b.dark ? 0x4a4e58 : 0x8a909c;
      if (b.flying > 0) {
        const flap = Math.sin(t * 40 + b.peck) > 0 ? -3 : 2;
        at3(a, b.x, b.y);
        a.fillStyle(body, 1).fillRect(Math.round(sx - 3), Math.round(sy - 2), 7, 4);
        a.fillStyle(body, 1).fillRect(Math.round(sx - 7), Math.round(sy - 2 + flap), 5, 2).fillRect(Math.round(sx + 3), Math.round(sy - 2 + flap), 5, 2);
        g.fillStyle(0x000000, 0.18).fillEllipse(P.sx(b.x, b.y), P.sy(b.x, b.y), 8, 3);
      } else {
        const bob = Math.sin(t * 6 + b.peck) > 0.6 ? 2 : 0;
        const X = Math.round(sx), Y = Math.round(sy);
        g.fillStyle(0x000000, 0.25).fillEllipse(X, Y, 13, 4);
        g.fillStyle(body, 1).fillRect(X - 6, Y - 8, 11, 6).fillRect(X - 8, Y - 7, 3, 3);
        g.fillStyle(0x2a2d33, 1).fillRect(X - 9, Y - 6, 2, 2);
        g.fillStyle(0x6a7a8a, 1).fillRect(X + 3, Y - 11 + bob, 4, 4);
        g.fillStyle(0x3a8a6a, 1).fillRect(X + 3, Y - 7 + bob, 3, 2);
        g.fillStyle(0x111111, 1).fillRect(X + 7, Y - 10 + bob, 2, 1);
        g.fillStyle(0xd86a4a, 1).fillRect(X + 2, Y - 2, 1, 2).fillRect(X - 2, Y - 2, 1, 2);
      }
    }
    // Drizzle pricking the puddles.
    if (rain) for (const p of puddles) if (Math.random() < dt * 6) this.ripples.push({ x: p.x + (Math.random() - 0.5) * 1.2, y: p.y - 0.4 + (Math.random() - 0.5) * 0.3, r: 0 });
    for (const rp of this.ripples) {
      rp.r += dt * 0.5;
      g.lineStyle(1, 0xc8d4dc, Math.max(0, 0.6 - rp.r * 2)).strokeEllipse(Math.round(P.sx(rp.x, rp.y)), Math.round(P.sy(rp.x, rp.y)), rp.r * S, rp.r * S * 0.5);
    }
    this.ripples = this.ripples.filter((rp) => rp.r < 0.3);
    // Breath in the cold, now and then, from whoever's on screen.
    for (const h of heads) if (Math.random() < dt * 0.35) this.breath.push({ x: h.x + 0.15, y: h.y, z: h.h, r: 0.06, a: 0.45 });
    for (const b of this.breath) { b.z += dt * 0.3; b.x += dt * 0.25; b.r += dt * 0.18; b.a -= dt * 0.5; }
    this.breath = this.breath.filter((b) => b.a > 0);
    for (const b of this.breath) { at3(a, b.x, b.y, 0.25); a.fillStyle(0xf0f4f6, b.a).fillCircle(Math.round(P.sx(b.x, b.y)), Math.round(P.sy(b.x, b.y, b.z)), Math.max(1, b.r * S)); }
    // A crisp packet blowing across the approach.
    {
      const k = this.packet;
      k.vx += (Math.random() - 0.45) * dt * 3; k.vy += (Math.random() - 0.5) * dt * 2; k.vx = Math.max(-0.5, Math.min(2.4, k.vx)); k.vy *= 0.98;
      k.x += k.vx * dt; k.y += k.vy * dt; k.spin += dt * k.vx * 4;
      if (k.x > 60 || k.y < 46 || k.y > 83) { k.x = -60; k.y = 50 + Math.random() * 30; }
      const px = Math.round(P.sx(k.x, k.y)), py = Math.round(P.sy(k.x, k.y)) - (Math.sin(k.spin) > 0 ? 3 : 1);
      g.fillStyle(0x000000, 0.2).fillEllipse(px, Math.round(P.sy(k.x, k.y)), 8, 3);
      g.fillStyle(Math.cos(k.spin) > 0 ? 0xd7263d : 0xf2c94c, 1).fillRect(px - 3, py - 3, 6, Math.cos(k.spin) > 0 ? 4 : 2);
    }
    // The burger van's flue: grey puffs that rise, drift and thin out.
    if (vanAt) {
      if (Math.random() < dt * 5) this.puffs.push({ x: vanAt.x + 1.4, y: vanAt.y - 1.2, z: 2.6, r: 0.25, a: 0.55 });
      for (const p of this.puffs) { p.z += dt * 1.2; p.x += dt * 0.5; p.r += dt * 0.35; p.a -= dt * 0.12; }
      this.puffs = this.puffs.filter((p) => p.a > 0);
      for (const p of this.puffs) { at3(a, p.x, p.y, 0.3); a.fillStyle(0xd8d6d0, p.a).fillCircle(Math.round(P.sx(p.x, p.y)), Math.round(P.sy(p.x, p.y, p.z)), p.r * S); }
    }
  }
}

import Phaser from "phaser";
import { DEPTH, type Kit } from "./kit";
import { SMALL } from "./smalls";

// ----------------------------------------------------------------------------- shared bits for the room files

/** Scatter knockables (from `keys`) in the room, clear of the spawn and the door. */
export function scatter(k: Kit, keys: string[], n: number, area: Phaser.Geom.Rectangle, o: { colors?: number[]; sfx?: string; scale?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const x = area.x + k.rnd.frac() * area.width;
    const y = area.y + k.rnd.frac() * area.height;
    if (!k.clear(x, y)) continue;
    k.knockable(keys[i % keys.length], x, y, { angle: k.rnd.between(-40, 40), colors: o.colors, sfx: o.sfx, scale: o.scale });
  }
}

/** Splats on the floor (beans, custard, slime, beer): flat irregular blobs. */
export function splats(k: Kit, n: number, colors: number[], area: Phaser.Geom.Rectangle, size = 14, alpha = 0.75) {
  const g = k.floorG();
  for (let i = 0; i < n; i++) {
    const x = area.x + k.rnd.frac() * area.width;
    const y = area.y + k.rnd.frac() * area.height;
    const c = colors[i % colors.length];
    g.fillStyle(c, alpha);
    const s = size * (0.6 + k.rnd.frac() * 0.8);
    g.fillEllipse(x, y, s * 1.6, s);
    for (let j = 0; j < 5; j++) g.fillCircle(x + k.rnd.between(-s, s), y + k.rnd.between(-s / 2, s / 2), k.rnd.between(2, 4));
  }
  return g;
}

/** A clock on the back wall, its second hand going round. */
export function wallClock(k: Kit, x: number, y: number, r = 11) {
  const g = k.wallG();
  g.fillStyle(0x111111).fillCircle(x, y, r + 2);
  g.fillStyle(0xf5f5f4).fillCircle(x, y, r);
  g.fillStyle(0x111111);
  for (let i = 0; i < 12; i++) g.fillRect(x + Math.cos((i / 12) * Math.PI * 2) * (r - 2) - 0.5, y + Math.sin((i / 12) * Math.PI * 2) * (r - 2) - 0.5, 1.5, 1.5);
  g.lineStyle(2, 0x111111).lineBetween(x, y, x + 5, y - 3);
  const hand = k.sc.add.rectangle(x, y, 1, r - 2, 0xdc2626).setOrigin(0.5, 1).setDepth(DEPTH.wall + 0.02);
  k.onUpdate((now) => hand.setAngle(Math.floor(now / 1000) * 6));
}

/** A pressure gauge (the needle twitches). */
export function gauge(k: Kit, x: number, y: number, r = 7, danger = false) {
  const g = k.sc.add.graphics().setDepth(DEPTH.overhead - 2);
  g.fillStyle(0x1c1917).fillCircle(x, y, r + 2);
  g.fillStyle(0xfef3c7).fillCircle(x, y, r);
  g.fillStyle(0xdc2626).slice(x, y, r, -0.6, 0.4).fillPath();
  const needle = k.sc.add.rectangle(x, y, 1.5, r - 1, 0x111111).setOrigin(0.5, 1).setDepth(DEPTH.overhead - 1.9);
  const base = danger ? 60 : -30;
  k.onUpdate((now) => needle.setAngle(base + Math.sin(now / 170 + x) * (danger ? 14 : 6) + Math.sin(now / 53) * 3));
}

export const ANY = (k: Kit) => new Phaser.Geom.Rectangle(70, 150, k.r.w - 140, k.r.h - 230);
export { SMALL };

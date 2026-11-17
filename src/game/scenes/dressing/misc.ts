import Phaser from "phaser";
import { DEPTH, type Kit } from "./kit";
import type { Dressing } from "./rooms";
import { ANY, scatter, SMALL } from "./helpers";

/** Flight KR-069 (the aisle and the cockpit) and Uncle Rik's transverse colon. */

/** Sky with clouds, as a strip that scrolls past behind the windows. */
const skyTex = (k: Kit) => {
  // (a canvas: a graphics gradient doesn't bake into a texture)
  const key = "dds_sky";
  if (k.has(key)) return key;
  const t = k.sc.textures.createCanvas(key, 256, 48);
  if (!t) return "__WHITE";
  const ctx = t.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 48);
  grad.addColorStop(0, "#3b82f6");
  grad.addColorStop(1, "#bfdbfe");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (const [x, y, s] of [
    [30, 30, 1],
    [110, 20, 1.4],
    [190, 34, 0.8],
    [236, 16, 1],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 20 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 12 * s, y - 5 * s, 11 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  t.refresh();
  return key;
};

/** The back wall as a run of windows with the sky going past (speed px/s). */
const windows = (k: Kit, x0: number, x1: number, every: number, ww: number, speed: number, wall: number, frame: number, top = 10, wh = 36): void => {
  // (never over the door in the middle of the back wall)
  const gap = k.r.w / 2;
  if (x0 < gap - 60 && x1 > gap + 60) {
    windows(k, x0, gap - 64, every, ww, speed, wall, frame, top, wh);
    windows(k, gap + 64, x1, every, ww, speed, wall, frame, top, wh);
    return;
  }
  const strip = k.sc.add.tileSprite(x0, top, x1 - x0, wh, skyTex(k)).setOrigin(0).setDepth(DEPTH.wall - 0.02);
  strip.setTileScale(wh / 48);
  k.onUpdate((_, dt) => (strip.tilePositionX += (speed * dt) / 1000));
  const g = k.sc.add.graphics().setDepth(DEPTH.wall - 0.01);
  g.fillStyle(wall);
  let last = x0;
  for (let x = x0 + every / 2; x < x1; x += every) {
    g.fillRect(last, top, x - ww / 2 - last, wh);
    last = x + ww / 2;
    g.lineStyle(3, frame).strokeRoundedRect(x - ww / 2, top, ww, wh, Math.min(10, ww / 3));
  }
  g.fillRect(last, top, x1 - last, wh);
};

export const misc: Record<string, Dressing> = {
  // Flight KR-069, the aisle: rows of seats either side, windows with the sky going past, the floor path lights
  "airport:0": {
    floor: "airline",
    build(k) {
      const { w, h } = k.r;
      // the cabin wall: windows all down it
      const wg = k.sc.add.graphics().setDepth(DEPTH.wall - 0.03);
      wg.fillStyle(0xe5e7eb).fillRect(0, 0, w / 2 - 64, 56).fillRect(w / 2 + 64, 0, w / 2 - 64, 56);
      windows(k, 30, w - 30, 110, 34, 160, 0xe5e7eb, 0x9ca3af);
      // the seats
      for (let x = 110; x < w - 80; x += 150) {
        if (Math.abs(x - w / 2) < 120) continue;
        k.prop("dd_planeseats", x, 112, { scale: 1.2, block: [96, 26] });
        const s = k.prop("dd_planeseats", x, h - 26, { scale: 1.2, block: [96, 26] });
        s?.setFlipY(true);
      }
      // the floor path lights, and FASTEN SEATBELT signs
      for (const y of [124, h - 92]) {
        for (let x = 40; x < w - 40; x += 40) {
          const d = k.sc.add.rectangle(x, y, 4, 2, 0xfde68a, 0.8).setDepth(DEPTH.decal + 0.2);
          k.sc.tweens.add({ targets: d, alpha: 0.25, yoyo: true, repeat: -1, duration: 1400, delay: (x / 40) * 80, ease: "Sine.inOut" });
        }
      }
      for (let x = 260; x < w - 200; x += 520) {
        const sign = k.text(x, h / 2 - 2, "◉ FASTEN SEATBELT", 8, "#fbbf24", { depth: DEPTH.overhead }).setAlpha(0.6);
        k.light(x, h / 2, 60, 0xfbbf24, 0.12);
        void sign;
      }
      // the galley curtains at each end
      const cg = k.sc.add.graphics().setDepth(DEPTH.wall);
      for (const x of [24, w - 52]) {
        cg.fillStyle(0x1e3a8a).fillRect(x, 60, 28, h - 84);
        cg.fillStyle(0x1e40af);
        for (let y = 60; y < h - 24; y += 12) cg.fillRect(x + 4, y, 6, 10);
      }
      scatter(k, [SMALL.cup(k), SMALL.can(k), SMALL.carton(k)], 22, new Phaser.Geom.Rectangle(80, 140, w - 160, h - 240), { colors: [0xf8fafc, 0xdc2626], sfx: "whack_bonk", scale: 1.4 });
      for (let x = 200; x < w; x += 400) k.light(x, h / 2, 170, 0xe0e7ff, 0.1);
      k.vignette(0.35);
    },
  },

  // Flight KR-069, the cockpit: the windscreen and the sky rushing at it, both consoles, warning lights
  "airport:1": {
    floor: "cockpit",
    build(k) {
      const { w, h } = k.r;
      windows(k, 24, w - 24, (w / 2 - 88) / 2, (w / 2 - 88) / 2 - 16, 420, 0x374151, 0x111827, 4, 48);
      k.animProp("dd_cockpit", 240, 200, { scale: 2.2, block: [170, 50], fps: 6, flashy: true });
      k.animProp("dd_cockpit", w - 240, 200, { scale: 2.2, flip: true, block: [170, 50], fps: 6, flashy: true });
      for (const x of [240, w - 240]) k.light(x, 160, 130, 0x34d399, 0.16, "breathe");
      // the warning lights: STALL, CABIN, HIJACK
      ["STALL", "CABIN", "HIJACK"].forEach((t, i) => {
        const x = 90 + i * 70;
        const lamp = k.sc.add.rectangle(x, h - 50, 52, 14, 0xdc2626, 0.9).setDepth(DEPTH.wall);
        k.text(x, h - 50, t, 7, "#ffffff", { depth: DEPTH.wall + 0.01 });
        if (!k.calm) k.sc.tweens.add({ targets: lamp, alpha: 0.25, yoyo: true, repeat: -1, duration: 260 + i * 70, hold: 200 });
      });
      k.light(w / 2, h * 0.3, 280, 0xbfdbfe, 0.1);
      k.light(w / 2, h - 60, 220, 0xdc2626, 0.08, "breathe");
      scatter(k, [SMALL.cup(k), SMALL.paper(k)], 8, ANY(k), { colors: [0xf8fafc], sfx: "swing", scale: 1.3 });
      k.vignette(0.45);
    },
  },

  // Uncle Rik's transverse colon: the walls squeeze (peristalsis rings roll past), it glistens, it drips, it bubbles
  "rik_colon:0": {
    floor: "colon",
    keepGeneric: true,
    build(k) {
      const { w, h } = k.r;
      const rings = [0, 1].map(() => k.sc.add.ellipse(0, h / 2, 160, h * 1.1).setStrokeStyle(40, 0x4a0d22, 0.18).setDepth(DEPTH.decal + 0.3));
      k.keepLive(...rings);
      k.onUpdate((now) => rings.forEach((r, i) => r.setX(((now / 1000) * 70 + i * (w / 2)) % (w + 200) - 100)));
      for (let i = 0; i < 26; i++) {
        const sp = k.sc.add.ellipse(60 + k.rnd.frac() * (w - 120), 80 + k.rnd.frac() * (h - 120), 10 + k.rnd.frac() * 14, 4 + k.rnd.frac() * 4, 0xffffff, 0.3).setDepth(DEPTH.decal + 0.2);
        k.sc.tweens.add({ targets: sp, alpha: 0.05, yoyo: true, repeat: -1, duration: 900 + k.rnd.between(0, 1600), delay: k.rnd.between(0, 1500) });
      }
      for (const [x, y] of [
        [w * 0.2, h * 0.3],
        [w * 0.45, h * 0.6],
        [w * 0.7, h * 0.35],
        [w * 0.85, h * 0.7],
      ])
        k.drip(x, y - 160, y, 0xf9e4b7, 1800);
      k.motes(26, 0xfda4af, 0.4);
      k.vignette(0.55, 0x2a0010);
    },
  },
};

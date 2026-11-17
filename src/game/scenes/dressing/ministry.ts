import Phaser from "phaser";
import { DEPTH, type Kit } from "./kit";
import type { Dressing } from "./rooms";
import { scatter, SMALL } from "./helpers";

/** THE MINISTRY OF BONER CONTROL (Cronny's lair): Da Squeezing Room and Mollor's cell. */

/** Coils of rope on the floor, and lengths of it hanging off hooks on the back wall. */
const ropes = (k: Kit, spots: [number, number][], hooks: number[]) => {
  const g = k.floorG(DEPTH.decal + 0.2);
  for (const [x, y] of spots) {
    g.lineStyle(4, 0x8a6a3a, 1);
    for (let i = 0; i < 3; i++) g.strokeEllipse(x + i * 2, y - i * 2, 34 - i * 6, 16 - i * 3);
    g.lineStyle(4, 0xd6b370, 1);
    for (let i = 0; i < 3; i++) g.strokeEllipse(x + i * 2, y - i * 2 - 1, 32 - i * 6, 14 - i * 3);
    g.lineBetween(x + 16, y, x + 40, y + 10);
  }
  const wg = k.wallG();
  for (const x of hooks) {
    wg.fillStyle(0x9ca3af).fillRect(x - 2, 8, 4, 4);
    wg.lineStyle(3, 0xd6b370).beginPath();
    wg.moveTo(x, 12);
    wg.lineTo(x - 6, 34);
    wg.lineTo(x + 4, 50);
    wg.strokePath();
    wg.lineBetween(x, 12, x + 7, 40);
  }
};

export const ministry: Record<string, Dressing> = {
  // Da Squeezing Room: pink shag, the heart bed, the cuddle collection in ropes, the heart disco ball
  "ministry:1": {
    floor: "shag",
    wallTint: 0xd08cb0,
    build(k) {
      const { w, h } = k.r;
      k.neon(250, 28, "♥ DA SQUEEZING ROOM ♥", "#ff4fb8", 16);
      k.poster(w - 230, 28, 120, 36, 0xfdf2f8, 0xdb2777, "CUDDLE REGISTER\nMOLLOR ......... ✗\nEVERYONE ELSE ... ✓", "#9d174d", 7);
      k.prop("dd_heartbed", 190, 250, { scale: 1.5, block: [140, 60] });
      k.prop("dd_chaise", w - 170, 190, { scale: 1.7, flip: true, block: [120, 30] });
      // the collection, tied up
      for (const [x, y, f] of [
        [90, 470, false],
        [w - 100, 470, true],
        [250, h - 46, true],
        [w - 260, h - 46, false],
      ] as const)
        k.prop("dd_tiedtoys", x, y, { scale: 1.3, flip: f, block: [80, 24] });
      ropes(
        k,
        [
          [140, 380],
          [w - 150, 600],
          [w / 2 + 210, 300],
        ],
        [120, 150, w - 120, w - 150, w - 400],
      );
      // the heart disco ball, hanging from the ceiling, turning
      const bx = w / 2 + 220;
      const by = 160;
      const line = k.sc.add.rectangle(bx, 0, 1, by - 26, 0xe5e7eb, 0.7).setOrigin(0.5, 0).setDepth(DEPTH.overhead + 1);
      const ball = k.sc.add.image(bx, by, "dd_discoheart").setScale(1.2).setDepth(DEPTH.overhead + 1.1);
      void line;
      k.sc.tweens.add({ targets: ball, scaleX: { from: 1.2, to: 0.9 }, yoyo: true, repeat: -1, duration: k.calm ? 2600 : 1100, ease: "Sine.inOut" });
      k.discoSpots(w / 2, h * 0.52, 9, [0xff4fb8, 0xffffff, 0xc084fc, 0xf9a8d4], 300, 0.2);
      scatter(k, [SMALL.teddy(k), SMALL.bunny(k)], 10, new Phaser.Geom.Rectangle(80, 200, w - 160, h - 300), { colors: [0xb45309, 0xfbcfe8], sfx: "pop", scale: 1.5 });
      k.motes(26, 0xffc0e0, 0.45);
      k.vignette(0.5, 0x3b0024, { color: 0xffc8e4, alpha: 0.45 });
    },
  },

  // Mollor's cell: padded pink walls, beanbags, a barred window, the tally
  "ministry:2": {
    floor: "padded",
    wallTint: 0xe8a0c0,
    build(k) {
      const { w, h } = k.r;
      for (const [x, y, f] of [
        [110, 220, false],
        [120, 470, true],
        [w - 120, 470, false],
        [300, h - 50, true],
        [w - 300, h - 50, false],
      ] as const)
        k.prop("dd_beanbag", x, y, { scale: 1.5, flip: f, block: [56, 22] });
      // the barred window and the light through it
      const wx = 260;
      const g = k.wallG();
      g.fillStyle(0x1e1b4b).fillRect(wx - 28, 8, 56, 40);
      g.fillStyle(0x93c5fd).fillRect(wx - 24, 12, 48, 32);
      g.fillStyle(0x374151);
      for (let i = 0; i < 5; i++) g.fillRect(wx - 22 + i * 10, 12, 3, 32);
      k.shaft(wx, 60, 300, 0xdbeafe, 0.07, 70);
      // the tally on the wall
      const t = k.wallG();
      t.lineStyle(2, 0x9d174d, 0.8);
      for (let n = 0; n < 4; n++) {
        const x0 = w - 300 + n * 30;
        for (let i = 0; i < 4; i++) t.lineBetween(x0 + i * 5, 16, x0 + i * 5, 40);
        t.lineBetween(x0 - 3, 36, x0 + 19, 20);
      }
      k.text(w - 240, 48, "DAYS SINCE LAST SQUEEZE: 0", 7, "#9d174d");
      k.light(w / 2, h * 0.45, 200, 0xffd6e6, 0.14, "breathe");
      k.motes(14, 0xffe4ef, 0.35);
      k.vignette(0.45, 0x2a0018, { color: 0xffd6e6, alpha: 0.35 });
    },
  },
};

import Phaser from "phaser";
import { DEPTH, type Kit } from "./kit";
import type { Dressing } from "./rooms";
import { ANY, gauge, scatter, SMALL, splats, wallClock } from "./helpers";

/** WILDERN ACADEMY (Krelford branch): the corridor, the cafeteria, the boiler room, the Headmaster's office. */

const chalkboard = (k: Kit, x: number, w: number, t: string, size = 8) => k.poster(x, 30, w, 38, 0x1f3b2c, 0x7c5a3a, t, "#e7f0e0", size);

export const wildern: Record<string, Dressing> = {
  // Wildern Corridor: lockers, notices, strip lights, a mopped bit nobody's dried, homework everywhere
  "wildern:0": {
    floor: "lino",
    build(k) {
      const { w, h } = k.r;
      // the corridor: a painted line down the middle, KEEP LEFT arrows
      const g = k.floorG();
      g.fillStyle(0xf59e0b, 0.45);
      for (let x = 60; x < w - 60; x += 46) g.fillRect(x, h * 0.56, 26, 4);
      for (const [x, d] of [
        [w * 0.2, 1],
        [w * 0.8, -1],
      ] as const) {
        g.fillStyle(0xf8fafc, 0.4).fillTriangle(x + d * 26, h * 0.56 + 40, x, h * 0.56 + 28, x, h * 0.56 + 52);
        g.fillRect(x - d * 30 - (d < 0 ? 0 : 0), h * 0.56 + 37, 30, 6);
      }
      k.text(w * 0.5, h * 0.56 + 40, "KEEP LEFT", 12, "#f8fafc", { depth: DEPTH.decal + 0.1, alpha: 0.35 });
      // lockers along the back wall, either side of the door
      for (const [x, flip] of [
        [150, false],
        [330, true],
        [w - 330, false],
        [w - 150, true],
      ] as const)
        k.animProp("dd_lockers", x, 132, { scale: 1.5, flip, block: [130, 28], fps: 9, rest: [2500, 9000] });
      chalkboard(k, 470, 104, "SPELL IT\nSPELL IT\nSPELL IT", 8);
      k.poster(w - 470, 30, 100, 34, 0x1e3a8a, 0xfacc15, "WILDERN\nASPIRE · ACHIEVE\n· KRELFORD ·", "#fde68a", 7);
      wallClock(k, w / 2 + 120, 22);
      // the mopped bit
      k.decal("p_puddle", 250, h * 0.4, 1.4, 0.55);
      k.knockable("dd_wetfloor", 230, h * 0.4 - 4, { scale: 1.3, colors: [0xfacc15, 0x60a5fa], sfx: "whack_bonk", topple: true });
      k.drip(250, h * 0.4 - 150, h * 0.4, 0xbfdbfe, 2200);
      // homework, everywhere
      scatter(k, [SMALL.paper(k)], 14, ANY(k), { colors: [0xf5f5f4, 0x93c5fd], sfx: "swing", scale: 1.3 });
      k.stripLights([200, 470], [w * 0.2, w * 0.5, w * 0.8], 0xe0f2fe, 0.16, 2);
      k.motes(16, 0xffffff, 0.3);
      k.vignette(0.35);
      // radiators under the front wall
      const rg = k.sc.add.graphics().setDepth(DEPTH.wall);
      for (const x of [200, w - 200]) {
        rg.fillStyle(0xd6d3d1).fillRect(x - 50, h - 22, 100, 14);
        rg.fillStyle(0xa8a29e);
        for (let i = 0; i < 10; i++) rg.fillRect(x - 48 + i * 10, h - 21, 2, 12);
      }
    },
  },

  // The Cafeteria: the dinner-lady hatch, long tables, trays, beans on the floor, steam off the bain-maries
  "wildern:1": {
    floor: "caf",
    build(k) {
      const { w, h } = k.r;
      chalkboard(k, 430, 130, "TODAY: BEANS\nTOMORROW: BEANS\nFRI: FISH (IN BEANS)", 7);
      k.poster(w - 140, 30, 110, 34, 0xfef3c7, 0xdc2626, "EAT YOUR GREENS\n(THERE ARE NO\nGREENS)", "#7f1d1d", 7);
      wallClock(k, 260, 26);
      // the servery: the hatch, the hot counters, the steam
      for (const x of [w - 350, w - 180]) {
        k.animProp("dd_servery", x, 158, { scale: 2, block: [160, 40], fps: 6 });
        k.steam(x - 30, 120, { every: 1000, alpha: 0.28, size: 0.8, dist: 50 });
        k.steam(x + 30, 120, { every: 1300, alpha: 0.22, size: 0.7, dist: 50 });
        k.light(x, 150, 110, 0xffc66b, 0.14, "breathe");
      }
      k.poster(w - 265, 66, 110, 14, 0xb91c1c, 0x111111, "HATCH · NO PUSHING", "#ffffff", 7);
      // long tables (cover), trays, cups
      for (const [x, y] of [
        [260, 400],
        [260, 610],
        [w - 260, 400],
        [w - 260, 610],
      ]) {
        k.prop("dd_dinnertable", x, y, { scale: 1.5, block: [170, 36] });
        k.light(x, y - 20, 140, 0xfff3d6, 0.1);
      }
      splats(k, 12, [0xc2410c, 0xea580c, 0xfde047], ANY(k), 10, 0.7);
      scatter(k, [SMALL.tray(k), SMALL.cup(k), SMALL.tray(k)], 16, ANY(k), { colors: [0x9ca3af, 0xc2410c, 0xfacc15], sfx: "plate_smash", scale: 1.4 });
      k.stripLights([260, 560], [w * 0.25, w * 0.5, w * 0.75], 0xfff7e6, 0.13, 1);
      k.motes(12, 0xfff7e6, 0.3);
      k.vignette(0.3);
    },
  },

  // The Boiler Room: two boilers roaring, pipes everywhere, steam, gauges in the red, drips, coal
  "wildern:2": {
    floor: "concrete",
    ambience: "factory",
    wallTint: 0x8a7060,
    build(k) {
      const { w, h } = k.r;
      // pipes: along the back wall (round the door), down both side walls
      const pg = k.sc.add.graphics().setDepth(DEPTH.overhead - 3);
      const pipe = (x0: number, y0: number, x1: number, y1: number, r = 7) => {
        pg.lineStyle(r * 2, 0x3f3a36).lineBetween(x0, y0, x1, y1);
        pg.lineStyle(r, 0x6b6159).lineBetween(x0, y0, x1, y1);
        pg.lineStyle(2, 0x9a8b7d).lineBetween(x0 + (y0 === y1 ? 0 : -r / 2), y0 + (y0 === y1 ? -r / 2 : 0), x1 + (y0 === y1 ? 0 : -r / 2), y1 + (y0 === y1 ? -r / 2 : 0));
      };
      pipe(30, 70, w / 2 - 110, 70);
      pipe(w / 2 + 110, 70, w - 30, 70);
      pipe(w / 2 - 110, 70, w / 2 - 110, 20);
      pipe(w / 2 + 110, 70, w / 2 + 110, 20);
      pipe(36, 70, 36, h - 40, 6);
      pipe(w - 36, 70, w - 36, h - 40, 6);
      pipe(30, 86, w / 2 - 140, 86, 4);
      // joints and gauges
      pg.fillStyle(0x292524);
      for (const x of [140, 300, 460, w - 460, w - 300, w - 140]) pg.fillRect(x - 5, 60, 10, 20);
      for (const y of [200, 380, 560]) {
        pg.fillRect(28, y - 5, 16, 10);
        pg.fillRect(w - 44, y - 5, 16, 10);
      }
      gauge(k, 300, 70, 8, true);
      gauge(k, w - 300, 70, 8);
      gauge(k, 36, 380, 7);
      gauge(k, w - 36, 200, 7, true);
      k.steam(140, 72, { burst: true, every: 900, alpha: 0.45, dir: Math.PI / 2, dist: 80 });
      k.steam(w - 460, 72, { burst: true, every: 1100, alpha: 0.45, dir: Math.PI / 2, dist: 80 });
      k.steam(44, 560, { every: 1500, alpha: 0.3, dir: 0.2, dist: 90 });
      k.steam(w - 44, 380, { every: 1700, alpha: 0.3, dir: Math.PI - 0.2, dist: 90 });
      // the boilers
      for (const [x, y, flip] of [
        [200, 330, false],
        [w - 210, 590, true],
      ] as const) {
        k.animProp("dd_boiler", x, y, { scale: 1.8, flip, block: [140, 70], fps: 7 });
        const fx = x + (flip ? 34 : -34);
        k.light(fx, y - 30, 120, 0xff7a1a, 0.32, "fire");
        k.steam(x + (flip ? -20 : 20), y - 150, { every: 950, alpha: 0.35, size: 1.1 });
      }
      // a grate in the floor with the furnace glowing under it
      const gg = k.floorG(DEPTH.decal + 0.05);
      for (const [x, y] of [
        [w * 0.5, h * 0.48],
        [w * 0.3, h * 0.78],
      ]) {
        gg.fillStyle(0x1c1917).fillRect(x - 34, y - 20, 68, 40);
        gg.fillStyle(0xea580c, 0.55).fillRect(x - 30, y - 16, 60, 32);
        gg.fillStyle(0x292524);
        for (let i = 0; i < 7; i++) gg.fillRect(x - 30 + i * 10, y - 16, 4, 32);
        k.light(x, y, 80, 0xff6a00, 0.22, "fire");
        k.steam(x, y, { every: 2400, alpha: 0.18, color: 0xffd0a0, size: 0.8, dist: 40 });
      }
      k.prop("dd_coalpile", 110, h - 50, { scale: 1.6, block: [80, 26] });
      k.prop("dd_coalpile", w - 120, 300, { scale: 1.4, flip: true, block: [70, 22] });
      k.drip(460, 120, 300, 0x9ca3af, 1500);
      k.drip(w - 520, 120, 420, 0x9ca3af, 1900);
      k.poster(w / 2 - 230, 32, 120, 36, 0xfacc15, 0x111111, "DANGER: HOT\nDO NOT TOUCH\n(ESP. YOU, KRANDALL)", "#111111", 7);
      k.light(w / 2, h * 0.45, 260, 0xffb060, 0.12, "breathe");
      k.motes(20, 0xffb070, 0.4);
      k.vignette(0.6, 0x000000, { color: 0xffc9a0, alpha: 0.45 });
    },
  },

  // The Headmaster's Office (on top of the Main): parquet, a big red rug, the desk, the trophy cabinet, the windows
  "wildern:3": {
    floor: "parquet",
    build(k) {
      const { w, h } = k.r;
      // the rug
      const rg = k.floorG();
      const rw = 640;
      const rh = 420;
      const cx = w / 2;
      const cy = h * 0.56;
      rg.fillStyle(0x000000, 0.25).fillRect(cx - rw / 2 + 4, cy - rh / 2 + 6, rw, rh);
      rg.fillStyle(0x6b1a1a).fillRect(cx - rw / 2, cy - rh / 2, rw, rh);
      rg.lineStyle(6, 0xca8a04).strokeRect(cx - rw / 2 + 14, cy - rh / 2 + 14, rw - 28, rh - 28);
      rg.lineStyle(2, 0xfde68a, 0.6).strokeRect(cx - rw / 2 + 26, cy - rh / 2 + 26, rw - 52, rh - 52);
      rg.fillStyle(0x7f1d1d).fillEllipse(cx, cy, 220, 140);
      rg.lineStyle(3, 0xca8a04).strokeEllipse(cx, cy, 220, 140);
      k.text(cx, cy, "W", 64, "#ca8a04", { depth: DEPTH.decal + 0.1, font: "Georgia, serif", alpha: 0.7 });
      // the windows (light pouring in) and the portraits
      for (const x of [w * 0.36, w * 0.64]) {
        const g = k.wallG();
        g.fillStyle(0x3b2a1a).fillRect(x - 40, 4, 80, 50);
        g.fillStyle(0x93c5fd).fillRect(x - 36, 8, 72, 44);
        g.fillStyle(0xdbeafe).fillRect(x - 36, 8, 72, 12);
        g.fillStyle(0x3b2a1a).fillRect(x - 2, 8, 4, 44).fillRect(x - 36, 28, 72, 3);
        k.shaft(x, 70, 340, 0xfff1c1, 0.07, x < w / 2 ? -80 : 80);
      }
      for (const [x, t] of [
        [w * 0.17, "KRANDALL\n1987–"],
        [w * 0.83, "KRANDALL\n(AGAIN)"],
      ] as const)
        k.poster(x, 28, 54, 44, 0x44403c, 0xca8a04, t, "#fde68a", 7);
      k.poster(w / 2 + 140, 22, 70, 22, 0xfef3c7, 0xca8a04, "HEAD OF THE YEAR\n(SELF-AWARDED)", "#7c2d12", 6);
      // the furniture
      k.prop("dd_bookshelf", 110, 150, { scale: 1.7, block: [100, 30] });
      k.prop("dd_bookshelf", w - 110, 150, { scale: 1.7, flip: true, block: [100, 30] });
      k.animProp("dd_trophies", w - 270, 140, { scale: 1.6, block: [80, 26], fps: 10, rest: [3000, 7000], flashy: true });
      k.prop("dd_headdesk", 330, 230, { scale: 1.6, block: [130, 44] });
      k.prop("dec_mansion_2", 70, h - 60, { scale: 1.2 });
      k.prop("dec_mansion_2", w - 70, h - 60, { scale: 1.2 });
      k.light(330 - 40, 170, 90, 0x86efac, 0.14, "breathe"); // the green banker's lamp
      scatter(k, [SMALL.paper(k)], 8, new Phaser.Geom.Rectangle(220, 240, 300, 160), { colors: [0xf5f5f4], sfx: "swing", scale: 1.3 });
      k.motes(10, 0xfff1c1, 0.4);
      k.vignette(0.4, 0x000000, { color: 0xffe6c0, alpha: 0.3 });
    },
  },
};

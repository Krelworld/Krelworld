import Phaser from "phaser";
import { DEPTH, type Kit } from "./kit";
import type { Dressing } from "./rooms";
import { ANY, fairyLights, scatter, SMALL, splats } from "./helpers";

/** The arena boss rooms: the BJJ Open, the Krezz Arms back room, the old flat, Krunch Gym. */

export const arenas: Record<string, Dressing> = {
  // Krelford University Sports Hall: a sprung floor with court lines, the competition mats, the scorers' table
  "arena_brand:0": {
    floor: "hall",
    build(k) {
      const { w, h } = k.r;
      // court lines (it's a basketball court the rest of the week)
      const g = k.floorG();
      g.lineStyle(3, 0xdc2626, 0.6).strokeRect(50, 80, w - 100, h - 120);
      g.lineStyle(3, 0x2563eb, 0.5).strokeCircle(w / 2, h / 2 + 20, 70);
      g.lineStyle(3, 0xdc2626, 0.5);
      g.beginPath();
      g.arc(50, h / 2 + 20, 170, -Math.PI / 2, Math.PI / 2);
      g.strokePath();
      g.beginPath();
      g.arc(w - 50, h / 2 + 20, 170, Math.PI / 2, Math.PI * 1.5);
      g.strokePath();
      // the mats: blue tatami, a red danger zone round the edge
      const mw = 620;
      const mh = 420;
      const mx = w / 2 - mw / 2;
      const my = h / 2 + 20 - mh / 2;
      const m = k.floorG(DEPTH.decal + 0.1);
      m.fillStyle(0x000000, 0.25).fillRect(mx + 4, my + 6, mw, mh);
      m.fillStyle(0xb91c1c).fillRect(mx, my, mw, mh);
      m.fillStyle(0x2f5fa8).fillRect(mx + 40, my + 40, mw - 80, mh - 80);
      m.lineStyle(2, 0x1d3f75, 0.9);
      for (let x = mx + 40; x <= mx + mw - 40; x += 54) m.lineBetween(x, my + 40, x, my + mh - 40);
      for (let y = my + 40; y <= my + mh - 40; y += 54) m.lineBetween(mx + 40, y, mx + mw - 40, y);
      m.lineStyle(2, 0x7f1d1d, 0.9);
      for (let x = mx; x <= mx + mw; x += 40) m.lineBetween(x, my, x, my + 40).lineBetween(x, my + mh - 40, x, my + mh);
      // the start marks
      m.fillStyle(0xffffff, 0.8).fillRect(w / 2 - 90, h / 2 + 14, 30, 8).fillRect(w / 2 + 60, h / 2 + 14, 30, 8);
      k.text(w / 2, my + mh - 20, "KRELFORD UNI BJJ", 12, "#fde68a", { depth: DEPTH.decal + 0.2, alpha: 0.7 });
      // the hall
      k.poster(w / 2 - 250, 28, 200, 34, 0x1e3a8a, 0xfacc15, "KRELFORD UNIVERSITY\nBJJ OPEN 2026", "#fde68a", 9);
      k.poster(w / 2 + 250, 28, 80, 30, 0x111827, 0x6b7280, "MAT 1\n00:00", "#f87171", 9);
      k.text(w / 2 + 190, 28, "OSS", 14, "#ffffff", { font: "Impact, sans-serif", alpha: 0.8 });
      k.animProp("dd_scorers", 190, 170, { scale: 1.5, block: [130, 34], fps: 4 });
      for (const [x, y, a] of [
        [70, 330, 90],
        [70, 520, 90],
        [w - 70, 330, -90],
        [w - 70, 520, -90],
      ])
        k.prop("p_bench", x, y, { scale: 1.6, angle: a, origin: [0.5, 0.5], block: [40, 90] });
      scatter(k, [SMALL.bottle(k)], 10, new Phaser.Geom.Rectangle(40, 260, 80, 330), { colors: [0x93c5fd, 0x1d4ed8], sfx: "pop", scale: 1.4 });
      scatter(k, [SMALL.bottle(k)], 6, new Phaser.Geom.Rectangle(w - 120, 260, 80, 330), { colors: [0x93c5fd, 0x1d4ed8], sfx: "pop", scale: 1.4 });
      // the big hall lights
      for (const x of [w * 0.28, w * 0.72]) for (const y of [h * 0.35, h * 0.75]) k.light(x, y, 190, 0xf0f8ff, 0.12);
      k.motes(12, 0xffffff, 0.25);
      k.vignette(0.3);
    },
  },

  // The Krezz Arms back room, Blues Night: the little stage (smoke machine, blue spot), tables of pints, the jukebox
  "arena_troll:0": {
    floor: "pub",
    ambience: "pub",
    build(k) {
      const { w, h } = k.r;
      // the sticky carpet in the middle
      k.sc.add.tileSprite(140, 230, w - 280, h - 300, "tile_hall").setOrigin(0).setDepth(DEPTH.decal - 0.1).setAlpha(0.85).setTint(0x9a6a6a);
      splats(k, 10, [0x78350f, 0xa16207], ANY(k), 12, 0.35);
      // the stage
      const sx = w - 200;
      const sy = 220;
      k.animProp("dd_pubstage", sx, sy, { scale: 1.8, block: [170, 60], fps: 10 });
      k.light(sx, sy - 70, 150, 0x3b82f6, 0.3, "breathe");
      k.light(sx - 40, sy - 50, 90, 0xf59e0b, 0.18, "breathe");
      k.steam(sx + 70, sy - 20, { every: 900, color: 0xc7d2fe, alpha: 0.25, size: 1.4, dir: Math.PI * 0.8, dist: 110 });
      k.neon(sx, 26, "BLUES NIGHT", "#60a5fa", 15);
      k.poster(180, 30, 120, 36, 0x111111, 0x78350f, "TONIGHT: ALISTAIR\n8PM TIL HE STOPS\nNO REQUESTS", "#f5f5f4", 7);
      // a dartboard
      const dg = k.wallG();
      dg.fillStyle(0x111111).fillCircle(360, 28, 15);
      for (let i = 0; i < 10; i++) dg.fillStyle(i % 2 ? 0xdc2626 : 0x16a34a).slice(360, 28, 13, (i / 10) * Math.PI * 2, ((i + 1) / 10) * Math.PI * 2).fillPath();
      dg.fillStyle(0xf5f5dc).fillCircle(360, 28, 8);
      dg.fillStyle(0xdc2626).fillCircle(360, 28, 2);
      fairyLights(k, 420, w / 2 - 110, 6);
      for (const [x, y] of [
        [150, 300],
        [150, 560],
        [w - 160, 480],
        [w / 2 - 280, h - 80],
      ]) {
        k.prop("dd_pubtable", x, y, { scale: 1.5, block: [80, 30] });
        k.light(x, y - 30, 90, 0xffb347, 0.12);
      }
      k.animProp("dd_jukebox", w - 70, h - 60, { scale: 1.6, block: [50, 24] });
      k.light(w - 70, h - 90, 80, 0xf472b6, 0.2, "breathe");
      scatter(k, [SMALL.pint(k)], 14, ANY(k), { colors: [0xb45309, 0xfef3c7], sfx: "plate_smash", scale: 1.5 });
      // a fug of smoke under the ceiling
      for (const [x, y] of [
        [w * 0.3, h * 0.4],
        [w * 0.6, h * 0.6],
      ])
        k.steam(x, y, { every: 1400, color: 0x9ca3af, alpha: 0.12, size: 2, dir: 0, dist: 90 });
      k.motes(18, 0xffd29a, 0.3);
      k.vignette(0.55, 0x000000, { color: 0xffcf9a, alpha: 0.35 });
    },
  },

  // The Old Flat (carpet: destroyed): the ruined sofa, cans, laundry, rain on the window, a bare bulb
  "arena_flatmate:0": {
    floor: "flat",
    weather: "amb_rain",
    build(k) {
      const { w, h } = k.r;
      // the window, raining
      const wx = w / 2 - 250;
      const g = k.wallG();
      g.fillStyle(0xe7e5e4).fillRect(wx - 54, 4, 108, 48);
      g.fillStyle(0x334155).fillRect(wx - 50, 8, 100, 40);
      g.fillStyle(0xe7e5e4).fillRect(wx - 2, 8, 4, 40).fillRect(wx - 50, 26, 100, 3);
      const rain = k.sc.add.graphics().setDepth(DEPTH.wall + 0.03);
      const drops = Array.from({ length: 14 }, () => ({ x: wx - 48 + Math.random() * 96, y: 8 + Math.random() * 38, v: 30 + Math.random() * 40 }));
      k.onUpdate((_, dt) => {
        rain.clear();
        rain.lineStyle(1, 0x93c5fd, 0.7);
        for (const d of drops) {
          d.y += (d.v * dt) / 1000;
          if (d.y > 46) {
            d.y = 8;
            d.x = wx - 48 + Math.random() * 96;
          }
          rain.lineBetween(d.x, d.y, d.x - 1, d.y + 4);
        }
      });
      k.shaft(wx, 90, 240, 0x94a3b8, 0.05, 50);
      // damp, a fist hole, the poster
      const dg = k.wallG();
      dg.fillStyle(0x3f4a2a, 0.5).fillEllipse(w - 160, 14, 120, 28).fillEllipse(80, 40, 90, 30);
      dg.fillStyle(0x1c1917).fillEllipse(w / 2 + 170, 30, 18, 14);
      dg.lineStyle(1, 0x1c1917).lineBetween(w / 2 + 160, 22, w / 2 + 150, 16).lineBetween(w / 2 + 180, 36, w / 2 + 190, 42);
      k.poster(w / 2 + 270, 28, 60, 44, 0x111111, 0xdc2626, "KREZ\nFACE", "#dc2626", 11, 3);
      // the furniture
      k.animProp("dd_ruinedsofa", 210, 220, { scale: 1.6, block: [170, 46], fps: 12, rest: [2500, 7000] });
      k.animProp("dd_cantable", 220, 330, { scale: 1.3, block: [90, 26], fps: 8, rest: [3000, 8000] });
      k.flies(210, 190, 5, 40);
      k.prop("dd_laundry", w - 120, 260, { scale: 1.5, block: [80, 22] });
      k.prop("dd_laundry", 100, 540, { scale: 1.4, flip: true, block: [76, 22] });
      k.animProp("dd_pizzaboxes", w - 80, 520, { scale: 1.5, block: [40, 18], fps: 8, rest: [2500, 8000] });
      k.animProp("dd_binbags", w - 150, h - 50, { scale: 1.5, block: [90, 24], fps: 8, rest: [3000, 9000] });
      k.flies(w - 150, h - 80, 4, 20);
      k.prop("dd_binbags", 180, h - 50, { scale: 1.3, flip: true, block: [76, 22] });
      splats(k, 9, [0x3b2a1a, 0x7c5a1a, 0x52525b], ANY(k), 16, 0.4);
      scatter(k, [SMALL.can(k), SMALL.sock(k), SMALL.can(k), SMALL.pizza(k)], 18, ANY(k), { colors: [0xdc2626, 0xe7e5e4], sfx: "whack_bonk", scale: 1.5 });
      // the bare bulb, buzzing
      const bulb = k.light(w / 2, h * 0.42, 260, 0xffe2a8, 0.2, "buzz");
      const cord = k.sc.add.rectangle(w / 2, 0, 2, h * 0.42 - 70, 0x111111, 0.6).setOrigin(0.5, 0).setDepth(DEPTH.overhead);
      const glass = k.sc.add.circle(w / 2, h * 0.42 - 66, 5, 0xfff7d6).setDepth(DEPTH.overhead);
      void bulb;
      k.sc.tweens.add({ targets: [cord, glass], angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 2200, ease: "Sine.inOut" });
      k.motes(16, 0xffe2a8, 0.3);
      k.vignette(0.6, 0x000000, { color: 0xd8d0c0, alpha: 0.4 });
    },
  },

  // Krunch Gym, the Squat Rack of Destiny: rubber floor, the mirror wall, racks, dumbbells, chalk in the air
  "arena_rival:0": {
    floor: "gym",
    build(k) {
      const { w, h } = k.r;
      // the mirror wall, a shine going along it
      const mg = k.wallG();
      const panels: number[] = [];
      for (let x = 40; x < w - 40; x += 120) if (Math.abs(x + 50 - w / 2) > 110) panels.push(x);
      for (const x of panels) {
        mg.fillStyle(0x9ca3af).fillRect(x - 2, 2, 104, 52);
        mg.fillStyle(0xbfd4e6).fillRect(x, 4, 100, 48);
        mg.fillStyle(0xe5f0fa, 0.6).fillRect(x, 4, 100, 10);
        const shine = k.sc.add.rectangle(x + 8, 28, 10, 48, 0xffffff, 0.45).setAngle(18).setDepth(DEPTH.wall + 0.02).setBlendMode(Phaser.BlendModes.ADD);
        k.sc.tweens.add({ targets: shine, x: x + 92, duration: 1800, repeat: -1, repeatDelay: 2500 + Math.random() * 2000, delay: Math.random() * 2000 });
      }
      k.text(w / 2 - 300, 28, "NO KRUNCH", 18, "#111827", { font: "Impact, sans-serif", alpha: 0.75 });
      k.text(w / 2 + 300, 28, "NO LUNCH", 18, "#111827", { font: "Impact, sans-serif", alpha: 0.75 });
      // the kit
      k.prop("dd_squatrack", 230, 190, { scale: 1.4, block: [90, 34] });
      k.prop("dd_squatrack", w - 230, 190, { scale: 1.4, flip: true, block: [90, 34] });
      k.text(w - 230, 204, "THE SQUAT RACK OF DESTINY", 7, "#fde68a", { depth: DEPTH.prop + 0.95 }).setBackgroundColor("#111827").setPadding(2, 1);
      k.prop("dd_dumbbells", 100, 420, { scale: 1.6, block: [130, 30] });
      k.prop("dd_dumbbells", w - 100, 420, { scale: 1.6, flip: true, block: [130, 30] });
      k.prop("dd_benchpress", 140, h - 60, { scale: 1.5, block: [100, 30] });
      k.prop("dd_plates", w - 120, h - 60, { scale: 1.6, block: [60, 24] });
      k.animProp("p_treadmill", w - 260, h - 40, { scale: 1.2, block: [80, 24], fps: 12 });
      // chalk: handprints and spilt buckets on the floor, dust in the air
      const cg = k.floorG();
      for (let i = 0; i < 10; i++) {
        const x = 90 + k.rnd.frac() * (w - 180);
        const y = 140 + k.rnd.frac() * (h - 220);
        // a chalky handprint: palm and four fingers, and a dusting round it
        cg.fillStyle(0xf4f4f5, 0.08).fillEllipse(x, y, 34, 18);
        cg.fillStyle(0xffffff, 0.3).fillEllipse(x, y + 3, 8, 9);
        for (let f = 0; f < 4; f++) cg.fillRect(x - 5 + f * 3, y - 6 - (f === 1 || f === 2 ? 2 : 0), 2, 5);
      }
      scatter(k, [SMALL.chalk(k), SMALL.bottle(k)], 10, ANY(k), { colors: [0xf4f4f5, 0x52525b], sfx: "whack_bonk", scale: 1.5 });
      for (const x of [w * 0.25, w * 0.5, w * 0.75]) k.light(x, h * 0.5, 180, 0xffffff, 0.1);
      k.motes(34, 0xffffff, 0.45);
      k.vignette(0.35);
    },
  },
};

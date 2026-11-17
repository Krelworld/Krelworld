import Phaser from "phaser";
import { DEPTH, type Kit } from "./kit";
import type { Dressing } from "./rooms";
import { ANY, fairyLights, scatter, SMALL, splats } from "./helpers";

/** POLSON TOWERS: Eden's stuff, everywhere. The hallway, the kitchen (the Mould Zone), the bedroom, the living room. */

const label = (k: Kit, x: number, y: number, t = "EDEN'S. DO NOT TOUCH.") => {
  const tag = k.text(x, y, t, 7, "#3b2a1a", { depth: DEPTH.prop + 0.95 });
  tag.setBackgroundColor("#fef3c7").setPadding(2, 1).setAngle(k.rnd.between(-12, 12));
  return tag;
};

const plushies = (k: Kit) => [SMALL.teddy(k), SMALL.bunny(k), SMALL.unicorn(k)];

export const polson: Record<string, Dressing> = {
  // The Hallway: you can't see the floor for stuffed toys, parcels and shoes. A runner, some wonky frames.
  "polson_towers:0": {
    floor: "beige",
    build(k) {
      const { w, h } = k.r;
      // the hall runner, door to front door
      const g = k.floorG();
      g.fillStyle(0x7f1d1d, 0.9).fillRect(w / 2 - 70, 60, 140, h - 84);
      g.lineStyle(4, 0xb45309, 0.9).strokeRect(w / 2 - 62, 68, 124, h - 100);
      g.fillStyle(0x991b1b, 0.9);
      for (let y = 110; y < h - 60; y += 70) g.fillTriangle(w / 2, y - 20, w / 2 + 26, y, w / 2, y + 20).fillTriangle(w / 2, y - 20, w / 2 - 26, y, w / 2, y + 20);
      // the walls: frames hung wonky
      k.poster(220, 28, 70, 36, 0xfdf2f8, 0xd4af37, "LIVE\nLAUGH\nEDEN", "#9d174d", 8, -4);
      k.poster(380, 26, 46, 34, 0x93c5fd, 0x78350f, "EDEN\n& EDEN", "#1e3a8a", 7, 6);
      k.poster(w - 380, 28, 80, 30, 0xfef3c7, 0x78350f, "THIS HOUSE RUNS\nON EDEN TIME", "#78350f", 7, -3);
      k.poster(w - 220, 28, 40, 40, 0xe0f2fe, 0xa8a29e, "(a mirror)", "#64748b", 6, 2);
      // the stuff
      k.prop("dd_shoerack", 120, 150, { scale: 1.5, block: [120, 30] });
      k.animProp("dd_toypile", 90, 340, { scale: 1.6, block: [70, 22], fps: 6, rest: [4000, 12000] });
      k.animProp("dd_toypile", w - 90, 470, { scale: 1.7, flip: true, block: [76, 22], fps: 6, rest: [4000, 12000] });
      k.animProp("dd_toypile", 190, h - 50, { scale: 1.5, block: [70, 20], fps: 6, rest: [4000, 12000] });
      k.animProp("dd_toypile", w - 200, h - 50, { scale: 1.4, flip: true, block: [64, 20], fps: 6, rest: [4000, 12000] });
      k.prop("dd_toymountain", w - 150, 210, { scale: 0.75, block: [110, 30] });
      label(k, 90, 360);
      label(k, w - 90, 490);
      // parcels (Amazon, all hers), stacked by the door
      for (const [x, y] of [
        [w / 2 - 170, 120],
        [w / 2 - 150, 132],
        [w / 2 + 160, 126],
        [w / 2 + 182, 118],
        [w / 2 + 170, 140],
      ])
        k.knockable(SMALL.parcel(k), x, y, { scale: 1.5, colors: [0xb7834a, 0xd6b98c], sfx: "door", angle: k.rnd.between(-10, 10) });
      scatter(k, plushies(k), 16, ANY(k), { colors: [0xb45309, 0xfbcfe8, 0xf5f3ff], sfx: "pop", scale: 1.5 });
      for (const y of [220, 470]) k.light(w / 2, y, 170, 0xffe0a0, 0.16, "breathe");
      k.motes(18, 0xffe7c2, 0.35);
      k.vignette(0.45, 0x000000, { color: 0xffe2c4, alpha: 0.4 });
    },
  },

  // The Kitchen — the Mould Zone: the sink, the fridge (oozing), pizza box towers, bin bags, flies, a sick light
  "polson_towers:1": {
    floor: "kitchen",
    ambience: "dungeon",
    build(k) {
      const { w, h } = k.r;
      k.animProp("dd_sink", 260, 160, { scale: 1.8, block: [130, 40], fps: 6, rest: [600, 1800] });
      k.prop("dd_sink", 410, 160, { scale: 1.8, flip: true, block: [130, 40] });
      // the fridge, and what's coming out of it
      const fx = w - 330;
      k.animProp("dd_mouldfridge", fx, 170, { scale: 1.9, block: [80, 34] });
      splats(k, 9, [0x4d7c0f, 0x65a30d, 0x84cc16], new Phaser.Geom.Rectangle(fx - 30, 190, 60, 160), 12, 0.7);
      k.flies(fx, 150, 5, 26);
      k.drip(fx + 26, 130, 196, 0x84cc16, 1300);
      k.poster(fx, 30, 130, 34, 0xfefce8, 0x65a30d, "DO NOT THROW ANYTHING AWAY.\nI MIGHT NEED IT.  — E", "#3f6212", 7, -2);
      k.poster(560, 26, 50, 40, 0xffffff, 0x9ca3af, "MARCH\n(STILL)", "#dc2626", 8, 3);
      // the pizza box towers
      for (const [x, y, s] of [
        [80, 300, 1.6],
        [130, 330, 1.4],
        [80, 520, 1.7],
        [w - 80, 420, 1.6],
        [w - 130, 440, 1.3],
        [w - 520, 160, 1.4],
      ])
        k.animProp("dd_pizzaboxes", x, y, { scale: s, block: [44, 18], fps: 8, rest: [2500, 8000] });
      for (const [x, y, f] of [
        [110, h - 50, false],
        [w - 120, h - 50, true],
        [w - 90, 620, false],
      ] as const) {
        k.animProp("dd_binbags", x, y, { scale: 1.6, flip: f, block: [90, 26], fps: 8, rest: [3000, 9000] });
        k.flies(x, y - 30, 4, 20);
      }
      // mould growing in the grout (breathing), cartons, cans, the odd pizza
      splats(k, 14, [0x3f6212, 0x4d7c0f, 0x65a30d], ANY(k), 16, 0.45);
      splats(k, 8, [0x7c2d12, 0xb45309], ANY(k), 10, 0.5);
      scatter(k, [SMALL.carton(k), SMALL.can(k), SMALL.pizza(k), SMALL.can(k)], 18, ANY(k), { colors: [0xf4f4f5, 0xdc2626, 0x65a30d], sfx: "squelch", scale: 1.5 });
      k.stripLights([250, 520], [w * 0.3, w * 0.7], 0xd9f99d, 0.15, 0);
      k.motes(14, 0xbef264, 0.35);
      k.vignette(0.5, 0x000000, { color: 0xd8f0c0, alpha: 0.5 });
    },
  },

  // The Bedroom — Stuffed Toy Mountain (the hamster at the summit), her bed of teddies, fairy lights
  "polson_towers:2": {
    floor: "pink",
    build(k) {
      const { w, h } = k.r;
      fairyLights(k, 40, w / 2 - 110);
      fairyLights(k, w / 2 + 110, w - 40);
      k.prop("dd_teddybed", 220, 250, { scale: 1.5, block: [140, 70] });
      k.text(220, 266, "POLSON SLEEPS HERE →", 7, "#7c2d12", { depth: DEPTH.prop + 0.95 }).setBackgroundColor("#fef3c7").setPadding(2, 1);
      // the mountain
      const mx = w - 250;
      const my = 330;
      k.prop("dd_toymountain", mx, my, { scale: 1.6, block: [240, 80] });
      k.light(mx, my - 120, 200, 0xfff1f2, 0.12, "breathe");
      // the one thing in here with his name on it
      k.animProp("dd_hamster", mx - 190, my + 40, { scale: 1.3, block: [50, 20] });
      label(k, mx - 190, my + 54, "POLSON'S");
      for (const [x, y, f] of [
        [90, 470, false],
        [w - 90, 560, true],
        [200, h - 50, false],
        [w - 220, h - 50, true],
        [w / 2 - 230, 130, false],
      ] as const) {
        k.animProp("dd_toypile", x, y, { scale: 1.5, flip: f, block: [64, 20], fps: 6, rest: [4000, 12000] });
        label(k, x, y + 14);
      }
      scatter(k, plushies(k), 24, ANY(k), { colors: [0xb45309, 0xfbcfe8, 0xf5f3ff, 0xfde047], sfx: "pop", scale: 1.6 });
      for (const [x, y] of [
        [w * 0.3, h * 0.55],
        [w * 0.7, h * 0.7],
      ])
        k.light(x, y, 180, 0xffc0d8, 0.14, "breathe");
      k.motes(22, 0xfff1f2, 0.4);
      k.vignette(0.4, 0x000000, { color: 0xffd6e6, alpha: 0.4 });
    },
  },

  // The Living Room (already furnished, cleared for the fight): lamplight, dust, and the hoard's flies
  "polson_towers:3": {
    keepGeneric: true,
    build(k) {
      const { w, h } = k.r;
      k.light(w / 2, 170, 220, 0xffd9a0, 0.18, "breathe");
      k.light(w * 0.3, 90, 140, 0xfff1c1, 0.1);
      k.flies(w / 2, h * 0.4, 6, 60);
      k.motes(24, 0xffe7c2, 0.35);
      k.vignette(0.45, 0x000000, { color: 0xffe2c4, alpha: 0.35 });
    },
  },
};

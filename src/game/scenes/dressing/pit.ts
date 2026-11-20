import { DEPTH, type Kit } from "./kit";
import type { Dressing } from "./rooms";
import { ANY, scatter, SMALL } from "./helpers";

/**
 * THE KRUNCH PIT (systems/pit.ts): the gauntlet's ring under Krunch Gym, and the test range next door. The gym's
 * rubber floor and kit (the same PixelLab props as Krunch Gym's Squat Rack of Destiny), a painted ring, red lights.
 * Kept clear in the middle: the waves come in from everywhere.
 */
function sign(k: Kit, text: string, sub: string) {
  const { w } = k.r;
  const g = k.wallG();
  g.fillStyle(0x111827).fillRoundedRect(w / 2 - 330, 6, 200, 40, 6).fillRoundedRect(w / 2 + 130, 6, 200, 40, 6);
  g.lineStyle(2, 0xef4444, 0.9).strokeRoundedRect(w / 2 - 330, 6, 200, 40, 6).strokeRoundedRect(w / 2 + 130, 6, 200, 40, 6);
  k.text(w / 2 - 230, 20, text, 14, "#f87171", { font: "Impact, sans-serif" });
  k.text(w / 2 - 230, 37, sub, 8, "#fecaca");
  k.text(w / 2 + 230, 20, "NO REFUNDS", 14, "#facc15", { font: "Impact, sans-serif" });
  k.text(w / 2 + 230, 37, "NO CRYING · NO LORE", 8, "#fef3c7");
}

export const pit: Record<string, Dressing> = {
  "pit_gauntlet:0": {
    floor: "gym",
    floorTint: 0xd8c8c8,
    build(k) {
      const { w, h } = k.r;
      sign(k, "THE KRUNCH PIT", "FIGHTS NIGHTLY · EVERY NIGHT");
      // the ring: a scuffed red circle painted on the rubber, a blood-ish stain or two
      const g = k.floorG();
      g.lineStyle(10, 0x7f1d1d, 0.55).strokeCircle(w / 2, h / 2 + 30, 300);
      g.lineStyle(3, 0xfca5a5, 0.35).strokeCircle(w / 2, h / 2 + 30, 286);
      g.fillStyle(0x7f1d1d, 0.18).fillCircle(w / 2, h / 2 + 30, 280);
      g.lineStyle(4, 0xffffff, 0.25).lineBetween(w / 2 - 40, h / 2 + 30, w / 2 + 40, h / 2 + 30);
      for (let i = 0; i < 6; i++) g.fillStyle(0x450a0a, 0.35).fillEllipse(w / 2 + (k.rnd.frac() - 0.5) * 480, h / 2 + 30 + (k.rnd.frac() - 0.5) * 380, 30 + k.rnd.frac() * 40, 14 + k.rnd.frac() * 16);
      // the kit, shoved against the walls
      k.prop("dd_squatrack", 150, 180, { scale: 1.3, block: [80, 30] });
      k.prop("dd_squatrack", w - 150, 180, { scale: 1.3, flip: true, block: [80, 30] });
      k.prop("dd_dumbbells", 90, h - 120, { scale: 1.5, block: [120, 28] });
      k.prop("dd_plates", w - 100, h - 110, { scale: 1.5, block: [60, 24] });
      scatter(k, [SMALL.chalk(k), SMALL.bottle(k)], 8, ANY(k), { colors: [0xf4f4f5, 0x52525b], sfx: "whack_bonk", scale: 1.5 });
      for (const x of [w * 0.2, w * 0.5, w * 0.8]) k.light(x, h * 0.5, 200, 0xef4444, 0.1, "buzz");
      k.motes(26, 0xfca5a5, 0.35);
      k.vignette(0.5, 0x000000, { color: 0x7f1d1d, alpha: 0.18 });
      void DEPTH;
    },
  },
  "pit_range:0": {
    floor: "gym",
    build(k) {
      const { w, h } = k.r;
      sign(k, "TEST RANGE", "TRY BEFORE YOU KREZ");
      // firing lanes painted on the floor, and the line you shoot from
      const g = k.floorG();
      for (let i = 1; i < 6; i++) g.lineStyle(3, 0xfacc15, 0.25).lineBetween((w * i) / 6, 90, (w * i) / 6, h * 0.55);
      g.lineStyle(6, 0xfacc15, 0.5).lineBetween(60, h * 0.62, w - 60, h * 0.62);
      k.text(w / 2, h * 0.62 + 16, "— FIRING LINE —", 10, "#fde68a", { alpha: 0.6 });
      k.prop("dd_benchpress", 120, h - 70, { scale: 1.4, block: [100, 30] });
      k.prop("dd_dumbbells", w - 110, h - 90, { scale: 1.5, flip: true, block: [120, 28] });
      for (const x of [w * 0.3, w * 0.7]) k.light(x, h * 0.35, 220, 0xfef3c7, 0.08);
      k.motes(14, 0xffffff, 0.3);
      k.vignette(0.35);
    },
  },
};

import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { dir } from "../../../content/dsl";
import type { GameState, Line } from "../../../data/types";
import { maxBottles } from "../../systems/stats";
import { squeeze } from "../../systems/squeeze";
import { vfx } from "../../gfx/Vfx";
import { FONT } from "../../ui/theme";
import { RUIN_STASH_FILL, RUIN_STASH_FULL, RUIN_WOMAN, RUIN_WOMAN_HI } from "../../../content/ruinedHome";

/**
 * Chapter 7, after the Krunch Protocol: your house is a wreck, but you can still walk in. Same room, same furniture,
 * every interactable still works; it's dressed as a bomb site (scorched, rubble, a hole in the roof with the burning sky
 * through it, smoke, embers and dust), with a pussy juice stash in the rubble and Tracy sheltering in the wreckage.
 */

/** Is home a ruin right now? (The same rule as the ruined town in HubScene.) */
export function homeRuined(s: GameState | null | undefined): boolean {
  return !!s && s.chapter >= 7 && !!s.flags.krelworld_bombed;
}

/** Ammo off the gun rack in the ruins: half the Kreddle Exchange price (there are no shops left). */
export const RUIN_AMMO_MULT = 0.5;

type Spot = { x: number; y: number; r: number; label: string; use: () => void | Promise<void> };

/** The hole in the roof (screen space): the sky shows through it. */
const HOLE = { x0: 470, x1: 760, y1: 92 };

/** The bombed-out look, layered over the normal room. `bg` is the room's backdrop (it gets scorched). */
export function dressRuin(scene: Phaser.Scene, bg: Phaser.GameObjects.Image | null) {
  bg?.setTint(0x8a7670);
  const has = (k: string) => scene.textures.exists(k);
  const prop = (k: string, x: number, y: number, scale: number, depth = y, angle = 0, tint?: number) => {
    if (!has(k)) return null;
    const im = scene.add.image(x, y, k).setOrigin(0.5, 0.85).setScale(scale).setDepth(depth).setAngle(angle);
    if (tint !== undefined) im.setTint(tint);
    return im;
  };
  // the sky through the roof: a jagged hole, the night lit orange by the fires
  const jag = [0, 34, 12, 58, 22, 70, 44, 92, 60, 78, 74, 88, 82, 62, 70, 40, 54, 26, 30, 0];
  const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(HOLE.x0, 0)];
  jag.forEach((d, i) => pts.push(new Phaser.Math.Vector2(HOLE.x0 + ((HOLE.x1 - HOLE.x0) * (i + 1)) / (jag.length + 1), Math.min(HOLE.y1, d))));
  pts.push(new Phaser.Math.Vector2(HOLE.x1, 0));
  const sky = scene.add.graphics().setDepth(-9.6);
  sky.fillStyle(0x1b0b14, 1).fillPoints(pts, true);
  const glow = scene.add.graphics().setDepth(-9.55).setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(0xff5a1f, 0.35).fillEllipse((HOLE.x0 + HOLE.x1) / 2, 70, 300, 70);
  glow.fillStyle(0xffa040, 0.18).fillEllipse((HOLE.x0 + HOLE.x1) / 2, 84, 200, 30);
  scene.tweens.add({ targets: glow, alpha: 0.55, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
  // ...a couple of stars where the smoke's thin, and the broken edge of the ceiling round it
  for (const [sx, sy] of [[520, 14], [610, 30], [700, 10]] as const) scene.add.rectangle(sx, sy, 2, 2, 0xfff3d6, 0.8).setDepth(-9.5);
  const edge = scene.add.graphics().setDepth(-9.4);
  edge.lineStyle(5, 0x2a1c16, 1).strokePoints(pts.slice(1, -1), false);
  edge.lineStyle(2, 0x6b4a33, 1).strokePoints(pts.slice(1, -1).map((p) => new Phaser.Math.Vector2(p.x, p.y + 4)), false);
  // splintered joists hanging down from the edge
  for (const [jx, jy, a] of [[488, 30, 28], [592, 70, -18], [742, 40, -34]] as const) scene.add.rectangle(jx, jy, 10, 70, 0x4a3222).setOrigin(0.5, 0).setAngle(a).setStrokeStyle(2, 0x241710).setDepth(-9.3);
  // a pale shaft of firelight down through the dust
  const shaft = scene.add.graphics().setDepth(-9).setBlendMode(Phaser.BlendModes.ADD);
  shaft.fillStyle(0xffb070, 0.07).fillPoints([new Phaser.Math.Vector2(500, 40), new Phaser.Math.Vector2(740, 40), new Phaser.Math.Vector2(800, 540), new Phaser.Math.Vector2(380, 540)], true);
  scene.tweens.add({ targets: shaft, alpha: 0.6, yoyo: true, repeat: -1, duration: 2100, ease: "Sine.inOut" });
  vfx(scene, "vfx_smokecol", 560, 90, { scale: 1.8, depth: -9.45, alpha: 0.7 });
  vfx(scene, "vfx_smokecol", 690, 80, { scale: 1.5, depth: -9.45, alpha: 0.6, delay: 500 });
  // scorch and cracks up the walls
  const wall = scene.add.graphics().setDepth(-9.2);
  for (const [cx, cy, w, h] of [[110, 120, 160, 120], [850, 160, 150, 160], [400, 60, 180, 70], [260, 380, 140, 50]] as const) {
    wall.fillStyle(0x0d0806, 0.35).fillEllipse(cx, cy, w, h);
    wall.fillStyle(0x0d0806, 0.25).fillEllipse(cx + 10, cy - 10, w * 0.6, h * 0.6);
  }
  wall.lineStyle(2, 0x120c0a, 0.85);
  for (const crack of [
    [[300, 0], [292, 40], [306, 78], [296, 130]],
    [[880, 90], [866, 140], [878, 190], [860, 246]],
    [[40, 300], [70, 320], [84, 360], [120, 372]],
    [[780, 0], [790, 50], [776, 96]],
  ])
    wall.strokePoints(crack.map(([x, y]) => new Phaser.Math.Vector2(x, y)), false);
  // the fallen roof beam, leaning from the hole down to the floor
  const beam = scene.add.rectangle(612, 60, 30, 420, 0x4a3222).setOrigin(0.5, 0).setAngle(-22).setStrokeStyle(3, 0x1f140d).setDepth(436);
  scene.add.rectangle(beam.x + 4, beam.y, 6, 420, 0x6b4a33).setOrigin(0.5, 0).setAngle(-22).setDepth(436.5);
  // rubble heaps round the edges of the room (behind where you walk), and debris on the floor
  prop("r_rubble", 40, 452, 2.2, 445);
  prop("r_ruin", 240, 446, 1.7, 441, 0, 0xb0a09a);
  prop("r_wall", 712, 452, 1.7, 446);
  prop("r_rubble", 470, 448, 1.5, 444);
  prop("r_girders", 812, 456, 1.4, 448, 8);
  prop("r_fireheap", 22, 520, 1.4, 541);
  for (const [k, x, y, sc, a] of [
    ["r_debris", 260, 500, 1.3, 10], ["r_ash", 430, 470, 1.4, 0], ["r_debris", 610, 488, 1.2, -20], ["r_ash", 760, 520, 1.3, 0],
    ["r_debris", 180, 530, 1.1, 30], ["r_ash", 560, 536, 1.1, 0], ["r_debris", 840, 500, 1.0, 0],
  ] as const)
    prop(k, x, y, sc, 3, a);
  // broken glass and plaster dust everywhere
  for (let i = 0; i < 26; i++) {
    const gx = 60 + ((i * 89) % 840);
    const gy = 450 + ((i * 37) % 86);
    const sh = scene.add.rectangle(gx, gy, 3 + (i % 3), 2, 0xdff3ff, 0.8).setAngle((i * 41) % 90).setDepth(3);
    if (i % 5 === 0) scene.tweens.add({ targets: sh, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 + i * 30 });
  }
  // small fires still going
  vfx(scene, "vfx_fire", 24, 512, { scale: 0.75, depth: 542 });
  vfx(scene, "vfx_fire", 716, 440, { scale: 0.6, depth: 447, delay: 300 });
  vfx(scene, "vfx_fire", 812, 446, { scale: 0.45, depth: 449, delay: 600 });
  const fireGlow = scene.add.ellipse(380, 470, 960, 200, 0xff6a2a, 0.06).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: fireGlow, alpha: 0.5, yoyo: true, repeat: -1, duration: 260, repeatDelay: 400 });
  // the whole place, darker and smokier (above the room, below the dialogue and panels)
  scene.add.rectangle(480, 270, 960, 540, 0x150a08, 0.22).setDepth(900);
  scene.add.rectangle(480, 270, 960, 540, 0xff7a3a, 0.05).setDepth(901).setBlendMode(Phaser.BlendModes.ADD);
  // ash drifting down through the hole, embers drifting up, dust hanging in the light
  scene.time.addEvent({
    delay: 140,
    loop: true,
    callback: () => {
      const a = scene.add.rectangle(HOLE.x0 + Math.random() * (HOLE.x1 - HOLE.x0), 60, 2, 2, 0xb8b2aa, 0.8).setDepth(902);
      scene.tweens.add({ targets: a, x: a.x - 60 + Math.random() * 160, y: 460 + Math.random() * 70, angle: 360, alpha: 0.2, duration: 4200 + Math.random() * 2500, onComplete: () => a.destroy() });
    },
  });
  scene.time.addEvent({
    delay: 420,
    loop: true,
    callback: () => {
      const e = scene.add.circle(Math.random() * 960, 545, 1.5 + Math.random() * 1.5, Math.random() < 0.5 ? 0xff9a3a : 0xffd27a, 0.9).setDepth(903).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: e, x: e.x + 40 + Math.random() * 100, y: 120 + Math.random() * 200, alpha: 0, duration: 3500 + Math.random() * 2000, onComplete: () => e.destroy() });
    },
  });
  for (let i = 0; i < 28; i++) {
    const m = scene.add.circle(420 + Math.random() * 360, 80 + Math.random() * 420, 1 + Math.random(), 0xfff0d8, 0.35).setDepth(902).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: m, x: m.x + Phaser.Math.Between(-40, 40), y: m.y + Phaser.Math.Between(-30, 30), alpha: 0.05, yoyo: true, repeat: -1, duration: Phaser.Math.Between(2500, 5000), ease: "Sine.inOut" });
  }
}

/** The juice stash in the rubble and Tracy, sheltering in the wreckage. */
export function addRuinSpots(scene: Phaser.Scene, addSpot: (s: Spot) => void, talk: (lines: Line[]) => Promise<void>, me: () => Phaser.GameObjects.Sprite) {
  const has = (k: string) => scene.textures.exists(k);
  // --- the pussy juice stash: an army crate half under the plaster, cartons on top, glowing pink
  const SX = 66;
  const SY = 536;
  if (has("c7d_crate")) scene.add.image(SX, SY, "c7d_crate").setOrigin(0.5, 1).setScale(1.25).setDepth(SY);
  else scene.add.rectangle(SX, SY, 76, 60, 0x4b5320).setOrigin(0.5, 1).setStrokeStyle(3, 0x1f2310).setDepth(SY);
  if (has("p_juice")) {
    scene.add.image(SX - 16, SY - 66, "p_juice").setOrigin(0.5, 1).setScale(0.9).setAngle(-8).setDepth(SY + 1);
    scene.add.image(SX + 14, SY - 64, "p_juice").setOrigin(0.5, 1).setScale(0.8).setAngle(12).setDepth(SY + 1);
  }
  const pink = scene.add.ellipse(SX, SY - 50, 110, 90, 0xff6bb0, 0.16).setDepth(SY + 2).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: pink, alpha: 0.4, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
  scene.add.text(SX + 4, SY - 120, "🍼 JUICE", { fontFamily: FONT, fontSize: "11px", color: "#ff9ecf", fontStyle: "bold", backgroundColor: "#00000099", padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(600);
  addSpot({
    x: SX + 6,
    y: 500,
    r: 46,
    label: "E: Pussy juice stash (fill your bottles · free)",
    use: async () => {
      const s = G.s;
      const max = maxBottles(s);
      if (s.bottles >= max) {
        await talk([dir(RUIN_STASH_FULL)]);
        return;
      }
      const got = max - s.bottles;
      s.bottles = max;
      G.save();
      synth.play("pickup");
      G.emit("toast", { title: "🍼 PUSSY JUICE", text: `+${got} bottle${got === 1 ? "" : "s"}: ${max}/${max}` });
      await talk([dir(RUIN_STASH_FILL)]);
    },
  });
  // --- Tracy, with her trolley, between the bed and the door
  const TX = 668;
  const TY = 478;
  const tex = has("spr_TV_MARY") ? "spr_TV_MARY" : "spr_FOLK1";
  if (!has(tex)) return;
  const spr = scene.add.sprite(TX, TY, tex, 0).setOrigin(0.5, 1).setScale(2.6).setDepth(TY);
  scene.tweens.add({ targets: spr, scaleY: 2.64, yoyo: true, repeat: -1, duration: 1100, ease: "Sine.inOut" });
  scene.add.text(TX, TY - spr.displayHeight - 6, `${RUIN_WOMAN} 💛`, { fontFamily: FONT, fontSize: "10px", color: "#fde047", backgroundColor: "#00000099", padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setDepth(600);
  addSpot({
    x: TX,
    y: TY,
    r: 42,
    label: `E: Talk to ${RUIN_WOMAN} (squeeze)`,
    use: async () => {
      const hi = RUIN_WOMAN_HI[Math.floor(Math.random() * RUIN_WOMAN_HI.length)];
      const host = scene as unknown as { busy: boolean };
      host.busy = true;
      const m = me();
      const from = { x: m.x, y: m.y };
      await squeeze(scene, talk, { name: RUIN_WOMAN, spr }, m, [hi]);
      // back off her a step (the hug pulls you in)
      scene.tweens.add({ targets: m, x: Phaser.Math.Clamp(from.x, 40, 920), y: from.y, duration: 250 });
      host.busy = false;
    },
  });
}

/**
 * Chapter 7, free in the ruined town and not up the hill yet: a suggestion (never a requirement) to stop at the
 * wreckage of your house first. Shown in the pause menu and the quest log, alongside the objective (which doesn't change).
 */
export function ruinHomeHint(s: GameState | null | undefined): string {
  if (!s || !homeRuined(s)) return "";
  const f = s.flags;
  if (!f.ch7_aftermath || f.home_ruin_seen || f.citadel_lads_in || f.citadel_fallen || f.ch7_clear) return "";
  return "Optional: stop at the wreckage of your house first (pussy juice, half-price ammo, a squeeze).";
}

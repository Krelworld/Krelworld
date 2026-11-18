import Phaser from "phaser";
import type { Line } from "../../data/types";
import { G } from "../G";
import { DialogueBox } from "../ui/DialogueBox";
import { switchTo, fadeThen } from "../Flow";
import { synth } from "../audio/Synth";
import { FONT } from "../ui/theme";
import { charMeta, hdFactor } from "../gfx/HD";
import { hasVfx, vfx } from "../gfx/Vfx";
import { CHARACTERS, LADS } from "../../data/characters";
import * as FB from "../../content/finaleKrelford";
import { finalePreload, finaleReady, ssjKey, ssjPortraitKey, ssjSwap, youCutKey, youEyesKey } from "./finale/finaleArt";
import * as Juice from "../gfx/Juice";
import { SsjBrawl } from "./finale/SsjBrawl";

/**
 * THE KRELWORLD FINALE, part B: the side-on cutscenes in Krelford.
 *   beat "emerge":    THE CONCEPT OF PAEDOPHILIA rises out of the wreck of Da Drongus Dungeon. Then: the fight.
 *   beat "transform": the group super-saiyan transformation (an overlay on the paused fight; `done` resumes it).
 *   beat "brawl":     the side-on super saiyan brawl in the sky (an overlay on the paused fight, like "transform";
 *                     finale/SsjBrawl.ts). `done` hands back to the fight, which goes on to the final heal.
 *   beat "spirit":    Goku's SPIRIT CUM. The dragon and the wizard are destroyed. Then: the Ending.
 * Started with switchTo(scene, "Finale", { beat }) (or launched as an overlay with { beat, overlay: true, done }).
 */

const W = 960;
const FLOOR = 350;
const never = () => new Promise<void>(() => undefined);

type Beat = "emerge" | "transform" | "brawl" | "spirit";
interface Lad {
  id: string;
  spr: Phaser.GameObjects.Sprite;
  aura?: Phaser.GameObjects.Sprite;
  hair?: Phaser.GameObjects.Graphics;
  glow?: Phaser.GameObjects.Ellipse;
}
interface FinaleData {
  beat: Beat;
  overlay?: boolean;
  done?: () => void;
}

export class FinaleScene extends Phaser.Scene {
  private box!: DialogueBox;
  private dead = false;
  private ended = false;
  private data0!: FinaleData;
  private flash!: Phaser.GameObjects.Rectangle;
  private dragon: Phaser.GameObjects.Image | null = null;
  private wizard: Phaser.GameObjects.Image | null = null;
  private lads: Lad[] = [];
  private escHandler?: (e: KeyboardEvent) => void;
  private stormOn = true;
  /** True while the SPIRIT CUM beam struggle is on (tests look for it). */
  clashing = false;

  constructor() {
    super("Finale");
  }

  preload() {
    finalePreload(this);
  }

  async create(data: FinaleData) {
    this.data0 = { beat: data?.beat ?? "emerge", overlay: data?.overlay, done: data?.done };
    this.dead = false;
    this.ended = false;
    this.lads = [];
    this.dragon = null;
    this.wizard = null;
    this.stormOn = true;
    finaleReady(this);
    this.events.once("shutdown", () => {
      this.dead = true;
      if (this.escHandler) window.removeEventListener("keydown", this.escHandler);
    });
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.finish(true);
    };
    window.addEventListener("keydown", this.escHandler);
    if (this.data0.overlay) this.scene.bringToTop();
    this.cameras.main.fadeIn(500);
    this.box = new DialogueBox(this, 1000, 0.1);
    const b = this.data0.beat;
    this.add.text(W - 10, 8, b === "brawl" ? "Esc: skip fight" : "Esc: skip scene", { fontFamily: FONT, fontSize: "11px", color: "#8a8fa0" }).setOrigin(1, 0).setDepth(1100).setScrollFactor(0);
    // (the brawl's up in the sky: it draws its own set)
    if (b !== "brawl") this.drawTown();
    this.flash = this.add.rectangle(480, 270, W, 540, 0xe9e4ff, 0).setDepth(900).setBlendMode(Phaser.BlendModes.ADD);
    if (b !== "brawl") this.rain();
    synth.weatherSound("storm");
    if (b !== "brawl") this.lightningLoop();
    else this.stormOn = false;
    if (b === "emerge") await this.emerge();
    else if (b === "transform") await this.transform();
    else if (b === "brawl") await new SsjBrawl(this, (l) => this.talk(l)).run();
    else await this.spirit();
    this.finish(false);
  }

  private finish(skipped: boolean) {
    if (this.ended || this.dead) return;
    this.ended = true;
    const s = G.s;
    const b = this.data0.beat;
    if (b === "emerge") s.flags.finale_emerged = true;
    if (b === "spirit") {
      s.flags.concept_destroyed = true;
      s.flags.ch7_clear = true;
      s.phase = "hub";
      delete s.flags.finale_cp;
      delete s.flags.finale_brawl;
    }
    G.save();
    synth.weatherSound(null);
    if (this.data0.overlay) {
      // back to the fight
      const done = this.data0.done;
      this.cameras.main.fadeOut(skipped ? 200 : 400);
      this.time.delayedCall(skipped ? 220 : 420, () => {
        this.scene.stop();
        done?.();
      });
      return;
    }
    // after the SPIRIT CUM: the long whiteness, then the morning after in Krelford (HubScene.finaleDawn), then the Ending
    if (b === "spirit") {
      s.flags.finale_dawn = true;
      G.save();
      this.cameras.main.fadeOut(skipped ? 300 : 1200, 255, 255, 255);
      this.time.delayedCall(skipped ? 320 : 1250, () => switchTo(this, "Hub", { at: "TOWN_HALL", from: "finale_dawn" }));
      return;
    }
    fadeThen(this, skipped ? 300 : 900, () => switchTo(this, "Dungeon", { dungeon: "krelford_finale", room: 0 }));
  }

  // ---------------------------------------------------------------- the set

  /** Ruined Krelford at night, side-on: a broken skyline, fires, rubble, rain. */
  private drawTown() {
    if (this.textures.exists("bg_finale_ruins")) return this.drawTownArt();
    const g = this.add.graphics().setDepth(-20);
    g.fillGradientStyle(0x05010c, 0x05010c, 0x2a0f3d, 0x2a0f3d, 1).fillRect(0, 0, W, FLOOR);
    const rnd = new Phaser.Math.RandomDataGenerator(["finale_skyline"]);
    // far skyline
    for (let x = -20; x < W + 40; x += rnd.between(40, 90)) {
      const h = rnd.between(40, 130);
      const w = rnd.between(36, 80);
      g.fillStyle(0x140a1c, 1).fillRect(x, FLOOR - 40 - h, w, h + 40);
      // the bombed-out tops: jagged
      for (let k = 0; k < 4; k++) g.fillStyle(0x05010c, 1).fillTriangle(x + rnd.between(0, w), FLOOR - 40 - h - 2, x + rnd.between(0, w), FLOOR - 40 - h + rnd.between(6, 30), x + rnd.between(0, w), FLOOR - 40 - h - 2);
      // windows lit by fire
      for (let k = 0; k < 3; k++) if (rnd.frac() < 0.5) g.fillStyle(rnd.frac() < 0.5 ? 0xff7a2a : 0xffb347, 0.7).fillRect(x + rnd.between(4, w - 8), FLOOR - 30 - rnd.between(0, h), 4, 5);
    }
    // nearer skyline
    for (let x = -30; x < W + 40; x += rnd.between(70, 140)) {
      const h = rnd.between(20, 80);
      g.fillStyle(0x0d0711, 1).fillRect(x, FLOOR - h, rnd.between(50, 110), h);
    }
    // glow of the fires
    const glow = this.add.rectangle(480, FLOOR - 30, W, 120, 0xff6a2a, 0.12).setDepth(-19).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.06, yoyo: true, repeat: -1, duration: 900 });
    // ground
    const ground = this.add.graphics().setDepth(-5);
    ground.fillStyle(0x1a1310, 1).fillRect(0, FLOOR, W, 540 - FLOOR);
    ground.fillStyle(0x0b0806, 1).fillRect(0, FLOOR, W, 4);
    for (let i = 0; i < 70; i++) ground.fillStyle(rnd.frac() < 0.5 ? 0x2a211c : 0x3a2f2a, 1).fillRect(rnd.between(0, W), FLOOR + rnd.between(2, 40), rnd.between(6, 24), rnd.between(3, 9));
    if (hasVfx(this, "vfx_fire")) for (let i = 0; i < 6; i++) vfx(this, "vfx_fire", 60 + i * 170 + rnd.between(-30, 30), FLOOR - rnd.between(30, 90), { scale: 0.8 + rnd.frac() * 0.6, depth: -18, alpha: 0.85 });
  }

  /**
   * The PixelLab ruined Krelford: terraces on fire, the clock tower snapped in half. Hung so its pavement
   * meets the lads' feet near FLOOR (the sky above the tower's tip is what gets cropped); the road below
   * fades into a dark rubble strip.
   */
  private drawTownArt() {
    const top = -88;
    this.add.image(0, top, "bg_finale_ruins").setOrigin(0).setScale(2).setDepth(-20);
    // a slow flicker of firelight over the whole street
    const glow = this.add.rectangle(480, FLOOR - 60, W, 220, 0xff6a2a, 0.08).setDepth(-19).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.03, yoyo: true, repeat: -1, duration: 900 });
    const ground = this.add.graphics().setDepth(-5);
    const gy = top + 544 - 30;
    ground.fillGradientStyle(0x0b0806, 0x0b0806, 0x0b0806, 0x0b0806, 0, 0, 1, 1).fillRect(0, gy - 40, W, 40);
    ground.fillStyle(0x0b0806, 1).fillRect(0, gy, W, 540 - gy);
    const rnd = new Phaser.Math.RandomDataGenerator(["finale_skyline"]);
    for (let i = 0; i < 50; i++) ground.fillStyle(rnd.frac() < 0.5 ? 0x2a211c : 0x3a2f2a, 1).fillRect(rnd.between(0, W), gy + rnd.between(4, 520 - gy), rnd.between(6, 24), rnd.between(3, 9));
    if (hasVfx(this, "vfx_fire")) for (let i = 0; i < 3; i++) vfx(this, "vfx_fire", 140 + i * 330 + rnd.between(-30, 30), FLOOR - rnd.between(10, 40), { scale: 0.7 + rnd.frac() * 0.4, depth: -18, alpha: 0.8 });
  }

  private rain() {
    if (!hasVfx(this, "vfx_rain")) return;
    for (let l = 0; l < 2; l++)
      for (let gx = 0; gx < 3; gx++)
        for (let gy = 0; gy < 3; gy++) vfx(this, "vfx_rain", 160 + gx * 320 + l * 90, 100 + gy * 200 + l * 60, { fixed: true, scale: 2 + l * 0.4, depth: 800 + l, alpha: 0.6, speed: 1.5, angle: 12 })?.anims.setProgress(Math.random());
  }

  /** Lightning: the sky flashes, a bolt comes down, and the wizard shows behind the monster. */
  private strike(close = true) {
    if (this.dead || this.ended || !this.stormOn) return;
    this.tweens.killTweensOf(this.flash);
    this.flash.setAlpha(0);
    this.tweens.chain({ targets: this.flash, tweens: [{ alpha: close ? 0.6 : 0.3, duration: 40 }, { alpha: 0.05, duration: 80 }, { alpha: close ? 0.5 : 0.2, duration: 40 }, { alpha: 0, duration: 500 }] });
    const x = 80 + Math.random() * (W - 160);
    const bolt = this.add.graphics().setDepth(-15).setBlendMode(Phaser.BlendModes.ADD);
    let px = x;
    let py = 0;
    bolt.lineStyle(4, 0xd8c8ff, 1).beginPath().moveTo(px, py);
    while (py < FLOOR - 60) {
      px += (Math.random() - 0.5) * 60;
      py += 20 + Math.random() * 30;
      bolt.lineTo(px, py);
    }
    bolt.strokePath();
    this.tweens.add({ targets: bolt, alpha: 0, duration: 300, onComplete: () => bolt.destroy() });
    if (this.wizard) {
      this.tweens.killTweensOf(this.wizard);
      this.wizard.setAlpha(0.7);
      this.tweens.add({ targets: this.wizard, alpha: 0, delay: 350, duration: 1100 });
    }
    if (this.dragon) {
      this.dragon.setTintFill(0xe9d5ff);
      this.time.delayedCall(70, () => this.dragon?.active && this.dragon.clearTint());
    }
    if (close) this.cameras.main.shake(250, 0.004);
    this.time.delayedCall(close ? 100 : 500, () => !this.dead && synth.play(Math.random() < 0.5 ? "thunder_1" : "thunder_2"));
  }

  private lightningLoop() {
    const go = () => {
      if (this.dead || this.ended) return;
      this.strike(Math.random() < 0.6);
      this.time.delayedCall(3500 + Math.random() * 4000, go);
    };
    this.time.delayedCall(1800, go);
  }

  /** The whole Krew (you included), side-on. */
  private placeLads(xs: number[], face: "west" | "south" | "east", scale = 3, y = FLOOR + 8) {
    const s = G.s;
    const ids = [s.player, ...LADS.filter((p) => p !== s.player), "MIKEY"].filter((p, i, a) => a.indexOf(p) === i && this.textures.exists(`spr_${p}`));
    this.lads = ids.slice(0, xs.length).map((id, i) => {
      const key = `spr_${id}`;
      const meta = charMeta(this, key);
      const f = meta?.idle?.[face] ?? 0;
      const yy = y + (i % 2) * 10;
      const spr = this.add.sprite(xs[i], yy, key, f).setOrigin(0.5, 1).setScale(scale).setDepth(100 + yy);
      if (!meta && face === "west") spr.setFlipX(true);
      return { id, spr };
    });
  }

  private makeDragon(x: number, y: number, scale: number) {
    // the wizard first, behind it
    // (drawn over the monster, see-through: a spectre looming behind it that only the lightning shows)
    const wk = this.textures.exists("fb_wizard") ? "fb_wizard" : "boss_drongus";
    this.wizard = this.add.image(x + 70, y - 30, wk, 0).setOrigin(0.5, 1).setScale(scale * 2.6).setDepth(-9).setTint(0xa78bfa).setAlpha(0).setBlendMode(Phaser.BlendModes.SCREEN);
    const key = this.textures.exists("fb_dragon_side") ? "fb_dragon_side" : "boss_drongus";
    this.dragon = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(key === "fb_dragon_side" ? scale : scale * 3).setDepth(-10);
    if (key !== "fb_dragon_side") this.dragon.setTint(0x4c1d95);
    // breathing
    this.tweens.add({ targets: this.dragon, scaleY: this.dragon.scaleY * 1.025, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
    return this.dragon;
  }

  // ---------------------------------------------------------------- beat 1: it comes out of the rubble

  private async emerge() {
    synth.stopMusic();
    // a heap of wreckage in the middle, the lads on the right looking at it
    if (this.textures.exists("fn_heap")) {
      this.add.image(340, FLOOR + 16, "fn_heap").setOrigin(0.5, 1).setScale(2.2).setDepth(-4);
    } else {
      const heap = this.add.graphics().setDepth(-4);
      const rnd = new Phaser.Math.RandomDataGenerator(["heap"]);
      for (let i = 0; i < 120; i++) {
        const x = 60 + rnd.between(0, 560);
        const h = Math.max(0, 120 - Math.abs(x - 340) * 0.35);
        heap.fillStyle(rnd.pick([0x1f1a24, 0x2a2433, 0x3a2f3f, 0x4a2a5a, 0x241c1c]), 1).fillRect(x, FLOOR - rnd.between(0, h), rnd.between(14, 40), rnd.between(10, 26));
      }
      // girders sticking out
      heap.lineStyle(6, 0x3f3f46, 1).lineBetween(180, FLOOR - 10, 230, FLOOR - 110).lineBetween(470, FLOOR - 5, 420, FLOOR - 95).lineBetween(300, FLOOR, 360, FLOOR - 130);
    }
    this.placeLads([640, 690, 740, 790, 840, 885, 925, 600, 560], "west");
    const dragon = this.makeDragon(340, FLOOR + 520, 1.55);
    // it comes up out of the ground: masked at the heap line
    const m = this.make.graphics({}, false);
    m.fillRect(0, 0, W, FLOOR + 6);
    dragon.setMask(m.createGeometryMask());
    await this.talk(FB.FB_RUMBLE.slice(0, 1));
    // the rumble
    synth.play("boom");
    this.cameras.main.shake(7000, 0.01);
    const debris = this.time.addEvent({
      delay: 70,
      repeat: 90,
      callback: () => {
        const r = this.add.rectangle(200 + Math.random() * 300, FLOOR - Math.random() * 60, 4 + Math.random() * 10, 4 + Math.random() * 10, Phaser.Utils.Array.GetRandom([0x2a2433, 0x3a2f3f, 0x4a2a5a]) as number).setDepth(-3);
        this.tweens.add({ targets: r, x: r.x + (Math.random() - 0.5) * 400, y: r.y - 100 - Math.random() * 200, angle: 400, duration: 600, yoyo: true, ease: "Quad.out", onComplete: () => r.destroy() });
      },
    });
    if (hasVfx(this, "vfx_dust")) this.time.addEvent({ delay: 300, repeat: 20, callback: () => vfx(this, "vfx_dust", 140 + Math.random() * 400, FLOOR, { scale: 2.5 + Math.random() * 2, depth: -2 }) });
    // panic on the right
    this.lads.forEach((l, i) => this.tweens.add({ targets: l.spr, y: l.spr.y - 10, yoyo: true, repeat: 8, duration: 140 + i * 13 }));
    for (let i = 0; i < 4; i++) this.time.delayedCall(800 + i * 1400, () => {
      synth.play("roar");
      this.strike(true);
    });
    this.tweens.add({ targets: dragon, y: FLOOR + 34, duration: 6200, ease: "Sine.out" });
    await this.wait(6400);
    debris.remove();
    dragon.clearMask(true);
    synth.play("roar");
    this.cameras.main.shake(900, 0.02);
    this.strike(true);
    // its eyes open (all of them), then the whole of it, from across town
    await Juice.eyeShot(this, "fe_eyes_concept", 850, { color: 0xa855f7 });
    await Juice.still(this, "fe_still_concept_rise", 1600, { push: 0.1, shakeK: 0.012 });
    synth.music("c7_concept");
    await this.talk(FB.FB_EMERGE_PANIC);
    // the title
    this.strike(true);
    const t = this.add.text(480, 96, "THE CONCEPT OF PAEDOPHILIA", { fontFamily: "Impact, sans-serif", fontSize: "54px", color: "#e11d48", stroke: "#1a0026", strokeThickness: 10, align: "center" }).setOrigin(0.5).setDepth(950).setScale(3).setAlpha(0);
    const sub = this.add.text(480, 146, "— A CONCEPT —", { fontFamily: FONT, fontSize: "16px", color: "#c4b5fd", fontStyle: "bold" }).setOrigin(0.5).setDepth(950).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 380, ease: "Back.out" });
    this.tweens.add({ targets: sub, alpha: 1, delay: 500, duration: 600 });
    synth.play("smash");
    this.cameras.main.shake(500, 0.02);
    this.cameras.main.flash(200, 120, 0, 40);
    await this.wait(1600);
    await this.talk(FB.FB_TITLE_REACT);
    // its voice: deep, distorted (the screen warps when it talks)
    await this.talk(FB.FB_DEFINITION);
    this.tweens.add({ targets: [t, sub], alpha: 0, duration: 600 });
    await this.talk(FB.FB_DEFIANT);
    synth.play("roar");
    this.cameras.main.shake(600, 0.015);
    await this.wait(500);
  }

  // ---------------------------------------------------------------- beat 2: SUPER SAIYAN

  private async transform() {
    synth.music("c7_transform", true);
    const calm = !!G.meta.settings.calmFlash;
    const cam = this.cameras.main;
    const xs = [100, 195, 290, 385, 480, 575, 670, 765, 860];
    this.placeLads(xs, "south", 3.6, FLOOR + 10);
    this.letterbox();
    await this.talk(FB.FB_ALL_INJECTED.slice(1));
    // the ground starts to shake, gold crackling over all of them
    cam.shake(60000, calm ? 0.002 : 0.004);
    const crackle = this.time.addEvent({ delay: calm ? 420 : 150, loop: true, callback: () => this.crackle(Phaser.Utils.Array.GetRandom(this.lads) as Lad) });
    // one by one: the camera rushes in on him, then the close-up as it happens. The first few slow, then quick cuts.
    for (const [i, l] of this.lads.entries()) {
      await this.zoomUp(l, i, i >= 3);
      if (i === 1) await this.talk(FB.FB_TRANSFORM.slice(0, 2));
    }
    // everyone changed: hear them in their new voices (the dialogue box shows the gold close-ups from here)
    G.s.flags.finale_cp = "ssj";
    // WIDE: the whole Krew, bigger than before, side by side
    this.wide();
    for (const l of this.lads) if (l.spr.texture.key.startsWith("ssj_")) l.spr.setFrame(0);
    synth.play("reveal_boom");
    if (!vfx(this, "vfx_shock", 480, FLOOR, { scale: 6, depth: 930, tint: 0xfde047, add: true })) this.ring(480, FLOOR - 60, 520);
    cam.flash(calm ? 500 : 300, 255, 240, 170);
    await this.wait(1100);
    await this.talk(FB.FB_TRANSFORM.slice(2));
    // the final scream: all of them at once (their eyes first)
    await Juice.eyeShot(this, youEyesKey(this, G.s.player), 800, { color: 0xffe066 });
    for (const l of this.lads) if (l.spr.texture.key.startsWith("ssj_")) l.spr.setFrame(1);
    cam.resetFX();
    cam.shake(1400, calm ? 0.01 : 0.03);
    synth.play("roar");
    cam.flash(900, 255, 240, 180);
    for (let k = 0; k < (calm ? 2 : 6); k++) this.time.delayedCall(k * 140, () => this.bolt(80 + Math.random() * 800));
    const cap = this.add.text(480, 110, "SUPER KRELWORLD KREW", { fontFamily: "Impact, sans-serif", fontSize: "60px", color: "#ffe066", stroke: "#7a4a00", strokeThickness: 10 }).setOrigin(0.5).setDepth(950).setScale(0.2);
    this.tweens.add({ targets: cap, scale: 1, duration: 400, ease: "Back.out" });
    this.speedLines(480, 260, 2200);
    await this.wait(2600);
    crackle.remove();
  }

  /** Black bars top and bottom (they stay put on screen while the camera zooms about). */
  private letterbox() {
    const H = 56;
    const top = this.add.rectangle(0, 0, W, 1, 0x000000, 1).setOrigin(0).setDepth(985);
    const bot = this.add.rectangle(0, 0, W, 1, 0x000000, 1).setOrigin(0).setDepth(985);
    const k = { v: 0 };
    this.tweens.add({ targets: k, v: 1, duration: 600, ease: "Cubic.out" });
    const place = () => {
      const cam = this.cameras.main;
      const z = cam.zoom;
      const x0 = cam.scrollX + 480 - 480 / z;
      const y0 = cam.scrollY + 270 - 270 / z;
      const h = Math.max(1, (H * k.v) / z);
      top.setPosition(x0 - 40 / z, y0 - 40 / z).setSize((W + 80) / z, h + 40 / z);
      bot.setPosition(x0 - 40 / z, y0 + 540 / z - h).setSize((W + 80) / z, h + 40 / z);
    };
    this.events.on("postupdate", place);
    this.events.once("shutdown", () => this.events.off("postupdate", place));
    place();
  }

  /** Back to the wide shot, at once (a cut, not a pan). */
  private wide() {
    const cam = this.cameras.main;
    cam.panEffect.reset();
    cam.zoomEffect.reset();
    cam.setZoom(1).setScroll(0, 0);
  }

  /** ZOOM-UP: the camera rushes in on one lad as he starts to glow, then cuts to his close-up as he changes. */
  private async zoomUp(l: Lad, i: number, quick: boolean) {
    const cam = this.cameras.main;
    const sp = l.spr;
    const calm = !!G.meta.settings.calmFlash;
    const t = quick ? 200 : 360;
    cam.shake(4000, calm ? 0.002 : 0.005, true);
    cam.pan(sp.x, sp.y - sp.displayHeight * 0.55, t, "Cubic.easeOut", true);
    cam.zoomTo(quick ? 2.5 : 3.2, t, "Cubic.easeOut", true);
    synth.play(i % 2 ? "zap" : "telegraph");
    this.auraOn(l);
    sp.setTint(0xfff0b0);
    // he strains
    const x0 = sp.x;
    this.tweens.add({ targets: sp, x: x0 + 1.5, yoyo: true, repeat: quick ? 4 : 8, duration: 35, onComplete: () => sp.setX(x0) });
    if (this.anims.exists("fb_lightning")) {
      const z = this.add.sprite(sp.x, sp.y + 4, "fb_lightning", 0).setOrigin(0.5, 1).setDepth(sp.depth + 3).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff27a);
      z.setDisplaySize(sp.displayHeight * 0.9, sp.displayHeight * 1.2);
      z.play("fb_lightning");
      z.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => z.destroy());
    }
    for (let k = 0; k < (calm ? 1 : 3); k++) this.time.delayedCall(k * 90, () => this.crackle(l));
    await this.wait(t + (quick ? 160 : 420));
    // CUT to the close-up
    this.wide();
    await this.closeUp(l, quick);
    // CUT back: he's changed
    this.change(l);
  }

  /**
   * The close-up: his own face and shirt, shaking, filling the screen; then a flash, the shirt goes in bits, and
   * it's him as a super saiyan (ripped, golden spiky hair), punched in, with his name.
   */
  private async closeUp(l: Lad, quick: boolean) {
    const calm = !!G.meta.settings.calmFlash;
    const def = CHARACTERS[l.id];
    const c = this.add.container(0, 0).setDepth(970).setScrollFactor(0);
    c.add(this.add.rectangle(480, 270, W, 540, 0x160a00, 1));
    // gold rays turning behind him
    const rays = this.add.graphics({ x: 480, y: 300 });
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      rays.fillStyle(k % 2 ? 0xffb020 : 0x7a3d00, k % 2 ? 0.55 : 0.35).fillTriangle(0, 0, Math.cos(a) * 900, Math.sin(a) * 900, Math.cos(a + 0.2) * 900, Math.sin(a + 0.2) * 900);
    }
    c.add(rays);
    this.tweens.add({ targets: rays, angle: 40, duration: 3000 });
    // speed lines
    const lines = this.add.graphics();
    c.add(lines);
    const drawLines = () => {
      lines.clear();
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 220 + Math.random() * 120;
        lines.lineStyle(1 + Math.random() * 3, 0xfff4c2, 0.35 + Math.random() * 0.4);
        lines.lineBetween(480 + Math.cos(a) * r0, 300 + Math.sin(a) * r0, 480 + Math.cos(a) * 800, 300 + Math.sin(a) * 800);
      }
    };
    drawLines();
    const ev = this.time.addEvent({ delay: calm ? 260 : 60, loop: true, callback: drawLines });
    // before: him as he is, filling the screen (head and shoulders), shaking
    const baseKey = `spr_${l.id}`;
    const f = charMeta(this, baseKey)?.idle?.south ?? 0;
    const before = this.add.image(480, 0, baseKey, f).setOrigin(0.5, 0).setTint(0xfff0b0);
    before.setDisplaySize(620, 620);
    before.setY(-10 + before.displayOriginY * before.scaleY);
    c.add(before);
    const bx = before.x;
    this.tweens.add({ targets: before, x: bx + 4, yoyo: true, repeat: -1, duration: 40 });
    synth.play("telegraph");
    await this.wait(quick ? 260 : 520);
    // RRRIP
    this.tweens.killTweensOf(before);
    before.destroy();
    synth.play("smash");
    synth.play("transform_sparkle");
    const white = this.add.rectangle(480, 270, W, 540, 0xffffff, calm ? 0.35 : 0.95);
    c.add(white);
    this.tweens.add({ targets: white, alpha: 0, duration: calm ? 500 : 260 });
    const col = def?.color ?? 0x999999;
    for (let k = 0; k < (quick ? 10 : 16); k++) {
      const r = this.add.rectangle(480 + (Math.random() - 0.5) * 200, 380 + (Math.random() - 0.5) * 80, 18 + Math.random() * 30, 12 + Math.random() * 22, col).setAngle(Math.random() * 90);
      c.add(r);
      const a = Math.random() * Math.PI * 2;
      this.tweens.add({ targets: r, x: r.x + Math.cos(a) * 520, y: r.y + Math.sin(a) * 360 - 120, angle: r.angle + 540 * (Math.random() - 0.5), alpha: 0, duration: 800, ease: "Quad.out" });
    }
    // after: the gold close-up (or his super saiyan sheet, big, if there's no close-up)
    const por = ssjPortraitKey(this, l.id);
    const sk = ssjKey(this, l.id);
    let after: Phaser.GameObjects.Image | null = null;
    if (por) after = this.add.image(480, 300, por).setDisplaySize(480, 480);
    else if (sk) {
      after = this.add.image(480, 0, sk, 1).setOrigin(0.5, 0);
      after.setDisplaySize(620, 620);
      after.setY(-20);
    }
    if (after) {
      c.add(after);
      const sx = after.scaleX;
      const sy = after.scaleY;
      after.setScale(sx * 1.3, sy * 1.3);
      // (scale writes go through the art factor: tween from the values setScale took, not the raw ones)
      const hd = hdFactor(after);
      this.tweens.add({ targets: after, scaleX: sx / hd, scaleY: sy / hd, duration: 260, ease: "Back.out" });
    }
    const rip = this.add.text(480 + (Math.random() < 0.5 ? -250 : 250), 150, "RRRIP!", { fontFamily: "Impact, sans-serif", fontSize: "54px", color: "#ffffff", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setAngle(-12);
    c.add(rip);
    this.tweens.add({ targets: rip, scale: 1.3, alpha: 0, delay: 250, duration: 450 });
    // his name, slammed in
    const name = this.add.text(-300, 452, (def?.name ?? l.id).toUpperCase(), { fontFamily: "Impact, sans-serif", fontSize: "50px", color: "#ffe066", stroke: "#3a1d00", strokeThickness: 9 }).setOrigin(0, 0.5);
    const sub = this.add.text(-300, 496, "SUPER SAIYAN", { fontFamily: FONT, fontSize: "16px", color: "#fff4c2", fontStyle: "bold" }).setOrigin(0, 0.5);
    c.add([name, sub]);
    this.tweens.add({ targets: [name, sub], x: 40, duration: 220, ease: "Cubic.out" });
    this.cameras.main.shake(300, calm ? 0.006 : 0.018, true);
    await this.wait(quick ? 520 : 1000);
    ev.remove();
    c.destroy();
  }

  /** The aura round one lad, sized to him (base at his feet). */
  private auraOn(l: Lad) {
    const sp = l.spr;
    if (!l.aura && this.textures.exists("fb_aura") && this.anims.exists("fb_aura")) {
      l.aura = this.add.sprite(sp.x, sp.y + 6, "fb_aura", 0).setOrigin(0.5, 0.875).setDepth(sp.depth - 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff27a).setAlpha(0.55);
      l.aura.play({ key: "fb_aura", startFrame: Math.floor(Math.random() * 8) });
    }
    if (l.aura) {
      const sy = (sp.displayHeight * 1.25) / (112 * 0.875);
      l.aura.setScale(sy * 1.2, sy);
    } else if (!l.glow) {
      l.glow = this.add.ellipse(sp.x, sp.y - sp.displayHeight / 2, sp.displayWidth * 1.1, sp.displayHeight * 1.2, 0xffd23f, 0.35).setDepth(sp.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: l.glow, scaleX: 1.15, alpha: 0.2, yoyo: true, repeat: -1, duration: 120 });
    }
  }

  /** He's changed: his super saiyan sheet (half as tall again), or, with no art for him, gold and drawn-on hair. */
  private change(l: Lad) {
    const sp = l.spr;
    if (ssjSwap(sp, l.id, 1)) {
      sp.clearTint();
      // he settles into his stance
      this.time.delayedCall(600, () => sp.active && sp.texture.key.startsWith("ssj_") && sp.setFrame(0));
    } else {
      sp.setTint(0xfff0b0);
      // (scale writes go through the art factor: grow from the value setScale took, not the raw scale)
      const s0 = sp.scaleX / hdFactor(sp);
      this.tweens.add({ targets: sp, scaleX: s0 * 1.15, scaleY: (sp.scaleY / hdFactor(sp)) * 1.06, duration: 300, ease: "Back.out" });
      l.hair ??= this.hair(sp);
    }
    this.auraOn(l);
    if (l.glow) l.glow.setPosition(sp.x, sp.y - sp.displayHeight / 2);
    this.ring(sp.x, sp.y - sp.displayHeight * 0.5, 120);
  }

  /** A gold shockwave ring. */
  private ring(x: number, y: number, r: number) {
    const ring = this.add.circle(x, y, 10, 0xffffff, 0).setStrokeStyle(5, 0xfde047).setDepth(930);
    this.tweens.add({ targets: ring, radius: r, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
  }

  /** A gold bolt from the sky. */
  private bolt(x: number) {
    const g = this.add.graphics().setDepth(935).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(5, 0xfff27a, 1).beginPath().moveTo(x, 0);
    let px = x;
    let py = 0;
    while (py < FLOOR) {
      px += (Math.random() - 0.5) * 50;
      py += 24 + Math.random() * 30;
      g.lineTo(px, py);
    }
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  /** Super-saiyan hair: gold spikes over the head. */
  private hair(sp: Phaser.GameObjects.Sprite) {
    const g = this.add.graphics().setDepth(sp.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    const top = sp.y - sp.displayHeight * 0.74;
    const draw = (k: number) => {
      g.clear();
      g.fillStyle(0xffe066, 0.95);
      for (let j = -3; j <= 3; j++) {
        const bx = sp.x + j * 8;
        g.fillTriangle(bx - 7, top + 14, bx + 7, top + 14, bx + j * 5, top - 16 - (3 - Math.abs(j)) * 6 - k * 3);
      }
    };
    draw(0);
    let k = 0;
    this.time.addEvent({ delay: 90, loop: true, callback: () => g.active && draw((k = 1 - k)) });
    return g;
  }

  private crackle(l?: Lad) {
    if (!l || this.dead) return;
    const sp = l.spr;
    const g = this.add.graphics().setDepth(sp.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(2, 0xfff7c2, 1);
    let x = sp.x + (Math.random() - 0.5) * 60;
    let y = sp.y - sp.displayHeight * Math.random();
    g.beginPath().moveTo(x, y);
    for (let k = 0; k < 4; k++) g.lineTo((x += (Math.random() - 0.5) * 30), (y += (Math.random() - 0.5) * 30));
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
  }

  /** Anime speed lines radiating from a point. */
  private speedLines(cx: number, cy: number, ms: number) {
    const g = this.add.graphics().setDepth(940);
    const draw = () => {
      g.clear();
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 160 + Math.random() * 120;
        g.lineStyle(1 + Math.random() * 3, 0xffffff, 0.5 + Math.random() * 0.4);
        g.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 800, cy + Math.sin(a) * 800);
      }
    };
    const ev = this.time.addEvent({ delay: 60, loop: true, callback: draw });
    draw();
    this.time.delayedCall(ms, () => {
      ev.remove();
      g.destroy();
    });
  }

  // ---------------------------------------------------------------- beat 3: SPIRIT CUM

  private async spirit() {
    synth.music("c7_spirit", true);
    const dragon = this.makeDragon(250, FLOOR + 40, 1.45);
    // (spread a little wider and drawn a touch smaller than before: as super saiyans they stand half as tall again)
    this.placeLads([300, 358, 416, 474, 532, 590, 648, 706, 764], "west", ssjKey(this, G.s.player) ? 3.0 : 3.4, FLOOR - 4);
    for (const l of this.lads) {
      // still super saiyan (facing west, frame 3 of the sheet)
      if (ssjSwap(l.spr, l.id, 3)) l.spr.clearTint();
      else {
        l.spr.setTint(0xfff0b0);
        l.hair = this.hair(l.spr);
      }
      this.auraOn(l);
    }
    // Goku, on a pile of rubble, arms up
    const mound = this.add.graphics().setDepth(-3);
    mound.fillStyle(0x2a2433, 1).fillTriangle(720, FLOOR + 10, 960, FLOOR + 10, 850, FLOOR - 70);
    const gk = this.textures.exists("fb_goku_charge") ? this.add.image(850, FLOOR - 64, "fb_goku_charge").setScale(2.6) : this.add.image(850, FLOOR - 64, "spr_TV_GOKU", 0).setScale(5.2);
    gk.setOrigin(0.5, 1).setDepth(60);
    // the orb
    const orb = this.add.container(850, FLOOR - 64 - gk.displayHeight - 40).setDepth(70);
    const o1 = this.add.circle(0, 0, 50, 0xfff4c2, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    const o2 = this.add.circle(0, 0, 36, 0xffffff, 0.8).setBlendMode(Phaser.BlendModes.ADD);
    const o3 = this.add.circle(0, 0, 22, 0xffffff, 1);
    orb.add([o1, o2, o3]);
    this.tweens.add({ targets: o1, scale: 1.2, alpha: 0.2, yoyo: true, repeat: -1, duration: 220 });
    // motes streaming into it from all over town
    const motes = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const a = Math.random() * Math.PI * 2;
        const m = this.add.circle(orb.x + Math.cos(a) * 500, orb.y + Math.sin(a) * 400, 2 + Math.random() * 2, 0xfff4c2, 1).setDepth(69).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: m, x: orb.x, y: orb.y, duration: 700, ease: "Quad.in", onComplete: () => m.destroy() });
      },
    });
    await this.wait(600);
    await this.talk(FB.FB_READY);
    // the money shot: the whole town pouring into it
    await Juice.still(this, "fe_still_goku_raise", 1500, { push: 0.1, shakeK: 0.012 });
    // it grows
    this.tweens.add({ targets: orb, scale: 2.4, duration: 1500, ease: "Sine.in" });
    this.cameras.main.shake(1500, 0.01);
    this.speedLines(orb.x, orb.y, 1500);
    await this.wait(1600);
    await this.talk(FB.FB_SPIRIT);
    await Juice.eyeShot(this, "fe_eyes_goku", 650, { color: 0xffd23f });
    motes.remove();
    // THROW
    this.stormOn = false;
    synth.play("rocket");
    this.cameras.main.zoomTo(1.15, 400);
    const trail = this.time.addEvent({
      delay: 20,
      loop: true,
      callback: () => {
        const t = this.add.circle(orb.x, orb.y, 40 * orb.scale, 0xfff4c2, 0.5).setDepth(68).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: t, alpha: 0, scale: 0.4, duration: 400, onComplete: () => t.destroy() });
      },
    });
    this.speedLines(480, 220, 1100);
    // ...but it fights back: the orb's caught halfway, and the two of them push
    // (it turns round to face it: the art faces left, its jaws at about 0.29 across and 0.67 up the frame)
    const art = dragon.texture.key === "fb_dragon_side";
    if (art) dragon.setFlipX(true);
    const mouth = art ? { x: dragon.x + dragon.displayWidth * 0.29, y: dragon.y - dragon.displayHeight * 0.66 } : { x: dragon.x + dragon.displayWidth * 0.22, y: dragon.y - dragon.displayHeight * 0.58 };
    await new Promise<void>((res) => this.tweens.add({ targets: orb, x: 520, y: mouth.y - 10, scale: 1.15, duration: 650, ease: "Quad.in", onComplete: () => res() }));
    trail.remove();
    this.cameras.main.zoomTo(1, 300);
    // the two of them, close up: it roars, Goku screams
    const aura = vfx(this, "fe_vfx_darkaura", dragon.x, dragon.y - 6, { scale: 2.6, depth: dragon.depth - 1, alpha: 0.6, add: true });
    if (!synth.shout("concept_roar", 1, 0.8)) synth.play("roar");
    synth.music("fe_clash", true);
    this.cameras.main.shake(700, 0.012);
    await Juice.cutIn(this, "fe_cut_concept", { from: "left", y: 170, color: 0xa855f7, hold: 650 });
    await Juice.cutIn(this, "fe_cut_goku", { from: "right", y: 170, color: 0xffd23f, hold: 650 });
    await this.beamStruggle(orb, gk, mouth);
    aura?.destroy();
    await this.release(orb, dragon, gk, mouth);
    this.dragon = null;
    this.wizard = null;
    await this.talk(FB.FB_DESTROYED);
    // the rain stops; stars (and the music comes back in, softly)
    synth.weatherSound(null);
    synth.music("c7_spirit", true);
    for (let i = 0; i < 70; i++) {
      const st = this.add.circle(Math.random() * W, Math.random() * (FLOOR - 120), Math.random() < 0.2 ? 1.6 : 1, 0xffffff, 0).setDepth(-19);
      this.tweens.add({ targets: st, alpha: 0.5 + Math.random() * 0.5, delay: Math.random() * 2000, duration: 900 });
    }
    for (const o of this.children.list) if (o instanceof Phaser.GameObjects.Sprite && o.texture.key === "vfx_rain") this.tweens.add({ targets: o, alpha: 0, duration: 1500 });
    await this.talk(FB.FB_AFTER.slice(0, 6));
    // Goku's off
    this.tweens.add({ targets: gk, y: gk.y - 600, duration: 700, ease: "Quad.in", delay: 300 });
    await this.talk(FB.FB_AFTER.slice(6));
    await this.wait(400);
  }

  /**
   * THE RELEASE (after the clash is won): the long anime version, 20-odd seconds.
   *   1 SLOW-MO   the clash point creeps into its jaws, the world drained of colour, a heartbeat.
   *   2 EYES      its eyes, yours, Goku's.
   *   3 PANELS    three manga panels slam in (Goku, you, it), then the SPIRIT CUM goes down its throat (impact frames,
   *               the drawn money shot).
   *   4 SPHERE    a sphere of white-gold light swells out of it, speed lines, rings, the Krew braced in the gale,
   *               and it comes apart in stages: cracks of light all over it, chunks blown off, erased from the top down,
   *               the wizard behind it screaming (a close-up) and coming apart.
   *   5 WHITE-OUT silence but the ringing in your ears.
   *   6 AFTERMATH the white thins out over a smoking crater, embers coming down, the Krew still standing.
   * calmFlash: no impact frames, the whites are half strength and slow, nothing strobes.
   */
  private async release(orb: Phaser.GameObjects.Container, dragon: Phaser.GameObjects.Image, gk: Phaser.GameObjects.Image, mouth: { x: number; y: number }) {
    const calm = !!G.meta.settings.calmFlash;
    const cam = this.cameras.main;
    // ---- 1 SLOW-MO: it's going in. Everything slows; the colour drains out; a heartbeat.
    const drain = this.add.rectangle(480, 270, W * 2, 1100, 0x1a2a4a, 0).setDepth(960).setScrollFactor(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.tweens.add({ targets: drain, alpha: 0.55, duration: 300 });
    Juice.duckMusic(2600, 900, 0.04);
    Juice.heartbeat(1);
    this.time.delayedCall(700, () => !this.dead && Juice.heartbeat(1));
    Juice.slowMo(this, 0.25, 2200);
    cam.pan(mouth.x + 60, mouth.y, 500, "Sine.easeInOut", true);
    cam.zoomTo(1.7, 600, "Sine.easeInOut", true);
    const tip = this.add.text(mouth.x + 70, mouth.y - 90, "!!", { fontFamily: "Impact, sans-serif", fontSize: "48px", color: "#ffffff", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setDepth(990).setAlpha(0);
    this.tweens.add({ targets: tip, alpha: 1, y: tip.y - 14, duration: 200, hold: 400, yoyo: true, onComplete: () => tip.destroy() });
    await new Promise<void>((res) => this.tweens.add({ targets: orb, x: mouth.x + 26, y: mouth.y, scale: 1.6, duration: 520, ease: "Sine.in", onComplete: () => res() }));
    // ---- 2 EYES
    await Juice.eyeShot(this, "fe_eyes_concept", 750, { color: 0xa855f7 });
    await Juice.eyeShot(this, youEyesKey(this, G.s.player), 600, { color: 0xffe066 });
    await Juice.eyeShot(this, "fe_eyes_goku", 600, { color: 0xffd23f });
    this.tweens.killTweensOf(drain);
    drain.destroy();
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    // ---- 3 PANELS, then down its throat
    cam.panEffect.reset();
    cam.zoomEffect.reset();
    cam.setZoom(1).setScroll(0, 0);
    await this.mangaPanels([
      { key: "fe_cut_goku", color: 0xffd23f, word: "SPIRIIIT" },
      { key: youCutKey(this, G.s.player) ?? "fe_eyes_ssj", color: 0xffe066, word: "GO!!" },
      { key: "fe_cut_concept_hurt", color: 0xa855f7, word: "?!" },
    ]);
    // ---- 3b THE BEAM: Goku lets the whole lot go, the Krew's power behind it: a column of light, his hands to its jaws
    await this.megaBeam(gk, dragon, orb, mouth);
    synth.play("rocket");
    cam.zoomTo(1.15, 200, "Quad.easeOut", true);
    cam.pan(dragon.x + 60, dragon.y - dragon.displayHeight * 0.5, 200, "Quad.easeOut", true);
    await new Promise<void>((res) => this.tweens.add({ targets: orb, x: dragon.x + 30, y: dragon.y - dragon.displayHeight * 0.55, scale: 3.6, duration: 260, ease: "Quad.in", onComplete: () => res() }));
    await Juice.impactFrames(this, dragon, 70);
    if (this.textures.exists("fe_still_spirit")) {
      synth.play("explode_2");
      Juice.subDrop(1, 2);
      await Juice.still(this, "fe_still_spirit", 1700, { push: 0.14, shakeK: 0.02, flipX: true });
    }
    // ---- 4 THE SPHERE (the music's gone: just the blast)
    synth.stopMusic();
    orb.destroy();
    cam.panEffect.reset();
    cam.zoomEffect.reset();
    cam.setZoom(1).setScroll(0, 0);
    const cx = dragon.x + 20;
    const cy = dragon.y - dragon.displayHeight * 0.5;
    synth.play("boom");
    synth.play("explode_1");
    Juice.subDrop(1, 2.6);
    Juice.flash(this, 0xffffff, 500, 0.8, 975);
    const sphere = this.add.container(cx, cy).setDepth(70);
    const halo = this.add.circle(0, 0, 60, 0xfff4c2, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    const body = this.add.circle(0, 0, 44, 0xffffff, 0.85).setBlendMode(Phaser.BlendModes.ADD);
    const rim = this.add.circle(0, 0, 46, 0x000000, 0).setStrokeStyle(6, 0xffd23f, 0.9);
    sphere.add([halo, body, rim]);
    sphere.setScale(0.4);
    // it swells, in pulses (each pulse a ring and a shove), to swallow half the screen
    this.tweens.add({ targets: sphere, scale: 6.5, duration: 5600, ease: "Sine.in" });
    this.tweens.add({ targets: halo, scale: 1.25, alpha: 0.2, yoyo: true, repeat: -1, duration: calm ? 700 : 260 });
    this.speedLines(cx, cy, 5600);
    const rings = this.time.addEvent({
      delay: calm ? 700 : 380,
      loop: true,
      callback: () => {
        const r = this.add.circle(cx, cy, 30, 0xffffff, 0).setStrokeStyle(4, 0xfff4c2, 0.9).setDepth(71);
        this.tweens.add({ targets: r, radius: 620, alpha: 0, duration: 900, onComplete: () => r.destroy() });
        this.cameras.main.shake(260, calm ? 0.005 : 0.012);
        synth.play(Math.random() < 0.5 ? "thunder_1" : "boom", 0.5);
      },
    });
    // the Krew braced in the gale: hair (and auras) streaming, shoved back a step
    for (const l of this.lads) {
      this.tweens.add({ targets: l.spr, x: l.spr.x + 18, duration: 1800, ease: "Sine.out" });
      if (l.aura) this.tweens.add({ targets: l.aura, alpha: 1, duration: 600 });
      l.aura?.setTint(0xffffff);
    }
    const gale = this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        const y = Math.random() * 540;
        const s = this.add.rectangle(cx + 40, y, 30 + Math.random() * 70, 2, 0xffffff, 0.5).setDepth(940).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: s, x: W + 80, duration: 300 + Math.random() * 200, onComplete: () => s.destroy() });
      },
    });
    // stage 1: light cracks open all over it
    const cracks = this.add.graphics().setDepth(dragon.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    const db = dragon.getBounds();
    const crackPaths: { x: number; y: number }[][] = [];
    for (let i = 0; i < 16; i++) {
      let x = db.x + Math.random() * db.width;
      let y = db.y + db.height * 0.2 + Math.random() * db.height * 0.7;
      const path = [{ x, y }];
      for (let k = 0; k < 6; k++) path.push({ x: (x += (Math.random() - 0.5) * 50), y: (y += (Math.random() - 0.5) * 50) });
      crackPaths.push(path);
    }
    const crackK = { v: 0 };
    this.tweens.add({
      targets: crackK,
      v: 1,
      duration: 1600,
      onUpdate: () => {
        cracks.clear();
        for (const [i, path] of crackPaths.entries()) {
          const n = Math.floor(path.length * Phaser.Math.Clamp(crackK.v * 1.6 - i * 0.04, 0, 1));
          if (n < 2) continue;
          cracks.lineStyle(5, 0xffd23f, 0.6).beginPath().moveTo(path[0].x, path[0].y);
          for (let k = 1; k < n; k++) cracks.lineTo(path[k].x, path[k].y);
          cracks.strokePath();
          cracks.lineStyle(2, 0xffffff, 1).beginPath().moveTo(path[0].x, path[0].y);
          for (let k = 1; k < n; k++) cracks.lineTo(path[k].x, path[k].y);
          cracks.strokePath();
        }
      },
    });
    synth.play("monitor_crack");
    this.cameras.main.shake(1600, calm ? 0.006 : 0.014);
    await this.wait(1700);
    // stage 2: chunks blown off it, then it's erased, from the top down, into the light
    synth.play("bonecrack");
    synth.play("explode_2");
    this.chunks(dragon, 26);
    this.disintegrate(dragon, 0xfff4c2);
    const fw = dragon.frame.realWidth;
    const fh = dragon.frame.realHeight;
    const erase = { v: 0 };
    this.tweens.add({
      targets: erase,
      v: 1,
      duration: 2600,
      ease: "Sine.in",
      onUpdate: () => {
        const top = fh * erase.v;
        dragon.setCrop(0, top, fw, fh - top);
        cracks.setAlpha(1 - erase.v);
        // the edge it's being erased at, burning
        if (Math.random() < 0.7) {
          const ey = dragon.y - dragon.displayHeight + (top / fh) * dragon.displayHeight;
          const ex = dragon.x - dragon.displayWidth / 2 + Math.random() * dragon.displayWidth;
          const sp = this.add.rectangle(ex, ey, 4 + Math.random() * 6, 4 + Math.random() * 6, Math.random() < 0.5 ? 0xffffff : 0xffd23f, 1).setDepth(986).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: sp, x: ex + 60 + Math.random() * 160, y: ey - 60 - Math.random() * 120, alpha: 0, duration: 900, onComplete: () => sp.destroy() });
        }
      },
    });
    await this.wait(900);
    // stage 3: the wizard behind it, shown one last time, screaming, coming apart
    const wz = this.wizard;
    if (wz) {
      this.tweens.killTweensOf(wz);
      wz.setAlpha(0.85).setTintFill(0xffffff).setDepth(-9);
      const scream = this.add.text(wz.x, wz.y - wz.displayHeight - 10, "AAAAAAAAAAAAAAARGH", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#c4b5fd", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(990);
      this.tweens.add({ targets: scream, alpha: 0, y: scream.y - 40, delay: 1500, duration: 800 });
      this.disintegrate(wz, 0xe9d5ff);
      if (!synth.shout("wizard_yee", 1, 0.6)) synth.play("shriek");
      void Juice.cutIn(this, this.textures.exists("fb_wizard") ? "fb_wizard" : "fe_cut_concept_hurt", { from: "left", y: 140, color: 0xe9d5ff, hold: 900, focus: 0.05, w: 640 });
      this.tweens.add({ targets: wz, alpha: 0, scaleX: wz.scaleX * 1.3, duration: 2400 });
    }
    // god rays out of the sphere
    const rays = this.add.graphics().setDepth(985).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rays.fillStyle(0xfff7d6, 0.16).fillTriangle(cx, cy, cx + Math.cos(a) * 1000, cy + Math.sin(a) * 1000, cx + Math.cos(a + 0.11) * 1000, cy + Math.sin(a + 0.11) * 1000);
    }
    rays.setAlpha(0);
    this.tweens.add({ targets: rays, alpha: 1, duration: 800 });
    this.tweens.add({ targets: rays, angle: 12, duration: 4000 });
    await this.wait(1800);
    // ---- 5 WHITE-OUT
    rings.remove();
    gale.remove();
    const white = this.add.rectangle(480, 270, W * 2, 1100, 0xffffff, 0).setDepth(980).setScrollFactor(0);
    this.tweens.add({ targets: white, alpha: calm ? 0.6 : 1, duration: calm ? 900 : 350, ease: "Quad.in" });
    synth.play("reveal_boom");
    Juice.subDrop(1, 3);
    await this.wait(calm ? 900 : 400);
    Juice.earRing(4200, 0.1);
    synth.weatherSound(null);
    this.cameras.main.shake(2200, calm ? 0.006 : 0.02);
    dragon.setVisible(false);
    sphere.destroy();
    cracks.destroy();
    rays.destroy();
    await this.wait(2600);
    // ---- 6 AFTERMATH: a smoking crater where it stood; embers coming down; the Krew, still standing
    this.stormOn = false;
    for (const o of this.children.list) if (o instanceof Phaser.GameObjects.Sprite && o.texture.key === "vfx_rain") o.setAlpha(0);
    const crater = this.add.graphics().setDepth(-4);
    crater.fillStyle(0x050307, 1).fillEllipse(dragon.x + 20, FLOOR + 22, 420, 60);
    crater.fillStyle(0x2a1a10, 1).fillEllipse(dragon.x + 20, FLOOR + 16, 360, 36);
    crater.fillStyle(0xff7a2a, 0.35).fillEllipse(dragon.x + 20, FLOOR + 14, 260, 18);
    if (hasVfx(this, "vfx_smokecol")) for (let i = 0; i < 3; i++) vfx(this, "vfx_smokecol", dragon.x - 80 + i * 90, FLOOR + 10, { scale: 2.2, depth: -3, alpha: 0.55, delay: i * 200 });
    const embers = this.time.addEvent({
      delay: 70,
      repeat: 120,
      callback: () => {
        const e = this.add.circle(Math.random() * W, -10, 1.5 + Math.random() * 2, Math.random() < 0.5 ? 0xffb347 : 0xfff4c2, 1).setDepth(950).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: e, y: 420 + Math.random() * 100, x: e.x + (Math.random() - 0.5) * 120, alpha: 0, duration: 3000 + Math.random() * 2000, onComplete: () => e.destroy() });
      },
    });
    for (const l of this.lads) {
      l.aura?.setTint(0xfff27a);
      if (l.aura) this.tweens.add({ targets: l.aura, alpha: 0.35, duration: 2000 });
    }
    void gk;
    cam.setZoom(1.35).centerOn(dragon.x + 80, FLOOR - 70);
    cam.zoomTo(1, 4200, "Sine.easeInOut", true);
    cam.pan(480, 270, 4200, "Sine.easeInOut", true);
    this.tweens.add({ targets: white, alpha: 0, duration: 3000, ease: "Sine.out" });
    await this.wait(3400);
    white.destroy();
    this.time.delayedCall(9000, () => embers.remove());
  }

  /**
   * THE MEGA BEAM (the release, after the panels): a column of light out of Goku's hands, thickening as it goes, driving
   * the SPIRIT CUM down its throat. Streaks race along it, speed lines, the Krew's auras go white; impact frames as it
   * lands; it shoves the beast back a step. About three seconds. calmFlash: no flicker, no impact frames, gentler shake.
   */
  private megaBeam(gk: Phaser.GameObjects.Image, dragon: Phaser.GameObjects.Image, orb: Phaser.GameObjects.Container, mouth: { x: number; y: number }): Promise<void> {
    return new Promise((res) => {
      if (this.dead || this.ended) return;
      const calm = !!G.meta.settings.calmFlash;
      const cam = this.cameras.main;
      const x0 = gk.x - 10;
      const y0 = gk.y - gk.displayHeight * 0.92;
      const x1 = mouth.x;
      const y1 = mouth.y;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const ang = Math.atan2(y1 - y0, x1 - x0);
      orb.setPosition(x0, y0).setScale(1.3);
      // (over the Krew and their auras: it's the one thing on screen)
      const g = this.add.graphics().setDepth(880).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.graphics().setDepth(881);
      const k = { w: 6, reach: 0 };
      const ms = 2900;
      Juice.duckMusic(ms, 400, 0.15);
      synth.play("gun_rail");
      synth.play("rocket");
      Juice.subDrop(1, 3);
      synth.play("telegraph");
      Juice.slamText(this, "HAAAAAAAAAAAAAAAA!!!", "#fff4c2", 58, 120, 1800);
      const stopLines = Juice.speedLines(this, 0, 0xfff4c2, 960);
      cam.shake(ms, calm ? 0.005 : 0.016);
      this.tweens.add({ targets: k, reach: 1, duration: 420, ease: "Quad.in" });
      this.tweens.add({ targets: k, w: 120, duration: ms, ease: "Sine.in" });
      let landed = false;
      const draw = () => {
        const r = len * k.reach;
        const ex = x0 + Math.cos(ang) * r;
        const ey = y0 + Math.sin(ang) * r;
        const wob = calm ? 1 : 0.88 + Math.random() * 0.24;
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        const quad = (gr: Phaser.GameObjects.Graphics, w: number, col: number, a: number) => {
          gr.fillStyle(col, a);
          gr.fillPoints([
            { x: x0 + nx * w * 0.35, y: y0 + ny * w * 0.35 },
            { x: ex + nx * w, y: ey + ny * w },
            { x: ex - nx * w, y: ey - ny * w },
            { x: x0 - nx * w * 0.35, y: y0 - ny * w * 0.35 },
          ], true);
          gr.fillCircle(ex, ey, w * 1.1);
        };
        g.clear();
        core.clear();
        quad(g, k.w * 1.7 * wob, 0xffd23f, 0.28);
        quad(g, k.w * 1.15 * wob, 0xfff4c2, 0.55);
        quad(core, k.w * 0.55 * wob, 0xffffff, 1);
        orb.setPosition(ex, ey).setScale(1.3 + k.w / 60);
        if (k.reach >= 1 && !landed) {
          landed = true;
          synth.play("explode_1");
          synth.play("boom");
          void Juice.impactFrames(this, dragon, 60);
          Juice.flash(this, 0xffffff, 300, 0.6, 975);
          // shoved back a step
          this.tweens.add({ targets: dragon, x: dragon.x - 26, duration: 900, ease: "Quad.out" });
          Juice.shockRing(this, x1, y1, { color: 0xffd23f, to: 360, rings: 3, ms: 700, depth: 883 });
        }
        // streaks racing along it
        if (Math.random() < 0.8) {
          const off = (Math.random() - 0.5) * k.w * 1.6;
          const st = this.add.rectangle(x0 + nx * off * 0.4, y0 + ny * off * 0.4, 40 + Math.random() * 60, 3, 0xffffff, 0.9).setDepth(882).setRotation(ang).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: st, x: x1 + nx * off, y: y1 + ny * off, alpha: 0.2, duration: 260, onComplete: () => st.destroy() });
        }
        // spray off the impact point
        if (landed && Math.random() < 0.6) {
          const a = ang + Math.PI + (Math.random() - 0.5) * 2.2;
          const sp = this.add.circle(x1, y1, 2 + Math.random() * 4, Math.random() < 0.5 ? 0xffffff : 0xffd23f, 1).setDepth(883).setBlendMode(Phaser.BlendModes.ADD);
          const v = 120 + Math.random() * 260;
          this.tweens.add({ targets: sp, x: x1 + Math.cos(a) * v, y: y1 + Math.sin(a) * v, alpha: 0, duration: 500, onComplete: () => sp.destroy() });
        }
      };
      // the Krew pour into it: their auras go white and swell
      for (const l of this.lads) {
        l.aura?.setTint(0xffffff);
        if (l.aura) this.tweens.add({ targets: l.aura, alpha: 1, duration: 600 });
      }
      this.events.on("update", draw);
      this.time.delayedCall(ms, () => {
        this.events.off("update", draw);
        stopLines();
        this.tweens.add({ targets: [g, core], alpha: 0, duration: 250, onComplete: () => (g.destroy(), core.destroy()) });
        res();
      });
    });
  }

  /** Chunks blown off something big: rectangles in its colours, tumbling away from the middle. */
  private chunks(o: Phaser.GameObjects.Image, n: number) {
    const b = o.getBounds();
    const cols = [0x2a1640, 0x4c1d95, 0x12002a, 0xffd23f];
    for (let i = 0; i < n; i++) {
      const x = b.x + Math.random() * b.width;
      const y = b.y + b.height * 0.2 + Math.random() * b.height * 0.7;
      const r = this.add.rectangle(x, y, 10 + Math.random() * 26, 8 + Math.random() * 18, cols[i % cols.length], 1).setDepth(987).setAngle(Math.random() * 90);
      const a = Math.atan2(y - (b.y + b.height / 2), x - b.centerX) + (Math.random() - 0.5) * 0.6;
      const v = 200 + Math.random() * 380;
      this.tweens.add({ targets: r, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v - 80, angle: r.angle + (Math.random() - 0.5) * 720, alpha: 0, duration: 1100 + Math.random() * 600, ease: "Quad.out", onComplete: () => r.destroy() });
    }
  }

  /**
   * MANGA PANELS: the screen splits into slanted panels (white gutters) that slam in one after another, each a
   * close-up with speed lines behind it and a big sound word, held a beat, then all of it cuts away.
   */
  private mangaPanels(panels: { key: string; color: number; word: string }[]): Promise<void> {
    return new Promise((res) => {
      if (this.dead || this.ended) return;
      const calm = !!G.meta.settings.calmFlash;
      const root = this.add.container(0, 0);
      Juice.layer(this, 4992).add(root);
      root.add(this.add.rectangle(480, 270, 1100, 700, 0xffffff, 1));
      const n = panels.length;
      const slant = 60;
      const pw = 960 / n;
      panels.forEach((p, i) => {
        this.time.delayedCall(i * 420, () => {
          if (!root.active) return;
          const x0 = i * pw;
          // the panel's shape: a parallelogram with a gutter round it
          const pts = [x0 + 8 + (i ? slant / 2 : -40), 8, x0 + pw - 8 + slant / 2, 8, x0 + pw - 8 - slant / 2 + (i === n - 1 ? 60 : 0), 532, x0 + 8 - slant / 2, 532];
          const shape = this.make.graphics({}, false);
          shape.fillStyle(0xffffff).fillPoints([0, 2, 4, 6].map((k) => new Phaser.Math.Vector2(pts[k], pts[k + 1])), true);
          const mask = shape.createGeometryMask();
          const panel = this.add.container(0, 0);
          panel.setMask(mask);
          const bg = this.add.rectangle(x0 + pw / 2, 270, pw + slant + 80, 540, 0x0b0612, 1);
          const lines = this.add.graphics();
          const cxp = x0 + pw / 2;
          for (let k = 0; k < 40; k++) {
            const a = Math.random() * Math.PI * 2;
            lines.lineStyle(1 + Math.random() * 3, p.color, 0.3 + Math.random() * 0.4).lineBetween(cxp + Math.cos(a) * 80, 270 + Math.sin(a) * 80, cxp + Math.cos(a) * 700, 270 + Math.sin(a) * 700);
          }
          panel.add([bg, lines]);
          if (this.textures.exists(p.key)) {
            const img = this.add.image(cxp, 270, p.key);
            const k = Math.max((pw + slant) / img.frame.realWidth, 540 / img.frame.realHeight) * 1.05;
            img.setScale(k / hdFactor(img));
            panel.add(img);
            this.tweens.add({ targets: img, scale: (k * 1.08) / hdFactor(img), duration: 1600 });
          }
          const frame = this.add.graphics();
          frame.lineStyle(6, 0x000000, 1).strokePoints([0, 2, 4, 6].map((k) => new Phaser.Math.Vector2(pts[k], pts[k + 1])), true, true);
          const word = this.add.text(cxp, 470, p.word, { fontFamily: "Impact, sans-serif", fontSize: "52px", color: "#ffffff", stroke: "#000", strokeThickness: 10 }).setOrigin(0.5).setAngle(-8).setScale(2.4).setAlpha(0);
          root.add([panel, frame, word]);
          this.tweens.add({ targets: word, scale: 1, alpha: 1, duration: 160, ease: "Quad.in" });
          panel.x = (i % 2 ? 1 : -1) * 60;
          this.tweens.add({ targets: panel, x: 0, duration: 140, ease: "Cubic.out" });
          synth.play(i === n - 1 ? "smash" : "swing");
          this.cameras.main.shake(160, calm ? 0.004 : 0.01);
          root.once("destroy", () => shape.destroy());
        });
      });
      this.time.delayedCall(n * 420 + 1300, () => {
        root.destroy();
        res();
      });
    });
  }

  /**
   * THE CLASH. The SPIRIT CUM stops dead in mid-air: the Concept breathes its own beam back at it and the two meet
   * in the middle of town. Mash (any key, click, tap) to push it back down its throat; the lads roar and pour in
   * their power too, so it gets there on its own if you don't (never a fail). The harder you mash, the faster it
   * goes, but it's a proper struggle: about twice as long as it was, and a third of the way in it SURGES back.
   * Everything builds as it goes (`build`, 0..1): the auras swell, the ground cracks open under the Krew, rubble
   * lifts off the street, the lads yell louder and more often, the shake ramps up, the light goes gold. (calmFlash:
   * gentler shake, no flicker.) Ends with the clash point at its mouth.
   */
  private beamStruggle(orb: Phaser.GameObjects.Container, gk: Phaser.GameObjects.Image, mouth: { x: number; y: number }): Promise<void> {
    return new Promise((resolve) => {
      if (this.dead || this.ended) return;
      const calm = !!G.meta.settings.calmFlash;
      const src = { x: gk.x, y: gk.y - gk.displayHeight * 0.92 };
      // 0 = at its mouth (won), 1 = at Goku
      let t = (orb.x - mouth.x) / (src.x - mouth.x);
      let mash = 0;
      let elapsed = 0;
      let lastBurst = 0;
      let youCut = false;
      let surged = false;
      let rallied = false;
      let lastPush = false;
      let done = false;
      let build = 0;
      this.clashing = true;
      // the build-up: each lad's aura swells from where it is now; the cracks are drawn in as it goes
      const auraBase = new Map(this.lads.filter((l) => l.aura).map((l) => [l, { sx: l.aura!.scaleX, sy: l.aura!.scaleY, flare: 0 }]));
      const ground = this.add.graphics().setDepth(-4);
      const crackPaths: { x: number; y: number }[][] = [];
      for (const x0 of [...this.lads.map((l) => l.spr.x), gk.x]) {
        for (let k = 0; k < 2; k++) {
          let x = x0 + (Math.random() - 0.5) * 20;
          let y = FLOOR + 6;
          const path = [{ x, y }];
          for (let j = 0; j < 7; j++) path.push({ x: (x += (Math.random() - 0.5) * 60), y: (y += 6 + Math.random() * 18) });
          crackPaths.push(path);
        }
      }
      const glowGold = this.add.rectangle(480, 270, W * 2, 1100, 0xffd23f, 0).setDepth(955).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD);
      let lastRock = 0;
      const beams = this.add.graphics().setDepth(66).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.graphics().setDepth(67);
      const L = Juice.layer(this, 1050);
      const prompt = this.add.text(480, 448, "MASH!", { fontFamily: "Impact, sans-serif", fontSize: "44px", color: "#ffe066", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5);
      const hint = this.add.text(480, 486, "any key · click · tap", { fontFamily: FONT, fontSize: "14px", color: "#fff4c2", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5);
      const barBack = this.add.rectangle(480, 512, 420, 14, 0x000000, 0.75).setStrokeStyle(2, 0xffd23f, 0.9);
      const barDark = this.add.rectangle(270, 512, 420, 10, 0x6d28d9, 1).setOrigin(0, 0.5);
      const barGold = this.add.rectangle(690, 512, 210, 10, 0xffe066, 1).setOrigin(1, 0.5);
      L.add([prompt, hint, barBack, barDark, barGold]);
      this.tweens.add({ targets: prompt, scale: 1.12, yoyo: true, repeat: -1, duration: 140 });
      if (!synth.shout("concept_roar", 1, 0.85)) synth.play("roar");
      synth.play("gun_rail");
      Juice.subDrop(1, 1.6);
      const stopLines = Juice.speedLines(this, 0, 0xfff4c2, 1040);
      const push = () => {
        if (done) return;
        mash++;
        t -= 0.015;
        build = Math.min(1, build + 0.006);
        Juice.punchZoom(this, 0.03, 160, 1);
        if (mash % 3 === 0) synth.play("hit");
        // the lads pour it in: their auras flare
        const l = this.lads[mash % Math.max(1, this.lads.length)];
        const ab = l && auraBase.get(l);
        if (ab) ab.flare = 0.25;
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape" && !e.repeat) push();
      };
      this.input.keyboard?.on("keydown", onKey);
      this.input.on("pointerdown", push);
      let shoutI = 0;
      // the lads yelling encouragement: more often, and louder, as it builds
      let nextShout = 0;
      const shout = () => {
        const l = this.lads[shoutI++ % Math.max(1, this.lads.length)];
        if (!l) return;
        const line = shoutI % 3 === 0 ? "AAAAAAAAA" : (Phaser.Utils.Array.GetRandom(FB.FB_CLASH_SHOUTS) as string);
        const tx = this.add.text(l.spr.x, l.spr.y - l.spr.displayHeight - 10, line, { fontFamily: "Impact, sans-serif", fontSize: `${15 + Math.round(build * 9)}px`, color: build > 0.6 ? "#ffffff" : "#ffe066", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(950);
        this.tweens.add({ targets: tx, y: tx.y - 30 - build * 20, alpha: 0, duration: 1100, onComplete: () => tx.destroy() });
      };
      const shouts = { remove: () => undefined };
      const tick = () => {
        if (this.dead || this.ended) return cleanup(false);
        const dt = Math.min(50, this.game.loop.delta) / 1000;
        elapsed += dt;
        // it pushes back hard at first; the Krew's power builds and wins out on its own (about 15 seconds untouched).
        // However hard you mash, it holds you off for a good ten seconds (the floor below creeps down): mashing pins
        // it at the edge of giving, so it's always a STRUGGLE, never a quick tap-tap-done
        const krew = Math.min(0.22, elapsed * 0.022);
        t += (0.1 - krew) * dt;
        t = Phaser.Math.Clamp(t, Math.max(0, 0.62 - elapsed * 0.056), 0.82);
        build = Math.min(1, build + dt * 0.075);
        // a third of the way in: it SURGES. Then the Krew rally: everyone, now.
        if (!surged && elapsed > 3.6) {
          surged = true;
          t = Math.min(0.82, t + 0.16);
          if (!synth.shout("concept_roar", 1, 0.7)) synth.play("roar");
          Juice.slamText(this, "IT'S PUSHING BACK!", "#c084fc", 46, 170, 1000);
          this.cameras.main.shake(600, calm ? 0.006 : 0.02);
          void Juice.cutIn(this, "fe_cut_concept_hurt", { from: "left", y: 380, color: 0xa855f7, hold: 600 });
        }
        if (surged && !rallied && elapsed > 5.4) {
          rallied = true;
          Juice.slamText(this, "EVERYONE, NOW!", "#ffe066", 48, 170, 1000);
          synth.play("reveal_boom");
          Juice.riser(2400, 0.3);
          const cut = this.lads.map((l) => `fe_cut_lad_${l.id}`).find((k) => k !== `fe_cut_lad_${G.s.player}` && this.textures.exists(k));
          if (cut) void Juice.cutIn(this, cut, { from: "right", y: 380, color: 0xffd23f, hold: 700 });
          for (const ab of auraBase.values()) ab.flare = 0.6;
          for (const l of this.lads) this.ring(l.spr.x, l.spr.y - l.spr.displayHeight * 0.5, 140);
        }
        // nearly there: one last roar from it, one last scream from everyone
        if (rallied && !lastPush && elapsed > 8.6) {
          lastPush = true;
          Juice.slamText(this, "LAST PUSH!!!", "#ffffff", 54, 170, 1000);
          if (!synth.shout("concept_roar", 1, 0.6)) synth.play("roar");
          Juice.subDrop(1, 1.4);
          this.cameras.main.shake(900, calm ? 0.006 : 0.022);
          void Juice.cutIn(this, "fe_cut_goku", { from: "right", y: 380, color: 0xffd23f, hold: 600 });
          for (const ab of auraBase.values()) ab.flare = 0.8;
        }
        // the auras swell
        for (const [l, ab] of auraBase) {
          ab.flare = Math.max(0, ab.flare - dt * 1.5);
          const g = 1 + build * 0.7 + ab.flare;
          l.aura?.setScale(ab.sx * g, ab.sy * g).setAlpha(Math.min(1, 0.55 + build * 0.45));
        }
        // the ground cracks open under them
        ground.clear();
        for (const path of crackPaths) {
          const n = Math.floor(path.length * Phaser.Math.Clamp(build * 1.4 - 0.1, 0, 1));
          if (n < 2) continue;
          ground.lineStyle(4, 0x050307, 1).beginPath().moveTo(path[0].x, path[0].y);
          for (let j = 1; j < n; j++) ground.lineTo(path[j].x, path[j].y);
          ground.strokePath();
          ground.lineStyle(1.5, 0xffd23f, 0.4 + build * 0.5).beginPath().moveTo(path[0].x, path[0].y);
          for (let j = 1; j < n; j++) ground.lineTo(path[j].x, path[j].y);
          ground.strokePath();
        }
        // rubble lifting off the street
        if (elapsed - lastRock > 0.5 - build * 0.38) {
          lastRock = elapsed;
          const rx = 280 + Math.random() * 640;
          const r = this.add.rectangle(rx, FLOOR + 10 + Math.random() * 30, 4 + Math.random() * 12, 4 + Math.random() * 10, Phaser.Utils.Array.GetRandom([0x2a2433, 0x3a2f3f, 0x4a3a2a]) as number).setDepth(65).setAngle(Math.random() * 90);
          this.tweens.add({ targets: r, y: r.y - 140 - Math.random() * 200 * (0.5 + build), angle: r.angle + (Math.random() - 0.5) * 300, alpha: 0, duration: 2200 + Math.random() * 800, ease: "Sine.out", onComplete: () => r.destroy() });
        }
        // the lads: more often, louder
        if (elapsed >= nextShout) {
          nextShout = elapsed + 0.7 - build * 0.42;
          shout();
        }
        // the light goes gold (steady, no flicker)
        glowGold.setAlpha(build * (calm ? 0.08 : 0.14));
        if (Math.random() < build * 0.06 && !calm) this.bolt(280 + Math.random() * 640);
        const cx = mouth.x + (src.x - mouth.x) * t;
        const cy = mouth.y + (src.y - mouth.y) * t;
        orb.setPosition(cx, cy);
        const wob = Math.sin(elapsed * 40) * 4;
        beams.clear();
        // its beam: violet, black-cored
        beams.lineStyle(70 + wob, 0x7c3aed, 0.6).lineBetween(mouth.x, mouth.y, cx, cy);
        beams.lineStyle(32, 0xc084fc, 0.85).lineBetween(mouth.x, mouth.y, cx, cy);
        // the SPIRIT CUM: white-gold, wider
        beams.lineStyle(90 - wob, 0xfff4c2, 0.5).lineBetween(src.x, src.y, cx, cy);
        beams.lineStyle(40, 0xffffff, 0.95).lineBetween(src.x, src.y, cx, cy);
        // where they meet: a ragged star of light
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 50 + Math.random() * 70;
          beams.lineStyle(3 + Math.random() * 5, Math.random() < 0.5 ? 0xffffff : 0xc084fc, 0.9).lineBetween(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        core.clear();
        core.lineStyle(8, 0x12002a, 0.9).lineBetween(mouth.x, mouth.y, cx, cy);
        // the clash itself: a flickering knot of light, throwing sparks
        if (Math.random() < 0.5) {
          const sp = this.add.circle(cx, cy, 3 + Math.random() * 4, Math.random() < 0.5 ? 0xffffff : 0xc084fc, 1).setDepth(72).setBlendMode(Phaser.BlendModes.ADD);
          const a = Math.random() * Math.PI * 2;
          const v = 60 + Math.random() * 160;
          this.tweens.add({ targets: sp, x: cx + Math.cos(a) * v, y: cy + Math.sin(a) * v, alpha: 0, duration: 380, onComplete: () => sp.destroy() });
        }
        // halfway in, you: your own super saiyan close-up whips across
        if (!youCut && elapsed > 2.2) {
          youCut = true;
          const por = youCutKey(this, G.s.player);
          if (por) void Juice.cutIn(this, por, por.startsWith("fe_") ? { from: "right", y: 150, color: 0xffe066, hold: 700 } : { from: "right", y: 150, color: 0xffe066, hold: 700, focus: 0.62, w: 480 });
        }
        if (elapsed - lastBurst > 0.22) {
          lastBurst = elapsed;
          if (!vfx(this, "fe_vfx_clash", cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20, { scale: 1.6 + Math.random() * 0.8, depth: 73, add: true, angle: Math.random() * 360 }) && hasVfx(this, "vfx_sparks")) vfx(this, "vfx_sparks", cx, cy, { scale: 1.6, depth: 73, add: true });
        }
        orb.setScale(1.15 + Math.sin(elapsed * 30) * 0.12);
        const k = 1 - t;
        if (Math.random() < 0.25) this.cameras.main.shake(80, (calm ? 0.4 : 1) * (0.003 + k * 0.006 + build * 0.012));
        barGold.width = 420 * (1 - t);
        barDark.width = 420 - barGold.width;
        if (t <= 0.06) cleanup(true);
      };
      const cleanup = (won: boolean) => {
        if (done) return;
        done = true;
        this.clashing = false;
        this.events.off("update", tick);
        this.input.keyboard?.off("keydown", onKey);
        this.input.off("pointerdown", push);
        shouts.remove();
        stopLines();
        // the auras settle back down (swollen to the max they'd hide the release behind a wall of fire)
        for (const [l, ab] of auraBase) if (l.aura) this.tweens.add({ targets: l.aura, scaleX: ab.sx * 1.15, scaleY: ab.sy * 1.15, alpha: 0.8, duration: 500 });
        beams.destroy();
        core.destroy();
        this.tweens.add({ targets: glowGold, alpha: 0, duration: 600, onComplete: () => glowGold.destroy() });
        for (const o of [prompt, hint, barBack, barDark, barGold]) o.destroy();
        if (won) {
          synth.play("boom");
          Juice.subDrop(1, 2.4);
        }
        resolve();
      };
      this.events.on("update", tick);
    });
  }

  /** Something comes apart into motes of light. */
  private disintegrate(o: Phaser.GameObjects.Image, col: number) {
    const b = o.getBounds();
    this.time.addEvent({
      delay: 25,
      repeat: 110,
      callback: () => {
        const p = this.add.rectangle(b.x + Math.random() * b.width, b.y + Math.random() * b.height, 3 + Math.random() * 5, 3 + Math.random() * 5, col, 1).setDepth(986).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: p, x: p.x + 40 + Math.random() * 120, y: p.y - 80 - Math.random() * 160, alpha: 0, duration: 1400 + Math.random() * 800, onComplete: () => p.destroy() });
      },
    });
  }

  // ---------------------------------------------------------------- helpers

  private wait(ms: number) {
    if (this.dead || this.ended) return never();
    return new Promise<void>((res) => this.time.delayedCall(ms, () => res()));
  }

  private async talk(lines: Line[]) {
    if (this.dead || this.ended) return never();
    await this.box.play(lines, {
      onLine: (l) => {
        if (String(l.s) === FB.CONCEPT) {
          // the deep, distorted voice: the whole screen judders
          this.cameras.main.shake(900, 0.008);
          this.strike(true);
          synth.play("roar");
        }
        if (l.t === FB.FB_NO) this.cameras.main.shake(800, 0.02);
      },
    });
    if (this.dead || this.ended) return never();
  }
}

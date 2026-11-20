import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { backdrop, charMeta } from "../../gfx/HD";
import { playerKey } from "../../gfx/sanmikForm";
import { vfx } from "../../gfx/Vfx";
import { DialogueBox } from "../../ui/DialogueBox";
import { preloadKrelworld3d } from "./krelworld3d";
import { RU_DESPAIR, RU_GF_1, RU_GF_2, RU_MEEK, RU_PORTAL, RU_SMASH, RU_THROW, RU_TWIST, RU_WOW } from "../../../content/realUniverse";

/**
 * THE REAL UNIVERSE (after the epilogue, before the credits).
 * The camera pulls back out of the game: it was on your PC monitor all along. Plot twist card. The girlfriend,
 * offscreen through the bedroom door, screams and throws the kitchen at you. You despair, headbutt the monitor
 * until it breaks open into a portal, and get sucked through to the "computer universe".
 * Everything is built in this scene after a snapshot of the last frame of the game; nothing here is kept.
 */

// the monitor, on the desk at the right of the bedroom backdrop (backdrop is 480x272 drawn at x2)
const MON = { x: 872, y: 214, w: 112, h: 63 };
const FLOOR = 372;

export async function realUniverse(scene: Phaser.Scene): Promise<void> {
  const cam = scene.cameras.main;
  // start fetching the 3D world now: it's needed at the end of this scene
  void preloadKrelworld3d().catch(() => undefined);
  const wait = (ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, () => r()));
  const tween = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => new Promise<void>((r) => scene.tweens.add({ ...cfg, onComplete: () => r() }));

  // ---- freeze the last frame of the game: it goes on the monitor
  const snapKey = "ru_snap";
  await new Promise<void>((res) => {
    scene.game.renderer.snapshot((img) => {
      if (scene.textures.exists(snapKey)) scene.textures.remove(snapKey);
      if (img instanceof HTMLImageElement) {
        const add = () => (scene.textures.addImage(snapKey, img), res());
        if (img.complete) add();
        else img.onload = add;
      } else res();
    });
  });
  synth.stopMusic();
  scene.tweens.killAll();
  scene.time.removeAllEvents();
  scene.children.removeAll(true);
  const box = new DialogueBox(scene, 1000, 0.1);

  // ---- the bedroom
  if (!backdrop(scene, "bg_bedroom_real", { depth: -10, scroll: true })) scene.add.rectangle(480, 270, 960, 540, 0x2a2238).setDepth(-10);
  // the PC: bezel, stand, glowing screen
  scene.add.rectangle(MON.x, MON.y + MON.h / 2 + 16, 16, 26, 0x1f2937).setDepth(2);
  scene.add.rectangle(MON.x, MON.y + MON.h / 2 + 30, 50, 6, 0x111827).setDepth(2);
  scene.add.rectangle(MON.x, MON.y, MON.w + 14, MON.h + 14, 0x0f172a).setStrokeStyle(2, 0x334155).setDepth(3);
  const glow = scene.add.rectangle(MON.x, MON.y, MON.w + 60, MON.h + 60, 0x7dd3fc, 0.12).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
  const screen = scene.textures.exists(snapKey)
    ? scene.add.image(MON.x, MON.y, snapKey).setDisplaySize(MON.w, MON.h).setDepth(4)
    : scene.add.rectangle(MON.x, MON.y, MON.w, MON.h, 0x1e3a8a).setDepth(4);
  const cracks = scene.add.graphics().setDepth(5);

  // you, in the gaming chair, facing the screen
  const key = playerKey(scene);
  const me = scene.add.sprite(752, FLOOR, key, 0).setOrigin(0.5, 1).setDepth(10);
  me.setScale(1);
  const base = 150 / me.frame.height / me.scaleX;
  me.setScale(base);
  const face = (f: "south" | "east" | "north" | "west") => {
    const m = charMeta(scene, me.texture.key);
    if (!m) return void me.setFlipX(f === "west");
    me.setFlipX(false);
    me.setFrame(m.idle[f] ?? 0);
  };
  face("east");

  // ---- the zoom out: start with the screen filling the view, pull back to the room
  const z0 = 960 / MON.w;
  cam.setZoom(z0).centerOn(MON.x, MON.y);
  await wait(900);
  const p = { t: 0 };
  await tween({
    targets: p, t: 1, duration: 3200, ease: "Sine.inOut",
    onUpdate: () => {
      cam.setZoom(Math.pow(z0, 1 - p.t));
      cam.centerOn(Phaser.Math.Linear(MON.x, 480, p.t), Phaser.Math.Linear(MON.y, 270, p.t));
    },
  });
  cam.setZoom(1).centerOn(480, 270);
  scene.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 900 });
  await wait(500);
  await box.play(RU_WOW);

  // ---- PLOT TWIST
  synth.play("twist_sting");
  cam.flash(250, 255, 255, 255);
  cam.shake(700, 0.012);
  const band = scene.add.rectangle(480, 250, 960, 210, 0x000000, 0.85).setDepth(950).setScrollFactor(0);
  const twist = scene.add.text(480, 250, RU_TWIST, { fontFamily: "Impact, sans-serif", fontSize: "38px", color: "#ff2d2d", stroke: "#000000", strokeThickness: 8, align: "center", lineSpacing: 6 }).setOrigin(0.5).setDepth(951).setScrollFactor(0);
  twist.setScale(3).setAlpha(0);
  scene.tweens.add({ targets: twist, scale: 1, alpha: 1, duration: 260, ease: "Back.out" });
  const flick = scene.time.addEvent({ delay: 140, loop: true, callback: () => twist.setColor(twist.style.color === "#ff2d2d" ? "#ffd23f" : "#ff2d2d") });
  await wait(4600);
  flick.remove();
  await tween({ targets: [twist, band], alpha: 0, duration: 500 });
  twist.destroy();
  band.destroy();

  // ---- the girlfriend, through the door (never seen)
  const doorShout = () => {
    cam.shake(260, 0.01);
    const t = scene.add.text(70 + Math.random() * 40, 150 + Math.random() * 80, Phaser.Utils.Array.GetRandom(["!!!", "!!!!", "?!!", "!?!"]), { fontFamily: "Impact, sans-serif", fontSize: "40px", color: "#ff2d2d", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(60);
    scene.tweens.add({ targets: t, scale: { from: 0.4, to: 1.4 }, alpha: { from: 1, to: 0 }, duration: 700, onComplete: () => t.destroy() });
    // you flinch
    scene.tweens.add({ targets: me, x: me.x + 6, yoyo: true, repeat: 3, duration: 40 });
  };
  const onSpeaker = (sp: string) => {
    if (sp === "GIRLFRIEND") {
      face("west");
      doorShout();
    } else face("east");
  };
  synth.play("door");
  await box.play(RU_GF_1, { onSpeaker });
  await box.play(RU_MEEK, { onSpeaker });
  await box.play(RU_GF_2, { onSpeaker });

  // ---- she throws the kitchen at you
  face("west");
  let throwing = true;
  let thrown = 0;
  const shards = (x: number, y: number, col: number) => {
    for (let i = 0; i < 9; i++) {
      const s = scene.add.rectangle(x, y, 3 + Math.random() * 5, 3 + Math.random() * 4, col).setDepth(40).setAngle(Math.random() * 90);
      const a = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 70;
      scene.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 + 40, angle: s.angle + 360, alpha: 0, duration: 650 + Math.random() * 300, ease: "Quad.out", onComplete: () => s.destroy() });
    }
  };
  const throwOne = () => {
    const fr = Math.floor(Math.random() * 12);
    const o = scene.add.sprite(-30, 170 + Math.random() * 140, "ru_throw", fr).setScale(2.4).setDepth(40);
    const tx = 600 + Math.random() * 330;
    const ty = 130 + Math.random() * 220;
    const sx = o.x;
    const sy = o.y;
    const cy = Math.min(sy, ty) - 120 - Math.random() * 80;
    const k = { t: 0 };
    scene.tweens.add({
      targets: k, t: 1, duration: 520 + Math.random() * 260, ease: "Linear",
      onUpdate: () => {
        const t = k.t;
        o.x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * ((sx + tx) / 2) + t * t * tx;
        o.y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ty;
        o.angle += 18;
      },
      onComplete: () => {
        synth.play("plate_smash");
        shards(o.x, o.y, fr <= 2 || fr === 11 ? 0xf1f5f9 : fr === 3 ? 0xb91c1c : fr === 4 ? 0x1d4ed8 : fr === 7 ? 0x7dd3fc : 0x9ca3af);
        if (Phaser.Math.Distance.Between(o.x, o.y, me.x, me.y - 80) < 90) {
          me.setTint(0xff8888);
          scene.time.delayedCall(140, () => me.clearTint());
          scene.tweens.add({ targets: me, x: me.x + 10, yoyo: true, duration: 70 });
        }
        cam.shake(120, 0.004);
        o.destroy();
      },
    });
    thrown++;
  };
  const thrower = scene.time.addEvent({ delay: 230, loop: true, callback: () => throwing && throwOne() });
  const minThrows = wait(5200);
  await box.play(RU_THROW);
  await minThrows;
  throwing = false;
  thrower.remove();
  await wait(900);

  // ---- head in hands
  face("south");
  const sob = scene.tweens.add({ targets: me, y: FLOOR + 3, yoyo: true, repeat: -1, duration: 260 });
  const tears = scene.time.addEvent({ delay: 170, loop: true, callback: () => {
    const t = scene.add.circle(me.x + (Math.random() < 0.5 ? -10 : 10), me.y - 118, 3, 0x60a5fa).setDepth(12);
    scene.tweens.add({ targets: t, x: t.x + (t.x < me.x ? -16 : 16), y: t.y + 50, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  } });
  await box.play(RU_DESPAIR);
  sob.remove();
  tears.remove();
  me.y = FLOOR;

  // ---- ARGHHH FUCK FUCK FUCK: headbutting the monitor
  face("east");
  const meX = me.x;
  let hits = 0;
  let shouting = true;
  const crackAt = (x: number, y: number) => {
    cracks.lineStyle(2, 0xffffff, 0.9);
    for (let i = 0; i < 5; i++) {
      let px = x;
      let py = y;
      const a = Math.random() * Math.PI * 2;
      cracks.beginPath();
      cracks.moveTo(px, py);
      for (let s = 0; s < 4; s++) {
        px = Phaser.Math.Clamp(px + Math.cos(a + (Math.random() - 0.5)) * 12, MON.x - MON.w / 2, MON.x + MON.w / 2);
        py = Phaser.Math.Clamp(py + Math.sin(a + (Math.random() - 0.5)) * 10, MON.y - MON.h / 2, MON.y + MON.h / 2);
        cracks.lineTo(px, py);
      }
      cracks.strokePath();
    }
  };
  const smashLoop = (async () => {
    while (shouting || hits < 7) {
      await tween({ targets: me, x: meX + 70, angle: 14, duration: 110, ease: "Quad.in" });
      hits++;
      synth.play(hits % 2 ? "monitor_crack" : "punch_big");
      cam.shake(200, 0.014);
      crackAt(MON.x - MON.w / 2 + 10 + Math.random() * 40, MON.y - 10 + Math.random() * 25);
      screen.setAlpha(0.4 + Math.random() * 0.6);
      if (G.meta.settings.gore !== false && hits > 3 && hits % 2) vfx(scene, "vfx_blood", meX + 90, me.y - 125, { scale: 0.8, depth: 30 });
      await tween({ targets: me, x: meX, angle: 0, duration: 200, ease: "Quad.out" });
      await wait(120);
    }
  })();
  await box.play(RU_SMASH);
  shouting = false;
  await smashLoop;

  // ---- it opens
  synth.play("portal_open");
  cam.flash(300, 255, 255, 255);
  screen.destroy();
  cracks.clear();
  const portal = scene.add.graphics().setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
  const pState = { r: 10, spin: 0, cx: MON.x, cy: MON.y };
  const drawPortal = () => {
    portal.clear();
    pState.spin += 0.09;
    for (let i = 14; i >= 0; i--) {
      const rr = pState.r * (i / 14);
      const hue = (i / 14 + pState.spin * 0.25) % 1;
      const c = Phaser.Display.Color.HSVToRGB(hue, 1, 1) as Phaser.Types.Display.ColorObject;
      portal.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 0.18);
      portal.fillEllipse(pState.cx + Math.sin(pState.spin + i) * 3, pState.cy, rr * 2, rr * 1.6);
    }
    // spiral arms
    for (let a = 0; a < 6; a++) {
      const ang = pState.spin * 2 + (a * Math.PI) / 3;
      const c = Phaser.Display.Color.HSVToRGB((a / 6 + pState.spin * 0.3) % 1, 1, 1) as Phaser.Types.Display.ColorObject;
      portal.lineStyle(4, Phaser.Display.Color.GetColor(c.r, c.g, c.b), 0.7);
      portal.beginPath();
      for (let s = 0; s <= 12; s++) {
        const rr = (pState.r * s) / 12;
        const aa = ang + s * 0.35;
        const px = pState.cx + Math.cos(aa) * rr;
        const py = pState.cy + Math.sin(aa) * rr * 0.8;
        if (s === 0) portal.moveTo(px, py);
        else portal.lineTo(px, py);
      }
      portal.strokePath();
    }
  };
  const sparkle = scene.time.addEvent({ delay: 40, loop: true, callback: () => {
    const a = Math.random() * Math.PI * 2;
    const d = pState.r * (0.8 + Math.random() * 0.8);
    const c = Phaser.Display.Color.HSVToRGB(Math.random(), 0.8, 1) as Phaser.Types.Display.ColorObject;
    const s = scene.add.circle(pState.cx + Math.cos(a) * d, pState.cy + Math.sin(a) * d * 0.8, 2 + Math.random() * 3, Phaser.Display.Color.GetColor(c.r, c.g, c.b)).setDepth(21).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: s, x: pState.cx, y: pState.cy, alpha: 0, duration: 500, onComplete: () => s.destroy() });
  } });
  scene.events.on("update", drawPortal);
  // it bursts out of the screen and hangs in the room
  await tween({ targets: pState, r: 170, cx: 690, cy: 236, duration: 1800, ease: "Cubic.out" });
  cam.shake(1800, 0.006);
  await box.play(RU_PORTAL);

  // ---- sucked in
  const shrink = { k: 1 };
  await tween({
    targets: shrink, k: 0.05, duration: 1400, ease: "Cubic.in",
    onUpdate: () => {
      me.setScale(base * shrink.k);
      me.x = Phaser.Math.Linear(pState.cx, meX, shrink.k);
      me.y = Phaser.Math.Linear(pState.cy + 40, FLOOR, shrink.k);
      me.angle += 22;
    },
  });
  me.setVisible(false);
  await tween({ targets: pState, r: 900, duration: 700, ease: "Cubic.in" });
  scene.events.off("update", drawPortal);
  sparkle.remove();

  // ---- through the wormhole
  synth.play("portal_travel");
  scene.children.removeAll(true);
  cam.setZoom(1).centerOn(480, 270);
  scene.add.rectangle(480, 270, 960, 540, 0x000000).setDepth(0);
  const tunnel = scene.time.addEvent({ delay: 90, loop: true, callback: () => {
    const c = Phaser.Display.Color.HSVToRGB(Math.random(), 1, 1) as Phaser.Types.Display.ColorObject;
    const col = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    const ring = scene.add.ellipse(480, 270, 40, 26).setStrokeStyle(5, col).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: 30, alpha: 0, duration: 1300, ease: "Quad.in", onComplete: () => ring.destroy() });
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const streak = scene.add.rectangle(480 + Math.cos(a) * 20, 270 + Math.sin(a) * 20, 30, 2, col).setRotation(a).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: streak, x: 480 + Math.cos(a) * 700, y: 270 + Math.sin(a) * 700, scaleX: 6, alpha: 0, duration: 600, ease: "Quad.in", onComplete: () => streak.destroy() });
    }
  } });
  // you, tumbling down the middle of it
  const tumbler = scene.add.sprite(480, 270, key, 0).setDepth(5);
  tumbler.setScale(base * 0.5);
  const tumble = scene.tweens.add({ targets: tumbler, angle: 360, duration: 700, repeat: -1 });
  const wobble = { a: 0 };
  scene.tweens.add({ targets: wobble, a: 1, duration: 5600, onUpdate: () => cam.setRotation(Math.sin(wobble.a * 18) * 0.25 * wobble.a) });
  const flashes = scene.time.addEvent({ delay: 650, loop: true, callback: () => {
    const c = Phaser.Display.Color.HSVToRGB(Math.random(), 1, 1) as Phaser.Types.Display.ColorObject;
    cam.flash(160, c.r, c.g, c.b);
  } });
  await wait(5600);
  tunnel.remove();
  flashes.remove();
  tumble.remove();
  cam.setRotation(0);
  // white out: the 3D epilogue (krelworld3d.ts) fades in from white
  cam.fadeOut(700, 255, 255, 255);
  await wait(720);
  void thrown;
}

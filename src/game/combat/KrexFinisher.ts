import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { FONT } from "../ui/theme";
import { hasVfx, vfx } from "../gfx/Vfx";
import { G } from "../G";
import { Actor } from "./KrelArt";
import type { Line } from "../../data/types";
import { dir, say } from "../../content/dsl";

/**
 * METAL GEAR KREX's own Kreltality. He's forty tonnes of nuclear walking tank, and you take him apart with your hands:
 * the cockpit comes off like a bottle cap, you reach in and yank the reactor out, he gets as far as "ONE… LAST…
 * PUSSY… JU—" and you stamp on him, then you post the reactor back in and walk away from the explosion.
 *
 * Machine oil instead of blood (gore off: steam and sparks, no oil). calmFlash: no white-outs, a slow dim glow instead.
 * It draws its own copies of the rig (KrexBoss.rig()); the scene hides the real ones while it plays.
 */

export interface KrexRigPart {
  id: string;
  key: string;
  frame: string | number;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  depth: number;
}

/** The finisher's names (gore on / off), for the banner and the cine title. */
export const KREX_FINISHER = { gore: "DECOMMISSIONED!", tame: "UNPLUGGED!" };

const D = 2000;
const SRC = 128;

/** The reactor core, drawn once: a glowing green canister on its snapped cables. */
function reactorTexture(sc: Phaser.Scene): string {
  const key = "krex_reactor";
  if (sc.textures.exists(key)) return key;
  const t = sc.textures.createCanvas(key, 28, 40)!;
  const c = t.getContext();
  c.fillStyle = "#111";
  c.fillRect(5, 3, 18, 34);
  c.fillStyle = "#3f3f46";
  c.fillRect(6, 4, 16, 5);
  c.fillRect(6, 31, 16, 5);
  c.fillStyle = "#16a34a";
  c.fillRect(7, 9, 14, 22);
  c.fillStyle = "#86efac";
  c.fillRect(9, 10, 4, 20);
  c.fillStyle = "#facc15";
  c.fillRect(12, 17, 4, 4);
  c.fillStyle = "#a855f7"; // the cables
  c.fillRect(2, 36, 3, 4);
  c.fillRect(13, 37, 2, 3);
  c.fillRect(22, 35, 3, 5);
  c.fillStyle = "#a1a1aa";
  c.fillRect(8, 5, 2, 2);
  c.fillRect(18, 5, 2, 2);
  c.fillRect(8, 33, 2, 2);
  c.fillRect(18, 33, 2, 2);
  t.refresh();
  return key;
}

/**
 * Play it. `rig` is the hull first, then the bits still on; `player` is your sprite's look; `px` is where you are,
 * `groundY` the floor. Resolves when it's over and the room is back (Krex in bits, you stood there).
 */
export async function krexKreltality(
  sc: Phaser.Scene,
  rig: KrexRigPart[],
  player: { key: string; frame: string | number; scale: number },
  groundY: number,
): Promise<void> {
  const cam = sc.cameras.main;
  const gore = G.meta?.settings?.gore !== false;
  const calm = !!G.meta?.settings?.calmFlash;
  const junk: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    junk.push(o);
    return o;
  };
  const wait = (ms: number) => new Promise<void>((r) => sc.time.delayedCall(ms, () => r()));
  const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => new Promise<void>((r) => sc.tweens.add({ ...cfg, onComplete: () => r() }));
  const evs: Phaser.Time.TimerEvent[] = [];
  const flash = (ms: number, r: number, g: number, b: number) => {
    if (!calm) {
      cam.flash(ms, r, g, b);
      return;
    }
    // calm: a slow, dim glow over the screen, no white-out
    const o = keep(sc.add.rectangle(480, 270, 4000, 4000, Phaser.Display.Color.GetColor(r, g, b), 0).setScrollFactor(0).setDepth(D + 40));
    sc.tweens.add({ targets: o, fillAlpha: 0.25, yoyo: true, duration: Math.max(400, ms) });
  };

  const hull = rig.find((p) => p.id === "hull") ?? rig[0];
  const flip = hull.flip;
  const face = flip ? -1 : 1; // the way he's facing (the cockpit's side)
  const k = hull.scale;
  /** A point on the 128px picture, in the world (mirrored when he faces left). */
  const at = (px: number, py: number): [number, number] => [hull.x + (px - SRC / 2) * k * face, hull.y + (py - SRC / 2) * k];
  const gy = groundY;

  // ---- the stage: the room goes dark, the camera comes in
  const sky = keep(sc.add.rectangle(hull.x, hull.y, 6000, 6000, 0x12001a, 0).setDepth(D));
  sc.tweens.add({ targets: sky, fillAlpha: 0.88, duration: 400 });
  const [hx, hy] = at(90, 52);
  cam.stopFollow();
  cam.pan(hx - face * 30, hy + 10, 600, "Sine.easeInOut");
  cam.zoomTo(1.45, 600);
  synth.play("boom");
  const z = () => 1 / cam.zoom;

  // ---- the copies of him
  const imgs = new Map<string, Phaser.GameObjects.Image>();
  for (const p of rig) {
    const im = keep(sc.add.image(p.x, p.y, p.key, p.frame).setScale(p.scale).setFlipX(p.flip).setDepth(D + 2 + (p.id === "hull" ? 0 : p.id === "legb" || p.id === "tail" ? -1 : 1)));
    imgs.set(p.id, im);
  }
  const body = imgs.get("hull")!;
  // the head: the real cockpit if it's still on, else a cut of the hull's front (nothing's ever missing)
  const head = imgs.get("head") ?? null;

  // ---- effects
  const sparks = (x: number, y: number, s = 1) => {
    if (hasVfx(sc, "vfx_sparks")) {
      const v = vfx(sc, "vfx_sparks", x, y, { scale: 1.2 * s, depth: D + 8, add: true });
      if (v) junk.push(v);
    } else
      for (let i = 0; i < 6; i++) {
        const r = keep(sc.add.rectangle(x, y, 3, 3, i % 2 ? 0xfde047 : 0xffffff).setDepth(D + 8));
        sc.tweens.add({ targets: r, x: x + (Math.random() - 0.5) * 80 * s, y: y + (Math.random() - 0.6) * 70 * s, alpha: 0, duration: 380 });
      }
  };
  const puff = (x: number, y: number, s: number, tint = 0x9ca3af) => {
    const v = hasVfx(sc, "vfx_smoke") ? vfx(sc, "vfx_smoke", x, y, { scale: s, depth: D + 7, tint }) : null;
    if (v) {
      junk.push(v);
      return;
    }
    const c = keep(sc.add.circle(x, y, 10 * s, tint, 0.6).setDepth(D + 7));
    sc.tweens.add({ targets: c, y: y - 40, radius: 26 * s, alpha: 0, duration: 900 });
  };
  /** Machine oil: black-purple gobs that arc and pool on the floor. Gore off: a hiss of steam instead. */
  let pools = 0;
  const oil = (x: number, y: number, n: number, up = true) => {
    if (!gore) {
      puff(x, y, 0.6 + n / 40, 0xe5e7eb);
      return;
    }
    if (n >= 10) synth.play(Math.random() < 0.5 ? "splat" : "squelch", 0.7);
    for (let i = 0; i < n; i++) {
      const s = 2 + Math.random() * 5;
      const r = keep(sc.add.rectangle(x, y, s, s, [0x0c0a09, 0x1c1917, 0x3b0764, 0x0f172a][i % 4]).setDepth(D + 6));
      let vx = (Math.random() - 0.5) * 9;
      let vy = up ? -(4 + Math.random() * 9) : (Math.random() - 0.6) * 7;
      const ev = sc.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          vy += 0.45;
          r.x += vx;
          r.y += vy;
          vx *= 0.99;
          if (r.y >= gy - 4) {
            ev.remove();
            if (pools < 40) {
              pools++;
              // an oily puddle with a rainbow sheen
              keep(sc.add.ellipse(r.x, gy - 2 + Math.random() * 4, 8 + Math.random() * 18, 3 + Math.random() * 3, 0x0c0a09, 0.95).setDepth(D + 1));
              if (Math.random() < 0.3) keep(sc.add.ellipse(r.x + 2, gy - 2, 6, 1.5, 0xa855f7, 0.6).setDepth(D + 1));
            }
            r.destroy();
          }
        },
      });
      evs.push(ev);
    }
  };
  /** Bolts and armour plates, flung off. */
  const scrap = (x: number, y: number, n: number, power = 1) => {
    synth.play(Math.random() < 0.5 ? "plate_smash" : "smash", 0.7);
    for (let i = 0; i < n; i++) {
      const bolt = i % 3 === 0;
      const s = bolt ? 4 : Phaser.Math.Between(7, 16);
      const o = bolt
        ? keep(sc.add.circle(x, y, 2.5, 0xd4d4d8).setStrokeStyle(1, 0x111111).setDepth(D + 7))
        : keep(sc.add.rectangle(x, y, s, s * (0.4 + Math.random() * 0.6), [0x4b4f58, 0x3f3f46, 0x6b21a8, 0x52525b][i % 4]).setStrokeStyle(1, 0x111111).setDepth(D + 7));
      const vx = (Math.random() - 0.5) * 460 * power;
      sc.tweens.add({ targets: o, x: x + vx, angle: Phaser.Math.Between(-600, 600), duration: 1000, ease: "Quad.out" });
      sc.tweens.add({
        targets: o,
        y: y - Phaser.Math.Between(50, 170) * power,
        duration: 360,
        ease: "Quad.out",
        onComplete: () => sc.tweens.add({ targets: o, y: gy - 3, duration: 560, ease: "Bounce.out" }),
      });
    }
  };
  const boom = (x: number, y: number, s: number) => {
    const big = s >= 1.3 && hasVfx(sc, "vfx_bigboom");
    const v = hasVfx(sc, big ? "vfx_bigboom" : "vfx_boom") ? vfx(sc, big ? "vfx_bigboom" : "vfx_boom", x, y, { scale: big ? s : s * 1.2, depth: D + 9 }) : null;
    if (v) junk.push(v);
    else {
      const c = keep(sc.add.circle(x, y, 20 * s, 0xf97316, 0.9).setDepth(D + 9));
      sc.tweens.add({ targets: c, radius: 60 * s, alpha: 0, duration: 400 });
    }
  };
  const label = (t: string, col = "#fde047") => {
    const x = keep(sc.add.text(hull.x, hull.y - body.displayHeight * 0.42, t, { fontFamily: "Impact, sans-serif", fontSize: "34px", color: col, stroke: "#000", strokeThickness: 7 }).setOrigin(0.5).setDepth(D + 10).setScale(0.3 * z()));
    sc.tweens.add({ targets: x, scale: z(), duration: 250, ease: "Back.out" });
    sc.tweens.add({ targets: x, alpha: 0, delay: 1500, duration: 300 });
    return x;
  };
  /** Krex talks: pink capitals over wherever his cockpit is. */
  const say = (x: number, y: number, t: string) =>
    keep(sc.add.text(x, y, t, { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ff6b9d", stroke: "#000", strokeThickness: 5, align: "center" }).setOrigin(0.5, 1).setDepth(D + 11).setScale(z()));
  const sfx = (t: string, x: number, y: number) => {
    const o = keep(sc.add.text(x, y, t, { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffffff", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(D + 10).setScale(z()).setAngle(Phaser.Math.Between(-12, 12)));
    sc.tweens.add({ targets: o, y: y - 24, alpha: 0, delay: 700, duration: 500 });
  };

  // he's down and sparking all over
  const fizz = sc.time.addEvent({
    delay: 240,
    loop: true,
    callback: () => {
      if (!body.active) return;
      const [x, y] = at(30 + Math.random() * 80, 30 + Math.random() * 60);
      if (Math.random() < 0.65) sparks(x, y, 0.8);
      else puff(x, y, 0.5, 0x555555);
    },
  });
  evs.push(fizz);
  sc.tweens.add({ targets: [...imgs.values()], angle: { from: -1.5, to: 1.5 }, yoyo: true, repeat: -1, duration: 90 });

  // ---- you, walking up to the cockpit's side
  const pScale = player.scale;
  const me = keep(sc.add.sprite(hx + face * 260, gy, player.key, player.frame).setScale(pScale).setDepth(D + 4));
  me.setY(gy - me.displayHeight * 0.42);
  const act = new Actor(sc, me).idle(face > 0 ? -1 : 1);
  await wait(500);
  let line = say(hx, hy - 60, "SYSTEMS… CRITICAL.\nHOSTILE APPROACHING.");
  act.walk();
  await tw({ targets: me, x: hx + face * 70, duration: 900, ease: "Quad.out" });
  act.idle(face > 0 ? -1 : 1);
  line.destroy();
  line = say(hx, hy - 60, "WAIT. WHAT ARE YOU DOING\nWITH YOUR HANDS.");
  await wait(1100);
  line.destroy();

  // ---- 1. the cockpit, off like a bottle cap
  sc.tweens.killTweensOf([...imgs.values()]);
  for (const im of imgs.values()) im.setAngle(0);
  void act.play("pull", { hold: true, frames: [0, 4], fps: 7 });
  synth.play("drp_creak");
  sfx("*CREEEEAK*", hx, hy - 50);
  // the lid turns about its own middle, not the middle of the whole picture it's drawn on
  if (head) {
    const [cx0, cy0] = at(103, 49);
    head.setOrigin(flip ? 1 - 103 / SRC : 103 / SRC, 49 / SRC).setPosition(cx0, cy0);
  }
  const capT = head ?? body;
  const capBase = capT.angle;
  // the lid strains on its bolts
  await tw({ targets: capT, angle: capBase - face * 8, yoyo: true, repeat: 3, duration: 140, ease: "Sine.inOut" });
  for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 120, () => scrap(hx, hy, 2, 0.6));
  await wait(150);
  // POP
  synth.play("pop");
  synth.play("punch_big");
  flash(140, 255, 240, 200);
  cam.shake(260, 0.02);
  label("BOTTLE-CAPPED!");
  sfx("*PSSSHHT!*", hx, hy - 30);
  void act.play("pull", { frames: [4, 8], fps: 10, hold: true });
  // where the lid lands: at your feet, upside down
  const capX = me.x + face * 70;
  if (head) {
    sc.tweens.add({ targets: head, angle: face * 720, duration: 1100, ease: "Quad.out" });
    sc.tweens.add({ targets: head, x: capX, duration: 1100, ease: "Quad.out" });
    sc.tweens.add({
      targets: head,
      y: { from: head.y, to: head.y - 260 },
      duration: 480,
      ease: "Quad.out",
      onComplete: () =>
        sc.tweens.add({
          targets: head,
          y: gy - 14 * k,
          duration: 620,
          ease: "Bounce.out",
          onComplete: () => synth.play("smash"),
        }),
    });
  }
  // the neck gushes: oil (or steam) straight up
  const gush = sc.time.addEvent({ delay: 90, repeat: 18, callback: () => oil(hx, hy - 6, gore ? 6 : 3) });
  evs.push(gush);
  synth.play(gore ? "tap_gush" : "pfft");
  sparks(hx, hy, 1.4);
  scrap(hx, hy, 8, 1);
  await wait(1300);
  act.idle(face > 0 ? -1 : 1);

  // ---- 2. you reach in, elbow-deep, and yank the reactor out
  const [rx, ry] = at(64, 58);
  await tw({ targets: me, x: rx + face * 70, duration: 250 });
  sfx("*RUMMAGE*", rx, ry - 40);
  void act.play("rip", { frames: [0, 4], fps: 6, hold: true });
  for (let i = 0; i < 6; i++)
    sc.time.delayedCall(i * 140, () => {
      sparks(rx + (Math.random() - 0.5) * 50, ry + (Math.random() - 0.5) * 30, 1);
      synth.play("zap", 0.5);
    });
  await wait(900);
  synth.play("flesh_rip", gore ? 1 : 0.4);
  synth.play("plate_smash");
  cam.shake(300, 0.024);
  flash(160, 180, 255, 180);
  void act.play("rip", { frames: [4, 8], fps: 10, hold: true });
  const core = keep(sc.add.image(rx, ry, reactorTexture(sc)).setScale(2.2).setDepth(D + 5));
  const glow = keep(sc.add.circle(rx, ry, 30, 0x22c55e, 0.35).setDepth(D + 4).setBlendMode(Phaser.BlendModes.ADD));
  sc.tweens.add({ targets: glow, scale: { from: 0.8, to: 1.4 }, yoyo: true, repeat: -1, duration: 260 });
  // up and out, over your head, cables snapping
  const holdX = me.x;
  const holdY = me.y - me.displayHeight * 0.55;
  sc.tweens.add({ targets: [core, glow], x: holdX, y: holdY, duration: 450, ease: "Back.out" });
  scrap(rx, ry, 12, 1.2);
  oil(rx, ry, gore ? 28 : 6);
  sparks(rx, ry, 1.6);
  label("REACTOR: YANKED!", "#86efac");
  // the lights go out in him
  body.setTint(0x6b6b6b);
  for (const [id, im] of imgs) if (id !== "head") im.setTint(0x6b6b6b);
  synth.play("flatline", 0.6);
  await wait(1300);

  // ---- 3. last words, from the lid on the floor
  const lidX = head ? head.x : capX;
  const lidY = head ? head.y : gy - 14 * k;
  let visor: Phaser.GameObjects.Rectangle | null = null;
  if (head) {
    visor = keep(sc.add.rectangle(lidX, lidY + 3 * k, 12 * k, 2 * k, 0xff2a8a, 0.9).setDepth(D + 6).setBlendMode(Phaser.BlendModes.ADD));
    sc.tweens.add({ targets: visor, alpha: { from: 0.2, to: 1 }, yoyo: true, repeat: -1, duration: 120 });
  }
  const words = "ONE… LAST… PUSSY… JU—";
  line = say(lidX, lidY - 34, "");
  for (let i = 1; i <= words.length; i++) {
    line.setText(words.slice(0, i));
    if (words[i - 1] !== " ") synth.play("monbeep", 0.35);
    await wait(words[i - 1] === "…" ? 380 : 70);
  }
  // you stamp on him mid-word
  act.idle(face > 0 ? 1 : -1);
  sc.tweens.add({ targets: me, x: lidX - face * 26, duration: 180 });
  void act.play("stomp", { fps: 14 });
  await wait(330);
  synth.play("punch_big");
  synth.play("monitor_crack");
  cam.shake(240, 0.025);
  line.destroy();
  if (head) sc.tweens.add({ targets: head, scaleY: head.scaleY * 0.35, y: gy - 5 * k, duration: 90 });
  if (visor) {
    sc.tweens.killTweensOf(visor);
    visor.destroy();
  }
  oil(lidX, gy - 12, gore ? 22 : 4, true);
  scrap(lidX, gy - 14, 6, 0.8);
  sfx("*CRUNCH*", lidX, gy - 70);
  await wait(900);

  // ---- 4. return to sender: the reactor goes back in, the wrong way round, and you walk off
  act.idle(face > 0 ? -1 : 1);
  sc.tweens.add({ targets: me, x: hx + face * 110, duration: 200 });
  void act.play("slam", { fps: 12 });
  await wait(260);
  synth.play("swing");
  const [cx, cy] = at(58, 62);
  sc.tweens.add({ targets: [core, glow], x: cx, duration: 520, ease: "Linear" });
  sc.tweens.add({ targets: [core, glow], y: { from: core.y, to: cy - 120 }, duration: 260, ease: "Quad.out", yoyo: true });
  sc.tweens.add({ targets: core, angle: 540, duration: 520 });
  await wait(540);
  core.setVisible(false);
  glow.setVisible(false);
  synth.play("alarm");
  line = say(hx, hy - 60, "REACTOR… INSERTED…\n…THANK YOU.");
  // you walk away. You don't look back.
  act.idle(face > 0 ? 1 : -1);
  act.walk();
  sc.tweens.add({ targets: me, x: me.x + face * 230, duration: 1500, ease: "Sine.in" });
  for (let i = 0; i < 10; i++) {
    sc.time.delayedCall(250 + i * 150, () => {
      const [x, y] = at(Phaser.Math.Between(24, 112), Phaser.Math.Between(24, 108));
      synth.play(i % 3 === 0 ? "boom" : "explode", 0.8);
      boom(x, y, 0.8 + Math.random() * 0.5);
      cam.shake(140, 0.014 + i * 0.001);
      if (i % 2 === 0) scrap(x, y, 5, 1);
      if (i % 3 === 1) oil(x, y, gore ? 10 : 2);
      const col = i % 2 ? 0xffffff : 0xff6a00;
      if (!calm) for (const im of imgs.values()) if (im !== head && im.active) im.setTintFill(col);
    });
  }
  await wait(1900);
  line.destroy();
  act.idle(face > 0 ? 1 : -1);
  // the big one
  synth.play("boom");
  synth.play("explode");
  boom(hull.x, hull.y, 2.4);
  if (hasVfx(sc, "vfx_blastsmoke")) {
    const v = vfx(sc, "vfx_blastsmoke", hull.x, gy, { scale: 2.2, depth: D + 9 });
    if (v) junk.push(v);
  }
  flash(calm ? 900 : 500, 255, 255, 255);
  cam.shake(800, 0.035);
  scrap(hull.x, hull.y, 24, 1.6);
  for (const im of imgs.values()) if (im !== head) sc.tweens.add({ targets: im, alpha: 0, scale: im.scale * 1.15, duration: 300 });
  await wait(900);

  // ---- KRELTALITY
  if (me.active) act.cheer();
  const kz = z();
  const big = keep(sc.add.text(480, 270 - 130 * kz, "KRELTALITY", { fontFamily: "Impact, sans-serif", fontSize: "84px", color: gore ? "#dc2626" : "#fde047", stroke: "#000", strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 60).setScale(2 * kz).setAlpha(0));
  sc.tweens.add({ targets: big, scale: kz, alpha: 1, duration: 300, ease: "Quad.out" });
  synth.play("boom");
  cam.shake(300, 0.02);
  // oil drips off the letters (gore on)
  for (let i = 0; i < 14 && gore; i++) {
    const x = 480 + (i - 6.5) * 34 * kz;
    const d = keep(sc.add.rectangle(x, 270 - 95 * kz, 5 * kz, 4 * kz, 0x0c0a09).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D + 59));
    sc.tweens.add({ targets: d, scaleY: 8 + Math.random() * 16, delay: 300 + Math.random() * 600, duration: 1200 + Math.random() * 800 });
  }
  keep(sc.add.text(480, 270 - 75 * kz, gore ? KREX_FINISHER.gore : KREX_FINISHER.tame, { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#fde047", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 60).setScale(kz));
  keep(sc.add.text(480, 270 - 45 * kz, "METAL GEAR KREX HAS BEEN KRELTALISED (BY HAND)", { fontFamily: FONT, fontSize: "16px", color: "#fca5a5", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 60).setScale(kz));
  await wait(2800);

  // ---- back to the room
  for (const e of evs) e.remove();
  for (const o of junk) {
    if (!o.active) continue;
    sc.tweens.killTweensOf(o);
    o.destroy();
  }
  cam.zoomTo(1, 400);
  await wait(400);
}

/** What's said after the Kreltality (in place of BOSS_TEXT.krex.outro, which has him blowing himself up). */
export const KREX_KREL_OUTRO: Line[] = [
  dir("What's left of METAL GEAR KREX is in about four hundred pieces, most of them on fire. The cockpit lid lies flat at your feet like a beer mat. Stuck to the glass: a sticky note. 'LIBIDO.EXE: DO NOT RUN.'"),
  say("YOU", "Forty tonnes. Bare hands. Not even a bit sweaty."),
  say("DRONGUS", "(over the tannoy) You took the lid off it like a BOTTLE OF FANTA. That cost me eleven generations. ELEVEN."),
];

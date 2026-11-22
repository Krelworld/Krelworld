import Phaser from "phaser";
import type { Line } from "../../data/types";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { voice } from "../audio/Voice";
import { FONT } from "../ui/theme";
import * as Juice from "./Juice";
import { addCensorBar } from "./Censor";
import { addWrist } from "./Wrist";
import { PRESSER_BLESSED, PRESSER_CHEERS, PRESSER_CLOSE, PRESSER_OPEN, PRESSER_WONK } from "../../content/takeon";

/**
 * KREDDLE TV, LIVE: President Klerble's victory press conference after the lads are fired home (Chapter 3,
 * content/takeon.ts). Drawn in screen space over whatever scene calls it (the Hub, over the heap by the bridge).
 *
 * Nothing is ever shown: the act happens side-on under a black CENSORED bar (the game's usual bar and stand-in wrist,
 * gfx/Censor.ts + gfx/Wrist.ts), with his body shaking, moans and a wall of press flashes; the krez itself is a
 * SPLOOSH!! comic burst over the bar, then a TECHNICAL DIFFICULTIES card. No fluids. The crowd are grown-ups (press pack and Kreddle sycophants). Flashes respect
 * calmFlash. `talk` plays dialogue with the scene still running underneath (a live dialogue).
 */
export async function klerblePresser(sc: Phaser.Scene, talk: (lines: Line[]) => Promise<void>, depth = 9300): Promise<void> {
  const L = Juice.layer(sc, depth);
  // (everything goes in R: the layer itself is pinned to the screen every frame, R can wobble inside it)
  const R = sc.add.container(0, 0);
  L.add(R);
  const calm = Juice.calm();
  const live = () => !!sc.sys && sc.sys.settings.status < Phaser.Scenes.SHUTDOWN;
  const wait = (ms: number) => new Promise<void>((r) => sc.time.delayedCall(ms, () => r()));
  const timers: Phaser.Time.TimerEvent[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
    R.add(o);
    return o;
  };

  // ---- the room
  add(sc.add.rectangle(480, 270, 960, 540, 0x000000));
  if (sc.textures.exists("tv_kreddle_press")) {
    const bg = add(sc.add.image(480, -230, "tv_kreddle_press").setOrigin(0.5, 0));
    bg.setScale(960 / bg.width);
  } else add(sc.add.rectangle(480, 270, 960, 540, 0x2a0b3a));
  // the President at the podium (the Krunche News anchor sheet: 4 talk, 4 point, 4 arms up, 4 fist, 4 hand up)
  const anchorKey = sc.textures.exists("tvanchor_PRESIDENT_KLERBLE") ? "tvanchor_PRESIDENT_KLERBLE" : null;
  const anchor = anchorKey ? add(sc.add.sprite(480, 200, anchorKey, 0).setScale(2.2)) : null;
  let pose = 0;
  let talking = true;
  timers.push(
    sc.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        if (!anchor?.active) return;
        const f = talking ? pose * 4 + Math.floor(Math.random() * 4) : pose * 4;
        anchor.setFrame(f);
      },
    }),
  );
  // the crowd: grown-up Kreddlers in neon, from behind, and the press pack with their cameras
  const crowd: Phaser.GameObjects.Sprite[] = [];
  const NEON = [0xff9de6, 0x9be7ff, 0xfff38a, 0xc7a6ff, 0xa7ffb0];
  const backKey = sc.textures.exists("tv_burn_crowd_back") ? "tv_burn_crowd_back" : null;
  const pressKey = sc.textures.exists("tvpress_backs") ? "tvpress_backs" : null;
  for (let i = 0; i < 11 && pressKey; i++) crowd.push(add(sc.add.sprite(40 + i * 88, 352, pressKey, i % 16).setOrigin(0.5, 1).setScale(1.9)));
  for (let i = 0; i < 12 && backKey; i++) crowd.push(add(sc.add.sprite(0 + i * 88, 392, backKey, (i * 5) % 16).setOrigin(0.5, 1).setScale(2.1).setTint(NEON[i % NEON.length])));
  const bob = (big: boolean) =>
    crowd.forEach((c, i) => {
      sc.tweens.killTweensOf(c);
      const y0 = c.getData("y0") ?? c.y;
      c.setData("y0", y0).setY(y0);
      sc.tweens.add({ targets: c, y: y0 - (big ? 22 : 7), duration: big ? 170 : 300, yoyo: true, repeat: -1, delay: (i * 53) % 260, ease: "Sine.inOut" });
    });
  bob(false);

  // ---- the Kreddle TV chrome
  const bug = add(sc.add.text(18, 14, "KREDDLE TV  ● LIVE", { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffffff", backgroundColor: "#b91c1c", padding: { x: 8, y: 3 } }));
  sc.tweens.add({ targets: bug, alpha: 0.6, yoyo: true, repeat: -1, duration: 700 });
  add(sc.add.rectangle(480, 56, 960, 34, 0x12001f, 0.9));
  add(sc.add.text(20, 56, "PRESIDENT KLERBLE · VICTORY PRESS CONFERENCE: 'KRELWORLD RETURNED TO SENDER'", { fontFamily: "Impact, sans-serif", fontSize: "17px", color: "#facc15" }).setOrigin(0, 0.5));
  add(sc.add.rectangle(480, 84, 960, 22, 0xff4fd8, 0.95));
  const tick = add(
    sc.add.text(960, 84, "KRELWORLD ATTACK REPELLED IN UNDER A MINUTE  ·  KRELWORLDERS FIRED HOME BY TANK  ·  ODDS ON KRELWORLD NOW 'NO'  ·  KREDDLE ARMY UNDEFEATED SINCE FOREVER  ·  PUSSY JUICE STILL BANNED  ·  ", {
      fontFamily: FONT,
      fontSize: "13px",
      color: "#12001f",
      fontStyle: "bold",
    }).setOrigin(0, 0.5),
  );
  sc.tweens.add({ targets: tick, x: -tick.width, duration: 26000, repeat: -1 });
  // (the chrome sits in front of the crowd)
  R.bringToTop(tick);

  // ---- press flashes (a wall of them during the act; dim and slow with calmFlash on)
  let flashRate = 0.25;
  timers.push(
    sc.time.addEvent({
      delay: calm ? 420 : 140,
      loop: true,
      callback: () => {
        if (Math.random() > flashRate) return;
        const x = 30 + Math.random() * 900;
        const y = 190 + Math.random() * 150;
        const f = add(sc.add.circle(x, y, 14 + Math.random() * 14, 0xffffff, calm ? 0.3 : 0.95).setBlendMode(Phaser.BlendModes.ADD));
        sc.tweens.add({ targets: f, alpha: 0, scale: 2, duration: calm ? 500 : 160, onComplete: () => f.destroy() });
        if (!calm && Math.random() < 0.25) synth.play("camera_flash", 0.4);
      },
    }),
  );
  // ---- the crowd, cheering in bubbles (layered voices, so the President is never cut off)
  let cheerOn = true;
  timers.push(
    sc.time.addEvent({
      delay: 1300,
      loop: true,
      callback: () => {
        if (!cheerOn) return;
        const who = crowd[Math.floor(Math.random() * crowd.length)];
        const l = PRESSER_CHEERS[Math.floor(Math.random() * PRESSER_CHEERS.length)];
        if (!who) return;
        const t = add(sc.add.text(who.x, who.y - 115, l.t, { fontFamily: FONT, fontSize: "12px", color: "#12001f", backgroundColor: "#ffd1f3", padding: { x: 5, y: 2 }, fontStyle: "bold" }).setOrigin(0.5));
        sc.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 1000, duration: 400, onComplete: () => t.destroy() });
        if (Math.random() < 0.5) void voice.layer(String(l.s), l.t, 0.55);
      },
    }),
  );

  Juice.flash(sc, 0xffffff, 300, 0.5, depth + 5);
  synth.play("cheer");
  await wait(600);
  // the open: he cackles; then he steps out from behind the podium
  pose = 2;
  await talk(PRESSER_OPEN.slice(0, 2));
  pose = 2;
  await talk(PRESSER_OPEN.slice(2, 3));
  if (!live()) return;
  pose = 1;
  await talk(PRESSER_OPEN.slice(3));
  if (!live()) return;

  // ---- the act, side-on, under the bar
  talking = false;
  anchor?.setVisible(false);
  const bodyKey = sc.textures.exists("spr_TV_PRESIDENT_KLERBLE") ? "spr_TV_PRESIDENT_KLERBLE" : null;
  const body = bodyKey ? add(sc.add.sprite(625, 262, bodyKey, 4).setOrigin(0.5, 1).setScale(3.6)) : null;
  // (side-on at the front of the stage, beside the podium, over the heads of the front row)
  let wrist: ReturnType<typeof addWrist> | null = null;
  let bar: ReturnType<typeof addCensorBar> | null = null;
  if (body) {
    // the bar's generic groin box, on his 64px sheet
    bar = addCensorBar(sc, body, { pad: 3 });
    const r = { x: bar.obj.x, y: bar.obj.y };
    wrist = addWrist(sc, r.x - 6, r.y - 4, { skin: 0xd9a07a, sleeve: 0x4d5a2a, scale: 2.2, speed: 120 });
    R.add(wrist.obj);
    R.add(bar.obj);
  }
  // his whole body judders; the bar and the arm go with him
  const shake = body ? sc.tweens.add({ targets: body, x: body.x + 3, duration: 55, yoyo: true, repeat: -1 }) : null;
  const follow = () => {
    if (!body?.active || !bar) return;
    bar.follow();
    if (wrist) wrist.obj.x = bar.obj.x - 6;
  };
  sc.events.on("postupdate", follow);
  bob(true);
  flashRate = 0.7;
  synth.play("cheer");
  const moan = sc.time.addEvent({ delay: 1200, loop: true, callback: () => synth.play(Math.random() < 0.5 ? "moan_men_1" : "moan_men_2", 0.7) });
  timers.push(moan);
  synth.play("moan_men_1", 0.7);
  await wait(1600);
  wrist?.setSpeed(85);
  await talk(PRESSER_WONK);
  if (!live()) return;
  wrist?.setSpeed(60);
  flashRate = 1;
  await wait(1700);

  // ---- the krez. Comic-book treatment, all of it over the bar: the word does the work (nothing is drawn).
  moan.remove();
  synth.play("moan_men_2", 1);
  wrist?.kick();
  await wait(250);
  synth.play("squelch", 1);
  sc.time.delayedCall(90, () => synth.play("splat_1", 1));
  sc.time.delayedCall(220, () => synth.play("splash", 0.6));
  Juice.flash(sc, 0xffffff, 300, 0.85, depth + 5);
  const burst: Phaser.GameObjects.GameObject[] = [];
  if (bar) {
    const bx = bar.obj.x;
    const by = bar.obj.y;
    // a jagged starburst behind the word, like a comic panel
    const star = sc.add.graphics();
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 22; i++) {
      const r = i % 2 ? 62 : 120;
      const a = (i / 22) * Math.PI * 2;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * r * 1.5, Math.sin(a) * r));
    }
    star.fillStyle(0xfff200, 1).fillPoints(pts, true).lineStyle(6, 0x000000, 1).strokePoints(pts, true);
    star.setPosition(bx + 40, by - 30).setScale(0.2);
    const word = sc.add.text(bx + 40, by - 30, "SPLOOSH!!", { fontFamily: "Impact, sans-serif", fontSize: "64px", color: "#ff2d95", stroke: "#000000", strokeThickness: 10 }).setOrigin(0.5).setAngle(-10).setScale(0.2);
    R.add([star, word]);
    burst.push(star, word);
    sc.tweens.add({ targets: [star, word], scale: 1, duration: 180, ease: "Back.out" });
    sc.tweens.add({ targets: word, angle: 8, duration: 120, yoyo: true, repeat: 4 });
    const splat = sc.add.text(bx - 150, by - 140, "SPLAT!!", { fontFamily: "Impact, sans-serif", fontSize: "40px", color: "#fff200", stroke: "#000000", strokeThickness: 8 }).setOrigin(0.5).setAngle(14).setAlpha(0);
    R.add(splat);
    burst.push(splat);
    sc.tweens.add({ targets: splat, alpha: 1, scale: { from: 2, to: 1 }, delay: 260, duration: 160 });
  }
  // the front row's cameras all go at once; the room gasps
  flashRate = 1;
  for (let i = 0; i < (calm ? 3 : 10); i++) sc.time.delayedCall(i * 70, () => {
    const f = sc.add.circle(60 + Math.random() * 840, 190 + Math.random() * 150, 24, 0xffffff, calm ? 0.35 : 1).setBlendMode(Phaser.BlendModes.ADD);
    R.add(f);
    sc.tweens.add({ targets: f, alpha: 0, scale: 2.4, duration: calm ? 600 : 200, onComplete: () => f.destroy() });
    if (!calm) synth.play("camera_flash", 0.5);
  });
  synth.play("crowd_gasp");
  crowd.forEach((c) => sc.tweens.add({ targets: c, y: (c.getData("y0") ?? c.y) - 30, duration: 120, yoyo: true }));
  // the Kreddle TV camera lurches (its whole picture wobbles)
  if (!calm) sc.tweens.add({ targets: R, x: { from: -14, to: 14 }, y: { from: 8, to: -8 }, angle: { from: -1.2, to: 1.2 }, duration: 80, yoyo: true, repeat: 5, onComplete: () => R.setAngle(0).setPosition(0, 0) });
  else sc.tweens.add({ targets: R, angle: 1, duration: 300, yoyo: true, onComplete: () => R.setAngle(0).setPosition(0, 0) });
  Juice.shake(sc, 400, 0.01);
  await wait(900);
  if (!live()) return;
  // …then they cheer even harder
  synth.play("cheer");
  bob(true);
  await talk(PRESSER_BLESSED);
  if (!live()) return;
  // and the director finally pulls the plug
  Juice.flash(sc, 0xffffff, 300, 0.6, depth + 5);
  flashRate = 0;
  cheerOn = false;
  const card = sc.add.container(0, 0);
  R.add(card);
  const COLS = [0xc0c0c0, 0xc0c000, 0x00c0c0, 0x00c000, 0xc000c0, 0xc00000, 0x0000c0];
  COLS.forEach((c, i) => card.add(sc.add.rectangle(i * (960 / 7), 0, 960 / 7 + 1, 400, c).setOrigin(0)));
  card.add(sc.add.rectangle(0, 400, 960, 140, 0x111111).setOrigin(0));
  card.add(sc.add.rectangle(480, 200, 620, 150, 0x000000).setStrokeStyle(4, 0xffffff));
  card.add(sc.add.text(480, 170, "TECHNICAL DIFFICULTIES", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ff4fd8" }).setOrigin(0.5));
  card.add(sc.add.text(480, 225, "PLEASE STAND BY", { fontFamily: "Impact, sans-serif", fontSize: "40px", color: "#ffffff" }).setOrigin(0.5));
  card.add(sc.add.text(480, 470, "[ CENSORED ]  KREDDLE TV is experiencing a Presidential moment.", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
  Juice.tone(1000, 1600, 0.12, "sine");
  sc.time.delayedCall(250, () => synth.play("cheer"));
  await wait(2200);
  if (!live()) return;
  // ---- back: zipped up, at the podium, gloating
  sc.events.off("postupdate", follow);
  shake?.remove();
  wrist?.destroy();
  bar?.destroy();
  body?.destroy();
  card.destroy();
  cheerOn = true;
  for (const o of burst) o.destroy();
  anchor?.setVisible(true);
  talking = true;
  pose = 3;
  flashRate = 0.5;
  await talk(PRESSER_CLOSE.slice(0, 2));
  if (!live()) return;
  pose = 2;
  synth.play("cheer");
  await talk(PRESSER_CLOSE.slice(2));
  cheerOn = false;
  for (const t of timers) t.remove();
  // the feed cuts
  const off = sc.add.rectangle(480, 270, 960, 540, 0x000000, 0);
  R.add(off);
  await new Promise<void>((r) => sc.tweens.add({ targets: off, alpha: 1, duration: 450, onComplete: () => r() }));
  for (const o of [...R.list]) if (o !== off) (o as Phaser.GameObjects.GameObject).destroy();
  sc.tweens.add({ targets: off, alpha: 0, duration: 450, onComplete: () => R.destroy() });
  void G;
}

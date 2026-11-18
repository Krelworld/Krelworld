import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import * as Juice from "../../gfx/Juice";

/**
 * Chapter 6, the instant the Krunch Protocol's nuke goes off: a close cut to President Klerble in his bunker as the
 * light reaches him. Gore on: his eyes bulge and burst, the skin melts off, then the muscle, down to a grinning skull
 * that the shockwave blows away as ash. Gore off: he's flash-silhouetted, his hair, eyebrows and moustache vaporise,
 * he goes to ash with a blink and blows away into a little pile. Drawn in its own screen-space layer over whatever the
 * scene is showing, and destroyed at the end, so the shot underneath carries on as it was.
 * Art (PixelLab): c6_kmelt_0..6 (the gore stages) and c6_kmelt_soot / c6_kmelt_ash (the tame ones).
 */
export const KMELT_ART: Record<string, string> = {
  c6_kmelt_0: "props/c6_kmelt_0.png",
  c6_kmelt_1: "props/c6_kmelt_1.png",
  c6_kmelt_2: "props/c6_kmelt_2.png",
  c6_kmelt_3: "props/c6_kmelt_3.png",
  c6_kmelt_4: "props/c6_kmelt_4.png",
  c6_kmelt_5: "props/c6_kmelt_5.png",
  c6_kmelt_6: "props/c6_kmelt_6.png",
  c6_kmelt_soot: "props/c6_kmelt_soot.png",
  c6_kmelt_ash: "props/c6_kmelt_ash.png",
};

/** Where things sit on the 128px stage art (the eyes and the top of the head), for the particle sprays. */
const EYES: [number, number][] = [
  [50, 46],
  [78, 46],
];
const HEAD_TOP: [number, number] = [64, 14];

export async function klerbleMelt(sc: Phaser.Scene) {
  const gore = G.meta.settings.gore !== false;
  const calm = Juice.calm();
  const alive = () => !!sc.sys && sc.sys.settings.status < Phaser.Scenes.SHUTDOWN;
  const wait = (ms: number) => new Promise<void>((res) => sc.time.delayedCall(ms, () => res()));
  const has = (k: string) => sc.textures.exists(k);
  if (!has("c6_kmelt_0")) return;

  const root = sc.add.container(0, 0).setScrollFactor(0).setDepth(976);
  Juice.pinToScreen(sc, root);
  const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (root.add(o), o);

  // the bunker, dark and red, the alarm light still turning
  add(sc.add.rectangle(480, 270, 1100, 700, 0x12060a));
  if (has("tv_bunker")) add(sc.add.image(480, 270, "tv_bunker").setDisplaySize(1000, 560).setTint(0x7a3040).setAlpha(0.55));
  const alarm = add(sc.add.rectangle(480, 270, 1100, 700, 0xff1a1a, 0).setBlendMode(Phaser.BlendModes.ADD));
  sc.tweens.add({ targets: alarm, fillAlpha: 0.14, yoyo: true, repeat: -1, duration: calm ? 1400 : 700 });
  // the light: a white-out from the front, and a hot glow behind him
  const backGlow = add(sc.add.ellipse(480, 250, 600, 560, 0xffe6a8, 0).setBlendMode(Phaser.BlendModes.ADD));
  const S = 3.6;
  const BX = 480;
  const BY = 302;
  const pt = (x: number, y: number) => ({ x: BX + (x - 64) * S, y: BY + (y - 64) * S });
  const bust = add(sc.add.image(BX, BY, "c6_kmelt_0").setScale(S).setTint(0x8a4048));
  // the next stage cross-fades in over the last one
  const over = add(sc.add.image(BX, BY, "c6_kmelt_0").setScale(S).setAlpha(0));
  const white = add(sc.add.rectangle(480, 270, 1100, 700, 0xfffbeb, 0));
  const fx = sc.add.container(0, 0);
  root.add(fx);
  const top = add(sc.add.rectangle(480, 22, 1100, 44, 0x000000));
  const bot = add(sc.add.rectangle(480, 518, 1100, 44, 0x000000));
  void top;
  void bot;
  const stage = async (key: string, ms = 380) => {
    if (!has(key) || !alive()) return;
    over.setTexture(key).setAlpha(0).setScale(bust.scaleX, bust.scaleY).setPosition(bust.x, bust.y).clearTint();
    await new Promise<void>((res) => sc.tweens.add({ targets: over, alpha: 1, duration: ms, onComplete: () => res() }));
    if (!alive()) return;
    bust.setTexture(key).clearTint();
    over.setAlpha(0);
  };
  // heat shimmer: the whole figure wobbles in the rising air
  const shimmer = sc.time.addEvent({ delay: 40, loop: true, paused: true, callback: () => {
    const t = sc.time.now / 90;
    const k = 1 + Math.sin(t) * 0.012;
    bust.setScale(S * k * bust.getData("puff"), S * (2 - k) * bust.getData("puff"));
    bust.x = BX + Math.sin(t * 1.7) * 2;
  } });
  bust.setData("puff", 1);
  // embers and ash rising off him
  const embers = sc.time.addEvent({ delay: 70, loop: true, paused: true, callback: () => {
    const ash = Math.random() < 0.4;
    const p = sc.add.circle(BX + (Math.random() - 0.5) * 360, 420 + Math.random() * 80, ash ? 2 + Math.random() * 2 : 1.5 + Math.random() * 2, ash ? 0x9ca3af : [0xffb347, 0xff7a00, 0xffe08a][Math.floor(Math.random() * 3)]);
    if (!ash) p.setBlendMode(Phaser.BlendModes.ADD);
    fx.add(p);
    sc.tweens.add({ targets: p, y: p.y - 260 - Math.random() * 200, x: p.x + (Math.random() - 0.5) * 80, alpha: 0, duration: 1400 + Math.random() * 900, onComplete: () => p.destroy() });
  } });
  const spray = (x: number, y: number, n: number, colors: number[], spread = 1) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (80 + Math.random() * 220) * spread;
      const d = sc.add.circle(x, y, 2 + Math.random() * 5, colors[i % colors.length]);
      fx.add(d);
      sc.tweens.add({ targets: d, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v * 0.6 + 120 + Math.random() * 120, scale: 0.4, duration: 500 + Math.random() * 400, ease: "Quad.in", onComplete: () => d.destroy() });
    }
  };
  const drips = sc.time.addEvent({ delay: 90, loop: true, paused: true, callback: () => {
    const p = pt(30 + Math.random() * 68, 50 + Math.random() * 40);
    const d = sc.add.rectangle(p.x, p.y, 4 + Math.random() * 4, 6, [0xb91c1c, 0xf9a8a8, 0x7f1d1d, 0xe2725b][Math.floor(Math.random() * 4)]).setOrigin(0.5, 0);
    fx.add(d);
    sc.tweens.add({ targets: d, scaleY: 6 + Math.random() * 8, y: d.y + 60 + Math.random() * 100, alpha: 0, duration: 700 + Math.random() * 600, ease: "Quad.in", onComplete: () => d.destroy() });
  } });
  // the shockwave takes what's left: it crumbles from the top, and blows off to the right as ash
  const blowAway = async (colors: number[]) => {
    Juice.riser(700, 0.3);
    const ring = sc.add.ellipse(BX, BY - 40, 60, 60).setStrokeStyle(10, 0xfff7ed, 0.9).setFillStyle(0xffffff, 0);
    fx.add(ring);
    sc.tweens.add({ targets: ring, scale: 16, alpha: 0, duration: 900, ease: "Cubic.out", onComplete: () => ring.destroy() });
    Juice.shake(sc, 900, 0.012);
    for (let i = 0; i < 90; i++) {
      const p = pt(20 + Math.random() * 88, 8 + Math.random() * 112);
      const d = sc.add.rectangle(p.x, p.y, 3 + Math.random() * 6, 3 + Math.random() * 6, colors[i % colors.length]);
      fx.add(d);
      const delay = ((p.y - (BY - 64 * S)) / (128 * S)) * 500 + Math.random() * 120;
      sc.tweens.add({ targets: d, x: d.x + 300 + Math.random() * 500, y: d.y - 60 + Math.random() * 120, angle: 360 * (Math.random() - 0.5), alpha: 0, delay, duration: 900 + Math.random() * 500, ease: "Quad.in", onComplete: () => d.destroy() });
    }
    synth.play("thunder", 0.6);
    shimmer.paused = true;
    // (crumbles away from the top down)
    const h = { v: 0 };
    sc.tweens.add({ targets: h, v: 1, duration: 900, ease: "Quad.in", onUpdate: () => {
      const cut = Math.round(h.v * 128);
      bust.setCrop(0, cut, 128, 128 - cut);
      over.setAlpha(0);
    } });
    sc.tweens.add({ targets: [bust], x: BX + 40, duration: 900, ease: "Quad.in" });
    await wait(1000);
  };

  // 1. a beat in the dark: the switch is thrown, he's slumped where he fell
  synth.play("whistle", 0.25);
  await wait(500);
  if (!alive()) return;

  // 2. the light reaches him
  sc.tweens.add({ targets: white, fillAlpha: calm ? 0.45 : 1, duration: calm ? 700 : 60 });
  sc.tweens.add({ targets: backGlow, fillAlpha: calm ? 0.35 : 0.7, duration: calm ? 900 : 200 });
  await wait(calm ? 700 : 120);
  if (!alive()) return;
  sc.tweens.add({ targets: white, fillAlpha: calm ? 0.12 : 0.22, duration: calm ? 900 : 500 });
  alarm.destroy();

  if (gore) {
    bust.setTexture(has("c6_kmelt_1") ? "c6_kmelt_1" : "c6_kmelt_0").clearTint();
    synth.play("shriek", 0.7);
    Juice.tone(3200, 2600, 0.03, "sine");
    shimmer.paused = false;
    embers.paused = false;
    // his eyes bulge
    const puff = { v: 1 };
    await new Promise<void>((res) => sc.tweens.add({ targets: puff, v: 1.07, duration: 800, ease: "Quad.in", onUpdate: () => bust.setData("puff", puff.v), onComplete: () => res() }));
    if (!alive()) return;
    // …and burst
    bust.setTexture(has("c6_kmelt_2") ? "c6_kmelt_2" : bust.texture.key);
    bust.setData("puff", 1);
    synth.play("splat");
    synth.play("squelch");
    for (const [x, y] of EYES) {
      const p = pt(x, y);
      spray(p.x, p.y, 22, [0xb91c1c, 0xdc2626, 0xfef2f2, 0x7f1d1d]);
    }
    Juice.flash(sc, 0xff3b3b, 220, 0.25, 977);
    Juice.shake(sc, 300, 0.01);
    await wait(900);
    // the skin goes
    drips.paused = false;
    synth.play("flesh_rip");
    Juice.tone(180, 1400, 0.05, "sawtooth");
    await stage("c6_kmelt_3", 420);
    await wait(800);
    // then the muscle
    synth.play("squelch");
    await stage("c6_kmelt_4", 420);
    await wait(800);
    // down to the bone, grinning
    drips.paused = true;
    synth.play("bonecrack");
    sc.tweens.add({ targets: white, fillAlpha: calm ? 0.2 : 0.4, duration: 500 });
    await stage("c6_kmelt_5", 360);
    await wait(700);
    if (!alive()) return;
    await stage("c6_kmelt_6", 260);
    await blowAway([0x6b7280, 0x9ca3af, 0x44403c, 0xd6d3d1, 0xff7a00]);
  } else {
    // flash-silhouetted against the white
    bust.setTintFill(0x111111);
    synth.play("gasp");
    await wait(900);
    if (!alive()) return;
    // poof: hair, eyebrows and moustache go up in smoke
    bust.setTexture(has("c6_kmelt_soot") ? "c6_kmelt_soot" : "c6_kmelt_0").clearTint();
    synth.play("pfft");
    synth.play("pop");
    const hp = pt(...HEAD_TOP);
    spray(hp.x, hp.y + 40, 26, [0x44403c, 0x6b7280, 0x1c1917]);
    for (let i = 0; i < 6; i++) {
      const s = sc.add.circle(hp.x + (i - 2.5) * 30, hp.y + 20, 14, 0x9ca3af, 0.7);
      fx.add(s);
      sc.tweens.add({ targets: s, y: s.y - 120, scale: 3, alpha: 0, duration: 1100, delay: i * 60, onComplete: () => s.destroy() });
    }
    shimmer.paused = false;
    await wait(1200);
    synth.play("trombone", 0.7);
    await stage("c6_kmelt_ash", 600);
    // a little blink
    const lids = EYES.map(([x, y]) => {
      const p = pt(x, y);
      const r = sc.add.rectangle(p.x, p.y - 10, 44, 0, 0x6b7280).setOrigin(0.5, 0);
      fx.add(r);
      return r;
    });
    await new Promise<void>((res) => sc.tweens.add({ targets: lids, height: 30, yoyo: true, duration: 120, delay: 400, onComplete: () => res() }));
    lids.forEach((l) => l.destroy());
    await wait(400);
    await blowAway([0x6b7280, 0x9ca3af, 0xd6d3d1, 0x44403c]);
    // and that's all that's left of him
    if (has("c6_ashpile") && alive()) {
      const pile = sc.add.image(BX, 496, "c6_ashpile").setOrigin(0.5, 1).setScale(2.4).setAlpha(0);
      fx.add(pile);
      sc.tweens.add({ targets: pile, alpha: 1, duration: 200 });
      synth.play("pfft", 0.5);
      await wait(700);
    }
  }
  shimmer.remove();
  embers.remove();
  drips.remove();
  if (root.active) root.destroy();
}

import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { calm, loopProp } from "../../gfx/ambient";
import { vfx } from "../../gfx/Vfx";

/**
 * KREDDLE, ALIVE: buzzing neon, a fountain, the glow of a crowd moving up and down the Strip, a blimp,
 * and the odd jackpot going off. Set up once; tweens and timers only (nothing runs every frame).
 * With calm flashes on, the neon breathes slowly instead of flickering, and nothing pops.
 */

/** A neon sign's life: it buzzes, and every so often a tube stutters. `bad` signs have a dodgy tube. */
export function neonBuzz(sc: Phaser.Scene, t: Phaser.GameObjects.Text, bad = false) {
  if (calm()) {
    sc.tweens.add({ targets: t, alpha: { from: 1, to: 0.8 }, duration: 2400 + Math.random() * 1200, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: Math.random() * 1500 });
    return;
  }
  const stutter = () => {
    if (!t.active) return;
    const steps: [number, number][] = bad
      ? [
          [0.2, 60],
          [1, 50],
          [0.35, 90],
          [0.9, 40],
          [0.15, 160],
          [1, 0],
        ]
      : [
          [0.45, 60],
          [1, 70],
          [0.6, 50],
          [1, 0],
        ];
    let at = 0;
    for (const [a, ms] of steps) {
      sc.time.delayedCall(at, () => t.active && t.setAlpha(a));
      at += ms;
    }
    sc.time.delayedCall((bad ? 1500 : 3500) + Math.random() * (bad ? 2500 : 6000), stutter);
  };
  sc.time.delayedCall(800 + Math.random() * 4000, stutter);
}

export interface KreddleSpot {
  x: number;
  y: number;
  r: number;
  label: () => string;
  use: () => void;
}

export function kreddleLife(sc: Phaser.Scene, W: number, spots: KreddleSpot[], toast: (text: string) => void) {
  crowdGlow(sc, W);
  blimp(sc);
  fountain(sc, spots, toast);
  jackpots(sc);
}

/** Pools of coloured light drifting up and down the Strip, as if a crowd were moving through it. */
function crowdGlow(sc: Phaser.Scene, W: number) {
  const cols = [0xff4fd8, 0x22d3ee, 0xa855f7, 0xfacc15, 0x4ade80];
  const slow = calm();
  for (let i = 0; i < 8; i++) {
    const x = 200 + (i * (W - 400)) / 7 + Math.random() * 80;
    const g = sc.add
      .ellipse(x, 520 + (i % 3) * 50, 260 + Math.random() * 120, 70, cols[i % cols.length], 0.1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2.5);
    sc.tweens.add({ targets: g, x: x + (i % 2 ? 1 : -1) * (140 + Math.random() * 120), duration: 7000 + Math.random() * 5000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    sc.tweens.add({ targets: g, alpha: { from: 0.05, to: 0.13 }, duration: slow ? 3200 : 1600 + Math.random() * 900, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: Math.random() * 1000 });
  }
  // and the street's own murmur of light: a band of haze that rolls along the pavement
  const haze = sc.add.rectangle(0, 470, W * 0.5, 60, 0xff4fd8, 0.05).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.4);
  sc.tweens.add({ targets: haze, x: W * 0.5, duration: 26000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
}

/** The Klerble blimp, drifting over the skyline with a light on its belly. */
function blimp(sc: Phaser.Scene) {
  if (!sc.textures.exists("kd_blimp")) return;
  const b = sc.add.image(-120, 90, "kd_blimp").setScale(1.6).setScrollFactor(0.18, 0).setDepth(-24).setAlpha(0.92);
  const light = sc.add.circle(b.x, b.y + 30, 4, 0xff4fd8, 1).setScrollFactor(0.18, 0).setDepth(-23).setBlendMode(Phaser.BlendModes.ADD);
  sc.tweens.add({ targets: [b, light], x: 1250, duration: 90000, repeat: -1, delay: 3000 });
  sc.tweens.add({ targets: [b, light], y: "+=8", duration: 3000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  sc.tweens.add({ targets: light, alpha: 0.25, duration: calm() ? 1800 : 600, yoyo: true, repeat: -1 });
}

/** The Klerble Fountain: pink and cyan jets. Throw a coin in, if you like throwing money at Kreddle. */
function fountain(sc: Phaser.Scene, spots: KreddleSpot[], toast: (text: string) => void) {
  const X = 1795;
  const Y = 662;
  const f = loopProp(sc, "kd_fountain_anim", X, Y, 9, { scale: 1.35 });
  if (!f) return;
  f.setOrigin(0.5, 1).setDepth(Y);
  const glow = sc.add.ellipse(X, Y - 30, 170, 70, 0x22d3ee, 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(Y - 1);
  sc.tweens.add({ targets: glow, alpha: 0.07, duration: calm() ? 2400 : 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  const wishes = [
    "You wish for a jackpot. Somewhere in Kreddle, a slot machine laughs.",
    "Plop. A Kreddler in a wet suit surfaces, takes the coin, and goes back under.",
    "You wish for the Kreddle Krunchers to fall in. Nothing happens. Yet.",
    "The fountain gives you 0.5 Krokens' worth of hope. It's non-refundable.",
    "Plop. The water turns pink, then cyan, then back. That's it. That was the wish.",
  ];
  spots.push({
    x: X,
    y: Y + 10,
    r: 70,
    label: () => (G.s.coins >= 1 ? "E: Throw a Krezzcoin in the Klerble Fountain" : "The Klerble Fountain (you're skint)"),
    use: () => {
      if (G.s.coins < 1) return;
      G.s.coins -= 1;
      synth.play("coin");
      const c = sc.add.circle(X - 40, Y - 80, 4, 0xfacc15).setDepth(Y + 1);
      sc.tweens.add({ targets: c, x: X, y: Y - 30, duration: 420, ease: "Quad.in", onComplete: () => c.destroy() });
      sc.time.delayedCall(420, () => vfx(sc, "vfx_sparks", X, Y - 30, { scale: 0.7, depth: Y + 2, tint: 0x22d3ee }));
      toast(wishes[Math.floor(Math.random() * wishes.length)]);
    },
  });
}

/** Every so often somebody wins: coins burst out of a slot, or the Klerble Grand fires confetti. */
function jackpots(sc: Phaser.Scene) {
  if (calm()) return;
  const spots = [
    [495, 440],
    [580, 440],
    [665, 440],
    [750, 440],
    [1620, 300],
    [1300, 430],
  ];
  sc.time.addEvent({
    delay: 5200,
    loop: true,
    callback: () => {
      if (Math.random() < 0.45) return;
      const [x, y] = spots[Math.floor(Math.random() * spots.length)];
      if (x === 1620) vfx(sc, "vfx_confetti", x, y, { scale: 1.3, depth: 455 });
      else vfx(sc, "vfx_coins", x, y, { scale: 0.8, depth: 520 });
    },
  });
}

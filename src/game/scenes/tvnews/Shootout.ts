import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { vfx } from "../../gfx/Vfx";
import { G } from "../../G";
import { calm } from "./NewsChrome";
import { goreDeath } from "../../gfx/GoreDeath";

/**
 * Sergeant Swig opens fire on the press pack, seen from among them: muzzle flashes, a mix of gunshots, screams,
 * reporters jerking with each hit and going down, blood spraying and pooling, tripods and cameras toppling, the
 * picture shaking and, with gore on, spattered. Gore off: hits are sparks and dust, nobody bleeds, and the lens stays
 * clean. Reduced flashing: muzzle flashes are small and the screen never flashes.
 */

export interface Victim {
  spr: Phaser.GameObjects.Sprite;
  /** hits it takes to go down */
  hp: number;
}

export interface ShootoutOpts {
  /** where the muzzle is (screen) */
  muzzle: () => { x: number; y: number };
  victims: Victim[];
  /** cameras on tripods that can be shot over */
  rigs: Phaser.GameObjects.Container[];
  shots: number;
  depth: number;
  /** a sprite to kick with the recoil */
  shooter?: Phaser.GameObjects.Sprite;
}

const GUNSHOTS = ["pistol_indoor", "gun_pistol", "pistol_indoor", "gun_smg", "shoot", "gun_pistol"];
const SCREAMS = ["scream_man", "scream_woman", "shriek", "scream_man", "hurt"];

/** A camera on a tripod (for a press room), as a container you can knock over. */
export function tripodRig(sc: Phaser.Scene, x: number, y: number, s = 1, depth = 30) {
  const c = sc.add.container(x, y).setDepth(depth);
  const g = sc.add.graphics();
  g.lineStyle(3 * s, 0x1f2937, 1);
  g.lineBetween(0, -70 * s, -22 * s, 0).lineBetween(0, -70 * s, 22 * s, 0).lineBetween(0, -70 * s, 0, 0);
  g.fillStyle(0x111827, 1).fillRect(-22 * s, -98 * s, 40 * s, 26 * s);
  g.fillStyle(0x374151, 1).fillRect(18 * s, -92 * s, 12 * s, 14 * s);
  g.fillStyle(0x93c5fd, 1).fillCircle(30 * s, -85 * s, 5 * s);
  g.fillStyle(0xef4444, 1).fillCircle(-16 * s, -94 * s, 2.5 * s);
  c.add(g);
  c.setData("up", true);
  return c;
}

export function shootout(sc: Phaser.Scene, o: ShootoutOpts): Promise<void> {
  const gore = G.meta.settings.gore !== false;
  const k = calm() ? 0.35 : 1;
  const cam = sc.cameras.main;
  const alive = () => o.victims.filter((v) => v.hp > 0);
  synth.play("crowd_panic");
  synth.play("crowd_gasp");
  let lensDrops = 0;

  const hit = (v: Victim) => {
    const s = v.spr;
    const hx = s.x + (Math.random() - 0.5) * s.displayWidth * 0.3;
    const hy = s.y - s.displayHeight * (0.55 + Math.random() * 0.25);
    v.hp--;
    // the jerk: knocked back and twisted
    sc.tweens.killTweensOf(s);
    const dir = s.x < 480 ? -1 : 1;
    sc.tweens.add({ targets: s, x: s.x + dir * 10, angle: dir * (8 + Math.random() * 10), duration: 70, yoyo: v.hp > 0, ease: "Quad.out" });
    if (gore) {
      vfx(sc, "vfx_bloodspray", hx, hy, { scale: 1.4 + Math.random() * 0.5, depth: o.depth + 5, angle: dir > 0 ? 0 : 180, flipX: dir < 0 });
      vfx(sc, "vfx_blood", hx, hy, { scale: 1.2, depth: o.depth + 6 });
    } else {
      vfx(sc, "vfx_hit", hx, hy, { scale: 1.3, depth: o.depth + 5 });
      vfx(sc, "vfx_dust", hx, hy, { scale: 1, depth: o.depth + 4 });
    }
    synth.play(Math.random() < 0.5 ? "squelch" : "hit");
    if (Math.random() < 0.7) synth.play(SCREAMS[Math.floor(Math.random() * SCREAMS.length)]);
    if (v.hp <= 0) {
      // down they go
      // (gfx/GoreDeath.ts: the knees, the slump, the fall, the pool; now and then the round takes the top of the head off)
      goreDeath(sc, s, Math.random() < 0.3 ? "headshot" : "shot", { dir: dir as 1 | -1, hits: 0, delay: 140, quiet: true });
    }
    // some of it reaches the lens
    if (gore && lensDrops < 7 && Math.random() < 0.45) {
      lensDrops++;
      splat(sc, hx + (Math.random() - 0.5) * 200, hy + (Math.random() - 0.5) * 120, o.depth + 50);
    }
  };

  const knock = (c: Phaser.GameObjects.Container) => {
    c.setData("up", false);
    vfx(sc, "vfx_sparks", c.x, c.y - 85, { scale: 1.3, depth: o.depth + 6, add: true });
    sc.tweens.add({ targets: c, angle: (Math.random() < 0.5 ? -1 : 1) * 95, y: c.y + 10, duration: 480, ease: "Bounce.out" });
    synth.play("camera_crash");
  };

  return new Promise((res) => {
    let i = 0;
    const fire = () => {
      if (!sc.sys.settings.active) return res();
      if (i >= o.shots) return res();
      i++;
      const m = o.muzzle();
      // the shot
      synth.play(GUNSHOTS[i % GUNSHOTS.length]);
      if (i % 4 === 0) synth.play("shell_casings");
      vfx(sc, "vfx_muzzle", m.x, m.y, { scale: 1.6 * (0.6 + 0.4 * k), depth: o.depth + 10, add: true });
      const glow = sc.add.circle(m.x, m.y, 60, 0xfff3b0, 0.5 * k).setDepth(o.depth + 9).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: glow, alpha: 0, scale: 1.8, duration: 90, onComplete: () => glow.destroy() });
      // the room lights up with each shot (a lift, not a white-out; none with reduced flashing)
      if (!calm()) {
        const lift = sc.add.rectangle(0, 0, 960, 540, 0xffe9a8, 0.16).setOrigin(0).setScrollFactor(0).setDepth(o.depth + 8).setBlendMode(Phaser.BlendModes.ADD);
        sc.tweens.add({ targets: lift, alpha: 0, duration: 70, onComplete: () => lift.destroy() });
      }
      cam.shake(110, 0.009);
      if (o.shooter) sc.tweens.add({ targets: o.shooter, y: o.shooter.y - 6, duration: 50, yoyo: true });
      // where it goes: mostly people, now and then a camera rig, now and then nothing
      const rigs = o.rigs.filter((c) => c.getData("up"));
      const r = Math.random();
      if (rigs.length && r < 0.18) knock(rigs[Math.floor(Math.random() * rigs.length)]);
      else {
        const a = alive();
        if (a.length && r < 0.92) hit(a[Math.floor(Math.random() * a.length)]);
        else vfx(sc, "vfx_sparks", 100 + Math.random() * 760, 120 + Math.random() * 200, { scale: 1, depth: o.depth + 3, add: true });
      }
      // a rhythm that isn't a metronome: bursts, then a beat
      const gap = i % 5 === 0 ? 380 + Math.random() * 200 : 120 + Math.random() * 110;
      sc.time.delayedCall(gap, fire);
    };
    fire();
  });
}

/** A splat of blood on the lens, which slowly runs. */
export function splat(sc: Phaser.Scene, x: number, y: number, depth: number) {
  const c = sc.add.container(x, y).setDepth(depth).setScrollFactor(0);
  const g = sc.add.graphics();
  const r = 10 + Math.random() * 16;
  g.fillStyle(0x8b0000, 0.82).fillCircle(0, 0, r);
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = r * (0.8 + Math.random() * 1.2);
    g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, 2 + Math.random() * 5);
  }
  g.fillStyle(0xb91c1c, 0.6).fillCircle(-r * 0.25, -r * 0.25, r * 0.45);
  c.add(g);
  c.setScale(0.3);
  sc.tweens.add({ targets: c, scale: 1, duration: 90, ease: "Quad.out" });
  // drips
  for (let i = 0; i < 2; i++) {
    const d = sc.add.rectangle((Math.random() - 0.5) * r, r * 0.6, 3 + Math.random() * 3, 4, 0x8b0000, 0.8).setOrigin(0.5, 0);
    c.add(d);
    sc.tweens.add({ targets: d, scaleY: 12 + Math.random() * 20, duration: 5000 + Math.random() * 4000, ease: "Sine.out" });
  }
  return c;
}

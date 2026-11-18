import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { NEAR, Projector, type Sprite3D, clamp, ease, lerp, lookAt, playShot, span } from "../../gfx/Pseudo3D";
import { BRIDGE_Y0, BRIDGE_Y1, KE, KGROUND, kwx, kwy, snapKreddle } from "../hub/flyKreddle";

/**
 * The first time you walk over the Kreddle bridge (KreddleScene's first arrival, before the welcome card): a low
 * pseudo-3D run across the bridge at eye height, Krelford's daylight behind you, the neon city rising up ahead, under
 * the WELCOME gantry, and stopping where you stand on the Strip. Kreddle is built the intro flyover's way
 * (hub/flyKreddle.ts). About seven seconds, skippable. Only while Kreddle is still there (not after the nuke).
 */

const LENGTH = 7.0;
/** Where you stand when the scene starts (KreddleScene puts you at Strip 110, 560). */
const END = { x: kwx(110), y: kwy(560) };
const MID_Y = (BRIDGE_Y0 + BRIDGE_Y1) / 2;

export function wantsKreddleCrossing() {
  return G.hasRun() && !G.s.flags.kreddle_nuked && !G.s.flags.p3d_kreddle_crossing;
}

/** Play it over `sc` (paused underneath while it runs) and wait. */
export async function kreddleCrossing(sc: Phaser.Scene): Promise<void> {
  if (!wantsKreddleCrossing()) return;
  G.s.flags.p3d_kreddle_crossing = true;
  let paused = false;
  await playShot(sc, {
    length: LENGTH,
    fromBlack: true,
    fadeIn: 300,
    fadeOut: 500,
    onCovered: () => {
      if (sc.sys.isActive()) {
        sc.scene.pause();
        paused = true;
      }
    },
    build: (c) => {
      const { st, calm } = c;
      const s3 = c.sc;
      st.maxLean = 90;
      st.light = 0xffffff;
      st.fog = { color: 0x2a0b48, start: 1400, span: 4200, max: 0.7 };
      // it is always night in Kreddle
      st.setSky({ top: 0x05010c, horizon: 0x5a1470, below: 0x0d0619, stars: 90 });
      st.addGround({ x0: -7000, y0: -5000, x1: 7000, y1: 6000, cols: 40, rows: 40, color: 0x0d0619, depth: 1 });
      // behind you: Krelford's fields, in daylight; under you: the river
      st.addGround({ x0: 0, y0: -3000, x1: 5000, y1: 4500, cols: 20, rows: 24, color: 0x4a7a3a, depth: 1.2 });
      st.addGround({ x0: KE, y0: -5000, x1: 0, y1: 6000, cols: 6, rows: 44, color: 0x10285a, depth: 1.3 });
      // Kreddle (the flyover's snapshot of the Strip): the ground runs west from the bridge, so it's mirrored
      const prefix = `__p3d${st.id}_kd`;
      st.key("kd_ground");
      st.key("kd_atlas");
      const kd = snapKreddle(s3, prefix, 0.5);
      st.addGround({ key: kd.groundKey, x0: KGROUND.x1, y0: KGROUND.y0, x1: KGROUND.x0, y1: KGROUND.y1, cols: 30, rows: 12, depth: 1.6 });
      st.addAtlas(kd.atlasKey, kd.boards.map((b) => st.board(b)));
      // the neon: a glow on every sign and machine, washes of light over the Strip
      const glow = st.softDot("glow", 0.3);
      const glows = kd.glows.map((g) => ({ g, s: st.addSprite(glow, g.x, g.y, g.hz, g.size, { add: true, tint: g.col, alpha: g.a }) }));
      // the bridge's neon rails, and the river catching them
      const rails: Sprite3D[] = [];
      for (let x = 20; x > KE - 20; x -= 52)
        for (const [y, col] of [[BRIDGE_Y0 + 2, 0xff4fd8], [BRIDGE_Y1 - 2, 0x22d3ee]] as [number, number][]) rails.push(st.addSprite(glow, x, y, 26, 26, { add: true, tint: col, alpha: 0.85 }));
      const rnd = new Phaser.Math.RandomDataGenerator(["kcross"]);
      const glints = Array.from({ length: 30 }, () => ({ s: st.addSprite(glow, rnd.between(KE + 30, -30), rnd.pick([rnd.between(200, BRIDGE_Y0 - 30), rnd.between(BRIDGE_Y1 + 30, 1500)]), 2, rnd.between(40, 90), { add: true, tint: rnd.pick([0xff4fd8, 0x22d3ee, 0xfacc15]), alpha: 0.3 }), ph: rnd.frac() * 6 }));
      // searchlights over the Strip
      const beamsG = st.keep(s3.add.graphics().setDepth(2.6).setBlendMode(Phaser.BlendModes.ADD));
      const P = new Projector();
      s3.time.delayedCall(500, () => c.caption("THE KREDDLE BRIDGE", { hold: 2.2, color: "#22d3ee" }));
      synth.play("fly_wind", 0.35);
      let lastStep = 0;
      let foot = 0;
      return (t, _dt) => {
        // the run: up to speed, across, under the gantry, slowing to a stop where you stand
        const u = clamp(t / (LENGTH - 0.5), 0, 1);
        const run = 0.08 * u + 0.92 * ease(u);
        const x = lerp(340, END.x, run);
        const speed = Math.sin(Math.PI * clamp(u, 0, 1)) * (u < 0.9 ? 1 : 0.6);
        // steps (and the bob that goes with them)
        const ph = t * 8.6;
        const bob = (calm ? 2 : 5) * Math.abs(Math.sin(ph)) * speed;
        if (speed > 0.25 && t - lastStep > Math.PI / 8.6) {
          lastStep = t;
          synth.play("step", 0.35 + 0.15 * (foot++ % 2));
        }
        const y = lerp(MID_Y + 6, END.y, span(t, LENGTH - 2.4, LENGTH - 0.4)) + Math.sin(ph / 2) * 4 * speed;
        const z = 64 + bob;
        // eyes up at the city as it rises, then settling on the Strip
        const lookUp = 90 + 110 * span(t, 1.2, 3.6) - 90 * span(t, 4.8, LENGTH - 0.3);
        // (at the end, turning a touch left, off the Exchange's kiosk and down the Strip)
        const look = { x: x - 1500, y: MID_Y + 330 * span(t, 4.0, LENGTH - 0.2) + Math.sin(ph / 2) * 6 * speed, z: lookUp };
        const pose = lookAt({ x, y, z }, look, Math.sin(ph / 2) * (calm ? 0.4 : 1.2) * speed);
        // the neon breathes (and dodgy tubes stutter, unless calm flashes are on)
        for (const { g, s } of glows) {
          let pulse = calm ? 0.85 + 0.15 * Math.sin(t * 1.1 + g.ph) : 0.78 + 0.22 * Math.sin(t * 3.2 + g.ph);
          if (g.bad && !calm && Math.sin(t * 9 + g.ph) > 0.94) pulse *= 0.35;
          s.alpha = g.a * pulse;
        }
        rails.forEach((r, i) => (r.alpha = calm ? 0.8 : 0.65 + 0.3 * Math.sin(t * 6 - i * 0.5)));
        for (const gl of glints) gl.s.alpha = 0.18 + 0.15 * Math.sin(t * 2.5 + gl.ph);
        P.set(pose);
        beamsG.clear();
        for (const bm of kd.beams) {
          const sw = Math.sin(t * (calm ? 0.35 : 0.6) + bm.ph) * 0.5;
          const L = 2600;
          const q0 = P.project(bm.x, bm.y, 0);
          if (q0.zc < NEAR + 10) continue;
          const x0 = q0.x;
          const y0 = q0.y;
          const tops: number[] = [];
          for (const side of [-1, 1]) {
            const q = P.project(bm.x + side * 160, bm.y + Math.sin(sw) * L, Math.cos(sw) * L);
            if (q.zc < NEAR + 10) break;
            tops.push(q.x, q.y);
          }
          if (tops.length < 4) continue;
          beamsG.fillStyle(bm.col, 0.1);
          beamsG.fillTriangle(x0, y0, tops[0], tops[1], tops[2], tops[3]);
        }
        return pose;
      };
    },
  });
  if (paused && sc.sys && sc.sys.isPaused()) sc.scene.resume();
}

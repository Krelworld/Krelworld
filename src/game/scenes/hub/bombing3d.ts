import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import * as Juice from "../../gfx/Juice";
import { hasVfx } from "../../gfx/Vfx";
import {
  type Aim,
  type Board3D,
  type BoardSpec,
  type Pose,
  type Sprite3D,
  DEG,
  FOCAL,
  SH,
  SW,
  aimToPose,
  can3d,
  clamp,
  ease,
  lerp,
  lerpAim,
  mixC,
  playShot,
  snapshotWorld,
} from "../../gfx/Pseudo3D";

/**
 * The Krunch Protocol, in pseudo-3D (see gfx/Pseudo3D.ts): the end of Chapter 6, every building in Krelford hit one
 * after another. The live town is snapshotted into a set; a low, tilted camera swoops from target to target (lifting
 * and banking between them), each missile streaks down out of the sky in perspective, trailing smoke, and the
 * building goes up in fire and comes down into its rubble. It keeps the 2D montage's timing curve exactly: the first
 * few you watch land, then they're coming in faster than you can look. It ends settling straight down onto the Great
 * Tap (the live camera), where the 2D aftermath takes over.
 *
 * The hub does the lasting damage itself (`onImpact`: the building's image goes, rubble and fires appear), under the
 * shot, so by the time the shot fades out the live town matches it.
 */

export interface BombTarget {
  id: string;
  /** what comes up as it goes */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** its live image (to find its board in the snapshot) */
  img?: Phaser.GameObjects.Image;
}

interface Opts {
  worldW: number;
  worldH: number;
  targets: BombTarget[];
  /** for the tally: "n / total" */
  total: number;
  /** the live camera at the end (centre and zoom): the shot settles straight down onto it */
  end: { x: number; y: number; zoom: number };
  skip?: Phaser.GameObjects.GameObject[];
  onCovered?: () => void;
  /** a missile has landed on target i (do the lasting damage in the live scene) */
  onImpact: (i: number) => void;
}

/** A camera aimed at a point `lz` up off the ground. */
type AimZ = Aim & { lz: number };
const poseOf = (a: AimZ): Pose => {
  const p = aimToPose(a);
  p.z += a.lz;
  return p;
};
const mixAim = (a: AimZ, b: AimZ, u: number, hop = 0): AimZ => ({ ...lerpAim(a, b, u, hop), lz: lerp(a.lz, b.lz, u) });
const wrap = (d: number) => {
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

/** The same rubble the hub drops on each building's footprint (its rubbleProps, same seed), so the hand-back matches. */
function rubbleSpecs(sc: Phaser.Scene, b: BombTarget): BoardSpec[] {
  const rnd = new Phaser.Math.RandomDataGenerator([b.id]);
  const keys = ["r_rubble", "r_ruin", "r_girders", "r_wall", "r_fireheap", "r_rubble", "r_debris"];
  const n = Math.max(3, Math.round(b.w / 70));
  const out: BoardSpec[] = [];
  for (let i = 0; i < n; i++) {
    const x = b.x - b.w / 2 + (b.w * (i + 0.5)) / n + rnd.between(-14, 14);
    const y = b.y + b.h * 0.18 + rnd.between(-26, 26);
    const key = keys[(i + rnd.between(0, 6)) % keys.length];
    if (!sc.textures.exists(key)) continue;
    // measured off a throwaway image, so any HD factor on the art is the same as the hub's
    const im = sc.add.image(0, 0, key).setScale(1.6 + rnd.frac() * 0.8);
    out.push({ key, x, y: y + im.displayHeight * 0.15, w: im.displayWidth, h: im.displayHeight });
    im.destroy();
  }
  return out;
}

/** An animated vfx sheet played on a set sprite (frames stepped by hand). */
interface Anim {
  s: Sprite3D;
  t0: number;
  fps: number;
  frames: number;
  loop: boolean;
  /** peak alpha */
  a: number;
}

/** A puff in the pool: smoke trails, the dust ring, debris. */
interface Puff {
  s: Sprite3D;
  t0: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  x0: number;
  y0: number;
  z0: number;
  size0: number;
  size1: number;
  a: number;
}

/**
 * Play the bombing. Resolves { ran: false } straight away without WebGL (the caller plays its 2D montage instead);
 * otherwise once it's over (`skipped` if the player skipped it: the caller finishes off what's left standing).
 */
export async function bombingShot(hub: Phaser.Scene, o: Opts): Promise<{ ran: boolean; skipped: boolean }> {
  if (!can3d(hub) || !o.targets.length) return { ran: false, skipped: false };
  // ---------------------------------------------------------------- the schedule: the 2D montage's own curve
  const OPEN = 1.5;
  let cur = OPEN;
  const plan = o.targets.map((b, i) => {
    const k = Math.max(0.35, 1 - i * 0.07);
    const move = cur;
    const fly = move + 0.48 * k;
    const hit = fly + 0.42 * k + 0.12;
    cur = hit + 0.32 * k + 0.06;
    // the camera's move: as long as the pan (and a touch more, overlapping the missile's approach; longer onto the first)
    const camMove = i === 0 ? 1.0 : 0.45 * k + 0.2;
    return { b, i, k, move, fly, hit, camMove, base: b.y + b.h / 2 };
  });
  const SETTLE0 = cur + 0.35;
  const SETTLE = 2.0;
  const length = SETTLE0 + SETTLE;

  // ---------------------------------------------------------------- the camera's stops
  // heading: roughly the way it's travelling (so it flies on from one to the next), never far off north (the town's
  // own way up), lower and further back as it speeds up so the barrage reads
  const open: AimZ = { x: 1280, y: 1250, d: 1900, p: 9, yaw: 0, r: 0, lz: 260 };
  let yaw = 0;
  let px = open.x;
  let py = open.y;
  const stops: AimZ[] = plan.map((p, i) => {
    const b = p.b;
    const head = Math.atan2(b.x - px, -(p.base - py)) / DEG;
    yaw = clamp(yaw + clamp(wrap(head - yaw), -40, 40), -55, 55) * 0.85;
    px = b.x;
    py = p.base;
    const fast = 1 - p.k;
    const d = clamp(b.h * 1.7 + b.w * 0.55, 560, 1050) * lerp(1, 1.3, fast / 0.65);
    return { x: b.x, y: p.base - 20, d, p: 12 + (i % 3) * 3 + fast * 8, yaw, r: 0, lz: b.h * 0.4 };
  });
  const end: AimZ = { x: o.end.x, y: o.end.y, d: FOCAL / o.end.zoom, p: 90, yaw: 0, r: 0, lz: 0 };
  /** where the camera is, held on stop i, at time t (a slow push-in and drift while it waits) */
  const held = (i: number, t: number): AimZ => {
    const p = plan[i];
    const a = stops[i];
    const u = clamp((t - (p.move + p.camMove)) / 1.6, 0, 1);
    const side = i % 2 ? 1 : -1;
    return { ...a, d: a.d * (1 - 0.07 * u), yaw: a.yaw + side * 4 * u, r: side * 1.5 * u };
  };
  const camAt = (t: number): AimZ => {
    if (t < plan[0].move) {
      const u = ease(t / plan[0].move);
      return { ...open, d: open.d * (1 - 0.08 * u), lz: open.lz + 40 * u };
    }
    if (t >= SETTLE0) {
      const u = clamp((t - SETTLE0) / SETTLE, 0, 1);
      const k = 1 - Math.pow(1 - u, 3);
      const from = held(plan.length - 1, SETTLE0);
      const a = mixAim(from, end, k);
      a.p = lerp(from.p, 90, Math.pow(k, 0.8));
      a.r = lerp(from.r, 0, k);
      return a;
    }
    let i = plan.length - 1;
    while (i > 0 && t < plan[i].move) i--;
    const p = plan[i];
    const u = (t - p.move) / p.camMove;
    if (u >= 1) return held(i, t);
    const from = i === 0 ? camAt(p.move - 1e-6) : held(i - 1, p.move);
    // swoops: up and banking between targets (less of a hop as they get quicker, so it doesn't seasick you)
    return mixAim(from, stops[i], Phaser.Math.Easing.Sine.InOut(clamp(u, 0, 1)), i === 0 ? 0.15 : 0.32 * p.k + 0.08);
  };

  return new Promise((resolve) => {
    let fired = 0;
    void playShot(hub, {
      length,
      fadeIn: 500,
      fadeOut: 450,
      onCovered: o.onCovered,
      build: (c) => {
        const { st, sc, calm } = c;
        st.maxLean = 80;
        st.light = 0x8a7c9c;
        st.fog = { color: 0x3a1420, start: 700, span: 4200, max: 0.75 };
        st.setSky({ top: 0x07030c, horizon: 0x8a2a1c, below: 0x1a0d10, stars: 90 });
        st.addGround({ x0: -9000, y0: -9000, x1: o.worldW + 9000, y1: o.worldH + 9000, cols: 9, rows: 9, color: 0x1c1418, depth: 1 });
        const { boards } = snapshotWorld(st, hub, { worldW: o.worldW, worldH: o.worldH, skip: o.skip });
        // each target's board in the snapshot (by where its picture stood)
        const bBoard: (Board3D | undefined)[] = plan.map(({ b }) => {
          const im = b.img;
          if (!im?.active) return undefined;
          const bx = im.x - im.displayWidth * im.originX + im.displayWidth / 2;
          const by = im.y - im.displayHeight * im.originY + im.displayHeight;
          return boards.find((q) => Math.abs(q.x - bx) < 3 && Math.abs(q.y - by) < 3);
        });
        const bH0 = bBoard.map((q) => q?.h ?? 0);
        // the rubble each one leaves (hidden till it comes down)
        const rubSpecs = plan.map(({ b }) => rubbleSpecs(sc, b));
        const rubAll = st.addBoards(rubSpecs.flat(), 4.2);
        rubAll.forEach((r) => (r.alpha = 0));
        const rubbles: Board3D[][] = [];
        let ri = 0;
        for (const s of rubSpecs) rubbles.push(rubAll.slice(ri, (ri += s.length)));

        const glow = st.softDot("glow", 0.3);
        const dot = st.softDot("dust", 0.55);
        const missileKey = sc.textures.exists("c6_missile") ? "c6_missile" : null;

        // "The sky is full of little lights. They are getting bigger."
        const rnd = new Phaser.Math.RandomDataGenerator(["krunchsky"]);
        const lights = Array.from({ length: 26 }, () => ({
          s: st.addSprite(glow, rnd.realInRange(-600, o.worldW + 600), rnd.realInRange(-3600, -900), rnd.realInRange(1300, 2600), 60, { add: true, tint: rnd.pick([0xffd8a8, 0xff8a5c, 0xfff1c1]), alpha: 0, layer: "back" }),
          ph: rnd.frac() * 6,
          vz: rnd.realInRange(60, 140),
        }));

        // the pool of puffs
        const POOL = 170;
        const puffs: Puff[] = Array.from({ length: POOL }, () => ({ s: st.addSprite(dot, 0, 0, 0, 10, { alpha: 0 }), t0: -99, life: 1, vx: 0, vy: 0, vz: 0, g: 0, x0: 0, y0: 0, z0: 0, size0: 10, size1: 10, a: 0 }));
        let pn = 0;
        const puff = (t: number, x: number, y: number, z: number, p: Partial<Puff> & { tint?: number; layer?: Sprite3D["layer"] } = {}) => {
          const q = puffs[pn++ % POOL];
          Object.assign(q, { t0: t, life: 0.7, vx: 0, vy: 0, vz: 0, g: 0, x0: x, y0: y, z0: z, size0: 22, size1: 66, a: 0.7 }, p);
          q.s.tint = p.tint ?? 0xd6d3d1;
          q.s.layer = p.layer ?? "auto";
        };

        // per target: the missile, its glow, the blasts, the fires that stay
        const sheet = (key: string) => (hasVfx(sc, key) ? key : null);
        const bigKey = sheet("vfx_bigboom") ?? sheet("vfx_boom");
        const boomKey = sheet("vfx_boom");
        const fireKey = sheet("vfx_fire");
        const smokeKey = sheet("vfx_smokecol");
        const sheetFrames = (k: string) => sc.textures.get(k).frameTotal - 1;
        const anims: Anim[] = [];
        const anim = (key: string | null, x: number, y: number, z: number, size: number, t0: number, fps: number, loop: boolean, o2: { ox?: number; oy?: number; add?: boolean; layer?: Sprite3D["layer"]; a?: number; tint?: number } = {}) => {
          if (!key) return null;
          const s = st.addSprite(key, x, y, z, size, { frame: 0, alpha: 0, layer: o2.layer ?? "auto", add: o2.add, lit: false, tint: o2.tint });
          s.img.setOrigin(o2.ox ?? 0.5, o2.oy ?? 0.5);
          const a: Anim = { s, t0, fps, frames: Math.max(1, sheetFrames(key)), loop, a: o2.a ?? 1 };
          anims.push(a);
          return a;
        };
        const T = plan.map((p, i) => {
          const b = p.b;
          const a = stops[i];
          // the missile's line: alternately over the camera's shoulder and diving down out of the far sky
          const fx = Math.sin(a.yaw * DEG);
          const fy = -Math.cos(a.yaw * DEG);
          const rx = Math.cos(a.yaw * DEG);
          const ry = Math.sin(a.yaw * DEG);
          const side = rnd.pick([-1, 1]);
          const shoulder = i % 2 === 0;
          const end = { x: b.x, y: p.base - 10, z: b.h * 0.35 };
          const start = shoulder
            ? { x: end.x - fx * (a.d + 500) + rx * side * 380, y: end.y - fy * (a.d + 500) + ry * side * 380, z: end.z + 1000 }
            : { x: end.x + fx * 3000 + rx * side * 900, y: end.y + fy * 3000 + ry * side * 900, z: 1250 };
          const m = missileKey ? st.addSprite(missileKey, start.x, start.y, start.z, 120, { alpha: 0, layer: "front", lit: false }) : st.addSprite(glow, start.x, start.y, start.z, 50, { add: true, alpha: 0, layer: "front", tint: 0xe5e7eb });
          const head = st.addSprite(glow, start.x, start.y, start.z, 90, { add: true, alpha: 0, layer: "front", tint: 0xffb35c });
          const flare = st.addSprite(glow, end.x, end.y, end.z, Math.max(420, b.w * 1.6), { add: true, alpha: 0, layer: "front", tint: 0xfff1d6 });
          const z0 = b.h * 0.35;
          const booms = [anim(bigKey, b.x, end.y, z0, 300, p.hit, 16, false, { ox: 0.544, oy: 0.621, layer: "front", a: 1 })];
          for (let j = 0; j < 3; j++) booms.push(anim(boomKey, b.x + (rnd.frac() - 0.5) * b.w * 0.8, end.y + 4, rnd.realInRange(0.1, 0.7) * b.h, 150, p.hit + 0.12 + j * 0.11, 19, false, { layer: "front" }));
          // fires and the smoke column: where the hub puts its own, so they're in the same place when the shot hands back
          const fires = [-1, 1].map((sx) => anim(fireKey, b.x + sx * b.w * 0.22, b.y + b.h * 0.2, 0, 106, p.hit + 0.3, 12, true, { oy: 0.763 }));
          const smoke = anim(smokeKey, b.x, b.y - b.h * 0.2, 0, 86, p.hit + 0.45, 10, true, { oy: 1, tint: 0xb8b0b0, a: 0.9 });
          const fireGlow = st.addSprite(glow, b.x, b.y + b.h * 0.2, 40, Math.max(360, b.w * 1.5), { add: true, alpha: 0, layer: "back", tint: 0xff6a1a });
          return { start, end, m, head, flare, booms, fires, smoke, fireGlow, side, ph: rnd.frac() * 6 };
        });

        // the screen-space bits: the lock-on, the names, the tally
        const ret = st.keep(sc.add.graphics().setDepth(40));
        const tally = st.keep(sc.add.text(SW - 16, 66, "", { fontFamily: "Courier New, monospace", fontSize: "15px", color: "#ff4d4d", fontStyle: "bold", stroke: "#000", strokeThickness: 4, align: "right" }).setOrigin(1, 0).setDepth(85));
        const setTally = (n: number) => tally.setText(`⚠ KRUNCH PROTOCOL\nTARGETS DESTROYED: ${n} / ${o.total}`);
        setTally(0);
        const labels = plan.map(({ b }) => {
          const tx = st.keep(sc.add.text(0, 0, b.label, { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffd23f", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(50).setVisible(false));
          return tx;
        });

        let shakeT = -99;
        let shakeA = 0;
        let lastHit = -99;
        const P = st.P;
        const proj = (x: number, y: number, z: number) => {
          const q = P.project(x, y, z);
          return { x: q.x, y: q.y, zc: q.zc };
        };
        const flashK = calm ? 0.22 : 0.5;
        const shakeK = calm ? 0.35 : 1;
        const lightA = 0x8a7c9c;
        const lightB = 0xb48c84;

        return (t, dt) => {
          // the lights in the sky, coming down; they thin out once the real ones start landing
          for (const l of lights) {
            l.s.z = Math.max(400, l.s.z - l.vz * dt);
            l.s.size = 60 + 40 * Math.sin(t * 3 + l.ph) ** 2;
            l.s.alpha = clamp(t / 0.8, 0, 1) * (1 - clamp((t - OPEN - 2) / 4, 0, 0.85)) * (0.6 + 0.4 * Math.sin(t * 7 + l.ph));
          }
          // the beats
          while (fired < plan.length && t >= plan[fired].hit) {
            const p = plan[fired];
            synth.play(Math.random() < 0.5 ? "explode_1" : "explode_2");
            synth.play("boom");
            Juice.subDrop(0.7, 0.9);
            st.flash = Math.max(st.flash, flashK);
            shakeT = t;
            shakeA = 1;
            lastHit = t;
            o.onImpact(fired);
            setTally(fired + 1);
            // the dust ring, and the debris
            const e = T[fired].end;
            for (let j = 0; j < 14; j++) {
              const a = (j / 14) * Math.PI * 2;
              const sp = Math.max(260, p.b.w * 1.3);
              puff(t, e.x, e.y, 8, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, life: 0.9, size0: 60, size1: 150, a: 0.55, tint: 0xd8c0a8 });
            }
            for (let j = 0; j < 12; j++) {
              const a = Math.random() * Math.PI * 2;
              const sp = 140 + Math.random() * 260;
              puff(t, e.x, e.y, e.z, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 260 + Math.random() * 380, g: 900, life: 1.1, size0: 16, size1: 14, a: 0.95, tint: 0x2a1d18, layer: "front" });
            }
            fired++;
          }
          for (const [i, p] of plan.entries()) {
            const tt = T[i];
            const b = p.b;
            // the missile: in on a Quad.in from wherever it starts, trailing smoke
            if (t >= p.fly && t < p.hit) {
              if (tt.m.alpha === 0) {
                synth.play("telegraph");
                synth.play("whistle");
              }
              const u = (t - p.fly) / (p.hit - p.fly);
              const k = u * u;
              const x = lerp(tt.start.x, tt.end.x, k);
              const y = lerp(tt.start.y, tt.end.y, k);
              const z = lerp(tt.start.z, tt.end.z, k);
              for (const s of [tt.m, tt.head]) {
                s.x = x;
                s.y = y;
                s.z = z;
                s.alpha = 1;
              }
              tt.head.alpha = 0.55 + 0.3 * Math.sin(t * 40);
              // its smoke (a puff a frame), and which way it's pointing on the screen
              puff(t, x, y, z, { life: 0.7, size0: 28 + Math.random() * 14, size1: 100, a: 0.7 });
              const k2 = Math.min(1, (u + 0.02) * (u + 0.02));
              const a0 = proj(x, y, z);
              const a1 = proj(lerp(tt.start.x, tt.end.x, k2), lerp(tt.start.y, tt.end.y, k2), lerp(tt.start.z, tt.end.z, k2));
              if (missileKey) tt.m.spin = Math.atan2(a1.y - a0.y, a1.x - a0.x) - (P.p.roll ?? 0);
            } else if (tt.m.alpha) {
              tt.m.alpha = 0;
              tt.head.alpha = 0;
            }
            // the impact: a white flare on it, then the building comes down into its rubble
            const lt = t - p.hit;
            tt.flare.alpha = lt >= 0 && lt < 0.5 ? (calm ? 0.45 : 0.85) * (1 - lt / 0.5) : 0;
            const bd = bBoard[i];
            if (bd) {
              if (lt >= 0.07) {
                bd.tint = 0x3a2a24;
                bd.dx = lt < 0.07 + 0.54 ? Math.sin(lt * 70) * 6 : 0;
                const cu = clamp((lt - 0.32) / 0.9, 0, 1);
                bd.h = bH0[i] * (1 - 0.85 * cu * cu);
                bd.alpha = 1 - cu * cu;
              } else if (lt >= 0) bd.tint = 0xffffff;
            }
            const ra = clamp((lt - 0.72) / 0.5, 0, 1);
            for (const r of rubbles[i]) r.alpha = ra;
            // fires keep burning, their glow flickering on the ground
            tt.fireGlow.alpha = lt > 0.2 ? clamp((lt - 0.2) / 0.6, 0, 1) * (0.32 + 0.1 * Math.sin(t * 9 + tt.ph) + 0.06 * Math.sin(t * 23 + tt.ph)) : 0;
            // the lock-on (screen space, over its building)
            if (t >= p.fly && t < p.hit) {
              const ru = clamp((t - p.fly) / (0.3 * p.k), 0, 1);
              const c0 = proj(b.x, p.base, b.h * 0.45);
              if (c0.zc > 80) {
                const r = clamp((FOCAL * Math.max(70, b.w * 0.36)) / c0.zc, 30, 150);
                const e = 1 - Math.pow(1 - ru, 3);
                ret.setPosition(c0.x, c0.y).setScale(lerp(2.4, 1, e)).setAngle(90 * e).setAlpha(e).setVisible(true);
                ret.clear().lineStyle(3, 0xef4444, 0.95).strokeCircle(0, 0, r);
                ret.fillStyle(0xef4444, 0.8).fillRect(-r * 1.25, -1, r * 2.5, 2).fillRect(-1, -r * 1.25, 2, r * 2.5);
              }
            }
            // its name, up over where it stood
            const lab = labels[i];
            if (lt >= 0 && lt < 1.0) {
              const q = proj(b.x, p.base, bH0[i] || b.h);
              lab.setVisible(q.zc > 80).setPosition(q.x, Math.max(80, q.y - 26)).setScale(lt < 0.16 ? lerp(2, 1, lt / 0.16) : 1).setAlpha(lt < 0.6 ? 1 : 1 - (lt - 0.6) / 0.4);
            } else lab.setVisible(false);
          }
          if (!plan.some((p) => t >= p.fly && t < p.hit)) ret.setVisible(false);
          // the sheets
          for (const a of anims) {
            const lt = t - a.t0;
            if (lt < 0) {
              a.s.alpha = 0;
              continue;
            }
            const f = Math.floor(lt * a.fps);
            if (!a.loop && f >= a.frames) {
              a.s.alpha = 0;
              continue;
            }
            a.s.img.setFrame(a.loop ? f % a.frames : f);
            a.s.alpha = a.a * (a.loop ? clamp(lt / 0.4, 0, 1) : 1);
          }
          // the puffs
          for (const q of puffs) {
            const lt = t - q.t0;
            if (lt < 0 || lt > q.life) {
              q.s.alpha = 0;
              continue;
            }
            const u = lt / q.life;
            q.s.x = q.x0 + q.vx * lt;
            q.s.y = q.y0 + q.vy * lt;
            q.s.z = Math.max(2, q.z0 + q.vz * lt - 0.5 * q.g * lt * lt);
            q.s.size = lerp(q.size0, q.size1, 1 - (1 - u) * (1 - u));
            q.s.alpha = q.a * (1 - u);
          }
          // the light: warmer as the town burns; flashes fade
          st.light = mixC(lightA, lightB, clamp(fired / plan.length, 0, 1));
          st.flash = Math.max(0, st.flash - dt * 3);
          // the camera, and the shake / punch of each hit
          const a = camAt(t);
          const since = t - lastHit;
          if (since >= 0 && since < 0.6) a.d *= 1 - 0.06 * Math.exp(-since * 7) * (calm ? 0.5 : 1);
          const pose = poseOf(a);
          const sa = shakeA * Math.exp(-(t - shakeT) * 6) * shakeK;
          if (sa > 0.01) {
            pose.x += (Math.sin(t * 53) + Math.sin(t * 31)) * 9 * sa;
            pose.z += (Math.sin(t * 47 + 1) + Math.sin(t * 29)) * 7 * sa;
            pose.roll += Math.sin(t * 61) * 0.012 * sa;
          }
          // (and the light clears to the live scene's on the way down)
          if (t > SETTLE0) {
            const u = ease((t - SETTLE0) / SETTLE);
            st.light = mixC(st.light, 0xa49494, u);
            st.fog.max = 0.75 * (1 - u);
          }
          void SH;
          return pose;
        };
      },
    }).then((r) => {
      // anything the skip cut short: done now (the caller finishes off the rest)
      resolve({ ran: true, skipped: r.skipped || fired < plan.length });
    });
  });
}

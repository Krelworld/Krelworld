import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import {
  type Aim,
  type BoardSpec,
  type Pose,
  type ShotCtx,
  type Sprite3D,
  DEG,
  FOCAL,
  SH,
  SW,
  aimToPose,
  clamp,
  ease,
  easeOut3,
  lerp,
  lookAt,
  mixC,
  playShot,
  snapshotWorld,
  span,
  swoopToLive,
} from "../../gfx/Pseudo3D";

/**
 * The Hub's pseudo-3D moments (see gfx/Pseudo3D.ts), both played over the live town:
 * - riseShot: Chapter 1, Drongus storms out of the meeting and Da Drongus Dungeon comes up out of the ground: a low
 *   orbit round the plot as it cracks, the tower bursting up floor by floor, the camera rising with it, the title,
 *   then up and over onto the live view (where the Hub has drawn the finished tower).
 * - dawnShot: the finale, the morning after: a slow, quiet drift over smoking Krelford to the wreck where the
 *   tower stood, then down onto the lads lying in the rubble (the live view).
 * Both are skippable and free everything they made when they end. Without WebGL they resolve at once and the Hub
 * plays its flat versions.
 */

type Pt = { x: number; y: number };

// ------------------------------------------------------------------------------------------------ the rise

/** Pose between two poses (yaw the short way round). */
function lerpPose(a: Pose, b: Pose, k: number): Pose {
  let dy = b.yaw - a.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), yaw: a.yaw + dy * k, pitch: lerp(a.pitch, b.pitch, k), roll: lerp(a.roll, b.roll, k) };
}

/** Jagged cracks running out from the middle of a w x h texture (the further `reach`, the longer). */
function crackTexture(c: ShotCtx, name: string, reach: number, seed: string) {
  const { st, sc } = c;
  const k = st.key(name);
  const W = 512;
  const H = 320;
  const g = sc.make.graphics({}, false);
  const rnd = new Phaser.Math.RandomDataGenerator([seed]);
  const arms = 9;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + rnd.realInRange(-0.25, 0.25);
    const pts: Pt[] = [{ x: W / 2, y: H / 2 }];
    let x = W / 2;
    let y = H / 2;
    const n = 6;
    for (let s = 0; s < n; s++) {
      const step = ((reach * W) / 2 / n) * rnd.realInRange(0.7, 1.3);
      const aa = a + rnd.realInRange(-0.5, 0.5);
      x += Math.cos(aa) * step;
      y += Math.sin(aa) * step * 0.62;
      pts.push({ x, y });
    }
    // a hot glow in the crack, a black edge round it
    for (const [wd, col, al] of [[9, 0x0a0610, 1], [3, 0xd946ef, 0.9]] as [number, number, number][]) {
      g.lineStyle(wd, col, al);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.strokePath();
    }
  }
  g.generateTexture(k, W, H);
  g.destroy();
  return k;
}

/**
 * Da Drongus Dungeon comes up out of the ground. `tower`: the middle of its base (world); `w`/`h` its size in the
 * Hub; `key` its picture. Ends settled straight down on `end` (the live camera's centre and zoom).
 */
export function riseShot(
  hub: Phaser.Scene,
  o: { worldW: number; worldH: number; tower: Pt; w: number; h: number; key: string; end: { x: number; y: number; zoom: number }; skip?: Phaser.GameObjects.GameObject[]; onCovered?: () => void },
) {
  const T_CRACK = 0.4;
  const T_RISE = 2.7;
  const FLOORS = 7;
  const STEP = 0.74;
  const T_UP = T_RISE + FLOORS * STEP;
  const T_TITLE = T_UP + 0.35;
  const T_SETTLE = T_UP + 2.6;
  const SETTLE = 1.9;
  const length = T_SETTLE + SETTLE;
  const { x: X, y: Y } = o.tower;
  const TW = o.w;
  const TH = o.h;
  return playShot(hub, {
    length,
    fadeIn: 300,
    fadeOut: 420,
    onCovered: o.onCovered,
    build: (c) => {
      const { st, sc, calm } = c;
      st.maxLean = 80;
      // a storm over the town, in the middle of the day
      const mood = { light: 0x9890b4, fog: 0x4a3f62 };
      st.light = mood.light;
      st.fog = { color: mood.fog, start: 1100, span: 6000, max: 0.6 };
      st.setSky({ top: 0x1e1430, horizon: 0x6e5480, below: 0x2a1a36 });
      st.addGround({ x0: -9000, y0: -9000, x1: o.worldW + 9000, y1: o.worldH + 9000, cols: 9, rows: 9, color: 0x24122f, depth: 1 });
      // the cracks, spreading (flat on the ground, under everything standing)
      const cracks = [0.35, 0.65, 1].map((r, i) => crackTexture(c, `crack${i}`, r, `kcrack${i}`));
      const pit = st.key("pit");
      {
        const g = sc.make.graphics({}, false);
        g.fillStyle(0x07040b, 0.95).fillEllipse(128, 64, 250, 120);
        g.fillStyle(0x3a1a40, 0.6).fillEllipse(128, 60, 200, 80);
        g.generateTexture(pit, 256, 128);
        g.destroy();
      }
      const CW = 1100;
      const CH = 520;
      const flats = st.addBoards(
        [
          { key: pit, x: X, y: Y, w: 1, h: 1, flat: [X - TW * 0.75, Y - 90, X + TW * 0.75, Y + 90] },
          ...cracks.map((k, i): BoardSpec => ({ key: k, x: X, y: Y, w: 1, h: 1, flat: [X - (CW / 2) * (0.6 + i * 0.2), Y - (CH / 2) * (0.6 + i * 0.2), X + (CW / 2) * (0.6 + i * 0.2), Y + (CH / 2) * (0.6 + i * 0.2)] })),
        ],
        3,
      );
      for (const f of flats) f.alpha = 0;
      // the tower, stood up with the town's boards (so what's in front of it stays in front of it)
      let tKey = o.key;
      if (!sc.textures.exists(tKey)) {
        tKey = st.key("spike");
        const g = sc.make.graphics({}, false);
        g.fillStyle(0x1c1424, 1).fillRect(20, 60, 88, 196).fillTriangle(10, 64, 118, 64, 64, 0);
        g.fillStyle(0xff2d95, 1).fillRect(56, 120, 16, 24);
        g.generateTexture(tKey, 128, 256);
        g.destroy();
      }
      const tImg = sc.make.image({ x: X, y: Y, key: tKey }, false).setOrigin(0.5, 1).setDisplaySize(TW, TH);
      const snap = snapshotWorld(st, hub, { worldW: o.worldW, worldH: o.worldH, skip: o.skip, extra: [tImg] });
      tImg.destroy();
      const tower = snap.extra[0] ?? st.addBoards([{ key: tKey, x: X, y: Y, w: TW, h: TH }], 3.9)[0];
      tower.cut = 1;
      tower.dz = -TH;
      // rocks and clods, flung up as each floor bursts through
      const rk = st.key("rocks");
      {
        const g = sc.make.graphics({}, false);
        const cols = [0x3a2f28, 0x4a3b2f, 0x2a2433, 0x5a4a3a];
        for (let i = 0; i < 4; i++) {
          g.fillStyle(cols[i], 1);
          g.fillPoints([new Phaser.Math.Vector2(i * 32 + 4, 22), new Phaser.Math.Vector2(i * 32 + 10, 6), new Phaser.Math.Vector2(i * 32 + 22, 3), new Phaser.Math.Vector2(i * 32 + 29, 16), new Phaser.Math.Vector2(i * 32 + 20, 29), new Phaser.Math.Vector2(i * 32 + 8, 29)], true);
          g.fillStyle(0x000000, 0.35).fillRect(i * 32 + 8, 20, 18, 6);
        }
        g.generateTexture(rk, 128, 32);
        g.destroy();
      }
      const rnd = new Phaser.Math.RandomDataGenerator(["krise"]);
      const rocks = st
        .addBoards(
          Array.from({ length: 36 }, (_, i): BoardSpec => {
            const s = rnd.between(14, 34);
            return { key: rk, crop: [(i % 4) * 32, 0, 32, 32], x: X, y: Y, w: s, h: s };
          }),
          4.6,
        )
        .map((b, i) => {
          const a = rnd.realInRange(0, Math.PI * 2);
          const sp = rnd.realInRange(120, 380);
          b.alpha = 0;
          return { b, t0: T_RISE + (i % FLOORS) * STEP + rnd.realInRange(-0.05, 0.15), ox: rnd.realInRange(-TW / 2, TW / 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: rnd.realInRange(220, 520), spin: rnd.realInRange(-7, 7) };
        });
      // dust: a puff ring at the base for every floor, and a big rolling one when it's up
      const dot = st.softDot("dust", 0.55);
      const glow = st.softDot("glow", 0.3);
      const puffs: { s: Sprite3D; t0: number; a: number; r: number; big: boolean }[] = [];
      for (let f = 0; f < FLOORS; f++)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + rnd.realInRange(-0.3, 0.3);
          puffs.push({ s: st.addSprite(dot, X, Y, 0, 160, { tint: rnd.pick([0x6b5a4a, 0x5a5048, 0x786a5c]), alpha: 0 }), t0: T_RISE + f * STEP + 0.05, a, r: rnd.realInRange(TW * 0.3, TW * 0.6), big: false });
        }
      for (let i = 0; i < 18; i++) puffs.push({ s: st.addSprite(dot, X, Y, 0, 260, { tint: 0x6e6258, alpha: 0 }), t0: T_UP - 0.2 + i * 0.03, a: (i / 18) * Math.PI * 2, r: TW * 0.5, big: true });
      // the cracks glow from underneath
      const hot = st.addSprite(glow, X, Y + 10, 20, 700, { add: true, tint: 0xd946ef, alpha: 0, layer: "back" });
      // its eye opens at the end
      const eye = st.addSprite(glow, X, Y + 4, TH * 0.62, 220, { add: true, tint: 0xff2d55, alpha: 0, layer: "front" });
      // heavy cloud
      const clouds = ["fly_cloud_a", "fly_cloud_b", "fly_cloud_c"].filter((k) => sc.textures.exists(k));
      if (clouds.length)
        for (let i = 0; i < 16; i++) {
          const a = rnd.realInRange(-Math.PI * 0.9, Math.PI * 0.9);
          const r = rnd.realInRange(1200, 4200);
          st.addSprite(rnd.pick(clouds), X + Math.sin(a) * r, Y - Math.cos(a) * r, rnd.realInRange(1500, 2300), rnd.realInRange(1100, 2000), { tint: 0x4a3d5e, alpha: 0.85, layer: "back" });
        }
      // lightning: a jagged bolt standing in the sky behind it
      const bk = st.key("bolt");
      {
        const g = sc.make.graphics({}, false);
        let x = 32;
        const pts: Pt[] = [{ x, y: 0 }];
        for (let y = 24; y <= 256; y += 24) pts.push({ x: (x = clamp(x + rnd.between(-14, 14), 6, 58)), y });
        for (const [wd, col] of [[7, 0xc4b5fd], [3, 0xffffff]] as [number, number][]) {
          g.lineStyle(wd, col, 1).beginPath().moveTo(pts[0].x, pts[0].y);
          for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
          g.strokePath();
        }
        g.generateTexture(bk, 64, 256);
        g.destroy();
      }
      const bolts = st.addBoards([0, 1].map((i): BoardSpec => ({ key: bk, x: X + (i ? 520 : -460), y: Y - 900, w: 160, h: 1400, flipX: !!i })), 3.95);
      for (const b of bolts) b.alpha = 0;
      // rain on the glass
      const rain = st.keep(sc.add.graphics().setDepth(20));
      const drops = Array.from({ length: 50 }, () => ({ x: Math.random() * (SW + 200), y: Math.random() * SH, v: 900 + Math.random() * 400 }));
      let flashV = 0;
      let boltT = -1;
      let boltI = 0;
      const strike = (k = 1) => {
        flashV = calm ? 0.3 * k : k;
        boltT = 0.16;
        boltI = (boltI + 1) % bolts.length;
        synth.play("thunder", 0.7);
      };
      // the beats
      const beats: [number, () => void][] = [
        [0.05, () => synth.play("drone", 0.7)],
        [T_CRACK, () => synth.play("smash", 0.5)],
        [T_CRACK + 0.9, () => synth.play("smash", 0.7)],
        [T_CRACK + 1.7, () => (synth.play("boom", 0.6), strike(0.7))],
        ...Array.from({ length: FLOORS }, (_, f): [number, () => void] => [T_RISE + f * STEP, () => (synth.play(f % 2 ? "smash" : "boom", 0.55 + f * 0.05), f === 3 && strike(0.8))]),
        [T_UP, () => (synth.play("boom"), synth.play("explode", 0.7), strike(1))],
        [T_TITLE, () => c.caption("DA DRONGUS DUNGEON", { big: true, color: "#ef4444", hold: 2.0 })],
        [T_TITLE + 0.5, () => c.caption("(population: one Drongus)", { color: "#e9d5ff", hold: 1.7 })],
        [T_SETTLE - 0.3, () => synth.play("fly_whoosh", 0.5)],
      ];
      let bi = 0;
      const shakeK = calm ? 0.3 : 1;
      // the camera: an orbit (degrees round from due south), then up and over onto the live view
      const orbitPose = (t: number, top: number, amp: number): Pose => {
        const a = t < T_RISE ? lerp(150, 118, ease(t / T_RISE)) : lerp(118, 52, ease((t - T_RISE) / (T_SETTLE - T_RISE)));
        const rise = span(t, T_RISE - 0.4, T_UP + 0.8);
        const dist = lerp(430, 700, rise) + 90 * span(t, T_UP, T_SETTLE);
        const z = lerp(50, TH * 0.3, rise);
        const lookZ = Math.max(30, lerp(20, Math.max(top * 0.52, TH * 0.15), rise));
        const jx = (Math.sin(t * 53) + Math.sin(t * 31)) * amp * 0.5;
        const jz = (Math.sin(t * 47 + 1) + Math.sin(t * 29)) * amp * 0.4;
        return lookAt({ x: X + Math.sin(a * DEG) * dist, y: Y + Math.cos(a * DEG) * dist, z }, { x: X + jx, y: Y, z: lookZ + jz }, Math.sin(t * 0.8) * 1.5 + Math.sin(t * 61) * amp * 0.01);
      };
      const end = aimToPose({ x: o.end.x, y: o.end.y, d: FOCAL / o.end.zoom, p: 90, yaw: 0, r: 0 });
      let settleFrom: Pose | null = null;
      return (t, dt) => {
        while (bi < beats.length && beats[bi][0] <= t) beats[bi++][1]();
        // storm
        flashV = Math.max(0, flashV - dt * (calm ? 0.9 : 3.5));
        st.flash = flashV;
        boltT -= dt;
        bolts.forEach((b, i) => (b.alpha = boltT > 0 && i === boltI ? (calm ? 0.6 : 1) : 0));
        rain.clear().lineStyle(1, 0xc7d2fe, 0.3 * (1 - span(t, T_SETTLE, length)));
        for (const d of drops) {
          d.y += d.v * dt;
          d.x -= d.v * 0.2 * dt;
          if (d.y > SH + 20) {
            d.y = -20;
            d.x = Math.random() * (SW + 200);
          }
          rain.lineBetween(d.x, d.y, d.x - 4, d.y - 16);
        }
        // the cracks spread, the pit opens under it
        flats[1].alpha = span(t, T_CRACK, T_CRACK + 0.4);
        flats[2].alpha = span(t, T_CRACK + 0.9, T_CRACK + 1.3);
        flats[3].alpha = span(t, T_CRACK + 1.7, T_CRACK + 2.1);
        flats[0].alpha = span(t, T_RISE - 0.3, T_RISE + 0.3);
        // (and fade off as we come down onto the live town, which has none)
        const gone = 1 - span(t, T_SETTLE - 0.4, T_SETTLE + SETTLE * 0.6);
        for (const f of flats) f.alpha *= gone;
        hot.alpha = 0.5 * span(t, T_CRACK, T_RISE) * (1 - span(t, T_UP, T_UP + 1)) * (0.8 + 0.2 * Math.sin(t * 9));
        // the tower: up a floor at a time, each one a shove (and a little drop back), shuddering in between
        let up = 0;
        for (let f = 0; f < FLOORS; f++) {
          const lt = t - (T_RISE + f * STEP);
          if (lt <= 0) break;
          const k = clamp(lt / 0.36, 0, 1);
          up += (1 - Math.pow(1 - k, 3)) * (1 + 0.08 * Math.sin(Math.PI * k));
        }
        const rumble = t < T_CRACK ? 0.2 : t < T_UP ? 1 : Math.exp(-(t - T_UP) * 1.8);
        tower.dz = -TH + (TH * up) / FLOORS;
        tower.dz = Math.min(0, tower.dz);
        tower.cut = clamp(-tower.dz / TH, 0, 1);
        tower.dx = Math.sin(t * 41) * 3 * rumble * shakeK * (t > T_RISE ? 1 : 0);
        const top = TH + tower.dz;
        eye.z = TH * 0.62 + tower.dz;
        eye.alpha = 0.7 * span(t, T_UP + 0.2, T_UP + 0.8) * (eye.z > 0 ? 1 : 0);
        // debris
        for (const r of rocks) {
          const lt = t - r.t0;
          if (lt < 0) continue;
          r.b.dx = r.ox + r.vx * lt;
          r.b.dy = r.vy * lt;
          r.b.dz = r.vz * lt - 0.5 * 900 * lt * lt;
          r.b.spin = r.spin * lt;
          r.b.alpha = r.b.dz > -10 ? 1 : 0;
        }
        // dust
        for (const p of puffs) {
          const lt = t - p.t0;
          if (lt < 0) continue;
          const life = p.big ? 3.2 : 1.6;
          const k = easeOut3(lt / life);
          const rr = p.r + (p.big ? 520 : 200) * k;
          p.s.x = X + Math.cos(p.a) * rr;
          p.s.y = Y + Math.sin(p.a) * rr * 0.6;
          p.s.z = 15 + (p.big ? 60 : 70) * k;
          p.s.size = (p.big ? 150 : 110) + (p.big ? 220 : 160) * k;
          p.s.alpha = clamp(lt / 0.2, 0, 1) * (p.big ? 0.4 : 0.45) * (1 - span(lt, life * 0.3, life));
        }
        // the shake: a constant grind, and every floor kicks it
        let amp = (t < T_CRACK ? 2 : 6) * (t < T_UP + 1 ? 1 : 0);
        for (let f = 0; f <= FLOORS; f++) {
          const bt = f < FLOORS ? T_RISE + f * STEP : T_UP;
          if (t >= bt) amp += (f < FLOORS ? 16 : 34) * Math.exp(-(t - bt) * 4);
        }
        amp *= shakeK;
        // the light clears to the town's as we come down onto it
        const clear = span(t, T_SETTLE, length);
        st.light = mixC(mood.light, 0xffffff, clear);
        st.fog = { ...st.fog, max: 0.6 * (1 - clear) };
        if (t < T_SETTLE) return orbitPose(t, top, amp);
        settleFrom ??= orbitPose(T_SETTLE, top, 0);
        const k = clamp((t - T_SETTLE) / SETTLE, 0, 1);
        const kk = 1 - Math.pow(1 - k, 3);
        const p = lerpPose(settleFrom, end, kk);
        p.pitch = lerp(settleFrom.pitch, end.pitch, Math.pow(kk, 0.8));
        return p;
      };
    },
  });
}

// ------------------------------------------------------------------------------------------------ the morning after

/**
 * The morning after the Concept: a slow drift over smoking, burnt-out Krelford in daylight, to the heap where Da
 * Drongus Dungeon stood, then down onto the lads in the rubble (`end`: the live camera's centre and zoom). Comes
 * in out of the white-out. `smoke`: the places to stand smoke columns (ruins).
 */
export function dawnShot(hub: Phaser.Scene, o: { worldW: number; worldH: number; wreck: Pt; smoke: Pt[]; end: { x: number; y: number; zoom: number }; skip?: Phaser.GameObjects.GameObject[]; onCovered?: () => void }) {
  const W = o.wreck;
  const keys: [number, Aim][] = [
    [0, { x: 1150, y: 1350, d: 1700, p: 13, yaw: -14, r: 0 }],
    [4.5, { x: 1230, y: 950, d: 1500, p: 16, yaw: -6, r: 0.6 }],
    [8.5, { x: W.x - 20, y: W.y + 160, d: 1150, p: 21, yaw: 4, r: 0 }],
    [11.5, { x: W.x, y: W.y + 40, d: 800, p: 30, yaw: 14, r: -0.5 }],
  ];
  // (filled in by onBuild, run by onFrame)
  let frame: (t: number, dt: number) => void = () => {};
  return swoopToLive(hub, {
    worldW: o.worldW,
    worldH: o.worldH,
    skip: o.skip,
    keys,
    settle: 4.2,
    end: o.end,
    onCovered: o.onCovered,
    shot: { fromBlack: true, veilColor: 0xffffff, fadeIn: 1400, fadeOut: 600 },
    // a pale, hazy morning: warm light, smoke-grey haze
    mood: { light: 0xe8dccb, fog: 0xc9c2bb, apron: 0x5a5448, sky: { top: 0x7894bb, horizon: 0xe9dccb, below: 0x8a8278 } },
    onBuild: (c) => {
      const { st, sc } = c;
      const dot = st.softDot("smoke", 0.5);
      const glow = st.softDot("glow", 0.3);
      const rnd = new Phaser.Math.RandomDataGenerator(["kdawn"]);
      // smoke columns: puffs climbing and leaning off on the wind, forever
      const cols = [...o.smoke, W, { x: W.x - 150, y: W.y + 30 }, { x: W.x + 160, y: W.y + 20 }];
      const N = 7;
      const puffs = cols.flatMap((p, ci) => {
        const big = ci >= o.smoke.length ? 1.5 : 1;
        const tint = rnd.pick([0x3f3b3a, 0x4d4846, 0x5b5552]);
        return Array.from({ length: N }, (_, i) => ({ s: st.addSprite(dot, p.x, p.y, 0, 120, { tint, alpha: 0 }), x: p.x, y: p.y, ph: i / N + rnd.frac() * 0.05, big, rate: rnd.realInRange(0.05, 0.08) }));
      });
      // what's still glowing in the heap
      const embers = Array.from({ length: 7 }, () => st.addSprite(glow, W.x + rnd.realInRange(-200, 200), W.y + rnd.realInRange(-10, 50), rnd.realInRange(10, 60), rnd.realInRange(90, 160), { add: true, tint: 0xff7a2a, alpha: 0.35 }));
      // high, thin cloud, lit by the sun
      const clouds = ["fly_cloud_a", "fly_cloud_b", "fly_cloud_c"].filter((k) => sc.textures.exists(k));
      if (clouds.length)
        for (let i = 0; i < 12; i++) {
          const a = rnd.realInRange(-Math.PI * 0.8, Math.PI * 0.8);
          const r = rnd.realInRange(1500, 4800);
          st.addSprite(rnd.pick(clouds), W.x + Math.sin(a) * r, W.y + 600 - Math.cos(a) * r, rnd.realInRange(1700, 2500), rnd.realInRange(1200, 2100), { tint: 0xf3ead8, alpha: 0.7, layer: "back" });
        }
      // ash, on the glass
      const ash = st.keep(sc.add.graphics().setDepth(20));
      const flakes = Array.from({ length: 34 }, () => ({ x: Math.random() * SW, y: Math.random() * SH, v: 14 + Math.random() * 22, w: Math.random() * 6 }));
      synth.play("fly_wind", 0.35);
      sc.time.delayedCall(1800, () => c.caption("The morning after.", { color: "#f1e7d6", hold: 2.6 }));
      frame = (T, dt) => {
        for (const p of puffs) {
          const u = (p.ph + T * p.rate) % 1;
          const h = 640 * p.big * u;
          p.s.x = p.x + h * 0.45 + Math.sin(u * 6 + p.ph * 9) * 20;
          p.s.y = p.y - h * 0.12;
          p.s.z = 30 + h;
          p.s.size = (110 + 330 * u) * p.big;
          p.s.alpha = 0.55 * clamp(u / 0.12, 0, 1) * (1 - u);
        }
        embers.forEach((e, i) => (e.alpha = 0.22 + 0.12 * Math.sin(T * (1.3 + i * 0.2) + i)));
        ash.clear().fillStyle(0xd8d2c8, 0.7);
        for (const f of flakes) {
          f.y += f.v * dt;
          f.x += (10 + Math.sin(T + f.w) * 8) * dt;
          if (f.y > SH + 4) {
            f.y = -4;
            f.x = Math.random() * SW;
          }
          ash.fillRect(f.x, f.y, 2, 2);
        }
      };
    },
    onFrame: (_c, t, dt) => frame(t, dt),
  });
}

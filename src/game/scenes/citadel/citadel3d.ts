import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { G } from "../../G";
import { PLAYABLE_IDS } from "../../../data/types";
import { playerKey } from "../../gfx/sanmikForm";
import {
  type Aim,
  type Board3D,
  type BoardSpec,
  type Pose,
  type ShotCtx,
  type Sprite3D,
  DEG,
  SH,
  SW,
  clamp,
  ease,
  easeOut3,
  lerp,
  lookAt,
  playShot,
  span,
  swoopToLive,
} from "../../gfx/Pseudo3D";

/**
 * Chapter 7's pseudo-3D moments (see gfx/Pseudo3D.ts): Da Drongus Dungeon seen from outside, in the storm.
 * - arrivalOrbit: the Hub, the first time the lads go in: round the tower and down onto the door (live hand-off).
 * - towerShot("ascent" | "stairs" | "launch"): between floors: up the face of the tower, round its top, and the
 *   cauldron firing you out of the roof.
 * - sanctumSwing: the Inner Sanctum, Drongus on his throne: from behind you, low, up and over onto the live view.
 * - collapseShot: the end of part one: the whole tower coming down in stages, from across town.
 * All are short, skippable, and free everything they made when they end.
 */

/** The tower, in the set: its base is at the origin. */
const TW = 520;
const TH = (TW * 545) / 279;
const IMG_W = 279;
const IMG_H = 545;

/** Krelford around it (hub layout, the tower at the origin), minus the sightline south of the tower. */
const TOWN: [string, number, number, number][] = [
  ["ARCHIVE", 760, 420, 300],
  ["BAN_TRIBUNAL", -780, 380, 280],
  ["PUB", -900, 900, 300],
  ["GYM", 1150, 640, 240],
  ["TOWN_HALL", -520, 1500, 420],
  ["MINISTRY", 760, 1250, 340],
  ["UNIVERSITY", -1200, 1350, 260],
  ["CROBLEY_FACTORY", 560, 2050, 288],
  ["POLICE", -260, 2500, 240],
  ["WILDERN", 1300, 2300, 420],
  ["HOME", -1500, 2100, 260],
  ["ABANDONED", -900, -700, 220],
  ["FIXER_UPPER", 900, -800, 220],
  ["OLD_FLAT", 150, -1300, 200],
  ["BOOTH", -1350, -150, 150],
  ["GYM", 1500, -200, 240],
];

const RAIN = 70;

interface TowerSet {
  /** one board, or the pieces (row 0 = the top) */
  tower: (Board3D & { row?: number; col?: number })[];
  rows: number;
  tick: (t: number, dt: number) => void;
  strike: (k?: number) => void;
  glow: string;
  dot: string;
  /** the tower's window glows (they go with it in the collapse) */
  glows: Sprite3D[];
}

/** Row edges (image px) for cutting the tower into pieces, and how many columns each row splits into. */
const ROWS = [0, 95, 165, 245, 325, 405, 470, 545];
const COLS = [1, 1, 3, 3, 3, 3, 3];

/** Krelford at night in a storm, with Da Drongus Dungeon in the middle of it. `pieces`: the tower is cut up (for the collapse). */
function towerSet(c: ShotCtx, o: { pieces?: boolean; ruinLight?: boolean } = {}): TowerSet {
  const { st, sc, calm } = c;
  st.maxLean = 90;
  st.fog = { color: 0x2c1438, start: 900, span: 5200, max: 0.82 };
  st.light = 0xa496cc;
  st.setSky({ top: 0x06030c, horizon: 0x4c1a3c, below: 0x1a1420, stars: 0 });
  st.addGround({ x0: -14000, y0: -14000, x1: 14000, y1: 14000, cols: 10, rows: 10, color: 0x18141f, depth: 1 });
  // the town's ground: dark streets, a plaza round the tower, lit windows
  const GX0 = -3000;
  const GY0 = -2600;
  const GWW = 6000;
  const GHH = 6000;
  const gk = st.groundTexture("town", 1024, 1024, (dt) => {
    const k = 1024 / GWW;
    const g = sc.make.graphics({}, false);
    g.fillStyle(0x1b1822, 1).fillRect(0, 0, 1024, 1024);
    const X = (x: number) => (x - GX0) * k;
    const Y = (y: number) => (y - GY0) * k;
    g.fillStyle(0x2e2836, 1);
    for (const y of [700, 1700, 2600, -900]) g.fillRect(0, Y(y) - 45 * k, 1024, 90 * k);
    for (const x of [-1600, 0, 1600]) g.fillRect(X(x) - 45 * k, x === 0 ? Y(400) : 0, 90 * k, 1024);
    g.fillStyle(0x3a3240, 1).fillCircle(X(0), Y(0), 520 * k);
    g.fillStyle(0x241d2a, 1).fillCircle(X(0), Y(0), 380 * k);
    // scorched / grass patches
    const rnd = new Phaser.Math.RandomDataGenerator(["ktown"]);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(rnd.pick([0x1f2a1e, 0x221a24, 0x2a2018]), 0.8);
      g.fillCircle(rnd.between(0, 1024), rnd.between(0, 1024), rnd.between(6, 30));
    }
    dt.draw(g);
    g.destroy();
  });
  st.addGround({ key: gk, rt: true, x0: GX0, y0: GY0, x1: GX0 + GWW, y1: GY0 + GHH, cols: 16, rows: 16, depth: 1.5 });
  // the buildings, and the tower
  const specs: BoardSpec[] = [];
  for (const [id, x, y, w] of TOWN) {
    const key = sc.textures.exists(`bld_${id}`) ? `bld_${id}` : null;
    if (!key) continue;
    const src = sc.textures.get(key).getSourceImage();
    specs.push({ key, x, y, w, h: (w * src.height) / src.width, flipX: x < -1000 });
  }
  const nTown = specs.length;
  const towerKey = sc.textures.exists("bld_CITADEL") ? "bld_CITADEL" : null;
  const pieceInfo: { row: number; col: number }[] = [];
  if (towerKey) {
    const k = TW / IMG_W;
    if (!o.pieces) specs.push({ key: towerKey, x: 0, y: 0, w: TW, h: TH });
    else
      for (let r = 0; r < ROWS.length - 1; r++) {
        const n = COLS[r];
        for (let col = 0; col < n; col++) {
          const cx = n === 1 ? 0 : Math.round((IMG_W * col) / n);
          const cx1 = n === 1 ? IMG_W : Math.round((IMG_W * (col + 1)) / n);
          const cy = ROWS[r];
          // a pixel of overlap so the seams don't show
          const cw = Math.min(IMG_W - cx, cx1 - cx + 1);
          const ch = Math.min(IMG_H - cy, ROWS[r + 1] - cy + 1);
          specs.push({ key: towerKey, crop: [cx, cy, cw, ch], x: 0, y: 0, w: cw * k, h: ch * k, z: (IMG_H - (cy + ch)) * k, ox: (cx + cw / 2 - IMG_W / 2) * k });
          pieceInfo.push({ row: r, col });
        }
      }
  }
  const boards = st.addBoards(specs);
  const tower: TowerSet["tower"] = boards.slice(nTown).map((b, i) => Object.assign(b, pieceInfo[i] ?? {}));
  if (!towerKey) {
    // no art: a black spike of a tower, drawn
    const k = st.key("spike");
    const g = sc.make.graphics({}, false);
    g.fillStyle(0x1c1424, 1).fillRect(20, 60, 88, 196).fillTriangle(10, 64, 118, 64, 64, 0);
    g.fillStyle(0xff2d95, 1).fillRect(56, 120, 16, 24);
    g.generateTexture(k, 128, 256);
    g.destroy();
    tower.push(...st.addBoards([{ key: k, x: 0, y: 0, w: TW, h: TH }]));
  }
  // glows: the tower's windows, street lamps, fires in town
  const glow = st.softDot("glow", 0.3);
  const dot = st.softDot("dust", 0.55);
  const glows = ([[-60, TH * 0.62, 0xd946ef], [70, TH * 0.6, 0xd946ef], [0, TH * 0.78, 0xff4fd8], [-30, TH * 0.4, 0xff7a1a], [0, 40, 0xff4fa3]] as [number, number, number][]).map(([x, z, col]) =>
    st.addSprite(glow, x, 2, z, 150, { add: true, tint: col, alpha: 0.55, layer: "front" }),
  );
  for (const y of [700, 1700, 2600])
    for (let x = -2600; x <= 2600; x += 520) st.addSprite(glow, x + 60, y + 60, 30, 110, { add: true, tint: 0xffb35c, alpha: 0.45 });
  // storm clouds, low and heavy
  const clouds = ["fly_cloud_a", "fly_cloud_b", "fly_cloud_c"].filter((k) => sc.textures.exists(k));
  const rnd = new Phaser.Math.RandomDataGenerator(["kstorm"]);
  if (clouds.length)
    for (let i = 0; i < 22; i++) {
      const a = rnd.realInRange(0, Math.PI * 2);
      const r = rnd.realInRange(900, 4200);
      st.addSprite(rnd.pick(clouds), Math.sin(a) * r, -Math.cos(a) * r, rnd.realInRange(1900, 2700), rnd.realInRange(1100, 2000), { tint: 0x3b2a52, alpha: 0.85, layer: "back" });
    }
  // rain, on the glass
  const rain = st.keep(sc.add.graphics().setDepth(20));
  const drops = Array.from({ length: RAIN }, () => ({ x: Math.random() * (SW + 200), y: Math.random() * SH, v: 900 + Math.random() * 500 }));
  let flashV = 0;
  const strike = (k = 1) => {
    flashV = calm ? 0.35 * k : k;
    synth.play("thunder", 0.7);
  };
  const tick = (_t: number, dt: number) => {
    flashV = Math.max(0, flashV - dt * (calm ? 0.9 : 3.5));
    st.flash = flashV;
    rain.clear().lineStyle(1, 0xc7d2fe, 0.32);
    for (const d of drops) {
      d.y += d.v * dt;
      d.x -= d.v * 0.22 * dt;
      if (d.y > SH + 20) {
        d.y = -20;
        d.x = Math.random() * (SW + 200);
      }
      rain.lineBetween(d.x, d.y, d.x - 4, d.y - 16);
    }
  };
  return { tower, rows: ROWS.length - 1, tick, strike, glow, dot, glows };
}

/** A camera orbiting the tower: angle `a` degrees round from due south, `dist` out, `z` up, looking at height `lookZ`. */
const orbit = (a: number, dist: number, z: number, lookZ: number, roll = 0, jx = 0, jz = 0): Pose =>
  lookAt({ x: Math.sin(a * DEG) * dist, y: Math.cos(a * DEG) * dist, z }, { x: jx, y: 0, z: lookZ + jz }, roll);

// ------------------------------------------------------------------------------------------------ between floors

/**
 * A short look at the tower from outside, between floors. "ascent": up the face of the tower from the street;
 * "stairs": round the top in the storm; "launch": the cauldron fires you out of the roof (ends on black, held for the
 * room change).
 */
export function towerShot(sc: Phaser.Scene, kind: "ascent" | "stairs" | "launch", title?: string) {
  const length = kind === "launch" ? 3.6 : 4.4;
  return playShot(sc, {
    length,
    fromBlack: kind !== "launch",
    fadeIn: kind === "launch" ? 260 : 500,
    toBlack: kind === "launch" ? "hold" : undefined,
    fadeOut: 450,
    build: (c) => {
      const set = towerSet(c);
      if (title) c.st.sc.time.delayedCall(500, () => c.caption(title, { hold: 2.4 }));
      synth.play("fly_wind", 0.6);
      if (kind === "ascent") {
        c.st.sc.time.delayedCall(1700, () => set.strike(0.8));
        return (t, dt) => {
          set.tick(t, dt);
          const u = ease(t / length);
          return orbit(lerp(-34, 18, u), lerp(1250, 900, u), lerp(40, TH * 0.62, u), lerp(TH * 0.25, TH * 0.72, u), Math.sin(t * 0.8) * 2);
        };
      }
      if (kind === "stairs") {
        c.st.sc.time.delayedCall(900, () => set.strike(1));
        c.st.sc.time.delayedCall(3300, () => set.strike(0.6));
        return (t, dt) => {
          set.tick(t, dt);
          const u = ease(t / length);
          return orbit(lerp(40, 170, u), lerp(1050, 820, u), lerp(TH * 0.7, TH * 1.08, u), lerp(TH * 0.66, TH * 0.86, u), lerp(-4, 3, u));
        };
      }
      // the launch: a gold streak out of the roof, the camera tipping up after it
      const { st } = c;
      const streak = st.addSprite(set.glow, 0, 0, TH * 0.9, 220, { add: true, tint: 0xffd23f, alpha: 0, layer: "front" });
      const trail: Sprite3D[] = Array.from({ length: 14 }, () => st.addSprite(set.glow, 0, 0, TH, 120, { add: true, tint: 0xfff3b0, alpha: 0, layer: "front" }));
      const pk = playerKey(sc);
      const rider = sc.textures.exists(pk) ? st.addSprite(pk, 0, 0, TH, 70, { frame: 0, alpha: 0, layer: "front", lit: false }) : null;
      const T0 = 0.8;
      let launched = false;
      return (t, dt) => {
        set.tick(t, dt);
        if (t >= T0 && !launched) {
          launched = true;
          synth.play("jet");
          synth.play("boom", 0.7);
          set.strike(0.6);
        }
        const lt = Math.max(0, t - T0);
        const z = TH * 0.95 + 260 * lt * lt + 300 * lt;
        streak.z = z;
        streak.alpha = t < T0 ? 0 : 1;
        streak.size = 220 + 60 * Math.sin(t * 30);
        trail.forEach((p, i) => {
          p.z = Math.max(TH * 0.95, z - i * 70);
          p.x = Math.sin(t * 9 + i) * 10;
          p.alpha = t < T0 ? 0 : 0.6 * (1 - i / trail.length);
        });
        if (rider) {
          rider.z = z - 20;
          rider.alpha = t < T0 ? 0 : 1;
          rider.spin = lt * 6;
        }
        const u = ease(t / length);
        const look = Math.max(TH * 0.8, lerp(TH * 0.8, z, clamp(lt / 0.8, 0, 1)));
        return orbit(lerp(16, 30, u), lerp(1500, 1250, u), lerp(TH * 0.35, TH * 0.75, u), look, Math.sin(t * 2) * (t > T0 ? 3 : 1));
      };
    },
  });
}

// ------------------------------------------------------------------------------------------------ the arrival (Hub)

/**
 * Chapter 7, the first time the lads go in: round Da Drongus Dungeon in the storm and down onto its door, handing
 * back to the live camera (`end`: its centre and zoom). The Hub snapshot is the flyover's.
 */
export function arrivalOrbit(hub: Phaser.Scene, o: { worldW: number; worldH: number; tower: { x: number; y: number }; end: { x: number; y: number; zoom: number }; skip?: Phaser.GameObjects.GameObject[]; onCovered?: () => void }) {
  const { x, y } = o.tower;
  const keys: [number, Aim][] = [
    [0, { x, y: y + 60, d: 2300, p: 5, yaw: -38, r: 0 }],
    [2.2, { x, y: y + 40, d: 1500, p: 9, yaw: -4, r: -2 }],
    [4.2, { x, y: y + 60, d: 1050, p: 18, yaw: 36, r: 2 }],
  ];
  const strikes = [0.7, 2.9];
  let si = 0;
  return swoopToLive(hub, {
    worldW: o.worldW,
    worldH: o.worldH,
    skip: o.skip,
    keys,
    settle: 2.0,
    end: o.end,
    onCovered: o.onCovered,
    mood: { light: 0x8e84b8, fog: 0x2c1438, apron: 0x221a2c, sky: { top: 0x06030c, horizon: 0x4c1a3c, below: 0x1a1420 } },
    onBuild: (c) => {
      c.sc.time.delayedCall(600, () => c.caption("DA DRONGUS DUNGEON", { big: true, color: "#ff9ab0", hold: 2.2 }));
      synth.play("fly_wind", 0.6);
    },
    onFrame: (c, t, dt) => {
      if (si < strikes.length && t >= strikes[si]) {
        si++;
        c.st.flash = c.calm ? 0.35 : 1;
        synth.play("thunder", 0.7);
      }
      c.st.flash = Math.max(0, c.st.flash - dt * (c.calm ? 0.9 : 3.5));
    },
  });
}

// ------------------------------------------------------------------------------------------------ the Inner Sanctum

/**
 * The Inner Sanctum, before phase one: low behind you, looking up the carpet at him on the throne; then up and over
 * onto the live camera. (The room is top-down: it's snapshotted, he and you stand up out of it.)
 */
export function sanctumSwing(sc: Phaser.Scene, o: { worldW: number; worldH: number; you: { x: number; y: number }; him: { x: number; y: number }; end: { x: number; y: number; zoom: number }; skip?: Phaser.GameObjects.GameObject[] }) {
  const mx = (o.you.x + o.him.x) / 2;
  const my = (o.you.y + o.him.y) / 2;
  const keys: [number, Aim][] = [
    [0, { x: o.him.x, y: o.him.y + 40, d: 520, p: 6, yaw: 0, r: 0 }],
    [1.6, { x: o.him.x, y: o.him.y + 40, d: 380, p: 10, yaw: 14, r: -2 }],
    [3.0, { x: mx, y: my, d: 760, p: 30, yaw: -30, r: 2 }],
  ];
  return swoopToLive(sc, {
    worldW: o.worldW,
    worldH: o.worldH,
    skip: o.skip,
    keys,
    settle: 1.6,
    end: o.end,
    mood: { light: 0xd8b0c8, fog: 0x2a0812, apron: 0x120a16, sky: { top: 0x05020a, horizon: 0x3a0a1c } },
    onBuild: (c) => {
      synth.play("drone", 0.6);
      c.sc.time.delayedCall(1400, () => synth.play("fly_whoosh", 0.6));
    },
  });
}

// ------------------------------------------------------------------------------------------------ the collapse

/**
 * Da Drongus Dungeon comes down, from across town, in stages: it shudders, the spire shears off and topples, the
 * middle floors drop (the lads riding the wreckage), the base crumbles into a wall of dust.
 */
export function collapseShot(sc: Phaser.Scene) {
  const length = 9.6;
  const T_SHEAR = 2.2;
  const T_MID = 4.2;
  const T_BASE = 6.0;
  const g = 520;
  return playShot(sc, {
    length,
    fadeIn: 300,
    fadeOut: 500,
    build: (c) => {
      const { st, calm } = c;
      const set = towerSet(c, { pieces: true });
      const pieces = set.tower;
      // when each piece goes
      const rnd = new Phaser.Math.RandomDataGenerator(["kfall"]);
      const plan = pieces.map((b) => {
        const r = b.row ?? 0;
        const col = b.col ?? 0;
        const kind = r <= 1 ? "spire" : r <= 4 ? "mid" : "base";
        const start = kind === "spire" ? T_SHEAR + r * 0.12 : kind === "mid" ? T_MID + (4 - r) * 0.14 + col * 0.08 : T_BASE + (6 - r) * 0.35 + col * 0.12;
        return { b, r, col, kind, start, side: col === 0 ? -1 : col === 2 ? 1 : rnd.pick([-1, 1]), ph: rnd.frac() * 6, spin: rnd.realInRange(-0.6, 0.6) };
      });
      // the lads, riding the top of the middle floors down
      const ids = [G.s.player, ...PLAYABLE_IDS.filter((id) => id !== G.s.player)].slice(0, 5);
      const ladSpecs: BoardSpec[] = ids.map((id, i) => {
        const key = id === G.s.player ? playerKey(sc) : sc.textures.exists(`spr_${id}`) ? `spr_${id}` : "spr_FLENKY";
        return { key, frame: 0, x: 0, y: 0, w: 64, h: 86, ox: -120 + i * 60, z: TH * (1 - ROWS[2] / IMG_H) };
      });
      const lads = st.addBoards(ladSpecs.filter((s) => sc.textures.exists(s.key)), 4.5);
      // debris: bits of the tower, flung off at each stage
      const tk = sc.textures.exists("bld_CITADEL") ? "bld_CITADEL" : null;
      const bitSpecs: BoardSpec[] = [];
      if (tk)
        for (let i = 0; i < 30; i++) {
          const w = rnd.between(14, 34);
          const h = rnd.between(14, 34);
          bitSpecs.push({ key: tk, crop: [rnd.between(40, IMG_W - 60), rnd.between(120, IMG_H - 60), w, h], x: 0, y: 0, w: w * 1.9, h: h * 1.9 });
        }
      const bits = st.addBoards(bitSpecs, 4.6).map((b, i) => {
        b.alpha = 0;
        const stage = i % 3;
        const t0 = [T_SHEAR, T_MID, T_BASE][stage] + rnd.frac() * 0.8;
        const a = rnd.realInRange(0, Math.PI * 2);
        return { b, t0, z0: [TH * 0.8, TH * 0.55, TH * 0.18][stage], vx: Math.cos(a) * rnd.realInRange(140, 420), vy: Math.sin(a) * rnd.realInRange(140, 420) * 0.6, vz: rnd.realInRange(60, 260), sp: rnd.realInRange(-5, 5) };
      });
      // dust: puffs where pieces break, and the wall of it rolling out from the base
      const puffs = Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2 + rnd.realInRange(-0.2, 0.2);
        const r = rnd.realInRange(60, 380);
        const s = st.addSprite(set.dot, Math.cos(a) * r, Math.sin(a) * r * 0.6, rnd.realInRange(20, 160), 300, { tint: 0x6e6274, alpha: 0 });
        return { s, a, r, t0: i < 8 ? T_MID + 0.3 + i * 0.12 : T_BASE + (i - 8) * 0.09, grow: rnd.realInRange(1.6, 2.6) };
      });
      const breakPuffs = Array.from({ length: 10 }, (_, i) => ({
        s: st.addSprite(set.dot, 0, 0, 0, 200, { tint: 0x8a7f8e, alpha: 0 }),
        t0: i < 4 ? T_SHEAR + i * 0.1 : T_MID + (i - 4) * 0.12,
        z: i < 4 ? TH * (1 - ROWS[2] / IMG_H) : TH * (1 - ROWS[5] / IMG_H) + (i % 3) * 60,
        x: (i % 3) * 110 - 110,
      }));
      // the beats
      const beats: [number, () => void][] = [
        [0.1, () => synth.play("drone", 0.8)],
        [0.5, () => set.strike(0.9)],
        [1.2, () => synth.play("smash", 0.5)],
        [T_SHEAR - 0.1, () => (synth.play("boom", 0.9), synth.play("smash", 0.8))],
        [T_SHEAR + 0.5, () => synth.play("fly_whoosh", 0.7)],
        [T_MID - 0.4, () => set.strike(0.7)],
        [T_MID, () => (synth.play("boom"), synth.play("explode", 0.8))],
        [T_MID + 0.4, () => synth.play("smash", 0.9)],
        [T_MID + 0.9, () => synth.play("smash", 0.7)],
        [T_BASE, () => (synth.play("boom"), synth.play("explode"))],
        [T_BASE + 0.6, () => synth.play("smash", 0.8)],
        [T_BASE + 1.4, () => synth.play("thunder", 0.8)],
        [8.0, () => set.strike(0.6)],
      ];
      let bi = 0;
      const booms = [T_SHEAR, T_MID, T_BASE];
      const glowPlan = set.glows.map((gl) => ({ gl, z0: gl.z, t0: gl.z > TH * 0.7 ? T_SHEAR : gl.z > TH * 0.3 ? T_MID : T_BASE }));
      const shakeK = calm ? 0.3 : 1;
      return (t, dt) => {
        while (bi < beats.length && beats[bi][0] <= t) beats[bi++][1]();
        set.tick(t, dt);
        // the rumble: builds up to the first break, and every stage kicks it again
        let amp = 3 + 9 * span(t, 0, T_SHEAR);
        for (const b of booms) if (t >= b) amp += 40 * Math.exp(-(t - b) * 2.6);
        amp *= shakeK;
        // the pieces
        for (const p of plan) {
          const b = p.b;
          const lt = t - p.start;
          if (lt < 0) {
            // shuddering (more as its moment comes)
            const k = clamp(1 - -lt / 2.5, 0.15, 1);
            b.dx = Math.sin(t * 38 + p.ph) * 4 * k * (t > 0.6 ? 1 : 0.4);
            b.dz = 0;
            continue;
          }
          if (p.kind === "spire") {
            // shears off, leans out, then drops away (the camera's right)
            b.tiltYaw = Math.PI / 2;
            b.tilt = Math.min(1.9, 1.5 * Math.pow(lt / 1.4, 2));
            const fall = Math.max(0, lt - 0.7);
            b.dx = 90 * lt + 160 * fall;
            b.dz = -0.5 * g * fall * fall;
            b.spin = 0;
          } else if (p.kind === "mid") {
            // the floors drop, splaying apart
            b.dz = -0.5 * g * lt * lt;
            b.dx = p.side * 70 * lt * lt;
            b.tiltYaw = p.side > 0 ? Math.PI / 2 : -Math.PI / 2;
            b.tilt = Math.min(1.2, 0.35 * lt * lt);
            b.spin = p.spin * lt * 0.4;
          } else {
            // the base crumbles into itself
            b.dz = -0.5 * g * 0.55 * lt * lt;
            b.dx = p.side * 25 * lt;
            b.tiltYaw = p.side > 0 ? Math.PI / 2 : -Math.PI / 2;
            b.tilt = Math.min(0.7, 0.25 * lt * lt);
          }
          // gone into the ground (and the dust)
          const top = b.z + b.dz + b.h;
          b.alpha = clamp((top + 60) / 160, 0, 1);
        }
        // the windows' glows drop with their floors and go out
        glowPlan.forEach(({ gl, z0, t0 }, i) => {
          const lt = Math.max(0, t - t0);
          gl.z = z0 - 0.5 * g * lt * lt;
          gl.alpha = 0.55 * clamp(1 - lt / 0.9, 0, 1) * (t > t0 - 0.6 && t < t0 ? 0.6 + 0.4 * Math.sin(t * 40 + i) : 1);
        });
        // the lads ride the middle floors down
        const mt = Math.max(0, t - (T_MID + 0.1));
        lads.forEach((l, i) => {
          l.dz = -0.5 * g * 0.92 * mt * mt + Math.abs(Math.sin(t * 7 + i)) * 10;
          l.dx = (i - 2) * 30 * mt * mt + (t < T_MID ? Math.sin(t * 38 + i) * 3 : 0);
          l.spin = Math.sin(t * 5 + i) * 0.25;
          l.alpha = clamp((l.z + l.dz + 200) / 200, 0, 1);
        });
        // debris
        for (const d of bits) {
          const lt = t - d.t0;
          if (lt < 0) continue;
          d.b.dx = d.vx * lt;
          d.b.dy = d.vy * lt;
          d.b.z = 0;
          d.b.dz = d.z0 + d.vz * lt - 0.5 * g * 1.2 * lt * lt;
          d.b.spin = d.sp * lt;
          d.b.alpha = d.b.dz > -30 ? 1 : 0;
        }
        // dust
        for (const p of puffs) {
          const lt = t - p.t0;
          if (lt < 0) continue;
          const k = easeOut3(lt / 2.6);
          const rr = p.r + 620 * k;
          p.s.x = Math.cos(p.a) * rr;
          p.s.y = Math.sin(p.a) * rr * 0.6;
          p.s.z = 40 + 120 * k;
          p.s.size = 240 + 300 * p.grow * k;
          // it rolls out, then thins as it settles
          p.s.alpha = clamp(lt / 0.5, 0, 1) * 0.62 * (1 - 0.5 * span(lt, 2, 3.6));
        }
        for (const p of breakPuffs) {
          const lt = t - p.t0;
          if (lt < 0 || lt > 3) {
            p.s.alpha = 0;
            continue;
          }
          p.s.x = p.x + lt * 30;
          p.s.z = p.z - lt * 60;
          p.s.size = 200 + lt * 260;
          p.s.alpha = 0.7 * (1 - lt / 3);
        }
        // the camera: close and low under it (the whole tower filling the frame), then pulling back as it goes
        const back = span(t, T_SHEAR - 0.2, T_BASE + 1.2);
        const a = lerp(-10, 12, ease(t / length));
        const dist = lerp(1150, 1950, back) + 150 * span(t, T_BASE + 1.2, length);
        const z = lerp(120, 320, back);
        const lookZ = lerp(TH * 0.58, TH * 0.22, span(t, T_SHEAR + 0.4, T_BASE + 1.6));
        const jx = (Math.sin(t * 53) + Math.sin(t * 31)) * amp * 0.5;
        const jz = (Math.sin(t * 47 + 1) + Math.sin(t * 29)) * amp * 0.4;
        return orbit(a, dist, z, lookZ, Math.sin(t * 0.9) * 1.5 + Math.sin(t * 61) * amp * 0.012, jx, jz);
      };
    },
  });
}


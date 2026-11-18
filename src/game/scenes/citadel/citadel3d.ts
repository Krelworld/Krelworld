import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { G } from "../../G";
import { PLAYABLE_IDS } from "../../../data/types";
import { playerKey } from "../../gfx/sanmikForm";
import { charMeta } from "../../gfx/HD";
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
  can3d,
  mixC,
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

/** The launch's tower: drawn TK world px per image px, cut at image row CUT_Y (the main block's top: the roof, at RZ). */
const TK = 4;
const CUT_Y = 146;
const BODY_CX = 137;
const RZ = (IMG_H - CUT_Y) * TK;

/** Row edges (image px) for cutting the tower into pieces, and how many columns each row splits into. */
const ROWS = [0, 95, 165, 245, 325, 405, 470, 545];
const COLS = [1, 1, 3, 3, 3, 3, 3];

/** Krelford at night in a storm, with Da Drongus Dungeon in the middle of it. `pieces`: the tower is cut up (for the collapse). */
function towerSet(c: ShotCtx, o: { pieces?: boolean; ruinLight?: boolean; top?: boolean } = {}): TowerSet {
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
    // `top`: the launch's bigger tower, cut off at the main block's top (the roof sits there), standing upright
    if (o.top) specs.push({ key: towerKey, crop: [0, CUT_Y, IMG_W, IMG_H - CUT_Y], x: 0, y: 0, w: IMG_W * TK, h: RZ, ox: (IMG_W / 2 - BODY_CX) * TK, face: 0 });
    else if (!o.pieces) specs.push({ key: towerKey, x: 0, y: 0, w: TW, h: TH });
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
    tower.push(...st.addBoards([o.top ? { key: k, crop: [0, 64, 128, 192], x: 0, y: 0, w: TW, h: RZ, face: 0 } : { key: k, x: 0, y: 0, w: TW, h: TH }]));
  }
  // glows: the tower's windows, street lamps, fires in town
  const glow = st.softDot("glow", 0.3);
  const dot = st.softDot("dust", 0.55);
  const glows = ((o.top ? [] : [[-60, TH * 0.62, 0xd946ef], [70, TH * 0.6, 0xd946ef], [0, TH * 0.78, 0xff4fd8], [-30, TH * 0.4, 0xff7a1a], [0, 40, 0xff4fa3]]) as [number, number, number][]).map(([x, z, col]) =>
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
  if (kind === "launch") return launchShot(sc);
  const length = 4.4;
  return playShot(sc, {
    length,
    fromBlack: true,
    fadeIn: 500,
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
      // "stairs"
      c.st.sc.time.delayedCall(900, () => set.strike(1));
      c.st.sc.time.delayedCall(3300, () => set.strike(0.6));
      return (t, dt) => {
        set.tick(t, dt);
        const u = ease(t / length);
        return orbit(lerp(40, 170, u), lerp(1050, 820, u), lerp(TH * 0.7, TH * 1.08, u), lerp(TH * 0.66, TH * 0.86, u), lerp(-4, 3, u));
      };
    },
  });
}

// ------------------------------------------------------------------------------------------------ the launch

/** The roof's art (RoofArena loads it with its room; the launch wants it a room early). Resolves once it's in, or after 1.5s. */
const ROOF_ART: Record<string, string> = { fr_roof_floor: "art/tiles/fr_roof_floor.png", fr_binding: "art/props/fr_binding.png" };
function ensureRoofArt(sc: Phaser.Scene): Promise<void> {
  const want = Object.keys(ROOF_ART).filter((k) => !sc.textures.exists(k));
  if (!want.length || !sc.sys.isActive()) return Promise.resolve();
  return new Promise((res) => {
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      res();
    };
    for (const k of want) sc.load.image(k, ROOF_ART[k]);
    sc.load.once(Phaser.Loader.Events.COMPLETE, fin);
    sc.time.delayedCall(1500, fin);
    sc.load.start();
  });
}

/** The roof (world px): its radius; the launch's beats (s); the arc you fly; where you land (as the roof room puts you). */
const RR = 230;
const T_ERUPT = 1.5;
const FLIGHT = 3.7;
const T_LAND = T_ERUPT + FLIGHT;
const APEX = 950;
const GRAV = (8 * APEX) / (FLIGHT * FLIGHT);
const V0 = (GRAV * FLIGHT) / 2;
const LAND = { x: 0, y: RR * 0.5 };
const RIDER_W = 110;

/** Turn an upright board (a fixed-facing one) square to the camera, about its own vertical axis (it stays bolt upright). */
const faceTo = (b: Board3D, ex: number, ey: number) => {
  b.face = Math.atan2(b.x + b.dx - ex, -(b.y + b.dy - ey));
};

/** Catmull-Rom through timed points (seconds), eased out of the first and into the last (as camPath). */
function pathAt(keys: [number, number, number, number][], t: number) {
  const n = keys.length;
  if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2], z: keys[0][3] };
  if (t >= keys[n - 1][0]) return { x: keys[n - 1][1], y: keys[n - 1][2], z: keys[n - 1][3] };
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  let u = clamp((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), 0, 1);
  if (i === 0) u = u * u * (2 - u);
  if (i === n - 2) u = 1 - (1 - u) * (1 - u) * (1 + u);
  const k = (i + u) / (n - 1);
  const cr = (j: number) => Phaser.Math.Interpolation.CatmullRom(keys.map((e) => e[j]), k);
  return { x: cr(1), y: cr(2), z: cr(3) };
}

/** The camera's eye, and where it looks when it isn't following you. */
const EYE: [number, number, number, number][] = [
  [0, -440, 580, RZ + 210],
  [T_ERUPT, -330, 470, RZ + 150],
  [2.5, -300, 420, RZ + 80],
  [3.4, -160, 560, RZ + 260],
  [4.3, 600, 300, RZ + 420],
  [T_LAND, 380, 520, RZ + 520],
  [6.8, 0, 400, RZ + 720],
];
const LOOK: [number, number, number, number][] = [
  [0, 0, 0, RZ + 40],
  [T_ERUPT, 0, 0, RZ + 60],
  [3.4, 0, 0, RZ + 700],
  [T_LAND, LAND.x, LAND.y, RZ + 40],
  [6.8, 0, 40, RZ],
];

/**
 * The cauldron fires you out of the roof: the top of Da Drongus Dungeon in the storm (its spire, the parapet, the
 * round roof with the other lads clamped round its rim, Krelford far below). The roof bulges and glows, a gold geyser
 * bursts up through it with you riding it, spinning, up past the camera's tilt into the clouds; then you arc over and
 * come down on the roof (a ring of dust, a shake) and it holds on the roof for the room change (ends on black).
 */
async function launchShot(sc: Phaser.Scene) {
  if (!can3d(sc)) return { skipped: true };
  await ensureRoofArt(sc);
  const length = 6.8;
  return playShot(sc, {
    length,
    fadeIn: 260,
    toBlack: "hold",
    fadeOut: 450,
    build: (c) => {
      const { st, calm } = c;
      const S = c.sc;
      const set = towerSet(c, { top: true });
      st.fog = { ...st.fog, start: 1400 };
      st.light = 0xc4b8e8;
      const rnd = new Phaser.Math.RandomDataGenerator(["klaunch"]);
      // ---- the roof: its floor art cut into tiles (they bulge, and the middle ones jump when it goes)
      let floorKey = "fr_roof_floor";
      if (!S.textures.exists(floorKey)) {
        floorKey = st.key("roof");
        const g = S.make.graphics({}, false);
        g.fillStyle(0x1b1424, 1).fillCircle(160, 160, 160);
        for (let i = 0; i < 5; i++) g.lineStyle(3, i % 2 ? 0x2c2238 : 0x7a1530, 1).strokeCircle(160, 160, 30 + i * 30);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          g.lineStyle(2, 0x2c2238, 1).lineBetween(160 + Math.cos(a) * 30, 160 + Math.sin(a) * 30, 160 + Math.cos(a) * 150, 160 + Math.sin(a) * 150);
        }
        g.generateTexture(floorKey, 320, 320);
        g.destroy();
      }
      const FW = S.textures.get(floorKey).getSourceImage().width;
      const N = 8;
      const cell = FW / N;
      const tw = (2 * RR) / N;
      const tileSpecs: BoardSpec[] = [];
      const tileR: number[] = [];
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const x0 = -RR + i * tw;
          const y0 = -RR + j * tw;
          const nx = clamp(0, x0, x0 + tw);
          const ny = clamp(0, y0, y0 + tw);
          if (Math.hypot(nx, ny) > RR) continue;
          tileSpecs.push({ key: floorKey, crop: [Math.round(i * cell), Math.round(j * cell), Math.round(cell), Math.round(cell)], x: x0 + tw / 2, y: y0 + tw / 2, w: tw, h: tw, flat: [x0, y0, x0 + tw + 0.6, y0 + tw + 0.6] });
          tileR.push(Math.hypot(x0 + tw / 2, y0 + tw / 2));
        }
      const tiles = st.addBoards(tileSpecs, 4.4);
      // ---- what stands on it: the spire (at the back), the parapet, the lads in their frames, and you
      const mk = st.key("merlon");
      {
        const g = S.make.graphics({}, false);
        g.fillStyle(0x2a2233, 1).fillRect(0, 22, 64, 26).fillRect(16, 0, 32, 24);
        g.fillStyle(0x463b54, 1).fillRect(0, 22, 16, 3).fillRect(48, 22, 16, 3).fillRect(16, 0, 32, 3);
        g.fillStyle(0x1a1422, 1).fillRect(0, 34, 64, 1).fillRect(31, 25, 1, 9).fillRect(10, 35, 1, 13).fillRect(52, 35, 1, 13);
        g.fillStyle(0xff2d55, 0.85).fillRect(0, 42, 64, 2);
        g.generateTexture(mk, 64, 48);
        g.destroy();
      }
      const up: BoardSpec[] = [];
      const towerKey = S.textures.exists("bld_CITADEL") ? "bld_CITADEL" : null;
      const spireAt = up.length;
      if (towerKey) up.push({ key: towerKey, crop: [90, 0, 66, CUT_Y], x: 0, y: -RR - 10, w: 66 * 3.2, h: CUT_Y * 3.2, z: RZ - 40, face: 0 });
      const MER = 24;
      for (let i = 0; i < MER; i++) {
        const a = (i / MER) * Math.PI * 2;
        up.push({ key: mk, x: Math.cos(a) * RR, y: Math.sin(a) * RR, w: (2 * Math.PI * RR) / MER + 3, h: 46, z: RZ - 6, face: a + Math.PI / 2 });
      }
      // the other lads, clamped round the rim (as the roof room has them): pairs of [frame, lad]
      const ids = PLAYABLE_IDS.filter((id) => id !== G.s.player);
      const bind = S.textures.exists("fr_binding");
      const ladAt = up.length;
      ids.forEach((id, i) => {
        const ang = -Math.PI / 2 + (i / ids.length) * Math.PI * 2 + Math.PI / ids.length;
        const x = Math.cos(ang) * RR * 0.8;
        const y = Math.sin(ang) * RR * 0.8;
        const key = S.textures.exists(`spr_${id}`) ? `spr_${id}` : "spr_FLENKY";
        if (!S.textures.exists(key)) return;
        const fi = charMeta(S, key)?.idle.south ?? 0;
        const f = S.textures.get(key).get(fi);
        up.push(bind ? { key: "fr_binding", x, y, w: 60, h: 72, z: RZ, face: 0 } : { key, frame: fi, x, y, w: 1, h: 1, z: RZ, face: 0 });
        up.push({ key, frame: fi, x, y, w: 62, h: (62 * f.height) / f.width, z: RZ + 4, face: 0 });
      });
      const ladN = up.length - ladAt;
      // you: one board per frame you'll need (one shows at a time)
      const pk = playerKey(sc);
      const meta = charMeta(S, pk);
      const pickM = (m: Record<string, number[]> | undefined, dir: string) => (m ? (m[dir] ?? m.east ?? m.south) : undefined);
      const hurtE = pickM(meta?.hurt, "east");
      const riseF = hurtE?.length ? [hurtE[Math.min(1, hurtE.length - 1)]] : [meta ? (meta.idle.east ?? 0) : 3];
      const fallF = pickM(meta?.hurt, "south") ?? (meta ? riseF : [1, 2]);
      const standF = meta ? (meta.idle.south ?? 0) : 0;
      const cheerF = pickM(meta?.victory, "south") ?? [standF];
      const frames = S.textures.exists(pk) ? [...new Set([...riseF, ...fallF, ...cheerF, standF])].filter((f) => S.textures.get(pk).has(String(f))) : [];
      const riderAt = up.length;
      const riderH: number[] = [];
      for (const f of frames) {
        const fr = S.textures.get(pk).get(f);
        const h = (RIDER_W * fr.height) / fr.width;
        riderH.push(h);
        up.push({ key: pk, frame: f, x: 0, y: 0, w: RIDER_W, h, z: RZ, face: 0 });
      }
      const ups = st.addBoards(up, 4.6);
      const spire = towerKey ? ups[spireAt] : null;
      const lads = ups.slice(ladAt, ladAt + ladN);
      const riders = ups.slice(riderAt);
      const riderOf = new Map(frames.map((f, i) => [f, i]));
      const faced = [...set.tower, ...(spire ? [spire] : []), ...lads, ...riders];
      for (const r of riders) r.alpha = 0;
      // ---- debris (bits of the roof's middle) flung off when it goes
      const debSpecs: BoardSpec[] = [];
      for (let i = 0; i < 16; i++) {
        const w = rnd.between(12, 24);
        const h = rnd.between(12, 24);
        debSpecs.push({ key: floorKey, crop: [Math.round(FW * 0.36) + rnd.between(0, Math.round(FW * 0.24)), Math.round(FW * 0.36) + rnd.between(0, Math.round(FW * 0.24)), w, h], x: 0, y: 0, w: w * 2.2, h: h * 2.2 });
      }
      const debris = st.addBoards(debSpecs, 4.7).map((b) => {
        b.alpha = 0;
        const a = rnd.realInRange(0, Math.PI * 2);
        const v = rnd.realInRange(220, 420);
        return { b, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd.realInRange(500, 1000), sp: rnd.realInRange(-9, 9) };
      });
      // ---- light: the glow under the roof, the geyser, its spray, your trail, the dust when you land
      const { glow, dot } = set;
      const core = st.addSprite(glow, 0, 0, RZ + 8, 140, { add: true, tint: 0xffc21a, alpha: 0, layer: "front" });
      const cracks = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const r = rnd.realInRange(70, 170);
        return st.addSprite(glow, Math.cos(a) * r, Math.sin(a) * r, RZ + 4, rnd.realInRange(60, 110), { add: true, tint: 0xffb020, alpha: 0, layer: "front" });
      });
      const GN = 34;
      const geyser = Array.from({ length: GN }, (_, i) => st.addSprite(glow, 0, 0, RZ, 150, { add: true, tint: i % 3 === 0 ? 0xfffbe0 : 0xffc21a, alpha: 0, layer: "front" }));
      const spray = Array.from({ length: 18 }, (_, i) => ({ s: st.addSprite(dot, 0, 0, RZ, 22, { add: true, tint: 0xffd23f, alpha: 0, layer: "front" }), a: (i / 18) * Math.PI * 2 + rnd.frac(), ph: rnd.frac() }));
      const TRAIL = 14;
      const trail = Array.from({ length: TRAIL }, (_, i) => st.addSprite(glow, 0, 0, RZ, 80 * (1 - i / (TRAIL + 6)), { add: true, tint: i % 2 ? 0xfff3b0 : 0xffd23f, alpha: 0, layer: "front" }));
      const hist: { x: number; y: number; z: number }[] = [];
      const dust = Array.from({ length: 16 }, (_, i) => ({ s: st.addSprite(dot, LAND.x, LAND.y, RZ + 10, 50, { tint: 0x9a8fae, alpha: 0 }), a: (i / 16) * Math.PI * 2 + rnd.realInRange(-0.15, 0.15), k: rnd.realInRange(0.8, 1.2) }));
      const sparks = Array.from({ length: 10 }, () => ({ s: st.addSprite(dot, LAND.x, LAND.y, RZ, 18, { add: true, tint: 0xffe27a, alpha: 0, layer: "front" }), a: rnd.realInRange(0, Math.PI * 2), v: rnd.realInRange(120, 260), vz: rnd.realInRange(150, 320) }));
      // ---- on the glass: speed lines, the gold flash, lightning in the sky
      const lines = st.keep(S.add.graphics().setDepth(40));
      const streaks = Array.from({ length: 20 }, () => ({ ox: rnd.realInRange(-280, 280), oy: rnd.realInRange(-300, 300), len: rnd.realInRange(40, 130) }));
      const gold = st.keep(S.add.rectangle(SW / 2, SH / 2, SW + 80, SH + 80, 0xffc94a, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(31).setAlpha(0));
      const boltG = st.keep(S.add.graphics().setDepth(0.5));
      let bolt: { pts: number[]; t0: number } | null = null;
      let boltDue = false;
      const strike = (k: number) => {
        set.strike(k);
        boltDue = true;
      };
      // ---- the beats
      const beats: [number, () => void][] = [
        [0.05, () => synth.play("fly_wind", 0.5)],
        [0.1, () => synth.play("drone", 0.7)],
        [0.35, () => strike(0.8)],
        [0.8, () => synth.play("smash", 0.3)],
        [1.15, () => synth.play("smash", 0.45)],
        [T_ERUPT - 0.04, () => (synth.play("boom"), synth.play("jet"), synth.play("explode", 0.6))],
        [T_ERUPT + 0.3, () => synth.play("fly_whoosh", 0.8)],
        [T_ERUPT + FLIGHT / 2, () => synth.play("fly_whoosh", 0.5)],
        [4.4, () => strike(0.6)],
        [T_LAND, () => (synth.play("boom", 0.8), synth.play("smash", 0.7))],
      ];
      let bi = 0;
      const shakeK = calm ? 0.3 : 1;
      /** you, at time t: where (your feet), your spin, which frame */
      const you = (t: number) => {
        const ft = clamp(t - T_ERUPT, 0, FLIGHT);
        const u = ft / FLIGHT;
        const hu = ease(clamp((u - 0.3) / 0.7, 0, 1));
        const x = LAND.x * hu - 190 * Math.sin(Math.PI * clamp((u - 0.25) / 0.75, 0, 1));
        const y = LAND.y * hu;
        const z = RZ - 30 * (1 - u) + V0 * ft - 0.5 * GRAV * ft * ft;
        // five turns, fast out of the geyser, slowing to land upright
        const spin = Math.PI * 2 * 5 * (1 - (1 - u) * (1 - u));
        let f = standF;
        if (t < T_LAND) f = u < 0.5 ? riseF[0] : fallF[Math.floor(t * 8) % fallF.length];
        else if (t < T_LAND + 0.15) f = fallF[fallF.length - 1];
        else if (t < T_LAND + 1.2) f = cheerF[Math.floor((t - T_LAND) * 9) % cheerF.length];
        return { x, y, z, spin, f, u, ft };
      };
      return (t, dt) => {
        while (bi < beats.length && beats[bi][0] <= t) beats[bi++][1]();
        set.tick(t, dt);
        const lt = t - T_ERUPT;
        const pre = t < T_ERUPT ? span(t, 0.2, T_ERUPT) : 0;
        // the geyser: up with you, then falling back in on itself and gone
        const me = you(t);
        const rising = lt >= 0 && me.u < 0.5;
        const gk = lt < 0 ? 0 : rising ? 1 : clamp(1 - (me.ft - FLIGHT / 2) / 1.3, 0, 1);
        const top = lt < 0 ? RZ : rising ? me.z + 30 : Math.max(RZ, RZ + APEX - 0.5 * GRAV * 1.4 * Math.pow(me.ft - FLIGHT / 2, 2));
        const glowK = Math.max(pre, gk * 0.9, lt >= 0 ? clamp(1 - (lt - 0.2) / 2.5, 0, 1) : 0);
        // ---- the roof
        const flick = calm ? 0.08 * Math.sin(t * 6) : 0.12 * Math.sin(t * 31) + 0.08 * Math.sin(t * 57);
        tiles.forEach((b, i) => {
          const r = tileR[i];
          const f = Math.pow(Math.max(0, 1 - r / (RR * 0.75)), 2);
          let z = (34 * pre + Math.sin(t * 40 + r * 0.1) * 3 * pre) * f;
          if (lt >= 0) {
            z += 34 * f * (1 - span(t, T_ERUPT, T_ERUPT + 0.25));
            if (r < RR * 0.45) {
              const v = 560 * (1 - r / (RR * 0.45));
              z += Math.max(0, v * lt - 0.5 * 1500 * lt * lt);
            }
          }
          b.dz = RZ + z;
          b.tint = mixC(0xffffff, 0xffcf70, clamp(glowK * f * 1.4, 0, 0.8));
        });
        core.alpha = lt < 0 ? 0.15 + 0.65 * pre + flick * pre : 0.9 * gk + 0.4 * clamp(1 - lt / 2, 0, 1);
        core.size = lt < 0 ? 120 + 300 * pre : 520 * Math.max(gk, 0.4);
        cracks.forEach((s, i) => (s.alpha = lt < 0 ? pre * (0.5 + 0.4 * Math.sin(t * (calm ? 4 : 22) + i * 2)) : 0.6 * clamp(1 - lt / 1.2, 0, 1)));
        geyser.forEach((s, i) => {
          const k = i / (GN - 1);
          s.z = lerp(RZ - 10, top, k);
          // (it bends after you as you go over)
          s.x = me.x * k * k + Math.sin(t * 17 + i * 1.3) * 14 * (1 - k * 0.5);
          s.y = me.y * k * k + Math.cos(t * 13 + i) * 8;
          s.size = (i % 3 === 0 ? 110 : 210) + 30 * Math.sin(t * 20 + i) + (k < 0.12 ? 160 : 0);
          s.alpha = gk * (i % 3 === 0 ? 0.9 : 0.55);
        });
        for (const p of spray) {
          const q = (t * 1.4 + p.ph) % 1;
          p.s.x = Math.cos(p.a) * (30 + 240 * q);
          p.s.y = Math.sin(p.a) * (30 + 240 * q);
          p.s.z = RZ + 520 * q - 620 * q * q;
          p.s.alpha = gk * (1 - q) * 0.9;
        }
        for (const d of debris) {
          if (lt < 0) continue;
          const x = d.vx * lt;
          const y = d.vy * lt;
          const z = RZ + 20 + d.vz * lt - 0.5 * 1100 * lt * lt;
          d.b.dx = x;
          d.b.dy = y;
          d.b.dz = z;
          d.b.spin = d.sp * lt;
          d.b.alpha = z < RZ && Math.hypot(x, y) < RR ? 0 : clamp((z - (RZ - 700)) / 300, 0, 1);
        }
        // ---- you
        const ri = riderOf.get(me.f) ?? 0;
        riders.forEach((b, i) => {
          b.x = me.x;
          b.y = me.y;
          b.z = me.z;
          b.spin = t < T_LAND ? me.spin : 0;
          // drawn bigger in flight (so you read against the sky), back to size as you come in; a squash as you land
          b.scale = t >= T_LAND ? 1 + 0.12 * Math.exp(-(t - T_LAND) * 8) * Math.sin((t - T_LAND) * 30) : 1 + 0.7 * (1 - span(t, T_LAND - 0.9, T_LAND));
          b.alpha = lt < 0 || i !== ri ? 0 : 1;
        });
        const rH = riderH[ri] ?? RIDER_W;
        if (lt >= 0 && t < T_LAND + 0.4) {
          hist.push({ x: me.x, y: me.y, z: me.z + rH / 2 });
          if (hist.length > TRAIL * 2 + 2) hist.shift();
        }
        const trailK = lt < 0 ? 0 : t < T_LAND ? 1 : clamp(1 - (t - T_LAND) / 0.35, 0, 1);
        trail.forEach((s, i) => {
          const h = hist[Math.max(0, hist.length - 1 - i * 2)];
          if (!h) return;
          s.x = h.x;
          s.y = h.y;
          s.z = h.z;
          s.alpha = trailK * 0.6 * (1 - i / TRAIL);
        });
        // ---- the landing
        const ld = t - T_LAND;
        for (const d of dust) {
          if (ld < 0) continue;
          const k = easeOut3(ld / 1.0);
          const r = 20 + 210 * k * d.k;
          d.s.x = LAND.x + Math.cos(d.a) * r;
          d.s.y = LAND.y + Math.sin(d.a) * r;
          d.s.z = RZ + 12 + 24 * k;
          d.s.size = 50 + 130 * k;
          d.s.alpha = 0.75 * clamp(1 - ld / 1.2, 0, 1);
        }
        for (const p of sparks) {
          if (ld < 0) continue;
          p.s.x = LAND.x + Math.cos(p.a) * p.v * ld;
          p.s.y = LAND.y + Math.sin(p.a) * p.v * ld;
          p.s.z = RZ + 10 + p.vz * ld - 0.5 * 900 * ld * ld;
          p.s.alpha = p.s.z > RZ ? clamp(1 - ld / 0.8, 0, 1) : 0;
        }
        // ---- the camera: on the roof, tipping up after you as you go, round as you come down, and up over the roof
        let amp = 4 * pre;
        if (lt >= 0) amp += 26 * Math.exp(-lt * 3);
        if (ld >= 0) amp += 22 * Math.exp(-ld * 4);
        amp *= shakeK;
        const eye = pathAt(EYE, t);
        const look = pathAt(LOOK, t);
        const w = span(t, T_ERUPT, T_ERUPT + 0.45) * (1 - span(t, T_LAND + 0.1, T_LAND + 1.3));
        const tx = lerp(look.x, me.x, w);
        const ty = lerp(look.y, me.y, w);
        const tz = lerp(look.z, me.z + rH / 2 - 50, w);
        // the camera rides up some of the way with you
        eye.z += 0.5 * (me.z - RZ) * w;
        const jx = (Math.sin(t * 53) + Math.sin(t * 31)) * amp * 0.5;
        const jz = (Math.sin(t * 47 + 1) + Math.sin(t * 29)) * amp * 0.4;
        const roll = Math.sin(t * 0.9) * 1.5 - 7 * Math.sin(Math.PI * clamp((t - 3.1) / 2.3, 0, 1)) + Math.sin(t * 61) * amp * 0.02;
        const pose = lookAt({ x: eye.x + jx, y: eye.y, z: eye.z + jz }, { x: tx + jx * 0.5, y: ty, z: tz + jz * 0.5 }, roll);
        for (const b of faced) faceTo(b, pose.x, pose.y);
        // the lads' frames sit just behind them, from wherever the camera is
        for (let i = 0; i + 1 < lads.length; i += 2) {
          const fr = lads[i];
          const vx = fr.x - pose.x;
          const vy = fr.y - pose.y;
          const vl = Math.hypot(vx, vy) || 1;
          fr.dx = (vx / vl) * 6;
          fr.dy = (vy / vl) * 6;
          if (!bind) fr.alpha = 0;
        }
        // ---- on the glass
        st.P.set(pose);
        const q = st.P.project(me.x, me.y, me.z + rH / 2);
        const qx = q.x;
        const qy = q.y;
        const qz = q.zc;
        const vRise = (V0 - GRAV * me.ft) / V0;
        const sk = lt < 0 || t >= T_LAND ? 0 : me.u < 0.5 ? clamp(vRise * 1.2, 0, 1) : clamp(-vRise, 0, 1) * 0.8;
        const dir = me.u < 0.5 ? 1 : -1;
        lines.clear();
        if (sk > 0.02 && qz > 60) {
          lines.lineStyle(2, 0xfff3c4, 0.55 * sk);
          for (const s of streaks) {
            s.oy += dir * 1700 * dt * (0.5 + sk);
            if (s.oy > 300) s.oy -= 600;
            if (s.oy < -300) s.oy += 600;
            if (Math.abs(s.ox) < 50 && Math.abs(s.oy) < 70) continue;
            const x = qx + s.ox;
            const y = qy + s.oy;
            lines.lineBetween(x, y, x, y - dir * s.len * sk);
          }
        }
        gold.setAlpha(Math.max(lt >= 0 ? (calm ? 0.22 : 0.7) * Math.exp(-lt * (calm ? 2 : 5)) : 0, ld >= 0 ? (calm ? 0.08 : 0.25) * Math.exp(-ld * 6) : 0));
        // lightning: a bolt down the sky to the horizon (when there's sky in shot)
        if (boltDue) {
          boltDue = false;
          const hz = st.P.horizonY();
          if (hz > 80) {
            const pts: number[] = [];
            let x = rnd.realInRange(140, SW - 140);
            for (let y = -10; y < hz; y += rnd.realInRange(18, 40)) {
              pts.push(x, y);
              x += rnd.realInRange(-34, 34);
            }
            pts.push(x, hz);
            bolt = { pts, t0: t };
          }
        }
        boltG.clear();
        if (bolt) {
          const age = t - bolt.t0;
          const a = calm ? 0.45 * clamp(1 - age / 0.8, 0, 1) : clamp(1 - age / 0.3, 0, 1);
          if (a <= 0) bolt = null;
          else
            for (const [wdt, col, al] of [
              [7, 0xa78bfa, 0.35],
              [2, 0xffffff, 1],
            ] as [number, number, number][]) {
              boltG.lineStyle(wdt, col, a * al).beginPath();
              boltG.moveTo(bolt.pts[0], bolt.pts[1]);
              for (let i = 2; i < bolt.pts.length; i += 2) boltG.lineTo(bolt.pts[i], bolt.pts[i + 1]);
              boltG.strokePath();
            }
        }
        return pose;
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
export function sanctumSwing(sc: Phaser.Scene, o: { worldW: number; worldH: number; you: { x: number; y: number }; him: { x: number; y: number }; end: { x: number; y: number; zoom: number }; skip?: Phaser.GameObjects.GameObject[]; onCovered?: () => void }) {
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
    onCovered: o.onCovered,
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


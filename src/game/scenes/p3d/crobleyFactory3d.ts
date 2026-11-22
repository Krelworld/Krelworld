import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { type Board3D, type BoardSpec, type CamKey, type ShotCtx, type Sprite3D, type Stage3D, camPath, clamp, lerp, playShot, span } from "../../gfx/Pseudo3D";

/**
 * Inside the Crobley factory: after the swoop onto Crobley Corp HQ (dungeonSwoop.ts) and before the entry card, a
 * short low glide down the factory floor in full swing. Conveyor belts of Crobleys and candy run either side of the
 * aisle under slamming presses, a chocolate river runs under it all, steam vents puff, sparks fly, sirens turn, the
 * brainwashed Crobleys march, sausages in candy wrappers work the line, drones ferry stock, and up on the gantry at
 * the end Reinhardt Crobley looks down on it with his guards. About five seconds, skippable, played with the swoop.
 * Everything is the dungeon's own art (its backdrops, the side-level crusher, mincer and vent, its enemy sheets)
 * plus a few procedural bits (belts, girders, the gantry).
 *
 * Layout (world px; x east, y south, z up): the camera flies north up the aisle (x ~ 0) from y ~ 2350 to ~ 760 and
 * tilts up to the gantry across the hall at y = 180. Belts at |x| 250..430, walls at |x| 760, the end wall at y -650.
 */

const LENGTH = 5.2;
/** belt top */
const BZ = 64;
const BELT_Y0 = -560;
const BELT_Y1 = 3000;
const SLATS = 64;
const BELT_SPEED = 170;
/** the gantry */
const GY = 180;
const GZ = 400;
const RIVER = { y0: 1990, y1: 2130 };

/** Play the factory-floor shot over `sc` (which is paused under the swoop) and wait for it. */
export async function crobleyFloor3d(sc: Phaser.Scene): Promise<{ skipped: boolean }> {
  return playShot(sc, { length: LENGTH, fromBlack: true, fadeIn: 260, toBlack: true, fadeOut: 300, overPaused: true, build });
}

// ------------------------------------------------------------------------------------------------ textures

/** A canvas texture owned by the set. */
function canvasTex(st: Stage3D, name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const k = st.key(name);
  const c = st.sc.textures.createCanvas(k, w, h);
  if (!c) return null;
  const ctx = c.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  c.refresh();
  return k;
}

/** A frame of a (small) pixel-art texture blown up `n` times with hard pixels, so it stays crisp on a big board. */
function crisp(st: Stage3D, key: string, frame: number | string | undefined, n: number) {
  const sc = st.sc;
  if (!sc.textures.exists(key)) return null;
  const f = sc.textures.getFrame(key, frame);
  if (!f) return null;
  return canvasTex(st, `px_${key}_${frame ?? "b"}`, f.cutWidth * n, f.cutHeight * n, (ctx) => {
    ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth * n, f.cutHeight * n);
  });
}

const hazard = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 12) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#1c1917";
  for (let i = -h; i < w + h; i += step * 2) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + step, y + h);
    ctx.lineTo(x + i + step + h, y);
    ctx.lineTo(x + i + h, y);
    ctx.fill();
  }
  ctx.restore();
};

function makeTextures(st: Stage3D) {
  const sc = st.sc;
  // the floor: riveted steel plates, yellow aisle lines, oil stains
  const floor = st.groundTexture("floor", 512, 1024, (dt) => {
    const g = sc.make.graphics({}, false);
    g.fillStyle(0x3a302a, 1).fillRect(0, 0, 512, 1024);
    const rnd = new Phaser.Math.RandomDataGenerator(["cf_floor3d"]);
    for (let y = 0; y < 1024; y += 64)
      for (let x = 0; x < 512; x += 64) {
        g.fillStyle(rnd.pick([0x463a32, 0x40352e, 0x4b3f36]), 1).fillRect(x + 1, y + 1, 62, 62);
        g.fillStyle(0x6b5a4c, 1).fillRect(x + 4, y + 4, 2, 2).fillRect(x + 58, y + 4, 2, 2).fillRect(x + 4, y + 58, 2, 2).fillRect(x + 58, y + 58, 2, 2);
      }
    for (let i = 0; i < 30; i++) g.fillStyle(0x1f1813, 0.5).fillEllipse(rnd.between(0, 512), rnd.between(0, 1024), rnd.between(20, 60), rnd.between(10, 40));
    // the aisle (x -130..130 of the hall's -900..900 is u 0.43..0.57) edged in yellow
    g.fillStyle(0xfacc15, 1).fillRect(216, 0, 6, 1024).fillRect(290, 0, 6, 1024);
    dt.draw(g);
    g.destroy();
  });
  // a belt: dark rubber slats (it slides along by one slat to move)
  const belt = st.groundTexture("belt", 64, 1024, (dt) => {
    const g = sc.make.graphics({}, false);
    g.fillStyle(0x1c1a1a, 1).fillRect(0, 0, 64, 1024);
    const s = 1024 / SLATS;
    for (let i = 0; i < SLATS; i++) {
      g.fillStyle(i % 2 ? 0x34302e : 0x2b2826, 1).fillRect(3, i * s + 1, 58, s - 3);
      g.fillStyle(0x4a4442, 1).fillRect(3, i * s + 1, 58, 2);
    }
    g.fillStyle(0x8a7a5a, 1).fillRect(0, 0, 3, 1024).fillRect(61, 0, 3, 1024);
    dt.draw(g);
    g.destroy();
  });
  // the chocolate river: brown with lighter swirls (it slides sideways)
  const choc = st.groundTexture("choc", 1024, 64, (dt) => {
    const g = sc.make.graphics({}, false);
    g.fillStyle(0x5e3018, 1).fillRect(0, 0, 1024, 64);
    const rnd = new Phaser.Math.RandomDataGenerator(["cf_choc"]);
    for (let i = 0; i < 70; i++) g.fillStyle(rnd.pick([0x7a4220, 0x6b3a1c, 0x8a5028]), 0.9).fillEllipse((i * 1024) / 70 + rnd.between(-4, 4), rnd.between(6, 58), rnd.between(14, 30), rnd.between(3, 6));
    for (let i = 0; i < 24; i++) g.fillStyle(0xc08050, 0.8).fillRect((i * 1024) / 24, rnd.between(8, 56), 10, 2);
    dt.draw(g);
    g.destroy();
  });
  // the belt's side skirt: steel with rollers and a hazard-striped lip
  const skirt = canvasTex(st, "skirt", 256, 48, (ctx) => {
    ctx.fillStyle = "#2a2624";
    ctx.fillRect(0, 0, 256, 48);
    hazard(ctx, 0, 0, 256, 8, 8);
    for (let x = 16; x < 256; x += 32) {
      ctx.fillStyle = "#57504a";
      ctx.beginPath();
      ctx.arc(x, 24, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a827a";
      ctx.fillRect(x - 2, 22, 4, 4);
    }
    ctx.fillStyle = "#3d3632";
    ctx.fillRect(0, 38, 256, 10);
    for (let x = 4; x < 256; x += 16) {
      ctx.fillStyle = "#6b625a";
      ctx.fillRect(x, 42, 2, 2);
    }
  });
  // a press column: a hazard-striped I-beam
  const beam = canvasTex(st, "beam", 24, 128, (ctx) => {
    ctx.fillStyle = "#3b3633";
    ctx.fillRect(0, 0, 24, 128);
    ctx.fillStyle = "#57504a";
    ctx.fillRect(3, 0, 4, 128);
    ctx.fillStyle = "#24201e";
    ctx.fillRect(18, 0, 3, 128);
    hazard(ctx, 0, 100, 24, 28, 6);
    for (let y = 6; y < 96; y += 14) {
      ctx.fillStyle = "#8a827a";
      ctx.fillRect(10, y, 3, 3);
    }
  });
  // the crossbeam over a press
  const lintel = canvasTex(st, "lintel", 128, 24, (ctx) => {
    ctx.fillStyle = "#3b3633";
    ctx.fillRect(0, 0, 128, 24);
    hazard(ctx, 0, 6, 128, 12, 8);
    ctx.fillStyle = "#24201e";
    ctx.fillRect(0, 20, 128, 4);
    ctx.fillStyle = "#57504a";
    ctx.fillRect(0, 0, 128, 3);
  });
  // a piston rod: polished steel
  const rod = canvasTex(st, "rod", 16, 64, (ctx) => {
    const cols = ["#4b4542", "#7c7570", "#bdb6ae", "#e7e2dc", "#a49c94", "#6b645e", "#3d3835"];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(2 + i * 2, 0, 2, 64);
    });
    ctx.fillStyle = "#2a2624";
    ctx.fillRect(0, 0, 16, 3);
  });
  // the gantry: a truss with a railing on top (see-through between the bars)
  const gantry = canvasTex(st, "gantry", 512, 64, (ctx) => {
    ctx.fillStyle = "#4a423c";
    ctx.fillRect(0, 2, 512, 4);
    ctx.fillRect(0, 20, 512, 4);
    for (let x = 0; x < 512; x += 24) ctx.fillRect(x, 2, 3, 22);
    ctx.fillStyle = "#2f2a27";
    ctx.fillRect(0, 34, 512, 30);
    hazard(ctx, 0, 30, 512, 6, 6);
    ctx.strokeStyle = "#5c534c";
    ctx.lineWidth = 3;
    for (let x = 0; x < 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 38);
      ctx.lineTo(x + 16, 60);
      ctx.lineTo(x + 32, 38);
      ctx.stroke();
    }
  });
  return { floor, belt, choc, skirt, beam, lintel, rod, gantry };
}

// ------------------------------------------------------------------------------------------------ the set

interface Walker {
  frames: Board3D[];
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  fps: number;
  ph: number;
  /** hop height (the Crobleys bounce), hover bob */
  hop: number;
  z: number;
  /** wraps along x/y over [a, b] */
  wrap?: [number, number];
}

interface Press {
  x: number;
  y: number;
  head: Board3D | null;
  rod: Board3D | null;
  T: number;
  ph: number;
  last: number;
}

interface Spark {
  s: Sprite3D;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  age: number;
}

interface Puff {
  s: Sprite3D;
  x: number;
  y: number;
  t0: number;
  life: number;
  drift: number;
  big: number;
}

function build(c: ShotCtx) {
  const { st, sc, calm } = c;
  const shake = G.meta?.settings?.shake !== false && !calm;
  st.maxLean = 90;
  st.light = 0xffe4c8;
  st.fog = { color: 0x24140c, start: 700, span: 2600, max: 0.78 };
  // no sky in here: the roof is lost in the dark and the haze
  st.setSky({ top: 0x0b0605, horizon: 0x3a2114, below: 0x2a1a12 });
  const T = makeTextures(st);
  const has = (k: string | null): k is string => !!k && sc.textures.exists(k);

  // the floor, the chocolate river across it, the belts either side of the aisle
  st.addGround({ x0: -4000, y0: -4000, x1: 4000, y1: 6000, cols: 8, rows: 8, color: 0x241812, depth: 0.9 });
  st.addGround({ key: T.floor, rt: true, x0: -900, y0: -900, x1: 900, y1: 3300, cols: 10, rows: 30, depth: 1 });
  const RIVER_W = 2400;
  const river = st.addGround({ key: T.choc, rt: true, x0: -1200, y0: RIVER.y0, x1: 1200, y1: RIVER.y1, cols: 24, rows: 2, depth: 1.1 });
  const belts = [-1, 1].map((side) => st.addGround({ key: T.belt, rt: true, x0: side * 250 - (side > 0 ? 0 : 180), y0: BELT_Y0, x1: side * 250 + (side > 0 ? 180 : 0), y1: BELT_Y1, z: BZ, cols: 2, rows: 56, depth: 1.2 }));
  const SLAT = (BELT_Y1 - BELT_Y0) / SLATS;

  // ---- everything standing goes in one atlas, so it all sorts together
  const specs: BoardSpec[] = [];
  const add = (s: BoardSpec) => specs.push(s) - 1;
  // the walls: the packing hall either side, the chocolate falls at the end (the dungeon's own backdrops)
  for (const [side, bk] of [[-1, "cf_packing"], [1, "cf_packing"]] as const) {
    if (!sc.textures.exists(bk)) continue;
    for (let i = 0; i < 8; i++) {
      const q = (i + (side > 0 ? 2 : 0)) % 4;
      add({ key: bk, crop: [q * 256, 0, 256, 288], x: side * 760, y: 2900 - i * 520 - 260, w: 520, h: 585, face: side < 0 ? -Math.PI / 2 : Math.PI / 2, flipX: side > 0 });
    }
  }
  if (sc.textures.exists("cf_floor")) add({ key: "cf_floor", x: 0, y: -650, w: 1560, h: 439, face: 0 });
  // the belt skirts (in short lengths: a board right beside the camera would be culled whole)
  if (has(T.skirt))
    for (const side of [-1, 1])
      for (let y = BELT_Y0; y < BELT_Y1; y += 320) add({ key: T.skirt, x: side * 250, y: y + 160, w: 320, h: BZ, face: side < 0 ? -Math.PI / 2 : Math.PI / 2 });
  // overhead pipes along the walls
  if (sc.textures.exists("p_pipe"))
    for (const side of [-1, 1]) for (let y = -400; y < 2600; y += 300) add({ key: "p_pipe", x: side * 600, y: y + 150, z: 470, w: 300, h: 110, face: side < 0 ? -Math.PI / 2 : Math.PI / 2, flipX: side > 0 });
  // mincers against the walls, chewing
  const mincers: number[] = [];
  if (sc.textures.exists("side_mincer"))
    for (const [x, y] of [[-600, 1500], [600, 1100], [-600, 500], [600, -100]]) mincers.push(add({ key: "side_mincer", x, y, w: 150, h: 400 }));
  // the presses over the belts: two columns, a crossbeam, a siren, the rod and the head
  const pressAt: [number, number][] = [[-340, 1820], [340, 1420], [-340, 1020], [340, 620], [-340, 240]];
  const pressIx: { head: number; rod: number }[] = [];
  for (const [x, y] of pressAt) {
    if (has(T.beam)) for (const dx of [-120, 120]) add({ key: T.beam, x: x + dx, y, w: 34, h: 420 });
    if (has(T.lintel)) add({ key: T.lintel, x, y: y + 2, z: 392, w: 290, h: 46, face: 0 });
    if (sc.textures.exists("kd_siren")) add({ key: "kd_siren", x: x + (x < 0 ? 90 : -90), y: y - 4, z: 432, w: 64, h: 64 });
    pressIx.push({ rod: has(T.rod) ? add({ key: T.rod, x, y: y - 2, z: 200, w: 30, h: 420 }) : -1, head: sc.textures.exists("side_crusher") ? add({ key: "side_crusher", x, y: y + 2, z: 200, w: 150, h: 190 }) : -1 });
  }
  // steam vents at the aisle's edges
  const vents: [number, number][] = [[-175, 1620], [175, 1220], [-175, 820], [175, 420]];
  if (sc.textures.exists("side_vent")) for (const [x, y] of vents) add({ key: "side_vent", x, y, w: 82, h: 72 });
  // a grating bridge over the river for the aisle
  if (has(T.skirt)) add({ key: T.skirt, x: 0, y: (RIVER.y0 + RIVER.y1) / 2, w: 300, h: 20, flat: [-150, RIVER.y0 - 10, 150, RIVER.y1 + 10] });
  // the gantry across the end of the hall, on two legs
  if (has(T.gantry)) add({ key: T.gantry, x: 0, y: GY, z: GZ - 40, w: 1500, h: 110, face: 0 });
  if (has(T.beam)) for (const x of [-700, 700]) add({ key: T.beam, x, y: GY + 4, w: 44, h: GZ - 20 });
  if (sc.textures.exists("p_reinhardt")) add({ key: "p_reinhardt", x: 0, y: GY - 14, z: GZ - 30, w: 170, h: 204 });

  // product on the belts: Crobleys, sweets and the odd sausage, crisp
  const goods = [crisp(st, "p_crobley", undefined, 4), crisp(st, "d_candy", undefined, 3), crisp(st, "p_crobley", undefined, 4), crisp(st, "p_sausage_s", undefined, 2)];
  const goodSize: Record<number, [number, number]> = { 0: [46, 40], 1: [48, 42], 2: [46, 40], 3: [28, 52] };
  const items: { i: number; side: number; y0: number }[] = [];
  const N_ITEMS = calm ? 20 : 28;
  for (const side of [-1, 1])
    for (let n = 0; n < N_ITEMS; n++) {
      const g = n % 4;
      const k = goods[g];
      if (!has(k)) continue;
      const [w, h] = goodSize[g];
      const y0 = BELT_Y0 + ((n + (side > 0 ? 0.5 : 0)) * (BELT_Y1 - BELT_Y0)) / N_ITEMS;
      items.push({ i: add({ key: k, x: side * 340 + ((n * 37) % 50) - 25, y: y0, z: BZ, w, h }), side, y0 });
    }

  // the workforce: animated, one board per frame
  const walkers: Walker[] = [];
  const crew = (key: string, frames: number[], n: number, at: { x: number; y: number; z?: number; vx?: number; vy?: number; fps?: number; hop?: number; flip?: boolean; w: number; h: number; wrap?: [number, number] }) => {
    const ks = frames.map((f) => crisp(st, key, f, n));
    if (!ks.every(has)) return;
    const ix = ks.map((k) => add({ key: k!, x: at.x, y: at.y, z: at.z ?? 0, w: at.w, h: at.h, flipX: at.flip }));
    walkers.push({ frames: ix as unknown as Board3D[], x0: at.x, y0: at.y, vx: at.vx ?? 0, vy: at.vy ?? 0, fps: at.fps ?? 9, ph: walkers.length * 0.37, hop: at.hop ?? 0, z: at.z ?? 0, wrap: at.wrap });
  };
  const W8 = [0, 1, 2, 3, 4, 5, 6, 7];
  // a column of brainwashed Crobleys bouncing down the aisle at you, two abreast
  for (let i = 0; i < (calm ? 6 : 8); i++) crew("en_crobley_minion_walk", W8, 3, { x: i % 2 ? 46 : -46, y: 1250 - Math.floor(i / 2) * 120, vy: 120, hop: 8, w: 76, h: 76, fps: 10 });
  // Crobley guards marching across under the far presses
  for (let i = 0; i < 3; i++) crew("en_crobley_guard_walk", W8, 3, { x: 200 - i * 110, y: 560, vx: -90, w: 96, h: 96, fps: 9, wrap: [-260, 260] });
  // sausages in candy wrappers working the line (facing the belt)
  for (const [x, y, flip] of [[-200, 1700, false], [200, 1320, true], [-200, 920, false], [200, 760, true], [-200, 380, false]] as [number, number, boolean][])
    crew("en_crobage_atk", W8, 3, { x, y, w: 100, h: 100, fps: 8, flip });
  // candy drones ferrying stock up and down over the belts
  for (const [x, y, vy] of [[-340, 1500, -150], [340, 900, 140], [-340, 300, -120]] as [number, number, number][]) crew("en_candy_drone_walk", W8, 3, { x, y, z: 230, vy, hop: 14, w: 100, h: 100, fps: 12, wrap: [BELT_Y0 + 200, BELT_Y1 - 400] });
  // Reinhardt's beefeater guard on the gantry either side of him
  for (const x of [-230, 230]) crew("en_gobstopper", [0, 1, 2, 3], 3, { x, y: GY - 14, z: GZ - 12, w: 130, h: 130, fps: 4, flip: x < 0 });

  const boards = st.addBoards(specs);
  // addBoards keeps order but skips missing textures: everything above checked its texture exists
  const B = (i: number) => (i >= 0 ? boards[i] : null);
  for (const w of walkers) w.frames = (w.frames as unknown as number[]).map((i) => boards[i]);
  const presses: Press[] = pressAt.map(([x, y], i) => ({ x, y, head: B(pressIx[i].head), rod: B(pressIx[i].rod), T: 1.25 + (i % 3) * 0.22, ph: i * 0.53, last: -1 }));
  const mincerB = mincers.map(B);
  const itemB = items.map((it) => ({ ...it, b: B(it.i) }));

  // ---- glows, sparks and steam
  const glow = st.softDot("glow", 0.3);
  const sirens = pressAt.map(([x, y], i) => ({ s: st.addSprite(glow, x + (x < 0 ? 90 : -90), y - 6, 470, 120, { add: true, tint: i % 2 ? 0xff3b1a : 0xff7a1a, alpha: 0 }), ph: i * 1.3 }));
  // hanging work lamps down the aisle
  for (let y = -200; y < 2600; y += 420) st.addSprite(glow, 0, y, 560, 260, { add: true, tint: 0xffc070, alpha: 0.32, layer: "back" });
  // the chocolate river's glow, the Core's heat at the end
  const endGlow = st.addSprite(glow, 0, -620, 240, 1100, { add: true, tint: 0xff8a3a, alpha: 0.18, layer: "back" });
  const sparks: Spark[] = [];
  for (let i = 0; i < (calm ? 40 : 90); i++) sparks.push({ s: st.addSprite(glow, 0, 0, 0, 12, { add: true, tint: i % 3 ? 0xffc04a : 0xfff4c0, alpha: 0, layer: "auto" }), vx: 0, vy: 0, vz: 0, life: 0, age: 9 });
  let sparkIx = 0;
  const burst = (x: number, y: number, z: number, n: number, sp = 1) => {
    for (let i = 0; i < n; i++) {
      const s = sparks[sparkIx++ % sparks.length];
      const a = Math.random() * Math.PI * 2;
      const v = (120 + Math.random() * 260) * sp;
      s.s.x = x;
      s.s.y = y;
      s.s.z = z;
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v * 0.6;
      s.vz = 120 + Math.random() * 280 * sp;
      s.life = 0.35 + Math.random() * 0.35;
      s.age = 0;
    }
  };
  const steam = st.softDot("steam", 0.45);
  const puffs: Puff[] = [];
  for (let i = 0; i < (calm ? 20 : 34); i++) puffs.push({ s: st.addSprite(steam, 0, 0, 0, 60, { tint: 0xe8ddd2, alpha: 0, layer: "auto" }), x: 0, y: 0, t0: -9, life: 1, drift: 0, big: 1 });
  let puffIx = 0;
  const puff = (x: number, y: number, t: number, big = 1) => {
    const p = puffs[puffIx++ % puffs.length];
    p.x = x + (Math.random() - 0.5) * 20;
    p.y = y + (Math.random() - 0.5) * 20;
    p.t0 = t;
    p.life = 0.9 + Math.random() * 0.6;
    p.drift = (Math.random() - 0.5) * 80;
    p.big = big;
  };
  const ventNext = vents.map((_, i) => 0.15 + i * 0.45);
  let weldNext = 0;

  // ---- the camera: low over the river, up the aisle under the presses, then tilting up to the gantry
  const keys: [number, CamKey][] = [
    [0, { x: 80, y: 2760, z: 92, tx: 0, ty: 1800, tz: 70, r: -2 }],
    [1.7, { x: -30, y: 1900, z: 116, tx: 0, ty: 1000, tz: 140, r: 3 }],
    [3.3, { x: 40, y: 1250, z: 160, tx: 0, ty: 400, tz: 240, r: -1 }],
    [4.9, { x: 0, y: 960, z: 190, tx: 0, ty: GY, tz: GZ - 10, r: 0 }],
  ];
  sc.time.delayedCall(350, () => c.caption("CROBLEY CORP · THE FACTORY FLOOR · 24/7", { hold: 2.3, color: "#ffd2a0" }));
  sc.time.delayedCall(3400, () => c.caption("REINHARDT CROBLEY · CEO · WATCHING", { hold: 1.4, color: "#ff9a6a" }));
  synth.play("tannoy", 0.35);
  sc.time.delayedCall(4000, () => synth.play("alarm", 0.25));
  let shakeT = 0;
  let camY = keys[0][1].y;

  return (t: number, dt: number) => {
    // belts and river slide along by a slat (the texture repeats, so it reads as endless)
    const off = (t * BELT_SPEED) % SLAT;
    belts[0].y0 = BELT_Y0 - SLAT + off;
    belts[0].y1 = BELT_Y1 - SLAT + off;
    belts[1].y0 = BELT_Y0 - off;
    belts[1].y1 = BELT_Y1 - off;
    const rOff = (t * 90) % (RIVER_W / 24);
    river.x0 = -1200 + rOff - RIVER_W / 24;
    river.x1 = 1200 + rOff - RIVER_W / 24;
    const L = BELT_Y1 - BELT_Y0;
    for (const it of itemB) {
      if (!it.b) continue;
      const d = it.side < 0 ? 1 : -1;
      it.b.y = BELT_Y0 + ((((it.y0 - BELT_Y0 + d * BELT_SPEED * t) % L) + L) % L);
      it.b.dz = 0;
      it.b.scale = 1;
    }
    // presses: a slow rise, a hard slam onto the belt, a moment pinned
    for (const p of presses) {
      const u = (((t + p.ph) / p.T) % 1 + 1) % 1;
      const lift = u < 0.1 ? 1 - (u / 0.1) ** 2 : u < 0.28 ? 0 : span(u, 0.28, 1);
      const hz = BZ - 4 + 170 * lift;
      if (p.head) {
        p.head.z = hz;
        p.head.dx = u > 0.1 && u < 0.2 ? Math.sin(t * 90) * 3 : 0;
      }
      if (p.rod) p.rod.z = hz + 170;
      const cyc = Math.floor((t + p.ph) / p.T + 0.9);
      if (u >= 0.1 && cyc !== p.last && p.last !== -1) {
        // the slam: sparks, a squirt of steam, a crunch if it's near
        const near = Math.abs(p.y - camY);
        burst(p.x, p.y + 30, BZ + 8, calm ? 5 : 12);
        puff(p.x + 60, p.y + 20, t, 0.6);
        if (near < 1100) {
          synth.play(near < 500 ? "smash" : "thud", clamp(0.5 - near / 2600, 0.1, 0.45));
          if (near < 600) shakeT = 0.18;
        }
        // squash whatever's under it
        for (const it of itemB) if (it.b && it.side * p.x > 0 && Math.abs(it.b.y - p.y) < 50) it.b.scale = 0.55;
      }
      p.last = cyc;
    }
    for (const m of mincerB) if (m) m.dx = Math.sin(t * 47 + m.y) * 1.5;
    // the crew
    for (const w of walkers) {
      const f = Math.floor((t + w.ph) * w.fps) % w.frames.length;
      let x = w.x0 + w.vx * t;
      let y = w.y0 + w.vy * t;
      let a = 1;
      if (w.wrap && w.vx) {
        const [lo, hi] = w.wrap;
        x = lo + ((((x - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));
        a = clamp(Math.min(x - lo, hi - x) / 60, 0, 1);
      }
      if (w.wrap && w.vy) {
        const [lo, hi] = w.wrap;
        y = lo + ((((y - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));
        a = clamp(Math.min(y - lo, hi - y) / 120, 0, 1);
      }
      const hop = w.hop ? Math.abs(Math.sin((t + w.ph) * 7)) * w.hop : 0;
      w.frames.forEach((b, i) => {
        b.x = x;
        b.y = y;
        b.dz = hop;
        b.alpha = i === f ? a : 0;
      });
    }
    // steam vents puff in turns; a welder's sparks by the far press
    vents.forEach(([x, y], i) => {
      if (t >= ventNext[i]) {
        ventNext[i] = t + (calm ? 1.6 : 1.1) + (i % 2) * 0.3;
        for (let k = 0; k < 3; k++) puff(x, y, t + k * 0.08, 1);
        if (Math.abs(y - camY) < 700) synth.play("pfft", 0.18);
      }
    });
    if (t >= weldNext) {
      weldNext = t + (calm ? 0.25 : 0.09);
      burst(160, 760, 120, calm ? 1 : 3, 0.6);
    }
    for (const s of sparks) {
      if (s.age >= s.life) {
        s.s.alpha = 0;
        continue;
      }
      s.age += dt;
      s.vz -= 900 * dt;
      s.s.x += s.vx * dt;
      s.s.y += s.vy * dt;
      s.s.z = Math.max(2, s.s.z + s.vz * dt);
      s.s.alpha = (calm ? 0.6 : 1) * (1 - s.age / s.life);
    }
    for (const p of puffs) {
      const lt = t - p.t0;
      if (lt < 0 || lt > p.life) {
        p.s.alpha = 0;
        continue;
      }
      const u = lt / p.life;
      p.s.x = p.x + p.drift * u;
      p.s.y = p.y;
      p.s.z = 30 + 260 * p.big * (1 - (1 - u) * (1 - u));
      p.s.size = lerp(60, 260, u) * p.big;
      p.s.alpha = 0.7 * (1 - u) * clamp(lt / 0.12, 0, 1);
    }
    // sirens turning (a slow steady pulse with calm flashes)
    for (const s of sirens) s.s.alpha = calm ? 0.35 + 0.12 * Math.sin(t * 1.6 + s.ph) : 0.15 + 0.7 * Math.max(0, Math.sin(t * 7 + s.ph)) ** 3;
    endGlow.alpha = 0.16 + (calm ? 0 : 0.04 * Math.sin(t * 5));
    const pose = camPath(keys, Math.min(t, keys[keys.length - 1][0]));
    camY = pose.y;
    if (shakeT > 0 && shake) {
      shakeT -= dt;
      pose.z += Math.sin(t * 80) * 3 * (shakeT / 0.18);
      pose.roll += Math.sin(t * 63) * 0.006 * (shakeT / 0.18);
    }
    return pose;
  };
}

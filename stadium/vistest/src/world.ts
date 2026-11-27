// The diorama: one pub, one yard, one street, one row of shops, and a stadium painted on the back wall.
// x east, z south, y up, metres. Everything static is poured into four buffers (ground, lit, unlit, glow).
import * as THREE from "three";
import * as art from "./art";
import { FWD, RIGHT, STRETCH, UP } from "./cfg";
import { Builder, setYS, type V3 } from "./mesh";
import { Atlas, BRICK_DARK, BRICK_RED, BRICK_STOCK, FONTS, H, PXM, brick, css, flags, grain, herringbone, hex, makeCanvas, pixText, puddle, rect, rng, shade, tarmac, tiny, weather, type RGB, type Region } from "./paint";

export interface Box { x0: number; z0: number; x1: number; z1: number; h: number }
export interface KegSpec { x: number; y: number; z: number; loose: boolean; on?: number[] }
export interface World {
  meshes: THREE.Object3D[];
  lit: THREE.MeshLambertMaterial;
  colliders: Box[];
  shaders: Box[]; // things tall enough to put a person in shade
  kegs: KegSpec[];
  kegGeometry: THREE.BufferGeometry;
  groundY: (x: number, z: number) => number;
  glowTex: THREE.Texture;
  stats: { tris: number; atlas: number };
}

// Layout.
const ROOF_T = Math.tan((30 * Math.PI) / 180); // nominal roof pitch (it stands steeper once heights are stretched)
export const PUB = { x0: -8.5, x1: -1.5, z0: -5, z1: 0, eaves: 6.3, ridge: 6.3 + 2.5 * ROOF_T };
export const YARD = { x0: -8.5, x1: 5.5, z0: 0, z1: 13.5 };
export const STREET = { zNear: -6.2, zFar: -10.8, zShops: -12.3, zBack: -17 };
const KERB = 0.12;
const GX0 = -24, GX1 = 22, GZ0 = -18, GZ1 = 29;
const P = (m: number) => Math.round(m * PXM);

export function buildWorld(maxAniso: number): World {
  setYS(STRETCH);
  const R = rng(20261127);
  const atlas = new Atlas(2048);
  const white = atlas.solid(0xffffff);
  const A = new Builder(atlas.size, atlas.size, white); // lit
  const U = new Builder(atlas.size, atlas.size, white); // unlit (lit glass, the backdrop)
  const GL = new Builder(64, 64, { x: 0, y: 0, w: 64, h: 64 }); // additive halos
  const colliders: Box[] = [], shaders: Box[] = [];
  const kegs: KegSpec[] = [];

  // -------------------------------------------------------------------------------------------
  // The ground: one painted map of the whole place.
  const GW = (GX1 - GX0) * PXM, GH = (GZ1 - GZ0) * PXM;
  const [gcv, g] = makeCanvas(GW, GH);
  g.translate(-GX0 * PXM, -GZ0 * PXM);
  const G = new Builder(GW, GH, { x: 0, y: 0, w: 4, h: 4 });
  const greg = (x0: number, z0: number, x1: number, z1: number): Region => ({ x: P(x0 - GX0), y: P(z0 - GZ0), w: P(x1 - x0), h: P(z1 - z0) });
  const fullW = P(GX1 - GX0);

  // Base: everything is tarmac until told otherwise.
  tarmac(g, P(GX0), P(GZ0), GW, GH, R, 0x393b40);
  // The street.
  tarmac(g, P(GX0), P(STREET.zFar), fullW, P(STREET.zNear - STREET.zFar), R, 0x43464d);
  {
    // tyre-polished wheel tracks
    for (const z of [-7.4, -9.6]) { const gr = g.createLinearGradient(0, P(z - 0.5), 0, P(z + 0.5)); gr.addColorStop(0, "rgba(20,22,26,0)"); gr.addColorStop(0.5, "rgba(20,22,26,0.22)"); gr.addColorStop(1, "rgba(20,22,26,0)"); g.fillStyle = gr; g.fillRect(P(GX0), P(z - 0.5), fullW, P(1)); }
    // double yellows, worn
    for (const z of [STREET.zNear - 0.42, STREET.zNear - 0.24, STREET.zFar + 0.16, STREET.zFar + 0.34]) for (let x = P(GX0); x < P(GX1); x += 3) if (R() > 0.13) rect(g, x, P(z), 3, 3, R() < 0.8 ? H(0xc7a22c) : H(0xa98a2c));
    // centre line
    for (let x = GX0 + 1; x < GX1; x += 5) for (let px = P(x); px < P(x + 2); px += 2) if (R() > 0.2) rect(g, px, P(-8.5), 2, 3, R() < 0.7 ? H(0xcfd0cc) : H(0xa9aaa6));
  }
  // Pavements.
  flags(g, P(GX0), P(STREET.zBack), fullW, P(STREET.zFar - STREET.zBack), R);
  flags(g, P(GX0), P(STREET.zNear), P(PUB.x1 - GX0), P(PUB.z0 - STREET.zNear), R);
  flags(g, P(YARD.x1), P(STREET.zNear), P(GX1 - YARD.x1), P(PUB.z0 - STREET.zNear), R);
  const kerbStones = (x0: number, x1: number, z: number) => { for (let x = P(x0); x < P(x1); x += 29) { const col = shade(hex(0xa9a69e), 0.92 + R() * 0.14); rect(g, x, P(z), 28, 5, css(col)); rect(g, x, P(z), 28, 1, css(shade(col, 1.14))); rect(g, x + 28, P(z), 1, 5, H(0x54524e)); } };
  kerbStones(GX0, GX1, STREET.zFar - 0.15); kerbStones(GX0, PUB.x1, STREET.zNear); kerbStones(YARD.x1, GX1, STREET.zNear);

  // The yard: herringbone block paving, brindle, with the arm running out to the street.
  const PAVERS: RGB[] = [0x86655a, 0x7a5b50, 0x91705f, 0x6c5148, 0x9a7a68, 0x756a64, 0x80604c].map(hex);
  herringbone(g, P(YARD.x0), P(YARD.z0), P(YARD.x1 - YARD.x0), P(YARD.z1 - YARD.z0), PAVERS, hex(0x4c3d38), R);
  herringbone(g, P(PUB.x1), P(STREET.zNear), P(YARD.x1 - PUB.x1), P(-STREET.zNear), PAVERS, hex(0x4c3d38), R);
  // a soldier course where the yard meets the road, and a dished drain channel across the yard
  for (let x = P(PUB.x1); x < P(YARD.x1); x += 4) { rect(g, x, P(STREET.zNear), 3, 7, css(shade(hex(0x5f4840), 0.9 + R() * 0.2))); rect(g, x + 3, P(STREET.zNear), 1, 7, H(0x3a2e2a)); }
  for (let x = P(YARD.x0 + 0.5); x < P(YARD.x1 - 0.4); x += 8) { rect(g, x, P(1.25), 7, 4, css(shade(hex(0x5c5552), 0.9 + R() * 0.2))); rect(g, x, P(1.25) + 1, 7, 1, "rgba(20,20,24,0.4)"); }
  // worn pale where people actually walk: gate to door
  g.save(); g.lineCap = "round"; g.strokeStyle = "rgba(205,190,170,0.07)"; g.lineWidth = 60;
  g.beginPath(); g.moveTo(P(2), P(-6)); g.bezierCurveTo(P(1.5), P(0), P(-2), P(2.5), P(-5.2), P(1.2)); g.stroke(); g.lineWidth = 34; g.stroke();
  g.strokeStyle = "rgba(18,16,16,0.12)"; g.lineWidth = 26; g.beginPath(); g.moveTo(P(3.6), P(-6)); g.bezierCurveTo(P(3.6), P(4), P(3), P(8.6), P(-3), P(8.8)); g.stroke(); // where the dray swings in
  g.restore();

  // West: back gardens. East: a concrete apron in front of the lock-ups. South: a setted back lane, then waste ground.
  {
    const gx0 = P(GX0), gz0 = P(-0.3), gw = P(YARD.x0 - 0.28 - GX0), gh = P(YARD.z1 + 0.3 + 0.3);
    rect(g, gx0, gz0, gw, gh, H(0x4d653b));
    for (let k = 0; k < (gw * gh) / 7; k++) rect(g, gx0 + R.int(gw), gz0 + R.int(gh), 1, 1 + R.int(2), H(R.pick([0x5a7644, 0x425a34, 0x64804a, 0x4a6238, 0x6b6a40])));
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${R() < 0.5 ? "104,88,60" : "60,84,48"},0.5)`; g.beginPath(); g.ellipse(gx0 + R.int(gw), gz0 + R.int(gh), 10 + R.int(30), 6 + R.int(14), 0, 0, 7); g.fill(); }
    for (const hx of [-11.4, -17.4]) for (let z = 0.1; z < 12.5; z += 0.72) { const col = shade(hex(0x8d8a82), 0.9 + R() * 0.16); rect(g, P(hx) + R.int(3) - 1, P(z), 20, 20, css(col)); rect(g, P(hx), P(z), 20, 1, css(shade(col, 1.12))); } // stepping-stone paths
    rect(g, P(-14.6), gz0, 4, gh, H(0x3a2e24)); // fence line (the fence itself is built later)
  }
  {
    const x0 = P(YARD.x1 + 0.28), z0 = P(1.5), w = P(GX1 - YARD.x1), h = P(YARD.z1 + 0.3 - 1.5);
    rect(g, x0, z0, w, h, H(0x7b7972));
    for (let x = x0; x < x0 + w; x += 96) rect(g, x, z0, 1, h, H(0x4c4a46));
    for (let z = z0; z < z0 + h; z += 96) rect(g, x0, z, w, 1, H(0x4c4a46));
    for (let k = 0; k < 9; k++) { let cx = x0 + R.int(w), cz = z0 + R.int(h); for (let i = 0; i < 40 + R.int(60); i++) { rect(g, cx, cz, 1, 1, H(0x45433f)); cx += R.int(3) - 1; cz += R() < 0.7 ? 1 : 0; if (R() < 0.08) rect(g, cx, cz, 2, 2, H(R.pick([0x5a7644, 0x4a6238]))); } }
    for (let k = 0; k < 8; k++) { g.fillStyle = "rgba(30,28,30,0.28)"; g.beginPath(); g.ellipse(x0 + R.int(w), z0 + R.int(h), 8 + R.int(18), 5 + R.int(10), R(), 0, 7); g.fill(); }
  }
  {
    const z0 = P(YARD.z1 + 0.28), h = P(3.6);
    rect(g, P(GX0), z0, fullW, h, H(0x3c3b3a));
    const tones = [0x77736c, 0x6b6862, 0x827d74, 0x5e5c58, 0x74685e].map(hex);
    for (let j = 0; j * 5 < h; j++) for (let x = P(GX0) - (j & 1 ? 3 : 0); x < P(GX1); x += 6) { const col = shade(R.pick(tones), 0.9 + R() * 0.2); rect(g, x, z0 + j * 5, 5, 4, css(col)); if (R() < 0.3) rect(g, x, z0 + j * 5, 3, 1, css(shade(col, 1.2))); }
    const z1 = P(YARD.z1 + 0.28 + 3.6), hh = P(GZ1) - z1;
    rect(g, P(GX0), z1, fullW, hh, H(0x4b4945));
    for (let k = 0; k < (fullW * hh) / 14; k++) rect(g, P(GX0) + R.int(fullW), z1 + R.int(hh), 1 + R.int(2), 1, H(R.pick([0x5c5a54, 0x3c3a38, 0x6a665e, 0x45433f])));
    for (let x = GX0 + 1.5; x < GX1; x += 2.6) for (let z = P(19); z < P(23.5); z += 2) if (R() > 0.25) rect(g, P(x), z, 3, 2, "rgba(206,206,198,0.75)"); // faded bays
    for (let k = 0; k < 14; k++) puddle(g, P(GX0) + R.int(fullW), z1 + 20 + R.int(hh - 40), 14 + R.int(34), 6 + R.int(12), R);
    rect(g, P(GX0), z1, fullW, 3, H(0x8d8a82));
  }

  // Ground helpers used while building.
  /** Soft contact darkness round a footprint: the cheapest ambient occlusion there is. */
  const ao = (x0: number, z0: number, x1: number, z1: number, blur = 12, alpha = 0.55) => {
    g.save(); g.shadowColor = `rgba(10,10,16,${alpha})`; g.shadowBlur = blur; g.shadowOffsetX = 5000; g.shadowOffsetY = 0; g.fillStyle = "#000";
    g.fillRect(P(x0) - 5000, P(z0), P(x1) - P(x0), P(z1) - P(z0)); g.restore();
  };
  /** A reflection in the wet: broken dashes dragged toward the camera from the foot of a bright thing. */
  const streak = (x: number, z: number, w: number, len: number, col: number, a: number) => {
    const n = P(len), c = hex(col);
    for (let k = 0; k < n; k++) {
      const t = k / n; if (R() < 0.18 + t * 0.5) continue;
      const inset = Math.round(t * P(w) * 0.25) + R.int(3);
      rect(g, P(x) + Math.round(k * 0.305) + inset, P(z) + k, Math.max(1, P(w) - inset * 2 - R.int(4)), 1, css(c, a * (1 - t) ** 1.4));
    }
  };
  const solid = (x0: number, z0: number, x1: number, z1: number, h: number, o: { ao?: boolean; shade?: boolean } = {}) => {
    colliders.push({ x0, z0, x1, z1, h });
    if (o.shade ?? h > 1.6) shaders.push({ x0, z0, x1, z1, h });
    if (o.ao ?? true) { ao(x0, z0, x1, z1, Math.min(18, 6 + h * 3), 0.5); ao(x0, z0, x1, z1, 4, 0.5); }
  };
  const halo = (p: V3, size: number, col: number, alpha: number, squash = 1) => {
    const hw = size / 2, r = RIGHT, u = UP, q = (sx: number, sy: number): V3 => [p[0] + r.x * sx * hw + u.x * sy * hw * squash, p[1] + (u.y * sy * hw * squash) / STRETCH, p[2] + r.z * sx * hw + u.z * sy * hw * squash];
    GL.quad(q(-1, -1), q(1, -1), q(1, 1), q(-1, 1), { c: col }, { alpha });
  };
  /** A pool of light lying on the ground. */
  const pool = (x: number, z: number, rx: number, rz: number, col: number, alpha: number, y = 0.03) => GL.quad([x - rx, y, z + rz], [x + rx, y, z + rz], [x + rx, y, z - rz], [x - rx, y, z - rz], { c: col }, { alpha });

  // Shared swatches.
  const rBrick = atlas.paintM(2, 2, (c, w, h) => { brick(c, 0, 0, w, h, BRICK_RED, rng(3)); weather(c, 0, 0, w, h, rng(4), 0.25, 0.1, 3); });
  const rBrickDark = atlas.paintM(2, 2, (c, w, h) => { brick(c, 0, 0, w, h, BRICK_DARK, rng(5)); });
  const rStone = atlas.paint(32, 8, (c, w, h) => { rect(c, 0, 0, w, h, H(0xb9b3a2)); grain(c, 0, 0, w, h, 8, 2); rect(c, 0, 0, w, 1, H(0xd4cebc)); rect(c, 0, h - 1, w, 1, H(0x7c776a)); });
  const rFelt = atlas.paint(32, 32, (c, w, h) => { rect(c, 0, 0, w, h, H(0x4a4c50)); grain(c, 0, 0, w, h, 9, 5); });
  const rWood = atlas.paint(58, 24, (c, w, h) => art.woodTop(c, w, h, 14));
  const col = (c: number, c2?: number) => ({ c, c2 });

  // -------------------------------------------------------------------------------------------
  // THE THREE LIONS
  {
    const { x0, x1, z0, z1, eaves, ridge } = PUB, zr = (z0 + z1) / 2;
    const rFront = atlas.paintM(7, eaves, art.pubFront), rGable = atlas.paintM(5, ridge, art.pubGable), rSlate = atlas.paintM(7.6, 3.6, (c, w, h) => art.slateRoof(c, w, h, 5));
    const ge = 1 - eaves / ridge;
    A.quad([x0, 0, z1], [x1, 0, z1], [x1, eaves, z1], [x0, eaves, z1], rFront);
    A.quad([x1, 0, z1], [x1, 0, z0], [x1, eaves, z0], [x1, eaves, z1], { r: rGable, uv: [0, ge, 1, 1] });
    A.tri([x1, eaves, z1], [x1, eaves, z0], [x1, ridge, zr], rGable, [[0, ge], [1, ge], [0.5, 0]]);
    A.quad([x1, 0, z0], [x0, 0, z0], [x0, eaves, z0], [x1, eaves, z0], { r: rBrick, c: 0xb0b0b0 });
    A.quad([x0, 0, z0], [x0, 0, z1], [x0, eaves, z1], [x0, eaves, z0], { r: rBrick, c: 0xb0b0b0 });
    A.tri([x0, eaves, z0], [x0, eaves, z1], [x0, ridge, zr], { r: rBrick }, [[0, 1], [1, 1], [0.5, 0]]);
    // roof
    const oh = 0.35, ey = eaves - oh * ROOF_T, ov = 0.28;
    A.quad([x0 - ov, ey, z1 + oh], [x1 + ov, ey, z1 + oh], [x1 + ov, ridge, zr], [x0 - ov, ridge, zr], rSlate);
    A.quad([x1 + ov, ey, z0 - oh], [x0 - ov, ey, z0 - oh], [x0 - ov, ridge, zr], [x1 + ov, ridge, zr], rSlate);
    A.box(x0 - ov, ey - 0.16, z1 + oh - 0.12, x1 + ov, ey + 0.03, z1 + oh + 0.06, col(0x1b1c20)); // gutter
    A.bar([x1 + ov, ey - 0.02, z1 + oh], [x1 + ov, ridge - 0.04, zr], 0.14, col(0xcfc8b2)); A.bar([x1 + ov, ridge - 0.04, zr], [x1 + ov, ey - 0.02, z0 - oh], 0.14, col(0xbdb6a0)); // barge boards
    A.bar([x0 - ov, ridge + 0.04, zr], [x1 + ov, ridge + 0.04, zr], 0.2, col(0x343a44)); // ridge tiles
    // a rooflight over the landing, and pigeons, who own the ridge
    {
      const sp = (x: number, t: number, lift = 0.05): V3 => [x, ey + (ridge - ey) * t + lift, z1 + oh + (zr - z1 - oh) * t + lift * 0.6];
      const rSky = atlas.paint(34, 30, (c, w, h) => { rect(c, 0, 0, w, h, H(0x23262b)); art.litGlass(c, 3, 3, w - 6, h - 6, 3); rect(c, w / 2 - 1, 3, 2, h - 6, H(0x23262b)); rect(c, 3, 3, w - 6, 1, H(0xfff0c0)); });
      U.quad(sp(x0 + 2.3, 0.3), sp(x0 + 3.4, 0.3), sp(x0 + 3.4, 0.62), sp(x0 + 2.3, 0.62), rSky);
      const rPig = atlas.paint(9, 7, (c) => { c.clearRect(0, 0, 9, 7); rect(c, 1, 2, 6, 3, H(0x8a8f9a)); rect(c, 5, 0, 3, 3, H(0x6f7480)); rect(c, 8, 1, 1, 1, H(0xe0a040)); rect(c, 0, 3, 2, 1, H(0x5a5e68)); rect(c, 2, 3, 3, 1, H(0xb9bec8)); rect(c, 3, 5, 1, 2, H(0xc86a5a)); rect(c, 5, 5, 1, 2, H(0xc86a5a)); rect(c, 6, 2, 1, 1, H(0x4a8a6a)); }, false);
      for (const [px, fl] of [[x0 + 2.0, false], [x0 + 2.5, true], [x0 + 4.6, false]] as [number, boolean][]) A.quad([px, ridge + 0.12, zr + 0.05], [px + 0.3, ridge + 0.12, zr + 0.05], [px + 0.3, ridge + 0.34, zr + 0.05], [px, ridge + 0.34, zr + 0.05], { r: rPig, flip: fl }, { normal: [0, 1, 0.3], double: true });
    }
    // chimneys, pots, an aerial
    for (const cx of [x1 - 1.3, x0 + 0.5]) {
      A.box(cx, ridge - 0.9, zr - 0.5, cx + 0.8, ridge + 1.0, zr + 0.5, { all: { r: rBrick, uv: [0, 0, 0.4, 0.95] }, top: rStone });
      A.box(cx - 0.07, ridge + 1.0, zr - 0.57, cx + 0.87, ridge + 1.1, zr + 0.57, rStone);
      for (const pz of [-0.25, 0.25]) A.cyl(cx + 0.4, ridge + 1.1, ridge + 1.55, zr + pz, 0.15, 6, col(0x9a5536, 0xb86a44), col(0x2a1c16), 0.12);
    }
    A.bar([x1 - 0.7, ridge + 1.1, zr], [x1 - 0.7, ridge + 2.5, zr], 0.05, col(0x3a3d42));
    for (const [yy, hw] of [[2.4, 0.5], [2.15, 0.38], [1.9, 0.5]]) A.bar([x1 - 0.7 - hw, ridge + yy, zr], [x1 - 0.7 + hw, ridge + yy, zr], 0.04, col(0x3a3d42));
    // timber front: fascia, cornice, pilasters, step
    const rSign = atlas.paint(424, 42, art.pubSign);
    A.box(x0 + 0.1, 2.55, z1, x1 - 0.1, 3.25, z1 + 0.12, { all: col(art.GREEN_D), s: rSign, top: col(0x2a6a4a) });
    A.box(x0 - 0.06, 3.25, z1, x1 + 0.06, 3.43, z1 + 0.24, { all: col(0x1a4a33, 0x26684a), top: col(0x3a8060) });
    A.box(x0 - 0.02, 3.2, z1, x1 + 0.02, 3.26, z1 + 0.18, col(art.GOLD));
    for (const [a, b] of [[0, 0.3], [2.3, 2.6], [3.7, 4.0], [6.7, 7.0]]) A.box(x0 + a, 0, z1, x0 + b, 2.55, z1 + 0.08, { all: col(0x174a32, 0x226244), e: col(0x10301f, 0x18452f) });
    A.box(x0 + 2.5, 0, z1, x0 + 3.8, 0.1, z1 + 0.42, rStone);
    for (const cx of [1.25, 3.5, 5.75]) A.box(x0 + cx - 0.62, 3.97, z1, x0 + cx + 0.62, 4.05, z1 + 0.12, rStone);
    // lit glass (unlit material: it glows whatever the weather)
    const rWinA = atlas.paintM(2.0, 1.7, (c, w, h) => art.pubGlass(c, w, h, 0)), rWinB = atlas.paintM(2.7, 1.7, (c, w, h) => art.pubGlass(c, w, h, 1)), rDoor = atlas.paintM(1.1, 2.45, (c, w, h) => art.pubGlass(c, w, h, 2));
    const glass = (a: number, b: number, y0: number, y1: number, r: Region) => U.quad([x0 + a, y0, z1 + 0.015], [x0 + b, y0, z1 + 0.015], [x0 + b, y1, z1 + 0.015], [x0 + a, y1, z1 + 0.015], r);
    glass(0.3, 2.3, 0.75, 2.45, rWinA); glass(4.0, 6.7, 0.75, 2.45, rWinB); glass(2.6, 3.7, 0.1, 2.5, rDoor);
    const rUp = atlas.paint(32, 48, (c, w, h) => { rect(c, 0, 0, w, h, H(0xe6dfcc)); art.litGlass(c, 2, 2, w - 4, h - 4, 4); rect(c, 2, 2, 6, h - 4, H(0x9a3a2a)); rect(c, w - 8, 2, 6, h - 4, H(0x9a3a2a)); rect(c, 2, h / 2 - 1, w - 4, 2, H(0xe6dfcc)); rect(c, w / 2, 2, 1, h - 4, H(0xd2cab6)); rect(c, 12, 26, 8, h, H(0x4a2a1a)); rect(c, 13, 21, 6, 6, H(0x4a2a1a)); });
    glass(0.75, 1.75, 4.05, 5.55, rUp);
    // warm light: halos on the glass, pools and long reflections on the wet yard
    for (const [cx, w] of [[1.3, 2.0], [5.35, 2.7], [3.15, 1.0]]) {
      halo([x0 + cx, 1.5, z1 + 0.3], w * 1.9, art.WARM, 0.2);
      pool(x0 + cx + 0.25, z1 + 1.3, w * 0.75, 1.5, art.WARM, 0.2);
      streak(x0 + cx - w / 2 + 0.1, z1 + 0.12, w - 0.2, 2.8, 0xffcf7a, 0.46);
    }
    halo([x0 + 1.25, 4.8, z1 + 0.3], 1.9, art.WARM, 0.2);
    // lanterns either side of the door
    for (const lx of [2.45, 3.85]) {
      A.box(x0 + lx - 0.09, 2.08, z1 + 0.08, x0 + lx + 0.09, 2.14, z1 + 0.3, col(0x15161a)); A.box(x0 + lx - 0.11, 2.42, z1 + 0.08, x0 + lx + 0.11, 2.48, z1 + 0.32, col(0x15161a));
      U.box(x0 + lx - 0.07, 2.14, z1 + 0.11, x0 + lx + 0.07, 2.42, z1 + 0.27, col(0xffe2a0));
      halo([x0 + lx, 2.28, z1 + 0.35], 1.3, 0xffc060, 0.5);
    }
    // hanging baskets
    const rFl = [atlas.paint(22, 20, (c, w, h) => art.flowers(c, w, h, 1), false), atlas.paint(22, 20, (c, w, h) => art.flowers(c, w, h, 2), false)];
    [0.15, 2.45, 3.85, 6.85].forEach((bx, i) => {
      const cx = x0 + bx, cz = z1 + 0.62, r = rFl[i % 2];
      A.bar([cx, 2.95, z1 + 0.12], [cx, 2.95, cz + 0.05], 0.05, col(0x15161a)); A.bar([cx, 2.95, cz], [cx, 2.62, cz], 0.03, col(0x15161a));
      A.cyl(cx, 2.3, 2.56, cz, 0.14, 6, col(0x3a2a1c, 0x5a4028), undefined, 0.26);
      A.quad([cx - 0.36, 2.2, cz], [cx + 0.36, 2.2, cz], [cx + 0.36, 2.88, cz], [cx - 0.36, 2.88, cz], r, { normal: [0, 1, 0.3], double: true });
      A.quad([cx, 2.2, cz + 0.36], [cx, 2.2, cz - 0.36], [cx, 2.88, cz - 0.36], [cx, 2.88, cz + 0.36], r, { normal: [0, 1, 0.3], double: true });
      A.quad([cx - 0.3, 2.6, cz + 0.3], [cx + 0.3, 2.6, cz + 0.3], [cx + 0.3, 2.6, cz - 0.3], [cx - 0.3, 2.6, cz - 0.3], { r, uv: [0.1, 0.05, 0.9, 0.75] });
    });
    // the flag out of the upstairs window
    const rFlag = atlas.paint(40, 30, art.englandFlag);
    A.quad([x0 + 5.1, 3.5, z1 + 0.26], [x0 + 6.4, 3.5, z1 + 0.26], [x0 + 6.4, 4.5, z1 + 0.13], [x0 + 5.1, 4.5, z1 + 0.13], rFlag, { double: true });
    // downpipe, standpipe, hose
    A.bar([x1 - 0.22, 0, z1 + 0.07], [x1 - 0.22, ey, z1 + 0.07], 0.1, col(0x1b1c20));
    A.bar([x1 - 0.75, 0, z1 + 0.14], [x1 - 0.75, 1.05, z1 + 0.14], 0.07, col(0x8f959c)); A.box(x1 - 0.83, 0.92, z1 + 0.1, x1 - 0.67, 1.02, z1 + 0.3, col(0xc9a23a)); A.box(x1 - 0.78, 1.02, z1 + 0.16, x1 - 0.72, 1.1, z1 + 0.22, col(0xc8281e));
    {
      const pts: V3[] = [];
      for (let k = 0; k <= 14; k++) { const a = -Math.PI / 2 + (k / 14) * Math.PI * 2.2, rr = 0.22; pts.push([x1 - 0.75 + Math.cos(a) * rr, 0.04 + (k < 3 ? (3 - k) * 0.28 : 0), z1 + 0.5 + Math.sin(a) * rr]); }
      const sx = pts[pts.length - 1][0], sz = pts[pts.length - 1][2];
      for (let k = 1; k <= 16; k++) { const t = k / 16; pts.push([sx + t * 2.4, 0.05, sz + Math.sin(t * 5) * 0.28 + t * 0.9]); }
      for (let k = 0; k < pts.length - 1; k++) A.bar(pts[k], pts[k + 1], 0.07, col(k % 5 === 4 ? 0x2a7a36 : 0x358f40));
      // the drain it runs to, and the wet round it
      const dx = P(x1 + 0.55), dz = P(1.05);
      g.fillStyle = "rgba(20,18,20,0.4)"; g.beginPath(); g.ellipse(dx + 8, dz + 10, 44, 24, 0.2, 0, 7); g.fill();
      rect(g, dx - 1, dz - 1, 18, 18, H(0x1a1a1c)); rect(g, dx, dz, 16, 16, H(0x4a4c50)); for (let k = 2; k < 15; k += 3) rect(g, dx + 2, dz + k, 12, 1, H(0x121214)); rect(g, dx, dz, 16, 1, H(0x74777c));
      puddle(g, P(x1 + 1.7), P(1.9), 22, 9, R);
    }
    // ladder up the gable
    {
      const top: V3 = [x1 - 0.02, 7.75, zr], foot: V3 = [x1 + 1.95, 0, zr];
      for (const dz of [-0.24, 0.24]) A.bar([foot[0], 0, foot[2] + dz], [top[0], top[1], top[2] + dz], 0.07, col(0xa9afb6, 0xd0d5da));
      for (let k = 1; k < 26; k++) { const t = k / 26.5; A.bar([foot[0] + (top[0] - foot[0]) * t, top[1] * t, zr - 0.24], [foot[0] + (top[0] - foot[0]) * t, top[1] * t, zr + 0.24], 0.045, col(0xc3c9cf)); }
      colliders.push({ x0: x1 + 0.9, z0: zr - 0.3, x1: x1 + 2.05, z1: zr + 0.3, h: 2 });
      ao(x1 + 1.8, zr - 0.3, x1 + 2.05, zr + 0.3, 5, 0.6);
    }
    solid(x0, z0, x1, z1, eaves + 1);
    ao(x0, z1, x1, z1 + 0.5, 14, 0.4);
  }

  // The post sign, the A-board, bunting.
  const postTop: V3 = [-3.75, 4.55, 14.55];
  {
    const [px, , pz] = postTop;
    A.box(px - 0.08, 0, pz - 0.08, px + 0.08, 4.55, pz + 0.08, col(0x121316, 0x1c1d22)); A.box(px - 0.16, 0, pz - 0.16, px + 0.16, 0.35, pz + 0.16, col(0x1a1b1e));
    A.cyl(px, 4.55, 4.75, pz, 0.1, 6, col(art.GOLD), col(art.GOLD), 0.02);
    A.bar([px, 4.3, pz], [px + 1.35, 4.3, pz], 0.07, col(0x121316)); A.bar([px, 3.7, pz], [px + 0.6, 4.3, pz], 0.05, col(0x121316));
    const rSw = atlas.paint(70, 90, art.swingSign);
    A.box(px + 0.2, 2.8, pz - 0.04, px + 1.3, 4.2, pz + 0.04, { all: col(0x121316), s: rSw, n: rSw });
    for (const hx of [0.35, 1.15]) A.bar([px + hx, 4.2, pz], [px + hx, 4.3, pz], 0.03, col(0x8f959c));
    solid(px - 0.16, pz - 0.16, px + 0.16, pz + 0.16, 4.5, { shade: false });
    const rCh = atlas.paint(38, 60, art.chalkboard);
    A.at(-3.9, 0, 1.25, -0.25);
    A.quad([-0.3, 0, 0.26], [0.3, 0, 0.26], [0.3, 0.94, 0.03], [-0.3, 0.94, 0.03], rCh); A.quad([0.3, 0, -0.26], [-0.3, 0, -0.26], [-0.3, 0.94, -0.03], [0.3, 0.94, -0.03], col(0x4a3420));
    A.quad([0.3, 0, 0.26], [0.3, 0, -0.26], [0.3, 0.94, -0.03], [0.3, 0.94, 0.03], col(0x4a3420)); A.quad([-0.3, 0, -0.26], [-0.3, 0, 0.26], [-0.3, 0.94, 0.03], [-0.3, 0.94, -0.03], col(0x4a3420));
    A.end();
    solid(-4.25, 0.95, -3.55, 1.55, 0.9);
  }
  const rBunt = atlas.paint(40, 11, art.bunting, false);
  const buntingRun = (a: V3, b: V3, sag: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.round(len / 1.25));
    const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
    for (let k = 0; k < n; k++) { const p = at(k / n), q = at((k + 1) / n); A.quad([p[0], p[1] - 0.34, p[2]], [q[0], q[1] - 0.34, q[2]], q, p, rBunt, { normal: [0, 1, 0.2], double: true }); }
  };

  // -------------------------------------------------------------------------------------------
  // Yard walls.
  {
    const rW = [atlas.paintM(4, 1.9, (c, w, h) => art.yardWall(c, w, h, 2)), atlas.paintM(4, 1.9, (c, w, h) => art.yardWall(c, w, h, 3))];
    const coping = { r: rStone };
    const wallZ = (x: number, z0: number, z1: number, h: number) => { // runs north-south, 0.28 thick, x is its west face
      for (let z = z0, i = 0; z < z1 - 0.01; z += 4, i++) { const ze = Math.min(z1, z + 4), f = { r: rW[0], uv: [0, 1 - h / 1.9, (ze - z) / 4, 1] as [number, number, number, number], flip: i % 2 === 1 }; A.box(x, 0, z, x + 0.28, h, ze, { e: f, w: f, s: { r: rBrick, uv: [0, 0, 0.14, 0.9] }, n: col(0x6a4a40), top: null }); }
      A.box(x - 0.04, h, z0, x + 0.32, h + 0.08, z1, coping);
      solid(x, z0, x + 0.28, z1, h);
    };
    const wallX = (z: number, x0: number, x1: number, h: number, sign = -1) => {
      for (let x = x0, i = 0; x < x1 - 0.01; x += 4, i++) { const xe = Math.min(x1, x + 4), f = { r: rW[i === sign ? 1 : 0], uv: [0, 1 - h / 1.9, (xe - x) / 4, 1] as [number, number, number, number], flip: i % 2 === 1 && i !== sign }; A.box(x, 0, z, xe, h, z + 0.28, { s: f, n: f, e: { r: rBrick, uv: [0, 0, 0.14, 0.9] }, w: col(0x6a4a40), top: null }); }
      A.box(x0, h, z - 0.04, x1, h + 0.08, z + 0.32, coping);
      solid(x0, z, x1, z + 0.28, h);
    };
    wallZ(YARD.x1, PUB.z0, YARD.z1 + 0.28, 1.9);
    wallZ(YARD.x0 - 0.28, PUB.z1, YARD.z1 + 0.28, 1.9);
    wallX(YARD.z1, YARD.x0 - 0.28, -2.6, 1.15, 0); wallX(YARD.z1, -1.2, YARD.x1 + 0.28, 1.15);
    // gate piers either side of the gap in the south wall, with stone balls, because the pub has pretensions
    for (const gx of [-2.75, -1.25]) { A.box(gx - 0.2, 0, YARD.z1 - 0.08, gx + 0.2, 1.5, YARD.z1 + 0.36, { all: { r: rBrick, uv: [0, 0, 0.2, 0.75] } }); A.box(gx - 0.25, 1.5, YARD.z1 - 0.13, gx + 0.25, 1.6, YARD.z1 + 0.41, rStone); A.cyl(gx, 1.6, 1.9, YARD.z1 + 0.14, 0.16, 6, col(0xa9a392, 0xc9c3b2), col(0xc9c3b2), 0.1); solid(gx - 0.2, YARD.z1 - 0.08, gx + 0.2, YARD.z1 + 0.36, 1.5, { shade: false }); }
    // a pole on the east wall for the bunting, with the yard's security light on it
    const pole: V3 = [YARD.x1 + 0.14, 4.3, 6.4];
    A.bar([pole[0], 1.9, pole[2]], pole, 0.09, col(0x6f757c, 0x9aa0a6)); A.box(pole[0] - 0.3, 4.05, pole[2] - 0.1, pole[0] - 0.02, 4.25, pole[2] + 0.1, col(0x1a1b1e)); U.quad([pole[0] - 0.28, 4.07, pole[2] + 0.101], [pole[0] - 0.04, 4.07, pole[2] + 0.101], [pole[0] - 0.04, 4.23, pole[2] + 0.101], [pole[0] - 0.28, 4.23, pole[2] + 0.101], col(0xfff4d6));
    halo([pole[0] - 0.16, 4.15, pole[2] + 0.2], 1.3, 0xfff0c8, 0.35);
    buntingRun([PUB.x1 + 0.2, 6.0, PUB.z1 + 0.3], pole, 0.75);
  }

  // -------------------------------------------------------------------------------------------
  // The dray.
  {
    const LX = -2.6, LZ = 8.8;
    const rCabS = atlas.paintM(1.88, 1.88, art.cabSide), rCabF = atlas.paintM(2.34, 1.88, art.cabFront), rDeck = atlas.paintM(4.35, 2.4, art.deckTop), rSide = atlas.paint(280, 28, art.draySide), rWheel = atlas.paint(30, 30, art.wheel, false), rCabT = atlas.paintM(1.88, 2.34, art.cabTop);
    A.at(LX, 0, LZ);
    for (const wx of [1.0, 2.0, 5.35]) A.box(wx - 0.47, 0, 2.02, wx + 0.47, 0.94, 2.38, { all: col(0x18181a), s: rWheel, top: col(0x232428) });
    for (const wx of [1.0, 2.0, 5.35]) A.box(wx - 0.47, 0, 0.02, wx + 0.47, 0.94, 0.38, col(0x18181a));
    A.box(0.1, 0.46, 0.3, 6.3, 0.8, 2.1, col(0x1c1d20, 0x2a2b30));
    A.box(0, 0.8, 0, 4.35, 0.96, 2.4, { all: col(0x8a3d12, 0xb8521a), top: rDeck });
    A.box(0, 0.96, 2.33, 4.35, 1.4, 2.4, { all: col(art.ORANGE), s: rSide, top: col(0xf08a3a) });
    A.box(0, 0.96, 0, 4.35, 1.4, 0.07, { all: col(art.ORANGE), top: col(0xf08a3a) });
    A.box(0, 0.96, 0.07, 0.07, 1.4, 2.33, { all: col(0xc85a18), top: col(0xf08a3a) });
    A.box(4.28, 0.96, 0.05, 4.42, 2.45, 2.35, { all: col(0x26272b, 0x3a3c42), top: col(art.ORANGE) });
    for (const hz of [0.4, 1.2, 2.0]) A.box(4.24, 1.5, hz - 0.03, 4.29, 2.4, hz + 0.03, col(0x4a4c52));
    A.box(4.5, 0.6, 0.03, 6.38, 2.48, 2.37, { all: col(art.ORANGE), s: rCabS, e: rCabF, top: rCabT });
    A.box(6.38, 0.42, 0.02, 6.52, 0.74, 2.38, col(0x1c1d20, 0x34363c));
    A.box(6.38, 2.26, 0.08, 6.62, 2.34, 2.32, col(0x1a1a1c));
    for (const mz of [2.37, -0.15]) { A.box(6.12, 1.62, mz, 6.26, 2.2, mz + 0.18, col(0x18181a)); }
    A.bar([4.46, 0.9, 0.32], [4.46, 2.85, 0.32], 0.11, col(0x6f757c, 0xb9bec4));
    A.box(4.7, 0.3, 2.2, 5.0, 0.62, 2.4, col(0x1c1d20)); // step
    U.at(LX, 0, LZ).box(5.3, 2.48, 0.95, 5.5, 2.6, 1.45, col(0xffb020)).end();
    A.end();
    halo([LX + 5.4, 2.6, LZ + 1.2], 1.1, 0xff9a20, 0.5);
    for (const hz of [0.3, 2.1]) halo([LX + 6.5, 1.35, LZ + hz], 0.9, 0xfff0c0, 0.35);
    // kegs on the deck: a full floor of them and a second tier up against the headboard
    for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) {
      const kx = LX + 0.38 + i * 0.455, kz = LZ + 0.5 + j * 0.455;
      if (i === 0 && j > 1) continue; if (i === 1 && j === 3) continue;
      kegs.push({ x: kx + (R() - 0.5) * 0.03, y: 0.96, z: kz + (R() - 0.5) * 0.03, loose: false });
      if (i >= 5 && (i + j) % 5 !== 0 && j < 3) kegs.push({ x: kx + 0.2, y: 1.54, z: kz + 0.22, loose: false });
    }
    solid(LX, LZ, LX + 6.5, LZ + 2.4, 1.5, { shade: true }); shaders.push({ x0: LX + 4.3, z0: LZ, x1: LX + 6.4, z1: LZ + 2.4, h: 2.5 });
    g.fillStyle = "rgba(14,12,14,0.45)"; g.beginPath(); g.ellipse(P(LX + 5.0), P(LZ + 1.3), 26, 16, 0, 0, 7); g.fill(); // what drips out of an old Leyland
    g.fillStyle = "rgba(60,90,130,0.2)"; g.beginPath(); g.ellipse(P(LX + 5.3), P(LZ + 1.5), 14, 7, 0.4, 0, 7); g.fill();
  }

  // The loose stack: three on the cobbles and one on top, by the cellar door.
  {
    const kx = 1.35, kz = 0.95;
    kegs.push({ x: kx - 0.25, y: 0, z: kz - 0.12, loose: true }, { x: kx + 0.24, y: 0, z: kz - 0.16, loose: true }, { x: kx + 0.02, y: 0, z: kz + 0.28, loose: true }, { x: kx, y: 0.585, z: kz - 0.02, loose: true, on: [] });
    kegs[kegs.length - 1].on = [kegs.length - 4, kegs.length - 3, kegs.length - 2];
    ao(kx - 0.45, kz - 0.4, kx + 0.45, kz + 0.5, 8, 0.6);
    g.fillStyle = "rgba(40,26,14,0.3)"; g.beginPath(); g.ellipse(P(kx + 0.5), P(kz + 0.6), 30, 14, 0.5, 0, 7); g.fill(); // spilt beer
  }

  // Crates.
  {
    const rB = [atlas.paint(14, 10, (c, w, h) => art.crateSide(c, w, h, 0x2a5a9a)), atlas.paint(14, 10, (c, w, h) => art.crateSide(c, w, h, 0xb8322a))], rT = [atlas.paint(14, 10, (c, w, h) => art.crateTop(c, w, h, 0x2a5a9a)), atlas.paint(14, 10, (c, w, h) => art.crateTop(c, w, h, 0xb8322a))];
    const CX = 3.0, CZ = 0.1;
    A.at(CX, 0, CZ, 0.2).box(-0.23, 0, -0.17, 0.23, 0.31, 0.17, { all: rB[0], top: rT[0] }).end();
    A.at(CX + 0.03, 0.31, CZ + 0.02, -0.25).box(-0.23, 0, -0.17, 0.23, 0.31, 0.17, { all: rB[1], top: rT[1] }).end();
    A.at(CX + 0.6, 0, CZ + 0.3, 1.3).box(-0.23, 0, -0.17, 0.23, 0.31, 0.17, { all: rB[1], top: rT[1] }).end();
    solid(CX - 0.28, CZ - 0.23, CX + 0.3, CZ + 0.25, 0.6); solid(CX + 0.38, CZ + 0.05, CX + 0.8, CZ + 0.56, 0.3);
  }

  // Picnic benches, pints left on them.
  const bench = (cx: number, cz: number, rot: number, pints: number) => {
    const W = col(0x7a5c3e, 0x94714c), Wd = col(0x5c452e, 0x6e5338);
    A.at(cx, 0, cz, rot);
    A.box(-0.92, 0.72, -0.38, 0.92, 0.78, 0.38, { all: Wd, top: rWood });
    for (const s of [-1, 1]) { A.box(-0.92, 0.42, s * 0.78 - 0.14, 0.92, 0.47, s * 0.78 + 0.14, { all: Wd, top: { r: rWood, uv: [0, 0, 1, 0.42] } }); }
    for (const lx of [-0.68, 0.68]) { A.bar([lx, 0, -0.82], [lx, 0.72, -0.26], 0.08, W); A.bar([lx, 0, 0.82], [lx, 0.72, 0.26], 0.08, W); A.bar([lx, 0.4, -0.86], [lx, 0.4, 0.86], 0.07, W); }
    const pr = rng(Math.round(cx * 31 + cz * 7));
    for (let k = 0; k < pints; k++) { const px = -0.7 + pr() * 1.4, pz = -0.25 + pr() * 0.5, full = pr() < 0.6; A.box(px - 0.045, 0.78, pz - 0.045, px + 0.045, 0.78 + (full ? 0.13 : 0.05), pz + 0.045, { all: col(0xc8882a, 0xe8a83a), top: col(0xf4ecd4) }); if (!full) A.box(px - 0.045, 0.83, pz - 0.045, px + 0.045, 0.93, pz + 0.045, { all: col(0xb9c4c8, 0xd8e0e2), top: col(0xe8eef0) }); }
    A.box(0.3, 0.78, 0.12, 0.44, 0.81, 0.26, col(0x9aa0a6, 0xd0d4d8));
    A.end();
    const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)), hx = 0.92 * c + 0.92 * s, hz = 0.92 * s + 0.92 * c;
    solid(cx - hx, cz - hz, cx + hx, cz + hz, 0.75);
    for (let k = 0; k < 14; k++) rect(g, P(cx - 1.4 + R() * 2.8), P(cz - 1.4 + R() * 2.8), 1 + R.int(2), 1, R() < 0.6 ? H(0xe8e2d0) : H(0xd89a4a)); // fag ends
  };
  bench(-6.3, 2.35, 0.04, 3); bench(-5.0, 5.6, -0.22, 2);

  // The phone box.
  {
    const px = 4.05, pz = 4.7, rP = atlas.paintM(0.92, 2.36, art.phoneBox), red = col(0x8a1a14, 0xb5241c);
    A.box(px - 0.46, 0, pz - 0.46, px + 0.46, 2.36, pz + 0.46, { all: rP, top: red });
    A.box(px - 0.5, 2.36, pz - 0.5, px + 0.5, 2.44, pz + 0.5, col(0xb5241c)); A.box(px - 0.42, 2.44, pz - 0.42, px + 0.42, 2.54, pz + 0.42, col(0xb5241c, 0xd03428)); A.box(px - 0.28, 2.54, pz - 0.28, px + 0.28, 2.6, pz + 0.28, col(0xd03428));
    A.box(px - 0.5, 0, pz - 0.5, px + 0.5, 0.06, pz + 0.5, col(0x3a1a18));
    solid(px - 0.46, pz - 0.46, px + 0.46, pz + 0.46, 2.5);
    halo([px, 2.2, pz + 0.5], 1.2, 0xfff2d0, 0.3); streak(px - 0.3, pz + 0.5, 0.6, 1.2, 0xe04a3a, 0.22);
  }

  // Wheelie bins.
  const rBin = [atlas.paint(18, 30, (c, w, h) => art.binSide(c, w, h, 0x2f5a3a, "3L")), atlas.paint(18, 30, (c, w, h) => art.binSide(c, w, h, 0x4a4d54, "PUB")), atlas.paint(18, 30, (c, w, h) => art.binSide(c, w, h, 0x2a4a7a, "12"))];
  const bin = (cx: number, cz: number, rot: number, k: number, open = false) => {
    const lid = [0x356a44, 0x565a62, 0x30568c][k], body = [0x2f5a3a, 0x4a4d54, 0x2a4a7a][k];
    A.at(cx, 0, cz, rot);
    A.box(-0.28, 0.06, -0.33, 0.28, 1.0, 0.33, { all: rBin[k], top: col(0x1a1a1c) });
    if (open) A.quad([-0.3, 1.0, -0.36], [0.3, 1.0, -0.36], [0.3, 1.62, -0.5], [-0.3, 1.62, -0.5], col(lid), { double: true });
    else A.box(-0.31, 1.0, -0.37, 0.31, 1.07, 0.36, { all: col(lid), top: col(lid) });
    if (open) { A.box(-0.22, 0.9, -0.26, 0.22, 1.08, 0.24, { all: col(0x1c1c1e), top: col(0x2a2c30) }); A.box(-0.15, 1.0, -0.1, 0.1, 1.2, 0.16, col(0xe8e4d8, 0xf4f0e6)); }
    A.box(-0.3, 0, 0.2, -0.22, 0.2, 0.4, col(0x121214)); A.box(0.22, 0, 0.2, 0.3, 0.2, 0.4, col(0x121214));
    A.box(-0.2, 0.9, 0.33, 0.2, 0.96, 0.39, col(body));
    A.end();
    solid(cx - 0.36, cz - 0.4, cx + 0.36, cz + 0.4, 1.05, { shade: false });
  };
  bin(-1.05, -4.25, Math.PI / 2 + 0.1, 1, true); bin(-7.9, 12.7, 0.15, 0); bin(4.95, 2.2, -Math.PI / 2, 1);

  // -------------------------------------------------------------------------------------------
  // West: the terrace carries on. Back gardens, a washing line, a shed.
  {
    const rSl = atlas.paintM(6.3, 3.3, (c, w, h) => art.slateRoof(c, w, h, 9));
    [-14.5, -20.5].forEach((hx, i) => {
      const x0 = hx, x1 = hx + 6, z0 = PUB.z0, z1 = -0.3, e = 5.4, zr = (z0 + z1) / 2, rg = e + ((z1 - z0) / 2) * ROOF_T;
      const rH = atlas.paintM(6, e, (c, w, h) => art.houseBack(c, w, h, 40 + i));
      A.quad([x0, 0, z1], [x1, 0, z1], [x1, e, z1], [x0, e, z1], rH);
      A.quad([x0, 0, z0], [x0, 0, z1], [x0, e, z1], [x0, e, z0], { r: rBrick });
      A.quad([x1, 0, z0], [x0, 0, z0], [x0, e, z0], [x1, e, z0], { r: rBrick });
      const ey = e - 0.3 * ROOF_T;
      A.quad([x0, ey, z1 + 0.3], [x1, ey, z1 + 0.3], [x1, rg, zr], [x0, rg, zr], rSl);
      A.quad([x1, ey, z0 - 0.3], [x0, ey, z0 - 0.3], [x0, rg, zr], [x1, rg, zr], rSl);
      A.box(x0, ey - 0.14, z1 + 0.2, x1, ey + 0.02, z1 + 0.36, col(0x1b1c20));
      A.bar([x0, rg + 0.03, zr], [x1, rg + 0.03, zr], 0.18, col(0x343a44));
      A.box(x0 + 0.3, rg - 0.7, zr - 0.45, x0 + 1.0, rg + 0.8, zr + 0.45, { all: { r: rBrick, uv: [0, 0, 0.35, 0.75] }, top: rStone });
      for (const pz of [-0.2, 0.2]) A.cyl(x0 + 0.65, rg + 0.8, rg + 1.2, zr + pz, 0.13, 6, col(0x9a5536, 0xb86a44), col(0x2a1c16), 0.1);
      halo([x0 + 1.5, 1.6, z1 + 0.3], 2.6, art.WARM, 0.2); streak(x0 + 0.8, z1 + 0.1, 1.4, 1.6, 0xffcf7a, 0.2);
      ao(x0, z1, x1, z1 + 0.4, 12, 0.45);
    });
    colliders.push({ x0: -40, z0: PUB.z0, x1: YARD.x0 - 0.28, z1: 40, h: 6 }); shaders.push({ x0: -20.5, z0: PUB.z0, x1: PUB.x0, z1: -0.3, h: 6 });
    // fence between the gardens
    const rFence = atlas.paint(64, 44, (c, w, h) => { const r = rng(90); for (let x = 0; x < w; x += 5) { rect(c, x, 0, 4, h, css(shade(hex(0x6e5a44), 0.85 + r() * 0.25))); rect(c, x + 4, 0, 1, h, H(0x2f261c)); } rect(c, 0, 8, w, 2, H(0x4a3a2a)); rect(c, 0, h - 10, w, 2, H(0x4a3a2a)); const gr = c.createLinearGradient(0, h - 14, 0, h); gr.addColorStop(0, "rgba(20,30,16,0)"); gr.addColorStop(1, "rgba(20,30,16,0.5)"); c.fillStyle = gr; c.fillRect(0, h - 14, w, 14); });
    for (let z = -0.3; z < 13.6; z += 2) A.box(-14.56, 0, z, -14.48, 1.4, Math.min(13.78, z + 2), { all: rFence, top: col(0x4a3a2a) });
    for (let x = GX0; x < YARD.x0 - 0.3; x += 2) A.box(x, 0, YARD.z1, Math.min(YARD.x0 - 0.28, x + 2), 1.4, YARD.z1 + 0.08, { all: rFence, top: col(0x4a3a2a) });
    // washing line: three England shirts that will not dry today
    const rSh = ["10", "7", "4"].map((n) => atlas.paint(20, 22, (c, w, h) => art.shirt(c, w, h, n), false));
    A.bar([-13.9, 0, 6.2], [-13.9, 2.1, 6.2], 0.08, col(0x8a8f96)); A.bar([-9.4, 0, 6.0], [-9.4, 2.1, 6.0], 0.08, col(0x8a8f96)); A.bar([-13.9, 2.05, 6.2], [-9.4, 2.05, 6.0], 0.025, col(0xd8d4c8));
    rSh.forEach((r, i) => { const sx = -13.0 + i * 1.15, sz = 6.16 - i * 0.05; A.quad([sx, 1.32, sz + 0.06], [sx + 0.64, 1.32, sz + 0.06], [sx + 0.64, 2.04, sz], [sx, 2.04, sz], r, { double: true }); });
    // shed
    const rShed = atlas.paint(58, 60, art.shed);
    A.box(-13.6, 0, 10.6, -11.8, 1.85, 12.2, { all: rShed, top: null });
    A.quad([-13.7, 1.8, 12.3], [-11.7, 1.8, 12.3], [-11.7, 2.25, 11.4], [-13.7, 2.25, 11.4], rFelt); A.quad([-11.7, 1.8, 10.5], [-13.7, 1.8, 10.5], [-13.7, 2.25, 11.4], [-11.7, 2.25, 11.4], rFelt);
    A.tri([-11.8, 1.85, 12.2], [-11.8, 1.85, 10.6], [-11.8, 2.25, 11.4], { r: rShed }, [[0, 0.2], [1, 0.2], [0.5, 0]]);
    ao(-13.6, 10.6, -11.8, 12.2, 10, 0.5);
    bin(-9.6, 1.0, Math.PI / 2, 2); bin(-9.6, 1.85, Math.PI / 2, 0);
  }

  // East: three lock-ups and a skip.
  {
    const x0 = YARD.x1 + 0.28, x1 = 13.3, z0 = PUB.z0, z1 = 1.5, h = 2.6;
    const rG = atlas.paintM(x1 - x0, h, art.garages), rT = atlas.paintM(x1 - x0, z1 - z0, (c, w, hh) => art.flatRoof(c, w, hh, 12));
    A.box(x0, 0, z0, x1, h, z1, { s: rG, top: rT, all: { r: rBrickDark, uv: [0, 0, 1, 1] } });
    A.box(x0 - 0.05, h, z1 - 0.1, x1 + 0.05, h + 0.12, z1 + 0.14, col(0x6f7278, 0x8a8d92));
    ao(x0, z1, x1, z1 + 0.4, 12, 0.5); ao(x1, z0, x1 + 0.4, z1, 12, 0.4);
    // boundary wall on to the street, beyond the lock-ups
    for (let x = x1; x < GX1; x += 4) A.box(x, 0, z0, Math.min(GX1, x + 4), 2.0, z0 + 0.28, { all: { r: rBrickDark, uv: [0, 0, 1, 1] }, top: rStone });
    colliders.push({ x0: YARD.x1, z0: PUB.z0, x1: 40, z1: 40, h: 2.6 }); shaders.push({ x0, z0, x1, z1, h });
    const rSk = atlas.paintM(3, 1.15, art.skipSide), rRub = atlas.paintM(3, 1.7, art.rubble);
    A.box(8.3, 0.12, 5.2, 11.3, 1.15, 6.9, { all: col(0xb08a14, 0xe0b21c), s: rSk, top: rRub });
    A.quad([11.3, 0.12, 6.9], [11.75, 1.15, 6.9], [11.75, 1.15, 5.2], [11.3, 0.12, 5.2], col(0xc89e18)); A.tri([11.3, 0.12, 6.9], [11.75, 1.15, 6.9], [11.3, 1.15, 6.9], col(0xd0a61a), [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5]]);
    ao(8.3, 5.2, 11.6, 6.9, 12, 0.55);
  }

  // -------------------------------------------------------------------------------------------
  // Across the street: the parade, and the stadium behind it.
  {
    const zf = STREET.zShops, zb = STREET.zBack, y0 = KERB, hgt = 3.9;
    interface Unit { x0: number; x1: number; cfg: art.ShopCfg; sign?: (c: CanvasRenderingContext2D, w: number, h: number) => void; signH?: number; window?: (c: CanvasRenderingContext2D, w: number, h: number) => void; doorLeft?: boolean; lit?: boolean; cool?: boolean; extra?: number; glow?: number }
    const units: Unit[] = [
      { x0: GX0, x1: -16.5, cfg: { pal: BRICK_STOCK, fascia: 0, frame: 0, kind: "house", seed: 61 }, extra: 0.5 },
      { x0: -16.5, x1: -10.5, cfg: { pal: BRICK_STOCK, fascia: 0xece6d2, frame: 0x2a5a8a, kind: "glass", seed: 62 }, sign: (c, w, h) => art.fasciaSign(c, w, h, "FRY DAYS", 0xece6d2, 0xc0281e, { sub: "FISH · CHIPS · KEBABS", edge: 0x2a5a8a }), window: (c, w, h) => art.shopWindow(c, w, h, 5, false, "OPEN"), lit: true, glow: 0xffd9a0 },
      { x0: -10.5, x1: -5.9, cfg: { pal: BRICK_DARK, fascia: 0x66736a, frame: 0x3a3f44, kind: "shutter", seed: 63 }, sign: (c, w, h) => { art.fasciaSign(c, w, h, "VIDEO WORLD", 0x66736a, 0x8a968c, {}); rect(c, w - 96, 4, 84, h - 8, H(0xf2f0e6)); pixText(c, "TO LET", w - 54, h - 12, 15, H(0xc0281e), { align: "center" }); }, extra: -0.25 },
      { x0: -5.9, x1: 0.1, cfg: { pal: BRICK_RED, fascia: 0x141414, frame: 0x17181c, kind: "glass", seed: 64 }, sign: (c, w, h) => art.fasciaSign(c, w, h, "CASH KINGS", 0xf2c81e, 0x141414, { crown: true, sub: "WE BUY GOLD · PAWNBROKER · CHEQUES CASHED", stripe: 0x141414, edge: 0x141414 }), signH: 1.15, window: art.pawnWindow, doorLeft: true, lit: true, cool: true, extra: 0.35, glow: 0xf2e6a0 },
      { x0: 0.1, x1: 7, cfg: { pal: BRICK_STOCK, fascia: 0x1b6a3c, frame: 0x1b4a30, kind: "glass", seed: 65 }, sign: (c, w, h) => art.fasciaSign(c, w, h, "BET-U-LIKE", 0x1b6a3c, 0xf4f0e0, { sub: "TODAY: ENGLAND TO WIN 11/4", edge: 0xf2c81e }), window: (c, w, h) => art.shopWindow(c, w, h, 7, true, "ODDS"), lit: true, cool: true, glow: 0xd8f0e0 },
      { x0: 7, x1: 13, cfg: { pal: BRICK_DARK, fascia: 0xb8281e, frame: 0x7a1a14, kind: "glass", seed: 66 }, sign: (c, w, h) => art.fasciaSign(c, w, h, "BOOZE & NEWS", 0xb8281e, 0xf8f4ea, { sub: "OFF LICENCE · LOTTERY · VAPES" }), window: (c, w, h) => art.shopWindow(c, w, h, 8, false, "BEER"), doorLeft: true, lit: true, extra: 0.2, glow: 0xffd9a0 },
      { x0: 13, x1: GX1, cfg: { pal: BRICK_RED, fascia: 0, frame: 0, kind: "house", seed: 67 }, extra: 0.6 },
    ];
    const rAc = atlas.paint(32, 19, art.acSide), rAcTop = atlas.paint(32, 26, art.acTop);
    for (const u of units) {
      const w = u.x1 - u.x0, top = y0 + hgt + Math.max(0, u.extra ?? 0), roofY = y0 + hgt - 0.3;
      const rF = atlas.paintM(w, hgt, (c, ww, hh) => art.shopFront(c, ww, hh, u.cfg)), rT = atlas.paintM(w, zf - zb, (c, ww, hh) => art.flatRoof(c, ww, hh, u.cfg.seed));
      const pal = u.cfg.pal === BRICK_STOCK ? 0xb49a70 : u.cfg.pal === BRICK_DARK ? 0x6a5650 : 0x9a5744;
      A.quad([u.x0, y0, zf], [u.x1, y0, zf], [u.x1, y0 + hgt, zf], [u.x0, y0 + hgt, zf], rF);
      if (top > y0 + hgt) A.box(u.x0, y0 + hgt, zf - 0.3, u.x1, top, zf, { all: { r: rF, uv: [0, 0.03, 1, 0.03 + (top - y0 - hgt) / hgt] }, top: rStone });
      A.quad([u.x1, y0, zf], [u.x1, y0, zb], [u.x1, top, zb], [u.x1, top, zf], { r: rBrick, c: pal === 0x9a5744 ? 0xffffff : 0xb0a8a0 });
      A.quad([u.x0, y0, zb], [u.x0, y0, zf], [u.x0, top, zf], [u.x0, top, zb], col(pal));
      A.quad([u.x0, roofY, zf - 0.01], [u.x1, roofY, zf - 0.01], [u.x1, roofY, zb], [u.x0, roofY, zb], rT);
      solid(u.x0, zb, u.x1, zf, 4);
      ao(u.x0, zf, u.x1, zf + 0.45, 12, 0.45);
      if (u.cfg.kind === "house") { halo([u.x0 + w * 0.2 + 0.5, y0 + 1.9, zf + 0.3], 2.0, art.WARM, 0.2); continue; }
      // roof clutter: a vent, a flue, and on one of them a football that is never coming back
      const vr = rng(u.cfg.seed * 3);
      { const vx = u.x0 + 1 + vr() * 2, vz = zb + 1 + vr(); A.box(vx, roofY, vz, vx + 1.0, roofY + 0.6, vz + 0.8, { all: rAc, e: { r: rAc, uv: [0.1, 0, 0.9, 1] }, top: rAcTop }); A.box(vx + 0.1, roofY, vz + 0.8, vx + 0.2, roofY + 0.08, vz + 2.2, col(0x2a2c30)); }
      A.cyl(u.x1 - 1.2, roofY, roofY + 0.8, zb + 1.2 + vr() * 2, 0.12, 6, col(0x5c6066, 0x8a8f96), col(0x1a1a1c));
      if (u.sign) {
        const sh = u.signH ?? 0.72, sy = y0 + 2.38 + (u.signH ? -0.02 : 0), rS = atlas.paint((w - 0.3) * 64, sh * 64, u.sign);
        A.box(u.x0 + 0.15, sy, zf, u.x1 - 0.15, sy + sh, zf + (u.signH ? 0.22 : 0.1), { all: col(u.cfg.fascia || 0x222222), s: rS, top: col(0x8a8a86) });
        if (u.signH) { halo([(u.x0 + u.x1) / 2, sy + sh / 2, zf + 0.4], 4.6, 0xffe680, 0.16, 0.4); streak(u.x0 + 0.6, zf + 0.15, w - 1.2, 4.2, 0xf2d040, 0.36); }
      }
      if (u.cfg.kind === "glass" && u.window) {
        const dw = 1.0, wx0 = u.x0 + 0.2 + (u.doorLeft ? dw + 0.1 : 0), wx1 = u.x1 - 0.2 - (u.doorLeft ? 0 : dw + 0.1), dx0 = u.doorLeft ? u.x0 + 0.2 : u.x1 - 0.2 - dw;
        const rWn = atlas.paintM(wx1 - wx0, 1.86, u.window), rD = atlas.paintM(dw, 2.2, (c, ww, hh) => art.shopDoor(c, ww, hh, u.cfg.frame, !!u.lit, !!u.cool));
        U.quad([wx0, y0 + 0.44, zf + 0.02], [wx1, y0 + 0.44, zf + 0.02], [wx1, y0 + 2.3, zf + 0.02], [wx0, y0 + 2.3, zf + 0.02], rWn);
        U.quad([dx0, y0, zf + 0.02], [dx0 + dw, y0, zf + 0.02], [dx0 + dw, y0 + 2.2, zf + 0.02], [dx0, y0 + 2.2, zf + 0.02], rD);
        halo([(wx0 + wx1) / 2, y0 + 1.4, zf + 0.4], (wx1 - wx0) * 1.5, u.glow ?? 0xffffff, 0.16, 0.6);
        streak(wx0 + 0.1, zf + 0.1, wx1 - wx0 - 0.2, 2.6, u.glow ?? 0xffffff, u === units[3] ? 0.3 : 0.2);
      }
    }
    // a traffic cone on the pawnbroker's roof (nobody knows), a football on the bookie's
    A.cyl(-3.2, y0 + hgt - 0.3, y0 + hgt + 0.3, zb + 1.7, 0.16, 6, { c: 0xe2661c, c2: 0xf08a3a }, col(0xf08a3a), 0.04); A.cyl(-3.2, y0 + hgt - 0.05, y0 + hgt + 0.08, zb + 1.7, 0.1, 6, col(0xf2efe6), undefined, 0.08);
    A.cyl(3.4, y0 + hgt - 0.3, y0 + hgt - 0.12, zb + 2.4, 0.11, 6, col(0xd8d4c8, 0xf4f0e6), col(0xf4f0e6), 0.11);
    colliders.push({ x0: -60, z0: -60, x1: 60, z1: zf, h: 4 });

    // The totem.
    const tx = 1.3, tz = -11.5, rTot = atlas.paint(116, 250, art.totem);
    A.box(tx - 0.9, y0, tz - 0.14, tx + 0.9, y0 + 3.9, tz + 0.14, { all: col(0x163f7e, 0x1c4f9c), s: rTot, n: rTot, top: col(0x2a62b8) });
    A.box(tx - 0.98, y0, tz - 0.22, tx + 0.98, y0 + 0.1, tz + 0.22, col(0x4a4d54));
    solid(tx - 0.9, tz - 0.14, tx + 0.9, tz + 0.14, 3.9);

    // A pillar box, a lamp post, a litter bin: the furniture of a street.
    const rPb = atlas.paint(44, 44, art.postBox);
    A.cyl(-6.6, y0, y0 + 1.42, -11.45, 0.24, 8, rPb, col(0x8a1a14)); A.cyl(-6.6, y0 + 1.42, y0 + 1.56, -11.45, 0.27, 8, col(0x9a1e18, 0xc02a20), col(0xc02a20), 0.12);
    solid(-6.85, -11.7, -6.35, -11.2, 1.5, { shade: false });
    const lamp = (lx: number, lz: number) => {
      A.cyl(lx, y0, y0 + 0.9, lz, 0.11, 6, col(0x2a2d32, 0x3a3e44)); A.bar([lx, y0 + 0.9, lz], [lx, y0 + 5.6, lz], 0.1, col(0x3a3e44, 0x5a5f66)); A.bar([lx, y0 + 5.55, lz], [lx, y0 + 5.75, lz + 1.1], 0.08, col(0x5a5f66));
      A.box(lx - 0.13, y0 + 5.66, lz + 0.85, lx + 0.13, y0 + 5.8, lz + 1.4, col(0x4a4f56, 0x6a6f76)); U.box(lx - 0.1, y0 + 5.6, lz + 0.9, lx + 0.1, y0 + 5.67, lz + 1.36, { all: col(0xffb070), bot: col(0xffb070) });
      halo([lx, y0 + 5.6, lz + 1.15], 2.6, 0xff9a50, 0.42); pool(lx + 0.4, lz + 1.4, 2.4, 1.7, 0xff9a50, 0.2);
      solid(lx - 0.12, lz - 0.12, lx + 0.12, lz + 0.12, 5, { shade: false });
    };
    lamp(-8.2, -12.0); lamp(8.6, -12.0);
    A.box(4.2, y0, -11.85, 4.65, y0 + 0.95, -11.4, { all: col(0x1a1b1e, 0x2c2e33), top: col(0x121214) }); A.box(4.17, y0 + 0.95, -11.88, 4.68, y0 + 1.02, -11.37, col(0x34363c)); solid(4.2, -11.85, 4.65, -11.4, 1, { shade: false });

    // Match-day closures at both ends of the street: this is as far as the model goes.
    const rBar = [atlas.paint(70, 36, (c, w, h) => art.barrier(c, w, h, "POLICE"), false), atlas.paint(70, 36, (c, w, h) => art.barrier(c, w, h, null), false)], rRs = atlas.paint(64, 44, art.roadSign);
    for (const bx of [-10.4, 10.9]) {
      for (let k = 0; k < 2; k++) { const z = STREET.zFar + 0.25 + k * 2.2; A.quad([bx, 0, z + 2.15], [bx + 0.5, 0, z], [bx + 0.5, 1.12, z], [bx, 1.12, z + 2.15], rBar[k], { double: true, normal: [0.3, 0.9, 0.3] }); }
      A.box(bx + 0.5, 0, -8.9, bx + 0.6, 1.5, -8.8, col(0x8f959c)); A.at(bx + 0.55, 0, -8.85, 0.25).box(-0.5, 0.75, 0.06, 0.5, 1.45, 0.1, { all: col(0x8f959c), s: rRs }).end();
      for (const [cx, cz] of [[0.9, -7.0], [1.0, -9.9], [-0.5, -6.8]]) { A.cyl(bx + cx, 0.04, 0.62, cz, 0.15, 6, { c: 0xe2661c, c2: 0xf08a3a }, col(0xf08a3a), 0.04); A.cyl(bx + cx, 0.3, 0.42, cz, 0.105, 6, col(0xf2efe6), undefined, 0.085); A.box(bx + cx - 0.2, 0, cz - 0.2, bx + cx + 0.2, 0.04, cz + 0.2, col(0x1c1d20)); }
      colliders.push({ x0: bx - 0.1, z0: STREET.zFar - 0.4, x1: bx + 0.7, z1: STREET.zNear + 0.3, h: 1.1 });
    }
    colliders.push({ x0: -60, z0: -20, x1: -10.3, z1: PUB.z0 + 0.01, h: 1 }, { x0: 11.5, z0: -20, x1: 60, z1: PUB.z0 + 0.01, h: 1 });

    // The stadium: a painted flat behind the shops, pale with distance.
    const bw = 32, bh = 11, rBd = atlas.paint(bw * PXM, bh * PXM, art.stadiumBackdrop), bz = zb - 0.4, bx0 = -20;
    U.quad([bx0, 0, bz], [bx0 + bw, 0, bz], [bx0 + bw, bh, bz], [bx0, bh, bz], rBd);
    U.quad([bx0 - 30, 0, bz], [bx0, 0, bz], [bx0, bh, bz], [bx0 - 30, bh, bz], { r: rBd, uv: [0, 0, 0.002, 1] });
    U.quad([bx0 + bw, 0, bz], [bx0 + bw + 30, 0, bz], [bx0 + bw + 30, bh, bz], [bx0 + bw, bh, bz], { r: rBd, uv: [0.998, 0, 1, 1] });
    U.quad([bx0 - 30, bh, bz], [bx0 + bw + 30, bh, bz], [bx0 + bw + 30, bh + 14, bz], [bx0 - 30, bh + 14, bz], { r: rBd, uv: [0.001, 0, 0.002, 0.004] });
    halo([bx0 + 18.6, 6.72, bz + 0.3], 3.4, 0xfff4d0, 0.34); halo([bx0 + 3.0, 5.7, bz + 0.3], 2.0, 0xfff4d0, 0.25); halo([bx0 + 29.4, 6.0, bz + 0.3], 2.2, 0xfff4d0, 0.25);
  }

  // -------------------------------------------------------------------------------------------
  // Last coats on the ground: road furniture, puddles, wet sheen, litter, grit.
  {
    // KEEP CLEAR across the mouth of the yard
    g.save(); g.translate(P(2.0), P(-4.2)); g.scale(1, 1.55); g.globalAlpha = 0.62;
    pixText(g, "KEEP", 0, 0, 22, H(0xcfa92c), { align: "center" }); pixText(g, "CLEAR", 0, 30, 22, H(0xcfa92c), { align: "center" });
    g.restore();
    for (let k = 0; k < 900; k++) { const x = P(-0.5) + R.int(P(5)), z = P(-5.6) + R.int(P(3.4)); rect(g, x, z, 1 + R.int(2), 1, css(R.pick(PAVERS), 0.9)); } // worn through
    // manhole and gullies
    g.fillStyle = H(0x1c1d20); g.beginPath(); g.arc(P(3.4), P(-8.2), 12, 0, 7); g.fill(); g.fillStyle = H(0x55585e); g.beginPath(); g.arc(P(3.4), P(-8.2), 10, 0, 7); g.fill(); for (let k = -8; k < 9; k += 4) rect(g, P(3.4) - 7, P(-8.2) + k, 14, 1, H(0x2a2c30));
    for (const gx of [-7, 5.5, 14]) { rect(g, P(gx), P(STREET.zFar) + 1, 14, 9, H(0x141416)); for (let k = 1; k < 13; k += 3) rect(g, P(gx) + k, P(STREET.zFar) + 2, 2, 7, H(0x5a5d62)); }
    // gutters hold the water
    for (let k = 0; k < 16; k++) puddle(g, P(GX0) + R.int(fullW), P(STREET.zFar + 0.55) + R.int(8), 20 + R.int(46), 5 + R.int(5), R);
    for (let k = 0; k < 10; k++) puddle(g, P(GX0) + R.int(fullW), P(STREET.zNear - 0.6) - R.int(8), 16 + R.int(36), 4 + R.int(5), R);
    puddle(g, P(3.3), P(4.2), 30, 12, R); puddle(g, P(-6.6), P(10.9), 36, 13, R); puddle(g, P(3.7), P(-2.6), 26, 10, R); puddle(g, P(0.4), P(11.9), 22, 9, R); puddle(g, P(-2.2), P(5.2), 16, 7, R); puddle(g, P(8.5), P(9.5), 40, 14, R); puddle(g, P(-3), P(15.6), 44, 10, R);
    // sky lying on the wet: long pale smears, leaning the way the camera looks
    g.save(); g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 70; k++) {
      const x = P(GX0) + R.int(fullW), z = P(-11) + R.int(P(30)), len = 50 + R.int(170), w = 8 + R.int(30);
      const gr = g.createLinearGradient(x, z, x + len * 0.305, z + len); gr.addColorStop(0, "rgba(120,140,160,0)"); gr.addColorStop(0.5, `rgba(120,140,160,${0.05 + R() * 0.06})`); gr.addColorStop(1, "rgba(120,140,160,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, z); g.lineTo(x + w, z); g.lineTo(x + w + len * 0.305, z + len); g.lineTo(x + len * 0.305, z + len); g.closePath(); g.fill();
    }
    g.restore();
    // litter: the day is young but people have been here
    for (let k = 0; k < 160; k++) { const x = -8 + R() * 13, z = -5 + R() * 18; rect(g, P(x), P(z), 1, 1, R() < 0.5 ? H(0xe8e2d0) : H(0x2a2420)); }
    for (const [x, z, c] of [[-3.2, 3.4, 0x2a5a9a], [1.2, 6.6, 0xc8281e], [-7.6, 6.8, 0xe8e2d0], [4.6, 9.2, 0x2a5a9a], [0.2, -3.4, 0xe2b64a], [2.9, -9.1, 0xe8e2d0], [-4, -7.2, 0xc8281e]] as [number, number, number][]) { rect(g, P(x), P(z), 3, 2, H(c)); rect(g, P(x), P(z), 3, 1, css(shade(hex(c), 1.3))); rect(g, P(x), P(z) + 2, 3, 1, "rgba(0,0,0,0.4)"); }
    // the far south simply stops being lit: the edge of the board
    const fade = g.createLinearGradient(0, P(20), 0, P(GZ1)); fade.addColorStop(0, "rgba(14,15,20,0)"); fade.addColorStop(1, "rgba(14,15,20,0.9)"); g.fillStyle = fade; g.fillRect(P(GX0), P(20), fullW, P(GZ1 - 20));
    g.setTransform(1, 0, 0, 1, 0, 0);
    grain(g, 0, 0, GW, GH, 5, 99);
  }

  // Ground geometry: one big sheet, and the raised pavements with their kerb faces.
  G.quad([GX0, 0, GZ1], [GX1, 0, GZ1], [GX1, 0, GZ0], [GX0, 0, GZ0], greg(GX0, GZ0, GX1, GZ1));
  G.quad([GX0, KERB, STREET.zFar], [GX1, KERB, STREET.zFar], [GX1, KERB, STREET.zBack], [GX0, KERB, STREET.zBack], greg(GX0, STREET.zBack, GX1, STREET.zFar));
  G.quad([GX0, 0, STREET.zFar], [GX1, 0, STREET.zFar], [GX1, KERB, STREET.zFar], [GX0, KERB, STREET.zFar], { r: greg(GX0, STREET.zFar - 0.14, GX1, STREET.zFar - 0.02), c: 0xd8d8d8 });
  for (const [a, b] of [[GX0, PUB.x1], [YARD.x1, GX1]]) {
    G.quad([a, KERB, PUB.z0], [b, KERB, PUB.z0], [b, KERB, STREET.zNear], [a, KERB, STREET.zNear], greg(a, STREET.zNear, b, PUB.z0));
    G.quad([b, 0, PUB.z0], [b, 0, STREET.zNear], [b, KERB, STREET.zNear], [b, KERB, PUB.z0], { r: greg(b - 0.9, STREET.zNear + 0.02, b - 0.02, STREET.zNear + 0.14), c: 0xa8a8a8 });
  }
  // Skirts: beyond the painted map the board is just dark.
  for (const [x0, z0, x1, z1] of [[-80, -18, GX0, 60], [GX1, -18, 80, 60], [-80, GZ1, 80, 60]]) G.quad([x0, -0.02, z1], [x1, -0.02, z1], [x1, -0.02, z0], [x0, -0.02, z0], { r: greg(GX0 + 0.1, GZ1 - 0.2, GX0 + 0.2, GZ1 - 0.1), c: 0x808080 });

  // -------------------------------------------------------------------------------------------
  // Materials and meshes.
  const tex = (cv: HTMLCanvasElement, nearest = true) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = Math.min(4, maxAniso); t.generateMipmaps = true;
    return t;
  };
  const atlasTex = tex(atlas.canvas), groundTex = tex(gcv);
  const lit = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5, shadowSide: THREE.DoubleSide });
  const groundMat = new THREE.MeshLambertMaterial({ map: groundTex, vertexColors: true });
  const unlit = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true });
  const [gl, glx] = makeCanvas(64, 64);
  { const gr = glx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.42)"); gr.addColorStop(1, "rgba(255,255,255,0)"); glx.fillStyle = gr; glx.fillRect(0, 0, 64, 64); }
  const glowTex = new THREE.CanvasTexture(gl); glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

  const mGround = new THREE.Mesh(G.geometry(), groundMat); mGround.receiveShadow = true; mGround.name = "ground";
  const mLit = new THREE.Mesh(A.geometry(), lit); mLit.castShadow = true; mLit.receiveShadow = true; mLit.name = "town";
  const mUnlit = new THREE.Mesh(U.geometry(), unlit); mUnlit.name = "glass";
  const mGlow = new THREE.Mesh(GL.geometry(), glowMat); mGlow.renderOrder = 5; mGlow.name = "glow";
  for (const m of [mGround, mLit, mUnlit, mGlow]) { m.frustumCulled = false; m.matrixAutoUpdate = false; }

  // The keg: one little drum, instanced.
  const K = new Builder(atlas.size, atlas.size, white), rKs = atlas.paint(44, 19, art.kegSide), rKt = atlas.paint(14, 14, art.kegTop);
  K.cyl(0, 0, 0.58, 0, 0.215, 10, rKs, rKt);
  for (let i = 0; i < 10; i++) { const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2; K.tri([0, 0, 0], [Math.sin(a1) * 0.215, 0, Math.cos(a1) * 0.215], [Math.sin(a0) * 0.215, 0, Math.cos(a0) * 0.215], rKt, [[0.5, 0.5], [0.5 + Math.sin(a1) * 0.5, 0.5 + Math.cos(a1) * 0.5], [0.5 + Math.sin(a0) * 0.5, 0.5 + Math.cos(a0) * 0.5]]); }
  atlasTex.needsUpdate = true;

  const groundY = (x: number, z: number) => (z < STREET.zFar ? KERB : z < PUB.z0 && z > STREET.zNear && (x < PUB.x1 || x > YARD.x1) ? KERB : 0) * STRETCH;
  void FWD; void FONTS; void tiny;
  return { meshes: [mGround, mLit, mUnlit, mGlow], lit, colliders, shaders, kegs, kegGeometry: K.geometry(), groundY, glowTex, stats: { tris: G.tris + A.tris + U.tris + GL.tris, atlas: atlas.usage() } };
}

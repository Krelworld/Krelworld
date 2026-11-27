// Street dressing: what makes the district look lived in. Bunting and flags over the yard and the
// approach, festoon bulbs, lamp columns that throw pools on the wet, Belisha beacons, a keg stack, the
// pub's sign on its post, washing, posters of a fat bald man; and, for each building, a side wall that
// is something and a roof with things on it. Generated from the layout, plus a short authored list.
import type { BuildingSpec } from "../build";
import * as art from "./art";
import * as art2 from "./art2";
import { patch } from "./ground";
import type { Builder, V3 } from "./mesh";
import { BRICK_DARK, BRICK_RED, BRICK_STOCK, H, PXM, pixText, rect, rng, tiny, type BrickPal, type Ctx, type Region } from "./paint";
import type { Part, World3D } from "./world3d";

const col = (c: number, c2?: number) => ({ c, c2 });

interface Tex { bunt: Region; flag: Region; keg: Region; kegTop: Region; crateR: Region; crateB: Region; crateTop: Region; shirts: Region[]; chalk: Region[]; swing: Region; stains: Region[]; dish: Region; wanted: Region; posters: Region[]; banner: Region[]; binG: Region; binB: Region; sky: Region; tank: Region; moss: Region }
const cache = new WeakMap<World3D, Tex>();
function tex(w: World3D): Tex {
  let t = cache.get(w);
  if (t) return t;
  const a = w.atlas;
  t = {
    bunt: a.paint(40, 11, art.bunting, false), flag: a.paint(40, 30, art.englandFlag),
    keg: a.paint(40, 19, art.kegSide), kegTop: a.paint(13, 13, art.kegTop),
    crateR: a.paint(20, 10, (c, ww, h) => art.crateSide(c, ww, h, 0xb8322a)), crateB: a.paint(20, 10, (c, ww, h) => art.crateSide(c, ww, h, 0x2f5a9a)), crateTop: a.paint(20, 14, (c, ww, h) => art.crateTop(c, ww, h, 0xb8322a)),
    shirts: ["10", "7", "4"].map((n) => a.paint(20, 22, (c, ww, h) => art.shirt(c, ww, h, n), false)),
    chalk: [a.paint(38, 60, art.chalkboard), a.paint(38, 60, (c, ww, h) => board(c, ww, h, ["WE BUY", "TEETH"], "GOLD ONES", 0xf2c81e)), a.paint(38, 60, (c, ww, h) => board(c, ww, h, ["CAMO", "NETS"], "FIND US IF U CAN", 0x9ab86a)), a.paint(38, 60, (c, ww, h) => board(c, ww, h, ["2 FOR", "£2"], "DEAD MENS SHOES", 0xf7a8b0))],
    swing: a.paint(70, 90, art.swingSign),
    stains: [0, 1, 2].map((k) => a.paint(64, 48, (c, ww, h) => stain(c, ww, h, k), false)),
    dish: a.paint(20, 20, (c, ww, h) => { c.clearRect(0, 0, ww, h); c.fillStyle = H(0xc9ccd0); c.beginPath(); c.ellipse(ww / 2, h / 2, ww / 2 - 1, h / 2 - 2, 0, 0, 7); c.fill(); c.fillStyle = H(0x9aa0a6); c.beginPath(); c.ellipse(ww / 2 + 1, h / 2 + 1, ww / 2 - 4, h / 2 - 5, 0, 0, 7); c.fill(); rect(c, ww / 2 - 1, h / 2 - 1, 3, 3, H(0x3a3d42)); rect(c, 3, 4, 4, 2, "rgba(255,255,255,0.7)"); }, false),
    wanted: a.paint(64, 90, (c, ww, h) => art2.wanted(c, ww, h, 2)),
    posters: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => a.paint(52, 70, (c, ww, h) => art2.poster(c, ww, h, k))),
    banner: [a.paint(45, 122, (c, ww, h) => banner(c, ww, h, 0)), a.paint(45, 122, (c, ww, h) => banner(c, ww, h, 1))],
    binG: a.paint(22, 34, (c, ww, h) => art.binSide(c, ww, h, 0x2f5a3a, "GLASS")), binB: a.paint(22, 34, (c, ww, h) => art.binSide(c, ww, h, 0x2f4f7a, "MIXED")),
    sky: a.paint(48, 30, (c, ww, h) => { rect(c, 0, 0, ww, h, H(0x23262b)); art.litGlass(c, 3, 3, ww - 6, h - 6, 3); for (let x = 3 + (ww - 6) / 3; x < ww - 4; x += (ww - 6) / 3) rect(c, Math.round(x), 3, 2, h - 6, H(0x23262b)); rect(c, 3, 3, ww - 6, 1, H(0xfff0c0)); }),
    tank: a.paint(48, 28, (c, ww, h) => { rect(c, 0, 0, ww, h, H(0x7c8288)); for (let x = 0; x < ww; x += 12) { rect(c, x, 0, 1, h, H(0x565c62)); rect(c, x + 1, 0, 1, h, H(0x9aa0a6)); } rect(c, 0, 0, ww, 2, H(0xa9afb6)); const r = rng(4); for (let k = 0; k < 30; k++) rect(c, r.int(ww), 4 + r.int(h - 4), 1, 2 + r.int(6), "rgba(110,70,40,0.5)"); tiny(c, "NOT DRINKING", ww / 2, 8, "rgba(240,240,232,0.75)", 1, "center"); }),
    moss: a.paint(64, 20, (c, ww, h) => { c.clearRect(0, 0, ww, h); const r = rng(6); for (let k = 0; k < 260; k++) { const x = r.int(ww), y = h - 1 - Math.floor(r() * r() * h); rect(c, x, y, 1 + r.int(3), 1, H(r.pick([0x5a6a3a, 0x4d5c34, 0x6b7a44, 0x3f4c2a]))); } }, false),
  };
  cache.set(w, t);
  return t;
}
function board(c: Ctx, w: number, h: number, big: string[], small: string, accent: number) {
  rect(c, 0, 0, w, h, H(0x6a4a2a)); rect(c, 3, 3, w - 6, h - 6, H(0x1e2422));
  big.forEach((t, i) => tiny(c, t, w / 2, 7 + i * 12, H(0xf2f0e6), 2, "center"));
  rect(c, 6, 32, w - 12, 1, H(accent)); const words = small.split(" "), half = Math.ceil(words.length / 2);
  tiny(c, words.slice(0, half).join(" "), w / 2, 37, H(accent), 1, "center"); tiny(c, words.slice(half).join(" "), w / 2, 45, H(accent), 1, "center");
  const r = rng(big[0].length); for (let k = 0; k < 40; k++) rect(c, 3 + r.int(w - 6), 3 + r.int(h - 6), 1, 1, "rgba(230,230,220,0.18)");
}
function stain(c: Ctx, w: number, h: number, k: number) {
  c.clearRect(0, 0, w, h); const r = rng(40 + k);
  if (k === 0) { for (let i = 0; i < 5; i++) { c.fillStyle = "rgba(124,142,158,0.9)"; c.beginPath(); c.ellipse(10 + r.int(w - 20), 8 + r.int(h - 16), 6 + r.int(12), 3 + r.int(6), r(), 0, 7); c.fill(); } rect(c, w / 2 - 4, h / 2, 9, 1, "rgba(214,226,236,0.9)"); } // standing water
  else if (k === 1) { for (let i = 0; i < 240; i++) { const x = r.int(w), y = r.int(h); if (Math.hypot(x - w / 2, (y - h / 2) * 1.4) > w / 2 - 2) continue; rect(c, x, y, 1 + r.int(3), 1 + r.int(2), H(r.pick([0x5a6a3a, 0x4d5c34, 0x6b7a44, 0x44502c]))); } } // moss
  else { for (let i = 0; i < 4; i++) { rect(c, 6 + i * 14, 4, 10, h - 8, H(0x7a5a3c)); rect(c, 6 + i * 14, 4, 10, 1, H(0x9a7a52)); for (let y = 8; y < h - 6; y += 6) rect(c, 6 + i * 14, y, 10, 1, H(0x4a3420)); } } // duckboards
}
function banner(c: Ctx, w: number, h: number, k: number) {
  rect(c, 0, 0, w, h, H(k ? art2.BLUE : 0xf1efe6)); rect(c, 0, 0, w, 3, H(0x15171a)); rect(c, 0, h - 3, w, 3, H(0x15171a));
  if (k === 0) { rect(c, 0, h / 2 - 5, w, 10, H(art2.RED)); rect(c, w / 2 - 5, 3, 10, h - 6, H(art2.RED)); }
  else { c.save(); c.translate(w / 2 + 6, h - 8); c.rotate(-Math.PI / 2); pixText(c, "MATCH DAY", 0, 0, 13, "#f4f4f4", { maxW: h - 16 }); c.restore(); rect(c, 4, 6, w - 8, 2, H(art2.RED)); }
  for (let y = 10; y < h; y += 17) rect(c, 0, y, w, 1, "rgba(0,0,0,0.12)");
}

// ---------------------------------------------------------------------------------------------
// Pieces.

/** A string of pennants from a to b, sagging. */
export function bunting(w: World3D, B: Builder, a: V3, b: V3, sag: number) {
  const r = tex(w).bunt, len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.round(len / 1.25));
  const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
  for (let k = 0; k < n; k++) { const p = at(k / n), q = at((k + 1) / n); B.quad([p[0], p[1] - 0.34, p[2]], [q[0], q[1] - 0.34, q[2]], q, p, r, { normal: [0, 1, 0.2], double: true }); }
}
/** A cable with lit bulbs along it. */
export function festoon(w: World3D, p: Part, a: V3, b: V3, sag: number, c = 0xffd27a) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(3, Math.round(len / 1.1));
  const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
  const seg = Math.max(3, Math.round(n / 2));
  for (let k = 0; k < seg; k++) p.A.bar(at(k / seg), at((k + 1) / seg), 0.03, col(0x15161a));
  for (let k = 1; k < n; k++) {
    const q = at(k / n), cc = k % 5 === 0 ? 0xff8a5a : k % 7 === 0 ? 0xbfe6ff : c;
    p.U.box(q[0] - 0.06, q[1] - 0.16, q[2] - 0.06, q[0] + 0.06, q[1] - 0.03, q[2] + 0.06, { all: col(cc), bot: col(cc) });
    if (k % 2) w.halo(p, [q[0], q[1] - 0.1, q[2] + 0.1], 0.9, cc, 0.4);
    if (k % 3 === 1) { w.spec.streaks.push([q[0] - 0.12, q[2] + 0.05, 0.24, 1.5, cc, 0.3]); w.pool(p, q[0], q[2] + 0.3, 0.9, 0.7, cc, 0.07); } // and what it lays on the wet
  }
}
/** A plain steel pole with a foot. */
function pole(B: Builder, x: number, z: number, h: number, c = 0x4a4f56) {
  B.cyl(x, 0, h, z, 0.06, 5, col(c, 0x8a9096)); B.box(x - 0.13, 0, z - 0.13, x + 0.13, 0.25, z + 0.13, col(0x23262b, 0x3a3f46));
}
/** A lamp column of the old sort: fluted iron, a lantern, and its light on the wet. */
function lampColumn(w: World3D, p: Part, x: number, z: number, h = 5.2, withBanner = -1) {
  const { A, U } = p, t = tex(w);
  A.box(x - 0.2, 0, z - 0.2, x + 0.2, 0.7, z + 0.2, col(0x15171a, 0x2a2d33)); A.cyl(x, 0.7, h - 0.5, z, 0.09, 6, col(0x1a1c20, 0x34383f), undefined, 0.065);
  A.cyl(x, h - 0.5, h - 0.38, z, 0.2, 6, col(0x15171a), col(0x23262b), 0.14);
  U.cyl(x, h - 0.38, h + 0.05, z, 0.15, 6, col(0xffe2a0, 0xfff4d0), undefined, 0.2); A.cyl(x, h + 0.05, h + 0.3, z, 0.24, 6, col(0x15171a, 0x2a2d33), col(0x15171a), 0.03);
  A.bar([x - 0.7, h - 1.0, z], [x + 0.7, h - 1.0, z], 0.05, col(0x15171a));
  w.halo(p, [x, h - 0.15, z + 0.2], 2.6, 0xffc060, 0.5); w.halo(p, [x, h - 0.15, z + 0.2], 7, 0xffc878, 0.1);
  w.pool(p, x + 0.3, z + 1.2, 3.4, 2.6, 0xffc878, 0.2); w.spec.streaks.push([x - 0.5, z + 0.3, 1.0, 4.2, 0xffcf7a, 0.34]);
  w.spec.ao.push([x - 0.2, z - 0.2, x + 0.2, z + 0.2, 1.2]);
  if (withBanner >= 0) for (const s of [-1, 1]) { const r = t.banner[(withBanner + (s > 0 ? 1 : 0)) % 2], x0 = s < 0 ? x - 0.7 : x + 0.1; A.quad([x0, h - 2.85, z + 0.02], [x0 + 0.6, h - 2.85, z + 0.02], [x0 + 0.6, h - 1.05, z + 0.02], [x0, h - 1.05, z + 0.02], r, { double: true, normal: [0, 0.6, 1] }); }
}
function beacon(w: World3D, p: Part, x: number, z: number) {
  const { A, U } = p;
  for (let k = 0; k < 7; k++) A.cyl(x, k * 0.3, (k + 1) * 0.3, z, 0.055, 5, col(k % 2 ? 0xf1efe6 : 0x15171a));
  U.cyl(x, 2.1, 2.42, z, 0.17, 6, col(0xf2a51a, 0xffd060), col(0xffe08a), 0.12);
  w.halo(p, [x, 2.26, z + 0.15], 1.5, 0xffb020, 0.55); w.pool(p, x, z + 0.6, 1.2, 1.0, 0xffb020, 0.16);
}
/** An A-board. */
function aboard(B: Builder, x: number, z: number, rot: number, r: Region) {
  B.at(x, 0, z, rot);
  B.quad([-0.3, 0, 0.26], [0.3, 0, 0.26], [0.3, 0.94, 0.03], [-0.3, 0.94, 0.03], r); B.quad([0.3, 0, -0.26], [-0.3, 0, -0.26], [-0.3, 0.94, -0.03], [0.3, 0.94, -0.03], col(0x4a3420));
  B.quad([0.3, 0, 0.26], [0.3, 0, -0.26], [0.3, 0.94, -0.03], [0.3, 0.94, 0.03], col(0x4a3420)); B.quad([-0.3, 0, -0.26], [-0.3, 0, 0.26], [-0.3, 0.94, 0.03], [-0.3, 0.94, -0.03], col(0x4a3420));
  B.end();
}
function keg(w: World3D, B: Builder, x: number, y: number, z: number) { const t = tex(w); B.cyl(x, y, y + 0.6, z, 0.21, 8, { r: t.keg }, { r: t.kegTop }); }
function crate(w: World3D, B: Builder, x: number, y: number, z: number, blue = false) { const t = tex(w); B.box(x, y, z, x + 0.62, y + 0.32, z + 0.42, { all: blue ? t.crateB : t.crateR, top: t.crateTop }); }
function aerial(B: Builder, x: number, y: number, z: number, h = 1.5) {
  B.bar([x, y, z], [x, y + h, z], 0.05, col(0x3a3d42));
  for (const [yy, hw] of [[h - 0.1, 0.5], [h - 0.35, 0.38], [h - 0.6, 0.5]]) B.bar([x - hw, y + yy, z], [x + hw, y + yy, z], 0.04, col(0x3a3d42));
}
function dish(w: World3D, B: Builder, x: number, y: number, z: number, s = 0.7) {
  B.bar([x, y - 0.3, z - 0.15], [x, y + s * 0.4, z - 0.05], 0.05, col(0x3a3d42));
  B.quad([x - s / 2, y, z], [x + s / 2, y, z], [x + s / 2, y + s, z - 0.12], [x - s / 2, y + s, z - 0.12], tex(w).dish, { double: true, normal: [0, 0.5, 1] });
}
/** A downpipe on a wall that looks east (dx > 0) or south (dz > 0), with its hopper. */
function downpipe(B: Builder, x: number, z: number, y1: number, c = 0x1b1c20) { B.bar([x, 0, z], [x, y1, z], 0.1, col(c)); B.box(x - 0.12, y1 - 0.15, z - 0.12, x + 0.12, y1 + 0.1, z + 0.12, col(c)); for (const y of [0.6, y1 * 0.5]) B.box(x - 0.09, y, z - 0.09, x + 0.09, y + 0.06, z + 0.09, col(0x2a2c30)); }
/** A wall lamp on a wall that looks east. */
function lampE(w: World3D, p: Part, x: number, y: number, z: number, c = 0xffc878) {
  p.A.box(x, y - 0.05, z - 0.14, x + 0.3, y + 0.03, z + 0.14, col(0x15161a)); p.U.box(x + 0.08, y - 0.3, z - 0.1, x + 0.28, y - 0.05, z + 0.1, { all: col(0xffe2a0), bot: col(0xfff4d0) });
  w.halo(p, [x + 0.4, y - 0.2, z], 1.5, c, 0.45); w.pool(p, x + 1.5, z + 0.3, 1.9, 1.7, c, 0.2); w.spec.streaks.push([x + 0.2, z - 0.5, 1.2, 3.2, c, 0.26]);
}

// ---------------------------------------------------------------------------------------------
// Buildings: called while each one is being built, so their clutter comes and goes with their shell.

const SIDES: Record<string, { pal: BrickPal; ghost: string; seed: number }> = {
  charity: { pal: BRICK_STOCK, ghost: "TRIPE & SONS", seed: 21 }, surplus: { pal: BRICK_DARK, ghost: "WAR SURPLUS", seed: 23 }, bookies: { pal: BRICK_RED, ghost: "CHEQUES CASHED", seed: 25 },
};
/** The east wall of a shop: painted brick with history, a pipe, a lamp, posters, bins. Returns the face to use. */
export function shopSide(w: World3D, p: Part, b: BuildingSpec): Region {
  const { A } = p, t = tex(w), { y0: z0, x1, y1: z1 } = b.rect, hgt = b.height, D = z1 - z0, cfg = SIDES[b.front] ?? SIDES.charity, x = x1 + 0.03;
  const r = w.atlas.paintM(D, hgt, (c, ww, h) => art2.sideWall(c, ww, h, cfg.pal, cfg.seed, { ghost: cfg.ghost, vent: true, blind: b.front !== "bookies", door: b.front === "bookies" }));
  downpipe(A, x + 0.08, z0 + 0.5, hgt - 0.1);
  lampE(w, p, x, 2.75, z1 - 2.2);
  const px = x + 0.025, hang = (rr: Region, zc: number, y: number, wm: number, hm: number) => A.quad([px, y, zc + wm / 2], [px, y, zc - wm / 2], [px, y + hm, zc - wm / 2], [px, y + hm, zc + wm / 2], rr);
  hang(t.wanted, z1 - 1.0, 1.0, 0.86, 1.2); hang(t.posters[(cfg.seed + 1) % 8], z1 - 3.6, 1.05, 0.8, 1.08); hang(t.posters[(cfg.seed + 4) % 8], z1 - 4.5, 0.95, 0.8, 1.08);
  if (b.front !== "bookies") hang(t.wanted, z1 - 5.9, 1.1, 0.86, 1.2);
  // bins against it, where nobody walks
  const bz = z0 + 2.2;
  A.box(x + 0.05, 0, bz, x + 0.75, 1.08, bz + 0.62, { all: col(0x2f5a3a), e: t.binG, top: col(0x3f6a4a, 0x4f7a5a) }); A.box(x + 0.05, 0, bz + 0.8, x + 0.75, 1.08, bz + 1.42, { all: col(0x2f4f7a), e: t.binB, top: col(0x3f5f8a, 0x4f6f9a) });
  w.spec.ao.push([x, bz, x + 0.75, bz + 1.42, 1]);
  return r;
}
/** A flat roof's clutter: lights let into it, a tank, a stack with pots, an aerial, a dish, moss and standing water. */
export function flatRoofClutter(w: World3D, p: Part, x0: number, z0: number, x1: number, z1: number, y: number, seed: number, stack = true) {
  const { A, U } = p, t = tex(w), r = rng(seed), W = x1 - x0, D = z1 - z0;
  const decal = (rr: Region, cx: number, cz: number, wm: number, dm: number) => A.quad([cx - wm / 2, y + 0.015, cz + dm / 2], [cx + wm / 2, y + 0.015, cz + dm / 2], [cx + wm / 2, y + 0.015, cz - dm / 2], [cx - wm / 2, y + 0.015, cz - dm / 2], rr);
  for (let k = 0; k < Math.max(2, Math.round((W * D) / 45)); k++) decal(t.stains[k % 2], x0 + 1.5 + r() * (W - 3), z0 + 1.2 + r() * (D - 2.4), 2 + r() * 1.6, 1.4 + r() * 1.0);
  // rooflights, lit from below
  const nL = W > 12 ? 2 : 1;
  for (let k = 0; k < nL; k++) {
    const lx = x0 + W * (nL === 1 ? 0.5 : 0.3 + k * 0.42) - 0.8, lz = z0 + D * (0.5 + (k ? 0.12 : -0.06));
    A.box(lx - 0.08, y, lz - 0.08, lx + 1.68, y + 0.22, lz + 1.08, { all: col(0x3a3d42, 0x54585e), top: null });
    U.quad([lx, y + 0.22, lz + 1.0], [lx + 1.6, y + 0.22, lz + 1.0], [lx + 1.6, y + 0.3, lz], [lx, y + 0.3, lz], t.sky);
    w.halo(p, [lx + 0.8, y + 0.5, lz + 0.5], 2.6, 0xffc86a, 0.2);
  }
  // duckboards from the hatch to the tank
  const dx = x0 + W * 0.62, dz = z0 + D * 0.3;
  decal(t.stains[2], dx - 1.6, dz + 0.5, 2.0, 1.0); decal(t.stains[2], dx - 3.5, dz + 0.5, 2.0, 1.0);
  A.box(dx, y, dz, dx + 1.5, y + 0.85, dz + 1.0, { all: { r: t.tank }, top: col(0x8a9096, 0xa9afb6) }); A.box(dx - 0.05, y + 0.85, dz - 0.05, dx + 1.55, y + 0.92, dz + 1.05, col(0x6f757c, 0x8f959c));
  A.box(dx - 4.9, y, dz + 0.1, dx - 4.2, y + 0.16, dz + 0.9, { all: col(0x3a3d42), top: col(0x565c62, 0x7a8088) }); // the hatch
  if (stack) {
    const sx = x0 + 1.2 + r() * 2, sz = z0 + 0.4;
    A.box(sx, y, sz, sx + 0.9, y + 1.5, sz + 0.7, { all: { r: w.sw.brick, uv: [0, 0, 0.45, 0.75] }, top: w.sw.stone }); A.box(sx - 0.06, y + 1.5, sz - 0.06, sx + 0.96, y + 1.6, sz + 0.76, w.sw.stone);
    for (const px of [0.25, 0.65]) A.cyl(sx + px, y + 1.6, y + 2.0, sz + 0.35, 0.14, 6, col(0x9a5536, 0xb86a44), col(0x2a1c16), 0.11);
    aerial(A, sx + 0.45, y + 1.6, sz + 0.6, 1.4);
  }
  dish(w, A, x1 - 0.6, y + 0.35, z1 - 0.4 - r() * 2);
  // a football that went up in 2011 and a traffic cone that has no excuse
  A.cyl(x0 + W * 0.2, y, y + 0.26, z1 - 1.6, 0.14, 6, col(0xd8d4c8, 0xf4f0e6), col(0xf4f0e6), 0.1);
  A.cyl(x0 + W * 0.82, y, y + 0.5, z0 + D * 0.72, 0.16, 6, col(0xe2661c, 0xf08a3a), col(0xf08a3a), 0.04);
  A.quad([x0 + 0.3, y + 0.02, z1 - 0.28], [x0 + 0.3 + Math.min(W - 1, 8), y + 0.02, z1 - 0.28], [x0 + 0.3 + Math.min(W - 1, 8), y + 0.02, z1 - 0.9], [x0 + 0.3, y + 0.02, z1 - 0.9], { r: t.moss, uv: [0, 0, 1, 1] });
}
/** A striped awning's valance over a shopfront, between the fascia and the glass: a strip of colour. */
export function awning(w: World3D, p: Part, xa: number, xb: number, z: number, c1: number, c2: number) {
  if (xb - xa < 1) return;
  const r = w.atlas.paintM(Math.min(8, xb - xa), 0.7, (c, ww, h) => { for (let x = 0; x < ww; x += 16) { rect(c, x, 0, 8, h, H(c1)); rect(c, x + 8, 0, 8, h, H(c2)); } rect(c, 0, h - 6, ww, 1, "rgba(0,0,0,0.25)"); for (let x = 0; x < ww; x += 8) { c.fillStyle = H((x / 8) % 2 ? c2 : c1); c.beginPath(); c.arc(x + 4, h - 5, 4, 0, Math.PI); c.fill(); } const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(20,20,24,0.3)"); g.addColorStop(0.4, "rgba(20,20,24,0)"); c.fillStyle = g; c.fillRect(0, 0, ww, h - 6); }, 1, false);
  p.A.quad([xa, 2.2, z + 0.62], [xb, 2.2, z + 0.62], [xb, 2.42, z + 0.02], [xa, 2.42, z + 0.02], { r, uv: [0, 0, 1, 0.78] }, { normal: [0, 1, 0.5] });
  p.A.quad([xa, 2.02, z + 0.62], [xb, 2.02, z + 0.62], [xb, 2.2, z + 0.62], [xa, 2.2, z + 0.62], { r, uv: [0, 0.74, 1, 1] }, { double: true });
}
export function shopFrontDressing(w: World3D, p: Part, b: BuildingSpec) {
  const { A } = p, t = tex(w), { x0, x1, y1: z1 } = b.rect, F = z1 + 0.03, i = b.front === "bookies" ? 1 : b.front === "surplus" ? 2 : 3;
  aboard(A, x1 - 2.4, F + 0.75, 0.22, t.chalk[i]); w.spec.ao.push([x1 - 2.7, F + 0.5, x1 - 2.1, F + 1.0, 0.8]);
  downpipe(A, x0 + 0.2, F + 0.07, b.height - 0.3);
  if (b.front === "charity") { // a rail of coats put out on the pavement, chained
    A.bar([x0 + 1.0, 1.5, F + 0.6], [x0 + 3.0, 1.5, F + 0.6], 0.05, col(0x8f959c)); for (const px of [x0 + 1.0, x0 + 3.0]) A.bar([px, 0, F + 0.6], [px, 1.5, F + 0.6], 0.05, col(0x8f959c));
    [0x6a4a2a, 0x2f4f7a, 0x7a2a2a, 0xd8d2c0, 0x3a5a3a, 0x23252b].forEach((cc, k) => A.box(x0 + 1.15 + k * 0.3, 0.45, F + 0.5, x0 + 1.35 + k * 0.3, 1.46, F + 0.7, col(cc)));
    w.spec.ao.push([x0 + 1.0, F + 0.45, x0 + 3.0, F + 0.75, 0.9]);
  }
}
export function pubDressing(w: World3D, p: Part, b: BuildingSpec, ridge: number, zr: number, east: boolean) {
  const { A } = p, { x0, x1, y0: z0, y1: z1 } = b.rect, gx = east ? x1 : x0, s = east ? 1 : -1;
  aerial(A, x1 - 2.0, ridge + 1.1, zr, 1.5);
  dish(w, A, gx + s * 0.3, b.height - 0.7, z1 - 1.2, 0.8);
  if (east) { downpipe(A, gx + 0.1, z0 + 0.4, b.height - 0.2); lampE(w, p, gx + 0.03, 3.0, z1 - 4.2); }
  // moss in the slates' lee, a slipped slate, lead round the stacks
  const t = tex(w), sl = (x: number, tt: number, lift = 0.06): V3 => [x, b.height + (ridge - b.height) * tt + lift, z1 + (zr - z1) * tt + 0.3 * (1 - tt)];
  for (let x = x0 + 1.5; x < x1 - 8; x += 9.5) A.quad(sl(x, 0.04), sl(x + 7, 0.04), sl(x + 7, 0.3), sl(x, 0.3), t.moss);
  for (const x of [x0 + 7.2, x0 + (x1 - x0) * 0.6, x1 - 4.4]) A.quad(sl(x, 0.55), sl(x + 0.9, 0.55), sl(x + 0.9, 0.72), sl(x, 0.72), col(0x2c323c));
}
/** The stewards' cabin: a telly aerial, a dish, a gas bottle, steps, a lamp over the door, a notice. */
export function cabinDressing(w: World3D, p: Part, b: BuildingSpec) {
  const { A } = p, { x0, x1, y0: z0, y1: z1 } = b.rect, e = b.height, F = z1 + 0.03, t = tex(w);
  aerial(A, x0 + 1.5, e + 0.05, z0 + 2, 1.8); dish(w, A, x1 - 1.2, e + 0.3, z1 - 1.0, 0.8);
  A.cyl(x1 - 0.5, 0, 1.1, F + 0.35, 0.18, 6, col(0xb8322a, 0xd85a4a), col(0x8a8f96), 0.16); A.cyl(x1 - 0.95, 0, 1.1, F + 0.35, 0.18, 6, col(0x2f5a9a, 0x4a7aba), col(0x8a8f96), 0.16);
  A.box(x0 + 1.0, 0, F, x0 + 2.6, 0.2, F + 0.9, { all: col(0x6a6e75, 0x8a8e95) }); A.box(x0 + 1.2, 0.2, F, x0 + 2.4, 0.4, F + 0.45, { all: col(0x6a6e75, 0x8a8e95) });
  A.quad([x1 + 0.055, 1.0, z1 - 1.2], [x1 + 0.055, 1.0, z1 - 2.06], [x1 + 0.055, 2.2, z1 - 2.06], [x1 + 0.055, 2.2, z1 - 1.2], t.wanted);
  A.quad([x1 + 0.055, 1.1, z1 - 2.5], [x1 + 0.055, 1.1, z1 - 3.3], [x1 + 0.055, 2.18, z1 - 3.3], [x1 + 0.055, 2.18, z1 - 2.5], t.posters[5]);
  lampE(w, p, x1 + 0.03, 2.6, z1 - 4.5);
  for (let x = x0 + 1; x < x1 - 1; x += 3.4) A.box(x, e + 0.02, z0 + 0.4, x + 0.5, e + 0.3, z0 + 0.9, { all: col(0x8f959c, 0xb9bec4), top: col(0x565c62) });
  w.spec.ao.push([x1 - 1.2, F, x1 - 0.3, F + 0.6, 1]);
}
/** HOTEL in red on a frame on the roof, one letter gone; flags and planters by the door. */
export function hotelDressing(w: World3D, p: Part, b: BuildingSpec) {
  const { A, U } = p, a = w.atlas, { x0, x1, y1: z1 } = b.rect, e = b.height, d = b.doors[0], cx = d ? (d.x0 + d.x1) / 2 : (x0 + x1) / 2, F = z1 + 0.03;
  const sw = 7.2, sh = 1.5, sx = cx - sw / 2, sz = z1 - 0.9, sy = e + 1.2;
  const r = a.paint(Math.round(sw * 48), Math.round(sh * 48), (c, ww, h) => { rect(c, 0, 0, ww, h, H(0x15161a)); c.strokeStyle = H(0x2a2c30); c.lineWidth = 2; for (let x = 0; x < ww; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 24, h); c.moveTo(x + 24, 0); c.lineTo(x, h); c.stroke(); } "HOTEL".split("").forEach((ch, i) => pixText(c, ch, ww * (0.12 + i * 0.19), h - 12, h - 22, i === 2 ? H(0x4a2422) : H(0xff5a4a), { align: "center", weight: 900 })); });
  A.box(sx, sy, sz - 0.12, sx + sw, sy + sh, sz, { all: col(0x15161a) }); U.quad([sx, sy, sz + 0.01], [sx + sw, sy, sz + 0.01], [sx + sw, sy + sh, sz + 0.01], [sx, sy + sh, sz + 0.01], r);
  for (const px of [sx + 0.4, sx + sw / 2, sx + sw - 0.4]) { A.bar([px, e, sz - 0.06], [px, sy, sz - 0.06], 0.08, col(0x2a2c30)); A.bar([px, e, sz - 1.4], [px, sy + sh * 0.6, sz - 0.1], 0.06, col(0x2a2c30)); }
  w.halo(p, [cx, sy + sh / 2, sz + 0.4], sw * 1.4, 0xff4a3a, 0.2, 0.4);
  // planters and flags either side of the door
  const fl = tex(w), plants = a.paint(44, 26, (c, ww, h) => art.flowers(c, ww, h, 7), false);
  for (const s of [-1, 1]) {
    const px = cx + s * ((d ? (d.x1 - d.x0) / 2 : 2) + 1.3);
    A.box(px - 0.7, 0, F + 0.1, px + 0.7, 0.55, F + 0.7, { all: { r: w.sw.stone, uv: [0, 0, 1, 1] }, top: col(0x3a2a1c) });
    A.quad([px - 0.75, 0.4, F + 0.42], [px + 0.75, 0.4, F + 0.42], [px + 0.75, 1.3, F + 0.4], [px - 0.75, 1.3, F + 0.4], plants, { double: true, normal: [0, 1, 0.3] });
    const fx = cx + s * 5.2; pole(A, fx, F + 0.55, 6.2, 0xc9cdd2);
    A.quad([fx + 0.05, 4.9, F + 0.55], [fx + 1.65, 4.9, F + 0.55], [fx + 1.65, 6.05, F + 0.55], [fx + 0.05, 6.05, F + 0.55], s < 0 ? fl.flag : fl.banner[1], { double: true, normal: [0, 0.6, 1] });
    w.spec.ao.push([px - 0.7, F + 0.1, px + 0.7, F + 0.7, 0.6]);
  }
  aerial(A, x0 + 4, e + 0.05, b.rect.y0 + 6, 2.2); dish(w, A, x1 - 2, e + 0.5, b.rect.y0 + 9, 1.2);
}

// ---------------------------------------------------------------------------------------------
export function buildDressing(w: World3D): void {
  const t = tex(w), m = w.mirror, mx = (x: number) => (m ? -x : x), v = w.host.venue, hasPub = w.host.blds.some((b) => b.id === "pub");
  const west = w.part("street-w"), mid = w.part("street-c"), east = w.part("street-e"), out = w.part("street-out");
  const partFor = (x: number) => (mx(x) < -20 ? west : mx(x) < 26 ? mid : east);

  // ---- The pub yard (or the fan zone's corner): poles down the street side, bunting and bulbs over, flags.
  const ya = w.host.areas.find((q) => q.id === "pub_yard"), pub = w.host.blds.find((b) => b.id === "pub");
  if (ya) {
    const p = partFor(m ? -(ya.x + ya.w / 2) : ya.x + ya.w / 2), { A, U } = p, e = m ? -1 : 1; // e: from the pub towards the street
    const px = m ? ya.x + ya.w : ya.x, fx = m ? ya.x : ya.x + ya.w, zn = ya.y, zs = ya.y + ya.h, zr = pub ? (pub.rect.y0 + pub.rect.y1) / 2 : ya.y + ya.h / 2;
    const poles: V3[] = [[fx + e * 0.3, 4.6, zn + 0.6], [fx + e * 0.3, 4.9, zn + 8.4], [fx + e * 0.3, 4.6, zs - 0.4]];
    for (const q of poles) { pole(A, q[0], q[2], q[1]); w.spec.ao.push([q[0] - 0.13, q[2] - 0.13, q[0] + 0.13, q[2] + 0.13, 1]); }
    const anchors: V3[] = pub ? [[px + e * 0.25, 5.2, zn + 2.2], [px + e * 0.3, 6.5, zr], [px + e * 0.25, 4.9, zs - 2.6]] : [[px - e * 0.3, 4.6, zn + 0.6], [px - e * 0.3, 4.9, zn + 8.4], [px - e * 0.3, 4.6, zs - 0.4]];
    if (!pub) for (const q of anchors) pole(A, q[0], q[2], q[1]);
    bunting(w, A, anchors[0], poles[0], 0.7); bunting(w, A, anchors[1], poles[1], 0.9); bunting(w, A, anchors[2], poles[2], 0.7);
    festoon(w, p, poles[0], poles[1], 0.55); festoon(w, p, poles[1], poles[2], 0.55); festoon(w, p, [anchors[0][0], anchors[0][1] - 0.5, anchors[0][2]], [poles[1][0], poles[1][1] - 0.4, poles[1][2]], 0.8);
    // the big flag, hung from the middle line
    { const a0 = anchors[1], b0 = poles[1], at = (tt: number): V3 => [a0[0] + (b0[0] - a0[0]) * tt, a0[1] + (b0[1] - a0[1]) * tt - Math.sin(tt * Math.PI) * 0.9 - 0.36, a0[2] + (b0[2] - a0[2]) * tt]; const q0 = at(0.42), q1 = at(0.6); A.quad([q0[0], q0[1] - 1.25, q0[2]], [q1[0], q1[1] - 1.25, q1[2]], q1, q0, t.flag, { double: true, normal: [0, 0.6, 1] }); }
    // the yard's own light, on the middle pole, and the pool it throws
    { const q = poles[1]; A.box(q[0] - 0.4 * e - 0.15, q[1] - 0.3, q[2] - 0.1, q[0] - 0.4 * e + 0.15, q[1] - 0.1, q[2] + 0.1, col(0x1a1b1e)); A.bar([q[0], q[1] - 0.2, q[2]], [q[0] - 0.4 * e, q[1] - 0.2, q[2]], 0.05, col(0x4a4f56)); U.box(q[0] - 0.4 * e - 0.12, q[1] - 0.34, q[2] - 0.08, q[0] - 0.4 * e + 0.12, q[1] - 0.3, q[2] + 0.08, { all: col(0xfff4d6), bot: col(0xfff4d6) }); w.halo(p, [q[0] - 0.4 * e, q[1] - 0.3, q[2] + 0.2], 2.2, 0xfff0c8, 0.5); w.pool(p, q[0] - 3.2 * e, q[2] + 0.6, 4.2, 3.4, 0xfff0c8, 0.17); }
    // washing between the first pole and the shop next door: England away, numbers 10, 7 and 4
    { const a0: V3 = [poles[0][0], 3.1, poles[0][2] + 0.1], b0: V3 = [poles[0][0] + e * 3.0, 3.3, poles[0][2] + 1.6]; A.bar(a0, b0, 0.025, col(0xd8d4c8)); t.shirts.forEach((r, k) => { const tt = 0.2 + k * 0.28, x = a0[0] + (b0[0] - a0[0]) * tt, y = a0[1] + (b0[1] - a0[1]) * tt, z = a0[2] + (b0[2] - a0[2]) * tt; A.quad([x - 0.31, y - 0.72, z], [x + 0.31, y - 0.72, z], [x + 0.31, y - 0.02, z], [x - 0.31, y - 0.02, z], r, { double: true, normal: [0, 0.6, 1] }); }); }
    if (pub) {
      // against the pub's wall: kegs two deep and a second tier, crates by the side door, the board, the standpipe and its hose
      const kx = px + e * 0.36, kz = zr + 1.6;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 6; j++) keg(w, A, kx + e * i * 0.45, 0, kz + j * 0.45);
      for (let j = 0; j < 4; j++) keg(w, A, kx + e * 0.2, 0.6, kz + 0.25 + j * 0.45);
      keg(w, A, kx + e * 1.3, 0, kz + 0.4); // one somebody rolled out and left
      w.spec.ao.push([Math.min(kx - 0.2, kx + e * 0.7), kz - 0.25, Math.max(kx + 0.2, kx + e * 0.7), kz + 2.5, 1]);
      const cz = zr - 4.6, cx0 = px + (e > 0 ? 0.12 : -0.74);
      crate(w, A, cx0, 0, cz); crate(w, A, cx0, 0.32, cz, true); crate(w, A, cx0, 0.64, cz); crate(w, A, cx0, 0, cz + 0.5, true); crate(w, A, cx0, 0.32, cz + 0.5); crate(w, A, cx0 + e * 0.7, 0, cz + 0.2);
      aboard(A, px + e * 1.0, zr + 0.5, e * 0.9, t.chalk[0]); w.spec.ao.push([px + e * 0.7 - 0.3, zr + 0.2, px + e * 0.7 + 0.6, zr + 0.8, 0.8]);
      const sx = px + e * 0.14, sz = zr + 4.9;
      A.bar([sx, 0, sz], [sx, 1.05, sz], 0.07, col(0x8f959c)); A.box(sx - 0.08, 0.92, sz - 0.1, sx + 0.08, 1.02, sz + 0.1, col(0xc9a23a)); A.box(sx - 0.03, 1.02, sz - 0.03, sx + 0.03, 1.1, sz + 0.03, col(0xc8281e));
      { const pts: V3[] = []; for (let k = 0; k <= 12; k++) { const an = -Math.PI / 2 + (k / 12) * Math.PI * 2.2, rr = 0.22; pts.push([sx + e * (0.45 + Math.cos(an) * rr), 0.04 + (k < 3 ? (3 - k) * 0.28 : 0), sz + Math.sin(an) * rr]); } const lx = pts[pts.length - 1][0], lz = pts[pts.length - 1][2]; for (let k = 1; k <= 12; k++) { const tt = k / 12; pts.push([lx + e * tt * 2.2, 0.05, lz + Math.sin(tt * 5) * 0.28 + tt * 0.8]); } for (let k = 0; k < pts.length - 1; k++) A.bar(pts[k], pts[k + 1], 0.07, col(k % 5 === 4 ? 0x2a7a36 : 0x358f40)); }
      // the sign on its post, at the mouth of the yard
      const gx = px - e * 1.3, gz = pub.rect.y1 + 1.5;
      A.box(gx - 0.08, 0, gz - 0.08, gx + 0.08, 4.55, gz + 0.08, col(0x121316, 0x1c1d22)); A.box(gx - 0.16, 0, gz - 0.16, gx + 0.16, 0.35, gz + 0.16, col(0x1a1b1e)); A.cyl(gx, 4.55, 4.75, gz, 0.1, 6, col(art.GOLD), col(art.GOLD), 0.02);
      A.bar([gx, 4.3, gz], [gx + e * 1.35, 4.3, gz], 0.07, col(0x121316)); A.bar([gx, 3.7, gz], [gx + e * 0.6, 4.3, gz], 0.05, col(0x121316));
      const s0 = e > 0 ? gx + 0.2 : gx - 1.3; A.box(s0, 2.8, gz - 0.04, s0 + 1.1, 4.2, gz + 0.04, { all: col(0x121316), s: t.swing, n: t.swing });
      w.spec.ao.push([gx - 0.16, gz - 0.16, gx + 0.16, gz + 0.16, 2]);
    }
    // bunting on down to the road's lamp posts
    bunting(w, A, poles[2], [mx(-12), 3.9, 83.7], 0.8); if (pub) bunting(w, A, anchors[2], [mx(-36), 3.9, 83.7], 0.6);
  }

  // ---- The approach: lamp columns standing where four of the bollards are, bunting from one to the next and up to the ground.
  const cols = [-39, -26, -13, 13, 26, 39], cz = 60.45, ch = 5.4;
  cols.forEach((x, i) => lampColumn(w, partFor(m ? -x : x), x, cz, ch, i));
  for (let i = 0; i < cols.length - 1; i++) { if (i === 2) continue; bunting(w, partFor(m ? -cols[i] : cols[i]).A, [cols[i], ch - 0.6, cz], [cols[i + 1], ch - 0.6, cz], 0.9); }
  for (const [i, tx] of [[0, -33], [2, -15], [3, 15], [5, 33]] as [number, number][]) bunting(w, out.A, [cols[i], ch - 0.6, cz], [tx, 6.3, 45.2], 1.1);
  if (ya) { const p0 = partFor(-30), near = m ? 26 : -26; bunting(w, p0.A, [near, ch - 0.6, cz], [(m ? ya.x : ya.x + ya.w) + (m ? -0.3 : 0.3), 4.6, ya.y + 0.6], 0.7); }

  // ---- The ring road: what the lamp posts throw, a beacon at each end of each crossing.
  for (let x = -84; x <= 84; x += 24) { const p = partFor(m ? -x : x); w.halo(p, [x, 3.75, 83.9], 2.2, 0xffd9a0, 0.5); w.halo(p, [x, 3.75, 83.9], 6, 0xffc878, 0.1); w.pool(p, x + 0.2, 85.0, 3.6, 2.6, 0xffc878, 0.2); w.spec.streaks.push([x - 0.6, 84.2, 1.2, 4.6, 0xffcf7a, 0.3]); }
  for (const c of [-46, 2, 36]) for (const [bx, bz] of [[c - 2.4, 83.6], [c + 2.4, 92.6]]) beacon(w, partFor(bx), mx(bx), bz);
  // the phone box's transom, the bus shelter's strip light
  { const p = partFor(-30); w.halo(p, [mx(-30), 2.3, 83.6], 1.6, 0xfff0c8, 0.35); w.pool(p, mx(-30), 84.3, 1.3, 1.0, 0xfff0c8, 0.14); const q = partFor(12); w.halo(q, [mx(12), 2.2, 94.8], 3.2, 0xdff0ff, 0.22, 0.5); w.pool(q, mx(12), 95.4, 2.4, 1.0, 0xdff0ff, 0.14); }

  // ---- The car park: a height bar, a pay machine nobody pays, a skip.
  {
    const p = east, { A } = p, cp = w.host.areas.find((q) => q.id === "carpark");
    if (cp) {
      const px = m ? cp.x + cp.w - 1.2 : cp.x + 1.2, pz = cp.y + cp.h - 0.4;
      A.box(px - 0.2, 0, pz - 0.2, px + 0.2, 1.5, pz + 0.2, { all: col(0x23262b, 0x3a3f46), s: w.atlas.paint(26, 48, (c, ww, h) => { rect(c, 0, 0, ww, h, H(0x23262b)); rect(c, 3, 4, ww - 6, 10, H(0x7ad07a)); tiny(c, "PAY", ww / 2, 6, "#15171a", 1, "center"); rect(c, 5, 18, ww - 10, 8, "#f1efe6"); tiny(c, "£9", ww / 2, 19, "#b01020", 1, "center"); rect(c, ww / 2 - 4, 30, 8, 2, H(0x0c0d10)); rect(c, 4, 36, ww - 8, 8, H(0xf2c81e)); tiny(c, "HA", ww / 2, 37, "#15171a", 1, "center"); }) });
      w.spec.ao.push([px - 0.2, pz - 0.2, px + 0.2, pz + 0.2, 1.2]);
    }
  }

  // ---- The ground's east wall from the service road: it stands when you are outside, with what gets stuck to it.
  if (!m) {
    const { A } = out, rW = [0, 1, 2].map((k) => w.atlas.paintM(12, 3, (c, ww, h) => outerWall(c, ww, h, k)));
    for (const wl of w.host.walls) {
      if (wl.prop || wl.gate || wl.w > 1.1 || wl.h < 5 || Math.abs(wl.x - 62) > 0.05) continue;
      const x = wl.x + wl.w + 0.02, z0 = wl.y, z1 = wl.y + wl.h;
      for (let z = z1, k = 0; z > z0 + 0.01; z -= 12, k++) { const ze = Math.max(z0, z - 12); A.quad([x, 0, z], [x, 0, ze], [x, 3, ze], [x, 3, z], { r: rW[k % 3], uv: [0, 0, (z - ze) / 12, 1] }); }
      A.box(wl.x, 1, z0, x - 0.02, 3, z1, { all: { r: w.sw.block }, e: null, top: col(0xb4b8bc) });
      for (let z = z1 - 6; z > z0 + 2; z -= 17) lampE(w, out, x, 3.2, z, 0xfff0c8);
    }
  }

  // ---- The fan zone's big screen: a truss, the match on it, a ticker, speakers; its light on the grass.
  if (v.features.fanZone) {
    const fz = w.host.areas.find((q) => q.id === "pub");
    if (fz) {
      const cx = fz.x + fz.w / 2, z = fz.y + 2.3, p = partFor(m ? -cx : cx), { A, U } = p, sw = 12, sh = 5, y0 = 1.5;
      const r = w.atlas.paintM(sw, sh, (c, ww, h) => bigScreen(c, ww, h, OPPN[v.opp] ?? "THEM"));
      A.box(cx - sw / 2 - 0.25, y0 - 0.25, z - 0.5, cx + sw / 2 + 0.25, y0 + sh + 0.25, z, { all: col(0x15171a, 0x2a2d33) });
      U.quad([cx - sw / 2, y0, z + 0.02], [cx + sw / 2, y0, z + 0.02], [cx + sw / 2, y0 + sh, z + 0.02], [cx - sw / 2, y0 + sh, z + 0.02], r);
      for (const px of [cx - sw / 2 - 0.1, cx - 2, cx + 2, cx + sw / 2 + 0.1]) { A.bar([px, 0, z - 0.25], [px, y0, z - 0.25], 0.16, col(0x6f757c, 0x9aa0a6)); A.bar([px, 0, z - 1.6], [px, y0 + sh * 0.7, z - 0.5], 0.1, col(0x6f757c)); }
      for (const s2 of [-1, 1]) A.box(cx + s2 * (sw / 2 + 0.9) - 0.45, 0, z - 0.5, cx + s2 * (sw / 2 + 0.9) + 0.45, 2.6, z + 0.2, { all: col(0x15171a, 0x23262b), s: w.atlas.paint(29, 83, (c, ww, h) => { rect(c, 0, 0, ww, h, H(0x15171a)); for (const cy of [16, 42, 66]) { c.fillStyle = H(0x2a2d33); c.beginPath(); c.arc(ww / 2, cy, 10, 0, 7); c.fill(); c.fillStyle = H(0x0c0d10); c.beginPath(); c.arc(ww / 2, cy, 6, 0, 7); c.fill(); } }) });
      w.halo(p, [cx, y0 + sh / 2, z + 0.5], sw * 1.5, 0x9fe0a8, 0.22, 0.5); w.pool(p, cx, z + 4.5, sw * 0.55, 4.5, 0xb8f0c0, 0.16);
      w.replace("bigscreen", m ? 48 : -48, 64.5);
      w.spec.ao.push([cx - sw / 2, z - 0.5, cx + sw / 2, z, 2]);
    }
  }

  // ---- The alley and the far pavement want light too.
  for (const [x, z] of [[-63.5, -30], [-63.5, 4], [-63.5, 38], [-63.5, 70]]) { const p = partFor(x); w.pool(p, mx(x), z, 3.2, 2.8, 0xffe2b0, 0.1); }

  for (const p of [west, mid, east]) w.finish(p, false);
  w.finish(out, false, "outside");
  void v;
}
const OPPN: Record<string, string> = { POR: "PORTUGAL", BRA: "BRAZIL", ARG: "ARGENTINA" };
function bigScreen(c: Ctx, w: number, h: number, opp: string) {
  rect(c, 0, 0, w, h, H(0x0c0d10));
  const x = 4, y = 4, sw = w - 8, sh = h - 30;
  for (let i = 0; i < sw; i += 24) { rect(c, x + i, y, 12, sh, H(0x3b8a45)); rect(c, x + i + 12, y, 12, sh, H(0x34803f)); }
  c.strokeStyle = "rgba(238,244,238,0.9)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x + sw / 2, y); c.lineTo(x + sw / 2, y + sh); c.stroke(); c.beginPath(); c.arc(x + sw / 2, y + sh / 2, sh * 0.2, 0, 7); c.stroke(); c.strokeRect(x + 1, y + sh * 0.25, sw * 0.12, sh * 0.5); c.strokeRect(x + sw - sw * 0.12 - 1, y + sh * 0.25, sw * 0.12, sh * 0.5);
  const r = rng(66); for (let k = 0; k < 22; k++) { const px = x + 20 + r.int(sw - 40), py = y + 14 + r.int(sh - 30), en = k % 2 === 0; rect(c, px, py, 4, 7, H(en ? 0xf4f4f4 : 0xf2d21e)); rect(c, px, py + 7, 4, 4, H(en ? 0x1b2a6b : 0x1f7a3a)); rect(c, px + 1, py - 3, 3, 3, H(0xdba585)); rect(c, px - 1, py + 11, 7, 2, "rgba(10,20,10,0.4)"); }
  rect(c, x + 6, y + 6, 118, 16, H(0x15171a)); pixText(c, `ENG 0-0 ${opp.slice(0, 3)}`, x + 10, y + 19, 10, "#f2c94c", {}); rect(c, x + sw - 46, y + 6, 40, 14, H(0xc8102e)); pixText(c, "LIVE", x + sw - 26, y + 18, 9, "#ffffff", { align: "center" });
  rect(c, 0, h - 24, w, 24, H(art2.BLUE)); pixText(c, "FAN ZONE · LAGER £9 · THE QUEUE FOR THE TOILETS STARTS HERE · NO JUMPERS FOR GOALPOSTS", w / 2, h - 7, 10, "#f4f4f4", { align: "center", maxW: w - 12, weight: 700 });
  c.fillStyle = "rgba(7,8,10,0.28)"; for (let yy = 0; yy < h; yy += 3) c.fillRect(0, yy, w, 1);
}
function outerWall(c: Ctx, w: number, h: number, k: number) {
  art.blockwork(c, w, h);
  rect(c, 0, Math.round(h * 0.62), w, Math.round(h * 0.38), "rgba(27,42,107,0.82)"); rect(c, 0, Math.round(h * 0.62) - 2, w, 2, "#f4f4f4");
  const r = rng(300 + k);
  const paste = (x: number, y: number, pw: number, ph: number, fn: (c: Ctx, w: number, h: number) => void) => { c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, pw, ph); c.clip(); fn(c, pw, ph); c.restore(); };
  for (let x = 14 + r.int(20); x < w - 40; x += 34 + r.int(50)) { const q = r(); if (q < 0.45) paste(x, 28 + r.int(8), 28, 40, (cc, pw, ph) => art2.wanted(cc, pw, ph, x)); else paste(x, 30 + r.int(10), 26, 35, (cc, pw, ph) => art2.poster(cc, pw, ph, r.int(8))); if (r() < 0.4) { c.fillStyle = "rgba(210,205,190,0.8)"; c.fillRect(x + 30, 34, 14, 20); } }
  const tags = ["ENGLAND TILL I DIE (OF THIS PIE)", "REF IS A", "KEV 4 SHAZ", "NO BALL GAMES NO BALLS"];
  c.save(); c.globalAlpha = 0.75; pixText(c, tags[k % tags.length], w * 0.5, Math.round(h * 0.2) + 10, 9, k % 2 ? "#e8e8ee" : "#d83a5a", { align: "center", maxW: w * 0.6, weight: 700 }); c.restore();
  const g = c.createLinearGradient(0, h - 16, 0, h); g.addColorStop(0, "rgba(20,24,16,0)"); g.addColorStop(1, "rgba(20,24,16,0.5)"); c.fillStyle = g; c.fillRect(0, h - 16, w, 16);
}

// ---------------------------------------------------------------------------------------------
/** What the 2D ground layer had painted on it: names where the game had them, the way in, the crossings' studs. */
export function groundPaint(w: World3D): void {
  const sp = w.spec, v = w.host.venue, m = w.mirror, mx = (x: number) => (m ? -x : x), P = (q: number) => Math.round(q * PXM);
  const word = (text: string, x: number, y: number, cap: number, colr: string, alpha = 0.6, stretch = 1.5) => {
    const wm = (text.length * cap * 0.9) / PXM + 1, hm = (cap * stretch * 1.8) / PXM + 0.4;
    patch(sp, x - wm / 2, y - hm / 2, wm, hm, (c) => { c.save(); c.globalAlpha = alpha; c.translate(P(x), P(y)); c.scale(1, stretch); pixText(c, text, 0, cap / 2, cap, colr, { align: "center", weight: 800 }); c.restore(); });
  };
  // Names: the ones no sign already says.
  const SIGNED = new Set(["STAFF ENTRANCE", "THE THREE LIONS", "TICKETS", "MERCHANDISE", "TURNSTILES", "STEWARDS", "SECOND HAND ROSE", "ARMY & NAVY", "BOOKMAKER", "CASH KINGS", "TEAM HOTEL", "FAN ZONE", "BIG SCREEN"]);
  for (const [t, x, y, size] of sp.labels) if (!SIGNED.has(t)) word(t, x, y, Math.round((size ?? 11) * 1.25), "#f4f4f0", 0.55);
  // The way in: yellow lanes up to each turnstile, chevrons.
  for (const t of v.spots.turnstiles) patch(sp, t.x - 1.5, 45.1, 3, 5, (c) => {
    c.fillStyle = "rgba(226,190,50,0.85)"; c.fillRect(P(t.x - 1.3), P(45.2), 4, P(4.6)); c.fillRect(P(t.x + 1.18), P(45.2), 4, P(4.6));
    for (let k = 0; k < 3; k++) { const cy = 46.2 + k * 1.25; c.beginPath(); c.moveTo(P(t.x), P(cy)); c.lineTo(P(t.x - 0.75), P(cy + 0.75)); c.lineTo(P(t.x - 0.75), P(cy + 1.05)); c.lineTo(P(t.x), P(cy + 0.3)); c.lineTo(P(t.x + 0.75), P(cy + 1.05)); c.lineTo(P(t.x + 0.75), P(cy + 0.75)); c.closePath(); c.fill(); }
    for (let k = 0; k < 60; k++) { c.fillStyle = "rgba(90,88,84,0.8)"; c.fillRect(P(t.x - 1.3) + ((k * 37) % P(2.6)), P(45.2) + ((k * 53) % P(4.6)), 2, 1); }
  });
  // On the concourse: a coloured panel at each gangway with its block on it, chevrons, and which stand this is.
  const opp = v.opp, ways: [number, number, string, number, "n" | "w" | "e"][] = [[-22, 38.3, "S1", 0xc8102e, "n"], [0, 38.3, "S2", 0xc8102e, "n"], [22, 38.3, "S3", 0xc8102e, "n"], [mx(-50.3), 0, "W", 0x1b4fd0, m ? "e" : "w"], [mx(50.3), 0, opp === "POR" ? "E" : "E", 0x8a1a22, m ? "w" : "e"]];
  for (const [x, y, code, colr, dir] of ways) {
    const px = dir === "n" ? x : x + (dir === "w" ? -2.6 : 2.6), py = dir === "n" ? y + 2.9 : y;
    patch(sp, px - 4.2, py - 1.2, 8.4, 4.2, (c) => {
      c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(P(px - 1.85), P(py - 0.85), P(3.7), P(1.7)); c.fillStyle = H(colr); c.fillRect(P(px - 1.75), P(py - 0.75), P(3.5), P(1.5));
      c.save(); c.translate(P(px), P(py)); c.scale(1, 1.4); pixText(c, code, 0, 11, 22, "#ffffff", { align: "center", shadow: "rgba(0,0,0,0.6)" }); c.restore();
      c.fillStyle = "rgba(255,255,255,0.75)";
      for (let k = 0; k < 2; k++) { c.beginPath(); if (dir === "n") { const cy = py + 1.3 + k * 0.9; c.moveTo(P(px - 0.7), P(cy + 0.45)); c.lineTo(P(px + 0.7), P(cy + 0.45)); c.lineTo(P(px), P(cy - 0.2)); } else { const s2 = dir === "w" ? 1 : -1, cx = px + s2 * (1.9 + k * 0.9); c.moveTo(P(cx + s2 * 0.45), P(py - 0.7)); c.lineTo(P(cx + s2 * 0.45), P(py + 0.7)); c.lineTo(P(cx - s2 * 0.2), P(py)); } c.closePath(); c.fill(); }
    });
  }
  word("SOUTH STAND · BLOCKS S1 · S2 · S3", -11, 43.4, 11, "#ffffff", 0.7, 1.4); word("AWAY SUPPORTERS", mx(53), 5.2, 10, "#ffffff", 0.7, 1.4); word("WEST END", mx(-53), 5.2, 11, "#ffffff", 0.7, 1.4);
  // Keep clear, where the dray comes out; the bus stop; no parking by the gate.
  const ya = w.host.areas.find((q) => q.id === "pub_yard");
  if (ya) { const cx = ya.x + ya.w / 2; word("KEEP", cx, ya.y + ya.h + 1.3, 30, "#d9b92a", 0.62, 1.3); word("CLEAR", cx, ya.y + ya.h + 2.75, 30, "#d9b92a", 0.62, 1.3);
    // the drain the hose runs to, a dished channel across the yard, where people actually walk
    const px = m ? ya.x + ya.w : ya.x, e = m ? -1 : 1, zr = ya.y + 7;
    patch(sp, ya.x, ya.y, ya.w, ya.h, (c) => {
      for (let x = P(ya.x + 0.4); x < P(ya.x + ya.w - 0.4); x += 8) { c.fillStyle = (x / 8) % 3 ? "#5c5552" : "#544d4a"; c.fillRect(x, P(zr + 5.6), 7, 4); c.fillStyle = "rgba(20,20,24,0.4)"; c.fillRect(x, P(zr + 5.6) + 1, 7, 1); }
      const dx = P(px + e * 3.0) - 8, dz = P(zr + 5.2); c.fillStyle = "rgba(20,18,20,0.4)"; c.beginPath(); c.ellipse(dx + 8, dz + 10, 46, 26, 0.2, 0, 7); c.fill();
      c.fillStyle = "#1a1a1c"; c.fillRect(dx - 1, dz - 1, 18, 18); c.fillStyle = "#4a4c50"; c.fillRect(dx, dz, 16, 16); c.fillStyle = "#121214"; for (let k = 2; k < 15; k += 3) c.fillRect(dx + 2, dz + k, 12, 1); c.fillStyle = "#74777c"; c.fillRect(dx, dz, 16, 1);
      c.save(); c.lineCap = "round"; c.strokeStyle = "rgba(205,190,170,0.07)"; c.lineWidth = 60; c.beginPath(); c.moveTo(P(ya.x + ya.w / 2 + e * 2), P(ya.y - 1)); c.bezierCurveTo(P(ya.x + ya.w / 2), P(ya.y + 4), P(px + e * 3), P(zr - 2), P(px + e * 0.6), P(zr + 1)); c.stroke(); c.lineWidth = 30; c.stroke();
      c.strokeStyle = "rgba(18,16,16,0.13)"; c.lineWidth = 26; c.beginPath(); c.moveTo(P(ya.x + ya.w / 2 - 0.9), P(ya.y + 8)); c.lineTo(P(ya.x + ya.w / 2 - 0.9), P(ya.y + ya.h + 4)); c.moveTo(P(ya.x + ya.w / 2 + 0.9), P(ya.y + 8)); c.lineTo(P(ya.x + ya.w / 2 + 0.9), P(ya.y + ya.h + 4)); c.stroke(); c.restore();
      // a bay for the dray, hand-painted
      c.strokeStyle = "rgba(217,185,42,0.5)"; c.lineWidth = 3; c.setLineDash([14, 9]); c.strokeRect(P(ya.x + ya.w / 2 - 1.7), P(ya.y + 6.6), P(3.4), P(8.2)); c.setLineDash([]);
    });
    word("DRAY", ya.x + ya.w / 2, ya.y + 13.6, 16, "#d9b92a", 0.45, 1.3);
  }
  word("BUS", mx(12), 90.2, 20, "#d9b92a", 0.6, 1.3); word("STOP", mx(12), 91.2, 20, "#d9b92a", 0.6, 1.0);
  word("NO PARKING", mx(67), -36, 14, "#d9b92a", 0.6, 1.4); word("DELIVERIES", mx(67), -49.5, 14, "#e8e8e0", 0.5, 1.4);
  // Hatching in the loading bay, and the technical areas by the dugouts.
  const lb = w.host.areas.find((q) => q.id === "loading");
  if (lb) patch(sp, lb.x + 1, lb.y + 2.2, lb.w - 2, 5, (c, x0, y0, x1, y1) => { c.strokeStyle = "rgba(217,185,42,0.55)"; c.lineWidth = 4; for (let x = Math.floor((x0 - (y1 - y0)) / 40) * 40; x < x1; x += 40) { c.beginPath(); c.moveTo(x, y1); c.lineTo(x + (y1 - y0), y0); c.stroke(); } c.strokeRect(P(lb.x + 1) + 2, P(lb.y + 2.2) + 2, P(lb.w - 2) - 4, P(5) - 4); });
  for (const f of v.furniture) if (f.key === "dugout") patch(sp, f.x - 4.2, f.y - 1.6, 8.4, 3.4, (c) => { c.strokeStyle = "rgba(238,244,238,0.8)"; c.lineWidth = 2; c.setLineDash([10, 7]); c.strokeRect(P(f.x - 4), P(f.y - 1.3), P(8), P(2.9)); c.setLineDash([]); });
  // Studs along the crossings.
  for (const cx of [-46, 2, 36]) patch(sp, mx(cx) - 2.6, 84.4, 5.2, 7.4, (c) => { c.fillStyle = "rgba(238,234,224,0.8)"; for (let y = 84.7; y < 91.4; y += 0.45) { c.fillRect(P(mx(cx) - 2.2), P(y), 3, 2); c.fillRect(P(mx(cx) + 2.14), P(y), 3, 2); } });
  // More standing water where the first frame is: the yard and the approach above it.
  void BRICK_RED;
}

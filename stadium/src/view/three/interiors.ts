// Indoors, as dollhouse rooms: the back wall and the west wall stand at full height with things on them
// (those are the two you can see from the south-east), the near walls stay cut low, and what was a flat
// card is built: lockers, benches, pegs with shirts on, the bar, the lifts. Every room is laid out from
// the layout's own areas, walls and furniture list, so it holds for the mirrored ground too.
import type { Area, Furniture, Wall } from "../../stadium/layout";
import type { BuildingSpec } from "../build";
import * as art from "./art";
import * as art2 from "./art2";
import { patch } from "./ground";
import type { Builder } from "./mesh";
import { H, PXM, css, hex, pixText, rect, rng, shade, tiny, type Atlas, type Ctx, type Region } from "./paint";
import { standWall } from "./stands";
import type { Part, World3D } from "./world3d";

const col = (c: number, c2?: number) => ({ c, c2 });
type Paint = (c: Ctx, w: number, h: number) => void;
const OPP_KIT: Record<string, [number, number]> = { POR: [0xa8222e, 0x1f6a3a], BRA: [0xf2d21e, 0x1f7a3a], ARG: [0x8ec8f0, 0xf4f4f4], GER: [0xf4f4f4, 0x15171a], FRA: [0x1b3a8a, 0xf4f4f4] };

/** What the wall list should do with this wall: stand it at a height, leave it out (something better is built), or the usual. */
export function wallPlan(w: World3D, wl: Wall): number | "skip" | undefined {
  const s = standWall(w, wl);
  if (s !== undefined) return s;
  if (wl.prop || wl.gate) return undefined;
  if (wl.w <= 0.6 && wl.h >= 12 && wl.y <= -60.9 && wl.y + wl.h <= -47.9) return 2.8; // between the rooms under the main stand
  if (wl.h3 === 1.1 && wl.w > 5) { // bar counters: the two on the concourse, and the pub's when the pub is a building
    if (wl.y < 50) return "skip";
    if (w.host.blds.some((b) => b.id === "pub")) return "skip";
  }
  return undefined;
}

class Kit {
  A: Builder; U: Builder; at: Atlas;
  constructor(public w: World3D, public p: Part) { this.A = p.A; this.U = p.U; this.at = w.atlas; }
  pm(wm: number, hm: number, fn: Paint, opaque = true): Region { return this.at.paintM(wm, hm, fn, 1, opaque); }
  /** Painted at 64 px/m (anything with words on). */
  hd(wm: number, hm: number, fn: Paint, opaque = true): Region { return this.at.paint(Math.round(wm * 64), Math.round(hm * 64), fn, opaque); }
  /** A wall along x at z, looking south, painted. */
  wallS(x0: number, x1: number, z: number, h: number, fn: Paint, thick = 0.2, cap = 0xa8acb2) { this.A.box(x0, 0, z - thick, x1, h, z, { all: col(0x8a8e94), s: this.pm(x1 - x0, h, fn), top: col(cap) }); }
  /** A wall along z at x, looking east, painted: the left of the picture is its south end. `thick` 0 = just the face. */
  wallE(x: number, z0: number, z1: number, h: number, fn: Paint, thick = 0, cap = 0xa8acb2) {
    const r = this.pm(z1 - z0, h, fn);
    if (thick) this.A.box(x - thick, 0, z0, x, h, z1, { all: col(0x8a8e94), e: r, top: col(cap) });
    else this.A.quad([x, 0, z1], [x, 0, z0], [x, h, z0], [x, h, z1], r);
  }
  /** Something flat on a south-looking wall: centre x, bottom y, size in metres. */
  onS(r: Region, xc: number, y: number, wm: number, hm: number, z: number, unlit = false, flip = false) {
    (unlit ? this.U : this.A).quad([xc - wm / 2, y, z], [xc + wm / 2, y, z], [xc + wm / 2, y + hm, z], [xc - wm / 2, y + hm, z], { r, flip });
  }
  /** Something flat on an east-looking wall: centre z. */
  onE(r: Region, x: number, zc: number, y: number, wm: number, hm: number, unlit = false) {
    (unlit ? this.U : this.A).quad([x, y, zc + wm / 2], [x, y, zc - wm / 2], [x, y + hm, zc - wm / 2], [x, y + hm, zc + wm / 2], r);
  }
  /** A light on a south-looking wall: a bulkhead, its glow, and what it throws on the floor. */
  lampS(x: number, y: number, z: number, c = 0xffe2a8, pool = 2.2) {
    this.A.box(x - 0.2, y - 0.06, z, x + 0.2, y + 0.14, z + 0.1, col(0x2a2c30)); this.U.box(x - 0.17, y - 0.03, z + 0.1, x + 0.17, y + 0.11, z + 0.13, col(c));
    this.w.halo(this.p, [x, y, z + 0.3], 1.6, c, 0.4); if (pool) this.w.pool(this.p, x, z + pool * 0.8, pool, pool * 0.75, c, 0.16);
  }
  lampE(x: number, y: number, z: number, c = 0xffe2a8, pool = 2.2) {
    this.A.box(x, y - 0.06, z - 0.2, x + 0.1, y + 0.14, z + 0.2, col(0x2a2c30)); this.U.box(x + 0.1, y - 0.03, z - 0.17, x + 0.13, y + 0.11, z + 0.17, col(c));
    this.w.halo(this.p, [x + 0.3, y, z], 1.6, c, 0.4); if (pool) this.w.pool(this.p, x + pool * 0.9, z + 0.3, pool, pool * 0.75, c, 0.16);
  }
  pool(x: number, z: number, rx: number, rz: number, c = 0xffdca0, a = 0.14) { this.w.pool(this.p, x, z, rx, rz, c, a); }
  /** A bench: slats on steel legs. */
  bench(x0: number, z0: number, x1: number, z1: number, h = 0.45, top = 0x8a6a48) {
    const r = this.w.sw.slats;
    this.A.box(x0, h - 0.06, z0, x1, h, z1, { all: col(0x5a4630, 0x7a5a3c), top: { r, uv: [0, 0, Math.min(1, (x1 - x0) / 4), 1], c: top === 0x8a6a48 ? 0xffffff : top } });
    for (let x = x0 + 0.15; x < x1; x += Math.max(0.9, (x1 - x0 - 0.3) / Math.max(1, Math.round((x1 - x0) / 1.4)))) this.A.box(x - 0.03, 0, z0 + 0.04, x + 0.03, h - 0.06, z1 - 0.04, col(0x3a3f46, 0x5c6168));
  }
  /** A table or a desk: a top on a painted front. */
  table(x0: number, z0: number, x1: number, z1: number, h: number, top: FaceLike, front: FaceLike, side: FaceLike = col(0x3a3028, 0x54463a)) {
    this.A.box(x0, 0, z0, x1, h, z1, { all: side, s: front, top });
  }
}
type FaceLike = Region | { r?: Region; c?: number; c2?: number; uv?: [number, number, number, number] };

/** The room as you see it: from the wall on its west to the wall on its east. */
function span(w: World3D, a: Area): { xW: number; xE: number } {
  let xW = -Infinity, xE = Infinity;
  for (const wl of w.host.walls) {
    if (wl.prop || wl.gate || wl.w > 1.1 || wl.h < a.h * 0.8 || wl.y > a.y + 1 || wl.y + wl.h < a.y + a.h - 1) continue;
    if (wl.x + wl.w <= a.x + 0.6 && wl.x + wl.w > xW) xW = wl.x + wl.w;
    if (wl.x >= a.x + a.w - 0.6 && wl.x < xE) xE = wl.x;
  }
  return { xW: isFinite(xW) ? xW : a.x, xE: isFinite(xE) ? xE : a.x + a.w };
}
const pic = (K: Kit, key: string): Region | null => {
  const im = K.w.host.image(key);
  return im ? K.at.paint(im.width, im.height, (c) => { c.drawImage(im as CanvasImageSource, 0, 0); }) : null;
};

export function buildInteriors(w: World3D): void {
  const areas = w.host.areas, by = (id: string) => areas.find((q) => q.id === id), v = w.host.venue;
  // The gaps the layout leaves between rooms are floor too, not wet pavement.
  const inX0 = w.mirror ? -62 : -56, inX1 = w.mirror ? 56 : 62;
  w.spec.under.push({ x: inX0, y: -61, w: inX1 - inX0, h: 105, kind: "lino", base: 0x4c5560, wet: false });

  // ---- Under the main stand.
  const rooms = w.part("rooms"), K = new Kit(w, rooms);
  const home = by("dress_home"), away = by("dress_away"), ref = by("ref_room"), sec = by("security");
  if (home) dressingRoom(K, home, true);
  if (away) dressingRoom(K, away, false);
  if (ref) refRoom(K, ref);
  if (sec) securityOffice(K, sec);
  for (const id of ["kitchen", "medical", "kitroom"]) { const a = by(id); if (a) plainRoom(K, a); }
  corridor(K);
  w.finish(rooms, false, "inside", false);

  // ---- The concourse.
  const con = w.part("concourse");
  concourse(new Kit(w, con));
  w.finish(con, false, "inside", false);

  // ---- The buildings on the street.
  for (const b of w.host.blds) {
    const p = w.part(`in-${b.id}`), k = new Kit(w, p);
    if (b.id === "pub") pubInside(k, b);
    else if (b.id === "hotel") hotelInside(k, b);
    else if (b.id === "bookies") pawnInside(k, b);
    else shopInside(k, b);
    w.finish(p, false, `room:${b.id}`, false);
  }
  void v;
}

// ---------------------------------------------------------------------------------------------
function dressingRoom(K: Kit, a: Area, home: boolean) {
  const { w, A, U } = K, v = w.host.venue, { xW, xE } = span(w, a), zB = a.y - 0.42, z1 = a.y + a.h, Hh = 3, W = xE - xW;
  const furn = v.furniture.filter((f) => f.room === a.id), of = (k: string) => furn.filter((f) => f.key === k);
  const dado = home ? art2.BLUE : 0x5e3a3c, base = home ? 0xdcd6c2 : 0xb9b6a0, kit: [number, number] = home ? [0xf4f4f4, art2.BLUE] : OPP_KIT[v.opp] ?? [0xa8222e, 0xf2c94c];
  // The floor runs to the walls, and is wet under the showers.
  if (xW < a.x - 0.2) w.spec.under.push({ x: xW, y: a.y - 1, w: a.x - xW, h: a.h + 1, kind: "rubber", base: a.floor, wet: false });
  if (xE > a.x + a.w + 0.2) w.spec.under.push({ x: a.x + a.w, y: a.y - 1, w: xE - a.x - a.w, h: a.h + 1, kind: "rubber", base: a.floor, wet: false });
  w.spec.under.push({ x: xW, y: a.y - 1, w: W, h: 1.05, kind: "rubber", base: a.floor, wet: false });
  for (const f of of("showers")) {
    const sx0 = Math.max(xW, f.x - 1.8), sx1 = Math.min(xE, f.x + 1.8);
    w.spec.under.push({ x: sx0, y: zB, w: sx1 - sx0, h: 1.9, kind: "whitetile", base: 0, wet: false, over: true });
    patch(w.spec, sx0, zB, sx1 - sx0, 1.9, (c, x0, y0, x1, y1) => { c.fillStyle = "rgba(120,150,170,0.28)"; c.fillRect(x0, y0, x1 - x0, y1 - y0); });
  }
  // The crest (or a stain) on the floor in the middle.
  if (home) patch(w.spec, a.x + a.w / 2 - 1.6, a.y + a.h / 2 - 0.4, 3.2, 3.2, (c) => { const cx = Math.round((a.x + a.w / 2) * PXM), cy = Math.round((a.y + a.h / 2 + 1.2) * PXM); c.save(); c.globalAlpha = 0.5; c.fillStyle = "#f4f4f4"; c.beginPath(); c.arc(cx, cy, 44, 0, 7); c.fill(); c.fillStyle = H(a.floor); c.beginPath(); c.arc(cx, cy, 39, 0, 7); c.fill(); c.translate(cx - 20, cy - 28); art2.crest(c as Ctx, 40, 56); c.restore(); });

  // Back wall.
  K.wallS(xW, xE, zB, Hh, (c, ww, h) => {
    const X = (x: number) => Math.round((x - xW) * PXM), Y = (m: number) => Math.round(h - m * PXM);
    art2.roomWall(c, ww, h, { base, dado, band: home ? art2.RED : 0x8a8672, seed: home ? 31 : 37, grime: home ? 0.35 : 0.85 });
    for (const f of of("showers")) { const x0 = X(Math.max(xW, f.x - 1.8)); art2.tiles(c, x0, 0, X(Math.min(xE, f.x + 1.8)) - x0, h, home ? 7 : 9, dado, home ? 0xdfe4e4 : 0xc9cdc4); }
    for (const f of of("kitpegs")) { rect(c, X(f.x - 2.0), Y(1.86), Math.round(4 * PXM), 4, H(0x6a4a2a)); rect(c, X(f.x - 2.0), Y(1.86), Math.round(4 * PXM), 1, H(0x9a7a52)); for (let k = 0; k < 5; k++) { const px = X(f.x - 1.6 + k * 0.8); rect(c, px - 1, Y(1.86) + 3, 2, 4, H(0xc9cdd2)); rect(c, px - 6, Y(2.2), 12, 8, "#f1efe6"); tiny(c, String([1, 5, 9, 10, 7][k]), px, Y(2.2) + 2, "#15171a", 1, "center"); } }
    if (!home) { // somebody's been at the paint
      const r = rng(77);
      for (let k = 0; k < 9; k++) { const px = r.int(ww - 30), py = Y(1.5 + r() * 1.3); c.fillStyle = css(shade(hex(base), 0.78), 0.8); c.beginPath(); c.ellipse(px, py, 8 + r.int(16), 4 + r.int(8), r(), 0, 7); c.fill(); c.fillStyle = "rgba(196,190,170,0.9)"; c.beginPath(); c.ellipse(px + 2, py + 1, 4 + r.int(8), 2 + r.int(4), r(), 0, 7); c.fill(); }
      const g = c.createRadialGradient(ww * 0.42, 0, 4, ww * 0.42, 0, 90); g.addColorStop(0, "rgba(40,52,30,0.6)"); g.addColorStop(1, "rgba(40,52,30,0)"); c.fillStyle = g; c.fillRect(ww * 0.42 - 90, 0, 180, 90);
    }
  });
  // Showers: pipes down the tiles, heads, a kerb.
  for (const f of of("showers")) {
    const sx0 = Math.max(xW + 0.1, f.x - 1.7), sx1 = Math.min(xE - 0.1, f.x + 1.7);
    A.bar([sx0, 2.45, zB + 0.06], [sx1, 2.45, zB + 0.06], 0.05, col(0xb9bec4, 0xdfe3e8));
    for (let k = 0; k < 3; k++) { const x = sx0 + 0.55 + (k * (sx1 - sx0 - 1.1)) / 2; A.bar([x, 1.1, zB + 0.06], [x, 2.45, zB + 0.06], 0.045, col(0x9aa0a6, 0xdfe3e8)); A.bar([x, 2.2, zB + 0.06], [x, 2.1, zB + 0.42], 0.04, col(0xc9cdd2)); A.cyl(x, 2.0, 2.1, zB + 0.44, 0.1, 6, col(0x8f959c, 0xc9cdd2), col(0x6f757c), 0.05); A.box(x - 0.05, 1.1, zB + 0.03, x + 0.05, 1.22, zB + 0.12, col(k === 1 && !home ? 0xc8281e : 0xc9a23a)); }
    A.box(sx0 - 0.05, 0, zB + 1.85, sx1 + 0.05, 0.1, zB + 1.95, col(0xc9cdc8, 0xe8ecea));
    w.replace("showers", f.x, f.y);
  }
  // Pegs: a bench along the wall under five shirts.
  for (const f of of("kitpegs")) {
    K.bench(f.x - 2.0, zB + 0.02, f.x + 2.0, zB + 0.5);
    for (let k = 0; k < 5; k++) { const n = String([1, 5, 9, 10, 7][k]), r = K.pm(0.69, 0.84, (c, ww, h) => art2.hungShirt(c, ww, h, k === 0 ? (home ? 0xf2d21e : 0x2f9e5a) : kit[0], kit[1], n), false); K.onS(r, f.x - 1.6 + k * 0.8, 0.98, 0.69, 0.84, zB + 0.07 + (k % 2) * 0.01); }
    for (let k = 0; k < 4; k++) A.box(f.x - 1.7 + k * 0.95, 0, zB + 0.12, f.x - 1.45 + k * 0.95, 0.12, zB + 0.4, col(k % 2 ? 0x15171a : 0xe8e0d0, k % 2 ? 0x3a3d44 : 0xffffff)); // boots under it
    w.replace("kitpegs", f.x, f.y);
  }
  // Lockers: a bank of six with what lives on top of lockers.
  const rL = [K.pm(2.6, 1.9, (c, ww, h) => art2.lockers(c, ww, h, 6, home ? 0x34488a : 0x6a7078, 3)), K.pm(2.6, 1.9, (c, ww, h) => art2.lockers(c, ww, h, 6, home ? 0x34488a : 0x6a7078, 8))];
  of("lockers").forEach((f, i) => {
    const x0 = f.x - 1.3, x1 = f.x + 1.3, z0 = Math.max(zB + 0.01, f.y - 0.78), zf = f.y;
    A.box(x0, 0, z0, x1, 1.9, zf, { all: col(home ? 0x2a3a72 : 0x565c64, home ? 0x34488a : 0x6a7078), s: rL[i % 2], top: col(home ? 0x1f2c5a : 0x45494f) });
    A.box(x0 + 0.3, 1.9, z0 + 0.15, x0 + 0.95, 2.12, zf - 0.15, col(0x8a6a48, 0xa98a62)); // a box of cones
    A.cyl(x1 - 0.6, 1.9, 2.18, (z0 + zf) / 2, 0.15, 6, col(0xe8e8e4, 0xffffff), col(0xf4f4f0), 0.1); // a ball
    if (i === 0) A.box(x0 + 1.2, 1.9, z0 + 0.1, x0 + 1.7, 2.0, zf - 0.1, col(home ? 0xc8102e : 0x3a3d44));
    w.replace("lockers", f.x, f.y);
    w.spec.ao.push([x0, z0, x1, zf, 1.6]);
  });
  // What is said on the walls.
  const mid = (of("kitpegs")[0]?.x ?? a.x + a.w / 2), lx = of("lockers").map((f) => f.x).sort((p, q) => p - q);
  const signX = lx.length >= 2 ? (lx[0] + lx[1]) / 2 : mid;
  K.onS(K.hd(3.4, 0.56, (c, ww, h) => (home ? art2.plate(c, ww, h, "ENGLAND EXPECTS", art2.BLUE, 0xf4f4f4, { sub: "(TO GO OUT ON PENALTIES)", border: art2.RED }) : art2.plate(c, ww, h, "WELCOME, VISITORS", 0x3a3d44, 0xd8d4c8, { sub: "HOT WATER IS A PRIVILEGE, NOT A RIGHT" }))), signX, 2.34, 3.4, 0.56, zB + 0.03);
  const clk = K.at.paint(22, 22, art2.clock, false);
  for (const f of of("lockers")) { K.lampS(f.x, 2.62, zB + 0.01, home ? 0xffe6b0 : 0xe8f0d8, 2.4); }
  K.onS(clk, signX + 2.3, 2.3, 0.6, 0.6, zB + 0.03);
  // The west wall.
  const zc = (zB + z1) / 2;
  K.wallE(xW + 0.02, zB, z1, 2.8, (c, ww, h) => {
    const Z = (z: number) => Math.round((z1 - z) * PXM), Y = (m: number) => Math.round(h - m * PXM);
    art2.roomWall(c, ww, h, { base, dado, band: home ? art2.RED : 0x8a8672, seed: home ? 41 : 47, grime: home ? 0.35 : 0.85 });
    if (home) { c.save(); c.translate(Z(zc) - 30, Y(2.55)); art2.crest(c, 60, 78); c.restore(); }
    else { // a cracked mirror and a payphone that takes coins nobody has
      c.save(); c.translate(Z(zc + 1) - 16, Y(2.2)); art2.mirror(c, 32, 44); c.strokeStyle = "rgba(30,34,40,0.8)"; c.beginPath(); c.moveTo(6, 4); c.lineTo(16, 20); c.lineTo(11, 30); c.moveTo(16, 20); c.lineTo(27, 26); c.stroke(); c.restore();
      rect(c, Z(zc - 2.2), Y(1.75), 16, 26, H(0x2a2c30)); rect(c, Z(zc - 2.2) + 2, Y(1.75) + 2, 12, 6, H(0x9db4c4)); for (let k = 0; k < 9; k++) rect(c, Z(zc - 2.2) + 3 + (k % 3) * 4, Y(1.75) + 11 + Math.floor(k / 3) * 4, 2, 2, H(0xc9cdd2));
    }
  });
  const xw = xW + 0.045;
  if (home) {
    K.onE(K.pm(1.5, 0.9, (c, ww, h) => art2.telly(c, ww, h, 0)), xw + 0.06, zc - 3.2, 1.75, 1.5, 0.9, true); A.box(xW + 0.02, 2.1, zc - 3.3, xW + 0.1, 2.3, zc - 3.1, col(0x15171a));
    w.halo(K.p, [xW + 0.4, 2.2, zc - 3.2], 2.4, 0x9fe0a8, 0.16);
    K.onE(K.hd(1.5, 1.05, (c, ww, h) => art2.menuBoard(c, ww, h, "FINES", [["LATE", "£50"], ["PHONE OUT", "£100"], ["HAIRBAND", "£500"], ["OWN GOAL", "YOUR CAR"]], 0xf1efe6, 0xb01020)), xw, zc + 3.4, 1.35, 1.5, 1.05);
    K.onE(K.pm(1.3, 1.0, (c, ww, h) => art2.coatHooks(c, ww, h, 5, [0xf4f4f4, 0x1b2a6b, 0xf4f4f4, 0xc8102e]), false), xw, zc + 1.3, 1.0, 1.3, 1.0);
  } else {
    K.onE(K.hd(1.7, 0.6, (c, ww, h) => art2.plate(c, ww, h, "DO NOT STEAL THE TOWEL", 0xf1efe6, 0x15171a, { sub: "(SINGULAR)" })), xw, zc + 3.2, 1.6, 1.7, 0.6);
    K.onE(K.pm(1.4, 0.75, (c, ww, h) => art2.clutter(c, ww, h, "rad"), false), xw, zc - 3.0, 0.2, 1.4, 0.75);
    K.onE(K.hd(0.8, 0.28, (c, ww, h) => art2.plate(c, ww, h, "OUT OF ORDER", 0xf2c81e, 0x15171a)), xw + 0.01, zc - 3.0, 0.98, 0.8, 0.28);
  }
  K.onE(K.at.paint(18, 44, (c, ww, h) => art2.clutter(c, ww, h, "ext"), false), xw, z1 - 1.0, 0.25, 0.56, 1.38);
  K.lampE(xW + 0.03, 2.5, zc + 0.2, home ? 0xffe6b0 : 0xe8f0d8, 2.6);
  // The kit hamper, in the corner by the door wall, and a crate of bottles.
  {
    const hx = xW + 0.5, hz = z1 - 1.55, rW = w.sw.wicker;
    A.box(hx, 0, hz, hx + 1.15, 0.62, hz + 0.8, { all: { r: rW }, top: col(0x2a2018) });
    A.box(hx + 0.08, 0.5, hz + 0.08, hx + 1.07, 0.74, hz + 0.72, { all: col(kit[0]), top: col(kit[0]) }); A.box(hx + 0.3, 0.74, hz + 0.2, hx + 0.9, 0.8, hz + 0.6, col(kit[1]));
    A.box(hx + 1.4, 0, hz + 0.15, hx + 1.95, 0.32, hz + 0.6, { all: col(0x2f6ab0, 0x4a8ad0), top: col(0x1c2a3a) });
    for (let k = 0; k < 6; k++) A.cyl(hx + 1.52 + (k % 3) * 0.16, 0.32, 0.42, hz + 0.28 + Math.floor(k / 3) * 0.18, 0.045, 5, col(0xe8f0f4), col(0xf2a51a));
  }
  // Light: two warm pools down the middle (colder for the visitors).
  for (const t of [0.3, 0.7]) K.pool(xW + W * t, zB + (z1 - zB) * 0.55, 3.6, 2.8, home ? 0xffe2a8 : 0xdce8d0, home ? 0.12 : 0.08);
  void U;
}

function refRoom(K: Kit, a: Area) {
  const { w, A } = K, { xW, xE } = span(w, a), zB = a.y + 0.55, z1 = a.y + a.h, im = w.host.image("w-wall-ref_room");
  if (xW < a.x - 0.2) w.spec.under.push({ x: xW, y: a.y - 3, w: a.x - xW, h: a.h + 3, kind: "lino", base: 0x3a3d44, wet: false });
  if (xE > a.x + a.w + 0.2) w.spec.under.push({ x: a.x + a.w, y: a.y - 3, w: xE - a.x - a.w, h: a.h + 3, kind: "lino", base: 0x3a3d44, wet: false });
  w.spec.under.push({ x: xW, y: a.y - 3, w: xE - xW, h: 3.6, kind: "lino", base: 0x3a3d44, wet: false });
  K.wallS(xW, xE, zB, 3, (c, ww, h) => {
    art2.roomWall(c, ww, h, { base: 0xb9ac8c, dado: 0x6f7550, band: 0x3a3d44, seed: 51, dadoH: 1.1 });
    if (im) c.drawImage(im as CanvasImageSource, Math.round((a.x - xW) * PXM), 0);
  });
  // West wall: the eye chart, the flags, a small mirror.
  const zc = (zB + z1) / 2, xw = xW + 0.045;
  K.wallE(xW + 0.02, zB, z1, 2.8, (c, ww, h) => art2.roomWall(c, ww, h, { base: 0xb9ac8c, dado: 0x6f7550, band: 0x3a3d44, seed: 53, dadoH: 1.1 }));
  K.onE(K.hd(1.1, 1.5, (c, ww, h) => { rect(c, 0, 0, ww, h, "#15171a"); rect(c, 3, 3, ww - 6, h - 6, "#f4f1ea"); ["O", "F F", "S I D", "E R E F", "Y O U B L I", "N D B A S T A"].forEach((t, i) => pixText(c, t, ww / 2, 20 + i * 14 - i, Math.max(4, 13 - i * 2), "#15171a", { align: "center", weight: 800 })); rect(c, 8, h - 10, ww - 16, 1, H(0xb01020)); }), xw, zc + 0.6, 1.1, 1.1, 1.5);
  K.onE(K.at.paint(26, 36, art2.mirror), xw, zc - 1.6, 1.35, 0.6, 0.85);
  K.onE(K.pm(1.6, 1.0, (c, ww, h) => art2.coatHooks(c, ww, h, 9, [0x15171a, 0x15171a, 0xd8e020, 0x15171a]), false), xw, zc + 2.9, 1.0, 1.6, 1.0);
  for (const dz of [-0.2, 0.25]) { A.bar([xw + 0.05, 0.3, zc - 3.2 + dz], [xw + 0.25, 1.5, zc - 3.3 + dz], 0.03, col(0x8a6a48)); A.quad([xw + 0.2, 1.1, zc - 3.3 + dz], [xw + 0.2, 1.1, zc - 3.65 + dz], [xw + 0.26, 1.5, zc - 3.65 + dz], [xw + 0.26, 1.5, zc - 3.3 + dz], col(dz < 0 ? 0xf2c81e : 0xd8322a)); }
  K.lampE(xW + 0.03, 2.45, zc, 0xffe6b0, 2.4);
  // The tea table against the back wall in the corner the picture leaves: an urn, mugs, biscuits (two).
  const tx0 = xW < a.x - 1 ? xW + 0.25 : a.x + 0.3, tx1 = tx0 + 1.9, tz0 = zB + 0.03, tz1 = zB + 0.75;
  K.table(tx0, tz0, tx1, tz1, 0.78, { r: w.sw.formica }, K.pm(1.9, 0.78, (c, ww, h) => art2.counterFront(c, ww, h, 0x8a8f96, 5)), col(0x6f757c, 0x8f959c));
  A.cyl(tx0 + 0.45, 0.78, 1.36, tz0 + 0.36, 0.2, 8, { r: w.sw.urn }, col(0x8f959c), 0.2); A.cyl(tx0 + 0.45, 1.36, 1.44, tz0 + 0.36, 0.08, 6, col(0x15171a), col(0x15171a)); A.box(tx0 + 0.4, 0.86, tz0 + 0.54, tx0 + 0.5, 0.92, tz0 + 0.64, col(0xc8281e));
  for (let k = 0; k < 5; k++) A.cyl(tx0 + 0.95 + (k % 3) * 0.2, 0.78, 0.89, tz0 + 0.25 + Math.floor(k / 3) * 0.24, 0.055, 5, col([0xf4f1ea, 0x2f6ab0, 0xf4f1ea, 0xc8102e, 0xf2c81e][k]), col(0x5a3418));
  A.box(tx1 - 0.42, 0.78, tz0 + 0.38, tx1 - 0.12, 0.83, tz0 + 0.6, col(0xb01030, 0xd84a5a));
  K.onS(K.hd(1.3, 0.34, (c, ww, h) => art2.plate(c, ww, h, "TEA 20p", 0xf1efe6, 0x15171a, { sub: "HONESTY BOX (EMPTY)" })), (tx0 + tx1) / 2, 1.62, 1.3, 0.34, zB + 0.03);
  // A bench under the hooks, a chair.
  K.bench(a.x + 0.25, zB + 0.03, a.x + 2.9, zB + 0.45);
  K.pool((xW + xE) / 2, zc + 1.0, 3.8, 2.8, 0xffe2a8, 0.11);
}

function securityOffice(K: Kit, a: Area) {
  const { w, A, U } = K, v = w.host.venue, { xW, xE } = span(w, a), zB = a.y + 0.55, z1 = a.y + a.h, im = w.host.image("w-wall-security");
  K.wallS(xW, xE, zB, 3, (c, ww, h) => {
    art2.roomWall(c, ww, h, { base: 0x6a7068, dado: 0x464b5c, seed: 61 });
    if (im) c.drawImage(im as CanvasImageSource, Math.round((a.x - xW) * PXM), 0);
  });
  // The west wall is where you get stood: height lines, the poster, a bench to wait on, the notice.
  const zc = (zB + z1) / 2, xw = xW + 0.045;
  K.wallE(xW + 0.02, zB, z1, 2.8, (c, ww, h) => {
    const Z = (z: number) => Math.round((z1 - z) * PXM), Y = (m: number) => Math.round(h - m * PXM);
    art2.roomWall(c, ww, h, { base: 0x9aa09a, dado: 0x464b5c, band: 0xd9b92a, seed: 63 });
    const hx = Z(zc - 0.4) - 40; rect(c, hx, Y(2.3), 80, Y(0.9) - Y(2.3), "#e8e6da");
    for (let k = 0; k < 8; k++) { const y = Y(1.0 + k * 0.17); rect(c, hx, y, 80, 1, "#15171a"); if (k % 2 === 0) tiny(c, `${5 + Math.floor(k / 6)}'${(k * 2) % 12}`, hx + 2, y - 6, "#15171a"); }
    tiny(c, "STAND STILL", hx + 40, Y(2.3) + 2, "#b01020", 1, "center");
  });
  K.onE(K.hd(1.0, 1.4, (c, ww, h) => art2.wanted(c, ww, h, 3)), xw, zc + 2.2, 1.0, 1.0, 1.4);
  K.onE(K.hd(1.7, 0.5, (c, ww, h) => art2.plate(c, ww, h, "DETAINED PERSONS", 0xf2c81e, 0x15171a, { sub: "NO SINGING · NO BITING · NO REFUNDS" })), xw, zc - 3.0, 1.75, 1.7, 0.5);
  K.onE(K.pm(1.3, 0.8, (c, ww, h) => art2.telly(c, ww, h, 2)), xw + 0.07, z1 - 1.5, 1.65, 1.3, 0.8, true); A.box(xW + 0.02, 1.95, z1 - 1.6, xW + 0.1, 2.15, z1 - 1.4, col(0x15171a));
  K.bench(xW + 0.06, zc - 1.6, xW + 0.5, zc + 0.8, 0.45, 0x8a8f96);
  A.bar([xW + 0.08, 0.95, zc - 1.6], [xW + 0.08, 0.95, zc + 0.8], 0.04, col(0xc9cdd2)); // the rail you get cuffed to
  K.lampE(xW + 0.03, 2.5, zc + 0.3, 0xe8f0ff, 2.2);
  // The desk: a monitor, a mug, a phone, and the form.
  for (const f of v.furniture.filter((q) => q.room === a.id && q.key === "desk")) {
    const x0 = f.x - 1.0, x1 = f.x + 1.0, z0 = f.y - 0.8, zf = f.y;
    const rTop = K.pm(2.0, 0.8, (c, ww, h) => { rect(c, 0, 0, ww, h, H(0x8a8f96)); rect(c, 0, 0, ww, 1, H(0xc9cdd2)); rect(c, 22, 6, 13, 17, "#f4f1ea"); for (let k = 0; k < 6; k++) rect(c, 24, 9 + k * 2, 9 - (k % 3), 1, "rgba(30,34,40,0.6)"); tiny(c, "X", 31, 18, "#b01020"); rect(c, 37, 9, 1, 9, H(0x2f6ab0)); rect(c, 4, 5, 12, 7, H(0x23252b)); for (let k = 0; k < 8; k++) rect(c, 5 + (k % 4) * 3, 6 + Math.floor(k / 4) * 3, 2, 2, H(0xc9cdd2)); c.strokeStyle = "rgba(60,40,20,0.5)"; c.beginPath(); c.arc(54, 17, 3, 0, 7); c.stroke(); });
    K.table(x0, z0, x1, zf, 0.76, rTop, K.pm(2.0, 0.76, (c, ww, h) => art2.counterFront(c, ww, h, 0x6f757c, 7)), col(0x565c64, 0x7a8088));
    A.box(f.x + 0.15, 0.76, z0 + 0.12, f.x + 0.85, 1.28, z0 + 0.2, { all: col(0x15171a), s: null }); U.quad([f.x + 0.18, 0.84, z0 + 0.205], [f.x + 0.82, 0.84, z0 + 0.205], [f.x + 0.82, 1.25, z0 + 0.205], [f.x + 0.18, 1.25, z0 + 0.205], K.pm(0.64, 0.41, (c, ww, h) => cctv(c, ww, h)));
    A.cyl(f.x - 0.1, 0.76, 0.88, z0 + 0.5, 0.05, 5, col(0xf4f1ea), col(0x5a3418));
    A.box(f.x - 0.35, 0, zf + 0.25, f.x + 0.2, 0.46, zf + 0.75, { all: col(0x23252b, 0x3a3d44), top: col(0x2a3a5a) }); A.box(f.x - 0.35, 0.46, zf + 0.68, f.x + 0.2, 1.0, zf + 0.75, col(0x23252b, 0x3a3d44)); // his chair
    w.halo(K.p, [f.x + 0.5, 1.05, z0 + 0.4], 1.5, 0x9fd0ff, 0.2);
    w.replace("desk", f.x, f.y);
    w.spec.ao.push([x0, z0, x1, zf, 0.8]);
  }
  // Lockers at the far end, and the table of what has been taken off people today.
  const sp = v.spots.locker, lx0 = Math.min(xE - 2.5, Math.max(xW + 0.2, sp.x - 1.3)), lz0 = zB + 0.03;
  A.box(lx0, 0, lz0, lx0 + 2.2, 1.9, lz0 + 0.6, { all: col(0x565c64, 0x6a7078), s: K.pm(2.2, 1.9, (c, ww, h) => art2.lockers(c, ww, h, 5, 0x6a7078, 21)), top: col(0x45494f) });
  const cx0 = xW + 2.6, cz0 = zB + 0.05;
  K.table(cx0, cz0, cx0 + 2.2, cz0 + 0.7, 0.74, { r: w.sw.formica }, K.pm(2.2, 0.74, (c, ww, h) => art2.counterFront(c, ww, h, 0x565c64, 9, "CONFISCATED")), col(0x45494f, 0x6a7078));
  [[0.2, 0xd8322a, 0.3], [0.5, 0xf2c81e, 0.12], [0.75, 0x2f6ab0, 0.2], [1.05, 0xf4f1ea, 0.1], [1.4, 0x3a7a4a, 0.26], [1.75, 0xe2661c, 0.16]].forEach(([dx, c, hh], i) => A.box(cx0 + dx, 0.74, cz0 + 0.15 + (i % 2) * 0.2, cx0 + dx + 0.2, 0.74 + hh, cz0 + 0.3 + (i % 2) * 0.2, col(c)));
  A.cyl(cx0 + 2.0, 0.74, 1.3, cz0 + 0.4, 0.04, 5, col(0xd8322a, 0xf2c81e), undefined, 0.12); // a vuvuzela
  K.pool((xW + xE) / 2, zc + 0.6, 3.6, 2.8, 0xdce8ff, 0.09);
}
function cctv(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0x0c0d10));
  for (let k = 0; k < 4; k++) { const x = (k % 2) * (w / 2) + 1, y = Math.floor(k / 2) * (h / 2) + 1, ww = w / 2 - 2, hh = h / 2 - 2; rect(c, x, y, ww, hh, H([0x3a5a4a, 0x4a5058, 0x3a4658, 0x505a4a][k])); rect(c, x + 2, y + hh - 3, ww - 4, 1, "rgba(220,230,220,0.5)"); if (k === 2) { rect(c, x + ww / 2 - 2, y + 2, 4, 3, H(0xdba585)); rect(c, x + ww / 2 - 3, y + 5, 6, hh - 6, "#f4f4f4"); } }
}

/** Kitchen, medical room, kit room: the game's own painted wall, on a wall that is really there. */
function plainRoom(K: Kit, a: Area) {
  const { w } = K, zB = a.y + 0.55, im = w.host.image(`w-wall-${a.id}`);
  if (!im) return;
  const r = K.at.paint(im.width, im.height, (c) => { c.drawImage(im as CanvasImageSource, 0, 0); });
  K.A.box(a.x, 0, zB - 0.2, a.x + a.w, 3, zB, { all: col(0x8a8e94), s: r, top: col(0xa8acb2) });
  const { xW } = span(w, a);
  if (a.id === "kitchen") K.wallE(xW + 0.02, zB, a.y + a.h, 2.8, (c, ww, h) => { art2.roomWall(c, ww, h, { base: 0xc9cdc8, seed: 71, block: false }); art2.tiles(c, 0, Math.round(h - 1.9 * PXM), ww, Math.round(1.9 * PXM), 12, 0xb01030); });
  K.pool(a.x + a.w / 2, a.y + a.h * 0.6, a.w * 0.3, 2.6, a.id === "kitchen" ? 0xfff0d0 : 0xe8f0ff, 0.09);
}

/** The players' corridor: a name over each door, strip lights, a noticeboard, the line they walk out along. */
function corridor(K: Kit) {
  const { w, A, U } = K, v = w.host.venue, z = -48.25;
  const doors: [string, number, number, string][] = [["dress_home", art2.BLUE, 0xf4f4f4, "ENGLAND"], ["dress_away", 0x5e3a3c, 0xf4f4f4, "VISITORS"], ["ref_room", 0x15171a, 0xf2c81e, "MATCH OFFICIALS"], ["kitchen", 0xf1efe6, 0x15171a, "KITCHEN"], ["security", 0x464b5c, 0xf2c81e, "SECURITY"]];
  for (const [id, bg, fg, name] of doors) {
    const a = w.host.areas.find((q) => q.id === id); if (!a) continue;
    // the door is the gap in the wall along the room's south side
    const segs = w.host.walls.filter((q) => !q.prop && Math.abs(q.y + 48.5) < 0.05 && q.h <= 0.6 && q.x < a.x + a.w + 3 && q.x + q.w > a.x - 3).sort((p, q) => p.x - q.x);
    let gx0 = NaN, gx1 = NaN;
    for (let i = 0; i < segs.length - 1; i++) { const e = segs[i].x + segs[i].w, s = segs[i + 1].x; if (s - e > 1.5 && s - e < 6 && (e + s) / 2 > a.x - 1 && (e + s) / 2 < a.x + a.w + 1 && !segs[i].gate && !segs[i + 1].gate) { gx0 = e; gx1 = s; } else if (segs[i + 1].gate && (segs[i + 1].x + segs[i + 1].w / 2) > a.x && (segs[i + 1].x + segs[i + 1].w / 2) < a.x + a.w) { gx0 = segs[i + 1].x; gx1 = gx0 + segs[i + 1].w; } }
    if (isNaN(gx0)) continue;
    for (const px of [gx0 - 0.12, gx1]) A.box(px, 0, z - 0.14, px + 0.12, 2.5, z + 0.14, col(0x3a3f46, 0x565c66));
    const r = K.hd(gx1 - gx0, 0.42, (c, ww, h) => art2.plate(c, ww, h, name, bg, fg));
    A.box(gx0 - 0.12, 2.2, z - 0.1, gx1 + 0.12, 2.66, z + 0.1, { all: col(0x3a3f46), s: r, top: col(0x565c66) });
    w.pool(K.p, (gx0 + gx1) / 2, z + 1.4, 1.7, 1.5, 0xffe6b0, 0.14);
  }
  // Noticeboards and extinguishers along the rooms' side of the corridor would face away; what faces you is the floor line.
  patch(w.spec, -39, -43.2, 78, 0.5, (c, x0, _y0, x1) => { c.fillStyle = "rgba(217,185,42,0.75)"; for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) c.fillRect(x, Math.round(-43.05 * PXM), 30, 4); });
  void U; void v;
}

// ---------------------------------------------------------------------------------------------
function concourse(K: Kit) {
  const { w, A, U } = K, v = w.host.venue, m = w.mirror;
  // The back of the south stand is the concourse's long wall.
  const segs = w.host.walls.filter((q) => !q.prop && !q.gate && Math.abs(q.y - 38) < 0.05 && q.h < 1 && q.w > 3 && Math.abs(q.x) <= 40.1 && Math.abs(q.x + q.w) <= 40.1).sort((p, q) => p.x - q.x);
  const bar = w.host.areas.find((q) => q.id === "bar_s"), gents = w.host.areas.find((q) => q.id === "toilet_s"), snack = v.spots.kioskCounter;
  const zf = 38.63, Hh = 3.4;
  segs.forEach((s, i) => {
    const x0 = s.x, x1 = s.x + s.w, hasG = !!gents && gents.x < x1 && gents.x + gents.w > x0;
    const r = K.pm(x1 - x0, Hh, (c, ww, h) => {
      const X = (x: number) => Math.round((x - x0) * PXM);
      art2.roomWall(c, ww, h, { base: 0xd4cdb8, dado: art2.BLUE, band: art2.RED, seed: 81 + i, dadoH: 1.3 });
      if (hasG && gents) art2.tiles(c, X(Math.max(x0, gents.x + 0.4)), Math.round(h - 2.6 * PXM), X(Math.min(x1, gents.x + gents.w)) - X(Math.max(x0, gents.x + 0.4)), Math.round(2.6 * PXM), 15, 0x2f6ab0);
    });
    A.quad([x0, 0, zf], [x1, 0, zf], [x1, Hh, zf], [x0, Hh, zf], r);
    // which way the gangway is, at each end of each piece of wall
    const codeL = i, plateAt = (x: number, arrow: "l" | "r", n: number) => K.onS(K.hd(1.5, 0.5, (c, ww, h) => art2.plate(c, ww, h, `BLOCK S${n}`, art2.RED, 0xf4f4f4, { arrow })), x, 2.3, 1.5, 0.5, zf + 0.02);
    if (i > 0) plateAt(x0 + 1.0, "l", Math.min(3, Math.max(1, codeL)));
    if (i < segs.length - 1) plateAt(x1 - 1.0, "r", Math.min(3, Math.max(1, codeL + 1)));
    // posters and wall furniture between
    const r2 = rng(90 + i), cx = (x0 + x1) / 2;
    const things: [number, () => void][] = [
      [cx - 3.6, () => K.onS(K.hd(0.9, 1.25, (c, ww, h) => art2.wanted(c, ww, h, i)), cx - 3.6, 1.45, 0.9, 1.25, zf + 0.02)],
      [cx + 3.4, () => K.onS(K.at.paint(26, 26, (c, ww, h) => art2.clutter(c, ww, h, "hose"), false), cx + 3.4, 1.45, 0.8, 0.8, zf + 0.02)],
      [cx + 5.0, () => K.onS(K.hd(0.8, 1.1, (c, ww, h) => art2.poster(c, ww, h, 1 + i * 2)), cx + 5.0, 1.5, 0.8, 1.1, zf + 0.02)],
      [cx - 5.4, () => K.onS(K.hd(0.8, 1.1, (c, ww, h) => art2.poster(c, ww, h, 3 + i)), cx - 5.4, 1.5, 0.8, 1.1, zf + 0.02)],
    ];
    for (const [x, f] of things) if (x > x0 + 2 && x < x1 - 2 && !(hasG && gents && x > gents.x && x < gents.x + gents.w)) f();
    for (const lx of [x0 + (x1 - x0) * 0.25, x0 + (x1 - x0) * 0.75]) K.lampS(lx, 2.95, zf, 0xfff0c8, 2.6);
    void r2;
  });
  // What the bar sells, on the wall across from it; and the snacks.
  if (bar) K.onS(K.hd(3.2, 1.6, (c, ww, h) => art2.menuBoard(c, ww, h, "BAR", [["LAGER", "£7.80"], ["LAGER (WARM)", "£7.80"], ["LAGER (FLAT)", "£7.80"], ["WINE (A WINE)", "£9"], ["WATER", "£4.50"], ["TAP WATER", "NO"]], 0x16181c, 0xf2c94c)), bar.x + bar.w / 2, 1.5, 3.2, 1.6, zf + 0.03);
  K.onS(K.hd(3.2, 1.6, (c, ww, h) => art2.menuBoard(c, ww, h, "HOT FOOD", [["PIE", "£6"], ["PIE (HOT)", "£9"], ["MEAT? SLICE", "£5.50"], ["BOVRIL", "£4"], ["CHIPS, SOME", "£5"], ["REGRET", "FREE"]], 0x5a1a1e, 0xf2e6c0)), snack.x, 1.5, 3.2, 1.6, zf + 0.03);
  if (gents) {
    K.onS(K.hd(1.6, 0.5, (c, ww, h) => art2.plate(c, ww, h, "GENTS", 0x2f6ab0, 0xf4f4f4, { sub: "TROUGH · NO EYE CONTACT" })), gents.x + gents.w / 2, 2.75, 1.6, 0.5, zf + 0.03);
    K.onS(K.at.paint(22, 40, (c, ww, h) => art2.clutter(c, ww, h, "vend"), false), gents.x + gents.w - 0.5 - (m ? gents.w - 1.6 : 0), 1.0, 0.56, 1.0, zf + 0.03);
  }
  // The counters. You are behind them: shelves under, the staff this side, the punters beyond.
  for (const wl of w.host.walls) {
    if (wl.prop || wl.gate || wl.h3 !== 1.1 || wl.w <= 5 || wl.y > 50) continue;
    const x0 = wl.x, x1 = wl.x + wl.w, z0 = wl.y, z1 = wl.y + wl.h, isBar = !!bar && x0 >= bar.x - 0.1 && x1 <= bar.x + bar.w + 0.1, W = x1 - x0;
    const rUnder = K.pm(W, 1.02, (c, ww, h) => { art2.shelves(c, ww, h, isBar ? 31 : 33, isBar ? "glasses" : "tins"); if (isBar) for (let x = 20; x < ww - 40; x += 96) { rect(c, x, 4, 34, h - 8, H(0x8f959c)); rect(c, x + 2, 6, 30, 8, H(0xc9cdd2)); rect(c, x + 6, h - 16, 22, 10, H(0x6f757c)); } });
    A.box(x0, 0, z0, x1, 1.02, z1, { all: col(isBar ? 0x5a3a26 : 0x4a3d60, isBar ? 0x7a5236 : 0x6a5d80), s: rUnder, top: K.pm(W, z1 - z0, (c, ww, h) => (isBar ? art2.barTop(c, ww, h, 3) : counterTop(c, ww, h))) });
    w.spec.ao.push([x0, z0, x1, z1, 1.1]);
    if (isBar) {
      for (let x = x0 + 1.6; x < x1 - 1; x += 3.1) pumps(K, x, 1.02, z0 + 0.22, 3);
      for (let x = x0 + 0.5; x < x1 - 0.4; x += 3.1) { for (let k = 0; k < 3; k++) A.cyl(x + k * 0.11, 1.02, 1.2 + (k % 2) * 0.1, z1 - 0.2, 0.045, 5, col(0xe8f0f4, 0xffffff), col(0xf4f8fa)); }
      A.box(x1 - 1.2, 1.02, z1 - 0.5, x1 - 0.7, 1.32, z1 - 0.15, { all: col(0x23252b, 0x3a3d44), top: col(0x15171a) }); // the till
    } else {
      // a hot cabinet with what is left in it, sauce, a stack of trays
      const hx = (x0 + x1) / 2 - 1.2;
      A.box(hx, 1.02, z0 + 0.1, hx + 2.4, 1.14, z1 - 0.1, col(0x8f959c, 0xc9cdd2));
      U.box(hx + 0.04, 1.14, z0 + 0.14, hx + 2.36, 1.5, z1 - 0.14, { all: { r: K.pm(2.3, 0.36, pieCabinet) }, top: col(0xffe2a0) }); A.box(hx, 1.5, z0 + 0.1, hx + 2.4, 1.56, z1 - 0.1, col(0x8f959c, 0xc9cdd2));
      w.halo(K.p, [hx + 1.2, 1.35, z1], 3.2, 0xffc060, 0.25);
      for (let k = 0; k < 3; k++) A.cyl(x0 + 0.6 + k * 0.22, 1.02, 1.3, z1 - 0.3, 0.06, 5, col([0xc8281e, 0xf2c81e, 0x5a3418][k]), col(0xf4f1ea), 0.04);
      A.box(x1 - 1.3, 1.02, z0 + 0.15, x1 - 0.6, 1.2, z1 - 0.15, col(0x9aa0a6, 0xc9cdd2));
    }
    // a board over it on posts, lettered both sides
    const title = isBar ? "BAR" : "PIES · HOT-ISH", r = K.hd(Math.min(W, 6), 0.6, (c, ww, h) => art2.plate(c, ww, h, title, isBar ? art.GREEN_D : 0x5a1a1e, 0xf2e6c0, { border: art.GOLD }));
    const bw = Math.min(W, 6), bx = (x0 + x1) / 2;
    A.box(bx - bw / 2, 2.7, z0 + 0.3, bx + bw / 2, 3.3, z0 + 0.42, { all: col(0x15171a), s: r });
    for (const px of [x0 + 0.05, x1 - 0.17]) A.box(px, 1.02, z0 + 0.3, px + 0.12, 3.0, z0 + 0.42, col(0x3a3f46, 0x565c66));
    A.bar([x0 + 0.1, 3.0, z0 + 0.36], [x1 - 0.1, 3.0, z0 + 0.36], 0.08, col(0x3a3f46));
    for (let x = x0 + 1.2; x < x1 - 0.5; x += 2.6) w.pool(K.p, x, z1 + 0.6, 1.4, 1.1, 0xffe2a8, 0.14);
  }
  // The away end's wall: who it is for.
  for (const wl of w.host.walls) {
    if (wl.prop || wl.gate || wl.w > 1 || wl.h < 10 || Math.abs(wl.x - 50) > 0.05 && Math.abs(wl.x + 50.6) > 0.05 || Math.abs(wl.y) > 27.1) continue;
    const xf = wl.x + wl.w + 0.02, zc = wl.y + wl.h / 2, east = wl.x > 0, away = east !== m;
    K.wallE(xf, wl.y, wl.y + wl.h, 3.3, (c, ww, h) => art2.roomWall(c, ww, h, { base: 0xd4cdb8, dado: away ? 0x8a1a22 : art2.BLUE, band: 0xf4f4f4, seed: 95 + Math.round(wl.y), dadoH: 1.3 }));
    if (!east) continue; // only the east side's walls face you
    K.onE(K.hd(4.2, 0.6, (c, ww, h) => art2.plate(c, ww, h, away ? "VISITING SUPPORTERS" : "WEST END", away ? 0x8a1a22 : art2.BLUE, 0xf4f4f4, { sub: away ? "YOU ARE A LONG WAY FROM HOME" : "SIT DOWN IF YOU LOVE SITTING DOWN" })), xf + 0.02, zc, 2.2, 4.2, 0.6);
    K.onE(K.hd(0.9, 1.25, (c, ww, h) => art2.wanted(c, ww, h, 7)), xf + 0.02, zc + 4.5, 1.4, 0.9, 1.25);
    K.onE(K.hd(0.8, 1.1, (c, ww, h) => art2.poster(c, ww, h, 5)), xf + 0.02, zc - 4.5, 1.45, 0.8, 1.1);
    K.lampE(xf, 2.95, zc + 7, 0xfff0c8, 2.4); K.lampE(xf, 2.95, zc - 7, 0xfff0c8, 2.4);
  }
}
function counterTop(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0xc9cdd2)); rect(c, 0, 0, w, 1, "#f4f8fa"); rect(c, 0, h - 2, w, 2, H(0x8f959c));
  const r = rng(5); for (let k = 0; k < w / 14; k++) { rect(c, r.int(w), 3 + r.int(h - 6), 5 + r.int(6), 4, H(r.pick([0xf4f1ea, 0xe8dcc0, 0xd8322a, 0xf2c81e]))); }
}
function pieCabinet(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0xffd98a)); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,240,200,0.8)"); g.addColorStop(1, "rgba(232,148,58,0.5)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let x = 4; x < w - 8; x += 9) { if ((x * 7) % 5 === 0) continue; rect(c, x, h - 6, 7, 4, H(0xb8783a)); rect(c, x + 1, h - 7, 5, 1, H(0xd89a52)); }
  rect(c, 0, Math.round(h / 2), w, 1, "rgba(120,80,30,0.6)"); for (let x = 6; x < w - 8; x += 13) { rect(c, x, Math.round(h / 2) - 5, 8, 4, H(0xc88a4a)); }
  for (let x = 0; x < w; x += 24) rect(c, x, 0, 1, h, "rgba(60,40,20,0.5)");
}
/** Hand pumps on a bar: brass, a black handle, a clip with a name on. */
function pumps(K: Kit, x: number, y: number, z: number, n: number) {
  const { A } = K;
  A.box(x - 0.08, y, z - 0.1, x + n * 0.24, y + 0.03, z + 0.14, col(0x8f959c, 0xc9cdd2)); // drip tray
  for (let k = 0; k < n; k++) {
    const px = x + k * 0.24 + 0.04;
    A.cyl(px, y, y + 0.22, z, 0.04, 5, col(0xb8923a, 0xe9cf7a), col(0xe9cf7a));
    A.bar([px, y + 0.2, z], [px, y + 0.52, z - 0.06], 0.045, col(k % 2 ? 0x15171a : 0x5a1a1e, 0x3a3d44));
    A.box(px - 0.06, y + 0.1, z + 0.045, px + 0.06, y + 0.24, z + 0.06, col([0xb01030, 0x1f5a3d, 0xf2c81e, 0x1b2a6b][k % 4]));
  }
}

// ---------------------------------------------------------------------------------------------
/** The pub: the bar itself, the back bar where it belongs (behind the bar), tiles in the gents' corner, a long papered wall. */
function pubInside(K: Kit, b: BuildingSpec) {
  const { w, A, U } = K, v = w.host.venue, { x0, y0: z0, x1, y1: z1 } = b.rect, zB = z0 + 0.55, im = w.host.image("w-wall-pub");
  const barW = w.host.walls.find((q) => !q.prop && q.h3 === 1.1 && q.w > 5 && q.y > 60 && q.x > x0 && q.x < x1), toilet = w.host.areas.find((q) => q.id === "pub_toilet");
  const bc = barW ? barW.x + barW.w / 2 : (x0 + x1) / 2, PW = im ? im.width / PXM : 18, px0 = Math.min(x1 - 0.5 - PW, Math.max(x0 + 0.5, bc - PW * 0.49));
  K.wallS(x0 + 0.5, x1 - 0.5, zB, 3, (c, ww, h) => {
    const X = (x: number) => Math.round((x - x0 - 0.5) * PXM);
    art2.wallpaper(c, 0, 0, ww, h, 0x6a2a2e, 5); art2.panelling(c, 0, Math.round(h - 1.1 * PXM), ww, Math.round(1.1 * PXM), 0x4a2e1e, 7);
    if (toilet) art2.tiles(c, X(toilet.x), 0, X(toilet.x + toilet.w) - X(toilet.x), h, 21, 0x1f5a3d);
    if (im) c.drawImage(im as CanvasImageSource, X(px0), 0);
  });
  // The west wall: tiles as far as the gents goes, then paper over panelling, hung with what pubs hang.
  const tz = toilet ? toilet.y + toilet.h : zB, xw = x0 + 0.5;
  K.wallE(xw, zB, z1 - 0.5, 3, (c, ww, h) => {
    const Z = (z: number) => Math.round((z1 - 0.5 - z) * PXM);
    art2.wallpaper(c, 0, 0, ww, h, 0x6a2a2e, 9); art2.panelling(c, 0, Math.round(h - 1.1 * PXM), ww, Math.round(1.1 * PXM), 0x4a2e1e, 11);
    if (toilet) art2.tiles(c, Z(tz), 0, ww - Z(tz), h, 23, 0x1f5a3d);
  }, 0.02);
  const hangs: [number, number, number, number, Region, boolean?][] = [
    [tz + 2.0, 1.4, 1.6, 1.0, K.pm(1.6, 1.0, (c, ww, h) => { rect(c, 0, 0, ww, h, H(art.GOLD)); rect(c, 2, 2, ww - 4, h - 4, H(0x9db4c4)); c.fillStyle = "rgba(230,240,246,0.5)"; c.beginPath(); c.moveTo(2, h * 0.8); c.lineTo(ww * 0.5, 2); c.lineTo(ww * 0.7, 2); c.lineTo(2, h - 2); c.fill(); pixText(c, "HOLT'S", ww / 2, h * 0.5, 9, H(0x7a2a1c), { align: "center", font: art2.SERIF, weight: 700 }); tiny(c, "FINE ALES", ww / 2, Math.round(h * 0.62), H(0x7a2a1c), 1, "center"); })],
    [tz + 4.6, 1.35, 0.9, 1.2, K.hd(0.9, 1.2, (c, ww, h) => art2.poster(c, ww, h, 1))],
    [tz + 6.3, 1.3, 1.2, 0.8, K.hd(1.2, 0.8, (c, ww, h) => art2.menuBoard(c, ww, h, "QUIZ NITE", [["TUES 8PM", "£1"], ["NO PHONES", "KEV"], ["1ST PRIZE", "MEAT"]], 0x1e2422, 0xf7a8b0))],
    [tz + 8.4, 1.4, 1.0, 1.3, K.hd(1.0, 1.3, (c, ww, h) => art2.wanted(c, ww, h, 5))],
    [tz + 10.2, 1.3, 1.4, 0.9, K.pm(1.4, 0.9, (c, ww, h) => art2.coatHooks(c, ww, h, 3), false)],
  ];
  for (const [zc, y, wm, hm, r] of hangs) if (zc < z1 - 1.5) K.onE(r, xw + 0.025, zc, y, wm, hm);
  K.onE(K.hd(1.0, 0.22, (c, ww, h) => art2.plate(c, ww, h, "BARRED · SEE ALSO: FRONT DOOR", 0xf1efe6, 0xb01020)), xw + 0.03, tz + 8.4, 1.14, 1.0, 0.22);
  for (const zc of [tz + 3.3, tz + 9.3]) if (zc < z1 - 1) K.lampE(xw, 2.2, zc, 0xffc878, 2.4);
  // The bar.
  if (barW) {
    const bx0 = barW.x, bx1 = barW.x + barW.w, bz0 = barW.y, bz1 = barW.y + barW.h, W = bx1 - bx0;
    A.box(bx0, 0, bz0, bx1, 1.08, bz1, { all: col(0x4a2e1e, 0x6a4630), s: K.pm(W, 1.08, (c, ww, h) => art2.barFront(c, ww, h, 13)), top: K.pm(W, bz1 - bz0, (c, ww, h) => art2.barTop(c, ww, h, 15)) });
    A.box(bx0 - 0.05, 1.08, bz1 - 0.06, bx1 + 0.05, 1.12, bz1 + 0.06, col(art.GOLD, 0xf6dc8a));
    for (const f of v.furniture.filter((q) => q.key === "pumps" && q.room === "pub")) { pumps(K, f.x - 0.5, 1.08, bz0 + 0.3, 4); w.replace("pumps", f.x, f.y); }
    // glasses drying, a till, bar snacks on a card, a charity jar
    for (let k = 0; k < 7; k++) A.cyl(bx0 + 0.5 + (k % 4) * 0.13, 1.08, 1.24, bz0 + 0.25 + Math.floor(k / 4) * 0.14, 0.05, 5, col(0xdfe8ec, 0xffffff), col(0xf4f8fa));
    A.box(bx1 - 1.3, 1.08, bz0 + 0.15, bx1 - 0.75, 1.42, bz0 + 0.6, { all: col(0x23252b, 0x3a3d44), s: K.pm(0.55, 0.34, (c, ww, h) => { rect(c, 0, 0, ww, h, H(0x23252b)); rect(c, 2, 2, ww - 4, 4, H(0x7ad07a)); for (let k = 0; k < 8; k++) rect(c, 3 + (k % 4) * 3, 7 + Math.floor(k / 4) * 2, 2, 1, H(0xc9cdd2)); }), top: col(0x15171a) });
    A.cyl((bx0 + bx1) / 2 + 0.4, 1.08, 1.3, bz1 - 0.3, 0.07, 6, col(0xdfe8ec, 0xf4f8fa), col(0xc8281e));
    A.box((bx0 + bx1) / 2 - 1.0, 1.08, bz0 + 0.2, (bx0 + bx1) / 2 - 0.75, 1.5, bz0 + 0.24, { all: col(0xf1efe6), s: K.pm(0.25, 0.42, (c, ww, h) => { rect(c, 0, 0, ww, h, "#f1efe6"); for (let k = 0; k < 6; k++) rect(c, 1 + (k % 2) * 4, 1 + Math.floor(k / 2) * 4, 3, 3, H([0xc8281e, 0xf2c81e, 0x2f6ab0, 0x3a7a4a, 0xe2661c, 0x8a3a22][k])); }) });
    // stools along it
    for (let x = bx0 + 1.2; x < bx1 - 0.6; x += 2.3) { A.cyl(x, 0.66, 0.74, bz1 + 0.62, 0.19, 7, col(0x6a1a22, 0x8a2a32), col(0x8a2a32)); A.cyl(x, 0, 0.66, bz1 + 0.62, 0.04, 4, col(0x8f959c, 0xc9cdd2)); A.cyl(x, 0, 0.04, bz1 + 0.62, 0.17, 6, col(0x6f757c), col(0x8f959c)); }
    w.spec.ao.push([bx0, bz0, bx1, bz1, 1.1]);
    for (let x = bx0 + 1.5; x < bx1; x += 3) { K.pool(x, bz1 + 0.9, 1.7, 1.3, 0xffc878, 0.16); K.pool(x, bz0 - 1.0, 1.7, 1.1, 0xffd9a0, 0.12); }
  }
  // Warm light, and the carpet (the boards show round the bar and by the door).
  for (const [fx, fz] of [[0.3, 0.7], [0.62, 0.72], [0.85, 0.45]]) K.pool(x0 + (x1 - x0) * fx, z0 + (z1 - z0) * fz, 3.6, 2.8, 0xffc878, 0.11);
  const cz0 = (barW ? barW.y + barW.h : z0 + 6) + 1.6, cx0 = (toilet ? x0 + 0.5 : x0 + 0.5), cx1 = x1 - 0.5;
  patch(w.spec, cx0, cz0, cx1 - cx0, z1 - 0.6 - cz0, (c, X0, Y0, X1, Y1) => carpet(c, X0, Y0, X1, Y1, 0x7a2430, 0xb8923a, 0x3a1218, 3));
  void U;
}
/** Carpet on the world's own grid (so tiles meet): a diamond repeat, worn pale in tracks, stained. */
export function carpet(c: CanvasRenderingContext2D, X0: number, Y0: number, X1: number, Y1: number, a: number, b: number, d: number, seed: number) {
  c.fillStyle = H(a); c.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  const s = 16;
  for (let j = Math.floor(Y0 / s) - 1; j * s < Y1; j++) for (let i = Math.floor(X0 / s) - 1; i * s < X1; i++) {
    const ox = i * s + (j & 1 ? s / 2 : 0), oy = j * s;
    c.fillStyle = H(d); c.beginPath(); c.moveTo(ox + 8, oy + 1); c.lineTo(ox + 15, oy + 8); c.lineTo(ox + 8, oy + 15); c.lineTo(ox + 1, oy + 8); c.closePath(); c.fill();
    c.fillStyle = H(b); c.fillRect(ox + 7, oy + 6, 2, 4); c.fillRect(ox + 6, oy + 7, 4, 2);
    if (((i * 7 + j * 13 + seed) & 7) === 0) { c.fillStyle = "rgba(20,10,8,0.3)"; c.beginPath(); c.ellipse(ox + 5, oy + 9, 9, 5, (i + j) * 0.7, 0, 7); c.fill(); }
    if (((i * 5 + j * 11 + seed) % 23) === 0) { c.fillStyle = "rgba(220,200,170,0.12)"; c.beginPath(); c.ellipse(ox + 3, oy + 4, 14, 8, (i - j) * 0.4, 0, 7); c.fill(); }
  }
}

/** The hotel lobby: lifts in the west wall, a carpet you can hear, a rug under the sofas, brass. */
function hotelInside(K: Kit, b: BuildingSpec) {
  const { w, A, U } = K, v = w.host.venue, { x0, y0: z0, x1, y1: z1 } = b.rect, zB = z0 + 0.55, im = w.host.image("w-wall-hotel"), xw = x0 + 0.5, m = w.mirror;
  K.wallS(x0 + 0.5, x1, zB, 3.2, (c, ww, h) => {
    rect(c, 0, 0, ww, h, H(0xcfc4a8)); art2.panelling(c, 0, Math.round(h - 1.0 * PXM), ww, Math.round(1.0 * PXM), 0x5a3a26, 3);
    if (im) c.drawImage(im as CanvasImageSource, 0, 0, im.width, im.height, ww - Math.round((im.width / im.height) * (3 * PXM)), h - 3 * PXM, Math.round((im.width / im.height) * (3 * PXM)), 3 * PXM);
    rect(c, 0, 0, ww, 6, H(0xe6dcc0)); rect(c, 0, 6, ww, 1, H(0x8a7a5a));
  });
  // The west wall, twenty-six metres of it: two lifts, bad art, wall lights, the welcome.
  const L = z1 - 0.5 - zB, lifts = [zB + L * 0.3, zB + L * 0.3 + 2.4], opp = OPP_NAME[v.opp] ?? "VISITORS";
  K.wallE(xw, zB, z1 - 0.5, 3.2, (c, ww, h) => {
    const Z = (z: number) => Math.round((z1 - 0.5 - z) * PXM), Y = (mm: number) => Math.round(h - mm * PXM);
    stripes(c, ww, h, 0xd9cdb0, 0xcfc2a2); art2.panelling(c, 0, Y(1.0), ww, h - Y(1.0), 0x5a3a26, 5);
    rect(c, 0, 0, ww, 6, H(0xe6dcc0)); rect(c, 0, 6, ww, 1, H(0x8a7a5a));
    for (const lz of lifts) { // lift doors: brushed steel, a brass surround, the floor above in lights
      const lx = Z(lz + 0.85), lw = Math.round(1.7 * PXM);
      rect(c, lx - 4, Y(2.45), lw + 8, Y(0) - Y(2.45), H(0xb8923a)); rect(c, lx - 4, Y(2.45), lw + 8, 2, H(0xe9cf7a));
      rect(c, lx, Y(2.3), lw, Y(0) - Y(2.3), H(0x9aa0a6)); for (let x = lx; x < lx + lw; x += 2) rect(c, x, Y(2.3), 1, Y(0) - Y(2.3), "rgba(255,255,255,0.14)"); rect(c, lx + lw / 2 - 1, Y(2.3), 2, Y(0) - Y(2.3), H(0x3a3d44));
      rect(c, lx + lw / 2 - 12, Y(2.4) - 9, 24, 8, H(0x15171a)); tiny(c, lz === lifts[0] ? "3" : "--", lx + lw / 2, Y(2.4) - 8, H(0xff5a3a), 1, "center");
      rect(c, lx + lw + 7, Y(1.25), 5, 9, H(0xe9cf7a)); rect(c, lx + lw + 8, Y(1.25) + 2, 3, 2, H(0xff5a3a));
    }
  }, 0.02);
  K.onE(K.hd(1.5, 0.42, (c, ww, h) => art2.plate(c, ww, h, "LIFT OUT OF ORDER", 0xf2c81e, 0x15171a, { sub: "PLEASE USE STAIRS (ALSO OUT OF ORDER)" })), xw + 0.03, lifts[1], 1.25, 1.5, 0.42);
  const art3 = (k: number) => K.pm(1.5, 1.0, (c, ww, h) => badArt(c, ww, h, k));
  const hangs: [number, number, number, number, Region][] = [
    [zB + L * 0.08, 1.45, 1.5, 1.0, art3(0)], [zB + L * 0.55, 1.45, 1.5, 1.0, art3(1)], [zB + L * 0.9, 1.45, 1.5, 1.0, art3(2)],
    [zB + L * 0.7, 1.3, 4.4, 1.0, K.hd(4.4, 1.0, (c, ww, h) => { rect(c, 0, 0, ww, h, H(0xf4f1ea)); rect(c, 0, 0, ww, 5, H(art2.RED)); rect(c, 0, h - 5, ww, 5, H(art2.RED)); pixText(c, `WELCOME ${opp}`, ww / 2, 32, 20, H(art2.BLUE), { align: "center", maxW: ww - 16 }); pixText(c, "PLEASE ENJOY YOUR STAY. PLEASE DON'T WIN.", ww / 2, 51, 9, H(0x15171a), { align: "center", maxW: ww - 16, weight: 700 }); })],
    [zB + L * 0.17, 0.25, 0.7, 1.5, K.pm(0.7, 1.5, (c, ww, h) => { c.clearRect(0, 0, ww, h); rect(c, 2, 0, ww - 4, h, H(0x5a3a26)); for (let j = 0; j < 5; j++) for (let i = 0; i < 2; i++) { rect(c, 4 + i * 8, 3 + j * 9, 7, 8, H([0x2f6ab0, 0xf2c81e, 0xd8322a, 0x3a7a4a, 0xf4f1ea][(i + j) % 5])); rect(c, 5 + i * 8, 5 + j * 9, 5, 1, "rgba(255,255,255,0.6)"); } }, false)],
  ];
  for (const [zc, y, wm, hm, r] of hangs) K.onE(r, xw + 0.025, zc, y, wm, hm);
  K.onE(K.hd(0.9, 0.22, (c, ww, h) => art2.plate(c, ww, h, "THINGS TO DO: LEAVE", 0xf1efe6, 0x15171a)), xw + 0.03, zB + L * 0.17, 1.8, 0.9, 0.22);
  for (const t of [0.02, 0.24, 0.47, 0.63, 0.8, 0.97]) { const lz = zB + L * t; A.box(xw, 1.95, lz - 0.06, xw + 0.12, 2.0, lz + 0.06, col(art.GOLD)); U.box(xw + 0.04, 2.0, lz - 0.1, xw + 0.2, 2.26, lz + 0.1, col(0xffe2a0)); w.halo(K.p, [xw + 0.4, 2.15, lz], 1.9, 0xffc060, 0.42); w.pool(K.p, xw + 1.8, lz + 0.4, 2.2, 1.6, 0xffc878, 0.13); }
  // Pillars with a brass band, a rope barrier to reception, a bell.
  const desk = v.furniture.find((f) => f.key === "reception" && f.room === "hotel");
  for (const [fx, fz] of [[0.36, 0.3], [0.36, 0.72], [0.7, 0.72]]) {
    const px = x0 + (x1 - x0) * (m ? 1 - fx : fx), pz = z0 + (z1 - z0) * fz;
    A.box(px - 0.3, 0, pz - 0.3, px + 0.3, 3.2, pz + 0.3, { all: { r: w.sw.marble, uv: [0, 0, 0.3, 1] }, top: col(0xe6dcc0) }); A.box(px - 0.33, 1.0, pz - 0.33, px + 0.33, 1.08, pz + 0.33, col(art.GOLD, 0xf6dc8a)); A.box(px - 0.36, 0, pz - 0.36, px + 0.36, 0.2, pz + 0.36, col(0x3a2a1c, 0x5a4028));
    w.spec.ao.push([px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 3]);
  }
  if (desk) {
    const s = desk.x > (x0 + x1) / 2 ? -1 : 1;
    for (let k = 0; k < 3; k++) { const px = desk.x + s * -3.0, pz = desk.y - 1.6 + k * 1.5; A.cyl(px, 0, 0.95, pz, 0.035, 5, col(0xb8923a, 0xf6dc8a), col(0xf6dc8a)); A.cyl(px, 0, 0.05, pz, 0.16, 6, col(0xb8923a), col(0xe9cf7a)); if (k) A.bar([px, 0.88, pz - 1.5], [px, 0.88, pz], 0.05, col(0x8a1a22, 0xb01030)); }
    w.pool(K.p, desk.x, desk.y + 0.8, 3.0, 2.0, 0xffd9a0, 0.16);
  }
  // A chandelier's worth of light in the middle, and the door's daylight.
  for (const [fx, fz, r] of [[0.5, 0.5, 5], [0.5, 0.2, 4], [0.5, 0.8, 4]]) K.pool(x0 + (x1 - x0) * fx, z0 + (z1 - z0) * fz, r, r * 0.75, 0xffd9a0, 0.1);
  // The carpet, a marble apron inside the door, a rug under each sofa.
  patch(w.spec, x0 + 0.5, zB, x1 - x0 - 1, z1 - 0.5 - zB, (c, X0, Y0, X1, Y1) => hotelCarpet(c, X0, Y0, X1, Y1));
  const d = b.doors[0];
  if (d) w.spec.under.push({ x: d.x0 - 1.5, y: z1 - 3.4, w: d.x1 - d.x0 + 3, h: 2.9, kind: "whitetile", base: 0, wet: false, over: true });
  for (const f of v.furniture.filter((q) => q.key === "sofa" && q.room === "hotel")) patch(w.spec, f.x - 2.2, f.y - 1.7, 4.4, 3.3, (c, X0, Y0, X1, Y1) => { const rx = Math.round((f.x - 2.2) * PXM), ry = Math.round((f.y - 1.7) * PXM), rw = Math.round(4.4 * PXM), rh = Math.round(3.3 * PXM); c.fillStyle = H(0x2a3a5a); c.fillRect(rx, ry, rw, rh); c.strokeStyle = H(0xd8c070); c.lineWidth = 2; c.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8); c.strokeRect(rx + 9, ry + 9, rw - 18, rh - 18); c.fillStyle = H(0x8a1a22); c.fillRect(rx + 14, ry + 14, rw - 28, rh - 28); for (let k = 0; k < rw; k += 4) { c.fillStyle = H(0xd8c070); c.fillRect(rx + k, ry - 3, 2, 3); c.fillRect(rx + k, ry + rh, 2, 3); } void X0; void Y0; void X1; void Y1; });
}
const OPP_NAME: Record<string, string> = { POR: "PORTUGAL", BRA: "BRAZIL", ARG: "ARGENTINA", GER: "GERMANY", FRA: "FRANCE" };
function stripes(c: Ctx, w: number, h: number, a: number, b: number) { rect(c, 0, 0, w, h, H(a)); for (let x = 0; x < w; x += 12) rect(c, x, 0, 6, h, H(b)); const g = c.createLinearGradient(0, 0, 0, h * 0.4); g.addColorStop(0, "rgba(60,40,10,0.22)"); g.addColorStop(1, "rgba(60,40,10,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h * 0.4); }
function badArt(c: Ctx, w: number, h: number, k: number) {
  rect(c, 0, 0, w, h, H(0xb8923a)); rect(c, 2, 2, w - 4, h - 4, H(0x5a3a26)); rect(c, 4, 4, w - 8, h - 8, H([0x8fb0c8, 0xd8c8a0, 0x2a3a5a][k]));
  if (k === 0) { rect(c, 4, Math.round(h * 0.6), w - 8, Math.round(h * 0.4) - 4, H(0x4a7a4a)); rect(c, Math.round(w * 0.3), Math.round(h * 0.42), 10, 7, H(0x5a3a22)); rect(c, Math.round(w * 0.3) + 8, Math.round(h * 0.36), 4, 6, H(0x5a3a22)); rect(c, Math.round(w * 0.3) + 1, Math.round(h * 0.42) + 7, 2, 5, H(0x3a2418)); rect(c, Math.round(w * 0.3) + 7, Math.round(h * 0.42) + 7, 2, 5, H(0x3a2418)); } // a horse, from memory
  else if (k === 1) { for (let i = 0; i < 5; i++) { c.fillStyle = H([0xd8322a, 0xf2c81e, 0x2f6ab0, 0xe2661c, 0x3a7a4a][i]); c.beginPath(); c.arc(8 + i * 8, h / 2 + ((i * 7) % 9) - 4, 5, 0, 7); c.fill(); } rect(c, Math.round(w * 0.55), Math.round(h * 0.3), 8, 14, H(0x3a7a4a)); } // fruit
  else { c.fillStyle = "#f4f1ea"; c.beginPath(); c.arc(w * 0.7, h * 0.3, 5, 0, 7); c.fill(); rect(c, 4, Math.round(h * 0.7), w - 8, 2, H(0x8fb0c8)); rect(c, Math.round(w * 0.2), Math.round(h * 0.55), 14, 6, H(0x15171a)); rect(c, Math.round(w * 0.2) + 6, Math.round(h * 0.3), 1, 10, H(0x15171a)); } // a boat at night
}
function hotelCarpet(c: CanvasRenderingContext2D, X0: number, Y0: number, X1: number, Y1: number) {
  c.fillStyle = H(0x5a2a4a); c.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  const s = 24;
  for (let j = Math.floor(Y0 / s) - 1; j * s < Y1; j++) for (let i = Math.floor(X0 / s) - 1; i * s < X1; i++) {
    const ox = i * s, oy = j * s, k = (i + j) & 1;
    c.fillStyle = H(k ? 0x7a3a5a : 0x4a2040); c.beginPath(); c.arc(ox + 12, oy + 12, 9, 0, 7); c.fill();
    c.strokeStyle = H(0xd8a84a); c.lineWidth = 1; c.beginPath(); c.arc(ox + 12, oy + 12, 6, k ? 0 : Math.PI, k ? Math.PI * 1.5 : Math.PI * 2.5); c.stroke();
    c.fillStyle = H(0x2a8a7a); c.fillRect(ox + 11, oy + 11, 2, 2); c.fillStyle = H(0xd8a84a); c.fillRect(ox, oy, 2, 2);
    if (((i * 7 + j * 13) % 19) === 0) { c.fillStyle = "rgba(20,8,16,0.3)"; c.beginPath(); c.ellipse(ox + 9, oy + 14, 12, 6, i, 0, 7); c.fill(); }
  }
}

/** Cash Kings: goods to the ceiling on the west wall, a grille over the counter, the window from behind. */
function pawnInside(K: Kit, b: BuildingSpec) {
  const { w, A, U } = K, v = w.host.venue, { x0, y0: z0, x1, y1: z1 } = b.rect, zB = z0 + 0.55, im = w.host.image("w-wall-bookies"), xw = x0 + 0.5;
  K.wallS(x0 + 0.5, x1, zB, 3, (c, ww, h) => { art2.roomWall(c, ww, h, { base: 0xcfc6a8, seed: 3, block: false, grime: 0.7 }); if (im) c.drawImage(im as CanvasImageSource, ww - im.width, 0); });
  K.wallE(xw, zB, z1 - 0.5, 3, (c, ww, h) => {
    art2.roomWall(c, ww, h, { base: 0xcfc6a8, seed: 5, block: false, grime: 0.7 });
  }, 0.02);
  const L = z1 - 0.5 - zB;
  K.onE(K.pm(L - 0.8, 2.5, (c, ww, h) => art2.shelves(c, ww, h, 44, "pawn")), xw + 0.03, zB + L / 2, 0.3, L - 0.8, 2.5);
  K.onE(K.hd(3.0, 0.4, (c, ww, h) => art2.plate(c, ww, h, "ALL ITEMS SOLD AS SEEN", 0xf2c81e, 0x15171a, { sub: "SOME SEEN TOO MUCH" })), xw + 0.05, zB + L / 2, 2.55, 3.0, 0.4);
  // 3D on the shelf front: a few things that stick out
  for (let k = 0; k < 5; k++) { const zc = zB + 1.2 + k * ((L - 2.4) / 4), y = [0.35, 1.0, 1.55, 0.4, 1.05][k]; A.box(xw + 0.03, y, zc - 0.3, xw + 0.38, y + [0.45, 0.3, 0.4, 0.5, 0.25][k], zc + 0.3, { all: col([0x16181c, 0xd8d8d8, 0xe0b020, 0x16181c, 0xc8382a][k]), e: k % 3 === 0 ? { r: K.pm(0.6, 0.45, (c, ww, h) => art2.telly(c, ww, h, k === 0 ? 1 : 2)) } : col([0x16181c, 0xb8b8b8, 0xc09a18, 0x16181c, 0xa82a20][k]) }); }
  // The counter's grille: he is behind bars, in the nicest way.
  const ct = v.furniture.find((f) => f.key === "pawncounter" && f.room === "bookies");
  if (ct) {
    const gx0 = ct.x - 1.9, gx1 = ct.x + 1.9, gz = ct.y - 0.62, rG = K.at.paint(Math.round(1.3 * PXM), Math.round(1.25 * PXM), art2.grille, false);
    for (const px of [gx0, gx1 - 0.1]) A.box(px, 0, gz - 0.05, px + 0.1, 2.6, gz + 0.05, col(0x3a3d44, 0x5c6168));
    A.box(gx0, 2.5, gz - 0.05, gx1, 2.6, gz + 0.05, col(0x3a3d44, 0x5c6168));
    for (const [a0, a1] of [[gx0 + 0.1, ct.x - 0.5], [ct.x + 0.5, gx1 - 0.1]]) A.quad([a0, 1.25, gz], [a1, 1.25, gz], [a1, 2.5, gz], [a0, 2.5, gz], { r: rG }, { double: true });
    A.quad([ct.x - 0.5, 1.95, gz], [ct.x + 0.5, 1.95, gz], [ct.x + 0.5, 2.5, gz], [ct.x - 0.5, 2.5, gz], { r: rG, uv: [0, 0, 0.77, 0.44] }, { double: true });
    K.onS(K.hd(1.0, 0.3, (c, ww, h) => art2.plate(c, ww, h, "NO REFUNDS", 0xd8322a, 0xffffff, { sub: "NO, REALLY" })), ct.x, 2.6, 1.0, 0.3, gz + 0.06);
    w.pool(K.p, ct.x, ct.y + 1.0, 2.6, 1.6, 0xe8f0e0, 0.14);
  }
  // The window, from behind: low plinths either side of the door with what faces the street.
  const d = b.doors[0], dx0 = d ? d.x0 : (x0 + x1) / 2 - 2, dx1 = d ? d.x1 : (x0 + x1) / 2 + 2, wz0 = z1 - 1.45, wz1 = z1 - 0.55;
  for (const [a0, a1] of [[x0 + 0.9, dx0 - 0.4], [dx1 + 0.4, x1 - 0.6]]) {
    if (a1 - a0 < 1.5) continue;
    A.box(a0, 0, wz0, a1, 0.55, wz1, { all: col(0x23335c, 0x3a4f86), top: col(0x2a3c6c) });
    const r = rng(Math.round(a0 * 10));
    for (let x = a0 + 0.2; x < a1 - 0.5; x += 0.55 + r() * 0.4) {
      const q = r(), ww = 0.3 + r() * 0.3, hh = 0.2 + r() * 0.5, cc = r.pick([0x16181c, 0xe0b020, 0xc8382a, 0x3a7a4a, 0xd8d8d8, 0x2f6ab0]);
      if (q < 0.3) { A.box(x, 0.55, wz0 + 0.2, x + 0.6, 0.95, wz0 + 0.3, col(0x16181c)); A.quad([x + 0.03, 0.6, wz0 + 0.19], [x + 0.57, 0.6, wz0 + 0.19], [x + 0.57, 0.92, wz0 + 0.19], [x + 0.03, 0.92, wz0 + 0.19], col(0x2a2c34)); }
      else A.box(x, 0.55, wz0 + 0.15 + r() * 0.3, x + ww, 0.55 + hh, wz0 + 0.45 + r() * 0.3, col(cc));
      A.box(x + 0.05, 0.55, wz1 - 0.14, x + 0.25, 0.68, wz1 - 0.12, col(0xf2c81e));
    }
    w.spec.ao.push([a0, wz0, a1, wz1, 0.6]);
  }
  // Strip lights, and carpet tiles that were purple once.
  for (const fx of [0.3, 0.7]) K.pool(x0 + (x1 - x0) * fx, z0 + (z1 - z0) * 0.6, 3.4, 2.6, 0xe8f0e0, 0.1);
  patch(w.spec, x0 + 0.5, zB, x1 - x0 - 1, z1 - 0.5 - zB, (c, X0, Y0, X1, Y1) => carpet(c, X0, Y0, X1, Y1, 0x3d3350, 0xb8923a, 0x2c2440, 5));
  void U;
}

/** The other shops and the cabin: their painted wall on a real one, and a west wall that is something. */
function shopInside(K: Kit, b: BuildingSpec) {
  const { w } = K, { x0, y0: z0, x1, y1: z1 } = b.rect, zB = z0 + 0.55, im = w.host.image(`w-wall-${b.id}`), xw = x0 + 0.5, L = z1 - 0.5 - zB;
  const base = b.id === "charity" ? 0xa8c8b4 : b.id === "surplus" ? 0x4a5238 : 0x8a5a36;
  K.wallS(x0 + 0.5, x1, zB, 3, (c, ww, h) => { art2.roomWall(c, ww, h, { base, seed: 3, block: false }); if (im) c.drawImage(im as CanvasImageSource, 0, 0, im.width, im.height, ww - im.width, 0, im.width, h); });
  K.wallE(xw, zB, z1 - 0.5, 3, (c, ww, h) => art2.roomWall(c, ww, h, { base, seed: 7, block: b.id === "surplus", dado: b.id === "cabin" ? 0x6a4428 : undefined }), 0.02);
  if (b.id === "charity") {
    K.onE(K.pm(L - 1.2, 2.2, (c, ww, h) => art2.shelves(c, ww, h, 51, "files")), xw + 0.03, zB + L / 2, 0.3, L - 1.2, 2.2);
    K.onE(K.hd(2.4, 0.4, (c, ww, h) => art2.plate(c, ww, h, "BOOKS 50p", 0xf1efe6, 0x2f5d50, { sub: "ALL ENDINGS GUARANTEED" })), xw + 0.05, zB + L / 2, 2.55, 2.4, 0.4);
    patch(w.spec, x0 + 0.5, zB, x1 - x0 - 1, L, (c, X0, Y0, X1, Y1) => { c.fillStyle = "rgba(30,60,50,0.12)"; c.fillRect(X0, Y0, X1 - X0, Y1 - Y0); });
  } else if (b.id === "surplus") {
    K.onE(K.pm(L - 1.2, 2.2, (c, ww, h) => art2.shelves(c, ww, h, 53, "tins")), xw + 0.03, zB + L / 2, 0.3, L - 1.2, 2.2);
    K.onE(K.hd(2.8, 0.4, (c, ww, h) => art2.plate(c, ww, h, "RATIONS: BEST BEFORE 1987", 0xd9cfa8, 0x2f3d22, { sub: "STILL BETTER THAN THE PIES" })), xw + 0.05, zB + L / 2, 2.55, 2.8, 0.4);
  } else {
    K.onE(K.hd(1.0, 1.35, (c, ww, h) => art2.wanted(c, ww, h, 11)), xw + 0.03, zB + L * 0.5, 1.2, 1.0, 1.35);
    K.onE(K.pm(1.6, 1.1, (c, ww, h) => art2.noticeboard(c, ww, h, 15, "ROTA")), xw + 0.03, zB + L * 0.5 - 1.8, 1.2, 1.6, 1.1);
  }
  K.lampE(xw, 2.5, zB + L * 0.3, 0xffe6b0, 2.2);
  K.pool((x0 + x1) / 2, z0 + (z1 - z0) * 0.6, (x1 - x0) * 0.3, 2.6, 0xffe2a8, 0.1);
}
export type { Furniture };

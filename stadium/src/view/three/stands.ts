// The ground as a place: raked terracing the crowd sits on (so the pitch reads as a bowl), stairs up
// from every gangway, dugouts, hoardings, a board that tells you things, the tunnel mouth, light from
// the four pylons, the turnstile canopy and the service gate. Built from the layout's areas and walls.
import type { Area, Wall } from "../../stadium/layout";
import * as art2 from "./art2";
import type { V3 } from "./mesh";
import { H, rect, tiny, type Region } from "./paint";
import type { Part, World3D } from "./world3d";

/** Fine cells per seat (along a row) and per tread (up the rake): stairs need smaller steps than seats do. */
const F = 3;
interface Grid { a: Area; side: "n" | "s" | "e" | "w"; nx: number; ny: number; dx: number; dy: number; h: Float32Array; seats: number; rows: number; riser: number; red: boolean }
const col = (c: number, c2?: number) => ({ c, c2 });

export class Stands {
  grids: Grid[] = [];
  /** Height of the terrace at a point, in metres (0 off the stands, and on the main stand while it lies flat). */
  lift(x: number, y: number, northCut: boolean): number {
    for (const g of this.grids) {
      const a = g.a;
      if (x < a.x || x >= a.x + a.w || y < a.y || y >= a.y + a.h) continue;
      if (g.side === "n" && northCut) return 0;
      return g.h[Math.min(g.ny - 1, Math.floor((y - a.y) / g.dy)) * g.nx + Math.min(g.nx - 1, Math.floor((x - a.x) / g.dx))];
    }
    return 0;
  }
}

/** Back walls of the stands (so the wall list can stand them up), and walls the terracing replaces. */
export function standWall(w: World3D, wl: Wall): number | "skip" | undefined {
  if (wl.prop || wl.gate) return undefined;
  const x0 = wl.x, x1 = wl.x + wl.w, y0 = wl.y, y1 = wl.y + wl.h;
  if (Math.abs(y0 - 38) < 0.05 && wl.h < 1 && wl.w > 3 && Math.abs(x0) <= 40.1 && Math.abs(x1) <= 40.1) return 3.4; // behind the south stand
  if (wl.w < 1 && wl.h > 10 && (Math.abs(x0 - 50) < 0.05 || Math.abs(x0 + 50.6) < 0.05) && Math.abs(y0) <= 27.1) return 3.3; // behind the ends
  if (wl.h3 === 1.6 && wl.w < 0.5 && y0 > -38.1 && y1 < -28) return "skip"; // the tunnel's sides: the terrace itself
  return undefined;
}

function areaAt(areas: Area[], x: number, y: number): Area | null {
  for (let i = areas.length - 1; i >= 0; i--) { const a = areas[i]; if (x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) return a; }
  return null;
}

function makeGrid(w: World3D, a: Area): Grid {
  const wide = a.w > a.h, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  const side = wide ? (cy > 0 ? "s" : "n") : cx > 0 ? "e" : "w";
  const seatsX = Math.round(a.w / 0.9), rowsY = Math.round(a.h / 1.1), nx = seatsX * F, ny = rowsY * F, dx = a.w / nx, dy = a.h / ny;
  const rows = wide ? rowsY : seatsX, riser = wide ? 0.26 : 0.22, h = new Float32Array(nx * ny);
  // Gaps in the wall behind (gangways), along the back edge.
  const walls = w.host.walls.filter((q) => !q.prop && !q.gate && q.h3 > 1.3), gaps: [number, number][] = [];
  {
    const back = side === "s" ? a.y + a.h + 0.3 : side === "n" ? a.y - 0.25 : side === "e" ? a.x + a.w + 0.3 : a.x - 0.3;
    const t0 = wide ? a.x : a.y, t1 = wide ? a.x + a.w : a.y + a.h;
    const cover = walls.filter((q) => (wide ? q.y <= back && q.y + q.h >= back && q.w > 1 : q.x <= back && q.x + q.w >= back && q.h > 1)).map((q) => (wide ? [q.x, q.x + q.w] : [q.y, q.y + q.h]) as [number, number]).sort((p, q) => p[0] - q[0]);
    let t = t0;
    for (const [c0, c1] of cover) { if (c0 > t + 0.5 && c0 < t1) gaps.push([t, Math.min(c0, t1)]); t = Math.max(t, c1); }
    if (t < t1 - 0.5) gaps.push([t, t1]);
  }
  const areas = w.host.areas;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = a.x + (i + 0.5) * dx, y = a.y + (j + 0.5) * dy;
    if (areaAt(areas, x, y) !== a) continue; // the tunnel runs through at pitch level
    const row = side === "s" ? Math.floor(j / F) : side === "n" ? rowsY - 1 - Math.floor(j / F) : side === "e" ? Math.floor(i / F) : seatsX - 1 - Math.floor(i / F);
    let hh = 0.25 + row * riser;
    const db = side === "s" ? a.y + a.h - y : side === "n" ? y - a.y : side === "e" ? a.x + a.w - x : x - a.x; // from the back
    const t = wide ? x : y, de = wide ? Math.min(x - a.x, a.x + a.w - x) : Math.min(y - a.y, a.y + a.h - y);
    if (gaps.some(([g0, g1]) => t > g0 && t < g1)) hh = Math.min(hh, 0.5 * db); // stairs up from the gangway
    hh = Math.min(hh, 0.1 + 0.6 * de); // and the ends step down to the corners
    h[j * nx + i] = Math.max(0.06, Math.round(hh * 100) / 100);
  }
  return { a, side, nx, ny, dx, dy, h, seats: seatsX, rows: rowsY, riser, red: a.id === "stand_e" && rows > 0 };
}

function emitGrid(w: World3D, p: Part, g: Grid, sw: { row: Region; colB: Region; colR: Region; conc: Region }) {
  const { A } = p, { a, nx, ny, dx, dy, h } = g, wide = g.side === "n" || g.side === "s";
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : h[j * nx + i]);
  const done = new Uint8Array(nx * ny), X = (i: number) => a.x + i * dx, Z = (j: number) => a.y + j * dy;
  const top = (i0: number, j0: number, i1: number, j1: number, y: number, spec: Parameters<typeof A.quad>[4]) => A.quad([X(i0), y, Z(j1)], [X(i1), y, Z(j1)], [X(i1), y, Z(j0)], [X(i0), y, Z(j0)], spec);
  // Rows of seats: wherever a whole seat's worth of cells stands at its row's full height.
  const N = wide ? 16 : 12, blocks = wide ? g.rows : g.seats, slots = wide ? g.seats : g.rows;
  for (let b = 0; b < blocks; b++) {
    const full = (s: number): number => {
      const i0 = wide ? s * F : b * F, j0 = wide ? b * F : s * F, v = at(i0, j0);
      if (v < 0.2) return 0;
      for (let u = 0; u < F; u++) for (let t = 0; t < F; t++) if (Math.abs(at(i0 + u, j0 + t) - v) > 1e-4) return 0;
      const row = g.side === "s" || g.side === "e" ? b : blocks - 1 - b;
      return Math.abs(v - (0.25 + row * g.riser)) < 0.006 ? v : 0;
    };
    for (let s = 0; s < slots;) {
      const v = full(s);
      if (!v) { s++; continue; }
      let e = s + 1; while (e < slots && e - s < N && full(e) === v) e++;
      const n = e - s;
      if (wide) { top(s * F, b * F, e * F, b * F + F, v, { r: sw.row, uv: g.side === "n" ? [0, 0, n / N, 1] : [0, 1, n / N, 0], c: (s + b) % 2 ? 0xffffff : 0xf0f0f0 }); for (let i = s * F; i < e * F; i++) for (let t = 0; t < F; t++) done[(b * F + t) * nx + i] = 1; }
      else { top(b * F, s * F, b * F + F, e * F, v, { r: g.red ? sw.colR : sw.colB, uv: g.side === "w" ? [0, 1 - n / N, 1, 1] : [1, 1 - n / N, 0, 1] }); for (let j = s * F; j < e * F; j++) for (let t = 0; t < F; t++) done[j * nx + b * F + t] = 1; }
      s = e;
    }
  }
  // Everything else (stairs, the stepped ends): bare concrete, in the biggest rectangles that share a height.
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (done[j * nx + i] || at(i, j) <= 0) continue;
    const v = at(i, j);
    let i1 = i + 1; while (i1 < nx && !done[j * nx + i1] && at(i1, j) === v && (i1 - i) * dx < 4) i1++;
    let j1 = j + 1;
    grow: while (j1 < ny && (j1 - j) * dy < 4) { for (let k = i; k < i1; k++) if (done[j1 * nx + k] || at(k, j1) !== v) break grow; j1++; }
    for (let jj = j; jj < j1; jj++) for (let k = i; k < i1; k++) done[jj * nx + k] = 1;
    top(i, j, i1, j1, v, { r: sw.conc, uv: [0, 0, Math.min(1, ((i1 - i) * dx) / 4), Math.min(1, ((j1 - j) * dy) / 4)], c: 0xd8d8d8 });
  }
  // Faces you can see: the ones that look south and the ones that look east.
  const riser = (ax: number, az: number, bx: number, bz: number, lo: number, hi: number) => {
    if (hi - lo > 0.5) { w.face(A, ax, az, bx, bz, lo, hi, w.sw.block, 2, 2, 0xb8bcc4); A.quad([ax, hi - 0.1, az + (az === bz ? 0.012 : 0)], [bx, hi - 0.1, bz + (az === bz ? 0.012 : 0)], [bx, hi, bz + (az === bz ? 0.012 : 0)], [ax, hi, az + (az === bz ? 0.012 : 0)], col(0xd9b92a)); }
    else A.quad([ax, lo, az], [bx, lo, bz], [bx, hi, bz], [ax, hi, az], col(0x565a61, 0x82868d));
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx;) {
    const hi = at(i, j), lo = at(i, j + 1);
    if (hi <= lo) { i++; continue; }
    let e = i + 1; while (e < nx && at(e, j) === hi && at(e, j + 1) === lo) e++;
    riser(X(i), Z(j + 1), X(e), Z(j + 1), lo, hi); i = e;
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny;) {
    const hi = at(i, j), lo = at(i + 1, j);
    if (hi <= lo) { j++; continue; }
    let e = j + 1; while (e < ny && at(i, e) === hi && at(i + 1, e) === lo) e++;
    riser(X(i + 1), Z(e), X(i + 1), Z(j), lo, hi); j = e;
  }
}

export function buildStands(w: World3D): Stands {
  const st = new Stands(), a = w.atlas, v = w.host.venue, m = w.mirror, mx = (x: number) => (m ? -x : x);
  for (const ar of w.host.areas) if (ar.seats) st.grids.push(makeGrid(w, ar));
  const sw = {
    row: a.paint(460, 36, (c, ww, h) => art2.seatsRow(c, ww, h, 16, 0x2c4a9a, 11)),
    colB: a.paint(29, 423, (c, ww, h) => art2.seatsCol(c, ww, h, 12, 0x2c4a9a, 13)),
    colR: a.paint(29, 423, (c, ww, h) => art2.seatsCol(c, ww, h, 12, 0xa8323a, 17)),
    conc: a.paintM(4, 4, (c, ww, h) => art2.concrete(c, ww, h, 23)),
  };
  const bowl = w.part("bowl"), north = w.part("stand_n"), terr = w.part("terraces");
  for (const g of st.grids) emitGrid(w, g.side === "n" ? north : terr, g, sw);
  w.finish(terr, false, "terrace");

  // ---- The main stand's back wall, standing (the wall list keeps its low stub for when the stand lies flat),
  // a run of hoardings along the top of it, and the board.
  const gn = st.grids.find((g) => g.side === "n");
  if (gn) {
    const { A, U } = north, top = 3.4, z0 = -38.5, z1 = -38;
    for (const wl of w.host.walls) {
      if (wl.prop || wl.gate || Math.abs(wl.y - z0) > 0.05 || wl.h > 1 || wl.x < gn.a.x - 0.1 || wl.x + wl.w > gn.a.x + gn.a.w + 0.1) continue;
      const x0 = wl.x, x1 = wl.x + wl.w;
      w.face(A, x0, z1, x1, z1, 0, top, w.sw.block, 2, 2, 0xc0c4cc); w.face(A, x1, z1, x1, z0, 0, top, w.sw.block);
      A.quad([x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0], col(0xb4b8bc));
      // hoardings on posts above the back row
      const n = Math.max(1, Math.floor((x1 - x0 - 1) / 6.2)), pad = (x1 - x0 - n * 6) / (n + 1);
      for (let k = 0; k < n; k++) {
        const ax = x0 + pad + k * (6 + pad), i = Math.round((ax + 40) / 6);
        const r = a.paint(384, 70, (c, ww, h) => art2.advert(c, ww, h, i + (v.id === "final" ? 5 : 0)));
        U.quad([ax, top + 0.15, z1 - 0.1], [ax + 6, top + 0.15, z1 - 0.1], [ax + 6, top + 1.25, z1 - 0.1], [ax, top + 1.25, z1 - 0.1], r);
        A.box(ax - 0.05, top, z1 - 0.3, ax + 6.05, top + 1.3, z1 - 0.12, { all: col(0x2b2f35, 0x3a3f46), s: null });
        for (const px of [ax + 0.6, ax + 5.4]) A.box(px - 0.06, top, z1 - 0.26, px + 0.06, top + 0.15, z1 - 0.14, col(0x1d2024));
      }
    }
    // The board over the tunnel.
    const bw = 9.5, bh = 2.7, by = top + 1.7, bz = z1 - 0.15, team = (w.host.venue.round ?? "").toUpperCase();
    const rB = a.paint(Math.round(bw * 64), Math.round(bh * 64), (c, ww, h) => art2.dotMatrix(c, ww, h, [`ENGLAND v ${OPP[v.opp] ?? v.opp}`, team || "TODAY", "ATTENDANCE: TOO MANY", "PLEASE DO NOT FEED THE MASCOT"], v.ground.toUpperCase()));
    A.box(-bw / 2 - 0.12, by - 0.12, bz - 0.3, bw / 2 + 0.12, by + bh + 0.12, bz, { all: col(0x15171a, 0x23262b) });
    U.quad([-bw / 2, by, bz + 0.02], [bw / 2, by, bz + 0.02], [bw / 2, by + bh, bz + 0.02], [-bw / 2, by + bh, bz + 0.02], rB);
    for (const px of [-bw / 2 + 0.8, bw / 2 - 0.8]) A.box(px - 0.12, 0, bz - 0.28, px + 0.12, by, bz - 0.04, col(0x3a3f47, 0x565c66));
    w.halo(north, [0, by + bh / 2, bz + 0.4], bw * 1.3, 0xffb040, 0.14, 0.4);
    // The tunnel mouth: a frame in the club's blue with a plate over it.
    const tx0 = -2.4, tx1 = 2.4, tz = -28.05;
    for (const px of [tx0, tx1 - 0.2]) A.box(px, 0, tz - 0.2, px + 0.2, 2.6, tz, col(art2.BLUE, 0x2a3f9a));
    const rP = a.paint(Math.round((tx1 - tx0) * 64), 38, (c, ww, h) => art2.plate(c, ww, h, "PLAYERS AND OFFICIALS ONLY", art2.BLUE, 0xf4f4f4, { sub: "THIS MEANS YOU, DEREK" }));
    A.box(tx0, 2.2, tz - 0.2, tx1, 2.8, tz, { all: col(art2.BLUE), s: rP, top: col(0x2a3f9a) });
    w.pool(north, 0, -30.5, 2.0, 3.2, 0xfff1c4, 0.16);
  }
  w.finish(north, false, "stand_n");

  // ---- Pitchside.
  const { A, U } = bowl;
  // Dugouts: a back wall with a row of bucket seats on it, a roof, glazed ends.
  for (const f of v.furniture) {
    if (f.key !== "dugout") continue;
    const x0 = f.x - 2.3, x1 = f.x + 2.3, z0 = f.y - 1.25, z1 = f.y - 0.15, home = (f.x < 0) !== m;
    const rS = a.paintM(4.6, 1.75, (c, ww, h) => dugoutBack(c, ww, h, home ? 0x2c4a9a : 0xa8323a, home ? "HOME" : "VISITORS"));
    A.box(x0, 0, z0, x1, 0.12, z1 + 0.25, { all: col(0x6a6e75, 0x868a91) }); // plinth
    A.quad([x0, 0.12, z0 + 0.12], [x1, 0.12, z0 + 0.12], [x1, 1.87, z0 + 0.12], [x0, 1.87, z0 + 0.12], rS);
    A.box(x0 - 0.06, 0.12, z0, x1 + 0.06, 1.87, z0 + 0.1, { all: col(0x23262b, 0x3a3f46), s: null });
    A.box(x0 + 0.1, 0.12, z0 + 0.14, x1 - 0.1, 0.5, z0 + 0.62, { all: col(0x3a3f46, 0x565c66), top: col(home ? 0x2c4a9a : 0xa8323a, 0x6a82c8) }); // the bench
    A.box(x0 - 0.1, 1.87, z0 - 0.06, x1 + 0.1, 1.96, z0 + 0.85, { all: col(0xe8ebee, 0xf8fafc), top: col(0xdfe4ea) }); // roof
    A.box(x0 - 0.1, 1.87, z0 + 0.85, x1 + 0.1, 2.02, z0 + 0.93, { all: col(home ? art2.BLUE : 0x8a1a22) });
    for (const ex of [x0 - 0.06, x1]) { A.box(ex, 0.12, z0, ex + 0.06, 1.87, z0 + 0.1, col(0x23262b)); A.box(ex, 0.12, z0 + 0.8, ex + 0.06, 1.87, z0 + 0.86, col(0x23262b)); }
    A.quad([x1 + 0.06, 0.6, z0 + 0.8], [x1 + 0.06, 0.6, z0 + 0.1], [x1 + 0.06, 1.87, z0 + 0.1], [x1 + 0.06, 1.87, z0 + 0.8], { r: w.sw.pane });
    A.box(x1, 0.12, z0 + 0.1, x1 + 0.06, 0.6, z0 + 0.8, col(0x3a3f46, 0x565c66));
    w.replace("dugout", f.x, f.y);
    w.spec.ao.push([x0, z0, x1, z1 - 0.2, 1.6]);
  }
  // Hoardings behind each goal: the west ones face the pitch (and us); of the east ones you see the backs.
  {
    const rBack = a.paint(192, 30, art2.hoardingBack);
    let i = 3;
    for (let z = -21; z < 20.5; z += 6.05) {
      if (Math.abs(z + 3) < 4.2 && false) continue;
      const r = a.paint(384, 62, (c, ww, h) => art2.advert(c, ww, h, i++));
      const xw = -38.9, xe = 38.9;
      A.box(xw - 0.12, 0, z, xw, 0.97, z + 6, { all: col(0x2b2f35), top: col(0x4a4f56) });
      U.quad([xw + 0.01, 0, z + 6], [xw + 0.01, 0, z], [xw + 0.01, 0.97, z], [xw + 0.01, 0.97, z + 6], r);
      A.box(xe, 0, z, xe + 0.12, 0.97, z + 6, { all: col(0x15171a), e: { r: rBack }, top: col(0x4a4f56) });
      for (const sz of [z + 0.8, z + 5.2]) { A.bar([xe + 0.12, 0.8, sz], [xe + 0.7, 0, sz], 0.06, col(0x1d2024)); A.bar([xw - 0.12, 0.8, sz], [xw - 0.7, 0, sz], 0.06, col(0x1d2024)); }
    }
  }
  // Light from the four pylons: warm pools reaching in from the corners, and the lamps' own glare.
  for (const [px, pz] of [[-54.5, 43.5], [54, 43.5], [-54.5, -37], [54, -37]]) {
    const x = mx(px);
    w.halo(bowl, [x, 14.9, pz], 9, 0xfff6dc, 0.55); w.halo(bowl, [x, 14.9, pz], 22, 0xfff1c4, 0.12);
    w.pool(bowl, x * 0.47, pz * 0.42 - 2, 24, 15, 0xfff3cf, 0.085);
    w.pool(bowl, x, pz + 1, 5, 4, 0xfff3cf, 0.14);
  }
  w.pool(bowl, 0, 0, 34, 20, 0xf4ffd8, 0.05);
  // Corner flags' quadrants are painted; the technical areas are too (see the ground paint).

  // ---- The service gate and the loading bay.
  {
    const gx = mx(62.5), s = m ? -1 : 1, x0 = Math.min(mx(62), mx(63)), x1 = x0 + 1;
    // gate posts and a height bar
    for (const z of [-46.3, -39.7]) A.box(x0 - 0.05, 0, z - 0.25, x1 + 0.05, 3.3, z + 0.25, { all: { r: w.sw.block, uv: [0, 0, 0.55, 1], c: 0xd0d0d0 }, top: col(0xd9b92a) });
    const rBar = a.paint(Math.round(6.6 * 64), 36, (c, ww, h) => { rect(c, 0, 0, ww, h, "#15171a"); for (let x = -h; x < ww; x += 28) { c.fillStyle = "#f2c81e"; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 14, h); c.lineTo(x + 14 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill(); } rect(c, ww / 2 - 110, 4, 220, h - 8, "#f1efe6"); tiny(c, "MAX HEADROOM 3.3M", ww / 2, 7, "#15171a", 2, "center"); tiny(c, "MAX PATIENCE: LESS", ww / 2, 20, "#b01020", 2, "center"); });
    const fx = s > 0 ? x1 + 0.06 : x0 - 0.06;
    A.box(x0 + 0.2, 3.3, -46.5, x1 - 0.2, 3.85, -39.5, { all: col(0x15171a), [s > 0 ? "e" : "w"]: null });
    if (s > 0) U.quad([fx - 0.25, 3.3, -39.5], [fx - 0.25, 3.3, -46.5], [fx - 0.25, 3.85, -46.5], [fx - 0.25, 3.85, -39.5], rBar);
    else A.quad([fx + 0.25, 3.3, -46.5], [fx + 0.25, 3.3, -39.5], [fx + 0.25, 3.85, -39.5], [fx + 0.25, 3.85, -46.5], col(0xf2c81e));
    // a sign on the wall beside it, and a lamp over it
    const rS = a.paint(160, 112, (c, ww, h) => art2.menuBoard(c, ww, h, "SERVICE GATE", [["DELIVERIES", "RING"], ["RING TWICE", "WAIT"], ["TEAM COACH", "WAVE"], ["MASCOTS", "NO"]], 0x1b2a6b, 0xf4f4f4));
    if (s > 0) A.quad([x1 + 0.02, 1.0, -36.9], [x1 + 0.02, 1.0, -39.4], [x1 + 0.02, 2.75, -39.4], [x1 + 0.02, 2.75, -36.9], rS);
    A.box(x0 - 0.02, 0, -39.5, x1 + 0.02, 2.9, -36.6, { all: { r: w.sw.block, c: 0xd0d0d0 }, top: col(0xb4b8bc) });
    w.halo(bowl, [gx + s * 0.7, 3.5, -43], 3.2, 0xfff0c0, 0.3); w.pool(bowl, gx + s * 2.2, -43, 3.2, 3.6, 0xfff0c0, 0.16);
    // The bay: roller shutters let into the back wall, a dock with a striped edge, a strip light over each door.
    const b = w.host.areas.find((q) => q.id === "loading");
    if (b) {
      const z = -60.95, n = 3, bw = 4.4, gap = (b.w - n * bw) / (n + 1);
      for (let k = 0; k < n; k++) {
        const ax = b.x + gap + k * (bw + gap), kk = m ? n - k : k + 1;
        const r = a.paintM(bw, 3, (c, ww, h) => shutter(c, ww, h, `BAY ${kk}`, k === 1));
        A.quad([ax, 0, z], [ax + bw, 0, z], [ax + bw, 3, z], [ax, 3, z], r);
        U.box(ax + 0.6, 2.72, z, ax + bw - 0.6, 2.8, z + 0.14, col(0xfff4d6)); w.halo(bowl, [ax + bw / 2, 2.6, z + 0.4], bw * 1.1, 0xfff0c8, 0.2, 0.5); w.pool(bowl, ax + bw / 2, z + 2.2, bw * 0.5, 1.8, 0xfff0c8, 0.14);
      }
      A.box(b.x + 0.6, 0, z, b.x + b.w - 0.6, 0.18, z + 1.0, { all: col(0x6a6e75, 0x8a8e95), s: { c: 0xd9b92a } });
    }
  }
  w.finish(bowl, false, "inside");

  // ---- Outside: a canopy over the turnstiles with their name on it.
  {
    const out = w.part("turnstiles"), { A: B } = out, z = 45.05, x0 = -10.4, x1 = 10.4, y0 = 5.15, dep = 1.7;
    B.box(x0, y0, z, x1, y0 + 0.14, z + dep, { all: col(0x3a3f47, 0x4a505a), top: { r: w.sw.steelroof, uv: [0, 0, 1, 0.3] }, bot: col(0x23262b) });
    const rT = a.paint(Math.round((x1 - x0) * 32), 45, (c, ww, h) => { rect(c, 0, 0, ww, h, H(art2.BLUE)); rect(c, 0, 0, ww, 3, "#f4f4f4"); rect(c, 0, h - 3, ww, 3, H(art2.RED)); });
    B.box(x0, y0 - 0.55, z + dep - 0.1, x1, y0 + 0.14, z + dep, { all: col(art2.BLUE), s: rT });
    const rN = a.paint(Math.round(9 * 64), 40, (c, ww, h) => art2.plate(c, ww, h, "TURNSTILES 1 - 3", art2.BLUE, 0xf4f4f4, { sub: "HAVE YOUR TICKET, YOUR EXCUSES AND YOUR BAG READY", border: art2.BLUE }));
    B.quad([-4.5, y0 - 0.52, z + dep + 0.01], [4.5, y0 - 0.52, z + dep + 0.01], [4.5, y0 + 0.1, z + dep + 0.01], [-4.5, y0 + 0.1, z + dep + 0.01], rN);
    for (const px of [x0 + 0.1, -3.05, 2.95, x1 - 0.22]) B.box(px, 0, z + dep - 0.16, px + 0.12, y0 - 0.55, z + dep - 0.04, col(0x4a505a, 0x6a707a));
    for (const lx of [-6, 0, 6]) { w.halo(out, [mx(lx), 3.2, z + 0.9], 3.6, 0xfff0c8, 0.2); w.pool(out, mx(lx), z + 2.3, 1.7, 2.0, 0xfff0c8, 0.2); w.spec.streaks.push([mx(lx) - 1.1, z + 0.2, 2.2, 3.4, 0xfff0c8, 0.3]); }
    w.finish(out, false, "outside");
  }
  return st;
}

const OPP: Record<string, string> = { POR: "PORTUGAL", BRA: "BRAZIL", ARG: "ARGENTINA", GER: "GERMANY", FRA: "FRANCE", ESP: "SPAIN", ITA: "ITALY" };

function dugoutBack(c: CanvasRenderingContext2D, w: number, h: number, seat: number, label: string) {
  rect(c, 0, 0, w, h, H(0xdfe4ea)); rect(c, 0, 0, w, 10, H(seat)); tiny(c, label, w / 2, 3, "#f4f4f4", 1, "center");
  for (let y = 12; y < h; y += 9) rect(c, 0, y, w, 1, "rgba(120,130,140,0.25)");
  const n = 8, sw = w / n;
  for (let i = 0; i < n; i++) { const x = Math.round(i * sw) + 2, ww = Math.round(sw) - 4; rect(c, x, h - 34, ww, 20, H(seat)); rect(c, x, h - 34, ww, 2, "rgba(255,255,255,0.35)"); rect(c, x + 2, h - 30, ww - 4, 12, "rgba(0,0,0,0.12)"); rect(c, x, h - 14, ww, 5, "rgba(10,12,18,0.55)"); }
  rect(c, 0, h - 9, w, 9, H(0x3a3f46));
}
function shutter(c: CanvasRenderingContext2D, w: number, h: number, label: string, half: boolean) {
  rect(c, 0, 0, w, h, H(0x3a3f47));
  const open = half ? Math.round(h * 0.4) : 0;
  for (let y = 8; y < h - open; y += 4) { rect(c, 5, y, w - 10, 3, H(0x8a9096)); rect(c, 5, y, w - 10, 1, H(0xb4bac0)); }
  if (open) { rect(c, 5, h - open, w - 10, open, H(0x15171a)); for (let k = 0; k < 4; k++) { rect(c, 12 + k * 30, h - 22 - (k % 2) * 9, 24, 22 + (k % 2) * 9, H([0x8a6a48, 0x9a7a52, 0x7a5a3c, 0x8a6a48][k])); rect(c, 12 + k * 30, h - 22 - (k % 2) * 9, 24, 1, "rgba(255,255,255,0.3)"); } }
  rect(c, 0, 0, w, 8, H(0x23262b)); for (let x = 0; x < w; x += 12) { c.fillStyle = "#d9b92a"; c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 6, 8); c.lineTo(x + 10, 3); c.lineTo(x + 4, 3); c.closePath(); c.fill(); }
  rect(c, w / 2 - 22, 14, 44, 13, "#f1efe6"); tiny(c, label, w / 2, 18, "#15171a", 1, "center");
  rect(c, 0, 0, 5, h, H(0x565c66)); rect(c, w - 5, 0, 5, h, H(0x2b2f35));
  for (let k = 0; k < 30; k++) rect(c, 6 + ((k * 37) % (w - 12)), h - open - 2 - ((k * 13) % 30), 1, 3, "rgba(110,70,40,0.45)");
}
export type { V3 };

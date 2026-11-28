// The hydration plant in the 3D miniature (the sim's side is stadium/scheme_special.ts): a chunky yellow
// manifold in the corner of the pub yard with a HOME plate and a VISITORS plate, a hopper under each, a
// lever between them, a crate of Rocket Tonic at its foot, and two fat pipes that go up, over and into
// the ground (England's away north towards the stadium, the visitors' east towards the hotel). And where
// the visitors' line comes back up: a dispenser and a crate on the hotel's dock. Built once with the town;
// what changes (a token in a hopper, the lump going round, the mark on the crate) is drawn over it by
// view/hydroView.ts.
import * as THREE from "three";
import { PACE } from "../../stadium/layout";
import { plantSpots } from "../../stadium/scheme_special";
import { patch } from "./ground";
import type { Builder } from "./mesh";
import { H, PXM, hex, pixText, rect, shade, css, tiny, type Ctx } from "./paint";
import type { World3D } from "./world3d";

/** The plant's own colours, shared with the 2D drawing. */
export const HYDRO = { body: 0xf0c020, bodyDark: 0xb88a10, home: 0x1b3a8a, away: 0xc8102e, pipeHome: 0xf2f2ee, steel: 0x8f959c, ink: 0x15171a, top: 1.95, pipeR: 0.26, homeH: 2.45, awayH: 2.2 };
const col = (c: number, c2?: number) => ({ c, c2 });

/** A round pipe from a to b along one axis (x, y up, or z), in bands: mostly `base`, a ring of `band` every so often, a flange at each end. */
function pipe(B: Builder, a: [number, number, number], b: [number, number, number], r: number, base: number, band: number) {
  if (a[1] > b[1]) [a, b] = [b, a]; // (an upright run is built from the bottom)
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return;
  // The builder makes upright cylinders: turn "up" to lie along the run.
  const m = new THREE.Matrix4();
  if (Math.abs(dx) > 0.01) m.makeRotationZ(dx > 0 ? -Math.PI / 2 : Math.PI / 2); else if (Math.abs(dz) > 0.01) m.makeRotationX(dz > 0 ? Math.PI / 2 : -Math.PI / 2);
  m.setPosition(a[0], a[1], a[2]);
  B.xf(m);
  const step = 0.55, ring = 0.14;
  for (let y = 0; y < len - 1e-6; y += step) {
    const y1 = Math.min(len, y + step - ring);
    B.cyl(0, y, y1, 0, r, 10, col(base));
    if (y1 < len) B.cyl(0, y1, Math.min(len, y + step), 0, r + 0.015, 10, col(band));
  }
  for (const y of [0, len - 0.08]) B.cyl(0, y, y + 0.08, 0, r + 0.07, 10, col(HYDRO.steel), col(HYDRO.steel));
  B.end();
}
/** The corner piece where a pipe turns: a fat block, like a toy's. */
const elbow = (B: Builder, x: number, y: number, z: number, r: number, c: number) => B.box(x - r - 0.03, y - r - 0.03, z - r - 0.03, x + r + 0.03, y + r + 0.03, z + r + 0.03, { all: col(c, shade3(c, 1.1)), bot: col(shade3(c, 0.7)) });
const shade3 = (c: number, k: number) => { const [r, g, b] = shade(hex(c), k); return (Math.min(255, r | 0) << 16) | (Math.min(255, g | 0) << 8) | Math.min(255, b | 0); };

function plate(c: Ctx, x: number, y: number, w: number, h: number, bg: number, word: string) {
  rect(c, x, y, w, h, H(HYDRO.ink)); rect(c, x + 1, y + 1, w - 2, h - 2, "#f4f4f0"); rect(c, x + 3, y + 3, w - 6, h - 6, H(bg));
  pixText(c, word, x + w / 2, y + h / 2 + 7, word.length > 5 ? 12 : 15, "#ffffff", { align: "center", maxW: w - 10, shadow: "rgba(0,0,0,0.45)" });
  for (const [bx, by] of [[x + 4, y + 4], [x + w - 6, y + 4], [x + 4, y + h - 6], [x + w - 6, y + h - 6]]) rect(c, bx, by, 2, 2, "#d9dde2");
}
/** The front of the manifold, 64 px to the metre: HYDRATION across the top, a plate each for HOME and VISITORS (left to right as they stand), hazard tape along the bottom. */
function front(c: Ctx, w: number, h: number, leftHome: boolean) {
  const body = hex(HYDRO.body);
  rect(c, 0, 0, w, h, css(body));
  for (let x = 0; x < w; x += Math.round(w / 4)) { rect(c, x, 0, 1, h, css(shade(body, 0.78))); rect(c, x + 1, 0, 1, h, css(shade(body, 1.2))); }
  rect(c, 0, 0, w, 1, css(shade(body, 1.3)));
  // The banner.
  rect(c, 0, 2, w, 19, H(HYDRO.ink)); rect(c, 2, 4, w - 4, 15, "#20252e");
  pixText(c, "HYDRATION", w / 2, 16, 11, "#f4f4f0", { align: "center", maxW: w - 34 });
  for (const dx of [9, w - 10]) { c.fillStyle = "#58c8f0"; c.beginPath(); c.moveTo(dx, 6); c.lineTo(dx + 4, 13); c.arc(dx, 13, 4, 0, Math.PI); c.closePath(); c.fill(); }
  // The plates: each stands over its own hopper, in its own colour.
  const pw = Math.round(w / 2) - 7;
  const L = leftHome ? ["HOME", HYDRO.home] as const : ["VISITORS", HYDRO.away] as const, R = leftHome ? ["VISITORS", HYDRO.away] as const : ["HOME", HYDRO.home] as const;
  plate(c, 3, 24, pw, 34, L[1], L[0]); plate(c, w - 3 - pw, 24, pw, 34, R[1], R[0]);
  // A dial nobody reads, and the lever's backplate.
  c.fillStyle = H(HYDRO.ink); c.beginPath(); c.arc(w / 2, 64, 7, 0, 7); c.fill(); c.fillStyle = "#f4f4f0"; c.beginPath(); c.arc(w / 2, 64, 5, 0, 7); c.fill(); rect(c, w / 2, 60, 1, 4, "#c8102e"); rect(c, w / 2 - 1, 63, 3, 3, H(HYDRO.ink));
  rect(c, w / 2 - 8, 76, 16, 22, H(HYDRO.ink)); rect(c, w / 2 - 7, 77, 14, 20, "#3a3f46"); tiny(c, "FLUSH", w / 2, 91, "#f2c81e", 1, "center");
  // Rivets, and the tape.
  for (let x = 6; x < w; x += 16) { rect(c, x, 72, 2, 2, css(shade(body, 0.7))); rect(c, x, 72, 1, 1, css(shade(body, 1.3))); }
  for (let x = -h; x < w; x += 12) { c.fillStyle = H(HYDRO.ink); c.beginPath(); c.moveTo(x, h); c.lineTo(x + 6, h); c.lineTo(x + 16, h - 10); c.lineTo(x + 10, h - 10); c.closePath(); c.fill(); }
  rect(c, 0, h - 11, w, 1, H(HYDRO.ink));
}
function side(c: Ctx, w: number, h: number) {
  const body = hex(HYDRO.bodyDark);
  rect(c, 0, 0, w, h, css(body)); rect(c, 0, 0, w, 1, css(shade(body, 1.3)));
  for (let y = 10; y < h - 12; y += 9) rect(c, 6, y, w - 12, 2, css(shade(body, 0.6)));    // louvres
  rect(c, 3, 3, w - 6, 5, H(HYDRO.ink)); tiny(c, "NO", w / 2, 3, "#f2c81e", 1, "center");
  for (let x = -h; x < w; x += 12) { c.fillStyle = H(HYDRO.ink); c.beginPath(); c.moveTo(x, h); c.lineTo(x + 6, h); c.lineTo(x + 16, h - 10); c.lineTo(x + 10, h - 10); c.closePath(); c.fill(); }
}
function tonicCrate(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, "#7a1810"); rect(c, 0, 0, w, 3, "#d8452a"); rect(c, 0, h - 3, w, 3, "#a82a1a");
  for (let x = 1; x < w; x += 5) rect(c, x, 3, 3, h - 6, "#b8322a");
  rect(c, 4, 5, w - 8, h - 10, "#f4f0e0"); pixText(c, "ROCKET", w / 2, h / 2 + 4, 7, "#c8102e", { align: "center", maxW: w - 11 });
}
function dockPlate(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, "#d9dde2"); rect(c, 0, 0, w, 1, "#f4f6f8"); rect(c, 0, h - 1, w, 1, "#8f959c");
  plate(c, 3, 4, w - 6, 26, HYDRO.away, "VISITORS");
  pixText(c, "DRINKS", w / 2, 46, 10, H(HYDRO.ink), { align: "center", maxW: w - 8 });
  // The tap, and a drip that's been there all season.
  rect(c, w / 2 - 6, 54, 12, 5, H(HYDRO.ink)); rect(c, w / 2 - 2, 59, 4, 8, "#6f757c"); rect(c, w / 2 - 1, 70, 2, 3, "#58c8f0");
  for (let y = 80; y < h - 6; y += 5) rect(c, 5, y, w - 10, 1, "#aeb4ba");
}

export function buildHydro(w: World3D): void {
  if (!PACE.calm || !w.host.areas.some((a) => a.id === "pub_yard")) return;
  const sp = plantSpots(), a = w.atlas, leftHome = sp.home.x < sp.away.x, T = HYDRO.top, R = HYDRO.pipeR;
  const p = w.part("hydro"), { A } = p, { x0, x1, y0: z0, y1: z1, cx } = sp, zr = (z0 + z1) / 2;
  const rFront = a.paintM(x1 - x0, T - 0.12, (c, ww, h) => front(c, ww, h, leftHome), 2), rSide = a.paintM(z1 - z0, T - 0.12, side, 1);

  // The plinth and the body.
  A.box(x0 - 0.12, 0, z0 - 0.12, x1 + 0.12, 0.12, z1 + 0.14, col(0x8c8e8a, 0xa6a8a4));
  A.box(x0, 0.12, z0, x1, T, z1, { all: col(HYDRO.bodyDark), s: rFront, e: rSide, w: rSide, top: col(0xd8ac18) });
  A.box(x0 - 0.05, T, z0 - 0.05, x1 + 0.05, T + 0.07, z1 + 0.05, col(HYDRO.ink, 0x2a2d33));
  w.spec.ao.push([x0 - 0.12, z0 - 0.12, x1 + 0.12, z1 + 0.14, 1.6]);

  // A hopper under each plate, mouth open; the lever between them.
  for (const [h, c] of [[sp.home, HYDRO.home], [sp.away, HYDRO.away]] as const) {
    A.box(h.x - 0.34, 0.62, z1, h.x + 0.34, 0.98, z1 + 0.34, { all: col(shade3(c, 0.8), c), top: col(0x08090b) });
    A.box(h.x - 0.38, 0.94, z1, h.x + 0.38, 1.0, z1 + 0.38, { all: col(0xf4f4f0), top: col(0x08090b) });
    A.box(h.x - 0.1, 0.12, z1, h.x + 0.1, 0.62, z1 + 0.16, col(shade3(c, 0.6), shade3(c, 0.8)));
  }
  A.bar([cx, 0.62, z1 + 0.03], [cx, 0.98, z1 + 0.3], 0.07, col(0xb0b4ba));
  A.box(cx - 0.09, 0.93, z1 + 0.22, cx + 0.09, 1.11, z1 + 0.4, { all: col(0xc8102e, 0xe8452a), bot: col(0x8a0a1e) });

  // The crate of Rocket Tonic at its foot (the tin in it is the view's to draw, while there is one).
  { const rC = a.paintM(0.6, 0.32, tonicCrate, 1), c = sp.crate;
    A.box(c.x - 0.3, 0, c.y - 0.2, c.x + 0.3, 0.32, c.y + 0.2, { all: rC, top: col(0x3a0c08) });
    w.spec.ao.push([c.x - 0.3, c.y - 0.2, c.x + 0.3, c.y + 0.2, 0.6]); }

  // England's pipe: up out of the top, over the back and down (north, the way the stadium is).
  { const h = sp.home, l = sp.homeLeg, H1 = HYDRO.homeH;
    pipe(A, [h.x, T, zr], [h.x, H1, zr], R, HYDRO.pipeHome, HYDRO.home); elbow(A, h.x, H1, zr, R, HYDRO.home);
    pipe(A, [h.x, H1, zr - R], [l.x, H1, l.y + R], R, HYDRO.pipeHome, HYDRO.home); elbow(A, l.x, H1, l.y, R, HYDRO.home);
    pipe(A, [l.x, H1 - R, l.y], [l.x, 0, l.y], R, HYDRO.pipeHome, HYDRO.home);
    A.cyl(l.x, 0, 0.1, l.y, R + 0.16, 10, col(HYDRO.steel), col(0xa9afb6)); w.spec.ao.push([l.x - 0.4, l.y - 0.4, l.x + 0.4, l.y + 0.4, 1]); }
  // The visitors': up, over to the east and down (the way the hotel is).
  { const h = sp.away, l = sp.awayLeg, H1 = HYDRO.awayH, s = Math.sign(l.x - h.x) || 1;
    pipe(A, [h.x, T, zr], [h.x, H1, zr], R, HYDRO.away, 0xf4f4f0); elbow(A, h.x, H1, zr, R, HYDRO.away);
    pipe(A, [h.x + s * R, H1, zr], [l.x - s * R, H1, l.y], R, HYDRO.away, 0xf4f4f0); elbow(A, l.x, H1, l.y, R, HYDRO.away);
    pipe(A, [l.x, H1 - R, l.y], [l.x, 0, l.y], R, HYDRO.away, 0xf4f4f0);
    A.cyl(l.x, 0, 0.1, l.y, R + 0.16, 10, col(HYDRO.steel), col(0xa9afb6)); w.spec.ao.push([l.x - 0.4, l.y - 0.4, l.x + 0.4, l.y + 0.4, 1]); }
  w.finish(p, false);
  // Where each line runs on under the ground, sprayed on the surface the way the utilities do it: dashes and an arrow.
  { const M = (m: number) => Math.round(m * PXM), hl = sp.homeLeg, al = sp.awayLeg, s = Math.sign(al.x - sp.away.x) || 1;
    patch(w.spec, hl.x - 0.5, hl.y - 6.2, 1, 5.7, (c) => {
      c.fillStyle = "rgba(60,110,230,0.8)";
      for (let k = 0; k < 6; k++) c.fillRect(M(hl.x) - 2, M(hl.y - 1.2 - k * 0.8), 4, M(0.45));
      c.beginPath(); c.moveTo(M(hl.x), M(hl.y - 6.1)); c.lineTo(M(hl.x - 0.35), M(hl.y - 5.5)); c.lineTo(M(hl.x + 0.35), M(hl.y - 5.5)); c.closePath(); c.fill();
    });
    // (The visitors' as far as the shop next door: it goes on under that.)
    patch(w.spec, Math.min(al.x, al.x + s * 3.6), al.y - 0.5, 3.6, 1, (c) => {
      c.fillStyle = "rgba(226,50,60,0.8)";
      for (let k = 0; k < 3; k++) c.fillRect(Math.min(M(al.x + s * (0.75 + k * 0.8)), M(al.x + s * (1.2 + k * 0.8))), M(al.y) - 2, M(0.45), 4);
      c.beginPath(); c.moveTo(M(al.x + s * 3.6), M(al.y)); c.lineTo(M(al.x + s * 3.0), M(al.y - 0.35)); c.lineTo(M(al.x + s * 3.0), M(al.y + 0.35)); c.closePath(); c.fill();
    }); }

  // The hotel's dock: the visitors' line comes up out of the ground into a dispenser, with their crate under the tap.
  { const q = w.part("hydro-dock"), B = q.A, d = sp.dock, zb = d.y - 0.8, rP = a.paintM(1.1, 1.6, dockPlate, 2), s = sp.flip ? -1 : 1, px = d.x - s * 0.58, bx0 = Math.min(d.x - s * 0.4, d.x + s * 0.7), bx1 = Math.max(d.x - s * 0.4, d.x + s * 0.7), tap = d.x + s * 0.15;
    B.box(d.x - 0.7, 0, zb, d.x + 0.8, 0.1, d.y + 0.1, col(0x8c8e8a, 0xa6a8a4));
    B.box(bx0, 0.1, zb, bx1, 1.7, zb + 0.4, { all: col(0xaeb4ba, 0xd9dde2), s: rP, top: col(0xe4e8ec) });
    pipe(B, [px, 0, zb + 0.22], [px, 1.25, zb + 0.22], 0.14, HYDRO.away, 0xf4f4f0); B.box(px - 0.17, 1.08, zb + 0.05, px + 0.17, 1.42, zb + 0.39, col(HYDRO.away));
    B.box(Math.min(px, tap), 1.17, zb + 0.14, Math.max(px, tap), 1.33, zb + 0.3, col(HYDRO.away));
    B.cyl(px, 0, 0.08, zb + 0.22, 0.26, 10, col(HYDRO.steel), col(0xa9afb6));
    // their crate: blue, bottles in it
    const rB = a.paint(20, 10, (c, ww, h) => { rect(c, 0, 0, ww, h, "#1c3a6a"); rect(c, 0, 0, ww, 2, "#3f6ab0"); for (let x = 1; x < ww; x += 4) rect(c, x, 2, 2, h - 4, "#2f5a9a"); });
    const rT = a.paint(20, 14, (c, ww, h) => { rect(c, 0, 0, ww, h, "#12284a"); for (let y = 2; y < h - 2; y += 4) for (let x = 2; x < ww - 2; x += 4) { rect(c, x, y, 3, 3, "#e8f0f4"); rect(c, x + 1, y + 1, 1, 1, "#58c8f0"); } });
    B.box(tap - 0.33, 0.1, d.y - 0.36, tap + 0.33, 0.44, d.y + 0.04, { all: rB, top: rT });
    w.spec.ao.push([d.x - 0.7, zb, d.x + 0.8, d.y + 0.1, 1.2]);
    w.finish(q, false); }
}

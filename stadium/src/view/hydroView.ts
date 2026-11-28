// The hydration plant on screen (the sim's side is stadium/scheme_special.ts; the 3D model is three/hydro.ts).
// Here: what changes on it from moment to moment (the tin in the crate, a token sat in a hopper, the lump
// going up and over the pipe, the mark landing on the crate at the far end), its noises, and the whole of
// it drawn flat for when the 3D world is off. Read-only: nothing here changes the world.
import type Phaser from "phaser";
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import type { Projection } from "./projection";
import type { Paint3D } from "./three/gfx";
import { HYDRO } from "./three/hydro";
import { plantSpots, plantView, STAMP_SECS, type Pipe } from "../stadium/scheme_special";

/** What this file needs of the scene. */
interface Host {
  w: World; P: Projection; pc: Actor;
  stage: { paint(o: { mode?: "flat" | "up"; order?: number }): Paint3D } | null;
  add: Phaser.GameObjects.GameObjectFactory;
  audio: { play(name: any, volume?: number, opts?: { rate?: number; minGap?: number }): number };
  pcLine: { text: string; until: number } | null;
}
type G = Phaser.GameObjects.Graphics;
type P3 = { x: number; y: number; z: number };

const INK = 0x15171a;
/** A token, small and flat: the same five things as the icons, in a dozen rectangles. `u` is one art pixel. */
function glyph(g: G, def: string, x: number, y: number, u: number): void {
  const r = (c: number, dx: number, dy: number, w: number, h: number) => g.fillStyle(c, 1).fillRect(x + dx * u, y + dy * u, w * u, h * u);
  switch (def) {
    case "rocket_tonic": r(INK, -4, -9, 8, 18); r(0xd83424, -3, -7, 6, 14); r(0xc4c8ce, -3, -8, 6, 1.5); r(0xfaf0dc, -2, -3, 4, 6); r(0x283c96, -1, -2, 2, 3); r(0xff8c14, -1, 1, 2, 1.5); break;
    case "sleepy_syrup": r(INK, -4.5, -5, 9, 14); r(INK, -2.5, -10, 5, 6); r(0x683eaa, -3.5, -4, 7, 12); r(0xece8dc, -1.5, -9, 3, 3); r(0x683eaa, -1.5, -6, 3, 2); r(0xf4eede, -2.5, -1, 5, 6); r(0xf0be28, -1.5, 0, 2.5, 3.5); break;
    case "dodgy_electrolytes": r(INK, -6, -8, 12, 16); r(0x28beb8, -5, -7, 10, 14); r(0x168280, -5, -7, 10, 2); g.fillStyle(0xf6d628, 1).fillTriangle(x + 1.5 * u, y - 4 * u, x - 3 * u, y + 1 * u, x + 0.5 * u, y + 1 * u).fillTriangle(x - 0.5 * u, y - 0.5 * u, x + 3 * u, y - 0.5 * u, x - 1.5 * u, y + 5 * u); break;
    case "powder": r(INK, -6, -7, 12, 14); r(0xe8eaec, -5, -6, 10, 12); r(0xffffff, -4, -3, 8, 8); r(0xb8bcc2, -5, -6, 10, 1.5); break;
    default: g.fillStyle(INK, 1).fillEllipse(x, y + 3 * u, 15 * u, 11 * u).fillEllipse(x, y - 4 * u, 8 * u, 8 * u); g.fillStyle(0x5c3e1a, 1).fillEllipse(x, y + 3 * u, 13 * u, 9 * u); g.fillStyle(0x6c4a1e, 1).fillEllipse(x, y - 1 * u, 9 * u, 7 * u); g.fillStyle(0x7a5624, 1).fillEllipse(x, y - 4.5 * u, 5.5 * u, 5.5 * u); break;
  }
}

const lerp = (a: P3, b: P3, t: number): P3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
/** A point `t` (0..1) of the way along a run of straight legs. */
function along(pts: P3[], t: number): P3 {
  const len = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y, p.z - pts[i].z)), total = len.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < len.length; i++) { if (d <= len[i] || i === len.length - 1) return lerp(pts[i], pts[i + 1], len[i] ? Math.min(1, d / len[i]) : 0); d -= len[i]; }
  return pts[0];
}

interface Kit { g: G; p3: Paint3D | null; labels: Phaser.GameObjects.Text[]; for: unknown }
const kits = new WeakMap<object, Kit>();
/** The paint for it: in the 3D world while there is one, on this canvas when there isn't (and again if 3D is dropped mid-game). */
function kit(sc: Host): Kit {
  let k = kits.get(sc);
  if (k && k.for === sc.stage) return k;
  if (k) { if (!k.p3) k.g.destroy(); for (const t of k.labels) t.destroy(); }
  const p3 = sc.stage ? sc.stage.paint({ mode: "up", order: 5.3 }) : null;
  k = { g: p3 ? (p3 as unknown as G) : sc.add.graphics().setDepth(99), p3, labels: [], for: sc.stage };
  kits.set(sc, k);
  return k;
}

/** Each frame, once the world's drawn. */
export function drawHydro(sc: Host): void {
  const v = plantView(sc.w);
  if (!v) return;
  const { g, p3, labels } = kit(sc), P = sc.P, pc = sc.pc, sp = plantSpots(), now = performance.now(), u = P.S / 32;
  g.clear();
  const X = (p: P3) => P.sx(p.x, p.y), Y = (p: P3) => P.sy(p.x, p.y, p.z);
  const near = (p: { x: number; y: number }, r: number) => !!pc && Math.hypot(pc.x - p.x, pc.y - p.y) < r;
  const T = HYDRO.top, zr = (sp.y0 + sp.y1) / 2, mouth = (p: Pipe): P3 => ({ x: sp[p].x, y: sp.y1 + 0.17, z: 1.02 });
  const colOf = (p: Pipe) => (p === "home" ? HYDRO.home : HYDRO.away);

  // With no 3D world the whole plant is drawn here: flat colour, the same shapes.
  if (!p3) flat(sc, g, labels);

  if (near({ x: sp.cx, y: sp.y1 }, 40)) {
    // The free tin, stood in the crate while it's there.
    if (v.crate > 0) { p3?.at(sp.crate.x, sp.crate.y + 0.05, 0.06); glyph(g, "rocket_tonic", X({ ...sp.crate, z: 0 }), P.sy(sp.crate.x, sp.crate.y, 0.52), u * 0.8); }
    for (const p of ["home", "away"] as Pipe[]) {
      const pv = v.pipes[p], m = mouth(p);
      // Nobody's looking and he's close: the hoppers catch the light.
      if (!pv && !v.watched && near({ x: sp.cx, y: sp.y1 }, 6) && !pc.hiddenIn) { const k = 0.5 + 0.5 * Math.sin(now / 280); p3?.at(m.x, m.y + 0.2, 0.08); g.lineStyle(2 * u, 0xffd75a, 0.3 + 0.4 * k).strokeEllipse(X(m), Y(m) + 2 * u, (26 + k * 3) * u, (12 + k * 2) * u); }
      if (!pv) continue;
      // Loaded: the token sat in the mouth of the hopper, till the lump's set off with it.
      if (pv.since > 0.25) { p3?.at(m.x, m.y + 0.05, 0.06); glyph(g, pv.token, X(m), Y(m) - 5 * u, u * 0.7); }
      // The lump: up out of the top, over, and down into the ground.
      const leg = p === "home" ? sp.homeLeg : sp.awayLeg, H1 = p === "home" ? HYDRO.homeH : HYDRO.awayH;
      const run: P3[] = [{ x: sp[p].x, y: zr, z: T }, { x: sp[p].x, y: zr, z: H1 }, { x: leg.x, y: leg.y, z: H1 }, { x: leg.x, y: leg.y, z: 0.2 }];
      const t = (pv.since - 0.15) / 1.3;
      if (t > 0 && t < 1) {
        const q = along(run, t), wob = 1 + 0.12 * Math.sin(now / 45);
        p3?.at(q.x, q.y + 0.1, 0.45);
        g.fillStyle(INK, 1).fillEllipse(X(q), Y(q), 29 * u * wob, 27 * u / wob); g.fillStyle(colOf(p), 1).fillEllipse(X(q), Y(q), 25 * u * wob, 23 * u / wob); g.fillStyle(0xffffff, 0.55).fillEllipse(X(q) - 5 * u, Y(q) - 5 * u, 7 * u, 5 * u);
      }
    }
  }

  // The far ends: the visitors' crate on the hotel's dock, England's cooler in their dressing room.
  for (const p of ["away", "home"] as Pipe[]) {
    const pv = v.pipes[p], end = p === "home" ? sp.homeEnd : sp.dock, tapX = end.x + (sp.flip ? -0.15 : 0.15);
    if (!near(end, 45) && !(sc as unknown as { cine?: unknown }).cine) continue;
    const at: P3 = p === "home" ? { x: end.x, y: end.y + 0.3, z: 1.25 } : { x: tapX, y: end.y + 0.06, z: 0.3 };
    if (pv && p === "away" && pv.since < STAMP_SECS) {
      // It comes up the last of the pipe and along to the tap.
      const zb = end.y - 0.8, px = end.x - (sp.flip ? -0.58 : 0.58), t = (pv.since - (STAMP_SECS - 0.9)) / 0.9;
      if (t > 0) { const q = along([{ x: px, y: zb + 0.22, z: 0.1 }, { x: px, y: zb + 0.22, z: 1.25 }, { x: tapX, y: zb + 0.22, z: 1.25 }], t); p3?.at(q.x, q.y + 0.2, 0.3); g.fillStyle(INK, 1).fillEllipse(X(q), Y(q), 17 * u, 16 * u); g.fillStyle(HYDRO.away, 1).fillEllipse(X(q), Y(q), 14 * u, 13 * u); }
    }
    const mark = pv ? (pv.stamped ? pv.token : "") : v.got[p];
    if (!mark) continue;
    // The mark: lands with a bang, then stays on the crate for as long as that's what they're drinking.
    const age = pv ? pv.since - STAMP_SECS : 9, pop = age < 0.35 ? 1.9 - 0.9 * (age / 0.35) : 1, x = X(at), y = Y(at);
    p3?.at(at.x, at.y, 0.12);
    if (age < 0.5) { g.lineStyle(2.5 * u, 0xfff3c4, 1 - age * 2); for (let i = 0; i < 8; i++) { const an = (i * Math.PI) / 4 + 0.3, r0 = (12 + age * 30) * u, r1 = (18 + age * 44) * u; g.lineBetween(x + Math.cos(an) * r0, y + Math.sin(an) * r0, x + Math.cos(an) * r1, y + Math.sin(an) * r1); } }
    g.fillStyle(INK, 1).fillCircle(x, y, 10.5 * u * pop); g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 9 * u * pop);
    glyph(g, mark, x, y, u * 0.62 * pop);
  }
}

/** The plant with no 3D world to stand in: boxes and thick lines in its colours, and its three words. */
function flat(sc: Host, g: G, labels: Phaser.GameObjects.Text[]): void {
  const P = sc.P, sp = plantSpots(), S = P.S, T = HYDRO.top, zr = (sp.y0 + sp.y1) / 2;
  const sx = (x: number, y: number) => P.sx(x, y), sy = (x: number, y: number, z = 0) => P.sy(x, y, z);
  const box = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, front: number, top: number) => {
    g.fillStyle(top, 1).fillRect(sx(x0, y0), sy(x0, y0, z1), (x1 - x0) * S, sy(x0, y1, z1) - sy(x0, y0, z1));
    g.fillStyle(front, 1).fillRect(sx(x0, y1), sy(x0, y1, z1), (x1 - x0) * S, sy(x0, y1, z0) - sy(x0, y1, z1));
  };
  const pipe = (pts: P3[], c: number) => { for (const [w, k] of [[0.62, INK], [0.5, c]] as const) { g.lineStyle(w * S, k, 1).beginPath().moveTo(P.sx(pts[0].x, pts[0].y), P.sy(pts[0].x, pts[0].y, pts[0].z)); for (const q of pts.slice(1)) g.lineTo(P.sx(q.x, q.y), P.sy(q.x, q.y, q.z)); g.strokePath(); } };
  g.fillStyle(0x000000, 0.3).fillEllipse(sx(sp.cx, sp.y1), sy(sp.cx, sp.y1), (sp.x1 - sp.x0 + 0.6) * S, 0.7 * S);
  pipe([{ x: sp.home.x, y: zr, z: T }, { x: sp.home.x, y: zr, z: HYDRO.homeH }, { x: sp.homeLeg.x, y: sp.homeLeg.y, z: HYDRO.homeH }, { x: sp.homeLeg.x, y: sp.homeLeg.y, z: 0 }], HYDRO.pipeHome);
  pipe([{ x: sp.away.x, y: zr, z: T }, { x: sp.away.x, y: zr, z: HYDRO.awayH }, { x: sp.awayLeg.x, y: sp.awayLeg.y, z: HYDRO.awayH }, { x: sp.awayLeg.x, y: sp.awayLeg.y, z: 0 }], HYDRO.away);
  box(sp.x0, sp.y0, sp.x1, sp.y1, 0, T, HYDRO.body, 0xd8ac18);
  g.fillStyle(INK, 1).fillRect(sx(sp.x0, sp.y1), sy(sp.x0, sp.y1, T - 0.03), (sp.x1 - sp.x0) * S, 0.3 * S);
  const words: [string, number, number, number][] = [["HYDRATION", sp.cx, T - 0.18, 0], ["HOME", sp.home.x, 1.3, HYDRO.home], ["VISITORS", sp.away.x, 1.3, HYDRO.away]];
  for (const [h, c] of [[sp.home, HYDRO.home], [sp.away, HYDRO.away]] as const) {
    g.fillStyle(c, 1).fillRect(sx(h.x - 0.5, sp.y1), sy(h.x, sp.y1, 1.56), S, 0.5 * S);
    box(h.x - 0.34, sp.y1, h.x + 0.34, sp.y1 + 0.34, 0.62, 1.0, c, 0x08090b);
  }
  box(sp.crate.x - 0.3, sp.crate.y - 0.2, sp.crate.x + 0.3, sp.crate.y + 0.2, 0, 0.32, 0xb8322a, 0x3a0c08);
  // The hotel's dock.
  const d = sp.dock;
  box(d.x - 0.4, d.y - 0.8, d.x + 0.7, d.y - 0.4, 0, 1.7, 0xd9dde2, 0xe4e8ec);
  g.fillStyle(HYDRO.away, 1).fillRect(sx(d.x - 0.3, d.y - 0.4), sy(d.x, d.y - 0.4, 1.6), 0.9 * S, 0.4 * S);
  box(d.x - 0.18, d.y - 0.36, d.x + 0.48, d.y + 0.04, 0, 0.44, 0x2f5a9a, 0x12284a);
  words.push(["VISITORS", d.x + 0.15, 1.4, -1]);
  words.forEach(([text, x, z], i) => {
    let t = labels[i];
    if (!t) { t = sc.add.text(0, 0, text, { fontFamily: "system-ui, sans-serif", fontStyle: "bold", fontSize: "11px", color: "#ffffff" }).setOrigin(0.5, 0.5).setDepth(99.5).setResolution(2); labels[i] = t; }
    const yy = i === 3 ? d.y - 0.4 : sp.y1;
    t.setScale(S / 44).setPosition(Math.round(sx(x, yy)), Math.round(sy(x, yy, z)));
  });
}

/** The plant's noises (each once, and none of them loud), and what Grozz says about Ronson's contribution. */
export function hydroEvent(sc: Host, e: any): void {
  const a = sc.audio, later = (ms: number, f: () => void) => setTimeout(f, ms);
  switch (e.type) {
    case "special_in":
      // (The scene's own scheme handler taps as it goes in: that, a gulp, and one note when the mark lands.)
      later(300, () => a.play("gulp", 0.5));
      later(STAMP_SECS * 1000, () => a.play("detector_ok", 0.45));
      break;
    case "special_flush": a.play("drain", 0.45); break;
    case "special_take": a.play("pickup", 0.5); break;
    case "special_no": a.play("nope", 0.45); break;
    case "special_filth":
      if (sc.pc && Math.hypot(sc.pc.x - e.x, sc.pc.y - e.y) < 12) { a.play("fart", 0.4); sc.pcLine = { text: "Good lad. ...Don't waste that.", until: performance.now() + 2800 }; }
      break;
  }
}

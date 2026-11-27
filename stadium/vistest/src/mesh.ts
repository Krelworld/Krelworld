// A tiny geometry builder: quads and boxes with atlas UVs and vertex tints, all poured into one buffer.
import * as THREE from "three";
import type { Region } from "./paint";

export type V3 = [number, number, number];
export interface Face { r?: Region; c?: number; c2?: number; uv?: [number, number, number, number]; flip?: boolean }
export type FaceSpec = Region | Face | null | undefined;
export interface BoxFaces { all?: FaceSpec; s?: FaceSpec; e?: FaceSpec; n?: FaceSpec; w?: FaceSpec; top?: FaceSpec; bot?: FaceSpec; sides?: FaceSpec }

/** Heights are modelled in "screen metres": every y is multiplied by this (1/cos pitch) on the way out, so a metre of wall
 *  covers the same 32 px as a metre of sprite, and a facade painted at 32 px/m lands on screen pixel for pixel. */
export let YS = 1;
export const setYS = (k: number) => { YS = k; };

const isRegion = (f: FaceSpec): f is Region => !!f && (f as Region).w !== undefined && (f as Face).r === undefined && (f as Face).c === undefined;
const _c = new THREE.Color();

export class Builder {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = []; idx: number[] = [];
  private m: THREE.Matrix4 | null = null; private nm = new THREE.Matrix3();
  private v = new THREE.Vector3();
  constructor(private texW: number, private texH: number, private fallback: Region) {}

  /** Everything built until `end()` is placed at (x, y, z) and turned `rot` radians about Y. */
  at(x: number, y: number, z: number, rot = 0): this { this.m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z); this.nm.getNormalMatrix(this.m); return this; }
  xf(m: THREE.Matrix4): this { this.m = m.clone(); this.nm.getNormalMatrix(this.m); return this; }
  end(): this { this.m = null; return this; }

  private face(f: FaceSpec): Face { return !f ? { r: this.fallback } : isRegion(f) ? { r: f } : f; }

  private tp(p: V3): V3 {
    this.v.set(p[0], p[1], p[2]); if (this.m) this.v.applyMatrix4(this.m);
    return [this.v.x, this.v.y * YS, this.v.z];
  }
  private vert(p: V3, n: THREE.Vector3, u: number, v: number, c: number, a = 1) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    _c.setHex(c); this.col.push(_c.r, _c.g, _c.b, a);
  }

  /** a, b, c, d anticlockwise from the front: bottom-left, bottom-right, top-right, top-left. */
  quad(a: V3, b: V3, c: V3, d: V3, spec?: FaceSpec, o: { normal?: V3; double?: boolean; alpha?: number } = {}): this {
    const f = this.face(spec), r = f.r ?? this.fallback, SW = this.texW, SH = this.texH;
    const [fx0, fy0, fx1, fy1] = f.uv ?? [0, 0, 1, 1];
    // Half a texel in on flat swatches so they never bleed; exact edges on painted faces.
    const inset = r.w <= 8 && r.h <= 8 ? 2 : 0;
    let u0 = (r.x + inset + (r.w - inset * 2) * fx0) / SW, u1 = (r.x + inset + (r.w - inset * 2) * fx1) / SW;
    const vt = 1 - (r.y + inset + (r.h - inset * 2) * fy0) / SH, vb = 1 - (r.y + inset + (r.h - inset * 2) * fy1) / SH;
    if (f.flip) [u0, u1] = [u1, u0];
    a = this.tp(a); b = this.tp(b); c = this.tp(c); d = this.tp(d);
    const n = new THREE.Vector3();
    if (o.normal) n.set(o.normal[0], o.normal[1], o.normal[2]);
    else n.crossVectors(new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]));
    n.normalize();
    const c1 = f.c ?? 0xffffff, c2 = f.c2 ?? c1, i = this.pos.length / 3, al = o.alpha ?? 1;
    this.vert(a, n, u0, vb, c1, al); this.vert(b, n, u1, vb, c1, al); this.vert(c, n, u1, vt, c2, al); this.vert(d, n, u0, vt, c2, al);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    if (o.double) this.idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    return this;
  }

  tri(a: V3, b: V3, c: V3, spec: FaceSpec, uvs: [[number, number], [number, number], [number, number]]): this {
    const f = this.face(spec), r = f.r ?? this.fallback, SW = this.texW, SH = this.texH;
    a = this.tp(a); b = this.tp(b); c = this.tp(c);
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
    n.normalize();
    const i = this.pos.length / 3, col = f.c ?? 0xffffff;
    [a, b, c].forEach((p, k) => this.vert(p, n, (r.x + r.w * uvs[k][0]) / SW, 1 - (r.y + r.h * uvs[k][1]) / SH, col));
    this.idx.push(i, i + 1, i + 2);
    return this;
  }

  /** Axis-aligned box. Faces default to `all`; the underside is left off unless asked for. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, f: BoxFaces | Face | Region | number = {}): this {
    const isFaces = typeof f === "object" && f !== null && ["all", "s", "e", "n", "w", "top", "bot", "sides"].some((k) => k in (f as object));
    const F: BoxFaces = typeof f === "number" ? { all: { c: f } } : isFaces ? (f as BoxFaces) : Object.keys(f as object).length ? { all: f as FaceSpec } : {};
    const side = F.sides ?? F.all;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], F.s ?? side);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], F.e ?? side);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], F.n ?? side);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], F.w ?? side);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], F.top ?? F.all);
    if (F.bot) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], F.bot);
    return this;
  }

  /** Upright cylinder (or a cone/frustum with r1 != r0). `side` wraps once round; `top` caps it. */
  cyl(cx: number, y0: number, y1: number, cz: number, r0: number, segs: number, side: FaceSpec, top?: FaceSpec, r1 = r0): this {
    const sf = this.face(side);
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const p = (a: number, r: number, y: number): V3 => [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r];
      const [fx0, fy0, fx1, fy1] = sf.uv ?? [0, 0, 1, 1];
      this.quad(p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y1), p(a0, r1, y1), { ...sf, uv: [fx0 + ((fx1 - fx0) * i) / segs, fy0, fx0 + ((fx1 - fx0) * (i + 1)) / segs, fy1] });
    }
    if (top) {
      const tf = this.face(top), r = tf.r ?? this.fallback;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
        const uvp = (a: number): [number, number] => (r.w <= 8 ? [0.5, 0.5] : [0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5]);
        this.tri([cx, y1, cz], [cx + Math.sin(a0) * r1, y1, cz + Math.cos(a0) * r1], [cx + Math.sin(a1) * r1, y1, cz + Math.cos(a1) * r1], tf, [[0.5, 0.5], uvp(a0), uvp(a1)]);
      }
    }
    return this;
  }

  /** A square-section bar from p to q (for ladder rails, brackets, washing lines). */
  bar(p: V3, q: V3, t: number, spec: FaceSpec): this {
    const d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]), len = d.length();
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, Math.abs(d.y) > 0.95 * len ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    m.setPosition((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
    const prev = this.m, prevN = this.nm.clone();
    this.m = prev ? prev.clone().multiply(m) : m; this.nm.getNormalMatrix(this.m);
    this.box(-t / 2, -t / 2, -len / 2, t / 2, t / 2, len / 2, { all: spec, bot: spec });
    this.m = prev; this.nm.copy(prevN);
    return this;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  get tris(): number { return this.idx.length / 3; }
}

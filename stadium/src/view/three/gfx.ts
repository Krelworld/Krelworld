// Paint3D: the handful of Phaser Graphics calls the scene uses for marks that belong to the world
// (rings and pools on the ground, hats and masks and stars on people, rubble, smoke), re-drawn as flat
// colour triangles inside the Three world. Same calls, same pixel coordinates, so the scene's drawing
// code runs unchanged; what differs is where the paint lands: flat on the ground under everyone's feet,
// or stood up at a depth so walls and people hide it the way they hide the body it belongs to.
import * as THREE from "three";
import { CY, PX_PER_M, SP, STRETCH, SY } from "./cam";

const S = PX_PER_M;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = lin(i / 255);

export interface PaintOpts {
  /** Draw order among the see-through layers. */ order?: number;
  /** Kept from frame to frame until clear() (the blood on the floor). */ persistent?: boolean;
  /** Drop black fills (the 2D shadow blobs: here the shadows are real). */ dropBlack?: boolean;
  /** Where paint lands until told otherwise. */ mode?: "flat" | "up";
  /** Not hidden by anything (a mark you must always be able to see). */ always?: boolean;
}

export class Paint3D {
  mesh: THREE.Mesh; private geo = new THREE.BufferGeometry(); private mat: THREE.MeshBasicMaterial;
  private pos = new Float32Array(0); private col = new Float32Array(0); private n = 0; private cap = 0; private dirty = false;
  private fr = 1; private fg = 1; private fb = 1; private fa = 1; private fBlack = false;
  private lr = 1; private lg = 1; private lb = 1; private la = 1; private lw = 1;
  private flatMode: boolean; private w0: number | null = null; private hint: number | null = null; private bias = 0; private lift = 0.03;
  private path: number[] = []; private subStart = 0; private closed = false;
  readonly persistent: boolean; private dropBlack: boolean; private defFlat: boolean;
  /** Triangles this frame. */
  get tris(): number { return this.n / 3; }

  constructor(o: PaintOpts = {}) {
    this.persistent = !!o.persistent; this.dropBlack = !!o.dropBlack; this.defFlat = (o.mode ?? "flat") === "flat"; this.flatMode = this.defFlat;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: !o.always, side: THREE.DoubleSide, fog: false, toneMapped: false });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.matrixAutoUpdate = false; this.mesh.renderOrder = o.order ?? 3; this.mesh.visible = false;
    this.grow(256);
  }
  private grow(cap: number) {
    const p = new Float32Array(cap * 3), c = new Float32Array(cap * 4);
    p.set(this.pos.subarray(0, this.n * 3)); c.set(this.col.subarray(0, this.n * 4));
    this.pos = p; this.col = c; this.cap = cap;
    this.geo.dispose(); this.geo = new THREE.BufferGeometry();
    const dyn = (a: Float32Array, k: number) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); return b; };
    this.geo.setAttribute("position", dyn(p, 3)); this.geo.setAttribute("color", dyn(c, 4));
    this.mesh.geometry = this.geo;
  }

  // ---- Where the paint goes ----
  /** On the ground (`lift` metres up, so layers of it don't fight). */
  flat(lift = 0.03): this { this.flatMode = true; this.lift = lift; return this; }
  /** Stood up facing the camera where (x, y) is on the ground; anything that would hang below the ground lies on it.
   *  With no x, it stands at world depth y wherever each mark is across the screen. `bias` brings it toward the camera. */
  at(x: number | undefined, y: number, bias = 0.04): this {
    this.flatMode = false; this.bias = bias;
    if (x === undefined) { this.w0 = null; this.hint = y; } else { this.w0 = SY * x + CY * y + bias; this.hint = null; }
    return this;
  }

  // ---- The Graphics calls ----
  clear(): this { this.n = 0; this.dirty = true; this.flatMode = this.defFlat; this.w0 = null; this.hint = null; this.lift = 0.03; this.path.length = 0; return this; }
  setVisible(): this { return this; }
  setDepth(): this { return this; }
  setAlpha(): this { return this; }
  fillStyle(c: number, a = 1): this { this.fr = LUT[(c >> 16) & 255]; this.fg = LUT[(c >> 8) & 255]; this.fb = LUT[c & 255]; this.fa = a; this.fBlack = (c & 0xffffff) === 0; return this; }
  lineStyle(w: number, c: number, a = 1): this { this.lw = w; this.lr = LUT[(c >> 16) & 255]; this.lg = LUT[(c >> 8) & 255]; this.lb = LUT[c & 255]; this.la = a; return this; }

  private X = 0; private Y = 0; private Z = 0; private pw = 0;
  /** Fix the plane for one mark (from its first point, when no anchor was given). */
  private plane(px: number) { this.pw = this.w0 !== null ? this.w0 : this.hint !== null ? (SY * (px / S) + this.hint) / CY + this.bias : 0; }
  private map(px: number, py: number) {
    const u = px / S, vS = py / S;
    let w: number, z: number;
    if (this.flatMode) { w = vS / SP; z = this.lift; }
    else { w = this.pw; z = SP * w - vS; if (z < 0.02) { z = 0.035; w = vS / SP; } else z *= STRETCH; }
    this.X = CY * u + SY * w; this.Y = z; this.Z = -SY * u + CY * w;
  }
  private v(px: number, py: number, r: number, g: number, b: number, a: number) {
    if (this.n === this.cap) this.grow(this.cap * 2);
    this.map(px, py);
    const i = this.n++, p = this.pos, c = this.col;
    p[i * 3] = this.X; p[i * 3 + 1] = this.Y; p[i * 3 + 2] = this.Z;
    c[i * 4] = r; c[i * 4 + 1] = g; c[i * 4 + 2] = b; c[i * 4 + 3] = a;
  }
  private tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, line = false) {
    if (line) { const r = this.lr, g = this.lg, b = this.lb, a = this.la; this.v(x0, y0, r, g, b, a); this.v(x1, y1, r, g, b, a); this.v(x2, y2, r, g, b, a); }
    else { const r = this.fr, g = this.fg, b = this.fb, a = this.fa; this.v(x0, y0, r, g, b, a); this.v(x1, y1, r, g, b, a); this.v(x2, y2, r, g, b, a); }
    this.dirty = true;
  }
  private skip(): boolean { return this.fa <= 0.004 || (this.dropBlack && this.fBlack); }

  fillRect(x: number, y: number, w: number, h: number): this {
    if (this.skip()) return this;
    this.plane(x + w / 2);
    this.tri(x, y + h, x + w, y + h, x + w, y); this.tri(x, y + h, x + w, y, x, y);
    return this;
  }
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this {
    if (this.skip()) return this;
    this.plane((x0 + x1 + x2) / 3); this.tri(x0, y0, x1, y1, x2, y2);
    return this;
  }
  private segs(r: number): number { return Math.max(8, Math.min(28, Math.ceil(r * 0.9) + 6)); }
  fillEllipse(x: number, y: number, w: number, h: number): this {
    if (this.skip()) return this;
    const rx = w / 2, ry = h / 2, n = this.segs(Math.max(rx, ry));
    this.plane(x);
    let ax = x + rx, ay = y;
    for (let i = 1; i <= n; i++) { const t = (i / n) * Math.PI * 2, bx = x + Math.cos(t) * rx, by = y + Math.sin(t) * ry; this.tri(x, y, ax, ay, bx, by); ax = bx; ay = by; }
    return this;
  }
  fillCircle(x: number, y: number, r: number): this { return this.fillEllipse(x, y, r * 2, r * 2); }
  fillRoundedRect(x: number, y: number, w: number, h: number, r: number | { tl?: number } = 0): this {
    if (this.skip()) return this;
    let q = Math.min(typeof r === "number" ? r : r.tl ?? 0, w / 2, h / 2);
    if (q < 0.75) return this.fillRect(x, y, w, h);
    const pts: number[] = [], arc = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 3; i++) { const t = a0 + (i / 3) * (Math.PI / 2); pts.push(cx + Math.cos(t) * q, cy + Math.sin(t) * q); } };
    arc(x + w - q, y + h - q, 0); arc(x + q, y + h - q, Math.PI / 2); arc(x + q, y + q, Math.PI); arc(x + w - q, y + q, Math.PI * 1.5);
    this.plane(x + w / 2); this.fan(pts, false);
    q = 0; return this;
  }
  private fan(pts: number[], line: boolean) { for (let i = 2; i + 3 < pts.length; i += 2) this.tri(pts[0], pts[1], pts[i], pts[i + 1], pts[i + 2], pts[i + 3], line); }
  fillPoints(points: { x: number; y: number }[]): this {
    if (this.skip() || points.length < 3) return this;
    const pts: number[] = []; let mx = 0;
    for (const p of points) { pts.push(p.x, p.y); mx += p.x; }
    this.plane(mx / points.length); this.fan(pts, false);
    return this;
  }

  /** A stroke from a to b, `lw` wide. */
  private seg(x0: number, y0: number, x1: number, y1: number) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 1e-6) return;
    const hw = Math.max(0.5, this.lw) / 2, nx = (-dy / l) * hw, ny = (dx / l) * hw;
    this.tri(x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, true); this.tri(x0 + nx, y0 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny, true);
  }
  lineBetween(x0: number, y0: number, x1: number, y1: number): this {
    if (this.la <= 0.004) return this;
    this.plane((x0 + x1) / 2); this.seg(x0, y0, x1, y1);
    return this;
  }
  strokeEllipse(x: number, y: number, w: number, h: number): this {
    if (this.la <= 0.004) return this;
    const rx = w / 2, ry = h / 2, n = this.segs(Math.max(rx, ry)) + 6, hw = Math.max(0.5, this.lw) / 2;
    this.plane(x);
    // A band between two ellipses: no gaps at the joints.
    let c0 = 1, s0 = 0;
    for (let i = 1; i <= n; i++) {
      const t = (i / n) * Math.PI * 2, c1 = Math.cos(t), s1 = Math.sin(t);
      const ax = x + c0 * (rx + hw), ay = y + s0 * (ry + hw), bx = x + c1 * (rx + hw), by = y + s1 * (ry + hw), cx = x + c1 * (rx - hw), cy = y + s1 * (ry - hw), dx = x + c0 * (rx - hw), dy = y + s0 * (ry - hw);
      this.tri(ax, ay, bx, by, cx, cy, true); this.tri(ax, ay, cx, cy, dx, dy, true);
      c0 = c1; s0 = s1;
    }
    return this;
  }
  strokeCircle(x: number, y: number, r: number): this { return this.strokeEllipse(x, y, r * 2, r * 2); }
  strokeRect(x: number, y: number, w: number, h: number): this {
    if (this.la <= 0.004) return this;
    this.plane(x + w / 2);
    this.seg(x, y, x + w, y); this.seg(x + w, y, x + w, y + h); this.seg(x + w, y + h, x, y + h); this.seg(x, y + h, x, y);
    return this;
  }
  strokePoints(points: { x: number; y: number }[], close = false): this {
    if (this.la <= 0.004 || points.length < 2) return this;
    this.plane(points[0].x);
    for (let i = 0; i + 1 < points.length; i++) this.seg(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    if (close) this.seg(points[points.length - 1].x, points[points.length - 1].y, points[0].x, points[0].y);
    return this;
  }
  // Paths (one sub-path at a time is all the scene uses).
  beginPath(): this { this.path.length = 0; this.closed = false; this.subStart = 0; return this; }
  moveTo(x: number, y: number): this { this.path.length = 0; this.path.push(x, y); this.closed = false; return this; }
  lineTo(x: number, y: number): this { this.path.push(x, y); return this; }
  arc(x: number, y: number, r: number, a0: number, a1: number, anticlockwise = false): this {
    let d = a1 - a0;
    if (anticlockwise) { while (d > 0) d -= Math.PI * 2; } else while (d < 0) d += Math.PI * 2;
    const n = Math.max(4, Math.ceil((Math.abs(d) / (Math.PI * 2)) * (this.segs(r) + 6)));
    for (let i = 0; i <= n; i++) { const t = a0 + (d * i) / n; this.path.push(x + Math.cos(t) * r, y + Math.sin(t) * r); }
    return this;
  }
  closePath(): this { this.closed = true; return this; }
  strokePath(): this {
    const p = this.path;
    if (this.la <= 0.004 || p.length < 4) return this;
    this.plane(p[0]);
    for (let i = 0; i + 3 < p.length; i += 2) this.seg(p[i], p[i + 1], p[i + 2], p[i + 3]);
    if (this.closed) this.seg(p[p.length - 2], p[p.length - 1], p[0], p[1]);
    return this;
  }
  fillPath(): this {
    const p = this.path;
    if (this.skip() || p.length < 6) return this;
    this.plane(p[0]); this.fan(p, false);
    return this;
  }

  /** Send what was drawn this frame to the card. */
  flush(): void {
    this.mesh.visible = this.n > 0;
    if (!this.dirty) return;
    this.dirty = false;
    this.geo.setDrawRange(0, this.n);
    for (const k of ["position", "color"]) { const at = this.geo.getAttribute(k) as THREE.BufferAttribute; at.clearUpdateRanges(); at.addUpdateRange(0, this.n * at.itemSize); at.needsUpdate = true; }
  }
  dispose(): void { this.geo.dispose(); this.mat.dispose(); this.mesh.removeFromParent(); }
}

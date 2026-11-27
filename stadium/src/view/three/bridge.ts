// The sprite bridge. The Phaser scene still decides, every frame, what each person, prop, item and
// vehicle looks like (texture, frame, flip, tint, crop, position); here those pictures are copied on
// to upright quads in the Three world, so they are hidden by walls and by each other like anything
// else in it. One dynamic buffer per source image.
import * as THREE from "three";
import { CY, PX_PER_M, SP, STRETCH, SY } from "./cam";

const S = PX_PER_M;
const VERT = `attribute vec4 aCol; attribute float aFill; varying vec2 vUv; varying vec4 vCol; varying float vFill;
void main(){ vUv = uv; vCol = aCol; vFill = aFill; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform sampler2D map; uniform float cut; uniform vec4 wash; varying vec2 vUv; varying vec4 vCol; varying float vFill;
void main(){ vec4 t = texture2D(map, vUv); if (t.a < cut) discard;
  vec3 c = mix(t.rgb * vCol.rgb, vCol.rgb, vFill); c = mix(c, wash.rgb, wash.a);
  gl_FragColor = vec4(c, vCol.a * (cut > 0.4 ? 1.0 : t.a));
  #include <colorspace_fragment>
}`;

/** What the bridge needs of a Phaser Image or Sprite (kept structural, so this file does not pull Phaser in). */
export interface Pic {
  x: number; y: number; depth: number; alpha: number; rotation: number; scaleX: number; scaleY: number; originX: number; originY: number; flipX: boolean;
  tintTopLeft: number; tintMode?: number; tintFill?: boolean; isCropped?: boolean; _crop?: { x: number; y: number; width: number; height: number };
  frame: { cutX: number; cutY: number; cutWidth: number; cutHeight: number; source: { image: unknown; width: number; height: number } };
}
export interface PicOpts {
  /** The world y it stands at (else the scene's draw-order hint). */ hintY?: number;
  /** Lies on the ground. */ flat?: boolean;
  /** Stands along a wall (parallel to the world's x axis) rather than turned to face the camera: doors, booths, boards. */ wall?: boolean;
  /** Too far off (or too small on screen) to be worth a real shadow: one draw call saved per sheet. */ noShadow?: boolean;
  slide?: boolean; ghost?: boolean; dim?: number; lift?: number;
}

class Batch {
  geo = new THREE.BufferGeometry(); mesh: THREE.Mesh; n = 0; cap = 0; used = 0; tex: THREE.Texture | null = null;
  pos!: Float32Array; uv!: Float32Array; col!: Float32Array; fill!: Float32Array;
  constructor(public mat: THREE.ShaderMaterial, depthMat: THREE.Material | null, order: number) {
    this.mesh = new THREE.Mesh(this.geo, mat); this.mesh.frustumCulled = false; this.mesh.matrixAutoUpdate = false; this.mesh.renderOrder = order;
    if (depthMat) { this.mesh.castShadow = true; this.mesh.customDepthMaterial = depthMat; }
    this.grow(16);
  }
  grow(cap: number) {
    const old = { pos: this.pos, uv: this.uv, col: this.col, fill: this.fill };
    this.cap = cap; this.pos = new Float32Array(cap * 12); this.uv = new Float32Array(cap * 8); this.col = new Float32Array(cap * 16); this.fill = new Float32Array(cap * 4);
    if (old.pos) { this.pos.set(old.pos); this.uv.set(old.uv); this.col.set(old.col); this.fill.set(old.fill); }
    this.geo.dispose(); this.geo = new THREE.BufferGeometry();
    const dyn = (a: Float32Array, k: number) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); return b; };
    this.geo.setAttribute("position", dyn(this.pos, 3)); this.geo.setAttribute("uv", dyn(this.uv, 2)); this.geo.setAttribute("aCol", dyn(this.col, 4)); this.geo.setAttribute("aFill", dyn(this.fill, 1));
    const idx = new Uint32Array(cap * 6);
    for (let i = 0; i < cap; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh.geometry = this.geo;
  }
  /** Corners bottom-left, bottom-right, top-right, top-left (xyz each), with their UVs. */
  quad(p: number[], u0: number, v0: number, u1: number, v1: number, r: number, g: number, b: number, a: number, fill: number) {
    if (this.n === this.cap) this.grow(this.cap * 2);
    const i = this.n++;
    this.pos.set(p, i * 12);
    const uv = this.uv, col = this.col, j = i * 8;
    uv[j] = u0; uv[j + 1] = v0; uv[j + 2] = u1; uv[j + 3] = v0; uv[j + 4] = u1; uv[j + 5] = v1; uv[j + 6] = u0; uv[j + 7] = v1;
    for (let k = 0, q = i * 16; k < 4; k++, q += 4) { col[q] = r; col[q + 1] = g; col[q + 2] = b; col[q + 3] = a; this.fill[i * 4 + k] = fill; }
  }
  flush(frame: number) {
    this.mesh.visible = this.n > 0;
    if (!this.n) return;
    this.used = frame;
    this.geo.setDrawRange(0, this.n * 6);
    for (const k of ["position", "uv", "aCol", "aFill"]) { const at = this.geo.getAttribute(k) as THREE.BufferAttribute; at.clearUpdateRanges(); at.addUpdateRange(0, this.n * 4 * at.itemSize); at.needsUpdate = true; }
  }
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export class SpriteBridge {
  group = new THREE.Group();
  private tex = new Map<unknown, THREE.Texture>();
  /** Small pictures gathered on to one sheet (so all the props are one draw call): where each one went. */
  private sub = new Map<unknown, { t: THREE.Texture; x: number; y: number; W: number; H: number }>();
  private batches = new Map<string, Batch>();
  private hints = new Map<number, number>();
  private frame = 0;
  /** Phaser's "fill with the tint" mode. */
  fillMode = 1;
  quads = 0;
  /** A cool wash over every sprite (so the pixel art sits in the overcast light with the painted town). */
  wash = new THREE.Vector4(0.62, 0.68, 0.76, 0.0);

  begin() { this.frame++; this.hints.clear(); this.quads = 0; for (const b of this.batches.values()) b.n = 0; }
  /** The draw order a thing was given this frame, and the world y it sorts by. */
  note(order: number, d: number) { this.hints.set(order, d); }
  hintFor(depth: number): number | undefined { return this.hints.get(Math.floor(depth + 0.6)); }

  texture(image: unknown): THREE.Texture | null {
    let t = this.tex.get(image);
    if (t) return t;
    if (!image || !((image as HTMLImageElement).width > 0)) return null;
    t = new THREE.Texture(image as HTMLImageElement);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    this.tex.set(image, t);
    return t;
  }
  /** Gather these pictures on to one sheet. Anything that does not fit keeps a texture of its own. */
  pack(images: (HTMLImageElement | HTMLCanvasElement)[], width = 2048, maxH = 4096): number {
    const list = images.filter((im) => im && im.width > 0 && im.width <= 512 && im.height <= 512 && !this.sub.has(im) && !this.tex.has(im)).sort((a, b) => b.height - a.height);
    if (!list.length) return 0;
    const place: { im: HTMLImageElement | HTMLCanvasElement; x: number; y: number }[] = [];
    let x = 1, y = 1, rowH = 0;
    for (const im of list) {
      if (x + im.width + 1 > width) { x = 1; y += rowH + 2; rowH = 0; }
      if (y + im.height + 1 > maxH) continue;
      place.push({ im, x, y }); x += im.width + 2; rowH = Math.max(rowH, im.height);
    }
    const H = Math.min(maxH, 2 ** Math.ceil(Math.log2(y + rowH + 2)));
    const cv = document.createElement("canvas"); cv.width = width; cv.height = H;
    const c = cv.getContext("2d")!; c.imageSmoothingEnabled = false;
    for (const q of place) c.drawImage(q.im, q.x, q.y);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    for (const q of place) this.sub.set(q.im, { t, x: q.x, y: q.y, W: width, H });
    return place.length;
  }
  /** A picture the game has repainted (a sign, a recoloured sheet): send it to the card again. */
  refresh(image: unknown) { const t = this.tex.get(image); if (t) t.needsUpdate = true; }

  private texUsed = new Map<THREE.Texture, number>();
  private P: number[] = new Array(12).fill(0);
  private batch(t: THREE.Texture, kind: "solid" | "plain" | "soft" | "ghost"): Batch {
    this.texUsed.set(t, this.frame);
    const key = `${t.id}:${kind}`;
    let b = this.batches.get(key);
    if (!b) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: t }, cut: { value: kind === "soft" ? 0.02 : 0.5 }, wash: { value: kind === "ghost" ? new THREE.Vector4(0, 0, 0, 0) : this.wash } },
        vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
        transparent: kind === "soft" || kind === "ghost", depthWrite: kind === "solid" || kind === "plain", depthFunc: kind === "ghost" ? THREE.GreaterDepth : THREE.LessEqualDepth,
      });
      const dm = kind === "solid" ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5, side: THREE.DoubleSide }) : null;
      b = new Batch(mat, dm, kind === "solid" || kind === "plain" ? 0 : kind === "soft" ? 6 : 7);
      b.tex = t;
      this.batches.set(key, b); this.group.add(b.mesh);
    }
    return b;
  }

  /** Copy one Phaser picture into the world. */
  sprite(o: Pic, opt: PicOpts = {}): void {
    const fr = o.frame, sub = this.sub.get(fr.source.image), t = sub ? sub.t : this.texture(fr.source.image);
    if (!t || o.alpha <= 0.01) return;
    // The part of the image shown, in its own pixels, and where that sits relative to the origin.
    let cx = fr.cutX, cyy = fr.cutY, cw = fr.cutWidth, ch = fr.cutHeight, offX = 0, offY = 0;
    const fw = fr.cutWidth, fh = fr.cutHeight;
    if (o.isCropped && o._crop) { const c = o._crop; offX = c.x; offY = c.y; cx += c.x; cyy += c.y; cw = c.width; ch = c.height; }
    if (cw <= 0 || ch <= 0) return;
    if (sub) { cx += sub.x; cyy += sub.y; }
    const W = sub ? sub.W : fr.source.width, H = sub ? sub.H : fr.source.height;
    let u0 = cx / W, u1 = (cx + cw) / W;
    const vT = 1 - cyy / H, vB = 1 - (cyy + ch) / H;
    const sxk = o.scaleX, syk = o.scaleY;
    let x0 = (-o.originX * fw + offX) * sxk, x1 = (-o.originX * fw + offX + cw) * sxk;
    if (o.flipX) { [u0, u1] = [u1, u0]; const a = (-o.originX * fw + (fw - offX - cw)) * sxk, b = (-o.originX * fw + (fw - offX)) * sxk; x0 = a; x1 = b; }
    const yT = (-o.originY * fh + offY) * syk, yB = (-o.originY * fh + offY + ch) * syk;
    // Colour.
    const fillTint = o.tintMode !== undefined ? o.tintMode === this.fillMode : !!o.tintFill;
    const tc = o.tintTopLeft ?? 0xffffff, dim = opt.dim ?? 1;
    const r = lin(((tc >> 16) & 255) / 255) * (fillTint ? 1 : dim), g = lin(((tc >> 8) & 255) / 255) * (fillTint ? 1 : dim), b = lin((tc & 255) / 255) * (fillTint ? 1 : dim);
    const soft = o.alpha < 0.98;
    const B = this.batch(t, soft ? "soft" : opt.noShadow || opt.flat ? "plain" : "solid");
    // Where it stands: a point on the ray through its screen position, fixed by the world y it sorts at.
    const u = o.x / S, vS = o.y / S;
    const hint = opt.hintY ?? this.hintFor(o.depth);
    let w: number, z: number;
    if (hint !== undefined && !opt.flat) { w = (SY * u + hint) / CY; z = SP * w - vS; if (z < 0) { z = 0; w = vS / SP; } }
    else { z = 0; w = vS / SP; }
    const bias = opt.lift ?? (o.depth - Math.round(o.depth));
    if (!opt.flat && bias) { w += bias; z += SP * bias; }
    const rot = o.rotation, lying = Math.abs(Math.sin(rot)) > 0.62;
    const P = this.P;
    const up = (dx: number, dy: number, k: number) => { P[k] = CY * (u + dx / S) + SY * w; P[k + 1] = (z - dy / S) * STRETCH; P[k + 2] = -SY * (u + dx / S) + CY * w; };
    const lie = (dx: number, dy: number, k: number, y: number, w0: number) => { const uu = u + dx / S, ww = w0 + dy / S / SP; P[k] = CY * uu + SY * ww; P[k + 1] = y; P[k + 2] = -SY * uu + CY * ww; };
    const a = soft ? o.alpha : 1, fl = fillTint ? 1 : 0;
    if (opt.wall && !opt.flat) {
      // Along a wall: the picture stands in the plane of the wall it belongs to, and leans with it on screen.
      const X = CY * u + SY * w, Z = -SY * u + CY * w + 0.02;
      const wl = (dx: number, dy: number, k: number) => { P[k] = X + dx / S; P[k + 1] = Math.max(0, z - dy / S) * STRETCH; P[k + 2] = Z; };
      wl(x0, yB, 0); wl(x1, yB, 3); wl(x1, yT, 6); wl(x0, yT, 9);
      B.quad(P, u0, vB, u1, vT, r, g, b, a, fl); this.quads++;
      return;
    }
    if (opt.flat || lying) {
      // On the ground (litter, a puddle, a body): a decal, every corner where the screen says it is.
      const c = Math.cos(rot), s = Math.sin(rot), w0 = vS / SP, y = 0.03 + (opt.flat ? 0 : 0.03);
      const pt = (lx: number, ly: number, k: number) => lie(lx * c - ly * s, lx * s + ly * c, k, y, w0);
      pt(x0, yB, 0); pt(x1, yB, 3); pt(x1, yT, 6); pt(x0, yT, 9);
      B.quad(P, u0, vB, u1, vT, r, g, b, a, fl); this.quads++;
      return;
    }
    if (Math.abs(rot) > 0.005) {
      // Tilted but standing: turn it in the plane of the screen, and stand its lowest corner on the ground.
      const c = Math.cos(rot), s = Math.sin(rot), cs: [number, number][] = [[x0, yB], [x1, yB], [x1, yT], [x0, yT]].map(([lx, ly]) => [lx * c - ly * s, lx * s + ly * c]);
      const low = Math.max(...cs.map((q) => q[1])) / S;
      if (low > z) { z = low; w = (vS + z) / SP; }
      cs.forEach((q, i) => up(q[0], q[1], i * 3));
      B.quad(P, u0, vB, u1, vT, r, g, b, a, fl); this.quads++;
      if (opt.ghost) this.batch(t, "ghost").quad(P, u0, vB, u1, vT, 0.5, 0.75, 1, 0.42, 1);
      return;
    }
    // Upright. Whatever hangs below the ground line either slides the picture toward the camera a touch
    // (a few pixels of boot), or is laid on the ground in front (the near half of a van).
    const fold = z * S;
    if (yB > fold + 0.5 && (opt.slide || yB - fold <= 8)) { z = yB / S; w = (vS + z) / SP; }
    if (yB <= z * S + 0.5) {
      up(x0, yB, 0); up(x1, yB, 3); up(x1, yT, 6); up(x0, yT, 9);
      B.quad(P, u0, vB, u1, vT, r, g, b, a, fl); this.quads++;
      if (opt.ghost) this.batch(t, "ghost").quad(P, u0, vB, u1, vT, 0.5, 0.75, 1, 0.42, 1);
      return;
    }
    const vF = vT + ((fold - yT) / (yB - yT)) * (vB - vT);
    if (fold > yT) {
      up(x0, fold, 0); up(x1, fold, 3); up(x1, yT, 6); up(x0, yT, 9);
      B.quad(P, u0, vF, u1, vT, r, g, b, a, fl); this.quads++;
      if (opt.ghost) this.batch(t, "ghost").quad(P, u0, vF, u1, vT, 0.5, 0.75, 1, 0.42, 1);
    }
    const yF = Math.max(fold, yT), vF2 = fold > yT ? vF : vT;
    lie(x0, yB - fold, 0, 0.04, w); lie(x1, yB - fold, 3, 0.04, w); lie(x1, yF - fold, 6, 0.04, w); lie(x0, yF - fold, 9, 0.04, w);
    B.quad(P, u0, vB, u1, vF2, r, g, b, a, fl); this.quads++;
  }

  /** An upright picture from any image (the ball, a marker): centred on (x, y), its base `z` metres up. */
  upright(image: unknown, x: number, y: number, z: number, wM: number, hM: number, tint = 0xffffff): void {
    const t = this.texture(image); if (!t) return;
    const B = this.batch(t, "solid"), u = CY * x - SY * y, w = SY * x + CY * y, P: number[] = [];
    for (const [dx, dz] of [[-wM / 2, 0], [wM / 2, 0], [wM / 2, hM], [-wM / 2, hM]]) P.push(CY * (u + dx) + SY * w, (z + dz) * STRETCH, -SY * (u + dx) + CY * w);
    B.quad(P, 0, 0, 1, 1, lin(((tint >> 16) & 255) / 255), lin(((tint >> 8) & 255) / 255), lin((tint & 255) / 255), 1, 0); this.quads++;
  }

  end() {
    for (const [k, b] of this.batches) {
      b.flush(this.frame);
      // Sheets nobody has shown for a while give their memory back.
      if (this.frame - b.used > 900 && this.batches.size > 40) { this.group.remove(b.mesh); b.geo.dispose(); b.mat.dispose(); (b.mesh.customDepthMaterial as THREE.Material | undefined)?.dispose(); this.batches.delete(k); }
    }
    if (this.frame % 600 === 0 && this.tex.size > 60) for (const [img, t] of this.tex) {
      if (this.frame - (this.texUsed.get(t) ?? 0) < 1800) continue;
      for (const [k, b] of this.batches) if (b.tex === t) { this.group.remove(b.mesh); b.geo.dispose(); b.mat.dispose(); (b.mesh.customDepthMaterial as THREE.Material | undefined)?.dispose(); this.batches.delete(k); }
      t.dispose(); this.tex.delete(img); this.texUsed.delete(t);
    }
  }
  get draws(): number { let n = 0; for (const b of this.batches.values()) if (b.n) n++; return n; }
}

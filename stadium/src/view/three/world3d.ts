// The district as a painted miniature, built from the layout: every wall in the wall list stands
// (cut low where you need to see over it), the buildings have fronts, sides and roofs that lift off
// when you go in, and the ground is painted from the areas. x east, z south (the game's y), y up.
import * as THREE from "three";
import { HL, PITCH } from "../../football/config";
import type { Area, Venue, Wall } from "../../stadium/layout";
import type { BuildingSpec } from "../build";
import * as art from "./art";
import { RIGHT, STRETCH, SY, CY, UP } from "./cam";
import { CHUNK_M, paintChunk, type GroundSpec } from "./ground";
import { Builder, setYS, type V3 } from "./mesh";
import { Atlas, BRICK_DARK, BRICK_RED, BRICK_STOCK, H, PXM, brick, grain, pixText, rect, rng, weather, type BrickPal, type Region } from "./paint";
import { buildInteriors, wallPlan } from "./interiors";
import { buildStands, Stands } from "./stands";
import { buildHydro } from "./hydro";
import { awning, buildDressing, cabinDressing, flatRoofClutter, groundPaint, hotelDressing, pubDressing, shopFrontDressing, shopSide } from "./dressing";

export interface WorldHost {
  venue: Venue; walls: Wall[]; areas: Area[]; blds: BuildingSpec[];
  /** A picture the game has loaded or made, by its texture key. */
  image(key: string): (CanvasImageSource & { width: number; height: number }) | null;
  glows: { x: number; y: number; col: number; r: number }[];
  maxAniso: number;
}

export interface Part { id: string; A: Builder; U: Builder; GL: Builder; group: THREE.Group }
/** When a part shows: always; only from outside the ground (it hides with the stadium's shell); only once you are in
 *  the ground; the main stand, which lies flat when the camera goes behind it; or only inside one building. */
export type When = "always" | "outside" | "inside" | "terrace" | "stand_n" | "stand_n_flat" | `room:${string}`;
const col = (c: number, c2?: number) => ({ c, c2 });
const SHELL_H = 9;

export class World3D {
  root = new THREE.Group();
  /** The outsides of the buildings (and the ground's shell), by id: hidden when you are inside. */
  shells = new Map<string, THREE.Group>();
  private gates = new Map<string, THREE.Object3D>();
  private whens: { when: When; g: THREE.Object3D }[] = [];
  roofFn = new Map<string, (y: number) => number>();
  /** Furniture pictures the 3D world has built for itself (so the scene need not draw them): "key@x,y". */
  private replaced = new Set<string>();
  stands: Stands | null = null;
  /** Where the camera is looking (the middle of the ground it can see), and whether that is behind the main stand. */
  focus = { x: 0, z: 0 }; northCut = false; private insideNow = false;
  mirror = false;
  private chunks = new Map<string, { mesh: THREE.Mesh; tex: THREE.Texture; used: number }>();
  spec: GroundSpec;
  atlas = new Atlas(2048, 4096);
  private atlasTex!: THREE.Texture;
  lit!: THREE.MeshLambertMaterial; private unlit!: THREE.MeshBasicMaterial; private glowMat!: THREE.MeshBasicMaterial; private groundMat: THREE.MeshLambertMaterial[] = [];
  glowTex!: THREE.Texture;
  private white: Region;
  private frame = 0;
  private disposables: { dispose(): void }[] = [];
  stats = { tris: 0, chunks: 0, paintMs: 0, atlasPx: 4096, build: {} as Record<string, number> };
  /** Tall things, for putting people in shade: x0, y0, x1, y1, height. */
  shaders: [number, number, number, number, number][] = [];
  private wallsGroup: THREE.Mesh | null = null;
  sw!: Record<string, Region>;

  constructor(public host: WorldHost) {
    setYS(STRETCH);
    this.white = this.atlas.solid(0xffffff);
    this.mirror = host.venue.id === "sf";
    this.spec = { areas: host.areas, mirror: this.mirror, fanZone: host.venue.features.fanZone, ao: [], streaks: [], extras: [], under: [], lean: Math.tan(Math.asin(SY)), labels: host.venue.labels };
    const tStart = performance.now();
    this.materials();
    this.swatches();
    const base = this.part("base");
    this.walls(base);
    this.pitchFurniture(base);
    this.fences(base);
    for (const g of host.glows) { this.pool(base, g.x, g.y + 1.0, g.r * 0.9, g.r * 0.8, g.col, 0.22); this.spec.streaks.push([g.x - g.r * 0.4, g.y + 0.2, g.r * 0.8, 2.4, g.col, 0.3]); }
    this.finish(base, false);
    for (const b of host.blds) {
      const p = this.part(b.id);
      if (b.front === "pub") this.pub(p, b); else if (b.front === "hotel") this.hotel(p, b); else if (b.front === "cabin") this.cabin(p, b); else this.shop(p, b);
      const { x0, y0, x1, y1 } = b.rect;
      this.shaders.push([x0, y0, x1, y1, b.height + 1]); // (its walls darken the ground at their feet; the floor inside stays clean)
      this.finish(p, true);
    }
    this.stadium();
    this.stats.build.m1 = Math.round(performance.now() - tStart);
    const safe = (what: string, f: () => void) => { const t0 = performance.now(); try { f(); } catch (e) { console.warn(`3D world: ${what} failed`, e); } this.stats.build[what] = Math.round(performance.now() - t0); };
    safe("stands", () => { this.stands = buildStands(this); });
    safe("interiors", () => buildInteriors(this));
    safe("dressing", () => buildDressing(this));
    safe("hydro", () => buildHydro(this));
    groundPaint(this);
    this.cropAtlas();
    this.atlasTex.needsUpdate = true;
  }
  /** Send the card only as much of the sheet as got painted: the sheet is cut off below the last region and every UV rescaled to suit. */
  private cropAtlas() {
    const full = this.atlas.height, used = Math.min(full, Math.ceil((this.atlas.used() + 8) / 64) * 64);
    if (used >= full) return;
    const cv = document.createElement("canvas"); cv.width = this.atlas.size; cv.height = used;
    cv.getContext("2d")!.drawImage(this.atlas.canvas, 0, 0);
    this.atlasTex.image = cv;
    const k = full / used;
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m.material !== this.lit && m.material !== this.unlit)) return;
      const uv = m.geometry.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (1 - uv.getY(i)) * k);
      uv.needsUpdate = true;
    });
    this.stats.atlasPx = used;
  }
  /** How much of the atlas is painted. */
  atlasUse(): number { return Math.round(this.atlas.usage() * 100) / 100; }
  /** A mirrored x for the semi-final's ground. */
  mx(x: number): number { return this.mirror ? -x : x; }
  /** Say that the 3D world has built this piece of furniture itself. */
  replace(key: string, x: number, y: number) { this.replaced.add(`${key}@${x.toFixed(1)},${y.toFixed(1)}`); }
  /** Has the 3D world built this piece of furniture itself (so its picture should not be drawn as well)? */
  replaces(key: string, x: number, y: number): boolean { return this.replaced.has(`${key}@${x.toFixed(1)},${y.toFixed(1)}`); }
  /** How high the terracing stands at a point (0 anywhere else): whoever is there is drawn that much higher. */
  standLift(x: number, y: number): number { this.liftAsked = true; return this.stands && this.insideNow ? this.stands.lift(x, y, this.northCut) : 0; }
  /** Does the scene ask where the terracing is? Until it does, the stands stay flat (or the crowd would be buried in them). */
  private liftAsked = false;

  // ---------------------------------------------------------------------------------------------
  private materials() {
    const t = new THREE.CanvasTexture(this.atlas.canvas);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = Math.min(4, this.host.maxAniso); t.generateMipmaps = true;
    this.atlasTex = t;
    this.lit = new THREE.MeshLambertMaterial({ map: t, vertexColors: true, alphaTest: 0.5, shadowSide: THREE.DoubleSide });
    this.unlit = new THREE.MeshBasicMaterial({ map: t, vertexColors: true });
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.42)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.glowTex = new THREE.CanvasTexture(cv); this.glowTex.colorSpace = THREE.SRGBColorSpace;
    this.glowMat = new THREE.MeshBasicMaterial({ map: this.glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.disposables.push(t, this.lit, this.unlit, this.glowTex, this.glowMat);
  }
  private swatches() {
    const a = this.atlas, bk = (pal: BrickPal, s: number) => a.paintM(2, 2, (c, w, h) => { brick(c, 0, 0, w, h, pal, rng(s)); weather(c, 0, 0, w, h, rng(s + 1), 0.25, 0.1, 3); });
    this.sw = {
      brick: bk(BRICK_RED, 3), stock: bk(BRICK_STOCK, 7), dark: bk(BRICK_DARK, 5),
      block: a.paintM(2, 2, (c, w, h) => art.blockwork(c, w, h)), clad: a.paintM(2, 2, (c, w, h) => art.cladding(c, w, h)), cabin: a.paintM(2, 2, (c, w, h) => art.cladding(c, w, h, 0x6f7a62, 61)),
      render: a.paintM(2, 2, (c, w, h) => art.render(c, w, h)), timber: a.paintM(2, 2, (c, w, h) => art.timberPanel(c, w, h)), steel: a.paintM(2, 2, (c, w, h) => art.steelDoor(c, w, h)),
      stone: a.paint(32, 8, (c, w, h) => { rect(c, 0, 0, w, h, H(0xb9b3a2)); grain(c, 0, 0, w, h, 8, 2); rect(c, 0, 0, w, 1, H(0xd4cebc)); rect(c, 0, h - 1, w, 1, H(0x7c776a)); }),
      slate: a.paintM(7.6, 3.6, (c, w, h) => art.slateRoof(c, w, h, 5)), felt: a.paintM(6, 5, (c, w, h) => art.flatRoof(c, w, h, 12)), steelroof: a.paintM(8, 6, (c, w, h) => art.steelRoof(c, w, h, 14)),
      palisade: a.paint(64, 58, art.palisade, false), net: a.paint(32, 32, art.netting, false),
      ac: a.paint(32, 19, art.acSide), acTop: a.paint(32, 26, art.acTop),
      slats: a.paint(128, 14, (c, w, h) => { rect(c, 0, 0, w, h, H(0x3a2a1c)); for (let y = 0; y < h; y += 5) { rect(c, 0, y, w, 4, H(0x8a6a48)); rect(c, 0, y, w, 1, H(0xa98a62)); } grain(c, 0, 0, w, h, 6, 9); }),
      wicker: a.paint(36, 20, (c, w, h) => { rect(c, 0, 0, w, h, H(0x8a6a3c)); for (let y = 0; y < h; y += 2) for (let x = (y & 2 ? 2 : 0); x < w; x += 4) rect(c, x, y, 2, 1, H(0xb8924e)); rect(c, 0, 0, w, 2, H(0x6a4a24)); rect(c, 0, h - 2, w, 2, H(0x5a3e1e)); }),
      formica: a.paint(32, 16, (c, w, h) => { rect(c, 0, 0, w, h, H(0xd8d4c8)); grain(c, 0, 0, w, h, 7, 4); rect(c, 0, 0, w, 1, H(0xf4f1ea)); }),
      urn: a.paint(32, 20, (c, w, h) => { for (let x = 0; x < w; x++) rect(c, x, 0, 1, h, H([0x8f959c, 0xa9afb6, 0xc9cdd2, 0xe8ecf0, 0xc9cdd2, 0xa9afb6, 0x8f959c, 0x6f757c][Math.floor((x / w) * 8)])); rect(c, 0, 3, w, 1, H(0x5c6168)); rect(c, 0, h - 4, w, 1, H(0x5c6168)); }),
      marble: a.paintM(1, 3, (c, w, h) => { rect(c, 0, 0, w, h, H(0xd9d2c0)); const r = rng(19); for (let k = 0; k < 14; k++) { let x = r.int(w), y = r.int(h); c.strokeStyle = r() < 0.5 ? "rgba(120,110,100,0.5)" : "rgba(244,240,230,0.7)"; c.beginPath(); c.moveTo(x, y); for (let i = 0; i < 6; i++) { x += r.int(9) - 4; y += 4 + r.int(8); c.lineTo(x, y); } c.stroke(); } }),
      pane: a.paint(24, 32, (c, w, h) => { rect(c, 0, 0, w, h, H(0xa9c4d4)); c.fillStyle = "rgba(240,248,252,0.6)"; c.beginPath(); c.moveTo(0, h * 0.7); c.lineTo(w * 0.6, 0); c.lineTo(w, 0); c.lineTo(0, h); c.fill(); rect(c, 0, 0, w, 1, H(0x3a3f46)); rect(c, 0, h - 1, w, 1, H(0x3a3f46)); }),
    };
  }
  part(id: string): Part {
    const s = this.atlas.size, h = this.atlas.height;
    return { id, A: new Builder(s, h, this.white), U: new Builder(s, h, this.white), GL: new Builder(64, 64, { x: 0, y: 0, w: 64, h: 64 }), group: new THREE.Group() };
  }
  /** Pour a part's buffers into meshes. `cast`: does it throw a shadow (each part that does is one more draw). */
  finish(p: Part, shell: boolean, when: When = "always", cast = true) {
    const add = (b: Builder, mat: THREE.Material, shadow: boolean, order = 0) => {
      if (!b.tris) return;
      const g = b.geometry(), m = new THREE.Mesh(g, mat);
      m.castShadow = shadow && cast; m.receiveShadow = shadow; m.matrixAutoUpdate = false; m.renderOrder = order; m.name = `${p.id}`;
      p.group.add(m); this.disposables.push(g); this.stats.tris += b.tris;
    };
    add(p.A, this.lit, true); add(p.U, this.unlit, false); add(p.GL, this.glowMat, false, 5);
    this.root.add(p.group);
    if (shell) this.shells.set(p.id, p.group);
    else if (when !== "always") { this.whens.push({ when, g: p.group }); p.group.visible = false; }
  }
  halo(p: Part, at: V3, size: number, c: number, alpha: number, squash = 1) {
    const hw = size / 2, q = (sx: number, sy: number): V3 => [at[0] + RIGHT.x * sx * hw + UP.x * sy * hw * squash, at[1] + (UP.y * sy * hw * squash) / STRETCH, at[2] + RIGHT.z * sx * hw + UP.z * sy * hw * squash];
    p.GL.quad(q(-1, -1), q(1, -1), q(1, 1), q(-1, 1), { c }, { alpha });
  }
  pool(p: Part, x: number, z: number, rx: number, rz: number, c: number, alpha: number, y = 0.03) { p.GL.quad([x - rx, y, z + rz], [x + rx, y, z + rz], [x + rx, y, z - rz], [x - rx, y, z - rz], { c }, { alpha }); }

  /** A wall face from (ax, az) to (bx, bz), left to right as you look at it, tiled from a swatch `tw` x `th` metres. */
  face(B: Builder, ax: number, az: number, bx: number, bz: number, y0: number, y1: number, r: Region, tw = 2, th = 2, tint = 0xffffff) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / tw - 1e-6));
    for (let i = 0; i < n; i++) {
      const t0 = (i * tw) / len, t1 = Math.min(1, ((i + 1) * tw) / len), fx = (Math.min(len, (i + 1) * tw) - i * tw) / tw;
      for (let y = y0; y < y1 - 1e-6; y += th) {
        const ye = Math.min(y1, y + th);
        B.quad([ax + (bx - ax) * t0, y, az + (bz - az) * t0], [ax + (bx - ax) * t1, y, az + (bz - az) * t1], [ax + (bx - ax) * t1, ye, az + (bz - az) * t1], [ax + (bx - ax) * t0, ye, az + (bz - az) * t0], { r, uv: [0, 1 - (ye - y) / th, fx, 1], c: tint, flip: false });
      }
    }
  }
  /** A flat or sloping roof panel tiled from a swatch: corners near-left, near-right, far-right, far-left. */
  roofPanel(B: Builder, a: V3, b: V3, c: V3, d: V3, r: Region, tw: number, th: number) {
    const w = Math.hypot(b[0] - a[0], b[2] - a[2]), dep = Math.hypot(d[0] - a[0], (d[1] - a[1]) * STRETCH, d[2] - a[2]);
    const nx = Math.max(1, Math.ceil(w / tw - 1e-6)), ny = Math.max(1, Math.ceil(dep / th - 1e-6));
    const at = (s: number, t: number): V3 => { const p0 = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s], p1 = [d[0] + (c[0] - d[0]) * s, d[1] + (c[1] - d[1]) * s, d[2] + (c[2] - d[2]) * s]; return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t]; };
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const s0 = (i * tw) / w, s1 = Math.min(1, ((i + 1) * tw) / w), t0 = (j * th) / dep, t1 = Math.min(1, ((j + 1) * th) / dep);
      B.quad(at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1), { r, uv: [0, 1 - (t1 - t0) * dep / th, (s1 - s0) * w / tw, 1] });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // The wall list, cut low so you can see over it (the Escapists way, and the 2D game's).
  private matOf(wl: Wall): string {
    if (wl.gate) return "steel";
    if (wl.h3 <= 1.2) return "timber";
    if (wl.colour === 0x7a4a3a) return "brick";
    if (wl.colour === 0x6f7a62) return "cabin";
    if ([0x6a5a4a, 0x4d5640, 0x4a3d60].includes(wl.colour)) return "stock";
    if (wl.colour === 0x6a5a70) return "render";
    return "block";
  }
  private walls(p: Part) {
    const CAPS: Record<string, number> = { brick: 0xa39a8e, stock: 0xb0aa98, block: 0xb4b8bc, cabin: 0x9aa78c, render: 0xcfc9bc, timber: 0x8a6444, steel: 0x6a7480 };
    const booths = this.host.venue.furniture.length >= 0 ? [21, -21].map((x) => (this.spec.mirror ? -x : x)) : [];
    for (const wl of this.host.walls) {
      if (wl.prop) continue;
      const x0 = wl.x, x1 = wl.x + wl.w, z0 = wl.y, z1 = wl.y + wl.h;
      // The ticket office and the merchandise stall are their pictures.
      if (booths.some((bx) => x0 > bx - 5.3 && x1 < bx + 5.3 && z0 > 46.6 && z1 < 48.6)) continue;
      if (wl.colour === 0x2f5a3a) { // the palisade along the alley
        for (let z = z0; z < z1; z += 2) { const ze = Math.min(z1, z + 2); p.A.quad([x1, 0, ze], [x1, 0, z], [x1, 1.8, z], [x1, 1.8, ze], { r: this.sw.palisade, uv: [0, 0, (ze - z) / 2, 1] }, { double: true }); }
        continue;
      }
      if (wl.gate) {
        // Doors that have a picture are drawn as one (and swing); the service gate is a sliding steel gate here.
        if (wl.gate !== "servicegate") continue;
        const gp = this.part(`gate-${wl.gate}`);
        gp.A.box(x0 + 0.3, 0, z0, x1 - 0.3, 2.2, z1, { all: { r: this.sw.steel, uv: [0, 0, 1, 1] }, top: col(0x3a4048) });
        this.finish(gp, false); this.gates.set(wl.gate, gp.group);
        continue;
      }
      // Cut to a metre, except a wall with nothing behind it (the ground's back wall), which can stand,
      // and the walls the rooms and the stands have plans for.
      const plan = wallPlan(this, wl);
      if (plan === "skip") continue;
      const mat = this.matOf(wl), r = this.sw[mat], h = plan ?? (wl.h3 <= 1.2 ? wl.h3 : z1 <= -60.9 && wl.w > 20 ? 3 : 1.0), cap = CAPS[mat] ?? 0xb4b8bc;
      this.face(p.A, x0, z1, x1, z1, 0, h, r); this.face(p.A, x1, z1, x1, z0, 0, h, r); this.face(p.A, x1, z0, x0, z0, 0, h, r); this.face(p.A, x0, z0, x0, z1, 0, h, r);
      p.A.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], col(cap));
      this.spec.ao.push([x0, z0, x1, z1, h]);
    }
  }
  private fences(p: Part) {
    const b = { x0: -92, y0: -62, x1: 92, y1: 96 }, r = this.sw.palisade;
    const run = (ax: number, az: number, bx: number, bz: number) => { const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 2); for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; p.A.quad([ax + (bx - ax) * t0, 0, az + (bz - az) * t0], [ax + (bx - ax) * t1, 0, az + (bz - az) * t1], [ax + (bx - ax) * t1, 1.8, az + (bz - az) * t1], [ax + (bx - ax) * t0, 1.8, az + (bz - az) * t0], { r, uv: [0, 0, 1, 1] }, { double: true }); } };
    run(b.x0, b.y0, b.x1, b.y0); run(b.x0, b.y1 + 0.3, b.x1, b.y1 + 0.3); run(b.x0, b.y1, b.x0, b.y0); run(b.x1, b.y0, b.x1, b.y1);
  }
  private pitchFurniture(p: Part) {
    const w = PITCH.goalW / 2, h = PITCH.goalH, white = col(0xe8ece8, 0xffffff);
    for (const s of [-1, 1]) {
      const gx = s * HL, back = gx + s * 1.7;
      for (const z of [-w, w]) { p.A.bar([gx, 0, z], [gx, h, z], 0.12, white); p.A.bar([gx, h, z], [back, h * 0.45, z], 0.05, col(0xc8ccc8)); p.A.bar([back, 0, z], [back, h * 0.45, z], 0.05, col(0xc8ccc8)); }
      p.A.bar([gx, h, -w], [gx, h, w], 0.12, white);
      const net = (a: V3, b: V3, c: V3, d: V3) => p.A.quad(a, b, c, d, { r: this.sw.net, uv: [0, 0, 1, 1], c: 0xd8dcd8 }, { double: true, normal: [0, 1, 0] });
      net([back, 0, w], [back, 0, -w], [back, h * 0.45, -w], [back, h * 0.45, w]); net([back, h * 0.45, w], [back, h * 0.45, -w], [gx, h, -w], [gx, h, w]);
      for (const z of [-w, w]) net([gx, 0, z], [back, 0, z], [back, h * 0.45, z], [gx, h, z]);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // THE THREE LIONS: the prototype's pub at the footprint the game gives it.
  private pub(p: Part, b: BuildingSpec) {
    const { A, U } = p, a = this.atlas, { x0, y0: z0, x1, y1: z1 } = b.rect, e = b.height, W = x1 - x0, D = z1 - z0, zr = (z0 + z1) / 2, rise = 2.5, ridge = e + rise, F = z1 + 0.03;
    const door = b.doors[0] ? ([b.doors[0].x0 - x0, b.doors[0].x1 - x0] as [number, number]) : null, bays = art.bayPlan(W, door);
    A.quad([x0, 0, F], [x1, 0, F], [x1, e, F], [x0, e, F], a.paintM(W, e, (c, w, h) => art.pubFrontWide(c, w, h, bays)));
    // Lit glass, warm halos, long reflections in the wet.
    const glassBy = new Map<string, Region>();
    bays.forEach((bay, i) => {
      const bw = bay.b - bay.a, cx = x0 + (bay.a + bay.b) / 2;
      if (bay.kind === "door") {
        U.quad([x0 + bay.a, 0, F + 0.02], [x0 + bay.b, 0, F + 0.02], [x0 + bay.b, 2.45, F + 0.02], [x0 + bay.a, 2.45, F + 0.02], a.paintM(bw, 2.45, art.pubDoorway));
        A.box(x0 + bay.a - 0.1, 0, F, x0 + bay.b + 0.1, 0.07, F + 0.3, { all: { r: this.sw.stone, c: 0x9a9a9a } });
        for (const lx of [bay.a - 0.15, bay.b + 0.15]) { A.box(x0 + lx - 0.09, 2.08, F + 0.08, x0 + lx + 0.09, 2.14, F + 0.3, col(0x15161a)); A.box(x0 + lx - 0.11, 2.42, F + 0.08, x0 + lx + 0.11, 2.48, F + 0.32, col(0x15161a)); U.box(x0 + lx - 0.07, 2.14, F + 0.11, x0 + lx + 0.07, 2.42, F + 0.27, col(0xffe2a0)); this.halo(p, [x0 + lx, 2.28, F + 0.35], 1.3, 0xffc060, 0.5); }
        this.halo(p, [cx, 1.4, F + 0.3], bw * 1.6, art.WARM, 0.26); this.pool(p, cx + 0.3, F + 1.5, bw * 0.7, 1.7, art.WARM, 0.26); this.spec.streaks.push([x0 + bay.a + 0.2, F + 0.1, bw - 0.4, 3.4, 0xffcf7a, 0.5]);
        return;
      }
      const kind = i % 2, key = `${bw.toFixed(2)}:${kind}`;
      let r = glassBy.get(key); if (!r) { r = a.paintM(bw, 1.7, (c, w, h) => art.pubGlass(c, w, h, kind)); glassBy.set(key, r); }
      U.quad([x0 + bay.a, 0.75, F + 0.02], [x0 + bay.b, 0.75, F + 0.02], [x0 + bay.b, 2.45, F + 0.02], [x0 + bay.a, 2.45, F + 0.02], { r, flip: i % 3 === 2 });
      this.halo(p, [cx, 1.5, F + 0.3], bw * 1.7, art.WARM, 0.18); this.pool(p, cx + 0.25, F + 1.3, bw * 0.65, 1.4, art.WARM, 0.16); this.spec.streaks.push([x0 + bay.a + 0.1, F + 0.12, bw - 0.2, 2.6, 0xffcf7a, 0.4]);
    });
    // Fascia and sign over the door, cornice, baskets on every other pilaster, the flag.
    const sc = door ? x0 + (door[0] + door[1]) / 2 : (x0 + x1) / 2, sw = Math.min(W - 1, 11);
    A.box(sc - sw / 2, 2.52, F, sc + sw / 2, 3.2, F + 0.12, { all: col(art.GREEN_D), s: a.paint(sw * 64, 0.68 * 64, art.pubSign), top: col(0x2a6a4a) });
    A.box(x0 - 0.06, 3.2, F, x1 + 0.06, 3.38, F + 0.24, { all: col(0x1a4a33, 0x26684a), top: col(0x3a8060) }); A.box(x0 - 0.02, 3.16, F, x1 + 0.02, 3.22, F + 0.18, col(art.GOLD));
    const fl = [a.paint(22, 20, (c, w, h) => art.flowers(c, w, h, 1), false), a.paint(22, 20, (c, w, h) => art.flowers(c, w, h, 2), false)];
    bays.forEach((bay, i) => {
      const cx = x0 + bay.a - 0.15, cz = F + 0.62, r = fl[i % 2];
      A.bar([cx, 2.95, F + 0.12], [cx, 2.95, cz + 0.05], 0.05, col(0x15161a)); A.bar([cx, 2.95, cz], [cx, 2.62, cz], 0.03, col(0x15161a));
      A.cyl(cx, 2.3, 2.56, cz, 0.14, 6, col(0x3a2a1c, 0x5a4028), undefined, 0.26);
      A.quad([cx - 0.36, 2.2, cz], [cx + 0.36, 2.2, cz], [cx + 0.36, 2.88, cz], [cx - 0.36, 2.88, cz], r, { normal: [0, 1, 0.3], double: true });
      A.quad([cx, 2.2, cz + 0.36], [cx, 2.2, cz - 0.36], [cx, 2.88, cz - 0.36], [cx, 2.88, cz + 0.36], r, { normal: [0, 1, 0.3], double: true });
    });
    const fx = sc + sw / 2 + 1.2;
    if (fx + 1.4 < x1) A.quad([fx, 3.2, F + 0.3], [fx + 1.4, 3.2, F + 0.3], [fx + 1.4, 4.15, F + 0.14], [fx, 4.15, F + 0.14], a.paint(40, 30, art.englandFlag), { double: true });
    // The yard gable (east at the quarter-final, west at the semi), the other three sides in brick.
    const east = !this.spec.mirror, ge = 1 - e / ridge;
    const rG = a.paintM(D, ridge, (c, w, h) => art.pubGableWide(c, w, h, east ? [z1 - 70, z1 - 66] : [66 - z0, 70 - z0], e));
    const gable = (x: number, yard: boolean, toEast: boolean) => {
      const L: V3 = toEast ? [x, 0, z1] : [x, 0, z0], R: V3 = toEast ? [x, 0, z0] : [x, 0, z1];
      if (yard) { A.quad(L, R, [R[0], e, R[2]], [L[0], e, L[2]], { r: rG, uv: [0, ge, 1, 1] }); A.tri([L[0], e, L[2]], [R[0], e, R[2]], [x, ridge, zr], rG, [[0, ge], [1, ge], [0.5, 0]]); }
      else { this.face(A, L[0], L[2], R[0], R[2], 0, e, this.sw.brick, 2, 2, 0xb8b8b8); A.tri([L[0], e, L[2]], [R[0], e, R[2]], [x, ridge, zr], { r: this.sw.brick, c: 0xb8b8b8 }, [[0, 1], [1, 1], [0.5, 0]]); }
    };
    gable(x1 + 0.03, east, true); gable(x0 - 0.03, !east, false);
    this.face(A, x1, z0 - 0.03, x0, z0 - 0.03, 0, e, this.sw.brick, 2, 2, 0xb0b0b0);
    {
      // The side door on to the yard, standing open, and its light on the setts.
      const gx = east ? x1 + 0.06 : x0 - 0.06, s = east ? 1 : -1, rD = a.paintM(4, 2.5, art.pubDoorway);
      const q: V3[] = east ? [[gx, 0, 70], [gx, 0, 66], [gx, 2.5, 66], [gx, 2.5, 70]] : [[gx, 0, 66], [gx, 0, 70], [gx, 2.5, 70], [gx, 2.5, 66]];
      U.quad(q[0], q[1], q[2], q[3], rD);
      this.halo(p, [gx + s * 0.4, 1.4, 68], 5.2, art.WARM, 0.24); this.pool(p, gx + s * 1.9, 68.2, 1.9, 2.4, art.WARM, 0.3);
      this.spec.streaks.push([Math.min(gx, gx + s * 0.2) + (east ? 0.1 : -3.2), 66.4, 3.1, 4.6, 0xffcf7a, 0.42]);
      for (const lz of [65.75, 70.25]) { A.box(gx, 2.08, lz - 0.09, gx + s * 0.3, 2.14, lz + 0.09, col(0x15161a)); U.box(Math.min(gx + s * 0.08, gx + s * 0.26), 2.14, lz - 0.07, Math.max(gx + s * 0.08, gx + s * 0.26), 2.42, lz + 0.07, col(0xffe2a0)); this.halo(p, [gx + s * 0.4, 2.28, lz], 1.3, 0xffc060, 0.5); }
    }
    // Slates: two slopes off a ridge that runs east-west, gutters, barge boards, ridge tiles.
    const oh = 0.35, ey = e - oh * (rise / (D / 2)), ov = 0.28;
    this.roofPanel(A, [x0 - ov, ey, z1 + oh], [x1 + ov, ey, z1 + oh], [x1 + ov, ridge, zr], [x0 - ov, ridge, zr], this.sw.slate, 7.6, 3.6);
    this.roofPanel(A, [x1 + ov, ey, z0 - oh], [x0 - ov, ey, z0 - oh], [x0 - ov, ridge, zr], [x1 + ov, ridge, zr], this.sw.slate, 7.6, 3.6);
    A.box(x0 - ov, ey - 0.16, z1 + oh - 0.12, x1 + ov, ey + 0.03, z1 + oh + 0.06, col(0x1b1c20));
    for (const bx of [x1 + ov, x0 - ov]) { A.bar([bx, ey - 0.02, z1 + oh], [bx, ridge - 0.04, zr], 0.14, col(0xcfc8b2)); A.bar([bx, ridge - 0.04, zr], [bx, ey - 0.02, z0 - oh], 0.14, col(0xbdb6a0)); }
    A.bar([x0 - ov, ridge + 0.04, zr], [x1 + ov, ridge + 0.04, zr], 0.2, col(0x343a44));
    for (const cx of [x1 - 2.4, x0 + 5.5, x0 + W * 0.55]) {
      A.box(cx, ridge - 0.9, zr - 0.5, cx + 0.8, ridge + 1.0, zr + 0.5, { all: { r: this.sw.brick, uv: [0, 0, 0.4, 0.95] }, top: this.sw.stone });
      A.box(cx - 0.07, ridge + 1.0, zr - 0.57, cx + 0.87, ridge + 1.1, zr + 0.57, this.sw.stone);
      for (const pz of [-0.25, 0.25]) A.cyl(cx + 0.4, ridge + 1.1, ridge + 1.55, zr + pz, 0.15, 6, col(0x9a5536, 0xb86a44), col(0x2a1c16), 0.12);
    }
    {
      // Rooflights over the bar, and pigeons, who own the ridge.
      const sp = (x: number, t: number, lift = 0.05): V3 => [x, ey + (ridge - ey) * t + lift, z1 + oh + (zr - z1 - oh) * t + lift * 0.6];
      const rSky = a.paint(34, 30, (c, w, h) => { rect(c, 0, 0, w, h, H(0x23262b)); art.litGlass(c, 3, 3, w - 6, h - 6, 3); rect(c, w / 2 - 1, 3, 2, h - 6, H(0x23262b)); rect(c, 3, 3, w - 6, 1, H(0xfff0c0)); });
      for (const sx of [x0 + 4, x0 + W * 0.42, x1 - 6]) U.quad(sp(sx, 0.34), sp(sx + 1.1, 0.34), sp(sx + 1.1, 0.5), sp(sx, 0.5), rSky);
      const rPig = a.paint(9, 7, (c) => { c.clearRect(0, 0, 9, 7); rect(c, 1, 2, 6, 3, H(0x8a8f9a)); rect(c, 5, 0, 3, 3, H(0x6f7480)); rect(c, 8, 1, 1, 1, H(0xe0a040)); rect(c, 0, 3, 2, 1, H(0x5a5e68)); rect(c, 2, 3, 3, 1, H(0xb9bec8)); rect(c, 3, 5, 1, 2, H(0xc86a5a)); rect(c, 5, 5, 1, 2, H(0xc86a5a)); }, false);
      for (const [px, flp] of [[x0 + 8.0, false], [x0 + 8.5, true], [x1 - 7.4, false], [x1 - 9, true]] as [number, boolean][]) A.quad([px, ridge + 0.12, zr + 0.05], [px + 0.3, ridge + 0.12, zr + 0.05], [px + 0.3, ridge + 0.34, zr + 0.05], [px, ridge + 0.34, zr + 0.05], { r: rPig, flip: flp }, { normal: [0, 1, 0.3], double: true });
    }
    A.bar([x1 - 0.22, 0, F + 0.07], [x1 - 0.22, ey, F + 0.07], 0.1, col(0x1b1c20)); A.bar([x0 + 0.22, 0, F + 0.07], [x0 + 0.22, ey, F + 0.07], 0.1, col(0x1b1c20));
    pubDressing(this, p, b, ridge, zr, east);
    this.roofFn.set("pub", (y) => e + Math.max(0, 1 - Math.abs(y - zr) / (D / 2)) * rise + 0.05);
  }

  /** A lock-up shop in the prototype's manner: brick front, fascia sign, lit window, flat felt roof with its clutter. */
  private shop(p: Part, b: BuildingSpec) {
    const { A, U } = p, a = this.atlas, { x0, y0: z0, x1, y1: z1 } = b.rect, hgt = b.height, W = x1 - x0, F = z1 + 0.03, roofY = hgt - 0.3;
    const CFG: Record<string, { pal: BrickPal; fascia: number; frame: number; sign: (c: CanvasRenderingContext2D, w: number, h: number) => void; signH?: number; window: (c: CanvasRenderingContext2D, w: number, h: number) => void; cool?: boolean; glow: number; tint: number }> = {
      bookies: { pal: BRICK_RED, fascia: 0x141414, frame: 0x17181c, sign: (c, w, h) => art.fasciaSign(c, w, h, "CASH KINGS", 0xf2c81e, 0x141414, { crown: true, sub: "WE BUY GOLD · PAWNBROKER · CHEQUES CASHED", stripe: 0x141414, edge: 0x141414 }), signH: 1.15, window: art.pawnWindow, cool: true, glow: 0xf2e6a0, tint: 0xffffff },
      charity: { pal: BRICK_STOCK, fascia: 0x2f5d50, frame: 0x24493f, sign: (c, w, h) => art.fasciaSign(c, w, h, "SECOND HAND ROSE", 0x2f5d50, 0xf4efe0, { sub: "CHARITY SHOP · EVERYTHING £2 · DONATIONS WELCOME", edge: 0xe8e0c8, font: art.SERIF }), window: (c, w, h) => art.shopWindow(c, w, h, 5, false, "OPEN"), glow: 0xffd9a0, tint: 0xb0a8a0 },
      surplus: { pal: BRICK_DARK, fascia: 0xd9cfa8, frame: 0x3f4a30, sign: (c, w, h) => art.fasciaSign(c, w, h, "ARMY & NAVY", 0xd9cfa8, 0x2f3d22, { sub: "SURPLUS · WORKWEAR · BOOTS", edge: 0x2f3d22 }), window: (c, w, h) => art.shopWindow(c, w, h, 8, false, "SALE"), glow: 0xffd9a0, tint: 0xb0a8a0 },
    };
    const cfg = CFG[b.front] ?? CFG.charity, d = b.doors[0], dx0 = d ? d.x0 : x0 + W / 2 - 2, dx1 = d ? d.x1 : x0 + W / 2 + 2;
    A.quad([x0, 0, F], [x1, 0, F], [x1, hgt, F], [x0, hgt, F], a.paintM(W, hgt, (c, w, h) => art.shopFront(c, w, h, { pal: cfg.pal, fascia: cfg.fascia, frame: cfg.frame, kind: "glass", seed: 60 + b.id.length })));
    const side = cfg.pal === BRICK_STOCK ? this.sw.stock : cfg.pal === BRICK_DARK ? this.sw.dark : this.sw.brick;
    A.quad([x1 + 0.03, 0, z1], [x1 + 0.03, 0, z0], [x1 + 0.03, hgt, z0], [x1 + 0.03, hgt, z1], shopSide(this, p, b)); this.face(A, x1, z0 - 0.03, x0, z0 - 0.03, 0, hgt, side, 2, 2, 0xb0b0b0); this.face(A, x0 - 0.03, z0, x0 - 0.03, z1, 0, hgt, side, 2, 2, 0xb8b8b8);
    // Parapet, felt roof, a vent, a flue.
    A.box(x0 - 0.03, hgt, z0 - 0.03, x1 + 0.03, hgt + 0.12, z0 + 0.25, this.sw.stone); A.box(x0 - 0.03, hgt, z1 - 0.25, x1 + 0.03, hgt + 0.12, F, this.sw.stone);
    A.box(x0 - 0.03, hgt, z0 + 0.25, x0 + 0.25, hgt + 0.12, z1 - 0.25, this.sw.stone); A.box(x1 - 0.25, hgt, z0 + 0.25, x1 + 0.03, hgt + 0.12, z1 - 0.25, this.sw.stone);
    this.roofPanel(A, [x0, roofY, z1], [x1, roofY, z1], [x1, roofY, z0], [x0, roofY, z0], this.sw.felt, 6, 5);
    const vr = rng(b.id.length * 7 + 3), vx = x0 + 2 + vr() * 3, vz = z0 + 1.5 + vr() * 2;
    A.box(vx, roofY, vz, vx + 1.0, roofY + 0.6, vz + 0.8, { all: this.sw.ac, e: { r: this.sw.ac, uv: [0.1, 0, 0.9, 1] }, top: this.sw.acTop }); A.box(vx + 0.1, roofY, vz + 0.8, vx + 0.2, roofY + 0.08, vz + 2.2, col(0x2a2c30));
    A.cyl(x1 - 2, roofY, roofY + 0.8, z0 + 2 + vr() * 3, 0.12, 6, col(0x5c6066, 0x8a8f96), col(0x1a1a1c));
    if (b.front === "bookies") { A.cyl(x0 + 6, roofY, roofY + 0.6, z0 + 3, 0.16, 6, { c: 0xe2661c, c2: 0xf08a3a }, col(0xf08a3a), 0.04); A.cyl(x0 + 6, roofY + 0.25, roofY + 0.38, z0 + 3, 0.1, 6, col(0xf2efe6), undefined, 0.08); }
    else A.cyl(x0 + W * 0.6, roofY, roofY + 0.18, z0 + 4, 0.11, 6, col(0xd8d4c8, 0xf4f0e6), col(0xf4f0e6), 0.11);
    // Sign, lit windows either side of an open glazed door.
    const sh = cfg.signH ?? 0.72, sy = 2.38;
    A.box(x0 + 0.15, sy, F, x1 - 0.15, sy + sh, F + (cfg.signH ? 0.22 : 0.1), { all: col(cfg.fascia), s: a.paint((W - 0.3) * 64, sh * 64, cfg.sign), top: col(0x8a8a86) });
    if (cfg.signH) { this.halo(p, [(x0 + x1) / 2, sy + sh / 2, F + 0.4], W * 0.8, 0xffe680, 0.18, 0.4); this.spec.streaks.push([x0 + 0.6, F + 0.15, W - 1.2, 4.2, 0xf2d040, 0.36]); }
    const win = (wa: number, wb: number) => {
      if (wb - wa < 1) return;
      U.quad([wa, 0.44, F + 0.02], [wb, 0.44, F + 0.02], [wb, 2.3, F + 0.02], [wa, 2.3, F + 0.02], a.paintM(wb - wa, 1.86, cfg.window));
      this.halo(p, [(wa + wb) / 2, 1.4, F + 0.4], (wb - wa) * 1.5, cfg.glow, 0.16, 0.6); this.spec.streaks.push([wa + 0.1, F + 0.1, wb - wa - 0.2, 2.6, cfg.glow, 0.26]);
    };
    win(x0 + 0.2, dx0 - 0.1); win(dx1 + 0.1, x1 - 0.2);
    if (b.front !== "bookies") { const [c1, c2] = b.awning ?? [0x3f4a30, 0xd9cfa8]; awning(this, p, x0 + 0.2, dx0 - 0.1, F, c1, c2); awning(this, p, dx1 + 0.1, x1 - 0.2, F, c1, c2); }
    flatRoofClutter(this, p, x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, roofY, 40 + b.id.length * 3);
    shopFrontDressing(this, p, b);
    const rD = a.paintM(1.0, 2.2, (c, w, h) => art.shopDoor(c, w, h, cfg.frame, true, !!cfg.cool)), dm = (dx0 + dx1) / 2;
    U.quad([dx0, 0, F + 0.02], [dm, 0, F + 0.02], [dm, 2.3, F + 0.02], [dx0, 2.3, F + 0.02], rD); U.quad([dm, 0, F + 0.02], [dx1, 0, F + 0.02], [dx1, 2.3, F + 0.02], [dm, 2.3, F + 0.02], a.paintM(1.0, 2.2, (c, w, h) => { c.translate(w, 0); c.scale(-1, 1); art.shopDoor(c, w, h, cfg.frame, true, !!cfg.cool, false); }));
    this.pool(p, dm, F + 1.3, 1.8, 1.4, cfg.glow, 0.2);
    this.roofFn.set(b.id, () => roofY + 0.02);
  }

  private hotel(p: Part, b: BuildingSpec) {
    const { A, U } = p, a = this.atlas, { x0, y0: z0, x1, y1: z1 } = b.rect, e = b.height, W = x1 - x0, D = z1 - z0, F = z1 + 0.03, d = b.doors[0];
    const door = d ? ([d.x0 - x0, d.x1 - x0] as [number, number]) : null;
    A.quad([x0, 0, F], [x1, 0, F], [x1, e, F], [x0, e, F], a.paintM(W, e, (c, w, h) => art.hotelFront(c, w, h, door, 71)));
    const rS = a.paintM(9.2, e, (c, w, h) => art.hotelFront(c, w, h, null, 73));
    this.face(A, x1 + 0.03, z1, x1 + 0.03, z0, 0, e, rS, 9.2, e); this.face(A, x0 - 0.03, z0, x0 - 0.03, z1, 0, e, rS, 9.2, e, 0xc0c0c0); this.face(A, x1, z0 - 0.03, x0, z0 - 0.03, 0, e, this.sw.render, 2, 2, 0xb0b0b0);
    A.box(x0 - 0.1, e, z0 - 0.1, x1 + 0.1, e + 0.25, z1 + 0.1, { all: this.sw.stone, top: null });
    this.roofPanel(A, [x0, e + 0.05, z1], [x1, e + 0.05, z1], [x1, e + 0.05, z0], [x0, e + 0.05, z0], this.sw.felt, 6, 5);
    for (const [vx, vz] of [[x0 + 3, z0 + 4], [x1 - 5, z0 + D * 0.5], [x0 + 6, z1 - 6]]) A.box(vx, e, vz, vx + 1.0, e + 0.65, vz + 0.8, { all: this.sw.ac, top: this.sw.acTop });
    A.box(x0 + W * 0.4, e, z0 + D * 0.3, x0 + W * 0.4 + 3, e + 1.9, z0 + D * 0.3 + 3, { all: { r: this.sw.render, c: 0xa8a8a8 }, top: this.sw.felt }); // lift housing
    if (door) {
      const da = x0 + door[0], db = x0 + door[1], rD = a.paintM(db - da, 2.75, (c, w, h) => { art.litGlass(c, 0, 0, w, h, 77, {}); for (const hx of [0.22, 0.55, 0.8]) { rect(c, Math.round(w * hx), Math.round(h * 0.48), 5, 5, H(0x4a2a1a)); rect(c, Math.round(w * hx) - 2, Math.round(h * 0.48) + 5, 9, 20, H(0x4a2a1a)); } rect(c, 0, Math.round(h * 0.48) + 22, w, 9, H(0x7a5a3c)); for (const x of [0, w / 3, (2 * w) / 3, w - 3]) rect(c, Math.round(x), 0, 3, h, H(0x22262c)); rect(c, 0, 0, w, 4, H(0x22262c)); rect(c, 0, h - 5, w, 5, H(0x3a3d42)); });
      U.quad([da, 0, F + 0.02], [db, 0, F + 0.02], [db, 2.75, F + 0.02], [da, 2.75, F + 0.02], rD);
      A.box(da - 0.6, 2.9, F, db + 0.6, 3.1, F + 1.6, { all: col(0x22262c, 0x34383e), top: col(0x3a3e44) }); // canopy
      A.box(da - 0.4, 3.1, F + 1.45, db + 0.4, 3.75, F + 1.6, { all: col(0x22262c), s: a.paint((db - da + 0.8) * 64, 0.65 * 64, (c, w, h) => art.fasciaSign(c, w, h, b.sign?.text ?? "TEAM HOTEL", 0x22262c, 0xf4f1ea, { font: art.SERIF, edge: 0xb8923a })) });
      this.halo(p, [(da + db) / 2, 1.5, F + 0.4], 6, 0xfff0c0, 0.22); this.pool(p, (da + db) / 2, F + 1.6, 2.6, 1.8, 0xfff0c0, 0.24); this.spec.streaks.push([da + 0.2, F + 0.1, db - da - 0.4, 3.2, 0xfff0c0, 0.36]);
    }
    flatRoofClutter(this, p, x0 + 1, z0 + 1, x1 - 1, z1 - 2.5, e + 0.05, 77, false);
    hotelDressing(this, p, b);
    this.roofFn.set(b.id, () => e + 0.07);
  }

  private cabin(p: Part, b: BuildingSpec) {
    const { A } = p, a = this.atlas, { x0, y0: z0, x1, y1: z1 } = b.rect, e = b.height, W = x1 - x0, F = z1 + 0.03;
    A.quad([x0, 0, F], [x1, 0, F], [x1, e, F], [x0, e, F], a.paintM(W, e, (c, w, h) => { art.cabinSide(c, w, h, 81); rect(c, w / 2 - 56, 8, 112, 16, H(0xf4f4f4)); pixText(c, b.sign?.text ?? "STEWARDS", w / 2, 21, 10, H(0x1c2a1c), { align: "center" }); }));
    this.face(A, x1 + 0.03, z1, x1 + 0.03, z0, 0, e, this.sw.cabin, 2, 2); this.face(A, x0 - 0.03, z0, x0 - 0.03, z1, 0, e, this.sw.cabin, 2, 2, 0xc0c0c0); this.face(A, x1, z0 - 0.03, x0, z0 - 0.03, 0, e, this.sw.cabin, 2, 2, 0xb0b0b0);
    this.roofPanel(A, [x0 - 0.1, e, z1 + 0.1], [x1 + 0.1, e, z1 + 0.1], [x1 + 0.1, e + 0.12, z0 - 0.1], [x0 - 0.1, e + 0.12, z0 - 0.1], this.sw.steelroof, 8, 6);
    cabinDressing(this, p, b);
    this.roofFn.set(b.id, () => e + 0.05);
  }

  // ---------------------------------------------------------------------------------------------
  /** The ground from outside: clad walls nine metres high and a roof over each stand, the bowl open to the sky. */
  private stadium() {
    const p = this.part("stadium"), { A } = p, a = this.atlas, m = this.spec.mirror, gx0 = m ? -56.5 : -57, gx1 = m ? 57 : 56.5, Hh = SHELL_H, e = 0.04;
    const blocks = [{ x0: gx0, y0: 28, x1: gx1, y1: 45 }, { x0: gx0, y0: -61, x1: gx1, y1: -28 }, { x0: gx0, y0: -28, x1: -41, y1: 28 }, { x0: 41, y0: -28, x1: gx1, y1: 28 }];
    const bay = [a.paintM(4, Hh, (c, w, h) => art.standBay(c, w, h, 31)), a.paintM(4, Hh, (c, w, h) => art.standBay(c, w, h, 37))];
    const clad = (ax: number, az: number, bx: number, bz: number, tint: number) => { const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 4); for (let i = 0; i < n; i++) { const t0 = (i * 4) / len, t1 = Math.min(1, ((i + 1) * 4) / len); A.quad([ax + (bx - ax) * t0, 0, az + (bz - az) * t0], [ax + (bx - ax) * t1, 0, az + (bz - az) * t1], [ax + (bx - ax) * t1, Hh, az + (bz - az) * t1], [ax + (bx - ax) * t0, Hh, az + (bz - az) * t0], { r: bay[i % 2], uv: [0, 0, Math.min(1, (len - i * 4) / 4), 1], c: tint }); } };
    // The south front is the game's own painted bays (one picture), if it has them.
    const front = this.host.image(`stadfront-${this.host.venue.id}`);
    if (front) {
      const t = new THREE.CanvasTexture(front as HTMLCanvasElement); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(4, this.host.maxAniso);
      const g = new THREE.BufferGeometry(), y1 = Hh * STRETCH, z = 45.012; // (a hair in front of the wall, behind the turnstiles' and banners' pictures at 45.03)
      g.setAttribute("position", new THREE.Float32BufferAttribute([gx0, 0, z, gx1, 0, z, gx1, y1, z, gx0, y1, z], 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
      const mat = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5 }), mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; p.group.add(mesh); this.disposables.push(t, g, mat);
    } else clad(gx0, 45 + e, gx1, 45 + e, 0xffffff);
    clad(gx1 + e, 45, gx1 + e, -61, 0xd8d8d8); clad(gx1, -61 - e, gx0, -61 - e, 0xb0b0b0); clad(gx0 - e, -61, gx0 - e, 45, 0xc0c0c0);
    // The club's blue fascia round the top, and a roof over each block, higher at the pitch side.
    const band = (x0: number, z0: number, x1: number, z1: number) => { A.box(x0, Hh - 1.25, z0, x1, Hh, z1, { all: col(0x16225a, 0x1b2a6b), top: null }); A.box(x0 - 0.02, Hh - 1.25, z0 - 0.02, x1 + 0.02, Hh - 1.12, z1 + 0.02, { all: col(0xf4f4f4), top: null }); };
    band(gx0 - 0.1, 45, gx1 + 0.1, 45.14); band(gx1, -61, gx1 + 0.14, 45); band(gx0 - 0.14, -61, gx0, 45); band(gx0 - 0.1, -61.14, gx1 + 0.1, -61);
    const lift = 1.6;
    for (const [i, b] of blocks.entries()) {
      // which edge faces the pitch: south block its north edge, north block its south, and so on
      const hS = i === 1 ? Hh + lift : Hh, hN = i === 0 ? Hh + lift : Hh, hW = i === 3 ? Hh + lift : Hh, hE = i === 2 ? Hh + lift : Hh;
      const c00 = Math.max(hN, hW) > Hh ? (i === 0 ? hN : i === 3 ? hW : Hh) : Hh;
      void c00;
      const yAt = (x: number, z: number) => (i === 0 ? Hh + lift * (1 - (z - b.y0) / (b.y1 - b.y0)) : i === 1 ? Hh + lift * ((z - b.y0) / (b.y1 - b.y0)) : i === 2 ? Hh + lift * ((x - b.x0) / (b.x1 - b.x0)) : Hh + lift * (1 - (x - b.x0) / (b.x1 - b.x0)));
      void hS; void hE;
      this.roofPanel(A, [b.x0, yAt(b.x0, b.y1), b.y1], [b.x1, yAt(b.x1, b.y1), b.y1], [b.x1, yAt(b.x1, b.y0), b.y0], [b.x0, yAt(b.x0, b.y0), b.y0], this.sw.steelroof, 8, 6);
      // the open edge towards the pitch: a deep blue fascia
      if (i === 0) A.box(b.x0, Hh + lift - 0.9, b.y0 - 0.1, b.x1, Hh + lift, b.y0, { all: col(0x16225a, 0x1b2a6b), top: null });
      if (i === 1) A.box(b.x0, Hh + lift - 0.9, b.y1, b.x1, Hh + lift, b.y1 + 0.1, { all: col(0x16225a, 0x1b2a6b), top: null });
      if (i === 2) A.box(b.x1, Hh + lift - 0.9, b.y0, b.x1 + 0.1, Hh + lift, b.y1, { all: col(0x16225a, 0x1b2a6b), top: null });
      if (i === 3) A.box(b.x0 - 0.1, Hh + lift - 0.9, b.y0, b.x0, Hh + lift, b.y1, { all: col(0x16225a, 0x1b2a6b), top: null });
      // strips of old clear sheeting between the trusses, a walkway along the high edge, rust running to the gutter
      {
        const wideB = b.x1 - b.x0 > b.y1 - b.y0, L = wideB ? b.x1 - b.x0 : b.y1 - b.y0, Dp = wideB ? b.y1 - b.y0 : b.x1 - b.x0, rr = rng(120 + i);
        const pt = (t: number, u: number, up = 0.02): V3 => { const x = wideB ? b.x0 + t : b.x0 + u, z = wideB ? b.y0 + u : b.y0 + t; return [x, yAt(x, z) + up, z]; };
        const strip = (t0: number, t1: number, u0: number, u1: number, f: { c: number; c2?: number } | Region, up = 0.02) => (wideB ? A.quad(pt(t0, u1, up), pt(t1, u1, up), pt(t1, u0, up), pt(t0, u0, up), f) : A.quad(pt(t1, u0, up), pt(t1, u1, up), pt(t0, u1, up), pt(t0, u0, up), f));
        for (let t = 5; t < L - 3; t += 8) { const k = rr(); strip(t, t + 1.3, Dp * 0.14, Dp * 0.86, k < 0.75 ? { c: 0x8fa6b4, c2: 0xb4c6d0 } : { c: 0x6f7f8a, c2: 0x8a9aa4 }); if (rr() < 0.5) strip(t + 2.2 + rr() * 2, t + 2.5 + rr() * 2 + 0.2, Dp * (0.1 + rr() * 0.3), Dp * 0.98, { c: 0x6a4a34, c2: 0x545a62 }, 0.015); }
        const uHi = i === 0 ? 0.06 : i === 1 ? 0.94 : i === 2 ? 0.94 : 0.06; // which side is the high (pitch) edge
        strip(1, L - 1, Dp * uHi - 0.45, Dp * uHi + 0.45, { c: 0x4a4f56, c2: 0x6a7078 }, 0.05);
        for (let t = 1; t < L - 1; t += 2.4) { const a0 = pt(t, Dp * uHi - 0.45, 0.05), a1: V3 = [a0[0], a0[1] + 0.9, a0[2]]; A.bar(a0, a1, 0.05, col(0xc9a23a)); }
        A.bar(((q) => [q[0], q[1] + 0.9, q[2]] as V3)(pt(1, Dp * uHi - 0.45, 0.05)), ((q) => [q[0], q[1] + 0.9, q[2]] as V3)(pt(L - 1, Dp * uHi - 0.45, 0.05)), 0.05, col(0xc9a23a));
      }
      // rooflights and plant, so the roof is not a blank sheet
      const wide = b.x1 - b.x0 > b.y1 - b.y0, r = rng(90 + i);
      for (let k = 0; k < (wide ? 7 : 4); k++) {
        const x = wide ? b.x0 + 8 + k * 15 : (b.x0 + b.x1) / 2 + (k % 2 ? 2 : -3), z = wide ? (b.y0 + b.y1) / 2 + (k % 2 ? 2 : -3) : b.y0 + 7 + k * 13, y = yAt(x, z);
        A.box(x, y, z, x + 1.0, y + 0.6, z + 0.8, { all: this.sw.ac, top: this.sw.acTop });
        if (r() < 0.7) A.box(x + 4, y, z - 1, x + 6.4, y + 0.14, z + 0.6, { all: col(0x3a4048), top: col(0x9db4c4, 0xb8ccd8) });
      }
      this.shaders.push([b.x0, b.y0, b.x1, b.y1, Hh]);
    }
    this.spec.ao.push([gx0, 45, gx1, 45.2, Hh], [gx1, -61, gx1 + 0.2, 45, Hh], [gx0 - 0.2, -61, gx0, 45, Hh]);
    this.finish(p, true);
    this.roofFn.set("stand", (y) => SHELL_H + lift * (1 - (y - 28) / 17) + 0.05);
  }

  // ---------------------------------------------------------------------------------------------
  /** How high the roof of a building stands at depth y (so whoever is up there stands on it). */
  roofLift(id: string, y: number): number | null { const f = this.roofFn.get(id); return f ? f(y) : null; }

  /** Take the lid off whatever you are inside; open or shut the gates. */
  setCut(room: string | null, inside: boolean, openGates: (id: string) => boolean) {
    this.insideNow = inside;
    for (const [id, g] of this.shells) g.visible = id === "stadium" ? !inside : id !== room;
    for (const q of this.whens) q.g.visible = q.when === "inside" ? inside : q.when === "outside" ? !inside : q.when === "terrace" ? inside && this.liftAsked : q.when === "stand_n" ? inside && this.liftAsked && !this.northCut : q.when === "stand_n_flat" ? inside && (this.northCut || !this.liftAsked) : q.when === `room:${room}`;
    for (const [id, g] of this.gates) g.visible = !openGates(id);
  }

  /** Make sure the ground is painted wherever the camera can see: the rectangle given, in metres. */
  ground(x0: number, z0: number, x1: number, z1: number, budget = 2) {
    this.frame++;
    // The middle of what the camera sees. Behind the main stand (the corridor, the dressing rooms) the stand lies flat, or it would hide them.
    this.focus.x = (x0 + x1) / 2; this.focus.z = (z0 + z1) / 2;
    if (this.northCut ? this.focus.z > -35.5 : this.focus.z < -36.5) this.northCut = !this.northCut;
    const c0x = Math.floor(x0 / CHUNK_M), c1x = Math.floor(x1 / CHUNK_M), c0z = Math.floor(z0 / CHUNK_M), c1z = Math.floor(z1 / CHUNK_M);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const key = `${cx},${cz}`;
      let ch = this.chunks.get(key);
      if (!ch) {
        if (budget-- <= 0) continue;
        const t0 = performance.now(), cv = paintChunk(this.spec, cx, cz);
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = Math.min(4, this.host.maxAniso); tex.generateMipmaps = true;
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const g = new THREE.BufferGeometry(), X0 = cx * CHUNK_M, Z0 = cz * CHUNK_M, X1 = X0 + CHUNK_M, Z1 = Z0 + CHUNK_M;
        g.setAttribute("position", new THREE.Float32BufferAttribute([X0, 0, Z1, X1, 0, Z1, X1, 0, Z0, X0, 0, Z0], 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
        const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.name = "ground";
        this.root.add(mesh); ch = { mesh, tex, used: this.frame }; this.chunks.set(key, ch); this.groundMat.push(mat);
        this.stats.paintMs = performance.now() - t0; this.stats.chunks = this.chunks.size;
      }
      ch.used = this.frame;
    }
    if (this.chunks.size > 40) for (const [k, ch] of this.chunks) if (this.frame - ch.used > 240 && this.chunks.size > 32) { this.root.remove(ch.mesh); ch.mesh.geometry.dispose(); (ch.mesh.material as THREE.Material).dispose(); ch.tex.dispose(); this.chunks.delete(k); }
  }

  dispose() {
    for (const ch of this.chunks.values()) { ch.mesh.geometry.dispose(); (ch.mesh.material as THREE.Material).dispose(); ch.tex.dispose(); }
    for (const d of this.disposables) d.dispose();
    this.root.removeFromParent();
  }
}
void PXM; void CY;

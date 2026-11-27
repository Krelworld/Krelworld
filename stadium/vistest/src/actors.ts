// People and the dog: the game's own pixel sprites on upright quads that face the camera.
// A quad stands vertical (so walls hide it properly) and is stretched by 1/cos(pitch) so the sprite
// lands on screen at exactly one art pixel per CSS pixel.
import * as THREE from "three";
import { FWD, LIGHT, PITCH, PX_PER_M, RIGHT, STRETCH, YAW } from "./cfg";
import type { Box } from "./world";

const CELL = 88, FEET = 73, CROP = 79; // rows of an 88 px cell: where the feet are, and where we cut the quad off
const DIRS = [2, 1, 0, 7, 6, 5, 4, 3]; // sheet order is S, SE, E, NE, N, NW, W, SW

/** Sheet direction for a movement on the ground (world x, z). */
export function dirOf(vx: number, vz: number): number {
  const sx = vx * RIGHT.x + vz * RIGHT.z, sy = -(vx * FWD.x + vz * FWD.z); // screen right, screen down
  const k = Math.round(((Math.atan2(sy, sx) % (2 * Math.PI)) + 2 * Math.PI) / (Math.PI / 4)) % 8;
  return DIRS[k];
}

export interface Sheet { tex: THREE.Texture; cols: number; rows: number }
export type Sheets = Record<string, Sheet>;

const loader = new THREE.ImageLoader();
function prep(t: THREE.Texture): THREE.Texture {
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
/** Load `art/<base>-<name>.png` for each name. Standing sheets are one row of 8; everything else is 8 x 8. */
export async function loadSheets(base: string, names: string[], recolour?: (d: Uint8ClampedArray, w: number, h: number, cell: number) => void): Promise<Sheets> {
  const out: Sheets = {};
  await Promise.all(names.map(async (n) => {
    const img = await loader.loadAsync(`art/${base}-${n}.png`);
    let src: HTMLImageElement | HTMLCanvasElement = img;
    if (recolour) {
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext("2d")!; cx.drawImage(img, 0, 0);
      const id = cx.getImageData(0, 0, cv.width, cv.height); recolour(id.data, cv.width, cv.height, img.width / 8); cx.putImageData(id, 0, 0);
      src = cv;
    }
    const rows = n === "rot" ? 1 : 8; out[n] = { tex: prep(new THREE.Texture(src)), cols: Math.round(img.width / (img.height / rows)), rows }; // some sheets run to nine frames
  }));
  return out;
}

/** White replica shirt to brewery orange (the drayman's polo). Same test the game uses: pale and unsaturated, between the collar and the belt. */
export function orangeShirt(d: Uint8ClampedArray, w: number, h: number, cell: number) {
  const k = cell / CELL;
  for (let y = 0; y < h; y++) {
    const cy = (y % cell) / k;
    if (cy < 26 || cy > 53) continue;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (d[i + 3] < 100) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 510 - mx - mn : mx + mn);
      if (s < 0.3 && l > 0.5) { const q = Math.min(1.08, l / 0.9); d[i] = Math.min(255, 236 * q); d[i + 1] = Math.min(255, 108 * q * q); d[i + 2] = Math.min(255, 28 * q * q); }
    }
  }
}

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial;
  x = 0; z = 0; y = 0; dir = 0; moving = false; t = Math.random() * 10; speed = 0;
  private uv: THREE.BufferAttribute; private cur = ""; private shadeK = 0; private shadeT = Math.random() * 0.2; private shadeTarget = 0;
  anim = "rot"; fps = 8;
  constructor(public sheets: Sheets, public cellM = CELL / PX_PER_M) {
    const w = cellM, h = cellM * (CROP / CELL) * STRETCH;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, w / 2, h, 0, -w / 2, h, 0], 3));
    this.uv = new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2); g.setAttribute("uv", this.uv);
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.mat = new THREE.MeshBasicMaterial({ map: sheets.rot.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.rotation.y = YAW; this.mesh.castShadow = true; this.mesh.frustumCulled = false;
  }
  private ghost: THREE.MeshBasicMaterial | null = null;
  /** Draw the figure again, faintly, wherever something stands in front of it: the usual cure for a player lost behind a wall. One extra draw call. */
  seeThrough() {
    this.ghost = new THREE.MeshBasicMaterial({ map: this.mat.map, alphaTest: 0.5, color: 0xbfe0ff, transparent: true, opacity: 0.42, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
    const m = new THREE.Mesh(this.mesh.geometry, this.ghost); m.frustumCulled = false; m.renderOrder = 3; this.mesh.add(m);
    return this;
  }
  place(x: number, z: number, dir = this.dir) { this.x = x; this.z = z; this.dir = dir; return this; }
  private frame(name: string, col: number, row: number) {
    const key = `${name}:${col}:${row}`; if (key === this.cur) return; this.cur = key;
    const s = this.sheets[name] ?? this.sheets.rot;
    if (this.mat.map !== s.tex) { this.mat.map = s.tex; if (this.ghost) this.ghost.map = s.tex; }
    const u0 = col / s.cols, u1 = (col + 1) / s.cols, v1 = 1 - row / s.rows, v0 = 1 - (row + CROP / CELL) / s.rows;
    this.uv.setXY(0, u0, v0); this.uv.setXY(1, u1, v0); this.uv.setXY(2, u1, v1); this.uv.setXY(3, u0, v1); this.uv.needsUpdate = true;
  }
  update(dt: number, shaders: Box[]) {
    this.t += dt;
    const name = this.sheets[this.anim] ? this.anim : "rot";
    if (name === "rot") this.frame("rot", this.dir, 0); else this.frame(name, Math.floor(this.t * this.fps) % this.sheets[name].cols, this.dir);
    // The quad's bottom edge is six art pixels below the feet: stand it that much nearer the camera so the feet land on the spot.
    const back = ((CROP - FEET) / CELL) * this.cellM / Math.sin(PITCH);
    this.mesh.position.set(this.x - FWD.x * back, this.y, this.z - FWD.z * back);
    // Nobody is lit in the shade of a building: a cheap ray toward the sun against the big boxes.
    this.shadeT -= dt;
    if (this.shadeT <= 0) { this.shadeT = 0.12; this.shadeTarget = inShade(this.x, this.y + 1.2, this.z, shaders) ? 1 : 0; }
    this.shadeK += (this.shadeTarget - this.shadeK) * Math.min(1, dt * 8);
    const k = this.shadeK; this.mat.color.setRGB(0.98 - 0.3 * k, 0.98 - 0.27 * k, 0.98 - 0.2 * k);
  }
}

export function inShade(x: number, y: number, z: number, boxes: Box[]): boolean {
  const dx = -LIGHT.x, dy = -LIGHT.y, dz = -LIGHT.z;
  for (const b of boxes) {
    let t0 = 0, t1 = 60;
    const slab = (o: number, d: number, lo: number, hi: number) => { if (Math.abs(d) < 1e-6) return o >= lo && o <= hi; let a = (lo - o) / d, c = (hi - o) / d; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); return t0 <= t1; };
    if (slab(x, dx, b.x0, b.x1) && slab(y, dy, 0, b.h * STRETCH) && slab(z, dz, b.z0, b.z1) && t1 > 0.05) return true;
  }
  return false;
}

/** Circle against boxes, sliding. */
export function collide(x: number, z: number, r: number, boxes: Box[]): [number, number] {
  for (let pass = 0; pass < 2; pass++) for (const b of boxes) {
    const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
    let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
    else { // centre is inside: out through the nearest face
      const l = x - b.x0, rr = b.x1 - x, t = z - b.z0, bb = b.z1 - z, m = Math.min(l, rr, t, bb);
      if (m === l) x = b.x0 - r; else if (m === rr) x = b.x1 + r; else if (m === t) z = b.z0 - r; else z = b.z1 + r;
      dx = dz = 0;
    }
  }
  return [x, z];
}

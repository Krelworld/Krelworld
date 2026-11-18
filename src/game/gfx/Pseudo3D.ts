import Phaser from "phaser";
import * as Juice from "./Juice";
import { FONT } from "../ui/theme";

/**
 * PSEUDO-3D SHOTS: the intro flyover's renderer (scenes/hub/flyover.ts), made reusable for short camera moves in
 * cutscenes (orbits, swoops, fly-ups, a tower coming down).
 *
 * The idea is the flyover's: a simple perspective camera that we project points through ourselves. The ground is a
 * Mesh whose vertices are moved every frame; every tall thing is a cut-out (a "board") packed into one atlas and stood
 * up as a camera-facing quad in a second Mesh, so a whole set is two or three draw calls. Sky, fog and haze sit on
 * the horizon line. Everything is drawn once at the start; per frame only vertex positions/colours change.
 *
 * A shot runs in its own little overlay scene on top of the caller (`playShot`), so the caller's camera zoom, HUD and
 * input are left alone, and its textures are freed when it ends (played out, skipped, or the caller shutting down).
 * Without WebGL (no meshes) shots resolve straight away and the caller just carries on.
 *
 * Coordinates: world x east, y south (as in a top-down map), z up. Yaw 0 looks north (-y), pitch is degrees below the
 * horizon (negative looks up).
 */

export const SW = 960;
export const SH = 540;
/** Focal length (px): 1 world px = 1 screen px at this distance, looking straight down. */
export const FOCAL = 600;
export const NEAR = 30;
export const DEG = Math.PI / 180;

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** radians */
  yaw: number;
  pitch: number;
  roll: number;
}
/** A camera aimed at a point on the ground: from `d` away, `p` degrees below the horizon, heading `yaw` degrees (0 = north), roll `r` degrees. */
export interface Aim {
  x: number;
  y: number;
  d: number;
  p: number;
  yaw: number;
  r: number;
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
export const easeIO3 = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const easeOut3 = (u: number) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
export const easeIn2 = (u: number) => clamp(u, 0, 1) * clamp(u, 0, 1);
/** 0 before a, 1 after b, eased between. */
export const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export const mixC = (a: number, b: number, k: number) =>
  (Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k)) << 16) | (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));
export const mulC = (a: number, b: number) =>
  ((((((a >> 16) & 255) * ((b >> 16) & 255)) / 255) | 0) << 16) | ((((((a >> 8) & 255) * ((b >> 8) & 255)) / 255) | 0) << 8) | ((((a & 255) * (b & 255)) / 255) | 0);

export function aimToPose(a: Aim): Pose {
  const yaw = a.yaw * DEG;
  const p = a.p * DEG;
  const fx = Math.cos(p) * Math.sin(yaw);
  const fy = -Math.cos(p) * Math.cos(yaw);
  const fz = -Math.sin(p);
  return { x: a.x - fx * a.d, y: a.y - fy * a.d, z: -fz * a.d, yaw, pitch: p, roll: a.r * DEG };
}

/** A camera at `from` looking at `to` (world points), rolled `rollDeg`. */
export function lookAt(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, rollDeg = 0): Pose {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return { x: from.x, y: from.y, z: from.z, yaw: Math.atan2(dx, -dy), pitch: Math.atan2(-dz, Math.hypot(dx, dy) || 1e-6), roll: rollDeg * DEG };
}

/** Between two aims; `hop` lifts the camera up and back mid-move (and banks it into the turn). */
export function lerpAim(a: Aim, b: Aim, u: number, hop = 0): Aim {
  let dy = b.yaw - a.yaw;
  while (dy > 180) dy -= 360;
  while (dy < -180) dy += 360;
  const arc = Math.sin(Math.PI * u);
  return {
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    d: Math.exp(lerp(Math.log(a.d), Math.log(b.d), u)) * (1 + hop * arc),
    p: lerp(a.p, b.p, u) - hop * 10 * arc,
    yaw: a.yaw + dy * u,
    r: lerp(a.r, b.r, u) + clamp(-dy * 0.22, -12, 12) * arc * (hop > 0 ? 1 : 0),
  };
}

/**
 * A smooth (Catmull-Rom) camera path through timed aims; headings unwind so it turns the short way round. With
 * `settle`, it eases away from the first key and into the last.
 */
export function aimPath(keys: [number, Aim][], t: number, settle = true): Aim {
  if (t <= keys[0][0]) return keys[0][1];
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  let u = clamp((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), 0, 1);
  if (settle && i === 0) u = u * u * (2 - u);
  if (settle && i === n - 2) u = 1 - (1 - u) * (1 - u) * (1 + u);
  const k = (i + u) / (n - 1);
  const yaws: number[] = [];
  for (const [, a] of keys) {
    let y = a.yaw;
    const prev = yaws[yaws.length - 1];
    if (prev !== undefined) {
      while (y - prev > 180) y -= 360;
      while (y - prev < -180) y += 360;
    }
    yaws.push(y);
  }
  const cr = (f: (a: Aim) => number) => Phaser.Math.Interpolation.CatmullRom(keys.map(([, a]) => f(a)), k);
  return { x: cr((a) => a.x), y: cr((a) => a.y), d: Math.exp(cr((a) => Math.log(a.d))), p: cr((a) => a.p), yaw: Phaser.Math.Interpolation.CatmullRom(yaws, k), r: cr((a) => a.r) };
}

export class Projector {
  fx = 0;
  fy = 0;
  fz = 0;
  rx = 0;
  ry = 0;
  ux = 0;
  uy = 0;
  uz = 0;
  cr = 1;
  sr = 0;
  p: Pose = { x: 0, y: 0, z: 1000, yaw: 0, pitch: Math.PI / 2, roll: 0 };
  set(p: Pose) {
    this.p = p;
    const cp = Math.cos(p.pitch);
    this.fx = cp * Math.sin(p.yaw);
    this.fy = -cp * Math.cos(p.yaw);
    this.fz = -Math.sin(p.pitch);
    this.rx = Math.cos(p.yaw);
    this.ry = Math.sin(p.yaw);
    this.ux = -this.fz * this.ry;
    this.uy = this.fz * this.rx;
    this.uz = this.fx * this.ry - this.fy * this.rx;
    this.cr = Math.cos(p.roll);
    this.sr = Math.sin(p.roll);
  }
  /** Screen x, y and the depth along the view (clamped to the near plane: check `zc` against NEAR yourself). Reused object. */
  out = { x: 0, y: 0, zc: 0 };
  project(x: number, y: number, z: number) {
    const dx = x - this.p.x;
    const dy = y - this.p.y;
    const dz = z - this.p.z;
    const zc = dx * this.fx + dy * this.fy + dz * this.fz;
    const xr = dx * this.rx + dy * this.ry;
    const yu = dx * this.ux + dy * this.uy + dz * this.uz;
    const z2 = Math.max(zc, NEAR);
    const sx = (FOCAL * xr) / z2;
    const sy = (-FOCAL * yu) / z2;
    this.out.x = SW / 2 + sx * this.cr - sy * this.sr;
    this.out.y = SH / 2 + sx * this.sr + sy * this.cr;
    this.out.zc = zc;
    return this.out;
  }
  /** Where the horizon crosses the screen's vertical centre line (before roll). */
  horizonY() {
    return SH / 2 - FOCAL * Math.tan(clamp(this.p.pitch, -1.45, 1.45));
  }
}

/** Can this device do pseudo-3D (meshes need WebGL)? */
export const can3d = (sc: Phaser.Scene) => sc.game.renderer.type === Phaser.WEBGL;

// ------------------------------------------------------------------------------------------------ meshes

/**
 * addVertices makes a vertex per index; make the faces share one vertex per point instead, so `m.vertices[i]` is
 * point i and moving it moves every triangle that uses it.
 */
function shareVerts(m: Phaser.GameObjects.Mesh, ix: number[], n: number) {
  const all = m.vertices;
  const pts: Phaser.Geom.Mesh.Vertex[] = new Array(n);
  ix.forEach((p, k) => (pts[p] ??= all[k]));
  m.faces.forEach((f, k) => {
    f.vertex1 = pts[ix[k * 3]];
    f.vertex2 = pts[ix[k * 3 + 1]];
    f.vertex3 = pts[ix[k * 3 + 2]];
  });
  m.vertices = pts;
}

/** A (cols x rows) grid of vertices over [u0..u1] x [v0..v1], in row-major order, with its triangles. */
function gridMesh(m: Phaser.GameObjects.Mesh, cols: number, rows: number, u0: number, v0: number, u1: number, v1: number, color: number) {
  const v: number[] = [];
  const uv: number[] = [];
  const ix: number[] = [];
  const cs: number[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      v.push(0, 0);
      uv.push(lerp(u0, u1, i / cols), lerp(v0, v1, j / rows));
      cs.push(color);
    }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      ix.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
    }
  m.addVertices(v, uv, ix, false, undefined, cs);
  shareVerts(m, ix, (cols + 1) * (rows + 1));
  m.hideCCW = false;
  m.setOrtho(SW, SH);
  m.ignoreDirtyCache = true;
}

// ------------------------------------------------------------------------------------------------ the set

/** A cut-out to stand up in the set. `w`/`h` are its world size; `z` lifts its base; `ox` slides it sideways (in the camera's right direction). */
export interface BoardSpec {
  key: string;
  frame?: string | number;
  /** a sub-rectangle of the frame, in its pixels [x, y, w, h] (for slicing a picture into pieces) */
  crop?: [number, number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  ox?: number;
  tint?: number;
  flipX?: boolean;
  /** lies flat on the ground over this world rectangle [x0, y0, x1, y1] instead of standing up */
  flat?: [number, number, number, number];
}

/** A board in a set. Everything below `vi` can be changed per frame to animate it. */
export interface Board3D {
  x: number;
  y: number;
  hw: number;
  h: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  vi: number;
  flat?: [number, number, number, number];
  /** base height, and sideways offset along the camera's right vector */
  z: number;
  ox: number;
  /** extra world offset */
  dx: number;
  dy: number;
  dz: number;
  /** falls over (radians) towards heading `tiltYaw` (radians, 0 = north) */
  tilt: number;
  tiltYaw: number;
  /** spins in its own plane about its middle (radians) */
  spin: number;
  scale: number;
  alpha: number;
  tint: number;
  /** 0..1: how much of it is hidden from the bottom up (sunk into the ground: its base stays at the ground line) */
  cut?: number;
}

/** An image placed in the set (dust, glows, sparks, clouds): scaled by distance, faces the screen. */
export interface Sprite3D {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  z: number;
  /** world width */
  size: number;
  alpha: number;
  spin: number;
  /** "auto": in front of the boards when nearer than the aim point, behind otherwise */
  layer: "back" | "front" | "auto";
  /** does fog / light colour it (dust: yes; glows: no) */
  lit: boolean;
  tint: number;
}

interface Ground {
  mesh: Phaser.GameObjects.Mesh;
  cols: number;
  rows: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z: number;
  color: number;
}

export interface SkyOpts {
  top: number;
  horizon: number;
  /** below the horizon (mostly hidden by the ground) */
  below?: number;
  stars?: number;
  /** an image laid along the horizon (a skyline): its bottom sits on the horizon */
  image?: { key: string; frame?: string | number; scale: number; tint?: number; alpha?: number };
}

let uid = 0;

export class Stage3D {
  readonly P = new Projector();
  /** the light on everything (lightning: mix it towards white) */
  light = 0xffffff;
  /** 0..1: how much a flash whitens the set this frame */
  flash = 0;
  fog = { color: 0x1a1030, start: 1200, span: 6000, max: 0.8 };
  /** how far boards lean up as the camera comes down towards the horizon: the flyover's 80, or 90 (always upright) */
  maxLean = 90;
  readonly made: Phaser.GameObjects.GameObject[] = [];
  private texKeys: string[] = [];
  private crops: [Phaser.Textures.Texture, string][] = [];
  private grounds: Ground[] = [];
  private groups: { mesh: Phaser.GameObjects.Mesh; boards: Board3D[]; light?: number }[] = [];
  readonly sprites: Sprite3D[] = [];
  private sky?: Phaser.GameObjects.Container;
  private haze: Phaser.GameObjects.Graphics;
  private flashRect: Phaser.GameObjects.Rectangle;
  readonly id = ++uid;
  /** distance to the point the camera is looking at (for "auto" sprite layering); set by render */
  aimD = 1000;

  constructor(readonly sc: Phaser.Scene, readonly depth = 0) {
    this.haze = this.keep(sc.add.graphics().setDepth(depth + 3));
    this.flashRect = this.keep(sc.add.rectangle(SW / 2, SH / 2, SW + 80, SH + 80, 0xeef2ff, 0).setDepth(depth + 30));
  }

  keep<T extends Phaser.GameObjects.GameObject>(g: T): T {
    this.made.push(g);
    return g;
  }

  /** A temporary texture this set owns (removed with it). */
  key(name: string) {
    const k = `__p3d${this.id}_${name}`;
    this.texKeys.push(k);
    if (this.sc.textures.exists(k)) this.sc.textures.remove(k);
    return k;
  }

  setSky(o: SkyOpts) {
    const sc = this.sc;
    const c = this.keep(sc.add.container(SW / 2, 0).setDepth(this.depth));
    const g = sc.add.graphics();
    g.fillStyle(o.top, 1).fillRect(-1600, -2400, 3200, 2400 - 700);
    g.fillGradientStyle(o.top, o.top, o.horizon, o.horizon, 1).fillRect(-1600, -700, 3200, 700);
    g.fillStyle(o.below ?? o.horizon, 1).fillRect(-1600, 0, 3200, 2400);
    if (o.stars) {
      const rnd = new Phaser.Math.RandomDataGenerator([`stars${this.id}`]);
      for (let i = 0; i < o.stars; i++) {
        g.fillStyle(0xffffff, rnd.realInRange(0.25, 0.8));
        const s = rnd.frac() < 0.15 ? 2 : 1;
        g.fillRect(rnd.realInRange(-1500, 1500), rnd.realInRange(-1200, -120), s, s);
      }
    }
    c.add(g);
    if (o.image && sc.textures.exists(o.image.key)) {
      const im = sc.add.image(0, 2, o.image.key, o.image.frame).setOrigin(0.5, 1).setScale(o.image.scale).setAlpha(o.image.alpha ?? 1);
      if (o.image.tint !== undefined) im.setTint(o.image.tint);
      c.add(im);
    }
    this.sky = c;
    return c;
  }

  /** A textured (or plain) ground over a world rectangle. `rt`: the texture is a render texture (stored upside down). */
  addGround(o: { key?: string; rt?: boolean; x0: number; y0: number; x1: number; y1: number; cols?: number; rows?: number; color?: number; z?: number; depth?: number }) {
    const cols = o.cols ?? 12;
    const rows = o.rows ?? 12;
    const m = this.keep(this.sc.add.mesh(0, 0, o.key ?? "__WHITE").setDepth(this.depth + (o.depth ?? 1)));
    if (o.rt) gridMesh(m, cols, rows, 0, 1, 1, 0, 0xffffff);
    else gridMesh(m, cols, rows, 0, 0, 1, 1, 0xffffff);
    const gr: Ground = { mesh: m, cols, rows, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, z: o.z ?? 0, color: o.color ?? 0xffffff };
    this.grounds.push(gr);
    return gr;
  }

  /** A ground texture drawn once: `draw` paints onto a w x h dynamic texture. */
  groundTexture(name: string, w: number, h: number, draw: (dt: Phaser.Textures.DynamicTexture) => void) {
    const k = this.key(name);
    const dt = this.sc.textures.addDynamicTexture(k, w, h)!;
    draw(dt);
    dt.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return k;
  }

  /** Pack these cut-outs into one atlas and stand them up as one mesh. Returns the boards, in order, to animate. */
  addBoards(specs: BoardSpec[], depthOff = 4): Board3D[] {
    const sc = this.sc;
    const AW = 2048;
    const src = specs.map((s, i) => {
      if (!sc.textures.exists(s.key)) return null;
      const tex = sc.textures.get(s.key);
      let frame = s.frame;
      if (s.crop) {
        const base = tex.get(s.frame);
        const name = `__p3d${this.id}_c${i}`;
        if (!tex.has(name)) tex.add(name, base.sourceIndex, base.cutX + s.crop[0], base.cutY + s.crop[1], s.crop[2], s.crop[3]);
        this.crops.push([tex, name]);
        frame = name;
      }
      const f = tex.get(frame);
      return { s, frame, fw: f.width, fh: f.height };
    });
    const live = src.filter((e): e is NonNullable<typeof e> => !!e);
    let k = 1;
    const pack = (scale: number) => {
      let x = 0;
      let y = 0;
      let row = 0;
      const at: { x: number; y: number; w: number; h: number }[] = [];
      for (const e of live) {
        const w = Math.max(1, Math.ceil(e.fw * scale)) + 2;
        const h = Math.max(1, Math.ceil(e.fh * scale)) + 2;
        if (x + w > AW) {
          x = 0;
          y += row;
          row = 0;
        }
        at.push({ x: x + 1, y: y + 1, w: w - 2, h: h - 2 });
        x += w;
        row = Math.max(row, h);
      }
      return { at, h: y + row };
    };
    let packed = pack(k);
    while (packed.h > 2048 && k > 0.25) packed = pack((k *= 0.8));
    const AH = Math.max(4, Math.min(2048, packed.h));
    const key = this.key(`atlas${this.groups.length}`);
    const atlas = sc.textures.addDynamicTexture(key, AW, AH)!;
    const boards: Board3D[] = [];
    live.forEach((e, i) => {
      const a = packed.at[i];
      if (a.y + a.h > AH) return;
      atlas.stamp(e.s.key, e.frame, a.x, a.y, { originX: 0, originY: 0, scaleX: a.w / e.fw, scaleY: a.h / e.fh });
      let u0 = a.x / AW;
      let u1 = (a.x + a.w) / AW;
      if (e.s.flipX) [u0, u1] = [u1, u0];
      boards.push(this.board({ x: e.s.x, y: e.s.y, hw: e.s.w / 2, h: e.s.h, u0, u1, v0: a.y / AH, v1: (a.y + a.h) / AH, z: e.s.z ?? 0, ox: e.s.ox ?? 0, tint: e.s.tint ?? 0xffffff, flat: e.s.flat }));
    });
    atlas.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.addAtlas(key, boards, depthOff);
    return boards;
  }

  /** A board with the animation fields filled in. */
  board(b: Partial<Board3D> & Pick<Board3D, "x" | "y" | "hw" | "h" | "u0" | "u1" | "v0" | "v1">): Board3D {
    return { vi: 0, z: 0, ox: 0, dx: 0, dy: 0, dz: 0, tilt: 0, tiltYaw: 0, spin: 0, scale: 1, alpha: 1, tint: 0xffffff, ...b };
  }

  /** Boards whose pictures are already in an atlas texture (e.g. a world snapshot). */
  addAtlas(key: string, boards: Board3D[], depthOff = 4, light?: number) {
    const m = this.keep(this.sc.add.mesh(0, 0, key).setDepth(this.depth + depthOff));
    const v: number[] = [];
    const uv: number[] = [];
    const ix: number[] = [];
    boards.forEach((b, i) => {
      b.vi = i * 4;
      v.push(0, 0, 0, 0, 0, 0, 0, 0);
      // corners: base-left, base-right, top-left, top-right (the atlas is a render texture: upside down)
      uv.push(b.u0, b.v1, b.u1, b.v1, b.u0, b.v0, b.u1, b.v0);
      ix.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
    });
    if (boards.length) {
      m.addVertices(v, uv, ix);
      shareVerts(m, ix, boards.length * 4);
    }
    m.hideCCW = false;
    m.setOrtho(SW, SH);
    m.ignoreDirtyCache = true;
    this.groups.push({ mesh: m, boards, light });
    return m;
  }

  addSprite(key: string, x: number, y: number, z: number, size: number, o: Partial<Pick<Sprite3D, "alpha" | "layer" | "lit" | "tint" | "spin">> & { add?: boolean; frame?: string | number; originY?: number } = {}): Sprite3D {
    const img = this.keep(this.sc.add.image(0, 0, key, o.frame).setVisible(false).setOrigin(0.5, o.originY ?? 0.5));
    if (o.add) img.setBlendMode(Phaser.BlendModes.ADD);
    const s: Sprite3D = { img, x, y, z, size, alpha: o.alpha ?? 1, spin: o.spin ?? 0, layer: o.layer ?? "auto", lit: o.lit ?? !o.add, tint: o.tint ?? 0xffffff };
    this.sprites.push(s);
    return s;
  }

  /** A soft round blob texture (glows, dust), white: tint it. */
  softDot(name = "dot", hard = 0.35) {
    const k = `__p3d_dot_${name}`;
    if (this.sc.textures.exists(k)) return k;
    const c = this.sc.textures.createCanvas(k, 64, 64);
    if (!c) return "__WHITE";
    const ctx = c.getContext();
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(hard, "rgba(255,255,255,0.5)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    c.refresh();
    return k;
  }

  private fogAt(zc: number) {
    return clamp((zc - this.fog.start) / this.fog.span, 0, this.fog.max);
  }

  /** Draw the set from this camera. */
  render(pose: Pose) {
    const P = this.P;
    P.set(pose);
    const D = this.depth;
    const lightNow = this.flash > 0 ? mixC(this.light, 0xffffff, clamp(this.flash, 0, 1) * 0.7) : this.light;
    const fogC = this.flash > 0 ? mixC(this.fog.color, 0xffffff, clamp(this.flash, 0, 1) * 0.4) : this.fog.color;
    const hz = P.horizonY();
    const hx = SW / 2 - Math.sin(pose.roll) * (hz - SH / 2);
    const hy = SH / 2 + Math.cos(pose.roll) * (hz - SH / 2);
    this.sky?.setPosition(hx, hy).setRotation(pose.roll);
    this.flashRect.setAlpha(clamp(this.flash, 0, 1) * (Juice.calm() ? 0.12 : 0.35));
    // the ground
    for (const g of this.grounds) {
      const vs = g.mesh.vertices;
      const base = mulC(g.color, lightNow);
      for (let j = 0; j <= g.rows; j++)
        for (let i = 0; i <= g.cols; i++) {
          const v = vs[j * (g.cols + 1) + i];
          const q = P.project(lerp(g.x0, g.x1, i / g.cols), lerp(g.y0, g.y1, j / g.rows), g.z);
          v.x = q.x;
          v.y = -q.y;
          v.color = mixC(base, fogC, this.fogAt(q.zc));
          v.alpha = 1;
        }
    }
    // the horizon haze
    this.haze.clear();
    if (hz > -300 && hz < SH + 300) {
      this.haze.setPosition(hx, hy).setRotation(pose.roll);
      this.haze.fillGradientStyle(fogC, fogC, fogC, fogC, 0, 0, 0.85, 0.85).fillRect(-1600, -40, 3200, 40);
      this.haze.fillGradientStyle(fogC, fogC, fogC, fogC, 0.85, 0.85, 0, 0).fillRect(-1600, 0, 3200, 110);
    }
    // the boards: lean up out of the ground as the camera comes down towards the horizon, facing its heading
    const lean = clamp((90 - pose.pitch / DEG) * 1.15, 0, this.maxLean) * DEG;
    const hxv = Math.sin(pose.yaw);
    const hyv = -Math.cos(pose.yaw);
    const lx = Math.cos(pose.yaw);
    const ly = Math.sin(pose.yaw);
    const up = Math.sin(lean);
    const back = Math.cos(lean);
    const fk = clamp(lean / (40 * DEG), 0, 1);
    const ax = lerp(1, lx, fk);
    const ay = lerp(0, ly, fk);
    const al = Math.hypot(ax, ay) || 1;
    const ex = ax / al;
    const ey = ay / al;
    const bx = lerp(0, hxv, fk);
    const by = lerp(-1, hyv, fk);
    const bl = Math.hypot(bx, by) || 1;
    // the standing "up" vector (leaned back along the heading)
    const Ux = (bx / bl) * back;
    const Uy = (by / bl) * back;
    const Uz = up;
    const pts = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    this.aimD = Math.max(300, pose.z / Math.max(0.12, Math.sin(Math.max(0.02, pose.pitch))));
    for (const grp of this.groups) {
      const bv = grp.mesh.vertices;
      const light = grp.light !== undefined ? mulC(grp.light, lightNow) : lightNow;
      for (const b of grp.boards) {
        if (b.flat) {
          const [x0, y0, x1, y1] = b.flat;
          pts[0] = [x0 + b.dx, y1 + b.dy, 0.5 + b.dz];
          pts[1] = [x1 + b.dx, y1 + b.dy, 0.5 + b.dz];
          pts[2] = [x0 + b.dx, y0 + b.dy, 0.5 + b.dz];
          pts[3] = [x1 + b.dx, y0 + b.dy, 0.5 + b.dz];
        } else {
          // its own up: tipped over towards tiltYaw
          let ux = Ux;
          let uy = Uy;
          let uz = Uz;
          if (b.tilt) {
            const c = Math.cos(b.tilt);
            const s = Math.sin(b.tilt);
            ux = ux * c + Math.sin(b.tiltYaw) * s;
            uy = uy * c - Math.cos(b.tiltYaw) * s;
            uz = uz * c;
            const ul = Math.hypot(ux, uy, uz) || 1;
            ux /= ul;
            uy /= ul;
            uz /= ul;
          }
          // its sideways, kept square to its up
          const d = ex * ux + ey * uy;
          let sx = ex - d * ux;
          let sy = ey - d * uy;
          let sz = -d * uz;
          const sl = Math.hypot(sx, sy, sz) || 1;
          sx /= sl;
          sy /= sl;
          sz /= sl;
          const bxw = b.x + ex * b.ox + Ux * b.z + b.dx;
          const byw = b.y + ey * b.ox + Uy * b.z + b.dy;
          const bzw = Uz * b.z + b.dz;
          const hw = b.hw * b.scale;
          const h = b.h * b.scale;
          const cs = Math.cos(b.spin);
          const sn = Math.sin(b.spin);
          const cut = b.cut ?? 0;
          if (b.cut !== undefined) {
            const vc = lerp(b.v1, b.v0, clamp(cut, 0, 1));
            bv[b.vi].v = vc;
            bv[b.vi + 1].v = vc;
          }
          for (let c = 0; c < 4; c++) {
            const lx0 = c % 2 ? hw : -hw;
            const ly0 = (c < 2 ? cut * h : h) - h / 2;
            const lx1 = lx0 * cs - ly0 * sn;
            const ly1 = lx0 * sn + ly0 * cs + h / 2;
            pts[c][0] = bxw + sx * lx1 + ux * ly1;
            pts[c][1] = byw + sy * lx1 + uy * ly1;
            pts[c][2] = bzw + sz * lx1 + uz * ly1;
          }
        }
        let minZ = Infinity;
        let sumZ = 0;
        for (let c = 0; c < 4; c++) {
          const q = P.project(pts[c][0], pts[c][1], pts[c][2]);
          const v = bv[b.vi + c];
          v.x = q.x;
          v.y = -q.y;
          minZ = Math.min(minZ, q.zc);
          sumZ += q.zc;
        }
        const far = sumZ / 4;
        const vis = minZ > NEAR + 10 ? b.alpha : 0;
        const col = mixC(mulC(light, b.tint), fogC, this.fogAt(far));
        for (let c = 0; c < 4; c++) {
          const v = bv[b.vi + c];
          v.alpha = vis;
          v.color = col;
          // depth: far first; anything lying flat goes under everything standing
          v.z = b.flat ? 999 : clamp(far / 30, 0, 990);
        }
      }
    }
    // sprites
    for (const s of this.sprites) {
      const q = P.project(s.x, s.y, s.z);
      if (q.zc < 60 || s.alpha <= 0.002) {
        s.img.setVisible(false);
        continue;
      }
      const sc = (FOCAL * s.size) / q.zc / s.img.width;
      const r = s.img.width * sc;
      if (q.x < -r || q.x > SW + r || q.y < -r * 2 || q.y > SH + r * 2) {
        s.img.setVisible(false);
        continue;
      }
      const front = s.layer === "front" || (s.layer === "auto" && q.zc < this.aimD);
      s.img
        .setVisible(true)
        .setPosition(q.x, q.y)
        .setScale(sc)
        .setRotation(pose.roll + s.spin)
        .setAlpha(s.alpha * clamp((q.zc - 60) / 200, 0, 1))
        .setTint(s.lit ? mixC(mulC(s.tint, lightNow), fogC, this.fogAt(q.zc)) : s.tint)
        .setDepth(D + (front ? 6 : 2.5) - q.zc / 1e6);
    }
  }

  destroy() {
    for (const g of this.made) if (g.active) g.destroy();
    this.made.length = 0;
    for (const k of this.texKeys) if (this.sc.textures.exists(k)) this.sc.textures.remove(k);
    for (const [tex, name] of this.crops) if (tex.has(name)) tex.remove(name);
    this.texKeys = [];
    this.crops = [];
  }
}

// ------------------------------------------------------------------------------------------------ snapshots

/**
 * Snapshot a top-down scene's world into a set: everything flat (floors, roads, graphics) into one ground texture,
 * every tall image/sprite into a board atlas (the flyover's trick). The source scene is left as it is.
 */
export function snapshotWorld(st: Stage3D, src: Phaser.Scene, o: { worldW: number; worldH: number; skip?: Phaser.GameObjects.GameObject[]; scale?: number; maxDepth?: number; minBoardH?: number; light?: number }) {
  const skipSet = new Set(o.skip ?? []);
  const maxDepth = o.maxDepth ?? 3000;
  const world = (src.children.list as Phaser.GameObjects.GameObject[]).filter((g) => {
    const v = g as unknown as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;
    return v.visible && v.scrollFactorX === 1 && v.depth < maxDepth && !skipSet.has(g);
  });
  const order = world.map((g, i) => ({ g, i, d: (g as unknown as Phaser.GameObjects.Components.Depth).depth })).sort((a, b) => a.d - b.d || a.i - b.i);
  const minH = o.minBoardH ?? 36;
  const isBoard = (g: Phaser.GameObjects.GameObject) => {
    if (g.type !== "Image" && g.type !== "Sprite") return false;
    const im = g as Phaser.GameObjects.Image;
    return im.depth > 2 && im.displayHeight >= minH && im.alpha > 0.2 && im.rotation === 0 && im.blendMode === Phaser.BlendModes.NORMAL;
  };
  const S = o.scale ?? 0.5;
  const GW = Math.ceil(o.worldW * S);
  const GH = Math.ceil(o.worldH * S);
  const gKey = st.key("ground");
  const ground = st.sc.textures.addDynamicTexture(gKey, GW, GH)!;
  ground.camera.setOrigin(0, 0);
  ground.camera.setZoom(S);
  ground.fill(0x2a2a2a);
  ground.draw(order.filter((e) => !isBoard(e.g) && e.g.type !== "Text").map((e) => e.g));
  ground.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const bObjs = order.filter((e) => isBoard(e.g)).map((e) => e.g as Phaser.GameObjects.Image);
  const AW = 2048;
  let BS = 1;
  const pack = (scale: number) => {
    let x = 0;
    let y = 0;
    let row = 0;
    const at: { x: number; y: number; w: number; h: number }[] = [];
    for (const im of bObjs) {
      const w = Math.ceil(im.displayWidth * scale) + 2;
      const h = Math.ceil(im.displayHeight * scale) + 2;
      if (x + w > AW) {
        x = 0;
        y += row;
        row = 0;
      }
      at.push({ x: x + 1, y: y + 1, w: w - 2, h: h - 2 });
      x += w;
      row = Math.max(row, h);
    }
    return { at, h: y + row };
  };
  let packed = pack(BS);
  while (packed.h > 2048 && BS > 0.3) packed = pack((BS *= 0.8));
  const AH = Math.max(4, Math.min(2048, packed.h));
  const bKey = st.key("boards");
  const atlas = st.sc.textures.addDynamicTexture(bKey, AW, AH)!;
  const boards: Board3D[] = [];
  bObjs.forEach((im, i) => {
    const a = packed.at[i];
    if (a.y + a.h > AH) return;
    atlas.stamp(im.texture.key, im.frame.name, a.x, a.y, { originX: 0, originY: 0, scaleX: a.w / im.frame.width, scaleY: a.h / im.frame.height, tint: im.tintTopLeft, alpha: im.alpha });
    const left = im.x - im.displayWidth * im.originX;
    const top = im.y - im.displayHeight * im.originY;
    let u0 = a.x / AW;
    let u1 = (a.x + a.w) / AW;
    if (im.flipX) [u0, u1] = [u1, u0];
    boards.push(st.board({ x: left + im.displayWidth / 2, y: top + im.displayHeight, hw: im.displayWidth / 2, h: im.displayHeight, u0, u1, v0: a.y / AH, v1: (a.y + a.h) / AH }));
  });
  atlas.setFilter(Phaser.Textures.FilterMode.LINEAR);
  st.addGround({ key: gKey, rt: true, x0: 0, y0: 0, x1: o.worldW, y1: o.worldH, cols: 30, rows: 22, depth: 2, color: o.light ?? 0xffffff });
  st.addAtlas(bKey, boards, 4, o.light);
  return { boards };
}

// ------------------------------------------------------------------------------------------------ playing a shot

export interface ShotCtx {
  st: Stage3D;
  sc: Phaser.Scene;
  calm: boolean;
  /** a lower-third style caption (or a big title with `big`) */
  caption: (text: string, o?: { big?: boolean; color?: string; hold?: number }) => void;
}

export interface ShotOpts {
  /** seconds */
  length: number;
  /** builds the set, returns the per-frame camera (t in seconds) */
  build: (c: ShotCtx) => (t: number, dt: number) => Pose;
  skippable?: boolean;
  /** letterbox bars (default true) */
  bars?: boolean;
  /** ms to cross-fade in (default 350); `fromBlack`: dip from black instead */
  fadeIn?: number;
  fromBlack?: boolean;
  /** ms to fade back out to the caller (default 400); `toBlack`: dip to black instead, which lifts just after the promise resolves */
  fadeOut?: number;
  toBlack?: boolean | "hold";
  /** the colour of the dips (default black: e.g. white to come out of a white-out) */
  veilColor?: number;
  /** called once the shot fully covers the caller (move its camera then) */
  onCovered?: () => void;
}

let shotSeq = 0;

/** The overlay scene a shot runs in. */
class ShotScene extends Phaser.Scene {
  private st!: Stage3D;
  private frameFn!: (t: number, dt: number) => Pose;
  private t = 0;
  private finished = false;
  private gone = false;
  private veil!: Phaser.GameObjects.Rectangle;
  constructor(key: string, private o: ShotOpts, private src: Phaser.Scene, private done: (skipped: boolean) => void) {
    super({ key });
  }

  create() {
    const o = this.o;
    const calm = Juice.calm();
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.st = new Stage3D(this, 0);
    const caption = (text: string, co: { big?: boolean; color?: string; hold?: number } = {}) => {
      const t = this.add
        .text(co.big ? SW / 2 : 34, co.big ? SH * 0.3 : SH - 82, text, { fontFamily: co.big ? "Impact, sans-serif" : FONT, fontSize: co.big ? "54px" : "18px", color: co.color ?? "#ffffff", stroke: "#000000", strokeThickness: co.big ? 8 : 4 })
        .setOrigin(co.big ? 0.5 : 0, 0.5)
        .setDepth(80)
        .setAlpha(0);
      this.st.keep(t);
      if (co.big) t.setScale(1.6);
      this.tweens.add({ targets: t, alpha: 1, scale: 1, x: co.big ? t.x : t.x + 8, duration: 380, ease: "Cubic.out" });
      this.tweens.add({ targets: t, alpha: 0, delay: (co.hold ?? 1.8) * 1000, duration: 400 });
    };
    this.frameFn = o.build({ st: this.st, sc: this, calm, caption });
    if (o.bars !== false) {
      const BAR = 56;
      const a = this.st.keep(this.add.rectangle(SW / 2, -BAR, SW + 40, BAR, 0x000000).setOrigin(0.5, 0).setDepth(90));
      const b = this.st.keep(this.add.rectangle(SW / 2, SH + BAR, SW + 40, BAR, 0x000000).setOrigin(0.5, 1).setDepth(90));
      this.tweens.add({ targets: a, y: 0, duration: 500, ease: "Cubic.out" });
      this.tweens.add({ targets: b, y: SH, duration: 500, ease: "Cubic.out" });
    }
    if (o.skippable !== false) {
      const hint = this.st.keep(this.add.text(SW - 14, SH - 18, "SKIP ▸▸", { fontFamily: FONT, fontSize: "11px", color: "#cfc6e6" }).setOrigin(1, 0.5).setDepth(91).setAlpha(0));
      this.tweens.add({ targets: hint, alpha: 0.6, duration: 500, delay: 700 });
      const skip = () => this.t > 0.4 && this.finish(true);
      this.input.keyboard?.on("keydown-SPACE", skip);
      this.input.keyboard?.on("keydown-ESC", skip);
      this.input.keyboard?.on("keydown-ENTER", skip);
      this.input.on("pointerdown", skip);
    }
    // in: a cross-fade over the caller (or up from black)
    const cam = this.cameras.main;
    // (opaque fill; its alpha does the fading: a rectangle's 6th argument is the fill alpha, which no tween touches)
    this.veil = this.add.rectangle(SW / 2, SH / 2, SW + 80, SH + 80, o.veilColor ?? 0x000000, 1).setAlpha(o.fromBlack ? 1 : 0).setDepth(100);
    const fin = o.fadeIn ?? 350;
    if (o.fromBlack) {
      this.tweens.add({ targets: this.veil, alpha: 0, duration: fin, delay: 60 });
      o.onCovered?.();
    } else {
      cam.setAlpha(0);
      this.tweens.add({ targets: cam, alpha: 1, duration: fin, onComplete: () => o.onCovered?.() });
    }
    this.src.events.once("shutdown", this.onSrcGone, this);
    this.events.on("update", this.tick, this);
    this.tick(0, 0);
  }

  private onSrcGone() {
    if (this.gone) return;
    this.finished = true;
    this.teardown(true);
  }

  private tick(_time: number, delta: number) {
    if (this.gone) return;
    const dt = Math.min(delta, 100) / 1000;
    this.t += dt;
    const pose = this.frameFn(Math.min(this.t, this.o.length), dt);
    this.st.render(pose);
    if (this.t >= this.o.length) this.finish(false);
  }

  private finish(skipped: boolean) {
    if (this.finished) return;
    this.finished = true;
    const fout = skipped ? 220 : this.o.fadeOut ?? 400;
    if (this.o.toBlack || skipped) {
      this.tweens.add({ targets: this.veil, alpha: 1, duration: fout, onComplete: () => this.teardown(skipped, true) });
      return;
    }
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: fout, onComplete: () => this.teardown(skipped) });
  }

  private teardown(skipped: boolean, black = false) {
    if (this.gone) return;
    this.gone = true;
    this.src.events.off("shutdown", this.onSrcGone, this);
    this.events.off("update", this.tick, this);
    this.st.destroy();
    const key = this.scene.key;
    const mgr = this.game.scene;
    // ended on black: the caller sets up what comes next (synchronously, on resolve), then the black lifts off it
    // ("hold": it stays until the caller's scene goes, e.g. a room change, or 2.5s at most)
    if (black && this.src.sys.isActive()) {
      this.veil.setAlpha(1);
      const lift = () => {
        if (!this.sys.isActive()) return;
        this.tweens.add({ targets: this.veil, alpha: 0, duration: 300, delay: 40, onComplete: () => mgr.remove(key) });
      };
      if (this.o.toBlack === "hold" && !skipped) {
        const gone = () => mgr.remove(key);
        this.src.events.once("shutdown", gone);
        this.time.delayedCall(2500, () => {
          this.src.events.off("shutdown", gone);
          lift();
        });
      } else lift();
    } else {
      this.time.delayedCall(0, () => mgr.remove(key));
    }
    this.done(skipped);
  }
}

/**
 * Play a pseudo-3D shot over `src`. Resolves when it's over ({ skipped }), with its scene and textures gone. Without
 * WebGL it resolves at once (skipped: true), so callers can just await it.
 */
export async function playShot(src: Phaser.Scene, o: ShotOpts): Promise<{ skipped: boolean }> {
  if (!can3d(src)) return { skipped: true };
  // a scene just back from an overlay or a dialogue (which pause it) is resumed a frame later: give it a moment
  for (let i = 0; i < 40 && src.sys && src.sys.isPaused(); i++) await new Promise((r) => window.setTimeout(r, 25));
  if (!src.sys || !src.sys.isActive()) return { skipped: true };
  return new Promise((resolve) => {
    const key = `__p3d_shot_${++shotSeq}`;
    let settled = false;
    const done = (skipped: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ skipped });
    };
    src.scene.add(key, new ShotScene(key, o, src, done), true);
    src.scene.bringToTop(key);
  });
}

/**
 * A swoop down onto a top-down scene: the scene's world is snapshotted into a set, the camera flies `keys` (timed
 * aims, seconds) and then settles straight down onto `end` (the live camera's centre and zoom), so the hand-back is
 * seamless. `mood` tints the set (light and fog) at the start; it clears as the camera settles.
 */
export function swoopToLive(
  src: Phaser.Scene,
  o: {
    worldW: number;
    worldH: number;
    skip?: Phaser.GameObjects.GameObject[];
    keys: [number, Aim][];
    /** seconds for the last leg, onto the live view */
    settle: number;
    end: { x: number; y: number; zoom: number };
    mood?: { light: number; fog: number; sky: SkyOpts; apron: number };
    /** per-frame extras (lightning, captions…) */
    onFrame?: (c: ShotCtx, t: number, dt: number) => void;
    onBuild?: (c: ShotCtx) => void;
    onCovered?: () => void;
    /** passed on to playShot (e.g. fromBlack + veilColor to come in out of a white-out) */
    shot?: Pick<ShotOpts, "fromBlack" | "veilColor" | "fadeIn" | "fadeOut" | "skippable" | "bars">;
  },
): Promise<{ skipped: boolean }> {
  const last = o.keys[o.keys.length - 1][0];
  const length = last + o.settle;
  const end: Aim = { x: o.end.x, y: o.end.y, d: FOCAL / o.end.zoom, p: 90, yaw: 0, r: 0 };
  const mood = o.mood ?? { light: 0xffffff, fog: 0xc9d8ef, sky: { top: 0x3d64a8, horizon: 0xdce8f8 }, apron: 0x3c6a33 };
  return playShot(src, {
    ...o.shot,
    length,
    onCovered: o.onCovered,
    build: (c) => {
      const st = c.st;
      st.maxLean = 80;
      st.setSky(mood.sky);
      const apron = st.addGround({ x0: -9000, y0: -9000, x1: o.worldW + 9000, y1: o.worldH + 9000, cols: 9, rows: 9, color: mood.apron, depth: 1 });
      snapshotWorld(st, src, { worldW: o.worldW, worldH: o.worldH, skip: o.skip });
      o.onBuild?.(c);
      const fog0 = { ...st.fog };
      return (t, dt) => {
        let a: Aim;
        if (t <= last) a = aimPath(o.keys, t);
        else {
          const u = clamp((t - last) / o.settle, 0, 1);
          const k = 1 - Math.pow(1 - u, 3);
          const from = o.keys[o.keys.length - 1][1];
          a = lerpAim(from, end, k);
          a.p = lerp(from.p, 90, Math.pow(k, 0.8));
          a.r = lerp(from.r, 0, k);
        }
        // the mood clears as the camera settles onto the live view
        const clear = t <= last ? 0 : ease((t - last) / o.settle);
        st.light = mixC(mood.light, 0xffffff, clear);
        st.fog = { ...fog0, color: mood.fog, max: fog0.max * (1 - clear) };
        void apron;
        o.onFrame?.(c, t, dt);
        return aimToPose(a);
      };
    },
  });
}

// First person, the Doom way: a raycaster over the same walls the game uses, at 400 x 225 and
// scaled up pixel-sharp. Walls get their brick, block and render; floors their area colours with a
// little grain; people are their eight-way sprites, turned to face you; the stands are a wall of
// crowd. Your own two fat fists at the bottom, swinging when you punch.
import type { Actor, WorldState } from "../core/types";
import { AREAS, areaAt, BOUNDS, SOLID, type Wall } from "../stadium/layout";
import { CAP, material, matOf, type Mat } from "./build";

const W = 400, H = 225, FOV = Math.PI / 2.6, EYE = 1.62;

export interface FpSprite { x: number; y: number; img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; mh: number; footFrac: number; cheap?: boolean }

export class FirstPerson {
  on = false;
  private cv: HTMLCanvasElement;
  private cx: CanvasRenderingContext2D;
  private img: ImageData;
  private zbuf = new Float32Array(W);
  private mats = new Map<string, { data: Uint8ClampedArray; w: number; h: number }>();
  private floor: Uint32Array | null = null;
  private floorKey = "";
  punchAt = 0;
  /** Field of view (narrow through a scope), eye height (higher on a roof), and how far it draws. */
  fov = FOV;
  eye = EYE;
  far = 40;

  constructor(host: HTMLElement) {
    this.cv = document.createElement("canvas");
    this.cv.width = W; this.cv.height = H; this.cv.id = "fp";
    Object.assign(this.cv.style, { position: "absolute", inset: "0", width: "100%", height: "100%", imageRendering: "pixelated", zIndex: "1", display: "none", objectFit: "cover" });
    host.appendChild(this.cv);
    this.cx = this.cv.getContext("2d")!;
    this.cx.imageSmoothingEnabled = false;
    this.img = this.cx.createImageData(W, H);
  }

  show(on: boolean): void { this.on = on; this.cv.style.display = on ? "block" : "none"; }

  private mat(m: Mat) {
    let t = this.mats.get(m);
    if (!t) {
      const c = material(m), d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      t = { data: d.data, w: c.width, h: c.height };
      this.mats.set(m, t);
    }
    return t;
  }

  /** The floor as a one-metre grid of colours (built once per venue). */
  private floorGrid(key: string): Uint32Array {
    if (this.floor && this.floorKey === key) return this.floor;
    const gw = Math.ceil(BOUNDS.w), gh = Math.ceil(BOUNDS.h), g = new Uint32Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const a = areaAt(BOUNDS.x + x + 0.5, BOUNDS.y + y + 0.5);
      g[y * gw + x] = a.id === "pitch" || a.pitch ? ((Math.floor((BOUNDS.x + x) / 6) & 1) ? 0x2f8a3e : 0x2a7a37) : a.floor;
    }
    this.floor = g; this.floorKey = key;
    void AREAS;
    return g;
  }

  /** Draw a frame from the player's eyes. */
  draw(s: WorldState, pc: Actor, sprites: FpSprite[], outside: boolean, venue: string, hand: CanvasImageSource | null): void {
    const px = pc.x, py = pc.y, dir = pc.facing, d = this.img.data;
    const dx = Math.cos(dir), dy = Math.sin(dir), plane = Math.tan(this.fov / 2), pxl = -dy * plane, pyl = dx * plane;
    const proj = W / 2 / plane;
    const horizon = H / 2 + 10;
    // Sky and floor.
    const grid = this.floorGrid(venue), gw = Math.ceil(BOUNDS.w), gh = Math.ceil(BOUNDS.h);
    for (let y = 0; y < H; y++) {
      if (y < horizon) {
        const k = y / horizon, r = outside ? 150 + k * 40 : 40 + k * 20, gg = outside ? 160 + k * 38 : 40 + k * 20, b = outside ? 172 + k * 30 : 48 + k * 20;
        for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
        continue;
      }
      const rowDist = (this.eye * proj) / (y - horizon + 0.5);
      const fade = Math.max(0.25, 1 - rowDist / 45);
      const lx0 = px + rowDist * (dx - pxl), ly0 = py + rowDist * (dy - pyl);
      const stx = (rowDist * 2 * pxl) / W, sty = (rowDist * 2 * pyl) / W;
      let wx = lx0, wy = ly0;
      for (let x = 0; x < W; x++, wx += stx, wy += sty) {
        const gx = Math.floor(wx - BOUNDS.x), gy = Math.floor(wy - BOUNDS.y);
        const c = gx >= 0 && gy >= 0 && gx < gw && gy < gh ? grid[gy * gw + gx] : 0x3a3d42;
        // A little grain: slabs and grout, every half metre.
        const fx = wx - Math.floor(wx), fy = wy - Math.floor(wy), grout = (fx < 0.04 || fy < 0.04) ? 0.82 : ((Math.floor(wx * 4) ^ Math.floor(wy * 4)) & 1 ? 1 : 0.95);
        const k = fade * grout, i = (y * W + x) * 4;
        d[i] = ((c >> 16) & 255) * k; d[i + 1] = ((c >> 8) & 255) * k; d[i + 2] = (c & 255) * k; d[i + 3] = 255;
      }
    }
    // Walls: each column, every wall the ray hits (nearest few), drawn far to near so low walls show what's behind.
    const near = SOLID.filter((wl) => Math.abs(wl.x + wl.w / 2 - px) < this.far + wl.w / 2 && Math.abs(wl.y + wl.h / 2 - py) < this.far + wl.h / 2);
    const hits: { t: number; wl: Wall; u: number }[] = [];
    for (let x = 0; x < W; x++) {
      const cam = (2 * x) / W - 1, rx = dx + pxl * cam, ry = dy + pyl * cam;
      hits.length = 0;
      for (const wl of near) {
        // Ray against the box (slab method).
        const ix = 1 / (rx || 1e-9), iy = 1 / (ry || 1e-9);
        let t1 = (wl.x - px) * ix, t2 = (wl.x + wl.w - px) * ix, t3 = (wl.y - py) * iy, t4 = (wl.y + wl.h - py) * iy;
        const tminX = Math.min(t1, t2), tmaxX = Math.max(t1, t2), tminY = Math.min(t3, t4), tmaxY = Math.max(t3, t4);
        const tmin = Math.max(tminX, tminY), tmax = Math.min(tmaxX, tmaxY);
        if (tmax < 0 || tmin > tmax || tmin > this.far || tmin < 0.05) continue;
        const hx = px + rx * tmin, hy = py + ry * tmin;
        const u = tminX > tminY ? hy - wl.y : hx - wl.x;
        hits.push({ t: tmin, wl, u });
      }
      hits.sort((a, b) => b.t - a.t);
      let zb = 99;
      for (const h of hits.slice(-4)) {
        const wl = h.wl, ht = Math.min(wl.h3, 4.5), dist = h.t; // perpendicular already (camera-plane rays)
        const top = Math.round(horizon - ((ht - this.eye) * proj) / dist), bot = Math.round(horizon + (this.eye * proj) / dist);
        const m = this.mat(wl.prop ? "steel" : matOf(wl.colour, wl.h3, wl.gate));
        const shade = Math.max(0.3, 1 - dist / this.far) * (Math.abs(h.u - Math.round(h.u)) < 0.02 ? 0.85 : 1);
        const tu = Math.floor(((h.u * 32) % m.w + m.w) % m.w);
        const y0 = Math.max(0, top), y1 = Math.min(H - 1, bot);
        for (let y = y0; y <= y1; y++) {
          const v = (bot - y) / Math.max(1, bot - top) * ht; // metres up the wall
          const tv = (m.h - 1 - Math.floor((v * 32) % m.h) + m.h) % m.h;
          const si = (tv * m.w + tu) * 4, i = (y * W + x) * 4;
          d[i] = m.data[si] * shade; d[i + 1] = m.data[si + 1] * shade; d[i + 2] = m.data[si + 2] * shade; d[i + 3] = 255;
        }
        // The cap: a lighter line along the top edge.
        if (top >= 0 && top < H) { const c = CAP[matOf(wl.colour, wl.h3, wl.gate)] ?? 0x999999, i = (top * W + x) * 4; d[i] = ((c >> 16) & 255) * shade; d[i + 1] = ((c >> 8) & 255) * shade; d[i + 2] = (c & 255) * shade; }
        if (ht >= this.eye) zb = Math.min(zb, dist);
      }
      this.zbuf[x] = zb;
    }
    this.cx.putImageData(this.img, 0, 0);
    // People and things, far to near, clipped by the walls.
    const list = sprites.map((sp) => ({ sp, rx: sp.x - px, ry: sp.y - py })).map((o) => {
      const inv = 1 / (pxl * dy - dx * pyl);
      const tx = inv * (dy * o.rx - dx * o.ry), tz = inv * (-pyl * o.rx + pxl * o.ry);
      return { ...o, tx, tz };
    }).filter((o) => o.tz > 0.3 && o.tz < this.far).sort((a, b) => b.tz - a.tz);
    for (const o of list) {
      const sxc = (W / 2) * (1 + o.tx / o.tz), hpx = (o.sp.mh * proj) / o.tz, wpx = hpx * (o.sp.sw / o.sp.sh);
      const footY = horizon + (this.eye * proj) / o.tz;
      const x0 = Math.round(sxc - wpx / 2), x1 = Math.round(sxc + wpx / 2);
      const k = Math.max(0.35, 1 - o.tz / this.far);
      this.cx.globalAlpha = 1;
      this.cx.filter = k < 0.98 ? `brightness(${k.toFixed(2)})` : "none";
      if (o.sp.cheap) {
        // The crowd: whole figures, hidden only if a wall is in front of the middle of them.
        const mid = Math.max(0, Math.min(W - 1, Math.round(sxc)));
        if (this.zbuf[mid] >= o.tz) this.cx.drawImage(o.sp.img, o.sp.sx, o.sp.sy, o.sp.sw, o.sp.sh, x0, footY - hpx * o.sp.footFrac, x1 - x0, hpx);
        continue;
      }
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        if (this.zbuf[x] < o.tz) continue;
        const u = (x - x0) / (x1 - x0);
        this.cx.drawImage(o.sp.img, o.sp.sx + Math.floor(u * o.sp.sw), o.sp.sy, 1, o.sp.sh, x, footY - hpx * o.sp.footFrac, 1, hpx);
      }
    }
    this.cx.filter = "none";
    // Your fists (and whatever's in your hand), swinging when you punch.
    const now = performance.now(), swing = Math.max(0, 1 - (now - this.punchAt) / 220), bob = Math.sin(now / 160) * (Math.hypot(pc.vx, pc.vy) > 0.5 ? 3 : 0.6);
    const fist = (fx: number, fy: number, punch: number) => {
      const x = fx - punch * 10, y = fy - punch * 40;
      this.cx.fillStyle = "#e9a882"; this.cx.fillRect(x, y, 34, 26);
      this.cx.fillStyle = "#c98466"; this.cx.fillRect(x, y + 18, 34, 8); this.cx.fillRect(x + 8, y, 2, 14); this.cx.fillRect(x + 16, y, 2, 14); this.cx.fillRect(x + 24, y, 2, 14);
      this.cx.fillStyle = "#f4f1ea"; this.cx.fillRect(x - 4, y + 26, 42, 40);
      this.cx.fillStyle = "#000"; this.cx.fillRect(x - 4, y + 26, 42, 2);
    };
    fist(70, H - 62 + bob, 0);
    fist(W / 2 + 40, H - 62 - bob, swing);
    if (hand) this.cx.drawImage(hand, W / 2 + 26, H - 108 - bob, 48, 48);
    // Crosshair: a small pixel cross.
    this.cx.fillStyle = "rgba(255,255,255,0.7)"; this.cx.fillRect(W / 2 - 3, H / 2 + 10, 7, 1); this.cx.fillRect(W / 2, H / 2 + 7, 1, 7);
  }
}

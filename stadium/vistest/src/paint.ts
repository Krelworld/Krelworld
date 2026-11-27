// Canvas painting: the whole look of the diorama comes from here. Everything is painted at
// 32 texels per metre (the density of the game's pixel sprites) and shown with nearest-neighbour
// magnification, so a brick is the same size of pixel as Grozz's ear. Signs are the one exception:
// they are painted at 64 px/m (the density of the HD Grozz sheet) so lettering survives on a phone.

export const PXM = 32;
export type RGB = [number, number, number];
export type Ctx = CanvasRenderingContext2D;

export const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
export const css = (c: RGB, a = 1): string => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const shade = (c: RGB, k: number): RGB => (k <= 1 ? [c[0] * k, c[1] * k, c[2] * k] : mix(c, [255, 255, 255], k - 1));
export const H = (h: number, a = 1) => css(hex(h), a);

export type Rng = (() => number) & { int: (n: number) => number; pick: <T>(a: T[]) => T; range: (a: number, b: number) => number };
export function rng(seed: number): Rng {
  let s = seed >>> 0;
  const f = (() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  f.int = (n) => Math.floor(f() * n);
  f.pick = (a) => a[Math.floor(f() * a.length)];
  f.range = (a, b) => a + (b - a) * f();
  return f;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export const rect = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/** A panel with a lit top/left edge and a dark bottom/right edge: the pixel-art way of saying "this is a made thing". */
export function bevel(c: Ctx, x: number, y: number, w: number, h: number, col: RGB, hi = 1.25, lo = 0.7) {
  rect(c, x, y, w, h, css(col));
  rect(c, x, y, w, 1, css(shade(col, hi)));
  rect(c, x, y, 1, h, css(shade(col, hi)));
  rect(c, x, y + h - 1, w, 1, css(shade(col, lo)));
  rect(c, x + w - 1, y, 1, h, css(shade(col, lo)));
}

/** Per-pixel luminance noise, for grit. */
export function grain(c: Ctx, x: number, y: number, w: number, h: number, amt: number, seed = 1) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  const t = c.getTransform();
  const img = c.getImageData(x + t.e, y + t.f, w, h), d = img.data, r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (r() - 0.5) * 2 * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  c.putImageData(img, x + t.e, y + t.f);
}

/** Dark from the top (soot under the eaves) and green-dark from the bottom (rising damp), with a few runs. */
export function weather(c: Ctx, x: number, y: number, w: number, h: number, r: Rng, top = 0.28, bottom = 0.42, runs = 6) {
  let g = c.createLinearGradient(0, y, 0, y + Math.min(h, 40));
  g.addColorStop(0, `rgba(18,16,20,${top})`); g.addColorStop(1, "rgba(18,16,20,0)");
  c.fillStyle = g; c.fillRect(x, y, w, Math.min(h, 40));
  const bh = Math.min(h, 26);
  g = c.createLinearGradient(0, y + h - bh, 0, y + h);
  g.addColorStop(0, "rgba(24,30,20,0)"); g.addColorStop(1, `rgba(24,30,20,${bottom})`);
  c.fillStyle = g; c.fillRect(x, y + h - bh, w, bh);
  for (let i = 0; i < runs; i++) {
    const sx = x + r.int(w), len = 10 + r.int(Math.max(4, h * 0.5)), sy = y + r.int(Math.max(1, h * 0.3));
    for (let k = 0; k < len; k++) rect(c, sx + (r() < 0.15 ? 1 : 0), sy + k, 1 + (k < 3 ? 1 : 0), 1, `rgba(20,18,16,${0.22 * (1 - k / len)})`);
  }
}

export interface BrickPal { tones: RGB[]; mortar: RGB; }
export const BRICK_RED: BrickPal = { tones: [0x94503d, 0x8a4737, 0x9d5a43, 0x7c3f33, 0xa8644a, 0x6a362e, 0x8f5544].map(hex), mortar: hex(0x66524a) };
export const BRICK_STOCK: BrickPal = { tones: [0xa48a5e, 0x98805a, 0xae9668, 0x8b744f, 0x9a7a58, 0x7a6748, 0xb39c74].map(hex), mortar: hex(0x6f6654) };
export const BRICK_DARK: BrickPal = { tones: [0x5d4a48, 0x54423f, 0x66504c, 0x4b3b3a, 0x6e5a50, 0x5a4640].map(hex), mortar: hex(0x3d3836) };
export const BRICK_WALL: BrickPal = { tones: [0x86503f, 0x7a4638, 0x8f5a48, 0x6e4238, 0x9a6650, 0x5c3a34, 0x80564a].map(hex), mortar: hex(0x5c4e48) };

/** Running-bond brickwork: 8 x 4 px bricks (a chunky 25 cm, a toy's idea of a brick). */
export function brick(c: Ctx, x0: number, y0: number, w: number, h: number, pal: BrickPal, r: Rng, bw = 8, bh = 4) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  rect(c, x0, y0, w, h, css(pal.mortar));
  for (let j = 0; j * bh < h; j++) {
    const off = j & 1 ? bw / 2 : 0;
    for (let i = -1; i * bw < w + bw; i++) {
      let col = r.pick(pal.tones);
      if (r() < 0.06) col = shade(col, 0.62); // a burnt one
      else col = shade(col, 0.93 + r() * 0.14);
      const bx = x0 + i * bw - off, by = y0 + j * bh;
      rect(c, bx, by, bw - 1, bh - 1, css(col));
      if (r() < 0.35) rect(c, bx, by, bw - 1 - r.int(3), 1, css(shade(col, 1.12)));
    }
  }
  c.restore();
}

/** Welsh slate: 7 x 5 px courses, a dark lower edge, the odd pale replacement, moss toward the gutter. */
export function slate(c: Ctx, x0: number, y0: number, w: number, h: number, r: Rng, moss = true) {
  const tones = [0x4c5664, 0x465060, 0x535d6c, 0x404957, 0x586271, 0x4a505c].map(hex);
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  rect(c, x0, y0, w, h, H(0x2c323c));
  for (let j = 0; j * 5 < h; j++) {
    const off = (j & 1 ? 3 : 0) + (r() < 0.2 ? 1 : 0);
    for (let i = -1; i * 7 < w + 7; i++) {
      let col = r.pick(tones);
      const q = r();
      if (q < 0.04) col = hex(0x6d7786); else if (q < 0.07) col = hex(0x353c47); else if (q < 0.1) col = hex(0x5d5560);
      const bx = x0 + i * 7 - off, by = y0 + j * 5 + (r() < 0.03 ? 1 : 0);
      rect(c, bx, by, 6, 4, css(col));
      rect(c, bx, by, 6, 1, css(shade(col, 1.16)));
      if (r() < 0.3) rect(c, bx + r.int(4), by + 1, 2, 1, css(shade(col, 1.28))); // a wet glint
    }
  }
  if (moss) for (let k = 0; k < (w * h) / 420; k++) {
    const mx = x0 + r.int(w), my = y0 + h - 1 - Math.floor(r() * r() * h * 0.8);
    const col = r.pick([0x5a6a3a, 0x4d5c34, 0x6b7a44]);
    rect(c, mx, my, 1 + r.int(3), 1, H(col)); if (r() < 0.5) rect(c, mx + 1, my - 1, 1 + r.int(2), 1, H(col));
  }
  // rain-dark streaks down the slope
  for (let k = 0; k < w / 14; k++) { const sx = x0 + r.int(w); c.fillStyle = "rgba(20,24,30,0.16)"; c.fillRect(sx, y0, 1 + r.int(2), h); }
  c.restore();
}

/** Herringbone block paving on a 4 px grid (8 x 4 px blocks). */
export function herringbone(c: Ctx, x0: number, y0: number, w: number, h: number, tones: RGB[], joint: RGB, r: Rng) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  rect(c, x0, y0, w, h, css(joint));
  const gx0 = Math.floor(x0 / 4) - 1, gy0 = Math.floor(y0 / 4) - 1, gx1 = Math.ceil((x0 + w) / 4) + 1, gy1 = Math.ceil((y0 + h) / 4) + 1;
  for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
    const d = (((gx - gy) % 4) + 4) % 4;
    if (d !== 0 && d !== 3) continue;
    let col = r.pick(tones); col = shade(col, 0.9 + r() * 0.2);
    const bw = d === 0 ? 8 : 4, bhh = d === 0 ? 4 : 8;
    rect(c, gx * 4, gy * 4, bw - 1, bhh - 1, css(col));
    if (r() < 0.25) rect(c, gx * 4, gy * 4, bw - 1, 1, css(shade(col, 1.14)));
  }
  c.restore();
}

/** Concrete flags, 20 x 30 px, laid broken-bond, with cracks and chewing gum. */
export function flags(c: Ctx, x0: number, y0: number, w: number, h: number, r: Rng, fw = 28, fh = 19) {
  const tones = [0x8a8780, 0x827f79, 0x918d84, 0x7b7872, 0x88827a].map(hex);
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  rect(c, x0, y0, w, h, H(0x55534f));
  for (let j = 0; j * fh < h; j++) {
    const off = j & 1 ? fw / 2 : 0;
    for (let i = -1; i * fw < w + fw; i++) {
      const col = shade(r.pick(tones), 0.94 + r() * 0.1), bx = x0 + i * fw - off, by = y0 + j * fh;
      rect(c, bx, by, fw - 1, fh - 1, css(col));
      rect(c, bx, by, fw - 1, 1, css(shade(col, 1.1)));
      if (r() < 0.16) { // cracked
        let cx = bx + 3 + r.int(fw - 8), cy = by;
        for (let k = 0; k < fh - 1; k++) { rect(c, cx, cy + k, 1, 1, H(0x4e4c49)); if (r() < 0.4) cx += r() < 0.5 ? 1 : -1; }
      }
    }
  }
  for (let k = 0; k < (w * h) / 260; k++) rect(c, x0 + r.int(w), y0 + r.int(h), 1, 1, r() < 0.6 ? H(0xb9b6ad) : H(0x4a4845)); // gum, grit
  c.restore();
}

/** Tarmac: speckle, repair patches, cracks. Wet sheen is laid over the top by the caller. */
export function tarmac(c: Ctx, x0: number, y0: number, w: number, h: number, r: Rng, base = 0x3d4046) {
  rect(c, x0, y0, w, h, H(base));
  const b = hex(base);
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  for (let k = 0; k < (w * h) / 9000; k++) { // patches
    const pw = 30 + r.int(90), ph = 14 + r.int(40), px = x0 + r.int(w), py = y0 + r.int(h), col = shade(b, r() < 0.5 ? 0.86 : 1.1);
    rect(c, px, py, pw, ph, css(col)); c.strokeStyle = css(shade(b, 0.7)); c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  }
  for (let k = 0; k < (w * h) / 60; k++) rect(c, x0 + r.int(w), y0 + r.int(h), 1, 1, css(shade(b, r() < 0.6 ? 1.3 : 0.7)));
  c.restore();
}

/** An irregular puddle: sky-coloured, darker rimmed, with a couple of rain rings. */
export function puddle(c: Ctx, cx: number, cy: number, rx: number, ry: number, r: Rng, sky: RGB = hex(0x8697a6)) {
  const pts: [number, number][] = [];
  const n = 9;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.65 + r() * 0.5; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  const path = () => { c.beginPath(); pts.forEach((p, i) => { const q = pts[(i + 1) % n]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (i === 0) c.moveTo(mx, my); else c.quadraticCurveTo(p[0], p[1], mx, my); }); const p0 = pts[0], q0 = pts[1]; c.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2); c.closePath(); };
  c.save();
  path(); c.fillStyle = "rgba(16,18,22,0.55)"; c.fill();
  c.translate(0, -1); path(); c.clip();
  const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, css(shade(sky, 1.12), 0.9)); g.addColorStop(1, css(shade(sky, 0.72), 0.9));
  c.fillStyle = g; c.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);
  for (let k = 0; k < Math.max(1, (rx * ry) / 60); k++) { // rain rings
    const px = cx + (r() - 0.5) * rx * 1.4, py = cy + (r() - 0.5) * ry * 1.2;
    rect(c, px - 1, py, 3, 1, css(shade(sky, 1.35), 0.8)); rect(c, px, py - 1, 1, 1, css(shade(sky, 1.35), 0.6));
  }
  c.restore();
}

// ---------------------------------------------------------------------------------------------
// Lettering.

const FONT_SERIF = '"Copperplate", "Baskerville", Georgia, "Bitstream Charter", "Times New Roman", serif';
const FONT_BLOCK = '"Avenir Next Condensed", "HelveticaNeue-CondensedBlack", "Arial Narrow", Inter, "Helvetica Neue", Arial, sans-serif';
export const FONTS = { serif: FONT_SERIF, block: FONT_BLOCK };

let scratch: [HTMLCanvasElement, Ctx] | null = null;
/** Text drawn hard-edged (no half-transparent fringe), so it reads as sign-writing in pixels rather than as a web font.
 *  Returns the width drawn. `h` is the cap height in px. */
export function pixText(c: Ctx, text: string, x: number, y: number, h: number, col: string, o: { font?: string; weight?: number; align?: "left" | "center" | "right"; maxW?: number; shadow?: string; outline?: string; squash?: number } = {}): number {
  const font = o.font ?? FONT_BLOCK, weight = o.weight ?? 900, K = 4;
  if (!scratch) scratch = makeCanvas(2048, 256);
  const [sc, sx] = scratch;
  const px = Math.round((h / 0.72) * K);
  sx.font = `${weight} ${px}px ${font}`;
  let tw = sx.measureText(text).width / K * (o.squash ?? 1);
  let squash = o.squash ?? 1;
  if (o.maxW && tw > o.maxW) { squash *= o.maxW / tw; tw = o.maxW; }
  const W = Math.ceil(tw) + 2, Hh = Math.ceil(h * 1.6) + 2;
  sx.clearRect(0, 0, sc.width, sc.height);
  sx.save(); sx.scale(squash, 1); sx.fillStyle = "#fff"; sx.textBaseline = "alphabetic"; sx.fillText(text, K / squash, Math.round(h * 1.3) * K); sx.restore();
  // Box-filter down by K and threshold.
  const src = sx.getImageData(0, 0, W * K, Hh * K).data;
  const [tc, tx] = makeCanvas(W, Hh);
  const out = tx.createImageData(W, Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    let a = 0;
    for (let v = 0; v < K; v++) for (let u = 0; u < K; u++) a += src[((j * K + v) * W * K + i * K + u) * 4 + 3];
    out.data[(j * W + i) * 4 + 3] = a / (K * K) > 110 ? 255 : 0;
  }
  const stamp = (colour: string, dx: number, dy: number) => {
    const m = /rgba?\(([^)]+)\)/.exec(colour); let rr = 255, gg = 255, bb = 255;
    if (m) { const p = m[1].split(",").map(Number); rr = p[0]; gg = p[1]; bb = p[2]; } else if (colour[0] === "#") { const v = parseInt(colour.slice(1), 16); rr = (v >> 16) & 255; gg = (v >> 8) & 255; bb = v & 255; }
    for (let i = 0; i < out.data.length; i += 4) { out.data[i] = rr; out.data[i + 1] = gg; out.data[i + 2] = bb; }
    tx.putImageData(out, 0, 0);
    const ox = o.align === "center" ? -tw / 2 : o.align === "right" ? -tw : 0;
    c.drawImage(tc, Math.round(x + ox + dx) - 1, Math.round(y - h * 1.3 + dy));
  };
  if (o.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1]]) stamp(o.outline, dx, dy);
  if (o.shadow) stamp(o.shadow, 1, 1);
  stamp(col, 0, 0);
  return tw;
}

// A 3 x 5 pixel alphabet for the smallest labels (stickers, the phone box, chalk).
const TINY: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110", "4": "101101111001001", "5": "111100110001110",
  "6": "011100110101010", "7": "111001010010010", "8": "010101010101010", "9": "010101011001110", "£": "011100110100111", "+": "000010111010000", "-": "000000111000000", ".": "000000000000010",
  "!": "010010010000010", "&": "010101010101011", "'": "010010000000000", "/": "001001010100100", ":": "000010000010000", "%": "101001010100101",
};
export function tiny(c: Ctx, text: string, x: number, y: number, col: string, scale = 1, align: "left" | "center" = "left"): number {
  const w = text.length * 4 * scale - scale;
  let cx = align === "center" ? Math.round(x - w / 2) : x;
  c.fillStyle = col;
  for (const ch of text.toUpperCase()) {
    const g = TINY[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === "1") c.fillRect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
    cx += 4 * scale;
  }
  return w;
}

// ---------------------------------------------------------------------------------------------
// The atlas: every painted face of every static thing lives in one 2048 texture, so the whole
// town is one draw call.

export interface Region { x: number; y: number; w: number; h: number }
const PAD = 3;

export class Atlas {
  canvas: HTMLCanvasElement; ctx: Ctx; size: number;
  private cx = PAD; private cy = PAD; private rowH = 0;
  private solids = new Map<string, Region>();
  constructor(size = 2048) {
    this.size = size;
    [this.canvas, this.ctx] = makeCanvas(size, size);
  }
  alloc(w: number, h: number): Region {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (this.cx + w + PAD > this.size) { this.cx = PAD; this.cy += this.rowH + PAD * 2; this.rowH = 0; }
    if (this.cy + h + PAD > this.size) throw new Error("atlas full");
    const r = { x: this.cx, y: this.cy, w, h };
    this.cx += w + PAD * 2; this.rowH = Math.max(this.rowH, h);
    return r;
  }
  /** Allocate w x h px and paint into it (origin at the region's top-left, clipped). */
  paint(w: number, h: number, fn: (c: Ctx, w: number, h: number) => void, opaque = true): Region {
    const r = this.alloc(w, h), c = this.ctx;
    c.save(); c.translate(r.x, r.y); c.beginPath(); c.rect(0, 0, r.w, r.h); c.clip();
    fn(c, r.w, r.h);
    c.restore();
    if (opaque) this.extrude(r);
    return r;
  }
  /** Sized in metres. */
  paintM(wm: number, hm: number, fn: (c: Ctx, w: number, h: number) => void, density = 1, opaque = true): Region {
    return this.paint(wm * PXM * density, hm * PXM * density, fn, opaque);
  }
  /** Smear the border outward into the padding so mip levels don't pull in the neighbour. */
  private extrude(r: Region) {
    const c = this.ctx, cv = this.canvas;
    for (let k = 1; k <= PAD; k++) {
      c.drawImage(cv, r.x, r.y, r.w, 1, r.x, r.y - k, r.w, 1);
      c.drawImage(cv, r.x, r.y + r.h - 1, r.w, 1, r.x, r.y + r.h - 1 + k, r.w, 1);
    }
    for (let k = 1; k <= PAD; k++) {
      c.drawImage(cv, r.x, r.y - PAD, 1, r.h + PAD * 2, r.x - k, r.y - PAD, 1, r.h + PAD * 2);
      c.drawImage(cv, r.x + r.w - 1, r.y - PAD, 1, r.h + PAD * 2, r.x + r.w - 1 + k, r.y - PAD, 1, r.h + PAD * 2);
    }
  }
  /** A flat swatch (with a breath of grain so big faces aren't dead). */
  solid(col: number): Region {
    const k = String(col);
    let r = this.solids.get(k);
    if (!r) { r = this.paint(8, 8, (c) => rect(c, 0, 0, 8, 8, H(col))); this.solids.set(k, r); }
    return r;
  }
  usage(): number { return (this.cy + this.rowH) / this.size; }
}

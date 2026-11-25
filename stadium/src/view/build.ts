// The built world at one pixel density: 32 art pixels to the metre, everything drawn at 1:1.
// Floors are PixelLab tiles laid at random from their variants; walls, shopfronts, signs and
// roofs are painted here on canvases in the same palette, so the whole street reads as one
// picture (the Escapists / Stardew approach: one grid, one camera, one light from the top left).
import Phaser from "phaser";

export const PPM = 32;

type Ctx = CanvasRenderingContext2D;
const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
/** A colour lightened (k > 1) or darkened (k < 1), as CSS. */
export const css = (c: number, k = 1, a = 1) => { const [r, g, b] = rgb(c).map((v) => Math.max(0, Math.min(255, Math.round(v * k)))); return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`; };
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  const cx = cv.getContext("2d")!;
  cx.imageSmoothingEnabled = false;
  return [cv, cx];
}
const rect = (cx: Ctx, x: number, y: number, w: number, h: number, c: string) => { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// ---------- A 5 x 7 pixel font for sign boards ----------
const GLYPHS: Record<string, string> = {
  A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110", C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110", E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111", H: "10001100011000111111100011000110001", I: "01110001000010000100001000010001110",
  J: "00111000100001000010000101001001100", K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001", N: "10001110011010110011100011000110001", O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000", Q: "01110100011000110001101011001001101", R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100", U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100", W: "10001100011000110101101011101110001", X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100", Z: "11111000010001000100010001000011111", "&": "01100100101010001000101011001001101",
  "'": "00100001000100000000000000000000000", " ": "00000000000000000000000000000000000", "1": "00100011000010000100001000010001110",
  "2": "01110100010000100010001000100011111", "3": "11111000100010000010000011000101110", "4": "00010001100101010010111110001000010",
  "5": "11111100001111000001000011000101110", "0": "01110100011001110101110011000101110", "/": "00001000010001000100010001000010000",
  ".": "00000000000000000000000000110001100", "-": "00000000000000011111000000000000000", "!": "00100001000010000100001000000000100",
  "£": "00110010010100011100010000100011111", ":": "00000011000110000000011000110000000",
};

/** Paint words in the pixel font, centred in a box, at the largest whole scale that fits (up to `max`). */
export function pixelText(cx: Ctx, text: string, x: number, y: number, w: number, h: number, colour: string, max = 3, shadow?: string): void {
  const lines = text.toUpperCase().split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  const scale = Math.max(1, Math.min(max, Math.floor(Math.min(w / (longest * 6 - 1), h / (lines.length * 8 - 1)))));
  const lh = 8 * scale, totalH = lines.length * lh - scale;
  const draw = (dx: number, dy: number, c: string) => {
    cx.fillStyle = c;
    lines.forEach((line, li) => {
      const lw = line.length * 6 * scale - scale;
      let px = Math.round(x + (w - lw) / 2) + dx;
      const py = Math.round(y + (h - totalH) / 2 + li * lh) + dy;
      for (const ch of line) {
        const gl = GLYPHS[ch] ?? GLYPHS[" "];
        for (let i = 0; i < 35; i++) if (gl[i] === "1") cx.fillRect(px + (i % 5) * scale, py + Math.floor(i / 5) * scale, scale, scale);
        px += 6 * scale;
      }
    });
  };
  if (shadow) draw(scale, scale, shadow);
  draw(0, 0, colour);
}

// ---------- Wall materials: 64 x 64 tileable, bottom row = the ground ----------
export type Mat = "palisade" | "brick" | "stock" | "block" | "clad" | "cabin" | "render" | "timber" | "steel" | "roofsteel" | "seats_h" | "seats_v" | "seats_h_red" | "seats_v_red";
/** Colour of the top of a wall of each material (the coping you see from above). */
export const CAP: Record<string, number> = { brick: 0x8b8a84, stock: 0x9a968a, block: 0x9da1a6, clad: 0x7c858f, cabin: 0x8d9a7f, render: 0xb9b3a6, timber: 0x6b4a33, steel: 0x50565e };

function brickwork(cx: Ctx, w: number, h: number, base: number, mortar: number, bw: number, bh: number, r: () => number, jitter = 0.12) {
  rect(cx, 0, 0, w, h, css(mortar));
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -off; x < w; x += bw) {
      const k = 1 + (r() - 0.5) * 2 * jitter - (r() < 0.06 ? 0.18 : 0);
      rect(cx, x, h - (row + 1) * bh, bw - 1, bh - 1, css(base, k));
      rect(cx, x, h - (row + 1) * bh, bw - 1, 1, css(base, k * 1.12));
    }
  }
}

function material(m: Mat): HTMLCanvasElement {
  const [cv, cx] = canvas(64, 64), r = rng(m.length * 977 + m.charCodeAt(0));
  switch (m) {
    case "palisade": {
      // Green steel palisade: pales with split tops, two rails, see-through between.
      cx.clearRect(0, 0, 64, 64);
      for (let x = 1; x < 64; x += 8) {
        rect(cx, x, 6, 5, 58, css(0x2f5a3a)); rect(cx, x, 6, 1, 58, css(0x4a7a55)); rect(cx, x + 4, 6, 1, 58, css(0x1f3a26));
        rect(cx, x + 1, 2, 1, 4, css(0x2f5a3a)); rect(cx, x + 3, 2, 1, 4, css(0x2f5a3a));
      }
      rect(cx, 0, 16, 64, 3, css(0x25472e)); rect(cx, 0, 48, 64, 3, css(0x25472e));
      break;
    }
    case "brick": brickwork(cx, 64, 64, 0x8a4634, 0x9c9488, 8, 4, r); break;
    case "stock": brickwork(cx, 64, 64, 0xa8925e, 0x8e8778, 8, 4, r, 0.1); break;
    case "block": brickwork(cx, 64, 64, 0x8f9398, 0x6c7075, 16, 8, r, 0.05); break;
    case "clad": {
      // Profiled steel cladding: a light rib, a lit face, a shadowed trough, every 8 px.
      for (let x = 0; x < 64; x += 8) {
        rect(cx, x, 0, 8, 64, css(0x7d8895));
        rect(cx, x, 0, 2, 64, css(0x9aa5b1));
        rect(cx, x + 2, 0, 1, 64, css(0xb6c0ca));
        rect(cx, x + 6, 0, 2, 64, css(0x5f6a76));
      }
      for (let i = 0; i < 18; i++) rect(cx, Math.floor(r() * 64), Math.floor(r() * 64), 1, 2 + Math.floor(r() * 5), css(0x6a6f6a, 1, 0.35));
      break;
    }
    case "cabin":
      rect(cx, 0, 0, 64, 64, css(0x7f8c72));
      for (let y = 0; y < 64; y += 4) { rect(cx, 0, y, 64, 1, css(0x96a387)); rect(cx, 0, y + 3, 64, 1, css(0x667259)); }
      break;
    case "render":
      rect(cx, 0, 0, 64, 64, css(0xd6cfbf));
      for (let i = 0; i < 160; i++) rect(cx, Math.floor(r() * 64), Math.floor(r() * 64), 1, 1, css(0xd6cfbf, 0.9 + r() * 0.16));
      rect(cx, 0, 56, 64, 8, css(0x9d978a));
      break;
    case "timber":
      rect(cx, 0, 0, 64, 64, css(0x6b4a33));
      for (let y = 0; y < 64; y += 6) { rect(cx, 0, y, 64, 1, css(0x4a3222)); for (let i = 0; i < 4; i++) rect(cx, Math.floor(r() * 60), y + 2 + Math.floor(r() * 3), 3 + Math.floor(r() * 8), 1, css(0x7d5a40)); }
      break;
    case "steel":
      rect(cx, 0, 0, 64, 64, css(0x4b5159));
      for (let x = 0; x < 64; x += 16) { rect(cx, x, 0, 1, 64, css(0x353a40)); rect(cx, x + 1, 0, 1, 64, css(0x646b74)); }
      break;
    case "roofsteel":
      for (let x = 0; x < 64; x += 8) { rect(cx, x, 0, 8, 64, css(0x8b95a0)); rect(cx, x, 0, 2, 64, css(0xa9b3bd)); rect(cx, x + 6, 0, 2, 64, css(0x6c7580)); }
      for (let i = 0; i < 12; i++) rect(cx, Math.floor(r() * 64), Math.floor(r() * 64), 2, 2, css(0x5a5e5c, 1, 0.4));
      break;
    case "seats_h": case "seats_h_red": case "seats_v": case "seats_v_red": {
      // Rows of tip-up seats on concrete steps, a row every 1.1 m (35 px).
      const seat = m.endsWith("red") ? 0xa8242e : 0x2445a0, vert = m.startsWith("seats_v");
      const [c2, x2] = canvas(32, 35);
      rect(x2, 0, 0, 32, 35, css(0x666a70));
      rect(x2, 0, 0, 32, 1, css(0x84888e));
      rect(x2, 0, 34, 32, 1, css(0x4c5056));
      for (let x = 1; x < 32; x += 16) {
        rect(x2, x, 6, 13, 6, css(seat, 0.8));
        rect(x2, x, 6, 13, 1, css(seat, 1.25));
        rect(x2, x + 1, 12, 11, 7, css(seat));
        rect(x2, x + 1, 19, 11, 2, css(0x202328));
      }
      if (!vert) return c2;
      const [c3, x3] = canvas(35, 32);
      x3.translate(35, 0); x3.rotate(Math.PI / 2); x3.drawImage(c2, 0, 0);
      return c3;
    }
  }
  return cv;
}

export function ensureMaterials(scene: Phaser.Scene): void {
  for (const m of ["palisade", "brick", "stock", "block", "clad", "cabin", "render", "timber", "steel", "roofsteel", "seats_h", "seats_v", "seats_h_red", "seats_v_red"] as Mat[]) {
    if (!scene.textures.exists(`mat-${m}`)) scene.textures.addCanvas(`mat-${m}`, material(m));
  }
}

/** Which material a layout wall is built from, by its colour. */
export function matOf(colour: number, h3: number, gate?: string): Mat {
  if (gate) return "steel";
  if (h3 <= 1.2) return "timber";
  if (colour === 0x7a4a3a) return "brick";
  if (colour === 0x6f7a62) return "cabin";
  if ([0x6a5a4a, 0x4d5640, 0x4a3d60].includes(colour)) return "stock";
  if (colour === 0x6a5a70) return "render";
  return "block";
}

// ---------- Floors: PixelLab tiles laid at random ----------
/** Tile sets (texture keys of 32 px tiles) with weights: the first is the common one. */
export const FLOORS: Record<string, [string, number][]> = {
  asphalt: [["outdoor-0", 8], ["outdoor-1", 2], ["outdoor-2", 2]],
  slabs: [["outdoor-4", 5], ["outdoor-5", 3], ["outdoor-6", 3], ["outdoor-7", 2]],
  concrete: [["outdoor-9", 1]],
  grass: [["outdoor-13", 5], ["outdoor-14", 3], ["outdoor-15", 3], ["outdoor-12", 1]],
  herringbone: [["outdoor2-0", 6], ["outdoor2-1", 3], ["outdoor2-2", 2], ["outdoor2-3", 1]],
  tarmac: [["outdoor2-7", 8], ["outdoor2-6", 1]],
  gravel: [["outdoor2-8", 5], ["outdoor2-9", 3], ["outdoor2-10", 1], ["outdoor2-11", 2]],
  pubcarpet: [["indoor-0", 3], ["indoor-1", 1]],
  lino: [["indoor-2", 4], ["indoor-3", 1]],
  whitetile: [["indoor-5", 3], ["indoor-4", 1]],
  boards: [["indoor-6", 3], ["indoor-7", 2]],
  rubber: [["indoor-8", 3], ["indoor-9", 1]],
  concourse: [["outdoor-9", 1]],
  office: [["indoor-12", 3], ["indoor-13", 1]],
  quarry: [["indoor-14", 3], ["indoor-15", 1]],
};
export const TILE_FILES = [...new Set(Object.values(FLOORS).flatMap((l) => l.map(([k]) => k)))];

/** A 256 px square of one floor, made of its tiles picked at random (so the repeat is 8 m, not 1 m). */
export function ensureFloor(scene: Phaser.Scene, name: string): string | null {
  const key = `floor-${name}`;
  if (scene.textures.exists(key)) return key;
  const set = FLOORS[name];
  if (!set || set.some(([k]) => !scene.textures.exists(`tile-${k}`))) return null;
  const [cv, cx] = canvas(256, 256), r = rng(name.length * 131 + name.charCodeAt(1));
  const total = set.reduce((a, [, w]) => a + w, 0);
  for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
    let pick = r() * total, k = set[0][0];
    for (const [kk, w] of set) { if ((pick -= w) < 0) { k = kk; break; } }
    cx.drawImage(scene.textures.get(`tile-${k}`).getSourceImage() as HTMLImageElement, tx * 32, ty * 32);
  }
  scene.textures.addCanvas(key, cv);
  return key;
}

// ---------- Buildings ----------
export interface Door { x0: number; x1: number; kind: "pub" | "shop" | "glass" | "steel" }
export interface BuildingSpec {
  id: string;
  /** Footprint in metres, outer faces of the walls. */
  rect: { x0: number; y0: number; x1: number; y1: number };
  height: number;
  mat: Mat;
  roof: "slate" | "felt" | "ribbed";
  /** Gaps in the front wall, world x. */
  doors: Door[];
  front: "pub" | "charity" | "surplus" | "bookies" | "hotel" | "cabin";
  sign?: { text: string; bg: number; fg: number };
  awning?: [number, number];
  chimney?: boolean;
}

/** A window: frame, glass with a sky reflection, a sill. `inside` tints the glass (warm pub light, shop goods). */
function windowAt(cx: Ctx, x: number, y: number, w: number, h: number, frame: number, warm = 0, bars = 0) {
  rect(cx, x - 2, y - 2, w + 4, h + 4, css(frame, 0.55));
  rect(cx, x - 1, y - 1, w + 2, h + 2, css(frame));
  for (let i = 0; i < h; i++) rect(cx, x, y + i, w, 1, css(0x2e3c4a, 0.85 + (i / h) * 0.45));
  if (warm) { cx.fillStyle = css(warm, 1, 0.45); cx.fillRect(x, y + h * 0.35, w, h * 0.65); }
  // Two diagonal glints of sky.
  cx.fillStyle = "rgba(210,225,235,0.28)";
  for (let i = 0; i < h; i++) { cx.fillRect(x + Math.max(0, w * 0.15 + i * 0.6 - h * 0.3), y + i, 3, 1); cx.fillRect(x + Math.max(0, w * 0.55 + i * 0.6 - h * 0.3), y + i, 1, 1); }
  const n = bars || Math.max(0, Math.round(w / 26) - 1);
  for (let i = 1; i <= n; i++) rect(cx, x + (w * i) / (n + 1) - 1, y, 2, h, css(frame));
  rect(cx, x - 3, y + h + 1, w + 6, 2, css(0xcfcabd));
  rect(cx, x - 3, y + h + 3, w + 6, 1, "rgba(0,0,0,0.35)");
}

function shopGoods(cx: Ctx, kind: BuildingSpec["front"], x: number, y: number, w: number, h: number, r: () => number) {
  if (kind === "charity") {
    rect(cx, x + 2, y + 5, w - 4, 1, css(0x9a9a9a));
    const cols = [0xb04a5a, 0x5a7ab0, 0xd8c070, 0x6a9a6a, 0xe0e0d8, 0x8a5aa0, 0xc07a40];
    for (let xx = x + 3; xx < x + w - 6; xx += 5 + Math.floor(r() * 3)) rect(cx, xx, y + 6, 4, 10 + Math.floor(r() * 8), css(cols[Math.floor(r() * cols.length)], 0.9));
    rect(cx, x + w - 12, y + 4, 6, 6, css(0xd8b48a)); rect(cx, x + w - 13, y + 10, 8, 14, css(0x7a4a8a));
  } else if (kind === "surplus") {
    const cols = [0x5a6a3a, 0x6a6448, 0x4a5236, 0x7a7050, 0x3a4030];
    for (let xx = x + 3; xx < x + w - 6; xx += 7) { rect(cx, xx, y + 8 + Math.floor(r() * 6), 6, 12, css(cols[Math.floor(r() * cols.length)])); }
    rect(cx, x + 4, y + h - 8, 10, 6, css(0x4a5236)); rect(cx, x + 5, y + h - 11, 8, 3, css(0x5a6a3a));
  } else if (kind === "bookies") {
    const cols: [number, string][] = [[0xd7263d, "ODDS"], [0xf2c94c, "BET"], [0x2f9e5a, "WIN"], [0xf4f1ea, "2/1"]];
    let i = 0;
    for (let xx = x + 3; xx < x + w - 14; xx += 18) {
      const [c, t] = cols[i++ % cols.length];
      rect(cx, xx, y + 4, 15, h - 10, css(c));
      pixelText(cx, t, xx, y + 6, 15, 9, c === 0xf4f1ea || c === 0xf2c94c ? "#1a1a1a" : "#ffffff", 1);
    }
  }
}

function doorAt(cx: Ctx, kit: (k: string) => HTMLImageElement | null, x: number, w: number, H: number, d: Door) {
  // A recessed doorway: dark reveal, a step, and the door (or a pair) standing open into the dark.
  const doorH = Math.min(H - 10, 76);
  const top = H - doorH;
  rect(cx, x, top, w, doorH, css(0x1a1714));
  rect(cx, x, top, w, 3, css(0x0d0b0a));
  rect(cx, x - 2, top - 4, w + 4, 4, css(0xcfcabd));
  rect(cx, x, H - 3, w, 3, css(0x77736a));
  if (d.kind === "glass") {
    // Sliding glass doors, parted.
    const leaf = Math.floor(w / 4);
    for (const lx of [x + 2, x + w - leaf - 2]) { rect(cx, lx, top + 4, leaf, doorH - 7, css(0x5d7686)); rect(cx, lx, top + 4, leaf, 2, css(0xb8c4cc)); rect(cx, lx + 2, top + 8, 2, doorH - 16, "rgba(230,240,245,0.4)"); }
    return;
  }
  const img = kit(d.kind === "pub" ? "door_pub" : d.kind === "steel" ? "door_steel" : "door_shop");
  if (!img) return;
  // The kit doors are 40 x 76 with the door itself in the middle 30 px.
  const sx = d.kind === "steel" ? 4 : 5, sw = 31;
  if (w < 60) cx.drawImage(img, sx, 0, sw, 76, x + Math.round((w - sw) / 2), H - 76 - 1, sw, 76);
  else {
    cx.drawImage(img, sx, 0, sw, 76, x + 1, H - 77, sw, 76);
    cx.save(); cx.scale(-1, 1); cx.drawImage(img, sx, 0, sw, 76, -(x + w - 1), H - 77, sw, 76); cx.restore();
  }
}

/** The front face of a building: brick or render, windows, a shopfront or pub front, its sign, its doors. */
export function facade(b: BuildingSpec, kit: (k: string) => HTMLImageElement | null): HTMLCanvasElement {
  const W = Math.round((b.rect.x1 - b.rect.x0) * PPM), H = Math.round(b.height * PPM);
  const [cv, cx] = canvas(W, H), r = rng(W * 7 + H);
  const tile = material(b.mat);
  cx.fillStyle = cx.createPattern(tile, "repeat")!;
  cx.save(); cx.translate(0, H % 64); cx.fillRect(0, -(H % 64), W, H); cx.restore();
  // Plinth, and the shadow under the eaves.
  rect(cx, 0, H - 6, W, 6, css(0x4a4744));
  rect(cx, 0, H - 6, W, 1, css(0x6a6764));
  for (let i = 0; i < 4; i++) rect(cx, 0, i, W, 1, `rgba(0,0,0,${0.45 - i * 0.1})`);
  const gaps = b.doors.map((d) => ({ ...d, px0: Math.round((d.x0 - b.rect.x0) * PPM), px1: Math.round((d.x1 - b.rect.x0) * PPM) }));
  const clear = (x0: number, x1: number) => gaps.every((g) => x1 < g.px0 - 6 || x0 > g.px1 + 6);
  const ground = Math.min(H, 3.3 * PPM); // the shopfront zone, from the pavement up
  const gTop = H - ground;
  if (b.front === "charity" || b.front === "surplus" || b.front === "bookies") {
    // A painted shopfront: pilasters, a fascia board across the top, big display windows.
    const paint = b.front === "charity" ? 0x2f5d50 : b.front === "surplus" ? 0x3a4330 : 0x3d2a6b;
    rect(cx, 4, gTop + 6, W - 8, ground - 12, css(paint));
    rect(cx, 4, gTop + 6, W - 8, 1, css(paint, 1.4));
    const fy = gTop + 8, fh = 22;
    rect(cx, 8, fy, W - 16, fh, css(b.sign?.bg ?? paint));
    rect(cx, 8, fy + fh, W - 16, 2, "rgba(0,0,0,0.4)");
    if (b.sign) pixelText(cx, b.sign.text, 12, fy + 2, W - 24, fh - 4, css(b.sign.fg), 2, "rgba(0,0,0,0.45)");
    const wy = fy + fh + 10, wh = H - wy - 14;
    let x = 14;
    for (const g of [...gaps, { px0: W - 8, px1: W }]) {
      const x1 = g.px0 - 8;
      if (x1 - x > 24) { windowAt(cx, x, wy, x1 - x, wh, 0x1d1f22, 0, Math.floor((x1 - x) / 60)); shopGoods(cx, b.front, x, wy, x1 - x, wh, r); }
      x = g.px1 + 8;
    }
    if (b.awning) {
      // A striped canvas awning over the windows.
      const ay = wy - 6, [c1, c2] = b.awning;
      for (let xx = 10; xx < W - 10; xx += 8) rect(cx, xx, ay, 8, 9, css(Math.floor(xx / 8) % 2 ? c1 : c2));
      for (let xx = 10; xx < W - 10; xx += 8) rect(cx, xx + 1, ay + 9, 6, 2, css(Math.floor(xx / 8) % 2 ? c1 : c2, 0.8));
      rect(cx, 10, ay + 11, W - 20, 1, "rgba(0,0,0,0.3)");
    }
  } else if (b.front === "pub") {
    // Victorian pub: dark green tiled ground floor, gold-lettered fascia, warm etched windows, baskets.
    rect(cx, 0, gTop, W, ground - 6, css(0x1f3a2c));
    for (let y = gTop + 4; y < H - 8; y += 6) rect(cx, 0, y, W, 1, css(0x2b4a3a));
    const fy = gTop + 2, fh = 24;
    rect(cx, 0, fy, W, fh, css(b.sign?.bg ?? 0x1c2440));
    rect(cx, 0, fy, W, 2, css(0xc9a240)); rect(cx, 0, fy + fh - 2, W, 2, css(0xc9a240));
    if (b.sign) pixelText(cx, b.sign.text, 8, fy + 3, W - 16, fh - 6, css(b.sign.fg), 2, "rgba(0,0,0,0.6)");
    const wy = fy + fh + 12, wh = H - wy - 18;
    for (let x = 18; x + 70 < W; x += 96) {
      if (!clear(x, x + 70)) continue;
      windowAt(cx, x, wy, 70, wh, 0x5a3a22, 0xe0a050, 2);
      rect(cx, x, wy + Math.floor(wh * 0.55), 70, 1, css(0x5a3a22));
    }
    // Upstairs: sash windows in the brick, and hanging baskets between the windows below.
    const upH = gTop - 14;
    if (upH > 30) for (let x = 26; x + 34 < W; x += 72) windowAt(cx, x, 12, 34, Math.min(46, upH - 4), 0xe8e6df, 0, 1);
    const basket = kit("flowerbox");
    if (basket) for (let x = 2; x < W - 30; x += 96) if (clear(x, x + 30)) cx.drawImage(basket, x, fy + fh - 2);
  } else if (b.front === "hotel") {
    // Rendered hotel: a glazed ground floor with a canopy, rows of windows above.
    for (let fl = 0; fl * 1.0 < 3 && gTop - 10 - fl * 52 > 10; fl++) {
      const y = gTop - 46 - fl * 52;
      if (y < 6) break;
      for (let x = 14; x + 40 < W; x += 58) windowAt(cx, x, y, 40, 34, 0xe8e6df, 0, 1);
    }
    rect(cx, 0, gTop, W, ground - 6, css(0x3a3f46));
    let x = 10;
    for (const g of [...gaps, { px0: W - 6, px1: W }]) { if (g.px0 - 6 - x > 20) windowAt(cx, x, gTop + 34, g.px0 - 6 - x, ground - 46, 0x2a2d31, 0xd8c8a0, Math.floor((g.px0 - x) / 40)); x = g.px1 + 6; }
    rect(cx, 0, gTop + 4, W, 20, css(0x22262c));
    rect(cx, 0, gTop + 24, W, 2, "rgba(0,0,0,0.5)");
    if (b.sign) pixelText(cx, b.sign.text, 8, gTop + 6, W - 16, 16, css(b.sign.fg), 2);
  } else if (b.front === "cabin") {
    for (let x = 16; x + 44 < W; x += 80) windowAt(cx, x, H - 66, 44, 26, 0xdedad0, 0, 1);
    rect(cx, 0, H - 4, W, 4, css(0x3a3a38));
  }
  for (const g of gaps) doorAt(cx, kit, g.px0, g.px1 - g.px0, H, g);
  return cv;
}

/** A roof seen from above and in front: slate with a ridge, flat felt with a parapet and plant, or ribbed steel. */
export function roof(b: BuildingSpec): HTMLCanvasElement {
  const W = Math.round((b.rect.x1 - b.rect.x0) * PPM), D = Math.round((b.rect.y1 - b.rect.y0) * PPM);
  const [cv, cx] = canvas(W, D), r = rng(W * 13 + D);
  if (b.roof === "slate") {
    const ridge = Math.round(D * 0.42);
    // Back slope (facing away, in shade) and front slope (lit): courses of overlapping slates,
    // each with a lit lower edge, so it reads as a roof and not as a wall.
    for (let y = 0; y < D; y += 6) {
      const front = y >= ridge, base = front ? 0x5a6378 : 0x343a4a;
      const off = (y / 6) % 2 ? 5 : 0;
      rect(cx, 0, y, W, 6, css(base, 0.75));
      for (let x = -off; x < W; x += 10) {
        const k = 0.92 + r() * 0.16;
        rect(cx, x + 1, y, 9, 5, css(base, k));
        rect(cx, x + 1, y + 4, 9, 1, css(base, k * (front ? 1.3 : 1.15)));
      }
      // Light falls across the front slope from the top left.
      if (front) { cx.fillStyle = `rgba(255,255,255,${0.06 * (1 - (y - ridge) / (D - ridge))})`; cx.fillRect(0, y, W, 6); }
    }
    // The gable ends: a verge of the wall's own material.
    rect(cx, 0, 0, 3, D, css(0x2a2e38)); rect(cx, W - 3, 0, 3, D, css(0x2a2e38));
    rect(cx, 0, ridge - 3, W, 6, css(0x7a5545)); rect(cx, 0, ridge - 3, W, 1, css(0x9a7060));
    for (let x = 0; x < W; x += 10) rect(cx, x, ridge - 3, 1, 6, css(0x5a3a30));
    rect(cx, 0, D - 4, W, 4, css(0x22252a));
    if (b.chimney) for (const cxp of [Math.round(W * 0.22), Math.round(W * 0.74)]) {
      const y = ridge - 26;
      rect(cx, cxp, y, 26, 30, css(0x8a4634)); rect(cx, cxp, y, 26, 4, css(0x9c9488));
      for (let i = 0; i < 3; i++) { rect(cx, cxp + 3 + i * 8, y - 8, 5, 8, css(0xa0583e)); rect(cx, cxp + 3 + i * 8, y - 8, 5, 2, css(0x2a2420)); }
      rect(cx, cxp + 26, y + 4, 6, 26, "rgba(0,0,0,0.25)");
    }
  } else if (b.roof === "felt") {
    rect(cx, 0, 0, W, D, css(0x56534d));
    for (let i = 0; i < (W * D) / 40; i++) rect(cx, Math.floor(r() * W), Math.floor(r() * D), 1, 1, css(0x56534d, 0.85 + r() * 0.3));
    // Parapet all round, and the plant on top: air handlers, a stair housing, vents.
    rect(cx, 0, 0, W, 6, css(0xa8a49a)); rect(cx, 0, D - 6, W, 6, css(0xa8a49a)); rect(cx, 0, 0, 6, D, css(0xa8a49a)); rect(cx, W - 6, 0, 6, D, css(0xa8a49a));
    rect(cx, 6, 6, W - 12, 3, "rgba(0,0,0,0.3)");
    const box = (x: number, y: number, w: number, h: number, c: number) => { rect(cx, x + 3, y + 3, w, h, "rgba(0,0,0,0.3)"); rect(cx, x, y, w, h, css(c)); rect(cx, x, y, w, 2, css(c, 1.25)); for (let i = 4; i < w - 2; i += 4) rect(cx, x + i, y + 4, 1, h - 6, css(c, 0.75)); };
    box(Math.round(W * 0.15), Math.round(D * 0.25), 48, 30, 0x9aa0a6);
    box(Math.round(W * 0.6), Math.round(D * 0.2), 64, 40, 0x8a9096);
    box(Math.round(W * 0.35), Math.round(D * 0.6), 40, 30, 0x7a7d80);
    for (let i = 0; i < 5; i++) { const x = 20 + Math.floor(r() * (W - 40)), y = 20 + Math.floor(r() * (D - 40)); rect(cx, x, y, 6, 6, css(0x3a3c40)); rect(cx, x + 1, y + 1, 4, 2, css(0x6a6c70)); }
  } else {
    for (let y = 0; y < D; y += 6) { rect(cx, 0, y, W, 6, css(0x9aa3a8)); rect(cx, 0, y, W, 1, css(0xc0c8cc)); rect(cx, 0, y + 5, W, 1, css(0x7a8288)); }
    rect(cx, 0, D - 3, W, 3, css(0x4a4e52));
  }
  cx.strokeStyle = "rgba(0,0,0,0.55)"; cx.lineWidth = 1; cx.strokeRect(0.5, 0.5, W - 1, D - 1);
  return cv;
}

/** A floodlight pylon: a lattice mast and a bank of lamps, 16 m of it. */
export function floodlight(): HTMLCanvasElement {
  const W = 96, H = 16 * PPM;
  const [cv, cx] = canvas(W, H);
  const mid = W / 2, head = 72;
  for (let y = head; y < H; y++) {
    const half = 3 + ((y - head) / (H - head)) * 9;
    rect(cx, mid - half, y, 2, 1, css(0x8a9198)); rect(cx, mid + half - 2, y, 2, 1, css(0x5e656c));
    const k = (y - head) % 24;
    if (k < 24) { const t = k / 24; rect(cx, mid - half + 2 + (half * 2 - 4) * t, y, 1, 1, css(0x737a81)); rect(cx, mid + half - 3 - (half * 2 - 4) * t, y, 1, 1, css(0x737a81)); }
    if (k === 0) rect(cx, mid - half, y, half * 2, 1, css(0x737a81));
  }
  rect(cx, 4, 8, W - 8, head - 8, css(0x30353a));
  rect(cx, 4, 8, W - 8, 2, css(0x60666c));
  for (let ry = 0; ry < 3; ry++) for (let rx = 0; rx < 5; rx++) {
    const x = 10 + rx * 16, y = 16 + ry * 16;
    rect(cx, x, y, 12, 12, css(0x1a1d20)); rect(cx, x + 1, y + 1, 10, 10, css(0xf3f0dc)); rect(cx, x + 2, y + 2, 4, 3, "#ffffff");
  }
  rect(cx, mid - 8, H - 6, 16, 6, css(0x6a6e72));
  return cv;
}

/** A long banner hanging from the fascia: a cross of St George, or words on a coloured cloth. */
export function banner(text: string, bg: number, fg: number, trim: number, cross = false): HTMLCanvasElement {
  const W = 112, H = 200;
  const [cv, cx] = canvas(W, H);
  rect(cx, 0, 0, W, 4, css(0x2a2d31));
  rect(cx, 2, 4, W - 4, H - 14, css(bg));
  // The bottom is cut in a swallowtail; the cloth has a few hanging folds.
  for (let i = 0; i < 10; i++) { rect(cx, 2, H - 10 + i, (W - 4) / 2 - i * 4, 1, css(bg)); rect(cx, W / 2 + i * 4, H - 10 + i, (W - 4) / 2 - i * 4, 1, css(bg)); }
  if (cross) { rect(cx, W / 2 - 7, 4, 14, H - 14, css(fg)); rect(cx, 2, 70, W - 4, 14, css(fg)); }
  else { rect(cx, 2, 4, W - 4, 6, css(trim)); rect(cx, 2, H - 22, W - 4, 6, css(trim)); pixelText(cx, text, 6, 18, W - 12, H - 50, css(fg), 2); }
  for (const x of [22, 56, 88]) rect(cx, x, 6, 1, H - 20, "rgba(0,0,0,0.12)");
  return cv;
}

/** Repaint the gibberish on a picture's sign board. */
export function repaintSign(img: HTMLImageElement, box: { x: number; y: number; w: number; h: number }, text: string, bg: string, fg: string): HTMLCanvasElement {
  const [cv, cx] = canvas(img.width, img.height);
  cx.drawImage(img, 0, 0);
  rect(cx, box.x, box.y, box.w, box.h, bg);
  pixelText(cx, text, box.x + 1, box.y + 1, box.w - 2, box.h - 2, fg, 2);
  return cv;
}

export { canvas };

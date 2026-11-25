// The world as pictures: PixelLab buildings and props standing on their real footprints,
// with sign boards repainted in a pixel font (the generator's lettering is gibberish), plus
// the stadium's own outside: roofed stands, a clad facade, the turnstile block, floodlights.
import Phaser from "phaser";
import type { Venue } from "../stadium/layout";

export const WORLD_KEYS = ["pub", "charity", "surplus", "bookies", "ticketoffice", "merch", "hotel", "cabin", "turnstiles", "facade", "floodlight",
  "burgervan", "barrier", "bollard", "bin", "lamppost", "bench", "programmes", "phonebox", "portaloo", "bigscreen", "policevan", "staffdoor"] as const;
/** Eight-way pictures (S, SE, E, NE, N, NW, W, SW in a row) for things that turn. */
export const WORLD_8 = ["coach", "lorry"] as const;
export type WorldKey = (typeof WORLD_KEYS)[number];

/** A picture in the world: centred on x, its bottom edge on the front line y, `w` metres wide. */
export interface Placement {
  id: string;
  key: WorldKey;
  x: number;
  y: number;
  w: number;
  /** The building it is the outside of: fade it when the player is in here. */
  inside?: { x0: number; y0: number; x1: number; y1: number };
  flip?: boolean;
}

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
  "2": "01110100010000100010001000100011111", "3": "11111000100010000010000011000101110", ".": "00000000000000000000000000110001100",
};

/** Paint words onto a canvas in the pixel font, centred in a box, scaled to fit. */
function pixelText(cx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, colour: string): void {
  const lines = text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  const scale = Math.max(1, Math.floor(Math.min(w / (longest * 6 - 1), h / (lines.length * 8 - 1))));
  const lh = 8 * scale, totalH = lines.length * lh - scale;
  cx.fillStyle = colour;
  lines.forEach((line, li) => {
    const lw = line.length * 6 * scale - scale;
    let px = Math.round(x + (w - lw) / 2);
    const py = Math.round(y + (h - totalH) / 2 + li * lh);
    for (const ch of line.toUpperCase()) {
      const gl = GLYPHS[ch] ?? GLYPHS[" "];
      for (let i = 0; i < 35; i++) if (gl[i] === "1") cx.fillRect(px + (i % 5) * scale, py + Math.floor(i / 5) * scale, scale, scale);
      px += 6 * scale;
    }
  });
}

/** Where the generator's gibberish lettering sits on each picture, and what it should say. */
const SIGNS: Partial<Record<WorldKey, { x: number; y: number; w: number; h: number; bg: string; fg: string; text: string }[]>> = {
  pub: [{ x: 74, y: 105, w: 228, h: 10, bg: "#1c2440", fg: "#f2c94c", text: "THE THREE LIONS" }],
  bookies: [{ x: 52, y: 16, w: 104, h: 17, bg: "#3d2a6b", fg: "#f2c94c", text: "LUCKY LIONEL'S" }],
  surplus: [{ x: 71, y: 16, w: 59, h: 21, bg: "#e8dcb8", fg: "#2f3d22", text: "ARMY & NAVY\nSURPLUS" }],
  ticketoffice: [{ x: 40, y: 15, w: 50, h: 8, bg: "#3a7bd5", fg: "#ffffff", text: "TICKETS" }],
  staffdoor: [{ x: 30, y: 3, w: 36, h: 11, bg: "#f2c94c", fg: "#1a1a1a", text: "STAFF" }],
  turnstiles: [
    { x: 40, y: 22, w: 32, h: 8, bg: "#6ccf4c", fg: "#14301a", text: "GATE A" },
    { x: 104, y: 22, w: 33, h: 8, bg: "#6ccf4c", fg: "#14301a", text: "GATE B" },
    { x: 167, y: 22, w: 33, h: 8, bg: "#6ccf4c", fg: "#14301a", text: "GATE C" },
  ],
};

export class WorldArt {
  /** Fraction of each picture's height where its bottom edge is, and the width of what's drawn (px). */
  base: Record<string, { foot: number; left: number; right: number }> = {};

  constructor(private scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    for (const k of WORLD_KEYS) scene.load.image(`w-${k}-src`, `world/${k}.png`);
    scene.load.spritesheet("w-coach8", "world/coach-8.png", { frameWidth: 160, frameHeight: 160 });
    scene.load.spritesheet("w-lorry8", "world/lorry-8.png", { frameWidth: 128, frameHeight: 128 });
  }

  /** Repaint the signs and measure each picture once. */
  prepare(): void {
    for (const k of WORLD_KEYS) {
      if (this.scene.textures.exists(`w-${k}`) || !this.scene.textures.exists(`w-${k}-src`)) continue;
      const src = this.scene.textures.get(`w-${k}-src`).getSourceImage() as HTMLImageElement;
      const cv = document.createElement("canvas");
      cv.width = src.width; cv.height = src.height;
      const cx = cv.getContext("2d", { willReadFrequently: true })!;
      cx.drawImage(src, 0, 0);
      for (const s of SIGNS[k] ?? []) {
        cx.fillStyle = s.bg; cx.fillRect(s.x, s.y, s.w, s.h);
        pixelText(cx, s.text, s.x + 1, s.y + 1, s.w - 2, s.h - 2, s.fg);
      }
      // The lowest row with anything solid in it is where the picture stands.
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      let foot = cv.height, left = cv.width, right = 0;
      for (let y = cv.height - 1; y >= 0 && foot === cv.height; y--) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 200) { foot = y + 1; break; }
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 200) { left = Math.min(left, x); right = Math.max(right, x); }
      this.base[k] = { foot: foot / cv.height, left, right };
      this.scene.textures.addCanvas(`w-${k}`, cv);
    }
  }
}

const r = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

/** Everything placed outside, for the quarter-final ground; the semi-final mirrors it. */
export function placements(venue: Venue): Placement[] {
  const out: Placement[] = [
    { id: "pub", key: "pub", x: -48, y: 80.5, w: 28.5, inside: r(-62.5, 61.5, -34, 80.5) },
    { id: "charity", key: "charity", x: -11, y: 72.5, w: 15, inside: r(-18.5, 61.5, -3.5, 72.5) },
    { id: "surplus", key: "surplus", x: 15, y: 72.5, w: 15, inside: r(7.5, 61.5, 22.5, 72.5) },
    { id: "bookies", key: "bookies", x: 36, y: 72.5, w: 17, inside: r(27.5, 61.5, 44.5, 72.5) },
    { id: "ticketoffice", key: "ticketoffice", x: 21, y: 48.4, w: 10 },
    { id: "merch", key: "merch", x: -21, y: 48.4, w: 10 },
    { id: "hotel", key: "hotel", x: 83, y: -14, w: 18.5, inside: r(73.5, -40.5, 92, -14) },
    { id: "cabin", key: "cabin", x: 82, y: 58, w: 12, inside: r(76, 50, 88, 58) },
    { id: "turnstiles", key: "turnstiles", x: 0, y: 45.2, w: 19 },
    { id: "staffdoor", key: "staffdoor", x: 59.5, y: 51.1, w: 3.6 },
    { id: "policevan", key: "policevan", x: 32, y: 55.6, w: 6 },
    { id: "burgervan", key: "burgervan", x: 46, y: 53, w: 6.5 },
    { id: "programmes", key: "programmes", x: -34, y: 50, w: 2.6 },
    { id: "phonebox", key: "phonebox", x: -30, y: 83.4, w: 1.4 },
  ];
  // Queue barriers in front of the turnstiles; bollards along the approach; lamp posts on the ring road.
  for (const x of [-9, -3, 3, 9]) out.push({ id: `bar${x}`, key: "barrier", x, y: 50.5, w: 2.6 });
  for (let x = -52; x <= 52; x += 13) if (Math.abs(x) > 8) out.push({ id: `bol${x}`, key: "bollard", x, y: 60.6, w: 0.6 });
  for (let x = -84; x <= 84; x += 24) out.push({ id: `lamp${x}`, key: "lamppost", x, y: 83.6, w: 1 });
  for (const [i, x, y] of [[0, -2, 73.4], [1, 23.6, 73.4], [2, -33, 81.6], [3, 45.6, 73.4]] as const) out.push({ id: `bin${i}`, key: "bin", x, y, w: 1.1 });
  for (const [i, x, y] of [[0, -28, 72], [1, -28, 77.5]] as const) out.push({ id: `bench${i}`, key: "bench", x, y, w: 2.8 });
  // Floodlights at the four corners of the ground.
  for (const [i, x, y] of [[0, -54.5, 43.5], [1, 54, 43.5], [2, -54.5, -37], [3, 54, -37]] as const) out.push({ id: `flood${i}`, key: "floodlight", x, y, w: 2.6 });
  if (venue.features.fanZone) {
    // The pub's an open-air fan zone here: a big screen, portable toilets and benches instead of a building.
    out.shift();
    out.push({ id: "bigscreen", key: "bigscreen", x: -48, y: 64, w: 14 });
    for (const [i, x] of [[0, -61], [1, -59], [2, -57]] as const) out.push({ id: `loo${i}`, key: "portaloo", x, y: 67.6, w: 1.5 });
    for (const [i, x, y] of [[0, -50, 72], [1, -44, 72], [2, -50, 76], [3, -44, 76]] as const) out.push({ id: `fzb${i}`, key: "bench", x, y, w: 2.8 });
  }
  if (venue.id === "sf") {
    for (const p of out) {
      p.x = -p.x; p.flip = !p.flip;
      if (p.inside) p.inside = { x0: -p.inside.x1, x1: -p.inside.x0, y0: p.inside.y0, y1: p.inside.y1 };
    }
  }
  return out;
}

// PixelLab characters in the game: five base sheets (8 directions standing, 8 x 8 walk
// frames, 88px cells), recoloured at load time so one fat fan can be every supporter,
// barman and disguise, and one steward can be police. A workable stopgap until the full
// 48px cast is generated.
import Phaser from "phaser";
import EXTRAS from "../../assets/art/extras.json";

/** Extra animation sheets each base has (punch, hit, fall, ...): one row per direction, frames across. */
export const EXTRA: Record<string, string[]> = EXTRAS as Record<string, string[]>;

export const CELL = 88;
export const BASES = ["fan", "steward", "england", "portugal", "referee", "fanbare", "lad", "woman", "oldboy", "police", "suit", "bigman", "horse", "horsefree", "horsefan", "mascot"] as const;
export type Base = (typeof BASES)[number];
/** Pixel rows (within a cell) of the figure's feet and the top of the head. */
export const FEET = 73, HEAD = 13;
/** Cell size and foot row per base (the mounted officer needs a bigger cell). */
export const cellOf = (b: string) => (b.startsWith("horse") ? 128 : CELL);
export const feetOf = (b: string) => (b.startsWith("horse") ? 108 : FEET);

/** Which of the 8 directions a facing angle (radians, y down) is closest to. Sheet order: S, SE, E, NE, N, NW, W, SW. */
export function dirIndex(a: number): number {
  const order = [2, 1, 0, 7, 6, 5, 4, 3];
  const k = Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) / (Math.PI / 4)) % 8;
  return order[k];
}

export interface Recolour {
  shirt?: number;
  trim?: number;
  legs?: number;
  vest?: number;
  skin?: number;
}

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lum = (r: number, g: number, b: number) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;
function hsl(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  const R = r / 255, G = g / 255, B = b / 255;
  if (mx === R) h = ((G - B) / d) % 6; else if (mx === G) h = (B - R) / d + 2; else h = (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/** Paint a shade of `to`, as light or dark as the source pixel is relative to `ref` lightness. */
function shadeTo(data: Uint8ClampedArray, i: number, to: number, ref: number): void {
  const k = Math.max(0.2, Math.min(1.35, lum(data[i], data[i + 1], data[i + 2]) / ref));
  const [r, g, b] = rgb(to);
  data[i] = Math.min(255, r * k); data[i + 1] = Math.min(255, g * k); data[i + 2] = Math.min(255, b * k);
}

/** What each pixel of a base sheet is, by colour and by where it sits in the body. */
function classify(base: Base, r: number, g: number, b: number, y: number, lying = false): keyof Recolour | null {
  const [h, s, l] = hsl(r, g, b);
  const skin = h >= 8 && h <= 40 && s > 0.35 && l > 0.35 && l < 0.85 && r > b + 40;
  if (skin && base !== "mascot") return "skin";
  if (lying) {
    // On the floor the body isn't in its usual rows: go by colour alone.
    if (base === "steward" || base === "police") return h > 45 && h < 75 && s > 0.35 && l > 0.25 ? "vest" : null;
    if (s < 0.3 && l > 0.55) return base === "fanbare" ? null : "shirt";
    if (h > 190 && h < 250 && l > 0.08 && l < 0.3 && s > 0.25) return "trim";
    if (h > 190 && h < 250 && l >= 0.3) return "legs";
    return null;
  }
  switch (base) {
    case "lad":
    case "woman": {
      // A replica shirt over trackies or jeans.
      if (y >= 27 && y <= 50 && s < 0.3 && l > 0.5) return "shirt";
      if (y >= 27 && y <= 50 && h > 200 && h < 250 && l < 0.35 && l > 0.05) return "trim";
      return null;
    }
    case "fanbare":
      if (y > 53 && y <= 66 && h > 190 && h < 250 && l > 0.08) return "legs";
      return null;
    case "oldboy": case "police": case "suit": case "bigman": case "horse": case "horsefree": case "horsefan": case "mascot":
      return null;
    case "fan":
    case "england": {
      const shirtRows = base === "fan" ? y >= 26 && y <= 53 : y >= 26 && y <= 50;
      const legRows = base === "fan" ? y > 53 && y <= 66 : y > 50 && y <= 60;
      if (shirtRows && s < 0.3 && l > 0.5) return "shirt";
      if (shirtRows && h > 200 && h < 250 && l < 0.35 && l > 0.05) return "trim";
      if (legRows && h > 190 && h < 250 && l > 0.08) return "legs";
      return null;
    }
    case "portugal": {
      if (y > 50 && y <= 60 && ((h > 100 && h < 200) || l < 0.25) && l > 0.04) return "legs";
      if (y >= 26 && y <= 50 && s > 0.3 && ((h < 15 || h > 330) || (h > 100 && h < 200))) return "shirt";
      return null;
    }
    case "steward":
      if (y >= 26 && y <= 52 && h > 45 && h < 75 && s > 0.35 && l > 0.25) return "vest";
      if (y > 52 && y <= 68 && l < 0.35) return "legs";
      return null;
    case "referee":
      if (y >= 26 && y <= 50 && l < 0.3) return "shirt";
      return null;
  }
}

/** Reference lightness of each part on each base, so shading maps across. */
const REF: Record<Base, Partial<Record<keyof Recolour, number>>> = {
  fan: { shirt: 0.93, trim: 0.15, legs: 0.5, skin: 0.7 },
  england: { shirt: 0.95, trim: 0.15, legs: 0.15, skin: 0.7 },
  portugal: { shirt: 0.38, legs: 0.25, skin: 0.7 },
  steward: { vest: 0.82, legs: 0.15, skin: 0.7 },
  referee: { shirt: 0.12, skin: 0.7 },
  fanbare: { legs: 0.5, skin: 0.62 },
  lad: { shirt: 0.92, trim: 0.15, skin: 0.7 },
  woman: { shirt: 0.92, trim: 0.15, skin: 0.72 },
  oldboy: { skin: 0.7 }, police: { skin: 0.7 }, suit: { skin: 0.7 }, bigman: { skin: 0.7 }, horse: {}, horsefree: {}, horsefan: {}, mascot: {},
};

export class SpriteBank {
  private made = new Set<string>();
  constructor(private scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    scene.load.image("tiles-street", "art/tiles-street.png");
    scene.load.image("tiles-pitch", "art/tiles-pitch.png");
    for (const k of BASES) {
      if (!(EXTRA[k] ?? []).includes("rot")) continue;
      scene.load.image(`${k}-rot-src`, `art/${k}-rot.png`);
      if ((EXTRA[k] ?? []).includes("walk")) scene.load.image(`${k}-walk-src`, `art/${k}-walk.png`);
      for (const x of EXTRA[k] ?? []) if (x !== "rot" && x !== "walk") scene.load.image(`${k}-${x}-src`, `art/${k}-${x}.png`);
    }
  }

  /** Is this base's art here? */
  has(base: Base): boolean { return this.scene.textures.exists(`${base}-rot-src`) && this.scene.textures.exists(`${base}-walk-src`); }

  ready(): boolean { return this.scene.textures.exists("fan-rot-src") && this.scene.textures.get("fan-rot-src").key !== "__MISSING"; }

  /** A recoloured copy of one sheet of a base, as a canvas. */
  private paint(base: Base, sheet: string, rc: Recolour): HTMLCanvasElement {
    const src = this.scene.textures.get(`${base}-${sheet}-src`).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const cv = document.createElement("canvas");
    cv.width = src.width; cv.height = src.height;
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    cx.drawImage(src, 0, 0);
    if (Object.values(rc).some((v) => v !== undefined)) {
      const img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 100) continue;
        const p = i / 4, y = Math.floor(p / W) % CELL;
        const part = classify(base, d[i], d[i + 1], d[i + 2], y, sheet === "fall" && Math.floor((p % W) / CELL) >= 4);
        if (!part || rc[part] === undefined) continue;
        shadeTo(d, i, rc[part]!, REF[base][part] ?? 0.6);
      }
      cx.putImageData(img, 0, 0);
    }
    return cv;
  }

  /** The key of a recoloured copy of a base (its `-rot` and `-walk` sheets), made on first use. */
  variant(base: Base, rc: Recolour = {}): string {
    const parts = Object.entries(rc).filter(([, v]) => v !== undefined).sort().map(([k, v]) => `${k}${(v as number).toString(16)}`);
    const key = parts.length ? `${base}~${parts.join("_")}` : base;
    if (this.made.has(key)) return key;
    for (const sheet of new Set(["rot", "walk", ...(EXTRA[base] ?? [])])) {
      if (!this.scene.textures.exists(`${base}-${sheet}-src`)) continue;
      const tkey = `${key}-${sheet}`;
      if (this.scene.textures.exists(tkey)) this.scene.textures.remove(tkey);
      this.scene.textures.addSpriteSheet(tkey, this.paint(base, sheet, rc) as unknown as HTMLImageElement, { frameWidth: cellOf(base), frameHeight: cellOf(base) });
    }
    this.made.add(key);
    return key;
  }

  /** One sheet of seated supporters for the stands: a row per colour scheme, then
   *  facing south, east, north, west, cropped at the seat. Frame = row * 4 + facing. */
  crowdAtlas(key: string, rows: (Recolour & { base?: Base })[]): void {
    const SEAT = 52;
    const cv = document.createElement("canvas");
    // Eight frames a row: sitting facing S, E, N, W, then the same with arms up (from the cheer animation).
    cv.width = CELL * 8; cv.height = SEAT * rows.length;
    const cx = cv.getContext("2d")!;
    rows.forEach((rc, r) => {
      const { base = "fan", ...col } = rc;
      const b = this.has(base) ? base : "fan";
      const src = this.paint(b, "rot", col);
      [0, 2, 4, 6].forEach((cell, f) => cx.drawImage(src, cell * CELL, 0, CELL, SEAT, f * CELL, r * SEAT, CELL, SEAT));
      const up = this.scene.textures.exists(`${b}-cheer-src`) ? this.paint(b, "cheer", col) : src;
      const n = Math.max(1, Math.round(up.width / CELL)), fr = up === src ? 0 : Math.min(3, n - 1);
      [0, 2, 4, 6].forEach((dir, f) => cx.drawImage(up, (up === src ? dir : fr) * CELL, up === src ? 0 : dir * CELL, CELL, SEAT, (4 + f) * CELL, r * SEAT, CELL, SEAT));
    });
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addSpriteSheet(key, cv as unknown as HTMLImageElement, { frameWidth: CELL, frameHeight: SEAT });
  }
}

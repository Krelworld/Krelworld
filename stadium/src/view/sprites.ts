// PixelLab characters in the game: five base sheets (8 directions standing, 8 x 8 walk
// frames, 88px cells), recoloured at load time so one fat fan can be every supporter,
// barman and disguise, and one steward can be police. A workable stopgap until the full
// 48px cast is generated.
import Phaser from "phaser";
import { assetURL } from "./packs";
import EXTRAS from "../../assets/art/extras.json";

/** Extra animation sheets each base has (punch, hit, fall, ...): one row per direction, frames across. */
export const EXTRA: Record<string, string[]> = EXTRAS as Record<string, string[]>;

export const CELL = 88;
export const BASES = ["fan", "steward", "england", "portugal", "referee", "fanbare", "fandress", "fannaked", "lad", "woman", "oldboy", "police", "suit", "bigman", "horse", "horsefree", "horsefan", "mascot"] as const;
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
  /** Trousers off (the fat fan with no shirt): everything from the waist to the ankles goes this skin tone. */
  naked?: number;
  /** A stick-on moustache, painted on the face in every frame (so it moves with the head). */
  tache?: number;
  /** A wig, painted over the head in every frame; `wigLong` 1 for the long one down to the shoulders. */
  wig?: number;
  wigLong?: number;
  /** Grozz: bald as a coot. The crown's stubble painted out to skin, with a shine on top. */
  bald?: number;
}

/** Paint a moustache and a wig onto every frame of a sheet, found from the figure itself: the top
 *  of the head and its width a few rows down, and which way the frame faces (sheets run S, SE, E,
 *  NE, N, NW, W, SW: across for standing, down the rows for animations). A face that's turned
 *  away gets no moustache; a wig is all you see from behind. */
function dressHead(cx: CanvasRenderingContext2D, cv: HTMLCanvasElement, sheet: string, rc: Recolour, C: number): void {
  if (rc.tache === undefined && rc.wig === undefined && rc.bald === undefined) return;
  const img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width;
  const cols = Math.floor(cv.width / C), rows = Math.floor(cv.height / C);
  const op = (x: number, y: number) => d[(y * W + x) * 4 + 3] > 100;
  const put = (x: number, y: number, c: number, k = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= cv.height) return;
    const i = (y * W + x) * 4, [r, g, b] = rgb(c);
    d[i] = Math.min(255, r * k); d[i + 1] = Math.min(255, g * k); d[i + 2] = Math.min(255, b * k); d[i + 3] = 255;
  };
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const dir = sheet === "rot" ? col : row;
    // Lying down (the back half of a fall): the head's not at the top any more; leave it.
    if (sheet === "fall" && col >= 4) continue;
    const x0 = col * C, y0 = row * C;
    let top = -1;
    for (let y = y0; y < y0 + C && top < 0; y++) for (let x = x0; x < x0 + C; x++) if (op(x, y)) { top = y; break; }
    if (top < 0) continue;
    const span = (y: number) => { let l = -1, r = -1; for (let x = x0; x < x0 + C; x++) if (op(x, y)) { if (l < 0) l = x; r = x; } return [l, r]; };
    const [hl, hr] = span(top + 6), hc = (hl + hr) / 2, hw = hr - hl;
    if (hl < 0 || hw > 26) continue;
    const front = dir === 0 || dir === 1 || dir === 7, back = dir === 3 || dir === 4 || dir === 5;
    const toward = dir === 1 || dir === 2 || dir === 3 ? 1 : dir === 5 || dir === 6 || dir === 7 ? -1 : 0;
    if (rc.bald !== undefined && rc.wig === undefined) {
      // The crown (and, from behind, the whole back of the head): anything darker than skin that
      // isn't the outline becomes skin, keeping its light and shade. Then a glint on top.
      const deep = back ? 10 : toward && !front ? 5 : 4;
      const skin = [214, 128, 94];
      for (let y = top + 1; y <= top + deep; y++) {
        const [l, r] = span(y);
        if (l < 0) continue;
        for (let x = l + 1; x < r; x++) {
          if (!back && toward && y > top + 2 && (x - hc) * toward > 0) continue; // the face side, from the side
          const i = (y * W + x) * 4, L = lum(d[i], d[i + 1], d[i + 2]);
          if (L < 0.1 || L > 0.5) continue;
          const k = 0.62 + (L - 0.1) * 1.1;
          d[i] = Math.min(255, skin[0] * k); d[i + 1] = Math.min(255, skin[1] * k); d[i + 2] = Math.min(255, skin[2] * k);
        }
      }
      const gx = Math.round(hc - toward * 2 - 1);
      put(gx, top + 2, 0xfad8be, 1); put(gx + 1, top + 2, 0xfad8be, 0.95); put(gx, top + 3, 0xf5ac83, 1);
    }
    if (rc.wig !== undefined) {
      // Hair, not a tiled pattern: strands running down from a parting, darker underneath and at the
      // edges, a sheen across the top.
      const deep = back ? 13 : 5, hash2 = (x: number) => ((x * 7919) % 13) / 13;
      for (let y = top - 1; y <= top + deep; y++) {
        const [l0, r0] = span(Math.max(top, y)), l = y < top ? l0 + 2 : l0, r = y < top ? r0 - 2 : r0;
        if (l0 < 0) continue;
        for (let x = l; x <= r; x++) {
          if (!back && y > top + 3 && toward !== 0 && (x - hc) * toward > hw * 0.15) continue;
          const edge = x === l || x === r || y === top - 1, strand = (x + Math.round(hc)) % 2 === 0 ? 0.9 : 1, depth = 1 - (y - top) * 0.025;
          const sheen = y === top + 1 && Math.abs(x - hc) < hw * 0.3 ? 1.18 : 1;
          put(x, y, rc.wig, edge ? 0.5 : strand * depth * sheen * (0.94 + hash2(x) * 0.1));
        }
      }
      if (rc.wigLong) {
        // Down past the ears to the shoulders: a curtain each side (round the back from behind), the
        // ends a little ragged.
        for (let y = top + 4; y <= top + 20; y++) {
          const fall = 1 - (y - top - 4) * 0.012;
          if (back) {
            for (let x = Math.round(hl - 1); x <= Math.round(hr + 1); x++) {
              if (y > top + 17 && hash2(x + y) > 0.6) continue;
              put(x, y, rc.wig, (x === Math.round(hl - 1) || x === Math.round(hr + 1) ? 0.55 : (x % 2 ? 0.9 : 1)) * fall);
            }
            continue;
          }
          for (const side of [-1, 1]) {
            if (toward === side) continue;
            const ex = side < 0 ? hl - 1 : hr + 1;
            if (y > top + 17 && hash2(ex + y) > 0.5) continue;
            for (let k = 0; k < 3; k++) put(Math.round(ex - side * k), y, rc.wig, (k === 0 ? 0.55 : k === 1 ? 0.95 : 0.82) * fall);
          }
        }
      }
    }
    if (rc.tache !== undefined && !back) {
      // Upper lip: about two-thirds of the way down the head; nudged the way he's facing.
      const ly = top + 12, mx = Math.round(hc + toward * (toward && !front ? hw * 0.38 : hw * 0.12));
      const half = front && toward === 0 ? 3 : 2;
      for (let x = mx - half; x <= mx + half; x++) { put(x, ly, rc.tache, 1); put(x, ly + 1, rc.tache, 0.7); }
      put(mx - half - 1, ly + 1, rc.tache, 0.7); put(mx + half + 1, ly + 1, rc.tache, 0.7);
    }
  }
  cx.putImageData(img, 0, 0);
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
    case "oldboy": case "police": case "suit": case "bigman": case "horse": case "horsefree": case "horsefan": case "mascot": case "fandress": case "fannaked":
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
  fandress: { skin: 0.62 }, fannaked: { skin: 0.62 },
  lad: { shirt: 0.92, trim: 0.15, skin: 0.7 },
  woman: { shirt: 0.92, trim: 0.15, skin: 0.72 },
  oldboy: { skin: 0.7 }, police: { skin: 0.7 }, suit: { skin: 0.7 }, bigman: { skin: 0.7 }, horse: {}, horsefree: {}, horsefan: {}, mascot: {},
};

export class SpriteBank {
  constructor(private scene: Phaser.Scene) {}

  /** Sheets fetched up front: standing, walking, and the cheer the crowd atlas needs. The other
   *  animation sheets are big (8 directions of frames each) and most are never seen in a given match,
   *  so they're fetched and recoloured only when someone first does that thing. Loading and
   *  recolouring the lot up front came to over 700 MB of pictures: enough to crash a phone.
   *  The source sheets are only ever painted from, never drawn, so they stay plain images and never
   *  go to the graphics card. */
  static readonly EAGER = ["rot", "walk", "cheer"];

  static preload(scene: Phaser.Scene): void {
    scene.load.image("tiles-street", "art/tiles-street.png");
    scene.load.image("tiles-pitch", "art/tiles-pitch.png");
    for (const k of BASES) for (const x of EXTRA[k] ?? []) if (SpriteBank.EAGER.includes(x)) SpriteBank.fetch(k, x);
    // Reactions are over in a second: fetch them now, so the first one isn't missed waiting for its sheet.
    for (const k of BASES) for (const x of EXTRA[k] ?? []) if (SpriteBank.REACT.includes(x)) SpriteBank.fetch(k, x);
  }
  static readonly REACT = ["notice", "point", "shrug"];

  /** Source sheets: an image once it has arrived, "wait" while it's on its way. */
  private static lazy = new Map<string, HTMLImageElement | "wait" | "none">();
  private static fetch(base: string, sheet: string): HTMLImageElement | null {
    const k = `${base}-${sheet}`;
    const got = SpriteBank.lazy.get(k);
    if (got instanceof HTMLImageElement) return got;
    if (got) return null;
    SpriteBank.lazy.set(k, "wait");
    const img = new Image();
    img.onload = () => SpriteBank.lazy.set(k, img);
    img.onerror = () => SpriteBank.lazy.set(k, "none");
    img.src = assetURL(`art/${base}-${sheet}.png`);
    return null;
  }
  /** What each variant key was made from, so its other sheets can be painted when wanted. */
  private info = new Map<string, { base: Base; rc: Recolour }>();
  /** Recolouring a sheet takes a few milliseconds: only a couple a frame, so nothing stutters. */
  private budget = { frame: -1, left: 0 };

  /** The source picture of one sheet of a base, or null if it isn't here (yet). */
  srcOf(base: Base, sheet: string): HTMLImageElement | null {
    if (!(EXTRA[base] ?? []).includes(sheet)) return null;
    return SpriteBank.fetch(base, sheet);
  }

  /** Is this sheet of a variant ready to draw? Fetches and paints it on first asking. */
  /** `mine`: the player's own sheet, made even over the allowance (Grozz always gets his punch). */
  sheetReady(key: string, sheet: string, mine = false): boolean {
    const tkey = `${key}-${sheet}`;
    const now = performance.now();
    const have = this.painted.get(tkey);
    if (have) { have.used = now; return true; }
    if (this.scene.textures.exists(tkey)) return true;
    const inf = this.info.get(key);
    if (!inf) return false;
    const src = this.srcOf(inf.base, sheet);
    if (!src) return false;
    const fr = this.scene.game.loop.frame;
    if (this.budget.frame !== fr) this.budget = { frame: fr, left: 2 };
    if (this.budget.left <= 0 && !mine) return false;
    const bytes = src.width * src.height * 4;
    // Over the memory allowance: let go of sheets nobody has used for a while, oldest first. If
    // everything is in use, do without (the standing frame stands in) rather than grow.
    if (this.paintedBytes + bytes > SpriteBank.LAZY_BYTES && !this.evict(now, bytes) && !mine) return false;
    this.budget.left--;
    const cv = this.paint(inf.base, sheet, inf.rc, src);
    this.scene.textures.addSpriteSheet(tkey, cv as unknown as HTMLImageElement, { frameWidth: cellOf(inf.base), frameHeight: cellOf(inf.base) });
    this.painted.set(tkey, { cv, bytes, used: now, rot: `${key}-rot` });
    this.paintedBytes += bytes;
    return true;
  }

  /** How much the on-demand sheets may take between them. */
  static readonly LAZY_BYTES = 64e6;
  private painted = new Map<string, { cv: HTMLCanvasElement; bytes: number; used: number; rot: string }>();
  private paintedBytes = 0;

  /** Free room for `need` more bytes by dropping sheets unused for two seconds. False if that's not enough. */
  private evict(now: number, need: number): boolean {
    const old = [...this.painted].filter(([, p]) => now - p.used > 2000).sort((a, b) => a[1].used - b[1].used);
    for (const [tkey, p] of old) {
      if (this.paintedBytes + need <= SpriteBank.LAZY_BYTES) break;
      // Anything still showing it (off screen, say) goes back to standing first.
      for (const o of this.scene.children.list) {
        const sp = o as Phaser.GameObjects.Sprite;
        if (sp.texture?.key === tkey) sp.setTexture(p.rot, 0);
      }
      this.scene.textures.remove(tkey);
      p.cv.width = p.cv.height = 0; // hand the pixels back now (phones count canvas memory strictly)
      this.painted.delete(tkey);
      this.paintedBytes -= p.bytes;
    }
    return this.paintedBytes + need <= SpriteBank.LAZY_BYTES;
  }

  /** Is this base's art here? */
  has(base: Base): boolean { return !!this.srcOf(base, "rot") && !!this.srcOf(base, "walk"); }

  /** Everything fetched up front has arrived (or failed): the crowd atlas needs the cheers too. */
  ready(): boolean {
    if (!this.has("fan")) return false;
    for (const k of BASES) for (const x of EXTRA[k] ?? []) if (SpriteBank.EAGER.includes(x) && SpriteBank.lazy.get(`${k}-${x}`) === "wait") return false;
    return true;
  }

  /** A recoloured copy of one sheet of a base, as a canvas. */
  private paint(base: Base, sheet: string, rc: Recolour, src = this.srcOf(base, sheet)!): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    cv.width = src.width; cv.height = src.height;
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    cx.drawImage(src, 0, 0);
    if (Object.values(rc).some((v) => v !== undefined)) {
      const img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 100) continue;
        const p = i / 4, y = Math.floor(p / W) % CELL;
        const lyingNow = sheet === "fall" && Math.floor((p % W) / CELL) >= 4;
        if (rc.naked !== undefined && base === "fanbare" && !lyingNow && y > 52 && y <= 66) {
          // Not skin already, and not the black outline: paint it pink.
          const [, , l] = hsl(d[i], d[i + 1], d[i + 2]);
          if (classify(base, d[i], d[i + 1], d[i + 2], y) !== "skin" && l > 0.1) {
            // A flat-ish pink: the trousers' own folds only faintly, so no camouflage pattern shows through.
            const k = Math.max(0.7, Math.min(1.12, 0.92 + (lum(d[i], d[i + 1], d[i + 2]) - 0.4) * 0.45)), [r0, g0, b0] = rgb(rc.naked);
            d[i] = Math.min(255, r0 * k); d[i + 1] = Math.min(255, g0 * k); d[i + 2] = Math.min(255, b0 * k);
            continue;
          }
        }
        const part = classify(base, d[i], d[i + 1], d[i + 2], y, lyingNow);
        if (!part || part === "naked" || rc[part] === undefined) continue;
        shadeTo(d, i, rc[part]!, REF[base][part] ?? 0.6);
      }
      cx.putImageData(img, 0, 0);
    }
    dressHead(cx, cv, sheet, rc, cellOf(base));
    return cv;
  }

  /** The key of a recoloured copy of a base (its `-rot` and `-walk` sheets), made on first use.
   *  Its other sheets are made by sheetReady(). */
  variant(base: Base, rc: Recolour = {}): string {
    const parts = Object.entries(rc).filter(([, v]) => v !== undefined).sort().map(([k, v]) => `${k}${(v as number).toString(16)}`);
    const key = parts.length ? `${base}~${parts.join("_")}` : base;
    const now = performance.now();
    const v = this.vmade.get(key);
    if (v) { v.used = now; return key; }
    this.info.set(key, { base, rc });
    // Too many outfits about: let go of ones nobody has been drawn in for a few seconds.
    if (this.variantBytes > SpriteBank.VARIANT_BYTES) this.evictVariants(now);
    // Standing and walking now; the rest (fall, punch, drink...) when first wanted: see sheetReady().
    const cvs: HTMLCanvasElement[] = [];
    let bytes = 0;
    for (const sheet of ["rot", "walk"]) {
      const src = this.srcOf(base, sheet);
      if (!src) continue;
      const tkey = `${key}-${sheet}`;
      if (this.scene.textures.exists(tkey)) this.scene.textures.remove(tkey);
      const cv = this.paint(base, sheet, rc, src);
      cvs.push(cv); bytes += cv.width * cv.height * 4;
      this.scene.textures.addSpriteSheet(tkey, cv as unknown as HTMLImageElement, { frameWidth: cellOf(base), frameHeight: cellOf(base) });
    }
    this.vmade.set(key, { used: now, bytes, cvs });
    this.variantBytes += bytes;
    return key;
  }

  /** How much the standing-and-walking sheets of all the outfits about may take. */
  static readonly VARIANT_BYTES = 60e6;
  private vmade = new Map<string, { used: number; bytes: number; cvs: HTMLCanvasElement[] }>();
  private variantBytes = 0;

  private evictVariants(now: number): void {
    const old = [...this.vmade].filter(([, v]) => now - v.used > 4000).sort((a, b) => a[1].used - b[1].used);
    const gone = new Set<string>();
    for (const [key, v] of old) {
      if (this.variantBytes <= SpriteBank.VARIANT_BYTES * 0.8) break;
      for (const sheet of ["rot", "walk"]) gone.add(`${key}-${sheet}`);
      for (const [tkey, p] of this.painted) if (tkey.startsWith(`${key}-`) && tkey.slice(key.length + 1).indexOf("-") < 0) { gone.add(tkey); p.cv.width = p.cv.height = 0; this.paintedBytes -= p.bytes; this.painted.delete(tkey); }
      this.variantBytes -= v.bytes;
      this.vmade.delete(key);
      this.info.delete(key);
      v.cvs.forEach((cv) => { cv.width = cv.height = 0; });
    }
    if (!gone.size) return;
    // Nobody visible is wearing these, but a hidden sprite may still point at one: point it elsewhere.
    for (const o of this.scene.children.list) {
      const sp = o as Phaser.GameObjects.Sprite;
      if (sp.texture && gone.has(sp.texture.key)) sp.setTexture("__DEFAULT");
    }
    for (const k of gone) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
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
      const up = this.srcOf(b, "cheer") ? this.paint(b, "cheer", col) : src;
      const n = Math.max(1, Math.round(up.width / CELL)), fr = up === src ? 0 : Math.min(3, n - 1);
      [0, 2, 4, 6].forEach((dir, f) => cx.drawImage(up, (up === src ? dir : fr) * CELL, up === src ? 0 : dir * CELL, CELL, SEAT, (4 + f) * CELL, r * SEAT, CELL, SEAT));
    });
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addSpriteSheet(key, cv as unknown as HTMLImageElement, { frameWidth: CELL, frameHeight: SEAT });
  }
}

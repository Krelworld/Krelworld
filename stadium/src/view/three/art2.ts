// More painted faces: the inside of the ground (seats, hoardings, the concourse), the rooms, and the
// street's small furniture. Sizes in px at 32 px/m unless it says 64 (signs and anything with words on).
import { lion } from "./art";
import { BRICK_RED, FONTS, H, bevel, brick, css, grain, hex, pixText, rect, rng, shade, tiny, weather, type Ctx, type RGB } from "./paint";

const PX = 32;
export const BLUE = 0x1b2a6b, RED = 0xc8102e, CREAM = 0xe6dfcc;

// ---------------------------------------------------------------------------------------------
// The stands.

/** A tread seen from above with a row of tip-up seats on it: `n` seats along the picture, backs at the top. */
export function seatsRow(c: Ctx, w: number, h: number, n: number, col: number, seed: number) {
  const r = rng(seed), seat = hex(col), sw = w / n;
  rect(c, 0, 0, w, h, H(0x6a6e75));
  grain(c, 0, 0, w, h, 5, seed);
  rect(c, 0, h - 3, w, 2, H(0xd9b92a)); rect(c, 0, h - 1, w, 1, H(0x4a4d53)); // the nosing, painted yellow once
  rect(c, 0, 0, w, 2, "rgba(20,22,28,0.45)"); // the riser behind throws a little shade
  for (let i = 0; i < n; i++) {
    const x = Math.round(i * sw) + 3, ww = Math.round(sw) - 6, k = shade(seat, 0.84 + r() * 0.3);
    if (r() < 0.04) { rect(c, x + 2, 6, ww - 4, 3, H(0x3a3d44)); continue; } // one missing: just its bracket
    rect(c, x, 4, ww, 5, css(shade(k, 0.7))); rect(c, x, 4, ww, 2, css(shade(k, 1.25))); // back
    rect(c, x, 10, ww, h - 19, css(k)); rect(c, x, 10, ww, 2, css(shade(k, 1.2))); rect(c, x, h - 10, ww, 2, css(shade(k, 0.6))); // the pan
    rect(c, x + ww, 8, 1, h - 16, "rgba(15,16,22,0.5)");
    if (r() < 0.3) tiny(c, String(1 + ((i * 7 + seed) % 40)), x + 2, h - 8, "rgba(240,240,236,0.5)");
  }
  for (let k = 0; k < n / 2; k++) rect(c, r.int(w), h - 8 + r.int(4), 2 + r.int(3), 1, H(r.pick([0xe8e0cc, 0xc87a3a, 0xb8b8b2, 0xd8322a]))); // what gets dropped
}
/** The same turned on its side for the ends: seats down the picture, backs on the left. */
export function seatsCol(c: Ctx, w: number, h: number, n: number, col: number, seed: number) {
  c.save(); c.translate(0, h); c.rotate(-Math.PI / 2); seatsRow(c, h, w, n, col, seed); c.restore();
}
export function concrete(c: Ctx, w: number, h: number, seed: number, base = 0x7b7e84) {
  const r = rng(seed), b = hex(base);
  rect(c, 0, 0, w, h, css(b)); grain(c, 0, 0, w, h, 7, seed);
  for (let k = 0; k < (w * h) / 500; k++) { c.fillStyle = css(shade(b, r() < 0.5 ? 0.82 : 1.1), 0.35); c.beginPath(); c.ellipse(r.int(w), r.int(h), 3 + r.int(10), 2 + r.int(5), r(), 0, 7); c.fill(); }
  for (let k = 0; k < 3; k++) { let x = r.int(w), y = 0; for (let i = 0; i < h; i++) { rect(c, x, y + i, 1, 1, css(shade(b, 0.62))); if (r() < 0.3) x += r() < 0.5 ? 1 : -1; } }
}

/** Hoardings: what the club will take money from. 64 px/m, any shape about five to one. */
export const ADS: [string, string, number, number][] = [
  ["TEPID LAGER", "IT'S WET", 0xc8102e, 0xf4f1ea], ["KWIKLOAN", "4,000% APR · WE KNOW WHERE YOU LIVE", 0x2f9e5a, 0xffffff], ["NO WIN NO FEE", "NO WIN", 0xf2c94c, 0x141414],
  ["MEAT? PIES", "PROBABLY", 0x1b3a8a, 0xf2c94c], ["DIVORCE DIRECT", "HALF OF EVERYTHING, FAST", 0xf4f1ea, 0xb01030], ["VAPE CATHEDRAL", "BREATHE DIFFERENT", 0x111111, 0x6cf0ff],
  ["DAVE'S SKIPS", "NO QUESTIONS ASKED", 0xe2661c, 0x141414], ["FUNERALS 4 LESS", "BUY ONE GET ONE", 0x23252b, 0xd8c070], ["CRYPTO BINGO", "NAN'S PENSION, TO THE MOON", 0x6a2a9a, 0xf2e85a],
  ["BIG KEV'S TYRES", "PART WORN. LIKE KEV", 0x141414, 0xf2c81e], ["GRAVY: THE DRINK", "NOW IN CANS", 0x5a3418, 0xf4e6c0], ["HAIR TODAY", "TURKEY TEETH TOMORROW", 0x0f6a7a, 0xffffff],
  ["CASH KINGS", "YOUR NAN'S RING, OUR WINDOW", 0x141416, 0xf2c94c], ["BET IRRESPONSIBLY", "WHEN THE FUN STOPS, DOUBLE UP", 0x222222, 0xd7263d],
];
export function advert(c: Ctx, w: number, h: number, i: number) {
  const [t, sub, bg, fg] = ADS[((i % ADS.length) + ADS.length) % ADS.length];
  rect(c, 0, 0, w, h, H(0x15171a)); rect(c, 2, 2, w - 4, h - 6, H(bg));
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,255,255,0.16)"); g.addColorStop(1, "rgba(0,0,0,0.18)"); c.fillStyle = g; c.fillRect(2, 2, w - 4, h - 6);
  const cap = Math.round(h * 0.4);
  pixText(c, t, w / 2, Math.round(h * 0.56), cap, H(fg), { align: "center", maxW: w - 16, shadow: "rgba(0,0,0,0.35)" });
  pixText(c, sub, w / 2, h - 9, Math.max(7, Math.round(h * 0.15)), H(fg), { align: "center", weight: 700, maxW: w - 14 });
  rect(c, 0, h - 4, w, 4, H(0x0d0e10));
  const r = rng(i * 13 + 5); for (let k = 0; k < w / 10; k++) rect(c, r.int(w), 3 + r.int(h - 8), 1, 2 + r.int(6), "rgba(16,14,12,0.2)");
}
export function hoardingBack(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0x2b2f35)); rect(c, 0, 0, w, 2, H(0x4a4f56));
  for (let x = 6; x < w; x += 44) { rect(c, x, 3, 3, h - 3, H(0x1d2024)); rect(c, x + 3, 3, 1, h - 3, H(0x3c4148)); }
  rect(c, 0, Math.round(h * 0.5), w, 2, H(0x1d2024));
}

/** An amber dot-matrix board. 64 px/m. */
export function dotMatrix(c: Ctx, w: number, h: number, lines: string[], title?: string) {
  rect(c, 0, 0, w, h, H(0x101216)); rect(c, 3, 3, w - 6, h - 6, H(0x07080a));
  c.strokeStyle = H(0x3a3f47); c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
  let y = 8;
  if (title) { rect(c, 6, 6, w - 12, 22, H(BLUE)); pixText(c, title, w / 2, 24, 13, "#f4f4f4", { align: "center", maxW: w - 20 }); y = 34; }
  const lh = (h - y - 6) / lines.length;
  lines.forEach((t, i) => {
    const cap = Math.min(18, Math.round(lh * 0.56));
    pixText(c, t, w / 2, Math.round(y + i * lh + lh * 0.5 + cap * 0.5), cap, H(i % 2 ? 0xffd24a : 0xffa62a), { align: "center", maxW: w - 18, weight: 800 });
  });
  // the dots
  c.fillStyle = "rgba(7,8,10,0.55)"; for (let yy = y; yy < h - 4; yy += 3) c.fillRect(4, yy, w - 8, 1); for (let xx = 4; xx < w - 4; xx += 3) c.fillRect(xx, y, 1, h - y - 4);
}

// ---------------------------------------------------------------------------------------------
// Walls indoors.

export interface WallO { base?: number; dado?: number; dadoH?: number; band?: number; seed?: number; block?: boolean; skirt?: number; grime?: number }
/** A painted blockwork (or plastered) wall: a gloss dado, a stripe, scuffs at trolley height, damp in the corners. */
export function roomWall(c: Ctx, w: number, h: number, o: WallO = {}) {
  const r = rng(o.seed ?? 5), base = hex(o.base ?? 0xcfc8b4), Y = (m: number) => Math.round(h - m * PX);
  rect(c, 0, 0, w, h, css(base));
  if (o.block ?? true) {
    for (let j = 0; j * 7 < h; j++) { rect(c, 0, j * 7, w, 1, css(shade(base, 0.86))); const off = j & 1 ? 7 : 0; for (let x = off; x < w; x += 14) rect(c, x, j * 7, 1, 7, css(shade(base, 0.88))); }
    for (let k = 0; k < (w * h) / 300; k++) { const bx = r.int(Math.ceil(w / 14)) * 14 + (r.int(2) ? 7 : 0), by = r.int(Math.ceil(h / 7)) * 7; rect(c, bx + 1, by + 1, 13, 6, css(shade(base, 0.94 + r() * 0.1), 0.6)); }
  }
  if (o.dado !== undefined) {
    const dh = o.dadoH ?? 1.2, d = hex(o.dado);
    rect(c, 0, Y(dh), w, h - Y(dh), css(d));
    if (o.block ?? true) for (let j = 0; Y(dh) + j * 7 < h; j++) { rect(c, 0, Y(dh) + j * 7, w, 1, css(shade(d, 0.8))); const off = j & 1 ? 7 : 0; for (let x = off; x < w; x += 14) rect(c, x, Y(dh) + j * 7, 1, 7, css(shade(d, 0.84))); }
    rect(c, 0, Y(dh) - 3, w, 3, H(o.band ?? 0xf4f1ea)); rect(c, 0, Y(dh), w, 1, css(shade(d, 1.35)));
    for (let k = 0; k < w / 9; k++) rect(c, r.int(w), Y(0.25 + r() * 0.7), 2 + r.int(9), 1, css(shade(d, r() < 0.5 ? 0.6 : 1.4), 0.6)); // scuffs
  }
  rect(c, 0, h - 4, w, 4, H(o.skirt ?? 0x2a2c30)); rect(c, 0, h - 4, w, 1, "rgba(255,255,255,0.18)");
  weather(c, 0, 0, w, h, r, 0.3, 0.22, Math.round(w / 60));
  const gk = o.grime ?? 0.4;
  for (const cx of [0, w]) { const g = c.createRadialGradient(cx, 0, 2, cx, 0, 70); g.addColorStop(0, `rgba(30,34,26,${gk})`); g.addColorStop(1, "rgba(30,34,26,0)"); c.fillStyle = g; c.fillRect(cx - 70, 0, 140, 70); }
  grain(c, 0, 0, w, h, 4, (o.seed ?? 5) + 1);
}
/** White glazed tiles with a coloured course, grubby grout. */
export function tiles(c: Ctx, x: number, y: number, w: number, h: number, seed: number, course = 0x1b2a6b, base = 0xd9dedf) {
  const r = rng(seed), b = hex(base);
  rect(c, x, y, w, h, css(shade(b, 0.66)));
  for (let j = 0; j * 5 < h; j++) for (let i = 0; i * 5 < w; i++) {
    const col = j === 6 ? hex(course) : shade(b, 0.92 + r() * 0.1);
    rect(c, x + i * 5, y + j * 5, Math.min(4, w - i * 5), Math.min(4, h - j * 5), css(col));
    if (r() < 0.12) rect(c, x + i * 5, y + j * 5, 2, 1, "rgba(255,255,255,0.7)");
    if (r() < 0.02) rect(c, x + i * 5, y + j * 5, 4, 4, css(shade(b, 0.7)));
  }
  const g = c.createLinearGradient(0, y + h - 30, 0, y + h); g.addColorStop(0, "rgba(60,70,40,0)"); g.addColorStop(1, "rgba(60,70,40,0.35)"); c.fillStyle = g; c.fillRect(x, y + h - 30, w, 30);
}
/** Dark timber panelling with a rail, for the pub and the hotel. */
export function panelling(c: Ctx, x: number, y: number, w: number, h: number, base = 0x5a3a26, seed = 3) {
  const r = rng(seed), b = hex(base);
  rect(c, x, y, w, h, css(b));
  for (let px = x + 2; px < x + w - 4; px += 24) { const pw = Math.min(21, x + w - 3 - px); bevel(c, px, y + 5, pw, h - 10, shade(b, 0.9), 0.62, 1.25); for (let k = 0; k < 5; k++) rect(c, px + 2 + r.int(Math.max(1, pw - 4)), y + 7, 1, h - 14, css(shade(b, 0.8), 0.5)); }
  rect(c, x, y, w, 3, css(shade(b, 1.3))); rect(c, x, y + 3, w, 1, css(shade(b, 0.5)));
}
/** Flock wallpaper, nicotine at the top. */
export function wallpaper(c: Ctx, x: number, y: number, w: number, h: number, base = 0x6a2a2e, seed = 4) {
  const b = hex(base), r = rng(seed);
  rect(c, x, y, w, h, css(b));
  for (let j = 0; j * 12 < h; j++) for (let i = 0; i * 12 < w + 12; i++) {
    const cx = x + i * 12 + (j & 1 ? 6 : 0), cy = y + j * 12 + 6, col = css(shade(b, 1.28));
    rect(c, cx - 1, cy - 4, 2, 8, col); rect(c, cx - 3, cy - 2, 6, 3, col); rect(c, cx, cy - 1, 1, 2, css(shade(b, 0.8)));
  }
  const g = c.createLinearGradient(0, y, 0, y + h * 0.5); g.addColorStop(0, "rgba(90,70,20,0.45)"); g.addColorStop(1, "rgba(90,70,20,0)"); c.fillStyle = g; c.fillRect(x, y, w, h * 0.5);
  for (let k = 0; k < w / 40; k++) { const sx = x + r.int(w); for (let i = 0; i < 10 + r.int(30); i++) rect(c, sx, y + i, 1, 1, "rgba(60,40,10,0.25)"); }
}

// ---------------------------------------------------------------------------------------------
// Small things that go on walls. All at 64 px/m unless noted: paint them into their own region.

/** A flat sign with a word or two on it. */
export function plate(c: Ctx, w: number, h: number, text: string, bg: number, fg: number, o: { sub?: string; border?: number; arrow?: "l" | "r" | "u"; font?: string } = {}) {
  rect(c, 0, 0, w, h, H(o.border ?? 0x15171a)); rect(c, 2, 2, w - 4, h - 4, H(bg));
  rect(c, 2, 2, w - 4, 1, "rgba(255,255,255,0.3)");
  let x0 = 4, x1 = w - 4;
  if (o.arrow) {
    const ax = o.arrow === "r" ? w - h / 2 - 2 : h / 2 + 2, ay = h / 2, s = Math.min(h * 0.3, 14);
    c.fillStyle = H(fg); c.beginPath();
    if (o.arrow === "l") { c.moveTo(ax - s, ay); c.lineTo(ax, ay - s); c.lineTo(ax, ay - s * 0.4); c.lineTo(ax + s, ay - s * 0.4); c.lineTo(ax + s, ay + s * 0.4); c.lineTo(ax, ay + s * 0.4); c.lineTo(ax, ay + s); }
    else if (o.arrow === "r") { c.moveTo(ax + s, ay); c.lineTo(ax, ay - s); c.lineTo(ax, ay - s * 0.4); c.lineTo(ax - s, ay - s * 0.4); c.lineTo(ax - s, ay + s * 0.4); c.lineTo(ax, ay + s * 0.4); c.lineTo(ax, ay + s); }
    else { c.moveTo(ax, ay - s); c.lineTo(ax + s, ay); c.lineTo(ax + s * 0.4, ay); c.lineTo(ax + s * 0.4, ay + s); c.lineTo(ax - s * 0.4, ay + s); c.lineTo(ax - s * 0.4, ay); c.lineTo(ax - s, ay); }
    c.closePath(); c.fill();
    if (o.arrow === "r") x1 = w - h - 2; else x0 = h + 2;
  }
  const cap = Math.round(h * (o.sub ? 0.36 : 0.5));
  pixText(c, text, (x0 + x1) / 2, Math.round(o.sub ? h * 0.5 : h / 2 + cap / 2), cap, H(fg), { align: "center", maxW: x1 - x0 - 4, font: o.font });
  if (o.sub) pixText(c, o.sub, (x0 + x1) / 2, h - 7, Math.max(6, Math.round(h * 0.17)), H(fg), { align: "center", maxW: x1 - x0 - 4, weight: 700 });
}
/** A price list. */
export function menuBoard(c: Ctx, w: number, h: number, title: string, rows: [string, string][], bg = 0x16181c, accent = 0xf2c94c) {
  rect(c, 0, 0, w, h, H(0x0c0d10)); rect(c, 3, 3, w - 6, h - 6, H(bg));
  rect(c, 3, 3, w - 6, 24, H(accent)); pixText(c, title, w / 2, 22, 14, H(bg), { align: "center", maxW: w - 16 });
  const lh = (h - 34) / rows.length;
  rows.forEach(([a, b], i) => {
    const y = Math.round(30 + i * lh + lh * 0.5), cap = Math.min(11, Math.round(lh * 0.5));
    pixText(c, a, 9, y + cap / 2, cap, "#f4f1ea", { maxW: w - 62, weight: 700 });
    pixText(c, b, w - 9, y + cap / 2, cap, H(accent), { align: "right", weight: 800 });
    rect(c, 8, Math.round(30 + (i + 1) * lh) - 1, w - 16, 1, "rgba(255,255,255,0.12)");
  });
}
/** The fat bald man the police would like a word with. Any size from about 40 x 56. */
export function wanted(c: Ctx, w: number, h: number, seed = 1) {
  const r = rng(seed);
  rect(c, 0, 0, w, h, H(0xe9e2cc)); rect(c, 0, 0, w, 1, "#fff"); rect(c, w - 1, 0, 1, h, H(0xb8b09a)); rect(c, 0, h - 1, w, 1, H(0xb8b09a));
  const cap = Math.max(5, Math.round(h * 0.13));
  pixText(c, "WANTED", w / 2, cap + 3, cap, H(0xb01020), { align: "center", maxW: w - 4 });
  // the mugshot: height lines, a round head with no hair on it, a white shirt
  const mx = Math.round(w * 0.14), my = cap + 6, mw = w - mx * 2, mh = Math.round(h * 0.5);
  rect(c, mx, my, mw, mh, H(0x9aa3a8)); for (let y = my + 3; y < my + mh; y += 5) rect(c, mx, y, mw, 1, "rgba(40,48,54,0.35)");
  const cx = w / 2, hw = Math.round(mw * 0.34), hy = my + Math.round(mh * 0.16), hh = Math.round(mh * 0.52);
  rect(c, cx - hw - 3, my + mh - Math.round(mh * 0.3), hw * 2 + 6, Math.round(mh * 0.3), H(0xf1f1ee)); // shoulders
  rect(c, cx - 2, my + mh - Math.round(mh * 0.3), 4, Math.round(mh * 0.3), H(0xc8102e));
  rect(c, cx - hw, hy, hw * 2, hh, H(0xdba585)); rect(c, cx - hw + 1, hy - 2, hw * 2 - 2, 3, H(0xe5b596)); rect(c, cx - hw - 2, hy + Math.round(hh * 0.4), 2, Math.round(hh * 0.25), H(0xc98f70)); rect(c, cx + hw, hy + Math.round(hh * 0.4), 2, Math.round(hh * 0.25), H(0xc98f70));
  rect(c, cx - hw + 1, hy, hw, 2, "rgba(255,240,225,0.6)"); // the shine
  const ey = hy + Math.round(hh * 0.45);
  rect(c, cx - Math.round(hw * 0.6), ey - 2, Math.max(2, Math.round(hw * 0.4)), 1, H(0x3a2418)); rect(c, cx + Math.round(hw * 0.2), ey - 2, Math.max(2, Math.round(hw * 0.4)), 1, H(0x3a2418)); // brows, down
  rect(c, cx - Math.round(hw * 0.5), ey, 2, 2, H(0x1a1410)); rect(c, cx + Math.round(hw * 0.35), ey, 2, 2, H(0x1a1410));
  rect(c, cx - Math.round(hw * 0.45), hy + Math.round(hh * 0.78), Math.round(hw * 0.9), 1, H(0x7a3a2a));
  rect(c, cx - hw, hy + hh - 2, hw * 2, 2, H(0xc08a6c)); // chins
  const ty = my + mh + 3, tc = Math.max(4, Math.round(h * 0.07));
  if (h >= 80) { pixText(c, "\"GROZZ\"", w / 2, ty + tc + 1, tc, H(0x15171a), { align: "center", maxW: w - 6 }); pixText(c, "DO NOT SERVE", w / 2, ty + tc * 2 + 5, Math.max(4, tc - 1), H(0x15171a), { align: "center", maxW: w - 6, weight: 700 }); pixText(c, "DO NOT APPROACH", w / 2, ty + tc * 3 + 8, Math.max(4, tc - 1), H(0xb01020), { align: "center", maxW: w - 6, weight: 700 }); }
  else { tiny(c, "GROZZ", w / 2, ty, H(0x15171a), 1, "center"); for (let k = 0; k < 2; k++) rect(c, 4, ty + 8 + k * 3, w - 8 - r.int(8), 1, "rgba(20,22,26,0.6)"); }
  rect(c, w / 2 - 2, 1, 4, 3, H(0xc9c2aa)); // tape
}
/** Other things people stick up. `kind` picks one. */
export function poster(c: Ctx, w: number, h: number, kind: number) {
  const K = ((kind % 8) + 8) % 8, cap = Math.max(5, Math.round(h * 0.12));
  const two = (bg: number, fg: number, a: string, b: string, d?: string) => {
    rect(c, 0, 0, w, h, H(bg)); rect(c, 0, 0, w, 1, "rgba(255,255,255,0.4)");
    pixText(c, a, w / 2, Math.round(h * 0.3), cap, H(fg), { align: "center", maxW: w - 4 });
    pixText(c, b, w / 2, Math.round(h * 0.3) + cap + 4, cap, H(fg), { align: "center", maxW: w - 4 });
    if (d) pixText(c, d, w / 2, h - 5, Math.max(4, cap - 3), H(fg), { align: "center", maxW: w - 4, weight: 700 });
  };
  if (K === 0) { two(0xf2c81e, 0x141414, "MISSING", "CAT", "ANSWERS TO NOTHING"); rect(c, w / 2 - 6, Math.round(h * 0.55), 12, 9, H(0x3a3028)); rect(c, w / 2 - 6, Math.round(h * 0.55) - 3, 3, 3, H(0x3a3028)); rect(c, w / 2 + 3, Math.round(h * 0.55) - 3, 3, 3, H(0x3a3028)); rect(c, w / 2 - 3, Math.round(h * 0.55) + 3, 2, 2, H(0xd8e060)); rect(c, w / 2 + 2, Math.round(h * 0.55) + 3, 2, 2, H(0xd8e060)); }
  else if (K === 1) two(0xb01030, 0xffffff, "TRIBUTE", "NIGHT", "NEARLY QUEEN · FRI");
  else if (K === 2) two(0xf4f1ea, 0x1b2a6b, "CAR BOOT", "SUNDAY", "BRING A CAR");
  else if (K === 3) two(0x141414, 0xf2e85a, "PSYCHIC", "SUE", "SHE KNEW YOU'D LOOK");
  else if (K === 4) two(0x2f6ab0, 0xffffff, "MAN WITH", "VAN", "NO JOB TOO DODGY");
  else if (K === 5) two(0xe8e0cc, 0xb01020, "BILL", "POSTERS", "WILL BE PROSECUTED");
  else if (K === 6) two(0x3a7a4a, 0xffffff, "LOSE WEIGHT", "FAST", "ASK ME HOW (DON'T)");
  else two(0xd8322a, 0xf2e85a, "CLOSING", "DOWN", "EVERYTHING MUST GO · SINCE 2009");
}
/** A cork noticeboard with things pinned to it. 32 px/m. */
export function noticeboard(c: Ctx, w: number, h: number, seed: number, title?: string) {
  const r = rng(seed);
  rect(c, 0, 0, w, h, H(0x5a4630)); rect(c, 2, 2, w - 4, h - 4, H(0xb08a5a));
  for (let k = 0; k < (w * h) / 12; k++) rect(c, 2 + r.int(w - 4), 2 + r.int(h - 4), 1, 1, H(r.pick([0xa07a4c, 0xc09a68, 0x94703f])));
  if (title) { rect(c, 2, 2, w - 4, 7, H(0x1b2a6b)); tiny(c, title, w / 2, 3, "#f4f4f4", 1, "center"); }
  for (let k = 0; k < Math.max(3, (w * h) / 420); k++) {
    const pw = 7 + r.int(8), ph = 8 + r.int(9), px = 3 + r.int(Math.max(1, w - pw - 6)), py = (title ? 11 : 3) + r.int(Math.max(1, h - ph - (title ? 14 : 6)));
    rect(c, px, py, pw, ph, H(r.pick([0xf4f1ea, 0xf4f1ea, 0xf2e85a, 0xf7b8c0, 0xbfe0f0]))); for (let l = 2; l < ph - 1; l += 2) rect(c, px + 1, py + l, pw - 2 - r.int(3), 1, "rgba(30,34,40,0.5)");
    rect(c, px + pw / 2, py, 1, 1, H(r.pick([0xd8322a, 0x2f6ab0, 0xf2c81e])));
  }
}
export function clock(c: Ctx, w: number, h: number) {
  c.clearRect(0, 0, w, h); const r = Math.min(w, h) / 2;
  c.fillStyle = H(0x15171a); c.beginPath(); c.arc(w / 2, h / 2, r, 0, 7); c.fill(); c.fillStyle = H(0xf4f1ea); c.beginPath(); c.arc(w / 2, h / 2, r - 2, 0, 7); c.fill();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; rect(c, w / 2 + Math.cos(a) * (r - 4) - 0.5, h / 2 + Math.sin(a) * (r - 4) - 0.5, 1, 1, H(0x15171a)); }
  c.strokeStyle = H(0x15171a); c.lineWidth = 1.5; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + r * 0.35, h / 2 - r * 0.4); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - r * 0.1, h / 2 - r * 0.7); c.stroke();
}
/** A wall telly: the match, or the racing, or the snooker. */
export function telly(c: Ctx, w: number, h: number, kind = 0) {
  rect(c, 0, 0, w, h, H(0x121316)); const x = 2, y = 2, sw = w - 4, sh = h - 5;
  if (kind === 0) { rect(c, x, y, sw, sh, H(0x3f8f4a)); for (let i = 0; i < sw; i += 6) rect(c, x + i, y, 3, sh, H(0x378442)); rect(c, x + sw / 2, y, 1, sh, "#e8f0e8"); c.strokeStyle = "#e8f0e8"; c.lineWidth = 1; c.beginPath(); c.arc(x + sw / 2, y + sh / 2, sh * 0.22, 0, 7); c.stroke(); for (const [px, py, col] of [[0.3, 0.4, 0xf4f4f4], [0.42, 0.62, 0xc8102e], [0.6, 0.35, 0xf4f4f4], [0.7, 0.6, 0xc8102e], [0.55, 0.5, 0xffffff]] as [number, number, number][]) rect(c, x + sw * px, y + sh * py, 2, 3, H(col)); rect(c, x + 2, y + 2, 16, 5, H(0x15171a)); tiny(c, "0-0", x + 4, y + 2, "#f2c94c"); }
  else if (kind === 1) { rect(c, x, y, sw, sh, H(0x2a6a3a)); rect(c, x, y, sw, sh * 0.35, H(0x8fb0c8)); rect(c, x, y + sh * 0.35, sw, 2, "#f4f4f4"); for (let k = 0; k < 4; k++) { rect(c, x + 5 + k * 9, y + sh * 0.5 + (k % 2) * 3, 6, 3, H([0x5a3a22, 0x2a2018, 0x8a6a48, 0x3a2a1c][k])); rect(c, x + 7 + k * 9, y + sh * 0.5 + (k % 2) * 3 - 3, 2, 3, H([0xd8322a, 0xf2c81e, 0x2f6ab0, 0xf4f4f4][k])); } rect(c, x, y + sh - 6, sw, 6, H(0x15171a)); tiny(c, "3.40 KEMPTON", x + 2, y + sh - 5, "#f2c94c"); }
  else { rect(c, x, y, sw, sh, H(0x1c2440)); rect(c, x, y + sh * 0.3, sw, sh * 0.5, H(0xf2c94c)); pixText(c, "BREAKING", x + sw / 2, y + sh * 0.3 + sh * 0.36, Math.round(sh * 0.26), H(0x15171a), { align: "center", maxW: sw - 4 }); rect(c, x, y + sh - 6, sw, 6, H(0xb01020)); tiny(c, "FAT MAN AT LARGE", x + 2, y + sh - 5, "#fff"); }
  rect(c, x, y, sw, 1, "rgba(255,255,255,0.35)"); rect(c, w / 2 - 2, h - 2, 4, 1, H(0xd8322a));
}
/** A crest: three lions on a shield. */
export function crest(c: Ctx, w: number, h: number, bg = 0xf4f4f4) {
  c.fillStyle = H(0x15171a); c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.55); c.quadraticCurveTo(w, h * 0.9, w / 2, h); c.quadraticCurveTo(0, h * 0.9, 0, h * 0.55); c.closePath(); c.fill();
  c.fillStyle = H(bg); c.beginPath(); c.moveTo(2, 2); c.lineTo(w - 2, 2); c.lineTo(w - 2, h * 0.55); c.quadraticCurveTo(w - 2, h * 0.88, w / 2, h - 3); c.quadraticCurveTo(2, h * 0.88, 2, h * 0.55); c.closePath(); c.fill();
  const s = Math.max(1, Math.floor((w - 8) / 17));
  for (let k = 0; k < 3; k++) lion(c, Math.round(w / 2 - 8.5 * s), Math.round(h * 0.12 + k * h * 0.24), H(0x1b2a6b), s);
}
/** A steel locker door (or a row of them), 32 px/m: w is one door's width. */
export function lockers(c: Ctx, w: number, h: number, n: number, col: number, seed: number) {
  const r = rng(seed), b = hex(col), dw = w / n;
  rect(c, 0, 0, w, h, css(shade(b, 0.5)));
  for (let i = 0; i < n; i++) {
    const x = Math.round(i * dw) + 1, ww = Math.round(dw) - 2, k = shade(b, 0.9 + r() * 0.2);
    bevel(c, x, 2, ww, h - 5, k, 1.3, 0.62);
    for (let v = 0; v < 3; v++) rect(c, x + 3, 6 + v * 3, ww - 6, 1, css(shade(k, 0.5))); // vents
    rect(c, x + ww - 4, Math.round(h * 0.5), 2, 5, H(0xd0d4d8)); rect(c, x + 3, Math.round(h * 0.3), ww - 8, 6, H(0xf1efe6)); tiny(c, String(1 + ((i * 3 + seed) % 23)), x + 4, Math.round(h * 0.3) + 1, H(0x20242a));
    if (r() < 0.4) rect(c, x + 3 + r.int(Math.max(1, ww - 10)), Math.round(h * 0.55) + r.int(12), 5, 5, H(r.pick([0xd8322a, 0xf2c81e, 0x2f6ab0, 0xf4f4f4]))); // a sticker
    if (r() < 0.25) for (let d = 0; d < 6; d++) rect(c, x + 2 + r.int(ww - 4), h - 6 - r.int(20), 1, 2, "rgba(110,70,40,0.5)"); // rust
  }
  rect(c, 0, h - 3, w, 3, H(0x15171a));
}
/** A shirt on a hanger, see-through round it. */
export function hungShirt(c: Ctx, w: number, h: number, col: number, trim: number, num: string) {
  c.clearRect(0, 0, w, h); const b = hex(col), cx = Math.round(w / 2);
  rect(c, cx - 1, 0, 2, 4, H(0x8f959c)); rect(c, cx - 5, 3, 10, 1, H(0x8f959c));
  rect(c, 3, 5, w - 6, h - 6, css(b)); rect(c, 0, 5, 4, Math.round(h * 0.34), css(shade(b, 0.9))); rect(c, w - 4, 5, 4, Math.round(h * 0.34), css(shade(b, 0.82)));
  rect(c, 0, 5 + Math.round(h * 0.34) - 2, 4, 2, H(trim)); rect(c, w - 4, 5 + Math.round(h * 0.34) - 2, 4, 2, H(trim));
  rect(c, cx - 3, 5, 6, 2, H(trim)); rect(c, 3, 5, 1, h - 6, css(shade(b, 1.15))); rect(c, w - 4, 5, 1, h - 6, css(shade(b, 0.7))); rect(c, 3, h - 2, w - 6, 1, css(shade(b, 0.7)));
  tiny(c, num, cx, 5 + Math.round((h - 6) * 0.35), H(trim), num.length > 1 || w < 20 ? 1 : 2, "center");
}
/** Coats, a hi-vis and an umbrella on hooks. */
export function coatHooks(c: Ctx, w: number, h: number, seed: number, cols = [0x23252b, 0xd8e020, 0x2a3a5a, 0x15171a, 0x6a4a2a]) {
  c.clearRect(0, 0, w, h); const r = rng(seed);
  rect(c, 0, 2, w, 3, H(0x6a4a2a)); rect(c, 0, 2, w, 1, H(0x8a6a48));
  for (let x = 5; x < w - 8; x += 13) {
    rect(c, x + 3, 4, 2, 3, H(0xb8bcc0));
    if (r() < 0.2) continue;
    const col = hex(r.pick(cols)), len = Math.round(h * (0.55 + r() * 0.35));
    rect(c, x, 7, 9, len, css(col)); rect(c, x - 1, 9, 2, Math.round(len * 0.5), css(shade(col, 0.85))); rect(c, x + 8, 9, 2, Math.round(len * 0.5), css(shade(col, 0.7))); rect(c, x, 7, 9, 1, css(shade(col, 1.3)));
    if (col[0] > 200 && col[1] > 200) { rect(c, x, 7 + Math.round(len * 0.45), 9, 2, H(0xc8ccd0)); rect(c, x, 7 + Math.round(len * 0.7), 9, 2, H(0xc8ccd0)); }
  }
}
export function mirror(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0x8a6a48)); rect(c, 2, 2, w - 4, h - 4, H(0x9db4c4));
  c.fillStyle = "rgba(230,240,246,0.55)"; c.beginPath(); c.moveTo(2, h * 0.7); c.lineTo(w * 0.6, 2); c.lineTo(w * 0.8, 2); c.lineTo(2, h - 2); c.closePath(); c.fill();
  rect(c, 3, h - 6, 3, 2, "rgba(60,70,60,0.5)");
}
/** A fire extinguisher and its sign (transparent round it), a first-aid box, a radiator, a socket: wall clutter. */
export function clutter(c: Ctx, w: number, h: number, kind: "ext" | "aid" | "rad" | "hose" | "alarm" | "vend") {
  c.clearRect(0, 0, w, h);
  if (kind === "ext") { rect(c, w / 2 - 5, 0, 10, 8, H(0x1f7a3a)); tiny(c, "!", w / 2 - 1, 1, "#fff"); rect(c, w / 2 - 4, 12, 8, h - 13, H(0xc8281e)); rect(c, w / 2 - 4, 12, 2, h - 13, H(0xe85a4a)); rect(c, w / 2 - 2, 9, 4, 3, H(0x15171a)); rect(c, w / 2 + 2, 10, 4, 1, H(0x15171a)); rect(c, w / 2 - 3, 18, 6, 5, H(0xf1efe6)); }
  else if (kind === "aid") { bevel(c, 0, 0, w, h, hex(0x1f7a3a)); rect(c, w / 2 - 1, 3, 3, h - 6, "#fff"); rect(c, 3, h / 2 - 1, w - 6, 3, "#fff"); }
  else if (kind === "rad") { for (let x = 0; x < w - 2; x += 4) { rect(c, x, 2, 3, h - 4, H(0xd8d4c8)); rect(c, x, 2, 1, h - 4, H(0xf4f1ea)); rect(c, x + 2, 2, 1, h - 4, H(0x9a968a)); } rect(c, 0, 0, w, 2, H(0xe6e2d6)); rect(c, w - 2, 4, 2, 4, H(0x8f959c)); for (let k = 0; k < 6; k++) rect(c, (k * 11) % w, h - 3 - (k % 3), 2, 2, "rgba(120,80,40,0.6)"); }
  else if (kind === "hose") { bevel(c, 0, 0, w, h, hex(0xc8281e)); c.strokeStyle = H(0x8a1a14); c.lineWidth = 2; for (const rr of [h * 0.36, h * 0.24, h * 0.12]) { c.beginPath(); c.arc(w / 2, h / 2, rr, 0, 7); c.stroke(); } rect(c, w / 2 - 2, h / 2 - 2, 4, 4, H(0xd0d4d8)); }
  else if (kind === "alarm") { bevel(c, 0, 0, w, h, hex(0xc8281e)); rect(c, 2, 2, w - 4, h - 4, H(0xf1efe6)); rect(c, w / 2 - 1, h / 2 - 1, 3, 3, H(0x15171a)); }
  else { bevel(c, 0, 0, w, h, hex(0x23252b)); rect(c, 3, 3, w - 6, Math.round(h * 0.55), H(0x9db4c4)); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) rect(c, 5 + i * Math.floor((w - 10) / 3), 6 + j * Math.floor(h * 0.17), Math.floor((w - 14) / 3), Math.floor(h * 0.12), H([0xd8322a, 0xf2c81e, 0x2f6ab0, 0x3a7a4a, 0xe2661c][(i + j * 2) % 5])); rect(c, 3, h - Math.round(h * 0.2), w - 6, Math.round(h * 0.1), H(0x0c0d10)); rect(c, w - 9, Math.round(h * 0.64), 5, 7, H(0xf1efe6)); tiny(c, "50P", 4, Math.round(h * 0.66), H(0xf2c94c)); }
}

// ---------------------------------------------------------------------------------------------
// Furniture tops and fronts.

export function barTop(c: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed), b = hex(0x5a3418);
  rect(c, 0, 0, w, h, css(b));
  for (let y = 0; y < h; y += 3) rect(c, 0, y, w, 1, css(shade(b, 0.86 + r() * 0.2)));
  rect(c, 0, 0, w, 2, H(0xb8923a)); rect(c, 0, h - 2, w, 2, H(0xb8923a));
  for (let x = 20; x < w - 20; x += 60 + r.int(40)) { // a bar towel, a ring or three, an ashtray nobody is supposed to use
    rect(c, x, 4, 26, h - 8, H(r.pick([0x1f5a3d, 0xb01030, 0x1b2a6b]))); rect(c, x + 2, 6, 22, 1, "rgba(255,255,255,0.5)"); rect(c, x + 2, h - 7, 22, 1, "rgba(255,255,255,0.5)");
    c.strokeStyle = "rgba(20,10,4,0.4)"; c.lineWidth = 1; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + 36 + r.int(18), 6 + r.int(Math.max(1, h - 12)), 3, 0, 7); c.stroke(); }
  }
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,230,180,0.18)"); g.addColorStop(1, "rgba(0,0,0,0.12)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
}
export function barFront(c: Ctx, w: number, h: number, seed: number) {
  panelling(c, 0, 0, w, h, 0x5a3a26, seed);
  rect(c, 0, h - 8, w, 3, H(0xb8923a)); rect(c, 0, h - 8, w, 1, H(0xe9cf7a)); // the foot rail
  const g = c.createLinearGradient(0, h - 14, 0, h); g.addColorStop(0, "rgba(10,8,6,0)"); g.addColorStop(1, "rgba(10,8,6,0.5)"); c.fillStyle = g; c.fillRect(0, h - 14, w, 14);
}
/** Shelves seen from the front, loaded: bottles, boxes, whatever `kind` says. 32 px/m. */
export function shelves(c: Ctx, w: number, h: number, seed: number, kind: "bottles" | "pawn" | "files" | "kit" | "tins" | "glasses") {
  const r = rng(seed), wood = kind === "files" || kind === "tins" ? hex(0x6f757c) : hex(0x4a3020);
  rect(c, 0, 0, w, h, css(shade(wood, 0.45)));
  const rows = Math.max(2, Math.round(h / 22)), rh = h / rows;
  for (let j = 0; j < rows; j++) {
    const y1 = Math.round((j + 1) * rh) - 2;
    rect(c, 0, y1, w, 2, css(wood)); rect(c, 0, y1, w, 1, css(shade(wood, 1.3)));
    for (let x = 2; x < w - 3;) {
      let iw = 3, ih = 8;
      if (kind === "bottles") { iw = 3; ih = 8 + r.int(6); const col = r.pick([0x3f6b3a, 0x8a3a22, 0x2f4f7a, 0x6a4a1c, 0xd8c070, 0x7a2a2a, 0xe8e8e0]); rect(c, x, y1 - ih, iw, ih, H(col)); rect(c, x + 1, y1 - ih - 2, 1, 2, H(col)); rect(c, x, y1 - ih + 3, iw, 3, "rgba(240,236,220,0.75)"); rect(c, x, y1 - ih, 1, ih, "rgba(255,255,255,0.3)"); }
      else if (kind === "glasses") { iw = 3; ih = 5; rect(c, x, y1 - ih, iw, ih, "rgba(200,220,230,0.55)"); rect(c, x, y1 - ih, 1, ih, "rgba(255,255,255,0.7)"); }
      else if (kind === "files") { iw = 3 + r.int(3); ih = Math.round(rh * 0.7); const col = r.pick([0x23252b, 0x2f6ab0, 0xb01030, 0x3a7a4a, 0x6a4a2a, 0xd8d4c8]); rect(c, x, y1 - ih, iw, ih, H(col)); rect(c, x + 1, y1 - ih + 3, iw - 2, 4, "#f1efe6"); }
      else if (kind === "tins") { iw = 5 + r.int(4); ih = 6 + r.int(5); const col = r.pick([0x4a5a3a, 0x5a4a2a, 0x3a4a5a, 0x8a8a80]); rect(c, x, y1 - ih, iw, ih, H(col)); rect(c, x, y1 - ih, iw, 1, "rgba(255,255,255,0.3)"); rect(c, x + 1, y1 - ih + 2, iw - 2, 2, "rgba(240,230,160,0.7)"); }
      else if (kind === "kit") { iw = 9 + r.int(4); ih = 4 + r.int(Math.round(rh * 0.4)); const col = r.pick([0xf4f4f4, 0xc8102e, 0x1b2a6b, 0xf4f4f4, 0xd8e020]); for (let k = 0; k < ih; k += 3) { rect(c, x, y1 - k - 3, iw, 3, H(col)); rect(c, x, y1 - k - 1, iw, 1, "rgba(0,0,0,0.25)"); } }
      else { // everything somebody once loved
        const q = r();
        if (q < 0.25) { iw = 11 + r.int(6); ih = 8 + r.int(4); rect(c, x, y1 - ih, iw, ih, H(0x16181c)); rect(c, x + 1, y1 - ih + 1, iw - 2, ih - 3, H(r.pick([0x4a8ad0, 0x5aaa62, 0xb8c4d8, 0x2a2c34]))); rect(c, x + 2, y1 - ih + 2, iw - 6, 1, "rgba(255,255,255,0.5)"); }
        else if (q < 0.45) { iw = 6; ih = Math.min(Math.round(rh) - 4, 17); rect(c, x + 2, y1 - ih, 2, ih - 6, H(0x5a3a22)); rect(c, x, y1 - 7, 6, 7, H(r.pick([0xc8502a, 0x2a5a9a, 0xe0b040, 0x15171a]))); rect(c, x + 2, y1 - 5, 2, 2, H(0x1a1410)); }
        else if (q < 0.7) { iw = 6 + r.int(4); ih = 5 + r.int(6); const col = r.pick([0xe0b020, 0xc8382a, 0x3a7a4a, 0xd8d8d8, 0x2a2a30, 0x2f6ab0]); rect(c, x, y1 - ih, iw, ih, H(col)); rect(c, x, y1 - ih, iw, 1, "rgba(255,255,255,0.35)"); }
        else { iw = 8 + r.int(5); ih = 3; rect(c, x, y1 - ih, iw, ih, H(0x23335c)); for (let k = 0; k < iw; k += 2) rect(c, x + k, y1 - ih - 1, 1, 1, H(r.pick([0xf1d264, 0xe9eef2, 0xd24a4a]))); }
        if (r() < 0.5) { rect(c, x, y1 + 0, 6, 1, "#f1efe6"); }
      }
      x += iw + 1 + (r() < 0.15 ? 3 + r.int(6) : 0);
    }
    const g = c.createLinearGradient(0, Math.round(j * rh), 0, Math.round(j * rh) + 6); g.addColorStop(0, "rgba(0,0,0,0.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, Math.round(j * rh), w, 6);
  }
  rect(c, 0, 0, 2, h, css(wood)); rect(c, w - 2, 0, 2, h, css(shade(wood, 0.7)));
}
/** A counter front or a desk front: panels, a kick plate. */
export function counterFront(c: Ctx, w: number, h: number, col: number, seed: number, label?: string) {
  const b = hex(col), r = rng(seed);
  rect(c, 0, 0, w, h, css(b)); rect(c, 0, 0, w, 3, css(shade(b, 1.4))); rect(c, 0, 3, w, 1, css(shade(b, 0.5)));
  for (let x = 3; x < w - 8; x += 30) bevel(c, x, 7, Math.min(27, w - 4 - x), h - 14, shade(b, 0.9), 0.6, 1.25);
  rect(c, 0, h - 5, w, 5, css(shade(b, 0.45)));
  if (label) { const lw = Math.min(w - 10, label.length * 4 + 6); rect(c, Math.round(w / 2 - lw / 2), 9, lw, 9, "#f1efe6"); tiny(c, label, w / 2, 11, H(0x15171a), 1, "center"); }
  for (let k = 0; k < w / 12; k++) rect(c, r.int(w), h - 6 - r.int(8), 2 + r.int(5), 1, css(shade(b, 0.55), 0.7));
}
/** A grille: bars with holes between (see-through), and a pay slot. */
export function grille(c: Ctx, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x += 6) { rect(c, x, 0, 2, h, H(0x8f959c)); rect(c, x, 0, 1, h, H(0xc9cdd2)); }
  for (let y = 0; y < h; y += 14) { rect(c, 0, y, w, 2, H(0x6f757c)); rect(c, 0, y, w, 1, H(0xb9bec4)); }
  rect(c, 0, 0, w, 3, H(0x3a3d44)); rect(c, 0, h - 3, w, 3, H(0x3a3d44));
}
export function carpetTile(c: Ctx, w: number, h: number, a: number, b: number, seed: number) {
  const r = rng(seed), A = hex(a), B = hex(b);
  rect(c, 0, 0, w, h, css(A));
  for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const ox = x + (((y / 16) & 1) ? 8 : 0); c.fillStyle = css(B); c.beginPath(); c.moveTo(ox + 8, y + 1); c.lineTo(ox + 15, y + 8); c.lineTo(ox + 8, y + 15); c.lineTo(ox + 1, y + 8); c.closePath(); c.fill(); rect(c, ox + 7, y + 7, 2, 2, css(shade(A, 1.5))); }
  for (let k = 0; k < (w * h) / 300; k++) { c.fillStyle = "rgba(20,12,10,0.25)"; c.beginPath(); c.ellipse(r.int(w), r.int(h), 3 + r.int(9), 2 + r.int(5), r(), 0, 7); c.fill(); }
}
/** A steel door with a kick plate and a sign. 32 px/m. */
export function door(c: Ctx, w: number, h: number, col: number, label?: string, glass = false) {
  const b = hex(col);
  rect(c, 0, 0, w, h, H(0x2a2c30)); bevel(c, 2, 2, w - 4, h - 2, b, 1.3, 0.65);
  if (glass) { rect(c, Math.round(w * 0.25), 8, Math.round(w * 0.5), Math.round(h * 0.3), H(0x27313d)); rect(c, Math.round(w * 0.25), 8, Math.round(w * 0.5), 1, "rgba(200,214,226,0.6)"); }
  rect(c, 4, h - 10, w - 8, 8, H(0x8f959c)); rect(c, 4, h - 10, w - 8, 1, H(0xc9cdd2)); rect(c, w - 8, Math.round(h * 0.52), 3, 5, H(0xd0d4d8));
  if (label) { const lw = Math.min(w - 6, label.length * 4 + 4); rect(c, Math.round(w / 2 - lw / 2), Math.round(h * 0.42), lw, 8, "#f1efe6"); tiny(c, label, w / 2, Math.round(h * 0.42) + 1, H(0x15171a), 1, "center"); }
}
/** Brick with a painted-over patch, a drainpipe's stain, a bricked-up window: for the long blank sides of things. */
export function sideWall(c: Ctx, w: number, h: number, pal = BRICK_RED, seed = 9, o: { ghost?: string; vent?: boolean; blind?: boolean; door?: boolean } = {}) {
  const r = rng(seed), Y = (m: number) => Math.round(h - m * PX), X = (m: number) => Math.round(m * PX);
  brick(c, 0, 0, w, h, pal, r);
  if (o.blind) { const bx = X(1.2 + r() * 1.5), by = Y(2.6); rect(c, bx - 2, by - 5, 38, 5, H(0xc9c0a6)); brick(c, bx, by, 34, 44, { tones: pal.tones.map((t) => shade(t, 0.8)), mortar: pal.mortar }, r); rect(c, bx - 3, by + 44, 40, 3, H(0xcfc6ac)); }
  if (o.ghost) { const gw = Math.min(w - 20, X(3.4)), gx = Math.round(w * 0.5 - gw / 2), gy = Math.max(6, Y(3.3)); rect(c, gx, gy, gw, 34, "rgba(214,204,176,0.5)"); pixText(c, o.ghost, gx + gw / 2, gy + 24, 14, "rgba(46,34,30,0.7)", { font: FONTS.serif, weight: 700, align: "center", maxW: gw - 8 }); for (let k = 0; k < 220; k++) rect(c, gx + r.int(gw), gy + r.int(34), 1 + r.int(3), 1, css(r.pick(pal.tones), 0.9)); }
  if (o.vent) { const vx = X(0.8 + r() * 2); bevel(c, vx, Y(2.4), 12, 9, hex(0x8f959c)); for (let k = 0; k < 3; k++) rect(c, vx + 2, Y(2.4) + 2 + k * 2, 8, 1, H(0x4a4f56)); for (let k = 0; k < 20; k++) rect(c, vx + 4 + (k % 3), Y(2.4) + 9 + k, 2, 1, "rgba(20,18,16,0.25)"); }
  if (o.door) { const dx = Math.round(w * 0.62); rect(c, dx - 2, Y(2.1) - 4, X(1.0) + 4, 4, H(0xb9b09a)); c.save(); c.translate(dx, Y(2.1)); door(c, X(1.0), Y(0) - Y(2.1), 0x3a4a3a, "STAFF"); c.restore(); }
  // a patch of render where something used to be, graffiti painted out in the wrong colour, a tag
  rect(c, X(0.3), Y(1.5), 46, 30, css(shade(r.pick(pal.tones), 0.75), 0.75));
  c.strokeStyle = "rgba(230,230,235,0.5)"; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.72, h - 16); c.bezierCurveTo(w * 0.76, h - 40, w * 0.8, h - 8, w * 0.84, h - 30); c.bezierCurveTo(w * 0.88, h - 44, w * 0.9, h - 14, w * 0.96, h - 26); c.stroke();
  weather(c, 0, 0, w, h, r, 0.34, 0.5, Math.round(w / 30));
  for (let k = 0; k < w / 10; k++) { const px = r.int(w), py = h - 1 - r.int(9); rect(c, px, py, 2 + r.int(3), 1, H(r.pick([0x56683a, 0x48582f]))); }
  grain(c, 0, 0, w, h, 5, seed);
}
export const SERIF = FONTS.serif;
export type { RGB };

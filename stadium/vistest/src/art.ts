// Painted faces: facades, shopfronts, signs, props. All sizes in px at 32 px/m unless a density is given.
import { BRICK_DARK, BRICK_RED, BRICK_STOCK, BRICK_WALL, FONTS, H, bevel, brick, css, grain, hex, mix, pixText, rect, rng, shade, slate, tiny, weather, type BrickPal, type Ctx, type RGB } from "./paint";

const PX = 32;
export const GREEN = 0x1f5a3d, GREEN_D = 0x143a29, GOLD = 0xe2b64a, CREAM = 0xd9d0b8, WARM = 0xffc86a;

/** A lit window: amber, hotter in the middle, with whatever is going on inside in silhouette. */
export function litGlass(c: Ctx, x: number, y: number, w: number, h: number, seed: number, o: { cool?: boolean; frost?: number; bar?: boolean; telly?: boolean; heads?: number } = {}) {
  const r = rng(seed);
  const a: RGB = o.cool ? hex(0xdfe9e2) : hex(0xffd98a), b: RGB = o.cool ? hex(0x9db4b0) : hex(0xe8943a);
  const g = c.createRadialGradient(x + w * 0.5, y + h * 0.45, 1, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, css(a)); g.addColorStop(1, css(b));
  c.fillStyle = g; c.fillRect(x, y, w, h);
  if (o.bar) { // back-bar shelves and bottles
    for (let s = 0; s < 2; s++) {
      const sy = y + 4 + s * 7;
      rect(c, x + 2, sy + 5, w - 4, 1, H(0x7a4320));
      for (let k = x + 3; k < x + w - 3; k += 2) if (r() < 0.7) rect(c, k, sy + 5 - 2 - r.int(3), 1, 2 + r.int(3), H(r.pick([0x3f6b3a, 0x8a3a22, 0x2f4f7a, 0x6a4a1c, 0xd8c070, 0x7a2a2a])));
    }
  }
  if (o.telly) { const tx = x + w - 13, ty = y + 3; rect(c, tx - 1, ty - 1, 12, 8, H(0x1a1a1e)); rect(c, tx, ty, 10, 6, H(0x4f9a4a)); rect(c, tx, ty + 2, 10, 1, H(0x6fb86a)); rect(c, tx + 4, ty, 1, 6, H(0xdfeedd)); rect(c, tx + 6, ty + 3, 1, 1, H(0xffffff)); }
  for (let k = 0; k < (o.heads ?? 0); k++) { // punters
    const hx = x + 3 + r.int(Math.max(1, w - 10)), hy = y + h * (0.42 + r() * 0.12), col = r.pick([0x4a2a1a, 0x3a2418, 0x5a3320]);
    rect(c, hx + 1, hy, 3, 3, H(col)); rect(c, hx, hy + 3, 5, h, H(col));
    if (r() < 0.6) rect(c, hx + 5, hy + 3, 1, 3, H(0xf7e7a0)); // a pint, held high
  }
  if (o.frost) { // etched lower pane
    const fy = y + h * (1 - o.frost);
    rect(c, x, fy, w, h * o.frost + 1, css(o.cool ? hex(0xcfdcd6) : hex(0xf6d79a), 0.72));
    rect(c, x, fy, w, 1, css(hex(0xfff3c8), 0.9));
    for (let k = x + 2; k < x + w - 2; k += 4) rect(c, k, fy + 3, 2, 1, css(hex(0xc98a3a), 0.55));
  }
}

/** A dark upstairs window with nets and a slice of sky in the glass. */
export function darkGlass(c: Ctx, x: number, y: number, w: number, h: number, seed: number, nets = true) {
  const r = rng(seed);
  rect(c, x, y, w, h, H(0x27313d));
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = "rgba(150,168,184,0.38)"; c.beginPath(); c.moveTo(x - 2, y + h * 0.55); c.lineTo(x + w * 0.7, y - 2); c.lineTo(x + w + 4, y - 2); c.lineTo(x + w * 0.2, y + h + 2); c.lineTo(x - 2, y + h + 2); c.closePath(); c.fill();
  if (nets) { rect(c, x, y + h * 0.5, w, h * 0.5, "rgba(196,200,196,0.55)"); for (let k = x + 1; k < x + w; k += 3) rect(c, k, y + h * 0.5, 1, h * 0.5, "rgba(120,126,128,0.35)"); if (r() < 0.6) rect(c, x + 2 + r.int(Math.max(1, w - 6)), y + h * 0.5 - 4, 3, 4, H(0x7a3a2a)); }
  c.restore();
}

export function sash(c: Ctx, x: number, y: number, w: number, h: number, seed: number, lit = false) {
  rect(c, x - 2, y - 5, w + 4, 5, H(0xc9c0a6)); rect(c, x - 2, y - 5, w + 4, 1, H(0xe4dcc6)); rect(c, x - 2, y - 1, w + 4, 1, H(0x8e8672)); // lintel
  rect(c, x - 1, y, w + 2, h + 1, H(0x2a2420)); // reveal
  rect(c, x, y, w, h, H(0xe6dfcc));
  if (lit) litGlass(c, x + 2, y + 2, w - 4, h - 4, seed, { heads: 0 }); else darkGlass(c, x + 2, y + 2, w - 4, h - 4, seed);
  if (lit) { rect(c, x + 2, y + 2, 5, h - 4, css(hex(0xa8452e), 0.85)); rect(c, x + w - 7, y + 2, 5, h - 4, css(hex(0xa8452e), 0.85)); } // curtains
  rect(c, x + 2, y + Math.floor(h / 2) - 1, w - 4, 2, H(0xe6dfcc)); rect(c, x + Math.floor(w / 2), y + 2, 1, h - 4, H(0xd2cab6));
  rect(c, x - 3, y + h + 1, w + 6, 3, H(0xcfc6ac)); rect(c, x - 3, y + h + 4, w + 6, 1, H(0x4a3a34)); // sill and its shadow
  for (let k = 0; k < 5; k++) rect(c, x - 2 + k * 2, y + h + 5 + k, 1, 6, "rgba(30,26,24,0.22)"); // the sill's drip stain
}

// ---------------------------------------------------------------------------------------------
// The Three Lions.

/** South front, 7 m x 6.3 m. The big ground-floor windows and the door glass are separate (unlit) faces: see pubGlass. */
export function pubFront(c: Ctx, w: number, h: number) {
  const r = rng(11), Y = (m: number) => Math.round(h - m * PX), X = (m: number) => Math.round(m * PX);
  brick(c, 0, 0, w, Y(3.3), BRICK_RED, r);
  weather(c, 0, 0, w, Y(3.3), r, 0.38, 0.0, 9);
  rect(c, 0, Y(3.62), w, 4, H(0xcabfa2)); rect(c, 0, Y(3.62), w, 1, H(0xe6dcc4)); rect(c, 0, Y(3.62) + 4, w, 1, H(0x5a4038)); // string course
  for (const [i, cx] of [1.25, 3.5, 5.75].entries()) sash(c, X(cx - 0.5), Y(5.55), X(1.0), Y(4.05) - Y(5.55), 20 + i, false);
  // Painted timber shopfront.
  const top = Y(3.3), g = hex(GREEN);
  rect(c, 0, top, w, h - top, css(g));
  rect(c, 0, top, w, 2, H(GOLD)); rect(c, 0, top + 2, w, 2, css(shade(g, 0.6)));
  rect(c, 0, Y(2.5), w, 2, css(shade(g, 0.55)));
  const pil = [[0, 0.3], [2.3, 2.6], [3.7, 4.0], [6.7, 7.0]];
  // stall riser panels
  const riser = (x0: number, x1: number) => { for (let px = X(x0) + 2; px < X(x1) - 6; px += 22) { const pw = Math.min(20, X(x1) - 2 - px); bevel(c, px, Y(0.68), pw, Y(0.1) - Y(0.68), shade(g, 0.86), 0.62, 1.22); } };
  riser(0.3, 2.3); riser(4.0, 6.7);
  // window and door recesses (dark, in case the glass faces are a hair off)
  rect(c, X(0.3), Y(2.45), X(2.0), Y(0.75) - Y(2.45), H(0x2a1c10)); rect(c, X(4.0), Y(2.45), X(2.7), Y(0.75) - Y(2.45), H(0x2a1c10)); rect(c, X(2.6), Y(2.45), X(1.1), Y(0) - Y(2.45), H(0x2a1c10));
  rect(c, X(0.3) - 1, Y(0.75), X(2.0) + 2, 2, H(CREAM)); rect(c, X(4.0) - 1, Y(0.75), X(2.7) + 2, 2, H(CREAM)); // cills
  for (const [a, b] of pil) { // pilasters
    const px = X(a), pw = X(b) - X(a);
    rect(c, px, Y(2.5), pw, h - Y(2.5), css(shade(g, 1.12))); rect(c, px, Y(2.5), 1, h, css(shade(g, 1.4))); rect(c, px + pw - 1, Y(2.5), 1, h, css(shade(g, 0.6)));
    rect(c, px + 2, Y(2.3), pw - 4, Y(0.9) - Y(2.3), css(shade(g, 0.88))); rect(c, px - 1, Y(2.5), pw + 2, 3, H(GOLD)); rect(c, px - 1, Y(0.18), pw + 2, Y(0) - Y(0.18), css(shade(g, 0.7)));
  }
  // grime at the foot, splash-back from the yard
  const gr = c.createLinearGradient(0, h - 22, 0, h); gr.addColorStop(0, "rgba(20,22,16,0)"); gr.addColorStop(1, "rgba(20,22,16,0.55)"); c.fillStyle = gr; c.fillRect(0, h - 22, w, 22);
  grain(c, 0, 0, w, h, 5, 3);
}

/** The lit ground-floor glass: kind 0 = left window (2 m), 1 = right window (2.7 m), 2 = door (1.1 x 2.45 m). */
export function pubGlass(c: Ctx, w: number, h: number, kind: number) {
  const g = hex(GREEN);
  rect(c, 0, 0, w, h, css(shade(g, 0.8)));
  if (kind === 2) {
    // fanlight
    litGlass(c, 3, 2, w - 6, 8, 5); tiny(c, "3", w / 2 - 1, 4, H(0x7a4a1c));
    // the door: half glazed
    rect(c, 2, 12, w - 4, h - 12, css(shade(g, 0.62)));
    bevel(c, 4, 14, w - 8, h - 16, shade(g, 1.0), 1.35, 0.6);
    litGlass(c, 7, 17, w - 14, 28, 6, { frost: 0.45, heads: 1 });
    rect(c, 7, 30, w - 14, 1, css(shade(g, 0.8))); rect(c, Math.floor(w / 2), 17, 1, 28, css(shade(g, 0.8)));
    bevel(c, 7, 49, w - 14, 14, shade(g, 0.84), 0.6, 1.2);
    rect(c, 6, h - 9, w - 12, 6, H(0xb8923a)); rect(c, 6, h - 9, w - 12, 1, H(0xe9cf7a)); // brass kick plate
    rect(c, w - 9, 46, 2, 5, H(0xe9cf7a)); // handle
    return;
  }
  const n = kind === 0 ? 2 : 3, lw = (w - 2) / n;
  for (let i = 0; i < n; i++) {
    const x = Math.round(1 + i * lw) + 1, ww = Math.round(lw) - 2;
    litGlass(c, x, 2, ww, 11, 30 + kind * 7 + i, {}); // toplight
    for (let k = x + 1; k < x + ww - 1; k += 3) rect(c, k, 2, 1, 11, css(hex(0xb86a2a), 0.45)); // leaded
    litGlass(c, x, 15, ww, h - 17, 40 + kind * 7 + i, { frost: 0.36, bar: i === 0 && kind === 0, telly: kind === 1 && i === 2, heads: 1 + ((i + kind) % 2) });
  }
  tiny(c, kind === 0 ? "ALES" : "WINES & SPIRITS", w / 2, h - 13, css(hex(0x9a5a22)), 1, "center");
  rect(c, 0, 13, w, 2, css(shade(g, 0.8))); rect(c, 0, 13, w, 1, css(shade(g, 1.3)));
}

/** The fascia sign, 64 px/m. */
export function pubSign(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(GREEN_D));
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(1, "rgba(0,0,0,0.18)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = H(GOLD); c.lineWidth = 1; c.strokeRect(3.5, 3.5, w - 7, h - 7);
  pixText(c, "THE THREE LIONS", w / 2, h * 0.5 + 12, 24, H(0xf0c95a), { font: FONTS.serif, weight: 700, align: "center", shadow: H(0x0a1c12), maxW: w - 70 });
  for (const x of [20, w - 20]) { rect(c, x - 4, h / 2 - 1, 9, 3, H(GOLD)); rect(c, x - 1, h / 2 - 4, 3, 9, H(GOLD)); rect(c, x - 2, h / 2 - 2, 5, 5, H(0xf6dc8a)); }
  // weathering: a couple of rain runs and flaked paint
  const r = rng(77); for (let k = 0; k < 26; k++) rect(c, r.int(w), 4 + r.int(h - 8), 1 + r.int(2), 1, "rgba(8,20,14,0.45)");
}

/** East gable, 5 m wide x 8.25 m to the apex. Left of the picture is the south (yard) corner. */
export function pubGable(c: Ctx, w: number, h: number) {
  const r = rng(12), Y = (m: number) => Math.round(h - m * PX), X = (m: number) => Math.round(m * PX);
  brick(c, 0, 0, w, h, BRICK_RED, r);
  // a ghost sign: a painted panel from 1910, mostly gone
  const gx = X(0.7), gy = Y(5.6), gw = X(3.6), gh = X(1.7);
  rect(c, gx, gy, gw, gh, "rgba(214,204,176,0.55)"); c.strokeStyle = "rgba(40,30,26,0.5)"; c.strokeRect(gx + 1.5, gy + 1.5, gw - 3, gh - 3);
  pixText(c, "FINE ALES", gx + gw / 2, gy + 22, 13, "rgba(46,34,30,0.75)", { font: FONTS.serif, weight: 700, align: "center", maxW: gw - 10 });
  pixText(c, "& STOUT", gx + gw / 2, gy + 44, 13, "rgba(46,34,30,0.7)", { font: FONTS.serif, weight: 700, align: "center", maxW: gw - 10 });
  for (let k = 0; k < 500; k++) { const px = gx + r.int(gw), py = gy + r.int(gh); rect(c, px, py, 1 + r.int(3), 1, css(r.pick(BRICK_RED.tones), 0.9)); } // flaking back to brick
  weather(c, 0, 0, w, h, r, 0.3, 0.5, 12);
  // cellar door and its step
  rect(c, X(3.1) - 2, Y(2.1) - 4, X(1.0) + 4, 4, H(0xb9b09a)); rect(c, X(3.1), Y(2.1), X(1.0), Y(0) - Y(2.1), H(0x1c1c20)); bevel(c, X(3.1) + 2, Y(2.1) + 2, X(1.0) - 4, Y(0.1) - Y(2.1) - 2, hex(0x26282e), 1.3, 0.6);
  tiny(c, "STAFF", X(3.6), Y(1.5), H(0xc9c2aa), 1, "center"); rect(c, X(3.95), Y(1.05), 2, 3, H(0xb8923a));
  // small landing window
  sash(c, X(3.2), Y(5.2), X(0.8), X(1.1), 31, false);
  // vent, cable
  bevel(c, X(1.2), Y(2.9), 12, 9, hex(0x8f959c)); for (let k = 0; k < 3; k++) rect(c, X(1.2) + 2, Y(2.9) + 2 + k * 2, 8, 1, H(0x4a4f56));
  rect(c, X(1.2) + 5, Y(2.9) + 9, 1, Y(0) - Y(2.9), "rgba(20,20,22,0.7)");
  grain(c, 0, 0, w, h, 5, 4);
}

export function slateRoof(c: Ctx, w: number, h: number, seed = 5) {
  slate(c, 0, 0, w, h, rng(seed));
  const r = rng(seed + 100);
  for (let k = 0; k < 3; k++) { const px = r.int(w - 50), py = r.int(h - 30), pw = 28 + r.int(40), ph = 15 + r.int(20); c.fillStyle = r() < 0.5 ? "rgba(120,136,156,0.22)" : "rgba(20,22,30,0.2)"; c.fillRect(px - (px % 7), py - (py % 5), pw - (pw % 7), ph - (ph % 5)); } // re-slated patches
  for (let k = 0; k < 10; k++) { c.fillStyle = "rgba(150,150,90,0.16)"; c.beginPath(); c.ellipse(r.int(w), r.int(h), 3 + r.int(7), 2 + r.int(4), 0, 0, 7); c.fill(); } // lichen
  rect(c, 0, h - 2, w, 2, "rgba(16,18,22,0.5)"); // shadow line at the gutter
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(170,186,200,0.16)"); g.addColorStop(0.5, "rgba(170,186,200,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); // wet sheen near the ridge
  grain(c, 0, 0, w, h, 4, seed);
}

/** Three lions passant, more or less. */
export function lion(c: Ctx, x: number, y: number, col: string, s = 1) {
  const rows = ["..............##.", ".#...........####", "#...#########.##.", "#..###########...", ".#############...", "..###.....###....", "..#.#.....#.#....", ".##.##...##.##..."];
  c.fillStyle = col;
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") c.fillRect(x + i * s, y + j * s, s, s); });
}

/** The swinging post sign, 64 px/m. */
export function swingSign(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0x1a1a1c));
  rect(c, 2, 2, w - 4, h - 4, H(GOLD)); rect(c, 4, 4, w - 8, h - 8, H(0xa3231f));
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,255,255,0.12)"); g.addColorStop(1, "rgba(0,0,0,0.25)"); c.fillStyle = g; c.fillRect(4, 4, w - 8, h - 8);
  for (let k = 0; k < 3; k++) { lion(c, Math.round(w / 2 - 17) + 1, 13 + k * 19 + 1, H(0x5a1210), 2); lion(c, Math.round(w / 2 - 17), 13 + k * 19, H(0xf2cc5c), 2); }
  rect(c, 6, h - 22, w - 12, 15, H(GREEN_D));
  tiny(c, "THREE LIONS", w / 2, h - 19, H(0xf0c95a), 1, "center"); tiny(c, "FREE HOUSE", w / 2, h - 13, H(0xc9a94a), 1, "center");
}

/** A-board, 64 px/m. */
export function chalkboard(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0x6a4a2a)); rect(c, 3, 3, w - 6, h - 6, H(0x1e2422));
  tiny(c, "MATCH", w / 2, 7, H(0xf2f0e6), 2, "center"); tiny(c, "DAY", w / 2, 19, H(0xf2f0e6), 2, "center");
  rect(c, 6, 31, w - 12, 1, H(0xe8d24a));
  tiny(c, "PIE+PINT", w / 2, 35, H(0xf7a8b0), 1, "center"); tiny(c, "£6", w / 2, 43, H(0xe8d24a), 2, "center");
  const r = rng(9); for (let k = 0; k < 40; k++) rect(c, 3 + r.int(w - 6), 3 + r.int(h - 6), 1, 1, "rgba(230,230,220,0.18)");
}

// ---------------------------------------------------------------------------------------------
// The far side of the street.

export interface ShopCfg { pal: BrickPal; fascia: number; frame: number; kind: "glass" | "shutter" | "house"; seed: number; doorAt?: number }

/** A lock-up shop, w x 3.9 m. The fascia lettering and the window are separate faces. */
export function shopFront(c: Ctx, w: number, h: number, o: ShopCfg) {
  const r = rng(o.seed), Y = (m: number) => Math.round(h - m * PX);
  brick(c, 0, 0, w, h, o.pal, r);
  weather(c, 0, 0, w, Y(3.0), r, 0.3, 0, 5);
  rect(c, 0, 0, w, 3, H(0xa9a290)); rect(c, 0, 3, w, 1, "rgba(20,18,16,0.5)"); // coping
  if (o.kind === "house") {
    sash(c, Math.round(w * 0.2), Y(2.5), 30, 44, o.seed, true); sash(c, Math.round(w * 0.62), Y(2.5), 30, 44, o.seed + 1, false);
    weather(c, 0, 0, w, h, r, 0.1, 0.5, 8); grain(c, 0, 0, w, h, 5, o.seed); return;
  }
  const f = hex(o.frame);
  rect(c, 0, Y(3.1), w, Y(2.38) - Y(3.1), H(o.fascia)); rect(c, 0, Y(3.1), w, 1, css(shade(hex(o.fascia), 1.3))); rect(c, 0, Y(2.38) - 1, w, 2, "rgba(10,10,12,0.6)");
  rect(c, 0, Y(2.36), w, h - Y(2.36), css(shade(f, 0.9)));
  rect(c, 0, Y(2.36), 5, h, css(shade(f, 1.15))); rect(c, w - 5, Y(2.36), 5, h, css(shade(f, 0.75)));
  if (o.kind === "shutter") {
    for (let y = Y(2.3); y < h - 2; y += 3) { rect(c, 6, y, w - 12, 2, H(0x8a9096)); rect(c, 6, y + 2, w - 12, 1, H(0x565c62)); }
    rect(c, 6, Y(2.3), w - 12, 4, H(0x4a4f55)); bevel(c, w / 2 - 3, h - 9, 6, 6, hex(0xc9a23a));
    // a tag
    c.strokeStyle = "rgba(230,230,235,0.75)"; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.3, h - 20); c.bezierCurveTo(w * 0.36, h - 52, w * 0.44, h - 12, w * 0.5, h - 40); c.bezierCurveTo(w * 0.56, h - 58, w * 0.6, h - 18, w * 0.7, h - 34); c.stroke();
    c.strokeStyle = "rgba(214,60,90,0.75)"; c.beginPath(); c.moveTo(w * 0.34, h - 14); c.lineTo(w * 0.68, h - 16); c.stroke();
  } else {
    rect(c, 6, Y(2.3), w - 12, Y(0.42) - Y(2.3), H(0x191a1e)); // window recess
    for (let px = 8; px < w - 12; px += 14) bevel(c, px, Y(0.36), 12, Y(0.06) - Y(0.36), shade(f, 0.8), 0.6, 1.2);
  }
  const gr = c.createLinearGradient(0, h - 18, 0, h); gr.addColorStop(0, "rgba(20,22,16,0)"); gr.addColorStop(1, "rgba(20,22,16,0.5)"); c.fillStyle = gr; c.fillRect(0, h - 18, w, 18);
  grain(c, 0, 0, w, h, 5, o.seed);
}

/** A fascia sign at 64 px/m. */
export function fasciaSign(c: Ctx, w: number, h: number, text: string, bg: number, fg: number, o: { font?: string; sub?: string; edge?: number; crown?: boolean; stripe?: number } = {}) {
  rect(c, 0, 0, w, h, H(bg));
  if (o.stripe !== undefined) for (let x = -h; x < w; x += 16) { c.fillStyle = H(o.stripe); c.beginPath(); c.moveTo(x, h); c.lineTo(x + 8, h); c.lineTo(x + 8 + 6, h - 6); c.lineTo(x + 6, h - 6); c.closePath(); c.fill(); }
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(255,255,255,0.14)"); g.addColorStop(1, "rgba(0,0,0,0.14)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (o.edge !== undefined) { c.strokeStyle = H(o.edge); c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); }
  const cap = Math.round(h * (o.sub ? 0.5 : 0.58)), base = Math.round(o.sub ? h * 0.62 : h * 0.5 + cap / 2);
  const tw = pixText(c, text, w / 2 + (o.crown ? 16 : 0), base, cap, H(fg), { font: o.font ?? FONTS.block, align: "center", maxW: w - (o.crown ? 60 : 20), shadow: "rgba(0,0,0,0.35)" });
  if (o.crown) { // a crown, for the kings
    const x = Math.round(w / 2 - tw / 2 - 22), y = base - cap;
    c.fillStyle = H(fg); c.fillRect(x, y + cap - 8, 26, 8);
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + k * 9, y + cap - 8); c.lineTo(x + k * 9 + 4, y + 2); c.lineTo(x + k * 9 + 8, y + cap - 8); c.closePath(); c.fill(); c.fillRect(x + k * 9 + 3, y, 3, 3); }
    rect(c, x + 3, y + cap - 5, 20, 2, H(bg));
  }
  if (o.sub) pixText(c, o.sub, w / 2, h - 6, Math.round(h * 0.16), H(fg), { align: "center", weight: 700, maxW: w - 16 });
  const r = rng(text.length * 31); for (let k = 0; k < w / 6; k++) rect(c, r.int(w), r.int(h), 1, 2 + r.int(5), "rgba(20,16,10,0.16)");
}

/** The pawnbroker's window, in cold strip light: everything somebody once loved. */
export function pawnWindow(c: Ctx, w: number, h: number) {
  const r = rng(404);
  litGlass(c, 0, 0, w, h, 9, { cool: true });
  rect(c, 0, h - 16, w, 16, H(0x23335c)); rect(c, 0, h - 16, w, 1, H(0x3a4f86)); // velvet shelf
  rect(c, 0, Math.round(h * 0.45), w, 2, H(0x9aa6a8));
  // watches and rings on the velvet
  for (let x = 3; x < w - 3; x += 3) { const q = r(); rect(c, x, h - 12 + r.int(8), 1 + (q < 0.3 ? 1 : 0), 1, H(q < 0.5 ? 0xf1d264 : q < 0.8 ? 0xe9eef2 : 0xd24a4a)); }
  // guitars hanging
  const guitar = (x: number, y: number, col: number) => { rect(c, x + 2, y, 2, 14, H(0x5a3a22)); rect(c, x + 1, y - 2, 4, 3, H(0x2a2018)); rect(c, x, y + 13, 6, 8, H(col)); rect(c, x - 1, y + 15, 8, 5, H(col)); rect(c, x + 2, y + 15, 2, 2, H(0x1a1410)); };
  guitar(8, 5, 0xc8502a); guitar(20, 4, 0x2a5a9a); guitar(w - 18, 5, 0xe0b040);
  // tellies and a stack of consoles on the top shelf
  const telly = (x: number, y: number, tw: number, th: number, scr: number) => { rect(c, x, y, tw, th, H(0x16181c)); rect(c, x + 1, y + 1, tw - 2, th - 3, H(scr)); rect(c, x + 2, y + 2, Math.max(1, tw - 6), 1, "rgba(255,255,255,0.5)"); };
  telly(34, Math.round(h * 0.45) - 15, 20, 15, 0x4a8ad0); telly(58, Math.round(h * 0.45) - 11, 14, 11, 0x5aaa62); telly(w - 46, Math.round(h * 0.45) - 13, 18, 13, 0xb8c4d8);
  for (let k = 0; k < 4; k++) rect(c, 76, Math.round(h * 0.45) - 3 - k * 3, 12 - k, 2, H(r.pick([0x2a2c34, 0xd8d8dc, 0x3a3f4a])));
  // lower shelf: drills, toasters, a trumpet
  for (let x = 30; x < w - 24; x += 9 + r.int(5)) { const col = r.pick([0xe0b020, 0xc8382a, 0x3a7a4a, 0xd8d8d8, 0x2a2a30, 0x2f6ab0]); const bh = 5 + r.int(7); rect(c, x, h - 17 - bh, 6 + r.int(4), bh, H(col)); rect(c, x, h - 17 - bh, 6, 1, "rgba(255,255,255,0.35)"); }
  // stickers on the glass
  const burst = (x: number, y: number, t1: string, t2: string, bg: number, fg: number) => { rect(c, x - 1, y - 1, 30, 15, H(0x111111)); rect(c, x, y, 28, 13, H(bg)); tiny(c, t1, x + 14, y + 1, H(fg), 1, "center"); tiny(c, t2, x + 14, y + 7, H(fg), 1, "center"); };
  burst(3, Math.round(h * 0.52), "WE BUY", "GOLD", 0xf2c81e, 0x141414); burst(w - 33, Math.round(h * 0.52), "CASH 4", "PHONES", 0xd8322a, 0xffffff);
  rect(c, Math.round(w / 2) - 16, 3, 33, 9, H(0x141414)); tiny(c, "OPEN", Math.round(w / 2), 5, H(0xff5a6a), 1, "center"); rect(c, Math.round(w / 2) - 15, 4, 31, 1, H(0xff5a6a)); rect(c, Math.round(w / 2) - 15, 10, 31, 1, H(0xff5a6a));
  // glazing bars and the glass's own grime
  rect(c, Math.round(w * 0.5), 0, 2, h, H(0x15161a));
  c.fillStyle = "rgba(190,205,215,0.16)"; c.beginPath(); c.moveTo(0, h * 0.7); c.lineTo(w * 0.35, 0); c.lineTo(w * 0.5, 0); c.lineTo(0, h); c.closePath(); c.fill();
}

/** A plain shop window for the neighbours. */
export function shopWindow(c: Ctx, w: number, h: number, seed: number, cool: boolean, label: string) {
  const r = rng(seed);
  litGlass(c, 0, 0, w, h, seed, { cool, heads: 2, frost: 0.0 });
  rect(c, 0, h - 10, w, 10, "rgba(40,34,30,0.55)");
  for (let x = 4; x < w - 4; x += 6 + r.int(5)) rect(c, x, h - 10 - 3 - r.int(8), 4 + r.int(3), 4 + r.int(8), H(r.pick([0xd8d2c0, 0xc0392b, 0x2f6ab0, 0xe0b020, 0x3a7a4a])));
  // posters stuck to the inside of the glass
  for (let x = 6; x < w - 22; x += 24 + r.int(8)) {
    const pw = 16 + r.int(5), ph = 22 + r.int(8), py = 14 + r.int(6), bg = r.pick([0xf4f0e0, 0xf2c81e, 0xd8322a, 0x2f6ab0, 0xf4f0e0]), fg = bg === 0xf4f0e0 || bg === 0xf2c81e ? 0x1a1a1a : 0xffffff;
    rect(c, x, py, pw, ph, H(bg)); rect(c, x, py, pw, 1, "rgba(255,255,255,0.5)");
    tiny(c, r.pick(["2/1", "WIN", "£5", "11/4", "NOW", "3FOR2"]), x + pw / 2, py + 3, H(fg), 1, "center");
    for (let k = 0; k < 3; k++) rect(c, x + 2, py + 11 + k * 3, pw - 4 - r.int(5), 1, css(hex(fg), 0.6));
  }
  rect(c, Math.round(w * 0.5), 0, 2, h, H(0x1a1c20));
  rect(c, 4, 4, label.length * 4 + 3, 9, H(0xf4f0e0)); tiny(c, label, 6, 6, H(0xc0281e));
}

export function shopDoor(c: Ctx, w: number, h: number, frame: number, lit: boolean, cool = true) {
  const f = hex(frame);
  rect(c, 0, 0, w, h, css(shade(f, 0.7)));
  if (lit) litGlass(c, 3, 3, w - 6, h - 16, 71, { cool }); else rect(c, 3, 3, w - 6, h - 16, H(0x1c2026));
  rect(c, 3, Math.round(h * 0.42), w - 6, 2, css(shade(f, 0.9))); rect(c, w - 8, Math.round(h * 0.5), 2, 6, H(0xd8d8dc));
  bevel(c, 3, h - 12, w - 6, 10, shade(f, 0.85));
  if (lit) { rect(c, 6, 8, 14, 9, H(0xf4f0e0)); tiny(c, "PUSH", 7, 10, H(0x20242a)); }
}

export function acSide(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0xb4b8bc)); rect(c, 0, 0, w, 1, H(0xdcdfe2)); rect(c, 0, h - 3, w, 3, H(0x6a6e74));
  for (let y = 3; y < h - 4; y += 2) rect(c, 3, y, w - 12, 1, H(0x5a5e66));
  rect(c, w - 7, 3, 4, 5, H(0x3a3d44)); rect(c, w - 6, 10, 2, 2, H(0x52b06a));
  const r = rng(17); for (let k = 0; k < 14; k++) rect(c, r.int(w), 2 + r.int(h - 3), 1, 2 + r.int(4), "rgba(110,70,40,0.4)"); // rust runs
}
export function acTop(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0xc3c7cb)); c.strokeStyle = H(0x8a8e94); c.strokeRect(0.5, 0.5, w - 1, h - 1);
  c.fillStyle = H(0x2c2f35); c.beginPath(); c.arc(w / 2, h / 2, h / 2 - 3, 0, 7); c.fill();
  c.strokeStyle = H(0x7c8088); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * (h / 2 - 4), h / 2 + Math.sin(a) * (h / 2 - 4)); c.stroke(); }
  rect(c, w / 2 - 1, h / 2 - 1, 3, 3, H(0x9aa0a6)); rect(c, 2, 2, 5, 3, "rgba(240,240,236,0.8)");
}
/** Felt flat roof seen from above. */
export function flatRoof(c: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed);
  rect(c, 0, 0, w, h, H(0x53565c));
  for (let x = 0; x < w; x += 30) { rect(c, x, 0, 1, h, H(0x3f4247)); rect(c, x + 1, 0, 1, h, H(0x62666d)); }
  for (let k = 0; k < 4; k++) { const px = r.int(w - 30), py = r.int(h - 20); rect(c, px, py, 16 + r.int(24), 10 + r.int(16), css(shade(hex(0x53565c), r() < 0.5 ? 0.8 : 1.14))); }
  // standing water
  for (let k = 0; k < 3; k++) { const px = 10 + r.int(Math.max(1, w - 40)), py = 8 + r.int(Math.max(1, h - 24)), pw = 14 + r.int(26), ph = 6 + r.int(10); c.fillStyle = "rgba(130,148,164,0.55)"; c.beginPath(); c.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, 7); c.fill(); rect(c, px + pw / 2 - 2, py + ph / 2, 4, 1, "rgba(200,214,226,0.7)"); }
  for (let k = 0; k < (w * h) / 9; k++) rect(c, r.int(w), r.int(h), 1, 1, r() < 0.5 ? H(0x45484d) : H(0x62666d));
  for (let k = 0; k < 40; k++) { const px = r.int(w), py = r() < 0.5 ? h - 6 - r.int(8) : r.int(h); rect(c, px, py, 1 + r.int(3), 1, H(r.pick([0x5a6a3a, 0x4d5c34]))); } // moss in the low corners
  for (let k = 0; k < 7; k++) { const px = r.int(w), py = r.int(h); rect(c, px, py, 2, 2, H(0xe8e6de)); rect(c, px + 1, py + 2, 1, 1, H(0xe8e6de)); } // pigeons again
  for (let k = 0; k < 2; k++) { c.strokeStyle = "rgba(20,20,24,0.55)"; c.beginPath(); c.moveTo(r.int(w), 6); c.lineTo(r.int(w), h - 6); c.stroke(); } // a cable somebody ran in 1994
  c.strokeStyle = H(0x8f8a80); c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3); c.strokeStyle = "rgba(20,20,24,0.5)"; c.lineWidth = 1; c.strokeRect(4.5, 4.5, w - 9, h - 9);
  const g = c.createLinearGradient(0, 0, 0, 12); g.addColorStop(0, "rgba(10,10,14,0.4)"); g.addColorStop(1, "rgba(10,10,14,0)"); c.fillStyle = g; c.fillRect(0, 0, w, 12);
}

/** The wayfinding totem face, 64 px/m (1.8 m x 3.9 m). */
export function totem(c: Ctx, w: number, h: number) {
  const blue = hex(0x1c4f9c);
  rect(c, 0, 0, w, h, css(blue));
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(1, "rgba(0,0,0,0.16)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  rect(c, 0, 0, w, 30, H(0x12336a)); rect(c, 0, 30, w, 3, H(0xf2f2f2));
  // the club: a circle with a ball in it
  c.fillStyle = "#f2f2f2"; c.beginPath(); c.arc(w / 2, 15, 10, 0, 7); c.fill(); c.fillStyle = H(0x12336a); c.beginPath(); c.arc(w / 2, 15, 7, 0, 7); c.fill(); rect(c, w / 2 - 2, 13, 4, 4, "#f2f2f2");
  const row = (y: number, dir: "up" | "left" | "right", text: string) => {
    const ax = 20, ay = y + 22;
    rect(c, 6, y + 6, 30, 32, "#f2f2f2");
    c.fillStyle = css(blue); c.beginPath();
    if (dir === "up") { c.moveTo(ax + 1, ay - 13); c.lineTo(ax + 12, ay - 1); c.lineTo(ax + 5, ay - 1); c.lineTo(ax + 5, ay + 12); c.lineTo(ax - 3, ay + 12); c.lineTo(ax - 3, ay - 1); c.lineTo(ax - 10, ay - 1); }
    else if (dir === "left") { c.moveTo(ax - 12, ay); c.lineTo(ax, ay - 11); c.lineTo(ax, ay - 4); c.lineTo(ax + 13, ay - 4); c.lineTo(ax + 13, ay + 4); c.lineTo(ax, ay + 4); c.lineTo(ax, ay + 11); }
    else { c.moveTo(ax + 14, ay); c.lineTo(ax + 2, ay - 11); c.lineTo(ax + 2, ay - 4); c.lineTo(ax - 11, ay - 4); c.lineTo(ax - 11, ay + 4); c.lineTo(ax + 2, ay + 4); c.lineTo(ax + 2, ay + 11); }
    c.closePath(); c.fill();
    pixText(c, text, 42, y + 31, 17, "#ffffff", { maxW: w - 47, weight: 800 });
    rect(c, 6, y + 46, w - 12, 1, "rgba(255,255,255,0.45)");
  };
  row(40, "up", "ENTRANCE"); row(92, "left", "PUB"); row(144, "right", "SHOPS");
  tiny(c, "MATCH DAY", w / 2, 202, "rgba(255,255,255,0.8)", 1, "center"); tiny(c, "NO BOTTLES", w / 2, 210, "rgba(255,255,255,0.6)", 1, "center");
  rect(c, 0, h - 18, w, 18, H(0x3a3d44)); rect(c, 0, h - 18, w, 1, H(0x5c6068));
  // stickers and grime at hand height
  rect(c, w - 30, h - 62, 18, 12, H(0xf2c81e)); tiny(c, "UTD", w - 27, h - 59, H(0x141414)); rect(c, 12, h - 48, 12, 12, H(0xd8322a));
  const gr = c.createLinearGradient(0, h - 60, 0, h); gr.addColorStop(0, "rgba(10,12,16,0)"); gr.addColorStop(1, "rgba(10,12,16,0.4)"); c.fillStyle = gr; c.fillRect(0, h - 60, w, 60);
}

/** The backdrop: the stand and its floodlights, painted small and pale, the way distance is done on a model railway.
 *  32 m x 11 m, but only the band from about 3.5 m to 7 m ever shows above the shop roofs. */
export function stadiumBackdrop(c: Ctx, w: number, h: number) {
  const r = rng(1966), sky0 = hex(0xb6bec2), sky1 = hex(0x9ca7ad), Y = (m: number) => Math.round(h - m * PX), X = (m: number) => Math.round(m * PX);
  const g = c.createLinearGradient(0, Y(8), 0, Y(3)); g.addColorStop(0, css(sky0)); g.addColorStop(1, css(sky1)); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 30; k++) { const cx = r.int(w), cy = Y(4.5 + r() * 5), cw = 50 + r.int(150); c.fillStyle = `rgba(${r() < 0.5 ? "206,212,214" : "146,156,164"},0.2)`; c.beginPath(); c.ellipse(cx, cy, cw, 5 + r.int(8), 0, 0, 7); c.fill(); } // cloud bellies
  const haze = (col: number, k: number) => css(mix(hex(col), sky1, k));
  // floodlight pylons: lattice legs and a rack of lamps already on against the gloom
  const pylon = (px: number, topM: number, s: number, k: number) => {
    const ty = Y(topM), base = h, col = haze(0x3a4048, k);
    c.strokeStyle = col; c.lineWidth = Math.max(1, 2 * s); c.beginPath(); c.moveTo(px - 8 * s, base); c.lineTo(px - 3 * s, ty + 8 * s); c.moveTo(px + 8 * s, base); c.lineTo(px + 3 * s, ty + 8 * s); c.stroke();
    c.lineWidth = 1; for (let y = ty + 10 * s; y < base; y += 9 * s) { c.beginPath(); c.moveTo(px - 4 * s, y); c.lineTo(px + 5 * s, y + 9 * s); c.moveTo(px + 4 * s, y); c.lineTo(px - 5 * s, y + 9 * s); c.stroke(); }
    const bw = Math.round(28 * s), bh = Math.round(18 * s); rect(c, px - bw / 2, ty - bh / 2, bw, bh, haze(0x2c3138, k * 0.8));
    const gl = c.createRadialGradient(px, ty, 1, px, ty, 38 * s); gl.addColorStop(0, "rgba(255,248,214,0.8)"); gl.addColorStop(1, "rgba(255,248,214,0)"); c.fillStyle = gl; c.fillRect(px - 40 * s, ty - 40 * s, 80 * s, 80 * s);
    const st = Math.max(2, Math.round(4 * s)); for (let j = 0; j * st < bh - 3; j++) for (let i = 0; i * st < bw - 3; i++) rect(c, px - bw / 2 + 2 + i * st, ty - bh / 2 + 2 + j * st, st - 1, st - 1, H(0xfff6d2));
  };
  pylon(X(3.0), 5.7, 0.6, 0.6); pylon(X(29.4), 6.0, 0.7, 0.55);
  // the stand: a long shed with a cantilever roof, seen from the street side
  const sx0 = X(5.5), sx1 = X(27), top = Y(5.75);
  rect(c, sx0, top + 8, sx1 - sx0, h, haze(0x5c646c, 0.5));
  for (let x = sx0; x < sx1; x += 4) rect(c, x, top + 8, 1, h, haze(0x4b535b, 0.5)); // profiled cladding
  rect(c, sx0, Y(5.22), sx1 - sx0, 12, haze(0x1d3f7a, 0.42)); // the club's blue band
  rect(c, sx0, Y(5.22) - 2, sx1 - sx0, 16, haze(0x1d3f7a, 0.42)); pixText(c, "NORTH STAND", (sx0 + sx1) / 2 - 60, Y(5.22) + 11, 10, haze(0xf2f2f2, 0.2), { align: "center", weight: 700 });
  for (let x = sx0 + 8; x < sx1 - 10; x += 20) { rect(c, x, Y(4.6), 11, 6, haze(0x2a3038, 0.45)); rect(c, x, Y(4.6), 11, 1, haze(0xe8d090, 0.3)); } // concourse windows
  for (let x = sx0 + 6; x < sx1; x += 40) rect(c, x, top + 8, 2, h, haze(0x39414a, 0.5)); // columns
  rect(c, sx0 - 14, top, sx1 - sx0 + 28, 8, haze(0x30363d, 0.45)); rect(c, sx0 - 14, top, sx1 - sx0 + 28, 2, haze(0xeef0f2, 0.3)); // roof edge
  for (let x = sx0; x < sx1 - 20; x += 40) { c.strokeStyle = haze(0x30363d, 0.48); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, top); c.lineTo(x + 20, top - 10); c.lineTo(x + 40, top); c.stroke(); rect(c, x + 19, top - 11, 2, 11, haze(0x30363d, 0.48)); }
  rect(c, sx0, top - 12, sx1 - sx0, 2, haze(0x30363d, 0.48));
  pylon(X(18.6), 6.72, 1, 0.42); // the near pylon stands in front of the stand, tallest of the three
  // a terrace roofline in front of it all, nearer and darker
  const ry = Y(4.02);
  for (let x = -10; x < w; x += 50) {
    rect(c, x, ry + 8, 50, h, haze(0x5a4a48, 0.3)); c.fillStyle = haze(0x39404a, 0.3); c.beginPath(); c.moveTo(x - 2, ry + 10); c.lineTo(x + 25, ry - 4); c.lineTo(x + 52, ry + 10); c.closePath(); c.fill();
    rect(c, x + 34, ry - 12, 8, 14, haze(0x7a4a3e, 0.3)); rect(c, x + 35, ry - 15, 2, 3, haze(0x9a6244, 0.3)); rect(c, x + 39, ry - 15, 2, 3, haze(0x9a6244, 0.3));
    if ((x / 50) % 3 === 0) for (let k = 0; k < 16; k++) rect(c, x + 37 + Math.round(Math.sin(k * 0.7) * 2) + k * 0.6, ry - 17 - k * 2, 3 + (k >> 2), 2, "rgba(214,218,220,0.22)"); // a coal fire somewhere
  }
  const hz = c.createLinearGradient(0, Y(4.6), 0, Y(3.2)); hz.addColorStop(0, css(sky1, 0)); hz.addColorStop(1, css(sky1, 0.55)); c.fillStyle = hz; c.fillRect(0, Y(4.6), w, h);
  grain(c, 0, 0, w, h, 3, 66);
}

// ---------------------------------------------------------------------------------------------
// Walls, garages, houses.

export function yardWall(c: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed);
  brick(c, 0, 0, w, h, BRICK_WALL, r);
  weather(c, 0, 0, w, h, r, 0.2, 0.6, 7);
  for (let k = 0; k < 14; k++) { const px = r.int(w), py = h - 1 - r.int(10); rect(c, px, py, 2 + r.int(3), 1, H(r.pick([0x56683a, 0x48582f]))); } // moss at the foot
  if (seed % 2) { tiny(c, "NO BALL", 30, h - 33, "rgba(236,232,220,0.8)", 2); tiny(c, "GAMES", 38, h - 20, "rgba(236,232,220,0.8)", 2); }
  grain(c, 0, 0, w, h, 5, seed);
}

export function garages(c: Ctx, w: number, h: number) {
  const r = rng(808);
  brick(c, 0, 0, w, h, BRICK_DARK, r);
  rect(c, 0, 0, w, 7, H(0x7c7f84)); rect(c, 0, 7, w, 1, "rgba(10,10,12,0.5)");
  const cols = [0x4a6a8a, 0x8a3a30, 0x6f8a6a], dw = Math.floor((w - 16) / 3);
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * dw + 3, col = hex(cols[i]);
    rect(c, x - 1, 13, dw - 4, h - 13, H(0x1a1a1c));
    for (let y = 14; y < h - 1; y += 4) { rect(c, x, y, dw - 6, 3, css(shade(col, 0.9 + r() * 0.12))); rect(c, x, y, dw - 6, 1, css(shade(col, 1.2))); }
    rect(c, x + dw / 2 - 5, h - 26, 4, 2, H(0xd0d0d0));
    for (let k = 0; k < 30; k++) rect(c, x + r.int(dw - 6), h - 1 - r.int(16), 1 + r.int(2), 1 + r.int(2), H(r.pick([0x7a4a2a, 0x5a3a22]))); // rust at the foot
    tiny(c, String(i + 1), x + dw / 2 - 2, 19, "rgba(240,240,230,0.85)", 2);
  }
  weather(c, 0, 0, w, h, r, 0.2, 0.5, 6); grain(c, 0, 0, w, h, 5, 8);
}

/** Back of a terraced house: 6 m x 5.4 m. */
export function houseBack(c: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed), Y = (m: number) => Math.round(h - m * PX), X = (m: number) => Math.round(m * PX);
  brick(c, 0, 0, w, h, seed % 2 ? BRICK_STOCK : BRICK_RED, r);
  weather(c, 0, 0, w, h, r, 0.34, 0.5, 9);
  sash(c, X(0.9), Y(4.7), X(1.0), X(1.3), seed, seed % 2 === 0); sash(c, X(3.8), Y(4.7), X(1.0), X(1.3), seed + 3, false);
  // kitchen window (lit) and back door
  rect(c, X(0.7) - 1, Y(2.2) - 1, X(1.6) + 2, X(1.1) + 2, H(0xe6dfcc)); litGlass(c, X(0.7) + 1, Y(2.2) + 1, X(1.6) - 2, X(1.1) - 2, seed + 9, { heads: 1 }); rect(c, X(1.5), Y(2.2), 1, X(1.1), H(0xe6dfcc));
  rect(c, X(0.7) - 2, Y(2.2) + X(1.1) + 1, X(1.6) + 4, 2, H(0xcfc6ac));
  rect(c, X(3.6) - 1, Y(2.1) - 1, X(0.9) + 2, Y(0) - Y(2.1) + 1, H(0xe6dfcc)); bevel(c, X(3.6), Y(2.1), X(0.9), Y(0) - Y(2.1), hex(seed % 2 ? 0x2f4f7a : 0x7a2f2a)); rect(c, X(3.6) + 4, Y(2.1) + 4, X(0.9) - 8, 14, H(0x2a3440));
  rect(c, X(5.4), 0, 2, h, H(0x25262a)); rect(c, X(5.4) - 1, 0, 1, h, "rgba(0,0,0,0.25)"); // downpipe
  rect(c, X(2.7), Y(3.9), 8, 8, H(0xc9ccd0)); rect(c, X(2.7) + 2, Y(3.9) + 2, 4, 4, H(0x9aa0a6)); // dish
  grain(c, 0, 0, w, h, 5, seed);
}

// ---------------------------------------------------------------------------------------------
// The dray.

export const ORANGE = 0xe2661c;
/** Cab, nearside (the side the camera sees), 1.9 m x 1.85 m. Front of the lorry is to the right. */
export function cabSide(c: Ctx, w: number, h: number) {
  const o = hex(ORANGE);
  rect(c, 0, 0, w, h, css(o));
  rect(c, 0, 0, w, 2, css(shade(o, 1.3)));
  // door shut lines
  c.strokeStyle = css(shade(o, 0.62)); c.lineWidth = 1; c.strokeRect(12.5, 5.5, w - 22, h - 13);
  // window
  rect(c, 15, 8, w - 27, 20, H(0x16191e)); rect(c, 16, 9, w - 29, 18, H(0x394653));
  c.fillStyle = "rgba(170,190,205,0.5)"; c.beginPath(); c.moveTo(16, 27); c.lineTo(32, 9); c.lineTo(42, 9); c.lineTo(26, 27); c.closePath(); c.fill();
  rect(c, 22, 17, 7, 10, H(0x20242a)); // the seat
  rect(c, 0, 31, w, 4, H(0xf2efe6)); rect(c, 0, 35, w, 1, css(shade(o, 0.7)));
  tiny(c, "HOLT'S", 16, 39, H(0xf2efe6)); tiny(c, "ALES", 16, 46, H(0xf2efe6));
  rect(c, w - 14, 30, 4, 2, H(0x2a2a2c)); // handle
  rect(c, 0, h - 8, w, 8, css(shade(o, 0.72)));
  const gr = c.createLinearGradient(0, h - 26, 0, h); gr.addColorStop(0, "rgba(40,30,20,0)"); gr.addColorStop(1, "rgba(40,30,20,0.5)"); c.fillStyle = gr; c.fillRect(0, h - 26, w, 26); // road dirt
  const r = rng(5); for (let k = 0; k < 60; k++) rect(c, r.int(w), h - 1 - r.int(20), 1, 1, "rgba(60,44,30,0.5)");
}
/** Cab front, 2.3 m wide x 1.85 m: screen above (0.57 of the height), grille below. */
export function cabFront(c: Ctx, w: number, h: number) {
  const o = hex(ORANGE), sh = Math.round(h * 0.55);
  rect(c, 0, 0, w, h, css(o));
  rect(c, 3, 4, w - 6, sh - 7, H(0x16191e)); rect(c, 4, 5, w - 8, sh - 9, H(0x3b4957));
  c.fillStyle = "rgba(175,195,210,0.5)"; c.beginPath(); c.moveTo(4, sh - 4); c.lineTo(26, 5); c.lineTo(40, 5); c.lineTo(18, sh - 4); c.closePath(); c.fill();
  rect(c, w / 2, 5, 1, sh - 9, H(0x16191e));
  c.strokeStyle = H(0x16191e); c.beginPath(); c.moveTo(14, sh - 5); c.lineTo(30, sh - 14); c.moveTo(w - 14, sh - 5); c.lineTo(w - 30, sh - 14); c.stroke(); // wipers
  rect(c, 10, sh + 3, w - 20, 13, H(0x1c1c1e)); for (let y = sh + 4; y < sh + 15; y += 3) rect(c, 11, y, w - 22, 1, H(0x4a4c50));
  tiny(c, "HOLT", w / 2, sh + 6, H(0xdadada), 1, "center");
  for (const x of [3, w - 9]) { rect(c, x, sh + 5, 6, 6, H(0xf6f0d0)); rect(c, x, sh + 12, 6, 3, H(0xf0a020)); }
  rect(c, 0, h - 9, w, 9, H(0x2a2b2e)); rect(c, w / 2 - 11, h - 8, 22, 6, H(0xf2d21e)); tiny(c, "D4 AYS", w / 2, h - 7, H(0x141414), 1, "center");
}
/** Dropside, 64 px/m. */
export function draySide(c: Ctx, w: number, h: number) {
  const o = hex(ORANGE);
  rect(c, 0, 0, w, h, css(shade(o, 0.95)));
  for (let x = 0; x < w; x += 86) { rect(c, x, 0, 3, h, css(shade(o, 0.6))); rect(c, x + 3, 0, 1, h, css(shade(o, 1.25))); }
  rect(c, 0, 0, w, 2, css(shade(o, 1.3))); rect(c, 0, h - 2, w, 2, css(shade(o, 0.6)));
  pixText(c, "HOLT & SON · FINE ALES", w / 2, h / 2 + 7, 13, H(0xfaf4e4), { font: FONTS.serif, weight: 700, align: "center", maxW: w - 20, shadow: "rgba(90,30,0,0.8)" });
  const r = rng(3); for (let k = 0; k < 90; k++) rect(c, r.int(w), h - 1 - r.int(8), 2, 1, "rgba(60,40,24,0.45)");
}
export function wheel(c: Ctx, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = w / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > R) continue; rect(c, x, y, 1, 1, d > R - 1 ? H(0x101012) : d > R * 0.55 ? H(0x232428) : d > R * 0.45 ? H(0x8b9096) : d > R * 0.18 ? H(0xb9bec4) : H(0x4a4d52)); }
  rect(c, cx - R * 0.6, 2, R * 1.2, 1, H(0x3a3c42));
}
export function deckTop(c: Ctx, w: number, h: number) {
  const r = rng(21);
  rect(c, 0, 0, w, h, H(0x6b5a48));
  for (let y = 0; y < h; y += 6) { rect(c, 0, y, w, 5, css(shade(hex(0x75624e), 0.9 + r() * 0.2))); rect(c, 0, y + 5, w, 1, H(0x3a3028)); }
  for (let k = 0; k < 60; k++) rect(c, r.int(w), r.int(h), 2 + r.int(8), 1, "rgba(30,24,20,0.35)");
  for (let k = 0; k < 5; k++) { c.fillStyle = "rgba(24,20,18,0.35)"; c.beginPath(); c.ellipse(r.int(w), r.int(h), 5 + r.int(8), 3 + r.int(5), 0, 0, 7); c.fill(); }
}
export function cabTop(c: Ctx, w: number, h: number) {
  const o = hex(ORANGE), r = rng(31);
  rect(c, 0, 0, w, h, css(shade(o, 1.04))); c.strokeStyle = css(shade(o, 0.7)); c.strokeRect(2.5, 2.5, w - 5, h - 5);
  for (let x = 8; x < w - 6; x += 9) rect(c, x, 5, 1, h - 10, css(shade(o, 0.86)));
  for (let k = 0; k < 50; k++) rect(c, r.int(w), r.int(h), 1 + r.int(2), 1, "rgba(60,40,30,0.3)");
  rect(c, 6, 6, 9, 5, "rgba(240,240,236,0.8)"); // a seagull has been
}

// ---------------------------------------------------------------------------------------------
// Props.

export function kegSide(c: Ctx, w: number, h: number) {
  for (let x = 0; x < w; x++) { // a cylinder's worth of light
    const t = x / w, k = 0.78 + 0.3 * Math.max(0, Math.cos((t - 0.3) * Math.PI * 2)) ** 2 - 0.12 * Math.max(0, Math.cos((t - 0.8) * Math.PI * 2));
    rect(c, x, 0, 1, h, css(shade(hex(0xa9afb6), k)));
  }
  for (const y of [0, h - 3]) { rect(c, 0, y, w, 3, "rgba(40,44,50,0.55)"); rect(c, 0, y + (y ? 0 : 2), w, 1, "rgba(230,236,242,0.6)"); }
  for (const y of [Math.round(h * 0.34), Math.round(h * 0.62)]) { rect(c, 0, y, w, 1, "rgba(236,240,244,0.75)"); rect(c, 0, y + 1, w, 1, "rgba(50,54,60,0.6)"); }
  rect(c, 0, Math.round(h * 0.44), w, 3, H(0xc23a2a));
  const r = rng(8); for (let k = 0; k < 30; k++) rect(c, r.int(w), r.int(h), 1, 1 + r.int(2), "rgba(60,64,70,0.4)");
}
export function kegTop(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0x7c828a));
  c.fillStyle = H(0xc6ccd2); c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 7); c.fill();
  c.fillStyle = H(0x878d95); c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
  c.fillStyle = H(0x9ba1a9); c.beginPath(); c.arc(w / 2 - 1, h / 2 - 1, w / 2 - 4, 0, 7); c.fill();
  rect(c, w / 2 - 1, h / 2 - 1, 3, 3, H(0x3a3d42)); rect(c, w / 2 - 1, h / 2 - 1, 1, 1, H(0xd8dce0));
}
export function phoneBox(c: Ctx, w: number, h: number) {
  const red = hex(0xb5241c);
  rect(c, 0, 0, w, h, css(red));
  rect(c, 0, 0, 2, h, css(shade(red, 1.25))); rect(c, w - 2, 0, 2, h, css(shade(red, 0.65)));
  rect(c, 3, 3, w - 6, 8, H(0xf4eed8)); tiny(c, "PHONE", w / 2, 5, H(0x1a1a1a), 1, "center"); // the lit transom
  const cols = 3, rows = 7, gx = 5, gy = 14, gw = w - 10, gh = h - 14 - 14, cw = gw / cols, ch = gh / rows;
  rect(c, gx - 1, gy - 1, gw + 2, gh + 2, css(shade(red, 0.6)));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = Math.round(gx + i * cw), y = Math.round(gy + j * ch), ww = Math.round(gx + (i + 1) * cw) - x - 1, hh = Math.round(gy + (j + 1) * ch) - y - 1;
    rect(c, x, y, ww, hh, H(j < 2 ? 0x56615f : 0x2c3438)); if ((i + j) % 3 === 0) rect(c, x, y, ww, 1, "rgba(190,206,214,0.5)");
  }
  rect(c, gx + Math.round(cw) + 1, gy + Math.round(ch * 2), Math.round(cw) - 2, Math.round(ch * 2), H(0x16181a)); // the phone itself
  rect(c, gx + 2, gy + Math.round(ch * 3.2), 7, 9, H(0xf2e6ee)); rect(c, gx + 3, gy + Math.round(ch * 3.2) + 2, 5, 1, H(0xd24a8a)); // a card in the window
  rect(c, 0, h - 12, w, 12, css(shade(red, 0.55))); rect(c, 0, h - 12, w, 1, css(shade(red, 1.2)));
  const gr = c.createLinearGradient(0, h - 30, 0, h); gr.addColorStop(0, "rgba(20,16,12,0)"); gr.addColorStop(1, "rgba(20,16,12,0.45)"); c.fillStyle = gr; c.fillRect(0, h - 30, w, 30);
}
export function binSide(c: Ctx, w: number, h: number, col: number, label: string) {
  const b = hex(col);
  rect(c, 0, 0, w, h, css(b)); rect(c, 0, 0, w, 5, css(shade(b, 1.2))); rect(c, 0, 5, w, 1, css(shade(b, 0.5)));
  for (let x = 4; x < w - 2; x += 5) rect(c, x, 9, 1, h - 16, css(shade(b, 0.82)));
  rect(c, 0, 0, 1, h, css(shade(b, 1.3))); rect(c, w - 1, 0, 1, h, css(shade(b, 0.6)));
  tiny(c, label, w / 2, 14, "rgba(240,240,232,0.9)", 1, "center");
  const gr = c.createLinearGradient(0, h - 14, 0, h); gr.addColorStop(0, "rgba(10,10,8,0)"); gr.addColorStop(1, "rgba(10,10,8,0.5)"); c.fillStyle = gr; c.fillRect(0, h - 14, w, 14);
}
export function crateSide(c: Ctx, w: number, h: number, col: number) {
  const b = hex(col);
  rect(c, 0, 0, w, h, css(shade(b, 0.55)));
  bevel(c, 0, 0, w, 4, b); bevel(c, 0, h - 4, w, 4, shade(b, 0.9));
  for (let x = 0; x < w; x += 4) rect(c, x, 4, 2, h - 8, css(shade(b, 0.95)));
  rect(c, 3, 1, w - 6, 2, css(shade(b, 0.45)));
}
export function crateTop(c: Ctx, w: number, h: number, col: number) {
  rect(c, 0, 0, w, h, css(shade(hex(col), 0.5)));
  c.strokeStyle = H(col); c.strokeRect(0.5, 0.5, w - 1, h - 1);
  for (let y = 2; y < h - 2; y += 3) for (let x = 2; x < w - 2; x += 3) { rect(c, x, y, 2, 2, H(0x3a2a18)); rect(c, x, y, 1, 1, H(0xd9b84a)); } // bottle tops
}
export function woodTop(c: Ctx, w: number, h: number, seed: number, base = 0x8a6a48) {
  const r = rng(seed), b = hex(base);
  for (let y = 0; y < h; y += 5) { const col = shade(b, 0.88 + r() * 0.22); rect(c, 0, y, w, 4, css(col)); rect(c, 0, y + 4, w, 1, css(shade(b, 0.5))); for (let k = 0; k < w / 10; k++) rect(c, r.int(w), y + 1 + r.int(3), 3 + r.int(6), 1, css(shade(col, 0.82))); }
  for (let k = 0; k < 3; k++) { const x = 4 + r.int(Math.max(1, w - 8)), y = 2 + r.int(Math.max(1, h - 5)); c.strokeStyle = "rgba(40,28,18,0.45)"; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.stroke(); } // pint rings
}
/** Flowers for the hanging baskets (cut-out). */
export function flowers(c: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed);
  c.clearRect(0, 0, w, h);
  for (let k = 0; k < 150; k++) { // foliage, bushing out at the top and trailing below
    const a = r() * Math.PI * 2, d = Math.sqrt(r()), x = w / 2 + Math.cos(a) * d * w * 0.46, y = h * 0.4 + Math.sin(a) * d * h * 0.36 + (r() < 0.3 ? r() * h * 0.3 : 0);
    rect(c, x, y, 2, 2, H(r.pick([0x3f6a34, 0x2f5a2c, 0x4f7a3a, 0x27482a])));
  }
  for (let k = 0; k < 26; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()), x = w / 2 + Math.cos(a) * d * w * 0.42, y = h * 0.38 + Math.sin(a) * d * h * 0.32; const col = r.pick([0xe0487a, 0xf06a9a, 0xd8322a, 0xf2e6ee, 0x8a4ac8, 0xf2b01e]); rect(c, x, y, 2, 2, H(col)); rect(c, x, y, 1, 1, css(shade(hex(col), 1.3))); }
}
export function bunting(c: Ctx, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  rect(c, 0, 0, w, 1, H(0xe8e4d8));
  const n = 4, pw = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = Math.round(i * pw) + 1, ww = Math.round(pw) - 2;
    for (let y = 0; y < h - 1; y++) { const inset = Math.floor((y / (h - 1)) * (ww / 2)); const lw = ww - inset * 2; if (lw <= 0) break; rect(c, x0 + inset, 1 + y, lw, 1, H(0xf2efe6)); if (i % 2 === 0) { rect(c, x0 + Math.floor(ww / 2) - 1, 1 + y, Math.min(2, lw), 1, H(0xc8281e)); if (y === 2 || y === 3) rect(c, x0 + inset, 1 + y, lw, 1, H(0xc8281e)); } else rect(c, x0 + inset, 1 + y, lw, 1, H(0xc8281e)); }
  }
}
export function englandFlag(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0xece8dc));
  rect(c, 0, Math.round(h / 2) - 3, w, 6, H(0xc4261e)); rect(c, Math.round(w / 2) - 3, 0, 6, h, H(0xc4261e));
  for (let x = 6; x < w; x += 11) rect(c, x, 0, 1, h, "rgba(60,56,50,0.14)"); // it has been in a drawer
  const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(40,36,30,0.22)"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
}
export function shirt(c: Ctx, w: number, h: number, num: string) {
  c.clearRect(0, 0, w, h);
  rect(c, 4, 0, w - 8, h, H(0xeeeae0)); rect(c, 0, 0, w, 7, H(0xeeeae0)); rect(c, 0, 6, 4, 1, H(0xb8b4aa)); rect(c, w - 4, 6, 4, 1, H(0xb8b4aa));
  rect(c, w / 2 - 3, 0, 6, 2, H(0x2a3a7a)); tiny(c, num, w / 2, 6, H(0xc4261e), 2, "center");
  rect(c, 4, h - 1, w - 8, 1, H(0xb8b4aa));
}
export function barrier(c: Ctx, w: number, h: number, sign: string | null) {
  c.clearRect(0, 0, w, h);
  const st = H(0xb6bcc2), sd = H(0x6e747a);
  rect(c, 0, 2, w, 2, st); rect(c, 0, 4, w, 1, sd); rect(c, 0, h - 9, w, 2, st); rect(c, 0, h - 7, w, 1, sd);
  rect(c, 0, 2, 2, h - 2, st); rect(c, w - 2, 2, 2, h - 2, st);
  for (let x = 6; x < w - 4; x += 5) { rect(c, x, 4, 1, h - 13, st); }
  rect(c, 2, h - 2, 9, 2, sd); rect(c, w - 11, h - 2, 9, 2, sd);
  if (sign) { const sw = sign.length * 4 + 7; rect(c, w / 2 - sw / 2 - 1, 7, sw + 2, 15, H(0x10244a)); rect(c, w / 2 - sw / 2, 8, sw, 13, H(0x1f4ea0)); tiny(c, sign, w / 2, 10, "#ffffff", 1, "center"); for (let x = 0; x < sw; x += 4) rect(c, w / 2 - sw / 2 + x, 17, 2, 3, x % 8 ? H(0xf2f2f2) : H(0x1f4ea0)); }
}
export function roadSign(c: Ctx, w: number, h: number) {
  rect(c, 0, 0, w, h, H(0xc4261e)); c.strokeStyle = "#f4f0e6"; c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4);
  pixText(c, "ROAD", w / 2, h * 0.46, 11, "#f8f4ea", { align: "center", maxW: w - 10 }); pixText(c, "CLOSED", w / 2, h * 0.88, 11, "#f8f4ea", { align: "center", maxW: w - 10 });
}
export function skipSide(c: Ctx, w: number, h: number) {
  const y = hex(0xe0b21c), r = rng(51);
  rect(c, 0, 0, w, h, css(y)); rect(c, 0, 0, w, 3, css(shade(y, 1.25))); rect(c, 0, 3, w, 1, css(shade(y, 0.6)));
  for (const x of [Math.round(w * 0.25), Math.round(w * 0.75)]) { rect(c, x, 4, 2, h, css(shade(y, 0.7))); rect(c, x + 2, 4, 1, h, css(shade(y, 1.2))); }
  pixText(c, "DOYLE SKIPS", w / 2, h * 0.62, 9, H(0x1a1a1a), { align: "center", maxW: w * 0.44 });
  for (let k = 0; k < 120; k++) rect(c, r.int(w), r.int(h), 1 + r.int(3), 1 + r.int(2), css(r.pick([hex(0x7a4a2a), hex(0x9a6a3a), shade(y, 0.7)]), 0.7));
}
export function rubble(c: Ctx, w: number, h: number) {
  const r = rng(61); rect(c, 0, 0, w, h, H(0x4a4640));
  for (let k = 0; k < 160; k++) { const col = r.pick([0x8a8478, 0x94503d, 0x6b665e, 0xb9b2a2, 0x5a3a2a, 0x7c7468, 0x8a8478, 0x6b665e, 0x7a5a40, r() < 0.2 ? 0x2a5a9a : 0x94503d]); const x = r.int(w), y = r.int(h), ww = 2 + r.int(7), hh = 2 + r.int(4); rect(c, x, y, ww, hh, H(col)); rect(c, x, y, ww, 1, css(shade(hex(col), 1.25))); }
  rect(c, 12, 6, 30, 3, H(0xc9c2aa)); rect(c, 40, 4, 3, 16, H(0xc9c2aa)); // somebody's old door frame
}
export function shed(c: Ctx, w: number, h: number) {
  const r = rng(71); for (let x = 0; x < w; x += 5) { rect(c, x, 0, 4, h, css(shade(hex(0x6a5a40), 0.85 + r() * 0.25))); rect(c, x + 4, 0, 1, h, H(0x2f281e)); }
  rect(c, w * 0.3, h * 0.25, w * 0.4, h * 0.75, "rgba(30,24,18,0.35)"); c.strokeStyle = H(0x2f281e); c.strokeRect(Math.round(w * 0.3) + 0.5, Math.round(h * 0.25) + 0.5, Math.round(w * 0.4), h);
  rect(c, w * 0.66, h * 0.55, 2, 3, H(0xb8923a));
}
export function postBox(c: Ctx, w: number, h: number) {
  for (let x = 0; x < w; x++) { const t = x / w, k = 0.7 + 0.45 * Math.max(0, Math.cos((t - 0.3) * Math.PI * 2)) ** 2; rect(c, x, 0, 1, h, css(shade(hex(0xb5241c), k))); }
  rect(c, 0, 0, w, 2, "rgba(0,0,0,0.3)"); rect(c, 0, h - 8, w, 8, H(0x1c1c1e));
  const fx = Math.round(w * 0.3); rect(c, fx - 6, 6, 12, 2, H(0x141414)); rect(c, fx - 5, 11, 10, 8, H(0xf0ead8)); for (let k = 0; k < 3; k++) rect(c, fx - 4, 13 + k * 2, 8, 1, H(0x505050));
  rect(c, fx - 2, 24, 4, 4, H(0xe2b64a));
}

// The ground map: the whole district painted from the layout's areas at the sprites' own density
// (32 px to the metre), in 16 m tiles made as the camera comes near. Every pattern is laid on the
// world's own grid and coloured by a hash of where it is, so tiles meet without a seam.
import { PITCH, HL, HW } from "../../football/config";
import type { Area } from "../../stadium/layout";
import { H, PXM, css, hex, makeCanvas, rng, shade, type Ctx, type RGB } from "./paint";

export const CHUNK_M = 16, CHUNK_PX = CHUNK_M * PXM;
const P = (m: number) => Math.round(m * PXM);

/** A number in [0, 1) from two integers and a seed. */
export function h2(ix: number, iy: number, seed = 0): number {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pick = <T,>(a: T[], k: number): T => a[Math.min(a.length - 1, Math.floor(k * a.length))];
const fill = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

export type Floor = "slabs" | "asphalt" | "tarmac" | "herringbone" | "grass" | "concourse" | "gravel" | "lino" | "office" | "rubber" | "quarry" | "boards" | "whitetile" | "seats" | "seats_red" | "pitch" | "plain";
export const FLOOR_OF: Record<string, Floor> = {
  street: "slabs", plaza: "slabs", road: "asphalt", eastroad: "asphalt", carpark: "tarmac", hotel_court: "slabs", ticket_office: "slabs", merch: "slabs",
  pub_yard: "herringbone", verge: "grass", concourse_s: "concourse", concourse_w: "concourse", concourse_e: "concourse", corner_sw: "concourse", corner_se: "concourse",
  corner_nw: "concourse", corner_ne: "concourse", loading: "gravel", staffway: "lino", players: "lino", tunnel: "lino", security: "office", ref_room: "lino",
  dress_home: "rubber", dress_away: "rubber", kitchen: "quarry", bar_s: "boards", toilet_s: "whitetile", cubicle_s: "whitetile", pub: "boards", pub_toilet: "whitetile",
  pub_cubicle: "whitetile", alley: "tarmac", kitroom: "rubber", medical: "whitetile", backcorr: "lino", cabin: "office", hotel: "office", charity: "boards", surplus: "lino", bookies: "office",
  pitch: "pitch", stand_s: "seats", stand_n: "seats", stand_w: "seats", stand_e: "seats_red",
};
/** Indoors however the layout flags it (the shops and the pub count as "outside the ground"). */
const ROOFED = new Set(["pub", "pub_toilet", "pub_cubicle", "cabin", "hotel", "charity", "surplus", "bookies"]);
export const isWet = (a: Area, fanZone: boolean) => !!a.outside && (!ROOFED.has(a.id) || (fanZone && a.id.startsWith("pub")));

const SLAB: RGB[] = [0x8a8780, 0x827f79, 0x918d84, 0x7b7872, 0x88827a].map(hex);
const PAVERS: RGB[] = [0x86655a, 0x7a5b50, 0x91705f, 0x6c5148, 0x9a7a68, 0x756a64, 0x80604c].map(hex);

/** Paint one kind of floor over a rectangle (world pixels; the context is already moved to the tile). */
function paintFloor(c: Ctx, kind: Floor, x0: number, y0: number, w: number, h: number, base: number, vertical: boolean): void {
  const x1 = x0 + w, y1 = y0 + h;
  switch (kind) {
    case "slabs": {
      const fw = 28, fh = 19;
      fill(c, x0, y0, w, h, H(0x55534f));
      for (let j = Math.floor(y0 / fh); j * fh < y1; j++) {
        const off = j & 1 ? fw / 2 : 0;
        for (let i = Math.floor((x0 - off) / fw); i * fw + off < x1; i++) {
          const col = shade(pick(SLAB, h2(i, j, 1)), 0.94 + h2(i, j, 2) * 0.1), bx = i * fw + off, by = j * fh;
          fill(c, bx, by, fw - 1, fh - 1, css(col)); fill(c, bx, by, fw - 1, 1, css(shade(col, 1.1)));
          if (h2(i, j, 3) < 0.14) { let cx = bx + 3 + Math.floor(h2(i, j, 4) * (fw - 8)); for (let k = 0; k < fh - 1; k++) { fill(c, cx, by + k, 1, 1, H(0x4e4c49)); const q = h2(i * 31 + k, j, 5); if (q < 0.2) cx++; else if (q < 0.4) cx--; } }
          if (h2(i, j, 6) < 0.3) fill(c, bx + Math.floor(h2(i, j, 7) * (fw - 2)), by + Math.floor(h2(i, j, 8) * (fh - 2)), 1, 1, h2(i, j, 9) < 0.6 ? H(0xb9b6ad) : H(0x4a4845));
        }
      }
      break;
    }
    case "asphalt": case "tarmac": case "gravel": case "concourse": {
      const b = hex(kind === "asphalt" ? 0x43464d : kind === "tarmac" ? 0x393b40 : kind === "gravel" ? 0x6b665c : 0x7d7f80), cell = 96;
      fill(c, x0, y0, w, h, css(b));
      for (let j = Math.floor(y0 / cell) - 1; j * cell < y1; j++) for (let i = Math.floor(x0 / cell) - 1; i * cell < x1; i++) {
        if (h2(i, j, 11) < 0.55) { // a repair patch, or a stain on the concrete
          const pw = 30 + Math.floor(h2(i, j, 12) * 90), ph = 14 + Math.floor(h2(i, j, 13) * 40), px = i * cell + Math.floor(h2(i, j, 14) * cell), py = j * cell + Math.floor(h2(i, j, 15) * cell), col = shade(b, h2(i, j, 16) < 0.5 ? 0.88 : 1.08);
          if (kind === "concourse" || kind === "gravel") { c.fillStyle = css(shade(b, 0.8), 0.35); c.beginPath(); c.ellipse(px, py, pw / 2, ph / 2, h2(i, j, 17), 0, 7); c.fill(); }
          else { fill(c, px, py, pw, ph, css(col)); c.strokeStyle = css(shade(b, 0.72)); c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1); }
        }
      }
      const g = kind === "gravel" ? 4 : 8, amt = kind === "gravel" ? 0.8 : 0.5;
      for (let j = Math.floor(y0 / g); j * g < y1; j++) for (let i = Math.floor(x0 / g); i * g < x1; i++) {
        const q = h2(i, j, 18);
        if (q < amt) fill(c, i * g + Math.floor(h2(i, j, 19) * g), j * g + Math.floor(h2(i, j, 20) * g), 1, 1, css(shade(b, q < amt * 0.6 ? 1.3 : 0.7)));
      }
      if (kind === "concourse") { // expansion joints every four metres
        for (let x = Math.ceil(x0 / 128) * 128; x < x1; x += 128) { fill(c, x, y0, 1, h, H(0x55585a)); fill(c, x + 1, y0, 1, h, H(0x8e9092)); }
        for (let y = Math.ceil(y0 / 128) * 128; y < y1; y += 128) { fill(c, x0, y, w, 1, H(0x55585a)); fill(c, x0, y + 1, w, 1, H(0x8e9092)); }
      }
      break;
    }
    case "herringbone": {
      fill(c, x0, y0, w, h, H(0x4c3d38));
      for (let gy = Math.floor(y0 / 4) - 2; gy * 4 < y1; gy++) for (let gx = Math.floor(x0 / 4) - 2; gx * 4 < x1; gx++) {
        const d = (((gx - gy) % 4) + 4) % 4;
        if (d !== 0 && d !== 3) continue;
        const col = shade(pick(PAVERS, h2(gx, gy, 21)), 0.9 + h2(gx, gy, 22) * 0.2), bw = d === 0 ? 8 : 4, bh = d === 0 ? 4 : 8;
        fill(c, gx * 4, gy * 4, bw - 1, bh - 1, css(col));
        if (h2(gx, gy, 23) < 0.25) fill(c, gx * 4, gy * 4, bw - 1, 1, css(shade(col, 1.14)));
      }
      break;
    }
    case "grass": case "pitch": {
      const sw = P(PITCH.L / 12);
      if (kind === "pitch") for (let i = Math.floor((x0 + P(HL)) / sw); i * sw - P(HL) < x1; i++) fill(c, i * sw - P(HL), y0, sw, h, i % 2 ? H(0x3b8a45) : H(0x34803f));
      else fill(c, x0, y0, w, h, H(0x356f3c));
      const tones = kind === "pitch" ? [0x44964e, 0x2f7739, 0x3f8f4a] : [0x447d44, 0x2c5f33, 0x4d8648, 0x5a6a3a];
      for (let j = Math.floor(y0 / 3); j * 3 < y1; j++) for (let i = Math.floor(x0 / 3); i * 3 < x1; i++) {
        const q = h2(i, j, 24);
        if (q < (kind === "pitch" ? 0.3 : 0.5)) fill(c, i * 3 + Math.floor(h2(i, j, 25) * 3), j * 3 + Math.floor(h2(i, j, 26) * 3), 1, 1 + (q < 0.1 ? 1 : 0), H(pick(tones, h2(i, j, 27))));
      }
      if (kind === "grass") for (let j = Math.floor(y0 / 80) - 1; j * 80 < y1; j++) for (let i = Math.floor(x0 / 80) - 1; i * 80 < x1; i++) if (h2(i, j, 28) < 0.5) { // worn patches
        c.fillStyle = h2(i, j, 29) < 0.5 ? "rgba(104,88,60,0.3)" : "rgba(40,70,40,0.35)"; c.beginPath(); c.ellipse(i * 80 + h2(i, j, 30) * 80, j * 80 + h2(i, j, 31) * 80, 10 + h2(i, j, 32) * 26, 5 + h2(i, j, 33) * 10, 0, 0, 7); c.fill();
      }
      break;
    }
    case "boards": {
      const b = hex(0x7a5a3c), bw = 6;
      fill(c, x0, y0, w, h, css(shade(b, 0.55)));
      for (let j = Math.floor(y0 / bw); j * bw < y1; j++) {
        const len = 64, off = Math.floor(h2(j, 0, 34) * len);
        for (let i = Math.floor((x0 - off) / len) - 1; i * len + off < x1; i++) {
          const col = shade(b, 0.82 + h2(i, j, 35) * 0.34);
          fill(c, i * len + off, j * bw, len - 1, bw - 1, css(col)); fill(c, i * len + off, j * bw, len - 1, 1, css(shade(col, 1.12)));
        }
      }
      break;
    }
    case "quarry": case "whitetile": case "office": case "lino": case "rubber": case "plain": {
      const b = hex(kind === "quarry" ? 0x8a4a38 : kind === "whitetile" ? 0xcfd6d8 : base), t = kind === "quarry" ? 12 : kind === "whitetile" ? 8 : kind === "office" ? 16 : kind === "lino" ? 32 : kind === "rubber" ? 8 : 64;
      const bb = kind === "office" || kind === "lino" || kind === "rubber" || kind === "plain" ? shade(b, 1.35) : b;
      fill(c, x0, y0, w, h, css(shade(bb, kind === "whitetile" ? 0.7 : 0.72)));
      for (let j = Math.floor(y0 / t); j * t < y1; j++) for (let i = Math.floor(x0 / t); i * t < x1; i++) {
        const k = kind === "office" ? ((i + j) & 1 ? 0.94 : 1.04) : 0.93 + h2(i, j, 36) * 0.14, col = shade(bb, k);
        if (kind === "rubber") { fill(c, i * t, j * t, t, t, css(col)); fill(c, i * t + 3, j * t + 3, 2, 2, css(shade(bb, 1.18))); fill(c, i * t + 3, j * t + 5, 2, 1, css(shade(bb, 0.7))); }
        else { fill(c, i * t, j * t, t - 1, t - 1, css(col)); if (kind !== "office") fill(c, i * t, j * t, t - 1, 1, css(shade(col, 1.1))); }
        if (kind === "lino" && h2(i, j, 37) < 0.35) { c.fillStyle = "rgba(20,22,26,0.18)"; c.fillRect(i * t + Math.floor(h2(i, j, 38) * 20), j * t + Math.floor(h2(i, j, 39) * 26), 8 + Math.floor(h2(i, j, 40) * 12), 2); }
      }
      break;
    }
    case "seats": case "seats_red": {
      // Terracing: a concrete tread and a row of tip-up seats on each step, every 1.1 m (0.9 m apart).
      const seat = hex(kind === "seats_red" ? 0xa8323a : 0x2c4a9a), row = P(1.1), gap = P(0.9);
      fill(c, x0, y0, w, h, H(0x5a5e66));
      if (!vertical) for (let j = Math.floor(y0 / row) - 1; j * row < y1; j++) {
        const y = j * row + 12; fill(c, x0, y - 12, w, 2, H(0x3e4148)); fill(c, x0, y - 10, w, 1, H(0x7c8088));
        for (let i = Math.floor(x0 / gap) - 1; i * gap < x1; i++) { const col = shade(seat, 0.86 + h2(i, j, 41) * 0.26); fill(c, i * gap + 4, y, gap - 8, 9, css(col)); fill(c, i * gap + 4, y, gap - 8, 2, css(shade(col, 1.3))); fill(c, i * gap + 4, y + 9, gap - 8, 3, css(shade(col, 0.6))); }
      } else for (let i = Math.floor(x0 / row) - 1; i * row < x1; i++) {
        const x = i * row + 12; fill(c, x - 12, y0, 2, h, H(0x3e4148)); fill(c, x - 10, y0, 1, h, H(0x7c8088));
        for (let j = Math.floor(y0 / gap) - 1; j * gap < y1; j++) { const col = shade(seat, 0.86 + h2(i, j, 42) * 0.26); fill(c, x, j * gap + 4, 9, gap - 8, css(col)); fill(c, x, j * gap + 4, 9, 2, css(shade(col, 1.3))); fill(c, x + 9, j * gap + 4, 3, gap - 8, css(shade(col, 0.6))); }
      }
      break;
    }
  }
}

/** An irregular puddle of sky. */
function puddle(c: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number) {
  const r = rng(seed), sky = hex(0x8697a6), n = 9, pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.65 + r() * 0.5; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  const path = () => { c.beginPath(); pts.forEach((p, i) => { const q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (i === 0) c.moveTo(mx, my); else c.quadraticCurveTo(p[0], p[1], mx, my); }); c.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2); c.closePath(); };
  c.save();
  path(); c.fillStyle = "rgba(16,18,22,0.55)"; c.fill();
  c.translate(0, -1); path(); c.clip();
  const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, css(shade(sky, 1.12), 0.9)); g.addColorStop(1, css(shade(sky, 0.72), 0.9));
  c.fillStyle = g; c.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);
  for (let k = 0; k < Math.max(1, (rx * ry) / 60); k++) { const px = Math.round(cx + (r() - 0.5) * rx * 1.4), py = Math.round(cy + (r() - 0.5) * ry * 1.2); fill(c, px - 1, py, 3, 1, css(shade(sky, 1.35), 0.8)); fill(c, px, py - 1, 1, 1, css(shade(sky, 1.35), 0.6)); }
  c.restore();
}

/** The wet: sky lying on the ground in long pale smears leaning the way the camera looks, and puddles. */
function wet(c: Ctx, x0: number, y0: number, w: number, h: number, lean: number, puddles: number) {
  const x1 = x0 + w, y1 = y0 + h, cell = 192;
  c.save(); c.globalCompositeOperation = "lighter";
  for (let j = Math.floor(y0 / cell) - 2; j * cell < y1; j++) for (let i = Math.floor(x0 / cell) - 1; i * cell < x1 + cell; i++) for (let k = 0; k < 3; k++) {
    const x = i * cell + h2(i, j, 50 + k) * cell, y = j * cell + h2(i, j, 53 + k) * cell, len = 50 + h2(i, j, 56 + k) * 170, ww = 8 + h2(i, j, 59 + k) * 30, dx = len * lean;
    const gr = c.createLinearGradient(x, y, x + dx, y + len); gr.addColorStop(0, "rgba(120,140,160,0)"); gr.addColorStop(0.5, `rgba(120,140,160,${0.05 + h2(i, j, 62 + k) * 0.06})`); gr.addColorStop(1, "rgba(120,140,160,0)");
    c.fillStyle = gr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + ww, y); c.lineTo(x + ww + dx, y + len); c.lineTo(x + dx, y + len); c.closePath(); c.fill();
  }
  c.restore();
  const pc = 256;
  for (let j = Math.floor(y0 / pc) - 1; j * pc < y1 + pc; j++) for (let i = Math.floor(x0 / pc) - 1; i * pc < x1 + pc; i++) {
    if (h2(i, j, 70) > puddles) continue;
    puddle(c, i * pc + h2(i, j, 71) * pc, j * pc + h2(i, j, 72) * pc, 14 + h2(i, j, 73) * 34, 5 + h2(i, j, 74) * 9, (i * 7919 + j * 104729) | 0);
  }
}

export interface GroundSpec {
  areas: Area[];
  mirror: boolean; fanZone: boolean;
  /** Footprints that darken the ground round them: x0, y0, x1, y1, height. */
  ao: [number, number, number, number, number][];
  /** Light lying on the wet from a window or sign: x, y (its foot), width, length, colour, strength. */
  streaks: [number, number, number, number, number, number][];
  /** Extra paint (words on the tarmac and so on), drawn after the floors. */
  extras: ((c: Ctx, x0: number, y0: number, x1: number, y1: number) => void)[];
  lean: number;
}

const clipTo = (c: Ctx, x: number, y: number, w: number, h: number) => { c.beginPath(); c.rect(x, y, w, h); c.clip(); };

/** The road furniture: kerbs, double yellows, zebra crossings, the centre line, car-park bays. */
function roads(c: Ctx, sp: GroundSpec) {
  const mx = (x: number) => (sp.mirror ? -x : x), R = (x: number, y: number, w: number, h: number, col: string) => fill(c, P(Math.min(mx(x), mx(x + w))), P(y), Math.max(1, P(w)), Math.max(1, P(h)), col);
  const crossings = [-46, 2, 36];
  // Kerb stones: a lit edge, then the drop.
  const stones = (x: number, y: number, len: number, along: "x" | "y") => {
    for (let k = 0; k < len; k += 0.9) {
      const col = css(shade(hex(0xa9a69e), 0.92 + h2(Math.round((x + (along === "x" ? k : 0)) * 10), Math.round((y + (along === "y" ? k : 0)) * 10), 80) * 0.14));
      if (along === "x") { R(x + k, y, 0.87, 0.16, col); R(x + k, y, 0.87, 0.03, H(0xc9c6bc)); } else { R(x, y + k, 0.16, 0.87, col); R(x, y + k, 0.03, 0.87, H(0xc9c6bc)); }
    }
  };
  stones(-92, 83.84, 184, "x"); stones(-92, 92, 184, "x"); stones(61.84, -50, 134, "y"); stones(72, -50, 134, "y");
  R(-92, 84, 184, 0.1, "rgba(16,16,20,0.5)"); R(-92, 91.9, 184, 0.1, "rgba(16,16,20,0.5)"); R(62, -50, 0.1, 134, "rgba(16,16,20,0.5)"); R(71.9, -50, 0.1, 134, "rgba(16,16,20,0.5)");
  // Double yellows, worn, broken at the crossings.
  for (const y of [84.3, 84.52, 91.38, 91.6]) for (let x = -92; x < 92; x += 0.1) { if (crossings.some((q) => Math.abs(q - x) < 2.6) || h2(Math.round(x * 10), Math.round(y * 100), 81) < 0.13) continue; R(x, y, 0.1, 0.1, h2(Math.round(x * 10), 3, 82) < 0.8 ? H(0xc7a22c) : H(0xa98a2c)); }
  for (const x of [62.3, 62.52, 71.38, 71.6]) for (let y = -48; y < 82; y += 0.1) { if (h2(Math.round(x * 100), Math.round(y * 10), 83) < 0.13) continue; R(x, y, 0.1, 0.1, H(0xc7a22c)); }
  // Centre lines.
  for (let x = -88; x < 90; x += 6) for (let k = 0; k < 3; k += 0.07) if (h2(Math.round((x + k) * 20), 1, 84) > 0.2 && crossings.every((q) => Math.abs(q - x - k) > 2.2)) R(x + k, 87.9, 0.07, 0.1, H(0xcfd0cc));
  for (let y = -46; y < 82; y += 6) for (let k = 0; k < 3; k += 0.07) if (h2(2, Math.round((y + k) * 20), 85) > 0.2) R(66.9, y + k, 0.1, 0.07, H(0xcfd0cc));
  // Zebra crossings.
  for (const cx of crossings) for (let y = 84.75; y < 91.3; y += 0.9) { R(cx - 1.8, y, 3.6, 0.5, "rgba(232,228,216,0.9)"); for (let k = 0; k < 30; k++) R(cx - 1.8 + h2(k, Math.round(y * 10), 86 + cx) * 3.5, y + h2(k, Math.round(y * 10), 87) * 0.45, 0.1, 0.04, "rgba(60,62,68,0.7)"); }
  // Drains in the gutter, and wheel-polished tracks.
  for (let x = -86; x < 90; x += 11) if (crossings.every((q) => Math.abs(q - x) > 3)) for (const [dx, dy] of [[x, 84.05], [x + 5, 91.6]]) { R(dx - 0.35, dy, 0.7, 0.3, H(0x141416)); for (let k = 0; k < 4; k++) R(dx - 0.3 + k * 0.17, dy + 0.04, 0.07, 0.22, H(0x5a5d62)); }
  for (const y of [86, 89.9]) { const gr = c.createLinearGradient(0, P(y - 0.5), 0, P(y + 0.5)); gr.addColorStop(0, "rgba(20,22,26,0)"); gr.addColorStop(0.5, "rgba(20,22,26,0.2)"); gr.addColorStop(1, "rgba(20,22,26,0)"); c.fillStyle = gr; c.fillRect(P(-92), P(y - 0.5), P(184), P(1)); }
  // Car-park bays, faded.
  for (let x = 46; x <= 60; x += 2.6) for (const y0 of [73.5, 78]) for (let k = 0; k < 4; k += 0.07) if (h2(Math.round(x * 10), Math.round((y0 + k) * 20), 88) > 0.25) R(x, y0 + k, 0.1, 0.07, "rgba(206,206,198,0.75)");
  // The plaza's edge, and the yellow line along the foot of the stand.
  R(-60, 59.9, 120, 0.16, H(0x9d9a92)); R(-56, 38.5, 112, 0.12, "rgba(217,185,42,0.85)");
}

function pitchLines(c: Ctx) {
  c.save(); c.strokeStyle = "rgba(238,244,238,0.92)"; c.lineWidth = 3; c.lineCap = "butt";
  const L = P(HL), W = P(HW);
  c.strokeRect(-L + 1.5, -W + 1.5, 2 * L - 3, 2 * W - 3);
  c.beginPath(); c.moveTo(0, -W); c.lineTo(0, W); c.stroke();
  c.beginPath(); c.arc(0, 0, P(PITCH.circleR), 0, 7); c.stroke();
  c.fillStyle = "rgba(238,244,238,0.92)"; c.fillRect(-2, -2, 5, 5);
  for (const s of [-1, 1]) {
    const gx = s * L;
    c.strokeRect(Math.min(gx, gx - s * P(PITCH.boxL)) + 1.5, -P(PITCH.boxW / 2), P(PITCH.boxL) - 3, P(PITCH.boxW));
    c.strokeRect(Math.min(gx, gx - s * P(PITCH.sixL)) + 1.5, -P(PITCH.sixW / 2), P(PITCH.sixL) - 3, P(PITCH.sixW));
    c.fillRect(gx - s * P(PITCH.penSpot) - 2, -2, 4, 4);
    c.beginPath(); c.arc(gx - s * P(PITCH.penSpot), 0, P(PITCH.circleR), s > 0 ? Math.PI - 0.92 : -0.92, s > 0 ? Math.PI + 0.92 : 0.92); c.stroke();
    for (const t of [-1, 1]) { c.beginPath(); c.arc(gx, t * W, P(0.9), 0, 7); c.stroke(); }
  }
  c.restore();
}

/** Paint the 16 m tile whose north-west corner is (cx, cy) tiles from the origin. */
export function paintChunk(sp: GroundSpec, cx: number, cy: number): HTMLCanvasElement {
  const [cv, c] = makeCanvas(CHUNK_PX, CHUNK_PX);
  const X0 = cx * CHUNK_PX, Y0 = cy * CHUNK_PX, X1 = X0 + CHUNK_PX, Y1 = Y0 + CHUNK_PX;
  c.translate(-X0, -Y0);
  // Beyond the map: dark tarmac.
  paintFloor(c, "tarmac", X0, Y0, CHUNK_PX, CHUNK_PX, 0, false);
  fill(c, X0, Y0, CHUNK_PX, CHUNK_PX, "rgba(10,11,14,0.35)");
  let road = false, pitch = false;
  for (const a of sp.areas) {
    const ax0 = Math.max(X0, P(a.x)), ay0 = Math.max(Y0, P(a.y)), ax1 = Math.min(X1, P(a.x + a.w)), ay1 = Math.min(Y1, P(a.y + a.h));
    if (ax1 <= ax0 || ay1 <= ay0) continue;
    let kind: Floor = FLOOR_OF[a.id] ?? "plain";
    if (sp.fanZone && a.id === "pub") kind = "grass"; else if (sp.fanZone && a.id.startsWith("pub_")) kind = "slabs";
    c.save(); clipTo(c, ax0, ay0, ax1 - ax0, ay1 - ay0);
    paintFloor(c, kind, ax0, ay0, ax1 - ax0, ay1 - ay0, a.floor, a.h > a.w);
    if (a.id === "alley") { // setts down the middle of the service alley
      const tones = [0x77736c, 0x6b6862, 0x827d74, 0x5e5c58, 0x74685e].map(hex), sx0 = P(a.x + a.w / 2 - 1.5), sx1 = P(a.x + a.w / 2 + 1.5);
      for (let j = Math.floor(ay0 / 5); j * 5 < ay1; j++) for (let x = sx0 - (j & 1 ? 3 : 0); x < sx1; x += 6) { const col = shade(pick(tones, h2(x, j, 90)), 0.9 + h2(x, j, 91) * 0.2); fill(c, x, j * 5, 5, 4, css(col)); }
    }
    if (isWet(a, sp.fanZone) && kind !== "grass") wet(c, ax0, ay0, ax1 - ax0, ay1 - ay0, sp.lean, kind === "asphalt" ? 0.55 : kind === "herringbone" ? 0.6 : 0.3);
    c.restore();
    if (a.id === "road" || a.id === "eastroad" || a.id === "carpark" || a.id === "plaza") road = true;
    if (a.id === "pitch") pitch = true;
  }
  if (road) roads(c, sp);
  if (pitch) pitchLines(c);
  for (const f of sp.extras) f(c, X0, Y0, X1, Y1);
  // Contact darkness round everything that stands on the ground.
  for (const [x0, y0, x1, y1, hgt] of sp.ao) {
    const blur = Math.min(18, 6 + hgt * 3);
    if (P(x1) + 24 < X0 || P(x0) - 24 > X1 || P(y1) + 24 < Y0 || P(y0) - 24 > Y1) continue;
    for (const [bl, al] of [[blur, 0.5], [4, 0.5]]) { c.save(); c.shadowColor = `rgba(10,10,16,${al})`; c.shadowBlur = bl; c.shadowOffsetX = 5000; c.shadowOffsetY = 0; c.fillStyle = "#000"; c.fillRect(P(x0) - 5000, P(y0), P(x1) - P(x0), P(y1) - P(y0)); c.restore(); }
  }
  // Windows and signs reflected in the wet.
  for (const [x, y, w, len, col, al] of sp.streaks) {
    if (P(x + w + len) < X0 || P(x) > X1 || P(y + len) < Y0 || P(y) > Y1) continue;
    const n = P(len), cc = hex(col), r = rng((x * 131 + y * 17) | 0);
    for (let k = 0; k < n; k++) { const t = k / n; if (r() < 0.18 + t * 0.5) continue; const inset = Math.round(t * P(w) * 0.25) + r.int(3); fill(c, P(x) + Math.round(k * sp.lean) + inset, P(y) + k, Math.max(1, P(w) - inset * 2 - r.int(4)), 1, css(cc, al * (1 - t) ** 1.4)); }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  // Grit.
  const img = c.getImageData(0, 0, CHUNK_PX, CHUNK_PX), d = img.data;
  for (let i = 0, y = 0; y < CHUNK_PX; y++) for (let x = 0; x < CHUNK_PX; x++, i += 4) { const n = (h2(X0 + x, Y0 + y, 99) - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  c.putImageData(img, 0, 0);
  return cv;
}

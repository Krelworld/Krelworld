// Vehicles as painted miniatures: the dray (or the caterers' box van), the team coach, the cars and
// cabs on the ring road, the police van, the parked cars and the bike. Each is a small merged mesh
// with its faces painted at 32 px to the metre on one sheet; the scene tells them every frame where
// they are, which way they point and whether the back is open. The kegs on the dray are instanced.
import * as THREE from "three";
import * as art from "./art";
import { STRETCH } from "./cam";
import { Builder, setYS, type FaceSpec, type V3 } from "./mesh";
import { Atlas, FONTS, H, css, grain, hex, pixText, rect, rng, shade, tiny, type Ctx, type RGB, type Region } from "./paint";

const col = (c: number, c2?: number) => ({ c, c2: c2 ?? c });
const DARK = 0x18181a;
export type CarKind = "taxi" | "van" | "hatch" | "redcar" | "policecar" | "parked0" | "parked1" | "parked2" | "policevan";
export const CAR_KINDS: CarKind[] = ["taxi", "van", "hatch", "redcar", "policecar", "parked0", "parked1", "parked2", "policevan"];

// ---------------------------------------------------------------------------------------------
// Paint.

/** Paint with the picture mirrored left to right (for the far side of something), then un-mirror. */
function mirrored(c: Ctx, w: number, on: boolean, fn: () => void) { if (!on) { fn(); return; } c.save(); c.translate(w, 0); c.scale(-1, 1); fn(); c.restore(); }
const glass = (c: Ctx, x: number, y: number, w: number, h: number, tint = 0x3b4957) => {
  rect(c, x, y, w, h, H(0x15181d)); rect(c, x + 1, y + 1, w - 2, h - 2, H(tint));
  if (w > 9 && h > 5) { c.fillStyle = "rgba(176,196,212,0.45)"; c.beginPath(); c.moveTo(x + 1, y + h - 1); c.lineTo(x + Math.min(w * 0.45, h * 1.1), y + 1); c.lineTo(x + Math.min(w * 0.45, h * 1.1) + Math.min(6, w * 0.2), y + 1); c.lineTo(x + Math.min(6, w * 0.2) + 1, y + h - 1); c.closePath(); c.fill(); }
};
const dirt = (c: Ctx, w: number, h: number, seed: number, amt = 0.4) => {
  const gr = c.createLinearGradient(0, h - Math.min(h, 12), 0, h); gr.addColorStop(0, "rgba(46,36,26,0)"); gr.addColorStop(1, `rgba(46,36,26,${amt})`); c.fillStyle = gr; c.fillRect(0, h - Math.min(h, 12), w, Math.min(h, 12));
  const r = rng(seed); for (let k = 0; k < w / 3; k++) rect(c, r.int(w), h - 1 - r.int(Math.min(h, 8)), 1, 1, "rgba(60,44,30,0.5)");
};

/** A lorry cab's side: door, window, a stripe and two lines of sign-writing. Front is to the right. */
function cabSide(c: Ctx, w: number, h: number, body: number, lines: [string, string], far: boolean) {
  const o = hex(body);
  mirrored(c, w, far, () => {
    rect(c, 0, 0, w, h, css(o)); rect(c, 0, 0, w, 2, css(shade(o, 1.3)));
    c.strokeStyle = css(shade(o, 0.62)); c.lineWidth = 1; c.strokeRect(12.5, 5.5, w - 22, h - 13);
    glass(c, 15, 8, w - 27, 20, 0x394653); rect(c, 22, 17, 7, 10, H(0x20242a));
    rect(c, 0, 31, w, 4, H(0xf2efe6)); rect(c, 0, 35, w, 1, css(shade(o, 0.7)));
    rect(c, w - 14, 30, 4, 2, H(0x2a2a2c));
    rect(c, 0, h - 8, w, 8, css(shade(o, 0.72)));
  });
  const ink = body > 0xc0c0c0 ? H(0x1c2a44) : H(0xf2efe6), tx = far ? w - 16 - Math.max(lines[0].length, lines[1].length) * 4 : 16;
  tiny(c, lines[0], tx, 39, ink); tiny(c, lines[1], tx, 46, ink);
  dirt(c, w, h, 5, 0.5);
}
function cabFront(c: Ctx, w: number, h: number, body: number, badge: string) {
  const o = hex(body), sh = Math.round(h * 0.55);
  rect(c, 0, 0, w, h, css(o));
  glass(c, 3, 4, w - 6, sh - 7); rect(c, w / 2, 5, 1, sh - 9, H(0x16191e));
  c.strokeStyle = H(0x16191e); c.lineWidth = 1; c.beginPath(); c.moveTo(14, sh - 5); c.lineTo(30, sh - 14); c.moveTo(w - 14, sh - 5); c.lineTo(w - 30, sh - 14); c.stroke();
  rect(c, 10, sh + 3, w - 20, 13, H(0x1c1c1e)); for (let y = sh + 4; y < sh + 15; y += 3) rect(c, 11, y, w - 22, 1, H(0x4a4c50));
  tiny(c, badge, Math.round(w / 2), sh + 6, H(0xdadada), 1, "center");
  for (const x of [3, w - 9]) { rect(c, x, sh + 5, 6, 6, H(0xf6f0d0)); rect(c, x, sh + 12, 6, 3, H(0xf0a020)); }
  rect(c, 0, h - 9, w, 9, H(0x2a2b2e)); rect(c, w / 2 - 11, h - 8, 22, 6, H(0xf2d21e)); tiny(c, "D4 AYS", Math.round(w / 2), h - 7, H(0x141414), 1, "center");
}
function cabTop(c: Ctx, w: number, h: number, body: number) {
  const o = hex(body), r = rng(31);
  rect(c, 0, 0, w, h, css(shade(o, 1.04))); c.strokeStyle = css(shade(o, 0.7)); c.lineWidth = 1; c.strokeRect(2.5, 2.5, w - 5, h - 5);
  for (let x = 8; x < w - 6; x += 9) rect(c, x, 5, 1, h - 10, css(shade(o, 0.86)));
  for (let k = 0; k < 50; k++) rect(c, r.int(w), r.int(h), 1 + r.int(2), 1, "rgba(60,40,30,0.3)");
  rect(c, 6, 6, 9, 5, "rgba(240,240,236,0.8)");
}
/** The dray's dropside, with the brewer's name along it. */
function dropside(c: Ctx, w: number, h: number, body: number, text: string) {
  const o = hex(body);
  rect(c, 0, 0, w, h, css(shade(o, 0.95)));
  for (let x = 0; x < w; x += 47) { rect(c, x, 0, 2, h, css(shade(o, 0.6))); rect(c, x + 2, 0, 1, h, css(shade(o, 1.25))); }
  rect(c, 0, 0, w, 1, css(shade(o, 1.3))); rect(c, 0, h - 1, w, 1, css(shade(o, 0.6)));
  pixText(c, text, w / 2, Math.round(h / 2 + 4), 7, H(0xfaf4e4), { font: FONTS.block, weight: 900, align: "center", maxW: w - 12, shadow: "rgba(90,30,0,0.85)" });
  const r = rng(3); for (let k = 0; k < 40; k++) rect(c, r.int(w), h - 1 - r.int(4), 2, 1, "rgba(60,40,24,0.45)");
}
/** A box body's side: plain panels, a stripe and a name. */
function boxSide(c: Ctx, w: number, h: number, body: number, stripe: number, title: string, sub: string, far: boolean, livery: "pie" | "police" | "tv" = "pie") {
  const o = hex(body), dark = (o[0] + o[1] + o[2]) / 3 < 110;
  rect(c, 0, 0, w, h, css(o)); rect(c, 0, 0, w, 2, css(shade(o, 1.15)));
  for (let x = 0; x < w; x += 35) rect(c, x, 2, 1, h - 2, css(shade(o, dark ? 1.18 : 0.86)));
  if (livery === "police") {
    battenburg(c, 0, h - 22, w, 12);
    for (const x of [w * 0.2, w * 0.62]) { rect(c, Math.round(x), 6, 22, 9, H(0x15181d)); for (let k = 1; k < 22; k += 3) rect(c, Math.round(x) + k, 7, 1, 7, H(0x6a747e)); }
  } else { rect(c, 0, h - 16, w, 5, H(stripe)); rect(c, 0, h - 11, w, 1, css(shade(hex(stripe), 0.6))); }
  pixText(c, title, w / 2, livery === "police" ? 32 : 26, livery === "police" ? 10 : 11, H(livery === "police" ? 0x15203a : dark ? 0xf4f1ea : stripe), { font: FONTS.block, weight: 900, align: "center", maxW: w - 16 });
  tiny(c, sub, Math.round(w / 2), livery === "police" ? 37 : 34, H(dark ? 0xc8d0dc : 0x3a3d44), 1, "center");
  const px = far ? 14 : w - 30;
  if (livery === "pie") {
    // a painted pie, steaming
    rect(c, px, 40, 16, 5, H(0xc98a3a)); rect(c, px + 1, 39, 14, 1, H(0xe2b060)); rect(c, px + 2, 45, 12, 1, H(0x8a5a22));
    for (const dx of [4, 8, 12]) { rect(c, px + dx, 35, 1, 2, "rgba(120,124,130,0.7)"); rect(c, px + dx + 1, 33, 1, 2, "rgba(120,124,130,0.5)"); }
  } else if (livery === "tv") {
    // a hatch of sockets with a cable hanging out of it, and the channel's eye
    rect(c, px - 2, 36, 20, 12, H(0x15181d)); for (let k = 0; k < 4; k++) rect(c, px + k * 5, 38, 3, 3, H(k % 2 ? 0xd7263d : 0xf2c94c)); rect(c, px + 6, 44, 2, h - 44, H(0x101012));
    c.fillStyle = H(stripe); c.beginPath(); c.arc(far ? w - 22 : 22, 26, 9, 0, 7); c.fill(); c.fillStyle = H(0xf4f1ea); c.beginPath(); c.arc(far ? w - 22 : 22, 26, 5, 0, 7); c.fill(); rect(c, (far ? w - 22 : 22) - 2, 24, 4, 4, H(0x15181d));
  }
  dirt(c, w, h, 9, 0.35);
}
function boxRear(c: Ctx, w: number, h: number, body: number, open: boolean) {
  const o = hex(body);
  rect(c, 0, 0, w, h, css(shade(o, 0.9)));
  if (open) {
    rect(c, 3, 3, w - 6, h - 6, H(0x0e0c0a)); rect(c, 3, h - 14, w - 6, 11, H(0x1a1612));
    for (const [x, y, ww, hh, cc] of [[8, h - 24, 14, 12, 0x6a5a3a], [24, h - 20, 12, 8, 0x4a4f58], [w - 30, h - 26, 16, 14, 0x5a4a30], [w - 46, h - 18, 12, 6, 0x3a4048]] as const) { rect(c, x, y, ww, hh, H(cc)); rect(c, x, y, ww, 1, "rgba(255,255,255,0.18)"); }
  } else {
    rect(c, 3, 3, w - 6, h - 6, css(shade(o, 0.82)));
    for (let y = 5; y < h - 6; y += 4) { rect(c, 4, y, w - 8, 1, css(shade(o, 1.06))); rect(c, 4, y + 1, w - 8, 1, css(shade(o, 0.66))); }
    rect(c, w / 2 - 5, h - 9, 10, 3, H(0x2a2b2e));
  }
  rect(c, 0, h - 3, w, 3, H(0x2a2b2e)); for (const x of [2, w - 7]) rect(c, x, h - 9, 5, 5, H(0xc8281e));
}
function boxTop(c: Ctx, w: number, h: number, body: number) {
  const o = hex(body), r = rng(77);
  rect(c, 0, 0, w, h, css(shade(o, 0.92)));
  for (let x = 0; x < w; x += 17) rect(c, x, 0, 1, h, css(shade(o, 0.76)));
  c.strokeStyle = css(shade(o, 0.68)); c.lineWidth = 1; c.strokeRect(1.5, 1.5, w - 3, h - 3);
  for (let k = 0; k < 6; k++) { c.fillStyle = "rgba(60,58,54,0.25)"; c.beginPath(); c.ellipse(r.int(w), r.int(h), 5 + r.int(10), 3 + r.int(5), 0, 0, 7); c.fill(); }
  for (let k = 0; k < 4; k++) rect(c, r.int(w), r.int(h), 4, 3, "rgba(238,238,232,0.75)");
}

/** The coach's side, 11 m by 2.7 m: a band of dark glass, the team's colours, its name. Front is to the right. */
function coachSide(c: Ctx, w: number, h: number, body: number, trim: number, name: string, far: boolean) {
  const o = hex(body), t = hex(trim), lum = (o[0] * 0.3 + o[1] * 0.59 + o[2] * 0.11) / 255;
  mirrored(c, w, far, () => {
    rect(c, 0, 0, w, h, css(o)); rect(c, 0, 0, w, 2, css(shade(o, 1.25)));
    // the glass: one long band, pillars, the driver's bigger pane at the front
    rect(c, 6, 7, w - 14, 30, H(0x101318));
    for (let x = 8, i = 0; x < w - 46; x += 41, i++) { glass(c, x, 8, 39, 28, i % 2 ? 0x34414e : 0x2c3945); rect(c, x + 8 + (i * 13) % 17, 22, 7, 14, "rgba(16,18,24,0.55)"); rect(c, x + 9 + (i * 13) % 17, 17, 5, 5, "rgba(16,18,24,0.55)"); }
    glass(c, w - 44, 8, 34, 34, 0x3b4957);
    // the swoosh and the skirt
    c.fillStyle = css(t); c.beginPath(); c.moveTo(0, 62); c.lineTo(w * 0.34, 62); c.lineTo(w * 0.52, 40); c.lineTo(w, 40); c.lineTo(w, 45); c.lineTo(w * 0.54, 45); c.lineTo(w * 0.36, 67); c.lineTo(0, 67); c.closePath(); c.fill();
    rect(c, 0, h - 17, w, 17, css(shade(o, 0.7))); rect(c, 0, h - 17, w, 1, css(shade(o, 0.5)));
    for (const x of [70, 118, 166, 214]) { c.strokeStyle = css(shade(o, 0.5)); c.lineWidth = 1; c.strokeRect(x + 0.5, h - 15.5, 44, 12); rect(c, x + 20, h - 6, 6, 1, H(0x1a1a1c)); }
    // wheel arches, the door, the lights
    for (const x of [48, w - 62]) { c.fillStyle = H(0x0c0c0e); c.beginPath(); c.arc(x, h, 16, Math.PI, 0); c.fill(); }
    c.strokeStyle = css(shade(o, 0.55)); c.strokeRect(w - 40.5, 44.5, 20, h - 48);
    rect(c, w - 4, h - 26, 4, 7, H(0xf6f0d0)); rect(c, w - 4, h - 18, 4, 3, H(0xf0a020)); rect(c, 0, h - 28, 3, 10, H(0xc8281e));
  });
  pixText(c, name.toUpperCase(), w * (far ? 0.72 : 0.28), 60, 9, lum > 0.6 ? css(shade(t, 0.9)) : H(0xfaf6ea), { font: FONTS.block, weight: 900, align: "center", maxW: w * 0.42, shadow: lum > 0.6 ? undefined : "rgba(0,0,0,0.45)" });
  dirt(c, w, h, 12, 0.3);
}
function coachFront(c: Ctx, w: number, h: number, body: number, trim: number, blind: string) {
  const o = hex(body);
  rect(c, 0, 0, w, h, css(o));
  rect(c, 14, 3, w - 28, 8, H(0x0c0c0e)); tiny(c, blind, Math.round(w / 2), 5, H(0xf2a81e), 1, "center");
  glass(c, 3, 12, w - 6, 40, 0x3b4957); rect(c, Math.round(w / 2), 13, 1, 38, H(0x15181d));
  c.strokeStyle = H(0x15181d); c.lineWidth = 1; c.beginPath(); c.moveTo(16, 50); c.lineTo(38, 34); c.moveTo(w - 16, 50); c.lineTo(w - 38, 34); c.stroke();
  rect(c, 0, 54, w, 4, H(trim));
  rect(c, 18, 61, w - 36, 10, H(0x1c1c1e)); for (let y = 62; y < 70; y += 3) rect(c, 19, y, w - 38, 1, H(0x4a4c50));
  for (const x of [4, w - 14]) { rect(c, x, 60, 10, 7, H(0xf6f0d0)); rect(c, x, 68, 10, 3, H(0xf0a020)); }
  rect(c, 0, h - 10, w, 10, H(0x25262a)); rect(c, w / 2 - 12, h - 8, 24, 6, H(0xf4f4f0)); tiny(c, "K0 DAY", Math.round(w / 2), h - 7, H(0x141414), 1, "center");
}
function coachRear(c: Ctx, w: number, h: number, body: number, trim: number, open: boolean) {
  const o = hex(body);
  rect(c, 0, 0, w, h, css(shade(o, 0.92)));
  glass(c, 6, 6, w - 12, 26, 0x2c3945);
  rect(c, 0, 36, w, 3, H(trim));
  if (open) {
    // the hold, open: bags and a kit skip in the dark
    rect(c, 5, 42, w - 10, h - 54, H(0x0c0a09));
    for (const [x, y, ww, hh, cc] of [[9, h - 26, 16, 12, 0x2a3a6a], [27, h - 22, 13, 8, 0x8a2a2a], [w - 34, h - 28, 22, 14, 0x3a3d44], [44, h - 20, 10, 6, 0xd8d4c8]] as const) { rect(c, x, y, ww, hh, H(cc)); rect(c, x, y, ww, 1, "rgba(255,255,255,0.2)"); }
  } else {
    c.strokeStyle = css(shade(o, 0.55)); c.lineWidth = 1; c.strokeRect(5.5, 42.5, w - 11, h - 55);
    for (let y = 46; y < 58; y += 3) rect(c, 22, y, w - 44, 1, css(shade(o, 0.6)));
    rect(c, w / 2 - 4, h - 16, 8, 2, H(0x1a1a1c));
  }
  for (const x of [3, w - 11]) { rect(c, x, 44, 8, 12, H(0xc8281e)); rect(c, x, 57, 8, 4, H(0xf0a020)); }
  rect(c, 0, h - 10, w, 10, H(0x25262a)); rect(c, w / 2 - 12, h - 8, 24, 6, H(0xf2d21e)); tiny(c, "K0 DAY", Math.round(w / 2), h - 7, H(0x141414), 1, "center");
}
function coachTop(c: Ctx, w: number, h: number, body: number, trim: number, short: string) {
  const o = hex(body), r = rng(41), lum = (o[0] * 0.3 + o[1] * 0.59 + o[2] * 0.11) / 255;
  rect(c, 0, 0, w, h, css(shade(o, 0.96)));
  c.strokeStyle = css(shade(o, 0.7)); c.lineWidth = 1; c.strokeRect(2.5, 2.5, w - 5, h - 5);
  for (let x = 44; x < w - 20; x += 44) rect(c, x, 4, 1, h - 8, css(shade(o, 0.84)));
  rect(c, 0, h / 2 - 9, w, 4, H(trim)); rect(c, 0, h / 2 + 5, w, 4, H(trim));
  for (const x of [96, 232]) { rect(c, x, h / 2 - 12, 26, 24, css(shade(o, 0.62))); rect(c, x + 2, h / 2 - 10, 22, 20, H(0x3a4450)); rect(c, x + 3, h / 2 - 9, 20, 1, "rgba(200,214,226,0.5)"); }
  // the big letters helicopters read
  c.save(); c.translate(w * 0.5, h / 2); pixText(c, short, 0, 5, 9, lum > 0.6 ? H(trim) : H(0xfaf6ea), { font: FONTS.block, weight: 900, align: "center" }); c.restore();
  for (let k = 0; k < 9; k++) { c.fillStyle = "rgba(50,48,44,0.22)"; c.beginPath(); c.ellipse(r.int(w), r.int(h), 6 + r.int(14), 3 + r.int(6), 0, 0, 7); c.fill(); }
  for (let k = 0; k < 5; k++) rect(c, r.int(w), r.int(h), 4, 3, "rgba(238,238,232,0.8)");
}

interface CarStyle { body: number; len: number; wid: number; sill: number; belt: number; roof: number; cab: [number, number]; rake: [number, number]; kind: "car" | "cab" | "van"; police?: boolean; text?: string; seed: number }
const CARS: Record<CarKind, CarStyle> = {
  hatch: { body: 0x3b6ea5, len: 4.0, wid: 1.72, sill: 0.24, belt: 0.86, roof: 1.42, cab: [-1.75, 0.62], rake: [0.22, 0.6], kind: "car", seed: 1 },
  redcar: { body: 0xb5261e, len: 4.3, wid: 1.74, sill: 0.24, belt: 0.84, roof: 1.38, cab: [-1.15, 0.7], rake: [0.5, 0.62], kind: "car", seed: 2 },
  taxi: { body: 0x1b1c20, len: 4.4, wid: 1.78, sill: 0.26, belt: 0.98, roof: 1.78, cab: [-1.9, 0.75], rake: [0.2, 0.42], kind: "cab", seed: 3 },
  van: { body: 0xe6e3da, len: 4.5, wid: 1.82, sill: 0.28, belt: 1.05, roof: 1.95, cab: [-2.2, 1.35], rake: [0.04, 0.5], kind: "van", text: "PARKES & SON", seed: 4 },
  policecar: { body: 0xeef0f0, len: 4.2, wid: 1.74, sill: 0.24, belt: 0.86, roof: 1.42, cab: [-1.5, 0.66], rake: [0.4, 0.6], kind: "car", police: true, seed: 5 },
  parked0: { body: 0x6c7480, len: 4.3, wid: 1.74, sill: 0.24, belt: 0.84, roof: 1.38, cab: [-1.15, 0.7], rake: [0.5, 0.62], kind: "car", seed: 6 },
  parked1: { body: 0x2f5d50, len: 4.0, wid: 1.72, sill: 0.24, belt: 0.86, roof: 1.42, cab: [-1.75, 0.62], rake: [0.22, 0.6], kind: "car", seed: 7 },
  parked2: { body: 0xc8c2b0, len: 4.3, wid: 1.74, sill: 0.24, belt: 0.84, roof: 1.38, cab: [-1.15, 0.7], rake: [0.5, 0.62], kind: "car", seed: 8 },
  policevan: { body: 0xeef0f0, len: 5.2, wid: 1.9, sill: 0.3, belt: 1.15, roof: 2.3, cab: [-2.55, 1.6], rake: [0.03, 0.55], kind: "van", police: true, text: "POLICE", seed: 9 },
};
const battenburg = (c: Ctx, x: number, y: number, w: number, h: number) => { const n = Math.max(2, Math.round(w / 10)), cw = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) rect(c, x + i * cw, y + (j * h) / 2, Math.ceil(cw), h / 2, (i + j) % 2 ? H(0x1f4fa8) : H(0xd9e021)); };
/** The lower body's side, sill to waistline. Front to the right. */
function carBody(c: Ctx, w: number, h: number, s: CarStyle, far: boolean, axles: [number, number], wheelR: number) {
  const o = hex(s.body);
  mirrored(c, w, far, () => {
    rect(c, 0, 0, w, h, css(o)); rect(c, 0, 0, w, 1, css(shade(o, 1.35))); rect(c, 0, 1, w, 1, css(shade(o, 1.12)));
    rect(c, 0, h - 3, w, 3, css(shade(o, 0.5)));
    for (const x of [w * 0.36, w * 0.62]) rect(c, Math.round(x), 2, 1, h - 5, css(shade(o, 0.6)));
    for (const x of [w * 0.42, w * 0.66]) rect(c, Math.round(x), 4, 4, 1, H(0x16181c));
    if (s.police) battenburg(c, Math.round(w * 0.16), Math.round(h * 0.3), Math.round(w * 0.62), Math.max(4, Math.round(h * 0.38)));
    for (const ax of axles) { c.fillStyle = H(0x0c0c0e); c.beginPath(); c.arc(ax, h + 2, wheelR + 2.5, Math.PI, 0); c.fill(); }
    rect(c, w - 4, 3, 4, 4, H(0xf6f0d0)); rect(c, w - 3, 8, 3, 2, H(0xf0a020)); rect(c, 0, 3, 3, 6, H(0xc8281e));
  });
  if (s.text && s.kind === "van" && !s.police) tiny(c, s.text, Math.round(w * (far ? 0.62 : 0.38)), Math.round(h * 0.35), H(0x1c2a44), 1, "center");
  if (s.police && s.kind === "car") tiny(c, "POLICE", Math.round(w * 0.47), 2, H(0x15203a), 1, "center");
  dirt(c, w, h, s.seed, 0.4);
}
/** The glasshouse (or a van's upper panel), waistline to roof, raked at each end; see-through outside the outline. */
function carCabin(c: Ctx, w: number, h: number, s: CarStyle, far: boolean) {
  const o = hex(s.body), rr = (s.rake[0] * 32), rf = (s.rake[1] * 32);
  c.clearRect(0, 0, w, h);
  mirrored(c, w, far, () => {
    c.fillStyle = css(o); c.beginPath(); c.moveTo(0, h); c.lineTo(rr, 0); c.lineTo(w - rf, 0); c.lineTo(w, h); c.closePath(); c.fill();
    rect(c, rr, 0, w - rr - rf, 1, css(shade(o, 1.3)));
    if (s.kind === "van") {
      // a panel van: glass only in the cab door
      const dx = Math.round(w - rf - 26);
      c.fillStyle = H(0x15181d); c.beginPath(); c.moveTo(dx, h - 3); c.lineTo(dx, 5); c.lineTo(w - rf - 2, 5); c.lineTo(w - 6, h - 3); c.closePath(); c.fill();
      c.fillStyle = H(0x3b4957); c.beginPath(); c.moveTo(dx + 1, h - 4); c.lineTo(dx + 1, 6); c.lineTo(w - rf - 3, 6); c.lineTo(w - 8, h - 4); c.closePath(); c.fill();
      c.fillStyle = "rgba(176,196,212,0.4)"; c.fillRect(dx + 3, 7, 5, h - 12);
      for (const x of [w * 0.3, w * 0.55]) rect(c, Math.round(x), 2, 1, h - 2, css(shade(o, 0.72)));
      if (s.police) { battenburg(c, 4, Math.round(h * 0.55), Math.round(dx - 8), Math.round(h * 0.36)); rect(c, 8, 6, Math.round(dx * 0.45), Math.round(h * 0.34), H(0x15181d)); for (let x = 9; x < 8 + dx * 0.45 - 1; x += 3) rect(c, x, 7, 1, Math.round(h * 0.34) - 2, H(0x56606a)); }
    } else {
      // side glass in a dark surround, split by the pillar
      const x0 = rr + 2, x1 = w - rf - 1;
      c.fillStyle = H(0x15181d); c.beginPath(); c.moveTo(x0 - rr * 0.72, h - 2); c.lineTo(x0, 2); c.lineTo(x1, 2); c.lineTo(x1 + rf * 0.74, h - 2); c.closePath(); c.fill();
      c.fillStyle = H(s.kind === "cab" ? 0x2a3038 : 0x3b4957); c.beginPath(); c.moveTo(x0 - rr * 0.6 + 1, h - 3); c.lineTo(x0 + 1, 3); c.lineTo(x1 - 1, 3); c.lineTo(x1 + rf * 0.62 - 1, h - 3); c.closePath(); c.fill();
      c.fillStyle = "rgba(176,196,212,0.42)"; c.beginPath(); c.moveTo(x0 + 4, h - 3); c.lineTo(x0 + 4 + h * 0.8, 3); c.lineTo(x0 + 9 + h * 0.8, 3); c.lineTo(x0 + 9, h - 3); c.closePath(); c.fill();
      rect(c, Math.round(w * 0.52), 2, 2, h - 2, css(o));
      if (s.kind === "cab") rect(c, Math.round(w * 0.26), 2, 2, h - 2, css(o));
      // a head in the driver's seat
      rect(c, Math.round(w * 0.64), Math.round(h * 0.42), 5, h, "rgba(18,20,26,0.75)"); rect(c, Math.round(w * 0.64) + 1, Math.round(h * 0.42) - 4, 4, 4, "rgba(18,20,26,0.75)");
    }
  });
  if (s.police && s.kind === "van") pixText(c, "POLICE", Math.round(w * (far ? 0.62 : 0.34)), Math.round(h * 0.5), 7, H(0x15203a), { font: FONTS.block, weight: 900, align: "center" });
}
function carNose(c: Ctx, w: number, h: number, s: CarStyle, rear: boolean) {
  const o = hex(s.body);
  rect(c, 0, 0, w, h, css(shade(o, rear ? 0.88 : 0.96))); rect(c, 0, 0, w, 1, css(shade(o, 1.3)));
  if (rear) { for (const x of [1, w - 9]) { rect(c, x, 2, 8, 5, H(0xc8281e)); rect(c, x + (x < 5 ? 6 : 0), 2, 2, 5, H(0xf0a020)); } rect(c, w / 2 - 9, h - 10, 18, 5, H(0xf2d21e)); }
  else { rect(c, 10, 3, w - 20, 6, H(0x1c1c1e)); for (let x = 12; x < w - 11; x += 3) rect(c, x, 4, 1, 4, H(0x4a4c50)); for (const x of [1, w - 9]) { rect(c, x, 2, 8, 5, H(0xf6f0d0)); rect(c, x + 1, 3, 3, 2, H(0xffffff)); } rect(c, w / 2 - 9, h - 10, 18, 5, H(0xf4f4f0)); }
  if (s.police) battenburg(c, 12, rear ? 8 : 10, w - 24, 4);
  rect(c, 0, h - 4, w, 4, H(0x25262a));
}
function carScreen(c: Ctx, w: number, h: number, s: CarStyle, rear: boolean) {
  const o = hex(s.body);
  rect(c, 0, 0, w, h, css(o)); glass(c, 2, 1, w - 4, h - 2, rear ? 0x2c3945 : 0x3b4957);
  if (!rear) { c.strokeStyle = H(0x15181d); c.lineWidth = 1; c.beginPath(); c.moveTo(8, h - 2); c.lineTo(20, h - 9); c.moveTo(w - 8, h - 2); c.lineTo(w - 20, h - 9); c.stroke(); }
  if (s.kind === "van" && rear) { rect(c, 0, 0, w, h, css(shade(o, 0.9))); rect(c, Math.round(w / 2), 0, 1, h, css(shade(o, 0.6))); for (const x of [6, w / 2 + 4]) glass(c, Math.round(x), 3, Math.round(w / 2 - 10), Math.round(h * 0.4), 0x2c3945); if (s.police) tiny(c, "POLICE", Math.round(w / 2), Math.round(h * 0.62), H(0x15203a), 1, "center"); }
}
function carRoof(c: Ctx, w: number, h: number, s: CarStyle) {
  const o = hex(s.body), r = rng(s.seed + 50);
  rect(c, 0, 0, w, h, css(shade(o, 1.06)));
  c.strokeStyle = css(shade(o, 0.72)); c.lineWidth = 1; c.strokeRect(1.5, 1.5, w - 3, h - 3);
  if (s.kind === "van") for (let x = 8; x < w - 4; x += 9) rect(c, x, 3, 1, h - 6, css(shade(o, 0.86)));
  rect(c, 3, 3, w - 6, 2, "rgba(255,255,255,0.22)");
  for (let k = 0; k < 14; k++) rect(c, r.int(w), r.int(h), 1 + r.int(2), 1, "rgba(40,40,44,0.25)");
}
function wheelSmall(c: Ctx, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = w / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > R) continue; rect(c, x, y, 1, 1, d > R - 1 ? H(0x101012) : d > R * 0.6 ? H(0x232428) : d > R * 0.3 ? H(0xaeb3b9) : H(0x4a4d52)); }
}
function bikeWheel(c: Ctx, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = w / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > R) continue;
    if (d > R - 2) rect(c, x, y, 1, 1, H(0x15161a));
    else if (d > R - 3) rect(c, x, y, 1, 1, H(0xa8aeb6));
    else if (d < 1.6) rect(c, x, y, 1, 1, H(0x7c828a));
    else if (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.75) rect(c, x, y, 1, 1, H(0x8a9098));
  }
}

// ---------------------------------------------------------------------------------------------
// The models. Local frame: x forward, y up, z to the offside-right; the scene turns each to its heading.

interface Model { geo: THREE.BufferGeometry; tris: number }
interface Live { mesh: THREE.Mesh; seen: number; kind: string }
const KEG_R = 0.215, KEG_H = 0.58;

export class Vehicles {
  group = new THREE.Group();
  private atlas = new Atlas(1024); private tex: THREE.CanvasTexture;
  private lit: THREE.MeshLambertMaterial; private dull: THREE.MeshLambertMaterial; private dent: THREE.MeshLambertMaterial; private wreck: THREE.MeshLambertMaterial;
  private white: Region;
  private models = new Map<string, Model>(); private live = new Map<string, Live>();
  private kegs: THREE.InstancedMesh; private kegN = 0; private kegSlots: V3[] = [];
  private coachRegs: { side: Region; sideN: Region; front: Region; rear: Region; rearOpen: Region; top: Region } | null = null; private coachKey = "";
  private frame = 0; private m4 = new THREE.Matrix4(); private m4b = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v3 = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private up = new THREE.Vector3(0, 1, 0);
  private delivery = "";
  tris = 0;

  constructor(maxAniso: number) {
    setYS(STRETCH);
    this.white = this.atlas.solid(0xffffff);
    const t = new THREE.CanvasTexture(this.atlas.canvas);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = Math.min(4, maxAniso); t.generateMipmaps = true;
    this.tex = t;
    const mk = (color: number) => new THREE.MeshLambertMaterial({ map: t, vertexColors: true, alphaTest: 0.5, shadowSide: THREE.DoubleSide, color });
    this.lit = mk(0xffffff); this.dull = mk(0x77777a); this.dent = mk(0xd0c8c0); this.wreck = mk(0x9a8f86);
    // The keg: one little drum, as many as the bed holds.
    const K = this.builder(), rKs = this.atlas.paint(44, 19, art.kegSide), rKt = this.atlas.paint(14, 14, art.kegTop);
    K.cyl(0, 0, KEG_H, 0, KEG_R, 10, rKs, rKt);
    this.kegs = new THREE.InstancedMesh(K.geometry(), this.lit, 64);
    this.kegs.castShadow = true; this.kegs.receiveShadow = true; this.kegs.frustumCulled = false; this.kegs.count = 0; this.kegs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.kegs.name = "kegs";
    const c = new THREE.Color(); for (let i = 0; i < 64; i++) { const g = 0.86 + ((i * 7919) % 13) / 90; this.kegs.setColorAt(i, c.setRGB(g, g, g * 1.02)); }
    this.group.add(this.kegs);
    for (const k of CAR_KINDS) this.car(k);
    this.bike(false); this.bike(true);
    t.needsUpdate = true;
  }
  private builder(): Builder { return new Builder(this.atlas.size, this.atlas.size, this.white); }
  /** A wheel: a drum on its side at (x, z), `r` in radius and `w` wide, its hub facing outward (the way `out` points along z). */
  private wheel(B: Builder, x: number, z: number, r: number, w: number, out: 1 | -1, hub: Region): void {
    B.xf(new THREE.Matrix4().makeRotationX((out * Math.PI) / 2).setPosition(x, r, z - (out * w) / 2));
    B.cyl(0, 0, w, 0, r, 12, col(0x141416, 0x26272b), hub);
    B.end();
  }
  private keep(name: string, b: Builder): Model { const m = { geo: b.geometry(), tris: b.tris }; this.models.set(name, m); return m; }

  // ---- The delivery lorry: the brewer's dray, or the caterers' box van ----
  private lorry(variant: "dray" | "box" | "horse" | "ob", open: boolean): Model {
    const name = `lorry-${variant}-${open ? 1 : 0}`, had = this.models.get(name);
    if (had) return had;
    const a = this.atlas, body = variant === "dray" ? art.ORANGE : variant === "ob" ? 0x27324c : variant === "horse" ? 0xeef0f0 : 0xe9e6dc, kx = 7 / 6.52, kz = 2.6 / 2.4;
    const cabText: [string, string] = variant === "dray" ? ["HOLT'S", "ALES"] : variant === "horse" ? ["POLICE", "HORSES"] : variant === "ob" ? ["SPORTS", "VIEW"] : ["MATCHDAY", "CATERING"];
    const side = (far: boolean) => (c: Ctx, w: number, h: number) => (variant === "horse" ? boxSide(c, w, h, body, 0x1f4fa8, "POLICE", "MOUNTED SECTION", far, "police") : variant === "ob" ? boxSide(c, w, h, body, 0xd7263d, "SPORTSVIEW", "OUTSIDE BROADCAST 3", far, "tv") : boxSide(c, w, h, body, 0xb3122a, "PIE & MASH CO.", "MATCHDAY CATERING", far));
    const R = this.regs(`lorry-${variant}`, () => ({
      cabS: a.paintM(1.88 * kx, 1.88, (c, w, h) => cabSide(c, w, h, body, cabText, false)),
      cabN: a.paintM(1.88 * kx, 1.88, (c, w, h) => cabSide(c, w, h, body, cabText, true)),
      cabF: a.paintM(2.34 * kz, 1.88, (c, w, h) => cabFront(c, w, h, body, variant === "dray" ? "HOLT" : "FORD")),
      cabT: a.paintM(1.88 * kx, 2.34 * kz, (c, w, h) => cabTop(c, w, h, body)),
      deck: this.regs("lorry-deck", () => a.paintM(4.35 * kx, 2.4 * kz, art.deckTop)), wheel: this.regs("lorry-wheel", () => a.paint(30, 30, art.wheel, false)),
      side: variant === "dray" ? a.paintM(4.35 * kx, 0.44, (c, w, h) => dropside(c, w, h, body, "HOLT & SON · FINE ALES")) : this.white,
      boxS: variant === "dray" ? this.white : a.paintM(4.35 * kx, 2.05, side(false)), boxN: variant === "dray" ? this.white : a.paintM(4.35 * kx, 2.05, side(true)),
      boxR: variant === "dray" ? this.white : a.paintM(2.4 * kz, 2.05, (c, w, h) => boxRear(c, w, h, body, false)), boxRO: variant === "box" ? a.paintM(2.4 * kz, 2.05, (c, w, h) => boxRear(c, w, h, body, true)) : this.white,
      boxT: variant === "dray" ? this.white : a.paintM(4.35 * kx, 2.4 * kz, (c, w, h) => boxTop(c, w, h, body)),
    }));
    const B = this.builder();
    // The prototype's dray, in its own numbers (x 0 at the tail to 6.52 at the bumper, z 0 to 2.4), fitted to the sim's 7 m by 2.6 m.
    const bx = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, f: Parameters<Builder["box"]>[6]) => B.box(x0 * kx - 3.5, y0, z0 * kz - 1.3, x1 * kx - 3.5, y1, z1 * kz - 1.3, f);
    for (const wx of [1.0, 2.0, 5.35]) for (const o of [1, -1] as const) this.wheel(B, wx * kx - 3.5, o * 1.11, 0.47, 0.34, o, R.wheel);
    bx(0.1, 0.46, 0.3, 6.3, 0.8, 2.1, col(0x1c1d20, 0x2a2b30));
    bx(0, 0.8, 0, 4.35, 0.96, 2.4, { all: col(shadeHex(body, 0.6), shadeHex(body, 0.8)), top: R.deck });
    if (variant === "dray") {
      const hi = shadeHex(body, 1.12);
      bx(0, 0.96, 2.33, 4.35, 1.4, 2.4, { all: col(body), s: R.side, n: col(shadeHex(body, 0.7)), top: col(hi) });
      bx(0, 0.96, 0, 4.35, 1.4, 0.07, { all: col(body), n: R.side, s: col(shadeHex(body, 0.7)), top: col(hi) });
      if (!open) bx(0, 0.96, 0.07, 0.07, 1.4, 2.33, { all: col(shadeHex(body, 0.88)), top: col(hi) });
      else {
        // The tailboard dropped, and the skid the kegs come down.
        bx(-0.06, 0.5, 0.07, 0, 0.94, 2.33, col(shadeHex(body, 0.8)));
        const x0 = -3.5, zA = 0.75 * kz - 1.3, zB = 1.65 * kz - 1.3, plank = col(0x8a6a48, 0x9a7a56);
        B.quad([x0 - 1.7, 0.03, zB], [x0 - 1.7, 0.03, zA], [x0, 0.94, zA], [x0, 0.94, zB], plank, { double: true });
        for (const z of [zA, zB]) B.bar([x0 - 1.7, 0.05, z], [x0, 0.96, z], 0.07, col(0x5c4630));
      }
      bx(4.28, 0.96, 0.05, 4.42, 2.45, 2.35, { all: col(0x26272b, 0x3a3c42), top: col(body) });
      for (const hz of [0.4, 1.2, 2.0]) bx(4.24, 1.5, hz - 0.03, 4.29, 2.4, hz + 0.03, col(0x4a4c52));
    } else {
      bx(0.04, 0.96, 0.04, 4.4, 3.0, 2.36, { all: col(body), s: R.boxS, n: R.boxN, w: open && variant === "box" ? R.boxRO : R.boxR, top: R.boxT });
      if (variant === "ob") {
        // the dish on its mast, and the reels of cable on the roof
        B.bar([2.2 * kx - 3.5, 3.0, 0], [2.2 * kx - 3.5, 3.7, 0], 0.09, col(0x8a9098));
        B.xf(new THREE.Matrix4().makeRotationZ(-0.9).setPosition(2.2 * kx - 3.5, 3.75, 0)); B.cyl(0, 0, 0.16, 0, 0.15, 12, col(0x9aa0a8, 0xd4d8dc), col(0xe8eaec), 0.62); B.end();
        for (const z of [-0.7, 0.6]) { B.xf(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0.8 * kx - 3.5, 3.3, z)); B.cyl(0, 0, 0.3, 0, 0.3, 10, col(0x15171a), col(0xd7263d)); B.end(); }
      }
      if (open) {
        // both doors swung right round against the sides, and the step down
        for (const z of [0.04, 2.36]) bx(-0.03, 0.96, z - (z < 1 ? 0.07 : 0), 1.16, 3.0, z + (z < 1 ? 0 : 0.07), col(shadeHex(body, 0.82), shadeHex(body, 0.95)));
        bx(-0.45, 0.42, 0.5, 0, 0.5, 1.9, col(0x3a3c42));
      }
    }
    bx(4.5, 0.6, 0.03, 6.38, 2.48, 2.37, { all: col(body), s: R.cabS, n: R.cabN, e: R.cabF, top: R.cabT });
    bx(6.38, 0.42, 0.02, 6.52, 0.74, 2.38, col(0x1c1d20, 0x34363c));
    bx(6.38, 2.26, 0.08, 6.62, 2.34, 2.32, col(0x1a1a1c));
    for (const mz of [2.37, -0.15]) bx(6.12, 1.62, mz, 6.26, 2.2, mz + 0.18, col(DARK));
    B.bar([4.46 * kx - 3.5, 0.9, 0.32 * kz - 1.3], [4.46 * kx - 3.5, 2.85, 0.32 * kz - 1.3], 0.11, col(0x6f757c, 0xb9bec4));
    bx(4.7, 0.3, 2.2, 5.0, 0.62, 2.4, col(0x1c1d20));
    if (variant === "dray" || variant === "box") bx(5.3, 2.48, 0.95, 5.5, 2.62, 1.45, col(0xffb020));
    if (variant === "horse") for (const z of [0.6, 1.3]) bx(5.3, 2.48, z, 5.5, 2.6, z + 0.5, col(0x2a5cff));
    if (variant === "dray" && !this.kegSlots.length) {
      // Where the kegs stand: a floor of them and a second tier against the headboard, filled from the cab backwards.
      const floor: V3[] = [], tier: V3[] = [];
      for (let i = 8; i >= 0; i--) for (let j = 0; j < 4; j++) {
        const x = (0.38 + i * 0.455) * kx - 3.5, z = (0.5 + j * 0.455) * kz - 1.3, jx = (((i * 7 + j * 13) % 5) - 2) * 0.008;
        if (i === 0 && (j === 0 || j === 3)) continue;
        floor.push([x + jx, 0.96, z - jx]);
        if (i >= 5 && (i + j) % 5 !== 0 && j < 3) tier.push([x + 0.2, 0.96 + KEG_H, z + 0.22]);
      }
      this.kegSlots = [...floor.slice(0, 16), ...tier, ...floor.slice(16)];
    }
    return this.keep(name, B);
  }
  private regCache = new Map<string, unknown>();
  private regs<T>(key: string, make: () => T): T { let r = this.regCache.get(key) as T | undefined; if (!r) { r = make(); this.regCache.set(key, r); this.tex.needsUpdate = true; } return r; }

  // ---- The team coach ----
  private coach(open: boolean): Model {
    const name = `coach-${open ? 1 : 0}`, had = this.models.get(name);
    if (had) return had;
    const a = this.atlas, L = 11, W = 2.8, Y0 = 0.45, Y1 = 3.15;
    if (!this.coachRegs) this.coachRegs = { side: a.alloc(L * 32, (Y1 - Y0) * 32), sideN: a.alloc(L * 32, (Y1 - Y0) * 32), front: a.alloc(W * 32, (Y1 - Y0) * 32), rear: a.alloc(W * 32, (Y1 - Y0) * 32), rearOpen: a.alloc(W * 32, (Y1 - Y0) * 32), top: a.alloc(L * 32, W * 32) };
    const R = this.coachRegs, wheel = this.regs("coach-wheel", () => a.paint(30, 30, art.wheel, false));
    const B = this.builder(), hl = L / 2, hw = W / 2;
    for (const wx of [-hl + 1.5, hl - 1.95]) for (const o of [1, -1] as const) this.wheel(B, wx, o * (hw - 0.19), 0.5, 0.34, o, wheel);
    B.box(-hl + 0.2, 0.3, -hw + 0.25, hl - 0.2, Y0, hw - 0.25, col(0x1c1d20));
    B.box(-hl, Y0, -hw, hl, Y1, hw, { s: R.side, n: R.sideN, e: R.front, w: open ? R.rearOpen : R.rear, top: R.top });
    B.box(-hl + 3.2, Y1, -0.75, -hl + 5.6, Y1 + 0.22, 0.75, col(0xb9bec4, 0xd4d8dc)); // the air-con pod
    for (const mz of [hw, -hw - 0.16]) B.box(hl - 0.5, 1.9, mz, hl - 0.36, 2.5, mz + 0.16, col(DARK));
    B.box(hl, 0.45, -hw + 0.1, hl + 0.12, 0.85, hw - 0.1, col(0x1c1d20, 0x34363c));
    if (open) {
      // The hold's lid up, on its struts.
      const lid = col(0x8a8f96, 0xb4b9bf);
      B.quad([-hl - 1.05, 2.0, hw - 0.2], [-hl - 1.05, 2.0, -hw + 0.2], [-hl, 1.85, -hw + 0.2], [-hl, 1.85, hw - 0.2], lid, { double: true });
      for (const z of [hw - 0.3, -hw + 0.3]) B.bar([-hl, 1.2, z], [-hl - 0.8, 1.95, z], 0.05, col(0x4a4c52));
    }
    return this.keep(name, B);
  }
  /** Whose coach it is: its colours and its name, painted on. */
  team(body: number, trim: number, name: string, short: string): void {
    const key = `${body}:${trim}:${name}`;
    if (key === this.coachKey && this.coachRegs) return;
    this.coach(false); this.coach(true);
    this.coachKey = key;
    const R = this.coachRegs!, c = this.atlas.ctx;
    const into = (r: Region, fn: (c: Ctx, w: number, h: number) => void) => { c.save(); c.translate(r.x, r.y); c.beginPath(); c.rect(0, 0, r.w, r.h); c.clip(); c.clearRect(0, 0, r.w, r.h); fn(c, r.w, r.h); c.restore(); };
    into(R.side, (cc, w, h) => coachSide(cc, w, h, body, trim, name, false)); into(R.sideN, (cc, w, h) => coachSide(cc, w, h, body, trim, name, true));
    into(R.front, (cc, w, h) => coachFront(cc, w, h, body, trim, short)); into(R.rear, (cc, w, h) => coachRear(cc, w, h, body, trim, false)); into(R.rearOpen, (cc, w, h) => coachRear(cc, w, h, body, trim, true));
    into(R.top, (cc, w, h) => coachTop(cc, w, h, body, trim, short));
    this.tex.needsUpdate = true;
  }

  // ---- Cars, cabs and vans ----
  private car(kind: CarKind): Model {
    const had = this.models.get(kind);
    if (had) return had;
    const s = CARS[kind], a = this.atlas, hl = s.len / 2, hw = s.wid / 2, wr = s.kind === "van" ? 0.36 : 0.31, [c0, c1] = s.cab, [rr, rf] = s.rake;
    const ax: [number, number] = [-hl + 0.78, hl - 0.82];
    const bodyH = s.belt - s.sill, cabH = s.roof - s.belt, cabL = c1 - c0;
    const R = {
      bodyS: a.paintM(s.len, bodyH, (c, w, h) => carBody(c, w, h, s, false, [(ax[0] + hl) * 32, (ax[1] + hl) * 32], wr * 32)),
      bodyN: a.paintM(s.len, bodyH, (c, w, h) => carBody(c, w, h, s, true, [(ax[0] + hl) * 32, (ax[1] + hl) * 32], wr * 32)),
      cabS: a.paintM(cabL, cabH, (c, w, h) => carCabin(c, w, h, s, false), 1, false), cabN: a.paintM(cabL, cabH, (c, w, h) => carCabin(c, w, h, s, true), 1, false),
      nose: a.paintM(s.wid, bodyH, (c, w, h) => carNose(c, w, h, s, false)), tail: a.paintM(s.wid, bodyH, (c, w, h) => carNose(c, w, h, s, true)),
      scrF: a.paintM(s.wid - 0.12, Math.hypot(cabH, rf), (c, w, h) => carScreen(c, w, h, s, false)), scrR: a.paintM(s.wid - 0.12, Math.hypot(cabH, rr), (c, w, h) => carScreen(c, w, h, s, true)),
      roof: a.paintM(cabL - rr - rf, s.wid - 0.12, (c, w, h) => carRoof(c, w, h, s)), wheel: this.regs("car-wheel", () => a.paint(20, 20, wheelSmall, false)),
    };
    const B = this.builder(), hi = shadeHex(s.body, 1.1), zc = hw - 0.06;
    for (const wx of ax) for (const o of [1, -1] as const) this.wheel(B, wx, o * (hw - 0.1), wr, 0.22, o, R.wheel);
    B.box(-hl + 0.15, s.sill - 0.08, -hw + 0.2, hl - 0.15, s.sill, hw - 0.2, col(0x141416));
    B.box(-hl, s.sill, -hw, hl, s.belt, hw, { s: R.bodyS, n: R.bodyN, e: R.nose, w: R.tail, top: col(hi, hi) });
    // The glasshouse: upright sides cut to the rake by the paint, sloping screens, a roof.
    B.quad([c0, s.belt, zc], [c1, s.belt, zc], [c1, s.roof, zc], [c0, s.roof, zc], R.cabS);
    B.quad([c1, s.belt, -zc], [c0, s.belt, -zc], [c0, s.roof, -zc], [c1, s.roof, -zc], R.cabN);
    B.quad([c1, s.belt, zc], [c1, s.belt, -zc], [c1 - rf, s.roof, -zc], [c1 - rf, s.roof, zc], R.scrF);
    B.quad([c0, s.belt, -zc], [c0, s.belt, zc], [c0 + rr, s.roof, zc], [c0 + rr, s.roof, -zc], R.scrR);
    B.quad([c0 + rr, s.roof, zc], [c1 - rf, s.roof, zc], [c1 - rf, s.roof, -zc], [c0 + rr, s.roof, -zc], R.roof);
    for (const mz of [hw, -hw - 0.1]) B.box(c1 - 0.18, s.belt - 0.02, mz, c1 - 0.06, s.belt + 0.14, mz + 0.1, col(DARK));
    if (kind === "taxi") B.box(c1 - rf - 0.5, s.roof, -0.28, c1 - rf - 0.28, s.roof + 0.16, 0.28, col(0xf2a81e, 0xffd060));
    if (s.police) { const lx = (c0 + rr + c1 - rf) / 2 + (s.kind === "van" ? 0.9 : 0); B.box(lx - 0.1, s.roof, -0.5, lx + 0.1, s.roof + 0.13, -0.02, col(0x2a5cff)); B.box(lx - 0.1, s.roof, 0.02, lx + 0.1, s.roof + 0.13, 0.5, col(0x2a5cff)); }
    return this.keep(kind, B);
  }

  // ---- The bike ----
  private bike(fallen: boolean): Model {
    const name = fallen ? "bike-down" : "bike", had = this.models.get(name);
    if (had) return had;
    const rW = this.regs("bike-wheel", () => this.atlas.paint(21, 21, bikeWheel, false));
    const B = this.builder(), fr = col(0xc8281e, 0xe04a3a), st = col(0x9aa0a8, 0xc6ccd2), r = 0.33;
    if (fallen) B.xf(new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.12).setPosition(0, 0.1, -0.25));
    for (const wx of [-0.52, 0.52]) for (const z of [-0.015, 0.015]) B.quad([wx - r, 0, z], [wx + r, 0, z], [wx + r, r * 2, z], [wx - r, r * 2, z], rW, { double: true });
    const P = (x: number, y: number, z = 0): V3 => [x, y, z];
    B.bar(P(-0.52, r), P(-0.12, 0.3), 0.045, fr); B.bar(P(-0.12, 0.3), P(-0.24, 0.84), 0.05, fr); B.bar(P(-0.52, r), P(-0.24, 0.8), 0.04, fr);
    B.bar(P(-0.12, 0.3), P(0.36, 0.8), 0.055, fr); B.bar(P(-0.24, 0.8), P(0.36, 0.84), 0.05, fr);
    B.bar(P(0.52, r), P(0.34, 0.98), 0.045, st); B.bar(P(0.34, 0.98, -0.26), P(0.34, 0.98, 0.26), 0.045, col(0x1a1a1c));
    B.box(-0.4, 0.86, -0.07, -0.14, 0.92, 0.07, col(0x1a1a1c, 0x2a2a2e));
    B.bar(P(-0.12, 0.3, -0.12), P(-0.12, 0.3, 0.12), 0.04, st); B.box(-0.2, 0.26, 0.1, -0.04, 0.3, 0.2, col(0x1a1a1c)); B.box(-0.2, 0.3, -0.2, -0.04, 0.34, -0.1, col(0x1a1a1c));
    B.end();
    return this.keep(name, B);
  }

  // ---- Every frame ----
  begin(): void { this.frame++; this.kegN = 0; }
  private place(id: string, model: Model, kind: string, x: number, y: number, facing: number, mat: THREE.Material = this.lit, tilt = 0, lift = 0): THREE.Mesh {
    let l = this.live.get(id);
    if (!l) {
      const mesh = new THREE.Mesh(model.geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `veh-${id}`;
      l = { mesh, seen: 0, kind }; this.live.set(id, l); this.group.add(mesh);
    }
    const m = l.mesh;
    if (m.geometry !== model.geo) m.geometry = model.geo;
    if (m.material !== mat) m.material = mat;
    m.position.set(x, lift * STRETCH, y); m.rotation.set(0, -facing, tilt, "YXZ"); m.visible = true;
    l.seen = this.frame; l.kind = kind;
    this.tris += model.tris;
    return m;
  }
  /** The delivery lorry. `load` 0..1 is how much of the bed is kegs. */
  lorryAt(id: string, x: number, y: number, facing: number, open: boolean, load: number, name: string): void {
    const variant = /horse/i.test(name) ? "horse" : /broadcast|tv/i.test(name) ? "ob" : /cater|van/i.test(name) ? "box" : "dray";
    const m = this.place(id, this.lorry(variant, open), "lorry", x, y, facing);
    if (variant === "horse") m.scale.set(6.2 / 7, 1, 2.4 / 2.6); else m.scale.set(1, 1, 1);
    if (variant !== "dray") return;
    const n = Math.min(this.kegSlots.length, Math.round(this.kegSlots.length * Math.max(0, Math.min(1, load))));
    this.m4b.makeRotationY(-facing).setPosition(x, 0, y);
    for (let i = 0; i < n && this.kegN < 64; i++) {
      const s = this.kegSlots[i];
      this.q.setFromAxisAngle(this.up, (i * 2.399) % 6.283);
      this.m4.compose(this.v3.set(s[0], s[1] * STRETCH, s[2]), this.q, this.one).premultiply(this.m4b);
      this.kegs.setMatrixAt(this.kegN++, this.m4);
    }
  }
  coachAt(id: string, x: number, y: number, facing: number, open: boolean, crashed: boolean): void {
    this.place(id, this.coach(open), "coach", x, y, facing, crashed ? this.dull : this.lit, crashed ? 0.06 : 0);
  }
  carAt(id: string, kind: string, x: number, y: number, facing: number, damage = 0): void {
    const k = (CARS[kind as CarKind] ? kind : "hatch") as CarKind;
    this.place(id, this.car(k), "car", x, y, facing, damage > 6 ? this.wreck : damage > 2 ? this.dent : this.lit);
  }
  bikeAt(id: string, x: number, y: number, facing: number, fallen: boolean): void { this.place(id, this.bike(fallen), "bike", x, y, facing); }
  end(): void {
    for (const [id, l] of this.live) {
      if (l.seen === this.frame) continue;
      l.mesh.visible = false;
      if (this.frame - l.seen > 600) { this.group.remove(l.mesh); this.live.delete(id); }
    }
    this.kegs.count = this.kegN; this.kegs.visible = this.kegN > 0; this.kegs.instanceMatrix.needsUpdate = true;
    this.tris = 0;
  }
  dispose(): void {
    for (const m of this.models.values()) m.geo.dispose();
    this.kegs.geometry.dispose(); this.tex.dispose();
    for (const m of [this.lit, this.dull, this.dent, this.wreck]) m.dispose();
    this.group.removeFromParent();
  }
}
function shadeHex(c: number, k: number): number { const [r, g, b] = shade(hex(c) as RGB, k); return (Math.round(Math.min(255, r)) << 16) | (Math.round(Math.min(255, g)) << 8) | Math.round(Math.min(255, b)); }
void grain; void (null as unknown as FaceSpec);

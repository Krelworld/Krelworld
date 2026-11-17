import Phaser from "phaser";
import type { Rect } from "./ShowDirector";

/**
 * Cutaways: an insert shot a screenplay cuts to with [INSERT id] (or [INSERT id 2] to hold it over two lines),
 * then back to the room. Each draws itself into the director's picture (the camera layer, so it's wiped on the
 * next cut) and returns how long the cut needs before the line starts.
 *
 * Chomworld: The Pitch (krews2.ts) cuts to the attractions as Marge describes them. Art: tv_chw_* stills and
 * figures, and Noam Chomsky's close-up sheet tvface_CHW_CHOMSKY (dramaFaces.ts).
 */
export interface CutKit {
  sc: Phaser.Scene;
  r: Rect;
  /** put something in the picture */
  add<T extends Phaser.GameObjects.GameObject>(o: T): T;
  later(ms: number, fn: () => void): void;
  every(ms: number, fn: () => void): void;
  text(x: number, y: number, s: string, size: number, col?: string, o?: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text;
  sfx(id: string): void;
  /** a slow push in about a point */
  push(to: number, ms: number, fx?: number, fy?: number): void;
  /** a still filling the picture (null-safe: a grey card if the art's missing) */
  backdrop(key: string, o?: { blur?: number; tint?: number }): Phaser.GameObjects.Image;
  tex(key: string): string | null;
}

const CHOMSKY = "tvface_CHW_CHOMSKY";
/** the head and shoulders in a close-up frame (for wrappers, signs and insets) */
const HEAD: [number, number, number, number] = [26, 6, 76, 100];

/** Screen position of a point on a 320x240 still drawn by backdrop() (it just fills the picture, centred). */
function at(k: CutKit, ix: number, iy: number, w = 320, h = 240) {
  const { SX, SY, SW, SH } = k.r;
  const s = Math.max(SW / w, SH / h);
  return { x: SX + SW / 2 + (ix - w / 2) * s, y: SY + SH / 2 + (iy - h / 2) * s, s };
}

/** The same still again, cropped to a region and laid over the first (to move one part of it, or put it in front). */
function layer(k: CutKit, key: string, crop: [number, number, number, number]) {
  const img = k.backdrop(key);
  img.setCrop(...crop);
  return img;
}

/** The dream: a white bloom as the picture cuts to Marge's imagination, and a caption naming the attraction. */
function dream(k: CutKit, label: string) {
  const { SX, SY, SW, SH } = k.r;
  const bloom = k.add(k.sc.add.rectangle(SX, SY, SW, SH, 0xffffff).setOrigin(0).setAlpha(0.9));
  k.sc.tweens.add({ targets: bloom, alpha: 0, duration: 450, ease: "Quad.out" });
  const vig = k.add(k.sc.add.graphics());
  vig.lineStyle(26, 0xfff4d6, 0.22).strokeRect(SX + 13, SY + 13, SW - 26, SH - 26);
  const cap = k.add(k.text(SX + 14, SY + 12, `CHOMWORLD™ · ${label}`, 12, "#ffffff", { fontStyle: "bold", backgroundColor: "#5b2a86", padding: { x: 6, y: 3 } }));
  cap.setAlpha(0);
  k.sc.tweens.add({ targets: cap, alpha: 1, duration: 300, delay: 250 });
  k.sfx("tv_sting");
}

/** Chomsky's head on something (a wrapper, a sign, an inset): a crop of his close-up, `h` px tall. */
function head(k: CutKit, x: number, y: number, h: number, frame = 0) {
  if (!k.tex(CHOMSKY)) return null;
  const s = k.sc.add.sprite(x, y, CHOMSKY, frame);
  s.setCrop(...HEAD);
  s.setScale(h / HEAD[3]);
  // setCrop keeps the frame's origin: shift so the crop is centred on (x, y)
  s.setDisplayOrigin(HEAD[0] + HEAD[2] / 2, HEAD[1] + HEAD[3] / 2);
  return s;
}

/** Floating notes / sparkles. */
function float(k: CutKit, x: number, y: number, s: string, col: string, size = 18) {
  const t = k.add(k.text(x, y, s, size, col, { fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5));
  k.sc.tweens.add({ targets: t, y: y - 70 - Math.random() * 40, x: x + (Math.random() - 0.5) * 50, alpha: 0, angle: (Math.random() - 0.5) * 40, duration: 1400 + Math.random() * 600, onComplete: () => t.destroy() });
}

// ------------------------------------------------------------------ the attractions

/** Main Street: a line of Chomsky lookalikes in costume, high-kicking through a big musical number. */
function lookalikes(k: CutKit) {
  dream(k, "MAIN STREET PARADE");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_park");
  const arch = at(k, 210, 92);
  k.add(k.text(arch.x, arch.y, "CHOMWORLD", 15, "#ffd23f", { fontStyle: "bold", stroke: "#5b2a86", strokeThickness: 4 }).setOrigin(0.5));
  // bunting confetti
  k.every(140, () => {
    const c = k.add(k.sc.add.rectangle(SX + Math.random() * SW, SY - 6, 5, 8, [0xff4f8a, 0xffd23f, 0x10c0b0, 0x7a5cff][Math.floor(Math.random() * 4)]));
    k.sc.tweens.add({ targets: c, y: SY + SH + 10, angle: 360 * (Math.random() > 0.5 ? 1 : -1), x: c.x + (Math.random() - 0.5) * 80, duration: 2600 + Math.random() * 1200, onComplete: () => c.destroy() });
  });
  // the chorus line: five of him, in sashes and boaters, on the beat
  const tints = [0xffffff, 0xffe6f0, 0xe6f0ff, 0xfff6d8, 0xe8ffe8];
  const sash = [0xff4f8a, 0x10c0b0, 0xffd23f, 0x7a5cff, 0xff8a3d];
  const beat = 380;
  const dancers: { s: Phaser.GameObjects.Sprite; hat: Phaser.GameObjects.Container; i: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const x = SX + SW * (0.14 + 0.18 * i);
    const y = SY + SH * (0.95 - (i % 2) * 0.03);
    const scl = (SH * 0.5) / 128;
    if (!k.tex("tv_chw_dance")) break;
    const s = k.add(k.sc.add.sprite(x, y, "tv_chw_dance", 0).setOrigin(0.5, 1).setScale(scl).setTint(tints[i]));
    // a straw boater and a sash: the costume
    const hat = k.add(k.sc.add.container(x, y - 118 * scl));
    hat.add(k.sc.add.ellipse(0, 0, 46 * scl, 9 * scl, 0xf3d98a).setStrokeStyle(1, 0x6b4a1a));
    hat.add(k.sc.add.rectangle(0, -5 * scl, 28 * scl, 10 * scl, 0xf3d98a).setStrokeStyle(1, 0x6b4a1a));
    hat.add(k.sc.add.rectangle(0, -2 * scl, 28 * scl, 3 * scl, sash[i]));
    const band = k.add(k.sc.add.rectangle(x, y - 70 * scl, 34 * scl, 6 * scl, sash[i]).setAngle(-28).setAlpha(0.9));
    dancers.push({ s, hat, i, y });
    void band;
  }
  let n = 0;
  k.every(beat, () => {
    n++;
    for (const d of dancers) {
      const f = [0, 1, 2, 1][(n + d.i) % 4];
      d.s.setFrame(f).setFlipX((n + d.i) % 8 >= 4);
      const hop = (n + d.i) % 2 ? 14 : 0;
      d.s.y = d.y - hop;
      d.hat.y = d.y - hop - 118 * (d.s.scaleY);
      d.hat.angle = f === 1 ? -12 : 6;
    }
    if (n % 2) float(k, SX + 40 + Math.random() * (SW - 80), SY + SH * 0.45, Math.random() > 0.5 ? "♪" : "♫", "#ffffff", 22);
  });
  const lyric = k.add(k.text(SX + SW / 2, SY + 54, "♪ Colourless green ideas... sleep fuuuriously! ♪", 16, "#ffffff", { fontStyle: "italic bold", stroke: "#5b2a86", strokeThickness: 5 }).setOrigin(0.5));
  k.sc.tweens.add({ targets: lyric, scale: { from: 0.95, to: 1.05 }, duration: beat, yoyo: true, repeat: -1 });
  k.push(1.06, 6000, SX + SW / 2, SY + SH * 0.6);
  return 500;
}

/** Chomlate: the bars, with his face on the wrapper and a quote in every one. */
function chomlate(k: CutKit) {
  dream(k, "CHOMLATE");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_shop", { blur: 1.5 });
  const quotes = ["\"Colorless green ideas\nsleep furiously\"", "NOW WITH 30%\nUNIVERSAL GRAMMAR", "70% cocoa\n30% deep structure"];
  const cols = [0x5b2a86, 0x8a1e3c, 0x1e4a8a];
  quotes.forEach((q, i) => {
    const c = k.add(k.sc.add.container(SX + SW * (0.24 + 0.27 * i), SY + SH * 0.7 + (i === 1 ? -26 : 0)));
    const w = 170;
    const h = 92;
    c.add(k.sc.add.rectangle(0, 0, w, h, cols[i]).setStrokeStyle(3, 0x1a0a20));
    c.add(k.sc.add.rectangle(-w / 2 + 9, 0, 18, h, 0xd8d8e0).setStrokeStyle(1, 0x888898));
    c.add(k.sc.add.rectangle(w / 2 - 9, 0, 18, h, 0xd8d8e0).setStrokeStyle(1, 0x888898));
    c.add(k.sc.add.rectangle(0, -h / 2 + 6, w - 36, 5, 0xffd23f));
    c.add(k.sc.add.rectangle(0, h / 2 - 6, w - 36, 5, 0xffd23f));
    const hd = head(k, -w / 2 + 46, 2, 64);
    if (hd) {
      c.add(k.sc.add.circle(-w / 2 + 46, 2, 30, 0xffd23f));
      c.add(hd);
    }
    c.add(k.text(18, -24, "CHOMLATE", 17, "#ffd23f", { fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5));
    c.add(k.text(18, 12, q, 9, "#ffffff", { align: "center", fontStyle: "italic" }).setOrigin(0.5));
    c.setAngle([-8, 3, 9][i]).setScale(0);
    k.sc.tweens.add({ targets: c, scale: 1, duration: 420, delay: 250 + i * 260, ease: "Back.out", onStart: () => k.sfx("pop") });
    k.sc.tweens.add({ targets: c, y: c.y - 6, duration: 1300 + i * 200, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: 800 });
  });
  k.every(260, () => {
    const t = k.add(k.text(SX + 40 + Math.random() * (SW - 80), SY + SH * (0.45 + Math.random() * 0.4), "✦", 12 + Math.random() * 10, "#fff6c0").setOrigin(0.5).setAlpha(0));
    k.sc.tweens.add({ targets: t, alpha: 1, scale: 1.4, duration: 300, yoyo: true, onComplete: () => t.destroy() });
  });
  k.add(k.text(SX + SW / 2, SY + 58, "KIDS WILL LOVE IT!", 20, "#ffd23f", { fontStyle: "bold", stroke: "#3a1050", strokeThickness: 6 }).setOrigin(0.5).setAngle(-3));
  k.push(1.05, 5000);
  return 500;
}

/** The 4D Manufacturing Consent experience: seats on full vibrate, water, the robot reading chapter one. */
function ride(k: CutKit) {
  dream(k, "MANUFACTURING CONSENT 4D");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_ride");
  const scr = at(k, 160, 102);
  const st = k.add(k.text(scr.x, scr.y, "MANUFACTURING\nCONSENT\n— CHAPTER 1 —", 11, "#e8fbff", { align: "center", fontStyle: "bold" }).setOrigin(0.5));
  k.sc.tweens.add({ targets: st, alpha: 0.6, duration: 120, yoyo: true, repeat: -1 });
  // the seats, on aggressive
  const seats = layer(k, "tv_chw_ride", [0, 118, 320, 122]);
  const sx = seats.x;
  const sy = seats.y;
  k.every(45, () => seats.setPosition(sx + (Math.random() - 0.5) * 9, sy + (Math.random() - 0.5) * 7));
  // water, from the nozzles
  const nozzles = [at(k, 70, 30), at(k, 160, 22), at(k, 250, 30)];
  k.every(50, () => {
    const nz = nozzles[Math.floor(Math.random() * nozzles.length)];
    const d = k.add(k.sc.add.rectangle(nz.x, nz.y, 3, 7, 0x9ad8ff).setAlpha(0.85));
    k.sc.tweens.add({ targets: d, x: nz.x + (Math.random() - 0.5) * 220, y: SY + SH * (0.55 + Math.random() * 0.45), alpha: 0.2, duration: 500 + Math.random() * 300, ease: "Quad.in", onComplete: () => d.destroy() });
  });
  // the robot loudspeaker
  const bot = k.tex("tv_chw_robot") ? k.add(k.sc.add.image(SX + SW - 70, SY + 120, "tv_chw_robot").setScale(2.4)) : null;
  if (bot) k.sc.tweens.add({ targets: bot, angle: { from: -3, to: 3 }, duration: 90, yoyo: true, repeat: -1 });
  const say = k.add(k.text(SX + SW - 140, SY + 196, "", 12, "#b6ff9a", { fontStyle: "bold", backgroundColor: "#0b1a0b", padding: { x: 6, y: 4 }, wordWrap: { width: 230 } }).setOrigin(0.5, 0));
  const words = "BEEP. CHAPTER ONE. A PROPAGANDA MODEL. THE MASS MEDIA SERVE AS A SYSTEM FOR COMMUNICATING MESSAGES AND SYMBOLS TO THE GENERAL POPULACE. BEEP.".split(" ");
  let i = 0;
  k.every(170, () => {
    if (i < words.length) say.setText(words.slice(Math.max(0, i - 9), ++i).join(" "));
  });
  k.add(k.text(SX + 16, SY + 40, "4D", 30, "#ff4f8a", { fontStyle: "bold", stroke: "#fff", strokeThickness: 4 }));
  return 500;
}

/** The "sex-themed area": an entrance, a curtain and a neon sign. That's all we're showing. */
function adults(k: CutKit) {
  dream(k, "THE ADULT ZONE");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_adult");
  const sign = at(k, 112, 33);
  const neon = k.add(k.text(sign.x, sign.y, "18+", 40, "#ff5ad8", { fontStyle: "bold", stroke: "#ffd6f6", strokeThickness: 2 }).setOrigin(0.5));
  try {
    neon.preFX?.addGlow(0xff3fd0, 4, 0, false, 0.1, 12);
  } catch {
    /* canvas renderer */
  }
  const sub = k.add(k.text(sign.x, sign.y + 46, "ADULTS ONLY · NO REFUNDS", 10, "#c7a6ff", { fontStyle: "bold", backgroundColor: "#140a20", padding: { x: 4, y: 2 } }).setOrigin(0.5));
  const glow = k.add(k.sc.add.rectangle(SX, SY, SW, SH, 0xff3fd0).setOrigin(0).setAlpha(0.08).setBlendMode(Phaser.BlendModes.ADD));
  // the buzz and flicker of a cheap sign
  k.every(110, () => {
    const on = Math.random() > 0.12;
    neon.setAlpha(on ? 1 : 0.25);
    glow.setAlpha(on ? 0.08 : 0.02);
    sub.setAlpha(on ? 1 : 0.5);
  });
  // the curtain stirs
  const cur = layer(k, "tv_chw_adult", [82, 78, 60, 118]);
  k.sc.tweens.add({ targets: cur, scaleX: cur.scaleX * 1.01, x: cur.x + 2, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  k.push(1.08, 6000, sign.x, SY + SH * 0.5);
  return 500;
}

/** The centrepiece: a sixty-foot animatronic Chomsky, laughing over the crowd. */
function giant(k: CutKit) {
  dream(k, "THE GREAT CHOMSKY");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_crowd");
  // spotlights
  for (const [x, a] of [[SX + 60, 18], [SX + SW - 60, -18]] as const) {
    const cone = k.add(k.sc.add.graphics({ x, y: SY + SH }));
    cone.fillStyle(0xfff2b0, 0.16).fillTriangle(0, 0, -60, -SH * 1.1, 60, -SH * 1.1).setBlendMode(Phaser.BlendModes.ADD);
    cone.setAngle(a);
    k.sc.tweens.add({ targets: cone, angle: -a, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  if (k.tex(CHOMSKY)) {
    const g = k.add(k.sc.add.sprite(SX + SW / 2, SY + SH + 260, CHOMSKY, 5).setOrigin(0.5, 1).setScale(4.4).setTint(0xdfe4f0));
    k.sc.tweens.add({ targets: g, y: SY + SH + 70, duration: 1400, ease: "Back.out" });
    // an animatronic jaw: jerky, on a loop
    let f = 0;
    k.every(170, () => {
      f++;
      g.setFrame(f % 2 ? 5 : 2);
      g.setAngle(f % 4 < 2 ? -1.5 : 1.5);
    });
    // the bolts in his neck
    k.every(900, () => {
      const sp = k.add(k.text(SX + SW / 2 + (Math.random() > 0.5 ? 70 : -70), SY + SH - 70, "✷", 22, "#fff38a").setOrigin(0.5));
      k.sc.tweens.add({ targets: sp, alpha: 0, scale: 2, duration: 300, onComplete: () => sp.destroy() });
    });
  }
  // the crowd stays in front of him
  layer(k, "tv_chw_crowd", [0, 150, 320, 90]);
  const sign = k.add(k.sc.add.container(SX + SW - 104, SY + SH - 70));
  sign.add(k.sc.add.rectangle(0, 0, 170, 44, 0x2a1238).setStrokeStyle(3, 0xffd23f));
  sign.add(k.text(0, 0, "DONATE FOR\nFAME & RICHES", 12, "#ffd23f", { fontStyle: "bold", align: "center" }).setOrigin(0.5));
  k.every(520, () => {
    const t = k.add(k.text(SX + SW / 2 + (Math.random() - 0.5) * 220, SY + 90 + Math.random() * 60, "HA", 26 + Math.random() * 16, "#ffffff", { fontStyle: "bold", stroke: "#5b2a86", strokeThickness: 6 }).setOrigin(0.5));
    k.sc.tweens.add({ targets: t, scale: 1.6, alpha: 0, y: t.y - 40, duration: 900, onComplete: () => t.destroy() });
  });
  k.add(k.text(SX + 18, SY + SH * 0.36, "60 FT", 14, "#ffffff", { fontStyle: "bold", backgroundColor: "#00000088", padding: { x: 4, y: 2 } }));
  k.push(1.05, 6000, SX + SW / 2, SY + SH * 0.4);
  return 700;
}

/** The waiver shredder: pulleys, a conveyor and a shredder; paper everywhere; the big man laughing on the monitor. */
function shredder(k: CutKit) {
  dream(k, "THE WAIVER SHREDDER");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_shredder");
  // pulleys at the top, ropes running out of frame to whoever's pulling them
  const pulleys = [at(k, 118, 22), at(k, 238, 22)];
  for (const p of pulleys) {
    const g = k.add(k.sc.add.graphics({ x: p.x, y: p.y }));
    g.fillStyle(0x8a5a2a).fillCircle(0, 0, 22).lineStyle(4, 0x3a2410).strokeCircle(0, 0, 22);
    g.lineStyle(3, 0x3a2410);
    for (let a = 0; a < 6; a++) g.lineBetween(0, 0, Math.cos((a * Math.PI) / 3) * 20, Math.sin((a * Math.PI) / 3) * 20);
    k.sc.tweens.add({ targets: g, angle: 360, duration: 900, repeat: -1 });
    const rope = k.add(k.sc.add.graphics());
    rope.lineStyle(3, 0xd9c08a).lineBetween(p.x - 22, p.y, p.x - 60, SY + SH + 10).lineBetween(p.x + 22, p.y, p.x + 22, p.y + 140);
  }
  // the waivers going in, and coming out in strips
  const mouth = at(k, 190, 120);
  const out = at(k, 170, 190);
  k.every(700, () => {
    const w = k.add(k.sc.add.container(mouth.x - 140, mouth.y - 60));
    w.add(k.sc.add.rectangle(0, 0, 34, 44, 0xfdfdf4).setStrokeStyle(1, 0x999999));
    w.add(k.text(0, -12, "WAIVER", 7, "#222222", { fontStyle: "bold" }).setOrigin(0.5));
    w.add(k.sc.add.rectangle(0, 4, 24, 2, 0xaaaaaa));
    w.add(k.sc.add.rectangle(0, 10, 24, 2, 0xaaaaaa));
    w.add(k.sc.add.rectangle(4, 17, 16, 2, 0x2a3aa8));
    k.sc.tweens.add({ targets: w, x: mouth.x, y: mouth.y, angle: 8, duration: 520, ease: "Quad.in", onComplete: () => {
      w.destroy();
      k.sfx("type");
    } });
  });
  k.every(60, () => {
    const s = k.add(k.sc.add.rectangle(out.x + (Math.random() - 0.5) * 30, out.y, 3, 10 + Math.random() * 8, 0xfdfdf4));
    k.sc.tweens.add({ targets: s, x: s.x + (Math.random() - 0.5) * 260, y: s.y - 60 - Math.random() * 120, angle: Math.random() * 720, duration: 700 + Math.random() * 400, ease: "Quad.out", onComplete: () => {
      k.sc.tweens.add({ targets: s, y: SY + SH + 20, duration: 900, ease: "Quad.in", onComplete: () => s.destroy() });
    } });
  });
  // the monitor: the great man, laughing
  const mon = k.add(k.sc.add.container(SX + SW - 92, SY + 86));
  mon.add(k.sc.add.rectangle(0, 0, 132, 104, 0x111111).setStrokeStyle(4, 0x555555));
  const hd = head(k, 0, 2, 96, 5);
  if (hd) {
    hd.setTint(0xdfe4f0);
    mon.add(hd);
    let f = 0;
    k.every(170, () => hd.setFrame(++f % 2 ? 5 : 2).setCrop(...HEAD));
  }
  mon.add(k.text(0, 46, "LIVE · THE GREAT CHOMSKY", 7, "#ff5555", { fontStyle: "bold" }).setOrigin(0.5));
  k.add(k.text(SX + 14, SY + SH - 64, "STAFF ONLY: PULL ROPE", 11, "#111111", { fontStyle: "bold", backgroundColor: "#ffd23f", padding: { x: 5, y: 3 } }));
  return 500;
}

/** Where the money goes: empty sacks, and the seafront mansion she's looking at. */
function mansion(k: CutKit) {
  dream(k, "FINANCES");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_mansion");
  k.push(1.12, 7000, SX + SW * 0.45, SY + SH * 0.4);
  for (let i = 0; i < 3; i++) {
    if (!k.tex("tv_chw_sack")) break;
    const s = k.add(k.sc.add.image(SX + 70 + i * 92, SY + SH - 10 + (i % 2) * 6, "tv_chw_sack", i % 2).setOrigin(0.5, 1).setScale(2.4 - (i % 2) * 0.3));
    k.sc.tweens.add({ targets: s, scaleY: s.scaleY * 0.9, duration: 700 + i * 120, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  // a moth, out of the empty one
  const moth = k.add(k.sc.add.container(SX + 162, SY + SH - 60));
  const wl = k.sc.add.ellipse(-4, 0, 8, 5, 0xbdb3a0);
  const wr = k.sc.add.ellipse(4, 0, 8, 5, 0xbdb3a0);
  moth.add([wl, wr]);
  k.sc.tweens.add({ targets: [wl, wr], scaleY: 0.2, duration: 80, yoyo: true, repeat: -1 });
  k.sc.tweens.add({ targets: moth, x: SX + SW * 0.8, y: SY + 60, duration: 5000, ease: "Sine.easeInOut" });
  const tag = k.add(k.text(SX + SW - 16, SY + SH - 16, "FOR SALE: SOLD (TO MARGE)", 12, "#ffffff", { fontStyle: "bold", backgroundColor: "#8a1e1e", padding: { x: 5, y: 3 } }).setOrigin(1, 1));
  tag.setAngle(-4);
  return 500;
}

/** The "real Chomsky" exhibit: the ticket booth and its price list, and nothing more. */
function exhibit(k: CutKit) {
  dream(k, "THE REAL CHOMSKY EXHIBIT");
  const { SX, SY, SW, SH } = k.r;
  k.backdrop("tv_chw_booth");
  const top = at(k, 175, 33);
  k.add(k.text(top.x, top.y, "THE REAL\nCHOMSKY\nEXHIBIT", 14, "#8a1e1e", { fontStyle: "bold", align: "center", lineSpacing: -2 }).setOrigin(0.5));
  const hatch = at(k, 180, 110);
  k.add(k.text(hatch.x, hatch.y, "TICKETS", 12, "#ffffff", { fontStyle: "bold", backgroundColor: "#8a1e1e", padding: { x: 5, y: 2 } }).setOrigin(0.5));
  // the price board, in the foreground
  const b = k.add(k.sc.add.container(SX + 118, SY + SH - 128));
  b.add(k.sc.add.rectangle(0, 0, 190, 170, 0xf6f0de).setStrokeStyle(5, 0x5a3a20));
  b.add(k.text(0, -66, "TODAY'S SESSIONS", 12, "#5a3a20", { fontStyle: "bold" }).setOrigin(0.5));
  b.add(k.text(0, -30, "FEEDING SESSIONS\n£££", 15, "#8a1e1e", { fontStyle: "bold", align: "center" }).setOrigin(0.5));
  b.add(k.text(0, 18, "POKE-A-PROF\n£££", 15, "#8a1e1e", { fontStyle: "bold", align: "center" }).setOrigin(0.5));
  b.add(k.text(0, 60, "stick hire extra · no refunds", 9, "#5a3a20", { fontStyle: "italic" }).setOrigin(0.5));
  b.setAngle(-3);
  k.sc.tweens.add({ targets: b, angle: -1, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  const q = k.add(k.text(SX + SW - 20, SY + SH - 22, "QUEUE STARTS HERE →", 11, "#111111", { fontStyle: "bold", backgroundColor: "#ffd23f", padding: { x: 5, y: 3 } }).setOrigin(1, 1));
  void q;
  // the dead leaves blowing past
  k.every(500, () => {
    const l = k.add(k.text(SX - 10, SY + SH * (0.6 + Math.random() * 0.3), "🍂", 14).setOrigin(0.5));
    k.sc.tweens.add({ targets: l, x: SX + SW + 20, y: l.y - 30, angle: 540, duration: 2600, onComplete: () => l.destroy() });
  });
  k.push(1.06, 7000, top.x, SY + SH * 0.4);
  return 500;
}

export const CUTAWAYS: Record<string, (k: CutKit) => number> = {
  chw_lookalikes: lookalikes,
  chw_chomlate: chomlate,
  chw_ride: ride,
  chw_adults: adults,
  chw_giant: giant,
  chw_shredder: shredder,
  chw_mansion: mansion,
  chw_exhibit: exhibit,
};

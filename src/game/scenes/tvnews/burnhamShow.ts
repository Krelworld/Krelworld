import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { voice } from "../../audio/Voice";
import { FONT } from "../../ui/theme";
import { calm, cameraFlash, type NewsChrome, type Rect } from "./NewsChrome";
import type { Presenter } from "./Presenter";
import type { NewsCfg } from "../TVNews";
import { gore } from "../tv/action";

/**
 * GB Krews: Andy Burnham's first act (src/content/television/extra/krews3.ts, KREWS_BURNHAM_FIRST_ACT), the user's
 * own gross-out satire. Live from Downing Street (kind "burnham"), the Manchester Wetherspoons with the presser on its
 * muted telly in the corner (kind "spoons"), then back. NewsDirector hands those scenes' beats to BurnhamShow.
 *
 * Everything gross is cartoon and over the top: the vomit is a cascade of chips and gravy into the aide's steel bowl,
 * the squat happens behind the podium (he sinks behind a lectern drawn in front of him; only his head and shoulders
 * stay above it) under a big CENSORED bar, and nothing is ever shown coming out: the bowl afterwards is a cartoon
 * brown mix. With gore off the vomit and the squat cut away (the crowd's faces, a "technical difficulties" card).
 * Flashes go through cameraFlash, so calmFlash slows and dims them.
 *
 * Art: tvanchor_BURNHAM (krews3Cast.ts has its rows), tv_burn_* (the day-time Number 10, the 'Spoons, the lectern
 * on its own, the bowls, the sausage roll, the pigeon, the aide, the crowd in flat caps and hi-vis, the civil
 * servants). The four Northern Blokes are the KrelTV pub patrons (tvface_PUB_PATRON_1-4). Sounds: burn_* (Synth.ts).
 */

export type BurnKind = "burnham" | "spoons";
export const BURN_KINDS: ReadonlySet<string> = new Set<BurnKind>(["burnham", "spoons"]);

const STUDIO = { match: /NEWSDESK/, kind: "desk" as const, set: "tv_gbk_studio" };
const BURNHAM_FACE = { key: "tvanchor_BURNHAM", frame: 0, crop: [34, 4, 60, 62] as [number, number, number, number] };

export const BURNHAM_NEWS: Record<string, NewsCfg> = {
  krews_burnham_first_act: {
    brand: "gbk",
    ticker: [
      "PM's first act: 'The North is much better than the South'",
      "New law 'legally binding, no appeals'",
      "Sausage roll thrown at Downing Street presser",
      "Pigeon lands on GB Krews camera, refuses to move",
      "Civil service 'clapping politely'",
      "Gravy shortage feared across the North West",
    ],
    scenes: [
      STUDIO,
      { match: /DOWNING STREET/, kind: "burnham", set: "tv_burn_no10", where: "Downing Street" },
      { match: /WETHERSPOONS/, kind: "spoons", set: "tv_burn_spoons", where: "Manchester" },
    ],
    ots: [{ match: /Andy Burnham|Downing Street/i, pic: BURNHAM_FACE, caption: "PM's first act" }],
    straps: {
      "ANDY BURNHAM": ["Andy Burnham", "Prime Minister"],
      REPORTER: ["Reporter", "In the Downing Street press pen"],
      "NORTHERN BLOKE 1": ["Northern bloke", "Wetherspoons, Manchester"],
      "NORTHERN BLOKE 2": ["Northern bloke", "Wetherspoons, Manchester"],
      "NORTHERN BLOKE 3": ["Northern bloke", "Wetherspoons, Manchester"],
      "NORTHERN BLOKE 4": ["Northern bloke", "Wetherspoons, Manchester"],
    },
  },
};

/** What NewsDirector lends the show (its own camera, layers and helpers). */
export interface NewsKit {
  sc: Phaser.Scene;
  r: Rect;
  stage: Phaser.GameObjects.Container;
  fx: Phaser.GameObjects.Container;
  chrome: NewsChrome;
  clearShot(): void;
  backdrop(key: string, zoom?: number, ox?: number, oy?: number, blur?: boolean): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  camTo(scale: number, fx: number, fy: number, ms: number, ease?: string): void;
  later(ms: number, fn: () => void): Phaser.Time.TimerEvent;
  every(ms: number, fn: () => void): Phaser.Time.TimerEvent;
  presenter(name: string, x: number, y: number, scale: number): Presenter | null;
  strapFor(name: string): void;
  reporterInPack(name?: string): Presenter | null;
  lights(): void;
}

const PM = "ANDY BURNHAM";
const GRAVY = 0x6b3a12;
const GRAVY_LIGHT = 0x8a5222;
const CHIP = 0xf2c14e;
const CHIP_EDGE = 0x8a5a14;
const PUKE = 0xd9c27a;
const MIX = 0x5a3414;

/** A bit of flying food: chips, gravy blobs, drops. */
interface Bit {
  o: Phaser.GameObjects.Shape;
  vx: number;
  vy: number;
  g: number;
  spin: number;
  floor: number;
  land?: (b: Bit) => void;
}

/** The art's mouth for a pose (in the 128px frame), for the food that goes in and comes out. */
const MOUTH: Record<string, [number, number]> = { rest: [64, 52], retch: [63, 62], shovel: [60, 55], chew: [64, 54], burp: [64, 49], bowl: [64, 54] };

export class BurnhamShow {
  private face: "rest" | "gravy" | "smear" = "rest";
  private chips = false;
  private bits: Bit[] = [];
  private stream?: Phaser.GameObjects.Graphics;
  private streamOn = false;
  private pm: Presenter | null = null;
  private crowd: Phaser.GameObjects.Sprite[] = [];
  private blokes: Phaser.GameObjects.Sprite[] = [];
  private bowls: Phaser.GameObjects.Image[] = [];
  private shotKind = "";
  private first = true;

  constructor(private k: NewsKit) {}

  // ------------------------------------------------------------------ helpers

  private get cx() {
    return this.k.r.SX + this.k.r.SW / 2;
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T, into: Phaser.GameObjects.Container = this.k.stage): T {
    into.add(o);
    return o;
  }

  /** A new shot: the old one cleared and the food physics restarted. */
  private fresh(kind: string) {
    this.k.clearShot();
    this.shotKind = kind;
    this.bits = [];
    this.crowd = [];
    this.blokes = [];
    this.bowls = [];
    this.pm = null;
    this.stream = undefined;
    this.streamOn = false;
    this.k.every(16, () => this.step(0.016));
  }

  private step(dt: number) {
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      if (!b.o.active) {
        this.bits.splice(i, 1);
        continue;
      }
      b.vy += b.g * dt;
      b.o.x += b.vx * dt;
      b.o.y += b.vy * dt;
      b.o.angle += b.spin * dt;
      if (b.o.y >= b.floor) {
        b.land?.(b);
        b.o.destroy();
        this.bits.splice(i, 1);
      }
    }
  }

  /** A sprite's art point (128px frame, origin bottom-centre) on screen. */
  private at(p: Presenter, ax: number, ay: number) {
    const s = p.spr;
    return { x: s.x + (ax - 64) * s.scaleX, y: s.y - (128 - ay) * s.scaleY };
  }

  /** The backdrop's art point (320x240, zoomed and shifted the way backdrop() does it). */
  private bg(ax: number, ay: number, zoom = 1, ox = 0, oy = 0) {
    const { SY, SW, SH } = this.k.r;
    const s = Math.max(SW / 320, SH / 240) * zoom;
    return { x: this.cx + ox + (ax - 160) * s, y: SY + SH / 2 + oy + (ay - 120) * s, s };
  }

  private chip(x: number, y: number, s: number, color = CHIP) {
    return this.add(this.k.sc.add.rectangle(x, y, 4 * s, 12 * s, color).setStrokeStyle(Math.max(1, s * 0.8), CHIP_EDGE).setAngle(Math.random() * 360));
  }

  private blob(x: number, y: number, r: number, color = GRAVY) {
    return this.add(this.k.sc.add.circle(x, y, r, color));
  }

  private fling(o: Phaser.GameObjects.Shape, vx: number, vy: number, floor: number, land?: (b: Bit) => void, g = 900) {
    this.bits.push({ o, vx, vy, g, spin: (Math.random() - 0.5) * 720, floor, land });
  }

  /** A comic caption that pops (SCHLUP! BUUURP!). */
  private pop(text: string, x: number, y: number, color = "#fde047", size = 38, angle = -8, hold = 900) {
    const t = this.add(
      this.k.sc.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold", stroke: "#1f1300", strokeThickness: 7 }).setOrigin(0.5).setAngle(angle).setScale(0.2),
      this.k.fx,
    );
    this.k.sc.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.out" });
    this.k.sc.tweens.add({ targets: t, alpha: 0, y: y - 24, delay: hold, duration: 350, onComplete: () => t.destroy() });
    return t;
  }

  private flash(n = 1, spread = 0.9) {
    const { SX, SY, SW, SH } = this.k.r;
    for (let i = 0; i < n; i++)
      this.k.later(i * (calm() ? 260 : 90) + Math.random() * 60, () => cameraFlash(this.k.sc, this.k.fx, SX + Math.random() * SW, SY + SH * (0.35 + Math.random() * spread * 0.6), this.k.r));
  }

  private shake(ms = 220, amt = 0.006) {
    this.k.sc.cameras.main.shake(ms, calm() ? amt * 0.4 : amt);
  }

  /** Burnham's rest pose for his face so far (gravy on the chin, then the smears). */
  private restFor() {
    return this.face === "smear" ? "smear" : this.face === "gravy" ? "gravy" : "rest";
  }

  private dressPm(p: Presenter | null) {
    if (!p) return p;
    p.restPose = p.poseIndex(this.restFor());
    p.setPose(this.restFor(), false);
    this.pm = p;
    return p;
  }

  // ------------------------------------------------------------------ Downing Street shots

  /** The wide: Number 10 in the sun, the flag, the civil servants in the doorway, the PM at his lectern, the crowd. */
  private wide(opts: { mood?: "cheer" | "still" | "recoil" | "mixed"; pigeon?: boolean; pmIn?: boolean } = {}) {
    this.fresh("wide");
    const { SX, SY, SW, SH } = this.k.r;
    const sc = this.k.sc;
    const bg = this.k.backdrop("tv_burn_no10", 1.04);
    sc.tweens.add({ targets: bg, x: bg.x - 14, duration: 9000, ease: "Sine.easeInOut" });
    this.flag(1.04);
    // the civil servants, in the doorway
    if (sc.textures.exists("tv_burn_servants")) {
      [0, 1, 2].forEach((f, i) => {
        const d = this.bg(146 + i * 14, 191, 1.04);
        const s = this.add(sc.add.sprite(d.x, d.y, "tv_burn_servants", f).setOrigin(0.5, 1).setScale(1.05));
        sc.tweens.add({ targets: s, y: s.y - 1, duration: 300 + i * 40, yoyo: true, repeat: -1 });
      });
    }
    const x = SX + SW * 0.71;
    const p = this.dressPm(this.k.presenter(PM, x, SY + SH * 0.93, 1.5));
    if (p && opts.pmIn) {
      // he steps up to the podium
      p.spr.setAlpha(0).setY(p.spr.y + 40);
      sc.tweens.add({ targets: p.spr, alpha: 1, y: p.spr.y - 40, duration: 700, ease: "Quad.out" });
    }
    if (this.chips && p) this.chipBowlOn(p);
    // the press camera on its tripod, on the left, and the crowd in front
    this.pressCam(SX + SW * 0.13, SY + SH * 0.6, opts.pigeon ?? false);
    this.crowdBacks(SY + SH + 40, opts.mood ?? "cheer");
    if (opts.mood !== "still") this.k.later(400, () => this.flashLoop(700, 1800));
    this.k.stage.setScale(1.03).setPosition(-this.cx * 0.03, -(SY + SH / 2) * 0.03);
    return p;
  }

  /** The Union Jack on the roof, fluttering (its patch of the backdrop, rippled). */
  private flag(zoom: number, ox = 0, oy = 0) {
    const sc = this.k.sc;
    if (!sc.textures.exists("tv_burn_no10")) return;
    const p = this.bg(240, 0, zoom, ox, oy);
    const f = this.add(sc.add.image(p.x, p.y, "tv_burn_no10").setOrigin(0, 0).setCrop(240, 0, 40, 22));
    f.setScale(p.s).setPosition(p.x - 240 * p.s, p.y);
    sc.tweens.add({ targets: f, scaleY: p.s * 1.025, y: f.y - 1, duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private flashLoop(min: number, max: number) {
    const go = () => {
      const { SX, SY, SW, SH } = this.k.r;
      cameraFlash(this.k.sc, this.k.fx, SX + Math.random() * SW, SY + SH * (0.6 + Math.random() * 0.3), this.k.r);
      this.k.later((calm() ? 1.8 : 1) * (min + Math.random() * (max - min)), go);
    };
    go();
  }

  /** A row of the crowd from behind (flat caps, hi-vis), bobbing as they cheer, frozen when they're horrified. */
  private crowdBacks(bottom: number, mood: string) {
    const { SX, SW } = this.k.r;
    const sc = this.k.sc;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const press = i % 3 === 1 && sc.textures.exists("tvpress_backs");
      const key = press ? "tvpress_backs" : "tv_burn_crowd_back";
      if (!sc.textures.exists(key)) continue;
      const x = SX + (i + 0.5) * (SW / n) + ((i * 37) % 23) - 11;
      const s = this.add(sc.add.sprite(x, bottom + (i % 2) * 16, key, press ? (i * 5) % 16 : (i * 7 + 3) % 16).setOrigin(0.5, 1).setScale(2.2));
      this.crowd.push(s);
      if (mood === "cheer" || (mood === "mixed" && i % 3 === 0)) sc.tweens.add({ targets: s, y: s.y - 10 - (i % 3) * 4, duration: 240 + i * 40, yoyo: true, repeat: -1, ease: "Quad.out", delay: i * 60 });
      else if (mood === "recoil") sc.tweens.add({ targets: s, y: s.y + 18, x: s.x + (s.x < this.cx ? -10 : 10), duration: 260, ease: "Quad.out" });
    }
  }

  /** A broadcast camera on a tripod (drawn), optionally with a pigeon coming in to land on it. */
  private pressCam(x: number, y: number, pigeon: boolean) {
    const sc = this.k.sc;
    const c = this.add(sc.add.container(x, y));
    c.add(sc.add.rectangle(0, 120, 8, 240, 0x1f2937));
    c.add(sc.add.rectangle(0, 0, 92, 46, 0x27272a).setStrokeStyle(3, 0x0a0a0a));
    c.add(sc.add.rectangle(56, -2, 26, 34, 0x111111).setStrokeStyle(2, 0x0a0a0a));
    c.add(sc.add.circle(70, -2, 11, 0x1e3a8a).setStrokeStyle(2, 0x93c5fd));
    c.add(sc.add.rectangle(-20, -30, 40, 12, 0x3f3f46));
    c.add(sc.add.text(-38, -6, "GBK", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#c8102e", padding: { x: 2, y: 1 } }));
    const tally = c.add(sc.add.circle(-38, -18, 4, 0xef4444)) as unknown as Phaser.GameObjects.Arc;
    sc.tweens.add({ targets: tally, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    if (pigeon && sc.textures.exists("tv_burn_pigeon")) {
      const b = this.add(sc.add.sprite(x - 260, y - 220, "tv_burn_pigeon", 0).setOrigin(0.5, 1).setScale(2.2));
      // it flaps in (a squashing flutter) and lands on top of the camera, then bobs and pecks
      sc.tweens.add({ targets: b, scaleY: 1.4, duration: 90, yoyo: true, repeat: 9 });
      sc.tweens.add({
        targets: b,
        x: x - 4,
        y: y - 34,
        duration: 1800,
        ease: "Sine.easeOut",
        onComplete: () => {
          if (!b.active) return;
          synth.play("burn_coo");
          sc.tweens.add({ targets: b, y: b.y - 3, duration: 200, yoyo: true, repeat: -1, repeatDelay: 600 });
          this.k.every(1300, () => b.active && b.setFrame(b.frame.name === "0" ? 1 : 0));
        },
      });
      synth.play("burn_coo");
    } else if (this.pigeonLanded && sc.textures.exists("tv_burn_pigeon")) {
      const b = this.add(sc.add.sprite(x - 4, y - 34, "tv_burn_pigeon", 0).setOrigin(0.5, 1).setScale(2.2));
      this.k.every(1500, () => b.active && b.setFrame(b.frame.name === "0" ? 1 : 0));
    }
    if (pigeon) this.pigeonLanded = true;
    return c;
  }

  private pigeonLanded = false;

  /** In on the PM at his lectern, the street soft behind him. */
  private close(push = 1.06) {
    this.fresh("close");
    const { SY, SH } = this.k.r;
    this.k.backdrop("tv_burn_no10", 1.9, -60, -20, true);
    this.add(this.k.sc.add.rectangle(this.k.r.SX, SY, this.k.r.SW, SH, 0x000000, 0.1).setOrigin(0));
    const p = this.dressPm(this.k.presenter(PM, this.cx, SY + SH + 14, 3.15));
    if (p && this.chips) this.chipBowlOn(p);
    this.k.lights();
    this.k.camTo(push, this.cx, SY + 120, 8000);
    this.k.later(600, () => this.flashLoop(1500, 3200));
    return p;
  }

  /** The giant bowl of chips and gravy, on the lectern's lip beside his left hand (with steam). */
  private chipBowlOn(p: Presenter) {
    const sc = this.k.sc;
    if (!sc.textures.exists("tv_burn_chipbowl")) return;
    const s = p.spr.scaleX;
    const a = this.at(p, 26, 98);
    const b = this.add(sc.add.image(a.x, a.y, "tv_burn_chipbowl").setOrigin(0.5, 1).setScale(s * 0.62));
    this.steam(a.x, a.y - 50 * s * 0.62, s * 0.6);
    return b;
  }

  private steam(x: number, y: number, s: number) {
    const sc = this.k.sc;
    this.k.every(260, () => {
      const c = this.add(sc.add.circle(x + (Math.random() - 0.5) * 30 * s, y, 5 * s, 0xffffff, 0.35));
      sc.tweens.add({ targets: c, y: y - 40 * s, x: c.x + (Math.random() - 0.5) * 20 * s, alpha: 0, scale: 2, duration: 1300, onComplete: () => c.destroy() });
    });
  }

  /** The reverse angle: the crowd's faces, cheering, horrified or recoiling. */
  private crowdShot(mood: "cheer" | "still" | "recoil" | "mixed") {
    this.fresh("crowd");
    const { SX, SY, SW, SH } = this.k.r;
    const sc = this.k.sc;
    // the far side of the street, soft: the facade's brick and railings, darkened (no blur: its edge showed at this offset)
    this.k.backdrop("tv_burn_no10", 2.4, 160, 80);
    this.add(sc.add.rectangle(SX, SY, SW, SH, 0x0b1020, 0.45).setOrigin(0));
    if (!sc.textures.exists("tv_burn_crowd_front")) return;
    const rows: [number, number, number, number][] = [
      // x (0-1), bottom, scale, frame
      [0.12, 0.74, 2.6, 7], [0.37, 0.72, 2.6, 13], [0.62, 0.74, 2.6, 11], [0.87, 0.72, 2.6, 1],
      [0.0, 1.08, 3.4, 2], [0.26, 1.1, 3.4, 4], [0.52, 1.08, 3.4, 14], [0.78, 1.1, 3.4, 9], [1.02, 1.08, 3.4, 0],
    ];
    rows.forEach(([fx, fy, s, f], i) => {
      const spr = this.add(sc.add.sprite(SX + SW * fx, SY + SH * fy, "tv_burn_crowd_front", f).setOrigin(0.5, 1).setScale(s));
      if (i < 4) spr.setTint(0xb8b8c8);
      this.crowd.push(spr);
      const cheer = mood === "cheer" || (mood === "mixed" && i % 4 === 1);
      if (cheer) sc.tweens.add({ targets: spr, y: spr.y - 14, duration: 230 + (i % 3) * 50, yoyo: true, repeat: -1, ease: "Quad.out", delay: i * 70 });
      else if (mood === "recoil" || mood === "mixed") {
        // they reel back from the podium, gone a little green
        sc.tweens.add({ targets: spr, y: spr.y + 26, scaleY: s * 0.93, angle: (i % 2 ? 1 : -1) * 6, duration: 300, ease: "Back.out", delay: (i % 4) * 50 });
        spr.setTint(i < 4 ? 0xa8b8a0 : 0xd8f0c8);
      }
    });
    if (mood === "recoil") this.shake(300, 0.008);
    this.k.camTo(1.05, this.cx, SY + SH * 0.5, 5000);
  }

  /** The civil servants in the doorway, clapping politely, a bit lost. */
  private doorway() {
    this.fresh("door");
    const sc = this.k.sc;
    // in on the doorway: the art's door (x 160, the step at y 190) a little below the middle of the picture
    const z = 2.4;
    const oy = -(165 - 120) * 1.75 * z;
    this.k.backdrop("tv_burn_no10", z, 0, oy);
    if (!sc.textures.exists("tv_burn_servants")) return;
    [0, 1, 2, 3].forEach((f, i) => {
      const d = this.bg(140 + i * 13.5, 192, z, 0, oy);
      const s = this.add(sc.add.sprite(d.x, d.y, "tv_burn_servants", f).setOrigin(0.5, 1).setScale(z * 0.95));
      // the polite clap: a small squash every half second, out of time with each other
      sc.tweens.add({ targets: s, scaleX: z * 0.92, duration: 120, yoyo: true, repeat: -1, repeatDelay: 380 + i * 70, delay: i * 130 });
    });
    this.k.camTo(1.05, this.cx, this.k.r.SY + 200, 4000);
  }

  /** The aide, close: carrying in the chips, or holding the bowl and wanting to die. */
  private aideClose(horror: boolean) {
    this.fresh("aide");
    const { SY, SH } = this.k.r;
    const sc = this.k.sc;
    this.k.backdrop("tv_burn_no10", 2.1, 120, -40, true);
    const key = horror ? "tv_burn_aide_horror" : "tv_burn_aide";
    if (!sc.textures.exists(key)) return;
    const a = this.add(sc.add.image(this.cx + 30, SY + SH + 10, key).setOrigin(0.5, 1).setScale(3.3));
    if (horror) {
      sc.tweens.add({ targets: a, x: a.x + 3, duration: 50, yoyo: true, repeat: -1 });
      // sweat
      this.k.every(500, () => {
        const d = this.add(sc.add.ellipse(a.x - 40 + Math.random() * 80, SY + 90, 6, 10, 0x9fd3ff));
        sc.tweens.add({ targets: d, y: d.y + 70, alpha: 0, duration: 700, onComplete: () => d.destroy() });
      });
      this.k.camTo(1.1, this.cx, SY + 120, 3000);
    }
  }

  /** "Technical difficulties" (gore off): the bars, a tone, and an apology, while it happens off air. */
  private apology(what: string) {
    this.fresh("card");
    const { SX, SY, SW, SH } = this.k.r;
    const sc = this.k.sc;
    const cols = [0xc0c0c0, 0xc0c000, 0x00c0c0, 0x00c000, 0xc000c0, 0xc00000, 0x0000c0];
    cols.forEach((c, i) => this.add(sc.add.rectangle(SX + (i * SW) / 7, SY, SW / 7 + 1, SH * 0.7, c).setOrigin(0)));
    this.add(sc.add.rectangle(SX, SY + SH * 0.7, SW, SH * 0.3, 0x111111).setOrigin(0));
    this.add(sc.add.text(this.cx, SY + SH * 0.36, "GB KREWS APOLOGISES", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#0b2a5c", padding: { x: 10, y: 6 } }).setOrigin(0.5));
    this.add(sc.add.text(this.cx, SY + SH * 0.5, what, { fontFamily: FONT, fontSize: "15px", color: "#ffffff", backgroundColor: "#111111", padding: { x: 8, y: 4 }, align: "center", wordWrap: { width: SW - 80 } }).setOrigin(0.5));
  }

  // ------------------------------------------------------------------ the gross-out

  /** He shovels it in: spoon up, chew, spoon up, chew; chips and gravy going everywhere. */
  private shovel(ms: number) {
    const p = this.close(1.08);
    if (!p) return;
    this.face = "gravy";
    p.restPose = p.poseIndex("gravy");
    let on = false;
    const sc = this.k.sc;
    const tick = () => {
      if (!p.spr.active) return;
      on = !on;
      p.setPose(on ? "shovel" : "chew", false);
      const m = this.at(p, ...(on ? MOUTH.shovel : MOUTH.chew));
      // bits flying off the spoon and out of his gob
      for (let i = 0; i < 3; i++) {
        const o = Math.random() < 0.5 ? this.chip(m.x, m.y, 2.2) : this.blob(m.x, m.y, 4 + Math.random() * 5, Math.random() < 0.5 ? GRAVY : GRAVY_LIGHT);
        this.fling(o, (Math.random() - 0.5) * 420, -120 - Math.random() * 220, this.k.r.SY + this.k.r.SH + 40);
      }
      sc.tweens.add({ targets: p.spr, y: p.spr.y + (on ? 4 : -4), duration: 80 });
    };
    tick();
    this.k.every(300, tick);
    this.k.later(ms, () => p.spr.active && p.setPose(on ? "chew" : "chew", false));
  }

  /** The SCHLUP SCHLUP: his chew close, the captions popping. */
  private schlup() {
    const p = this.pm && this.pm.spr.active ? this.pm : this.close(1.1);
    if (!p) return;
    p.setPose("chew", false);
    const m = this.at(p, ...MOUTH.chew);
    ["SCHLUP!", "SCHLUP!", "SCHLOP!"].forEach((w, i) =>
      this.k.later(i * 420, () => {
        this.pop(w, m.x + (i % 2 ? 150 : -150), m.y - 40 - i * 20, "#fbbf24", 34 + i * 4, i % 2 ? 9 : -9, 500);
        p.setPose(i % 2 ? "chew" : "gravy", false);
        const d = this.blob(m.x, m.y + 20, 5, GRAVY);
        this.fling(d, (Math.random() - 0.5) * 160, 60, this.k.r.SY + this.k.r.SH + 40);
      }),
    );
  }

  private burp() {
    const p = this.pm && this.pm.spr.active ? this.pm : this.close(1.1);
    if (!p) return;
    p.setPose("burp", false);
    const m = this.at(p, ...MOUTH.burp);
    const sc = this.k.sc;
    this.pop("BUUUUURP!", this.cx, m.y - 150, "#a3e635", 54, -4, 1500);
    this.shake(900, 0.007);
    // the shockwave rolls out over the press pen
    for (let i = 0; i < 3; i++) {
      const ring = this.add(sc.add.circle(m.x, m.y, 30, 0xd9f99d, 0).setStrokeStyle(6, 0xd9f99d, 0.7), this.k.fx);
      sc.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 900, delay: i * 220, onComplete: () => ring.destroy() });
    }
    this.k.later(1700, () => p.spr.active && p.setPose("gravy", false));
  }

  /** A twinkle in his eye. */
  private glint() {
    const p = this.close(1.12);
    if (!p) return;
    p.setPose("gravy", false);
    p.stopTalking();
    const e = this.at(p, 74, 33);
    const sc = this.k.sc;
    this.k.later(500, () => {
      const st = this.add(sc.add.star(e.x, e.y, 4, 3, 16, 0xffffff), this.k.fx).setScale(0).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: st, scale: 1.4, angle: 90, duration: 260, yoyo: true, onComplete: () => st.destroy() });
      synth.play("ding");
    });
    this.k.camTo(1.22, e.x, e.y, 2200);
  }

  private throat() {
    const p = this.close(1.12);
    if (!p) return;
    p.setPose("throat", false);
    synth.play("crowd_gasp");
    this.flash(4);
    this.k.sc.tweens.add({ targets: p.spr, x: p.spr.x + 3, duration: 60, yoyo: true, repeat: 12 });
    this.pop("GAG!", this.cx + 140, this.k.r.SY + 120, "#ffffff", 30, 10, 700);
  }

  /** The big one: HEEEUUUURGH, a cascade of half-digested chips and gravy into the aide's steel bowl. */
  private vomit() {
    if (!gore()) {
      this.crowdShot("recoil");
      this.pop("HEEEUUUURGH!", this.cx, this.k.r.SY + 90, "#bef264", 44, -6, 1800);
      this.flash(4);
      return;
    }
    this.fresh("vomit");
    const { SY, SH } = this.k.r;
    const sc = this.k.sc;
    this.k.backdrop("tv_burn_no10", 1.7, -30, -20, true);
    const p = this.dressPm(this.k.presenter(PM, this.cx - 130, SY + SH + 14, 2.6));
    if (!p) return;
    p.setPose("retch", false);
    p.restPose = p.poseIndex("retch");
    const aide = sc.textures.exists("tv_burn_aide") ? this.add(sc.add.image(this.cx + 160, SY + SH + 30, "tv_burn_aide").setOrigin(0.5, 1).setScale(2.6)) : null;
    const mouth = this.at(p, ...MOUTH.retch);
    const rim = aide ? { x: aide.x + (65 - 64) * 2.6, y: aide.y - (128 - 97) * 2.6 } : { x: this.cx + 160, y: SY + SH - 60 };
    // the bowl filling up: a puddle on the rim that grows
    const fill = this.add(sc.add.ellipse(rim.x, rim.y + 4, 150, 22, PUKE).setScale(0.05));
    const lumps = this.add(sc.add.container(0, 0));
    this.k.lights();
    this.pop("HEEEUUUURGH!", this.cx - 40, SY + 70, "#bef264", 48, -6, 1700);
    this.shake(1800, 0.005);
    if (aide) sc.tweens.add({ targets: aide, x: aide.x + 4, duration: 70, yoyo: true, repeat: -1 });
    this.k.later(250, () => {
      this.streamOn = true;
      const g = (this.stream = this.add(sc.add.graphics()));
      const T = 0.42;
      const G = 900;
      const vx = (rim.x - mouth.x) / T;
      const vy = (rim.y - mouth.y - 0.5 * G * T * T) / T;
      let t = 0;
      this.k.every(16, () => {
        if (!g.active) return;
        g.clear();
        if (!this.streamOn) return;
        t += 0.016;
        // the thick gush itself, wobbling
        const w = 12 + Math.sin(t * 30) * 4;
        const pts: Phaser.Math.Vector2[] = [];
        for (let i = 0; i <= 14; i++) {
          const s = (i / 14) * T;
          pts.push(new Phaser.Math.Vector2(mouth.x + vx * s + Math.sin(t * 25 + i) * 2, mouth.y + vy * s + 0.5 * G * s * s));
        }
        g.lineStyle(w + 6, GRAVY, 1).strokePoints(pts);
        g.lineStyle(w, PUKE, 1).strokePoints(pts);
        g.lineStyle(3, 0xfff3c4, 0.7).strokePoints(pts.slice(0, 9));
      });
      // and the chunks in it
      this.k.every(45, () => {
        if (!this.streamOn) return;
        const r = Math.random();
        const o = r < 0.45 ? this.chip(mouth.x, mouth.y, 2.2, r < 0.2 ? CHIP : PUKE) : this.blob(mouth.x, mouth.y, 4 + Math.random() * 6, r < 0.8 ? GRAVY_LIGHT : 0x9aa04a);
        this.fling(o, vx * (0.9 + Math.random() * 0.2), vy + (Math.random() - 0.5) * 80, rim.y, (b) => {
          // a splash at the bowl, and a lump that stays
          if (Math.random() < 0.5) {
            const d = this.blob(b.o.x, rim.y, 3, GRAVY_LIGHT);
            this.fling(d, (Math.random() - 0.5) * 300, -200 - Math.random() * 200, rim.y + 60);
          }
          if (lumps.list.length < 26) lumps.add(sc.add.rectangle(rim.x + (Math.random() - 0.5) * 120, rim.y + (Math.random() - 0.5) * 10, 7, 18, PUKE).setStrokeStyle(2, CHIP_EDGE).setAngle(Math.random() * 180));
        }, G);
      });
      sc.tweens.add({ targets: fill, scale: 1, duration: 1800 });
      // steam off the top
      this.steam(rim.x, rim.y - 10, 2.2);
    });
    this.k.later(2300, () => {
      this.streamOn = false;
      p.setPose("gravy", false);
      p.restPose = p.poseIndex("gravy");
    });
  }

  /** The bowl, in close-up, with what's in it now (vomit, or the brown mix), and the spoon going round. */
  private bowlInsert(mix: boolean) {
    this.fresh("bowl");
    const { SY, SH } = this.k.r;
    const sc = this.k.sc;
    this.k.backdrop("tv_burn_no10", 2.6, -100, 60, true);
    if (!sc.textures.exists("tv_burn_steelbowl")) return;
    const s = 7.5;
    const b = this.add(sc.add.image(this.cx, SY + SH * 0.62, "tv_burn_steelbowl").setScale(s));
    const top = { x: b.x + (24 - 24) * s, y: b.y + (16.5 - 24) * s };
    const col = mix ? MIX : PUKE;
    this.add(sc.add.ellipse(top.x, top.y, 33 * s, 8 * s, col));
    for (let i = 0; i < 12; i++) {
      const x = top.x + (Math.random() - 0.5) * 26 * s;
      const y = top.y + (Math.random() - 0.5) * 5 * s;
      if (Math.random() < 0.6) this.add(sc.add.rectangle(x, y, 8, 22, mix ? 0xb8893a : PUKE).setStrokeStyle(2, CHIP_EDGE).setAngle(Math.random() * 180));
      else this.add(sc.add.ellipse(x, y, 26, 10, mix ? 0x3d220c : GRAVY_LIGHT));
    }
    // bubbles that come up and pop
    this.k.every(220, () => {
      const c = this.add(sc.add.circle(top.x + (Math.random() - 0.5) * 24 * s, top.y + (Math.random() - 0.5) * 5 * s, 3, mix ? 0x7a4a1c : 0xeadba0).setStrokeStyle(2, 0x2a1606));
      sc.tweens.add({ targets: c, scale: 3, alpha: 0, duration: 600, onComplete: () => c.destroy() });
    });
    // the spoon, stirring
    const spoon = this.add(sc.add.graphics());
    let a = 0;
    this.k.every(16, () => {
      if (!spoon.active) return;
      a += 0.12;
      const hx = top.x + Math.cos(a) * 60;
      const hy = top.y + Math.sin(a) * 10;
      spoon.clear().lineStyle(10, 0xd4d4d8, 1).lineBetween(hx, hy, hx + 150, hy - 230).fillStyle(0xd4d4d8, 1).fillEllipse(hx, hy, 34, 14);
    });
    this.k.every(650, () => synth.play("burn_clink", 0.6));
    this.k.camTo(1.08, this.cx, SY + SH * 0.5, 4000);
  }

  /** The squat, behind the podium: he sinks behind a lectern drawn in front of him, under the CENSORED bar. */
  private squat() {
    if (!gore()) {
      this.apology("We are experiencing technical difficulties at Downing Street.\nPlease do not adjust your set.");
      synth.play("burn_strain");
      return;
    }
    this.fresh("squat");
    const { SX, SY, SW, SH } = this.k.r;
    const sc = this.k.sc;
    this.k.backdrop("tv_burn_no10", 1.9, -60, -20, true);
    // framed a little looser than the close, so the lectern's front is in the picture above the ticker
    const s = 2.7;
    const bottom = SY + SH - 40;
    const p = this.k.presenter(PM, this.cx, bottom, s);
    if (!p) return;
    this.pm = p;
    p.setPose("strain", false);
    p.restPose = p.poseIndex("strain");
    // the lectern, in front of him, down to the bottom of the picture: from here on he's only head and shoulders
    const lipY = bottom - (128 - 94) * s;
    const lw = 105 * s;
    const lx = this.cx + (12 + 52.5 - 64) * s;
    this.add(sc.add.rectangle(lx, lipY + 30 * s, lw, SH, 0x1c1c24).setOrigin(0.5, 0));
    if (sc.textures.exists("tv_burn_lectern")) this.add(sc.add.image(lx, lipY, "tv_burn_lectern").setOrigin(0.5, 0).setScale(s));
    else this.add(sc.add.rectangle(lx, lipY, lw, 34 * s, 0x27272a).setOrigin(0.5, 0));
    // down he goes, juddering with the effort
    sc.tweens.add({ targets: p.spr, y: bottom + 16 * s, duration: 700, ease: "Quad.inOut" });
    this.k.later(700, () => p.spr.active && sc.tweens.add({ targets: p.spr, x: p.spr.x + 3, duration: 45, yoyo: true, repeat: -1 }));
    synth.play("burn_strain");
    this.pop("NNNGGGHHH!", this.cx + 150, SY + 70, "#fca5a5", 34, 8, 1400);
    // sweat flying off
    this.k.every(260, () => {
      const h = this.at(p, 64, 30);
      const d = this.add(sc.add.ellipse(h.x, h.y, 8, 12, 0x9fd3ff), this.k.fx);
      const dir = Math.random() < 0.5 ? -1 : 1;
      sc.tweens.add({ targets: d, x: h.x + dir * (120 + Math.random() * 80), y: h.y + 60 + Math.random() * 60, alpha: 0, duration: 600, onComplete: () => d.destroy() });
    });
    // the bar goes over the whole gap between him and the lectern's lip, in front of everything
    const bar = this.add(sc.add.container(this.cx, lipY - 6), this.k.fx);
    bar.add(sc.add.rectangle(0, 0, SW + 40, 64, 0x000000));
    bar.add(sc.add.text(0, 0, "C E N S O R E D", { fontFamily: FONT, fontSize: "38px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
    bar.setAngle(-3).setScale(0, 1);
    sc.tweens.add({ targets: bar, scaleX: 1, duration: 260, delay: 500, ease: "Back.out" });
    this.censorBar = bar;
    this.k.camTo(1.04, this.cx, SY + 140, 6000);
    void SX;
  }

  private censorBar?: Phaser.GameObjects.Container;

  /** The splatters: heard, never seen. The bar jolts, the stink rises, the press pen flashes. */
  private splats() {
    if (!gore() || this.shotKind !== "squat") {
      if (!gore()) this.apology("Normal service will resume shortly.");
      return;
    }
    const sc = this.k.sc;
    const { SY } = this.k.r;
    ["SPLAT!", "PLOP!", "SPLORT!", "SPLAT!"].forEach((w, i) =>
      this.k.later(i * 520, () => {
        this.pop(w, this.cx + (i % 2 ? 170 : -170), SY + 260 + (i % 2) * 20, "#d97706", 34, i % 2 ? 10 : -10, 380);
        this.shake(140, 0.006);
        const bar = this.censorBar;
        if (bar?.active) sc.tweens.add({ targets: bar, y: bar.y - 10, duration: 70, yoyo: true });
        this.flash(2);
      }),
    );
    // stink lines, wafting up from behind the lectern
    this.k.every(200, () => {
      const x = this.cx + (Math.random() - 0.5) * 300;
      const l = this.add(sc.add.text(x, SY + 330, "~", { fontFamily: FONT, fontSize: "40px", color: "#84cc16", fontStyle: "bold" }).setOrigin(0.5).setAngle(90), this.k.fx);
      sc.tweens.add({ targets: l, y: l.y - 160, alpha: 0, x: x + (Math.random() - 0.5) * 40, duration: 1600, onComplete: () => l.destroy() });
    });
  }

  private gurgle() {
    const p = this.close(1.1);
    if (!p) return;
    p.setPose("wince", false);
    p.restPose = p.poseIndex("wince");
    const sc = this.k.sc;
    const belly = this.at(p, 64, 92);
    this.pop("GURGLE...", belly.x + 150, belly.y - 160, "#a3e635", 34, 6, 1400);
    sc.tweens.add({ targets: p.spr, scaleX: p.spr.scaleX * 1.03, duration: 110, yoyo: true, repeat: 7 });
    for (let i = 0; i < 5; i++)
      this.k.later(i * 240, () => {
        const c = this.add(sc.add.circle(belly.x + (Math.random() - 0.5) * 80, belly.y, 6, 0xa3e635, 0.5).setStrokeStyle(2, 0x3f6212), this.k.fx);
        sc.tweens.add({ targets: c, y: c.y - 40, scale: 2, alpha: 0, duration: 600, onComplete: () => c.destroy() });
      });
  }

  /** The sausage roll, lobbed from the back of the crowd, end over end, bouncing off the lectern. */
  private sausageRoll() {
    const p = this.wide({ mood: "cheer" });
    synth.play("burn_crowd_cheer");
    const sc = this.k.sc;
    if (!sc.textures.exists("tv_burn_roll")) return;
    const { SX, SY, SH } = this.k.r;
    const to = p ? this.at(p, 40, 92) : { x: this.cx, y: SY + SH * 0.6 };
    this.k.later(500, () => {
      const r = this.add(sc.add.image(SX + 40, SY + SH + 20, "tv_burn_roll").setScale(2.4), this.k.fx);
      sc.tweens.add({ targets: r, angle: 900, duration: 1100 });
      sc.tweens.add({ targets: r, x: to.x, duration: 1100, ease: "Linear" });
      sc.tweens.add({
        targets: r,
        y: SY + 40,
        duration: 550,
        ease: "Quad.out",
        yoyo: true,
        onYoyo: () => undefined,
        onComplete: () => {
          if (!r.active) return;
          synth.play("hit");
          this.pop("BONK!", to.x, to.y - 40, "#fde047", 26, 12, 500);
          sc.tweens.add({ targets: r, x: r.x + 120, y: SY + SH + 60, angle: r.angle + 400, duration: 700, ease: "Quad.in", onComplete: () => r.destroy() });
        },
      });
    });
  }

  // ------------------------------------------------------------------ the 'Spoons

  /** The blokes' table: the four of them behind it, pints and bowls of (their own) chips and gravy, the telly up in the corner. */
  private pubWide(tvClose = false) {
    this.fresh("pub");
    const { SX, SY, SW, SH } = this.k.r;
    const sc = this.k.sc;
    // the telly is up in the art's top-right corner: for the close, the picture is pinned to that corner
    const z = tvClose ? 2.6 : 1.04;
    const s = Math.max(SW / 320, SH / 240) * z;
    const ox = tvClose ? SX + SW - this.cx - 160 * s : 0;
    const oy = tvClose ? SY - (SY + SH / 2) + 120 * s : 0;
    this.k.backdrop("tv_burn_spoons", z, ox, oy);
    this.pubTelly(z, ox, oy);
    if (tvClose) {
      this.k.camTo(1.06, this.cx, SY + SH / 2, 2400);
      return;
    }
    const xs = [0.15, 0.38, 0.62, 0.85];
    xs.forEach((fx, i) => {
      const key = `tvface_PUB_PATRON_${i + 1}`;
      if (!sc.textures.exists(key)) return;
      const s = this.add(sc.add.sprite(SX + SW * fx, SY + SH * 0.86, key, 0).setOrigin(0.5, 1).setScale(1.55));
      this.blokes.push(s);
      // eating: heads dip to the bowl and come up chewing
      sc.tweens.add({ targets: s, y: s.y + 8, duration: 420, yoyo: true, repeat: -1, delay: i * 230, repeatDelay: 500 + i * 120 });
      this.k.every(240 + i * 30, () => s.active && s.setFrame(Math.random() < 0.5 ? 0 : 1));
    });
    this.beardGravy(this.blokes[3], 1.55);
    // the table
    const ty = SY + SH * 0.8;
    this.add(sc.add.rectangle(SX - 10, ty, SW + 20, SH, 0x4a2a14).setOrigin(0).setStrokeStyle(4, 0x2a160a));
    this.add(sc.add.rectangle(SX - 10, ty, SW + 20, 10, 0x6b3f1d).setOrigin(0));
    // the sticky rings
    for (let i = 0; i < 7; i++) this.add(sc.add.ellipse(SX + 40 + i * 80, ty + 24 + (i % 2) * 14, 34, 10).setStrokeStyle(2, 0x2a160a, 0.8));
    xs.forEach((fx, i) => {
      const x = SX + SW * fx;
      if (sc.textures.exists("tv_burn_chipbowl")) this.bowls.push(this.add(sc.add.image(x + (i % 2 ? 26 : -26), ty + 26, "tv_burn_chipbowl").setScale(1.5).setTint(0xe8dcb0)));
      this.pint(x + (i % 2 ? -50 : 50), ty + 20);
    });
  }

  private pint(x: number, y: number) {
    const sc = this.k.sc;
    this.add(sc.add.rectangle(x, y, 26, 46, 0xb45309, 0.92).setOrigin(0.5, 1).setStrokeStyle(2, 0xfef3c7, 0.7));
    this.add(sc.add.rectangle(x, y - 46, 26, 8, 0xfffbeb).setOrigin(0.5, 1));
  }

  /** Gravy in his beard (blobs on the chin). */
  private beardGravy(s: Phaser.GameObjects.Sprite | undefined, sc: number) {
    if (!s) return;
    for (const [dx, dy, r] of [[-6, 22, 4], [4, 24, 5], [10, 20, 3], [-2, 28, 3]] as [number, number, number][]) {
      const b = this.add(this.k.sc.add.circle(s.x + dx * sc, s.y - (128 - 64 - dy) * sc, r * sc, GRAVY));
      this.k.sc.tweens.add({ targets: b, y: b.y + 2 * sc, duration: 420, yoyo: true, repeat: -1, delay: 230 * 3 });
    }
  }

  /** The muted telly in the corner, showing the presser: Number 10, the PM tucking into his bowl, a LIVE strap. */
  private pubTelly(z: number, ox: number, oy: number) {
    const sc = this.k.sc;
    const q = [this.bg(284, 13, z, ox, oy), this.bg(320, 5, z, ox, oy), this.bg(320, 37, z, ox, oy), this.bg(286, 43, z, ox, oy)];
    const g = sc.make.graphics({}, false);
    g.fillStyle(0xffffff).fillPoints(q.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    const tv = this.add(sc.add.container(0, 0));
    tv.setMask(g.createGeometryMask());
    const minX = Math.min(...q.map((p) => p.x));
    const maxX = Math.max(...q.map((p) => p.x));
    const minY = Math.min(...q.map((p) => p.y));
    const maxY = Math.max(...q.map((p) => p.y));
    const w = maxX - minX;
    const h = maxY - minY;
    if (sc.textures.exists("tv_burn_no10")) tv.add(sc.add.image(minX + w / 2, minY + h / 2, "tv_burn_no10").setDisplaySize(w * 1.1, h * 1.1));
    if (sc.textures.exists("tvanchor_BURNHAM")) {
      const pm = sc.add.sprite(minX + w * 0.62, maxY + 2, "tvanchor_BURNHAM", 10 * 4).setOrigin(0.5, 1).setDisplaySize(h * 0.95, h * 0.95);
      tv.add(pm);
      sc.tweens.add({ targets: pm, y: pm.y - h * 0.03, duration: 300, yoyo: true, repeat: -1 });
    }
    tv.add(sc.add.rectangle(minX, maxY - h * 0.16, w, h * 0.16, 0xc8102e).setOrigin(0));
    tv.add(sc.add.rectangle(minX, maxY - h * 0.08, w, h * 0.08, 0x0b2a5c).setOrigin(0));
    const glare = sc.add.rectangle(minX, minY, w, h, 0xffffff, 0.06).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    tv.add(glare);
    sc.tweens.add({ targets: glare, alpha: 0.18, duration: 140, yoyo: true, repeat: -1, repeatDelay: 900 });
  }

  /** One bloke, close: his bowl in front of him, chewing his own sick. */
  private blokeClose(n: number) {
    this.fresh("bloke");
    const { SY, SH } = this.k.r;
    const sc = this.k.sc;
    this.k.backdrop("tv_burn_spoons", 1.8, [120, -60, 80, -100][n - 1], 10, true);
    const key = `tvface_PUB_PATRON_${n}`;
    if (!sc.textures.exists(key)) return null;
    const s = this.add(sc.add.sprite(this.cx + (n % 2 ? -30 : 30), SY + SH + 30, key, 0).setOrigin(0.5, 1).setScale(3.3));
    this.blokes = [s];
    if (n === 4) this.beardGravy(s, 3.3);
    if (sc.textures.exists("tv_burn_chipbowl")) {
      const b = this.add(sc.add.image(this.cx + (n % 2 ? 150 : -150), SY + SH - 40, "tv_burn_chipbowl").setScale(3.2).setTint(0xe8dcb0));
      this.bowls = [b];
      this.steam(b.x, b.y - 90, 2.4);
    }
    this.k.camTo(1.05, this.cx, SY + 160, 6000);
    return s;
  }

  /** A bloke's mouth going while his line plays (the patron art has a closed and an open frame). */
  private blokeTalk(s: Phaser.GameObjects.Sprite | null | undefined, ms: number) {
    if (!s) return;
    const t0 = this.k.sc.time.now;
    let heard = false;
    this.k.every(110, () => {
      if (!s.active) return;
      if (voice.busy()) heard = true;
      const el = this.k.sc.time.now - t0;
      const going = heard ? voice.busy() : el < ms;
      s.setFrame(going ? (Math.random() < 0.6 ? 1 : 0) : 0);
    });
    this.k.sc.tweens.add({ targets: s, angle: { from: -1, to: 1 }, duration: 380, yoyo: true, repeat: Math.ceil(ms / 760) });
  }

  /** "To the North!": the bowls go up and clink together, gravy everywhere. */
  private toast() {
    this.pubWide();
    const sc = this.k.sc;
    const { SY, SH } = this.k.r;
    const mid = { x: this.cx, y: SY + SH * 0.36 };
    this.bowls.forEach((b, i) => {
      sc.tweens.add({ targets: b, x: mid.x + (i - 1.5) * 46, y: mid.y, angle: (i - 1.5) * -14, duration: 380, ease: "Back.out" });
    });
    this.k.later(400, () => {
      synth.play("burn_clink");
      this.pop("CLINK!", mid.x, mid.y - 70, "#ffffff", 36, -5, 600);
      const st = this.add(sc.add.star(mid.x, mid.y - 20, 6, 8, 30, 0xffffff), this.k.fx).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: st, scale: 2, alpha: 0, duration: 300, onComplete: () => st.destroy() });
      for (let i = 0; i < 30; i++) {
        const o = i % 4 === 0 ? this.chip(mid.x, mid.y, 1.6, PUKE) : this.blob(mid.x, mid.y, 3 + Math.random() * 5, Math.random() < 0.5 ? GRAVY : GRAVY_LIGHT);
        this.fling(o, (Math.random() - 0.5) * 700, -250 - Math.random() * 350, SY + SH * 0.84, (b) => {
          const sp = this.add(sc.add.ellipse(b.o.x, SY + SH * 0.84, 18, 6, GRAVY));
          sc.tweens.add({ targets: sp, alpha: 0.4, duration: 2000 });
        });
      }
      this.shake(160, 0.004);
    });
  }

  private laugh() {
    this.pubWide();
    synth.play("laugh");
    for (const s of this.blokes) {
      this.k.sc.tweens.add({ targets: s, y: s.y - 6, duration: 140, yoyo: true, repeat: 10 });
      this.k.every(130, () => s.active && s.setFrame(Math.random() < 0.7 ? 1 : 0));
    }
    // one raises his bowl
    const b = this.bowls[0];
    if (b) this.k.later(1400, () => b.active && this.k.sc.tweens.add({ targets: b, y: b.y - 120, angle: -10, duration: 500, ease: "Back.out" }));
  }

  // ------------------------------------------------------------------ the beat hooks

  shot(kind: string, set: string): number {
    this.shotKindScene = kind as BurnKind;
    if (kind === "spoons") {
      this.k.chrome.live("");
      this.k.chrome.headline("MEANWHILE · A WETHERSPOONS IN MANCHESTER");
      // open on the telly in the corner, then pull back to the table
      this.pubWide(true);
      return 1600;
    }
    this.k.chrome.live("Downing Street");
    if (/CONTINUOUS/.test(set) || !this.first) {
      this.k.chrome.headline("LIVE: DOWNING STREET · THE PRIME MINISTER'S FIRST ACT");
      this.wide({ mood: "still" });
      return 900;
    }
    this.first = false;
    this.wide({ mood: "cheer" });
    return 900;
  }

  speak(name: string, text: string): number {
    const t = text.toLowerCase();
    if (name === PM) {
      let p: Presenter | null;
      let poses: string[] | undefined;
      if (/^ladies and gentlemen/.test(t)) {
        // his first words over the wide, then in on him
        p = this.wide({ mood: "cheer" });
        p?.say(text, { poses: ["raised"] });
        this.k.later(1700, () => {
          const q = this.close();
          q?.say(text, { poses: ["raised", "rest", "raised"], offset: 1700 });
          this.k.strapFor(PM);
        });
        return 0;
      }
      if (/^fock me/.test(t)) poses = ["chew"];
      else if (/southern fairy/.test(t)) poses = ["chew", "gravy"];
      else if (/^offensive/.test(t)) poses = ["gravy"];
      else if (/^urghh/.test(t)) poses = ["wince"];
      else if (/real northerners/.test(t)) poses = ["smear"];
      else if (/^actually/.test(t)) poses = ["gravy"];
      p = this.close(/^offensive/.test(t) ? 1.14 : 1.06);
      p?.say(text, poses ? { poses } : {});
      this.k.strapFor(PM);
      if (/^offensive/.test(t)) {
        // he leans into the microphone
        if (p) this.k.sc.tweens.add({ targets: p.spr, scale: p.spr.scaleX * 1.08, duration: 900, ease: "Sine.easeOut" });
      }
      if (/^\.\.\.i'm going to enjoy/.test(t)) this.k.later(400, () => synth.play("burn_clink", 0.7));
      return 0;
    }
    if (name === "REPORTER") {
      const p = this.k.reporterInPack("REPORTER");
      p?.say(text, { poses: ["mic"] });
      this.k.strapFor("REPORTER");
      return 0;
    }
    const bloke = name.match(/^NORTHERN BLOKE (\d)/);
    if (bloke) {
      const n = +bloke[1];
      if (/^to the north/i.test(text)) {
        // bowl up for the toast
        this.pubWide();
        const s = this.blokes[n - 1];
        this.blokeTalk(s, 1200);
        const b = this.bowls[n - 1];
        if (b) this.k.sc.tweens.add({ targets: b, y: b.y - 140, angle: -10, duration: 500, ease: "Back.out" });
        return 0;
      }
      const s = this.blokeClose(n);
      if (n === 3) synth.play("burn_burp", 0.8);
      if (n === 4 && s) {
        // the sleeve across the chin
        const sl = this.add(this.k.sc.add.rectangle(s.x - 260, s.y - 150, 220, 40, 0x1f2937).setAngle(-8));
        this.k.sc.tweens.add({ targets: sl, x: s.x + 260, duration: 700, delay: 200, ease: "Sine.easeInOut", onComplete: () => sl.destroy() });
      }
      this.blokeTalk(s, Math.max(1200, text.length * 65));
      this.k.strapFor(name);
      return 0;
    }
    if (name === "ALL") {
      this.pubWide();
      for (const [i, b] of this.bowls.entries()) this.k.sc.tweens.add({ targets: b, y: b.y - 140, angle: (i - 1.5) * -8, duration: 450, delay: i * 60, ease: "Back.out" });
      for (const s of this.blokes) this.blokeTalk(s, 1400);
      return 0;
    }
    return 0;
  }

  direction(a: string): number {
    const t = a.toLowerCase();
    if (this.shotKindScene === "spoons") {
      if (/all laugh/.test(t)) {
        this.laugh();
        return 2600;
      }
      if (/muted tv|classic 'spoons/.test(t)) {
        // stay on the telly a moment, then the blokes
        this.k.later(1500, () => this.pubWide());
        return 3200;
      }
      return -1;
    }
    if (/crisp morning/.test(t)) {
      this.wide({ mood: "cheer" });
      synth.play("burn_crowd_cheer", 0.6);
      return 2400;
    }
    if (/steps up to the podium/.test(t)) {
      this.wide({ mood: "cheer", pmIn: true });
      synth.play("burn_crowd_cheer");
      return 2200;
    }
    if (/cheers wildly/.test(t)) {
      this.crowdShot("cheer");
      synth.play("burn_crowd_cheer");
      this.k.later(1800, () => this.doorway());
      return 3800;
    }
    if (/slams a fist/.test(t)) {
      const p = this.close(1.08);
      p?.setPose("fist", false);
      synth.play("punch_big");
      this.shake(200, 0.01);
      this.pop("BANG!", this.cx - 140, this.k.r.SY + this.k.r.SH - 150, "#ffffff", 34, -12, 500);
      this.k.later(700, () => {
        this.crowdShot("cheer");
        synth.play("burn_crowd_cheer");
      });
      return 2600;
    }
    if (/sausage roll/.test(t)) {
      this.sausageRoll();
      return 2900;
    }
    if (/he gestures/.test(t)) {
      // the aide carries it in, then it's on the lectern, steaming
      this.aideCarries();
      return 3600;
    }
    if (/digs in|shovels chips/.test(t)) {
      this.shovel(2600);
      synth.play("burn_chew");
      return 2800;
    }
    if (/stunned silence|pigeon/.test(t)) {
      this.wide({ mood: "still", pigeon: true });
      return 3200;
    }
    if (/glint in his eye/.test(t)) {
      this.glint();
      return 2000;
    }
    if (/fingers down his throat/.test(t)) {
      this.throat();
      return 1900;
    }
    if (/picks up the bowl and starts eating the vomit/.test(t)) {
      this.eatFromBowl(false);
      return 3000;
    }
    if (/open-mouthed horror/.test(t)) {
      this.crowdShot("still");
      this.k.later(1500, () => {
        const p = this.k.reporterInPack("REPORTER");
        // she stands up
        if (p) {
          p.spr.setY(p.spr.y + 60);
          this.k.sc.tweens.add({ targets: p.spr, y: p.spr.y - 60, duration: 500, ease: "Quad.out" });
        }
      });
      return 3000;
    }
    if (/squats/.test(t)) {
      this.squat();
      return 2600;
    }
    if (/crowd recoils/.test(t)) {
      this.crowdShot("recoil");
      synth.play("burn_recoil");
      this.flash(8, 1);
      this.k.later(1700, () => {
        this.aideClose(true);
        this.flash(3);
      });
      return 3800;
    }
    if (/picks up the bowl again/.test(t)) {
      this.eatFromBowl(true);
      return 3600;
    }
    if (/waves at the cameras/.test(t)) {
      this.finale();
      return 3600;
    }
    return -1;
  }

  /** Which of the two places we're in (set by the director with each shot). */
  shotKindScene: BurnKind = "burnham";

  sfx(id: string): number {
    if (id === "burn_chew") {
      this.schlup();
      return 1500;
    }
    if (id === "burn_burp") {
      this.burp();
      return 2100;
    }
    if (id === "burn_vomit") {
      this.vomit();
      return 2900;
    }
    if (id === "burn_gurgle") {
      this.gurgle();
      return 1900;
    }
    if (id === "burn_splat") {
      this.splats();
      return 2400;
    }
    if (id === "burn_toast") {
      this.toast();
      return 2000;
    }
    return 0;
  }

  /** The aide brings the chips in: across the front of Number 10, then the bowl lands on the lectern. */
  private aideCarries() {
    this.fresh("aidein");
    const { SX, SY, SW, SH } = this.k.r;
    const sc = this.k.sc;
    this.k.backdrop("tv_burn_no10", 1.5, -80, 0);
    const p = this.dressPm(this.k.presenter(PM, SX + SW * 0.34, SY + SH + 10, 2.4));
    p?.setPose("raised", false);
    if (!sc.textures.exists("tv_burn_aide")) return;
    const a = this.add(sc.add.image(SX + SW + 160, SY + SH + 30, "tv_burn_aide").setOrigin(0.5, 1).setScale(2.4));
    const bowl = sc.textures.exists("tv_burn_chipbowl") ? this.add(sc.add.image(a.x, a.y - (128 - 96) * 2.4, "tv_burn_chipbowl").setScale(2.6)) : null;
    // an awkward shuffle in
    sc.tweens.add({ targets: [a, bowl].filter(Boolean), x: SX + SW * 0.76, duration: 1500, ease: "Sine.easeOut" });
    sc.tweens.add({ targets: [a, bowl].filter(Boolean), y: "-=6", duration: 150, yoyo: true, repeat: 4 });
    this.k.later(1700, () => {
      if (!p || !bowl?.active) return;
      p.setPose("rest", false);
      const at = this.at(p, 26, 98);
      sc.tweens.add({ targets: bowl, x: at.x, y: at.y - 32 * 1.5, scale: 2.4 * 0.62, duration: 600, ease: "Quad.inOut", onComplete: () => synth.play("burn_clink") });
      this.chips = true;
    });
    this.k.later(2500, () => bowl?.active && this.steam(bowl.x, bowl.y - 40, 1.4));
  }

  /** He eats out of the steel bowl: the bowl close first (the sick, or the brown mix, the spoon going round), then him. */
  private eatFromBowl(mix: boolean) {
    const toHim = () => {
      const p = this.close(1.1);
      if (!p) return;
      if (mix) this.face = "smear";
      p.setPose("bowl", false);
      p.restPose = p.poseIndex("bowl");
      synth.play("burn_chew");
      const m = this.at(p, ...MOUTH.bowl);
      // chewing: the jaw works (a squash and bob), bits drop off the spoon
      this.k.sc.tweens.add({ targets: p.spr, scaleY: p.spr.scaleY * 0.97, y: p.spr.y + 3, duration: 160, yoyo: true, repeat: -1 });
      this.k.every(420, () => {
        if (!p.spr.active) return;
        const o = this.blob(m.x, m.y + 10, 4 + Math.random() * 4, mix ? MIX : GRAVY_LIGHT);
        this.fling(o, (Math.random() - 0.5) * 200, -60, this.k.r.SY + this.k.r.SH + 40);
      });
      this.k.every(800, () => synth.play("burn_clink", 0.5));
      this.k.later(mix ? 2000 : 2600, () => {
        if (!p.spr.active) return;
        p.restPose = p.poseIndex(this.restFor());
      });
    };
    if (gore()) {
      this.bowlInsert(mix);
      this.k.later(1500, toHim);
    } else toHim();
  }

  /** The end: a few die-hards cheering, most of them horrified, and him waving at the cameras with his bowl. */
  private finale() {
    this.crowdShot("mixed");
    synth.play("burn_crowd_cheer", 0.5);
    this.k.later(1300, () => {
      const p = this.close(1.04);
      if (!p) return;
      p.setPose("wave", false);
      p.restPose = p.poseIndex("wave");
      this.k.sc.tweens.add({ targets: p.spr, angle: { from: -1.5, to: 1.5 }, duration: 260, yoyo: true, repeat: -1 });
      this.flash(5);
    });
  }
}

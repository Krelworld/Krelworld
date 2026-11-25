// Driving views: from the cab, or from behind the bus. A small perspective renderer in
// the manner of Krelworld's Pseudo3D projector (gfx/Pseudo3D.ts): we project points
// ourselves and paint far-to-near with flat shapes. Metres throughout; x east, y south,
// z up; yaw 0 looks north (-y). The violence juice (shake, flash, streak callouts,
// flung bodies) is borrowed from Krelworld's DriveScene.
import Phaser from "phaser";
import type { Actor, WorldState } from "../core/types";
import { HL, HW, PITCH } from "../football/config";
import { BUS_LEN, BUS_WID } from "../stadium/bus";
import { AREAS, SOLID } from "../stadium/layout";
import { LORRY_LEN, LORRY_WID } from "../stadium/vehicles";
import type { FigureStyle } from "./figures";

const NEAR = 0.3;
const FAR = 170;
const SKY_TOP = 0x5d86b8, SKY_LOW = 0xc9d8e6, FOG = 0xb8c6d2;

type V3 = { x: number; y: number; z: number };
type Cam3 = { right: number; up: number; depth: number };

const mixC = (a: number, b: number, k: number) => {
  k = Math.max(0, Math.min(1, k));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const shade = (c: number, k: number) => mixC(c, 0x000000, k);
const fogged = (c: number, depth: number) => mixC(c, FOG, (depth - 50) / (FAR - 50) * 0.85);

export class Camera3 {
  x = 0; y = 0; z = 0; yaw = 0; pitch = 0;
  fx = 0; fy = 0; fz = 0; rx = 0; ry = 0; ux = 0; uy = 0; uz = 0;
  F = 500; cx = 0; cy = 0;
  set(x: number, y: number, z: number, yaw: number, pitch: number, w: number, h: number): void {
    this.x = x; this.y = y; this.z = z; this.yaw = yaw; this.pitch = pitch;
    const cp = Math.cos(pitch);
    this.fx = cp * Math.sin(yaw); this.fy = -cp * Math.cos(yaw); this.fz = -Math.sin(pitch);
    this.rx = Math.cos(yaw); this.ry = Math.sin(yaw);
    this.ux = -this.fz * this.ry; this.uy = this.fz * this.rx; this.uz = this.fx * this.ry - this.fy * this.rx;
    this.F = Math.max(w, h * 1.3) * 0.62; this.cx = w / 2; this.cy = h * 0.46;
  }
  toCam(p: V3): Cam3 {
    const dx = p.x - this.x, dy = p.y - this.y, dz = p.z - this.z;
    return { right: dx * this.rx + dy * this.ry, up: dx * this.ux + dy * this.uy + dz * this.uz, depth: dx * this.fx + dy * this.fy + dz * this.fz };
  }
  scr(c: Cam3): { x: number; y: number } {
    return { x: this.cx + (c.right / c.depth) * this.F, y: this.cy - (c.up / c.depth) * this.F };
  }
  /** Clip a polygon (camera space) to the near plane and project it. Empty if wholly behind. */
  poly(pts: V3[]): { x: number; y: number }[] {
    const cs = pts.map((p) => this.toCam(p));
    const out: Cam3[] = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length];
      const ain = a.depth >= NEAR, bin = b.depth >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (NEAR - a.depth) / (b.depth - a.depth);
        out.push({ right: a.right + (b.right - a.right) * t, up: a.up + (b.up - a.up) * t, depth: NEAR });
      }
    }
    return out.length >= 3 ? out.map((c) => this.scr(c)) : [];
  }
  line(a: V3, b: V3): [{ x: number; y: number }, { x: number; y: number }] | null {
    let ca = this.toCam(a), cb = this.toCam(b);
    if (ca.depth < NEAR && cb.depth < NEAR) return null;
    if (ca.depth < NEAR || cb.depth < NEAR) {
      const t = (NEAR - ca.depth) / (cb.depth - ca.depth);
      const m = { right: ca.right + (cb.right - ca.right) * t, up: ca.up + (cb.up - ca.up) * t, depth: NEAR };
      if (ca.depth < NEAR) ca = m; else cb = m;
    }
    return [this.scr(ca), this.scr(cb)];
  }
}

/** Someone the bus has sent flying: drawn going up and over for a moment (view only). */
interface Fling { id: string; t0: number; vx: number; vy: number; spin: number }

export type DriveView = "map" | "chase" | "cab";

// From Krelworld's Beep Beep (scenes/BeepBeepScene.ts): the combo callouts and the shouting.
const COMBO_CALL = ["", "", "DOUBLE BUMP!", "TRIPLE BUMP!", "BUMP BUMP BUMP BUMP!", "MULTI-BUMP!", "MONSTER BUMP!", "ULTRA BUMP!!", "THREE LIONS ON MY BUMPER!!!"];
const MIK = ["RUN HIM OVER!", "GET THAT ONE!", "BEEP BEEP!", "GET OUT THE WAY!", "LIKE PLAYING GTA!", "BUMP BUMP BUMP!", "YEEEE!", "THAT ONE'S GOT A MEAL DEAL. GET HIM.", "PAVEMENT'S A ROAD IF YOU BELIEVE", "MIRROR, SIGNAL, MANSLAUGHTER", "IT'S COMING HOME!", "PORTUGAL NIL!"];
const DODGE_MIK = ["HE DODGED! THE AUDACITY!", "SHE'S DONE A FORWARD ROLL!", "PARKOUR PRICK!", "HE THINKS HE'S IN THE MATRIX"];
const DODGER_HIT = ["DIVE ALL YOU LIKE, SON!", "SHOULD'VE STAYED DOWN!", "YELLOW CARD FOR SIMULATION!"];
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

export class Drive3D {
  g: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  cam = new Camera3();
  flings: Fling[] = [];
  trauma = 0;
  flash = 0;
  flashColour = 0xff2020;
  splats: { x: number; y: number; r: number; t0: number }[] = [];
  cracked = 0;
  streak = 0;
  lastHit = -9999;
  callout: { text: string; until: number; colour: string } | null = null;
  private chaseYaw: number | null = null;
  private crowd: { x: number; y: number; c: number }[] = [];
  private steerShown = 0;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(2e7).setVisible(false);
    this.text = scene.add.text(0, 0, "", { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: "34px", fontStyle: "italic 800", color: "#fde047", stroke: "#000000", strokeThickness: 6, align: "center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2e7 + 1).setVisible(false);
  }

  /** The painted crowd in the stands, scattered once per ground. */
  buildCrowd(opp: { colour: number; colour2: number }): void {
    let seed = 777;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    this.crowd = [];
    for (const a of AREAS.filter((x) => x.seats)) {
      const n = Math.round((a.w * a.h) / 6);
      for (let i = 0; i < n; i++) {
        const away = a.id === "stand_e";
        this.crowd.push({ x: a.x + rnd() * a.w, y: a.y + rnd() * a.h, c: away ? (rnd() < 0.7 ? opp.colour : opp.colour2) : rnd() < 0.55 ? 0xf4f4f4 : rnd() < 0.5 ? 0xc8102e : 0x1b2a6b });
      }
    }
  }

  // ---------- Juice ----------
  hit(s: WorldState, who: string, hard: boolean, busFacing: number, busSpeed: number, dodger = false): void {
    const now = s.tick;
    this.trauma = Math.min(1, this.trauma + (hard ? 0.55 : 0.3));
    this.flash = hard ? 1 : 0.5; this.flashColour = 0xff2020;
    const sp = Math.max(4, busSpeed);
    this.flings.push({ id: who, t0: now, vx: Math.cos(busFacing) * sp * 0.6 + (Math.random() - 0.5) * 3, vy: Math.sin(busFacing) * sp * 0.6 + (Math.random() - 0.5) * 3, spin: (Math.random() - 0.5) * 20 });
    // A few spots on the glass; a big one now and then. Never so many you can't see out.
    for (let i = 0; i < (hard ? 3 : 1); i++) this.splats.push({ x: 0.25 + Math.random() * 0.5, y: 0.12 + Math.random() * 0.3, r: 0.008 + Math.random() * (hard ? 0.022 : 0.012), t0: now });
    if (this.splats.length > 14) this.splats.splice(0, this.splats.length - 14);
    // Beep Beep's combo: chain hits inside the window.
    this.streak = now - this.lastHit < 60 * 2.6 ? this.streak + 1 : 1;
    this.lastHit = now;
    const call = this.streak >= 2 ? COMBO_CALL[Math.min(this.streak, COMBO_CALL.length - 1)] : hard ? "BUMP!" : "CLIPPED HIM!";
    this.callout = { text: dodger ? "GOT THE DODGER!" : call, until: now + 90, colour: this.streak >= 5 ? "#f43f5e" : this.streak >= 3 ? "#fb923c" : "#fde047" };
    if (Math.random() < 0.55) this.shout(pick(dodger ? DODGER_HIT : MIK), now);
  }
  /** Someone has seen you coming and gone for the gutter. */
  dodge(s: WorldState): void { if (Math.random() < 0.35) this.shout(pick(DODGE_MIK), s.tick, "#ffffff"); }
  /** What he shouts at the windscreen. */
  shout(text: string, tick: number, colour = "#fde047"): void { this.yell = { text, until: tick + 100, colour }; }
  private yell: { text: string; until: number; colour: string } | null = null;
  private yellText: Phaser.GameObjects.Text | null = null;

  wall(s: WorldState, breach: boolean): void {
    this.trauma = 1; this.flash = 1; this.flashColour = breach ? 0xffffff : 0xffd0a0;
    if (breach) { this.cracked = 1; this.callout = { text: "THROUGH THE WALL!", until: s.tick + 120, colour: "#ffffff" }; }
  }

  // ---------- Drawing ----------
  hide(): void { this.g.setVisible(false); this.text.setVisible(false); this.yellText?.setVisible(false); this.cracked = 0; this.splats = []; this.chaseYaw = null; }

  /** The main camera zooms about the middle of the screen, scroll factor or not: undo that so we draw in screen pixels. */
  private zoom = 1; private zw = 0; private zh = 0; private dpr = 1;
  /** Lay out in CSS pixels; the canvas may have more real pixels than that (dpr). */
  private place(o: Phaser.GameObjects.Components.Transform, x = 0, y = 0): void {
    const z = this.zoom, d = this.dpr, cx = (this.zw * d) / 2, cy = (this.zh * d) / 2;
    o.setPosition(cx + (x * d - cx) / z, cy + (y * d - cy) / z);
    o.setScale(d / z);
  }

  draw(s: WorldState, view: DriveView, w: number, h: number, styleOf: (a: Actor) => FigureStyle, steer: number, zoom = 1, dpr = 1): void {
    const st = s.stadium!, bus = st.vehicles.bus, g = this.g, tick = s.tick;
    if (!bus) return this.hide();
    this.zoom = zoom; this.zw = w; this.zh = h; this.dpr = dpr;
    g.setVisible(true).clear();
    this.place(g);
    const f = bus.facing, c = Math.cos(f), sn = Math.sin(f);
    const yawOf = (ang: number) => ang + Math.PI / 2;
    // Shake.
    this.trauma = Math.max(0, this.trauma - 0.025);
    const sh = this.trauma * this.trauma;
    const jx = (Math.random() - 0.5) * sh * 24, jy = (Math.random() - 0.5) * sh * 18;
    if (view === "cab") {
      const px = bus.x + c * (BUS_LEN / 2 - 1.4), py = bus.y + sn * (BUS_LEN / 2 - 1.4);
      this.cam.set(px, py, 2.7, yawOf(f) + sh * (Math.random() - 0.5) * 0.05, 0.1 + sh * (Math.random() - 0.5) * 0.05, w, h);
      this.chaseYaw = null;
    } else {
      // The chase camera swings round after the bus, a little late.
      let want = f;
      if (this.chaseYaw === null) this.chaseYaw = want;
      let d = want - this.chaseYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      this.chaseYaw += d * 0.08; want = this.chaseYaw;
      const back = 15, up = 7.5;
      this.cam.set(bus.x - Math.cos(want) * back, bus.y - Math.sin(want) * back, up, yawOf(want), 0.3, w, h);
    }
    this.cam.cx += jx; this.cam.cy += jy;
    // The view opens out as the speed builds (Beep Beep's FOV kick).
    this.cam.F *= 1 - Math.min(0.14, Math.abs(bus.speed) / 13 * 0.14);
    const cam = this.cam;

    // Sky and the ground beneath the horizon.
    const horizonY = cam.cy - Math.tan(cam.pitch) * cam.F;
    g.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_LOW, SKY_LOW, 1).fillRect(0, 0, w, Math.max(0, horizonY));
    g.fillStyle(fogged(0x3a3d42, FAR), 1).fillRect(0, horizonY, w, h - horizonY);

    const near = (x: number, y: number, r = FAR) => Math.hypot(x - cam.x, y - cam.y) < r;
    const depthOf = (x: number, y: number, z = 0) => cam.toCam({ x, y, z }).depth;

    // Ground: areas in order, later ones on top.
    for (const a of AREAS) {
      if (a.id === "street") continue;
      const cxA = Math.max(a.x, Math.min(cam.x, a.x + a.w)), cyA = Math.max(a.y, Math.min(cam.y, a.y + a.h));
      if (!near(cxA, cyA)) continue;
      const pts = cam.poly([{ x: a.x, y: a.y, z: 0 }, { x: a.x + a.w, y: a.y, z: 0 }, { x: a.x + a.w, y: a.y + a.h, z: 0 }, { x: a.x, y: a.y + a.h, z: 0 }]);
      if (!pts.length) continue;
      const dd = Math.max(5, depthOf(cxA, cyA));
      g.fillStyle(fogged(a.floor, dd), 1).fillPoints(pts as any, true);
    }
    // Pitch markings.
    g.lineStyle(2, 0xeaf2ea, 0.85);
    const seg = (x0: number, y0: number, x1: number, y1: number) => { const l = cam.line({ x: x0, y: y0, z: 0.02 }, { x: x1, y: y1, z: 0.02 }); if (l) g.lineBetween(l[0].x, l[0].y, l[1].x, l[1].y); };
    seg(-HL, -HW, HL, -HW); seg(HL, -HW, HL, HW); seg(HL, HW, -HL, HW); seg(-HL, HW, -HL, -HW); seg(0, -HW, 0, HW);
    for (let i = 0; i < 24; i++) { const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2; seg(Math.cos(a0) * 9.15, Math.sin(a0) * 9.15, Math.cos(a1) * 9.15, Math.sin(a1) * 9.15); }
    for (const sg of [-1, 1]) { const bx = sg * (HL - 16.5); seg(sg * HL, -20.15, bx, -20.15); seg(bx, -20.15, bx, 20.15); seg(bx, 20.15, sg * HL, 20.15); }

    // Everything that stands up, far to near.
    type Thing = { d: number; draw: () => void };
    const things: Thing[] = [];
    const LIGHT = { x: 0.45, y: -0.6 };
    const boxFaces = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, side: number, top: number, dist: number) => {
      // Visible side faces, then the top.
      const faces: [V3[], number][] = [];
      if (cam.y < y0) faces.push([[{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x0, y: y0, z: z1 }], 0 * LIGHT.x + -1 * LIGHT.y]);
      if (cam.y > y1) faces.push([[{ x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }], 1 * LIGHT.y]);
      if (cam.x < x0) faces.push([[{ x: x0, y: y0, z: z0 }, { x: x0, y: y1, z: z0 }, { x: x0, y: y1, z: z1 }, { x: x0, y: y0, z: z1 }], -1 * LIGHT.x]);
      if (cam.x > x1) faces.push([[{ x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y0, z: z1 }], 1 * LIGHT.x]);
      for (const [pts, lit] of faces) {
        const p = cam.poly(pts);
        if (p.length) g.fillStyle(fogged(shade(side, 0.25 - lit * 0.2), dist), 1).fillPoints(p as any, true);
      }
      if (cam.z > z1) {
        const p = cam.poly([{ x: x0, y: y0, z: z1 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }]);
        if (p.length) g.fillStyle(fogged(top, dist), 1).fillPoints(p as any, true);
      }
    };
    // Walls, cut into short lengths so the far-to-near order holds.
    for (const wl of SOLID) {
      if (wl.gate && st.gates[wl.gate]?.until > tick) continue;
      const long = Math.max(wl.w, wl.h), n = Math.max(1, Math.ceil(long / 6));
      for (let i = 0; i < n; i++) {
        const x0 = wl.w >= wl.h ? wl.x + (wl.w * i) / n : wl.x, x1 = wl.w >= wl.h ? wl.x + (wl.w * (i + 1)) / n : wl.x + wl.w;
        const y0 = wl.w >= wl.h ? wl.y : wl.y + (wl.h * i) / n, y1 = wl.w >= wl.h ? wl.y + wl.h : wl.y + (wl.h * (i + 1)) / n;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        if (!near(mx, my)) continue;
        const d = depthOf(mx, my, wl.h3 / 2);
        if (d < -4) continue;
        const dist = Math.hypot(mx - cam.x, my - cam.y);
        things.push({ d: dist, draw: () => boxFaces(x0, y0, x1, y1, 0, wl.h3, wl.colour, wl.top, dist) });
      }
    }
    // The stands: raked blocks with a crowd on them.
    for (const a of AREAS.filter((x) => x.seats)) {
      const n = Math.max(1, Math.ceil(Math.max(a.w, a.h) / 8));
      for (let i = 0; i < n; i++) {
        const horiz = a.w >= a.h;
        const x0 = horiz ? a.x + (a.w * i) / n : a.x, x1 = horiz ? a.x + (a.w * (i + 1)) / n : a.x + a.w;
        const y0 = horiz ? a.y : a.y + (a.h * i) / n, y1 = horiz ? a.y + a.h : a.y + (a.h * (i + 1)) / n;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        if (!near(mx, my)) continue;
        const dist = Math.hypot(mx - cam.x, my - cam.y);
        things.push({ d: dist + 1.5, draw: () => boxFaces(x0, y0, x1, y1, 0, 2.2, 0x3b4250, 0x4a5160, dist) });
      }
    }
    for (const p of this.crowd) {
      if (!near(p.x, p.y, 110)) continue;
      const dist = Math.hypot(p.x - cam.x, p.y - cam.y);
      things.push({ d: dist - 0.5, draw: () => {
        const a = cam.toCam({ x: p.x, y: p.y, z: 2.2 }), b = cam.toCam({ x: p.x, y: p.y, z: 3.1 });
        if (a.depth < NEAR) return;
        const sa = cam.scr(a), sb = cam.scr(b), hh = sa.y - sb.y, ww = hh * 0.55;
        g.fillStyle(fogged(p.c, dist), 1).fillRect(sa.x - ww / 2, sb.y + hh * 0.25, ww, hh * 0.75);
        g.fillStyle(fogged(0xd8a888, dist), 1).fillCircle(sa.x, sb.y + hh * 0.15, ww * 0.35);
      } });
    }
    // Goals.
    for (const sg of [-1, 1]) {
      const gx = sg * HL, half = PITCH.goalW / 2, gh = PITCH.goalH;
      const dist = Math.hypot(gx - cam.x, -cam.y);
      if (dist > FAR) continue;
      things.push({ d: dist, draw: () => {
        g.lineStyle(Math.max(1.5, 60 / Math.max(5, dist)), 0xffffff, 1);
        for (const [a, b] of [[{ x: gx, y: -half, z: 0 }, { x: gx, y: -half, z: gh }], [{ x: gx, y: half, z: 0 }, { x: gx, y: half, z: gh }], [{ x: gx, y: -half, z: gh }, { x: gx, y: half, z: gh }]] as [V3, V3][]) {
          const l = cam.line(a, b); if (l) g.lineBetween(l[0].x, l[0].y, l[1].x, l[1].y);
        }
      } });
    }
    // Vehicles (not our own bus from the cab).
    for (const v of Object.values(st.vehicles)) {
      if (view === "cab" && v === bus) continue;
      const isBus = v.kind === "bus", len = isBus ? BUS_LEN : LORRY_LEN, wid = isBus ? BUS_WID : LORRY_WID;
      if (!near(v.x, v.y)) continue;
      const dist = Math.hypot(v.x - cam.x, v.y - cam.y);
      const team = s.match!.teams[1];
      things.push({ d: dist, draw: () => this.vehicle(v.x, v.y, v.facing, len, wid, 3.2, isBus ? (v.crashed ? 0x555555 : team.colour) : 0xd9a441, isBus ? (v.crashed ? 0x444444 : team.colour2) : 0xb8862f, dist) });
    }
    // People, and anyone in mid-air.
    const flungNow = new Map<string, { dx: number; dy: number; z: number; spin: number }>();
    this.flings = this.flings.filter((fl) => tick - fl.t0 < 80);
    for (const fl of this.flings) {
      const t = (tick - fl.t0) / 60;
      flungNow.set(fl.id, { dx: fl.vx * t, dy: fl.vy * t, z: Math.max(0, 7 * t - 9.8 * t * t * 0.5 * 1.4), spin: fl.spin * t });
    }
    for (const id in s.actors) {
      const a = s.actors[id];
      if (a.hiddenIn || (a.fb && a.fb.status === "gone" && !a.dead)) continue;
      if (!near(a.x, a.y, 120)) continue;
      const fl = flungNow.get(a.id);
      const x = a.x - (fl ? 0 : 0), y = a.y;
      const d = depthOf(x, y, 1);
      if (d < NEAR) continue;
      const dist = Math.hypot(x - cam.x, y - cam.y);
      const style = styleOf(a);
      const isDog = a.npc?.job === "dog";
      things.push({ d: dist, draw: () => this.person(x, y, style, dist, fl?.z ?? 0, fl ? fl.spin : 0, isDog, !!a.dead || (!!style.down && !fl)) });
      if (a.dead) things.push({ d: dist + 0.3, draw: () => { const p = cam.poly([{ x: x - 1, y: y - 0.7, z: 0.01 }, { x: x + 1, y: y - 0.7, z: 0.01 }, { x: x + 1, y: y + 0.7, z: 0.01 }, { x: x - 1, y: y + 0.7, z: 0.01 }]); if (p.length) g.fillStyle(0x6a0a0a, 0.9).fillPoints(p as any, true); } });
    }
    // The ball.
    const b = s.match!.ball;
    if (near(b.x, b.y, 120)) things.push({ d: Math.hypot(b.x - cam.x, b.y - cam.y), draw: () => {
      const cb = cam.toCam({ x: b.x, y: b.y, z: b.z + 0.11 }); if (cb.depth < NEAR) return;
      const p = cam.scr(cb); g.fillStyle(0xffffff, 1).fillCircle(p.x, p.y, Math.max(1.5, 0.11 * cam.F / cb.depth));
    } });
    // Smoke.
    for (const sm of st.smoke) {
      if (sm.until < tick || !near(sm.x, sm.y)) continue;
      const dist = Math.hypot(sm.x - cam.x, sm.y - cam.y);
      things.push({ d: dist - sm.r, draw: () => {
        for (let i = 0; i < 6; i++) {
          const ang = i * 1.05 + tick * 0.004, cc = cam.toCam({ x: sm.x + Math.cos(ang) * sm.r * 0.5, y: sm.y + Math.sin(ang) * sm.r * 0.5, z: 1.5 + (i % 3) });
          if (cc.depth < NEAR) continue;
          const p = cam.scr(cc); g.fillStyle(i % 2 ? 0xd9d9d4 : 0xbfc0bb, 0.6).fillCircle(p.x, p.y, (sm.r * 0.6 * cam.F) / cc.depth);
        }
      } });
    }
    things.sort((p, q) => q.d - p.d);
    for (const t of things) t.draw();

    // Our own bus from behind.
    if (view === "chase") { /* drawn in the list above */ }

    if (view === "cab") this.cabOverlay(s, w, h, steer, bus.speed);
    else {
      const mph = Math.round(Math.abs(bus.speed) * 2.237);
      g.fillStyle(0x000000, 0.55).fillRoundedRect(w / 2 - 50, 52, 100, 34, 10);
      this.speedText(w / 2, 69, `${mph} mph`);
    }

    // Speed streaks out from the middle of the screen, past about 20 mph.
    const fast = Math.abs(bus.speed) - 9;
    if (fast > 0) {
      g.lineStyle(2, 0xffffff, Math.min(0.35, fast * 0.1));
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39996 + (tick % 7) * 0.9, r0 = (0.25 + ((i * 37 + tick * 3) % 60) / 100) * w * 0.55;
        const cx = w / 2, cy = cam.cy;
        g.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6, cx + Math.cos(a) * (r0 + 40 + fast * 10), cy + Math.sin(a) * (r0 + 40 + fast * 10) * 0.6);
      }
    }
    if (this.yell && this.yell.until > tick) {
      if (!this.yellText) this.yellText = this.scene.add.text(0, 0, "", { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: "22px", fontStyle: "800", color: "#fde047", stroke: "#000000", strokeThickness: 5, align: "center", wordWrap: { width: 520 } }).setOrigin(0.5).setScrollFactor(0).setDepth(2e7 + 1);
      this.yellText.setVisible(true).setText(this.yell.text).setColor(this.yell.colour);
      this.place(this.yellText, w / 2, view === "cab" ? h * 0.66 : h * 0.74);
    } else this.yellText?.setVisible(false);

    // Flash and callouts.
    if (this.flash > 0) { g.fillStyle(this.flashColour, this.flash * 0.45).fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - 0.06); }
    if (this.callout && this.callout.until > tick) {
      const k = (this.callout.until - tick) / 90;
      this.text.setVisible(true).setText(this.callout.text).setColor(this.callout.colour).setAlpha(Math.min(1, k * 3));
      this.place(this.text, w / 2, h * 0.28);
      this.text.setScale(((1 + Math.max(0, k - 0.8) * 2) * this.dpr) / this.zoom);
    } else this.text.setVisible(false);
    if (this.speedLabel) this.speedLabel.setVisible(true);
  }

  private speedLabel: Phaser.GameObjects.Text | null = null;
  private speedText(x: number, y: number, t: string): void {
    if (!this.speedLabel) this.speedLabel = this.scene.add.text(0, 0, "", { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: "22px", fontStyle: "800", color: "#f1f4f1" }).setOrigin(0.5).setScrollFactor(0).setDepth(2e7 + 1);
    this.speedLabel.setText(t).setVisible(true);
    this.place(this.speedLabel, x, y);
  }
  hideSpeed(): void { this.speedLabel?.setVisible(false); }

  private vehicle(x: number, y: number, facing: number, len: number, wid: number, h: number, top: number, side: number, dist: number): void {
    const g = this.g, cam = this.cam, c = Math.cos(facing), sn = Math.sin(facing);
    const corner = (a: number, b: number, z: number): V3 => ({ x: x + c * a - sn * b, y: y + sn * a + c * b, z });
    const base = [corner(len / 2, wid / 2, 0), corner(len / 2, -wid / 2, 0), corner(-len / 2, -wid / 2, 0), corner(-len / 2, wid / 2, 0)];
    const faces = [0, 1, 2, 3].map((i) => [base[i], base[(i + 1) % 4]] as const)
      .map(([a, b]) => ({ a, b, d: Math.hypot((a.x + b.x) / 2 - cam.x, (a.y + b.y) / 2 - cam.y) }))
      .sort((p, q) => q.d - p.d);
    for (const { a, b } of faces) {
      const p = cam.poly([a, b, { ...b, z: h }, { ...a, z: h }]);
      if (p.length) g.fillStyle(fogged(side, dist), 1).fillPoints(p as any, true);
    }
    const tp = cam.poly(base.map((p) => ({ ...p, z: h })));
    if (tp.length) g.fillStyle(fogged(top, dist), 1).fillPoints(tp as any, true);
    // Windscreen.
    const ws = cam.poly([corner(len / 2 + 0.01, wid / 2 - 0.2, 1.4), corner(len / 2 + 0.01, -wid / 2 + 0.2, 1.4), corner(len / 2 + 0.01, -wid / 2 + 0.2, h - 0.3), corner(len / 2 + 0.01, wid / 2 - 0.2, h - 0.3)]);
    if (ws.length) g.fillStyle(fogged(0x2f4a66, dist), 1).fillPoints(ws as any, true);
  }

  private person(x: number, y: number, st: FigureStyle, dist: number, z: number, spin: number, dog: boolean, lying: boolean): void {
    const g = this.g, cam = this.cam;
    const feet = cam.toCam({ x, y, z });
    if (feet.depth < NEAR) return;
    const H = dog ? 0.7 : (st.height ?? 1.8);
    const head = cam.toCam({ x, y, z: z + H });
    const pf = cam.scr(feet), ph = cam.scr(head);
    const hpx = Math.max(2, pf.y - ph.y), wpx = hpx * (dog ? 1.2 : 0.3 * (st.girth ?? 1));
    if (dog) {
      g.fillStyle(fogged(0x6b4a32, dist), 1).fillEllipse(pf.x, pf.y - hpx * 0.55, wpx, hpx * 0.7);
      g.fillStyle(fogged(0xe8ddd0, dist), 1).fillEllipse(pf.x, pf.y - hpx * 0.45, wpx * 0.35, hpx * 0.4);
      g.fillStyle(fogged(0x6b4a32, dist), 1).fillCircle(pf.x, pf.y - hpx * 0.95, hpx * 0.32);
      return;
    }
    if (lying) {
      g.fillStyle(fogged(st.shirt, dist), 1).fillEllipse(pf.x, pf.y - hpx * 0.06, hpx * 0.9, hpx * 0.16);
      g.fillStyle(fogged(st.skin, dist), 1).fillCircle(pf.x + hpx * 0.45, pf.y - hpx * 0.08, hpx * 0.08);
      return;
    }
    if (spin) {
      // Cartwheeling: a rotated rectangle and a head.
      const a = spin, cx = pf.x, cy = pf.y - hpx / 2;
      const dx = Math.sin(a) * hpx / 2, dy = Math.cos(a) * hpx / 2;
      g.lineStyle(wpx, fogged(st.shirt, dist), 1).lineBetween(cx - dx, cy + dy, cx + dx * 0.4, cy - dy * 0.4);
      g.fillStyle(fogged(st.skin, dist), 1).fillCircle(cx + dx, cy - dy, hpx * 0.1);
      return;
    }
    g.fillStyle(fogged(st.shorts ?? 0x2b3b55, dist), 1).fillRect(pf.x - wpx * 0.4, pf.y - hpx * 0.45, wpx * 0.8, hpx * 0.45);
    g.fillStyle(fogged(st.shirt, dist), 1).fillRect(pf.x - wpx / 2, pf.y - hpx * 0.82, wpx, hpx * 0.4);
    if (st.vest) g.fillStyle(fogged(st.vest, dist), 1).fillRect(pf.x - wpx * 0.35, pf.y - hpx * 0.8, wpx * 0.7, hpx * 0.32);
    g.fillStyle(fogged(st.skin, dist), 1).fillCircle(pf.x, pf.y - hpx * 0.9, hpx * 0.1);
    if (st.hat) g.fillStyle(fogged(st.hat, dist), 1).fillRect(pf.x - hpx * 0.1, pf.y - hpx * 1.0, hpx * 0.2, hpx * 0.06);
  }

  private cabOverlay(s: WorldState, w: number, h: number, steer: number, speed: number): void {
    const g = this.g, tick = s.tick;
    // Blood on the glass, fading.
    this.splats = this.splats.filter((p) => tick - p.t0 < 60 * 12);
    for (const p of this.splats) {
      const a = 1 - (tick - p.t0) / (60 * 12);
      g.fillStyle(0x8a0a0a, 0.7 * a).fillCircle(p.x * w, p.y * h, p.r * w);
      for (let k = 0; k < 4; k++) g.fillCircle(p.x * w + Math.cos(k * 1.7 + p.r * 99) * p.r * w * 1.5, p.y * h + Math.sin(k * 1.7 + p.r * 99) * p.r * w * 1.2, p.r * w * 0.3);
      g.fillStyle(0x8a0a0a, 0.45 * a).fillRect(p.x * w - 1.5, p.y * h, 3, p.r * w * 2.5 * (1.5 - a));
    }
    if (this.cracked > 0) {
      g.lineStyle(1.5, 0xffffff, 0.7);
      const cx = w * 0.42, cy = h * 0.3;
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, l = w * (0.12 + (i % 3) * 0.08); g.lineBetween(cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.7); }
    }
    // Pillars, dash and wheel.
    g.fillStyle(0x15171a, 1);
    g.fillPoints([{ x: 0, y: 0 }, { x: w * 0.07, y: 0 }, { x: w * 0.025, y: h * 0.72 }, { x: 0, y: h * 0.72 }] as any, true);
    g.fillPoints([{ x: w, y: 0 }, { x: w * 0.93, y: 0 }, { x: w * 0.975, y: h * 0.72 }, { x: w, y: h * 0.72 }] as any, true);
    g.fillRect(0, 0, w, h * 0.045);
    g.fillStyle(0x23262c, 1).fillRect(0, h * 0.72, w, h * 0.28);
    g.fillStyle(0x2d3138, 1).fillRect(0, h * 0.72, w, h * 0.025);
    this.steerShown += (steer - this.steerShown) * 0.25;
    const wx = w * 0.34, wy = h * 0.98, wr = Math.min(w, h) * 0.24;
    g.lineStyle(wr * 0.13, 0x0e0f12, 1).strokeCircle(wx, wy, wr);
    const a = this.steerShown * 1.6;
    g.lineStyle(wr * 0.11, 0x0e0f12, 1).lineBetween(wx, wy, wx + Math.cos(a - Math.PI / 2) * -wr * 0, wy - wr);
    g.lineBetween(wx, wy, wx + Math.cos(a + Math.PI) * wr, wy + Math.sin(a + Math.PI) * wr);
    g.lineBetween(wx, wy, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
    // Speedo.
    const mph = Math.round(Math.abs(speed) * 2.237);
    const sx = w * 0.7, sy = h * 0.87, sr = Math.min(w, h) * 0.09;
    g.fillStyle(0x0b0c0e, 1).fillCircle(sx, sy, sr);
    g.lineStyle(2, 0x9aa4b0, 1).strokeCircle(sx, sy, sr);
    const na = Math.PI * 0.8 + Math.min(1, mph / 40) * Math.PI * 1.4;
    g.lineStyle(3, 0xff5a36, 1).lineBetween(sx, sy, sx + Math.cos(na) * sr * 0.85, sy + Math.sin(na) * sr * 0.85);
    this.speedText(sx, sy + sr + 14, `${mph} mph`);
  }
}

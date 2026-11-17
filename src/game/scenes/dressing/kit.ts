import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import * as Juice from "../../gfx/Juice";
import { FONT } from "../../ui/theme";
import type { RoomDef } from "../../../data/dungeons";
import { puff, softLight } from "./floors";

/**
 * The set-dressing kit for the top-down rooms: furniture (y-sorted, always under the fighters), floor decals, signs
 * and posters on the back wall, light pools, flickering strip lights, steam, drips, dust, flies, a vignette, and
 * little things you can kick over or shoot to bits (they never stop a bullet).
 *
 * Depth plan (DungeonScene): floor 0, walls 1, decals 1.2-1.9, wall dressing 2, furniture 6-7 (pickups are 15,
 * enemies sort by y from ~30 up, the player is 500), overhead atmosphere 860-875, the screen vignette 880.
 */

export const DEPTH = { decal: 1.4, light: 1.8, wall: 2.05, prop: 6, overhead: 862, vignette: 880 };

interface Knock {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
  x: number;
  y: number;
  r: number;
  colors: number[];
  sfx: string;
  done: boolean;
  /** shot or kicked: falls over in place (true) or goes flying (false) */
  topple?: boolean;
}

export interface PropOpts {
  scale?: number;
  /** solid footprint [w, h] centred on the foot line (just above it) */
  block?: [number, number];
  flip?: boolean;
  tint?: number;
  alpha?: number;
  angle?: number;
  depth?: number;
  origin?: [number, number];
}

export class Kit {
  readonly calm: boolean;
  readonly rnd: Phaser.Math.RandomDataGenerator;
  private knocks: Knock[] = [];
  private updaters: ((now: number, dt: number) => void)[] = [];
  /** places the player starts and walks in through: keep these clear of furniture */
  readonly keepClear: Phaser.Geom.Rectangle[];

  constructor(
    readonly sc: Phaser.Scene,
    readonly r: RoomDef,
    private obstacles: Phaser.Physics.Arcade.StaticGroup,
    seed: string,
  ) {
    this.calm = !!G.meta?.settings?.calmFlash;
    this.rnd = new Phaser.Math.RandomDataGenerator([seed]);
    this.keepClear = [new Phaser.Geom.Rectangle(r.w / 2 - 90, 0, 180, 150), new Phaser.Geom.Rectangle(r.w / 2 - 80, r.h - 170, 160, 170)];
    puff(sc);
    softLight(sc);
  }

  has(key: string) {
    return this.sc.textures.exists(key);
  }

  /** A piece of furniture standing with its feet at (x, y). Drawn under everyone who fights. */
  prop(key: string, x: number, y: number, o: PropOpts = {}): Phaser.GameObjects.Image | null {
    if (!this.has(key)) return null;
    const img = this.sc.add.image(x, y, key).setOrigin(...(o.origin ?? [0.5, 1])).setScale(o.scale ?? 1.6);
    img.setDepth(o.depth ?? DEPTH.prop + y / 1000);
    if (o.flip) img.setFlipX(true);
    if (o.tint !== undefined) img.setTint(o.tint);
    if (o.alpha !== undefined) img.setAlpha(o.alpha);
    if (o.angle) img.setAngle(o.angle);
    if (o.block) this.block(x, y - o.block[1] / 2 - 2, o.block[0], o.block[1]);
    // a contact shadow so it sits on the floor
    if (o.origin === undefined) this.sc.add.ellipse(x, y - 2, img.displayWidth * 0.8, Math.max(8, img.displayHeight * 0.12), 0x000000, 0.28).setDepth(DEPTH.decal + 0.3);
    return img;
  }

  /** An invisible solid box (centre x, y). */
  block(x: number, y: number, w: number, h: number) {
    const rect = this.sc.add.rectangle(x, y, w, h, 0, 0);
    this.obstacles.add(rect);
  }

  /** A flat thing on the floor (rug, stain, puddle, chalk): under everything. */
  decal(key: string, x: number, y: number, scale = 1.6, alpha = 1, angle = 0) {
    if (!this.has(key)) return null;
    return this.sc.add.image(x, y, key).setScale(scale).setAlpha(alpha).setAngle(angle).setDepth(DEPTH.decal);
  }

  /** Something drawn with graphics, flat on the floor. */
  floorG(depth = DEPTH.decal) {
    return this.sc.add.graphics().setDepth(depth);
  }

  /** Graphics on the back wall (y 0..56). */
  wallG() {
    return this.sc.add.graphics().setDepth(DEPTH.wall);
  }

  /** Text on the back wall or floor. */
  text(x: number, y: number, t: string, size: number, color: string, o: { depth?: number; font?: string; stroke?: string; angle?: number; alpha?: number; align?: string } = {}) {
    const tx = this.sc.add
      .text(x, y, t, { fontFamily: o.font ?? FONT, fontSize: `${size}px`, color, align: o.align ?? "center", stroke: o.stroke ?? "#000000", strokeThickness: o.stroke ? 3 : 0 })
      .setOrigin(0.5)
      .setDepth(o.depth ?? DEPTH.wall + 0.01);
    if (o.angle) tx.setAngle(o.angle);
    if (o.alpha !== undefined) tx.setAlpha(o.alpha);
    return tx;
  }

  /** A board/poster on the back wall: a framed rectangle with words. */
  poster(x: number, y: number, w: number, h: number, bg: number, frame: number, lines: string, color: string, size = 9, angle = 0) {
    const g = this.wallG().setPosition(x, y).setAngle(angle);
    g.fillStyle(0x000000, 0.35).fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    g.fillStyle(frame, 1).fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
    g.fillStyle(bg, 1).fillRect(-w / 2, -h / 2, w, h);
    this.text(x, y, lines, size, color, { angle });
    return g;
  }

  /** A pool of light on the floor (additive). `flicker`: a dodgy tube. Returns the light. */
  light(x: number, y: number, radius: number, color: number, alpha: number, flicker: "none" | "buzz" | "breathe" | "fire" = "none") {
    const img = this.sc.add.image(x, y, "dd_softlight").setTint(color).setAlpha(alpha).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.ADD);
    img.setDisplaySize(radius * 2, radius * 1.5);
    if (flicker === "breathe" || (flicker !== "none" && this.calm)) this.sc.tweens.add({ targets: img, alpha: alpha * 0.7, yoyo: true, repeat: -1, duration: 1800 + this.rnd.between(0, 900), ease: "Sine.inOut" });
    else if (flicker === "fire") this.sc.tweens.add({ targets: img, alpha: { from: alpha * 0.75, to: alpha }, scaleX: img.scaleX * 1.06, yoyo: true, repeat: -1, duration: 120 + this.rnd.between(0, 80) });
    else if (flicker === "buzz") this.buzz([img], alpha);
    return img;
  }

  /** A fluorescent tube that has seen better days: on, then the odd stutter (steady under Reduce Flashing). */
  buzz(targets: { setAlpha(v: number): unknown }[], alpha: number) {
    if (this.calm) return;
    const tick = () => {
      const seq = [0.15, 1, 0.3, 1, 0.1, 1];
      const n = 2 + Math.floor(Math.random() * 4);
      let t = 0;
      for (let i = 0; i < n; i++) {
        const v = seq[i % seq.length];
        this.sc.time.delayedCall(t, () => targets.forEach((o) => o.setAlpha(alpha * v)));
        t += 40 + Math.random() * 70;
      }
      this.sc.time.delayedCall(t, () => targets.forEach((o) => o.setAlpha(alpha)));
      this.sc.time.delayedCall(t + 1800 + Math.random() * 4200, tick);
    };
    this.sc.time.delayedCall(800 + Math.random() * 2000, tick);
  }

  /** Strip lights down the room: a soft cool pool under each tube, the tube itself as a bright bar overhead. */
  stripLights(ys: number[], xs: number[], color = 0xe8f4ff, alpha = 0.18, dodgy = 1) {
    let i = 0;
    for (const y of ys)
      for (const x of xs) {
        const pool = this.light(x, y, 150, color, alpha);
        const tube = this.sc.add.rectangle(x, y - 40, 70, 5, 0xffffff, 0.55).setDepth(DEPTH.overhead).setBlendMode(Phaser.BlendModes.ADD);
        if (i++ % 4 === dodgy) this.buzz([pool, tube], alpha);
      }
  }

  /** A screen vignette (and a faint colour cast). */
  vignette(alpha = 0.45, color = 0x000000, cast?: { color: number; alpha: number }) {
    const v = Juice.vignette(this.sc, color, alpha, DEPTH.vignette);
    if (cast) {
      // the colour cast goes on the floor and walls (a tint is free; a full-screen multiply isn't, on a software renderer)
      const mix = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(cast.color), 1, Math.min(1, cast.alpha * 2));
      const tint = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
      for (const o of this.sc.children.list) if (o instanceof Phaser.GameObjects.TileSprite && o.depth <= 1 && !o.isTinted) o.setTint(tint);
    }
    return v;
  }

  /** Dust in the air: specks drifting slowly through the light. */
  motes(n: number, color = 0xffffff, alpha = 0.35, area?: Phaser.Geom.Rectangle) {
    const a = area ?? new Phaser.Geom.Rectangle(30, 60, this.r.w - 60, this.r.h - 90);
    for (let i = 0; i < n; i++) {
      const x = a.x + this.rnd.frac() * a.width;
      const y = a.y + this.rnd.frac() * a.height;
      const m = this.sc.add.rectangle(x, y, 2, 2, color, alpha * (0.4 + this.rnd.frac() * 0.6)).setDepth(DEPTH.overhead);
      this.sc.tweens.add({
        targets: m,
        x: x + this.rnd.between(-40, 40),
        y: y + this.rnd.between(-50, 20),
        alpha: { from: m.alpha, to: 0.05 },
        yoyo: true,
        repeat: -1,
        duration: this.rnd.between(3500, 7000),
        ease: "Sine.inOut",
        delay: this.rnd.between(0, 2000),
      });
    }
  }

  /** Steam (or smoke) puffing out at (x, y), drifting `dir` (radians), every ~`every` ms. A small pool of puffs. */
  steam(x: number, y: number, o: { every?: number; dir?: number; color?: number; alpha?: number; size?: number; dist?: number; burst?: boolean } = {}) {
    const n = 5;
    const pool: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < n; i++) pool.push(this.sc.add.image(x, y, "dd_puff").setVisible(false).setDepth(DEPTH.overhead).setTint(o.color ?? 0xffffff));
    let k = 0;
    const dir = o.dir ?? -Math.PI / 2;
    const dist = o.dist ?? 70;
    const emit = () => {
      const p = pool[k++ % n];
      const s = (o.size ?? 1) * (0.6 + Math.random() * 0.4);
      p.setPosition(x + (Math.random() - 0.5) * 8, y).setScale(s).setAlpha(o.alpha ?? 0.5).setVisible(true);
      const a = dir + (Math.random() - 0.5) * 0.5;
      this.sc.tweens.add({ targets: p, x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist, scale: s * 2.2, alpha: 0, duration: 1600 + Math.random() * 600, ease: "Sine.out" });
    };
    const every = o.every ?? 420;
    if (o.burst) {
      // the odd hiss: a few puffs at once, then quiet
      const go = () => {
        for (let i = 0; i < 4; i++) this.sc.time.delayedCall(i * 90, emit);
        this.sc.time.delayedCall(every * (4 + Math.random() * 6), go);
      };
      this.sc.time.delayedCall(Math.random() * 2000, go);
    } else this.sc.time.addEvent({ delay: every, loop: true, callback: emit, startAt: Math.random() * every });
  }

  /** A leak: a drip falls from (x, y0) to (x, y1) every so often and rings out in a puddle there. */
  drip(x: number, y0: number, y1: number, color = 0xbfdbfe, every = 1600) {
    const pud = this.sc.add.ellipse(x, y1, 34, 12, color, 0.22).setDepth(DEPTH.decal);
    const d = this.sc.add.rectangle(x, y0, 2, 5, color, 0.9).setDepth(DEPTH.overhead).setVisible(false);
    const ring = this.sc.add.ellipse(x, y1, 6, 2).setStrokeStyle(1, color, 0.8).setDepth(DEPTH.decal + 0.1).setVisible(false);
    void pud;
    const fall = () => {
      d.setPosition(x, y0).setVisible(true).setAlpha(0.9);
      this.sc.tweens.add({
        targets: d,
        y: y1,
        duration: 260 + (y1 - y0) * 1.2,
        ease: "Quad.in",
        onComplete: () => {
          d.setVisible(false);
          ring.setVisible(true).setAlpha(0.8).setSize(6, 2).setDisplaySize(6, 2);
          this.sc.tweens.add({ targets: ring, displayWidth: 40, displayHeight: 14, alpha: 0, duration: 650 });
        },
      });
    };
    this.sc.time.addEvent({ delay: every + Math.random() * 600, loop: true, callback: fall, startAt: Math.random() * every });
  }

  /** Flies buzzing round a spot (bins, the fridge, the sofa). */
  flies(x: number, y: number, n = 4, radius = 22) {
    const fs: { o: Phaser.GameObjects.Rectangle; a: number; s: number; r: number }[] = [];
    for (let i = 0; i < n; i++) fs.push({ o: this.sc.add.rectangle(x, y, 2, 2, 0x111111, 0.9).setDepth(DEPTH.overhead), a: Math.random() * 6.28, s: 3 + Math.random() * 4, r: radius * (0.5 + Math.random() * 0.6) });
    this.onUpdate((now) => {
      for (const f of fs) {
        const t = now / 1000;
        f.o.setPosition(x + Math.cos(f.a + t * f.s) * f.r + Math.sin(t * 7 + f.a) * 3, y - 20 + Math.sin(f.a + t * f.s * 1.3) * f.r * 0.5);
      }
    });
  }

  /** Coloured spots sweeping round the floor (disco ball, stage lights). Slow and soft under Reduce Flashing. */
  discoSpots(cx: number, cy: number, n: number, colors: number[], radius: number, alpha = 0.22) {
    const spots = Array.from({ length: n }, (_, i) =>
      this.sc.add.image(cx, cy, "dd_softlight").setTint(colors[i % colors.length]).setAlpha(alpha).setDisplaySize(70, 50).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.ADD),
    );
    const speed = this.calm ? 0.12 : 0.35;
    this.onUpdate((now) => {
      const t = (now / 1000) * speed;
      spots.forEach((s, i) => {
        const a = t + (i / n) * Math.PI * 2;
        const rr = radius * (0.55 + 0.45 * Math.sin(t * 1.7 + i));
        s.setPosition(cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr * 0.75);
      });
    });
  }

  /** A shaft of light falling in from a window on the back wall (additive trapezoid), dust in it. */
  shaft(x: number, w: number, len: number, color = 0xfff1c1, alpha = 0.09, slant = 60) {
    const g = this.sc.add.graphics().setDepth(DEPTH.overhead - 1).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(color, alpha * (1 - i * 0.2));
      const k = i * 10;
      g.fillPoints([new Phaser.Geom.Point(x - w / 2 + k, 50), new Phaser.Geom.Point(x + w / 2 - k, 50), new Phaser.Geom.Point(x + w / 2 + slant - k, 50 + len), new Phaser.Geom.Point(x - w / 2 + slant + k * 2, 50 + len)], true);
    }
    this.sc.tweens.add({ targets: g, alpha: 0.75, yoyo: true, repeat: -1, duration: 3200, ease: "Sine.inOut" });
    this.motes(10, color, 0.5, new Phaser.Geom.Rectangle(x - w / 2 + slant / 2, 60, w, len - 20));
    return g;
  }

  /** A neon sign on the back wall: glowing text that hums (and stutters now and then). */
  neon(x: number, y: number, t: string, color: string, size = 16) {
    const col = Phaser.Display.Color.HexStringToColor(color).color;
    const glow = this.sc.add.image(x, y, "dd_softlight").setTint(col).setAlpha(0.35).setDisplaySize(t.length * size * 0.75 + 60, size * 3).setDepth(DEPTH.wall).setBlendMode(Phaser.BlendModes.ADD);
    const tx = this.text(x, y, t, size, "#ffffff", { font: "Impact, sans-serif" }).setShadow(0, 0, color, 10, true, true).setTint(Phaser.Display.Color.HexStringToColor(color).lighten(40).color);
    this.buzz([glow, tx], 1);
    glow.setAlpha(0.35);
    return tx;
  }

  /** Something small you can knock flying (walk into it, shoot it, blow it up). It never stops a bullet. */
  knockable(key: string, x: number, y: number, o: { scale?: number; colors?: number[]; sfx?: string; angle?: number; topple?: boolean; tint?: number } = {}) {
    if (!this.has(key)) return null;
    const img = this.sc.add.image(x, y, key).setOrigin(0.5, 0.85).setScale(o.scale ?? 1.4).setAngle(o.angle ?? 0).setDepth(DEPTH.prop + y / 1000);
    if (o.tint !== undefined) img.setTint(o.tint);
    const r = Math.max(12, Math.min(30, img.displayWidth * 0.4));
    this.knocks.push({ obj: img, x, y, r, colors: o.colors ?? [0xd6d3d1, 0x78716c], sfx: o.sfx ?? "hit", done: false, topple: o.topple });
    return img;
  }

  /** A knockable drawn from graphics into a texture once (`key`), e.g. a tray, a can, a cone. */
  makeTex(key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    if (this.has(key)) return key;
    const g = this.sc.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }

  private knock(k: Knock, fromX: number, fromY: number, hard: boolean) {
    if (k.done) return;
    k.done = true;
    const a = Math.atan2(k.y - fromY, k.x - fromX) + (Math.random() - 0.5) * 0.6;
    const d = hard ? 70 + Math.random() * 40 : 30 + Math.random() * 30;
    synth.play(k.sfx, hard ? 0.5 : 0.35);
    Juice.debris(this.sc, k.x, k.y - 6, hard ? 8 : 4, { colors: k.colors, speed: hard ? 220 : 140, depth: DEPTH.prop + 0.9, size: 4, floor: k.y + 8 });
    this.sc.tweens.add({
      targets: k.obj,
      x: k.x + Math.cos(a) * d,
      y: k.y + Math.sin(a) * d * 0.6,
      angle: (k.obj.angle ?? 0) + (Math.random() < 0.5 ? -1 : 1) * (k.topple ? 90 : 200 + Math.random() * 200),
      duration: 380,
      ease: "Cubic.out",
      onComplete: () => {
        if (!hard && k.topple) return;
        this.sc.tweens.add({ targets: k.obj, alpha: 0, delay: 2500, duration: 800, onComplete: () => k.obj.destroy() });
      },
    });
  }

  /** A player shot passed through (x, y). */
  shotAt(x: number, y: number) {
    for (const k of this.knocks) if (!k.done && Math.abs(k.x - x) < k.r && Math.abs(k.y - 8 - y) < k.r) this.knock(k, x - 1, y, true);
  }

  /** A blast at (x, y). */
  aoe(x: number, y: number, radius: number) {
    for (const k of this.knocks) if (!k.done && Phaser.Math.Distance.Between(x, y, k.x, k.y) < radius + k.r) this.knock(k, x, y, true);
  }

  onUpdate(fn: (now: number, dt: number) => void) {
    this.updaters.push(fn);
  }

  /** Per frame: anyone walking into a knockable sends it flying. */
  update(now: number, dt: number, walkers: { x: number; y: number }[]) {
    for (const f of this.updaters) f(now, dt);
    if (!this.knocks.length) return;
    for (const k of this.knocks) {
      if (k.done) continue;
      for (const w of walkers) {
        if (Math.abs(w.x - k.x) < k.r + 6 && Math.abs(w.y - k.y) < k.r * 0.7 + 10) {
          this.knock(k, w.x, w.y, false);
          break;
        }
      }
    }
  }

  /** Is (x, y) somewhere the player needs to walk (spawn, the door)? */
  clear(x: number, y: number) {
    return !this.keepClear.some((r) => r.contains(x, y));
  }
}

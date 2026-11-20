import Phaser from "phaser";
import { vfx } from "../../gfx/Vfx";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { FONT, PIXEL_BOLD } from "../../ui/theme";

/** What the drawbridge set piece borrows from DriveScene. */
export interface DrawbridgeHost {
  scene: Phaser.Scene;
  truck: Phaser.GameObjects.Container;
  gun: Phaser.GameObjects.Rectangle;
  me: Phaser.GameObjects.Sprite;
  roadY: number;
  truckX: number;
  gaborDrives: boolean;
  tank: Phaser.GameObjects.Image | null;
  /** the street lamps: hidden over the river */
  lamps: Phaser.GameObjects.Container[];
  explode(x: number, y: number, size: 0 | 1 | 2): void;
  shake(n: number): void;
  pop(x: number, y: number, text: string, color: string, size: number): void;
  bark(who: "SANMIK" | "SANCHZ", text: string): void;
  /** a police car went in the river: count it and score it */
  kill(points: number): void;
  /** a chunk of debris: spin, gravity, gone off the bottom of the screen */
  fling(o: Phaser.GameObjects.Rectangle, vx: number, vy: number, va: number): void;
  lite(): boolean;
}

type Cop = {
  spr: Phaser.GameObjects.Image;
  siren: Phaser.GameObjects.Arc;
  slot: number;
  state: "drive" | "air" | "gone";
  vx: number;
  vy: number;
  va: number;
  hits: number;
  dead: boolean;
};

// art geometry (public/art/props/db_leaf.png is 256x64; its hinge drum sits at (32, 34), the road deck 16px above that)
const LEAF_SCALE = 1.6;
const LEAF_OX = 32 / 256;
const LEAF_OY = 34 / 64;
const LEAF_LEN = (253 - 32) * LEAF_SCALE;
const DECK = 16 * LEAF_SCALE;
const SPAN = LEAF_LEN * 2;
const LIFT_L = 30;
const LIFT_R = 18;
const GRAV = 0.0021;
/** how high the arc goes above the straight line from the ramp to the far road */
const HOP = 150;
/** letterbox bar height, screen px */
const BAR = 50;
/** the rocket goes in here (fraction of the jump), right under the truck */
const T_HIT = 0.45;

const ease = (k: number) => 0.5 - Math.cos(Math.PI * Phaser.Math.Clamp(k, 0, 1)) / 2;

/**
 * THE DRAWBRIDGE. A cinematic set piece at the end of the Night of Freedom chase: letterbox, a PixelLab bascule bridge
 * whose two leaves lift as you come at it, the tank lining up a rocket, the truck launching off the rising leaf, slow-mo
 * at the top of the arc with the rocket screaming past under the axles, the gun blazing at the cop cars piling off the
 * ramp into the river, the rocket taking the far leaf out in a huge blast, and the landing. Then YEEEE.
 *
 * The bridge drives the road: DriveScene scrolls at `v` while this is running, so the tarmac, the city and the bridge
 * all move together. Everything is laid out from `bx` (the left leaf's hinge, in screen px).
 */
export class Drawbridge {
  /** the road speed, px per ms of (scaled) game time */
  v = 0.28;
  /** DriveScene's clock scale while set (slow-mo); undefined hands it back */
  ts: number | undefined = undefined;
  camX = 0;
  camY = 0;
  zoom = 1;
  private h: DrawbridgeHost;
  private s: Phaser.Scene;
  private bx = 1500;
  private vTarget = 0.28;
  private aL = 0;
  private aR = 0;
  private brokenR = false;
  private phase: "mash" | "run" | "air" | "after" | "done" = "mash";
  private world: Phaser.GameObjects.GameObject[] = [];
  private leafL!: Phaser.GameObjects.Image;
  private leafR!: Phaser.GameObjects.Image;
  private towerL!: Phaser.GameObjects.Image;
  private towerR!: Phaser.GameObjects.Image;
  private river!: Phaser.GameObjects.TileSprite;
  private chains!: Phaser.GameObjects.Graphics;
  private laser!: Phaser.GameObjects.Graphics;
  private beacons: Phaser.GameObjects.Arc[] = [];
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private barK = 0;
  private skipBtn: Phaser.GameObjects.Text | null = null;
  private cops: Cop[] = [];
  private tank: Phaser.GameObjects.Image | null;
  private rocket: Phaser.GameObjects.Image | null = null;
  private rocketFrom = { x: 0, y: 0 };
  private rocketPrev = { x: 0, y: 0 };
  private sHit = 0;
  private nextPuff = 0;
  // the jump
  private launchBx = 0;
  private launchY = 0;
  private landBx = 0;
  private t = 0;
  private beats = new Set<string>();
  private afterMs = 0;
  private nextShot = 0;
  private shotN = 0;
  private zoomTarget = 1;
  private resolve: (() => void) | null = null;
  private onSkipKey = () => this.skip();
  private tankSlide = 0;

  constructor(host: DrawbridgeHost) {
    this.h = host;
    this.s = host.scene;
    this.tank = host.tank;
  }

  private get calm() {
    return !!G.meta.settings.calmFlash;
  }

  private get PY() {
    return this.h.roadY + 24 + DECK;
  }

  // ---------------------------------------------------------------- set dressing

  /** Build the bridge off to the right, roll the letterbox in, line up the cop cars and the tank. */
  start() {
    const s = this.s;
    const R = this.h.roadY;
    this.fallbacks();
    // the river between the piers, over the tarmac
    this.river = s.add.tileSprite(0, R + 20, SPAN + 60, 140, "db_river").setOrigin(0, 0).setDepth(-3.2);
    this.river.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.addWorld(this.river, -30);
    // a dark band of shadow under the deck line, so the water reads as far below the road
    this.addWorld(s.add.rectangle(0, R + 20, SPAN + 60, 10, 0x05040c, 0.75).setOrigin(0, 0).setDepth(-3.1), -30);
    // stone piers at either end, in the water
    for (const [x, w] of [[-70, 90], [SPAN - 20, 90]] as [number, number][]) {
      const p = s.add.rectangle(0, R + 20, w, 140, 0x3b3550).setOrigin(0, 0).setDepth(-3).setStrokeStyle(3, 0x14101f);
      this.addWorld(p, x);
      this.addWorld(s.add.rectangle(0, R + 20, w, 6, 0x6b6488).setOrigin(0, 0).setDepth(-2.9), x);
    }
    // the towers, standing on the far side of the road at each end
    this.towerL = s.add.image(0, R + 24, "db_tower").setOrigin(0.5, 1).setScale(1.3).setDepth(-6);
    this.towerR = s.add.image(0, R + 24, "db_tower").setOrigin(0.5, 1).setScale(-1.3, 1.3).setDepth(-6);
    this.addWorld(this.towerL, -70);
    this.addWorld(this.towerR, SPAN + 70);
    // red warning beacons on the roofs
    for (const [t, dx] of [[this.towerL, -70], [this.towerR, SPAN + 70]] as [Phaser.GameObjects.Image, number][]) {
      const b = s.add.circle(0, t.y - t.displayHeight + 22, 9, 0xff2b2b, 0.9).setDepth(-5.9).setBlendMode(Phaser.BlendModes.ADD);
      this.beacons.push(b);
      this.addWorld(b, dx);
    }
    // the chains (drawn each frame, from the tower pulleys to the leaf tips) and the two leaves
    this.chains = s.add.graphics().setDepth(9);
    this.leafL = s.add.image(0, this.PY, "db_leaf").setOrigin(LEAF_OX, LEAF_OY).setScale(LEAF_SCALE).setDepth(10);
    this.leafR = s.add.image(0, this.PY, "db_leaf").setOrigin(LEAF_OX, LEAF_OY).setScale(-LEAF_SCALE, LEAF_SCALE).setDepth(10);
    this.addWorld(this.leafL, 0);
    this.addWorld(this.leafR, SPAN);
    for (const o of [this.leafL, this.leafR, this.towerL, this.towerR]) o.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.laser = s.add.graphics().setDepth(43).setBlendMode(Phaser.BlendModes.ADD);
    // the police, all of them, one last time
    const key = s.textures.exists("p_copcar") ? "p_copcar" : "p_tank";
    [215, 135, 55].forEach((slot, i) => {
      const spr = s.add.image(-160 - i * 120, R + 10, key).setScale(2.1).setOrigin(0.5, 0.8).setDepth(18 - i * 0.1);
      if (i === 1) spr.setTint(0x50506a);
      const siren = s.add.circle(spr.x, spr.y - 60, 6, 0xef4444).setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
      this.cops.push({ spr, siren, slot, state: "drive", vx: 0, vy: 0, va: 0, hits: 0, dead: false });
    });
    if (this.tank) {
      this.tank.setDepth(17);
      s.tweens.add({ targets: this.tank, x: -40, y: R + 8, angle: 0, duration: 1400, ease: "Sine.out" });
    }
    // cinema bars
    for (let i = 0; i < 2; i++) this.bars.push(s.add.rectangle(480, 0, 1400, 10, 0x000000).setOrigin(0.5, 0).setDepth(420).setScrollFactor(0));
    s.tweens.add({ targets: this, barK: 1, duration: 500, ease: "Cubic.out" });
    for (const l of this.h.lamps) l.setVisible(false);
    synth.play("alarm");
    this.layout();
  }

  /** Something to draw if the PixelLab art isn't there. */
  private fallbacks() {
    const s = this.s;
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (s.textures.exists(key)) return;
      const g = s.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make("db_leaf", 256, 64, (g) => {
      g.fillStyle(0x2f4f5a).fillRect(32, 14, 222, 10).fillStyle(0x1b2b33).fillRect(32, 24, 222, 26);
      g.fillStyle(0x22343c).fillCircle(32, 34, 28);
    });
    make("db_tower", 96, 256, (g) => g.fillStyle(0x3b3550).fillRect(18, 30, 60, 226).fillTriangle(10, 34, 48, 0, 86, 34));
    make("db_river", 64, 96, (g) => g.fillStyle(0x14123a).fillRect(0, 0, 64, 96).fillStyle(0x3b82f6, 0.4).fillRect(6, 12, 20, 2).fillRect(36, 40, 18, 2));
    make("db_rocket", 96, 32, (g) => g.fillStyle(0x4d5b2a).fillRect(20, 12, 60, 8).fillStyle(0xef4444).fillTriangle(80, 10, 92, 16, 80, 22).fillStyle(0xfb923c).fillTriangle(20, 12, 4, 16, 20, 20));
    make("db_splash", 128, 128, (g) => g.fillStyle(0xdbeafe, 0.9).fillTriangle(30, 120, 64, 10, 98, 120).fillEllipse(64, 116, 120, 20));
  }

  private addWorld(o: Phaser.GameObjects.GameObject & { x: number }, relX: number) {
    o.x = this.bx + relX;
    this.world.push(o);
  }

  // ---------------------------------------------------------------- geometry

  private get pL() {
    return this.leafL.x;
  }

  private get pR() {
    return this.leafR.x;
  }

  /** The road deck under screen x: [y of the deck surface, its slope in degrees], or null over open water. */
  private deck(x: number): [number, number] | null {
    const road: [number, number] = [this.h.roadY + 24, 0];
    if (x <= this.pL || x >= this.pR) return road;
    const a = Phaser.Math.DegToRad(this.aL);
    const sl = (x - this.pL + DECK * Math.sin(a)) / Math.cos(a);
    if (sl >= 0 && sl <= LEAF_LEN) return [this.PY - DECK * Math.cos(a) - sl * Math.sin(a), -this.aL];
    if (!this.brokenR) {
      const b = Phaser.Math.DegToRad(this.aR);
      const sr = (this.pR - x + DECK * Math.sin(b)) / Math.cos(b);
      if (sr >= 0 && sr <= LEAF_LEN) return [this.PY - DECK * Math.cos(b) - sr * Math.sin(b), this.aR];
    }
    return null;
  }

  /** The left leaf's tip, screen x. */
  private get tipL() {
    const a = Phaser.Math.DegToRad(this.aL);
    return this.pL + LEAF_LEN * Math.cos(a) - DECK * Math.sin(a);
  }

  /** A point on the right leaf, `sr` px out from its hinge, `under` px below the road surface. */
  private rightPoint(sr: number, under = 0) {
    const b = Phaser.Math.DegToRad(this.leafR.angle);
    return { x: this.pR - sr * Math.cos(b) + (DECK - under) * Math.sin(b), y: this.leafR.y - (DECK - under) * Math.cos(b) - sr * Math.sin(b) };
  }

  private layout() {
    this.leafL.setAngle(-this.aL);
    if (!this.brokenR) this.leafR.setAngle(this.aR);
    // chains from the pulleys (up the inside face of each tower) to the leaf tips
    const g = this.chains.clear();
    const tipL = { x: this.tipL, y: this.PY - DECK * Math.cos(Phaser.Math.DegToRad(this.aL)) - LEAF_LEN * Math.sin(Phaser.Math.DegToRad(this.aL)) };
    const pulL = { x: this.towerL.x + 28, y: this.towerL.y - this.towerL.displayHeight * 0.64 };
    const links = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const n = Math.max(4, Math.floor(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 9));
      for (let i = 0; i < n; i++) {
        const k = i / n;
        g.fillStyle(i % 2 ? 0x1c1a24 : 0x4b4a58, 1).fillRect(a.x + (b.x - a.x) * k - 2, a.y + (b.y - a.y) * k - 2, 5, 5);
      }
    };
    links(pulL, tipL);
    if (!this.brokenR) {
      const tipR = this.rightPoint(LEAF_LEN);
      links({ x: this.towerR.x - 28, y: pulL.y }, tipR);
    }
  }

  // ---------------------------------------------------------------- the beats

  /** A gear went in: the truck finds a bit more speed. */
  gear(n: number) {
    this.vTarget = Math.min(0.4, 0.28 + n * 0.01);
  }

  /** Mashing's over. Highest gear: go for it. Resolves when the bridge is behind you (or the scene is skipped). */
  go() {
    this.phase = "run";
    this.vTarget = 0.85;
    const s = this.s;
    if (this.tank) this.h.pop(this.tank.x + 60, this.tank.y - 190, "IT'S ABOUT TO FIRE A FUCKING ROCKET", "#ef4444", 16);
    synth.play("car_screech");
    // a SKIP button (Tab) for the impatient, and for the second time round
    this.skipBtn = s.add
      .text(944, 20, "SKIP ▶▶", { fontFamily: FONT, fontSize: "13px", color: "#e5e7eb", fontStyle: "bold", backgroundColor: "#00000088", padding: { x: 8, y: 5 } })
      .setOrigin(1, 0)
      .setDepth(460)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.skipBtn.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.skip();
    });
    s.input.keyboard?.on("keydown-TAB", this.onSkipKey);
    return new Promise<void>((res) => (this.resolve = res));
  }

  update(dt: number, realDt: number) {
    if (this.phase === "done") return;
    const now = this.s.time.now;
    this.v += (this.vTarget - this.v) * Math.min(1, dt / 220);
    const dx = this.v * dt;
    this.bx -= dx;
    for (const o of this.world) (o as unknown as { x: number }).x -= dx;
    if (this.world.length > 80) this.world = this.world.filter((o) => o.active);
    this.river.tilePositionX += dt * 0.02;
    const lift = ease((1500 - this.bx) / 700);
    this.aL = LIFT_L * lift;
    if (!this.brokenR) this.aR = LIFT_R * lift;
    for (const b of this.beacons) b.setAlpha(this.calm ? 0.6 : Math.floor(now / 260) % 2 ? 0.95 : 0.15);
    this.layout();
    this.updateTank(dt, now);
    this.updateCops(dt, now);
    this.updateTruck(dt);
    this.updateRocket(now);
    if (this.phase === "air") this.updateGun(now);
    if (this.phase === "after") {
      this.afterMs += realDt;
      if (this.afterMs > 1200) this.vTarget = 0.54;
      if (this.afterMs > 2000) this.end();
    }
    // camera: ease toward the shot (real time, so the slow-mo doesn't drag it)
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, realDt / 260);
    this.frame();
  }

  /**
   * Frame the shot: the camera drops so the river shows above the bottom bar (the road sits low on screen), leans
   * toward the truck as it zooms, and the bars counter the zoom.
   */
  private frame() {
    const z = this.zoom;
    const k = Phaser.Math.Clamp((z - 1) / 0.08, 0, 1);
    this.camX = (this.h.truck.x - 480) * k * 0.6;
    // keep world y 535 just above the bottom bar
    this.camY = (265 - (270 - BAR) / z) * this.barK;
    this.placeBars();
  }

  /** The bars and the SKIP button sit in screen space, so counter the camera zoom. */
  private placeBars() {
    const z = this.zoom;
    const hgt = BAR * this.barK;
    const [top, bot] = this.bars;
    top?.setPosition(480, 270 - 270 / z).setSize(1400, hgt / z);
    bot?.setPosition(480, 270 + (540 - hgt - 270) / z).setSize(1400, hgt / z);
    this.skipBtn?.setPosition(480 + (944 - 480) / z, 270 + (20 - 270) / z).setScale(1 / z);
  }

  private updateTank(dt: number, now: number) {
    const t = this.tank;
    if (!t?.active) return;
    this.laser.clear();
    if (this.phase === "run" || (this.phase === "air" && !this.rocket && this.t < 0.02)) {
      // painting the truck with a laser
      const m = this.muzzle();
      const k = Math.floor(now / 70) % 2;
      this.laser.lineStyle(2, 0xff2020, k ? 0.85 : 0.45).lineBetween(m.x, m.y, this.h.truck.x, this.h.truck.y - 30);
      this.laser.fillStyle(0xff4040, 0.9).fillCircle(this.h.truck.x, this.h.truck.y - 30, 4);
    }
    if (this.tankSlide) {
      // it's braked: the road (and the bridge) carry on without it
      t.x -= this.v * dt * this.tankSlide;
      this.tankSlide = Math.min(1, this.tankSlide + dt * 0.0006);
      if (t.x < -400) t.setVisible(false);
    }
  }

  private muzzle() {
    const t = this.tank!;
    return { x: t.x + 151, y: t.y - 107 };
  }

  private updateCops(dt: number, now: number) {
    const R = this.h.roadY;
    for (const c of this.cops) {
      if (c.state === "gone") continue;
      if (c.state === "drive") {
        const tx = c.slot + Math.sin(now / 500 + c.slot) * 10;
        c.spr.x += (tx - c.spr.x) * Math.min(1, dt / 500);
        const d = this.deck(c.spr.x);
        if (d && (c.spr.x < this.pL || c.spr.x <= this.tipL)) {
          c.spr.y = d[0] - 14;
          c.spr.angle += (d[1] - c.spr.angle) * Math.min(1, dt / 60);
        } else {
          // off the end of the rising leaf
          c.state = "air";
          c.vx = 0.06 + Math.random() * 0.04;
          c.vy = -0.32 - Math.random() * 0.12;
          c.va = 0.05 + Math.random() * 0.05;
          if (Math.random() < 0.6) this.h.pop(c.spr.x, c.spr.y - 80, Math.random() < 0.5 ? "NEE-NAW?!" : "OH NO", "#93c5fd", 14);
        }
      } else {
        c.vy += GRAV * dt;
        c.spr.x += c.vx * dt - this.v * dt * 0.35;
        c.spr.y += c.vy * dt;
        c.spr.angle += c.va * dt;
        if (c.spr.y > R + 46) {
          this.splash(c.spr.x, R + 52, 1.4);
          if (!c.dead) this.h.kill(100);
          c.state = "gone";
          c.spr.destroy();
          c.siren.destroy();
          continue;
        }
      }
      c.siren.setPosition(c.spr.x - 4, c.spr.y - 62).setFillStyle(Math.floor(now / 150 + c.slot) % 2 ? 0xef4444 : 0x3b82f6);
      if (c.dead) c.siren.setVisible(false);
    }
  }

  private updateTruck(dt: number) {
    const tr = this.h.truck;
    const X = this.h.truckX;
    if (this.phase === "mash" || this.phase === "run") {
      const d = this.deck(X);
      if (this.phase === "run" && X > this.tipL && this.pL < X) return this.launch();
      if (d) {
        tr.y = d[0] - 24;
        tr.angle += (d[1] - tr.angle) * Math.min(1, dt / 50);
      }
      return;
    }
    if (this.phase === "air") {
      const U = this.launchBx - this.landBx;
      this.t = Phaser.Math.Clamp((this.launchBx - this.bx) / U, 0, 1);
      const t = this.t;
      const R = this.h.roadY;
      tr.y = this.launchY * (1 - t) + R * t - 4 * HOP * t * (1 - t);
      const dydt = R - this.launchY - 4 * HOP * (1 - 2 * t);
      const want = Phaser.Math.RadToDeg(Math.atan2(dydt / U, 1)) * 0.6;
      tr.angle += (want - tr.angle) * Math.min(1, dt / 90);
      this.airBeats(t);
      if (t >= 1) this.land();
      return;
    }
    if (this.phase === "after") {
      tr.y = this.h.roadY;
      tr.angle *= Math.pow(0.5, dt / 60);
    }
  }

  private launch() {
    const tr = this.h.truck;
    this.phase = "air";
    this.launchBx = this.bx;
    this.launchY = tr.y;
    this.landBx = this.h.truckX - 80 - SPAN;
    this.vTarget = 0.62;
    this.v = 0.7;
    synth.play("dodge");
    synth.play("jet");
    this.h.shake(0.3);
    vfx(this.s, "vfx_sparks", tr.x + 90, tr.y + 24, { scale: 1.4, depth: 25, add: true });
    if (!this.h.lite()) vfx(this.s, "vfx_dust", tr.x - 60, tr.y + 24, { scale: 1.6, depth: 21 });
    // the tank lets go
    if (this.tank?.active) {
      const m = this.muzzle();
      this.rocketFrom = { ...m };
      this.rocketPrev = { ...m };
      this.rocket = this.s.add.image(m.x, m.y, "db_rocket").setScale(1.1).setDepth(41).setOrigin(0.8, 0.5);
      this.rocket.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      vfx(this.s, "vfx_muzzle", m.x, m.y, { scale: 3.2, depth: 42, add: true, angle: -20 });
      if (!this.h.lite()) vfx(this.s, "vfx_blastsmoke", m.x - 30, m.y + 10, { scale: 0.7, depth: 40, alpha: 0.8 });
      this.flashCircle(m.x, m.y, 70, 0xffd27a);
      synth.play("rocket");
      synth.play("boom", 0.7);
      this.s.tweens.add({ targets: this.tank, x: this.tank.x - 18, duration: 90, yoyo: true });
      this.tankSlide = 0.2;
      // where it'll hit: the far leaf, right under the truck, at T_HIT
      const bxHit = this.launchBx - T_HIT * (this.launchBx - this.landBx);
      const pRHit = bxHit + SPAN;
      const b = Phaser.Math.DegToRad(this.aR);
      this.sHit = Phaser.Math.Clamp((pRHit - (this.h.truckX + 20) + DECK * Math.sin(b)) / Math.cos(b), 60, LEAF_LEN - 20);
    }
  }

  /** Shouts, slow-mo and the zoom, keyed to how far through the jump we are. */
  private airBeats(t: number) {
    const once = (k: string, at: number, fn: () => void) => {
      if (t >= at && !this.beats.has(k)) {
        this.beats.add(k);
        fn();
      }
    };
    once("yee", 0.04, () => {
      this.sanmik("YEEEEEEEEEE!");
      synth.shout("yee", 1);
    });
    once("zoom", 0.12, () => (this.zoomTarget = 1.08));
    once("slow", 0.2, () => (this.ts = 0.2));
    once("goat", 0.24, () => this.h.pop(this.h.truck.x + (this.h.gaborDrives ? 70 : -118), this.h.truck.y - 100, this.h.gaborDrives ? "I CAN'T SEE THE PEDALS" : "AAAAAAAAAA", "#f5f5f4", 14));
    once("chz", 0.3, () => {
      this.h.bark("SANCHZ", "YEGHHHHH!");
      synth.shout("yegh", 1);
    });
    once("fast", 0.62, () => {
      this.ts = undefined;
      this.zoomTarget = 1.02;
    });
  }

  private updateRocket(now: number) {
    const r = this.rocket;
    if (!r?.active || this.phase !== "air") return;
    const p = Phaser.Math.Clamp(this.t / T_HIT, 0, 1);
    const tr = this.h.truck;
    // up from the turret to skim the truck's belly, then down into the far leaf
    const mid = { x: this.h.truckX - 10, y: tr.y + 62 };
    const hit = this.rightPoint(this.sHit, 18);
    let x: number;
    let y: number;
    if (p < 0.75) {
      const k = p / 0.75;
      x = Phaser.Math.Linear(this.rocketFrom.x, mid.x, k);
      y = Phaser.Math.Linear(this.rocketFrom.y, mid.y, Math.sin((k * Math.PI) / 2));
    } else {
      const k = (p - 0.75) / 0.25;
      x = Phaser.Math.Linear(mid.x, hit.x, k);
      y = Phaser.Math.Linear(mid.y, hit.y, k * k);
    }
    const a = Math.atan2(y - this.rocketPrev.y, x - this.rocketPrev.x);
    if (Math.abs(x - this.rocketPrev.x) + Math.abs(y - this.rocketPrev.y) > 0.5) r.setRotation(a);
    r.setPosition(x, y);
    // the exhaust: a hot flare, and a long grey trail that hangs in the air
    if (now >= this.nextPuff) {
      this.nextPuff = now + 18;
      const back = { x: x - Math.cos(r.rotation) * 70, y: y - Math.sin(r.rotation) * 70 };
      const fl = this.s.add.circle(back.x, back.y, 7, 0xfb923c, 0.95).setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
      this.s.tweens.add({ targets: fl, scale: 0.2, alpha: 0, duration: 140, onComplete: () => fl.destroy() });
      const puff = this.s.add.circle(back.x, back.y, 6, 0xd1d5db, 0.6).setDepth(39);
      this.addWorld(puff, puff.x - this.bx);
      this.s.tweens.add({ targets: puff, radius: 18, alpha: 0, y: puff.y - 10, duration: 900, onComplete: () => puff.destroy() });
    }
    this.rocketPrev = { x, y };
    if (p >= 1) this.impact(x, y);
  }

  /** The rocket takes out the far leaf, right under the truck. */
  private impact(x: number, y: number) {
    this.rocket?.destroy();
    this.rocket = null;
    const s = this.s;
    this.h.explode(x, y, 2);
    synth.play("reveal_boom");
    vfx(s, "vfx_bigboom", x, y + 10, { scale: 3.2, depth: 63 });
    vfx(s, "vfx_shock", x, y, { scale: 3.4, depth: 59, add: true });
    if (!this.h.lite()) vfx(s, "vfx_blastsmoke", x + 20, y + 20, { scale: 1.6, depth: 56, alpha: 0.85 });
    s.cameras.main.flash(this.calm ? 300 : 220, 255, 220, 160);
    this.h.shake(1);
    this.zoom += 0.05;
    // chained blasts along the deck as the girders go
    // (out toward the tip, i.e. behind the truck: placed now, carried along with the road)
    const bx0 = this.bx;
    [0.6, 0.8, 0.98].forEach((k, i) => {
      const p = this.rightPoint(LEAF_LEN * k, 10);
      s.time.delayedCall(140 + i * 160, () => {
        if (this.phase === "done") return;
        this.h.explode(p.x + this.bx - bx0, p.y, i === 1 ? 2 : 1);
      });
    });
    // girders, rivets and tarmac everywhere
    const n = this.h.lite() ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const c = [0x2f4f5a, 0x1b2b33, 0x4b4a58, 0xfb923c, 0x111827][i % 5];
      const d = s.add.rectangle(x + (Math.random() - 0.5) * 60, y, 6 + Math.random() * 18, 4 + Math.random() * 8, c).setDepth(61).setStrokeStyle(1, 0x05040c);
      if (c === 0xfb923c) d.setBlendMode(Phaser.BlendModes.ADD);
      this.h.fling(d, (Math.random() - 0.6) * 0.9, -0.6 - Math.random() * 0.9, (Math.random() - 0.5) * 2);
    }
    // the far leaf snaps off its hinge and goes in the river, tip first
    this.brokenR = true;
    const leaf = this.leafR;
    const fire = vfx(s, "vfx_fire", x, y, { scale: 1.6, depth: 12, add: true });
    if (fire) this.addWorld(fire, fire.x - this.bx);
    s.tweens.add({ targets: leaf, angle: -58, duration: 1300, ease: "Quad.in" });
    s.tweens.add({
      targets: leaf,
      y: leaf.y + 70,
      duration: 1300,
      ease: "Quad.in",
      onComplete: () => {
        if (this.phase === "done") return;
        const tip = this.rightPoint(LEAF_LEN * 0.8);
        this.splash(tip.x, this.h.roadY + 50, 2.2);
        this.splash(tip.x + 120, this.h.roadY + 54, 1.6);
        synth.play("splash");
        this.h.shake(0.4);
      },
    });
    // the tower lists over, smoking
    s.tweens.add({ targets: this.towerR, angle: 7, y: this.towerR.y + 26, duration: 2200, ease: "Sine.in" });
    this.h.bark(this.h.gaborDrives ? "SANCHZ" : "SANMIK", this.h.gaborDrives ? "YEGH! BRIDGE!" : "HOLD ON TO YOUR BOLLOCKS!");
  }

  /** The machine gun never stops, even upside down over a river. */
  private updateGun(now: number) {
    if (now < this.nextShot || this.t < 0.06 || this.t > 0.97) return;
    this.nextShot = now + 75;
    const s = this.s;
    const tr = this.h.truck;
    const gun = this.h.gun;
    const target = this.cops.filter((c) => c.state !== "gone" && !c.dead && c.spr.x > -40).sort((a, b) => b.spr.x - a.spr.x)[0];
    const gx = tr.x + gun.x * Math.cos(tr.rotation) - gun.y * Math.sin(tr.rotation);
    const gy = tr.y + gun.x * Math.sin(tr.rotation) + gun.y * Math.cos(tr.rotation);
    let ax: number;
    let ay: number;
    if (target) {
      ax = target.spr.x + (Math.random() - 0.5) * 30;
      ay = target.spr.y - 30 + (Math.random() - 0.5) * 20;
    } else if (this.tank?.active && this.tank.x > -100) {
      ax = this.tank.x + 40;
      ay = this.tank.y - 70;
    } else {
      ax = gx - 300;
      ay = gy - 120 + Math.sin(now / 90) * 60;
    }
    const a = Math.atan2(ay - gy, ax - gx);
    const local = a - tr.rotation;
    gun.setRotation(local).setScale(1, Math.cos(local) < 0 ? -1 : 1);
    this.h.me.setFlipX(Math.cos(local) < 0);
    const tip = { x: gx + Math.cos(a) * 40, y: gy + Math.sin(a) * 40 };
    // tracer: a hot streak all the way there
    const len = Phaser.Math.Distance.Between(tip.x, tip.y, ax, ay);
    const tracer = s.add.rectangle(tip.x, tip.y, Math.min(60, len), 4, 0xfff3a0).setOrigin(0, 0.5).setRotation(a).setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: tracer, x: ax - Math.cos(a) * 30, y: ay - Math.sin(a) * 30, duration: 70, onComplete: () => tracer.destroy() });
    vfx(s, "vfx_muzzle", tip.x, tip.y, { angle: Phaser.Math.RadToDeg(a), scale: 1.4, depth: 45, add: true });
    this.shotN++;
    if (this.shotN % 2 === 0) {
      synth.play("gun_gatling");
      const lf = s.add.circle(tip.x, tip.y, 30, 0xffd27a, this.calm ? 0.15 : 0.35).setDepth(39).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({ targets: lf, alpha: 0, duration: 70, onComplete: () => lf.destroy() });
    }
    // brass, off into the night
    const shell = s.add.rectangle(gx, gy, 5, 2, 0xfbbf24).setDepth(39);
    this.h.fling(shell, -Math.cos(a) * 0.05 + (Math.random() - 0.5) * 0.12, -0.35 - Math.random() * 0.2, (Math.random() - 0.5) * 3);
    if (!target) return;
    target.hits++;
    if (this.shotN % 2 === 0) vfx(s, "vfx_hit", ax, ay, { scale: 0.8, depth: 42, add: true, angle: Math.random() * 360 });
    target.spr.setTintFill(0xffffff);
    s.time.delayedCall(40, () => {
      if (!target.spr.active) return;
      target.spr.clearTint();
      if (target.dead) target.spr.setTint(0x2b2622);
      else if (target.slot === 135) target.spr.setTint(0x50506a);
    });
    if (target.hits >= 6) this.killCop(target);
  }

  private killCop(c: Cop) {
    c.dead = true;
    this.h.kill(c.slot === 135 ? 150 : 100);
    this.h.explode(c.spr.x, c.spr.y - 20, 1);
    c.spr.setTint(0x2b2622);
    c.siren.setVisible(false);
    const fire = vfx(this.s, "vfx_fire", c.spr.x, c.spr.y - 10, { scale: 1.1, depth: 19, add: true });
    if (fire) {
      const follow = () => {
        if (!c.spr.active || !fire.active) {
          fire.destroy();
          this.s.events.off("update", follow);
          return;
        }
        fire.setPosition(c.spr.x, c.spr.y - 10);
      };
      this.s.events.on("update", follow);
    }
    // up, spinning, and in the drink
    if (c.state === "drive") c.state = "air";
    c.vx = -0.05 + Math.random() * 0.1;
    c.vy = -0.55 - Math.random() * 0.2;
    c.va = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.2);
    this.h.pop(c.spr.x, c.spr.y - 70, "+" + (c.slot === 135 ? 150 : 100), "#fde047", 16);
  }

  private land() {
    const tr = this.h.truck;
    this.phase = "after";
    this.ts = undefined;
    this.zoomTarget = 1;
    this.vTarget = 0.32;
    tr.y = this.h.roadY;
    this.h.shake(0.6);
    synth.play("car_hit");
    synth.play("smash", 0.7);
    if (!this.h.lite()) vfx(this.s, "vfx_dust", tr.x - 70, this.h.roadY + 22, { scale: 2, depth: 21 });
    for (let i = 0; i < 16; i++) {
      const sp = this.s.add.rectangle(tr.x + (Math.random() - 0.5) * 200, this.h.roadY + 22, 3, 3, 0xfde047).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
      this.s.tweens.add({ targets: sp, x: sp.x - 90 - Math.random() * 120, y: sp.y - 20 - Math.random() * 40, alpha: 0, duration: 450, onComplete: () => sp.destroy() });
    }
    this.h.gun.setRotation(0).setScale(1, 1);
    this.h.me.setFlipX(false);
    this.s.time.delayedCall(260, () => this.yee());
  }

  /** YEEEEEEEE. */
  private yee() {
    if (this.phase === "done") return;
    const s = this.s;
    const txt = s.add
      .text(480, 230, "YEEEEEEEE!", { fontFamily: PIXEL_BOLD, fontSize: "76px", color: "#ffd23f", stroke: "#000", strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(430)
      .setScrollFactor(0)
      .setShadow(5, 5, "#ff2bd6", 0, true, true)
      .setScale(2.4)
      .setAngle(-8);
    s.tweens.add({ targets: txt, scale: 1, angle: -4, duration: 360, ease: "Back.out" });
    s.tweens.add({ targets: txt, alpha: 0, y: 200, delay: 1700, duration: 500, onComplete: () => txt.destroy() });
    this.extras.push(txt);
    synth.shout("yee", 1, 0.95, 0);
    s.time.delayedCall(260, () => synth.shout("yee", 1, 1.08));
    s.time.delayedCall(420, () => synth.shout("yegh", 1));
    synth.play("cheer", 0.8);
    this.sanmik("WE JUMPED IT! YEEEEE!");
    s.time.delayedCall(500, () => this.phase !== "done" && this.h.bark("SANCHZ", "YEGHHHHHHH!"));
    this.h.shake(0.3);
  }

  private extras: Phaser.GameObjects.GameObject[] = [];

  /** SanMik yells. Playing as Mikey he's on the guns (Gabor's driving), so it comes from the back. */
  private sanmik(text: string) {
    if (this.h.gaborDrives) this.h.pop(this.h.truck.x - 30, this.h.truck.y - 130, text, "#b0c4ff", 15);
    else this.h.bark("SANMIK", text);
  }

  private splash(x: number, y: number, scale: number) {
    const s = this.s;
    const sp = s.add.image(x, y, "db_splash").setOrigin(0.5, 0.92).setScale(scale * 0.3, scale * 0.2).setDepth(16).setAlpha(0.95);
    sp.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.addWorld(sp, x - this.bx);
    s.tweens.add({ targets: sp, scaleX: scale, scaleY: scale, duration: 260, ease: "Cubic.out" });
    s.tweens.add({ targets: sp, alpha: 0, scaleY: scale * 0.6, delay: 380, duration: 520, onComplete: () => sp.destroy() });
    synth.play("splash", 0.9);
    for (let i = 0; i < 6; i++) {
      const d = s.add.circle(x + (Math.random() - 0.5) * 40, y - 10, 2 + Math.random() * 3, 0xdbeafe, 0.9).setDepth(17);
      s.tweens.add({ targets: d, x: d.x + (Math.random() - 0.5) * 140, y: d.y - 60 - Math.random() * 80, duration: 300, ease: "Quad.out", yoyo: true, onComplete: () => d.destroy() });
    }
  }

  private flashCircle(x: number, y: number, r: number, color: number) {
    const f = this.s.add.circle(x, y, r, color, this.calm ? 0.2 : 0.55).setDepth(62).setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({ targets: f, alpha: 0, scale: 1.5, duration: this.calm ? 320 : 180, onComplete: () => f.destroy() });
  }

  // ---------------------------------------------------------------- endings

  /** Tab / SKIP: straight to the far side. */
  skip() {
    if (this.phase === "done" || this.phase === "mash") return;
    this.h.truck.setY(this.h.roadY).setAngle(0);
    this.h.gun.setRotation(0).setScale(1, 1);
    for (const c of this.cops) if (c.state !== "gone" && !c.dead) this.h.kill(100);
    // cut straight to the far bank: the bridge is behind us
    for (const o of [...this.world, ...this.cops.flatMap((c) => [c.spr, c.siren]), this.chains, this.laser, ...(this.rocket ? [this.rocket] : [])]) (o as unknown as { setVisible(v: boolean): unknown }).setVisible(false);
    if (this.tank?.active) this.tank.setVisible(false);
    this.end();
  }

  private end() {
    if (this.phase === "done") return;
    this.phase = "done";
    this.ts = undefined;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.camX = 0;
    this.camY = 0;
    this.h.truck.setY(this.h.roadY).setAngle(0);
    this.skipBtn?.setVisible(false);
    this.s.tweens.add({
      targets: this,
      barK: 0,
      duration: 300,
      onUpdate: () => this.frame(),
      onComplete: () => {
        const r = this.resolve;
        this.resolve = null;
        r?.();
      },
    });
  }

  destroy() {
    this.phase = "done";
    this.s.input.keyboard?.off("keydown-TAB", this.onSkipKey);
    this.s.tweens.killTweensOf(this);
    for (const o of [...this.world, ...this.bars, ...this.extras, ...this.beacons]) {
      this.s.tweens.killTweensOf(o);
      o.destroy();
    }
    for (const c of this.cops) {
      c.spr.destroy();
      c.siren.destroy();
    }
    this.rocket?.destroy();
    this.chains.destroy();
    this.laser.destroy();
    this.skipBtn?.destroy();
    if (this.tank?.active) this.tank.setVisible(false);
    for (const l of this.h.lamps) l.setVisible(true);
    this.world = [];
  }
}

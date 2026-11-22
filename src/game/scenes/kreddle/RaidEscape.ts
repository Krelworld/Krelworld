import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { FONT } from "../../ui/theme";
import { vfx } from "../../gfx/Vfx";
import * as Juice from "../../gfx/Juice";
import { diffFor, scaleCount, type DifficultyDef } from "../../systems/difficulty";
import type { Line } from "../../../data/types";
import { ESCAPE_DOWNED, ESCAPE_HELI_SHOUTS, ESCAPE_TANK_SHOUTS, ESCAPE_WAVES, ESCAPE_WRECK_SHOUTS } from "../../../content/raid";

/**
 * THE ESCAPE GAUNTLET (Chapter 6 raid, after the nuke is planted). Kreddle's security forces are waiting on the Strip
 * between you and the bridge: KPD cop cars (screech in, cops pile out and shoot, some ram you), gold casino tanks (slow,
 * big HP, lobbed shells with a ground marker that shows where they'll land) and attack choppers (searchlights, strafing
 * runs walked up a marked line, lock-on missiles). They come in escalating waves as you run west.
 *
 * All of it is there to be merked: cars flip and explode, tanks blow their turrets into the sky, choppers spin out and
 * crash in fireballs, cops ragdoll (gore-aware), and every wreck's blast chains into whatever's next to it. A WRECKED
 * counter and combo shouts keep score; the lads cheer and chip in with rockets and rifles.
 *
 * You can't die in here: hits wear down your GRIT, and at zero you're knocked flat for a moment while the lads drag you
 * up (the nuke clock keeps running, which is the real threat). Everything scales with the difficulty table.
 *
 * Phone budget: foes, cops, shots and wrecks are capped; anything left far behind is removed.
 */

/** What the gauntlet needs from the raid. */
export interface EscapeHost {
  sc: Phaser.Scene;
  me: () => Phaser.GameObjects.Sprite;
  lads: () => { id: string; spr: Phaser.GameObjects.Sprite }[];
  explode: (x: number, y: number, scale?: number, delay?: number, big?: boolean) => void;
  addFire: (x: number, y: number, scale: number, tint: number, until: number, ground?: boolean) => Phaser.GameObjects.Sprite | null;
  bubble: (spr: Phaser.GameObjects.Sprite, text: string, bg?: string, important?: boolean) => void;
  shout: (line: Line) => void;
  busy: () => boolean;
  addAsh: (x: number, y: number, charred?: boolean) => void;
  /** Let one of the raid's fires burn out at `at` (scene time). */
  expireFire: (spr: Phaser.GameObjects.Sprite, at: number) => void;
  dLight: number;
  dHud: number;
}

type Kind = "car" | "tank" | "heli";
interface Foe {
  kind: Kind;
  body: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  turret?: Phaser.GameObjects.Image;
  hp: number;
  max: number;
  state: "arrive" | "idle" | "tele" | "ram" | "dead";
  tx: number;
  ty: number;
  vx: number;
  next: number;
  teleUntil: number;
  attack: number;
  fires: Phaser.GameObjects.Sprite[];
  bar: Phaser.GameObjects.Rectangle;
  barBg: Phaser.GameObjects.Rectangle;
  light?: Phaser.GameObjects.Triangle;
  siren?: Phaser.GameObjects.Arc;
  rotor?: Phaser.GameObjects.Rectangle;
  marker?: Phaser.GameObjects.GameObject[];
  rammer?: boolean;
  copsLeft?: number;
  hitAt: number;
  born: number;
  lockX?: number;
  lockY?: number;
}
interface Cop {
  spr: Phaser.GameObjects.Image;
  hp: number;
  state: "run" | "shoot" | "burn" | "fly" | "dead";
  tx: number;
  ty: number;
  next: number;
  t: number;
  dir: { x: number; y: number };
  fire: Phaser.GameObjects.Sprite | null;
}
interface Shot {
  obj: Phaser.GameObjects.Image;
  kind: "bullet" | "shell" | "missile";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  vx: number;
  vy: number;
  t: number;
  dur: number;
  dmg: number;
  r: number;
  marker?: Phaser.GameObjects.GameObject[];
  nextTrail: number;
}

const TOP = 432;
const BOTTOM = 680;
const MAX_FOES = 9;
const MAX_COPS = 8;
const MAX_SHOTS = 40;
const MAX_WRECKS = 10;
const SCALE = { car: 1.45, tank: 1.5, heli: 1.5 } as const;
/** Flamethrower-seconds to kill (before the difficulty's enemyHp). */
const HP = { car: 1.8, tank: 4.8, heli: 2.8, cop: 0.4 } as const;
/** Waves: where on the Strip they're waiting (you run west from ~9300), and who. */
const WAVES: { x: number; cars: number; screech: number; tanks: number; helis: number }[] = [
  { x: 8500, cars: 2, screech: 2, tanks: 0, helis: 0 },
  { x: 7300, cars: 2, screech: 1, tanks: 0, helis: 1 },
  { x: 6100, cars: 2, screech: 0, tanks: 1, helis: 0 },
  { x: 4900, cars: 1, screech: 2, tanks: 0, helis: 2 },
  { x: 3700, cars: 2, screech: 0, tanks: 2, helis: 1 },
  { x: 2500, cars: 2, screech: 2, tanks: 1, helis: 2 },
  { x: 950, cars: 3, screech: 0, tanks: 2, helis: 1 },
];
const COMBO = ["", "", "DOUBLE MERK!", "TRIPLE MERK!", "MERKTACULAR!", "ABSOLUTELY FUCKING MERKED!!"];

export class EscapeGauntlet {
  private h: EscapeHost;
  private sc: Phaser.Scene;
  private d: DifficultyDef;
  private foes: Foe[] = [];
  private cops: Cop[] = [];
  private shots: Shot[] = [];
  private wrecks: Phaser.GameObjects.Container[] = [];
  private wave = 0;
  private wrecked = 0;
  private combo = 0;
  private comboAt = 0;
  private grit = 100;
  private iframesUntil = 0;
  private stunUntil = 0;
  private nextLadGun = 0;
  private nextLadRocket = 0;
  private nextShoutAt = 0;
  private counter!: Phaser.GameObjects.Text;
  private gritBar!: Phaser.GameObjects.Rectangle;
  private gritLbl!: Phaser.GameObjects.Text;
  private hurtEdge: Phaser.GameObjects.Image | null = null;
  private gore = true;

  constructor(host: EscapeHost) {
    this.h = host;
    this.sc = host.sc;
    this.d = diffFor(G.s);
    this.gore = G.meta.settings.gore !== false;
    this.makeTextures();
    this.drawHud();
  }

  private makeTextures() {
    const sc = this.sc;
    if (!sc.textures.exists("esc_bullet")) {
      const g = sc.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xfff3a0, 1).fillRect(0, 1, 10, 3);
      g.fillStyle(0xffffff, 1).fillRect(6, 1, 4, 3);
      g.generateTexture("esc_bullet", 10, 5);
      g.clear();
      g.fillStyle(0x1c1917, 1).fillCircle(7, 7, 7);
      g.fillStyle(0xfacc15, 1).fillCircle(5, 5, 2);
      g.generateTexture("esc_shell", 14, 14);
      g.clear();
      g.fillStyle(0xd4d4d8, 1).fillRect(2, 2, 18, 6);
      g.fillStyle(0xef4444, 1).fillTriangle(20, 0, 26, 5, 20, 10);
      g.fillStyle(0x52525b, 1).fillRect(0, 0, 4, 10);
      g.generateTexture("esc_missile", 26, 10);
      g.destroy();
    }
  }

  private drawHud() {
    const sc = this.sc;
    const L = Juice.layer(sc, this.h.dHud);
    this.counter = sc.add.text(950, 212, "WRECKED: 0", { fontFamily: "Impact, sans-serif", fontSize: "24px", color: "#ffd23f", stroke: "#000", strokeThickness: 5 }).setOrigin(1, 0).setScrollFactor(0);
    const bg = sc.add.rectangle(12, 226, 164, 14, 0x000000, 0.7).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff, 0.8).setScrollFactor(0);
    this.gritBar = sc.add.rectangle(14, 226, 160, 10, 0x4ade80).setOrigin(0, 0.5).setScrollFactor(0);
    this.gritLbl = sc.add.text(182, 226, "GRIT", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0, 0.5).setScrollFactor(0);
    L.add([this.counter, bg, this.gritBar, this.gritLbl]);
  }

  /** Knocked down (the lads are dragging you up): no running, no firing. */
  stunned(time: number) {
    return time < this.stunUntil;
  }

  // ------------------------------------------------------------------ waves

  private spawnWave(i: number) {
    const w = WAVES[i];
    const sc = this.sc;
    const d = this.d;
    const info = ESCAPE_WAVES[i];
    if (info) {
      Juice.slamText(sc, info.title, "#ff3b3b", 34, 300, 1100, this.h.dHud + 4);
      synth.play("alarm");
      const t = sc.add.text(480, 240, `📢 ${info.tannoy}`, { fontFamily: FONT, fontSize: "13px", color: "#9be7ff", backgroundColor: "#00102acc", padding: { x: 8, y: 4 }, wordWrap: { width: 760 }, align: "center" }).setOrigin(0.5, 0).setScrollFactor(0);
      Juice.layer(sc, this.h.dHud).add(t);
      sc.tweens.add({ targets: t, alpha: 0, delay: 4200, duration: 500, onComplete: () => t.destroy() });
    }
    const lanes = [470, 530, 590, 650];
    const cars = scaleCount(w.cars, d.enemyCount);
    for (let k = 0; k < cars; k++) this.spawn("car", w.x - k * 40 + (k % 2) * 60, lanes[(k * 2 + i) % lanes.length], false);
    const screech = w.screech ? scaleCount(w.screech, d.enemyCount) : 0;
    for (let k = 0; k < screech; k++) sc.time.delayedCall(300 + k * 700, () => this.spawn("car", w.x + 150 + k * 90, lanes[(k * 2 + 1 + i) % lanes.length], true));
    const tanks = w.tanks ? scaleCount(w.tanks, d.enemyCount) : 0;
    for (let k = 0; k < tanks; k++) this.spawn("tank", w.x - 220 - k * 180, 500 + ((k + i) % 2) * 120, true);
    const helis = w.helis ? scaleCount(w.helis, d.enemyCount) : 0;
    for (let k = 0; k < helis; k++) sc.time.delayedCall(600 + k * 1400, () => this.spawn("heli", 0, 0, true));
  }

  private spawn(kind: Kind, x: number, y: number, moving: boolean) {
    const sc = this.sc;
    if (this.foes.filter((f) => f.state !== "dead").length >= MAX_FOES) return;
    const now = sc.time.now;
    const me = this.h.me();
    const cam = sc.cameras.main;
    const body = sc.add.container(x, y);
    let img: Phaser.GameObjects.Image;
    let turret: Phaser.GameObjects.Image | undefined;
    let tx = x;
    let ty = y;
    let sx = x;
    let sy = y;
    if (kind === "car") {
      img = sc.textures.exists("kd_esc_car") ? sc.add.image(0, 0, "kd_esc_car").setOrigin(0.5, 1) : sc.add.image(0, 0, "p_copcar").setOrigin(0.5, 1);
      img.setFlipX(true);
      body.add(img);
      if (moving) {
        // screeching in from off-screen west
        sx = Math.min(cam.worldView.x - 160, x - 700);
      }
    } else if (kind === "tank") {
      if (sc.textures.exists("kd_esc_tank")) {
        img = sc.add.image(-73, -50, "kd_esc_tank").setOrigin(0, 0);
        turret = sc.add.image(-54, -80, "kd_esc_turret").setOrigin(0, 0);
        body.add([img, turret]);
      } else {
        img = sc.add.image(0, 0, "p_tank").setOrigin(0.5, 1);
        body.add(img);
      }
      sx = x - 420;
    } else {
      img = sc.add.image(0, 0, sc.textures.exists("kd_esc_heli") ? "kd_esc_heli" : "kd_heli").setFlipX(true);
      body.add(img);
      sx = cam.worldView.x - 160;
      sy = 300;
      tx = me.x - 300;
      // (low over the street, under the HUD band and in reach of the flamethrower)
      ty = 415 + Math.random() * 30;
    }
    body.setScale(SCALE[kind]).setPosition(sx, sy).setDepth(kind === "heli" ? this.h.dLight - 8 : sy);
    const max = HP[kind] * this.d.enemyHp;
    const barBg = sc.add.rectangle(sx, sy, 62, 6, 0x000000, 0.75).setDepth(this.h.dLight + 10).setVisible(false);
    const bar = sc.add.rectangle(sx, sy, 60, 4, 0xef4444).setOrigin(0, 0.5).setDepth(this.h.dLight + 11).setVisible(false);
    const f: Foe = { kind, body, img, turret, hp: max, max, state: moving || kind !== "car" ? "arrive" : "idle", tx, ty, vx: 0, next: now + (1600 + Math.random() * 1400) / this.d.aggression, teleUntil: 0, attack: 0, fires: [], bar, barBg, hitAt: 0, born: now };
    if (kind === "car") {
      f.siren = sc.add.circle(sx, sy, 7, 0xff2020).setDepth(this.h.dLight + 2).setBlendMode(Phaser.BlendModes.ADD);
      f.rammer = Math.random() < 0.45;
      f.copsLeft = scaleCount(2, this.d.enemyCount);
      if (!moving) {
        // a parked roadblock car: slewed across the street, its cops already out
        body.setAngle((Math.random() - 0.5) * 8);
        this.copsOut(f, 0);
      } else {
        f.vx = 900;
        synth.play("car_screech");
      }
    } else if (kind === "heli") {
      f.light = sc.add.triangle(0, 0, 0, 0, 0, 0, 0, 0, 0xffffcc, 0.14).setOrigin(0, 0).setDepth(this.h.dLight - 9).setBlendMode(Phaser.BlendModes.ADD);
      f.rotor = sc.add.rectangle(sx, sy, 150, 4, 0xd4d4d8, 0.7).setDepth(this.h.dLight - 7);
      synth.play("drone");
    } else {
      synth.play("thud");
      this.shake(300, 0.004);
    }
    this.foes.push(f);
  }

  /** The cops pile out of a stopped car and spread out to shoot. */
  private copsOut(f: Foe, delay: number) {
    const sc = this.sc;
    const n = f.copsLeft ?? 0;
    f.copsLeft = 0;
    for (let i = 0; i < n; i++) {
      sc.time.delayedCall(delay + i * 260, () => {
        if (f.state === "dead" || this.cops.filter((c) => c.state !== "dead").length >= MAX_COPS) return;
        const key = this.sc.textures.exists("kd_esc_cop") ? "kd_esc_cop" : "spr_COP";
        const spr = sc.add.image(f.body.x + (i ? 30 : -30), f.body.y - 6, key, 0).setOrigin(0.5, 1).setScale(key === "kd_esc_cop" ? 1.5 : 1.6).setDepth(f.body.y);
        const ty = Phaser.Math.Clamp(f.body.y + (i % 2 ? 40 : -40) + (Math.random() - 0.5) * 30, TOP + 10, BOTTOM);
        this.cops.push({ spr, hp: HP.cop * this.d.enemyHp, state: "run", tx: f.body.x + 40 + Math.random() * 60, ty, next: sc.time.now + 900 + Math.random() * 700, t: 0, dir: { x: 0, y: 0 }, fire: null });
        synth.play("door");
      });
    }
  }

  // ------------------------------------------------------------------ the loop

  update(time: number, dt: number) {
    const me = this.h.me();
    if (!me) return;
    const step = dt / 1000;
    const busy = this.h.busy();
    while (this.wave < WAVES.length && me.x < WAVES[this.wave].x + 900) this.spawnWave(this.wave++);
    if (this.combo && time - this.comboAt > 2600) this.combo = 0;
    this.updateFoes(time, step, busy);
    this.updateCops(time, step, busy);
    this.updateShots(time, step);
    if (!busy) this.ladsFire(time);
    // the grit bar
    const k = this.grit / 100;
    this.gritBar.width = Math.max(1, 160 * k);
    this.gritBar.setFillStyle(k > 0.5 ? 0x4ade80 : k > 0.25 ? 0xfacc15 : 0xef4444);
    if (time < this.stunUntil) {
      me.setAngle(-80);
      if (time > this.stunUntil - 120) me.setAngle(0);
    }
  }

  private updateFoes(time: number, step: number, busy: boolean) {
    const sc = this.sc;
    const me = this.h.me();
    const d = this.d;
    for (let i = this.foes.length - 1; i >= 0; i--) {
      const f = this.foes[i];
      if (f.state === "dead") continue;
      const b = f.body;
      // left far behind: gone
      if (b.x > me.x + 1150 && time - f.born > 3000) {
        this.remove(f);
        this.foes.splice(i, 1);
        continue;
      }
      if (f.kind === "car") this.carTick(f, time, step, busy);
      else if (f.kind === "tank") this.tankTick(f, time, step, busy);
      else this.heliTick(f, time, step, busy);
      // health bar, sirens, attached fires
      const top = b.y - (f.kind === "heli" ? 50 : f.kind === "tank" ? 140 : 62);
      const show = f.hp < f.max;
      f.barBg.setVisible(show).setPosition(b.x, top);
      f.bar.setVisible(show).setPosition(b.x - 30, top);
      f.bar.width = Math.max(1, 60 * (f.hp / f.max));
      if (f.siren) f.siren.setPosition(b.x + 8, b.y - 54).setFillStyle(Math.floor(time / 160) % 2 ? 0xff2020 : 0x2060ff).setAlpha(0.85);
      f.fires.forEach((fire, j) => fire.active && fire.setPosition(b.x + (j - 1) * 26, b.y - (f.kind === "heli" ? 0 : 30)));
      if (f.kind !== "heli") b.setDepth(b.y);
      void d;
    }
    void sc;
  }

  private carTick(f: Foe, time: number, step: number, busy: boolean) {
    const sc = this.sc;
    const me = this.h.me();
    const b = f.body;
    if (f.state === "arrive") {
      // screech in, sliding to a stop broadside
      b.x += f.vx * step;
      f.vx = Math.max(0, f.vx - 900 * step * (b.x > f.tx - 220 ? 2.4 : 0.2));
      if (Math.random() < 0.3) vfx(sc, "vfx_dust", b.x - 50, b.y, { scale: 0.8, depth: b.y - 1, alpha: 0.7 });
      if (f.vx <= 30 || b.x >= f.tx + 120) {
        f.state = "idle";
        f.vx = 0;
        sc.tweens.add({ targets: b, angle: (Math.random() < 0.5 ? -1 : 1) * 9, duration: 220, ease: "Back.out" });
        vfx(sc, "vfx_dust", b.x, b.y, { scale: 1.4, depth: b.y + 1 });
        this.copsOut(f, 250);
      }
      return;
    }
    if (f.state === "idle") {
      if (busy || time < f.next) return;
      const dx = me.x - b.x;
      if (f.rammer && Math.abs(dx) < 760 && Math.abs(dx) > 140) {
        // headlights flash, horn blares, then it floors it at you
        f.state = "tele";
        f.teleUntil = time + 700 * d1(this.d.telegraph);
        f.attack = dx > 0 ? 1 : -1;
        f.img.setFlipX(f.attack > 0);
        f.ty = me.y;
        synth.play("car_horn");
        const lamp = sc.add.ellipse(b.x + f.attack * 70, b.y - 22, 26, 14, 0xfff3a0, 0.9).setDepth(this.h.dLight + 4).setBlendMode(Phaser.BlendModes.ADD);
        sc.tweens.add({ targets: lamp, alpha: 0.2, yoyo: true, repeat: 3, duration: 90, onComplete: () => lamp.destroy() });
        const lane = sc.add.rectangle((b.x + me.x) / 2, b.y - 4, Math.abs(dx) + 120, 30, 0xff2020, 0.18).setDepth(b.y - 2);
        sc.tweens.add({ targets: lane, alpha: 0.4, yoyo: true, repeat: 2, duration: 110, onComplete: () => lane.destroy() });
      } else f.next = time + (2200 + Math.random() * 1500) / this.d.aggression;
      return;
    }
    if (f.state === "tele") {
      b.x += Math.sin(time / 20) * 0.8;
      if (time > f.teleUntil) {
        f.state = "ram";
        f.vx = f.attack * 720 * this.d.enemySpeed;
        synth.play("car_screech");
      }
      return;
    }
    if (f.state === "ram") {
      b.x += f.vx * step;
      if (Math.random() < 0.3) vfx(sc, "vfx_dust", b.x - f.attack * 50, b.y, { scale: 0.7, depth: b.y - 1, alpha: 0.6 });
      if (Math.abs(me.x - b.x) < 70 && Math.abs(me.y - b.y) < 34) this.hurt(14, f.attack * 160, "RAMMED!");
      // run over any of its own cops in the way
      for (const c of this.cops) if (c.state !== "dead" && c.state !== "fly" && Math.abs(c.spr.x - b.x) < 60 && Math.abs(c.spr.y - b.y) < 26) this.ragdoll(c, f.attack);
      if ((f.attack > 0 && b.x > me.x + 420) || (f.attack < 0 && b.x < me.x - 420)) {
        f.state = "idle";
        f.vx = 0;
        f.next = time + (1800 + Math.random() * 1200) / this.d.aggression;
        synth.play("car_screech");
        vfx(sc, "vfx_dust", b.x, b.y, { scale: 1.2, depth: b.y + 1 });
      }
    }
  }

  private tankTick(f: Foe, time: number, step: number, busy: boolean) {
    const sc = this.sc;
    const me = this.h.me();
    const b = f.body;
    if (f.state === "arrive") {
      b.x += 95 * this.d.enemySpeed * step;
      b.y += Math.sin(time / 60) * 0.15;
      if (b.x >= f.tx) f.state = "idle";
    }
    if (busy || time < f.next || !f.turret) return;
    if (Math.abs(me.x - b.x) > 900) return;
    f.next = time + (3400 + Math.random() * 1400) / this.d.aggression;
    // a shell lobbed at where you are now: the marker shows where it'll land
    const tx = me.x + (Math.random() - 0.5) * 30;
    const ty = me.y;
    const dur = 1200 * d1(this.d.telegraph);
    const mx = b.x + 72 * SCALE.tank * (b.scaleX < 0 ? -1 : 1);
    const my = b.y - 70 * SCALE.tank;
    sc.tweens.add({ targets: f.turret, x: f.turret.x - 5, yoyo: true, duration: 80 });
    vfx(sc, "vfx_muzzle", mx, my, { scale: 2, depth: this.h.dLight + 6 });
    vfx(sc, "vfx_blastsmoke", mx, my, { scale: 0.6, depth: this.h.dLight + 5, alpha: 0.7 });
    synth.play("boom");
    this.shake(200, 0.005);
    this.fire("shell", mx, my, tx, ty, dur, 22, 78);
  }

  private heliTick(f: Foe, time: number, step: number, busy: boolean) {
    const sc = this.sc;
    const me = this.h.me();
    const b = f.body;
    // hovers ahead of you (west), bobbing, keeping pace as you run
    f.tx = me.x - 280 + Math.sin(time / 1300 + f.born) * 120;
    const k = f.state === "arrive" ? 1.4 : 2.2;
    b.x += Phaser.Math.Clamp(f.tx - b.x, -400, 400) * k * step;
    b.y += (f.ty + Math.sin(time / 400) * 8 - b.y) * 2 * step;
    if (f.state === "arrive" && Math.abs(f.tx - b.x) < 80) f.state = "idle";
    f.img.setFlipX(me.x > b.x);
    b.setAngle(Phaser.Math.Clamp((f.tx - b.x) / 40, -10, 10));
    f.rotor?.setPosition(b.x, b.y - 30).setScale(Math.abs(Math.sin(time / 30)) * 0.9 + 0.1, 1);
    // the searchlight on you
    const lx = me.x + Math.sin(time / 500) * 30;
    f.light?.setTo(b.x, b.y + 10, lx - 60, me.y + 10, lx + 60, me.y + 10);
    if (busy) return;
    if (f.state === "idle" && time > f.next) {
      f.state = "tele";
      f.attack = Math.random() < 0.5 ? 0 : 1;
      f.teleUntil = time + (f.attack ? 900 : 700) * d1(this.d.telegraph);
      if (f.attack === 1) {
        // a lock-on reticle on you: the missile goes where it was when the lock finished
        const ret = sc.add.circle(me.x, me.y - 30, 40).setStrokeStyle(3, 0xff2020, 1).setDepth(this.h.dLight + 12);
        const cross = sc.add.text(me.x, me.y - 30, "✛", { fontFamily: FONT, fontSize: "26px", color: "#ff2020" }).setOrigin(0.5).setDepth(this.h.dLight + 12);
        f.marker = [ret, cross];
        sc.tweens.add({ targets: ret, radius: 18, duration: f.teleUntil - time });
        synth.play("telegraph");
      } else {
        // a strafing run: a line of red marks walked across your lane
        f.lockY = me.y;
        f.lockX = me.x - 260;
        const line = sc.add.rectangle(me.x, me.y, 560, 26, 0xff2020, 0.2).setDepth(me.y - 2);
        sc.tweens.add({ targets: line, alpha: 0.45, yoyo: true, repeat: -1, duration: 120 });
        f.marker = [line];
        synth.play("telegraph");
      }
    }
    if (f.state === "tele") {
      if (f.attack === 1 && f.marker) {
        for (const m of f.marker) (m as Phaser.GameObjects.Arc).setPosition(me.x, me.y - 30);
      }
      if (time > f.teleUntil) {
        f.marker?.forEach((m) => this.kill(m));
        f.marker = undefined;
        f.state = "idle";
        f.next = time + (2800 + Math.random() * 1800) / this.d.aggression;
        if (f.attack === 1) {
          synth.play("rocket");
          this.fire("missile", b.x, b.y + 16, me.x, me.y - 20, 0, 16, 70);
        } else {
          const y = f.lockY ?? me.y;
          const x0 = f.lockX ?? me.x - 260;
          synth.play("gun_gatling");
          for (let j = 0; j < 12; j++) {
            sc.time.delayedCall(j * 50, () => {
              const x = x0 + j * 46;
              vfx(sc, "vfx_hit", x, y + (Math.random() - 0.5) * 16, { scale: 0.9, depth: y + 2 });
              vfx(sc, "vfx_dust", x, y, { scale: 0.6, depth: y - 1, alpha: 0.7 });
              const m = this.h.me();
              if (Math.abs(m.x - x) < 30 && Math.abs(m.y - y) < 26) this.hurt(5, 0, null);
            });
          }
        }
      }
    }
  }

  private updateCops(time: number, step: number, busy: boolean) {
    const sc = this.sc;
    const me = this.h.me();
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const s = c.spr;
      if (c.state === "dead") {
        if (!s.active) this.cops.splice(i, 1);
        continue;
      }
      if (s.x > me.x + 1100) {
        if (c.fire) this.h.expireFire(c.fire, time);
        s.destroy();
        this.cops.splice(i, 1);
        continue;
      }
      if (c.state === "fly") continue;
      if (c.state === "burn") {
        if (time > c.t) {
          this.copDie(c, "burn");
          continue;
        }
        if (time > c.next) {
          c.next = time + 240;
          const a = Math.random() * Math.PI * 2;
          c.dir = { x: Math.cos(a), y: Math.sin(a) };
        }
        s.x += c.dir.x * 220 * step;
        s.y = Phaser.Math.Clamp(s.y + c.dir.y * 150 * step, TOP, BOTTOM);
        s.setAngle(Math.sin(time / 50) * 16);
        c.fire?.setPosition(s.x, s.y - 20);
        s.setDepth(s.y);
        continue;
      }
      s.setFlipX(me.x < s.x);
      if (c.state === "run") {
        const dx = c.tx - s.x;
        const dy = c.ty - s.y;
        const dd = Math.hypot(dx, dy);
        if (dd < 8) c.state = "shoot";
        else {
          s.x += (dx / dd) * 190 * this.d.enemySpeed * step;
          s.y += (dy / dd) * 190 * this.d.enemySpeed * step;
          s.setAngle(Math.sin(time / 60) * 6);
        }
      } else {
        s.setAngle(0);
        if (!busy && time > c.next && Math.abs(me.x - s.x) < 720) {
          c.next = time + (2100 + Math.random() * 1500) / this.d.aggression;
          // a glint (the warning), then the shot
          const dir = me.x < s.x ? -1 : 1;
          const gx = s.x + dir * 34;
          const gy = s.y - 58;
          const glint = sc.add.star(gx, gy, 4, 2, 7, 0xfff3a0).setDepth(this.h.dLight + 6).setBlendMode(Phaser.BlendModes.ADD);
          sc.tweens.add({ targets: glint, scale: 1.8, angle: 90, alpha: 0, duration: 260 * d1(this.d.telegraph), onComplete: () => {
            glint.destroy();
            if (!s.active || c.state !== "shoot") return;
            synth.play("gun_pistol");
            vfx(sc, "vfx_muzzle", gx, gy, { scale: 0.8, depth: this.h.dLight + 6, angle: dir < 0 ? 180 : 0 });
            const m = this.h.me();
            this.fire("bullet", gx, gy, m.x + (Math.random() - 0.5) * 30, m.y - 30 + (Math.random() - 0.5) * 20, 0, 5, 22);
          } });
        }
      }
      s.y = Phaser.Math.Clamp(s.y, TOP, BOTTOM);
      s.setDepth(s.y);
    }
  }

  // ------------------------------------------------------------------ their shots

  private fire(kind: Shot["kind"], x0: number, y0: number, x1: number, y1: number, dur: number, dmg: number, r: number) {
    const sc = this.sc;
    if (this.shots.length >= MAX_SHOTS) {
      const old = this.shots.shift();
      old?.obj.destroy();
      old?.marker?.forEach((m) => this.kill(m));
    }
    const key = kind === "bullet" ? "esc_bullet" : kind === "shell" ? "esc_shell" : "esc_missile";
    const obj = sc.add.image(x0, y0, key).setDepth(this.h.dLight + 7).setScale(kind === "bullet" ? 1.6 : 1.5);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const speed = (kind === "bullet" ? 430 : 460) * this.d.projectileSpeed;
    const s: Shot = { obj, kind, x0, y0, x1, y1, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, dur, dmg, r, nextTrail: 0 };
    obj.setRotation(ang);
    if (kind === "shell") {
      // where it'll land: a red ring on the street that tightens as it comes down
      const ring = sc.add.ellipse(x1, y1, r * 2.4, r * 1.1).setStrokeStyle(3, 0xff2020, 0.9).setDepth(y1 - 1);
      ring.setFillStyle(0xff2020, 0.12);
      const dot = sc.add.ellipse(x1, y1, 10, 5, 0xff2020, 0.9).setDepth(y1 - 1);
      sc.tweens.add({ targets: ring, scaleX: 0.5, scaleY: 0.5, duration: dur, ease: "Quad.in" });
      s.marker = [ring, dot];
    }
    this.shots.push(s);
  }

  private updateShots(time: number, step: number) {
    const sc = this.sc;
    const me = this.h.me();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const o = s.obj;
      let land = false;
      if (s.kind === "shell") {
        s.t += step * 1000;
        const k = Math.min(1, s.t / s.dur);
        const peak = Math.min(s.y0, s.y1) - 240;
        o.x = s.x0 + (s.x1 - s.x0) * k;
        o.y = (1 - k) * (1 - k) * s.y0 + 2 * (1 - k) * k * peak + k * k * s.y1;
        o.angle += 12;
        land = k >= 1;
      } else {
        o.x += s.vx * step;
        o.y += s.vy * step;
        if (s.kind === "missile" && time > s.nextTrail) {
          s.nextTrail = time + 50;
          vfx(sc, "vfx_smoke", o.x, o.y, { scale: 0.45, depth: this.h.dLight + 5, alpha: 0.7 });
        }
        const past = (s.x1 - s.x0) * (o.x - s.x1) + (s.y1 - s.y0) * (o.y - s.y1) > 0;
        if (s.kind === "missile") land = past;
        else {
          // bullets: hit you if they pass close, else fly on and vanish
          if (Math.abs(o.x - me.x) < s.r && Math.abs(o.y - (me.y - 30)) < s.r + 10) {
            this.hurt(s.dmg, Math.sign(s.vx) * 30, null);
            vfx(sc, "vfx_hit", o.x, o.y, { scale: 0.8, depth: this.h.dLight + 6 });
            o.destroy();
            this.shots.splice(i, 1);
            continue;
          }
          if (Math.hypot(o.x - s.x0, o.y - s.y0) > 900) {
            o.destroy();
            this.shots.splice(i, 1);
          }
          continue;
        }
      }
      if (land) {
        o.destroy();
        s.marker?.forEach((m) => this.kill(m));
        this.shots.splice(i, 1);
        this.h.explode(o.x, o.y, s.kind === "shell" ? 1.2 : 1, 0, true);
        if (Math.abs(me.x - o.x) < s.r && Math.abs(me.y - o.y) < s.r * 0.7) this.hurt(s.dmg, (me.x < o.x ? -1 : 1) * 120, s.kind === "shell" ? "SHELLED!" : "HIT!");
        // their own shells hit their own side too
        this.blast(o.x, o.y, s.r, 0.6, false);
      }
    }
  }

  /** You take a hit. Grit goes down; at zero you're knocked flat for a moment. */
  private hurt(n: number, kx: number, why: string | null) {
    const sc = this.sc;
    const now = sc.time.now;
    if (now < this.iframesUntil || now < this.stunUntil || this.h.busy()) return;
    this.iframesUntil = now + 650 * this.d.iframes;
    const dmg = n * this.d.damageTaken;
    this.grit = Math.max(0, this.grit - dmg);
    const me = this.h.me();
    me.x += kx;
    synth.play(Math.random() < 0.5 ? "hurt_1" : "hurt_2");
    me.setTintFill(0xffffff);
    sc.time.delayedCall(70, () => me.active && me.clearTint());
    // a red edge (steady under Reduce flashing, not a strobe)
    if (!this.hurtEdge || !this.hurtEdge.active) this.hurtEdge = Juice.vignette(sc, 0xff0000, 0, this.h.dHud - 1);
    sc.tweens.killTweensOf(this.hurtEdge);
    this.hurtEdge.setAlpha(Juice.calm() ? 0.35 : Math.min(0.9, 0.4 + dmg / 30));
    sc.tweens.add({ targets: this.hurtEdge, alpha: 0, duration: Juice.calm() ? 700 : 380 });
    this.shake(160, 0.006 + dmg / 3000);
    if (why) this.pop(me.x, me.y - 110, why, "#ff4d4d");
    if (this.grit <= 0) {
      // knocked down: the lads drag you back up
      this.stunUntil = now + 1500;
      this.grit = 60;
      synth.play("thud");
      Juice.slamText(sc, "KNOCKED DOWN!", "#ff4d4d", 40, 300, 700, this.h.dHud + 4);
      this.h.shout(Phaser.Utils.Array.GetRandom(ESCAPE_DOWNED));
      this.iframesUntil = now + 1500 + 1400 * this.d.iframes;
    }
  }

  // ------------------------------------------------------------------ hurting THEM

  /** The flamethrower: everything in the cone from (x, y) along angle `a` takes `step` seconds of fire. */
  flame(x: number, y: number, a: number, step: number) {
    const range = 330;
    for (const f of this.foes) {
      if (f.state === "dead") continue;
      const cy = f.kind === "heli" ? f.body.y : f.body.y - 30;
      const dx = f.body.x - x;
      const dy = cy - y;
      const d = Math.hypot(dx, dy);
      const rad = f.kind === "tank" ? 100 : f.kind === "heli" ? 70 : 70;
      if (d > range + rad) continue;
      // the cone, widened by the target's size
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a));
      if (diff < 0.42 + Math.atan2(rad, Math.max(1, d)) * 0.8) this.damage(f, step, "flame");
    }
    for (const c of this.cops) {
      if (c.state === "dead" || c.state === "burn" || c.state === "fly") continue;
      const dx = c.spr.x - x;
      const dy = c.spr.y - 40 - y;
      const d = Math.hypot(dx, dy);
      if (d > range) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a)) < 0.45 || d < 50) {
        c.hp -= step;
        if (c.hp <= 0) this.copBurn(c);
      }
    }
  }

  /** The nearest thing worth shooting (for auto-aim), as an angle from (x, y), or null. */
  nearestAngle(x: number, y: number): number | null {
    let best: { x: number; y: number } | null = null;
    let bd = 380;
    for (const f of this.foes) {
      if (f.state === "dead") continue;
      const ty = f.kind === "heli" ? f.body.y : f.body.y - 30;
      const d = Math.hypot(f.body.x - x, ty - y);
      if (d < bd) {
        bd = d;
        best = { x: f.body.x, y: ty };
      }
    }
    for (const c of this.cops) {
      if (c.state === "dead" || c.state === "burn" || c.state === "fly") continue;
      const d = Math.hypot(c.spr.x - x, c.spr.y - 40 - y) + 40;
      if (d < bd) {
        bd = d;
        best = { x: c.spr.x, y: c.spr.y - 40 };
      }
    }
    return best ? Math.atan2(best.y - y, best.x - x) : null;
  }

  /** Push you out of anything solid (a live car or tank): the roadblock is a roadblock, but there are gaps. */
  collide(me: Phaser.GameObjects.Sprite) {
    for (const f of this.foes) {
      if (f.state === "dead" || f.kind === "heli" || f.state === "ram") continue;
      const hw = f.kind === "tank" ? 95 : 72;
      const hh = f.kind === "tank" ? 30 : 20;
      const dx = me.x - f.body.x;
      const dy = me.y - f.body.y;
      if (Math.abs(dx) >= hw || Math.abs(dy) >= hh) continue;
      const px = hw - Math.abs(dx);
      const py = hh - Math.abs(dy);
      if (px < py) me.x += Math.sign(dx || 1) * px;
      else me.y = Phaser.Math.Clamp(me.y + Math.sign(dy || 1) * py, TOP, BOTTOM);
    }
  }

  private damage(f: Foe, n: number, how: "flame" | "blast" | "rocket" | "bullet") {
    if (f.state === "dead") return;
    const sc = this.sc;
    f.hp -= n;
    const now = sc.time.now;
    if (now - f.hitAt > (how === "flame" ? 240 : 90)) {
      f.hitAt = now;
      f.img.setTintFill(how === "flame" ? 0xb6ff5a : 0xffffff);
      f.turret?.setTintFill(how === "flame" ? 0xb6ff5a : 0xffffff);
      sc.time.delayedCall(50, () => {
        if (!f.img.active || f.state === "dead") return;
        const k = Math.max(0, f.hp / f.max);
        const tint = k > 0.66 ? 0xffffff : k > 0.33 ? 0xd0a090 : 0x8a6050;
        f.img.setTint(tint);
        f.turret?.setTint(tint);
      });
      if (how === "flame" && Math.random() < 0.35) vfx(sc, "vfx_sparks", f.body.x + (Math.random() - 0.5) * 60, f.body.y - (f.kind === "heli" ? 0 : 30), { scale: 0.8, depth: this.h.dLight + 6, add: true });
    }
    // it catches: fires on it as it takes damage
    const want = f.hp < f.max * 0.33 ? 3 : f.hp < f.max * 0.66 ? 2 : f.hp < f.max * 0.95 ? 1 : 0;
    while (f.fires.length < want) {
      const fire = this.h.addFire(f.body.x, f.body.y - 30, f.kind === "tank" ? 1.6 : 1.2, f.fires.length % 2 ? 0x7cff3a : 0, 0);
      if (!fire) break;
      f.fires.push(fire);
    }
    if (f.hp <= 0) this.destroyFoe(f);
  }

  private destroyFoe(f: Foe) {
    const sc = this.sc;
    f.state = "dead";
    f.marker?.forEach((m) => this.kill(m));
    f.marker = undefined;
    f.bar.destroy();
    f.barBg.destroy();
    f.siren?.destroy();
    f.light?.destroy();
    f.rotor?.destroy();
    const b = f.body;
    const now = sc.time.now;
    for (const fire of f.fires) this.h.expireFire(fire, now + 9000 + Math.random() * 3000);
    this.scored(f.kind);
    if (f.kind === "car") {
      // up it goes, flipping, and comes down on its roof in a fireball
      const y0 = b.y;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 180);
      this.h.explode(b.x, y0 - 30, 1.3);
      vfx(sc, "vfx_bigboom", b.x, y0 - 40, { scale: 2.2, depth: this.h.dLight + 30, tint: 0xffb347 });
      Juice.debris(sc, b.x, y0 - 30, 12, { colors: [0x111111, 0xfacc15, 0xff4fd8, 0x9ca3af], depth: this.h.dLight + 25, floor: y0 + 10 });
      synth.play("car_hit");
      this.blast(b.x, y0, 150, 1.4, true);
      sc.tweens.add({ targets: b, y: y0 - 150 - Math.random() * 60, angle: b.angle + spin * 0.6, duration: 420, ease: "Quad.out", onComplete: () => sc.tweens.add({ targets: b, y: y0, angle: 180, duration: 360, ease: "Quad.in", onComplete: () => {
        synth.play("smash");
        this.shake(200, 0.01);
        this.h.explode(b.x + 20, y0 - 10, 0.9, 0, false);
        vfx(sc, "vfx_dust", b.x, y0, { scale: 1.6, depth: y0 + 1 });
        this.wreck(f, 1.6);
      } }) });
    } else if (f.kind === "tank") {
      // the turret blows off into the sky, spinning, and comes down somewhere else
      const y0 = b.y;
      this.h.explode(b.x, y0 - 60, 1.8);
      this.h.explode(b.x - 50, y0 - 30, 1.2, 160);
      this.h.explode(b.x + 50, y0 - 40, 1.2, 320);
      Juice.shockRing(sc, b.x, y0 - 10, { color: 0xffb347, to: 420, rings: 3, depth: this.h.dLight + 20, flat: 0.5 });
      Juice.flash(sc, 0xffb347, 200, 0.3, this.h.dHud - 1, true);
      Juice.subDrop(0.8, 1.2);
      this.shake(420, 0.016);
      synth.play("boom");
      this.blast(b.x, y0, 220, 2.5, true);
      if (f.turret) {
        const tw = f.turret;
        const wx = b.x + (tw.x + tw.displayWidth / 2) * SCALE.tank;
        const wy = b.y + (tw.y + tw.displayHeight / 2) * SCALE.tank;
        b.remove(tw);
        tw.setOrigin(0.5).setPosition(wx, wy).setScale(SCALE.tank).setDepth(this.h.dLight + 9).setTint(0x5a4030);
        const landX = wx + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 160);
        const landY = Phaser.Math.Clamp(y0 + (Math.random() - 0.5) * 120, TOP + 20, BOTTOM);
        const o = { k: 0 };
        let nextSmoke = 0;
        sc.tweens.add({ targets: o, k: 1, duration: 1300, ease: "Linear", onUpdate: () => {
          if (!tw.active) return;
          const k = o.k;
          tw.x = wx + (landX - wx) * k;
          tw.y = (1 - k) * (1 - k) * wy + 2 * (1 - k) * k * (wy - 420) + k * k * landY;
          tw.angle += 14;
          if (sc.time.now > nextSmoke) {
            nextSmoke = sc.time.now + 70;
            vfx(sc, "vfx_smoke", tw.x, tw.y, { scale: 0.8, depth: this.h.dLight + 4, alpha: 0.8 });
          }
        }, onComplete: () => {
          if (!tw.active) return;
          tw.setAngle(170).setDepth(landY);
          this.h.explode(landX, landY, 1.1);
          this.blast(landX, landY, 120, 1.5, true);
          synth.play("smash");
          sc.time.delayedCall(20000, () => tw.destroy());
        } });
        if (Math.random() < 0.8) sc.time.delayedCall(500, () => this.shoutAt(ESCAPE_TANK_SHOUTS));
      }
      this.wreck(f, 2.2);
    } else {
      // the chopper spins out, trailing smoke, and goes into the street
      this.h.explode(b.x, b.y, 1.3);
      const groundY = Phaser.Math.Clamp(this.h.me().y + (Math.random() - 0.5) * 160, TOP + 40, BOTTOM - 10);
      const o = { vy: -60, vx: (Math.random() < 0.5 ? -1 : 1) * 120 };
      let nextSmoke = 0;
      const tick = sc.time.addEvent({ delay: 16, loop: true, callback: () => {
        if (!b.active) return tick.remove();
        const st = 0.016;
        o.vy += 520 * st;
        b.x += o.vx * st;
        b.y += o.vy * st;
        b.angle += 540 * st;
        if (sc.time.now > nextSmoke) {
          nextSmoke = sc.time.now + 60;
          vfx(sc, "vfx_smoke", b.x, b.y, { scale: 1, depth: this.h.dLight - 6, alpha: 0.85 });
          if (Math.random() < 0.4) vfx(sc, "vfx_boom", b.x, b.y, { scale: 0.5, depth: this.h.dLight + 6 });
        }
        if (b.y >= groundY) {
          tick.remove();
          b.setPosition(b.x, groundY).setAngle(o.vx > 0 ? 160 : -160).setDepth(groundY);
          this.h.explode(b.x, groundY, 2);
          this.h.explode(b.x + 50, groundY - 30, 1.2, 180);
          vfx(sc, "vfx_bigboom", b.x, groundY - 50, { scale: 3, depth: this.h.dLight + 30, tint: 0xff8a3a });
          Juice.shockRing(sc, b.x, groundY, { color: 0xff8a3a, to: 460, rings: 2, depth: this.h.dLight + 20, flat: 0.45 });
          Juice.subDrop(0.9, 1.4);
          this.shake(500, 0.018);
          this.blast(b.x, groundY, 200, 2.2, true);
          this.wreck(f, 2.2);
        }
      } });
      sc.time.delayedCall(300, () => this.shoutAt(ESCAPE_HELI_SHOUTS));
    }
    // a hit-stop on every kill (a beat longer on the big ones)
    Juice.slowMo(sc, f.kind === "car" ? 0.5 : 0.3, f.kind === "car" ? 120 : 260);
  }

  /** What's left: a burnt-out wreck (capped; the oldest goes). */
  private wreck(f: Foe, fireScale: number) {
    const sc = this.sc;
    const b = f.body;
    f.img.setTint(0x2a2020);
    b.setDepth(b.y);
    this.h.addFire(b.x, b.y - 20, fireScale, Math.random() < 0.5 ? 0x7cff3a : 0, sc.time.now + 12000, true);
    vfx(sc, "vfx_smokecol", b.x, b.y - 60, { scale: 1.6, depth: b.y - 2, alpha: 0.7 });
    this.wrecks.push(b);
    if (this.wrecks.length > MAX_WRECKS) this.wrecks.shift()?.destroy();
    const i = this.foes.indexOf(f);
    if (i >= 0) this.foes.splice(i, 1);
  }

  private remove(f: Foe) {
    f.marker?.forEach((m) => this.kill(m));
    f.bar.destroy();
    f.barBg.destroy();
    f.siren?.destroy();
    f.light?.destroy();
    f.rotor?.destroy();
    f.fires.forEach((x) => this.h.expireFire(x, this.sc.time.now));
    f.body.destroy();
  }

  /** A blast: chains into every foe and cop nearby. */
  private blast(x: number, y: number, r: number, dmg: number, chain: boolean) {
    for (const f of [...this.foes]) {
      if (f.state === "dead") continue;
      const fy = f.kind === "heli" ? f.body.y + 120 : f.body.y;
      if (Math.abs(f.body.x - x) < r && Math.abs(fy - y) < r * 0.6) {
        if (chain) this.sc.time.delayedCall(120 + Math.random() * 120, () => this.damage(f, dmg, "blast"));
        else this.damage(f, dmg, "blast");
      }
    }
    for (const c of this.cops) {
      if (c.state === "dead" || c.state === "fly") continue;
      if (Math.abs(c.spr.x - x) < r && Math.abs(c.spr.y - y) < r * 0.6) this.ragdoll(c, c.spr.x < x ? -1 : 1);
    }
  }

  // ------------------------------------------------------------------ cops

  private copBurn(c: Cop) {
    if (c.state === "burn" || c.state === "dead") return;
    const sc = this.sc;
    c.state = "burn";
    c.t = sc.time.now + 1100 + Math.random() * 600;
    c.next = 0;
    c.spr.setTint(0xff8a3a);
    c.fire = this.h.addFire(c.spr.x, c.spr.y - 20, 1, Math.random() < 0.6 ? 0x7cff3a : 0, 0);
    synth.play(Math.random() < 0.5 ? "scream_man" : "hurt_2");
    if (Math.random() < 0.3) this.h.bubble(c.spr as unknown as Phaser.GameObjects.Sprite, Phaser.Utils.Array.GetRandom(["AAAH! I'M ON FIRE!", "CALL THE FIRE BRIGADE!", "THIS ISN'T IN MY CONTRACT!", "MEDIC!!"]), "#ffe0e0");
  }

  private copDie(c: Cop, how: "burn" | "blast") {
    const sc = this.sc;
    c.state = "dead";
    const s = c.spr;
    const fire = c.fire;
    c.fire = null;
    this.scored("cop");
    sc.tweens.add({ targets: s, angle: Math.random() < 0.5 ? 90 : -90, y: s.y + 10, duration: 300, onComplete: () => {
      if (fire) this.h.expireFire(fire, sc.time.now + 900);
      if (how === "burn") {
        vfx(sc, "vfx_smoke", s.x, s.y - 10, { scale: 1, depth: s.y + 5, alpha: 0.8 });
        if (this.gore && Math.random() < 0.4) vfx(sc, "vfx_blood", s.x, s.y, { scale: 0.7, depth: this.h.dLight + 2 });
        this.h.addAsh(s.x, s.y - 14, true);
        s.destroy();
      } else {
        s.setTint(this.gore ? 0x8a3030 : 0x555555);
        sc.time.delayedCall(6000, () => sc.tweens.add({ targets: s, alpha: 0, duration: 600, onComplete: () => s.destroy() }));
      }
    } });
  }

  /** Blown off their feet: up, spinning, down in a heap (gore: a splat; gore off: cartoon stars). */
  private ragdoll(c: Cop, dir: number) {
    const sc = this.sc;
    if (c.state === "fly" || c.state === "dead") return;
    c.state = "fly";
    if (c.fire) this.h.expireFire(c.fire, sc.time.now);
    c.fire = null;
    const s = c.spr;
    const x0 = s.x;
    const y0 = s.y;
    const x1 = x0 + dir * (90 + Math.random() * 140);
    const y1 = Phaser.Math.Clamp(y0 + (Math.random() - 0.5) * 60, TOP, BOTTOM);
    const o = { k: 0 };
    synth.play(Math.random() < 0.5 ? "scream_man" : "hurt_1");
    s.setTint(0xd0a090);
    sc.tweens.add({ targets: o, k: 1, duration: 650, onUpdate: () => {
      if (!s.active) return;
      const k = o.k;
      s.x = x0 + (x1 - x0) * k;
      s.y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * (Math.min(y0, y1) - 170) + k * k * y1;
      s.angle += dir * 22;
      s.setDepth(this.h.dLight + 3);
    }, onComplete: () => {
      if (!s.active) return;
      s.setAngle(dir * 90).setDepth(y1);
      synth.play("bodies_land");
      vfx(sc, "vfx_dust", s.x, y1, { scale: 1, depth: y1 + 1 });
      if (this.gore) {
        vfx(sc, "vfx_gore", s.x, y1 - 10, { scale: 0.7, depth: this.h.dLight + 3, flipX: dir < 0 });
        vfx(sc, "vfx_bloodpool", s.x, y1 + 6, { scale: 0.8, depth: y1 - 2, hold: true });
      } else vfx(sc, "vfx_stars", s.x, y1 - 30, { scale: 0.9, depth: this.h.dLight + 3 });
      this.copDie(c, "blast");
    } });
  }

  // ------------------------------------------------------------------ the lads join in

  private ladsFire(time: number) {
    const sc = this.sc;
    const lads = this.h.lads();
    if (!lads.length) return;
    const cam = sc.cameras.main;
    const onScreen = (x: number) => Math.abs(x - cam.midPoint.x) < 480;
    // rifles: a tracer every so often at whatever's closest
    if (time > this.nextLadGun) {
      this.nextLadGun = time + 380;
      const lad = Phaser.Utils.Array.GetRandom(lads);
      const cop = this.cops.find((c) => (c.state === "shoot" || c.state === "run") && onScreen(c.spr.x));
      const foe = this.foes.find((f) => f.state !== "dead" && onScreen(f.body.x));
      const tgt = cop && Math.random() < 0.6 ? { x: cop.spr.x, y: cop.spr.y - 40, cop } : foe ? { x: foe.body.x, y: foe.kind === "heli" ? foe.body.y : foe.body.y - 30, foe } : null;
      if (tgt) {
        const x0 = lad.spr.x;
        const y0 = lad.spr.y - 34;
        const t = sc.add.rectangle(x0, y0, 14, 2, 0xfff3a0).setDepth(this.h.dLight + 7).setRotation(Math.atan2(tgt.y - y0, tgt.x - x0));
        synth.play("gun_smg");
        sc.tweens.add({ targets: t, x: tgt.x, y: tgt.y, duration: 120, onComplete: () => {
          t.destroy();
          vfx(sc, "vfx_hit", tgt.x, tgt.y, { scale: 0.6, depth: this.h.dLight + 6 });
          if ("cop" in tgt && tgt.cop && tgt.cop.state !== "dead" && tgt.cop.state !== "fly" && tgt.cop.state !== "burn") {
            tgt.cop.hp -= 0.2;
            if (tgt.cop.hp <= 0) this.ragdoll(tgt.cop, tgt.x < lad.spr.x ? -1 : 1);
          } else if ("foe" in tgt && tgt.foe) this.damage(tgt.foe, 0.12, "bullet");
        } });
      }
    }
    // rockets at the big stuff
    if (time > this.nextLadRocket) {
      const big = this.foes.filter((f) => f.state !== "dead" && f.kind !== "car" && onScreen(f.body.x));
      if (!big.length) {
        this.nextLadRocket = time + 600;
        return;
      }
      this.nextLadRocket = time + 3200 + Math.random() * 1800;
      const lad = Phaser.Utils.Array.GetRandom(lads);
      const f = Phaser.Utils.Array.GetRandom(big);
      const x0 = lad.spr.x;
      const y0 = lad.spr.y - 34;
      const tx = f.body.x;
      const ty = f.kind === "heli" ? f.body.y : f.body.y - 40;
      synth.play("rocket");
      const r = sc.textures.exists("fx_rocket") ? sc.add.image(x0, y0, "fx_rocket").setScale(1.2) : sc.add.image(x0, y0, "esc_missile");
      r.setDepth(this.h.dLight + 8).setRotation(Math.atan2(ty - y0, tx - x0));
      let next = 0;
      sc.tweens.add({ targets: r, x: tx, y: ty, duration: 520, ease: "Quad.in", onUpdate: () => {
        if (sc.time.now > next) {
          next = sc.time.now + 55;
          vfx(sc, "vfx_smoke", r.x, r.y, { scale: 0.45, depth: this.h.dLight - 7, alpha: 0.7 });
        }
      }, onComplete: () => {
        r.destroy();
        this.h.explode(tx, ty, 0.9, 0, false);
        this.damage(f, 1.1, "rocket");
      } });
    }
  }

  // ------------------------------------------------------------------ the score

  private scored(kind: Kind | "cop") {
    const sc = this.sc;
    const now = sc.time.now;
    this.wrecked++;
    this.counter.setText(`WRECKED: ${this.wrecked}`);
    sc.tweens.killTweensOf(this.counter);
    this.counter.setScale(1.5);
    sc.tweens.add({ targets: this.counter, scale: 1, duration: 260, ease: "Back.out" });
    this.combo = now - this.comboAt < 2600 ? this.combo + 1 : 1;
    this.comboAt = now;
    if (this.combo >= 2) {
      const txt = COMBO[Math.min(this.combo, COMBO.length - 1)];
      Juice.slamText(sc, `${txt}  ×${this.combo}`, this.combo >= 5 ? "#ff4fd8" : "#ffd23f", 30 + Math.min(this.combo, 6) * 3, 360, 600, this.h.dHud + 4);
      Juice.comboTick(this.combo);
    }
    if (kind !== "cop") {
      const me = this.h.me();
      this.pop(me.x, me.y - 120, kind === "tank" ? "TANK MERKED!" : kind === "heli" ? "CHOPPER MERKED!" : "COP CAR MERKED!", "#b6ff5a");
      if (kind === "car") this.shoutAt(ESCAPE_WRECK_SHOUTS);
    }
  }

  private shoutAt(pool: Line[]) {
    const now = this.sc.time.now;
    if (now < this.nextShoutAt) return;
    this.nextShoutAt = now + 1400;
    this.h.shout(Phaser.Utils.Array.GetRandom(pool));
  }

  private pop(x: number, y: number, text: string, color: string) {
    const t = this.sc.add.text(x, y, text, { fontFamily: "Impact, sans-serif", fontSize: "20px", color, stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(this.h.dLight + 40);
    this.sc.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1100, ease: "Quad.out", onComplete: () => t.destroy() });
  }

  /** Screen shake: respects the shake setting, and is gentler under Reduce flashing. */
  private shake(ms: number, k: number) {
    Juice.shake(this.sc, ms, Juice.calm() ? k * 0.4 : k);
  }

  /** Destroy a marker (and stop anything tweening it first). */
  private kill(o: Phaser.GameObjects.GameObject) {
    this.sc.tweens.killTweensOf(o);
    o.destroy();
  }

  /** For tests and the debug hooks: how it's going. */
  stats() {
    return { wave: this.wave, wrecked: this.wrecked, foes: this.foes.length, cops: this.cops.filter((c) => c.state !== "dead").length, grit: this.grit };
  }
}

/** A telegraph multiplier, never shorter than 60% of the base. */
function d1(t: number) {
  return Math.max(0.6, t);
}

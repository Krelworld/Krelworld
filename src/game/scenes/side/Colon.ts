import Phaser from "phaser";
import type { RoomDef } from "../../../data/dungeons";
import { synth } from "../../audio/Synth";

/**
 * Inside Uncle Rik, side-on: the transverse colon as a narrow run'n'gun tube.
 * A fleshy ceiling that ripples with peristalsis (and now and then a big squeeze that carries you along),
 * haustra folds scrolling past in parallax, villi, glistening mucus, drips and strands, squishy floor bumps,
 * bubbling bile in the pits and gut gas fizzing out of the pores.
 * The floor, the pits, the squeezes (crushers) and the gas (vents) themselves are SideLevel's.
 */
export interface ColonHost extends Phaser.Scene {
  player: any;
  groundY: number;
  enemies: any[];
  now(): number;
  floatText(x: number, y: number, text: string, color?: string, size?: number): void;
  toast(title: string, text: string): void;
}

/** The underside of the ceiling: nothing gets above this. */
export const COLON_CEIL = 118;
const SEG = 96;

type Seg = { s: Phaser.GameObjects.TileSprite; x: number };
type Bump = { img: Phaser.GameObjects.Image; x: number; base: number; squashUntil: number };

export class ColonTube {
  private segs: Seg[] = [];
  private mids: Phaser.GameObjects.TileSprite[] = [];
  private fg: Phaser.GameObjects.TileSprite | null = null;
  private bumps: Bump[] = [];
  /** Small dressing that's only drawn while it's near the screen. */
  private cull: { o: Phaser.GameObjects.Components.Visible; x: number }[] = [];
  private nextCull = 0;
  private t = 0;
  private frame = 0;
  private frameT = 0;
  private nFrames = 1;
  private nextDrip = 0;
  private nextFizz = 0;
  private nextSquelchText = 0;
  private nextSquelch = 0;
  /** The big squeeze: a wave front that runs along the tube and carries everything with it. */
  private surge: { x: number } | null = null;
  private nextSurge = 9000;
  private toldSurge = false;
  private gaps: [number, number][];
  private vents: number[];

  constructor(private sc: ColonHost, private room: RoomDef) {
    this.gaps = (room.floorGaps ?? []).map(([fx, w]) => [room.w * fx, room.w * fx + w]);
    this.vents = (room.hazards ?? []).filter((h) => h.kind === "steam").map((h) => room.w * h.x);
    this.makeTextures();
  }

  private inGap(x: number, pad = 0) {
    return this.gaps.some(([a, b]) => x > a - pad && x < b + pad);
  }

  /** Small drawn bits: a floor bump, a row of villi. */
  private makeTextures() {
    const tx = this.sc.textures;
    if (!tx.exists("colon_bump")) {
      const c = tx.createCanvas("colon_bump", 40, 22)!;
      const g = c.getContext();
      g.fillStyle = "#7f1d3a";
      g.beginPath();
      g.ellipse(20, 22, 20, 18, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#e0607e";
      g.beginPath();
      g.ellipse(20, 22, 17, 15, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#f9a8b8";
      g.beginPath();
      g.ellipse(15, 13, 6, 3, -0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillRect(13, 11, 3, 2);
      c.refresh();
    }
    if (!tx.exists("colon_villi")) {
      const c = tx.createCanvas("colon_villi", 48, 14)!;
      const g = c.getContext();
      for (let i = 0; i < 8; i++) {
        const x = i * 6 + 1;
        const h = 7 + ((i * 5) % 6);
        g.fillStyle = "#9f1239";
        g.fillRect(x, 14 - h, 5, h);
        g.fillStyle = "#f472b6";
        g.fillRect(x + 1, 14 - h + 1, 3, h - 2);
        g.fillStyle = "#fecdd3";
        g.fillRect(x + 1, 14 - h, 3, 2);
      }
      c.refresh();
    }
  }

  /** A fleshy fold sticking out of the wall: stand on it. */
  platform(x: number, y: number, w: number) {
    const sc = this.sc;
    sc.add.ellipse(x, y + 6, w + 6, 22, 0x6b0f2a).setDepth(3.9);
    if (sc.textures.exists("colon_ledge")) sc.add.tileSprite(x, y - 8, w, 16, "colon_ledge").setOrigin(0.5, 0).setDepth(4);
    else sc.add.rectangle(x, y, w, 14, 0xe0607e).setDepth(4);
    // mucus hanging off the underside
    for (let i = 0; i < 3; i++) {
      const dx = x - w / 2 + 16 + ((w - 32) * (i + 0.5)) / 3;
      const d = sc.add.ellipse(dx, y + 14, 5, 9 + i * 3, 0xfde2e4, 0.85).setOrigin(0.5, 0).setDepth(4);
      sc.tweens.add({ targets: d, scaleY: 1.6, yoyo: true, repeat: -1, duration: 900 + i * 230, ease: "Sine.inOut" });
    }
  }

  build(obstacles: Phaser.Physics.Arcade.StaticGroup) {
    const sc = this.sc;
    const r = this.room;
    const gy = sc.groundY;
    // the far end of the tube is dark
    if (!sc.textures.exists(r.backdrop ?? "")) sc.add.rectangle(0, 0, 960, 540, 0x2a0610).setOrigin(0).setScrollFactor(0).setDepth(-19);
    // push the painted tube back a little, so the near walls read
    sc.add.rectangle(0, 0, 960, 540, 0x2a0610, 0.32).setOrigin(0).setScrollFactor(0).setDepth(-8);
    const folds = sc.textures.exists("colon_folds");
    this.nFrames = folds ? Math.max(1, sc.textures.get("colon_folds").frameTotal - 1) : 1;
    if (folds) {
      // the haustra, rippling past at two depths (top wall and bottom wall)
      const top = sc.add.tileSprite(0, 128, 960, 64, "colon_folds", 0).setOrigin(0).setScrollFactor(0).setDepth(-7).setTint(0x8a3050).setAlpha(0.5);
      top.setScale(1, 1.5);
      const bot = sc.add.tileSprite(0, gy - 104, 960, 64, "colon_folds", 3).setOrigin(0).setScrollFactor(0).setDepth(-7).setTint(0x6a1a34).setAlpha(0.45);
      bot.setScale(1, 1.6).setFlipY(true);
      this.mids = [top, bot];
      // and a dark lump of near wall sliding past in front of everything, low down
      this.fg = sc.add.tileSprite(0, 504, 960, 64, "colon_folds", 5).setOrigin(0).setScrollFactor(0).setDepth(40).setTint(0x3a0a18).setFlipY(true);
    }
    // the ceiling: solid meat, then a rippling edge of folds and villi
    sc.add.tileSprite(0, 0, r.w, COLON_CEIL, sc.textures.exists("colon_flesh") ? "colon_flesh" : "colon_floor").setOrigin(0).setDepth(9).setTileScale(2).setTint(0xd8a0b0);
    sc.add.rectangle(0, 0, r.w, 36, 0x2a0610, 0.55).setOrigin(0).setDepth(9);
    if (folds) {
      for (let x = 0; x < r.w; x += SEG) {
        const s = sc.add.tileSprite(x, COLON_CEIL - 40, SEG, 64, "colon_folds", 0).setOrigin(0).setDepth(9.5);
        s.tilePositionX = x % 512;
        this.segs.push({ s, x });
        this.cull.push({ o: s, x: x + SEG / 2 });
      }
    } else sc.add.rectangle(0, COLON_CEIL - 8, r.w, 16, 0xe0607e).setOrigin(0).setDepth(9.5);
    obstacles.add(sc.add.rectangle(r.w / 2, COLON_CEIL / 2, r.w, COLON_CEIL, 0, 0));
    // villi along the floor (not over the pits)
    let x0 = 0;
    for (const [a, b] of [...this.gaps].sort((p, q) => p[0] - q[0])) {
      if (a > x0) sc.add.tileSprite(x0, gy + 2, a - x0, 14, "colon_villi").setOrigin(0, 1).setDepth(2.5).setTileScale(1.4);
      x0 = b;
    }
    if (x0 < r.w) sc.add.tileSprite(x0, gy + 2, r.w - x0, 14, "colon_villi").setOrigin(0, 1).setDepth(2.5).setTileScale(1.4);
    // squishy bumps in the floor
    const rnd = new Phaser.Math.RandomDataGenerator(["rik_colon"]);
    for (let x = 140; x < r.w - 120; x += rnd.between(90, 170)) {
      if (this.inGap(x, 40)) continue;
      const base = rnd.realInRange(0.8, 1.5);
      const img = sc.add.image(x, gy + 4, "colon_bump").setOrigin(0.5, 1).setDepth(3).setScale(base * 1.2, base);
      this.bumps.push({ img, x, base, squashUntil: 0 });
      this.cull.push({ o: img, x });
    }
    // glistening mucus: specks catching the light on the ceiling edge and the floor
    for (let i = 0; i < 100; i++) {
      const onCeil = i % 2 === 0;
      const x = rnd.between(20, r.w - 20);
      if (!onCeil && this.inGap(x, 10)) continue;
      const y = onCeil ? COLON_CEIL + rnd.between(-6, 18) : gy + rnd.between(2, 14);
      const sp = sc.add.rectangle(x, y, 3, 2, 0xffffff, 0).setDepth(10);
      this.cull.push({ o: sp, x });
      sc.tweens.add({ targets: sp, alpha: { from: 0, to: 0.95 }, yoyo: true, repeat: -1, duration: 260, hold: 120, repeatDelay: rnd.between(900, 4200), delay: rnd.between(0, 4000) });
    }
    // strings of mucus hanging from the ceiling, swaying
    for (let i = 0; i < 18; i++) {
      const x = rnd.between(200, r.w - 200);
      const len = rnd.between(40, 150);
      const c = sc.add.container(x, COLON_CEIL + 10).setDepth(8.5);
      this.cull.push({ o: c, x });
      c.add(sc.add.rectangle(0, 0, 3, len, 0xfde2e4, 0.55).setOrigin(0.5, 0));
      c.add(sc.add.ellipse(0, len, 9, 12, 0xfde2e4, 0.8));
      c.add(sc.add.rectangle(-1, len - 3, 2, 2, 0xffffff, 0.9));
      sc.tweens.add({ targets: c, angle: { from: -7, to: 7 }, yoyo: true, repeat: -1, duration: rnd.between(1400, 2400), ease: "Sine.inOut", delay: rnd.between(0, 1500) });
      sc.tweens.add({ targets: c, scaleY: { from: 0.9, to: 1.12 }, yoyo: true, repeat: -1, duration: rnd.between(1700, 2600), ease: "Sine.inOut" });
    }
    // the whole place throbs, gently (a slow pulse, never a flash)
    const beat = sc.add.rectangle(0, 0, 960, 540, 0x7f1d1d, 0).setOrigin(0).setScrollFactor(0).setDepth(35);
    sc.tweens.add({ targets: beat, fillAlpha: 0.07, yoyo: true, repeat: -1, duration: 520, hold: 80, repeatDelay: 420, ease: "Sine.inOut" });
    // little signs, as in the old top-down room
    const signs = ["HAUSTRA", "MUCOSA (WET)", "1x SWEETCORN (2019)", "DO NOT TOUCH THE WALLS", "← STOMACH", "RECTUM →"];
    signs.forEach((s, i) => sc.add.text(r.w * (0.08 + (i * 0.86) / signs.length), COLON_CEIL + 30, s, { fontFamily: "monospace", fontSize: "10px", color: "#fecdd3" }).setAlpha(0.45).setDepth(-5));
  }

  /** How far down the ceiling has squeezed at x (px): the slow ripple plus the big squeeze when it's passing. */
  private squeezeAt(x: number) {
    const ph = x / 260 - this.t / 520;
    let d = Math.pow(Math.max(0, Math.sin(ph)), 3) * 10;
    if (this.surge) d += 28 * Math.exp(-(((x - this.surge.x) / 170) ** 2));
    return d;
  }

  update(dt: number, busy: boolean) {
    const sc = this.sc;
    const cam = sc.cameras.main;
    const now = sc.now();
    const p = sc.player;
    if (!p?.spr) return;
    this.t += dt;
    const gy = sc.groundY;
    const left = cam.scrollX - 80;
    const right = cam.scrollX + 960 + 80;
    if (now > this.nextCull || now < this.nextCull - 1000) {
      this.nextCull = now + 150;
      for (const c of this.cull) c.o.setVisible(c.x > left - 120 && c.x < right + 120);
    }
    // the animated folds
    this.frameT += dt;
    let newFrame = false;
    if (this.frameT > 130) {
      this.frameT = 0;
      this.frame = (this.frame + 1) % this.nFrames;
      newFrame = true;
    }
    if (newFrame) {
      this.mids.forEach((m, i) => m.setFrame((this.frame + i * 3) % this.nFrames));
      this.fg?.setFrame((this.frame + 5) % this.nFrames);
    }
    if (this.mids[0]) this.mids[0].tilePositionX = cam.scrollX * 0.55;
    if (this.mids[1]) this.mids[1].tilePositionX = cam.scrollX * 0.7;
    if (this.fg) this.fg.tilePositionX = cam.scrollX * 1.3;
    // the ceiling ripples (only what's on screen)
    for (const sg of this.segs) {
      if (sg.x + SEG < left || sg.x > right) continue;
      sg.s.y = COLON_CEIL - 40 + this.squeezeAt(sg.x + SEG / 2);
      if (newFrame) sg.s.setFrame(this.frame);
    }
    // the floor bumps swell with the wave, and squish when trodden on
    const pb = p.spr.body as Phaser.Physics.Arcade.Body;
    const grounded = pb.blocked.down || pb.touching.down;
    for (const b of this.bumps) {
      if (b.x < left || b.x > right) continue;
      const swell = 1 + this.squeezeAt(b.x) / 40;
      if (now < b.squashUntil) {
        b.img.setScale(b.base * 1.55, b.base * 0.45);
        continue;
      }
      b.img.setScale(b.base * 1.2, b.base * swell);
      if (grounded && Math.abs(p.x - b.x) < 22 && Math.abs(pb.bottom - gy) < 10) {
        b.squashUntil = now + 380;
        if (now > this.nextSquelch) {
          this.nextSquelch = now + 260;
          synth.play("splat", 0.35);
        }
        if (now > this.nextSquelchText) {
          this.nextSquelchText = now + 5000;
          sc.floatText(b.x, gy - 30, Math.random() < 0.5 ? "*squelch*" : "*squish*", "#fda4af", 12);
        }
      }
    }
    if (busy) return;
    // drips off the ceiling
    if (now > this.nextDrip) {
      this.nextDrip = now + 180 + Math.random() * 260;
      this.drip(cam.scrollX + 30 + Math.random() * 900);
    }
    // bile fizzing in the pits, gas bubbling out of the pores
    if (now > this.nextFizz) {
      this.nextFizz = now + 90;
      for (const [a, b] of this.gaps) {
        if (b < left || a > right || Math.random() > 0.5) continue;
        const bx = a + 8 + Math.random() * (b - a - 16);
        const bub = sc.add.circle(bx, gy + 26, 3 + Math.random() * 4, 0xd9f99d, 0.85).setStrokeStyle(1, 0x365314, 0.8).setDepth(1.5);
        sc.tweens.add({ targets: bub, y: gy + 12, scale: 1.4, duration: 500 + Math.random() * 300, onComplete: () => {
          bub.destroy();
          const pop = sc.add.circle(bx, gy + 12, 5, 0xecfccb, 0.6).setDepth(1.5);
          sc.tweens.add({ targets: pop, scale: 2, alpha: 0, duration: 180, onComplete: () => pop.destroy() });
        } });
      }
      for (const vx of this.vents) {
        if (vx < left || vx > right || Math.random() > 0.45) continue;
        const g = sc.add.circle(vx + (Math.random() - 0.5) * 24, gy - 4, 2 + Math.random() * 4, 0xbef264, 0.5).setDepth(6);
        sc.tweens.add({ targets: g, y: gy - 50 - Math.random() * 60, x: g.x + (Math.random() - 0.5) * 30, alpha: 0, scale: 2.2, duration: 900 + Math.random() * 600, onComplete: () => g.destroy() });
      }
    }
    // the big squeeze: every so often a contraction runs along the tube and carries everything with it
    if (!this.surge && now > this.nextSurge) {
      this.surge = { x: cam.scrollX - 300 };
      synth.play("fart", 0.4);
      if (!this.toldSurge) {
        this.toldSurge = true;
        sc.toast("PERISTALSIS", "The colon's squeezing everything along. Including you. Go with it.");
      }
    }
    if (this.surge) {
      const sg = this.surge;
      sg.x += dt * 0.6;
      const near = Math.abs(p.x - sg.x) < 110;
      if (near) {
        p.spr.x += dt * 0.32;
        if (Math.random() < dt / 300) cam.shake(80, 0.002);
      }
      for (const e of sc.enemies) if (!e.dead && !e.isBoss && e.walker && Math.abs(e.x - sg.x) < 110) e.x += dt * 0.3;
      if (sg.x > cam.scrollX + 1300) {
        this.surge = null;
        this.nextSurge = now + 11000 + Math.random() * 5000;
      }
    }
  }

  /** One drop of mucus: it gathers on the ceiling, stretches, lets go and splats on the floor. */
  private drip(x: number) {
    const sc = this.sc;
    const gy = sc.groundY;
    if (this.inGap(x, 4)) return;
    const y0 = COLON_CEIL + 18 + this.squeezeAt(x);
    const d = sc.add.ellipse(x, y0, 5, 7, 0xfde2e4, 0.9).setDepth(8).setScale(0.3);
    sc.tweens.add({
      targets: d,
      scaleX: 1,
      scaleY: 1.6,
      duration: 380,
      onComplete: () => {
        sc.tweens.add({
          targets: d,
          y: gy - 3,
          scaleY: 2.2,
          duration: 520,
          ease: "Quad.in",
          onComplete: () => {
            d.destroy();
            const s = sc.add.ellipse(x, gy - 1, 14, 4, 0xfde2e4, 0.8).setDepth(8);
            sc.tweens.add({ targets: s, scaleX: 1.8, alpha: 0, duration: 420, onComplete: () => s.destroy() });
            const p = sc.player;
            if (p?.spr && Math.abs(p.x - x) < 16 && p.y > gy - 120 && Math.random() < 0.35) sc.floatText(p.x, p.y - 60, "*drip*", "#fecdd3", 11);
          },
        });
      },
    });
  }
}

// Art style test: PixelLab characters and tiles at phone size, plus a sound check.
import Phaser from "phaser";
import { drawFigure } from "./figures";
import { Projection } from "./projection";
import { Audio } from "./audio";

const DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
const CELL = 88;
/** Characters whose walk cycle has been generated. */
const WALKS: string[] = (window as any).__walks ?? ["fan", "steward", "england", "portugal", "referee"]; // every frame is padded to this, feet on the same line
const $ = (id: string) => document.getElementById(id)!;

/** Which of the 8 directions a facing angle (radians, y down) is closest to. */
function dirIndex(a: number): number {
  // atan2: 0 = east, +pi/2 = south (screen down).
  const order = [2, 1, 0, 7, 6, 5, 4, 3]; // east, south-east, south, south-west, west, north-west, north, north-east
  const k = Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) / (Math.PI / 4)) % 8;
  return order[k];
}

interface Walker { s: Phaser.GameObjects.Sprite; key: string; x: number; y: number; tx: number; ty: number; speed: number; ai: boolean; facing: number }

class ArtScene extends Phaser.Scene {
  walkers: Walker[] = [];
  fan!: Walker;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  jx = 0; jy = 0; joyId = -1; ox = 0; oy = 0;
  shapes = false;
  shapeG!: Phaser.GameObjects.Graphics;
  P = new Projection();
  audio = new Audio("audio/");
  hasWalk: Record<string, boolean> = {};

  preload() {
    this.load.image("tiles-pitch", "art/tiles-pitch.png");
    this.load.image("tiles-street", "art/tiles-street.png");
    for (const k of ["fan48", "steward48"]) this.load.spritesheet(`${k}-rot`, `art/${k}-rot.png`, { frameWidth: 48, frameHeight: 48 });
    for (const k of ["fan", "steward", "england", "portugal", "referee"]) {
      this.load.spritesheet(`${k}-rot`, `art/${k}-rot.png`, { frameWidth: CELL, frameHeight: CELL });
      if (WALKS.includes(k)) this.load.spritesheet(`${k}-walk`, `art/${k}-walk.png`, { frameWidth: CELL, frameHeight: CELL });
    }
  }

  create() {
    // Ground: a pitch edge, a strip of concourse, then pavement and road.
    const tile = (key: string, idx: number, x: number, y: number) => this.add.image(x, y, key, undefined).setOrigin(0).setCrop((idx % 4) * 32, Math.floor(idx / 4) * 32, 32, 32).setPosition(x - (idx % 4) * 32, y - Math.floor(idx / 4) * 32);
    const meta = { pitchGrass: 6, pitchConcrete: 12, streetPave: 12, streetRoad: 6 }; // the pitch set came back with its terrains the other way round
    for (let ty = 0; ty < 20; ty++) for (let tx = 0; tx < 30; tx++) {
      const x = tx * 32, y = ty * 32;
      if (ty < 9) tile("tiles-pitch", meta.pitchGrass, x, y);
      else if (ty < 13) tile("tiles-pitch", meta.pitchConcrete, x, y);
      else if (ty < 17) tile("tiles-street", meta.streetPave, x, y);
      else tile("tiles-street", meta.streetRoad, x, y);
    }
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.9).fillRect(0, 9 * 32 - 30, 960, 3).fillRect(480, 0, 3, 9 * 32 - 30);
    g.lineStyle(3, 0xffffff, 0.9).strokeCircle(480, 120, 70);
    // Animations, where the walk cycle has arrived.
    for (const k of ["fan", "steward", "england", "portugal", "referee"]) {
      const tex = this.textures.get(`${k}-walk`);
      this.hasWalk[k] = !!tex && tex.key !== "__MISSING" && tex.frameTotal > 8;
      if (!this.hasWalk[k]) continue;
      DIRS.forEach((d, di) => this.anims.create({ key: `${k}-walk-${di}`, frames: this.anims.generateFrameNumbers(`${k}-walk`, { start: di * 8, end: di * 8 + 7 }), frameRate: k === "fan" ? 8 : 11, repeat: -1 }));
    }
    const add = (key: string, x: number, y: number, ai: boolean, speed: number) => {
      const w: Walker = { s: this.add.sprite(x, y, `${key}-rot`, 0).setOrigin(0.5, 0.86), key, x, y, tx: x, ty: y, speed, ai, facing: Math.PI / 2 };
      this.walkers.push(w);
      return w;
    };
    this.fan = add("fan", 320, 360, false, 60);
    add("steward", 520, 330, true, 45); add("steward", 760, 380, true, 45);
    add("england", 200, 150, true, 95); add("england", 640, 90, true, 95);
    add("portugal", 380, 190, true, 95); add("portugal", 800, 200, true, 95);
    add("referee", 520, 140, true, 85);
    // A size line-up on the concourse: the 64px set next to the 48px set.
    const label = (t: string, x: number, y: number) => this.add.text(x, y, t, { fontFamily: "system-ui, sans-serif", fontSize: "9px", color: "#ffffff", backgroundColor: "#000000aa", padding: { x: 2, y: 1 } }).setOrigin(0.5, 0).setResolution(3).setDepth(1000);
    const lineup: [string, number][] = [["fan", 80], ["fan48", 130], ["steward", 180], ["steward48", 230]];
    for (const [k, x] of lineup) {
      const big = !k.endsWith("48");
      this.add.sprite(x, 395, `${k}-rot`, 0).setOrigin(0.5, big ? 0.86 : 0.92).setDepth(395);
      label(big ? "64px" : "48px", x, 400);
    }
    this.shapeG = this.add.graphics().setDepth(5);
    this.cameras.main.setZoom(2).setRoundPixels(true).startFollow(this.fan.s, true, 0.12, 0.12).setBounds(0, 0, 960, 640);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.wire();
  }

  wire() {
    document.querySelectorAll<HTMLButtonElement>("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      this.cameras.main.setZoom(+b.dataset.zoom!);
      document.querySelectorAll("[data-zoom]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    }));
    $("shapes").addEventListener("click", () => { this.shapes = !this.shapes; $("shapes").setAttribute("aria-pressed", String(this.shapes)); });
    $("snd").addEventListener("click", async () => {
      await this.audio.unlock();
      const seq: [string, number][] = [["whistle", 0], ["goal_roar", 900], ["tannoy_welcome", 4500], ["stw_oi", 11500], ["splat", 12700], ["punch", 13400], ["groan", 14200], ["whistle_end", 17500]];
      this.audio.setCrowd(1, 1);
      for (const [c, t] of seq) setTimeout(() => (c.startsWith("tannoy") ? this.audio.tannoy(c as any) : this.audio.play(c as any)), t);
    });
    const canvas = this.game.canvas, joy = $("joy"), knob = $("knob");
    canvas.addEventListener("pointerdown", (e) => {
      if (e.clientX > window.innerWidth * 0.5) return;
      this.joyId = e.pointerId; this.ox = e.clientX; this.oy = e.clientY;
      joy.hidden = false; joy.style.left = `${e.clientX}px`; joy.style.top = `${e.clientY}px`;
    });
    const release = () => { this.joyId = -1; this.jx = this.jy = 0; joy.hidden = true; knob.style.transform = ""; };
    window.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.joyId) return;
      let dx = (e.clientX - this.ox) / 50, dy = (e.clientY - this.oy) / 50; const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.jx = dx; this.jy = dy; knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    });
    for (const ev of ["pointerup", "pointercancel"]) window.addEventListener(ev, (e) => { if ((e as PointerEvent).pointerId === this.joyId) release(); });
    window.addEventListener("touchend", (e) => { if (![...e.touches].some((t) => t.clientX < window.innerWidth * 0.5)) release(); });
    const refit = () => this.scale.refresh();
    new ResizeObserver(refit).observe($("game"));
  }

  update(_t: number, dms: number) {
    const dt = Math.min(dms, 100) / 1000, k = this.keys;
    let mx = this.jx, my = this.jy;
    if (this.joyId === -1) { mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0); my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0); }
    this.shapeG.clear();
    for (const w of this.walkers) {
      let vx = 0, vy = 0;
      if (w.ai) {
        const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
        if (d < 3) { if (Math.random() < 0.01) { w.tx = 60 + Math.random() * 840; w.ty = w.key === "steward" ? 300 + Math.random() * 120 : 40 + Math.random() * 220; } }
        else { vx = (dx / d) * w.speed; vy = (dy / d) * w.speed; }
      } else { const l = Math.hypot(mx, my); if (l > 0.1) { vx = (mx / Math.max(1, l)) * w.speed * Math.min(1, l * 1.4); vy = (my / Math.max(1, l)) * w.speed * Math.min(1, l * 1.4); } }
      w.x = Phaser.Math.Clamp(w.x + vx * dt, 20, 940); w.y = Phaser.Math.Clamp(w.y + vy * dt, 30, 630);
      const moving = Math.hypot(vx, vy) > 2;
      if (moving) w.facing = Math.atan2(vy, vx);
      const di = dirIndex(w.facing);
      w.s.setPosition(Math.round(w.x), Math.round(w.y)).setDepth(w.y).setVisible(!this.shapes);
      if (moving && this.hasWalk[w.key]) w.s.play(`${w.key}-walk-${di}`, true);
      else { w.s.stop(); w.s.setTexture(`${w.key}-rot`, di); }
      if (this.shapes) {
        // The placeholder figures, at the same scale, for comparison.
        this.P.S = 38; // so a placeholder is the same height as a 64px sprite
        const colour: Record<string, [number, number]> = { fan: [0xf4f4f4, 0x1b2a6b], steward: [0x222222, 0x111111], england: [0xf4f4f4, 0x1b2a6b], portugal: [0xb3122a, 0x0b6b3a], referee: [0x15171a, 0xf2c94c] };
        const [shirt, trim] = colour[w.key];
        const gx = w.x / this.P.S, gy = w.y / (this.P.S * this.P.K);
        drawFigure(this.shapeG, this.P, gx, gy, w.facing, { shirt, trim, shorts: 0x2b3b55, skin: 0xe8b896, girth: w.key === "fan" ? 1.75 : 1, vest: w.key === "steward" ? 0xd9e021 : null }, this.time.now / 16, moving);
      }
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO, parent: "game", backgroundColor: "#101412", pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: ArtScene,
});

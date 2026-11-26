import Phaser from "phaser";
import type { Line } from "../../../data/types";
import type { ResolvedLine } from "../../systems/narrative";
import { synth } from "../../audio/Synth";
import { DialogueBox } from "../../ui/DialogueBox";
import { runOverlay } from "../../gfx/Overlay";
import { calm, subDrop } from "../../gfx/Juice";

/**
 * The Job Centre staff toilet (chapter 5, the SanMikverse, "Job Centre Plus (Catford Branch)"): SanChz and a jam donut.
 *
 * A full-frame cutscene over the paused room (gfx/Overlay.ts: the fight underneath is frozen, nothing moves or hits you
 * while it plays). Its own dialogue box plays the scene's lines, word for word; each line can carry a stage cue in its
 * `fx` ("dn_door", "dn_room", "dn_reveal", ...) and the picture acts it out as that line shows:
 *
 *  - the door creaks open on a strip of candlelight; the transformed toilet (tealights on the cistern, rose petals in
 *    the sink, a little speaker playing slow jams) is revealed; SanChz is there, eyes shut, a jam donut held to the
 *    front of his (zipped, belted) trousers, swaying to the music;
 *  - a small pixelated patch over the middle of the donut, as a comic touch (drawn into his art; he is fully clothed:
 *    there is nothing under it);
 *  - hearts, "YEGHHH", motion lines and a drip of jam when the donut moans; SanMik bursts in; the building shakes.
 *
 * His moans are his own recorded YEGHs (Synth's "yegh" bank) pitched and timed; the slow jam is an existing track.
 * Screen space, 960x540; the art keeps the important part above the dialogue box (y < 360).
 */

/** The art (public/art/ss), loaded the first time the scene plays. */
export const DONUT_ART: Record<string, string> = {
  dn_toilet: "ss/dn_toilet.png",
  dn_chz: "ss/dn_chz.png",
  dn_chz_moan: "ss/dn_chz_moan.png",
};

/** The stage cues a line can carry in `fx`. */
export type DonutCue = "dn_door" | "dn_room" | "dn_reveal" | "dn_freeze" | "dn_rage" | "dn_resume" | "dn_moan" | "dn_burst" | "dn_love" | "dn_shake" | "dn_still";

/** The art is 256x144, drawn at 3.75x to fill the 960x540 frame. */
const K = 3.75;
/**
 * SanChz (128x160 art, his soles on row 149): where his feet stand (behind the dialogue box, the anchor he sways from)
 * and his scale. The donut lands at about y 288, his hat at about y 85: all of it above the box (y 362), and the donut
 * left of x 650, where a phone puts the box's AUTO / LOG / SKIP pills (on its top edge, right end); the tealights on
 * the cistern stay in view to his left.
 */
const CHZ = { x: 595, y: 380, k: 2.25, feet: 149 };
/** The donut in his art, in art pixels (centre, radius): the hearts, the jam and the motion lines come from here. */
const DONUT = { x: 68, y: 108, r: 18 };
/** Tealights (art pixels of the backdrop) for the flicker: five on the cistern, one by the sink, one on the shelf. */
const CANDLES: [number, number][] = [[108, 54], [116, 53], [124, 53], [132, 53], [140, 54], [47, 62], [196, 47]];
/** The little speaker on the shelf. */
const SPEAKER = { x: 204, y: 50 };

interface Data {
  lines: Line[];
  done: () => void;
}

/** Play the toilet scene over `sc` (paused underneath, resumed after). */
export function playDonutToilet(sc: Phaser.Scene, lines: Line[]): Promise<void> {
  return runOverlay(sc, "DonutToilet", DonutToiletScene, { lines });
}

export class DonutToiletScene extends Phaser.Scene {
  private d!: Data;
  private chz?: Phaser.GameObjects.Image;
  private sway?: Phaser.Tweens.Tween;
  private fxLayer!: Phaser.GameObjects.Container;
  private beatTimer?: Phaser.Time.TimerEvent;
  private finished = false;
  private tune: string | null = null;
  /** The lines as shown, in order (for the checks: scripts/donut-check.cjs). */
  shown: string[] = [];

  constructor() {
    super("DonutToilet");
  }

  init(d: Data) {
    this.d = d;
    this.finished = false;
    this.chz = undefined;
    this.sway = undefined;
    this.beatTimer = undefined;
    this.shown = [];
  }

  preload() {
    for (const [k, f] of Object.entries(DONUT_ART)) if (!this.textures.exists(k)) this.load.image(k, `art/${f}`);
  }

  create() {
    this.cameras.main.setScroll(0, 0).setZoom(1).setBackgroundColor(0x000000);
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.tune = synth.currentMusic();
    this.makeHeart();
    // the room (dark until the door opens)
    const bg = this.textures.exists("dn_toilet") ? this.add.image(0, 0, "dn_toilet").setOrigin(0).setScale(K) : this.add.rectangle(0, 0, 960, 540, 0x3b2a2a).setOrigin(0);
    bg.setName("bg");
    // the tealights flicker (a warm glow over each)
    for (const [cx, cy] of CANDLES) {
      const g = this.add.circle(cx * K, cy * K, 14, 0xffb347, 0.35).setBlendMode(Phaser.BlendModes.ADD);
      if (!calm()) this.tweens.add({ targets: g, alpha: { from: 0.18, to: 0.45 }, scale: { from: 0.8, to: 1.15 }, duration: 140 + Math.random() * 160, yoyo: true, repeat: -1, delay: Math.random() * 200 });
    }
    // SanChz (hidden till the reveal)
    if (this.textures.exists("dn_chz")) {
      const h = this.textures.get("dn_chz").getSourceImage().height;
      this.chz = this.add.image(CHZ.x, CHZ.y, "dn_chz").setOrigin(0.5, CHZ.feet / h).setScale(CHZ.k).setVisible(false);
    }
    this.fxLayer = this.add.container(0, 0);
    // the door: a black screen with a strip of candlelight that opens
    const door = this.add.graphics().setName("door");
    this.drawDoor(door, 0);
    const box = new DialogueBox(this, 1000, 0.05);
    void box
      .play(this.d.lines, {
        onLine: (rl: ResolvedLine) => {
          this.shown.push(rl.t);
          if (rl.fx) this.cue(rl.fx as DonutCue);
        },
      })
      .then(() => this.finish(box));
    this.events.once("shutdown", () => this.cleanup());
  }

  /** The door at `open` 0..1: black, with the gap of light widening. */
  private drawDoor(g: Phaser.GameObjects.Graphics, open: number) {
    g.clear();
    if (open >= 1) return;
    const gap = 6 + open * 954;
    const x0 = 480 - gap / 2;
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, Math.max(0, x0), 540);
    g.fillRect(x0 + gap, 0, Math.max(0, 960 - x0 - gap), 540);
  }

  private openDoor(to: number, ms: number) {
    const door = this.children.getByName("door") as Phaser.GameObjects.Graphics | null;
    if (!door) return;
    const o = { v: (door.getData("open") as number) ?? 0 };
    this.tweens.add({ targets: o, v: to, duration: ms, ease: "Sine.easeInOut", onUpdate: () => {
      door.setData("open", o.v);
      this.drawDoor(door, o.v);
    } });
  }

  /** A stage cue from a line's `fx`. */
  private cue(c: DonutCue) {
    switch (c) {
      case "dn_door":
        synth.play("drp_creak", 0.9, 0.8);
        this.openDoor(0.08, 1400);
        return;
      case "dn_room":
        synth.play("drp_creak", 0.7, 0.7);
        this.openDoor(1, 1600);
        // a small speaker playing slow jams
        synth.musicRaw("mot_rnb", true);
        this.notes();
        return;
      case "dn_reveal":
        this.openDoor(1, 10);
        this.reveal();
        return;
      case "dn_freeze":
        this.stopSway();
        return;
      case "dn_rage":
        this.stopSway();
        this.cameras.main.shake(350, 0.01);
        this.setFace(true);
        return;
      case "dn_resume":
        this.setFace(false);
        this.startSway(820, 0.8);
        return;
      case "dn_moan":
        // the donut moans: a little high one (his own YEGH, pitched way up), hearts, a drip of jam
        this.startSway(560, 1.2);
        this.setFace(true);
        this.moan(1.75, 3, 0.55);
        this.time.delayedCall(650, () => this.moan(1.6, 1, 0.45));
        this.hearts(7);
        this.jam();
        this.motion(true);
        return;
      case "dn_burst":
        this.burst();
        return;
      case "dn_love":
        this.startSway(420, 1.6);
        this.setFace(true);
        this.moan(0.82, 8, 0.8);
        this.hearts(12);
        this.yeghText();
        this.jam();
        this.motion(true);
        return;
      case "dn_shake":
        this.cameras.main.shake(900, calm() ? 0.004 : 0.012);
        subDrop();
        return;
      case "dn_still":
        this.stopSway();
        this.motion(false);
        this.setFace(false);
        return;
    }
  }

  private reveal() {
    if (!this.chz) return;
    this.chz.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.chz, alpha: 1, duration: 500 });
    // a slow push in on him
    this.tweens.add({ targets: this.chz, scale: CHZ.k * 1.04, duration: 2400, ease: "Sine.easeOut" });
    this.moan(0.85, 8, 0.5);
    this.startSway(820, 0.8);
    this.time.delayedCall(400, () => this.hearts(4));
  }

  /** His rhythmic sway: a lean and a thrust from the hips, `ms` a beat, `amp` how much. A creak on every beat. */
  private startSway(ms: number, amp: number) {
    if (!this.chz) return;
    this.stopSway();
    const c = this.chz;
    const x0 = CHZ.x;
    const sc0 = c.scaleX;
    const t = { p: 0 };
    this.sway = this.tweens.add({
      targets: t,
      p: 1,
      duration: ms,
      repeat: -1,
      onUpdate: () => {
        const s = Math.sin(t.p * Math.PI * 2);
        c.setAngle(s * 2.2 * amp).setX(x0 + s * 7 * amp);
        c.setScale(sc0 * (1 + Math.max(0, s) * 0.012 * amp), sc0 * (1 - Math.max(0, s) * 0.012 * amp));
      },
      onRepeat: () => {
        synth.play("drp_creak", 0.25 + 0.1 * amp, 0.9 + Math.random() * 0.2);
        if (amp > 1 && Math.random() < 0.6) synth.shout("sq_squelch", 0.35, 1.1 + Math.random() * 0.3);
      },
    });
  }

  private stopSway() {
    this.sway?.remove();
    this.sway = undefined;
    if (this.chz) this.tweens.add({ targets: this.chz, angle: 0, x: CHZ.x, duration: 200 });
  }

  private setFace(moaning: boolean) {
    if (!this.chz) return;
    const k = moaning && this.textures.exists("dn_chz_moan") ? "dn_chz_moan" : "dn_chz";
    if (this.chz.texture.key !== k) this.chz.setTexture(k);
  }

  /** One of his recorded YEGHs at `rate` (slow and low for him, high and squeaky for the donut). */
  private moan(rate: number, take: number, vol: number) {
    synth.shout("yegh", vol, rate, take);
  }

  /** Where a point of his art is on screen now (he leans and sways). */
  private artPt(ax: number, ay: number) {
    const c = this.chz!;
    const dx = (ax - c.displayOriginX) * c.scaleX;
    const dy = (ay - c.displayOriginY) * c.scaleY;
    const a = c.rotation;
    return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
  }

  /** A chunky pixel heart (drawn 4 px to the pixel, so it stays crisp), outlined like the rest of the art. */
  private makeHeart() {
    if (this.textures.exists("dn_heart")) return;
    const px = [
      ".OO...OO.",
      "OHHO.OPPO",
      "OHPPOPPPO",
      "OPPPPPPPO",
      ".OPPPPPO.",
      "..OPPPO..",
      "...OPO...",
      "....O....",
    ];
    const C: Record<string, number> = { O: 0x4a0f24, P: 0xff4f8b, H: 0xffc4d6 };
    const k = 4;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    px.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (!C[c]) return;
        g.fillStyle(C[c], 1);
        g.fillRect(x * k, y * k, k, k);
      }),
    );
    g.generateTexture("dn_heart", 9 * k, 8 * k);
    g.destroy();
  }

  /** Little hearts pop up off him. */
  private hearts(n: number) {
    if (!this.chz) return;
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 110, () => {
        if (!this.chz) return;
        // either side of him (not over his face), from chest height up
        const side = i % 2 ? 1 : -1;
        const p = this.artPt(64 + side * (34 + Math.random() * 18), 50 + Math.random() * 55);
        const h = this.add.image(p.x, p.y, "dn_heart").setScale(0.2).setAlpha(1);
        this.fxLayer.add(h);
        const to = 0.8 + Math.random() * 0.6;
        this.tweens.add({ targets: h, scale: to, duration: 220, ease: "Back.easeOut" });
        this.tweens.add({ targets: h, y: Math.max(30, p.y - 110 - Math.random() * 70), x: p.x + side * (20 + Math.random() * 60), duration: 1500 + Math.random() * 500, ease: "Sine.easeOut" });
        this.tweens.add({ targets: h, alpha: 0, delay: 1000, duration: 700, onComplete: () => h.destroy() });
      });
    }
  }

  /** A drip of jam from the donut, down to a splat on the floor. */
  private jam() {
    if (!this.chz) return;
    const p = this.artPt(DONUT.x + 3, DONUT.y + DONUT.r - 2);
    const drop = this.add.ellipse(p.x, p.y, 10, 14, 0xb3122e).setStrokeStyle(2, 0x6b0a1b);
    this.fxLayer.add(drop);
    this.tweens.add({ targets: drop, scaleY: 1.6, duration: 500, yoyo: false, onComplete: () => {
      this.tweens.add({ targets: drop, y: 352, duration: 520, ease: "Quad.easeIn", onComplete: () => {
        drop.destroy();
        synth.play("drp_splat", 0.4, 1.4);
        const sp = this.add.ellipse(p.x, 356, 34, 8, 0xb3122e).setAlpha(0.9);
        this.fxLayer.add(sp);
        this.tweens.add({ targets: sp, alpha: 0, delay: 2600, duration: 800, onComplete: () => sp.destroy() });
      } });
    } });
  }

  /** "YEGHHH" bursts off him (the sound he makes, drawn, comic style). */
  private yeghText() {
    if (!this.chz) return;
    const p = this.artPt(DONUT.x - 30, 22);
    const t = this.add.text(p.x - 150, p.y, "YEGHHH", { fontFamily: "Impact, sans-serif", fontSize: "54px", color: "#ff7ab0", stroke: "#3b0a1e", strokeThickness: 8 }).setOrigin(0.5).setAngle(-12).setScale(0.2);
    this.fxLayer.add(t);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 1800, duration: 600, onComplete: () => t.destroy() });
  }

  private motionLines?: Phaser.Time.TimerEvent;
  /** Comic motion lines either side of his hips while he goes at it. */
  private motion(on: boolean) {
    this.motionLines?.remove();
    this.motionLines = undefined;
    if (!on || !this.chz) return;
    this.motionLines = this.time.addEvent({ delay: 240, loop: true, callback: () => {
      if (!this.chz) return;
      for (const side of [-1, 1]) {
        const p = this.artPt(DONUT.x + side * 30, DONUT.y - 6 + (Math.random() - 0.5) * 16);
        const l = this.add.rectangle(p.x + side * 16, p.y, 26, 4, 0xffffff, 0.85).setAngle(side * (8 + Math.random() * 10));
        this.fxLayer.add(l);
        this.tweens.add({ targets: l, x: l.x + side * 22, alpha: 0, duration: 260, onComplete: () => l.destroy() });
      }
    } });
  }

  private notes() {
    // little notes drift off the speaker on the shelf
    this.beatTimer = this.time.addEvent({ delay: 900, loop: true, callback: () => {
      const n = this.add.text(SPEAKER.x * K, SPEAKER.y * K, Math.random() < 0.5 ? "♪" : "♫", { fontFamily: "sans-serif", fontSize: "26px", color: "#ffe08a", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5);
      this.fxLayer.add(n);
      this.tweens.add({ targets: n, y: n.y - 70, x: n.x + (Math.random() - 0.3) * 50, alpha: 0, duration: 1800, onComplete: () => n.destroy() });
    } });
  }

  /** SanMik bursts in: the door bangs, he slides in from the left. */
  private burst() {
    synth.play("door", 1);
    this.cameras.main.shake(250, calm() ? 0.004 : 0.01);
    this.stopSway();
    this.setFace(false);
    const key = this.textures.exists("spr_SANMIK") ? "spr_SANMIK" : null;
    if (!key) return;
    // (feet behind the box, his head and shoulders well clear of it)
    const m = this.add.sprite(-160, 430, key, 0).setOrigin(0.5, 1);
    m.displayHeight = 330;
    m.scaleX = m.scaleY;
    this.fxLayer.add(m);
    this.tweens.add({ targets: m, x: 200, duration: 280, ease: "Back.easeOut" });
    const ex = this.add.text(290, 120, "!!", { fontFamily: "Impact, sans-serif", fontSize: "56px", color: "#ffd23f", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setAlpha(0);
    this.fxLayer.add(ex);
    this.tweens.add({ targets: ex, alpha: 1, y: 100, duration: 200, delay: 250 });
  }

  private finish(box: DialogueBox) {
    if (this.finished) return;
    this.finished = true;
    this.stopSway();
    this.motion(false);
    this.beatTimer?.remove();
    // back to whatever was playing in the room
    if (this.tune && synth.currentMusic() !== this.tune) synth.music(this.tune, true);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(380, () => {
      box.destroy();
      this.d.done();
    });
  }

  private cleanup() {
    this.sway?.remove();
    this.motionLines?.remove();
    this.beatTimer?.remove();
    this.chz = undefined;
  }
}

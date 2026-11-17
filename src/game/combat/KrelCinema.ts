import Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { onSkip, runOverlay } from "../gfx/Overlay";

/**
 * The Kreltality close-up: after a finisher plays out on the battle sprites, a hard cut to a drawn, animated anime
 * close-up of the kill (1.5–3s), then back to the room for the KRELTALITY banner. The frames are a sheet,
 * `kc_<finisher>` (a still and its motion, 256x144 frames; the first few are the wind-up, the rest the impact).
 *
 * Gore on: the full thing, on a blood-red burst, with drops flying. Gore off: the wind-up only, as a black
 * silhouette on a gold burst, then a comic POW and the tame name: nothing comes off. calmFlash: no white impact
 * frames (a dim one, slowly), steady lines. Any key, click or pad button skips it.
 */

/** Which drawn close-up each finisher uses (some share one). */
const ART: Record<string, string> = {
  spine: "kc_spine",
  explode: "kc_explode",
  halved: "kc_halved",
  headboot: "kc_headboot",
  slit: "kc_slit",
  flatten: "kc_flatten",
  vice: "kc_vice",
  bellybomb: "kc_bellybomb",
  jawtrap: "kc_jawtrap",
  pendulum: "kc_pendulum",
  ribcage: "kc_ribcage",
  freeze: "kc_freeze",
  kebab: "kc_kebab",
  lasergrid: "kc_lasergrid",
  xray: "kc_xray",
  decap: "kc_decap",
  pump: "kc_pump",
  cinder: "kc_cinder",
  piranha: "kc_piranha",
  asbestos: "kc_asbestos",
  stanley: "kc_stanley",
};
/** How many frames at the start of a sheet are the wind-up (all that's shown, silhouetted, with gore off). */
const WINDUP: Record<string, number> = { decap: 4, stanley: 4, explode: 6, slit: 3, spine: 5, halved: 5, headboot: 4, flatten: 3, vice: 5, bellybomb: 4, jawtrap: 5, pendulum: 3, freeze: 4, ribcage: 4, kebab: 3, xray: 3, pump: 7, cinder: 4, asbestos: 3, lasergrid: 2, piranha: 4 };
const DEFAULT_WINDUP = 3;

export interface KrelCineOpts {
  /** the finisher (Kreltality.ts's Finisher, or "stanley" for Captain Stanley's throat) */
  which: string;
  /** what it's called on the night (the gory or the tame name) */
  title: string;
  /** whose it was */
  victim?: string;
}

/** Cut to the close-up, wait for it, cut back. */
export function krelCinema(sc: Phaser.Scene, o: KrelCineOpts): Promise<void> {
  const key = ART[o.which] ?? `kc_${o.which}`;
  return runOverlay(sc, "KrelCine", KrelCineScene, {
    key,
    title: o.title,
    victim: o.victim ?? "",
    windup: WINDUP[o.which] ?? DEFAULT_WINDUP,
    player: G.hasRun() ? G.s.player : "FLENKY",
  });
}

interface CineData {
  key: string;
  title: string;
  victim: string;
  windup: number;
  player: string;
  done: () => void;
}

const W = 960;
const H = 540;

export class KrelCineScene extends Phaser.Scene {
  private d!: CineData;
  private ending = false;
  private offSkip: (() => void) | null = null;
  private timers: number[] = [];

  constructor() {
    super("KrelCine");
  }

  init(d: CineData) {
    this.d = d;
    this.ending = false;
    this.timers = [];
  }

  create() {
    const d = this.d;
    const gore = G.meta?.settings?.gore !== false;
    const calm = !!G.meta?.settings?.calmFlash;
    const shakeOn = G.meta?.settings?.shake !== false;
    const later = (ms: number, fn: () => void) => this.timers.push(window.setTimeout(() => this.sys.isActive() && !this.ending && fn(), ms));
    const intervals: number[] = [];
    this.events.once("shutdown", () => {
      this.timers.forEach((t) => window.clearTimeout(t));
      intervals.forEach((t) => window.clearInterval(t));
      this.offSkip?.();
    });
    const shake = (ms: number, k: number) => shakeOn && this.cameras.main.shake(ms, calm ? k * 0.4 : k);
    const flash = (col: number, a: number, ms = 180) => {
      const r = this.add.rectangle(W / 2, H / 2, W, H, col, calm ? a * 0.2 : a).setDepth(50);
      this.tweens.add({ targets: r, alpha: 0, duration: calm ? Math.max(ms, 420) : ms, onComplete: () => r.destroy() });
    };

    // ---- the black: the cut
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1);

    // ---- beat 1: your lad's eyes, a strip across the middle (his VS portrait), as the blow lands
    const pk = `vs_${d.player}`;
    let t0 = 0;
    if (this.textures.exists(pk)) {
      const img = this.add.image(W / 2, H / 2, pk, 0);
      const fr = img.frame;
      const k = Math.max(2, Math.round((W * 0.85) / fr.realWidth));
      img.setScale(k);
      // the eye line sits a bit above the middle of a bust portrait
      const y0 = Math.round(fr.realHeight * 0.3);
      const hh = Math.round(fr.realHeight * 0.18);
      img.setCrop(0, y0, fr.realWidth, hh);
      img.setY(H / 2 - (y0 + hh / 2 - fr.realHeight / 2) * k);
      if (gore) img.setTint(0xffd0d0);
      const edge = [-1, 1].map((s) => this.add.rectangle(W / 2, H / 2 + (s * hh * k) / 2, W, 3, gore ? 0xdc2626 : 0xfde047));
      const strip = [img, ...edge];
      for (const o of strip) o.x -= 120;
      this.tweens.add({ targets: strip, x: "+=120", duration: 420, ease: "Cubic.out" });
      synth.play("krel_cine");
      t0 = 440;
      later(t0, () => strip.forEach((o) => o.destroy()));
    } else synth.play("krel_cine");

    // ---- beat 2: the close-up
    later(t0, () => this.closeUp(gore, calm, flash, shake, intervals));
    later(t0 + 2050, () => this.finish());
    this.offSkip = onSkip(this, 200, () => this.finish());
  }

  private closeUp(gore: boolean, calm: boolean, flash: (c: number, a: number, ms?: number) => void, shake: (ms: number, k: number) => void, intervals: number[]) {
    const d = this.d;
    const bgCol = gore ? 0x7f1d1d : 0xfacc15;
    const lineCol = gore ? 0x000000 : 0xffffff;
    // a radial burst behind it
    const burst = this.add.graphics();
    const drawBurst = (spin: number) => {
      burst.clear();
      burst.fillStyle(gore ? 0x1a0000 : 0xfff7cc, 1).fillRect(0, 0, W, H);
      burst.fillStyle(bgCol, 1);
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + spin;
        const a1 = a0 + Math.PI / n;
        burst.fillTriangle(W / 2, H / 2, W / 2 + Math.cos(a0) * 900, H / 2 + Math.sin(a0) * 900, W / 2 + Math.cos(a1) * 900, H / 2 + Math.sin(a1) * 900);
      }
    };
    drawBurst(0);
    const t0 = performance.now();
    intervals.push(window.setInterval(() => burst.active && drawBurst(((performance.now() - t0) / 1000) * (calm ? 0.05 : 0.25)), 50));
    // speed lines converging on the middle
    const lines = this.add.graphics();
    const drawLines = () => {
      lines.clear();
      for (let i = 0; i < (calm ? 14 : 34); i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 240 + Math.random() * 120;
        lines.lineStyle(1 + Math.random() * 3, lineCol, 0.25 + Math.random() * 0.4).lineBetween(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0, W / 2 + Math.cos(a) * 700, H / 2 + Math.sin(a) * 700);
      }
    };
    drawLines();
    intervals.push(window.setInterval(drawLines, calm ? 400 : 70));

    // the drawn close-up (or nothing drawn: just the burst and the name)
    const have = this.textures.exists(d.key);
    let shot: Phaser.GameObjects.Image | null = null;
    const n = have ? Math.max(1, this.textures.get(d.key).frameTotal - 1) : 0;
    if (have) {
      shot = this.add.image(W / 2, H / 2, d.key, 0);
      const fr = shot.frame;
      const k = Math.max(1, Math.floor(Math.min((W * 0.98) / fr.realWidth, (H * 0.86) / fr.realHeight)));
      shot.setScale(k);
      if (!gore) shot.setTintFill(0x000000);
      this.tweens.add({ targets: shot, scale: k * 1.07, duration: 1900, ease: "Sine.out" });
    }
    // cinematic bars
    this.add.rectangle(W / 2, 22, W, 44, 0x000000);
    this.add.rectangle(W / 2, H - 22, W, 44, 0x000000);

    // play it: gore on, the whole motion then hold; gore off, the wind-up, then the cartoon POW
    const last = gore ? n - 1 : Math.min(n - 1, d.windup - 1);
    const stepMs = 95;
    let f = 0;
    if (shot && last > 0) {
      const s = shot;
      const id = window.setInterval(() => {
        if (!s.active) return window.clearInterval(id);
        f++;
        if (f > last) {
          window.clearInterval(id);
          return;
        }
        s.setFrame(f);
        if (gore && f === d.windup) {
          // the impact
          synth.play("crit");
          synth.play("blood_spray", 0.8);
          flash(0xffffff, 0.55, 140);
          shake(380, 0.02);
          this.drops();
        }
      }, stepMs);
      intervals.push(id);
    }
    const impactAt = gore ? Math.max(1, d.windup) * stepMs : Math.max(1, last + 1) * stepMs + 60;
    if (!gore) {
      this.time.delayedCall(impactAt, () => {
        // the cartoon version: a white-out POW, stars, the tame name
        synth.play("trombone", 0.6);
        synth.play("punch_big");
        flash(0xffffff, 0.7, 220);
        shake(260, 0.012);
        this.pow();
      });
    } else if (!shot || last <= 0) {
      this.time.delayedCall(impactAt, () => {
        synth.play("crit");
        flash(0xffffff, 0.55, 140);
        shake(380, 0.02);
        this.drops();
      });
    }

    // the finisher's name, low and slanted, slammed in on the impact
    this.time.delayedCall(impactAt + 80, () => {
      const t = this.add.text(W / 2, H - 92, d.title, { fontFamily: "Impact, sans-serif", fontSize: "54px", color: gore ? "#ef4444" : "#1f2937", stroke: gore ? "#000000" : "#ffffff", strokeThickness: 9 }).setOrigin(0.5).setAngle(-3).setDepth(40);
      if (t.width > 860) t.setScale(860 / t.width);
      const rest = t.scaleX;
      t.setScale(rest * 2.4).setAlpha(0);
      this.tweens.add({ targets: t, scale: rest, alpha: 1, duration: 150, ease: "Quad.in" });
      if (d.victim) {
        const v = this.add.text(W - 40, 62, d.victim, { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setOrigin(1, 0.5).setDepth(40).setAlpha(0);
        this.tweens.add({ targets: v, alpha: 0.9, duration: 300 });
      }
    });
  }

  /** Gore: drops of blood flung out of the middle of the shot and running down the screen. */
  private drops() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 300 + Math.random() * 600;
      const r = this.add.rectangle(W / 2 + (Math.random() - 0.5) * 120, H / 2 + (Math.random() - 0.5) * 80, 6 + Math.random() * 10, 6 + Math.random() * 10, Math.random() < 0.7 ? 0xb91c1c : 0x7f1d1d).setDepth(30);
      this.tweens.add({ targets: r, x: r.x + Math.cos(a) * sp, y: r.y + Math.sin(a) * sp * 0.6 + 200, angle: Math.random() * 360, duration: 600 + Math.random() * 400, ease: "Quad.out" });
    }
    // a few big splats that stick to the "lens" and slide down
    for (let i = 0; i < 5; i++) {
      const x = 80 + Math.random() * (W - 160);
      const y = 70 + Math.random() * 200;
      const s = this.add.ellipse(x, y, 30 + Math.random() * 50, 26 + Math.random() * 40, 0x991b1b, 0.85).setDepth(31);
      this.tweens.add({ targets: s, y: y + 60 + Math.random() * 80, scaleY: 1.8, duration: 1600, delay: 200, ease: "Sine.in" });
    }
  }

  /** Gore off: a comic POW burst and little stars. */
  private pow() {
    const g = this.add.graphics().setDepth(30);
    const pts: Phaser.Math.Vector2[] = [];
    const n = 14;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? 90 : 170;
      pts.push(new Phaser.Math.Vector2(W / 2 + Math.cos(a) * r * 1.3, H / 2 - 20 + Math.sin(a) * r));
    }
    g.fillStyle(0xffffff, 1).fillPoints(pts, true);
    g.lineStyle(6, 0x000000, 1).strokePoints(pts, true, true);
    const pow = this.add.text(W / 2, H / 2 - 20, "POW!", { fontFamily: "Impact, sans-serif", fontSize: "88px", color: "#ef4444", stroke: "#000", strokeThickness: 10 }).setOrigin(0.5).setAngle(-8).setDepth(31);
    g.setScale(0.2);
    g.setPosition((W / 2) * 0.8, (H / 2 - 20) * 0.8);
    this.tweens.add({ targets: g, scale: 1, x: 0, y: 0, duration: 160, ease: "Back.out" });
    pow.setScale(0.2);
    this.tweens.add({ targets: pow, scale: 1, duration: 180, ease: "Back.out" });
    for (let i = 0; i < 6; i++) {
      const s = this.add.text(W / 2, H / 2 - 20, "★", { fontFamily: "Arial", fontSize: "34px", color: "#fde047", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(32);
      const a = (i / 6) * Math.PI * 2;
      this.tweens.add({ targets: s, x: W / 2 + Math.cos(a) * 260, y: H / 2 - 20 + Math.sin(a) * 170, angle: 360, duration: 700, ease: "Cubic.out" });
    }
  }

  /** Cut back to the room. */
  private finish() {
    if (this.ending) return;
    this.ending = true;
    this.offSkip?.();
    this.offSkip = null;
    const calm = !!G.meta?.settings?.calmFlash;
    // a hard cut (to black for a frame or two) rather than a fade: it's an edit
    const blk = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, calm ? 0 : 1).setDepth(100);
    if (calm) this.tweens.add({ targets: blk, alpha: 1, duration: 160 });
    window.setTimeout(() => this.d.done(), calm ? 170 : 70);
  }
}

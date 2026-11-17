import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { FONT } from "../ui/theme";
import { hasVfx, vfx } from "../gfx/Vfx";
import { G } from "../G";
import { ELEGANT, ELEGANT_NAMES, BOSS_ONLY, TAME_NAMES, runElegant, type Elegant, type KrelCtx } from "./KrelFinishers";
import { krelCinema } from "./KrelCinema";
import { Actor, Victim, bit, prop, MEATY, type Bit } from "./KrelArt";

/**
 * KRELTALITY. After a boss goes down: "FUCKING KILL THEM!!" — press it (or don't) for an over-the-top,
 * cartoonish finishing move. Everything here is deliberately silly: rubbery, sausagey, splattery.
 */

export interface KrelTarget {
  key: string;
  frame: string | number;
  x: number;
  y: number;
  /** the scale to give an image of this texture */
  scale: number;
  flip: boolean;
  name: string;
  /** the boss's id (BOSS_TEXT key), when it's a boss: finishers with per-boss art look for it */
  id?: string;
}

export type Finisher = "spine" | "explode" | "halved" | "headboot" | "slit" | "flatten" | "vice" | "bellybomb" | Elegant;
const CLASSIC: Finisher[] = ["spine", "explode", "halved", "headboot", "slit", "flatten", "vice"];
/** The random pool: the old ones and the choreographed ones (KrelFinishers.ts). */
export const FINISHERS: Finisher[] = [...CLASSIC, ...ELEGANT];
const NAMES: Record<Finisher, string> = {
  ...ELEGANT_NAMES,
  spine: "SPINE RIP!",
  explode: "KREZZPLOSION!",
  halved: "HALVED!",
  headboot: "HEAD BOOT!",
  slit: "THROAT SLIT!",
  flatten: "FLATTENED!",
  vice: "VICE-D!",
  bellybomb: "BELLY BOMB!",
};

const D = 2000; // above everything in the room

/** Ask. Resolves true if they said yes (and the finisher has played). */
export async function kreltality(sc: Phaser.Scene, target: KrelTarget, player: { key: string; frame: string | number; scale: number }, force?: Finisher): Promise<boolean> {
  const yes = await prompt(sc);
  if (!yes) return false;
  await stage(sc, target, player, force ?? pick(target));
  return true;
}

/** A random finisher, not the last one you saw; with gore off, only the ones that have a tame version. */
let lastPick: Finisher | null = null;
function pick(target?: KrelTarget): Finisher {
  const gore = G.meta?.settings?.gore !== false;
  // the long boss-only ones (GET WELL SOON) need a boss and the gore on
  const boss = !!target?.id;
  const pool = (gore ? FINISHERS : [...ELEGANT])
    .filter((f) => f !== lastPick)
    .filter((f) => !(BOSS_ONLY as Finisher[]).includes(f) || (boss && gore));
  lastPick = pool[Math.floor(Math.random() * pool.length)];
  return lastPick;
}

/** No asking: it just happens (story Kreltalities, like Uncle Rik's). */
export async function forcedKreltality(sc: Phaser.Scene, target: KrelTarget, player: { key: string; frame: string | number; scale: number }, which: Finisher): Promise<void> {
  await stage(sc, target, player, which);
}

// ------------------------------------------------------------------ the prompt

function prompt(sc: Phaser.Scene): Promise<boolean> {
  return new Promise((resolve) => {
    const cam = sc.cameras.main;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const pin = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as unknown as { setScrollFactor: (x: number, y?: number) => void }).setScrollFactor(0, 0);
      objs.push(o);
      return o;
    };
    const k = 1 / cam.zoom;
    const cx = 480;
    const cy = 270;
    const dim = pin(sc.add.rectangle(cx, cy, 4000, 4000, 0x2a0000, 0.55).setDepth(D + 50).setInteractive());
    const t = pin(sc.add.text(cx, cy - 90 * k, "FUCKING KILL THEM!!", { fontFamily: "Impact, sans-serif", fontSize: "54px", color: "#ef4444", stroke: "#000", strokeThickness: 9 }).setOrigin(0.5).setDepth(D + 51).setScale(k));
    synth.play("roar");
    sc.tweens.add({ targets: t, x: { from: cx - 4 * k, to: cx + 4 * k }, yoyo: true, repeat: -1, duration: 50 });
    const mk = (x: number, label: string, bg: string, fn: () => void) => {
      const b = pin(sc.add.text(cx + x * k, cy + 10 * k, label, { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#ffffff", backgroundColor: bg, padding: { x: 18, y: 10 } }).setOrigin(0.5).setDepth(D + 52).setScale(k).setInteractive({ useHandCursor: true }));
      b.on("pointerdown", fn);
      return b;
    };
    const yesB = mk(-140, "☠ KRELTALITY (K)", "#991b1b", () => done(true));
    mk(150, "spare them (ESC)", "#1f2937", () => done(false));
    sc.tweens.add({ targets: yesB, scale: { from: k, to: k * 1.08 }, yoyo: true, repeat: -1, duration: 300 });
    const bar = pin(sc.add.rectangle(cx - 200 * k, cy + 70 * k, 400 * k, 6 * k, 0xef4444).setOrigin(0, 0.5).setDepth(D + 52));
    sc.tweens.add({ targets: bar, scaleX: 0, duration: 7000, onComplete: () => done(false) });
    const kb = sc.input.keyboard;
    const onK = () => done(true);
    const onEsc = () => done(false);
    kb?.on("keydown-K", onK);
    kb?.on("keydown-ESC", onEsc);
    let fin = false;
    function done(v: boolean) {
      if (fin) return;
      fin = true;
      kb?.off("keydown-K", onK);
      kb?.off("keydown-ESC", onEsc);
      for (const o of objs) {
        sc.tweens.killTweensOf(o);
        o.destroy();
      }
      if (!v) synth.play("select");
      resolve(v);
    }
    void dim;
  });
}

// ------------------------------------------------------------------ the show

async function stage(sc: Phaser.Scene, tg: KrelTarget, pl: { key: string; frame: string | number; scale: number }, which: Finisher) {
  const cam = sc.cameras.main;
  const wait = (ms: number) => new Promise<void>((r) => sc.time.delayedCall(ms, () => r()));
  const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => new Promise<void>((r) => sc.tweens.add({ ...cfg, onComplete: () => r() }));
  const junk: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    junk.push(o);
    return o;
  };
  /** keep() for drawn art that may not be loaded */
  const kp = <T extends Phaser.GameObjects.GameObject>(o: T | null): T | null => (o ? keep(o) : null);
  // the arena goes dark and red; lightning
  const sky = keep(sc.add.rectangle(tg.x, tg.y, 6000, 6000, 0x1a0000, 0).setDepth(D));
  sc.tweens.add({ targets: sky, fillAlpha: 0.9, duration: 400 });
  cam.stopFollow();
  cam.pan(tg.x, tg.y - 20, 500, "Sine.easeInOut");
  cam.zoomTo(1.6, 500);
  synth.play("boom");
  const gore = G.meta?.settings?.gore !== false;
  const calm = !!G.meta?.settings?.calmFlash;
  const flash = () => {
    if (!calm) cam.flash(120, 255, 230, 230);
    synth.play("crit");
  };
  // the victim, dazed, swaying
  const body = keep(sc.add.image(tg.x, tg.y, tg.key, tg.frame).setScale(tg.scale).setFlipX(tg.flip).setDepth(D + 2));
  const fw = body.frame.width;
  const fh = body.frame.height;
  // the real drawn size (HD art is drawn at a fraction of the scale it's given)
  const H = body.displayHeight;
  const W = body.displayWidth;
  const floor = tg.y + H * 0.45;
  sc.tweens.add({ targets: body, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
  // their drawn reactions (krelvic_<name>), when they have them: terror as you come over, grabbed, the impact
  const vic = new Victim(sc, body, tg.key, keep);
  // you, walking over
  const me = keep(sc.add.sprite(tg.x - W * 0.5 - 120, floor - 30, pl.key, pl.frame).setScale(pl.scale).setDepth(D + 3).setFlipX(false));
  // he's drawn: his own walk over, then his finisher actions off his krelact_ sheet (KrelArt.ts)
  const act = new Actor(sc, me).idle(1);
  await wait(500);
  act.walk();
  // they see you coming
  sc.time.delayedCall(200, () => vic.react("terror", { loop: true }));
  await tw({ targets: me, x: tg.x - W * 0.5 - 30, duration: 450, ease: "Quad.out" });
  act.idle();
  sc.tweens.killTweensOf(body);
  body.setAngle(0);
  await wait(200);

  // ---- helpers: blood, guts, bones. Drawn effects (PixelLab VFX) when they're loaded; little shapes if not.
  const drawn = hasVfx(sc, "vfx_blood");
  const fx = (key: string, x: number, y: number, scale: number, extra: Parameters<typeof vfx>[4] = {}) => {
    const s = vfx(sc, key, x, y, { depth: D + 6, scale, ...extra });
    if (s) junk.push(s);
    return s;
  };
  let pools = 0;
  // the soundtrack of it: sprays and splats on the blood, a scream on the first big hit, a gurgle as they go
  let lastSpray = 0;
  let screamed = false;
  let gurgled = false;
  const spraySound = (n: number) => {
    if (sc.time.now - lastSpray < 320) return;
    lastSpray = sc.time.now;
    synth.play(n >= 18 ? "blood_spray" : Math.random() < 0.5 ? "splat" : "squelch");
  };
  const scream = () => {
    if (screamed) return;
    screamed = true;
    const k = tg.key.toLowerCase();
    const woman = /woman|girl|mum|flirt|jam|eden|madison|destiny|crystal|sue|peg|shez|mollor|karen|jenny/.test(k + " " + (tg.name ?? "").toLowerCase());
    synth.play(woman ? "scream_woman" : Math.random() < 0.5 ? "scream_man" : "shriek");
  };
  const gurgle = (delay = 0) => {
    if (gurgled || !gore) return;
    gurgled = true;
    sc.time.delayedCall(delay, () => synth.play("gurgle"));
  };
  const blood = (x: number, y: number, n: number, power = 1, up = false) => {
    if (n >= 30) scream();
    if (gore) spraySound(n);
    if (n >= 40) gurgle(900);
    if (!gore) {
      // gore off: a puff of dust, never blood
      if (!fx("vfx_dust", x, y, Math.min(1.8, 0.6 + n / 80))) {
        const c = keep(sc.add.circle(x, y, 6, 0xd1d5db, 0.8).setDepth(D + 6));
        sc.tweens.add({ targets: c, radius: 14 + n / 6, alpha: 0, duration: 500 });
      }
      return;
    }
    if (drawn) {
      const k = Math.min(2.2, 0.7 + n / 50) * Math.max(0.8, power * 0.8);
      fx(up && hasVfx(sc, "vfx_bloodspray") ? "vfx_bloodspray" : "vfx_blood", x, y, k, { flipX: Math.random() < 0.5 });
      if (n >= 20) fx("vfx_blood", x + (Math.random() - 0.5) * 40, y - 10, k * 0.7, { delay: 120, flipX: true });
      // a pool where it lands (only a few per finisher)
      if (pools < 3 && hasVfx(sc, "vfx_bloodpool")) {
        pools++;
        fx("vfx_bloodpool", x + (Math.random() - 0.5) * 30, floor + 4, Math.min(2, 0.8 + n / 60), { hold: true, depth: D + 1, delay: 200 });
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const sz = 2 + Math.random() * 5;
      const r = keep(sc.add.rectangle(x, y, sz, sz, Math.random() < 0.7 ? 0xdc2626 : 0x7f1d1d).setDepth(D + 6));
      let vx = (Math.random() - 0.5) * 10 * power;
      let vy = up ? -(5 + Math.random() * 10) * power : (Math.random() - 0.7) * 9 * power;
      const ev = sc.time.addEvent({ delay: 16, loop: true, callback: () => {
        vy += 0.5;
        r.x += vx;
        r.y += vy;
        vx *= 0.99;
        if (r.y >= floor) {
          ev.remove();
          keep(sc.add.ellipse(r.x, floor + Math.random() * 6, 6 + Math.random() * 16, 3 + Math.random() * 3, 0xb91c1c, 0.95).setDepth(D + 1));
          r.destroy();
        }
      } });
      sc.time.delayedCall(4000, () => ev.remove());
    }
  };
  const fountain = (x: number, y: number, ms: number) => {
    scream();
    if (gore) {
      synth.play("blood_spray");
      const hiss = sc.time.addEvent({ delay: 700, repeat: Math.max(0, Math.floor(ms / 700) - 1), callback: () => synth.play("blood_spray", 0.7) });
      sc.time.delayedCall(ms, () => hiss.remove());
      gurgle(Math.min(ms, 1200));
    }
    if (!gore) {
      fx("vfx_stars", x, y, 1, { depth: D + 7 });
      return;
    }
    if (drawn) {
      const ev = sc.time.addEvent({ delay: 420, loop: true, callback: () => fx(hasVfx(sc, "vfx_bloodspray") ? "vfx_bloodspray" : "vfx_blood", x + (Math.random() - 0.5) * 8, y, 1.1 + Math.random() * 0.4) });
      fx(hasVfx(sc, "vfx_bloodspray") ? "vfx_bloodspray" : "vfx_blood", x, y, 1.3);
      sc.time.delayedCall(ms, () => ev.remove());
      return;
    }
    const ev = sc.time.addEvent({ delay: 45, loop: true, callback: () => blood(x, y, 4, 0.9, true) });
    sc.time.delayedCall(ms, () => ev.remove());
  };
  /** A rope of sausagey guts flung from (x,y) towards angle a. */
  let lastSquelch = 0;
  const guts = (x: number, y: number, a: number, len = 120) => {
    if (sc.time.now - lastSquelch > 250) {
      lastSquelch = sc.time.now;
      synth.play("squelch");
      if (gore) synth.play("flesh_rip", 0.8);
    }
    if (!gore) {
      fx("vfx_dust", x + Math.cos(a) * len * 0.5, Math.min(floor, y + Math.sin(a) * len * 0.5), 0.8);
      return;
    }
    if (hasVfx(sc, "vfx_gore")) {
      // meaty chunks flung out along the angle, a splat where they land
      fx("vfx_gore", x + Math.cos(a) * len * 0.35, Math.min(floor, y + Math.sin(a) * len * 0.35), 0.9 + len / 200, { flipX: Math.cos(a) < 0, delay: Math.random() * 120 });
      fx("vfx_blood", x + Math.cos(a) * len * 0.8, Math.min(floor, y + Math.sin(a) * len * 0.8 + 20), 0.8, { delay: 160 + Math.random() * 120 });
      return;
    }
    const n = 11;
    for (let i = 0; i < n; i++) {
      const c = keep(sc.add.circle(x, y, 7 - i * 0.25, i % 2 ? 0xf472b6 : 0xbe185d).setStrokeStyle(1.5, 0x831843).setDepth(D + 5));
      const d = (len * (i + 1)) / n;
      const sag = Math.sin((i / n) * Math.PI) * 30;
      sc.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: Math.min(floor, y + Math.sin(a) * d + sag), duration: 380 + i * 30, ease: "Quad.out", delay: i * 18 });
    }
  };
  /** A spinal column hanging off a head. */
  const spine = (head: Phaser.GameObjects.Image) => {
    synth.play("bonecrack");
    // the drawn spinal column (PixelLab), dangling and swinging off the bottom of the head
    const col = prop(sc, "kp_spine", head.x, head.y, { h: H * 0.5, oy: 0, depth: D + 4 });
    if (col) {
      keep(col);
      // (the head is the whole sprite cropped to its top: its neck is a little above the image's centre, turning with it)
      const neck = () => {
        const a = Phaser.Math.DegToRad(head.angle);
        const oy = -H * 0.5 + H * 0.3;
        return { x: head.x - Math.sin(a) * oy, y: head.y + Math.cos(a) * oy };
      };
      const ev = sc.time.addEvent({ delay: 16, loop: true, callback: () => {
        const n = neck();
        col.setPosition(n.x, n.y).setAngle(Math.sin(sc.time.now / 140) * 8);
      } });
      sc.time.delayedCall(5000, () => ev.remove());
      return;
    }
    // vertebrae: a little drawn bone each (body, side wings, a knob), with red gristle between
    const bones: Phaser.GameObjects.GameObject[] = [];
    const vert = (w: number) => {
      const c = sc.add.container(head.x, head.y).setDepth(D + 4);
      c.add(sc.add.ellipse(0, 3, w + 6, 4, 0x9f1239, 0.9)); // gristle
      c.add(sc.add.rectangle(-w / 2 - 3, 0, 6, 3, 0xe7dcc4).setStrokeStyle(1, 0x6b5a45)); // wings
      c.add(sc.add.rectangle(w / 2 + 3, 0, 6, 3, 0xe7dcc4).setStrokeStyle(1, 0x6b5a45));
      c.add(sc.add.ellipse(0, 0, w, 6, 0xf5ecd7).setStrokeStyle(1.2, 0x6b5a45));
      c.add(sc.add.ellipse(-w * 0.15, -1, w * 0.4, 2, 0xffffff, 0.8)); // shine
      return keep(c);
    };
    for (let i = 0; i < 9; i++) bones.push(vert(12 - i * 0.6));
    const ev = sc.time.addEvent({ delay: 16, loop: true, callback: () => {
      bones.forEach((b, i) => (b as Phaser.GameObjects.Container).setPosition(head.x + Math.sin(sc.time.now / 120 + i * 0.5) * (i * 0.6), head.y + H * 0.14 + i * 6.5));
    } });
    sc.time.delayedCall(5000, () => ev.remove());
  };
  /** Bones: little white dog-bone shapes flung about. */
  const bones = (x: number, y: number, n: number) => {
    if (!gore) return;
    synth.play("bonecrack");
    const kinds: Bit[] = ["bone", "bonebroken", "shards", "vertebra", "bone", "tooth"];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const d = 80 + Math.random() * 200;
      // drawn bones (the kp_bits sheet); little dog-bone shapes if it isn't loaded
      const b = bit(sc, kinds[i % kinds.length], x, y, 12 + Math.random() * 8, D + 5);
      if (b) {
        keep(b);
        sc.tweens.add({ targets: b, x: x + Math.cos(a) * d, y: floor - 4 - Math.random() * 6, angle: (Math.random() - 0.5) * 1080, duration: 700 + Math.random() * 400, ease: "Quad.out" });
        continue;
      }
      const c = keep(sc.add.container(x, y).setDepth(D + 5));
      const len = 10 + Math.random() * 16;
      c.add([sc.add.rectangle(0, 0, len, 4, 0xf5ecd7), sc.add.circle(-len / 2, -2, 3, 0xf5ecd7), sc.add.circle(-len / 2, 2, 3, 0xf5ecd7), sc.add.circle(len / 2, -2, 3, 0xf5ecd7), sc.add.circle(len / 2, 2, 3, 0xf5ecd7)]);
      sc.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: floor - Math.random() * 6, angle: (Math.random() - 0.5) * 1080, duration: 700 + Math.random() * 400, ease: "Quad.out" });
    }
  };
  /** Drawn organs and offcuts (the kp_bits sheet) flung out from (x, y), left lying on the floor. Gore only. */
  const organs = (x: number, y: number, n: number, kinds: Bit[] = MEATY, spread = 1) => {
    if (!gore) return;
    for (let i = 0; i < n; i++) {
      const b = bit(sc, kinds[(i + Math.floor(Math.random() * kinds.length)) % kinds.length], x, y, 13 + Math.random() * 7, D + 5);
      if (!b) return;
      keep(b);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.8;
      const d = (90 + Math.random() * 220) * spread;
      sc.tweens.add({ targets: b, x: x + Math.cos(a) * d, y: floor - 3 - Math.random() * 8, angle: (Math.random() - 0.5) * 900, duration: 750 + Math.random() * 400, ease: "Quad.out" });
    }
  };
  const cropTop = (frac: number) => {
    vic.release();
    const t = keep(sc.add.image(body.x, body.y, tg.key, tg.frame).setScale(tg.scale).setFlipX(tg.flip).setDepth(D + 3).setCrop(0, 0, fw, fh * frac));
    body.setCrop(0, fh * frac, fw, fh * (1 - frac));
    return t;
  };
  const neckY = tg.y - H * 0.5 + H * 0.3;
  const label = (t: string) => {
    const x = keep(sc.add.text(tg.x, tg.y - H * 0.7, t, { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#fde047", stroke: "#000", strokeThickness: 7 }).setOrigin(0.5).setDepth(D + 10).setScale(0.3 / cam.zoom));
    sc.tweens.add({ targets: x, scale: 1 / cam.zoom, duration: 250, ease: "Back.out" });
    return x;
  };

  // ---- slow motion (scene clock, tweens and drawn effects together), with letterbox bars while it's slowed
  const base = { t: sc.time.timeScale, tw: sc.tweens.timeScale, an: sc.anims.globalTimeScale };
  let bars: Phaser.GameObjects.Rectangle[] | null = null;
  const slow = (k: number) => {
    sc.time.timeScale = base.t * k;
    sc.tweens.timeScale = base.tw * k;
    sc.anims.globalTimeScale = base.an * k;
    if (k < 1 && !bars) {
      const kz = 1 / cam.zoom;
      bars = [-1, 1].map((s) => {
        const b = keep(sc.add.rectangle(480, 270 + s * 330 * kz, 1200 * kz, 120 * kz, 0x000000, 1).setScrollFactor(0).setDepth(D + 45));
        sc.tweens.add({ targets: b, y: 270 + s * 270 * kz, duration: 60 });
        return b;
      });
    } else if (k >= 1 && bars) {
      const kz = 1 / cam.zoom;
      bars.forEach((b, i) => sc.tweens.add({ targets: b, y: 270 + (i ? 1 : -1) * 340 * kz, duration: 250, onComplete: () => b.destroy() }));
      bars = null;
    }
  };

  // ---- the finishers
  if ((ELEGANT as Finisher[]).includes(which)) {
    // the opaque part of the frame (sprites have empty margins round them)
    const fig = { u0: 0, v0: 0, u1: 1, v1: 1 };
    try {
      let x0 = fw;
      let y0 = fh;
      let x1 = -1;
      let y1 = -1;
      const st = Math.max(1, Math.round(Math.max(fw, fh) / 80));
      for (let y = 0; y < fh; y += st)
        for (let x = 0; x < fw; x += st) {
          if ((sc.textures.getPixelAlpha(x, y, tg.key, tg.frame) ?? 0) < 60) continue;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      if (x1 > x0 && y1 > y0) Object.assign(fig, { u0: x0 / fw, v0: y0 / fh, u1: Math.min(fw, x1 + st) / fw, v1: Math.min(fh, y1 + st) / fh });
    } catch {
      /* keep the whole frame */
    }
    const ctx: KrelCtx = { sc, cam, tg, body, me, act, vic, organs, ps: pl.scale, W, H, fw, fh, floor, fig, D, gore, calm, wait, tw, keep, fx: (k, x, y, s, e) => fx(k, x, y, s, e), blood, fountain, guts, bones, flash, slow };
    try {
      await runElegant(ctx, which as Elegant);
    } finally {
      slow(1);
    }
  }
  switch (which) {
    case "spine": {
      // his hand goes in at the neck… and comes out with the lot
      void act.play("rip", { frames: [0, 4], hold: true });
      await tw({ targets: me, x: tg.x - W * 0.45, duration: 280 });
      flash();
      synth.play("punch_big");
      void act.play("rip", { frames: [5, 8], hold: true, fps: 10 });
      const head = cropTop(0.32);
      spine(head);
      synth.play("splat");
      label(NAMES.spine);
      sc.tweens.add({ targets: head, y: head.y - 70, x: me.x + 10, angle: -15, duration: 420, ease: "Back.out" });
      sc.tweens.add({ targets: me, y: me.y - 16, duration: 420, ease: "Back.out" });
      fountain(tg.x, neckY, 1800);
      await wait(500);
      sc.tweens.add({ targets: body, angle: tg.flip ? -90 : 90, y: floor - W * 0.2, duration: 700, ease: "Quad.in" });
      guts(tg.x, neckY, -0.4, 90);
      await wait(1500);
      break;
    }
    case "explode": {
      // he's swallowed something. You've got the remote.
      void act.play("det", { hold: true });
      synth.play("tap");
      synth.voice("grunt", 0.7, 0.8);
      body.setTint(0xff9999);
      sc.tweens.add({ targets: body, x: { from: tg.x - 3, to: tg.x + 3 }, yoyo: true, repeat: 20, duration: 40 });
      await tw({ targets: body, scaleX: tg.scale * 1.7, scaleY: tg.scale * 1.5, duration: 1200, ease: "Quad.in" });
      flash();
      synth.play("explode");
      fx("vfx_bigboom", tg.x, tg.y + H * 0.15, 1.5 * Math.max(1, W / 90), { depth: D + 7 });
      synth.play("boom");
      cam.shake(500, 0.03);
      body.setVisible(false);
      for (let cx = 0; cx < 3; cx++)
        for (let cy = 0; cy < 3; cy++) {
          const ch = keep(sc.add.image(tg.x, tg.y, tg.key, tg.frame).setScale(tg.scale).setFlipX(tg.flip).setDepth(D + 4).setCrop((fw / 3) * cx, (fh / 3) * cy, fw / 3, fh / 3).setTint(0xffb4b4));
          sc.tweens.add({ targets: ch, x: tg.x + (cx - 1) * (120 + Math.random() * 140), y: floor - Math.random() * 20, angle: (Math.random() - 0.5) * 900, duration: 700 + Math.random() * 300, ease: "Quad.out" });
        }
      for (let i = 0; i < 5; i++) guts(tg.x, tg.y, -Math.PI / 2 + (i - 2) * 0.7, 110 + Math.random() * 80);
      blood(tg.x, tg.y, 70, 1.6, true);
      organs(tg.x, tg.y, 10);
      act.idle();
      label(NAMES.explode);
      await wait(2000);
      break;
    }
    case "halved": {
      // the wind-up and the swing are his; the cut is a flash down the middle
      act.walk();
      await tw({ targets: me, x: tg.x - W * 0.42 - me.displayWidth * 0.2, duration: 220 });
      act.idle();
      await act.play("katana", { frames: [0, 4], hold: true });
      flash();
      synth.play("swing");
      void act.play("katana", { frames: [5, 8], hold: true, fps: 18 });
      fx("vfx_crit", tg.x, tg.y - H * 0.15, Math.max(0.8, H / 110), { add: true, depth: D + 8 });
      await wait(260);
      synth.play("crit");
      const left = keep(sc.add.image(tg.x, tg.y, tg.key, tg.frame).setScale(tg.scale).setFlipX(tg.flip).setDepth(D + 3).setCrop(0, 0, fw / 2, fh));
      body.setCrop(fw / 2, 0, fw / 2, fh);
      label(NAMES.halved);
      await wait(500);
      sc.tweens.add({ targets: left, x: tg.x - 40, angle: -70, y: floor - W * 0.25, duration: 900, ease: "Quad.in" });
      sc.tweens.add({ targets: body, x: tg.x + 40, angle: 70, y: floor - W * 0.25, duration: 900, ease: "Quad.in" });
      fountain(tg.x, tg.y - H * 0.2, 1200);
      for (let i = 0; i < 3; i++) guts(tg.x, tg.y + i * 10, Math.PI / 2 + (i - 1) * 0.6, 60);
      organs(tg.x, tg.y + H * 0.1, 4, ["gutrope", "guts", "kidney", "liver"], 0.4);
      act.idle();
      await wait(1800);
      break;
    }
    case "headboot": {
      // a run-up and a punt: the kick is his own (krelact kick row)
      await act.play("kick", { frames: [0, 3], hold: true });
      flash();
      synth.play("punch_big");
      void act.play("kick", { frames: [4, 8] });
      const head = cropTop(0.3);
      label(NAMES.headboot);
      fountain(tg.x, neckY, 1600);
      await tw({ targets: head, y: tg.y - 600, angle: 720, duration: 700, ease: "Quad.out" });
      sc.tweens.add({ targets: body, angle: tg.flip ? -90 : 90, y: floor - W * 0.2, duration: 700, ease: "Quad.in" });
      await wait(400);
      head.setPosition(me.x + 40, tg.y - 500);
      void act.play("kick", { frames: [0, 3], hold: true, fps: 8 });
      await tw({ targets: head, y: floor - 30, angle: 1080, duration: 700, ease: "Quad.in" });
      synth.play("punch_big");
      void act.play("kick", { frames: [4, 8], fps: 18 });
      const goal = keep(sc.add.text(me.x + 120, me.y - 80, "GOOOAL!", { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffffff", stroke: "#000", strokeThickness: 4 }).setDepth(D + 10).setScale(1 / cam.zoom));
      void goal;
      await tw({ targets: head, x: head.x + 700, y: head.y - 300, angle: 1800, duration: 700, ease: "Quad.out" });
      synth.play("gunget");
      await wait(600);
      break;
    }
    case "slit": {
      // in close, blade up, one quick draw across
      await tw({ targets: me, x: tg.x - W * 0.6, duration: 200 });
      await act.play("katana", { frames: [0, 4], hold: true, fps: 16 });
      synth.play("swing");
      await act.play("katana", { frames: [5, 8], hold: true, fps: 20 });
      synth.play("crit");
      flash();
      fx("vfx_crit", tg.x, neckY, 0.7, { add: true, depth: D + 8 });
      label(NAMES.slit);
      fountain(tg.x, neckY, 1400);
      body.setTint(0xffb0b0);
      await wait(700);
      sc.tweens.add({ targets: body, angle: tg.flip ? -84 : 84, y: floor - W * 0.2, duration: 700, ease: "Quad.in" });
      await wait(1200);
      break;
    }
    case "flatten": {
      // you go up… and come down on them
      synth.play("lob");
      // the crouch and the jump are his (krelact stomp row): tucked going up, feet first coming down
      await act.play("stomp", { frames: [0, 2], hold: true });
      void act.play("stomp", { frames: [3, 5], hold: true, fps: 8 });
      await tw({ targets: me, x: tg.x, y: tg.y - H - 200, duration: 450, ease: "Quad.out" });
      void act.play("stomp", { frames: [6, 8], hold: true, fps: 14 });
      await tw({ targets: me, y: tg.y - H * 0.35, duration: 220, ease: "Quad.in" });
      flash();
      synth.play("splat");
      synth.play("boom");
      cam.shake(400, 0.025);
      sc.tweens.add({ targets: body, scaleY: tg.scale * 0.08, scaleX: tg.scale * 1.8, y: floor - 4, duration: 120 });
      sc.tweens.add({ targets: me, y: floor - 40, duration: 120 });
      blood(tg.x, floor - 6, 60, 1.4, true);
      for (let i = 0; i < 4; i++) guts(tg.x, floor - 6, i < 2 ? Math.PI + 0.2 * i : -0.2 * (i - 2), 100);
      organs(tg.x, floor - 6, 6, ["eyeball", "tooth", "meat", "gutrope", "brain", "eyeball2"], 0.7);
      if (gore) kp(prop(sc, "kp_splat_mush", tg.x, floor - 2, { w: W * 1.9, depth: D + 1 }));
      label(NAMES.flatten);
      await wait(1800);
      break;
    }
  }

  if (which === "vice") {
    // a giant workshop vice slams down around them
    const vg = keep(sc.add.container(tg.x, tg.y).setDepth(D + 4));
    const jawH = H * 1.05;
    // drawn (PixelLab): two cast-iron jaws, teeth facing in, on a screw rail with its crank handle on your side
    const drawnVice = sc.textures.exists("kp_vice_jaw") && sc.textures.exists("kp_vice_screw");
    let jawHalf = 17;
    const mkJaw = (side: number) => {
      const j = sc.add.container(side * (W * 0.5 + 40), 0);
      if (drawnVice) {
        const im = sc.add.image(0, 0, "kp_vice_jaw").setFlipX(side > 0);
        im.setScale(jawH / im.frame.height);
        jawHalf = (im.frame.width * jawH) / im.frame.height / 2;
        j.add(im);
        return j;
      }
      j.add(sc.add.rectangle(0, 0, 34, jawH, 0x6b7280).setStrokeStyle(3, 0x1f2937));
      for (let k = -3; k <= 3; k++) j.add(sc.add.rectangle(-side * 15, (k * jawH) / 8, 6, 8, 0x374151));
      j.add(sc.add.rectangle(side * 30, jawH * 0.35, 40, 26, 0x4b5563).setStrokeStyle(2, 0x1f2937));
      return j;
    };
    const L = mkJaw(-1);
    const R = mkJaw(1);
    let handle: Phaser.GameObjects.GameObject & { angle: number };
    if (drawnVice) {
      const rail = sc.add.image(-30, jawH / 2 + 4, "kp_vice_screw").setFlipX(true).setOrigin(0.5, 0.5);
      rail.setScale((W + 240) / rail.frame.width);
      handle = sc.add.rectangle(0, 0, 1, 1, 0, 0);
      vg.add([rail, L, R, handle]);
    } else {
      const base = sc.add.rectangle(0, jawH / 2 + 12, W + 160, 24, 0x374151).setStrokeStyle(3, 0x111827);
      const screw = sc.add.rectangle(W * 0.5 + 110, jawH * 0.35, 120, 10, 0x9ca3af);
      handle = sc.add.rectangle(W * 0.5 + 170, jawH * 0.35, 8, 90, 0xd1d5db).setStrokeStyle(2, 0x1f2937);
      vg.add([base, screw, L, R, handle]);
    }
    vg.y = tg.y - 700;
    // stand back, by the crank
    me.setFlipX(true);
    act.walk();
    await tw({ targets: me, x: tg.x - W * 0.5 - 52 - jawHalf * 2 - 16, duration: 300 });
    act.idle(1);
    synth.play("lob");
    await tw({ targets: vg, y: tg.y, duration: 380, ease: "Bounce.out" });
    synth.play("punch_big");
    cam.shake(250, 0.015);
    flash();
    const squeeze = label("SQUEEZE!");
    // crank it shut, a turn at a time; they scream higher and higher
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const k = (i + 1) / steps;
      const gap = W * 0.5 * (1 - k * 0.85);
      synth.play("tap");
      if (i >= 5) synth.play("bonecrack");
      synth.voice(i < 3 ? "oh" : i < 6 ? "grunt" : "oh", 0.55 + k * 0.3, 1.1 + k * 1.1);
      sc.tweens.add({ targets: handle, angle: handle.angle + 70, duration: 160 });
      // you, on the crank: a heave per turn
      void act.play("pull", { frames: i % 2 ? [4, 8] : [0, 4], hold: true, fps: 22 });
      sc.tweens.add({ targets: L, x: -(gap + jawHalf), duration: 160 });
      sc.tweens.add({ targets: R, x: gap + jawHalf, duration: 160 });
      sc.tweens.add({ targets: body, scaleX: tg.scale * (1 - k * 0.82), scaleY: tg.scale * (1 + k * 0.35), duration: 160 });
      body.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - k * 160), Math.round(255 - k * 160)));
      cam.shake(120, 0.004 + k * 0.01);
      if (i > 3) blood(tg.x, tg.y - H * 0.2, 3 + i, 0.6, true);
      if (i === 6) {
        const pop = keep(sc.add.text(tg.x + W * 0.3, tg.y - H * 0.6, "AAAAAAAAGH!!", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setDepth(D + 10).setScale(1 / cam.zoom));
        sc.tweens.add({ targets: pop, x: pop.x + 6, yoyo: true, repeat: 12, duration: 40 });
      }
      await wait(260 - i * 12);
    }
    // ...and POP
    synth.voice("oh", 0.9, 2.6);
    await wait(150);
    flash();
    synth.play("explode");
    fx("vfx_bigboom", tg.x, tg.y + H * 0.15, 1.5 * Math.max(1, W / 90), { depth: D + 7 });
    synth.play("splat");
    synth.play("boom");
    cam.shake(600, 0.035);
    body.setVisible(false);
    for (let cy = 0; cy < 4; cy++) {
      const ch = keep(sc.add.image(tg.x, tg.y, tg.key, tg.frame).setScale(tg.scale * 0.3, tg.scale).setFlipX(tg.flip).setDepth(D + 4).setCrop(0, (fh / 4) * cy, fw, fh / 4).setTint(0xff9999));
      sc.tweens.add({ targets: ch, x: tg.x + (Math.random() - 0.5) * 300, y: floor - Math.random() * 10, angle: (Math.random() - 0.5) * 1000, duration: 650 + Math.random() * 300, ease: "Quad.out" });
    }
    blood(tg.x, tg.y - H * 0.1, 90, 1.8, true);
    for (let i = 0; i < 6; i++) guts(tg.x, tg.y - H * 0.1, -Math.PI / 2 + (i - 2.5) * 0.55, 90 + Math.random() * 90);
    bones(tg.x, tg.y - H * 0.1, 12);
    organs(tg.x, tg.y - H * 0.1, 8);
    act.idle();
    squeeze.destroy();
    label(NAMES.vice);
    sc.tweens.add({ targets: [L, R], x: 0, duration: 120 });
    await wait(2200);
  }

  if (which === "bellybomb") {
    // the bombs you planted, blinking through his skin
    const lights = [
      [-0.14, 0.0],
      [0.12, -0.03],
      [-0.06, 0.1],
      [0.1, 0.09],
    ].map(([dx, dy]) => keep(sc.add.circle(tg.x + dx * W, tg.y + dy * H, 4, 0xff2020).setDepth(D + 4)));
    // drawn: little red bomb lamps glowing through him (the circles stay as the blink state, hidden)
    const lamps = lights.map((l) => kp(bit(sc, "bomblight", l.x, l.y, 12, D + 4)));
    let lampEv: Phaser.Time.TimerEvent | null = null;
    if (lamps.every(Boolean)) {
      lights.forEach((l) => l.setAlpha(0));
      lampEv = sc.time.addEvent({ delay: 30, loop: true, callback: () => lamps.forEach((m, i) => m?.active && m.setAlpha(lights[i].active && lights[i].fillColor === 0xff2020 ? 1 : 0.25)) });
    }
    void act.play("det", { hold: true });
    const say = (t: string, col = "#ffffff") => {
      const p = keep(sc.add.text(tg.x + W * 0.45, tg.y - H * 0.55, t, { fontFamily: "Impact, sans-serif", fontSize: "20px", color: col, stroke: "#000", strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(D + 10).setScale(1 / cam.zoom));
      return p;
    };
    let p = say("'Ere. What's that beeping?");
    for (let i = 0; i < 6; i++) {
      lights.forEach((l) => l.setFillStyle(i % 2 ? 0x550000 : 0xff2020));
      synth.play("tap");
      await wait(330 - i * 30);
    }
    p.destroy();
    p = say("Oh no. Me tummy.", "#fecaca");
    // he swells
    body.setTint(0xffb0b0);
    sc.tweens.add({ targets: body, x: { from: tg.x - 2, to: tg.x + 2 }, yoyo: true, repeat: 30, duration: 35 });
    const beep = sc.time.addEvent({ delay: 90, loop: true, callback: () => { synth.play("tap"); lights.forEach((l) => l.setFillStyle(l.fillColor === 0xff2020 ? 0x550000 : 0xff2020)); } });
    synth.voice("oh", 0.6, 0.7);
    await tw({ targets: body, scaleX: tg.scale * 1.45, scaleY: tg.scale * 1.15, duration: 1100, ease: "Quad.in" });
    beep.remove();
    p.destroy();
    // BOOM, belly first
    flash();
    synth.play("explode");
    fx("vfx_bigboom", tg.x, tg.y + H * 0.15, 1.5 * Math.max(1, W / 90), { depth: D + 7 });
    synth.play("boom");
    synth.play("splat");
    cam.shake(700, 0.04);
    lights.forEach((l) => l.destroy());
    lampEv?.remove();
    lamps.forEach((m) => m?.destroy());
    act.idle();
    body.setScale(tg.scale * 1.2, tg.scale);
    const bx = tg.x;
    const by = tg.y + H * 0.04;
    // the front of his belly, in bits
    for (let cx = 0; cx < 3; cx++) {
      const ch = keep(sc.add.image(tg.x, tg.y, tg.key, tg.frame).setScale(tg.scale * 1.2, tg.scale).setFlipX(tg.flip).setDepth(D + 4).setCrop(fw * (0.3 + cx * 0.14), fh * 0.42, fw * 0.14, fh * 0.2).setTint(0xffa0a0));
      sc.tweens.add({ targets: ch, x: tg.x + (cx - 1) * (220 + Math.random() * 120), y: floor - Math.random() * 10, angle: (Math.random() - 0.5) * 1200, duration: 800 + Math.random() * 300, ease: "Quad.out" });
    }
    // a great hole where his belly was (drawn: a ragged wound with the guts showing)
    if (!kp(prop(sc, gore ? "kp_wound_belly" : "kp_dustheap", bx, by, { w: W * 0.42, depth: D + 3 }))) {
      keep(sc.add.ellipse(bx, by, W * 0.34, H * 0.17, 0x450a0a).setStrokeStyle(3, 0x9f1239).setDepth(D + 3));
      keep(sc.add.ellipse(bx, by, W * 0.22, H * 0.1, 0x7f1d1d).setDepth(D + 3));
    }
    // intestines: lots of them, a long way
    for (let i = 0; i < 7; i++) guts(bx, by, -Math.PI / 2 + (i - 3) * 0.5, 120 + Math.random() * 140);
    for (let i = 0; i < 4; i++) guts(bx, by, (i < 2 ? Math.PI : 0) + (Math.random() - 0.5) * 0.4, 200 + Math.random() * 120);
    // and the rest of what was in there: poo, a gerbil, a tumour
    const bits: [number, number][] = [[0x7c4a1e, 9], [0x7c4a1e, 7], [0x5b3714, 8], [0xd6a36b, 7], [0xa855f7, 10], [0x7c4a1e, 6]];
    const drawnBits: Bit[] = ["poo", "poo", "poo", "gerbil", "tumour", "poo"];
    for (const [i, [col, r]] of bits.entries()) {
      const c = keep(bit(sc, drawnBits[i], bx, by, r * 2.4, D + 5) ?? sc.add.circle(bx, by, r, col).setStrokeStyle(2, 0x1f1206).setDepth(D + 5));
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.8;
      const d = 150 + Math.random() * 250;
      sc.tweens.add({ targets: c, x: bx + Math.cos(a) * d, y: floor - Math.random() * 8, angle: 720, duration: 900 + Math.random() * 300, ease: "Quad.out" });
    }
    fountain(bx, by, 2400);
    blood(bx, by, 120, 2, true);
    bones(bx, by, 6);
    label(NAMES.bellybomb);
    await wait(900);
    p = say("…'ello.", "#fecaca");
    await wait(900);
    p.destroy();
    sc.tweens.add({ targets: body, angle: tg.flip ? -90 : 90, y: floor - W * 0.2, duration: 800, ease: "Quad.in" });
    await wait(1400);
  }

  // ---- the close-up: a hard cut to the drawn anime shot of it, then back here for the banner
  slow(1);
  await krelCinema(sc, { which, title: gore ? NAMES[which] : (TAME_NAMES as Record<string, string>)[which] ?? "K.O.!", victim: tg.name });
  // ---- KRELTALITY (and you, celebrating: his own victory row)
  if (me.active && me.visible && me.scrollFactorX === 1) act.cheer();
  const kz = 1 / cam.zoom;
  const big = keep(sc.add.text(480, 270 - 130 * kz, "KRELTALITY", { fontFamily: "Impact, sans-serif", fontSize: "84px", color: "#dc2626", stroke: "#000", strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 60).setScale(2 * kz).setAlpha(0));
  sc.tweens.add({ targets: big, scale: kz, alpha: 1, duration: 300, ease: "Quad.out" });
  synth.play("boom");
  cam.shake(300, 0.02);
  if (!gore) big.setColor("#fde047");
  // drips off the letters
  // drawn blood drops (gore on), running down off the letters
  for (let i = 0; i < 14 && gore; i++) {
    const x = 480 + (i - 6.5) * 34 * kz;
    const y0 = 270 - 95 * kz;
    const dr = bit(sc, "drop", x, y0, 14 * kz, D + 59);
    if (dr) {
      keep(dr.setScrollFactor(0).setAlpha(0));
      sc.tweens.add({ targets: dr, alpha: 1, y: y0 + (30 + Math.random() * 60) * kz, delay: 300 + Math.random() * 600, duration: 1200 + Math.random() * 800, ease: "Sine.in" });
      continue;
    }
    const d = keep(sc.add.rectangle(x, y0, 5 * kz, 4 * kz, 0xb91c1c).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D + 59));
    sc.tweens.add({ targets: d, scaleY: 8 + Math.random() * 16, delay: 300 + Math.random() * 600, duration: 1200 + Math.random() * 800 });
  }
  const sub = keep(sc.add.text(480, 270 - 65 * kz, `${tg.name} HAS BEEN KRELTALISED`, { fontFamily: FONT, fontSize: "16px", color: "#fca5a5", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 60).setScale(kz));
  void sub;
  await wait(2600);
  // and back to the room
  vic.destroy();
  for (const o of junk) {
    sc.tweens.killTweensOf(o);
    o.destroy();
  }
  cam.zoomTo(1, 400);
  await wait(400);
}

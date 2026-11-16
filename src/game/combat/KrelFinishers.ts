import Phaser from "phaser";
import { synth } from "../audio/Synth";
import type { KrelTarget } from "./Kreltality";

/**
 * The choreographed Kreltalities: wind-up, a slow-motion beat, the impact, the aftermath. Mortal Kombat's
 * fatalities and the Saw films' traps, done as a cartoon. Each has a tame version for when gore is off
 * (no blood, nothing comes off: they just get a fright and keel over with stars round their head).
 */

export type Elegant = "jawtrap" | "pendulum" | "ribcage" | "freeze" | "kebab" | "lasergrid" | "xray" | "decap";
export const ELEGANT: Elegant[] = ["jawtrap", "pendulum", "ribcage", "freeze", "kebab", "lasergrid", "xray", "decap"];
export const ELEGANT_NAMES: Record<Elegant, string> = {
  jawtrap: "REVERSE BEAR TRAP!",
  pendulum: "THE PENDULUM!",
  ribcage: "OPEN HEART SURGERY!",
  freeze: "DEEP FREEZE!",
  kebab: "DONER KEBAB'D!",
  lasergrid: "DICED!",
  xray: "X-RAY!",
  decap: "HEAD CLEAN OFF!",
};
const TAME_NAMES: Record<Elegant, string> = {
  jawtrap: "SPRUNG!",
  pendulum: "BONK!",
  ribcage: "HEART STOLEN!",
  freeze: "DEEP FREEZE!",
  kebab: "ROTISSERIED!",
  lasergrid: "SINGED!",
  xray: "X-RAY!",
  decap: "SCARED STIFF!",
};

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

/** Everything a finisher needs from the stage (Kreltality.ts builds it). */
export interface KrelCtx {
  sc: Phaser.Scene;
  cam: Phaser.Cameras.Scene2D.Camera;
  tg: KrelTarget;
  body: Phaser.GameObjects.Image;
  me: Phaser.GameObjects.Sprite;
  /** the player's sprite scale */
  ps: number;
  W: number;
  H: number;
  fw: number;
  fh: number;
  floor: number;
  /** the opaque part of the victim's frame, as fractions of it (sprites have empty margins) */
  fig: { u0: number; v0: number; u1: number; v1: number };
  D: number;
  gore: boolean;
  calm: boolean;
  wait(ms: number): Promise<void>;
  tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void>;
  keep<T extends Phaser.GameObjects.GameObject>(o: T): T;
  fx(key: string, x: number, y: number, scale: number, extra?: Record<string, unknown>): Phaser.GameObjects.Sprite | null;
  blood(x: number, y: number, n: number, power?: number, up?: boolean): void;
  fountain(x: number, y: number, ms: number): void;
  guts(x: number, y: number, a: number, len?: number): void;
  bones(x: number, y: number, n: number): void;
  flash(): void;
  /** slow motion (1 = normal); letterbox bars while it's slowed */
  slow(k: number): void;
}

const lerpCol = (a: number, b: number, k: number) => {
  const ch = (s: number) => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * k);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export async function runElegant(c: KrelCtx, which: Elegant) {
  const { sc, cam, body, D, keep } = c;
  // T is where the sprite is; everything else works off the figure itself (the frame minus its empty margins)
  const T = c.tg;
  const f = c.fig;
  // real sizes: art with customData.hd is drawn at a fraction of the scale it's given (gfx/HD.ts), so read them back
  const sA = Math.abs(body.scaleX);
  const Wf = c.fw * sA;
  const Hf = c.fh * sA;
  /** scale tweens on HD art misbehave (writes are multiplied, reads aren't): drive a number and set it */
  const scaleTo = (o: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, from: [number, number], to: [number, number], cfg: Partial<Phaser.Types.Tweens.TweenBuilderConfig>) => {
    const k = { t: 0 };
    return c.tw({ ...cfg, targets: k, t: 1, onUpdate: () => o.setScale(from[0] + (to[0] - from[0]) * k.t, from[1] + (to[1] - from[1]) * k.t) } as Phaser.Types.Tweens.TweenBuilderConfig);
  };
  const W = (f.u1 - f.u0) * Wf;
  const H = (f.v1 - f.v0) * Hf;
  const top = T.y - Hf / 2 + f.v0 * Hf;
  const tg = { ...T, x: T.x + ((f.u0 + f.u1) / 2 - 0.5) * Wf * (T.flip ? -1 : 1), y: top + H / 2 };
  const floor = top + H;
  /** figure fractions -> frame fractions */
  const fu = (u: number) => f.u0 + u * (f.u1 - f.u0);
  const fv = (v: number) => f.v0 + v * (f.v1 - f.v0);
  /** hide everything of the body above figure-fraction v */
  const cropAbove = (v: number) => body.setCrop(0, fv(v) * c.fh, c.fw, c.fh * (1 - fv(v)));
  const name = (c.gore ? ELEGANT_NAMES : TAME_NAMES)[which];

  // ---- shared bits
  /** A rectangle of the victim's sprite (fractions of the frame) as its own image, exactly where it sits on them. */
  const part = (u0: number, v0: number, u1: number, v1: number, depth = D + 3) => {
    const tex = sc.textures.get(T.key);
    const base = tex.get(T.frame);
    const x = Math.round(fu(u0) * c.fw);
    const y = Math.round(fv(v0) * c.fh);
    const w = Math.max(1, Math.round((fu(u1) - fu(u0)) * c.fw));
    const h = Math.max(1, Math.round((fv(v1) - fv(v0)) * c.fh));
    const nm = `krelpart:${String(T.frame)}:${x},${y},${w},${h}`;
    if (!tex.has(nm)) tex.add(nm, base.sourceIndex, base.cutX + x, base.cutY + y, w, h);
    const s = sA;
    const cx = T.flip ? T.x + Wf / 2 - (x + w / 2) * s : T.x - Wf / 2 + (x + w / 2) * s;
    const cy = T.y - Hf / 2 + (y + h / 2) * s;
    return keep(sc.add.image(cx, cy, T.key, nm).setScale(T.scale).setFlipX(tg.flip).setDepth(depth));
  };
  /** Thrown: a little arc under gravity, spinning, until it lands at landY. */
  const toss = (o: Obj, vx: number, vy: number, landY: number, spin = 0, onLand?: () => void) => {
    const x0 = o.x;
    const y0 = o.y;
    const a0 = o.angle;
    const g = 900;
    const disc = vy * vy + 2 * g * (landY - y0);
    const T = disc > 0 ? (-vy + Math.sqrt(disc)) / g : 0.5;
    const p = { t: 0 };
    sc.tweens.add({ targets: p, t: T, duration: T * 1000, onUpdate: () => {
      o.setPosition(x0 + vx * p.t, y0 + vy * p.t + 0.5 * g * p.t * p.t);
      o.setAngle(a0 + spin * p.t);
    }, onComplete: () => onLand?.() });
  };
  /** A line of speech over the victim's head (or yours). */
  const say = (t: string, col = "#ffffff", who: "them" | "me" = "them") => {
    const x = who === "me" ? c.me.x : tg.x + W * 0.4;
    const y = who === "me" ? c.me.y - c.me.displayHeight * 0.55 : top - 6;
    const s = keep(sc.add.text(x, y, t, { fontFamily: "Impact, sans-serif", fontSize: "20px", color: col, stroke: "#000", strokeThickness: 5 }).setOrigin(who === "me" ? 0.5 : 0, 1).setDepth(D + 10).setScale(1 / cam.zoom));
    return s;
  };
  /** The finisher's name on a black band across the top, Mortal Kombat style (it makes way for KRELTALITY). */
  const cardBits: Phaser.GameObjects.GameObject[] = [];
  const card = () => {
    const kz = 1 / cam.zoom;
    const y = 270 - 185 * kz;
    const band = keep(sc.add.rectangle(480, y, 1100 * kz, 56 * kz, 0x000000, 0.85).setScrollFactor(0).setDepth(D + 55).setScale(0, 1));
    const edge = [-1, 1].map((s) => keep(sc.add.rectangle(480, y + s * 28 * kz, 1100 * kz, 3 * kz, 0xb91c1c).setScrollFactor(0).setDepth(D + 56).setScale(0, 1)));
    const t = keep(sc.add.text(480 - 500 * kz, y, name, { fontFamily: "Impact, sans-serif", fontSize: "40px", color: c.gore ? "#ef4444" : "#fde047", stroke: "#000", strokeThickness: 7 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 57).setScale(kz).setAlpha(0));
    cardBits.push(band, ...edge, t);
    sc.tweens.add({ targets: [band, ...edge], scaleX: 1, duration: 220, ease: "Quad.out" });
    sc.tweens.add({ targets: t, x: 480, alpha: 1, duration: 320, delay: 120, ease: "Back.out" });
    synth.play("smash", 0.6);
  };
  /** Gore off: the fright of it. A wobble, stars round the head, flat on their back. */
  const tameKO = async (o: Obj = body) => {
    synth.play("trombone");
    const stars = [0, 1, 2].map(() => keep(sc.add.text(o.x, o.y, "★", { fontFamily: "Arial", fontSize: "18px", color: "#fde047", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 9).setScale(1 / cam.zoom)));
    const ev = sc.time.addEvent({ delay: 16, loop: true, callback: () => stars.forEach((s, i) => {
      const a = sc.time.now / 220 + i * 2.09;
      const hx = o.x + Math.sin((o.angle * Math.PI) / 180) * H * 0.42;
      const hy = o.y - Math.cos((o.angle * Math.PI) / 180) * H * 0.42;
      s.setPosition(hx + Math.cos(a) * W * 0.32, hy + Math.sin(a) * 7);
    }) });
    sc.time.delayedCall(4500, () => ev.remove());
    await c.tw({ targets: o, angle: { from: -8, to: 8 }, yoyo: true, repeat: 2, duration: 150 });
    await c.tw({ targets: o, angle: tg.flip ? -90 : 90, y: floor - W * 0.5, duration: 600, ease: "Quad.in" });
    synth.play("bodies_land");
    c.fx("vfx_dust", o.x, floor, 1.4);
    cam.shake(200, 0.008);
  };
  /** Put the victim in a container so things drawn on them fall over with them. */
  const rig = () => {
    const r = keep(sc.add.container(T.x, T.y).setDepth(D + 2));
    body.setPosition(0, 0);
    r.add(body);
    return r;
  };
  const fall = (o: Obj, ms = 700) => c.tw({ targets: o, angle: tg.flip ? -90 : 90, y: floor - W * 0.5, duration: ms, ease: "Quad.in" });

  switch (which) {
    // ------------------------------------------------------------ REVERSE BEAR TRAP (Saw)
    case "jawtrap": {
      const headY = top + H * 0.17;
      const hw = Math.max(30, W * 0.5);
      const hh = Math.max(30, H * 0.3);
      const steel = 0x6b7280;
      const dark = 0x1f2937;
      const dev = keep(sc.add.container(tg.x, headY - 600).setDepth(D + 4));
      const mkArm = (side: number) => {
        const a = sc.add.container(side * hw * 0.34, hh * 0.5);
        a.add(sc.add.rectangle(0, -hh * 0.52, 7, hh * 1.05, steel).setStrokeStyle(2, dark));
        a.add(sc.add.rectangle(-side * hw * 0.17, -hh * 1.02, hw * 0.36, 7, steel).setStrokeStyle(2, dark));
        for (let i = 0; i < 4; i++) a.add(sc.add.triangle(-side * (hw * 0.04 + i * hw * 0.08), -hh * 0.97, 0, 0, 6, 0, 3, 8, 0xe5e7eb).setOrigin(0.5, 0));
        a.add(sc.add.circle(0, 0, 5, 0x9ca3af).setStrokeStyle(2, dark));
        return a;
      };
      const armL = mkArm(-1);
      const armR = mkArm(1);
      const strap = sc.add.rectangle(0, 0, hw * 0.95, 6, 0x3f3f46).setStrokeStyle(1, 0x111111);
      const plate = sc.add.rectangle(0, hh * 0.5, hw * 0.85, 8, steel).setStrokeStyle(2, dark);
      const box = sc.add.rectangle(0, hh * 0.66, 36, 17, 0x111827).setStrokeStyle(2, 0x6b7280);
      const timer = sc.add.text(0, hh * 0.66, "0:05", { fontFamily: "monospace", fontSize: "12px", color: "#ef4444", fontStyle: "bold" }).setOrigin(0.5);
      dev.add([strap, plate, armL, armR, box, timer]);
      cam.pan(tg.x, headY + 10, 600, "Sine.easeInOut");
      cam.zoomTo(2.2, 600);
      synth.play("lob");
      await c.tw({ targets: dev, y: headY, duration: 450, ease: "Bounce.out" });
      synth.play("smash");
      cam.shake(200, 0.01);
      await c.wait(300);
      let p = say("'Ere. What's this hat?");
      await c.wait(1000);
      p.destroy();
      p = say("Why's it ticking?", "#fecaca");
      for (let n = 5; n >= 1; n--) {
        timer.setText(`0:0${n}`);
        synth.play("tap");
        synth.voice("oh", 0.45, 1 + (5 - n) * 0.25);
        sc.tweens.add({ targets: box, scale: 1.3, yoyo: true, duration: 70 });
        sc.tweens.add({ targets: body, x: { from: T.x - 2, to: T.x + 2 }, yoyo: true, repeat: 3, duration: 30 });
        await c.wait(560 - (5 - n) * 70);
      }
      p.destroy();
      timer.setText("0:00");
      synth.play("alarm");
      sc.tweens.add({ targets: timer, alpha: 0.2, yoyo: true, repeat: -1, duration: 60 });
      // the beat: nothing. Then everything.
      await c.wait(500);
      c.slow(0.3);
      synth.play("telegraph");
      sc.tweens.add({ targets: armL, angle: -82, duration: 160, ease: "Back.out" });
      sc.tweens.add({ targets: armR, angle: 82, duration: 160, ease: "Back.out" });
      if (c.gore) {
        const cap = part(0, 0, 1, 0.2, D + 5);
        cropAbove(0.2);
        synth.play("bonecrack");
        synth.play("splat");
        c.flash();
        cam.shake(400, 0.02);
        toss(cap, (tg.flip ? 1 : -1) * 90, -420, floor - 8, 520, () => {
          synth.play("splat");
          c.blood(cap.x, floor - 6, 20, 0.8);
        });
        c.fountain(tg.x, top + H * 0.2, 2600);
        c.blood(tg.x, top + H * 0.18, 50, 1.3, true);
        c.bones(tg.x, top + H * 0.18, 5);
        await c.wait(1100);
        c.slow(1);
        card();
        await c.wait(600);
        toss(dev, 40, -120, floor - hh * 0.3, 90, () => synth.play("smash"));
        await fall(body);
        c.blood(tg.x + W * 0.3, floor - 4, 30, 0.8);
        await c.wait(1300);
      } else {
        synth.play("wonk");
        const boing = keep(sc.add.text(tg.x, top - 20, "BOING!", { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#fde047", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(D + 10).setScale(0.5 / cam.zoom));
        sc.tweens.add({ targets: boing, scale: 1.1 / cam.zoom, duration: 200, ease: "Back.out" });
        await c.wait(400);
        c.slow(1);
        toss(dev, 60, -380, floor - hh * 0.3, 400, () => synth.play("smash"));
        card();
        await tameKO();
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ THE PENDULUM (Saw V / Poe)
    case "pendulum": {
      const waistY = tg.y + H * 0.06;
      const pivY = top - 220;
      const R = Math.max(34, W * 0.55);
      cam.pan(tg.x, tg.y - H * 0.45 - 40, 700, "Sine.easeInOut");
      cam.zoomTo(1.3, 700);
      const beam = keep(sc.add.rectangle(tg.x, pivY - 8, R * 3, 14, 0x1f2937).setStrokeStyle(2, 0x000000).setDepth(D + 5));
      const arm = keep(sc.add.container(tg.x, pivY).setDepth(D + 5));
      const rod = sc.add.rectangle(0, 0, 6, 1, 0x4b5563).setOrigin(0.5, 0);
      const blade = sc.add.graphics();
      const drawBlade = (bloody: boolean) => {
        blade.clear();
        blade.fillStyle(0x9ca3af, 1).slice(0, -R, R, 0, Math.PI, false).fillPath();
        blade.fillStyle(0x4b5563, 1).slice(0, -R, R * 0.55, 0, Math.PI, false).fillPath();
        blade.lineStyle(3, bloody ? 0xb91c1c : 0xf8fafc, 1).beginPath().arc(0, -R, R - 2, 0.12, Math.PI - 0.12, false).strokePath();
        blade.fillStyle(0x111827, 1).fillRect(-R, -R - 4, R * 2, 6);
        if (bloody) blade.fillStyle(0xb91c1c, 0.9).fillRect(-R * 0.4, -R * 0.15, 4, R * 0.25).fillRect(R * 0.2, -R * 0.1, 4, R * 0.3);
      };
      drawBlade(false);
      const bladeC = sc.add.container(0, 0, [blade]);
      arm.add([rod, bladeC, sc.add.circle(0, 0, 9, 0x374151).setStrokeStyle(2, 0x000000)]);
      const levels = [top - 90, top - 50, top - 6, c.gore ? waistY : top + H * 0.14];
      const st = { L: levels[0] - pivY - 60 };
      const place = () => {
        rod.scaleY = Math.max(1, st.L - R);
        bladeC.y = st.L;
      };
      const A = 58;
      // it ends swinging away from you (you're on their left), so the top half goes off that way
      arm.angle = -A;
      arm.alpha = 0;
      place();
      synth.play("drone");
      await c.tw({ targets: arm, alpha: 1, duration: 400 });
      let p = say("…is that a pendulum?");
      sc.time.delayedCall(1500, () => p.destroy());
      let upper: Phaser.GameObjects.Image | null = null;
      let lower: Phaser.GameObjects.Image | null = null;
      for (let k = 0; k < 4; k++) {
        const last = k === 3;
        const to = k % 2 === 0 ? A : -A;
        const dir = to < 0 ? 1 : -1;
        const dur = 1000;
        if (last) {
          c.slow(0.3);
          synth.play("telegraph");
        }
        sc.tweens.add({ targets: st, L: levels[k] - pivY, duration: 320, ease: "Quad.out", onUpdate: place });
        sc.time.delayedCall(dur * 0.42, () => synth.play("swing"));
        // a glint on the edge as it comes down
        const gl = sc.add.star(0, st.L, 4, 2, 9, 0xffffff);
        bladeC.add(gl);
        gl.setPosition(0, 0).setScale(0);
        sc.tweens.add({ targets: gl, scale: 1, angle: 90, yoyo: true, duration: 140, delay: dur * 0.3 });
        if (k === 2)
          sc.time.delayedCall(dur * 0.5, () => {
            // a skim off the top: a few hairs come down
            for (let i = 0; i < 6; i++) {
              const hr = keep(sc.add.rectangle(tg.x + (Math.random() - 0.5) * W * 0.4, top + 2, 1.5, 5, 0x1f1206).setDepth(D + 6));
              sc.tweens.add({ targets: hr, y: floor, x: hr.x + (Math.random() - 0.5) * 30, angle: 360, duration: 1800 + Math.random() * 900, ease: "Sine.in" });
            }
            p = say("…my fringe!", "#fecaca");
            sc.time.delayedCall(1000, () => p.destroy());
          });
        if (last)
          sc.time.delayedCall(dur * 0.5, () => {
            if (!c.gore) {
              synth.play("punch_big");
              cam.shake(200, 0.01);
              return;
            }
            const v = (waistY - top) / H;
            upper = part(0, 0, 1, v);
            lower = part(0, v, 1, 1, D + 2);
            body.setVisible(false);
            synth.play("crit");
            synth.play("squelch");
            c.flash();
            drawBlade(true);
            const seam = keep(sc.add.rectangle(tg.x, waistY, W * 0.95, 2, 0xffffff).setDepth(D + 6));
            sc.tweens.add({ targets: seam, alpha: 0, duration: 500 });
            c.blood(tg.x + dir * W * 0.4, waistY, 40, 1.2);
            const up = upper;
            sc.tweens.add({ targets: up, x: up.x + dir * W * 0.3, y: up.y + 4, angle: dir * 10, duration: 900, ease: "Sine.in", onComplete: () => toss(up, dir * 120, -40, floor - W * 0.25, dir * 160, () => {
              synth.play("splat");
              c.blood(up.x, floor - 6, 30, 1);
            }) });
          });
        await c.tw({ targets: arm, angle: to, duration: dur, ease: "Sine.inOut", onUpdate: place });
      }
      c.slow(1);
      // it keeps swinging, slower, dripping
      sc.tweens.add({ targets: arm, angle: { from: -A, to: A * 0.6 }, yoyo: true, repeat: -1, duration: 1100, ease: "Sine.inOut" });
      void beam;
      if (c.gore && lower) {
        const lo: Phaser.GameObjects.Image = lower;
        c.fountain(tg.x, waistY, 2200);
        for (let i = 0; i < 3; i++) c.guts(tg.x, waistY, -Math.PI / 2 + (i - 1) * 0.8, 70);
        card();
        await c.wait(1200);
        await c.tw({ targets: lo, x: { from: lo.x - 2, to: lo.x + 2 }, yoyo: true, repeat: 4, duration: 50 });
        await c.tw({ targets: lo, angle: tg.flip ? 80 : -80, y: floor - W * 0.2, duration: 600, ease: "Quad.in" });
        synth.play("bodies_land");
        await c.wait(1100);
      } else {
        card();
        await tameKO();
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ OPEN HEART SURGERY (Kano's heart rip, the ribcage opened like a book)
    case "ribcage": {
      const v0 = 0.3;
      const v1 = 0.6;
      const u0 = 0.24;
      const u1 = 0.76;
      const cw = W * (u1 - u0);
      const ch = H * (v1 - v0);
      const cy = top + H * ((v0 + v1) / 2);
      await c.tw({ targets: c.me, x: tg.x - W * 0.5 - 4, duration: 300 });
      cam.pan(tg.x, cy, 500, "Sine.easeInOut");
      cam.zoomTo(2.3, 500);
      await c.wait(500);
      let p = say("Knock knock.", "#ffffff", "me");
      synth.play("door");
      await c.wait(260);
      synth.play("door");
      await c.wait(700);
      p.destroy();
      p = say("Who's th—");
      await c.wait(450);
      p.destroy();
      const r = rig();
      const ly = cy - T.y;
      const lx = tg.x - T.x;
      // what's behind the doors
      const cav = sc.add.graphics().setVisible(false);
      if (c.gore) {
        cav.fillStyle(0x450a0a, 1).fillRoundedRect(lx - cw / 2, ly - ch / 2, cw, ch, 5);
        cav.fillStyle(0xf472b6, 0.75).fillEllipse(lx - cw * 0.27, ly, cw * 0.36, ch * 0.8).fillEllipse(lx + cw * 0.27, ly, cw * 0.36, ch * 0.8);
        cav.fillStyle(0xf5ecd7, 1).fillRect(lx - 2, ly - ch / 2, 4, ch);
      } else {
        cav.fillStyle(0xfbcfe8, 1).fillRoundedRect(lx - cw / 2, ly - ch / 2, cw, ch, 5);
        cav.lineStyle(1, 0xf472b6, 1);
        for (let i = 1; i < 5; i++) cav.lineBetween(lx - cw / 2, ly - ch / 2 + (ch * i) / 5, lx + cw / 2, ly - ch / 2 + (ch * i) / 5);
      }
      r.add(cav);
      // the heart (in the world, so it can come out)
      const hs = Math.max(0.9, cw / 34);
      const heart = keep(sc.add.container(tg.x, cy + ch * 0.06).setDepth(D + 6).setScale(hs).setVisible(false));
      const hg = sc.add.graphics();
      const hc = c.gore ? 0xdc2626 : 0xf472b6;
      hg.fillStyle(c.gore ? 0x9f1239 : 0xec4899, 1).fillRect(-2, -14, 4, 8);
      hg.fillStyle(hc, 1).fillCircle(-5, -3, 6).fillCircle(5, -3, 6).fillTriangle(-10.6, -1, 10.6, -1, 0, 12);
      hg.fillStyle(0xffffff, 0.5).fillCircle(-6, -5, 2);
      if (!c.gore) hg.lineStyle(1, 0xffffff, 0.9).lineBetween(-6, 2, 6, 2).lineBetween(-3, 6, 3, 6);
      heart.add(hg);
      // the doors: the front of the chest, hinged at each side
      const mkDoor = (a: number, b: number) => {
        const img = part(a, v0, b, v1);
        const isLeft = img.x < tg.x;
        const hingeX = lx + (isLeft ? -cw / 2 : cw / 2);
        const door = sc.add.container(hingeX, ly);
        const ix = img.x - T.x - hingeX;
        img.setPosition(ix, 0);
        const inner = sc.add.graphics().setVisible(false);
        const dw = img.displayWidth;
        const dh = img.displayHeight;
        inner.fillStyle(c.gore ? 0x9f1239 : 0xf9a8d4, 1).fillRect(ix - dw / 2, -dh / 2, dw, dh);
        inner.lineStyle(c.gore ? 3 : 1, c.gore ? 0xf5ecd7 : 0xffffff, 1);
        for (let i = 0; i < 4; i++) inner.lineBetween(ix - dw / 2 + 2, -dh / 2 + dh * (0.15 + i * 0.23), ix + dw / 2 - 2, -dh / 2 + dh * (0.2 + i * 0.23));
        door.add([inner, img]);
        r.add(door);
        return { door, img, inner };
      };
      const doors = [mkDoor(u0, 0.5), mkDoor(0.5, u1)];
      // the crack down the middle
      const crack = sc.add.graphics();
      r.add(crack);
      const cp = { t: 0 };
      synth.play("bonecrack");
      await c.tw({ targets: cp, t: 1, duration: 500, onUpdate: () => {
        crack.clear().lineStyle(2, c.gore ? 0xb91c1c : 0xf472b6, 1);
        const n = 6;
        let y = ly - ch / 2;
        for (let i = 0; i < n * cp.t; i++) {
          const ny = y + ch / n;
          crack.lineBetween(lx + (i % 2 ? 2 : -2), y, lx + (i % 2 ? -2 : 2), ny);
          y = ny;
        }
      } });
      cam.shake(200, 0.008);
      synth.voice("oh", 0.6, 1.6);
      // ...and open, like a book
      crack.setVisible(false);
      cav.setVisible(true);
      heart.setVisible(true);
      synth.play("bonecrack");
      await c.tw({ targets: doors.map((d) => d.door), scaleX: -0.6, duration: 1200, ease: "Sine.inOut", onUpdate: () => doors.forEach((d) => {
        d.img.setVisible(d.door.scaleX > 0);
        d.inner.setVisible(d.door.scaleX <= 0);
      }) });
      // it's still going
      const beat = sc.time.addEvent({ delay: 560, loop: true, callback: () => {
        sc.tweens.add({ targets: heart, scale: hs * 1.25, yoyo: true, duration: 90 });
        synth.play("punch", 0.35);
      } });
      await c.wait(1300);
      // the beat: you reach in
      c.slow(0.4);
      const vessel = keep(sc.add.graphics().setDepth(D + 5));
      const hx = c.me.x + 16;
      const hy = c.me.y - c.me.displayHeight * 0.2;
      await c.tw({ targets: heart, x: hx, y: hy, duration: 700, ease: "Quad.inOut", onUpdate: () => {
        vessel.clear().lineStyle(3 * hs * 0.6, c.gore ? 0x9f1239 : 0xec4899, 1).lineBetween(tg.x, cy, heart.x, heart.y);
      } });
      vessel.destroy();
      synth.play(c.gore ? "squelch" : "pop");
      if (c.gore) c.blood(tg.x, cy, 30, 1, true);
      c.slow(1);
      await c.wait(900);
      p = say(c.gore ? "…that was mine." : "…aww.", "#fecaca");
      await c.wait(1000);
      p.destroy();
      beat.remove();
      if (c.gore) {
        synth.play("splat");
        await c.tw({ targets: heart, scaleX: hs * 1.7, scaleY: hs * 0.25, duration: 120 });
        heart.setVisible(false);
        c.blood(hx, hy, 50, 1.3, true);
        card();
        await c.wait(500);
        await fall(r);
        c.blood(tg.x, floor - 4, 30, 0.8);
        await c.wait(1400);
      } else {
        for (let i = 0; i < 5; i++) {
          const lv = keep(sc.add.text(tg.x + (Math.random() - 0.5) * W * 0.5, top, "♥", { fontFamily: "Arial", fontSize: "16px", color: "#f472b6", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 9).setScale(1 / cam.zoom));
          sc.tweens.add({ targets: lv, y: lv.y - 60, alpha: 0, duration: 1400, delay: i * 150 });
        }
        card();
        await tameKO(r);
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ DEEP FREEZE (Sub-Zero)
    case "freeze": {
      cam.pan(tg.x - W * 0.2, tg.y, 600, "Sine.easeInOut");
      cam.zoomTo(1.9, 600);
      synth.play("transform_sparkle");
      const stream = sc.time.addEvent({ delay: 25, repeat: 44, callback: () => {
        const f = keep(sc.add.circle(c.me.x + 16, c.me.y - 14, 2 + Math.random() * 3, Math.random() < 0.5 ? 0xe0f2fe : 0x7dd3fc, 0.9).setDepth(D + 6));
        sc.tweens.add({ targets: f, x: tg.x + (Math.random() - 0.5) * W * 0.6, y: tg.y + (Math.random() - 0.5) * H * 0.7, alpha: 0.2, duration: 380, onComplete: () => f.destroy() });
      } });
      const col = { k: 0 };
      sc.tweens.add({ targets: col, k: 1, duration: 1100, onUpdate: () => body.setTint(lerpCol(0xffffff, 0x7dd3fc, col.k)) });
      synth.voice("oh", 0.5, 0.9);
      const iw = W * 1.2 + 16;
      const ih = H * 1.08 + 10;
      const ice = keep(sc.add.container(tg.x, floor + 6).setDepth(D + 3));
      ice.add(sc.add.rectangle(0, 0, iw, ih, 0xbae6fd, 0.42).setOrigin(0.5, 1).setStrokeStyle(3, 0xe0f2fe, 0.95));
      const gl = sc.add.graphics();
      gl.lineStyle(5, 0xffffff, 0.45).lineBetween(-iw * 0.36, -ih * 0.2, -iw * 0.12, -ih * 0.78);
      gl.lineStyle(2, 0xffffff, 0.6).lineBetween(-iw * 0.22, -ih * 0.12, 0, -ih * 0.5);
      ice.add(gl);
      ice.scaleY = 0;
      await c.wait(400);
      synth.play("monitor_crack", 0.5);
      synth.voice("oh", 0.4, 0.6);
      await c.tw({ targets: ice, scaleY: 1, duration: 900, ease: "Quad.out" });
      stream.remove();
      const snow = c.fx("vfx_snow", tg.x, tg.y, Math.max(0.6, W / 110), { alpha: 0.7 });
      await c.wait(600);
      let p = say("Chill out.", "#bae6fd", "me");
      await c.wait(1000);
      p.destroy();
      // the wind-up, then the punch, in slow motion
      await c.tw({ targets: c.me, x: c.me.x - 40, duration: 380, ease: "Quad.out" });
      await c.wait(250);
      c.slow(0.25);
      await c.tw({ targets: c.me, x: tg.x - W * 0.5 - 10, duration: 140, ease: "Quad.in" });
      synth.play("punch_big");
      synth.play("plate_smash");
      synth.play("monitor_crack");
      c.flash();
      cam.shake(500, 0.02);
      const ix = tg.x - W * 0.5;
      const iy = tg.y;
      const flyOff = (o: Obj, power = 1) => {
        const a = Math.atan2(o.y - iy, o.x - ix) + (Math.random() - 0.5) * 0.7;
        const sp = (120 + Math.random() * 260) * power;
        toss(o, Math.cos(a) * sp, Math.sin(a) * sp - 160, floor - Math.random() * 10, (Math.random() - 0.5) * 900);
      };
      ice.setVisible(false);
      for (let i = 0; i < 28; i++) {
        const s = keep(sc.add.triangle(tg.x + (Math.random() - 0.5) * iw, floor - Math.random() * ih, 0, 0, 6 + Math.random() * 12, 2, 3, 10 + Math.random() * 14, 0xbae6fd, 0.85).setStrokeStyle(1, 0xffffff).setDepth(D + 5));
        flyOff(s, 1.2);
      }
      c.fx("vfx_sparks", ix + 10, iy, 1, { add: true, tint: 0xbae6fd });
      if (c.gore) {
        body.setVisible(false);
        for (let cx = 0; cx < 3; cx++)
          for (let cyy = 0; cyy < 5; cyy++) {
            const pc = part(cx / 3, cyy / 5, (cx + 1) / 3, (cyy + 1) / 5, D + 4).setTint(0x93c5fd);
            flyOff(pc);
          }
        for (let i = 0; i < 8; i++) {
          const m = keep(sc.add.rectangle(tg.x + (Math.random() - 0.5) * W * 0.5, tg.y + (Math.random() - 0.5) * H * 0.6, 5 + Math.random() * 6, 4 + Math.random() * 5, 0x9f1239).setStrokeStyle(1, 0xbae6fd).setDepth(D + 5));
          flyOff(m);
        }
        c.bones(tg.x, tg.y, 4);
        await c.wait(800);
        c.slow(1);
        card();
        snow?.destroy();
        c.blood(tg.x + W * 0.6, floor - 4, 16, 0.6);
        await c.wait(2000);
      } else {
        await c.wait(600);
        c.slow(1);
        snow?.destroy();
        p = say("…a-a-atchoo.", "#bae6fd");
        await c.wait(900);
        p.destroy();
        card();
        await tameKO();
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ DONER KEBAB'D (an impaling, then the rotisserie)
    case "kebab": {
      cam.pan(tg.x, tg.y - H * 0.3, 600, "Sine.easeInOut");
      cam.zoomTo(1.4, 600);
      synth.play("thunder");
      cam.shake(800, 0.005);
      const cr = keep(sc.add.graphics().setDepth(D + 1));
      cr.lineStyle(2, 0x111111, 1);
      for (let i = 0; i < 6; i++) {
        let x = tg.x;
        let y = floor + 2;
        const dir = i < 3 ? -1 : 1;
        for (let s = 0; s < 4; s++) {
          const nx = x + dir * (6 + Math.random() * 12);
          const ny = y + (Math.random() - 0.5) * 8;
          cr.lineBetween(x, y, nx, ny);
          x = nx;
          y = ny;
        }
      }
      let p = say("…what's that rumbling?");
      await c.wait(1100);
      p.destroy();
      const glint = keep(sc.add.star(tg.x, floor - 2, 4, 2, 10, 0xffffff).setDepth(D + 7).setScale(0));
      synth.play("ding");
      await c.tw({ targets: glint, scale: 1, angle: 90, yoyo: true, duration: 200 });
      await c.wait(400);
      // SHUNK
      const sk = keep(sc.add.graphics().setDepth(D + 1.5));
      sk.setPosition(tg.x, floor + 4);
      const st = { len: 0 };
      const draw = () => {
        sk.clear();
        sk.fillStyle(0x9ca3af, 1).fillRect(-3.5, -st.len, 7, st.len);
        sk.fillStyle(0xf1f5f9, 1).fillRect(-2, -st.len, 2, st.len);
        sk.fillStyle(0xd1d5db, 1).fillTriangle(-6, -st.len, 6, -st.len, 0, -st.len - 20);
        sk.fillStyle(0x3f3f46, 1).fillRect(-9, -6, 18, 6);
      };
      synth.play("gun_rail");
      synth.play("crit");
      await c.tw({ targets: st, len: floor - top + 34, duration: 110, ease: "Quad.in", onUpdate: draw });
      c.flash();
      cam.shake(300, 0.02);
      synth.voice("oh", 0.8, 1.8);
      if (c.gore) {
        synth.play("squelch");
        c.blood(tg.x, top + H * 0.08, 40, 1.3, true);
        c.blood(tg.x, tg.y + H * 0.2, 20, 1);
      }
      // up he goes
      const lift = H * 0.55;
      sc.tweens.add({ targets: st, len: st.len + lift, duration: 900, ease: "Quad.out", onUpdate: draw });
      await c.tw({ targets: body, y: T.y - lift, duration: 900, ease: "Quad.out" });
      if (c.gore) {
        const drip = keep(sc.add.rectangle(tg.x + 1, tg.y - lift + H * 0.45, 4, 1, 0xb91c1c).setOrigin(0.5, 0).setDepth(D + 1.6));
        sc.tweens.add({ targets: drip, displayHeight: floor - drip.y, duration: 1800, ease: "Sine.in" });
      }
      // the rotisserie
      for (let i = -1; i <= 1; i++) {
        if (!c.fx("vfx_fire", tg.x + i * W * 0.22, floor + 4, Math.max(0.7, W / 70) * (i === 0 ? 1.2 : 0.9), { delay: (i + 1) * 120, depth: D + 2.5 })) {
          const f = keep(sc.add.ellipse(tg.x + i * W * 0.22, floor - 6, 16, 24, 0xf97316, 0.9).setDepth(D + 2.5));
          sc.tweens.add({ targets: f, scaleY: 1.4, yoyo: true, repeat: -1, duration: 120 });
        }
      }
      synth.play("gun_flamer", 0.4);
      const spin = { a: 0 };
      sc.tweens.add({ targets: spin, a: Math.PI * 6, duration: 3200, ease: "Sine.inOut", onUpdate: () => {
        const s = Math.cos(spin.a);
        body.scaleX = tg.scale * (Math.abs(s) < 0.08 ? 0.08 * (s < 0 ? -1 : 1) : s);
        body.setTint(lerpCol(0xffffff, c.gore ? 0xb86a32 : 0xd9a066, Math.min(1, spin.a / (Math.PI * 5))));
      } });
      c.fx("vfx_smokecol", tg.x, tg.y - lift - H * 0.3, Math.max(0.6, W / 90), { alpha: 0.6, depth: D + 4 });
      p = say("Ooh. Ooh. Ooh. Ooh.", "#fecaca");
      await c.wait(1500);
      p.destroy();
      p = say(c.gore ? "Large doner. Extra chilli." : "Extra crispy, please.", "#ffffff", "me");
      await c.wait(1700);
      p.destroy();
      body.scaleX = tg.scale;
      if (c.gore) {
        // shave a bit off into a pitta
        const px = c.me.x + 34;
        const py = floor - 6;
        const pit = keep(sc.add.graphics().setDepth(D + 3));
        pit.fillStyle(0xe7c98f, 1).fillEllipse(px, py, 44, 18);
        pit.fillStyle(0x16a34a, 1).fillCircle(px - 10, py - 7, 4).fillCircle(px + 2, py - 8, 4);
        pit.fillStyle(0xdc2626, 1).fillCircle(px + 10, py - 7, 3);
        const knife = keep(sc.add.graphics().setDepth(D + 7));
        const kx = tg.x + (tg.flip ? -1 : 1) * W * 0.25;
        const kp = { t: 0 };
        synth.play("swing");
        await c.tw({ targets: kp, t: 1, duration: 260, onUpdate: () => knife.clear().lineStyle(3, 0xffffff, 1).lineBetween(kx, tg.y - lift - H * 0.35, kx, tg.y - lift - H * 0.35 + H * 0.7 * kp.t) });
        sc.tweens.add({ targets: knife, alpha: 0, duration: 300 });
        const sl = part(0.66, 0.15, 0.8, 0.85, D + 4).setTint(0xb86a32);
        sl.y -= lift;
        synth.play("squelch");
        sc.tweens.add({ targets: sl, x: px, y: py - 8, angle: 90, duration: 600, ease: "Quad.in" });
        await scaleTo(sl, [T.scale, T.scale], [T.scale * 0.55, T.scale * 0.55], { duration: 600 });
        synth.play("splat");
        c.blood(px, py, 10, 0.5);
        card();
        p = say("Salad? Onions?", "#ffffff", "me");
        await c.wait(2200);
      } else {
        card();
        await c.tw({ targets: body, y: T.y, duration: 300, ease: "Quad.in" });
        await tameKO();
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ DICED (a laser grid: nothing happens… then everything slides apart)
    case "lasergrid": {
      const lx = tg.x - W / 2 - 60;
      const rx = tg.x + W / 2 + 60;
      const barY = top - 34;
      await c.tw({ targets: c.me, x: lx - 34, duration: 300 });
      cam.pan(tg.x, tg.y - H * 0.1, 600, "Sine.easeInOut");
      cam.zoomTo(1.6, 600);
      const posts = [lx, rx].map((x) => keep(sc.add.rectangle(x, floor + 4, 14, floor + 4 - barY, 0x111827).setOrigin(0.5, 1).setStrokeStyle(2, 0x374151).setDepth(D + 5).setScale(1, 0)));
      const bar = keep(sc.add.rectangle(tg.x, barY - 200, rx - lx + 14, 12, 0x111827).setStrokeStyle(2, 0x374151).setDepth(D + 5));
      synth.play("door");
      sc.tweens.add({ targets: posts, scaleY: 1, duration: 500, ease: "Quad.out" });
      await c.tw({ targets: bar, y: barY, duration: 500, ease: "Bounce.out" });
      synth.play("drone");
      const cuts = [0.22, 0.48, 0.74];
      const beam = async (x1: number, y1: number, x2: number, y2: number) => {
        const led = keep(sc.add.circle(x1, y1, 3, 0xef4444).setDepth(D + 6));
        sc.tweens.add({ targets: led, alpha: 0.2, yoyo: true, repeat: 2, duration: 70 });
        await c.wait(240);
        const g = keep(sc.add.graphics().setDepth(D + 6));
        const p = { t: 0 };
        synth.play("zap");
        await c.tw({ targets: p, t: 1, duration: 160, onUpdate: () => {
          const ex = x1 + (x2 - x1) * p.t;
          const ey = y1 + (y2 - y1) * p.t;
          g.clear().lineStyle(8, 0xef4444, 0.35).lineBetween(x1, y1, ex, ey).lineStyle(2, 0xfee2e2, 1).lineBetween(x1, y1, ex, ey);
        } });
        c.fx("vfx_sparks", (x1 + x2) / 2 - W * 0.3, (y1 + y2) / 2, 0.35, { add: true, tint: 0xff6060 });
        await c.tw({ targets: g, alpha: 0, duration: 260 });
        g.destroy();
        led.destroy();
      };
      for (const v of cuts) await beam(lx + 7, top + H * v, rx - 7, top + H * v);
      await beam(tg.x, barY + 6, tg.x, floor);
      await c.wait(500);
      let p = say("…Ha. Missed.");
      await c.wait(1300);
      p.destroy();
      p = say("Did I?", "#ffffff", "me");
      await c.wait(1100);
      p.destroy();
      // hairline seams
      const seams = keep(sc.add.graphics().setDepth(D + 4).setAlpha(0));
      seams.lineStyle(1.5, c.gore ? 0xdc2626 : 0x111111, 1);
      for (const v of cuts) seams.lineBetween(tg.x - W * 0.42, top + H * v, tg.x + W * 0.42, top + H * v);
      seams.lineBetween(tg.x, top + 2, tg.x, floor - 2);
      synth.play("ding");
      await c.tw({ targets: seams, alpha: 1, duration: 500 });
      await c.wait(600);
      if (c.gore) {
        seams.setVisible(false);
        body.setVisible(false);
        const rows = [0, ...cuts, 1];
        const pieces: { o: Phaser.GameObjects.Image; r: number; s: number }[] = [];
        for (let r = 0; r < 4; r++)
          for (let s = 0; s < 2; s++) pieces.push({ o: part(s * 0.5, rows[r], (s + 1) * 0.5, rows[r + 1], D + 3 + (3 - r) * 0.1), r, s });
        synth.play("squelch");
        // they slide apart along the cuts, the top first, slowly
        for (const { o, r, s } of pieces) {
          const side = o.x < tg.x ? -1 : 1;
          const dx = side * (3 + (3 - r) * 4) + (r % 2 ? 4 : -4);
          void s;
          sc.tweens.add({ targets: o, x: o.x + dx, y: o.y + 2, duration: 1100, delay: r * 220, ease: "Sine.in" });
        }
        for (const v of cuts) c.blood(tg.x, top + H * v, 6, 0.4);
        await c.wait(1500);
        synth.play("splat");
        for (const { o, r } of pieces) {
          const side = o.x < tg.x ? -1 : 1;
          toss(o, side * (40 + Math.random() * 80), -60 - (3 - r) * 30, floor - 6 - Math.random() * 10, side * (200 + Math.random() * 300));
        }
        c.blood(tg.x, tg.y, 60, 1.2, true);
        for (let i = 0; i < 3; i++) c.guts(tg.x, tg.y, -Math.PI / 2 + (i - 1) * 0.9, 80);
        card();
        await c.wait(2200);
      } else {
        body.setTint(0x6b7280);
        c.fx("vfx_smoke", tg.x, top + 6, Math.max(0.6, W / 80));
        synth.play("pfft");
        p = say("…oh.", "#d1d5db");
        await c.wait(800);
        p.destroy();
        card();
        await tameKO();
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ X-RAY (Mortal Kombat 9's X-ray moves: the bones break in an inset)
    case "xray": {
      cam.pan(tg.x - W * 0.1, tg.y, 500, "Sine.easeInOut");
      cam.zoomTo(1.7, 500);
      await c.wait(550);
      const kz = 1 / cam.zoom;
      const kinds = ["skull", "ribs", "spine"] as const;
      const bone = 0xe0f2fe;
      const edge = 0x67e8f9;
      const mkPanel = (kind: (typeof kinds)[number]) => {
        const pc = keep(sc.add.container(480 + 230 * kz, 270 - 40 * kz).setDepth(D + 40).setScale(0));
        const bg = sc.add.rectangle(0, 0, 240, 190, 0x020617, 0.94).setStrokeStyle(3, 0x22d3ee);
        const scan = sc.add.graphics();
        scan.lineStyle(1, 0x22d3ee, 0.1);
        for (let y = -92; y < 95; y += 6) scan.lineBetween(-118, y, 118, y);
        const head = sc.add.text(-112, -90, "X-RAY", { fontFamily: "monospace", fontSize: "12px", color: "#22d3ee" });
        const a = sc.add.container(0, 0);
        const b = sc.add.container(0, 0);
        const ga = sc.add.graphics();
        const gb = sc.add.graphics();
        a.add(ga);
        b.add(gb);
        for (const g of [ga, gb]) g.fillStyle(bone, 1).lineStyle(2, edge, 1);
        if (kind === "skull") {
          ga.fillCircle(0, -18, 44).strokeCircle(0, -18, 44);
          ga.fillStyle(0x020617, 1).fillCircle(-16, -18, 10).fillCircle(16, -18, 10).fillTriangle(-5, 4, 5, 4, 0, -6);
          gb.fillRoundedRect(-30, 26, 60, 20, 6).strokeRoundedRect(-30, 26, 60, 20, 6);
          gb.fillStyle(0x020617, 1);
          for (let i = 0; i < 6; i++) gb.fillRect(-24 + i * 9, 26, 2, 7);
        } else if (kind === "ribs") {
          ga.fillRect(-5, -70, 10, 130);
          for (let i = 0; i < 5; i++) {
            ga.lineStyle(7, bone, 1).beginPath().arc(-6, -50 + i * 24, 70, Math.PI * 0.95, Math.PI * 1.25, false).strokePath();
            gb.lineStyle(7, bone, 1).beginPath().arc(6, -50 + i * 24, 70, Math.PI * 1.75, Math.PI * 2.05, false).strokePath();
          }
        } else {
          for (let i = 0; i < 8; i++) {
            const g = i < 4 ? ga : gb;
            const y = -78 + i * 21;
            g.fillStyle(bone, 1).fillRoundedRect(-16, y, 32, 15, 4).strokeRoundedRect(-16, y, 32, 15, 4);
            g.fillRect(-26, y + 5, 10, 5).fillRect(16, y + 5, 10, 5);
          }
        }
        const crack = sc.add.graphics();
        // their silhouette, faint, behind the bones
        const ghost = sc.add.image(0, 0, T.key, T.frame).setFlipX(T.flip).setTint(0x0e7490).setAlpha(0.35);
        ghost.setScale(1);
        const gk = 170 / Math.max(1, ghost.displayHeight);
        ghost.setScale(gk);
        ghost.y = -(((f.v0 + f.v1) / 2 - 0.5) * ghost.displayHeight) + (kind === "skull" ? 60 : kind === "ribs" ? 10 : -20);
        pc.add([bg, scan, ghost, head, a, b, crack]);
        pc.setScrollFactor(0, 0, true);
        return { pc, a, b, crack };
      };
      const hitYs = [top + H * 0.15, top + H * 0.42, top + H * 0.62];
      const homeX = c.me.x;
      for (let i = 0; i < 3; i++) {
        await c.tw({ targets: c.me, x: homeX - 18, duration: 180, ease: "Quad.out" });
        await c.tw({ targets: c.me, x: homeX + 22, duration: 80, ease: "Quad.in" });
        synth.play("punch_big");
        c.fx("vfx_hit", tg.x - W * 0.3, hitYs[i], 0.9, { depth: D + 7 });
        cam.shake(150, 0.01);
        body.setTint(0xffb0b0);
        sc.tweens.add({ targets: body, x: T.x + 8, duration: 80 });
        const P = mkPanel(kinds[i]);
        await c.tw({ targets: P.pc, scale: kz, duration: 160, ease: "Back.out" });
        await c.wait(200);
        // the crack runs across the bone
        const cp = { t: 0 };
        synth.play("bonecrack");
        await c.tw({ targets: cp, t: 1, duration: 220, onUpdate: () => {
          P.crack.clear().lineStyle(3, 0x020617, 1);
          let x = -60;
          let y = i === 0 ? 20 : i === 1 ? -20 : 4;
          for (let s = 0; s < 8 * cp.t; s++) {
            const nx = x + 15;
            const ny = y + (s % 2 ? 7 : -7);
            P.crack.lineBetween(x, y, nx, ny);
            x = nx;
            y = ny;
          }
        } });
        if (c.gore) {
          synth.play("bonecrack");
          P.crack.setVisible(false);
          const [da, db] = i === 0 ? [[-6, -6, -10], [10, 22, 28]] : i === 1 ? [[-14, 4, -14], [14, 4, 14]] : [[16, -6, 18], [-12, 8, -14]];
          sc.tweens.add({ targets: P.a, x: da[0], y: da[1], angle: da[2], duration: 220, ease: "Back.out" });
          sc.tweens.add({ targets: P.b, x: db[0], y: db[1], angle: db[2], duration: 220, ease: "Back.out" });
          for (let k = 0; k < 7; k++) {
            const f = sc.add.rectangle(0, i === 0 ? 20 : 0, 3 + Math.random() * 5, 3 + Math.random() * 4, bone).setScrollFactor(0);
            P.pc.add(f);
            sc.tweens.add({ targets: f, x: (Math.random() - 0.5) * 180, y: (Math.random() - 0.3) * 140, angle: 400, alpha: 0.3, duration: 500 });
          }
          for (let k = 0; k < 5; k++) {
            const bl = sc.add.circle((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 100, 3, 0xdc2626, 0.85).setScrollFactor(0);
            P.pc.add(bl);
            sc.tweens.add({ targets: bl, radius: 8 + Math.random() * 10, duration: 300 });
          }
          const ck = sc.add.text(0, 70, "CRACK!", { fontFamily: "Impact, sans-serif", fontSize: "24px", color: "#ef4444", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0);
          P.pc.add(ck);
          c.blood(tg.x - W * 0.2, hitYs[i], 14, 0.8);
        } else {
          synth.play("wonk");
          sc.tweens.add({ targets: [P.a, P.b], angle: { from: -8, to: 8 }, yoyo: true, repeat: 3, duration: 70 });
          const bo = sc.add.text(0, 70, "BOINNG", { fontFamily: "Impact, sans-serif", fontSize: "24px", color: "#fde047", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0);
          P.pc.add(bo);
        }
        synth.voice("oh", 0.6, 1.3 + i * 0.3);
        await c.wait(800);
        await c.tw({ targets: P.pc, scaleY: 0, duration: 120 });
        P.pc.setVisible(false);
        body.clearTint();
        sc.tweens.add({ targets: c.me, x: homeX, duration: 200 });
        await c.wait(220);
      }
      card();
      if (c.gore) {
        // the body has nothing left to hold it up
        synth.play("bonecrack");
        sc.tweens.add({ targets: body, y: T.y + H * 0.2, angle: tg.flip ? -10 : 10, duration: 300, ease: "Quad.in" });
        await scaleTo(body, [T.scale, T.scale], [T.scale, T.scale * 0.6], { duration: 300 });
        await fall(body, 500);
        synth.play("bodies_land");
        c.blood(tg.x, floor - 4, 30, 0.8);
        await c.wait(1500);
      } else {
        await tameKO();
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ HEAD CLEAN OFF (the slow-motion draw-cut)
    case "decap": {
      const neckV = 0.3;
      const nY = top + H * neckV;
      cam.pan(tg.x, tg.y - H * 0.15, 500, "Sine.easeInOut");
      cam.zoomTo(1.8, 500);
      const Lb = Math.max(50, H * 0.55);
      const sword = keep(sc.add.container(c.me.x + 10, c.me.y - 4).setDepth(D + 6));
      const sg = sc.add.graphics();
      sg.fillStyle(0x7c2d12, 1).fillRect(-2, 0, 4, 12);
      sg.fillStyle(0xfacc15, 1).fillRect(-8, -3, 16, 4);
      sg.fillStyle(0xd1d5db, 1).fillRect(-2.5, -Lb, 5, Lb - 3);
      sg.fillStyle(0xffffff, 1).fillRect(-0.5, -Lb, 1.5, Lb - 3);
      sg.fillStyle(0xd1d5db, 1).fillTriangle(-2.5, -Lb, 2.5, -Lb, 2.5, -Lb - 8);
      sword.add(sg);
      sword.setAngle(20).setScale(1, 0);
      synth.play("swing2");
      await c.tw({ targets: sword, scaleY: 1, duration: 400, ease: "Quad.out" });
      const glint = sc.add.star(0, 0, 4, 2, 8, 0xffffff);
      sword.add(glint);
      synth.play("ding");
      await c.tw({ targets: glint, y: -Lb, duration: 300, angle: 180 });
      glint.destroy();
      // the wind-up: crouch, blade back
      sc.tweens.add({ targets: sword, angle: -70, duration: 400, ease: "Quad.out" });
      sc.tweens.add({ targets: c.me, y: c.me.y + 4, duration: 400 });
      await scaleTo(c.me, [c.ps, c.ps], [c.ps, c.ps * 0.85], { duration: 400 });
      synth.play("telegraph");
      await c.wait(600);
      // the draw-cut: you're past them before anyone sees it
      const endX = tg.x + W * 0.5 + 40;
      synth.play("swing3");
      const arc = keep(sc.add.graphics().setDepth(D + 8));
      arc.lineStyle(6, 0xffffff, 1).lineBetween(tg.x - W * 0.6, nY + 6, tg.x + W * 0.6, nY - 6);
      arc.lineStyle(2, 0xbae6fd, 0.7).lineBetween(tg.x - W * 0.7, nY + 12, tg.x + W * 0.7, nY - 2);
      sc.tweens.add({ targets: arc, alpha: 0, duration: 500 });
      sc.tweens.add({ targets: sword, x: endX + 12, angle: 110, duration: 90 });
      c.me.setScale(c.ps);
      await c.tw({ targets: c.me, x: endX, y: c.me.y - 4, duration: 90 });
      synth.play("crit");
      c.flash();
      // stillness
      await c.wait(900);
      const line = keep(sc.add.rectangle(tg.x, nY, W * 0.5, 1.5, c.gore ? 0xdc2626 : 0x000000, 1).setDepth(D + 4).setAlpha(0));
      if (c.gore) sc.tweens.add({ targets: line, alpha: 1, duration: 400 });
      // the sheath
      sc.tweens.add({ targets: sword, angle: 0, duration: 300 });
      await c.tw({ targets: sword, scaleY: 0, delay: 300, duration: 250 });
      synth.play("tap");
      await c.wait(450);
      if (c.gore) {
        line.setVisible(false);
        const cut = neckV + 0.02;
        const head = part(0, 0, 1, cut, D + 5);
        cropAbove(cut);
        c.slow(0.22);
        synth.play("squelch");
        synth.voice("oh", 0.6, 0.45);
        // the head goes up, turning over and over, a ribbon of blood behind it
        toss(head, tg.flip ? 90 : -90, -330, floor - head.displayHeight * 0.35, -720, () => {
          synth.play("splat");
          c.blood(head.x, floor - 6, 30, 1);
          sc.tweens.add({ targets: head, x: head.x - 24, angle: head.angle - 200, duration: 500, ease: "Quad.out" });
        });
        let n = 0;
        const ribbon = sc.time.addEvent({ delay: 35, loop: true, callback: () => {
          if (n++ > 50) return ribbon.remove();
          const d = keep(sc.add.circle(head.x, head.y + head.displayHeight * 0.3, 2 + Math.random() * 2.5, 0xb91c1c).setDepth(D + 4));
          toss(d, (Math.random() - 0.5) * 20, 0, floor - Math.random() * 6, 0, () => d.setScale(2, 0.7));
        } });
        c.fountain(tg.x, nY, 3200);
        await c.wait(420);
        c.slow(1);
        ribbon.remove();
        card();
        await c.wait(900);
        await c.tw({ targets: body, y: body.y + H * 0.08, duration: 300, ease: "Quad.in" });
        await fall(body, 600);
        synth.play("bodies_land");
        c.blood(tg.x + W * 0.4, floor - 4, 30, 0.8);
        await c.wait(1500);
      } else {
        // just one hair comes down. Then they faint.
        const hair = keep(sc.add.rectangle(tg.x, top + 2, 1.5, 6, 0x1f1206).setDepth(D + 6));
        c.slow(0.3);
        await c.tw({ targets: hair, y: top + H * 0.3, x: hair.x + 10, angle: 120, duration: 600, ease: "Sine.inOut" });
        c.slow(1);
        const p = say("…", "#ffffff");
        await c.wait(800);
        p.destroy();
        card();
        await tameKO();
        await c.wait(1000);
      }
      break;
    }
  }
  c.slow(1);
  if (cardBits.length) await c.tw({ targets: cardBits, alpha: 0, duration: 250 });
}

import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { voice } from "../audio/Voice";
import type { KrelTarget } from "./Kreltality";
import { bit, prop, type Actor, type Bit } from "./KrelArt";

/**
 * The choreographed Kreltalities: wind-up, a slow-motion beat, the impact, the aftermath. Mortal Kombat's
 * fatalities and the Saw films' traps, done as a cartoon. Each has a tame version for when gore is off
 * (no blood, nothing comes off: they just get a fright and keel over with stars round their head).
 */

export type Elegant = "jawtrap" | "pendulum" | "ribcage" | "freeze" | "kebab" | "lasergrid" | "xray" | "decap" | "pump" | "cinder" | "piranha" | "asbestos";
/** Finishers only for bosses (and only with gore on): GET WELL SOON has a cancer-ward sprite per boss. */
export const BOSS_ONLY: Elegant[] = ["asbestos"];
export const ELEGANT: Elegant[] = ["jawtrap", "pendulum", "ribcage", "freeze", "kebab", "lasergrid", "xray", "decap", "pump", "cinder", "piranha", "asbestos"];
export const ELEGANT_NAMES: Record<Elegant, string> = {
  jawtrap: "REVERSE BEAR TRAP!",
  pendulum: "THE PENDULUM!",
  ribcage: "OPEN HEART SURGERY!",
  freeze: "DEEP FREEZE!",
  kebab: "DONER KEBAB'D!",
  lasergrid: "DICED!",
  xray: "X-RAY!",
  decap: "HEAD CLEAN OFF!",
  pump: "FILL HER UP!",
  cinder: "CINDER BLOCK'D!",
  piranha: "PIRANHA POOL!",
  asbestos: "GET WELL SOON!",
};
export const TAME_NAMES: Record<Elegant, string> = {
  jawtrap: "SPRUNG!",
  pendulum: "BONK!",
  ribcage: "HEART STOLEN!",
  freeze: "DEEP FREEZE!",
  kebab: "ROTISSERIED!",
  lasergrid: "SINGED!",
  xray: "X-RAY!",
  decap: "SCARED STIFF!",
  pump: "PUMPED!",
  cinder: "BONKED!",
  piranha: "NIBBLED!",
  asbestos: "GET WELL SOON!",
};

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

/** Everything a finisher needs from the stage (Kreltality.ts builds it). */
export interface KrelCtx {
  sc: Phaser.Scene;
  cam: Phaser.Cameras.Scene2D.Camera;
  tg: KrelTarget;
  body: Phaser.GameObjects.Image;
  me: Phaser.GameObjects.Sprite;
  /** the lad's drawn actions (KrelArt.ts): play("katana"), play("pull"), cheer()… */
  act: Actor;
  /** drawn organs and offcuts flung out from (x, y) (gore only) */
  organs(x: number, y: number, n: number, kinds?: Bit[], spread?: number): void;
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

/** The heart monitor's screen in the drawn ward (kp_ward), as fractions of the picture: centre, size. */
const KP_WARD_SCREEN = { x: 0.9156, y: 0.505, w: 0.06, h: 0.075 };

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
  const act = c.act;
  /** a drawn prop (KrelArt.prop), kept for tidying; null if the art isn't loaded */
  const img = (key: string, x: number, y: number, o: Parameters<typeof prop>[4] = {}) => {
    const im = prop(sc, key, x, y, o);
    return im ? keep(im) : null;
  };
  /** a drawn piece off the gore/bits sheet, kept for tidying */
  const bitk = (b: Bit, x: number, y: number, size: number, depth = D + 6) => {
    const s = bit(sc, b, x, y, size, depth);
    return s ? keep(s) : null;
  };

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
    // drawn cartoon stars (the bits sheet), circling the head
    const stars: Phaser.GameObjects.Components.Transform[] = [0, 1, 2].map(() => bitk("star", o.x, o.y, 9, D + 9) ?? keep(sc.add.text(o.x, o.y, "★", { fontFamily: "Arial", fontSize: "18px", color: "#fde047", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 9).setScale(1 / cam.zoom)));
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
      // the drawn trap (PixelLab): rusty, strapped round the head, jaws shut until it springs, a timer box on the side
      const drawnTrap = sc.textures.exists("kp_trap") && sc.textures.exists("kp_trap_shut");
      let trapImg: Phaser.GameObjects.Image | null = null;
      let box: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
      let timer: Phaser.GameObjects.Text;
      if (drawnTrap) {
        trapImg = sc.add.image(0, -hh * 0.22, "kp_trap_shut");
        const tk = (hw * 1.2) / trapImg.frame.width;
        trapImg.setScale(tk);
        // the timer box sits low on the trap's left: the readout goes over it
        const bx = -trapImg.displayWidth * 0.2;
        const by = trapImg.y + trapImg.displayHeight * 0.33;
        timer = sc.add.text(bx, by, "0:05", { fontFamily: "monospace", fontSize: "12px", color: "#ef4444", fontStyle: "bold", backgroundColor: "#111111" }).setOrigin(0.5).setScale(Math.max(0.35, tk * 1.4));
        box = timer;
        dev.add([trapImg, timer]);
      } else {
        const strap = sc.add.rectangle(0, 0, hw * 0.95, 6, 0x3f3f46).setStrokeStyle(1, 0x111111);
        const plate = sc.add.rectangle(0, hh * 0.5, hw * 0.85, 8, steel).setStrokeStyle(2, dark);
        box = sc.add.rectangle(0, hh * 0.66, 36, 17, 0x111827).setStrokeStyle(2, 0x6b7280);
        timer = sc.add.text(0, hh * 0.66, "0:05", { fontFamily: "monospace", fontSize: "12px", color: "#ef4444", fontStyle: "bold" }).setOrigin(0.5);
        dev.add([strap, plate, armL, armR, box, timer]);
      }
      // strapped into a chair, wrists and chest, like the end of the last film
      const chairX = tg.x;
      const seatY = top + H * 0.62;
      const chair = keep(sc.add.container(0, 0).setDepth(D - 1));
      const straps = keep(sc.add.container(0, 0).setDepth(D + 2));
      const chairArt = prop(sc, "kp_chair", chairX, floor + 4, { h: H * 1.08, oy: 1 });
      if (chairArt) chair.add(chairArt);
      else {
        chair.add(sc.add.rectangle(chairX, top + H * 0.36, W * 0.95, H * 0.56, 0x3b2a1e).setStrokeStyle(3, 0x1c130c));
        chair.add(sc.add.rectangle(chairX, seatY, W * 1.25, 10, 0x4a3424).setStrokeStyle(2, 0x1c130c));
        chair.add(sc.add.rectangle(chairX - W * 0.55, seatY + H * 0.2, 7, H * 0.4, 0x2b1d13));
        chair.add(sc.add.rectangle(chairX + W * 0.55, seatY + H * 0.2, 7, H * 0.4, 0x2b1d13));
        for (const [y, w] of [[top + H * 0.38, W * 0.9], [top + H * 0.55, W * 1.1]] as [number, number][]) straps.add(sc.add.rectangle(chairX, y, w, 5, 0x18181b).setStrokeStyle(1, 0x52525b));
      }
      chair.setAlpha(0);
      straps.setAlpha(0);
      sc.tweens.add({ targets: [chair, straps], alpha: 1, duration: 250 });
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
      // and you've got the remote
      void act.play("det", { hold: true });
      p = say("Why's it ticking?", "#fecaca");
      for (let n = 5; n >= 1; n--) {
        timer.setText(`0:0${n}`);
        synth.play("tap");
        synth.voice("oh", 0.45, 1 + (5 - n) * 0.25);
        sc.tweens.add({ targets: box, scale: box.scale * 1.3, yoyo: true, duration: 70 });
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
      act.idle();
      if (trapImg) {
        // SNAP: the jaws fly open
        const k0 = trapImg.scaleX;
        trapImg.setTexture("kp_trap").setScale((hw * 1.3) / trapImg.frame.width);
        trapImg.y = -hh * 0.3;
        sc.tweens.add({ targets: trapImg, scale: { from: k0 * 1.25, to: trapImg.scaleX }, duration: 160, ease: "Back.out" });
      }
      if (c.gore) {
        // the jaws spring: top of the head wrenched up and back, the lower jaw torn down
        const upper = part(0, 0, 1, 0.13, D + 5);
        const jaw = part(0, 0.13, 1, 0.21, D + 5);
        cropAbove(0.21);
        synth.play("bonecrack");
        synth.play("splat");
        c.flash();
        cam.shake(420, 0.02);
        const back = tg.flip ? 1 : -1;
        sc.tweens.add({ targets: upper, y: upper.y - H * 0.09, angle: back * 32, duration: 170, ease: "Quad.out" });
        sc.tweens.add({ targets: jaw, y: jaw.y + H * 0.05, angle: -back * 14, duration: 170, ease: "Quad.out" });
        const mouthY = top + H * 0.15;
        c.blood(tg.x, mouthY, 46, 1.2, true);
        c.blood(tg.x, mouthY, 22, 0.9);
        c.fountain(tg.x, mouthY, 1500);
        // the body jerks against the straps
        sc.tweens.add({ targets: body, x: { from: T.x - 4, to: T.x + 4 }, yoyo: true, repeat: 5, duration: 35 });
        await c.wait(900);
        c.slow(1);
        // and slumps in the chair, the open trap still on, blood running down
        const slump = { targets: [body, upper, jaw, dev], y: `+=${Math.round(H * 0.05)}`, angle: `+=${tg.flip ? -6 : 6}`, duration: 900, ease: "Sine.inOut" };
        sc.tweens.add(slump as Phaser.Types.Tweens.TweenBuilderConfig);
        const drip = sc.time.addEvent({ delay: 260, repeat: 10, callback: () => c.blood(tg.x + (Math.random() - 0.5) * W * 0.3, mouthY + H * 0.1, 4, 0.4) });
        await c.wait(1000);
        // the trap lets go and drops off: the jaw is split wide open underneath
        const dy = Math.round(H * 0.05);
        sc.tweens.killTweensOf(dev);
        synth.play("smash");
        void c.tw({ targets: dev, y: floor - hh * 0.25, x: dev.x + (tg.flip ? -1 : 1) * W * 0.45, angle: (tg.flip ? -1 : 1) * 110, duration: 520, ease: "Quad.in" }).then(() => {
          synth.play("smash");
          cam.shake(160, 0.008);
        });
        const mx = tg.x;
        const my = mouthY + dy;
        const mw = Math.max(24, W * 0.55);
        const mh = Math.max(20, H * 0.17);
        // drawn: the torn-open mouth, teeth wrenched apart, the tongue lolling out
        const drawnWound = img("kp_wound_mouth", mx, my + mh * 0.35, { w: mw * 0.95, depth: D + 4 });
        if (drawnWound) {
          drawnWound.setAlpha(0);
          sc.tweens.add({ targets: drawnWound, alpha: 1, duration: 140 });
          const k1 = drawnWound.scaleY;
          sc.tweens.add({ targets: drawnWound, scaleY: { from: k1 * 0.4, to: k1 }, duration: 700, ease: "Bounce.out" });
        }
        const wound = keep(sc.add.graphics().setDepth(D + 4).setVisible(!drawnWound));
        // torn flesh round the edge, then the dark gullet going down
        wound.fillStyle(0x7f1d1d, 1).fillEllipse(mx, my, mw * 1.15, mh * 1.25);
        wound.fillStyle(0x450a0a, 1).fillEllipse(mx, my, mw, mh);
        wound.fillStyle(0x1a0303, 1).fillEllipse(mx, my + mh * 0.08, mw * 0.55, mh * 0.62);
        wound.fillStyle(0x000000, 1).fillEllipse(mx, my + mh * 0.14, mw * 0.28, mh * 0.34);
        // the throat: ridged, wet
        wound.lineStyle(1.5, 0x9f1239, 0.9);
        for (let i = 1; i <= 3; i++) wound.strokeEllipse(mx, my + mh * 0.12, mw * (0.28 + i * 0.09), mh * (0.3 + i * 0.1));
        // both rows of teeth, wrenched apart
        wound.fillStyle(0xf5f0e1, 1);
        for (let i = 0; i < 8; i++) {
          const tx = mx - mw * 0.4 + (i * mw * 0.8) / 7;
          wound.fillTriangle(tx - 3, my - mh * 0.5, tx + 3, my - mh * 0.5, tx, my - mh * 0.22);
          wound.fillTriangle(tx - 3, my + mh * 0.5, tx + 3, my + mh * 0.5, tx, my + mh * 0.24);
        }
        // the tongue, lolling out over the lower teeth
        const tongue = keep(sc.add.graphics().setDepth(D + 6).setVisible(!drawnWound));
        tongue.fillStyle(0xf472b6, 1).fillEllipse(mx + mw * 0.05, my + mh * 0.42, mw * 0.36, mh * 0.75);
        tongue.fillStyle(0xdb2777, 1).fillRect(mx + mw * 0.05 - 1, my + mh * 0.18, 2, mh * 0.55);
        tongue.setScale(1, 0.2);
        wound.setAlpha(0);
        sc.tweens.add({ targets: wound, alpha: 1, duration: 140 });
        sc.tweens.add({ targets: tongue, scaleY: 1, duration: 700, ease: "Bounce.out", delay: 150 });
        synth.play("squelch");
        c.blood(mx, my + mh * 0.4, 18, 0.5);
        // the last shot: a slow push in on the open jaw, then hold
        cam.pan(mx, my, 1600, "Sine.easeInOut");
        cam.zoomTo(3.2, 2200, "Sine.easeInOut");
        await c.wait(1900);
        card();
        await c.wait(1600);
        drip.remove();
      } else {
        synth.play("wonk");
        const boing = keep(sc.add.text(tg.x, top - 20, "BOING!", { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#fde047", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(D + 10).setScale(0.5 / cam.zoom));
        sc.tweens.add({ targets: boing, scale: 1.1 / cam.zoom, duration: 200, ease: "Back.out" });
        await c.wait(400);
        c.slow(1);
        toss(dev, 60, -380, floor - hh * 0.3, 400, () => synth.play("smash"));
        straps.destroy();
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
      // drawn (PixelLab): a crescent blade on an iron shaft, hung on a chain that pays out a little each swing
      const drawnPend = sc.textures.exists("kp_pendulum") && sc.textures.exists("kp_chain");
      const pendImg = drawnPend ? sc.add.image(0, 0, "kp_pendulum").setOrigin(0.5, 1) : null;
      if (pendImg) pendImg.setScale((R * 2) / pendImg.frame.width);
      const pendH = pendImg ? pendImg.displayHeight * 0.92 : R;
      const rod = drawnPend ? sc.add.tileSprite(0, 0, 12, 1, "kp_chain").setOrigin(0.5, 0) : sc.add.rectangle(0, 0, 6, 1, 0x4b5563).setOrigin(0.5, 0);
      if (rod instanceof Phaser.GameObjects.TileSprite) {
        const ck = 12 / rod.frame.width;
        rod.setTileScale(ck, ck);
      }
      const blade = sc.add.graphics();
      const drawBlade = (bloody: boolean) => {
        if (pendImg) {
          if (bloody && sc.textures.exists("kp_pendulum_bloody")) pendImg.setTexture("kp_pendulum_bloody");
          return;
        }
        blade.clear();
        blade.fillStyle(0x9ca3af, 1).slice(0, -R, R, 0, Math.PI, false).fillPath();
        blade.fillStyle(0x4b5563, 1).slice(0, -R, R * 0.55, 0, Math.PI, false).fillPath();
        blade.lineStyle(3, bloody ? 0xb91c1c : 0xf8fafc, 1).beginPath().arc(0, -R, R - 2, 0.12, Math.PI - 0.12, false).strokePath();
        blade.fillStyle(0x111827, 1).fillRect(-R, -R - 4, R * 2, 6);
        if (bloody) blade.fillStyle(0xb91c1c, 0.9).fillRect(-R * 0.4, -R * 0.15, 4, R * 0.25).fillRect(R * 0.2, -R * 0.1, 4, R * 0.3);
      };
      drawBlade(false);
      const bladeC = sc.add.container(0, 0, pendImg ? [pendImg] : [blade]);
      arm.add([rod, bladeC, sc.add.circle(0, 0, 9, 0x374151).setStrokeStyle(2, 0x000000).setVisible(!drawnPend)]);
      const levels = [top - 90, top - 50, top - 6, c.gore ? waistY : top + H * 0.14];
      const st = { L: levels[0] - pivY - 60 };
      const place = () => {
        if (rod instanceof Phaser.GameObjects.TileSprite) rod.setSize(12, Math.max(1, st.L - pendH));
        else rod.scaleY = Math.max(1, st.L - R);
        bladeC.y = st.L;
      };
      // the lever that lets it down, by you
      const lever = img("kp_lever", c.me.x + 16, floor + 2, { h: H * 0.32, oy: 1, depth: D + 2 });
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
        // a yank on the lever, and down it comes another notch
        void act.play("pull", { fps: 20 });
        if (lever) sc.tweens.add({ targets: lever, scaleY: lever.scaleY * 0.85, yoyo: true, duration: 160, delay: 180 });
        sc.tweens.add({ targets: st, L: levels[k] - pivY, duration: 320, ease: "Quad.out", onUpdate: place });
        sc.time.delayedCall(dur * 0.42, () => synth.play("swing"));
        // a glint on the edge as it comes down
        const glb = bit(sc, "star", 0, 0, 12);
        const gl = glb ? glb.setTintFill(0xffffff) : sc.add.star(0, st.L, 4, 2, 9, 0xffffff);
        const glk = glb ? 12 / 32 : 1;
        bladeC.add(gl);
        gl.setPosition(pendImg ? R * 0.6 : 0, pendImg ? -R * 0.3 : 0).setScale(0);
        sc.tweens.add({ targets: gl, scale: glk, angle: 90, yoyo: true, duration: 140, delay: dur * 0.3 });
        if (k === 2)
          sc.time.delayedCall(dur * 0.5, () => {
            // a skim off the top: a few hairs come down
            for (let i = 0; i < 6; i++) {
              const hx = tg.x + (Math.random() - 0.5) * W * 0.4;
              const hr = bitk("hair", hx, top + 2, 8) ?? keep(sc.add.rectangle(hx, top + 2, 1.5, 5, 0x1f1206).setDepth(D + 6));
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
            c.fx("vfx_shock", tg.x, waistY, Math.max(0.6, W / 110), { add: true, depth: D + 6 });
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
        c.organs(tg.x, waistY, 5, ["gutrope", "guts", "kidney", "liver", "shred"], 0.5);
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
      // drawn (PixelLab): the open chest, lungs and breastbone (pink and tidy with gore off)
      const cavArt = prop(sc, "kp_cavity", lx, ly, { w: cw, h: ch });
      if (cavArt) {
        if (!c.gore) cavArt.setTint(0xffc8e4);
        cavArt.setVisible(false);
        r.add(cavArt);
      } else if (c.gore) {
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
      // drawn: a real (cartoon) heart with gore on, a pink love-heart with it off
      const hArt = bit(sc, c.gore ? "heart" : "love", 0, 0, 26);
      if (hArt) heart.add(hArt);
      else {
        const hg = sc.add.graphics();
        const hc = c.gore ? 0xdc2626 : 0xf472b6;
        hg.fillStyle(c.gore ? 0x9f1239 : 0xec4899, 1).fillRect(-2, -14, 4, 8);
        hg.fillStyle(hc, 1).fillCircle(-5, -3, 6).fillCircle(5, -3, 6).fillTriangle(-10.6, -1, 10.6, -1, 0, 12);
        hg.fillStyle(0xffffff, 0.5).fillCircle(-6, -5, 2);
        if (!c.gore) hg.lineStyle(1, 0xffffff, 0.9).lineBetween(-6, 2, 6, 2).lineBetween(-3, 6, 3, 6);
        heart.add(hg);
      }
      // the doors: the front of the chest, hinged at each side
      const mkDoor = (a: number, b: number) => {
        const img = part(a, v0, b, v1);
        const isLeft = img.x < tg.x;
        const hingeX = lx + (isLeft ? -cw / 2 : cw / 2);
        const door = sc.add.container(hingeX, ly);
        const ix = img.x - T.x - hingeX;
        img.setPosition(ix, 0);
        const dw = img.displayWidth;
        const dh = img.displayHeight;
        // the inside of the door: drawn ribs with the meat on (PixelLab), pink with gore off
        const ribArt = prop(sc, "kp_ribrack", ix, 0, { w: dw, h: dh });
        let inner: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
        if (ribArt) {
          inner = ribArt.setVisible(false).setFlipX(!isLeft);
          if (!c.gore) ribArt.setTint(0xffc8e4);
        } else {
          const g = sc.add.graphics().setVisible(false);
          g.fillStyle(c.gore ? 0x9f1239 : 0xf9a8d4, 1).fillRect(ix - dw / 2, -dh / 2, dw, dh);
          g.lineStyle(c.gore ? 3 : 1, c.gore ? 0xf5ecd7 : 0xffffff, 1);
          for (let i = 0; i < 4; i++) g.lineBetween(ix - dw / 2 + 2, -dh / 2 + dh * (0.15 + i * 0.23), ix + dw / 2 - 2, -dh / 2 + dh * (0.2 + i * 0.23));
          inner = g;
        }
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
      cav.setVisible(!cavArt);
      cavArt?.setVisible(true);
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
      // his hand goes in, closes round it, and holds it up high (krelact rip row)
      void act.play("rip", { frames: [0, 5], hold: true, fps: 10 });
      const hx = c.me.x + 12;
      const hy = c.me.y - c.me.displayHeight * (act.sheet ? 0.42 : 0.2);
      await c.tw({ targets: heart, x: hx, y: hy, duration: 700, ease: "Quad.inOut", onUpdate: () => {
        vessel.clear().lineStyle(3 * hs * 0.6, c.gore ? 0x9f1239 : 0xec4899, 1).lineBetween(tg.x, cy, heart.x, heart.y);
      } });
      vessel.destroy();
      void act.play("rip", { frames: [6, 8], hold: true, fps: 10 });
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
          const lx2 = tg.x + (Math.random() - 0.5) * W * 0.5;
          const lv = bitk("love", lx2, top, 10, D + 9) ?? keep(sc.add.text(lx2, top, "♥", { fontFamily: "Arial", fontSize: "16px", color: "#f472b6", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 9).setScale(1 / cam.zoom));
          sc.tweens.add({ targets: lv, y: lv.y - 60, alpha: 0, duration: 1400, delay: i * 150 });
        }
        card();
        await tameKO(r);
        await c.wait(1000);
      }
      break;
    }

    // ------------------------------------------------------------ DEEP FREEZE (Sub-Zero)
    // ------------------------------------------------------------ FILL HER UP (a petrol pump in the gob)
    case "pump": {
      const mouthX = tg.x;
      const mouthY = top + H * 0.17;
      // the pump stands on the far side of them from you, so the hose comes in from behind
      const away = tg.x >= c.me.x ? 1 : -1;
      const side = -away;
      const px = tg.x + away * (W * 0.75 + 46);
      const pump = keep(sc.add.container(px, floor + 140).setDepth(D + 2));
      // drawn (PixelLab): a red 4-star pump, the litres ticking over on its little screen
      const pumpArt = prop(sc, "kp_pump", 0, 0, { h: 120, oy: 1, flip: away < 0 });
      let readout: Phaser.GameObjects.Text;
      if (pumpArt) {
        pump.add(pumpArt);
        readout = sc.add.text((away < 0 ? 1 : -1) * pumpArt.displayWidth * 0.07, -120 * 0.79, "0.0L", { fontFamily: "monospace", fontSize: "11px", color: "#86efac", fontStyle: "bold", backgroundColor: "#0b1220" }).setOrigin(0.5).setScale(0.75);
        pump.add(readout);
      } else {
        pump.add(sc.add.rectangle(0, 0, 54, 120, 0xdc2626).setOrigin(0.5, 1).setStrokeStyle(3, 0x450a0a));
        pump.add(sc.add.rectangle(0, -96, 40, 30, 0x111827).setStrokeStyle(2, 0x9ca3af));
        readout = sc.add.text(0, -96, "0.0L", { fontFamily: "monospace", fontSize: "11px", color: "#86efac", fontStyle: "bold" }).setOrigin(0.5);
        pump.add(readout);
        pump.add(sc.add.text(0, -58, "4-STAR", { fontFamily: "Impact, sans-serif", fontSize: "10px", color: "#fde047" }).setOrigin(0.5));
      }
      cam.pan(tg.x - side * W * 0.3, tg.y, 600, "Sine.easeInOut");
      cam.zoomTo(1.8, 600);
      synth.play("telegraph");
      await c.tw({ targets: pump, y: floor, duration: 500, ease: "Back.out" });
      // the hose: from the pump to the nozzle, wherever the nozzle is
      const nozzle = keep(sc.add.container(px, floor - 70).setDepth(D + 6));
      // drawn nozzle, spout towards the mouth
      const nozArt = prop(sc, "kp_nozzle", 0, 0, { w: 30, flip: side < 0 });
      if (nozArt) nozzle.add(nozArt);
      else {
        nozzle.add(sc.add.rectangle(0, 0, 26, 10, 0x1f2937).setStrokeStyle(2, 0x9ca3af));
        nozzle.add(sc.add.rectangle(side * -16, 0, 14, 4, 0x9ca3af));
      }
      const hose = keep(sc.add.graphics().setDepth(D + 5));
      const drawHose = () => {
        // a rubber hose: black, a dull sheen along the top
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(px, floor - 60), new Phaser.Math.Vector2((px + nozzle.x) / 2, floor + 10), new Phaser.Math.Vector2(nozzle.x + side * 10, nozzle.y + 3));
        hose.clear().lineStyle(6, 0x0a0a0a, 1);
        curve.draw(hose, 24);
        hose.lineStyle(1.5, 0x4b5563, 1);
        hose.translateCanvas(0, -1.5);
        curve.draw(hose, 24);
        hose.translateCanvas(0, 1.5);
      };
      const hoseEv = sc.time.addEvent({ delay: 16, loop: true, callback: drawHose });
      let p = say("Fill her up.", "#fde047", "me");
      // you shove it in (krelact rip row: the lunge)
      void act.play("rip", { frames: [0, 4], hold: true, fps: 9 });
      await c.tw({ targets: nozzle, x: mouthX - side * (W * 0.18), y: mouthY, duration: 600, ease: "Quad.inOut" });
      p.destroy();
      synth.play("gulp");
      cam.shake(120, 0.006);
      p = say("MMMPHH!", "#fecaca");
      cam.pan(tg.x, tg.y, 900, "Sine.easeInOut");
      cam.zoomTo(2.3, 900);
      // the belly: their middle, lifted off the sprite so it can swell on its own
      // just the stomach: a round cut of their middle, hung from its top so it swells out and down (not over the face)
      const BU0 = 0.16, BU1 = 0.84, BV0 = 0.42, BV1 = 0.72;
      const belly = part(BU0, BV0, BU1, BV1, D + 3);
      const bw = (fu(BU1) - fu(BU0)) * c.fw * sA;
      const bh = (fv(BV1) - fv(BV0)) * c.fh * sA;
      const anchorY = belly.y - bh / 2;
      belly.setOrigin(0.5, 0).setY(anchorY);
      const bellyMask = sc.make.graphics({}, false);
      belly.setMask(bellyMask.createGeometryMask());
      // (HD art: set scales from the target's own scale, never read back from the image)
      const s0 = T.scale;
      let kx = 1;
      let ky = 1;
      /** the round outline of the belly at its current swell (the cut-out is masked to it) */
      const shapeBelly = (sx: number, sy: number) => {
        bellyMask.clear().fillStyle(0xffffff).fillEllipse(belly.x, anchorY + (bh * sy) / 2, bw * sx * 0.98, bh * sy * 0.98);
      };
      shapeBelly(1, 1);
      const swell = (nx: number, ny: number, cfg: Partial<Phaser.Types.Tweens.TweenBuilderConfig>) => {
        const fx0 = kx;
        const fy0 = ky;
        kx = nx;
        ky = ny;
        const t = { v: 0 };
        return c.tw({
          ...cfg,
          targets: t,
          v: 1,
          onUpdate: () => {
            const sx = fx0 + (nx - fx0) * t.v;
            const sy = fy0 + (ny - fy0) * t.v;
            belly.setScale(s0 * sx, s0 * sy);
            shapeBelly(sx, sy);
          },
        } as Phaser.Types.Tweens.TweenBuilderConfig);
      };
      const litres = { v: 0 };
      sc.tweens.add({ targets: litres, v: 62.4, duration: 3600, onUpdate: () => readout.setText(`${litres.v.toFixed(1)}L`) });
      const glug = sc.time.addEvent({ delay: 220, repeat: 15, callback: () => synth.play(Math.random() < 0.5 ? "gulp" : "slurp", 0.8) });
      const groan = sc.time.addEvent({ delay: 900, repeat: 3, callback: () => synth.play(Math.random() < 0.5 ? "groan" : "gurgle", 0.8) });
      const tint = { k: 0 };
      sc.tweens.add({ targets: tint, k: 1, duration: 3600, onUpdate: () => belly.setTint(lerpCol(0xffffff, 0xf87171, tint.k * 0.8)) });
      // it swells in surges, wobbling, the skin creaking
      for (const [k, ms] of [[1.3, 700], [1.6, 800], [1.95, 900], [2.3, 1000]] as [number, number][]) {
        await swell(k, 1 + (k - 1) * 0.75, { duration: ms, ease: "Sine.inOut" });
        synth.play("monitor_crack", 0.25 + k * 0.1);
        sc.tweens.add({ targets: belly, x: { from: belly.x - 3, to: belly.x + 3 }, yoyo: true, repeat: 3, duration: 40 });
      }
      p.destroy();
      glug.remove();
      groan.remove();
      // stretch marks, then the last creak
      act.idle();
      const marks = keep(sc.add.graphics().setDepth(D + 4));
      marks.lineStyle(2, 0x7f1d1d, 0.8);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = W * 0.5 * kx;
        const cy = anchorY + (bh * ky) / 2;
        marks.lineBetween(belly.x + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.2, belly.x + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.32);
      }
      synth.play("alarm");
      readout.setColor("#f87171").setText("FULL");
      p = say("…uh oh.", "#fecaca");
      await c.wait(700);
      p.destroy();
      c.slow(0.3);
      await swell(kx * 1.12, ky * 1.12, { duration: 140, ease: "Quad.in" });
      hoseEv.remove();
      if (c.gore) {
        // POP: petrol, blood and everything else
        const bx = belly.x;
        const by = anchorY + (bh * ky) / 2;
        belly.setVisible(false);
        bellyMask.destroy();
        marks.destroy();
        body.setCrop(0, 0, c.fw, fv(0.4) * c.fh);
        synth.play("explode", 0.6);
        synth.play("splat");
        synth.play("splash");
        c.flash();
        cam.shake(500, 0.025);
        for (let i = 0; i < 6; i++) c.guts(bx, by, (i / 6) * Math.PI * 2 + Math.random() * 0.4, 90 + Math.random() * 80);
        c.blood(bx, by, 60, 1.6, true);
        c.blood(bx, by, 40, 1.2);
        c.bones(bx, by, 4);
        // petrol everywhere (a rainbow sheen on the floor)
        for (let i = 0; i < 18; i++) {
          const d = bitk("petroldrop", bx, by, 7 + Math.random() * 5) ?? keep(sc.add.circle(bx, by, 3 + Math.random() * 4, Math.random() < 0.5 ? 0xfacc15 : 0x0ea5e9, 0.8).setDepth(D + 6));
          toss(d, (Math.random() - 0.5) * 520, -150 - Math.random() * 320, floor - Math.random() * 8);
        }
        c.organs(bx, by, 6, ["gutrope", "guts", "kidney", "liver", "meat"], 0.8);
        if (!img("kp_petrol", bx, floor + 2, { w: W * 2.2, h: 14, depth: D + 1 })?.setAlpha(0.8)) keep(sc.add.ellipse(bx, floor + 2, W * 2.2, 10, 0x7c3aed, 0.25).setDepth(D + 1));
        toss(nozzle, side * 160, -260, floor - 6, 540, () => synth.play("smash"));
        await c.wait(900);
        c.slow(1);
        card();
        await fall(body);
        c.blood(tg.x, floor - 4, 24, 0.7);
        await c.wait(1600);
      } else {
        // gore off: one enormous burp, and down they go
        c.slow(1);
        await swell(1, 1, { duration: 400, ease: "Back.out" });
        synth.play("fart_3");
        synth.voice("grunt", 0.8, 0.6);
        p = say("BUUUURRRP!", "#fde047");
        cam.shake(300, 0.012);
        toss(nozzle, side * 200, -300, floor - 6, 540, () => synth.play("smash"));
        await c.wait(900);
        p.destroy();
        belly.setVisible(false);
        card();
        await tameKO();
        await c.wait(800);
      }
      break;
    }

    // ------------------------------------------------------------ CINDER BLOCK'D (the head, the floor, a breeze block, again and again)
    case "cinder": {
      const dir = tg.x >= c.me.x ? 1 : -1;
      const A = dir > 0 ? -90 : 90;
      // their head, lifted off the sprite so it can be ruined on its own
      const HV = 0.22;
      const head = part(0, 0, 1, HV, D + 4);
      cropAbove(HV);
      const s0 = T.scale;
      const dx = head.x - T.x;
      const dy = head.y - T.y;
      const bx0 = T.x;
      const by0 = T.y;
      const lieY = floor - W * 0.42;
      const place = (ang: number, by: number) => {
        const r = Phaser.Math.DegToRad(ang);
        body.setAngle(ang).setY(by);
        head.setAngle(ang).setPosition(bx0 + dx * Math.cos(r) - dy * Math.sin(r), by + dx * Math.sin(r) + dy * Math.cos(r));
      };
      // a shove, and down they go, the back of the head hitting the floor
      cam.pan(tg.x, tg.y, 500, "Sine.easeInOut");
      cam.zoomTo(1.7, 500);
      synth.play("punch_big");
      const k0 = { t: 0 };
      await c.tw({ targets: k0, t: 1, duration: 520, ease: "Quad.in", onUpdate: () => place(A * k0.t, by0 + (lieY - by0) * k0.t) } as Phaser.Types.Tweens.TweenBuilderConfig);
      synth.play("bodies_land");
      synth.play("bonecrack", 0.6);
      cam.shake(220, 0.012);
      const hx = head.x;
      const hy = head.y;
      // the block, and you over them with it
      // drawn (PixelLab): a breeze block. With his action sheet he's holding it himself (krelact slam row: up
      // over his head, down on theirs), and this one only shows when it leaves his hands
      const block = keep(sc.add.container(hx, hy - 160).setDepth(D + 7));
      const blockArt = prop(sc, "kp_block", 0, 0, { w: 40 });
      if (blockArt) block.add(blockArt);
      else {
        block.add(sc.add.rectangle(0, 0, 40, 26, 0x9ca3af).setStrokeStyle(2, 0x4b5563));
        block.add(sc.add.rectangle(-9, 0, 10, 14, 0x374151));
        block.add(sc.add.rectangle(9, 0, 10, 14, 0x374151));
        block.add(sc.add.rectangle(0, -10, 40, 3, 0xd1d5db, 0.6));
      }
      const held = !!act.sheet;
      block.setVisible(!held);
      // where his slam lands is a little in front of him: stand so it lands on the head
      const reach = held ? (c.me.displayHeight / 64) * 34 : 62;
      act.idle(dir > 0 ? 1 : -1);
      act.walk();
      await c.tw({ targets: c.me, x: hx - dir * reach, y: hy - 18, duration: 450, ease: "Sine.inOut" });
      act.idle();
      // handheld: the camera won't keep still
      cam.pan(hx - dir * 20, hy - 10, 600, "Sine.easeInOut");
      cam.zoomTo(2.6, 600);
      const sway = sc.tweens.add({ targets: cam, rotation: { from: -0.025, to: 0.025 }, yoyo: true, repeat: -1, duration: 340, ease: "Sine.inOut" });
      await c.wait(500);
      let p = say("Look at me.", "#ffffff", "me");
      await c.wait(900);
      p.destroy();
      // the head's ruin: flattened, widened, darker, cracked, a spreading pool and bits of it everywhere
      let fx = 1;
      let fy = 1;
      const pulp = keep(sc.add.graphics().setDepth(D + 5));
      const cracks = keep(sc.add.graphics().setDepth(D + 6));
      const hr = Math.max(14, W * 0.32);
      let poolR = 0;
      // drawn: a pool of dark goo spreading under it, splats of mush and bone chips building up round it
      const gooArt = img("kp_goo", hx, hy + hr * 0.4, { w: 4, h: 2, depth: D + 1 });
      const goo0 = gooArt ? { w: gooArt.frame.width, h: gooArt.frame.height } : null;
      const pool = keep(sc.add.ellipse(hx, hy + hr * 0.4, 1, 1, 0x7f1d1d, 0.92).setDepth(D + 1).setVisible(!gooArt));
      const ruin = (n: number) => {
        // squashed downwards (along the floor) each time, spreading sideways
        fx = Math.max(0.18, fx * (c.gore ? 0.8 : 0.97));
        fy = Math.min(2.2, fy * (c.gore ? 1.09 : 1));
        head.setScale(s0 * fx, s0 * fy).setY(hy + (1 - fx) * hr * 0.55);
        head.setTint(lerpCol(0xffffff, 0x7f1d1d, Math.min(1, n / 7)));
        if (!c.gore) return;
        if (gooArt && goo0) {
          const mush = img("kp_splat_mush", hx + (Math.random() - 0.5) * hr * 0.8, hy + hr * 0.3 + Math.random() * 4, { w: hr * (1.2 + n * 0.25), depth: D + 5 });
          mush?.setFlipX(Math.random() < 0.5);
          poolR = Math.min(W * 2.2, poolR + W * 0.22);
          sc.tweens.add({ targets: gooArt, scaleX: (poolR * 1.4) / goo0.w, scaleY: (poolR * 0.45) / goo0.h, duration: 600, ease: "Quad.out" });
          return;
        }
        // what's left of the face, smeared out round it
        pulp.fillStyle(n % 2 ? 0x991b1b : 0x7f1d1d, 0.9).fillEllipse(hx + (Math.random() - 0.5) * hr, hy + hr * 0.25 + Math.random() * 6, hr * (0.9 + n * 0.22), hr * (0.35 + n * 0.06));
        pulp.fillStyle(0xfda4af, 0.7).fillCircle(hx + (Math.random() - 0.5) * hr * 1.2, hy + hr * 0.2, 2 + Math.random() * 3);
        cracks.lineStyle(1.5, 0x1c0505, 0.9);
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const r1 = hr * 0.15;
          const r2 = hr * (0.5 + Math.random() * 0.4 + n * 0.05);
          cracks.lineBetween(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1 * 0.5, hx + Math.cos(a) * r2, hy + Math.sin(a) * r2 * 0.5);
        }
        poolR = Math.min(W * 2.2, poolR + W * 0.22);
        sc.tweens.add({ targets: pool, width: poolR * 2, height: poolR * 0.55, duration: 600, ease: "Quad.out" });
      };
      const chips = (n: number) => {
        const kinds: Bit[] = ["shards", "tooth", "brain", "eyeball", "shards", "tooth", "ear"];
        for (let i = 0; i < n; i++) {
          const bone = bitk(kinds[Math.floor(Math.random() * kinds.length)], hx, hy, 7 + Math.random() * 5) ?? keep(sc.add.rectangle(hx, hy, 2 + Math.random() * 4, 2 + Math.random() * 3, Math.random() < 0.6 ? 0xf5f0e1 : 0xfda4af).setDepth(D + 6));
          toss(bone, (Math.random() - 0.5) * 360, -120 - Math.random() * 260, hy + hr * 0.4 + Math.random() * 10, (Math.random() - 0.5) * 900);
        }
      };
      const blows = c.gore ? 11 : 1;
      for (let n = 0; n < blows; n++) {
        // up, and down. The first few deliberate; the rest a frenzy.
        const frenzy = n >= 4;
        const lift = frenzy ? 70 : 120;
        // up over his head (frames 1-6 of his slam row), and down (7-8) as the block lands
        if (held) void act.play("slam", { frames: [frenzy ? 4 : 1, 6], hold: true, fps: frenzy ? 30 : 16 });
        await c.tw({ targets: block, y: hy - lift, x: hx + (Math.random() - 0.5) * 6, angle: (Math.random() - 0.5) * 20, duration: frenzy ? 120 : 300, ease: "Quad.out" });
        if (n === 0) {
          c.slow(0.35);
          await c.wait(250);
        }
        if (held) void act.play("slam", { frames: [7, 8], hold: true, fps: frenzy ? 30 : 20 });
        await c.tw({ targets: block, y: hy - 8, duration: frenzy ? 70 : 110, ease: "Quad.in" });
        if (n === 0) c.slow(1);
        synth.play("punch_big");
        synth.play(n < 3 ? "bonecrack" : Math.random() < 0.5 ? "bonecrack" : "squelch");
        if (c.gore) synth.play(n % 2 ? "splat" : "squelch");
        cam.shake(frenzy ? 140 : 260, frenzy ? 0.014 : 0.022);
        if (n < 3) c.flash();
        if (!c.gore) break;
        ruin(n + 1);
        c.blood(hx, hy, 14 + n * 4, 0.9 + n * 0.06, true);
        chips(n < 3 ? 2 : 4);
        // the body: a jerk on each blow, legs kicking, then nothing
        if (n < 7) sc.tweens.add({ targets: body, x: { from: bx0 - 3, to: bx0 + 3 }, yoyo: true, repeat: 1, duration: 40 });
        if (n === 1) synth.play("gurgle");
        if (n === 6) p = say("…", "#fecaca");
        if (n === 8) p?.destroy();
      }
      sway.stop();
      cam.setRotation(0);
      if (c.gore) {
        // it stops. You stand there. The block drops from your hand.
        await c.wait(500);
        synth.play("smash");
        act.idle();
        block.setVisible(true).setPosition(hx - dir * reach * 0.4, hy - 14);
        toss(block, -dir * 50, -70, hy + hr * 1.6, 160);
        c.fountain(hx, hy, 900);
        await c.wait(700);
        cam.zoomTo(3.0, 1800, "Sine.easeInOut");
        card();
        await c.wait(2200);
      } else {
        // gore off: the block bonks off their head and cracks in two; a lump comes up
        synth.play("wonk");
        act.idle();
        block.setVisible(true).setPosition(hx, hy - 10);
        toss(block, dir * 120, -220, hy + 10, 400, () => synth.play("smash"));
        const lump = keep(sc.add.circle(hx, hy - hr * 0.6, 4, 0xfda4af).setStrokeStyle(1, 0x9f1239).setDepth(D + 6));
        sc.tweens.add({ targets: lump, radius: hr * 0.35, duration: 500, ease: "Back.out" });
        c.fx("vfx_stars", hx, hy - hr, 1, { depth: D + 7 });
        await c.wait(900);
        card();
        await c.wait(1200);
      }
      break;
    }

    // ------------------------------------------------------------ PIRANHA POOL (in to the neck; out as a skeleton)
    case "piranha": {
      // (a bit lower than the top fifth: hats and hair would otherwise take the face down with the body)
      const NECK = 0.26;
      const neckY = top + H * NECK;
      const tw = Math.max(W * 2.6, 90);
      const tankTop = neckY + 4;
      const tankH = floor + 12 - tankTop;
      // stand clear of where the tank comes up
      c.me.setFlipX(true);
      act.walk();
      void c.tw({ targets: c.me, x: Math.min(c.me.x, tg.x - tw / 2 - 30), duration: 400 }).then(() => act.idle(1));
      cam.pan(tg.x, tg.y, 600, "Sine.easeInOut");
      cam.zoomTo(1.9, 600);
      // a glass tank comes up out of the floor round them, filling as it goes
      const back = keep(sc.add.rectangle(tg.x, floor + 12, tw, tankH, 0x0c4a6e, 0.35).setOrigin(0.5, 1).setDepth(D - 1));
      const water = keep(sc.add.rectangle(tg.x, floor + 12, tw, tankH, 0x0ea5e9, 0.35).setOrigin(0.5, 1).setDepth(D + 5));
      // the tank itself is drawn (PixelLab): its metal frame and glass go over the water
      const tankArt = img("kp_tank", tg.x, floor + 16, { w: tw * 1.08, h: tankH * 1.22, oy: 1, depth: D + 7 });
      const glass = keep(sc.add.graphics().setDepth(D + 7));
      if (!tankArt) {
        glass.lineStyle(3, 0xe0f2fe, 0.85).strokeRect(tg.x - tw / 2, tankTop, tw, tankH);
        glass.lineStyle(2, 0xffffff, 0.35).lineBetween(tg.x - tw / 2 + 8, tankTop + 6, tg.x - tw / 2 + 8, floor);
      }
      for (const o of [back, water]) o.setScale(1, 0);
      glass.setAlpha(0);
      tankArt?.setAlpha(0);
      synth.play("splash");
      sc.tweens.add({ targets: [glass, ...(tankArt ? [tankArt] : [])], alpha: 1, duration: 500 });
      await c.tw({ targets: [back, water], scaleY: 1, duration: 800, ease: "Quad.out" });
      let p = say("Is that… water?", "#bae6fd");
      await c.wait(700);
      p.destroy();
      // in they come: a shoal of piranhas, then a frenzy
      const fish: Phaser.GameObjects.Container[] = [];
      const inTank = () => ({ x: tg.x + (Math.random() - 0.5) * (tw - 24), y: tankTop + 14 + Math.random() * (tankH - 28) });
      const mkFish = () => {
        const f = keep(sc.add.container(tg.x + (Math.random() < 0.5 ? -1 : 1) * (tw / 2 + 30), tankTop + 20 + Math.random() * (tankH - 40)).setDepth(D + 6));
        const sz = 0.8 + Math.random() * 0.5;
        // a drawn piranha (the bits sheet), snapping its jaws as it goes
        const pf = bit(sc, "piranha", 0, 0, 20 * sz);
        if (pf) {
          f.add(pf);
          fish.push(f);
          return f;
        }
        f.add(sc.add.triangle(-11 * sz, 0, 0, -5 * sz, 0, 5 * sz, -7 * sz, 0, 0x4d7c0f));
        f.add(sc.add.ellipse(0, 0, 18 * sz, 11 * sz, 0x65a30d).setStrokeStyle(1, 0x1a2e05));
        f.add(sc.add.ellipse(1, 3 * sz, 12 * sz, 5 * sz, 0xdc2626));
        f.add(sc.add.circle(5 * sz, -2 * sz, 1.5 * sz, 0xfde047));
        f.add(sc.add.triangle(8 * sz, 1.5 * sz, 0, 0, 3 * sz, 0, 1.5 * sz, 3 * sz, 0xffffff));
        fish.push(f);
        return f;
      };
      const dart = (f: Phaser.GameObjects.Container, fast: boolean) => {
        if (!f.active) return;
        const to = Math.random() < (fast ? 0.7 : 0.4) ? { x: tg.x + (Math.random() - 0.5) * W * 0.8, y: neckY + 16 + Math.random() * (floor - neckY - 24) } : inTank();
        f.setScale(to.x < f.x ? -1 : 1, 1);
        sc.tweens.add({ targets: f, x: to.x, y: to.y, duration: fast ? 140 + Math.random() * 160 : 400 + Math.random() * 300, ease: "Sine.inOut", onComplete: () => dart(f, fast) });
      };
      for (let i = 0; i < 6; i++) dart(mkFish(), false);
      // snap, snap: the drawn piranhas flick between mouth shut and mouth open
      const snap = sc.time.addEvent({ delay: 110, loop: true, callback: () => {
        for (const f of fish) {
          const im = f.list[0];
          if (!f.active || !(im instanceof Phaser.GameObjects.Image) || im.texture.key !== "kp_bits" || Math.random() < 0.5) continue;
          const open = !im.getData("open");
          im.setData("open", open).setFrame(open ? 20 : 19);
        }
      } });
      synth.play("splash");
      await c.wait(900);
      p = say("…are those PIRANHAS?!", "#fecaca");
      await c.wait(800);
      p.destroy();
      for (let i = 0; i < 12; i++) dart(mkFish(), true);
      for (const f of fish) {
        sc.tweens.killTweensOf(f);
        dart(f, true);
      }
      // the feeding: bites, bubbles, thrashing, the water going red and then thick
      const bubbles = sc.time.addEvent({ delay: 60, loop: true, callback: () => {
        const bx = tg.x + (Math.random() - 0.5) * tw * 0.8;
        const by = floor - Math.random() * tankH * 0.8;
        const b = bitk("bubble", bx, by, 3 + Math.random() * 5)?.setAlpha(0.8) ?? keep(sc.add.circle(bx, by, 1 + Math.random() * 3, 0xffffff, 0.6).setDepth(D + 6));
        sc.tweens.add({ targets: b, y: tankTop + 2, alpha: 0, duration: 500 + Math.random() * 500, onComplete: () => b.destroy() });
      } });
      const bites = sc.time.addEvent({ delay: 110, loop: true, callback: () => synth.play(Math.random() < 0.4 ? "squelch" : Math.random() < 0.5 ? "splat" : "flesh_rip", 0.6) });
      const thrash = sc.tweens.add({ targets: body, x: { from: T.x - 3, to: T.x + 3 }, yoyo: true, repeat: -1, duration: 60 });
      synth.play("scream_man");
      synth.play("splash");
      cam.shake(2600, 0.006);
      const wcol = { k: 0 };
      await c.tw({
        targets: wcol,
        k: 1,
        duration: 3000,
        onUpdate: () => {
          // clear blue, to red, to an opaque red-brown gunk you can't see into
          const k = wcol.k;
          water.setFillStyle(k < 0.5 ? lerpCol(0x0ea5e9, 0xb91c1c, k * 2) : lerpCol(0xb91c1c, c.gore ? 0x4a0a0a : 0x7c2d12, (k - 0.5) * 2), 0.35 + k * 0.65);
          for (const f of fish) f.setAlpha(1 - k * 0.85);
        },
      } as Phaser.Types.Tweens.TweenBuilderConfig);
      synth.play("gurgle");
      // a scum of froth and bits on the top
      const scum = keep(sc.add.graphics().setDepth(D + 6));
      // drawn: froth with bits in it, floating on top
      for (let i = 0; i < 6 && sc.textures.exists("kp_scum"); i++) img("kp_scum", tg.x + (i / 5 - 0.5) * tw * 0.85, tankTop + 3, { w: tw / 4.5, depth: D + 6 })?.setFlipX(i % 2 === 0).setTint(c.gore ? 0xffffff : 0xfde7d0);
      for (let i = 0; i < 16 && !sc.textures.exists("kp_scum"); i++) scum.fillStyle(i % 3 ? 0x7f1d1d : 0xfca5a5, 0.9).fillEllipse(tg.x + (Math.random() - 0.5) * tw * 0.9, tankTop + 2 + Math.random() * 4, 6 + Math.random() * 12, 3 + Math.random() * 3);
      thrash.stop();
      body.setX(T.x);
      bites.remove();
      await c.wait(700);
      bubbles.remove();
      snap.remove();
      for (const f of fish) {
        sc.tweens.killTweensOf(f);
        f.destroy();
      }
      // out they come: a hook on a chain, up by the collar
      const hookTopY = cam.worldView.y - 20;
      // drawn (PixelLab): a meat hook on a chain, wound up by a lever at your side
      const chain = keep(sc.add.graphics().setDepth(D + 2));
      const hookArt = img("kp_hook", tg.x, hookTopY, { h: 26, oy: 0.15, depth: D + 2 });
      const hook = hookArt ?? keep(sc.add.text(tg.x, hookTopY, "⚓", { fontSize: "18px" }).setOrigin(0.5).setDepth(D + 2).setAngle(180));
      const chainArt = sc.textures.exists("kp_chain") ? keep(sc.add.tileSprite(tg.x, hookTopY - 400, 8, 1, "kp_chain").setOrigin(0.5, 0).setDepth(D + 2)) : null;
      if (chainArt) chainArt.setTileScale(8 / chainArt.frame.width, 8 / chainArt.frame.width);
      const drawChain = () => {
        if (chainArt) chainArt.setSize(8, Math.max(1, hook.y - 2 - (hookTopY - 400)));
        else chain.clear().lineStyle(3, 0x9ca3af, 1).lineBetween(tg.x, hookTopY - 400, tg.x, hook.y - 8);
      };
      const chainEv = sc.time.addEvent({ delay: 16, loop: true, callback: drawChain });
      const lever = img("kp_lever", c.me.x + 16, floor + 2, { h: H * 0.32, oy: 1, depth: D + 2 });
      synth.play("telegraph");
      void act.play("pull", { fps: 16 });
      if (lever) sc.tweens.add({ targets: lever, scaleY: lever.scaleY * 0.85, yoyo: true, duration: 160, delay: 180 });
      await c.tw({ targets: hook, y: top + 6, duration: 600, ease: "Quad.in" });
      synth.play("smash", 0.5);
      // what comes out: their head, untouched, on a skeleton picked clean (gore), or a very nibbled person (gore off)
      const head = part(0, 0, 1, NECK, D + 4);
      const fig = keep(sc.add.container(0, 0).setDepth(D + 3));
      const skelArt = c.gore ? prop(sc, "kp_skeleton", tg.x, neckY - 3, { h: floor - neckY + 4, oy: 0 }) : null;
      if (skelArt) {
        // drawn (PixelLab): a skeleton picked clean, shreds of them still hanging off it
        body.setVisible(false);
        fig.add(skelArt);
      } else if (c.gore) {
        body.setVisible(false);
        const bone = 0xf5f0e1;
        const g = sc.add.graphics();
        const cx = tg.x;
        const sh = neckY + H * 0.06;
        const pel = neckY + H * 0.42;
        const lw = Math.max(2, W * 0.05);
        g.lineStyle(lw, bone, 1);
        // spine
        g.lineBetween(cx, neckY, cx, pel);
        for (let y = neckY + 4; y < pel; y += Math.max(4, H * 0.025)) g.fillStyle(bone).fillRect(cx - lw, y, lw * 2, lw * 0.6);
        // ribcage
        g.lineStyle(Math.max(1.5, lw * 0.7), bone, 1);
        for (let i = 0; i < 5; i++) {
          const y = sh + i * H * 0.045;
          const r = W * (0.3 - i * 0.025);
          g.beginPath();
          g.arc(cx, y + r * 0.35, r, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
          g.strokePath();
        }
        // shoulders, arms, hands
        g.lineStyle(lw, bone, 1);
        g.lineBetween(cx - W * 0.32, sh, cx + W * 0.32, sh);
        for (const sx of [-1, 1]) {
          const ax = cx + sx * W * 0.32;
          g.lineBetween(ax, sh, ax + sx * W * 0.06, sh + H * 0.17);
          g.lineBetween(ax + sx * W * 0.06, sh + H * 0.17, ax + sx * W * 0.04, sh + H * 0.33);
          g.fillStyle(bone).fillCircle(ax + sx * W * 0.06, sh + H * 0.17, lw * 0.8);
        }
        // pelvis and legs
        g.fillStyle(bone).fillEllipse(cx, pel, W * 0.5, H * 0.07);
        g.fillStyle(0x4a0a0a).fillEllipse(cx - W * 0.1, pel, W * 0.12, H * 0.035).fillEllipse(cx + W * 0.1, pel, W * 0.12, H * 0.035);
        for (const sx of [-1, 1]) {
          const hx = cx + sx * W * 0.14;
          const kx = cx + sx * W * 0.16;
          g.lineBetween(hx, pel, kx, pel + (floor - pel) * 0.5);
          g.lineBetween(kx, pel + (floor - pel) * 0.5, kx + sx * 2, floor - 4);
          g.fillStyle(bone).fillCircle(kx, pel + (floor - pel) * 0.5, lw * 0.9);
          g.fillRect(kx + sx * 2 - lw, floor - 5, lw * 3 * sx, lw);
        }
        // shreds of flesh still hanging off
        for (let i = 0; i < 14; i++) g.fillStyle(i % 2 ? 0x991b1b : 0x7f1d1d, 1).fillRect(cx + (Math.random() - 0.5) * W * 0.6, neckY + Math.random() * (floor - neckY), 2 + Math.random() * 3, 3 + Math.random() * 6);
        // the ragged neck
        g.fillStyle(0x991b1b).fillEllipse(cx, neckY + 1, W * 0.22, 5);
        fig.add(g);
      } else {
        // gore off: just a lot of little bites out of their clothes, and two piranhas still hanging on
        const g = sc.add.graphics();
        for (let i = 0; i < 12; i++) g.fillStyle(0x0b0b0b, 0.9).fillCircle(tg.x + (Math.random() - 0.5) * W * 0.7, neckY + 20 + Math.random() * (floor - neckY - 30), 2 + Math.random() * 3);
        fig.add(g);
        for (const [fx2, fy2] of [[-W * 0.25, H * 0.55], [W * 0.2, H * 0.75]]) {
          const f = mkFish();
          f.setPosition(tg.x + fx2, top + fy2).setAlpha(1);
        }
      }
      // the head is untouched, but the eyes are closed: find their eyes in the sprite (the darkest bits in the middle band of
      // the face, left and right) and draw skin-coloured lids with a lash line over them
      const lids = keep(sc.add.graphics().setDepth(D + 8));
      if (c.gore) {
        const fx0 = Math.round(fu(0) * c.fw);
        const fy0 = Math.round(fv(0) * c.fh);
        const hwPx = Math.max(1, Math.round((fu(1) - fu(0)) * c.fw));
        const hhPx = Math.max(1, Math.round((fv(NECK) - fv(0)) * c.fh));
        const px = (x: number, y: number) => sc.textures.getPixel(fx0 + x, fy0 + y, T.key, T.frame);
        const lum = (col: Phaser.Display.Color | null) => (col && col.alpha > 0 ? col.red * 0.3 + col.green * 0.59 + col.blue * 0.11 : 999);
        const eyes: { x: number; y: number }[] = [];
        for (const [u0, u1] of [[0.18, 0.5], [0.5, 0.82]]) {
          let best = { x: 0, y: 0, l: 999 };
          for (let y = Math.round(hhPx * 0.3); y < Math.round(hhPx * 0.85); y++)
            for (let x = Math.round(hwPx * u0); x < Math.round(hwPx * u1); x++) {
              const l = lum(px(x, y));
              if (l < best.l) best = { x, y, l };
            }
          if (best.l < 120) eyes.push(best);
        }
        // skin: the face just under the eyes (or the middle of the face if that's not skin)
        const skinAt = (x: number, y: number) => {
          const col = px(x, y);
          return col && col.alpha > 0 ? col.color : 0xe0b089;
        };
        const s = sA;
        const toWorld = (x: number, y: number) => ({ x: T.flip ? head.x + (hwPx * s) / 2 - (x + 0.5) * s : head.x - (hwPx * s) / 2 + (x + 0.5) * s, y: head.y - (hhPx * s) / 2 + (y + 0.5) * s });
        const lidW = Math.max(3, hwPx * 0.14) * s;
        const lidH = Math.max(2, hhPx * 0.07) * s;
        for (const e of eyes) {
          const w = toWorld(e.x, e.y);
          const skin = skinAt(e.x, Math.min(hhPx - 1, e.y + Math.round(hhPx * 0.12)));
          lids.fillStyle(skin, 1).fillRect(w.x - lidW / 2, w.y - lidH / 2 - 1, lidW, lidH + 2);
          lids.lineStyle(Math.max(1, s * 0.8), 0x2a1a12, 1).lineBetween(w.x - lidW / 2, w.y + lidH * 0.15, w.x + lidW / 2, w.y + lidH * 0.15);
        }
      }
      // up: the head comes out first, then (gunk running off it) the rest
      const rise = Math.round(floor - tankTop + 6);
      const lifted = [head, fig, lids, ...(c.gore ? [] : [body, ...fish.filter((f) => f.active)])];
      for (const o of lifted) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(D + 8);
      // the head sits in front of the top of the ribcage, the closed lids in front of that
      head.setDepth(D + 9);
      lids.setDepth(D + 10);
      synth.play("splash");
      const drips = sc.time.addEvent({ delay: 90, loop: true, callback: () => {
        const dx = tg.x + (Math.random() - 0.5) * W * 0.5;
        const db = bitk("drop", dx, tankTop - 2, 6, D + 8);
        if (db && !c.gore) db.setTint(0x7dd3fc);
        const d = db ?? keep(sc.add.circle(dx, tankTop - 2, 2, c.gore ? 0x7f1d1d : 0x0ea5e9).setDepth(D + 8));
        sc.tweens.add({ targets: d, y: tankTop + 10, alpha: 0, duration: 400, onComplete: () => d.destroy() });
      } });
      const start = lifted.map((o) => (o as unknown as Phaser.GameObjects.Components.Transform).y);
      const lift = { t: 0 };
      // you crank them up, heave by heave
      const heave = sc.time.addEvent({ delay: 560, repeat: 3, callback: () => {
        void act.play("pull", { fps: 18 });
        if (lever) sc.tweens.add({ targets: lever, scaleY: lever.scaleY * 0.85, yoyo: true, duration: 160, delay: 180 });
      } });
      void heave;
      await c.tw({
        targets: lift,
        t: 1,
        duration: 2200,
        ease: "Sine.inOut",
        onUpdate: () => {
          lifted.forEach((o, i) => ((o as unknown as Phaser.GameObjects.Components.Transform).y = start[i] - rise * lift.t));
          hook.setY(top + 6 - rise * lift.t);
        },
      } as Phaser.Types.Tweens.TweenBuilderConfig);
      drips.remove();
      cam.pan(tg.x, neckY - rise * 0.6, 800, "Sine.easeInOut");
      // hanging there, turning gently on the chain (side to side together, head and all)
      const hx0 = head.x;
      const swing = { a: 0 };
      sc.tweens.add({ targets: swing, a: 1, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut", onUpdate: () => {
        const ox = (swing.a - 0.5) * 6;
        fig.x = ox;
        lids.x = ox;
        head.x = hx0 + ox;
      } });
      await c.wait(700);
      if (c.gore) {
        p = say("…how bad is it?", "#fecaca");
        await c.wait(1300);
        p.destroy();
        card();
        await c.wait(2000);
      } else {
        p = say("OW. OW. OW.", "#fde047");
        await c.wait(1100);
        p.destroy();
        card();
        await c.wait(1400);
      }
      chainEv.remove();
      break;
    }

    // ------------------------------------------------------------ GET WELL SOON (asbestos; a week; six months; a chainsaw)
    case "asbestos": {
      const NECK = 0.26;
      /** frame-pixel eyes (darkest spots left and right in the middle band of the face) in the top `v1` of the figure */
      const fx0 = Math.round(fu(0) * c.fw);
      const fy0 = Math.round(fv(0) * c.fh);
      const hwPx = Math.max(1, Math.round((fu(1) - fu(0)) * c.fw));
      const hhPx = Math.max(1, Math.round((fv(NECK) - fv(0)) * c.fh));
      const pxAt = (x: number, y: number) => sc.textures.getPixel(fx0 + x, fy0 + y, T.key, T.frame);
      const lum = (col: Phaser.Display.Color | null) => (col && col.alpha > 0 ? col.red * 0.3 + col.green * 0.59 + col.blue * 0.11 : 999);
      const eyes: { x: number; y: number }[] = [];
      for (const [u0, u1] of [[0.18, 0.5], [0.5, 0.82]]) {
        let best = { x: 0, y: 0, l: 999 };
        for (let y = Math.round(hhPx * 0.4); y < Math.round(hhPx * 0.85); y++)
          for (let x = Math.round(hwPx * u0); x < Math.round(hwPx * u1); x++) {
            const l = lum(pxAt(x, y));
            if (l < best.l) best = { x, y, l };
          }
        if (best.l < 140) eyes.push(best);
      }
      /** where frame pixel (x, y) of a head image (the top NECK of the figure) lands, for an image drawn at scale m */
      const onHead = (img: Phaser.GameObjects.Image, x: number, y: number, m = 1) => {
        const sc2 = sA * m;
        return { x: T.flip ? img.x + (hwPx * sc2) / 2 - (x + 0.5) * sc2 : img.x - (hwPx * sc2) / 2 + (x + 0.5) * sc2, y: img.y - (hhPx * sc2) / 2 + (y + 0.5) * sc2, s: sc2 };
      };
      const sizeTo = <O extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(o: O, h: number) => {
        o.setScale(1);
        const k = o.scaleX || 1;
        o.setScale(h / o.frame.height / k);
        return o;
      };

      // ---- 1. the clamp, and the bag
      cam.pan(tg.x, top + H * 0.2, 600, "Sine.easeInOut");
      cam.zoomTo(2.3, 600);
      const upper = part(0, 0, 1, 0.13, D + 5);
      const jaw = part(0, 0.13, 1, 0.21, D + 5);
      cropAbove(0.21);
      const mouthY = top + H * 0.15;
      const clamp = keep(sc.add.graphics().setDepth(D + 6));
      // drawn (PixelLab): a steel G-clamp, cranked open in the mouth (one jaw up, one down)
      const clampArt = img("kp_clamp", tg.x + W * 0.12, mouthY, { w: W * 0.75, depth: D + 6 });
      const clampK = clampArt ? clampArt.scaleY : 1;
      const drawClamp = (open: number) => {
        if (clampArt) {
          clampArt.setScale(clampArt.scaleX, clampK * (0.45 + open / Math.max(1, H * 0.05)));
          return;
        }
        clamp.clear().lineStyle(3, 0x9ca3af, 1);
        clamp.lineBetween(tg.x - W * 0.3, mouthY - open, tg.x + W * 0.3, mouthY - open);
        clamp.lineBetween(tg.x - W * 0.3, mouthY + open, tg.x + W * 0.3, mouthY + open);
        clamp.lineStyle(4, 0x4b5563, 1).lineBetween(tg.x + W * 0.3, mouthY - open, tg.x + W * 0.45, mouthY).lineBetween(tg.x + W * 0.3, mouthY + open, tg.x + W * 0.45, mouthY);
        clamp.fillStyle(0x6b7280).fillCircle(tg.x + W * 0.45, mouthY, 4);
      };
      drawClamp(1);
      let p = say("Open wide.", "#ffffff", "me");
      synth.play("telegraph");
      const op = { v: 1 };
      sc.tweens.add({ targets: op, v: H * 0.05, duration: 700, ease: "Quad.inOut", onUpdate: () => drawClamp(op.v) });
      sc.tweens.add({ targets: upper, y: upper.y - H * 0.04, duration: 700 });
      sc.tweens.add({ targets: jaw, y: jaw.y + H * 0.03, duration: 700 });
      synth.play("monitor_crack", 0.4);
      await c.wait(900);
      p.destroy();
      p = say("AAHHGH?!", "#fecaca");
      // the bag: ASBESTOS, skull and crossbones, the lot of it
      const bag = keep(sc.add.container(tg.x + W * 0.1, top - H * 0.45).setDepth(D + 7));
      const bagArt = prop(sc, "kp_asbestos", 0, 0, { h: 52 });
      if (bagArt) bag.add(bagArt);
      else {
        bag.add(sc.add.rectangle(0, 0, 46, 58, 0xd6c7a1).setStrokeStyle(2, 0x6b5a3a));
        bag.add(sc.add.text(0, -10, "ASBESTOS", { fontFamily: "Impact, sans-serif", fontSize: "9px", color: "#7f1d1d" }).setOrigin(0.5));
        bag.add(sc.add.text(0, 8, "☠", { fontSize: "16px", color: "#111" }).setOrigin(0.5));
        bag.add(sc.add.text(0, 22, "25kg", { fontFamily: "monospace", fontSize: "7px", color: "#333" }).setOrigin(0.5));
      }
      bag.setAlpha(0);
      // you hold it over them and tip it (krelact rip row, the reach)
      void act.play("rip", { frames: [0, 4], hold: true, fps: 10 });
      sc.tweens.add({ targets: bag, alpha: 1, duration: 300 });
      await c.tw({ targets: bag, angle: 135, x: tg.x + W * 0.05, y: mouthY - H * 0.32, duration: 600, ease: "Back.out" });
      p.destroy();
      synth.play("powderpour");
      const pour = sc.time.addEvent({ delay: 18, repeat: 150, callback: () => {
        const fx0 = bag.x - 6 + Math.random() * 6;
        const f = bitk("dust", fx0, bag.y + 16, 4 + Math.random() * 4)?.setTint(Math.random() < 0.6 ? 0xffffff : 0xd1d5db) ?? keep(sc.add.rectangle(fx0, bag.y + 16, 1 + Math.random() * 2, 2 + Math.random() * 4, Math.random() < 0.6 ? 0xf3f4f6 : 0x9ca3af, 0.95).setDepth(D + 6));
        sc.tweens.add({ targets: f, x: tg.x + (Math.random() - 0.5) * W * 0.12, y: mouthY, duration: 220, ease: "Quad.in", onComplete: () => f.destroy() });
      } });
      sc.tweens.add({ targets: bag, x: { from: bag.x - 2, to: bag.x + 2 }, yoyo: true, repeat: 20, duration: 70 });
      const choke = sc.time.addEvent({ delay: 700, repeat: 3, callback: () => {
        synth.play("cough");
        c.fx("vfx_dust", tg.x, mouthY, 0.6, { tint: 0xffffff });
        sc.tweens.add({ targets: body, x: { from: T.x - 2, to: T.x + 2 }, yoyo: true, repeat: 3, duration: 40 });
      } });
      await c.wait(2900);
      pour.remove();
      choke.remove();
      act.idle();
      toss(bag, 160, -200, floor - 6, 360, () => synth.play("lob"));
      synth.play("cough");
      p = say("*cough* …that tasted fibrous.", "#e5e7eb");
      await c.wait(1500);
      p.destroy();

      // ---- the cutaways: a black card, then a room, drawn over the whole view; the stage is hidden behind
      // (drawn on the screen itself, over everything, at 1:1: the room's darkness and the camera can't get at them)
      cam.zoomEffect.reset();
      cam.panEffect.reset();
      cam.setZoom(1);
      const V = { x: 0, y: 0, w: 960, h: 540 };
      const Z = D + 20;
      const fix = <O extends Phaser.GameObjects.GameObject>(o: O): O => {
        (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
        if (o instanceof Phaser.GameObjects.Container) for (const ch of o.list) fix(ch);
        return o;
      };
      const vx = (f: number) => V.x + V.w * f;
      const vy = (f: number) => V.y + V.h * f;
      const stage: { setVisible(v: boolean): unknown }[] = [body, upper, jaw, clamp, c.me, ...(clampArt ? [clampArt] : [])];
      const blackCard = async (text: string) => {
        const bk = fix(keep(sc.add.rectangle(-20, -20, 1000, 580, 0x000000, 1).setOrigin(0).setDepth(D + 50).setAlpha(0)));
        const t = fix(keep(sc.add.text(vx(0.5), vy(0.5), text, { fontFamily: "Georgia, serif", fontSize: "34px", color: "#ffffff", fontStyle: "italic" }).setOrigin(0.5).setDepth(D + 51).setAlpha(0)));
        await c.tw({ targets: bk, alpha: 1, duration: 500 });
        sc.tweens.add({ targets: t, alpha: 1, duration: 400 });
        await c.wait(1700);
        sc.tweens.add({ targets: t, alpha: 0, duration: 300 });
        return bk;
      };
      let bk = await blackCard("One week later...");
      for (const o of stage) o.setVisible(false);
      // ---- 2. the doctor's office
      const office = keep(sc.add.container(0, 0).setDepth(Z));
      // drawn (PixelLab): a consulting room, the x-ray of the lungs up on the lightbox
      const officeArt = prop(sc, "kp_office", V.x, V.y, { w: V.w, h: V.h, ox: 0, oy: 0 });
      // where people stand: on the drawn floor, or on the old flat one
      const feetY = officeArt ? vy(0.95) : vy(0.72);
      if (officeArt) {
        office.add(officeArt);
        // the lightbox's lungs, riddled with it (a scatter of dark spots on the film)
        const xr = sc.add.graphics();
        for (let i = 0; i < 22; i++) xr.fillStyle(0x1e293b, 0.85).fillCircle(vx(0.47) + (Math.random() - 0.5) * 70, vy(0.33) + (Math.random() - 0.5) * 56, 1.5 + Math.random() * 2.5);
        office.add(xr);
        office.add(sc.add.text(vx(0.47), vy(0.53), "DR. JAMESON, MD", { fontFamily: "Georgia, serif", fontSize: "12px", color: "#334155", backgroundColor: "#e2e8f0", padding: { x: 4, y: 1 } }).setOrigin(0.5));
      } else {
        office.add(sc.add.rectangle(V.x, V.y, V.w, V.h * 0.72, 0xdbe4e8).setOrigin(0));
        office.add(sc.add.rectangle(V.x, vy(0.72), V.w, V.h * 0.28, 0x8b9aa3).setOrigin(0));
        office.add(sc.add.rectangle(vx(0.5), vy(0.62), V.w * 0.36, 16, 0x7c5a3a).setStrokeStyle(2, 0x3b2a1a));
        office.add(sc.add.rectangle(vx(0.5), vy(0.8), V.w * 0.3, V.h * 0.32, 0x6b4a2e));
        // the lightbox: lungs, full of it
        office.add(sc.add.rectangle(vx(0.5), vy(0.28), 120, 90, 0x0f172a).setStrokeStyle(4, 0xe5e7eb));
        const xr = sc.add.graphics();
        xr.fillStyle(0x94a3b8, 0.8).fillEllipse(vx(0.5) - 22, vy(0.28), 34, 62).fillEllipse(vx(0.5) + 22, vy(0.28), 34, 62);
        for (let i = 0; i < 26; i++) xr.fillStyle(0x1e293b, 0.9).fillCircle(vx(0.5) + (Math.random() - 0.5) * 70, vy(0.28) + (Math.random() - 0.5) * 60, 1 + Math.random() * 3);
        office.add(xr);
        office.add(sc.add.text(vx(0.5), vy(0.42), "DR. JAMESON, MD", { fontFamily: "Georgia, serif", fontSize: "12px", color: "#334155" }).setOrigin(0.5));
      }
      const doc = sizeTo(sc.add.image(vx(0.7), feetY, sc.textures.exists("spr_TV_DR_JAMESON") ? "spr_TV_DR_JAMESON" : "spr_FOLK1", 0).setOrigin(0.5, 1), V.h * 0.42);
      const patient = sc.add.image(vx(0.3), feetY, T.key, T.frame).setOrigin(0.5, 1);
      sizeTo(patient, V.h * 0.42).setFlipX(true);
      office.add([doc, patient]);
      fix(office);
      await c.tw({ targets: bk, alpha: 0, duration: 500 });
      bk.destroy();
      await c.wait(500);
      voice.say("DR. JAMESON", "I'm afraid you have terminal cancer.");
      const docSay = fix(keep(sc.add.text(doc.x, doc.y - doc.displayHeight - 8, "I'm afraid you have\nterminal cancer.", { fontFamily: "sans-serif", fontSize: "15px", color: "#111", backgroundColor: "#ffffffee", padding: { x: 6, y: 4 }, align: "center" }).setOrigin(0.5, 1).setDepth(Z + 5)));
      await c.wait(2600);
      docSay.destroy();
      const oh = fix(keep(sc.add.text(patient.x, patient.y - patient.displayHeight - 8, "…oh.", { fontFamily: "sans-serif", fontSize: "15px", color: "#111", backgroundColor: "#ffffffee", padding: { x: 6, y: 4 } }).setOrigin(0.5, 1).setDepth(Z + 5)));
      await c.wait(1500);
      oh.destroy();

      // ---- 3. six months later: the hospital bed
      bk = await blackCard("Six months later...");
      office.destroy();
      const ward = keep(sc.add.container(0, 0).setDepth(Z));
      // drawn (PixelLab): an NHS ward (window, drip stand, the heart monitor on its stand) and a hospital bed
      const wardArt = prop(sc, "kp_ward", V.x, V.y, { w: V.w, h: V.h, ox: 0, oy: 0 });
      const bedX = vx(0.5);
      let bedY = vy(0.66);
      // the trace goes on the monitor's screen: the drawn one's, or the old box
      let monX = vx(0.82);
      let monY = vy(0.38);
      let monW = 110;
      let monAmp = 26;
      const bedArt = wardArt ? prop(sc, "kp_bed", bedX, vy(0.96), { w: V.w * 0.5, oy: 1 }) : null;
      if (wardArt && bedArt) {
        ward.add([wardArt, bedArt]);
        // the mattress top, a little over a third of the way down the drawn bed
        bedY = bedArt.y - bedArt.displayHeight * 0.6;
        monX = vx(KP_WARD_SCREEN.x);
        monY = vy(KP_WARD_SCREEN.y);
        monW = V.w * KP_WARD_SCREEN.w;
        monAmp = V.h * KP_WARD_SCREEN.h * 0.4;
      } else {
        wardArt?.destroy();
        bedArt?.destroy();
        ward.add(sc.add.rectangle(V.x, V.y, V.w, V.h * 0.7, 0xcfe3d6).setOrigin(0));
        ward.add(sc.add.rectangle(V.x, vy(0.7), V.w, V.h * 0.3, 0x9fb4a8).setOrigin(0));
        ward.add(sc.add.rectangle(vx(0.18), vy(0.25), 110, 80, 0x93c5fd).setStrokeStyle(5, 0xf8fafc));
        // the bed, side on: frame, mattress, pillow
        ward.add(sc.add.rectangle(bedX, bedY + 10, V.w * 0.46, 16, 0x94a3b8).setStrokeStyle(2, 0x475569));
        ward.add(sc.add.rectangle(bedX - V.w * 0.22, bedY - 26, 10, 80, 0x64748b));
        ward.add(sc.add.rectangle(bedX + V.w * 0.22, bedY - 6, 10, 40, 0x64748b));
        ward.add(sc.add.rectangle(bedX, bedY, V.w * 0.44, 20, 0xf8fafc).setStrokeStyle(1, 0xcbd5e1));
        ward.add(sc.add.ellipse(bedX - V.w * 0.17, bedY - 18, 70, 26, 0xffffff).setStrokeStyle(1, 0xcbd5e1));
        // the monitor
        ward.add(sc.add.rectangle(monX, monY + 70, 6, 120, 0x475569));
        ward.add(sc.add.rectangle(monX, monY, 120, 80, 0x0b1220).setStrokeStyle(4, 0x64748b));
      }
      const trace = sc.add.graphics();
      ward.add(trace);
      fix(ward);
      let spikeAt = -1;
      let flat = false;
      let tx = 0;
      const pts: number[] = [];
      const traceEv = sc.time.addEvent({ delay: 30, loop: true, callback: () => {
        tx = (tx + 2) % 110;
        const sp = !flat && spikeAt >= 0 && sc.time.now - spikeAt < 120 ? -monAmp : 0;
        pts[tx] = sp;
        trace.clear().lineStyle(2, flat ? 0xef4444 : 0x22c55e, 1).beginPath();
        for (let i = 0; i < 110; i += 2) {
          const yy = monY + (pts[i] ?? 0);
          const xx = monX - monW / 2 + (i / 110) * monW;
          if (i === 0) trace.moveTo(xx, yy);
          else trace.lineTo(xx, yy);
        }
        trace.strokePath();
      } });
      // the patient: lying back, propped on the pillow; what's left of them. Bald, grey, sunken, a hospital gown
      // the patient: this boss's own cancer-ward portrait (bald, grey, wasted, a gown, propped on the pillow) when there is
      // one; otherwise their head off the sprite, made bald and grey here
      const artKey = T.id ? `cancer_${T.id}` : "";
      const hasArt = !!artKey && sc.textures.exists(artKey);
      let pHead: Phaser.GameObjects.Image;
      let eyeW: { x: number; y: number; s: number }[] = [];
      const pale = 0xd8d6c4;
      const gown = fix(keep(sc.add.graphics().setDepth(Z + 2)));
      const face = fix(keep(sc.add.graphics().setDepth(Z + 2)));
      if (hasArt) {
        pHead = fix(keep(sc.add.image(bedX - V.w * 0.15, bedY + 4, artKey).setOrigin(0.5, 1).setDepth(Z + 1)));
        sizeTo(pHead, V.h * 0.36);
        // the blanket over the rest of them (the drawn bed has its own)
        if (!bedArt) {
          gown.fillStyle(0xe0f2fe).fillRoundedRect(bedX - V.w * 0.05, bedY - 18, V.w * 0.26, 22, 8);
          gown.lineStyle(1, 0xbae6fd).strokeRoundedRect(bedX - V.w * 0.05, bedY - 18, V.w * 0.26, 22, 8);
        }
      } else {
        pHead = fix(part(0, 0, 1, NECK, Z + 1));
        const hm = (V.h * 0.2) / (hhPx * sA);
        pHead.setScale(T.scale * hm).setPosition(bedX - V.w * 0.17, bedY - 22 - (hhPx * sA * hm) / 2 + 6).setDepth(Z + 1).setVisible(true);
        // its real drawn size decides where it sits: chin on the pillow
        pHead.setY(bedY - 14 - pHead.getBounds().height / 2);
        pHead.setTint(0xc9cdbf);
        // where it really is on screen (HD art is drawn at a fraction of the scale it's given, so measure, don't compute)
        const hb = pHead.getBounds();
        const onPH = (x: number, y: number) => ({ x: T.flip ? hb.right - ((x + 0.5) / hwPx) * hb.width : hb.x + ((x + 0.5) / hwPx) * hb.width, y: hb.y + ((y + 0.5) / hhPx) * hb.height, s: hb.width / hwPx });
        const sw = hb.width;
        gown.fillStyle(0x7dd3fc).fillRoundedRect(pHead.x - sw * 0.32, pHead.y + hb.height / 2 - 4, sw * 0.64, 26, 6);
        gown.fillStyle(0x38bdf8, 0.6).fillCircle(pHead.x - sw * 0.1, pHead.y + hb.height / 2 + 8, 2).fillCircle(pHead.x + sw * 0.12, pHead.y + hb.height / 2 + 14, 2);
        // the blanket over a body that's barely there
        gown.fillStyle(0xe0f2fe).fillRoundedRect(bedX - V.w * 0.13, bedY - 18, V.w * 0.33, 22, 8);
        gown.lineStyle(1, 0xbae6fd).strokeRoundedRect(bedX - V.w * 0.13, bedY - 18, V.w * 0.33, 22, 8);
        // a thin, thin arm on the blanket
        gown.fillStyle(pale).fillRect(pHead.x + sw * 0.1, bedY - 16, V.w * 0.12, 4);
        // bald: a pale scalp over the hair (or hat), and hollow eyes
        const hTop = hb.y;
        // bald: everything above the brow (hair, hat) is cut away and a bare, pale dome drawn in its place
        const eyeY = eyes.length ? eyes.reduce((a, e) => a + e.y, 0) / eyes.length : hhPx * 0.5;
        const brow = Math.max(0, Math.round(eyeY - hhPx * 0.16));
        pHead.setCrop(0, brow, hwPx, hhPx - brow);
        const hhW = hb.height;
        const browY = hTop + (brow / hhPx) * hb.height;
        const domeH = Math.max(hhW * 0.36, browY - hTop + hhW * 0.05);
        // the scalp is their own skin (sampled from the cheek), gone the same sickly grey as the rest of the face
        const ex = eyes.length ? Math.round(eyes.reduce((a, e) => a + e.x, 0) / eyes.length) : Math.round(hwPx / 2);
        const cheek = pxAt(ex, Math.min(hhPx - 1, Math.round(eyeY + hhPx * 0.12)));
        const mul = (col: number, t: number) => {
          const r = ((col >> 16) & 255) * (((t >> 16) & 255) / 255);
          const g = ((col >> 8) & 255) * (((t >> 8) & 255) / 255);
          const b2 = (col & 255) * ((t & 255) / 255);
          return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b2);
        };
        // the head's real width (and middle) just under the brow: shoulders and hat brims don't count
        const rowY = Math.min(hhPx - 1, brow + Math.max(1, Math.round(hhPx * 0.06)));
        let l0 = -1;
        let l1 = -1;
        for (let x = 0; x < hwPx; x++) {
          const col = pxAt(x, rowY);
          if (col && col.alpha > 0) {
            if (l0 < 0) l0 = x;
            l1 = x;
          }
        }
        const domeW = l0 >= 0 ? Math.min(sw * 0.62, ((l1 - l0 + 1) / hwPx) * sw * 1.02) : sw * 0.5;
        const domeX = l0 >= 0 ? onPH((l0 + l1) / 2, 0).x : pHead.x;
        const scalp = cheek && cheek.alpha > 0 ? lerpCol(mul(cheek.color, 0xc9cdbf), 0xd8d6c4, 0.25) : pale;
        // the dome sits on top of the brow line, never over the face
        face.fillStyle(scalp).fillEllipse(domeX, browY - domeH * 0.42, domeW, domeH * 1.0);
        face.fillStyle(scalp).fillRect(domeX - domeW / 2, browY - domeH * 0.42, domeW, domeH * 0.42 + 2);
        face.fillStyle(0xf1efe2, 0.6).fillEllipse(domeX - domeW * 0.16, browY - domeH * 0.65, domeW * 0.24, domeH * 0.16);
        eyeW = eyes.map((e) => onPH(e.x, e.y));
        for (const e of eyeW) face.fillStyle(0x6b5a4a, 0.45).fillEllipse(e.x, e.y + e.s, e.s * 5, e.s * 4);
      }
      // the family round the bed
      const famKeys = ["spr_TV_WOMAN", "spr_TV_JOHN", "spr_TV_MARY", "spr_KD_WOMAN"].filter((k) => sc.textures.exists(k));
      const fam = famKeys.slice(0, 3).map((k, i) => {
        // round the bed but clear of the pillow: two at the head end, one at the foot
        const f = sizeTo(sc.add.image([vx(0.1), vx(0.19), vx(0.79)][i], bedArt ? vy(0.93) : vy(0.8), k, 0).setOrigin(0.5, 1), V.h * (bedArt ? 0.36 : 0.3));
        if (i === 2) f.setFlipX(true);
        return fix(keep(f.setDepth(Z + 3)));
      });
      await c.tw({ targets: bk, alpha: 0, duration: 600 });
      bk.destroy();
      // beep… beep…… beep……… (slower each time)
      for (const gap of [900, 1100, 1400, 1800, 2300]) {
        spikeAt = sc.time.now;
        synth.play("monbeep", 0.7);
        await c.wait(gap);
      }
      // the eyes close for the last time
      if (hasArt && sc.textures.exists(`${artKey}_closed`)) pHead.setTexture(`${artKey}_closed`);
      const lids = fix(keep(sc.add.graphics().setDepth(Z + 3)));
      for (const e of eyeW) {
        lids.fillStyle(pale, 1).fillRect(e.x - e.s * 2.6, e.y - e.s * 1.4, e.s * 5.2, e.s * 3);
        lids.lineStyle(Math.max(1, e.s * 0.7), 0x3f2f22, 1).lineBetween(e.x - e.s * 2.4, e.y + e.s * 0.6, e.x + e.s * 2.4, e.y + e.s * 0.6);
      }
      await c.wait(600);
      flat = true;
      synth.play("flatline");
      await c.wait(900);
      // and the family weep
      synth.play("weeping");
      const tears = sc.time.addEvent({ delay: 140, loop: true, callback: () => {
        const f = fam[Math.floor(Math.random() * fam.length)];
        if (!f?.active) return;
        const tx0 = f.x + (Math.random() - 0.5) * 10;
        const ty0 = f.y - f.displayHeight * 0.82;
        const d = fix(bitk("tear", tx0, ty0, 9, Z + 4) ?? keep(sc.add.circle(tx0, ty0, 2, 0x60a5fa).setDepth(Z + 4)));
        sc.tweens.add({ targets: d, y: d.y + 30, alpha: 0, duration: 600, onComplete: () => d.destroy() });
      } });
      const sobs = fam.map((f, i) => fix(keep(sc.add.text(f.x, f.y - f.displayHeight - 6, ["*sob*", "Why?!", "*sniff*"][i], { fontFamily: "sans-serif", fontSize: "13px", color: "#1e3a8a", fontStyle: "italic" }).setOrigin(0.5, 1).setDepth(Z + 4))));
      for (const f of fam) sc.tweens.add({ targets: f, y: f.y + 2, yoyo: true, repeat: -1, duration: 260 });
      await c.wait(2600);
      // a moment's silence…
      for (const t of sobs) t.destroy();
      await c.wait(900);

      // ---- 4. …and then you, through the door, with a chainsaw
      synth.play("smash");
      cam.shake(250, 0.012);
      const meDepth = c.me.depth;
      // (HD art: set the scale from his own, measured off a unit scale, never read back)
      c.me.setScale(1);
      const meK = (V.h * 0.3) / Math.max(1, c.me.displayHeight);
      // (scale is set from his own, never read back off the HD sprite after a texture swap)
      c.me.setVisible(true).setPosition(V.x - 60, bedArt ? vy(0.8) : vy(0.74)).setDepth(Z + 6).setScrollFactor(0).setScale(meK);
      // the chainsaw is in his hands (krelact saw row, revving); a drawn one carried along if he hasn't got the row
      const saw = keep(sc.add.container(0, 0).setDepth(Z + 7));
      const sawArt = act.sheet ? null : prop(sc, "kp_chainsaw", 0, 0, { w: 44 });
      if (sawArt) saw.add(sawArt);
      else if (!act.sheet) {
        saw.add(sc.add.rectangle(0, 0, 26, 16, 0xf97316).setStrokeStyle(2, 0x7c2d12));
        saw.add(sc.add.rectangle(30, 0, 40, 7, 0x9ca3af).setStrokeStyle(1, 0x374151));
        for (let i = 0; i < 9; i++) saw.add(sc.add.triangle(14 + i * 4.5, -4, 0, 0, 3, 0, 1.5, -3, 0xe5e7eb));
      }
      fix(saw);
      saw.setScale(1.6);
      const follow = sc.time.addEvent({ delay: 16, loop: true, callback: () => saw.setPosition(c.me.x + 30, c.me.y - c.me.displayHeight * 0.45) });
      // revving: the first few frames of his saw row, over and over, until he's on the bed
      let carving = false;
      const revving = act.sheet ? sc.time.addEvent({ delay: 300, loop: true, callback: () => !carving && void act.play("saw", { frames: [1, 3], hold: true, fps: 20, yoyo: true }) }) : null;
      synth.play("gun_chainsaw");
      const rev = sc.time.addEvent({ delay: 600, loop: true, callback: () => synth.play("gun_chainsaw", 0.8) });
      const yell = fix(keep(sc.add.text(vx(0.5), vy(0.12), "GET WELL SOON!", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#fde047", stroke: "#000", strokeThickness: 7 }).setOrigin(0.5).setDepth(Z + 20).setScale(0.3)));
      sc.tweens.add({ targets: yell, scale: 1, duration: 300, ease: "Back.out" });
      for (const f of fam) {
        sc.tweens.killTweensOf(f);
        sc.tweens.add({ targets: f, y: f.y - 14, yoyo: true, duration: 120 });
      }
      synth.play("scream_woman");
      // up onto the bed, through the patient, end to end
      await c.tw({ targets: c.me, x: bedX - V.w * 0.2, y: bedY - c.me.displayHeight * 0.4, duration: 500, ease: "Quad.out" });
      yell.destroy();
      traceEv.remove();
      tears.remove();
      // carve: the head, then the body in lumps, each one launched, blood and guts going everywhere
      const lumps: Obj[] = [pHead];
      // what comes up off the bed under the saw: drawn hunks of them (the bits sheet), blanket and all
      const hunks: Bit[] = ["meatbone", "gutrope", "meat", "liver"];
      for (let i = 0; i < 4; i++) {
        const lx = bedX - V.w * 0.1 + i * V.w * 0.075;
        const lump = keep(sc.add.container(lx, bedY - 8).setDepth(Z + 3));
        const hk = bit(sc, hunks[i], 0, 0, V.w * 0.075);
        if (hk) lump.add(hk);
        else {
          lump.add(sc.add.rectangle(0, 0, V.w * 0.07, 22, 0xe0f2fe).setStrokeStyle(1, 0xbae6fd));
          lump.add(sc.add.rectangle(-V.w * 0.035 + 2, 0, 5, 20, 0xb91c1c));
          lump.add(sc.add.rectangle(V.w * 0.035 - 2, 0, 5, 20, 0xb91c1c));
        }
        // hidden in the bed until the saw gets there
        if (hk) lump.setVisible(false);
        lumps.push(fix(lump));
      }
      gown.clear();
      face.clear();
      lids.clear();
      // (the shared blood helpers draw in the world: these go on the screen layer with everything else)
      const spray = (x: number, y: number) => {
        synth.play("blood_spray");
        c.fx("vfx_bloodspray", x, y, 2.4, { fixed: true, depth: Z + 8, flipX: Math.random() < 0.5 });
        c.fx("vfx_blood", x + (Math.random() - 0.5) * 40, y, 2, { fixed: true, depth: Z + 8, delay: 80 });
        c.fx("vfx_gore", x, y - 10, 2.2, { fixed: true, depth: Z + 8, flipX: Math.random() < 0.5 });
        for (let n = 0; n < 14; n++) {
          const d = fix(bitk(n % 3 ? "drop" : "shred", x, y, 8 + Math.random() * 8, Z + 8) ?? keep(sc.add.rectangle(x, y, 3 + Math.random() * 6, 3 + Math.random() * 5, Math.random() < 0.6 ? 0xdc2626 : 0x7f1d1d).setDepth(Z + 8)));
          toss(d, (Math.random() - 0.5) * 700, -150 - Math.random() * 380, vy(0.9) + Math.random() * 30, (Math.random() - 0.5) * 600);
        }
        const offal: Bit[] = ["gutrope", "guts", "kidney", "eyeball", "heart2", "lungs", "tooth"];
        for (let n = 0; n < 3; n++) {
          const g = fix(bitk(offal[Math.floor(Math.random() * offal.length)], x, y, 22, Z + 8) ?? keep(sc.add.ellipse(x, y, 16, 8, 0xf472b6).setStrokeStyle(1, 0x9d174d).setDepth(Z + 8)));
          toss(g, (Math.random() - 0.5) * 500, -200 - Math.random() * 300, vy(0.9), (Math.random() - 0.5) * 900, () => synth.play("splat", 0.6));
        }
      };
      for (let i = 0; i < lumps.length; i++) {
        const L = lumps[i];
        await c.tw({ targets: c.me, x: (L as unknown as { x: number }).x - 24, duration: 160, ease: "Sine.inOut" });
        // the saw comes down (the swing of his saw row)
        if (act.sheet) {
          carving = true;
          void act.play("saw", { frames: [4, 8], hold: true, fps: 28 });
        }
        (L as unknown as { setVisible(v: boolean): void }).setVisible(true);
        synth.play("flesh_rip");
        synth.play("splat");
        cam.shake(160, 0.012);
        spray((L as unknown as { x: number }).x, (L as unknown as { y: number }).y);
        toss(L, (Math.random() - 0.5) * 520, -260 - Math.random() * 260, vy(0.92), (Math.random() - 0.5) * 1100, () => synth.play("splat"));
        // the family get it too: redder and redder, screaming
        for (const f of fam) {
          const k = Math.min(1, (i + 1) / lumps.length);
          f.setTint(lerpCol(0xffffff, 0xb91c1c, k * 0.85));
        }
        if (i % 2 === 0) synth.play(i % 4 === 0 ? "scream_man" : "scream_woman");
        // and the screen
        for (let n = 0; n < 3; n++) {
          const sx = Math.random() * 960;
          const sy = Math.random() * 400;
          // drawn splats of goo on the lens, running down
          const gw = 40 + Math.random() * 110;
          const gArt = prop(sc, "kp_goo", sx, sy, { w: gw, h: gw * (0.5 + Math.random() * 0.4), depth: D + 48 });
          const bl = keep(gArt ? gArt.setScrollFactor(0).setAlpha(0.9).setFlipX(Math.random() < 0.5) : sc.add.ellipse(sx, sy, 30 + Math.random() * 90, 20 + Math.random() * 60, Math.random() < 0.6 ? 0xb91c1c : 0x7f1d1d, 0.85).setScrollFactor(0).setDepth(D + 48));
          sc.tweens.add({ targets: bl, y: sy + 40 + Math.random() * 60, scaleY: 1.4, duration: 2600, ease: "Sine.in" });
        }
      }
      rev.remove();
      follow.remove();
      revving?.remove();
      act.cheer();
      // the family, dripping, still screaming; the flatline still going
      for (const f of fam) sc.tweens.add({ targets: f, x: f.x + (Math.random() - 0.5) * 8, yoyo: true, repeat: -1, duration: 70 });
      synth.play("scream_woman");
      synth.play("scream_man");
      await c.wait(900);
      card();
      await c.wait(2200);
      c.me.setScrollFactor(1).setDepth(meDepth).setScale(c.ps);
      break;
    }

    case "freeze": {
      cam.pan(tg.x - W * 0.2, tg.y, 600, "Sine.easeInOut");
      cam.zoomTo(1.9, 600);
      synth.play("transform_sparkle");
      // the freeze ray: his ray row, firing (twice through), ice coming out of the muzzle
      void act.play("ray", { fps: 12 }).then(() => act.play("ray", { fps: 12 }));
      const stream = sc.time.addEvent({ delay: 25, repeat: 44, callback: () => {
        const mx = act.sheet ? c.me.x + c.me.displayWidth * 0.26 : c.me.x + 16;
        const my = act.sheet ? c.me.y + c.me.displayHeight * 0.1 : c.me.y - 14;
        const f = bitk(Math.random() < 0.5 ? "iceshard" : "icechunk", mx, my, 5 + Math.random() * 5)?.setAlpha(0.95) ?? keep(sc.add.circle(mx, my, 2 + Math.random() * 3, Math.random() < 0.5 ? 0xe0f2fe : 0x7dd3fc, 0.9).setDepth(D + 6));
        sc.tweens.add({ targets: f, x: tg.x + (Math.random() - 0.5) * W * 0.6, y: tg.y + (Math.random() - 0.5) * H * 0.7, alpha: 0.2, duration: 380, onComplete: () => f.destroy() });
      } });
      const col = { k: 0 };
      sc.tweens.add({ targets: col, k: 1, duration: 1100, onUpdate: () => body.setTint(lerpCol(0xffffff, 0x7dd3fc, col.k)) });
      synth.voice("oh", 0.5, 0.9);
      const iw = W * 1.2 + 16;
      const ih = H * 1.08 + 10;
      const ice = keep(sc.add.container(tg.x, floor + 6).setDepth(D + 3));
      // drawn (PixelLab): a block of clear ice, cracks and frost and all, see-through so they're in it
      const iceArt = prop(sc, "kp_ice", 0, 0, { w: iw * 1.1, h: ih * 1.12, oy: 1 });
      if (iceArt) ice.add(iceArt.setAlpha(0.72));
      else {
        ice.add(sc.add.rectangle(0, 0, iw, ih, 0xbae6fd, 0.42).setOrigin(0.5, 1).setStrokeStyle(3, 0xe0f2fe, 0.95));
        const gl = sc.add.graphics();
        gl.lineStyle(5, 0xffffff, 0.45).lineBetween(-iw * 0.36, -ih * 0.2, -iw * 0.12, -ih * 0.78);
        gl.lineStyle(2, 0xffffff, 0.6).lineBetween(-iw * 0.22, -ih * 0.12, 0, -ih * 0.5);
        ice.add(gl);
      }
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
      // the wind-up, then the punch, in slow motion (his punch row: fist back, then all of it)
      act.idle();
      void act.play("punch", { frames: [0, 3], hold: true, fps: 10 });
      await c.tw({ targets: c.me, x: c.me.x - 40, duration: 380, ease: "Quad.out" });
      await c.wait(250);
      c.slow(0.25);
      void act.play("punch", { frames: [4, 6], hold: true, fps: 24 });
      await c.tw({ targets: c.me, x: tg.x - W * 0.5 - 10 - (act.sheet ? c.me.displayWidth * 0.2 : 0), duration: 140, ease: "Quad.in" });
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
        const sx2 = tg.x + (Math.random() - 0.5) * iw;
        const sy2 = floor - Math.random() * ih;
        const s = bitk(i % 3 ? "icechunk" : "iceshard", sx2, sy2, 8 + Math.random() * 12, D + 5) ?? keep(sc.add.triangle(sx2, sy2, 0, 0, 6 + Math.random() * 12, 2, 3, 10 + Math.random() * 14, 0xbae6fd, 0.85).setStrokeStyle(1, 0xffffff).setDepth(D + 5));
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
          const mx2 = tg.x + (Math.random() - 0.5) * W * 0.5;
          const my2 = tg.y + (Math.random() - 0.5) * H * 0.6;
          // frozen offal: drawn, with a frost on it
          const m = bitk((["meat", "heart", "kidney", "liver", "eyeball", "shred", "brain", "gutrope"] as Bit[])[i], mx2, my2, 12 + Math.random() * 6, D + 5)?.setTint(0xcfe8ff) ?? keep(sc.add.rectangle(mx2, my2, 5 + Math.random() * 6, 4 + Math.random() * 5, 0x9f1239).setStrokeStyle(1, 0xbae6fd).setDepth(D + 5));
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
      // drawn: the floor breaks up under them, a puff of dust
      const rubble = img("kp_rubble", tg.x, floor + 3, { w: W * 1.1, depth: D + 1 });
      if (rubble) {
        c.fx("vfx_dust", tg.x, floor, Math.max(0.8, W / 60));
        sc.tweens.add({ targets: rubble, x: { from: tg.x - 2, to: tg.x + 2 }, yoyo: true, repeat: 8, duration: 50 });
      }
      for (let i = 0; i < 6 && !rubble; i++) {
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
      const glb = bitk("star", tg.x, floor - 2, 14, D + 7)?.setTintFill(0xffffff);
      const glint = glb ?? keep(sc.add.star(tg.x, floor - 2, 4, 2, 10, 0xffffff).setDepth(D + 7));
      const glk = glb ? glb.scaleX : 1;
      glint.setScale(0);
      synth.play("ding");
      await c.tw({ targets: glint, scale: glk, angle: 90, yoyo: true, duration: 200 });
      await c.wait(400);
      // SHUNK: a drawn steel spit (PixelLab) shoots up out of the floor; only the part above the floor shows
      const sk = keep(sc.add.graphics().setDepth(D + 1.5));
      sk.setPosition(tg.x, floor + 4);
      const st = { len: 0 };
      const skImg = img("kp_skewer", tg.x, floor + 4, { h: H * 1.75 + 80, ox: 0.5, oy: 0, depth: D + 1.5 });
      const draw = () => {
        if (skImg) {
          skImg.setY(floor + 4 - st.len).setCrop(0, 0, skImg.frame.width, Math.max(0, st.len / skImg.scaleY));
          return;
        }
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
        // dripping down the spit (drawn drops), a pool spreading under it
        const y0 = tg.y - lift + H * 0.45;
        const dripEv = sc.time.addEvent({ delay: 160, repeat: 30, callback: () => {
          const d = bitk("drop", tg.x + 2, y0, 6, D + 1.6);
          if (d) sc.tweens.add({ targets: d, y: floor - 2, duration: 600, ease: "Quad.in", onComplete: () => d.destroy() });
        } });
        void dripEv;
        const pool = img("kp_goo", tg.x, floor + 2, { w: 4, h: 2, depth: D + 1 });
        if (pool) sc.tweens.add({ targets: pool, scaleX: (W * 0.9) / pool.frame.width, scaleY: (W * 0.3) / pool.frame.height, duration: 4000 });
        else {
          const drip = keep(sc.add.rectangle(tg.x + 1, y0, 4, 1, 0xb91c1c).setOrigin(0.5, 0).setDepth(D + 1.6));
          sc.tweens.add({ targets: drip, displayHeight: floor - drip.y, duration: 1800, ease: "Sine.in" });
        }
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
        act.walk();
        await c.tw({ targets: c.me, x: tg.x - W * 0.45 - 26, duration: 300 });
        act.idle();
        const px = c.me.x + 34;
        const py = floor - 6;
        // a drawn pitta (PixelLab), salad in already, waiting on the floor
        if (!img("kp_pitta", px, py - 4, { w: 44, depth: D + 3 })) {
          const pit = keep(sc.add.graphics().setDepth(D + 3));
          pit.fillStyle(0xe7c98f, 1).fillEllipse(px, py, 44, 18);
          pit.fillStyle(0x16a34a, 1).fillCircle(px - 10, py - 7, 4).fillCircle(px + 2, py - 8, 4);
          pit.fillStyle(0xdc2626, 1).fillCircle(px + 10, py - 7, 3);
        }
        const kx = tg.x + (tg.flip ? -1 : 1) * W * 0.25;
        // the carve: his blade up, and one long stroke down the side of it (krelact katana row)
        await act.play("katana", { frames: [0, 4], hold: true, fps: 14 });
        synth.play("swing");
        void act.play("katana", { frames: [5, 8], hold: true, fps: 16 });
        c.fx("vfx_crit", kx, tg.y - lift, Math.max(0.6, H / 120), { add: true, depth: D + 7 });
        await c.wait(260);
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
      // drawn (PixelLab): two laser emitter posts up out of the floor, a third along the top as the bar
      const postArt = sc.textures.exists("kp_emitter");
      const posts = [lx, rx].map((x, i) => (postArt ? img("kp_emitter", x, floor + 4, { w: 16, h: floor + 4 - barY, oy: 1, depth: D + 5, flip: i === 1 }) : null) ?? keep(sc.add.rectangle(x, floor + 4, 14, floor + 4 - barY, 0x111827).setOrigin(0.5, 1).setStrokeStyle(2, 0x374151).setDepth(D + 5)));
      const postK = posts.map((o) => o.scaleY);
      posts.forEach((o) => o.setScale(o.scaleX, 0));
      const bar = (postArt ? img("kp_emitter", tg.x, barY - 200, { w: 14, h: rx - lx + 14, depth: D + 5 })?.setAngle(90) : null) ?? keep(sc.add.rectangle(tg.x, barY - 200, rx - lx + 14, 12, 0x111827).setStrokeStyle(2, 0x374151).setDepth(D + 5));
      synth.play("door");
      posts.forEach((o, i) => sc.tweens.add({ targets: o, scaleY: postK[i], duration: 500, ease: "Quad.out" }));
      await c.tw({ targets: bar, y: barY, duration: 500, ease: "Bounce.out" });
      // and you switch it on
      void act.play("det", { hold: true });
      synth.play("drone");
      const cuts = [0.22, 0.48, 0.74];
      const beam = async (x1: number, y1: number, x2: number, y2: number) => {
        const led = bitk("bomblight", x1, y1, 9, D + 6) ?? keep(sc.add.circle(x1, y1, 3, 0xef4444).setDepth(D + 6));
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
        // drawn (PixelLab): a glowing x-ray of the bone, cut in two along where it breaks
        const xKey = `kp_xray_${kind}`;
        if (sc.textures.exists(xKey)) {
          const mk = () => {
            const im = sc.add.image(0, kind === "skull" ? -4 : 0, xKey);
            im.setScale(Math.min(170 / im.frame.height, 220 / im.frame.width));
            return im;
          };
          const ia = mk();
          const ib = mk();
          const fw2 = ia.frame.width;
          const fh2 = ia.frame.height;
          if (kind === "ribs") {
            ia.setCrop(0, 0, fw2 / 2, fh2);
            ib.setCrop(fw2 / 2, 0, fw2 / 2, fh2);
          } else {
            const cut = kind === "skull" ? 0.68 : 0.5;
            ia.setCrop(0, 0, fw2, fh2 * cut);
            ib.setCrop(0, fh2 * cut, fw2, fh2 * (1 - cut));
          }
          a.add(ia);
          b.add(ib);
          ga.setVisible(false);
          gb.setVisible(false);
        } else if (kind === "skull") {
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
        // his punch row: fist back with the step back, the rest of it with the lunge
        void act.play("punch", { frames: [0, 4], hold: true, fps: 22 });
        await c.tw({ targets: c.me, x: homeX - 18, duration: 180, ease: "Quad.out" });
        void act.play("punch", { frames: [5, 8], fps: 20 });
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
            // drawn bone splinters, gone x-ray blue
            const f = (bit(sc, k % 2 ? "shards" : "bonebroken", 0, i === 0 ? 20 : 0, 16)?.setTint(0x9eeeff) ?? sc.add.rectangle(0, i === 0 ? 20 : 0, 3 + Math.random() * 5, 3 + Math.random() * 4, bone)).setScrollFactor(0);
            P.pc.add(f);
            sc.tweens.add({ targets: f, x: (Math.random() - 0.5) * 180, y: (Math.random() - 0.3) * 140, angle: 400, alpha: 0.3, duration: 500 });
          }
          for (let k = 0; k < 5; k++) {
            const bx = (Math.random() - 0.5) * 120;
            const by = (Math.random() - 0.5) * 100;
            const sp = bit(sc, "splat", bx, by, 12);
            if (sp) {
              P.pc.add(sp.setScrollFactor(0).setAlpha(0.9));
              sc.tweens.add({ targets: sp, scale: (20 + Math.random() * 16) / 32, duration: 300 });
              continue;
            }
            const bl = sc.add.circle(bx, by, 3, 0xdc2626, 0.85).setScrollFactor(0);
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
      // with his action sheet the blade is in his hands (krelact katana row): drawn, raised back, then the cut
      const held = !!act.sheet;
      sword.setVisible(!held);
      synth.play("swing2");
      if (held) await act.play("katana", { frames: [0, 2], hold: true, fps: 8 });
      else await c.tw({ targets: sword, scaleY: 1, duration: 400, ease: "Quad.out" });
      const gb = held ? bit(sc, "star", c.me.x + c.me.displayWidth * 0.3, c.me.y + c.me.displayHeight * 0.08, 12, D + 7) : null;
      const glint = gb ? keep(gb.setTintFill(0xffffff)) : sc.add.star(0, 0, 4, 2, 8, 0xffffff);
      if (!gb) sword.add(glint);
      synth.play("ding");
      await c.tw({ targets: glint, y: gb ? glint.y - 10 : -Lb, x: gb ? glint.x + 14 : 0, duration: 300, angle: 180 });
      glint.destroy();
      // the wind-up: crouch, blade back
      if (held) void act.play("katana", { frames: [3, 4], hold: true, fps: 6 });
      sc.tweens.add({ targets: sword, angle: -70, duration: 400, ease: "Quad.out" });
      sc.tweens.add({ targets: c.me, y: c.me.y + 4, duration: 400 });
      await scaleTo(c.me, [c.ps, c.ps], [c.ps, c.ps * 0.85], { duration: 400 });
      synth.play("telegraph");
      await c.wait(600);
      // the draw-cut: you're past them before anyone sees it
      const endX = tg.x + W * 0.5 + 40;
      synth.play("swing3");
      // the cut itself: a drawn shockwave slash across the neck (an arc of light if the effect isn't loaded)
      if (!c.fx("vfx_shock", tg.x, nY, Math.max(0.5, W / 110), { angle: -4, add: true, depth: D + 8 })) {
        const arc = keep(sc.add.graphics().setDepth(D + 8));
        arc.lineStyle(6, 0xffffff, 1).lineBetween(tg.x - W * 0.6, nY + 6, tg.x + W * 0.6, nY - 6);
        arc.lineStyle(2, 0xbae6fd, 0.7).lineBetween(tg.x - W * 0.7, nY + 12, tg.x + W * 0.7, nY - 2);
        sc.tweens.add({ targets: arc, alpha: 0, duration: 500 });
      }
      sc.tweens.add({ targets: sword, x: endX + 12, angle: 110, duration: 90 });
      if (held) void act.play("katana", { frames: [5, 8], hold: true, fps: 40 });
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
      if (held) act.idle();
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
          const ry = head.y + head.displayHeight * 0.3;
          const db = bitk("drop", head.x, ry, 5 + Math.random() * 4, D + 4);
          const d = db ?? keep(sc.add.circle(head.x, ry, 2 + Math.random() * 2.5, 0xb91c1c).setDepth(D + 4));
          // drops land as little splats
          toss(d, (Math.random() - 0.5) * 20, 0, floor - Math.random() * 6, 0, () => (db ? db.setFrame(22).setScale(db.scaleX * 1.2, db.scaleY * 0.7) : d.setScale(2, 0.7)));
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
        const hair = bitk("hair", tg.x, top + 2, 9) ?? keep(sc.add.rectangle(tg.x, top + 2, 1.5, 6, 0x1f1206).setDepth(D + 6));
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

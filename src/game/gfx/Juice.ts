import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { G } from "../G";
import { hdFactor } from "./HD";

/**
 * Game-feel helpers for the big moments: letterbox bars, punch-in zooms, white flashes, shockwave rings, boss title
 * cards, squash-and-stretch, a soft vignette and real-time slow-mo. Everything is screen-fixed where it should be
 * (scrollFactor 0), cleans itself up, and is safe to call when the scene is shutting down.
 */

const alive = (sc: Phaser.Scene) => !!sc.sys && sc.sys.isActive() && !!sc.cameras?.main;
const shakeOn = () => G.meta?.settings?.shake !== false;
/**
 * A drawn still or close-up can have an animated version (`<key>_anim`, a strip of frames): use it if it's there.
 * Returns the texture key and a start(img) that cycles its frames until the image goes.
 */
const ANIM_MODE: Record<string, "pingpong" | "once" | "reverse"> = { fe_still_spirit: "once", fe_eyes_concept: "reverse", fe_still_drongus_break: "reverse", fe_cut_drongus1: "reverse", fe_still_collapse: "once" };
function animated(sc: Phaser.Scene, key: string) {
  const ak = `${key}_anim`;
  if (!sc.textures.exists(ak) || sc.textures.get(ak).frameTotal < 4) return { key, start: (_img: Phaser.GameObjects.Image) => undefined };
  const n = sc.textures.get(ak).frameTotal - 1;
  const mode = ANIM_MODE[key] ?? "pingpong";
  // ping-pong for loops (no jump back to the start); once plays through and holds; reverse plays backwards and holds
  const seq = mode === "once" ? [...Array(n).keys()] : mode === "reverse" ? [...Array(n).keys()].reverse() : [...Array(n).keys(), ...[...Array(n).keys()].reverse().slice(1, -1)];
  return {
    key: ak,
    start: (img: Phaser.GameObjects.Image) => {
      let i = 0;
      img.setFrame(seq[0]);
      const id = window.setInterval(() => {
        if (!img.active) return window.clearInterval(id);
        i++;
        if (mode !== "pingpong" && i >= seq.length) return window.clearInterval(id);
        img.setFrame(seq[i % seq.length]);
      }, 85);
      img.once("destroy", () => window.clearInterval(id));
    },
  };
}

/** Not shut down (a scene that's been left: anything awaiting a cinematic beat in it should just stop there). */
const living = (sc: Phaser.Scene) => !!sc.sys && sc.sys.settings.status < Phaser.Scenes.SHUTDOWN;
/** "Reduce flashing" is on: full-screen flashes are dimmed and slowed, strobing effects are skipped. */
export const calm = () => !!G.meta?.settings?.calmFlash;

/**
 * A screen-space layer at `depth` that ignores the camera's zoom (a scrollFactor-0 object still gets zoomed, which
 * pushes letterbox bars off screen during a punch-in). Put overlay objects in here at screen coordinates.
 */
export function layer(sc: Phaser.Scene, depth: number): Phaser.GameObjects.Container {
  const store = sc as unknown as { __juiceLayers?: Map<number, Phaser.GameObjects.Container> };
  store.__juiceLayers ??= new Map();
  const have = store.__juiceLayers.get(depth);
  if (have && have.active && have.scene === sc) return have;
  const c = sc.add.container(0, 0).setScrollFactor(0).setDepth(depth);
  pinToScreen(sc, c);
  sc.events.once("shutdown", () => store.__juiceLayers?.clear());
  store.__juiceLayers.set(depth, c);
  return c;
}

/**
 * Keep a screen-space container (at 0,0, scrollFactor 0) the same size and place on screen whatever the camera's
 * zoom and rotation are doing. Use it for a scene's own dialogue box when that scene punches the camera in.
 */
export function pinToScreen(sc: Phaser.Scene, c: Phaser.GameObjects.Container) {
  const fix = () => {
    if (!c.active) return;
    const z = sc.cameras.main.zoom || 1;
    const r = (sc.cameras.main as unknown as { rotation?: number }).rotation || 0;
    c.setScale(1 / z);
    if (r) {
      c.setRotation(-r);
      const cx = 480 - (480 * Math.cos(-r) - 270 * Math.sin(-r)) / z;
      const cy = 270 - (480 * Math.sin(-r) + 270 * Math.cos(-r)) / z;
      c.setPosition(cx, cy);
    } else c.setRotation(0).setPosition(480 * (1 - 1 / z), 270 * (1 - 1 / z));
  };
  sc.events.on("postupdate", fix);
  c.once("destroy", () => sc.events.off("postupdate", fix));
  fix();
}

/** Pin a DialogueBox (its private root container) to the screen. */
export function pinDialogue(sc: Phaser.Scene, box: unknown) {
  const root = (box as { root?: Phaser.GameObjects.Container }).root;
  if (root) pinToScreen(sc, root);
}

/** Real-time wait (ignores the scene's time scale, so it works while slow-mo is on). */
export function realWait(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

/** Cinematic bars that slide in from the top and bottom. Returns a close() that slides them out again. */
export function letterbox(sc: Phaser.Scene, h = 54, ms = 450, depth = 4990) {
  const L = layer(sc, depth);
  const top = sc.add.rectangle(480, -h / 2, 1100, h, 0x000000);
  const bot = sc.add.rectangle(480, 540 + h / 2, 1100, h, 0x000000);
  L.add([top, bot]);
  sc.tweens.add({ targets: top, y: h / 2, duration: ms, ease: "Cubic.out" });
  sc.tweens.add({ targets: bot, y: 540 - h / 2, duration: ms, ease: "Cubic.out" });
  let closed = false;
  return (out = ms) => {
    if (closed || !top.active) return;
    closed = true;
    sc.tweens.add({ targets: top, y: -h / 2, duration: out, ease: "Cubic.in", onComplete: () => top.destroy() });
    sc.tweens.add({ targets: bot, y: 540 + h / 2, duration: out, ease: "Cubic.in", onComplete: () => bot.destroy() });
  };
}

/** A quick zoom punch (in, then eased back to `rest`). */
export function punchZoom(sc: Phaser.Scene, amount = 0.12, ms = 380, rest?: number) {
  const cam = sc.cameras.main;
  const base = rest ?? cam.zoom;
  cam.zoomTo(base + amount, ms * 0.25, "Quad.easeOut", true, (_c: unknown, p: number) => {
    if (p >= 1 && alive(sc)) cam.zoomTo(base, ms * 0.75, "Cubic.easeOut", true);
  });
}

/** A full-screen flash of colour that fades (more controllable than camera.flash, and it can sit under the HUD). */
export function flash(sc: Phaser.Scene, color = 0xffffff, ms = 260, alpha = 1, depth = 4980, add = false) {
  if (calm()) {
    alpha *= 0.22;
    ms = Math.max(ms, 320);
  }
  const r = sc.add.rectangle(480, 270, 1100, 700, color, alpha);
  layer(sc, depth).add(r);
  if (add) r.setBlendMode(Phaser.BlendModes.ADD);
  sc.tweens.add({ targets: r, alpha: 0, duration: ms, ease: "Quad.in", onComplete: () => r.destroy() });
  return r;
}

/** Camera shake that respects the settings. */
export function shake(sc: Phaser.Scene, ms: number, k: number) {
  if (shakeOn()) sc.cameras.main.shake(ms, k);
}

/** Expanding rings (a sound wave you can see). World coordinates. The line stays thin as it grows. */
export function shockRing(sc: Phaser.Scene, x: number, y: number, opts: { color?: number; to?: number; rings?: number; ms?: number; depth?: number; flat?: number } = {}) {
  const n = opts.rings ?? 2;
  for (let i = 0; i < n; i++) {
    const r = sc.add.circle(x, y, 10).setStrokeStyle(Math.max(1.5, 4 - i), opts.color ?? 0xffffff, 0.9).setDepth(opts.depth ?? 1450);
    r.setFillStyle(0xffffff, 0);
    r.scaleY = opts.flat ?? 1;
    sc.tweens.add({ targets: r, radius: (opts.to ?? 260) / 2, alpha: 0, delay: i * 110, duration: opts.ms ?? 650, ease: "Cubic.out", onComplete: () => r.destroy() });
  }
}

/** A soft dark (or coloured) vignette round the screen edges. */
export function vignette(sc: Phaser.Scene, color = 0x000000, alpha = 0.7, depth = 4900) {
  const key = "juice_vignette";
  if (!sc.textures.exists(key)) {
    const c = sc.textures.createCanvas(key, 480, 270);
    if (c) {
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(240, 135, 70, 240, 135, 290);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.55, "rgba(255,255,255,0.25)");
      g.addColorStop(1, "rgba(255,255,255,1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 480, 270);
      c.refresh();
    }
  }
  const v = sc.add.image(480, 270, key).setDisplaySize(960, 540).setTintFill(color).setAlpha(0);
  layer(sc, depth).add(v);
  sc.tweens.add({ targets: v, alpha, duration: 500 });
  return v;
}

/** Squash on landing / stretch on rising: an object arrives with weight. Keeps its current scale as the rest pose. */
export function squash(sc: Phaser.Scene, o: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, k = 0.25, ms = 320) {
  // scale reads are real but writes apply the HD factor (gfx/HD.ts), so tween in logical scale
  const hd = hdFactor(o as { texture?: Phaser.Textures.Texture });
  const sx = o.scaleX / hd;
  const sy = o.scaleY / hd;
  sc.tweens.add({
    targets: o,
    scaleX: { from: sx * (1 + k), to: sx },
    scaleY: { from: sy * (1 - k), to: sy },
    duration: ms,
    ease: "Elastic.out",
    easeParams: [1.1, 0.5],
  });
}

/**
 * Slow-mo for `ms` real milliseconds. The scene supplies its own setter (DungeonScene.setSlowmo, or the default that
 * scales timers and tweens). Restores to 1 afterwards unless something else changed it meanwhile.
 */
export function slowMo(sc: Phaser.Scene, k: number, ms: number, set?: (k: number) => void) {
  const apply = set ?? ((v: number) => {
    sc.time.timeScale = v;
    sc.tweens.timeScale = v;
  });
  apply(k);
  window.setTimeout(() => {
    if (!sc.sys || !sc.sys.settings.active) return;
    if (Math.abs(sc.tweens.timeScale - k) < 1e-6) apply(1);
  }, ms);
}

/**
 * A boss title card: bars sweep in, the name SLAMS in big with a shake and a sting, the title types underneath,
 * then it all wipes away. Screen-fixed. Resolves when it's gone.
 */
export function bossCard(sc: Phaser.Scene, name: string, title: string, color = "#ff3b3b", depth = 4995): Promise<void> {
  return new Promise((res) => {
    const root = sc.add.container(0, 0);
    layer(sc, depth).add(root);
    const cy = 250;
    const band = sc.add.rectangle(480, cy, 960, 120, 0x000000, 0.78);
    band.scaleY = 0;
    const stripeA = sc.add.rectangle(-480, cy - 62, 960, 4, Phaser.Display.Color.HexStringToColor(color).color);
    const stripeB = sc.add.rectangle(1440, cy + 62, 960, 4, Phaser.Display.Color.HexStringToColor(color).color);
    const nm = sc.add.text(480, cy - 12, name, { fontFamily: "Impact, sans-serif", fontSize: "58px", color: "#ffffff", stroke: "#000000", strokeThickness: 10 }).setOrigin(0.5);
    nm.setShadow(0, 0, color, 24, true, true);
    if (nm.width > 900) nm.setScale(900 / nm.width);
    const rest = nm.scaleX;
    nm.setScale(rest * 3).setAlpha(0);
    const tt = sc.add.text(480, cy + 38, "", { fontFamily: "Courier New, monospace", fontSize: "17px", color, fontStyle: "bold", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5);
    root.add([band, stripeA, stripeB, nm, tt]);
    sc.tweens.add({ targets: band, scaleY: 1, duration: 220, ease: "Cubic.out" });
    sc.tweens.add({ targets: stripeA, x: 480, duration: 300, ease: "Cubic.out" });
    sc.tweens.add({ targets: stripeB, x: 480, duration: 300, ease: "Cubic.out" });
    sc.time.delayedCall(260, () => {
      if (!nm.active) return;
      synth.play("boom");
      sc.tweens.add({
        targets: nm,
        scale: rest,
        alpha: 1,
        duration: 170,
        ease: "Quad.in",
        onComplete: () => {
          if (!alive(sc)) return;
          shake(sc, 260, 0.014);
          flash(sc, 0xffffff, 160, 0.35, depth - 1);
          synth.play("telegraph");
        },
      });
    });
    let i = 0;
    const typer = sc.time.addEvent({
      delay: 22,
      repeat: title.length,
      callback: () => {
        if (!tt.active) return;
        tt.setText(title.slice(0, ++i));
      },
    });
    typer.paused = true;
    sc.time.delayedCall(480, () => (typer.paused = false));
    sc.time.delayedCall(2300, () => {
      if (!root.active) return res();
      sc.tweens.add({ targets: [nm, tt], x: "-=60", alpha: 0, duration: 260, ease: "Cubic.in" });
      sc.tweens.add({ targets: [stripeA], x: 1440, duration: 300, ease: "Cubic.in" });
      sc.tweens.add({ targets: [stripeB], x: -480, duration: 300, ease: "Cubic.in" });
      sc.tweens.add({
        targets: band,
        scaleY: 0,
        delay: 120,
        duration: 220,
        ease: "Cubic.in",
        onComplete: () => {
          root.destroy();
          res();
        },
      });
    });
  });
}

/** A big screen word that slams in (scale 3 -> 1), holds, and drifts away. */
export function slamText(sc: Phaser.Scene, text: string, color = "#ffffff", size = 56, y = 230, hold = 1100, depth = 4996) {
  const t = sc.add.text(480, y, text, { fontFamily: "Impact, sans-serif", fontSize: `${size}px`, color, align: "center", stroke: "#000000", strokeThickness: Math.round(size / 6) }).setOrigin(0.5);
  layer(sc, depth).add(t);
  t.setShadow(0, 0, color, 18, true, true);
  if (t.width > 920) t.setScale(920 / t.width);
  const rest = t.scaleX;
  t.setScale(rest * 3).setAlpha(0);
  sc.tweens.add({ targets: t, scale: rest, alpha: 1, duration: 160, ease: "Quad.in", onComplete: () => alive(sc) && shake(sc, 180, 0.01) });
  sc.tweens.add({ targets: t, y: y - 20, alpha: 0, delay: 160 + hold, duration: 450, ease: "Quad.in", onComplete: () => t.destroy() });
  return t;
}

/** Chunks of debris thrown out from a point (rects, tumbling, with gravity). World coordinates. */
export function debris(sc: Phaser.Scene, x: number, y: number, n = 14, opts: { colors?: number[]; speed?: number; depth?: number; floor?: number; size?: number } = {}) {
  const cols = opts.colors ?? [0x44403c, 0x78716c, 0x292524, 0xf97316];
  for (let i = 0; i < n; i++) {
    const s = (opts.size ?? 6) * (0.6 + Math.random());
    const r = sc.add.rectangle(x, y, s, s * (0.5 + Math.random() * 0.8), cols[i % cols.length]).setDepth(opts.depth ?? 1450);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
    const v = (opts.speed ?? 320) * (0.5 + Math.random() * 0.7);
    const vx = Math.cos(a) * v;
    const vy = Math.sin(a) * v;
    const floor = opts.floor ?? y + 40 + Math.random() * 40;
    const o = { t: 0 };
    const dur = 900 + Math.random() * 500;
    sc.tweens.add({
      targets: o,
      t: dur / 1000,
      duration: dur,
      onUpdate: () => {
        const ny = y + vy * o.t + 900 * o.t * o.t;
        r.setPosition(x + vx * o.t, Math.min(ny, floor));
        r.angle += 9;
      },
      onComplete: () => sc.tweens.add({ targets: r, alpha: 0, duration: 400, onComplete: () => r.destroy() }),
    });
  }
}

/**
 * Anime impact frames: for a couple of frames the whole screen goes white with the target as a black silhouette,
 * then inverts (black screen, white silhouette), then back to normal. Skipped under "Reduce flashing".
 */
export async function impactFrames(sc: Phaser.Scene, target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null, frameMs = 55, depth = 4970) {
  if (calm() || !alive(sc)) return;
  const bg = sc.add.rectangle(480, 270, 1100, 700, 0xffffff, 1);
  layer(sc, depth).add(bg);
  let sil: Phaser.GameObjects.Image | null = null;
  if (target?.active && target.texture) {
    const hd = hdFactor(target as { texture?: Phaser.Textures.Texture });
    sil = sc.add.image(target.x, target.y, target.texture.key, target.frame.name).setOrigin(target.originX, target.originY).setFlipX(target.flipX).setAngle(target.angle).setDepth(depth + 1);
    sil.setScale(target.scaleX / hd, target.scaleY / hd);
    sil.setTintFill(0x000000);
  }
  await realWait(frameMs);
  if (!bg.active || !living(sc)) return living(sc) ? undefined : new Promise<void>(() => undefined);
  bg.setFillStyle(0x000000, 1);
  sil?.setTintFill(0xffffff);
  await realWait(frameMs);
  bg.destroy();
  sil?.destroy();
  // (the scene's been left meanwhile: whatever was waiting on this stops here)
  if (!living(sc)) await new Promise<void>(() => undefined);
}

/** Anime speed lines rushing in to the middle of the screen (screen-space). Returns a stop(). */
export function speedLines(sc: Phaser.Scene, ms = 900, color = 0xffffff, depth = 4960, cx = 480, cy = 270) {
  const g = sc.add.graphics();
  layer(sc, depth).add(g);
  const draw = () => {
    if (!g.active) return;
    g.clear();
    for (let i = 0; i < 52; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = 190 + Math.random() * 150;
      g.lineStyle(1 + Math.random() * 3, color, 0.35 + Math.random() * 0.45);
      g.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 900, cy + Math.sin(a) * 900);
    }
  };
  draw();
  const id = window.setInterval(draw, 60);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(id);
    if (g.active) sc.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  };
  if (ms > 0) window.setTimeout(stop, ms);
  sc.events.once("shutdown", stop);
  return stop;
}

/**
 * An anime cut-in: a slanted band whips across the screen with a close-up in it (speed lines behind, coloured
 * edges), holds a beat, and whips out the far side. Screen-space. Any image works: it's scaled to the band's width
 * and cropped to its height (`focus` is where the crop sits, 0 top .. 1 bottom). Resolves when it's gone.
 */
export function cutIn(sc: Phaser.Scene, key: string, o: { from?: "left" | "right"; y?: number; color?: number; hold?: number; depth?: number; flipX?: boolean; focus?: number; frame?: number; w?: number; h?: number } = {}): Promise<void> {
  return new Promise((res) => {
    if (!alive(sc) || !sc.textures.exists(key)) return res();
    const y = o.y ?? 300;
    const H = o.h ?? 168;
    const W = o.w ?? 560;
    const col = o.color ?? 0xffffff;
    const dir = o.from === "right" ? -1 : 1;
    const root = sc.add.container(0, 0);
    layer(sc, o.depth ?? 4994).add(root);
    const tilt = -2.2;
    const band = sc.add.rectangle(480, y, 1300, H, 0x05010c, 0.96).setAngle(tilt);
    const edgeA = sc.add.rectangle(480, y, 1300, 5, col, 1).setAngle(tilt);
    const edgeB = sc.add.rectangle(480, y, 1300, 5, col, 1).setAngle(tilt);
    // (the edges sit on the band's long sides, tilted with it)
    const rad = Phaser.Math.DegToRad(tilt);
    edgeA.setPosition(480 + Math.sin(rad) * (H / 2), y - Math.cos(rad) * (H / 2));
    edgeB.setPosition(480 - Math.sin(rad) * (H / 2), y + Math.cos(rad) * (H / 2));
    const lines = sc.add.graphics();
    const drawLines = () => {
      if (!lines.active) return;
      lines.clear();
      for (let i = 0; i < 22; i++) {
        const ly = y + (Math.random() - 0.5) * (H - 16);
        const x0 = Math.random() * 960;
        lines.lineStyle(1 + Math.random() * 2, col, 0.25 + Math.random() * 0.35).lineBetween(x0, ly, x0 + 120 + Math.random() * 260, ly - 0.04 * (120 + Math.random() * 260));
      }
    };
    drawLines();
    const lineTimer = window.setInterval(drawLines, 50);
    const an = o.frame === undefined ? animated(sc, key) : { key, start: () => undefined };
    const img = sc.add.image(480, y, an.key, o.frame);
    an.start(img);
    const tex = img.frame;
    const k = W / tex.realWidth;
    const cropH = Math.min(tex.realHeight, (H - 10) / k);
    const top = Phaser.Math.Clamp((tex.realHeight - cropH) * (o.focus ?? 0.35), 0, tex.realHeight - cropH);
    const hd = hdFactor(img as { texture?: Phaser.Textures.Texture });
    img.setScale(k / hd);
    img.setCrop(0, top, tex.realWidth, cropH);
    // setCrop keeps the frame's full size: shift so the cropped strip sits in the middle of the band
    img.setY(y - (top + cropH / 2 - tex.realHeight / 2) * k);
    img.setFlipX(!!o.flipX);
    img.setAngle(tilt);
    root.add([band, lines, img, edgeA, edgeB]);
    root.x = dir * 1000;
    synth.play("swing");
    sc.tweens.add({
      targets: root,
      x: 0,
      duration: 200,
      ease: "Cubic.out",
      onComplete: () => {
        if (!root.active) return res();
        sc.tweens.add({ targets: img, x: img.x + dir * 22, duration: o.hold ?? 900 });
        window.setTimeout(() => {
          if (!root.active || !living(sc)) {
            window.clearInterval(lineTimer);
            if (living(sc)) res();
            return;
          }
          sc.tweens.add({
            targets: root,
            x: -dir * 1000,
            duration: 200,
            ease: "Cubic.in",
            onComplete: () => {
              window.clearInterval(lineTimer);
              root.destroy();
              res();
            },
          });
        }, o.hold ?? 900);
      },
    });
    sc.events.once("shutdown", () => window.clearInterval(lineTimer));
  });
}

/**
 * A full-screen cinematic still (a drawn "money shot"): it cuts in over everything with a pop, pushes in slowly
 * (with a little shake), holds for `ms`, then cuts away. Screen-space. Resolves when it's gone.
 */
export function still(sc: Phaser.Scene, key: string, ms = 1200, o: { depth?: number; push?: number; shakeK?: number; flipX?: boolean } = {}): Promise<void> {
  return new Promise((res) => {
    if (!alive(sc) || !sc.textures.exists(key)) return res();
    const an = animated(sc, key);
    const img = sc.add.image(480, 270, an.key, an.key === key ? undefined : 0);
    an.start(img);
    const hd = hdFactor(img as { texture?: Phaser.Textures.Texture });
    const k = Math.max(960 / img.frame.realWidth, 540 / img.frame.realHeight);
    img.setScale(k / hd);
    img.setFlipX(!!o.flipX);
    const bars = [sc.add.rectangle(480, 14, 1100, 28, 0x000000), sc.add.rectangle(480, 526, 1100, 28, 0x000000)];
    const root = sc.add.container(0, 0, [img, ...bars]);
    layer(sc, o.depth ?? 4993).add(root);
    sc.tweens.add({ targets: img, scale: (k * (1 + (o.push ?? 0.08))) / hd, duration: ms, ease: "Sine.out" });
    if (o.shakeK !== 0) shake(sc, Math.min(ms, 700), o.shakeK ?? 0.01);
    window.setTimeout(() => {
      if (!living(sc)) return;
      root.destroy();
      res();
    }, ms);
  });
}

/**
 * The anime eye shot: the screen cuts to black and a strip of just their eyes fills the middle of it, pushing in
 * slowly (a sting and a heartbeat under it), then cuts back. Screen-space. Resolves when it's gone.
 */
export function eyeShot(sc: Phaser.Scene, key: string, ms = 800, o: { depth?: number; color?: number } = {}): Promise<void> {
  return new Promise((res) => {
    if (!alive(sc) || !sc.textures.exists(key)) return res();
    const bg = sc.add.rectangle(480, 270, 1100, 700, 0x000000, 1);
    const an = animated(sc, key);
    const img = sc.add.image(480, 270, an.key, an.key === key ? undefined : 0);
    an.start(img);
    const hd = hdFactor(img as { texture?: Phaser.Textures.Texture });
    const k = 980 / img.frame.realWidth;
    img.setScale(k / hd);
    const edgeA = sc.add.rectangle(480, 270 - (img.frame.realHeight * k) / 2, 1100, 3, o.color ?? 0xffffff, 0.9);
    const edgeB = sc.add.rectangle(480, 270 + (img.frame.realHeight * k) / 2, 1100, 3, o.color ?? 0xffffff, 0.9);
    const root = sc.add.container(0, 0, [bg, img, edgeA, edgeB]);
    layer(sc, o.depth ?? 4993).add(root);
    sc.tweens.add({ targets: img, scale: (k * 1.08) / hd, duration: ms, ease: "Sine.out" });
    synth.play("telegraph");
    heartbeat(0.8);
    window.setTimeout(() => {
      if (!living(sc)) return;
      root.destroy();
      res();
    }, ms);
  });
}

/** A pulsing alarm light over the whole screen (red by default) for the rest of a fight. Returns an off(). */
export function alarmLight(sc: Phaser.Scene, color = 0xff1a1a, depth = 940, peak = 0.16) {
  const r = sc.add.rectangle(480, 270, 2200, 1400, color, 0).setScrollFactor(0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  const tw = sc.tweens.add({ targets: r, alpha: calm() ? peak * 0.4 : peak, yoyo: true, repeat: -1, duration: calm() ? 1600 : 520, ease: "Sine.inOut" });
  return () => {
    tw.stop();
    if (r.active) sc.tweens.add({ targets: r, alpha: 0, duration: 500, onComplete: () => r.destroy() });
  };
}

// ------------------------------------------------------------------ sound design (layered on top of the recorded sfx)

type SynthBits = { ctx: AudioContext | null; sfxGain?: GainNode; musicGain?: GainNode };
const audio = () => {
  const s = synth as unknown as SynthBits;
  return s.ctx && s.sfxGain ? { ctx: s.ctx, out: s.sfxGain, music: s.musicGain } : null;
};

/** One low sine thump with a falling pitch (the body of a heartbeat or an impact). */
function thump(a: NonNullable<ReturnType<typeof audio>>, at: number, f0: number, f1: number, dur: number, vol: number) {
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** A heartbeat: lub-dub. */
export function heartbeat(vol = 0.9) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime;
  thump(a, t, 70, 40, 0.18, vol);
  thump(a, t + 0.2, 62, 36, 0.22, vol * 0.75);
}

/** A sub-bass drop under a big impact: the bit you feel. */
export function subDrop(vol = 1, dur = 1.6) {
  const a = audio();
  if (!a) return;
  thump(a, a.ctx.currentTime, 110, 28, dur, vol);
}

/** A rising noise sweep: tension before a hit. */
export function riser(ms = 1500, vol = 0.35) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime;
  const len = Math.ceil(a.ctx.sampleRate * (ms / 1000 + 0.1));
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const bp = a.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 6;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(5000, t + ms / 1000);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ms / 1000);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000 + 0.06);
  src.connect(bp).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + ms / 1000 + 0.1);
}

/** A high ringing tone (ears ringing after a blast), fading out. */
export function earRing(ms = 3000, vol = 0.12) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(3200, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.connect(g).connect(a.out);
  o.start(t);
  o.stop(t + ms / 1000 + 0.05);
}

/** Duck the music to near-silence for `ms` (a held breath before a huge moment), then bring it back over `back` ms. */
export function duckMusic(ms: number, back = 600, to = 0.05) {
  const a = audio();
  if (!a?.music) return;
  const g = a.music.gain;
  const t = a.ctx.currentTime;
  const v = g.value;
  g.cancelScheduledValues(t);
  g.setValueAtTime(v, t);
  g.linearRampToValueAtTime(v * to, t + 0.15);
  g.setValueAtTime(v * to, t + ms / 1000);
  g.linearRampToValueAtTime(v, t + (ms + back) / 1000);
}

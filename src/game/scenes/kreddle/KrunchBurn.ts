import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { vfx } from "../../gfx/Vfx";
import * as Juice from "../../gfx/Juice";
import { KRUNCHERS } from "../../../content/kreddle";

/**
 * KRUNCHED: the anime cutscene after the last Kreddle Kruncher goes up (Chapter 6 raid). Akira-meets-Mortal-Kombat,
 * cartoon gore: an impact frame, a slow-motion wide shot of all of them running about on fire, a burst of close-up
 * cut-ins (skin charring off to the skull, hair going up, glasses melting), a row of them burning down to skeletons,
 * silhouettes against the fireball, and a freeze on the bones crumbling to ash with the title slammed over it.
 * Two code-drawn beats work with gore on or off: THE STAGGER (all nine in a row against a wall of fire, charring and
 * keeling over one after another like dominoes) and LAST ONE STANDING (one of them huge on his knees, burning black
 * from the feet up, then crumbling into ash that blows away).
 *
 * Screen-space, over everything; Tab or a tap skips it. With gore off it's fire, silhouettes and ash only (no flesh
 * or bone close-ups); "Reduce flashing" dims the flashes and drops the impact frames. Resolves when it's over.
 */

/** The art it uses (public/art/kb). Optional: a missing picture's beat falls back to code-drawn fire. */
export const KB_ART: Record<string, string> = {
  kb_still_wide: "kb/kb_still_wide.png",
  kb_still_fireball: "kb/kb_still_fireball.png",
  kb_still_bones: "kb/kb_still_bones.png",
  kb_still_ash: "kb/kb_still_ash.png",
  kb_cut_klenky: "kb/kb_cut_klenky.png",
  kb_cut_kredmar: "kb/kb_cut_kredmar.png",
  kb_cut_krungus: "kb/kb_cut_krungus.png",
  kb_cut_mikky: "kb/kb_cut_mikky.png",
  kb_eyes_burn: "kb/kb_eyes_burn.png",
  kb_burnrun: "kb/kb_burnrun.png",
  kb_cut_skrombus: "kb/kb_cut_skrombus.png",
  kb_cut_kredblis: "kb/kb_cut_kredblis.png",
  kb_cut_kredwonk: "kb/kb_cut_kredwonk.png",
  kb_cut_kredbon: "kb/kb_cut_kredbon.png",
  kb_cut_grenny: "kb/kb_cut_grenny.png",
  // gore off: a clean black running silhouette with a green fire rim
  kb_silrun: "kb/kb_silrun.png",
};
/** The animated versions: 9 frames in a row (the first is the still). */
export const KB_SHEETS: Record<string, [string, number, number]> = {
  kb_still_wide_anim: ["kb/kb_still_wide_anim.png", 256, 144],
  kb_still_fireball_anim: ["kb/kb_still_fireball_anim.png", 256, 144],
  kb_still_bones_anim: ["kb/kb_still_bones_anim.png", 256, 144],
  kb_cut_klenky_anim: ["kb/kb_cut_klenky_anim.png", 256, 128],
  kb_cut_kredmar_anim: ["kb/kb_cut_kredmar_anim.png", 256, 128],
  kb_cut_krungus_anim: ["kb/kb_cut_krungus_anim.png", 256, 128],
  kb_cut_mikky_anim: ["kb/kb_cut_mikky_anim.png", 256, 128],
  kb_burnrun_anim: ["kb/kb_burnrun_anim.png", 64, 64],
  kb_chardie_anim: ["kb/kb_chardie_anim.png", 64, 64],
  kb_cut_skrombus_anim: ["kb/kb_cut_skrombus_anim.png", 256, 128],
  kb_cut_kredblis_anim: ["kb/kb_cut_kredblis_anim.png", 256, 128],
  kb_cut_kredwonk_anim: ["kb/kb_cut_kredwonk_anim.png", 256, 128],
  kb_cut_kredbon_anim: ["kb/kb_cut_kredbon_anim.png", 256, 128],
  kb_cut_grenny_anim: ["kb/kb_cut_grenny_anim.png", 256, 128],
  kb_silrun_anim: ["kb/kb_silrun_anim.png", 64, 64],
};

/** Queue any of the cutscene's art the texture cache doesn't have yet (call from a preload). */
export function preloadKrunchBurn(scene: Phaser.Scene) {
  for (const [k, f] of Object.entries(KB_ART)) if (!scene.textures.exists(k)) scene.load.image(k, `art/${f}`);
  for (const [k, [f, w, h]] of Object.entries(KB_SHEETS)) if (!scene.textures.exists(k)) scene.load.spritesheet(k, `art/${f}`, { frameWidth: w, frameHeight: h });
}

const GREEN = 0x7cff3a;
const PINK = 0xff4fd8;
const CYAN = 0x22d3ee;

/** The close-ups: art, whose it is, which scream, which side it whips in from. */
const CLOSEUPS: { key: string; name: string; scream: number; color: number }[] = [
  { key: "kb_cut_klenky", name: "KLENKY", scream: 1, color: PINK },
  { key: "kb_cut_kredmar", name: "KREDMAR", scream: 3, color: CYAN },
  { key: "kb_cut_krungus", name: "LIL' KRUNGUS", scream: 5, color: PINK },
  { key: "kb_cut_mikky", name: "MIKKY K", scream: 6, color: CYAN },
];
/** The other five: a split-screen montage, slammed in one after another. */
const MONTAGE: { key: string; name: string; scream: number; color: number }[] = [
  { key: "kb_cut_skrombus", name: "SKROMBUS", scream: 2, color: CYAN },
  { key: "kb_cut_kredblis", name: "KREDBLIS", scream: 4, color: PINK },
  { key: "kb_cut_kredwonk", name: "KREDWONK", scream: 7, color: CYAN },
  { key: "kb_cut_kredbon", name: "KREDBON", scream: 8, color: PINK },
  { key: "kb_cut_grenny", name: "GRENNY", scream: 9, color: CYAN },
];

export function krunchBurn(sc: Phaser.Scene, depth: number): Promise<void> {
  const gore = G.meta?.settings?.gore !== false;
  const calm = Juice.calm();
  const L = Juice.layer(sc, depth);
  const root = sc.add.container(0, 0);
  L.add(root);
  const timers = new Set<number>();
  const stops: (() => void)[] = [];
  let skipped = false;
  let finished = false;
  let wake: (() => void) | null = null;
  const t0 = performance.now();

  const every = (ms: number, fn: () => void) => {
    const id = window.setInterval(fn, ms);
    timers.add(id);
    return () => {
      window.clearInterval(id);
      timers.delete(id);
    };
  };
  /** Wait `ms` of real time, or less if it's skipped. */
  const beat = (ms: number) =>
    new Promise<void>((res) => {
      if (skipped) return res();
      const id = window.setTimeout(() => {
        timers.delete(id);
        wake = null;
        res();
      }, ms);
      timers.add(id);
      wake = () => {
        window.clearTimeout(id);
        timers.delete(id);
        res();
      };
    });
  const scream = (n: number, vol = 1, rate = 0.86 + Math.random() * 0.1) => {
    const s = synth.evilScream(`krunch_scream_${n}`, vol, rate);
    if (s) stops.push(s);
  };

  // ---------------------------------------------------------------- skipping (Tab, or a tap)
  const skip = () => {
    // (a beat's grace, so the tap or key that killed the last one doesn't skip it before it starts)
    if (skipped || finished || performance.now() - t0 < 600) return;
    skipped = true;
    wake?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    skip();
  };
  window.addEventListener("keydown", onKey);
  sc.input.on("pointerdown", skip);

  // ---------------------------------------------------------------- the frame: black, letterboxed, a skip hint
  const black = sc.add.rectangle(480, 270, 1100, 700, 0x000000, 1);
  const stage = sc.add.container(0, 0);
  const fx = sc.add.container(0, 0);
  const barTop = sc.add.rectangle(480, 0, 1100, 112, 0x000000);
  const barBot = sc.add.rectangle(480, 540, 1100, 112, 0x000000);
  const hint = sc.add.text(944, 524, "Tab / tap: skip", { fontFamily: "monospace", fontSize: "11px", color: "#6b7280" }).setOrigin(1, 0.5);
  root.add([black, stage, fx, barTop, barBot, hint]);
  synth.duckMusic(true);

  const clearStage = () => {
    stage.removeAll(true);
    fx.removeAll(true);
  };

  /** Play a sheet's frames on an image: "once" holds the last frame, "loop" ping-pongs. Real time. */
  const playFrames = (img: Phaser.GameObjects.Image, key: string, ms: number, mode: "once" | "loop" = "loop", from = 0) => {
    const ak = `${key}_anim`;
    if (!sc.textures.exists(ak) || sc.textures.get(ak).frameTotal < 4) return;
    const n = sc.textures.get(ak).frameTotal - 1;
    img.setTexture(ak, Math.min(from, n - 1));
    let i = from;
    let dir = 1;
    const stop = every(ms, () => {
      if (!img.active) return stop();
      i += dir;
      if (i >= n || i < 0) {
        if (mode === "once") return stop();
        dir = -dir;
        i += dir * 2;
      }
      img.setFrame(Phaser.Math.Clamp(i, 0, n - 1));
    });
  };

  /** A full-frame shot: cover-scaled, pushing in slowly. */
  const shot = (key: string, ms: number, o: { push?: number; frameMs?: number; mode?: "once" | "loop"; tint?: number } = {}) => {
    if (!sc.textures.exists(key)) return null;
    const img = sc.add.image(480, 270, key);
    const k = Math.max(960 / img.frame.realWidth, 540 / img.frame.realHeight) * 1.02;
    img.setScale(k);
    if (o.tint !== undefined) img.setTint(o.tint);
    stage.add(img);
    playFrames(img, key, o.frameMs ?? 110, o.mode);
    sc.tweens.add({ targets: img, scale: k * (1 + (o.push ?? 0.1)), duration: ms, ease: "Sine.out" });
    return img;
  };

  /** Green chemical fire licking up from the bottom of the frame (the flamethrower's colour). */
  const fireLine = (n: number, y = 520, scale = 3) => {
    for (let i = 0; i < n; i++) {
      const s = vfx(sc, "vfx_fire", 40 + (i / Math.max(1, n - 1)) * 880 + (Math.random() - 0.5) * 60, y + Math.random() * 20, { scale: scale * (0.8 + Math.random() * 0.5), tint: GREEN, add: true, alpha: 0.85, delay: i * 40 });
      if (s) fx.add(s);
    }
  };

  /** Embers (and ash) drifting: little squares on a timer. */
  const embers = (ms: number, colors = [GREEN, 0xb6ff5a, 0xff8a3a, 0xfff4a8], up = true, rate = 40) => {
    const stop = every(rate, () => {
      if (!fx.active) return stop();
      const c = colors[Math.floor(Math.random() * colors.length)];
      const sz = 2 + Math.random() * 4;
      const r = sc.add.rectangle(Math.random() * 960, up ? 560 : -10, sz, sz, c, 1).setBlendMode(up ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      fx.add(r);
      sc.tweens.add({ targets: r, y: up ? 120 + Math.random() * 300 : 420 + Math.random() * 120, x: r.x + (Math.random() - 0.5) * 160, alpha: 0, angle: 360, duration: 900 + Math.random() * 900, onComplete: () => r.destroy() });
    });
    window.setTimeout(stop, ms);
  };

  /** Anime impact frames (black/white silhouette swap). Skipped under "Reduce flashing". */
  const impact = async (key: string | null, scale = 6) => {
    if (calm || skipped) return;
    const bg = sc.add.rectangle(480, 270, 1100, 700, 0xffffff, 1);
    const sil = key && sc.textures.exists(key) ? sc.add.image(480, 300, key).setScale(scale).setTintFill(0x000000) : null;
    fx.add(sil ? [bg, sil] : [bg]);
    await Juice.realWait(60);
    bg.setFillStyle(0x000000, 1);
    sil?.setTintFill(0xffffff);
    await Juice.realWait(60);
    bg.setFillStyle(GREEN, 1);
    sil?.setTintFill(0x000000);
    await Juice.realWait(50);
    bg.destroy();
    sil?.destroy();
  };

  const flash = (color: number, ms = 220, alpha = 0.8) => {
    const r = sc.add.rectangle(480, 270, 1100, 700, color, calm ? alpha * 0.2 : alpha);
    fx.add(r);
    sc.tweens.add({ targets: r, alpha: 0, duration: calm ? Math.max(ms, 360) : ms, onComplete: () => r.destroy() });
  };

  /** A slanted cut-in band with a close-up in it, whipping in from one side; its name stamped on. */
  const cutIn = (c: (typeof CLOSEUPS)[number], i: number, hold: number) => {
    const dir = i % 2 ? -1 : 1;
    const y = 270;
    const H = 360;
    const band = sc.add.container(dir * 1000, 0);
    const bg = sc.add.rectangle(480, y, 1300, H, 0x05010c, 1).setAngle(-3);
    const lines = sc.add.graphics();
    const drawLines = () => {
      if (!lines.active) return;
      lines.clear();
      for (let j = 0; j < 26; j++) {
        const ly = y + (Math.random() - 0.5) * (H - 20);
        const x0 = Math.random() * 960;
        lines.lineStyle(1 + Math.random() * 3, j % 3 ? GREEN : c.color, 0.3 + Math.random() * 0.4).lineBetween(x0, ly, x0 + 160 + Math.random() * 300, ly - 12);
      }
    };
    drawLines();
    every(50, drawLines);
    band.add([bg, lines]);
    if (sc.textures.exists(c.key)) {
      const img = sc.add.image(480, y, c.key);
      const k = 1000 / img.frame.realWidth;
      // cropped to the band (the face sits a little above the middle of the picture)
      const fh = img.frame.realHeight;
      const cropH = Math.min(fh, (H - 16) / k);
      const top = Phaser.Math.Clamp((fh - cropH) * 0.4, 0, fh - cropH);
      img.setScale(k).setAngle(-3);
      img.setCrop(0, top, img.frame.realWidth, cropH);
      img.setY(y - (top + cropH / 2 - fh / 2) * k);
      // the frames run through once: the skin goes as you watch
      playFrames(img, c.key, Math.max(60, Math.floor(hold / 9)), "once");
      sc.tweens.add({ targets: img, scale: k * 1.08, x: 480 + dir * 30, duration: hold + 200 });
      band.add(img);
    }
    const edgeA = sc.add.rectangle(480, y - H / 2, 1300, 8, c.color, 1).setAngle(-3);
    const edgeB = sc.add.rectangle(480, y + H / 2, 1300, 8, c.color, 1).setAngle(-3);
    const tag = sc.add.text(dir > 0 ? 70 : 890, y + H / 2 - 40, c.name, { fontFamily: "Impact, sans-serif", fontSize: "40px", color: Phaser.Display.Color.IntegerToColor(c.color).rgba, stroke: "#000000", strokeThickness: 8 }).setOrigin(dir > 0 ? 0 : 1, 0.5).setAngle(-3);
    band.add([edgeA, edgeB, tag]);
    stage.add(band);
    sc.tweens.add({ targets: band, x: 0, duration: 140, ease: "Cubic.out" });
    synth.play("swing");
    window.setTimeout(() => {
      if (skipped || !band.active) return;
      synth.play(i % 2 ? "flesh_rip" : "squelch");
      scream(c.scream, 1, 0.85 + Math.random() * 0.08);
      flash(i % 2 ? 0xff1a1a : 0xffffff, 120, 0.4);
      Juice.shake(sc, 260, 0.012);
      // cartoon blood spat across the frame
      for (let j = 0; j < 3; j++) {
        const b = vfx(sc, j % 2 ? "vfx_bloodspray" : "vfx_gore", 200 + Math.random() * 560, 170 + Math.random() * 200, { scale: 2 + Math.random(), flipX: Math.random() < 0.5, delay: j * 90 });
        if (b) fx.add(b);
      }
      splatter(c.color);
    }, 150);
  };

  /** Gloopy red splats (and a few bone flecks) stuck on the "lens". */
  const splatter = (accent: number) => {
    for (let j = 0; j < 7; j++) {
      const x = 80 + Math.random() * 800;
      const yy = 80 + Math.random() * 380;
      const r = 6 + Math.random() * 18;
      const blob = sc.add.circle(x, yy, r, j % 4 === 3 ? accent : 0xb3001b, 0.95).setScale(0.2);
      const drip = sc.add.rectangle(x, yy, r * 0.5, 2, 0x8a0012, 0.95).setOrigin(0.5, 0);
      fx.add([drip, blob]);
      sc.tweens.add({ targets: blob, scale: 1, duration: 90, ease: "Back.out" });
      sc.tweens.add({ targets: drip, height: 30 + Math.random() * 70, duration: 900, ease: "Sine.in" });
      sc.tweens.add({ targets: [blob, drip], alpha: 0, delay: 700, duration: 300, onComplete: () => (blob.destroy(), drip.destroy()) });
    }
    for (let j = 0; j < 8; j++) {
      const f = sc.add.rectangle(480 + (Math.random() - 0.5) * 200, 270, 3 + Math.random() * 4, 2 + Math.random() * 2, 0xf5f0e1, 1);
      fx.add(f);
      sc.tweens.add({ targets: f, x: f.x + (Math.random() - 0.5) * 700, y: 270 + (Math.random() - 0.5) * 420, angle: 540, alpha: 0, duration: 700, onComplete: () => f.destroy() });
    }
  };

  /**
   * The split screen: slanted vertical panels slam in left to right, one per Kruncher, each a crop of his face
   * with its frames running (the damage happening), his name, a scream and a splat. They all stay up together.
   */
  const montage = (gap: number) => {
    const n = MONTAGE.length;
    const PW = 960 / n;
    const top = 56;
    const PH = 540 - top * 2;
    const slant = 26;
    MONTAGE.forEach((c, i) => {
      window.setTimeout(() => {
        if (skipped || !stage.active) return;
        const cx = PW * i + PW / 2;
        const panel = sc.add.container(0, i % 2 ? 600 : -600);
        // a parallelogram window, so neighbours meet on a slant (in screen space: the panel slides, the window doesn't)
        const shape = sc.make.graphics({}, false).setScrollFactor(0);
        shape.fillStyle(0xffffff).fillPoints(
          [
            new Phaser.Math.Vector2(cx - PW / 2 + slant, top),
            new Phaser.Math.Vector2(cx + PW / 2 + slant, top),
            new Phaser.Math.Vector2(cx + PW / 2 - slant, top + PH),
            new Phaser.Math.Vector2(cx - PW / 2 - slant, top + PH),
          ],
          true,
        );
        const bg = sc.add.rectangle(cx, 270, PW + slant * 2, PH, 0x05010c, 1);
        panel.add(bg);
        if (sc.textures.exists(c.key)) {
          const img = sc.add.image(cx, 270, c.key);
          const k = PH / img.frame.realHeight;
          img.setScale(k * 1.05);
          panel.add(img);
          playFrames(img, c.key, 70, "once");
          sc.tweens.add({ targets: img, scale: k * 1.15, duration: 1400 });
        }
        const tag = sc.add.text(cx - 10, 270 + PH / 2 - 30, c.name, { fontFamily: "Impact, sans-serif", fontSize: "24px", color: Phaser.Display.Color.IntegerToColor(c.color).rgba, stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5).setAngle(-6);
        panel.add(tag);
        panel.setMask(shape.createGeometryMask());
        const edges = sc.add.graphics();
        edges.lineStyle(6, c.color, 1);
        edges.lineBetween(cx - PW / 2 + slant, top, cx - PW / 2 - slant, top + PH);
        edges.lineBetween(cx + PW / 2 + slant, top, cx + PW / 2 - slant, top + PH);
        edges.setAlpha(0);
        stage.add([panel, edges]);
        panel.once("destroy", () => shape.destroy());
        sc.tweens.add({
          targets: panel,
          y: 0,
          duration: 110,
          ease: "Cubic.out",
          onComplete: () => {
            if (skipped) return;
            edges.setAlpha(1);
            synth.play(i % 2 ? "punch" : "squelch");
            scream(c.scream, 0.8, 0.84 + Math.random() * 0.1);
            Juice.shake(sc, 160, 0.01);
            const b = vfx(sc, i % 2 ? "vfx_bloodspray" : "vfx_gore", cx, 200 + Math.random() * 140, { scale: 1.6 + Math.random() * 0.6, flipX: Math.random() < 0.5 });
            if (b) fx.add(b);
          },
        });
      }, i * gap);
    });
  };

  /** The row of them burning down: char-to-skeleton sprites (gore), or black running silhouettes (no gore). */
  const burnRow = (ms: number) => {
    const glow = sc.add.rectangle(480, 270, 1100, 700, 0x0a2a05, 1);
    stage.add(glow);
    fireLine(9, 470, 2.6);
    const key = gore ? "kb_chardie" : sc.textures.exists("kb_silrun_anim") ? "kb_silrun" : "kb_burnrun";
    if (!sc.textures.exists(`${key}_anim`)) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x = 130 + i * 175;
      const s = sc.add.image(x, 330, `${key}_anim`, 0).setScale(3.4).setFlipX(i % 2 === 1);
      // (the old burning-run sprite, blacked out, if the silhouette sheet isn't there)
      if (!gore && key === "kb_burnrun") s.setTintFill(0x000000);
      else s.setTint(i % 2 ? 0xbfefff : 0xffc8f0);
      stage.add(s);
      if (gore) {
        window.setTimeout(() => !skipped && s.active && playFrames(s, key, Math.floor((ms - 300) / 9), "once"), i * 90);
        window.setTimeout(() => {
          if (skipped || !s.active) return;
          synth.play("bonecrack");
          for (let j = 0; j < 6; j++) {
            const f = sc.add.rectangle(x, 360, 3, 2, j % 2 ? 0xf5f0e1 : 0x2a2522, 1);
            fx.add(f);
            sc.tweens.add({ targets: f, x: x + (Math.random() - 0.5) * 120, y: 400 - Math.random() * 120, angle: 360, alpha: 0, duration: 600, onComplete: () => f.destroy() });
          }
        }, ms * 0.55 + i * 90);
      } else {
        playFrames(s, key, 70, "loop");
        sc.tweens.add({ targets: s, x: x + (i % 2 ? -60 : 60), duration: ms });
      }
    }
  };

  /** A Kruncher's little sprite, big, side-on (their own sheet: the lads' doubles), or null if it's not loaded. */
  const kSprite = (i: number, x: number, y: number, scale: number) => {
    const k = KRUNCHERS[i % KRUNCHERS.length];
    const key = `spr_${k.of}`;
    if (!sc.textures.exists(key)) return null;
    return sc.add.sprite(x, y, key, sc.textures.get(key).frameTotal > 5 ? 4 : 0).setOrigin(0.5, 1).setScale(scale);
  };
  const charTo = gore ? 0x2a1610 : 0x303030;
  const lerpTint = (img: Phaser.GameObjects.Sprite, k: number, from = 0xff8a3a) => {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(from), Phaser.Display.Color.ValueToColor(charTo), 1, Phaser.Math.Clamp(k, 0, 1));
    img.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  };

  /** THE STAGGER: all nine in a row in front of a wall of fire, charring, then falling one after another. */
  const stagger = (ms: number) => {
    stage.add(sc.add.rectangle(480, 270, 1100, 700, 0x1a0602, 1));
    stage.add(sc.add.rectangle(480, 420, 1100, 140, 0x0a0302, 1));
    fireLine(10, 330, 3.4);
    const n = KRUNCHERS.length;
    const fall0 = ms * 0.45;
    const gap = (ms * 0.42) / n;
    for (let i = 0; i < n; i++) {
      const x = 70 + i * (820 / (n - 1));
      const s = kSprite(i, x, 430, 3);
      if (!s) continue;
      s.setFlipX(i % 2 === 1);
      stage.add(s);
      const f = vfx(sc, "vfx_fire", x, 400, { scale: 1.6, tint: i % 2 ? GREEN : 0xffb347, add: true });
      if (f) fx.add(f);
      const t0 = performance.now();
      const stop = every(40, () => {
        if (!s.active) return stop();
        const k = (performance.now() - t0) / fall0;
        lerpTint(s, k);
        if (s.getData("down")) return;
        s.setAngle(Math.sin(performance.now() / (60 + i * 7) + i) * (8 + k * 14));
        s.x = x + Math.sin(performance.now() / 140 + i * 2) * 10;
        if (f) f.setPosition(s.x, 380);
      });
      // down they go, left to right, like dominoes
      window.setTimeout(() => {
        if (skipped || !s.active) return;
        s.setData("down", true);
        synth.play(i % 2 ? "punch" : "smash");
        if (i % 3 === 0) scream((i % 9) + 1, 0.5, 0.8 + Math.random() * 0.1);
        sc.tweens.add({ targets: s, angle: 90, y: 446, duration: 260, ease: "Quad.in", onComplete: () => {
          if (skipped || !s.active) return;
          Juice.shake(sc, 120, 0.008);
          const d = vfx(sc, "vfx_dust", s.x + 40, 440, { scale: 1.6, tint: 0x5a4a40 });
          if (d) fx.add(d);
          if (f) f.setPosition(s.x + 50, 420);
          for (let j = 0; j < 5; j++) {
            const r = sc.add.rectangle(s.x + 40, 430, 3, 3, j % 2 ? 0x44403c : 0xff8a3a, 1);
            fx.add(r);
            sc.tweens.add({ targets: r, x: r.x + (Math.random() - 0.5) * 120, y: 330 + Math.random() * 60, alpha: 0, duration: 700, onComplete: () => r.destroy() });
          }
        } });
      }, fall0 + i * gap);
    }
    const t = sc.add.text(480, 120, "THE STAGGER", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#ffb347", stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    fx.add(t);
    sc.tweens.add({ targets: t, alpha: 1, duration: 200, yoyo: true, hold: ms * 0.5 });
  };

  /** LAST ONE STANDING: huge, on his knees, burning black from the feet up, then he crumbles and blows away. */
  const lastStanding = (ms: number) => {
    stage.add(sc.add.rectangle(480, 270, 1100, 700, 0x050208, 1));
    stage.add(sc.add.ellipse(480, 470, 700, 120, GREEN, 0.25).setBlendMode(Phaser.BlendModes.ADD));
    const s = kSprite(KRUNCHERS.length - 1, 480, 500, 6.2);
    if (!s) return;
    s.setFrame(0);
    stage.add(s);
    sc.tweens.add({ targets: s, scale: 6.8, duration: ms, ease: "Sine.out" });
    const t0 = performance.now();
    const burnMs = ms * 0.6;
    // fire climbing him from the feet up
    const stopFire = every(90, () => {
      if (!s.active) return stopFire();
      const k = Math.min(1, (performance.now() - t0) / burnMs);
      lerpTint(s, k * 1.1, 0xffd27a);
      s.setAngle(Math.sin(performance.now() / 70) * (2 + k * 4));
      const f = vfx(sc, "vfx_fire", 480 + (Math.random() - 0.5) * 160, 500 - k * 300 * Math.random(), { scale: 1.6 + Math.random(), tint: Math.random() < 0.6 ? GREEN : 0xffb347, add: true, alpha: 0.9 });
      if (f) fx.add(f);
    });
    scream(6, 1, 0.78);
    window.setTimeout(() => !skipped && synth.play(gore ? "bonecrack" : "groan"), burnMs * 0.7);
    // ...and he crumbles: a grid of ash blowing away on the wind, from the top down
    window.setTimeout(() => {
      if (skipped || !s.active) return;
      stopFire();
      synth.play("pfft_1");
      const b = s.getBounds();
      const cell = 10;
      let made = 0;
      for (let yy = b.top; yy < b.bottom && made < 160; yy += cell)
        for (let xx = b.left + b.width * 0.2; xx < b.right - b.width * 0.2 && made < 160; xx += cell) {
          made++;
          const r = sc.add.rectangle(xx, yy, cell, cell, Math.random() < 0.15 ? 0xff8a3a : Math.random() < 0.5 ? charTo : 0x57534e, 1);
          fx.add(r);
          const d = ((yy - b.top) / b.height) * 500;
          sc.tweens.add({ targets: r, x: xx + 300 + Math.random() * 500, y: yy - 60 - Math.random() * 160, angle: 200, scale: 0.2, alpha: 0, delay: d + Math.random() * 150, duration: 900 + Math.random() * 500, onComplete: () => r.destroy() });
        }
      sc.tweens.add({ targets: s, alpha: 0, duration: 500 });
      embers(1200, [0x9ca3af, 0x6b7280, 0x44403c, 0xff8a3a], true, 30);
    }, burnMs);
  };

  /** The title: "KRUNCHED." slammed on, dripping. */
  const title = () => {
    const col = gore ? "#ff2a2a" : "#b6ff5a";
    const t = sc.add.text(480, 250, "KRUNCHED.", { fontFamily: "Impact, sans-serif", fontSize: "104px", color: col, stroke: "#000000", strokeThickness: 14 }).setOrigin(0.5);
    t.setShadow(0, 0, col, 24, true, true);
    t.setScale(3).setAlpha(0);
    const sub = sc.add.text(480, 428, "THE KREDDLE KRUNCHERS  ·  0 REMAINING", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#f5f0e1", stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    fx.add([t, sub]);
    sc.tweens.add({
      targets: t,
      scale: 1,
      alpha: 1,
      duration: 170,
      ease: "Quad.in",
      onComplete: () => {
        if (skipped) return;
        synth.play("punch_big");
        Juice.subDrop(1, 1.6);
        Juice.shake(sc, 300, 0.016);
        flash(gore ? 0xff1a1a : GREEN, 260, 0.5);
        if (gore) {
          // blood running off the letters
          for (let j = 0; j < 9; j++) {
            const x = 480 - t.displayWidth / 2 + 30 + Math.random() * (t.displayWidth - 60);
            const d = sc.add.rectangle(x, 290, 4 + Math.random() * 6, 2, 0xb3001b, 1).setOrigin(0.5, 0);
            fx.add(d);
            sc.tweens.add({ targets: d, height: 20 + Math.random() * 90, duration: 1400 + Math.random() * 800, ease: "Sine.in" });
          }
        }
        sc.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 250 });
      },
    });
  };

  // ---------------------------------------------------------------- the cut
  const run = async () => {
    // 1. impact
    synth.play("reveal_boom");
    Juice.subDrop(1, 2);
    await impact(sc.textures.exists("kb_silrun") ? "kb_silrun" : "kb_burnrun", 6);
    flash(GREEN, 300, 0.7);

    // 2. the wide shot, in slow motion: all of them, on fire, running about
    if (!skipped) {
      shot("kb_still_wide", 2400, { push: 0.14, frameMs: 150 });
      fireLine(7, 540, 3.2);
      embers(2600);
      synth.play("gun_flamer");
      scream(2, 0.9, 0.82);
      window.setTimeout(() => !skipped && scream(4, 0.75, 0.88), 500);
      window.setTimeout(() => !skipped && synth.play("crowd_panic", 0.6), 200);
      const stopLines = Juice.speedLines(sc, 0, GREEN, depth + 1);
      stops.push(stopLines);
      window.setTimeout(stopLines, 2200);
      await beat(2400);
      clearStage();
    }

    // 2b. THE STAGGER (gore on or off): all nine charring and dropping like dominoes
    if (!skipped) {
      synth.play("gun_flamer");
      stagger(2600);
      embers(2600);
      await beat(2600);
      clearStage();
    }

    if (gore) {
      // 3. the eyes
      if (!skipped && sc.textures.exists("kb_eyes_burn")) {
        const img = sc.add.image(480, 270, "kb_eyes_burn");
        const k = 980 / img.frame.realWidth;
        img.setScale(k);
        stage.add([img, sc.add.rectangle(480, 270 - 32 * k, 1100, 4, GREEN, 1), sc.add.rectangle(480, 270 + 32 * k, 1100, 4, GREEN, 1)]);
        sc.tweens.add({ targets: img, scale: k * 1.12, duration: 750 });
        Juice.heartbeat(0.9);
        synth.play("telegraph");
        await beat(750);
        clearStage();
      }
      // 4. the close-ups, fast: four whip-pans, then the other five slammed into a split screen
      for (const [i, c] of CLOSEUPS.entries()) {
        if (skipped) break;
        cutIn(c, i, 640);
        await beat(700);
        if (!skipped && i === 3) await impact(null);
        clearStage();
      }
      if (!skipped) {
        montage(230);
        await beat(MONTAGE.length * 230 + 650);
        if (!skipped) await impact(null);
        clearStage();
      }
    }

    // 5. the row of them burning down (or running, as silhouettes)
    if (!skipped) {
      burnRow(1700);
      embers(1700);
      synth.play("gun_flamer");
      scream(1, 0.6, 0.8);
      await beat(1700);
      clearStage();
    }

    // 6. silhouettes against the fireball
    if (!skipped) {
      shot("kb_still_fireball", 2000, { push: 0.08, frameMs: 120 });
      synth.play("explode_1");
      window.setTimeout(() => !skipped && synth.play("explode_2"), 380);
      flash(0xffffff, 380, 0.9);
      Juice.shake(sc, 1600, 0.02);
      for (const n of [3, 5, 6]) scream(n, 0.6, 0.78 + Math.random() * 0.1);
      embers(2000, [GREEN, 0xffffff, 0xb6ff5a], true, 25);
      await beat(2000);
      clearStage();
    }

    // 6b. LAST ONE STANDING: one of them, huge, burning black and blowing away as ash
    if (!skipped) {
      Juice.heartbeat(0.7);
      lastStanding(2600);
      await beat(2600);
      clearStage();
    }

    // 7. freeze: the bones crumbling to ash (or just ash), and the title
    if (!skipped) {
      for (const s of stops.splice(0)) s();
      synth.play(gore ? "gurgle_1" : "groan");
      shot(gore ? "kb_still_bones" : "kb_still_ash", 3200, { push: 0.05, frameMs: 260, mode: "once", tint: 0xe8ddd0 });
      embers(3200, [0x9ca3af, 0x6b7280, 0x44403c, 0xff8a3a], false, 35);
      Juice.earRing(2600, 0.06);
      await beat(500);
      if (!skipped) title();
      await beat(2700);
    }
  };

  return run().then(async () => {
    finished = true;
    for (const s of stops.splice(0)) s();
    if (!skipped && root.active) {
      const fade = sc.add.rectangle(480, 270, 1100, 700, 0x000000, 0);
      root.add(fade);
      sc.tweens.add({ targets: fade, fillAlpha: 1, duration: 350 });
      await Juice.realWait(380);
    }
    for (const id of timers) {
      window.clearInterval(id);
      window.clearTimeout(id);
    }
    timers.clear();
    window.removeEventListener("keydown", onKey);
    sc.input?.off("pointerdown", skip);
    synth.duckMusic(false);
    if (root.active) {
      // fade back up from black into the street
      const out = sc.add.rectangle(480, 270, 1100, 700, 0x000000, 1);
      root.removeAll(true);
      root.add(out);
      sc.tweens.add({ targets: out, alpha: 0, duration: 400, onComplete: () => root.destroy() });
    }
  });
}

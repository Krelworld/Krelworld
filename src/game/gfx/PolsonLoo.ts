import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { voice } from "../audio/Voice";
import { G } from "../G";
import * as Juice from "./Juice";

/**
 * "Sludge time", the anime cut: Polson has walked off to the toilet (the death-fart anecdote, content/meetings
 * laterMeetings.ts) and, before he comes back, we go in with him. A low-angle door slam (it bounces back open: he
 * does not close the door), three manga panels (the gut, the sweat, the eyes), the main event on the loo (waist up,
 * the toilet shaking, cartoon brown splats and stink lines, a censor bar over the bowl), then an extreme close-up of
 * his face in total bliss: "Phwoar, smells gorgeous." A flush, and back to the room.
 *
 * Cued as the SideCine beat `loo`. E / Space / click moves on a panel; Tab skips the lot. Reduce flashing: no white
 * impact frames, dimmed flashes, slower sparkles. Gore off: the splats are green stink clouds instead of brown.
 */

export interface LooHost {
  press: () => Promise<void>;
  skipping: () => boolean;
}

/** Said over the close-up (in Polson's recorded voice). */
export const LOO_LINE = "Phwoar, smells gorgeous.";

const DEPTH = 4993;
const BROWN = [0x6b3f1d, 0x7c4a21, 0x5a3315, 0x8b5a2b];
const STINK = [0x84cc16, 0xa3e635, 0x65a30d];

const alive = (sc: Phaser.Scene) => !!sc.sys && sc.sys.settings.status < Phaser.Scenes.SHUTDOWN && !!sc.cameras?.main;

/** Wait `ms` or until the player presses on. True if they pressed. */
function hold(ms: number, host: LooHost): Promise<boolean> {
  return new Promise((res) => {
    let done = false;
    const id = window.setTimeout(() => {
      if (done) return;
      done = true;
      res(false);
    }, ms);
    void host.press().then(() => {
      if (done) return;
      done = true;
      window.clearTimeout(id);
      res(true);
    });
  });
}

/** A picture cropped to a panel: `fx, fy` is the centre of the crop in the texture (0..1), `zoom` how far in. */
function panelImage(sc: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, fx: number, fy: number, zoom: number) {
  const tex = sc.textures.get(key).getSourceImage() as { width: number; height: number };
  const s = Math.max(w / tex.width, h / tex.height) * zoom;
  const cw = w / s;
  const ch = h / s;
  const cx = Phaser.Math.Clamp(fx * tex.width - cw / 2, 0, tex.width - cw);
  const cy = Phaser.Math.Clamp(fy * tex.height - ch / 2, 0, tex.height - ch);
  const img = sc.add.image(x - cx * s, y - cy * s, key).setOrigin(0, 0).setScale(s);
  img.setCrop(cx, cy, cw, ch);
  return img;
}

/** A manga sound effect: chunky outlined letters, slapped on at an angle. */
function sfxText(sc: Phaser.Scene, text: string, x: number, y: number, size: number, color: string, angle: number) {
  const t = sc.add.text(x, y, text, { fontFamily: "Impact, sans-serif", fontSize: `${size}px`, color, stroke: "#000000", strokeThickness: Math.round(size / 7) }).setOrigin(0.5).setAngle(angle);
  t.setScale(2.2).setAlpha(0);
  sc.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 140, ease: "Quad.in" });
  return t;
}

/** Radial speed lines drawn into a graphics (static, redrawn on a timer by the caller if wanted). */
function burst(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number, n = 60, r0 = 140) {
  g.clear();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = r0 + Math.random() * 120;
    g.lineStyle(1 + Math.random() * 4, color, 0.3 + Math.random() * 0.5);
    g.lineBetween(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * 1000, cy + Math.sin(a) * 1000);
  }
}

/** Play the cut. Resolves when it's over (or skipped); everything it drew is gone by then. */
export async function polsonLoo(sc: Phaser.Scene, host: LooHost): Promise<void> {
  if (!alive(sc)) return;
  const calm = Juice.calm();
  const gore = G.meta?.settings?.gore !== false;
  const strainKey = sc.textures.exists("ss_loo_strain") ? "ss_loo_strain" : "ss_still_deathfart";
  const blissKey = sc.textures.exists("ss_loo_bliss") ? "ss_loo_bliss" : "ss_cut_polson_grin";
  const root = sc.add.container(0, 0);
  Juice.layer(sc, DEPTH).add(root);
  const timers: number[] = [];
  const every = (ms: number, f: () => void) => timers.push(window.setInterval(() => (root.active ? f() : undefined), ms));
  const clear = () => {
    for (const id of timers) window.clearInterval(id);
    timers.length = 0;
  };
  const kill = (o: Phaser.GameObjects.GameObject) => {
    sc.tweens.killTweensOf(o);
    if (o instanceof Phaser.GameObjects.Container) for (const c of o.list) kill(c);
  };
  const wipe = () => {
    clear();
    for (const o of [...root.list]) {
      kill(o);
      o.destroy();
    }
  };
  const done = () => !alive(sc) || !root.active || host.skipping();
  const shake = (ms: number, k: number) => Juice.shake(sc, ms, calm ? k * 0.4 : k);
  Juice.duckMusic(13000, 800, 0.12);

  try {
    // ---------------------------------------------------------------- 1. the door, from the floor, slams
    const bg = sc.add.rectangle(480, 270, 1100, 700, 0x0b1020);
    const lines = sc.add.graphics();
    burst(lines, 480, 120, 0x60a5fa, 50, 220);
    // a doorway seen from the skirting board: a tall tilted trapezoid with the door swinging into it
    const frame = sc.add.graphics();
    frame.fillStyle(0x1f2937, 1).fillPoints([new Phaser.Math.Vector2(330, 560), new Phaser.Math.Vector2(380, -20), new Phaser.Math.Vector2(600, -20), new Phaser.Math.Vector2(650, 560)], true);
    frame.fillStyle(0xfef3c7, 0.9).fillPoints([new Phaser.Math.Vector2(350, 560), new Phaser.Math.Vector2(395, -20), new Phaser.Math.Vector2(585, -20), new Phaser.Math.Vector2(630, 560)], true);
    const door = sc.add.container(350, 0);
    const slab = sc.add.graphics();
    slab.fillStyle(0x7c4a21, 1).fillPoints([new Phaser.Math.Vector2(0, 560), new Phaser.Math.Vector2(45, -20), new Phaser.Math.Vector2(235, -20), new Phaser.Math.Vector2(280, 560)], true);
    slab.lineStyle(6, 0x3b2410, 1).strokePoints([new Phaser.Math.Vector2(0, 560), new Phaser.Math.Vector2(45, -20), new Phaser.Math.Vector2(235, -20), new Phaser.Math.Vector2(280, 560)], true);
    slab.fillStyle(0x5a3315, 1).fillRect(70, 60, 140, 150).fillRect(60, 280, 160, 190);
    slab.fillStyle(0xffd23f, 1).fillCircle(235, 300, 11);
    const sign = sc.add.text(140, 30, "WC", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
    door.add([slab, sign]);
    door.setScale(0.08, 1); // open, edge-on
    root.add([bg, lines, frame, door]);
    synth.play("ss_sting_reveal");
    await hold(450, host);
    if (done()) return;
    sc.tweens.add({ targets: door, scaleX: 1, duration: 140, ease: "Quad.in" });
    await hold(140, host);
    if (done()) return;
    synth.play("door");
    synth.play("boom", 0.6);
    shake(420, 0.03);
    void Juice.impactFrames(sc, null, 55, DEPTH + 2);
    root.add(sfxText(sc, "SLAM!!", 480, 300, 110, "#ffd23f", -9));
    await hold(700, host);
    if (done()) return;
    // it doesn't stay shut
    sc.tweens.add({ targets: door, scaleX: 0.35, duration: 900, ease: "Sine.out" });
    synth.play("ss_scratch", 0.5);
    root.add(sfxText(sc, "creeeak…", 690, 470, 34, "#e5e7eb", 6));
    await hold(1000, host);
    if (done()) return;
    wipe();

    // ---------------------------------------------------------------- 2. three manga panels
    const paper = sc.add.rectangle(480, 270, 1100, 700, 0xf5f0e6);
    root.add(paper);
    const panels: [number, number, number, number, number, number, number, string, string][] = [
      // x, y, w, h, fx, fy, zoom, sound, caption
      [40, 40, 420, 220, 0.5, 0.62, 1.7, "GURGLE", "ゴロゴロ"],
      [500, 40, 420, 220, 0.5, 0.3, 2.4, "DRIP", "ダラダラ"],
      [40, 290, 880, 210, 0.5, 0.28, 4.0, "!!", "ゴゴゴ"],
    ];
    for (const [i, [x, y, w, h, fx, fy, z, word, kana]] of panels.entries()) {
      if (done()) return;
      const img = panelImage(sc, strainKey, x, y, w, h, fx, fy, z);
      const edge = sc.add.rectangle(x + w / 2, y + h / 2, w, h).setStrokeStyle(6, 0x111111);
      const sl = sc.add.graphics();
      sl.setPosition(0, 0);
      const pc = sc.add.container(0, 0, [img, sl, edge]);
      root.add(pc);
      // panels slam in from alternating sides
      pc.x = i % 2 ? 300 : -300;
      pc.setAlpha(0);
      sc.tweens.add({ targets: pc, x: 0, alpha: 1, duration: 140, ease: "Cubic.out" });
      if (i === 1) {
        // sweat: drops running down the panel
        every(120, () => {
          const d = sc.add.ellipse(x + 40 + Math.random() * (w - 80), y + 10, 8, 14, 0x93c5fd).setStrokeStyle(2, 0x1e3a8a);
          pc.add(d);
          sc.tweens.add({ targets: d, y: y + h - 10, duration: 500, ease: "Quad.in", onComplete: () => d.destroy() });
        });
      }
      if (i === 2) {
        // the eyes: menace lines either side
        const g = sc.add.graphics();
        burst(g, x + w / 2, y + h / 2, 0x111111, 40, 200);
        g.setAlpha(0.5);
        pc.addAt(g, 1);
        Juice.riser(900, 0.25);
      }
      synth.play(i === 0 ? "sq_squelch" : "swing");
      shake(160, 0.008);
      pc.add(sfxText(sc, word, x + w - 80, y + 50, i === 2 ? 64 : 44, i === 0 ? "#a16207" : "#1d4ed8", i % 2 ? 10 : -10));
      pc.add(sc.add.text(x + 22, y + h - 18, kana, { fontFamily: "sans-serif", fontSize: "30px", color: "#111", stroke: "#fff", strokeThickness: 6, fontStyle: "bold" }).setOrigin(0, 1).setAngle(-6));
      await hold(i === 2 ? 1100 : 850, host);
    }
    if (done()) return;
    wipe();

    // ---------------------------------------------------------------- 3. the main event
    const still = sc.add.image(480, 270, strainKey);
    const k = Math.max(960 / still.width, 540 / still.height);
    still.setScale(k * 1.04);
    const vib = sc.add.graphics();
    // the bottom of the picture (the bowl, his lap) behind a censor bar
    const bar = sc.add.rectangle(480, 470, 620, 70, 0x000000).setStrokeStyle(3, 0xffffff);
    const barT = sc.add.text(480, 470, "CENSORED BY THE MINISTRY OF DIGNITY", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    root.add([still, vib, bar, barT]);
    synth.play("fart");
    Juice.flash(sc, gore ? 0x6b3f1d : 0x84cc16, 220, 0.6, DEPTH + 2);
    // the whole toilet rattles
    const rattle = sc.tweens.add({ targets: still, x: { from: 474, to: 486 }, duration: calm ? 90 : 45, yoyo: true, repeat: -1 });
    every(70, () => {
      vib.clear();
      vib.lineStyle(4, 0xffffff, 0.8);
      for (let n = 0; n < 6; n++) {
        const side = n % 2 ? 1 : -1;
        const yy = 260 + Math.random() * 200;
        vib.lineBetween(480 + side * (300 + Math.random() * 30), yy, 480 + side * (340 + Math.random() * 40), yy + 6);
      }
    });
    // cartoon splats flying up from behind the bar, and stink lines
    const splat = () => {
      const cols = gore ? BROWN : STINK;
      const b = sc.add.circle(380 + Math.random() * 200, 450, 8 + Math.random() * 14, cols[Math.floor(Math.random() * cols.length)]).setStrokeStyle(3, 0x2a160a);
      root.addAt(b, root.getIndex(bar));
      sc.tweens.add({ targets: b, x: b.x + (Math.random() - 0.5) * 520, y: 120 + Math.random() * 200, duration: 380, ease: "Quad.out", onComplete: () => sc.tweens.add({ targets: b, y: 620, alpha: 0.6, duration: 600, ease: "Quad.in", onComplete: () => b.destroy() }) });
    };
    const stink = () => {
      const s = sc.add.text(300 + Math.random() * 360, 420, "~", { fontFamily: "Impact, sans-serif", fontSize: `${50 + Math.random() * 40}px`, color: "#84cc16", stroke: "#1a2e05", strokeThickness: 5 }).setOrigin(0.5).setAngle(90);
      root.add(s);
      sc.tweens.add({ targets: s, y: 40, alpha: 0, duration: 1600, ease: "Sine.out", onComplete: () => s.destroy() });
    };
    every(110, splat);
    every(260, stink);
    const words: [string, number, number, number, string, number][] = [
      ["BRRRAAAP", 230, 140, 64, "#a16207", -12],
      ["SPLOOSH!!", 730, 200, 70, "#7c4a21", 10],
      ["SPLAT", 260, 360, 50, "#5a3315", 8],
      ["BLORRRT", 720, 380, 58, "#a16207", -8],
    ];
    for (const [w, x, y, s, c, a] of words) {
      if (done()) return;
      synth.play(w.startsWith("SPL") ? "splat" : "fart");
      if (w === "SPLOOSH!!") synth.play("splash", 0.7);
      root.add(sfxText(sc, w, x, y, s, c, a));
      shake(220, 0.012);
      await hold(620, host);
    }
    if (done()) return;
    rattle.remove();
    wipe();

    // ---------------------------------------------------------------- 4. the extreme close-up: bliss
    const glow = sc.add.rectangle(480, 270, 1100, 700, 0xfbcfe8);
    const rays = sc.add.graphics();
    burst(rays, 480, 270, 0xffffff, 70, 160);
    const face = sc.add.image(480, 270, blissKey);
    const fk = Math.max(960 / face.width, 540 / face.height);
    face.setScale(fk);
    const bloom = sc.add.circle(480, 250, 420, 0xffffff, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    const bars = [sc.add.rectangle(480, 14, 1100, 28, 0x000000), sc.add.rectangle(480, 526, 1100, 28, 0x000000)];
    root.add([glow, rays, face, bloom, ...bars]);
    sc.tweens.add({ targets: face, scale: fk * 1.12, duration: 4200, ease: "Sine.out" });
    sc.tweens.add({ targets: bloom, alpha: calm ? 0.24 : 0.34, duration: calm ? 1400 : 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    every(calm ? 260 : 110, () => {
      const sp = sc.add.text(120 + Math.random() * 720, 60 + Math.random() * 400, Math.random() < 0.3 ? "♥" : "✦", { fontFamily: "sans-serif", fontSize: `${18 + Math.random() * 22}px`, color: Math.random() < 0.3 ? "#f472b6" : "#ffffff", stroke: "#be185d", strokeThickness: 2 }).setOrigin(0.5);
      root.addAt(sp, root.getIndex(bars[0]));
      sp.setScale(0);
      sc.tweens.add({ targets: sp, scale: 1, angle: 90, duration: calm ? 700 : 350, yoyo: true, onComplete: () => sp.destroy() });
    });
    synth.play("chime");
    await hold(700, host);
    if (done()) return;
    // the line itself, subtitled, in his own voice
    const sub = sc.add.text(480, 470, `POLSON: “${LOO_LINE}”`, { fontFamily: "Impact, sans-serif", fontSize: "36px", color: "#ffffff", stroke: "#831843", strokeThickness: 7 }).setOrigin(0.5);
    root.addAt(sub, root.getIndex(bars[0]));
    voice.say("POLSON", "Phwoar, smells gorgeous.");
    const t0 = Date.now();
    await new Promise<void>((res) => {
      let fin = false;
      const end = () => {
        if (fin) return;
        fin = true;
        window.clearInterval(id);
        res();
      };
      const id = window.setInterval(() => {
        const t = Date.now() - t0;
        if (done() || t > 6000 || (t > 2600 && !voice.busy())) end();
      }, 100);
      void host.press().then(end);
    });
    if (done()) return;
    await hold(500, host);
    if (done()) return;

    // ---------------------------------------------------------------- 5. flush, and back to the room
    synth.play("flush");
    const fade = sc.add.rectangle(480, 270, 1100, 700, 0x111111, 0);
    root.add(fade);
    sc.tweens.add({ targets: fade, alpha: 1, duration: 500 });
    await hold(650, host);
  } finally {
    if (host.skipping()) voice.stop();
    if (alive(sc)) wipe();
    clear();
    if (root.active) root.destroy();
  }
}

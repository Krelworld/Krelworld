import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { CINE_DEPTH } from "../../gfx/Cine";
import * as Juice from "../../gfx/Juice";

/**
 * The way in to Uncle Rik's colon (after the Genie's shrink ray zaps you, before the rik_colon dungeon):
 *
 *  1. the shrink itself, in the world: the camera punches in on you as you drop through three anime size-steps in a
 *     burst of sparkles, down to a glinting speck;
 *  2. ant's-eye view: the camera tilts down past giant blades of grass and rooftop tiles as the speck floats down and
 *     runs for the tub;
 *  3. Uncle Rik from behind, in his tub (only ever shown above the waterline, vest on): you leap off the rim, a heroic
 *     dive with speed lines, and the moment you reach the water the Ministry of Dignity censors the frame;
 *  4. a hard cut to a medical-textbook plate of the lower GI tract, a dotted route up it (rectum, sigmoid colon,
 *     descending colon, transverse colon: YOU ARE HERE) with you travelling it, then a dissolve.
 *
 * Nothing below Uncle Rik's waterline is ever drawn. The music isn't touched (In Tha Hot Tub plays on). A click / tap,
 * Enter or Tab skips the lot. "Reduce flashing" gets softer flashes and still speed lines. Screen-space, 960x540.
 */

const DEPTH = CINE_DEPTH + 5;

/** Plate art (256x144) to screen: drawn at 2.5x with its top-left here. */
const PLATE = { x: 160, y: 112, k: 2.5 };
const pp = (ix: number, iy: number) => ({ x: PLATE.x + ix * PLATE.k, y: PLATE.y + iy * PLATE.k });

/** The route up the plate's colon, in plate-art pixels: anus end of the rectum, up through the sigmoid, the
 * descending colon, round the splenic flexure and along the transverse colon to the middle. */
const ROUTE: [number, number][] = [
  [129, 143], [129, 126], [128, 110], [131, 100], [140, 97], [152, 103], [166, 106], [178, 101], [185, 90],
  [186, 72], [186, 52], [186, 32], [184, 14], [176, 8], [164, 14], [150, 22], [134, 27], [120, 28],
];

interface Callout {
  /** Where the leader line touches the drawing (plate pixels). */
  at: [number, number];
  /** Label position (screen) and side. */
  x: number;
  y: number;
  side: "l" | "r";
  name: string;
  note?: string;
  /** Shown when the traveller is this far along the route (0..1); undefined: shown from the start, greyed. */
  when?: number;
}

const CALLOUTS: Callout[] = [
  { at: [129, 132], x: 150, y: 440, side: "l", name: "RECTUM", note: "point of entry", when: 0.02 },
  { at: [160, 105], x: 812, y: 432, side: "r", name: "SIGMOID COLON", note: "S-bend; mind the corner", when: 0.2 },
  { at: [189, 64], x: 812, y: 262, side: "r", name: "DESCENDING COLON", note: "the long climb", when: 0.42 },
  { at: [182, 10], x: 812, y: 132, side: "r", name: "SPLENIC FLEXURE", when: 0.72 },
  { at: [118, 30], x: 150, y: 150, side: "l", name: "TRANSVERSE COLON", when: 0.95 },
  { at: [66, 62], x: 150, y: 300, side: "l", name: "Ascending colon", note: "(not on this trip)" },
];

type Spr = Phaser.GameObjects.Sprite;

export interface ColonEntryOpts {
  /** The player's sprite in the world (shrunk in place, then hidden). */
  player: Spr;
}

export async function playColonEntry(sc: Phaser.Scene, o: ColonEntryOpts): Promise<void> {
  const live = () => !!sc.sys && sc.sys.settings.status < Phaser.Scenes.SHUTDOWN && !!sc.cameras?.main;
  if (!live()) return;
  const calm = Juice.calm();
  const p = o.player;
  const key = p.texture.key;
  const has = (f: number) => p.texture.has(String(f)) || p.texture.has(f as unknown as string);
  const fr = (f: number, fb = 0) => (has(f) ? f : fb);
  const IDLE_E = fr(4);
  const WALK_E = [16, 17, 18, 19, 20, 21].map((f) => fr(f, IDLE_E));
  const ATK_E = fr(45, fr(44, IDLE_E));
  const frameH = p.frame.realHeight || 64;

  // ---- skipping
  let cut = false;
  const wakers = new Set<() => void>();
  const t0 = performance.now();
  const skip = () => {
    if (cut || performance.now() - t0 < 350) return;
    cut = true;
    for (const w of wakers) w();
    wakers.clear();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Tab" || e.key === "Enter") skip();
  };
  window.addEventListener("keydown", onKey);
  sc.input?.on("pointerdown", skip);
  /** Wait (real time), cut short by a skip. */
  const wait = (ms: number) =>
    new Promise<void>((r) => {
      if (cut) return r();
      const done = () => {
        window.clearTimeout(id);
        wakers.delete(done);
        r();
      };
      const id = window.setTimeout(done, ms);
      wakers.add(done);
    });
  const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
    new Promise<void>((r) => {
      if (cut || !live()) return r();
      sc.tweens.add({ ...cfg, onComplete: () => r() });
      wait((Number(cfg.duration) || 0) + (Number(cfg.delay) || 0) + 60).then(r);
    });

  const L = Juice.layer(sc, DEPTH);
  const root = sc.add.container(0, 0);
  L.add(root);
  const hint = sc.add.text(944, 528, "click / Tab: skip", { fontFamily: "monospace", fontSize: "12px", color: "#9ca3af" }).setOrigin(1, 1).setAlpha(0.8);
  Juice.layer(sc, DEPTH + 3).add(hint);
  const cam = sc.cameras.main;
  const zoom0 = cam.zoom;
  const timers: number[] = [];
  const every = (ms: number, f: () => void) => {
    const id = window.setInterval(() => (live() ? f() : window.clearInterval(id)), ms);
    timers.push(id);
    return id;
  };

  /** A little four-point anime star. */
  const star = (parent: Phaser.GameObjects.Container | null, x: number, y: number, r: number, color = 0xe0ffff) => {
    const s = sc.add.star(x, y, 4, r * 0.28, r, color).setBlendMode(Phaser.BlendModes.ADD);
    if (parent) parent.add(s);
    return s;
  };
  /** Sparkles flung out from a point (world when parent is null). */
  const sparkles = (parent: Phaser.GameObjects.Container | null, x: number, y: number, n: number, rad: number, depth = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const s = star(parent, x, y, 4 + Math.random() * 6, i % 3 === 0 ? 0xfff6a8 : 0xa5f3fc);
      if (!parent) s.setDepth(depth);
      sc.tweens.add({ targets: s, x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad, angle: 180, scale: 0.2, alpha: 0, duration: 520 + Math.random() * 260, ease: "Cubic.out", onComplete: () => s.destroy() });
    }
  };

  /** A caption box, textbook style (cream card, serif). */
  const caption = (parent: Phaser.GameObjects.Container, text: string, x = 32, y = 44) => {
    const t = sc.add.text(x + 12, y + 8, text, { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "17px", fontStyle: "italic", color: "#2b2118", wordWrap: { width: 420 } });
    const b = sc.add.rectangle(x, y, t.width + 24, t.height + 16, 0xf3ead2, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0x2b2118);
    parent.add([b, t]);
    b.setAlpha(0);
    t.setAlpha(0);
    sc.tweens.add({ targets: [b, t], alpha: 1, duration: 260 });
    return [b, t];
  };

  /** A full-screen picture (cover-scaled, `extra` larger), centred. */
  const backdrop = (parent: Phaser.GameObjects.Container, k: string, extra = 1) => {
    const img = sc.add.image(480, 270, k);
    const s = Math.max(960 / img.frame.realWidth, 540 / img.frame.realHeight) * extra;
    img.setScale(s);
    parent.add(img);
    return img;
  };
  /** The player as a little screen-space figure, `h` px tall. */
  const figure = (parent: Phaser.GameObjects.Container, x: number, y: number, h: number, frame = IDLE_E) => {
    const f = sc.add.sprite(x, y, key, frame).setOrigin(0.5, 1);
    f.setScale(h / frameH);
    parent.add(f);
    return f;
  };
  const runCycle = (f: Spr, ms = 90) => {
    let i = 0;
    return every(ms, () => f.active && f.setFrame(WALK_E[i++ % WALK_E.length]));
  };

  /** Speed lines: redrawn for the motion, or (reduce flashing) drawn once and left still. */
  const speedLines = (parent: Phaser.GameObjects.Container, color: number, cx = 480, cy = 270, dirAng?: number) => {
    const g = sc.add.graphics();
    parent.add(g);
    const draw = () => {
      if (!g.active) return;
      g.clear();
      for (let i = 0; i < 46; i++) {
        const a = dirAng === undefined ? Math.random() * Math.PI * 2 : dirAng + (Math.random() - 0.5) * 0.5;
        const r0 = 160 + Math.random() * 140;
        g.lineStyle(1 + Math.random() * 3, color, 0.35 + Math.random() * 0.4);
        if (dirAng === undefined) g.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 900, cy + Math.sin(a) * 900);
        else {
          // parallel streaks across the frame, pointing back along the motion
          const ox = Math.random() * 1100 - 70;
          const oy = Math.random() * 640 - 50;
          const len = 120 + Math.random() * 260;
          g.lineBetween(ox, oy, ox - Math.cos(dirAng) * len, oy - Math.sin(dirAng) * len);
        }
      }
    };
    draw();
    if (!calm) every(70, draw);
    return g;
  };

  const panel = () => {
    root.removeAll(true);
    for (const id of timers.splice(0)) window.clearInterval(id);
    const c = sc.add.container(0, 0);
    root.add(c);
    return c;
  };

  try {
    // ================================================================ 1. the shrink, in the world
    if (live() && !cut) {
      cam.zoomTo(Math.max(zoom0, 1) * 2.2, 1000, "Cubic.easeOut", true);
      const ring = sc.add.circle(p.x, p.y - 20, 70).setStrokeStyle(3, 0x67e8f9, 0.9).setFillStyle(0, 0).setDepth(p.depth + 2);
      sc.tweens.add({ targets: ring, radius: 4, alpha: 0.2, duration: 1600, ease: "Cubic.in", onComplete: () => ring.destroy() });
      const sc0 = p.scaleX;
      for (const k of [0.55, 0.25, 0.08]) {
        if (cut) break;
        synth.play("tap");
        sparkles(null, p.x, p.y - (p.displayHeight * 0.5), 10, 46, p.depth + 3);
        Juice.flash(sc, 0xa5f3fc, 160, 0.35, DEPTH - 2);
        await tw({ targets: p, scaleX: sc0 * k, scaleY: sc0 * k, duration: 140, ease: "Back.in" });
        await wait(260);
      }
      p.setScale(sc0 * 0.04);
      // the glint: a single star where you were
      const glint = sc.add.star(p.x, p.y - 2, 4, 2, 14, 0xffffff).setDepth(p.depth + 4).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
      synth.play("ding", 0.7);
      await tw({ targets: glint, scale: 1.2, angle: 90, duration: 260, yoyo: true, ease: "Quad.out" });
      glint.destroy();
      await wait(250);
    }

    // ================================================================ 2. ant's-eye view: tilt down, the speck lands
    if (live() && !cut) {
      const c = panel();
      c.add(sc.add.rectangle(480, 270, 1100, 700, 0x0b0716));
      const img = backdrop(c, "ce_macro", 1.3);
      const over = (img.displayHeight - 540) / 2;
      img.y = 270 + over; // the sky first
      sc.tweens.add({ targets: img, y: 270 - over, duration: 2300, ease: "Sine.inOut" });
      const fig = figure(c, 360, -30, 34, IDLE_E);
      const trail = every(80, () => fig.active && sparkles(c, fig.x + (Math.random() - 0.5) * 10, fig.y - 16, 1, 18));
      caption(c, "Four millimetres tall. The rooftop is now a jungle.");
      await tw({ targets: fig, y: 478, duration: 2300, ease: "Sine.inOut" });
      window.clearInterval(trail);
      synth.play("pop", 0.6);
      sparkles(c, fig.x, fig.y, 6, 26);
      await wait(250);
      // run for the tub
      const run = runCycle(fig);
      await tw({ targets: fig, x: 640, duration: 1000 });
      window.clearInterval(run);
      fig.setFrame(IDLE_E);
      await wait(200);
    }

    // ================================================================ 3. Uncle Rik (from behind, above the water), the dive
    if (live() && !cut) {
      const c = panel();
      const img = backdrop(c, "ce_rik_back", 1.04);
      sc.tweens.add({ targets: img, scale: img.scale * 1.06, duration: 3600, ease: "Sine.out" });
      caption(c, "Uncle Rik settles back into the tub. He has no idea what's coming.");
      const fig = figure(c, 150, 500, 26, IDLE_E);
      const run = runCycle(fig);
      await tw({ targets: fig, x: 250, duration: 700 });
      window.clearInterval(run);
      fig.setFrame(IDLE_E);
      await wait(350);
      // crouch… and leap
      await tw({ targets: fig, scaleY: fig.scaleY * 0.7, duration: 160, ease: "Quad.out" });
      synth.play("dodge");
      Juice.whoosh(0.35);
      fig.setScale(fig.scaleX).setFrame(ATK_E);
      const arc = { t: 0 };
      await tw({
        targets: arc,
        t: 1,
        duration: 700,
        ease: "Sine.out",
        onUpdate: () => {
          fig.setPosition(250 + 170 * arc.t, 500 - 230 * Math.sin(arc.t * Math.PI * 0.6));
          fig.setAngle(arc.t * 40);
        },
      });

      // -- the heroic dive (close-up, speed lines)
      const d = panel();
      d.add(sc.add.rectangle(480, 270, 1100, 700, 0x0e3b44));
      speedLines(d, 0xbaf7ff, 480, 270, Math.PI * 0.32);
      const hero = sc.add.sprite(480, 270, key, ATK_E).setScale(300 / frameH).setAngle(62);
      d.add(hero);
      sc.tweens.add({ targets: hero, x: 520, y: 300, duration: 1300, ease: "Sine.inOut" });
      Juice.shake(sc, 600, 0.006);
      Juice.slamText(sc, "GERONIMOOOO!", "#fde047", 64, 110, 900, DEPTH + 1);
      synth.play("swing2");
      await wait(1300);

      // -- back to the wide: down towards the water… and the Ministry steps in
      const w = panel();
      backdrop(w, "ce_rik_back", 1.1);
      const fall = figure(w, 450, 250, 22, ATK_E).setAngle(70);
      speedLines(w, 0xffffff, 470, 392);
      await tw({ targets: fall, x: 470, y: 392, duration: 420, ease: "Quad.in" });
      const card = sc.add.container(0, 0);
      w.add(card);
      card.add(sc.add.rectangle(480, 270, 1100, 700, 0x0a0a0a));
      card.add(sc.add.text(480, 205, "CENSORED", { fontFamily: "Impact, sans-serif", fontSize: "112px", color: "#ffffff" }).setOrigin(0.5));
      card.add(sc.add.text(480, 290, "BY THE MINISTRY OF DIGNITY", { fontFamily: "Impact, sans-serif", fontSize: "38px", color: "#fde047" }).setOrigin(0.5));
      card.add(sc.add.text(480, 345, "Nothing below Uncle Rik's waterline has been depicted.\nPlease enjoy this educational diagram instead.", { fontFamily: "Georgia, serif", fontSize: "18px", fontStyle: "italic", color: "#d1d5db", align: "center" }).setOrigin(0.5));
      const stamp = sc.add.container(770, 420).setAngle(-14);
      stamp.add(sc.add.rectangle(0, 0, 230, 64).setStrokeStyle(5, 0xdc2626));
      stamp.add(sc.add.text(0, 0, "DIGNITY\nPRESERVED", { fontFamily: "Impact, sans-serif", fontSize: "24px", color: "#dc2626", align: "center" }).setOrigin(0.5));
      card.add(stamp);
      synth.play("tap_fail");
      synth.play("splash", 0.5);
      stamp.setScale(2.4).setAlpha(0);
      sc.tweens.add({ targets: stamp, scale: 1, alpha: 0.9, delay: 450, duration: 180, ease: "Quad.in", onComplete: () => live() && synth.play("punch", 0.6) });
      await wait(2300);
    }

    // ================================================================ 4. FIG. 7: the medical plate
    if (live() && !cut) {
      const c = panel();
      const ink = "#2b2118";
      c.add(sc.add.rectangle(480, 270, 1100, 700, 0xefe6cf));
      c.add(sc.add.rectangle(480, 270, 920, 504).setStrokeStyle(2, 0x6b5a45));
      c.add(sc.add.rectangle(480, 270, 910, 494).setStrokeStyle(1, 0x6b5a45));
      c.add(sc.add.text(480, 52, "FIG. 7: THE LOWER GASTROINTESTINAL TRACT (UNCLE RIK)", { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "22px", fontStyle: "bold", color: ink }).setOrigin(0.5));
      c.add(sc.add.text(480, 82, "Anterior view. The route of the four-millimetre explorer is shown dotted.", { fontFamily: "Georgia, serif", fontSize: "15px", fontStyle: "italic", color: "#4a3b2c" }).setOrigin(0.5));
      c.add(sc.add.text(920, 34, "PLATE XLII", { fontFamily: "Georgia, serif", fontSize: "12px", color: "#6b5a45" }).setOrigin(1, 0.5));
      c.add(sc.add.image(PLATE.x, PLATE.y, "ce_plate").setOrigin(0, 0).setScale(PLATE.k));
      c.add(sc.add.text(480, 500, "Not to scale. For educational purposes only. Uncle Rik was not consulted.", { fontFamily: "Georgia, serif", fontSize: "13px", fontStyle: "italic", color: "#4a3b2c" }).setOrigin(0.5));

      // callouts
      const shown = new Set<Callout>();
      const showCallout = (co: Callout) => {
        if (shown.has(co)) return;
        shown.add(co);
        const a = pp(co.at[0], co.at[1]);
        const grey = co.when === undefined;
        const col = grey ? 0x9a8b75 : 0x2b2118;
        const g = sc.add.graphics().lineStyle(1.5, col, 1);
        const ex = co.side === "l" ? co.x + 6 : co.x - 6;
        g.lineBetween(a.x, a.y, ex, co.y);
        g.fillStyle(col, 1).fillCircle(a.x, a.y, 3);
        const t = sc.add.text(co.x, co.y, co.name, { fontFamily: "Georgia, serif", fontSize: grey ? "14px" : "16px", fontStyle: grey ? "italic" : "bold", color: grey ? "#8a7b65" : ink }).setOrigin(co.side === "l" ? 1 : 0, 1);
        const parts: Phaser.GameObjects.GameObject[] = [g, t];
        if (co.note) parts.push(sc.add.text(co.x, co.y + 2, co.note, { fontFamily: "Georgia, serif", fontSize: "13px", fontStyle: "italic", color: grey ? "#9a8b75" : "#4a3b2c" }).setOrigin(co.side === "l" ? 1 : 0, 0));
        c.add(parts);
        for (const q of parts) (q as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
        sc.tweens.add({ targets: parts, alpha: 1, duration: 300 });
        if (!grey) synth.play("type", 0.5);
      };
      for (const co of CALLOUTS) if (co.when === undefined) showCallout(co);

      // the route: arc-length along the polyline
      const pts = ROUTE.map(([x, y]) => pp(x, y));
      const seg: number[] = [0];
      for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Phaser.Math.Distance.Between(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
      const total = seg[seg.length - 1];
      const at = (t: number) => {
        const d = t * total;
        let i = 1;
        while (i < seg.length - 1 && seg[i] < d) i++;
        const u = (d - seg[i - 1]) / Math.max(1, seg[i] - seg[i - 1]);
        return { x: Phaser.Math.Linear(pts[i - 1].x, pts[i].x, u), y: Phaser.Math.Linear(pts[i - 1].y, pts[i].y, u) };
      };
      const dots = sc.add.graphics();
      c.add(dots);
      const icon = figure(c, pts[0].x, pts[0].y, 24, IDLE_E).setOrigin(0.5, 0.5);
      const ring = sc.add.circle(pts[0].x, pts[0].y, 15).setStrokeStyle(2, 0xb91c1c, 1).setFillStyle(0xfff7e6, 0.85);
      c.addAt(ring, c.getIndex(icon));
      const prog = { t: 0 };
      let drawnTo = 0;
      await wait(500);
      await tw({
        targets: prog,
        t: 1,
        duration: 5200,
        ease: "Sine.inOut",
        onUpdate: () => {
          const q = at(prog.t);
          icon.setPosition(q.x, q.y);
          ring.setPosition(q.x, q.y);
          // a dot every 9px of route
          const upTo = Math.floor((prog.t * total) / 9);
          dots.fillStyle(0xb91c1c, 1);
          for (; drawnTo <= upTo; drawnTo++) {
            const d = at(Math.min(1, (drawnTo * 9) / total));
            dots.fillCircle(d.x, d.y, 2.2);
          }
          for (const co of CALLOUTS) if (co.when !== undefined && prog.t >= co.when) showCallout(co);
        },
      });
      for (const co of CALLOUTS) showCallout(co);
      // YOU ARE HERE
      const end = at(1);
      const here = sc.add.text(150, 172, "YOU ARE HERE", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#b91c1c" }).setOrigin(1, 0);
      const arrow = sc.add.graphics().lineStyle(2, 0xb91c1c, 1).lineBetween(154, 186, end.x - 18, end.y + 6);
      c.add([here, arrow]);
      sc.tweens.add({ targets: [here, ring], alpha: 0.45, yoyo: true, repeat: -1, duration: calm ? 900 : 520, ease: "Sine.inOut" });
      synth.play("ding", 0.8);
      await wait(2000);

      // dissolve (into the colon's own pink-dark)
      const veil = sc.add.rectangle(480, 270, 1100, 700, 0x3c0014, 0);
      c.add(veil);
      await tw({ targets: veil, fillAlpha: 1, duration: 900, ease: "Sine.in" });
    }
  } finally {
    for (const id of timers.splice(0)) window.clearInterval(id);
    window.removeEventListener("keydown", onKey);
    sc.input?.off("pointerdown", skip);
    if (live()) {
      hint.destroy();
      // a skip leaves the screen dark (the caller fades into the colon), never a half-drawn panel
      root.removeAll(true);
      const veil = sc.add.rectangle(480, 270, 1100, 700, 0x3c0014, 1);
      root.add(veil);
      cam.zoomTo(zoom0, 1, "Linear", true);
      p.setVisible(false);
      window.setTimeout(() => root.active && root.destroy(), 2500);
    }
  }
}

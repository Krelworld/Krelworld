import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { voice } from "../../audio/Voice";
import { addCensorBar, censorRect, WONK_ART, type Box, type CensorBar } from "../../gfx/Censor";
import { STRIP_BARS } from "../../gfx/stripBars";
import { vfx } from "../../gfx/Vfx";
import { FONT } from "../../ui/theme";
import { hdFactor } from "../../gfx/HD";
import { CHARACTERS } from "../../../data/characters";
import { CLOSEUP_DEREK, CLOSEUP_GASPS, CLOSEUP_MOANS, CLOSEUP_THANKS, CLOSEUP_YOU } from "../../../content/clubCloseup";

/**
 * THE WONKY POLE, "watch up close": an anime cut-away. Hard cut and zoom on the dancer in a big manga panel (speed
 * lines, sparkles, pink haze), her routine stage by stage (costume, bikini, the doll), each lot flung at the lens.
 * The doll stage is ALWAYS under its censor bars (STRIP_BARS, scaled up, padded): the bars are set from the same
 * frame the sprite shows, every frame, before it's drawn, and the doll frames are never shown without them.
 * Cut-in panels of the front row: sweating, nosebleeds, heart eyes, a censor bar over the lap with motion lines
 * round it (the wonking is implied, never drawn), moaning, then each one krezzes (a brown cloud and a fart).
 * Then YOU, full screen: moaning behind your own bar, and the krezz (implied only: a KREZZ! card, speed lines, a splat
 * and a CENSORED card over the lot; nothing drawn). She's dressed again and thanks you for it (voiced). Big Derek's palm
 * hits the lens: SHOW'S OVER. Esc / click / tap skips.
 */

/** The dancer's pole routine per stage (as ClubScene): costume, bikini, the doll. */
const STAGES = [16, 32, 48].map((s) => Array.from({ length: 9 }, (_, i) => s + i));
const DOLL0 = 48;
const DOLL1 = 56;
const GARMENTS: Record<string, string[][]> = {
  spr_TV_DANCER1: [["club_garm1_0"], ["club_garm1_top", "club_garm1_bot"]],
  spr_TV_DANCER2: [["club_garm2_0"], ["club_garm2_top", "club_garm2_bot"]],
};
const STAGE_CARDS = ["STAGE 1 · FEATHERS", "STAGE 2 · THE BIKINI", "STAGE 3 · ██████████"];
/** How much of the close-up zoom each sheet gets (her art's size in its frame). */
const FIT: Record<string, number> = {};
/** Frame pixels added round each strip bar (on top of the pixel already in STRIP_BARS): generous. */
const DOLL_PAD = 2;

const WONK_DONE = ["...ahh.", "sorry.", "phew.", "that's better.", "anyone got a tissue", "oh no. oh no."];

export interface CloseupLad {
  id: string;
}

export interface CloseupOpts {
  /** The dancer's sheet (spr_TV_DANCER1/2). */
  tex: string;
  name: string;
  /** The dancer's id (DESTINY / CRYSTAL): whose voice thanks you. */
  id: string;
  /** The front row lads who get a cut-in (up to 4). */
  lads: CloseupLad[];
}

/** The union of each bar over the whole doll routine (for a frame with no entry of its own). */
function barUnion(key: string): Box[] | null {
  const fr = STRIP_BARS[key];
  if (!fr) return null;
  const all = Object.values(fr);
  return [0, 1].map((i) => [Math.min(...all.map((b) => b[i][0])), Math.min(...all.map((b) => b[i][1])), Math.max(...all.map((b) => b[i][2])), Math.max(...all.map((b) => b[i][3]))] as Box);
}

/** The bar boxes for this frame of the dancer's sheet: null when she's not on a doll frame. */
export function closeupBars(key: string, frame: number): Box[] | null {
  if (frame < DOLL0 || frame > DOLL1) return null;
  return STRIP_BARS[key]?.[frame] ?? barUnion(key) ?? [[0, 0, 64, 64]];
}

export function playCloseup(scene: Phaser.Scene, o: CloseupOpts): Promise<void> {
  return new Promise((resolve) => {
    const calm = !!G.meta?.settings?.calmFlash;
    const W = 960;
    const H = 540;
    const timers: Phaser.Time.TimerEvent[] = [];
    const tweens: Phaser.Tweens.Tween[] = [];
    const at = (ms: number, fn: () => void) => timers.push(scene.time.delayedCall(ms, fn));
    const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => {
      const t = scene.tweens.add(cfg);
      tweens.push(t);
      return t;
    };
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const t0 = scene.time.now;
    let done = false;

    const root = scene.add.container(0, 0).setDepth(5000);
    // the club, gone: a hard cut
    root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x12001c));

    // ---------------------------------------------------------------- the big panel: her
    const P = { x: 14, y: 14, w: 508, h: 512 };
    const cx = P.x + P.w / 2;
    const cy = P.y + P.h / 2;
    const main = scene.add.container(0, 0);
    root.add(main);
    const panelBg = scene.add.graphics();
    panelBg.fillGradientStyle(0xff7ac6, 0xff7ac6, 0x5b1a8a, 0x5b1a8a, 1).fillRect(P.x, P.y, P.w, P.h);
    main.add(panelBg);
    // speed lines, radiating from her
    const lines = scene.add.graphics().setPosition(cx, cy - 20);
    const drawLines = () => {
      lines.clear();
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2 + Math.random() * 0.05;
        const r0 = 170 + Math.random() * 90;
        const r1 = 460;
        lines.lineStyle(1 + Math.random() * 3, 0xffffff, 0.25 + Math.random() * 0.35);
        lines.lineBetween(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
      }
    };
    drawLines();
    main.add(lines);
    tw({ targets: lines, angle: 360, duration: calm ? 60000 : 24000, repeat: -1 });
    // the anime jitter (not with calm flashes: the lines just turn slowly)
    if (!calm) timers.push(scene.time.addEvent({ delay: 90, loop: true, callback: drawLines }));
    // pink haze
    for (let i = 0; i < 3; i++) {
      const e = scene.add.ellipse(cx + (i - 1) * 140, cy + (i % 2 ? -90 : 120), 360, 260, 0xffb3e0, 0.16).setBlendMode(Phaser.BlendModes.ADD);
      main.add(e);
      tw({ targets: e, x: e.x + (i % 2 ? -50 : 50), alpha: 0.28, yoyo: true, repeat: -1, duration: 2600 + i * 700, ease: "Sine.inOut" });
    }
    // her, big
    const canStrip = !!STRIP_BARS[o.tex] && scene.textures.exists(o.tex) && scene.textures.get(o.tex).frameTotal > DOLL1 + 1;
    const dancer = scene.add.sprite(cx, cy + 10, scene.textures.exists(o.tex) ? o.tex : "spr_FOLK2", canStrip ? STAGES[0][0] : 0);
    // the art scale patch (gfx/HD.ts) multiplies scale writes: `zoom.z` is the on-screen size in 64px-frame units
    // (z 7.4 draws the frame 474px tall, whatever size the sheet's frames really are)
    const zoom = { z: 3.6, y: cy + 10 };
    // (a sheet whose art is drawn bigger in its frame can be pulled back here)
    const fit = FIT[dancer.texture.key] ?? 1;
    const setZoom = () => dancer.setScale((zoom.z * fit * 64) / dancer.frame.height / hdFactor(dancer));
    setZoom();
    main.add(dancer);
    let stage = 0;
    const frameNow = (now: number) => {
      const cyc = canStrip ? STAGES[stage] : [8, 9, 10, 11, 12, 13, 14, 15].filter((f) => f < dancer.texture.frameTotal - 1);
      return cyc.length ? cyc[Math.floor(((now - t0) / 1000) * 8) % cyc.length] : 0;
    };
    // her censor bars: always over the doll frames (never shown without them)
    const bars: CensorBar[] = [0, 1].map((i) =>
      addCensorBar(scene, dancer, {
        pad: DOLL_PAD,
        box: () => closeupBars(dancer.texture.key, Number(dancer.frame.name))?.[i] ?? null,
      }),
    );
    for (const b of bars) main.add(b.obj);
    // sparkles round her
    for (let i = 0; i < 14; i++) {
      const s = scene.add.text(P.x + 30 + Math.random() * (P.w - 60), P.y + 30 + Math.random() * (P.h - 60), Math.random() < 0.5 ? "✦" : "✧", { fontFamily: FONT, fontSize: `${14 + Math.floor(Math.random() * 18)}px`, color: Math.random() < 0.5 ? "#ffffff" : "#ffe4f6" }).setOrigin(0.5).setAlpha(0);
      main.add(s);
      tw({ targets: s, alpha: { from: 0, to: 0.95 }, scale: { from: 0.4, to: 1.2 }, yoyo: true, repeat: -1, delay: Math.random() * 1500, duration: calm ? 1400 : 600 + Math.random() * 500, ease: "Sine.inOut" });
    }
    // the panel's frame: black, then a white rule inside it
    const frame = scene.add.graphics();
    frame.lineStyle(8, 0x000000, 1).strokeRect(P.x, P.y, P.w, P.h);
    frame.lineStyle(2, 0xffffff, 1).strokeRect(P.x + 6, P.y + 6, P.w - 12, P.h - 12);
    main.add(frame);
    const maskG = scene.make.graphics({}, false).fillStyle(0xffffff).fillRect(P.x, P.y, P.w, P.h);
    const mask = maskG.createGeometryMask();
    main.setMask(mask);
    const title = scene.add.text(P.x + 18, P.y + 16, `★ UP CLOSE ★  ${o.name}`, { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#ffffff", stroke: "#5b1a8a", strokeThickness: 6 }).setAngle(-4);
    const card = scene.add.text(P.x + P.w - 18, P.y + P.h - 22, "", { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#fff7c2", stroke: "#000000", strokeThickness: 5 }).setOrigin(1, 1).setAngle(-3);
    const doki = scene.add.text(P.x + P.w - 24, P.y + 70, "DOKI\nDOKI", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#ff3d9a", stroke: "#ffffff", strokeThickness: 5, align: "center" }).setOrigin(1, 0).setAngle(10);
    root.add([title, card, doki]);
    tw({ targets: doki, scale: 1.15, yoyo: true, repeat: -1, duration: calm ? 900 : 380 });
    const showCard = (i: number) => {
      card.setText(STAGE_CARDS[i]).setScale(1.6).setAlpha(0);
      tw({ targets: card, scale: 1, alpha: 1, duration: 260, ease: "Back.out" });
    };
    showCard(0);

    // the hard cut and the zoom
    if (calm) {
      const soft = scene.add.rectangle(W / 2, H / 2, W, H, 0xffd1ec, 0.45);
      root.add(soft);
      tw({ targets: soft, alpha: 0, duration: 600, onComplete: () => soft.destroy() });
    } else scene.cameras.main.flash(140, 255, 190, 225);
    synth.play("camera_flash");
    tw({ targets: zoom, z: 7.4, y: cy + 24, duration: 380, ease: "Expo.out" });
    at(420, () => tw({ targets: zoom, z: 8.2, y: cy + 50, duration: 13000, ease: "Sine.inOut" }));
    let bob = 0;

    // everything follows her, after the tweens, before the draw: frame first, then the bars over that frame
    const post = () => {
      if (done) return;
      const now = scene.time.now;
      bob = Math.sin((now - t0) / 260) * 3;
      dancer.setFrame(frameNow(now));
      setZoom();
      dancer.setPosition(cx + bob, zoom.y);
      for (const b of bars) b.follow();
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, post);
    post();

    // a garment, flung at the lens: it fills the screen, and the next stage is underneath when it's gone
    const fling = (key: string, delay: number, dir: number, swap?: () => void) =>
      at(delay, () => {
        if (!scene.textures.exists(key)) {
          swap?.();
          return;
        }
        const g = scene.add.image(dancer.x, dancer.y - 40, key).setScale(3);
        root.add(g);
        synth.play("swing");
        tw({
          targets: g,
          x: cx + dir * 60,
          y: cy - 10,
          scale: 30,
          angle: dir * 200,
          duration: 520,
          ease: "Quad.in",
          onComplete: () => {
            swap?.();
            tw({ targets: g, x: g.x + dir * 900, y: g.y - 200, angle: g.angle + dir * 90, duration: 380, ease: "Quad.in", onComplete: () => g.destroy() });
          },
        });
      });
    const toStage = (i: number) => {
      if (!canStrip) return;
      stage = i;
      showCard(i);
      synth.play("cheer");
      if (i === 2) shoutAll();
    };
    const tex = dancer.texture.key;
    const garm = GARMENTS[tex] ?? [[], []];
    fling(garm[0][0] ?? "", 4200, 1, () => toStage(1));
    if (garm[1].length > 1) fling(garm[1][0], 8600, -1);
    fling(garm[1][garm[1].length - 1] ?? "", 9000, 1, () => toStage(2));

    // ---------------------------------------------------------------- the cut-ins: the front row
    type Cut = { id: string; box: Phaser.GameObjects.Container; spr: Phaser.GameObjects.Sprite; bar: CensorBar; motion: Phaser.GameObjects.Graphics; frames: number[] | null; speed: number; pump: number; px: number; py: number; pw: number; ph: number; nose?: Phaser.GameObjects.Rectangle[] };
    const cuts: Cut[] = [];
    const masks: { destroy(): void }[] = [];
    const lads = o.lads.slice(0, 4);
    const panelAt = (i: number) => ({ x: 534 + (i % 2) * 208, y: 14 + Math.floor(i / 2) * 260, w: 200, h: 252 });
    const SC = 4.2;
    // a frame pixel of his sprite, on screen (real scale and display origin: the art patch and his height move them)
    const fp = (c: Cut, fx: number, fy: number) => ({ x: c.spr.x + (fx - c.spr.displayOriginX) * c.spr.scaleX, y: c.spr.y + (fy - c.spr.displayOriginY) * c.spr.scaleY });

    const slamIn = (lad: CloseupLad, i: number) => {
      const r = panelAt(i);
      const box = scene.add.container(0, 0);
      root.add(box);
      const bg = scene.add.graphics();
      bg.fillStyle([0xffe4f1, 0xd8f3ff, 0xfff4c2, 0xe9ddff][i % 4], 1).fillRect(r.x, r.y, r.w, r.h);
      // little speed lines behind him
      for (let k = 0; k < 18; k++) {
        const yy = r.y + 10 + Math.random() * (r.h - 20);
        bg.lineStyle(1 + Math.random() * 2, 0x000000, 0.12).lineBetween(r.x, yy, r.x + 30 + Math.random() * 50, yy);
        bg.lineBetween(r.x + r.w, yy, r.x + r.w - 30 - Math.random() * 50, yy);
      }
      box.add(bg);
      const key = scene.textures.exists(`spr_${lad.id}`) ? `spr_${lad.id}` : "spr_FOLK1";
      const art = WONK_ART[key];
      const frames = art && scene.textures.get(key).frameTotal > art.frames[art.frames.length - 1] + 1 ? art.frames : null;
      const spr = scene.add.sprite(r.x + r.w / 2, r.y, key, frames ? frames[0] : 0).setOrigin(0.5, 0);
      spr.setScale(SC / hdFactor(spr));
      // frame row 4 (just above his head) at the top of the panel
      spr.y = r.y + 6 - (4 - spr.displayOriginY) * spr.scaleY;
      box.add(spr);
      const motion = scene.add.graphics();
      box.add(motion);
      const bar = addCensorBar(scene, spr, { pad: 2 });
      box.add(bar.obj);
      const fr = scene.add.graphics();
      fr.lineStyle(6, 0x000000, 1).strokeRect(r.x, r.y, r.w, r.h);
      box.add(fr);
      box.add(scene.add.text(r.x + 8, r.y + r.h - 8, CHARACTERS[lad.id]?.name ?? lad.id, { fontFamily: "Impact, sans-serif", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 4 }).setOrigin(0, 1));
      const m = scene.make.graphics({}, false).fillStyle(0xffffff).fillRect(r.x, r.y, r.w, r.h);
      const gm = m.createGeometryMask();
      box.setMask(gm);
      masks.push(gm, m);
      const c: Cut = { id: lad.id, box, spr, bar, motion, frames, speed: 9, pump: 0, px: r.x, py: r.y, pw: r.w, ph: r.h };
      cuts.push(c);
      // the slam
      box.setAlpha(0);
      tw({ targets: box, alpha: 1, duration: 120 });
      synth.play("punch");
      if (!calm) scene.cameras.main.shake(120, 0.004);
      // sweat
      for (const [sx, sy] of [[22, 11], [42, 11], [24, 20]] as const) {
        const p = fp(c, sx, sy);
        const d = scene.add.text(p.x, p.y, "💧", { fontFamily: FONT, fontSize: "16px" }).setOrigin(0.5);
        box.add(d);
        tw({ targets: d, y: p.y + 30, alpha: { from: 1, to: 0 }, repeat: -1, duration: 900 + Math.random() * 500, delay: Math.random() * 600 });
      }
      // heart eyes
      for (const ex of [28, 36]) {
        const p = fp(c, ex, 16);
        const h = scene.add.text(p.x, p.y, "♥", { fontFamily: FONT, fontSize: "26px", color: "#ff2d7a", stroke: "#ffffff", strokeThickness: 3 }).setOrigin(0.5);
        box.add(h);
        tw({ targets: h, scale: 1.35, yoyo: true, repeat: -1, duration: calm ? 700 : 260 });
      }
      // the nosebleed
      c.nose = [30, 34].map((nx) => {
        const p = fp(c, nx, 21);
        const n = scene.add.rectangle(p.x, p.y, 5, 0, 0xd0102a).setOrigin(0.5, 0);
        box.add(n);
        tw({ targets: n, height: 14, duration: 900, ease: "Quad.out" });
        return n;
      });
      // the moan
      const mine = CLOSEUP_MOANS.filter((l) => l.who === lad.id);
      say(c, mine.length ? pick(mine).text : "Mmm. Mmmm. Oh.");
      synth.voice(Math.random() < 0.5 ? "oh" : "mmm", 0.45, 0.9 + Math.random() * 0.2);
      synth.voice("mmm", 0.35, 0.95, 0.5);
    };

    const say = (c: Cut, text: string, bg = "#ffffff", size = 11) => {
      const b = scene.add.text(c.px + c.pw / 2, c.py + 10, text, { fontFamily: FONT, fontSize: `${size}px`, color: "#050505", backgroundColor: bg, padding: { x: 5, y: 3 }, wordWrap: { width: Math.min(c.pw - 20, 460) }, align: "center" }).setOrigin(0.5, 0);
      c.box.add(b);
      b.setScale(0.6);
      tw({ targets: b, scale: 1, duration: 140, ease: "Back.out" });
      at(2000, () => b.active && tw({ targets: b, alpha: 0, duration: 250, onComplete: () => b.destroy() }));
    };

    // the last of it comes off: everyone at once
    const shoutAll = () =>
      cuts.forEach((c, k) =>
        at(k * 140, () => {
          if (done) return;
          say(c, pick(CLOSEUP_GASPS) + "!!", "#ffd1e8");
          c.speed = 16;
          for (const n of c.nose ?? []) tw({ targets: n, height: 24, duration: 500 });
          synth.voice("oh", 0.4, 0.85 + k * 0.08, 0);
        }),
      );

    lads.forEach((l, i) => at(1300 + i * 1900, () => !done && slamIn(l, i)));
    // the moan track under it all
    for (let k = 0; k < 6; k++) at(2000 + k * 2100, () => synth.play(k % 2 ? "moan_men_2" : "moan_men_1", 0.5));

    // the wonking (implied): arms going under the bar, motion lines round it, faster as it goes
    const pump = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const now = scene.time.now - t0;
        for (const c of cuts) {
          if (!c.spr.active) continue;
          const ph = Math.floor(now / (calm ? 200 : 70));
          if (c.speed > 0) {
            c.pump += 0.016 * c.speed;
            if (c.frames) c.spr.setFrame(c.frames[Math.floor(c.pump) % c.frames.length]);
            c.spr.x = c.px + c.pw / 2 + (calm ? 0 : ((ph % 2) - 0.5) * 2);
          }
          c.bar.follow();
          const r = censorRect(c.spr, 2);
          c.motion.clear();
          if (c.speed <= 0) continue;
          // motion lines: short strokes either side of the bar, wobbling (slower with calm flashes)
          c.motion.lineStyle(3, 0x000000, 0.7);
          for (let k = 0; k < 3; k++) {
            const y = r.top + 6 + k * ((r.h - 12) / 2) + ((ph + k) % 2) * 3;
            c.motion.lineBetween(r.left - 22, y, r.left - 6, y - 4);
            c.motion.lineBetween(r.right + 6, y - 4, r.right + 22, y);
          }
        }
      },
    });
    timers.push(pump);

    // each one krezzes: a shudder, a brown cloud, the fart, the line
    const krezz = (c: Cut, k: number) => {
      if (done || !c.spr.active) return;
      c.speed = 0;
      if (c.frames) c.spr.setFrame(c.frames[0]);
      c.spr.x = c.px + c.pw / 2;
      c.bar.follow();
      c.motion.clear();
      const r = censorRect(c.spr, 2);
      synth.fart(2 + (k % 3));
      synth.voice("grunt", 0.4, 0.9);
      const pow = scene.add.text(c.px + c.pw / 2, c.py + c.ph * 0.55, "KREZZ!", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ffd23f", stroke: "#3b1d00", strokeThickness: 7 }).setOrigin(0.5).setAngle(-8).setScale(0.3);
      c.box.add(pow);
      tw({ targets: pow, scale: 1, duration: 200, ease: "Back.out" });
      for (let n = 0; n < 7; n++) {
        const cl = scene.add.circle(r.x + (Math.random() - 0.5) * r.w, r.y + (Math.random() - 0.5) * 10, 14 + Math.random() * 10, [0x7a5230, 0x5e3b1c, 0x9b6b3a][n % 3], 0.85);
        c.box.add(cl);
        tw({ targets: cl, scale: 1.6 + Math.random() * 0.8, y: cl.y - 30 - Math.random() * 60, x: cl.x + (Math.random() - 0.5) * 60, alpha: 0.35, duration: 1400 + Math.random() * 600, ease: "Quad.out" });
      }
      const fv = vfx(scene, "vfx_fart", r.x, r.y, { scale: 1.6, tint: 0x8b5a2b, depth: 0 });
      if (fv) c.box.add(fv);
      for (let n = 0; n < 3; n++) {
        const st = scene.add.text(r.x - 30 + n * 30, r.top - 10, "~", { fontFamily: FONT, fontSize: "26px", color: "#6b4a1e" }).setOrigin(0.5);
        c.box.add(st);
        tw({ targets: st, y: st.y - 50, alpha: 0, duration: 1600, delay: n * 150 });
      }
      for (const n of c.nose ?? []) tw({ targets: n, height: 32, duration: 300 });
      at(450, () => !done && say(c, pick(WONK_DONE), "#fff7c2"));
    };
    const KREZZ0 = 11000;
    lads.forEach((_, k) => at(KREZZ0 + k * 750, () => cuts[k] && krezz(cuts[k], k)));

    // ---------------------------------------------------------------- YOU: the last cut-in, full screen
    const YOU0 = KREZZ0 + Math.max(1, lads.length) * 750 + 900;
    const YOU_KREZZ = YOU0 + 3000;
    const THANKS0 = YOU_KREZZ + 1900;
    let you: Cut | null = null;
    at(YOU0, () => {
      if (done) return;
      const pid = G.s?.player ?? "KREZMAR";
      const r = { x: 0, y: 0, w: W, h: H };
      const box = scene.add.container(0, 0);
      root.add(box);
      const bg = scene.add.graphics();
      bg.fillGradientStyle(0xfff0f7, 0xfff0f7, 0xffb3d9, 0xffb3d9, 1).fillRect(0, 0, W, H);
      // focus lines, in on him
      for (let k = 0; k < 90; k++) {
        const a = (k / 90) * Math.PI * 2 + Math.random() * 0.04;
        bg.lineStyle(1 + Math.random() * 3, 0x000000, 0.08 + Math.random() * 0.1);
        bg.lineBetween(W / 2 + Math.cos(a) * (230 + Math.random() * 60), H / 2 + Math.sin(a) * (200 + Math.random() * 60), W / 2 + Math.cos(a) * 700, H / 2 + Math.sin(a) * 700);
      }
      box.add(bg);
      const key = scene.textures.exists(`spr_${pid}`) ? `spr_${pid}` : "spr_FOLK1";
      const art = WONK_ART[key];
      const frames = art && scene.textures.get(key).frameTotal > art.frames[art.frames.length - 1] + 1 ? art.frames : null;
      const spr = scene.add.sprite(W / 2, 0, key, frames ? frames[0] : 0).setOrigin(0.5, 0);
      spr.setScale(8.4 / hdFactor(spr));
      spr.y = 8 - (4 - spr.displayOriginY) * spr.scaleY;
      box.add(spr);
      const motion = scene.add.graphics();
      box.add(motion);
      const bar = addCensorBar(scene, spr, { pad: 2 });
      box.add(bar.obj);
      box.add(scene.add.text(24, H - 20, `YOU (${CHARACTERS[pid]?.name ?? pid})`, { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#ffffff", stroke: "#000000", strokeThickness: 6 }).setOrigin(0, 1).setAngle(-3));
      const c: Cut = { id: pid, box, spr, bar, motion, frames, speed: 12, pump: 0, px: r.x, py: r.y, pw: r.w, ph: r.h };
      cuts.push(c);
      you = c;
      box.setAlpha(0).setScale(1.08);
      tw({ targets: box, alpha: 1, scale: 1, duration: 160, ease: "Quad.out" });
      synth.play("punch");
      if (!calm) scene.cameras.main.shake(140, 0.005);
      // sweat and the nosebleed, as the lads
      for (const [sx, sy] of [[22, 11], [42, 11], [24, 20]] as const) {
        const p = fp(c, sx, sy);
        const d = scene.add.text(p.x, p.y, "💧", { fontFamily: FONT, fontSize: "28px" }).setOrigin(0.5);
        box.add(d);
        tw({ targets: d, y: p.y + 60, alpha: { from: 1, to: 0 }, repeat: -1, duration: 900 + Math.random() * 500, delay: Math.random() * 600 });
      }
      for (const ex of [28, 36]) {
        const p = fp(c, ex, 16);
        const h = scene.add.text(p.x, p.y, "♥", { fontFamily: FONT, fontSize: "48px", color: "#ff2d7a", stroke: "#ffffff", strokeThickness: 4 }).setOrigin(0.5);
        box.add(h);
        tw({ targets: h, scale: 1.3, yoyo: true, repeat: -1, duration: calm ? 700 : 240 });
      }
      c.nose = [30, 34].map((nx) => {
        const p = fp(c, nx, 21);
        const n = scene.add.rectangle(p.x, p.y, 9, 0, 0xd0102a).setOrigin(0.5, 0);
        box.add(n);
        tw({ targets: n, height: 30, duration: 900, ease: "Quad.out" });
        return n;
      });
      const mine = CLOSEUP_MOANS.filter((l) => l.who === pid).map((l) => l.text);
      const moans = [...mine, ...CLOSEUP_YOU];
      say(c, pick(moans), "#ffffff", 15);
      at(1500, () => !done && say(c, pick(CLOSEUP_YOU), "#ffd1e8", 15));
      synth.voice("mmm", 0.5, 0.9);
      at(700, () => !done && synth.voice("oh", 0.5, 0.95));
      at(1600, () => !done && synth.play("moan_men_1", 0.45));
      at(2300, () => {
        if (done) return;
        c.speed = 22;
        synth.voice("oh", 0.55, 1.1);
      });
    });
    // the krezz: implied, all of it. A KREZZ! card, a soft burst of speed lines, a splat, and CENSORED over the lot
    at(YOU_KREZZ, () => {
      if (done || !you) return;
      const c = you;
      c.speed = 0;
      if (c.frames) c.spr.setFrame(c.frames[0]);
      c.spr.x = W / 2;
      c.bar.follow();
      c.motion.clear();
      synth.voice("grunt", 0.55, 0.85);
      synth.play("splat");
      synth.play("burn_splat", 0.7);
      synth.fart(4);
      const burst = scene.add.graphics();
      for (let k = 0; k < 70; k++) {
        const a = (k / 70) * Math.PI * 2;
        burst.lineStyle(3 + Math.random() * 5, k % 2 ? 0xffffff : 0xff8fc7, 0.85);
        burst.lineBetween(W / 2 + Math.cos(a) * 60, H / 2 + Math.sin(a) * 60, W / 2 + Math.cos(a) * 760, H / 2 + Math.sin(a) * 760);
      }
      c.box.add(burst);
      burst.setAlpha(0);
      // calm flashes: the lines fade up slowly and stay, no flash
      tw({ targets: burst, alpha: calm ? 0.7 : 1, duration: calm ? 500 : 90 });
      if (!calm) scene.cameras.main.shake(260, 0.012);
      const card = scene.add.rectangle(W / 2, H / 2 + 30, W + 40, 190, 0x000000, 1).setAngle(-4);
      const cen = scene.add.text(W / 2, H / 2 + 30, "█ CENSORED █", { fontFamily: "Impact, sans-serif", fontSize: "64px", color: "#ffffff" }).setOrigin(0.5).setAngle(-4);
      const pow = scene.add.text(W / 2, 120, "KREZZ!!", { fontFamily: "Impact, sans-serif", fontSize: "120px", color: "#ffd23f", stroke: "#3b1d00", strokeThickness: 12 }).setOrigin(0.5).setAngle(-8).setScale(0.2);
      c.box.add([card, cen, pow]);
      tw({ targets: pow, scale: 1, duration: 260, ease: "Back.out" });
      tw({ targets: pow, angle: -4, yoyo: true, repeat: -1, duration: calm ? 900 : 160 });
      at(700, () => !done && say(c, pick(WONK_DONE), "#fff7c2", 15));
    });
    // and she thanks you for it: dressed again, beaming, hearts round her
    at(THANKS0, () => {
      if (done) return;
      const box = scene.add.container(0, 0);
      root.add(box);
      const bg = scene.add.graphics();
      bg.fillGradientStyle(0xff7ac6, 0xff7ac6, 0x5b1a8a, 0x5b1a8a, 1).fillRect(0, 0, W, H);
      box.add(bg);
      for (let i = 0; i < 16; i++) {
        const h = scene.add.text(40 + Math.random() * (W - 80), 40 + Math.random() * (H - 80), Math.random() < 0.6 ? "♥" : "✦", { fontFamily: FONT, fontSize: `${18 + Math.floor(Math.random() * 22)}px`, color: Math.random() < 0.5 ? "#ffffff" : "#ffd1e8" }).setOrigin(0.5).setAlpha(0);
        box.add(h);
        tw({ targets: h, alpha: 0.9, y: h.y - 20, yoyo: true, repeat: -1, delay: Math.random() * 800, duration: calm ? 1400 : 700, ease: "Sine.inOut" });
      }
      // her costume, back on (her south idle: the full costume, never a doll frame)
      const her = scene.add.sprite(W / 2 - 150, H / 2 + 40, dancer.texture.key, 0);
      her.setScale((6.8 * 64) / her.frame.height / hdFactor(her));
      box.add(her);
      tw({ targets: her, y: her.y - 6, yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
      const mine = CLOSEUP_THANKS.filter((l) => l.s === o.id);
      const line = pick(mine.length ? mine : CLOSEUP_THANKS);
      const bub = scene.add.text(W / 2 + 160, H / 2 - 60, line.t, { fontFamily: FONT, fontSize: "22px", color: "#050505", backgroundColor: "#ffffff", padding: { x: 14, y: 10 }, wordWrap: { width: 380 }, align: "center" }).setOrigin(0.5).setScale(0.5);
      const nm = scene.add.text(W / 2 + 160, H / 2 + 20, `♥ ${o.name} ♥`, { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ffffff", stroke: "#5b1a8a", strokeThickness: 6 }).setOrigin(0.5);
      box.add([bub, nm]);
      tw({ targets: bub, scale: 1, duration: 220, ease: "Back.out" });
      box.setAlpha(0);
      tw({ targets: box, alpha: 1, duration: 200 });
      synth.play("coin");
      voice.say(line.s, line.t);
    });

    // ---------------------------------------------------------------- SHOW'S OVER
    const SLAM = THANKS0 + 3000;
    at(SLAM, () => {
      if (done) return;
      voice.stop();
      const hk = scene.textures.exists("club_derek_hand") ? "club_derek_hand" : null;
      const hand = hk ? scene.add.image(W + 400, H / 2 + 40, hk).setScale(10).setAngle(-20) : scene.add.text(W + 400, H / 2, "✋", { fontSize: "600px" }).setOrigin(0.5);
      root.add(hand);
      tw({
        targets: hand,
        x: W / 2,
        y: H / 2 + 20,
        angle: -4,
        duration: 220,
        ease: "Quad.in",
        onComplete: () => {
          synth.play("punch_big");
          synth.play("bodies_land");
          scene.cameras.main.shake(calm ? 160 : 380, calm ? 0.006 : 0.018);
        },
      });
      at(900, () => {
        if (done) return;
        const black = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0);
        root.add(black);
        tw({ targets: black, fillAlpha: 1, duration: 300 });
        const over = scene.add.text(W / 2, H / 2 - 20, "SHOW'S OVER.", { fontFamily: "Impact, sans-serif", fontSize: "72px", color: "#ff6bb0", stroke: "#ffffff", strokeThickness: 6 }).setOrigin(0.5).setAlpha(0).setScale(1.6);
        const sub = scene.add.text(W / 2, H / 2 + 50, `BIG DEREK: "${CLOSEUP_DEREK.t}"`, { fontFamily: FONT, fontSize: "15px", color: "#ffffff", wordWrap: { width: 800 }, align: "center" }).setOrigin(0.5).setAlpha(0);
        root.add([over, sub]);
        tw({ targets: over, alpha: 1, scale: 1, duration: 300, delay: 250, ease: "Back.out" });
        tw({ targets: sub, alpha: 1, duration: 300, delay: 450 });
        voice.say(CLOSEUP_DEREK.s, CLOSEUP_DEREK.t);
      });
      at(3600, () => finish(false));
    });

    // ---------------------------------------------------------------- skip, and the way out
    const skip = () => scene.time.now - t0 > 400 && finish(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    scene.input.on("pointerdown", skip);
    const hint = scene.add.text(W - 10, H - 6, "ESC / CLICK: skip", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 4, y: 2 } }).setOrigin(1, 1);
    root.add(hint);

    function finish(skipped: boolean) {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      scene.input.off("pointerdown", skip);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, post);
      for (const t of timers) t.remove(false);
      if (skipped) voice.stop();
      const out = () => {
        for (const t of tweens) t.remove();
        mask.destroy();
        maskG.destroy();
        for (const m of masks) m.destroy();
        root.destroy();
        resolve();
      };
      tw({ targets: root, alpha: 0, duration: skipped ? 150 : 350, onComplete: out });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, post);
      resolve();
    });
  });
}

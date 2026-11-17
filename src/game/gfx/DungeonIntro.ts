import Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import type { DungeonDef } from "../../data/dungeons";
import { PIXEL_BOLD } from "../ui/theme";
import { charMeta, hdFactor } from "./HD";
import { onSkip, runOverlay } from "./Overlay";

/**
 * The anime dungeon-entry cutscene (about 3s): a low-angle shot of your lad striding up to the entrance under focus
 * lines, a whip-pan to the side-on kick that bursts the door, an ink-brush slash wipes the screen, and the dungeon's
 * NAME slams in on a brush stroke with its subtitle tag, a crash and a shake. Then back to the room.
 * Plays on the first entry of each run into each dungeon (not every room, not on a retry after a death).
 * Any key, click or pad button skips it. Respects calmFlash (soft glows, slow steady lines) and the shake setting.
 * The backdrop is `di_<dungeonId>` (PixelLab art); without it there's a procedural door.
 */

export interface DungeonIntroOpts {
  name: string;
  subtitle?: string;
  /** the small tag above the name, e.g. "CHAPTER 3 · DUNGEON" */
  tag?: string;
  /** key colour (brush stroke, glow, focus lines) */
  color: number;
  /** backdrop texture for the entrance shot */
  bg?: string;
}

/** Per-dungeon colour and (optionally) a punchier subtitle than the one split off its name. */
const LOOK: Record<string, { color: number; subtitle?: string }> = {
  wildern: { color: 0x22c55e, subtitle: "THE SCHOOL OF HARD KNOCKS" },
  polson_towers: { color: 0xa855f7, subtitle: "COUNCIL ESTATE OF THE DAMNED" },
  ministry: { color: 0xf472b6 },
  citadel: { color: 0xef4444, subtitle: "THE SUPREME LEADER IS HOME" },
  krelford_finale: { color: 0x7c3aed, subtitle: "THE LAST STAND" },
  airport: { color: 0x38bdf8 },
  rik_colon: { color: 0x84cc16 },
  crobley_factory: { color: 0xf97316, subtitle: "WHERE THE SAUSAGES ARE MADE" },
  arena_brand: { color: 0xe5e7eb },
  arena_troll: { color: 0x3b82f6 },
  arena_lukemind: { color: 0x2dd4bf, subtitle: "MIND THE GAP" },
  arena_flatmate: { color: 0x9ca3af, subtitle: "THE DEPOSIT IS OWED" },
  arena_rival: { color: 0xd97706 },
  arena_sanmik: { color: 0xfacc15 },
  sanmik_hangout: { color: 0xfacc15, subtitle: "BEGOUR'S CAFÉ, CATFORD" },
};
/** Dungeons sharing another's entrance art. */
const BG_ALIAS: Record<string, string> = { sanmik_hangout: "arena_sanmik" };

/** Split "NAME (SUB)", "NAME — SUB" and "NAME: SUB" into a title and a subtitle. */
export function splitDungeonName(full: string): { name: string; subtitle?: string } {
  const paren = full.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (paren) return { name: paren[1].trim(), subtitle: paren[2].trim() };
  const dash = full.split(/\s+[—–-]\s+/);
  if (dash.length > 1) return { name: dash[0].trim(), subtitle: dash.slice(1).join(" — ").trim() };
  const colon = full.indexOf(": ");
  if (colon > 0) return { name: full.slice(0, colon).trim(), subtitle: full.slice(colon + 2).trim() };
  return { name: full.trim() };
}

/** The card's words and look for a dungeon. */
export function dungeonIntroOpts(d: DungeonDef): DungeonIntroOpts {
  const look = LOOK[d.id];
  const { name, subtitle } = splitDungeonName(d.name);
  const arena = d.id.startsWith("arena_") || !!d.arenaFlag;
  const tag = d.chapter > 0 ? `CHAPTER ${d.chapter} · ${arena ? "ARENA" : "DUNGEON"}` : arena ? "ARENA" : "ELSEWHERE";
  return {
    name: name.toUpperCase(),
    subtitle: (look?.subtitle && subtitle ? `${subtitle} · ${look.subtitle}` : look?.subtitle ?? subtitle)?.toUpperCase(),
    tag,
    color: look?.color ?? 0xdc2626,
    bg: `di_${BG_ALIAS[d.id] ?? d.id}`,
  };
}

/** Which dungeons this run has already walked into (keyed on the run's state, so a new game or a load starts afresh). */
const seenByRun = new WeakMap<object, Set<string>>();

/**
 * The dungeon-entry hook: the cutscene for `d`, once per run. Waits for it; safe to call from create().
 * Resolves false if the scene shut down (or restarted) meanwhile: the caller's room is gone, so it should stop.
 * Time spent watching it is given back to a dungeon-wide countdown.
 */
export async function dungeonIntro(sc: Phaser.Scene, d: DungeonDef): Promise<boolean> {
  if (!G.hasRun()) return true;
  let seen = seenByRun.get(G.s);
  if (!seen) seenByRun.set(G.s, (seen = new Set()));
  if (seen.has(d.id)) return true;
  seen.add(d.id);
  let gone = false;
  const off = () => (gone = true);
  sc.events.once("shutdown", off);
  await playDungeonIntro(sc, dungeonIntroOpts(d));
  sc.events.off("shutdown", off);
  return !gone;
}

/** Play the cutscene over `sc` (paused underneath, so no input reaches the game) and wait for it. */
export async function playDungeonIntro(sc: Phaser.Scene, o: DungeonIntroOpts): Promise<void> {
  // called from create(): the scene isn't running yet, and runOverlay needs it to be
  for (let i = 0; i < 60 && sc.sys && !sc.sys.isActive() && !sc.sys.isPaused(); i++) await new Promise((r) => window.setTimeout(r, 20));
  const t0 = Date.now();
  const player = (G.hasRun() ? G.s.player : "FLENKY") as string;
  await runOverlay(sc, "DungeonIntro", DungeonIntroScene, { ...o, player });
  if (G.rt.timerEnd) G.rt.timerEnd += Date.now() - t0;
}

interface IntroData extends DungeonIntroOpts {
  player: string;
  done: () => void;
}

const W = 960;
const H = 540;
const shade = (c: number, k: number) => {
  const f = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k)));
  return (f(16) << 16) | (f(8) << 8) | f(0);
};
const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** A ragged ink-brush stroke: a band from (x0,y0) to (x1,y1), `w` thick, with torn edges. */
function brush(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, w: number, col: number, alpha = 1, seed = 1) {
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
  const n = 22;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const top: Phaser.Math.Vector2[] = [];
  const bot: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // thick in the middle, tapering to dry-brush tips
    const taper = Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) * 0.7 + 0.3;
    const hw = (w / 2) * taper;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    top.push(new Phaser.Math.Vector2(cx + nx * (hw + rnd.between(-8, 8)), cy + ny * (hw + rnd.between(-8, 8))));
    bot.push(new Phaser.Math.Vector2(cx - nx * (hw + rnd.between(-8, 8)), cy - ny * (hw + rnd.between(-8, 8))));
  }
  g.fillStyle(col, alpha).fillPoints([...top, ...bot.reverse()], true);
  // a few dry streaks off the tail
  for (let i = 0; i < 6; i++) {
    const off = rnd.between(-w / 2, w / 2);
    const t = rnd.realInRange(0.55, 0.95);
    g.lineStyle(rnd.between(2, 5), col, alpha * 0.8).lineBetween(x0 + dx * t + nx * off, y0 + dy * t + ny * off, x1 + dx * 0.08 + nx * off, y1 + dy * 0.08 + ny * off);
  }
}

export class DungeonIntroScene extends Phaser.Scene {
  private d!: IntroData;
  private ending = false;
  private offSkip: (() => void) | null = null;

  constructor() {
    super("DungeonIntro");
  }

  init(d: IntroData) {
    this.d = d;
    this.ending = false;
  }

  create() {
    const d = this.d;
    const calm = !!G.meta?.settings?.calmFlash;
    const shakeOn = G.meta?.settings?.shake !== false;
    // on the scene's own clock (so it all stops with the scene, and tests can slow it down)
    const later = (ms: number, fn: () => void) => this.time.delayedCall(ms, () => !this.ending && fn());
    const every = (ms: number, fn: () => void) => this.time.addEvent({ delay: ms, loop: true, callback: () => !this.ending && fn() });
    this.events.once("shutdown", () => this.offSkip?.());
    const shake = (ms: number, k: number) => shakeOn && this.cameras.main.shake(ms, calm ? k * 0.4 : k);
    // a glow, not a strobe, with calmFlash on
    const flash = (a: number, col = 0xffffff) => {
      const r = this.add.rectangle(W / 2, H / 2, W, H, col, calm ? a * 0.2 : a).setDepth(90);
      this.tweens.add({ targets: r, alpha: 0, duration: calm ? 500 : 220, onComplete: () => r.destroy() });
    };

    // ---------------------------------------------------------------- shot 1: the entrance, low angle
    const shot = this.add.container(0, 0);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(-10);
    const bgImg = d.bg && this.textures.exists(d.bg) ? this.add.image(W / 2, H / 2, d.bg) : null;
    const doorX = W / 2;
    let doorY = H * 0.5;
    const doors: Phaser.GameObjects.GameObject[] = [];
    if (bgImg) {
      const src = this.textures.get(d.bg!).getSourceImage();
      bgImg.setScale(Math.max(W / src.width, H / src.height) * 1.12);
      shot.add(bgImg);
      // night grade and a vignette so the lad reads against it
      const grade = this.add.graphics();
      grade.fillGradientStyle(shade(d.color, 0.25), shade(d.color, 0.25), 0x000000, 0x000000, 0.35, 0.35, 0.75, 0.75).fillRect(0, 0, W, H);
      shot.add(grade);
    } else {
      // procedural: a sky in the dungeon's colour, a looming wall and a big double door
      const g = this.add.graphics();
      g.fillGradientStyle(shade(d.color, 0.35), shade(d.color, 0.35), 0x07040c, 0x07040c, 1).fillRect(0, 0, W, H);
      g.fillStyle(0x16121e).fillRect(170, 40, 620, 500);
      for (let y = 60; y < 540; y += 34) for (let x = 170 + ((y / 34) % 2) * 30; x < 790; x += 60) g.lineStyle(2, 0x0b0910).strokeRect(x, y, 60, 34);
      g.fillStyle(0x050307).fillRoundedRect(330, 120, 300, 440, { tl: 150, tr: 150, bl: 0, br: 0 });
      shot.add(g);
      const glow = this.add.graphics();
      glow.fillStyle(d.color, 0.35).fillRoundedRect(340, 132, 280, 420, { tl: 140, tr: 140, bl: 0, br: 0 });
      shot.add(glow);
      for (const side of [-1, 1]) {
        const p = this.add.graphics();
        p.fillStyle(0x3b2a1a).fillRect(side < 0 ? -140 : 0, -210, 140, 420);
        for (let i = 0; i < 4; i++) p.lineStyle(3, 0x24180e).lineBetween(side < 0 ? -140 + i * 35 : i * 35, -210, side < 0 ? -140 + i * 35 : i * 35, 210);
        p.fillStyle(0x6b7280).fillRect(side < 0 ? -140 : 0, -120, 140, 12).fillRect(side < 0 ? -140 : 0, 100, 140, 12);
        p.setPosition(480, 345);
        shot.add(p);
        doors.push(p);
      }
      doorY = 340;
    }
    // anime focus lines converging on the door
    const focus = this.add.graphics();
    shot.add(focus);
    const drawFocus = () => {
      focus.clear();
      const n = calm ? 22 : 54;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 170 + Math.random() * 120;
        const spread = 0.003 + Math.random() * 0.009;
        const R = 900;
        focus.fillStyle(0xffffff, (calm ? 0.08 : 0.12) + Math.random() * 0.2);
        focus.fillTriangle(doorX + Math.cos(a) * r0, doorY + Math.sin(a) * r0, doorX + Math.cos(a - spread) * R, doorY + Math.sin(a - spread) * R, doorX + Math.cos(a + spread) * R, doorY + Math.sin(a + spread) * R);
      }
    };
    drawFocus();
    every(calm ? 400 : 70, drawFocus);

    // the lad from behind, huge and low (a low-angle shot: his feet are off the bottom of the screen)
    const sprKey = `spr_${d.player}`;
    const meta = charMeta(this, sprKey);
    const hasSpr = this.textures.exists(sprKey);
    let shotDone = false;
    const back = hasSpr ? this.add.sprite(W / 2 - 190, H + 150, sprKey, meta?.idle.north ?? 0) : null;
    if (back) {
      const sc = 560 / back.frame.realHeight / hdFactor(back);
      back.setOrigin(0.5, 1).setScale(sc);
      const echo = this.add.sprite(back.x + 18, back.y, sprKey, back.frame.name).setOrigin(0.5, 1).setScale(sc).setTintFill(shade(d.color, 0.3)).setAlpha(0.7);
      shot.add([echo, back]);
      const walk = meta?.walk.north ?? [1, 2];
      let i = 0;
      every(95, () => {
        if (!back.active || shotDone) return;
        i = (i + 1) % walk.length;
        back.setFrame(walk[i]);
        echo.setFrame(walk[i]);
      });
      // striding in: up the screen, the camera rising with him
      this.tweens.add({ targets: [back, echo], y: H + 70, duration: 900, ease: "Sine.out" });
      this.tweens.add({ targets: [back, echo], x: "+=24", yoyo: true, repeat: 3, duration: 110, ease: "Sine.inOut" });
    }
    // the push-in on the entrance
    this.cameras.main.setZoom(1);
    this.tweens.add({ targets: this.cameras.main, zoom: 1.08, duration: 900, ease: "Sine.in" });
    let steps = 0;
    const stepSfx = () => steps++ < 3 && synth.play("step_echo", 0.8);
    stepSfx();
    later(300, stepSfx);
    later(600, stepSfx);

    // ---------------------------------------------------------------- shot 2: whip-pan, the kick
    const kick = this.add.container(0, 0).setVisible(false);
    const kickBg = this.add.graphics();
    kickBg.fillGradientStyle(shade(d.color, 0.55), shade(d.color, 0.15), shade(d.color, 0.55), shade(d.color, 0.15), 1).fillRect(0, 0, W, H);
    const speed = this.add.graphics();
    kick.add([kickBg, speed]);
    const drawSpeed = () => {
      speed.clear();
      for (let i = 0; i < (calm ? 12 : 34); i++) {
        const y = Math.random() * H;
        const x = Math.random() * W;
        speed.lineStyle(1 + Math.random() * 4, 0xffffff, (calm ? 0.1 : 0.18) + Math.random() * 0.3).lineBetween(x, y, x - 120 - Math.random() * 300, y);
      }
    };
    drawSpeed();
    // the entrance, side on, on the right: a wall, a doorway leaking the dungeon's light, and the door in it
    const wall = this.add.graphics();
    wall.fillStyle(shade(d.color, 0.12)).fillRect(780, 0, W - 780, H);
    for (let y = 0; y < H; y += 36) for (let x = 780 + ((y / 36) % 2) * 26; x < W; x += 52) wall.lineStyle(2, 0x000000, 0.5).strokeRect(x, y, 52, 36);
    wall.fillStyle(0x000000, 0.9).fillRect(772, 60, 22, 420);
    const leak = this.add.graphics();
    const drawLeak = (a: number, reach: number) => {
      leak.clear();
      for (let i = 0; i < 5; i++) leak.fillStyle(d.color, a).fillTriangle(790, 70 + i * 6, 790, 470 - i * 6, 790 - reach * (1 - i * 0.15), H / 2);
    };
    drawLeak(0.12, 270);
    const sideDoor = this.add.rectangle(770, 270, 46, 410, 0x4a3420).setStrokeStyle(6, 0x120a04);
    const plank = this.add.graphics();
    plank.fillStyle(0x2a1c10).fillRect(-23, -120, 46, 14).fillRect(-23, 100, 46, 14);
    plank.setPosition(770, 270);
    kick.add([leak, wall, sideDoor, plank]);
    const kicker = hasSpr ? this.add.sprite(400, H + 40, sprKey, meta?.idle.east ?? 0).setOrigin(0.5, 1) : null;
    let kickFrames: number[] = [];
    if (kicker) {
      kicker.setScale(520 / kicker.frame.realHeight / hdFactor(kicker));
      kickFrames = meta?.attack?.east ?? meta?.walk.east ?? [];
      const ghost = this.add.sprite(kicker.x - 40, kicker.y, sprKey, kicker.frame.name).setOrigin(0.5, 1).setScale(kicker.scaleX).setTintFill(0xffffff).setAlpha(0.25);
      kick.add([ghost, kicker]);
      this.events.on("update", () => ghost.active && kicker.active && ghost.setFrame(kicker.frame.name));
    }

    later(880, () => {
      // whip-pan: the entrance shot smears off left, the side-on shot smears in from the right
      synth.play("swing", 0.9);
      shotDone = true;
      this.tweens.add({ targets: shot, x: -W, duration: 140, ease: "Quad.in" });
      kick.setVisible(true).setX(W);
      this.tweens.add({ targets: kick, x: 0, duration: 150, ease: "Quad.out" });
      this.cameras.main.setZoom(1);
      every(calm ? 400 : 60, drawSpeed);
    });
    later(1060, () => {
      if (!kicker) return;
      let i = 0;
      const step = () => {
        if (i < kickFrames.length) kicker.setFrame(kickFrames[i++]);
      };
      step();
      every(55, step);
      this.tweens.add({ targets: kicker, x: 660, duration: 140, ease: "Cubic.out" });
    });
    later(1200, () => {
      // IMPACT: the door bursts off its hinges
      synth.play("smash");
      synth.play("boom", 0.7);
      synth.play("punch_big", 0.8);
      shake(260, 0.02);
      // the anime impact frame: a beat of black-on-white silhouette (a soft glow instead with calmFlash on)
      if (!calm && kicker) {
        const white = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setDepth(70);
        const sil = this.add.sprite(kicker.x, kicker.y, sprKey, kicker.frame.name).setOrigin(0.5, 1).setScale(kicker.scaleX).setTintFill(0x000000).setDepth(71);
        later(80, () => {
          white.destroy();
          sil.destroy();
        });
      } else flash(0.7);
      this.tweens.add({ targets: [sideDoor, plank], x: 1250, angle: 75, duration: 380, ease: "Quad.out" });
      drawLeak(0.28, 760);
      const burst = this.add.graphics();
      kick.add(burst);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        burst.fillStyle(i % 2 ? 0xffffff : d.color, 0.8).fillTriangle(720, H / 2, 720 + Math.cos(a - 0.08) * 700, H / 2 + Math.sin(a - 0.08) * 700, 720 + Math.cos(a + 0.08) * 700, H / 2 + Math.sin(a + 0.08) * 700);
      }
      burst.setAlpha(calm ? 0.25 : 0.6);
      this.tweens.add({ targets: burst, alpha: 0, duration: calm ? 500 : 300 });
      // splinters
      for (let i = 0; i < 14; i++) {
        const s = this.add.rectangle(740, H / 2 + Phaser.Math.Between(-150, 150), Phaser.Math.Between(10, 40), Phaser.Math.Between(4, 10), 0x5b4128).setAngle(Phaser.Math.Between(0, 180));
        kick.add(s);
        this.tweens.add({ targets: s, x: s.x + Phaser.Math.Between(120, 420), y: s.y + Phaser.Math.Between(-200, 200), angle: s.angle + Phaser.Math.Between(-400, 400), alpha: 0, duration: 600, ease: "Quad.out" });
      }
      // the procedural door's panels fly in shot 1 too (it isn't shown again, but keep them tidy)
      doors.forEach((p) => p.destroy());
    });

    // ---------------------------------------------------------------- the ink-slash wipe
    const ink = this.add.graphics().setDepth(80);
    brush(ink, -200, H + 120, W + 200, -120, 1100, 0x050308, 1, 7);
    ink.setPosition(-W * 1.7, 0);
    later(1420, () => {
      synth.play("swing2", 0.9);
      this.tweens.add({
        targets: ink,
        x: 0,
        duration: 230,
        ease: "Quad.in",
        onComplete: () => {
          // under the ink: swap to the title card
          shot.setVisible(false);
          kick.setVisible(false);
          card.setVisible(true);
          this.tweens.add({ targets: ink, x: W * 1.8, duration: 260, ease: "Quad.out", delay: 40 });
        },
      });
    });

    // ---------------------------------------------------------------- the title card
    const card = this.add.container(0, 0).setVisible(false);
    const cardBg = this.add.graphics();
    cardBg.fillGradientStyle(0x07040c, shade(d.color, 0.3), 0x07040c, shade(d.color, 0.18), 1).fillRect(0, 0, W, H);
    const cardLines = this.add.graphics();
    const drawCardLines = () => {
      cardLines.clear();
      for (let i = 0; i < (calm ? 10 : 26); i++) {
        const y = Math.random() * H;
        const x = Math.random() * W;
        cardLines.lineStyle(1 + Math.random() * 3, d.color, 0.15 + Math.random() * 0.25).lineBetween(x, y, x + 150 + Math.random() * 300, y - 30);
      }
    };
    drawCardLines();
    card.add([cardBg, cardLines]);
    // your lad's portrait, a dark echo on the right edge
    const vsKey = `vs_${d.player}`;
    if (this.textures.exists(vsKey)) {
      const p = this.add.image(W - 150, H + 20, vsKey, 0).setOrigin(0.5, 1);
      p.setScale(Math.max(2, Math.round(440 / p.frame.realHeight)) / hdFactor(p)).setFlipX(true);
      const echo = this.add.image(p.x + 26, p.y, vsKey, 0).setOrigin(0.5, 1).setScale(p.scaleX).setFlipX(true).setTintFill(shade(d.color, 0.35)).setAlpha(0.85);
      p.setAlpha(0.9);
      card.add([echo, p]);
      this.tweens.add({ targets: [p, echo], x: "-=24", duration: 1800, ease: "Sine.out" });
    }
    // the brush stroke the name sits on
    const stroke = this.add.graphics();
    brush(stroke, 20, H / 2 + 40, W - 60, H / 2 - 10, 170, d.color, 0.95, 3);
    brush(stroke, 60, H / 2 + 70, W - 120, H / 2 + 30, 60, shade(d.color, 0.5), 0.9, 11);
    stroke.setScale(0, 1);
    card.add(stroke);
    const nameStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Impact, 'Arial Black', sans-serif",
      fontSize: "92px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 12,
      align: "center",
      shadow: { offsetX: 7, offsetY: 7, color: "#000000", blur: 0, fill: true, stroke: true },
      wordWrap: { width: 1500 },
    };
    // long names go on two lines
    const words = d.name.split(" ");
    const nameStr = d.name.length > 18 && words.length > 1 ? (() => {
      let best = 1;
      let bestDiff = Infinity;
      for (let i = 1; i < words.length; i++) {
        const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
        if (diff < bestDiff) (bestDiff = diff), (best = i);
      }
      return `${words.slice(0, best).join(" ")}\n${words.slice(best).join(" ")}`;
    })() : d.name;
    const name = this.add.text(W / 2 - 30, H / 2 + 14, nameStr, nameStyle).setOrigin(0.5).setAngle(-3).setAlpha(0);
    const rest = Math.min(1, 820 / name.width, 260 / name.height);
    const tag = this.add.text(70, H / 2 - 150, d.tag ?? "", { fontFamily: PIXEL_BOLD, fontSize: "22px", color: css(d.color), stroke: "#000000", strokeThickness: 6 }).setAngle(-3).setAlpha(0);
    const sub = d.subtitle
      ? this.add.text(W / 2 - 30, H / 2 + 14 + (name.height * rest) / 2 + 30, `— ${d.subtitle} —`, { fontFamily: "Impact, 'Arial Black', sans-serif", fontSize: "28px", color: "#ffffff", stroke: "#000000", strokeThickness: 7 }).setOrigin(0.5).setAngle(-3).setAlpha(0)
      : null;
    if (sub && sub.width > 860) sub.setScale(860 / sub.width);
    card.add([tag, name]);
    if (sub) card.add(sub);

    later(1700, () => {
      every(calm ? 400 : 70, drawCardLines);
      this.tweens.add({ targets: stroke, scaleX: 1, duration: 170, ease: "Cubic.out" });
      synth.play("swing3", 0.7);
    });
    later(1820, () => {
      name.setScale(rest * 2.8);
      this.tweens.add({
        targets: name,
        scale: rest,
        alpha: 1,
        duration: 150,
        ease: "Quad.in",
        onComplete: () => {
          synth.play("vs_crash");
          synth.play("boom", 0.6);
          shake(340, 0.018);
          flash(0.45, d.color);
          // a slow throb while it holds
          this.tweens.add({ targets: name, scale: rest * 1.04, yoyo: true, repeat: -1, duration: calm ? 700 : 320, ease: "Sine.inOut" });
        },
      });
    });
    later(2100, () => {
      tag.x -= 50;
      this.tweens.add({ targets: tag, x: tag.x + 50, alpha: 1, duration: 200, ease: "Cubic.out" });
      if (sub) {
        sub.y += 24;
        this.tweens.add({ targets: sub, y: sub.y - 24, alpha: 1, duration: 220, ease: "Cubic.out" });
        synth.play("smash", 0.4);
      }
    });
    later(3250, () => this.finish());
    // skippable (after a beat, so the key that walked you in doesn't skip it)
    this.offSkip = onSkip(this, 300, () => this.finish());
  }

  /** Cut to gameplay. */
  private finish() {
    if (this.ending) return;
    this.ending = true;
    this.offSkip?.();
    this.offSkip = null;
    this.tweens.add({ targets: this.children.list.slice(), alpha: 0, duration: 220, ease: "Quad.in" });
    this.time.delayedCall(230, () => this.d.done());
  }
}

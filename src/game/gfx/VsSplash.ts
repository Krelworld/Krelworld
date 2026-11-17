import Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { CHARACTERS } from "../../data/characters";
import { BOSS_TEXT } from "../../content/bosses";
import { hdFactor } from "./HD";
import { onSkip, runOverlay } from "./Overlay";

/**
 * The fighting-game VS card before a boss fight: the screen split on a diagonal, your lad's animated portrait on
 * the left squaring up to the boss's on the right, the names slam in with an epithet each, a crash, and away
 * (about 2.5s; any key, click or pad button skips it). Portraits are drawn sheets, `vs_<LADID>` and
 * `vs_<bossId>` (frames of an idle loop); a boss without one falls back to its battle sprite.
 * Respects calmFlash (no white-outs, slow steady lines) and the shake setting.
 */

/** Your lad's fighting-game epithet. */
const LAD_EPITHET: Record<string, string> = {
  FLENKY: "THE BANISHER",
  KREZMAR: "THE KREZ LOAN SHARK",
  KREBLIS: "BREAKING NEWS",
  KREZWONK: "THE TERRIBLE PROPHET",
  SCROMBUS: "THE WONKER ENGINEER",
  KREBON: "THE COUNT OF KREZ KRISTO",
  CRONGUS: "THE LULON LURKER",
  GRONNY: "ALWAYS HITS A 99",
  MIKEY: "FEELIN RUSSHEN 2DAY",
};

/** A boss's short epithet (their BOSS_TEXT title is the long version: its first part is used if not here). */
const BOSS_EPITHET: Record<string, string> = {
  krandall: "HEADMASTER · KRAZY, ZANY",
  hoard: "REMOVED, NOT GONE",
  cronster: "SWEET HUGS, SWEETER SQUEEZES",
  drongus1: "SUPREME LEADER",
  drongus2: "EXTREMELY RED",
  dark_drongus: "ON THE JUICE",
  krozno: "THIRTY YEARS, NEVER HIJACKED",
  brand: "VERBOSE GRAPPLER",
  troll: "TWELVE-BAR MENACE",
  pudding_demon: "THE REAL ONE (EVIL)",
  flatmate: "DEPOSIT THIEF",
  rival: "NEVER RE-RACKS HIS WEIGHTS",
  jam: "ABSOLUTELY LIVID",
  rik: "SEVEN HUNDRED POUNDS",
  flirt: "FLIRTS WITH THE WALLS",
  lantern: "REAL NAME GARY",
  fruity: "THE ONE WITH A FANBASE",
  tank: "HAS NEVER BEEN TO AMERICA",
  reinhardt: "CEO · SON · PRIME SUSPECT",
  krex: "BIPEDAL NUCLEAR WALKING TANK",
  elon: "NOT THE REAL ONE",
  concept: "THE FINAL BOSS OF KRELFORD",
};

/** Boss colours for their half of the card (falls back to red). */
const BOSS_COLOR: Record<string, number> = {
  krandall: 0xfacc15, hoard: 0x84cc16, cronster: 0xf472b6, drongus1: 0xef4444, drongus2: 0xff2a2a, dark_drongus: 0xffd23f,
  krozno: 0x38bdf8, brand: 0xe5e7eb, troll: 0x7d8f6a, pudding_demon: 0x9333ea, flatmate: 0x9ca3af, rival: 0xd97706,
  jam: 0xdc2626, rik: 0x65a30d, flirt: 0xf472b6, lantern: 0xdc2626, fruity: 0xec4899, tank: 0x4d7c0f, reinhardt: 0x6b7280,
  krex: 0xa855f7, elon: 0x22d3ee, concept: 0x7c3aed,
};

export interface VsOpts {
  bossId: string;
  /** shown name (defaults to BOSS_TEXT) */
  name?: string;
  /** shown epithet */
  epithet?: string;
  /** fallback art when there's no vs_<bossId> sheet: a texture and frame (e.g. the boss's own sprite) */
  art?: { key: string; frame?: string | number };
  color?: number;
  /** a gang (the hero passengers): their battle sprites side by side on the boss's half, instead of one portrait */
  group?: { key: string; frame?: string | number }[];
}

/** Has this boss had its card this run already? (A retry after a death doesn't make you sit through it again.) */
const seen = new Set<string>();
/** Has this boss's card been shown this session? */
export const vsSeen = (bossId: string) => seen.has(bossId);

/** Show the VS card over `sc` and wait for it. */
export function vsSplash(sc: Phaser.Scene, o: VsOpts): Promise<void> {
  const player = (G.hasRun() ? G.s.player : "FLENKY") as string;
  const t = BOSS_TEXT[o.bossId];
  const def = CHARACTERS[player];
  const quick = seen.has(o.bossId);
  seen.add(o.bossId);
  return runOverlay(sc, "VsSplash", VsSplashScene, {
    player,
    ladName: player === "MIKEY" ? "KREBLAR" : def?.name ?? player,
    ladEpithet: LAD_EPITHET[player] ?? def?.nickname ?? "",
    ladColor: def?.color ?? 0x3b6cff,
    bossId: o.bossId,
    bossName: o.name ?? t?.name ?? o.bossId.toUpperCase(),
    bossEpithet: o.epithet ?? BOSS_EPITHET[o.bossId] ?? (t?.title ?? "").split("·")[0].trim().toUpperCase(),
    bossColor: o.color ?? BOSS_COLOR[o.bossId] ?? 0xdc2626,
    art: o.art,
    group: o.group,
    quick,
  });
}

interface VsData {
  player: string;
  ladName: string;
  ladEpithet: string;
  ladColor: number;
  bossId: string;
  bossName: string;
  bossEpithet: string;
  bossColor: number;
  art?: { key: string; frame?: string | number };
  group?: { key: string; frame?: string | number }[];
  quick: boolean;
  done: () => void;
}

const W = 960;
const H = 540;
/** The split: a diagonal from (TOP_X, 0) to (BOT_X, H). */
const TOP_X = 560;
const BOT_X = 400;
const splitX = (y: number) => TOP_X + (BOT_X - TOP_X) * (y / H);
const dark = (c: number, k: number) => {
  const r = ((c >> 16) & 255) * k;
  const g = ((c >> 8) & 255) * k;
  const b = (c & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};

export class VsSplashScene extends Phaser.Scene {
  private d!: VsData;
  private ending = false;
  private offSkip: (() => void) | null = null;
  private timers: number[] = [];

  constructor() {
    super("VsSplash");
  }

  init(d: VsData) {
    this.d = d;
    this.ending = false;
    this.timers = [];
  }

  create() {
    const d = this.d;
    const calm = !!G.meta?.settings?.calmFlash;
    const shakeOn = G.meta?.settings?.shake !== false;
    const later = (ms: number, fn: () => void) => this.timers.push(window.setTimeout(() => this.sys.isActive() && !this.ending && fn(), ms));
    this.events.once("shutdown", () => {
      this.timers.forEach((t) => window.clearTimeout(t));
      this.offSkip?.();
    });

    // the two halves, each with its own colour, speed lines and portrait, clipped to its side of the diagonal
    const leftPoly = [0, 0, TOP_X, 0, BOT_X, H, 0, H];
    const rightPoly = [TOP_X, 0, W, 0, W, H, BOT_X, H];
    const half = (poly: number[], col: number, side: -1 | 1) => {
      const c = this.add.container(side * W, 0);
      const mg = this.make.graphics({}, false);
      mg.fillStyle(0xffffff).fillPoints(new Phaser.Geom.Polygon(poly).points, true);
      const mask = mg.createGeometryMask();
      const bg = this.add.graphics();
      bg.fillGradientStyle(dark(col, 0.55), dark(col, 0.55), dark(col, 0.12), dark(col, 0.12), 1).fillRect(0, 0, W, H);
      const lines = this.add.graphics();
      c.add([bg, lines]);
      c.setMask(mask);
      // the mask's graphics follow the container's slide
      const follow = () => mg.setPosition(c.x, c.y);
      this.events.on("update", follow);
      return { c, lines, col, side, mg };
    };
    const L = half(leftPoly, d.ladColor, -1);
    const R = half(rightPoly, d.bossColor, 1);
    // speed lines streaming away from the split (steady and slow with calmFlash on)
    const drawLines = () => {
      for (const h of [L, R]) {
        h.lines.clear();
        for (let i = 0; i < (calm ? 10 : 26); i++) {
          const y = Math.random() * H;
          const len = 80 + Math.random() * 260;
          const x0 = h.side < 0 ? Math.random() * splitX(y) : splitX(y) + Math.random() * (W - splitX(y));
          h.lines.lineStyle(1 + Math.random() * 3, 0xffffff, (calm ? 0.08 : 0.12) + Math.random() * 0.18).lineBetween(x0, y, x0 - h.side * len, y);
        }
      }
    };
    drawLines();
    const lineTimer = window.setInterval(drawLines, calm ? 400 : 60);
    this.events.once("shutdown", () => window.clearInterval(lineTimer));

    // the portraits
    const portrait = (h: typeof L, key: string, fallback: { key: string; frame?: string | number } | undefined, faceRight: boolean) => {
      let k = this.textures.exists(key) ? key : fallback && this.textures.exists(fallback.key) ? fallback.key : null;
      if (!k) return null;
      const drawn = k === key;
      const img = this.add.image(0, 0, k, drawn ? 0 : fallback?.frame ?? 0);
      const fr = img.frame;
      // fill most of the height (pixel-crisp: whole-number scale for the drawn ones)
      const target = drawn ? 470 : 420;
      let sc = target / fr.realHeight;
      if (drawn) sc = Math.max(2, Math.round(sc));
      img.setScale(sc / hdFactor(img));
      img.setOrigin(0.5, 1);
      // a drawn portrait faces right for the lad and left for the boss; a battle sprite just faces the middle
      if (!drawn && !faceRight) img.setFlipX(false);
      if (drawn) img.setFlipX(false);
      const cx = h.side < 0 ? 250 : 720;
      img.setPosition(cx, H + 10);
      // a dark silhouette echo behind, offset (the anime "afterimage")
      const echo = this.add.image(cx - h.side * -26, H + 10, k, img.frame.name).setOrigin(0.5, 1).setScale(img.scaleX / hdFactor(img), img.scaleY / hdFactor(img)).setFlipX(img.flipX).setTintFill(dark(h.col, 0.25)).setAlpha(0.8);
      h.c.add([echo, img]);
      // its idle loop (ping-pong)
      const n = drawn ? this.textures.get(k).frameTotal - 1 : 1;
      if (n > 1) {
        const seq = [...Array(n).keys(), ...[...Array(n).keys()].reverse().slice(1, -1)];
        let i = 0;
        const id = window.setInterval(() => {
          if (!img.active) return window.clearInterval(id);
          i = (i + 1) % seq.length;
          img.setFrame(seq[i]);
          echo.setFrame(seq[i]);
        }, 120);
        this.events.once("shutdown", () => window.clearInterval(id));
      }
      // a slow push in while it holds
      this.tweens.add({ targets: [img, echo], x: `+=${-h.side * 18}`, duration: 2600, ease: "Sine.out" });
      return img;
    };
    portrait(L, `vs_${d.player}`, { key: `spr_${d.player}`, frame: 0 }, true);
    if (d.group?.length) {
      // a gang: all of them in a staggered row, the middle one in front
      const n = d.group.length;
      const order = [...d.group.keys()].sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));
      for (const i of order) {
        const g = d.group[i];
        if (!this.textures.exists(g.key)) continue;
        const img = this.add.image(0, 0, g.key, g.frame ?? 0).setOrigin(0.5, 1).setFlipX(true);
        const back = Math.abs(i - (n - 1) / 2);
        const sc = (330 - back * 50) / img.frame.realHeight;
        img.setScale(sc / hdFactor(img));
        const cx = 720 + (i - (n - 1) / 2) * 150;
        img.setPosition(cx, H + 10 - back * 30);
        const echo = this.add.image(cx + 22, img.y, g.key, g.frame ?? 0).setOrigin(0.5, 1).setScale(img.scaleX / hdFactor(img), img.scaleY / hdFactor(img)).setFlipX(true).setTintFill(dark(R.col, 0.25)).setAlpha(0.8);
        if (back) img.setTint(0xc8c8d0);
        R.c.add([echo, img]);
        this.tweens.add({ targets: [img, echo], x: `-=${18 - back * 6}`, duration: 2600, ease: "Sine.out" });
      }
    } else portrait(R, `vs_${d.bossId}`, d.art, false);

    // the halves slam in from either side
    const q = d.quick ? 0.6 : 1;
    this.tweens.add({ targets: L.c, x: 0, duration: 230 * q, ease: "Cubic.out" });
    this.tweens.add({ targets: R.c, x: 0, duration: 230 * q, ease: "Cubic.out", delay: 70 * q });
    synth.play("swing");

    // the split: a white-hot slash down the diagonal
    const slash = this.add.graphics().setAlpha(0);
    const drawSlash = (w: number) => {
      slash.clear();
      slash.lineStyle(w + 10, 0x000000, 0.9).lineBetween(TOP_X, -10, BOT_X, H + 10);
      slash.lineStyle(w, 0xffffff, 1).lineBetween(TOP_X, -10, BOT_X, H + 10);
    };
    drawSlash(8);

    // the names (bottom corners) and epithets
    const nameStyle = (col: number): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: "Impact, sans-serif", fontSize: "50px", color: "#ffffff", stroke: "#000000", strokeThickness: 9, shadow: { offsetX: 0, offsetY: 0, color: Phaser.Display.Color.IntegerToColor(col).rgba, blur: 18, fill: true, stroke: true } });
    const epiStyle = (col: number): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: "Impact, sans-serif", fontSize: "24px", color: Phaser.Display.Color.IntegerToColor(col).rgba, stroke: "#000000", strokeThickness: 6 });
    const fit = (t: Phaser.GameObjects.Text, max: number) => {
      if (t.width > max) t.setScale(max / t.width);
      return t.scaleX;
    };
    const ln = this.add.text(30, 418, d.ladName, nameStyle(d.ladColor)).setOrigin(0, 0.5).setAngle(-4).setAlpha(0);
    const le = this.add.text(36, 462, d.ladEpithet, epiStyle(0xffffff)).setOrigin(0, 0.5).setAngle(-4).setAlpha(0);
    const bn = this.add.text(W - 30, 120, d.bossName, nameStyle(d.bossColor)).setOrigin(1, 0.5).setAngle(-4).setAlpha(0);
    const be = this.add.text(W - 36, 164, d.bossEpithet, epiStyle(0xffffff)).setOrigin(1, 0.5).setAngle(-4).setAlpha(0);
    const restL = fit(ln, 420);
    fit(le, 420);
    const restB = fit(bn, 520);
    fit(be, 520);
    const vs = this.add.text(W / 2 - 4, H / 2 + 30, "VS", { fontFamily: "Impact, sans-serif", fontSize: "120px", color: "#ffd23f", stroke: "#000000", strokeThickness: 14, shadow: { offsetX: 6, offsetY: 6, color: "#7f1d1d", blur: 0, fill: true, stroke: true } }).setOrigin(0.5).setAngle(-8).setAlpha(0);

    const flash = (a: number) => {
      const r = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, calm ? a * 0.2 : a);
      this.tweens.add({ targets: r, alpha: 0, duration: calm ? 420 : 200, onComplete: () => r.destroy() });
    };
    const shake = (ms: number, k: number) => shakeOn && this.cameras.main.shake(ms, calm ? k * 0.5 : k);
    const slam = (t: Phaser.GameObjects.Text, rest: number, ms = 150) => {
      t.setScale(rest * 2.6).setAlpha(0);
      this.tweens.add({ targets: t, scale: rest, alpha: 1, duration: ms, ease: "Quad.in" });
    };

    later(220 * q, () => {
      slash.setAlpha(1);
      const sw = { w: 30 };
      this.tweens.add({ targets: sw, w: 8, duration: 260, onUpdate: () => drawSlash(sw.w) });
      flash(0.5);
    });
    later(380 * q, () => {
      slam(vs, 1, 170);
      later(170, () => {
        synth.play("vs_crash");
        synth.play("boom", 0.5);
        shake(320, 0.018);
        flash(0.65);
        // the VS throbs while it holds
        this.tweens.add({ targets: vs, scale: 1.08, yoyo: true, repeat: -1, duration: calm ? 600 : 260, ease: "Sine.inOut" });
      });
    });
    later(620 * q, () => {
      slam(ln, restL);
      later(150, () => {
        synth.play("smash", 0.5);
        shake(140, 0.008);
      });
    });
    later(820 * q, () => {
      slam(bn, restB);
      later(150, () => {
        synth.play("smash", 0.6);
        shake(160, 0.01);
      });
    });
    later(1000 * q, () => {
      for (const [t, dx] of [[le, -40], [be, 40]] as const) {
        t.x += dx;
        this.tweens.add({ targets: t, x: t.x - dx, alpha: 1, duration: 220, ease: "Cubic.out" });
      }
    });
    later(2450 * q, () => this.finish());
    // skippable (after a beat, so the key that started the fight doesn't skip it)
    this.offSkip = onSkip(this, 250, () => this.finish());
  }

  /** Away: the halves split apart and the fight starts. */
  private finish() {
    if (this.ending) return;
    this.ending = true;
    this.offSkip?.();
    this.offSkip = null;
    const all = this.children.list.slice();
    this.tweens.add({ targets: all, alpha: 0, duration: 200, ease: "Quad.in" });
    window.setTimeout(() => this.d.done(), 210);
  }
}

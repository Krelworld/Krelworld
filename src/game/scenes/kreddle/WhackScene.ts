import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { FONT, PIXEL_BOLD, button } from "../../ui/theme";
import { TOUCH } from "../../ui/TouchControls";
import { vfx } from "../../gfx/Vfx";
import { LADS } from "../../../data/characters";
import { addKrokens, krokens, WHACK_COST, WHACK_JACKPOT, WHACK_SECONDS, whackKrokens } from "../../systems/kreddle";

/**
 * WHACK-A-DRONGUS: the Krazy Kreddle Arcade's newest cabinet. Nine neon pipes; heads pop up; you twat them with a
 * giant rubber mallet. Drongus is the bread and butter, Lil' Crongus is quick, President Klerble takes two, the
 * lads turn up for a bonus, and you DON'T whack Mikey (he's only asking for a reaction). A Fizzy Bongo buys time,
 * and a golden Crobley opens the Great Tap: double points and a flood of heads.
 *
 * Launched over a paused Kreddle; 100 Krezzcoin a go; Krokens out, scaled to the score.
 * Keys: Q W E / A S D / Z X C (or the numpad, or 1-9) whack a pipe; arrows + SPACE work too. Mouse / touch: tap a pipe.
 */

type Kind = "drongus" | "lad" | "crongus" | "klerble" | "mikey" | "bongo" | "crobley";
interface KindDef {
  pts: number;
  /** how long it stays up, times the current base */
  up: number;
  hp: number;
  weight: number;
  scale: number;
  bad?: boolean;
  pickup?: boolean;
}
const KINDS: Record<Kind, KindDef> = {
  drongus: { pts: 10, up: 1, hp: 1, weight: 44, scale: 1.15 },
  lad: { pts: 15, up: 0.95, hp: 1, weight: 15, scale: 1.15 },
  crongus: { pts: 25, up: 0.6, hp: 1, weight: 11, scale: 1 },
  klerble: { pts: 40, up: 1.55, hp: 2, weight: 8, scale: 1.2 },
  mikey: { pts: -30, up: 1.15, hp: 1, weight: 13, scale: 1.15, bad: true },
  bongo: { pts: 5, up: 0.9, hp: 1, weight: 5, scale: 2.1, pickup: true },
  crobley: { pts: 50, up: 0.7, hp: 1, weight: 2.4, scale: 2.2, pickup: true },
};

/**
 * The faces in the pipes: the TV close-up sheets (128px, transparent, a frame per expression), so they pull faces
 * while they're up and look appropriately alarmed when the mallet lands. `talk` is the fallback portrait.
 */
interface Face {
  key: string;
  taunt: number[];
  hit: number;
  hitKey?: string;
  win?: number[];
  scale: number;
  talk: string;
}
const FACES: Record<string, Face> = {
  DRONGUS: { key: "tvface_DRONGUS", taunt: [26, 27, 28, 27], hit: 2, scale: 0.78, talk: "talk_DRONGUS" },
  CRONGUS: { key: "tvface_LIL_CRONGUS", taunt: [10, 11, 12, 11], hit: 2, scale: 0.7, talk: "talk_CRONGUS" },
  KREZMAR: { key: "tvface_KREZMAR", taunt: [0, 1, 0, 5], hit: 2, scale: 0.76, talk: "talk_KREZMAR" },
  SCROMBUS: { key: "tvface_SCROMBUS", taunt: [17, 18, 19, 18], hit: 6, scale: 0.76, talk: "talk_SCROMBUS" },
  KLERBLE: { key: "wk_klerble", taunt: [0, 1, 2, 1], hit: 3, win: [4, 5, 6, 7], scale: 0.84, talk: "talk_PRESIDENT_KLERBLE" },
  MIKEY: { key: "wk_mikey", taunt: [0], hit: 0, hitKey: "wk_mikey_hurt", scale: 0.74, talk: "talk_MIKEY" },
};
const KIND_FACE: Partial<Record<Kind, string>> = { drongus: "DRONGUS", crongus: "CRONGUS", klerble: "KLERBLE", mikey: "MIKEY" };

const BARKS: Record<string, string[]> = {
  drongus: ["Attention seeking!", "DRONGI DOWN!", "Not the song thing!", "I was bluffing!", "Fuck sake.", "Remove from group!", "Ow. Prolific ow.", "Wonk it 'til you krez!"],
  lad: ["OI!", "Lads?!", "Unbelievable.", "Crude krezz!", "Pls die.", "Fair play.", "Nibble on THAT!"],
  crongus: ["Salmon diet!", "Too quick for ya!", "Cron era forever!", "MUM!"],
  klerble: ["NO! NO! NOOO!", "I hate your universe!", "My glorious face!"],
  klerble1: ["Is that all? YES!", "You'll need more than that!", "Ha! HA!"],
  klerbleEscape: ["YES! YES! YESSS!", "The House wins!"],
  mikey: ["That's not fair lads", "I'm telling Drongus", "Mikey has left the group", "Can someone react to my message pls", "OW. Okay that one was fair"],
  bongo: ["+3s! FIZZY BONGOS!", "Glug glug glug!", "Portfolio development!"],
  crobley: ["THE GREAT TAP FLOWS!"],
};

const COLS = [300, 480, 660];
const ROWS = [168, 280, 392];
const PIPE_SCALE = 1.35;
/** Pipe art (66x80): the hole's middle and the line the heads tuck in behind, in source px. */
const MOUTH = 14;
const CUT = 21;

interface Pop {
  kind: Kind;
  hp: number;
  until: number;
  state: "rising" | "up" | "hit" | "sinking";
  tex: string;
  name: string;
  face?: Face;
}
interface Hole {
  i: number;
  x: number;
  top: number;
  mouth: number;
  back: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  front: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  head: Phaser.GameObjects.Sprite;
  mask: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Ellipse;
  pop: Pop | null;
  key: Phaser.GameObjects.Text;
}

type Mode = "attract" | "countdown" | "play" | "over" | "results";

export class WhackScene extends Phaser.Scene {
  private holes: Hole[] = [];
  private mode: Mode = "attract";
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private timeLeft = WHACK_SECONDS;
  private elapsed = 0;
  private nextSpawn = 0;
  private frenzyUntil = 0;
  private lastCrobley = -99999;
  private stats = { drongi: 0, mikeys: 0, klerbles: 0, bongos: 0, whiffs: 0, hits: 0 };
  private cursor = 4;
  private mallet!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private swinging = false;
  private layer: Phaser.GameObjects.Container | null = null;
  private hud!: { score: Phaser.GameObjects.Text; time: Phaser.GameObjects.Text; combo: Phaser.GameObjects.Text; hi: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle; root: Phaser.GameObjects.Container };
  private cursorRing!: Phaser.GameObjects.Ellipse;
  private tap: Phaser.GameObjects.Sprite | null = null;
  private frenzyText: Phaser.GameObjects.Text | null = null;
  private uiSlept = false;
  private leaving = false;
  private lads: string[] = [];

  constructor() {
    super("Whack");
  }

  create() {
    this.holes = [];
    this.mode = "attract";
    this.leaving = false;
    this.layer = null;
    this.tap = null;
    this.frenzyText = null;
    this.swinging = false;
    this.cursor = 4;
    // the hub HUD (and its touch stick) would sit on top of the cabinet: put it to sleep while we play
    this.uiSlept = false;
    if (this.scene.isActive("UI")) {
      this.scene.sleep("UI");
      this.uiSlept = true;
    }
    synth.ambience(null);
    synth.music("whack", true);
    this.cameras.main.fadeIn(250);
    // the lads with a close-up sheet (not you: you're holding the mallet)
    this.lads = LADS.filter((id) => id !== G.s.player && id !== "CRONGUS" && FACES[id] && (this.textures.exists(FACES[id].key) || this.textures.exists(FACES[id].talk)));
    this.makeAnims();
    this.drawBoard();
    this.drawHud();
    this.bindInput();
    this.attract();
  }

  // ------------------------------------------------------------------ setup

  private makeAnims() {
    for (const [id, f] of Object.entries(FACES)) {
      if (this.anims.exists(`wkf_${id}`)) continue;
      if (this.textures.exists(f.key)) {
        this.anims.create({ key: `wkf_${id}`, frames: f.taunt.map((frame) => ({ key: f.key, frame })), frameRate: 6, repeat: -1 });
        if (f.win) this.anims.create({ key: `wkf_${id}_win`, frames: f.win.map((frame) => ({ key: f.key, frame })), frameRate: 8, repeat: -1 });
      } else if (this.textures.exists(f.talk)) {
        const n = this.textures.get(f.talk).frameTotal - 1;
        this.anims.create({ key: `wkf_${id}`, frames: this.anims.generateFrameNumbers(f.talk, { start: 0, end: Math.max(0, n - 1) }), frameRate: 9, repeat: -1 });
      }
    }
    if (this.textures.exists("wk_bongo_fizz") && !this.anims.exists("wk_bongo_fizz")) this.anims.create({ key: "wk_bongo_fizz", frames: this.anims.generateFrameNumbers("wk_bongo_fizz", {}), frameRate: 10, repeat: -1 });
    if (this.textures.exists("tap_flow") && !this.anims.exists("tap_flow")) this.anims.create({ key: "tap_flow", frames: this.anims.generateFrameNumbers("tap_flow", { start: 0, end: 7 }), frameRate: 9, repeat: -1 });
  }

  private drawBoard() {
    if (this.textures.exists("bg_whack")) this.add.image(480, 270, "bg_whack").setDisplaySize(960, 544).setDepth(-10);
    else this.add.rectangle(480, 270, 960, 540, 0x1a0b3a).setDepth(-10);
    // the deck's neon glow, breathing
    const glow = this.add.ellipse(480, 400, 760, 260, 0xff4fd8, 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(-9);
    this.tweens.add({ targets: glow, alpha: 0.04, yoyo: true, repeat: -1, duration: 900 });
    const art = this.textures.exists("wk_pipe_back") && this.textures.exists("wk_pipe_front");
    const letters = ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const i = r * 3 + c;
        const x = COLS[c];
        const top = ROWS[r];
        const mouth = top + MOUTH * PIPE_SCALE;
        const cut = top + CUT * PIPE_SCALE;
        const d = 10 + r * 10;
        const glow2 = this.add.ellipse(x, top + 80 * PIPE_SCALE - 6, 120, 26, 0x4ade80, 0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(d);
        const back = art ? this.add.image(x, top, "wk_pipe_back").setOrigin(0.5, 0).setScale(PIPE_SCALE).setDepth(d + 1) : this.add.ellipse(x, mouth, 80, 26, 0x14532d).setStrokeStyle(4, 0x84cc16).setDepth(d + 1);
        const head = this.add.sprite(x, cut + 120, "wk_mallet").setOrigin(0.5, 1).setDepth(d + 2).setVisible(false);
        const m = this.make.graphics({}).fillRect(x - 70, 0, 140, cut);
        head.setMask(m.createGeometryMask());
        const front = art ? this.add.image(x, top, "wk_pipe_front").setOrigin(0.5, 0).setScale(PIPE_SCALE).setDepth(d + 3) : this.add.rectangle(x, cut + 40, 80, 80, 0x166534).setStrokeStyle(4, 0x84cc16).setDepth(d + 3);
        const key = this.add.text(x, top + 80 * PIPE_SCALE - 26, TOUCH.enabled ? "" : letters[i], { fontFamily: PIXEL_BOLD, fontSize: "14px", color: "#d9f99d", stroke: "#052e16", strokeThickness: 4 }).setOrigin(0.5).setDepth(d + 4).setAlpha(0.85);
        this.holes.push({ i, x, top, mouth, back, front, head, mask: m, glow: glow2, pop: null, key });
      }
    this.cursorRing = this.add.ellipse(0, 0, 104, 34).setStrokeStyle(3, 0xfacc15, 0.9).setDepth(45).setVisible(false);
    this.mallet = this.textures.exists("wk_mallet")
      ? this.add.image(800, 300, "wk_mallet").setScale(1.6).setOrigin(0.12, 0.9).setFlipX(true).setDepth(60)
      : this.add.rectangle(800, 300, 26, 70, 0xff4fd8).setOrigin(0.5, 1).setDepth(60);
    if (this.mallet instanceof Phaser.GameObjects.Image) this.mallet.setOrigin(0.9, 0.92);
    this.mallet.setAngle(30);
    this.input.setDefaultCursor(TOUCH.enabled ? "default" : "none");
  }

  private drawHud() {
    const root = this.add.container(0, 0).setDepth(80);
    const plate = this.add.rectangle(480, 34, 940, 56, 0x12001f, 0.82).setStrokeStyle(3, 0xff4fd8, 0.9);
    const score = this.add.text(30, 34, "", { fontFamily: PIXEL_BOLD, fontSize: "26px", color: "#ffd23f", stroke: "#000", strokeThickness: 5 }).setOrigin(0, 0.5);
    const time = this.add.text(480, 34, "", { fontFamily: "Impact, sans-serif", fontSize: "38px", color: "#22d3ee", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5);
    time.setShadow(0, 0, "#22d3ee", 12, true, true);
    const combo = this.add.text(930, 24, "", { fontFamily: PIXEL_BOLD, fontSize: "20px", color: "#ff4fd8", stroke: "#000", strokeThickness: 5 }).setOrigin(1, 0.5);
    const barBack = this.add.rectangle(930, 48, 150, 8, 0x3b0764).setOrigin(1, 0.5);
    const bar = this.add.rectangle(780, 48, 0, 8, 0xff4fd8).setOrigin(0, 0.5);
    const hi = this.add.text(30, 72, "", { fontFamily: FONT, fontSize: "12px", color: "#c4b5fd", stroke: "#000", strokeThickness: 3 }).setOrigin(0, 0.5);
    root.add([plate, score, time, combo, barBack, bar, hi]);
    this.hud = { score, time, combo, hi, bar, root };
    root.setVisible(false);
  }

  private updateHud() {
    const mult = this.mult();
    this.hud.score.setText(`SCORE ${this.score}`);
    const t = Math.max(0, Math.ceil(this.timeLeft));
    this.hud.time.setText(`${t}`).setColor(t <= 10 ? "#ef4444" : "#22d3ee");
    this.hud.combo.setText(this.combo ? `COMBO ${this.combo}  x${mult}` : "x1");
    this.hud.bar.width = 150 * (mult >= 5 ? 1 : (this.combo % 5) / 5);
    this.hud.hi.setText(`HIGH SCORE ${Math.max(this.hiScore(), this.score)}   ·   🎟 ${krokens(G.s)}`);
  }

  private bindInput() {
    const kb = this.input.keyboard;
    // one whack per key press: ignore auto-repeat, and never act on the same DOM event twice (a slow frame can
    // hand the plugin a keydown it has already seen)
    const seen = new WeakSet<object>();
    const on = (name: string, fn: () => void) =>
      kb?.on(`keydown-${name}`, (e: KeyboardEvent) => {
        if (e?.repeat || (e && seen.has(e))) return;
        if (e) seen.add(e);
        fn();
      });
    const map: [string, number][] = [];
    ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"].forEach((k, i) => map.push([k, i]));
    ["SEVEN", "EIGHT", "NINE", "FOUR", "FIVE", "SIX", "ONE", "TWO", "THREE"].forEach((k, i) => map.push([`NUMPAD_${k}`, i]));
    ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"].forEach((k, i) => map.push([k, i]));
    for (const [k, i] of map)
      on(k, () => {
        if (this.mode !== "play") return;
        this.cursor = i;
        this.whack(i);
      });
    const move = (dx: number, dy: number) => {
      if (this.mode !== "play") return;
      const r = Phaser.Math.Clamp(Math.floor(this.cursor / 3) + dy, 0, 2);
      const c = Phaser.Math.Clamp((this.cursor % 3) + dx, 0, 2);
      this.cursor = r * 3 + c;
      this.showCursor();
    };
    on("LEFT", () => move(-1, 0));
    on("RIGHT", () => move(1, 0));
    on("UP", () => move(0, -1));
    on("DOWN", () => move(0, 1));
    on("SPACE", () => {
      if (this.mode === "play") this.whack(this.cursor);
      else if (this.mode === "attract" || this.mode === "results") this.insertCoin();
    });
    on("ENTER", () => {
      if (this.mode === "attract" || this.mode === "results") this.insertCoin();
    });
    on("ESC", () => {
      if (this.mode === "attract" || this.mode === "results") this.exit();
      // bottling it mid-game: the clock runs out now, and you're paid for what you've got
      else if (this.mode === "play") this.timeLeft = 0;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.swinging && this.mode === "play" && !TOUCH.enabled) this.mallet.setPosition(p.x + 40, p.y + 28);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.mode !== "play" || over.length) return;
      const h = this.holeAt(p.x, p.y);
      if (h) {
        this.cursor = h.i;
        this.whack(h.i);
      } else this.swing(p.x, p.y);
    });
  }

  private holeAt(x: number, y: number) {
    let best: Hole | null = null;
    let bd = Infinity;
    for (const h of this.holes) {
      const dx = Math.abs(x - h.x);
      const dy = y - h.mouth;
      if (dx > 72 || dy < -100 || dy > 80) continue;
      const d = dx + Math.abs(dy + 20) * 0.6;
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  private showCursor() {
    const h = this.holes[this.cursor];
    this.cursorRing.setPosition(h.x, h.mouth).setVisible(this.mode === "play" && !TOUCH.enabled);
    if (!this.swinging) this.mallet.setPosition(h.x + 50, h.mouth - 10);
  }

  // ------------------------------------------------------------------ ATTRACT

  private hiScore() {
    return (G.s.flags.whack_hi as number) ?? 0;
  }

  private attract() {
    this.mode = "attract";
    this.hud.root.setVisible(false);
    this.cursorRing.setVisible(false);
    this.mallet.setVisible(false);
    this.input.setDefaultCursor("default");
    this.layer?.destroy(true);
    const L = (this.layer = this.add.container(0, 0).setDepth(100));
    L.add(this.add.rectangle(480, 270, 960, 540, 0x0b0618, 0.55));
    const t = this.add.text(480, 92, "WHACK-A-DRONGUS", { fontFamily: "Impact, sans-serif", fontSize: "72px", color: "#4ade80", stroke: "#12001f", strokeThickness: 10 }).setOrigin(0.5);
    t.setShadow(0, 0, "#4ade80", 22, true, true);
    this.tweens.add({ targets: t, scale: { from: 0.96, to: 1.04 }, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
    const sub = this.add.text(480, 146, "★ A KRAZY KREDDLE ARCADE EXCLUSIVE ★  He's always bluffing. Twat him anyway.", { fontFamily: FONT, fontSize: "14px", color: "#ff4fd8", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5);
    L.add([t, sub]);
    // the legend: who's who, and what they're worth
    const card = this.add.rectangle(480, 300, 700, 210, 0x16072b, 0.9).setStrokeStyle(4, 0x22d3ee);
    L.add(card);
    const icon = (id: string, name: string, pts: string): [string, string, string, number] => {
      const f = FACES[id];
      return this.textures.exists(f.key) ? [f.key, name, pts, f.taunt[0]] : [f.talk, name, pts, 0];
    };
    const rows: [string, string, string, number?][] = [
      icon("DRONGUS", "DRONGUS", "10"),
      icon("CRONGUS", "LIL' CRONGUS (quick!)", "25"),
      icon("KLERBLE", "PRESIDENT KLERBLE (two hits)", "40"),
      icon(this.lads[0] ?? "KREZMAR", "ONE OF THE LADS", "15"),
      icon("MIKEY", "MIKEY: DON'T. He's grassing.", "-30"),
      ["wk_bongo", "FIZZY BONGO: +3 seconds", "+5"],
      ["wk_crobley", "GOLDEN CROBLEY: THE GREAT TAP", "x2!"],
    ];
    rows.forEach(([tex, name, pts, fr], i) => {
      const col = i < 4 ? 0 : 1;
      const row = i < 4 ? i : i - 4;
      const x = 160 + col * 340;
      const y = 228 + row * 46;
      if (this.textures.exists(tex)) {
        const ic = this.add.image(x, y, tex, fr ?? undefined);
        ic.setScale(36 / Math.max(ic.width, ic.height));
        L.add(ic);
      }
      L.add(this.add.text(x + 28, y, name, { fontFamily: FONT, fontSize: "13px", color: pts.startsWith("-") ? "#fca5a5" : "#ffffff", fontStyle: "bold" }).setOrigin(0, 0.5));
      L.add(this.add.text(x + 300, y, pts, { fontFamily: PIXEL_BOLD, fontSize: "18px", color: pts.startsWith("-") ? "#ef4444" : "#facc15", stroke: "#000", strokeThickness: 3 }).setOrigin(1, 0.5));
    });
    L.add(this.add.text(650, 366, "Hit five in a row and the multiplier climbs (up to x5).\nMiss, whack Mikey, or let one get away: back to x1.", { fontFamily: FONT, fontSize: "11px", color: "#c4b5fd", align: "center" }).setOrigin(0.5));
    const hi = this.hiScore();
    L.add(this.add.text(480, 422, `HIGH SCORE: ${hi}     ·     ${WHACK_SECONDS} SECONDS     ·     1 🎟 KROKEN PER 200 POINTS (max 25) · NEW HIGH SCORE +3 🎟 · ${WHACK_JACKPOT.score}+: ${WHACK_JACKPOT.coins} KREZZCOIN`, { fontFamily: FONT, fontSize: "12px", color: "#facc15", fontStyle: "bold", stroke: "#000", strokeThickness: 3, align: "center", wordWrap: { width: 900 } }).setOrigin(0.5));
    const ins = this.add.text(480, 462, `INSERT ${WHACK_COST} KREZZCOIN`, { fontFamily: "Impact, sans-serif", fontSize: "28px", color: "#ffffff", stroke: "#12001f", strokeThickness: 6 }).setOrigin(0.5);
    this.tweens.add({ targets: ins, alpha: 0.25, yoyo: true, repeat: -1, duration: 420 });
    L.add(ins);
    const keys = TOUCH.enabled ? "Tap the pipes to whack." : "Q W E / A S D / Z X C (or numpad, or click) to whack · ESC to leave";
    L.add(this.add.text(480, 490, keys, { fontFamily: FONT, fontSize: "12px", color: "#e9d5ff" }).setOrigin(0.5));
    const play = button(this, 380, 520, `▶ PLAY (${WHACK_COST} 💰)`, () => this.insertCoin(), { w: 200, h: 36, size: 15, color: 0x166534 });
    const back = button(this, 600, 520, "◀ BACK TO THE STRIP", () => this.exit(), { w: 200, h: 36, size: 14, color: 0x7f1d1d });
    L.add([play, back]);
    // the demo: heads pop, a ghost mallet bonks the odd one
    this.nextSpawn = this.time.now + 300;
  }

  private insertCoin() {
    if (this.leaving) return;
    const s = G.s;
    if (s.coins < WHACK_COST) {
      synth.play("tap_fail");
      this.flash(`You need ${WHACK_COST} Krezzcoin. You have ${s.coins}. Drongus is laughing at you.`, "#ef4444");
      return;
    }
    s.coins -= WHACK_COST;
    s.flags.kreddle_gambles = ((s.flags.kreddle_gambles as number) ?? 0) + 1;
    s.flags.whack_plays = ((s.flags.whack_plays as number) ?? 0) + 1;
    // it counts as gambling (the Pit Boss's third rule)
    this.scene.get("Kreddle")?.events.emit("whack-played");
    synth.play("coin");
    this.countdown();
  }

  private flash(text: string, color = "#ffffff") {
    const t = this.add.text(480, 200, text, { fontFamily: FONT, fontSize: "16px", color, fontStyle: "bold", backgroundColor: "#12001fee", padding: { x: 10, y: 6 }, align: "center", wordWrap: { width: 700 } }).setOrigin(0.5).setDepth(400);
    this.tweens.add({ targets: t, y: 180, alpha: 0, delay: 1400, duration: 500, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ PLAY

  private countdown() {
    this.mode = "countdown";
    this.layer?.destroy(true);
    this.layer = null;
    for (const h of this.holes) this.clearHole(h);
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.timeLeft = WHACK_SECONDS;
    this.elapsed = 0;
    this.frenzyUntil = 0;
    this.lastCrobley = -99999;
    this.stats = { drongi: 0, mikeys: 0, klerbles: 0, bongos: 0, whiffs: 0, hits: 0 };
    this.hud.root.setVisible(true);
    this.mallet.setVisible(true);
    this.input.setDefaultCursor(TOUCH.enabled ? "default" : "none");
    this.updateHud();
    synth.play("whack_start");
    const steps = ["3", "2", "1", "WHACK!"];
    steps.forEach((s, i) =>
      this.time.delayedCall(i * 480, () => {
        const t = this.add.text(480, 270, s, { fontFamily: "Impact, sans-serif", fontSize: i === 3 ? "96px" : "84px", color: i === 3 ? "#4ade80" : "#ffffff", stroke: "#12001f", strokeThickness: 10 }).setOrigin(0.5).setDepth(300).setScale(0.3);
        t.setShadow(0, 0, i === 3 ? "#4ade80" : "#ff4fd8", 18, true, true);
        if (i < 3) synth.play("tap");
        this.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.out" });
        this.tweens.add({ targets: t, alpha: 0, delay: 300, duration: 200, onComplete: () => t.destroy() });
        if (i === 3) {
          this.mode = "play";
          this.nextSpawn = 0;
          this.showCursor();
        }
      }),
    );
  }

  private mult() {
    return Math.min(5, 1 + Math.floor(this.combo / 5));
  }

  private frenzy() {
    return this.time.now < this.frenzyUntil;
  }

  update(_t: number, delta: number) {
    // the clock is real time (a slow frame doesn't buy you seconds), but a long stall (tab away) isn't charged
    const dt = Math.min(delta, 250);
    const now = this.time.now;
    if (this.mode === "attract") {
      if (now > this.nextSpawn) {
        this.nextSpawn = now + 520 + Math.random() * 500;
        const free = this.holes.filter((h) => !h.pop);
        if (free.length > 5) this.spawn(Phaser.Utils.Array.GetRandom(free), true);
      }
    }
    if (this.mode === "play") {
      this.elapsed += dt;
      this.timeLeft -= dt / 1000;
      const prog = Phaser.Math.Clamp(this.elapsed / (WHACK_SECONDS * 1000), 0, 1);
      if (now > this.nextSpawn) {
        const live = this.holes.filter((h) => h.pop && h.pop.state !== "sinking").length;
        const cap = this.frenzy() ? 6 : 2 + Math.floor(prog * 2.6);
        const free = this.holes.filter((h) => !h.pop);
        if (live < cap && free.length) this.spawn(Phaser.Utils.Array.GetRandom(free));
        const gap = Phaser.Math.Linear(820, 360, prog) * (this.frenzy() ? 0.4 : 1);
        this.nextSpawn = now + gap * (0.75 + Math.random() * 0.5);
      }
      if (this.frenzyText && !this.frenzy()) this.endFrenzy();
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        void this.timeUp();
      }
      this.updateHud();
    }
    // pops that have had their time go back down
    for (const h of this.holes) {
      const p = h.pop;
      if (!p || p.state !== "up" || now < p.until) continue;
      this.sink(h, true);
    }
  }

  private pickKind(): Kind {
    const s = this.elapsed / 1000;
    const w: [Kind, number][] = (Object.keys(KINDS) as Kind[]).map((k) => {
      let wt = KINDS[k].weight;
      if (k === "lad" && !this.lads.length) wt = 0;
      if (this.frenzy()) wt = k === "drongus" || k === "lad" || k === "crongus" || k === "klerble" ? wt : 0;
      if (k === "crobley" && (s < 12 || this.time.now - this.lastCrobley < 18000)) wt = 0;
      if (k === "bongo" && this.timeLeft > WHACK_SECONDS - 10) wt = 0;
      // Mikey turns up more as it gets frantic
      if (k === "mikey") wt *= 0.7 + s / WHACK_SECONDS;
      return [k, wt];
    });
    const total = w.reduce((a, [, x]) => a + x, 0);
    let r = Math.random() * total;
    for (const [k, x] of w) {
      r -= x;
      if (r <= 0) return k;
    }
    return "drongus";
  }

  private spawn(h: Hole, demo = false) {
    const kind = demo ? (Phaser.Utils.Array.GetRandom(["drongus", "drongus", "crongus", "klerble", "mikey", "lad", "bongo"]) as Kind) : this.pickKind();
    if (kind === "lad" && !this.lads.length) return;
    const def = KINDS[kind];
    const faceId = kind === "lad" ? (Phaser.Utils.Array.GetRandom(this.lads) as string) : KIND_FACE[kind];
    const face = faceId ? FACES[faceId] : undefined;
    const tex = face ? (this.textures.exists(face.key) ? face.key : face.talk) : kind === "bongo" ? (this.textures.exists("wk_bongo_fizz") ? "wk_bongo_fizz" : "wk_bongo") : "wk_crobley";
    if (!this.textures.exists(tex)) return;
    if (kind === "crobley") this.lastCrobley = this.time.now;
    const prog = Phaser.Math.Clamp(this.elapsed / (WHACK_SECONDS * 1000), 0, 1);
    const base = demo ? 1100 : Phaser.Math.Linear(1300, 640, prog);
    const name = faceId ?? kind.toUpperCase();
    const pop: Pop = { kind, hp: def.hp, until: Infinity, state: "rising", tex, name, face: face && tex === face.key ? face : undefined };
    h.pop = pop;
    const hd = h.head;
    hd.setTexture(tex, pop.face ? pop.face.taunt[0] : 0).clearTint().setAngle(0).setVisible(true).setAlpha(1);
    hd.setScale(pop.face ? pop.face.scale : face ? 1.15 : def.scale);
    const anim = tex === "wk_bongo_fizz" ? "wk_bongo_fizz" : faceId ? `wkf_${faceId}` : "";
    if (this.anims.exists(anim)) hd.play(anim);
    else hd.stop();
    const cut = h.top + CUT * PIPE_SCALE;
    const upY = def.pickup ? cut - 6 : cut + 2;
    hd.y = cut + hd.displayHeight + 4;
    hd.x = h.x;
    h.glow.setFillStyle(def.bad ? 0xef4444 : kind === "crobley" ? 0xfacc15 : 0x4ade80, 0.3);
    if (!demo) synth.play("pop", 0.35);
    this.tweens.add({
      targets: hd,
      y: upY,
      duration: kind === "crongus" ? 110 : 170,
      ease: "Back.out",
      onComplete: () => {
        if (h.pop !== pop) return;
        pop.state = "up";
        pop.until = this.time.now + base * def.up;
        // the demo's ghost mallet
        if (demo && Math.random() < 0.55 && !def.bad) this.time.delayedCall(250 + Math.random() * 300, () => h.pop === pop && pop.state === "up" && this.mode === "attract" && this.hit(h, true));
      },
    });
  }

  private clearHole(h: Hole) {
    this.tweens.killTweensOf(h.head);
    h.head.setVisible(false).stop();
    h.pop = null;
    h.glow.setFillStyle(0x4ade80, 0.18);
  }

  /** Back down the pipe. `escaped`: it went un-whacked. */
  private sink(h: Hole, escaped: boolean) {
    const p = h.pop;
    if (!p) return;
    p.state = "sinking";
    if (escaped && this.mode === "play") {
      const def = KINDS[p.kind];
      if (!def.bad && !def.pickup) {
        if (this.combo >= 5) this.popText(h.x, h.mouth - 70, "COMBO LOST", "#9ca3af", 14);
        this.combo = 0;
      }
      if (p.kind === "klerble") this.bark(h, Phaser.Utils.Array.GetRandom(BARKS.klerbleEscape), "#facc15");
      if (p.kind === "mikey") this.popText(h.x, h.mouth - 70, "Good restraint.", "#86efac", 12);
    }
    const cut = h.top + CUT * PIPE_SCALE;
    this.tweens.killTweensOf(h.head);
    // President Klerble, getting away with it: arms up for a moment before he goes
    const gloat = escaped && p.kind === "klerble" && !!p.face && this.anims.exists("wkf_KLERBLE_win");
    if (gloat) h.head.play("wkf_KLERBLE_win");
    this.tweens.add({ targets: h.head, y: cut + h.head.displayHeight + 6, delay: gloat ? 500 : 0, duration: 150, ease: "Quad.in", onComplete: () => h.pop === p && this.clearHole(h) });
  }

  // ------------------------------------------------------------------ WHACK

  private swing(x: number, y: number, after?: () => void) {
    this.swinging = true;
    const m = this.mallet;
    this.tweens.killTweensOf(m);
    m.setPosition(x + 46, y + 30).setAngle(48);
    this.tweens.add({
      targets: m,
      angle: -18,
      duration: 55,
      ease: "Quad.in",
      onComplete: () => {
        after?.();
        this.tweens.add({ targets: m, angle: 30, duration: 120, ease: "Quad.out", onComplete: () => (this.swinging = false) });
      },
    });
  }

  private whack(i: number) {
    if (this.mode !== "play") return;
    const h = this.holes[i];
    this.showCursor();
    // the hit lands the moment you press (the swing is the show), so fast fingers never lose one to the animation
    this.swing(h.x, h.mouth - 30);
    const p = h.pop;
    if (p && (p.state === "up" || p.state === "rising")) this.hit(h);
    else this.whiff(h);
  }

  private whiff(h: Hole) {
    synth.play("tap", 0.6);
    this.stats.whiffs++;
    if (this.combo >= 5) this.popText(h.x, h.mouth - 60, "COMBO LOST", "#9ca3af", 14);
    else this.popText(h.x, h.mouth - 60, "MISS", "#9ca3af", 14);
    this.combo = 0;
    vfx(this, "vfx_dust", h.x, h.mouth, { scale: 1.2, depth: 50 });
  }

  private hit(h: Hole, demo = false) {
    const p = h.pop;
    if (!p) return;
    const def = KINDS[p.kind];
    const hd = h.head;
    synth.play("whack_bonk");
    vfx(this, "vfx_hit", hd.x, hd.y - hd.displayHeight * 0.55, { scale: 1.8, depth: 70, add: true });
    if (demo) {
      this.swingGhost(h);
      p.state = "hit";
      this.squash(h, p);
      return;
    }
    this.stats.hits++;
    // President Klerble takes two
    if (p.hp > 1) {
      p.hp--;
      p.until += 380;
      hd.setTint(0xffb4b4);
      this.time.delayedCall(90, () => hd.clearTint());
      this.tweens.add({ targets: hd, angle: { from: -12, to: 12 }, yoyo: true, repeat: 1, duration: 60, onComplete: () => hd.setAngle(0) });
      this.bark(h, Phaser.Utils.Array.GetRandom(BARKS.klerble1), "#facc15");
      this.cameras.main.shake(70, 0.004);
      return;
    }
    p.state = "hit";
    if (def.bad) {
      // you whacked Mikey
      this.stats.mikeys++;
      this.combo = 0;
      this.score = Math.max(0, this.score + def.pts);
      hd.stop();
      if (p.face?.hitKey && this.textures.exists(p.face.hitKey)) hd.setTexture(p.face.hitKey, 0);
      else if (!p.face && this.textures.exists("talk_MIKEY_HURT")) hd.setTexture("talk_MIKEY_HURT", 0);
      synth.play("tap_fail");
      this.cameras.main.flash(160, 200, 0, 0);
      this.cameras.main.shake(140, 0.008);
      this.popText(h.x, h.mouth - 80, `${def.pts}`, "#ef4444", 26);
      this.bark(h, Phaser.Utils.Array.GetRandom(BARKS.mikey), "#fca5a5");
      this.time.delayedCall(260, () => h.pop === p && this.sink(h, false));
      return;
    }
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = this.mult() * (this.frenzy() ? 2 : 1);
    const pts = def.pts * mult;
    this.score += pts;
    if (p.kind === "drongus") this.stats.drongi++;
    if (p.kind === "klerble") this.stats.klerbles++;
    this.popText(h.x, h.mouth - 84, `+${pts}${mult > 1 ? `  x${mult}` : ""}`, mult >= 4 ? "#ff4fd8" : "#facc15", 18 + Math.min(10, mult * 2));
    if (this.combo % 5 === 0 && this.combo <= 20) {
      synth.play("ding", 0.7);
      this.popText(480, 110, `x${this.mult()} MULTIPLIER!`, "#ff4fd8", 24);
    }
    if (p.kind === "bongo") {
      this.stats.bongos++;
      this.timeLeft = Math.min(WHACK_SECONDS + 15, this.timeLeft + 3);
      synth.play("gulp");
      this.bark(h, Phaser.Utils.Array.GetRandom(BARKS.bongo), "#c4b5fd");
      vfx(this, "vfx_sparks", h.x, h.mouth - 30, { scale: 2, depth: 70, add: true });
    } else if (p.kind === "crobley") {
      this.startFrenzy();
    } else {
      const key = p.kind === "lad" ? "lad" : p.kind;
      if (Math.random() < 0.6) this.bark(h, Phaser.Utils.Array.GetRandom(BARKS[key]), "#ffffff");
      // dizzy stars (a looping sheet: it spins a moment, then fades)
      const st = vfx(this, "vfx_stars", hd.x, hd.y - hd.displayHeight * 0.9, { scale: 1.6, depth: 70 });
      if (st) this.tweens.add({ targets: st, y: st.y - 16, alpha: 0, delay: 250, duration: 350, onComplete: () => st.destroy() });
      this.cameras.main.shake(60, 0.003);
    }
    this.squash(h, p);
  }

  private swingGhost(h: Hole) {
    // the attract demo's mallet: a quick translucent bonk
    if (!this.textures.exists("wk_mallet")) return;
    const g = this.add.image(h.x + 46, h.mouth, "wk_mallet").setScale(1.4).setOrigin(0.9, 0.92).setFlipX(true).setAlpha(0.8).setDepth(60).setAngle(48);
    this.tweens.add({ targets: g, angle: -18, duration: 60, onComplete: () => this.tweens.add({ targets: g, alpha: 0, angle: 20, duration: 200, onComplete: () => g.destroy() }) });
  }

  private squash(h: Hole, p: Pop) {
    const hd = h.head;
    hd.stop();
    // the face they pull when it lands
    if (p.face && !p.face.hitKey) hd.setFrame(p.face.hit);
    const sx = hd.scaleX;
    const sy = hd.scaleY;
    hd.setTint(0xffffff);
    this.time.delayedCall(60, () => hd.clearTint());
    this.tweens.killTweensOf(hd);
    this.tweens.add({
      targets: hd,
      scaleY: sy * 0.62,
      scaleX: sx * 1.18,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        hd.setScale(sx, sy);
        if (h.pop === p) this.sink(h, false);
      },
    });
  }

  private startFrenzy() {
    this.frenzyUntil = this.time.now + 6500;
    synth.play("jackpot");
    synth.play("tap_gush", 0.8);
    this.cameras.main.flash(300, 255, 210, 60);
    for (let i = 0; i < 3; i++) vfx(this, "vfx_confetti", 280 + i * 200, 250, { scale: 2.2, depth: 90, delay: i * 120 });
    if (this.textures.exists("tap_flow")) {
      this.tap?.destroy();
      this.tap = this.add.sprite(480, 52, "tap_flow", 0).setOrigin(0.5, 0).setScale(2.6).setDepth(5).play("tap_flow").setAlpha(0);
      this.tweens.add({ targets: this.tap, alpha: 1, duration: 300 });
    }
    this.frenzyText?.destroy();
    this.frenzyText = this.add.text(480, 518, "THE GREAT TAP FLOWS!  DOUBLE POINTS!", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#facc15", stroke: "#12001f", strokeThickness: 7 }).setOrigin(0.5).setDepth(90);
    this.frenzyText.setShadow(0, 0, "#facc15", 18, true, true);
    this.tweens.add({ targets: this.frenzyText, scale: { from: 0.95, to: 1.08 }, yoyo: true, repeat: -1, duration: 260 });
    this.nextSpawn = 0;
  }

  private endFrenzy() {
    const t = this.frenzyText;
    this.frenzyText = null;
    if (t) this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
    const tap = this.tap;
    this.tap = null;
    if (tap) this.tweens.add({ targets: tap, alpha: 0, duration: 400, onComplete: () => tap.destroy() });
  }

  private popText(x: number, y: number, text: string, color: string, size = 18) {
    const t = this.add.text(x, y, text, { fontFamily: PIXEL_BOLD, fontSize: `${size}px`, color, stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(85).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: "Back.out" });
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, delay: 380, duration: 420, onComplete: () => t.destroy() });
  }

  private bark(h: Hole, text: string, bg: string) {
    const t = this.add.text(h.x + (h.x > 480 ? -10 : h.x < 480 ? 10 : 0), h.mouth - 96, text, { fontFamily: FONT, fontSize: "12px", color: "#050505", fontStyle: "bold", backgroundColor: bg, padding: { x: 6, y: 3 }, align: "center", wordWrap: { width: 180 } }).setOrigin(0.5, 1).setDepth(86);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, delay: 650, duration: 450, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ RESULTS

  private async timeUp() {
    if (this.mode !== "play") return;
    this.mode = "over";
    this.endFrenzy();
    this.cursorRing.setVisible(false);
    for (const h of this.holes) if (h.pop) this.sink(h, false);
    synth.play("whistle");
    const t = this.add.text(480, 270, "TIME'S UP!", { fontFamily: "Impact, sans-serif", fontSize: "88px", color: "#ef4444", stroke: "#12001f", strokeThickness: 10 }).setOrigin(0.5).setDepth(300).setScale(0.2);
    t.setShadow(0, 0, "#ef4444", 22, true, true);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: "Back.out" });
    await new Promise<void>((r) => this.time.delayedCall(1300, () => r()));
    t.destroy();
    this.results();
  }

  private results() {
    this.mode = "results";
    this.mallet.setVisible(false);
    this.input.setDefaultCursor("default");
    const s = G.s;
    const prevHi = this.hiScore();
    const newHi = this.score > prevHi && this.score > 0;
    if (newHi) s.flags.whack_hi = this.score;
    const won = whackKrokens(this.score, newHi);
    const jackpot = this.score >= WHACK_JACKPOT.score;
    addKrokens(s, won);
    if (jackpot) s.coins += WHACK_JACKPOT.coins;
    s.flags.whack_last = this.score;
    G.save();
    this.layer?.destroy(true);
    const L = (this.layer = this.add.container(0, 0).setDepth(200));
    L.add(this.add.rectangle(480, 270, 960, 540, 0x0b0618, 0.7));
    L.add(this.add.rectangle(480, 270, 620, 420, 0x16072b, 0.96).setStrokeStyle(5, 0x4ade80));
    const head = this.add.text(480, 96, "GAME OVER, MATE", { fontFamily: "Impact, sans-serif", fontSize: "40px", color: "#4ade80", stroke: "#12001f", strokeThickness: 8 }).setOrigin(0.5);
    head.setShadow(0, 0, "#4ade80", 16, true, true);
    L.add(head);
    const sc = this.add.text(480, 154, `${this.score}`, { fontFamily: "Impact, sans-serif", fontSize: "64px", color: "#ffd23f", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5);
    L.add(sc);
    if (newHi) {
      const nh = this.add.text(480, 200, "★ NEW HIGH SCORE ★", { fontFamily: PIXEL_BOLD, fontSize: "20px", color: "#ff4fd8", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
      this.tweens.add({ targets: nh, alpha: 0.3, yoyo: true, repeat: -1, duration: 300 });
      L.add(nh);
      synth.play("cheer");
    } else L.add(this.add.text(480, 200, `HIGH SCORE: ${prevHi}`, { fontFamily: PIXEL_BOLD, fontSize: "16px", color: "#c4b5fd", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5));
    const lines = [
      `Drongi whacked: ${this.stats.drongi}    President Klerbles: ${this.stats.klerbles}`,
      `Best combo: ${this.bestCombo}    Fizzy Bongos: ${this.stats.bongos}    Misses: ${this.stats.whiffs}`,
      `Mikeys whacked: ${this.stats.mikeys}${this.stats.mikeys ? " (he's telling Drongus)" : " (he's still upset, somehow)"}`,
    ];
    L.add(this.add.text(480, 252, lines.join("\n"), { fontFamily: FONT, fontSize: "14px", color: "#ffffff", align: "center", lineSpacing: 6 }).setOrigin(0.5));
    L.add(this.add.text(480, 316, verdict(this.score), { fontFamily: FONT, fontSize: "13px", color: "#facc15", fontStyle: "italic", align: "center", wordWrap: { width: 560 } }).setOrigin(0.5));
    // the tickets come out of the slot one at a time
    const tk = this.add.text(480, 360, won ? "+0 🎟 KROKENS" : "NO KROKENS. The House keeps your coin.", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: won ? "#38bdf8" : "#9ca3af", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5);
    L.add(tk);
    let n = 0;
    if (won)
      this.time.addEvent({
        delay: Math.max(30, 600 / won),
        repeat: won - 1,
        callback: () => {
          n++;
          tk.setText(`+${n} 🎟 KROKEN${n > 1 ? "S" : ""}${newHi && n === won ? " (incl. +3 high score)" : ""}`);
          synth.play("ding", 0.35);
          if (this.textures.exists("kd_kroken")) {
            const k = this.add.image(480 + (Math.random() - 0.5) * 300, 380, "kd_kroken").setDepth(210);
            this.tweens.add({ targets: k, y: 300, alpha: 0, angle: (Math.random() - 0.5) * 200, duration: 700, onComplete: () => k.destroy() });
          }
        },
      });
    if (jackpot) L.add(this.add.text(480, 396, `JACKPOT! +${WHACK_JACKPOT.coins} 💰 KREZZCOIN`, { fontFamily: PIXEL_BOLD, fontSize: "18px", color: "#ffd23f", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5));
    const again = button(this, 360, 440, `▶ AGAIN (${WHACK_COST} 💰)`, () => this.insertCoin(), { w: 200, h: 40, size: 15, color: 0x166534 });
    const back = button(this, 600, 440, "◀ BACK TO THE STRIP", () => this.exit(), { w: 220, h: 40, size: 14, color: 0x7f1d1d });
    L.add([again, back]);
    if (!TOUCH.enabled) L.add(this.add.text(480, 472, "SPACE: again  ·  ESC: back to the Strip", { fontFamily: FONT, fontSize: "11px", color: "#c4b5fd" }).setOrigin(0.5));
    this.hud.root.setVisible(true);
    this.updateHud();
  }

  // ------------------------------------------------------------------ out

  private exit() {
    if (this.leaving) return;
    this.leaving = true;
    G.save();
    this.input.setDefaultCursor("default");
    this.cameras.main.fadeOut(220);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      for (const h of this.holes) h.mask.destroy();
      if (this.uiSlept) this.scene.wake("UI");
      const k = this.scene.get("Kreddle");
      this.scene.resume("Kreddle");
      k.events.emit("ui-resume");
      synth.music("kreddle", true);
      synth.ambience("casino");
      this.scene.stop();
    });
  }
}

function verdict(score: number): string {
  if (score < 200) return "Drongus is still bluffing. You barely touched him. He's put it in the group chat.";
  if (score < 800) return "Respectable. Mikey says it wasn't fair. Nobody reacted to his message.";
  if (score < 1800) return "Drongi everywhere are seeking attention elsewhere. Wonk it 'til you krez.";
  if (score < 3000) return "The cabinet has asked for a lie down and a Fizzy Bongo.";
  if (score < WHACK_JACKPOT.score) return "Absolute carnage. President Klerble has called an emergency press conference about you.";
  return "PRESIDENT KLERBLE: NO! NO! NOOOO! You've broken his machine. Here's his money. Please leave.";
}

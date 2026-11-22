import Phaser from "phaser";
import { backdrop } from "../gfx/HD";
import { CHARACTERS } from "../../data/characters";
import type { PlayableId } from "../../data/types";
import { button, FONT, hexStr, label, title } from "../ui/theme";
import { startNewRun, switchTo, fadeThen } from "../Flow";
import { synth } from "../audio/Synth";
import { btnDown, PAD_START } from "../systems/padbinds";
import { BANTER_LEVELS, BANTER_NOTE, DEFAULT_BANTER } from "../systems/banter";
import { DEFAULT_DIFFICULTY } from "../systems/difficulty";

/**
 * NEW GAME, after the difficulty: how much banter in the briefings and debriefings? MAX BANTER (recommended),
 * MODERATE BANTER or EXPOSITION (systems/banter.ts). Changeable any time from the pause menu.
 * Arrows / W-S / 1-3 / d-pad / stick pick, Enter / Space / pad A start, Esc / pad B go back to the difficulty.
 * Mouse and touch: tap a level to pick it, tap it again (or START) to go.
 */
export class BanterScene extends Phaser.Scene {
  private player: PlayableId = "FLENKY";
  private ngPlus = 0;
  private difficulty = DEFAULT_DIFFICULTY;
  private sel = 0;
  private rows: { box: Phaser.GameObjects.Rectangle; mark: Phaser.GameObjects.Text }[] = [];
  private padPrev: boolean[] = [];
  private padPrimed = false;
  private stickWas = "";
  private going = false;

  constructor() {
    super("Banter");
  }

  init(data: { player?: PlayableId; ngPlus?: number; difficulty?: number }) {
    this.player = data?.player ?? "FLENKY";
    this.ngPlus = data?.ngPlus ?? 0;
    this.difficulty = data?.difficulty ?? DEFAULT_DIFFICULTY;
    this.sel = Math.max(0, BANTER_LEVELS.findIndex((b) => b.id === DEFAULT_BANTER));
    this.rows = [];
    this.padPrev = [];
    this.padPrimed = false;
    this.going = false;
  }

  create() {
    const { width: W, height: H } = this.scale;
    const bg = this.add.rectangle(0, 0, W, H, 0x10101e).setOrigin(0);
    if (backdrop(this, "bg_charselect", { dim: 0.6, depth: -10 })) bg.setVisible(false);
    const def = CHARACTERS[this.player];
    const who = this.player === "MIKEY" ? "KREBLAR" : def.name.split(" ")[0].toUpperCase();
    title(this, W / 2, 30, "CHOOSE BANTER LEVEL", 26);
    label(this, W / 2, 50, `${who}'s run. How much do the lads chat in briefings and debriefings?`, 13, "#9aa0b4").setOrigin(0.5, 0);

    BANTER_LEVELS.forEach((b, i) => {
      const y = 84 + i * 88;
      const x = 110;
      const RW = 740;
      const box = this.add.rectangle(x, y, RW, 78, 0x1b1e33, 0.94).setOrigin(0).setStrokeStyle(2, b.color, 0.55).setInteractive({ useHandCursor: true });
      this.add.text(x + 30, y + 39, String(i + 1), { fontFamily: "Impact, sans-serif", fontSize: "40px", color: hexStr(b.color), stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
      this.add.text(x + 62, y + 10, b.name, { fontFamily: FONT, fontSize: "21px", color: hexStr(b.color), fontStyle: "bold", stroke: "#000", strokeThickness: 3 });
      if (b.id === DEFAULT_BANTER) this.add.text(x + RW - 12, y + 10, "★ RECOMMENDED", { fontFamily: FONT, fontSize: "11px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(1, 0);
      this.add.text(x + 62, y + 40, b.blurb, { fontFamily: FONT, fontSize: "13px", color: "#e5e7eb", wordWrap: { width: RW - 80 } });
      const mark = this.add.text(x - 14, y + 39, "▶", { fontFamily: FONT, fontSize: "20px", color: "#ffd23f" }).setOrigin(0.5).setVisible(false);
      box.on("pointerover", () => this.select(i));
      box.on("pointerdown", () => {
        // first tap picks it, a second tap on the same one starts
        if (this.sel === i) this.confirm();
        else this.select(i);
      });
      this.rows.push({ box, mark });
    });

    this.add.text(W / 2, 362, BANTER_NOTE, { fontFamily: FONT, fontSize: "12px", color: "#cbd5e1", align: "center", wordWrap: { width: 820 } }).setOrigin(0.5, 0);
    this.add.text(W / 2, 400, "You can change it any time from the pause menu.", { fontFamily: FONT, fontSize: "15px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5, 0);
    this.add.text(W / 2, 458, "↑/↓ or 1–3 to pick · ENTER / A to start · tap twice on touch", { fontFamily: FONT, fontSize: "11px", color: "#8a8fa0" }).setOrigin(0.5, 0);
    button(this, 150, H - 30, "◀ DIFFICULTY", () => this.back(), { w: 200, h: 34, size: 14 });
    button(this, W - 170, H - 30, "LET'S KREZ ▶", () => this.confirm(), { w: 240, h: 38, size: 17, color: 0x7c2d12 });
    this.select(this.sel, true);

    const kb = this.input.keyboard!;
    const N = BANTER_LEVELS.length;
    const up = () => this.select((this.sel + N - 1) % N);
    const down = () => this.select((this.sel + 1) % N);
    kb.on("keydown-UP", up);
    kb.on("keydown-W", up);
    kb.on("keydown-LEFT", up);
    kb.on("keydown-A", up);
    kb.on("keydown-DOWN", down);
    kb.on("keydown-S", down);
    kb.on("keydown-RIGHT", down);
    kb.on("keydown-D", down);
    kb.on("keydown-ENTER", () => this.confirm());
    kb.on("keydown-SPACE", () => this.confirm());
    kb.on("keydown-ESC", () => this.back());
    kb.on("keydown", (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n >= 1 && n <= N) this.select(n - 1);
    });
  }

  update() {
    const gp = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    if (!gp) return;
    const now = gp.buttons.map((_, i) => btnDown(gp, i));
    if (!this.padPrimed) {
      // the A that picked the difficulty doesn't also pick the banter
      this.padPrev = now;
      this.padPrimed = true;
      return;
    }
    const prev = this.padPrev;
    this.padPrev = now;
    const hit = (i: number) => !!now[i] && !prev[i];
    const sy = gp.leftStick.y;
    const stick = Math.abs(sy) > 0.6 ? (sy > 0 ? "D" : "U") : "";
    const stickHit = stick && stick !== this.stickWas ? stick : "";
    this.stickWas = stick;
    const N = BANTER_LEVELS.length;
    if (hit(12) || hit(14) || stickHit === "U") this.select((this.sel + N - 1) % N);
    else if (hit(13) || hit(15) || stickHit === "D") this.select((this.sel + 1) % N);
    else if (hit(0) || hit(PAD_START)) this.confirm();
    else if (hit(1)) this.back();
  }

  private select(i: number, quiet = false) {
    if (i !== this.sel && !quiet) synth.play("select");
    this.sel = i;
    this.rows.forEach((r, j) => {
      const b = BANTER_LEVELS[j];
      r.box.setFillStyle(j === i ? 0x2d3360 : 0x1b1e33, 0.94).setStrokeStyle(j === i ? 4 : 2, b.color, j === i ? 1 : 0.55);
      r.mark.setVisible(j === i);
    });
  }

  private back() {
    if (this.going) return;
    this.going = true;
    fadeThen(this, 200, () => switchTo(this, "Difficulty", { player: this.player, ngPlus: this.ngPlus, difficulty: this.difficulty }));
  }

  private confirm() {
    if (this.going) return;
    this.going = true;
    synth.unlock();
    synth.play("pop");
    startNewRun(this, this.player, this.ngPlus, this.difficulty, BANTER_LEVELS[this.sel].id);
  }
}

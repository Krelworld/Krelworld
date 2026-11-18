import Phaser from "phaser";
import { backdrop } from "../gfx/HD";
import { CHARACTERS } from "../../data/characters";
import type { PlayableId } from "../../data/types";
import { button, FONT, hexStr, label, title } from "../ui/theme";
import { startNewRun, switchTo, fadeThen } from "../Flow";
import { synth } from "../audio/Synth";
import { btnDown, PAD_START } from "../systems/padbinds";
import { DEFAULT_DIFFICULTY, DIFFICULTY_LEVELS, DIFFICULTY_NOTE, difficultyStats, LEGACY_DIFFICULTY, MAX_DIFFICULTY } from "../systems/difficulty";

/**
 * NEW GAME, after the character: how krezzed do you want it? Five levels, the recommended one (3) highlighted.
 * Arrows / W-S / 1-5 / d-pad / stick pick, Enter / Space / pad A start, Esc / pad B go back to the characters.
 * Mouse and touch: tap a level to pick it, tap it again (or START) to go.
 */
export class DifficultyScene extends Phaser.Scene {
  private player: PlayableId = "FLENKY";
  private ngPlus = 0;
  private sel = DEFAULT_DIFFICULTY - 1;
  private rows: { box: Phaser.GameObjects.Rectangle; mark: Phaser.GameObjects.Text }[] = [];
  private stats!: Phaser.GameObjects.Text;
  private padPrev: boolean[] = [];
  private padPrimed = false;
  private stickWas = "";
  private going = false;

  constructor() {
    super("Difficulty");
  }

  init(data: { player?: PlayableId; ngPlus?: number }) {
    this.player = data?.player ?? "FLENKY";
    this.ngPlus = data?.ngPlus ?? 0;
    this.sel = DEFAULT_DIFFICULTY - 1;
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
    title(this, W / 2, 30, "HOW KREZZED DO YOU WANT IT?", 26);
    label(this, W / 2, 50, `${who}'s run. Pick a difficulty.`, 13, "#9aa0b4").setOrigin(0.5, 0);

    DIFFICULTY_LEVELS.forEach((d, i) => {
      const y = 76 + i * 64;
      const x = 110;
      const RW = 740;
      const box = this.add.rectangle(x, y, RW, 58, 0x1b1e33, 0.94).setOrigin(0).setStrokeStyle(2, d.color, 0.55).setInteractive({ useHandCursor: true });
      this.add.text(x + 30, y + 29, String(d.level), { fontFamily: "Impact, sans-serif", fontSize: "38px", color: hexStr(d.color), stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
      this.add.text(x + 62, y + 7, d.name, { fontFamily: FONT, fontSize: "19px", color: hexStr(d.color), fontStyle: "bold", stroke: "#000", strokeThickness: 3 });
      const tag = d.level === DEFAULT_DIFFICULTY ? "★ RECOMMENDED" : d.level === LEGACY_DIFFICULTY ? "THE ORIGINAL BALANCE" : "";
      if (tag) this.add.text(x + RW - 12, y + 9, tag, { fontFamily: FONT, fontSize: "11px", color: d.level === DEFAULT_DIFFICULTY ? "#ffd23f" : "#67e8f9", fontStyle: "bold" }).setOrigin(1, 0);
      this.add.text(x + 62, y + 33, d.blurb, { fontFamily: FONT, fontSize: "12px", color: "#e5e7eb", wordWrap: { width: RW - 80 } });
      const mark = this.add.text(x - 14, y + 29, "▶", { fontFamily: FONT, fontSize: "20px", color: "#ffd23f" }).setOrigin(0.5).setVisible(false);
      box.on("pointerover", () => this.select(i));
      box.on("pointerdown", () => {
        // first tap picks it, a second tap on the same one starts
        if (this.sel === i) this.confirm();
        else this.select(i);
      });
      this.rows.push({ box, mark });
    });

    this.stats = this.add.text(W / 2, 400, "", { fontFamily: FONT, fontSize: "11px", color: "#cbd5e1", align: "center", wordWrap: { width: 820 } }).setOrigin(0.5, 0);
    this.add.text(W / 2, 436, DIFFICULTY_NOTE, { fontFamily: FONT, fontSize: "15px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5, 0);
    this.add.text(W / 2, 458, "↑/↓ or 1–5 to pick · ENTER / A to start · tap twice on touch", { fontFamily: FONT, fontSize: "11px", color: "#8a8fa0" }).setOrigin(0.5, 0);
    button(this, 150, H - 30, "◀ CHARACTERS", () => this.back(), { w: 200, h: 34, size: 14 });
    button(this, W - 170, H - 30, "LET'S KREZ ▶", () => this.confirm(), { w: 240, h: 38, size: 17, color: 0x7c2d12 });
    this.select(this.sel, true);

    const kb = this.input.keyboard!;
    const N = DIFFICULTY_LEVELS.length;
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
      if (n >= 1 && n <= MAX_DIFFICULTY) this.select(n - 1);
    });
  }

  update() {
    const gp = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    if (!gp) return;
    const now = gp.buttons.map((_, i) => btnDown(gp, i));
    if (!this.padPrimed) {
      // the A that picked the character doesn't also pick the difficulty
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
    const N = DIFFICULTY_LEVELS.length;
    if (hit(12) || hit(14) || stickHit === "U") this.select((this.sel + N - 1) % N);
    else if (hit(13) || hit(15) || stickHit === "D") this.select((this.sel + 1) % N);
    else if (hit(0) || hit(PAD_START)) this.confirm();
    else if (hit(1)) this.back();
  }

  private select(i: number, quiet = false) {
    if (i !== this.sel && !quiet) synth.play("select");
    this.sel = i;
    this.rows.forEach((r, j) => {
      const d = DIFFICULTY_LEVELS[j];
      r.box.setFillStyle(j === i ? 0x2d3360 : 0x1b1e33, 0.94).setStrokeStyle(j === i ? 4 : 2, d.color, j === i ? 1 : 0.55);
      r.mark.setVisible(j === i);
    });
    const d = DIFFICULTY_LEVELS[i];
    this.stats.setText(`${d.level}/${MAX_DIFFICULTY} vs the original balance:  ${difficultyStats(d)}`).setColor(hexStr(d.color));
  }

  private back() {
    if (this.going) return;
    this.going = true;
    fadeThen(this, 200, () => switchTo(this, "CharSelect", { ngPlus: this.ngPlus }));
  }

  private confirm() {
    if (this.going) return;
    this.going = true;
    synth.unlock();
    synth.play("pop");
    startNewRun(this, this.player, this.ngPlus, DIFFICULTY_LEVELS[this.sel].level);
  }
}

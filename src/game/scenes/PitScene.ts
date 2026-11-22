import Phaser from "phaser";
import { G, type PitResult } from "../G";
import { switchTo } from "../Flow";
import { synth } from "../audio/Synth";
import { backdrop } from "../gfx/HD";
import { onSkip } from "../gfx/Overlay";
import { FONT, hexStr, panel } from "../ui/theme";
import { runDialogue } from "./DialogueScene";
import { btnDown, PAD_START } from "../systems/padbinds";
import { diffFor } from "../systems/difficulty";
import { krokens } from "../systems/kreddle";
import { HEAT_TIERS, PIT_ID, PIT_NAME, pitRecord, rematchesOpen, rematchPay, REMATCH_BY_ID, runPay, type RematchDef } from "../systems/pit";
import { PIT_DEATH, PIT_DEATH_SMALL, PIT_DEATH_TITLES, PIT_HELLO, PIT_INTRO, PIT_PICK, PIT_QUIT, PIT_RANGE_DONE, PIT_RECORD, PIT_WIN } from "../../content/pit";
import type { Line } from "../../data/types";

interface Row {
  title: string;
  sub: string;
  right?: string;
  color?: number;
  disabled?: boolean;
  run: () => void;
}

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/**
 * THE KRUNCH PIT, inside (systems/pit.ts): Kev Krunch and the board. Pick the ENDLESS GAUNTLET, a REMATCH (and its
 * Heat) or the TEST RANGE; the results card comes back here after each run.
 * Keys: ↑/↓ (W/S) pick, ←/→ (A/D) Heat, ENTER / SPACE / E go, ESC back. Pad: d-pad / stick, A go, B back.
 * Mouse and touch: tap a row (a second tap on the picked one goes), tap ◀ ▶ for the Heat.
 */
export class PitScene extends Phaser.Scene {
  private view: "main" | "rematch" | "card" = "main";
  private rows: Row[] = [];
  private sel = 0;
  private scroll = 0;
  private heatIdx = 0;
  private list!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Text;
  private busy = false;
  private result: PitResult | null = null;
  private padPrev: boolean[] = [];
  private padPrimed = false;
  private stickWas = "";
  private shownAt = 0;

  constructor() {
    super("Pit");
  }

  init(data: { result?: PitResult }) {
    this.result = data?.result ?? null;
    this.view = "main";
    this.sel = 0;
    this.scroll = 0;
    this.busy = false;
    this.padPrev = [];
    this.padPrimed = false;
  }

  create() {
    const s = G.s;
    s.phase = "hub";
    this.cameras.main.fadeIn(300);
    const bg = this.add.rectangle(0, 0, 960, 540, 0x1a0606).setOrigin(0).setDepth(-20);
    if (backdrop(this, "bg_gym", { dim: 0.45, depth: -10 })) bg.setVisible(false);
    // the Pit's lighting: red, and not enough of it
    this.add.rectangle(0, 0, 960, 540, 0x7f1d1d, 0.28).setOrigin(0).setDepth(-5).setBlendMode(Phaser.BlendModes.MULTIPLY);
    const glow = this.add.ellipse(760, 470, 380, 90, 0xef4444, 0.18).setDepth(-4).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.08, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
    // the sign
    const sign = this.add.graphics().setDepth(1);
    sign.fillStyle(0x0b0b0f, 0.88).fillRoundedRect(16, 10, 400, 64, 8);
    sign.lineStyle(2, 0xef4444, 0.95).strokeRoundedRect(16, 10, 400, 64, 8);
    this.add.text(30, 14, PIT_NAME, { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#f87171", stroke: "#000", strokeThickness: 5 }).setDepth(2);
    this.add.text(31, 54, "FIGHTS NIGHTLY · NO LORE · NO REFUNDS · MIND THE TEETH", { fontFamily: FONT, fontSize: "10px", color: "#fecaca" }).setDepth(2);
    // Kev Krunch, on the apron
    if (this.textures.exists("spr_TV_ANNOUNCER")) {
      const kev = this.add.sprite(800, 420, "spr_TV_ANNOUNCER", 0).setScale(3.4 / (((this.textures.get("spr_TV_ANNOUNCER").customData as { hd?: number })?.hd) ?? 1)).setOrigin(0.5, 1).setDepth(3);
      this.tweens.add({ targets: kev, y: 416, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
      this.add.text(800, 432, "KEV KRUNCH · PROMOTER", { fontFamily: FONT, fontSize: "11px", color: "#fde68a", backgroundColor: "#000000aa", padding: { x: 5, y: 2 } }).setOrigin(0.5, 0).setDepth(3);
    }
    this.list = this.add.container(0, 0).setDepth(10);
    this.info = this.add.text(30, 500, "", { fontFamily: FONT, fontSize: "12px", color: "#fde68a", stroke: "#000", strokeThickness: 3 }).setDepth(10);
    if (!this.scene.isActive("UI")) this.scene.launch("UI", { mode: "hub" });
    synth.music("boss_arena");
    synth.ambience("dungeon");

    const kb = this.input.keyboard!;
    const onKey = (e: KeyboardEvent) => this.key(e.key);
    kb.on("keydown", onKey);
    this.events.once("shutdown", () => kb.off("keydown", onKey));
    this.events.on("resume", () => this.time.delayedCall(0, () => (this.shownAt = this.time.now)));

    void this.arrive();
  }

  /** Walking in: the card from the last run, or Kev's welcome. */
  private async arrive() {
    const s = G.s;
    const rec = pitRecord(s);
    this.busy = true;
    this.renderMain();
    await new Promise<void>((r) => this.time.delayedCall(350, () => r()));
    if (this.result) {
      await this.showCard(this.result);
      this.result = null;
    } else if (!rec.met) {
      rec.met = true;
      G.save();
      await this.talk(PIT_INTRO);
    } else await this.talk([pick(PIT_HELLO)]);
    this.busy = false;
    this.renderMain();
  }

  private talk(lines: Line[]) {
    return runDialogue(this, lines);
  }

  // ------------------------------------------------------------------ the board

  private renderMain() {
    const s = G.s;
    const rec = pitRecord(s);
    const open = rematchesOpen(s);
    const best = rec.bestWave;
    const dd = diffFor(s);
    const r10 = runPay(10, dd.rewards);
    // (a new page swallows the key that opened it)
    if (this.view !== "main") this.shownAt = this.time.now;
    this.view = "main";
    this.rows = [
      {
        title: "ENDLESS GAUNTLET",
        sub: `Waves till you drop. Every 5th is a boss you've beaten. Wave 10 banks ~${r10.coins}🪙 + kill drops.`,
        right: best ? `BEST: WAVE ${best}` : "NO RECORD YET",
        color: 0xef4444,
        run: () => void this.start("gauntlet"),
      },
      {
        title: "REMATCHES",
        sub: open.length ? `${open.length} fight${open.length > 1 ? "s" : ""} to re-run. Turn up the Heat, get paid more. Changes nothing out there.` : "Nothing to rematch yet.",
        right: open.length ? `${Object.keys(rec.rematch).length}/${open.length} WON` : "",
        color: 0xfb923c,
        disabled: !open.length,
        run: () => this.renderRematch(),
      },
      {
        title: "TEST RANGE",
        sub: "Dummies, a bell that rings up a wave, infinite ammo. Borrow ANY gun or perk. No rewards, no death.",
        right: "TRY BEFORE YOU BUY",
        color: 0x67e8f9,
        run: () => void this.start("range"),
      },
      { title: "CHAT TO KEV", sub: "He'll tell you how it works. At length.", color: 0xfde68a, run: () => void this.chat() },
      { title: "LEAVE", sub: "Back up the stairs into Krelford.", color: 0x9ca3af, run: () => this.leave() },
    ];
    this.sel = Math.min(this.sel, this.rows.length - 1);
    this.scroll = 0;
    this.drawRows("THE BOARD", "");
    this.info.setText(`🪙 ${s.coins} Krezzcoin · ${krokens(s)} Krokens   ·   made in the Pit: ${rec.earned} · runs: ${rec.runs}   ·   ${dd.name}: pay ×${dd.rewards}`);
  }

  private renderRematch() {
    const s = G.s;
    const rec = pitRecord(s);
    const open = rematchesOpen(s);
    if (!open.length) return;
    const dd = diffFor(s);
    const tier = HEAT_TIERS[this.heatIdx];
    if (this.view !== "rematch") {
      this.sel = 0;
      this.scroll = 0;
      this.shownAt = this.time.now;
    }
    this.view = "rematch";
    this.rows = open.map((r: RematchDef) => {
      const pay = rematchPay(r, tier.heat, dd.rewards);
      const won = rec.rematch[r.id];
      return {
        title: r.name,
        sub: `${r.sub} · win pays ${pay.coins}🪙${pay.krokens ? ` + ${pay.krokens} Krokens` : ""}`,
        right: won ? `BEATEN AT ×${won}` : "",
        color: tier.color,
        run: () => void this.start("rematch", r),
      };
    });
    this.rows.push({ title: "◀ BACK", sub: "The board.", color: 0x9ca3af, run: () => this.renderMain() });
    this.sel = Math.min(this.sel, this.rows.length - 1);
    this.drawRows("REMATCHES", `HEAT ×${tier.heat}  ${tier.name}`);
    this.info.setText(`←/→ (or tap ◀ ▶) sets the Heat: enemies get tougher (×${(1 + (tier.heat - 1) * 0.8).toFixed(1)} HP), the win pays more. Kill drops are halved; replays never touch the story.`);
  }

  /** Draw the rows (up to 6 on screen, scrolling to keep the picked one in view). */
  private drawRows(head: string, heat: string) {
    this.list.removeAll(true);
    const X = 24;
    const W = 560;
    const top = 92;
    const RH = 62;
    const VIS = 6;
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + VIS) this.scroll = this.sel - VIS + 1;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.list.add(o);
      return o;
    };
    add(panel(this, X - 8, top - 10, W + 16, Math.min(this.rows.length, VIS) * RH + 50, 0.9) as unknown as Phaser.GameObjects.GameObject);
    add(this.add.text(X + 6, top - 2, head, { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#fde68a" }));
    if (heat) {
      const tier = HEAT_TIERS[this.heatIdx];
      const l = add(this.add.text(X + W - 250, top - 4, "◀", { fontFamily: FONT, fontSize: "20px", color: "#ffffff" }).setInteractive({ useHandCursor: true }));
      const r = add(this.add.text(X + W - 18, top - 4, "▶", { fontFamily: FONT, fontSize: "20px", color: "#ffffff" }).setInteractive({ useHandCursor: true }));
      add(this.add.text(X + W - 134, top - 2, heat, { fontFamily: "Impact, sans-serif", fontSize: "18px", color: hexStr(tier.color) }).setOrigin(0.5, 0));
      l.on("pointerup", () => this.heat(-1));
      r.on("pointerup", () => this.heat(1));
    }
    const shown = this.rows.slice(this.scroll, this.scroll + VIS);
    shown.forEach((row, k) => {
      const i = this.scroll + k;
      const y = top + 26 + k * RH;
      const on = i === this.sel;
      const col = row.disabled ? 0x52525b : row.color ?? 0xffffff;
      const box = add(this.add.rectangle(X, y, W, RH - 6, on ? 0x3b0d0d : 0x111114, on ? 0.95 : 0.8).setOrigin(0).setStrokeStyle(on ? 3 : 1, col, on ? 1 : 0.6));
      box.setInteractive({ useHandCursor: !row.disabled });
      box.on("pointerover", () => {
        if (this.sel !== i && !this.busy) {
          this.sel = i;
          synth.play("select");
          this.redraw();
        }
      });
      box.on("pointerup", () => {
        if (this.busy) return;
        if (this.sel === i) this.choose();
        else {
          this.sel = i;
          this.redraw();
        }
      });
      if (on) add(this.add.text(X - 14, y + 14, "▶", { fontFamily: FONT, fontSize: "16px", color: "#fde047" }));
      add(this.add.text(X + 12, y + 6, row.title, { fontFamily: "Impact, sans-serif", fontSize: "19px", color: row.disabled ? "#71717a" : hexStr(col) }));
      if (row.right) add(this.add.text(X + W - 10, y + 9, row.right, { fontFamily: FONT, fontSize: "11px", color: "#fde68a", fontStyle: "bold" }).setOrigin(1, 0));
      add(this.add.text(X + 12, y + 31, row.sub, { fontFamily: FONT, fontSize: "11px", color: row.disabled ? "#71717a" : "#e5e7eb", wordWrap: { width: W - 24 } }));
    });
    if (this.scroll > 0) add(this.add.text(X + W / 2, top + 14, "▲", { fontFamily: FONT, fontSize: "12px", color: "#fde68a" }).setOrigin(0.5));
    if (this.scroll + VIS < this.rows.length) add(this.add.text(X + W / 2, top + 26 + VIS * RH - 8, "▼ more", { fontFamily: FONT, fontSize: "11px", color: "#fde68a" }).setOrigin(0.5));
  }

  private redraw() {
    if (this.view === "main") this.drawRows("THE BOARD", "");
    else if (this.view === "rematch") this.renderRematch();
  }

  // ------------------------------------------------------------------ input

  private key(k: string) {
    if (this.busy || this.sys.isPaused() || this.view === "card") return;
    const lk = k.toLowerCase();
    if (k === "ArrowUp" || lk === "w") this.move(-1);
    else if (k === "ArrowDown" || lk === "s") this.move(1);
    else if (k === "ArrowLeft" || lk === "a") this.heat(-1);
    else if (k === "ArrowRight" || lk === "d") this.heat(1);
    else if (k === "Enter" || k === " " || lk === "e") {
      if (this.time.now - this.shownAt > 250) this.choose();
    } else if (k === "Escape" || k === "Backspace") this.back();
  }

  update() {
    const gp = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    if (!gp) return;
    const now = gp.buttons.map((_, i) => btnDown(gp, i));
    if (!this.padPrimed) {
      this.padPrev = now;
      this.padPrimed = true;
      return;
    }
    const prev = this.padPrev;
    this.padPrev = now;
    if (this.busy || this.sys.isPaused() || this.view === "card") return;
    const hit = (i: number) => !!now[i] && !prev[i];
    const sx = gp.leftStick.x;
    const sy = gp.leftStick.y;
    const stick = Math.abs(sy) > 0.6 ? (sy > 0 ? "D" : "U") : Math.abs(sx) > 0.6 ? (sx > 0 ? "R" : "L") : "";
    const sh = stick && stick !== this.stickWas ? stick : "";
    this.stickWas = stick;
    if (hit(12) || sh === "U") this.move(-1);
    else if (hit(13) || sh === "D") this.move(1);
    else if (hit(14) || sh === "L") this.heat(-1);
    else if (hit(15) || sh === "R") this.heat(1);
    else if (hit(0) || hit(PAD_START)) this.choose();
    else if (hit(1)) this.back();
  }

  private move(d: number) {
    const n = this.rows.length;
    if (!n) return;
    this.sel = (this.sel + d + n) % n;
    synth.play("select");
    this.redraw();
  }

  private heat(d: number) {
    if (this.view !== "rematch") return;
    const n = HEAT_TIERS.length;
    const was = this.heatIdx;
    this.heatIdx = Math.max(0, Math.min(n - 1, this.heatIdx + d));
    if (was !== this.heatIdx) synth.play(d > 0 ? "ding" : "select");
    this.renderRematch();
  }

  private choose() {
    const row = this.rows[this.sel];
    if (!row || this.busy) return;
    if (row.disabled) {
      synth.play("tap_fail");
      return;
    }
    synth.play("pop");
    row.run();
  }

  private back() {
    if (this.view === "rematch") {
      synth.play("select");
      this.sel = 1;
      this.renderMain();
    } else this.leave();
  }

  // ------------------------------------------------------------------ going in, coming out

  private async chat() {
    this.busy = true;
    await this.talk(PIT_INTRO.slice(1));
    this.busy = false;
  }

  private async start(mode: "gauntlet" | "rematch" | "range", r?: RematchDef) {
    if (this.busy) return;
    this.busy = true;
    await this.talk(PIT_PICK[mode]);
    const heat = mode === "rematch" ? HEAT_TIERS[this.heatIdx].heat : 1;
    if (mode === "rematch" && r) G.pitBegin({ mode, rematch: r.id, heat, from: r.from, to: r.to });
    else G.pitBegin({ mode, heat: 1, from: 0, to: 0 });
    synth.play("door");
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (mode === "rematch" && r) switchTo(this, "Dungeon", { dungeon: r.dungeon, room: r.from });
      else switchTo(this, "Dungeon", { dungeon: mode === "gauntlet" ? "pit_gauntlet" : "pit_range", room: 0 });
    });
  }

  private leave() {
    if (this.busy) return;
    this.busy = true;
    synth.play("door");
    G.save();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => switchTo(this, "Hub", { at: PIT_ID, from: "pit" }));
  }

  /** The results card: what happened, what it paid, and Kev's take on it. */
  private async showCard(res: PitResult) {
    this.view = "card";
    const death = res.outcome === "death";
    const def = res.rematch ? REMATCH_BY_ID[res.rematch] : undefined;
    const head =
      res.mode === "range" ? "RANGE CLOSED" : death ? pick(PIT_DEATH_TITLES) : res.outcome === "win" ? (res.mode === "rematch" ? "REMATCH WON" : "DONE") : res.mode === "rematch" ? "FORFEITED" : "BANKED";
    const lines: string[] = [];
    if (res.mode === "gauntlet") lines.push(`Waves cleared: ${res.waves ?? 0}${res.newBest ? "   ★ NEW BEST ★" : `   (best: ${pitRecord(G.s).bestWave})`}`);
    if (res.mode === "rematch" && def) lines.push(`${def.name} · HEAT ×${res.heat}${res.newBest && res.outcome === "win" ? "   ★ HOTTEST YET ★" : ""}`);
    if (res.cause) lines.push(`Cause: ${res.cause}`);
    if (res.mode !== "range") lines.push(`Earned: +${res.earned.coins} Krezzcoin${res.earned.krokens ? ` · +${res.earned.krokens} Krokens` : ""}`);
    else lines.push("Every loaner's back on the rack. Your kit is exactly as you left it.");
    if (death) lines.push(pick(PIT_DEATH_SMALL));
    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(0, 0, 960, 540, 0x000000, 0.6).setOrigin(0);
    const box = this.add.rectangle(480, 220, 640, 250, 0x12060a, 0.97).setStrokeStyle(4, death ? 0xef4444 : 0xfacc15);
    const t = this.add.text(480, 130, head, { fontFamily: "Impact, sans-serif", fontSize: "48px", color: death ? "#ef4444" : "#facc15", stroke: "#000", strokeThickness: 7 }).setOrigin(0.5);
    const body = this.add.text(480, 236, lines.join("\n"), { fontFamily: FONT, fontSize: "16px", color: "#ffffff", align: "center", lineSpacing: 8, wordWrap: { width: 600 } }).setOrigin(0.5);
    c.add([dim, box, t, body]);
    t.setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.out" });
    synth.play(death ? "trombone" : "perfect");
    const hint = this.add.text(480, 326, "▶ any key · A · tap", { fontFamily: FONT, fontSize: "12px", color: "#94a3b8" }).setOrigin(0.5);
    c.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });
    // read it, then Kev has his say (the dialogue box dims everything behind it)
    await new Promise<void>((r) => {
      const off = onSkip(this, 600, () => {
        off();
        r();
      });
      this.time.delayedCall(9000, () => {
        off();
        r();
      });
    });
    this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
    const quip: Line[] = res.mode === "range" ? PIT_RANGE_DONE : death ? [pick(PIT_DEATH)] : res.outcome === "win" ? [pick(PIT_WIN)] : PIT_QUIT;
    await this.talk(res.newBest ? [...quip, ...PIT_RECORD] : quip);
    this.view = "main";
  }
}

import Phaser from "phaser";
import { G } from "../G";
import { button, FONT, panel, title, UI } from "../ui/theme";
import { synth } from "../audio/Synth";
import { continueRun } from "../Flow";
import { portraitKey } from "../gfx/Textures";
import { btnDown } from "../systems/padbinds";
import { slotLabel, type SlotId, type SlotSummary } from "../systems/saveSlots";

type Mode = "load" | "save";

const ROW_W = 700;
const ROW_H = 88;
const ROW_Y0 = 138;
const ROW_GAP = 94;

/**
 * The save-slot list: LOAD GAME from the title (AUTO + SLOT 1-3, pick one to play) and SAVE GAME from the pause
 * menu (pick SLOT 1-3, overwrite asks first). Each slot shows who, which chapter, where, the objective, difficulty,
 * NEW KREZ+, playtime, coins and when it was saved. Keys: ↑↓ choose, Enter load/save, Delete delete, Esc back.
 * Mouse and touch: tap a slot, 🗑 deletes. Pad: d-pad, A, B back, X/Y delete.
 */
export class SaveSlotsScene extends Phaser.Scene {
  private mode: Mode = "load";
  private caller = "";
  private root!: Phaser.GameObjects.Container;
  private rows: { id: SlotId; sum: SlotSummary; usable: boolean; bg: Phaser.GameObjects.Rectangle }[] = [];
  private sel = 0;
  private confirm: { box: Phaser.GameObjects.Container; yes: () => void; choice: 0 | 1; btns: Phaser.GameObjects.Container[] } | null = null;
  private deleted = false;
  private busy = false;
  private padPrev: boolean[] = [];
  private padPrimed = false;
  private stickWas = "";

  constructor() {
    super("Slots");
  }

  create(data: { mode?: Mode; caller?: string }) {
    this.mode = data?.mode === "save" ? "save" : "load";
    this.caller = data?.caller ?? "";
    this.deleted = false;
    this.busy = false;
    this.confirm = null;
    this.padPrimed = false;
    this.scene.bringToTop();
    // the screen underneath stops listening while we're up
    if (this.caller === "Menu") this.scene.pause("Menu");
    else if (this.caller) {
      const under = this.scene.get(this.caller);
      if (under?.input) under.input.enabled = false;
      if (under?.input?.keyboard) under.input.keyboard.enabled = false;
    }
    this.root = this.add.container(0, 0);
    const onKey = (e: KeyboardEvent) => this.key(e);
    this.input.keyboard?.on("keydown", onKey);
    this.events.once("shutdown", () => this.input.keyboard?.off("keydown", onKey));
    this.render(true);
  }

  // ------------------------------------------------------------------ drawing

  private render(pickDefault = false) {
    this.root.removeAll(true);
    this.rows = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.root.add(o), o);
    add(this.add.rectangle(0, 0, 960, 540, 0x000000, 0.78).setOrigin(0).setInteractive());
    add(panel(this, 100, 24, 760, 492));
    add(title(this, 480, 54, this.mode === "load" ? "LOAD GAME" : "SAVE GAME", 26));
    const hint = this.mode === "load"
      ? "↑↓ choose · Enter load · Del delete · Esc back   (tap a slot to load it)"
      : "Pick a slot to save to. AUTO saves itself as you play.   ↑↓ · Enter · Del · Esc";
    add(this.add.text(480, 80, hint, { fontFamily: FONT, fontSize: "12px", color: UI.dim }).setOrigin(0.5));
    const sums = G.saves.summaries();
    sums.forEach((sum, i) => {
      const usable = this.mode === "load" ? !sum.empty : sum.id !== "auto";
      this.drawRow(sum, i, usable);
    });
    if (pickDefault) {
      // load: the newest save; save: the first empty slot (else slot 1)
      const latest = G.saves.latest();
      const want = this.mode === "load" ? this.rows.findIndex((r) => r.id === latest) : this.rows.findIndex((r) => r.usable && r.sum.empty);
      this.sel = want >= 0 ? want : Math.max(0, this.rows.findIndex((r) => r.usable));
    }
    if (!this.rows[this.sel]?.usable) this.sel = Math.max(0, this.rows.findIndex((r) => r.usable));
    add(button(this, 480, 492, "◀ BACK", () => this.close(false), { w: 170, h: 30, size: 14 }));
    this.highlight();
  }

  private drawRow(sum: SlotSummary, i: number, usable: boolean) {
    const x = 480;
    const y = ROW_Y0 + i * ROW_GAP;
    const left = x - ROW_W / 2;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.root.add(o), o);
    const bg = add(this.add.rectangle(x, y, ROW_W, ROW_H, sum.empty ? 0x161827 : UI.panel2, usable ? 0.96 : 0.6).setStrokeStyle(2, 0x3b3f6b));
    const tagCol = sum.id === "auto" ? "#7dd3fc" : "#ffd23f";
    if (sum.empty) {
      add(this.add.text(left + 18, y, slotLabel(sum.id), { fontFamily: FONT, fontSize: "16px", color: tagCol, fontStyle: "bold" }).setOrigin(0, 0.5));
      add(this.add.text(x, y, sum.id === "auto" ? "EMPTY · fills itself as you play" : "EMPTY", { fontFamily: FONT, fontSize: "15px", color: "#6d6a85", fontStyle: "bold" }).setOrigin(0.5));
    } else {
      const pk = sum.player ? portraitKey(this, sum.player) : null;
      if (pk) add(this.add.image(left + 44, y, pk).setDisplaySize(64, 64));
      else add(this.add.rectangle(left + 44, y, 64, 64, 0x2a2d55));
      add(this.add.rectangle(left + 44, y, 66, 66).setStrokeStyle(2, 0x000000, 0.6));
      const tx = left + 88;
      const tag = add(this.add.text(tx, y - 40, sum.label, { fontFamily: FONT, fontSize: "14px", color: tagCol, fontStyle: "bold" }));
      add(this.add.text(tx + tag.width + 10, y - 40, sum.playerName ?? "", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold" }));
      add(this.add.text(left + ROW_W - 16, y - 40, sum.savedText ? `Saved ${sum.savedText}` : "", { fontFamily: FONT, fontSize: "11px", color: UI.dim }).setOrigin(1, 0));
      add(this.add.text(tx, y - 22, sum.chapterLine ?? "", { fontFamily: FONT, fontSize: "13px", color: "#ffd23f", fontStyle: "bold" }));
      add(this.add.text(tx, y - 5, `📍 ${sum.where ?? "Krelford"}`, { fontFamily: FONT, fontSize: "12px", color: "#e2e8f0" }));
      const obj = sum.objective ? (sum.objective.length > 92 ? sum.objective.slice(0, 90) + "…" : sum.objective) : "";
      add(this.add.text(tx, y + 11, obj ? `▸ ${obj}` : "", { fontFamily: FONT, fontSize: "11px", color: "#a5b4fc", fontStyle: "italic" }));
      const bits = [sum.difficultyText, sum.ngPlus ? `NEW KREZ+${sum.ngPlus > 1 ? sum.ngPlus : ""}` : "", `⏱ ${sum.playtime}`, `💰 ${(sum.coins ?? 0).toLocaleString("en-GB")}`].filter(Boolean);
      add(this.add.text(tx, y + 27, bits.join("  ·  "), { fontFamily: FONT, fontSize: "11px", color: UI.dim }));
      // 🗑 (not on AUTO while you're mid-run: it's the run you're playing)
      if (this.mode === "load" || sum.id !== "auto") {
        const del = add(button(this, left + ROW_W - 30, y + 24, "🗑", () => this.askDelete(i), { w: 40, h: 28, size: 13, color: 0x5b1a1a }));
        (del as any).isDelete = true;
      }
    }
    if (usable) {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => {
        if (this.confirm || this.sel === i) return;
        this.sel = i;
        synth.play("select");
        this.highlight();
      });
      bg.on("pointerup", () => {
        if (this.confirm) return;
        synth.unlock();
        this.sel = i;
        this.activate();
      });
    }
    this.rows.push({ id: sum.id, sum, usable, bg });
  }

  private highlight() {
    this.rows.forEach((r, i) => {
      const on = i === this.sel && r.usable;
      r.bg.setStrokeStyle(on ? 3 : 2, on ? UI.accent : 0x3b3f6b);
      r.bg.setFillStyle(on ? 0x2b3170 : r.sum.empty ? 0x161827 : UI.panel2, r.usable ? 0.96 : 0.6);
    });
  }

  // ------------------------------------------------------------------ actions

  private activate() {
    const r = this.rows[this.sel];
    if (!r || !r.usable || this.busy) return;
    if (this.mode === "load") return this.loadSlot(r.id);
    const slot = r.id as 1 | 2 | 3;
    if (r.sum.empty) this.saveSlot(slot);
    else this.ask(`Overwrite ${slotLabel(slot)}?\n${r.sum.playerName} · ${r.sum.chapterLine} · ⏱ ${r.sum.playtime}`, "OVERWRITE", () => this.saveSlot(slot));
  }

  private loadSlot(id: SlotId) {
    this.busy = true;
    synth.play("ding");
    const from = this.scene.get(this.caller || "Title") ?? this;
    if (from.input) from.input.enabled = true;
    if (from.input?.keyboard) from.input.keyboard.enabled = true;
    if (!continueRun(from, id)) {
      this.busy = false;
      synth.play("tap_fail");
      this.render();
    }
  }

  private saveSlot(slot: 1 | 2 | 3) {
    this.busy = true;
    G.saveToSlot(slot);
    synth.play("ding");
    G.emit("toast", { title: `SAVED TO ${slotLabel(slot)}`, text: "Game saved. The wiki has also been updated, at some point." });
    this.render();
    const i = this.rows.findIndex((r) => r.id === slot);
    if (i >= 0) {
      this.sel = i;
      this.highlight();
      const r = this.rows[i];
      const t = this.add.text(r.bg.x, r.bg.y, "SAVED ✓", { fontFamily: FONT, fontSize: "26px", color: "#4ade80", fontStyle: "bold", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
      this.root.add(t);
    }
    this.time.delayedCall(700, () => this.close(true));
  }

  private askDelete(i: number) {
    const r = this.rows[i];
    if (!r || r.sum.empty || this.busy) return;
    if (this.mode === "save" && r.id === "auto") return;
    this.sel = i;
    this.highlight();
    this.ask(`Delete ${slotLabel(r.id)}?\n${r.sum.playerName} · ${r.sum.chapterLine} · ⏱ ${r.sum.playtime}\nThis can't be undone.`, "DELETE", () => {
      G.saves.clear(r.id);
      this.deleted = true;
      synth.play("pop");
      this.render();
    });
  }

  /** A yes/no box over the list. ←→ choose, Enter, Y / N, Esc = no. */
  private ask(text: string, yesLabel: string, yes: () => void) {
    this.closeConfirm();
    const box = this.add.container(0, 0);
    box.add(this.add.rectangle(0, 0, 960, 540, 0x000000, 0.55).setOrigin(0).setInteractive());
    box.add(panel(this, 230, 180, 500, 180));
    box.add(this.add.text(480, 236, text, { fontFamily: FONT, fontSize: "15px", color: "#ffffff", align: "center", fontStyle: "bold", wordWrap: { width: 460 } }).setOrigin(0.5));
    const b1 = button(this, 395, 318, yesLabel, () => this.answer(true), { w: 150, h: 34, size: 15, color: 0x7f1d1d });
    const b2 = button(this, 565, 318, "CANCEL", () => this.answer(false), { w: 150, h: 34, size: 15 });
    box.add([b1, b2]);
    this.confirm = { box, yes, choice: 1, btns: [b1, b2] };
    this.confirmFocus();
  }

  private confirmFocus() {
    if (!this.confirm) return;
    this.confirm.btns.forEach((b, i) => ((b as any).label as Phaser.GameObjects.Text).setColor(i === this.confirm!.choice ? "#ffd23f" : "#ffffff"));
  }

  private answer(yes: boolean) {
    const c = this.confirm;
    if (!c) return;
    this.closeConfirm();
    if (yes) c.yes();
    else synth.play("select");
  }

  private closeConfirm() {
    this.confirm?.box.destroy(true);
    this.confirm = null;
  }

  private close(saved: boolean) {
    if (this.busy && !saved) return;
    if (this.caller === "Menu") {
      this.scene.resume("Menu");
      this.scene.get("Menu").events.emit("slots-closed", { saved });
    } else if (this.caller) {
      const under = this.scene.get(this.caller);
      if (under?.input) under.input.enabled = true;
      if (under?.input?.keyboard) under.input.keyboard.enabled = true;
      // the title's CONTINUE / LOAD buttons follow what's left
      if (this.deleted && this.caller === "Title") under.scene.restart();
    }
    this.scene.stop();
  }

  // ------------------------------------------------------------------ input

  private move(d: number) {
    if (!this.rows.length) return;
    for (let k = 1; k <= this.rows.length; k++) {
      const j = (this.sel + d * k + this.rows.length * 4) % this.rows.length;
      if (this.rows[j].usable) {
        this.sel = j;
        synth.play("select");
        break;
      }
    }
    this.highlight();
  }

  private key(e: KeyboardEvent) {
    if (this.busy) return;
    const k = e.code;
    if (this.confirm) {
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "KeyA" || k === "KeyD" || k === "Tab") {
        e.preventDefault?.();
        this.confirm.choice = this.confirm.choice ? 0 : 1;
        this.confirmFocus();
      } else if (k === "Enter" || k === "NumpadEnter" || k === "Space" || k === "KeyE") this.answer(this.confirm.choice === 0);
      else if (k === "KeyY") this.answer(true);
      else if (k === "KeyN" || k === "Escape" || k === "Backspace") this.answer(false);
      return;
    }
    if (k === "ArrowUp" || k === "KeyW") this.move(-1);
    else if (k === "ArrowDown" || k === "KeyS") this.move(1);
    else if (k === "Enter" || k === "NumpadEnter" || k === "Space" || k === "KeyE") this.activate();
    else if (k === "Delete" || k === "Backspace" || k === "KeyX") this.askDelete(this.sel);
    else if (k === "Escape") this.close(false);
  }

  update() {
    const gp = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    if (!gp || this.busy) return;
    const now = gp.buttons.map((_, i) => btnDown(gp, i));
    if (!this.padPrimed) {
      this.padPrev = now;
      this.padPrimed = true;
      return;
    }
    const prev = this.padPrev;
    this.padPrev = now;
    const hit = (i: number) => !!now[i] && !prev[i];
    const sx = gp.leftStick.x;
    const sy = gp.leftStick.y;
    const stick = Math.abs(sx) > 0.6 || Math.abs(sy) > 0.6 ? (Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? "R" : "L") : sy > 0 ? "D" : "U") : "";
    const sh = stick && stick !== this.stickWas ? stick : "";
    this.stickWas = stick;
    if (this.confirm) {
      if (hit(14) || hit(15) || sh === "L" || sh === "R") {
        this.confirm.choice = this.confirm.choice ? 0 : 1;
        this.confirmFocus();
      } else if (hit(0)) this.answer(this.confirm.choice === 0);
      else if (hit(1)) this.answer(false);
      return;
    }
    if (hit(12) || sh === "U") this.move(-1);
    else if (hit(13) || sh === "D") this.move(1);
    else if (hit(0)) this.activate();
    else if (hit(2) || hit(3)) this.askDelete(this.sel);
    else if (hit(1)) this.close(false);
  }
}

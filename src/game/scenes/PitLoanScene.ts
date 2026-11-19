import Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { FONT, hexStr } from "../ui/theme";
import { btnDown, PAD_START } from "../systems/padbinds";
import { equipBest, fitTo, GUNS, gunMax } from "../combat/Guns";
import { loanableGuns, loanablePerks } from "../systems/pit";
import { shopIcon } from "../ui/shop";

interface Item {
  kind: "gun" | "perk";
  id: string;
  name: string;
  desc: string;
  icon: string;
  max: number;
}

/**
 * The test range's LOANER RACK (over the Dungeon scene, which is paused): borrow any gun or perk in the game. Loans
 * live only in the practice run; G.pitEnd() puts your kit back exactly as it was (systems/pit.ts settlePractice).
 * Keys: ←/→ tab, ↑/↓ pick, ENTER / SPACE / E borrow or hand back, ESC done. Pad: d-pad, A, B. Mouse / touch: tap.
 */
export class PitLoanScene extends Phaser.Scene {
  private caller = "Dungeon";
  private tab: "gun" | "perk" = "gun";
  private sel = 0;
  private scroll = 0;
  private root!: Phaser.GameObjects.Container;
  private padPrev: boolean[] = [];
  private padPrimed = false;
  private stickWas = "";
  private openedAt = 0;

  constructor() {
    super("PitLoan");
  }

  create(data: { caller?: string }) {
    this.caller = data?.caller ?? "Dungeon";
    this.sel = 0;
    this.scroll = 0;
    this.padPrimed = false;
    this.openedAt = this.time.now;
    this.add.rectangle(0, 0, 960, 540, 0x05010c, 0.78).setOrigin(0).setInteractive();
    this.root = this.add.container(0, 0);
    const kb = this.input.keyboard!;
    const onKey = (e: KeyboardEvent) => this.key(e.key);
    kb.on("keydown", onKey);
    this.events.once("shutdown", () => kb.off("keydown", onKey));
    this.render();
  }

  private items(): Item[] {
    if (this.tab === "gun") return loanableGuns().map((id) => ({ kind: "gun", id, name: GUNS[id].name, desc: GUNS[id].blurb, icon: GUNS[id].tex, max: 1 }));
    return loanablePerks().map((p) => ({ kind: "perk", id: p.key, name: p.name, desc: p.desc, icon: p.icon, max: p.max }));
  }

  /** Whether you own it for real (in the run you walked in with), and whether it's on loan now. */
  private status(it: Item): { mine: number; now: number } {
    const s = G.s;
    const snap = G.rt.pit?.snap;
    if (it.kind === "gun") return { mine: snap?.guns && it.id in snap.guns ? 1 : 0, now: s.guns && it.id in s.guns ? 1 : 0 };
    return { mine: snap?.upgrades?.[it.id] ?? 0, now: s.upgrades[it.id] ?? 0 };
  }

  private render() {
    this.root.removeAll(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.root.add(o);
      return o;
    };
    add(this.add.text(480, 30, "THE LOANER RACK", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#67e8f9", stroke: "#001018", strokeThickness: 6 }).setOrigin(0.5));
    add(this.add.text(480, 60, "Borrow anything. It all goes back on the rack when you leave the range (Kev's counting).", { fontFamily: FONT, fontSize: "12px", color: "#cbd5e1" }).setOrigin(0.5));
    // tabs
    (["gun", "perk"] as const).forEach((t, i) => {
      const x = 380 + i * 200;
      const on = this.tab === t;
      const b = add(this.add.rectangle(x, 92, 180, 30, on ? 0x0e7490 : 0x111827, 0.95).setStrokeStyle(2, 0x67e8f9, on ? 1 : 0.4).setInteractive({ useHandCursor: true }));
      add(this.add.text(x, 92, t === "gun" ? "GUNS" : "PERKS", { fontFamily: "Impact, sans-serif", fontSize: "17px", color: on ? "#ffffff" : "#94a3b8" }).setOrigin(0.5));
      b.on("pointerup", () => this.setTab(t));
    });
    const list = this.items();
    this.sel = Math.min(this.sel, list.length - 1);
    const VIS = 6;
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + VIS) this.scroll = this.sel - VIS + 1;
    list.slice(this.scroll, this.scroll + VIS).forEach((it, k) => {
      const i = this.scroll + k;
      const y = 126 + k * 50;
      const on = i === this.sel;
      const st = this.status(it);
      const loaned = it.kind === "gun" ? st.now > 0 && !st.mine : st.now > st.mine;
      const owned = it.kind === "gun" ? st.mine > 0 : st.mine >= it.max;
      const col = loaned ? 0xfacc15 : owned ? 0x86efac : 0x64748b;
      const box = add(this.add.rectangle(160, y, 640, 44, on ? 0x0b2a3a : 0x0b1020, 0.95).setOrigin(0).setStrokeStyle(on ? 3 : 1, col, on ? 1 : 0.6).setInteractive({ useHandCursor: true }));
      box.on("pointerover", () => {
        if (this.sel !== i) {
          this.sel = i;
          this.render();
        }
      });
      box.on("pointerup", () => {
        if (this.sel === i) this.toggle();
        else {
          this.sel = i;
          this.render();
        }
      });
      if (it.kind === "gun" && this.textures.exists(it.icon)) add(fitTo(this.add.image(186, y + 22, it.icon), 34));
      else add(shopIcon(this, 186, y + 22, it.icon, 30) as Phaser.GameObjects.GameObject);
      add(this.add.text(212, y + 4, it.name.toUpperCase(), { fontFamily: "Impact, sans-serif", fontSize: "16px", color: hexStr(col === 0x64748b ? 0xffffff : col) }));
      add(this.add.text(212, y + 24, it.desc, { fontFamily: FONT, fontSize: "10px", color: "#cbd5e1", wordWrap: { width: 470 } }).setCrop(0, 0, 470, 18));
      const tag = it.kind === "gun" ? (owned ? "YOURS" : loaned ? "ON LOAN" : "BORROW") : loaned ? `ON LOAN (LV ${st.now})` : owned ? "YOURS (MAXED)" : st.mine ? `YOURS LV ${st.mine}/${it.max} · BORROW MAX` : "BORROW";
      add(this.add.text(790, y + 14, tag, { fontFamily: FONT, fontSize: "12px", color: hexStr(col === 0x64748b ? 0x67e8f9 : col), fontStyle: "bold" }).setOrigin(1, 0));
    });
    if (this.scroll > 0) add(this.add.text(480, 116, "▲", { fontFamily: FONT, fontSize: "12px", color: "#67e8f9" }).setOrigin(0.5));
    if (this.scroll + VIS < list.length) add(this.add.text(480, 126 + VIS * 50 + 4, "▼ more", { fontFamily: FONT, fontSize: "11px", color: "#67e8f9" }).setOrigin(0.5));
    const done = add(this.add.rectangle(480, 500, 220, 36, 0x7f1d1d, 0.95).setStrokeStyle(2, 0xfca5a5).setInteractive({ useHandCursor: true }));
    add(this.add.text(480, 500, "DONE (ESC)", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ffffff" }).setOrigin(0.5));
    done.on("pointerup", () => this.close());
    add(this.add.text(480, 460, "←/→ tabs · ↑/↓ pick · ENTER borrow / hand back · tap twice on touch", { fontFamily: FONT, fontSize: "11px", color: "#94a3b8" }).setOrigin(0.5));
  }

  private setTab(t: "gun" | "perk") {
    if (this.tab === t) return;
    this.tab = t;
    this.sel = 0;
    this.scroll = 0;
    synth.play("select");
    this.render();
  }

  /** Borrow it (top level), or hand it back (to what you really have). Owned guns just go in your hand. */
  private toggle() {
    const s = G.s;
    const it = this.items()[this.sel];
    if (!it || !G.rt.pit) return;
    const st = this.status(it);
    if (it.kind === "gun") {
      s.guns ??= {};
      if (st.mine || !st.now) {
        s.guns[it.id] = gunMax(GUNS[it.id], s);
        s.gun = it.id;
        G.rt.fartByChoice = false;
        synth.play("gunget");
      } else {
        delete s.guns[it.id];
        if (s.gun === it.id) equipBest(s);
        synth.play("select");
      }
    } else if (st.now > st.mine) {
      if (st.mine) s.upgrades[it.id] = st.mine;
      else delete s.upgrades[it.id];
      synth.play("select");
    } else if (st.mine < it.max) {
      s.upgrades[it.id] = it.max;
      synth.play("gunget");
    } else synth.play("tap_fail");
    this.render();
  }

  private key(k: string) {
    const lk = k.toLowerCase();
    if (k === "ArrowUp" || lk === "w") this.move(-1);
    else if (k === "ArrowDown" || lk === "s") this.move(1);
    else if (k === "ArrowLeft" || lk === "a") this.setTab("gun");
    else if (k === "ArrowRight" || lk === "d") this.setTab("perk");
    else if (k === "Enter" || k === " " || lk === "e") {
      if (this.time.now - this.openedAt > 250) this.toggle();
    } else if (k === "Escape" || k === "Backspace" || lk === "q") this.close();
  }

  private move(d: number) {
    const n = this.items().length;
    this.sel = (this.sel + d + n) % n;
    synth.play("select");
    this.render();
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
    const hit = (i: number) => !!now[i] && !prev[i];
    const sy = gp.leftStick.y;
    const sx = gp.leftStick.x;
    const stick = Math.abs(sy) > 0.6 ? (sy > 0 ? "D" : "U") : Math.abs(sx) > 0.6 ? (sx > 0 ? "R" : "L") : "";
    const sh = stick && stick !== this.stickWas ? stick : "";
    this.stickWas = stick;
    if (hit(12) || sh === "U") this.move(-1);
    else if (hit(13) || sh === "D") this.move(1);
    else if (hit(14) || sh === "L") this.setTab("gun");
    else if (hit(15) || sh === "R") this.setTab("perk");
    else if (hit(0)) this.toggle();
    else if (hit(1) || hit(PAD_START)) this.close();
  }

  private close() {
    synth.play("select");
    const caller = this.scene.get(this.caller);
    if (this.scene.isPaused(this.caller)) {
      this.scene.resume(this.caller);
      caller.events.emit("ui-resume");
    }
    this.scene.stop();
  }
}

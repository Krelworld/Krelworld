import { keysFor, prettyKey } from "../systems/keybinds";
import { currentGun, ownedGuns, gunMax } from "../combat/Guns";
import { superMs } from "../combat/Super";
import { fartLevel, fartMeter } from "../combat/Farts";
import Phaser from "phaser";
import { G } from "../G";
import { maxHp, maxKrezz, maxBottles, intoxLabel } from "../systems/stats";
import { FONT, UI } from "../ui/theme";
import { portraitKey } from "../gfx/Textures";
import { CHARACTERS } from "../../data/characters";
import { currentStep } from "../Flow";
import { resentmentLabel } from "../systems/reactions";
import { synth } from "../audio/Synth";
import { TouchControls, isTouchDevice } from "../ui/TouchControls";
import { ammoLabel, weaponIcon, weaponList } from "../ui/weapons";
import { DRONGUS_STATUSES } from "../../content/dialogue/drongusStatuses";
import { playerFace, sanmikActive } from "../systems/sanmik";
import type { ShieldHud } from "../combat/BossShield";

interface Toast {
  c: Phaser.GameObjects.Container;
  until: number;
}

export class UIScene extends Phaser.Scene {
  private mode: "hub" | "dungeon" = "hub";
  private g!: Phaser.GameObjects.Graphics;
  private nameT!: Phaser.GameObjects.Text;
  private statT!: Phaser.GameObjects.Text;
  private fartT!: Phaser.GameObjects.Text;
  private wonkChip!: Phaser.GameObjects.Text;
  private fartChip!: Phaser.GameObjects.Text;
  private roomT!: Phaser.GameObjects.Text;
  private objT!: Phaser.GameObjects.Text;
  private lastObjective = "";
  private objCard: Phaser.GameObjects.Container | null = null;

  /** A big, central "NEW OBJECTIVE" card that slides in, sits for a few seconds and fades. */
  private popObjective(text: string) {
    this.objCard?.destroy();
    const c = this.add.container(480, 150).setDepth(900);
    const body = this.add.text(0, 14, text, { fontFamily: FONT, fontSize: "16px", color: "#ffffff", align: "center", wordWrap: { width: 560 }, lineSpacing: 3 }).setOrigin(0.5, 0);
    const h = body.height + 46;
    const bg = this.add.rectangle(0, h / 2 - 8, Math.min(620, Math.max(360, body.width + 60)), h, 0x0b0820, 0.88).setStrokeStyle(2, 0xffd23f);
    const head = this.add.text(0, -2, "★ NEW OBJECTIVE ★", { fontFamily: FONT, fontSize: "13px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    c.add([bg, head, body]);
    c.setAlpha(0).setScale(0.85);
    this.objCard = c;
    synth.play("notify");
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 260, ease: "Back.out" });
    this.tweens.add({ targets: c, alpha: 0, y: 130, delay: 4200, duration: 600, onComplete: () => { if (this.objCard === c) this.objCard = null; c.destroy(); } });
  }
  private ruleT!: Phaser.GameObjects.Text;
  private bossT!: Phaser.GameObjects.Text;
  private wonkT!: Phaser.GameObjects.Text;
  private hpT!: Phaser.GameObjects.Text;
  private kzT!: Phaser.GameObjects.Text;
  private timerT!: Phaser.GameObjects.Text;
  private toasts: Toast[] = [];
  private boss: { name: string; hp: number; max: number; shielded: boolean; shield?: ShieldHud } | null = null;
  private rule: string | null = null;
  private conflictUntil = 0;
  private rename: string | null = null;
  private renameUntil = 0;
  private off: (() => void) | null = null;
  private labels = ["HP", "KREZZ", "WONK"];
  private touch: TouchControls | null = null;

  constructor() {
    super("UI");
  }

  create(data: { mode?: "hub" | "dungeon" }) {
    this.mode = data?.mode ?? "hub";
    this.toasts = [];
    // the scene object outlives a restart: drop texts from the last run (they were destroyed with it)
    this.tray = [];
    this.popPrompt = null;
    this.boss = null;
    this.rule = null;
    this.g = this.add.graphics();
    // every couple of minutes, one of Drongus's old Facebook statuses resurfaces
    // about three every two minutes (one every 34-46s), each status as likely as any other (a shuffled deck, no repeats till it runs out)
    if (!G.rt.nextStatusAt) G.rt.nextStatusAt = Date.now() + 20000 + Math.random() * 15000;
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!DRONGUS_STATUSES.length || !G.s.flags.met_emergency || this.mode !== "hub" || Date.now() < G.rt.nextStatusAt) return;
        // not over a conversation, the telly or a menu (they dim the screen over the HUD, so it'd come up greyed out)
        if (["Dialogue", "TV", "Menu", "Meeting", "Cutscene", "Vignette"].some((k) => this.scene.isActive(k)) || this.scene.isPaused("Hub")) return;
        G.rt.nextStatusAt = Date.now() + 34000 + Math.random() * 12000;
        if (!G.rt.statusDeck.length) G.rt.statusDeck = Phaser.Utils.Array.Shuffle(DRONGUS_STATUSES.map((_, i) => i));
        const st = DRONGUS_STATUSES[G.rt.statusDeck.pop()!];
        this.onEvent("fbstatus", { text: st.t, year: st.y });
      },
    });
    // the Krezzcoin symbol: a little gold K coin (used instead of the word)
    if (!this.textures.exists("ico_coin")) {
      const c = this.textures.createCanvas("ico_coin", 32, 32);
      if (c) {
        const x = c.getContext();
        x.fillStyle = "#8a5a00";
        x.beginPath();
        x.arc(16, 17, 14, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = "#ffd23f";
        x.beginPath();
        x.arc(16, 15, 14, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#fff4a8";
        x.lineWidth = 2;
        x.beginPath();
        x.arc(16, 15, 10, 0, Math.PI * 2);
        x.stroke();
        x.fillStyle = "#8a5a00";
        x.font = "bold 15px sans-serif";
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText("K", 16, 16);
        c.refresh();
      }
    }
    this.coinIco = this.add.image(0, 0, "ico_coin").setDisplaySize(16, 16).setOrigin(0, 0.5);
    this.coinT = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "14px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0, 0.5).setShadow(1, 1, "#000", 0);
    this.face = playerFace(G.s);
    const pk = portraitKey(this, this.face);
    if (pk) this.faceImg = this.add.image(34, 34, pk).setDisplaySize(52, 52);
    this.add.rectangle(34, 34, 54, 54).setStrokeStyle(2, CHARACTERS[G.s.player].color);
    this.nameT = this.add.text(68, 6, "", { fontFamily: FONT, fontSize: "13px", color: "#ffd23f", fontStyle: "bold" }).setShadow(1, 1, "#000", 0);
    this.statT = this.add.text(12, 66, "", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", lineSpacing: 2 }).setShadow(1, 1, "#000", 0);
    this.roomT = this.add.text(455, 6, "", { fontFamily: FONT, fontSize: "12px", color: "#c9c3e6" }).setOrigin(0.5, 0).setShadow(1, 1, "#000", 0);
    this.objT = this.add.text(455, 22, "", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 6, y: 2 }, wordWrap: { width: 360 }, align: "center" }).setOrigin(0.5, 0);
    this.ruleT = this.add.text(480, 70, "", { fontFamily: FONT, fontSize: "12px", color: "#ff8888", fontStyle: "bold", align: "center" }).setOrigin(0.5, 0).setShadow(1, 1, "#000", 0);
    this.bossT = this.add.text(480, 494, "", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setShadow(2, 2, "#000", 0);
    this.hpT = this.add.text(70, 22, "", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", fontStyle: "bold" }).setDepth(5).setShadow(1, 1, "#000", 0);
    this.kzT = this.add.text(70, 37, "", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", fontStyle: "bold" }).setDepth(5).setShadow(1, 1, "#000", 0);
    this.wonkT = this.add.text(70, 52, "", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", fontStyle: "bold" }).setShadow(1, 1, "#000", 0);
    this.fartT = this.add.text(70, 68, "", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", fontStyle: "bold" }).setShadow(1, 1, "#000", 0);
    this.wonkChip = this.add.text(262, 52, "", { fontFamily: FONT, fontSize: "10px", color: "#111111", fontStyle: "bold", backgroundColor: "#ffd23f", padding: { x: 5, y: 1 } }).setVisible(false);
    this.fartChip = this.add.text(262, 68, "", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#3f6212", padding: { x: 5, y: 1 } }).setVisible(false);
    this.timerT = this.add.text(480, 96, "", { fontFamily: FONT, fontSize: "22px", color: "#ff4d4d", fontStyle: "bold", backgroundColor: "#000000aa", padding: { x: 8, y: 3 } }).setOrigin(0.5, 0).setDepth(50).setVisible(false);
    this.off = G.on((ev, d) => this.onEvent(ev, d));
    this.events.off("mode");
    this.events.on("mode", (m: "hub" | "dungeon") => {
      this.mode = m;
      this.setupTouch();
    });
    this.setupTouch();
    this.events.once("shutdown", () => {
      this.touch?.destroy();
      this.touch = null;
    });
    this.events.once("shutdown", () => this.off?.());
  }

  private setupTouch() {
    if (!isTouchDevice(this.game)) return;
    this.touch?.destroy();
    this.touch = new TouchControls(this, this.mode === "dungeon");
  }

  private weaponCard: Phaser.GameObjects.Container | null = null;

  /** Swapped weapon: a card at the bottom showing what's in hand now, and what's either side of it. */
  private showWeaponCard() {
    const s = G.s;
    const list = weaponList(s);
    const i = Math.max(0, list.findIndex((w) => w.id === (s.gun ?? null)));
    this.weaponCard?.destroy();
    // in the run'n'gun rooms the action fills the screen: a small, see-through card on the half the player isn't in
    const dun = this.scene.get("Dungeon") as unknown as { side?: boolean; player?: { spr?: Phaser.GameObjects.Sprite }; cameras?: Phaser.Cameras.Scene2D.CameraManager } | null;
    const rng = !!(dun && this.scene.isActive("Dungeon") && dun.side);
    let cy = 430;
    if (rng) {
      const spr = dun!.player?.spr;
      const cam = dun!.cameras?.main;
      const py = spr && cam ? (spr.y - cam.worldView.y) * cam.zoom : 400;
      cy = py < 300 ? 470 : 150;
    }
    const c = this.add.container(480, cy).setDepth(900);
    this.weaponCard = c;
    c.add(this.add.rectangle(0, 0, 440, 92, 0x0b1220, 0.9).setStrokeStyle(3, 0x67e8f9));
    const side = (k: number, x: number) => {
      if (list.length < 2) return;
      const w = list[(k + list.length) % list.length];
      const ic = weaponIcon(this, x, -6, w, 38).setAlpha(w.empty ? 0.2 : 0.45);
      c.add(ic);
      c.add(this.add.text(x, 30, ammoLabel(w), { fontFamily: FONT, fontSize: "9px", color: "#94a3b8" }).setOrigin(0.5));
    };
    side(i - 1, -175);
    side(i + 1, 175);
    c.add(this.add.text(-140, 0, "◀", { fontFamily: FONT, fontSize: "14px", color: "#475569" }).setOrigin(0.5));
    c.add(this.add.text(140, 0, "▶", { fontFamily: FONT, fontSize: "14px", color: "#67e8f9" }).setOrigin(0.5));
    const w = list[i];
    c.add(weaponIcon(this, -70, 0, w, 58));
    c.add(this.add.text(-30, -16, w.name.toUpperCase(), { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ffffff", wordWrap: { width: 160 } }).setOrigin(0, 0.5));
    c.add(this.add.text(-30, 14, ammoLabel(w), { fontFamily: FONT, fontSize: "13px", color: "#facc15", fontStyle: "bold" }).setOrigin(0, 0.5));
    if (!rng) c.add(this.add.text(0, 54, "TAP SWAP: next · HOLD SWAP: choose", { fontFamily: FONT, fontSize: "10px", color: "#94a3b8", backgroundColor: "#0b1220cc", padding: { x: 4, y: 1 } }).setOrigin(0.5));
    const full = rng ? 0.62 : 1;
    c.setScale(full * 0.85).setAlpha(0);
    this.tweens.add({ targets: c, scale: full, alpha: rng ? 0.8 : 1, duration: 120, ease: "Back.out" });
    this.tweens.add({ targets: c, alpha: 0, delay: rng ? 800 : 1400, duration: rng ? 220 : 300, onComplete: () => {
      if (this.weaponCard === c) this.weaponCard = null;
      c.destroy();
    } });
  }

  private onEvent(ev: string, d: any) {
    switch (ev) {
      case "toast":
        this.pushToast(d.title, d.text, false);
        break;
      case "weaponCard":
        this.showWeaponCard();
        break;
      case "ping":
        // Drongus stays out of dungeons (a burst that was still landing as you went in is dropped)
        if (d.from === "DRONGUS" && this.mode !== "hub") break;
        this.pushToast(CHARACTERS[d.from]?.name ?? d.from, d.text, true, d.from);
        synth.play("notify");
        break;
      case "fbstatus":
        if (this.mode !== "hub") break;
        this.pushStatus(d.text, d.year);
        synth.play("notify");
        break;
      case "boss":
        this.boss = d;
        break;
      case "rule":
        this.rule = d;
        break;
      case "room":
        this.roomT.setText(d.name);
        break;
      case "conflict":
        this.conflictUntil = this.time.now + d;
        break;
      case "timer":
        if (d == null) this.timerT.setVisible(false);
        else {
          const sec = Math.max(0, Math.ceil(d));
          // the Kreddle raid draws its own nuke countdown; everywhere else this one shows
          const nuke = !!G.s.flags.nuke_planted;
          this.timerT
            .setVisible(!(nuke && this.scene.isActive("Kreddle")))
            .setText(`${nuke ? "☢ DETONATION IN" : "✈ KR-069 IMPACT IN"} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);
          this.timerT.setColor(sec <= 30 && sec % 2 ? "#ffffff" : "#ff4d4d");
        }
        break;
      case "rename":
        this.rename = d;
        this.renameUntil = this.time.now + 5000;
        break;
    }
  }

  /** A Facebook status from Drongus, years old, resurfacing for no reason. */
  private pushStatus(text: string, year?: string) {
    // long ones get a wider box (and the box always grows to fit every line)
    const w = text.length > 150 ? 380 : text.length > 70 ? 330 : 300;
    const c = this.add.container(960 - w - 10, 0).setDepth(100);
    const body = this.add.text(10, 40, text, { fontFamily: FONT, fontSize: "12px", color: "#050505", wordWrap: { width: w - 20, useAdvancedWrap: true } });
    const h = body.height + 66;
    const bg = this.add.rectangle(0, 0, w, h, 0xffffff, 0.97).setOrigin(0).setStrokeStyle(2, 0x1877f2);
    const band = this.add.rectangle(0, 0, w, 18, 0x1877f2).setOrigin(0);
    const brand = this.add.text(8, 2, "facebrook", { fontFamily: FONT, fontSize: "11px", color: "#ffffff", fontStyle: "bold" });
    const pk = portraitKey(this, "DRONGUS");
    const who = this.add.text(pk ? 40 : 10, 21, `${CHARACTERS.DRONGUS?.name ?? "DRONGUS"} · ${year ? `${year} · ` : ""}🌐`, { fontFamily: FONT, fontSize: "10px", color: "#1877f2", fontStyle: "bold" });
    const foot = this.add.text(10, h - 20, `👍 0   💬 0   Seen by 9`, { fontFamily: FONT, fontSize: "10px", color: "#65676b" });
    c.add([bg, band, brand, who, body, foot]);
    if (pk) c.add(this.add.image(22, 28, pk).setDisplaySize(18, 18));
    c.setData("h", h);
    let y0 = 8;
    for (const t of this.toasts) y0 += (t.c.getData("h") as number) + 6;
    c.y = y0;
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    // on screen long enough to actually read
    this.toasts.push({ c, until: this.time.now + Phaser.Math.Clamp(5000 + text.length * 55, 7500, 18000) });
    if (this.toasts.length > 5) {
      const t = this.toasts.shift()!;
      // the oldest slides out rather than vanishing
      this.tweens.add({ targets: t.c, alpha: 0, x: t.c.x + 60, duration: 220, onComplete: () => t.c.destroy() });
    }
  }

  private pushToast(title: string, text: string, messenger: boolean, from?: string) {
    const w = 300;
    const c = this.add.container(960 - w - 10, 0).setDepth(100);
    const body = this.add.text(messenger ? 46 : 10, 24, text, { fontFamily: FONT, fontSize: "12px", color: messenger ? "#050505" : "#ffffff", wordWrap: { width: w - (messenger ? 56 : 20), useAdvancedWrap: true } });
    const h = Math.max(48, body.height + 32);
    const bg = this.add.rectangle(0, 0, w, h, messenger ? 0xffffff : UI.panel, 0.96).setOrigin(0).setStrokeStyle(2, messenger ? UI.messenger : UI.accent);
    const tt = this.add.text(messenger ? 46 : 10, 6, title, { fontFamily: FONT, fontSize: "11px", color: messenger ? "#0084ff" : "#ffd23f", fontStyle: "bold" });
    c.add([bg, tt, body]);
    if (messenger && from) {
      const pk = portraitKey(this, from);
      if (pk) c.add(this.add.image(24, h / 2, pk).setDisplaySize(30, 30));
    }
    c.setData("h", h);
    let y0 = 8;
    for (const t of this.toasts) y0 += (t.c.getData("h") as number) + 6;
    c.y = y0;
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    this.toasts.push({ c, until: this.time.now + (messenger ? 5200 : 4200) });
    if (this.toasts.length > 5) {
      const t = this.toasts.shift()!;
      // the oldest slides out rather than vanishing
      this.tweens.add({ targets: t.c, alpha: 0, x: t.c.x + 60, duration: 220, onComplete: () => t.c.destroy() });
    }
  }

  /** The pale "damage taken" part of the HP bar, and when it last caught up. */
  private coinIco!: Phaser.GameObjects.Image;
  private coinT!: Phaser.GameObjects.Text;
  private wasFull = false;
  private lastLv = 0;
  private gunT: Phaser.GameObjects.Text | null = null;
  private tray: { key: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Text }[] = [];
  private popPrompt: Phaser.GameObjects.Container | null = null;
  private popUntil = 0;

  /** A specials keycap: fills from the bottom as the meter charges; glows (and shows the key big) when it's ready. */
  private drawKeycap(i: number, x: number, y: number, frac: number, ready: boolean, key: string, label: string, col: number, pulse: number, pips = -1) {
    const g = this.g;
    const S = 64;
    // (re)make the texts if they're missing or were destroyed (e.g. the HUD restarted after you died)
    const old = this.tray[i];
    if (!old || !old.key.scene || !old.label.scene || !old.pips.scene) {
      this.tray[i] = {
        key: this.add.text(0, 0, "", { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#ffffff" }).setOrigin(0.5).setShadow(2, 2, "#000", 0),
        label: this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "11px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 0).setShadow(1, 1, "#000", 0),
        pips: this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "9px", color: "#d9f99d" }).setOrigin(0.5, 0),
      };
    }
    const t = this.tray[i];
    if (ready) {
      g.fillStyle(col, 0.25 + 0.35 * pulse);
      g.fillRoundedRect(x - 6, y - 6, S + 12, S + 12, 12);
    }
    g.fillStyle(0x0b0614, 0.85);
    g.fillRoundedRect(x, y, S, S, 8);
    const fh = (S - 4) * Phaser.Math.Clamp(frac, 0, 1);
    g.fillStyle(col, ready ? 0.9 : 0.45);
    g.fillRect(x + 2, y + S - 2 - fh, S - 4, fh);
    g.lineStyle(ready ? 3 : 1, ready ? 0xffffff : 0xffffff, ready ? 0.6 + 0.4 * pulse : 0.3);
    g.strokeRoundedRect(x, y, S, S, 8);
    t.key.setText(key).setPosition(x + S / 2, y + S / 2 - 2).setAlpha(ready ? 1 : 0.45).setScale(ready ? 1 + 0.08 * pulse : 1).setVisible(true);
    t.label.setText(label).setPosition(x + S / 2, y + S + 3).setColor(ready ? "#ffffff" : "#9aa0a6").setVisible(true);
    t.pips.setText(pips > 0 ? "●".repeat(pips) + "○".repeat(4 - pips) : "").setPosition(x + S / 2, y + 4).setVisible(pips > 0);
  }

  private hideKeycap(i: number) {
    const t = this.tray[i];
    if (!t) return;
    t.key.setVisible(false);
    t.label.setVisible(false);
    t.pips.setVisible(false);
  }

  private hideTray() {
    for (const t of this.tray) {
      t.key.setVisible(false);
      t.label.setVisible(false);
      t.pips.setVisible(false);
    }
  }

  /** "R — WONK READY" over the player's head, for a couple of seconds. */
  private showPop(key: string, text: string, col: number, time: number) {
    this.popPrompt?.destroy();
    const c = this.add.container(0, 0).setDepth(40);
    const k = this.add.text(0, 0, key, { fontFamily: "Impact, sans-serif", fontSize: key.length > 2 ? "14px" : "22px", color: "#111111", backgroundColor: "#" + col.toString(16).padStart(6, "0"), padding: { x: 9, y: 4 } }).setOrigin(0.5, 1);
    const tx = this.add.text(0, 2, text, { fontFamily: FONT, fontSize: "11px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5, 0);
    c.add([k, tx]);
    this.popPrompt = c;
    this.popUntil = time + 2600;
  }

  private placePop(dun: any, time: number, pulse: number) {
    const c = this.popPrompt;
    if (!c) return;
    const p = dun?.player?.spr;
    if (time > this.popUntil || !p || !dun.cameras?.main) {
      c.destroy();
      this.popPrompt = null;
      return;
    }
    const cam = dun.cameras.main;
    const sx = (p.x - cam.worldView.x) * cam.zoom;
    const sy = (p.y - cam.worldView.y) * cam.zoom - 64 * cam.zoom;
    // keep it on screen when you're up against the edge (a run'n'gun lockdown holds you there)
    const half = Math.max(...c.list.map((o) => (o as Phaser.GameObjects.Text).width ?? 0)) / 2 + 4;
    const W = this.scale.width;
    c.setPosition(Phaser.Math.Clamp(sx, half, Math.max(half, W - half)), Phaser.Math.Clamp(sy - 4 * pulse, 40, this.scale.height - 20)).setAlpha(Math.min(1, (this.popUntil - time) / 400));
  }

  private hpGhost = 1;
  private hpGhostAt = 0;

  private face = "";
  private faceImg: Phaser.GameObjects.Image | null = null;

  update(time: number) {
    const s = G.s;
    const g = this.g;
    g.clear();
    const mh = maxHp(s);
    const confl = time < this.conflictUntil;
    const labels = confl ? ["WONK", "HP", "KREZZ"] : this.labels;
    const dungeon = this.mode === "dungeon";
    const touch = !!this.touch && isTouchDevice(this.game);
    const flash = Math.floor(time / 160) % 2 === 0;
    const pulse = 0.5 + 0.5 * Math.sin(time / 140);
    const bar = (x: number, y: number, w: number, h: number, frac: number, col: number) => {
      g.fillStyle(0x000000, 0.65);
      g.fillRect(x, y, w, h);
      g.fillStyle(col, 1);
      g.fillRect(x + 1, y + 1, (w - 2) * Phaser.Math.Clamp(frac, 0, 1), h - 2);
      g.lineStyle(1, 0xffffff, 0.3);
      g.strokeRect(x, y, w, h);
    };
    // playing as Mikey: Mikey ⇄ SanMik changes the face and the name up here too
    const face = playerFace(s);
    if (face !== this.face) {
      this.face = face;
      const fk = portraitKey(this, face);
      if (fk && this.faceImg) this.faceImg.setTexture(fk).setDisplaySize(52, 52);
    }
    const nm = time < this.renameUntil && this.rename ? this.rename : sanmikActive(s) ? "SANMIK" : CHARACTERS[s.player].name;
    this.nameT.setText(nm);
    // things that change how you play right now (shown as chips, only while they're true)
    const chips = [
      s.intoxication > 5 ? `${intoxLabel(s.intoxication)} ${Math.round(s.intoxication)}%` : "",
      s.flags.tap_rush ? "💦 TAP RUSH (+50% HP, +25% dmg)" : "",
      s.flags.golden_charge && !dungeon ? "⚡ GOLDEN JUICE (T to transform)" : "",
    ].filter(Boolean);
    if (!dungeon) {
      // KRELFORD: nothing can hurt you here, so no bars. Just your money and anything that's affecting you.
      this.hpT.setVisible(false);
      this.kzT.setVisible(false);
      this.wonkT.setVisible(false);
      this.fartT.setVisible(false);
      this.wonkChip.setVisible(false);
      this.fartChip.setVisible(false);
      this.hideTray();
      this.coinIco.setPosition(68, 33).setVisible(true);
      this.coinT.setPosition(88, 33).setText(`${s.coins}`).setVisible(true);
      this.statT.setPosition(68, 44).setText(chips.join("\n"));
      this.popPrompt?.setVisible(false);
    } else {
      // ---- HEALTH: big and obvious, with your pussy juice right next to it
      const hpFrac = Phaser.Math.Clamp(s.hp / mh, 0, 1);
      if (hpFrac >= this.hpGhost) {
        this.hpGhost = hpFrac;
        this.hpGhostAt = time;
      } else if (time - this.hpGhostAt > 450) this.hpGhost = Math.max(hpFrac, this.hpGhost - 0.0012 * 16);
      const low = hpFrac < 0.3;
      g.fillStyle(0x000000, 0.7);
      g.fillRect(66, 22, 230, 18);
      if (this.hpGhost > hpFrac) {
        g.fillStyle(0xfff1f2, 0.85);
        g.fillRect(67, 23, 228 * this.hpGhost, 16);
      }
      g.fillStyle(low && flash ? 0xff6b6b : UI.hp, 1);
      g.fillRect(67, 23, 228 * hpFrac, 16);
      g.lineStyle(low ? 2 : 1, low ? 0xff4d4d : 0xffffff, low ? 0.9 : 0.35);
      g.strokeRect(66, 22, 230, 18);
      this.hpT.setText(`${confl ? "WONK" : "HP"} ${Math.ceil(s.hp)}/${mh}`).setPosition(72, 24).setFontSize(12).setVisible(true);
      // Krezz: a slim bar underneath
      bar(66, 43, 230, 9, s.krezz / maxKrezz(s), UI.krezz);
      this.kzT.setText(`KREZZ ${Math.floor(s.krezz)}`).setPosition(300, 41).setFontSize(10).setVisible(true);
      const q = prettyKey(keysFor("bottle")[0] ?? "Q");
      const bk = prettyKey(keysFor("bongo")[0] ?? "B");
      this.statT.setPosition(68, 56).setText(
        [
          `🍼 ×${s.bottles}/${maxBottles(s)}${touch ? "" : ` [${q}] heal`}   🍺 ×${s.bongos}${touch ? "" : ` [${bk}]`}${s.upgrades.fairies ? (G.rt.fairyUsed && this.mode === "dungeon" ? "   🧚 used" : "   🧚 ready") : ""}`,
          ...chips,
        ].join("\n"),
      );
      this.coinIco.setPosition(300, 63).setVisible(true);
      this.coinT.setPosition(320, 63).setText(`${s.coins}`).setVisible(true);
      // the old top-left meter strip is replaced by the specials tray
      this.wonkT.setVisible(false);
      this.fartT.setVisible(false);
      this.wonkChip.setVisible(false);
      this.fartChip.setVisible(false);
      // ---- SPECIALS: keycaps that fill up and glow when ready
      let wonk = 0;
      const dun = this.scene.get("Dungeon") as any;
      if (dun?.player) wonk = dun.player.wonk;
      const full = wonk >= 100;
      const fm = fartMeter();
      const lv = fartLevel();
      this.touch?.glow("burst", full, time);
      this.touch?.glow("fart", lv === 4, time);
      const rk = prettyKey(keysFor("burst")[0] ?? "R");
      const gk = prettyKey(keysFor("fart")[0] ?? "G");
      if (!touch) {
        // in the side-scrolling (run'n'gun) rooms the player lives down at the bottom left: the tray moves up to the top right
        const side = !!dun?.side;
        // the golden transformation gets a fourth key once you've drunk the juice (and while it's running: time left)
        const pl = dun?.player as { superUntil?: number } | undefined;
        const nowD = (dun as unknown as { now?: () => number } | undefined)?.now?.() ?? 0;
        const superLeft = Math.max(0, (pl?.superUntil ?? 0) - nowD);
        const golden = !!s.flags.golden_charge || superLeft > 0;
        const tx = (i: number) => (side ? (golden ? 636 : 712) + i * 76 : 24 + i * 76);
        const ty = side ? 92 : 448;
        const qk = prettyKey(keysFor("bottle")[0] ?? "Q");
        const mb = Math.max(1, maxBottles(s));
        this.drawKeycap(0, tx(0), ty, Math.min(1, wonk / 100), full, rk, full ? "WONK!" : `WONK ${Math.floor(wonk)}%`, 0xffd23f, pulse);
        this.drawKeycap(1, tx(1), ty, fm / 100, lv >= 1, gk, ["FART", "FAIRY", "BEANS", "CABBAGE", "IBS!"][lv], lv === 4 ? 0xd4ff3a : 0x9ccc65, lv === 4 ? pulse : 0.2, lv);
        // the national drink: how many bottles of pussy juice you've got, and the key to neck one
        this.drawKeycap(2, tx(2), ty, s.bottles / mb, s.bottles > 0, qk, `JUICE ${s.bottles}/${mb}`, 0xff9ecf, s.hp < maxHp(s) * 0.35 && s.bottles > 0 ? pulse : 0.2);
        if (golden) {
          const tk = prettyKey(keysFor("transform")[0] ?? "T");
          if (superLeft > 0) this.drawKeycap(3, tx(3), ty, superLeft / superMs(), false, tk, `GOLDEN ${Math.ceil(superLeft / 1000)}s`, 0xfde047, 0.2);
          else this.drawKeycap(3, tx(3), ty, 1, true, tk, "TRANSFORM", 0xfde047, pulse);
        } else this.hideKeycap(3);
      } else this.hideTray();
      // the moment a special becomes ready, a key prompt pops up over your head for a couple of seconds
      if (full && !this.wasFull) this.showPop(touch ? "TAP WONK" : rk, "WONK READY", 0xffd23f, time);
      if (lv === 4 && this.lastLv < 4) this.showPop(touch ? "TAP 💨" : gk, "IBS ATTACK READY", 0xd4ff3a, time);
      this.wasFull = full;
      this.lastLv = lv;
      this.placePop(dun, time, pulse);
      // ---- WEAPON: bottom right, big enough to read mid-fight
      const gun = currentGun(s);
      const sk = prettyKey(keysFor("swap")[0] ?? "X");
      if (!this.gunT || !this.gunT.scene) this.gunT = this.add.text(940, 520, "", { fontFamily: FONT, fontSize: "15px", color: "#ffffff", fontStyle: "bold", align: "right", backgroundColor: "#0b0614cc", padding: { x: 8, y: 5 } }).setOrigin(1, 1).setShadow(1, 1, "#000", 0);
      const ammo = gun ? s.guns![s.gun!] : 0;
      const out = gun && ammo <= 0;
      this.gunT
        .setText(gun ? `🔫 ${gun.name}\n${out ? "OUT OF AMMO" : `${ammo} / ${gunMax(gun, s)}`}${touch ? "" : `   [${sk}] swap`}` : `💨 Fart Blaster  ∞${ownedGuns(s).length && !touch ? `\n[${sk}] swap gun` : ""}`)
        .setColor(out ? "#ff6b6b" : gun && ammo < gunMax(gun, s) * 0.2 ? "#facc15" : "#ffffff")
        .setVisible(!this.boss || !touch);
    }
    if (!dungeon) this.gunT?.setVisible(false);
    // objective
    if (this.mode === "hub") {
      // objectives pop up in the middle when they change, then get out of the way (they're always in the pause menu)
      const st = currentStep();
      this.objT.setVisible(false);
      const txt = st?.text ?? "";
      if (txt !== this.lastObjective) {
        this.lastObjective = txt;
        if (txt) this.popObjective(txt);
      }
      this.roomT.setText(`CHAPTER ${s.chapter} · KRELFORD`);
    } else this.objT.setVisible(false);
    // ban risk
    if (this.rule || s.banRisk > 0) {
      g.fillStyle(0x000000, 0.7);
      g.fillRect(380, 52, 200, 12);
      g.fillStyle(UI.ban, 1);
      g.fillRect(381, 53, 198 * (s.banRisk / 100), 10);
      g.lineStyle(1, 0xff4444, 0.7);
      g.strokeRect(380, 52, 200, 12);
      this.ruleT.setText(`BAN RISK ${Math.round(s.banRisk)}%${this.rule ? `\n${this.rule}` : ""}`).setPosition(480, 66).setVisible(true);
    } else this.ruleT.setVisible(false);
    // boss
    if (this.boss) {
      const b = this.boss;
      g.fillStyle(0x000000, 0.75);
      g.fillRect(180, 506, 600, 16);
      const sh = b.shield;
      const vuln = sh?.state === "vulnerable";
      g.fillStyle(b.shielded ? 0x88aaff : vuln ? (!G.meta?.settings?.calmFlash && Math.floor(time / 160) % 2 ? 0xf59e0b : 0xffd23f) : 0xdc2626, 1);
      g.fillRect(182, 508, 596 * Math.max(0, b.hp / b.max), 12);
      // shield phases still to come: a tick on the bar at each
      for (const m of sh?.marks ?? []) {
        g.fillStyle(0x6fd8ff, 1).fillRect(181 + 598 * m - 1, 504, 3, 20);
      }
      g.lineStyle(2, b.shielded ? 0x6fd8ff : 0xffd23f, 1);
      g.strokeRect(180, 506, 600, 16);
      const tag = sh?.state === "shielded" ? `  [SHIELDED ${sh.cracks}/${sh.need} — KILL THE MINIONS]` : vuln ? "  [VULNERABLE!]" : b.shielded ? "  [SHIELDED]" : "";
      this.bossT.setText(b.name + tag).setColor(sh?.state === "shielded" ? "#7dd3fc" : vuln ? "#ffd23f" : "#ffffff").setVisible(true);
      if (sh?.state === "shielded") {
        // frozen behind the shield: a glassy sheen over the bar, and a drawn shield badge by the name
        g.fillStyle(0xffffff, 0.18).fillRect(182, 508, 596, 4);
        const x = 480 - this.bossT.width / 2 - 14;
        const y = 493;
        g.fillStyle(0x000000, 1).fillPoints([{ x: x - 9, y: y - 11 }, { x, y: y - 14 }, { x: x + 9, y: y - 11 }, { x: x + 8, y: y + 2 }, { x, y: y + 12 }, { x: x - 8, y: y + 2 }], true);
        g.fillStyle(0x2f7bff, 1).fillPoints([{ x: x - 7, y: y - 9 }, { x, y: y - 11 }, { x: x + 7, y: y - 9 }, { x: x + 6, y: y + 1 }, { x, y: y + 9 }, { x: x - 6, y: y + 1 }], true);
        g.fillStyle(0xe6fbff, 1).fillRect(x - 1, y - 8, 2, 15).fillRect(x - 5, y - 3, 10, 2);
      }
    } else this.bossT.setVisible(false);
    // toasts
    let y = 8;
    this.toasts = this.toasts.filter((t) => {
      if (time > t.until) {
        this.tweens.add({ targets: t.c, alpha: 0, duration: 200, onComplete: () => t.c.destroy() });
        return false;
      }
      t.c.y += (y - t.c.y) * 0.25;
      y += (t.c.getData("h") as number) + 6;
      return true;
    });
  }
}

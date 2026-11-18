import { dialogueLog } from "../ui/dialogueLog";
import Phaser from "phaser";
import { ACTIONS, bindKey, keyNameFromEvent, keysFor, prettyKey, resetKeys } from "../systems/keybinds";
import { G } from "../G";
import { button, FONT, hexStr, PIXEL_BOLD, PIXEL_FONT, panel, title, UI } from "../ui/theme";
import { switchTo, currentStep } from "../Flow";
import { synth } from "../audio/Synth";
import { CHARACTERS } from "../../data/characters";
import { GENERIC_UPGRADES, upgradeCost, maxHp, counter } from "../systems/stats";
import { GUNS, GUN_ORDER, gunMax } from "../combat/Guns";
import { ammoQuote, ammoUnitCost, BANK_PERKS, buyAmmo, buyMod, FART_ID, gunModList, LUCK_TEXT, MOD_EFFECT, MOD_INFO, moddableGuns, moddedFart, moddedGun, orderedGuns, type ModStat } from "../systems/armoury";
import { ShopGrid, shopTabs, type ShopItem } from "../ui/shop";
import { TOUCH } from "../ui/TouchControls";
import { portraitKey } from "../gfx/Textures";
import { Companion } from "../combat/Companion";
import { arcsFor, arcAvailable, arcDue, currentArcSteps, requiredArcSteps, stepDone } from "../systems/arcs";
import { chapterDef } from "../../content/chapters/chapters";
import { evalCond } from "../systems/conditions";
import { personalQuest, pickupsCollected, MINISTRY_QUESTS, ministryQuestState, ministryProgress } from "../systems/quests";
import { factById } from "../../data/historicalRevisions";
import { narrativeActor } from "../systems/narrative";
import { DialogueBox } from "../ui/DialogueBox";
import { bindPad, btnDown, firstDown, PAD_DEFAULTS, PAD_FIXED, PAD_START, padFor, padLabel, resetPad } from "../systems/padbinds";
import { say } from "../../content/dsl";
import { clampDifficulty, difficultyDef, difficultyLabel, difficultyStats, DIFFICULTY_LEVELS, LEGACY_DIFFICULTY, DEFAULT_DIFFICULTY, MAX_DIFFICULTY } from "../systems/difficulty";

type Mode = "pause" | "settings" | "bank" | "tribunal" | "death" | "quests" | "controls" | "log" | "difficulty";

// (the perks list lives with the rest of the armoury rules)
export { BANK_PERKS };
export const BANK_MOVES = [
  { id: "mv_charge", name: "Pub Shove", icon: "💥", desc: "Your dodge becomes a shoulder charge that flings anything you hit.", cost: 450 },
  { id: "mv_fart", name: "Fart Propulsion", icon: "💨", desc: "Every dodge leaves a fart cloud that hurts and slows enemies.", cost: 400 },
  { id: "mv_lastorders", name: "Last Orders", icon: "🍺", desc: "Drinking pussy juice (Q) knocks everything around you flying.", cost: 550 },
];
/** Hiring a lad for one dungeon trip. */
export const LAD_COST = 200;

type BankTab = "upgrades" | "armoury" | "mods" | "perks" | "moves";
const BANK_TABS: { id: BankTab; label: string }[] = [
  { id: "upgrades", label: "⬆ UPGRADES" },
  { id: "armoury", label: "🔫 GUNS" },
  { id: "mods", label: "🔧 GUN MODS" },
  { id: "perks", label: "★ PERKS" },
  { id: "moves", label: "🤝 LADS" },
];

/** Overlay menus: pause, settings, bank (upgrades), ban tribunal, quests, death. */
export class MenuScene extends Phaser.Scene {
  private bankTab: BankTab = "upgrades";
  /** GUN MODS tab: which gun's mods are on the shelf. */
  private modGun = FART_ID;
  private shop: ShopGrid | null = null;
  private bankSel: Partial<Record<BankTab, number>> = {};
  private mode: Mode = "pause";
  private settingsTab: 0 | 1 = 0;
  private questTab: 0 | 1 | 2 = 0;
  private questScroll = 0;
  private logScroll = 0;
  private caller = "";
  private data0: any = {};
  private root!: Phaser.GameObjects.Container;
  private escKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super("Menu");
  }

  create(data: any) {
    this.data0 = data ?? {};
    this.caller = data?.caller ?? "";
    this.root = this.add.container(0, 0);
    this.escKey = this.input.keyboard?.addKey("ESC");
    this.escKey?.on("down", () => this.back());
    this.padPrev = [];
    this.padPrimed = false;
    this.focus = -1;
    // the shop: arrows pick, E / Enter / Space buy, Tab or 1-4 switch tabs
    const shopKeys = (e: KeyboardEvent) => {
      if (this.mode !== "bank" || !this.shop) return;
      const k = e.code;
      if (k === "ArrowLeft" || k === "KeyA") this.shop.move(-1, 0);
      else if (k === "ArrowRight" || k === "KeyD") this.shop.move(1, 0);
      else if (k === "ArrowUp" || k === "KeyW") this.shop.move(0, -1);
      else if (k === "ArrowDown" || k === "KeyS") this.shop.move(0, 1);
      else if (k === "KeyE" || k === "Enter" || k === "Space" || k === "NumpadEnter") void this.shop.confirm();
      else if (k === "Tab" || k === "KeyQ" || k === "KeyR") {
        e.preventDefault?.();
        const i = BANK_TABS.findIndex((t) => t.id === this.bankTab);
        this.setBankTab(BANK_TABS[(i + (e.shiftKey || k === "KeyQ" ? -1 : 1) + BANK_TABS.length) % BANK_TABS.length].id);
      } else if (/^Digit[1-5]$/.test(k)) this.setBankTab(BANK_TABS[Number(k.slice(5)) - 1].id);
      else if (this.bankTab === "mods" && (k === "KeyZ" || k === "KeyC" || k === "BracketLeft" || k === "BracketRight")) this.cycleModGun(k === "KeyZ" || k === "BracketLeft" ? -1 : 1);
    };
    this.input.keyboard?.on("keydown", shopKeys);
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown", shopKeys);
      this.shop = null;
    });
    // the pause menu pauses the music too (picked up where it left off when you close it)
    if ((data?.mode ?? "pause") === "pause" && this.caller !== "Title") {
      synth.pauseMusic();
      this.events.once("shutdown", () => synth.resumeMusic());
    }
    this.render(data?.mode ?? "pause");
  }

  /** Esc / B: cancel a rebind, or go back a level, or close. */
  private back() {
    if (this.mode === "death") return;
    if (this.mode === "controls") {
      // Esc cancels a rebind in progress, otherwise goes back
      if (this.listening || this.listeningPad) {
        this.listening = null;
        this.listeningPad = null;
        this.render("controls");
      } else this.render(this.controlsFrom);
      return;
    }
    if (this.mode === "settings" || this.mode === "quests" || this.mode === "log" || this.mode === "difficulty") {
      // (from the title screen, settings is the whole menu)
      if (this.caller === "Title" && this.mode === "settings") this.close();
      else this.render("pause");
      return;
    }
    if (this.mode === "pause" || this.mode === "bank" || this.mode === "tribunal") this.close();
  }

  // ---- gamepad: d-pad / left stick moves a highlight between the buttons, A presses, B goes back, Start closes the pause menu
  private padPrev: boolean[] = [];
  /** Buttons held when the menu opened (e.g. the Start that opened it) are ignored until they're let go. */
  private padPrimed = false;
  private focus = -1;
  private focusBox?: Phaser.GameObjects.Rectangle;
  private stickWas = "";
  private listeningPad: string | null = null;
  private padArmed = false;

  private focusables(): Phaser.GameObjects.Container[] {
    return this.root.list.filter((o): o is Phaser.GameObjects.Container => {
      const bg = (o as any).bg as Phaser.GameObjects.GameObject | undefined;
      return o instanceof Phaser.GameObjects.Container && !!bg?.input?.enabled && o.visible;
    });
  }

  private showFocus() {
    const list = this.focusables();
    if (!list.length) {
      this.focusBox?.setVisible(false);
      return;
    }
    this.focus = Phaser.Math.Clamp(this.focus, 0, list.length - 1);
    const b = list[this.focus];
    if (!this.focusBox || !this.focusBox.active) this.focusBox = this.add.rectangle(0, 0, 10, 10).setFillStyle(0xffffff, 0.12).setStrokeStyle(3, 0xffd23f).setDepth(100);
    this.children.bringToTop(this.focusBox);
    this.focusBox.setPosition(b.x, b.y).setSize(b.width + 8, b.height + 8).setOrigin(0.5).setVisible(true);
  }

  /** Move the highlight to the nearest button that way. */
  private moveFocus(dx: number, dy: number) {
    const list = this.focusables();
    if (!list.length) return;
    if (this.focus < 0 || this.focus >= list.length) {
      this.focus = 0;
      this.showFocus();
      return;
    }
    const cur = list[this.focus];
    let best = -1;
    let bestD = Infinity;
    list.forEach((b, i) => {
      if (i === this.focus) return;
      const ox = b.x - cur.x;
      const oy = b.y - cur.y;
      const along = ox * dx + oy * dy;
      if (along <= 4) return;
      const across = Math.abs(ox * dy - oy * dx);
      const d = along + across * 2.5;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      this.focus = best;
      synth.play("select");
    }
    this.showFocus();
  }

  update() {
    const gp = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    if (!gp) return;
    const now = gp.buttons.map((_, i) => btnDown(gp, i));
    if (!this.padPrimed) {
      // whatever is already held (the Start that paused the game) doesn't count until released
      this.padPrev = now;
      this.padPrimed = true;
      return;
    }
    const prev = this.padPrev;
    this.padPrev = now;
    const hit = (i: number) => !!now[i] && !prev[i];
    // waiting for a button to bind
    if (this.listeningPad) {
      const down = firstDown(gp);
      if (down < 0) this.padArmed = true;
      else if (this.padArmed && !prev[down]) {
        if (down !== PAD_START) {
          bindPad(this.listeningPad, down);
          synth.play("select");
        }
        this.listeningPad = null;
        this.render("controls");
      }
      return;
    }
    const sx = gp.leftStick.x;
    const sy = gp.leftStick.y;
    const stick = Math.abs(sx) > 0.6 || Math.abs(sy) > 0.6 ? (Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? "R" : "L") : sy > 0 ? "D" : "U") : "";
    const stickHit = stick && stick !== this.stickWas ? stick : "";
    this.stickWas = stick;
    if (hit(12) || stickHit === "U") this.moveFocus(0, -1);
    else if (hit(13) || stickHit === "D") this.moveFocus(0, 1);
    else if (hit(14) || stickHit === "L") this.moveFocus(-1, 0);
    else if (hit(15) || stickHit === "R") this.moveFocus(1, 0);
    else if (hit(0)) {
      const b = this.focus >= 0 ? this.focusables()[this.focus] : undefined;
      if (b) {
        synth.unlock();
        ((b as any).bg as Phaser.GameObjects.GameObject).emit("pointerup");
      } else this.moveFocus(0, 1);
    } else if (hit(1)) this.back();
    else if (hit(PAD_START) && (this.mode === "pause" || this.mode === "settings" || this.mode === "quests")) this.close();
  }

  private listening: string | null = null;
  private controlsFrom: Mode = "pause";
  private keyListener: ((e: KeyboardEvent) => void) | null = null;

  private openControls(from: Mode) {
    this.controlsFrom = from;
    this.listening = null;
    if (!this.keyListener) {
      this.keyListener = (e: KeyboardEvent) => {
        if (this.mode !== "controls" || !this.listening || e.code === "Escape") return;
        const name = keyNameFromEvent(e);
        if (!name) return;
        e.preventDefault();
        bindKey(this.listening, name);
        this.listening = null;
        synth.play("select");
        this.render("controls");
      };
      window.addEventListener("keydown", this.keyListener);
      this.events.once("shutdown", () => {
        if (this.keyListener) window.removeEventListener("keydown", this.keyListener);
        this.keyListener = null;
      });
    }
    this.render("controls");
  }

  private render(mode: Mode) {
    const changed = mode !== this.mode;
    this.mode = mode;
    this.root.removeAll(true);
    // keep the pad highlight on screen across re-renders (back to the top on a new page)
    if (this.focus >= 0) {
      if (changed) this.focus = 0;
      this.time.delayedCall(0, () => this.showFocus());
    }
    this.shop = null;
    const add = (o: Phaser.GameObjects.GameObject) => this.root.add(o);
    // the Exchange sits in its own neon counter room; everything else dims the game behind it
    if (mode === "bank" && this.textures.exists("bg_kreddle_exchange")) {
      add(this.add.image(480, 270, "bg_kreddle_exchange").setDisplaySize(960, 544).setInteractive());
      add(this.add.rectangle(0, 0, 960, 540, 0x0b0418, 0.5).setOrigin(0));
    } else add(this.add.rectangle(0, 0, 960, 540, 0x000000, mode === "bank" ? 0.82 : 0.7).setOrigin(0).setInteractive());
    if (mode !== "bank") add(panel(this, 140, 40, 680, 460));
    const s = G.hasRun() ? G.s : null;
    switch (mode) {
      case "pause": {
        add(title(this, 480, 74, "PAUSED", 28));
        const st = s ? currentStep() : null;
        if (st) add(this.add.text(480, 104, `Objective: ${st.text}`, { fontFamily: FONT, fontSize: "13px", color: "#ffffff", wordWrap: { width: 600 }, align: "center" }).setOrigin(0.5, 0));
        const items: [string, () => void][] = [
          ["RESUME", () => this.close()],
          ["QUESTS & SIDE QUESTS", () => { this.questTab = 0; this.questScroll = 0; this.render("quests"); }],
          ["DIALOGUE LOG", () => { this.logScroll = 0; this.render("log"); }],
          ["CONTROLS", () => this.openControls("pause")],
          ["SETTINGS", () => this.render("settings")],
        ];
        if (s) items.push([`DIFFICULTY: ${difficultyLabel(s.difficulty)}${this.inDungeon() ? "  🔒" : ""}`, () => this.render("difficulty")]);
        if (s && this.caller !== "Title") {
          // manual save slots: only somewhere safe (out in town or at home), never mid-dungeon / boss / cutscene
          const why = this.saveBlocked();
          items.push([why ? `SAVE GAME  🔒 ${why}` : "SAVE GAME", why ? () => synth.play("tap_fail") : () => this.openSlots()]);
        }
        items.push(["QUIT TO TITLE (progress is autosaved)", () => this.quit()]);
        const gap = items.length > 7 ? 41 : 46;
        items.forEach(([t, fn], i) => add(button(this, 480, 150 + i * gap, t, fn, { w: 400, h: items.length > 7 ? 36 : 40 })));
        break;
      }
      case "difficulty": {
        add(title(this, 480, 70, "DIFFICULTY", 28));
        const cur = s ? clampDifficulty(s.difficulty) : DEFAULT_DIFFICULTY;
        const locked = this.inDungeon();
        add(this.add.text(480, 96, locked
          ? "🔒 Can't change difficulty inside a dungeon. Change it from the pause menu once you're back in Krelford."
          : "Pick a level. It kicks in from the next room, fight or minigame. You can change it again any time (just not inside a dungeon).",
          { fontFamily: FONT, fontSize: "12px", color: locked ? "#fca5a5" : "#cbd5e1", align: "center", wordWrap: { width: 600 } }).setOrigin(0.5, 0));
        DIFFICULTY_LEVELS.forEach((d, i) => {
          const tag = d.level === DEFAULT_DIFFICULTY ? "  ★" : d.level === LEGACY_DIFFICULTY ? "  (original)" : "";
          const here = d.level === cur;
          add(button(this, 480, 150 + i * 44, `${here ? "▶ " : ""}${d.level}/${MAX_DIFFICULTY} · ${d.name}${tag}${here ? "  ✓" : ""}`, () => this.setDifficulty(d.level), { w: 460, h: 36, size: 15, disabled: locked && !here, color: here ? 0x1e3a5f : undefined }));
        });
        const d = difficultyDef(cur);
        add(this.add.text(480, 372, d.blurb, { fontFamily: FONT, fontSize: "13px", color: hexStr(d.color), fontStyle: "bold", align: "center", wordWrap: { width: 600 } }).setOrigin(0.5, 0));
        add(this.add.text(480, 410, difficultyStats(d), { fontFamily: FONT, fontSize: "10px", color: "#9aa0b4", align: "center", wordWrap: { width: 620 } }).setOrigin(0.5, 0));
        add(button(this, 480, 470, "◀ BACK", () => this.render("pause"), { w: 170, h: 32, size: 14 }));
        break;
      }
      case "controls": {
        add(title(this, 480, 58, "CONTROLS", 24));
        add(this.add.text(480, 80, "CHANGE, then press the new key or pad button. Mouse / right stick aims · Esc or START pauses · Tab skips dialogue.", { fontFamily: FONT, fontSize: "11px", color: "#9aa0b4" }).setOrigin(0.5));
        const hdr = { fontFamily: FONT, fontSize: "11px", color: "#ff9ad5", fontStyle: "bold" };
        add(this.add.text(375, 98, "KEYBOARD", hdr).setOrigin(0, 0.5));
        add(this.add.text(600, 98, "GAMEPAD", hdr).setOrigin(0, 0.5));
        ACTIONS.forEach((a, i) => {
          const y = 116 + i * 22;
          const listening = this.listening === a.id;
          const listeningPad = this.listeningPad === a.id;
          add(this.add.text(170, y, a.label, { fontFamily: FONT, fontSize: "12px", color: "#ffffff" }).setOrigin(0, 0.5));
          add(this.add.text(375, y, listening ? "press a key…" : keysFor(a.id).map(prettyKey).join("/"), { fontFamily: FONT, fontSize: "12px", color: listening ? "#86efac" : "#ffd23f", fontStyle: "bold" }).setOrigin(0, 0.5));
          add(button(this, 520, y, listening ? "…" : "CHANGE", () => { this.listeningPad = null; this.listening = a.id; this.render("controls"); }, { w: 64, h: 20, size: 10 }));
          const fixed = PAD_FIXED[a.id];
          const padTxt = listeningPad ? "press a button…" : fixed ?? (padFor(a.id).map(padLabel).join(" / ") || "—");
          add(this.add.text(600, y, padTxt, { fontFamily: FONT, fontSize: "12px", color: listeningPad ? "#86efac" : fixed ? "#9aa0b4" : "#67e8f9", fontStyle: "bold" }).setOrigin(0, 0.5));
          if (a.id in PAD_DEFAULTS) add(button(this, 755, y, listeningPad ? "…" : "CHANGE", () => { this.listening = null; this.listeningPad = a.id; this.padArmed = false; this.render("controls"); }, { w: 64, h: 20, size: 10 }));
        });
        if (this.listeningPad) add(this.add.text(480, 468, "Press the pad button to use (START cancels).", { fontFamily: FONT, fontSize: "11px", color: "#86efac" }).setOrigin(0.5));
        add(button(this, 260, 490, "RESET KEYS", () => { resetKeys(); this.listening = null; synth.play("ding"); this.render("controls"); }, { w: 170, h: 30, size: 14 }));
        add(button(this, 450, 490, "RESET PAD", () => { resetPad(); this.listeningPad = null; synth.play("ding"); this.render("controls"); }, { w: 170, h: 30, size: 14 }));
        add(button(this, 660, 490, "◀ BACK", () => { this.listening = null; this.listeningPad = null; this.render(this.controlsFrom); }, { w: 170, h: 30, size: 14 }));
        break;
      }
      case "settings": {
        add(title(this, 480, 66, "SETTINGS", 28));
        const set = G.meta.settings;
        // two tabs, so nothing's crammed: sound and voices / play, text and display
        const tabs = ["SOUND & VOICES", "PLAY & DISPLAY"];
        tabs.forEach((t, i) => add(button(this, 380 + i * 200, 104, t, () => { this.settingsTab = i as 0 | 1; this.render("settings"); }, { w: 190, h: 32, size: 14, color: this.settingsTab === i ? 0x7c3aed : undefined })));
        let y = 152;
        const row = (label: string, get: () => string, dec: () => void, inc: () => void) => {
          add(this.add.text(200, y, label, { fontFamily: FONT, fontSize: "16px", color: "#ffffff" }).setOrigin(0, 0.5));
          const val = this.add.text(620, y, get(), { fontFamily: FONT, fontSize: "16px", color: "#ffd23f" }).setOrigin(0.5);
          add(val);
          add(button(this, 545, y, "−", () => { dec(); val.setText(get()); G.saveMeta(); }, { w: 40, h: 30 }));
          add(button(this, 695, y, "+", () => { inc(); val.setText(get()); G.saveMeta(); synth.play("ding"); }, { w: 40, h: 30 }));
          y += 38;
        };
        const toggle = (label: string, get: () => boolean, flip: () => void) => row(label, () => (get() ? "ON" : "OFF"), flip, flip);
        const pct = (v: number) => `${Math.round(v * 100)}%`;
        const clamp = (v: number) => Math.max(0, Math.min(1, Math.round(v * 10) / 10));
        if (this.settingsTab === 0) {
          row("Master volume", () => pct(set.master), () => (set.master = clamp(set.master - 0.1)), () => (set.master = clamp(set.master + 0.1)));
          row("Music volume", () => pct(set.music), () => (set.music = clamp(set.music - 0.1)), () => (set.music = clamp(set.music + 0.1)));
          row("SFX volume", () => pct(set.sfx), () => (set.sfx = clamp(set.sfx - 0.1)), () => (set.sfx = clamp(set.sfx + 0.1)));
          toggle("Character voices", () => set.voices !== false, () => (set.voices = set.voices === false));
          row("Voice volume", () => pct(set.voiceVolume ?? 0.8), () => (set.voiceVolume = clamp((set.voiceVolume ?? 0.8) - 0.1)), () => (set.voiceVolume = clamp((set.voiceVolume ?? 0.8) + 0.1)));
          row("Voice speed", () => `${(set.voiceSpeed ?? 1.5).toFixed(2).replace(/0$/, "")}x`, () => (set.voiceSpeed = Math.max(0.8, Math.round(((set.voiceSpeed ?? 1.5) - 0.05) * 20) / 20)), () => (set.voiceSpeed = Math.min(2, Math.round(((set.voiceSpeed ?? 1.5) + 0.05) * 20) / 20)));
        } else {
          row("Text speed", () => `${set.textSpeed.toFixed(1)}x`, () => (set.textSpeed = Math.max(0.5, set.textSpeed - 0.5)), () => (set.textSpeed = Math.min(4, set.textSpeed + 0.5)));
          toggle("Auto-advance dialogue", () => !!set.autoAdvance, () => (set.autoAdvance = !set.autoAdvance));
          toggle("Screen shake", () => set.shake, () => (set.shake = !set.shake));
          toggle("Reduce flashing", () => !!set.calmFlash, () => (set.calmFlash = !set.calmFlash));
          toggle("CRT effect (KrelTV)", () => set.crt, () => (set.crt = !set.crt));
          toggle("Gore (blood & dismemberment)", () => set.gore !== false, () => (set.gore = set.gore === false));
          const fs = () => {
            try {
              this.scale.toggleFullscreen();
            } catch {
              /* the browser said no */
            }
          };
          row("Fullscreen", () => (this.scale.isFullscreen ? "ON" : "OFF"), fs, fs);
          // auto-aim: a toggle once you own Krezz-Assist (or on touch, where it's the aim assist); otherwise a pointer to the shop
          const flipAim = () => (set.autoAim = set.autoAim === false);
          if (s?.upgrades.pk_autoaim) toggle("Auto-aim (Krezz-Assist)", () => set.autoAim !== false, flipAim);
          else if (TOUCH.enabled) toggle("Touch aim assist", () => set.autoAim !== false, flipAim);
          else add(this.add.text(200, y, "Auto-aim: buy Krezz-Assist at the Kreddle Exchange", { fontFamily: FONT, fontSize: "14px", color: "#6b6f82" }).setOrigin(0, 0.5));
        }
        add(button(this, 360, 478, "CONTROLS", () => this.openControls("settings"), { w: 180 }));
        add(button(this, 600, 478, "◀ BACK", () => (this.caller === "Title" ? this.close() : this.render("pause")), { w: 180 }));
        break;
      }
      case "log": {
        add(title(this, 480, 64, "DIALOGUE LOG", 24));
        const all = dialogueLog();
        if (!all.length) add(this.add.text(480, 260, "Nobody's said anything yet.", { fontFamily: FONT, fontSize: "16px", color: "#9aa0b4" }).setOrigin(0.5));
        // newest at the bottom; scroll back with the wheel / arrows / buttons
        const PER = 9;
        const maxScroll = Math.max(0, all.length - PER);
        this.logScroll = Math.max(0, Math.min(maxScroll, this.logScroll));
        const end = all.length - this.logScroll;
        const view = all.slice(Math.max(0, end - PER), end);
        // newest at the bottom, stacked upwards until the panel is full
        let ly = 444;
        for (const e of [...view].reverse()) {
          const t = this.add.text(e.dir ? 170 : 182, 0, e.text, { fontFamily: FONT, fontSize: "13px", color: e.dir ? "#b8bccb" : "#ffffff", fontStyle: e.dir ? "italic" : "normal", wordWrap: { width: 610 }, lineSpacing: 1 });
          const top = ly - t.height - (e.dir ? 0 : 16);
          if (top < 88) {
            t.destroy();
            break;
          }
          t.setY(ly - t.height);
          add(t);
          if (!e.dir) add(this.add.text(170, top, e.who, { fontFamily: FONT, fontSize: "12px", color: e.color !== undefined ? hexStr(e.color) : "#ffd23f", fontStyle: "bold" }));
          ly = top - 8;
        }
        add(button(this, 300, 470, "▲ OLDER", () => { this.logScroll = Math.min(maxScroll, this.logScroll + 3); this.render("log"); }, { w: 150, h: 32, size: 14, disabled: this.logScroll >= maxScroll }));
        add(button(this, 480, 470, "◀ BACK", () => this.render("pause"), { w: 170, h: 32, size: 14 }));
        add(button(this, 660, 470, "NEWER ▼", () => { this.logScroll = Math.max(0, this.logScroll - 3); this.render("log"); }, { w: 150, h: 32, size: 14, disabled: this.logScroll <= 0 }));
        break;
      }
      case "quests": {
        if (!s) break;
        add(title(this, 480, 64, "QUESTS", 24));
        const tabs = ["STORY", "SIDE QUESTS", "FACTS & STATS"];
        tabs.forEach((t, i) => add(button(this, 300 + i * 180, 100, t, () => { this.questTab = i as 0 | 1 | 2; this.questScroll = 0; this.render("quests"); }, { w: 170, h: 30, size: 13, color: this.questTab === i ? 0x7c3aed : undefined })));
        const where = (at?: string) => (!at || at === "FIELD" ? "" : `  (go to: ${at.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())})`);
        const out: { t: string; c?: string; b?: boolean }[] = [];
        const line = (t: string, c = "#ffffff", b = false) => out.push({ t, c, b });
        if (this.questTab === 0) {
          const ch = chapterDef(s.chapter);
          const st = currentStep();
          line(`CHAPTER ${s.chapter}: ${ch.title}`, "#ffd23f", true);
          if (ch.subtitle) line(ch.subtitle, "#b8bccb");
          line("");
          line("RIGHT NOW", "#86efac", true);
          line(st ? `${st.text}${where(st.target)}` : "Chapter complete.");
          line("");
          line("THIS CHAPTER", "#86efac", true);
          let reached = false;
          for (const c of ch.steps) {
            const done = evalCond(c.done, s);
            const now = !done && !reached;
            if (now) reached = true;
            line(`${done ? "✓" : now ? "•" : "○"} ${c.text}${!done ? where(c.target) : ""}`, done ? "#8b93a7" : now ? "#ffffff" : "#c9cbd6");
          }
          const req = requiredArcSteps(s);
          if (req.length) {
            line("");
            line(`SIDE QUESTS NEEDED BEFORE THIS CHAPTER'S DUNGEON (${req.length})`, "#fca5a5", true);
            for (const r of req) line(`• ${r.arc.title}: ${r.step.text}${where(r.step.at)}`);
          }
          const pq = personalQuest(s);
          if (pq) {
            line("");
            line(`PERSONAL: ${pq.title} ${s.flags[`pq_done_${pq.id}`] ? "(COMPLETE)" : `(${pickupsCollected(s, pq)}/${pq.pickups.length} found)`}`, "#ffd23f", true);
            line(pq.blurb, "#c9cbd6");
            if (!s.flags[`pq_done_${pq.id}`]) line(`Turn in at: ${pq.turnIn.at.replace(/_/g, " ")}`);
          }
        } else if (this.questTab === 1) {
          const open = currentArcSteps(s);
          const arcs = arcsFor(s.player);
          const active = arcs.filter((a) => !s.flags[`${a.id}_done`] && s.flags.met_emergency && arcAvailable(s, a));
          const done = arcs.filter((a) => s.flags[`${a.id}_done`]);
          const later = arcs.filter((a) => !s.flags[`${a.id}_done`] && !(s.flags.met_emergency && arcAvailable(s, a)));
          line(active.length ? `ON THE GO (${active.length})` : "NO SIDE QUESTS ON THE GO", "#86efac", true);
          for (const a of active) {
            const cur = open.find((c) => c.arc === a);
            const due = arcDue(a);
            line("");
            line(`${a.player === "ALL" ? "" : "YOUR STORY · "}${a.title}${due !== null ? `   [REQUIRED before the Chapter ${Math.max(due, s.chapter)} dungeon]` : "   [optional]"}`, "#ffd23f", true);
            line(a.blurb, "#c9cbd6");
            if (cur) line(`NEXT: ${cur.step.text}${where(cur.step.at)}`);
            for (const st of a.steps) line(`   ${stepDone(s, a, st) ? "✓" : cur?.step === st ? "•" : "○"} ${st.text}`, stepDone(s, a, st) ? "#8b93a7" : "#c9cbd6");
            line(`Reward: ${a.reward.descFor?.[s.player] ?? a.reward.desc}${a.reward.coins ? ` + ${a.reward.coins} Krezzcoin` : ""}`, "#a5b4fc");
          }
          if (s.flags.ministerial_quests) {
            const ms = MINISTRY_QUESTS.map((q) => [q, ministryQuestState(s, q)] as const).filter(([, stt]) => stt !== "locked");
            if (ms.length) {
              line("");
              line("MINISTERIAL JOBS", "#86efac", true);
              for (const [q, stt] of ms) {
                const giver = CHARACTERS[narrativeActor(q.ministry, s.player) as string]?.name ?? q.ministry;
                const prog = stt === "active" || stt === "ready" ? ` ${Math.min(q.target, ministryProgress(s, q))}/${q.target}` : "";
                line(`${stt === "done" ? "✓" : stt === "ready" ? "!" : stt === "active" ? "•" : "○"} ${q.title} (${giver})${prog}${stt === "available" ? " — talk to them to accept" : stt === "ready" ? " — hand it in" : ""}`, stt === "done" ? "#8b93a7" : "#ffffff");
              }
            }
          }
          if (later.length) {
            line("");
            line("COMING LATER", "#86efac", true);
            for (const a of later) line(`○ ${a.title} ${!s.flags.met_emergency ? "(after the Emergency Reaction Session)" : `(Chapter ${a.minChapter ?? 1}+)`}`, "#8b93a7");
          }
          if (done.length) {
            line("");
            line(`COMPLETED (${done.length})`, "#86efac", true);
            for (const a of done) line(`✓ ${a.title}`, "#8b93a7");
          }
        } else {
          line("KRAZY FACTS IN FORCE", "#ffd23f", true);
          if (!s.revisions.length) line("none");
          for (const r of s.revisions) line(`"${factById(r)?.fact}" — ${factById(r)?.effect}`);
          line("");
          line("STATS", "#ffd23f", true);
          line(`Kills ${counter(s, "kills_total")} · Perfect dodges ${counter(s, "perfect_dodge")} · Bans ${s.banCount} · Bongos ${counter(s, "bongos_drunk")}`);
          line(`Reactions 👍${s.reactionsGiven.LIKE} ❤️${s.reactionsGiven.LOVE} 😂${s.reactionsGiven.LAUGH} 😡${s.reactionsGiven.ANGRY} Seen ${s.reactionsGiven.SEEN}`);
          line(`Archive ${s.archiveUnlocked.length} records · KrelTV ${s.tvWatched.length} episodes · Playtime ${Math.round(s.playtimeMs / 60000)} min${s.ngPlus ? " · NEW KREZ+" : ""}`);
        }
        // the list scrolls inside the panel (mouse wheel, or the arrows)
        const top = 126;
        const bottom = 448;
        const box = this.add.container(0, 0);
        let y = 0;
        for (const o of out) {
          if (!o.t) {
            y += 8;
            continue;
          }
          const t = this.add.text(165, y, o.t, { fontFamily: FONT, fontSize: o.b ? "13px" : "12px", color: o.c, fontStyle: o.b ? "bold" : "normal", wordWrap: { width: 630 }, lineSpacing: 2 });
          box.add(t);
          y += t.height + 3;
        }
        const maxScroll = Math.max(0, y - (bottom - top));
        this.questScroll = Math.min(this.questScroll, maxScroll);
        box.setY(top - this.questScroll);
        const mask = this.make.graphics({}, false).fillRect(150, top, 660, bottom - top).createGeometryMask();
        box.setMask(mask);
        add(box);
        const scrollBy = (d: number) => {
          const n = Phaser.Math.Clamp(this.questScroll + d, 0, maxScroll);
          if (n === this.questScroll) return;
          this.questScroll = n;
          box.setY(top - n);
        };
        if (maxScroll > 0) {
          add(button(this, 300, 470, "▲ UP", () => scrollBy(-120), { w: 120, h: 32, size: 14 }));
          add(button(this, 660, 470, "DOWN ▼", () => scrollBy(120), { w: 120, h: 32, size: 14 }));
          const wheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => scrollBy(dy * 0.6);
          this.input.on("wheel", wheel);
          box.once("destroy", () => this.input.off("wheel", wheel));
        }
        add(button(this, 480, 470, "◀ BACK", () => this.render("pause"), { w: 170, h: 32, size: 14 }));
        break;
      }
      case "bank": {
        if (!s) break;
        this.renderBank(add);
        break;
      }
      case "tribunal": {
        if (!s) break;
        const officer = narrativeActor("FLENKY", s.player);
        add(title(this, 480, 70, "THE BAN TRIBUNAL", 26, "#ff6666"));
        add(this.add.text(480, 100, `Exile Appeals Officer: ${CHARACTERS[officer as string]?.name}${officer === "PROCTUS" ? " (acting, also banned)" : ""}\nYour Ban Risk: ${Math.round(s.banRisk)}% · Times banned: ${s.banCount}`, { fontFamily: FONT, fontSize: "13px", color: "#ffffff", align: "center" }).setOrigin(0.5, 0));
        const items: [string, () => void][] = [
          ["VIEW EXHIBITS (Flenky's removals)", () => switchTo(this, "Archive", { filter: "ban", returnAt: "BAN_TRIBUNAL" })],
          [`APPEAL: clear Ban Risk (40 Krezzcoin)`, () => this.appeal()],
          ["SPEAK TO THE OFFICER", () => this.officer(officer as string)],
          ["LEAVE", () => this.close()],
        ];
        items.forEach(([t, fn], i) => add(button(this, 480, 190 + i * 56, t, fn, { w: 420 })));
        break;
      }
      case "death": {
        add(title(this, 480, 110, "YOU HAVE BEEN KREZZED", 34, "#ff4d4d"));
        add(this.add.text(480, 160, "Not dead. Just... thoroughly krezzed. Somewhere, Drongus types 'should've reacted to the song'.", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", align: "center", wordWrap: { width: 560 } }).setOrigin(0.5));
        add(button(this, 480, 260, "TRY THE ROOM AGAIN (lose 10% Krezzcoin)", () => this.retry(), { w: 460 }));
        add(button(this, 480, 320, "RETURN TO KRELFORD", () => this.toHub(), { w: 460 }));
        // straight over the bridge to restock: guns, mods, ammo, a Lad for hire
        if (G.s.flags.met_emergency) add(button(this, 480, 380, "GO TO KREDDLE (guns · mods · ammo · Lads)", () => this.toKreddle(), { w: 460 }));
        // the first time you go down, if you've never been over the bridge: point at Kreddle's shops
        if (!G.s.flags.first_death_seen) {
          G.s.flags.first_death_seen = true;
          if (!G.s.flags.kreddle_seen) {
            add(this.add.rectangle(480, 470, 600, 84, 0x1a0b2e, 0.95).setStrokeStyle(2, 0xff4fd8));
            add(
              this.add
                .text(480, 470, "💡 TIP: Struggling? Head to KREDDLE, over the bridge at the far WEST of Krelford.\nThe Kreddle Exchange sells new guns, ammo and upgrades, and you can hire a lad to fight with you.", {
                  fontFamily: FONT,
                  fontSize: "13px",
                  color: "#ffd1f3",
                  align: "center",
                  wordWrap: { width: 570 },
                  lineSpacing: 4,
                })
                .setOrigin(0.5),
            );
          }
          G.save();
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------------ the Kreddle Exchange (bank)

  private setBankTab(t: BankTab) {
    if (t === this.bankTab || !this.shop) return;
    this.bankSel[this.bankTab] = this.shop.index;
    this.bankTab = t;
    synth.play("select");
    this.render("bank");
  }

  /** The gun whose mods are on show (falls back to the Fart Blaster if you've lost it). */
  private currentModGun(): string {
    const list = moddableGuns(G.s);
    if (!list.includes(this.modGun)) this.modGun = list[0];
    return this.modGun;
  }

  private cycleModGun(d: number) {
    const list = moddableGuns(G.s);
    const i = list.indexOf(this.currentModGun());
    this.pickModGun(list[(i + d + list.length) % list.length]);
  }

  private pickModGun(id: string) {
    if (id === this.modGun || !this.shop) return;
    this.modGun = id;
    synth.play("select");
    this.bankSel.mods = 0;
    this.render("bank");
  }

  /** "Damage 12 → 13.4" style line for a mod card. */
  private modPreview(gun: string, stat: ModStat, lvl: number, maxed: boolean): string {
    const s = G.s;
    const nextLvl = (n: number) => ({ ...s, upgrades: { ...s.upgrades, [`gm_${gun}_${stat}`]: n } }) as typeof s;
    const r = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? `${Math.round(v)}` : v.toFixed(1));
    const val = (st: typeof s): string => {
      if (gun === FART_ID) {
        const f = moddedFart(st);
        return stat === "dmg" ? `damage ${r(f.dmg)}` : stat === "rof" ? `${(1000 / f.cd).toFixed(1)} shots/s` : stat === "range" ? `range ${r(f.range)}` : `pierce ${f.pierce}`;
      }
      const g = moddedGun(GUNS[gun], st);
      switch (stat) {
        case "dmg": return `damage ${r(g.dmg)}${g.pellets > 1 ? `×${g.pellets}` : ""}`;
        case "rof": return `${(1000 / g.cd).toFixed(1)} shots/s`;
        case "mag": return `max ammo ${Math.round(GUNS[gun].maxAmmo * (1 + 0.25 * (st.upgrades.pk_ammo ?? 0) + MOD_EFFECT.mag * (st.upgrades[`gm_${gun}_mag`] ?? 0)))}`;
        case "spread": return `spread ±${Math.round((g.spread * 180) / Math.PI)}°`;
        case "range": return `range ${r(g.range)}`;
        case "pierce": return `pierce ${g.pierce ?? 0}`;
        case "pellets": return `${g.pellets} per shot`;
        case "blast": return `blast ${r(g.blast ?? 0)}`;
        case "homing": return `homing ${r(g.homing ?? 0)}`;
        case "luck": return `luck +${st.upgrades[`gm_${gun}_luck`] ?? 0}`;
      }
    };
    return maxed ? `Now: ${val(s)}. Maxed.` : `${val(s)} → ${val(nextLvl(lvl + 1))}.`;
  }

  /** GUN MODS: a strip of your guns (pick one), with the picked gun's name and how modded it is. */
  private renderModStrip(add: (o: Phaser.GameObjects.GameObject) => void) {
    const s = G.s;
    const list = moddableGuns(s);
    const cur = this.currentModGun();
    const n = list.length;
    const bw = Math.min(84, Math.floor((920 - 6 * (n - 1)) / n));
    const x0 = 480 - (n * bw + 6 * (n - 1)) / 2;
    const y = 150;
    list.forEach((id, i) => {
      const cx = x0 + i * (bw + 6) + bw / 2;
      const on = id === cur;
      const mods = gunModList(s, id);
      const have = mods.reduce((a, m) => a + m.lvl, 0);
      const max = mods.reduce((a, m) => a + m.max, 0);
      const bg = this.add.rectangle(cx, y, bw, 46, on ? 0x3a2770 : 0x1d1a3a, 0.95).setStrokeStyle(on ? 3 : 1, on ? 0xffd23f : have >= max ? 0x22c55e : 0x4c4785).setInteractive({ useHandCursor: true });
      bg.on("pointerup", () => this.pickModGun(id));
      add(bg);
      const box = Math.min(bw - 8, 34);
      if (id === FART_ID) add(this.add.text(cx, y - 5, "💨", { fontFamily: FONT, fontSize: `${Math.round(box * 0.7)}px` }).setOrigin(0.5));
      else if (this.textures.exists(GUNS[id].tex)) {
        const img = this.add.image(cx, y - 5, GUNS[id].tex);
        img.setScale(box / Math.max(img.width, img.height));
        if (GUNS[id].shop && !GUNS[id].mech) img.setTint(GUNS[id].color);
        add(img);
      }
      add(this.add.text(cx, y + 15, `${have}/${max}`, { fontFamily: PIXEL_BOLD, fontSize: "11px", color: have >= max ? "#4ade80" : have ? "#ffd23f" : "#9aa0b4", fontStyle: "bold" }).setOrigin(0.5));
    });
    const name = cur === FART_ID ? "FART BLASTER" : GUNS[cur].name.toUpperCase();
    const mods = gunModList(s, cur);
    add(this.add.text(30, 194, `${name}  ·  ${mods.reduce((a, m) => a + m.lvl, 0)}/${mods.reduce((a, m) => a + m.max, 0)} mod levels`, { fontFamily: PIXEL_BOLD, fontSize: "18px", color: "#ffd23f", fontStyle: "bold", stroke: "#12001f", strokeThickness: 4 }).setOrigin(0, 0.5));
    add(this.add.text(930, 194, cur === FART_ID ? "Always yours. Infinite ammo." : "Mods only change this gun.", { fontFamily: PIXEL_FONT, fontSize: "14px", color: "#c4bdf0", stroke: "#12001f", strokeThickness: 3 }).setOrigin(1, 0.5));
  }

  private renderBank(add: (o: Phaser.GameObjects.GameObject) => void) {
    const s = G.s;
    // see-through over the neon counter room (if its art is loaded), so the shop feels like a place
    add(panel(this, 8, 6, 944, 528, this.textures.exists("bg_kreddle_exchange") ? 0.35 : 0.97));
    const head = this.add.text(30, 34, "KREDDLE EXCHANGE", { fontFamily: PIXEL_BOLD, fontSize: "32px", color: "#ff4fd8", stroke: "#12001f", strokeThickness: 6 }).setOrigin(0, 0.5);
    head.setShadow(0, 0, "#ff4fd8", 10, true, true);
    add(head);
    // the keys, in two short lines so they never run under the PRIZES button
    let hintRight = head.x + head.width;
    if (!TOUCH.enabled) {
      const hint = this.add.text(head.x + head.width + 18, 36, this.bankTab === "mods" ? "E BUY · TAB TABS\nZ/C GUN · ESC LEAVE" : "E BUY · TAB TABS\nESC LEAVE", { fontFamily: PIXEL_FONT, fontSize: "13px", color: "#c4bdf0", stroke: "#12001f", strokeThickness: 4, lineSpacing: -2 }).setOrigin(0, 0.5);
      add(hint);
      hintRight = hint.x + hint.width;
    }
    // close (and, in Kreddle, the way over to the Prize Counter)
    const close = button(this, 914, 34, "✕", () => this.close(), { w: 48, h: 44, size: 22, color: 0x7f1d1d });
    add(close);
    if (this.caller === "Kreddle") {
      add(button(this, Phaser.Math.Clamp(hintRight + 84, 610, 656), 34, "🎟 PRIZES ▸", () => {
        this.scene.get("Kreddle").events.emit("open-prizes");
        this.close();
      }, { w: 140, h: 40, size: 15, color: 0x3b0764 }));
    }
    add(shopTabs(this, 20, 86, 920, BANK_TABS, this.bankTab, (id) => this.setBankTab(id as BankTab)));
    const mods = this.bankTab === "mods";
    if (mods) this.renderModStrip(add);
    const shop = new ShopGrid(this, {
      x: 20,
      y: mods ? 214 : 116,
      w: 920,
      h: mods ? 218 : 316,
      cols: 6,
      rows: mods ? 1 : 2,
      detail: { x: 20, y: 442, w: 920, h: 86 },
      balances: [{ currency: "coin", x: 860, y: 34 }],
      balance: () => G.s.coins,
      onBuy: (it) => {
        const ok = this.bankBuy(it.id);
        if (ok) {
          G.save();
          shop.setItems(this.bankItems());
        }
        return ok;
      },
    });
    this.shop = shop;
    add(shop.root);
    shop.setItems(this.bankItems(), this.bankSel[this.bankTab] ?? 0);
    void s;
  }

  /** What's on the shelves in the current tab. */
  private bankItems(): ShopItem[] {
    const s = G.s;
    const item = (o: Partial<ShopItem> & Pick<ShopItem, "id" | "name" | "icon" | "desc">): ShopItem => ({ price: 0, currency: "coin", state: "buy", ...o });
    const out: ShopItem[] = [];
    if (this.bankTab === "upgrades") {
      for (const u of GENERIC_UPGRADES) {
        const lvl = s.upgrades[u.id] ?? 0;
        out.push(item({ id: u.id, name: u.name, icon: u.icon, desc: u.desc, price: upgradeCost(s, lvl, u.base), lvl: [lvl, u.max], state: lvl >= u.max ? "maxed" : "buy" }));
      }
      const def = CHARACTERS[s.player];
      const face = portraitKey(this, s.player) ?? "⭐";
      def.branch?.forEach((b, i) => {
        const owned = !!s.upgrades[b.id];
        const prevOk = i === 0 || !!s.upgrades[def.branch![i - 1].id];
        out.push(
          item({
            id: b.id,
            name: b.name,
            icon: face,
            desc: b.desc,
            price: this.branchCost(b.cost),
            tag: `${def.name.split(" ")[0]} ${"I".repeat(i + 1)}`,
            tagColor: def.color,
            state: owned ? "owned" : prevOk ? "buy" : "locked",
            lockReason: `BUY ${"I".repeat(i)} FIRST`,
          }),
        );
      });
    } else if (this.bankTab === "armoury") {
      s.guns = s.guns ?? {};
      const all = this.refillQuote();
      out.push(
        item({
          id: "refill_all",
          name: "Refill Everything",
          icon: "p_ammo",
          desc: all.boxes ? `Tops up every gun you own (${all.boxes} boxes), as far as your money goes.` : "Every gun you own is full. The Fart Blaster never runs out.",
          price: all.cost,
          minPrice: all.unit.length ? Math.min(...all.unit) : 0,
          state: all.boxes ? "buy" : "full",
          verb: "FILL",
        }),
      );
      // (the old bank guns share another gun's art, so they're tinted their own colour)
      const icon = (id: string) => ({ icon: GUNS[id].tex, iconTint: GUNS[id].shop && !GUNS[id].mech ? GUNS[id].color : undefined });
      // for sale first (Exchange exclusives, then the crate guns as they unlock), then ammo for what you've got
      const forSale = GUN_ORDER.filter((id) => !(id in s.guns!) && (GUNS[id].shop || GUNS[id].price));
      forSale.sort((a, b) => Number(!GUNS[a].shop) - Number(!GUNS[b].shop));
      for (const id of forSale) {
        const g = GUNS[id];
        const locked = !g.shop && g.minChapter > s.chapter;
        out.push(
          item({
            id: `gun_${id}`,
            name: g.name,
            ...icon(id),
            desc: g.shop ? `${g.blurb} Exchange exclusive: never in a crate.` : `${g.blurb} (Also turns up in dungeon crates.)`,
            price: g.shop ?? g.price!,
            tag: g.shop ? (g.mech ? "EXCLUSIVE" : "NEW") : "CRATE GUN",
            tagColor: g.shop ? 0xff4fd8 : 0x67e8f9,
            state: locked ? "locked" : "buy",
            lockReason: `CHAPTER ${g.minChapter}`,
          }),
        );
      }
      for (const id of orderedGuns(s)) {
        const g = GUNS[id];
        if (g.maxAmmo >= 9999) {
          out.push(item({ id: `ammo_${id}`, name: g.name, ...icon(id), desc: `${g.blurb} Never runs dry.`, state: "full", tag: "∞" }));
          continue;
        }
        const q = ammoQuote(s, id);
        out.push(
          item({
            id: `ammo_${id}`,
            name: g.name,
            ...icon(id),
            desc: `${g.pickup} rounds a box, ${q.unit} each. Fills it as far as your money goes.`,
            price: q.fill,
            minPrice: q.unit,
            bar: [q.have, q.max],
            tag: q.have <= 0 ? "EMPTY" : undefined,
            tagColor: 0xff5a5a,
            state: q.full ? "full" : "buy",
            verb: "FILL",
          }),
        );
      }
    } else if (this.bankTab === "mods") {
      const gun = this.currentModGun();
      for (const m of gunModList(s, gun)) {
        const info = MOD_INFO[m.stat];
        const maxed = m.lvl >= m.max;
        const what = m.stat === "luck" ? LUCK_TEXT[gun] ?? info.desc : info.desc;
        out.push(
          item({
            id: `mod_${m.stat}`,
            name: `${info.short} ${m.lvl}/${m.max}`,
            icon: info.icon,
            desc: `${info.name}: ${what} ${this.modPreview(gun, m.stat, m.lvl, maxed)}`,
            price: m.price,
            lvl: [m.lvl, m.max],
            state: maxed ? "maxed" : "buy",
            verb: "UPGRADE",
          }),
        );
      }
    } else if (this.bankTab === "perks") {
      for (const p of BANK_PERKS) {
        const lvl = s.upgrades[p.id] ?? 0;
        out.push(item({ id: p.id, name: p.name, icon: p.icon, desc: p.desc, price: p.cost * (lvl + 1), lvl: [lvl, p.max], state: lvl >= p.max ? "maxed" : "buy" }));
      }
    } else {
      const hired = typeof s.flags.companion === "string" ? (s.flags.companion as string) : "";
      out.push(
        item({
          id: "lad",
          name: hired ? `${CHARACTERS[hired]?.name} hired` : "Hire a Lad",
          icon: (hired && portraitKey(this, hired)) || "🤝",
          desc: hired ? "Waiting by the dungeon door. Goes home when you get back to town." : "A random lad fights by your side for one dungeon. Can't die. Won't shut up.",
          price: LAD_COST,
          state: hired ? "owned" : "buy",
          verb: "HIRE",
        }),
      );
      for (const m of BANK_MOVES) out.push(item({ id: m.id, name: m.name, icon: m.icon, desc: m.desc, price: m.cost, state: s.upgrades[m.id] ? "owned" : "buy" }));
    }
    return out;
  }

  private branchCost(cost: number) {
    return Math.round(cost * (G.s.player === "KREZMAR" ? 0.9 : 1));
  }

  /** Buy whatever the card with this id is. True if money changed hands. */
  private bankBuy(id: string): boolean {
    const s = G.s;
    if (id === "refill_all") return this.refillAll();
    if (id === "lad") return this.hireLad();
    if (id.startsWith("gun_")) return this.buyGun(id.slice(4));
    if (id.startsWith("ammo_")) return buyAmmo(s, id.slice(5)) > 0;
    if (id.startsWith("mod_")) return buyMod(s, this.currentModGun(), id.slice(4) as ModStat);
    const gen = GENERIC_UPGRADES.find((u) => u.id === id);
    if (gen) return this.buy(id, upgradeCost(s, s.upgrades[id] ?? 0, gen.base), gen.max);
    const perk = BANK_PERKS.find((p) => p.id === id);
    if (perk) return this.buy(id, perk.cost * ((s.upgrades[id] ?? 0) + 1), perk.max);
    const move = BANK_MOVES.find((m) => m.id === id);
    if (move) return this.buyBranch(id, move.cost);
    const def = CHARACTERS[s.player];
    const i = def.branch?.findIndex((b) => b.id === id) ?? -1;
    if (i >= 0 && (i === 0 || s.upgrades[def.branch![i - 1].id])) return this.buyBranch(id, this.branchCost(def.branch![i].cost));
    return false;
  }

  private buy(id: string, cost: number, max: number): boolean {
    const s = G.s;
    if (s.coins < cost || (s.upgrades[id] ?? 0) >= max) return false;
    s.coins -= cost;
    s.upgrades[id] = (s.upgrades[id] ?? 0) + 1;
    if (id === "hp") s.hp = Math.min(maxHp(s), s.hp + 15);
    return true;
  }

  private hireLad(): boolean {
    const s = G.s;
    if (s.coins < LAD_COST || typeof s.flags.companion === "string") return false;
    s.coins -= LAD_COST;
    const id = Companion.pick(s.player);
    s.flags.companion = id;
    G.emit("toast", { title: "LAD HIRED", text: `${CHARACTERS[id]?.name} will meet you at the next dungeon.` });
    return true;
  }

  private buyGun(id: string): boolean {
    const s = G.s;
    const g = GUNS[id];
    const price = g?.shop ?? g?.price;
    if (!g || !price || s.coins < price || (s.guns && id in s.guns)) return false;
    if (!g.shop && g.minChapter > s.chapter) return false;
    s.coins -= price;
    s.guns = s.guns ?? {};
    s.guns[id] = g.pickup * 2;
    s.gun = id;
    G.emit("toast", { title: "KREDDLE EXCHANGE", text: `${g.name} acquired. Equipped. X to swap weapons.` });
    return true;
  }

  private refillQuote(): { cost: number; boxes: number; unit: number[] } {
    const s = G.s;
    let cost = 0;
    let boxes = 0;
    const unit: number[] = [];
    for (const id of GUN_ORDER) {
      if (!s.guns || !(id in s.guns) || GUNS[id].maxAmmo >= 9999) continue;
      const q = ammoQuote(s, id);
      boxes += q.boxes;
      cost += q.fill;
      if (q.boxes) unit.push(q.unit);
    }
    return { cost, boxes, unit };
  }

  /** Fill every owned gun, emptiest first, until the money runs out. */
  private refillAll(): boolean {
    const s = G.s;
    if (!s.guns) return false;
    let any = false;
    for (let pass = 0; pass < 200; pass++) {
      const owned = GUN_ORDER.filter((id) => s.guns && id in s.guns && GUNS[id].maxAmmo < 9999 && s.guns[id] < gunMax(GUNS[id], s) && s.coins >= ammoUnitCost(id));
      if (!owned.length) break;
      owned.sort((a, b) => s.guns![a] / gunMax(GUNS[a], s) - s.guns![b] / gunMax(GUNS[b], s));
      const id = owned[0];
      s.coins -= ammoUnitCost(id);
      s.guns[id] = Math.min(gunMax(GUNS[id], s), s.guns[id] + GUNS[id].pickup);
      any = true;
    }
    return any;
  }

  private buyBranch(id: string, cost: number): boolean {
    const s = G.s;
    if (s.coins < cost || s.upgrades[id]) return false;
    s.coins -= cost;
    s.upgrades[id] = 1;
    if (id === "gr1") s.hp = Math.min(maxHp(s), s.hp + 30);
    return true;
  }

  private appeal() {
    const s = G.s;
    if (s.banRisk <= 0) {
      G.emit("toast", { title: "TRIBUNAL", text: "You have no Ban Risk. This is deeply suspicious. Noted." });
      return;
    }
    if (s.coins < 40) {
      G.emit("toast", { title: "TRIBUNAL", text: "Appeals cost 40 Krezzcoin. Justice isn't free. It's 40." });
      return;
    }
    s.coins -= 40;
    s.banRisk = 0;
    synth.play("ding");
    G.save();
    this.render("tribunal");
  }

  private async officer(id: string) {
    this.root.setVisible(false);
    const box = new DialogueBox(this, 1000);
    const lines =
      id === "PROCTUS"
        ? [say("PROCTUS", "Welcome to the Ban Tribunal. I'm the Acting Exile Appeals Officer. I'm also currently banned. I'm hearing my own appeal at three."), say("PROCTUS", "My advice: keep moving, don't dodge when they say not to, and never, ever have parents who are still together.")]
        : [say("FLENKY", "Exile Appeals Officer. Most qualified man in the realm."), say("FLENKY", "Nine removals. Ten with the Queen one. I know every corridor in this chat."), say("FLENKY", "Tip: when he says 'and I mean it', he doesn't. Usually. Get a couple pints down you and appeal.")];
    await box.play(lines);
    box.destroy();
    this.root.setVisible(true);
  }

  /** Why SAVE GAME is locked right now (null = you can save). Town and home only. */
  private saveBlocked(): string | null {
    if (this.inDungeon()) return "not inside a dungeon";
    if (this.caller !== "Hub" && this.caller !== "Home") return "only in town or at home";
    const mgr = this.game.scene;
    if (["Dialogue", "Cutscene", "Meeting", "Vignette", "TV", "Minigame", "Finale", "Lair"].some((k) => mgr.isActive(k) || mgr.isPaused(k))) return "not during a scene";
    return null;
  }

  /** SAVE GAME: the slot picker over the pause menu (it closes the menu once you've saved). */
  private openSlots() {
    this.events.off("slots-closed");
    this.events.once("slots-closed", (d: { saved?: boolean }) => (d?.saved ? this.close() : this.render("pause")));
    this.scene.launch("Slots", { mode: "save", caller: "Menu" });
  }

  private quit() {
    G.save();
    const caller = this.caller ? this.scene.get(this.caller) : null;
    switchTo(caller ?? this, "Title");
    this.scene.stop();
  }

  private retry() {
    const s = G.s;
    s.coins = Math.floor(s.coins * 0.9);
    s.hp = maxHp(s);
    s.banRisk = 0;
    const d = this.data0;
    const caller = this.scene.get("Dungeon");
    switchTo(caller, "Dungeon", { dungeon: d.dungeon, room: d.room, rush: d.rush });
    this.scene.stop();
  }

  private toHub() {
    const s = G.s;
    s.hp = maxHp(s);
    s.banRisk = 0;
    s.phase = "hub";
    G.save();
    const caller = this.scene.get("Dungeon");
    switchTo(caller, "Hub", {});
    this.scene.stop();
  }

  private toKreddle() {
    const s = G.s;
    s.hp = maxHp(s);
    s.banRisk = 0;
    s.phase = "hub";
    G.save();
    const caller = this.scene.get("Dungeon");
    switchTo(caller, "Kreddle", {});
    this.scene.stop();
  }

  /**
   * In a dungeon right now (difficulty is locked): the Dungeon scene is up, or we're in one of a dungeon's detours
   * (a drive, a minigame...) that resumes back into it.
   */
  private inDungeon(): boolean {
    const mgr = this.game.scene;
    if (mgr.isActive("Dungeon") || mgr.isPaused("Dungeon") || mgr.isSleeping("Dungeon")) return true;
    if (this.caller === "Dungeon") return true;
    return mgr.getScenes(false).some((sc) => {
      const k = sc.scene.key;
      if (k === "Menu" || !(mgr.isActive(k) || mgr.isPaused(k))) return false;
      const d = sc.sys.settings.data as { resume?: { dungeon?: string } } | undefined;
      return !!d?.resume?.dungeon;
    });
  }

  private setDifficulty(level: number) {
    if (!G.hasRun()) return;
    if (this.inDungeon()) {
      synth.play("tap_fail");
      return;
    }
    const was = G.s.difficulty;
    G.s.difficulty = clampDifficulty(level);
    G.save();
    if (was !== G.s.difficulty) {
      synth.play("ding");
      G.emit("toast", { title: "DIFFICULTY CHANGED", text: `${difficultyLabel(G.s.difficulty)}. Kicks in from the next room or fight.` });
    }
    this.render("difficulty");
  }

  private close() {
    if (this.caller && this.scene.isPaused(this.caller)) {
      this.scene.resume(this.caller);
      this.scene.get(this.caller).events.emit("ui-resume");
    }
    this.scene.stop();
  }
}

export { UI };

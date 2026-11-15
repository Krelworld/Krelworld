import Phaser from "phaser";
import { ACTIONS, bindKey, keyNameFromEvent, keysFor, prettyKey, resetKeys } from "../systems/keybinds";
import { G } from "../G";
import { button, FONT, panel, title, UI } from "../ui/theme";
import { switchTo, currentStep } from "../Flow";
import { synth } from "../audio/Synth";
import { CHARACTERS } from "../../data/characters";
import { GENERIC_UPGRADES, upgradeCost, maxHp, counter } from "../systems/stats";
import { GUNS, GUN_ORDER, gunMax } from "../combat/Guns";
import { ammoUnitCost, BANK_PERKS, buyAmmo } from "../systems/armoury";
import { Companion } from "../combat/Companion";
import { arcsFor, arcAvailable, currentArcSteps, stepDone } from "../systems/arcs";
import { personalQuest, pickupsCollected, MINISTRY_QUESTS, ministryQuestState, ministryProgress } from "../systems/quests";
import { factById } from "../../data/historicalRevisions";
import { narrativeActor } from "../systems/narrative";
import { DialogueBox } from "../ui/DialogueBox";
import { bindPad, btnDown, firstDown, PAD_DEFAULTS, PAD_FIXED, PAD_START, padFor, padLabel, resetPad } from "../systems/padbinds";
import { TOUCH } from "../ui/TouchControls";
import { say } from "../../content/dsl";

type Mode = "pause" | "settings" | "bank" | "tribunal" | "death" | "quests" | "controls";

// (the perks list lives with the rest of the armoury rules)
export { BANK_PERKS };
export const BANK_MOVES = [
  { id: "mv_charge", name: "Pub Shove", desc: "Your dodge becomes a shoulder charge: damages and flings anything you barrel through.", cost: 320 },
  { id: "mv_fart", name: "Fart Propulsion", desc: "Every dodge leaves a lingering fart cloud that hurts and slows enemies.", cost: 280 },
  { id: "mv_lastorders", name: "Last Orders", desc: "Drinking pussy juice (Q) sends out a shockwave that knocks everything around you flying.", cost: 360 },
];

/** Overlay menus: pause, settings, bank (upgrades), ban tribunal, quests, death. */
export class MenuScene extends Phaser.Scene {
  private bankTab: "upgrades" | "armoury" | "perks" | "moves" = "upgrades";
  private mode: Mode = "pause";
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
    if (this.mode === "settings" || this.mode === "quests") {
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
    const add = (o: Phaser.GameObjects.GameObject) => this.root.add(o);
    add(this.add.rectangle(0, 0, 960, 540, 0x000000, 0.7).setOrigin(0).setInteractive());
    add(panel(this, 140, 40, 680, 460));
    const s = G.hasRun() ? G.s : null;
    switch (mode) {
      case "pause": {
        add(title(this, 480, 74, "PAUSED", 28));
        const st = s ? currentStep() : null;
        if (st) add(this.add.text(480, 104, `Objective: ${st.text}`, { fontFamily: FONT, fontSize: "13px", color: "#ffffff", wordWrap: { width: 600 }, align: "center" }).setOrigin(0.5, 0));
        const items: [string, () => void][] = [
          ["RESUME", () => this.close()],
          ["QUESTS, FACTS & STATS", () => this.render("quests")],
          ["CONTROLS", () => this.openControls("pause")],
          ["SETTINGS", () => this.render("settings")],
        ];
        if (this.caller === "Hub") items.push(["SAVE GAME", () => this.saveNow()]);
        items.push(["QUIT TO TITLE (progress is autosaved)", () => this.quit()]);
        items.forEach(([t, fn], i) => add(button(this, 480, 160 + i * 50, t, fn, { w: 380 })));
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
        add(title(this, 480, 74, "SETTINGS", 28));
        const set = G.meta.settings;
        const row = (y: number, label: string, get: () => string, dec: () => void, inc: () => void) => {
          // (rows squeezed a touch to fit the auto-aim toggle)
          y = 108 + ((y - 112) / 36) * 34;
          add(this.add.text(220, y, label, { fontFamily: FONT, fontSize: "16px", color: "#ffffff" }).setOrigin(0, 0.5));
          const val = this.add.text(600, y, get(), { fontFamily: FONT, fontSize: "16px", color: "#ffd23f" }).setOrigin(0.5);
          add(val);
          add(button(this, 530, y, "−", () => { dec(); val.setText(get()); G.saveMeta(); }, { w: 40, h: 30 }));
          add(button(this, 670, y, "+", () => { inc(); val.setText(get()); G.saveMeta(); synth.play("ding"); }, { w: 40, h: 30 }));
        };
        const pct = (v: number) => `${Math.round(v * 100)}%`;
        const clamp = (v: number) => Math.max(0, Math.min(1, Math.round(v * 10) / 10));
        row(112, "Master volume", () => pct(set.master), () => (set.master = clamp(set.master - 0.1)), () => (set.master = clamp(set.master + 0.1)));
        row(148, "Music volume", () => pct(set.music), () => (set.music = clamp(set.music - 0.1)), () => (set.music = clamp(set.music + 0.1)));
        row(184, "SFX volume", () => pct(set.sfx), () => (set.sfx = clamp(set.sfx - 0.1)), () => (set.sfx = clamp(set.sfx + 0.1)));
        row(220, "Text speed", () => `${set.textSpeed.toFixed(1)}x`, () => (set.textSpeed = Math.max(0.5, set.textSpeed - 0.5)), () => (set.textSpeed = Math.min(4, set.textSpeed + 0.5)));
        row(256, "Screen shake", () => (set.shake ? "ON" : "OFF"), () => (set.shake = !set.shake), () => (set.shake = !set.shake));
        row(292, "CRT effect (KrelTV)", () => (set.crt ? "ON" : "OFF"), () => (set.crt = !set.crt), () => (set.crt = !set.crt));
        row(328, "Character voices", () => (set.voices !== false ? "ON" : "OFF"), () => (set.voices = set.voices === false), () => (set.voices = set.voices === false));
        row(364, "Voice volume", () => pct(set.voiceVolume ?? 0.8), () => (set.voiceVolume = clamp((set.voiceVolume ?? 0.8) - 0.1)), () => (set.voiceVolume = clamp((set.voiceVolume ?? 0.8) + 0.1)));
        row(400, "Voice speed", () => `${(set.voiceSpeed ?? 1.25).toFixed(2).replace(/0$/, "")}x`, () => (set.voiceSpeed = Math.max(0.8, Math.round(((set.voiceSpeed ?? 1.25) - 0.05) * 20) / 20)), () => (set.voiceSpeed = Math.min(2, Math.round(((set.voiceSpeed ?? 1.25) + 0.05) * 20) / 20)));
        row(436, "Gore (blood & dismemberment)", () => (set.gore !== false ? "ON" : "OFF"), () => (set.gore = set.gore === false), () => (set.gore = set.gore === false));
        // auto-aim: a toggle once you own Krezz-Assist (or on touch, where it's the aim assist); otherwise a pointer to the shop
        const flipAim = () => (set.autoAim = set.autoAim === false);
        if (s?.upgrades.pk_autoaim) row(472, "Auto-aim (Krezz-Assist)", () => (set.autoAim !== false ? "ON" : "OFF"), flipAim, flipAim);
        else if (TOUCH.enabled) row(472, "Touch aim assist", () => (set.autoAim !== false ? "ON" : "OFF"), flipAim, flipAim);
        else add(this.add.text(220, 448, "Auto-aim: buy Krezz-Assist at the Kreddle Exchange", { fontFamily: FONT, fontSize: "14px", color: "#6b6f82" }).setOrigin(0, 0.5));
        add(button(this, 360, 495, "CONTROLS", () => this.openControls("settings"), { w: 180 }));
        add(button(this, 600, 495, "◀ BACK", () => (this.caller === "Title" ? this.close() : this.render("pause")), { w: 180 }));
        break;
      }
      case "quests": {
        if (!s) break;
        add(title(this, 480, 64, "QUESTS · KRAZY FACTS · STATS", 22));
        const lines: string[] = [];
        const st = currentStep();
        lines.push(`CHAPTER ${s.chapter} — ${st ? st.text : "Complete"}`);
        const pq = personalQuest(s);
        if (pq) {
          lines.push("");
          lines.push(`PERSONAL: ${pq.title} ${s.flags[`pq_done_${pq.id}`] ? "(COMPLETE)" : `(${pickupsCollected(s, pq)}/${pq.pickups.length})`}`);
          lines.push(`  ${pq.blurb}`);
          if (!s.flags[`pq_done_${pq.id}`]) lines.push(`  Turn in at: ${pq.turnIn.at.replace("_", " ")}`);
        }
        const open = currentArcSteps(s);
        for (const arc of arcsFor(s.player)) {
          lines.push("");
          const cur = open.find((c) => c.arc === arc);
          const lock = s.flags[`${arc.id}_done`] ? "(COMPLETE)" : !s.flags.met_emergency ? "(unlocks after the Emergency Reaction Session)" : !arcAvailable(s, arc) ? `(unlocks in Chapter ${arc.minChapter})` : "";
          lines.push(`${arc.player === "ALL" ? "SIDE QUEST" : "SIDE STORY"}: ${arc.title} ${lock}`);
          if (lock && !s.flags[`${arc.id}_done`]) continue;
          for (const st of arc.steps) lines.push(`  ${stepDone(s, arc, st) ? "✓" : cur?.step === st ? "•" : "○"} ${st.text}`);
        }
        if (s.flags.ministerial_quests) {
          lines.push("");
          lines.push("MINISTERIAL:");
          for (const q of MINISTRY_QUESTS) {
            const stt = ministryQuestState(s, q);
            if (stt === "locked") continue;
            const giver = CHARACTERS[narrativeActor(q.ministry, s.player) as string]?.name ?? q.ministry;
            const prog = stt === "active" || stt === "ready" ? ` ${Math.min(q.target, ministryProgress(s, q))}/${q.target}` : "";
            lines.push(`  ${stt === "done" ? "✓" : stt === "ready" ? "!" : stt === "active" ? "•" : "○"} ${q.title} (${giver})${prog}${stt === "available" ? " — talk to them to accept" : stt === "ready" ? " — hand in" : ""}`);
          }
        }
        lines.push("");
        lines.push(`KRAZY FACTS IN FORCE: ${s.revisions.length ? "" : "none"}`);
        for (const r of s.revisions) lines.push(`  "${factById(r)?.fact}" — ${factById(r)?.effect}`);
        lines.push("");
        lines.push(`Kills ${counter(s, "kills_total")} · Perfect dodges ${counter(s, "perfect_dodge")} · Bans ${s.banCount} · Bongos ${counter(s, "bongos_drunk")} · Reactions 👍${s.reactionsGiven.LIKE} ❤️${s.reactionsGiven.LOVE} 😂${s.reactionsGiven.LAUGH} 😡${s.reactionsGiven.ANGRY} Seen ${s.reactionsGiven.SEEN}`);
        lines.push(`Archive ${s.archiveUnlocked.length} records · KrelTV ${s.tvWatched.length} episodes · Playtime ${Math.round(s.playtimeMs / 60000)} min${s.ngPlus ? " · NEW KREZ+" : ""}`);
        add(this.add.text(160, 90, lines.join("\n"), { fontFamily: FONT, fontSize: "12px", color: "#ffffff", wordWrap: { width: 640 }, lineSpacing: 2 }));
        add(button(this, 480, 470, "◀ BACK", () => this.render("pause"), { w: 200 }));
        break;
      }
      case "bank": {
        if (!s) break;
        const minister = narrativeActor("KREZMAR", s.player);
        add(title(this, 480, 52, "THE KREDDLE EXCHANGE · KREZZCOIN COUNTER", 22, "#ff4fd8"));
        add(this.add.text(480, 78, `${CHARACTERS[minister as string]?.name}${minister === "PROCTUS" ? ` (${CHARACTERS[s.player].proctusTitle})` : ", Minister of Money and Loans"} · You have ${s.coins} Krezzcoin`, { fontFamily: FONT, fontSize: "12px", color: "#ffffff" }).setOrigin(0.5));
        const tabs: [typeof this.bankTab, string][] = [["upgrades", "UPGRADES"], ["armoury", "ARMOURY"], ["perks", "PERKS"], ["moves", "LADS & MOVES"]];
        tabs.forEach(([k, label], i) => add(button(this, 255 + i * 150, 106, label, () => { this.bankTab = k; this.render("bank"); }, { w: 140, h: 28, size: 13, color: this.bankTab === k ? 0x22c55e : undefined })));
        let y = 130;
        // rows squeeze up a bit on the long tabs so everything fits above the LEAVE button
        const nRows = this.bankTab === "perks" ? BANK_PERKS.length : this.bankTab === "armoury" ? GUN_ORDER.length + 1 : this.bankTab === "moves" ? BANK_MOVES.length + 1 : GENERIC_UPGRADES.length + 4;
        const rowH = Math.min(40, Math.floor(372 / nRows));
        const row = (name: string, desc: string, btn: string, disabled: boolean, fn: () => void, col = "#ffffff") => {
          add(this.add.text(150, y, name, { fontFamily: FONT, fontSize: "14px", color: col }));
          add(this.add.text(150, y + 17, desc, { fontFamily: FONT, fontSize: "11px", color: "#9aa0b4", wordWrap: { width: 560 }, maxLines: rowH < 38 ? 1 : 2 } as any));
          add(button(this, 790, y + 13, btn, fn, { w: 150, h: Math.min(28, rowH - 4), size: 13, disabled }));
          y += rowH;
        };
        if (this.bankTab === "upgrades") {
          for (const u of GENERIC_UPGRADES) {
            const lvl = s.upgrades[u.id] ?? 0;
            const cost = upgradeCost(s, lvl);
            const maxed = lvl >= u.max;
            row(`${u.name} (${lvl}/${u.max})`, u.desc, maxed ? "MAXED" : `BUY ${cost}`, maxed || s.coins < cost, () => this.buy(u.id, cost));
          }
          const def = CHARACTERS[s.player];
          add(this.add.text(150, y + 2, `${def.name} — PERSONAL BRANCH`, { fontFamily: FONT, fontSize: "13px", color: "#ffd23f", fontStyle: "bold" }));
          y += 24;
          def.branch?.forEach((b, i) => {
            const owned = !!s.upgrades[b.id];
            const prevOk = i === 0 || !!s.upgrades[def.branch![i - 1].id];
            const cost = Math.round(b.cost * (s.player === "KREZMAR" ? 0.9 : 1));
            row(b.name, b.desc, owned ? "OWNED" : prevOk ? `BUY ${cost}` : "LOCKED", owned || !prevOk || s.coins < cost, () => this.buyBranch(b.id, cost), owned ? "#5ad35a" : "#ffffff");
          });
        } else if (this.bankTab === "armoury") {
          s.guns = s.guns ?? {};
          // one button tops up everything you own, as far as your money goes
          const all = this.refillQuote();
          row("REFILL EVERYTHING", all.boxes ? `Fills every gun you own (${all.boxes} boxes of ammo).` : "Every gun you own is full. The Fart Blaster never runs out.", all.boxes ? `ALL ${all.cost}` : "ALL FULL", !all.boxes || s.coins < Math.min(...all.unit.filter((u) => u > 0), 1e9), () => this.refillAll(), "#67e8f9");
          for (const id of GUN_ORDER) {
            const g = GUNS[id];
            const owned = id in s.guns;
            if (g.shop && !owned) {
              row(`${g.name}  ·  EXCHANGE EXCLUSIVE`, g.blurb, `BUY ${g.shop}`, s.coins < g.shop, () => this.buyGun(id), "#ffd23f");
              continue;
            }
            if (!owned) continue;
            const have = s.guns[id] ?? 0;
            const max = gunMax(g, s);
            const unit = ammoUnitCost(id);
            const boxes = Math.ceil((max - have) / g.pickup);
            const fill = boxes * unit;
            const label = have >= max ? "FULL" : s.coins >= fill ? `FILL ${fill}` : `+${g.pickup} ${unit}`;
            row(`${g.name}  (${have}/${max})${have === 0 ? "  · EMPTY" : ""}`, `A box is ${g.pickup} rounds for ${unit}. Fills to the top if you can afford it.`, label, have >= max || s.coins < unit, () => this.buyAmmo(id), have === 0 ? "#ff6b6b" : g.shop ? "#5ad35a" : "#ffffff");
          }
          if (y < 470) add(this.add.text(480, y + 4, "Crate guns (Pistol, Uzi, Boomstick, Railgun, Marital Aid) are found in dungeon crates. Their ammo is sold here once you own them.", { fontFamily: FONT, fontSize: "11px", color: "#9aa0b4", align: "center", wordWrap: { width: 640 } }).setOrigin(0.5, 0));
        } else if (this.bankTab === "perks") {
          for (const p of BANK_PERKS) {
            const lvl = s.upgrades[p.id] ?? 0;
            const cost = p.cost * (lvl + 1);
            const maxed = lvl >= p.max;
            row(`${p.name} (${lvl}/${p.max})`, p.desc, maxed ? "MAXED" : `BUY ${cost}`, maxed || s.coins < cost, () => this.buy(p.id, cost));
          }
        } else {
          const hired = typeof s.flags.companion === "string" ? (s.flags.companion as string) : "";
          row(hired ? `HIRED: ${CHARACTERS[hired]?.name}` : "Hire a Lad (one dungeon trip)", hired ? "Waiting by the dungeon door. Goes home when you get back to town." : "A random lad joins your next dungeon, follows you room to room and shoots whatever's nearest. Can't be killed. Won't shut up.", hired ? "HIRED" : "HIRE 150", !!hired || s.coins < 150, () => this.hireLad(), hired ? "#5ad35a" : "#ffd23f");
          for (const m of BANK_MOVES) {
            const owned = !!s.upgrades[m.id];
            row(m.name, m.desc, owned ? "OWNED" : `BUY ${m.cost}`, owned || s.coins < m.cost, () => this.buyBranch(m.id, m.cost), owned ? "#5ad35a" : "#ffffff");
          }
        }
        if (this.caller === "Kreddle") add(button(this, 300, 518, "🎟 KROKEN PRIZES →", () => { this.scene.get("Kreddle").events.emit("open-prizes"); this.close(); }, { w: 220, h: 30, color: 0x3b0764 }));
        add(button(this, this.caller === "Kreddle" ? 620 : 480, 518, "LEAVE THE EXCHANGE", () => this.close(), { w: 220, h: 30 }));
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
        // the first time you go down, if you've never been over the bridge: point at Kreddle's shops
        if (!G.s.flags.first_death_seen) {
          G.s.flags.first_death_seen = true;
          if (!G.s.flags.kreddle_seen) {
            add(this.add.rectangle(480, 410, 600, 84, 0x1a0b2e, 0.95).setStrokeStyle(2, 0xff4fd8));
            add(
              this.add
                .text(480, 410, "💡 TIP: Struggling? Head to KREDDLE, over the bridge at the far WEST of Krelford.\nThe Kreddle Exchange sells new guns, ammo and upgrades, and you can hire a lad to fight with you.", {
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

  private buy(id: string, cost: number) {
    const s = G.s;
    if (s.coins < cost) return;
    s.coins -= cost;
    s.upgrades[id] = (s.upgrades[id] ?? 0) + 1;
    if (id === "hp") s.hp = Math.min(maxHp(s), s.hp + 15);
    synth.play("coin");
    G.save();
    this.render("bank");
  }

  private hireLad() {
    const s = G.s;
    if (s.coins < 150 || typeof s.flags.companion === "string") return;
    s.coins -= 150;
    const id = Companion.pick(s.player);
    s.flags.companion = id;
    synth.play("ding");
    G.emit("toast", { title: "LAD HIRED", text: `${CHARACTERS[id]?.name} will meet you at the next dungeon.` });
    G.save();
    this.render("bank");
  }

  private buyGun(id: string) {
    const s = G.s;
    const g = GUNS[id];
    if (!g.shop || s.coins < g.shop) return;
    s.coins -= g.shop;
    s.guns = s.guns ?? {};
    s.guns[id] = g.pickup * 2;
    s.gun = id;
    synth.play("ding");
    G.emit("toast", { title: "CENTRAL BANK", text: `${g.name} acquired. Equipped. X to swap weapons.` });
    G.save();
    this.render("bank");
  }

  /** Buy as many boxes as it takes to fill the gun (or as many as you can afford). */
  private buyAmmo(id: string) {
    if (!buyAmmo(G.s, id)) return;
    synth.play("coin");
    G.save();
    this.render("bank");
  }

  private refillQuote(): { cost: number; boxes: number; unit: number[] } {
    const s = G.s;
    let cost = 0;
    let boxes = 0;
    const unit: number[] = [];
    for (const id of GUN_ORDER) {
      if (!s.guns || !(id in s.guns)) continue;
      const g = GUNS[id];
      const n = Math.max(0, Math.ceil((gunMax(g, s) - s.guns[id]) / g.pickup));
      boxes += n;
      cost += n * ammoUnitCost(id);
      if (n) unit.push(ammoUnitCost(id));
    }
    return { cost, boxes, unit };
  }

  /** Fill every owned gun, emptiest first, until the money runs out. */
  private refillAll() {
    const s = G.s;
    if (!s.guns) return;
    let any = false;
    for (let pass = 0; pass < 200; pass++) {
      const owned = GUN_ORDER.filter((id) => s.guns && id in s.guns && s.guns[id] < gunMax(GUNS[id], s) && s.coins >= ammoUnitCost(id));
      if (!owned.length) break;
      owned.sort((a, b) => s.guns![a] / gunMax(GUNS[a], s) - s.guns![b] / gunMax(GUNS[b], s));
      const id = owned[0];
      s.coins -= ammoUnitCost(id);
      s.guns[id] = Math.min(gunMax(GUNS[id], s), s.guns[id] + GUNS[id].pickup);
      any = true;
    }
    if (!any) return;
    synth.play("coin");
    G.save();
    this.render("bank");
  }

  private buyBranch(id: string, cost: number) {
    const s = G.s;
    if (s.coins < cost || s.upgrades[id]) return;
    s.coins -= cost;
    s.upgrades[id] = 1;
    if (id === "gr1") s.hp = Math.min(maxHp(s), s.hp + 30);
    synth.play("ding");
    G.save();
    this.render("bank");
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

  private saveNow() {
    G.save();
    synth.play("ding");
    G.emit("toast", { title: "SAVED", text: "Game saved. The wiki has also been updated, at some point." });
    this.close();
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

  private close() {
    if (this.caller && this.scene.isPaused(this.caller)) {
      this.scene.resume(this.caller);
      this.scene.get(this.caller).events.emit("ui-resume");
    }
    this.scene.stop();
  }
}

export { UI };

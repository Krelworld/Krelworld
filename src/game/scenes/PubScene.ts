import Phaser from "phaser";
import { playerKey } from "../gfx/sanmikForm";
import { backdrop } from "../gfx/HD";
import { G } from "../G";
import { PUB_CONVERSATIONS, PUB_SNIPPETS } from "../../content/dialogue/pub";
import { ALL_EPISODES } from "../../content/television/channels";
import type { TVEpisode } from "../systems/tv";
import { evalCond } from "../systems/conditions";
import { DialogueBox } from "../ui/DialogueBox";
import { FONT } from "../ui/theme";
import { fadeThen, switchTo } from "../Flow";
import { synth } from "../audio/Synth";
import { intoxLabel } from "../systems/stats";
import { canTurnIn, completePersonal, pickupsInHub, collectPickup, personalQuest } from "../systems/quests";
import { CHARACTERS } from "../../data/characters";
import { dir, say } from "../../content/dsl";
import { LADS } from "../../data/characters";
import type { Line } from "../../data/types";
import { RIFFS } from "../../content/riffs";
import { STAG_CHATS } from "../../content/stagChat";
import { addKrokens } from "../systems/kreddle";
import { afterKreddle } from "../systems/moodMusic";
import { clueAt, clueTex, takeClue } from "../systems/trails";
import { shinyColours, shinyPickup, trailPropScale, type Shiny } from "../gfx/shiny";

/** Krokens for each riff, the first time you hear it. */
const RIFF_KROKENS = 3;

/** One option on the chalkboard. */
type PubOption = { id: string; group: GroupId; icon: string; label: string; sub: string; warn?: boolean; run: () => void };
type GroupId = "table" | "ent" | "back" | "leave";

/** The chalkboard's columns, left to right (Leave sits on its own, bottom right). */
const GROUPS: { id: GroupId; title: string; color: number }[] = [
  { id: "table", title: "AT THE TABLE", color: 0xe0a35a },
  { id: "ent", title: "ENTERTAINMENT", color: 0x7dd3fc },
  { id: "back", title: "THE BACK ROOMS", color: 0xf472b6 },
];

// chalkboard layout (960x540): the board, its three columns, and the cards in them
const BOARD = { x: 30, y: 72, w: 900, h: 404 };
const COL_X = [62, 346, 630];
const COL_W = 268;
const CARD_H = 64;
const CARD_STEP = 72;
const CARDS_TOP = 128;
const LEAVE = { x: 790, y: 484, w: 140, h: 48 };

/** A card / chip on screen: where it is (for the arrow keys) and how to light it up. */
type Focusable = { id: string; cx: number; cy: number; run: () => void; setLit: (on: boolean) => void };

const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

/** Krezzcoin for the first time through each Drongus riff or Jenko's-stag chat. */
const CHAT_COINS = 40;

export class PubScene extends Phaser.Scene {
  /** SanMik & SanChz play the back room most nights. */
  private sanmikOn = true;
  private box!: DialogueBox;
  private menu!: Phaser.GameObjects.Container;
  private table!: Phaser.GameObjects.Container;
  private busy = false;
  private status!: Phaser.GameObjects.Text;
  private lastTable = "";
  /** The chalkboard's cards, and which one is lit (kept across redraws by id). */
  private cards: Focusable[] = [];
  private sel = 0;
  private selId = "";
  // the telly over the bar
  private tvShow!: Phaser.GameObjects.Text;
  private tvSub!: Phaser.GameObjects.Text;
  private tvEp: TVEpisode | null = null;
  private tvBeat = 0;
  /** A clue on this chapter's explore-before-the-dungeon trail, glinting on its card. */
  private clueShiny: Shiny | null = null;

  constructor() {
    super("Pub");
  }

  create() {
    // after Kreddle, nobody's in the mood: no SanMik set in the back room
    this.sanmikOn = !afterKreddle(G.s) && Math.random() < 0.7;
    this.busy = false;
    this.selId = "";
    this.cards = [];
    this.tvEp = null;
    this.cameras.main.fadeIn(300);
    synth.ambience("pub");
    const pubBg = this.add.tileSprite(0, 0, 960, 540, "tile_pub").setOrigin(0);
    if (backdrop(this, "bg_pub", { dim: 0.2, depth: -10 })) pubBg.setVisible(false);
    this.add.image(480, 330, "p_table").setScale(4);
    this.table = this.add.container(0, 0);
    // the pub sign, top left
    const sign = this.add.graphics();
    sign.fillStyle(0x1a0f08, 0.82).fillRoundedRect(16, 8, 330, 58, 8);
    sign.lineStyle(2, 0xc6862a, 0.9).strokeRoundedRect(16, 8, 330, 58, 8);
    this.add.text(30, 14, "THE KREZZ ARMS", { fontFamily: FONT, fontSize: "26px", color: "#e0a35a", fontStyle: "bold", stroke: "#000000", strokeThickness: 4 });
    this.add.text(31, 46, "Fizzy Bongos on tap. Pussy juice on the other tap.", { fontFamily: FONT, fontSize: "11px", color: "#d6c49a" });
    // the telly over the bar, top right: always on, idling through whatever's on KrelTV
    const tv = this.add.graphics();
    tv.fillStyle(0x111111, 1).fillRoundedRect(700, 6, 244, 62, 6);
    tv.lineStyle(3, 0x2a2a2a, 1).strokeRoundedRect(700, 6, 244, 62, 6);
    tv.fillStyle(0x0c1a2a, 1).fillRect(706, 12, 232, 50);
    this.tvShow = this.add.text(712, 14, "", { fontFamily: FONT, fontSize: "10px", color: "#7dd3fc", fontStyle: "bold" });
    this.tvSub = this.add.text(822, 44, "", { fontFamily: FONT, fontSize: "10px", color: "#ffffff", align: "center", wordWrap: { width: 222 } }).setOrigin(0.5);
    this.time.addEvent({ delay: 2800, loop: true, callback: () => this.tvTick() });
    this.tvTick();
    this.menu = this.add.container(0, 0).setDepth(10);
    this.status = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "12px", color: "#ffd23f" });
    this.box = new DialogueBox(this, 1000);
    synth.music("pub");
    if (!this.scene.isActive("UI")) this.scene.launch("UI", { mode: "hub" });
    const onMenuKey = (e: KeyboardEvent) => this.menuKey(e);
    this.input.keyboard?.on("keydown", onMenuKey);
    this.events.once("shutdown", () => this.input.keyboard?.off("keydown", onMenuKey));
    // back from the telly
    this.events.off("resume");
    this.events.on("resume", () => {
      this.busy = false;
      this.showMenu();
    });
    this.clueShiny = null;
    // something glowing in here (a trail clue): it's the card that's lit when you walk in
    if (clueAt(G.s, "PUB")) this.selId = "clue";
    this.showMenu();
    // Chapter 2: you were told to come and check the place out
    if (G.s.chapter === 2 && !G.s.flags.ch2_pub_visited) {
      G.s.flags.ch2_pub_visited = true;
      G.save();
      G.emit("toast", { title: "THE KREZZ ARMS", text: "Checked out. Have a look round: watch Kreblis and Drongus riff for Krokens. The War Room's next (under the Archive)." });
    }
  }

  update() {
    const s = G.s;
    this.status.setText(`🍺 ${s.bongos} bongos   💰 ${s.coins} Krezzcoin   ${intoxLabel(s.intoxication)} (${Math.round(s.intoxication)}%)`);
  }

  // ------------------------------------------------------------- telly

  /** The little telly over the bar: subtitles from whatever's on, a line every few seconds. */
  private tvTick() {
    for (let guard = 0; guard < 60; guard++) {
      if (!this.tvEp || this.tvBeat >= this.tvEp.beats.length) {
        const eps = ALL_EPISODES.filter((e) => !e.unlockFlag || G.s.flags[e.unlockFlag]);
        this.tvEp = eps[Math.floor(Math.random() * eps.length)] ?? null;
        this.tvBeat = 0;
        if (!this.tvEp) return;
        this.tvShow.setText(`📺 ${this.tvEp.show}`.slice(0, 40));
      }
      const b = this.tvEp.beats[this.tvBeat++];
      let t = "";
      if (b.type === "speaker") t = `${b.character}: ${b.text}`;
      else if (b.type === "titleCard") t = b.text.toUpperCase();
      else if (b.type === "audience") t = b.cue === "biglaugh" ? "[UPROARIOUS LAUGHTER]" : b.cue === "laugh" ? "[LAUGHTER]" : `[${b.cue.toUpperCase()}]`;
      else continue;
      this.tvSub.setText(t.length > 96 ? t.slice(0, 94) + "…" : t);
      return;
    }
  }

  /** Watch KrelTV properly: the TV scene over the pub, which pauses until you switch it off. */
  private watchTv() {
    this.busy = true;
    synth.play("tap");
    this.scene.launch("TV", { overlay: true, caller: "Pub" });
    this.scene.bringToTop("TV");
    this.scene.pause();
  }

  // ------------------------------------------------------------- menu

  private barred(left: number) {
    this.play([dir(`Barred from the Wonky Pole: ${Math.ceil(left / 60000)} more minute${left > 60000 ? "s" : ""}.`), say("BIG DEREK", "You lot are barred. Come back later. And wash your hands.")]).then(() => this.showMenu());
  }

  /** What's on the chalkboard tonight. */
  private menuItems(): PubOption[] {
    const s = G.s;
    const items: PubOption[] = [];
    const clue = clueAt(s, "PUB");
    if (clue) items.push({ id: "clue", group: "table", icon: "", label: "Something's glowing", sub: `By the bar. A ${clue.trail.item}?`, run: () => void this.takeClue() });
    // at the table
    items.push({ id: "sit", group: "table", icon: "pubicon_sit", label: "Sit down", sub: "With whoever's in tonight", run: () => this.sit() });
    items.push({ id: "stag", group: "table", icon: "pubicon_stag", label: "Jenko's stag", sub: "Organise it in the group chat (+40 Krezzcoin per new chat)", run: () => this.stag() });
    const q = personalQuest(s);
    if (q && pickupsInHub(s).some((p) => p.anchor === "PUB_MENU")) items.push({ id: "menu", group: "table", icon: "pubicon_menu", label: "Nick the menu", sub: "Off the bar. Personal quest", run: () => this.readMenu() });
    if (canTurnIn(s, "PUB")) items.push({ id: "treasure", group: "table", icon: "pubicon_chest", label: "Krezmond's treasure", sub: "Open it. Quest turn-in", run: () => this.turnIn() });
    // entertainment
    items.push({ id: "tv", group: "ent", icon: "pubicon_tv", label: "Watch the telly", sub: "KrelTV, over the bar", run: () => this.watchTv() });
    items.push(
      s.player === "KREBLIS"
        ? { id: "riff", group: "ent", icon: "pubicon_riff", label: "Riff with Drongus", sub: `+${RIFF_KROKENS} Krokens, +40 Krezzcoin per new riff`, run: () => this.riffs() }
        : { id: "riff", group: "ent", icon: "pubicon_riff", label: "Kreblis & Drongus", sub: `Watch them riff. +${RIFF_KROKENS} Krokens, +40 Krezzcoin each`, run: () => this.riffs() },
    );
    // the back rooms
    if (this.sanmikOn) items.push({ id: "sanmik", group: "back", icon: "pubicon_sanmik", label: "SanMik & SanChz", sub: s.player === "MIKEY" ? "You're on. Live, mid-song" : "On now. Live, mid-song", run: () => switchTo(this, "Venue", {}) });
    if (s.player !== "KREBON" && s.flags.met_emergency) items.push({ id: "gig", group: "back", icon: "pubicon_gig", label: "Twitcher Mutiny", sub: "On now. It's getting rowdy", run: () => switchTo(this, "Minigame", { mode: "gig", returnAt: "PUB" }) });
    {
      const left = ((s.flags.club_banned_until as number) ?? 0) - s.playtimeMs;
      items.push(
        left > 0
          ? { id: "pole", group: "back", icon: "pubicon_pole", label: "The Wonky Pole", sub: `BARRED: ${Math.ceil(left / 60000)} more min`, warn: true, run: () => this.barred(left) }
          : { id: "pole", group: "back", icon: "pubicon_pole", label: "The Wonky Pole", sub: "Through the curtain", run: () => switchTo(this, "Club", {}) },
      );
    }
    if (s.flags.sanmik_catford) items.push({ id: "lamp", group: "back", icon: "pubicon_lamp", label: "The magic lamp", sub: "Rub it: Begour's café", run: () => switchTo(this, "Dungeon", { dungeon: "sanmik_hangout", room: 0 }) });
    items.push({
      id: "leave",
      group: "leave",
      icon: "pubicon_door",
      label: "Leave",
      sub: "Esc",
      run: () => {
        synth.play("door");
        fadeThen(this, 250, () => switchTo(this, "Hub", { at: "PUB" }));
      },
    });
    return items;
  }

  /** The chalkboard: three columns of picture cards, Leave on its own, status and controls along the bottom. */
  private showMenu() {
    // the status line lives on (update() keeps it current); everything else is redrawn
    this.menu.remove(this.status);
    for (const c of this.cards) c.setLit(false); // stops the lit icon's bob before its icon goes
    this.clueShiny?.destroy();
    this.clueShiny = null;
    this.menu.removeAll(true);
    this.cards = [];
    const calm = !!G.meta?.settings?.calmFlash;
    const items = this.menuItems();
    // the pub stays there, dimmed, behind the board
    this.menu.add(this.add.rectangle(0, 0, 960, 540, 0x05030a, 0.5).setOrigin(0));
    // the board fits the longest column (a quiet night is a smaller board)
    const rows = Math.max(...GROUPS.map((grp) => items.filter((o) => o.group === grp.id).length));
    const bh = Math.min(BOARD.h, Math.max(240, CARDS_TOP - BOARD.y + rows * CARD_STEP + 34));
    if (this.textures.exists("ui_chalkboard")) {
      this.menu.add(this.add.nineslice(BOARD.x + BOARD.w / 2, BOARD.y + bh / 2, "ui_chalkboard", undefined, BOARD.w, bh, 60, 60, 60, 60));
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x121f1b, 0.97).fillRoundedRect(BOARD.x, BOARD.y, BOARD.w, bh, 10);
      g.lineStyle(10, 0x6a452a, 1).strokeRoundedRect(BOARD.x, BOARD.y, BOARD.w, bh, 10);
      this.menu.add(g);
    }
    GROUPS.forEach((grp, col) => {
      const x = COL_X[col];
      const head = this.add.text(x + COL_W / 2, 100, grp.title, { fontFamily: FONT, fontSize: "14px", color: hex(grp.color), fontStyle: "bold" }).setOrigin(0.5);
      const line = this.add.graphics();
      line.lineStyle(2, grp.color, 0.55).lineBetween(x + 10, 114, x + COL_W - 10, 114);
      this.menu.add([head, line]);
      items
        .filter((o) => o.group === grp.id)
        .forEach((o, row) => this.card(o, x, CARDS_TOP + row * CARD_STEP, COL_W, CARD_H, grp.color, calm));
    });
    // Leave, set apart
    const leave = items.find((o) => o.id === "leave")!;
    this.card(leave, LEAVE.x, LEAVE.y, LEAVE.w, LEAVE.h, 0xb9bdd0, calm);
    // status and the controls, along the bottom
    const statusBg = this.add.graphics();
    statusBg.fillStyle(0x000000, 0.6).fillRoundedRect(BOARD.x, 488, 380, 40, 8);
    this.status.setPosition(BOARD.x + 12, 508).setOrigin(0, 0.5);
    this.menu.add([statusBg, this.status]);
    const touch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
    this.menu.add(
      this.add.text(LEAVE.x - 16, 508, touch ? "Tap a card" : "Arrows: choose\nEnter / E: go   Esc: leave", { fontFamily: FONT, fontSize: "11px", color: "#b9bdd0", align: "right", lineSpacing: 2 }).setOrigin(1, 0.5),
    );
    // the trail clue's card: its prop, glowing, where the icon would be
    const clue = clueAt(G.s, "PUB");
    const ctex = clue && clueTex(clue.trail, clue.i);
    if (clue && ctex && this.textures.exists(ctex) && items.some((o) => o.id === "clue"))
      this.clueShiny = shinyPickup(this, COL_X[0] + 36, CARDS_TOP + CARD_H / 2, ctex, { scale: trailPropScale(this, ctex, 40), depth: 20, size: 0.5, ...shinyColours(clue.trail.tint) });
    // keep the lit card across redraws
    const i = this.cards.findIndex((c) => c.id === this.selId);
    this.focus(i >= 0 ? i : 0, false);
  }

  /** One picture card: icon, a short label and a smaller line under it. Hover or arrow to light it; click, tap or Enter to go. */
  private card(o: PubOption, x: number, y: number, w: number, h: number, color: number, calm: boolean) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const small = h < 56;
    const iconSize = small ? 36 : 48;
    const draw = (lit: boolean) => {
      bg.clear();
      bg.fillStyle(lit ? 0x3a2a12 : 0x0b1612, lit ? 0.92 : 0.7).fillRoundedRect(0, 0, w, h, 8);
      bg.fillStyle(color, lit ? 1 : 0.7).fillRect(0, 8, 4, h - 16);
      bg.lineStyle(lit ? 3 : 2, lit ? 0xffd23f : 0xe8e4d0, lit ? 1 : 0.22).strokeRoundedRect(0, 0, w, h, 8);
    };
    draw(false);
    c.add(bg);
    const icon = this.textures.exists(o.icon) ? this.add.image(12 + iconSize / 2, h / 2, o.icon).setDisplaySize(iconSize, iconSize) : null;
    if (icon) c.add(icon);
    const tx = 20 + iconSize;
    const maxW = w - tx - 10;
    const lab = this.add.text(tx, small ? h / 2 - 8 : h / 2 - 11, o.label, { fontFamily: FONT, fontSize: "16px", color: "#f5efd9", fontStyle: "bold" }).setOrigin(0, 0.5);
    for (let size = 16; lab.width > maxW && size > 10; size--) lab.setFontSize(size);
    const sub = this.add.text(tx, small ? h / 2 + 9 : h / 2 + 12, o.sub, { fontFamily: FONT, fontSize: "12px", color: o.warn ? "#ff8a8a" : "#a9b8a8" }).setOrigin(0, 0.5);
    for (let size = 12; sub.width > maxW && size > 9; size--) sub.setFontSize(size);
    c.add([lab, sub]);
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    c.add(hit);
    this.menu.add(c);
    const idx = this.cards.length;
    let pulse: Phaser.Tweens.Tween | null = null;
    const baseScale = icon ? icon.scaleX : 1;
    this.cards.push({
      id: o.id,
      cx: x + w / 2,
      cy: y + h / 2,
      run: o.run,
      setLit: (on) => {
        draw(on);
        pulse?.stop();
        pulse = null;
        if (!icon) return;
        icon.setScale(baseScale * (on ? 1.12 : 1));
        // a gentle bob on the lit icon (held still with calm flashes on)
        if (on && !calm) pulse = this.tweens.add({ targets: icon, y: h / 2 - 2, yoyo: true, repeat: -1, duration: 420, ease: "Sine.inOut" });
        else icon.setY(h / 2);
      },
    });
    hit.on("pointerover", () => !this.busy && this.focus(idx));
    hit.on("pointerdown", () => !this.busy && this.focus(idx, false));
    hit.on("pointerup", () => {
      synth.unlock();
      if (!this.busy && this.menu.visible) this.choose(idx);
    });
  }

  private focus(i: number, sound = true) {
    if (!this.cards.length) return;
    i = Phaser.Math.Clamp(i, 0, this.cards.length - 1);
    if (i !== this.sel || !sound) this.cards.forEach((c, j) => c.setLit(j === i));
    if (sound && i !== this.sel) synth.play("select");
    this.sel = i;
    this.selId = this.cards[i].id;
  }

  private choose(i: number) {
    const c = this.cards[i];
    if (!c) return;
    this.focus(i, false);
    synth.play("tap");
    c.run();
  }

  /** Arrows move round the board (to the nearest card that way), Enter / E / Space picks, Esc leaves. */
  private menuKey(e: KeyboardEvent) {
    if (this.busy || !this.menu.visible || !this.cards.length || this.sys.isPaused()) return;
    const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    const d = dirs[e.key];
    if (d) {
      e.preventDefault?.();
      const cur = this.cards[this.sel];
      let best = -1;
      let bestScore = Infinity;
      this.cards.forEach((c, j) => {
        if (j === this.sel) return;
        const dx = c.cx - cur.cx;
        const dy = c.cy - cur.cy;
        const along = dx * d[0] + dy * d[1];
        if (along <= 4) return;
        const across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
        const score = along + across * 2;
        if (score < bestScore) {
          bestScore = score;
          best = j;
        }
      });
      if (best >= 0) this.focus(best);
      return;
    }
    if (e.key === "Enter" || e.key === " " || e.key === "e" || e.key === "E") {
      e.preventDefault?.();
      this.choose(this.sel);
      return;
    }
    if (e.key === "Escape") {
      const j = this.cards.findIndex((c) => c.id === "leave");
      if (j >= 0) this.choose(j);
    }
  }

  private async play(lines: Line[]) {
    this.busy = true;
    this.menu.setVisible(false);
    await this.box.play(lines);
    this.menu.setVisible(true);
    this.busy = false;
    G.save();
  }

  /** Pick up the trail clue that's in here: it's shown big and glowing while you read it. */
  private async takeClue() {
    const c = clueAt(G.s, "PUB");
    const tex = c && clueTex(c.trail, c.i);
    this.clueShiny?.destroy();
    this.clueShiny = null;
    const r = takeClue(G.s, "PUB");
    if (!r) return this.showMenu();
    synth.play("pickup");
    G.emit("toast", { title: r.title, text: r.toast });
    this.selId = "";
    const big = tex && this.textures.exists(tex) ? shinyPickup(this, 480, 300, tex, { scale: trailPropScale(this, tex, 110), depth: 5, size: 1.4, ...shinyColours(c!.trail.tint) }) : null;
    await this.play(r.lines);
    big?.destroy();
    this.showMenu();
  }

  // ------------------------------------------------------------- the table

  /** A random table: a story conversation or a real-chat snippet, whoever's in tonight. */
  private async sit() {
    const s = G.s;
    // come in steaming (bongos in a fight) and sit down: somebody looks at you funny
    if (s.intoxication >= 70) return this.brawl();
    const pool = [...PUB_CONVERSATIONS.filter((c) => evalCond(c.cond, s)), ...PUB_SNIPPETS].filter((c) => c.id !== this.lastTable && c.seats.every((id) => id === s.player || id === "DRONGUS" || this.textures.exists(`spr_${id}`)));
    const fresh = pool.filter((c) => !s.flags[`pub_${c.id}`]);
    const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    if (!pick) return;
    this.lastTable = pick.id;
    const seats = pick.seats.includes(s.player) ? pick.seats : [...pick.seats, s.player];
    this.table.removeAll(true);
    const gap = Math.min(150, 640 / seats.length);
    seats.forEach((id, i) => {
      const x = 480 - ((seats.length - 1) * gap) / 2 + i * gap;
      const key = this.textures.exists(`spr_${id}`) ? `spr_${id}` : playerKey(this);
      const spr = this.add.sprite(x, 290, key, 0).setScale(3.4);
      const sway = s.intoxication / 100;
      if (sway > 0.15) this.tweens.add({ targets: spr, angle: { from: -8 * sway, to: 8 * sway }, yoyo: true, repeat: -1, duration: 900 - sway * 400 });
      this.table.add(spr);
      this.table.add(this.add.text(x, 240, id === s.player ? "YOU" : CHARACTERS[id]?.name ?? id, { fontFamily: FONT, fontSize: "11px", color: "#ffffff", backgroundColor: "#00000088" }).setOrigin(0.5));
    });
    await this.play(pick.lines);
    s.flags[`pub_${pick.id}`] = true;
    if (pick.unlocksArchive) G.unlockArchive(pick.unlocksArchive);
    this.table.removeAll(true);
    this.showMenu();
  }

  /**
   * Kreblis and Drongus riffing (src/content/riffs.ts): a random riff you haven't heard yet, then another, until you
   * stop. Space / E / click: next line. Tab: skip this riff. Esc: back to the bar.
   */
  private riffs() {
    const me = G.s.player === "KREBLIS";
    return this.randomChats(
      RIFFS.map((r) => ({ id: `riff_${r.n}`, head: `${r.title.toUpperCase()}  ·  ${r.date}`, title: `'${r.title.toUpperCase()}'`, lines: r.lines })),
      ["KREBLIS", "DRONGUS"].map((id) => ({ id, you: me && id === "KREBLIS" })),
      RIFF_KROKENS,
    );
  }

  /** The Jenko stag group chat (src/content/stagChat.ts): same player as the riffs. */
  private stag() {
    const s = G.s;
    return this.randomChats(
      STAG_CHATS.map((c, i) => ({ id: `stag_${i}`, head: `JENKO'S STAG  ·  ${c.title.toUpperCase()}`, title: `JENKO'S STAG  ·  ${c.title.toUpperCase()}`, lines: c.lines })),
      ["DRONGUS", "KREZWONK", "KREZMAR"].map((id) => ({ id, you: id === s.player })),
    );
  }

  /** A big pub-style button for the conversation player: icon / label / key hint. Acts on press, so it beats the dialogue box to the click. */
  private chip(x: number, y: number, w: number, h: number, label: string, keys: string, color: number, onPress: (() => void) | null) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const draw = (hot: boolean) => {
      bg.clear();
      bg.fillStyle(hot ? 0x3a2a12 : 0x0b1612, 0.94).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.fillStyle(color, 1).fillRect(-w / 2, -h / 2 + 6, 4, h - 12);
      bg.lineStyle(hot ? 3 : 2, hot ? 0xffd23f : color, hot ? 1 : 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    draw(false);
    const t = this.add.text(-w / 2 + 14, 0, label, { fontFamily: FONT, fontSize: "15px", color: "#f5efd9", fontStyle: "bold" }).setOrigin(0, 0.5);
    const k = this.add.text(w / 2 - 10, 0, keys, { fontFamily: FONT, fontSize: "11px", color: "#a9b8a8" }).setOrigin(1, 0.5);
    for (let size = 15; t.width + k.width + 30 > w && size > 10; size--) t.setFontSize(size);
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    c.add([bg, t, k, hit]);
    hit.on("pointerover", () => draw(true));
    hit.on("pointerout", () => draw(false));
    hit.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      synth.unlock();
      // NEXT LINE lets the press through to the dialogue box (which advances on any click); the others keep it
      if (!onPress) return;
      ev.stopPropagation();
      onPress();
    });
    (c as unknown as { light: (on: boolean) => void }).light = draw;
    return c;
  }

  /**
   * Random conversations you haven't heard yet, one at a time. While one plays, a control bar sits just above the
   * dialogue box: NEXT LINE (Space / E / click), SKIP THIS CONVO (Tab), END (Esc). When it's over (heard out or skipped)
   * an end card waits: NEXT CONVO (Enter / Space / E) or BACK TO THE BAR (Esc).
   */
  private async randomChats(chats: { id: string; head: string; title: string; lines: Line[] }[], cast: { id: string; you: boolean }[], pay = 0) {
    const s = G.s;
    this.busy = true;
    this.menu.setVisible(false);
    this.table.removeAll(true);
    const gap = 200;
    cast.forEach(({ id, you }, i) => {
      const x = 480 - ((cast.length - 1) * gap) / 2 + i * gap;
      const key = you ? playerKey(this) : this.textures.exists(`spr_${id}`) ? `spr_${id}` : playerKey(this);
      this.table.add(this.add.sprite(x, 290, key, 0).setScale(3.4).setFlipX(i === cast.length - 1 && i > 0));
      this.table.add(this.add.text(x, 240, you ? "YOU" : CHARACTERS[id]?.name ?? id, { fontFamily: FONT, fontSize: "11px", color: "#ffffff", backgroundColor: "#00000088" }).setOrigin(0.5));
    });
    // the convo's title, under the pub sign
    const head = this.add.text(480, 92, "", { fontFamily: FONT, fontSize: "15px", color: "#ffd23f", fontStyle: "bold", backgroundColor: "#000000bb", padding: { x: 12, y: 6 } }).setOrigin(0.5).setDepth(1100);
    // the control bar, just above the dialogue box
    let stop = false;
    let skipped = false;
    const end = () => {
      stop = true;
      this.box.skipAll();
    };
    const skip = () => {
      skipped = true;
      this.box.skipAll();
    };
    const bar = this.add.container(0, 0).setDepth(1100);
    const barBg = this.add.graphics();
    barBg.fillStyle(0x000000, 0.55).fillRoundedRect(96, 316, 768, 42, 10);
    bar.add([
      barBg,
      this.chip(276, 337, 340, 34, "▶  NEXT LINE", "Space / E / click", 0xffd23f, null),
      this.chip(578, 337, 252, 34, "⏭  SKIP THIS CONVO", "Tab", 0x7dd3fc, skip),
      this.chip(784, 337, 150, 34, "✕  END", "Esc", 0xf87171, end),
    ]);
    // the end card (built when a convo finishes)
    let card: Phaser.GameObjects.Container | null = null;
    let pick: ((next: boolean) => void) | null = null;
    let cardReadyAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (this.sys.isPaused()) return;
      if (pick) {
        if (this.time.now < cardReadyAt) return;
        if (e.key === "Escape") pick(false);
        else if (e.key === "Enter" || e.key === " " || e.key === "e" || e.key === "E") pick(true);
        return;
      }
      if (e.key === "Escape") end();
      else if (e.key === "Tab") skipped = true; // the dialogue box does the skipping itself
    };
    this.input.keyboard?.on("keydown", onKey);
    this.table.add(head);
    while (!stop) {
      let pool = chats.filter((c) => !s.flags[c.id]);
      if (!pool.length) {
        for (const c of chats) delete s.flags[c.id];
        pool = chats;
      }
      const c = pool[Math.floor(Math.random() * pool.length)];
      s.flags[c.id] = true;
      head.setText(c.head);
      skipped = false;
      bar.setVisible(true);
      await this.box.play(c.lines);
      bar.setVisible(false);
      // Krezzcoin for every riff or stag chat the first time you sit through it (or skip on from it)
      if (!s.flags[`coin_${c.id}`]) {
        s.flags[`coin_${c.id}`] = true;
        s.coins += CHAT_COINS;
        synth.play("coin");
        G.emit("toast", { title: `💰 +${CHAT_COINS} KREZZCOIN`, text: "Someone's left a tip on the table." });
      }
      // Krokens for every riff the first time you sit through it (or skip on from it)
      let paid = false;
      if (pay && !s.flags[`paid_${c.id}`]) {
        s.flags[`paid_${c.id}`] = true;
        addKrokens(s, pay);
        synth.play("ding");
        G.emit("toast", { title: "🎟 +" + pay + " KROKENS", text: "For services to riffing." });
        paid = true;
      }
      G.save();
      if (stop) break;
      // ---- the end card: carry on, or back to the bar
      card = this.endCard(c.title, skipped, pay ? (paid ? `+${pay} KROKENS` : "Krokens already banked for this one") : "", paid, (next) => this.time.now >= cardReadyAt && pick?.(next));
      cardReadyAt = this.time.now + 250;
      const next = await new Promise<boolean>((res) => {
        pick = (n) => {
          pick = null;
          res(n);
        };
      });
      card.destroy();
      card = null;
      synth.play("tap");
      if (!next) stop = true;
    }
    this.input.keyboard?.off("keydown", onKey);
    bar.destroy();
    this.table.removeAll(true);
    this.menu.setVisible(true);
    this.busy = false;
    G.save();
    this.showMenu();
  }

  /** "That's the end of ..." with what it paid, and NEXT CONVO / BACK TO THE BAR. */
  private endCard(title: string, skipped: boolean, payLine: string, paid: boolean, choose: (next: boolean) => void) {
    const c = this.add.container(0, 0).setDepth(1200);
    const dim = this.add.rectangle(0, 0, 960, 540, 0x05030a, 0.6).setOrigin(0).setInteractive();
    c.add(dim);
    const W = 560;
    const H = 250;
    const y0 = 150;
    if (this.textures.exists("ui_chalkboard")) c.add(this.add.nineslice(480, y0 + H / 2, "ui_chalkboard", undefined, W, H, 60, 60, 60, 60));
    else c.add(this.add.rectangle(480, y0 + H / 2, W, H, 0x121f1b, 0.97).setStrokeStyle(8, 0x6a452a));
    c.add(this.add.text(480, y0 + 46, skipped ? "SKIPPED TO THE END OF" : "THAT'S THE END OF", { fontFamily: FONT, fontSize: "13px", color: "#a9b8a8", fontStyle: "bold" }).setOrigin(0.5));
    const t = this.add.text(480, y0 + 78, title, { fontFamily: FONT, fontSize: "20px", color: "#ffd23f", fontStyle: "bold", align: "center", wordWrap: { width: W - 90 } }).setOrigin(0.5);
    for (let size = 20; t.height > 54 && size > 12; size--) t.setFontSize(size);
    c.add(t);
    if (payLine) {
      const p = this.add.text(480, y0 + 118, payLine, { fontFamily: FONT, fontSize: paid ? "18px" : "12px", color: paid ? "#7ee787" : "#a9b8a8", fontStyle: "bold" }).setOrigin(0.5);
      c.add(p);
      if (paid && !G.meta?.settings?.calmFlash) this.tweens.add({ targets: p, scale: { from: 1.35, to: 1 }, duration: 300, ease: "Back.out" });
    }
    c.add([
      this.chip(480 - 122, y0 + 178, 226, 46, "▶  NEXT CONVO", "Enter", 0x7ee787, () => choose(true)),
      this.chip(480 + 122, y0 + 178, 226, 46, "✕  BACK TO THE BAR", "Esc", 0xf87171, () => choose(false)),
    ]);
    return c;
  }

  // ------------------------------------------------------------- trouble
  /** Too many bongos: you start shoving people. A short, mashy pub brawl, then you're thrown out. */
  private async brawl() {
    const s = G.s;
    const me = s.player;
    this.busy = true;
    this.menu.setVisible(false);
    this.table.removeAll(true);
    const crowdIds = Phaser.Utils.Array.Shuffle(LADS.filter((id) => id !== me && this.textures.exists(`spr_${id}`)).slice()).slice(0, 4) as string[];
    const shoveLines = ["Wot u lookin at!!", "Eh?? Wot r u tryin 2 say?!", "Sounds lyke ur cumin on2 me 😡", "Wot goin on I cud take any1 anytyme!!!", "Oi. OI. You spilt me bongo.", "Let's av a fite."];
    await this.box.play([
      dir("The room tilts. Somebody at the bar looks at you. Funny."),
      say(me, shoveLines[Math.floor(Math.random() * shoveLines.length)]),
      say(crowdIds[0], ["Mate. Sit down.", "Is he alright?", "Here we go.", "Fair enough."][Math.floor(Math.random() * 4)]),
      dir("You shove them. They shove you back. A stool goes over. It's on."),
    ]);
    // ---- the brawl: tap / SPACE to swing at whoever's nearest
    const layer = this.add.container(0, 0).setDepth(500);
    const hero = this.add.sprite(480, 330, playerKey(this), 0).setScale(3.4);
    const foes = crowdIds.map((id, i) => {
      const spr = this.add.sprite(i < 2 ? 200 + i * 110 : 650 + (i - 2) * 110, 330 + (i % 2) * 30, `spr_${id}`, 0).setScale(3.2);
      spr.setData("hp", 3);
      return spr;
    });
    layer.add([hero, ...foes]);
    const hud = this.add.text(480, 170, "BRAWL! Tap / SPACE to swing", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#ff6b6b", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(600);
    synth.play("roar");
    let landed = 0;
    let taken = 0;
    const pops = (x: number, y: number, t: string, c = "#ffd23f") => {
      const p = this.add.text(x, y, t, { fontFamily: "Impact, sans-serif", fontSize: "26px", color: c, stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(700);
      this.tweens.add({ targets: p, y: y - 50, alpha: 0, duration: 700, onComplete: () => p.destroy() });
    };
    const swing = () => {
      const alive = foes.filter((f) => f.active && (f.getData("hp") as number) > 0);
      if (!alive.length) return;
      const tgt = alive.reduce((a, b) => (Math.abs(a.x - hero.x) < Math.abs(b.x - hero.x) ? a : b));
      const side = Math.sign(tgt.x - hero.x) || 1;
      this.tweens.add({ targets: hero, x: tgt.x - side * 70, duration: 90 });
      hero.setFlipX(side < 0);
      synth.play(Math.random() < 0.3 ? "punch_big" : "punch");
      this.cameras.main.shake(90, 0.006);
      landed++;
      const hp = (tgt.getData("hp") as number) - 1;
      tgt.setData("hp", hp);
      pops(tgt.x, tgt.y - 60, ["POW!", "SHOVE!", "BOSH!", "WALLOP!", "KREZZ!"][Math.floor(Math.random() * 5)]);
      this.tweens.add({ targets: tgt, x: tgt.x + side * 40, angle: side * 20, duration: 120, yoyo: true });
      if (hp <= 0) {
        this.tweens.add({ targets: tgt, x: tgt.x + side * 400, y: tgt.y - 120, angle: side * 720, alpha: 0, duration: 700 });
        pops(tgt.x, tgt.y - 100, "OUT THE DOOR!", "#ff6b6b");
      }
      // a stool or a pint goes flying
      if (Math.random() < 0.4) {
        const r = this.add.rectangle(tgt.x, tgt.y, 20, 26, Math.random() < 0.5 ? 0x8b5a2b : 0xf5c542).setDepth(650);
        this.tweens.add({ targets: r, x: r.x + (Math.random() - 0.5) * 500, y: r.y - 150 - Math.random() * 100, angle: 540, alpha: 0, duration: 800, onComplete: () => r.destroy() });
        synth.play("smash");
      }
    };
    const onKey = () => swing();
    this.input.keyboard?.on("keydown-SPACE", onKey);
    this.input.keyboard?.on("keydown-E", onKey);
    this.input.on("pointerdown", onKey);
    // they swing back
    const back = this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        const alive = foes.filter((f) => (f.getData("hp") as number) > 0);
        if (!alive.length) return;
        const f = alive[Math.floor(Math.random() * alive.length)];
        this.tweens.add({ targets: f, x: hero.x + (f.x < hero.x ? -60 : 60), duration: 150, yoyo: true });
        taken++;
        synth.play("hurt");
        this.cameras.main.flash(80, 120, 0, 0);
        pops(hero.x, hero.y - 80, "OOF", "#ffffff");
      },
    });
    await new Promise<void>((resolve) => {
      const end = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          const left = foes.filter((f) => (f.getData("hp") as number) > 0).length;
          hud.setText(left ? `BRAWL! Tap / SPACE to swing · ${left} still standing` : "LAST ONE STANDING");
          if (!left) {
            end.remove();
            resolve();
          }
        },
      });
      this.time.delayedCall(9000, () => {
        end.remove();
        resolve();
      });
    });
    back.remove();
    this.input.keyboard?.off("keydown-SPACE", onKey);
    this.input.keyboard?.off("keydown-E", onKey);
    this.input.off("pointerdown", onKey);
    const won = foes.every((f) => (f.getData("hp") as number) <= 0);
    hud.destroy();
    await this.box.play([
      dir(won ? "Silence. Every one of them is on the floor or on the pavement. You are the last one standing in the Krezz Arms." : "It's a mess. Chairs, bongos, a shoe. Nobody is winning."),
      say("BARMAN", "RIGHT. OUT. THE LOT OF YA."),
      dir(`You threw ${landed} punches and took ${taken}. The barman throws you out by the collar.`),
      say(crowdIds[1] ?? "GRONNY", ["Same time next week?", "Fair enough.", "Group fight. Love it.", "I'll go first next time."][Math.floor(Math.random() * 4)]),
    ]);
    layer.destroy();
    s.intoxication = 35;
    s.hp = Math.max(1, s.hp - taken * 3);
    s.flags.pub_brawls = ((s.flags.pub_brawls as number) ?? 0) + 1;
    if (won) s.coins += 15;
    G.save();
    this.busy = false;
    G.emit("toast", { title: "THROWN OUT OF THE KREZZ ARMS", text: won ? "Last one standing. +15 Krezzcoin (found on the floor)." : "You'll be back. You always come back." });
    synth.play("door");
    fadeThen(this, 250, () => switchTo(this, "Hub", { at: "PUB" }));
  }

  private async readMenu() {
    const s = G.s;
    const q = personalQuest(s);
    const menuPickup = pickupsInHub(s).find((p) => p.anchor === "PUB_MENU");
    if (!menuPickup || !q) return;
    await this.play([
      dir("THE KREZZ ARMS — MENU. Scrawled at the bottom, half rubbed out: 'Krebon   Real butter .. krebon is coming'"),
      say("KREBON", "There it is. The menu. I'm taking it."),
    ]);
    collectPickup(s, q, menuPickup.spot);
    synth.play("pickup");
    G.emit("toast", { title: "PERSONAL QUEST", text: `${q.title}: The Menu acquired.` });
    this.showMenu();
  }

  private async turnIn() {
    const q = canTurnIn(G.s, "PUB");
    if (!q) return;
    await this.play(q.turnIn.lines);
    const coins = completePersonal(G.s, q);
    G.emit("toast", { title: "PERSONAL QUEST COMPLETE", text: `${q.title}: +${coins} Krezzcoin. ${q.reward.desc}` });
    this.showMenu();
  }
}

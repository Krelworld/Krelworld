import Phaser from "phaser";
import { G } from "../G";
import { button, FONT, title } from "../ui/theme";
import { startNewRun, switchTo } from "../Flow";
import { CHARACTERS, PLAYABLE_ORDER } from "../../data/characters";
import type { PlayableId } from "../../data/types";
import { CHAPTERS } from "../../content/chapters/chapters";
import { arcDue, arcsFor, stepFlag } from "../systems/arcs";
import type { Arc } from "../../content/arcs";
import { GUNS, GUN_POWER, gunMax } from "../combat/Guns";
import { BANK_MOVES, BANK_PERKS } from "./MenuScene";
import { GENERIC_UPGRADES } from "../systems/stats";
import { PRIZES } from "../../content/kreddle";
import { DUNGEONS } from "../../data/dungeons";
import { BOSS_TEXT } from "../../content/bosses";
import { maxHp } from "../systems/stats";
import { DEFAULT_DIFFICULTY, difficultyDef, MAX_DIFFICULTY } from "../systems/difficulty";
import { loadoutSummary } from "../systems/carry";
import { hexStr } from "../ui/theme";

/**
 * DEBUG · SKIP TO… (from the 🛠 DEBUG button on the title screen).
 * Starts a fresh save at the start of a chapter, or straight at a side quest, with everything before it done.
 */
export class DebugScene extends Phaser.Scene {
  protected pl: PlayableId = "FLENKY";
  protected picked = false;
  protected page: "main" | "bosses" = "main";
  /**
   * CHAPTER SELECT (title screen, once you've finished the game): the same jumps, but a real run:
   * no debug mode, no god kit, no free guns or money. You start with the kit you finished your last game with.
   */
  protected chapterMode = false;
  protected difficulty = DEFAULT_DIFFICULTY;

  /** DEBUG MODE: every upgrade, every gun (strongest in hand), infinite Krezz and IBS (see Player / DungeonScene). */
  private powers() {
    const s = G.s;
    s.flags.debug_mode = true;
    for (const u of GENERIC_UPGRADES) s.upgrades[u.id] = u.max;
    for (const p of BANK_PERKS) s.upgrades[p.id] = p.max;
    for (const m of BANK_MOVES) s.upgrades[m.id] = 1;
    for (const b of CHARACTERS[s.player].branch ?? []) s.upgrades[b.id] = 1;
    for (const p of PRIZES) if (p.key) s.upgrades[p.key] = p.max ?? 1;
    s.guns = s.guns ?? {};
    for (const [id, g] of Object.entries(GUNS)) s.guns[id] = gunMax(g, s);
    s.gun = GUN_POWER.find((id) => id in GUNS) ?? s.gun;
    s.hp = maxHp(s);
    G.save();
  }

  constructor(key = "DebugSkip") {
    super(key);
  }

  create() {
    // (the scene object is reused: coming back from the title opens on the main page, not the boss list you left on)
    this.page = "main";
    if (!this.picked) {
      let p: string | undefined;
      try {
        // chapter select: whoever finished the game last; debug: whoever's in the save
        p = (this.chapterMode ? G.meta.carry?.from : undefined) ?? G.saves.load()?.player;
      } catch {
        p = undefined;
      }
      this.pl = p && CHARACTERS[p] && PLAYABLE_ORDER.includes(p as PlayableId) ? (p as PlayableId) : "FLENKY";
      this.picked = true;
    }
    this.draw();
  }

  /** Every button on the page, for the keyboard: arrows / WASD move, Enter / Space press. */
  private navs: { c: Phaser.GameObjects.Container; fn: () => void }[] = [];
  private focus = -1;
  private ring?: Phaser.GameObjects.Rectangle;

  private btn(x: number, y: number, t: string, fn: () => void, o: Parameters<typeof button>[5] = {}) {
    const c = button(this, x, y, t, fn, o);
    this.navs.push({ c, fn });
    return c;
  }

  /** Start a page: clear it and its keys, then hook up keyboard navigation over its buttons. */
  private freshPage() {
    this.children.removeAll(true);
    this.input.keyboard?.removeAllListeners();
    this.navs = [];
    this.focus = -1;
    this.ring = undefined;
    const kb = this.input.keyboard;
    if (!kb) return;
    const go = (dx: number, dy: number) => this.moveFocus(dx, dy);
    for (const [k, dx, dy] of [["UP", 0, -1], ["W", 0, -1], ["DOWN", 0, 1], ["S", 0, 1], ["LEFT", -1, 0], ["A", -1, 0], ["RIGHT", 1, 0], ["D", 1, 0]] as const) kb.on(`keydown-${k}`, () => go(dx, dy));
    const press = () => {
      const n = this.navs[this.focus];
      if (n) n.fn();
    };
    kb.on("keydown-ENTER", press);
    kb.on("keydown-SPACE", press);
  }

  /** Move the keyboard focus to the nearest button in that direction. */
  private moveFocus(dx: number, dy: number) {
    if (!this.navs.length) return;
    const cur = this.navs[this.focus];
    let best = -1;
    let bestD = Infinity;
    // first press: the first jump on the page (chapter 1 / the first boss), not the toggles up top
    if (!cur) best = Math.max(0, this.navs.findIndex((n) => n.c.y > 100));
    else
      this.navs.forEach((n, i) => {
        if (i === this.focus) return;
        const ox = n.c.x - cur.c.x;
        const oy = n.c.y - cur.c.y;
        const along = ox * dx + oy * dy;
        if (along <= 4) return;
        const side = Math.abs(ox * dy) + Math.abs(oy * dx);
        const d = along + side * 3;
        if (d < bestD) (bestD = d), (best = i);
      });
    if (best < 0) return;
    this.focus = best;
    const c = this.navs[best].c;
    this.ring?.destroy();
    this.ring = this.add.rectangle(c.x, c.y, c.width + 8, c.height + 6).setStrokeStyle(3, 0xffd23f).setDepth(50);
    this.tweens.add({ targets: this.ring, alpha: 0.5, yoyo: true, repeat: -1, duration: 400 });
  }

  /** The chapter a side quest belongs to. */
  private arcCh(a: Arc) {
    const due = arcDue(a);
    return Math.max(2, due ?? a.minChapter ?? 2, a.minChapter ?? 1);
  }

  /** A fresh save at the start of chapter `ch`: earlier chapters and their side quests done, starter guns and money. */
  private prep(ch: number, keep: Arc | null) {
    const pl = this.pl;
    G.newRun(pl, 0, this.chapterMode ? this.difficulty : undefined);
    const s = G.s;
    s.chapter = ch;
    // the start-of-game bits (welcome, Klerble on the telly, the flyover) count as seen
    Object.assign(s.flags, { prologue_done: true, ch1_intro: true, ministerial_quests: true, met_emergency: true, founding_seen: true, drongus_dungeon_risen: true, home_seen: true, flyover_seen: true, tv_klerble_welcome: true });
    for (let k = 1; k < ch; k++) {
      const c = CHAPTERS[k - 1];
      if (c) for (const st of c.steps) if (st.done?.flag) s.flags[st.done.flag] = true;
      s.flags[`ch${k}_clear`] = s.flags[`ch${k}_outro`] = s.flags[`ch${k}_fact`] = s.flags[`ch${k}_intro`] = true;
      if (k === 1) Object.assign(s.flags, { wildern_destroyed: true, tap_flow_seen: true });
      if (k === 3) Object.assign(s.flags, { mollor_freed: true, golden_unlocked: true });
      // Chapter 6 ends with Kreddle nuked and Krelford bombed flat: Chapter 7 is the ruined town
      if (k === 6) Object.assign(s.flags, { raid_march: true, krunch_started: true, kreddle_nuked: true, vig_krunch_protocol: true, vig_townhall_party: true, krelworld_bombed: true });
    }
    for (const a of arcsFor(pl)) {
      if (a === keep) continue;
      const due = arcDue(a);
      if (due !== null && due < ch) {
        for (const st of a.steps) s.flags[stepFlag(a, st)] = true;
        s.flags[`${a.id}_done`] = true;
        if (a.requires) s.flags[a.requires] = true;
      }
    }
    if (keep) {
      // going straight to one quest: the rest of that chapter's prep is done, so nothing gets in the way
      if (keep.requires) s.flags[keep.requires] = true;
      s.flags[`ch${ch}_intro`] = true;
      const cc = CHAPTERS[ch - 1];
      if (cc)
        for (const st of cc.steps) {
          if (st.id === "s_dungeon") break;
          if (st.done?.flag) s.flags[st.done.flag] = true;
        }
      for (const a of arcsFor(pl))
        if (a !== keep && this.arcCh(a) === ch) {
          for (const st of a.steps) s.flags[stepFlag(a, st)] = true;
          s.flags[`${a.id}_done`] = true;
        }
    }
    if (this.chapterMode) {
      // chapter select: your carried kit only (G.newRun gave it you), no freebies and no debug powers
      s.hp = maxHp(s);
      G.save();
      return;
    }
    s.guns = s.guns ?? {};
    let first: string | null = null;
    for (const [id, g] of Object.entries(GUNS)) {
      if (!g.shop && (g.minChapter ?? 1) < ch) {
        s.guns[id] = g.maxAmmo;
        first = first ?? id;
      }
    }
    if (first) s.gun = first;
    s.coins += 300 * ch;
    s.hp = maxHp(s);
    G.save();
    this.powers();
  }

  private goCh(n: number) {
    if (n === 1) {
      if (this.chapterMode) return startNewRun(this, this.pl, 0, this.difficulty);
      startNewRun(this, this.pl);
      this.powers();
      return;
    }
    this.prep(n, null);
    switchTo(this, "Hub");
  }

  private goArc(a: Arc) {
    this.prep(this.arcCh(a), a);
    switchTo(this, "Hub");
  }

  /** Every boss fight: the dungeon and room it's in. */
  private bosses(): { boss: string; dungeon: string; room: number; ch: number }[] {
    const out: { boss: string; dungeon: string; room: number; ch: number }[] = [];
    for (const d of Object.values(DUNGEONS))
      d.rooms.forEach((r, i) => {
        // the chapter the fight belongs to: the chapter whose dungeon it's in, else the dungeon's own chapter (side quests: 2)
        const ch = CHAPTERS.find((c) => c.dungeon === d.id)?.n ?? d.chapter ?? 2;
        if (r.boss) out.push({ boss: r.boss, dungeon: d.id, room: i, ch: Math.max(1, ch) });
      });
    return out.sort((a, b) => a.ch - b.ch);
  }

  private goBoss(b: { boss: string; dungeon: string; room: number; ch: number }) {
    this.prep(b.ch, null);
    switchTo(this, "Dungeon", { dungeon: b.dungeon, room: b.room });
  }

  private drawBosses() {
    this.freshPage();
    this.add.rectangle(480, 270, 960, 540, 0x10101e);
    title(this, 480, 24, this.chapterMode ? "CHAPTER SELECT · BOSS FIGHTS" : "DEBUG · BOSS FIGHTS", 24, "#ffd23f");
    this.add.text(480, 48, this.chapterMode ? "Straight into the boss room, with your kit. This replaces your current save." : "Straight into the boss room, in debug mode. This replaces your current save.", { fontFamily: FONT, fontSize: "11px", color: "#ff9b9b" }).setOrigin(0.5);
    const list = this.bosses();
    const per = Math.ceil(list.length / 3);
    const sp = Math.min(40, Math.floor(410 / Math.max(1, per)));
    list.forEach((b, i) => {
      const col = Math.floor(i / per);
      const r = i % per;
      const name = BOSS_TEXT[b.boss]?.name ?? b.boss.toUpperCase();
      this.btn(170 + col * 310, 84 + r * sp, `Ch ${b.ch} · ${name}`, () => this.goBoss(b), { w: 296, h: sp - 5, size: 11 });
    });
    this.btn(90, 516, "◀ BACK", () => ((this.page = "main"), this.draw()), { w: 140, h: 30, size: 13 });
    this.input.keyboard?.on("keydown-ESC", () => ((this.page = "main"), this.draw()));
  }

  private draw() {
    if (this.page === "bosses") return this.drawBosses();
    this.freshPage();
    this.add.rectangle(480, 270, 960, 540, 0x10101e);
    title(this, 480, 24, this.chapterMode ? "CHAPTER SELECT" : "DEBUG · SKIP TO…", 24, "#ffd23f");
    this.add.text(480, 48, "Starts a fresh save at the start of whatever you pick. This replaces your current save.", { fontFamily: FONT, fontSize: "11px", color: "#ff9b9b" }).setOrigin(0.5);
    const cyclePl = () => {
      this.pl = PLAYABLE_ORDER[(PLAYABLE_ORDER.indexOf(this.pl) + 1) % PLAYABLE_ORDER.length];
      this.draw();
    };
    const cycleDiff = () => {
      this.difficulty = (this.difficulty % MAX_DIFFICULTY) + 1;
      this.draw();
    };
    if (this.chapterMode) {
      this.btn(325, 78, `PLAYING AS: ${CHARACTERS[this.pl].name}  (C)`, cyclePl, { w: 300, h: 30, size: 12 });
      const d = difficultyDef(this.difficulty);
      const db = this.btn(640, 78, `DIFFICULTY ${d.level}/${MAX_DIFFICULTY}: ${d.name}  (V)`, cycleDiff, { w: 310, h: 30, size: 12 });
      (db as any).label?.setColor(hexStr(d.color));
      this.input.keyboard?.on("keydown-C", cyclePl);
      this.input.keyboard?.on("keydown-V", cycleDiff);
    } else
      this.btn(480, 78, `PLAYING AS: ${CHARACTERS[this.pl].name}   (tap to change)`, cyclePl, { w: 380, h: 30, size: 13 });
    const head = (x: number, y: number, t: string) => this.add.text(x, y, t, { fontFamily: FONT, fontSize: "13px", color: "#86efac", fontStyle: "bold" }).setOrigin(0.5);
    head(150, 108, "CHAPTERS");
    CHAPTERS.forEach((c, i) => this.btn(150, 138 + i * 44, `${c.n}. ${c.title}`, () => this.goCh(c.n), { w: 270, h: 36, size: 12 }));
    const arcs = arcsFor(this.pl).slice().sort((a, b) => this.arcCh(a) - this.arcCh(b));
    head(635, 108, "SIDE QUESTS (goes straight to the quest)");
    const per = Math.ceil(arcs.length / 2);
    const sp = Math.min(36, Math.floor(380 / Math.max(1, per)));
    arcs.forEach((a, i) => {
      const col = i < per ? 0 : 1;
      const r = i % per;
      this.btn(482 + col * 308, 130 + r * sp, `Ch ${this.arcCh(a)} · ${a.title}`, () => this.goArc(a), { w: 300, h: sp - 4, size: 11 });
    });
    this.btn(90, 516, "◀ BACK", () => switchTo(this, "Title"), { w: 140, h: 30, size: 13 });
    this.btn(150, 138 + CHAPTERS.length * 44 + 8, "⚔ BOSS FIGHTS", () => ((this.page = "bosses"), this.draw()), { w: 270, h: 40, size: 14, color: 0x7f1d1d });
    const lo = G.meta.carry;
    const foot = this.chapterMode
      ? lo
        ? `YOUR KIT FROM YOUR LAST FINISHED GAME: ${loadoutSummary(lo)}`
        : "No kit saved from a finished game: you start with the basics."
      : "DEBUG MODE: all upgrades · every gun (strongest in hand) · infinite Krezz · IBS always ready";
    this.add.text(480, 516, foot, { fontFamily: FONT, fontSize: "11px", color: "#86efac" }).setOrigin(0.5);
    this.input.keyboard?.on("keydown-ESC", () => switchTo(this, "Title"));
  }
}

/** CHAPTER SELECT (title screen, after you've finished the game): DebugSkip's jumps as a real run with your carried kit. */
export class ChapterSelectScene extends DebugScene {
  constructor() {
    super("ChapterSelect");
    this.chapterMode = true;
  }
}

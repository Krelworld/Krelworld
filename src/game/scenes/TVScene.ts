import Phaser from "phaser";
import { charMeta } from "../gfx/HD";
import { voice } from "../audio/Voice";
import { displayText } from "../audio/voiceKey";
import { ALL_EPISODES, CHANNELS, setKeyFor, STORY_EPISODES } from "../../content/television/channels";
import { beatDuration, type TVBeat, type TVEpisode } from "../systems/tv";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { FONT } from "../ui/theme";
import { drawCharacter } from "../gfx/Textures";
import type { SpriteLook } from "../../data/characters";
import { bump } from "../systems/stats";
import { fadeThen, switchTo } from "../Flow";
import { DUNGEONS } from "../../data/dungeons";
import { addKrokens } from "../systems/kreddle";
import { PovDirector } from "./TVPov";
import { NewsDirector } from "./TVNews";
import { makeShowDirector, type ShowDirector } from "./tv";

const DUNGEON_MUSIC: Record<string, string> = Object.fromEntries(Object.values(DUNGEONS).map((d) => [d.id, d.music]));

const SX = 200;
const SY = 50;
const SW = 560;
const SH = 420;

const CAST: Record<string, SpriteLook | string> = {
  "JENNY CUMMING": { skin: 0xf6d7c3, hair: 0x7a3b12, hairStyle: "long", beard: null, glasses: "none", top: 0xb3202a, topDetail: 0xffffff, bottom: 0x1a1a1a, shoes: 0x111111, bulk: 1 },
  "CHRISTOPHER THICK": { skin: 0xf1c7a5, hair: 0x2a1a0a, hairStyle: "short", beard: null, glasses: "none", top: 0x1f2a44, topDetail: 0xb11226, bottom: 0x1f2a44, shoes: 0x111111, accent: 0xd8d8d8, bulk: 2 },
  NEWSREADER: { skin: 0xf1c7a5, hair: 0x6b4a2c, hairStyle: "short", beard: null, glasses: "none", top: 0x1f2a44, topDetail: 0xffffff, bottom: 0x1f2a44, shoes: 0x111111 },
  REPORTER: { skin: 0xd9a77e, hair: 0x111111, hairStyle: "long", beard: null, glasses: "none", top: 0x6b8f3a, bottom: 0x2b2b2b, shoes: 0x111111 },
  ANNOUNCER: { skin: 0xf6d7c3, hair: 0xaaaaaa, hairStyle: "short", beard: 0xaaaaaa, glasses: "round", top: 0x4c4f57, bottom: 0x3a3c42, shoes: 0x1c1c1c },
  HOST: { skin: 0xf1c7a5, hair: 0xf3dc8a, hairStyle: "blonde", beard: null, glasses: "none", top: 0xff4fa3, bottom: 0x111111, shoes: 0xffffff },
  "CO-HOST": { skin: 0xc58c5c, hair: 0x2a1a0a, hairStyle: "wavy", beard: null, glasses: "square", top: 0x17c6c0, bottom: 0x333333, shoes: 0xffffff },
  COMMENTATOR: { skin: 0xf1c7a5, hair: 0x5a3a1a, hairStyle: "short", beard: null, glasses: "none", top: 0x2f6b3a, bottom: 0x333333, shoes: 0x111111 },
  "CO-COMMENTATOR": { skin: 0xd9a77e, hair: null, hairStyle: "bald", beard: 0x333333, glasses: "none", top: 0x7a1f2b, bottom: 0x333333, shoes: 0x111111 },
  CHEERLEADERS: { skin: 0xf6d7c3, hair: 0xf0cf74, hairStyle: "long", beard: null, glasses: "none", top: 0xffd23f, bottom: 0x3b6cff, shoes: 0xffffff },
  SINGER: { skin: 0xf1c7a5, hair: 0x111111, hairStyle: "wavy", beard: null, glasses: "shades", top: 0x111111, topDetail: 0xff3b30, bottom: 0x111111, shoes: 0x111111 },
  DRONGUS: "spr_DRONGUS",
  SCROMBUS: "spr_SCROMBUS",
  KREZMAR: "spr_KREZMAR",
  "LIL' CRONGUS": "spr_CRONGUS",
};

interface Actor {
  spr: Phaser.GameObjects.Sprite;
  name: string;
}

/** Stock roles played by existing TV actors. */
const TV_ALIASES: Record<string, string> = {
  JOURNALIST: "REPORTER",
  ALAN: "ADVISOR",
  KAREN: "MADISON",
  "DNC REP": "OFFICIAL",
  AIDE: "ADVISOR",
  "DEMOCRATIC LEADER": "EXECUTIVE",
  MODERATOR: "HOST",
  "PUB PATRON": "GROZZ",
  "CONSERVATIVE SUPPORTER": "GROZZ",
  VOTER: "MINTY",
  // Peep Show's Sana'a scenes
  "YEMENI EXECUTIVE": "EXECUTIVE",
  "YEMENI OFFICIAL": "OFFICIAL",
  "YEMENI OFFICER": "OFFICER",
};

const EXTRA_CAST_SHOWS = new Set(["creation_myth", "eastenders_krezz", "beep_show"]);

/** The on-demand guide's channel colours and short codes. */
const CHAN_STYLE: Record<string, [number, string]> = {
  "KRUNCHE NEWS": [0xef4444, "NEWS"],
  "CHANNEL KREZ": [0xa855f7, "KREZ"],
  "BBK ONE": [0x3b82f6, "BBK1"],
  "WONKING MACHINE SHOPPING NETWORK": [0xf59e0b, "SHOP"],
  "KRELWORLD DOCUMENTARIES": [0x10b981, "DOCS"],
  "THICK CUMMING COCK": [0xec4899, "TCC"],
};
const chanColor = (c: string) => CHAN_STYLE[c]?.[0] ?? 0x64748b;
const chanCode = (c: string) => CHAN_STYLE[c]?.[1] ?? c.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase();
const chanOrder = (c: string) => {
  const i = CHANNELS.indexOf(c);
  return i < 0 ? 99 : i;
};

/** What "whatever's on" has already shown this round (see surf()). */
const SURF_ROUNDS = { title: new Set<string>(), run: new Set<string>() };

export class TVScene extends Phaser.Scene {
  private overlay = false;
  private caller = "";
  private fromTitle = false;
  private mode: "channels" | "episodes" | "playing" = "channels";
  private ui!: Phaser.GameObjects.Container;
  private stage!: Phaser.GameObjects.Container;
  private subs!: Phaser.GameObjects.Text;
  private caption!: Phaser.GameObjects.Text;
  private card!: Phaser.GameObjects.Text;
  private ep: TVEpisode | null = null;
  private beat = 0;
  private beatTimer: Phaser.Time.TimerEvent | null = null;
  private pausedPlay = false;
  private showSubs = true;
  private actors: Record<string, Actor> = {};
  private props: Record<string, Phaser.GameObjects.GameObject> = {};
  private setKey = "";
  private mouthTimer: Phaser.Time.TimerEvent | null = null;
  private keyHandler!: (e: KeyboardEvent) => void;
  private sel = 0;
  /** POV presentation, for episodes with style "pov" */
  private pov: PovDirector | ShowDirector | null = null;
  /** Krunche News presentation, for the story's compulsory bulletins (see TVNews.ts) */
  private news: NewsDirector | null = null;
  private newsOutro = false;
  /** how long the current beat's picture wants (an animated sequence) */
  private beatHold = 0;
  private items: { label: string; action: () => void }[] = [];
  /** the PixelLab telly is up (its cabinet runs wider on the right, so the side buttons sit further out) */
  private frameArt = false;

  constructor() {
    super("TV");
  }

  /** Played from a cutscene: close as soon as the episode ends. */
  private once = false;

  create(data: { overlay?: boolean; caller?: string; fromTitle?: boolean; episode?: string; once?: boolean }) {
    this.once = !!data?.once;
    this.overlay = !!data?.overlay;
    // over whatever launched it, whatever order the scene list has ended up in
    this.scene.bringToTop();
    this.caller = data?.caller ?? "";
    this.fromTitle = !!data?.fromTitle;
    this.mode = "channels";
    this.actors = {};
    this.props = {};
    this.ep = null;
    this.makeCast();
    this.add.rectangle(0, 0, 960, 540, 0x000000, this.overlay ? 0.85 : 1).setOrigin(0);
    // the telly: a PixelLab walnut set drawn over the picture (its screen is a hole cut exactly at SX,SY,SW,SH),
    // or the old drawn bezel underneath when the art's missing
    this.frameArt = this.textures.exists("tv_set_frame");
    if (this.frameArt) {
      this.add.image(0, 0, "tv_set_frame").setOrigin(0).setScale(2).setDepth(40);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x3a2a1a, 1);
      g.fillRoundedRect(SX - 40, SY - 30, SW + 80, SH + 80, 30);
      g.fillStyle(0x1a120a, 1);
      g.fillRoundedRect(SX - 10, SY - 10, SW + 20, SH + 20, 22);
      g.fillStyle(0xd4a017, 1);
      g.fillCircle(SX + SW + 22, SY + 60, 9);
      g.fillCircle(SX + SW + 22, SY + 100, 9);
      this.add.text(SX + SW / 2, SY + SH + 26, "KRELTV", { fontFamily: FONT, fontSize: "14px", color: "#d4a017", fontStyle: "bold" }).setOrigin(0.5);
    }
    this.stage = this.add.container(0, 0);
    const mask = this.make.graphics({}).fillRect(SX, SY, SW, SH);
    this.stage.setMask(mask.createGeometryMask());
    this.ui = this.add.container(0, 0);
    this.subs = this.add.text(SX + SW / 2, SY + SH - 16, "", { fontFamily: FONT, fontSize: "15px", color: "#ffffff", backgroundColor: "#000000cc", padding: { x: 6, y: 3 }, wordWrap: { width: SW - 40 }, align: "center" }).setOrigin(0.5, 1).setDepth(50);
    this.caption = this.add.text(SX + 12, SY + 10, "", { fontFamily: FONT, fontSize: "12px", color: "#ffd23f", backgroundColor: "#000000aa", padding: { x: 4, y: 2 } }).setDepth(50);
    this.card = this.add.text(SX + SW / 2, SY + SH / 2, "", { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "bold", align: "center", wordWrap: { width: SW - 60 } }).setOrigin(0.5).setDepth(60).setShadow(3, 3, "#000", 0);
    if (G.meta.settings.crt) this.drawCRT();
    this.drawControls();
    // the mouse wheel scrolls the on-demand guide
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.mode === "episodes" && this.moveGuide(dy > 0 ? 1 : -1));
    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener("keydown", this.keyHandler);
    this.events.once("shutdown", () => {
      window.removeEventListener("keydown", this.keyHandler);
      this.beatTimer?.remove();
      this.mouthTimer?.remove();
      this.pov?.destroy();
      this.pov = null;
      this.news?.destroy();
      this.news = null;
    });
    if (data?.episode) {
      const e = ALL_EPISODES.find((x) => x.id === data.episode);
      if (e) return this.play(e);
    }
    // switch it on and something's on (from the title screen too: there it's every show you've seen on any run)
    this.surf();
  }

  /** Whatever's on: a random show you can watch, never the one that just finished, and no repeats until you've
   *  seen everything. Shows you've never watched come first; once every show has been on in this round, a new
   *  round starts. The round lasts for the visit (title and runs keep separate rounds). */
  private surf() {
    const all = ALL_EPISODES.filter((e) => this.unlocked(e) && !STORY_EPISODES.has(e.id) && e.id !== this.ep?.id);
    if (!all.length) return this.showDemand();
    const round = SURF_ROUNDS[this.fromTitle ? "title" : "run"];
    let left = all.filter((e) => !round.has(e.id));
    if (!left.length) {
      // everything has been on: a new round (the show that just finished still can't come straight back)
      round.clear();
      if (this.ep) round.add(this.ep.id);
      left = all;
    }
    const fresh = left.filter((e) => !this.watchedList().includes(e.id));
    const pool = fresh.length ? fresh : left;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.play(pick);
  }

  /** Stop the show that's on (without counting it as watched). */
  private stopShow() {
    this.beatTimer?.remove();
    voice.stop();
    this.pov?.destroy();
    this.pov = null;
    this.news?.destroy();
    this.news = null;
    this.splatLayer?.destroy();
    this.splatLayer = undefined;
    this.subs.setText("");
    this.card.setText("");
    this.caption.setText("");
    synth.stopMusic();
  }

  private makeCast() {
    for (const [name, look] of Object.entries(CAST)) {
      if (typeof look === "string") continue;
      const key = `tv_${name}`;
      if (this.textures.exists(key)) continue;
      const cv = document.createElement("canvas");
      cv.width = 64;
      cv.height = 24;
      const ctx = cv.getContext("2d")!;
      for (let f = 0; f < 4; f++) drawCharacter(ctx, look, f, f * 16);
      const tex = this.textures.addCanvas(key, cv)!;
      for (let f = 0; f < 4; f++) tex.add(f, 0, f * 16, 0, 16, 24);
    }
  }

  private drawCRT() {
    const g = this.add.graphics().setDepth(100);
    g.fillStyle(0x000000, 0.18);
    for (let y = SY; y < SY + SH; y += 3) g.fillRect(SX, y, SW, 1);
    if (!this.frameArt) {
      g.lineStyle(18, 0x000000, 0.35);
      g.strokeRoundedRect(SX - 4, SY - 4, SW + 8, SH + 8, 30);
    }
    const noise = this.add.graphics().setDepth(101);
    this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        noise.clear();
        noise.fillStyle(0xffffff, 0.04);
        for (let i = 0; i < 40; i++) noise.fillRect(SX + Math.random() * SW, SY + Math.random() * SH, 2, 1);
      },
    });
  }

  /** Two big buttons beside the telly (only while a show's on), plus tap-the-screen for the next line. */
  private playBtns: Phaser.GameObjects.Container[] = [];
  private tapZone?: Phaser.GameObjects.Zone;
  private drawControls() {
    // tapping the picture = next line
    const zone = (this.tapZone = this.add.zone(SX, SY, SW, SH).setOrigin(0).setInteractive().setDepth(5));
    zone.on("pointerdown", () => this.mode === "playing" && this.skipBeat());
    const mk = (y: number, icon: string, label: string, key: string, fn: () => void) => {
      const c = this.add.container(this.frameArt ? 906 : SX + SW + 40 + 70, y).setDepth(100);
      const bg = this.add.rectangle(0, 0, this.frameArt ? 92 : 130, 96, 0x2a1a0a).setStrokeStyle(3, 0xd4a017);
      c.add([bg, this.add.text(0, -20, icon, { fontFamily: FONT, fontSize: "30px", color: "#ffd23f" }).setOrigin(0.5), this.add.text(0, 14, label, { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5), this.add.text(0, 33, key, { fontFamily: FONT, fontSize: "10px", color: "#a8a29e" }).setOrigin(0.5)]);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(0x4a2f12));
      bg.on("pointerout", () => bg.setFillStyle(0x2a1a0a));
      bg.on("pointerdown", () => {
        synth.play("select");
        fn();
      });
      this.playBtns.push(c);
    };
    this.playBtns = [];
    mk(130, "▶", "NEXT LINE", "Space / click", () => this.skipBeat());
    mk(236, "⏭", "NEXT SHOW", "Tab", () => this.skipShow());
    if (!this.once) mk(342, "☰", "ON DEMAND", "D", () => this.openDemand());
    mk(this.once ? 342 : 448, "⏻", "SWITCH OFF", "Esc", () => this.switchOff());
    this.setPlayBtns(false);
  }

  private setPlayBtns(on: boolean) {
    // next line / next show only mean something while a show's on; on demand and switch off are always there
    this.playBtns.forEach((c, i) => c.setVisible(on || i >= 2));
    if (this.tapZone?.input) this.tapZone.input.enabled = on;
  }

  private openDemand() {
    if (this.once) return;
    if (this.mode === "playing") this.stopShow();
    this.showDemand();
  }

  private switchOff() {
    this.stopShow();
    this.exit();
  }

  /** Next show. A story broadcast counts as seen; a show you skip stays "new" (and its gift unclaimed). */
  private skipShow() {
    if (this.mode !== "playing" || !this.ep) return;
    voice.stop();
    if (this.once) {
      this.beatTimer?.remove();
      this.beat = this.ep.beats.length;
      this.finishEpisode();
      return;
    }
    this.stopShow();
    this.surf();
  }

  // ---------------------------------------------------------- menus

  /** ON DEMAND: a channel guide. Tabs per channel, a scrolling list of episode cards, a NEW / ✓ badge on each. */
  private guideTab = "ALL";
  private guideSel = 0;
  private guideTop = 0;
  private guideList: TVEpisode[] = [];
  private guideTabs: string[] = [];
  private static readonly ROWS = 7;

  private unlocked(e: TVEpisode) {
    // the story's broadcasts: only once you've seen them in the story
    if (STORY_EPISODES.has(e.id)) return this.watchedList().includes(e.id);
    if (!e.unlockFlag) return true;
    if (this.fromTitle) return G.meta.tvWatched.includes(e.id);
    return !!G.s.flags[e.unlockFlag];
  }

  private watchedList() {
    return this.fromTitle ? G.meta.tvWatched : G.s.tvWatched;
  }

  private showDemand() {
    if (this.mode !== "episodes") {
      synth.musicRaw("news");
      // open on the first show you haven't seen (or the top)
      this.guideTab = "ALL";
      this.guideList = ALL_EPISODES.filter((e) => this.unlocked(e) && !STORY_EPISODES.has(e.id));
      const i = this.guideList.findIndex((e) => !this.watchedList().includes(e.id));
      this.guideSel = Math.max(0, i);
      this.guideTop = Math.max(0, this.guideSel - 2);
    }
    this.mode = "episodes";
    this.drawGuide();
  }

  private setGuideTab(tab: string) {
    this.guideTab = tab;
    this.guideSel = 0;
    this.guideTop = 0;
    synth.play("select");
    this.drawGuide();
  }

  private moveGuide(d: number) {
    if (!this.guideList.length) return;
    this.guideSel = Phaser.Math.Clamp(this.guideSel + d, 0, this.guideList.length - 1);
    const R = TVScene.ROWS;
    if (this.guideSel < this.guideTop) this.guideTop = this.guideSel;
    if (this.guideSel >= this.guideTop + R) this.guideTop = this.guideSel - R + 1;
    this.drawGuide();
  }

  private drawGuide() {
    this.ui.removeAll(true);
    this.stage.removeAll(true);
    const watched = this.watchedList();
    // the story's broadcasts go at the end (they only show up once you've seen them in the story)
    const avail = ALL_EPISODES.filter((e) => this.unlocked(e)).sort((a, b) => +STORY_EPISODES.has(a.id) - +STORY_EPISODES.has(b.id));
    this.guideTabs = ["ALL", ...[...new Set(avail.map((e) => e.channel))].sort((a, b) => chanOrder(a) - chanOrder(b))];
    if (!this.guideTabs.includes(this.guideTab)) this.guideTab = "ALL";
    this.guideList = avail.filter((e) => this.guideTab === "ALL" || e.channel === this.guideTab);
    this.guideSel = Phaser.Math.Clamp(this.guideSel, 0, Math.max(0, this.guideList.length - 1));
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.ui.add(o), o);
    const txt = (x: number, y: number, s: string, size: number, color: string, bold = true) => add(this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? "bold" : "normal" }));

    // the screen: deep blue with faint scanlines
    add(this.add.rectangle(SX, SY, SW, SH, 0x0a1030).setOrigin(0));
    const lines = add(this.add.graphics());
    lines.fillStyle(0xffffff, 0.025);
    for (let y = SY; y < SY + SH; y += 4) lines.fillRect(SX, y, SW, 1);

    // header: the KRELTV badge, ON DEMAND, and "whatever's on" to the right
    add(this.add.rectangle(SX, SY, SW, 46, 0x141c4d).setOrigin(0));
    add(this.add.rectangle(SX, SY + 46, SW, 2, 0xd4a017).setOrigin(0));
    add(this.add.rectangle(SX + 14, SY + 11, 78, 24, 0xffd23f).setOrigin(0).setStrokeStyle(2, 0x7a5a00));
    txt(SX + 53, SY + 23, "KRELTV", 14, "#1a1200").setOrigin(0.5);
    txt(SX + 104, SY + 23, "ON DEMAND", 18, "#ffffff").setOrigin(0, 0.5);
    const pill = add(this.add.rectangle(SX + SW - 14, SY + 23, 170, 26, 0x1f2b6b).setOrigin(1, 0.5).setStrokeStyle(2, 0x7fb3ff).setInteractive({ useHandCursor: true }));
    const pillT = txt(SX + SW - 99, SY + 23, "📺 WHATEVER'S ON", 12, "#cfe0ff").setOrigin(0.5);
    pill.on("pointerover", () => pill.setFillStyle(0x2d3d94));
    pill.on("pointerout", () => pill.setFillStyle(0x1f2b6b));
    pill.on("pointerdown", () => (synth.play("select"), this.surf()));
    void pillT;

    // channel tabs
    let tx = SX + 14;
    for (const tab of this.guideTabs) {
      const on = tab === this.guideTab;
      const col = tab === "ALL" ? 0xffd23f : chanColor(tab);
      const label = tab === "ALL" ? "ALL" : chanCode(tab);
      const w = label.length * 9 + 22;
      const r = add(this.add.rectangle(tx, SY + 56, w, 22, on ? col : 0x141c4d).setOrigin(0).setStrokeStyle(2, col, on ? 1 : 0.6).setInteractive({ useHandCursor: true }));
      txt(tx + w / 2, SY + 67, label, 11, on ? "#0a0a14" : "#dfe6ff").setOrigin(0.5);
      r.on("pointerdown", () => this.setGuideTab(tab));
      tx += w + 6;
    }
    const tabName = this.guideTab === "ALL" ? "Every channel" : this.guideTab;
    txt(SX + SW - 14, SY + 67, tabName.length > 22 ? tabName.slice(0, 21) + "…" : tabName, 10, "#8fa0d0", false).setOrigin(1, 0.5);

    // the list
    const R = TVScene.ROWS;
    const top0 = SY + 88;
    // a redraw puts a new card under a mouse that hasn't moved: only a real move picks a row (so the keys aren't fought)
    const ptr = this.input.activePointer;
    const still = { x: ptr.x, y: ptr.y };
    const RH = 40;
    this.guideTop = Phaser.Math.Clamp(this.guideTop, 0, Math.max(0, this.guideList.length - R));
    if (!this.guideList.length) txt(SX + SW / 2, top0 + 120, "Nothing on this channel yet.", 14, "#8fa0d0", false).setOrigin(0.5);
    this.guideList.slice(this.guideTop, this.guideTop + R).forEach((e, k) => {
      const i = this.guideTop + k;
      const sel = i === this.guideSel;
      const y = top0 + k * RH;
      const col = chanColor(e.channel);
      const seen = watched.includes(e.id);
      const card = add(this.add.rectangle(SX + 14, y, SW - 28, RH - 5, sel ? 0x26357a : 0x131b45).setOrigin(0).setStrokeStyle(2, sel ? col : 0x222c66).setInteractive({ useHandCursor: true }));
      card.on("pointerover", (p: Phaser.Input.Pointer) => {
        if (p.x === still.x && p.y === still.y) return;
        if (this.guideSel !== i) {
          this.guideSel = i;
          this.drawGuide();
        }
      });
      card.on("pointerdown", () => (synth.play("select"), this.play(e)));
      // channel chip
      const story = STORY_EPISODES.has(e.id);
      add(this.add.rectangle(SX + 22, y + 6, 50, RH - 17, story ? 0xffffff : col).setOrigin(0).setStrokeStyle(story ? 2 : 0, 0xd4a017));
      txt(SX + 47, y + (RH - 5) / 2, story ? "STORY" : chanCode(e.channel), story ? 9 : 10, story ? "#7a5a00" : "#0a0a14").setOrigin(0.5);
      const title = e.title.length > 40 ? e.title.slice(0, 39) + "…" : e.title;
      const show = e.show.length > 46 ? e.show.slice(0, 45) + "…" : e.show;
      txt(SX + 82, y + 5, title, 14, sel ? "#ffffff" : "#e6ebff");
      txt(SX + 82, y + 21, show, 10, sel ? "#b9c8ff" : "#7f8cc0", false);
      // badge: NEW (a gift waiting, in a run) or ✓ seen
      const bx = SX + SW - 22;
      const by = y + (RH - 5) / 2;
      if (seen) txt(bx, by, "✓ SEEN", 10, "#4ade80").setOrigin(1, 0.5);
      else {
        const b = add(this.add.rectangle(bx, by, this.fromTitle ? 42 : 60, 18, 0xffd23f).setOrigin(1, 0.5));
        void b;
        txt(bx - (this.fromTitle ? 21 : 30), by, this.fromTitle ? "NEW" : "🎁 NEW", 10, "#1a1200").setOrigin(0.5);
      }
      if (sel) txt(SX + 6, by, "▶", 12, "#ffd23f").setOrigin(0.5);
    });
    // scroll hints
    if (this.guideTop > 0) txt(SX + SW / 2, top0 - 7, "▲", 10, "#7fb3ff").setOrigin(0.5);
    if (this.guideTop + R < this.guideList.length) txt(SX + SW / 2, top0 + R * RH - 2, `▼ ${this.guideList.length - this.guideTop - R} more`, 10, "#7fb3ff").setOrigin(0.5);

    // footer: the TV log, then the keys
    const seenN = avail.filter((e) => watched.includes(e.id)).length;
    const locked = ALL_EPISODES.length - avail.length;
    const log = this.fromTitle
      ? `📺 ${avail.length} shows to watch${locked ? ` · 🔒 ${locked} more turn up as you play the story` : ""}`
      : `📺 Seen ${seenN} of ${avail.length} · 🎁 ${avail.length - seenN} Kreddle gift${avail.length - seenN === 1 ? "" : "s"} to claim${locked ? ` · 🔒 ${locked} unlock later` : ""}`;
    add(this.add.rectangle(SX, SY + SH - 40, SW, 40, 0x0d1438).setOrigin(0));
    txt(SX + SW / 2, SY + SH - 29, log, 11, "#facc15", false).setOrigin(0.5);
    txt(SX + SW / 2, SY + SH - 13, "↑↓ pick · ←→ channel · ENTER watch · ESC whatever's on", 10, "#7f8cc0", false).setOrigin(0.5);
  }

  // ---------------------------------------------------------- playback

  private play(e: TVEpisode) {
    // counts for "whatever's on": no repeats until everything has been on (see surf())
    SURF_ROUNDS[this.fromTitle ? "title" : "run"].add(e.id);
    this.splatLayer?.destroy();
    this.splatLayer = undefined;
    this.ui.removeAll(true);
    this.stage.removeAll(true);
    this.actors = {};
    this.props = {};
    this.setKey = "";
    this.mode = "playing";
    this.ep = e;
    // Chapter 2 opens with a night in: starting any episode counts (skipping is fine once it's on)
    if (!this.fromTitle && G.s.chapter === 2) G.s.flags.ch2_tv_watched = true;
    this.pov?.destroy();
    const host = { setTexture: () => this.setTexture(), spriteFor: (n: string) => this.actorTex(n.toUpperCase()) };
    this.news?.destroy();
    this.news = e.style !== "pov" && NewsDirector.wants(e) ? new NewsDirector(this, { SX, SY, SW, SH }, e) : null;
    this.newsOutro = false;
    // genre presentations (sitcom, soap, documentary...) live in ./tv
    this.pov = e.style === "pov" ? new PovDirector(this, { SX, SY, SW, SH }, e.beats, host) : this.news ? null : makeShowDirector(this, { SX, SY, SW, SH }, e, host);
    voice.prefetch(e.beats.filter((b: any) => b.type === "speaker" && b.text).map((b: any) => ({ s: b.character, t: b.text })));
    this.beat = 0;
    this.pausedPlay = false;
    synth.stopMusic();
    if (e.id === "tcc_ep7") G.drongus("tv_tcc");
    if (e.contentNote) {
      this.card.setText(`CONTENT NOTE\n${e.contentNote}`).setFontSize(16);
      this.beatTimer = this.time.delayedCall(2600, () => {
        this.card.setFontSize(26).setText("");
        this.runBeat();
      });
    } else this.runBeat();
  }

  private runBeat() {
    this.beatTimer?.remove();
    if (!this.ep || this.mode !== "playing") return;
    if (this.beat >= this.ep.beats.length) {
      // the bulletin's B-roll and closing sting before the set goes off
      if (this.news && !this.newsOutro) {
        this.newsOutro = true;
        this.subs.setText("");
        this.beatTimer = this.time.delayedCall(this.news.outro(), () => this.runBeat());
        return;
      }
      return this.finishEpisode();
    }
    const b = this.ep.beats[this.beat];
    this.applyBeat(b);
    const dur = Math.max(beatDuration(b) * 1000, this.beatHold);
    const started = this.time.now;
    const next = () => {
      if (this.pausedPlay) return;
      // don't cut the reader off mid-passage: wait for the speech to finish (capped so a stuck engine can't hang the show)
      if (b.type === "speaker" && voice.busy() && this.time.now - started < dur + 30000) {
        this.beatTimer = this.time.delayedCall(150, next);
        return;
      }
      this.beat++;
      this.runBeat();
    };
    this.beatTimer = this.time.delayedCall(dur, next);
  }

  private applyBeat(b: TVBeat, idx = this.beat) {
    this.beatHold = 0;
    this.mouthTimer?.remove();
    for (const a of Object.values(this.actors)) if (String(a.spr.frame.name) === "3") a.spr.setFrame(0);
    if (b.type !== "speaker" && b.type !== "direction") this.subs.setText("");
    switch (b.type) {
      case "titleCard":
        // the news draws its own titles (an ident, a BREAKING banner, a LIVE strap); so do the genre directors
        this.card.setText(this.news || (this.pov && "ownsCards" in this.pov) ? "" : displayText(b.text));
        this.subs.setText("");
        break;
      case "shot":
        this.card.setText("");
        // the news draws its own sets: never put the old studio art underneath it
        if (!this.news) this.drawSet(this.setFor(b.set), b.framing);
        break;
      case "speaker": {
        this.card.setText("");
        const a = this.pov || this.news ? null : this.ensureActor(b.character);
        // an inner monologue reads as a thought: italic, pale blue
        const vo = !!this.pov && /^V\.?\s*O\.?$/i.test(b.emotion ?? "");
        this.subs.setFontStyle(vo ? "italic" : "normal").setColor(vo ? "#cfe8ff" : "#ffffff");
        this.subsAt(this.news ? "news" : "bottom");
        this.subs.setText(this.showSubs ? `${b.character}${vo ? " (V.O.)" : ""}: ${displayText(b.text)}` : "").setVisible(this.showSubs);
        voice.say(b.character, b.text);
        if (a) {
          this.mouthTimer = this.time.addEvent({ delay: 130, loop: true, callback: () => a.spr.setFrame(String(a.spr.frame.name) === "3" ? 0 : 3) });
          if (b.emotion === "crying") a.spr.setTint(0xaaccff);
          else if (a.spr.getData("pose") !== "asleep") a.spr.clearTint();
        }
        synth.play("type");
        break;
      }
      case "direction":
        this.subs.setFontStyle("normal").setColor("#ffffff");
        // in POV the action happens at the bottom of the picture: the stage direction goes up top
        this.subsAt(this.pov ? "top" : this.news ? "news" : "bottom");
        this.subs.setText(this.showSubs ? `(${b.action})` : "").setVisible(this.showSubs);
        break;
      case "audience": {
        const map = { laugh: "[LAUGHTER]", biglaugh: "[UPROARIOUS LAUGHTER]", cheer: "[CHEERING]", gasp: "[GASP]", whistle: "[WHISTLES]" } as const;
        this.caption.setText(map[b.cue]).setY(this.news ? SY + 40 : SY + 10);
        this.time.delayedCall(b.cue === "biglaugh" ? 3800 : 2000, () => this.caption.setText(""));
        synth.play(b.cue);
        break;
      }
      case "sfx":
        if (b.id === "krezz_splat") this.krezzSplat();
        else synth.play(b.id);
        break;
      case "music":
        // a directed bulletin brings its own opening ident and the bed under the desk (TVNews), in place of the old jingle
        if (this.news && b.id === "news") break;
        if (b.mode === "start") synth.musicRaw(b.id, true);
        else synth.stopMusic();
        break;
      case "transition":
        if (b.mode === "smashCut") this.cameras.main.flash(120, 255, 255, 255);
        else if (b.mode === "fade") this.cameras.main.fadeIn(500, 0, 0, 0);
        break;
      case "prop":
        this.setProp(b.id, b.on);
        break;
      case "blocking":
        this.block(b.character, b.to, b.pose);
        break;
    }
    if (this.pov) this.beatHold = this.pov.beat(b, idx);
    if (this.news) this.beatHold = this.news.beat(b, idx);
  }

  private subsAt(where: "top" | "bottom" | "news") {
    if (where === "top") this.subs.setOrigin(0.5, 0).setY(SY + 10).setFontSize(13);
    // above the news ticker and headline strap
    else if (where === "news") this.subs.setOrigin(0.5, 1).setY(SY + SH - 84).setFontSize(14);
    else this.subs.setOrigin(0.5, 1).setY(SY + SH - 16).setFontSize(15);
  }

  /** The set's art key for a scene heading (an episode's own `sets` first). */
  private setFor(set: string) {
    const up = set.toUpperCase();
    for (const [word, key] of Object.entries(this.ep?.sets ?? {})) if (up.includes(word.toUpperCase())) return key;
    return setKeyFor(set);
  }

  private setTexture() {
    const k = `tv_${this.setKey}`;
    return this.textures.exists(k) ? k : "tv_default";
  }

  /** A big krezz splat right over the screen: one huge one in the middle, a spatter round it, then it drips. */
  private krezzSplat() {
    const tex = this.textures.exists("fx_splat_white") ? "fx_splat_white" : null;
    const mg = this.make.graphics({}, false);
    mg.fillRect(SX, SY, SW, SH);
    const layer = this.add.container(0, 0).setDepth(55).setMask(mg.createGeometryMask());
    this.splatLayer?.destroy();
    this.splatLayer = layer;
    const blob = (x: number, y: number, size: number, delay: number) =>
      this.time.delayedCall(delay, () => {
        if (!layer.active) return;
        const s = tex ? this.add.image(x, y, tex).setDisplaySize(size, size * (0.8 + Math.random() * 0.4)) : this.add.circle(x, y, size / 2, 0xf8f8f2);
        s.setAlpha(0.95).setRotation(Math.random() * Math.PI * 2);
        layer.add(s);
        const sx = s.scaleX, sy = s.scaleY;
        s.setScale(sx * 0.15, sy * 0.15);
        this.tweens.add({ targets: s, scaleX: sx, scaleY: sy, duration: 140, ease: "Back.out" });
        this.tweens.add({ targets: s, y: y + 30 + Math.random() * 60, delay: 700, duration: 3200, ease: "Sine.in" });
        synth.play("splat");
      });
    // the big one, slap in the middle of the screen
    blob(SX + SW / 2, SY + SH / 2 - 20, SW * 0.85, 0);
    this.cameras.main.shake(180, 0.006);
    for (let i = 0; i < 12; i++) blob(SX + 30 + Math.random() * (SW - 60), SY + 30 + Math.random() * (SH - 60), 70 + Math.random() * 120, 60 + i * 55);
  }

  private splatLayer?: Phaser.GameObjects.Container;

  private finishEpisode() {
    this.splatLayer?.destroy();
    this.splatLayer = undefined;
    const e = this.ep!;
    const directed = !!this.pov;
    this.pov?.destroy();
    this.pov = null;
    if (this.news || directed) {
      // don't flash whatever old set (and stage sprites) sits behind the bulletin or the show once it comes down
      this.stage.removeAll(true);
      this.actors = {};
      this.props = {};
      this.setKey = "";
    }
    this.news?.destroy();
    this.news = null;
    if (!this.fromTitle) {
      const fresh = !G.s.tvWatched.includes(e.id);
      G.watched(e.id);
      G.s.flags[`tv_${e.id}`] = true;
      if (fresh) bump(G.s, "tv_watched");
      // Kreddle's "gift": only for new shows you chose to watch (not briefings, not repeats)
      if (fresh && !this.once) this.kreddleGift();
      G.save();
    } else {
      if (!G.meta.tvWatched.includes(e.id)) G.meta.tvWatched.push(e.id);
      G.saveMeta();
    }
    const pf = synth.playingFile();
    if (pf === "anthem" || pf === "crazy") synth.stopMusic();
    this.subs.setText("");
    this.card.setText("");
    if (this.once) {
      this.time.delayedCall(600, () => this.exit());
      return;
    }
    // and straight on to whatever's on next
    this.card.setText("COMING UP NEXT…");
    this.time.delayedCall(1400, () => this.mode === "playing" && this.ep === e && (this.card.setText(""), this.surf()));
    if (e.id === "tcc_ep7" && !this.fromTitle) G.emit("toast", { title: "KRELTV", text: "The cabinet has opinions about Thick Cumming Cock. Go and ask them." });
  }

  private kreddleGift() {
    const s = G.s;
    // every new episode: some Krezzcoin, and half the time some Krokens on top
    const c = 45 + Math.floor(Math.random() * 12) * 5;
    s.coins += c;
    let txt = `+${c} KREZZCOIN`;
    if (Math.random() < 0.5) {
      const n = 4 + Math.floor(Math.random() * 7);
      addKrokens(s, n);
      txt += ` · +${n} KROKENS`;
    }
    synth.play("ding");
    G.emit("toast", { title: "🎁 A GIFT FROM KREDDLE", text: `${txt}. "Keep watching, Krelworld." — President Klerble` });
    const t = this.add.text(SX + SW / 2, SY + SH - 70, `🎁 A GIFT FROM KREDDLE\n${txt}`, { fontFamily: FONT, fontSize: "24px", color: "#ff4fd8", fontStyle: "bold", align: "center", backgroundColor: "#000000cc", padding: { x: 12, y: 8 } }).setOrigin(0.5).setDepth(80).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: "Back.out" });
    this.time.delayedCall(2200, () => this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() }));
  }

  private drawSet(key: string, framing: string) {
    if (key === this.setKey) {
      this.frame(framing);
      return;
    }
    this.setKey = key;
    for (const a of Object.values(this.actors)) a.spr.destroy();
    this.actors = {};
    for (const p of Object.values(this.props)) p.destroy();
    this.props = {};
    this.stage.removeAll(true);
    // PixelLab set (generated at 280x212, drawn at 2x inside the CRT)
    const known = ["newsdesk", "polson_ext", "townhall_cam", "pitch", "shopping", "emergency", "archive", "forest", "nyc_skyline", "office_night", "cave", "livingroom", "pubbar", "cellar", "press", "cockpit", "bunker", "boardroom", "cell", "street_day"];
    const artKey = known.includes(key) || this.textures.exists(`tv_${key}`) ? `tv_${key}` : "tv_default";
    if (this.textures.exists(artKey)) {
      const img = this.add.image(SX + SW / 2, SY + SH / 2, artKey);
      const src = this.textures.get(artKey).getSourceImage();
      img.setScale(Math.max(SW / src.width, SH / src.height));
      this.stage.add(img);
      if (key === "shopping") this.stage.add(this.add.image(SX + 430, SY + 250, "p_wonking").setScale(3));
      if (key === "emergency") this.stage.add(this.add.text(SX + SW / 2, SY + 25, "⚠ EMERGENCY BROADCAST ⚠", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#b91c1c" }).setOrigin(0.5));
      if (key === "townhall_cam") this.stage.add(this.add.text(SX + SW - 60, SY + 20, "● LIVE", { fontFamily: FONT, fontSize: "13px", color: "#ff3333", fontStyle: "bold" }));
      this.frame(framing);
      return;
    }
    const g = this.add.graphics();
    this.stage.add(g);
    const P = (x: number, y: number, w: number, h: number, c: number, a = 1) => {
      g.fillStyle(c, a);
      g.fillRect(SX + x, SY + y, w, h);
    };
    switch (key) {
      case "office_night":
        P(0, 0, SW, SH, 0x1b1f2e);
        P(30, 40, 200, 140, 0x0a1430);
        for (let i = 0; i < 12; i++) P(40 + i * 15, 100 + ((i * 37) % 60), 8, 80, 0x1a2550);
        for (let i = 0; i < 20; i++) P(40 + ((i * 41) % 180), 110 + ((i * 23) % 60), 2, 2, 0xffe08a);
        P(30, 40, 200, 6, 0x333a52);
        P(330, 50, 160, 90, 0x2a2f45);
        this.stage.add(this.add.text(SX + 410, SY + 95, "THICK CUMMING COCK\nADVERTISING", { fontFamily: FONT, fontSize: "10px", color: "#ffd23f", align: "center" }).setOrigin(0.5));
        P(0, 300, SW, 120, 0x2b2118);
        P(80, 270, 400, 40, 0x5a3a20);
        P(80, 306, 400, 6, 0x3b2a1a);
        break;
      case "nyc_skyline":
        P(0, 0, SW, SH, 0x7ec8f0);
        P(0, 280, SW, 140, 0x5f7f9f);
        for (let i = 0; i < 26; i++) P(i * 22, 220 + ((i * 53) % 70), 20, 200, 0x5a6a80);
        P(250, 80, 34, 300, 0xb0b8c4);
        P(300, 80, 34, 300, 0xa0a8b4);
        for (let y = 90; y < 370; y += 8) {
          P(254, y, 26, 2, 0x8a929e);
          P(304, y, 26, 2, 0x7a828e);
        }
        P(262, 60, 4, 20, 0x8a929e);
        P(0, 380, SW, 40, 0x3a4a5a);
        break;
      case "newsdesk":
        P(0, 0, SW, SH, 0x0f2a5a);
        P(0, 260, SW, 160, 0x0a1c3c);
        P(60, 250, 440, 80, 0x1f3f7f);
        P(60, 250, 440, 6, 0xffd23f);
        P(330, 60, 200, 120, 0x223a6a);
        this.stage.add(this.add.text(SX + 430, SY + 120, "KNN\nKRELFORD", { fontFamily: FONT, fontSize: "16px", color: "#ffffff", align: "center", fontStyle: "bold" }).setOrigin(0.5));
        break;
      case "polson_ext":
        P(0, 0, SW, SH, 0x0b1020);
        P(120, 120, 320, 220, 0x5a4a3a);
        P(100, 100, 360, 30, 0x3a2a1a);
        P(150, 170, 50, 50, 0xffe08a, 0.7);
        P(360, 170, 50, 50, 0xffe08a, 0.7);
        P(0, 340, SW, 80, 0x7a5a2a);
        this.stage.add(this.add.text(SX + 280, SY + 380, "(the bin is overflowing)", { fontFamily: FONT, fontSize: "11px", color: "#ddd" }).setOrigin(0.5));
        break;
      case "townhall_cam":
        P(0, 0, SW, SH, 0x6b2737);
        P(0, 280, SW, 140, 0x5a3a20);
        P(40, 40, 120, 90, 0x6a8fd0);
        this.stage.add(this.add.text(SX + SW - 60, SY + 20, "● LIVE", { fontFamily: FONT, fontSize: "13px", color: "#ff3333", fontStyle: "bold" }));
        break;
      case "pitch":
        P(0, 0, SW, SH, 0x6aa0e0);
        P(0, 150, SW, 270, 0x3e8a3a);
        for (let x = 0; x < SW; x += 60) P(x, 150, 30, 270, 0x47994a);
        P(SW / 2 - 2, 150, 4, 270, 0xffffff);
        P(20, 230, 10, 100, 0xffffff);
        break;
      case "shopping":
        P(0, 0, SW, SH, 0x3a0a2a);
        for (let i = 0; i < 8; i++) P(i * 70, 0, 35, SH, 0x4a1a3a);
        P(0, 300, SW, 120, 0x2a0a1a);
        this.stage.add(this.add.image(SX + 430, SY + 230, "p_wonking").setScale(3));
        this.stage.add(this.add.text(SX + 430, SY + 130, "£49.99\n(or 6 Krezzcoin)", { fontFamily: FONT, fontSize: "14px", color: "#ffd23f", align: "center", fontStyle: "bold" }).setOrigin(0.5));
        break;
      case "emergency":
        P(0, 0, SW, SH, 0x000000);
        P(0, 0, SW, 50, 0xb91c1c);
        this.stage.add(this.add.text(SX + SW / 2, SY + 25, "⚠ EMERGENCY BROADCAST ⚠", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
        break;
      case "archive":
        P(0, 0, SW, SH, 0x2a1f12);
        for (let i = 0; i < 6; i++) P(20 + i * 90, 40, 70, 300, 0x4a3a22);
        break;
      case "forest":
        P(0, 0, SW, SH, 0x9fd0ff);
        P(0, 260, SW, 160, 0x3d6a2a);
        P(260, 120, 40, 160, 0x5a3a20);
        g.fillStyle(0x2f5a22, 1);
        g.fillCircle(SX + 280, SY + 120, 80);
        for (let i = 0; i < 9; i++) P(220 + ((i * 29) % 120), 80 + ((i * 17) % 80), 6, 6, 0xc084fc);
        break;
      case "cave":
        P(0, 0, SW, SH, 0x1a1410);
        for (let i = 0; i < 14; i++) P((i * 47) % SW, (i * 31) % 200, 60, 40, 0x2a2018);
        P(0, 320, SW, 100, 0x3a2a1a);
        P(240, 280, 90, 50, 0x6b4527);
        g.fillStyle(0xffd27a, 0.25);
        g.fillCircle(SX + 120, SY + 160, 70);
        break;
      case "livingroom":
        P(0, 0, SW, SH, 0x6b5b4b);
        P(0, 300, SW, 120, 0x4a3a2a);
        P(60, 230, 240, 80, 0x7a1f2b);
        P(380, 150, 120, 90, 0x111111);
        P(390, 160, 100, 70, 0x3b82f6, 0.6);
        P(330, 40, 90, 70, 0x9fd0ff);
        break;
      case "pubbar":
        P(0, 0, SW, SH, 0x3b2a1a);
        P(0, 260, SW, 160, 0x2a1a0a);
        P(40, 220, 480, 60, 0x5a3a20);
        for (let i = 0; i < 6; i++) P(80 + i * 70, 60, 30, 100, 0x8a5a2a);
        this.stage.add(this.add.text(SX + 280, SY + 30, "THE QUEEN VIC", { fontFamily: FONT, fontSize: "16px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5));
        break;
      case "cellar":
        P(0, 0, SW, SH, 0x1f2328);
        for (let i = 0; i < 5; i++) P(0, 40 + i * 50, SW, 8, 0x4b5563);
        P(220, 200, 140, 120, 0x6b7280);
        P(240, 220, 100, 30, 0xffb6c1);
        break;
      case "press":
        P(0, 0, SW, SH, 0x1e3a8a);
        P(0, 0, SW, 60, 0x172554);
        P(250, 200, 60, 120, 0x5a3a20);
        P(270, 180, 20, 30, 0x111111);
        break;
      case "cockpit":
        P(0, 0, SW, SH, 0x111827);
        P(60, 40, 440, 160, 0x7ec8f0);
        P(120, 120, 20, 70, 0x6b7280);
        P(140, 100, 10, 90, 0x6b7280);
        P(0, 220, SW, 200, 0x1f2937);
        for (let i = 0; i < 20; i++) P(60 + (i % 10) * 44, 250 + Math.floor(i / 10) * 30, 20, 12, i % 3 ? 0x22c55e : 0xef4444);
        break;
      case "bunker":
        P(0, 0, SW, SH, 0x2a2f3a);
        P(0, 300, SW, 120, 0x1f232b);
        P(120, 230, 320, 50, 0x3b2a1a);
        P(220, 40, 120, 80, 0x0f2a5a);
        break;
      case "boardroom":
        P(0, 0, SW, SH, 0xd6c49a);
        P(0, 300, SW, 120, 0x6b4527);
        P(60, 240, 440, 60, 0x3b2a1a);
        P(360, 50, 140, 100, 0xe7d8b0);
        break;
      case "cell":
        P(0, 0, SW, SH, 0x3a3f4a);
        for (let x = 20; x < SW; x += 40) P(x, 0, 8, SH, 0x111827);
        P(0, 330, SW, 90, 0x2a2f3a);
        break;
      case "street_day":
        P(0, 0, SW, SH, 0x9fd0ff);
        for (let i = 0; i < 10; i++) P(i * 58, 140 + ((i * 37) % 60), 50, 200, [0xc9a227, 0xd6c49a, 0xb08d57][i % 3]);
        P(0, 330, SW, 90, 0x9a9488);
        break;
      default:
        P(0, 0, SW, SH, 0x222222);
    }
    this.frame(framing);
  }

  private frame(framing: string) {
    const f = framing.toUpperCase();
    let zoom = 1;
    if (f.includes("CLOSE")) zoom = 1.35;
    else if (f.includes("TWO")) zoom = 1.12;
    const cx = f.includes("JENNY") ? SX + 150 : f.includes("CHRISTOPHER") ? SX + 400 : SX + SW / 2;
    const fx = zoom === 1 ? SX + SW / 2 : cx;
    this.tweens.add({ targets: this.stage, scale: zoom, x: SX + SW / 2 - fx * zoom, y: (SY + SH / 2) * (1 - zoom), duration: 250 });
  }

  private actorTex(name: string): string | null {
    // PixelLab TV cast (spr_TV_<NAME>) first
    const up = name.toUpperCase() === "KRELBERT AND RONSON" ? "KRELBERT" : name.toUpperCase();
    const keyOf = (n: string) => `spr_TV_${n.replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    const tvKey = keyOf(up);
    if (this.textures.exists(tvKey)) return tvKey;
    // numbered extras ("EXECUTIVE 2", "JOURNALIST #4") and stock roles share one actor
    const base = up.replace(/\s*#?\d+$/, "");
    const alias = TV_ALIASES[base] ?? base;
    if (this.textures.exists(keyOf(alias))) return keyOf(alias);
    const c = CAST[name.toUpperCase()];
    if (typeof c === "string") return c;
    if (c) return `tv_${name.toUpperCase()}`;
    return this.extraActorTex(name.toUpperCase());
  }

  /** Stand-in actors for shows without a bespoke cast (townsfolk sprites, picked by name). */
  private extraActorTex(name: string): string | null {
    if (!this.ep || !EXTRA_CAST_SHOWS.has(this.ep.id)) return null;
    if (["PHONE", "NARRATOR", "VJ"].includes(name)) return null;
    const named: Record<string, string> = { KROZNO: "boss_krozno", "KEIR STARMER": "npc_journo", "PHIL": "boss_rival", "GOKU": "spr_KREZMAR" };
    if (named[name]) return named[name];
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `spr_FOLK${h % 4}`;
  }

  private ensureActor(name: string): Actor | null {
    const key = name.toUpperCase();
    if (this.actors[key]) return this.actors[key];
    const tex = this.actorTex(key);
    if (!tex || this.setKey === "nyc_skyline") return null;
    const count = Object.keys(this.actors).length;
    const extra = !CAST[key] || tex.startsWith("spr_TV_");
    const x = extra ? SX + 110 + (count % 3) * 170 : SX + 150 + count * 250;
    const hdArt = !!charMeta(this, tex);
    const spr = this.add.sprite(x, SY + 280, tex, 0).setScale(hdArt ? 4.4 : (this.textures.getFrame(tex, 0)?.height ?? 24) > 30 ? 2.5 : 5);
    this.stage.add(spr);
    if (key === "SUSAN NIPWOOD") {
      // she's a ghost
      spr.setAlpha(0.6);
      this.tweens.add({ targets: spr, y: spr.y - 10, alpha: 0.4, yoyo: true, repeat: -1, duration: 1400, ease: "Sine.easeInOut" });
    }
    const a = { spr, name: key };
    this.actors[key] = a;
    return a;
  }

  private block(name: string, to: string, pose?: string) {
    const a = this.ensureActor(name);
    if (!a) return;
    const pos: Record<string, number> = { left: SX + 150, right: SX + 400, center: SX + SW / 2 };
    a.spr.setData("pose", pose ?? "");
    if (to === "enter") {
      a.spr.setX(SX + SW + 40);
      return;
    }
    if (to === "offscreen") {
      this.tweens.add({ targets: a.spr, x: SX - 60, duration: 600 });
      return;
    }
    if (to === "lap") {
      const other = Object.values(this.actors).find((o) => o !== a);
      const tx = other ? other.spr.x - 30 : SX + 380;
      this.tweens.add({ targets: a.spr, x: tx, y: SY + 268, duration: 700 });
      if (other) this.time.delayedCall(720, () => {
        const heart = this.add.text((a.spr.x + other.spr.x) / 2, SY + 170, "❤", { fontSize: "40px" }).setOrigin(0.5);
        this.stage.add(heart);
        this.tweens.add({ targets: heart, y: heart.y - 40, alpha: 0, duration: 1600, onComplete: () => heart.destroy() });
      });
      return;
    }
    this.tweens.add({ targets: a.spr, x: pos[to] ?? SX + SW / 2, duration: 600 });
    a.spr.setFlipX(to === "right");
    if (pose === "asleep") {
      a.spr.setTint(0x8888aa);
      const z = this.add.text(a.spr.x + 30, a.spr.y - 70, "z z z", { fontFamily: FONT, fontSize: "20px", color: "#ffffff" });
      this.stage.add(z);
      this.tweens.add({ targets: z, y: z.y - 20, alpha: 0, duration: 1800, repeat: 1, onComplete: () => z.destroy() });
    } else if (pose === "stand") a.spr.clearTint();
  }

  private setProp(id: string, on: boolean) {
    if (!on) {
      this.props[id]?.destroy();
      delete this.props[id];
      return;
    }
    if (id === "wine") {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.6).fillRect(SX + 200, SY + 250, 8, 14);
      g.fillStyle(0x7a0a1a, 1).fillRect(SX + 201, SY + 254, 6, 7);
      g.fillStyle(0xffffff, 0.6).fillRect(SX + 203, SY + 264, 2, 6).fillRect(SX + 199, SY + 270, 10, 2);
      this.stage.add(g);
      this.props[id] = g;
    } else if (id === "plane") {
      const pl = this.add.text(SX + SW + 40, SY + 150, "✈", { fontSize: "34px", color: "#333333" }).setOrigin(0.5);
      this.stage.add(pl);
      this.tweens.add({ targets: pl, x: SX + 360, y: SY + 170, duration: 4200, ease: "Linear" });
      this.props[id] = pl;
    }
  }

  private togglePause() {
    if (this.mode !== "playing") return;
    this.pausedPlay = !this.pausedPlay;
    this.caption.setText(this.pausedPlay ? "⏸ PAUSED" : "");
    const ss = "speechSynthesis" in window ? window.speechSynthesis : null;
    if (!this.pausedPlay) {
      ss?.resume();
      // let the line that was paused finish reading before moving on
      const go = () => {
        if (this.pausedPlay || this.mode !== "playing") return;
        if (voice.busy()) { this.beatTimer = this.time.delayedCall(150, go); return; }
        this.beat++;
        this.runBeat();
      };
      go();
    } else {
      this.beatTimer?.remove();
      ss?.pause();
    }
  }

  /** On to the next line of dialogue (set changes, sound effects etc. on the way are applied instantly). */
  private skipBeat() {
    if (this.mode !== "playing" || !this.ep) return;
    this.pausedPlay = false;
    this.beatTimer?.remove();
    voice.stop();
    this.beat++;
    const beats = this.ep.beats;
    while (this.beat < beats.length && !["speaker", "direction", "titleCard"].includes(beats[this.beat].type)) {
      const b = beats[this.beat];
      if (b.type !== "audience" && b.type !== "sfx") this.applyBeat(b);
      this.beat++;
    }
    this.runBeat();
  }

  private rewind() {
    if (this.mode !== "playing" || !this.ep) return;
    // Rebuild state by replaying from the start up to the previous beat.
    const target = Math.max(0, this.beat - 1);
    for (const a of Object.values(this.actors)) a.spr.destroy();
    this.actors = {};
    for (const p of Object.values(this.props)) p.destroy();
    this.props = {};
    this.setKey = "";
    this.stage.removeAll(true);
    for (let i = 0; i < target; i++) {
      const b = this.ep.beats[i];
      if (b.type === "shot" || b.type === "blocking" || b.type === "prop") this.applyBeat(b, i);
    }
    this.beat = target;
    this.pausedPlay = false;
    this.runBeat();
  }

  private back() {
    if (this.once) {
      this.beatTimer?.remove();
      this.exit();
      return;
    }
    // Esc: switch it off (from the on-demand list too)
    this.switchOff();
  }

  private exit() {
    synth.stopMusic();
    if (this.fromTitle) {
      switchTo(this, "Title");
      return;
    }
    if (this.caller) {
      this.scene.resume(this.caller);
      const c = this.scene.get(this.caller);
      c.events.emit("ui-resume");
      synth.music(({ Hub: "hub", Pub: "pub", Home: "home" } as Record<string, string>)[this.caller] ?? (DUNGEON_MUSIC[G.rt.dungeonId] ?? "hub"));
    }
    this.scene.stop();
  }

  update() {
    this.setPlayBtns(this.mode === "playing");
    this.subs.setVisible(this.subs.text.length > 0);
    this.caption.setVisible(this.caption.text.length > 0);
  }

  private onKey(e: KeyboardEvent) {
    if (this.mode === "playing") {
      if (e.key === "Tab") {
        e.preventDefault();
        this.skipShow();
      } else if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") this.skipBeat();
      else if (e.key === "p" || e.key === "P") this.togglePause();
      else if (e.key === "ArrowLeft" || e.key === "Backspace") this.rewind();
      else if (e.key === "s" || e.key === "S") this.showSubs = !this.showSubs;
      else if (e.key === "d" || e.key === "D") this.openDemand();
      else if (e.key === "Escape") this.back();
      return;
    }
    if (this.mode !== "episodes") return;
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") this.moveGuide(1);
    else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") this.moveGuide(-1);
    else if (e.key === "PageDown") this.moveGuide(TVScene.ROWS);
    else if (e.key === "PageUp") this.moveGuide(-TVScene.ROWS);
    else if (e.key === "Enter" || e.key === " " || e.key === "e" || e.key === "E") {
      const ep = this.guideList[this.guideSel];
      if (ep) this.play(ep);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "d" || e.key === "a") {
      const i = this.guideTabs.indexOf(this.guideTab);
      const n = this.guideTabs.length;
      this.setGuideTab(this.guideTabs[(i + (e.key === "ArrowRight" || e.key === "d" ? 1 : -1) + n) % n]);
    }
    // Esc from on demand goes back to whatever's on (switch off with the button beside the telly)
    else if (e.key === "Escape") this.surf();
  }
}

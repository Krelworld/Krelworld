import { JUKEBOX } from "../../content/jukebox";
import { KR_HOME } from "../../content/krunchers";
import Phaser from "phaser";
import { bindSanmikToggle, playerKey } from "../gfx/sanmikForm";
import { G } from "../G";
import { Controls } from "../combat/Controls";
import { DialogueBox } from "../ui/DialogueBox";
import { switchTo } from "../Flow";
import { synth } from "../audio/Synth";
import { FONT, uiFrame } from "../ui/theme";
import { voice } from "../audio/Voice";
import { dir, say } from "../../content/dsl";
import { animateWalker, backdrop } from "../gfx/HD";
import { CHARACTERS } from "../../data/characters";
import { maxBottles, maxHp } from "../systems/stats";
import { canTurnIn, completePersonal } from "../systems/quests";
import type { Line } from "../../data/types";
import { CHAT_AFTER, CONSOLE_GAMES, DECOR_BY_ID, DREAMS, GOLD_TOILET, KREL_TROPHIES, SONG_REPLIES } from "../../content/home";
import { DRONGUS_STATUSES } from "../../content/dialogue/drongusStatuses";
import { BOSS_TEXT } from "../../content/bosses";
import { CRYSTAL_BOSSES, hasCrystal } from "../systems/crystals";
import { PRIZES } from "../../content/kreddle";
import { addKrokens, kd } from "../systems/kreddle";
import { weaponIcon, weaponList } from "../ui/weapons";
import { GUNS } from "../combat/Guns";
import { ammoQuote, buyAmmo, firstLoaded, gunModList, gunRatings, gunUpgrades, modSummary, moddedGun, moveGun, orderedGuns, specialText, STAT_KEYS, STAT_LABELS, type StatKey } from "../systems/armoury";
import { currentStep } from "../Flow";
import { DARK_AUTISM_PASSAGES } from "../../content/darkAutism";
import { clueAt, clueTex, takeClue } from "../systems/trails";
import { shinyColours, shinyPickup, trailPropScale } from "../gfx/shiny";
import { addPantsPoster } from "./home/pantsPoster";

/** Your house: walk about, watch the telly, sleep. New games start here. */

// where your feet can go
const TOP = 455;
const BOTTOM = 536;

interface Spot {
  x: number;
  y: number;
  r: number;
  label: string;
  use: () => void | Promise<void>;
}


export class HomeScene extends Phaser.Scene {
  private controls!: Controls;
  private box!: DialogueBox;
  private me!: Phaser.GameObjects.Sprite;
  private prompt!: Phaser.GameObjects.Text;
  private busy = false;
  private spots: Spot[] = [];
  /** Panels open right now (one closing and another opening straight after mustn't free the player). */
  private openPanels = 0;

  constructor() {
    super("Home");
  }

  create() {
    const s = G.s;
    this.busy = false;
    this.spots = [];
    this.cameras.main.fadeIn(500);
    if (!backdrop(this, "bg_home", { depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x2a2233).setDepth(-10);
    // a warm lamp glow
    const glow = this.add.ellipse(160, 360, 380, 260, 0xffc46b, 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    this.tweens.add({ targets: glow, alpha: 0.5, yoyo: true, repeat: -1, duration: 2400, ease: "Sine.inOut" });
    // the furniture
    const tv = this.add.image(130, 478, "p_tv").setOrigin(0.5, 1).setScale(7).setDepth(470);
    const screen = this.add.rectangle(tv.x - 8, tv.y - tv.displayHeight * 0.48, tv.displayWidth * 0.62, tv.displayHeight * 0.45, 0x7dd3fc, 0.18).setDepth(471).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: screen, alpha: 0.05, yoyo: true, repeat: -1, duration: 160 });
    this.add.image(320, 534, "p_sofa").setOrigin(0.5, 1).setScale(2.5).setDepth(534);
    this.add.image(540, 532, "p_bed").setOrigin(0.5, 1).setScale(5).setDepth(532);
    this.add.text(760, 300, "▼ OUT", { fontFamily: FONT, fontSize: "12px", color: "#ffd23f", fontStyle: "bold", backgroundColor: "#00000099", padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(600);
    // the games console, the laptop on the sofa, the trophy shelf and the armoury
    if (this.textures.exists("p_console")) this.add.image(900, 540, "p_console").setOrigin(0.5, 1).setScale(1.2).setDepth(538);
    if (this.textures.exists("p_laptop")) this.add.image(352, 504, "p_laptop").setOrigin(0.5, 1).setScale(1.25).setDepth(536);
    this.drawShelf(292, 300);
    if (this.textures.exists("p_gunrack")) this.add.image(880, 300, "p_gunrack").setScale(1.6).setDepth(5);
    this.drawDecor();
    addPantsPoster(this, (sp) => this.spots.push(sp), (l) => this.talk(l));
    this.spots.push(
      { x: 140, y: 480, r: 80, label: "E: Watch KrelTV", use: () => this.watchTV() },
      { x: 900, y: 532, r: 42, label: "E: Play the games console", use: () => this.consolePanel() },
      { x: 292, y: 462, r: 40, label: "E: Look at your trophy shelf", use: () => this.trophyPanel() },
      { x: 350, y: 522, r: 48, label: "E: Open the laptop (group chat)", use: () => this.laptopPanel() },
      { x: 540, y: 500, r: 80, label: "E: Sleep (save · full health · sober up · dream)", use: () => this.sleep() },
      { x: 880, y: 468, r: 55, label: "E: Gun rack (order · ammo · perks)", use: () => this.gunRackPanel() },
      { x: 420, y: 445, r: 55, label: "E: Look out of the window", use: () => this.talk([dir(s.flags.met_emergency ? "Krelford. The sky has a faint grey tint, like an unloaded page. Somewhere, a Tap is not running." : "Krelford, in the evening. Somewhere a fizzy bongo is opened. Somewhere else, the Great Tap gurgles. All is well. For now.")]) },
      { x: 760, y: 450, r: 60, label: "E: Go outside", use: () => this.leave() },
      { x: 624, y: 520, r: 44, label: "E: Read 'Dark Autism - An Erotic Memoir'", use: () => this.readBook() },
      { x: 566, y: 452, r: 34, label: "E: Jukebox (every tune you've heard)", use: () => this.jukeboxPanel() },
    );
    this.placeClue();
    // the jukebox, by the radiator, glowing
    if (this.textures.exists("p_jukebox")) {
      this.add.image(566, 440, "p_jukebox").setOrigin(0.5, 1).setScale(1.6).setDepth(440);
      const jg = this.add.ellipse(566, 360, 120, 150, 0xff6fa8, 0.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(439);
      this.tweens.add({ targets: jg, alpha: 0.25, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
    }
    // a well-thumbed copy of Dark Autism - An Erotic Memoir, at the foot of the bed
    if (this.textures.exists("p_dark_autism")) this.add.image(628, 534, "p_dark_autism").setOrigin(0.5, 1).setScale(0.34).setAngle(-14).setDepth(533);
    this.me = this.add.sprite(s.flags.home_seen ? 740 : 420, 500, playerKey(this), 0).setOrigin(0.5, 1).setScale(5.5).setDepth(500);
    bindSanmikToggle(this, { sprites: () => [this.me], can: () => !this.busy });
    this.prompt = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", backgroundColor: "#000000cc", padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(1000).setVisible(false);
    this.controls = new Controls(this);
    // at home the box sits along the top, so you can see yourself and the room while people talk
    this.box = new DialogueBox(this, 2000, 0.2).atMiddle();
    if (!this.scene.isActive("UI")) this.scene.launch("UI", { mode: "hub" });
    else this.scene.get("UI").events.emit("mode", "hub");
    this.events.off("resume");
    this.events.on("resume", () => {
      this.busy = false;
      this.controls.swallow();
      // back from Klerble's broadcast: now you can go
      if (!this.mustWatchBeep() && G.s.flags.beep_tv_pending) {
        delete G.s.flags.beep_tv_pending;
        G.save();
        void this.talk([say(G.s.player, "…Right. Well. That was relaxing."), dir("Back to Chapter 4. Out of the door when you're ready.")]);
      }
      if (this.mustWatch() === false && G.s.flags.klerble_tv_pending) {
        delete G.s.flags.klerble_tv_pending;
        G.save();
        void this.talk([
          say(G.s.player, "…Right. Well. That was relaxing."),
          dir("NEW OBJECTIVE: head out of the door (bottom right) and go to Krelford Town Hall. (Every new show you watch on KrelTV now comes with a 'gift' from Kreddle.)"),
        ]);
      }
    });
    synth.music("home", true);
    this.time.delayedCall(600, () => void this.arrive());
  }

  private async arrive() {
    const s = G.s;
    // the Kreddle Krunchers have just battered Mikey: the group chat finds out (Klerble's music until you're back in control)
    if (s.flags.kr_home_pending) {
      delete s.flags.kr_home_pending;
      this.busy = true;
      synth.music("klerble", true);
      await this.talk(KR_HOME);
      synth.music("home", true);
      this.busy = false;
      G.save();
      return;
    }
    // a new chapter starts here: it gets going as soon as you leave
    if (s.chapter > 1 && s.flags[`ch${s.chapter}_home`] && !s.flags[`ch${s.chapter}_intro`] && !this.mustWatchBeep())
      G.emit("toast", this.mustWatchCh2() ? { title: "CHAPTER 2", text: "A new day. Watch something on KrelTV first (the telly, on the left), then head out." } : { title: `CHAPTER ${s.chapter}`, text: "A new day. Head out of the front door when you're ready." });
    if (this.mustWatchBeep() && !s.flags.beep_tv_pending) {
      await this.talk([dir("A night in. A relaxing episode of Peep Show is about to start. (The telly's on the left: walk up and press E.)")]);
      return;
    }
    const q = canTurnIn(s, "HOME");
    if (q) {
      await this.talk(q.turnIn.lines);
      const coins = completePersonal(s, q);
      G.emit("toast", { title: "PERSONAL QUEST COMPLETE", text: `${q.title}: +${coins} Krezzcoin. ${q.reward.desc}` });
      synth.play("ding");
      G.save();
    }
    if (s.flags.home_seen || s.flags.prologue_done) {
      await this.kreddleTip();
      return;
    }
    s.flags.home_seen = true;
    G.save();
    await this.welcome();
  }

  /** WELCOME TO KRELWORLD: the world, and who you are in it. */
  private async welcome() {
    const s = G.s;
    const me = CHARACTERS[s.player];
    const role = me.ministry ?? me.proctusTitle?.replace(/^Acting /, "") ?? "a member of the cabinet";
    const card = this.add.container(480, 230).setDepth(3000);
    const t = this.add.text(0, 0, "WELCOME TO\nKRELWORLD!", { fontFamily: "Impact, sans-serif", fontSize: "58px", color: "#ffd23f", align: "center", stroke: "#2a1400", strokeThickness: 10 }).setOrigin(0.5);
    t.setShadow(0, 0, "#ffd23f", 16, true, true);
    card.add(t);
    card.setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 500, ease: "Back.out" });
    await new Promise<void>((r) => this.time.delayedCall(1700, () => r()));
    this.tweens.add({ targets: card, alpha: 0, y: 180, duration: 400, onComplete: () => card.destroy() });
    const lines: Line[] = [
      dir("Krelworld is crazy universe. It involves a very important group chat between a group of lads. In this group chat, many serious things are discussed."),
      dir("Its capital is Krelford: a town hall, a pub called the Krezz Arms, a school called Wildern, and in the middle of it all the Great Pussy Juice Tap, which keeps everybody alive and happy. The national drink is lovely pussy juice. So sweet and restorative. Mmm. I'm getting turned on just writing this."),
      dir("The Supreme Leader, DRONGUS B. DRIPPIN', writes the lore. Krelworld runs on lore. Without lore, everything may sadly explode."),
      dir(`And you are ${me.name}${me.aka ? `, ${me.aka}` : ""}: ${role} in Drongus's cabinet. You have to turn up to many important meetings to govern this most crazy of universes, and keep the peace. But today, you wake up with the feeling that something might be about to go wrong..in a very sad yet upsetting way.`),
      dir("TIP: WASD / arrows (or the stick) to walk. E to use things. Have a look round: the telly works, the bed saves your game."),
      say(s.player, "Right. There's a cabinet meeting at the Town Hall later. Something about 'appreciating content'. But first…"),
      dir("Why not watch some lovely TV? (The telly's on the left. Walk up to it and press E.)"),
    ];
    await this.talk(lines);
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (this.busy) {
      this.prompt.setVisible(false);
      return;
    }
    const mv = this.controls.move();
    const sp = 210 * (dt / 1000);
    this.me.x = Phaser.Math.Clamp(this.me.x + mv.x * sp, 40, 920);
    this.me.y = Phaser.Math.Clamp(this.me.y + mv.y * sp, TOP, BOTTOM);
    this.me.setDepth(this.me.y + 1);
    animateWalker(this.me, mv.x, mv.y, Math.hypot(mv.x, mv.y) > 0.1, time);
    let best: Spot | null = null;
    let bd = 1e9;
    for (const sp2 of this.spots) {
      const d = Phaser.Math.Distance.Between(this.me.x, this.me.y, sp2.x, sp2.y);
      if (d < sp2.r && d < bd) {
        best = sp2;
        bd = d;
      }
    }
    if (best) {
      this.prompt.setText(best.label).setVisible(true);
      // keep it on screen at the edges of the room
      const half = this.prompt.width / 2 + 4;
      this.prompt.setPosition(Phaser.Math.Clamp(this.me.x, half, 960 - half), this.me.y - this.me.displayHeight - 12);
      if (this.controls.interact()) void best.use();
    } else {
      this.prompt.setVisible(false);
      this.controls.interact();
    }
    if (this.controls.pause()) {
      this.busy = true;
      this.scene.launch("Menu", { mode: "pause", caller: "Home" });
      this.scene.bringToTop("Menu");
      this.scene.pause();
    }
  }

  /** A new game: you have to watch Klerble's broadcast before you go out. */
  private mustWatch() {
    const f = G.s.flags;
    return !f.prologue_done && !f.tv_klerble_welcome;
  }

  /** Chapter 4 opens with a relaxing episode of Peep Show, and you're not leaving till you've watched it. */
  /** Chapter 2 starts with a night in front of KrelTV: any episode will do (once it's started you can skip it). */
  private mustWatchCh2() {
    return G.s.chapter === 2 && !G.s.flags.ch2_tv_watched && !G.s.flags.ch2_intro;
  }

  private mustWatchBeep() {
    return G.s.chapter === 4 && !G.s.flags.tv_beep_show;
  }

  private watchTV() {
    if (this.mustWatch()) {
      G.s.flags.klerble_tv_pending = true;
      this.busy = true;
      this.scene.launch("TV", { overlay: true, caller: "Home", episode: "klerble_welcome", once: true });
      this.scene.bringToTop("TV");
      this.scene.pause();
      return;
    }
    if (this.mustWatchBeep()) {
      G.s.flags.beep_tv_pending = true;
      this.busy = true;
      this.scene.launch("TV", { overlay: true, caller: "Home", episode: "beep_show", once: true });
      this.scene.bringToTop("TV");
      this.scene.pause();
      return;
    }
    G.drongus("tv");
    this.busy = true;
    this.scene.launch("TV", { overlay: true, caller: "Home" });
    this.scene.bringToTop("TV");
    this.scene.pause();
  }

  /** Open the book at a random page (never the same one twice running); the author reads it out. */
  private async readBook() {
    if (this.busy || !DARK_AUTISM_PASSAGES.length) return;
    const last = (G.rt as any).lastBookPage as number | undefined;
    let i = Math.floor(Math.random() * DARK_AUTISM_PASSAGES.length);
    if (DARK_AUTISM_PASSAGES.length > 1 && i === last) i = (i + 1) % DARK_AUTISM_PASSAGES.length;
    (G.rt as any).lastBookPage = i;
    const cover = this.textures.exists("p_dark_autism") ? this.add.image(150, 190, "p_dark_autism").setScale(0.9).setAngle(-4).setDepth(950).setAlpha(0) : null;
    if (cover) this.tweens.add({ targets: cover, alpha: 1, duration: 250 });
    synth.play("pickup");
    // SKIP: close the book and stop the author mid-sentence
    let skipped = false;
    const skip = this.add
      .text(944, 186, "SKIP ▶▶  (Tab)", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#7a1d1dee", padding: { x: 10, y: 6 } })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(2100)
      .setInteractive({ useHandCursor: true });
    const doSkip = () => {
      if (skipped) return;
      skipped = true;
      voice.stop();
      this.box.skipAll();
    };
    skip.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      doSkip();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") doSkip();
    };
    window.addEventListener("keydown", onKey);
    await this.talk([dir("You open Dark Autism - An Erotic Memoir at a random page."), DARK_AUTISM_PASSAGES[i]]);
    window.removeEventListener("keydown", onKey);
    skip.destroy();
    if (skipped) voice.stop();
    cover?.destroy();
  }

  private async sleep() {
    const s = G.s;
    s.hp = maxHp(s);
    s.intoxication = 0;
    s.bottles = Math.max(s.bottles, s.flags.ch1_clear ? maxBottles(s) : s.bottles);
    G.save();
    this.busy = true;
    // lights out (a black sheet, so the dream's text box still shows)
    const night = this.add.rectangle(480, 270, 960, 540, 0x05030c, 0).setDepth(1500);
    await new Promise<void>((r) => this.tweens.add({ targets: night, fillAlpha: 0.94, duration: 600, onComplete: () => r() }));
    const z = this.add.text(480, 200, "z z z", { fontFamily: FONT, fontSize: "36px", color: "#a5b4fc" }).setOrigin(0.5).setDepth(1501);
    this.tweens.add({ targets: z, y: 170, alpha: 0.3, yoyo: true, repeat: -1, duration: 900 });
    await this.talk(this.dream());
    z.destroy();
    await new Promise<void>((r) => this.tweens.add({ targets: night, fillAlpha: 0, duration: 600, onComplete: () => r() }));
    night.destroy();
    G.emit("toast", { title: "SAVED", text: "You slept. Full health, sober, game saved." });
    await this.kreddleTip();
  }

  /** Chapter 2: if you still haven't been over the bridge, a nudge towards Kreddle's shops (once). */
  private async kreddleTip() {
    const s = G.s;
    if (s.chapter !== 2 || s.flags.kreddle_seen || s.flags.kreddle_tip_home) return;
    s.flags.kreddle_tip_home = true;
    G.save();
    synth.play("notify");
    await this.talk([
      dir("💡 TIP: Why not visit KREDDLE? It's over the Kreddle Bridge, at the far WEST of Krelford."),
      dir("The Kreddle Exchange sells new guns, ammo and upgrades, there are slot machines and a Prize Counter full of perks, and you can hire a lad to fight with you. They hate us there. Their shops are excellent."),
    ]);
  }

  /** What you dream about: a hint, an old Drongus status, or something stupid. */
  private dream(): Line[] {
    const r = Math.random();
    const st = currentStep();
    if (r < 0.34 && st) return [dir("You dream about Krezwonk. He's floating. He's glowing. He's holding a clipboard."), say("KREZWONK", "I've seen it in a vision. Your next move…"), dir(`The vision: ${st.text}.`), dir("You wake up. It's the most useful dream you've ever had.")];
    if (r < 0.67 && DRONGUS_STATUSES.length) {
      const d = DRONGUS_STATUSES[Math.floor(Math.random() * DRONGUS_STATUSES.length)];
      return [dir(`You dream Drongus is standing at the end of your bed, reading out an old Facebook status of his. From ${d.y}.`), say("DRONGUS", d.t), dir("He waits for a reaction. You wake up before you can give one.")];
    }
    return DREAMS[Math.floor(Math.random() * DREAMS.length)];
  }

  // ------------------------------------------------------------------ furniture

  /** The trophy shelf: a crystal for every boss you've beaten (dark slots for the ones you haven't). */
  private drawShelf(x: number, y: number) {
    if (!this.textures.exists("p_trophyshelf")) return;
    const sh = this.add.image(x, y, "p_trophyshelf").setScale(2).setDepth(5);
    const tints = [0xf472b6, 0x60a5fa, 0xfacc15, 0x34d399, 0xa78bfa, 0xf87171];
    CRYSTAL_BOSSES.forEach((b, i) => {
      const cx = x - sh.displayWidth / 2 + 12 + i * ((sh.displayWidth - 24) / 5);
      const has = hasCrystal(G.s, b);
      const key = this.textures.exists("cum_crystal") ? "cum_crystal" : "__WHITE";
      const c = this.add.image(cx, y - 8, key).setOrigin(0.5, 1).setDepth(6);
      c.setScale(18 / Math.max(1, c.height));
      if (has) {
        c.setTint(tints[i]);
        const glow = this.add.circle(cx, y - 16, 9, tints[i], 0.25).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, alpha: 0.05, yoyo: true, repeat: -1, duration: 900 + i * 120 });
      } else c.setTint(0x111111).setAlpha(0.5);
    });
  }

  /** Whatever you've bought at the Kreddle Exchange's Home Furnishings counter. */
  private drawDecor() {
    const s = G.s;
    const has = (id: string) => (s.upgrades?.[`home_${id}`] ?? 0) > 0;
    const img = (key: string, x: number, y: number, scale: number, depth = y) => (this.textures.exists(key) ? this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth) : null);
    if (has("rug")) img("d_rug", 440, 540, 2.4, 2);
    if (has("neon")) {
      const t = this.add.text(425, 50, "KREZZ", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ff7ad9", stroke: "#ff1fa8", strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
      t.setShadow(0, 0, "#ff4fd8", 18, true, true);
      this.tweens.add({ targets: t, alpha: { from: 1, to: 0.75 }, yoyo: true, repeat: -1, duration: 90, repeatDelay: 2600 });
    }
    // (the fridge is gone: the lava lamp stands on the floor where it was)
    if (has("lava")) img("d_lava", 655, 452, 1.4, 452);
    if (has("fish")) {
      const f = img("d_fish", 425, 340, 1.3, 6);
      if (f) this.spots.push({ x: 425, y: 458, r: 32, label: "E: Look at the fish", use: () => this.talk([dir(DECOR_BY_ID.fish.look)]) });
    }
    if (has("disco")) {
      this.add.rectangle(620, 0, 2, 22, 0x9ca3af).setOrigin(0.5, 0).setDepth(6);
      const ball = this.add.image(620, 20, "d_disco").setOrigin(0.5, 0).setScale(1.2).setDepth(6);
      this.tweens.add({ targets: ball, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 1400, ease: "Sine.inOut" });
      // little lights drifting over the walls
      const cols = [0xff4fd8, 0x67e8f9, 0xfacc15, 0xa78bfa, 0xffffff];
      for (let i = 0; i < 18; i++) {
        const dot = this.add.circle(Phaser.Math.Between(20, 940), Phaser.Math.Between(40, 420), 3, cols[i % cols.length], 0.55).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: dot, x: dot.x + Phaser.Math.Between(-160, 160), y: dot.y + Phaser.Math.Between(-60, 60), alpha: 0.1, yoyo: true, repeat: -1, duration: Phaser.Math.Between(1800, 3400), ease: "Sine.inOut" });
      }
    }
    if (has("plant")) img("d_plant", 36, 538, 1.4);
    if (has("statue")) {
      img("d_statue", 470, 538, 1.4);
      this.spots.push({ x: 470, y: 528, r: 30, label: "E: Admire the Crobley statue", use: () => this.talk([dir(DECOR_BY_ID.statue.look)]) });
    }
    if (has("slot")) {
      img("d_slot", 708, 458, 1.3);
      this.spots.push({ x: 708, y: 466, r: 28, label: "E: Pull the slot machine (a Kroken a day)", use: () => this.homeSlot() });
    }
    if (has("toilet")) {
      img("d_toilet", 918, 536, 1.35);
      this.spots.push({ x: 912, y: 526, r: 34, label: "E: Sit on the solid gold toilet", use: () => this.talk([dir(GOLD_TOILET[Math.floor(Math.random() * GOLD_TOILET.length)])]) });
    }
  }

  private async homeSlot() {
    const s = G.s;
    const today = new Date().toDateString();
    if (s.flags.home_slot_day === today) {
      await this.talk([dir("You pull the lever. A little sign lights up: COME BACK TOMORROW, TAP-LICKER. Even your own slot machine hates you.")]);
      return;
    }
    s.flags.home_slot_day = today;
    const n = Math.random() < 0.15 ? 5 : 1;
    addKrokens(s, n);
    G.save();
    synth.play("ding");
    await this.talk([dir(n > 1 ? "Ding ding ding! Three Crobleys! +5 Krokens!" : "Cherry, lemon, Klerble. +1 Kroken. Come back tomorrow.")]);
  }

  // ------------------------------------------------------------------ panels

  /** A full-screen panel. Returns its container and a close function. */
  private panel(title: string, color = "#ffd23f"): { root: Phaser.GameObjects.Container; close: () => void } {
    this.busy = true;
    this.openPanels++;
    this.prompt.setVisible(false);
    const root = this.add.container(0, 0).setDepth(2500);
    const bg = this.add.rectangle(480, 270, 900, 500, 0x0b0a14, 0.96).setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(color).color);
    bg.setInteractive();
    root.add(bg);
    const art = uiFrame(this, 480, 270, 900, 500, "ui_panel");
    if (art) {
      bg.setStrokeStyle(0);
      root.add(art.setTint(Phaser.Display.Color.HexStringToColor(color).color | 0x606060));
    }
    root.add(this.add.text(480, 48, title, { fontFamily: "Impact, sans-serif", fontSize: "32px", color, stroke: "#000", strokeThickness: 6 }).setOrigin(0.5));
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.openPanels = Math.max(0, this.openPanels - 1);
      this.input.keyboard?.off("keydown-ESC", close);
      root.destroy();
      this.controls.swallow();
      this.time.delayedCall(50, () => {
        if (!this.openPanels) this.busy = false;
      });
    };
    const x = this.add.text(905, 40, "✕", { fontFamily: FONT, fontSize: "24px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 2 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    x.on("pointerdown", close);
    root.add(x);
    root.add(this.add.text(480, 505, "ESC or ✕ to close", { fontFamily: FONT, fontSize: "11px", color: "#64748b" }).setOrigin(0.5));
    this.input.keyboard?.on("keydown-ESC", close);
    return { root, close };
  }

  private button(root: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, label: string, fn: () => void, fill = 0x1e293b, size = 13) {
    const b = this.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, 0x475569).setInteractive({ useHandCursor: true });
    const t = this.add.text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, color: "#ffffff", align: "center", wordWrap: { width: w - 10 } }).setOrigin(0.5);
    b.on("pointerover", () => b.setStrokeStyle(2, 0xfacc15));
    b.on("pointerout", () => b.setStrokeStyle(2, 0x475569));
    b.on("pointerdown", () => {
      synth.play("select");
      fn();
    });
    root.add([b, t]);
    return b;
  }

  /** Cut a text down with an ellipsis until it fits `w` pixels. */
  private fitText(t: Phaser.GameObjects.Text, w: number) {
    let str = t.text;
    while (t.width > w && str.length > 1) {
      str = str.slice(0, -1);
      t.setText(str.trimEnd() + "…");
    }
    return t;
  }

  /**
   * THE GUN RACK: every gun you own, its stats, your gun upgrades, ammo for sale,
   * and the weapon order (drag to reorder, or ▲▼): #1 is what you walk into a dungeon holding,
   * and swapping / running dry goes down the list.
   */
  private gunRackPanel(sel?: string) {
    const s = G.s;
    s.guns = s.guns ?? {};
    const { root, close } = this.panel("THE GUN RACK", "#67e8f9");
    const prevThreshold = this.input.dragDistanceThreshold;
    this.input.dragDistanceThreshold = 8;
    const coinsT = this.add.text(916, 78, "", { fontFamily: FONT, fontSize: "13px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(1, 0.5);
    root.add(coinsT);
    root.add(
      this.add.text(48, 78, "Drag to set your order (or ▲▼). #1 is what you start a dungeon holding; X swaps down the list.", { fontFamily: FONT, fontSize: "12px", color: "#cbd5e1" }).setOrigin(0, 0.5),
    );
    const listC = this.add.container(0, 0);
    const detailC = this.add.container(0, 0);
    root.add([listC, detailC]);
    let selected: string | null = sel ?? null;
    let hover: string | null = null;
    let dragging = false;

    const TOP = 94;
    const LIST_H = 396;
    const L = 48;
    const R = 538;

    const reorder = (id: string, to: number) => {
      moveGun(s, id, to);
      // what you're carrying follows the rack: the top gun that has ammo
      s.gun = firstLoaded(s) ?? undefined;
      G.save();
      synth.play("pickup");
      renderList();
      renderDetail();
    };

    const renderList = () => {
      listC.removeAll(true);
      coinsT.setText(`🪙 ${s.coins} Krezzcoin`);
      const order = orderedGuns(s);
      if (!selected || !order.includes(selected)) selected = order[0] ?? null;
      if (!order.length) {
        listC.add(
          this.add
            .text((L + R) / 2, TOP + 150, "The rack is empty.\n\nGuns turn up in dungeon crates, and the Kreddle Exchange sells a few.\nUntil then: the Fart Blaster. Infinite ammo. Infinite shame.", { fontFamily: FONT, fontSize: "14px", color: "#94a3b8", align: "center", wordWrap: { width: R - L - 20 }, lineSpacing: 4 })
            .setOrigin(0.5),
        );
        return;
      }
      const entries = new Map(weaponList(s).map((w) => [w.id, w] as const));
      const rowH = Phaser.Math.Clamp(Math.floor(LIST_H / order.length), 27, 58);
      const tall = rowH >= 40;
      const marker = this.add.rectangle(L, 0, R - L, 3, 0xfacc15).setOrigin(0, 0.5).setVisible(false);
      order.forEach((id, i) => {
        const g = GUNS[id];
        const w = entries.get(id)!;
        const y0 = TOP + i * rowH;
        const row = this.add.container(0, y0);
        const on = id === selected;
        const bg = this.add.rectangle(L, 0, R - L, rowH - 3, on ? 0x0e3a4a : i % 2 ? 0x111827 : 0x0f172a, 0.95).setOrigin(0, 0).setStrokeStyle(2, on ? 0x67e8f9 : 0x1f2937);
        bg.setInteractive({ useHandCursor: true, draggable: true });
        row.add(bg);
        const mid = (rowH - 3) / 2;
        row.add(this.add.text(L + 6, mid, "⋮⋮", { fontFamily: FONT, fontSize: "14px", color: "#475569" }).setOrigin(0, 0.5));
        row.add(this.add.text(L + 30, mid, `${i + 1}`, { fontFamily: FONT, fontSize: "13px", color: i === 0 ? "#facc15" : "#94a3b8", fontStyle: "bold" }).setOrigin(0.5));
        const ic = weaponIcon(this, L + 66, mid, w, Math.min(rowH - 6, 46));
        if (w.empty) ic.setAlpha(0.35);
        row.add(ic);
        const tx = L + 96;
        const ammo = this.add.text(R - 66, tall ? mid - 9 : mid, w.empty ? "EMPTY" : `${w.ammo}/${w.max}`, { fontFamily: FONT, fontSize: "12px", color: w.empty ? "#ef4444" : "#facc15", fontStyle: "bold" }).setOrigin(1, 0.5);
        row.add(ammo);
        let ammoL = ammo.x - ammo.width;
        if (id === s.gun) {
          const inHand = this.add.text(tall ? R - 66 : ammoL - 6, tall ? mid + 9 : mid, "IN HAND", { fontFamily: FONT, fontSize: "9px", color: "#67e8f9", fontStyle: "bold" }).setOrigin(1, 0.5);
          row.add(inHand);
          if (!tall) ammoL = inHand.x - inHand.width;
        }
        if (tall) {
          // name over a one-line blurb
          row.add(this.fitText(this.add.text(tx, mid - 9, g.name, { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 0.5), ammoL - tx - 8));
          row.add(this.fitText(this.add.text(tx, mid + 9, g.blurb, { fontFamily: FONT, fontSize: "11px", color: "#94a3b8" }).setOrigin(0, 0.5), R - 64 - tx - 4));
        } else {
          // a full rack: name and blurb share one line
          const nm = this.fitText(this.add.text(tx, mid, g.name, { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 0.5), Math.min(170, ammoL - tx - 8));
          row.add(nm);
          const bx0 = tx + nm.width + 8;
          if (ammoL - bx0 - 8 > 30) row.add(this.fitText(this.add.text(bx0, mid + 1, g.blurb, { fontFamily: FONT, fontSize: "11px", color: "#94a3b8" }).setOrigin(0, 0.5), ammoL - bx0 - 8));
        }
        // ▲ / ▼ (keyboard and phone)
        const bh = Math.min(rowH - 7, 30);
        ([[-1, "▲", R - 46], [1, "▼", R - 18]] as const).forEach(([d, label, bx]) => {
          const can = d < 0 ? i > 0 : i < order.length - 1;
          const b = this.add.rectangle(bx, mid, 26, bh, can ? 0x1e293b : 0x111827).setStrokeStyle(1, can ? 0x475569 : 0x1f2937);
          row.add(b);
          row.add(this.add.text(bx, mid, label, { fontFamily: FONT, fontSize: "12px", color: can ? "#e2e8f0" : "#334155" }).setOrigin(0.5));
          if (!can) return;
          b.setInteractive({ useHandCursor: true });
          b.on("pointerover", () => b.setStrokeStyle(1, 0xfacc15));
          b.on("pointerout", () => b.setStrokeStyle(1, 0x475569));
          b.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
            ev.stopPropagation();
            selected = id;
            reorder(id, i + d);
          });
        });
        // hover = peek at its stats, tap/click = select it
        bg.on("pointerover", () => {
          if (dragging) return;
          hover = id;
          renderDetail(false);
        });
        bg.on("pointerout", () => {
          if (dragging || hover !== id) return;
          hover = null;
          renderDetail(false);
        });
        bg.on("pointerdown", () => {
          if (selected === id) return;
          selected = id;
          synth.play("select");
          renderList();
          renderDetail();
        });
        // drag and drop (mouse or finger)
        let target = i;
        bg.on("dragstart", () => {
          dragging = true;
          selected = id;
          listC.bringToTop(row);
          listC.bringToTop(marker);
          row.setAlpha(0.85);
        });
        bg.on("drag", (p: Phaser.Input.Pointer) => {
          row.y = Phaser.Math.Clamp(p.y - rowH / 2, TOP - rowH / 2, TOP + (order.length - 0.5) * rowH);
          target = Phaser.Math.Clamp(Math.round((row.y - TOP) / rowH), 0, order.length - 1);
          marker.setY(TOP + (target > i ? target + 1 : target) * rowH - 2).setVisible(target !== i);
        });
        bg.on("dragend", () => {
          dragging = false;
          hover = null;
          if (target !== i) reorder(id, target);
          else {
            renderList();
            renderDetail();
          }
        });
        listC.add(row);
      });
      listC.add(marker);
      listC.add(this.add.text(L, TOP + order.length * rowH + 2, `${order.length + 1}  💨 Fart Blaster: always last. Infinite ammo.`, { fontFamily: FONT, fontSize: "10px", color: "#64748b" }).setVisible(TOP + order.length * rowH + 14 < 494));
    };

    let shown: string | null | undefined;
    const renderDetail = (force = true) => {
      if (!force && shown === (hover ?? selected)) return;
      shown = hover ?? selected;
      detailC.removeAll(true);
      const X = 554;
      const W = 362;
      const cx = X + W / 2;
      detailC.add(this.add.rectangle(X, TOP, W, LIST_H - 3, 0x0b1220, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0x1e3a4a));
      const perksBtn = () =>
        this.button(detailC, cx, 470, W - 24, 30, "🩸 KREDDLE PERKS & GORE MODE", () => {
          close();
          this.armouryPanel(selected ?? undefined);
        }, 0x27213a, 12);
      const id = hover ?? selected;
      if (!id || !GUNS[id] || !(id in s.guns!)) {
        detailC.add(this.add.text(cx, TOP + 150, "Pick a gun to see its stats.", { fontFamily: FONT, fontSize: "13px", color: "#64748b" }).setOrigin(0.5));
        perksBtn();
        return;
      }
      const g = GUNS[id];
      const w = weaponList(s).find((e) => e.id === id)!;
      const pos = orderedGuns(s).indexOf(id);
      detailC.add(weaponIcon(this, X + 40, TOP + 34, w, 58));
      detailC.add(this.fitText(this.add.text(X + 80, TOP + 12, g.name, { fontFamily: FONT, fontSize: "15px", color: "#ffffff", fontStyle: "bold" }), W - 92));
      detailC.add(
        this.add.text(X + 80, TOP + 33, `${w.empty ? "EMPTY" : `Ammo ${w.ammo}/${w.max}`}  ·  #${pos + 1} in your order${g.kreddle ? "  ·  Kreddle prize" : g.shop ? "  ·  Exchange exclusive" : ""}`, {
          fontFamily: FONT,
          fontSize: "11px",
          color: w.empty ? "#ef4444" : "#facc15",
        }),
      );
      detailC.add(this.add.text(X + 12, TOP + 56, g.blurb, { fontFamily: FONT, fontSize: "11px", color: "#cbd5e1", fontStyle: "italic", wordWrap: { width: W - 24 }, maxLines: 2 } as Phaser.Types.GameObjects.Text.TextStyle));
      // the stats, 1-5 against every gun in the game
      // (with this gun's Kreddle Exchange mods applied)
      const mg = moddedGun(g, s);
      const r = gunRatings(mg);
      const raw: Record<StatKey, string> = {
        damage: mg.pellets > 1 ? `${Math.round(mg.dmg)}×${mg.pellets}` : `${Math.round(mg.dmg)}`,
        rate: `${(1000 / mg.cd).toFixed(1)}/s`,
        range: `${Math.round(mg.range)}`,
        accuracy: mg.spread ? `±${Math.round((mg.spread * 180) / Math.PI)}°` : "dead on",
        special: "",
      };
      const cols: Record<StatKey, number> = { damage: 0xef4444, rate: 0xfacc15, range: 0x38bdf8, accuracy: 0x4ade80, special: 0xc084fc };
      STAT_KEYS.forEach((k, i) => {
        const y = TOP + 100 + i * 20;
        detailC.add(this.add.text(X + 12, y, STAT_LABELS[k], { fontFamily: FONT, fontSize: "11px", color: "#e2e8f0", fontStyle: "bold" }).setOrigin(0, 0.5));
        for (let p = 0; p < 5; p++) detailC.add(this.add.rectangle(X + 100 + p * 30, y, 26, 11, p < r[k] ? cols[k] : 0x1f2937).setStrokeStyle(1, p < r[k] ? 0x000000 : 0x334155));
        if (raw[k]) detailC.add(this.add.text(X + W - 12, y, raw[k], { fontFamily: FONT, fontSize: "10px", color: "#94a3b8" }).setOrigin(1, 0.5));
      });
      detailC.add(this.fitText(this.add.text(X + 12, TOP + 196, specialText(mg), { fontFamily: FONT, fontSize: "11px", color: "#d8b4fe" }), W - 24));
      // this gun's own mods (Kreddle Exchange › GUN MODS)
      const mods = gunModList(s, id);
      const modHave = mods.reduce((a, m) => a + m.lvl, 0);
      const modMaxAll = mods.reduce((a, m) => a + m.max, 0);
      detailC.add(this.add.text(X + 12, TOP + 213, `GUN MODS ${modHave}/${modMaxAll}  (Kreddle Exchange › GUN MODS)`, { fontFamily: FONT, fontSize: "11px", color: "#67e8f9", fontStyle: "bold" }));
      detailC.add(
        this.add.text(X + 12, TOP + 227, modSummary(s, id) || "None yet.", { fontFamily: FONT, fontSize: "10px", color: modHave ? "#5ad35a" : "#64748b", wordWrap: { width: W - 24 }, maxLines: 2 } as Phaser.Types.GameObjects.Text.TextStyle),
      );
      // upgrades that apply to every gun (perks and prizes)
      const up = gunUpgrades(s);
      detailC.add(this.add.text(X + 12, TOP + 254, "ALL GUNS", { fontFamily: FONT, fontSize: "11px", color: "#67e8f9", fontStyle: "bold" }));
      detailC.add(
        this.add.text(X + 12, TOP + 268, up.applied.length ? up.applied.map((a) => `✓ ${a.u.name}${a.u.max > 1 ? ` ${a.lvl}/${a.u.max}` : ""}`).join("   ") : "None yet.", {
          fontFamily: FONT,
          fontSize: "10px",
          color: up.applied.length ? "#5ad35a" : "#64748b",
          wordWrap: { width: W - 24 },
          maxLines: 2,
        } as Phaser.Types.GameObjects.Text.TextStyle),
      );
      if (up.available.length || modHave < modMaxAll) {
        const where = (shop: string) => up.available.filter((u) => u.shop === shop).map((u) => u.name);
        const parts = [modHave < modMaxAll ? "this gun's mods" : "", ...where("Kreddle Exchange"), ...where("Kreddle Prize Counter")].filter(Boolean);
        detailC.add(this.fitText(this.add.text(X + 12, TOP + 296, `⬆ In Kreddle: ${parts.join(", ")}`, { fontFamily: FONT, fontSize: "10px", color: "#ff7ad9", fontStyle: "bold" }), W - 24));
      } else detailC.add(this.add.text(X + 12, TOP + 296, "Every upgrade bought. Fully krezzed.", { fontFamily: FONT, fontSize: "11px", color: "#5ad35a" }));
      // ammo, at the Kreddle Exchange's prices
      const q = ammoQuote(s, id);
      const afford = s.coins >= q.unit;
      const label = q.full ? "AMMO FULL" : s.coins >= q.fill ? `FILL AMMO · ${q.fill}🪙` : afford ? `BUY ${g.pickup} AMMO · ${q.unit}🪙` : `SKINT: AMMO IS ${q.unit}🪙`;
      const bx = X + 12 + 85;
      const ammoBtn = this.button(detailC, bx, 434, 170, 32, label, () => {
        if (q.full || !afford) return;
        if (!buyAmmo(s, id)) return;
        synth.play("coin");
        G.save();
        selected = id;
        renderList();
        renderDetail();
      }, q.full || !afford ? 0x1f2937 : 0x14532d, 12);
      if (q.full || !afford) ammoBtn.setStrokeStyle(2, 0x1f2937).disableInteractive();
      const first = pos === 0;
      const topBtn = this.button(detailC, X + W - 12 - 85, 434, 170, 32, first ? "★ #1: YOU START WITH IT" : "★ MAKE IT #1", () => {
        if (!first) reorder(id, 0);
      }, first ? 0x1f2937 : 0x0e3a4a, 12);
      if (first) topBtn.disableInteractive();
      perksBtn();
    };

    // keyboard: ↑↓ pick, SHIFT+↑↓ (or [ ]) move it, B buys ammo
    const onKey = (ev: KeyboardEvent) => {
      const order = orderedGuns(s);
      if (!order.length) return;
      const i = Math.max(0, order.indexOf(selected ?? ""));
      const up = ev.key === "ArrowUp" || ev.key === "w" || ev.key === "W";
      const down = ev.key === "ArrowDown" || ev.key === "s" || ev.key === "S";
      if ((ev.shiftKey && (up || down)) || ev.key === "[" || ev.key === "]") {
        const d = up || ev.key === "[" ? -1 : 1;
        if (i + d >= 0 && i + d < order.length) reorder(order[i], i + d);
        return;
      }
      if (up || down) {
        selected = order[Phaser.Math.Clamp(i + (up ? -1 : 1), 0, order.length - 1)];
        hover = null;
        synth.play("select");
        renderList();
        renderDetail();
      } else if (ev.key === "b" || ev.key === "B") {
        if (selected && buyAmmo(s, selected)) {
          synth.play("coin");
          G.save();
          renderList();
          renderDetail();
        }
      }
    };
    this.input.keyboard?.on("keydown", onKey);
    root.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.input.keyboard?.off("keydown", onKey);
      this.input.dragDistanceThreshold = prevThreshold;
    });
    root.add(this.add.text(48, 494, "↑↓ pick · SHIFT+↑↓ move · B buy ammo", { fontFamily: FONT, fontSize: "10px", color: "#64748b" }).setOrigin(0, 0.5));
    renderList();
    renderDetail();
  }

  /** Off the gun rack: your Kreddle perks and the gore switch. */
  private armouryPanel(back?: string) {
    const s = G.s;
    const { root, close } = this.panel("PERKS & GORE", "#ff7ad9");
    const perks = PRIZES.filter((p) => p.key && kd(s, p.key) > 0).map((p) => `${p.icon} ${p.name}${(p.max ?? 1) > 1 ? ` ${kd(s, p.key!)}/${p.max}` : ""}`);
    root.add(this.add.text(120, 100, "KREDDLE PERKS", { fontFamily: FONT, fontSize: "15px", color: "#ff7ad9", fontStyle: "bold" }));
    root.add(this.add.text(120, 126, perks.length ? perks.join("     ") : "None yet. Cross the bridge to Kreddle and win some.", { fontFamily: FONT, fontSize: "13px", color: "#e2e8f0", wordWrap: { width: 720 }, lineSpacing: 8 }));
    const on = G.meta.settings.gore !== false;
    this.button(root, 480, 400, 260, 36, `🩸 GORE MODE: ${on ? "ON" : "OFF"}`, () => {
      G.meta.settings.gore = !on;
      G.saveMeta();
      G.save();
      close();
      this.armouryPanel(back);
    }, on ? 0x7f1d1d : 0x27213a, 14);
    this.button(root, 480, 452, 260, 34, "◀ BACK TO THE GUN RACK", () => {
      close();
      this.gunRackPanel(back);
    }, 0x0e3a4a, 13);
  }

  /** The trophy shelf, up close. */
  private trophyPanel() {
    const s = G.s;
    const { root } = this.panel("THE TROPHY SHELF", "#facc15");
    root.add(this.add.text(480, 82, "THE CUM CRYSTALS", { fontFamily: FONT, fontSize: "15px", color: "#facc15", fontStyle: "bold" }).setOrigin(0.5));
    const tints = [0xf472b6, 0x60a5fa, 0xfacc15, 0x34d399, 0xa78bfa, 0xf87171];
    CRYSTAL_BOSSES.forEach((b, i) => {
      const x = 480 + (i - 2.5) * 130;
      const has = hasCrystal(s, b);
      const c = this.add.image(x, 160, this.textures.exists("cum_crystal") ? "cum_crystal" : "__WHITE");
      c.setScale(64 / Math.max(1, c.height));
      if (has) c.setTint(tints[i]);
      else c.setTint(0x111111).setAlpha(0.5);
      root.add(c);
      root.add(this.add.text(x, 205, has ? (b === "krunch" ? "Found in the rubble (nobody knows how)" : BOSS_TEXT[b]?.name ?? b) : "???", { fontFamily: FONT, fontSize: "11px", color: has ? "#ffffff" : "#475569", align: "center", wordWrap: { width: 120 } }).setOrigin(0.5, 0));
    });
    const got = Object.keys(KREL_TROPHIES).filter((b) => s.flags[`krel_${b}`]);
    root.add(this.add.text(480, 270, "KRELTALITY TROPHIES", { fontFamily: FONT, fontSize: "15px", color: "#ef4444", fontStyle: "bold" }).setOrigin(0.5));
    root.add(
      this.add
        .text(480, 298, got.length ? got.map((b) => `🩸 ${KREL_TROPHIES[b]}`).join("\n") : "Nothing yet. When a boss goes down and the screen says FUCKING KILL THEM!!, do it. They leave something behind.", { fontFamily: FONT, fontSize: "13px", color: "#fecaca", align: "center", wordWrap: { width: 760 }, lineSpacing: 6 })
        .setOrigin(0.5, 0),
    );
  }

  /** The games console: everything you've played out in Krelworld. */
  private consolePanel() {
    const s = G.s;
    const { root, close } = this.panel("KREZZSTATION 2", "#a78bfa");
    const games = CONSOLE_GAMES.filter((g) => s.flags[`mg_${g.mode}_played`] || s.flags[`mg_${g.mode}_won`]);
    root.add(this.add.text(480, 82, "Play anything you've played out in Krelworld. A win pays 5 Krokens (once per game, per chapter).", { fontFamily: FONT, fontSize: "13px", color: "#cbd5e1", align: "center", wordWrap: { width: 760 } }).setOrigin(0.5));
    if (!games.length) {
      root.add(this.add.text(480, 260, "No games yet.\nPlay the minigames out in Krelworld and they'll turn up here.", { fontFamily: FONT, fontSize: "16px", color: "#94a3b8", align: "center" }).setOrigin(0.5));
      return;
    }
    games.forEach((g, i) => {
      const x = 480 + ((i % 2) - 0.5) * 380;
      const y = 140 + Math.floor(i / 2) * 50;
      const paid = s.flags[`console_${g.mode}_ch${s.chapter}`];
      this.button(root, x, y, 360, 40, `🎮 ${g.name}${paid ? "" : "   🎟"}`, () => {
        close();
        this.busy = true;
        this.cameras.main.fadeOut(250);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => switchTo(this, "Minigame", { mode: g.mode, console: true }));
      }, 0x2e1065);
    });
  }

  /** The jukebox: every piece of music you've heard, named for where you heard it (SanMik's songs by their titles). */
  private jukeboxPanel(page = 0) {
    const { root, close } = this.panel("THE JUKEBOX", "#ff6fa8");
    const heard = new Set(G.meta.heardMusic ?? []);
    const all = JUKEBOX;
    const got = all.filter((t) => heard.has(t.ids[0])).length;
    root.add(this.add.text(480, 82, `${got} of ${all.length} tunes. Hear new music out in Krelworld and it goes on here.`, { fontFamily: FONT, fontSize: "13px", color: "#cbd5e1" }).setOrigin(0.5));
    // two columns of 13, a page at a time; SanMik & SanChz are at the end under their own heading
    const PER = 26;
    const pages = Math.max(1, Math.ceil(all.length / PER));
    page = Phaser.Math.Clamp(page, 0, pages - 1);
    const slice = all.slice(page * PER, page * PER + PER);
    slice.forEach((t, i) => {
      const col = Math.floor(i / 13);
      const row = i % 13;
      const x = 60 + col * 430;
      const y = 112 + row * 27;
      const has = heard.has(t.ids[0]);
      const label = has ? `${t.sanmik ? "🎤 " : "♪ "}${t.title}` : "? ? ?";
      const playing = synth.currentMusic() && t.ids.includes(synth.currentMusic()!);
      const b = this.add.rectangle(x, y, 410, 24, playing ? 0x4a1d3f : 0x161427, has ? 1 : 0.5).setOrigin(0, 0.5).setStrokeStyle(1, playing ? 0xff6fa8 : 0x2e2a45);
      const tx = this.add.text(x + 10, y, label, { fontFamily: FONT, fontSize: "13px", color: has ? (t.sanmik ? "#ff9ad5" : "#ffffff") : "#4b4560", fontStyle: playing ? "bold" : "normal" }).setOrigin(0, 0.5);
      this.fitText(tx, 390);
      root.add([b, tx]);
      if (!has) return;
      b.setInteractive({ useHandCursor: true });
      b.on("pointerover", () => b.setStrokeStyle(1, 0xffd23f));
      b.on("pointerout", () => b.setStrokeStyle(1, playing ? 0xff6fa8 : 0x2e2a45));
      b.on("pointerdown", () => {
        synth.musicRaw(t.ids[0], true);
        close();
        this.jukeboxPanel(page);
      });
    });
    // now playing
    const cur = synth.currentMusic();
    const nowT = cur ? JUKEBOX.find((t) => t.ids.includes(cur)) : undefined;
    root.add(this.add.text(60, 470, nowT ? `NOW PLAYING: ${nowT.title}  ·  ${nowT.where}` : "", { fontFamily: FONT, fontSize: "13px", color: "#ffd23f" }).setOrigin(0, 0.5));
    if (pages > 1) {
      this.button(root, 640, 470, 70, 30, "◀", () => { close(); this.jukeboxPanel(page - 1); });
      root.add(this.add.text(700, 470, `${page + 1}/${pages}`, { fontFamily: FONT, fontSize: "13px", color: "#cbd5e1" }).setOrigin(0.5));
      this.button(root, 760, 470, 70, 30, "▶", () => { close(); this.jukeboxPanel(page + 1); });
    }
    const pool = all.filter((t) => heard.has(t.ids[0]));
    if (pool.length) {
      this.button(root, 845, 470, 90, 30, "SHUFFLE", () => {
        const t = pool[Math.floor(Math.random() * pool.length)];
        synth.musicRaw(t.ids[0], true);
        close();
        this.jukeboxPanel(page);
      }, 0x4a1d3f);
    }
    this.button(root, 560, 470, 80, 30, "STOP", () => {
      synth.music("home", true);
      close();
      this.jukeboxPanel(page);
    });
  }

  /** The laptop: the group chat. */
  private laptopPanel(justReacted = false) {
    const s = G.s;
    const { root, close } = this.panel("KRELWORLD GROUP CHAT", "#7fb3ff");
    const cleared = [1, 2, 3, 4, 5, 6].filter((n) => s.flags[`ch${n}_clear`]).length;
    const blocks = [0, 1, 2, 3, 4, 5, 6, 7].filter((n) => n <= Math.max(cleared, 0) || (n === 7 && s.chapter >= 7)).slice(-2);
    const msgs: { s: string; t: string }[] = [];
    for (const b of blocks) msgs.push(...(CHAT_AFTER[b] ?? []));
    const st = DRONGUS_STATUSES.length ? DRONGUS_STATUSES[Math.floor(Math.random() * DRONGUS_STATUSES.length)] : null;
    if (st) msgs.push({ s: "DRONGUS", t: `📅 On this day in ${st.y}: "${st.t}"` });
    const n = (s.flags.song_reacts as number) ?? 0;
    if (justReacted) {
      msgs.push({ s: s.player, t: "(reacted to THE KREZZING HOUR)" });
      for (const t of SONG_REPLIES[Math.min(n - 1, SONG_REPLIES.length - 1)] ?? []) msgs.push({ s: "DRONGUS", t });
    }
    // newest at the bottom, only what fits
    let y = 400;
    const shown = msgs.slice(-9).reverse();
    for (const m of shown) {
      const me = m.s === s.player;
      const t = this.add.text(me ? 820 : 140, y, `${CHARACTERS[m.s]?.name ?? m.s}\n${m.t}`, { fontFamily: FONT, fontSize: "12px", color: "#ffffff", backgroundColor: me ? "#1d4ed8" : "#1f2937", padding: { x: 8, y: 5 }, wordWrap: { width: 560 } }).setOrigin(me ? 1 : 0, 1);
      root.add(t);
      y -= t.height + 6;
      if (y < 90) {
        t.destroy();
        break;
      }
    }
    root.add(this.add.text(480, 428, "React to Drongus's song (THE KREZZING HOUR · Seen by 9):", { fontFamily: FONT, fontSize: "12px", color: "#94a3b8" }).setOrigin(0.5));
    ["👍", "❤️", "😂"].forEach((e, i) => {
      this.button(root, 400 + i * 80, 464, 64, 40, e, () => {
        s.flags.song_reacts = n + 1;
        if (n === 0) {
          s.coins += 100;
          G.emit("toast", { title: "DRONGUS IS DELIGHTED", text: "Someone reacted to the song. +100 Krezzcoin." });
        }
        G.save();
        synth.play("ding");
        close();
        this.laptopPanel(true);
      }, 0x1e3a8a, 20);
    });
  }

  private leave() {
    if (this.busy) return;
    if (this.mustWatch()) {
      void this.talk([dir("No, watch some relaxing TV first.")]);
      return;
    }
    if (this.mustWatchBeep()) {
      void this.talk([dir("No. You're having a night in. Watch a relaxing episode of Peep Show first. (The telly, on the left.)")]);
      return;
    }
    if (this.mustWatchCh2()) {
      void this.talk([dir("Not yet. Put the telly on first: watch something on KrelTV. Anything. (The telly, on the left. Once it's on you can skip it.)")]);
      return;
    }
    const s = G.s;
    this.busy = true;
    synth.play("door");
    // the first time out: a look round the whole town
    const flyover = !s.flags.flyover_seen && !s.flags.prologue_done;
    this.cameras.main.fadeOut(350);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => switchTo(this, "Hub", { at: "HOME", flyover }));
  }

  /** A clue on this chapter's explore-before-the-dungeon trail (chapters 2 and 4), glowing somewhere in the room. */
  private placeClue() {
    const c = clueAt(G.s, "HOME");
    const tex = c && clueTex(c.trail, c.i);
    if (!c || !tex || !this.textures.exists(tex)) return;
    const shiny = shinyPickup(this, c.clue.x, c.clue.y - 30, tex, { scale: trailPropScale(this, tex, 56), depth: c.clue.y + 2, tag: `✦ ${c.trail.label.replace(/S$/, "")}`, ...shinyColours(c.trail.tint) });
    const spot: Spot = {
      x: c.clue.x,
      y: c.clue.y,
      r: 56,
      label: `E: Pick up: ${c.trail.item}`,
      use: async () => {
        const r = takeClue(G.s, "HOME");
        shiny.destroy();
        this.spots = this.spots.filter((x) => x !== spot);
        if (!r) return;
        synth.play("pickup");
        G.emit("toast", { title: r.title, text: r.toast });
        G.save();
        await this.talk(r.lines);
      },
    };
    this.spots.push(spot);
  }

  private async talk(lines: Line[]) {
    this.busy = true;
    await this.box.play(lines);
    this.controls.swallow();
    this.busy = false;
  }
}

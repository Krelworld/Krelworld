import { addKrokens } from "../systems/kreddle";
import Phaser from "phaser";
import { playerKey } from "../gfx/sanmikForm";
import type { Line } from "../../data/types";
import { G } from "../G";
import { DialogueBox } from "../ui/DialogueBox";
import { runChain, switchTo, fadeThen } from "../Flow";
import { synth } from "../audio/Synth";
import { FONT, PIXEL_BOLD, button, title } from "../ui/theme";
import { OVER, fall, flap, styledZone, styleGauge, zoneAt, WONK_STYLES, type Flappy } from "../combat/Wonk";
import { VIRAL_CHART } from "../../content/charts/viral";
import { addWrist, type Wrist } from "../gfx/Wrist";
import { dir, gabor, say } from "../../content/dsl";
import { arcStepAt, completeStep, maybeFinishArc } from "../systems/arcs";
import { bump, maxBottles, maxHp } from "../systems/stats";
import { GUNS, gunMax } from "../combat/Guns";
import { animateWalker, backdrop, perfCycle, playPerf } from "../gfx/HD";
import { vfx } from "../gfx/Vfx";
import { chatBeat } from "../gfx/SideCine";
import { CHARACTERS, LADS } from "../../data/characters";
import { TOUCH } from "../ui/TouchControls";

const MIKEY_BARKS = [
  "Mikey here.",
  "Can I just say something",
  "That's not fair lads",
  "I've been working on a new app actually",
  "OW. Okay that one was fair",
  "Is this about the 99 Woodcutting thing",
  "I'm telling Drongus",
  "Fair play. Fair play.",
  "I didn't even say anything in the chat today",
  "Mikey has left the group",
  "Mikey has been added to the group",
  "Lads?",
  "Proctus would never do this to me",
  "Can someone react to my message pls",
];

const PROCTUS_BARKS = [
  "I am only Acting Mikey.",
  "This is outside my job description.",
  "I'm filing a grievance with the Ministry.",
  "Mikey said this would happen.",
  "I have a family. Well, a pigeon.",
  "OW. Professionally, ow.",
];


/** Small arcade minigames. Each sets flags and, if it's the current arc step, completes it. */
export class MinigameScene extends Phaser.Scene {
  private box!: DialogueBox;
  private returnAt = "";
  private mode = "";
  private ended = false;
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super("Minigame");
  }

  /** In-level minigames: what comes next, and where to go back into the dungeon. */
  private chain: string[] = [];
  private resume: { dungeon: string; room: number } | null = null;
  private startData: any = null;

  /** Played on the games console at home: back home after, with a few Krokens for a win. */
  private fromConsole = false;

  create(data: { mode: string; returnAt?: string; chain?: string[]; resume?: { dungeon: string; room: number }; console?: boolean }) {
    this.startData = data;
    this.fromConsole = !!data.console;
    this.chain = data.chain ?? [];
    this.resume = data.resume ?? null;
    this.mode = data.mode;
    this.returnAt = data.returnAt ?? "";
    this.ended = false;
    this.cameras.main.fadeIn(300);
    this.box = new DialogueBox(this, 1000, 0.3);
    this.hud = this.add.text(480, 512, "", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(200);
    const modes: Record<string, () => void> = {
      bully: () => this.bully(),
      deadlift: () => this.deadlift(),
      girlfriends: () => this.girlfriends(),
      renovate: () => this.renovate(),
      runescape: () => this.runescape(),
      burpees: () => this.burpees(),
      facebook: () => this.fbTroll(),
      modulator: () => this.fbTroll("mikey"),
      crocodile: () => this.crocodile(),
      cannon: () => this.cannon(),
      cam2cam: () => this.cam2cam(),
      gig: () => (G.s.player === "KREBON" ? this.gig() : this.gigWatch()),
    };
    (modes[this.mode] ?? (() => this.finish(false)))();
  }

  private mash(cb: () => void) {
    this.input.on("pointerdown", cb);
    this.input.keyboard?.on("keydown-SPACE", cb);
    this.input.keyboard?.on("keydown-E", cb);
  }

  private pop(x: number, y: number, t: string, color = "#ffffff", size = 18) {
    const tx = this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(150);
    this.tweens.add({ targets: tx, y: y - 40, alpha: 0, duration: 900, onComplete: () => tx.destroy() });
  }

  /**
   * Rhythm judgement, Rhythm Heaven style: every hit tells you PERFECT, or whether you were EARLY or LATE, so you
   * can correct on the very next note; the late side of the window is a touch more forgiving than the early side
   * (people hear the beat, then press). `err` is seconds, + = late.
   */
  private static readonly BEAT_WIN = { perfect: 0.06, early: 0.15, late: 0.21 };
  private inWindow(err: number, w = MinigameScene.BEAT_WIN) {
    return err >= -w.early && err <= w.late;
  }
  /** The hit feedback at the target ring: a flash, a ring pulse, and the PERFECT / EARLY / LATE label. */
  private hitFx(x: number, y: number, err: number, col: number, perfectWin = MinigameScene.BEAT_WIN.perfect, depth = 170) {
    const perfect = Math.abs(err) <= perfectWin;
    const flash = this.add.circle(x, y, 23, perfect ? 0xffffff : col, perfect ? 0.95 : 0.6).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.25, duration: 160, onComplete: () => flash.destroy() });
    const ring = this.add.circle(x, y, 24).setStrokeStyle(perfect ? 6 : 4, perfect ? 0xffd23f : col).setDepth(depth);
    this.tweens.add({ targets: ring, scale: perfect ? 2.3 : 1.7, alpha: 0, duration: perfect ? 340 : 240, ease: "Quad.out", onComplete: () => ring.destroy() });
    const [txt, c] = perfect ? ["PERFECT", "#ffd23f"] : err < 0 ? ["◂ EARLY", "#7dd3fc"] : ["LATE ▸", "#fdba74"];
    const t = this.add.text(x, y - 40, txt, { fontFamily: PIXEL_BOLD, fontSize: perfect ? "18px" : "14px", color: c, stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(depth + 1).setScale(perfect ? 0.6 : 0.8);
    this.tweens.add({ targets: t, scale: 1, duration: 110, ease: "Back.out" });
    this.tweens.add({ targets: t, y: y - 62, alpha: 0, delay: 260, duration: 320, onComplete: () => t.destroy() });
    if (perfect) vfx(this, "vfx_sparks", x, y, { scale: 1.1, depth: depth + 1, add: true });
    return perfect;
  }
  /** A note that went by: a grey MISS at the ring. */
  private missFx(x: number, y: number, depth = 170) {
    const t = this.add.text(x, y - 40, "MISS", { fontFamily: PIXEL_BOLD, fontSize: "14px", color: "#9ca3af", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(depth + 1);
    this.tweens.add({ targets: t, y: y - 56, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }

  /** Wrap up: arc bookkeeping, outcome dialogue, back to Krelford. */
  private async finish(success: boolean, extra: Line[] = []) {
    if (this.ended) return;
    this.ended = true;
    this.input.keyboard?.removeAllListeners();
    this.time.removeAllEvents();
    const lines: Line[] = [...extra];
    const c = arcStepAt(G.s, this.returnAt);
    if (c && c.step.step.kind === "minigame" && c.step.step.mode === this.mode) {
      lines.push(...(success ? c.step.step.success : c.step.step.fail));
      if (success) {
        completeStep(G.s, c.arc, c.step);
        const r = maybeFinishArc(G.s);
        if (r) lines.push(dir(r));
      }
    }
    if (success) G.s.flags[`mg_${this.mode}_won`] = true;
    G.s.flags[`mg_${this.mode}_played`] = true;
    if (this.fromConsole) {
      // a win on the console pays out once per game per chapter
      const k = `console_${this.mode}_ch${G.s.chapter}`;
      if (success && !G.s.flags[k]) {
        G.s.flags[k] = true;
        addKrokens(G.s, 5);
        lines.push(dir("🎮 CONSOLE WIN: +5 Krokens. (Each game pays out once a chapter.)"));
      } else lines.push(dir(success ? "🎮 You win. (You've already had this chapter's Krokens for this one.)" : "🎮 GAME OVER. Have another go?"));
      G.save();
      await this.box.play(lines);
      fadeThen(this, 250, () => switchTo(this, "Home", { from: "console" }));
      return;
    }
    G.save();
    if (this.resume) {
      // part of a level: win to carry on, lose to go again
      if (!success) lines.push(dir("Again."));
      await this.box.play(lines);
      fadeThen(this, 250, () => {
        if (!success) return this.scene.restart(this.startData);
        runChain(this, this.chain, this.resume!);
      });
      return;
    }
    await this.box.play(lines);
    fadeThen(this, 250, () => switchTo(this, "Hub", { at: this.returnAt, from: "minigame" }));
  }

  // ---------------------------------------------------------------- BULLY MIKEY

  private bully() {
    const proxy = G.s.player === "MIKEY";
    const target = proxy ? "PROCTUS" : "MIKEY";
    const name = proxy ? "PROCTUS (ACTING MIKEY)" : "MIKEY";
    const barks = proxy ? PROCTUS_BARKS : MIKEY_BARKS;
    if (!backdrop(this, "bg_booth", { dim: 0.15, depth: -10 })) {
      this.add.tileSprite(0, 0, 960, 540, "tile_pub").setOrigin(0);
      this.add.rectangle(480, 470, 960, 140, 0x2a1a0a);
    }
    title(this, 480, 70, `TAKE OUT YOUR FRUSTRATION ON ${name}`, 26, "#ff6b6b");
    this.add.text(480, 100, "Tap / SPACE to vent. The group chat has been a lot this week.", { fontFamily: FONT, fontSize: "14px", color: "#d6d6d6" }).setOrigin(0.5);
    const bag = this.add.sprite(480, 330, `spr_${target}`, 0).setScale(6).setDepth(10);
    const chain = this.add.rectangle(480, 150, 4, 70, 0x888888);
    const meterBg = this.add.rectangle(480, 500, 400, 20, 0x333333).setStrokeStyle(2, 0xffffff);
    const meter = this.add.rectangle(280, 500, 400, 20, 0xff3b30).setOrigin(0, 0.5);
    this.add.text(480, 500, "FRUSTRATION", { fontFamily: FONT, fontSize: "12px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5).setDepth(5);
    void chain;
    void meterBg;
    let frustration = 100;
    let hits = 0;
    const firstTime = !G.s.flags.mg_bully_won;
    const timeLimit = 20;
    const end = this.time.now + timeLimit * 1000;
    this.box.play([dir(proxy ? "Mikey is busy (being you). Proctus has been asked to stand in. Proctus did not agree to this." : "The Booth. Mikey has been strung up as a heavy bag. He seems fine with it. He is never fine with it."), say(target, barks[0])]);
    const swing = () => {
      if (this.ended || this.box.active) return;
      hits++;
      const crit = Math.random() < 0.15;
      frustration = Math.max(0, frustration - (crit ? 9 : 4));
      meter.width = 4 * frustration;
      synth.play(crit ? "crit" : "hit");
      this.tweens.killTweensOf(bag);
      bag.setAngle(0);
      this.tweens.add({ targets: bag, angle: (Math.random() < 0.5 ? -1 : 1) * (crit ? 40 : 18), yoyo: true, duration: 120 });
      bag.setTintFill(0xffffff);
      this.time.delayedCall(60, () => bag.clearTint());
      this.pop(400 + Math.random() * 160, 260 + Math.random() * 60, crit ? "KREZ!" : ["WONK", "POW", "BONK", "SLAP", "ⓘ"][hits % 5], crit ? "#ffd23f" : "#ffffff", crit ? 26 : 18);
      if (hits % 6 === 0) this.pop(480, 200, `"${barks[(hits / 6) % barks.length | 0]}"`, "#9ad1ff", 16);
      if (frustration <= 0) {
        const coins = firstTime ? 60 : 10;
        G.s.coins += coins;
        G.s.flags.bullied_mikey = true;
        bump(G.s, "bully_sessions");
        this.finish(true, [
          dir(`Frustration: gone. Krezzcoin found in ${proxy ? "Proctus's" : "Mikey's"} pockets: ${coins}.`),
          say(target, proxy ? "I'd like it noted that I was only acting." : "Fair play. Fair play. Same time next week?"),
          ...(proxy ? [] : [say("MIKEY", "Can someone react to my message pls")]),
        ]);
      }
    };
    this.mash(swing);
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const left = Math.max(0, Math.ceil((end - this.time.now) / 1000));
        this.hud.setText(`TIME ${left}s   HITS ${hits}`);
        if (left <= 0 && !this.ended) this.finish(false, [dir(`Time. You are still frustrated. ${proxy ? "Proctus" : "Mikey"} looks smug, which somehow makes it worse.`), say(target, barks[barks.length - 1])]);
      },
    });
  }

  // ---------------------------------------------------------------- CAM2CAM (you are SanMik)

  /** SanMik on webcam. Chat her up with lines from the back catalogue, then wonk in sync until you both KREZZ. */
  private cam2cam() {
    const HER = "SexyChanzzz_xx";
    // the two webcam windows
    this.add.rectangle(480, 270, 960, 540, 0x0f0a1e);
    title(this, 480, 20, "CAM2CAM ♥ krelchat.krw", 20, "#f472b6");
    const cam = (x: number, bgKey: string, label: string) => {
      const c = this.add.container(x, 175);
      if (this.textures.exists(bgKey)) {
        const img = this.add.image(0, 0, bgKey);
        img.setScale(Math.max(420 / img.width, 250 / img.height));
        c.add(img);
      } else c.add(this.add.rectangle(0, 0, 420, 250, 0x1e1b4b));
      const m = this.make.graphics({}).fillRect(x - 210, 50, 420, 250);
      c.setMask(m.createGeometryMask());
      this.add.rectangle(x, 175, 424, 254).setStrokeStyle(3, 0xf472b6);
      this.add.text(x - 205, 54, label, { fontFamily: FONT, fontSize: "11px", color: "#fff", backgroundColor: "#00000099", padding: { x: 4, y: 2 } }).setDepth(20);
      const rec = this.add.text(x + 205, 54, "● LIVE", { fontFamily: FONT, fontSize: "11px", color: "#ef4444", backgroundColor: "#00000099", padding: { x: 4, y: 2 } }).setOrigin(1, 0).setDepth(20);
      this.tweens.add({ targets: rec, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });
      return c;
    };
    const leftCam = cam(245, "cam_sanmik", "SanMik_Official (verified rapper)");
    const rightCam = cam(715, "cam_her", `${HER} · 29 · Lewisham`);
    const mik = this.add.image(0, 70, this.textures.exists("spr_SANMIK") ? "spr_SANMIK" : "spr_MIKEY", 0).setScale(4.2).setOrigin(0.5, 1);
    leftCam.add(mik);
    const her = this.textures.exists("p_camgirl") ? this.add.image(0, 125, "p_camgirl").setScale(1.9).setOrigin(0.5, 1) : this.add.image(0, 125, "spr_FOLK1", 0).setScale(4).setOrigin(0.5, 1);
    rightCam.add(her);
    this.tweens.add({ targets: her, y: 121, yoyo: true, repeat: -1, duration: 1400, ease: "Sine.inOut" });
    // interest meter
    let interest = 20;
    const meterBg = this.add.rectangle(715, 316, 300, 12, 0x3b0764).setStrokeStyle(2, 0xf472b6);
    void meterBg;
    const meter = this.add.rectangle(565, 316, 60, 10, 0xf472b6).setOrigin(0, 0.5);
    const meterLbl = this.add.text(560, 316, "♥ INTEREST", { fontFamily: FONT, fontSize: "11px", color: "#f9a8d4" }).setOrigin(1, 0.5);
    void meterLbl;
    const setInterest = (v: number) => {
      interest = Phaser.Math.Clamp(v, 0, 100);
      meter.setSize(3 * interest, 10);
    };
    // the chat log
    this.add.rectangle(480, 430, 900, 190, 0x111827, 0.95).setStrokeStyle(2, 0x6b21a8);
    const log: Phaser.GameObjects.Text[] = [];
    const push = (who: string, text: string, color: string) => {
      for (const l of log) l.y -= 22;
      const t = this.add.text(50, 398, `${who}: ${text}`, { fontFamily: FONT, fontSize: "13px", color, wordWrap: { width: 860 } });
      log.push(t);
      while (log.length > 3) log.shift()?.destroy();
      synth.play("notify");
    };
    const pop = (x: number, t: string) => this.pop(x, 120, t, "#f9a8d4", 22);
    type Opt = [string, number, string];
    const ROUNDS: { her: string; opts: Opt[] }[] = [
      { her: "heyyy 👋 u look familiar", opts: [["yee", 8, "lol. yee to u too 😂"], ["Yee. I'm a famus rapper.", 22, "OMG wait r u actually?? 😳"], ["I remember the day we met. Because I had just bought a pet. It was a hamster, named after you.", 5, "we literally met 10 seconds ago"]] },
      { her: "so what do u do", opts: [["I'm the manager of Norwich. We are even better than Brazil. We would beat them 48-0.", 12, "ok football boy 😏"], ["I rap so hard. I'm the greatest rappers ever. Have you seen the fucking weather?", 15, "lmaooo it IS shit out tbf"], ["Mostly hot tubs.", 6, "...in them or near them?"]] },
      { her: "describe urself in 3 words 😘", opts: [["Solid. No cunt touches me.", 10, "thats more than 3 words but ok 😂"], ["SanMik is so sexy.", 18, "3rd person 😭 weirdly works"], ["Also did I mention that I'm a ninja?", 14, "u did NOT mention that. go on then"]] },
      { her: "whats ur best feature 👀", opts: [["I am also best dressed. Gok Wan is the second best dressed.", 14, "gok wan WISHES"], ["My willy wants your fanny like a hand in glove.", 16, "😳😳 bit forward… keep going"], ["From now on SanMik's your god.", -10, "erm. no."]] },
      { her: "what would u do if u were here rn", opts: [["Wet pizza (in the hot tub). Dreams come true (in the hot tub).", 12, "i dont have a hot tub but i have a bath 👀"], ["Your fanny juice will taste so good. Like fish fingers.", 10, "...fish fingers?? 🐟 weirdly into it"], ["Fifteen cop cars on my tail. Got a helicopter and a tank.", 6, "is that a yes or"]] },
      { her: "ok last chance to impress me 😏", opts: [["Yee. I'm a famus rapper.", 30, "say less 🔥🔥🔥"], ["I'm so famous and you're so pricks.", 6, "we?? there's one of me"], ["Yee I love you.", 20, "babe weve known each other 4 minutes… i love u too 😭"]] },
    ];
    let btns: Phaser.GameObjects.Container[] = [];
    const clearBtns = () => {
      btns.forEach((b) => b.destroy());
      btns = [];
    };
    const round = (i: number) => {
      if (i >= ROUNDS.length) {
        clearBtns();
        if (interest >= 60) this.time.delayedCall(900, () => acapella());
        else {
          push("*", `${HER} has disconnected.`, "#9ca3af");
          this.finish(false, [say("SANMIK", "She's buffering. She's definitely just buffering."), dir("She is not buffering.")]);
        }
        return;
      }
      const R = ROUNDS[i];
      push(HER, "is typing…", "#9ca3af");
      this.time.delayedCall(900, () => {
        log[log.length - 1]?.setText(`${HER}: ${R.her}`).setColor("#f9a8d4");
        synth.play("notify");
        const opts = Phaser.Utils.Array.Shuffle([...R.opts]);
        opts.forEach((o, k) => {
          btns.push(
            button(this, 480, 448 + k * 30, o[0], () => {
              clearBtns();
              push("SanMik_Official", o[0], "#b0c4ff");
              synth.shout("yee", 0.6);
              chatBeat(this, o[0], o[1]);
              this.tweens.add({ targets: mik, y: 64, yoyo: true, duration: 140 });
              this.time.delayedCall(1000, () => {
                push(HER, o[2], "#f9a8d4");
                setInterest(interest + o[1]);
                if (o[1] >= 14) pop(715, "♥♥♥");
                else if (o[1] < 0) pop(715, "🙄");
                this.time.delayedCall(1300, () => round(i + 1));
              });
            }, { w: 860, h: 26, size: 12 }),
          );
        });
      });
    };
    // ----- the acapella: "SanMik Should've Gone Viral", Guitar Hero style
    const swapArt = (img: Phaser.GameObjects.Image, key: string, h: number, bottomY: number) => {
      if (!this.textures.exists(key)) return;
      img.setTexture(key, key.startsWith("spr_") ? 0 : undefined).setOrigin(0.5, 1);
      img.setScale(h / img.height).setY(bottomY);
    };
    const fling = (camX: number, color: number, what: string) => {
      const rag = this.add.rectangle(camX, 190, 40, 26, color).setDepth(45);
      this.tweens.add({ targets: rag, x: camX + (Math.random() < 0.5 ? -260 : 260), y: -40, angle: 720, duration: 900, ease: "Quad.out", onComplete: () => rag.destroy() });
      this.pop(camX, 110, what, "#fde68a", 18);
    };
    const censorBar = (parent: Phaser.GameObjects.Container, x: number, y: number, w: number) => {
      const c = this.add.container(x, y);
      c.add(this.add.rectangle(0, 0, w, 22, 0x000000));
      c.add(this.add.text(0, 0, "CENSORED", { fontFamily: "Impact, sans-serif", fontSize: "13px", color: "#fff" }).setOrigin(0.5));
      parent.add(c);
      c.setScale(0.1);
      this.tweens.add({ targets: c, scale: 1, duration: 250, ease: "Back.out" });
    };
    const acapella = () => {
      push(HER, "wait… will u sing for me? acapella 🎤🥺", "#f9a8d4");
      this.time.delayedCall(1200, () => {
        push("SanMik_Official", "Yee. Stand back.", "#b0c4ff");
        synth.shout("yee", 1);
        this.time.delayedCall(800, () => {
          fling(245, 0x1e3a8a, "*RIPS SHIRT OFF*");
          swapArt(mik, "p_sm_shirtless", 230, 125);
          this.tweens.add({ targets: mik, scaleX: mik.scaleX * 1.04, yoyo: true, repeat: -1, duration: 180 });
          this.time.delayedCall(1100, () => startAcapella());
        });
      });
    };
    const startAcapella = () => {
      for (const l of log) l.setVisible(false);
      // one track, like Do The Crocodile: the move scrolls in, hit the matching direction as it reaches the ring
      const TRACK_Y = 405;
      const LANES = [TRACK_Y, TRACK_Y, TRACK_Y, TRACK_Y];
      const KEYS = ["◀", "▼", "▲", "▶"];
      const COLS = [0x22c55e, 0xef4444, 0xfacc15, 0x60a5fa];
      const HIT_X = 150;
      const LEAD = 2.0;
      const lay = this.add.container(0, 0).setDepth(35);
      lay.add(this.add.rectangle(530, TRACK_Y, 860, 50, 0x000000, 0.55));
      lay.add(this.add.circle(HIT_X, TRACK_Y, 24).setStrokeStyle(4, 0xffd23f));
      // four pads for touch / mouse
      ([["◀ A", 0, 160], ["▼ S", 1, 380], ["▲ W", 2, 600], ["▶ D", 3, 820]] as const).forEach(([lbl, lane, x]) => {
        const pad = this.add.rectangle(x, 498, 200, 50, COLS[lane], 0.35).setStrokeStyle(2, COLS[lane]).setDepth(36).setInteractive();
        lay.add(pad);
        lay.add(this.add.text(x, 498, lbl, { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(37));
        pad.on("pointerdown", () => judge(lane));
      });
      const lyric = this.add.text(530, 350, "🎤 SANMIK SHOULD'VE GONE VIRAL (acapella, live, shirtless)", { fontFamily: FONT, fontSize: "12px", color: "#f9a8d4" }).setOrigin(0.5).setDepth(36);
      const score = this.add.text(900, 350, "", { fontFamily: FONT, fontSize: "12px", color: "#fff" }).setOrigin(1, 0.5).setDepth(36);
      type N = { t: number; lane: number; c: Phaser.GameObjects.Container; done: boolean };
      const notes: N[] = VIRAL_CHART.map(([t, lane]) => {
        const c = this.add.container(-60, TRACK_Y).setDepth(37);
        c.add(this.add.circle(0, 0, 19, COLS[lane]).setStrokeStyle(3, 0xffffff));
        c.add(this.add.text(0, 0, KEYS[lane], { fontFamily: FONT, fontSize: "17px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
        return { t, lane, c, done: false };
      });
      let hits = 0;
      let misses = 0;
      let combo = 0;
      let herStage = 0;
      let hisStage = 0;
      let artifactUntil = 0;
      let over = false;
      // a miss costs more than a hit earns: under about half the notes and her interest runs out before the song does
      const MISS_COST = 0.9;
      let warned = false;
      const t0 = this.time.now;
      synth.music("viral", true);
      const el = synth.musicEl();
      const songT = () => (el && !el.paused ? el.currentTime : (this.time.now - t0) / 1000);
      const HER_YES = ["mmm", "mmm fuck", "🔥🔥", "omg", "sing it 😩", "mmm FUCK", "ur so talented", "viral tbh"];
      const HER_NO = ["😬", "lol", "babe…", "was that a sneeze", "ur voice cracked 😭"];
      // a bum note does something terrible to the audio
      const artifact = () => {
        const now = this.time.now;
        if (now < artifactUntil || !el) return;
        const kind = Math.floor(Math.random() * 4);
        el.preservesPitch = false;
        if (kind === 0) {
          el.playbackRate = 1.75;
          this.pop(245, 100, "*CHIPMUNK*", "#fde047", 16);
          artifactUntil = now + 420;
          this.time.delayedCall(320, () => (el.playbackRate = 1));
        } else if (kind === 1) {
          el.playbackRate = 0.5;
          this.pop(245, 100, "*DEMON VOICE*", "#ef4444", 16);
          artifactUntil = now + 650;
          this.time.delayedCall(450, () => (el.playbackRate = 1));
        } else if (kind === 2) {
          el.currentTime = Math.max(0, el.currentTime - 0.35);
          this.pop(245, 100, "*SKIPS*", "#93c5fd", 16);
          artifactUntil = now + 500;
        } else {
          synth.play("fart");
          el.volume = Math.max(0, el.volume * 0.2);
          const v = el.volume / 0.2;
          this.pop(245, 100, "*VOICE CRACK*", "#a3e635", 16);
          artifactUntil = now + 450;
          this.time.delayedCall(300, () => (el.volume = Math.min(1, v)));
        }
        this.cameras.main.shake(80, 0.004);
      };
      const judge = (lane: number) => {
        if (over || this.box.active) return;
        const st = songT();
        let best: N | null = null;
        for (const n of notes) if (!n.done && this.inWindow(st - n.t) && (!best || Math.abs(n.t - st) < Math.abs(best.t - st))) best = n;
        const ring = this.add.circle(HIT_X, LANES[lane], 22, COLS[lane], 0.6).setDepth(38);
        this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 200, onComplete: () => ring.destroy() });
        if (!best) return;
        best.done = true;
        if (best.lane !== lane) {
          // wrong direction: it counts as a miss
          misses++;
          combo = 0;
          artifact();
          setInterest(interest - MISS_COST);
          this.pop(HIT_X + 40, TRACK_Y - 30, "WRONG WAY", "#ff6b6b", 13);
          best.c.destroy();
          return;
        }
        best.c.destroy();
        hits++;
        combo++;
        const perfect = this.hitFx(HIT_X, TRACK_Y, st - best.t, COLS[lane], undefined, 39);
        // she's watching: clean singing keeps her keen, bum notes cool her off
        setInterest(interest + (perfect ? 0.55 : 0.35));
        this.tweens.add({ targets: mik, angle: { from: -6, to: 6 }, duration: 90, yoyo: true });
        if (hits % 6 === 0) this.pop(715, 120, HER_YES[Math.floor(Math.random() * HER_YES.length)], "#f9a8d4", 20);
        if (combo % 25 === 0) this.pop(245, 120, `${combo} COMBO! YEEEE`, "#fde047", 18);
        stages();
      };
      const stages = () => {
        const n = notes.length;
        if (hisStage === 0 && hits >= n * 0.25) {
          hisStage = 1;
          fling(245, 0x6b7280, "*TRACKIES OFF*");
          swapArt(mik, "p_sm_boxers", 230, 125);
        }
        if (herStage === 0 && hits >= n * 0.35) {
          herStage = 1;
          fling(715, 0xf472b6, "*JUMPER OFF*");
          if (this.textures.exists("p_camgirl_bra")) her.setTexture("p_camgirl_bra");
          this.pop(715, 140, "mmm fuck 😩", "#f9a8d4", 22);
        }
        if (hisStage === 1 && hits >= n * 0.55) {
          hisStage = 2;
          fling(245, 0xd97706, "*BOXERS OFF*");
          censorBar(leftCam, 0, 125 - 230 * 0.32, 76);
        }
        if (herStage === 1 && hits >= n * 0.65) {
          herStage = 2;
          fling(715, 0x111111, "*BRA OFF*");
          censorBar(rightCam, 6, her.y - her.displayHeight * 0.414, 104);
          this.pop(715, 140, "MMMM FUCK", "#f9a8d4", 24);
        }
      };
      const keyMap: Record<string, number> = { A: 0, S: 1, W: 2, D: 3, LEFT: 0, DOWN: 1, UP: 2, RIGHT: 3 };
      const onKey = (e: KeyboardEvent) => {
        const k = e.key.toUpperCase().replace("ARROW", "");
        if (k in keyMap) judge(keyMap[k]);
      };
      this.input.keyboard?.addCapture("UP,DOWN,LEFT,RIGHT");
      this.input.keyboard?.on("keydown", onKey);
      const onTap = () => undefined;
      this.input.on("pointerdown", onTap);
      const tick = this.time.addEvent({ delay: 16, loop: true, callback: () => {
        if (over) return;
        const st = songT();
        for (const n of notes) {
          if (n.done) continue;
          const x = HIT_X + ((n.t - st) / LEAD) * 780;
          n.c.setX(x).setVisible(x < 950);
          if (st - n.t > MinigameScene.BEAT_WIN.late) {
            n.done = true;
            this.tweens.add({ targets: n.c, alpha: 0, y: n.c.y + 10, duration: 200, onComplete: () => n.c.destroy() });
            misses++;
            combo = 0;
            artifact();
            this.missFx(HIT_X, TRACK_Y, 39);
            setInterest(interest - MISS_COST);
            if (misses % 5 === 0) this.pop(715, 120, HER_NO[Math.floor(Math.random() * HER_NO.length)], "#9ca3af", 18);
          }
        }
        // she's had enough: logs off mid-song
        if (interest <= 0) return walkOut();
        // the meter tells you how it's going
        meter.setFillStyle(interest < 25 ? 0xef4444 : interest < 45 ? 0xfacc15 : 0xf472b6);
        if (interest < 25 && !warned) {
          warned = true;
          this.pop(715, 150, Phaser.Utils.Array.GetRandom(["babe… 😬", "is ur mic ok", "hmm.", "im getting bored ngl"]), "#fca5a5", 20);
        } else if (interest > 40) warned = false;
        const total = hits + misses;
        score.setText(`HITS ${hits}  MISSES ${misses}  ${total ? Math.round((hits / total) * 100) : 100}%`);
        this.hud.setText(`${Math.max(0, Math.ceil(80 - st))}s`);
        if (st >= 80.6 || (el && el.ended) || notes.every((nn) => nn.done)) finishSong();
      } });
      const walkOut = () => {
        if (over) return;
        over = true;
        tick.remove();
        this.input.keyboard?.off("keydown", onKey);
        this.input.off("pointerdown", onTap);
        if (el) el.playbackRate = 1;
        synth.stopMusic();
        synth.play("trombone");
        lay.destroy(true);
        lyric.destroy();
        score.destroy();
        notes.forEach((n) => n.c.active && n.c.destroy());
        for (const l of log) l.setVisible(true);
        push(HER, "ok im gonna go. good luck w the rapping x", "#f9a8d4");
        this.time.delayedCall(900, () => push("*", `${HER} has disconnected.`, "#9ca3af"));
        this.time.delayedCall(1800, () => this.finish(false, [say("SANMIK", "She's buffering. Mid-song. Krelchat's dead lag."), dir(`She is not buffering. ${hits} notes hit, ${misses} missed.`)]));
      };
      const finishSong = () => {
        if (over) return;
        over = true;
        tick.remove();
        this.input.keyboard?.off("keydown", onKey);
        this.input.off("pointerdown", onTap);
        if (el) el.playbackRate = 1;
        synth.stopMusic();
        lay.destroy(true);
        lyric.destroy();
        score.destroy();
        notes.forEach((n) => n.c.active && n.c.destroy());
        for (const l of log) l.setVisible(true);
        const acc = hits / Math.max(1, hits + misses);
        // whatever happened, everyone's ended up in their pants (or less)
        while (hisStage < 2 || herStage < 2) {
          hits = Math.max(hits, notes.length);
          stages();
        }
        push(HER, acc > 0.7 ? "that was… the best thing ive ever heard 😩 mmm fuck" : acc > 0.4 ? "ur voice cracked like 40 times. weirdly into it" : "babe that was a war crime. but ur fit so", "#f9a8d4");
        this.time.delayedCall(1600, () => wonk());
      };
    };
    // ----- the wonk
    let wrists: Wrist[] = [];
    const wonk = () => {
      push(HER, "ok ur actually so fit. wanna… 👀", "#f9a8d4");
      this.time.delayedCall(1100, () => {
        push("SanMik_Official", "YEEEEEEE", "#b0c4ff");
        synth.shout("yee", 1);
        this.time.delayedCall(900, () => startWonk());
      });
    };
    const startWonk = () => {
      // both cameras: CENSORED, with a wrist going under each bar
      const wristL = addWrist(this, 232, 194, { skin: 0x8d5524, scale: 2.2, speed: 120 });
      const wristR = addWrist(this, 704, 194, { skin: 0xd9a27f, scale: 2, speed: 130, flip: true });
      wristL.obj.setDepth(29);
      wristR.obj.setDepth(29);
      wrists = [wristL, wristR];
      const bars = [245, 715].map((x) => {
        const c = this.add.container(x, 200).setDepth(30);
        c.add(this.add.rectangle(0, 0, 220, 70, 0x000000));
        c.add(this.add.text(0, 0, "CENSORED", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#fff" }).setOrigin(0.5));
        return c;
      });
      const lblL = this.add.text(245, 248, "*wonk wonk wonk*", { fontFamily: FONT, fontSize: "14px", color: "#b0c4ff", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(31);
      const lblR = this.add.text(715, 248, "*female wonk*", { fontFamily: FONT, fontSize: "14px", color: "#f9a8d4", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(31);
      // the gauge, between the cams
      const GX = 480;
      const GT = 70;
      const GH = 240;
      this.add.rectangle(GX, GT + GH / 2, 30, GH + 6, 0x000000).setStrokeStyle(2, 0xffffff).setDepth(40);
      // this wonk's style: the gentle one if it's your first ever, otherwise a slippery zone that slides about
      const nth = (G.s.flags.wonk_count as number | undefined) ?? 0;
      G.s.flags.wonk_count = nth + 1;
      const style = nth === 0 ? WONK_STYLES.gentle : WONK_STYLES.drift;
      const zone0 = styledZone(style);
      let zone = zone0;
      const wonkT0 = this.time.now;
      // how into it she is (from the chat and the song) sets how fast she gets there
      const keen = 0.6 + (interest / 100) * 0.8;
      this.add.text(GX, GT + GH + 22, interest >= 70 ? "♥ she's well into it" : interest >= 40 ? "♥ she's into it" : "♥ she's… here", { fontFamily: FONT, fontSize: "12px", color: "#f9a8d4", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(42);
      if (style.name) this.add.text(GX, GT - 30, style.name.split(" · ")[0], { fontFamily: FONT, fontSize: "12px", color: "#fde68a", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(42);
      const zoneR = this.add.rectangle(GX, 0, 26, 10, 0x22c55e, 0.6).setDepth(41);
      const placeZone = () => zoneR.setPosition(GX, GT + GH * (1 - (zone.lo + zone.hi) / 2)).setSize(26, GH * (zone.hi - zone.lo));
      placeZone();
      const fill = this.add.rectangle(GX, GT + GH, 22, 0, 0xffd23f).setOrigin(0.5, 1).setDepth(42);
      this.add.text(GX, GT - 14, "KREZZ ZONE", { fontFamily: FONT, fontSize: "10px", color: "#86efac" }).setOrigin(0.5).setDepth(42);
      const g: Flappy = styleGauge({ gauge: 0.1, vel: 0 }, style);
      let mine = 0;
      let hers = 0;
      let left = 30;
      let done = false;
      this.add.rectangle(245, 288, 204, 14, 0x000000, 0.7).setDepth(41);
      const barMe = this.add.rectangle(145, 288, 0, 10, 0x60a5fa).setOrigin(0, 0.5).setDepth(42);
      this.add.rectangle(715, 288, 204, 14, 0x000000, 0.7).setDepth(41);
      const barHer = this.add.rectangle(615, 288, 0, 10, 0xf472b6).setOrigin(0, 0.5).setDepth(42);
      this.add.text(245, 272, "SANMIK →  KREZZ", { fontFamily: FONT, fontSize: "10px", color: "#b0c4ff" }).setOrigin(0.5).setDepth(42);
      this.add.text(715, 272, "CHANZ →  FEMALE KREZZ", { fontFamily: FONT, fontSize: "10px", color: "#f9a8d4" }).setOrigin(0.5).setDepth(42);
      push("*", "TAP / SPACE to wonk. Keep the gauge in the KREZZ ZONE. You both need to get there.", "#86efac");
      const tap = () => {
        if (done) return;
        flap(g);
        wrists[0]?.kick();
        synth.play(Math.random() < 0.5 ? "slurp" : "select");
      };
      this.mash(tap);
      const moans = ["*wonk*", "yee", "YEE", "uhh yee", "mm fuck yes"];
      const herMoans = ["mmm", "SanMik 😩", "dont stop", "*female wonk*", "famus rapper 😩"];
      const timer = this.time.addEvent({ delay: 1000, loop: true, callback: () => {
        if (done) return;
        if (--left <= 0) {
          done = true;
          push(HER, "omg u took too long… im off 😴", "#f9a8d4");
          this.finish(false, [say("SANMIK", "Lag. That was lag. Krelchat lag.")]);
        }
      } });
      const tick = this.time.addEvent({ delay: 16, loop: true, callback: () => {
        if (done) return;
        fall(g, 16);
        fill.setSize(22, GH * g.gauge);
        const inZone = g.gauge >= zone.lo && g.gauge <= zone.hi;
        wrists[1]?.setSpeed(inZone ? 70 : 130);
        fill.setFillStyle(inZone ? 0x22c55e : g.gauge > OVER ? 0xef4444 : 0xffd23f);
        if (inZone) {
          mine += 16 / 90;
          hers += (16 / (80 + Math.random() * 40)) * keen;
          if (Math.random() < 0.02) this.pop(245, 230, moans[Math.floor(Math.random() * moans.length)], "#b0c4ff", 14);
          if (Math.random() < 0.02) this.pop(715, 230, herMoans[Math.floor(Math.random() * herMoans.length)], "#f9a8d4", 14);
        } else if (g.gauge > OVER) {
          mine = Math.max(0, mine - 0.4);
          if (Math.random() < 0.05) this.pop(245, 230, "TOO MUCH", "#ef4444", 14);
        }
        barMe.setSize(Math.min(200, mine * 2), 10);
        barHer.setSize(Math.min(200, hers * 2), 10);
        bars.forEach((b, k) => b.setPosition([245, 715][k] + (inZone ? Math.sin(this.time.now / 40 + k) * 6 : 0), 200 + (inZone ? Math.cos(this.time.now / 55 + k) * 4 : 0)));
        // the zone slides about (smoothly, so you can follow it), to keep you honest
        if (style.drift) {
          zone = zoneAt(zone0, style, this.time.now - wonkT0);
          placeZone();
        }
        this.hud.setText(`${left}s`);
        if (mine >= 100 && hers >= 100) {
          done = true;
          timer.remove();
          tick.remove();
          krezz(bars, lblL, lblR);
        } else if (mine >= 100) hers += 0.3; // she's nearly there
        else if (hers >= 100) mine += 0.3;
      } });
    };
    const krezz = async (bars: Phaser.GameObjects.Container[], lblL: Phaser.GameObjects.Text, lblR: Phaser.GameObjects.Text) => {
      lblL.destroy();
      lblR.destroy();
      wrists.forEach((w) => w.destroy());
      synth.play("boom");
      synth.shout("yee", 1);
      // a whole avalanche of YEEs, overlapping, with little YEE!s flying across the screen
      for (let i = 1; i < 22; i++) {
        this.time.delayedCall(i * (90 + Math.random() * 110), () => {
          synth.shout("yee", 0.55 + Math.random() * 0.45);
          const y = this.add.text(80 + Math.random() * 800, 80 + Math.random() * 360, ["YEE!", "YEEE!", "YEEEEE!", "yee", "YEE YEE!"][Math.floor(Math.random() * 5)], { fontFamily: "Impact, sans-serif", fontSize: `${18 + Math.floor(Math.random() * 26)}px`, color: "#b0c4ff", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(58).setAngle((Math.random() - 0.5) * 40);
          this.tweens.add({ targets: y, y: y.y - 60, alpha: 0, scale: 1.4, duration: 900, onComplete: () => y.destroy() });
        });
      }
      this.cameras.main.flash(500, 255, 255, 255);
      this.cameras.main.shake(500, 0.02);
      const big = (x: number, t: string, c: string) => {
        const tx = this.add.text(x, 160, t, { fontFamily: "Impact, sans-serif", fontSize: "52px", color: c, stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setDepth(60).setScale(0.2);
        this.tweens.add({ targets: tx, scale: 1, angle: { from: -10, to: 10 }, duration: 400, ease: "Back.out" });
      };
      big(245, "KREZZ!!", "#ffffff");
      this.time.delayedCall(350, () => big(715, "FEMALE KREZZ!!", "#f9a8d4"));
      bars.forEach((b, k) => this.tweens.add({ targets: b, y: -100, angle: k ? 40 : -40, duration: 900, ease: "Quad.in" }));
      for (let i = 0; i < 40; i++) {
        const c = this.add.text(Math.random() * 960, -20, ["💦", "✨", "💖", "🎉"][i % 4], { fontSize: "22px" }).setDepth(55);
        this.tweens.add({ targets: c, y: 560, angle: 360, duration: 1500 + Math.random() * 1500, delay: i * 40 });
      }
      await new Promise<void>((r) => this.time.delayedCall(1500, () => r()));
      this.finish(true, [
        say(HER, "SanMik you're so sexy. Sexy. Sex me."),
        say("SANMIK", "Yee. I know that. The girls know that. We all know that."),
        say(HER, "same time tmrw? 😘"),
        say("SANMIK", "Can't babe. Got to save Catford. I'm a famus rapper."),
        dir(`${HER} has logged off. She has left a five-star review on Krelchat: 'genuinely a famous rapper apparently. 10/10 would krezz again'.`),
        say("SANCHZ", "(from the doorway, where he has been the whole time) YEGHHH."),
        say("SANMIK", "SANCHZ. HOW LONG HAVE YOU BEEN THERE."),
      ]);
    };
    this.box
      .play([
        dir("Begour's café caravan has Wi-Fi. SanMik has borrowed the laptop. He is wearing his best afro and a small amount of aftershave on his eyebrows. He's logging into CAM2CAM.", { variants: { MIKEY: "Begour's café caravan has Wi-Fi. You have borrowed the laptop. You are wearing your best afro and a small amount of aftershave on your eyebrows. You're logging into CAM2CAM." } }),
        say("SANMIK", "Yee. Give me five minutes, lads. I'm gonna cam2cam wiv some fuckin SLUT!!! Heh hehe heh am a norty boy…gonna get me willy out", { cond: { notPlayer: "MIKEY" } }),
        dir("YOU ARE SANMIK. Pick your chat-up lines. Get her interest up to the line (60%). Then… well. You'll see."),
      ])
      .then(() => round(0));
  }

  // ---------------------------------------------------------------- DEADLIFT

  /** Mash to lift 300kg. (Krezwonk needs the HGH arc done to get the full boost.) */
  private deadlift() {
    if (!backdrop(this, "bg_gym", { dim: 0.2, depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_industrial").setOrigin(0);
    title(this, 480, 70, "DEADLIFT: 300KG (RECORD: 280)", 28);
    this.add.text(480, 102, "Mash Tap / SPACE. Don't stop. The HGH is doing most of the work.", { fontFamily: FONT, fontSize: "14px", color: "#d6d6d6" }).setOrigin(0.5);
    const lifter = this.add.sprite(480, 380, playerKey(this), 0).setScale(5).setDepth(10);
    const bar = this.add.image(480, 420, "p_barbell").setScale(3.2).setDepth(11);
    const prog = this.add.rectangle(140, 480, 0, 22, 0x22c55e).setOrigin(0, 0.5).setDepth(5);
    this.add.rectangle(480, 480, 680, 22).setStrokeStyle(2, 0xffffff).setDepth(6);
    let p = 0;
    // Jenko's lift (taking back the platform from 'Stacy') is the gentler one: more time, bigger pulls, slower slip
    const easy = G.s.player === "FLENKY";
    const end = this.time.now + (easy ? 15000 : 12000);
    const juiced = !!G.s.flags.arcstep_arc_krezwonk_hgh || G.s.player !== "KREZWONK";
    this.mash(() => {
      if (this.ended) return;
      p = Math.min(100, p + (easy ? 4.4 : juiced ? 3.2 : 1.6));
      synth.play("swing");
      if (Math.random() < 0.15) this.pop(480 + (Math.random() - 0.5) * 300, 200, ["GRRR", "LIGHT WEIGHT", "SO WHAT CAN WE SAY", "HGH GO BRRR", "VEINS"][Math.floor(Math.random() * 5)], "#ffd23f");
    });
    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (this.ended) return;
        if (p < 100) p = Math.max(0, p - (easy ? 0.15 : 0.25));
        prog.width = 6.8 * p;
        bar.y = 420 - p * 1.6;
        lifter.setFrame(p > 50 ? 3 : 0);
        const left = Math.max(0, (end - this.time.now) / 1000);
        this.hud.setText(`${Math.round(p * 3)}KG / 300KG    ${left.toFixed(1)}s`);
        if (p >= 100) {
          synth.play("cheer");
          this.cameras.main.shake(400, 0.02);
          title(this, 480, 240, "NEW RECORD", 44, "#22c55e").setDepth(200);
          this.finish(true);
        } else if (left <= 0) {
          synth.play("tap_fail");
          this.finish(false, [dir("The bar does not move. The bar has never respected you.")]);
        }
      },
    });
  }

  // ---------------------------------------------------------------- GIRLFRIENDS

  private girlfriends() {
    if (!backdrop(this, "bg_flat", { dim: 0.6, depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x1f1b2e);
    title(this, 480, 50, "THE ROTA", 32);
    this.add.text(480, 84, "Answer the RIGHT phone before it rings out. Don't send the wrong text to the wrong girlfriend.", { fontFamily: FONT, fontSize: "14px", color: "#d6d6d6" }).setOrigin(0.5);
    const girls = ["KRELISSA", "KREZABETH", "KAYLOR"];
    const colors = [0xff6b9a, 0x7ac7ff, 0xffd23f];
    const msgs = [
      "u up?",
      "who's Krezabeth??",
      "my mum wants to meet you",
      "why is there a girl's hair tie in your car",
      "are we exclusive",
      "you said you were at the gym",
      "send a pic of the gym then",
      "it's our anniversary",
      "who is KAYLOR in your phone",
      "babe?",
      "why did you call me Krelissa",
      "I'm outside",
    ];
    let score = 0;
    let strikes = 0;
    let active = -1;
    let deadline = 0;
    const need = 12;
    const phones = girls.map((g, i) => {
      const x = 220 + i * 260;
      const c = this.add.container(x, 300);
      const art = this.textures.exists("mg_phone");
      // a real phone (PixelLab) in a case of her colour; the screen shows through it. Rectangles if the art's missing.
      const glow = this.add.rectangle(0, 0, 168, 268, colors[i], 0).setStrokeStyle(0);
      const body = art ? this.add.rectangle(0, 0, 138, 246, colors[i]).setStrokeStyle(3, 0x000000, 0.6) : this.add.rectangle(0, 0, 150, 240, 0x111111).setStrokeStyle(4, colors[i]);
      const scr = art ? this.add.rectangle(-1, -2, 106, 176, 0x1c1c28) : this.add.rectangle(0, -10, 130, 180, 0x2a2a3a);
      const phone = art ? this.add.image(0, 0, "mg_phone").setScale(1.75) : null;
      const nm = this.add.text(0, art ? -142 : -110, g, { fontFamily: PIXEL_BOLD, fontSize: "16px", color: Phaser.Display.Color.IntegerToColor(colors[i]).rgba, stroke: "#000", strokeThickness: 4 }).setOrigin(0.5);
      const txt = this.add.text(0, art ? -34 : -10, "", { fontFamily: FONT, fontSize: "14px", color: "#fff", fontStyle: "bold", align: "center", wordWrap: { width: art ? 100 : 120 } }).setOrigin(0.5);
      // how long till it rings out
      const timer = this.add.rectangle(-50, art ? -76 : -96, 100, 5, 0xffffff).setOrigin(0, 0.5).setVisible(false);
      c.add([glow, body, scr, ...(phone ? [phone] : []), nm, txt, timer]);
      body.setInteractive({ useHandCursor: true }).on("pointerdown", () => answer(i));
      this.add.text(x, art ? 448 : 440, `[${i + 1}]`, { fontFamily: FONT, fontSize: "14px", color: "#aaa" }).setOrigin(0.5);
      return { c, scr, txt, glow, timer, x };
    });
    const ring = () => {
      if (this.ended) return;
      phones.forEach((p) => {
        p.scr.setFillStyle(0x1c1c28);
        p.txt.setText("");
        p.glow.setFillStyle(colors[0], 0);
        p.timer.setVisible(false);
        this.tweens.killTweensOf(p.c);
        p.c.setAngle(0).setX(p.x);
      });
      active = Phaser.Math.Between(0, 2);
      const window = Math.max(900, 2200 - score * 100);
      deadline = this.time.now + window;
      const ph = phones[active];
      ph.scr.setFillStyle(Phaser.Display.Color.ValueToColor(colors[active]).darken(35).color);
      ph.txt.setText(msgs[Phaser.Math.Between(0, msgs.length - 1)]);
      ph.glow.setFillStyle(colors[active], 0.35);
      ph.timer.setVisible(true).setFillStyle(colors[active]);
      // the buzz: a wobble and a side-to-side rattle until you answer it
      this.tweens.add({ targets: ph.c, angle: { from: -5, to: 5 }, yoyo: true, repeat: -1, duration: 55 });
      this.tweens.add({ targets: ph.c, x: ph.x + 4, yoyo: true, repeat: -1, duration: 35 });
      this.tweens.add({ targets: ph.c, scale: { from: 1.06, to: 1 }, duration: 160, ease: "Back.out" });
      synth.play("notify");
    };
    const still = () =>
      phones.forEach((p) => {
        this.tweens.killTweensOf(p.c);
        p.c.setAngle(0).setX(p.x).setScale(1);
        p.glow.setFillStyle(colors[0], 0);
        p.timer.setVisible(false);
      });
    const strike = (why: string) => {
      strikes++;
      still();
      synth.play("hurt");
      this.cameras.main.shake(200, 0.01);
      this.pop(480, 160, why, "#ff6b6b", 22);
      if (strikes >= 3) {
        this.finish(false, [dir("All three of them are now in a group chat together. It is called 'KREZWONK EXPOSED'. It has 4,000 messages. You have been added to it.")]);
      } else this.time.delayedCall(500, ring);
    };
    const answer = (i: number) => {
      if (this.ended || active < 0) return;
      if (i !== active) {
        active = -1;
        return strike(`Sent "${girls[i]} you're the only one" to ${girls[(i + 1) % 3]}`);
      }
      active = -1;
      still();
      score++;
      synth.play("ding");
      this.pop(phones[i].c.x, 160, ["sent ❤", "'at the gym x'", "'miss u'", "'no she's my cousin'"][score % 4], "#7CFC9A");
      if (score >= need) {
        title(this, 480, 240, "NOBODY FOUND OUT", 40, "#22c55e").setDepth(200);
        this.finish(true);
      } else this.time.delayedCall(350, ring);
    };
    this.input.keyboard?.on("keydown-ONE", () => answer(0));
    this.input.keyboard?.on("keydown-TWO", () => answer(1));
    this.input.keyboard?.on("keydown-THREE", () => answer(2));
    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        this.hud.setText(`KEPT SECRET ${score}/${need}    STRIKES ${"✕".repeat(strikes)}`);
        if (active >= 0) {
          phones[active].timer.setSize(100 * Math.max(0, (deadline - this.time.now) / Math.max(900, 2200 - score * 100)), 5);
        }
        if (active >= 0 && this.time.now > deadline) {
          active = -1;
          strike("Left on read. She's suspicious.");
        }
      },
    });
    this.time.delayedCall(800, ring);
  }

  // ---------------------------------------------------------------- RENOVATE

  /**
   * Flip a house. Problems pop up and ROT if you leave them (the value drops), fixes chained quickly build a
   * multiplier, and it speeds up twice, WarioWare-style. Add £1.5m to the asking price in 45 seconds.
   */
  private renovate() {
    if (!backdrop(this, "bg_fixer", { dim: 0.15, depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_mansion").setOrigin(0);
    title(this, 480, 44, "FLIP IT: ADD £1,500,000 IN 45 SECONDS", 26);
    this.add.text(480, 74, "Click problems before they ROT. Fix them quickly in a row for a multiplier.", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5);
    const kinds = [
      { t: "DAMP", c: 0x4a6a4a },
      { t: "HOLE", c: 0x111111 },
      { t: "CARPET", c: 0x7a1f2b },
      { t: "MOULD", c: 0x2f4f2f },
      { t: "CHEESE", c: 0xffd23f },
      { t: "CRACK", c: 0x6b5b4b },
      { t: "WIRING", c: 0xd97706 },
    ];
    const TARGET = 1_500_000;
    const FIX = 40_000;
    const ROT = 60_000;
    const LEN = 45000;
    let value = 0;
    let fixed = 0;
    let rotted = 0;
    let mult = 1;
    let lastFix = -9999;
    let golden = 0;
    const t0 = this.time.now;
    const end = t0 + LEN;
    // the pace: three phases, each faster, and the problems rot quicker as it goes
    const phase = () => Math.min(2, Math.floor((this.time.now - t0) / 15000));
    const spawnEvery = () => [850, 620, 430][phase()];
    const lifeMs = () => [5200, 4000, 3000][phase()];
    const fmt = (n: number) => `£${Math.round(n / 1000).toLocaleString()}k`;
    type Prob = { r: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; t: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Graphics; born: number; life: number; gold: boolean; dead: boolean };
    const probs: Prob[] = [];
    const remove = (p: Prob) => {
      p.dead = true;
      p.r.destroy();
      p.t.destroy();
      p.ring.destroy();
    };
    const spawn = () => {
      if (this.ended) return;
      // don't stack them on top of each other
      let x = 0;
      let y = 0;
      for (let k = 0; k < 8; k++) {
        x = Phaser.Math.Between(90, 870);
        y = Phaser.Math.Between(130, 470);
        if (probs.every((p) => p.dead || Math.abs(p.r.x - x) > 90 || Math.abs(p.r.y - y) > 70)) break;
      }
      // now and then a golden one: an original feature. Worth five fixes.
      const gold = Math.random() < 0.07;
      const k = gold ? { t: "ORIGINAL FEATURE", c: 0xfacc15 } : kinds[Phaser.Math.Between(0, kinds.length - 1)];
      const art = gold ? "r_cheese" : `r_${k.t.toLowerCase()}`;
      const hasArt = this.textures.exists(art);
      const r = hasArt ? this.add.image(x, y, art).setDepth(10) : this.add.rectangle(x, y, 70, 46, k.c).setStrokeStyle(2, 0xffffff).setDepth(10);
      if (gold && r instanceof Phaser.GameObjects.Image) r.setTint(0xffe066);
      const t = this.add.text(x, y + (hasArt ? 28 : 0), k.t, { fontFamily: FONT, fontSize: "12px", color: gold ? "#ffd23f" : "#fff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(11);
      const ring = this.add.graphics().setDepth(12);
      const p: Prob = { r, t, ring, born: this.time.now, life: gold ? 2200 : lifeMs(), gold, dead: false };
      probs.push(p);
      r.setScale(0);
      this.tweens.add({ targets: r, scale: 1, duration: 150, ease: "Back.out" });
      if (gold) synth.play("transform_sparkle");
      r.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        if (this.ended || p.dead) return;
        const now = this.time.now;
        // chain fixes within 0.9s of each other and the multiplier climbs (to x3)
        mult = now - lastFix < 900 ? Math.min(3, mult + 1) : 1;
        lastFix = now;
        const gain = FIX * mult * (gold ? 5 : 1);
        value += gain;
        fixed++;
        if (gold) golden++;
        synth.play(gold ? "jackpot" : mult >= 3 ? "perfect" : "coin");
        this.pop(x, y - 10, `+${fmt(gain)}${mult > 1 ? `  x${mult}` : ""}`, gold ? "#ffd23f" : mult > 1 ? "#facc15" : "#7CFC9A", gold || mult > 2 ? 22 : 18);
        if (gold) vfx(this, "vfx_coins", x, y, { scale: 1.6, depth: 30 });
        else if (mult >= 3) vfx(this, "vfx_sparks", x, y, { scale: 1.2, depth: 30, add: true });
        remove(p);
        if (value >= TARGET) {
          title(this, 480, 270, `SOLD: £${(2_400_000 + value - TARGET).toLocaleString()}`, 40, "#22c55e").setDepth(200);
          synth.play("cheer");
          this.finish(true, [dir(`Fixed ${fixed}. Rotted ${rotted}. Original features found: ${golden}.`)]);
        }
      });
    };
    const speedUp = (n: number) => {
      const s = title(this, 480, 270, n === 1 ? "SPEED UP!" : "FASTER!!", 54, "#ff6b6b").setDepth(220).setScale(0.3);
      this.tweens.add({ targets: s, scale: 1, duration: 200, ease: "Back.out" });
      this.tweens.add({ targets: s, alpha: 0, delay: 700, duration: 300, onComplete: () => s.destroy() });
      synth.play("whistle");
      this.cameras.main.shake(150, 0.004);
    };
    for (let i = 0; i < 3; i++) spawn();
    let nextSpawn = this.time.now + spawnEvery();
    let lastPhase = 0;
    const multTxt = this.add.text(940, 96, "", { fontFamily: PIXEL_BOLD, fontSize: "26px", color: "#facc15", stroke: "#000", strokeThickness: 5 }).setOrigin(1, 0.5).setDepth(200);
    this.add.rectangle(480, 498, 604, 18, 0x000000, 0.7).setDepth(199);
    const bar = this.add.rectangle(180, 498, 0, 12, 0x22c55e).setOrigin(0, 0.5).setDepth(200);
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.ended) return;
        const now = this.time.now;
        if (phase() !== lastPhase) {
          lastPhase = phase();
          speedUp(lastPhase);
        }
        if (now >= nextSpawn) {
          spawn();
          nextSpawn = now + spawnEvery();
        }
        // rot: a ring runs down round each one; past half it goes red and twitches; at zero it costs you
        for (const p of probs) {
          if (p.dead) continue;
          const k = 1 - (now - p.born) / p.life;
          p.ring.clear();
          if (k <= 0) {
            remove(p);
            if (p.gold) {
              this.pop(p.r.x, p.r.y, "GONE", "#9ca3af", 16);
              continue;
            }
            rotted++;
            value = Math.max(0, value - ROT);
            mult = 1;
            synth.play("splat");
            this.pop(p.r.x, p.r.y, `ROTTED -${fmt(ROT)}`, "#ef4444", 18);
            continue;
          }
          const col = k > 0.5 ? 0x22c55e : k > 0.25 ? 0xfacc15 : 0xef4444;
          p.ring.lineStyle(4, col, 0.9).beginPath().arc(p.r.x, p.r.y, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false).strokePath();
          if (k < 0.25) p.r.setAngle(Math.sin(now / 30) * 6);
        }
        // the chain runs out if you dawdle
        if (mult > 1 && now - lastFix > 900) mult = 1;
        multTxt.setText(mult > 1 ? `CHAIN x${mult}` : "");
        bar.setSize(600 * Math.min(1, value / TARGET), 12);
        const left = Math.max(0, (end - now) / 1000);
        this.hud.setText(`${fmt(value)} / ${fmt(TARGET)}    ${left.toFixed(1)}s`);
        if (left <= 0) this.finish(false, [dir(`The surveyor arrives early. He finds the cheese. (${fmt(value)} added; ${rotted} problems left to rot.)`)]);
      },
    });
  }

  // ---------------------------------------------------------------- RUNESCAPE (keep the gear coming)

  private runescape() {
    if (!backdrop(this, "bg_runescape", { dim: 0.1, depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x3d6a2a);
    this.add.rectangle(480, 270, 940, 520).setStrokeStyle(6, 0x5a4a2a);
    title(this, 480, 40, "WOODCUTTING → 99", 26, "#ffff00");
    this.add.text(480, 70, "Tap / SPACE to chop. When the gear runs out, RE-UP (G or the button).", { fontFamily: FONT, fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    const tree = this.add.image(560, 300, "p_tree").setScale(4);
    const me = this.add.sprite(400, 330, playerKey(this), 0).setScale(4);
    const lvlT = this.add.text(40, 110, "", { fontFamily: "monospace", fontSize: "18px", color: "#ffff00", stroke: "#000", strokeThickness: 4 });
    this.add.text(40, 186, "GEAR", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", fontStyle: "bold" });
    this.add.rectangle(40, 208, 200, 14, 0x111111).setOrigin(0, 0.5);
    const gearBar = this.add.rectangle(40, 208, 200, 14, 0xffffff).setOrigin(0, 0.5);
    const window = this.add.rectangle(860, 200, 80, 100, 0x223355).setStrokeStyle(4, 0x5a4a2a);
    const gary = this.add.sprite(860, 210, this.textures.exists("spr_GARY") ? "spr_GARY" : "spr_FOLK2", 0).setScale(2.6).setVisible(false);
    void window;
    // RuneScape XP table, squashed so 99 is reachable in a minute or so with gear
    const target = 13034431;
    let xp = 0;
    let gear = 100;
    let reups = 0;
    let busy = false;
    const levelOf = (x: number) => Math.min(99, 1 + Math.floor(98 * Math.pow(x / target, 0.55)));
    const end = this.time.now + 75000;
    const chop = () => {
      if (this.ended || busy || this.box.active) return;
      const mult = gear > 0 ? 1 : 0.08;
      const gain = Math.round(target / 160 * mult * (0.8 + Math.random() * 0.4));
      const before = levelOf(xp);
      xp = Math.min(target, xp + gain);
      synth.play("hit");
      me.setFrame(String(me.frame.name) === "3" ? 0 : 3);
      this.tweens.add({ targets: tree, angle: { from: -3, to: 3 }, yoyo: true, duration: 60 });
      if (Math.random() < 0.5) this.pop(560 + (Math.random() - 0.5) * 100, 220, `+${gain.toLocaleString()} xp`, "#ffffff", 13);
      const after = levelOf(xp);
      if (after > before && after % 10 === 0) this.pop(480, 160, `Woodcutting level ${after}!`, "#ffff00", 22);
      if (xp >= target) {
        synth.play("cheer");
        title(this, 480, 240, "99 WOODCUTTING\nHISCORES: RANK 1 (OVERALL, OF ALL TIME)", 28, "#ffff00").setDepth(200);
        this.finish(true, [dir(`Gear re-ups required: ${reups}. Gary has bought a boat.`)]);
      }
    };
    const reup = async () => {
      if (this.ended || busy) return;
      busy = true;
      reups++;
      gary.setVisible(true);
      synth.play("door");
      this.pop(860, 130, ["'Alright Kreb'", "'Same again?'", "'For the RuneScape'", "'You're my best customer'"][reups % 4], "#ffd23f", 14);
      await new Promise<void>((r) => this.time.delayedCall(1200, () => r()));
      gary.setVisible(false);
      gear = 100;
      this.pop(200, 200, "Hmmmm… gear… 😋", "#ffffff", 16);
      busy = false;
    };
    this.mash(chop);
    this.input.keyboard?.on("keydown-G", reup);
    const btn = this.add.rectangle(140, 470, 200, 50, 0x7c2d12).setStrokeStyle(3, 0xffff00).setInteractive({ useHandCursor: true });
    this.add.text(140, 470, "RE-UP (G)", { fontFamily: FONT, fontSize: "16px", color: "#ffff00", fontStyle: "bold" }).setOrigin(0.5);
    btn.on("pointerdown", (_p: unknown, _x: number, _y: number, ev: { stopPropagation: () => void }) => {
      ev.stopPropagation();
      reup();
    });
    let warned = false;
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this.ended) return;
        if (!busy) gear = Math.max(0, gear - 1.6);
        gearBar.width = 2 * gear;
        gearBar.setFillStyle(gear > 25 ? 0xffffff : 0xef4444);
        if (gear <= 0 && !warned) {
          warned = true;
          this.pop(200, 210, "Feel a bit manic… better get some gear in!", "#ef4444", 15);
          this.time.delayedCall(3000, () => (warned = false));
        }
        const left = Math.max(0, (end - this.time.now) / 1000);
        lvlT.setText(`Level ${levelOf(xp)}\nXP ${xp.toLocaleString()}`);
        this.hud.setText(`${left.toFixed(0)}s   RE-UPS ${reups}`);
        if (left <= 0) this.finish(false, [dir("Your mum calls you down for dinner. The session is over. Lumbridge weeps.")]);
      },
    });
  }

  // ---------------------------------------------------------------- HIIT BURPEES (eternal life)

  private burpees() {
    if (!backdrop(this, "bg_gym", { dim: 0.25, depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_industrial").setOrigin(0);
    title(this, 480, 44, "EMOM: CHEST-TO-FLOOR BURPEES", 26);
    this.add.text(480, 76, "Alternate DOWN and UP (arrow keys / S then W / tap bottom then top half). 30 burpees before time.", { fontFamily: FONT, fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    const me = this.add.sprite(480, 330, playerKey(this), 0).setScale(5);
    const cue = this.add.text(480, 170, "DOWN", { fontFamily: FONT, fontSize: "40px", color: "#22c55e", fontStyle: "bold", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
    const life = this.add.text(480, 460, "", { fontFamily: FONT, fontSize: "16px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5);
    const need = 30;
    let reps = 0;
    let wantDown = true;
    let stamina = 100;
    const end = this.time.now + 35000;
    const quips = ["The hardest is the burpees", "Lmfao round 1 is chest to floor", "Death is a choice", "Ageing: cancelled", "15 more and I'm immortal"];
    const press = (down: boolean) => {
      if (this.ended || this.box.active) return;
      if (down !== wantDown) {
        stamina = Math.max(0, stamina - 12);
        synth.play("hurt");
        this.cameras.main.shake(120, 0.008);
        this.pop(480, 250, "FLOP", "#ef4444", 22);
        return;
      }
      if (stamina < 5) {
        this.pop(480, 250, "gassed…", "#9ca3af", 18);
        return;
      }
      stamina = Math.max(0, stamina - 1.5);
      if (down) {
        me.setScale(6, 2.2).setY(380);
        synth.play("swing");
      } else {
        me.setScale(5).setY(300);
        this.tweens.add({ targets: me, y: 330, duration: 180 });
        reps++;
        synth.play("pop");
        if (reps % 6 === 0) this.pop(480, 220, quips[(reps / 6) % quips.length | 0], "#ffffff", 16);
      }
      wantDown = !wantDown;
      cue.setText(wantDown ? "DOWN" : "UP").setColor(wantDown ? "#22c55e" : "#3b82f6");
      if (reps >= need) {
        title(this, 480, 240, "ETERNAL LIFE: ATTAINED", 40, "#ffd23f").setDepth(200);
        synth.play("cheer");
        this.finish(true);
      }
    };
    const kb = this.input.keyboard;
    for (const k of ["DOWN", "S"]) kb?.on(`keydown-${k}`, () => press(true));
    for (const k of ["UP", "W"]) kb?.on(`keydown-${k}`, () => press(false));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => press(p.y > 270));
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this.ended) return;
        stamina = Math.min(100, stamina + 0.9);
        const left = Math.max(0, (end - this.time.now) / 1000);
        life.setText(`Life expectancy: ${Math.round(80 + reps * (reps >= need ? 1e9 : 3))} years   ·   Stamina ${Math.round(stamina)}%`);
        this.hud.setText(`BURPEES ${reps}/${need}    ${left.toFixed(1)}s`);
        if (left <= 0) this.finish(false, [dir("Time. You lie face-down on the gym floor. You are, for now, still mortal.")]);
      },
    });
  }

  // ---------------------------------------------------------------- FACEBOOK TROLLING

  private fbTroll(v: "kreblis" | "mikey" = "kreblis") {
    const mk = v === "mikey";
    this.add.rectangle(480, 270, 960, 540, 0xf0f2f5);
    this.add.rectangle(480, 22, 960, 44, 0x1877f2);
    this.add.text(20, 22, "facebrook", { fontFamily: FONT, fontSize: "22px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0, 0.5);
    if (mk) this.add.text(480, 58, "SAINTS vs POMPEY BANTER (18+) · 2,412 members · You are an ADMIN 👑", { fontFamily: FONT, fontSize: "13px", color: "#1877f2", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(940, 22, mk ? "Logged in as: Mikey Nevitt (MODULATOR)" : "Logged in as: Davey Kreblis (real account)", { fontFamily: FONT, fontSize: "12px", color: "#ffffff" }).setOrigin(1, 0.5);
    this.hud.setColor("#050505").setStroke("#ffffff", 0);
    type Post = { who: string; text: string; opts: string[]; troll: number; mean: number; replies: string[] };
    const posts: Post[] = [
      {
        who: "Linda Kresswell",
        text: "Can't believe someone has parked across my drive AGAIN. Some people have no respect!!! 😡😡",
        opts: ["Hope you get it sorted Linda x", "H8 it wen ppl park on ur drive. Hav u tryd parkin on thers?? No wot I mene", "Nobody cares Linda"],
        troll: 1,
        mean: 2,
        replies: ["Linda Kresswell: Excuse me??", "Gaz Bongman: he's got a point linda", "Linda Kresswell: I don't have a car"],
      },
      {
        who: "Krelford Community Noticeboard",
        text: "LOST CAT. Answers to Mittens. Last seen near the Great Tap. Please share.",
        opts: ["Wot culler is it. Ive got a cat but it dnt anser 2 nefin. Is it urs?? It iz very fat now sorry", "Shared! Hope Mittens comes home 🙏", "Probably drank the Tap and exploded"],
        troll: 0,
        mean: 2,
        replies: ["Sue Krelby: WHAT DO YOU MEAN VERY FAT NOW", "Admin: Please DM the owner", "Sue Krelby: I'm calling the police"],
      },
      {
        who: "Gary Bongman (Krelford Independents)",
        text: "Proud to announce I'm standing for council. Time for real change in Krelford! 🗳️",
        opts: ["Good luck mate", "You're a clown and everyone knows it", "Wot r ur polisys on bin colection on fursday. Wil u put the TOWN bak on the town hall. U ave ma vote if u sey yes 2 bofe"],
        troll: 2,
        mean: 1,
        replies: ["Gary Bongman: Bins are a county matter", "Gary Bongman: the TOWN is on the agenda", "Krelford Independents have changed their manifesto"],
      },
      {
        who: "Sharon ✨ Mum of 3",
        text: "Feeling so blessed 🙏 Gym, green smoothie, school run, all before 8am. Living my best life! #blessed #grindset",
        opts: ["Nobody believes you Sharon", "Wot gym. Wot smoovie. Arsking 4 a frend (the frend iz me) (i am at the gym nevar sene u)", "Amazing hun! 💪"],
        troll: 1,
        mean: 0,
        replies: ["Sharon ✨ Mum of 3: Krunch Gym hun x", "Sharon ✨ Mum of 3: wait who is this", "Sharon ✨ Mum of 3 has blocked you"],
      },
      {
        who: "Krelford Rugby Club",
        text: "Massive win today lads! 34-12! Bring on next week 🏉🍺",
        opts: ["Wot dnt the lades luv abowt ma rugby!!", "Rugby is a sport for people who failed football", "Great result lads"],
        troll: 0,
        mean: 1,
        replies: ["Krelford Rugby Club: ???", "Big Dave (Prop): who is this", "Krelford Rugby Club: Ladies' team trials are Thursday"],
      },
      {
        who: "BBK Krelford News",
        text: "Supreme Leader's new single 'Krazy For The Krelworld' reaches 9 listens in its first week.",
        opts: ["Congratulations to the Supreme Leader", "Ash it actully a bop wot u fink?? RuneScape anthem shud be the nashunal anthem tho if u get me", "Absolute dogshit song"],
        troll: 1,
        mean: 2,
        replies: ["Drongus B. Drippin': Thank you", "Drongus B. Drippin': Wait", "Drongus B. Drippin': Kreblis is that you ??"],
      },
    ];
    const mikeyPosts: Post[] = [
      {
        who: "Pompey Dave 1898",
        text: "Saints fans are plastic. Prove me wrong. You can't.",
        opts: ["Leave it. Free speech.", "BANNED FOR LIFE. Reason: lying.", "BANNED. Reason: being from Portsmouth. Also lying."],
        troll: 1,
        mean: 2,
        replies: ["Pompey Dave 1898: lying about WHAT", "Admin (Mikey): u no wot u did", "Pompey Dave 1898 has left the group"],
      },
      {
        who: "Gaz Saintsman",
        text: "Is it just me or is the new admin a bit power mad?",
        opts: ["Good question Gaz. Let's discuss it openly.", "New rule: NO PISSING OFF OR BADMOUTHING ADMINS. THANKS, ADMIN.", "Delete the whole group."],
        troll: 1,
        mean: 2,
        replies: ["Gaz Saintsman: that rule wasn't there 5 seconds ago", "Admin (Mikey): it was always there", "Gaz Saintsman: do u lyk ur nu roole??"],
      },
      {
        who: "THE COLONEL",
        text: "Think carefully before you answer Michael! Did you eat all the pizza??",
        opts: ["Yes. I ate all the pizza.", "No.", "I spoke to the Russian hackers. They say YOU ate it."],
        troll: 2,
        mean: 0,
        replies: ["THE COLONEL: WHAT HACKERS", "THE COLONEL: I DONT EVEN HAVE A PIZZA", "THE COLONEL: ...did I eat the pizza?"],
      },
      {
        who: "Rozzle Frowley",
        text: "hi all new member here. love football. love the group. definitly not anyone you know",
        opts: ["Approve Rozzle. (It's Mikey's own fake account.)", "Ban Rozzle. Frame someone else for it.", "Post: 'Rozzle is me'"],
        troll: 0,
        mean: 2,
        replies: ["Rozzle Frowley: tnx admen", "Admin (Mikey): no problem rozzle", "Gaz Saintsman: why do you two type the same"],
      },
      {
        who: "Group Owner",
        text: "Admins. Please stop banning people for 'lying'. This is a banter page.",
        opts: ["Fair enough boss.", "Ban the owner.", "New rule: Admins are allowed to break rules (Y)"],
        troll: 2,
        mean: 1,
        replies: ["Group Owner: that's not a rule", "Admin (Mikey): it is now (Y)", "Group Owner: I'm making you vice-admin so I can keep an eye on you"],
      },
      {
        who: "End-of-Season Awards",
        text: "Voting is now open. Categories: Funniest Member, Biggest Plastic, WORST ADMIN.",
        opts: ["Vote for someone else for Worst Admin.", "Post a 'VOTE MIKEY NEVITT FOR WORST ADMIN' graphic. Make it sexy as fuck.", "Mute 100 Pompey fans 'for April Fools'."],
        troll: 1,
        mean: 2,
        replies: ["Gaz Saintsman: is he campaigning to be worst admin", "Pompey Dave 1898: I'm voting for him", "Admin (Mikey): WORST ADMIN 2 YEARS RUNNING YEEEE"],
      },
    ];
    if (mk) posts.splice(0, posts.length, ...mikeyPosts);
    const need = 4;
    let idx = 0;
    let score = 0;
    const card = this.add.container(0, 0);
    const show = () => {
      card.removeAll(true);
      if (idx >= posts.length) {
        if (score >= need) {
          title(this, 480, 270, mk ? "POWERRRRRR" : "MOST HATED MAN ON FACEBROOK", 34, "#1877f2").setDepth(200);
          this.finish(true, [dir(`${mk ? "Power moves" : "Trolls landed"}: ${score}/${posts.length}.`)]);
        } else this.finish(false, [dir(`${mk ? "Power moves" : "Trolls landed"}: ${score}/${posts.length}. Need ${need}.`)]);
        return;
      }
      const p = posts[idx];
      card.add(this.add.rectangle(480, 170, 760, 170, 0xffffff).setStrokeStyle(1, 0xdddfe2));
      card.add(this.add.circle(130, 115, 20, 0x9ca3af));
      card.add(this.add.text(160, 100, p.who, { fontFamily: FONT, fontSize: "15px", color: "#050505", fontStyle: "bold" }));
      card.add(this.add.text(160, 120, "Just now · 🌐", { fontFamily: FONT, fontSize: "11px", color: "#65676b" }));
      card.add(this.add.text(120, 150, p.text, { fontFamily: FONT, fontSize: "16px", color: "#050505", wordWrap: { width: 720 } }));
      card.add(this.add.text(120, 230, "👍 Like     💬 Comment     ↗ Share", { fontFamily: FONT, fontSize: "13px", color: "#65676b" }));
      p.opts.forEach((o, i) => {
        const y = 300 + i * 62;
        const bg = this.add.rectangle(480, y, 760, 54, 0xf0f2f5).setStrokeStyle(2, 0x1877f2).setInteractive({ useHandCursor: true });
        const t = this.add.text(110, y, `[${i + 1}] ${o}`, { fontFamily: FONT, fontSize: "14px", color: "#050505", wordWrap: { width: 740 } }).setOrigin(0, 0.5);
        bg.on("pointerdown", () => pick(i));
        card.add([bg, t]);
      });
    };
    let locked = false;
    const pick = (i: number) => {
      if (this.ended || locked || idx >= posts.length) return;
      locked = true;
      const p = posts[idx];
      card.list.filter((o) => o instanceof Phaser.GameObjects.Rectangle && (o as Phaser.GameObjects.Rectangle).input).forEach((o) => (o as Phaser.GameObjects.Rectangle).disableInteractive());
      const reply = this.add.container(0, 0);
      card.add(reply);
      if (i === p.troll) {
        score++;
        synth.play("laugh");
        this.pop(480, 260, `😡 +${80 + Math.floor(Math.random() * 300)}   💬 +${20 + Math.floor(Math.random() * 90)}`, "#e11d48", 24);
        p.replies.forEach((r, j) =>
          this.time.delayedCall(300 + j * 500, () => {
            synth.play("notify");
            reply.add(this.add.rectangle(480, 300 + j * 62, 760, 54, 0xe7f3ff).setStrokeStyle(1, 0x1877f2));
            reply.add(this.add.text(110, 300 + j * 62, r, { fontFamily: FONT, fontSize: "14px", color: "#050505" }).setOrigin(0, 0.5));
          }),
        );
      } else if (i === p.mean) {
        synth.play("banhammer");
        G.s.banRisk = Math.min(90, G.s.banRisk + 8);
        this.pop(480, 260, mk ? "TOO OBVIOUS. The owner noticed. (Ban Risk +8)" : "REPORTED. Too obvious. (Ban Risk +8)", "#ef4444", 20);
      } else {
        synth.play("tap_fail");
        this.pop(480, 260, mk ? "Fair and reasonable. Boring. Wasted." : "2 likes. Nobody noticed. Wasted.", "#65676b", 20);
      }
      this.time.delayedCall(2400, () => {
        idx++;
        locked = false;
        show();
      });
    };
    for (const [k, n] of [["ONE", 0], ["TWO", 1], ["THREE", 2]] as const) this.input.keyboard?.on(`keydown-${k}`, () => pick(n));
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.hud.setText(`${mk ? "POWER MOVES" : "TROLLS LANDED"} ${score}/${need}   POST ${Math.min(idx + 1, posts.length)}/${posts.length}`) });
    show();
  }


  // ---------------------------------------------------------------- THE GIG (Twitcher Mutiny, "Reprieve")

  private gig() {
    if (!backdrop(this, "bg_gig", { depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x1a1033);
    // stage boards and lights
    this.add.rectangle(480, 352, 860, 16, 0x3b2a1a).setDepth(2);
    const lights: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 6; i++) {
      const l = this.add.circle(120 + i * 144, 70, 70, [0xff2e88, 0x5ad1ff, 0xffd23f][i % 3], 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
      lights.push(l);
    }
    if (this.textures.exists("hd_drummer")) this.add.image(250, 300, "hd_drummer").setDepth(4);
    if (this.textures.exists("hd_bassist")) this.add.image(720, 296, "hd_bassist").setDepth(4);
    const benn = this.add.sprite(480, 310, "spr_KREBON", 0).setScale(3).setDepth(10);
    // the crowd: everyone came
    const crowdIds = ["FLENKY", "KREZMAR", "KREBLIS", "KREZWONK", "SCROMBUS", "KREBON", "CRONGUS", "GRONNY", "MIKEY", "POLSON", "EDEN", "PROCTUS", "BOGGOR", "FOLK0", "FOLK1", "FOLK2"].filter((id) => id !== "POLSON" || !G.s.flags.polson_dead);
    const crowd = crowdIds
      .filter((id) => this.textures.exists(`spr_${id}`))
      .map((id, i) => {
        const c = this.add.sprite(50 + i * 58, 470 + (i % 2) * 22, `spr_${id}`, 0).setScale(2).setDepth(20 + (i % 2));
        c.setData("id", id);
        return c;
      });
    title(this, 480, 26, "TWITCHER MUTINY · LIVE AT THE KREZZ ARMS", 22, "#ffd23f").setDepth(200);
    this.add.text(480, 52, "A/D or ← → (or hold left/right of the screen) to move · SPACE / tap Benn to prance", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(200);
    synth.music("twitcher", true);
    const start = this.time.now;
    const GIG_LEN = 90;
    let pace = 0;
    let points = 0;
    let combo = 0;
    let caught = 0;
    let pranceUntil = 0;
    let moveDir = 0;
    let holdX: number | null = null;
    const items: { img: Phaser.GameObjects.Image; landAt: number; x: number; kind: string; done: boolean }[] = [];
    const kb = this.input.keyboard;
    const keys = kb?.addKeys("A,D,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    const prance = () => {
      if (this.ended || this.box.active || this.time.now < pranceUntil - 300) return;
      pranceUntil = this.time.now + 700;
      synth.play("dodge");
      this.tweens.add({ targets: benn, y: 280, angle: 360, duration: 340, yoyo: false, onComplete: () => benn.setAngle(0) });
      this.tweens.add({ targets: benn, y: 310, delay: 340, duration: 260, ease: "Bounce.out" });
      this.pop(benn.x, 220, ["PRANCE!", "ROCKSTAR", "🤘", "REPRIEVE", "SOLO!"][Math.floor(Math.random() * 5)], "#ffd23f", 18);
    };
    kb?.on("keydown-SPACE", prance);
    this.input.on("pointerdown", (pt: Phaser.Input.Pointer) => {
      if (Math.abs(pt.x - benn.x) < 50 && Math.abs(pt.y - benn.y) < 70) prance();
      else holdX = pt.x;
    });
    this.input.on("pointermove", (pt: Phaser.Input.Pointer) => {
      if (pt.isDown && holdX !== null) holdX = pt.x;
    });
    this.input.on("pointerup", () => (holdX = null));
    const throwItem = () => {
      if (this.ended || !crowd.length) return;
      const thrower = crowd[Math.floor(Math.random() * crowd.length)];
      // now and then a GOLDEN one (worth a lot more, and it flies faster)
      const gold = Math.random() < 0.06;
      const kind = gold ? "gold" : Math.random() < 0.55 ? "bra" : "thong";
      const base = gold ? (Math.random() < 0.5 ? "bra" : "thong") : kind;
      const key = this.textures.exists(`hd_${base}`) ? `hd_${base}` : "p_coin";
      const x = 140 + Math.random() * 680;
      const img = this.add.image(thrower.x, thrower.y - 30, key).setDepth(60);
      if (gold) {
        img.setTint(0xffd23f).setScale(1.25);
        synth.play("transform_sparkle");
        this.pop(thrower.x, thrower.y - 60, "✨ GOLDEN ✨", "#ffd23f", 16);
      }
      // it all comes in quicker as the gig speeds up
      const dur = (1100 + Math.random() * 500) * [1, 0.85, 0.72][pace] * (gold ? 0.8 : 1);
      const landAt = this.time.now + dur;
      this.tweens.add({ targets: img, x, duration: dur, ease: "Linear" });
      this.tweens.add({ targets: img, y: { from: thrower.y - 30, to: 120 }, duration: dur * 0.5, ease: "Quad.out" });
      this.tweens.add({ targets: img, y: 300, delay: dur * 0.5, duration: dur * 0.5, ease: "Quad.in" });
      this.tweens.add({ targets: img, angle: 540, duration: dur });
      items.push({ img, landAt, x, kind, done: false });
      if (Math.random() < 0.25) {
        const shout = ["TUNE!", "KREBON I LOVE YOU", "PLAY WONDERWALL", "GET YOUR GUITAR OUT", "REACT TO MY SONG", "ENCORE!", "FAIRWEATHER!", "TOTAL WAR!"][Math.floor(Math.random() * 8)];
        this.pop(thrower.x, thrower.y - 50, shout, "#ffffff", 13);
      }
    };
    const endBtn = this.add.text(940, 22, "[ END GIG ]", { fontFamily: FONT, fontSize: "13px", color: "#ff6bb0", backgroundColor: "#000000aa", padding: { x: 6, y: 3 } }).setOrigin(1, 0).setDepth(300).setVisible(false).setInteractive({ useHandCursor: true });
    const finishGig = () => {
      if (this.ended) return;
      synth.stopMusic();
      const total = ((G.s.flags.rock_points as number) ?? 0) + points;
      G.s.flags.rock_points = total;
      G.s.coins += Math.floor(points / 5);
      title(this, 480, 200, `${points} ROCKSTAR POINTS`, 40, "#ffd23f").setDepth(300);
      this.finish(points >= 100, [dir(`Caught: ${caught}. Best combo: ${bestCombo}. Rockstar points: +${points} (total ${total}). The Krezz Arms takes a cut and gives you ${Math.floor(points / 5)} Krezzcoin.`)]);
    };
    let bestCombo = 0;
    endBtn.on("pointerdown", finishGig);
    // the crowd throws faster as the set goes on: two speed-ups, a banner each (WarioWare-style)
    const throwLoop = () => {
      if (this.ended) return;
      if (Math.random() < 0.85) throwItem();
      this.time.delayedCall([900, 700, 540][pace], throwLoop);
    };
    this.time.delayedCall(900, throwLoop);
    this.time.addEvent({ delay: 500, loop: true, callback: () => {
      const p = Math.min(2, Math.floor((this.time.now - start) / 30000));
      if (p === pace || this.ended) return;
      pace = p;
      const s = title(this, 480, 170, p === 1 ? "SPEED UP!" : "ENCORE PACE!!", 46, "#ff6bb0").setDepth(250).setScale(0.3);
      this.tweens.add({ targets: s, scale: 1, duration: 200, ease: "Back.out" });
      this.tweens.add({ targets: s, alpha: 0, delay: 800, duration: 300, onComplete: () => s.destroy() });
      synth.play("cheer");
    } });
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.ended) return;
        const now = this.time.now;
        const dt = 16;
        // movement
        moveDir = 0;
        if (keys?.A.isDown || keys?.LEFT.isDown) moveDir = -1;
        if (keys?.D.isDown || keys?.RIGHT.isDown) moveDir = 1;
        if (holdX !== null && Math.abs(holdX - benn.x) > 12) moveDir = holdX < benn.x ? -1 : 1;
        benn.x = Phaser.Math.Clamp(benn.x + moveDir * 0.32 * dt, 120, 840);
        // standing still, he rocks out (real art); otherwise the walk cycle
        if (now >= pranceUntil && (moveDir !== 0 || !playPerf(benn, "dance", now, 9))) animateWalker(benn, moveDir, 0, moveDir !== 0, now);
        // crowd bounces to the beat (and cheers, where the art has a cheer)
        const beat = Math.sin(now / 160);
        crowd.forEach((c, i) => {
          c.setY(470 + (i % 2) * 22 - Math.max(0, Math.sin(now / 160 + i)) * 10);
          playPerf(c, "victory", now, 7, i);
        });
        lights.forEach((l, i) => l.setAlpha(0.1 + Math.max(0, Math.sin(now / 300 + i)) * 0.18));
        void beat;
        // catches
        for (const it of items) {
          if (it.done || now < it.landAt) continue;
          it.done = true;
          if (Math.abs(it.x - benn.x) < 46) {
            const prancing = now < pranceUntil;
            combo++;
            bestCombo = Math.max(bestCombo, combo);
            const gain = (it.kind === "gold" ? 60 : it.kind === "thong" ? 15 : 10) * (prancing ? 2 : 1) + Math.min(20, combo);
            points += gain;
            caught++;
            synth.play(it.kind === "gold" ? "jackpot" : "coin");
            if (it.kind === "gold") {
              vfx(this, "vfx_coins", benn.x, 260, { scale: 1.8, depth: 70 });
              this.cameras.main.flash(120, 255, 220, 80);
            }
            this.pop(benn.x, 240, `+${gain}${prancing ? " PRANCE x2" : ""}${combo > 2 ? ` · combo ${combo}` : ""}`, prancing ? "#ff6bb0" : "#ffd23f", prancing ? 20 : 16);
            it.img.destroy();
          } else {
            combo = 0;
            this.tweens.add({ targets: it.img, alpha: 0, duration: 800, onComplete: () => it.img.destroy() });
          }
        }
        // timing: the song's own length when known
        const pr = synth.fileProgress();
        const elapsed = (now - start) / 1000;
        if (elapsed > 45) endBtn.setVisible(true);
        // a 90-second set (the song or 90s, whichever is shorter): one mechanic, so keep it tight
        const len = Math.min(pr.d || GIG_LEN, GIG_LEN);
        const played = Math.max(pr.d ? pr.t : 0, elapsed);
        const left = Math.max(0, len - played);
        this.hud.setText(`🤘 ${points}   CAUGHT ${caught}   COMBO ${combo}   ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")} left`);
        if ((pr.d && pr.ended) || played >= len) finishGig();
      },
    });
  }


  /** Not playing as Krebon: you're in the crowd at his gig, throwing underwear at the stage. */
  private gigWatch() {
    if (!backdrop(this, "bg_gig", { depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x1a1033);
    this.add.rectangle(480, 352, 860, 16, 0x3b2a1a).setDepth(2);
    const lights = [0, 1, 2, 3, 4, 5].map((i) => this.add.circle(120 + i * 144, 70, 70, [0xff2e88, 0x5ad1ff, 0xffd23f][i % 3], 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(3));
    if (this.textures.exists("hd_drummer")) this.add.image(250, 300, "hd_drummer").setDepth(4);
    if (this.textures.exists("hd_bassist")) this.add.image(720, 296, "hd_bassist").setDepth(4);
    const krebon = this.add.sprite(480, 310, "spr_KREBON", 0).setScale(3).setDepth(10);
    const others = ["FLENKY", "KREZMAR", "KREBLIS", "KREZWONK", "SCROMBUS", "CRONGUS", "GRONNY", "MIKEY", "POLSON", "EDEN", "PROCTUS", "BOGGOR", "FOLK0", "FOLK1"].filter((id) => id !== G.s.player && (id !== "POLSON" || !G.s.flags.polson_dead) && this.textures.exists(`spr_${id}`));
    const crowd = others.map((id, i) => this.add.sprite(40 + i * 64, 478 + (i % 2) * 20, `spr_${id}`, 0).setScale(2).setDepth(20 + (i % 2)));
    const me = this.add.sprite(480, 440, playerKey(this), 0).setScale(2.4).setDepth(40);
    this.add.text(480, 404, "YOU", { fontFamily: FONT, fontSize: "11px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(41);
    title(this, 480, 26, "TWITCHER MUTINY · KREBON LIVE AT THE KREZZ ARMS", 21, "#ffd23f").setDepth(200);
    this.add.text(480, 52, "Move A/D or drag low · SPACE / tap high to throw underwear at Krebon · F / tap a mosher to PUNCH · knock stage invaders off with a throw", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", stroke: "#000", strokeThickness: 3, align: "center", wordWrap: { width: 900 } }).setOrigin(0.5).setDepth(200);
    synth.music("twitcher", true);
    const start = this.time.now;
    let points = 0;
    let thrown = 0;
    let caught = 0;
    let target = 480;
    let pranceUntil = 0;
    let rockUntil = 0;
    let holdX: number | null = null;
    let lastThrow = 0;
    const keys = this.input.keyboard?.addKeys("A,D,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    // ---- chaos: moshers, stage invaders, flying pints
    let moshed = 0;
    let shoved = 0;
    let invaders = 0;
    let stunUntil = 0;
    const moshers: Phaser.GameObjects.Sprite[] = [];
    let invader: Phaser.GameObjects.Sprite | null = null;
    const ids = others.length ? others : ["FOLK0"];
    const shout = (x: number, y: number, t: string, c = "#ffffff") => {
      const p = this.add.text(x, y, t, { fontFamily: FONT, fontSize: "13px", color: c, backgroundColor: "#000000aa", padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(150);
      this.tweens.add({ targets: p, y: y - 24, alpha: 0, delay: 1400, duration: 500, onComplete: () => p.destroy() });
    };
    const spawnMosher = () => {
      if (this.ended) return;
      const fromLeft = Math.random() < 0.5;
      const m = this.add.sprite(fromLeft ? -30 : 990, 440 + (Math.random() - 0.5) * 16, `spr_${ids[Math.floor(Math.random() * ids.length)]}`, 0).setScale(2.3).setDepth(39);
      m.setData("v", (fromLeft ? 1 : -1) * (0.22 + Math.random() * 0.14));
      m.setFlipX(!fromLeft);
      moshers.push(m);
      if (Math.random() < 0.4) shout(m.x < 0 ? 80 : 880, 400, ["MOSH PIT!", "OI OI OI", "WALL OF DEATH!", "'AVE IT!"][Math.floor(Math.random() * 4)], "#ff6b6b");
      this.time.delayedCall(1600 + Math.random() * 1800, spawnMosher);
    };
    this.time.delayedCall(2500, spawnMosher);
    const punch = () => {
      if (this.ended || this.box.active) return;
      const near = moshers.filter((m) => Math.abs(m.x - me.x) < 110).sort((x, y) => Math.abs(x.x - me.x) - Math.abs(y.x - me.x))[0];
      synth.play(near ? "punch" : "swing");
      this.tweens.add({ targets: me, x: me.x + (near ? Math.sign(near.x - me.x) * 20 : 0), duration: 70, yoyo: true });
      if (!near) return;
      moshed++;
      points += 5;
      const side = Math.sign(near.x - me.x) || 1;
      moshers.splice(moshers.indexOf(near), 1);
      this.cameras.main.shake(90, 0.006);
      this.pop(near.x, 400, ["MOSH! +5", "BOSH! +5", "SIT DOWN! +5", "GET OUT THE PIT! +5"][Math.floor(Math.random() * 4)], "#ffd23f", 18);
      this.tweens.add({ targets: near, x: near.x + side * 300, y: near.y - 140, angle: side * 720, alpha: 0, duration: 700, onComplete: () => near.destroy() });
    };
    this.input.keyboard?.on("keydown-F", punch);
    this.input.keyboard?.on("keydown-E", punch);
    const spawnInvader = () => {
      if (this.ended) return;
      if (!invader) {
        invaders++;
        const id = Math.random() < 0.35 && this.textures.exists("spr_POLSON") && !G.s.flags.polson_dead ? "POLSON" : ids[Math.floor(Math.random() * ids.length)];
        invader = this.add.sprite(80 + Math.random() * 800, 310, `spr_${id}`, 0).setScale(2.8).setDepth(11);
        this.tweens.add({ targets: invader, y: 296, duration: 220, yoyo: true, repeat: -1 });
        shout(krebon.x, 230, ["GET OFF MY STAGE", "Security? We don't have security.", "This is Reprieve. It's a REPRIEVE.", "Mate. Mate. MATE."][Math.floor(Math.random() * 4)], "#ffd23f");
        if (id === "POLSON") shout(invader.x, 250, "IT'S THE SMOKE MACHINE", "#ffffff");
        const inv = invader;
        this.time.delayedCall(7000, () => {
          if (invader === inv) {
            this.tweens.add({ targets: inv, alpha: 0, duration: 300, onComplete: () => inv.destroy() });
            invader = null;
          }
        });
      }
      this.time.delayedCall(9000 + Math.random() * 7000, spawnInvader);
    };
    this.time.delayedCall(8000, spawnInvader);
    // pints arcing over the crowd
    this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        if (this.ended) return;
        const x0 = 60 + Math.random() * 840;
        const x1 = 140 + Math.random() * 680;
        const pint = this.add.rectangle(x0, 520, 10, 16, 0xf5c542).setDepth(55);
        this.tweens.add({ targets: pint, x: x1, duration: 800 });
        this.tweens.add({ targets: pint, y: 200, duration: 400, ease: "Quad.out", yoyo: true, onComplete: () => {
          if (Math.abs(x1 - krebon.x) < 60) shout(krebon.x, 250, "OI! WHO THREW THAT", "#ff6b6b");
          synth.play("splash");
          pint.destroy();
        } });
      },
    });
    const throwUnderwear = () => {
      if (this.ended || this.box.active || this.time.now - lastThrow < 350 || this.time.now < stunUntil) return;
      lastThrow = this.time.now;
      thrown++;
      const kind = Math.random() < 0.5 ? "bra" : "thong";
      const key = this.textures.exists(`hd_${kind}`) ? `hd_${kind}` : "p_coin";
      const x = me.x;
      const img = this.add.image(me.x, me.y - 30, key).setDepth(60);
      synth.play("lob");
      this.tweens.add({ targets: img, y: { from: me.y - 30, to: 140 }, duration: 380, ease: "Quad.out" });
      this.tweens.add({ targets: img, y: 300, delay: 380, duration: 380, ease: "Quad.in" });
      this.tweens.add({ targets: img, angle: 540, duration: 760 });
      this.time.delayedCall(760, () => {
        if (this.ended) return;
        if (invader && Math.abs(invader.x - x) < 56) {
          const inv = invader;
          invader = null;
          points += 20;
          synth.play("punch_big");
          this.pop(inv.x, 230, "INVADER DOWN! +20", "#5ad35a", 20);
          this.tweens.add({ targets: inv, y: 520, angle: 360, alpha: 0, duration: 600, onComplete: () => inv.destroy() });
          img.destroy();
        } else if (Math.abs(krebon.x - x) < 52) {
          caught++;
          const prancing = this.time.now < pranceUntil;
          const gain = (kind === "thong" ? 15 : 10) * (prancing ? 2 : 1);
          points += gain;
          synth.play("coin");
          this.pop(krebon.x, 230, `KREBON CAUGHT IT! +${gain}`, "#ff6bb0", 18);
          img.destroy();
        } else {
          this.tweens.add({ targets: img, alpha: 0, duration: 700, onComplete: () => img.destroy() });
        }
      });
    };
    this.input.keyboard?.on("keydown-SPACE", throwUnderwear);
    this.input.on("pointerdown", (pt: Phaser.Input.Pointer) => {
      if (pt.y < 380) throwUnderwear();
      else if (moshers.some((m) => Math.abs(m.x - pt.x) < 50 && Math.abs(m.x - me.x) < 140)) punch();
      else holdX = pt.x;
    });
    this.input.on("pointermove", (pt: Phaser.Input.Pointer) => {
      if (pt.isDown && pt.y >= 380) holdX = pt.x;
    });
    this.input.on("pointerup", () => (holdX = null));
    const endBtn = this.add.text(940, 22, "[ LEAVE GIG ]", { fontFamily: FONT, fontSize: "13px", color: "#ff6bb0", backgroundColor: "#000000aa", padding: { x: 6, y: 3 } }).setOrigin(1, 0).setDepth(300).setVisible(false).setInteractive({ useHandCursor: true });
    const done = () => {
      if (this.ended) return;
      synth.stopMusic();
      G.s.flags.rock_points = ((G.s.flags.rock_points as number) ?? 0) + points;
      G.s.flags.saw_gig = true;
      this.finish(true, [
        dir(`You threw ${thrown} items of underwear. Krebon caught ${caught}. You decked ${moshed} moshers, got shoved ${shoved} times and saw off ${invaders} stage invaders. Rockstar points: +${points}.`),
        say("KREBON", "Thank you Krelford. You've been a strange and moist crowd."),
        dir("Polson is crying. He says it's the smoke machine. There is no smoke machine."),
      ]);
    };
    endBtn.on("pointerdown", done);
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.ended) return;
        const now = this.time.now;
        // Krebon performs: wanders the stage, stops to rock out (real art only), and prances
        if (now < rockUntil) {
          playPerf(krebon, "dance", now, 9);
        } else if (Math.abs(target - krebon.x) < 6 || Math.random() < 0.004) {
          target = 140 + Math.random() * 680;
          if (perfCycle(krebon, "dance") && Math.random() < 0.7) rockUntil = now + 1800 + Math.random() * 2600;
        }
        const dir0 = now < rockUntil ? 0 : Math.sign(target - krebon.x);
        if (now >= pranceUntil && now >= rockUntil) {
          krebon.x += dir0 * 0.18 * 16;
          animateWalker(krebon, dir0, 0, dir0 !== 0, now);
          if (Math.random() < 0.006) {
            pranceUntil = now + 700;
            this.tweens.add({ targets: krebon, y: 280, angle: 360, duration: 340, onComplete: () => krebon.setAngle(0) });
            this.tweens.add({ targets: krebon, y: 310, delay: 340, duration: 260, ease: "Bounce.out" });
          }
        }
        // you
        let mv = 0;
        if (keys?.A.isDown || keys?.LEFT.isDown) mv = -1;
        if (keys?.D.isDown || keys?.RIGHT.isDown) mv = 1;
        if (holdX !== null && Math.abs(holdX - me.x) > 10) mv = holdX < me.x ? -1 : 1;
        me.x = Phaser.Math.Clamp(me.x + mv * 0.3 * 16, 60, 900);
        // moshers barrel across the floor and shove you
        for (const m of moshers.slice()) {
          m.x += (m.getData("v") as number) * 16;
          m.y = 440 + Math.sin(now / 90 + m.x) * 6;
          if (!m.getData("hit") && Math.abs(m.x - me.x) < 34) {
            m.setData("hit", true);
            shoved++;
            stunUntil = now + 600;
            me.x = Phaser.Math.Clamp(me.x + Math.sign(m.getData("v") as number) * 110, 60, 900);
            synth.play("hurt");
            this.cameras.main.shake(120, 0.008);
            this.pop(me.x, 400, "SHOVED!", "#ff6b6b", 18);
          }
          if (m.x < -60 || m.x > 1020) {
            moshers.splice(moshers.indexOf(m), 1);
            m.destroy();
          }
        }
        animateWalker(me, mv, 0, mv !== 0, now);
        crowd.forEach((c, i) => {
          c.setY(478 + (i % 2) * 20 - Math.max(0, Math.sin(now / 160 + i)) * 10);
          playPerf(c, "victory", now, 7, i);
        });
        lights.forEach((l, i) => l.setAlpha(0.1 + Math.max(0, Math.sin(now / 300 + i)) * 0.18));
        const pr = synth.fileProgress();
        const elapsed = (now - start) / 1000;
        if (elapsed > 30) endBtn.setVisible(true);
        const len = pr.d || 180;
        const left = Math.max(0, len - (pr.d ? pr.t : elapsed));
        this.hud.setText(`🤘 ${points}   CAUGHT ${caught}   MOSHED ${moshed}   ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")} left`);
        if ((pr.d && pr.ended) || (!pr.d && elapsed > 180)) done();
      },
    });
  }

  // ---------------------------------------------------------------- DO THE CROCODILE (SanMik, "Jerk My Gherk")

  /**
   * The song (audio/crocodile.mp3, 89 BPM) mapped by ear and by spectrum: a quiet intro to 0:10, the band to 0:32,
   * the VOCALS come in on bar 12 (0:32.4), a new section on bar 24 (1:04.7) and the breakdown on bars 28-29. The
   * dance runs from the vocals to the end of that breakdown (bar 30, 1:20.9), with DOUBLE TIME from bar 24.
   */
  private static readonly CROC = {
    BPM: 89,
    PHASE: 0.017,
    /** the song starts here: two bars to get set before the vocals */
    SEEK_BAR: 10,
    /** the vocals come in: first move */
    START_BAR: 12,
    /** the moves come twice as fast (and scroll twice as fast) from here */
    DOUBLE_BAR: 24,
    /** the breakdown: no moves, one last chomp */
    BREAK_BAR: 28,
    /** the dance ends here (where the old version started its second half) */
    END_BAR: 30,
  };

  /** Krezzcoin for a dance: something for turning up, more for every move, perfect, combo and for accuracy. */
  static crocPay(hits: number, perfect: number, best: number, acc: number) {
    return 5 + hits + perfect + Math.floor(best / 2) + Math.round(40 * acc * acc);
  }

  private crocodile() {
    const C = MinigameScene.CROC;
    const BEAT = 60 / C.BPM;
    const barT = (bar: number) => C.PHASE + bar * 4 * BEAT;
    const SEEK = barT(C.SEEK_BAR);
    const DOUBLE_T = barT(C.DOUBLE_BAR);
    const CROC_END = barT(C.END_BAR);
    const SPEED = 330; // px per second along the lane (double time: twice that)
    const HIT_X = 150;
    // the croc's windows: roomier than cam2cam's (three moves), still kinder late than early
    const WIN = { perfect: 0.09, early: 0.22, late: 0.3 };
    if (!backdrop(this, "bg_gig", { dim: 0.35, depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x10241a);
    title(this, 480, 22, "DO THE CROCODILE", 26, "#86efac").setDepth(200);
    this.add.text(480, 46, "SanMik ft. the entire cabinet · ← / A = LEFT HAND · → / D = RIGHT HAND · ↑ / W / SPACE = CHOMP", { fontFamily: FONT, fontSize: "11px", color: "#ffffff", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(200);
    // ---- the dancers: everyone, in a line, extremely serious
    const me = G.s.player;
    const crew = [...LADS.filter((id) => id !== me), ...(G.s.flags.polson_dead ? [] : ["POLSON"]), "PROCTUS"].filter((id) => this.textures.exists(`spr_${id}`));
    /**
     * A dancer. With PixelLab dance art (croc_<ID> sheets: 0 stand, 1 left arm up, 2 right arm up, 3 jaws open,
     * 4 CHOMP, then the full dance loop) the poses are real frames; without it, the old drawn-on arms.
     */
    type Dancer = { spr: Phaser.GameObjects.Sprite; baseX: number; baseY: number; skin: number; l: number; r: number; art: boolean; loop: number[]; until: number; you: boolean };
    const dancers: Dancer[] = [];
    const addDancer = (id: string, key: string, x: number, y: number, scale: number, depth: number, you: boolean) => {
      // his sheet's dance art (SanMik's while Mikey is SanMik)
      const art = `croc_${key.startsWith("spr_") ? key.slice(4) : id}`;
      let spr: Phaser.GameObjects.Sprite;
      let loop: number[] = [];
      if (this.textures.exists(art) && this.textures.exists(key)) {
        // the dance sheet is drawn at the same size as his own sheet (his height included), feet in the same place
        const own = this.textures.get(key).customData as { hd?: number; tall?: number };
        const t = this.textures.get(art);
        t.customData = { ...t.customData, hd: own.hd ?? 0.5, tall: own.tall ?? 1 };
        // 96px frames, the body sits in the bottom 64: pivot where the 64px sheet's centre would be
        spr = this.add.sprite(x, y, art, 0).setOrigin(0.5, 62 / 96).setScale(scale).setDepth(depth);
        loop = Array.from({ length: Math.max(0, t.frameTotal - 1 - 5) }, (_, i) => 5 + i);
      } else spr = this.add.sprite(x, y, key, 0).setScale(scale).setDepth(depth);
      dancers.push({ spr, baseX: x, baseY: y, skin: CHARACTERS[id]?.look?.skin ?? 0xf0b095, l: 0, r: 0, art: loop.length > 0, loop, until: 0, you });
    };
    const back = crew.slice(0, 10);
    back.forEach((id, i) => addDancer(id, `spr_${id}`, 90 + i * (780 / Math.max(1, back.length - 1)), 300 + (i % 2) * 18, 2.2, 20 + (i % 2), false));
    addDancer(me, playerKey(this), 480, 410, 3, 40, true);
    const you = dancers[dancers.length - 1];
    this.add.text(480, 448, "YOU", { fontFamily: FONT, fontSize: "11px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(41);
    const arms = this.add.graphics().setDepth(45);
    // the fallback for anyone without dance art: arm pose 0 = down, 1 = jaws open overhead, 2 = CHOMP
    const drawArms = () => {
      arms.clear();
      for (const d of dancers) {
        if (d.art) continue;
        const h = d.spr.displayHeight;
        const top = d.spr.y - h / 2;
        const sx = d.spr.x;
        const arm = (side: -1 | 1, pose: number) => {
          if (pose <= 0.02) return;
          const shoulderX = sx + side * h * 0.13;
          const shoulderY = top + h * 0.34;
          const open = pose >= 2 ? 0 : Math.min(1, pose);
          const ang = -Math.PI / 2 + side * (0.08 + open * 0.6);
          const len = h * 0.55 * Math.min(1, pose);
          const ex = shoulderX + Math.cos(ang) * len;
          const ey = shoulderY + Math.sin(ang) * len;
          arms.lineStyle(h * 0.11, 0x000000, 1).lineBetween(shoulderX, shoulderY, ex, ey);
          arms.lineStyle(h * 0.075, d.skin, 1).lineBetween(shoulderX, shoulderY, ex, ey);
          arms.fillStyle(d.skin, 1).fillCircle(ex, ey, h * 0.05);
        };
        arm(-1, d.l);
        arm(1, d.r);
      }
    };
    // a move: the pose frame (art) or the drawn arms, a hop, and a little side step for the hands
    const move = (who: Dancer[], kind: "L" | "R" | "C", fast = false) => {
      const hold = fast ? 170 : 300;
      for (const d of who) {
        this.tweens.killTweensOf(d.spr);
        d.spr.setPosition(d.baseX, d.baseY).setAngle(0);
        d.until = this.time.now + hold + 120;
        if (d.art) {
          if (kind === "C") {
            d.spr.setFrame(3);
            this.time.delayedCall(fast ? 50 : 90, () => d.until > this.time.now && d.spr.setFrame(4));
          } else d.spr.setFrame(kind === "L" ? 1 : 2);
          // lean into the hand (a stage-left / stage-right sway), upright for the chomp
          this.tweens.add({ targets: d.spr, angle: kind === "L" ? -7 : kind === "R" ? 7 : 0, duration: 70, yoyo: true, hold: hold - 120 });
        } else {
          const target = { l: kind === "R" ? 0 : kind === "C" ? 2 : 1, r: kind === "L" ? 0 : kind === "C" ? 2 : 1 };
          d.l = target.l === 2 ? 1 : target.l;
          d.r = target.r === 2 ? 1 : target.r;
          this.tweens.add({ targets: d, l: target.l, r: target.r, duration: kind === "C" ? 90 : 120, delay: kind === "C" ? 80 : 0 });
          this.tweens.add({ targets: d, l: 0, r: 0, delay: hold, duration: 150 });
        }
        const step = kind === "L" ? -6 : kind === "R" ? 6 : 0;
        this.tweens.add({ targets: d.spr, y: d.baseY - (kind === "C" ? 9 : 5), x: d.baseX + step, duration: 80, yoyo: true, hold: hold - 160, ease: "Quad.out" });
      }
    };
    // ---- the chart: from the vocals to the breakdown, moves on the beat (offbeats creep in), then DOUBLE TIME
    type Note = { t: number; k: "L" | "R" | "C"; img: Phaser.GameObjects.Container; done: boolean; line?: boolean; fast: boolean };
    const notes: Note[] = [];
    const pattern: ("L" | "R" | "C")[] = ["L", "R", "L", "C", "R", "L", "R", "C"];
    let pi = 0;
    const add = (beat: number, k: "L" | "R" | "C") => {
      const t = C.PHASE + beat * BEAT;
      const fast = t >= DOUBLE_T - 0.01;
      const c = this.add.container(-200, 120).setDepth(150);
      const col = k === "C" ? 0x22c55e : k === "L" ? 0x38bdf8 : 0xf472b6;
      c.add(this.add.circle(0, 0, 20, col).setStrokeStyle(3, fast ? 0xffd23f : 0xffffff));
      c.add(this.add.text(0, 0, k === "C" ? "▲" : k === "L" ? "◀" : "▶", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
      notes.push({ t, k, img: c, done: false, fast });
    };
    for (let beat = C.START_BAR * 4; beat < C.BREAK_BAR * 4; beat++) {
      const bar = Math.floor(beat / 4);
      add(beat, pattern[pi++ % pattern.length]);
      // double time: a move on every half beat
      if (bar >= C.DOUBLE_BAR) add(beat + 0.5, pattern[pi++ % pattern.length]);
      // before that, a syncopated extra on the last beat of the bar once the first verse gets going
      else if (bar >= C.START_BAR + 4 && beat % 4 === 3) add(beat + 0.5, pattern[pi++ % pattern.length]);
    }
    // the breakdown: everybody holds still... then one last CHOMP
    add(C.END_BAR * 4 - 1, "C");
    notes.sort((a, b) => a.t - b.t);
    const lane = this.add.rectangle(480, 120, 960, 54, 0x000000, 0.55).setDepth(140);
    this.add.circle(HIT_X, 120, 24).setStrokeStyle(4, 0xffd23f).setDepth(145);
    const lyric = this.add.text(480, 200, "", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#86efac", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(160);
    // the song picks up two bars before the vocals
    synth.music("crocodile", true);
    const el = synth.musicEl();
    if (el) {
      if (el.readyState >= 1) el.currentTime = SEEK;
      else el.addEventListener("loadedmetadata", () => (el.currentTime = SEEK), { once: true });
    }
    const start = this.time.now;
    let hits = 0;
    let perfect = 0;
    let missed = 0;
    let combo = 0;
    let best = 0;
    const songT = () => {
      const pr = synth.fileProgress();
      // (until the seek lands the element still reads ~0: treat that as the count-in)
      if (pr.d) return Math.max(SEEK, pr.t);
      // the track's still loading: hold the chart at the start rather than scroll notes past unheard (give up after 4s)
      const waited = (this.time.now - start) / 1000;
      return el ? SEEK + Math.max(0, waited - 4) : SEEK + waited;
    };
    const judge = (k: "L" | "R" | "C") => {
      if (this.ended || this.box.active) return;
      const t = songT();
      const n = notes.find((x) => !x.done && this.inWindow(t - x.t, WIN));
      move([you], k, t >= DOUBLE_T);
      if (!n) return;
      n.done = true;
      const signed = t - n.t;
      if (n.k !== k) {
        missed++;
        combo = 0;
        this.pop(480, 360, ["WRONG HAND", "MATE.", "THAT'S A TOAD", "SERIOUSLY?"][Math.floor(Math.random() * 4)], "#ff6b6b", 18);
        n.img.destroy();
        return;
      }
      hits++;
      combo++;
      best = Math.max(best, combo);
      if (Math.abs(signed) <= WIN.perfect) perfect++;
      synth.play(k === "C" ? "punch" : "tap");
      this.hitFx(HIT_X, 120, signed, k === "C" ? 0x22c55e : k === "L" ? 0x38bdf8 : 0xf472b6, WIN.perfect, 170);
      this.tweens.add({ targets: n.img, scale: 1.6, alpha: 0, duration: 200, onComplete: () => n.img.destroy() });
    };
    const kb = this.input.keyboard;
    kb?.on("keydown-LEFT", () => judge("L"));
    kb?.on("keydown-A", () => judge("L"));
    kb?.on("keydown-RIGHT", () => judge("R"));
    kb?.on("keydown-D", () => judge("R"));
    for (const k of ["UP", "W", "SPACE"]) kb?.on(`keydown-${k}`, () => judge("C"));
    // three big pads for touch / mouse
    ([["◀ LEFT", "L", 200, 0x38bdf8], ["▲ CHOMP", "C", 480, 0x22c55e], ["RIGHT ▶", "R", 760, 0xf472b6]] as const).forEach(([lbl, k, x, col]) => {
      const pad = this.add.rectangle(x, 506, 250, 54, col, 0.35).setStrokeStyle(2, col).setDepth(200).setInteractive();
      this.add.text(x, 506, lbl, { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(201);
      pad.on("pointerdown", () => judge(k));
    });
    this.hud.setY(452).setDepth(210);
    const leave = this.add.text(940, 14, "[ LEAVE ]", { fontFamily: FONT, fontSize: "13px", color: "#86efac", backgroundColor: "#000000aa", padding: { x: 6, y: 3 } }).setOrigin(1, 0).setDepth(300).setInteractive({ useHandCursor: true }).setVisible(false);
    // a big shout across the middle (DOUBLE TIME!, the finale)
    const shout = (text: string, color: string, size = 46) => {
      const s = this.add.text(480, 230, text, { fontFamily: "Impact, sans-serif", fontSize: `${size}px`, color, stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setDepth(206).setScale(0.3);
      this.tweens.add({ targets: s, scale: 1, duration: 260, ease: "Back.out" });
      this.tweens.add({ targets: s, angle: { from: -4, to: 4 }, duration: 120, yoyo: true, repeat: 5 });
      this.tweens.add({ targets: s, alpha: 0, y: 200, delay: 1700, duration: 450, onComplete: () => s.destroy() });
    };
    let doubled = false;
    let broke = false;
    let ending = false;
    const done = () => {
      // only once (the song, the timer and LEAVE can all fire)
      if (this.ended || ending) return;
      ending = true;
      this.time.removeAllEvents();
      // anything not reached yet (you LEFT early) counts as missed
      const total = notes.length;
      const acc = total ? hits / total : 0;
      synth.stopMusic();
      lyric.setText("");
      leave.setVisible(false);
      // un-losable: you always finish the dance, and get paid by how well you did it
      const pay = MinigameScene.crocPay(hits, perfect, best, acc);
      const paid = this.fromConsole ? 0 : pay;
      G.s.coins += paid;
      G.s.flags.croc_best = Math.max((G.s.flags.croc_best as number) ?? 0, Math.round(acc * 100));
      const grade = acc >= 0.95 ? "CROCODILE GOD" : acc >= 0.8 ? "APEX PREDATOR" : acc >= 0.6 ? "SNAPPY" : acc >= 0.35 ? "SUSPICIOUS LIZARD" : "A TOAD, BASICALLY";
      this.add.rectangle(480, 250, 520, 220, 0x05140c, 0.9).setStrokeStyle(3, 0x86efac).setDepth(400);
      title(this, 480, 170, grade, 30, "#86efac").setDepth(401);
      this.add
        .text(480, 250, `MOVES ${hits}/${total}  ·  PERFECT ${perfect}\nBEST COMBO ${best}  ·  ${Math.round(acc * 100)}% IN TIME`, { fontFamily: FONT, fontSize: "16px", color: "#ffffff", align: "center", lineSpacing: 8 })
        .setOrigin(0.5)
        .setDepth(401);
      const payTxt = this.add
        .text(480, 322, this.fromConsole ? `SCORE: ${pay}` : `+${pay} KREZZCOIN`, { fontFamily: PIXEL_BOLD, fontSize: "26px", color: "#ffd23f", stroke: "#000", strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(401)
        .setScale(0.4);
      this.tweens.add({ targets: payTxt, scale: 1, duration: 300, ease: "Back.out" });
      if (paid) vfx(this, "vfx_coins", 480, 322, { scale: 1.6, depth: 402 });
      synth.play("ding");
      // everyone strikes the final chomp
      move(dancers, "C");
      this.finish(true, [
        dir(
          this.fromConsole
            ? `${hits} of ${total} moves, ${perfect} perfect, best combo ${best}.`
            : `${hits} of ${total} moves, ${perfect} perfect, best combo ${best}. The cabinet passes a pint glass round. Your cut: ${pay} Krezzcoin.`,
        ),
      ]);
    };
    leave.on("pointerdown", () => done());
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.ended || ending) return;
        const t = songT();
        const now = this.time.now;
        const line = dancers.slice(0, -1);
        for (const n of notes) {
          // the cabinet hits every move exactly on the beat, whether you do or not
          if (!n.line && t >= n.t) {
            n.line = true;
            move(line, n.k, n.fast);
          }
          if (n.done) continue;
          n.img.x = HIT_X + (n.t - t) * SPEED * (n.fast ? 2 : 1);
          if (t - n.t > WIN.late) {
            n.done = true;
            missed++;
            combo = 0;
            n.img.destroy();
            this.missFx(HIT_X, 120, 170);
          }
        }
        // DOUBLE TIME: called as the first fast moves come on screen
        if (!doubled && t >= DOUBLE_T - 1.6) {
          doubled = true;
          synth.play("ding");
          shout("DOUBLE TIME!", "#ffd23f");
          lane.setFillStyle(0x3b0a2a, 0.7);
          this.cameras.main.flash(180, 255, 210, 63);
        }
        if (!broke && t >= barT(C.BREAK_BAR)) {
          broke = true;
          lane.setFillStyle(0x000000, 0.55);
          shout("HOLD IT... FINAL CHOMP!", "#86efac", 34);
        }
        // between moves: the dance loop in time with the song (one pass every two beats), or standing tall
        const beatF = (t - C.PHASE) / BEAT;
        for (const d of dancers) {
          if (!d.art || d.until > now) continue;
          if (t < barT(C.START_BAR) - BEAT || broke) d.spr.setFrame(d.loop[Math.floor(((beatF % 2) + 2) % 2 / 2 * d.loop.length)] ?? 0);
          else d.spr.setFrame(0);
        }
        lyric.setText(t < barT(C.START_BAR) - 0.2 ? (t < barT(C.START_BAR) - BEAT * 4 ? "get ready. be serious." : `${Math.max(1, Math.ceil((barT(C.START_BAR) - t) / BEAT))}...`) : "");
        drawArms();
        // (real time too, not just the song clock: a stale or jumpy clock must never end or skip the dance early)
        const realT = (this.time.now - start) / 1000;
        if (t > barT(C.START_BAR) + 15 && realT > barT(C.START_BAR) - SEEK + 15) leave.setVisible(true);
        const pay = MinigameScene.crocPay(hits, perfect, best, notes.length ? hits / notes.length : 0);
        this.hud.setText(`🐊 ${hits}   COMBO ${combo}   MISSED ${missed}   ${this.fromConsole ? "SCORE" : "💰"} ${pay}${t >= DOUBLE_T ? "   ⚡ x2" : ""}`);
        const pr = synth.fileProgress();
        // the song has to have actually played through, in real time, before the dance can end
        if (((pr.d && pr.ended) || t > CROC_END) && realT > (CROC_END - SEEK) * 0.9) done();
      },
    });
  }

  /** The song summons crocodiles. They head for the playground. */
  // ---------------------------------------------------------------- THE CANNON (boarding Flight KR-069)

  /** Hit the plane early and the cabin crew are impressed. Try 4+ just gets you on board. */
  private static readonly CANNON_PERKS = [
    { hp: 0.5, ammo: 1, bottles: 99, title: "FIRST-TRY BOARDING", what: (hp: number) => `+${hp} HP, FULL AMMO & BOTTLES` },
    { hp: 0.25, ammo: 0.5, bottles: 1, title: "PRIORITY BOARDING", what: (hp: number) => `+${hp} HP, HALF AMMO & +1 BOTTLE` },
    { hp: 0.1, ammo: 0.25, bottles: 0, title: "SPEEDY BOARDING", what: (hp: number) => `+${hp} HP & A BIT OF AMMO` },
  ];

  /** Describe the perk for try n (1-based), or null when there's nothing left. */
  private cannonPerk(n: number): { title: string; text: string; apply: () => void } | null {
    const p = MinigameScene.CANNON_PERKS[n - 1];
    if (!p) return null;
    const s = G.s;
    const mx = maxHp(s);
    const hp = Math.round(mx * p.hp);
    return {
      title: p.title,
      text: p.what(hp),
      apply: () => {
        s.hp = Math.min(mx, s.hp + hp);
        for (const id of Object.keys(s.guns ?? {})) {
          const g = GUNS[id];
          if (!g) continue;
          const m = gunMax(g, s);
          s.guns![id] = Math.min(m, (s.guns![id] ?? 0) + Math.ceil(m * p.ammo));
        }
        if (p.bottles) s.bottles = Math.min(maxBottles(s), s.bottles + p.bottles);
      },
    };
  }

  private cannon() {
    // the runway at golden hour (PixelLab), or the old flat colours if the art's missing
    if (!backdrop(this, "bg_runway", { depth: -10 })) {
      this.add.rectangle(480, 270, 960, 540, 0x8fc3ea);
      this.add.rectangle(480, 470, 960, 140, 0x4b5563);
      for (let i = 0; i < 12; i++) this.add.rectangle(40 + i * 80, 470, 40, 6, 0xfacc15);
    }
    // a couple of slow clouds drifting over, for depth
    for (let i = 0; i < 4; i++) {
      const c = this.add.ellipse(Math.random() * 960, 60 + Math.random() * 120, 120 + Math.random() * 80, 26 + Math.random() * 14, 0xffffff, 0.18).setDepth(-5);
      this.tweens.add({ targets: c, x: c.x + 220, duration: 26000 + Math.random() * 12000, repeat: -1, yoyo: true, ease: "Sine.inOut" });
    }
    title(this, 480, 24, "BOARD FLIGHT KR-069", 26, "#ffd23f").setDepth(200);
    // the instruction on a dark pill so it reads over any sky
    const tip = this.add.text(480, 54, "SPACE / TAP: ANGLE, then POWER. Grab coins mid-air: every miss, the seagulls nick more of them.", { fontFamily: FONT, fontSize: "13px", color: "#ffffff" }).setOrigin(0.5).setDepth(201);
    this.add.rectangle(480, 54, tip.width + 28, 26, 0x0b0614, 0.7).setStrokeStyle(1, 0xffd23f, 0.6).setDepth(200);
    // the on-screen offer: which try this is and what hitting it now is worth
    const offer = this.add
      .text(480, 88, "", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 5, align: "center" })
      .setOrigin(0.5)
      .setDepth(200);
    const hd = this.textures.exists("p_plane_hd");
    const PLANE_Y = this.textures.exists("bg_runway") ? 444 : 360;
    const plane = this.add.image(-200, PLANE_Y, hd ? "p_plane_hd" : "p_plane").setDepth(10);
    if (hd) {
      plane.displayWidth = 260;
      plane.displayHeight = (260 * plane.height) / plane.width;
    } else plane.setScale(2);
    const planeShadow = this.add.ellipse(plane.x, PLANE_Y + plane.displayHeight * 0.42, plane.displayWidth * 0.8, 12, 0x000000, 0.25).setDepth(9);
    // the cannon: a PixelLab barrel pivoting on its carriage
    const CX = 120;
    const CY = 440;
    const art = this.textures.exists("p_cannon_barrel") && this.textures.exists("p_cannon_base");
    let barrel: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (art) {
      this.add.ellipse(CX, CY + 66, 130, 18, 0x000000, 0.3).setDepth(18);
      barrel = this.add.image(CX, CY, "p_cannon_barrel").setOrigin(0.22, 0.49).setScale(1.7).setDepth(20);
      this.add.image(CX - 8, CY + 22, "p_cannon_base").setScale(1.5).setDepth(21);
    } else {
      barrel = this.add.rectangle(110, 440, 90, 26, 0x1f2937).setOrigin(0.1, 0.5).setStrokeStyle(3, 0x000000).setDepth(20);
      this.add.circle(110, 450, 26, 0x374151).setStrokeStyle(3, 0x000000).setDepth(21);
    }
    const MUZZLE = art ? 112 : 80;
    const hero = this.add.sprite(CX, CY - 20, playerKey(this), 0).setScale(2).setDepth(19).setVisible(false);
    // aim guide: a few dots out of the muzzle while you pick the angle
    const guide = this.add.graphics().setDepth(22);
    // the power gauge: green → amber → red, with a sliding marker
    const PG = { x: 230, y: 300, h: 150 };
    const powBox = this.add.container(PG.x, PG.y).setDepth(30).setVisible(false);
    const gauge = this.add.graphics();
    gauge.fillStyle(0x0b0614, 0.8).fillRoundedRect(-16, -8, 32, PG.h + 16, 10);
    for (let i = 0; i < 15; i++) {
      const u = i / 14;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(u < 0.5 ? 0x22c55e : 0xfacc15), Phaser.Display.Color.ValueToColor(u < 0.5 ? 0xfacc15 : 0xef4444), 100, (u < 0.5 ? u * 2 : (u - 0.5) * 2) * 100);
      gauge.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1).fillRect(-9, PG.h - (i + 1) * (PG.h / 15) + 1, 18, PG.h / 15 - 2);
    }
    gauge.lineStyle(2, 0xffd23f, 0.9).strokeRoundedRect(-16, -8, 32, PG.h + 16, 10);
    const marker = this.add.triangle(22, PG.h, 0, 0, 12, -7, 12, 7, 0xffffff).setStrokeStyle(2, 0x000000);
    const powLbl = this.add.text(0, PG.h + 18, "POWER", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5, 0);
    powBox.add([gauge, marker, powLbl]);
    const pow = { setVisible: (v: boolean) => powBox.setVisible(v), setSize: (_w: number, h: number) => marker.setY(PG.h - h * (PG.h / 120)) };
    const powBg = { setVisible: (_v: boolean) => undefined };
    let phase: "angle" | "power" | "flying" | "landed" | "done" = "angle";
    let ang = -0.3;
    let power = 0;
    // tries so far; there is no limit any more, the early ones just pay better
    let tries = 0;
    let px = 0;
    let py = 0;
    let vx = 0;
    let vy = 0;
    const showOffer = () => {
      const n = tries + 1;
      const perk = this.fromConsole ? null : this.cannonPerk(n);
      offer.setText(perk ? `TRY ${n} — bonus: ${perk.text}` : `TRY ${n} — no bonus left. Just get on the plane.`);
      offer.setColor(perk ? (n === 1 ? "#ffd23f" : n === 2 ? "#a7f3d0" : "#bfdbfe") : "#e5e7eb");
    };
    showOffer();
    // ---- stuff in the air, Mario-style: coin arcs along real flight paths, a bongo, a golden Krezzcoin up high, and seagulls
    type Pick = { o: Phaser.GameObjects.Image | Phaser.GameObjects.Arc; kind: "coin" | "bongo" | "gold"; got: boolean };
    const picks: Pick[] = [];
    const loot = { coins: 0, bongos: 0 };
    const lootTxt = this.add.text(944, 122, "", { fontFamily: FONT, fontSize: "16px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(200);
    const showLoot = () => lootTxt.setText(loot.coins || loot.bongos ? `IN YOUR POCKETS: ${loot.coins} KREZZCOIN${loot.bongos ? ` · ${loot.bongos} BONGO${loot.bongos > 1 ? "S" : ""}` : ""}` : "");
    // where a shot at (angle, power) is after t seconds (same physics as the flight below)
    const at = (a: number, pw: number, t: number) => {
      const sp = 380 + pw * 520;
      return { x: CX + Math.cos(a) * MUZZLE + Math.cos(a) * sp * t, y: CY + Math.sin(a) * MUZZLE + Math.sin(a) * sp * t + 350 * t * t };
    };
    const place = (kind: Pick["kind"], x: number, y: number) => {
      if (x < 250 || x > 900 || y < 120 || y > 410) return;
      if (picks.some((p) => Math.abs(p.o.x - x) < 34 && Math.abs(p.o.y - y) < 34)) return;
      let o: Pick["o"];
      if (kind === "bongo" && this.textures.exists("p_bongo")) o = this.add.image(x, y, "p_bongo").setDisplaySize(26, 34);
      else if (kind !== "bongo" && this.textures.exists("kd_coin")) o = this.add.image(x, y, "kd_coin").setDisplaySize(kind === "gold" ? 44 : 24, kind === "gold" ? 44 : 24);
      else o = this.add.circle(x, y, kind === "gold" ? 20 : 11, kind === "bongo" ? 0x38bdf8 : 0xfacc15).setStrokeStyle(2, 0x000000);
      o.setDepth(15);
      if (kind === "gold") {
        (o as any).setTint?.(0xffe680);
        const halo = this.add.circle(x, y, 30, 0xfff3a0, 0.25).setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: halo, scale: 1.3, alpha: 0.08, yoyo: true, repeat: -1, duration: 600 });
        o.once("destroy", () => halo.destroy());
      }
      this.tweens.add({ targets: o, y: y - 6, yoyo: true, repeat: -1, duration: 700 + Math.random() * 300, ease: "Sine.inOut", delay: Math.random() * 400 });
      picks.push({ o, kind, got: false });
    };
    // when a shot comes back down to plane height
    const tLand = (a: number, pw: number) => {
      const sp = 380 + pw * 520;
      const y0 = CY + Math.sin(a) * MUZZLE;
      const vy0 = Math.sin(a) * sp;
      return (-vy0 + Math.sqrt(vy0 * vy0 + 4 * 350 * (PLANE_Y - y0))) / 700;
    };
    for (let k = 0, guard = 0; k < 3 && guard < 200; guard++) {
      const a = -0.45 - Math.random() * 0.75;
      const pw = 0.3 + Math.random() * 0.65;
      const tl = tLand(a, pw);
      const xl = at(a, pw, tl).x;
      // only arcs that come down where the plane can be, spread across the screen
      if (xl < 470 + k * 120 || xl > 620 + k * 130) continue;
      for (let i = 0; i < 6; i++) {
        const q = at(a, pw, tl * (0.3 + i * 0.11));
        place("coin", q.x, q.y);
      }
      // a bongo at the top of one arc
      if (k === 1) {
        const sp = 380 + pw * 520;
        const tTop = (-Math.sin(a) * sp) / 700;
        const q = at(a, pw, tTop);
        place("bongo", q.x, q.y - 4);
      }
      k++;
    }
    // the golden Krezzcoin: only a big steep shot gets near it
    {
      const q = at(-1.15, 0.97, 0.62);
      place("gold", Math.min(860, q.x), Math.max(130, q.y));
    }
    // seagulls cruising across, ready to ruin it
    const gulls: { o: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse; v: number; stunUntil: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const gy = 170 + i * 110 + Math.random() * 40;
      const o = this.textures.exists("p_seagull") ? this.add.image(400 + i * 300, gy, "p_seagull").setScale(1.2) : this.add.ellipse(400 + i * 300, gy, 34, 14, 0xffffff).setStrokeStyle(2, 0x6b7280);
      o.setDepth(16);
      this.tweens.add({ targets: o, scaleY: o.scaleY * 0.8, yoyo: true, repeat: -1, duration: 220 });
      gulls.push({ o, v: 55 + Math.random() * 45, stunUntil: 0 });
    }
    const collect = (p: Pick) => {
      p.got = true;
      this.tweens.killTweensOf(p.o);
      if (p.kind === "bongo") loot.bongos++;
      else loot.coins += p.kind === "gold" ? 50 : 5;
      synth.play(p.kind === "gold" ? "jackpot" : p.kind === "bongo" ? "gulp" : "coin");
      if (p.kind === "gold") {
        vfx(this, "vfx_stars", p.o.x, p.o.y, { scale: 1.4, depth: 40 });
        this.pop(p.o.x, p.o.y - 30, "+50 GOLDEN KREZZCOIN!", "#fff3a0", 20);
      } else this.pop(p.o.x, p.o.y - 20, p.kind === "bongo" ? "+1 BONGO" : "+5", p.kind === "bongo" ? "#7dd3fc" : "#ffd23f", 14);
      this.tweens.add({ targets: p.o, x: 900, y: 122, scale: 0.2, alpha: 0, duration: 380, ease: "Quad.in", onComplete: () => p.o.destroy() });
      showLoot();
    };
    const fire = () => {
      if (this.ended || this.box.active) return;
      if (phase === "angle") {
        phase = "power";
        powBg.setVisible(true);
        pow.setVisible(true);
      } else if (phase === "power") {
        phase = "flying";
        tries++;
        synth.play("boom");
        this.cameras.main.shake(220, 0.012);
        powBg.setVisible(false);
        pow.setVisible(false);
        guide.clear();
        px = CX + Math.cos(ang) * MUZZLE;
        py = CY + Math.sin(ang) * MUZZLE;
        // bang: muzzle flash, a cloud of smoke, the barrel kicking back
        vfx(this, "vfx_muzzle", px, py, { scale: 2.2, depth: 40, angle: Phaser.Math.RadToDeg(ang) });
        vfx(this, "vfx_blastsmoke", px, py, { scale: 1.6, depth: 39 });
        const bx = barrel.x;
        const by = barrel.y;
        this.tweens.add({ targets: barrel, x: bx - Math.cos(ang) * 14, y: by - Math.sin(ang) * 14, duration: 60, yoyo: true, ease: "Quad.out" });
        const sp = 380 + power * 520;
        vx = Math.cos(ang) * sp;
        vy = Math.sin(ang) * sp;
        hero.setPosition(px, py).setVisible(true);
      }
    };
    this.input.keyboard?.on("keydown-SPACE", fire);
    this.input.on("pointerdown", fire);
    // a miss: back in the cannon, as many times as it takes
    // no cheesing it with endless shots: after every miss the seagulls swoop in and nick a growing share of what's
    // left (40%, then 55%, then 70%...), and the golden Krezzcoin is a first-shot-only prize
    const thin = () => {
      const left = picks.filter((p) => !p.got);
      if (!left.length) return;
      const frac = Math.min(0.85, 0.25 + tries * 0.15);
      const gone = new Set<Pick>(left.filter((p) => p.kind === "gold"));
      const rest = Phaser.Utils.Array.Shuffle(left.filter((p) => p.kind !== "gold"));
      for (let i = 0; i < Math.ceil(rest.length * frac); i++) gone.add(rest[i]);
      let k = 0;
      for (const p of gone) {
        p.got = true;
        const o = p.o;
        this.tweens.killTweensOf(o);
        const delay = k++ * 60;
        const gx = 990;
        const gy = o.y - 40;
        const gull = this.textures.exists("p_seagull") ? this.add.image(gx, gy, "p_seagull").setScale(1) : this.add.ellipse(gx, gy, 30, 12, 0xffffff);
        gull.setDepth(17);
        this.tweens.add({
          targets: gull,
          x: o.x + 10,
          y: o.y - 6,
          delay,
          duration: 380,
          ease: "Quad.in",
          onComplete: () => {
            // snatched: off it goes, with your coin
            this.tweens.add({ targets: [gull, o], x: -60, y: o.y - 120, duration: 700, ease: "Quad.out", onComplete: () => { gull.destroy(); o.destroy(); } });
          },
        });
      }
      if (gone.size) this.time.delayedCall(250, () => {
        synth.play("shriek");
        this.pop(480, 280, gone.size > 1 ? `THE SEAGULLS NICKED ${gone.size} OF THEM` : "A SEAGULL NICKED ONE", "#e5e7eb", 16);
      });
    };
    const reset = (msg: string) => {
      phase = "landed";
      this.pop(480, 240, msg, "#ff6b6b", 22);
      thin();
      this.time.delayedCall(900, () => {
        if (this.ended) return;
        hero.setVisible(false).setAngle(0);
        phase = "angle";
        const next = this.fromConsole ? null : this.cannonPerk(tries + 1);
        if (!this.fromConsole && !next && tries === 3) this.pop(480, 150, "BONUSES GONE. STILL GOT TO GET ON.", "#e5e7eb", 18);
        showOffer();
      });
    };
    /** A big card in the middle of the screen (the HUD's toasts aren't up during minigames). */
    const banner = (head: string, body: string) => {
      const c = this.add.container(480, 190).setDepth(260);
      const t1 = this.add.text(0, -16, head, { fontFamily: FONT, fontSize: "24px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
      const t2 = this.add.text(0, 16, body, { fontFamily: FONT, fontSize: "16px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5);
      const w = Math.max(t1.width, t2.width) + 40;
      c.add([this.add.rectangle(0, 0, w, 78, 0x1e1033, 0.92).setStrokeStyle(3, 0xec4899), t1, t2]);
      c.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: "Back.out" });
    };
    const win = async () => {
      if (this.ended) return;
      // played on the telly: just a win, no dungeon and no perks
      if (this.fromConsole) return void this.finish(true, [dir(`On board, try ${tries}.`)]);
      this.ended = true;
      this.time.removeAllEvents();
      this.input.keyboard?.removeAllListeners();
      const perk = this.cannonPerk(tries);
      const lines: Line[] = [
        dir("You hit the fuselage, bounce off a wing, and fall through an open window into seat 23B. The man in 23A doesn't look up from his book."),
        say(G.s.player, "Is this seat taken?"),
      ];
      if (loot.coins || loot.bongos) {
        G.s.coins += loot.coins;
        G.s.bongos += loot.bongos;
        lines.push(dir(`You empty your pockets onto the tray table: ${loot.coins} Krezzcoin${loot.bongos ? ` and ${loot.bongos} slightly shaken fizzy bongo${loot.bongos > 1 ? "s" : ""}` : ""}, collected mid-air. The man in 23A turns a page.`));
      }
      if (perk) {
        perk.apply();
        G.save();
        synth.play("coin");
        banner(`TRY ${tries}: ${perk.title}`, perk.text);
        G.emit("toast", { title: `CANNON BONUS — TRY ${tries}`, text: perk.text });
        lines.push(dir(`${perk.title}: the cabin crew were so impressed they brought you a trolley. ${perk.text}.`));
      } else lines.push(dir(`Try ${tries}. No trolley for you. The cabin crew saw all the other attempts.`));
      G.s.flags.mg_cannon_won = true;
      G.s.flags.mg_cannon_played = true;
      await new Promise((r) => this.time.delayedCall(perk ? 1400 : 300, r));
      await this.box.play(lines);
      switchTo(this, "Dungeon", { dungeon: "airport", room: 0 });
    };
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.ended) return;
        const now = this.time.now;
        // the plane taxis past, again and again
        plane.x += 2.6;
        if (plane.x > 960 + plane.displayWidth * 0.6) plane.x = -plane.displayWidth * 0.6;
        planeShadow.setX(plane.x);
        for (const g of gulls) {
          if (now < g.stunUntil) continue;
          g.o.x -= g.v * 0.016;
          if (g.o.x < 230) g.o.x = 940;
        }
        if (phase === "angle") {
          ang = -0.25 - (0.5 + 0.5 * Math.sin(now / 380)) * 1.0;
          barrel.setRotation(ang);
          guide.clear();
          for (let i = 0; i < 7; i++) {
            const d = MUZZLE + 26 + i * 26;
            const gx = CX + Math.cos(ang) * d;
            const gy = CY + Math.sin(ang) * d;
            const r = 6 - i * 0.5;
            guide.fillStyle(0x1e1033, 0.8 - i * 0.08).fillCircle(gx, gy, r + 2);
            guide.fillStyle(0xffd23f, 1 - i * 0.1).fillCircle(gx, gy, r);
          }
        } else if (phase === "power") {
          power = 0.5 + 0.5 * Math.sin(now / 260);
          pow.setSize(16, 120 * power);
        } else if (phase === "flying") {
          const dt = 0.016;
          vy += 700 * dt;
          px += vx * dt;
          py += vy * dt;
          hero.setPosition(px, py).setAngle(hero.angle + 14);
          for (const p of picks) if (!p.got && Math.abs(p.o.x - px) < (p.kind === "gold" ? 34 : 26) && Math.abs(p.o.y - py) < (p.kind === "gold" ? 34 : 26)) collect(p);
          for (const g of gulls) {
            if (now < g.stunUntil || Math.abs(g.o.x - px) > 30 || Math.abs(g.o.y - py) > 24) continue;
            // SQUAWK: the gull wins, you drop like a stone
            g.stunUntil = now + 1500;
            vx *= 0.35;
            vy = Math.max(vy, 60);
            synth.play("shriek");
            this.cameras.main.shake(140, 0.008);
            this.pop(px, py - 30, "SQUAWK!", "#ffffff", 20);
            for (let f = 0; f < 6; f++) {
              const fe = this.add.rectangle(px, py, 6, 3, 0xffffff).setDepth(41).setAngle(Math.random() * 180);
              this.tweens.add({ targets: fe, x: px + (Math.random() - 0.5) * 80, y: py + 30 + Math.random() * 40, angle: fe.angle + 200, alpha: 0, duration: 900, onComplete: () => fe.destroy() });
            }
            this.tweens.add({ targets: g.o, angle: 720, duration: 600, onComplete: () => g.o.setAngle(0) });
          }
          // a puff of smoke trailing behind you
          if (Math.random() < 0.5) {
            const puff = this.add.circle(px, py, 5 + Math.random() * 4, 0xe5e7eb, 0.7).setDepth(18);
            this.tweens.add({ targets: puff, scale: 2.2, alpha: 0, duration: 500, onComplete: () => puff.destroy() });
          }
          // the fuselage (not the empty sky around the tail); a little more forgiving after a few goes
          const slack = 1 + Math.min(0.4, Math.max(0, tries - 3) * 0.05);
          if (Math.abs(px - plane.x) < plane.displayWidth * (hd ? 0.34 : 0.42) * slack && Math.abs(py - plane.y) < plane.displayHeight * (hd ? 0.22 : 0.32) * slack) {
            phase = "done";
            synth.play("punch_big");
            vfx(this, "vfx_confetti", px, py - 20, { scale: 1.6, depth: 40 });
            this.cameras.main.flash(160, 255, 240, 200);
            this.pop(px, py - 40, "ON BOARD", "#22c55e", 26);
            hero.setVisible(false);
            this.time.delayedCall(600, () => void win());
          } else if (py > 500 || px > 1000) {
            // face-first into the tarmac
            if (py > 500) {
              vfx(this, "vfx_dust", px, 500, { scale: 1.6, depth: 30 });
              synth.play("thud");
              this.cameras.main.shake(120, 0.006);
            }
            hero.setVisible(false);
            reset(["MISSED. TRY AGAIN.", "THAT WAS THE TERMINAL.", "SO CLOSE."][tries % 3]);
          }
        }
        this.hud.setText(`TRY ${Math.max(1, phase === "angle" || phase === "power" ? tries + 1 : tries)}   ${phase === "angle" ? "set the ANGLE" : phase === "power" ? "set the POWER" : ""}`);
      },
    });
  }

}

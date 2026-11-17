import { logLine } from "./dialogueLog";
import Phaser from "phaser";
import type { ChoiceOption, Line, ReactionChoice } from "../../data/types";
import { REACTION_EMOJI } from "../../data/types";
import { G } from "../G";
import { voice } from "../audio/Voice";
import { resolveLine, type ResolvedLine } from "../systems/narrative";
import { displayText } from "../audio/voiceKey";
import { evalCond } from "../systems/conditions";
import { portraitKey } from "../gfx/Textures";
import { playCine } from "../gfx/SideCine";
import { synth } from "../audio/Synth";
import { CHARACTERS } from "../../data/characters";
import { FONT, PIXEL_BOLD, PIXEL_FONT, UI, uiFrame } from "./theme";
import { kruncherVictim, sanmikActive } from "../systems/sanmik";
import { sanmikify } from "../systems/sanmikify";
import { CINE, playCine as playBeat } from "../gfx/Cine";
import { krelCue } from "../scenes/KrelCueScene";

/** SanMik isn't in CHARACTERS (he's Mikey in a wig): his name colour. */
const SANMIK_COLOR = 0xb0c4ff;

/** Playing as Mikey while he's SanMik: Mikey's lines are SanMik's (name and face; the voice is the same man). */
function faceOf(speaker: string): string {
  return speaker === "MIKEY" && sanmikActive(G.s) ? "SANMIK" : speaker;
}

export interface PlayOptions {
  historical?: boolean;
  /** Called whenever a new speaker starts talking (used to highlight seats). */
  onSpeaker?: (speaker: string, line: ResolvedLine) => void;
  /** Called for reaction choices (in addition to the global reaction system). */
  onReact?: (context: string, choice: ReactionChoice) => void;
  /** Called for every line as it is shown. */
  onLine?: (line: ResolvedLine) => void;
}

const W = 960;
const H = 540;

const REGISTER_JIBES = [
  "Oh. It's the pedo.",
  "Get away from me, you sicko.",
  "Keep your distance, nonce.",
  "I've seen the register. Everyone's seen the register.",
  "Ugh. It's you. The pervert.",
  "Hands where I can see them, pedo.",
  "My mum said not to talk to you. She's right.",
  "Oh great, the sex offender's here.",
  "Stay six feet away, sicko. Twelve.",
  "Don't make it weird. Well. Weirder.",
];

/** PixelLab viseme order: rest, closed, small_open, medium_open, wide_open, round, teeth. */
function mouthFor(ch: string): number {
  const c = ch.toLowerCase();
  if (!/[a-z]/.test(c)) return 0;
  if ("mbp".includes(c)) return 1;
  if (c === "a") return 4;
  if ("ei".includes(c)) return 3;
  if ("ouwq".includes(c)) return 5;
  if ("fvst".includes(c)) return 6;
  return 2;
}

/** Scenes whose dialogue box opens the pause menu on Esc (the overworld and dungeons have their own). */
const PAUSABLE = new Set(["Meeting", "Vignette", "Cutscene"]);

export class DialogueBox {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private box: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image;
  private portraitFrame: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Container;
  private advanceResolve: (() => void) | null = null;
  private typing = false;
  private fullText = "";
  private shown = 0;
  private typeTimer: Phaser.Time.TimerEvent | null = null;
  private skipping = false;
  private keyHandler: (e: KeyboardEvent) => void;
  private ptrHandler: (p: Phaser.Input.Pointer) => void;
  private choiceHandler: ((idx: number) => void) | null = null;
  private destroyed = false;
  active = false;

  private dim: number;

  /** Put the box along the top of the screen instead of the bottom (rooms where the action is on the floor, like home). */
  atTop() {
    this.root.setY(12 - 362);
    return this;
  }

  /** Centre the box vertically on the screen (home: in the middle of the room, not up against the ceiling). */
  atMiddle() {
    this.root.setY(Math.round((12 - 362) / 2));
    return this;
  }

  constructor(scene: Phaser.Scene, depth = 1000, dim = 0.55) {
    this.scene = scene;
    this.dim = dim;
    this.root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
    this.box = scene.add.graphics();
    this.portraitFrame = scene.add.graphics();
    this.portrait = scene.add.image(84, 452, "__WHITE").setDisplaySize(112, 112);
    this.nameText = scene.add.text(160, 372, "", { fontFamily: PIXEL_BOLD, fontSize: "16px", color: "#ffd23f" }).setShadow(2, 2, "#000", 0);
    this.titleText = scene.add.text(160, 393, "", { fontFamily: FONT, fontSize: "12px", color: "#9aa0a6" });
    this.bodyText = scene.add
      .text(160, 412, "", { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#ffffff", wordWrap: { width: 760, useAdvancedWrap: true }, lineSpacing: 6 })
      .setShadow(1, 1, "#000", 0);
    this.hint = scene.add.text(W - 30, H - 22, "▼ E / Space   ·   Tab skip", { fontFamily: FONT, fontSize: "11px", color: "#8a8fa0" }).setOrigin(1, 0.5);
    this.overlay = scene.add.container(0, 0);
    // the PixelLab window frame (9-slice), drawn over the dim and under everything else
    this.frame = uiFrame(scene, W / 2, 362 + 83, W - 32, 166, "ui_panel");
    this.frame?.setVisible(false);
    this.root.add([this.box, ...(this.frame ? [this.frame] : []), this.portraitFrame, this.portrait, this.nameText, this.titleText, this.bodyText, this.hint, this.overlay]);
    this.root.setVisible(false);

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.active) return;
      // a key the dialogue uses is the dialogue's alone: Phaser has already queued this same keypress for the scene,
      // and it would otherwise land a frame later in whatever starts when the box closes (a minigame, a QTE),
      // so one press of SPACE would both close the last line AND skip / cancel the game
      const swallow = () => {
        const mgr = (this.scene.input.keyboard as unknown as { manager?: { queue?: KeyboardEvent[] } } | null)?.manager;
        const q = mgr?.queue;
        if (q) for (let i = q.length - 1; i >= 0; i--) if (q[i] === e) q.splice(i, 1);
      };
      // the pause menu is up over us: its keys aren't ours
      if (this.scene.sys.isPaused() || this.scene.scene.isActive("Menu")) return;
      // Esc in a cutscene or briefing pauses it (settings, dialogue log, quit) like everywhere else
      if (e.key === "Escape" && PAUSABLE.has(this.scene.scene.key)) {
        e.preventDefault();
        this.scene.scene.launch("Menu", { mode: "pause", caller: this.scene.scene.key });
        this.scene.scene.pause();
        return;
      }
      if (this.choiceHandler) {
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && n >= 1 && n <= 9) {
          swallow();
          this.choiceHandler(n - 1);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        swallow();
        this.skipping = true;
        this.advance();
        return;
      }
      if (e.key === " " || e.key === "Enter" || e.key === "e" || e.key === "E") {
        e.preventDefault();
        swallow();
        this.advance();
      }
    };
    this.ptrHandler = (p: Phaser.Input.Pointer) => {
      if (!this.active || this.choiceHandler || this.scene.sys.isPaused()) return;
      if (p.rightButtonDown()) return;
      this.advance();
    };
    window.addEventListener("keydown", this.keyHandler);
    scene.input.on("pointerdown", this.ptrHandler);
    scene.events.once("shutdown", () => this.destroy());
    scene.events.once("destroy", () => this.destroy());
  }

  destroy() {
    voice.stop();
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("keydown", this.keyHandler);
    this.scene.input?.off("pointerdown", this.ptrHandler);
    this.typeTimer?.remove();
    this.root.destroy();
  }

  /** Skip the rest of the script and shut the voice up. */
  skipAll() {
    if (!this.active) return;
    this.skipping = true;
    voice.stop();
    this.advance();
  }

  private advance() {
    if (this.typing) {
      this.finishTyping();
      if (!this.skipping) return;
    }
    const r = this.advanceResolve;
    this.advanceResolve = null;
    r?.();
  }

  private talkKey: string | null = null;

  private finishTyping() {
    if (this.talkKey) this.portrait.setFrame(0);
    this.typing = false;
    this.typeTimer?.remove();
    this.typeTimer = null;
    this.bodyText.setText(this.fullText);
  }

  private frame: Phaser.GameObjects.NineSlice | null = null;

  private drawBox(kind: "speech" | "dir" | "notify") {
    const g = this.box;
    g.clear();
    this.frame?.setVisible(false);
    if (kind === "notify") return;
    g.fillStyle(0x000000, this.dim);
    g.fillRect(0, 0, W, H);
    if (this.frame) {
      // stage directions get a greyed frame
      this.frame.setVisible(true).setTint(kind === "dir" ? 0x9aa0b4 : 0xffffff);
      return;
    }
    g.fillStyle(UI.panel, 0.97);
    g.fillRoundedRect(16, 362, W - 32, 166, 10);
    g.lineStyle(3, kind === "dir" ? 0x5b5f73 : UI.accent, 1);
    g.strokeRoundedRect(16, 362, W - 32, 166, 10);
  }

  private setPortrait(speaker: string | null) {
    this.portraitFrame.clear();
    if (!speaker) {
      this.portrait.setVisible(false);
      return;
    }
    const key = portraitKey(this.scene, speaker);
    if (!key) {
      this.portrait.setVisible(false);
      return;
    }
    // a talking portrait (PixelLab mouth shapes, talk_<SPEAKER>) if this speaker has one
    let tk = `talk_${speaker.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
    // the Kreddle Krunchers' victim (Mikey, or Polson if you're Mikey): black eye, fat lip, for the rest of Chapter 3
    const victim = kruncherVictim(G.s);
    if (tk === `talk_${victim}` && G.s.flags.krunchers_invaded && G.s.chapter === 3 && this.scene.textures.exists(`talk_${victim}_HURT`)) tk = `talk_${victim}_HURT`;
    this.talkKey = this.scene.textures.exists(tk) ? tk : null;
    // the Krelford finale, after the golden juice: the lads talk as super saiyans (their gold close-ups)
    const ssj = G.s.flags.finale_cp === "ssj" ? `ssj_por_${speaker.toUpperCase()}` : "";
    if (ssj && this.scene.textures.exists(ssj)) {
      this.talkKey = null;
      this.portrait.setTexture(ssj).setDisplaySize(112, 112).setVisible(true);
    } else if (this.talkKey) this.portrait.setTexture(this.talkKey, 0).setDisplaySize(112, 112).setVisible(true);
    else this.portrait.setTexture(key).setDisplaySize(112, 112).setVisible(true);
    const col = CHARACTERS[speaker]?.color ?? (speaker === "SANMIK" ? SANMIK_COLOR : 0x888888);
    this.portraitFrame.fillStyle(0x000000, 1);
    this.portraitFrame.fillRect(24, 392, 120, 120);
    this.portraitFrame.lineStyle(3, col, 1);
    this.portraitFrame.strokeRect(24, 392, 120, 120);
  }

  private typeOut(text: string) {
    this.fullText = text;
    this.shown = 0;
    this.bodyText.setText("");
    if (this.skipping) {
      this.bodyText.setText(text);
      this.typing = false;
      return;
    }
    this.typing = true;
    const speed = Math.max(0.25, G.meta.settings.textSpeed);
    const perTick = Math.max(1, Math.round(speed * 1.6));
    this.typeTimer?.remove();
    this.typeTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        this.shown = Math.min(this.fullText.length, this.shown + perTick);
        this.bodyText.setText(this.fullText.slice(0, this.shown));
        // lip-sync: the mouth shape for the letter just typed (every couple of letters, so it doesn't buzz)
        if (this.talkKey && this.shown % 2 === 0) this.portrait.setFrame(mouthFor(this.fullText[this.shown - 1] ?? " "));
        if (this.shown % 3 === 0) synth.play("type");
        if (this.shown >= this.fullText.length) this.finishTyping();
      },
    });
  }

  private waitAdvance(): Promise<void> {
    return new Promise((res) => {
      this.advanceResolve = res;
      if (this.skipping && !this.typing) {
        this.scene.time.delayedCall(30, () => this.advance());
        return;
      }
      if (G.meta.settings.autoAdvance) this.autoAdvanceWhenRead(res);
    });
  }

  /** Auto mode: once the line is typed out and the voice has finished, give it a beat to land, then move on. */
  private autoAdvanceWhenRead(res: () => void) {
    let quietFor = 0;
    const ev = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this.destroyed || this.advanceResolve !== res) return ev.remove();
        if (this.typing || voice.busy()) {
          quietFor = 0;
          return;
        }
        quietFor += 100;
        // silent lines (no recording) get reading time by length
        const need = Math.max(900, Math.min(4000, this.fullText.length * 28));
        if (quietFor >= (voice.enabled() ? 700 : need)) {
          ev.remove();
          this.advance();
        }
      },
    });
  }

  private clearOverlay() {
    this.overlay.removeAll(true);
    this.choiceHandler = null;
  }

  /** Messenger-style notification bubble at the top. */
  private showNotify(line: ResolvedLine, text = displayText(line.t)) {
    this.clearOverlay();
    this.drawBox("notify");
    this.nameText.setText("");
    this.titleText.setText("");
    this.bodyText.setText("");
    this.portrait.setVisible(false);
    this.portraitFrame.clear();
    const g = this.scene.add.graphics();
    const bubbleW = 640;
    const x = (W - bubbleW) / 2;
    g.fillStyle(0x000000, 0.45);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x, 150, bubbleW, 150, 18);
    g.fillStyle(0x0084ff, 1);
    g.fillRoundedRect(x + 16, 196, bubbleW - 32, 90, 16);
    const face = faceOf(line.s);
    const key = portraitKey(this.scene, face);
    const items: Phaser.GameObjects.GameObject[] = [g];
    if (key) items.push(this.scene.add.image(x + 38, 172, key).setDisplaySize(36, 36));
    items.push(this.scene.add.text(x + 64, 162, (face !== line.s ? "SANMIK" : line.speakerName) || "Messenger", { fontFamily: FONT, fontSize: "15px", color: "#050505", fontStyle: "bold" }));
    items.push(this.scene.add.text(x + bubbleW - 20, 164, "now", { fontFamily: FONT, fontSize: "12px", color: "#65676b" }).setOrigin(1, 0));
    const body = this.scene.add.text(x + 32, 208, text, { fontFamily: PIXEL_FONT, fontSize: "16px", lineSpacing: 4, color: "#ffffff", wordWrap: { width: bubbleW - 64, useAdvancedWrap: true } });
    items.push(body);
    this.overlay.add(items);
    this.fullText = text;
    this.typing = false;
    synth.play("notify");
  }

  private showChoices(options: { label: string }[], title?: string): Promise<number> {
    return new Promise((res) => {
      this.clearOverlay();
      const items: Phaser.GameObjects.GameObject[] = [];
      const top = 360 - options.length * 40 - (title ? 30 : 0);
      if (title) items.push(this.scene.add.text(W / 2, top - 6, title, { fontFamily: FONT, fontSize: "15px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5, 1));
      options.forEach((o, i) => {
        const y = top + i * 40;
        const bg = this.scene.add.rectangle(W / 2, y + 16, 640, 34, 0x1b1e33, 0.96).setStrokeStyle(2, UI.accent).setInteractive({ useHandCursor: true });
        const t = this.scene.add.text(W / 2, y + 16, `${i + 1}. ${o.label}`, { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#ffffff", wordWrap: { width: 600 } }).setOrigin(0.5);
        bg.on("pointerover", () => bg.setFillStyle(0x2d3360, 1));
        bg.on("pointerout", () => bg.setFillStyle(0x1b1e33, 0.96));
        bg.on("pointerdown", (_p: any, _x: any, _y: any, ev: any) => {
          ev?.stopPropagation?.();
          pick(i);
        });
        items.push(bg, t);
      });
      this.overlay.add(items);
      const pick = (i: number) => {
        if (i < 0 || i >= options.length) return;
        synth.play("select");
        this.clearOverlay();
        res(i);
      };
      this.choiceHandler = pick;
    });
  }

  private showReaction(message: string, from: string, options: ReactionChoice[]): Promise<ReactionChoice> {
    return new Promise((res) => {
      this.clearOverlay();
      this.drawBox("notify");
      this.nameText.setText("");
      this.titleText.setText("");
      this.bodyText.setText("");
      this.portrait.setVisible(false);
      this.portraitFrame.clear();
      const g = this.scene.add.graphics();
      const bw = 680;
      const x = (W - bw) / 2;
      g.fillStyle(0x000000, 0.55);
      g.fillRect(0, 0, W, H);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(x, 110, bw, 260, 20);
      g.fillStyle(0xe4e6eb, 1);
      g.fillRoundedRect(x + 70, 160, bw - 100, 96, 18);
      const items: Phaser.GameObjects.GameObject[] = [g];
      const key = portraitKey(this.scene, from);
      if (key) items.push(this.scene.add.image(x + 40, 190, key).setDisplaySize(44, 44));
      items.push(this.scene.add.text(x + 70, 128, CHARACTERS[from]?.name ?? from, { fontFamily: FONT, fontSize: "14px", color: "#65676b", fontStyle: "bold" }));
      items.push(this.scene.add.text(x + 88, 172, message, { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#050505", wordWrap: { width: bw - 140, useAdvancedWrap: true } }));
      items.push(this.scene.add.text(W / 2, 272, "REACT  (1-5 or click)", { fontFamily: FONT, fontSize: "12px", color: "#65676b" }).setOrigin(0.5, 0));
      const opts = options.length ? options : (["LIKE", "LOVE", "LAUGH", "ANGRY", "SEEN"] as ReactionChoice[]);
      const pick = (i: number) => {
        if (i < 0 || i >= opts.length) return;
        this.clearOverlay();
        res(opts[i]);
      };
      opts.forEach((r, i) => {
        const cx = W / 2 + (i - (opts.length - 1) / 2) * 100;
        const circle = this.scene.add.circle(cx, 322, 32, 0xf0f2f5).setStrokeStyle(2, 0xd0d3d9).setInteractive({ useHandCursor: true });
        const label = this.scene.add.text(cx, 322, REACTION_EMOJI[r], { fontFamily: FONT, fontSize: r === "SEEN" ? "15px" : "28px", color: "#333" }).setOrigin(0.5);
        const num = this.scene.add.text(cx + 24, 300, String(i + 1), { fontFamily: FONT, fontSize: "11px", color: "#999" });
        circle.on("pointerover", () => {
          circle.setScale(1.15);
          label.setScale(1.15);
        });
        circle.on("pointerout", () => {
          circle.setScale(1);
          label.setScale(1);
        });
        circle.on("pointerdown", () => pick(i));
        items.push(circle, label, num);
      });
      this.overlay.add(items);
      this.choiceHandler = pick;
    });
  }

  /** Play a script. Resolves when the last line has been dismissed. */
  async play(lines: Line[], opts: PlayOptions = {}): Promise<void> {
    if (this.destroyed) return;
    this.active = true;
    this.skipping = false;
    this.root.setVisible(true);
    const queue = [...lines];
    const s = G.s;
    voice.prefetch(queue.filter((l) => !l.dir && l.t).map((l) => ({ s: String(l.s === "YOU" ? s.player : l.s), t: l.t })));
    // On the register: whoever speaks to you first opens with what they think of you.
    if (s.flags.on_register && !(((s.flags.on_register_until as number) ?? Infinity) < s.playtimeMs)) {
      const i = queue.findIndex((l) => !l.dir && !l.notify && l.s !== "NARRATOR" && l.s !== s.player && !!l.t && evalCond(l.cond, s));
      if (i >= 0) queue.splice(i, 0, { s: queue[i].s, t: REGISTER_JIBES[Math.floor(Math.random() * REGISTER_JIBES.length)], tag: "new" });
    }
    while (queue.length && !this.destroyed) {
      const raw0 = queue.shift()!;
      // "YOU" = whoever you're playing as
      const raw = raw0.s === "YOU" ? { ...raw0, s: s.player } : raw0;
      if (!evalCond(raw.cond, s)) continue;
      if (raw.set) Object.assign(s.flags, raw.set);
      if (raw.react) {
        this.skipping = false;
        const r = raw.react;
        const choice = await this.showReaction(r.message, (r.from as string) ?? "DRONGUS", r.options ?? []);
        G.react(r.context, choice);
        opts.onReact?.(r.context, choice);
        const out = r.outcomes?.[choice];
        if (out) queue.unshift(...out);
        if (!raw.t) continue;
      }
      if (raw.tv) {
        // someone puts the telly on: play the episode over the top, then carry on
        this.skipping = false;
        this.root.setVisible(false);
        const sc = this.scene;
        // the scene that owns this box (meetings run the box themselves; otherwise it's the Dialogue overlay)
        const host = sc.scene.key;
        await new Promise<void>((res) => {
          sc.events.once("ui-resume", () => res());
          sc.scene.launch("TV", { overlay: true, caller: host, episode: raw.tv, once: true });
          sc.scene.pause();
        });
        synth.music(host === "Meeting" ? "meeting" : "hub");
        this.root.setVisible(true);
        if (!raw.t) continue;
      }
      if (raw.rise) {
        // Drongus storms off and builds his dungeon: cut to the town for the rise, then back to the room
        this.skipping = false;
        this.root.setVisible(false);
        const sc = this.scene;
        const host = sc.scene.key;
        if (!G.s.flags.drongus_dungeon_risen) {
          await new Promise<void>((res) => {
            sc.events.once("ui-resume", () => res());
            sc.scene.launch("Hub", { riseCut: host, at: "TOWN_HALL" });
            sc.scene.bringToTop("Hub");
            sc.scene.pause();
          });
          synth.music(host === "Meeting" ? "meeting" : "hub");
        }
        this.root.setVisible(true);
        if (!raw.t) continue;
      }
      if (raw.krel) {
        // a Kreltality, no fight: the box steps aside, the host pauses under the overlay, then the script carries on
        this.skipping = false;
        this.root.setVisible(false);
        const sc = this.scene;
        const tune = synth.currentMusic();
        const did = await krelCue(sc, raw.krel.target);
        if (this.destroyed) break;
        if (tune && synth.currentMusic() !== tune) synth.music(tune);
        const out = did ? raw.krel.yes : raw.krel.no;
        if (out) queue.unshift(...out);
        this.root.setVisible(true);
        if (!raw.t) continue;
      }
      if (raw.choice) {
        this.skipping = false;
        const avail: ChoiceOption[] = raw.choice.filter((c) => evalCond(c.cond, s));
        if (raw.t) {
          const rl = resolveLine(raw, s, opts);
          if (rl) this.renderLine(rl, opts);
        }
        const idx = await this.showChoices(avail);
        const c = avail[idx];
        if (c?.set) Object.assign(s.flags, c.set);
        if (c?.lines) queue.unshift(...c.lines);
        continue;
      }
      if (raw.cine) await this.cine(raw.cine);
      if (!raw.t && !raw.canon) continue;
      const rl = resolveLine(raw, s, opts);
      if (!rl) continue;
      if (rl.sfx) synth.play(rl.sfx);
      const did = rl.canon ?? rl.id;
      if (did && !s.discovered.includes(did)) s.discovered.push(did);
      // a line too long for its box carries on in the next box (same speaker; the voice reads it once)
      const pages = this.pages(rl);
      for (const [i, page] of pages.entries()) {
        if (this.destroyed) break;
        this.renderLine(rl, opts, page, i === 0);
        await this.waitAdvance();
        this.clearOverlay();
      }
      if (raw.cineAfter) await this.cine(raw.cineAfter);
    }
    this.active = false;
    this.skipping = false;
    if (!this.destroyed) this.root.setVisible(false);
  }

  /**
   * An anime beat between lines: the box steps aside while it plays. A cue is either a named story beat (gfx/Cine.ts,
   * content/cine.ts: click / Enter cut it short) or a SideCine cue string (E / Space / click cut it short).
   * Tab skips either along with the script.
   */
  private async cine(cue: string) {
    if (this.destroyed || this.skipping) return;
    const was = this.root.visible;
    this.root.setVisible(false);
    if (CINE[cue]) {
      await playBeat(this.scene, cue, () => this.skipping || this.destroyed);
      if (!this.destroyed) this.root.setVisible(was);
      return;
    }
    await playCine(this.scene, cue, {
      press: () => new Promise<void>((res) => (this.advanceResolve = res)),
      skipping: () => this.skipping || this.destroyed,
    });
    this.advanceResolve = null;
    if (!this.destroyed) this.root.setVisible(was);
  }

  /** Bumped on every line, so a late YEE from an old line stays quiet. */
  private lineNo = 0;

  /** What's shown for a line: Mikey's lines get SanMik-ified while he's SanMik. */
  private shownText(rl: ResolvedLine): { text: string; leadYees: number; tailYees: number } {
    const text = displayText(rl.t);
    if (rl.dir || rl.s === "NARRATOR" || faceOf(rl.s) !== "SANMIK" || rl.s === "SANMIK") return { text, leadYees: 0, tailYees: 0 };
    return sanmikify(text);
  }

  /** Read the line out; SanMik's YEEs go before it (the voice waits) and/or after it (once the voice stops). */
  private speakLine(rl: ResolvedLine, lead: number, tail: number) {
    const my = ++this.lineNo;
    if (rl.dir || rl.s === "NARRATOR" || !rl.t) {
      voice.stop();
      return;
    }
    const yees = (n: number, then?: () => void) => {
      for (let i = 0; i < n; i++) this.scene.time.delayedCall(i * 330, () => my === this.lineNo && synth.shout("yee", 0.85, n > 1 ? 1 + i * 0.07 : undefined));
      if (then) this.scene.time.delayedCall(n * 330 + 450, () => my === this.lineNo && then());
    };
    const sayIt = () => {
      // SanMik form: Mikey's lines in SanMik's own voice
      voice.say(faceOf(String(rl.s)), rl.t);
      if (!tail) return;
      // wait for the voice to finish (with a little grace for it to start), then YEE
      let waited = 0;
      const ev = this.scene.time.addEvent({
        delay: 150,
        loop: true,
        callback: () => {
          waited += 150;
          if (my !== this.lineNo) return ev.remove();
          if (waited < 600 || voice.busy()) return;
          ev.remove();
          yees(tail);
        },
      });
    };
    if (lead) {
      voice.stop();
      yees(lead, sayIt);
    } else sayIt();
  }

  /** How a box lays its text out: wrap width, how many lines fit, and the text style. */
  private static layout(kind: "speech" | "dir" | "notify") {
    // the pixel font at its native 16px: every glyph lands on whole pixels, so it reads crisp
    if (kind === "notify") return { width: 576, lines: 3, style: { fontFamily: PIXEL_FONT, fontSize: "16px", lineSpacing: 4 } };
    if (kind === "dir") return { width: W - 80, lines: 5, style: { fontFamily: PIXEL_FONT, fontSize: "16px", lineSpacing: 6 } };
    // speech: measured against the narrower, with-portrait layout so it fits either way
    return { width: W - 200, lines: 4, style: { fontFamily: PIXEL_FONT, fontSize: "16px", lineSpacing: 6 } };
  }


  private measurer: Phaser.GameObjects.Text | null = null;

  /** Wrapped line count of `text` in a box of this kind. */
  private lineCount(text: string, kind: "speech" | "dir" | "notify") {
    const L = DialogueBox.layout(kind);
    if (!this.measurer) this.measurer = this.scene.make.text({ x: -9999, y: -9999, text: "" }, false);
    const m = this.measurer;
    m.setStyle({ ...L.style, wordWrap: { width: L.width, useAdvancedWrap: true } });
    return m.getWrappedText(text).length;
  }

  /** The line split into box-sized pages, breaking at a sentence end where one is close, else between words. */
  private pages(rl: ResolvedLine): string[] {
    const text = this.shownText(rl).text;
    const kind = rl.notify ? "notify" : rl.dir || rl.s === "NARRATOR" ? "dir" : "speech";
    const max = DialogueBox.layout(kind).lines;
    if (!text || this.lineCount(text, kind) <= max) return [text];
    const words = text.split(/(?<=\s)/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur + w;
      if (cur && this.lineCount(next.trim(), kind) > max) {
        // prefer to end the page at the last sentence break in its second half
        const cut = Math.max(cur.lastIndexOf(". "), cur.lastIndexOf("? "), cur.lastIndexOf("! "), cur.lastIndexOf(".. "));
        if (cut > cur.length * 0.5) {
          out.push(cur.slice(0, cut + 1).trim());
          cur = cur.slice(cut + 1).trimStart() + w;
        } else {
          out.push(cur.trim() + " …");
          cur = "… " + w;
        }
      } else cur = next;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  private renderLine(rl: ResolvedLine, opts: PlayOptions, page?: string, first = true) {
    const shown = this.shownText(rl);
    if (page !== undefined) shown.text = page;
    if (first) {
      opts.onLine?.(rl);
      this.speakLine(rl, shown.leadYees, shown.tailYees);
      const whole = this.shownText(rl).text;
      const face = faceOf(rl.s);
      if (rl.dir || rl.s === "NARRATOR") logLine({ who: "", text: whole, dir: true });
      else logLine({ who: face !== rl.s ? "SANMIK" : rl.speakerName || String(rl.s), text: whole, color: CHARACTERS[face]?.color ?? (face === "SANMIK" ? SANMIK_COLOR : undefined) });
    }
    if (rl.notify) {
      opts.onSpeaker?.(rl.s, rl);
      this.showNotify(rl, shown.text);
      return;
    }
    if (rl.dir || rl.s === "NARRATOR") {
      this.drawBox("dir");
      this.setPortrait(null);
      this.nameText.setText("");
      this.titleText.setText("");
      this.bodyText.setPosition(40, 384).setWordWrapWidth(W - 80).setFontStyle("normal").setColor("#b9bdd0");
      this.typeOut(shown.text);
      return;
    }
    opts.onSpeaker?.(rl.s, rl);
    this.drawBox("speech");
    const face = faceOf(rl.s);
    this.setPortrait(face);
    const hasPortrait = this.portrait.visible;
    const tx = hasPortrait ? 160 : 40;
    const def = CHARACTERS[face];
    const col = def ? def.color : face === "SANMIK" ? SANMIK_COLOR : null;
    this.nameText.setPosition(tx, 372).setText(face !== rl.s ? "SANMIK" : rl.speakerName).setColor(col !== null ? "#" + col.toString(16).padStart(6, "0") : "#ffd23f");
    const tag = rl.tag === "canon" ? "ARCHIVE QUOTE" : "";
    this.titleText.setPosition(tx, 393).setText([rl.speakerTitle, tag].filter(Boolean).join("  ·  "));
    this.bodyText
      .setPosition(tx, 412)
      .setWordWrapWidth(W - tx - 40)
      .setFontStyle("normal")
      .setColor("#ffffff");
    this.typeOut(shown.text);
  }
}

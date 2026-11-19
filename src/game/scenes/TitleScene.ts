import { canFullscreen, fullscreenLabel, toggleFullscreen } from "../systems/fullscreen";
import { clampDifficulty, MAX_DIFFICULTY } from "../systems/difficulty";
import Phaser from "phaser";
import { animateWalker, backdrop } from "../gfx/HD";
import { G } from "../G";
import { button, FONT, title, label, panel } from "../ui/theme";
import { synth } from "../audio/Synth";
import { continueRun, switchTo, fadeThen } from "../Flow";
import { formatPlaytime, slotLabel } from "../systems/saveSlots";
import { LADS } from "../../data/characters";

const LEAK = ["[citation needed]", "Seen by 9", "Hello?", "KREZZ", "Drongi", "WONK", "pls", "Krebon is coming", "lore withdrawn", "THE KREZZING HOUR", "Krez-ousers", "purple", "Big Bertha", "12 Midday", "cheesegate"];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  /**
   * FULLSCREEN (top right, or F): the whole screen. On an iPhone, where the browser won't do it, it tells you to
   * add the game to your home screen instead (it then opens with no browser bars). Hidden once you're
   * already running from the home screen.
   */
  private fullscreenButton() {
    const standalone = matchMedia?.("(display-mode: fullscreen)").matches || matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const { width: W, height: H } = this.scale;
    const iosHint = () => {
      const t = label(this, W / 2, H - 52, "On iPhone: tap Share  ⬆  then  \"Add to Home Screen\"  for full screen", 13, "#ffd23f").setOrigin(0.5, 0);
      this.tweens.add({ targets: t, alpha: 0, delay: 5000, duration: 600, onComplete: () => t.destroy() });
    };
    const flip = () => {
      if (!toggleFullscreen(this.game)) iosHint();
    };
    const tag = () => fullscreenLabel(this.game, canFullscreen(this.game) ? "  (F)" : "");
    const b = button(this, W - 150, 34, tag(), flip, { w: 280, h: 48, size: 18, color: 0x1e3a5f });
    const relabel = () => {
      const t = (b as unknown as { list?: Phaser.GameObjects.GameObject[] }).list?.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
      t?.setText(tag());
    };
    this.scale.on("enterfullscreen", relabel);
    this.scale.on("leavefullscreen", relabel);
    this.events.once("shutdown", () => (this.scale.off("enterfullscreen", relabel), this.scale.off("leavefullscreen", relabel)));
    this.input.keyboard?.on("keydown-F", flip);
    if (canFullscreen(this.game)) label(this, W - 150, 64, "Alt+Enter: fullscreen any time", 11, "#9aa0b4").setOrigin(0.5, 0);
  }

  create() {
    const { width: W, height: H } = this.scale;
    this.cameras.main.fadeIn(400);
    // sky
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a0f2e, 0x1a0f2e, 0x3a1f3e, 0x2a1a2e, 1);
    g.fillRect(0, 0, W, H);
    const titleBg = backdrop(this, "bg_title", { depth: -10 });
    if (titleBg) g.setVisible(false);
    // skyline
    g.fillStyle(0x120a1c, 1);
    for (let i = 0; i < 24; i++) {
      const bw = 30 + ((i * 37) % 50);
      const bh = 60 + ((i * 53) % 120);
      g.fillRect(i * 42 - 10, H - 90 - bh, bw, bh + 90);
    }
    g.fillStyle(0x0b0710, 1);
    g.fillRect(0, H - 90, W, 90);
    // The Tap silhouette
    this.add.image(W / 2, H - 120, "p_tap").setScale(2.2).setAlpha(0.9);
    // leaking wiki text
    for (let i = 0; i < 26; i++) {
      const t = this.add.text(Math.random() * W, Math.random() * H, LEAK[i % LEAK.length], { fontFamily: FONT, fontSize: `${10 + (i % 4) * 3}px`, color: "#8a7fb0" }).setAlpha(0.35);
      this.tweens.add({ targets: t, y: t.y + H, duration: 9000 + Math.random() * 9000, repeat: -1, onRepeat: () => (t.y = -20) });
    }
    // marching cabinet
    [...LADS, "MIKEY"].forEach((id, i) => {
      const s = this.add.sprite(-40 - i * 40, H - 70, `spr_${id}`, 0).setScale(2.5);
      this.tweens.add({ targets: s, x: W + 60, duration: 16000, delay: i * 500, repeat: -1 });
      this.time.addEvent({ delay: 180, loop: true, callback: () => animateWalker(s, 1, 0, true, this.time.now) });
    });
    const dr = this.add.sprite(W - 120, 150, "spr_DRONGUS", 0).setScale(3).setAlpha(0.85);
    this.tweens.add({ targets: dr, y: 140, yoyo: true, repeat: -1, duration: 1400, ease: "Sine.inOut" });
    this.add.text(W - 120, 92, "Seen by 9", { fontFamily: FONT, fontSize: "13px", color: "#9aa0b4" }).setOrigin(0.5);

    title(this, W / 2, 86, "KRELWORLD", 64, "#ffd23f");
    title(this, W / 2, 140, "WONK 'TIL YOU KREZ", 26, "#ff6fa8");
    label(this, W / 2, 168, "The craziest universe of all time…", 13, "#c9c3e6").setOrigin(0.5, 0);

    // CONTINUE: the newest of the AUTO and manual slots
    const latest = G.saves.latest();
    const sv = latest ? G.saves.load(latest) : null;
    const items: [string, () => void, boolean?][] = [];
    if (latest && sv) items.push([`CONTINUE · ${slotLabel(latest)} · CH ${sv.chapter} · ⏱ ${formatPlaytime(sv.playtimeMs)} · DIFF ${clampDifficulty(sv.difficulty)}/${MAX_DIFFICULTY}`, () => continueRun(this, latest) || undefined]);
    if (latest) items.push(["LOAD GAME", () => this.scene.launch("Slots", { mode: "load", caller: "Title" })]);
    // a new game takes over the AUTO slot (manual slots are never touched): say so if there's a run in it
    const auto = G.saves.load("auto");
    const fresh = (ngPlus: number) => () => {
      const go = () => fadeThen(this, 200, () => switchTo(this, "CharSelect", { ngPlus }));
      if (!auto) return go();
      this.confirmNew(`A new game replaces the AUTO save\n(CH ${auto.chapter} · ⏱ ${formatPlaytime(auto.playtimeMs)}).\nSLOT 1-3 are kept. Save to a slot first from the pause menu if you want to keep it.`, go);
    };
    items.push(["NEW GAME", fresh(0)]);
    if (G.meta.ngPlusUnlocked) items.push(["NEW KREZ+", fresh(1)]);
    // finished the game: jump to any chapter, side quest or boss with the kit you finished with
    if (G.meta.ngPlusUnlocked || G.meta.carry) items.push(["CHAPTER SELECT", () => fadeThen(this, 200, () => switchTo(this, "ChapterSelect"))]);
    items.push(["HISTORICAL ARCHIVE", () => fadeThen(this, 200, () => switchTo(this, "Archive", { fromTitle: true }))]);
    items.push(["SETTINGS", () => this.scene.launch("Menu", { mode: "settings", caller: "Title" })]);
    const gap = items.length > 6 ? 41 : 46;
    items.forEach(([t, fn], i) => button(this, W / 2, 218 + i * gap, t, fn, { w: i === 0 && latest ? 460 : 320, h: items.length > 6 ? 36 : 40, size: i === 0 && latest ? 15 : 17 }));
    // the debug menu: hidden from players. Shown on the dev server, or with ?debug on the end of the link.
    const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || new URLSearchParams(location.search).has("debug");
    if (dev) button(this, 90, 24, "🛠 DEBUG", () => switchTo(this, "DebugSkip"), { w: 140, h: 30, size: 13 });
    this.fullscreenButton();

    label(this, 12, H - 22, "WASD · Mouse · Click · Space · E · Q · B · R · Esc", 11, "#6d6a85");
    label(this, W - 12, H - 22, "v1.0 · No reactions were harmed", 11, "#6d6a85").setOrigin(1, 0);

    this.input.once("pointerdown", () => synth.unlock());
    this.input.keyboard?.once("keydown", () => synth.unlock());
    synth.music("title");
  }

  /** Yes / no over the title (NEW GAME when there's a run in the AUTO slot). Enter / Y = yes, Esc / N = no. */
  private confirmNew(text: string, yes: () => void) {
    const box = this.add.container(0, 0).setDepth(1000);
    const off = () => {
      this.input.keyboard?.off("keydown", onKey);
      box.destroy(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyY") {
        off();
        yes();
      } else if (e.code === "Escape" || e.code === "KeyN") off();
    };
    box.add(this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.6).setOrigin(0).setInteractive());
    box.add(panel(this, 210, 170, 540, 200));
    box.add(this.add.text(480, 230, text, { fontFamily: FONT, fontSize: "14px", color: "#ffffff", align: "center", fontStyle: "bold", wordWrap: { width: 500 } }).setOrigin(0.5));
    box.add(button(this, 390, 324, "NEW GAME", () => (off(), yes()), { w: 160, h: 34, size: 15, color: 0x7f1d1d }));
    box.add(button(this, 570, 324, "CANCEL", off, { w: 160, h: 34, size: 15 }));
    this.input.keyboard?.on("keydown", onKey);
  }
}

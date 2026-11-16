import Phaser from "phaser";
import { bindSanmikToggle, playerKey } from "../gfx/sanmikForm";
import { vfx } from "../gfx/Vfx";
import { G } from "../G";
import { Controls } from "../combat/Controls";
import { DialogueBox } from "../ui/DialogueBox";
import { switchTo } from "../Flow";
import { synth } from "../audio/Synth";
import { FONT, button, uiFrame } from "../ui/theme";
import { ShopGrid, shopTabs, type ShopItem } from "../ui/shop";
import { TOUCH } from "../ui/TouchControls";
import { GUNS } from "../../data/guns";
import { dir, say } from "../../content/dsl";
import { animateWalker } from "../gfx/HD";
import { CHARACTERS, LADS } from "../../data/characters";
import { DECOR } from "../../content/home";
import { INSULT, KRUNCHERS, KRUNCHER_BOAST, LOCAL_CHAT, PRIZE, PRIZES, SHOVES, WELCOME_SPEECH } from "../../content/kreddle";
import { addKrokens, awardPrize, kd, krokenPrice, krokens, prizeOpen, rollPrize, WHACK_COST } from "../systems/kreddle";
import type { Line } from "../../data/types";
import { maxHp } from "../systems/stats";
import { KreddleRaid, RAID_ART } from "./kreddle/Raid";

/**
 * KREDDLE: the casino/arcade universe over the bridge. Always night. Always neon.
 * Walk the Strip, play the machines, get shoved by the locals, meet the Kreddle Krunchers.
 */

const W = 2600;
const H = 700;
const TOP = 430;
const BOTTOM = 680;

type NpcKind = "citizen" | "kruncher" | "pitboss" | "klerble" | "dealer";
interface Npc {
  spr: Phaser.GameObjects.Sprite;
  kind: NpcKind;
  name: string;
  tag?: Phaser.GameObjects.Text;
  home: { x: number; y: number };
  target: { x: number; y: number };
  nextTurn: number;
  charging?: boolean;
  of?: string;
  jab?: string;
}
interface Spot {
  x: number;
  y: number;
  r: number;
  label: () => string;
  use: () => void;
}

const NEON = [0xff4fd8, 0x22d3ee, 0xfacc15, 0xa855f7, 0x4ade80];

export class KreddleScene extends Phaser.Scene {
  private controls!: Controls;
  private box!: DialogueBox;
  private me!: Phaser.GameObjects.Sprite;
  private prompt!: Phaser.GameObjects.Text;
  private busy = false;
  private npcs: Npc[] = [];
  private spots: Spot[] = [];
  private nextShove = 0;
  private nextTaunt = 0;
  private gambled = false;
  private panelRoot: Phaser.GameObjects.Container | null = null;
  private panelKeys: [string, (...a: any[]) => void][] = [];
  private panelTick: Phaser.Time.TimerEvent | null = null;
  private coinText!: Phaser.GameObjects.Text;
  /** When the last machine was closed (so the ESC that closed it doesn't also walk you out). */
  private closedAt = 0;
  private wantPrizes = false;
  /** Chapter 6: the raid (entered with `{ raid: true }`) replaces everything else in the scene. */
  private raid: KreddleRaid | null = null;

  constructor() {
    super("Kreddle");
  }

  preload() {
    // the raid's art, if this build's manifest doesn't list it yet
    if (!(this.sys.settings.data as { raid?: boolean } | undefined)?.raid) return;
    for (const k of RAID_ART) if (!this.textures.exists(k)) this.load.image(k, `art/props/${k}.png`);
  }

  create(data?: { raid?: boolean }) {
    const s = G.s;
    this.busy = false;
    this.raid = null;
    if (data?.raid) {
      this.raid = new KreddleRaid(this);
      this.raid.create();
      return;
    }
    synth.ambience("casino");
    this.npcs = [];
    this.spots = [];
    this.gambled = false;
    this.panelRoot = null;
    this.panelKeys = [];
    this.cameras.main.fadeIn(400);
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.setBackgroundColor(0x0b0618);
    this.drawWorld();
    this.drawStrip();
    this.spawnPeople();
    this.me = this.add.sprite(110, 560, playerKey(this), 0).setScale(2).setDepth(560);
    bindSanmikToggle(this, { sprites: () => [this.me], can: () => !this.busy });
    this.me.setData("facing", "east");
    this.cameras.main.startFollow(this.me, true, 0.1, 0.1);
    this.prompt = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", backgroundColor: "#1a0b24dd", padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(3000).setVisible(false);
    this.coinText = this.add.text(950, 10, "", { fontFamily: FONT, fontSize: "15px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(1, 0).setScrollFactor(0).setDepth(4000);
    this.controls = new Controls(this);
    // back from the Krezzcoin counter (the Menu scene)
    this.events.off("ui-resume");
    this.events.on("ui-resume", () => {
      this.busy = false;
      this.controls.swallow();
      if (this.wantPrizes) {
        this.wantPrizes = false;
        this.prizeCounter();
      }
    });
    // back from Whack-a-Drongus: a go on the cabinet counts as gambling
    this.events.off("whack-played");
    this.events.on("whack-played", () => (this.gambled = true));
    this.events.off("open-prizes");
    this.events.on("open-prizes", () => (this.wantPrizes = true));
    this.box = new DialogueBox(this, 6000, 0.2);
    if (!this.scene.isActive("UI")) this.scene.launch("UI", { mode: "hub" });
    else this.scene.get("UI").events.emit("mode", "hub");
    synth.music("kreddle", true);
    this.nextShove = this.time.now + 9000;
    this.time.delayedCall(500, () => void this.arrive());
  }

  // ------------------------------------------------------------------ the place

  private drawWorld() {
    // the sky: a neon skyline, fixed behind everything, with searchlights
    if (this.textures.exists("bg_kreddle_sky")) {
      const sky = this.add.image(480, 0, "bg_kreddle_sky").setOrigin(0.5, 0).setScrollFactor(0.15, 0).setDepth(-30);
      sky.setScale(Math.max(1200 / sky.width, 380 / sky.height));
    } else this.add.rectangle(480, 190, 960, 380, 0x1a0b3a).setScrollFactor(0).setDepth(-30);
    for (let i = 0; i < 4; i++) {
      const beam = this.add.triangle(160 + i * 220, 400, 0, 0, -40, -520, 40, -520, NEON[i % NEON.length], 0.12).setOrigin(0, 0).setScrollFactor(0.2, 0).setDepth(-25).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: beam, angle: { from: -25, to: 25 }, yoyo: true, repeat: -1, duration: 2600 + i * 700, ease: "Sine.inOut" });
    }
    // the street: dark tarmac, a pavement of light-up tiles, neon puddles
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x140a24, 1).fillRect(0, 400, W, H - 400);
    // wet neon tarmac (PixelLab, tiles seamlessly); the flat fill above is the fallback
    if (this.textures.exists("kd_tarmac")) this.add.tileSprite(0, 446, W, H - 446, "kd_tarmac").setOrigin(0).setDepth(1).setAlpha(0.9);
    g.setDepth(0.5);
    g.fillStyle(0x23123d, 1).fillRect(0, 400, W, 46);
    for (let x = 0; x < W; x += 46) g.lineStyle(1, 0x3b1d63, 1).strokeRect(x, 400, 46, 46);
    const g2 = this.add.graphics().setDepth(1.5);
    g2.lineStyle(3, 0xff4fd8, 0.55).lineBetween(0, 446, W, 446);
    for (let x = 40; x < W; x += 160) g2.fillStyle(0xfacc15, 0.6).fillRect(x, 590, 70, 6);
    for (let i = 0; i < 26; i++) {
      const p = this.add.ellipse(80 + Math.random() * (W - 160), 470 + Math.random() * 200, 50 + Math.random() * 70, 10 + Math.random() * 8, NEON[i % NEON.length], 0.12).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: p, alpha: 0.04, yoyo: true, repeat: -1, duration: 900 + Math.random() * 1400 });
    }
    // the bridge home, at the west end
    if (this.textures.exists("kd_bridge")) {
      // the steel footbridge (PixelLab), running off the west edge, with a cyan glow under its neon rails
      const br = this.add.image(196, 560, "kd_bridge").setOrigin(1, 0.5).setScale(1.7).setDepth(3);
      const glow = this.add.ellipse(br.x - br.displayWidth / 2, 600, br.displayWidth, 22, 0x22d3ee, 0.18).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.06, yoyo: true, repeat: -1, duration: 1300 });
    } else {
      const b = this.add.graphics().setDepth(3);
      b.fillStyle(0x3f3f46, 1).fillRect(0, 480, 150, 120);
      for (let x = 0; x < 150; x += 18) b.fillStyle(0x52525b, 1).fillRect(x, 480, 14, 120);
      b.lineStyle(4, 0x22d3ee, 0.9).lineBetween(0, 478, 150, 478).lineBetween(0, 602, 150, 602);
    }
    this.add.text(75, 452, "← KRELWORLD\n(the boring bit)", { fontFamily: FONT, fontSize: "11px", color: "#22d3ee", align: "center", fontStyle: "bold" }).setOrigin(0.5, 1).setDepth(4);
    this.spots.push({ x: 60, y: 545, r: 70, label: () => "E: Cross the bridge back to Krelworld", use: () => void this.leave() });
  }

  private neonSign(x: number, y: number, text: string, color: string, size = 26) {
    const t = this.add.text(x, y, text, { fontFamily: "Impact, sans-serif", fontSize: `${size}px`, color, stroke: "#12001f", strokeThickness: 6 }).setOrigin(0.5).setDepth(450);
    t.setShadow(0, 0, color, 16, true, true);
    // the odd flicker
    this.time.addEvent({ delay: 1200 + Math.random() * 2400, loop: true, callback: () => {
      if (Math.random() < 0.5) return;
      t.setAlpha(0.25);
      this.time.delayedCall(70, () => t.setAlpha(1));
      this.time.delayedCall(140, () => t.setAlpha(0.4));
      this.time.delayedCall(200, () => t.setAlpha(1));
    } });
    return t;
  }

  private building(key: string, x: number, scale: number, sign: string, color: string, tint?: number) {
    const img = this.add.image(x, 404, key).setOrigin(0.5, 1).setScale(scale).setDepth(400);
    if (tint) img.setTint(tint);
    this.neonSign(x, 404 - img.displayHeight - 18, sign, color);
    // marquee bulbs along the front
    for (let i = 0; i < 9; i++) {
      const bx = x - img.displayWidth / 2 + 10 + (i * (img.displayWidth - 20)) / 8;
      const bulb = this.add.circle(bx, 412, 3, 0xfff3b0).setDepth(401);
      this.tweens.add({ targets: bulb, alpha: 0.2, yoyo: true, repeat: -1, duration: 300, delay: i * 90 });
    }
    return img;
  }

  private machine(key: string, x: number, y: number, scale: number) {
    const m = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(y);
    const glow = this.add.ellipse(x, y, m.displayWidth * 1.2, 18, 0xff4fd8, 0.25).setDepth(y - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.08, yoyo: true, repeat: -1, duration: 700 + Math.random() * 500 });
    return m;
  }

  private drawStrip() {
    const s = G.s;
    this.neonSign(1300, 40, "★ WELCOME TO KREDDLE ★", "#ff4fd8", 34).setScrollFactor(0.15, 1).setDepth(-20);
    // THE KREDDLE EXCHANGE: first thing off the bridge, so you can shop without walking the whole Strip
    const EX = { x: 352, y: 505 };
    if (this.textures.exists("kd_exchange")) {
      // the Exchange kiosk (PixelLab): its own sign says EXCHANGE, the neon one over it says whose
      const kiosk = this.add.image(EX.x, EX.y, "kd_exchange").setOrigin(0.5, 1).setScale(1.3).setDepth(EX.y);
      const glow = this.add.ellipse(EX.x, EX.y, kiosk.displayWidth * 1.1, 20, 0xfacc15, 0.25).setDepth(EX.y - 1).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.08, yoyo: true, repeat: -1, duration: 900 });
      this.neonSign(EX.x, EX.y - kiosk.displayHeight - 14, "THE KREDDLE EXCHANGE", "#facc15", 16).setDepth(EX.y + 1);
    } else {
      const counter = this.add.rectangle(EX.x, EX.y - 45, 120, 84, 0x2e1065).setStrokeStyle(3, 0xfacc15).setDepth(EX.y);
      this.add.text(counter.x, counter.y, "🏆\nTHE KREDDLE\nEXCHANGE\n🎟 · 💰", { fontFamily: FONT, fontSize: "11px", color: "#facc15", align: "center", fontStyle: "bold" }).setOrigin(0.5).setDepth(EX.y + 1);
    }
    this.spots.push({ x: EX.x, y: EX.y + 35, r: 85, label: () => `E: THE KREDDLE EXCHANGE (🎟 ${krokens(G.s)} Krokens · 💰 ${G.s.coins} Krezzcoin)`, use: () => this.exchange() });
    // THE ARCADE + the slots
    this.building("kd_bld_arcade", 622, 1.6, "KRAZY KREDDLE ARCADE", "#facc15");
    for (let i = 0; i < 4; i++) this.machine("kd_m_slots", 495 + i * 85, 500, 1.15);
    this.spots.push({ x: 622, y: 520, r: 150, label: () => "E: KRAZY REELS (slots) · 150 Krezzcoin a spin", use: () => this.slots() });
    // THE CASINO + the claws
    this.building("kd_bld_casino", 980, 1.6, "THE GOLDEN KLAW CASINO", "#22d3ee");
    for (let i = 0; i < 3; i++) this.machine("kd_m_claw", 890 + i * 90, 505, 1.05);
    this.spots.push({ x: 980, y: 525, r: 140, label: () => "E: THE KLAW (claw machine) · 200 Krezzcoin a go", use: () => this.claw() });
    // THE WHEEL
    this.machine("kd_m_wheel", 1300, 540, 1.7);
    this.neonSign(1300, 335, "WHEEL OF KREDDLE", "#a855f7", 22).setDepth(560);
    this.spots.push({ x: 1300, y: 560, r: 110, label: () => "E: WHEEL OF KREDDLE · 300 Krezzcoin a spin", use: () => this.wheel() });
    // WHACK-A-DRONGUS: the arcade's newest cabinet, in the gap between the Wheel and the Klerble Grand
    this.whackCabinet(1462, 522);
    // THE KLERBLE GRAND
    this.building("kd_bld_hotel", 1620, 1.6, "THE KLERBLE GRAND", "#facc15");
    // KREDDLE KARDS
    this.machine("kd_m_cards", 1950, 600, 1.5);
    this.neonSign(1950, 470, "KREDDLE KARDS", "#4ade80", 20).setDepth(470);
    this.spots.push({ x: 1950, y: 620, r: 110, label: () => "E: KREDDLE KARDS (higher or lower) · 150 Krezzcoin a deal", use: () => this.cards() });
    // KRUNCHER HQ
    this.building("kd_bld_arcade", 2300, 1.6, "KREDDLE KRUNCHERS HQ", "#ff4fd8", 0x9be7ff);
    void s;
  }

  private whackCabinet(x: number, y: number) {
    const anim = this.textures.exists("kd_m_whack_anim");
    const key = anim ? "kd_m_whack_anim" : this.textures.exists("kd_m_whack") ? "kd_m_whack" : "kd_m_slots";
    const cab = this.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(1.25).setDepth(y);
    if (anim) {
      if (!this.anims.exists("kd_m_whack_anim")) this.anims.create({ key: "kd_m_whack_anim", frames: this.anims.generateFrameNumbers("kd_m_whack_anim", {}), frameRate: 7, repeat: -1 });
      cab.play("kd_m_whack_anim");
    }
    const glow = this.add.ellipse(x, y, cab.displayWidth * 1.25, 18, 0x4ade80, 0.3).setDepth(y - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.08, yoyo: true, repeat: -1, duration: 600 });
    this.neonSign(x, y - cab.displayHeight - 14, "WHACK-A-DRONGUS", "#4ade80", 17).setDepth(y + 1);
    this.spots.push({ x, y: y + 22, r: 78, label: () => `E: WHACK-A-DRONGUS · ${WHACK_COST} Krezzcoin a go (high score ${(G.s.flags.whack_hi as number) ?? 0})`, use: () => this.whack() });
  }

  /** Over to the Whack-a-Drongus cabinet (its own scene, over a paused Kreddle). */
  private whack() {
    this.busy = true;
    this.scene.launch("Whack");
    this.scene.pause();
  }

  private spawnPeople() {
    const s = G.s;
    const add = (key: string, x: number, y: number, kind: NpcKind, name: string, extra: Partial<Npc> = {}) => {
      const tex = this.textures.exists(key) ? key : "spr_FOLK1";
      const spr = this.add.sprite(x, y, tex, 0).setScale(2).setDepth(y);
      const tag = this.add.text(x, y + 34, name, { fontFamily: FONT, fontSize: "9px", color: "#ffd1f3", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(y + 1);
      const n: Npc = { spr, kind, name, tag, home: { x, y }, target: { x, y }, nextTurn: 0, ...extra };
      this.npcs.push(n);
      return n;
    };
    // the Pit Boss watches the bridge: no gambling, no leaving
    add("spr_KD_PITBOSS", 240, 520, "pitboss", "PIT BOSS");
    // President Klerble, outside his hotel
    add("spr_TV_PRESIDENT_KLERBLE", 1620, 470, "klerble", "PRESIDENT KLERBLE");
    // the Kards dealer
    const dealer = add("spr_KD_PITBOSS", 1950, 545, "dealer", "THE DEALER");
    dealer.spr.setTint(0xffe27a);
    // the locals
    for (let i = 0; i < 12; i++) {
      const key = ["spr_KD_MAN", "spr_KD_WOMAN"][i % 2];
      const n = add(key, 300 + Math.random() * (W - 600), TOP + 30 + Math.random() * (BOTTOM - TOP - 40), "citizen", "KREDDLER");
      if (i % 3 === 2) n.spr.setTint(NEON[i % NEON.length] | 0x808080);
    }
    // THE KREDDLE KRUNCHERS: the lads, but Kreddle
    KRUNCHERS.forEach((k, i) => {
      if (!this.textures.exists(`spr_${k.of}`)) return;
      const x = 2080 + (i % 5) * 80;
      const y = 560 + Math.floor(i / 5) * 70 + (i % 2) * 10;
      const n = add(`spr_${k.of}`, x, y, "kruncher", k.name, { of: k.of, jab: k.jab });
      n.spr.setTint(i % 2 ? 0xff9de6 : 0x9be7ff);
      n.spr.setData("facing", "west");
    });
    this.add.text(2240, 690, "THE KREDDLE KRUNCHERS", { fontFamily: "Impact, sans-serif", fontSize: "16px", color: "#ff4fd8", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(700);
    void s;
    void LADS;
  }

  // ------------------------------------------------------------------ arriving and leaving

  private async arrive() {
    const s = G.s;
    s.flags.kreddle_visits = ((s.flags.kreddle_visits as number) ?? 0) + 1;
    if (s.flags.kreddle_seen) return;
    s.flags.kreddle_seen = true;
    const t = this.add.text(480, 200, "WELCOME TO\nKREDDLE", { fontFamily: "Impact, sans-serif", fontSize: "64px", color: "#ff4fd8", align: "center", stroke: "#12001f", strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(5000).setScale(0.2);
    t.setShadow(0, 0, "#ff4fd8", 24, true, true);
    synth.play("cheer");
    this.tweens.add({ targets: t, scale: 1, duration: 500, ease: "Back.out" });
    await this.wait(1800);
    this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() });
    await this.talk([
      dir("You cross the bridge. Behind you: Krelford, in daylight, being normal. Ahead of you: Kreddle. It is night. It is always night in Kreddle."),
      dir("Every surface is a light. Every light is a sign. Every sign is asking for money."),
      dir("TIP: talk to the locals (E). Play the machines. Win things. And whatever you do, gamble at least once before you leave."),
    ]);
  }

  private async leave() {
    if (this.busy || this.panelRoot) return;
    const s = G.s;
    if (!this.gambled) {
      // the third rule of Kreddle
      const boss = this.npcs.find((n) => n.kind === "pitboss");
      if (boss) {
        this.busy = true;
        await new Promise<void>((r) => this.tweens.add({ targets: boss.spr, x: this.me.x + 50, y: this.me.y, duration: 500, onComplete: () => r() }));
        this.busy = false;
      }
      await this.talk([say("PIT BOSS", "Leaving? Without gambling?"), say("PIT BOSS", "That's the third rule. You must gamble. You did not gamble."), dir("You are arrested and lashed.")]);
      for (let i = 0; i < 3; i++) {
        synth.play("punch_big");
        this.cameras.main.flash(160, 220, 0, 0);
        this.cameras.main.shake(200, 0.012);
        const t = this.add.text(this.me.x, this.me.y - 60 - i * 18, "LASHED!", { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#ef4444", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(3000);
        this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 900, onComplete: () => t.destroy() });
        await this.wait(380);
      }
      const fine = Math.min(s.coins, 100);
      s.coins -= fine;
      s.hp = Math.max(1, s.hp - Math.round(maxHp(s) * 0.1));
      await this.talk([dir(`Three lashes. With a wet lanyard. It really stings. They also take ${fine} Krezzcoin for the lanyard.`), say("PIT BOSS", `Come back when you're ready to gamble, ${INSULT}.`)]);
    }
    this.busy = true;
    G.save();
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => switchTo(this, "Hub", { at: "KREDDLE_BRIDGE" }));
  }

  // ------------------------------------------------------------------ the loop

  update(time: number, delta: number) {
    if (this.raid) {
      this.raid.update(time, delta);
      return;
    }
    const s = G.s;
    const dt = Math.min(delta, 50);
    this.coinText.setText(`💰 ${s.coins}   🎟 ${krokens(s)}`);
    this.updateNpcs(time, dt);
    if (this.busy || this.panelRoot) {
      this.prompt.setVisible(false);
      animateWalker(this.me, 0, 0, false, time);
      return;
    }
    if (this.controls.pause() && time - this.closedAt > 500) {
      void this.leave();
      return;
    }
    const mv = this.controls.move();
    const sp = 230 * (dt / 1000);
    this.me.x = Phaser.Math.Clamp(this.me.x + mv.x * sp, 30, W - 30);
    this.me.y = Phaser.Math.Clamp(this.me.y + mv.y * sp, TOP, BOTTOM);
    this.me.setDepth(this.me.y);
    animateWalker(this.me, mv.x, mv.y, Math.hypot(mv.x, mv.y) > 0.1, time);
    // what's in reach
    let best: { label: string; use: () => void; d: number } | null = null;
    for (const sp2 of this.spots) {
      const d = Phaser.Math.Distance.Between(this.me.x, this.me.y, sp2.x, sp2.y);
      if (d < sp2.r && (!best || d < best.d)) best = { label: sp2.label(), use: sp2.use, d };
    }
    // a machine or counter in reach always wins over a chat (a wandering local shouldn't steal the E from a game)
    for (const n of best ? [] : this.npcs) {
      // the Kards dealer just deals: standing at his table means the game, not a chat
      if (n.kind === "dealer") continue;
      const d = Phaser.Math.Distance.Between(this.me.x, this.me.y, n.spr.x, n.spr.y);
      if (d < 60 && (!best || d < best.d)) best = { label: `E: Talk to ${n.name}`, use: () => void this.talkTo(n), d };
    }
    if (best) {
      this.prompt.setText(best.label).setPosition(this.me.x, this.me.y - 56).setVisible(true);
      if (this.controls.interact()) best.use();
    } else {
      this.prompt.setVisible(false);
      this.controls.interact();
    }
  }

  private updateNpcs(time: number, dt: number) {
    for (const n of this.npcs) {
      const spr = n.spr;
      if (n.kind === "kruncher" || n.kind === "dealer" || n.kind === "pitboss") {
        // they stand about, swaying, facing you when you're near
        const near = Phaser.Math.Distance.Between(spr.x, spr.y, this.me.x, this.me.y) < 260;
        if (near) animateWalker(spr, this.me.x - spr.x, this.me.y - spr.y, false, time);
        spr.y = n.home.y + Math.sin(time / 400 + n.home.x) * 1.5;
        n.tag?.setPosition(spr.x, spr.y + 34);
        continue;
      }
      if (n.kind === "klerble") {
        spr.y = n.home.y - Math.abs(Math.sin(time / 260)) * 6;
        n.tag?.setPosition(spr.x, n.home.y + 34);
        if (Math.random() < 0.002 && !this.busy) this.bubble(spr, "YES! YES! YESSS!", "#ffd23f");
        continue;
      }
      // citizens wander, and now and then one comes over to shove you
      let speed = 70;
      if (n.charging) {
        n.target = { x: this.me.x, y: this.me.y };
        speed = 300;
        if (Phaser.Math.Distance.Between(spr.x, spr.y, this.me.x, this.me.y) < 38) this.shove(n);
      } else if (time > n.nextTurn || Phaser.Math.Distance.Between(spr.x, spr.y, n.target.x, n.target.y) < 8) {
        n.nextTurn = time + 2000 + Math.random() * 4000;
        n.target = { x: Phaser.Math.Clamp(spr.x + (Math.random() - 0.5) * 500, 200, W - 200), y: TOP + 20 + Math.random() * (BOTTOM - TOP - 30) };
      }
      const dx = n.target.x - spr.x;
      const dy = n.target.y - spr.y;
      const len = Math.hypot(dx, dy);
      if (len > 4) {
        spr.x += (dx / len) * speed * (dt / 1000);
        spr.y += (dy / len) * speed * (dt / 1000);
        spr.y = Phaser.Math.Clamp(spr.y, TOP, BOTTOM);
      }
      spr.setDepth(spr.y);
      animateWalker(spr, dx, dy, len > 4, time);
      // a little bounce in their step
      spr.setAngle(len > 4 ? Math.sin(time / 90 + n.home.x) * 4 : 0);
      n.tag?.setPosition(spr.x, spr.y + 34);
    }
    if (this.busy || this.panelRoot) return;
    // someone takes a run at you
    if (time > this.nextShove) {
      this.nextShove = time + 6000 + Math.random() * 7000;
      const cand = this.npcs.filter((n) => n.kind === "citizen" && !n.charging && Phaser.Math.Distance.Between(n.spr.x, n.spr.y, this.me.x, this.me.y) < 420);
      const n = cand[Math.floor(Math.random() * cand.length)];
      if (n) n.charging = true;
    }
    // the Krunchers heckle you when you're close
    if (time > this.nextTaunt && this.me.x > 1800) {
      this.nextTaunt = time + 3500 + Math.random() * 3000;
      const ks = this.npcs.filter((n) => n.kind === "kruncher");
      const k = ks[Math.floor(Math.random() * ks.length)];
      if (k) this.bubble(k.spr, Phaser.Utils.Array.GetRandom(["WE HATE YOU!", "KRUNCHERS RULE!", "Krelworld krew? More like Krelworld POO.", "Go home!", `${INSULT}!`, "Lame!", "Our chat has MORE reactions!"]), "#ffd1f3");
    }
  }

  private shove(n: Npc) {
    n.charging = false;
    n.nextTurn = 0;
    const s = G.s;
    const a = Math.atan2(this.me.y - n.spr.y, this.me.x - n.spr.x);
    synth.play("punch");
    this.cameras.main.shake(160, 0.006);
    this.tweens.add({ targets: this.me, x: Phaser.Math.Clamp(this.me.x + Math.cos(a) * 80, 30, W - 30), y: Phaser.Math.Clamp(this.me.y + Math.sin(a) * 60, TOP, BOTTOM), duration: 180, ease: "Quad.out" });
    this.bubble(n.spr, Phaser.Utils.Array.GetRandom(SHOVES), "#ffffff");
    if (s.coins >= 5 && Math.random() < 0.3) {
      s.coins -= 5;
      this.floatText(this.me.x, this.me.y - 50, "-5 KREZZCOIN (pickpocketed)", "#ef4444");
    }
  }

  // ------------------------------------------------------------------ people

  private async talkTo(n: Npc) {
    const s = G.s;
    n.charging = false;
    const lines: Line[] = [];
    if (n.kind === "citizen") {
      if (!s.flags.kreddle_welcomed) {
        s.flags.kreddle_welcomed = true;
        lines.push(...WELCOME_SPEECH);
      } else lines.push(...Phaser.Utils.Array.GetRandom(LOCAL_CHAT));
    } else if (n.kind === "kruncher") {
      lines.push(say(n.name, KRUNCHER_BOAST), say(n.name, n.jab ?? "We hate you!"));
      if (n.of === s.player) lines.push(dir(`${n.name} is you. A bit. The Kreddle version. They've got better shoes.`));
      else lines.push(dir(`${n.name} looks exactly like ${CHARACTERS[n.of as keyof typeof CHARACTERS]?.name ?? n.of}, if ${CHARACTERS[n.of as keyof typeof CHARACTERS]?.name ?? n.of} had been raised in a casino.`));
    } else if (n.kind === "pitboss") {
      lines.push(
        say("PIT BOSS", this.gambled ? "You've gambled. Good. You may leave whenever you like. Kreddle will miss your money." : "I'm watching you. You haven't gambled yet."),
        ...(this.gambled ? [] : [say("PIT BOSS", "Try to cross that bridge without gambling and you'll be arrested and lashed. Rule three.")]),
      );
    } else if (n.kind === "dealer") {
      lines.push(say("THE DEALER", "Kreddle Kards. Higher or lower. Three right and you win a prize. The House wins ties. The House wins most things."));
    } else if (n.kind === "klerble") {
      lines.push(
        ...(s.flags.arc_klerble_done
          ? [say("PRESIDENT KLERBLE", "YOU! The one who flew the plane into his OWN tower! YES! YES! In Kreddle you are a hero!"), say("PRESIDENT KLERBLE", `Still a ${INSULT}, though. Grrr!!`)]
          : [say("PRESIDENT KLERBLE", "I am President Klerble! Welcome to my glorious Kreddle!"), say("PRESIDENT KLERBLE", "I hate your universe and everyone in it! Have you tried the slots? YES!")]),
      );
    }
    await this.talk(lines);
  }

  // ------------------------------------------------------------------ the machines: shared

  private openPanel(title: string, color: string) {
    this.busy = true;
    const root = this.add.container(0, 0).setDepth(5000);
    this.panelRoot = root;
    root.add(this.add.rectangle(480, 270, 960, 540, 0x05010c, 0.78).setInteractive());
    const frame = this.add.rectangle(480, 270, 760, 470, 0x16072b, 0.97).setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(color).color);
    root.add(frame);
    // the PixelLab window frame, tinted to the machine's neon
    const art = uiFrame(this, 480, 270, 760, 470, "ui_panel");
    if (art) {
      frame.setFillStyle(0x16072b, 0.6).setStrokeStyle(0);
      root.add(art.setTint(Phaser.Display.Color.HexStringToColor(color).color | 0x404040));
    }
    const t = this.add.text(480, 58, title, { fontFamily: "Impact, sans-serif", fontSize: "34px", color, stroke: "#12001f", strokeThickness: 6 }).setOrigin(0.5);
    t.setShadow(0, 0, color, 14, true, true);
    root.add(t);
    const coins = this.add.text(850, 80, "", { fontFamily: FONT, fontSize: "20px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(1, 0.5);
    root.add(coins);
    const upd = () => coins.setText(`💰 ${G.s.coins}   🎟 ${krokens(G.s)}`);
    this.panelTick = this.time.addEvent({ delay: 100, loop: true, callback: upd });
    upd();
    this.pin(root);
    return root;
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.panelRoot?.add(o);
    this.pin(o);
    return o;
  }

  /** Fix something (and everything inside it) to the screen, for drawing AND for taps. */
  private pin(o: Phaser.GameObjects.GameObject) {
    (o as unknown as { setScrollFactor?: (x: number, y?: number) => void }).setScrollFactor?.(0, 0);
    if (o instanceof Phaser.GameObjects.Container) for (const c of o.list) this.pin(c);
  }

  private btn(x: number, y: number, label: string, fn: () => void, w = 170, color?: number, h = 40) {
    const b = button(this, x, y, label, fn, { w, h, size: 15, color });
    this.panelRoot?.add(b);
    this.pin(b);
    return b;
  }

  private key(name: string, fn: (...a: any[]) => void) {
    const k = `keydown-${name}`;
    this.input.keyboard?.on(k, fn);
    this.panelKeys.push([k, fn]);
  }

  private closePanel() {
    for (const [k, fn] of this.panelKeys) this.input.keyboard?.off(k, fn);
    this.panelKeys = [];
    this.panelTick?.remove();
    this.panelTick = null;
    this.panelRoot?.destroy(true);
    this.panelRoot = null;
    this.busy = false;
    this.closedAt = this.time.now;
    this.controls.swallow();
  }

  /** Take the stake. False (and a sneer) if you can't afford it. */
  private pay(cost: number, info: Phaser.GameObjects.Text) {
    const s = G.s;
    if (s.coins < cost) {
      info.setText(`You need ${cost} Krezzcoin. You have ${s.coins}. The House laughs at you.`).setColor("#ef4444");
      synth.play("tap_fail");
      return false;
    }
    s.coins -= cost;
    this.gambled = true;
    s.flags.kreddle_gambles = ((s.flags.kreddle_gambles as number) ?? 0) + 1;
    synth.play("coin");
    return true;
  }

  /** The big reveal. Resolves when you dismiss it. */
  private showPrize(id: string) {
    return new Promise<void>((resolve) => {
      const s = G.s;
      const p = PRIZE[id];
      const text = awardPrize(s, id);
      G.save();
      synth.play("cheer");
      synth.play("perfect");
      this.cameras.main.flash(250, 255, 120, 220);
      const root = this.add.container(0, 0).setDepth(7000);
      root.add(this.add.rectangle(480, 270, 960, 540, 0x000000, 0.6).setInteractive());
      const card = this.add.rectangle(480, 270, 560, 300, 0x2e1065, 1).setStrokeStyle(5, 0xfacc15);
      root.add(card);
      const head = this.add.text(480, 150, "★ YOU WON ★", { fontFamily: "Impact, sans-serif", fontSize: "38px", color: "#facc15", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5);
      head.setShadow(0, 0, "#facc15", 16, true, true);
      const icon = this.add.text(480, 222, p.icon, { fontSize: "64px" }).setOrigin(0.5);
      const name = this.add.text(480, 290, p.name, { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#ff4fd8", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
      const desc = this.add.text(480, 345, text.replace(`${p.name}: `, "").replace(/^\(level[^)]*\): /, ""), { fontFamily: FONT, fontSize: "14px", color: "#ffffff", align: "center", wordWrap: { width: 500 } }).setOrigin(0.5);
      const hint = this.add.text(480, 405, "SPACE / tap to collect", { fontFamily: FONT, fontSize: "12px", color: "#c4b5fd" }).setOrigin(0.5);
      root.add([head, icon, name, desc, hint]);
      // drawn confetti (PixelLab VFX), the rectangles are the fallback
      const conf = [0, 1, 2].map((i) => vfx(this, "vfx_confetti", 300 + i * 180, 300, { scale: 2.4, fixed: true, depth: 7000, delay: i * 160 })).filter((c): c is Phaser.GameObjects.Sprite => !!c);
      for (let i = 0; i < (conf.length ? 0 : 40); i++) {
        const c = this.add.rectangle(480, 270, 6, 10, NEON[i % NEON.length]);
        root.add(c);
        this.tweens.add({ targets: c, x: 480 + (Math.random() - 0.5) * 900, y: 270 + (Math.random() - 0.7) * 600, angle: Math.random() * 720, alpha: 0, duration: 1400 + Math.random() * 800 });
      }
      this.tweens.add({ targets: icon, scale: { from: 0.3, to: 1 }, duration: 400, ease: "Back.out" });
      this.pin(root);
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        this.input.keyboard?.off("keydown-SPACE", close);
        this.input.keyboard?.off("keydown-E", close);
        root.destroy(true);
        resolve();
      };
      this.time.delayedCall(500, () => {
        this.input.keyboard?.on("keydown-SPACE", close);
        this.input.keyboard?.on("keydown-E", close);
        (root.list[0] as Phaser.GameObjects.Rectangle).on("pointerdown", close);
      });
    });
  }


  // ------------------------------------------------------------------ KRAZY REELS (slots)

  /**
   * Three reels that roll down and stop left to right. Two on the line and the last reel hangs (bulbs racing, a
   * rising charge), and sometimes the match creeps to just above the line and slides back off: the classic
   * staggered-stop / near-miss presentation, played for laughs. A real win lights the whole cabinet up.
   */
  private slots() {
    const COST = 150;
    // the six symbols: PixelLab icons, emoji where the art's missing. Index 3 is the 7 (the jackpot).
    const SYM = ["🍒", "🔔", "💎", "7️⃣", "🍋", "⭐"];
    const ART = ["kd_sym_cherry", "kd_sym_bell", "kd_sym_diamond", "kd_sym_seven", "kd_sym_lemon", "kd_sym_star"];
    const root = this.openPanel("KRAZY REELS", "#facc15");
    const STEP = 92; // px between symbols on a reel
    const RX = [330, 480, 630];
    const RY = 236;
    // the cabinet: a chasing ring of bulbs round the reels, and the payline across them
    const bulbs: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 28; i++) {
      const side = i < 10 ? 0 : i < 14 ? 1 : i < 24 ? 2 : 3;
      const k = side === 0 ? i : side === 1 ? i - 10 : side === 2 ? i - 14 : i - 24;
      const x = side === 0 ? 236 + k * 55 : side === 1 ? 724 : side === 2 ? 724 - k * 55 : 236;
      const y = side === 0 ? 150 : side === 1 ? 172 + k * 43 : side === 2 ? 322 : 300 - k * 43;
      bulbs.push(this.add2(this.add.circle(x, y, 5, 0xfff3b0)));
    }
    let chase = 0;
    let chaseFast = false;
    const reels = RX.map((x) => {
      this.add2(this.add.rectangle(x, RY, 128, 150, 0xfff7e6).setStrokeStyle(5, 0xb45309));
      // three faces on show (one above, one on the line, one below), masked to the window
      const faces = [-2, -1, 0, 1, 2].map(() => {
        const o = this.add2(ART.every((k) => this.textures.exists(k)) ? (this.add.image(x, RY, ART[0]).setScale(1.45) as Phaser.GameObjects.Image | Phaser.GameObjects.Text) : this.add.text(x, RY, SYM[0], { fontSize: "62px" }).setOrigin(0.5));
        return o;
      });
      const m = this.make.graphics({}).setScrollFactor(0).fillRect(x - 64, RY - 75, 128, 150);
      const mask = m.createGeometryMask();
      faces.forEach((f) => f.setMask(mask));
      // a soft shade top and bottom so it reads as a drum
      this.add2(this.add.rectangle(x, RY - 62, 128, 26, 0x000000, 0.22));
      this.add2(this.add.rectangle(x, RY + 62, 128, 26, 0x000000, 0.22));
      const glow = this.add2(this.add.rectangle(x, RY, 134, 156).setStrokeStyle(6, 0x4ade80).setAlpha(0));
      // where it is (in symbols), a scrambled strip, and the odd forced face (the result, a tease)
      const strip = Phaser.Utils.Array.Shuffle([0, 1, 2, 3, 4, 5, 0, 1, 2, 4, 5, 0, 1, 2, 4, 5]);
      return { x, faces, glow, pos: Math.random() * 16, strip, force: new Map<number, number>(), mask: m };
    });
    this.add2(this.add.rectangle(480, RY, 440, 3, 0xef4444, 0.75));
    this.add2(this.add.triangle(244, RY, 0, -10, 0, 10, 14, 0, 0xef4444));
    this.add2(this.add.triangle(716, RY, 14, -10, 14, 10, 0, 0, 0xef4444));
    const symAt = (r: (typeof reels)[number], idx: number) => r.force.get(idx) ?? r.strip[((idx % r.strip.length) + r.strip.length) % r.strip.length];
    const draw = () => {
      for (const r of reels) {
        const base = Math.floor(r.pos);
        r.faces.forEach((f, j) => {
          const idx = base + j - 2;
          // the reel rolls downwards: higher indices are above the line, coming down
          f.setY(RY + (r.pos - idx) * STEP);
          const s = symAt(r, idx);
          if (f instanceof Phaser.GameObjects.Image) f.setTexture(ART[s]);
          else f.setText(SYM[s]);
        });
      }
      // the bulbs chase round, faster while the last reel's hanging
      chase += chaseFast ? 0.6 : 0.18;
      bulbs.forEach((b, i) => b.setFillStyle((Math.floor(chase) + i) % 4 === 0 ? 0xfacc15 : 0x7c2d12));
    };
    const loop = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      if (this.panelRoot && this.panelRoot === root) return draw();
      loop.remove();
      reels.forEach((r) => r.mask.destroy());
    } });
    draw();
    this.add2(this.add.text(480, 120, "Three of a kind wins a PRIZE. Two of a kind gets you 50 back. Three 7s: TWO PRIZES.", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", align: "center", wordWrap: { width: 640 } }).setOrigin(0.5));
    const info = this.add2(this.add.text(480, 360, `${COST} Krezzcoin a spin. SPACE or SPIN.`, { fontFamily: FONT, fontSize: "15px", color: "#facc15", align: "center", wordWrap: { width: 640 } }).setOrigin(0.5));
    /** Spin a reel to land `sym` on the line after `ms`, at least `turns` symbols on. `tease`: the match stops just above the line, then drifts back off. */
    const spinReel = (r: (typeof reels)[number], sym: number, ms: number, ease: string, teaseSym?: number) =>
      new Promise<void>((res) => {
        r.force.clear();
        const target = Math.floor(r.pos) + 14 + Math.floor(ms / 120);
        r.force.set(target, sym);
        if (teaseSym !== undefined) {
          // the matching symbol is the very next one down: it creeps to the line… and doesn't make it
          r.force.set(target + 1, teaseSym);
          this.tweens.add({ targets: r, pos: target + 0.62, duration: ms, ease, onComplete: () => {
            this.time.delayedCall(420, () => this.tweens.add({ targets: r, pos: target, duration: 520, ease: "Back.out", onComplete: () => res() }));
          } });
          return;
        }
        this.tweens.add({ targets: r, pos: target, duration: ms, ease, onComplete: () => res() });
      });
    let spinning = false;
    const spin = async () => {
      if (spinning || !this.panelRoot) return;
      if (!this.pay(COST, info)) return;
      spinning = true;
      info.setText("Spinning…").setColor("#ffffff");
      reels.forEach((r) => r.glow.setAlpha(0));
      const r = Math.random();
      let out: number[];
      if (r < 0.03) out = [3, 3, 3];
      else if (r < 0.15) {
        const k = Phaser.Math.Between(0, SYM.length - 1);
        out = [k, k, k];
      } else if (r < 0.5) {
        const k = Phaser.Math.Between(0, SYM.length - 1);
        const o = (k + Phaser.Math.Between(1, SYM.length - 1)) % SYM.length;
        out = Phaser.Utils.Array.Shuffle([k, k, o]);
      } else {
        out = Phaser.Utils.Array.Shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3);
      }
      // nothing is as it seems: when the first two match and the last doesn't, it sometimes nearly does
      const lined = out[0] === out[1];
      const tease = lined && out[1] !== out[2] && Math.random() < 0.55;
      synth.play("slot_spin");
      const stop = (i: number) => {
        synth.play("ding");
        this.tweens.add({ targets: reels[i].faces, scaleY: { from: reels[i].faces[0].scaleY * 0.9, to: reels[i].faces[0].scaleY }, duration: 120 });
      };
      // staggered stops, left to right
      const first = spinReel(reels[0], out[0], 900, "Cubic.out").then(() => stop(0));
      const second = spinReel(reels[1], out[1], 1350, "Cubic.out").then(() => stop(1));
      await Promise.all([first, second]);
      if (this.panelRoot !== root) return;
      // two on the line: the last reel hangs, the cabinet holds its breath
      if (lined) {
        reels[0].glow.setAlpha(1);
        reels[1].glow.setAlpha(1);
        reels[2].glow.setAlpha(0.6).setStrokeStyle(6, 0xfacc15);
        this.tweens.add({ targets: reels[2].glow, alpha: 0.15, yoyo: true, repeat: -1, duration: 160 });
        info.setText(out[0] === 3 ? "7… 7… !!!" : "Two… on the line…").setColor("#facc15");
        chaseFast = true;
        synth.charge();
      }
      await spinReel(reels[2], out[2], lined ? 2300 : 600, lined ? "Sine.out" : "Cubic.out", tease ? out[0] : undefined);
      if (this.panelRoot !== root) return;
      this.tweens.killTweensOf(reels[2].glow);
      reels[2].glow.setStrokeStyle(6, 0x4ade80).setAlpha(0);
      chaseFast = false;
      stop(2);
      const [a, b, c] = out;
      if (a === b && b === c) {
        // the proper win: everything lights up, coins everywhere, and then the prize
        reels.forEach((rr) => rr.glow.setAlpha(1));
        reels.forEach((rr, i) => this.tweens.add({ targets: rr.faces[2], scale: rr.faces[2].scale * 1.25, yoyo: true, repeat: 3, duration: 140, delay: i * 70 }));
        info.setText(a === 3 ? "THREE 7s! JACKPOT!" : "THREE OF A KIND!").setColor("#4ade80");
        synth.play("jackpot");
        this.cameras.main.shake(350, 0.006);
        this.cameras.main.flash(180, 255, 230, 120);
        chaseFast = true;
        for (let i = 0; i < 3; i++) vfx(this, "vfx_coins", 330 + i * 150, 250, { scale: 2.2, fixed: true, depth: 7000, delay: i * 120 });
        vfx(this, "vfx_confetti", 480, 200, { scale: 2.6, fixed: true, depth: 7000, delay: 200 });
        this.kroken(5);
        await this.wait(1100);
        chaseFast = false;
        await this.showPrize(rollPrize(G.s).id);
        if (a === 3) await this.showPrize(rollPrize(G.s).id);
      } else if (a === b || b === c || a === c) {
        const pair = a === b ? [0, 1] : b === c ? [1, 2] : [0, 2];
        pair.forEach((i) => reels[i].glow.setAlpha(1));
        G.s.coins += 50;
        this.kroken(2);
        synth.play("coin");
        if (tease) {
          synth.play("trombone");
          info.setText("NUDGE. Nothing in Kreddle is as it seems. (Two of a kind, though: 50 back and 2 Krokens.)").setColor("#facc15");
        } else info.setText("Two of a kind: 50 back and 2 Krokens. The House is generous. Briefly.").setColor("#facc15");
      } else {
        info.setText(Phaser.Utils.Array.GetRandom(["Nothing. The House thanks you.", "Lose. Again?", "So close. (It wasn't close.)", "The machine winks at you."])).setColor("#ef4444");
        synth.play("tap_fail");
      }
      spinning = false;
    };
    this.btn(380, 440, `SPIN (${COST})`, () => void spin(), 170, 0x7c2d12);
    this.btn(580, 440, "WALK AWAY", () => !spinning && this.closePanel(), 170);
    this.key("SPACE", () => void spin());
    this.key("ESC", () => !spinning && this.closePanel());
  }

  // ------------------------------------------------------------------ THE KLAW

  private claw() {
    const COST = 200;
    const root = this.openPanel("THE KLAW", "#22d3ee");
    const L = 230;
    const R = 730;
    this.add2(this.add.rectangle(480, 270, R - L + 20, 300, 0x0e2a3a, 0.9).setStrokeStyle(4, 0xff4fd8));
    this.add2(this.add.rectangle(L + 40, 395, 70, 40, 0x000000).setStrokeStyle(2, 0xfacc15));
    this.add2(this.add.text(L + 40, 395, "CHUTE", { fontFamily: FONT, fontSize: "11px", color: "#facc15" }).setOrigin(0.5));
    const info = this.add2(this.add.text(480, 445, `${COST} Krezzcoin a go. SPACE / DROP to drop the claw. Get the drop spot DEAD CENTRE (green) on a capsule for a solid grip.`, { fontFamily: FONT, fontSize: "14px", color: "#22d3ee", align: "center", wordWrap: { width: 640 } }).setOrigin(0.5));
    // the capsules, each showing what's inside
    const used = new Set<string>();
    const caps = [0, 1, 2, 3, 4].map((i) => {
      let p = rollPrize(G.s);
      for (let k = 0; k < 6 && used.has(p.id); k++) p = rollPrize(G.s);
      used.add(p.id);
      const x = L + 150 + i * 80;
      // a PixelLab gacha capsule tinted to the machine's neon, the prize showing through; a circle if the art's missing
      const ball: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = this.textures.exists("kd_capsule")
        ? this.add2(this.add.image(x, 385, "kd_capsule").setScale(1.9).setTint(NEON[i % NEON.length] | 0x505050))
        : this.add2(this.add.circle(x, 385, 26, NEON[i % NEON.length], 0.85).setStrokeStyle(3, 0xffffff));
      const icon = this.add2(this.add.text(x, 385, p.icon, { fontSize: "24px" }).setOrigin(0.5));
      return { x, y: 385, ball, icon, prize: p.id, taken: false };
    });
    const hover = this.add2(this.add.text(480, 115, "", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
    // the drop line and its spot on the floor: line it up dead centre on a capsule for a solid grip
    const aim = this.add2(this.add.graphics());
    const rope = this.add2(this.add.graphics());
    const head = this.add2(this.add.text(L + 60, 160, "🪝", { fontSize: "34px" }).setOrigin(0.5, 0));
    let state: "idle" | "swing" | "drop" = "swing";
    let t0 = this.time.now;
    let clawX = L + 60;
    let clawY = 160;
    let holding: (typeof caps)[number] | null = null;
    /** How well it's got hold, 0..1: set by how centred the drop was. */
    let grip = 1;
    let paid = false;
    const loop = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      if (!this.panelRoot || this.panelRoot !== root) return loop.remove();
      if (state === "swing") clawX = L + 110 + ((Math.sin((this.time.now - t0) / 700) + 1) / 2) * (R - L - 160);
      head.setPosition(clawX, clawY);
      rope.clear().lineStyle(3, 0xd1d5db, 1).lineBetween(clawX, 130, clawX, clawY + 4);
      if (holding) {
        // a weak grip swings about on the way to the chute
        const sway = grip < 0.5 ? Math.sin(this.time.now / 70) * 6 : grip < 0.8 ? Math.sin(this.time.now / 110) * 3 : 0;
        holding.ball.setPosition(clawX + sway, clawY + 48);
        holding.icon.setPosition(clawX + sway, clawY + 48);
      }
      const under = caps.find((c) => !c.taken && Math.abs(c.x - clawX) < 30);
      hover.setText(under ? `${PRIZE[under.prize].icon} ${PRIZE[under.prize].name}` : "");
      aim.clear();
      if (state === "swing") {
        const off = under ? Math.abs(under.x - clawX) : 99;
        const col = off < 10 ? 0x4ade80 : off < 20 ? 0xfacc15 : off < 30 ? 0xf97316 : 0x64748b;
        for (let y = clawY + 44; y < 395; y += 14) aim.lineStyle(2, col, 0.55).lineBetween(clawX, y, clawX, y + 7);
        aim.fillStyle(col, 0.45).fillEllipse(clawX, 414, 34, 9);
      }
    } });
    const tween = (cfg: { y?: number; x?: number; duration: number }) =>
      new Promise<void>((res) => {
        const o = { x: clawX, y: clawY };
        this.tweens.add({ targets: o, ...cfg, onUpdate: () => ((clawX = o.x), (clawY = o.y)), onComplete: () => res() });
      });
    const drop = async () => {
      if (state !== "swing" || !this.panelRoot) return;
      if (!paid) {
        if (!this.pay(COST, info)) return;
        paid = true;
      }
      state = "drop";
      info.setText("The Klaw descends…").setColor("#ffffff");
      await tween({ y: 320, duration: 650 });
      const target = caps.find((c) => !c.taken && Math.abs(c.x - clawX) < 30);
      synth.play("pop");
      if (target) {
        holding = target;
        // the grip comes from your aim (the real UFO-catcher skill is lining it up); a little luck on top
        const off = Math.abs(target.x - clawX);
        grip = off < 10 ? 0.92 : off < 20 ? 0.6 : 0.22;
        const verdict = off < 10 ? ["DEAD CENTRE! Lovely grip.", "#4ade80"] : off < 20 ? ["A bit off-centre… it's wobbling.", "#facc15"] : ["Barely got a finger on it…", "#f97316"];
        info.setText(verdict[0]).setColor(verdict[1]);
        if (off < 10) synth.play("ding");
      }
      await tween({ y: 160, duration: 650 });
      if (!this.panelRoot) return;
      if (!holding) {
        this.kroken(1);
        info.setText("Nothing. THE KLAW SAYS NO. (Have a pity Kroken.)").setColor("#ef4444");
        synth.play("tap_fail");
      } else {
        // the Klaw has feelings, and how strongly it feels them depends on your aim
        const slips = Math.random() > grip;
        if (slips) {
          // a weak grip lets go early; a decent one makes it most of the way, which is worse
          await tween({ x: clawX + (L + 40 - clawX) * (grip < 0.5 ? 0.3 : 0.75), duration: grip < 0.5 ? 350 : 650 });
          const h = holding;
          holding = null;
          synth.play("trombone");
          this.tweens.add({ targets: [h.ball, h.icon], y: 385, duration: 450, ease: "Bounce.out" });
          h.ball.x = h.icon.x = clawX;
          h.x = clawX;
          this.kroken(3);
          info.setText(grip < 0.5 ? "It slipped! Line it up better. (3 Krokens for trying.)" : "SO CLOSE. THE KLAW GIVETH AND THE KLAW TAKETH AWAY. (3 Krokens for trying.)").setColor("#ef4444");
        } else {
          await tween({ x: L + 40, duration: 700 });
          const h = holding;
          holding = null;
          h.taken = true;
          this.tweens.add({ targets: [h.ball, h.icon], y: 420, alpha: 0, duration: 300 });
          info.setText("IT'S IN THE CHUTE!").setColor("#4ade80");
          await this.wait(300);
          await this.showPrize(h.prize);
        }
      }
      paid = false;
      t0 = this.time.now - 700 * Math.asin(Phaser.Math.Clamp(((clawX - L - 110) / (R - L - 160)) * 2 - 1, -1, 1));
      state = "swing";
      if (this.panelRoot) info.setText(`${COST} Krezzcoin a go. SPACE / DROP to drop the claw.`).setColor("#22d3ee");
    };
    this.btn(380, 495, `DROP (${COST})`, () => void drop(), 170, 0x0e7490);
    this.btn(580, 495, "WALK AWAY", () => state === "swing" && this.closePanel(), 170);
    this.key("SPACE", () => void drop());
    this.key("ESC", () => state === "swing" && this.closePanel());
    void state;
  }

  // ------------------------------------------------------------------ WHEEL OF KREDDLE

  private wheel() {
    const COST = 300;
    this.openPanel("WHEEL OF KREDDLE", "#a855f7");
    const SEG = ["PRIZE", "BUST", "MONEY BACK", "10 KROKENS", "LASHED", "DOUBLE PRIZE", "BUST", "PRIZE", "6 KROKENS", "KRELWORLD TAX"];
    const COL = [0x22c55e, 0x374151, 0xfacc15, 0x0ea5e9, 0xdc2626, 0xff4fd8, 0x374151, 0xa855f7, 0x14b8a6, 0x7f1d1d];
    const R = 150;
    const cx = 480;
    const cy = 260;
    const wheel = this.add.container(cx, cy);
    const g = this.add.graphics();
    const seg = (Math.PI * 2) / SEG.length;
    SEG.forEach((_, i) => {
      g.fillStyle(COL[i], 1).slice(0, 0, R, i * seg, (i + 1) * seg, false).fillPath();
      g.lineStyle(2, 0xffffff, 0.8).slice(0, 0, R, i * seg, (i + 1) * seg, false).strokePath();
    });
    wheel.add(g);
    SEG.forEach((t, i) => {
      const a = (i + 0.5) * seg;
      wheel.add(this.add.text(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, t, { fontFamily: "Impact, sans-serif", fontSize: "13px", color: "#ffffff", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setRotation(a));
    });
    wheel.add(this.add.circle(0, 0, 16, 0xfacc15).setStrokeStyle(3, 0x000000));
    this.add2(this.add.circle(cx, cy, R + 8, 0xfacc15).setStrokeStyle(4, 0x7c2d12));
    this.add2(wheel);
    this.pin(wheel);
    this.add2(this.add.triangle(cx, cy - R - 14, -14, -16, 14, -16, 0, 12, 0xffffff).setStrokeStyle(2, 0x000000));
    const info = this.add2(this.add.text(480, 438, `${COST} Krezzcoin a spin. SPACE or SPIN.`, { fontFamily: FONT, fontSize: "15px", color: "#c4b5fd", align: "center", wordWrap: { width: 640 } }).setOrigin(0.5));
    let vel = 0;
    let spinning = false;
    const loop = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      if (!this.panelRoot) return loop.remove();
      if (!spinning) return;
      wheel.rotation += vel * 0.016;
      vel *= 0.985;
      if (vel < 0.25) {
        spinning = false;
        vel = 0;
        // which segment is under the pointer at the top?
        const local = Phaser.Math.Angle.Wrap(-Math.PI / 2 - wheel.rotation);
        const idx = Math.floor(((local + Math.PI * 2) % (Math.PI * 2)) / seg);
        void land(SEG[idx]);
      }
    } });
    let lastTick = 0;
    this.time.addEvent({ delay: 30, loop: true, callback: () => {
      if (!spinning) return;
      const k = Math.floor(wheel.rotation / seg);
      if (k !== lastTick) {
        lastTick = k;
        synth.play("select");
      }
    } });
    const land = async (r: string) => {
      const s = G.s;
      info.setColor("#ffffff");
      switch (r) {
        case "PRIZE":
          info.setText("PRIZE!").setColor("#4ade80");
          await this.showPrize(rollPrize(s).id);
          break;
        case "DOUBLE PRIZE":
          info.setText("DOUBLE PRIZE!!").setColor("#ff4fd8");
          await this.showPrize(rollPrize(s).id);
          await this.showPrize(rollPrize(s).id);
          break;
        case "10 KROKENS":
        case "6 KROKENS": {
          const n = r.startsWith("10") ? 10 : 6;
          this.kroken(n);
          info.setText(`${n} KROKENS! Spend them at the Prize Counter.`).setColor("#38bdf8");
          break;
        }
        case "MONEY BACK":
          s.coins += COST;
          info.setText("Money back. The wheel giveth. Slightly.").setColor("#facc15");
          break;
        case "BUST":
          info.setText("BUST. The House thanks you for your donation.").setColor("#ef4444");
          synth.play("tap_fail");
          break;
        case "LASHED": {
          const fine = Math.min(s.coins, 100);
          s.coins -= fine;
          this.cameras.main.flash(200, 220, 0, 0);
          synth.play("punch_big");
          info.setText(`LASHED! (And another ${fine} for the lanyard.)`).setColor("#ef4444");
          break;
        }
        case "KRELWORLD TAX": {
          const fine = Math.min(s.coins, 150);
          s.coins -= fine;
          synth.play("trombone");
          info.setText(`KRELWORLD TAX. ${INSULT}s pay extra. -${fine}.`).setColor("#ef4444");
          break;
        }
      }
    };
    const spin = () => {
      if (spinning || !this.panelRoot) return;
      if (!this.pay(COST, info)) return;
      info.setText("Round and round…").setColor("#ffffff");
      vel = 11 + Math.random() * 9;
      spinning = true;
    };
    this.btn(380, 490, `SPIN (${COST})`, spin, 170, 0x6b21a8);
    this.btn(580, 490, "WALK AWAY", () => !spinning && this.closePanel(), 170);
    this.key("SPACE", spin);
    this.key("ESC", () => !spinning && this.closePanel());
  }

  // ------------------------------------------------------------------ KREDDLE KARDS (higher or lower)

  /**
   * Higher or lower as a double-or-nothing ladder. The stake becomes a POT; every right call multiplies it by the
   * odds against that call (so "higher than a 2" pays peanuts and "higher than a Jack" pays a fortune), and after
   * each one you BANK it or RISK it. Five in a row wins a prize on top. One wrong call and the pot's gone.
   */
  private cards() {
    const COST = 150;
    const TOP = 5;
    this.openPanel("KREDDLE KARDS", "#4ade80");
    const RANK = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const SUIT = ["♠", "♥", "♦", "♣"];
    if (this.textures.exists("spr_KD_PITBOSS")) this.add2(this.add.sprite(200, 250, "spr_KD_PITBOSS", 0).setScale(3).setTint(0xffe27a));
    this.add2(this.add.text(200, 330, "THE DEALER", { fontFamily: FONT, fontSize: "12px", color: "#facc15" }).setOrigin(0.5));
    const cardBg = this.add2(this.add.rectangle(420, 240, 130, 180, 0xffffff).setStrokeStyle(4, 0x111111));
    const cardTxt = this.add2(this.add.text(420, 240, "?", { fontFamily: "Georgia, serif", fontSize: "54px", color: "#111111", fontStyle: "bold", align: "center" }).setOrigin(0.5));
    // the ladder: five rungs, the top one a PRIZE
    const rungs = Array.from({ length: TOP }, (_, i) => {
      const y = 330 - i * 44;
      const bg = this.add2(this.add.rectangle(650, y, 200, 36, 0x0b3d1f, 0.9).setStrokeStyle(2, 0x166534));
      const t = this.add2(this.add.text(650, y, "", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#86efac" }).setOrigin(0.5));
      return { bg, t };
    });
    const potTxt = this.add2(this.add.text(650, 106, "", { fontFamily: "Impact, sans-serif", fontSize: "24px", color: "#facc15", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5));
    const info = this.add2(this.add.text(480, 384, `Deal for ${COST}. Call HIGHER or LOWER. Each right call multiplies your pot by the odds against it; BANK it any time, or risk it all for the next rung. Five in a row: a PRIZE as well. The House wins ties.`, { fontFamily: FONT, fontSize: "13px", color: "#ffffff", align: "center", wordWrap: { width: 660 } }).setOrigin(0.5));
    let card = -1;
    let streak = 0;
    let pot = 0;
    let live = false;
    let busy = false;
    /** Chance the next card is strictly higher / lower than this one, and what that call pays (0.92 of fair: the House's cut). */
    const odds = (up: boolean) => (up ? 12 - card : card) / 13;
    const pays = (up: boolean) => {
      const p = odds(up);
      return p <= 0 ? 0 : Phaser.Math.Clamp(Math.round((0.92 / p) * 10) / 10, 1.1, 8);
    };
    const show = (n: number) => {
      const suit = SUIT[Phaser.Math.Between(0, 3)];
      cardTxt.setText(`${RANK[n]}\n${suit}`).setColor(suit === "♥" || suit === "♦" ? "#dc2626" : "#111111").setFontSize(44);
      this.tweens.killTweensOf([cardBg, cardTxt]);
      cardBg.setScale(1);
      cardTxt.setScale(1);
      this.tweens.add({ targets: [cardBg, cardTxt], scaleX: { from: 0, to: 1 }, duration: 160 });
      synth.play("pop");
    };
    const hi = this.btn(330, 470, "▲ HIGHER", () => void guess(true), 150);
    const lo = this.btn(490, 470, "▼ LOWER", () => void guess(false), 150);
    const label = (b: Phaser.GameObjects.Container, s: string) => (b.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined)?.setText(s);
    const refresh = () => {
      rungs.forEach((r, i) => {
        const on = live && i < streak;
        const next = live && i === streak;
        r.bg.setFillStyle(on ? 0x15803d : next ? 0x14532d : 0x0b3d1f, 0.95).setStrokeStyle(next ? 3 : 2, next ? 0xfacc15 : on ? 0x4ade80 : 0x166534);
        r.t.setText(i === TOP - 1 ? `${i + 1} · PRIZE + POT` : `${i + 1} RIGHT`).setColor(on ? "#ffffff" : next ? "#facc15" : "#86efac");
      });
      potTxt.setText(live ? `POT: ${pot}` : "");
      label(hi, live ? (pays(true) ? `▲ HIGHER x${pays(true)}` : "▲ HIGHER (no)") : "▲ HIGHER");
      label(lo, live ? (pays(false) ? `▼ LOWER x${pays(false)}` : "▼ LOWER (no)") : "▼ LOWER");
    };
    const deal = () => {
      if (live || busy || !this.panelRoot) return;
      if (!this.pay(COST, info)) return;
      live = true;
      streak = 0;
      pot = COST;
      card = Phaser.Math.Between(0, 12);
      show(card);
      info.setText("Higher or lower? (↑ / ↓) The long shot pays more.").setColor("#ffffff");
      refresh();
    };
    const bank = () => {
      if (!live || busy || streak < 1) return;
      live = false;
      G.s.coins += pot;
      synth.play("coin");
      vfx(this, "vfx_coins", 650, 106, { scale: 1.8, fixed: true, depth: 7000 });
      info.setText(`Banked ${pot}. ${pot >= COST * 3 ? "The Dealer's smile slips." : "Coward. Deal again?"}`).setColor("#facc15");
      refresh();
    };
    const guess = async (up: boolean) => {
      if (!live || busy || !this.panelRoot || !pays(up)) return;
      busy = true;
      const mult = pays(up);
      // the Dealer takes his time with the big ones
      const tense = mult >= 2.5 || streak >= TOP - 2;
      if (tense) {
        info.setText(Phaser.Utils.Array.GetRandom(["The Dealer licks his thumb…", "The Dealer looks at you. You look at the Dealer.", "…", "He's enjoying this."])).setColor("#c4b5fd");
        this.tweens.add({ targets: cardBg, scaleX: 0.96, scaleY: 1.03, yoyo: true, repeat: 2, duration: 110 });
        await this.wait(750);
        if (!this.panelRoot) return;
      }
      const next = Phaser.Math.Between(0, 12);
      show(next);
      const right = up ? next > card : next < card;
      const tie = next === card;
      card = next;
      busy = false;
      if (!right) {
        live = false;
        info.setText(tie ? `A tie. The House wins ties. ${pot} gone.` : `Wrong. The Dealer smiles. ${pot} gone. Deal again?`).setColor("#ef4444");
        synth.play(pot > COST * 2 ? "trombone" : "tap_fail");
        this.cameras.main.shake(160, 0.004);
        refresh();
        return;
      }
      streak++;
      pot = Math.round(pot * mult);
      this.kroken(1);
      synth.play(mult >= 2.5 ? "perfect" : "ding");
      this.tweens.add({ targets: potTxt, scale: { from: 1.35, to: 1 }, duration: 220, ease: "Back.out" });
      if (mult >= 2.5) vfx(this, "vfx_sparks", 420, 240, { scale: 2.2, fixed: true, depth: 7000, add: true });
      if (streak >= TOP) {
        live = false;
        G.s.coins += pot;
        info.setText(`FIVE IN A ROW! ${pot} Krezzcoin AND a prize.`).setColor("#4ade80");
        synth.play("jackpot");
        refresh();
        await this.showPrize(rollPrize(G.s).id);
        if (this.panelRoot) info.setText(`Deal again for ${COST}?`).setColor("#ffffff");
        return;
      }
      info.setText(`Right! x${mult}. BANK ${pot}, or call again for rung ${streak + 1}?`).setColor("#4ade80");
      refresh();
    };
    this.btn(180, 470, `DEAL (${COST})`, deal, 130, 0x166534);
    this.btn(660, 470, "BANK IT", bank, 130, 0x854d0e);
    this.btn(810, 470, "LEAVE", () => !live && !busy && this.closePanel(), 100);
    refresh();
    this.key("SPACE", () => (live ? undefined : deal()));
    this.key("ENTER", bank);
    this.key("B", bank);
    this.key("UP", () => void guess(true));
    this.key("DOWN", () => void guess(false));
    this.key("W", () => void guess(true));
    this.key("S", () => void guess(false));
    this.key("ESC", () => !live && !busy && this.closePanel());
  }

  // ------------------------------------------------------------------ the Prize Counter

  /** A full-screen shop panel (the Prize Counter, Home Furnishings) with a card grid, tabs optional. */
  private shopPanel(cfg: {
    title: string;
    color: string;
    tabs?: { id: string; label: string }[];
    tab?: string;
    items: () => ShopItem[];
    buy: (it: ShopItem) => boolean | Promise<boolean>;
    sel?: number;
    extra?: () => void;
    reopen: (tab: string | undefined, sel: number) => void;
  }) {
    this.busy = true;
    const root = this.add.container(0, 0).setDepth(5000);
    this.panelRoot = root;
    root.add(this.add.rectangle(480, 270, 960, 540, 0x05010c, 0.85).setInteractive());
    const col = Phaser.Display.Color.HexStringToColor(cfg.color).color;
    const art = uiFrame(this, 480, 270, 944, 528, "ui_panel");
    if (art) root.add(art.setTint(col | 0x404040));
    else root.add(this.add.rectangle(480, 270, 944, 528, 0x16072b, 0.97).setStrokeStyle(4, col));
    const t = this.add.text(30, 34, cfg.title, { fontFamily: "Impact, sans-serif", fontSize: "30px", color: cfg.color, stroke: "#12001f", strokeThickness: 6 }).setOrigin(0, 0.5);
    t.setShadow(0, 0, cfg.color, 12, true, true);
    root.add(t);
    root.add(button(this, 914, 34, "✕", () => this.closePanel(), { w: 48, h: 44, size: 22, color: 0x7f1d1d }));
    const tabs = cfg.tabs ?? [];
    const top = tabs.length ? 116 : 76;
    if (tabs.length) root.add(shopTabs(this, 20, 86, 920, tabs, cfg.tab ?? tabs[0].id, (id) => (this.closePanel(), cfg.reopen(id, 0)), col));
    const shop = new ShopGrid(this, {
      x: 20,
      y: top,
      w: 920,
      h: 432 - top,
      cols: 6,
      rows: 2,
      detail: { x: 20, y: 442, w: 920, h: 86 },
      balances: [
        { currency: "coin", x: 690, y: 34 },
        { currency: "kroken", x: 846, y: 34 },
      ],
      balance: (c) => (c === "coin" ? G.s.coins : krokens(G.s)),
      fixed: true,
      onBuy: async (it) => {
        const ok = await cfg.buy(it);
        if (ok && this.panelRoot === root) {
          G.save();
          shop.setItems(cfg.items());
        }
        return ok;
      },
    });
    root.add(shop.root);
    shop.setItems(cfg.items(), cfg.sel ?? 0);
    cfg.extra?.();
    this.pin(root);
    const go = (fn: () => void) => () => this.panelRoot === root && fn();
    this.key("LEFT", go(() => shop.move(-1, 0)));
    this.key("RIGHT", go(() => shop.move(1, 0)));
    this.key("UP", go(() => shop.move(0, -1)));
    this.key("DOWN", go(() => shop.move(0, 1)));
    this.key("A", go(() => shop.move(-1, 0)));
    this.key("D", go(() => shop.move(1, 0)));
    for (const k of ["SPACE", "E", "ENTER"]) this.key(k, go(() => void shop.confirm()));
    if (tabs.length) {
      const cycle = (d: number) => {
        const i = tabs.findIndex((x) => x.id === (cfg.tab ?? tabs[0].id));
        this.closePanel();
        cfg.reopen(tabs[(i + d + tabs.length) % tabs.length].id, 0);
        synth.play("select");
      };
      this.key("TAB", (e: KeyboardEvent) => (e?.preventDefault?.(), this.panelRoot === root && cycle(e?.shiftKey ? -1 : 1)));
      this.key("Q", go(() => cycle(-1)));
      this.key("R", go(() => cycle(1)));
      ["ONE", "TWO", "THREE", "FOUR"].slice(0, tabs.length).forEach((k, i) => this.key(k, go(() => (this.closePanel(), cfg.reopen(tabs[i].id, 0)))));
    }
    this.key("ESC", go(() => this.closePanel()));
    return { root, shop };
  }

  private prizeTab = "power";

  private prizeCounter(sel = 0, tab = this.prizeTab) {
    this.prizeTab = tab;
    const items = (): ShopItem[] => {
      const s = G.s;
      const out: ShopItem[] = PRIZES.filter((p) => p.cat === tab).map((p): ShopItem => {
        const ownedGun = !!p.gun && !!s.guns && p.gun in s.guns;
        const max = p.max ?? 1;
        return {
          id: p.id,
          name: p.name,
          icon: p.gun ? GUNS[p.gun].tex : p.icon,
          desc: ownedGun ? "Already yours: this is a full refill." : p.desc,
          price: krokenPrice(s, p),
          currency: "kroken",
          state: prizeOpen(s, p) ? "buy" : "maxed",
          lvl: p.key && max > 1 ? [kd(s, p.key), max] : undefined,
          tag: ownedGun ? "REFILL" : undefined,
          tagColor: 0x67e8f9,
          verb: ownedGun ? "REFILL" : "GET",
        };
      });
      if (tab === "style") {
        const on = G.meta.settings.gore !== false;
        out.push({ id: "gore", name: `Gore: ${on ? "ON" : "OFF"}`, icon: on ? "🔪" : "🧸", desc: "Blood and dismemberment. Free to switch, any time (it's in Settings too).", price: 0, currency: "kroken", state: "toggle", verb: on ? "TURN OFF" : "TURN ON" });
      }
      return out;
    };
    this.shopPanel({
      title: "PRIZE COUNTER",
      color: "#facc15",
      tabs: [
        { id: "power", label: "⚡ POWER" },
        { id: "tough", label: "🛡 TOUGH" },
        { id: "guns", label: "🔫 GUNS" },
        { id: "style", label: "✨ STYLE" },
      ],
      tab,
      sel,
      items,
      reopen: (t, i) => this.prizeCounter(i, t),
      buy: async (it) => {
        if (it.id === "gore") {
          G.meta.settings.gore = G.meta.settings.gore === false;
          G.saveMeta();
          return true;
        }
        const p = PRIZE[it.id];
        const price = krokenPrice(G.s, p);
        if (!p || !prizeOpen(G.s, p) || krokens(G.s) < price) return false;
        addKrokens(G.s, -price);
        await this.showPrize(p.id);
        return true;
      },
      extra: () => this.add2(button(this, 400, 34, "💰 EXCHANGE ▸", () => (this.closePanel(), this.krezzcoinCounter()), { w: 150, h: 40, size: 15, color: 0x166534 })),
    });
  }

  /** THE KREDDLE EXCHANGE: Krokens buy prizes, Krezzcoin buys upgrades, guns, perks and lads. */
  private exchange() {
    this.openPanel("THE KREDDLE EXCHANGE", "#facc15");
    const big = (y: number, icon: string, head: string, sub: string, color: number, fn: () => void, key: string) => {
      const c = this.btn(480, y, "", fn, 560, color, 84);
      c.add(this.add.text(-250, 0, icon, { fontFamily: FONT, fontSize: "44px", padding: { x: 4, y: 4 } }).setOrigin(0, 0.5));
      c.add(this.add.text(-180, -14, head, { fontFamily: FONT, fontSize: "24px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0, 0.5));
      c.add(this.add.text(-180, 18, sub, { fontFamily: FONT, fontSize: "15px", color: "#e9d5ff" }).setOrigin(0, 0.5));
      if (!TOUCH.enabled) c.add(this.add.text(250, 0, key, { fontFamily: FONT, fontSize: "14px", color: "#c4b5fd", fontStyle: "bold" }).setOrigin(1, 0.5));
      this.pin(c);
    };
    big(170, "🎟", "PRIZE COUNTER", "Spend Krokens on Kreddle prizes", 0x3b0764, () => (this.closePanel(), this.prizeCounter()), "1");
    big(270, "💰", "KREZZCOIN COUNTER", "Upgrades, guns, ammo, perks and lads", 0x14532d, () => (this.closePanel(), this.krezzcoinCounter()), "2");
    big(370, "🏠", "HOME FURNISHINGS", "Krokens for things for your flat", 0x7c2d12, () => (this.closePanel(), this.furnishings()), "3");
    this.btn(480, 462, "LEAVE", () => this.closePanel(), 160);
    this.key("ESC", () => this.closePanel());
    this.key("ONE", () => (this.closePanel(), this.prizeCounter()));
    this.key("TWO", () => (this.closePanel(), this.krezzcoinCounter()));
    this.key("THREE", () => (this.closePanel(), this.furnishings()));
  }

  /** HOME FURNISHINGS: Kreddle tat for your flat. */
  private furnishings(sel = 0) {
    this.shopPanel({
      title: "HOME FURNISHINGS",
      color: "#fb923c",
      sel,
      items: () =>
        DECOR.map((d): ShopItem => {
          const owned = (G.s.upgrades[`home_${d.id}`] ?? 0) > 0;
          return { id: d.id, name: d.name, icon: this.textures.exists(`d_${d.id}`) ? `d_${d.id}` : d.icon, desc: d.desc, price: d.price, currency: "kroken", state: owned ? "owned" : "buy" };
        }),
      reopen: (_t, i) => this.furnishings(i),
      buy: (it) => {
        const d = DECOR.find((x) => x.id === it.id);
        if (!d || G.s.upgrades[`home_${d.id}`] || krokens(G.s) < d.price) return false;
        addKrokens(G.s, -d.price);
        G.s.upgrades[`home_${d.id}`] = 1;
        G.emit("toast", { title: "DELIVERED", text: `${d.name} is in your flat. Kev let himself in.` });
        return true;
      },
    });
  }

  /** The old bank menu, now Kreddle's. */
  private krezzcoinCounter() {
    this.busy = true;
    this.scene.launch("Menu", { mode: "bank", caller: "Kreddle" });
    this.scene.pause();
  }

  /** Krokens! A little ticket pops out. */
  private kroken(n: number) {
    addKrokens(G.s, n);
    synth.play("ding");
    const t = this.add.text(480, 300, `+${n} 🎟 KROKEN${n > 1 ? "S" : ""}`, { fontFamily: "Impact, sans-serif", fontSize: "28px", color: "#38bdf8", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(6500);
    this.tweens.add({ targets: t, y: 250, alpha: 0, duration: 1300, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ helpers

  private async talk(lines: Line[]) {
    this.busy = true;
    await this.box.play(lines);
    this.controls.swallow();
    this.busy = false;
  }

  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
  }

  private bubble(spr: Phaser.GameObjects.Sprite, text: string, bg = "#ffffff") {
    const t = this.add.text(spr.x, spr.y - 46, text, { fontFamily: FONT, fontSize: "11px", color: "#050505", backgroundColor: bg, padding: { x: 5, y: 3 }, wordWrap: { width: 190 }, align: "center" }).setOrigin(0.5, 1).setDepth(2500);
    this.tweens.add({ targets: t, y: t.y - 10, duration: 1800 });
    this.time.delayedCall(1800, () => t.destroy());
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: "13px", color, fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(2600);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 1300, onComplete: () => t.destroy() });
  }
}

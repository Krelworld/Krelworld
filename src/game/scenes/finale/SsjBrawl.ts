import { diffFor, scaleInt } from "../../systems/difficulty";
import Phaser from "phaser";
import type { Line } from "../../../data/types";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import * as Juice from "../../gfx/Juice";
import { hasVfx, vfx } from "../../gfx/Vfx";
import { charMeta, hdFactor } from "../../gfx/HD";
import { keysFor } from "../../systems/keybinds";
import { padHeld } from "../../systems/padbinds";
import { TOUCH, isTouchDevice } from "../../ui/TouchControls";
import { isMobile } from "../../mobile/flag";
import { phoneHooks } from "../../mobile/boot";
import { FONT } from "../../ui/theme";
import { CHARACTERS, LADS } from "../../../data/characters";
import * as FB from "../../../content/finaleKrelford";
import { ssjSwap, youCutKey } from "./finaleArt";

/**
 * THE SUPER SAIYAN BRAWL (FinaleScene beat "brawl", between the Concept's real phase and the SPIRIT CUM).
 * Nearly dead, the Concept tears itself out of the rubble and takes the whole dragon up into the storm. Side-on, in the sky over burning Krelford: you against it, hand to hand, DBZ style.
 *
 *   PUNCH (J / left click / PUNCH)   a 4-hit string. MASH it and it turns into a FLURRY (a blur of fists and
 *                                    afterimages) that ends in a launcher when you stop.
 *   KICK (K / F / right click / KICK) heavy: big knockback; on a stunned enemy it LAUNCHES him.
 *   VANISH (Space / Shift / VANISH)  teleport: behind him if he's close (the next hit is a VANISH STRIKE), or
 *                                    straight after a launch, AHEAD of him to knock him back the other way.
 *   KI (R / L / C / KI, hold)        a volley of ki blasts off your ki meter (shoots his bolts down too).
 *   BLOCK (E / BLOCK, hold)          most of a hit; just before it lands, a PARRY that stuns him.
 *
 * It fights back with telegraphed moves (claw swipe, dark fireballs, blink-behind slash, a beam across your row, a rush)
 * that come faster as he weakens, and bursts out of long combos. Knocked down, you get back up, but he heals a chunk.
 * Win with the RUSH finisher (mash). Never a game over. Respects calmFlash (no strobing) and gore.
 */

const WW = 2400;
const TOP = 120;
const BOT = 420;
/** The avatar's health (separate from the dragon's bar, which sits at its floor through all this). */
export const BRAWL_HP = 2600;
const P_MAX = 100;
const GOLD = 0xffd23f;
const VIOLET = 0xa855f7;
/** Half the dragon's body width: every reach, spacing and hit radius is measured to its edge, not its middle. */
const ER = 85;

type PState = "free" | "punch" | "kick" | "flurry" | "block" | "hurt" | "down" | "cine";
type EState = "move" | "windup" | "stun" | "blink" | "cine";
type AtkKind = "swing" | "bolts" | "blink" | "beam" | "rush" | "burst";

interface Fighter {
  c: Phaser.GameObjects.Container;
  spr: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: 1 | -1;
}

interface Atk {
  kind: AtkKind;
  hitAt: number;
  endAt: number;
  done: boolean;
  x: number;
  y: number;
  dir: 1 | -1;
  gfx: Phaser.GameObjects.GameObject[];
}

interface Bolt {
  o: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  dmg: number;
  mine: boolean;
  until: number;
}

interface Input {
  mx: number;
  my: number;
  punch: boolean;
  kick: boolean;
  vanish: boolean;
  ki: boolean;
  block: boolean;
}

const calm = () => !!G.meta?.settings?.calmFlash;
const gore = () => G.meta?.settings?.gore !== false;

export class SsjBrawl {
  private sc: Phaser.Scene;
  private talk: (l: Line[]) => Promise<void>;
  private p!: Fighter;
  private e!: Fighter;
  private on = false;
  private resolveWin?: () => void;
  // player
  pState: PState = "cine";
  hp = P_MAX;
  ki = 60;
  private actUntil = 0;
  private chain = 0;
  private lastPunch = 0;
  private mash: number[] = [];
  private flurryStart = 0;
  private flurryLast = 0;
  private flurryTick = 0;
  private iframesUntil = 0;
  private vanishCd = 0;
  private vanishStrikeUntil = 0;
  private chaseUntil = 0;
  private chases = 0;
  private blockStart = 0;
  private lastKi = 0;
  private aura?: Phaser.GameObjects.Sprite;
  private shield?: Phaser.GameObjects.Ellipse;
  // enemy
  eHp = BRAWL_HP;
  eState: EState = "cine";
  private stunUntil = 0;
  private armored = false;
  private nextAttack = 0;
  private atk: Atk | null = null;
  private atkN = 0;
  private comboTaken = 0;
  private launched = false;
  private eAura?: Phaser.GameObjects.Sprite | null;
  private phaseShown = 0;
  // the fight
  private bolts: Bolt[] = [];
  private combo = 0;
  private comboDmg = 0;
  private lastHit = 0;
  private freezeUntil = 0;
  private lastGhost = 0;
  private nextCheer = 0;
  private finishing = false;
  /** Slow motion (the biggest hits): until this (real time), everything runs at slowK. */
  private slowUntil = 0;
  private slowK = 1;
  private squashTw?: Phaser.Tweens.Tween;
  private lastTrail = 0;
  /** For the tests / bots: what's happened. */
  stats = { hits: 0, maxCombo: 0, flurries: 0, vanishes: 0, vanishStrikes: 0, kicks: 0, kis: 0, parries: 0, blocks: 0, hurt: 0, kos: 0, rush: 0 };
  // input
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private prev: Record<string, boolean> = {};
  private queued = { punch: false, kick: false };
  private pad: { stick: number | null; ox: number; oy: number; mx: number; my: number; held: Set<string>; edges: Set<string> } = { stick: null, ox: 120, oy: 420, mx: 0, my: 0, held: new Set(), edges: new Set() };
  private touchUi = false;
  private padUi?: Phaser.GameObjects.Container;
  // hud
  private hud!: {
    pBar: Phaser.GameObjects.Rectangle;
    pLag: Phaser.GameObjects.Rectangle;
    kiBar: Phaser.GameObjects.Rectangle;
    eBar: Phaser.GameObjects.Rectangle;
    eLag: Phaser.GameObjects.Rectangle;
    combo: Phaser.GameObjects.Text;
    dmg: Phaser.GameObjects.Text;
    chase: Phaser.GameObjects.Text;
    root: Phaser.GameObjects.Container;
  };
  private bg!: { sky: Phaser.GameObjects.TileSprite; clouds: Phaser.GameObjects.TileSprite; far: Phaser.GameObjects.TileSprite; town: Phaser.GameObjects.TileSprite; rocks: { o: Phaser.GameObjects.Image; k: number; vy: number; vr: number }[]; wind: Phaser.GameObjects.Graphics; dragon?: Phaser.GameObjects.Image };

  constructor(sc: Phaser.Scene, talk: (l: Line[]) => Promise<void>) {
    this.sc = sc;
    this.talk = talk;
    (sc as unknown as { brawl?: SsjBrawl }).brawl = this;
  }

  get enemyHp() {
    return this.eHp;
  }

  // ---------------------------------------------------------------- the whole beat

  async run(): Promise<void> {
    const sc = this.sc;
    const cam = sc.cameras.main;
    cam.setBounds(0, 0, WW, 540);
    this.makeTextures();
    this.backdrop();
    this.spawn();
    this.makeHud();
    this.inputs();
    sc.events.on("update", this.update, this);
    sc.events.once("shutdown", () => this.cleanup());
    synth.music("fe_brawl", true);
    cam.centerOn(this.mid().x, 270);
    // he comes up out of the dark below, the dragon slumped and empty behind him
    this.e.c.setAlpha(0);
    this.sc.tweens.add({ targets: this.e.c, alpha: 1, duration: 900 });
    this.e.y = BOT + 160;
    this.sc.tweens.add({ targets: this.e, y: 260, duration: 1400, ease: "Cubic.out" });
    if (!synth.shout("concept_roar", 1, 1.25)) synth.play("roar");
    Juice.shake(sc, 900, 0.01);
    await this.wait(1000);
    await this.talk(FB.FB_BRAWL_INTRO);
    const you = youCutKey(sc, G.s.player);
    if (you) void Juice.cutIn(sc, you, you.startsWith("fe_") ? { from: "left", y: 150, color: GOLD, hold: 650 } : { from: "left", y: 150, color: GOLD, hold: 650, focus: 0.6, w: 480 });
    await Juice.cutIn(sc, "fe_cut_concept_hurt", { from: "right", y: 390, color: VIOLET, hold: 650 });
    await Juice.bossCard(sc, "SUPER SAIYAN BRAWL", "MASH FOR A FLURRY. HOLD R TO BLAST KI. VANISH BEHIND IT.", "#ffd23f");
    this.legend();
    this.pState = "free";
    this.eState = "move";
    this.nextAttack = sc.time.now + 1600;
    this.nextCheer = sc.time.now + 4000;
    this.on = true;
    await new Promise<void>((res) => (this.resolveWin = res));
  }

  private cleanup() {
    this.on = false;
    this.sc.events.off("update", this.update, this);
    this.sc.tweens.timeScale = 1;
    if (this.touchUi) TOUCH.attack = false;
  }

  /** Debug / tests: knock his health down to `hp` (the finisher plays at 0). */
  debugHp(hp: number) {
    this.eHp = Math.max(1, hp);
  }

  // ---------------------------------------------------------------- set dressing

  private makeTextures() {
    const tex = this.sc.textures;
    const g = this.sc.make.graphics({}, false);
    if (!tex.exists("br_sky")) {
      // a tall gradient strip, tiled sideways
      g.clear();
      const steps = 27;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x07021a), Phaser.Display.Color.ValueToColor(0x4a1638), 100, Math.round(t * 100));
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, i * 20, 16, 20);
      }
      g.generateTexture("br_sky", 16, 540);
    }
    if (!tex.exists("br_clouds")) {
      g.clear();
      const rnd = new Phaser.Math.RandomDataGenerator(["brawl_clouds"]);
      for (let i = 0; i < 70; i++) {
        const x = rnd.between(0, 512);
        const y = rnd.between(20, 200);
        const w = rnd.between(60, 180);
        const col = rnd.pick([0x1b0b2e, 0x24103a, 0x2e1445, 0x3a1a4a]);
        for (const dx of [-512, 0, 512]) g.fillStyle(col, 0.55).fillEllipse(x + dx, y, w, w * 0.32);
      }
      g.generateTexture("br_clouds", 512, 240);
    }
    if (!tex.exists("br_town")) {
      // Krelford far below: a burning skyline, seamless sideways
      g.clear();
      const rnd = new Phaser.Math.RandomDataGenerator(["brawl_town"]);
      g.fillStyle(0x0a0510, 1).fillRect(0, 70, 512, 90);
      for (let x = 0; x < 512; x += rnd.between(18, 40)) {
        const h = rnd.between(14, 60);
        const w = rnd.between(16, 34);
        g.fillStyle(0x120818, 1).fillRect(x, 90 - h, Math.min(w, 512 - x), h + 70);
        for (let k = 0; k < 3; k++) if (rnd.frac() < 0.6) g.fillStyle(rnd.frac() < 0.5 ? 0xff7a2a : 0xffb347, 0.85).fillRect(x + rnd.between(2, Math.max(3, w - 6)), 90 - rnd.between(4, h), 3, 3);
      }
      for (let i = 0; i < 14; i++) g.fillStyle(0xff5a1a, 0.5).fillEllipse(rnd.between(0, 512), rnd.between(84, 120), rnd.between(10, 30), rnd.between(6, 14));
      g.generateTexture("br_town", 512, 160);
    }
    if (!tex.exists("br_rock")) {
      g.clear();
      g.fillStyle(0x2a2030, 1).fillPoints([new Phaser.Math.Vector2(4, 14), new Phaser.Math.Vector2(14, 2), new Phaser.Math.Vector2(34, 4), new Phaser.Math.Vector2(44, 18), new Phaser.Math.Vector2(36, 34), new Phaser.Math.Vector2(12, 32)], true);
      g.fillStyle(0x4a3a52, 1).fillPoints([new Phaser.Math.Vector2(14, 4), new Phaser.Math.Vector2(32, 6), new Phaser.Math.Vector2(38, 16), new Phaser.Math.Vector2(18, 14)], true);
      g.fillStyle(0xff7a2a, 0.6).fillRect(20, 26, 8, 3);
      g.generateTexture("br_rock", 48, 38);
    }
    if (!tex.exists("br_fist")) {
      // a glowing fist smear (afterimage fists in the flurry)
      g.clear();
      g.fillStyle(0xfff4c2, 0.35).fillEllipse(20, 12, 40, 18);
      g.fillStyle(0xffe9a8, 0.9).fillCircle(30, 12, 8);
      g.fillStyle(0xffffff, 1).fillCircle(32, 11, 4);
      g.generateTexture("br_fist", 44, 24);
    }
    g.destroy();
  }

  private backdrop() {
    const sc = this.sc;
    const sky = sc.add.tileSprite(480, 270, 960, 540, "br_sky").setScrollFactor(0).setDepth(-60);
    // the stars, through gaps in the storm
    const st = sc.add.graphics().setScrollFactor(0.05, 0).setDepth(-59);
    for (let i = 0; i < 60; i++) st.fillStyle(0xffffff, 0.3 + Math.random() * 0.4).fillRect(Math.random() * 1100, Math.random() * 220, 1.5, 1.5);
    // (the dragon's up here with you now: nothing slumped below)
    let dragon: Phaser.GameObjects.Image | undefined;
    if (false as boolean) {
      dragon = sc.add.image(480, 610, "fb_dragon_side").setOrigin(0.5, 1).setScale(2.2).setScrollFactor(0.12, 0).setDepth(-55).setTint(0x2a0f3d).setAlpha(0.85);
      sc.tweens.add({ targets: dragon, y: 618, yoyo: true, repeat: -1, duration: 2600, ease: "Sine.inOut" });
    }
    const far = sc.add.tileSprite(480, 160, 960, 240, "br_clouds").setScrollFactor(0).setDepth(-54).setAlpha(0.7).setTileScale(2, 1.4);
    const town = sc.add.tileSprite(480, 540 - 80, 960, 160, "br_town").setScrollFactor(0).setDepth(-50).setTileScale(2, 1);
    const glow = sc.add.rectangle(480, 500, 960, 160, 0xff6a2a, 0.12).setScrollFactor(0).setDepth(-49).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: glow, alpha: 0.05, yoyo: true, repeat: -1, duration: 1100 });
    if (hasVfx(sc, "vfx_smokecol")) for (let i = 0; i < 4; i++) vfx(sc, "vfx_smokecol", 120 + i * 240, 470, { fixed: true, scale: 2.2, depth: -48, alpha: 0.35 });
    const clouds = sc.add.tileSprite(480, 300, 960, 240, "br_clouds").setScrollFactor(0).setDepth(-40).setAlpha(0.45).setTileScale(3, 2).setFlipY(true);
    // rubble hanging in the air, rising (the power coming off the two of you)
    const rocks: { o: Phaser.GameObjects.Image; k: number; vy: number; vr: number }[] = [];
    for (let i = 0; i < 22; i++) {
      const fg = i % 4 === 0;
      const k = fg ? 1.25 : 0.4 + Math.random() * 0.45;
      const o = sc.add
        .image(Math.random() * WW, 60 + Math.random() * 480, "br_rock")
        .setScrollFactor(k, 0)
        .setScale(fg ? 1.6 + Math.random() : 0.4 + Math.random() * 0.7)
        .setDepth(fg ? 600 : -45 + k)
        .setAngle(Math.random() * 360)
        .setTint(fg ? 0x6a5a72 : 0x3a2a48)
        .setAlpha(fg ? 0.9 : 0.8);
      rocks.push({ o, k, vy: -(8 + Math.random() * 24) * (fg ? 1.6 : 1), vr: (Math.random() - 0.5) * 30 });
    }
    const wind = sc.add.graphics().setScrollFactor(0).setDepth(-30);
    if (hasVfx(sc, "vfx_rain"))
      for (let gx = 0; gx < 3; gx++)
        for (let gy = 0; gy < 3; gy++) vfx(sc, "vfx_rain", 160 + gx * 320, 100 + gy * 200, { fixed: true, scale: 2, depth: 650, alpha: 0.35, speed: 1.5, angle: 18 })?.anims.setProgress(Math.random());
    this.bg = { sky, clouds, far, town, rocks, wind, dragon };
    // lightning, far off (slow and dim under calmFlash)
    const strike = () => {
      if (!this.sc.sys?.isActive() || this.finishing) return;
      const r = sc.add.rectangle(480, 270, 960, 540, 0xd8c8ff, calm() ? 0.08 : 0.28).setScrollFactor(0).setDepth(-35).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: r, alpha: 0, duration: calm() ? 900 : 260, onComplete: () => r.destroy() });
      if (dragon) {
        dragon.setTint(0x6a3a9a);
        sc.time.delayedCall(120, () => dragon?.active && dragon.setTint(0x2a0f3d));
      }
      sc.time.delayedCall(300 + Math.random() * 900, () => this.sc.sys?.isActive() && synth.play(Math.random() < 0.5 ? "thunder_1" : "thunder_2", 0.6));
      sc.time.delayedCall(5000 + Math.random() * 6000, strike);
    };
    sc.time.delayedCall(3000, strike);
  }

  private updateBackdrop(dt: number) {
    const cam = this.sc.cameras.main;
    const b = this.bg;
    const t = this.sc.time.now / 1000;
    b.far.tilePositionX = cam.scrollX * 0.1 + t * 6;
    b.clouds.tilePositionX = cam.scrollX * 0.25 + t * 22;
    b.town.tilePositionX = cam.scrollX * 0.18;
    for (const r of b.rocks) {
      r.o.y += r.vy * dt;
      r.o.angle += r.vr * dt;
      if (r.o.y < -40) {
        r.o.y = 580;
        r.o.x = cam.scrollX * r.k + Math.random() * 1000;
      }
    }
    // wind streaks: you're both moving fast
    const g = b.wind;
    g.clear();
    const n = this.pState === "flurry" ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const y = 40 + ((i * 97 + Math.floor(t * 9) * 31) % 460);
      const x = (i * 211 + t * 900) % 1200 - 120;
      g.lineStyle(1, 0xffffff, 0.12).lineBetween(x, y, x + 60 + (i % 3) * 40, y);
    }
  }

  // ---------------------------------------------------------------- the fighters

  private spawn() {
    const sc = this.sc;
    const id = G.s.player;
    // you: your super saiyan sheet, side-on (frame 2 faces east)
    const base = sc.textures.exists(`spr_${id}`) ? `spr_${id}` : "spr_KREZMAR";
    const ps = sc.add.sprite(0, 0, base, charMeta(sc, base)?.idle?.east ?? 0).setScale(3);
    if (ssjSwap(ps, id, 2)) ps.clearTint();
    else ps.setTint(0xfff0b0);
    ps.setOrigin(0.5, 0.5);
    this.fit(ps, 150);
    const pc = sc.add.container(0, 0).setDepth(200);
    if (sc.textures.exists("fb_aura") && sc.anims.exists("fb_aura")) {
      const a = sc.add.sprite(0, 76, "fb_aura", 0).setOrigin(0.5, 0.875).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff27a).setAlpha(0.75);
      a.setScale(1.9, 1.75);
      a.play({ key: "fb_aura", startFrame: 2 });
      pc.add(a);
      this.aura = a;
    }
    const halo = sc.add.ellipse(0, 0, 110, 170, GOLD, 0.16).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: halo, scaleX: 1.1, alpha: 0.08, yoyo: true, repeat: -1, duration: calm() ? 900 : 260 });
    this.shield = sc.add.ellipse(40, 0, 50, 150, 0xfff4c2, 0.0).setStrokeStyle(4, GOLD, 0).setBlendMode(Phaser.BlendModes.ADD);
    pc.add([halo, ps, this.shield]);
    this.p = { c: pc, spr: ps, x: WW / 2 - 220, y: 280, vx: 0, vy: 0, face: 1 };
    // it: the dragon itself, up in the storm, wreathed in its black-violet flame
    const wk = sc.textures.exists("fb_dragon_side") ? "fb_dragon_side" : "boss_drongus";
    const es = sc.add.sprite(0, 0, wk, 0).setOrigin(0.5, 0.55);
    if (wk !== "fb_dragon_side") es.setTint(0x6d28d9);
    this.fit(es, 250);
    // wingbeats (the side art has no wings out: a slow heave of the whole body does it)
    sc.tweens.add({ targets: es, scaleY: es.scaleY * 1.04, scaleX: es.scaleX * 0.98, yoyo: true, repeat: -1, duration: 420, ease: "Sine.inOut" });
    const ec = sc.add.container(0, 0).setDepth(190);
    this.eAura = vfx(sc, "fe_vfx_darkaura", 0, 110, { scale: 2.4, depth: 0, alpha: 0.55, add: true });
    if (this.eAura) {
      this.eAura.setOrigin(0.5, 0.85);
      ec.add(this.eAura);
    } else {
      const da = sc.add.ellipse(0, 0, 120, 190, 0x4c1d95, 0.3).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: da, scaleX: 1.12, alpha: 0.15, yoyo: true, repeat: -1, duration: 400 });
      ec.add(da);
    }
    ec.add(es);
    this.e = { c: ec, spr: es, x: WW / 2 + 220, y: 280, vx: 0, vy: 0, face: -1 };
    this.place();
  }

  /** Scale a sprite (through the art factor) so it stands `h` px tall. */
  private fit(s: Phaser.GameObjects.Sprite, h: number) {
    const set = Math.abs(s.scaleX) / hdFactor(s);
    s.setScale((set * h) / Math.max(1, s.displayHeight));
  }

  private place() {
    const now = this.sc.time.now;
    const p = this.p;
    const e = this.e;
    p.c.setPosition(p.x, p.y + Math.sin(now / 260) * 4);
    p.spr.setFlipX(p.face < 0);
    this.shield?.setX(40 * p.face);
    e.c.setPosition(e.x, e.y + Math.sin(now / 330 + 1) * 5);
    // the dragon's art faces west
    e.spr.setFlipX(e.face > 0);
  }

  private mid() {
    return { x: (this.p.x + this.e.x) / 2, y: (this.p.y + this.e.y) / 2 };
  }

  // ---------------------------------------------------------------- input

  private inputs() {
    const sc = this.sc;
    const kb = sc.input.keyboard;
    if (kb) for (const a of ["up", "down", "left", "right", "attack", "special", "dodge", "interact", "burst", "cume"]) for (const k of keysFor(a)) if (!this.keys[k]) {
      try {
        this.keys[k] = kb.addKey(k, ["SPACE", "UP", "DOWN", "LEFT", "RIGHT"].includes(k));
      } catch {
        /* unbindable */
      }
    }
    sc.input.mouse?.disableContextMenu();
    const onDown = (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.on || ptr.wasTouch || over.length) return;
      if (ptr.rightButtonDown()) this.queued.kick = true;
      else this.queued.punch = true;
    };
    sc.input.on("pointerdown", onDown);
    sc.events.once("shutdown", () => sc.input.off("pointerdown", onDown));
    this.touchUi = TOUCH.enabled || isTouchDevice(sc.game) || !!(window as unknown as { __brawlTouch?: boolean }).__brawlTouch;
    // (phones: big controls from the phone layer instead of this pad; src/game/mobile/brawl.ts)
    if (this.touchUi && !(isMobile() && phoneHooks()?.brawl?.(this))) this.touchPad();
  }

  /** On-screen stick and buttons (phones, tablets): the UI scene's pad is hidden while this plays. */
  private touchPad() {
    const sc = this.sc;
    sc.input.addPointer(3);
    const L = sc.add.container(0, 0);
    Juice.layer(sc, 1060).add(L);
    this.padUi = L;
    const base = sc.add.circle(this.pad.ox, this.pad.oy, 58, 0xffffff, 0.1).setStrokeStyle(2, 0xffffff, 0.3);
    const knob = sc.add.circle(this.pad.ox, this.pad.oy, 26, 0xffffff, 0.3);
    const zone = sc.add.zone(0, 200, 400, 340).setOrigin(0).setInteractive();
    L.add([zone, base, knob]);
    zone.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pad.stick = p.id;
      this.pad.ox = Phaser.Math.Clamp(p.x, 70, 330);
      this.pad.oy = Phaser.Math.Clamp(p.y, 250, 480);
      base.setPosition(this.pad.ox, this.pad.oy);
      move(p);
    });
    const move = (p: Phaser.Input.Pointer) => {
      const dx = p.x - this.pad.ox;
      const dy = p.y - this.pad.oy;
      const len = Math.hypot(dx, dy);
      const k = len > 52 ? 52 / len : 1;
      knob.setPosition(this.pad.ox + dx * k, this.pad.oy + dy * k);
      const mag = len < 8 ? 0 : Math.min(1, (len - 8) / 26);
      this.pad.mx = len ? (dx / len) * mag : 0;
      this.pad.my = len ? (dy / len) * mag : 0;
    };
    sc.input.on("pointermove", (p: Phaser.Input.Pointer) => p.id === this.pad.stick && move(p));
    sc.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pad.stick) return;
      this.pad.stick = null;
      this.pad.mx = this.pad.my = 0;
      knob.setPosition(base.x, base.y);
    });
    const btn = (x: number, y: number, r: number, label: string, key: string, color: number) => {
      const c = sc.add.circle(x, y, r, color, 0.2).setStrokeStyle(3, color, 0.7).setInteractive();
      const t = sc.add.text(x, y, label, { fontFamily: FONT, fontSize: r > 36 ? "16px" : "12px", color: "#ffffff", fontStyle: "bold", align: "center", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5);
      L.add([c, t]);
      c.on("pointerdown", () => {
        this.pad.edges.add(key);
        this.pad.held.add(key);
        c.setFillStyle(color, 0.5);
      });
      const up = () => {
        this.pad.held.delete(key);
        c.setFillStyle(color, 0.2);
      };
      c.on("pointerup", up);
      c.on("pointerout", up);
    };
    btn(868, 430, 50, "PUNCH", "punch", 0xffd23f);
    btn(770, 474, 36, "KICK", "kick", 0xff7a3a);
    btn(888, 318, 34, "VANISH", "vanish", 0x93c5fd);
    btn(770, 372, 32, "KI", "ki", 0xfff4c2);
    btn(672, 482, 30, "BLOCK", "block", 0x86efac);
  }

  private read(): Input {
    const k = (action: string) => keysFor(action).some((n) => this.keys[n]?.isDown);
    const pad = this.sc.input.gamepad?.total ? this.sc.input.gamepad.getPad(0) : null;
    const ph = (a: string) => padHeld(pad as never, a);
    const edge = (name: string, down: boolean) => {
      const was = !!this.prev[name];
      this.prev[name] = down;
      return down && !was;
    };
    let mx = (k("right") ? 1 : 0) - (k("left") ? 1 : 0);
    let my = (k("down") ? 1 : 0) - (k("up") ? 1 : 0);
    if (pad && Math.hypot(pad.leftStick.x, pad.leftStick.y) > 0.2) {
      mx = pad.leftStick.x;
      my = pad.leftStick.y;
    }
    if (Math.hypot(this.pad.mx, this.pad.my) > 0.1) {
      mx = this.pad.mx;
      my = this.pad.my;
    } else if (TOUCH.enabled && Math.hypot(TOUCH.mx, TOUCH.my) > 0.1) {
      mx = TOUCH.mx;
      my = TOUCH.my;
    }
    const tEdge = (n: string) => {
      const had = this.pad.edges.has(n);
      this.pad.edges.delete(n);
      return had;
    };
    const inp: Input = {
      mx,
      my,
      punch: edge("punch", k("attack") || ph("attack")) || tEdge("punch") || this.queued.punch,
      kick: edge("kick", k("special") || ph("special")) || tEdge("kick") || this.queued.kick,
      vanish: edge("vanish", k("dodge") || ph("dodge")) || tEdge("vanish"),
      ki: k("burst") || k("cume") || ph("burst") || this.pad.held.has("ki"),
      block: k("interact") || ph("interact") || this.pad.held.has("block"),
    };
    this.queued.punch = this.queued.kick = false;
    if ((window as unknown as { __brawlBot?: boolean }).__brawlBot) return this.bot(inp);
    return inp;
  }

  /** An autopilot (tests and screenshots): closes in, mashes, kicks, vanishes out of telegraphs and chases launches. */
  private bot(inp: Input): Input {
    const now = this.sc.time.now;
    const p = this.p;
    const e = this.e;
    const o: Input = { ...inp, punch: false, kick: false, vanish: false, ki: false, block: false };
    const side = p.x < e.x ? -1 : 1;
    const tx = e.x + side * 80;
    o.mx = Phaser.Math.Clamp((tx - p.x) / 60, -1, 1);
    o.my = Phaser.Math.Clamp((e.y - p.y) / 60, -1, 1);
    const a = this.atk;
    if (a && !a.done && this.eState === "windup") {
      const left = a.hitAt - now;
      if (a.kind === "beam") {
        o.my = p.y > a.y ? 1 : -1;
        o.mx = 0;
        return o;
      }
      if (a.kind === "bolts" && Math.random() < 0.02) o.block = true;
      if (left < 220 && left > 60 && now >= this.vanishCd) o.vanish = true;
      return o;
    }
    if (now < this.chaseUntil) {
      o.vanish = Math.random() < 0.3;
      return o;
    }
    const d = Math.abs(e.x - p.x);
    if (d > 300 && this.ki > 30) o.ki = true;
    if (d < 170) {
      if (Math.random() < 0.06) o.kick = true;
      else o.punch = Math.random() < 0.55;
    }
    return o;
  }

  // ---------------------------------------------------------------- every frame

  private update() {
    if (!this.on) return;
    const sc = this.sc;
    const rt = performance.now();
    if (rt < this.freezeUntil) return;
    const slow = rt < this.slowUntil ? this.slowK : 1;
    if (!this.finishing && sc.tweens.timeScale !== slow) sc.tweens.timeScale = slow;
    const now = sc.time.now;
    const dt = (Math.min(50, sc.game.loop.delta) / 1000) * slow;
    const inp = this.read();
    if (!this.finishing) {
      this.updatePlayer(now, dt, inp);
      this.updateEnemy(now, dt);
      this.updateBolts(now, dt);
      this.cheers(now);
    } else this.rushInput(inp);
    this.place();
    this.updateCamera(dt);
    this.updateBackdrop(dt);
    this.updateHud(now);
  }

  private updateCamera(dt: number) {
    const cam = this.sc.cameras.main;
    const m = this.mid();
    const tx = m.x - 480 / cam.zoom;
    cam.scrollX += (tx - cam.scrollX) * Math.min(1, dt * 6);
  }

  // ---------------------------------------------------------------- you

  private updatePlayer(now: number, dt: number, inp: Input) {
    const p = this.p;
    const e = this.e;
    this.ki = Math.min(100, this.ki + dt * (inp.ki ? 6 : 18));
    const free = this.pState === "free" || this.pState === "block";
    if (free) p.face = e.x >= p.x ? 1 : -1;
    // vanish: out of anything but a knockdown
    if (inp.vanish && now >= this.vanishCd && this.pState !== "down" && this.pState !== "hurt") this.vanish(now, inp);
    else if (this.pState === "flurry") {
      if (inp.punch) this.flurryLast = now;
      if (now >= this.flurryTick) {
        this.flurryTick = now + 55;
        this.flurryHit(now);
      }
      if (now - this.flurryLast > 300 || now - this.flurryStart > 2600) this.flurryEnd(now);
    } else if (free || ((this.pState === "punch" || this.pState === "kick") && now >= this.actUntil - 40)) {
      if (inp.punch) this.punch(now);
      else if (inp.kick) this.kick(now);
      else if (now >= this.actUntil && this.pState !== "block") this.pState = "free";
    } else if (this.pState === "punch" && inp.punch) this.mash.push(now);
    if ((this.pState === "hurt" || this.pState === "punch" || this.pState === "kick") && now >= this.actUntil) this.pState = "free";
    // block
    if (this.pState === "free" && inp.block) {
      this.pState = "block";
      this.blockStart = now;
    } else if (this.pState === "block" && !inp.block) this.pState = "free";
    this.shield?.setFillStyle(0xfff4c2, this.pState === "block" ? 0.18 : 0).setStrokeStyle(4, GOLD, this.pState === "block" ? 0.9 : 0);
    // ki volley
    // (any time you're not reeling; out of ki it still spits weaker, slower shots)
    const canKi = this.pState === "free" || this.pState === "block" || this.pState === "punch" || this.pState === "kick";
    if (inp.ki && canKi && now - this.lastKi > (this.ki >= 3 ? 85 : 220)) this.kiBlast(now);
    // movement
    const sp = this.pState === "free" ? 360 : this.pState === "block" ? 110 : this.pState === "flurry" ? 60 : 0;
    if (sp) {
      p.vx += (inp.mx * sp - p.vx) * Math.min(1, dt * 12);
      p.vy += (inp.my * sp - p.vy) * Math.min(1, dt * 12);
    } else {
      p.vx *= Math.exp(-dt * 8);
      p.vy *= Math.exp(-dt * 8);
    }
    p.x = Phaser.Math.Clamp(p.x + p.vx * dt, 60, WW - 60);
    p.y = Phaser.Math.Clamp(p.y + p.vy * dt, TOP, BOT);
    // keep a little apart (you don't pass through him unless you vanish)
    const dx = p.x - e.x;
    if (Math.abs(dx) < 46 + ER && Math.abs(p.y - e.y) < 110 && this.eState !== "blink") p.x = e.x + (dx >= 0 ? 46 + ER : -46 - ER);
    // frames: screaming while firing ki or rushing, stance otherwise
    const ssj = p.spr.texture.key.startsWith("ssj_");
    if (ssj) p.spr.setFrame(this.pState === "flurry" || inp.ki ? 1 : 2);
    if (this.pState === "free" || this.pState === "block") p.c.setAngle(Phaser.Math.Clamp(p.vx / 40, -8, 8));
    // afterimages while moving fast
    if ((Math.hypot(p.vx, p.vy) > 300 || this.pState === "flurry") && now - this.lastGhost > 45) {
      this.lastGhost = now;
      this.ghost(p, GOLD, 0.35, 220);
    }
    // the chase prompt
    this.hud.chase.setVisible(now < this.chaseUntil).setPosition(480, 120);
  }

  private reachOk(rx: number, ry: number) {
    const p = this.p;
    const e = this.e;
    if (this.eState === "blink") return false;
    const dx = (e.x - p.x) * p.face;
    return dx > -24 && dx < rx + ER && Math.abs(e.y - p.y) < ry + 30;
  }

  /** Close the gap a bit on a swing (DBZ homing): up to `max` px toward him, if he's near. */
  private lunge(max: number) {
    const p = this.p;
    const e = this.e;
    const d = Math.abs(e.x - p.x);
    if (d > 460 + ER || this.eState === "blink") return;
    p.face = e.x >= p.x ? 1 : -1;
    const step = Math.min(max, Math.max(0, d - 70 - ER));
    if (step > 30) for (let k = 0; k < 5; k++) {
      const g = this.ghost(p, GOLD, 0.5 - k * 0.08, 180);
      g.x += step * p.face * (k / 5);
    }
    p.x += step * p.face;
    p.y += Phaser.Math.Clamp(e.y - p.y, -70, 70);
  }

  private punch(now: number) {
    this.mash = this.mash.filter((t) => now - t < 700);
    this.mash.push(now);
    if (this.mash.length >= 4 && this.reachOk(200, 110)) return this.flurryStartAt(now);
    this.chain = now - this.lastPunch < 420 ? (this.chain + 1) % 4 : 0;
    this.lastPunch = now;
    this.pState = "punch";
    this.actUntil = now + (this.chain === 3 ? 220 : 110);
    this.lunge(170);
    const p = this.p;
    // the pose: a hard straight jab, the body leaning into it (the last of the string is a spinning kick)
    const last = this.chain === 3;
    this.sc.tweens.killTweensOf(p.c);
    p.c.setAngle(last ? -22 * p.face : 10 * p.face);
    this.sc.tweens.add({ targets: p.c, angle: 0, duration: last ? 220 : 140, ease: "Quad.out" });
    this.lean(last ? 1.25 : 1.15);
    if (last) this.smear(p.x + p.face * 50, p.y - 4, p.face, 1.8);
    else this.jab(this.chain % 2 === 0 ? -26 : -6, 1 + this.chain * 0.15);
    synth.play("swing", 0.7);
    if (this.reachOk(last ? 140 : 120, 90)) this.hitEnemy(last ? 20 : 12 + this.chain * 2, last ? "kick" : "punch", now);
  }

  private flurryStartAt(now: number) {
    this.pState = "flurry";
    this.flurryStart = now;
    this.flurryLast = now;
    this.flurryTick = now;
    this.stats.flurries++;
    this.mash = [];
    Juice.slamText(this.sc, Phaser.Utils.Array.GetRandom(["ORA ORA ORA", "KREL KREL KREL KREL", "HAAAAAAA", "AT-AT-AT-AT-AT"]) as string, "#ffe066", 40, 140, 600);
    const stop = Juice.speedLines(this.sc, 0, 0xfff4c2, 4960);
    const end = () => stop();
    this.sc.time.delayedCall(2700, end);
    (this as unknown as { stopFlurryLines?: () => void }).stopFlurryLines = end;
  }

  private flurryHit(now: number) {
    const p = this.p;
    const e = this.e;
    // a blur of fists: afterimage fists all over him, and ghosts of you either side
    for (let i = 0; i < 2; i++) {
      const fx = e.x - p.face * (20 + Math.random() * 40);
      const fy = e.y - 40 + Math.random() * 70;
      const f = this.sc.add.image(fx - p.face * 40, fy, "br_fist").setDepth(260).setFlipX(p.face < 0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2 + Math.random() * 0.6);
      this.sc.tweens.add({ targets: f, x: fx, alpha: 0, duration: 110, onComplete: () => f.destroy() });
    }
    if (Math.random() < 0.5) {
      const g = this.ghost(p, 0xffffff, 0.3, 140);
      g.x += (Math.random() - 0.5) * 30;
      g.y += (Math.random() - 0.5) * 24;
    }
    p.c.setAngle((Math.random() - 0.5) * 10);
    p.x += (e.x - p.x - p.face * (72 + ER)) * 0.3;
    p.y += (e.y - p.y) * 0.3;
    if (this.reachOk(170, 110)) this.hitEnemy(5, "flurry", now);
    else synth.play("swing", 0.25);
  }

  private flurryEnd(now: number) {
    (this as unknown as { stopFlurryLines?: () => void }).stopFlurryLines?.();
    this.pState = "kick";
    this.actUntil = now + 320;
    const p = this.p;
    this.sc.tweens.killTweensOf(p.c);
    p.c.setAngle(-30 * p.face);
    this.sc.tweens.add({ targets: p.c, angle: 0, duration: 300, ease: "Back.out" });
    this.smear(p.x + p.face * 56, p.y - 30, p.face, 2);
    synth.play("punch_big");
    if (this.reachOk(170, 110)) this.hitEnemy(26, "launch", now);
  }

  private kick(now: number) {
    this.pState = "kick";
    this.actUntil = now + 300;
    this.stats.kicks++;
    this.lunge(220);
    const p = this.p;
    this.lean(1.3);
    this.sc.tweens.killTweensOf(p.c);
    p.c.setAngle(-28 * p.face);
    this.sc.tweens.add({ targets: p.c, angle: 0, duration: 280, ease: "Back.out" });
    this.smear(p.x + p.face * 60, p.y + 6, p.face, 2.2);
    synth.play("swing", 0.8);
    // a kick on someone already reeling launches him
    if (this.reachOk(150, 100)) this.hitEnemy(24, now < this.stunUntil ? "launch" : "kick", now);
  }

  private vanish(now: number, inp: Input) {
    const p = this.p;
    const e = this.e;
    this.vanishCd = now + 420;
    this.iframesUntil = now + 340;
    this.stats.vanishes++;
    const ox = p.x;
    const oy = p.y;
    this.ghost(p, 0xffffff, 0.6, 320);
    let tx: number;
    let ty: number;
    let strike = false;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (now < this.chaseUntil && this.launched) {
      // after a launch: ahead of him, and knock him back the way he came
      const dir = Math.sign(e.vx) || 1;
      tx = Phaser.Math.Clamp(e.x + dir * (130 + ER), 70, WW - 70);
      ty = e.y;
      this.chaseUntil = 0;
      p.face = (-dir as 1 | -1);
      this.pState = "free";
      this.sc.time.delayedCall(70, () => {
        if (!this.on || this.finishing) return;
        this.kickBack(this.sc.time.now);
      });
    } else if (d < 480 && this.eState !== "blink") {
      // behind him
      const side = p.x < e.x ? 1 : -1;
      tx = Phaser.Math.Clamp(e.x + side * (86 + ER), 60, WW - 60);
      ty = e.y;
      p.face = (-side as 1 | -1);
      strike = true;
    } else {
      const a = inp.mx || inp.my ? Math.atan2(inp.my, inp.mx) : Math.atan2(e.y - p.y, e.x - p.x);
      tx = Phaser.Math.Clamp(p.x + Math.cos(a) * 220, 60, WW - 60);
      ty = Phaser.Math.Clamp(p.y + Math.sin(a) * 220, TOP, BOT);
    }
    p.x = tx;
    p.y = ty;
    p.vx = p.vy = 0;
    if (this.pState === "flurry") this.flurryEnd(now);
    else if (this.pState !== "free") this.pState = "free";
    if (strike) this.vanishStrikeUntil = now + 700;
    // the zip: a streak where you were, a pop where you are
    const g = this.sc.add.graphics().setDepth(250).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(10, 0xfff4c2, 0.5).lineBetween(ox, oy, tx, ty);
    g.lineStyle(3, 0xffffff, 0.9).lineBetween(ox, oy, tx, ty);
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    p.c.setAlpha(0);
    this.sc.time.delayedCall(70, () => p.c.active && p.c.setAlpha(1));
    Juice.shockRing(this.sc, tx, ty, { color: 0xfff4c2, to: 80, rings: 1, ms: 220, depth: 250 });
    Juice.whoosh(0.5);
    synth.play("dodge", 0.7);
    if (strike) this.sc.cameras.main.scrollX += (tx - ox) * 0.06;
  }

  /** The chase hit: you were waiting there for him. */
  private kickBack(now: number) {
    const p = this.p;
    this.pState = "kick";
    this.actUntil = now + 260;
    this.stats.vanishStrikes++;
    this.sc.tweens.killTweensOf(p.c);
    p.c.setAngle(-34 * p.face);
    this.sc.tweens.add({ targets: p.c, angle: 0, duration: 260, ease: "Back.out" });
    this.smear(p.x + p.face * 60, p.y, p.face, 2.4);
    this.chases++;
    this.hitEnemy(22 + this.chases * 4, this.chases < 3 ? "launch" : "kick", now, true);
    Juice.slamText(this.sc, this.chases > 1 ? `VANISH CHAIN x${this.chases}` : "VANISH STRIKE!", "#93c5fd", 30, 170, 420);
  }

  private kiBlast(now: number) {
    const p = this.p;
    this.lastKi = now;
    const full = this.ki >= 3;
    this.ki = Math.max(0, this.ki - 3);
    if (this.pState === "block") this.pState = "free";
    this.stats.kis++;
    const hx = p.x + p.face * 46;
    const hy = p.y - 14 + (Math.random() - 0.5) * 12;
    const ang = Math.atan2(this.e.y - hy, this.e.x - hx);
    const a = Math.abs(Math.cos(ang)) < 0.3 ? (p.face > 0 ? 0 : Math.PI) : ang;
    const o = this.sc.add.circle(hx, hy, full ? 14 : 8, 0xfff4c2, 1).setDepth(280).setBlendMode(Phaser.BlendModes.ADD).setStrokeStyle(4, GOLD, 0.95);
    this.bolts.push({ o, vx: Math.cos(a) * 1150, vy: Math.sin(a) * 1150, dmg: full ? 11 : 5, mine: true, until: now + 1200 });
    const pop = this.sc.add.circle(hx, hy, 12, 0xffffff, 0.9).setDepth(281).setBlendMode(Phaser.BlendModes.ADD);
    this.sc.tweens.add({ targets: pop, scale: 3, alpha: 0, duration: 130, onComplete: () => pop.destroy() });
    Juice.kiZap(0.5);
    p.c.setAngle(-6 * p.face);
    p.vx -= p.face * 40;
    Juice.shake(this.sc, 50, 0.003);
  }

  private hurtPlayer(dmg: number, fromX: number, now: number, unblockable = false) {
    if (this.pState === "down" || this.finishing) return;
    const dd = diffFor(G.s);
    dmg = scaleInt(dmg, dd.damageTaken);
    const p = this.p;
    if (now < this.iframesUntil) {
      if (dmg > 0 && Math.random() < 0.5) this.float(p.x, p.y - 90, "MISS", "#93c5fd", 16);
      return;
    }
    const fromFront = (fromX - p.x) * p.face >= 0;
    if (this.pState === "block" && fromFront && !unblockable) {
      if (now - this.blockStart < 200 * dd.timing) {
        // PARRY: right on time
        this.stats.parries++;
        this.float(p.x, p.y - 100, "PARRY!", "#86efac", 26);
        synth.play("perfect");
        this.hitStop(110);
        Juice.shockRing(this.sc, p.x + p.face * 40, p.y, { color: 0x86efac, to: 140, rings: 2, ms: 300, depth: 300 });
        this.stunEnemy(now, 900);
        this.blockStart = 0;
        return;
      }
      this.stats.blocks++;
      const chip = Math.ceil(dmg * 0.2);
      this.hp -= chip;
      this.float(p.x, p.y - 90, "BLOCK", "#fde68a", 16);
      synth.play("hit", 0.6);
      p.vx = -p.face * 260;
      Juice.shake(this.sc, 120, 0.004);
      if (this.hp <= 0) this.knockDown(now);
      return;
    }
    this.stats.hurt++;
    this.hp -= dmg;
    this.combo = 0;
    if (this.pState === "flurry") (this as unknown as { stopFlurryLines?: () => void }).stopFlurryLines?.();
    this.pState = "hurt";
    this.actUntil = now + 320;
    this.iframesUntil = now + 450 * dd.iframes;
    const dir = Math.sign(p.x - fromX) || -p.face;
    p.vx = dir * 520;
    this.sc.tweens.killTweensOf(p.c);
    p.c.setAngle(dir * 18);
    this.sc.tweens.add({ targets: p.c, angle: 0, duration: 320 });
    p.spr.setTintFill(0xff4d4d);
    this.sc.time.delayedCall(80, () => p.spr.active && (p.spr.texture.key.startsWith("ssj_") ? p.spr.clearTint() : p.spr.setTint(0xfff0b0)));
    this.float(p.x, p.y - 90, `-${dmg}`, "#ff6b6b", 20);
    synth.play(Math.random() < 0.5 ? "hurt_1" : "hurt_2", 0.8);
    synth.play("punch", 0.7);
    Juice.shake(this.sc, 220, 0.012);
    Juice.flash(this.sc, 0xff2a2a, 200, 0.18, 1040);
    vfx(this.sc, "fe_vfx_kihit", p.x, p.y - 10, { scale: 0.9, depth: 300, add: true, tint: VIOLET });
    this.hitStop(60);
    if (this.hp <= 0) this.knockDown(now);
  }

  /** Knocked down: you tumble, he heals a chunk and cackles, and you get back up. */
  private knockDown(now: number) {
    const p = this.p;
    this.stats.kos++;
    this.pState = "down";
    this.hp = 0;
    this.iframesUntil = now + 4200;
    this.cancelAtk();
    this.eState = "cine";
    this.sc.tweens.add({ targets: p.c, angle: p.face * -540, duration: 900, ease: "Quad.out" });
    this.sc.tweens.add({ targets: p, y: BOT, x: p.x - p.face * 160, duration: 900, ease: "Quad.out" });
    Juice.slamText(this.sc, "KNOCKED DOWN!", "#ff6b6b", 44, 200, 900);
    Juice.shake(this.sc, 500, 0.016);
    synth.play("bodies_land");
    this.sc.time.delayedCall(1000, () => {
      if (!this.on) return;
      const heal = Math.round(BRAWL_HP * 0.15);
      this.sc.tweens.add({ targets: this, eHp: Math.min(BRAWL_HP, this.eHp + heal), duration: 900 });
      this.float(this.e.x, this.e.y - 110, "IT'S HEALING!", "#c084fc", 22);
      if (!synth.shout("concept_roar", 0.95, 1.2)) synth.play("roar");
      Juice.shockRing(this.sc, this.e.x, this.e.y, { color: 0x22c55e, to: 220, rings: 2, ms: 700, depth: 300 });
    });
    this.sc.time.delayedCall(2300, () => {
      if (!this.on) return;
      this.hp = 70;
      this.pState = "free";
      this.eState = "move";
      this.nextAttack = this.sc.time.now + 1400;
      this.sc.tweens.add({ targets: p.c, angle: 0, duration: 200 });
      Juice.slamText(this.sc, "GET UP!", "#ffe066", 50, 200, 700);
      Juice.shockRing(this.sc, p.x, p.y, { color: GOLD, to: 260, rings: 3, ms: 600, depth: 300 });
      synth.play("reveal_boom");
    });
  }

  // ---------------------------------------------------------------- your hits

  private hitEnemy(dmg: number, kind: "punch" | "kick" | "flurry" | "launch" | "ki", now: number, chase = false) {
    const p = this.p;
    const e = this.e;
    if (this.finishing || this.eState === "cine") return;
    let d = dmg;
    let vs = false;
    if (now < this.vanishStrikeUntil && kind !== "flurry") {
      d = Math.round(d * 1.6);
      vs = true;
      this.vanishStrikeUntil = 0;
      this.stats.vanishStrikes++;
      this.float(e.x, e.y - 130, "VANISH STRIKE!", "#93c5fd", 22);
    }
    // the opening third was a slog: hits land harder until he's down to two-thirds
    if (this.phase() === 0) d = Math.round(d * 1.6);
    this.eHp = Math.max(0, this.eHp - d);
    this.stats.hits++;
    this.combo = now - this.lastHit < 1300 ? this.combo + 1 : 1;
    this.comboDmg = this.combo === 1 ? d : this.comboDmg + d;
    this.lastHit = now;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.comboTaken++;
    this.ki = Math.min(100, this.ki + (kind === "flurry" ? 1 : 4));
    Juice.comboTick(this.combo);
    const heavy = kind === "kick" || kind === "launch" || vs;
    // the big ones: the end of a string, a launcher, a vanish strike
    const finisher = kind === "launch" || vs || (kind === "kick" && this.pState === "punch");
    const light = kind === "flurry" || kind === "ki";
    // where it lands
    const hx = e.x - p.face * 18 + (Math.random() - 0.5) * 16;
    const hy = e.y - 20 + (Math.random() - 0.5) * 40;
    vfx(this.sc, "fe_vfx_kihit", hx, hy, { scale: finisher ? 1.9 : heavy ? 1.5 : light ? 0.6 : 1.05, depth: 320, add: true, angle: Math.random() * 360 });
    if (heavy) {
      if (!vfx(this.sc, "tva_vfx_pow", hx, hy - 20, { scale: finisher ? 1.7 : 1.35, depth: 330 })) vfx(this.sc, "vfx_crit", hx, hy, { scale: 1.6, depth: 330 });
      this.impactFlash(hx, hy, finisher ? 1.6 : 1.2);
      this.impactLines(hx, hy, p.face, finisher ? 1.5 : 1.1);
      Juice.shockRing(this.sc, hx, hy, { color: GOLD, to: finisher ? 420 : 260, rings: finisher ? 3 : 2, ms: finisher ? 420 : 320, depth: 319 });
      // a flat ring of air blown out sideways: the shove goes right through him
      Juice.shockRing(this.sc, e.x + p.face * 40, e.y, { color: 0xffffff, to: finisher ? 520 : 340, rings: 1, ms: 360, depth: 318, flat: 0.32 });
      this.chunks(hx, hy, finisher ? 14 : 9, finisher ? 520 : 380);
      if (gore()) {
        if (!vfx(this.sc, "vfx_bloodspray", hx, hy, { scale: finisher ? 1.7 : 1.3, depth: 321, tint: 0x7c3aed, flipX: p.face < 0 })) vfx(this.sc, "vfx_blood", hx, hy, { scale: 1.2, depth: 321, tint: 0x7c3aed });
      } else vfx(this.sc, "vfx_stars", hx, hy - 30, { scale: 1, depth: 321 });
      if (this.fxOk(4)) vfx(this.sc, "vfx_blastsmoke", e.x + p.face * 30, e.y + 10, { scale: finisher ? 1.8 : 1.3, depth: 317, alpha: 0.75, flipX: p.face < 0 }) ?? vfx(this.sc, "vfx_smoke", e.x, e.y, { scale: 1.6, depth: 317 });
      // the sound: a stack of them, pitched down for weight (and a little different every time)
      const r = 0.82 + Math.random() * 0.12;
      synth.play(kind === "launch" ? "punch_big" : "crit", 1, r);
      synth.play("smash", 0.75, r * 0.85);
      synth.play("boom", finisher ? 0.8 : 0.5, 0.7 + Math.random() * 0.15);
      if (kind === "launch") synth.play("bonecrack", 0.7, 0.8 + Math.random() * 0.2);
      if (finisher) synth.play("explode", 0.45, 1.15 + Math.random() * 0.2);
      Juice.subDrop(finisher ? 0.9 : 0.6, finisher ? 0.9 : 0.6);
      Juice.punchZoom(this.sc, finisher ? 0.14 : 0.1, finisher ? 340 : 280, 1);
      this.camKick(p.face, finisher ? 26 : 16);
      Juice.shake(this.sc, finisher ? 420 : 320, kind === "launch" ? 0.03 : finisher ? 0.026 : 0.019);
      this.hitStop(finisher ? 120 : 100);
      if (finisher) this.burstLines(hx, hy, 240);
      // the biggest ones: a beat of slow motion as he goes
      if (kind === "launch" && (this.combo >= 6 || this.chases >= 1 || Math.random() < 0.35)) this.slowMo(0.3, 340);
      if (kind === "launch" && this.combo >= 8) void Juice.impactFrames(this.sc, e.spr, 40);
      this.float(hx, hy - 40, Phaser.Utils.Array.GetRandom(["BAM!", "KRAK!", "WHAM!", "DOOF!"]) as string, "#ffffff", finisher ? 34 : 28);
    } else if (kind === "flurry") {
      synth.play("hit", 0.5, 0.85 + Math.random() * 0.35);
      if (Math.random() < 0.3) synth.play("punch", 0.35, 1.1 + Math.random() * 0.3);
      this.hitStop(28);
      Juice.shake(this.sc, 70, 0.006);
      this.camKick(p.face, 3);
      if (Math.random() < 0.35) vfx(this.sc, "vfx_sparks", hx, hy, { scale: 1.1, depth: 322, add: true });
      if (Math.random() < 0.25) this.impactLines(hx, hy, p.face, 0.6);
    } else if (kind === "ki") {
      synth.play("hit", 0.45, 0.9 + Math.random() * 0.25);
      this.hitStop(26);
      Juice.shake(this.sc, 70, 0.005);
      Juice.shockRing(this.sc, hx, hy, { color: 0xfff4c2, to: 80, rings: 1, ms: 160, depth: 319 });
      if (Math.random() < 0.5) vfx(this.sc, "vfx_sparks", hx, hy, { scale: 1, depth: 322, add: true });
      this.float(hx, hy - 30, `${d}`, "#fff4c2", 16);
    } else {
      // a jab: crunchy, with real weight behind it (each in the string a bit heavier than the last)
      const k = 1 + this.chain * 0.18;
      const r = 1.08 - this.chain * 0.07 + Math.random() * 0.08;
      synth.play("punch", 1, r);
      synth.play("hit", 0.55, r * 0.9);
      synth.play("smash", 0.3 + this.chain * 0.08, 1.25 - this.chain * 0.1);
      this.hitStop(68 + this.chain * 9);
      Juice.shake(this.sc, 160, 0.01 + this.chain * 0.002);
      Juice.punchZoom(this.sc, 0.045 + this.chain * 0.012, 170, 1);
      this.camKick(p.face, 7 + this.chain * 3);
      this.impactFlash(hx, hy, 0.8 * k);
      this.impactLines(hx, hy, p.face, 0.75 * k);
      Juice.shockRing(this.sc, hx, hy, { color: 0xfff4c2, to: 130 * k, rings: 1, ms: 200, depth: 319 });
      vfx(this.sc, "vfx_sparks", hx, hy, { scale: 1.5 * k, depth: 322, add: true });
      if (this.chain >= 1) this.chunks(hx, hy, 3 + this.chain, 260);
      this.float(hx, hy - 30, `${d}`, "#fff4c2", 18 + this.chain * 2);
    }
    // flash, squash and recoil
    e.spr.setTintFill(calm() ? 0xffd6e0 : 0xffffff);
    this.sc.time.delayedCall(light ? 50 : 80, () => e.spr.active && (e.spr.texture.key === "fb_dragon_side" ? e.spr.clearTint() : e.spr.setTint(0x6d28d9)));
    if (!light) {
      this.squashTw?.stop();
      const sq = heavy ? 0.22 : 0.12;
      e.c.setScale(1 - sq, 1 + sq * 0.6);
      this.squashTw = this.sc.tweens.add({ targets: e.c, scaleX: 1, scaleY: 1, duration: heavy ? 320 : 200, ease: "Back.out" });
    }
    const armored = this.eState === "windup" && this.armored && !heavy;
    if (armored) {
      // he's winding up a big one and won't flinch for jabs: a purple glint says so
      if (Math.random() < 0.3) this.float(e.x, e.y - 110, "ARMOUR", "#c084fc", 14);
      return this.checkFinish(now);
    }
    if (this.eState === "windup") this.cancelAtk();
    const dir = p.face;
    if (kind === "launch") {
      this.launched = true;
      e.vx = dir * 1300;
      e.vy = (Math.random() - 0.5) * 260;
      this.stunEnemy(now, 950);
      this.chaseUntil = now + 650;
      if (!chase) this.chases = 0;
      this.sc.tweens.add({ targets: e.c, angle: dir * 360, duration: 600, onComplete: () => e.c.setAngle(0) });
    } else {
      e.vx = dir * (kind === "kick" ? 1000 : kind === "flurry" ? 110 : kind === "ki" ? 160 : 420 + this.chain * 60);
      this.stunEnemy(now, kind === "kick" ? 550 : kind === "flurry" ? 160 : 300);
      e.c.setAngle(dir * (kind === "kick" ? 30 : light ? 5 : 13));
      this.sc.tweens.add({ targets: e.c, angle: 0, duration: kind === "kick" ? 320 : 200 });
    }
    // smashed through the scenery: any big rock in his way goes to pieces
    if (heavy) this.smashRocks(e.x, e.y, dir);
    // too long in a string: he bursts out of it
    if (this.comboTaken >= 18 && kind !== "launch") {
      this.comboTaken = 0;
      this.sc.time.delayedCall(220, () => this.on && !this.finishing && this.startAtk("burst", this.sc.time.now));
    }
    this.checkFinish(now);
  }

  private checkFinish(now: number) {
    if (this.eHp > 0 || this.finishing) return;
    void this.finisher(now);
  }

  // ---------------------------------------------------------------- him

  private phase() {
    const k = this.eHp / BRAWL_HP;
    return k > 0.66 ? 0 : k > 0.33 ? 1 : 2;
  }

  private stunEnemy(now: number, ms: number) {
    this.eState = "stun";
    this.stunUntil = Math.max(this.stunUntil, now + ms);
    this.nextAttack = Math.max(this.nextAttack, now + ms + 250);
  }

  private updateEnemy(now: number, dt: number) {
    const e = this.e;
    const p = this.p;
    const ph = this.phase();
    if (ph > this.phaseShown) {
      this.phaseShown = ph;
      Juice.slamText(this.sc, ph === 1 ? "IT'S GETTING FASTER" : "IT'S DESPERATE", "#c084fc", 34, 150, 900);
      if (!synth.shout("concept_roar", 1, 1.3)) synth.play("roar");
      Juice.shockRing(this.sc, e.x, e.y, { color: VIOLET, to: 300, rings: 3, ms: 700, depth: 300 });
      this.eAura?.setAlpha(0.55 + ph * 0.18).setScale(1.5 + ph * 0.25);
    }
    // momentum, and bouncing off the edges of the sky
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vx *= Math.exp(-dt * (this.launched ? 2.4 : 6));
    e.vy *= Math.exp(-dt * 5);
    if (e.x < 70 || e.x > WW - 70) {
      e.x = Phaser.Math.Clamp(e.x, 70, WW - 70);
      if (Math.abs(e.vx) > 300) {
        // slammed into the edge of the storm: the sky itself cracks
        Juice.shake(this.sc, 260, 0.016);
        this.chunks(e.x, e.y, 10, 340);
        this.skyCrack(e.x, e.y, 1.2);
        synth.play("smash", 0.8, 0.75);
        synth.play("boom", 0.5, 0.8);
      }
      e.vx = -e.vx * 0.3;
    }
    e.y = Phaser.Math.Clamp(e.y, TOP, BOT);
    if (this.launched && Math.abs(e.vx) < 150) this.launched = false;
    if ((this.launched || Math.abs(e.vx) > 500) && now - this.lastGhost > 30) {
      this.lastGhost = now;
      this.ghost(e, VIOLET, 0.35, 200);
    }
    // blasted back: a trail of smoke torn off him
    if (Math.abs(e.vx) > 450 && now - this.lastTrail > 70 && this.fxOk()) {
      this.lastTrail = now;
      vfx(this.sc, "vfx_smoke", e.x - Math.sign(e.vx) * 70, e.y + (Math.random() - 0.5) * 60, { scale: 1.3, depth: 185, alpha: 0.6 });
    }
    if (this.eState === "cine" || this.eState === "blink") {
      this.runAtk(now);
      return;
    }
    if (this.eState === "stun") {
      if (now >= this.stunUntil) this.eState = "move";
      return;
    }
    if (this.eState === "windup") {
      e.face = this.atk?.dir ?? e.face;
      this.runAtk(now);
      return;
    }
    // move: hover in at arm's length, level with you
    e.face = p.x >= e.x ? 1 : -1;
    const want = (this.atkN % 3 === 1 ? 300 : 110) + ER;
    const tx = p.x - e.face * want;
    const sp = (170 + ph * 50) * dt;
    e.x += Phaser.Math.Clamp(tx - e.x, -sp * 1.6, sp * 1.6);
    e.y += Phaser.Math.Clamp(p.y - e.y, -sp, sp);
    if (now >= this.nextAttack && this.pState !== "down") this.pickAtk(now);
  }

  private pickAtk(now: number) {
    const ph = this.phase();
    const d = Math.abs(this.p.x - this.e.x);
    const pool: AtkKind[] = ["swing", "bolts", "blink"];
    if (ph >= 1) pool.push("beam");
    if (ph >= 2) pool.push("rush", "blink");
    let kind = pool[this.atkN % pool.length];
    if (kind === "swing" && d > 220) kind = Math.random() < 0.5 ? "bolts" : "blink";
    this.atkN++;
    this.startAtk(kind, now);
  }

  private startAtk(kind: AtkKind, now: number) {
    const e = this.e;
    const p = this.p;
    this.cancelAtk();
    const mul = [1, 0.85, 0.72][this.phase()];
    const tele = {
      swing: 560,
      bolts: 620,
      blink: 700,
      beam: 950,
      rush: 600,
      burst: 380,
    }[kind] * mul;
    const dir: 1 | -1 = p.x >= e.x ? 1 : -1;
    const a: Atk = { kind, hitAt: now + tele, endAt: now + tele + 500, done: false, x: p.x, y: p.y, dir, gfx: [] };
    this.atk = a;
    this.eState = kind === "blink" ? "blink" : "windup";
    this.armored = kind === "beam" || kind === "rush" || kind === "burst" || kind === "blink";
    this.comboTaken = 0;
    const sc = this.sc;
    // the "!" over his head
    const warn = sc.add.text(e.x, e.y - 160, "!", { fontFamily: "Impact, sans-serif", fontSize: "40px", color: kind === "beam" || kind === "rush" ? "#ff3b3b" : "#e9d5ff", stroke: "#12002a", strokeThickness: 6 }).setOrigin(0.5).setDepth(400);
    a.gfx.push(warn);
    sc.tweens.add({ targets: warn, scale: 1.3, yoyo: true, repeat: -1, duration: calm() ? 400 : 120 });
    synth.play("telegraph", 0.7);
    if (kind === "swing") {
      // the claws come up, dark fire swelling in them
      const orb = sc.add.circle(e.x, e.y - 60, 6, VIOLET, 0.9).setDepth(330).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: orb, radius: 22, duration: tele });
      a.gfx.push(orb);
      const arc = sc.add.graphics().setDepth(180);
      arc.fillStyle(0xff3b3b, 0.12).slice(e.x, e.y, 150, dir > 0 ? -1.2 : Math.PI - 1.2 + 0.0, dir > 0 ? 1.2 : Math.PI + 1.2, false).fillPath();
      a.gfx.push(arc);
      sc.tweens.add({ targets: arc, alpha: 2.5, duration: tele });
      sc.tweens.add({ targets: e.c, angle: -dir * 14, duration: tele * 0.8 });
    } else if (kind === "bolts") {
      const orb = sc.add.circle(e.x + dir * 30, e.y - 10, 4, VIOLET, 1).setDepth(330).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: orb, radius: 18, duration: tele });
      a.gfx.push(orb);
      this.float(e.x, e.y - 170, "SEE ALSO:", "#d8b4fe", 16);
    } else if (kind === "blink") {
      // he goes: a puff of black smoke, and a ring where he'll come out (behind you)
      this.ghost(e, 0x12002a, 0.6, 400);
      e.c.setAlpha(0);
      const bx = Phaser.Math.Clamp(p.x - (Math.sign(e.x - p.x) || 1) * (95 + ER), 70, WW - 70);
      a.x = bx;
      a.y = p.y;
      const ring = sc.add.ellipse(bx, p.y, 150, 150, 0x000000, 0).setStrokeStyle(4, VIOLET, 0.9).setDepth(330);
      sc.tweens.add({ targets: ring, scale: 0.55, duration: tele });
      a.gfx.push(ring);
      synth.play("zap", 0.6);
    } else if (kind === "beam") {
      // a line across your row: then a beam down it
      const y = p.y;
      a.y = y;
      const line = sc.add.rectangle(dir > 0 ? e.x : 0, y, dir > 0 ? WW - e.x : e.x, 4, 0xff3b3b, 0.6).setOrigin(0, 0.5).setDepth(170);
      sc.tweens.add({ targets: line, height: 60, alpha: 0.2, duration: tele });
      a.gfx.push(line);
      const orb = sc.add.circle(e.x + dir * 34, e.y - 4, 6, 0xc084fc, 1).setDepth(330).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: orb, radius: 30, duration: tele });
      a.gfx.push(orb);
      sc.tweens.add({ targets: e, y, duration: tele * 0.6 });
      Juice.slamText(sc, "[CITATION NEEDED]", "#e9d5ff", 26, 110, Math.max(300, tele - 400));
    } else if (kind === "rush") {
      sc.tweens.add({ targets: e.c, angle: -dir * 25, duration: tele });
      a.y = p.y;
    } else if (kind === "burst") {
      const ring = sc.add.circle(e.x, e.y, 30, VIOLET, 0.25).setDepth(330).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: ring, radius: 160, alpha: 0.08, duration: tele });
      a.gfx.push(ring);
      this.float(e.x, e.y - 130, "NO.", "#e9d5ff", 26);
    }
  }

  private cancelAtk() {
    const a = this.atk;
    if (!a) return;
    for (const o of a.gfx) {
      this.sc.tweens.killTweensOf(o);
      o.destroy();
    }
    a.gfx = [];
    this.atk = null;
    this.e.c.setAlpha(1);
    this.sc.tweens.killTweensOf(this.e.c);
    this.e.c.setAngle(0).setScale(1);
    if (this.eState === "windup" || this.eState === "blink") this.eState = "move";
  }

  private runAtk(now: number) {
    const a = this.atk;
    if (!a) {
      if (this.eState === "blink") this.eState = "move";
      return;
    }
    const e = this.e;
    const p = this.p;
    for (const o of a.gfx) if (o instanceof Phaser.GameObjects.Text) o.setPosition(e.x, e.y - 160);
    if (!a.done && now >= a.hitAt) {
      a.done = true;
      for (const o of a.gfx) if (!(o instanceof Phaser.GameObjects.Graphics) || a.kind !== "swing") {
        this.sc.tweens.killTweensOf(o);
        o.destroy();
      }
      a.gfx = a.gfx.filter((o) => o.active);
      const ph = this.phase();
      const sc = this.sc;
      if (a.kind === "swing") {
        // the claws come round
        sc.tweens.add({ targets: e.c, angle: a.dir * 30, duration: 90, yoyo: true });
        this.smear(e.x + a.dir * 70, e.y - 10, a.dir, 2.2, VIOLET);
        synth.play("swing");
        const dx = (p.x - e.x) * a.dir;
        if (dx > -20 && dx < 165 + ER && Math.abs(p.y - e.y) < 110) this.hurtPlayer(12 + ph * 2, e.x, now);
      } else if (a.kind === "bolts") {
        const n = 3 + ph;
        for (let i = 0; i < n; i++)
          sc.time.delayedCall(i * 120, () => {
            if (!this.on || this.finishing) return;
            const ang = Math.atan2(p.y - (e.y - 50), p.x - (e.x + a.dir * (ER + 10))) + (Math.random() - 0.5) * 0.12;
            const o = sc.add.circle(e.x + a.dir * (ER + 10), e.y - 50, 14, VIOLET, 1).setDepth(285).setStrokeStyle(3, 0x12002a, 0.9);
            this.bolts.push({ o, vx: Math.cos(ang) * (380 + ph * 60), vy: Math.sin(ang) * (380 + ph * 60), dmg: 7, mine: false, until: sc.time.now + 3500 });
            synth.play("pfft", 0.5);
          });
        a.endAt = now + n * 120 + 400;
      } else if (a.kind === "blink") {
        // out he comes, behind you, slashing
        e.x = a.x;
        e.y = a.y;
        e.face = p.x >= e.x ? 1 : -1;
        e.c.setAlpha(1);
        this.eState = "windup";
        Juice.shockRing(sc, e.x, e.y, { color: VIOLET, to: 150, rings: 2, ms: 260, depth: 330 });
        this.smear(e.x + e.face * 50, e.y, e.face, 2.4, VIOLET);
        synth.play("flesh_rip", 0.6);
        if (Math.hypot(p.x - e.x, p.y - e.y) < 115 + ER) this.hurtPlayer(15 + ph * 2, e.x, now);
      } else if (a.kind === "beam") {
        const y = a.y;
        const len = a.dir > 0 ? WW - e.x : e.x;
        const beam = sc.add.rectangle(e.x, y, len, 70, 0x7c3aed, 0.75).setOrigin(a.dir > 0 ? 0 : 1, 0.5).setDepth(290).setBlendMode(Phaser.BlendModes.ADD);
        const core = sc.add.rectangle(e.x, y, len, 22, 0xe9d5ff, 1).setOrigin(a.dir > 0 ? 0 : 1, 0.5).setDepth(291);
        sc.tweens.add({ targets: [beam, core], scaleY: 0.1, alpha: 0, delay: 380, duration: 200, onComplete: () => (beam.destroy(), core.destroy()) });
        synth.play("gun_rail");
        Juice.shake(sc, 400, 0.012);
        Juice.flash(sc, 0xa855f7, 260, 0.2, 1040);
        const along = (p.x - e.x) * a.dir;
        if (along > 0 && Math.abs(p.y - y) < 46) this.hurtPlayer(18 + ph * 2, e.x, now);
        a.endAt = now + 650;
      } else if (a.kind === "rush") {
        const dir = a.dir;
        const tx = Phaser.Math.Clamp(p.x + dir * 180, 70, WW - 70);
        const y0 = e.y;
        const hit = Math.abs(p.y - y0) < 70 && (p.x - e.x) * dir > 0 && (p.x - e.x) * dir < tx * dir - e.x * dir + 40;
        sc.tweens.add({ targets: e, x: tx, duration: 160, ease: "Quad.in" });
        for (let k = 0; k < 6; k++) sc.time.delayedCall(k * 25, () => this.ghost(e, VIOLET, 0.5, 260));
        synth.play("swing");
        Juice.whoosh(0.5);
        if (hit) sc.time.delayedCall(80, () => this.hurtPlayer(16 + ph * 2, e.x - dir * 40, sc.time.now));
        a.endAt = now + 600;
      } else if (a.kind === "burst") {
        Juice.shockRing(sc, e.x, e.y, { color: VIOLET, to: 260, rings: 3, ms: 420, depth: 330 });
        // (the rage flame loops: flare it up and fade it out, or it'd hang there for the rest of the fight)
        const flare = vfx(sc, "fe_vfx_rage", e.x, e.y, { scale: 2, depth: 331, add: true });
        if (flare) sc.tweens.add({ targets: flare, alpha: 0, scale: 2.6, delay: 250, duration: 450, onComplete: () => flare.destroy() });
        else vfx(sc, "vfx_shock", e.x, e.y, { scale: 2.4, depth: 331, tint: VIOLET, add: true });
        synth.play("boom", 0.7);
        Juice.shake(sc, 260, 0.012);
        if (Math.hypot(p.x - e.x, p.y - e.y) < 170 + ER) {
          this.hurtPlayer(8, e.x, now, true);
          p.vx = (Math.sign(p.x - e.x) || 1) * 700;
        }
      }
    }
    if (now >= a.endAt) {
      this.cancelAtk();
      this.eState = "move";
      const gap = [950, 760, 600][this.phase()];
      this.nextAttack = now + gap + Math.random() * 400;
    }
  }

  private updateBolts(now: number, dt: number) {
    const p = this.p;
    const e = this.e;
    for (const b of [...this.bolts]) {
      b.o.x += b.vx * dt;
      b.o.y += b.vy * dt;
      let dead = now > b.until || b.o.x < 0 || b.o.x > WW || b.o.y < -40 || b.o.y > 580;
      if (!dead && b.mine) {
        if (this.eState !== "blink" && Math.abs(b.o.x - e.x) < ER + 20 && Math.abs(b.o.y - e.y) < 120) {
          dead = true;
          this.hitEnemy(b.dmg, "ki", now);
        }
        // your ki shoots his bolts down
        for (const o of this.bolts) if (!o.mine && o.o.active && Math.hypot(o.o.x - b.o.x, o.o.y - b.o.y) < 24) {
          o.until = 0;
          dead = true;
          vfx(this.sc, "fe_vfx_kihit", o.o.x, o.o.y, { scale: 0.6, depth: 320, add: true });
        }
      } else if (!dead && Math.hypot(b.o.x - p.x, b.o.y - p.y) < 34) {
        dead = true;
        this.hurtPlayer(b.dmg, b.o.x - b.vx * 0.05, now);
      }
      if (b.mine && Math.random() < 0.6) {
        const t = this.sc.add.circle(b.o.x, b.o.y, 8, GOLD, 0.6).setDepth(279).setBlendMode(Phaser.BlendModes.ADD);
        this.sc.tweens.add({ targets: t, alpha: 0, scale: 0.2, duration: 160, onComplete: () => t.destroy() });
      }
      if (!b.mine && Math.random() < 0.3) {
        const t = this.sc.add.circle(b.o.x, b.o.y, 6, VIOLET, 0.5).setDepth(284).setBlendMode(Phaser.BlendModes.ADD);
        this.sc.tweens.add({ targets: t, alpha: 0, scale: 0.3, duration: 200, onComplete: () => t.destroy() });
      }
      if (dead) {
        b.o.destroy();
        this.bolts.splice(this.bolts.indexOf(b), 1);
      }
    }
  }

  // ---------------------------------------------------------------- the finisher: the RUSH

  private rushHits = 0;
  private rushUntil = 0;
  private rushNext = 0;

  private async finisher(now: number) {
    this.finishing = true;
    const sc = this.sc;
    const p = this.p;
    const e = this.e;
    this.cancelAtk();
    (this as unknown as { stopFlurryLines?: () => void }).stopFlurryLines?.();
    for (const b of this.bolts) b.o.destroy();
    this.bolts = [];
    this.eState = "cine";
    this.pState = "cine";
    this.hitStop(220);
    await Juice.impactFrames(sc, e.spr, 60);
    const close = Juice.letterbox(sc, 50, 300);
    Juice.slamText(sc, "FINISH IT!", "#ffe066", 64, 200, 800);
    if (!synth.shout("concept_roar", 1, 0.8)) synth.play("roar");
    e.vx = e.vy = 0;
    e.x = Phaser.Math.Clamp(e.x, 300, WW - 300);
    p.face = e.x >= p.x ? 1 : -1;
    const prompt = sc.add.text(480, 440, "MASH PUNCH!", { fontFamily: "Impact, sans-serif", fontSize: "40px", color: "#ffe066", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5);
    Juice.layer(sc, 1055).add(prompt);
    sc.tweens.add({ targets: prompt, scale: 1.15, yoyo: true, repeat: -1, duration: 140 });
    const stop = Juice.speedLines(sc, 0, 0xfff4c2, 4960);
    this.rushHits = 0;
    this.rushUntil = sc.time.now + 3400;
    this.rushNext = sc.time.now + 280;
    synth.play("reveal_boom");
    await new Promise<void>((res) => {
      const ev = sc.time.addEvent({
        delay: 30,
        loop: true,
        callback: () => {
          const t = sc.time.now;
          // on its own it keeps going, slower; mashing makes it a blur
          if (t >= this.rushNext) this.rushStrike(t, false);
          if (t >= this.rushUntil || this.rushHits >= 40) {
            ev.remove();
            res();
          }
        },
      });
    });
    stop();
    prompt.destroy();
    // the last one: over him, both fists, down he goes
    this.stats.rush = this.rushHits;
    p.x = e.x;
    p.y = e.y - 130;
    p.spr.texture.key.startsWith("ssj_") && p.spr.setFrame(1);
    this.ghost(p, 0xffffff, 0.7, 400);
    Juice.slamText(sc, "HAAAAAAAAA!!!", "#ffffff", 48, 150, 500);
    synth.play("telegraph");
    await this.wait(420);
    p.c.setAngle(p.face * 30);
    synth.play("punch_big", 1, 0.8);
    synth.play("bonecrack", 1, 0.85);
    synth.play("smash", 0.9, 0.6);
    synth.play("explode", 0.7, 0.9);
    this.hitStop(160);
    void Juice.impactFrames(sc, e.spr, 55);
    vfx(sc, "fe_vfx_kibig", e.x, e.y - 30, { scale: 2.2, depth: 340, add: true });
    this.impactFlash(e.x, e.y - 30, 2);
    this.impactLines(e.x, e.y - 30, 1, 2);
    this.impactLines(e.x, e.y - 30, -1, 2);
    this.skyCrack(e.x, e.y - 30, 2);
    this.chunks(e.x, e.y - 30, 18, 600);
    Juice.shockRing(sc, e.x, e.y - 30, { color: GOLD, to: 700, rings: 4, ms: 600, depth: 319 });
    this.burstLines(e.x, e.y - 30, 500);
    // (finishing: the fight's tweens are ours to slow) a long beat of slow motion as he goes down
    sc.tweens.timeScale = 0.35;
    window.setTimeout(() => this.sc.sys?.isActive() && (this.sc.tweens.timeScale = 1), 650);
    if (gore()) vfx(sc, "vfx_bloodspray", e.x, e.y - 20, { scale: 1.8, depth: 339, tint: 0x7c3aed });
    Juice.shake(sc, 700, 0.025);
    Juice.subDrop(1, 1.6);
    sc.tweens.add({ targets: e, y: 900, duration: 700, ease: "Quad.in" });
    sc.tweens.add({ targets: e.c, angle: 720, duration: 700 });
    for (let k = 0; k < 10; k++) sc.time.delayedCall(k * 50, () => this.ghost(e, VIOLET, 0.5, 300));
    await this.wait(980);
    // ...into the dragon, far below: the whole storm lights up
    synth.play("explode_2");
    synth.play("boom");
    if (!vfx(sc, "vfx_bigboom", 480, 470, { fixed: true, scale: 4, depth: -44 })) vfx(sc, "vfx_boom", 480, 470, { fixed: true, scale: 5, depth: -44 });
    Juice.flash(sc, 0xfff4c2, 600, 0.6, 1040);
    Juice.shake(sc, 1000, 0.02);
    if (this.bg.dragon) {
      this.bg.dragon.setTint(0xffffff);
      sc.time.delayedCall(200, () => this.bg.dragon?.active && this.bg.dragon.setTint(0x4c1d95));
    }
    p.c.setAngle(0);
    Juice.slamText(sc, `SUPER KRELWORLD RUSH  x${this.rushHits + 1}`, "#ffd23f", 46, 220, 1500);
    await this.wait(1900);
    close(400);
    if (this.padUi) this.padUi.setVisible(false);
    await this.talk(FB.FB_BRAWL_WIN);
    this.on = false;
    this.resolveWin?.();
  }

  private rushInput(inp: Input) {
    if (!this.finishing || this.sc.time.now >= this.rushUntil) return;
    if (inp.punch || inp.kick) this.rushStrike(this.sc.time.now, true);
  }

  /** One hit of the rush: you're everywhere round him at once. */
  private rushStrike(t: number, mashed: boolean) {
    if (t >= this.rushUntil) return;
    const sc = this.sc;
    const p = this.p;
    const e = this.e;
    this.rushHits++;
    this.rushNext = t + (mashed ? 320 : 260);
    const a = Math.random() * Math.PI * 2;
    this.ghost(p, GOLD, 0.45, 260);
    p.x = e.x + Math.cos(a) * 82;
    p.y = Phaser.Math.Clamp(e.y + Math.sin(a) * 70, TOP, BOT);
    p.face = e.x >= p.x ? 1 : -1;
    p.c.setAngle((Math.random() - 0.5) * 50);
    this.smear(e.x - p.face * 12, e.y - 10 + (Math.random() - 0.5) * 50, p.face, 1.6);
    vfx(sc, "fe_vfx_kihit", e.x + (Math.random() - 0.5) * 50, e.y + (Math.random() - 0.5) * 70, { scale: 1.1, depth: 330, add: true, angle: Math.random() * 360 });
    e.c.setAngle((Math.random() - 0.5) * 30);
    e.x += (Math.random() - 0.5) * 10;
    synth.play(this.rushHits % 3 ? "punch" : "crit", 0.7, 0.85 + Math.random() * 0.35);
    if (this.rushHits % 4 === 0) synth.play("smash", 0.4, 0.9 + Math.random() * 0.3);
    Juice.comboTick(this.rushHits);
    Juice.punchZoom(sc, 0.05, 140, 1);
    this.impactLines(e.x + (Math.random() - 0.5) * 50, e.y + (Math.random() - 0.5) * 60, p.face, 0.9);
    this.camKick(p.face, 6);
    if (this.rushHits % 3 === 0) Juice.shake(sc, 140, 0.012);
    if (this.rushHits % 5 === 0) this.chunks(e.x, e.y, 5, 380);
    this.combo = this.rushHits;
    this.lastHit = t;
  }

  // ---------------------------------------------------------------- bits

  /** Room for one more bit of optional flying junk (keeps the frame rate up in a long flurry). */
  private fxOk(extra = 0) {
    return this.sc.children.length + extra < 650;
  }

  /** Slow motion for `ms` real milliseconds at `k` (the fighters, their bolts and every tween). */
  private slowMo(k: number, ms: number) {
    this.slowK = k;
    this.slowUntil = performance.now() + ms;
  }

  /** Shove the camera along the punch (it eases back on its own: the camera follows the fight). */
  private camKick(dir: number, px: number) {
    if (calm()) px *= 0.4;
    this.sc.cameras.main.scrollX += dir * px;
  }

  /** A white-hot pop where it lands (a full-screen blink on the biggest ones). */
  private impactFlash(x: number, y: number, k: number) {
    const c = this.sc.add.circle(x, y, 26 * k, 0xffffff, 1).setDepth(326).setBlendMode(Phaser.BlendModes.ADD);
    this.sc.tweens.add({ targets: c, scale: 2.4, alpha: 0, duration: 130, ease: "Quad.out", onComplete: () => c.destroy() });
    if (k >= 1.5) Juice.flash(this.sc, 0xffffff, 110, 0.3, 1040, true);
  }

  /** Anime impact lines: a starburst of white streaks off the hit, flung mostly the way it's going. */
  private impactLines(x: number, y: number, dir: number, k: number) {
    if (!this.fxOk()) return;
    const g = this.sc.add.graphics().setDepth(325).setBlendMode(Phaser.BlendModes.ADD);
    const n = Math.round(9 * Math.min(1.6, k));
    for (let i = 0; i < n; i++) {
      const fwd = i < n * 0.6;
      const a = (fwd ? (dir > 0 ? 0 : Math.PI) : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * (fwd ? 1.1 : 0.6);
      const r0 = 18 * k + Math.random() * 12;
      const r1 = r0 + (50 + Math.random() * 90) * k * (fwd ? 1.3 : 0.8);
      g.lineStyle(1 + Math.random() * 3 * k, i % 3 ? 0xffffff : 0xfff4c2, 0.95);
      g.lineBetween(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
  }

  /** Speed lines rushing in on the hit (screen space), for a moment. */
  private burstLines(x: number, y: number, ms: number) {
    const cam = this.sc.cameras.main;
    Juice.speedLines(this.sc, ms, 0xffffff, 1030, (x - cam.worldView.x) * cam.zoom, (y - cam.worldView.y) * cam.zoom);
  }

  /** Bits of him (and the storm) blown off by the hit, tumbling down out of sight. */
  private chunks(x: number, y: number, n: number, speed: number) {
    if (!this.fxOk(n)) return;
    Juice.debris(this.sc, x, y, n, { colors: [0x2a1a3a, 0x4c1d95, 0xffd23f, 0x12002a, 0x6a5a72], speed, size: 7, depth: 318, floor: 700 });
  }

  /** The sky cracks: a jagged white-violet split in the storm behind them, gone in half a second. */
  private skyCrack(x: number, y: number, k: number) {
    if (!this.fxOk()) return;
    const g = this.sc.add.graphics().setDepth(-20).setBlendMode(Phaser.BlendModes.ADD);
    for (let b = 0; b < 4; b++) {
      let px = x;
      let py = y;
      const a = Math.random() * Math.PI * 2;
      g.lineStyle(4 * k, 0xd8c8ff, 0.9).beginPath().moveTo(px, py);
      for (let i = 0; i < 6; i++) g.lineTo((px += Math.cos(a + (Math.random() - 0.5) * 1.2) * 40 * k), (py += Math.sin(a + (Math.random() - 0.5) * 1.2) * 40 * k));
      g.strokePath();
    }
    this.sc.tweens.add({ targets: g, alpha: 0, delay: 120, duration: 420, onComplete: () => g.destroy() });
    if (!calm()) {
      const r = this.sc.add.rectangle(480, 270, 960, 540, 0xd8c8ff, 0.18).setScrollFactor(0).setDepth(-35).setBlendMode(Phaser.BlendModes.ADD);
      this.sc.tweens.add({ targets: r, alpha: 0, duration: 220, onComplete: () => r.destroy() });
    }
  }

  /** Knocked through the rubble hanging in the sky: any rock near his flight path goes to pieces. */
  private smashRocks(x: number, y: number, dir: number) {
    const cam = this.sc.cameras.main;
    for (const r of this.bg.rocks) {
      if (r.o.alpha < 0.5) continue;
      // where the rock is on screen, against where he is
      const rx = r.o.x - cam.scrollX * r.k;
      const ex = x - cam.scrollX;
      const ahead = (rx - ex) * dir;
      if (ahead < -40 || ahead > 320 || Math.abs(r.o.y - y) > 130) continue;
      const wx = rx + cam.scrollX;
      const fg = r.k > 1;
      this.sc.time.delayedCall(Math.max(0, ahead) * 0.4, () => {
        if (!r.o.active) return;
        this.chunks(wx, r.o.y, fg ? 12 : 7, fg ? 420 : 300);
        vfx(this.sc, "vfx_dust", wx, r.o.y, { scale: fg ? 2 : 1.3, depth: fg ? 601 : 317 });
        synth.play("smash", fg ? 0.7 : 0.45, 0.9 + Math.random() * 0.2);
        r.o.setAlpha(0);
        // another one drifts up from below, later
        this.sc.time.delayedCall(2500, () => {
          if (!r.o.active) return;
          r.o.y = 600;
          r.o.setAlpha(fg ? 0.9 : 0.8);
        });
      });
    }
  }

  /** A translucent copy of a fighter, fading where it stood. */
  private ghost(f: Fighter, tint: number, alpha: number, ms: number) {
    const s = f.spr;
    const g = this.sc.add.image(f.c.x, f.c.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setDepth(f.c.depth - 1).setTintFill(tint).setAlpha(alpha).setAngle(f.c.angle).setBlendMode(Phaser.BlendModes.ADD);
    // (match what's on screen exactly: the HD factor maths blew some afterimages up to twice his size)
    g.setDisplaySize(Math.abs(s.displayWidth), Math.abs(s.displayHeight));
    this.sc.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
    return g;
  }

  /** A straight punch: a streak from your shoulder and a big glowing fist that snaps out to his body. */
  private jab(dy: number, k: number) {
    const p = this.p;
    const e = this.e;
    const x0 = p.x + p.face * 30;
    const y0 = p.y + dy;
    const reach = Phaser.Math.Clamp(Math.abs(e.x - p.x) - ER + 30, 70, 150) * p.face;
    const g = this.sc.add.graphics().setDepth(270).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(18 * k, 0xfff4c2, 0.35).lineBetween(x0, y0, x0 + reach, y0);
    g.lineStyle(5 * k, 0xffffff, 0.95).lineBetween(x0 + reach * 0.3, y0, x0 + reach, y0);
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
    const f = this.sc.add.image(x0, y0, "br_fist").setDepth(275).setFlipX(p.face < 0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6 * k);
    this.sc.tweens.add({ targets: f, x: x0 + reach, scale: 2.4 * k, duration: 60, ease: "Quad.out" });
    this.sc.tweens.add({ targets: f, alpha: 0, delay: 70, duration: 90, onComplete: () => f.destroy() });
  }

  /** Throw your weight into it: a quick stretch along the punch, then back. */
  private lean(k: number) {
    const s = this.p.spr;
    const bx = Math.abs((s as unknown as { _bx?: number })._bx ?? s.scaleX);
    const by = Math.abs((s as unknown as { _by?: number })._by ?? s.scaleY);
    (s as unknown as { _bx?: number })._bx = bx;
    (s as unknown as { _by?: number })._by = by;
    this.sc.tweens.killTweensOf(s);
    s.setScale(bx * k, by / Math.sqrt(k));
    this.sc.tweens.add({ targets: s, scaleX: bx, scaleY: by, duration: 160, ease: "Back.out" });
  }

  /** A swoosh of a fist or a foot: a bright arc, gone in a blink. */
  private smear(x: number, y: number, dir: number, k: number, col = 0xfff4c2) {
    const g = this.sc.add.graphics().setDepth(270).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(10 * k, col, 0.35);
    g.beginPath();
    g.arc(x - dir * 30 * k, y, 34 * k, dir > 0 ? -1 : Math.PI - 1 + 0.0 + 0, dir > 0 ? 1 : Math.PI + 1, false);
    g.strokePath();
    g.lineStyle(3 * k, 0xffffff, 0.9);
    g.beginPath();
    g.arc(x - dir * 30 * k, y, 34 * k, dir > 0 ? -0.7 : Math.PI - 0.7, dir > 0 ? 0.7 : Math.PI + 0.7, false);
    g.strokePath();
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
  }

  private float(x: number, y: number, text: string, color: string, size: number) {
    const t = this.sc.add.text(x, y, text, { fontFamily: "Impact, sans-serif", fontSize: `${size}px`, color, stroke: "#000", strokeThickness: Math.max(3, size / 6) }).setOrigin(0.5).setDepth(450);
    this.sc.tweens.add({ targets: t, y: y - 36, alpha: 0, delay: 250, duration: 500, onComplete: () => t.destroy() });
  }

  /** Hit-stop: everything holds for a beat (real time). */
  private hitStop(ms: number) {
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
    this.sc.tweens.timeScale = 0.05;
    window.setTimeout(() => {
      const t = performance.now();
      if (this.sc.sys?.isActive() && t >= this.freezeUntil - 1) this.sc.tweens.timeScale = t < this.slowUntil ? this.slowK : 1;
    }, ms + 5);
  }

  private wait(ms: number) {
    return new Promise<void>((r) => this.sc.time.delayedCall(ms, () => r()));
  }

  /** The lads, down on the ground, yelling up at you. */
  private cheers(now: number) {
    if (now < this.nextCheer) return;
    this.nextCheer = now + 4200 + Math.random() * 3000;
    const ids = [...LADS, "MIKEY"].filter((x) => x !== G.s.player);
    const id = Phaser.Utils.Array.GetRandom(ids) as string;
    const line = Phaser.Utils.Array.GetRandom(FB.FB_BRAWL_CHEERS) as string;
    const left = Math.random() < 0.5;
    const t = this.sc.add.text(left ? 20 : 940, 470, `${CHARACTERS[id]?.name ?? id}: ${line}`, { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ffe066", stroke: "#000", strokeThickness: 4 }).setOrigin(left ? 0 : 1, 0.5).setAlpha(0);
    Juice.layer(this.sc, 1045).add(t);
    this.sc.tweens.add({ targets: t, alpha: 1, y: 455, duration: 200, yoyo: true, hold: 1600, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- the HUD

  private makeHud() {
    const sc = this.sc;
    const L = Juice.layer(sc, 1050);
    const root = sc.add.container(0, 0);
    L.add(root);
    const name = (CHARACTERS[G.s.player]?.name ?? "YOU").toUpperCase();
    const pName = sc.add.text(24, 18, `${name} · SUPER SAIYAN`, { fontFamily: "Impact, sans-serif", fontSize: "16px", color: "#ffe066", stroke: "#000", strokeThickness: 4 });
    const pBack = sc.add.rectangle(24, 44, 330, 16, 0x000000, 0.7).setOrigin(0, 0.5).setStrokeStyle(2, GOLD, 0.9);
    const pLag = sc.add.rectangle(26, 44, 326, 12, 0xffffff, 0.8).setOrigin(0, 0.5);
    const pBar = sc.add.rectangle(26, 44, 326, 12, GOLD, 1).setOrigin(0, 0.5);
    const kiBack = sc.add.rectangle(24, 62, 220, 8, 0x000000, 0.7).setOrigin(0, 0.5).setStrokeStyle(1, 0x93c5fd, 0.8);
    const kiBar = sc.add.rectangle(25, 62, 218, 6, 0x93c5fd, 1).setOrigin(0, 0.5);
    const kiLab = sc.add.text(250, 62, "KI", { fontFamily: FONT, fontSize: "11px", color: "#93c5fd", fontStyle: "bold" }).setOrigin(0, 0.5);
    const eName = sc.add.text(936, 18, "THE CONCEPT OF PAEDOPHILIA · ABRIDGED", { fontFamily: "Impact, sans-serif", fontSize: "16px", color: "#d8b4fe", stroke: "#000", strokeThickness: 4 }).setOrigin(1, 0);
    const eBack = sc.add.rectangle(936, 44, 330, 16, 0x000000, 0.7).setOrigin(1, 0.5).setStrokeStyle(2, VIOLET, 0.9);
    const eLag = sc.add.rectangle(934, 44, 326, 12, 0xffffff, 0.8).setOrigin(1, 0.5);
    const eBar = sc.add.rectangle(934, 44, 326, 12, VIOLET, 1).setOrigin(1, 0.5);
    const combo = sc.add.text(936, 120, "", { fontFamily: "Impact, sans-serif", fontSize: "40px", color: "#ffe066", stroke: "#000", strokeThickness: 8 }).setOrigin(1, 0.5).setAlpha(0);
    const dmg = sc.add.text(936, 156, "", { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setOrigin(1, 0.5).setAlpha(0);
    const chase = sc.add.text(480, 120, "VANISH! ›", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#93c5fd", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setVisible(false);
    sc.tweens.add({ targets: chase, scale: 1.15, yoyo: true, repeat: -1, duration: 120 });
    root.add([pName, pBack, pLag, pBar, kiBack, kiBar, kiLab, eName, eBack, eLag, eBar, combo, dmg, chase]);
    root.setAlpha(0);
    sc.tweens.add({ targets: root, alpha: 1, delay: 1200, duration: 400 });
    this.hud = { pBar, pLag, kiBar, eBar, eLag, combo, dmg, chase, root };
  }

  private updateHud(now: number) {
    const h = this.hud;
    const pk = Phaser.Math.Clamp(this.hp / P_MAX, 0, 1);
    const ek = Phaser.Math.Clamp(this.eHp / BRAWL_HP, 0, 1);
    h.pBar.width = 326 * pk;
    h.pLag.width += (h.pBar.width - h.pLag.width) * 0.06;
    h.eBar.width = 326 * ek;
    h.eLag.width += (h.eBar.width - h.eLag.width) * 0.06;
    h.kiBar.width = 218 * (this.ki / 100);
    h.pBar.setFillStyle(pk < 0.3 ? 0xff6b6b : GOLD);
    if (this.combo >= 3 && now - this.lastHit < 1300) {
      h.combo.setText(`${this.combo} HITS`).setAlpha(1).setColor(this.combo >= 40 ? "#ff7a1a" : this.combo >= 20 ? "#ffd23f" : "#fff4c2");
      h.dmg.setText(`${Math.round(this.comboDmg)} DMG`).setAlpha(1);
    } else if (h.combo.alpha > 0) {
      h.combo.setAlpha(Math.max(0, h.combo.alpha - 0.05));
      h.dmg.setAlpha(h.combo.alpha);
      if (this.combo >= 10 && h.combo.alpha <= 0.05) this.combo = 0;
    }
  }

  /** The controls, for a few seconds. */
  private legend() {
    const sc = this.sc;
    const text = this.touchUi
      ? "PUNCH: mash for a flurry   KICK: launch   KI: hold to blast   VANISH: behind it / after a launch   BLOCK: hold (just in time = PARRY)"
      : "J / click: PUNCH (mash = FLURRY)   K / right-click: KICK   R: KI BLASTS (hold)   Space: VANISH   E: BLOCK (hold)";
    const t = sc.add.text(480, 506, text, { fontFamily: FONT, fontSize: "12px", color: "#fff4c2", stroke: "#000", strokeThickness: 4, align: "center", wordWrap: { width: 900 } }).setOrigin(0.5);
    Juice.layer(sc, 1050).add(t);
    sc.tweens.add({ targets: t, alpha: 0, delay: 9000, duration: 800, onComplete: () => t.destroy() });
  }
}

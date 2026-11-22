import Phaser from "phaser";
import { playerKey } from "../../gfx/sanmikForm";
import { G } from "../../G";
import { Controls } from "../../combat/Controls";
import { DialogueBox } from "../../ui/DialogueBox";
import { switchTo } from "../../Flow";
import { synth } from "../../audio/Synth";
import { voice } from "../../audio/Voice";
import { FONT } from "../../ui/theme";
import { TOUCH } from "../../ui/TouchControls";
import { vfx } from "../../gfx/Vfx";
import * as Juice from "../../gfx/Juice";
import { animateWalker, charMeta } from "../../gfx/HD";
import { currentGun, FART_BLASTER } from "../../combat/Guns";
import { PLAYABLE_IDS, type Line } from "../../../data/types";
import { KRUNCHERS } from "../../../content/kreddle";
import {
  TAKEON_ARRIVE,
  TAKEON_BANNERS,
  TAKEON_BEATING,
  TAKEON_GENERAL,
  TAKEON_KREW_BRAVE,
  TAKEON_KREW_DOOMED,
  TAKEON_KRUNCHER_JEERS,
  TAKEON_SENDER,
  TAKEON_TANNOY,
  TAKEON_TAUNTS,
} from "../../../content/takeon";

/**
 * TAKING ON KREDDLE (Chapter 3): KreddleScene's "rout" mode. The krew march over the bridge armed and walk east up
 * the ordinary Kreddle Strip (the same street the Chapter 6 raid burns) into Kreddle's army. Your real guns fire, the
 * soldiers flinch and fall over, and get straight back up laughing: armour, tanks, a chopper with a spotlight, a
 * Tannoy taking bets, the Krunchers on deckchairs, and endless reinforcements pushing you back to the bridge. Then the
 * General, a cartoon beating, and the krew fired home out of a tank's barrel. Ammo isn't used up (it's a story beat).
 * Gore off: stars and dust, no blood. calmFlash: dimmed flashes (Juice.flash) and no strobing.
 */

const W = 2600;
const H = 700;
const TOP = 432;
const BOTTOM = 680;
/** How long the assault lasts (ms): at least MIN, at most MAX (morale running out ends it in between). */
const MIN_MS = 32000;
const MAX_MS = 55000;
const D_HUD = 5100;
const D_BUBBLE = 4970;
const MAX_SOLDIERS = 30;
const MAX_BUBBLES = 5;

interface Soldier {
  spr: Phaser.GameObjects.Image;
  rank: number;
  lane: number;
  hits: number;
  down: number;
  nextShot: number;
  flinch: number;
}
interface Tank {
  c: Phaser.GameObjects.Container;
  x: number;
  y: number;
  nextShot: number;
}
interface Lad {
  id: string;
  spr: Phaser.GameObjects.Sprite;
  off: { x: number; y: number };
  stun: number;
}
interface Shot {
  img: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible;
  vx: number;
  vy: number;
  left: number;
  blast: number;
  mine: boolean;
}
interface Bubble {
  t: Phaser.GameObjects.Text;
  follow: Phaser.GameObjects.Components.Transform | null;
  until: number;
}

type Phase = "intro" | "assault" | "cutscene";

export class KreddleRout {
  private sc: Phaser.Scene;
  private drawBackdrop: () => void;
  private controls!: Controls;
  private box!: DialogueBox;
  private me!: Phaser.GameObjects.Sprite;
  private phase: Phase = "intro";
  private busy = true;
  private soldiers: Soldier[] = [];
  private tanks: Tank[] = [];
  private lads: Lad[] = [];
  private shots: Shot[] = [];
  private bubbles: Bubble[] = [];
  private krunchers: Phaser.GameObjects.Sprite[] = [];
  private heli: Phaser.GameObjects.Image | null = null;
  private beam: Phaser.GameObjects.Triangle | null = null;
  private front = 900;
  private startAt = 0;
  private morale = 100;
  private hits = 0;
  private nextFire = 0;
  private nextTaunt = 0;
  private nextJeer = 0;
  private nextKrew = 0;
  private nextTannoy = 0;
  private nextSquad = 0;
  private nextLadShot = 0;
  private nextLaugh = 0;
  private recent: string[] = [];
  private tannoyIdx = 0;
  private hud!: Phaser.GameObjects.Text;
  private objective!: Phaser.GameObjects.Text;
  private moraleBar!: Phaser.GameObjects.Rectangle;
  private banner!: Phaser.GameObjects.Text;
  private touchFire = false;
  private fireBtn: Phaser.GameObjects.Arc | null = null;
  private pausedAt = 0;
  private gore = true;

  constructor(scene: Phaser.Scene, drawBackdrop: () => void) {
    this.sc = scene;
    this.drawBackdrop = drawBackdrop;
  }

  // ------------------------------------------------------------------ setup

  create() {
    const sc = this.sc;
    this.gore = G.meta.settings.gore !== false;
    synth.ambience("casino");
    sc.cameras.main.fadeIn(500);
    sc.cameras.main.setBounds(0, 0, W, H + 200);
    sc.cameras.main.setBackgroundColor(0x0b0618);
    // the Strip as it always is (KreddleScene's own street), then the army on top of it
    this.drawBackdrop();
    this.drawArmy();
    this.spawnKrunchers();
    this.spawnLads();
    this.me = sc.add.sprite(130, 560, playerKey(sc), 0).setScale(2).setDepth(560);
    this.me.setData("facing", "east");
    for (const l of this.lads) l.spr.setPosition(this.me.x + l.off.x, this.me.y + l.off.y);
    sc.cameras.main.startFollow(this.me, true, 0.1, 0.1, 0, 130);
    this.drawHud();
    this.controls = new Controls(sc);
    this.box = new DialogueBox(sc, 6000, 0.2);
    Juice.pinDialogue(sc, this.box);
    if (!sc.scene.isActive("UI")) sc.scene.launch("UI", { mode: "hub" });
    else sc.scene.get("UI").events.emit("mode", "hub");
    sc.events.off("ui-resume");
    sc.events.on("ui-resume", () => {
      this.busy = this.phase !== "assault";
      if (this.pausedAt) this.startAt += sc.time.now - this.pausedAt;
      this.pausedAt = 0;
      this.controls.swallow();
    });
    synth.music("klerble", true);
    sc.time.delayedCall(700, () => void this.intro());
  }

  /** The army: a wall of riot barriers, two gold tanks, a chopper with a spotlight, searchlights, and soldiers. */
  private drawArmy() {
    const sc = this.sc;
    // red alert over the whole Strip, and searchlights sweeping the sky
    for (let i = 0; i < 4; i++) {
      const beam = sc.add.triangle(220 + i * 180, 420, 0, 0, -30, -520, 30, -520, 0xffffff, 0.1).setOrigin(0, 0).setScrollFactor(0.25, 1).setDepth(-24).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: beam, angle: { from: -28, to: 28 }, yoyo: true, repeat: -1, duration: 1700 + i * 450, ease: "Sine.inOut" });
    }
    // KREDDLE ARMY banners over the Strip
    const sign = sc.add.text(1250, 150, "★ KREDDLE ARMED FORCES ★\nUNDEFEATED SINCE FOREVER", { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#facc15", align: "center", stroke: "#12001f", strokeThickness: 6 }).setOrigin(0.5).setDepth(460);
    sign.setShadow(0, 0, "#facc15", 14, true, true);
    // the barrier line across the street
    for (let y = 456; y <= 696; y += 40) {
      if (sc.textures.exists("rd_barrier")) sc.add.image(1040 + ((y / 40) % 2 ? -6 : 6), y, "rd_barrier").setOrigin(0.5, 1).setScale(0.9).setDepth(y - 1);
      else sc.add.rectangle(1040, y - 20, 20, 40, 0xfacc15).setDepth(y - 1);
    }
    // tanks, facing west (the art faces east: flipped)
    for (const [x, y] of [
      [1230, 540],
      [1310, 668],
    ]) {
      const c = sc.add.container(x, y).setDepth(y);
      if (sc.textures.exists("kd_esc_tank")) {
        c.add(sc.add.image(-73, -50, "kd_esc_tank").setOrigin(0, 0));
        if (sc.textures.exists("kd_esc_turret")) c.add(sc.add.image(-54, -80, "kd_esc_turret").setOrigin(0, 0));
      } else c.add(sc.add.image(0, -30, "p_tank"));
      c.setScale(-1.3, 1.3);
      this.tanks.push({ c, x, y, nextShot: 0 });
    }
    // the chopper, with a spotlight that follows you
    if (sc.textures.exists("kd_esc_heli")) {
      this.heli = sc.add.image(900, 200, "kd_esc_heli").setFlipX(true).setScale(1.4).setDepth(4700);
      sc.tweens.add({ targets: this.heli, y: 215, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
      this.beam = sc.add.triangle(900, 215, 0, 0, -70, 380, 70, 380, 0xffffcc, 0.16).setOrigin(0, 0).setDepth(4699).setBlendMode(Phaser.BlendModes.ADD);
    }
    // the first soldiers: three ranks in front of the barriers
    for (let i = 0; i < 15; i++) this.addSoldier(760 + Math.floor(i / 5) * 90 + Math.random() * 20, i % 5, Math.floor(i / 5));
  }

  private addSoldier(x: number, lane: number, rank: number) {
    if (this.soldiers.length >= MAX_SOLDIERS) return;
    const sc = this.sc;
    const key = sc.textures.exists("kd_esc_cop") ? "kd_esc_cop" : "spr_COP";
    const y = TOP + 26 + lane * 52 + (rank % 2) * 12;
    // the art faces east: flipped to face the krew; olive and gunmetal for the army (not the KPD)
    const spr = sc.add.image(x, y, key, 0).setOrigin(0.5, 1).setScale(1.5).setFlipX(true).setDepth(y);
    spr.setTint([0xb8c49a, 0xa8b0c0, 0xd0c8a0][Math.floor(Math.random() * 3)]);
    this.soldiers.push({ spr, rank, lane, hits: 0, down: 0, nextShot: this.sc.time.now + 1200 + Math.random() * 2400, flinch: 0 });
  }

  /** The Kreddle Krunchers on the pavement, watching, with popcorn. Bullets go round them (they're spectators). */
  private spawnKrunchers() {
    const sc = this.sc;
    KRUNCHERS.forEach((k, i) => {
      if (!sc.textures.exists(`spr_${k.of}`)) return;
      const x = 640 + i * 46;
      const y = 448 + (i % 2) * 6;
      const sp = sc.add.sprite(x, y, `spr_${k.of}`, 0).setScale(1.7).setDepth(y).setTint(i % 2 ? 0xff9de6 : 0x9be7ff);
      sp.setData("name", k.name);
      const meta = charMeta(sc, sp.texture.key);
      if (meta) sp.setFrame(meta.idle.south ?? 0);
      sc.tweens.add({ targets: sp, y: y - 3, yoyo: true, repeat: -1, duration: 400 + i * 30 });
      this.krunchers.push(sp);
    });
    sc.add.text(830, 400, "THE KREDDLE KRUNCHERS (SPECTATING) 🍿", { fontFamily: "Impact, sans-serif", fontSize: "14px", color: "#ff4fd8", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(470);
  }

  private spawnLads() {
    const sc = this.sc;
    const ids = PLAYABLE_IDS.filter((id) => id !== G.s.player && sc.textures.exists(`spr_${id}`));
    ids.forEach((id, i) => {
      const spr = sc.add.sprite(0, 0, `spr_${id}`, 0).setScale(2).setDepth(500);
      spr.setData("facing", "east");
      const row = i % 4;
      const col = Math.floor(i / 4);
      this.lads.push({ id, spr, off: { x: -60 - col * 60 - (row % 2) * 25, y: -75 + row * 50 }, stun: 0 });
    });
  }

  private drawHud() {
    const sc = this.sc;
    const bg = sc.add.rectangle(480, 132, 960, 26, 0x7f1d1d, 0.85).setScrollFactor(0).setDepth(D_HUD);
    this.banner = sc.add.text(480, 132, TAKEON_BANNERS[0], { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ffffff", stroke: "#3b0000", strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(D_HUD + 1);
    let k = 0;
    sc.time.addEvent({ delay: 3600, loop: true, callback: () => this.banner.setText(TAKEON_BANNERS[++k % TAKEON_BANNERS.length]) });
    this.hud = sc.add.text(950, 160, "", { fontFamily: FONT, fontSize: "13px", color: "#facc15", fontStyle: "bold", stroke: "#000", strokeThickness: 4, align: "right" }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_HUD);
    this.objective = sc.add.text(10, 160, "", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 4, wordWrap: { width: 560 } }).setScrollFactor(0).setDepth(D_HUD);
    const label = sc.add.text(10, 186, "KRELWORLD MORALE", { fontFamily: FONT, fontSize: "11px", color: "#bde0fe", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setScrollFactor(0).setDepth(D_HUD);
    const back = sc.add.rectangle(10, 204, 220, 10, 0x111111).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D_HUD).setStrokeStyle(1, 0xffffff, 0.6);
    this.moraleBar = sc.add.rectangle(10, 204, 220, 10, 0x22d3ee).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D_HUD);
    Juice.layer(sc, D_HUD).add([bg, this.banner, this.hud, this.objective, label, back, this.moraleBar]);
    this.setHud(false);
  }

  private setHud(on: boolean) {
    for (const o of [this.banner, this.hud, this.objective, this.moraleBar]) o.setVisible(on);
  }

  // ------------------------------------------------------------------ the story beats

  private async talk(lines: Line[]) {
    this.busy = true;
    await this.box.play(lines);
    this.controls.swallow();
    this.busy = this.phase !== "assault";
  }

  private wait(ms: number) {
    return new Promise<void>((r) => this.sc.time.delayedCall(ms, () => r()));
  }

  private alive() {
    return !!this.sc.sys && this.sc.sys.settings.status < Phaser.Scenes.SHUTDOWN;
  }

  private async intro() {
    const sc = this.sc;
    const cam = sc.cameras.main;
    const bars = Juice.letterbox(sc, 52, 500, D_HUD + 2);
    await Juice.titleCard(sc, "CHAPTER 3 · THE KREDDLE BRIDGE", "TAKING ON KREDDLE", "THE PLAN: ???", 1600, D_HUD + 9, 300);
    // the army, all the way up the Strip
    cam.stopFollow();
    Juice.whoosh(0.5);
    cam.pan(1100, 560, 1300, "Cubic.easeInOut", true);
    await this.wait(1350);
    synth.play("crowd_gasp");
    await this.talk(TAKEON_ARRIVE.slice(0, 2));
    await this.talk(TAKEON_ARRIVE.slice(2, 5));
    synth.play("laugh");
    cam.pan(this.me.x + 200, 560, 900, "Cubic.easeInOut", true);
    await this.wait(950);
    cam.startFollow(this.me, true, 0.1, 0.1, 0, 130);
    await this.talk(TAKEON_ARRIVE.slice(5, -1));
    bars(300);
    if (!this.alive()) return;
    Juice.slamText(sc, "TAKE KREDDLE!", "#22d3ee", 56, 240, 900);
    await this.talk(TAKEON_ARRIVE.slice(-1));
    const now = sc.time.now;
    this.startAt = now;
    this.nextTaunt = now + 1500;
    this.nextJeer = now + 6000;
    this.nextKrew = now + 2500;
    this.nextTannoy = now + 9000;
    this.nextSquad = now + 4000;
    this.nextLaugh = now + 3000;
    this.setHud(true);
    this.phase = "assault";
    this.busy = false;
  }

  // ------------------------------------------------------------------ the loop

  update(_loopTime: number, delta: number) {
    // (the scene clock, like every timer here: the loop time runs ahead of it when frames are slow)
    const time = this.sc.time.now;
    const s = G.s;
    s.playtimeMs += Math.min(delta, 50);
    const dt = Math.min(delta, 50);
    this.updateShots(dt);
    this.updateBubbles(time);
    this.updateLads(time, dt);
    if (this.heli && this.beam) {
      this.heli.x += (this.me.x + 120 - this.heli.x) * Math.min(1, dt / 900);
      this.beam.setPosition(this.heli.x, this.heli.y + 10).setAngle(Phaser.Math.Clamp((this.heli.x - this.me.x) * 0.08, -25, 25));
    }
    if (this.phase === "assault") this.updateArmy(time, dt);
    if (this.busy) {
      animateWalker(this.me, 0, 0, false, time);
      this.controls.interact();
      return;
    }
    if (this.controls.pause()) {
      this.pausedAt = this.sc.time.now;
      this.busy = true;
      this.sc.scene.launch("Menu", { mode: "pause", caller: "Kreddle" });
      this.sc.scene.pause();
      return;
    }
    this.controls.interact();
    const mv = this.controls.move();
    const sp = 170 * (dt / 1000);
    const maxX = Math.max(80, this.front - 70);
    this.me.x = Phaser.Math.Clamp(this.me.x + mv.x * sp, 60, maxX);
    this.me.y = Phaser.Math.Clamp(this.me.y + mv.y * sp, TOP, BOTTOM);
    this.me.setDepth(this.me.y);
    if (TOUCH.enabled && !this.fireBtn) this.makeFireButton();
    const firing = this.controls.attackHeld() || this.touchFire;
    this.controls.autoAim = this.nearestAngle();
    const a = this.controls.aim(this.me.x, this.me.y - 22);
    const moving = Math.hypot(mv.x, mv.y) > 0.1;
    if (firing) animateWalker(this.me, Math.cos(a), Math.sin(a), moving, time);
    else animateWalker(this.me, mv.x, mv.y, moving, time);
    if (firing && time > this.nextFire) this.fire(a, time);
    // done: morale's gone (after the minimum), or the clock's run out
    const t = time - this.startAt;
    if ((t > MIN_MS && this.morale <= 0) || t > MAX_MS) void this.beaten();
  }

  private nearestAngle(): number | null {
    let best: Soldier | null = null;
    let bd = 520;
    for (const so of this.soldiers) {
      const d = Math.abs(so.spr.x - this.me.x) + Math.abs(so.spr.y - this.me.y) * 0.6;
      if (d < bd) {
        bd = d;
        best = so;
      }
    }
    return best ? Math.atan2(best.spr.y - 40 - (this.me.y - 22), best.spr.x - this.me.x) : 0;
  }

  /** Your real gun (or the Fart Blaster): its rate, pellets, spread, speed, range and sound. Ammo isn't spent. */
  private fire(a: number, time: number) {
    const sc = this.sc;
    const g = currentGun();
    const cd = g ? g.cd : FART_BLASTER.cd;
    this.nextFire = time + Math.max(70, cd);
    const pellets = g ? Math.min(8, g.pellets) : 1;
    const spread = g ? g.spread : 0.05;
    const speed = g ? g.speed : FART_BLASTER.speed;
    const range = g ? g.range : FART_BLASTER.range;
    const color = g ? g.color : 0x9acd32;
    const ox = this.me.x + Math.cos(a) * 26;
    const oy = this.me.y - 22 + Math.sin(a) * 26;
    for (let i = 0; i < pellets; i++) {
      const aa = a + (pellets > 1 ? (i / (pellets - 1) - 0.5) * spread : (Math.random() - 0.5) * spread);
      const img = g?.shotTex && sc.textures.exists(g.shotTex) ? sc.add.image(ox, oy, g.shotTex).setRotation(aa) : sc.add.rectangle(ox, oy, g ? 12 : 10, g ? 4 : 10, color).setRotation(aa);
      img.setDepth(this.me.y + 5);
      this.shots.push({ img, vx: Math.cos(aa) * speed, vy: Math.sin(aa) * speed, left: range, blast: g?.blast ?? 0, mine: true });
    }
    vfx(sc, "vfx_muzzle", ox, oy, { scale: 0.8, depth: this.me.y + 6 });
    synth.play(g ? (g.sfx ?? `gun_${g.id}`) : "pfft_1", 0.7);
  }

  private updateShots(dt: number) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const step = dt / 1000;
      s.img.x += s.vx * step;
      s.img.y += s.vy * step;
      s.left -= Math.hypot(s.vx, s.vy) * step;
      let hit: Soldier | null = null;
      let tank: Tank | null = null;
      if (s.mine) {
        for (const so of this.soldiers) {
          if (so.down) continue;
          if (Math.abs(so.spr.x - s.img.x) < 22 && s.img.y < so.spr.y + 4 && s.img.y > so.spr.y - 90) {
            hit = so;
            break;
          }
        }
        if (!hit) for (const t of this.tanks) if (Math.abs(t.x - s.img.x) < 95 && s.img.y < t.y + 4 && s.img.y > t.y - 110) tank = t;
        if (!hit && !tank && this.heli && Math.abs(this.heli.x - s.img.x) < 70 && Math.abs(this.heli.y - s.img.y) < 30) {
          this.ping(s.img.x, s.img.y, "PING!");
          s.left = 0;
        }
      }
      if (hit) this.hitSoldier(hit, s);
      else if (tank) {
        this.ping(s.img.x, s.img.y, Math.random() < 0.3 ? "TINK." : "PING!");
        if (s.blast) this.boomAt(s.img.x, s.img.y, 0.8, false);
      }
      if (hit || tank || s.left <= 0 || s.img.x < 0 || s.img.x > W) {
        if (s.left <= 0 && s.blast && s.mine) this.boomAt(s.img.x, s.img.y, 0.8, false);
        s.img.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  /** A hit: sparks off the armour, a flinch, now and then a fall. They always get back up, laughing. */
  private hitSoldier(so: Soldier, s: Shot) {
    const sc = this.sc;
    this.hits++;
    so.hits++;
    this.ping(s.img.x, s.img.y, Math.random() < 0.18 ? (Math.random() < 0.5 ? "0 DMG" : "ARMOURED") : Math.random() < 0.4 ? "PING!" : "");
    // flinch
    so.spr.setTintFill(0xffffff);
    so.flinch = sc.time.now + 70;
    so.spr.x += 5;
    if (s.blast) this.boomAt(s.img.x, s.img.y, 0.8, false);
    // enough of them (or a big one) and he goes over
    if (so.hits >= 16 || (s.blast && Math.random() < 0.6)) {
      so.hits = 0;
      so.down = sc.time.now + 1500;
      sc.tweens.add({ targets: so.spr, angle: -80, duration: 200, ease: "Quad.out" });
      vfx(sc, "vfx_dust", so.spr.x, so.spr.y, { scale: 1, depth: so.spr.y + 1 });
      vfx(sc, "vfx_stars", so.spr.x - 20, so.spr.y - 30, { scale: 0.9, depth: D_BUBBLE - 1 });
      synth.play("hit");
      sc.time.delayedCall(1500, () => {
        if (!so.spr.active) return;
        sc.tweens.add({ targets: so.spr, angle: 0, duration: 260, ease: "Back.out" });
        so.down = 0;
        this.bubble(so.spr, "Ow. No. Wait. That didn't hurt at all.", "#ffe0a3");
        if (!voice.busy()) voice.say("KREDDLE SOLDIER", "Ow. No. Wait. That didn't hurt at all.");
      });
    }
  }

  private ping(x: number, y: number, text: string) {
    const sc = this.sc;
    vfx(sc, "vfx_sparks", x, y, { scale: 0.6, depth: D_BUBBLE - 2 }) ?? vfx(sc, "vfx_hit", x, y, { scale: 0.6, depth: D_BUBBLE - 2 });
    if (Math.random() < 0.5) synth.play("whack_bonk", 0.35);
    if (text) this.floatText(x, y - 10, text, text === "PING!" || text === "TINK." ? "#e5e7eb" : "#9ca3af");
  }

  private boomAt(x: number, y: number, size: number, hurt: boolean) {
    const sc = this.sc;
    vfx(sc, "vfx_boom", x, y, { scale: size, depth: y + 40 });
    vfx(sc, "vfx_smoke", x, y - 10, { scale: size, depth: y + 39, delay: 200 });
    synth.play("explode", 0.6);
    Juice.shake(sc, 160, 0.006 * size);
    if (!hurt) return;
    // anyone close gets blown up in the air (cartoon: stars, never blood)
    for (const l of this.lads) {
      if (Phaser.Math.Distance.Between(l.spr.x, l.spr.y, x, y) > 110 || l.stun > sc.time.now) continue;
      l.stun = sc.time.now + 900;
      const y0 = l.spr.y;
      sc.tweens.add({ targets: l.spr, y: y0 - 70, angle: (Math.random() - 0.5) * 360, duration: 320, yoyo: true, ease: "Quad.out", onComplete: () => l.spr.setAngle(0) });
      sc.time.delayedCall(640, () => vfx(sc, "vfx_stars", l.spr.x, l.spr.y - 40, { scale: 0.8, depth: D_BUBBLE - 1 }));
    }
    if (Phaser.Math.Distance.Between(this.me.x, this.me.y, x, y) < 110) this.hurtMe(8, x);
  }

  private hurtMe(n: number, fromX: number) {
    const sc = this.sc;
    const t = sc.time.now - this.startAt;
    this.morale = Math.max(t < MIN_MS ? 8 : 0, this.morale - n);
    this.me.setTintFill(0xff6060);
    sc.time.delayedCall(80, () => this.me.clearTint());
    this.me.x = Math.max(60, this.me.x - Math.sign(fromX - this.me.x || 1) * 18);
    Juice.shake(sc, 90, 0.004);
    if (Math.random() < 0.4) synth.play(Math.random() < 0.5 ? "hurt_1" : "hurt_2", 0.6);
  }

  // ------------------------------------------------------------------ the army

  private updateArmy(time: number, dt: number) {
    const sc = this.sc;
    const t = time - this.startAt;
    const k = Phaser.Math.Clamp(t / MAX_MS, 0, 1);
    // the front creeps west, faster as it goes on; morale drains on its own as it sinks in
    this.front = Math.max(330, this.front - (6 + 16 * k) * (dt / 1000));
    this.morale = Math.max(t < MIN_MS ? 8 : 0, this.morale - (0.6 + 1.3 * k) * (dt / 1000));
    this.moraleBar.width = 220 * (this.morale / 100);
    this.moraleBar.setFillStyle(this.morale > 50 ? 0x22d3ee : this.morale > 20 ? 0xfacc15 : 0xef4444);
    this.hud.setText(`HITS: ${this.hits}\nDAMAGE DONE: 0\nKREDDLE TAKEN: 0%`);
    this.objective.setText(t < 12000 ? "▶ EAST! Take Kreddle! (hold attack to shoot)" : t < 26000 ? "▶ Keep shooting! It's… definitely working?" : "▶ Hold the line! …What line?");
    // soldiers march up in ranks behind the front, and shoot
    for (const so of this.soldiers) {
      if (so.flinch && time > so.flinch) {
        so.flinch = 0;
        so.spr.clearTint();
        so.spr.setTint(0xb8c49a);
      }
      if (so.down) continue;
      const tx = this.front + so.rank * 80 + (so.lane % 2) * 20;
      if (so.spr.x > tx) so.spr.x = Math.max(tx, so.spr.x - 70 * (dt / 1000));
      so.spr.setDepth(so.spr.y);
      if (time > so.nextShot && so.spr.x - this.me.x < 700) {
        so.nextShot = time + 1600 + Math.random() * 2200;
        this.enemyShot(so);
      }
    }
    // the tanks roll after them; they lob shells at the krew
    for (const tk of this.tanks) {
      const tx = this.front + 420;
      if (tk.x > tx) {
        tk.x = Math.max(tx, tk.x - 40 * (dt / 1000));
        tk.c.x = tk.x;
      }
      if (time > tk.nextShot && t > 6000) {
        tk.nextShot = time + 5200 + Math.random() * 2500;
        this.tankShot(tk);
      }
    }
    // reinforcements, for a laugh
    if (time > this.nextSquad) {
      this.nextSquad = time + 4200;
      const lane0 = Math.floor(Math.random() * 3);
      for (let i = 0; i < 3; i++) this.addSoldier(W + 40 + i * 30, lane0 + i, 2 + Math.floor(Math.random() * 2));
      if (this.soldiers.length < MAX_SOLDIERS && Math.random() < 0.5) Juice.slamText(sc, "REINFORCEMENTS!", "#facc15", 30, 330, 700, D_HUD + 5);
    }
    // taunts (voiced, one at a time), Krunchers jeering, krew shouting, the Tannoy
    if (time > this.nextTaunt) {
      this.nextTaunt = time + 2300 + Math.random() * 1400;
      const vis = this.soldiers.filter((so) => !so.down && Math.abs(so.spr.x - sc.cameras.main.midPoint.x) < 460);
      const so = vis[Math.floor(Math.random() * vis.length)];
      if (so) {
        const pool = TAKEON_TAUNTS.filter((l) => !this.recent.includes(l.t));
        const l = pool[Math.floor(Math.random() * pool.length)] ?? TAKEON_TAUNTS[0];
        this.recent = [...this.recent.slice(-8), l.t];
        this.bubble(so.spr, l.t, "#ffe0a3", true);
        if (!voice.busy()) voice.say("KREDDLE SOLDIER", l.t);
      }
    }
    if (time > this.nextLaugh) {
      this.nextLaugh = time + 4500 + Math.random() * 3000;
      synth.play("laugh", 0.6);
    }
    if (time > this.nextJeer) {
      this.nextJeer = time + 6500 + Math.random() * 3000;
      const l = TAKEON_KRUNCHER_JEERS[Math.floor(Math.random() * TAKEON_KRUNCHER_JEERS.length)];
      const spr = this.krunchers.find((k) => k.getData("name") === l.s) ?? this.krunchers[0];
      if (spr) this.bubble(spr, l.t, "#ffd1f3", true);
      if (!voice.busy()) voice.say(String(l.s), l.t);
    }
    if (time > this.nextKrew) {
      this.nextKrew = time + 3600 + Math.random() * 2400;
      const pool = t < 16000 ? TAKEON_KREW_BRAVE : TAKEON_KREW_DOOMED;
      const l = pool[Math.floor(Math.random() * pool.length)];
      const spr = l.s === G.s.player ? this.me : (this.lads.find((x) => x.id === l.s)?.spr ?? null);
      if (spr) {
        const text = l.variants?.[G.s.player] ?? l.t;
        this.bubble(spr, text, "#bde0fe", true);
        if (!voice.busy()) voice.say(String(l.s), text);
      }
    }
    if (time > this.nextTannoy) {
      this.nextTannoy = time + 12000;
      const l = TAKEON_TANNOY[this.tannoyIdx++ % TAKEON_TANNOY.length];
      const tt = sc.add.text(480, 222, `📢 ${l.t}`, { fontFamily: FONT, fontSize: "13px", color: "#ffe27a", backgroundColor: "#1a0000cc", padding: { x: 8, y: 4 }, wordWrap: { width: 760 }, align: "center" }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D_HUD);
      sc.tweens.add({ targets: tt, alpha: 0, delay: 5000, duration: 600, onComplete: () => tt.destroy() });
      if (!voice.busy()) voice.say("KREDDLE TANNOY", l.t);
    }
    // the krew fire back (it does nothing either)
    if (time > this.nextLadShot) {
      this.nextLadShot = time + 260;
      const l = this.lads[Math.floor(Math.random() * this.lads.length)];
      const so = this.soldiers.find((x) => !x.down && x.spr.x - l.spr.x < 520);
      if (l && so) {
        const a = Math.atan2(so.spr.y - 45 - l.spr.y, so.spr.x - l.spr.x);
        const img = sc.add.rectangle(l.spr.x, l.spr.y - 20, 10, 3, 0xfff1a8).setRotation(a).setDepth(l.spr.y + 3);
        this.shots.push({ img, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, left: 520, blast: 0, mine: true });
      }
    }
  }

  /** A soldier fires: a tracer at you or one of the krew. */
  private enemyShot(so: Soldier) {
    const sc = this.sc;
    const atMe = Math.random() < 0.45;
    const lad = this.lads[Math.floor(Math.random() * this.lads.length)];
    const target = atMe || !lad ? this.me : lad.spr;
    const x0 = so.spr.x - 26;
    const y0 = so.spr.y - 48;
    const x1 = target.x + (Math.random() - 0.5) * 16;
    const y1 = target.y - 24 + (Math.random() - 0.5) * 16;
    const line = sc.add.line(0, 0, x0, y0, x1, y1, 0xffd23f, 0.9).setOrigin(0).setLineWidth(2).setDepth(D_BUBBLE - 3);
    sc.tweens.add({ targets: line, alpha: 0, duration: 140, onComplete: () => line.destroy() });
    vfx(sc, "vfx_muzzle", x0, y0, { scale: 0.6, depth: so.spr.y + 2, flipX: true });
    synth.play("gun_pistol", 0.3);
    if (target === this.me) this.hurtMe(0.8, so.spr.x);
    else if (lad && lad.stun < sc.time.now) {
      lad.spr.setTintFill(0xff6060);
      sc.time.delayedCall(80, () => lad.spr.clearTint());
      lad.spr.x -= 10;
      if (Math.random() < 0.2) this.floatText(lad.spr.x, lad.spr.y - 60, "OW!", "#fca5a5");
    }
  }

  private tankShot(tk: Tank) {
    const sc = this.sc;
    const mx = tk.x - 150;
    const my = tk.y - 62;
    vfx(sc, "vfx_muzzle", mx, my, { scale: 1.6, depth: tk.y + 5, flipX: true });
    synth.play("boom");
    // lands on the krew
    const tgt = Math.random() < 0.35 ? { x: this.me.x, y: this.me.y } : (() => {
      const l = this.lads[Math.floor(Math.random() * this.lads.length)];
      return l ? { x: l.spr.x, y: l.spr.y } : { x: this.me.x, y: this.me.y };
    })();
    const shell = sc.add.circle(mx, my, 5, 0x222222).setDepth(D_BUBBLE - 4);
    sc.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 750,
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        shell.setPosition(mx + (tgt.x - mx) * p, my + (tgt.y - my) * p - Math.sin(p * Math.PI) * 180);
      },
      onComplete: () => {
        shell.destroy();
        this.boomAt(tgt.x, tgt.y, 1.1, true);
      },
    });
  }

  // ------------------------------------------------------------------ the krew

  private updateLads(time: number, dt: number) {
    if (!this.me || this.phase === "cutscene") return;
    for (const l of this.lads) {
      if (l.stun > time) continue;
      const tx = Math.min(this.me.x + l.off.x, this.front - 90);
      const ty = Phaser.Math.Clamp(this.me.y + l.off.y, TOP, BOTTOM);
      const dx = tx - l.spr.x;
      const dy = ty - l.spr.y;
      const d = Math.hypot(dx, dy);
      const moving = d > 12;
      if (moving) {
        const speed = Math.min(240, d * 3);
        l.spr.x += (dx / d) * speed * (dt / 1000);
        l.spr.y += (dy / d) * speed * (dt / 1000);
      }
      l.spr.setDepth(l.spr.y);
      if (moving) animateWalker(l.spr, dx, dy, true, time + l.off.y * 7);
      else animateWalker(l.spr, 1, 0, false, time);
    }
  }

  // ------------------------------------------------------------------ the end: the General, the beating, the tank

  private async beaten() {
    if (this.phase === "cutscene") return;
    this.phase = "cutscene";
    this.busy = true;
    const sc = this.sc;
    const cam = sc.cameras.main;
    this.setHud(false);
    this.fireBtn?.setVisible(false);
    for (const b of this.bubbles) b.t.destroy();
    this.bubbles = [];
    synth.play("trombone");
    const bars = Juice.letterbox(sc, 52, 450, D_HUD + 2);
    // the krew huddle; the army closes in a ring
    const cx = Phaser.Math.Clamp(this.me.x, 360, 900);
    const cy = 560;
    cam.stopFollow();
    cam.pan(cx, 590, 900, "Cubic.easeInOut", true);
    this.me.setPosition(Math.min(this.me.x, cx + 40), this.me.y);
    sc.tweens.add({ targets: this.me, x: cx, y: cy, duration: 700 });
    this.lads.forEach((l, i) => sc.tweens.add({ targets: l.spr, x: cx + ((i % 4) - 1.5) * 34, y: cy - 40 + Math.floor(i / 4) * 40, duration: 700, onUpdate: () => l.spr.setDepth(l.spr.y) }));
    this.soldiers.forEach((so, i) => {
      const a = (i / this.soldiers.length) * Math.PI * 2;
      so.down = 0;
      so.spr.setAngle(0);
      sc.tweens.add({ targets: so.spr, x: cx + Math.cos(a) * 230, y: Phaser.Math.Clamp(cy + Math.sin(a) * 110, TOP + 10, BOTTOM + 10), duration: 900, onUpdate: () => so.spr.setDepth(so.spr.y) });
    });
    // the General walks through them
    const gKey = sc.textures.exists("spr_KD_PITBOSS") ? "spr_KD_PITBOSS" : "spr_FOLK1";
    const gen = sc.add.sprite(cx + 520, cy - 10, gKey, 0).setScale(2.6).setTint(0xe6c25a).setDepth(cy);
    const tag = sc.add.text(gen.x, gen.y + 46, "THE KREDDLE GENERAL", { fontFamily: "Impact, sans-serif", fontSize: "14px", color: "#facc15", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(cy + 1);
    sc.tweens.add({ targets: [gen, tag], x: `-=${300}`, duration: 1100 });
    await this.wait(1200);
    if (!this.alive()) return;
    await this.talk(TAKEON_GENERAL);
    if (!this.alive()) return;
    tag.destroy();
    // ---- the beating: one big cartoon fight cloud
    sc.tweens.add({ targets: this.soldiers.map((s) => s.spr), x: cx, y: cy, duration: 300 });
    await this.wait(300);
    const krew = [this.me, ...this.lads.map((l) => l.spr)];
    krew.forEach((k) => k.setVisible(false));
    this.soldiers.forEach((s) => s.spr.setVisible(false));
    const cloud: Phaser.GameObjects.GameObject[] = [];
    const puff = sc.time.addEvent({ delay: 90, loop: true, callback: () => {
      const p = vfx(sc, "vfx_dust", cx + (Math.random() - 0.5) * 220, cy - 20 + (Math.random() - 0.5) * 90, { scale: 2.4 + Math.random(), depth: cy + 20 });
      if (p) cloud.push(p);
      else {
        const c = sc.add.circle(cx + (Math.random() - 0.5) * 200, cy - 20 + (Math.random() - 0.5) * 80, 40 + Math.random() * 30, 0xd6c7b0, 0.9).setDepth(cy + 20);
        sc.tweens.add({ targets: c, alpha: 0, scale: 1.4, duration: 600, onComplete: () => c.destroy() });
      }
    } });
    // limbs and lads poke out of the cloud and get dragged back in
    const pokes = sc.time.addEvent({ delay: 380, loop: true, callback: () => {
      const k = krew[Math.floor(Math.random() * krew.length)];
      const ghost = sc.add.sprite(cx + (Math.random() - 0.5) * 120, cy - 20, k.texture.key, 0).setScale(2).setDepth(cy + 25);
      const meta = charMeta(sc, k.texture.key);
      const hurt = meta?.hurt?.south;
      if (hurt?.length) ghost.setFrame(hurt[0]);
      const side = Math.random() < 0.5 ? -1 : 1;
      sc.tweens.add({ targets: ghost, x: ghost.x + side * 150, y: ghost.y - 40, angle: side * 30, duration: 200, yoyo: true, ease: "Quad.out", onComplete: () => ghost.destroy() });
    } });
    for (let i = 0; i < TAKEON_BEATING.length; i++) {
      if (!this.alive()) return;
      synth.play(i % 3 === 2 ? "punch_big" : "punch");
      vfx(sc, i % 2 ? "vfx_hit" : "vfx_stars", cx + (Math.random() - 0.5) * 160, cy - 40 + (Math.random() - 0.5) * 60, { scale: 1.5, depth: cy + 30 });
      if (this.gore && i % 4 === 1) vfx(sc, "vfx_blood", cx + (Math.random() - 0.5) * 120, cy - 30, { scale: 1, depth: cy + 29 });
      Juice.shake(sc, 120, 0.008);
      if (i === 5 && sc.textures.exists("p_bongo")) Juice.debris(sc, cx, cy - 40, 6, { colors: [0x22c55e, 0xfacc15], depth: cy + 31 });
      const t = sc.add.text(cx + (Math.random() - 0.5) * 260, cy - 120 + (Math.random() - 0.5) * 60, TAKEON_BEATING[i], { fontFamily: "Impact, sans-serif", fontSize: `${30 + (i % 3) * 6}px`, color: i % 2 ? "#ff4d4d" : "#ffd23f", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(cy + 40).setAngle((Math.random() - 0.5) * 24);
      sc.tweens.add({ targets: t, scale: { from: 1.6, to: 1 }, duration: 120 });
      sc.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() });
      if (i % 4 === 0) synth.play("laugh", 0.5);
      await this.wait(340);
    }
    puff.remove();
    pokes.remove();
    await this.wait(500);
    // ---- the heap: everyone flat out, stars circling (gore on: a bit of claret too)
    this.soldiers.forEach((s, i) => {
      const a = (i / this.soldiers.length) * Math.PI * 2;
      s.spr.setVisible(true).setPosition(cx + Math.cos(a) * 200, Phaser.Math.Clamp(cy + Math.sin(a) * 100, TOP + 10, BOTTOM + 10));
    });
    krew.forEach((k, i) => {
      k.setVisible(true).setPosition(cx - 70 + (i % 5) * 34, cy - 10 + Math.floor(i / 5) * 20).setDepth(cy + i);
      const meta = charMeta(sc, k.texture.key);
      const fall = meta?.death?.east ?? meta?.death?.south;
      if (fall?.length) k.setFrame(fall[fall.length - 1]);
      else k.setAngle(90);
    });
    for (let i = 0; i < 4; i++) vfx(sc, "vfx_stars", cx - 60 + i * 40, cy - 40, { scale: 1, depth: cy + 30, delay: i * 120 });
    if (this.gore) vfx(sc, "vfx_bloodpool", cx, cy + 10, { scale: 1, depth: cy - 1 });
    synth.play("groan");
    await this.wait(900);
    // ---- return to sender: the tank rolls up, the krew go down the barrel
    const tk = this.tanks[0];
    if (tk) {
      tk.x = cx + 330;
      sc.tweens.add({ targets: tk.c, x: tk.x, y: cy + 10, duration: 1200, ease: "Sine.out" });
      tk.c.setDepth(cy + 10);
      synth.play("car_screech", 0.5);
      await this.wait(1250);
    }
    await this.talk(TAKEON_SENDER.slice(0, 1));
    const muzzle = { x: (tk ? cx + 330 : cx + 300) - 150 * 1.0, y: cy + 10 - 62 * 1.3 };
    for (const k of krew) {
      if (!this.alive()) return;
      sc.tweens.add({ targets: k, x: muzzle.x, y: muzzle.y, scale: 0.4, angle: -90, duration: 260, ease: "Quad.in", onComplete: () => k.setVisible(false) });
      synth.play("squelch", 0.6);
      await this.wait(170);
    }
    await this.wait(300);
    await this.talk(TAKEON_SENDER.slice(1));
    if (!this.alive()) return;
    // FIRE
    synth.play("reveal_boom");
    Juice.flash(sc, 0xffffff, 300, 0.8, D_HUD - 1);
    Juice.shake(sc, 400, 0.02);
    vfx(sc, "vfx_bigboom", muzzle.x - 20, muzzle.y, { scale: 1.2, depth: D_BUBBLE });
    // the krew, a spinning cluster, out of the barrel and west over the whole Strip
    const lead = sc.add.zone(muzzle.x, muzzle.y, 1, 1);
    const fly = krew.map((k, i) => {
      const f = sc.add.sprite(muzzle.x, muzzle.y, k.texture.key, k.frame.name).setScale(2).setDepth(D_BUBBLE + 1);
      f.setData("dx", (Math.random() - 0.5) * 60).setData("dy", (Math.random() - 0.5) * 40).setData("spin", 400 + i * 60);
      return f;
    });
    cam.startFollow(lead, true, 0.2, 0.2);
    const sp = Juice.speedLines(sc, 1800, 0xffffff, D_HUD - 2);
    synth.play("whistle");
    await new Promise<void>((r) =>
      sc.tweens.add({
        targets: lead,
        x: -200,
        duration: 1900,
        ease: "Sine.in",
        onUpdate: (tw) => {
          const p = tw.progress;
          lead.y = muzzle.y - Math.sin(p * Math.PI) * 220;
          for (const f of fly) f.setPosition(lead.x + f.getData("dx"), lead.y + f.getData("dy")).setAngle(f.angle + 18);
        },
        onComplete: () => r(),
      }),
    );
    sp();
    bars(300);
    Juice.slamText(sc, "RETURN TO SENDER", "#ff4d4d", 54, 250, 1200);
    await this.wait(1400);
    if (!this.alive()) return;
    // back in Krelford: the landing, the Klerble presser and the aftermath are HubScene's
    G.s.flags.kreddle_rekt = true;
    G.save();
    cam.fadeOut(500);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => switchTo(sc, "Hub", { at: "KREDDLE_BRIDGE", from: "rekt" }));
  }

  // ------------------------------------------------------------------ bits

  private makeFireButton() {
    const sc = this.sc;
    const c = sc.add.circle(735, 445, 52, 0xef4444, 0.25).setStrokeStyle(3, 0xfca5a5, 0.8).setScrollFactor(0).setDepth(D_HUD + 5).setInteractive();
    sc.add.text(735, 445, "FIRE", { fontFamily: FONT, fontSize: "14px", color: "#ffe4e6", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(D_HUD + 6);
    const on = () => {
      this.touchFire = true;
      c.setFillStyle(0xef4444, 0.55);
    };
    const off = () => {
      this.touchFire = false;
      c.setFillStyle(0xef4444, 0.25);
    };
    c.on("pointerdown", on);
    c.on("pointerup", off);
    c.on("pointerout", off);
    this.fireBtn = c;
  }

  private bubble(spr: Phaser.GameObjects.Components.Transform, text: string, bg = "#ffffff", important = false) {
    if (!text) return;
    if (this.bubbles.length >= MAX_BUBBLES) {
      if (!important) return;
      this.bubbles.shift()?.t.destroy();
    }
    const t = this.sc.add.text(spr.x, spr.y - 70, text, { fontFamily: FONT, fontSize: "11px", color: "#050505", backgroundColor: bg, padding: { x: 5, y: 3 }, wordWrap: { width: 200 }, align: "center" }).setOrigin(0.5, 1).setDepth(D_BUBBLE);
    this.bubbles.push({ t, follow: spr, until: this.sc.time.now + 2600 });
  }

  private updateBubbles(time: number) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (time > b.until) {
        b.t.destroy();
        this.bubbles.splice(i, 1);
        continue;
      }
      if (b.follow) b.t.setPosition(b.follow.x, b.follow.y - 70);
    }
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.sc.add.text(x, y, text, { fontFamily: FONT, fontSize: "13px", color, fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(D_BUBBLE);
    this.sc.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}

import Phaser from "phaser";
import type { Boss } from "./Bosses";
import type { Enemy } from "./Enemy";
import type { CombatWorld } from "./types";
import { minionsFor, shieldConfig, shieldForDifficulty, ShieldPhase, SHIELD_TUNING, stretchCooldown, type ShieldConfig } from "./bossShieldLogic";
import { diffFor } from "../systems/difficulty";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { hasVfx, vfx } from "../gfx/Vfx";
import * as Juice from "../gfx/Juice";

/**
 * BOSS SHIELD PHASES (Zelda-style). At each HP threshold (bossShieldLogic.ts) the boss's health stops dead, a
 * glowing bubble goes up round it, a banner says what to do, shots spark off with an IMMUNE, the HP bar freezes and
 * turns blue, and it calls in a few weak themed minions. Each one you kill cracks the shield (2/4...). The last one
 * shatters it and the boss fights straight on (the old VULNERABLE! stun is gone).
 * While shielded the boss still fights, but slower, and its own adds wait. If it drags on, it cracks by itself.
 *
 * Wiring: Boss.tick calls update(); DungeonScene.damageEnemy runs every hit through damage(). That's all.
 */

const CYAN = 0x6fd8ff;
const CYAN_S = "#7dd3fc";
const GOLD_S = "#ffd23f";

interface Tracked {
  e: Enemy;
  counted: boolean;
}

export interface ShieldHud {
  state: "idle" | "shielded" | "vulnerable";
  cracks: number;
  need: number;
  /** HP fractions where shields are still to come (bar ticks). */
  marks: number[];
}

export class BossShield {
  readonly logic: ShieldPhase;
  private sc: Phaser.Scene;
  /** The scene itself (the boss's own world may be wrapped). */
  private world: CombatWorld;
  private minions: Tracked[] = [];
  private bubble: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null = null;
  private cracksG: Phaser.GameObjects.Graphics;
  private marksG: Phaser.GameObjects.Graphics;
  private counter: Phaser.GameObjects.Text;
  private stars: Phaser.GameObjects.Sprite | null = null;
  private kneel: Phaser.GameObjects.Sprite | null = null;
  private wobble: Phaser.Tweens.Tween | null = null;
  /** Crack lines drawn on the bubble, in its own unit circle. */
  private crackLines: [number, number][][] = [];
  private lastNext = 0;
  private lastPing = 0;
  /** Fight time (ms): advances with the boss's ticks, so it stands still while the scene is paused or busy. */
  private clock = 0;
  private gone = false;
  /** The bubble popping up (0..1). */
  private grow = { k: 1 };
  private follow = () => this.place();

  /** Its shield phases, if this boss has them. */
  static create(boss: Boss): BossShield | null {
    const cfg = shieldConfig(boss.bossId);
    if (!cfg || boss.maxHp <= 0) return null;
    return new BossShield(boss, cfg);
  }

  private constructor(
    private boss: Boss,
    cfg: ShieldConfig,
  ) {
    this.sc = boss.scene;
    this.world = boss.world;
    const dd = shieldForDifficulty(cfg, diffFor(G.s));
    this.logic = new ShieldPhase(dd.cfg, boss.hp / boss.maxHp, dd.tune);
    this.cracksG = this.sc.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.marksG = this.sc.add.graphics();
    this.counter = this.sc.add
      .text(0, 0, "", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: CYAN_S, stroke: "#000000", strokeThickness: 4 })
      .setOrigin(0.5)
      .setVisible(false);
    // while the shield's up, the boss's own adds wait (the shield's minions are the ones that matter)
    const real = boss.world;
    boss.world = new Proxy(real, {
      get: (t, p) => {
        if (p === "spawnEnemy") return (...a: Parameters<CombatWorld["spawnEnemy"]>) => (this.logic.blocking ? null : t.spawnEnemy(...a));
        return Reflect.get(t, p, t);
      },
    });
    this.sc.events.on("postupdate", this.follow);
    this.sc.events.once("shutdown", () => this.destroy());
  }

  get blocking() {
    return this.logic.blocking;
  }

  get stunned() {
    return this.logic.state === "vulnerable";
  }

  hud(): ShieldHud {
    const st = this.logic.state;
    return {
      state: st === "pending" || st === "shielded" ? "shielded" : st === "vulnerable" ? "vulnerable" : "idle",
      cracks: this.logic.cracks,
      need: this.logic.need,
      marks: this.logic.cfg.thresholds.slice(this.logic.next),
    };
  }

  // -------------------------------------------------------------------------------------------------- damage

  /** A hit on the boss (after its own armour): what gets through. Called by the scene's damageEnemy. */
  damage(amount: number, opts: { label?: string } = {}): number {
    const b = this.boss;
    if (this.logic.blocking) {
      this.immune(opts.label === "");
      return 0;
    }
    const r = this.logic.filter(b.hp, b.maxHp, amount);
    return r.amount;
  }

  /** IMMUNE: a spark off the bubble where the shot hit, a ping, the bubble flares. */
  private immune(quiet: boolean) {
    const now = this.world.now();
    if (quiet || now - this.lastPing < 110) return;
    this.lastPing = now;
    const b = this.boss;
    const p = this.world.player;
    const a = Math.atan2(p.y - b.y, p.x - b.x) + (Math.random() - 0.5) * 0.9;
    const r = this.radius();
    const x = b.x + Math.cos(a) * r;
    const y = b.y + Math.sin(a) * r;
    if (!vfx(this.sc, "vfx_sparks", x, y, { scale: 0.7, depth: b.depth + 6, tint: CYAN, add: true, angle: (a * 180) / Math.PI })) this.world.burst(x, y, CYAN, 4);
    // a glint flying off (the shot glancing away)
    const g = this.sc.add.rectangle(x, y, 10, 2, 0xe6fbff).setDepth(b.depth + 6).setRotation(a + 0.6);
    this.sc.tweens.add({ targets: g, x: x + Math.cos(a + 0.6) * 40, y: y + Math.sin(a + 0.6) * 40, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    if (this.bubble) {
      this.bubble.setAlpha(1);
      this.sc.tweens.add({ targets: this.bubble, alpha: 0.75, duration: 180 });
    }
    synth.play("bs_shield_ping", 0.55);
    if (Math.random() < 0.45) this.world.floatText(x + (Math.random() - 0.5) * 16, y - 14, "IMMUNE", CYAN_S, 17);
  }

  // -------------------------------------------------------------------------------------------------- per frame

  /** From Boss.tick. Returns "stun" while it's knocked down (no attacks, no moving). */
  update(dt: number, now: number): "stun" | null {
    if (this.gone) return null;
    const b = this.boss;
    // the shield's own clock only runs while the boss does (a phase break or dialogue doesn't eat the stun)
    this.clock += Math.max(0, dt);
    const t = this.clock;
    if (this.logic.state === "pending") this.raise(t, now);
    if (this.logic.state === "shielded") {
      for (const m of this.minions) {
        if (m.counted || (!m.e.dead && m.e.active)) continue;
        m.counted = true;
        this.crack(t, m.e.x, m.e.y);
        if (this.logic.state !== "shielded") break;
      }
      // its attacks come slower while it hides in there
      if (b.nextPattern !== this.lastNext) {
        b.nextPattern = stretchCooldown(now, b.nextPattern, this.logic.cfg.rate);
        this.lastNext = b.nextPattern;
      }
    }
    const ev = this.logic.tick(t);
    if (ev === "weaken") this.weaken();
    else if (ev === "autocrack") this.crack(t, b.x + (Math.random() - 0.5) * 200, b.y - 120);
    else if (ev === "recovered") this.recover();
    if (this.logic.state === "vulnerable") {
      b.contactCd = Math.max(b.contactCd, now + 200);
      return "stun";
    }
    return null;
  }

  private radius() {
    const b = this.boss;
    return Math.max(46, Math.max(b.displayWidth, b.displayHeight) * 0.5);
  }

  /** Keep the bubble, cracks, stars, kneel and minion markers on the boss (after physics). */
  private place() {
    const b = this.boss;
    if (this.gone) return;
    if (!b.active || b.dead) {
      this.destroy();
      return;
    }
    const r = this.radius();
    const d = b.depth;
    if (this.bubble) {
      this.bubble.setPosition(b.x, b.y).setDepth(d + 4).setVisible(b.visible || !!this.kneel);
      if (this.bubble instanceof Phaser.GameObjects.Sprite) this.bubble.setScale(((r * 2.15) / 168) * this.grow.k);
      else this.bubble.setRadius(r * 1.07 * this.grow.k);
    }
    this.cracksG.clear().setDepth(d + 5);
    if (this.crackLines.length && this.bubble) {
      const k = r * 1.05;
      for (const line of this.crackLines) {
        this.cracksG.lineStyle(4, 0x2f7bff, 0.55);
        this.cracksG.beginPath();
        line.forEach(([x, y], i) => (i ? this.cracksG.lineTo(b.x + x * k, b.y + y * k) : this.cracksG.moveTo(b.x + x * k, b.y + y * k)));
        this.cracksG.strokePath();
        this.cracksG.lineStyle(1.5, 0xffffff, 0.95);
        this.cracksG.beginPath();
        line.forEach(([x, y], i) => (i ? this.cracksG.lineTo(b.x + x * k, b.y + y * k) : this.cracksG.moveTo(b.x + x * k, b.y + y * k)));
        this.cracksG.strokePath();
      }
    }
    // the minions to kill: a ring under each and a faint tether to the bubble
    this.marksG.clear().setDepth(d - 1);
    if (this.logic.state === "shielded") {
      const t = this.world.now();
      for (const m of this.minions) {
        if (m.counted || m.e.dead || !m.e.active) continue;
        const e = m.e;
        const a = Math.atan2(e.y - b.y, e.x - b.x);
        this.marksG.lineStyle(1.5, CYAN, 0.28).lineBetween(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, e.x, e.y);
        this.marksG.lineStyle(2, CYAN, 0.6 + Math.sin(t / 120) * 0.3).strokeEllipse(e.x, e.y + e.displayHeight * 0.4, e.displayWidth * 0.9 + 8, 12);
        this.marksG.fillStyle(CYAN, 0.9).fillTriangle(e.x - 5, e.y - e.displayHeight / 2 - 14, e.x + 5, e.y - e.displayHeight / 2 - 14, e.x, e.y - e.displayHeight / 2 - 6);
      }
    }
    this.counter.setPosition(b.x, b.y - r - 22).setDepth(d + 6);
    const bb = b.body as Phaser.Physics.Arcade.Body;
    const top = bb.top + (this.kneel ? bb.height * 0.3 : -4);
    this.stars?.setPosition(b.x, top + 6).setDepth(d + 7);
    if (this.kneel) {
      this.kneel.setPosition(b.x, b.y + b.displayHeight * (1 - b.originY)).setDepth(d);
      if (this.world.now() < b.flashUntil) this.kneel.setTintFill(0xffffff);
      else this.kneel.setTint(0xffe8a0);
    }
  }

  // -------------------------------------------------------------------------------------------------- the beats

  /** Up it goes: bubble, banner, minions. */
  private raise(t: number, now: number) {
    const b = this.boss;
    const sc = this.sc;
    const w = this.world;
    const types = minionsFor(this.logic.cfg, this.logic.raised);
    this.logic.begin(t, types.length);
    this.crackLines = [];
    this.minions = [];
    this.lastNext = b.nextPattern;
    b.nextPattern = Math.max(b.nextPattern, now + 1400);
    // the bubble
    this.bubble?.destroy();
    if (hasVfx(sc, "bs_vfx_shield_bubble")) this.bubble = vfx(sc, "bs_vfx_shield_bubble", b.x, b.y, { add: true, alpha: 0.75, depth: b.depth + 4 });
    else this.bubble = null;
    if (!this.bubble) this.bubble = sc.add.circle(b.x, b.y, this.radius(), 0x2f7bff, 0.22).setStrokeStyle(3, CYAN, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    this.grow.k = 0.1;
    sc.tweens.add({ targets: this.grow, k: 1, duration: 320, ease: "Back.out" });
    Juice.shockRing(sc, b.x, b.y, { color: CYAN, to: this.radius() * 4, rings: 2, depth: b.depth + 5 });
    synth.play("bs_shield_up");
    synth.play("roar", 0.6);
    w.shake(250, 0.01);
    b.taunt();
    this.banner();
    this.updateCounter();
    // the minions, one after another, round the boss
    const n = types.length;
    types.forEach((type, i) => {
      sc.time.delayedCall(350 + i * 220, () => {
        if (this.gone || this.logic.state !== "shielded") return;
        const [x, y] = this.spot(i, n);
        const e = w.spawnEnemy(type, x, y, { minion: true });
        if (!e) {
          // the room's full (or the type's missing): that crack comes for free, so the count still adds up
          sc.time.delayedCall(900, () => !this.gone && this.crack(this.clock, x, y));
          return;
        }
        e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * this.logic.cfg.minionHp));
        this.minions.push({ e, counted: false });
        vfx(sc, "vfx_shock", x, y + e.displayHeight * 0.3, { scale: 0.8, depth: e.depth - 1, tint: CYAN, add: true });
      });
    });
  }

  /** Where minion i of n comes in: round the boss (top-down), either side of it on the floor (side-on). */
  private spot(i: number, n: number): [number, number] {
    const b = this.boss;
    const w = this.world;
    const wb = w.bounds;
    if (w.side) {
      const dir = i % 2 ? 1 : -1;
      const x = Phaser.Math.Clamp(b.x + dir * (140 + Math.floor(i / 2) * 90), wb.left + 40, wb.right - 40);
      return [x, Math.min(b.y, (w.groundY ?? b.y) - 40)];
    }
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.4;
    const r = this.radius() + 110;
    return [Phaser.Math.Clamp(b.x + Math.cos(a) * r, wb.left + 40, wb.right - 40), Phaser.Math.Clamp(b.y + Math.sin(a) * r, wb.top + 50, wb.bottom - 40)];
  }

  /** SHIELDED: a big banner across the screen, with a drawn shield. */
  private banner() {
    const sc = this.sc;
    const L = Juice.layer(sc, 4996);
    const y = 150;
    const c = sc.add.container(480, y);
    L.add(c);
    const band = sc.add.rectangle(0, 0, 960, 86, 0x061a3a, 0.72);
    const title = sc.add.text(22, -12, "SHIELDED", { fontFamily: "Impact, sans-serif", fontSize: "50px", color: CYAN_S, stroke: "#000000", strokeThickness: 8 }).setOrigin(0.5);
    title.setShadow(0, 0, CYAN_S, 16, true, true);
    const sub = sc.add.text(0, 28, "KILL THE MINIONS TO BREAK IT", { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffffff", stroke: "#000000", strokeThickness: 5 }).setOrigin(0.5);
    const icon = sc.add.graphics();
    const ix = 22 - title.width / 2 - 34;
    const iy = -12;
    const shield = (g: Phaser.GameObjects.Graphics, s: number) =>
      g.fillPoints(
        [
          { x: ix - 16 * s, y: iy - 20 * s },
          { x: ix, y: iy - 25 * s },
          { x: ix + 16 * s, y: iy - 20 * s },
          { x: ix + 14 * s, y: iy + 4 * s },
          { x: ix, y: iy + 22 * s },
          { x: ix - 14 * s, y: iy + 4 * s },
        ],
        true,
      );
    icon.fillStyle(0x000000, 1);
    shield(icon, 1.2);
    icon.fillStyle(0x2f7bff, 1);
    shield(icon, 1);
    icon.fillStyle(0xe6fbff, 1).fillRect(ix - 2, iy - 18, 4, 30).fillRect(ix - 11, iy - 7, 22, 4);
    c.add([band, icon, title, sub]);
    c.setScale(1, 0).setAlpha(0);
    sc.tweens.add({ targets: c, scaleY: 1, alpha: 1, duration: 180, ease: "Back.out" });
    sc.tweens.add({ targets: c, alpha: 0, y: y - 16, delay: 2300, duration: 450, onComplete: () => c.destroy() });
  }

  private updateCounter() {
    const st = this.logic.state;
    if (st === "shielded") this.counter.setText(`SHIELD  ${this.logic.cracks}/${this.logic.need}`).setColor(CYAN_S).setVisible(true);
    else if (st === "vulnerable") this.counter.setText("VULNERABLE!").setColor(GOLD_S).setVisible(true);
    else this.counter.setVisible(false);
  }

  /** A crack, from a minion dying at (x, y) (or the shield fading). */
  private crack(now: number, x: number, y: number) {
    if (this.logic.state !== "shielded") return;
    const b = this.boss;
    const broke = this.logic.crack(now);
    const a = Math.atan2(y - b.y, x - b.x);
    const r = this.radius();
    // a jagged line on the bubble from where it was hit, inwards
    const pts: [number, number][] = [];
    let px = Math.cos(a) * 0.98;
    let py = Math.sin(a) * 0.98;
    pts.push([px, py]);
    for (let i = 0; i < 4; i++) {
      const ang = a + Math.PI + (Math.random() - 0.5) * 1.3;
      px += Math.cos(ang) * 0.2;
      py += Math.sin(ang) * 0.2;
      pts.push([px, py]);
    }
    this.crackLines.push(pts);
    // a spark of it flying in from the minion
    const sc = this.sc;
    const ex = b.x + Math.cos(a) * r;
    const ey = b.y + Math.sin(a) * r;
    const bolt = sc.add.circle(x, y, 5, 0xe6fbff, 1).setDepth(b.depth + 6).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: bolt, x: ex, y: ey, duration: 180, ease: "Quad.in", onComplete: () => bolt.destroy() });
    vfx(sc, "bs_vfx_shield_crack", ex, ey, { scale: 1.1, depth: b.depth + 6, add: true, angle: (a * 180) / Math.PI });
    synth.play("bs_shield_crack");
    this.world.shake(120, 0.006);
    this.world.floatText(b.x, b.y - r - 44, broke ? "SHIELD BROKEN!" : `CRACK! ${this.logic.cracks}/${this.logic.need}`, CYAN_S, broke ? 22 : 18);
    this.updateCounter();
    if (broke) this.shatter(now);
  }

  /** 25 seconds in: the minions left get weaker, and it starts cracking on its own. */
  private weaken() {
    const b = this.boss;
    this.world.floatText(b.x, b.y - this.radius() - 44, "THE SHIELD'S FADING...", CYAN_S, 17);
    for (const m of this.minions) {
      if (m.counted || m.e.dead) continue;
      m.e.hp = Math.max(1, Math.ceil(m.e.hp * 0.4));
      m.e.slowUntil = this.world.now() + 30000;
      m.e.slowAmt = 0.4;
    }
  }

  /** The last crack: it bursts. */
  private shatter(now: number) {
    const b = this.boss;
    const sc = this.sc;
    const w = this.world;
    const bub = this.bubble;
    this.bubble = null;
    this.crackLines = [];
    bub?.destroy();
    const k = (this.radius() * 2) / 112;
    if (!vfx(sc, "bs_vfx_shield_shatter", b.x, b.y, { scale: k, depth: b.depth + 6, add: true, speed: 1.3 })) w.burst(b.x, b.y, CYAN, 30);
    Juice.debris(sc, b.x, b.y, 16, { colors: [0x6fd8ff, 0x2f7bff, 0xe6fbff], speed: 360, size: 6, depth: b.depth + 6, floor: w.side ? w.groundY : undefined });
    Juice.shockRing(sc, b.x, b.y, { color: CYAN, to: this.radius() * 6, rings: 3, depth: b.depth + 5 });
    // Juice.flash is dimmed and slowed under "reduce flashing"
    Juice.flash(sc, 0xbfefff, 220, 0.5, 4880, true);
    synth.play("bs_shield_shatter");
    synth.play("crit");
    w.shake(380, 0.018);
    w.hitStop(110);
    // no VULNERABLE stun (no kneel, no stars): it bursts and the boss fights straight on.
    // Armoured bosses (Deranged Drongus) still get their armour cracked open for a moment.
    b.shieldBroken?.(now + SHIELD_TUNING.vulnerableMs);
    this.updateCounter();
    void now;
  }

  private downOrReel() {
    const b = this.boss;
    const sc = this.sc;
    // its own down sheet: to its knees, dazed there until it recovers (then it gets up)
    if (b.hasDownSheet && b.visible && b.playAnim("stagger")) return;
    // else the drawn collapse (bossdie_<id>: the six main bosses), stopped before they hit the floor
    const key = sc.textures.exists(`bossdie_${b.bossId}`) ? `bossdie_${b.bossId}` : null;
    const n = key ? sc.textures.get(key).frameTotal - 1 : 0;
    if (key && n >= 4 && b.visible) {
      const tex = sc.textures.get(key);
      const side = tex.get(0).height;
      const split = Math.max(2, n - 4);
      const ak = `${key}_bs_kneel`;
      if (!sc.anims.exists(ak)) sc.anims.create({ key: ak, frames: sc.anims.generateFrameNumbers(key, { start: 0, end: split }), frameRate: 9, repeat: 0 });
      const k = b.displayHeight / b.frame.height;
      this.kneel = sc.add.sprite(b.x, b.y + b.displayHeight * (1 - b.originY), key, 0).setOrigin(0.5, (side - 4) / side).setDepth(b.depth).setFlipX(b.flipX).setScale(k);
      this.kneel.play(ak);
      b.setVisible(false);
      return;
    }
    // no drawn collapse: it reels (a lurch, then a woozy sway) and goes pale
    this.wobble = sc.tweens.add({ targets: b, angle: { from: -7, to: 7 }, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    Juice.squash(sc, b, 0.25, 360);
  }

  /** On its feet again: back to the fight (next shield at the next threshold). */
  private recover() {
    const b = this.boss;
    this.stars?.destroy();
    this.stars = null;
    this.wobble?.remove();
    this.wobble = null;
    if (b.active) b.setAngle(0);
    if (this.kneel) {
      this.kneel.destroy();
      this.kneel = null;
      if (b.active && !b.dead) b.setVisible(true);
    }
    if (b.isDowned) b.playAnim("getup");
    if (b.active && !b.dead) {
      Juice.squash(this.sc, b, 0.2, 300);
      this.world.floatText(b.x, b.y - b.displayHeight / 2 - 20, "BACK UP!", "#ff6b6b", 16);
      b.nextPattern = Math.max(b.nextPattern, this.world.now() + 600);
    }
    this.updateCounter();
  }

  destroy() {
    if (this.gone) return;
    this.gone = true;
    this.sc.events.off("postupdate", this.follow);
    this.bubble?.destroy();
    this.stars?.destroy();
    this.wobble?.remove();
    this.cracksG.destroy();
    this.marksG.destroy();
    this.counter.destroy();
    // the boss died mid-kneel (it can't die while shielded): if the scene has its own drawn collapse for it, that
    // takes over (it hides the boss itself); otherwise show the boss again for its death pop
    if (this.kneel) {
      this.kneel.destroy();
      this.kneel = null;
      const b = this.boss;
      const sceneKneels = this.sc.textures.exists(`bossdie_${b.bossId}`) && !["reinhardt", "krozno", "rik"].includes(b.bossId) && !(b as unknown as { deathSequence?: unknown }).deathSequence;
      if (b.active && (!b.dead || !sceneKneels)) b.setVisible(true);
    }
    if (this.boss.active) this.boss.setAngle(0);
  }
}

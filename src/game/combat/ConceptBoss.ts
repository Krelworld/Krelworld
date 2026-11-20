import Phaser from "phaser";
import { Boss, type BossAnimState } from "./Bosses";
import type { CombatWorld } from "./types";
import { synth } from "../audio/Synth";
import { G } from "../G";
import { diffFor } from "../systems/difficulty";
import { hasVfx, vfx } from "../gfx/Vfx";
import { voice } from "../audio/Voice";
import { hdFactor } from "../gfx/HD";
import { CONCEPT, CONCEPT_BARKS, CONCEPT_HEAL } from "../../content/finaleKrelford";
import { horrorKey } from "../scenes/finale/finaleArt";

/**
 * THE CONCEPT OF PAEDOPHILIA (the Krelford finale): an enormous eldritch dragon with too many arms. Every lightning
 * strike shows the translucent dark wizard behind it (the old final form of Drongus).
 *
 * It never dies on its own. The finale (scenes/finale/KrelfordFinale.ts) runs it through its modes:
 *   "immortal" - your shots do a bit; lose enough and it FULLY HEALS (`onHeal`). Three times.
 *   "shrug"    - while you fetch the bottle and inject the lads: nothing gets through.
 *   "real"     - the Krew are super saiyan: real damage, and it fights harder. Near the end: `onLow`.
 *   "still"    - frozen for a cutscene.
 *
 * Attacks (readable, telegraphed): ARM SLAM (claws come down where you're standing), TENTACLE SWEEP (a fan of lines
 * swept across the ground), BREATH (bursts of bile at you), SHOCKWAVE (a stomp and rings of bolts), SUMMON (horrors
 * crawl out of the rubble), and the storm's own LIGHTNING (strikes near you; each one shows the wizard).
 */
export type ConceptMode = "immortal" | "shrug" | "real" | "still";

/**
 * Real phase: what your hits (and the lads') are worth against it, before difficulty. It was 1.6 (a decent player had
 * it down in well under a minute), then 0.65 (two and a half times as long: a slog). Now 1.08, divided by the
 * difficulty's boss-HP multiplier (`conceptRealDmg`): 1.0 on NORMAL, so it drains (and the SPIRIT CUM fills) about
 * 35% quicker than at 0.65; harder levels still take longer, easier ones less. It still gets nastier as it goes
 * (see `rage`): new attacks at 75% and 50%, and its patterns come faster at 66% and 33%.
 */
export const CONCEPT_REAL_DMG = 1.08;

/** The real-phase damage multiplier for a run's difficulty (its HP is fixed, so the boss-HP scaling goes in here). */
export function conceptRealDmg(bossHp = diffFor(G.s).bossHp) {
  return CONCEPT_REAL_DMG / Math.max(0.1, bossHp);
}

export class ConceptBoss extends Boss {
  quietDefeat = true;
  mode: ConceptMode = "still";
  /** Fires once each time it loses `healAt` of its health in immortal mode. */
  onHeal?: () => void;
  /** Fires once when it's nearly dead in real mode. */
  onLow?: () => void;
  /** Fraction of max HP it can lose (immortal mode) before it heals. */
  healAt = 0.3;
  private healing = false;
  private lowFired = false;
  private art: boolean;
  private wizard: Phaser.GameObjects.Image;
  /** The barks, shuffled, so he works through all of them before repeating. */
  private barkDeck: string[] = [];
  private nextBark = 0;
  private nextStrike = 0;
  private nextCackle = 0;
  private roaringUntil = 0;
  private home: { x: number; y: number };
  private lastShrug = 0;
  private lastFlinch = 0;
  /** Staggered (playAnim("stagger")): reeling on the spot until then. */
  private reelingUntil = 0;
  /** Where it may roam. */
  roam = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  /** How many times it has healed (the finale sets it): each one, it comes back a little faster and nastier. */
  escalation = 0;
  /** Real mode: the HP lines it's crossed (75%: FURIOUS; half: a phase break; 40% and 20%: the LIGHTNING GRID; 30%: DESPERATE). */
  private realMarks = new Set<number>();
  private gridQueued = 0;

  constructor(w: CombatWorld, x: number, y: number) {
    const art = w.sc.textures.exists("fb_dragon_top");
    super(w, "concept", x, y, 20000, art ? "fb_dragon_top" : "boss_drongus", 150, 0x4c1d95, art ? 256 : 96, art ? 256 : 144);
    this.art = art;
    this.home = { x, y };
    this.roam.setTo(x - 520, y - 80, 1040, 520);
    // it's HUGE
    this.setScale(art ? 1.85 : 4.6);
    if (art) this.play("fb_dragon_top");
    else this.setTint(0x6d28d9);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const fw = this.frame.width;
    const fh = this.frame.height;
    body.setSize(fw * 0.55, fh * 0.5).setOffset(fw * 0.22, fh * 0.28);
    body.setCollideWorldBounds(true);
    body.pushable = false;
    this.thresholds = [];
    this.def = { ...this.def, name: CONCEPT, damage: 22, speed: 40 };
    // the wizard behind it: only there when the lightning shows it
    const wk = w.sc.textures.exists("fb_wizard") ? "fb_wizard" : "boss_drongus";
    this.wizard = w.sc.add.image(x, y, wk, 0).setOrigin(0.5, 1).setScale(wk === "fb_wizard" ? 4.4 : 4.4).setTint(0x8b5cf6).setAlpha(0).setBlendMode(Phaser.BlendModes.SCREEN);
    this.nextBark = w.now() + 6000;
    this.nextStrike = w.now() + 3000;
    this.nextCackle = w.now() + 9000;
    this.on("destroy", () => this.wizard.destroy());
  }

  get radius() {
    return this.displayWidth * 0.3;
  }

  /** Real phase (and the art's there): the cracked, bleeding-gold sheets. */
  private get hurtArt() {
    return this.mode === "real" && this.scene.textures.exists("fe_dragon_top_hurt") && this.scene.anims.exists("fe_dragon_top_hurt");
  }
  private get topKey() {
    return this.hurtArt ? "fe_dragon_top_hurt" : "fb_dragon_top";
  }
  private get roarKey() {
    return this.hurtArt && this.scene.textures.exists("fe_dragon_roar_hurt") ? "fe_dragon_roar_hurt" : "fb_dragon_roar";
  }
  private shownTop = "fb_dragon_top";
  private movingUntil = 0;

  /**
   * A drawn move (wind-ups: "rear" breathes in, "slam" brings the arms down; "flinch" when it's really hurt), then
   * back to its loop. In the real phase, the wounded version. Not over a roar.
   */
  move(name: "rear" | "slam" | "flinch" | "storm", fps = 12) {
    const sc = this.scene;
    const now = this.world.now();
    if (!this.art || this.dead || now < this.roaringUntil || now < this.movingUntil) return;
    const key = this.hurtArt && sc.textures.exists(`fe_concept_${name}_hurt`) ? `fe_concept_${name}_hurt` : `fe_concept_${name}`;
    if (!sc.textures.exists(key)) return;
    const ak = `${key}:move`;
    const n = sc.textures.get(key).frameTotal - 1;
    if (!sc.anims.exists(ak)) sc.anims.create({ key: ak, frames: sc.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: fps, repeat: 0 });
    this.movingUntil = now + (n / fps) * 1000 + 100;
    this.play(ak);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.active || this.dead || this.texture.key !== key) return;
      this.shownTop = this.topKey;
      this.play(this.topKey);
    });
  }

  /**
   * The shared boss hook, in the dragon's own art: "hurt" is the drawn flinch, "stagger" reels it on the spot (the wounded
   * sheet in the real phase, the flinch held and rocked before that) for `holdMs` or until "getup"/"idle".
   */
  playAnim(state: BossAnimState, opts?: { holdMs?: number; keepPattern?: boolean }): boolean {
    const sc = this.scene;
    if (!this.art || this.dead || !this.active) return super.playAnim(state, opts);
    const now = this.world.now();
    if (state === "hurt" || state === "attack" || state === "special") {
      this.move(state === "hurt" ? "flinch" : state === "attack" ? "slam" : "rear");
      return true;
    }
    if (state === "stagger" || state === "daze") {
      const key = this.hurtArt && sc.textures.exists("fe_concept_stagger_hurt") ? "fe_concept_stagger_hurt" : sc.textures.exists("fe_concept_flinch") ? "fe_concept_flinch" : "";
      if (!key) return super.playAnim(state, opts);
      const ak = `${key}:reel`;
      const n = sc.textures.get(key).frameTotal - 1;
      if (!sc.anims.exists(ak)) sc.anims.create({ key: ak, frames: sc.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: 8, repeat: -1, yoyo: true });
      const hold = opts?.holdMs ?? 1e9;
      this.reelingUntil = now + hold;
      this.movingUntil = now + hold;
      this.play(ak);
      return true;
    }
    if (state === "getup" || state === "idle" || state === "move") {
      const was = this.reelingUntil > now;
      this.reelingUntil = 0;
      this.movingUntil = 0;
      this.shownTop = this.topKey;
      this.play(this.topKey);
      return was || state !== "getup";
    }
    return false;
  }

  incoming(amount: number): number {
    const now = this.world.now();
    if (this.mode === "still" || this.healing) return 0;
    // a big hit gets a drawn flinch (not on every bullet)
    if (amount >= 25 && now - this.lastFlinch > 2600 && now >= this.reelingUntil) {
      this.lastFlinch = now;
      this.move("flinch", 12);
    }
    if (this.mode === "shrug") {
      if (now - this.lastShrug > 900) {
        this.lastShrug = now;
        this.world.floatText(this.x + (Math.random() - 0.5) * 120, this.y - 60, "NO EFFECT", "#c4b5fd", 14);
      }
      return 0;
    }
    if (this.mode === "immortal") {
      // it only ever loses so much before it puts itself back together
      const floor = this.maxHp * (1 - this.healAt);
      const a = Math.min(amount * 1.2, Math.max(0, this.hp - floor));
      if (this.hp - a <= floor + 0.5 && !this.healing) {
        this.healing = true;
        this.scene.time.delayedCall(10, () => this.onHeal?.());
      }
      return a;
    }
    // real
    const floor = this.maxHp * 0.02;
    const a = Math.min(amount * conceptRealDmg(), Math.max(0, this.hp - floor));
    const after = (this.hp - a) / this.maxHp;
    for (const m of [0.75, 0.5, 0.4, 0.3, 0.2]) {
      if (after > m || this.realMarks.has(m)) continue;
      this.realMarks.add(m);
      if (m === 0.5) this.scene.time.delayedCall(10, () => this.active && this.mode === "real" && this.scene.events.emit("epic-phase", this, "IT'S HURTING!", "#ffd23f"));
      else if (m === 0.75 || m === 0.3) this.scene.time.delayedCall(10, () => this.active && this.mode === "real" && this.scene.events.emit("concept-rage", m === 0.75 ? "IT'S FURIOUS" : "IT'S DESPERATE"));
      else this.gridQueued++;
    }
    if (this.hp - a <= floor + 0.5 && !this.lowFired) {
      this.lowFired = true;
      this.scene.time.delayedCall(10, () => this.onLow?.());
    }
    return a;
  }

  /** It knits itself back together: the bar refills, every wound closes. */
  fullHeal(ms = 1400, line = CONCEPT_HEAL): Promise<void> {
    this.healing = true;
    const sc = this.scene;
    synth.play("heal");
    this.roar();
    this.world.shake(ms, 0.01);
    this.world.floatText(this.x, this.y - this.displayHeight * 0.45, line, "#e9d5ff", 22);
    if (hasVfx(sc, "vfx_heal")) vfx(sc, "vfx_heal", this.x, this.y + 40, { scale: 5, depth: this.depth + 2, tint: 0xa855f7 });
    const glow = sc.add.ellipse(this.x, this.y, this.displayWidth * 0.9, this.displayHeight * 0.9, 0x22c55e, 0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 1);
    sc.tweens.add({ targets: glow, alpha: 0, scale: 1.4, duration: ms, onComplete: () => glow.destroy() });
    return new Promise((res) =>
      sc.tweens.add({
        targets: this,
        hp: this.maxHp,
        duration: ms,
        ease: "Sine.inOut",
        onUpdate: () => this.emitBar(),
        onComplete: () => {
          this.healing = false;
          this.lowFired = false;
          res();
        },
      }),
    );
  }

  /** Down in a heap after the brawl (the finale stages it): tick leaves it alone. */
  private slumped = false;
  /** Back up after the collapse: bigger, darker. */
  private risen = false;
  private slumpPose?: { sx: number; sy: number; y: number };

  /**
   * After the brawl: it comes down out of the storm like a dropped anvil, reels, and crumples into a heap with
   * smoke coming off it while its bar drains to nothing. Resolves once it's lying still.
   */
  collapse(): Promise<void> {
    const sc = this.scene;
    const w = this.world;
    this.healing = true;
    this.mode = "still";
    this.halt();
    sc.tweens.killTweensOf(this);
    sc.tweens.killTweensOf(this.wizard);
    this.wizard.setAlpha(0);
    const sx = this.scaleX / hdFactor(this);
    const sy = this.scaleY / hdFactor(this);
    const y0 = this.y;
    this.slumpPose = { sx, sy, y: y0 };
    // it lands (from the brawl's last punch: down out of the clouds)
    this.slumped = true;
    this.anims.stop();
    if (this.art && sc.textures.exists("fe_concept_stagger_hurt")) this.setTexture("fe_concept_stagger_hurt", 0);
    this.setY(y0 - 520).setAlpha(1);
    return new Promise((res) => {
      sc.tweens.add({
        targets: this,
        y: y0,
        duration: 420,
        ease: "Quad.in",
        onComplete: () => {
          if (!this.active) return res();
          // the impact: the whole town jumps
          synth.play("smash", 1, 0.7);
          synth.play("boom", 0.9, 0.75);
          synth.play("explode", 0.6, 0.8);
          w.shake(700, 0.022);
          sc.cameras.main.flash(120, 255, 240, 220, true);
          if (hasVfx(sc, "vfx_bigboom")) vfx(sc, "vfx_bigboom", this.x, y0 + 60, { scale: 3, depth: this.depth + 3 });
          if (hasVfx(sc, "vfx_dust")) for (let i = 0; i < 5; i++) vfx(sc, "vfx_dust", this.x + (i - 2) * 110, y0 + 90 + (i % 2) * 20, { scale: 2.4, depth: this.depth + 2, delay: i * 40 });
          const crater = sc.add.ellipse(this.x, y0 + 100, this.displayWidth * 0.95, this.displayWidth * 0.3, 0x0d0a08, 0.75).setDepth(0.6);
          crater.setStrokeStyle(6, 0x2a211c, 0.8);
          sc.tweens.add({ targets: crater, scaleX: { from: 0.4, to: 1 }, scaleY: { from: 0.4, to: 1 }, duration: 260, ease: "Cubic.out" });
          const cracks = sc.add.graphics().setDepth(0.65);
          cracks.lineStyle(4, 0x050403, 0.9);
          for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2 + Math.random() * 0.4;
            let cx = this.x + Math.cos(a) * this.displayWidth * 0.4;
            let cy = y0 + 100 + Math.sin(a) * this.displayWidth * 0.13;
            cracks.beginPath().moveTo(cx, cy);
            for (let j = 0; j < 4; j++) cracks.lineTo((cx += Math.cos(a + (Math.random() - 0.5) * 0.9) * 60), (cy += Math.sin(a + (Math.random() - 0.5) * 0.9) * 26));
            cracks.strokePath();
          }
          // a reel on its feet...
          let n = 0;
          const reel = () => {
            if (!this.active) return res();
            if (this.art && sc.textures.exists("fe_concept_stagger_hurt")) this.setFrame(Math.min(n, sc.textures.get("fe_concept_stagger_hurt").frameTotal - 2));
            this.setAngle(n % 2 ? 6 : -7);
            this.x += n % 2 ? 14 : -14;
            if (++n < 6) sc.time.delayedCall(150 + n * 20, reel);
            else crumple();
          };
          // ...then it goes down: folds, sinks, lies there smoking
          const crumple = () => {
            synth.play("bodies_land", 1, 0.6);
            synth.play("bonecrack", 0.7, 0.7);
            synth.play("smash", 0.7, 0.55);
            w.shake(500, 0.016);
            this.setTint(0x6b5a7a);
            sc.tweens.add({ targets: this, scaleX: sx * 1.1, scaleY: sy * 0.6, angle: 9, y: y0 + this.displayHeight * 0.14, duration: 650, ease: "Bounce.out" });
            if (hasVfx(sc, "vfx_dust")) for (let i = 0; i < 4; i++) vfx(sc, "vfx_dust", this.x + (i - 1.5) * 130, y0 + 100, { scale: 2.6, depth: this.depth + 2, delay: 200 + i * 60 });
            if (hasVfx(sc, "vfx_smokecol")) for (let i = 0; i < 3; i++) vfx(sc, "vfx_smokecol", this.x + (i - 1) * 120, y0 + 40, { scale: 2.2, depth: this.depth + 4, alpha: 0.7, delay: 300 + i * 200 });
            else if (hasVfx(sc, "vfx_smoke")) for (let i = 0; i < 4; i++) vfx(sc, "vfx_smoke", this.x + (i - 1.5) * 90, y0 + 30, { scale: 2.4, depth: this.depth + 4, delay: 300 + i * 160 });
            // its bar drains to nothing
            sc.tweens.add({ targets: this, hp: 0, duration: 1100, ease: "Cubic.out", onUpdate: () => this.emitBar() });
            sc.time.delayedCall(1200, () => res());
          };
          sc.time.delayedCall(120, reel);
        },
      });
    });
  }

  /** Lying still... then a twitch. Another. Each one a dry crack and a judder. */
  twitch(k = 1) {
    const sc = this.scene;
    if (!this.active || !this.slumpPose) return;
    synth.play("bonecrack", 0.35 + 0.2 * k, 0.55 + Math.random() * 0.1);
    if (k > 0.6) synth.play("squelch", 0.4, 0.6);
    const a = this.angle;
    sc.tweens.add({ targets: this, angle: a + (Math.random() < 0.5 ? -1 : 1) * 5 * k, scaleY: this.scaleY * (1 + 0.06 * k), duration: 70, yoyo: true, ease: "Quad.out" });
    this.world.shake(120, 0.004 * k);
    if (hasVfx(sc, "vfx_dust")) vfx(sc, "vfx_dust", this.x + (Math.random() - 0.5) * 160, this.y + 60, { scale: 1.2, depth: this.depth + 2 });
  }

  /**
   * It gets back up: unfolds, out of the heap, bigger and darker than it was, the wounded light in it gone dim, and
   * roars. (Its bar is still empty: `refill` does that.)
   */
  reemerge(riseMs = 2400): Promise<void> {
    const sc = this.scene;
    const pose = this.slumpPose ?? { sx: this.scaleX / hdFactor(this), sy: this.scaleY / hdFactor(this), y: this.y };
    this.healing = true;
    this.risen = true;
    this.slumped = true;
    if (this.art) {
      this.anims.stop();
      this.setTexture(this.hurtArt ? "fe_dragon_top_hurt" : "fb_dragon_top", 0);
    }
    this.setTint(0x6b5a7a);
    // up it comes, in heaves
    sc.tweens.add({ targets: this, x: this.x + 10, duration: 110, yoyo: true, repeat: Math.floor(riseMs / 220) - 1 });
    return new Promise((res) =>
      sc.tweens.add({
        targets: this,
        scaleX: pose.sx * 1.14,
        scaleY: pose.sy * 1.14,
        angle: 0,
        y: pose.y,
        duration: riseMs,
        ease: "Sine.inOut",
        onComplete: () => {
          if (!this.active) return res();
          this.slumped = false;
          this.movingUntil = this.reelingUntil = 0;
          this.shownTop = this.topKey;
          if (this.art) this.play(this.topKey);
          this.roar();
          this.revealWizard();
          res();
        },
      }),
    );
  }

  /** The bar refills, slowly, all the way, and nothing you can do about it. `line` floats over it as it does. */
  refill(ms = 4200, line = CONCEPT_HEAL): Promise<void> {
    const sc = this.scene;
    this.healing = true;
    if (hasVfx(sc, "vfx_heal")) vfx(sc, "vfx_heal", this.x, this.y + 40, { scale: 5.5, depth: this.depth + 2, tint: 0x6d28d9 });
    this.world.floatText(this.x, this.y - this.displayHeight * 0.45, line, "#e9d5ff", 22);
    const glow = sc.add.ellipse(this.x, this.y, this.displayWidth * 0.9, this.displayHeight * 0.9, 0x4c1d95, 0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 1);
    sc.tweens.add({ targets: glow, alpha: 0.08, scale: 1.25, yoyo: true, repeat: Math.max(0, Math.round(ms / 900) - 1), duration: 450, onComplete: () => glow.destroy() });
    synth.play("heal", 0.8, 0.6);
    // slowly, inexorably: a steady glug, all the way to the top
    return new Promise((res) =>
      sc.tweens.add({
        targets: this,
        hp: this.maxHp,
        duration: ms,
        ease: "Linear",
        onUpdate: () => this.emitBar(),
        onComplete: () => {
          this.healing = false;
          this.lowFired = false;
          res();
        },
      }),
    );
  }

  private emitBar() {
    G.emit("boss", { name: CONCEPT, hp: this.hp, max: this.maxHp, shielded: (this.mode === "shrug" || this.mode === "still") && !this.slumped && !this.risen, phase: this.mode === "real" ? 1 : 0 });
  }

  tick(dt: number, now: number) {
    if (this.dead) return;
    if (this.slumped) {
      // in a heap (or getting up out of one): the finale's tweens have it; just keep the bar and the wizard in step
      this.wizard.setPosition(this.x + 10, this.y - this.displayHeight * 0.18).setDepth(this.depth - 1);
      this.emitBar();
      this.halt();
      return;
    }
    if (this.reelingUntil && now >= this.reelingUntil) this.playAnim("getup");
    // (not Boss.tick: that flips frames 0/1, and this one has its own animation)
    // into the real phase: swap to the wounded sheet (unless it's mid-roar)
    if (this.art && this.anims.isPlaying && this.topKey !== this.shownTop && now >= this.movingUntil) {
      this.shownTop = this.topKey;
      this.play(this.topKey);
    }
    if (now < this.flashUntil) this.setTintFill(0xffffff);
    else if (this.risen) this.setTint(0x9d86b8);
    else if (this.mode === "real") this.hurtArt ? this.clearTint() : this.setTint(0xffd6e0);
    else if (this.art) this.clearTint();
    else this.setTint(0x6d28d9);
    this.wizard.setPosition(this.x + 10, this.y - this.displayHeight * 0.18).setDepth(this.depth - 1);
    this.emitBar();
    if (!this.started || this.mode === "still") {
      this.halt();
      return;
    }
    // the storm: lightning near you, and the wizard behind it
    if (now >= this.nextStrike) {
      this.nextStrike = now + (this.mode === "real" ? 2600 : 4200) + Math.random() * 2500;
      this.lightning();
    }
    if (now >= this.nextBark) {
      // a clinical line, out loud, over the fight (nothing stops: it's a layered voice and a caption)
      this.nextBark = now + 6500 + Math.random() * 4000;
      if (!this.barkDeck.length) this.barkDeck = Phaser.Utils.Array.Shuffle([...CONCEPT_BARKS]);
      const line = this.barkDeck.pop()!;
      this.world.floatText(this.x, this.y - this.displayHeight * 0.48, line, "#d8b4fe", 20);
      // ("[CITATION NEEDED]" and friends are captions only)
      if (!line.startsWith("[")) void voice.layer(CONCEPT, line, 1);
      this.roar();
    }
    // now and then the wizard behind it shows himself, and YEEs
    if (now >= this.nextCackle) {
      this.nextCackle = now + 11000 + Math.random() * 9000;
      this.revealWizard();
      this.wizardYee();
    }
    this.pattern(dt, now);
  }

  /** A bolt comes down near you (telegraphed); the sky flashes and the wizard shows. */
  lightning(at?: { x: number; y: number }) {
    const w = this.world;
    const sc = this.scene;
    const p = w.player;
    const x = at?.x ?? p.x + (Math.random() - 0.5) * 220;
    const y = at?.y ?? p.y + (Math.random() - 0.5) * 160;
    const tele = 750 * w.telegraphMult;
    // wounded, it calls the strike down itself now and then (claws up, the storm crackling between them)
    if (!at && this.mode === "real" && Math.random() < 0.4) this.move("storm", 12);
    w.enemyAoe(x, y, 58, this.mode === "real" ? 20 : 14, tele, 0xc4b5fd);
    sc.time.delayedCall(tele - 60, () => {
      if (!this.active) return;
      if (sc.textures.exists("fb_lightning") && sc.anims.exists("fb_lightning")) {
        const b = sc.add.sprite(x, y + 14, "fb_lightning", 0).setOrigin(0.5, 0.86).setScale(2.4).setDepth(y + 60).setBlendMode(Phaser.BlendModes.ADD).setTint(0xe9d5ff);
        b.play("fb_lightning");
        b.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => b.destroy());
      } else {
        const g = sc.add.graphics().setDepth(y + 60).setBlendMode(Phaser.BlendModes.ADD);
        let px = x;
        let py = y - 500;
        g.lineStyle(4, 0xd8c8ff, 1).beginPath().moveTo(px, py);
        while (py < y) g.lineTo((px += (Math.random() - 0.5) * 40), (py = Math.min(y, py + 30)));
        g.strokePath();
        sc.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
      }
      sc.cameras.main.flash(160, 200, 190, 255, true);
      synth.play(Math.random() < 0.5 ? "thunder_1" : "thunder_2");
      this.revealWizard();
      if (Math.random() < 0.2 && this.world.now() > this.nextCackle - 8000) {
        this.nextCackle = this.world.now() + 9000 + Math.random() * 6000;
        sc.time.delayedCall(250, () => this.active && this.wizardYee());
      }
    });
  }

  /** A demonic roar: the jaws open wide (glowing throat), the ground shakes, then it shuts its mouth again. */
  roar() {
    const sc = this.scene;
    const now = this.world.now();
    if (now < this.roaringUntil) return;
    this.roaringUntil = now + 2200;
    if (!synth.shout("concept_roar", 1, 0.9 + Math.random() * 0.15)) synth.play("roar");
    this.world.shake(1300, 0.006);
    const rk = this.roarKey;
    if (!this.art || !sc.textures.exists(rk) || now < this.movingUntil) return;
    this.anims.stop();
    this.setTexture(rk, 0);
    sc.time.delayedCall(110, () => this.active && !this.dead && this.texture.key === rk && this.setFrame(1));
    // its head rears: a little swell while it bellows
    const sx = this.scaleX;
    const sy = this.scaleY;
    sc.tweens.add({ targets: this, scaleX: sx * 1.04, scaleY: sy * 1.06, duration: 260, yoyo: true, hold: 1100, ease: "Sine.out" });
    sc.time.delayedCall(1500, () => this.active && !this.dead && this.texture.key === rk && this.setFrame(0));
    sc.time.delayedCall(1650, () => {
      if (!this.active || this.dead) return;
      this.shownTop = this.topKey;
      this.play(this.topKey);
    });
  }

  /** The withered old wizard behind it, doing a SanMik YEE in a voice like a dry reed. */
  wizardYee() {
    if (!synth.shout("wizard_yee", 0.95, 0.96 + Math.random() * 0.08)) return;
    const t = this.scene.add
      .text(this.x + 90, this.y - this.displayHeight * 0.42, Phaser.Utils.Array.GetRandom(["Yeeeee…", "YEEEEEEE", "yee… yee… yeeeee", "YEE-HEE-HEE"]) as string, { fontFamily: "Georgia, serif", fontSize: "26px", color: "#c4b5fd", fontStyle: "italic", stroke: "#12002a", strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(this.depth + 5)
      .setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 0.95, y: t.y - 20, duration: 400, yoyo: true, hold: 900, onComplete: () => t.destroy() });
  }

  revealWizard() {
    this.scene.tweens.killTweensOf(this.wizard);
    this.wizard.setAlpha(0.62);
    this.setTintFill(0xe9d5ff);
    this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    this.scene.tweens.add({ targets: this.wizard, alpha: 0, delay: 300, duration: 1100 });
  }

  /** Real phase: how wound up it is (0 above 66%, 1 above 33%, 2 below). Its patterns come faster with each. */
  get rage() {
    if (this.mode !== "real") return 0;
    const k = this.hp / this.maxHp;
    return k > 0.66 ? 0 : k > 0.33 ? 1 : 2;
  }

  pattern(dt: number, now: number) {
    const before = this.nextPattern;
    this.patternStep(dt, now);
    // wound up: less of a breather between attacks
    if (this.nextPattern !== before && this.nextPattern > now) this.nextPattern = now + (this.nextPattern - now) * [1, 0.84, 0.7][this.rage];
  }

  private patternStep(_dt: number, now: number) {
    const w = this.world;
    const p = w.player;
    const ts = w.enemyTimeScale;
    const real = this.mode === "real";
    // it lumbers about the middle of town, after you
    const tx = Phaser.Math.Clamp(p.x, this.roam.left, this.roam.right);
    const ty = Phaser.Math.Clamp(p.y - 140, this.roam.top, this.roam.bottom);
    if (Phaser.Math.Distance.Between(this.x, this.y, tx, ty) > 60) this.moveToward(tx, ty, (real ? 62 : 42) * ts);
    else this.halt();
    this.setFlipX(false);
    if (now < this.nextPattern) return;
    const tele = 900 * w.telegraphMult;
    // badly hurt: the storm itself turns on you (a checkerboard of strikes, two waves)
    if (real && this.gridQueued > 0) {
      this.gridQueued--;
      this.lightningGrid(now);
      return;
    }
    // once it's healed (or once it's really fighting) it has the spiral too
    const spiral = real || this.escalation >= 1;
    // badly hurt, it has more: the CLAW CROSS below 75%, the COMET TRAIL below half
    const k = this.hp / this.maxHp;
    const extra = real ? (k < 0.75 ? 1 : 0) + (k < 0.5 ? 1 : 0) : 0;
    const pick = this.patternIdx++ % ((spiral ? 6 : 5) + extra);
    const fury = real ? 1.5 + this.rage * 0.15 : 1 + this.escalation * 0.12;
    if (pick === 5) {
      this.spiral(now, real);
      return;
    }
    if (pick === 6) {
      this.clawCross(now);
      return;
    }
    if (pick === 7) {
      this.cometTrail(now);
      return;
    }
    if (pick === 0) {
      // ARM SLAM: claws come down where you are (and where you're going); its arms go up first
      this.move("slam", 11);
      const n = Math.round(4 * fury);
      const body = p.spr.body as Phaser.Physics.Arcade.Body;
      for (let i = 0; i < n; i++) {
        const lead = i * 0.22;
        const x = p.x + body.velocity.x * lead + (Math.random() - 0.5) * 70;
        const y = p.y + body.velocity.y * lead + (Math.random() - 0.5) * 70;
        this.scene.time.delayedCall(i * 260, () => {
          if (!this.active) return;
          w.enemyAoe(x, y, 82, 22, tele, 0x7c3aed);
          this.scene.time.delayedCall(tele, () => {
            if (!this.active) return;
            synth.play("smash");
            w.shake(140, 0.008);
            this.claw(x, y);
          });
        });
      }
      this.nextPattern = now + 1700 + n * 260;
    } else if (pick === 1) {
      // TENTACLE SWEEP: a fan of lines swept across the ground
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = Math.round(8 * fury);
      for (let i = 0; i < n; i++) {
        const a = base - dir * 0.9 + dir * (1.8 * i) / (n - 1);
        w.enemyLine(this.x, this.y + 30, a, 900, 44, 18, tele + i * 110);
      }
      synth.play("swing");
      this.nextPattern = now + tele + n * 110 + 900;
    } else if (pick === 2) {
      // BREATH: bursts of bile at you (it rears and breathes in first)
      this.move("rear", 14);
      const bursts = real ? 6 : 4;
      for (let i = 0; i < bursts; i++)
        this.scene.time.delayedCall(i * 230, () => {
          if (!this.active || this.mode === "still") return;
          this.fan(real ? 9 : 7, 0.13, 290, 12, i % 2 ? 0x84cc16 : 0xa855f7);
          synth.play("pfft");
        });
      this.nextPattern = now + bursts * 230 + 1300;
    } else if (pick === 3) {
      // SHOCKWAVE: it stomps; rings of bolts roll out
      w.enemyAoe(this.x, this.y + 40, 240, 24, tele, 0xa855f7);
      for (let k = 0; k < (real ? 4 : 3); k++)
        this.scene.time.delayedCall(tele + k * 380, () => {
          if (!this.active || this.mode === "still") return;
          this.ring(real ? 26 : 20, 210, 12, 0xc084fc, k * 0.13);
          w.shake(200, 0.01);
        });
      this.nextPattern = now + tele + 1800;
    } else {
      // SUMMON: horrors crawl out of the rubble
      const alive = w.enemies.filter((e) => !e.dead && !e.isBoss).length;
      const n = Math.max(0, Math.min(real ? 5 : 3, 9 - alive));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const x = this.x + Math.cos(a) * 220;
        const y = this.y + 80 + Math.abs(Math.sin(a)) * 120;
        this.scene.time.delayedCall(i * 180, () => this.active && this.horror(x, y));
      }
      if (n) w.floatText(this.x, this.y - this.displayHeight * 0.4, "SEE ALSO:", "#d8b4fe", 16);
      this.nextPattern = now + 1500;
    }
  }

  /**
   * THE DSM SPIRAL (bullet hell, but readable): it rears, its throat glows, then four streams of slow bolts wind
   * out of its mouth, two arms each way, so the lanes between them open and close like scissors. Walk with them.
   */
  private spiral(now: number, real: boolean) {
    const w = this.world;
    const sc = this.scene;
    const charge = 800 * w.telegraphMult;
    const dur = real ? 3600 : 3000;
    this.move("rear", 10);
    const mx = () => this.x;
    const my = () => this.y + 30;
    this.roar();
    w.floatText(this.x, this.y - this.displayHeight * 0.4, "DSM-5", "#d8b4fe", 22);
    const glow = sc.add.circle(mx(), my(), 26, 0xa855f7, 0.55).setDepth(this.depth + 3).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
    sc.tweens.add({ targets: glow, scale: 3, alpha: 0.2, duration: charge, ease: "Quad.in", onComplete: () => glow.destroy() });
    let a = Math.random() * Math.PI * 2;
    const step = real ? 0.2 : 0.17;
    const speed = real ? 170 : 150;
    sc.time.delayedCall(charge, () => {
      if (!this.active || this.mode === "still") return;
      synth.play("pfft");
      const ev = sc.time.addEvent({
        delay: real ? 120 : 140,
        repeat: Math.floor(dur / (real ? 120 : 140)),
        callback: () => {
          if (!this.active || this.mode === "still" || this.healing) return ev.remove();
          a += step;
          for (let k = 0; k < 2; k++) {
            w.shoot(mx(), my(), { owner: "enemy", damage: 11, speed, angle: a + k * Math.PI, color: 0xa855f7, life: 6000, scale: 1.3 });
            w.shoot(mx(), my(), { owner: "enemy", damage: 11, speed, angle: -a + k * Math.PI + 0.5, color: 0x84cc16, life: 6000, scale: 1.3 });
          }
        },
      });
    });
    this.nextPattern = now + charge + dur + 1200;
  }

  /**
   * THE LIGHTNING GRID: the ground round you is marked out in a checkerboard; the storm hits the dark squares, then
   * the light ones. Stand on a light square for the first wave and step across for the second.
   */
  private lightningGrid(now: number) {
    const w = this.world;
    const sc = this.scene;
    const p = w.player;
    const tele = 1150 * w.telegraphMult;
    const cell = 132;
    const cx = p.x;
    const cy = p.y;
    // its wounded storm wind-up (when drawn), under the roar
    this.move("storm", 10);
    this.roar();
    w.floatText(this.x, this.y - this.displayHeight * 0.45, "[CITATION NEEDED]", "#e9d5ff", 22);
    for (let wave = 0; wave < 2; wave++)
      sc.time.delayedCall(wave * (tele + 250), () => {
        if (!this.active || this.mode !== "real") return;
        for (let i = -3; i <= 3; i++)
          for (let j = -2; j <= 2; j++) {
            if ((((i + j) % 2) + 2) % 2 !== wave) continue;
            const x = cx + i * cell;
            const y = cy + j * cell;
            if (!Phaser.Geom.Rectangle.Contains(w.bounds, x, y)) continue;
            w.enemyAoe(x, y, cell * 0.5, 18, tele, 0xe9d5ff);
          }
        sc.time.delayedCall(tele - 40, () => {
          if (!this.active) return;
          sc.cameras.main.flash(140, 200, 190, 255, true);
          synth.play(Math.random() < 0.5 ? "thunder_1" : "thunder_2");
          w.shake(260, 0.012);
          this.revealWizard();
          if (sc.textures.exists("fb_lightning") && sc.anims.exists("fb_lightning"))
            for (let k = 0; k < 4; k++) {
              const bx = cx + (Math.random() - 0.5) * cell * 6;
              const by = cy + (Math.random() - 0.5) * cell * 4;
              const bolt = sc.add.sprite(bx, by + 14, "fb_lightning", 0).setOrigin(0.5, 0.86).setScale(2.2).setDepth(by + 60).setBlendMode(Phaser.BlendModes.ADD).setTint(0xe9d5ff);
              bolt.play("fb_lightning");
              bolt.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => bolt.destroy());
            }
        });
      });
    this.nextPattern = now + 2 * (tele + 250) + 1100;
  }

  /**
   * THE CLAW CROSS (real phase, below 75%): two of its arms rake an X through where you're standing, then (once it's
   * wound up) a + where you've stepped to. Step out of the middle, then out of the lines.
   */
  private clawCross(now: number) {
    const w = this.world;
    const p = w.player;
    const tele = 900 * w.telegraphMult;
    this.move("slam", 11);
    w.floatText(this.x, this.y - this.displayHeight * 0.4, "SEE ALSO:", "#d8b4fe", 18);
    const waves = this.rage >= 1 ? 2 : 1;
    for (let wave = 0; wave < waves; wave++)
      this.scene.time.delayedCall(wave * tele * 0.7, () => {
        if (!this.active || this.mode !== "real") return;
        const x0 = p.x;
        const y0 = p.y;
        // a line right through where you are, both ways
        for (const a of wave ? [0, Math.PI / 2] : [Math.PI / 4, -Math.PI / 4]) w.enemyLine(x0 - Math.cos(a) * 520, y0 - Math.sin(a) * 520, a, 1040, 50, 20, tele);
        this.scene.time.delayedCall(tele, () => {
          if (!this.active) return;
          synth.play("smash");
          w.shake(180, 0.01);
          this.claw(x0, y0);
        });
      });
    this.nextPattern = now + tele * (1 + 0.7 * (waves - 1)) + 1100;
  }

  /**
   * THE COMET TRAIL (real phase, below half): a string of bile comets comes down one after another, each a step
   * closer to wherever you are. Keep moving, at an angle to it.
   */
  private cometTrail(now: number) {
    const w = this.world;
    const p = w.player;
    const sc = this.scene;
    const tele = 650 * w.telegraphMult;
    this.move("rear", 12);
    this.roar();
    const n = 7 + this.rage * 2;
    let x = this.x;
    let y = this.y + 90;
    for (let i = 0; i < n; i++)
      sc.time.delayedCall(i * 170, () => {
        if (!this.active || this.mode !== "real") return;
        const a = Math.atan2(p.y - y, p.x - x);
        const step = Math.min(110, Phaser.Math.Distance.Between(x, y, p.x, p.y));
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        const cx = x;
        const cy = y;
        w.enemyAoe(cx, cy, 70, 18, tele, i % 2 ? 0x84cc16 : 0xa855f7);
        sc.time.delayedCall(tele, () => {
          if (!this.active) return;
          synth.play(i % 2 ? "pfft" : "smash");
          w.shake(90, 0.006);
          if (hasVfx(sc, "vfx_dust")) vfx(sc, "vfx_dust", cx, cy + 8, { scale: 1.4, depth: cy + 10, tint: 0xa855f7 });
        });
      });
    this.nextPattern = now + n * 170 + tele + 900;
  }

  /** A claw mark where an arm comes down. */
  private claw(x: number, y: number) {
    const sc = this.scene;
    const g = sc.add.graphics().setDepth(5);
    g.lineStyle(5, 0x1a0b2a, 0.85);
    for (let k = -1; k <= 1; k++) g.lineBetween(x - 40 + k * 18, y - 30, x + 30 + k * 18, y + 34);
    sc.tweens.add({ targets: g, alpha: 0, delay: 900, duration: 700, onComplete: () => g.destroy() });
    if (hasVfx(sc, "vfx_dust")) vfx(sc, "vfx_dust", x, y + 8, { scale: 1.6, depth: y + 10 });
  }

  /** One of its horrors: a crawling thing that chases you. */
  private horror(x: number, y: number) {
    const w = this.world;
    const e = w.spawnEnemy("ai_pitbull_spider", x, y, { noDrops: true, minion: true });
    if (!e) return;
    e.setTexture(horrorKey(this.scene), 0).setScale(1.7);
    e.def = { ...e.def, name: "Horror", shout: ["SEE ALSO", "[CITATION NEEDED]", "*skittering*", "*clinical noises*"], color: 0x4c1d95, accent: 0xa855f7 };
    e.maxHp = e.hp = Math.round(60 + (this.mode === "real" ? 30 : 0));
    if (hasVfx(this.scene, "vfx_dust")) vfx(this.scene, "vfx_dust", x, y + 10, { scale: 1.2, depth: y + 11, tint: 0xa855f7 });
  }
}

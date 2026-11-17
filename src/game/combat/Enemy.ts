import Phaser from "phaser";
import { ENEMIES, type EnemyDef } from "../../data/enemies";
import type { CombatWorld } from "./types";
import { synth } from "../audio/Synth";

let NEXT_ID = 1;

/**
 * Drawn death animations (fe_die_<type>, PixelLab): which frames to play and how it ends. "hold" stays on the
 * last frame a moment and fades; "pop" bursts at the end; "boom" goes up in an explosion at the end.
 */
const DEATHS: Record<string, { to: number; end: "hold" | "pop" | "boom"; fps: number }> = {
  ai_pitbull: { to: 5, end: "pop", fps: 16 },
  ai_pitbull_twin: { to: 8, end: "hold", fps: 16 },
  ai_pitbull_spider: { to: 8, end: "hold", fps: 16 },
  nonce: { to: 8, end: "hold", fps: 14 },
  kamikaze: { to: 4, end: "boom", fps: 14 },
  news_drone: { to: 8, end: "hold", fps: 16 },
  idf: { to: 8, end: "hold", fps: 16 },
  hamas: { to: 8, end: "hold", fps: 16 },
  mini_drongus: { to: 5, end: "pop", fps: 16 },
};
/** These get a coded death of their own (no drawn one). */
const CODED_DEATHS = new Set(["deepfake_anchor"]);

/**
 * Drawn walk and attack sheets (PixelLab, from the enemy's own idle frame so they stay on-model):
 * en_<type>_walk loops while it moves, en_<type>_atk plays once (and holds its last frame) while it winds up,
 * fires, lunges, lobs or fizzes. Same frame size and hd as en_<type>, so swapping never changes its size or
 * hitbox. Missing sheets fall back to the old behaviour (the idle sheet's frames cycling).
 */
const WALK_FPS = 11;
const ATK_FPS = 15;
/** Close enough to bite: chasers and swarms play their attack as they reach you. */
const BITE_RANGE = 70;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  uid = NEXT_ID++;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  world: CombatWorld;
  isBoss = false;
  dead = false;
  noDrops = false;
  minion = false;
  dmgMult = 1;
  speedMult = 1;
  // timers (ms, world-time)
  stunUntil = 0;
  markedUntil = 0;
  slowUntil = 0;
  slowAmt = 0;
  nextAttack = 0;
  contactCd = 0;
  state: "idle" | "move" | "windup" | "dash" | "recover" | "fuse" = "move";
  stateUntil = 0;
  dashAngle = 0;
  facing = 0;
  orbitDir = 1;
  wanderAngle = Math.random() * Math.PI * 2;
  spawnCount = 0;
  flashUntil = 0;
  hpBar?: Phaser.GameObjects.Graphics;
  /** Side-scrolling rooms: walks on the ground (gravity) rather than flying. */
  walker = false;
  private animT = 0;
  /** Its walk / attack sheets (undefined: not looked up yet; null: none, or something else owns its texture). */
  private sheetArt?: { base: string; walk: string | null; atk: string | null } | null;
  private artMode: "idle" | "walk" | "atk" = "idle";
  private artFrame = 0;
  /** Hold the attack pose until then (a lob, a spawn: attacks with no windup state). */
  attackUntil = 0;

  constructor(world: CombatWorld, type: string, x: number, y: number, hpMult = 1, defOverride?: EnemyDef, texture?: string) {
    const def = defOverride ?? ENEMIES[type];
    super(world.sc, x, y, texture ?? `en_${type}`, 0);
    this.def = def;
    this.world = world;
    this.maxHp = Math.round(def.hp * hpMult);
    this.hp = this.maxHp;
    world.sc.add.existing(this);
    world.sc.physics.add.existing(this);
    this.setScale(2);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // hitbox in world terms stays the same whatever the art size (PixelLab art is drawn larger)
    const fw = this.frame.width;
    const r = def.size * 0.4 * (fw / def.size);
    body.setCircle(r, fw / 2 - r, this.frame.height / 2 - r);
    body.setCollideWorldBounds(true);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.nextAttack = world.now() + 800 + Math.random() * 900;
  }

  /** Stop moving (walkers keep falling). */
  private halt2() {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.walker) body.setVelocityX(0);
    else body.setVelocity(0, 0);
  }

  get radius() {
    return this.def.size * 0.8;
  }

  slowFactor(now: number) {
    return now < this.slowUntil ? 1 - this.slowAmt : 1;
  }

  /** Main brain. dt in ms (already scaled by enemyTimeScale). */
  tick(dt: number, now: number) {
    if (this.dead) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const p = this.world.player;
    this.animT += dt;
    if (!this.stepArt(now)) {
      // cycle the sheet's frames (old art has 2; the animated PixelLab sheets have more, played quicker)
      const nf = Math.max(1, this.texture.frameTotal - 1);
      if (this.animT > (nf > 2 ? 110 : 220)) {
        this.animT = 0;
        this.setFrame((Number(this.frame.name) + 1) % nf);
      }
    }
    if (now < this.flashUntil) this.setTintFill(0xffffff);
    else if (now < this.markedUntil) this.setTint(0xd8b4fe);
    else this.clearTint();
    if (now < this.stunUntil) {
      if (this.walker) body.velocity.x *= 0.85;
      else body.velocity.scale(0.85);
      return;
    }
    const ts = this.world.enemyTimeScale;
    const spd = this.def.speed * this.speedMult * this.slowFactor(now) * ts;
    const target = p.targetPoint();
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toP = Math.atan2(dy, dx);
    const lost = p.isHidden();
    const tele = 600 * this.world.telegraphMult;

    const moveAngle = (ang: number, s: number) => {
      this.facing = ang;
      if (!this.walker) {
        body.setVelocity(Math.cos(ang) * s, Math.sin(ang) * s);
        return;
      }
      // side-on: run along the ground, hop up to you or over things
      body.setVelocityX(Math.cos(ang) * s);
      const grounded = body.blocked.down || body.touching.down;
      if (grounded && ((dy < -70 && Math.abs(dx) < 280 && Math.random() < 0.04) || ((body.blocked.left || body.blocked.right) && Math.random() < 0.1))) body.setVelocityY(-600);
    };

    if (lost) {
      // Lulon Lurk: they can't see you. They wander, confused.
      if (Math.random() < 0.02) this.wanderAngle += (Math.random() - 0.5) * 2;
      moveAngle(this.wanderAngle, spd * 0.4);
      this.setFlipX(Math.cos(this.wanderAngle) < 0);
      return;
    }
    this.setFlipX(dx < 0);

    switch (this.def.behavior) {
      case "chaser":
      case "swarm": {
        const wobble = this.def.behavior === "swarm" ? Math.sin(now / 200 + this.uid) * 0.6 : 0;
        if (this.def.id === "tax_goblin") {
          // runs away with the money, zig-zagging
          moveAngle(toP + Math.PI + Math.sin(now / 300 + this.uid) * 0.9, spd * (dist < 260 ? 1 : 0.6));
          break;
        }
        moveAngle(toP + wobble, spd);
        break;
      }
      case "charger": {
        if (this.state === "move") {
          moveAngle(toP, spd * (dist > 200 ? 1 : 0.5));
          if (dist < 300 && now > this.nextAttack) {
            this.state = "windup";
            this.stateUntil = now + tele;
            this.dashAngle = this.walker ? (dx < 0 ? Math.PI : 0) : toP;
            this.halt2();
            this.world.enemyLine(this.x, this.y, this.dashAngle, 260, 26, 0, tele);
          }
        } else if (this.state === "windup") {
          this.halt2();
          this.setTint(0xff6666);
          if (now > this.stateUntil) {
            this.state = "dash";
            this.stateUntil = now + 420 / Math.max(0.2, ts);
          }
        } else if (this.state === "dash") {
          moveAngle(this.dashAngle, 520 * ts);
          if (now > this.stateUntil) {
            this.state = "recover";
            this.stateUntil = now + 500;
          }
        } else {
          if (this.walker) body.velocity.x *= 0.8;
          else body.velocity.scale(0.8);
          if (now > this.stateUntil) {
            this.state = "move";
            this.nextAttack = now + 1200 + Math.random() * 800;
          }
        }
        break;
      }
      case "shooter":
      case "orbiter": {
        const pref = this.def.behavior === "orbiter" ? 170 : 240;
        let ang = toP;
        if (dist < pref - 40) ang = toP + Math.PI;
        else if (dist < pref + 60) ang = toP + (Math.PI / 2) * this.orbitDir;
        moveAngle(ang, spd);
        if (now > this.nextAttack && this.def.projectile) {
          const pr = this.def.projectile;
          if (this.state !== "windup") {
            this.state = "windup";
            this.stateUntil = now + tele * 0.6;
          } else if (now > this.stateUntil) {
            this.state = "move";
            // side-scrolling: two-way spreads at most, so the screen stays readable
            const n = this.world.side ? Math.min(2, pr.count ?? 1) : pr.count ?? 1;
            for (let i = 0; i < n; i++) {
              const a = toP + (n > 1 ? (i - (n - 1) / 2) * (pr.spread ?? 0.2) : 0);
              this.world.shoot(this.x, this.y, { owner: "enemy", damage: pr.damage * this.dmgMult, speed: pr.speed, angle: a, color: pr.color, life: 3500 });
            }
            this.nextAttack = now + pr.rate * (0.8 + Math.random() * 0.4);
          }
          if (this.state === "windup") this.setTint(0xffaaaa);
        }
        break;
      }
      case "bomber": {
        if (this.state !== "fuse") {
          moveAngle(toP, spd);
          if (dist < 60) {
            this.state = "fuse";
            this.stateUntil = now + tele;
            this.halt2();
            this.world.enemyAoe(this.x, this.y, 70, this.def.damage * this.dmgMult, tele, this.def.color);
            synth.play("telegraph");
          }
        } else {
          this.halt2();
          this.setScale(2 + Math.sin(now / 40) * 0.2);
          if (now > this.stateUntil) {
            this.noDrops = this.noDrops; // keep drops
            this.world.damageEnemy(this, 99999, { noWonk: true, label: " " });
          }
        }
        break;
      }
      case "spawner": {
        this.halt2();
        if (now > this.nextAttack && this.spawnCount < 6 && this.def.spawns) {
          this.nextAttack = now + 2600;
          this.spawnCount++;
          this.attackUntil = now + 500;
          const a = Math.random() * Math.PI * 2;
          this.world.spawnEnemy(this.def.spawns, this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 30, { noDrops: true, minion: true });
        }
        break;
      }
      case "lobber": {
        // keeps its distance and lobs bombs at where you're standing (red circle = move)
        const pref = 300;
        let ang = toP;
        if (dist < pref - 60) ang = toP + Math.PI;
        else if (dist < pref + 80) ang = toP + (Math.PI / 2) * this.orbitDir;
        moveAngle(ang, spd * 0.7);
        if (now > this.nextAttack && dist < 620) {
          this.nextAttack = now + (this.def.projectile?.rate ?? 2200) * (0.85 + Math.random() * 0.3);
          const tx = target.x + (Math.random() - 0.5) * 40;
          const ty = this.walker && this.world.groundY ? Math.min(target.y + 10, this.world.groundY - 8) : target.y + (Math.random() - 0.5) * 30;
          const flight = Math.max(700, tele * 1.4);
          this.world.enemyAoe(tx, ty, 58, (this.def.projectile?.damage ?? this.def.damage) * this.dmgMult, flight, this.def.projectile?.color ?? 0xff3333);
          const sc = this.world.sc;
          const bomb = sc.add.circle(this.x, this.y - 10, 7, this.def.projectile?.color ?? this.def.accent).setStrokeStyle(2, 0x111111).setDepth(1300);
          const sx = this.x;
          const sy = this.y - 10;
          const st = { t: 0 };
          sc.tweens.add({ targets: st, t: 1, duration: flight, onUpdate: () => bomb.setPosition(sx + (tx - sx) * st.t, sy + (ty - sy) * st.t - Math.sin(st.t * Math.PI) * 140), onComplete: () => bomb.destroy() });
          synth.play("lob");
          this.setTint(0xffaaaa);
          this.attackUntil = now + 380;
        }
        break;
      }
      case "pod": {
        // a Contra-style weapon capsule: sails across the screen in a wave, shoot it for a power-up
        body.setVelocity(-this.def.speed, Math.cos(now / 260 + this.uid) * 110);
        this.angle = Math.sin(now / 200) * 12;
        if (this.x < this.world.sc.cameras.main.scrollX - 80) this.kill();
        break;
      }
      case "leaper": {
        // closes in, crouches (flashes), then pounces at you and lands with a thump
        if (this.state === "move") {
          moveAngle(toP, spd);
          if (dist < 300 && now > this.nextAttack) {
            this.state = "windup";
            this.stateUntil = now + tele * 0.75;
            this.halt2();
          }
        } else if (this.state === "windup") {
          this.halt2();
          this.setScale(2.1, 1.7);
          this.setTint(0xff6666);
          if (now > this.stateUntil) {
            this.setScale(2);
            this.state = "dash";
            this.stateUntil = now + 520;
            if (this.walker) {
              body.setVelocity(Phaser.Math.Clamp(dx * 1.6, -560, 560), -640);
            } else {
              this.dashAngle = toP;
              const lx = target.x;
              const ly = target.y;
              this.world.enemyAoe(lx, ly, 52, this.def.damage * this.dmgMult, 480, this.def.color);
              this.world.sc.tweens.add({ targets: this, x: lx, y: ly, duration: 480, ease: "Quad.inOut" });
              this.world.sc.tweens.add({ targets: this, scale: 2.8, yoyo: true, duration: 240 });
            }
          }
        } else if (this.state === "dash") {
          if (now > this.stateUntil && (!this.walker || body.blocked.down || body.touching.down)) {
            this.state = "recover";
            this.stateUntil = now + 450;
            this.world.burst(this.x, this.y + 10, this.def.accent, 8);
          }
        } else {
          this.halt2();
          if (now > this.stateUntil) {
            this.state = "move";
            this.nextAttack = now + 1300 + Math.random() * 900;
          }
        }
        break;
      }
      case "turret": {
        // doesn't move; three-shot bursts, aimed
        this.halt2();
        if (now > this.nextAttack && this.def.projectile && dist < 700) {
          const pr = this.def.projectile;
          if (this.state !== "windup") {
            this.state = "windup";
            this.stateUntil = now + tele * 0.7;
          } else if (now > this.stateUntil) {
            this.state = "move";
            for (let i = 0; i < (this.world.side ? 2 : pr.count ?? 3); i++) {
              this.world.sc.time.delayedCall(i * 130, () => {
                if (this.dead) return;
                const a = Math.atan2(p.y - this.y, p.x - this.x);
                this.world.shoot(this.x, this.y, { owner: "enemy", damage: pr.damage * this.dmgMult, speed: pr.speed, angle: a + (Math.random() - 0.5) * (pr.spread ?? 0.08), color: pr.color, life: 3500 });
              });
            }
            this.nextAttack = now + pr.rate * (0.8 + Math.random() * 0.4);
          }
          if (this.state === "windup") this.setTint(0xffaaaa);
        }
        break;
      }
      case "blinker": {
        if (this.state === "move") {
          moveAngle(toP, spd * 0.6);
          if (now > this.nextAttack) {
            const a = Math.random() * Math.PI * 2;
            const bx = Phaser.Math.Clamp(p.x + Math.cos(a) * 90, this.world.bounds.left + 30, this.world.bounds.right - 30);
            const by = Phaser.Math.Clamp(p.y + Math.sin(a) * 90, this.world.bounds.top + 30, this.world.bounds.bottom - 30);
            this.world.burst(this.x, this.y, this.def.accent, 6);
            synth.play("zap");
            this.setPosition(bx, by);
            this.state = "windup";
            this.stateUntil = now + tele * 0.8;
            this.dashAngle = Math.atan2(p.y - by, p.x - bx);
            this.world.enemyLine(bx, by, this.dashAngle, 150, 24, 0, tele * 0.8);
            this.halt2();
          }
        } else if (this.state === "windup") {
          this.halt2();
          this.setAlpha(0.5 + Math.sin(now / 50) * 0.3);
          if (now > this.stateUntil) {
            this.setAlpha(1);
            this.state = "dash";
            this.stateUntil = now + 260;
          }
        } else if (this.state === "dash") {
          moveAngle(this.dashAngle, 560 * ts);
          if (now > this.stateUntil) {
            this.state = "move";
            this.nextAttack = now + 1800 + Math.random() * 900;
          }
        }
        break;
      }
    }
    if (this.hpBar) this.drawHpBar();
  }

  /** Is it on its own sheets (not a boss, not re-skinned by someone else)? Looks them up the first time. */
  private ownArt(): boolean {
    if (this.sheetArt === undefined) {
      const base = `en_${this.def.id}`;
      const tx = this.scene.textures;
      const walk = tx.exists(`${base}_walk`) ? `${base}_walk` : null;
      const atk = tx.exists(`${base}_atk`) ? `${base}_atk` : null;
      this.sheetArt = !this.isBoss && this.texture.key === base && (walk || atk) ? { base, walk, atk } : null;
    }
    const a = this.sheetArt;
    if (!a) return false;
    const k = this.texture.key;
    return k === a.base || k === a.walk || k === a.atk;
  }

  /** Which drawn animation fits what it's doing right now. */
  private wantArt(now: number): "idle" | "walk" | "atk" {
    const a = this.sheetArt!;
    const b = this.def.behavior;
    const st = this.state;
    if (a.atk) {
      if (now < this.attackUntil || st === "windup" || st === "fuse") return "atk";
      if (st === "dash" && (b === "charger" || b === "leaper" || b === "blinker")) return "atk";
      // still finishing a swing it started
      if (this.artMode === "atk" && this.texture.key === a.atk && this.artFrame < this.texture.frameTotal - 2) return "atk";
      if ((b === "chaser" || b === "swarm") && this.def.damage > 0 && now >= this.stunUntil && !this.world.player.isHidden()) {
        const p = this.world.player;
        if (Math.hypot(p.x - this.x, p.y - this.y) < BITE_RANGE + this.def.size) return "atk";
      }
    }
    const v = (this.body as Phaser.Physics.Arcade.Body | null)?.velocity;
    const moving = !!v && (this.walker ? Math.abs(v.x) : Math.hypot(v.x, v.y)) > 14;
    return moving && a.walk ? "walk" : "idle";
  }

  /** Steps its walk / attack / idle sheet. False when it has none (the caller cycles the old way). */
  private stepArt(now: number): boolean {
    if (!this.ownArt()) return false;
    const a = this.sheetArt!;
    const want = this.wantArt(now);
    const key = want === "walk" ? a.walk! : want === "atk" ? a.atk! : a.base;
    const n = Math.max(1, this.scene.textures.get(key).frameTotal - 1);
    if (want !== this.artMode || this.texture.key !== key) {
      this.artMode = want;
      this.artFrame = want === "walk" ? Math.floor(Math.random() * n) : 0;
      this.animT = 0;
      this.setTexture(key, this.artFrame);
      return true;
    }
    if (want === "walk") {
      const v = (this.body as Phaser.Physics.Arcade.Body).velocity;
      const k = Phaser.Math.Clamp(Math.hypot(v.x, v.y) / Math.max(40, this.def.speed), 0.6, 1.8);
      if (this.animT > 1000 / (WALK_FPS * k)) {
        this.animT = 0;
        this.artFrame = (this.artFrame + 1) % n;
        this.setFrame(this.artFrame);
      }
    } else if (want === "atk") {
      // plays once and holds the strike
      if (this.animT > 1000 / ATK_FPS && this.artFrame < n - 1) {
        this.animT = 0;
        this.artFrame++;
        this.setFrame(this.artFrame);
      }
    } else if (this.animT > (n > 2 ? 110 : 220)) {
      this.animT = 0;
      this.artFrame = (this.artFrame + 1) % n;
      this.setFrame(this.artFrame);
    }
    return true;
  }

  drawHpBar() {
    if (!this.hpBar) return;
    this.hpBar.clear();
    if (this.hp >= this.maxHp || this.isBoss) return;
    const w = Math.max(18, this.def.size * 1.6);
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRect(this.x - w / 2, this.y - this.displayHeight / 2 - 8, w, 4);
    this.hpBar.fillStyle(0xef4444, 1);
    this.hpBar.fillRect(this.x - w / 2, this.y - this.displayHeight / 2 - 8, (w * this.hp) / this.maxHp, 4);
  }

  contactDamage(): number {
    if (this.def.behavior === "spawner" || this.def.behavior === "turret") return this.def.damage * 0.5 * this.dmgMult;
    if (this.state === "dash") return this.def.damage * 1.3 * this.dmgMult;
    return this.def.damage * this.dmgMult;
  }

  kill() {
    this.dead = true;
    this.hpBar?.destroy();
    this.disableBody(true, false);
    this.world.sc.tweens.add({ targets: this, alpha: 0, scale: this.scale * 1.4, angle: 90, duration: 220, onComplete: () => this.destroy() });
  }

  /** Does it have a death animation of its own? (Then the scene calls dieAnimated() instead of the generic pop.) */
  get hasDeathAnim() {
    const id = this.def.id;
    if (CODED_DEATHS.has(id)) return true;
    const key = `fe_die_${id}`;
    return !!DEATHS[id] && this.scene.textures.exists(key) && this.texture.key.replace(/_(walk|atk)$/, "") === `en_${id}`;
  }

  /** Dies with its drawn animation (flop, melt, explode...), then goes. */
  dieAnimated() {
    const sc = this.world.sc;
    this.dead = true;
    this.hpBar?.destroy();
    this.disableBody(false, false); // (body off, but stays active so its animation plays)
    this.clearTint();
    const id = this.def.id;
    if (id === "deepfake_anchor") return this.glitchOut();
    const d = DEATHS[id];
    const key = `fe_die_${id}`;
    // (scale reads are real but writes go through the HD factor: keep the same size on screen)
    const hd0 = (this.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
    const logical = this.scaleX / hd0;
    const ak = `${key}:die`;
    if (!sc.anims.exists(ak)) sc.anims.create({ key: ak, frames: sc.anims.generateFrameNumbers(key, { start: 0, end: d.to }), frameRate: d.fps, repeat: 0 });
    this.setTexture(key, 0);
    this.setScale(logical);
    this.play(ak);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.active) return;
      if (d.end === "hold") {
        sc.tweens.add({ targets: this, alpha: 0, delay: 350, duration: 400, onComplete: () => this.destroy() });
        return;
      }
      if (d.end === "boom") {
        if (!this.world.boomFx?.(this.x, this.y, 0.9)) this.world.burst(this.x, this.y, 0xf97316, 16);
        synth.play("explode");
      } else this.world.burst(this.x, this.y, id === "mini_drongus" ? 0xffd23f : 0x9ca3af, 14);
      this.destroy();
    });
    // never left hanging
    sc.time.delayedCall(2500, () => this.scene && this.destroy());
  }

  /** The deepfake anchor: torn into horizontal slices of static that slide apart, flicker and vanish. */
  private glitchOut() {
    const sc = this.world.sc;
    const n = 6;
    const fw = this.frame.realWidth;
    const fh = this.frame.realHeight;
    const k = this.displayHeight / fh;
    const top = this.y - this.displayHeight * this.originY;
    const left = this.x - this.displayWidth * this.originX;
    const parts: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < n; i++) {
      const sl = sc.add.image(left, top, this.texture.key, this.frame.name).setOrigin(0, 0).setDepth(this.depth).setFlipX(this.flipX);
      const hd = (this.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
      sl.setScale(k / hd);
      sl.setCrop(0, (fh / n) * i, fw, fh / n + 1);
      parts.push(sl);
      const dir = i % 2 ? 1 : -1;
      sc.tweens.add({ targets: sl, x: left + dir * (8 + Math.random() * 18), duration: 90, yoyo: true, repeat: 2 });
      if (i % 2) sl.setTint(i % 3 ? 0x22d3ee : 0xff4fd8);
    }
    this.setVisible(false);
    sc.time.delayedCall(320, () => {
      for (const sl of parts) sc.tweens.add({ targets: sl, alpha: 0, scaleY: 0.1, duration: 160, onComplete: () => sl.destroy() });
      this.destroy();
    });
    synth.play("zap");
  }
}

export function enemyDef(type: string): EnemyDef | undefined {
  return ENEMIES[type];
}

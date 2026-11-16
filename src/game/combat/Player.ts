import { playerKey, sanmikYee } from "../gfx/sanmikForm";
import Phaser from "phaser";
import { cumehameha, goSuper, megaMelee, superTick } from "./Super";
import { charMeta, facingFrom, feetBody, steer } from "../gfx/HD";
import { CHARACTERS, type CharacterDef } from "../../data/characters";
import type { PlayableId } from "../../data/types";
import { G } from "../G";
import { damageMult, maxHp, maxKrezz, maxBottles, bump } from "../systems/stats";
import { activeMods } from "../../data/historicalRevisions";
import { synth } from "../audio/Synth";
import type { CombatWorld } from "./types";
import { autoAimAllowed, type Controls } from "./Controls";
import type { Enemy } from "./Enemy";
import { PLAYER_BARKS } from "../../content/dialogue/ambient";
import { currentGun, cycleGun, ensureArmed, fitTo, nextLoadedGun, GUNS } from "./Guns";
import { kd } from "../systems/kreddle";
import { modLevel, moddedFart, moddedGun } from "../systems/armoury";
import { releaseFart } from "./Farts";
import { hasVfx, vfx } from "../gfx/Vfx";
import { startWonk } from "./Wonk";

export interface Turret {
  spr: Phaser.GameObjects.Sprite;
  until: number;
  next: number;
}

export class Player {
  id: PlayableId;
  def: CharacterDef;
  spr: Phaser.Physics.Arcade.Sprite;
  world: CombatWorld;
  /** Kept in G.rt so it carries over between rooms. */
  get wonk() {
    return G.rt.wonk ?? 0;
  }
  set wonk(v: number) {
    G.rt.wonk = v;
  }
  facing = 0;
  aim = 0;
  // timers
  attackCd = 0;
  specialCd = 0;
  dodgeCd = 0;
  dodgeQueuedUntil = 0;
  dodgeUntil = 0;
  dodgeAngle = 0;
  /** When SWAP went down (0 = up, -1 = used to open the picker). */
  swapDownAt = 0;
  iframesUntil = 0;
  attackAnimUntil = 0;
  loanUntil = 0;
  interestUntil = 0;
  burstUntil = 0;
  lurkUntil = 0;
  nextHitCrit = false;
  /** Fart Overdrive (a freed hostage's beans): faster, harder firing. */
  overdriveUntil = 0;
  bongoUntil = 0;
  machineBuffUntil = 0;
  shieldUntil = 0;
  /** GOLDEN JUICE TRANSFORMATION (Super.ts) */
  superUntil = 0;
  cumeCd = 0;
  chargingUntil = 0;
  swingSide = 1;
  /** The golden combo: which strike is next, when the last one went, and the strike animation playing. */
  meleeStep = 0;
  meleeLastAt = -9999;
  meleeAnim: { key: string; skip: number; start: number; dur: number; dir: number } | null = null;
  /** SPREAD power-up (side-scrolling weapon pods): every shot fans out. */
  spreadUntil = 0;
  readmissionUsed = false;
  combo = 0;
  shots = 0;
  omenCount = 0;
  turrets: Turret[] = [];
  decoy: Phaser.GameObjects.Sprite | null = null;
  decoyUntil = 0;
  recentDamage: { t: number; amt: number }[] = [];
  // decree effects
  noDodgeUntil = 0;
  noHealUntil = 0;
  noSpecialUntil = 0;
  invertUntil = 0;
  // perfect dodge window bookkeeping
  perfectArmed = false;
  dashTrailUntil = 0;
  movingTime = 0;
  stillTime = 0;
  attackHeldTime = 0;
  dead = false;
  /** flinch / cheer animation windows */
  hurtUntil = 0;
  cheerUntil = 0;
  grappledUntil = 0;
  /** where the aim is pointing (world), for lobbed attacks */
  aimAt: { x: number; y: number } | null = null;
  /** side-scrolling: jumps left, coyote time, drop-through-platform window */
  jumps = 2;
  coyoteUntil = 0;
  dropUntil = 0;
  grappleEscape = 0;
  /** Arena gimmick: in the troll fight, the special becomes a headbutt. */
  headbuttMode = false;
  private walkT = 0;
  private lastBark = 0;
  label: Phaser.GameObjects.Text;
  /** The gun drawn in the player's hand (hidden when using fists). */
  gunSpr: Phaser.GameObjects.Image | null = null;
  private gunKick = 0;

  constructor(world: CombatWorld, x: number, y: number) {
    this.world = world;
    this.id = G.s.player;
    this.def = CHARACTERS[this.id];
    const sc = world.sc;
    this.spr = sc.physics.add.sprite(x, y, playerKey(sc), 0).setScale(2).setDepth(500);
    const body = this.spr.body as Phaser.Physics.Arcade.Body;
    if (charMeta(sc, this.spr.texture.key)) feetBody(this.spr, 20, 20, 24);
    else body.setSize(10, 10).setOffset(3, 13);
    body.setCollideWorldBounds(true);
    this.label = sc.add.text(x, y - 34, "", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff", backgroundColor: "#000000aa" }).setOrigin(0.5).setDepth(600).setVisible(false);
    if (G.s.hp <= 0) G.s.hp = maxHp(G.s);
  }

  get x() {
    return this.spr.x;
  }
  get y() {
    return this.spr.y;
  }

  isHidden() {
    return this.world.now() < this.lurkUntil;
  }

  targetPoint() {
    if (this.decoy && this.world.now() < this.decoyUntil) return this.decoy;
    return this.spr;
  }

  invulnerable(now: number) {
    return now < this.iframesUntil || now < this.burstUntil || now < this.shieldUntil;
  }

  dmg(base: number, now: number) {
    let d = base * damageMult(G.s);
    if (now < this.loanUntil) d *= 1.5;
    if (this.burstUntil > 0 && now < this.burstUntil + 4000) d *= 1.35;
    if (now < this.bongoUntil) d *= 1.15;
    if (now < this.machineBuffUntil) d *= 1.25;
    if (now < this.overdriveUntil) d *= 1.4;
    if (G.s.flags.pq_done_pq_krebon && G.s.hp < maxHp(G.s) / 2) d *= 1.2;
    d *= 1 + 0.08 * (G.s.upgrades.pk_dmg ?? 0);
    return d;
  }

  bark(force = false) {
    const now = this.world.now();
    if (!force && now - this.lastBark < 7000) return;
    if (!force && Math.random() > 0.35) return;
    this.lastBark = now;
    const list = PLAYER_BARKS[this.id] ?? [];
    if (!list.length) return;
    this.world.floatText(this.x, this.y - 40, list[Math.floor(Math.random() * list.length)], "#ffd23f", 13);
  }

  update(dt: number, now: number, c: Controls) {
    if (this.dead) return;
    const s = G.s;
    // never stuck on the Fart Blaster while a gun has ammo (unless you chose it this room)
    if (ensureArmed(s)) G.emit("weaponCard", {});
    const mods = activeMods(s);
    const body = this.spr.body as Phaser.Physics.Arcade.Body;
    c.invertX = now < this.invertUntil;
    // aim with intoxication drift
    // the Auto-Aim upgrade locks on, unless it's been switched off in Settings
    const lockOn = !!s.upgrades.pk_autoaim && autoAimAllowed() && c.autoAim !== null;
    const rawAim = lockOn ? c.autoAim! : c.aim(this.x, this.y);
    const drift = (s.intoxication / 100) * 0.4 * Math.sin(now / 370) + (s.intoxication > 60 ? (Math.random() - 0.5) * 0.15 : 0);
    this.aim = rawAim + drift;
    this.aimAt = lockOn ? c.autoAimPoint : c.aimPoint();
    // movement
    const mv = c.move();
    const moving = Math.hypot(mv.x, mv.y) > 0.1;
    if (moving) {
      this.movingTime += dt;
      this.stillTime = 0;
    } else {
      this.stillTime += dt;
      this.movingTime = 0;
    }
    let speed = (this.def.speed ?? 200) * (G.s.flags.arc_crongus_done ? 1.15 : 1) * (1 + 0.07 * (G.s.upgrades.pk_spd ?? 0));
    if (now < this.bongoUntil) speed *= 0.95;
    const wobble = s.intoxication > 40 ? Math.sin(now / 300) * (s.intoxication / 100) * 0.5 : 0;
    if (now < this.grappledUntil) {
      body.setVelocity(0, 0);
      this.spr.setAngle(Math.sin(now / 60) * 10);
      if (c.dodge() || (c.attackHeld() && now > this.attackCd)) {
        this.attackCd = now + 90;
        this.grappleEscape++;
        this.world.floatText(this.x, this.y - 40, `ESCAPE ${this.grappleEscape}/7`, "#ffffff", 12);
        if (this.grappleEscape >= 7) {
          this.grappledUntil = 0;
          this.iframesUntil = now + 800;
          this.spr.setAngle(0);
          this.world.floatText(this.x, this.y - 50, "ESCAPED (shrimped out)", "#7fdbff", 14);
        }
      }
      return;
    }
    this.spr.setAngle(0);
    const side = !!this.world.side;
    if (side) body.setAllowGravity(now >= this.dodgeUntil);
    if (now < this.dodgeUntil) {
      const ds = 520 * (this.id === "FLENKY" && s.upgrades.fl1 ? 1.4 : 1);
      body.setVelocity(Math.cos(this.dodgeAngle) * ds, side ? 0 : Math.sin(this.dodgeAngle) * ds);
      if (now > this.dashTrailUntil) {
        this.dashTrailUntil = now + 40;
        const ghost = this.world.sc.add.sprite(this.x, this.y, this.spr.texture.key, this.spr.frame.name).setScale(2).setAlpha(0.45).setTint(this.def.color).setDepth(499).setFlipX(this.spr.flipX);
        this.world.sc.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      }
    } else if (side) {
      // platformer: run left/right, jump (and one more in the air), down drops through platforms
      const grounded = body.blocked.down || body.touching.down;
      if (grounded) {
        this.jumps = 2;
        this.coyoteUntil = now + 110;
      }
      body.velocity.x += (mv.x * speed - body.velocity.x) * Math.min(1, dt / (grounded ? 70 : 140));
      if (c.jump() && (this.jumps > 0 || now < this.coyoteUntil)) {
        const first = grounded || now < this.coyoteUntil;
        body.setVelocityY(first ? -660 : -580);
        this.jumps = first ? 1 : 0;
        this.coyoteUntil = 0;
        synth.play(first ? "dodge" : "select");
        // SanMik says YEE when he jumps (once a jump: the cooldown keeps a double-jump to one)
        sanmikYee(this.world.sc, this.spr.x, this.spr.getTopCenter().y - 14, { cooldown: 650, size: 15, depth: 2000, follow: this.spr });
        if (!first) this.world.burst(this.x, this.y + 14, 0xffffff, 6);
      }
      if (mv.y > 0.6) this.dropUntil = now + 220;
    } else {
      const tx = (mv.x + wobble * mv.y) * speed;
      const ty = (mv.y - wobble * mv.x) * speed;
      if (mods.slippery) {
        body.velocity.x += (tx - body.velocity.x) * Math.min(1, dt / 260);
        body.velocity.y += (ty - body.velocity.y) * Math.min(1, dt / 260);
      } else {
        steer(body, tx, ty, dt);
      }
    }
    // a dodge pressed just before the cooldown ends still happens
    if (this.dodgeQueuedUntil && now >= this.dodgeCd && now < this.dodgeQueuedUntil && now >= this.dodgeUntil) {
      this.dodgeQueuedUntil = 0;
      this.tryDodge(now, mv);
    }
    // animation
    const meta = charMeta(this.world.sc, this.spr.texture.key);
    if (meta) {
      // PixelLab sheet: face the aim direction, 4-way walk cycle, directional jab
      const fighting = now < this.attackAnimUntil + 450 || c.attackHeld();
      let f = moving && !fighting ? facingFrom(mv.x, mv.y, (this.spr.getData("facing") as any) ?? "south") : facingFrom(Math.cos(this.aim), Math.sin(this.aim));
      if (side) f = (moving && !fighting && Math.abs(mv.x) > 0.1 ? mv.x : Math.cos(this.aim)) < 0 ? "west" : "east";
      this.spr.setData("facing", f);
      const sideF = f === "east" || f === "west";
      const pick = (m?: Record<string, number[]>) => (m ? (sideF ? m.east : m.south) ?? m.east ?? m.south : undefined);
      const hurt = pick(meta.hurt);
      const cheer = pick(meta.victory);
      if (now < this.hurtUntil && hurt?.length && !(now < this.attackAnimUntil)) {
        const t = 1 - (this.hurtUntil - now) / 320;
        this.spr.setFlipX(f === "west").setFrame(hurt[Math.max(0, Math.min(hurt.length - 1, Math.floor(t * hurt.length)))]);
      } else if (now < this.cheerUntil && cheer?.length && !moving && !fighting) {
        this.spr.setFlipX(f === "west").setFrame(cheer[Math.floor(now / 110) % cheer.length]);
      } else if (this.meleeAnim && now < this.meleeAnim.start + this.meleeAnim.dur && (meta as any)[this.meleeAnim.key]?.east) {
        // golden combo strikes are drawn side-on (they read far better than a punch at the camera)
        const ma = this.meleeAnim;
        const cyc: number[] = (meta as any)[ma.key].east.slice(ma.skip);
        const t = (now - ma.start) / ma.dur;
        this.spr.setFlipX(ma.dir < 0).setFrame(cyc[Math.max(0, Math.min(cyc.length - 1, Math.floor(t * cyc.length)))]);
      } else if (now < this.attackAnimUntil) {
        const side = f === "east" || f === "west";
        const cyc = (side ? meta.attack?.east : meta.attack?.south) ?? meta.attack?.east ?? [3];
        const t = 1 - (this.attackAnimUntil - now) / 200;
        this.spr.setFlipX(f === "west").setFrame(cyc[Math.max(0, Math.min(cyc.length - 1, Math.floor(t * cyc.length)))]);
      } else if (moving && (!side || Math.abs(mv.x) > 0.1)) {
        const cyc = meta.walk[f] ?? meta.walk.south;
        this.spr.setFlipX(false).setFrame(cyc[Math.floor(now / 90) % cyc.length]);
      } else this.spr.setFlipX(false).setFrame(meta.idle[f] ?? 0);
    } else this.spr.setFlipX(moving && !(now < this.attackAnimUntil + 450 || c.attackHeld()) ? mv.x < -0.1 || (Math.abs(mv.x) <= 0.1 && this.spr.flipX) : Math.cos(this.aim) < 0);
    if (meta) {
      // handled above
    } else if (now < this.attackAnimUntil) this.spr.setFrame(3);
    else if (moving) {
      this.walkT += dt;
      if (this.walkT > 120) {
        this.walkT = 0;
        this.spr.setFrame(String(this.spr.frame.name) === "1" ? 2 : 1);
      }
    } else this.spr.setFrame(0);
    // visibility (lurk)
    this.spr.setAlpha(this.isHidden() ? 0.25 : now < this.iframesUntil && Math.floor(now / 60) % 2 ? 0.6 : 1);
    if (now < this.burstUntil) this.spr.setTint(0xffd23f);
    else if (now < this.loanUntil) this.spr.setTint(0x86efac);
    else if (now < this.shieldUntil) this.spr.setTint(0xc4b5fd);
    else if (now < this.overdriveUntil) this.spr.setTint(0xb5e655);
    else this.spr.clearTint();
    superTick(this, now);
    // Krezz trickle
    s.krezz = Math.min(maxKrezz(s), s.krezz + dt * 0.0022 * (1 + 0.3 * (s.upgrades.pk_krezz ?? 0)));
    if (s.flags.debug_mode) s.krezz = maxKrezz(s); // debug: infinite Krezz
    // Krez Loan interest
    if (this.interestUntil > now && this.loanUntil < now) {
      const rate = (maxHp(s) * (s.upgrades.kz3 ? 0.075 : 0.15)) / 4000;
      s.hp = Math.max(1, s.hp - rate * dt);
    }
    // inputs
    if (c.dodge()) this.tryDodge(now, mv);
    // SWAP: tap = next weapon (with a card saying what it is), hold = freeze and pick
    const swapEdge = c.swap();
    const swapDown = c.swapHeld();
    // (a very quick tap can come and go inside one frame: the edge still counts it)
    const sw = this.world.sc as unknown as { swapSlow?: (on: boolean) => void };
    // timed on the real clock: the game clock itself slows down the moment you press it
    const realNow = performance.now();
    if ((swapDown || swapEdge) && this.swapDownAt === 0) {
      this.swapDownAt = realNow;
      // the action slows the moment you reach for another weapon
      sw.swapSlow?.(true);
    }
    if (swapDown && this.swapDownAt > 0 && realNow - this.swapDownAt > 260 && this.world.sc.scene.key === "Dungeon") {
      this.swapDownAt = -1; // consumed: wait for the key to come up
      (this.world.sc as unknown as { openWeaponPicker: () => void }).openWeaponPicker();
      return;
    }
    if (!swapDown && this.swapDownAt !== 0) {
      if (this.swapDownAt > 0) {
        const nm = cycleGun();
        synth.play("pickup");
        this.world.floatText(this.x, this.y - 44, nm.toUpperCase(), "#67e8f9", 13);
        G.emit("weaponCard", {});
        sw.swapSlow?.(false);
      }
      this.swapDownAt = 0;
    }
    if (c.attackHeld()) {
      this.attackHeldTime += dt;
      this.tryAttack(now, moving);
    } else this.attackHeldTime = 0;
    if (c.special()) this.trySpecial(now, c);
    if (c.bottle()) this.drinkBottle(now);
    if (c.bongo()) this.drinkBongo(now);
    if (c.burst()) this.tryBurst(now);
    if (c.transform()) goSuper(this, now);
    if (c.cume() && now < this.superUntil) cumehameha(this, now);
    if (c.fart()) releaseFart(this, now);
    // turrets
    this.updateTurrets(now);
    // Gronny gut-stank aura
    if (this.id === "GRONNY") {
      const r = s.upgrades.gr2 ? 105 : 70;
      for (const e of this.world.enemies) {
        if (e.dead) continue;
        if (Phaser.Math.Distance.Between(e.x, e.y, this.x, this.y) < r + e.radius) this.world.damageEnemy(e, (6 * dt) / 1000, { noWonk: true, label: "" });
      }
    }
    // decoy cleanup
    if (this.decoy && now > this.decoyUntil) {
      this.decoy.destroy();
      this.decoy = null;
    }
    this.recentDamage = this.recentDamage.filter((r) => now - r.t < 10000);
    this.label.setPosition(this.x, this.y - 36);
    this.updateGunSprite(dt);
  }

  private updateGunSprite(dt: number) {
    const g = currentGun();
    if (!g || !this.world.sc.textures.exists(g.tex)) {
      this.gunSpr?.setVisible(false);
      return;
    }
    if (!this.gunSpr) this.gunSpr = this.world.sc.add.image(this.x, this.y, g.tex).setDepth(501);
    if (this.gunSpr.texture.key !== g.tex) this.gunSpr.setTexture(g.tex);
    fitTo(this.gunSpr, g.id === "rocket" || g.id === "rail" || g.id === "kreddler" || g.id === "disco" || g.id === "loan" ? 40 : g.id === "shotgun" || g.id === "chainsaw" || g.id === "roulette" || g.id === "chips" || g.id === "dice" ? 36 : g.id === "slots" ? 32 : 26);
    // Kreddle: gold-plated guns
    if (kd(G.s, "kd_gold")) this.gunSpr.setTint(0xffe27a);
    else this.gunSpr.clearTint();
    this.gunKick = Math.max(0, this.gunKick - dt * 0.05);
    const left = Math.cos(this.aim) < 0;
    const r = 14 - this.gunKick;
    this.gunSpr
      .setVisible(this.spr.visible && !this.isHidden())
      .setPosition(this.x + Math.cos(this.aim) * r, this.y + 4 + Math.sin(this.aim) * r)
      .setRotation(this.aim)
      .setFlipY(left)
      .setDepth(Math.sin(this.aim) < -0.3 ? 499 : 501);
  }


  /** Out of ammo: move on to the next gun that still has some, or back to your own attack. */
  private switchFromEmpty(id: string) {
    const s = G.s;
    if (s.gun !== id || (s.guns?.[id] ?? 0) > 0) return;
    const next = nextLoadedGun(s, id);
    s.gun = next ?? undefined;
    this.world.floatText(this.x, this.y - 44, next ? `OUT OF AMMO — ${GUNS[next].name.toUpperCase()}` : "OUT OF AMMO — FART BLASTER", next ? "#ffd23f" : "#ff6666", 13);
    synth.play(next ? "select" : "tap_fail");
  }

  /** Fire the gun in hand. Returns false when there's no gun or no ammo (falls back to the normal attack). */
  private fireGun(now: number): boolean {
    const base = currentGun();
    const s = G.s;
    if (!base || !s.guns) return false;
    if ((s.guns[base.id] ?? 0) <= 0) {
      this.switchFromEmpty(base.id);
      this.attackCd = now + 300;
      return true;
    }
    // the gun as modded at the Kreddle Exchange (damage, rate, spread, range, pierce, blast, pellets, homing)
    const g = moddedGun(base, s);
    const luck = modLevel(s, g.id, "luck");
    s.guns[g.id]--;
    if (s.guns[g.id] <= 0) this.world.sc.time.delayedCall(Math.min(400, g.cd), () => this.switchFromEmpty(g.id));
    this.attackCd = now + g.cd * (now < this.burstUntil ? 0.75 : 1) * (now < this.overdriveUntil ? 0.7 : 1) * (1 - 0.1 * (s.upgrades.pk_rof ?? 0));
    this.attackAnimUntil = now + 90;
    this.gunKick = g.id === "rail" ? 16 : g.id === "rocket" || g.id === "shotgun" ? 10 : 5;
    const mx = this.x + Math.cos(this.aim) * 26;
    const my = this.y + 4 + Math.sin(this.aim) * 26;
    // (the drawn muzzle flash is added further down; this circle is only for when the art isn't loaded)
    if (!hasVfx(this.world.sc, "vfx_muzzle")) {
      const flash = this.world.sc.add.circle(mx, my, 5, g.color === 0xffffff ? 0xffd23f : g.color, 0.9).setDepth(602);
      this.world.sc.tweens.add({ targets: flash, alpha: 0, scale: 2.2, duration: 90, onComplete: () => flash.destroy() });
    }
    // Kreddle prizes: gold, tracers, jackpots
    const gold = kd(s, "kd_gold") > 0;
    const tracer = kd(s, "kd_tracer") > 0;
    const jackpot = kd(s, "kd_jackpot") > 0;
    const disco = g.id === "disco";
    // the Kreddle Exchange guns: every shot is a little gamble of its own
    let dmgMul = 1;
    let pellets = g.pellets;
    let spreadW = g.spread;
    let pierce = g.pierce ?? 0;
    let blastR = g.blast ?? 0;
    let colorOf: ((i: number) => number) | null = null;
    let call = "";
    let callCol = "#ffd23f";
    if (g.mech === "slots") {
      // the reels: mostly a plain shot, sometimes cherries (a double), now and then lemons (a dud), rarely 777
      const r = Math.random();
      const jack = 0.08 + 0.05 * luck;
      if (r < jack) {
        pellets = 7;
        spreadW = 0.9;
        pierce += 3;
        dmgMul = 3;
        call = "7 7 7  JACKPOT!";
        colorOf = () => 0xffd23f;
        synth.play("jackpot");
        this.world.shake(90, 0.004);
      } else if (r < jack + 0.22) {
        pellets = 2;
        spreadW = 0.16;
        dmgMul = 1.4;
        colorOf = () => 0xff4fd8;
      } else if (r < jack + 0.37) {
        dmgMul = 0.5;
        colorOf = () => 0xfef08a;
      }
    } else if (g.mech === "roulette") {
      if (Math.random() < 1 / 13 + 0.04 * luck) {
        // the green zero: double the pellets, through everyone, double damage
        pellets *= 2;
        pierce += 3;
        dmgMul = 2;
        call = "0 · GREEN · HOUSE PAYS!";
        callCol = "#4ade80";
        colorOf = () => 0x22c55e;
        synth.play("jackpot");
      } else {
        const red = Math.random() < 0.5;
        colorOf = (i) => ((i % 2 === 0) === red ? 0xef4444 : 0x3f3f46);
      }
    } else if (g.mech === "chips") {
      const CHIP = [0xef4444, 0x38bdf8, 0x22c55e, 0xfacc15, 0xf5f5f5];
      colorOf = (i) => CHIP[(this.shots + i) % CHIP.length];
      this.shots++;
    } else if (g.mech === "dice") {
      // two dice, loaded a little more with every Rigged Odds level
      const die = () => Math.min(6, 1 + Math.floor(Math.random() * 6) + luck);
      const a = die();
      const b = die();
      const sum = a + b;
      blastR *= 0.4 + sum * 0.08;
      dmgMul = 0.5 + sum / 12;
      if (a === 1 && b === 1) {
        blastR = (g.blast ?? 60) * 1.6;
        dmgMul = 4;
        call = "SNAKE EYES!";
        callCol = "#4ade80";
      } else if (a === 6 && b === 6) {
        dmgMul *= 1.5;
        call = "BOXCARS!";
      } else call = `🎲 ${a} + ${b}`;
      callCol = sum >= 10 || sum === 2 ? callCol : "#e5e7eb";
    }
    if (call) this.world.floatText(this.x, this.y - 48, call, callCol, call.length > 12 ? 15 : 12);
    const blast = (x: number, y: number) => {
      synth.play("explode");
      this.world.shake(140, 0.006);
      const drawn = !disco && !!this.world.boomFx?.(x, y, 0.8 * Math.max(0.6, blastR / (base.blast ?? blastR)));
      if (drawn) {
        /* drawn explosion */
      } else if (disco) for (const c of [0xff4fd8, 0x22d3ee, 0xfacc15, 0x4ade80, 0xa855f7]) this.world.burst(x, y, c, 6);
      else this.world.burst(x, y, g.mech === "dice" ? 0xffffff : 0xff6ec7, 14);
      this.world.aoe(x, y, blastR, this.dmg(g.dmg, now) * dmgMul, { color: drawn ? undefined : disco ? [0xff4fd8, 0x22d3ee, 0xfacc15][Math.floor(Math.random() * 3)] : 0xff6ec7, knock: g.knock ?? 200 });
    };
    const payout = (x: number, y: number) => {
      if (!jackpot || Math.random() > 0.125) return;
      synth.play("coin");
      this.world.burst(x, y, 0xffd23f, 10);
      this.world.aoe(x, y, 55, this.dmg(10, now), { color: 0xffd23f, label: "" });
      s.coins += 3;
      this.world.floatText(x, y - 20, "JACKPOT! +3", "#ffd23f", 14);
    };
    // the Loan Shark collects interest off whoever it skewers
    const interest = (x: number, y: number) => {
      if (Math.random() > 0.25 + 0.1 * luck) return;
      s.coins += 1;
      synth.play("coin");
      this.world.floatText(x, y - 18, "+1 INTEREST", "#facc15", 11);
    };
    // the railgun: every body it goes through spits sparks and a little white pop
    const railHit = (x: number, y: number) => {
      this.world.burst(x, y, 0x67e8f9, 10);
      this.world.burst(x, y, 0xffffff, 4);
      const ring = this.world.sc.add.circle(x, y, 6, 0xffffff, 0).setStrokeStyle(3, 0x67e8f9, 1).setDepth(604).setBlendMode(Phaser.BlendModes.ADD);
      this.world.sc.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 220, ease: "Quad.out", onComplete: () => ring.destroy() });
      synth.play("zap", 0.5);
    };
    const onHit = g.mech === "loan" ? (x: number, y: number) => (interest(x, y), payout(x, y)) : g.id === "rail" ? (x: number, y: number) => (railHit(x, y), payout(x, y)) : jackpot ? payout : undefined;
    if (g.id === "chainsaw") {
      // sparks and chunks right at the bar
      for (let k = 0; k < 3; k++) {
        const sp = this.world.sc.add.circle(mx + Math.cos(this.aim) * 30, my + Math.sin(this.aim) * 30, 2, Math.random() < 0.5 ? 0xffd23f : 0xff7a1a, 1).setDepth(603);
        this.world.sc.tweens.add({ targets: sp, x: sp.x + (Math.random() - 0.5) * 50, y: sp.y + (Math.random() - 0.5) * 50, alpha: 0, duration: 200, onComplete: () => sp.destroy() });
      }
    }
    const fan = now < this.spreadUntil && pellets === 1 ? [-0.25, 0, 0.25] : [0];
    for (const fo of fan)
    for (let i = 0; i < pellets; i++) {
      const spread = fo + (pellets > 1 ? (i / (pellets - 1) - 0.5) * spreadW + (Math.random() - 0.5) * 0.08 : (Math.random() - 0.5) * spreadW);
      const crit = Math.random() < 0.06;
      const d = this.dmg(g.dmg, now) * dmgMul * (crit ? 2 : 1) * (gold ? 1.1 : 1);
      this.world.shoot(mx, my, {
        owner: "player",
        damage: blastR ? 0 : d,
        crit,
        speed: g.speed * (pellets > 1 ? 0.9 + Math.random() * 0.2 : 1),
        angle: this.aim + spread,
        color: gold ? 0xffd23f : colorOf ? colorOf(i) : disco ? [0xff4fd8, 0x22d3ee, 0xfacc15][i % 3] : g.color,
        texture: g.shotTex && this.world.sc.textures.exists(g.shotTex) ? g.shotTex : undefined,
        life: (g.range / g.speed) * 1000,
        pierce,
        homing: g.homing,
        ricochet: g.ricochet,
        slow: g.slow,
        knock: g.knock,
        scale: g.id === "rail" ? 1.6 : g.id === "chainsaw" ? 0.5 : disco ? 1.8 : g.id === "loan" ? 1.5 : g.id === "dice" ? 1.7 : g.id === "chips" ? 1.3 : g.shotTex ? 0.65 : 1,
        trail: tracer ? (this.shots % 2 ? 0xff4fd8 : 0x22d3ee) : g.id === "loan" ? 0x94a3b8 : undefined,
        onHit: blastR ? blast : onHit,
        onEnd: blastR ? blast : undefined,
      });
    }
    if (g.id === "rail") this.railFx(mx, my, g.range, g.color);
    synth.play(g.sfx ?? (g.id === "rocket" ? "rocket" : `gun_${g.id}`));
    // a drawn muzzle flash at the barrel (not for the chainsaw or the flamer, which are their own flash)
    if (g.id !== "chainsaw" && g.id !== "flamer") vfx(this.world.sc, "vfx_muzzle", mx, my, { angle: Phaser.Math.RadToDeg(this.aim), scale: g.id === "bfk" || g.id === "shotgun" || g.id === "rocket" ? 1.3 : 0.8, depth: 599, add: true });
    if (g.id === "shotgun" || g.id === "rocket") this.world.shake(70, 0.003);
    if (s.guns[g.id] === 0) this.world.floatText(this.x, this.y - 44, "LAST ONE", "#ffd23f", 12);
    return true;
  }

  /** The railgun's shot: a white-hot core in a cyan glow, rings spiralling down the line, recoil, a camera kick and a hair of hitstop. */
  private railFx(mx: number, my: number, range: number, color: number) {
    const sc = this.world.sc;
    const a = this.aim;
    const calm = !!G.meta?.settings?.calmFlash;
    const add = Phaser.BlendModes.ADD;
    const glow = sc.add.rectangle(mx, my, range, 16, color, 0.45).setOrigin(0, 0.5).setRotation(a).setDepth(597).setBlendMode(add);
    const core = sc.add.rectangle(mx, my, range, 4, 0xffffff, 1).setOrigin(0, 0.5).setRotation(a).setDepth(599).setBlendMode(add);
    sc.tweens.add({ targets: core, scaleY: 0.2, alpha: 0, duration: 160, ease: "Quad.in", onComplete: () => core.destroy() });
    sc.tweens.add({ targets: glow, scaleY: 2.6, alpha: 0, duration: 320, ease: "Quad.out", onComplete: () => glow.destroy() });
    // rings spiralling down the beam, out from the barrel
    const n = Math.floor(range / 34);
    for (let i = 0; i < n; i++) {
      const d = 18 + i * 34;
      const ox = Math.cos(a + Math.PI / 2) * Math.sin(i * 0.9) * 7;
      const oy = Math.sin(a + Math.PI / 2) * Math.sin(i * 0.9) * 7;
      const ring = sc.add.ellipse(mx + Math.cos(a) * d + ox, my + Math.sin(a) * d + oy, 10, 26, 0xffffff, 0).setStrokeStyle(2, color, 0.95).setRotation(a).setDepth(600).setBlendMode(add).setAlpha(0);
      sc.tweens.add({ targets: ring, alpha: { from: 1, to: 0 }, scaleX: 1.8, scaleY: 1.5, delay: i * 9, duration: 260, onComplete: () => ring.destroy() });
    }
    // a hot white flash at the muzzle
    const pop = sc.add.circle(mx, my, 14, 0xffffff, 0.95).setDepth(602).setBlendMode(add);
    sc.tweens.add({ targets: pop, scale: 2.4, alpha: 0, duration: 140, onComplete: () => pop.destroy() });
    // the shove: you get pushed back the way you came
    const body = this.spr.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      // side-scrolling: a velocity kick (it eases off on its own); top-down sets your speed every frame, so a direct shove
      if (this.world.side) body.velocity.x -= Math.cos(a) * 320;
      else body.reset(this.spr.x - Math.cos(a) * 12, this.spr.y - Math.sin(a) * 12);
    }
    this.world.hitStop(40);
    this.world.shake(140, calm ? 0.004 : 0.009);
    // a faint cyan wash over the screen (a full camera flash is far too much for a gun you fire every second)
    if (!calm) {
      const cam = sc.cameras.main;
      const wash = sc.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, color, 0.14).setScrollFactor(0).setDepth(5000).setBlendMode(add);
      sc.tweens.add({ targets: wash, alpha: 0, duration: 120, onComplete: () => wash.destroy() });
    }
    synth.play("zap", 0.7);
  }

  private tryDodge(now: number, mv: { x: number; y: number }) {
    if (now < this.dodgeCd) {
      // buffer it: pressing a moment early still counts
      if (this.dodgeCd - now < 180) this.dodgeQueuedUntil = this.dodgeCd + 120;
      return;
    }
    if (now < this.noDodgeUntil) {
      this.world.floatText(this.x, this.y - 30, "DODGING IS ILLEGAL", "#ff6666", 12);
      return;
    }
    const mods = activeMods(G.s);
    this.dodgeAngle = Math.hypot(mv.x, mv.y) > 0.1 ? Math.atan2(mv.y, mv.x) : this.aim;
    if (this.world.side) this.dodgeAngle = (Math.abs(mv.x) > 0.1 ? mv.x : Math.cos(this.aim)) < 0 ? Math.PI : 0;
    const dur = this.id === "FLENKY" && G.s.upgrades.fl1 ? 230 : 170;
    this.dodgeUntil = now + dur;
    this.iframesUntil = now + dur + 90;
    this.dodgeCd = now + 650 * mods.dodgeCooldownMult * (1 - 0.15 * (G.s.upgrades.pk_dodge ?? 0));
    this.perfectArmed = true;
    // Central Bank moves
    if (G.s.upgrades.mv_charge) {
      for (let i = 1; i <= 3; i++) this.world.sc.time.delayedCall((dur / 3) * i, () => this.world.aoe(this.x, this.y, 46, this.dmg(14, this.world.now()), { knock: 340, angle: this.dodgeAngle, noWonk: true, label: "SHOULDER" }));
    }
    // Kreddle: LOADED DICE
    if (kd(G.s, "kd_dice")) {
      const dx = this.x;
      const dy = this.y;
      const die = this.world.sc.add.text(dx, dy, "🎲🎲", { fontSize: "20px" }).setOrigin(0.5).setDepth(600);
      this.world.sc.tweens.add({ targets: die, angle: 360, duration: 500 });
      this.world.sc.time.delayedCall(550, () => {
        die.destroy();
        synth.play("explode");
        if (!this.world.boomFx?.(dx, dy, 0.7)) this.world.burst(dx, dy, 0xffffff, 12);
        this.world.aoe(dx, dy, 70, this.dmg(22, this.world.now()), { knock: 260, label: "SNAKE EYES" });
      });
    }
    if (G.s.upgrades.mv_fart) {
      const fx = this.x;
      const fy = this.y;
      const cloud = this.world.sc.add.circle(fx, fy, 30, 0x9acd32, 0.35).setDepth(5);
      let n = 0;
      const ev2 = this.world.sc.time.addEvent({ delay: 300, loop: true, callback: () => {
        this.world.aoe(fx, fy, 38, 6, { noWonk: true, slow: 0.5, label: "" });
        if (++n > 10) { ev2.remove(); cloud.destroy(); }
      } });
    }
    synth.play("dodge");
    vfx(this.world.sc, "vfx_dust", this.x, this.y + 14, { scale: 0.7, depth: this.spr.depth - 1, flipX: Math.cos(this.aim) > 0 });
    this.world.sc.events.emit("player-dodge");
    if (this.id === "CRONGUS" && G.s.upgrades.cr3) {
      // caltrops
      const zone = this.world.sc.add.circle(this.x, this.y, 22, 0x17c6c0, 0.35).setDepth(5);
      let ticks = 0;
      const ev = this.world.sc.time.addEvent({
        delay: 250,
        loop: true,
        callback: () => {
          this.world.aoe(zone.x, zone.y, 26, 5, { noWonk: true, slow: 0.4, label: "" });
          if (++ticks > 16) {
            ev.remove();
            zone.destroy();
          }
        },
      });
    }
  }

  /** Called by the scene when something would have hit us during i-frames. */
  perfectDodge() {
    if (!this.perfectArmed) return;
    this.perfectArmed = false;
    synth.play("perfect");
    this.world.addWonk(10);
    bump(G.s, "perfect_dodge");
    this.world.floatText(this.x, this.y - 30, "PERFECT", "#7fdbff", 14);
    this.world.hitStop(60);
  }

  private tryAttack(now: number, moving: boolean) {
    if (now < this.attackCd || now < this.dodgeUntil) return;
    if (now < this.superUntil) {
      megaMelee(this, now);
      return;
    }
    if (!this.headbuttMode && this.fireGun(now)) return;
    this.fireFartBlaster(now, moving);
  }

  /**
   * The Fart Blaster: everyone's infinite starter. Fires stink puffs. Each character's old attack perks ride on it
   * (ricochet, pierce, homing, slow, split shot, the 4th-shot crit, the backstab, the lifesteal).
   */
  private fireFartBlaster(now: number, moving: boolean) {
    const s = G.s;
    // (with its Kreddle Exchange mods: damage, rate, range, pierce)
    const fb = moddedFart(s);
    let rate = fb.cd;
    if (this.id === "MIKEY" && moving) rate *= 0.7;
    if (now < this.burstUntil) rate *= 0.75;
    rate *= 1 - 0.1 * (s.upgrades.pk_rof ?? 0);
    if (now < this.overdriveUntil) rate *= 0.6;
    this.attackCd = now + rate;
    this.attackAnimUntil = now + 90;
    this.gunKick = 4;
    this.shots++;
    this.combo++;
    let d = this.dmg(fb.dmg, now);
    let crit = Math.random() < 0.08;
    if (this.id === "KREZWONK") {
      this.omenCount++;
      if (s.upgrades.kw3 && this.omenCount % 6 === 0) crit = true;
    }
    if (this.id === "FLENKY" && s.upgrades.fl3 && this.combo % 4 === 0) {
      d *= 3;
      crit = true;
    }
    if (this.nextHitCrit) {
      // Lulon Lurk / RuneScape: the next shot is a monster
      this.nextHitCrit = false;
      d *= 4;
      crit = true;
      if (this.id === "CRONGUS" && s.upgrades.cr1) this.world.sc.time.delayedCall(120, () => this.world.aoe(this.x, this.y, 90, 1, { stun: 1200, noWonk: true, label: "" }));
    } else if (crit) d *= 2;
    const mx = this.x + Math.cos(this.aim) * 22;
    const my = this.y + 2 + Math.sin(this.aim) * 22;
    const homing = this.id === "KREZWONK" ? 2.2 : this.id === "MIKEY" && s.upgrades.mk3 && this.shots % 20 === 0 ? 4 : 0;
    const angles = now < this.spreadUntil ? [-0.32, -0.16, 0, 0.16, 0.32] : now < this.overdriveUntil ? [-0.22, -0.08, 0.08, 0.22] : this.id === "KREZMAR" && s.upgrades.kz3 ? [-0.18, 0, 0.18] : [0];
    const tex = this.world.sc.textures.exists("fx_gas") ? "fx_gas" : "fx_bullet";
    for (const off of angles) {
      const backstab = this.id === "CRONGUS" || this.id === "KREBON";
      this.world.shoot(mx, my, {
        owner: "player",
        damage: d,
        crit,
        speed: fb.speed,
        angle: this.aim + off + (Math.random() - 0.5) * 0.06,
        color: crit ? 0xfff176 : 0xb5e655,
        texture: tex,
        life: ((homing ? fb.range * 1.5 : fb.range) / fb.speed) * 1000,
        pierce: (this.id === "KREZWONK" && s.upgrades.kw1 ? 1 : 0) + fb.pierce,
        homing,
        ricochet: this.id === "KREBLIS" && s.upgrades.kb1 ? 1 : 0,
        slow: (this.id === "MIKEY" && s.upgrades.mk1) || (this.id === "KREZMAR" && s.upgrades.kz1) ? 0.25 : 0,
        knock: this.id === "KREBON" ? 160 : 60,
        scale: tex === "fx_gas" ? 0.2 : 1,
        onHit: backstab && (s.upgrades.kn2 || this.isHidden()) ? () => {
          if (this.id === "KREBON" && s.upgrades.kn2) s.hp = Math.min(maxHp(s), s.hp + 1);
        } : undefined,
      });
    }
    // a little drawn puff of gas at the "muzzle"
    if (!vfx(this.world.sc, "vfx_fart", mx, my, { scale: 0.32, depth: 602, flipX: Math.cos(this.aim) < 0 })) {
      const flash = this.world.sc.add.circle(mx, my, 6, 0xb5e655, 0.85).setDepth(602);
      this.world.sc.tweens.add({ targets: flash, alpha: 0, scale: 2.2, duration: 90, onComplete: () => flash.destroy() });
    }
    synth.play("pfft");
  }

  private spendKrezz(cost: number): boolean {
    const s = G.s;
    if (s.krezz < cost) {
      this.world.floatText(this.x, this.y - 30, "NOT ENOUGH KREZZ", "#c084fc", 12);
      return false;
    }
    s.krezz -= cost;
    return true;
  }

  private trySpecial(now: number, c: Controls) {
    const sig = this.def.signature!;
    if (this.headbuttMode) {
      if (now < this.specialCd) return;
      this.specialCd = now + 700;
      this.attackAnimUntil = now + 220;
      // lunge head-first at whoever's nearest in front of you
      let a = this.aim;
      let best = 240;
      for (const e of this.world.enemies) {
        if (e.dead) continue;
        const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
        if (d < best && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - this.y, e.x - this.x) - this.aim)) < 1.2) {
          best = d;
          a = Math.atan2(e.y - this.y, e.x - this.x);
        }
      }
      const body = this.spr.body as Phaser.Physics.Arcade.Body;
      if (!this.world.side) body.setVelocity(Math.cos(a) * 520, Math.sin(a) * 520);
      else body.setVelocityX(Math.cos(a) * 520);
      synth.play("swing");
      this.world.sc.time.delayedCall(90, () => {
        let hit = false;
        for (const e of [...this.world.enemies]) {
          if (e.dead) continue;
          if (Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) < e.radius + 52) {
            hit = true;
            this.world.damageEnemy(e, 40, { source: "headbutt", crit: true, knock: 260, angle: a, stun: 400 });
            vfx(this.world.sc, "vfx_crit", (this.x + e.x) / 2, (this.y + e.y) / 2 - 10, { scale: 1.4, depth: 602 });
            vfx(this.world.sc, "vfx_stars", e.x, e.y - 40, { scale: 1, depth: 602 });
          }
        }
        if (hit) {
          synth.play("bonecrack");
          this.world.hitStop(110);
          this.world.shake(220, 0.016);
          this.world.floatText(this.x, this.y - 44, "HEADBUTT!", "#ffd23f", 20);
        } else this.world.floatText(this.x, this.y - 40, "headbutt (missed)", "#9aa0b4", 12);
      });
      return;
    }
    if (now < this.specialCd) return;
    if (now < this.noSpecialUntil) {
      this.world.floatText(this.x, this.y - 30, "KREZZ BELONGS TO THE STATE", "#ff6666", 12);
      return;
    }
    const s = G.s;
    let cost = sig.cost;
    if (this.id === "KREBLIS" && s.flags.pq_done_pq_kreblis) cost -= 10;
    if (this.id === "MIKEY" && s.flags.pq_done_pq_mikey) cost -= 15;
    if (!this.spendKrezz(Math.max(0, cost))) return;
    this.specialCd = now + sig.cooldown;
    this.world.sc.events.emit("player-special");
    this.bark(true);
    synth.play("wonk");
    const d = this.dmg(this.def.damage ?? 10, now);
    switch (sig.id) {
      case "banishment_dash": {
        const len = 260;
        const sx = this.x;
        const sy = this.y;
        const ex = Phaser.Math.Clamp(sx + Math.cos(this.aim) * len, this.world.bounds.left + 20, this.world.bounds.right - 20);
        const ey = Phaser.Math.Clamp(sy + Math.sin(this.aim) * len, this.world.bounds.top + 20, this.world.bounds.bottom - 20);
        const line = new Phaser.Geom.Line(sx, sy, ex, ey);
        for (const e of [...this.world.enemies]) {
          if (e.dead) continue;
          const pt = Phaser.Geom.Line.GetNearestPoint(line, new Phaser.Geom.Point(e.x, e.y));
          if (Phaser.Math.Distance.Between(pt.x, pt.y, e.x, e.y) < e.radius + 18) {
            if (!e.isBoss && e.hp < e.maxHp * 0.3) this.world.damageEnemy(e, e.hp + 1, { label: "REMOVED FROM GROUP", crit: true });
            else this.world.damageEnemy(e, d * 2.2, { crit: true, knock: 200, angle: this.aim });
          }
        }
        if (s.upgrades.fl2) {
          for (let i = 1; i <= 4; i++) {
            const zx = sx + (ex - sx) * (i / 5);
            const zy = sy + (ey - sy) * (i / 5);
            const z = this.world.sc.add.circle(zx, zy, 20, 0x3b6cff, 0.3).setDepth(5);
            let t = 0;
            const ev = this.world.sc.time.addEvent({ delay: 300, loop: true, callback: () => {
              this.world.aoe(zx, zy, 24, d * 0.4, { noWonk: true, label: "" });
              if (++t > 8) { ev.remove(); z.destroy(); }
            } });
          }
        }
        this.spr.setPosition(ex, ey);
        this.iframesUntil = now + 350;
        const g = this.world.sc.add.graphics().setDepth(498);
        g.lineStyle(10, 0x3b6cff, 0.6).lineBetween(sx, sy, ex, ey);
        this.world.sc.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
        break;
      }
      case "krez_loan": {
        s.krezz = maxKrezz(s);
        this.loanUntil = now + 8000;
        this.interestUntil = now + 12000;
        this.world.floatText(this.x, this.y - 40, "LOAN APPROVED (APR 4000%)", "#86efac", 13);
        break;
      }
      case "breaking_news": {
        const r = 150 * (s.upgrades.kb2 ? 1.5 : 1);
        this.world.aoe(this.x, this.y, r, d * 1.5, { stun: 1200, mark: true, knock: 220, color: 0xd8443a });
        this.world.floatText(this.x, this.y - 50, "BREAKING NEWS", "#ff6666", 18);
        if (s.upgrades.kb3) {
          const x = this.x, y = this.y;
          const z = this.world.sc.add.circle(x, y, r * 0.7, 0xff3b30, 0.15).setDepth(4);
          let t = 0;
          const ev = this.world.sc.time.addEvent({ delay: 400, loop: true, callback: () => {
            this.world.aoe(x, y, r * 0.7, d * 0.35, { noWonk: true, label: "" });
            if (++t > 10) { ev.remove(); z.destroy(); }
          } });
        }
        break;
      }
      case "terrible_prophecy": {
        this.world.sc.events.emit("prophecy", 4000);
        if (s.upgrades.kw2) this.shieldUntil = now + 4000;
        this.world.floatText(this.x, this.y - 50, "I FORESAW THIS", "#c084fc", 18);
        break;
      }
      case "experimental_wonker": {
        const maxT = s.upgrades.sc3 ? 2 : 1;
        while (this.turrets.length >= maxT) {
          this.turrets.shift()!.spr.destroy();
        }
        const spr = this.world.sc.add.sprite(this.x, this.y, "fx_turret").setScale(2).setDepth(400);
        this.turrets.push({ spr, until: now + (s.upgrades.sc1 ? 12000 : 8000), next: now + 300 });
        this.world.floatText(this.x, this.y - 40, "WONKER DEPLOYED", "#e0902a", 13);
        break;
      }
      case "vengeful_krunch": {
        const recent = this.recentDamage.reduce((a, r) => a + r.amt, 0);
        let dd = d * 2 + recent * 1.0;
        if (s.upgrades.kn3) {
          s.hp = Math.max(1, s.hp - s.hp * 0.1);
          dd *= 3;
        }
        const r = 120 * (s.upgrades.kn1 ? 1.4 : 1);
        this.world.aoe(this.x, this.y, r, dd, { knock: 320, crit: true, color: 0x7a1f2b });
        this.world.shake(250, 0.012);
        this.world.floatText(this.x, this.y - 50, "KRUNCH", "#ff4d6d", 22);
        break;
      }
      case "lulon_lurk": {
        this.lurkUntil = now + 4000 + (s.flags.pq_done_pq_crongus ? 2000 : 0);
        this.nextHitCrit = true;
        if (s.upgrades.cr2) {
          this.decoy = this.world.sc.add.sprite(this.x, this.y, this.spr.texture.key, 0).setScale(2).setAlpha(0.8).setDepth(400);
          this.decoyUntil = now + 4000;
        }
        this.world.floatText(this.x, this.y - 40, "*lurks*", "#17c6c0", 14);
        break;
      }
      case "runescape_slam": {
        const hits = s.upgrades.gr3 ? 2 : 1;
        for (let h = 0; h < hits; h++) {
          this.world.sc.time.delayedCall(h * 260, () => {
            this.world.aoe(this.x, this.y, 110, 99, { fixed: true, knock: 380, label: "99", color: 0xd0642a });
            this.world.shake(200, 0.01);
          });
        }
        break;
      }
      case "nuclear_option": {
        const t = c.aimPoint();
        const waves = s.upgrades.mk2 ? 2 : 1;
        for (let w = 0; w < waves; w++) {
          for (let i = 0; i < 7; i++) {
            const bx = t.x + (Math.random() - 0.5) * 220;
            const by = t.y + (Math.random() - 0.5) * 220;
            this.world.sc.time.delayedCall(w * 900 + i * 110, () => {
              const mark = this.world.sc.add.circle(bx, by, 50, 0xffd23f, 0.25).setDepth(4);
              this.world.sc.time.delayedCall(260, () => {
                mark.destroy();
                synth.play("explode");
                const drawn = this.world.boomFx?.(bx, by, 0.6);
                this.world.aoe(bx, by, 50, d * 2.2, { knock: 160, color: drawn ? undefined : 0xffa500 });
              });
            });
          }
        }
        this.world.floatText(this.x, this.y - 50, "THE NUCLEAR OPTION", "#ffa500", 16);
        break;
      }
    }
  }

  private updateTurrets(now: number) {
    const s = G.s;
    this.turrets = this.turrets.filter((t) => {
      if (now > t.until) {
        t.spr.destroy();
        return false;
      }
      if (now > t.next) {
        t.next = now + 350;
        const e = this.world.nearestEnemy(t.spr.x, t.spr.y, 420);
        if (e) {
          const a = Math.atan2(e.y - t.spr.y, e.x - t.spr.x);
          t.spr.setFlipX(Math.cos(a) < 0);
          const dmg = this.dmg(9, now) * 1.4 * (s.flags.pq_done_pq_scrombus ? 1.4 : 1);
          for (const ang of [a, a + Math.PI]) {
            this.world.shoot(t.spr.x, t.spr.y, { owner: "player", damage: dmg, speed: 460, angle: ang, color: 0xe0902a, life: 900, onHit: s.upgrades.sc2 ? (x, y) => this.maybeHealOrb(x, y) : undefined });
          }
        }
      }
      return true;
    });
  }

  private maybeHealOrb(x: number, y: number) {
    if (Math.random() < 0.15) this.world.sc.events.emit("drop-heal", x, y);
  }

  drinkBottle(now: number) {
    const s = G.s;
    if (now < this.noHealUntil) {
      this.world.floatText(this.x, this.y - 30, "HEALING REQUIRES A PERMIT", "#ff6666", 12);
      return;
    }
    if (s.bottles <= 0) {
      this.world.floatText(this.x, this.y - 30, "NO PUSSY JUICE", "#ffb6c1", 12);
      return;
    }
    s.bottles--;
    s.hp = Math.min(maxHp(s), s.hp + 45);
    s.intoxication = Math.max(0, s.intoxication - 10);
    synth.play("gulp");
    this.world.floatText(this.x, this.y - 30, "+45 (national drink)", "#ffb6c1", 13);
    if (s.upgrades.mv_lastorders) {
      this.world.aoe(this.x, this.y, 130, this.dmg(28, now), { knock: 420, noWonk: true, color: 0xffb6c1, label: "LAST ORDERS" });
      this.world.shake(160, 0.008);
    }
    // the national drink gets you wonky
    this.world.addWonk(30);
    this.world.sc.events.emit("player-heal");
  }

  drinkBongo(now: number) {
    const s = G.s;
    if (now < this.noHealUntil) {
      this.world.floatText(this.x, this.y - 30, "HEALING REQUIRES A PERMIT", "#ff6666", 12);
      return;
    }
    if (s.bongos <= 0) {
      this.world.floatText(this.x, this.y - 30, "NO FIZZY BONGOS (withdrawals)", "#e0a35a", 12);
      return;
    }
    s.bongos--;
    s.intoxication = Math.min(100, s.intoxication + 18);
    this.bongoUntil = now + 30000;
    const heal = activeMods(s).beerHeal + (s.flags.bongos_food ? 4 : 0);
    if (heal) s.hp = Math.min(maxHp(s), s.hp + heal);
    bump(s, "bongos_drunk");
    synth.play("bongo");
    this.world.floatText(this.x, this.y - 30, heal ? `🍺 +${heal}` : "🍺 FIZZY BONGO", "#e0a35a", 13);
    this.world.sc.events.emit("player-heal");
  }

  tryBurst(now: number) {
    if (this.wonk < 100) {
      this.world.floatText(this.x, this.y - 30, `WONK ${Math.floor(this.wonk)}%`, "#ff8c00", 12);
      return;
    }
    this.wonk = 0;
    startWonk(this, now);
  }

  /** Returns true if the hit was taken. */
  takeHit(amount: number, now: number): boolean {
    if (this.invulnerable(now)) {
      if (now < this.iframesUntil) this.perfectDodge();
      return false;
    }
    const s = G.s;
    let a = amount;
    // golden: half damage
    if (now < this.superUntil) a *= 0.5;
    if (this.id === "KREBON") a *= 0.8;
    a *= 1 - 0.1 * (s.upgrades.pk_armor ?? 0);
    a *= 1 - 0.1 * kd(s, "kd_armor");
    if (now < this.bongoUntil) a *= 0.95;
    s.hp -= a;
    this.recentDamage.push({ t: now, amt: a });
    this.iframesUntil = now + 450;
    if (a > 0.5) this.hurtUntil = now + 320;
    if (s.hp <= 0) {
      if (this.id === "FLENKY" && !this.readmissionUsed) {
        this.readmissionUsed = true;
        s.hp = Math.max(1, maxHp(s) * 0.3);
        this.iframesUntil = now + 1500;
        this.world.floatText(this.x, this.y - 50, "BANNED... READMITTED", "#3b6cff", 16);
        return true;
      }
      s.hp = 0;
    }
    return true;
  }

  /** A little celebration (room cleared, boss down). Moving or shooting cuts it short. */
  cheer(now: number, ms = 1500) {
    this.cheerUntil = now + ms;
  }

  refillBottles() {
    G.s.bottles = maxBottles(G.s);
  }

  destroy() {
    this.gunSpr?.destroy();
    this.turrets.forEach((t) => t.spr.destroy());
    this.decoy?.destroy();
    this.label.destroy();
    this.spr.destroy();
  }
}

export type { Enemy };

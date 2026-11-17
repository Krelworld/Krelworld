import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import * as Juice from "../../gfx/Juice";
import { vfx } from "../../gfx/Vfx";
import type { Controls } from "../../combat/Controls";
import type { Enemy } from "../../combat/Enemy";
import type { Player } from "../../combat/Player";
import type { ShotOpts } from "../../combat/types";
import type { ConceptBoss } from "../../combat/ConceptBoss";

/**
 * SUPER SAIYAN COMBAT (the Concept's real phase): everything you do is a DBZ power fantasy, at the same damage.
 *   - Your shots (and the lads') are ki blasts: big, gold, fast, trailing, with a muzzle burst and a chunky impact.
 *     Held fire is a rapid barrage: RATE x the fire rate, each shot RATE x the damage (the same damage per second,
 *     and the same ammo per second: the extra shots are refunded).
 *   - Hits land: a combo counter with a rising pitch and a running damage total, and every few hits (and crits) a
 *     beat of hit-stop, a camera kick along the shot, the dragon shoved back with chips flying off it.
 *   - DODGE is a super-speed dash: a little longer, afterimages, a whoosh.
 *   - SPECIAL is the CUMEHAMEHA: hold to charge (crackling aura, rising whine), let go to fire a beam that pushes the
 *     dragon back and staggers it. Worth BEAM_MAX of its health at full charge; COOLDOWN between them.
 * Turned on and off by the finale (KrelfordFinale). Everything it patches goes back on off().
 */

/** Fire rate x1/RATE, damage per shot xRATE. */
export const KI_RATE = 0.65;
/** A full-charge beam: this fraction of the dragon's max HP (before its own real-phase multiplier). */
export const KI_BEAM_MAX = 0.018;
export const KI_CHARGE_MS = 1500;
export const KI_COOLDOWN = 7000;
const MIN_CHARGE = 0.25;

type Shot = { o: ShotOpts; spr: Phaser.GameObjects.Image };
interface Host extends Phaser.Scene {
  player: Player;
  enemies: Enemy[];
  shots: Shot[];
  busy: boolean;
  controls: Controls;
  now(): number;
  shoot(x: number, y: number, o: ShotOpts): Phaser.Physics.Arcade.Sprite;
  damageEnemy(e: Enemy, amount: number, opts?: object): void;
  hitStop(ms: number): void;
  shake(ms: number, i: number): void;
  floatText(x: number, y: number, text: string, color?: string, size?: number): void;
  killShot(sh: Shot): void;
}

const GOLD = 0xffd23f;

export class KiMode {
  private h: Host;
  private on = false;
  private origShoot?: Host["shoot"];
  private origAttack?: (now: number, moving: boolean) => void;
  private origSpecial?: (now: number, c: Controls) => void;
  private firing = false;
  private fired = 0;
  // combo
  private combo = 0;
  private comboDmg = 0;
  private lastHit = 0;
  private comboText?: Phaser.GameObjects.Text;
  private dmgText?: Phaser.GameObjects.Text;
  private lastHp = -1;
  private lastImpact = 0;
  private lastLadImpact = 0;
  // charge
  private charging = false;
  private chargeStart = 0;
  private chargeFx: Phaser.GameObjects.Sprite | null = null;
  private chargeGlow?: Phaser.GameObjects.Arc;
  private whine?: ReturnType<typeof Juice.chargeWhine>;
  private beamCd = 0;
  private readyShown = true;
  private chargeCalls = 0;
  private lastMote = 0;
  private dashUntil = 0;
  private lastGhost = 0;
  /** For the tests / debug: what's happened. */
  stats = { shots: 0, ladShots: 0, hits: 0, maxCombo: 0, beams: 0, dashes: 0, beamDmg: 0 };

  constructor(
    scene: Phaser.Scene,
    private boss: () => ConceptBoss,
  ) {
    this.h = scene as Host;
    makeShotTexture(scene);
    (scene as unknown as { ki?: KiMode }).ki = this;
  }

  get active() {
    return this.on;
  }

  start() {
    if (this.on) return;
    this.on = true;
    const h = this.h;
    const p = h.player as unknown as Record<string, unknown>;
    // shots: everything the player's side fires becomes a ki blast
    this.origShoot = h.shoot;
    h.shoot = (x: number, y: number, o: ShotOpts) => this.shoot(x, y, o);
    // the attack: a faster, lighter barrage
    this.origAttack = p.tryAttack as (now: number, moving: boolean) => void;
    p.tryAttack = (now: number, moving: boolean) => this.attack(now, moving);
    // the special: hold to charge the beam
    this.origSpecial = p.trySpecial as (now: number, c: Controls) => void;
    p.trySpecial = (now: number) => this.beginCharge(now);
    h.events.on("player-dodge", this.onDash, this);
    h.events.on("update", this.update, this);
    h.events.once("shutdown", () => this.stop());
    // the HUD: the combo, right-hand side under the gauge
    const L = Juice.layer(h, 4986);
    this.comboText = h.add.text(930, 150, "", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ffe066", stroke: "#000000", strokeThickness: 7 }).setOrigin(1, 0.5).setAlpha(0);
    this.dmgText = h.add.text(930, 184, "", { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffffff", stroke: "#000000", strokeThickness: 5 }).setOrigin(1, 0.5).setAlpha(0);
    L.add([this.comboText, this.dmgText]);
    this.lastHp = this.boss().hp;
    this.beamCd = h.now() + 1500;
    this.readyShown = false;
    h.time.delayedCall(400, () => this.on && h.floatText(h.player.x, h.player.y - 70, "HOLD SPECIAL: CUMEHAMEHA", "#ffe066", 15));
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    const h = this.h;
    const p = h.player as unknown as Record<string, unknown>;
    if (this.origShoot) h.shoot = this.origShoot;
    if (p) {
      delete p.tryAttack;
      delete p.trySpecial;
    }
    h.events.off("player-dodge", this.onDash, this);
    h.events.off("update", this.update, this);
    this.cancelCharge();
    this.comboText?.destroy();
    this.dmgText?.destroy();
  }

  // ---------------------------------------------------------------- shooting

  private shoot(x: number, y: number, o: ShotOpts) {
    const orig = this.origShoot!.bind(this.h);
    if (o.owner !== "player") return orig(x, y, o);
    const mine = this.firing;
    if (mine) {
      this.fired++;
      this.stats.shots++;
    } else this.stats.ladShots++;
    const hit0 = o.onHit;
    const angle = o.angle;
    const ki: ShotOpts = {
      ...o,
      damage: mine ? o.damage * KI_RATE : o.damage,
      texture: "fe_ki_shot",
      color: mine ? 0xffffff : 0xfff1b8,
      scale: mine ? 1.5 : 1,
      speed: Math.max(o.speed * 1.25, 700),
      // (faster, but no further: the same range as before)
      life: ((o.life ?? 2000) * o.speed) / Math.max(o.speed * 1.25, 700),
      trail: mine ? GOLD : 0xffe9a0,
      onHit: (hx: number, hy: number) => {
        hit0?.(hx, hy);
        this.impact(hx, hy, angle, mine, !!o.crit);
      },
    };
    if (mine) {
      // the muzzle: a gold pop at your hand, the aura flaring
      const p = this.h.player;
      const mx = p.x + Math.cos(angle) * 22;
      const my = p.y + Math.sin(angle) * 22;
      const pop = this.h.add.circle(mx, my, 7, 0xfff4c2, 0.95).setDepth(959).setBlendMode(Phaser.BlendModes.ADD);
      this.h.tweens.add({ targets: pop, scale: 2.4, alpha: 0, duration: 110, onComplete: () => pop.destroy() });
      Juice.kiZap(0.45);
    }
    const spr = orig(x, y, ki);
    spr.setDepth(mine ? 958 : 957);
    return spr;
  }

  private attack(now: number, moving: boolean) {
    const p = this.h.player as unknown as { attackCd: number };
    if (this.charging) return;
    const s = G.s;
    const gun = s.gun;
    const before = gun && s.guns ? s.guns[gun] ?? 0 : 0;
    this.firing = true;
    this.fired = 0;
    try {
      this.origAttack!.call(this.h.player, now, moving);
    } finally {
      this.firing = false;
    }
    if (this.fired > 0 && p.attackCd > now) {
      p.attackCd = now + (p.attackCd - now) * KI_RATE;
      // same ammo per second as before: refund the extra shots
      if (gun && s.guns && (s.guns[gun] ?? 0) < before && Math.random() < 1 - KI_RATE) s.guns[gun] = (s.guns[gun] ?? 0) + 1;
    }
  }

  // ---------------------------------------------------------------- hits

  private impact(x: number, y: number, angle: number, mine: boolean, crit: boolean) {
    const h = this.h;
    const now = h.now();
    if (!mine) {
      if (now - this.lastLadImpact < 70) return;
      this.lastLadImpact = now;
      vfx(h, "fe_vfx_kihit", x, y, { scale: 0.55, depth: 1460, add: true });
      return;
    }
    this.stats.hits++;
    this.combo = now - this.lastHit < 1400 ? this.combo + 1 : 1;
    this.lastHit = now;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    Juice.comboTick(this.combo);
    if (now - this.lastImpact > 45) {
      this.lastImpact = now;
      vfx(h, "fe_vfx_kihit", x, y, { scale: 0.9 + Math.min(0.6, this.combo / 40), depth: 1460, add: true, angle: Math.random() * 360 });
    }
    this.showCombo();
    const strong = crit || this.combo % 8 === 0;
    if (!strong) return;
    // the big ones: a beat of hit-stop, the camera kicks along the shot, the dragon's shoved back and chips fly
    h.hitStop(crit ? 55 : 40);
    const cam = h.cameras.main;
    cam.scrollX += Math.cos(angle) * 7;
    cam.scrollY += Math.sin(angle) * 7;
    Juice.shockRing(h, x, y, { color: GOLD, to: 120, rings: 1, ms: 300, depth: 1461 });
    Juice.debris(h, x, y, 6, { colors: [0x2a1a3a, 0x4c1d95, 0xffd23f, 0x12002a], speed: 260, size: 5, depth: 1459 });
    const b = this.boss();
    if (b?.active && !b.dead) {
      b.x += Math.cos(angle) * 5;
      b.y += Math.sin(angle) * 3;
      b.flashUntil = now + 90;
    }
    synth.play("hit");
  }

  private showCombo() {
    const t = this.comboText;
    if (!t) return;
    const n = this.combo;
    if (n < 3) return;
    t.setText(`x${n} COMBO!`).setAlpha(1).setColor(n >= 40 ? "#ff7a1a" : n >= 20 ? "#ffd23f" : "#fff4c2");
    this.h.tweens.killTweensOf(t);
    t.setScale(1.35 + Math.min(0.4, n / 100));
    this.h.tweens.add({ targets: t, scale: 1, duration: 140, ease: "Back.out" });
    this.dmgText?.setAlpha(1);
  }

  // ---------------------------------------------------------------- the dash

  private onDash() {
    if (!this.on) return;
    const h = this.h;
    const p = h.player as unknown as { dodgeUntil: number; iframesUntil: number };
    const now = h.now();
    // a touch longer (further) and covered all the way
    p.dodgeUntil += 70;
    p.iframesUntil += 70;
    this.dashUntil = p.dodgeUntil;
    this.stats.dashes++;
    Juice.whoosh();
    const ps = h.player.spr;
    Juice.shockRing(h, ps.x, ps.y + 16, { color: GOLD, to: 90, rings: 1, ms: 260, flat: 0.4, depth: ps.depth - 1 });
    void now;
  }

  // ---------------------------------------------------------------- the beam

  private beginCharge(now: number) {
    if (this.charging || this.h.busy) return;
    if (now < this.beamCd) {
      this.h.floatText(this.h.player.x, this.h.player.y - 60, `CUMEHAMEHA in ${Math.ceil((this.beamCd - now) / 1000)}s`, "#fde047", 12);
      return;
    }
    this.charging = true;
    this.chargeStart = now;
    this.chargeCalls = 0;
    const h = this.h;
    this.whine = Juice.chargeWhine();
    this.chargeFx = vfx(h, "fe_vfx_kicharge", h.player.x, h.player.y, { scale: 0.8, depth: 961, add: true });
    this.chargeGlow = h.add.circle(h.player.x, h.player.y, 12, 0xfff4c2, 0.5).setDepth(959).setBlendMode(Phaser.BlendModes.ADD);
    h.floatText(h.player.x, h.player.y - 70, "CUME…", "#fde047", 20);
    synth.play("telegraph");
  }

  private cancelCharge() {
    this.charging = false;
    this.whine?.stop();
    this.whine = undefined;
    this.chargeFx?.destroy();
    this.chargeFx = null;
    this.chargeGlow?.destroy();
    this.chargeGlow = undefined;
  }

  private chargeTick(now: number) {
    const h = this.h;
    const p = h.player;
    const k = Math.min(1, (now - this.chargeStart) / KI_CHARGE_MS);
    const hx = p.x + Math.cos(p.aim) * 26;
    const hy = p.y + Math.sin(p.aim) * 26;
    this.whine?.set(k);
    this.chargeFx?.setPosition(hx, hy).setScale(1 + k * 1.6);
    this.chargeGlow?.setPosition(hx, hy).setRadius(14 + k * 40).setAlpha(0.35 + 0.4 * k + Math.sin(now / 40) * 0.1);
    if (k > 0.5 && this.chargeCalls === 0) {
      this.chargeCalls = 1;
      h.floatText(p.x, p.y - 90, "HAME…", "#fde047", 22);
    }
    if (k >= 1 && this.chargeCalls === 1) {
      this.chargeCalls = 2;
      h.floatText(p.x, p.y - 100, "MAX!", "#ffffff", 20);
      synth.play("reveal_boom");
    }
    // the ground trembles more the longer you hold it
    if (Math.random() < 0.15 + k * 0.3) h.shake(80, 0.002 + k * 0.006);
    if (Math.random() < 0.3 + k * 0.5) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 40;
      const m = h.add.circle(hx + Math.cos(a) * r, hy + Math.sin(a) * r, 2 + Math.random() * 2, 0xfff4c2, 1).setDepth(606).setBlendMode(Phaser.BlendModes.ADD);
      h.tweens.add({ targets: m, x: hx, y: hy, alpha: 0.2, duration: 180, onComplete: () => m.destroy() });
    }
    if (!h.controls?.specialHeld?.()) this.fire(now, Math.max(MIN_CHARGE, k));
  }

  private fire(now: number, k: number) {
    const h = this.h;
    const p = h.player;
    this.cancelCharge();
    this.beamCd = now + KI_COOLDOWN;
    this.readyShown = false;
    this.stats.beams++;
    const ang = p.aim;
    const calm = !!G.meta?.settings?.calmFlash;
    const LEN = 1400;
    const WID = 26 + 40 * k;
    const DUR = 500 + 400 * k;
    h.floatText(p.x, p.y - 100, k >= 0.95 ? "HAAAAAAAAAAA!!!" : "HAAA!", "#ffffff", 18 + 14 * k);
    synth.laser(0.8 + k);
    synth.play("boom");
    Juice.subDrop(0.6 + 0.4 * k, 1 + k);
    h.shake(500 + 500 * k, 0.008 + 0.016 * k);
    Juice.flash(h, 0xfff4c2, 200, 0.3 + 0.3 * k, 4880);
    const stopLines = Juice.speedLines(h, DUR, 0xfff4c2);
    if (k >= 0.95) Juice.punchZoom(h, 0.06, 420);
    const g = h.add.graphics().setDepth(960).setBlendMode(Phaser.BlendModes.ADD);
    const st = { len: 0, life: 1 };
    h.tweens.add({ targets: st, len: LEN, duration: 120, ease: "Quad.out" });
    h.time.delayedCall(DUR, () => h.tweens.add({ targets: st, life: 0, duration: 240 }));
    // its damage is spread over TICKS ticks while the beam's on it
    const b = this.boss();
    const TICKS = 6;
    const total = b.maxHp * KI_BEAM_MAX * k;
    let ticks = 0;
    let hitsOnBoss = 0;
    let landed = false;
    const ev = h.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!g.active) {
          return ev.remove();
        }
        const x1 = p.x + Math.cos(ang) * 24;
        const y1 = p.y + Math.sin(ang) * 24;
        // it stops at the dragon (it's pushing into it)
        let len = st.len;
        if (b.active && !b.dead) {
          const ex = b.x - x1;
          const ey = b.y - y1;
          const along = ex * Math.cos(ang) + ey * Math.sin(ang);
          const across = Math.abs(-ex * Math.sin(ang) + ey * Math.cos(ang));
          if (along > 0 && across < b.radius + WID * 0.5) len = Math.min(len, Math.max(30, along - b.radius * 0.4));
        }
        const x2 = x1 + Math.cos(ang) * len;
        const y2 = y1 + Math.sin(ang) * len;
        const wob = 1 + Math.sin(h.time.now / 25) * 0.1;
        g.clear();
        g.lineStyle(WID * 2.2 * st.life * wob, 0xf59e0b, 0.25).lineBetween(x1, y1, x2, y2);
        g.lineStyle(WID * st.life * wob, 0xffe066, 0.85).lineBetween(x1, y1, x2, y2);
        g.lineStyle(WID * 0.45 * st.life, 0xffffff, 1).lineBetween(x1, y1, x2, y2);
        g.fillStyle(0xffffff, st.life).fillCircle(x1, y1, WID * 0.7 * st.life * wob);
        g.fillStyle(0xfff4c2, st.life * 0.9).fillCircle(x2, y2, WID * 0.9 * st.life * wob);
        // enemy shots in its path are swept away
        for (const sh of [...h.shots]) {
          if (sh.o.owner !== "enemy") continue;
          const sx = sh.spr.x - x1;
          const sy = sh.spr.y - y1;
          const al = sx * Math.cos(ang) + sy * Math.sin(ang);
          const ac = Math.abs(-sx * Math.sin(ang) + sy * Math.cos(ang));
          if (al > 0 && al < len && ac < WID) h.killShot(sh);
        }
        if (++ticks % 6 === 0 && st.life > 0.3) {
          for (const e of [...h.enemies]) {
            if (e.dead) continue;
            const ex = e.x - x1;
            const ey = e.y - y1;
            const along = ex * Math.cos(ang) + ey * Math.sin(ang);
            const across = Math.abs(-ex * Math.sin(ang) + ey * Math.cos(ang));
            if (along < 0 || along > len + e.radius || across > WID * 0.6 + e.radius) continue;
            if (e === (b as unknown as Enemy)) {
              if (hitsOnBoss >= TICKS) continue;
              hitsOnBoss++;
              const hp0 = b.hp;
              h.damageEnemy(e, total / TICKS, { label: "", noWonk: true });
              this.stats.beamDmg += Math.max(0, hp0 - b.hp);
              if (!landed) {
                landed = true;
                this.beamLands(b, x2, y2, ang, k, calm);
              }
              if (Math.random() < 0.6) vfx(h, "fe_vfx_kihit", x2 + (Math.random() - 0.5) * 30, y2 + (Math.random() - 0.5) * 30, { scale: 1.2, depth: 1460, add: true });
            } else h.damageEnemy(e, p.dmg(60, h.now()), { knock: 380, angle: ang, noWonk: true });
          }
        }
        if (st.life <= 0.01) {
          ev.remove();
          g.destroy();
          stopLines();
          if (landed) h.floatText(b.x, b.y - b.displayHeight * 0.3, `${Math.round(this.stats.beamDmg)}`, "#ffe066", 34);
        }
      },
    });
  }

  /** The beam hits the dragon: impact frames, a big burst, it's shoved back and staggered. */
  private beamLands(b: ConceptBoss, x: number, y: number, ang: number, k: number, calm: boolean) {
    const h = this.h;
    h.hitStop(60 + 100 * k);
    if (k >= 0.6 && !calm) void Juice.impactFrames(h, b, 45);
    vfx(h, "fe_vfx_kibig", x, y, { scale: 1.2 + k, depth: 1462, add: true });
    Juice.shockRing(h, x, y, { color: GOLD, to: 300 + 400 * k, rings: 3, ms: 700, depth: 1461 });
    Juice.debris(h, x, y, Math.round(8 + 14 * k), { colors: [0x2a1a3a, 0x4c1d95, 0xffd23f, 0x12002a], speed: 420, size: 8, depth: 1459 });
    synth.play("explode_1");
    synth.play("crit");
    // it recoils (drawn flinch), then roars
    b.move("flinch", 10);
    b.scene.time.delayedCall(450, () => b.active && !b.dead && b.roar());
    // staggered: its next attack waits, and it's pushed back along the beam (kept inside where it may roam)
    b.nextPattern = Math.max(b.nextPattern, h.now() + 600 + 900 * k);
    const push = 50 + 90 * k;
    const tx = Phaser.Math.Clamp(b.x + Math.cos(ang) * push, b.roam.left, b.roam.right);
    const ty = Phaser.Math.Clamp(b.y + Math.sin(ang) * push, b.roam.top, b.roam.bottom);
    h.tweens.add({ targets: b, x: tx, y: ty, duration: 360, ease: "Cubic.out" });
    b.flashUntil = h.now() + 200;
    if (k >= 0.95) Juice.slamText(h, "CUMEHAMEHA!", "#ffe066", 44, 200, 700);
  }

  // ---------------------------------------------------------------- every frame

  private update() {
    if (!this.on) return;
    const h = this.h;
    const now = h.now();
    const p = h.player;
    if (!p?.spr?.active) return;
    if (this.charging) {
      if (h.busy) this.cancelCharge();
      else this.chargeTick(now);
    }
    if (!this.readyShown && now >= this.beamCd && !this.charging) {
      this.readyShown = true;
      h.floatText(p.x, p.y - 64, "CUMEHAMEHA READY", "#ffe066", 13);
      synth.play("select");
    }
    // the combo: the running damage total, and it lapses
    const b = this.boss();
    if (b && this.lastHp >= 0) {
      const d = this.lastHp - b.hp;
      if (d > 0 && now - this.lastHit < 1400) {
        this.comboDmg += d;
        this.dmgText?.setText(`${Math.round(this.comboDmg).toLocaleString("en-GB")} DMG`);
      }
      this.lastHp = b.hp;
    }
    if (this.combo > 0 && now - this.lastHit > 1400) {
      if (this.combo >= 10) h.floatText(p.x, p.y - 80, `${this.combo} HIT COMBO`, "#ffd23f", 16);
      this.combo = 0;
      this.comboDmg = 0;
      if (this.comboText) h.tweens.add({ targets: [this.comboText, this.dmgText], alpha: 0, duration: 300 });
    }
    // the dash: gold afterimages
    if (now < this.dashUntil && now - this.lastGhost > 22) {
      this.lastGhost = now;
      const ps = p.spr;
      const ghost = h.add.image(ps.x, ps.y, ps.texture.key, ps.frame.name).setOrigin(ps.originX, ps.originY).setFlipX(ps.flipX).setDepth(ps.depth - 1).setTintFill(0xffd23f).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
      ghost.setScale(ps.scaleX, ps.scaleY);
      h.tweens.add({ targets: ghost, alpha: 0, duration: 240, onComplete: () => ghost.destroy() });
    }
    // moving: gold motes trail off your feet
    const body = p.spr.body as Phaser.Physics.Arcade.Body | null;
    if (body && body.velocity.length() > 60 && now - this.lastMote > 45) {
      this.lastMote = now;
      const m = h.add.circle(p.x + (Math.random() - 0.5) * 16, p.y + 18, 2 + Math.random() * 2.5, Math.random() < 0.5 ? 0xffd23f : 0xfff4c2, 0.9).setDepth(p.spr.depth - 2).setBlendMode(Phaser.BlendModes.ADD);
      h.tweens.add({ targets: m, y: m.y - 20 - Math.random() * 20, alpha: 0, scale: 0.3, duration: 420, onComplete: () => m.destroy() });
    }
  }
}

/** A chunky pixel ki blast, flying +x: white core, gold body, a tapering tail. */
function makeShotTexture(sc: Phaser.Scene) {
  if (sc.textures.exists("fe_ki_shot")) return;
  const W = 22;
  const H = 10;
  const c = sc.textures.createCanvas("fe_ki_shot", W, H);
  if (!c) return;
  const ctx = c.getContext();
  const px = (x: number, y: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  };
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++) {
      // a teardrop: round head at the right, tail to the left
      const hx = W - 6;
      const dx = x - hx;
      const dy = y - (H - 1) / 2;
      const r = x >= hx ? 4.6 : 4.6 * Math.pow(x / hx, 1.4);
      const d = x >= hx ? Math.hypot(dx, dy) : Math.abs(dy);
      if (d > r) continue;
      const t = d / r;
      const col = t < 0.35 && x > hx - 6 ? "#ffffff" : t < 0.6 ? "#fff4c2" : t < 0.85 ? "#ffd23f" : "#f59e0b";
      px(x, y, col);
    }
  c.refresh();
  c.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

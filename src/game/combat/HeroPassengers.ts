import Phaser from "phaser";
import { Boss } from "./Bosses";
import type { CombatWorld } from "./types";
import { BOSS_TEXT } from "../../content/bosses";
import { synth } from "../audio/Synth";
import { G } from "../G";
import type { KrelTarget } from "./Kreltality";

/**
 * THE HERO PASSENGERS (Flight KR-069, first class, just before the cockpit door): three passengers who have decided
 * to be heroes and take the plane back, fought all at once. Each is a mini-boss of its own (art, attacks, HP, barks),
 * and the squad shares one bar on the HUD with a name tag and a little bar over each of them. When they go down they
 * stay down, cowering (their krelvic_ terror row), until the last one falls: then "KRELTALITY ALL OF THEM?".
 *
 *  - RUGBY DAD GARETH: walks you down, then charges (a full-length tackle: jump it) and scrum-stomps.
 *  - GAP YAH TILLY: keeps her distance and lobs the hand luggage; get close and she kicks.
 *  - MAJOR BUNTING: slow, with a walking stick that hurts, and he calls in air raids that aren't there.
 */

export const HERO_IDS = ["heropax_rugby", "heropax_gapgirl", "heropax_major"] as const;
export type HeroId = (typeof HERO_IDS)[number];

/** Their colours: the name tags, the VS card. */
export const HERO_COLORS: Record<HeroId, number> = { heropax_rugby: 0xdc2626, heropax_gapgirl: 0xa855f7, heropax_major: 0x60a5fa };
/** Short names for the tags over their heads. */
const TAG: Record<HeroId, string> = { heropax_rugby: "GARETH", heropax_gapgirl: "TILLY", heropax_major: "THE MAJOR" };

/** What the others shout when one of them goes down. */
const ON_DOWN: Record<HeroId, string[]> = {
  heropax_rugby: ["GARETH! NOOO!", "Man down! The big one's down!"],
  heropax_gapgirl: ["TILLY! They got Tilly!", "Not the gap year girl!"],
  heropax_major: ["The Major! He's DOWN!", "Medic! MEDIC!"],
};
/** And the last one standing. */
const LAST_STAND: Record<HeroId, string> = {
  heropax_rugby: "Right. Just me then. COME ON THEN!",
  heropax_gapgirl: "Okay, okay, I can do this, I did a WHOLE MODULE on this!",
  heropax_major: "Last man standing! Just like Dunkirk! (I wasn't at Dunkirk.)",
};

/** The three of them, as a group: tags, bars, the shared HUD bar, whose turn it is to shout. */
export class HeroSquad {
  members: HeroPassenger[] = [];
  /** Who's been beaten (in order), with what they looked like when they went down (for the Kreltality chain). */
  downed: { hero: HeroPassenger; target: KrelTarget }[] = [];
  private tags = new Map<HeroPassenger, Phaser.GameObjects.Text>();
  private bars: Phaser.GameObjects.Graphics;
  private lastBark = -1e9;
  private lastBig = -1e9;
  done = false;

  constructor(private sc: Phaser.Scene) {
    this.bars = sc.add.graphics().setDepth(940);
  }

  add(h: HeroPassenger) {
    h.squad = this;
    this.members.push(h);
    const col = Phaser.Display.Color.IntegerToColor(HERO_COLORS[h.bossId as HeroId] ?? 0xffffff).rgba;
    this.tags.set(h, this.sc.add.text(h.x, h.y, TAG[h.bossId as HeroId] ?? h.bossId, { fontFamily: "Impact, sans-serif", fontSize: "13px", color: col, stroke: "#000", strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(941));
  }

  get alive() {
    return this.members.filter((m) => !m.dead);
  }

  /** One of them may shout out loud (one voice at a time, a beat between). */
  mayBark(now: number) {
    if (now - this.lastBark < 2600) return false;
    this.lastBark = now;
    return true;
  }

  /** Their big moves take turns, so the three of them don't all land on you in the same instant. */
  mayGoBig(now: number, gap = 900) {
    if (now - this.lastBig < gap) return false;
    this.lastBig = now;
    return true;
  }

  /** The bar on the HUD: all three of them together. */
  hud() {
    let hp = 0;
    let max = 0;
    for (const m of this.members) {
      hp += Math.max(0, m.dead ? 0 : m.hp);
      max += m.maxHp;
    }
    const left = this.alive.length;
    G.emit("boss", { name: `THE HERO PASSENGERS (${left} LEFT)`, hp, max, shielded: false, phase: 3 - left });
  }

  /** Tags and little bars over their heads (every frame). */
  update() {
    const g = this.bars.clear();
    for (const m of this.members) {
      const t = this.tags.get(m);
      if (!t) continue;
      if (!m.active) {
        t.setVisible(false);
        continue;
      }
      const top = m.y - m.displayHeight * m.originY + m.displayHeight * 0.12;
      t.setPosition(m.x, top - 12).setVisible(true).setAlpha(m.dead ? 0.55 : 1);
      if (m.dead) {
        t.setText(`${TAG[m.bossId as HeroId]} · OUT`);
        continue;
      }
      const w = 54;
      g.fillStyle(0x000000, 0.75).fillRect(m.x - w / 2 - 1, top - 9, w + 2, 6);
      g.fillStyle(HERO_COLORS[m.bossId as HeroId] ?? 0xef4444, 1).fillRect(m.x - w / 2, top - 8, (w * Math.max(0, m.hp)) / m.maxHp, 4);
    }
  }

  /** One down: the others react (and the last one standing gets a second wind). */
  onDown(h: HeroPassenger, target: KrelTarget) {
    this.downed.push({ hero: h, target });
    const rest = this.alive;
    const now = h.world.now();
    if (rest.length) {
      const who = rest[Math.floor(Math.random() * rest.length)];
      const lines = ON_DOWN[h.bossId as HeroId] ?? ["Man down!"];
      h.world.floatText(who.x, who.y - who.displayHeight / 2 - 30, lines[Math.floor(Math.random() * lines.length)], "#fde68a", 15);
      for (const r of rest) r.rage = Math.min(2, r.rage + 1);
      if (rest.length === 1) {
        const last = rest[0];
        h.world.sc.time.delayedCall(1100, () => {
          if (last.dead || !last.active) return;
          h.world.floatText(last.x, last.y - last.displayHeight / 2 - 30, LAST_STAND[last.bossId as HeroId] ?? "COME ON THEN!", "#fca5a5", 15);
        });
      }
      this.lastBig = now;
    }
  }

  destroy() {
    for (const t of this.tags.values()) t.destroy();
    this.tags.clear();
    this.bars.destroy();
  }
}

/** One hero passenger: a side-on mini-boss that walks the aisle (gravity), with its own bar and tag via the squad. */
export abstract class HeroPassenger extends Boss {
  sideGravity = true;
  squad: HeroSquad | null = null;
  /** 0, 1 or 2 of the others down: they get quicker and nastier. */
  rage = 0;
  protected busyUntil = 0;
  /** How it looked as it went down (set by kill()). */
  downTarget: KrelTarget | null = null;

  constructor(w: CombatWorld, id: HeroId, x: number, y: number, hp: number, damage: number) {
    super(w, id, x, y, hp, w.sc.textures.exists(`boss_${id}`) ? `boss_${id}` : "boss_flatmate", 40, HERO_COLORS[id], 128, 128);
    this.def = { ...this.def, damage };
    this.setScale(2);
    // a bit of space between them in the queue to have a go
    this.nextPattern = w.now() + 1400 + HERO_IDS.indexOf(id) * 700;
  }

  protected emitHud() {
    if (this.squad) this.squad.hud();
    else super.emitHud();
  }

  taunt() {
    if (this.squad && !this.squad.mayBark(this.world.now())) return;
    super.taunt();
  }

  protected get ts() {
    return this.world.enemyTimeScale * (1 + this.rage * 0.15);
  }

  protected get grounded() {
    const b = this.body as Phaser.Physics.Arcade.Body;
    return !this.world.side || b.blocked.down || b.touching.down;
  }

  protected run(vx: number) {
    const b = this.body as Phaser.Physics.Arcade.Body;
    if (this.world.side) b.setVelocityX(vx);
    else b.setVelocity(vx, 0);
  }

  protected face(dir: number) {
    this.setFlipX(dir < 0);
  }

  protected say(t: string, col = "#fca5a5") {
    this.world.floatText(this.x, this.y - this.displayHeight / 2 - 26, t, col, 15);
  }

  /** The floor they stand on (y). */
  protected get floor() {
    return this.world.groundY ?? this.world.bounds.bottom;
  }

  /** Where it went down and what it looked like (the Kreltality draws them back up from this). */
  krelTarget(): KrelTarget {
    const hd = (this.scene.textures.get(this.animKey ?? this.texture.key).customData as { hd?: number } | undefined)?.hd ?? 1;
    const key = this.animKey ?? this.texture.key;
    return { key, frame: 0, x: this.x, y: this.y, scale: this.scaleX / hd, flip: this.flipX, name: BOSS_TEXT[this.bossId]?.name ?? "A HERO PASSENGER", id: this.bossId };
  }

  /**
   * Beaten: they don't vanish (a boss normally does), they go down where they stand and cower (their drawn
   * terror row), out of the fight, until the Kreltality (or not) at the end.
   */
  kill() {
    const sc = this.scene;
    this.downTarget = this.krelTarget();
    this.dead = true;
    this.hpBar?.destroy();
    this.halt();
    const b = this.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(0, 0);
    b.enable = false;
    this.clearTint();
    this.setAngle(0);
    // back down to the floor if they were mid-jump
    const feet = this.y + this.displayHeight * (1 - this.originY);
    const fl = this.floor;
    if (feet < fl - 4) sc.tweens.add({ targets: this, y: this.y + (fl - feet), duration: 260, ease: "Quad.in" });
    const vic = `krelvic_${this.bossId}`;
    if (sc.textures.exists(vic)) {
      const hdOld = (this.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
      const sx = this.scaleX / hdOld;
      this.anims.stop();
      this.setTexture(vic, 0);
      this.setScale(sx);
      const cols = Math.max(1, Math.round(sc.textures.get(vic).getSourceImage().width / this.frame.width));
      const ak = `${vic}:down`;
      if (!sc.anims.exists(ak)) sc.anims.create({ key: ak, frames: sc.anims.generateFrameNumbers(vic, { start: Math.floor(cols / 2), end: cols - 1 }), frameRate: 8, repeat: -1, yoyo: true });
      this.play(ak);
    } else {
      this.setTint(0x9ca3af);
      sc.tweens.add({ targets: this, angle: { from: -5, to: 5 }, yoyo: true, repeat: -1, duration: 500 });
    }
    this.world.floatText(this.x, this.y - this.displayHeight / 2 - 10, "DOWN!", "#fde68a", 20);
    synth.play("punch_big");
    this.world.shake(200, 0.01);
  }

  /** Off the board for good (just before their Kreltality draws them back up, or when the room ends). */
  remove() {
    this.scene.tweens.killTweensOf(this);
    this.destroy();
  }
}

// ----------------------------------------------------------------- RUGBY DAD GARETH

/** Off-duty rugby dad in a polo shirt. Walks you down, charges the length of the aisle (jump it), scrum-stomps. */
export class RugbyDad extends HeroPassenger {
  private chargeUntil = 0;
  private chargeDir = 1;
  constructor(w: CombatWorld, x: number, y: number) {
    super(w, "heropax_rugby", x, y, 600, 16);
  }
  pattern(_dt: number, now: number) {
    const p = this.world.player;
    const b = this.body as Phaser.Physics.Arcade.Body;
    if (now < this.chargeUntil) {
      this.run(this.chargeDir * (640 + this.rage * 60) * this.world.enemyTimeScale);
      this.face(this.chargeDir);
      if (b.blocked.left || b.blocked.right) {
        // into the bulkhead (or a seat): winded
        this.chargeUntil = 0;
        this.run(0);
        synth.play("smash");
        this.world.shake(260, 0.014);
        this.say("OOF.", "#fde68a");
        this.playAnim("stagger", { holdMs: 1100 });
      }
      return;
    }
    if (now < this.busyUntil) return this.run(0);
    const dx = p.x - this.x;
    const dir = dx < 0 ? -1 : 1;
    this.face(dir);
    this.run(Math.abs(dx) > 90 ? dir * 85 * this.ts : 0);
    if (now < this.nextPattern || !this.grounded) return;
    if (!this.squad?.mayGoBig(now)) return void (this.nextPattern = now + 300);
    const pick = this.patternIdx++ % 3;
    this.taunt();
    if (pick === 0 || pick === 2) {
      // THE TACKLE: a lane down the aisle lights up, then he goes
      this.chargeDir = dir;
      this.run(0);
      const wind = 650 * this.world.telegraphMult;
      this.world.enemyLine(this.x, this.floor - 40, dir > 0 ? 0 : Math.PI, 1000, 76, 0, wind);
      this.say("TACKLE! (JUMP IT!)");
      this.oneShot("special");
      this.busyUntil = now + wind;
      this.world.sc.time.delayedCall(wind, () => {
        if (this.dead || !this.active) return;
        this.chargeUntil = this.world.now() + 1000;
        this.oneShot("attack");
        synth.play("swing");
      });
      this.nextPattern = now + 3000 - this.rage * 400;
    } else {
      // SCRUM DOWN: up, and down on the floor with a shockwave both ways
      this.run(0);
      if (this.world.side) b.setVelocityY(-720);
      this.say("SCRUM DOWN!");
      this.busyUntil = now + 900;
      this.world.sc.time.delayedCall(820, () => {
        if (this.dead || !this.active) return;
        synth.play("smash");
        this.world.shake(300, 0.016);
        this.world.enemyLine(this.x, this.floor - 18, 0, 300, 36, 15, 120);
        this.world.enemyLine(this.x, this.floor - 18, Math.PI, 300, 36, 15, 120);
      });
      this.nextPattern = now + 2400 - this.rage * 300;
    }
  }
}

// ----------------------------------------------------------------- GAP YAH TILLY

/** Gap-year traveller, two weeks of Krav Maga. Keeps her distance and lobs the hand luggage; too close and she kicks. */
export class GapGirl extends HeroPassenger {
  private hop = 0;
  constructor(w: CombatWorld, x: number, y: number) {
    super(w, "heropax_gapgirl", x, y, 430, 12);
  }
  pattern(_dt: number, now: number) {
    const p = this.world.player;
    const b = this.body as Phaser.Physics.Arcade.Body;
    const dx = p.x - this.x;
    const dir = dx < 0 ? -1 : 1;
    this.face(dir);
    if (now < this.busyUntil) return this.run(0);
    const d = Math.abs(dx);
    // her range: about three rows of seats away
    const want = 300;
    this.run(d < want - 70 ? -dir * 110 * this.ts : d > want + 90 ? dir * 95 * this.ts : 0);
    // a little hop now and then (she's light on her feet), backwards off a wall
    if ((b.blocked.left || b.blocked.right) && this.grounded && now > this.hop) {
      this.hop = now + 1500;
      b.setVelocity(dir * 260, -620);
    }
    if (now < this.nextPattern || !this.grounded) return;
    if (d < 130) {
      // KRAV MAGA: a high kick, in your face
      if (!this.squad?.mayGoBig(now, 500)) return;
      this.run(0);
      this.oneShot("attack");
      this.say("KRAV MAGA! HYAH!");
      this.world.enemyLine(this.x, this.y - 10, dir > 0 ? 0 : Math.PI, 150, 46, 13, 280 * this.world.telegraphMult);
      this.busyUntil = now + 600;
      this.nextPattern = now + 1500 - this.rage * 200;
      return;
    }
    if (!this.squad?.mayGoBig(now)) return void (this.nextPattern = now + 300);
    this.taunt();
    const pick = this.patternIdx++ % 3;
    this.run(0);
    this.oneShot("special");
    this.busyUntil = now + 500;
    if (pick < 2) {
      // CARRY-ON: lobbed over, landing where you are (and either side of you, when she's angry)
      const n = 1 + (pick === 1 ? 1 : 0) + this.rage;
      for (let i = 0; i < n; i++) this.lob(p.x + (i - (n - 1) / 2) * 110 + (Math.random() - 0.5) * 30, i * 160);
      this.say(n > 1 ? "CARRY-ON, COMING THROUGH!" : "CATCH!", "#e9d5ff");
      this.nextPattern = now + 2200 - this.rage * 300;
    } else {
      // duty free: the little bottles, straight at you
      this.world.sc.time.delayedCall(250, () => {
        if (this.dead || !this.active) return;
        this.fan(3 + this.rage, 0.14, 300, 9, 0xa855f7);
        synth.play("swing");
      });
      this.say("DUTY FREE!", "#e9d5ff");
      this.nextPattern = now + 1900 - this.rage * 250;
    }
  }

  /** A suitcase in an arc, landing on a marked spot. */
  private lob(tx: number, delay: number) {
    const sc = this.world.sc;
    const fl = this.floor;
    const b = this.world.bounds;
    tx = Phaser.Math.Clamp(tx, b.left + 30, b.right - 30);
    const air = 820 * this.world.telegraphMult;
    this.world.enemyAoe(tx, fl - 20, 52, 14, air + delay, 0xa855f7);
    sc.time.delayedCall(delay, () => {
      if (!this.active) return;
      const key = ["pl_suitcase", "pl_duffel"].find((k) => sc.textures.exists(k) && Math.random() < 0.6) ?? (sc.textures.exists("pl_suitcase") ? "pl_suitcase" : null);
      const bag = key ? sc.add.image(this.x, this.y - 30, key).setScale(1.5).setDepth(900) : sc.add.rectangle(this.x, this.y - 30, 26, 18, 0x7c3aed).setDepth(900);
      const x0 = bag.x;
      const y0 = bag.y;
      const o = { t: 0 };
      synth.play("swing");
      sc.tweens.add({
        targets: o,
        t: 1,
        duration: air,
        onUpdate: () => {
          bag.setPosition(x0 + (tx - x0) * o.t, y0 + (fl - 20 - y0) * o.t - Math.sin(o.t * Math.PI) * 190);
          bag.setAngle(o.t * 540);
        },
        onComplete: () => {
          synth.play("punch_big", 0.6);
          bag.setAngle(0);
          sc.tweens.add({ targets: bag, alpha: 0, delay: 900, duration: 400, onComplete: () => bag.destroy() });
        },
      });
    });
  }
}

// ----------------------------------------------------------------- MAJOR BUNTING

/** Retired, medals on, walking stick. Slow, but the stick hurts, and he calls in air raids that aren't there. */
export class MajorBunting extends HeroPassenger {
  constructor(w: CombatWorld, x: number, y: number) {
    super(w, "heropax_major", x, y, 480, 14);
  }
  pattern(_dt: number, now: number) {
    const p = this.world.player;
    const dx = p.x - this.x;
    const dir = dx < 0 ? -1 : 1;
    this.face(dir);
    if (now < this.busyUntil) return this.run(0);
    const d = Math.abs(dx);
    this.run(d > 100 ? dir * 50 * this.ts : 0);
    if (now < this.nextPattern || !this.grounded) return;
    if (d < 150) {
      // THE STICK: a big overhead swing in front of him
      if (!this.squad?.mayGoBig(now, 500)) return;
      this.run(0);
      this.oneShot("attack");
      this.say("HAVE SOME STICK!", "#bfdbfe");
      this.world.enemyAoe(this.x + dir * 70, this.y + 10, 64, 16, 420 * this.world.telegraphMult, 0x60a5fa);
      this.busyUntil = now + 700;
      this.nextPattern = now + 1700 - this.rage * 200;
      return;
    }
    if (!this.squad?.mayGoBig(now)) return void (this.nextPattern = now + 300);
    this.taunt();
    const pick = this.patternIdx++ % 2;
    this.run(0);
    this.oneShot("special");
    if (pick === 0) {
      // "INCOMING!": he's back in the war. Bombs (there aren't any) all down the aisle around you.
      this.say("INCOMING! GET DOWN!", "#bfdbfe");
      synth.play("alarm", 0.4);
      const n = 4 + this.rage;
      for (let i = 0; i < n; i++) {
        const tx = p.x + (i - (n - 1) / 2) * 120 + (Math.random() - 0.5) * 40;
        this.world.enemyAoe(tx, this.floor - 20, 56, 13, (900 + i * 170) * this.world.telegraphMult, 0xf59e0b);
      }
      this.busyUntil = now + 900;
      this.nextPattern = now + 3000 - this.rage * 400;
    } else {
      // the medals off his chest, flung like shuriken
      this.say("TAKE MY MEDALS! NO, WAIT!", "#bfdbfe");
      this.world.sc.time.delayedCall(300, () => {
        if (this.dead || !this.active) return;
        this.fan(4 + this.rage, 0.12, 260, 10, 0xfacc15);
        synth.play("swing");
      });
      this.busyUntil = now + 600;
      this.nextPattern = now + 2000 - this.rage * 250;
    }
  }
}

export function createHero(id: HeroId, w: CombatWorld, x: number, y: number): HeroPassenger {
  if (id === "heropax_rugby") return new RugbyDad(w, x, y);
  if (id === "heropax_gapgirl") return new GapGirl(w, x, y);
  return new MajorBunting(w, x, y);
}

// ----------------------------------------------------------------- KRELTALITY ALL OF THEM?

/** The offer, once they're all down: all three in a row, or spare them. Resolves true for yes (K / click), false for no. */
export function krelAllPrompt(sc: Phaser.Scene, n: number): Promise<boolean> {
  return new Promise((resolve) => {
    const cam = sc.cameras.main;
    const D = 2050;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const pin = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as unknown as { setScrollFactor: (x: number, y?: number) => void }).setScrollFactor(0, 0);
      objs.push(o);
      return o;
    };
    const k = 1 / cam.zoom;
    const cx = 480;
    const cy = 270;
    pin(sc.add.rectangle(cx, cy, 4000, 4000, 0x2a0000, 0.55).setDepth(D).setInteractive());
    const t = pin(sc.add.text(cx, cy - 100 * k, n > 1 ? "KRELTALITY ALL OF THEM?" : "FUCKING KILL THEM!!", { fontFamily: "Impact, sans-serif", fontSize: "50px", color: "#ef4444", stroke: "#000", strokeThickness: 9 }).setOrigin(0.5).setDepth(D + 1).setScale(k));
    pin(sc.add.text(cx, cy - 52 * k, n > 1 ? `all ${n} hero passengers, one after another` : "", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#fca5a5", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 1).setScale(k));
    synth.play("roar");
    sc.tweens.add({ targets: t, x: { from: cx - 4 * k, to: cx + 4 * k }, yoyo: true, repeat: -1, duration: 50 });
    const mk = (x: number, label: string, bg: string, fn: () => void) => {
      const b = pin(sc.add.text(cx + x * k, cy + 14 * k, label, { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#ffffff", backgroundColor: bg, padding: { x: 18, y: 10 } }).setOrigin(0.5).setDepth(D + 2).setScale(k).setInteractive({ useHandCursor: true }));
      b.on("pointerdown", fn);
      return b;
    };
    const yesB = mk(-150, n > 1 ? "☠ ALL OF THEM (K)" : "☠ KRELTALITY (K)", "#991b1b", () => done(true));
    mk(160, "spare them (ESC)", "#1f2937", () => done(false));
    sc.tweens.add({ targets: yesB, scale: { from: k, to: k * 1.08 }, yoyo: true, repeat: -1, duration: 300 });
    const bar = pin(sc.add.rectangle(cx - 200 * k, cy + 76 * k, 400 * k, 6 * k, 0xef4444).setOrigin(0, 0.5).setDepth(D + 2));
    sc.tweens.add({ targets: bar, scaleX: 0, duration: 8000, onComplete: () => done(false) });
    const kb = sc.input.keyboard;
    const onK = () => done(true);
    const onEsc = () => done(false);
    kb?.on("keydown-K", onK);
    kb?.on("keydown-ESC", onEsc);
    let fin = false;
    function done(v: boolean) {
      if (fin) return;
      fin = true;
      kb?.off("keydown-K", onK);
      kb?.off("keydown-ESC", onEsc);
      for (const o of objs) {
        sc.tweens.killTweensOf(o);
        o.destroy();
      }
      if (!v) synth.play("select");
      resolve(v);
    }
  });
}

/** "KRELTALITY 2 OF 3": a card between the finishers in the chain. */
export async function chainCard(sc: Phaser.Scene, i: number, n: number, name: string): Promise<void> {
  const cam = sc.cameras.main;
  const k = 1 / cam.zoom;
  const t = sc.add.text(480, 230, `${i} OF ${n}`, { fontFamily: "Impact, sans-serif", fontSize: "64px", color: "#ef4444", stroke: "#000", strokeThickness: 9 }).setOrigin(0.5).setScrollFactor(0).setDepth(2070).setScale(2 * k).setAlpha(0);
  const s = sc.add.text(480, 288, `NEXT: ${name}`, { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#fde68a", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(2070).setScale(k).setAlpha(0);
  sc.tweens.add({ targets: t, scale: k, alpha: 1, duration: 220, ease: "Quad.out" });
  sc.tweens.add({ targets: s, alpha: 1, duration: 300, delay: 120 });
  synth.play("smash", 0.6);
  await new Promise<void>((r) => sc.time.delayedCall(900, () => r()));
  sc.tweens.add({ targets: [t, s], alpha: 0, duration: 250, onComplete: () => (t.destroy(), s.destroy()) });
  await new Promise<void>((r) => sc.time.delayedCall(250, () => r()));
}

/** TRIPLE KRELTALITY! (or DOUBLE): the banner at the end of the chain. */
export async function multiBanner(sc: Phaser.Scene, n: number): Promise<void> {
  const cam = sc.cameras.main;
  const gore = G.meta?.settings?.gore !== false;
  const calm = !!G.meta?.settings?.calmFlash;
  const k = 1 / cam.zoom;
  const word = n >= 3 ? "TRIPLE" : n === 2 ? "DOUBLE" : "";
  const objs: Phaser.GameObjects.GameObject[] = [];
  const dim = sc.add.rectangle(480, 270, 4000, 4000, 0x1a0000, 0).setScrollFactor(0).setDepth(2060);
  objs.push(dim);
  sc.tweens.add({ targets: dim, fillAlpha: 0.7, duration: 250 });
  const top = sc.add.text(480, 200, word, { fontFamily: "Impact, sans-serif", fontSize: "70px", color: gore ? "#fbbf24" : "#fde047", stroke: "#000", strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(2061).setScale(3 * k).setAlpha(0);
  const big = sc.add.text(480, 280, "KRELTALITY!", { fontFamily: "Impact, sans-serif", fontSize: "96px", color: gore ? "#dc2626" : "#fde047", stroke: "#000", strokeThickness: 12 }).setOrigin(0.5).setScrollFactor(0).setDepth(2061).setScale(3 * k).setAlpha(0);
  const sub = sc.add.text(480, 350, "THE HERO PASSENGERS HAVE BEEN KRELTALISED", { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#fca5a5", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(2061).setScale(k).setAlpha(0);
  objs.push(top, big, sub);
  sc.tweens.add({ targets: top, scale: k, alpha: 1, duration: 260, ease: "Quad.out" });
  sc.time.delayedCall(220, () => {
    synth.play("vs_crash");
    synth.play("boom");
    if (!calm) cam.flash(160, 255, 220, 200);
    cam.shake(400, calm ? 0.01 : 0.025);
  });
  sc.tweens.add({ targets: big, scale: k, alpha: 1, duration: 300, delay: 220, ease: "Quad.out" });
  sc.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 600 });
  sc.tweens.add({ targets: big, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: calm ? 600 : 120, delay: 600 });
  synth.play("roar");
  await new Promise<void>((r) => sc.time.delayedCall(2700, () => r()));
  sc.tweens.add({ targets: objs, alpha: 0, duration: 400 });
  await new Promise<void>((r) => sc.time.delayedCall(420, () => r()));
  for (const o of objs) {
    sc.tweens.killTweensOf(o);
    o.destroy();
  }
}

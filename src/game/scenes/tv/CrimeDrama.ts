import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../../systems/tv";
import { G } from "../../G";
import { F, ShowDirector, type Perf, type Rect, type ShowHost } from "./ShowDirector";
import { registerDramaFaces } from "./dramaFaces";
import { goreDeath } from "../../gfx/GoreDeath";

/**
 * A prestige British crime drama (Gumption and Gravy). Shot the way those are: a cold open in the rain, letterboxed
 * and graded teal-and-sodium, a location card typed in the corner; off-centre singles with the room soft behind
 * them and a slow push on every face; inserts on the evidence (the gun, the wound, the bowl); a stinger on every
 * reveal; the shoot-out in slow motion; then the twist on a phone screen and the credits over black.
 *
 * Art: tv_gg_* sets and stills, tvface_GG_* close-ups (dramaFaces.ts).
 */

/** speaker -> close-up sheet */
const FACES: Record<string, string> = {
  "POLSON'S MUM": "GG SALLY",
  EDEN: "GG EDEN",
  "OFFICER 1": "GG OFFICER 1",
  "OFFICER 2": "GG OFFICER 2",
};
/** which third of the frame each of them plays on (they face each other across the cut) */
const SIDES: Record<string, number> = { "POLSON'S MUM": -0.55, EDEN: 0.55, "OFFICER 1": 0.5, "OFFICER 2": -0.5 };

const BLOOD = 0x6a0008;

export class CrimeDramaDirector extends ShowDirector {
  private titles = 0;
  private outside = true;
  /** the state of the room, for the wides */
  private st = { sally: false, kneel: false, eden: true, bowl: false, cops: false, sallyDead: false, edenDead: false, gone: false };
  private lineNo = 0;

  constructor(sc: Phaser.Scene, r: Rect, beats: TVBeat[], host: ShowHost, ep: TVEpisode) {
    super(sc, r, beats, host, ep);
    registerDramaFaces();
  }

  private get gore() {
    return G.meta.settings.gore !== false;
  }

  // ------------------------------------------------------------------ the look

  /** Letterbox, grade, vignette and grain: drawn once, on the graphics layer. */
  private look() {
    if (this.gfx.list.some((o) => o.getData?.("look"))) return;
    const { SX, SY, SW, SH } = this.r;
    const grade = this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0x0b2a33, 0.22).setOrigin(0).setData("look", true));
    grade.setBlendMode(Phaser.BlendModes.MULTIPLY);
    const v = this.over(this.sc.add.graphics().setData("look", true));
    for (let i = 0; i < 8; i++) {
      v.lineStyle(14, 0x000000, 0.07 + i * 0.012);
      v.strokeRect(SX + i * 9, SY + i * 9, SW - i * 18, SH - i * 18);
    }
    const grain = this.over(this.sc.add.graphics().setData("look", true));
    this.every(
      90,
      () => {
        grain.clear();
        for (let i = 0; i < 70; i++) {
          grain.fillStyle(Math.random() < 0.5 ? 0xffffff : 0x000000, 0.06);
          grain.fillRect(SX + Math.random() * SW, SY + Math.random() * SH, 2, 2);
        }
      },
      -1,
      true,
    );
    this.over(this.sc.add.rectangle(SX, SY, SW, 42, 0x000000).setOrigin(0).setData("look", true));
    this.over(this.sc.add.rectangle(SX, SY + SH - 42, SW, 42, 0x000000).setOrigin(0).setData("look", true));
  }

  /** A location card typed out in the corner, the way the genre does it. */
  private locationCard(a: string, b: string) {
    const { SX, SY } = this.r;
    const t1 = this.over(this.text(SX + 26, SY + 58, "", 15, "#e8e1c8", { fontFamily: "Courier New, monospace", fontStyle: "bold" }));
    const t2 = this.over(this.text(SX + 26, SY + 78, "", 12, "#b9c6c9", { fontFamily: "Courier New, monospace" }));
    let i = 0;
    this.every(
      55,
      () => {
        i++;
        t1.setText(a.slice(0, i));
        t2.setText(b.slice(0, Math.max(0, i - a.length)));
        if (i % 2) this.sfx("type");
      },
      a.length + b.length,
      true,
    );
    this.later(4200, () => this.sc.tweens.add({ targets: [t1, t2], alpha: 0, duration: 600, onComplete: () => [t1, t2].forEach((t) => t.destroy()) }), true);
  }

  private lounge(o: { zoom?: number; ox?: number; oy?: number; blur?: number; tint?: number } = {}) {
    return this.backdrop(this.tex("tv_gg_lounge"), { zoom: o.zoom ?? 1, ox: o.ox, oy: o.oy, blur: o.blur, tint: o.tint ?? (this.st.cops ? 0xc8d4ff : 0xd8d0c8) });
  }

  /** Blue lights through the nets once the police are here. */
  private blues(strength = 0.18) {
    const { SX, SY, SW, SH } = this.r;
    const b = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x2a5cff, 0).setOrigin(0));
    b.setBlendMode(Phaser.BlendModes.ADD);
    let on = false;
    this.every(260, () => {
      on = !on;
      b.setFillStyle(on ? 0x2a5cff : 0xff2a3a, on ? strength : strength * 0.45);
    });
  }

  // ------------------------------------------------------------------ titles

  protected onTitle(t: string): number {
    this.titles++;
    if (this.titles === 1) return this.titleSequence(t);
    return this.credits();
  }

  /** The titles: evidence flashes out of the dark, then the name, spaced and serif, and a sting. */
  private titleSequence(t: string): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const black = () => this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    black();
    const inserts: [string, number][] = [
      ["tv_gg_gun", 2.6],
      ["tv_gg_bowl0", 1.6],
      ["tv_gg_body", 1.4],
    ];
    inserts.forEach(([k, z], i) => {
      this.later(250 + i * 520, () => {
        if (!this.tex(k)) return;
        const img = this.add(this.sc.add.image(this.cx + (i - 1) * 40, this.cy, k).setScale(z).setTint(0xb02020).setAlpha(0.85));
        this.sc.tweens.add({ targets: img, scale: z * 1.12, alpha: 0, duration: 520 });
        this.sc.cameras.main.flash(60, 120, 0, 0);
      });
    });
    const [a, b] = t.split(/:\s*/);
    this.later(1900, () => {
      black();
      const words = a.split(" ");
      words.forEach((w, i) => {
        const tt = this.add(this.text(this.cx, this.cy - 40 + i * 36, w.split("").join(" "), 30, "#efe6cf", { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0));
        tt.setShadow(0, 0, "#7a0000", 10, true, true);
        this.sc.tweens.add({ targets: tt, alpha: 1, duration: 700, delay: i * 350 });
        this.sc.tweens.add({ targets: tt, scale: 1.06, duration: 3600, delay: i * 350 });
      });
      if (b) {
        const st = this.add(this.text(this.cx, this.cy + 76, b.toUpperCase(), 12, "#a33", { fontFamily: "Georgia, serif", fontStyle: "italic" }).setOrigin(0.5).setAlpha(0));
        this.sc.tweens.add({ targets: st, alpha: 1, duration: 900, delay: 1300 });
      }
      this.sfx("tv_sting");
    });
    return 5400;
  }

  /** End credits roll over black, the theme still going. */
  private credits(): number {
    this.clear();
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    const lines = [
      "GUMPTION AND GRAVY",
      "",
      "Sally Polson ........ POLSON'S MUM",
      "Eden ........ EDEN",
      "Polson ........ POLSON",
      "Officer 1 ........ HIMSELF",
      "Officer 2 ........ HERSELF",
      "The Bowl ........ THE BOWL",
      "",
      "The plants were not harmed.",
      "They have, however, lost their plant dad.",
      "",
      "NEXT TIME: JENKO",
    ];
    const rows = lines.map((l, i) => this.add(this.text(this.cx, SY + SH - 30 + i * 24, l, i === 0 || i === lines.length - 1 ? 18 : 13, i === lines.length - 1 ? "#c33" : "#e8e1c8", { fontFamily: "Georgia, serif", fontStyle: i === 0 ? "bold" : "normal" }).setOrigin(0.5, 0)));
    this.sc.tweens.add({ targets: rows, y: `-=${SH - 30 + lines.length * 24 - SH * 0.55}`, duration: 6400, ease: "Linear" });
    return 7000;
  }

  // ------------------------------------------------------------------ scenes

  protected onShot(set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    this.look();
    if (/EXT\./.test(set)) {
      this.outside = true;
      this.exterior();
      this.locationCard("POLSON TOWERS, KRELFORD", "23:47");
      return 2600;
    }
    this.outside = false;
    this.st.sally = false;
    this.wide({ push: 1.06 });
    return 600;
  }

  /** EXT. the house in the rain: a slow creep up the drive. */
  private exterior() {
    this.clear();
    this.kenBurns(this.tex("tv_gg_ext"), { z: 1.1, x: 0, y: 10 }, { z: 1.45, x: -20, y: 40 }, 6000);
    this.rain(52);
    this.sfx("amb_rain");
  }

  private rain(n: number) {
    const { SX, SY, SW, SH } = this.r;
    const rain = this.add(this.sc.add.graphics());
    this.every(70, () => {
      rain.clear();
      rain.lineStyle(1, 0xaebfd8, 0.4);
      for (let i = 0; i < n; i++) {
        const x = SX + Math.random() * SW;
        const y = SY + Math.random() * SH;
        rain.lineBetween(x, y, x - 3, y + 13);
      }
    });
  }

  /** Everyone in the room, as things stand. */
  private wide(o: { push?: number; blue?: boolean } = {}) {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    if (this.st.sallyDead) {
      // the aftermath, wide: death and dessert
      this.backdrop(this.tex("tv_gg_dead"), { tint: 0xa8b0d8 });
      if (this.st.cops) this.img("tv_gg_cops", SX + SW * 0.9, SY + SH * 0.98, 1.6);
      this.blues();
      this.push(o.push ?? 1.05, 5200, this.cx, SY + SH * 0.62);
      return;
    }
    this.lounge();
    const floor = SY + SH * 0.86;
    // the body, always there
    if (!this.st.sallyDead && !this.st.edenDead) {
      const b = this.img("tv_gg_body", SX + SW * 0.5, floor + 10, 1.25);
      if (b && this.gore) this.pool(b.x + 6, b.y - 6, 70, 1);
    }
    if (this.st.bowl && !this.st.sallyDead) this.bowlSprite(SX + SW * 0.5, floor - 2, 1.1);
    if (this.st.eden && !this.st.bowl && !this.st.edenDead) {
      const e = this.img("tv_gg_eden_body", SX + SW * 0.83, floor - 22, 1.35);
      if (e) this.breathe(e as unknown as Phaser.GameObjects.Sprite, 1900);
    }
    if (this.st.sally && !this.st.bowl && !this.st.sallyDead) {
      const s = this.img("tv_gg_sally_body", SX + SW * 0.2, floor - (this.st.kneel ? -26 : 0), 1.45);
      if (s) {
        if (this.st.kneel) s.setCrop(0, 0, s.width, s.height * 0.8);
        this.heave(s);
      }
    }
    if (this.st.cops) {
      const c = this.img("tv_gg_cops", SX + SW * 0.86, floor + 4, 1.6);
      if (c) c.setFlipX(false);
    }
    if (this.st.cops || o.blue) this.blues();
    this.push(o.push ?? 1.05, 5200, this.cx, SY + SH * 0.62);
  }

  private img(key: string, x: number, y: number, scale: number) {
    if (!this.tex(key)) return null;
    return this.add(this.sc.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale));
  }

  /** Breathing hard: the whole frame heaves. */
  private heave(s: Phaser.GameObjects.Image) {
    const sy = s.scaleY;
    this.sc.tweens.add({ targets: s, scaleY: sy * 1.025, scaleX: s.scaleX * 1.012, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /** A pool of blood that spreads. */
  private pool(x: number, y: number, w: number, grow: number) {
    const p = this.add(this.sc.add.ellipse(x, y, w, w * 0.28, BLOOD, 0.95));
    // multiplied into the carpet (and whatever's lying on it), so it soaks rather than sits on top
    p.setBlendMode(Phaser.BlendModes.MULTIPLY);
    p.setScale(grow < 1 ? 0.1 : 1);
    if (grow < 1) this.sc.tweens.add({ targets: p, scale: 1, duration: 2600, ease: "Sine.easeOut" });
    const sheen = this.add(this.sc.add.ellipse(x - w * 0.15, y - 3, w * 0.25, w * 0.05, 0xff6070, 0.35));
    void sheen;
    return p;
  }

  /** The bowl of fudge and Nutella, and the two of them at it (animated). */
  private bowlSprite(x: number, y: number, scale: number) {
    if (!this.tex("tv_gg_bowl")) return null;
    const s = this.add(this.sc.add.sprite(x, y, "tv_gg_bowl", 0).setOrigin(0.5, 1).setScale(scale));
    const n = this.sc.textures.get("tv_gg_bowl").frameTotal - 1;
    let f = 0;
    this.every(130, () => {
      f = (f + 1) % n;
      if (s.active) s.setFrame(f);
    });
    return s;
  }

  // ------------------------------------------------------------------ dialogue

  private cu(name: string, o: { expr?: number; side?: number; low?: boolean; recut?: boolean } = {}) {
    const key = FACES[name] ?? name;
    const p = this.single(key, { side: o.side ?? SIDES[name] ?? 0, bg: this.tex("tv_gg_lounge"), zoom: 1.6, blur: 3, recut: o.recut ?? true, expr: o.expr, bgTint: this.st.cops ? 0x9fb0e0 : 0xb8aca0 });
    if (!p) return null;
    if (o.low) {
      // shot from the floor: bigger, higher, looming
      p.scale *= 1.18;
      p.spr.setScale(p.scale);
    }
    if (this.st.cops) this.blues(0.12);
    return p;
  }

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (this.unseen(name)) return 0;
    this.lineNo++;
    const e = emotion.toLowerCase();
    let expr: number = F.NEUTRAL;
    if (/scream|shout/.test(e)) expr = F.ALARM;
    else if (/sneer|smug|indignant/.test(e)) expr = F.SPECIAL;
    else if (/grim/.test(e)) expr = F.SPECIAL;
    const stay = this.perf?.name === (FACES[name] ?? name) && this.lastSpeaker === name;
    const p = stay ? this.perf : this.cu(name, { expr, low: name === "POLSON'S MUM" && this.st.cops && /GUMPTION/.test(text) });
    if (!p) return 0;
    if (stay && expr !== F.NEUTRAL) this.setBase(expr);
    // the slow push: something terrible is about to be said
    this.push(stay ? 1.14 : 1.08, 4600, p.spr.x, p.spr.y - 240);
    if (/scream/.test(e) && /baby/i.test(text)) {
      // the scream: a pull out and up, like a crane
      this.cam.setScale(1.35);
      this.push(1.0, 2200, p.spr.x, p.spr.y - 240, "Quad.out");
      this.sfx("scream_woman");
    }
    if (/^drop the weapon/i.test(text)) this.sc.cameras.main.shake(300, 0.006);
    this.talk(p, name, text, emotion);
    return 0;
  }

  // ------------------------------------------------------------------ action

  protected onDirection(a: string): number {
    const { SX, SY, SW, SH } = this.r;
    if (/^Rain\./.test(a)) return 0;
    if (/pushes open the door/i.test(a)) {
      this.st.sally = false;
      this.wide({ push: 1.04 });
      this.sfx("dooropen");
      // she lumbers in from the left, heaving
      const s = this.img("tv_gg_sally_body", SX - 60, SY + SH * 0.86, 1.45);
      if (s) {
        this.heave(s);
        this.sc.tweens.add({ targets: s, x: SX + SW * 0.2, duration: 2600, ease: "Sine.easeOut" });
        this.sc.tweens.add({ targets: s, angle: { from: -3, to: 3 }, duration: 320, yoyo: true, repeat: 7 });
      }
      this.st.sally = true;
      this.locationCard("INT. POLSON'S LIVING ROOM", "Moments later");
      return 2400;
    }
    if (/She freezes, eyes wide/i.test(a)) {
      const p = this.cu("POLSON'S MUM", { expr: F.NEUTRAL, side: -0.4 });
      if (p) {
        this.push(1.2, 3200, p.spr.x, p.spr.y - 250);
        this.later(1700, () => this.setBase(F.ALARM));
      }
      return 2400;
    }
    if (/lies lifeless on the floor/i.test(a)) return this.bodyReveal();
    if (/handgun with "EDEN"/i.test(a)) return this.gunInsert();
    if (/drops to her knees/i.test(a)) {
      this.st.kneel = true;
      this.wide({ push: 1.12 });
      this.sc.cameras.main.shake(380, 0.014);
      this.sfx("bodies_land");
      return 1300;
    }
    if (/eyes dart frantically/i.test(a)) {
      // the eye-line: the wound, the gun, then her
      this.gunInsert(true);
      this.later(650, () => {
        const p = this.cu("EDEN", { expr: F.ALARM, side: 0.5 });
        if (p) this.push(1.15, 2600, p.spr.x, p.spr.y - 240);
        this.sfx("tv_sting");
      });
      return 2200;
    }
    if (/breath quickens/i.test(a)) {
      const p = this.cu("POLSON'S MUM", { side: -0.5 });
      if (p) {
        this.push(1.2, 3600, p.spr.x, p.spr.y - 250);
        this.sc.tweens.add({ targets: p.spr, scaleY: p.scale * 1.02, duration: 300, yoyo: true, repeat: 6 });
      }
      return 1200;
    }
    if (/suddenly seems to relax/i.test(a)) {
      const p = this.cu("EDEN", { expr: F.NEUTRAL });
      if (p) this.sc.tweens.add({ targets: p.spr, y: p.y + 6, duration: 260, yoyo: true, repeat: 2, delay: 500 });
      return 1200;
    }
    if (/cuts Eden off/i.test(a)) {
      this.cu("POLSON'S MUM");
      return 500;
    }
    if (/hurries to the kitchen/i.test(a)) return this.fetchBowl();
    if (/get down on all fours/i.test(a)) {
      this.st.bowl = true;
      this.st.eden = false;
      this.st.sally = false;
      return this.bowlShot(false);
    }
    if (/chomping and growling/i.test(a)) return this.bowlShot(true);
    if (/SIRENS/.test(a)) {
      this.bowlShot(true);
      this.blues(0.22);
      this.sfx("alarm");
      return 1600;
    }
    if (/POLICE OFFICERS burst/i.test(a)) {
      this.st.cops = true;
      this.wide({ push: 1.0 });
      this.sfx("door");
      this.sc.cameras.main.shake(200, 0.01);
      this.later(700, () => this.crash(1.5, SX + SW * 0.5, SY + SH * 0.84));
      this.later(720, () => this.sfx("tv_sting"));
      return 1800;
    }
    if (/traces of fudge/i.test(a)) {
      const p = this.cu("EDEN", { expr: F.NEUTRAL, side: 0.45 });
      if (p) this.push(1.3, 2400, p.spr.x, p.spr.y - 210);
      return 1500;
    }
    if (/scrambles to her feet/i.test(a)) {
      this.st.bowl = false;
      this.st.sally = true;
      this.st.kneel = false;
      this.st.eden = true;
      this.wide({ push: 1.0 });
      this.sc.cameras.main.shake(260, 0.01);
      const p = this.later(800, () => this.cu("POLSON'S MUM", { expr: F.ALARM, low: true }));
      void p;
      return 1500;
    }
    if (/exchange a glance/i.test(a)) return this.twoShot();
    if (/reaches for the gun/i.test(a)) return this.gunPull();
    if (/drawing their weapons/i.test(a)) {
      const p = this.cu("OFFICER 1", { expr: F.ALARM });
      if (p) this.playGesture(p, 0, 900);
      this.sfx("shell_casings");
      this.later(600, () => this.sfx("shell_casings"));
      return 1100;
    }
    if (/open fire/i.test(a)) return this.shootout();
    if (/Sally collapses/i.test(a)) {
      this.st.sallyDead = true;
      this.st.sally = false;
      this.st.edenDead = false;
      this.sfx("bodies_land");
      this.sc.cameras.main.shake(500, 0.02);
      return this.fall("tv_gg_sally_body", SX + SW * 0.62, 1.45);
    }
    if (/stares at Sally's lifeless body/i.test(a)) {
      const p = this.cu("EDEN", { expr: F.ALARM, side: 0.3 });
      if (p) {
        this.push(1.25, 3600, p.spr.x, p.spr.y - 230);
        this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 2, duration: 60, yoyo: true, repeat: -1 });
      }
      return 1800;
    }
    if (/turn their guns on Eden/i.test(a)) return this.edenShot();
    if (/grotesque tableau/i.test(a)) return this.tableau();
    if (/notification chimes/i.test(a)) {
      this.st.cops = true;
      this.wide({ push: 1.0 });
      this.sfx("notify");
      this.later(500, () => this.sfx("notify"));
      return 1500;
    }
    if (/^TEXT MESSAGE/i.test(a)) return this.phone(a);
    if (/knowing look/i.test(a)) {
      const p = this.cu("OFFICER 2", { expr: F.SPECIAL, side: -0.3 });
      if (p) this.push(1.15, 2000, p.spr.x, p.spr.y - 230);
      this.later(1500, () => {
        this.clear();
        this.backdrop(this.tex("tv_gg_dead"), { tint: 0x8a96c0 });
        if (this.gore) {
          this.pool(SX + SW * 0.42, SY + SH * 0.8, 120, 1);
          this.pool(SX + SW * 0.62, SY + SH * 0.84, 90, 1);
        }
        this.blues(0.16);
        this.sfx("door");
        this.push(1.12, 4000, this.cx, SY + SH * 0.7);
      });
      return 2600;
    }
    return 0;
  }

  /** The body: an overhead track along it, the pool spreading, a sting. */
  private bodyReveal(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.lounge({ zoom: 2.4, oy: -SH * 0.55, blur: 1 });
    const b = this.img("tv_gg_body", this.cx, SY + SH * 0.8, 2.3);
    if (b) {
      if (this.gore) {
        this.pool(this.cx + 10, SY + SH * 0.74, 200, 0);
        this.cam.bringToTop(b);
        // the wound
        const w = this.add(this.sc.add.ellipse(this.cx + 4, SY + SH * 0.62, 26, 14, 0x3a0004));
        void w;
      }
      this.cam.setPosition(-60, 0);
      this.sc.tweens.add({ targets: this.cam, x: 60, duration: 4200, ease: "Sine.easeInOut" });
    }
    void SX;
    void SW;
    this.sfx("tv_sting");
    return 3000;
  }

  /** The gun, macro: shiny, pink, smoking. */
  private gunInsert(quick = false): number {
    this.clear();
    const { SY, SH } = this.r;
    this.lounge({ zoom: 3, oy: -SH * 0.8, blur: 4 });
    if (this.gore) this.pool(this.cx - 80, SY + SH * 0.78, 220, 1);
    const g = this.img("tv_gg_gun", this.cx, SY + SH * 0.78, 4.2);
    if (g) {
      g.setOrigin(0.5);
      this.sc.tweens.add({ targets: g, scale: 4.6, duration: 3200 });
      // smoke curling from the barrel
      this.every(170, () => {
        const s = this.add(this.sc.add.circle(g.x - g.displayWidth * 0.42, g.y - g.displayHeight * 0.18, 5 + Math.random() * 5, 0xdddddd, 0.28));
        this.sc.tweens.add({ targets: s, y: s.y - 90, x: s.x + (Math.random() - 0.5) * 30, scale: 2.6, alpha: 0, duration: 1600, onComplete: () => s.destroy() });
      });
      // the diamante catching the light
      this.every(240, () => {
        const sp = this.add(this.sc.add.star(g.x + (Math.random() - 0.3) * g.displayWidth * 0.6, g.y + (Math.random() - 0.5) * g.displayHeight * 0.4, 4, 1, 5, 0xffffff, 0.9));
        this.sc.tweens.add({ targets: sp, alpha: 0, scale: 0.2, duration: 400, onComplete: () => sp.destroy() });
      });
    }
    if (!quick) this.sfx("tv_sting");
    return quick ? 600 : 2600;
  }

  private fetchBowl(): number {
    this.st.eden = false;
    this.st.sally = true;
    this.wide({ push: 1.04 });
    const { SX, SY, SW, SH } = this.r;
    const e = this.img("tv_gg_eden_body", SX + SW * 0.83, SY + SH * 0.86 - 22, 1.35);
    if (e) {
      this.sc.tweens.add({ targets: e, x: SX + SW + 80, duration: 900, ease: "Sine.easeIn" });
      this.later(1700, () => {
        e.setFlipX(true);
        const bowl = this.add(this.sc.add.ellipse(0, 0, 50, 18, 0x4a2412));
        const rim = this.add(this.sc.add.ellipse(0, -4, 50, 10, 0x6b3a1c));
        this.sc.tweens.add({ targets: e, x: SX + SW * 0.62, duration: 1100, ease: "Sine.easeOut" });
        const follow = () => {
          bowl.setPosition(e.x - 10, e.y - e.displayHeight * 0.45);
          rim.setPosition(bowl.x, bowl.y - 4);
        };
        this.every(16, follow, 120);
        this.later(1200, () => {
          this.sc.tweens.add({ targets: [bowl, rim], y: SY + SH * 0.86, duration: 400, ease: "Quad.in" });
          this.sfx("plate_smash");
        });
      });
    }
    return 3600;
  }

  /** The bowl: low on the carpet, the two of them in it. Growling. */
  private bowlShot(fight: boolean): number {
    this.clear();
    const { SY, SH } = this.r;
    this.lounge({ zoom: 1.9, oy: -SH * 0.42, blur: 2 });
    const s = this.bowlSprite(this.cx, SY + SH * 0.94, 2.1);
    this.sfx("slurp");
    if (fight && s) {
      this.handheld(1.6);
      this.every(900, () => {
        this.sfx(Math.random() < 0.5 ? "slurp" : "gurgle");
        if (Math.random() < 0.45) this.sc.tweens.add({ targets: s, x: s.x + (Math.random() - 0.5) * 16, duration: 90, yoyo: true, repeat: 2 });
      });
      // a cut-in on her: the snarl
      this.later(1300, () => {
        const p = this.cu("EDEN", { expr: F.SPECIAL, side: 0.3 });
        if (p) {
          this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 3, duration: 50, yoyo: true, repeat: 10 });
          this.sfx("roar");
        }
        this.later(800, () => this.bowlShot(false));
      });
      return 2600;
    }
    this.push(1.1, 3000, this.cx, SY + SH * 0.8);
    return 1500;
  }

  /** They look at each other: the officers, side by side, split. */
  private twoShot(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.lounge({ zoom: 1.6, blur: 3, tint: 0x9fb0e0 });
    const mk = (k: string, x: number, flip: boolean) => {
      if (!this.tex(k)) return;
      const s = this.add(this.sc.add.sprite(x, SY + SH + 6, k, 0).setOrigin(0.5, 1).setScale(2.6).setFlipX(flip));
      this.later(600, () => s.setFrame(F.BLINK));
      this.later(720, () => s.setFrame(0));
    };
    mk("tvface_GG_OFFICER_1", SX + SW * 0.28, false);
    mk("tvface_GG_OFFICER_2", SX + SW * 0.72, false);
    this.blues(0.12);
    this.push(1.06, 2400);
    return 1600;
  }

  /** She picks it up. The gun comes up into the lens. */
  private gunPull(): number {
    this.gunInsert(true);
    this.later(500, () => {
      const p = this.cu("GG SALLY GUN", { side: 0 });
      if (!p) return;
      p.gesturing = true;
      for (let i = 0; i < 8; i++) this.later(i * 140, () => p.spr.active && p.spr.setFrame(Math.min(7, i)));
      this.later(900, () => this.crash(1.25, p.spr.x, p.spr.y - 200));
      this.sfx("shell_casings");
      this.sfx("tv_sting");
    });
    return 2200;
  }

  /** Slow motion: the muzzle flashes, the hits, her shuddering. */
  private shootout(): number {
    const { SX, SY, SW, SH } = this.r;
    this.st.cops = true;
    this.wide({ push: 1.0 });
    const flashAt = (x: number, y: number, d: number) =>
      this.later(d, () => {
        this.fx("vfx_muzzle", x, y, { scale: 2, flipX: true });
        const f = this.add(this.sc.add.circle(x, y, 26, 0xfff2a0, 0.9));
        this.sc.tweens.add({ targets: f, alpha: 0, scale: 2, duration: 220, onComplete: () => f.destroy() });
        this.sfx(["pistol_indoor", "pistol_indoor_2", "pistol_indoor_3"][Math.floor(d / 300) % 3]);
        this.sc.cameras.main.flash(50, 255, 240, 200);
      });
    const gx = SX + SW * 0.74;
    const gy = SY + SH * 0.62;
    for (let i = 0; i < 5; i++) flashAt(gx + (i % 2) * 30, gy + (i % 2) * 8, 300 + i * 360);
    // the hits
    const sx = SX + SW * 0.22;
    for (let i = 0; i < 5; i++)
      this.later(360 + i * 360, () => {
        if (this.gore) this.fx("vfx_bloodspray", sx + (Math.random() - 0.5) * 30, SY + SH * 0.55 + (Math.random() - 0.5) * 50, { scale: 1.6, flipX: true });
        else this.fx("vfx_hit", sx, SY + SH * 0.55, { scale: 1.4 });
      });
    // slow motion: the frame drifts in and everything goes quiet but the shots
    this.push(1.18, 2400, SX + SW * 0.45, SY + SH * 0.6);
    return 2400;
  }

  /** Someone goes down: their figure topples out of frame and the floor shakes. */
  private fall(key: string, x: number, scale: number): number {
    this.clear();
    const { SY, SH } = this.r;
    this.lounge({ tint: 0x9fb0e0 });
    const s = this.img(key, x, SY + SH * 0.86, scale);
    if (s) {
      s.setOrigin(0.5, 1);
      // the last rounds, the knees, the slump, down (gfx/GoreDeath.ts; it shakes the floor and bleeds out itself)
      goreDeath(this.sc, s, "shot", { dir: -1, hits: 2, gap: 160, quiet: true });
      this.later(1300, () => this.sc.cameras.main.shake(300, 0.018));
    }
    this.blues(0.14);
    this.push(1.08, 2000, x, SY + SH * 0.7);
    return 1900;
  }

  private edenShot(): number {
    const p = this.cu("EDEN", { expr: F.ALARM, side: 0 });
    if (p) this.push(1.3, 1400, p.spr.x, p.spr.y - 230, "Quad.in");
    for (let i = 0; i < 3; i++)
      this.later(800 + i * 260, () => {
        this.sfx("pistol_indoor");
        this.sc.cameras.main.flash(70, 255, 255, 255);
        if (i === 2) this.black();
      });
    return 2200;
  }

  /** Death and dessert: the crane pulls up off the two of them. */
  private tableau(): number {
    this.st.edenDead = true;
    this.clear();
    const { SY, SH } = this.r;
    this.backdrop(this.tex("tv_gg_dead"), { zoom: 1.25, oy: -30, tint: 0x8a96c0 });
    if (this.gore) {
      // it spreads out from under them, into the fudge
      this.pool(this.cx - 70, SY + SH * 0.78, 190, 0);
      this.pool(this.cx + 80, SY + SH * 0.84, 140, 0);
    }
    this.cam.setScale(1.5);
    this.push(1.0, 5200, this.cx, SY + SH * 0.8, "Sine.easeOut");
    this.blues(0.12);
    this.sfx("tv_sting");
    return 3600;
  }

  /** The twist: a text on the officers' phones. */
  private phone(a: string): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.lounge({ zoom: 2.2, blur: 5, tint: 0x6070a0 });
    const m = a.match(/from "([^"]+)":\s*(.+)$/i);
    const from = m?.[1] ?? "Drongus B. Drippin'";
    const msg = m?.[2] ?? a;
    const ph = this.add(this.sc.add.container(this.cx, SY + SH * 0.56));
    ph.add(this.sc.add.rectangle(0, 0, 220, 360, 0x111111).setStrokeStyle(4, 0x333333));
    ph.add(this.sc.add.rectangle(0, 0, 200, 320, 0xf2f2f6));
    ph.add(this.sc.add.rectangle(0, -140, 200, 40, 0xe2e2ea));
    ph.add(this.text(0, -140, from, 13, "#111111", { fontStyle: "bold" }).setOrigin(0.5));
    ph.add(this.sc.add.circle(-82, -140, 12, 0xffd23f));
    const bubble = this.sc.add.rectangle(-90, -80, 170, 70, 0xdedee6).setOrigin(0, 0).setAlpha(0);
    const t = this.text(-82, -72, "", 13, "#111111", { wordWrap: { width: 150 } }).setOrigin(0, 0);
    ph.add([bubble, t]);
    // a hand holding it: it trembles a hair
    this.sc.tweens.add({ targets: ph, y: ph.y - 3, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const dots = this.text(-70, -72, "• • •", 16, "#666666");
    ph.add(dots);
    this.later(700, () => {
      dots.destroy();
      bubble.setAlpha(1);
      this.sfx("notify");
      let i = 0;
      this.every(45, () => t.setText(msg.slice(0, ++i)), msg.length);
    });
    this.later(700 + msg.length * 45 + 300, () => this.crash(1.5, this.cx, SY + SH * 0.56 - 80));
    this.later(700 + msg.length * 45 + 320, () => this.sfx("tv_sting"));
    void SX;
    void SW;
    return 1200 + msg.length * 45 + 1400;
  }

  protected onTransition(mode: string): number {
    if (mode === "fade") {
      const { SX, SY, SW, SH } = this.r;
      const b = this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0).setOrigin(0));
      this.sc.tweens.add({ targets: b, fillAlpha: 1, duration: 1800 });
      return 2000;
    }
    return super.onTransition(mode);
  }

  protected onMusic(): number {
    return 0;
  }
}

export type { Perf };

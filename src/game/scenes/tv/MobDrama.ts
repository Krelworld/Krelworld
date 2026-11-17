import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../../systems/tv";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { F, ShowDirector, type Rect, type ShowHost } from "./ShowDirector";
import { registerDramaFaces } from "./dramaFaces";

/**
 * A prestige New Jersey mob drama (The Sopranos, krews_soprano in dramas.ts). Shot the way the show is: the title
 * over black, the house at night with the location typed in the corner, then the living room in warm lamplight;
 * shot / reverse shot across the couch (Tony on the right looking left, Carmela on the left looking right, at the
 * telly), a slow push on the man as the rage comes up, the cartoon on the TV as an insert, the brick, the dark,
 * the chicken piccata, and then a hard cut to black and silence.
 *
 * Art: tv_k4_lounge (the living room), sop_* stills and figures, tvface_SOP_TONY / tvface_SOP_CARMELA (dramaFaces.ts;
 * Carmela's frame 7 is her face after the piccata).
 */

const FACES: Record<string, string> = { "TONY SOPRANO": "SOP TONY", "CARMELA SOPRANO": "SOP CARMELA" };
const SIDES: Record<string, number> = { "TONY SOPRANO": 0.5, "CARMELA SOPRANO": -0.5 };
/** Carmela's face after the plate */
const SAUCED = 7;

/** Where things are in the living room (fractions of tv_k4_lounge, 320x240). */
const ROOM = {
  tv: { x: 0.833, y: 0.365, w: 0.166, h: 0.188 },
  fire: { x: 0.21, y: 0.4 },
  couch: { x: 0.37, y: 0.73 },
  plate: { x: 0.6, y: 0.735 },
};

const SAUCE = [0xf6d860, 0xe0b23a, 0xfff3b0, 0x8aa63a];

export class MobDramaDirector extends ShowDirector {
  private titles = 0;
  private st = { tony: false, tvBroken: false, dark: false, sparked: false };
  private room?: Phaser.GameObjects.Image;

  constructor(sc: Phaser.Scene, r: Rect, beats: TVBeat[], host: ShowHost, ep: TVEpisode) {
    super(sc, r, beats, host, ep);
    registerDramaFaces();
  }

  private get calm() {
    return !!G.meta.settings.calmFlash;
  }

  private get gore() {
    return G.meta.settings.gore !== false;
  }

  // ------------------------------------------------------------------ the look

  /** Film: a warm grade, a soft vignette and grain, drawn once on the graphics layer. */
  private look() {
    if (this.gfx.list.some((o) => o.getData?.("look"))) return;
    const { SX, SY, SW, SH } = this.r;
    const grade = this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0x3a2410, 0.18).setOrigin(0).setData("look", true));
    grade.setBlendMode(Phaser.BlendModes.MULTIPLY);
    const v = this.over(this.sc.add.graphics().setData("look", true));
    for (let i = 0; i < 8; i++) {
      v.lineStyle(14, 0x000000, 0.06 + i * 0.012);
      v.strokeRect(SX + i * 9, SY + i * 9, SW - i * 18, SH - i * 18);
    }
    const grain = this.over(this.sc.add.graphics().setData("look", true));
    this.every(
      90,
      () => {
        grain.clear();
        for (let i = 0; i < 60; i++) {
          grain.fillStyle(Math.random() < 0.5 ? 0xffffff : 0x000000, 0.05);
          grain.fillRect(SX + Math.random() * SW, SY + Math.random() * SH, 2, 2);
        }
      },
      -1,
      true,
    );
  }

  /** The location, typed in the bottom corner in white. */
  private locationCard(a: string, b: string) {
    const { SX, SY, SH } = this.r;
    const t1 = this.over(this.text(SX + 26, SY + SH - 74, "", 15, "#f4efe4", { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "bold" }));
    const t2 = this.over(this.text(SX + 26, SY + SH - 52, "", 12, "#d9cfbf", { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }));
    let i = 0;
    this.every(
      50,
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

  // ------------------------------------------------------------------ titles

  protected onTitle(t: string): number {
    this.titles++;
    return this.titles === 1 ? this.titleCard(t) : this.credits();
  }

  /** THE SOPRANOS over black: the letters fade up out of the dark, the R a pistol. */
  private titleCard(t: string): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    const word = t.replace(/^THE\s+/i, "").toUpperCase();
    const at = word.indexOf("R");
    const style = { fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif", fontStyle: "bold" };
    const the = this.add(this.text(this.cx, this.cy - 52, "THE", 18, "#cfcfcf", style).setOrigin(0.5).setAlpha(0));
    the.setLetterSpacing?.(6);
    const row = this.add(this.sc.add.container(this.cx, this.cy + 4).setAlpha(0));
    const parts = at > 0 ? [word.slice(0, at), word.slice(at + 1)] : [word, ""];
    const left = this.text(0, 0, parts[0], 46, "#e8e8e8", style).setOrigin(0, 0.5);
    const right = this.text(0, 0, parts[1], 46, "#e8e8e8", style).setOrigin(0, 0.5);
    const gunW = at > 0 ? 34 : 0;
    const total = left.width + gunW + right.width;
    left.setX(-total / 2);
    right.setX(-total / 2 + left.width + gunW);
    row.add([left, right]);
    if (at > 0) {
      // the R: a pistol, grip down, barrel out to the right, in the letters' grey
      const g = this.sc.add.graphics();
      const x0 = -total / 2 + left.width + 4;
      g.fillStyle(0xe8e8e8, 1);
      g.fillRect(x0, -20, 7, 40);
      g.fillRect(x0, -20, 24, 8);
      g.fillRect(x0 + 18, -20, 6, 4);
      g.fillRect(x0 + 6, -12, 10, 8);
      g.fillTriangle(x0 + 7, -4, x0 + 26, 20, x0 + 16, 20);
      g.lineStyle(2, 0xe8e8e8, 1).strokeCircle(x0 + 15, -3, 4);
      row.add(g);
    }
    this.sc.tweens.add({ targets: the, alpha: 1, duration: 900, delay: 300 });
    this.sc.tweens.add({ targets: row, alpha: 1, duration: 1400, delay: 700 });
    this.sc.tweens.add({ targets: row, scale: 1.05, duration: 4200, delay: 700 });
    this.later(3900, () => this.sc.tweens.add({ targets: [the, row], alpha: 0, duration: 700 }));
    return 4700;
  }

  /** The end: credits over black, in silence. */
  private credits(): number {
    this.clear();
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    synth.stopMusic();
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    const lines = [
      "THE SOPRANOS",
      "",
      "Tony Soprano ........ TONY SOPRANO",
      "Carmela Soprano ........ CARMELA SOPRANO",
      "The Decorative Brick ........ ITSELF",
      "Chicken Piccata ........ CHICKEN PICCATA",
      "",
      "One television was harmed.",
      "The enlargement remains under discussion.",
    ];
    const rows = lines.map((l, i) => this.add(this.text(this.cx, SY + SH - 20 + i * 24, l, i === 0 ? 20 : 13, "#e8e8e8", { fontFamily: i === 0 ? "'Arial Black', Arial, sans-serif" : "Georgia, serif", fontStyle: i === 0 ? "bold" : "normal" }).setOrigin(0.5, 0)));
    this.sc.tweens.add({ targets: rows, y: `-=${SH - 20 + lines.length * 24 - SH * 0.6}`, duration: 6000, ease: "Linear" });
    return 6600;
  }

  // ------------------------------------------------------------------ the room

  /** A point in the living room, on screen (wherever the room picture currently sits). */
  private pt(fx: number, fy: number) {
    const bg = this.room;
    if (!bg) return { x: this.r.SX + fx * this.r.SW, y: this.r.SY + fy * this.r.SH, s: this.r.SW / 320 };
    return { x: bg.x + (fx - 0.5) * bg.displayWidth, y: bg.y + (fy - 0.5) * bg.displayHeight, s: bg.displayWidth / 320 };
  }

  private lounge(o: { zoom?: number; ox?: number; oy?: number; blur?: number } = {}) {
    this.room = this.backdrop(this.tex("tv_k4_lounge"), { zoom: o.zoom ?? 1, ox: o.ox, oy: o.oy, blur: o.blur, tint: this.st.dark ? 0x5a6488 : 0xfff0dc });
    this.screen();
    return this.room;
  }

  /** What's on the telly: the cartoon (flickering), or after the brick, a black hole with cracks. */
  private screen(big = false) {
    const k = ROOM.tv;
    const c = this.pt(k.x, k.y);
    const w = k.w * 320 * c.s;
    const h = k.h * 320 * 0.75 * c.s;
    if (this.st.tvBroken) {
      this.add(this.sc.add.rectangle(c.x, c.y, w, h, 0x050505, 0.95));
      const g = this.add(this.sc.add.graphics());
      g.lineStyle(Math.max(1, c.s * 0.8), 0xc8ccd4, 0.85);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        g.lineBetween(c.x, c.y, c.x + Math.cos(a) * w * 0.5, c.y + Math.sin(a) * h * 0.5);
      }
      g.strokeCircle(c.x, c.y, Math.min(w, h) * 0.18);
      return null;
    }
    if (!this.tex("sop_cartoon")) return null;
    const img = this.add(this.sc.add.image(c.x, c.y, "sop_cartoon").setDisplaySize(w, h));
    // the glow off the screen, and the cartoon's cuts
    const glow = this.add(this.sc.add.rectangle(c.x, c.y, w * 1.6, h * 1.6, 0x9ad0ff, 0.1).setBlendMode(Phaser.BlendModes.ADD));
    this.every(big ? 300 : 420, () => {
      if (!img.active) return;
      img.setFlipX(Math.random() < 0.3 ? !img.flipX : img.flipX);
      glow.setAlpha(0.06 + Math.random() * 0.12);
    });
    return img;
  }

  /** Carmela on the couch, watching. */
  private carmelaSeat() {
    const p = this.pt(ROOM.couch.x, ROOM.couch.y);
    if (!this.tex("sop_carmela_seat")) return null;
    const s = this.add(this.sc.add.image(p.x, p.y, "sop_carmela_seat").setOrigin(0.5, 1).setScale(p.s * 0.82));
    if (this.st.dark) s.setTint(0x6a7090);
    this.breathe(s as unknown as Phaser.GameObjects.Sprite, 1900);
    return s;
  }

  private tonyFig(key: "sop_tony_body" | "sop_tony_brick", fx: number) {
    if (!this.tex(key)) return null;
    const { SY, SH } = this.r;
    const p = this.pt(fx, 0.5);
    const s = this.add(this.sc.add.image(p.x, SY + SH + 8, key).setOrigin(0.5, 1).setScale(p.s * 1.4));
    if (this.st.dark) s.setTint(0x6a7090);
    return s;
  }

  /** The living room, wide, as things stand. */
  private wide(push = 1.05) {
    this.clear();
    this.lounge();
    this.carmelaSeat();
    if (this.st.tony) this.tonyFig("sop_tony_body", 0.16);
    if (this.st.dark) this.darkness();
    this.push(push, 5200, this.cx, this.cy + 20);
  }

  /** The lights are out: only the moon through the window. */
  private darkness(alpha = 0.55) {
    const { SX, SY, SW, SH } = this.r;
    return this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x05060f, alpha).setOrigin(0));
  }

  // ------------------------------------------------------------------ scenes

  protected onShot(set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    this.look();
    if (/EXT\./.test(set)) {
      this.clear();
      this.kenBurns(this.tex("sop_house_ext"), { z: 1.05, x: 0, y: 0 }, { z: 1.3, x: -30, y: 20 }, 6000);
      this.later(3400, () => {
        const w = this.add(this.sc.add.rectangle(this.r.SX, this.r.SY, this.r.SW, this.r.SH, 0x000000, 0).setOrigin(0));
        this.sc.tweens.add({ targets: w, fillAlpha: 1, duration: 600 });
      });
      return 3800;
    }
    this.wide(1.04);
    this.locationCard("OPENING SCENE", "The Soprano Household — Night");
    return 1200;
  }

  // ------------------------------------------------------------------ dialogue

  private cu(name: string, o: { expr?: number; side?: number } = {}) {
    const p = this.single(FACES[name] ?? name, { side: o.side ?? SIDES[name] ?? 0, bg: this.tex("tv_k4_lounge"), zoom: 1.6, blur: 3, recut: true, expr: o.expr, bgTint: this.st.dark ? 0x3a4060 : 0xc8b8a0 });
    if (!p) return null;
    if (this.st.dark) {
      p.spr.setTint(0x8890b8);
      this.darkness(0.25);
    } else if (name === "CARMELA SOPRANO") {
      // the telly lights her
      const g = this.add(this.sc.add.rectangle(this.r.SX, this.r.SY, this.r.SW, this.r.SH, 0x6aa8ff, 0.06).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
      this.every(380, () => g.active && g.setAlpha(0.03 + Math.random() * 0.08));
    }
    return p;
  }

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (this.unseen(name)) return 0;
    // after the sparks the lights are out, even if the shot that put them out was skipped
    if (this.st.sparked) this.st.dark = true;
    const e = emotion.toLowerCase();
    const expr = /scream/.test(e) ? F.ALARM : F.NEUTRAL;
    const p = this.cu(name, { expr });
    if (!p) return 0;
    this.push(1.08, 4600, p.spr.x, p.spr.y - 240);
    if (/scream/.test(e)) this.sc.cameras.main.shake(this.calm ? 0 : 260, 0.006);
    this.talk(p, name, text, emotion);
    return 0;
  }

  // ------------------------------------------------------------------ action

  protected onDirection(a: string): number {
    if (this.st.sparked) this.st.dark = true;
    if (/walks into the living room/i.test(a)) return this.entrance();
    if (/doesn't even glance away/i.test(a)) {
      const p = this.cu("CARMELA SOPRANO", { side: -0.5 });
      if (p) this.push(1.06, 2400, p.spr.x, p.spr.y - 240);
      return 1700;
    }
    if (/glares at the screen/i.test(a)) return this.glare();
    if (/decorative brick/i.test(a)) return this.brick();
    if (/Sparks fly/i.test(a)) return this.sparks();
    if (/grabs her by the hair/i.test(a)) return this.shove();
    if (/muffled shriek/i.test(a)) return this.sauced();
    return 0;
  }

  /** Tony comes in from the hall, beer in hand, belly first. */
  private entrance(): number {
    this.st.tony = false;
    this.wide(1.03);
    const { SX } = this.r;
    const t = this.tonyFig("sop_tony_body", 0.16);
    if (t) {
      const to = t.x;
      t.setX(SX - 90);
      this.sc.tweens.add({ targets: t, x: to, duration: 2400, ease: "Sine.easeOut" });
      // the walk: a heavy sway
      this.sc.tweens.add({ targets: t, angle: { from: -2.5, to: 2.5 }, y: t.y - 4, duration: 300, yoyo: true, repeat: 3, ease: "Sine.easeInOut" });
    }
    this.st.tony = true;
    this.sfx("dooropen");
    return 2800;
  }

  /** He looks at the telly; the telly, close; the rage comes up. */
  private glare(): number {
    const p = this.cu("TONY SOPRANO", { expr: F.SPECIAL, side: 0.45 });
    if (p) this.push(1.15, 1600, p.spr.x, p.spr.y - 250);
    // (each cut clears the timers, so every next shot is booked from inside the one before it)
    this.later(1300, () => {
      this.cartoon();
      this.later(3000, () => this.rage());
    });
    return 7400;
  }

  /** Back on him, the slow push, and it boils over. */
  private rage() {
    const q = this.cu("TONY SOPRANO", { expr: F.SPECIAL, side: 0 });
    if (!q) return;
    this.sfx("drone");
    // the slow push in as it boils up, a red pulse, then the face goes
    this.push(1.3, 2600, q.spr.x, q.spr.y - 250, "Sine.easeIn");
    const red = this.add(this.sc.add.rectangle(this.r.SX, this.r.SY, this.r.SW, this.r.SH, 0xb00000, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY));
    this.sc.tweens.add({ targets: red, fillAlpha: 0.35, duration: this.calm ? 2400 : 600, yoyo: !this.calm, repeat: this.calm ? 0 : 2 });
    this.later(1700, () => this.setBase(F.ALARM));
    this.later(1700, () => this.sc.tweens.add({ targets: q.spr, x: q.spr.x + 2, duration: 50, yoyo: true, repeat: 12 }));
  }

  /** The cartoon, filling the frame: the fat dad laughing his head off, the green cloud, the wife. */
  private cartoon() {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x0a0a0a).setOrigin(0));
    if (!this.tex("sop_cartoon")) return;
    const img = this.add(this.sc.add.image(this.cx, this.cy, "sop_cartoon"));
    img.setScale(Math.min((SW * 0.86) / img.width, (SH * 0.82) / img.height));
    // the laughing: he shakes
    this.sc.tweens.add({ targets: img, y: img.y + 4, duration: 90, yoyo: true, repeat: 14 });
    // a CRT: scanlines and a curved dark edge
    const g = this.add(this.sc.add.graphics());
    g.fillStyle(0x000000, 0.18);
    for (let y = SY; y < SY + SH; y += 4) g.fillRect(SX, y, SW, 2);
    g.lineStyle(26, 0x000000, 0.5).strokeRoundedRect(this.cx - img.displayWidth / 2, this.cy - img.displayHeight / 2, img.displayWidth, img.displayHeight, 28);
    // the cloud
    for (let i = 0; i < 6; i++)
      this.later(250 + i * 140, () => {
        const c = this.add(this.sc.add.circle(this.cx + (Math.random() - 0.5) * 60, this.cy + 60, 16 + Math.random() * 14, 0x7ddc5a, 0.5));
        this.sc.tweens.add({ targets: c, y: c.y - 70, scale: 2.2, alpha: 0, duration: 1300, onComplete: () => c.destroy() });
      });
    this.sfx("fart_2");
    this.push(1.06, 2800);
  }

  /** The brick: he takes it off the hearth and lets it go. */
  private brick(): number {
    this.clear();
    this.lounge();
    this.carmelaSeat();
    const t = this.tonyFig("sop_tony_brick", 0.2);
    if (t) {
      t.setScale(t.scaleX * 0.95);
      this.sc.tweens.add({ targets: t, angle: -4, duration: 700, ease: "Sine.easeOut" });
    }
    const tv = this.pt(ROOM.tv.x, ROOM.tv.y);
    this.later(1300, () => {
      if (t) {
        t.setAngle(6);
        this.sfx("swing");
      }
      const from = t ? { x: t.x - t.displayWidth * 0.32, y: t.y - t.displayHeight * 0.92 } : { x: this.r.SX + 80, y: tv.y };
      const b = this.add(this.sc.add.rectangle(from.x, from.y, 22, 11, 0xa8402a).setStrokeStyle(2, 0x3a1206));
      this.sc.tweens.add({
        targets: b,
        x: tv.x,
        y: tv.y,
        angle: 760,
        scale: 0.7,
        duration: 480,
        ease: "Quad.in",
        onComplete: () => {
          b.destroy();
          this.st.tvBroken = true;
          this.impact(tv.x, tv.y);
        },
      });
    });
    this.push(1.04, 2400);
    return 2600;
  }

  /** The screen goes in: a flash, the bang, glass and sparks. */
  private impact(x: number, y: number) {
    this.sfx("smash");
    this.sfx("monitor_crack");
    // the dead screen, over the cartoon
    this.screen();
    const f = this.add(this.sc.add.circle(x, y, 60, 0xffffff, this.calm ? 0.25 : 0.9).setBlendMode(Phaser.BlendModes.ADD));
    this.sc.tweens.add({ targets: f, scale: 2.4, alpha: 0, duration: 380, onComplete: () => f.destroy() });
    this.sparkBurst(x, y, 16);
    if (!this.calm) this.sc.cameras.main.shake(320, 0.01);
  }

  private sparkBurst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.add(this.sc.add.rectangle(x, y, 3, 3, i % 3 ? 0xfde047 : 0xffffff).setBlendMode(Phaser.BlendModes.ADD));
      this.sc.tweens.add({ targets: s, x: x + (Math.random() - 0.5) * 220, y: y + Math.random() * 160 - 40, alpha: 0, duration: 600 + Math.random() * 600, ease: "Quad.out", onComplete: () => s.destroy() });
    }
    this.fx("vfx_sparks", x, y, { scale: 1.6, add: true });
  }

  /** Close on the telly, sparking; her scream; the lights go. */
  private sparks(): number {
    // (skipped through the brick? the set's gone all the same)
    this.st.tvBroken = true;
    this.st.sparked = true;
    this.clear();
    const tv = ROOM.tv;
    this.lounge({ zoom: 3, ox: (0.5 - tv.x) * this.r.SW * 3, oy: (0.5 - tv.y) * this.r.SH * 3 });
    const c = this.pt(tv.x, tv.y);
    this.sfx("zap");
    this.sparkBurst(c.x, c.y, 22);
    this.every(this.calm ? 700 : 260, () => {
      this.sparkBurst(c.x + (Math.random() - 0.5) * 60, c.y + (Math.random() - 0.5) * 40, 6);
      if (Math.random() < 0.5) this.sfx("zap");
    }, 5);
    // smoke out of the set
    this.every(200, () => {
      const s = this.add(this.sc.add.circle(c.x + (Math.random() - 0.5) * 50, c.y - 20, 8 + Math.random() * 8, 0x666666, 0.3));
      this.sc.tweens.add({ targets: s, y: s.y - 90, scale: 2.4, alpha: 0, duration: 1500, onComplete: () => s.destroy() });
    }, 12);
    this.later(1700, () => {
      const p = this.cu("CARMELA SOPRANO", { expr: F.ALARM, side: -0.3 });
      this.sfx("scream_woman");
      if (p) {
        this.crash(1.18, p.spr.x, p.spr.y - 240);
        this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 3, duration: 55, yoyo: true, repeat: 10 });
      }
      this.later(1500, () => {
        // the room goes dark
        this.st.dark = true;
        this.sfx("tv_doof");
        const d = this.darkness(0);
        this.sc.tweens.add({ targets: d, fillAlpha: 0.75, duration: this.calm ? 900 : 260 });
        if (p) p.spr.setTint(0x8890b8);
      });
    });
    return 4400;
  }

  /** In the dark he's over the couch; then the plate, steaming; then her face goes into it. */
  private shove(): number {
    this.clear();
    this.lounge();
    const seat = this.carmelaSeat();
    const t = this.tonyFig("sop_tony_body", 0.16);
    this.darkness(0.35);
    if (t && seat) this.sc.tweens.add({ targets: t, x: seat.x + seat.displayWidth * 0.55, duration: 700, ease: "Quad.out" });
    this.later(900, () => {
      // the plate, close, still steaming
      this.clear();
      this.lounge({ zoom: 3.2, ox: (0.5 - ROOM.plate.x) * this.r.SW * 3.2, oy: (0.5 - ROOM.plate.y) * this.r.SH * 3.2 });
      this.darkness(0.4);
      if (this.tex("sop_piccata")) this.add(this.sc.add.image(this.cx, this.cy + 40, "sop_piccata").setScale(3.1).setTint(0xb8b8d8));
      this.steam(this.cx, this.cy - 60);
      this.push(1.08, 1400);
      this.later(1300, () => {
        // the shove
        this.clear();
        this.backdrop(this.tex("sop_shove"), { zoom: 1.08, tint: 0x9aa0c8 });
        this.crash(1.12, this.cx + 40, this.cy + 20);
        this.sfx("splat_1");
        this.sfx("plate_smash");
        if (!this.calm) this.sc.cameras.main.shake(420, 0.014);
        this.splatter(this.cx + 30, this.cy + 40, this.gore ? 34 : 14);
      });
    });
    return 4400;
  }

  private steam(x: number, y: number) {
    this.every(160, () => {
      const s = this.add(this.sc.add.ellipse(x + (Math.random() - 0.5) * 120, y, 14, 22, 0xffffff, 0.22));
      this.sc.tweens.add({ targets: s, y: y - 120, scaleX: 2, alpha: 0, duration: 1600, onComplete: () => s.destroy() });
    });
  }

  /** Lemon-caper sauce everywhere (cartoon blobs, a few landing on the lens). */
  private splatter(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.add(this.sc.add.circle(x, y, 2 + Math.random() * 4, SAUCE[i % SAUCE.length]));
      const a = Math.random() * Math.PI * 2;
      const d = 80 + Math.random() * 220;
      this.sc.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 60, duration: 500 + Math.random() * 400, ease: "Quad.out" });
    }
    const lens = Math.min(3, Math.floor(n / 10));
    for (let i = 0; i < lens; i++)
      this.later(120 + i * 70, () => {
        const b = this.over(this.sc.add.ellipse(this.r.SX + 60 + Math.random() * (this.r.SW - 120), this.r.SY + 40 + Math.random() * (this.r.SH - 80), 22 + Math.random() * 26, 18 + Math.random() * 22, SAUCE[i % 2], 0.6));
        this.sc.tweens.add({ targets: b, y: b.y + 50, scaleY: 1.3, duration: 2600, ease: "Sine.in" });
        this.later(3600, () => b.destroy(), true);
      });
  }

  /** Her face, after: sauce, capers and a muffled shriek. */
  private sauced(): number {
    const p = this.cu("CARMELA SOPRANO", { side: -0.2 });
    if (!p) return 2000;
    p.base = SAUCED;
    p.spr.setFrame(SAUCED);
    this.sfx("shriek");
    this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 3, duration: 60, yoyo: true, repeat: 16 });
    this.push(1.1, 2600, p.spr.x, p.spr.y - 230);
    // it drips
    this.every(240, () => {
      const d = this.add(this.sc.add.circle(p.spr.x + (Math.random() - 0.5) * 120, p.spr.y - 230 + Math.random() * 60, 3 + Math.random() * 3, SAUCE[Math.floor(Math.random() * 3)]));
      this.sc.tweens.add({ targets: d, y: d.y + 140, alpha: 0, duration: 1100, ease: "Quad.in", onComplete: () => d.destroy() });
    }, 12);
    this.splatter(p.spr.x, p.spr.y - 250, 10);
    return 3000;
  }

  /** The cut to black: no fade, no music, nothing. */
  protected onTransition(mode: string): number {
    if (mode === "cut") {
      this.clearGfx();
      this.black();
      synth.stopMusic();
      return 2600;
    }
    if (mode === "fade") {
      const { SX, SY, SW, SH } = this.r;
      const b = this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0).setOrigin(0));
      this.sc.tweens.add({ targets: b, fillAlpha: 1, duration: 1600 });
      return 1800;
    }
    return super.onTransition(mode);
  }

  protected onMusic(): number {
    return 0;
  }
}

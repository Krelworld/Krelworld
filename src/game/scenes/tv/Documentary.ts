import Phaser from "phaser";
import { F, ShowDirector, type Perf } from "./ShowDirector";

/**
 * A serious documentary (Krelworld Documentaries). The narrator speaks over slow moves across stills, archive
 * photographs (sepia, scratched) and landscapes, never quite holding still; the interviewees sit off-centre in a
 * dim room, looking just past the lens, with their name and what they are under them the first time they speak.
 * Chapter cards are white on black. The Creation Myth is a dramatised reconstruction: hand-held, lantern-lit, in
 * a cave, with a RECONSTRUCTION bug in the corner.
 */

interface Still {
  re: RegExp;
  key: string;
  from: [number, number, number];
  to: [number, number, number];
  archive?: boolean;
  /** a face, as a photograph pinned up (an archive "portrait") */
  portrait?: string;
}

const KRONSTER: Still[] = [
  { re: /wiki page appeared/, key: "tv_doc_computer", from: [1.6, 60, 30], to: [1.25, 20, 10], archive: true },
  { re: /Krezmar raised an objection/, key: "", portrait: "KREZMAR", from: [1.1, 0, 0], to: [1.3, 0, -10] },
  { re: /page was amended/, key: "tv_doc_computer", from: [1.1, 0, 0], to: [1.7, 50, 40], archive: true },
  { re: /from 2021|eternal/, key: "tv_doc_creature", from: [1.05, 0, 0], to: [1.55, 10, -50], archive: true },
  { re: /official song|out of date/, key: "tv_doc_creature", from: [1.7, -60, -40], to: [1.3, 30, -10], archive: true },
  { re: /whereabouts|lurk/, key: "tv_doc_lurk", from: [1.05, 0, 0], to: [1.6, 30, 20] },
  { re: /wiki will be updated/, key: "tv_doc_computer", from: [1.5, 20, 20], to: [1.0, 0, 0], archive: true },
];

const LORE: Still[] = [
  { re: /single tree/, key: "tv_forest", from: [1.05, 0, 60], to: [1.4, 0, -30] },
  { re: /Drongulus Maximus/, key: "tv_doc_village", from: [1.0, -40, 30], to: [1.45, 60, -50], archive: true },
  { re: /eruption/, key: "tv_doc_clouds", from: [1.1, 0, 0], to: [1.25, -40, 0] },
  { re: /wiped out/, key: "tv_doc_boom", from: [1.4, 0, 40], to: [1.1, 0, -10], archive: true },
  { re: /began to fruit/, key: "tv_doc_fruit", from: [1.0, 0, 0], to: [1.3, 0, -40], archive: true },
  { re: /We are the degenerates/, key: "tv_doc_fruit", from: [1.6, 40, 20], to: [2.2, 60, 40], archive: true },
  { re: /historians dispute/, key: "tv_doc_scroll", from: [1.2, -40, 0], to: [1.5, 40, 20], archive: true },
];

/** What the interviewees are, for their name captions. */
const ROLES: Record<string, string> = {
  KREZMAR: "Wiki editor; raised the objection",
  "LIL' CRONGUS": "The last remaining vestige",
  KRELBERT: "Archaeologist",
  RONSON: "Archaeologist",
  "FLAT-TYRE FROLLICK": "Field assistant",
};

export class DocumentaryDirector extends ShowDirector {
  private titles = 0;
  private stillIdx = 0;
  private captioned = new Set<string>();
  /** The Creation Myth: the reconstruction look */
  private recon = this.ep.id === "creation_myth";
  private chapter = "";
  private glow = false;
  private interviewSide: Record<string, number> = {};

  private stills(): Still[] {
    return this.ep.id === "kronster_doc" ? KRONSTER : this.ep.id === "lore_hour" ? LORE : [];
  }

  // ------------------------------------------------------------------ look

  /** Archive: sepia, grain, a scratch or two, the frame's edge burning in. */
  private archiveLook() {
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x5a3a10, 0.22).setOrigin(0));
    const g = this.add(this.sc.add.graphics());
    this.every(80, () => {
      g.clear();
      g.fillStyle(0xfff6dc, 0.07);
      for (let i = 0; i < 70; i++) g.fillRect(SX + Math.random() * SW, SY + Math.random() * SH, 2, 2);
      if (Math.random() < 0.35) {
        g.lineStyle(1, 0xfff6dc, 0.35);
        const x = SX + Math.random() * SW;
        g.lineBetween(x, SY, x + (Math.random() - 0.5) * 8, SY + SH);
      }
    });
    const v = this.add(this.sc.add.graphics());
    for (let i = 0; i < 7; i++) {
      v.lineStyle(16, 0x1a0e00, 0.1);
      v.strokeRect(SX + i * 9, SY + i * 9, SW - i * 18, SH - i * 18);
    }
  }

  private bug() {
    if (!this.recon || this.gfx.list.some((o) => o.getData?.("bug"))) return;
    const { SX, SY, SW } = this.r;
    this.over(this.text(SX + SW - 14, SY + 12, "RECONSTRUCTION", 11, "#ffffffaa", { fontStyle: "bold", letterSpacing: 2 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(1, 0).setData("bug", true));
  }

  /** The cave: lantern light (warm, flickering), dark corners. */
  private lantern() {
    const { SX, SY, SW, SH } = this.r;
    const dark = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x100804, 0.3).setOrigin(0));
    this.every(110, () => dark.setAlpha(0.26 + Math.random() * 0.1));
    if (this.glow) {
      const p = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x8a2be2, 0.12).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
      this.sc.tweens.add({ targets: p, alpha: 0.32, duration: 600, yoyo: true, repeat: -1 });
    }
  }

  // ------------------------------------------------------------------ cards

  protected onTitle(t: string): number {
    this.titles++;
    this.clear();
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
    if (this.titles === 1) {
      const brand = this.add(this.text(this.cx, this.cy - 52, "K R E L W O R L D   D O C U M E N T A R I E S", 12, "#c8b890").setOrigin(0.5).setAlpha(0));
      const line = this.add(this.sc.add.rectangle(this.cx, this.cy - 30, 0, 1, 0xc8b890));
      const title = this.add(this.text(this.cx, this.cy + 10, t, 28, "#ffffff", { fontFamily: "Georgia, 'Times New Roman', serif", align: "center", wordWrap: { width: SW - 80 } }).setOrigin(0.5).setAlpha(0));
      this.sc.tweens.add({ targets: brand, alpha: 1, duration: 900 });
      this.sc.tweens.add({ targets: line, width: 300, duration: 1200, delay: 300 });
      this.sc.tweens.add({ targets: title, alpha: 1, duration: 1400, delay: 900 });
      return 4200;
    }
    this.chapter = t.toUpperCase();
    if (/TO BE CONTINUED/.test(this.chapter)) {
      const tt = this.add(this.text(this.cx, this.cy, t, 26, "#ffffff", { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }).setOrigin(0.5).setAlpha(0));
      this.sc.tweens.add({ targets: tt, alpha: 1, duration: 1500 });
      return 2600;
    }
    // a chapter: small caps over a thin rule
    const tt = this.add(this.text(this.cx, this.cy, t.replace(/\s*[–-]\s*/g, "\n"), 20, "#f0e6c8", { fontFamily: "Georgia, 'Times New Roman', serif", align: "center", lineSpacing: 8 }).setOrigin(0.5).setAlpha(0));
    this.add(this.sc.add.rectangle(this.cx, this.cy + 46, 120, 1, 0xf0e6c8, 0.6));
    this.sc.tweens.add({ targets: tt, alpha: 1, duration: 800 });
    void SX;
    void SY;
    void SH;
    return 1800;
  }

  // ------------------------------------------------------------------ shots

  protected onShot(set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    this.clear();
    if (this.recon) {
      // the landscape, then in
      this.kenBurns(this.tex("tv_doc_cliffs"), { z: 1.05, x: 40, y: -10 }, { z: 1.35, x: -30, y: 20 }, 3200);
      this.caption("THE KRELWORLD BADLANDS", "Present day");
      this.later(2800, () => this.cave());
      return 3000;
    }
    // a landscape (or the stacks) to open on, moving
    const key = /FOREST/i.test(set) ? "tv_forest" : this.host.setTexture();
    this.kenBurns(this.tex(key), { z: 1.3, x: -40, y: 30 }, { z: 1.1, x: 30, y: -10 }, 4000);
    return 1500;
  }

  private cave() {
    this.clear();
    const img = this.backdrop(this.host.setTexture(), { zoom: 1.15 });
    this.sc.tweens.add({ targets: img, scale: img.scale * 1.08, duration: 6000 });
    this.lantern();
    this.handheld(1.4);
    this.bug();
  }

  /** A lower third: name over what they are. */
  private caption(name: string, role: string) {
    this.clearGfx();
    this.bug();
    const { SX, SY, SH } = this.r;
    const c = this.over(this.sc.add.container(SX + 28, SY + SH - 136).setAlpha(0));
    c.add(this.sc.add.rectangle(-8, 0, 4, 44, 0xf0c060).setOrigin(0, 0));
    c.add(this.text(4, 0, name, 17, "#ffffff", { fontStyle: "bold", stroke: "#000", strokeThickness: 3 }));
    c.add(this.text(4, 23, role, 13, "#f0e6c8", { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", stroke: "#000", strokeThickness: 3 }));
    this.sc.tweens.add({ targets: c, alpha: 1, x: SX + 34, duration: 500 });
    this.later(3600, () => this.sc.tweens.add({ targets: c, alpha: 0, duration: 500 }), true);
  }

  // ------------------------------------------------------------------ narration and interviews

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (name === "NARRATOR") return this.narrate(text);
    if (this.recon) return this.reconLine(name, text, emotion);
    return this.interview(name, text, emotion);
  }

  private narrate(text: string): number {
    const list = this.stills();
    let s = list.find((x) => x.re.test(text));
    if (!s) s = list[this.stillIdx++ % Math.max(1, list.length)];
    if (!s) return 0;
    this.clear();
    const ms = 9000;
    if (s.portrait) this.portrait(s.portrait, s);
    else {
      this.kenBurns(this.tex(s.key), { z: s.from[0], x: s.from[1], y: s.from[2] }, { z: s.to[0], x: s.to[1], y: s.to[2] }, ms, { tint: s.archive ? 0xe8d8b8 : undefined });
      if (s.archive) this.archiveLook();
    }
    return 0;
  }

  /** An archive "photograph" of somebody, pinned up in the stacks, the camera drifting in on it. */
  private portrait(name: string, s: Still) {
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex("tv_archive"), { zoom: 1.4, blur: 3, tint: 0x8a7a60 });
    const ph = this.add(this.sc.add.container(this.cx, this.cy + 6).setAngle(-3));
    ph.add(this.sc.add.rectangle(0, 0, 250, 290, 0xf2ead8).setStrokeStyle(1, 0xb0a080));
    ph.add(this.sc.add.sprite(0, -14, `tvface_${name.replace(/[^A-Z0-9]+/g, "_")}`, F.NEUTRAL).setScale(1.75).setTint(0xd8c09a));
    ph.add(this.text(0, 122, `${name.charAt(0)}${name.slice(1).toLowerCase()}, c. 2025`, 13, "#4a3a20", { fontFamily: "Georgia, serif", fontStyle: "italic" }).setOrigin(0.5));
    ph.add(this.sc.add.circle(0, -136, 6, 0xb02020));
    this.push(s.to[0], 9000, this.cx, this.cy - 30);
    this.archiveLook();
    void SX;
    void SY;
    void SW;
    void SH;
  }

  /** Interview: off-centre, looking past the lens, a dim room behind. */
  private interview(name: string, text: string, emotion: string): number {
    const side = (this.interviewSide[name] ??= Object.keys(this.interviewSide).length % 2 ? 1 : -1);
    let p: Perf | null = this.perf?.name === name ? this.perf : null;
    if (!p) {
      p = this.single(name, { side: side * 1.0, bg: this.tex("tv_archive"), zoom: 1.25, blur: 3, recut: true, bgTint: 0x9a8a78, scale: 2.6 });
      if (!p) return 0;
      // a lamp just out of shot
      const { SX, SY, SW, SH } = this.r;
      const lamp = this.add(this.sc.add.circle(side < 0 ? SX + SW * 0.85 : SX + SW * 0.15, SY + SH * 0.3, 90, 0xffd890, 0.12).setBlendMode(Phaser.BlendModes.ADD));
      this.sc.tweens.add({ targets: lamp, alpha: 0.18, duration: 2000, yoyo: true, repeat: -1 });
      this.push(1.06, 8000, p.spr.x, p.spr.y - 200);
    }
    if (!this.captioned.has(name)) {
      this.captioned.add(name);
      this.caption(name, ROLES[name] ?? "");
    }
    this.talk(p, name, text, emotion);
    return 0;
  }

  // ------------------------------------------------------------------ the reconstruction

  private reconLine(name: string, text: string, emotion: string): number {
    const e = emotion.toLowerCase();
    if (name === "KRELBERT AND RONSON") return this.unison(text);
    // reading the scroll aloud: the parchment, his voice over it, now and then
    const reading = name === "KRELBERT" && /THE SCROLL/.test(this.chapter) && (/^Holy shit|continuing|Anyway|Other things|There will be/i.test(text) || /trembling|continuing/.test(e));
    if (reading && this.hash(text) % 2 === 0) {
      this.clear();
      this.kenBurns(this.tex("tv_doc_scroll"), { z: 1.4, x: -30, y: 10 }, { z: 1.7, x: 40, y: -10 }, 7000);
      this.lantern();
      this.bug();
      return 0;
    }
    let p: Perf | null = this.perf?.name === name ? this.perf : null;
    if (!p) {
      const side = name === "KRELBERT" ? -0.6 : name === "RONSON" ? 0.6 : 0.3;
      p = this.single(name, { side, bg: this.host.setTexture(), zoom: 1.6, blur: 1.5, recut: true });
      if (!p) return 0;
      this.lantern();
      this.handheld(1.2);
      this.bug();
    }
    if (/stunned|panick|gasping|shouting|urgent|cracking/.test(e)) {
      p.base = F.ALARM;
      p.spr.setFrame(F.ALARM);
    }
    if (!this.captioned.has(name)) {
      this.captioned.add(name);
      this.caption(name === "FLAT-TYRE FROLLICK" ? "FLAT-TYRE FROLLICK" : name, ROLES[name] ?? "");
    }
    this.talk(p, name, text, emotion);
    return 0;
  }

  /** "Big wowzer.": both of them, split screen, in unison. */
  private unison(text: string): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.host.setTexture(), { zoom: 1.7, blur: 2 });
    const mk = (n: string, x: number) => {
      const s = this.add(this.sc.add.sprite(x, SY + SH + 6, `tvface_${n}`, F.ALARM).setOrigin(0.5, 1).setScale(2.6));
      return s;
    };
    const a = mk("KRELBERT", SX + SW * 0.27);
    const b = mk("RONSON", SX + SW * 0.73);
    this.add(this.sc.add.rectangle(this.cx, this.cy, 4, SH, 0x000000));
    this.lantern();
    this.bug();
    const plan = text.length;
    let n = 0;
    this.every(150, () => {
      const f = n++ % 2 ? F.TALK : F.ALARM;
      a.setFrame(f);
      b.setFrame(f);
    }, Math.max(6, plan / 2));
    this.later(Math.max(1400, plan * 90), () => {
      a.setFrame(F.ALARM);
      b.setFrame(F.ALARM);
    });
    this.push(1.06, 3000);
    return 0;
  }

  protected onDirection(a: string): number {
    if (this.ep.id === "lore_hour" && /clouds/i.test(a)) {
      this.clear();
      this.kenBurns(this.tex("tv_doc_clouds"), { z: 1.05, x: 30, y: 0 }, { z: 1.12, x: -30, y: 0 }, 6000);
      return 1800;
    }
    if (!this.recon) return 0;
    if (/stone chest|pries it open/i.test(a)) {
      this.cave();
      if (/pries it open/i.test(a)) {
        this.push(1.25, 3000, this.cx, this.r.SY + this.r.SH * 0.65);
        this.later(1600, () => this.sfx("door"));
      }
      return 1200;
    }
    if (/unrolling the ancient scroll|breaks the seal/i.test(a)) {
      this.clear();
      this.kenBurns(this.tex("tv_doc_scroll"), { z: 1.0, x: 0, y: 0 }, { z: 1.35, x: 20, y: -10 }, 5000);
      this.lantern();
      this.bug();
      return 1400;
    }
    if (/rumble|Dust trickles/i.test(a)) {
      this.cave();
      this.dust();
      this.sc.cameras.main.shake(1400, 0.006);
      return 1200;
    }
    if (/glow faintly|strange symbols/i.test(a)) {
      this.glow = true;
      this.cave();
      return 1000;
    }
    if (/guttural laugh/i.test(a)) {
      this.cave();
      this.push(0.92, 2000);
      return 900;
    }
    if (/collapse/i.test(a)) {
      this.cave();
      this.rocks();
      this.sc.cameras.main.shake(2600, 0.016);
      return 2200;
    }
    if (/As they flee/i.test(a)) {
      this.glow = true;
      this.cave();
      const { SX, SY, SW, SH } = this.r;
      const w = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xe8d0ff, 0).setOrigin(0));
      this.sc.tweens.add({ targets: w, fillAlpha: 1, duration: 2200, ease: "Quad.in" });
      return 2200;
    }
    // somebody named reacting
    const who = /^(Krelbert|Ronson|Flat-Tyre)/i.exec(a)?.[1];
    if (who) {
      const n = who.toUpperCase() === "FLAT-TYRE" ? "FLAT-TYRE FROLLICK" : who.toUpperCase();
      const p = this.single(n, { side: n === "KRELBERT" ? -0.6 : 0.6, bg: this.host.setTexture(), zoom: 1.6, blur: 1.5, recut: true, expr: /trembl|wide|terror|pale|uneasily/i.test(a) ? F.ALARM : F.NEUTRAL });
      if (p) {
        this.lantern();
        this.handheld(1.2);
        this.bug();
        this.push(1.1, 2500, p.spr.x, p.spr.y - 220);
      }
      return 800;
    }
    if (/group|exchange|stare at|silence/i.test(a)) {
      this.cave();
      return 800;
    }
    return 0;
  }

  private dust() {
    const { SX, SY, SW } = this.r;
    this.every(90, () => {
      const d = this.add(this.sc.add.rectangle(SX + Math.random() * SW, SY, 2, 4, 0xc8b090, 0.8));
      this.sc.tweens.add({ targets: d, y: SY + 300 + Math.random() * 120, duration: 1200, onComplete: () => d.destroy() });
    }, 30);
  }

  private rocks() {
    const { SX, SY, SW, SH } = this.r;
    this.every(120, () => {
      const s = 10 + Math.random() * 30;
      const r = this.add(this.sc.add.rectangle(SX + Math.random() * SW, SY - 30, s, s * 0.8, 0x4a3a2a).setStrokeStyle(2, 0x2a1a0a));
      this.sc.tweens.add({ targets: r, y: SY + SH + 40, angle: Math.random() * 360, duration: 700 + Math.random() * 400, ease: "Quad.in", onComplete: () => r.destroy() });
    }, 22);
    this.later(600, () => this.fx("vfx_dust", this.cx, SY + SH - 40, { scale: 4 }));
  }

  protected onSfx(id: string): number {
    if (id !== "boom") return 0;
    this.sc.cameras.main.flash(200, 255, 240, 220);
    this.sc.cameras.main.shake(600, 0.014);
    if (this.ep.id === "lore_hour") {
      this.clear();
      this.kenBurns(this.tex("tv_doc_boom"), { z: 1.5, x: 0, y: -40 }, { z: 1.15, x: 0, y: 0 }, 2600, { tint: 0xf0e0d0 });
      this.archiveLook();
      return 600;
    }
    if (this.recon && this.perf) this.crash(1.22, this.perf.spr.x, this.perf.spr.y - 230);
    return 300;
  }

  protected onMusic(_id: string, _mode: string): number {
    return 0;
  }
}

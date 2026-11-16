import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../../systems/tv";
import { synth } from "../../audio/Synth";
import { F, ShowDirector, type Perf, type Rect, type ShowHost } from "./ShowDirector";
import { FACE_META } from "./faceMeta";
import { registerDramaFaces } from "./dramaFaces";

/**
 * Mole of Thrones: a prestige fantasy drama and the fly-on-the-wall documentary about the making of it, cut
 * together. The "drama" is letterboxed and graded, with the epic titles over a parchment map (towers rising out
 * of it), a sweeping theme, slow push-ins and fantasy place cards. The "documentary" drops the letterbox and goes
 * hand-held: talking heads to camera with lower thirds, a REC light and timecode behind the scenes, snap zooms on
 * the reactions. The phone call is a split screen.
 *
 * Art: tv_mt_* sets, figures and props; tvface_MT_* close-ups (dramaFaces.ts).
 */

type Place = "bedroom" | "office" | "doctor" | "hospital" | "street" | "flat" | "set";

const SETS: Record<Place, string> = {
  bedroom: "tv_mt_bedroom",
  office: "tv_mt_office",
  doctor: "tv_mt_doctor",
  hospital: "tv_mt_hospital",
  street: "tv_mt_street",
  flat: "tv_mt_flat",
  set: "tv_mt_set",
};

/** Where we are, as the fantasy place cards have it. */
const PLACE_CARDS: Record<Place, [string, string]> = {
  bedroom: ["THE BEDCHAMBER", "Krelford, the Free City of Jenkins"],
  office: ["THE STUDY OF THE AUTHOR", "Beyond the Narrow Sea"],
  doctor: ["THE MAESTER'S CHAMBERS", "Krelford Health Centre"],
  hospital: ["THE HOUSE OF HEALING", "Ward 7"],
  street: ["THE KING'S ROAD", "Krelford High Street"],
  flat: ["THE HALL OF SER THORLIN", "Formerly the living room"],
  set: ["BEHIND THE SCENES", "Day 1 of principal photography"],
};

/** Lower thirds for the documentary. */
const ROLES: Record<string, [string, string]> = {
  FLENKY: ["JAMES 'JENKO' JENKINS", "CBT therapist. IQ 160 (self-reported)"],
  RUTH: ["RUTH", "Fiancée"],
  "GEORGE R. R. MARTIN": ["GEORGE R. R. MARTIN", "Author. Intuition: never wrong (once)"],
  DOCTOR: ["THE DOCTOR", "GP, Krelford Health Centre"],
  NURSE: ["NURSE", "Ward 7"],
  DIRECTOR: ["THE DIRECTOR", "Mole of Thrones, Season 1"],
  "FLENKY'S MUM": ["JENKO'S MUM", "In the audience"],
  "POLICE OFFICER": ["POLICE", "Krelford Constabulary"],
};

/** Lines played as talking heads straight to the documentary camera. */
const TO_CAMERA = [/^It's perfect\.$/, /^My character is Ser Thorlin/, /^Exactly\. They just don't understand genius/, /^This\.\.\. is my finest work/];

export class FantasyDocDirector extends ShowDirector {
  private place: Place = "bedroom";
  private titles = 0;
  private doc = false;
  private captioned = new Set<string>();
  private reveal = false;

  constructor(sc: Phaser.Scene, r: Rect, beats: TVBeat[], host: ShowHost, ep: TVEpisode) {
    super(sc, r, beats, host, ep);
    registerDramaFaces();
  }

  private where(set: string): Place {
    const s = set.toUpperCase();
    if (s.includes("BEDROOM")) return "bedroom";
    if (s.includes("MARTIN")) return "office";
    if (s.includes("DOCTOR")) return "doctor";
    if (s.includes("HOSPITAL")) return "hospital";
    if (s.includes("STREET")) return "street";
    if (s.includes("APARTMENT")) return "flat";
    return "set";
  }

  private setImg() {
    return this.tex(SETS[this.place]);
  }

  /** whose face, here */
  private faceOf(name: string) {
    switch (name) {
      case "FLENKY":
        return this.place === "set" ? "MT FLENKY MOLE" : this.place === "hospital" || this.place === "flat" || this.place === "street" ? "MT FLENKY BANDAGE" : "MT FLENKY";
      case "RUTH":
        return "MT RUTH";
      case "GEORGE R. R. MARTIN":
        return "MT MARTIN";
      case "DOCTOR":
        return "MT DOCTOR";
      case "NURSE":
        return "MT NURSE";
      case "DIRECTOR":
        return "MT DIRECTOR";
      case "FLENKY'S MUM":
        return "MT MUM";
      case "POLICE OFFICER":
        return "GG OFFICER 1";
      default:
        return name;
    }
  }

  // ------------------------------------------------------------------ the two looks

  /** The drama: letterboxed, graded. The documentary: full frame, a REC light, timecode. */
  private mode(doc: boolean) {
    this.doc = doc;
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    const night = this.place === "flat";
    if (!doc) {
      const g = this.over(this.sc.add.rectangle(SX, SY, SW, SH, night ? 0x10204a : 0x3a2810, night ? 0.25 : 0.12).setOrigin(0));
      g.setBlendMode(Phaser.BlendModes.MULTIPLY);
      const v = this.over(this.sc.add.graphics());
      for (let i = 0; i < 7; i++) {
        v.lineStyle(14, 0x000000, 0.06 + i * 0.012);
        v.strokeRect(SX + i * 9, SY + i * 9, SW - i * 18, SH - i * 18);
      }
      this.over(this.sc.add.rectangle(SX, SY, SW, 36, 0x000000).setOrigin(0));
      this.over(this.sc.add.rectangle(SX, SY + SH - 36, SW, 36, 0x000000).setOrigin(0));
      return;
    }
    // the documentary camera
    const rec = this.over(this.sc.add.circle(SX + 30, SY + 28, 7, 0xff2020));
    this.over(this.text(SX + 44, SY + 19, "REC", 15, "#ffffff", { fontStyle: "bold", stroke: "#000", strokeThickness: 3 }));
    this.sc.tweens.add({ targets: rec, alpha: 0.15, duration: 500, yoyo: true, repeat: -1 });
    const tc = this.over(this.text(SX + SW - 24, SY + 19, "", 14, "#ffffff", { fontFamily: "Courier New, monospace", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(1, 0));
    const t0 = this.sc.time.now - 3600000 * 2 - 1000 * 60 * 17;
    this.every(
      40,
      () => {
        const ms = this.sc.time.now - t0;
        const p = (n: number) => String(Math.floor(n)).padStart(2, "0");
        tc.setText(`${p(ms / 3600000)}:${p((ms / 60000) % 60)}:${p((ms / 1000) % 60)}:${p((ms / 40) % 25)}`);
      },
      -1,
      true,
    );
    const b = this.over(this.sc.add.graphics());
    b.lineStyle(2, 0xffffff, 0.6);
    const c = 18;
    for (const [x, y, dx, dy] of [
      [SX + 14, SY + 14, 1, 1],
      [SX + SW - 14, SY + 14, -1, 1],
      [SX + 14, SY + SH - 14, 1, -1],
      [SX + SW - 14, SY + SH - 14, -1, -1],
    ]) {
      b.lineBetween(x, y, x + dx * c, y);
      b.lineBetween(x, y, x, y + dy * c);
    }
  }

  /** The fantasy place card: a gold serif name over a dark band. */
  private placeCard(p: Place) {
    const [a, b] = PLACE_CARDS[p];
    const { SY, SH } = this.r;
    const c = this.over(this.sc.add.container(this.cx, SY + SH - 86).setAlpha(0));
    c.add(this.sc.add.rectangle(0, 8, 360, 52, 0x000000, 0.45));
    c.add(this.text(0, 0, a.split("").join(" "), 17, "#e8cf8a", { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "bold" }).setOrigin(0.5));
    c.add(this.text(0, 21, b, 11, "#d8d0c0", { fontFamily: "Georgia, serif", fontStyle: "italic" }).setOrigin(0.5));
    this.sc.tweens.add({ targets: c, alpha: 1, duration: 900 });
    this.later(3400, () => this.sc.tweens.add({ targets: c, alpha: 0, duration: 800 }), true);
  }

  /** A documentary lower third. */
  private strap(name: string) {
    if (this.captioned.has(name) || !ROLES[name]) return;
    this.captioned.add(name);
    const [a, b] = ROLES[name];
    const { SX, SY, SH } = this.r;
    const c = this.over(this.sc.add.container(SX - 300, SY + SH - (this.doc ? 112 : 140)));
    c.add(this.sc.add.rectangle(0, 0, 300, 46, 0xffffff, 0.92).setOrigin(0));
    c.add(this.sc.add.rectangle(0, 0, 8, 46, 0xd4202a).setOrigin(0));
    c.add(this.text(16, 5, a, 15, "#111111", { fontStyle: "bold" }));
    c.add(this.text(16, 25, b, 11, "#444444"));
    this.sc.tweens.add({ targets: c, x: SX + 20, duration: 380, ease: "Quad.out" });
    this.later(3800, () => this.sc.tweens.add({ targets: c, x: SX - 320, duration: 380, ease: "Quad.in" }), true);
  }

  // ------------------------------------------------------------------ titles

  protected onTitle(t: string): number {
    this.titles++;
    if (this.titles === 1) return this.openingTitles(t);
    return this.endCredits();
  }

  /** Over the map: the camera sweeps, little clockwork towers wind up out of the parchment, the name in gold. */
  private openingTitles(t: string): number {
    this.clear();
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    synth.music("mot_theme", true);
    const map = this.kenBurns(this.tex("tv_mt_map"), { z: 2.2, x: 160, y: 90 }, { z: 1.3, x: -40, y: -20 }, 7000);
    map.setTint(0xffe8c0);
    // towers rising out of the map
    const spots: [number, number][] = [
      [0.3, 0.42],
      [0.62, 0.36],
      [0.48, 0.62],
      [0.75, 0.6],
      [0.22, 0.7],
    ];
    spots.forEach(([fx, fy], i) =>
      this.later(500 + i * 650, () => {
        const x = SX + SW * fx;
        const y = SY + SH * fy;
        const tw = this.add(this.sc.add.container(x, y).setScale(1, 0));
        tw.add(this.sc.add.rectangle(0, 0, 16, 46, 0x8a6a3a).setOrigin(0.5, 1).setStrokeStyle(2, 0x3a2810));
        tw.add(this.sc.add.triangle(0, -46, -12, 0, 12, 0, 0, -18, 0xb08a4a).setOrigin(0.5, 1).setStrokeStyle(2, 0x3a2810));
        for (let k = 0; k < 3; k++) tw.add(this.sc.add.rectangle(-8 + k * 8, -46, 5, 6, 0x6a4a20).setOrigin(0.5, 1));
        const cog = this.sc.add.star(0, -12, 8, 4, 8, 0xd8b060).setStrokeStyle(1, 0x3a2810);
        tw.add(cog);
        this.sc.tweens.add({ targets: cog, angle: 360, duration: 1400, repeat: -1 });
        this.sc.tweens.add({ targets: tw, scaleY: 1, duration: 900, ease: "Back.out" });
        this.sfx("tap");
      }),
    );
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x1a0e04, 0.25).setOrigin(0));
    this.later(3800, () => {
      const name = this.add(this.text(this.cx, this.cy - 10, t.toUpperCase().split("").join(" "), 36, "#f2d58a", { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "bold", stroke: "#3a2208", strokeThickness: 5 }).setOrigin(0.5).setAlpha(0).setScale(1.3));
      name.setShadow(0, 0, "#ffcc66", 18, true, true);
      this.sc.tweens.add({ targets: name, alpha: 1, scale: 1, duration: 1500, ease: "Quad.out" });
      this.sfx("tv_sting");
    });
    void SX;
    return 7200;
  }

  private endCredits(): number {
    this.clear();
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    synth.music("mot_theme", true);
    this.kenBurns(this.tex("tv_mt_map"), { z: 1.3, x: 0, y: 0 }, { z: 1.6, x: 60, y: 30 }, 9000).setTint(0x806040);
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0.55).setOrigin(0));
    const lines = [
      "MOLE OF THRONES",
      "",
      "Ser Thorlin of Pentos ........ JAMES JENKINS",
      "Ruth ........ RUTH",
      "The Author ........ GEORGE R. R. MARTIN",
      "The Director ........ THE DIRECTOR",
      "Extra Number 3 ........ JAMES JENKINS",
      "The Mole ........ THE MOLE",
      "Jenko's Mum ........ JENKO'S MUM",
      "Jenko's Dad ........ JENKO'S DAD",
      "",
      "No moles were harmed.",
      "One was reattached.",
      "",
      "Fixed in post.",
    ];
    const rows = lines.map((l, i) => this.add(this.text(this.cx, SY + SH - 30 + i * 24, l, i === 0 ? 20 : 13, i === 0 ? "#f2d58a" : "#e8e1c8", { fontFamily: "Georgia, serif", fontStyle: i === 0 ? "bold" : "normal" }).setOrigin(0.5, 0)));
    this.sc.tweens.add({ targets: rows, y: `-=${SH - 30 + lines.length * 24 - SH * 0.5}`, duration: 7400, ease: "Linear" });
    return 8000;
  }

  // ------------------------------------------------------------------ scenes

  protected onShot(set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    const p = this.where(set);
    this.place = p;
    this.reveal = false;
    if (p === "office") synth.stopMusic();
    if (p === "set" || p === "street") {
      this.mode(true);
      this.establish();
      this.handheld(1.4);
      this.placeCard(p);
      return 2000;
    }
    this.mode(false);
    this.establish();
    this.placeCard(p);
    return 2200;
  }

  /** The wide: a slow move over the set, with whoever's in it. */
  private establish() {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.kenBurns(this.setImg(), { z: 1.15, x: 30, y: 10 }, { z: 1.3, x: -20, y: 20 }, 6000, { tint: this.place === "flat" ? 0xb0b8e0 : undefined });
    const floor = SY + SH * 0.9;
    if (this.place === "bedroom") {
      this.prop("tv_mt_bed", SX + SW * 0.32, floor - 30, 1.6);
      const r = this.prop("tv_mt_ruth_body", SX + SW * 0.78, floor, 1.6);
      if (r) this.sc.tweens.add({ targets: r, scaleY: r.scaleY * 0.98, duration: 600, yoyo: true, repeat: -1 });
    }
    if (this.place === "flat") {
      const f = this.prop("tv_mt_robe", SX + SW * 0.3, floor, 1.55);
      if (f) this.bandage(f, 0.5, 0.17);
      this.prop("tv_mt_ruth_body", SX + SW * 0.72, floor, 1.5)?.setFlipX(true);
    }
    if (this.place === "set") {
      this.prop("tv_mt_mannequin", SX + SW * 0.58, floor - 10, 1.4);
      this.prop("tv_mt_speaker", SX + SW * 0.42, floor - 6, 1.6);
    }
  }

  private prop(key: string, x: number, y: number, scale: number) {
    if (!this.tex(key)) return null;
    return this.add(this.sc.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale));
  }

  /** A little white bandage on a figure's cheek (fx, fy: where, as a fraction of the figure). */
  private bandage(s: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, fx: number, fy: number) {
    const b = this.add(this.sc.add.rectangle(0, 0, 6 * s.scaleX, 5 * s.scaleY, 0xf4f4f4).setStrokeStyle(1, 0xbbbbbb));
    const put = () => b.setPosition(s.x - s.displayWidth / 2 + s.displayWidth * fx, s.y - s.displayHeight + s.displayHeight * fy);
    put();
    this.every(16, put);
    return b;
  }

  // ------------------------------------------------------------------ dialogue

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (this.unseen(name)) return 0;
    const e = emotion.toLowerCase();
    if (this.place === "office") return this.splitLine(name, text, emotion);
    const key = this.faceOf(name);
    let expr: number = F.NEUTRAL;
    if (/angr/.test(e)) expr = F.ALARM;
    else if (/rolling eyes/.test(e) || /deadpan/.test(e)) expr = F.ALARM;
    else if (/adoring/.test(e)) expr = F.SPECIAL;
    else if (/offended|weakly/.test(e)) expr = F.ALARM;
    if (name === "FLENKY" && /^Ser Thorlin of Pentos, at your service/.test(text)) expr = F.SPECIAL;
    if (TO_CAMERA.some((re) => re.test(text))) return this.talkingHead(name, key, text, emotion);
    const stay = this.perf?.name === key;
    const side = name === "FLENKY" ? -0.5 : 0.5;
    const p = stay ? this.perf : this.single(key, { side, bg: this.setImg(), zoom: 1.6, blur: 3, recut: true, expr, bgTint: this.place === "flat" ? 0x8a90c0 : undefined });
    if (!p) return 0;
    if (stay && expr !== F.NEUTRAL) this.setBase(expr);
    if (this.doc) this.handheld(1.2);
    this.push(stay ? 1.12 : 1.06, 4400, p.spr.x, p.spr.y - 230);
    if (this.doc && /^'Oo are ya/.test(text)) this.later(200, () => this.crash(1.25, p.spr.x, p.spr.y - 240));
    if (this.doc) this.strap(name);
    this.talk(p, name, text, emotion);
    return 0;
  }

  /** Straight down the lens, the documentary way: the letterbox drops, a lower third comes in. */
  private talkingHead(name: string, key: string, text: string, emotion: string): number {
    const was = this.doc;
    this.mode(true);
    const p = this.single(key, { side: 0.35, bg: this.setImg(), zoom: 1.3, blur: 3, recut: true, scale: 2.7, bgTint: 0xa09890 });
    if (!p) return 0;
    this.handheld(0.8);
    this.push(1.05, 6000, p.spr.x, p.spr.y - 200);
    this.captioned.delete(name);
    this.strap(name);
    this.talk(p, name, text, emotion);
    // back to the drama after the line
    if (!was && this.place !== "set") {
      const n = this.idx;
      this.later(Math.min(9000, 1400 + text.length * 55), () => this.idx === n && this.mode(false));
    }
    return 0;
  }

  /** The phone call: a split screen, him in his bedroom, the author in his study. */
  private splitLine(name: string, text: string, emotion: string): number {
    const left = name === "FLENKY";
    const p = this.splitScreen(left ? "L" : "R");
    if (!p) return 0;
    const e = emotion.toLowerCase();
    if (/panic/.test(e)) this.setBase(F.ALARM);
    this.talk(p, name, text, emotion);
    return 0;
  }

  private splitScreen(who: "L" | "R", o: { lExpr?: number; rExpr?: number } = {}): Perf | null {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const half = (key: string, bg: string, x0: number, expr: number, bgTint?: number) => {
      const c = this.add(this.sc.add.container(0, 0));
      const m = this.sc.make.graphics({}).fillRect(x0, SY, SW / 2, SH);
      c.setMask(m.createGeometryMask());
      const bgk = this.tex(bg);
      if (bgk) {
        const src = this.sc.textures.get(bgk).getSourceImage() as HTMLImageElement;
        const img = this.sc.add.image(x0 + SW / 4, SY + SH / 2, bgk).setScale((Math.max(SW / 2 / src.width, SH / src.height) * 1.8)).setTint(bgTint ?? 0xffffff);
        try {
          img.preFX?.addBlur(1, 3, 3, 1);
        } catch {
          /* canvas */
        }
        c.add(img);
      }
      const fk = `tvface_${key.replace(/ /g, "_")}`;
      if (!this.tex(fk)) return null;
      const spr = this.sc.add.sprite(x0 + SW / 4, SY + SH + 6, fk, expr).setOrigin(0.5, 1).setScale(2.9);
      c.add(spr);
      const meta = FACE_META[fk.slice(7)];
      const p: Perf = { name: key, spr, face: true, base: expr, scale: 2.9, y: SY + SH + 6, frames: meta?.base ?? 4, gesturing: false, lip: !!meta?.lip, gest: meta?.gest ?? [], gUsed: 0 };
      this.breathe(spr, 1800);
      return p;
    };
    const l = half("MT FLENKY", "tv_mt_bedroom", SX, o.lExpr ?? F.NEUTRAL);
    const r = half("MT MARTIN", "tv_mt_office", SX + SW / 2, o.rExpr ?? F.NEUTRAL, 0xd0c0a0);
    this.add(this.sc.add.rectangle(this.cx, SY + SH / 2, 4, SH, 0x000000));
    // the call: a little phone glyph on each side
    this.add(this.text(SX + 18, SY + 44, "● CALLING...", 12, "#ffffff", { stroke: "#000", strokeThickness: 3 }));
    this.add(this.text(SX + SW - 18, SY + 44, "● ON THE LINE", 12, "#ffffff", { stroke: "#000", strokeThickness: 3 }).setOrigin(1, 0));
    const p = who === "L" ? l : r;
    this.perf = p;
    if (p) {
      // blink the one who isn't talking now and then
      const other = who === "L" ? r : l;
      if (other) this.every(2600, () => {
        other.spr.setFrame(F.BLINK);
        this.later(120, () => other.spr.active && other.spr.setFrame(other.base));
      });
      this.push(1.04, 4000);
    }
    return p;
  }

  // ------------------------------------------------------------------ action

  protected onDirection(a: string): number {
    const { SX, SY, SW, SH } = this.r;
    if (/scrolling through his laptop/i.test(a)) {
      this.push(1.12, 5000, SX + SW * 0.32, SY + SH * 0.6);
      return 1800;
    }
    if (/folds laundry nearby/i.test(a)) {
      this.push(1.1, 3000, SX + SW * 0.75, SY + SH * 0.6);
      return 1200;
    }
    if (/staring at the screen/i.test(a)) return this.laptop();
    if (/deadpans/i.test(a)) {
      this.react("MT RUTH", F.ALARM, { side: 0.5, bg: this.setImg(), push: 1.08 });
      return 900;
    }
    if (/grin falters/i.test(a)) {
      const p = this.single("MT FLENKY", { side: -0.4, bg: this.setImg(), recut: true, expr: F.SPECIAL });
      if (p) {
        this.push(1.18, 3200, p.spr.x, p.spr.y - 230);
        this.later(1000, () => this.setBase(F.NEUTRAL));
        this.later(2000, () => this.setBase(F.ALARM));
      }
      return 2600;
    }
    if (/snaps his fingers/i.test(a)) {
      const p = this.single("MT FLENKY", { side: -0.4, bg: this.setImg(), recut: true, expr: F.SPECIAL });
      if (p) this.crash(1.12, p.spr.x, p.spr.y - 230);
      this.sfx("tap");
      return 900;
    }
    if (/grotesque jar/i.test(a)) return this.jar(true);
    if (/dials a number/i.test(a)) {
      const p = this.single("MT FLENKY", { side: -0.3, bg: this.tex("tv_mt_bedroom"), recut: true, expr: F.SPECIAL });
      for (let i = 0; i < 6; i++) this.later(150 + i * 170, () => this.sfx("tap"));
      this.later(1300, () => this.sfx("ding"));
      if (p) this.push(1.1, 2000, p.spr.x, p.spr.y - 230);
      return 1700;
    }
    if (/deep, gruff voice/i.test(a)) {
      this.splitScreen("R");
      return 1200;
    }
    if (/Martin pauses, intrigued/i.test(a) || /There's a long pause/i.test(a)) {
      const p = this.splitScreen("R");
      if (p) this.push(1.1, 3000, this.cx + SW / 4, SY + SH * 0.5);
      if (/long pause/i.test(a)) for (let i = 0; i < 4; i++) this.later(i * 500, () => this.sfx("tap"));
      return /long pause/i.test(a) ? 2200 : 1300;
    }
    if (/Jenko beams/i.test(a)) {
      this.splitScreen("L", { lExpr: F.SPECIAL });
      return 1000;
    }
    if (/Jenko panics/i.test(a)) {
      this.splitScreen("L", { lExpr: F.ALARM });
      this.crash(1.12, SX + SW / 4, SY + SH * 0.5);
      return 900;
    }
    if (/Martin grumbles/i.test(a)) {
      this.splitScreen("R", { rExpr: F.ALARM });
      return 1000;
    }
    if (/nervously clutching the jar/i.test(a)) return this.jar(false);
    if (/glancing at the jar/i.test(a)) {
      this.jar(false);
      this.push(1.3, 2600, this.cx, SY + SH * 0.55);
      return 1700;
    }
    if (/slides the jar/i.test(a)) {
      this.clear();
      this.backdrop(this.setImg(), { zoom: 2.4, oy: -SH * 0.5, blur: 2 });
      const j = this.prop("tv_mt_jar", SX + SW * 0.25, SY + SH * 0.8, 3.2);
      if (j) this.sc.tweens.add({ targets: j, x: SX + SW * 0.75, duration: 1800, ease: "Sine.easeInOut" });
      this.sfx("swing");
      return 2000;
    }
    if (/wakes up post-op/i.test(a)) {
      this.clear();
      this.backdrop(this.setImg(), { zoom: 1.5, blur: 2 });
      const p = this.single("MT FLENKY BANDAGE", { side: -0.3, bg: this.setImg(), recut: true, expr: F.BLINK });
      if (p) {
        this.later(1200, () => this.setBase(F.NEUTRAL));
        this.push(1.08, 3000, p.spr.x, p.spr.y - 230);
      }
      this.every(900, () => this.sfx("monbeep"));
      return 2400;
    }
    if (/bandaged face with reverence/i.test(a)) {
      const p = this.single("MT FLENKY BANDAGE", { side: -0.3, bg: this.setImg(), recut: true, expr: F.SPECIAL });
      if (p) {
        this.push(1.2, 3000, p.spr.x, p.spr.y - 240);
        const glow = this.add(this.sc.add.circle(p.spr.x - 40, p.spr.y - 230, 70, 0xfff2b0, 0.0).setBlendMode(Phaser.BlendModes.ADD));
        this.sc.tweens.add({ targets: glow, fillAlpha: 0.35, duration: 1200, yoyo: true });
      }
      this.sfx("transform_sparkle");
      return 2200;
    }
    if (/strutting confidently/i.test(a)) return this.strut(false);
    if (/recoiling as they pass/i.test(a)) return this.strut(true);
    if (/self-tailored medieval robe/i.test(a)) {
      this.push(1.1, 3000, SX + SW * 0.4, SY + SH * 0.6);
      return 1600;
    }
    if (/Ruth swoons/i.test(a) || /sighs dreamily/i.test(a)) {
      const p = this.react("MT RUTH", F.SPECIAL, { side: 0.4, bg: this.setImg(), push: 1.12 });
      if (p) this.hearts(p.spr.x, p.spr.y - 300);
      if (/stares off/i.test(a))
        this.later(1300, () => {
          const q = this.single("MT FLENKY BANDAGE", { side: -0.3, bg: this.setImg(), recut: true, expr: F.SPECIAL });
          if (q) this.push(1.15, 2600, q.spr.x, q.spr.y - 240);
        });
      return /stares off/i.test(a) ? 2600 : 1300;
    }
    if (/bursts onto the set/i.test(a)) {
      this.establish();
      const f = this.prop("tv_mt_robe", SX - 60, SY + SH * 0.92, 1.7);
      if (f) {
        this.sc.tweens.add({ targets: f, x: SX + SW * 0.3, duration: 1200, ease: "Quad.out" });
        this.sc.tweens.add({ targets: f, y: f.y - 8, duration: 150, yoyo: true, repeat: 3 });
      }
      this.sfx("door");
      return 1600;
    }
    if (/squints at Jenko/i.test(a) || /glances at his clipboard/i.test(a)) {
      this.react("MT DIRECTOR", F.ALARM, { side: 0.45, bg: this.setImg(), push: 1.1 });
      return 900;
    }
    if (/Jenko freezes, eyes wide/i.test(a)) {
      const p = this.react("MT FLENKY MOLE", F.ALARM, { side: -0.4, bg: this.setImg() });
      if (p) this.crash(1.3, p.spr.x, p.spr.y - 230);
      this.sfx("tv_sting");
      return 900;
    }
    if (/transparent sacks, waiting in line/i.test(a)) {
      this.clear();
      this.backdrop(this.setImg(), { zoom: 1.5, ox: 80, blur: 1 });
      const ex = this.prop("tv_mt_extras", this.cx, SY + SH * 0.92, 2.3);
      if (ex) this.sackBars(ex, 4);
      this.cam.setPosition(80, 0);
      this.sc.tweens.add({ targets: this.cam, x: -40, duration: 3000, ease: "Sine.easeInOut" });
      this.handheld(1);
      return 2400;
    }
    if (/trying to process the madness/i.test(a)) {
      const p = this.react("MT FLENKY MOLE", F.ALARM, { side: -0.4, bg: this.setImg(), push: 1.1 });
      if (p) for (let i = 0; i < 3; i++) this.later(300 + i * 400, () => p.spr.setFrame(F.BLINK) && this.later(90, () => p.spr.active && p.spr.setFrame(p.base)));
      return 1600;
    }
    if (/cranks up some contemporary R&B/i.test(a)) {
      this.clear();
      this.backdrop(this.setImg(), { zoom: 1.7, oy: -40, tint: 0x605070 });
      const sp = this.prop("tv_mt_speaker", this.cx, SY + SH * 0.62, 5);
      if (sp) {
        sp.setOrigin(0.5, 0.5);
        this.every(430, () => this.sc.tweens.add({ targets: sp, scale: 5.4, duration: 90, yoyo: true }));
      }
      const glow = this.add(this.sc.add.circle(this.cx, SY + SH * 0.7, 120, 0x40a0ff, 0.12).setBlendMode(Phaser.BlendModes.ADD));
      this.sc.tweens.add({ targets: glow, fillAlpha: 0.3, duration: 430, yoyo: true, repeat: -1 });
      synth.music("mot_rnb", true);
      this.push(1.15, 3000);
      return 2200;
    }
    if (/begins to dance awkwardly/i.test(a)) return this.dance();
    if (/gestures to the crew/i.test(a)) {
      const p = this.react("MT DIRECTOR", F.NEUTRAL, { side: 0.45, bg: this.setImg() });
      if (p) this.playGesture(p, 0, 1000);
      return 1000;
    }
    if (/removes the sack/i.test(a)) return this.fullFrontal();
    if (/green screen lifts/i.test(a)) return this.greenScreen();
    if (/His mother points/i.test(a)) {
      const p = this.react("MT MUM", F.LAUGH, { side: 0.3, bg: this.tex("tv_mt_audience") });
      if (p) {
        this.playGesture(p, 0, 1300);
        this.sc.tweens.add({ targets: p.spr, angle: { from: -2, to: 2 }, duration: 140, yoyo: true, repeat: 8 });
      }
      return 1500;
    }
    if (/His father groans/i.test(a)) return this.father();
    if (/steps forward, beaming/i.test(a)) {
      const p = this.react("MT MARTIN", F.SPECIAL, { side: 0.3, bg: this.tex("tv_mt_audience") });
      if (p) this.sc.tweens.add({ targets: p.spr, y: p.y - 10, duration: 900, ease: "Sine.easeOut" });
      return 1300;
    }
    if (/POLICE storms in/i.test(a)) return this.arrest();
    if (/dragged off the set/i.test(a)) return this.draggedOff();
    return 0;
  }

  /** The laptop screen: the casting call, in a browser. */
  private laptop(): number {
    this.clear();
    const { SY, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 3, blur: 6, tint: 0x8090a0 });
    const s = this.add(this.sc.add.container(this.cx, SY + SH / 2));
    s.add(this.sc.add.rectangle(0, 0, 440, 280, 0x222222).setStrokeStyle(6, 0x111111));
    s.add(this.sc.add.rectangle(0, 0, 420, 260, 0xf6f6f6));
    s.add(this.sc.add.rectangle(0, -118, 420, 24, 0xdedede));
    s.add(this.text(-200, -126, "● ● ●    hbk-casting.krel/thrones", 11, "#555555"));
    s.add(this.text(0, -88, "NOW CASTING: GAME OF THRONES", 18, "#7a1010", { fontFamily: "Georgia, serif", fontStyle: "bold" }).setOrigin(0.5));
    s.add(this.sc.add.rectangle(0, -66, 360, 2, 0xb08a4a));
    const body = ["A new competition for one lucky fan.", "", "WE ARE LOOKING FOR:", "• A high IQ", "• Off-putting facial deformities (e.g. moles)", "• Heroic real-life traits", "", "Apply now. Intuition decides."];
    body.forEach((l, i) => s.add(this.text(-180, -52 + i * 18, l, 13, i === 2 ? "#111111" : "#333333", { fontStyle: i === 2 ? "bold" : "normal" })));
    const cursor = this.add(this.sc.add.triangle(this.cx + 120, SY + SH / 2 + 60, 0, 0, 0, 16, 10, 12, 0xffffff).setStrokeStyle(1, 0x000000));
    this.sc.tweens.add({ targets: cursor, x: this.cx - 20, y: SY + SH / 2 + 4, duration: 1600, ease: "Sine.easeInOut" });
    this.push(1.25, 3500, this.cx, SY + SH / 2 + 10);
    this.sfx("tv_sting");
    return 2800;
  }

  /** The jar: lit like a holy relic. */
  private jar(reveal: boolean): number {
    this.clear();
    const { SY, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 2.4, blur: 5, tint: 0x8a7a60 });
    const glow = this.add(this.sc.add.circle(this.cx, SY + SH * 0.5, 130, 0xffe8a0, 0.2).setBlendMode(Phaser.BlendModes.ADD));
    this.sc.tweens.add({ targets: glow, scale: 1.15, duration: 1400, yoyo: true, repeat: -1 });
    if (this.tex("tv_mt_jar")) {
      const j = this.add(this.sc.add.sprite(this.cx, SY + SH * 0.55, "tv_mt_jar", 0).setScale(4.6));
      const n = this.sc.textures.get("tv_mt_jar").frameTotal - 1;
      if (n > 1) {
        let f = 0;
        this.every(150, () => j.active && j.setFrame((f = (f + 1) % n)));
      }
      this.sc.tweens.add({ targets: j, y: j.y - 8, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      // the fluff on it
      this.every(260, () => {
        const h = this.add(this.sc.add.rectangle(j.x + (Math.random() - 0.5) * 30, j.y + (Math.random() - 0.5) * 30, 2, 6, 0x3a2410).setAngle(Math.random() * 180));
        this.sc.tweens.add({ targets: h, y: h.y - 20, alpha: 0, duration: 900, onComplete: () => h.destroy() });
      });
    }
    this.push(1.15, 3000, this.cx, SY + SH * 0.5);
    if (reveal) {
      this.sfx("tv_sting");
      this.later(1900, () => this.react("MT RUTH", F.ALARM, { side: 0.5, bg: this.setImg(), push: 1.1 }));
      return 3000;
    }
    return 1700;
  }

  /** The street: the hidden camera tracks him; the women recoil as he passes. */
  private strut(women: boolean): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const bg = this.backdrop(this.setImg(), { zoom: 1.35, ox: 60 });
    this.sc.tweens.add({ targets: bg, x: bg.x - 120, duration: 4200, ease: "Linear" });
    const ground = SY + SH * 0.95;
    if (this.tex("tv_mt_walk")) {
      const w = this.add(this.sc.add.sprite(women ? SX + SW * 0.32 : SX - 40, ground, "tv_mt_walk", 0).setOrigin(0.5, 1).setScale(2.1));
      const n = this.sc.textures.get("tv_mt_walk").frameTotal - 1;
      let f = 0;
      this.every(110, () => w.active && w.setFrame((f = (f + 1) % n)));
      this.sc.tweens.add({ targets: w, x: women ? SX + SW * 0.52 : SX + SW * 0.4, duration: 4000, ease: "Linear" });
      this.bandage(w, 0.6, 0.15);
    }
    if (women && this.tex("tv_mt_women")) {
      const v = this.add(this.sc.add.sprite(SX + SW + 70, ground, "tv_mt_women", 0).setOrigin(0.5, 1).setScale(2));
      this.sc.tweens.add({ targets: v, x: SX + SW * 0.76, duration: 1300, ease: "Sine.easeOut" });
      const n = this.sc.textures.get("tv_mt_women").frameTotal - 1;
      this.later(1300, () => {
        for (let i = 0; i < n; i++) this.later(i * 110, () => v.active && v.setFrame(Math.min(n - 1, i)));
        this.sfx("gasp");
      });
      this.later(1500, () => this.crash(1.3, SX + SW * 0.72, SY + SH * 0.6));
    }
    this.handheld(1.5);
    return women ? 3200 : 2400;
  }

  private hearts(x: number, y: number) {
    for (let i = 0; i < 6; i++)
      this.later(i * 220, () => {
        const h = this.add(this.text(x + (Math.random() - 0.5) * 120, y, "♥", 22, "#ff6fa0").setOrigin(0.5));
        this.sc.tweens.add({ targets: h, y: y - 80, alpha: 0, duration: 1400, onComplete: () => h.destroy() });
      });
  }

  /** Censor bars on the see-through sacks (one per man in the queue). */
  private sackBars(img: Phaser.GameObjects.Image, n: number) {
    for (let i = 0; i < n; i++) {
      const x = img.x - img.displayWidth / 2 + (img.displayWidth / n) * (i + 0.5);
      this.add(this.sc.add.rectangle(x, img.y - img.displayHeight * 0.38, img.displayWidth / n * 0.45, img.displayHeight * 0.1, 0x000000));
    }
  }

  /** A censor bar that follows a figure. `big` covers rather more. */
  private censor(s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, big: boolean) {
    const w = s.displayWidth * (big ? 0.62 : 0.36);
    const h = s.displayHeight * (big ? 0.2 : 0.09);
    const bar = this.add(this.sc.add.rectangle(0, 0, w, h, 0x000000));
    const t = this.add(this.text(0, 0, big ? "CENSORED" : "", big ? 22 : 10, "#ffffff", { fontFamily: "Impact, sans-serif" }).setOrigin(0.5));
    const put = () => {
      const y = s.y - s.displayHeight * 0.4;
      bar.setPosition(s.x, y).setAngle(s.angle);
      t.setPosition(s.x, y).setAngle(s.angle);
    };
    put();
    this.every(16, put);
    return bar;
  }

  /** The seductive dance, at the mannequin. */
  private dance(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 1.4, blur: 1 });
    const ground = SY + SH * 0.94;
    this.prop("tv_mt_mannequin", SX + SW * 0.68, ground, 2.2);
    this.prop("tv_mt_speaker", SX + SW * 0.15, ground, 1.8);
    const key = this.tex("tv_mt_dance") ? "tv_mt_dance" : "tv_mt_sack";
    if (this.tex(key)) {
      const d = this.add(this.sc.add.sprite(SX + SW * 0.42, ground, key, 0).setOrigin(0.5, 1).setScale(2.3));
      const n = this.sc.textures.get(key).frameTotal - 1;
      if (n > 1) {
        let f = 0;
        this.every(140, () => d.active && d.setFrame((f = (f + 1) % n)));
        // the hips, such as they are
        this.sc.tweens.add({ targets: d, angle: { from: -4, to: 4 }, duration: 430, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      } else this.sc.tweens.add({ targets: d, angle: { from: -6, to: 6 }, duration: 420, yoyo: true, repeat: -1 });
      this.censor(d, false);
      this.sc.tweens.add({ targets: d, x: SX + SW * 0.55, duration: 3600, ease: "Sine.easeInOut" });
    }
    // disco-ish lights: electricity magic
    const g = this.add(this.sc.add.graphics().setBlendMode(Phaser.BlendModes.ADD));
    this.every(430, () => {
      g.clear();
      g.fillStyle([0xff3aa0, 0x3a8aff, 0xa040ff][Math.floor(Math.random() * 3)], 0.14);
      g.fillCircle(SX + Math.random() * SW, SY + Math.random() * SH * 0.6, 120);
    });
    this.handheld(1.2);
    return 3000;
  }

  /** "Sack off": a very large censor bar, and him shivering behind it. */
  private fullFrontal(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 1.6, blur: 2 });
    const key = this.tex("tv_mt_naked") ? "tv_mt_naked" : "tv_mt_sack";
    const s = this.prop(key, this.cx, SY + SH * 0.98, 3);
    if (s) {
      this.sc.tweens.add({ targets: s, x: s.x + 2, duration: 50, yoyo: true, repeat: -1 });
      this.censor(s, true);
    }
    this.sfx("zip_down");
    const t = this.over(this.text(SX + SW - 20, SY + SH - 70, "WE'LL FIX IT IN POST", 13, "#ffff66", { fontFamily: "Courier New, monospace", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(1, 0));
    this.later(2600, () => t.destroy(), true);
    void SW;
    return 2200;
  }

  /** The green screen goes up, and there they all are. */
  private greenScreen(): number {
    this.reveal = true;
    synth.stopMusic();
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex("tv_mt_audience"), { zoom: 1.05 });
    const crowd = this.cam.list[this.cam.list.length - 1] as Phaser.GameObjects.Image;
    this.sc.tweens.add({ targets: crowd, y: crowd.y - 4, duration: 180, yoyo: true, repeat: -1 });
    const gs = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x22ee22).setOrigin(0));
    this.sc.tweens.add({ targets: gs, y: SY - SH - 10, duration: 1600, ease: "Quad.in", delay: 400 });
    this.sfx("whistle");
    this.later(1700, () => {
      this.sfx("crowd_gasp");
      for (let i = 0; i < 6; i++) this.later(i * 120, () => this.sc.cameras.main.flash(50, 255, 255, 255));
      this.sfx("camera_burst");
      this.crash(1.15, this.cx, SY + SH * 0.6);
    });
    // his back to us, the bar still doing its job
    const s = this.prop(this.tex("tv_mt_naked") ? "tv_mt_naked" : "tv_mt_sack", SX + SW * 0.16, SY + SH + 60, 3);
    if (s) this.censor(s, true);
    return 3000;
  }

  private father(): number {
    this.clear();
    const { SY, SH } = this.r;
    this.backdrop(this.tex("tv_mt_audience"), { zoom: 2.2, blur: 3 });
    if (this.tex("tv_mt_father")) {
      const f = this.add(this.sc.add.sprite(this.cx, SY + SH + 10, "tv_mt_father", 0).setOrigin(0.5, 1).setScale(4.2));
      const n = this.sc.textures.get("tv_mt_father").frameTotal - 1;
      let k = 0;
      if (n > 1) this.every(110, () => f.active && f.setFrame((k = (k + 1) % n)));
      else this.sc.tweens.add({ targets: f, angle: { from: -5, to: 5 }, duration: 220, yoyo: true, repeat: -1 });
      // drool
      this.every(500, () => {
        const d = this.add(this.sc.add.circle(f.x + 6, f.y - f.displayHeight * 0.62, 3, 0xcfe8ff, 0.9));
        this.sc.tweens.add({ targets: d, y: d.y + 60, alpha: 0, duration: 900, onComplete: () => d.destroy() });
      });
    }
    this.sfx("groan");
    this.handheld(1.4);
    this.push(1.1, 3000, this.cx, SY + SH * 0.5);
    return 2800;
  }

  private arrest(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 1.3 });
    const ground = SY + SH * 0.96;
    const s = this.prop(this.tex("tv_mt_naked") ? "tv_mt_naked" : "tv_mt_sack", SX + SW * 0.5, ground, 2.4);
    if (s) this.censor(s, true);
    const cop = this.host.spriteFor("OFFICER");
    for (let i = 0; i < 3; i++) {
      if (!cop || !this.tex(cop)) break;
      const c = this.add(this.sc.add.sprite(SX + SW + 60 + i * 50, ground, cop, 0).setOrigin(0.5, 1));
      this.realScale(c, 3.2);
      c.setFlipX(true);
      this.sc.tweens.add({ targets: c, x: SX + SW * (0.62 + i * 0.1), duration: 700, delay: i * 150, ease: "Quad.out" });
    }
    // blue lights
    const b = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x2a5cff, 0.15).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
    this.every(240, () => b.setFillStyle(b.fillColor === 0x2a5cff ? 0xff2a3a : 0x2a5cff, 0.15));
    this.later(800, () => {
      this.sfx("punch");
      this.sc.cameras.main.shake(250, 0.01);
      if (s) s.setAngle(-8);
    });
    this.later(900, () => this.sfx("shell_casings"));
    this.handheld(2);
    return 1800;
  }

  private draggedOff(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 1.3, tint: 0x9aa0c0 });
    const ground = SY + SH * 0.96;
    const s = this.prop(this.tex("tv_mt_naked") ? "tv_mt_naked" : "tv_mt_sack", SX + SW * 0.45, ground, 2.4);
    if (s) {
      s.setAngle(-12);
      this.censor(s, true);
      this.sc.tweens.add({ targets: s, x: SX + SW + 140, duration: 3200, ease: "Sine.easeIn" });
    }
    const cop = this.host.spriteFor("OFFICER");
    if (cop && this.tex(cop) && s)
      for (let i = 0; i < 2; i++) {
        const c = this.add(this.sc.add.sprite(s.x + 70 + i * 40, ground, cop, 0).setOrigin(0.5, 1));
        this.realScale(c, 3.2);
        this.sc.tweens.add({ targets: c, x: SX + SW + 220 + i * 40, duration: 3200, ease: "Sine.easeIn" });
      }
    this.sfx("biglaugh");
    this.push(0.95, 3200);
    return 3000;
  }

  protected onSfx(): number {
    return 0;
  }

  protected onAudience(cue: string): number {
    if (!this.reveal) return 0;
    if (cue === "biglaugh" || cue === "laugh") {
      // the whole audience, shaking
      this.later(200, () => this.sc.cameras.main.shake(400, 0.004));
    }
    return 0;
  }

  protected onTransition(mode: string): number {
    if (mode === "fade") {
      synth.stopMusic();
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

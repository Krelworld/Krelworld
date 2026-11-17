import Phaser from "phaser";
import { F, ShowDirector, faceKeyOf, type Perf } from "./ShowDirector";

/**
 * A British soap (EastEnders). Grey, wet and close: the titles over an aerial map of the river; the Square at
 * night (with the pub on the corner) before we go into anybody's house; over-the-shoulder two-handers across the
 * bar; slow push-ins on every face that's about to say something it'll regret; crash zooms on the horror. It
 * ends the only way it can: a freeze on a face, and the drums. Doof. Doof.
 */

type Place = "flat" | "vic" | "cellar" | "press" | "cockpit" | "bunker" | "other";

const SETS: Record<Place, string> = {
  flat: "tv_ee_flat",
  vic: "tv_ee_vic",
  cellar: "tv_ee_cellar",
  press: "tv_ee_press",
  cockpit: "tv_ee_cockpit",
  bunker: "tv_bunker",
  other: "",
};

export class SoapDirector extends ShowDirector {
  private place: Place = "other";
  private group = "";
  private titles = 0;
  private doof = false;
  private frozenOn = "";
  /** two-handers: who they're talking to */
  private partner: Record<string, string> = {};

  private where(set: string): Place {
    const s = set.toUpperCase();
    if (s.includes("CELLAR")) return "cellar";
    if (s.includes("QUEEN VIC")) return "vic";
    if (s.includes("LIVING ROOM") || s.includes("GROZZ")) return "flat";
    if (s.includes("PRESS")) return "press";
    if (s.includes("COCKPIT")) return "cockpit";
    if (s.includes("BUNKER")) return "bunker";
    return "other";
  }

  private setImg() {
    return this.tex(SETS[this.place]) ?? this.host.setTexture();
  }

  /** The grade: a cold, slightly dingy wash over everything. */
  private grade() {
    if (this.gfx.list.some((o) => o.getData?.("grade"))) return;
    const { SX, SY, SW, SH } = this.r;
    this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0x1a2a3a, 0.14).setOrigin(0).setData("grade", true));
    const v = this.over(this.sc.add.graphics().setData("grade", true));
    for (let i = 0; i < 5; i++) {
      v.lineStyle(16, 0x000000, 0.09);
      v.strokeRect(SX + i * 10, SY + i * 10, SW - i * 20, SH - i * 20);
    }
  }

  // ------------------------------------------------------------------ titles

  protected onTitle(t: string): number {
    this.titles++;
    if (this.titles === 1) return this.openingTitles(t);
    return this.endCredits(t);
  }

  /** The aerial map of the river, turning slowly, and the name across it. */
  private openingTitles(t: string): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const img = this.backdrop(this.tex("tv_ee_aerial"), { zoom: 1.5 });
    this.sc.tweens.add({ targets: img, angle: 8, scale: img.scale * 0.85, duration: 5200, ease: "Sine.easeOut" });
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x0a1a40, 0.35).setOrigin(0));
    const [show, sub] = t.split(/:\s*/);
    const logo = this.add(this.text(this.cx, this.cy - 20, show, 58, "#ffffff", { fontFamily: "Arial Black, Arial, sans-serif", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0).setScale(1.25));
    logo.setShadow(0, 0, "#9fc8ff", 14, true, true);
    this.sc.tweens.add({ targets: logo, alpha: 1, scale: 1, duration: 1400, delay: 500, ease: "Quad.out" });
    if (sub) {
      const s = this.add(this.text(this.cx, this.cy + 40, sub, 20, "#d7e8ff", { fontStyle: "bold", align: "center" }).setOrigin(0.5).setAlpha(0));
      this.sc.tweens.add({ targets: s, alpha: 1, duration: 700, delay: 1700 });
    }
    this.sfx("tv_doof");
    return 4800;
  }

  /** The cliffhanger's questions, as end credits over the river. */
  private endCredits(t: string): number {
    if (this.titles === 2) {
      this.clear();
      const img = this.backdrop(this.tex("tv_ee_aerial"), { zoom: 1.2, tint: 0x8aa6d0 });
      this.sc.tweens.add({ targets: img, angle: -6, duration: 9000 });
      // the frozen face, shrunk into the corner as the credits start
      const fk = faceKeyOf(this.frozenOn || "PEGGY");
      if (this.tex(fk)) {
        const f = this.add(this.sc.add.sprite(this.r.SX + 100, this.r.SY + this.r.SH - 10, fk, F.ALARM).setOrigin(0.5, 1).setScale(1.4).setTint(0x8aa0c0));
        f.setAlpha(0.85);
      }
    }
    this.clearGfx();
    this.grade();
    const lines = this.over(this.text(this.cx + 60, this.cy, t, 18, "#ffffff", { fontStyle: "bold", align: "center", wordWrap: { width: this.r.SW - 200 }, stroke: "#0a1a40", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: lines, alpha: 1, y: lines.y - 10, duration: 600 });
    return 1200;
  }

  // ------------------------------------------------------------------ scenes

  protected onShot(set: string, _framing: string, fresh: boolean): number {
    if (!fresh) return 0;
    const p = this.where(set);
    const grp = p === "flat" ? "flat" : p === "vic" || p === "cellar" ? "vic" : p;
    const establish = (grp === "flat" || grp === "vic") && grp !== this.group && p !== "cellar";
    this.place = p;
    this.group = grp;
    this.grade();
    if (establish) {
      this.square(grp === "vic");
      this.later(1700, () => this.wide());
      return 1900;
    }
    if (p === "press") return this.tellyPresser();
    this.wide();
    return p === "cockpit" ? 600 : 300;
  }

  /** EXT. the Square at night, rain, the pub on the corner (or the houses, for somebody's flat). */
  private square(pub: boolean) {
    this.clear();
    this.kenBurns(this.tex("tv_ee_square"), { z: 1.35, x: pub ? 120 : -120, y: 10 }, { z: 1.2, x: pub ? 90 : -90, y: 0 }, 2200);
    const rain = this.add(this.sc.add.graphics());
    const { SX, SY, SW, SH } = this.r;
    this.every(70, () => {
      rain.clear();
      rain.lineStyle(1, 0xaebfd8, 0.45);
      for (let i = 0; i < 46; i++) {
        const x = SX + Math.random() * SW;
        const y = SY + Math.random() * SH;
        rain.lineBetween(x, y, x - 4, y + 14);
      }
    });
  }

  /** the last wide was shot from the chest up (see wide()) */
  private busts = false;

  /** Everyone in the room. */
  private wide(except = "") {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setImg());
    const cast = this.cast.filter((n) => n !== except && (!/^(ADVISOR)$/.test(n) || this.place === "bunker"));
    const n = cast.length;
    const ground = SY + SH * 0.93;
    // from the chest up when everyone has a close-up sheet (the cellar keeps its full-length shot: Minty's suspenders)
    const busts = (this.busts = n > 0 && this.place !== "cellar" && cast.every((nm) => this.hasFace(nm)));
    cast.forEach((nm, i) => {
      const x = SX + SW / 2 + (i - (n - 1) / 2) * Math.min(busts ? 150 : 130, (SW - 140) / Math.max(1, n - 1));
      const kid = /SCRIMBLE|PHEZON/.test(nm);
      const s = busts
        ? this.bust(nm, x, SY + SH + 6 + (i % 2) * 14 + (kid ? 20 : 0), SH * (kid ? 0.4 : n <= 3 ? 0.58 : 0.5))
        : this.body(nm, x, ground - (i % 2) * 8, SH * (kid ? 0.3 : 0.46));
      if (!s) return;
      if (!busts) s.setFlipX(x > this.cx);
      if (nm === "MINTY" && this.place === "cellar") {
        // "nothing but suspenders"
        const g = this.add(this.sc.add.rectangle(s.x, s.y - s.displayHeight * 0.32, s.displayWidth * 0.36, s.displayHeight * 0.12, 0x000000));
        const t = this.add(this.text(g.x, g.y, "CENSORED", 11, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5));
        void t;
      }
      this.breathe(s, 1500 + i * 170);
    });
    // Wellard, the juicing contraption strapped to him
    if (this.place === "cellar" && this.tex("tv_p2_wellard")) {
      const w = this.add(this.sc.add.image(SX + SW * 0.8, ground + 4, "tv_p2_wellard").setOrigin(0.5, 1).setScale((SH * 0.3) / 128));
      this.sc.tweens.add({ targets: w, angle: { from: -2, to: 2 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.push(1.08, 5000, this.cx, SY + SH * 0.6);
  }

  /** "Put the telly on": the press conference on the pub's telly, then on ours. */
  private tellyPresser(): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex("tv_ee_vic"), { zoom: 1.6, blur: 2, ox: -60 });
    const tv = this.add(this.sc.add.container(this.cx, this.cy - 10));
    tv.add(this.sc.add.rectangle(0, 0, 300, 230, 0x1a1a1a).setStrokeStyle(6, 0x3a3a3a));
    const inner = this.sc.add.image(0, -6, this.tex("tv_ee_press") ?? "tv_press");
    const src = inner.texture.getSourceImage() as HTMLImageElement;
    inner.setScale(Math.max(270 / src.width, 190 / src.height));
    tv.add(inner);
    // the PM on the pub telly: his close-up art, or his old stage sprite
    if (this.hasFace("KEIR STARMER")) tv.add(this.sc.add.sprite(0, 89, faceKeyOf("KEIR STARMER"), 0).setOrigin(0.5, 1).setScale(1.45));
    else {
      const k = this.host.spriteFor("KEIR STARMER");
      if (k) tv.add(this.realScale(this.sc.add.sprite(0, 80, k, 0).setOrigin(0.5, 1), 2));
    }
    tv.add(this.sc.add.rectangle(0, -6, 270, 190, 0x9fc8ff, 0.08));
    this.later(1400, () => this.push(2.4, 900, this.cx, this.cy - 16, "Quad.in"));
    void SX;
    void SW;
    void SH;
    return 2300;
  }

  // ------------------------------------------------------------------ dialogue

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (this.doof) return 0;
    if (this.place === "press") return this.presserLine(name, text, emotion);
    const other = this.partner[name] ?? this.cast.find((n) => n !== name && !/SCRIMBLE|PHEZON/.test(n)) ?? "";
    if (this.lastSpeaker && this.lastSpeaker !== name) {
      this.partner[name] = this.lastSpeaker;
      this.partner[this.lastSpeaker] = name;
    }
    const e = emotion.toLowerCase();
    const angry = /bitch|now\.|fucking/i.test(text) || /furious|pointing/.test(e);
    const stay = this.perf?.name === name;
    let p: Perf | null;
    if (stay) p = this.perf;
    else p = this.ots(name, other);
    if (!p) return 0;
    if (p.face) {
      if (/^you… you/i.test(text) || /trembl/.test(e)) {
        p.base = F.ALARM;
        p.spr.setFrame(F.ALARM);
      } else if (angry && name === "PHIL") p.base = F.ALARM;
      else if (name === "MINTY") p.base = F.ALARM;
    }
    // every face gets the slow push: something is about to go wrong
    this.push(stay ? 1.12 : 1.07, 4200, p.spr.x, p.spr.y - (p.face ? 230 : 330));
    if (/pacing/.test(e) || (name === "PHIL" && /wrap my head/i.test(text))) this.pace(p);
    this.talk(p, name, text, emotion);
    return 0;
  }

  /** Over the shoulder: the speaker, and the back of the listener's head big in the corner. */
  private ots(name: string, listener: string) {
    const side = this.hash(name) % 2 ? 1 : -1;
    const p = this.single(name, { side: side * 0.55, bg: this.setImg(), recut: true, blur: 2 });
    if (!p) return null;
    const tex = listener ? this.host.spriteFor(listener) : null;
    if (listener && this.hasFace(listener)) {
      // their close-up as a soft dark shape in the corner (the back of their head and a shoulder)
      const { SX, SY, SW, SH } = this.r;
      const back = this.add(this.sc.add.sprite(side > 0 ? SX + SW * 0.06 : SX + SW * 0.94, SY + SH + 30, faceKeyOf(listener), 0).setOrigin(0.5, 1).setScale(3.6).setTint(0x232a36));
      back.preFX?.addBlur(1, 3, 3, 1.2);
      back.setFlipX(side < 0);
      this.sc.tweens.add({ targets: back, x: back.x + side * -6, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else if (tex && tex.startsWith("spr_TV_") && this.sc.textures.exists(tex)) {
      const { SX, SY, SW, SH } = this.r;
      const back = this.add(this.sc.add.sprite(side > 0 ? SX + SW * 0.08 : SX + SW * 0.92, SY + SH * 0.5, tex, 5).setOrigin(0.5, 0).setTint(0x46505e));
      this.realScale(back, 9);
      back.setFlipX(side < 0);
      this.sc.tweens.add({ targets: back, x: back.x + side * -6, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      void SY;
      void SH;
    }
    return p;
  }

  private pace(p: Perf) {
    this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 70, duration: 1200, yoyo: true, repeat: 2, ease: "Sine.easeInOut" });
  }

  private presserLine(name: string, text: string, emotion: string): number {
    const p = this.perf?.name === name ? this.perf : this.single(name, { bg: this.tex("tv_ee_press"), zoom: 1.15, blur: 0, recut: true, scale: this.hasFace(name) ? 2.9 : (this.r.SH * 0.95) / 64 });
    if (!p) return 0;
    if (!p.face) p.spr.setY((p.y = this.r.SY + this.r.SH * 1.1));
    this.push(1.05, 4000, p.spr.x, this.r.SY + 200);
    this.talk(p, name, text, emotion);
    return 0;
  }

  // ------------------------------------------------------------------ action

  protected onDirection(a: string): number {
    if (/DOOF DOOF/i.test(a)) {
      this.doof = true;
      this.sfx("tv_doof");
      // pull out from the freeze
      this.push(1.0, 2600, this.cx, this.cy, "Sine.easeInOut");
      return 2400;
    }
    if (this.doof) return 0;
    if (/lets out an earth-shattering fart/i.test(a)) {
      this.wide();
      return 300;
    }
    if (/fight over/i.test(a)) {
      this.kids();
      return 1200;
    }
    if (/SHEZLEIGH, 30s/.test(a)) {
      const p = this.single("SHEZLEIGH", { side: 0.5, bg: this.setImg(), recut: true });
      if (p) this.push(1.1, 3000, p.spr.x, p.spr.y - 240);
      return 1200;
    }
    if (/PHIL MITCHELL enters/i.test(a)) return this.entrance("PHIL");
    if (/slams his hand/i.test(a)) {
      const p = this.single("PHIL", { side: 0.4, bg: this.setImg(), recut: true, expr: F.ALARM });
      if (p && this.tex("tva_phil_slam")) {
        // the fist goes up and comes down on the bar (the [SFX smash] lands on it)
        this.clipOver(p, "phil_slam", { fps: 10, back: F.ALARM });
        this.later(560, () => {
          this.crash(1.2, p.spr.x, p.spr.y - 220);
          this.impact("pow", p.spr.x + 60, this.r.SY + this.r.SH - 20, 2.2, 0.014);
          this.sfx("punch");
        });
        return 800;
      }
      if (p) this.later(500, () => this.crash(1.2, p.spr.x, p.spr.y - 220));
      return 700;
    }
    if (/eyes dart/i.test(a)) {
      const p = this.react("PEGGY", F.ALARM, { side: -0.5, bg: this.setImg() });
      if (p) this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 10, duration: 160, yoyo: true, repeat: 3 });
      return 600;
    }
    if (/MINTY winces/i.test(a) || /storms back upstairs/i.test(a)) {
      this.react("MINTY", F.ALARM, { side: 0.4, bg: this.setImg(), push: 1.1 });
      return 600;
    }
    if (/pours a pint/i.test(a) || /starts to pour another/i.test(a)) return this.pint(/trembling/i.test(a));
    if (/visibly flinches/i.test(a)) {
      this.react("PEGGY", F.ALARM, { side: -0.5, bg: this.setImg(), push: 1.08 });
      return 600;
    }
    if (/eyes widen in horror/i.test(a)) {
      const p = this.react("PHIL", F.ALARM, { side: 0, bg: this.setImg() });
      if (p) this.crash(1.25, p.spr.x, p.spr.y - 230);
      return 900;
    }
    if (/stares at his own can/i.test(a)) {
      const p = this.react("GROZZ", F.ALARM, { side: 0, bg: this.setImg() });
      if (p) {
        this.push(1.18, 3200, p.spr.x, p.spr.y - 230);
        this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 2, duration: 60, yoyo: true, repeat: -1 });
      }
      return 1200;
    }
    if (/biting chunks/i.test(a)) {
      this.wide();
      this.kidsBite();
      return 1500;
    }
    if (/Krozno's bandits occupy/i.test(a)) {
      const p = this.single("KROZNO", { side: -0.45, bg: this.setImg(), recut: true, zoom: 1.3, blur: 1 });
      if (p) this.push(1.08, 3000, p.spr.x, p.spr.y - 220);
      return 1000;
    }
    if (/BIG BEN looms/i.test(a)) {
      this.clear();
      const img = this.backdrop(this.setImg(), { zoom: 1.1 });
      this.sc.tweens.add({ targets: img, scale: img.scale * 1.9, x: img.x - 280, y: img.y + 200, duration: 2400, ease: "Sine.easeIn" });
      this.sfx("jet");
      return 2200;
    }
    if (/huddled with advisors/i.test(a)) {
      this.wide();
      return 600;
    }
    return 0;
  }

  protected onSfx(id: string): number {
    if (id !== "boom" && id !== "smash" && id !== "gulp" && id !== "gasp") return 0;
    if (id === "gasp" && this.place === "press") {
      // camera flashes from the unseen journalists
      for (let i = 0; i < 5; i++) this.later(i * 140 + Math.random() * 60, () => this.sc.cameras.main.flash(60, 255, 255, 255));
      return 0;
    }
    if (id === "smash") {
      this.sc.cameras.main.shake(260, 0.012);
      return 0;
    }
    if (id !== "boom") return 0;
    // the fart
    if (this.place === "flat" && !this.doof && this.idx < 6) {
      this.sc.cameras.main.shake(500, 0.012);
      const g = this.single("GROZZ", { side: 0.3, bg: this.setImg(), recut: true });
      if (g) {
        this.fx("vfx_fart", g.spr.x - 60, this.r.SY + this.r.SH - 30, { scale: 4 });
        this.later(250, () => this.fx("vfx_fart", g.spr.x + 50, this.r.SY + this.r.SH - 20, { scale: 3 }));
      }
      return 600;
    }
    // the cliffhanger: freeze on the face that's just been caught out. Every drum hit punches in.
    if (!this.doof && this.frozenOn === "") return this.freeze();
    if (this.doof || this.frozenOn) {
      this.crash(this.cam.scale + 0.04, this.cx, this.cy);
      this.sc.cameras.main.flash(80, 200, 220, 255);
    }
    return 0;
  }

  /** The freeze: Peggy, caught. Grey-blue, still, a crash zoom. */
  private freeze(): number {
    this.frozenOn = "PEGGY";
    const p = this.single("PEGGY", { side: -0.2, bg: this.setImg(), recut: true, expr: F.ALARM });
    if (p) {
      this.sc.tweens.killTweensOf(p.spr);
      for (const t of this.timers) t.remove();
      this.timers = [];
      for (const o of this.cam.list) (o as unknown as Phaser.GameObjects.Components.Tint).setTint?.(0x9aa8c8);
      this.crash(1.28, p.spr.x, p.spr.y - 250);
    }
    this.sc.cameras.main.flash(120, 255, 255, 255);
    return 900;
  }

  private entrance(name: string): number {
    this.wide(name);
    const { SX, SW, SY, SH } = this.r;
    const s = this.busts && this.hasFace(name) ? this.bust(name, SX + SW + 70, SY + SH + 6, SH * 0.54) : this.body(name, SX + SW + 50, SY + SH * 0.95, SH * 0.5);
    if (!s) return 0;
    if (!s.texture.key.startsWith("tvface_")) s.setFlipX(true);
    this.sfx("door");
    this.sc.tweens.add({ targets: s, x: SX + SW * 0.68, duration: 1300, ease: "Sine.easeOut" });
    this.sc.tweens.add({ targets: s, y: s.y - 4, duration: 170, yoyo: true, repeat: 3 });
    return 1400;
  }

  private kids() {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 1.5, oy: -40, blur: 1 });
    const faces = this.hasFace("SCRIMBLE") && this.hasFace("PHEZON");
    const a = faces ? this.bust("SCRIMBLE", SX + SW * 0.36, SY + SH + 6, SH * 0.8) : this.body("SCRIMBLE", SX + SW * 0.4, SY + SH + 20, SH * 0.75);
    const b = faces ? this.bust("PHEZON", SX + SW * 0.64, SY + SH + 6, SH * 0.7) : this.body("PHEZON", SX + SW * 0.6, SY + SH + 20, SH * 0.62);
    if (b && !faces) b.setFlipX(true);
    for (const s of [a, b]) if (s) this.sc.tweens.add({ targets: s, x: s.x + (s === a ? 14 : -14), angle: s === a ? 6 : -6, duration: 130, yoyo: true, repeat: -1 });
    this.handheld(2);
  }

  private kidsBite() {
    const { SX, SY, SW, SH } = this.r;
    for (let i = 0; i < 8; i++) {
      const c = this.add(this.sc.add.rectangle(SX + SW * 0.3 + Math.random() * 100, SY + SH * 0.78, 8, 6, 0x5a4a3a));
      this.sc.tweens.add({ targets: c, y: c.y - 40 - Math.random() * 40, x: c.x + (Math.random() - 0.5) * 80, alpha: 0, duration: 700, delay: i * 160 });
    }
    this.later(200, () => this.sfx("punch"));
  }

  /** A pint of something frothy and suspiciously opaque. */
  private pint(trembling: boolean): number {
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setImg(), { zoom: 2.2, blur: 2, oy: 40 });
    const glass = this.add(this.sc.add.container(this.cx, SY + SH * 0.62));
    const liquid = this.sc.add.rectangle(0, 72, 82, 120, 0xf1e6c8).setOrigin(0.5, 1).setScale(1, 0);
    glass.add(liquid);
    const head = this.sc.add.rectangle(0, 72, 82, 22, 0xffffff).setOrigin(0.5, 1).setScale(1, 0);
    glass.add(head);
    glass.add(this.sc.add.rectangle(0, 0, 90, 150, 0xffffff, 0.18).setStrokeStyle(4, 0xdfe8ff, 0.8));
    const tap = this.add(this.sc.add.rectangle(this.cx, SY - 10, 26, 120, 0xb8902a).setOrigin(0.5, 0));
    const stream = this.add(this.sc.add.rectangle(this.cx, SY + 110, 6, SH * 0.62 - 110 + 72, 0xf1e6c8, 0.9).setOrigin(0.5, 0));
    this.sc.tweens.add({ targets: liquid, scaleY: 1, duration: 1500 });
    this.sc.tweens.add({ targets: head, scaleY: 1, y: 72 - 120, duration: 1500 });
    this.later(1500, () => stream.setVisible(false));
    if (trembling) this.every(50, () => (glass.x = this.cx + (Math.random() - 0.5) * 6), 30);
    this.sfx("splash");
    void tap;
    void SX;
    void SW;
    return 1600;
  }
}

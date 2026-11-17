import Phaser from "phaser";
import { F, ShowDirector, faceKeyOf, type Perf } from "./ShowDirector";
import { MUSIC_FILES } from "../../audio/Synth";
import { G } from "../../G";
import { billboardPanel, BILLBOARD_FACE, type Billboard } from "./tccBillboards";

/**
 * A multi-camera studio sitcom (Thick Cumming Cock). Shot the way they are: a cold open, then a title sequence
 * with the theme and the cast's freeze-frames; an exterior of the building (and a slap-bass sting) whenever we go
 * to a new scene; the studio set seen square-on from the front, three cameras (the master wide, a two-shot, and a
 * single on each side); people make entrances through the door to applause; on a laugh the picture holds on
 * whoever just got the punchline. Ends with a freeze-frame "TO BE CONTINUED" and the credits.
 */

const SET = "tv_tcc_set";
const EXT = "tv_tcc_ext";
const AUDIENCE = "tv_tcc_audience";

/**
 * The cast's full-figure studio sheets (public/art/tv/body_<NAME>.png, 96x160 frames): standing, a talking
 * animation, a walk, sitting and asleep. Anyone without one is played by their TV sprite.
 */
type Body = { key: string; stand?: number; talk?: [number, number]; talkPose: string; walk?: [number, number]; sit?: number; snore?: [number, number]; flipStand?: boolean; flip?: boolean };
const BODY: Record<string, Body> = {
  "CHRISTOPHER THICK": { key: "tvbody_CHRISTOPHER_THICK", stand: 0, talk: [1, 8], talkPose: "", walk: [9, 8], sit: 17, snore: [18, 4], flipStand: true },
  "JENNY CUMMING": { key: "tvbody_JENNY_CUMMING", sit: 0, talk: [1, 8], talkPose: "sit" },
  // ep 7's new cast: one PixelLab figure each (public/art/tv/body_<NAME>.png); `flip` turns them to face the room
  "LILA MINT": { key: "tvbody_LILA_MINT", stand: 0, talkPose: "", flip: true },
  "JOHN COCK": { key: "tvbody_JOHN_COCK", sit: 0, talkPose: "sit", flip: true },
  BRENDA: { key: "tvbody_BRENDA", stand: 0, talkPose: "" },
  "MOM 1": { key: "tvbody_MOM_1", stand: 0, talkPose: "" },
  "MOM 2": { key: "tvbody_MOM_2", stand: 0, talkPose: "" },
};
/** Jenny by day: the same chair, a coffee mug instead of the wine. */
const JENNY_DAY: Body = { key: "tvbody_JENNY_CUMMING_DAY", sit: 0, talkPose: "sit" };

/** Ep 7's day sets (TCC_EP07.sets): the two at the firm open on the building by day, the rest on the place itself. */
const EXT_DAY = "tv_tcc_ext_day";
const AT_THE_FIRM = new Set(["tv_tcc_pitch", "tv_tcc_bullpen"]);
/** Where a billboard stands in a set, in the set's own pixels (256x192): centre x, top y, width. */
const SET_BILLBOARD: Record<string, { which: Billboard; x: number; y: number; w: number }> = {
  tv_tcc_cafe: { which: "seniors", x: 35, y: 16, w: 66 },
  tv_tcc_school: { which: "kids", x: 206, y: 2, w: 92 },
};
/** The montage: each billboard going up, and where. */
const MONTAGE_AT: Record<string, { bg: string; flip?: boolean }> = {
  seniors: { bg: "tv_tcc_bb_street" },
  refugees: { bg: "tv_tcc_bb_highway" },
  kids: { bg: "tv_tcc_school" },
  ds: { bg: "tv_tcc_bb_street", flip: true },
  nuns: { bg: "tv_tcc_bb_highway", flip: true },
};

interface Onstage {
  x: number;
  pose: string;
}

export class SitcomDirector extends ShowDirector {
  /** who's on the set, where (wide-shot x) and how (sit / asleep / lap) */
  private stage: Record<string, Onstage> = {};
  private props = new Set<string>();
  /** what the camera's on: "wide", "two", "single", "ext", "card"... */
  private shotKind = "";
  private titleDone = false;
  private linesThisShot = 0;
  private nyc = false;
  private frozen = false;
  private plane: Phaser.GameObjects.Container | null = null;

  private sideOf(name: string) {
    if (name.startsWith("JENNY")) return -1;
    if (name.startsWith("CHRISTOPHER")) return 1;
    if (name === "REPORTER" || name === "BRENDA") return -1;
    const i = this.cast.indexOf(name);
    return i % 2 ? 1 : -1;
  }

  private setKey() {
    const k = this.host.setTexture();
    if (this.nyc) return "tv_nyc_skyline";
    return this.tex(SET) && /office/.test(k) ? SET : k;
  }

  /** TCC's reporter has her own face (the stock REPORTER is other shows'). */
  protected faceKey(name: string) {
    return name === "REPORTER" ? "tvface_TCC_REPORTER" : super.faceKey(name);
  }

  // ------------------------------------------------------------------ shots

  protected onShot(set: string, framing: string, fresh: boolean): number {
    this.linesThisShot = 0;
    const f = framing.toUpperCase();
    if (/nyc|new york/i.test(set)) {
      this.nyc = true;
      this.skyline();
      return 0;
    }
    this.nyc = false;
    if (fresh) {
      // a new scene: nobody's on the set yet (the blocking that follows puts them there)
      this.stage = {};
      this.props.delete("slide");
      if (/montage/i.test(set)) {
        this.clear();
        this.shotKind = "montage";
        this.backdrop(this.tex("tv_tcc_bb_street"), { blur: 3, tint: 0x9a9a9a });
        this.sfx("tv_sting");
        return 600;
      }
      const k = this.host.setTexture();
      if (k.startsWith("tv_tcc_") && !AT_THE_FIRM.has(k)) {
        // out on location: straight onto the place, with the sting
        this.sfx("tv_sting");
        this.wide();
        return 900;
      }
      // the outside of the building first, with the sting (by day, for the day scenes at the firm)
      this.exterior(AT_THE_FIRM.has(k));
      return 2200;
    }
    if (f.includes("CLOSE")) {
      const who = f.includes("JENNY") ? "JENNY CUMMING" : f.includes("CHRISTOPHER") ? "CHRISTOPHER THICK" : this.lastSpeaker;
      const p = this.single(who, { side: this.sideOf(who) * 0.6, bg: this.setKey(), scale: 3.45, zoom: 2, recut: true, expr: this.restingFrame(who) });
      if (p) this.push(1.06, 2500, p.spr.x, p.spr.y - 230);
      this.shotKind = "single";
      return 0;
    }
    if (f.includes("TWO")) this.two();
    else this.wide();
    return 0;
  }

  /** EXT. establishing shot: the building at night (or by day), a cab going past, the sting. */
  private exterior(day = false) {
    this.clear();
    this.shotKind = "ext";
    const { SX, SY, SW, SH } = this.r;
    this.kenBurns(this.tex(day && this.tex(EXT_DAY) ? EXT_DAY : EXT), { z: 1.12, x: 0, y: 26 }, { z: 1.02, x: 0, y: -8 }, 2400);
    // windows flicker on and off (at night)
    const g = this.add(this.sc.add.graphics());
    if (!day) this.every(240, () => {
      g.clear();
      for (let i = 0; i < 6; i++) {
        g.fillStyle(0xfff2b0, Math.random() * 0.5);
        g.fillRect(SX + 140 + Math.random() * 280, SY + 60 + Math.random() * 220, 8, 6);
      }
    });
    const cab = this.add(this.sc.add.rectangle(SX - 60, SY + SH - 40, 46, 16, 0xf2c94c).setOrigin(0.5));
    this.sc.tweens.add({ targets: cab, x: SX + SW + 60, duration: 2200, ease: "Linear" });
    this.sfx("tv_sting");
  }

  /** A point on a set's still (the current one by default), as backdrop() draws it with no zoom. */
  private setPt(ix: number, iy: number, key = this.setKey()) {
    const { SX, SY, SW, SH } = this.r;
    const src = this.sc.textures.exists(key) ? (this.sc.textures.get(key).getSourceImage() as HTMLImageElement) : { width: 256, height: 192 };
    const s = Math.max(SW / src.width, SH / src.height);
    return { x: SX + SW / 2 + (ix - src.width / 2) * s, y: SY + SH / 2 + (iy - src.height / 2) * s, s };
  }

  /** Where people are on the set in the wide shot. */
  private place(name: string) {
    const { SX, SW } = this.r;
    if (!this.stage[name]) this.stage[name] = { x: SX + SW * (this.sideOf(name) < 0 ? 0.33 : 0.68), pose: "" };
    return this.stage[name];
  }

  /** The master: the whole set, everyone on it. */
  private wide(push = true) {
    this.clear();
    this.shotKind = "wide";
    const { SY, SH } = this.r;
    const key = this.setKey();
    this.backdrop(key);
    this.dressBehind(key);
    // at the press conference: up on the little stage, behind the lectern
    if (key === "tv_tcc_presser") this.drawPeople(this.setPt(0, 124).y, SH * 0.3);
    else this.drawPeople(SY + SH * 0.9, SH * 0.44);
    this.dressFront(key);
    if (push) this.push(1.04, 4000, this.cx, SY + SH * 0.6);
  }

  // ------------------------------------------------------------------ ep 7's sets

  /** The set's own furniture behind the cast: a billboard out there, the slide on the screen. */
  private dressBehind(key: string) {
    const bb = SET_BILLBOARD[key];
    if (bb) this.billboardAt(bb.which, bb.x, bb.y, bb.w, key);
    if (key === "tv_tcc_pitch" && this.props.has("slide")) {
      // Lila's first slide, up on the pull-down screen on the left wall
      const a = this.setPt(7, 14);
      const b = this.setPt(43, 78);
      this.add(this.sc.add.rectangle(a.x, a.y, b.x - a.x, b.y - a.y, 0x8fc8f0).setOrigin(0));
      this.miniBillboard("seniors", (a.x + b.x) / 2, a.y + (b.y - a.y) * 0.3, b.x - a.x - 8);
    }
  }

  /** In front of the cast: the café table (the grandmas sit behind it), the lectern and the press's flashbulbs. */
  private dressFront(key: string) {
    const { SX, SY, SW, SH } = this.r;
    if (key === "tv_tcc_cafe") {
      const xs = Object.values(this.stage).map((o) => o.x);
      const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : this.cx;
      const y = SY + SH * 0.86;
      const g = this.add(this.sc.add.graphics());
      g.fillStyle(0x5a3a22, 1).fillRect(mid - 8, y, 16, SH * 0.2);
      g.fillStyle(0xf4efe4, 1).fillEllipse(mid, y, SW * 0.5, 44);
      g.lineStyle(3, 0xd8cdb8, 1).strokeEllipse(mid, y, SW * 0.5, 44);
      for (let i = -8; i <= 8; i++) g.fillStyle(0xf4efe4, 1).fillCircle(mid + i * SW * 0.03, y + 20, 6);
      // the tea things
      g.fillStyle(0xffffff, 1).fillRect(mid - 70, y - 22, 22, 16).fillRect(mid + 50, y - 22, 22, 16);
      g.fillStyle(0x9ad0e8, 1).fillRect(mid - 70, y - 22, 22, 4).fillRect(mid + 50, y - 22, 22, 4);
      g.fillStyle(0xf0f0f0, 1).fillEllipse(mid - 59, y - 5, 36, 8).fillEllipse(mid + 61, y - 5, 36, 8);
      g.fillStyle(0xd85a6a, 1).fillCircle(mid - 4, y - 18, 16);
      g.fillStyle(0xd85a6a, 1).fillRect(mid + 8, y - 26, 14, 5);
    }
    if (key === "tv_tcc_presser") {
      const x = this.stage["CHRISTOPHER THICK"]?.x ?? this.cx;
      const top = this.setPt(0, 124).y;
      if (this.tex("tcc_podium")) {
        // the lectern (PixelLab): its body is pixels 20-77 of a 64x96 frame
        const pod = this.add(this.sc.add.image(x, top + SH * 0.05, "tcc_podium").setOrigin(0.5, 77 / 96));
        pod.setScale((SH * 0.3) / 57);
        const ps = pod.scale;
        this.add(this.text(x, pod.y - 26 * ps, "THICK\nCUMMING\nCOCK", Math.max(9, Math.round(5 * ps)), "#ffe14a", { fontStyle: "bold", align: "center", stroke: "#1a2a4a", strokeThickness: 3, lineSpacing: -2 }).setOrigin(0.5));
      }
      this.flashbulbs();
    }
    void SX;
  }

  /** The press, popping away. Slower and softer with calm flashes on. */
  private flashbulbs() {
    const calm = !!G.meta?.settings?.calmFlash;
    const { SX, SY, SW, SH } = this.r;
    this.every(calm ? 1100 : 420, () => {
      const x = SX + 30 + Math.random() * (SW - 60);
      const y = SY + SH * (0.72 + Math.random() * 0.2);
      const f = this.add(this.sc.add.circle(x, y, calm ? 10 : 16, 0xffffff, calm ? 0.3 : 0.9));
      this.sc.tweens.add({ targets: f, alpha: 0, scale: 1.8, duration: calm ? 700 : 220, onComplete: () => f.destroy() });
      if (Math.random() < 0.35) this.sfx("camera_flash");
    }, 14);
  }

  /** The phones, ringing off the hook. */
  private ringing() {
    const { SX, SY, SW, SH } = this.r;
    const spots = [0.18, 0.42, 0.62, 0.8];
    let n = 0;
    this.every(260, () => {
      const x = SX + SW * spots[n % spots.length] + (Math.random() - 0.5) * 30;
      const y = SY + SH * (0.4 + Math.random() * 0.12);
      const t = this.add(this.text(x, y, "RING!", 15, "#ffe14a", { fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setAngle((Math.random() - 0.5) * 24));
      this.sc.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 700, onComplete: () => t.destroy() });
      if (n % 2 === 0) this.sfx("ding");
      n++;
    }, 14);
  }

  /** A billboard standing in a set, placed in the set's own pixels. */
  private billboardAt(which: Billboard, ix: number, iy: number, iw: number, key: string) {
    const a = this.setPt(ix - iw / 2, iy, key);
    const w = iw * a.s;
    return this.billboardFrame(which, a.x + w / 2, a.y, w);
  }

  /** The billboard frame (PixelLab), `w` wide, its top centre at (x, y), with the poster on its face. */
  private billboardFrame(which: Billboard, x: number, y: number, w: number) {
    const k = this.tex("tcc_billboard");
    const s = w / 128;
    if (k) this.add(this.sc.add.image(x, y, k).setOrigin(0.5, 0).setScale(s));
    const [fx, fy, fw, fh] = BILLBOARD_FACE;
    return billboardPanel(this.sc, (o) => this.add(o), which, x - w / 2 + fx * s, y + fy * s, fw * s, fh * s);
  }

  /** A billboard mocked up on a slide (no frame). */
  private miniBillboard(which: Billboard, x: number, y: number, w: number) {
    return billboardPanel(this.sc, (o) => this.add(o), which, x - w / 2, y, w, w * 0.36);
  }

  // ------------------------------------------------------------------ ep 7's inserts

  protected onInsert(id: string): number {
    if (!id.startsWith("tcc_")) return super.onInsert(id);
    this.clear();
    this.shotKind = "insert";
    const { SX, SY, SW, SH } = this.r;
    if (id === "tcc_slide_seniors") {
      // the slide, filling the screen: the mockup billboard against a bit of sky
      this.backdrop(this.tex("tv_tcc_pitch"), { zoom: 1.6, blur: 2, tint: 0x6a6a6a, ox: SW * 0.45 });
      this.add(this.sc.add.rectangle(this.cx, SY + SH * 0.47, SW * 0.86, SH * 0.8, 0x8fc8f0).setStrokeStyle(6, 0xf4f4f4));
      this.billboardFrame("seniors", this.cx, SY + SH * 0.13, SW * 0.74);
      this.add(this.text(SX + SW * 0.1, SY + SH * 0.1, "SLIDE 1 / 12", 12, "#1a2a4a", { fontStyle: "bold" }));
      this.push(1.05, 3000, this.cx, SY + SH * 0.4);
      return 900;
    }
    if (id === "tcc_newspaper") return this.newspaper();
    if (id === "tcc_bb_all") {
      // the lot of them, side by side, as the theme comes round again
      this.backdrop(this.tex("tv_tcc_bb_highway"));
      const order: Billboard[] = ["seniors", "refugees", "kids", "ds", "nuns"];
      order.forEach((w, i) => this.later(i * 260, () => {
        this.billboardFrame(w, SX + SW * [0.18, 0.34, 0.5, 0.66, 0.82][i], SY + SH * (i % 2 ? 0.3 : 0.02), SW * 0.34);
        this.sfx("pop");
      }));
      this.push(1.06, 3000, this.cx, SY + SH * 0.35);
      return 2600;
    }
    const which = id.replace("tcc_bb_", "") as Billboard;
    const at = MONTAGE_AT[which];
    if (!at) return 0;
    const bg = this.backdrop(this.tex(at.bg));
    if (at.flip) bg.setFlipX(true);
    const panel = this.billboardFrame(which, this.cx, SY + SH * 0.04, SW * 0.66);
    // the poster goes up: a sheet of white pasted across from the left, revealing it
    const cover = this.add(this.sc.add.rectangle(panel.x + panel.w, panel.y, panel.w, panel.h, 0xf4f4ee).setOrigin(1, 0));
    this.sc.tweens.add({ targets: cover, scaleX: 0, duration: 650, delay: 150, ease: "Quad.out" });
    this.sfx("swing");
    this.later(800, () => this.sfx("pop"));
    this.push(1.07, 2600, this.cx, SY + SH * 0.3);
    return 2400;
  }

  /** Brenda's newspaper: the classic spin-in to the front page. */
  private newspaper(): number {
    const { SY, SW, SH } = this.r;
    this.backdrop(this.tex("tv_tcc_bullpen"), { zoom: 1.4, blur: 3, tint: 0x777777 });
    const W = SW * 0.62;
    const H = SH * 0.86;
    const paper = this.add(this.sc.add.container(this.cx, SY + SH / 2));
    paper.add(this.sc.add.rectangle(0, 0, W, H, 0xf2ecd8).setStrokeStyle(2, 0x9a9070));
    paper.add(this.text(0, -H / 2 + 22, "THE DAILY GAZETTE", 26, "#1a1a1a", { fontStyle: "bold" }).setOrigin(0.5));
    paper.add(this.sc.add.rectangle(0, -H / 2 + 42, W - 30, 2, 0x1a1a1a));
    paper.add(this.text(0, -H / 2 + 66, "BILLBOARD BACKLASH!", 30, "#9a1010", { fontStyle: "bold" }).setOrigin(0.5));
    paper.add(this.text(0, -H / 2 + 92, "Law firm's “inclusive” campaign sparks citywide fury", 12, "#333333", { fontStyle: "italic" }).setOrigin(0.5));
    // the photo: the billboard itself
    const ph = this.sc.add.container(0, 0);
    ph.add(this.sc.add.rectangle(0, 18, W - 40, H * 0.5, 0x8fc8f0));
    paper.add(ph);
    const panelW = W - 70;
    const g = billboardPanel(this.sc, (o) => (ph.add(o), o), "ds", -panelW / 2, 18 - panelW * 0.18, panelW, panelW * 0.36);
    void g;
    for (let i = 0; i < 4; i++) paper.add(this.sc.add.rectangle(-W / 2 + 20 + (i % 2) * (W / 2 - 10), H / 2 - 40 + Math.floor(i / 2) * 12, W / 2 - 40, 4, 0xb0a890).setOrigin(0, 0.5));
    paper.setScale(0.05).setAngle(-540);
    this.sc.tweens.add({ targets: paper, scale: 1, angle: -3, duration: 900, ease: "Quad.out" });
    this.sfx("swing");
    this.later(900, () => this.sfx("tv_sting"));
    return 2200;
  }

  /** Two-shot: closer, both of them. */
  private two() {
    this.wide(false);
    this.shotKind = "two";
    const xs = Object.values(this.stage).map((o) => o.x);
    const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : this.cx;
    this.camProxy.s = 1;
    this.push(1.42, 1, mid, this.r.SY + this.r.SH * 0.72);
    this.later(20, () => this.push(1.48, 4000, mid, this.r.SY + this.r.SH * 0.72));
  }

  private bodies: Record<string, Phaser.GameObjects.Sprite> = {};

  private bodyOf(name: string) {
    if (name === "JENNY CUMMING" && !this.props.has("wine") && this.tex(JENNY_DAY.key)) return JENNY_DAY;
    const b = BODY[name];
    return b && this.tex(b.key) ? b : null;
  }

  private drawPeople(ground: number, height: number) {
    this.bodies = {};
    // seated people first, so whoever's on a lap is drawn over them
    const order = Object.entries(this.stage).sort(([, a], [, b]) => (a.pose === "lap" ? 1 : 0) - (b.pose === "lap" ? 1 : 0));
    for (const [name, o] of order) {
      if (o.pose === "enter") continue;
      const sit = o.pose === "sit" || o.pose === "asleep" || o.pose === "lap";
      const b = this.bodyOf(name);
      let s: Phaser.GameObjects.Sprite | null;
      if (b) {
        const frame = o.pose === "asleep" && b.snore ? b.snore[0] : sit ? (b.sit ?? b.stand ?? 0) : (b.stand ?? b.sit ?? 0);
        s = this.add(this.sc.add.sprite(o.x, ground + (o.pose === "lap" ? -height * 0.28 : 0), b.key, frame).setOrigin(0.5, 1));
        this.realScale(s, (height * 1.5) / 160);
        s.setFlipX(b.flip ?? (!sit && !!b.flipStand));
        if (o.pose === "asleep" && b.snore) {
          const [a, n] = b.snore;
          let k = 0;
          const spr = s;
          this.every(420, () => spr.active && spr.setFrame(a + (++k % n)));
          this.zzz(s.x + 20, s.y - height * 1.4);
        }
      } else if (o.pose === "bust") {
        // sat behind a table: their close-up sheet, from the chest up
        s = this.bust(name, o.x, ground - height * 0.12, height * 1.02);
        if (!s) continue;
      } else {
        s = this.body(name, o.x, ground + (sit ? 10 : 0), height);
        if (!s) continue;
        s.setFlipX(this.sideOf(name) > 0 && o.pose !== "lap");
        if (o.pose === "asleep") {
          s.setAngle(8);
          this.zzz(s.x + 30, s.y - height);
        }
      }
      if (!s) continue;
      this.breathe(s, 1500 + (this.hash(name) % 500));
      this.bodies[name] = s;
    }
    if (this.props.has("wine") && !this.bodyOf("JENNY CUMMING")) {
      const jx = this.stage["JENNY CUMMING"]?.x ?? this.r.SX + this.r.SW * 0.33;
      const g = this.add(this.sc.add.graphics());
      const x = jx + 34;
      const y = ground - height * 0.42;
      g.fillStyle(0xffffff, 0.7).fillRect(x, y, 10, 16);
      g.fillStyle(0x7a0a1a, 1).fillRect(x + 1, y + 5, 8, 8);
      g.fillStyle(0xffffff, 0.7).fillRect(x + 4, y + 16, 2, 8).fillRect(x, y + 24, 10, 2);
    }
  }

  private zzz(x: number, y: number) {
    const z = this.add(this.text(x, y, "z", 22, "#ffffff", { fontStyle: "bold" }).setShadow(2, 2, "#000", 0));
    this.sc.tweens.add({ targets: z, y: y - 40, x: x + 20, alpha: 0, duration: 1400, repeat: -1 });
    const z2 = this.add(this.text(x + 10, y + 10, "Z", 30, "#ffffff", { fontStyle: "bold" }).setShadow(2, 2, "#000", 0));
    this.sc.tweens.add({ targets: z2, y: y - 50, x: x + 40, alpha: 0, duration: 1700, delay: 600, repeat: -1 });
  }

  private restingFrame(name: string) {
    const o = this.stage[name];
    if (o?.pose === "asleep") return F.SPECIAL;
    return F.NEUTRAL;
  }

  // ------------------------------------------------------------------ dialogue

  protected onSpeak(name: string, text: string, emotion: string): number {
    if (this.nyc || this.frozen) return 0;
    if (!this.stage[name]) this.place(name);
    this.linesThisShot++;
    const e = emotion.toLowerCase();
    let p: Perf | null = null;
    const closeOnThem = this.shotKind === "single" && this.perf?.name === name;
    if ((this.shotKind === "two" || this.shotKind === "wide") && this.linesThisShot === 1 && this.bodies[name]) {
      // the first line after a two-shot cut plays in the two-shot
      p = this.bodyPerf(name);
    } else if (closeOnThem) {
      p = this.perf;
      this.holdCount++;
    } else {
      this.holdCount = 0;
      const shocked = /shock|outrag/.test(e) || /\?!/.test(text);
      p = this.single(name, { side: this.sideOf(name), bg: this.setKey(), recut: true, expr: shocked ? F.ALARM : this.restingFrame(name), blur: 1.5 });
      this.shotKind = "single";
    }
    if (!p) return 0;
    if (p.face) {
      if (/shock|outrag/.test(e) || /\?!/.test(text)) {
        p.base = F.ALARM;
        p.spr.setFrame(F.ALARM);
      } else if (/groggy/.test(e)) {
        p.base = F.NEUTRAL;
      } else if (/squint/.test(e) && p.frames > F.SPECIAL) {
        p.base = F.SPECIAL;
        p.spr.setFrame(F.SPECIAL);
      }
    }
    this.talk(p, name, text, emotion);
    return 0;
  }

  private bodyPerf(name: string): Perf {
    const s = this.bodies[name];
    const p = this.perfOf(name, s);
    const b = this.bodyOf(name);
    const pose = this.stage[name]?.pose ?? "";
    if (b?.talk && s.texture.key === b.key && (pose === "lap" ? "sit" : pose) === b.talkPose) {
      p.cycle = b.talk;
      p.rest = Number(s.frame.name);
    }
    return p;
  }

  protected onDirection(a: string): number {
    if (this.frozen) return 0;
    if (/^INT\.|office is dim/i.test(a)) {
      this.wide();
      return 900;
    }
    if (/sits alone/i.test(a)) {
      if (this.shotKind !== "wide") this.wide();
      return 0;
    }
    if (/enters|walks in|storms in/i.test(a)) return this.entrance();
    if (/^EXT\..*NIGHT/i.test(a) || /^MONTAGE/i.test(a)) return 0;
    if (/sipping on a neon green juice/i.test(a)) {
      const p = this.single("LILA MINT", { side: this.sideOf("LILA MINT"), bg: this.setKey(), recut: true });
      if (p) this.push(1.05, 1800, p.spr.x, p.spr.y - 220);
      this.shotKind = "single";
      this.sfx("slurp");
      return 700;
    }
    if (/first slide/i.test(a)) {
      this.props.add("slide");
      this.wide(false);
      this.sfx("tap");
      return 500;
    }
    if (/out the window|stare in horror/i.test(a)) {
      // the room, then a push in on what they're looking at
      this.wide(false);
      const bb = SET_BILLBOARD[this.setKey()];
      if (bb) {
        const p = this.setPt(bb.x, bb.y + bb.w * 0.3);
        this.push(1.35, 2600, p.x, p.y);
      }
      return 1200;
    }
    if (/phones ringing/i.test(a)) {
      this.wide();
      this.ringing();
      return 900;
    }
    if (/steps up to the podium/i.test(a)) {
      this.wide();
      return 600;
    }
    if (/^EXT\./i.test(a)) {
      this.wide();
      return 900;
    }
    if (/leans back, raising an eyebrow/i.test(a)) {
      const c = this.react("CHRISTOPHER THICK", F.NEUTRAL, { side: 1, bg: this.setKey() });
      if (c) this.sc.tweens.add({ targets: c.spr, angle: -3, y: c.y + 6, duration: 500, ease: "Sine.easeOut" });
      this.later(1300, () => {
        const j = this.single("JENNY CUMMING", { side: -0.6, bg: this.setKey(), scale: 3.45, zoom: 2, recut: true, expr: F.SPECIAL });
        if (j) this.push(1.06, 2200, j.spr.x, j.spr.y - 240);
      });
      this.shotKind = "single";
      return 1900;
    }
    if (/stops smiling/i.test(a)) {
      const p = this.react("CHRISTOPHER THICK", F.NEUTRAL, { side: 1, bg: this.setKey() });
      if (p) {
        // the smile drops
        p.spr.setFrame(F.BLINK);
        this.later(200, () => p.spr.active && ((p.base = F.ALARM), p.spr.setFrame(F.ALARM)));
        this.push(1.08, 1500, p.spr.x, p.spr.y - 220);
      }
      this.shotKind = "single";
      return 0;
    }
    if (/cries/i.test(a)) {
      const p = this.single("JENNY CUMMING", { side: -0.6, bg: this.setKey(), scale: 3.45, zoom: 2 });
      if (p) {
        p.base = F.SPECIAL;
        p.spr.setFrame(F.SPECIAL);
        this.tears(p);
        this.push(1.1, 2500, p.spr.x, p.spr.y - 240);
      }
      this.shotKind = "single";
      return 600;
    }
    if (/fallen asleep/i.test(a)) {
      this.place("CHRISTOPHER THICK").pose = "asleep";
      const p = this.single("CHRISTOPHER THICK", { side: 0.6, bg: this.setKey(), scale: 3.45, zoom: 2, recut: true, expr: F.SPECIAL });
      if (p) {
        p.spr.setFrame(F.SPECIAL);
        this.zzz(p.spr.x + 120, p.spr.y - 380);
        this.sc.tweens.add({ targets: p.spr, angle: 3, y: p.spr.y + 6, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.sfx("pfft");
      }
      this.shotKind = "single";
      return 900;
    }
    if (/wakes with a snort/i.test(a)) {
      this.place("CHRISTOPHER THICK").pose = "";
      const p = this.single("CHRISTOPHER THICK", { side: 1, bg: this.setKey(), recut: true, expr: F.ALARM });
      if (p) {
        this.sc.tweens.add({ targets: p.spr, y: p.y - 18, duration: 90, yoyo: true, ease: "Quad.out" });
        this.later(700, () => p.spr.active && ((p.base = F.NEUTRAL), p.spr.setFrame(F.BLINK)));
        this.later(820, () => p.spr.active && p.spr.setFrame(F.NEUTRAL));
      }
      this.sfx("burp");
      this.shotKind = "single";
      return 900;
    }
    if (/starts laughing/i.test(a)) {
      const p = this.single("JENNY CUMMING", { side: -1, bg: this.setKey(), recut: true, expr: F.LAUGH });
      if (p) {
        p.base = F.LAUGH;
        p.spr.setFrame(F.LAUGH);
        this.sc.tweens.add({ targets: p.spr, angle: { from: -2, to: 2 }, y: p.y - 4, duration: 170, yoyo: true, repeat: -1 });
      }
      this.shotKind = "single";
      return 0;
    }
    if (/kiss/i.test(a)) return this.kiss();
    return 0;
  }

  private tears(p: Perf) {
    this.every(380, () => {
      if (!p.spr.active) return;
      const t = this.add(this.sc.add.rectangle(p.spr.x + (Math.random() < 0.5 ? -46 : 40), p.spr.y - 230, 5, 9, 0x9fd8ff));
      this.sc.tweens.add({ targets: t, y: t.y + 90, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }, 10);
  }

  /** Through the door on the right, to applause. */
  private entrance(): number {
    const who = Object.keys(this.stage).find((n) => this.stage[n].pose === "enter") ?? "CHRISTOPHER THICK";
    const o = this.place(who);
    o.pose = "";
    const tx = o.x;
    o.x = this.r.SX + this.r.SW + 40;
    this.wide(false);
    const s = this.bodies[who];
    o.x = tx;
    if (!s) return 0;
    const b = this.bodyOf(who);
    s.setFlipX(!b || !!b.flipStand);
    this.sfx("door");
    this.sc.tweens.add({ targets: s, x: tx, duration: 1300, ease: "Sine.easeOut" });
    if (b?.walk) {
      // the swagger in
      const [a, n] = b.walk;
      let k = 0;
      const walk = this.every(110, () => s.active && s.setFrame(a + (k++ % n)), 11);
      this.later(1300, () => {
        walk.remove();
        if (s.active) s.setFrame(b.stand ?? 0);
      });
    } else this.sc.tweens.add({ targets: s, y: s.y - 5, duration: 160, yoyo: true, repeat: 3 });
    // a beat for the applause, then a little "hey" pose at his mark
    this.later(1350, () => {
      if (!s.active) return;
      s.setFrame(b?.talk ? b.talk[0] + 3 : 3);
      this.later(450, () => s.active && s.setFrame(b ? (b.stand ?? 0) : 0));
    });
    this.push(1.12, 1800, tx, this.r.SY + this.r.SH * 0.7);
    return 1500;
  }

  private kiss(): number {
    this.clear();
    this.shotKind = "kiss";
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.setKey(), { zoom: 1.8, blur: 2, ox: 30 });
    const j = this.add(this.sc.add.sprite(SX + SW * 0.22, SY + SH + 6, faceKeyOf("JENNY CUMMING"), F.BLINK).setOrigin(0.5, 1).setScale(3));
    const c = this.add(this.sc.add.sprite(SX + SW * 0.78, SY + SH + 6, faceKeyOf("CHRISTOPHER THICK"), F.BLINK).setOrigin(0.5, 1).setScale(3));
    this.sc.tweens.add({ targets: j, x: SX + SW * 0.42, angle: 14, duration: 900, ease: "Quad.in" });
    this.sc.tweens.add({ targets: c, x: SX + SW * 0.58, angle: -14, duration: 900, ease: "Quad.in" });
    this.later(900, () => {
      this.sfx("pop");
      this.sc.tweens.add({ targets: [j, c], y: "-=6", duration: 120, yoyo: true, repeat: 8 });
      for (let i = 0; i < 7; i++) {
        const h = this.add(this.text(this.cx + (Math.random() - 0.5) * 120, SY + 150, "❤", 34 + Math.random() * 20, "#ff4f8a"));
        this.sc.tweens.add({ targets: h, y: SY + 20, x: h.x + (Math.random() - 0.5) * 140, alpha: 0, duration: 1400, delay: i * 140 });
      }
    });
    this.push(1.12, 2400, this.cx, SY + SH * 0.5);
    return 2200;
  }

  protected onBlocking(name: string, to: string, pose?: string): number {
    if (this.nyc) return 0;
    const o = this.place(name);
    // "sit@0.4": the pose, and where across the set (a fraction of the picture's width)
    const at = pose?.match(/^(.*)@([\d.]+)$/);
    if (at) {
      o.x = this.r.SX + this.r.SW * Number(at[2]);
      pose = at[1] || "stand";
    } else if (to === "center") o.x = this.cx;
    if (pose === "bust") {
      o.pose = "bust";
      return 0;
    }
    if (to === "enter") {
      o.pose = "enter";
      return 0;
    }
    if (to === "offscreen") {
      delete this.stage[name];
      return 0;
    }
    if (to === "lap") {
      const other = Object.keys(this.stage).find((n) => n !== name);
      o.pose = "lap";
      if (other) {
        this.stage[other].pose = "sit";
        o.x = this.stage[other].x - 26;
      }
      this.wide(false);
      const s = this.bodies[name];
      if (s) {
        const tx = s.x;
        s.x = this.r.SX + this.r.SW * 0.33;
        s.setFlipX(false);
        this.sc.tweens.add({ targets: s, x: tx, duration: 900, ease: "Sine.easeInOut" });
        this.sc.tweens.add({ targets: s, y: s.y - 5, duration: 150, yoyo: true, repeat: 2 });
      }
      this.push(1.3, 1600, o.x + 13, this.r.SY + this.r.SH * 0.7);
      return 1000;
    }
    if (pose === "asleep" || pose === "sit" || pose === "stand") o.pose = pose === "stand" ? "" : pose;
    return 0;
  }

  protected onProp(id: string, on: boolean): number {
    if (on) this.props.add(id);
    else this.props.delete(id);
    if (id === "plane" && on && this.nyc) this.flyPlane();
    return 0;
  }

  /** On a laugh, the picture stays on the punchline: whoever's reacting gets the close-up. */
  protected onAudience(cue: string): number {
    if (this.nyc || this.frozen) return 0;
    // over a slide / a billboard / the paper, the laugh plays over the picture
    if (this.shotKind === "insert" && cue !== "biglaugh") return 0;
    if (cue === "biglaugh") {
      this.studioAudience();
      return 0;
    }
    if (cue === "laugh") {
      if (this.perf?.face && this.perf.base === F.SPECIAL) {
        // hold on the sleeper: that IS the joke
        this.push(1.12, 2000, this.perf.spr.x, this.perf.spr.y - 230);
        return 0;
      }
      const listener = this.lastSpeaker && this.cast.find((n) => n !== this.lastSpeaker && this.stage[n]);
      if (listener && this.shotKind !== "wide" && this.shotKind !== "kiss") {
        const p = this.react(listener, F.NEUTRAL, { side: this.sideOf(listener), bg: this.setKey() });
        this.shotKind = "single";
        if (p) {
          // the slow burn: a look, a blink, a tiny push
          this.later(300, () => p.spr.active && p.spr.setFrame(F.BLINK));
          this.later(420, () => p.spr.active && p.spr.setFrame(p.base));
          this.push(1.07, 1800, p.spr.x, p.spr.y - 220);
        }
      }
      return 0;
    }
    if (cue === "cheer" || cue === "whistle") {
      if (this.shotKind === "kiss") {
        this.fx("vfx_confetti", this.cx, this.r.SY + 60, { scale: 3 });
      }
    }
    return 0;
  }

  /** The studio audience, for the big laugh. */
  private studioAudience() {
    this.clear();
    this.shotKind = "audience";
    const { SX, SY } = this.r;
    const img = this.backdrop(this.tex(AUDIENCE), { zoom: 1.04 });
    this.sc.tweens.add({ targets: img, y: img.y - 4, duration: 140, yoyo: true, repeat: 16 });
    // the APPLAUSE light, flashing
    const sign = this.add(this.sc.add.container(SX + 271, SY + 92));
    sign.add(this.sc.add.rectangle(0, 0, 250, 46, 0x2a0606).setStrokeStyle(3, 0x777777));
    const t = this.text(0, 0, "APPLAUSE", 30, "#ff2a2a", { fontStyle: "bold" }).setOrigin(0.5);
    sign.add(t);
    this.every(260, () => t.setColor(t.style.color === "#ff2a2a" ? "#5a1010" : "#ff2a2a"));
  }

  // ------------------------------------------------------------------ the cliffhanger

  private skyline() {
    this.clear();
    this.shotKind = "nyc";
    const img = this.backdrop(this.tex("tv_nyc_skyline"));
    this.sc.tweens.add({ targets: img, scale: img.scale * 1.08, duration: 9000, ease: "Sine.easeInOut" });
    if (this.props.has("plane")) this.flyPlane();
  }

  /** Stylised: a little cartoon jet crossing the sky towards the towers. Nothing more is shown. */
  private flyPlane() {
    if (this.plane?.active) return;
    const { SX, SY, SW } = this.r;
    const p = this.add(this.sc.add.container(SX + SW * 0.95, SY + 110));
    p.add(this.sc.add.rectangle(0, 0, 70, 12, 0xdcdfe4).setStrokeStyle(2, 0x55595f));
    p.add(this.sc.add.triangle(-6, 0, 0, 0, 22, -26, 30, 0, 0xb8bcc3));
    p.add(this.sc.add.triangle(26, -4, 0, 0, 12, -16, 16, 0, 0xb8bcc3));
    p.add(this.sc.add.rectangle(-30, -2, 10, 4, 0x4a6fa5));
    this.plane = p;
    this.sc.tweens.add({ targets: p, x: SX + SW * 0.62, y: SY + 150, scale: 1.5, duration: 4500, ease: "Linear" });
  }

  /** "PLOT TWIST: ...": slammed over the skyline shot (the picture keeps playing underneath). */
  private plotTwist(text: string) {
    const { SY, SW, SH } = this.r;
    this.sfx("tv_sting");
    if (!G.meta?.settings?.calmFlash) this.sc.cameras.main.flash(100, 255, 255, 255);
    const box = this.over(this.sc.add.rectangle(this.cx, SY + SH * 0.4, SW - 30, SH * 0.5, 0x000000, 0.62));
    const [head, ...rest] = text.split(": ");
    const h = this.over(this.text(this.cx, SY + SH * 0.24, head + ":", 40, "#ff2a2a", { fontStyle: "bold", stroke: "#000", strokeThickness: 7 }).setOrigin(0.5).setAngle(-4));
    void h;
    const b = this.over(this.text(this.cx, SY + SH * 0.44, rest.join(": "), 22, "#ffffff", { fontStyle: "bold", align: "center", stroke: "#000", strokeThickness: 5, wordWrap: { width: SW - 70 } }).setOrigin(0.5));
    void b;
    void box;
    return 1400;
  }

  /** "WILL THEY ESCAPE IN TIME?!?": the picture freezes, goes sepia, and the cheesy caption bounces in. */
  private toBeContinued(text: string) {
    this.frozen = true;
    this.clearGfx();
    this.sc.tweens.killTweensOf(this.cam.list);
    for (const o of this.cam.list) (o as unknown as Phaser.GameObjects.Components.Tint).setTint?.(0xd8b878);
    this.sc.cameras.main.flash(120, 255, 255, 255);
    const { SX, SY, SW, SH } = this.r;
    this.sfx("tv_sting");
    const lines = text.split("\n");
    const a = this.over(this.text(this.cx, SY + SH * 0.36, lines[0], 30, "#ffe14a", { fontStyle: "bold", align: "center", stroke: "#7a1f00", strokeThickness: 6, wordWrap: { width: SW - 50 } }).setOrigin(0.5).setScale(0).setAngle(-6));
    this.sc.tweens.add({ targets: a, scale: 1, duration: 420, ease: "Back.out" });
    if (lines[1]) {
      const b = this.over(this.text(this.cx, SY + SH * 0.62, lines[1], 19, "#ffffff", { fontStyle: "bold", align: "center", stroke: "#000", strokeThickness: 4, wordWrap: { width: SW - 60 } }).setOrigin(0.5).setAlpha(0));
      this.sc.tweens.add({ targets: b, alpha: 1, duration: 300, delay: 700 });
    }
    void SX;
    return 1200;
  }

  // ------------------------------------------------------------------ cards

  protected onTitle(t: string): number {
    const up = t.toUpperCase();
    if (!this.titleDone && up === "THICK CUMMING COCK") return this.logo();
    if (!this.titleDone && /^EPISODE/i.test(t)) return this.castCards(t);
    if (/NEW YORK/.test(up)) {
      this.clearGfx();
      const s = this.over(this.text(this.r.SX + 20, this.r.SY + this.r.SH - 70, "", 15, "#ffffff", { fontStyle: "bold", backgroundColor: "#000000aa", padding: { x: 8, y: 5 } }));
      let n = 0;
      this.every(45, () => s.setText(t.slice(0, ++n)), t.length, true);
      return 0;
    }
    if (/^PLOT TWIST/.test(up)) return this.plotTwist(t);
    if (/ESCAPE IN TIME/.test(up)) return this.toBeContinued(t);
    this.clearGfx();
    this.frozen = false;
    if (/WRITTEN BY/.test(up)) return this.credits(t);
    this.black();
    this.add(this.text(this.cx, this.cy, t, /END OF EPISODE/.test(up) ? 26 : 15, "#ffffff", { align: "center", fontStyle: /END/.test(up) ? "bold" : "normal", wordWrap: { width: this.r.SW - 80 } }).setOrigin(0.5));
    return 0;
  }

  /** The title sequence, part one: sunburst, theme, the logo bouncing in. */
  private logo(): number {
    this.clear();
    this.clearGfx();
    this.shotKind = "card";
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x3b1d6e).setOrigin(0));
    const rays = this.add(this.sc.add.graphics({ x: this.cx, y: this.cy }));
    for (let i = 0; i < 16; i++) {
      rays.fillStyle(i % 2 ? 0x5a2ea0 : 0xff8a3d, i % 2 ? 1 : 0.55);
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = ((i + 1) / 16) * Math.PI * 2;
      rays.fillTriangle(0, 0, Math.cos(a0) * 600, Math.sin(a0) * 600, Math.cos(a1) * 600, Math.sin(a1) * 600);
    }
    this.sc.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    const words = ["THICK", "CUMMING", "COCK"];
    words.forEach((w, i) => {
      const t = this.add(this.text(this.cx, SY + 120 + i * 78, w, 52, ["#ffe14a", "#ffffff", "#ff5fa2"][i], { fontStyle: "bold", stroke: "#2a0a4a", strokeThickness: 8 }).setOrigin(0.5).setScale(0).setAngle(i === 1 ? 4 : -4));
      this.sc.tweens.add({ targets: t, scale: 1, duration: 380, delay: 200 + i * 420, ease: "Back.out" });
      this.later(200 + i * 420, () => this.sfx("pop"));
      this.sc.tweens.add({ targets: t, y: t.y - 6, duration: 520, yoyo: true, repeat: -1, delay: 1400 + i * 120, ease: "Sine.easeInOut" });
    });
    // with the sung theme, the logo holds through the verse (skippable as ever)
    return MUSIC_FILES.tcc_theme ? 21000 : 0;
  }

  /** Part two: the cast's freeze-frames, mid-laugh, with their names; then the episode title. */
  private castCards(epTitle: string): number {
    this.clear();
    this.shotKind = "card";
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.tex(EXT), { zoom: 1.3, blur: 1, tint: 0x9a80c0 });
    const song = !!MUSIC_FILES.tcc_theme;
    const cast: [string, string, number][] = [
      ["CHRISTOPHER THICK", "#ffe14a", -1],
      ["JENNY CUMMING", "#ff9ccf", 1],
      ...(song ? ([["JOHN COCK", "#8fd3ff", -1], ["LILA MINT", "#9dff8a", 1]] as [string, string, number][]) : []),
    ];
    // with the sung theme the cards come in pairs through the chorus: the partners, then John and Lila
    const at = (i: number) => (song ? (i < 2 ? i * 700 : 5200 + (i - 2) * 700) : i * 700);
    cast.forEach(([n, col, side], i) => {
      const fk = faceKeyOf(n);
      if (!this.tex(fk)) return;
      const box = this.add(this.sc.add.container(this.cx + side * 140, SY + SH * 0.45).setAlpha(0).setAngle(side * -4));
      box.add(this.sc.add.rectangle(0, 0, 230, 230, 0xffffff));
      box.add(this.sc.add.sprite(0, 0, fk, F.LAUGH).setScale(1.7));
      box.add(this.text(0, 132, n, 18, col, { fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5));
      this.sc.tweens.add({ targets: box, alpha: 1, x: box.x - side * 10, duration: 260, delay: at(i) });
      this.later(at(i), () => this.sfx("pop"));
      if (song && i < 2) this.sc.tweens.add({ targets: box, alpha: 0, duration: 300, delay: 4700 });
    });
    const et = this.add(this.text(this.cx, SY + SH - 34, epTitle, 18, "#ffffff", { fontStyle: "italic", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: et, alpha: 1, duration: 400, delay: song ? 9800 : 1500 });
    if (!song) this.later(2900, () => this.sfx("tv_sting"));
    this.titleDone = true;
    void SW;
    return song ? 14500 : 3600;
  }

  /** End credits roll up over the last freeze-frame of the two of them. */
  private credits(t: string): number {
    this.clear();
    this.shotKind = "card";
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x1b1030).setOrigin(0));
    if (this.tex(faceKeyOf("JENNY CUMMING"))) this.add(this.sc.add.sprite(SX + SW * 0.25, SY + SH + 6, faceKeyOf("JENNY CUMMING"), F.LAUGH).setOrigin(0.5, 1).setScale(2.6).setAlpha(0.45));
    if (this.tex(faceKeyOf("CHRISTOPHER THICK"))) this.add(this.sc.add.sprite(SX + SW * 0.75, SY + SH + 6, faceKeyOf("CHRISTOPHER THICK"), F.LAUGH).setOrigin(0.5, 1).setScale(2.6).setAlpha(0.45));
    const roll = this.add(this.sc.add.container(this.cx, SY + SH + 20));
    const lines = ["THICK CUMMING COCK", "", ...t.split("\n").slice(1), "", "STARRING", "Christopher Thick", "Jenny Cumming", "John Cock", "", "with", "Lila Mint", "Brenda", "", "Filmed in front of a live studio audience", "(they have since been released)"];
    lines.forEach((l, i) => roll.add(this.text(0, i * 26, l, i === 0 ? 24 : 15, i === 0 ? "#ffe14a" : "#ffffff", { fontStyle: i === 0 || l === "STARRING" ? "bold" : "normal", align: "center", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5, 0)));
    this.sc.tweens.add({ targets: roll, y: SY - lines.length * 26 + 140, duration: 6000, ease: "Linear" });
    return 3000;
  }

  protected onTransition(mode: string): number {
    if (mode === "smashCut") {
      this.frozen = false;
      return 0;
    }
    return super.onTransition(mode);
  }
}

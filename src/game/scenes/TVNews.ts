import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../systems/tv";
import { synth } from "../audio/Synth";
import { FONT } from "../ui/theme";
import { BRANDS, NewsChrome, calm, cameraFlash, type Rect } from "./tvnews/NewsChrome";
import { Presenter, hasAnchor } from "./tvnews/Presenter";

/**
 * GB Krews presentation for the story's compulsory broadcasts (Klerble's welcome and presser, the Krandall segment,
 * the Wildern bulletin). Like PovDirector it draws the whole picture beat by beat inside the telly, but as a news
 * channel: an ident, bug, clock, ticker and straps (NewsChrome), PixelLab presenters who lip-sync and gesture line by
 * line (Presenter), each story on its own set, and news camera language (slow push-ins, a trucking wide, the press
 * pack with flashes going off, a down-the-line split, hidden-camera footage, B-roll).
 */

type Kind = "desk" | "presser" | "hall" | "footage" | "train";

interface SceneDef {
  match: RegExp;
  kind: Kind;
  set: string;
}

interface OtsDef {
  match: RegExp;
  pic: { key: string; frame?: number; crop?: [number, number, number, number] };
  caption: string;
}

interface NewsCfg {
  brand: keyof typeof BRANDS;
  ticker: string[];
  scenes: SceneDef[];
  ots: OtsDef[];
  /** B-roll after the last line */
  outroBroll?: { set: string; caption: string };
}

const KLER_FACE = { key: "tvanchor_PRESIDENT_KLERBLE", frame: 0, crop: [28, 4, 72, 54] as [number, number, number, number] };
const KRAN_FACE = { key: "tvanchor_KRANKY_KRANDALL", frame: 0, crop: [26, 22, 76, 56] as [number, number, number, number] };
const KRAN_SIP = { key: "tvanchor_KRANKY_KRANDALL", frame: 8, crop: [20, 22, 88, 64] as [number, number, number, number] };
const CREST = { key: "tv_kreddle_press", crop: [118, 40, 84, 64] as [number, number, number, number] };
const CRATER = { key: "tv_wildern_crater" };
const BURGER = { key: "tv_krelburger", crop: [40, 0, 200, 140] as [number, number, number, number] };

const STUDIO: SceneDef = { match: /NEWSDESK/, kind: "desk", set: "tv_gbk_studio" };

export const NEWS_SHOWS: Record<string, NewsCfg> = {
  klerble_welcome: {
    brand: "gbk",
    ticker: [
      "Kreddle President to address Krelworld 'for no reason'",
      "Bridge to Kreddle reopens; bridge 'nervous'",
      "Krezzcoin up 2%, down 40%, up again, nobody knows",
      "Weather: grey, then greyer",
      "Local man watches telly, says it's 'fine'",
    ],
    scenes: [STUDIO, { match: /PRESS CONFERENCE/, kind: "presser", set: "tv_kreddle_office" }],
    ots: [
      { match: /message from our neighbours/i, pic: KLER_FACE, caption: "A message from Kreddle" },
      { match: /lovely/i, pic: CREST, caption: "Kreddle" },
    ],
  },
  klerble_presser: {
    brand: "gbk",
    ticker: [
      "Kreddle calls emergency press conference",
      "Krel Tower 'not evacuated, but feeling it'",
      "Kreddle Express timetable: 'yes'",
      "Cabinet 'working on something', possibly lunch",
      "Pussy juice still banned in Kreddle; President 'fine about it'",
    ],
    scenes: [STUDIO, { match: /PRESS CONFERENCE/, kind: "presser", set: "tv_kreddle_press" }, { match: /TRAIN/, kind: "train", set: "tv_train_cab" }],
    ots: [
      { match: /press conference/i, pic: KLER_FACE, caption: "Kreddle presser" },
      { match: /Krel Tower/i, pic: { key: "p_kreltower" }, caption: "Krel Tower" },
    ],
  },
  krews_krandall: {
    brand: "gbk",
    ticker: [
      "Wildern head wears jester hat 'at all times'",
      "Parents 'concerned about things and also stuff'",
      "Pussy juice prices soar in Wildern catchment",
      "Ofkrezz inspection postponed: inspector 'got sticky'",
      "Mr D. B. Drippin' unavailable for comment",
    ],
    scenes: [
      STUDIO,
      { match: /CLASSROOM/, kind: "footage", set: "tv_classroom" },
      { match: /PRESS ROOM/, kind: "hall", set: "tv_wildern_hall" },
    ],
    ots: [
      { match: /concerns are growing/i, pic: KRAN_FACE, caption: "Wildern's new head" },
      { match: /jester hat/i, pic: KRAN_FACE, caption: "'Krazy and zany'" },
      { match: /addict/i, pic: KRAN_SIP, caption: "Juice fears" },
      { match: /parents/i, pic: { key: "tv_classroom" }, caption: "Wildern Academy" },
      { match: /secret footage/i, pic: { key: "tv_classroom" }, caption: "Secret footage" },
      { match: /press conference/i, pic: { key: "tv_wildern_hall" }, caption: "Staffing policy" },
      { match: /statement|appointed|locked/i, pic: KRAN_FACE, caption: "Wildern Academy" },
    ],
  },
  krews_wildern: {
    brand: "gbk",
    ticker: [
      "Wildern Academy destroyed; 'no one's fault'",
      "New burger is two burgers, experts confirm",
      "Krelburger queue reaches Kreddle border",
      "Headmaster's jester hat recovered from crater",
      "Police: 'we've looked and it's definitely nobody'",
    ],
    scenes: [STUDIO],
    ots: [
      { match: /destroyed|exploded|no one's fault/i, pic: CRATER, caption: "Wildern destroyed" },
      { match: /burger/i, pic: BURGER, caption: "New burger" },
      { match: /footage/i, pic: CRATER, caption: "The crater" },
    ],
  },
};

const STRAPS: Record<string, [string, string]> = {
  NEWSREADER: ["GB Krews", "Live from the Krelford studio"],
  "PRESIDENT KLERBLE": ["President Klerble", "President of Kreddle"],
  "KRANKY KRANDALL": ["Mr Kranky Krandall", "Headmaster, Wildern Academy · 70"],
  REPORTER: ["Reporter", "GB Krews"],
};

export class NewsDirector {
  readonly layer: Phaser.GameObjects.Container;
  /** what the camera sees (moved and scaled for camera moves) */
  private stage: Phaser.GameObjects.Container;
  private fxLayer: Phaser.GameObjects.Container;
  readonly chrome: NewsChrome;
  private cfg: NewsCfg;
  private timers: Phaser.Time.TimerEvent[] = [];
  private shotTimers: Phaser.Time.TimerEvent[] = [];
  private cast: Presenter[] = [];
  private scene: SceneDef = STUDIO;
  private lineInScene = 0;
  private strapped = new Set<string>();
  private idx = 0;
  private trainFrame = 0;
  /** a picture is up (not the black before the first shot) */
  private drawn = false;
  private deskHeadline = "";
  private started = false;
  private mainSpeaker = "";
  private footageCaption?: Phaser.GameObjects.Text;

  static wants(ep: TVEpisode) {
    return !!NEWS_SHOWS[ep.id];
  }

  constructor(
    private sc: Phaser.Scene,
    private r: Rect,
    private ep: TVEpisode,
  ) {
    this.cfg = NEWS_SHOWS[ep.id];
    this.layer = sc.add.container(0, 0).setDepth(4);
    const mask = sc.make.graphics({}).fillRect(r.SX, r.SY, r.SW, r.SH);
    this.layer.setMask(mask.createGeometryMask());
    this.stage = sc.add.container(0, 0);
    this.fxLayer = sc.add.container(0, 0);
    this.layer.add([this.stage, this.fxLayer]);
    this.chrome = new NewsChrome(sc, r, BRANDS[this.cfg.brand], 6);
    this.chrome.ui.setMask(mask.createGeometryMask());
    this.black();
  }

  private sting?: NewsChrome;

  destroy() {
    this.sting?.destroy();
    this.clearShot();
    for (const t of this.timers) t.remove();
    this.chrome.destroy();
    this.layer.destroy();
  }

  // ------------------------------------------------------------------ helpers

  private later(ms: number, fn: () => void, shot = true) {
    const t = this.sc.time.delayedCall(ms, fn);
    (shot ? this.shotTimers : this.timers).push(t);
    return t;
  }

  private every(ms: number, fn: () => void) {
    const t = this.sc.time.addEvent({ delay: ms, loop: true, callback: fn });
    this.shotTimers.push(t);
    return t;
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T, into: Phaser.GameObjects.Container = this.stage): T {
    into.add(o);
    return o;
  }

  private clearShot() {
    for (const t of this.shotTimers) t.remove();
    this.shotTimers = [];
    for (const p of this.cast) p.destroy();
    this.cast = [];
    for (const c of [this.stage, this.fxLayer]) {
      this.sc.tweens.killTweensOf(c);
      for (const o of c.list) this.sc.tweens.killTweensOf(o);
      c.removeAll(true);
      c.setPosition(0, 0).setScale(1).setAngle(0);
    }
    this.footageCaption = undefined;
  }

  private black() {
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
  }

  /** A set, filling the picture (zoomed, shifted, and soft for a close shot). */
  private backdrop(key: string, zoom = 1, ox = 0, oy = 0, blur = false) {
    const { SX, SY, SW, SH } = this.r;
    if (!this.sc.textures.exists(key)) return this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x1f2937).setOrigin(0));
    const src = this.sc.textures.get(key).getSourceImage();
    const img = this.add(this.sc.add.image(SX + SW / 2 + ox, SY + SH / 2 + oy, key));
    img.setScale(Math.max(SW / src.width, SH / src.height) * zoom);
    if (blur) {
      try {
        img.preFX?.addBlur(1, 2, 2, 1.2);
      } catch {
        /* canvas: no blur */
      }
    }
    return img;
  }

  /** Zoom the camera about a point (screen coords) over ms. */
  private camTo(scale: number, fx: number, fy: number, ms: number, ease = "Sine.easeInOut") {
    this.sc.tweens.add({ targets: this.stage, scale, x: fx - fx * scale, y: fy - fy * scale, duration: ms, ease });
  }

  private presenter(name: string, x: number, y: number, scale: number) {
    if (!hasAnchor(this.sc, name)) return null;
    const p = new Presenter(this.sc, name, x, y, scale, this.stage);
    this.cast.push(p);
    return p;
  }

  private find(name: string) {
    return this.cast.find((p) => p.name === name) ?? null;
  }

  private cx() {
    return this.r.SX + this.r.SW / 2;
  }

  private hash(s: string) {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  // ------------------------------------------------------------------ shots

  /** The GB Krews studio, wide: the anchor small behind the desk, the camera trucking slowly across, the wall alive. */
  private studioWide(name = "NEWSREADER") {
    this.clearShot();
    this.drawn = true;
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set);
    this.videoWall();
    this.presenter(name, this.cx(), SY + SH * 0.83, 1.32);
    this.lights();
    this.stage.setScale(1.08).setPosition(-(this.cx()) * 0.08 + 30, -(SY + SH / 2) * 0.08);
    this.sc.tweens.add({ targets: this.stage, x: this.stage.x - 60, duration: 9000, ease: "Sine.easeInOut" });
    void SW;
  }

  /** Life on the studio's video wall: a scan of light, screens flickering between colours, a pulsing logo glow. */
  private videoWall() {
    const { SX, SY, SW, SH } = this.r;
    // the wall sits across the top half of the studio art
    const wx = SX + SW * 0.08;
    const ww = SW * 0.84;
    const wy = SY + SH * 0.2;
    const wh = SH * 0.38;
    const glow = this.add(this.sc.add.rectangle(wx, wy, ww, wh, 0x3b82f6, 0.0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
    this.sc.tweens.add({ targets: glow, fillAlpha: 0.12, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const scan = this.add(this.sc.add.rectangle(wx, wy, 26, wh, 0xffffff, 0.12).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
    this.sc.tweens.add({ targets: scan, x: wx + ww - 26, duration: 3200, repeat: -1, ease: "Linear" });
    for (let i = 0; i < 4; i++) {
      const p = this.add(this.sc.add.rectangle(wx + 20 + i * (ww / 4), wy + 10, ww / 4 - 40, wh - 20, [0xef4444, 0x60a5fa, 0xfacc15, 0xffffff][i], 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
      this.sc.tweens.add({ targets: p, fillAlpha: 0.09, duration: 500 + i * 230, yoyo: true, repeat: -1, delay: i * 400, repeatDelay: 1800 + i * 600 });
    }
  }

  /** Soft studio light that drifts and shimmers. */
  private lights() {
    const { SX, SY, SW } = this.r;
    for (let i = 0; i < 3; i++) {
      const l = this.add(this.sc.add.ellipse(SX + SW * (0.2 + i * 0.3), SY + 10, 160, 260, 0xbfdbfe, 0.03).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
      this.sc.tweens.add({ targets: l, alpha: { from: 0.6, to: 1 }, x: l.x + 14, duration: 2600 + i * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  /** A presenter close (a medium close-up), the set soft behind them, the camera slowly pushing in. */
  private mcu(name: string, opts: { set?: string; side?: number; scale?: number; podium?: boolean } = {}) {
    this.clearShot();
    const { SY, SH } = this.r;
    const h = this.hash(name);
    this.backdrop(opts.set ?? this.scene.set, 1.75, ((h % 5) - 2) * 50, -40, true);
    this.add(this.sc.add.rectangle(this.r.SX, SY, this.r.SW, SH, 0x000000, 0.12).setOrigin(0));
    const x = this.cx() + (opts.side ?? 0);
    const p = this.presenter(name, x, SY + SH + 14, opts.scale ?? 3.15);
    if (opts.podium) this.lectern(x, SY + SH + 14, 3.15);
    this.lights();
    // a slow, broadcast push-in on the face
    this.camTo(1.06, x, SY + 90, 9000);
    return p;
  }

  /** Krandall has no lectern in his art: a school one, with the crest, in front of him. */
  private lectern(x: number, bottom: number, s: number) {
    const w = 64 * s * 0.75;
    const h = 30 * s;
    const c = this.add(this.sc.add.container(x, bottom - h / 2));
    c.add(this.sc.add.rectangle(0, 0, w, h, 0x6b3f1d).setStrokeStyle(4, 0x3b2410));
    c.add(this.sc.add.rectangle(0, -h / 2 + 6, w + 14, 12, 0x8b5a2b).setStrokeStyle(3, 0x3b2410));
    c.add(this.sc.add.circle(0, 4, h * 0.22, 0x1e3a8a).setStrokeStyle(3, 0xfacc15));
    c.add(this.sc.add.text(0, 4, "W", { fontFamily: FONT, fontSize: `${Math.round(h * 0.22)}px`, color: "#facc15", fontStyle: "bold" }).setOrigin(0.5));
    const mic = this.sc.add.rectangle(-w * 0.18, -h / 2 - 14, 4, 30, 0x111111).setAngle(-15);
    c.add(mic);
    return c;
  }

  /** The press pack: the speaker at the podium mid-frame, the backs of the photographers in front, flashes going off. */
  private pressWide(name: string) {
    this.clearShot();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set);
    const hall = this.scene.kind === "hall";
    const p = this.presenter(name, this.cx(), SY + SH * (hall ? 0.86 : 0.88), hall ? 1.55 : 1.7);
    if (hall && p) this.lectern(this.cx(), SY + SH * 0.86, 1.55);
    this.pressPack(SY + SH + 52, 9, 2.15);
    this.flashes(500, 1300);
    // the camera drifts as if handheld over the pack
    this.stage.setScale(1.04).setPosition(-this.cx() * 0.04, -(SY + SH / 2) * 0.04);
    this.sc.tweens.add({ targets: this.stage, x: this.stage.x + 24, y: this.stage.y - 6, duration: 5000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    void SX;
    void SW;
    return p;
  }

  private packers: Phaser.GameObjects.Sprite[] = [];

  /** A row of photographers and reporters seen from behind (PixelLab press_backs), jostling. */
  private pressPack(bottom: number, n: number, scale: number, into: Phaser.GameObjects.Container = this.stage) {
    const { SX, SW } = this.r;
    this.packers = [];
    if (!this.sc.textures.exists("tvpress_backs")) return;
    for (let i = 0; i < n; i++) {
      const x = SX + (i + 0.5) * (SW / n) + ((i * 37) % 23) - 11;
      const s = this.sc.add.sprite(x, bottom + (i % 2) * 18, "tvpress_backs", (i * 5 + this.idx) % 16).setOrigin(0.5, 1).setScale(scale);
      into.add(s);
      this.packers.push(s);
      this.sc.tweens.add({ targets: s, y: s.y - 4 - (i % 3) * 2, x: s.x + ((i % 2) * 2 - 1) * 3, duration: 380 + i * 70, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: i * 90 });
    }
  }

  /** Press flashes every so often from the pack (and from off-frame). */
  private flashes(min: number, max: number) {
    const go = () => {
      const { SX, SY, SW, SH } = this.r;
      const p = this.packers[Math.floor(Math.random() * Math.max(1, this.packers.length))];
      const x = p ? p.x + 10 : SX + Math.random() * SW;
      const y = p ? p.y - p.displayHeight * 0.75 : SY + SH * 0.6;
      cameraFlash(this.sc, this.fxLayer, x + this.stage.x, y + this.stage.y, this.r);
      this.later(min + Math.random() * (max - min), go);
    };
    this.later(200 + Math.random() * 400, go);
  }

  /** A storm of flashes (a gasp, a big moment). */
  private flashStorm(n = 7) {
    for (let i = 0; i < n; i++)
      this.later(i * 70 + Math.random() * 60, () => {
        const { SX, SY, SW, SH } = this.r;
        cameraFlash(this.sc, this.fxLayer, SX + Math.random() * SW, SY + SH * (0.45 + Math.random() * 0.45), this.r);
      });
    synth.play("crowd_gasp");
    synth.play("camera_burst");
  }

  /** A reporter asking a question from the pack: her close, the room soft behind, heads and flashes around her. */
  private reporterInPack(name = "REPORTER") {
    this.clearShot();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set, 1.6, 90, -30, true);
    const p = this.presenter(name, SX + SW * 0.42, SY + SH + 14, 3.0);
    // a couple of other heads in the pack, out of focus, nearest the lens
    if (this.sc.textures.exists("tvpress_backs")) {
      for (const [x, f] of [[SX + SW * 0.9, 3], [SX + SW * 0.08, 10]] as [number, number][]) {
        const s = this.add(this.sc.add.sprite(x, SY + SH + 70, "tvpress_backs", f).setOrigin(0.5, 1).setScale(5.2).setAlpha(0.95));
        try {
          s.preFX?.addBlur(1, 2, 2, 1.4);
        } catch {
          /* canvas */
        }
        this.packers.push(s);
      }
    }
    this.flashes(600, 1400);
    this.camTo(1.05, SX + SW * 0.42, SY + 110, 6000);
    return p;
  }

  /** "Down the line": the studio on the left, the reporter on location on the right. */
  private split(left: string, right: string, rightSet: string, label: string) {
    this.clearShot();
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x0b2a5c).setOrigin(0));
    const g = this.add(this.sc.add.graphics());
    g.fillStyle(0xc8102e, 1).fillRect(SX, SY + SH * 0.18 - 6, SW, 4).fillRect(SX, SY + SH * 0.82 + 2, SW, 4);
    const pw = SW / 2 - 18;
    const ph = SH * 0.64;
    const boxes = [
      { x: SX + 12, who: left, set: this.scene.set, tag: "KRELFORD STUDIO" },
      { x: SX + SW / 2 + 6, who: right, set: rightSet, tag: label },
    ];
    for (const b of boxes) {
      const pane = this.add(this.sc.add.container(0, 0));
      const m = this.sc.make.graphics({}).fillRect(b.x, SY + SH * 0.18, pw, ph);
      pane.setMask(m.createGeometryMask());
      const src = this.sc.textures.exists(b.set) ? this.sc.textures.get(b.set).getSourceImage() : null;
      if (src) {
        const img = this.sc.add.image(b.x + pw / 2, SY + SH * 0.18 + ph / 2, b.set).setScale(Math.max(pw / src.width, ph / src.height) * 1.5);
        try {
          img.preFX?.addBlur(1, 2, 2, 1);
        } catch {
          /* canvas */
        }
        pane.add(img);
      }
      if (hasAnchor(this.sc, b.who)) {
        const p = new Presenter(this.sc, b.who, b.x + pw / 2, SY + SH * 0.18 + ph + 8, 2.0, pane);
        this.cast.push(p);
      }
      this.add(this.sc.add.rectangle(b.x, SY + SH * 0.18, pw, ph).setOrigin(0).setStrokeStyle(3, 0xffffff));
      this.add(this.sc.add.text(b.x + 6, SY + SH * 0.18 + 6, b.tag, { fontFamily: FONT, fontSize: "11px", color: "#ffffff", backgroundColor: "#c8102e", padding: { x: 4, y: 2 }, fontStyle: "bold" }));
    }
  }

  /** On location: the reporter walks and talks, the street sliding past behind her. */
  private walkAndTalk(name: string, set: string) {
    this.clearShot();
    const { SX, SY, SW, SH } = this.r;
    const bg = this.backdrop(set, 1.35, 80, -10);
    this.sc.tweens.add({ targets: bg, x: bg.x - 160, duration: 7000, ease: "Linear" });
    const p = this.presenter(name, SX + SW * 0.4, SY + SH + 14, 2.9);
    if (p) {
      this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 40, duration: 7000, ease: "Linear" });
      // the walk: a step bob
      this.sc.tweens.add({ targets: p.spr, y: p.spr.y - 6, duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeOut" });
    }
    // handheld
    this.every(110, () => this.stage.setPosition((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3));
    this.chrome.live("Krelburger, Krelford");
    void SH;
    return p;
  }

  /** Hidden-camera footage: grainy, green-grey, a REC dot and timestamp, the operator's hand shaking. */
  private footage(name: string) {
    this.clearShot();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set, 1.1);
    const p = this.presenter(name, SX + SW * 0.56, SY + SH - 40, 2.05);
    // the teacher's desk in front of him (with his supplies on it)
    const desk = this.add(this.sc.add.container(0, 0));
    desk.add(this.sc.add.rectangle(SX + SW * 0.1, SY + SH - 118, SW * 0.9, 18, 0x8b5a2b).setOrigin(0).setStrokeStyle(3, 0x3b2410));
    desk.add(this.sc.add.rectangle(SX + SW * 0.13, SY + SH - 100, SW * 0.84, 100, 0x6b3f1d).setOrigin(0).setStrokeStyle(3, 0x3b2410));
    for (let i = 0; i < 4; i++) {
      const cx = SX + SW * 0.2 + i * 26 + (i > 1 ? SW * 0.5 : 0);
      desk.add(this.sc.add.rectangle(cx, SY + SH - 118, 18, 30, 0xfdf2f8).setOrigin(0.5, 1).setStrokeStyle(2, 0x111111));
      desk.add(this.sc.add.rectangle(cx, SY + SH - 126, 18, 8, 0xec4899).setOrigin(0.5, 1));
      desk.add(this.sc.add.rectangle(cx + 4, SY + SH - 148, 2, 14, 0xffffff).setOrigin(0.5, 0));
    }
    desk.add(this.sc.add.text(SX + SW * 0.55, SY + SH - 60, "MR KRANDALL", { fontFamily: FONT, fontSize: "14px", color: "#fde68a", fontStyle: "bold" }).setOrigin(0.5));
    // the look
    const tint = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x6b8f6b, 0.28).setOrigin(0), this.fxLayer);
    tint.setBlendMode(Phaser.BlendModes.MULTIPLY);
    const grain = this.add(this.sc.add.graphics(), this.fxLayer);
    this.every(70, () => {
      grain.clear();
      for (let i = 0; i < 160; i++) grain.fillStyle(Math.random() < 0.5 ? 0xffffff : 0x000000, 0.12).fillRect(SX + Math.random() * SW, SY + Math.random() * SH, 2, 2);
      if (Math.random() < 0.12) grain.fillStyle(0xffffff, 0.06).fillRect(SX, SY + Math.random() * SH, SW, 3);
    });
    const vg = this.add(this.sc.add.graphics(), this.fxLayer);
    for (let i = 0; i < 8; i++) vg.lineStyle(16, 0x000000, 0.09).strokeRect(SX + i * 8, SY + i * 8, SW - i * 16, SH - i * 16);
    const rec = this.add(this.sc.add.circle(SX + SW - 70, SY + 58, 7, 0xff2020), this.fxLayer);
    this.add(this.sc.add.text(SX + SW - 58, SY + 49, "REC", { fontFamily: "monospace", fontSize: "16px", color: "#ffffff" }), this.fxLayer);
    this.sc.tweens.add({ targets: rec, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
    const ts = this.add(this.sc.add.text(SX + SW - 150, SY + SH - 80, "", { fontFamily: "monospace", fontSize: "14px", color: "#ffffff" }), this.fxLayer);
    let sec = 9 * 3600 + 14 * 60 + 2;
    this.every(1000, () => {
      sec++;
      ts.setText(`${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor(sec / 60) % 60).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`);
    });
    this.footageCaption = this.add(this.sc.add.text(SX + 16, SY + 46, "SECRET FOOTAGE", { fontFamily: FONT, fontSize: "14px", color: "#111827", backgroundColor: "#facc15", padding: { x: 6, y: 3 }, fontStyle: "bold" }), this.fxLayer);
    // a hand that isn't steady, and a camera that hunts for focus now and then
    this.every(90, () => this.stage.setPosition(this.stage.x * 0.6 + (Math.random() - 0.5) * 5, this.stage.y * 0.6 + (Math.random() - 0.5) * 5));
    this.every(3200, () => this.camTo(1 + Math.random() * 0.12, SX + SW * 0.55, SY + 120, 600, "Quad.out"));
    return p;
  }

  /** The Kreddle Express cab: Klerble at the controls, the cab shaking itself apart, the line streaming past. */
  private train() {
    this.clearShot();
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set, 1.25, 0, 20, true);
    // speed lines out of the vanishing point
    const lines = this.add(this.sc.add.graphics());
    this.every(40, () => {
      lines.clear();
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 60 + Math.random() * 120;
        const r1 = r0 + 80 + Math.random() * 140;
        lines.lineStyle(2, 0xffffff, 0.25).lineBetween(this.cx() + Math.cos(a) * r0, SY + SH * 0.4 + Math.sin(a) * r0, this.cx() + Math.cos(a) * r1, SY + SH * 0.4 + Math.sin(a) * r1);
      }
    });
    if (this.sc.textures.exists("tvanchor_KLERBLE_TRAIN")) {
      const k = this.add(this.sc.add.sprite(this.cx(), SY + SH + 8, "tvanchor_KLERBLE_TRAIN", this.trainFrame).setOrigin(0.5, 1).setScale(3.1));
      k.setData("train", true);
    }
    this.every(60, () => this.stage.setPosition((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
    this.chrome.live("The Kreddle Express · 300 MPH");
    void SW;
  }

  private trainYes(level: number) {
    const k = this.stage.list.find((o) => (o as Phaser.GameObjects.Sprite).getData?.("train")) as Phaser.GameObjects.Sprite | undefined;
    this.trainFrame = Math.min(2, level);
    if (k) {
      k.setFrame(this.trainFrame);
      const s = 3.1 + level * 0.35;
      this.sc.tweens.add({ targets: k, scale: { from: s * 1.12, to: s }, duration: 240, ease: "Back.out" });
    }
    this.sc.cameras.main.shake(300 + level * 150, 0.006 + level * 0.004);
    if (!calm()) {
      const { SX, SY, SW, SH } = this.r;
      const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, 0.25).setOrigin(0), this.fxLayer);
      this.sc.tweens.add({ targets: f, alpha: 0, duration: 160, onComplete: () => f.destroy() });
    }
  }

  /** Ken Burns over a still: B-roll. */
  private broll(set: string, caption: string) {
    this.clearShot();
    const { SX, SY, SW } = this.r;
    const bg = this.backdrop(set, 1.15, -40, 0);
    this.sc.tweens.add({ targets: bg, x: bg.x + 80, scale: bg.scale * 1.12, duration: 6000, ease: "Sine.easeInOut" });
    this.add(this.sc.add.text(SX + 16, SY + 46, caption.toUpperCase(), { fontFamily: FONT, fontSize: "14px", color: "#ffffff", backgroundColor: "#c8102ee6", padding: { x: 6, y: 3 }, fontStyle: "bold", wordWrap: { width: SW - 40 } }), this.fxLayer);
    // drifting smoke over it
    for (let i = 0; i < 5; i++) {
      const s = this.add(this.sc.add.circle(SX + 80 + i * 90, SY + 260, 40 + i * 6, 0x4b5563, 0.25), this.fxLayer);
      this.sc.tweens.add({ targets: s, y: s.y - 120, alpha: 0, scale: 2, duration: 4000 + i * 400, repeat: -1, delay: i * 500 });
    }
  }

  // ------------------------------------------------------------------ the beat hook

  /** Show a beat. Returns how long (ms) the picture wants held. */
  beat(b: TVBeat, idx: number): number {
    this.idx = idx;
    switch (b.type) {
      case "titleCard":
        return this.title(b.text);
      case "shot":
        return this.shot(b.set);
      case "speaker":
        return this.speak(b.character.toUpperCase(), b.text);
      case "direction":
        return this.direction(b.action);
      case "audience":
        if (b.cue === "gasp") {
          if (this.scene.kind === "presser" || this.scene.kind === "hall") this.flashStorm();
          else this.sc.cameras.main.shake(260, 0.006);
          // the pack lurches
          for (const p of this.packers) this.sc.tweens.add({ targets: p, y: p.y - 14, duration: 120, yoyo: true });
        }
        return 0;
      case "transition":
        if (b.mode === "smashCut") {
          const { SX, SY, SW, SH } = this.r;
          const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, calm() ? 0.3 : 0.9).setOrigin(0), this.fxLayer);
          this.sc.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
        }
        return 0;
      default:
        return 0;
    }
  }

  private title(text: string): number {
    const t = text.trim();
    const brand = BRANDS[this.cfg.brand];
    if (t.toUpperCase() === brand.name) {
      this.started = true;
      const ms = this.chrome.ident();
      this.later(ms - 300, () => {
        this.chrome.bug();
        this.chrome.ticker(this.cfg.ticker);
        // the studio comes up under the end of the ident
        if (!this.drawn) this.studioWide();
      }, false);
      return ms;
    }
    if (/^BREAKING:?/i.test(t)) {
      if (!this.drawn) this.studioWide();
      return this.chrome.breaking(t.replace(/^BREAKING:?\s*/i, ""));
    }
    if (/^LIVE:/i.test(t)) {
      const where = t.replace(/^LIVE:\s*/i, "");
      this.chrome.live(where.split("·")[0].trim());
      this.chrome.headline(where);
      return 0;
    }
    if (/^SECRET FOOTAGE/i.test(t)) {
      this.footageCaption?.setText(t.toUpperCase());
      this.chrome.headline(`GB Krews exclusive · ${t}`);
      // the footage jumps: a glitch between clips
      const { SX, SY, SW, SH } = this.r;
      const g = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, 0.35).setOrigin(0), this.fxLayer);
      this.sc.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
      return 0;
    }
    this.chrome.live("");
    this.chrome.headline(t);
    return 0;
  }

  private shot(set: string): number {
    const up = set.toUpperCase();
    // the studio's headline comes back when we do
    if (this.scene.kind === "desk" && this.chrome.headlineNow) this.deskHeadline = this.chrome.headlineNow;
    this.scene = this.cfg.scenes.find((s) => s.match.test(up)) ?? { ...STUDIO, set: STUDIO.set };
    if (this.scene.kind === "desk" && this.deskHeadline && this.chrome.headlineNow !== this.deskHeadline) this.chrome.headline(this.deskHeadline, /^BREAKING/i.test(this.deskHeadline) ? 0xb91c1c : undefined);
    this.lineInScene = 0;
    this.strapped.clear();
    this.mainSpeaker = this.mainOf(this.idx);
    switch (this.scene.kind) {
      case "desk":
        this.chrome.live("");
        this.studioWide();
        return 900;
      case "presser":
      case "hall":
        this.pressWide(this.mainSpeaker);
        return 1200;
      case "footage":
        this.chrome.live("");
        this.footage(this.mainSpeaker);
        return 600;
      case "train":
        this.trainFrame = 0;
        this.train();
        return 800;
    }
    return 0;
  }

  /** Who carries a scene (the first speaker after the heading who isn't the reporter). */
  private mainOf(from: number) {
    for (let i = from + 1; i < this.ep.beats.length; i++) {
      const b = this.ep.beats[i];
      if (b.type === "shot") break;
      if (b.type === "speaker" && b.character.toUpperCase() !== "REPORTER") return b.character.toUpperCase();
    }
    return "NEWSREADER";
  }

  private strapFor(name: string) {
    if (this.strapped.has(name)) return;
    this.strapped.add(name);
    const s = STRAPS[name];
    if (!s) return;
    const role = name === "REPORTER" && this.scene.kind === "desk" ? "Live from Krelford" : s[1];
    this.later(500, () => this.chrome.strap(s[0], role));
  }

  private otsFor(text: string) {
    return this.cfg.ots.find((o) => o.match.test(text)) ?? null;
  }

  private speak(name: string, text: string): number {
    const n = this.lineInScene++;
    const kind = this.scene.kind;
    const delay = /^\(long pause\)/i.test(text) ? 1100 : 0;
    let p: Presenter | null = null;
    if (kind === "desk") {
      if (name === "REPORTER") {
        // down the line, then her alone on location
        this.split("NEWSREADER", "REPORTER", "tv_krelburger", "KRELBURGER · LIVE");
        p = this.find("REPORTER");
        this.later(1700, () => {
          const q = this.walkAndTalk("REPORTER", "tv_krelburger");
          q?.say(text, { poses: ["thumb", "mic"], offset: 1700 });
          this.strapFor("REPORTER");
        });
        p?.say(text, { poses: ["thumb"] });
        return 0;
      }
      // back from the location: the LIVE tag goes
      this.chrome.live("");
      const ots = this.otsFor(text);
      const wide = n > 0 && n % 4 === 3 && !ots;
      if (n === 0 && !delay) {
        // hold the wide a moment, then cut in
        p = this.find(name) ?? (this.studioWide(name), this.find(name));
        p?.say(text);
        this.later(1300, () => {
          const q = this.mcu(name, { side: ots ? 95 : 0 });
          if (ots) this.chrome.ots(ots.pic, ots.caption, "left", this.fxLayer);
          q?.say(text, { offset: 1300 });
          this.strapFor(name);
        });
        return 0;
      }
      if (wide) {
        this.studioWide(name);
        p = this.find(name);
      } else {
        p = this.mcu(name, { side: ots ? 95 : 0 });
        if (ots) this.chrome.ots(ots.pic, ots.caption, "left", this.fxLayer);
        this.strapFor(name);
      }
      p?.say(text, { delay });
      return 0;
    }
    if (kind === "presser" || kind === "hall") {
      if (name === "REPORTER") {
        p = this.reporterInPack();
        p?.say(text, { poses: ["mic"] });
        return 0;
      }
      const podium = kind === "hall";
      if (n === 0) {
        p = this.find(name);
        p?.say(text);
        this.later(1500, () => {
          const q = this.mcu(name, { podium });
          q?.say(text, { offset: 1500 });
          this.flashes(900, 2200);
          this.strapFor(name);
        });
        return 0;
      }
      if (n % 3 === 2) p = this.pressWide(name);
      else {
        p = this.mcu(name, { podium, side: ((n % 2) * 2 - 1) * 30 });
        this.packers = [];
        this.flashes(1200, 2600);
      }
      p?.say(text);
      // "(he leaves, jingling)": off he goes when he's done
      if (/\(he leaves/i.test(text) && p) {
        const spr = p.spr;
        this.later(1700, () => this.sc.tweens.add({ targets: spr, x: spr.x + this.r.SW, duration: 900, ease: "Quad.in" }));
      }
      return 0;
    }
    if (kind === "footage") {
      p = this.find(name) ?? this.footage(name);
      p?.say(text);
      return 0;
    }
    if (kind === "train") {
      const level = Math.min(2, (text.match(/!/g)?.length ?? 1) - 1);
      this.trainYes(level);
      synth.play("alarm");
      return 0;
    }
    return 0;
  }

  private direction(action: string): number {
    if (/long pause/i.test(action) && this.mainSpeaker) {
      // hold on him, saying nothing; the camera creeps in; somewhere, a cough
      const p = this.mcu(this.mainSpeaker, { podium: this.scene.kind === "hall" });
      p?.stopTalking();
      this.camTo(1.16, this.cx(), this.r.SY + 100, 5000);
      return 1500;
    }
    if (/at the controls/i.test(action)) {
      this.trainYes(0);
      return 0;
    }
    return 0;
  }

  /** After the last beat: B-roll if the show has some, then the closing sting. Returns how long it runs. */
  outro(): number {
    let at = 0;
    const b = this.cfg.outroBroll;
    if (b) {
      this.broll(b.set, b.caption);
      this.chrome.live("Wildern Academy");
      at = 4200;
    }
    this.later(at, () => {
      this.clearShot();
      this.black();
      this.chrome.setVisible(false);
      const sting = (this.sting = new NewsChrome(this.sc, this.r, BRANDS[this.cfg.brand], 7));
      sting.ui.setMask(this.layer.mask!);
      sting.ident(true);
    }, false);
    return at + 2200;
  }

  get began() {
    return this.started;
  }
}


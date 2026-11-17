import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../systems/tv";
import { synth } from "../audio/Synth";
import { FONT } from "../ui/theme";
import { BRANDS, NewsChrome, calm, cameraFlash, type Rect } from "./tvnews/NewsChrome";
import { Presenter, hasAnchor } from "./tvnews/Presenter";
import { KREWS3_NEWS, STORY_KINDS, type StoryKind, type StoryScene, type Slide } from "./tvnews/krews3Shows";
import { KREWS4_NEWS, K4_KINDS, type K4Kind, type K4Scene, type K4Gfx } from "./tvnews/krews4Shows";
import { KREWS1_NEWS } from "./tvnews/krews1Shows";
import { fling, impact, playClip, type ClipOpts } from "./tv/action";

/**
 * GB Krews presentation for the story's compulsory broadcasts (Klerble's welcome and presser, the Krandall segment,
 * the Wildern bulletin). Like PovDirector it draws the whole picture beat by beat inside the telly, but as a news
 * channel: an ident, bug, clock, ticker and straps (NewsChrome), PixelLab presenters who lip-sync and gesture line by
 * line (Presenter), each story on its own set, and news camera language (slow push-ins, a trucking wide, the press
 * pack with flashes going off, a down-the-line split, hidden-camera footage, B-roll).
 */

type Kind = "desk" | "presser" | "hall" | "footage" | "train" | StoryKind | K4Kind;

export interface SceneDef extends StoryScene, K4Scene {
  match: RegExp;
  kind: Kind;
  set: string;
  /** who stands at the podium / carries the scene when the first speaker isn't them (a presser narrated by the reporter) */
  main?: string;
}

interface OtsDef {
  match: RegExp;
  pic: { key: string; frame?: number; crop?: [number, number, number, number] };
  caption: string;
}

export interface NewsCfg {
  brand: keyof typeof BRANDS;
  ticker: string[];
  scenes: SceneDef[];
  ots: OtsDef[];
  /** B-roll after the last line */
  outroBroll?: { set: string; caption: string };
  /** this show's name straps (before the shared ones) */
  straps?: Record<string, [string, string]>;
  /** where the reporter is when she's cut to from the desk (default: outside Krelburger) */
  deskReporter?: { set: string; where: string; live: string };
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
  ...KREWS3_NEWS,
  ...KREWS4_NEWS,
  ...KREWS1_NEWS,
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
    const anchor = this.scene.anchors?.[name];
    if (!hasAnchor(this.sc, anchor ?? name)) return null;
    const p = new Presenter(this.sc, name, x, y, scale, this.stage, anchor);
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
    // people flanking the podium stand behind it, a little smaller; the podium is always the main speaker's
    const flank = this.scene.flank ?? [];
    for (const [who, fx] of flank) this.presenter(who, SX + SW * fx, SY + SH * 0.86, 1.45);
    const main = flank.length ? (this.scene.main ?? name) : name;
    const m = this.presenter(main, this.cx(), SY + SH * (hall ? 0.86 : 0.88), hall ? 1.55 : 1.7);
    const p = main === name ? m : this.find(name);
    if (hall && p) this.lectern(this.cx(), SY + SH * 0.86, 1.55);
    this.pressPack(SY + SH + 52, 9, 2.15);
    this.flashes(500, 1300);
    // the camera drifts as if handheld over the pack
    this.stage.setScale(1.04).setPosition(-this.cx() * 0.04, -(SY + SH / 2) * 0.04);
    this.sc.tweens.add({ targets: this.stage, x: this.stage.x + 24, y: this.stage.y - 6, duration: 5000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
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
  private walkAndTalk(name: string, set: string, live = "Krelburger, Krelford") {
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
    this.chrome.live(live);
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
          if (this.scene.kind === "presser" || this.scene.kind === "hall" || this.scene.kind === "rally" || this.scene.kind === "keynote") this.flashStorm();
          else this.sc.cameras.main.shake(260, 0.006);
          // the pack lurches
          for (const p of this.packers) this.sc.tweens.add({ targets: p, y: p.y - 14, duration: 120, yoyo: true });
        }
        if (b.cue === "laugh" && this.scene.look === "sofa") this.sofaLaugh();
        return 0;
      case "sfx":
        return this.storySfx(b.id);
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
    const story = this.storyTitle(t);
    if (story >= 0) return story;
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
    this.mainSpeaker = this.scene.main ?? this.mainOf(this.idx);
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
      default:
        return this.storyShot();
    }
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
    const s = this.cfg.straps?.[name] ?? STRAPS[name];
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
    if (K4_KINDS.has(kind)) return this.k4Speak(name, text);
    if (STORY_KINDS.has(kind)) return this.storySpeak(name, text, n);
    if (kind === "desk") {
      if (name === "REPORTER") {
        // down the line, then her alone on location
        const loc = this.cfg.deskReporter ?? { set: "tv_krelburger", where: "KRELBURGER · LIVE", live: "Krelburger, Krelford" };
        this.split("NEWSREADER", "REPORTER", loc.set, loc.where);
        p = this.find("REPORTER");
        this.later(1700, () => {
          const q = this.walkAndTalk("REPORTER", loc.set, loc.live);
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
      if (name === "REPORTER" || this.scene.askers?.includes(name)) {
        p = this.reporterInPack(name);
        p?.say(text, { poses: ["mic"] });
        if (this.scene.askers) this.strapFor(name);
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
      if (this.k4bag === this.scene) this.chrome.ots({ key: "tv_k4_cashbag" }, "The bag of money", "left", this.fxLayer);
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
    const k4 = this.k4Direction(action);
    if (k4 >= 0) return k4;
    if (STORY_KINDS.has(this.scene.kind)) {
      const d = this.storyDirection(action);
      if (d >= 0) return d;
    }
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

  // ------------------------------------------------------------------ news stories (krews3.ts): the story kinds
  // field (a location with one or two people), vox (one person off-centre), rally, keynote and full-screen graphics.
  // See tvnews/krews3Shows.ts for the shows that use them.

  private score: { home: string; away: string; h: number; a: number; min: string } | null = null;
  private scoreBox?: Phaser.GameObjects.Container;
  private storyShotKind = "";
  private fieldRecut?: Phaser.Time.TimerEvent;
  private fieldTurn = 0;
  private slide?: Slide;
  private transcriptText?: Phaser.GameObjects.Text;
  private lastTranscript = "";
  private hotCaption = "";
  private placards: Phaser.GameObjects.Container[] = [];

  private storyShot(): number {
    const k = this.scene.kind;
    this.storyShotKind = "";
    this.fieldTurn = 0;
    this.chrome.clearStrap();
    this.lastTranscript = "";
    this.hotCaption = "";
    if (k === "field") {
      this.chrome.live("");
      this.fieldWide();
      return 900;
    }
    if (k === "vox") {
      this.chrome.live("");
      const nx = this.nextSpeaker();
      if (nx === "REPORTER") this.reporterPiece();
      else if (!nx || nx === "NEWSREADER") this.voxBroll();
      else this.voxShot(nx);
      return 500;
    }
    if (k === "rally") {
      this.rallyWide(this.mainSpeaker);
      return 1300;
    }
    if (k === "keynote") {
      this.slide = this.slide ?? this.scene.slides?.[0];
      this.keynoteWide(this.castMain());
      return 1300;
    }
    if (k === "graphic") {
      this.chrome.live("");
      this.graphic();
      return 1500;
    }
    if (K4_KINDS.has(k)) return this.k4Shot();
    return 0;
  }

  private castMain() {
    return this.scene.cast?.[0]?.[0] ?? this.mainSpeaker;
  }

  private nextSpeaker() {
    for (let i = this.idx + 1; i < this.ep.beats.length; i++) {
      const b = this.ep.beats[i];
      if (b.type === "shot") break;
      if (b.type === "speaker") return b.character.toUpperCase();
    }
    return "";
  }

  private storySpeak(name: string, text: string, n: number): number {
    const k = this.scene.kind;
    // a new line: whoever spoke before takes their name strap with them
    this.chrome.clearStrap();
    if (k === "graphic") return 0;
    if (k === "field") return this.fieldSpeak(name, text);
    if (k === "vox") {
      if (name === "REPORTER") {
        if (/vote labour - or/i.test(text) && this.sc.textures.exists("tv_prop_tshirt")) {
          this.tshirt();
          return 0;
        }
        const p = this.storyShotKind === "piece" ? this.find("REPORTER") : this.reporterPiece();
        p?.say(text, { poses: ["mic", "rest"] });
        this.strapFor(name);
        return 0;
      }
      if (name === "NEWSREADER") {
        this.voxBroll();
        return 0;
      }
      const p = (this.storyShotKind === "single" && this.find(name)) || this.voxShot(name);
      p?.say(text);
      this.strapFor(name);
      return 0;
    }
    if (k === "rally") {
      if (n === 0) {
        this.find(name)?.say(text);
        this.later(1500, () => {
          const q = this.mcu(name);
          this.storyShotKind = "close";
          this.flashes(900, 2000);
          q?.say(text, { offset: 1500 });
          this.strapFor(name);
        });
        return 0;
      }
      const p = this.storyShotKind === "close" ? this.rallyWide(name) : (this.storyShotKind = "close", this.mcu(name));
      p?.say(text);
      return 0;
    }
    if (k === "keynote") {
      const main = this.castMain();
      if (name !== main) {
        const q = /\?|\.\.\.$|^sir/i.test(text);
        const p = q ? this.reporterInPack(name) : this.reporterPiece();
        this.storyShotKind = q ? "pack" : "piece";
        p?.say(text, { poses: q ? ["mic"] : ["mic", "rest"] });
        this.strapFor(name);
        return 0;
      }
      const s = this.scene.slides?.find((sl) => sl.match.test(text));
      if (s) this.slide = s;
      if (this.storyShotKind === "wide" && !this.strapped.has(main)) {
        // a new slide comes up behind him, then in on him
        this.keynoteWide(main)?.say(text);
        this.later(1700, () => {
          this.keynoteClose(main)?.say(text, { offset: 1700 });
          this.strapFor(main);
        });
        return 0;
      }
      const p = this.storyShotKind === "close" ? this.keynoteWide(main) : this.keynoteClose(main);
      p?.say(text);
      this.strapFor(main);
      return 0;
    }
    return 0;
  }

  /** A field scene: the two-shot, then singles; anyone not in the scene talks over the pictures. */
  private fieldSpeak(name: string, text: string): number {
    const cast = this.scene.cast ?? [];
    const inCast = cast.some(([w]) => w === name);
    // a line said over the two-shot cuts to the speaker's single a beat later; the next line cancels that
    this.fieldRecut?.remove();
    this.fieldRecut = undefined;
    if (this.scene.k4look) this.k4Line(name, text);
    if (!inCast && this.scene.singles && hasAnchor(this.sc, this.scene.anchors?.[name] ?? name)) {
      const q = (this.storyShotKind === "single" && this.find(name)) || this.fieldSingle(name);
      q?.say(text);
      this.strapFor(name);
      return 0;
    }
    if (!inCast) {
      if (this.storyShotKind !== "wide") this.fieldWide();
      return 0;
    }
    let p: Presenter | null;
    if (this.storyShotKind === "wide" && !this.strapped.has(name)) {
      p = this.find(name);
      p?.say(text);
      if (this.scene.look === "hotmic") this.transcript(text);
      this.fieldRecut = this.later(1400, () => {
        this.fieldRecut = undefined;
        const q = this.fieldSingle(name);
        q?.say(text, { offset: 1400 });
        this.strapFor(name);
      });
      return 0;
    }
    this.fieldTurn = (this.fieldTurn + 1) % 3;
    if (this.fieldTurn === 2 && cast.length > 1) {
      this.fieldWide();
      p = this.find(name);
    } else p = this.fieldSingle(name);
    p?.say(text);
    if (this.scene.look === "hotmic") this.transcript(text);
    this.strapFor(name);
    return 0;
  }

  private storyDirection(action: string): number {
    if (this.scene.look === "hotmic") {
      this.transcript(`(${action})`, true);
      return 1800;
    }
    if (this.scene.kind === "keynote" && /leaves/i.test(action)) {
      const p = this.find(this.castMain());
      if (p) this.sc.tweens.add({ targets: p.spr, x: p.spr.x + this.r.SW, duration: 1400, ease: "Quad.in" });
      this.flashStorm(5);
      return 1600;
    }
    return -1;
  }

  /**
   * Euro 2024: ARBITRO-9000 charging players (PixelLab clips, tv/action.ts). A picture-in-picture "match footage"
   * insert over the reporter: the robot comes across the pitch and sends two players flying.
   */
  private roboRampage(): number {
    const { SX, SY, SW, SH } = this.r;
    const put = <T extends Phaser.GameObjects.GameObject>(o: T) => this.add(o, this.fxLayer);
    const box = { x: SX + 24, y: SY + 24, w: SW - 48, h: SH * 0.62 };
    const frame = put(this.sc.add.container(0, 0));
    const bg = this.sc.textures.exists("tv_k1_stadium") ? this.sc.add.image(box.x + box.w / 2, box.y + box.h / 2, "tv_k1_stadium") : this.sc.add.rectangle(box.x + box.w / 2, box.y + box.h / 2, box.w, box.h, 0x166534);
    if (bg instanceof Phaser.GameObjects.Image) bg.setScale(Math.max(box.w / bg.width, box.h / bg.height) * 1.4).setTint(0xd0ffd0);
    const mask = this.sc.make.graphics({}).fillRect(box.x, box.y, box.w, box.h);
    frame.add(bg);
    const ground = box.y + box.h - 8;
    const players = [0.55, 0.8].map((fx) => {
      const pl = this.sc.add.sprite(box.x + box.w * fx, ground, "tva_robo_player", 0).setOrigin(0.5, 1).setScale(2.4).setFlipX(true);
      frame.add(pl);
      return pl;
    });
    const robo = this.sc.add.sprite(box.x - 60, ground + 6, "tva_robo_charge", 0).setOrigin(0.5, 1).setScale(2.4);
    frame.add(robo);
    frame.setMask(mask.createGeometryMask());
    const border = put(this.sc.add.rectangle(box.x, box.y, box.w, box.h).setOrigin(0).setStrokeStyle(4, 0xffffff));
    const tag = put(this.sc.add.text(box.x + 10, box.y + 8, "MATCH FOOTAGE", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#dc2626", padding: { x: 6, y: 3 } }));
    playClip(this.sc, robo, "robo_charge", { fps: 10, frames: [3, 4, 5, 6], loop: true });
    synth.play("alarm");
    this.sc.tweens.add({ targets: robo, x: box.x + box.w + 80, duration: 2200, ease: "Linear" });
    players.forEach((pl, i) => {
      const at = ((pl.x - (box.x - 60)) / (box.w + 140)) * 2200 - 120;
      this.later(at, () => {
        if (!pl.active) return;
        synth.play("punch_big");
        impact(this.sc, (o) => {
          frame.add(o);
          return o;
        }, "pow", pl.x, pl.y - 70, 2, 0.014);
        playClip(this.sc, pl, "robo_player", { fps: 12 });
        this.sc.tweens.add({ targets: pl, x: pl.x + 150 + i * 40, duration: 600, ease: "Quad.out" });
        this.sc.tweens.add({ targets: pl, y: pl.y - 40, duration: 300, yoyo: true, ease: "Quad.out" });
      });
    });
    this.later(2600, () => {
      for (const o of [frame, border, tag]) this.sc.tweens.add({ targets: o, alpha: 0, duration: 250, onComplete: () => o.destroy() });
      mask.destroy();
    });
    return 2700;
  }

  private storySfx(id: string): number {
    if (/^explode/.test(id) && this.scene.boom) return this.k4Boom();
    if (id === "smash" && this.ep.id === "krews_roboref" && this.sc.textures.exists("tva_robo_charge")) return this.roboRampage();
    const { SX, SY, SW, SH } = this.r;
    const k = this.scene.kind;
    if (/^fart/.test(id) && k === "rally") {
      this.fartCloud();
      return 1000;
    }
    if (id === "whistle" && this.scene.look === "sport") {
      // the referee blows up: the camera jolts to him
      const h = this.find("MARK HUGHES");
      if (h) this.sc.tweens.add({ targets: h.spr, y: h.spr.y - 6, duration: 90, yoyo: true });
      this.sc.cameras.main.shake(150, 0.003);
      return 0;
    }
    if (id === "punch" && this.scene.look === "sport") {
      // the penalty goes in: a flash and the Kop groans
      const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, calm() ? 0.2 : 0.6).setOrigin(0), this.fxLayer);
      this.sc.tweens.add({ targets: f, alpha: 0, duration: 300, onComplete: () => f.destroy() });
      this.sc.cameras.main.shake(220, 0.005);
      synth.play("crowd_boo");
      return 700;
    }
    if (/^explode/.test(id) && k === "keynote") {
      const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xff9a3c, calm() ? 0.15 : 0.45).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
      this.sc.tweens.add({ targets: f, alpha: 0, duration: 500, onComplete: () => f.destroy() });
      this.sc.cameras.main.shake(300, 0.006);
      return 400;
    }
    return 0;
  }

  /** Titles the story shows use: a score update, the replay, a hot-mic caption, a section bumper. -1: not one of ours. */
  private storyTitle(t: string): number {
    const sc = t.match(/^SCORE:\s*(\S+)\s+(\d+)-(\d+)\s+(\S+)\s*·\s*([\d+]+)/i);
    if (sc) {
      const prev = this.score;
      this.score = { home: sc[1].toUpperCase(), away: sc[4].toUpperCase(), h: +sc[2], a: +sc[3], min: sc[5] };
      this.scoreBug();
      if (prev) this.scoreFlash();
      return prev ? 1900 : 300;
    }
    if (/^REPLAY$/i.test(t)) return this.replay();
    if (/^HOT MIC/i.test(t)) {
      this.hotCaption = t.toUpperCase();
      if (this.scene.kind === "mob") this.mobHotMic();
      this.footageCaption?.setText(this.hotCaption);
      this.chrome.headline(`GB Krews exclusive · ${t}`);
      return 0;
    }
    if (/^PART [A-Z]+:|^ELECTION SPECIAL/i.test(t)) return this.partCard(t);
    return -1;
  }

  // ---- field

  private fieldWide() {
    this.clearShot();
    this.storyShotKind = "wide";
    const { SX, SY, SW, SH } = this.r;
    const look = this.scene.look;
    const bg = this.backdrop(this.scene.set, 1.08);
    this.sc.tweens.add({ targets: bg, x: bg.x - 28, duration: 9000, ease: "Sine.easeInOut" });
    const cast = this.scene.cast ?? [];
    const s = look === "sport" ? 1.75 : cast.length > 1 ? 1.95 : 2.45;
    for (const [who, fx] of cast) this.presenter(who, SX + SW * fx, SY + SH + (look === "sport" ? -4 : 10), s);
    if (look === "sofa") this.lights();
    if (look === "sport") {
      // the broadcast camera, following the play
      this.stage.setScale(1.04).setPosition(-this.cx() * 0.04, -(SY + SH / 2) * 0.04);
      this.sc.tweens.add({ targets: this.stage, x: this.stage.x - 18, duration: 6000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.look();
  }

  private fieldSingle(name: string) {
    this.clearShot();
    this.storyShotKind = "single";
    const { SY, SH } = this.r;
    const fx = this.scene.cast?.find(([w]) => w === name)?.[1] ?? 0.5;
    this.backdrop(this.scene.set, 1.7, (0.5 - fx) * 300, -30, true);
    this.add(this.sc.add.rectangle(this.r.SX, SY, this.r.SW, SH, 0x000000, 0.1).setOrigin(0));
    const x = this.cx() + (fx < 0.45 ? -50 : fx > 0.55 ? 50 : 0);
    const p = this.presenter(name, x, SY + SH + 14, 3.0);
    this.lights();
    this.camTo(1.05, x, SY + 90, 8000);
    this.look();
    return p;
  }

  /** How a location is shot: sport (score bug, flashbulbs in the stands), secret footage, a hot mic, the breakfast sofa. */
  private look() {
    if (this.scene.k4look) return this.k4Look();
    const { SX, SY, SW, SH } = this.r;
    const look = this.scene.look;
    if (look === "sport") {
      this.scoreBug();
      const tw = this.add(this.sc.add.graphics());
      this.every(140, () => {
        tw.clear();
        for (let i = 0; i < 6; i++) tw.fillStyle(0xffffff, 0.9).fillRect(SX + Math.random() * SW, SY + SH * (0.1 + Math.random() * 0.3), 2, 2);
      });
      return;
    }
    if (look === "sofa") {
      this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffa94d, 0.06).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
      this.add(this.sc.add.text(SX + 12, SY + 12, "COURTESY: BBK BREAKFAST", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", backgroundColor: "#000000aa", padding: { x: 6, y: 3 }, fontStyle: "bold" }), this.fxLayer);
      return;
    }
    if (look !== "secret" && look !== "hotmic") return;
    const hot = look === "hotmic";
    const tint = this.add(this.sc.add.rectangle(SX, SY, SW, SH, hot ? 0x9a8a72 : 0x6b8f6b, hot ? 0.26 : 0.3).setOrigin(0), this.fxLayer);
    tint.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.grain(hot ? 110 : 160);
    const vg = this.add(this.sc.add.graphics(), this.fxLayer);
    for (let i = 0; i < 8; i++) vg.lineStyle(16, 0x000000, 0.09).strokeRect(SX + i * 8, SY + i * 8, SW - i * 16, SH - i * 16);
    const exclusive = this.chrome.headlineNow.match(/^GB Krews exclusive · (.+)$/i)?.[1];
    const cap = hot ? this.hotCaption || "HOT MIC" : (exclusive ?? "SECRET FOOTAGE").toUpperCase();
    this.footageCaption = this.add(this.sc.add.text(SX + 16, SY + 46, cap, { fontFamily: FONT, fontSize: "14px", color: "#111827", backgroundColor: "#facc15", padding: { x: 6, y: 3 }, fontStyle: "bold" }), this.fxLayer);
    if (!hot) {
      const rec = this.add(this.sc.add.circle(SX + SW - 70, SY + 58, 7, 0xff2020), this.fxLayer);
      this.add(this.sc.add.text(SX + SW - 58, SY + 49, "REC", { fontFamily: "monospace", fontSize: "16px", color: "#ffffff" }), this.fxLayer);
      this.sc.tweens.add({ targets: rec, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
      this.every(90, () => this.stage.setPosition(this.stage.x * 0.6 + (Math.random() - 0.5) * 5, this.stage.y * 0.6 + (Math.random() - 0.5) * 5));
      return;
    }
    // the hot mic: the tag, the levels, and what it picked up, typed out
    const tag = this.add(this.sc.add.text(SX + SW - 120, SY + 46, "● HOT MIC", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", backgroundColor: "#dc2626", padding: { x: 6, y: 3 }, fontStyle: "bold" }), this.fxLayer);
    this.sc.tweens.add({ targets: tag, alpha: 0.4, duration: 450, yoyo: true, repeat: -1 });
    this.add(this.sc.add.text(SX + SW - 120, SY + 72, "AUDIO ENHANCED", { fontFamily: "monospace", fontSize: "11px", color: "#fde68a" }), this.fxLayer);
    const wf = this.add(this.sc.add.graphics(), this.fxLayer);
    const wx = SX + SW - 186;
    const wy = SY + 112;
    this.every(60, () => {
      wf.clear();
      wf.fillStyle(0x000000, 0.6).fillRect(wx - 6, wy - 24, 176, 48);
      const loud = this.cast.some((p) => p.isTalking);
      for (let i = 0; i < 28; i++) {
        const a = loud ? 4 + Math.random() * 18 : 1 + Math.random() * 2;
        wf.fillStyle(loud ? 0x22c55e : 0x4b5563, 1).fillRect(wx + i * 6, wy - a, 4, a * 2);
      }
    });
    this.transcriptText = this.add(
      this.sc.add.text(SX + 16, SY + 78, this.lastTranscript, { fontFamily: "monospace", fontSize: "15px", color: "#fde047", backgroundColor: "#000000c0", padding: { x: 8, y: 6 }, wordWrap: { width: SW - 240 } }),
      this.fxLayer,
    );
    this.transcriptText.setVisible(!!this.lastTranscript);
    this.every(110, () => this.stage.setPosition(this.stage.x * 0.5 + (Math.random() - 0.5) * 3, this.stage.y * 0.5 + (Math.random() - 0.5) * 3));
  }

  private grain(n: number) {
    const { SX, SY, SW, SH } = this.r;
    const g = this.add(this.sc.add.graphics(), this.fxLayer);
    this.every(70, () => {
      g.clear();
      for (let i = 0; i < n; i++) g.fillStyle(Math.random() < 0.5 ? 0xffffff : 0x000000, 0.12).fillRect(SX + Math.random() * SW, SY + Math.random() * SH, 2, 2);
      if (Math.random() < 0.12) g.fillStyle(0xffffff, 0.06).fillRect(SX, SY + Math.random() * SH, SW, 3);
    });
  }

  private typeOn(t: Phaser.GameObjects.Text, s: string, ms = 30) {
    let i = 0;
    t.setText("");
    const ev = this.sc.time.addEvent({ delay: ms, repeat: Math.max(0, s.length - 1), callback: () => t.active && t.setText(s.slice(0, ++i)) });
    this.shotTimers.push(ev);
  }

  /** What the hot mic picked up, typed out (swearing asterisked, the way the papers print it). */
  private transcript(text: string, direction = false) {
    this.lastTranscript = direction ? text : `"${text.replace(/fuck/gi, (w) => `${w[0]}***`)}"`;
    const t = this.transcriptText;
    if (!t?.active) return;
    t.setVisible(true).setColor(direction ? "#d1d5db" : "#fde047").setFontStyle(direction ? "italic" : "bold");
    this.typeOn(t, this.lastTranscript, direction ? 22 : 45);
  }

  // ---- sport

  private scoreBug() {
    const s = this.score;
    if (!s || this.scene.look !== "sport") return;
    this.scoreBox?.destroy();
    const { SX, SY } = this.r;
    const c = (this.scoreBox = this.add(this.sc.add.container(SX + 12, SY + 12), this.fxLayer));
    const ab = (x: string) => x.slice(0, 3);
    c.add(this.sc.add.rectangle(0, 0, 214, 26, 0x0b1020, 0.92).setOrigin(0));
    c.add(this.sc.add.rectangle(0, 0, 6, 26, 0xc8102e).setOrigin(0));
    c.add(this.sc.add.text(12, 5, `${ab(s.home)}  ${s.h}-${s.a}  ${ab(s.away)}`, { fontFamily: FONT, fontSize: "15px", color: "#ffffff", fontStyle: "bold" }));
    c.add(this.sc.add.rectangle(146, 0, 68, 26, 0x15803d).setOrigin(0));
    const plus = s.min.includes("+");
    let sec = 0;
    const clock = this.sc.add.text(180, 13, "", { fontFamily: "monospace", fontSize: "14px", color: "#ffffff" }).setOrigin(0.5);
    c.add(clock);
    const draw = () => clock.active && clock.setText(plus ? `${s.min}'` : `${s.min}:${String(sec).padStart(2, "0")}`);
    draw();
    this.every(1000, () => {
      sec = (sec + 1) % 60;
      draw();
    });
  }

  /** The score update: a band across the bottom of the picture. */
  private scoreFlash() {
    const s = this.score!;
    const { SX, SY, SW, SH } = this.r;
    const c = this.add(this.sc.add.container(0, 0), this.fxLayer);
    const y = SY + SH * 0.62;
    const band = this.sc.add.rectangle(SX, y, SW, 64, 0x0b2a5c, 0.95).setOrigin(0).setScale(0, 1);
    c.add(band);
    c.add(this.sc.add.rectangle(SX, y, SW, 4, 0x15803d).setOrigin(0));
    const t = this.sc.add.text(this.cx(), y + 22, `${s.home}  ${s.h} – ${s.a}  ${s.away}`, { fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0);
    const m = this.sc.add.text(this.cx(), y + 50, s.min.includes("+") ? `FULL TIME · ${s.min}'` : `${s.min}'`, { fontFamily: FONT, fontSize: "13px", color: "#fde68a", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0);
    c.add([t, m]);
    this.sc.tweens.add({ targets: band, scaleX: 1, duration: 260, ease: "Cubic.out" });
    this.sc.tweens.add({ targets: [t, m], alpha: 1, duration: 200, delay: 200 });
    this.sc.tweens.add({ targets: t, scale: { from: 1.3, to: 1 }, duration: 380, delay: 200, ease: "Back.out" });
    this.later(1700, () => this.sc.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() }));
    synth.play("crowd_boo");
  }

  /** The replay: a wipe, then the moment again, slowed, with the pundit's pen circling the £20 note. */
  private replay(): number {
    if (this.scene.look !== "sport") return 0;
    const { SX, SY, SW, SH } = this.r;
    this.fieldWide();
    this.sc.tweens.killTweensOf(this.stage);
    this.stage.setScale(1).setPosition(0, 0);
    const k = this.find("JURGEN KLOPP");
    const h = this.find("MARK HUGHES");
    k?.setPose("note", false);
    this.later(1100, () => h?.setPose("stop"));
    // the wipe
    const w = this.add(this.sc.add.container(0, 0), this.fxLayer);
    const bar = this.sc.add.rectangle(SX - SW, SY + SH / 2, SW * 1.2, SH * 0.5, 0x15803d).setOrigin(0, 0.5).setAngle(-8);
    const wt = this.sc.add.text(SX - SW / 2, SY + SH / 2, "REPLAY", { fontFamily: FONT, fontSize: "48px", color: "#ffffff", fontStyle: "bold", stroke: "#0b2a5c", strokeThickness: 6 }).setOrigin(0.5);
    w.add([bar, wt]);
    this.sc.tweens.add({ targets: [bar, wt], x: `+=${SW * 2.2}`, duration: 900, ease: "Sine.inOut", onComplete: () => w.destroy() });
    synth.play("transform_sparkle");
    this.add(this.sc.add.text(SX + 12, SY + 44, "▶ REPLAY", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", backgroundColor: "#15803d", padding: { x: 6, y: 3 }, fontStyle: "bold" }), this.fxLayer);
    if (k) {
      // the note sits in his hand at about (22, 75) of the 128px frame
      const s = k.spr.scaleX;
      const nx = k.spr.x + (22 - 64) * s;
      const ny = k.spr.y - (128 - 75) * s;
      // push in until the note sits in the middle of the picture
      const z = 1.6;
      this.later(800, () => this.sc.tweens.add({ targets: this.stage, scale: z, x: this.cx() - (nx + 30) * z, y: SY + SH * 0.45 - ny * z, duration: 3000, ease: "Sine.easeInOut" }));
      const pen = this.add(this.sc.add.graphics());
      let a = 0;
      this.later(1600, () => {
        const ev = this.every(30, () => {
          a = Math.min(Math.PI * 2.1, a + 0.22);
          pen.clear().lineStyle(4, 0xfacc15, 1).beginPath().arc(nx, ny, 34, -Math.PI / 2, -Math.PI / 2 + a).strokePath();
          if (a >= Math.PI * 2.1) ev.remove();
        });
      });
      this.later(2400, () => {
        const lab = this.add(this.sc.add.text(nx + 44, ny - 44, "£20\n(CRUMPLED)", { fontFamily: FONT, fontSize: "16px", color: "#facc15", fontStyle: "bold", stroke: "#000000", strokeThickness: 4, align: "center" }).setOrigin(0, 0.5));
        lab.setScale(0.2);
        this.sc.tweens.add({ targets: lab, scale: 1, duration: 260, ease: "Back.out" });
        const arrow = this.add(this.sc.add.graphics());
        arrow.lineStyle(3, 0xfacc15, 1).lineBetween(nx + 46, ny - 30, nx + 26, ny - 18);
      });
    }
    return 1500;
  }

  // ---- vox pops, pieces to camera, the insider

  private voxShot(name: string) {
    this.clearShot();
    this.storyShotKind = "single";
    const { SX, SY, SW, SH } = this.r;
    const sil = this.scene.look === "silhouette";
    this.backdrop(this.scene.set, 1.5, 80, -20, true);
    if (sil) {
      this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x020617, 0.5).setOrigin(0));
      const glow = this.add(this.sc.add.ellipse(SX + SW * 0.6, SY + SH * 0.42, 340, 300, 0x93c5fd, 0.35).setBlendMode(Phaser.BlendModes.ADD));
      this.sc.tweens.add({ targets: glow, alpha: 0.75, duration: 1800, yoyo: true, repeat: -1 });
    }
    const x = SX + SW * 0.6;
    const p = this.presenter(name, x, SY + SH + 14, 2.85);
    if (sil && p) p.spr.setTint(0x05070d);
    if (sil) this.grain(60);
    this.camTo(1.04, x, SY + 100, 7000);
    return p;
  }

  private reporterPiece() {
    this.clearShot();
    this.storyShotKind = "piece";
    const { SX, SY, SW, SH } = this.r;
    const bg = this.backdrop(this.scene.set, 1.35, 70, -10);
    this.sc.tweens.add({ targets: bg, x: bg.x - 40, duration: 8000, ease: "Sine.easeInOut" });
    const p = this.presenter("REPORTER", SX + SW * 0.36, SY + SH + 14, 2.9);
    this.every(120, () => this.stage.setPosition((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5));
    if (this.scene.where) this.chrome.live(this.scene.where);
    return p;
  }

  private voxBroll() {
    if (this.storyShotKind === "broll") return;
    this.clearShot();
    this.storyShotKind = "broll";
    const bg = this.backdrop(this.scene.set, 1.12, -40, 0);
    this.sc.tweens.add({ targets: bg, x: bg.x + 70, scale: bg.scale * 1.1, duration: 7000, ease: "Sine.easeInOut" });
    this.chrome.live("");
  }

  /** The T-shirt, close: the slogan, then a SOLD OUT stamp. */
  private tshirt() {
    this.clearShot();
    this.storyShotKind = "insert";
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set, 1.8, -60, 0, true);
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0.25).setOrigin(0));
    const c = this.add(this.sc.add.container(this.cx(), SY + SH * 0.47));
    c.add(this.sc.add.image(0, 0, "tv_prop_tshirt").setScale(3.3));
    c.add(this.sc.add.circle(0, -84, 13, 0xffffff).setStrokeStyle(2, 0x7f1d1d));
    c.add(this.sc.add.text(0, -84, "✿", { fontFamily: FONT, fontSize: "18px", color: "#dc2626" }).setOrigin(0.5));
    c.add(
      this.sc.add
        .text(0, -6, "VOTE LABOUR\n– OR I'LL KICK THAT\nFUCKING BABY\nOUT OF YOU", { fontFamily: FONT, fontSize: "21px", color: "#ffffff", fontStyle: "bold", align: "center", stroke: "#7f1d1d", strokeThickness: 3, lineSpacing: 2 })
        .setOrigin(0.5),
    );
    c.setAngle(-3).setScale(0.92);
    this.sc.tweens.add({ targets: c, scale: 1.02, angle: 1, duration: 7000, ease: "Sine.easeInOut" });
    this.later(2600, () => {
      const st = this.add(this.sc.add.text(this.cx() + 90, SY + SH * 0.3, "SOLD OUT", { fontFamily: FONT, fontSize: "34px", color: "#ef4444", fontStyle: "bold", stroke: "#ffffff", strokeThickness: 5 }).setOrigin(0.5).setAngle(14), this.fxLayer);
      st.setScale(2.4).setAlpha(0);
      this.sc.tweens.add({ targets: st, scale: 1, alpha: 1, duration: 220, ease: "Back.out" });
      this.sc.cameras.main.shake(140, 0.004);
      synth.play("hit");
    });
    if (this.scene.where) this.chrome.live(this.scene.where);
  }

  // ---- the rally

  private rallyWide(name: string) {
    this.clearShot();
    this.storyShotKind = "wide";
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set, 1.04, 0, -10);
    // stage lights sweeping
    for (let i = 0; i < 4; i++) {
      const b = this.add(this.sc.add.triangle(SX + SW * (0.15 + i * 0.23), SY, 0, 0, -50, SH * 0.9, 50, SH * 0.9, [0xffffff, 0xf472b6, 0x60a5fa, 0xffffff][i], 0.07).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD));
      b.setAngle(-20 + i * 12);
      this.sc.tweens.add({ targets: b, angle: b.angle + 26, duration: 2200 + i * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const p = this.presenter(name, this.cx(), SY + SH * 0.83, 1.45);
    this.crowd();
    this.confetti();
    this.packers = [];
    this.flashes(700, 1700);
    this.stage.setScale(1.03).setPosition(-this.cx() * 0.03, -(SY + SH / 2) * 0.03);
    this.sc.tweens.add({ targets: this.stage, x: this.stage.x + 20, y: this.stage.y - 5, duration: 5000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (this.scene.where) this.chrome.live(this.scene.where);
    return p;
  }

  /** Heads and shoulders along the bottom, and placards bobbing above them. */
  private crowd() {
    const { SX, SY, SW, SH } = this.r;
    this.placards = [];
    const words = ["CHANGE", "KEIR!", "LABOUR", "VOTE LAB", "KEIR 4 PM", "CHANGE", "LABOUR", "♥ KEIR", "VOTE LAB"];
    for (let i = 0; i < 9; i++) {
      const x = SX + 30 + (i * (SW - 60)) / 8 + ((i * 29) % 17) - 8;
      const y = SY + SH - 70 - (i % 2) * 26;
      const c = this.add(this.sc.add.container(x, y));
      c.add(this.sc.add.rectangle(0, 20, 4, 44, 0x6b4423));
      const red = i % 3 !== 1;
      c.add(this.sc.add.rectangle(0, -8, 74, 34, red ? 0xdc2626 : 0xffffff).setStrokeStyle(2, 0x111111));
      c.add(this.sc.add.text(0, -8, words[i], { fontFamily: FONT, fontSize: "13px", color: red ? "#ffffff" : "#dc2626", fontStyle: "bold" }).setOrigin(0.5));
      c.setAngle(((i % 3) - 1) * 6);
      this.sc.tweens.add({ targets: c, y: y - 8, angle: c.angle + ((i % 2) * 2 - 1) * 5, duration: 320 + i * 37, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: i * 60 });
      this.placards.push(c);
    }
    const heads = this.add(this.sc.add.container(0, 0));
    const g = this.sc.add.graphics();
    heads.add(g);
    for (let i = 0; i < 12; i++) {
      const x = SX + 10 + i * (SW / 11) + ((i * 13) % 11);
      g.fillStyle(0x0b0b12, 1).fillCircle(x, SY + SH - 34 + (i % 2) * 8, 17).fillEllipse(x, SY + SH + 6 + (i % 2) * 8, 62, 46);
    }
    this.sc.tweens.add({ targets: heads, y: -5, duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private confetti() {
    const { SX, SY, SW, SH } = this.r;
    for (let i = 0; i < 26; i++) {
      const p = this.add(this.sc.add.rectangle(SX + Math.random() * SW, SY - 10 - Math.random() * SH, 5, 8, [0xdc2626, 0xffffff, 0xfacc15, 0x2563eb][i % 4]));
      this.sc.tweens.add({ targets: p, y: SY + SH + 20, x: p.x + (Math.random() - 0.5) * 80, angle: 720, duration: 3500 + Math.random() * 3000, repeat: -1, delay: Math.random() * 2000 });
    }
  }

  /** "Smell that, Sunak!": the wide, a green cloud off the lectern, and the placards slowly coming down. */
  private fartCloud() {
    const p = this.rallyWide(this.mainSpeaker);
    const { SY, SH } = this.r;
    const x = p ? p.spr.x : this.cx();
    const y = p ? p.spr.y - p.spr.displayHeight * 0.42 : SY + SH * 0.55;
    this.sc.cameras.main.shake(420, 0.008);
    for (let i = 0; i < 12; i++)
      this.later(i * 70, () => {
        const c = this.add(this.sc.add.circle(x + (Math.random() - 0.5) * 50, y + 10, 12 + Math.random() * 10, [0x84cc16, 0xa3e635, 0x65a30d][i % 3], 0.55));
        this.sc.tweens.add({ targets: c, scale: 4 + Math.random() * 2, y: c.y - 60 - Math.random() * 60, x: c.x + (Math.random() - 0.5) * 160, alpha: 0, duration: 1800 + Math.random() * 600, onComplete: () => c.destroy() });
      });
    for (const pl of this.placards) {
      this.sc.tweens.killTweensOf(pl);
      this.sc.tweens.add({ targets: pl, y: pl.y + 60, angle: pl.angle + (Math.random() - 0.5) * 40, duration: 900, delay: 400 + Math.random() * 400, ease: "Quad.in" });
    }
  }

  // ---- the keynote

  private keynoteWide(name: string) {
    this.clearShot();
    this.storyShotKind = "wide";
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set);
    const sc = this.scene.screen ?? [0.24, 0.2, 0.52, 0.38];
    this.drawSlide(SX + SW * sc[0], SY + SH * sc[1], SW * sc[2], SH * sc[3]);
    const spot = this.add(this.sc.add.ellipse(this.cx(), SY + SH * 0.8, 230, 300, 0xffffff, 0.07).setBlendMode(Phaser.BlendModes.ADD));
    this.sc.tweens.add({ targets: spot, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
    const p = this.presenter(name, this.cx(), SY + SH * 0.9, 1.4);
    this.pressPack(SY + SH + 52, 9, 2.15);
    this.flashes(500, 1400);
    this.stage.setScale(1.04).setPosition(-this.cx() * 0.04, -(SY + SH / 2) * 0.04);
    this.sc.tweens.add({ targets: this.stage, x: this.stage.x + 22, y: this.stage.y - 6, duration: 5000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (this.scene.where) this.chrome.live(this.scene.where);
    return p;
  }

  private keynoteClose(name: string) {
    this.clearShot();
    this.storyShotKind = "close";
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.scene.set, 1.7, 60, 50, true);
    this.drawSlide(SX + 18, SY + 48, SW * 0.56, SH * 0.42);
    const x = SX + SW * 0.72;
    const p = this.presenter(name, x, SY + SH + 14, 3.0);
    this.lights();
    this.packers = [];
    this.flashes(1000, 2400);
    this.camTo(1.04, x, SY + 100, 8000);
    return p;
  }

  private plane(g: Phaser.GameObjects.Graphics, s: number, color = 0xe5e7eb) {
    g.fillStyle(color, 1)
      .fillRoundedRect(-14 * s, -3 * s, 28 * s, 6 * s, 3 * s)
      .fillTriangle(-2 * s, 0, 6 * s, 0, -6 * s, -13 * s)
      .fillTriangle(-2 * s, 0, 6 * s, 0, -6 * s, 13 * s)
      .fillTriangle(-14 * s, 0, -9 * s, 0, -15 * s, -7 * s);
    g.fillStyle(0x60a5fa, 1).fillRect(8 * s, -2 * s, 4 * s, 2 * s);
  }

  /** The giant screen behind the executive: the current slide, animated. */
  private drawSlide(x: number, y: number, w: number, h: number) {
    const sl = this.slide;
    const c = this.add(this.sc.add.container(x, y));
    const bg = this.sc.add.graphics();
    bg.fillGradientStyle(0x0b1d4a, 0x1e1b4b, 0x020617, 0x020617, 1).fillRect(0, 0, w, h);
    bg.lineStyle(3, 0x60a5fa, 0.9).strokeRect(0, 0, w, h);
    c.add(bg);
    if (!sl) return c;
    const title = this.sc.add.text(w / 2, h * 0.16, sl.title, { fontFamily: FONT, fontSize: `${Math.round(h * 0.15)}px`, color: "#ffffff", fontStyle: "bold", stroke: "#1d4ed8", strokeThickness: 4 }).setOrigin(0.5);
    c.add(title);
    if (sl.sub) c.add(this.sc.add.text(w / 2, h * 0.9, sl.sub, { fontFamily: FONT, fontSize: `${Math.round(h * 0.075)}px`, color: "#fde047", fontStyle: "bold" }).setOrigin(0.5));
    this.sc.tweens.add({ targets: title, scale: { from: 0.9, to: 1 }, duration: 500, ease: "Back.out" });
    const cy = h * 0.53;
    const s = h / 110;
    if (sl.art === "logo") {
      const g = this.sc.add.graphics({ x: w / 2, y: cy });
      this.plane(g, s * 2.2);
      c.add(g);
      for (let i = 0; i < 7; i++) {
        const f = this.sc.add.circle(w / 2 - 34 * s - i * 6 * s, cy + (Math.random() - 0.5) * 8 * s, (6 - i * 0.6) * s, [0xf97316, 0xfacc15, 0xef4444][i % 3], 0.9);
        c.add(f);
        this.sc.tweens.add({ targets: f, scale: 0.4, alpha: 0.3, duration: 180 + i * 30, yoyo: true, repeat: -1 });
      }
      this.sc.tweens.add({ targets: g, angle: 8, y: cy + 4 * s, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else if (sl.art === "planes") {
      const a = this.sc.add.graphics({ x: w * 0.12, y: cy });
      const b = this.sc.add.graphics({ x: w * 0.88, y: cy });
      this.plane(a, s * 1.3);
      this.plane(b, s * 1.3, 0xfca5a5);
      b.setScale(-1, 1);
      c.add([a, b]);
      const boom = () => {
        if (!a.active) return;
        a.setPosition(w * 0.12, cy).setVisible(true);
        b.setPosition(w * 0.88, cy).setVisible(true);
        this.sc.tweens.add({ targets: a, x: w * 0.5 - 12 * s, duration: 1100, ease: "Quad.in" });
        this.sc.tweens.add({
          targets: b,
          x: w * 0.5 + 12 * s,
          duration: 1100,
          ease: "Quad.in",
          onComplete: () => {
            if (!a.active) return;
            a.setVisible(false);
            b.setVisible(false);
            for (let i = 0; i < 6; i++) {
              const e = this.sc.add.circle(w / 2, cy, 6 * s, [0xfacc15, 0xf97316, 0xef4444][i % 3], 0.9);
              c.add(e);
              this.sc.tweens.add({ targets: e, scale: 3 + i, alpha: 0, x: w / 2 + (Math.random() - 0.5) * 40 * s, y: cy + (Math.random() - 0.5) * 30 * s, duration: 600 + i * 60, onComplete: () => e.destroy() });
            }
            const pts = this.sc.add.text(w / 2, cy - 20 * s, "+500", { fontFamily: FONT, fontSize: `${Math.round(h * 0.13)}px`, color: "#4ade80", fontStyle: "bold", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5);
            c.add(pts);
            this.sc.tweens.add({ targets: pts, y: pts.y - 18 * s, alpha: 0, duration: 1100, onComplete: () => pts.destroy() });
          },
        });
      };
      boom();
      this.every(2400, boom);
    } else if (sl.art === "sensor") {
      const dev = this.sc.add.container(w / 2, cy);
      dev.add(this.sc.add.rectangle(0, 0, 70 * s, 34 * s, 0x7c3aed).setStrokeStyle(3, 0xc4b5fd));
      dev.add(this.sc.add.rectangle(-22 * s, 0, 8 * s, 8 * s, 0x22d3ee));
      dev.add(this.sc.add.text(10 * s, 0, "SENSOR", { fontFamily: FONT, fontSize: `${Math.round(9 * s)}px`, color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
      c.add(dev);
      this.sc.tweens.add({ targets: dev, x: w / 2 + 3, duration: 40, yoyo: true, repeat: -1 });
      for (let i = 0; i < 3; i++) {
        const arc = this.sc.add.graphics({ x: w / 2, y: cy });
        arc.lineStyle(2, 0xf0abfc, 1).beginPath().arc(0, 0, (42 + i * 10) * s, -0.5, 0.5).strokePath().beginPath().arc(0, 0, (42 + i * 10) * s, Math.PI - 0.5, Math.PI + 0.5).strokePath();
        c.add(arc);
        this.sc.tweens.add({ targets: arc, alpha: 0.1, duration: 260, yoyo: true, repeat: -1, delay: i * 90 });
      }
      this.every(260, () => {
        if (!dev.active) return;
        const d = this.sc.add.circle(w / 2 + (Math.random() - 0.5) * 50 * s, cy + 18 * s, 2.5 * s, 0x7dd3fc);
        c.add(d);
        this.sc.tweens.add({ targets: d, y: d.y + 22 * s, alpha: 0, duration: 700, onComplete: () => d.destroy() });
      });
    } else if (sl.art === "club") {
      const neon = this.sc.add.text(w / 2, cy - 6 * s, "TABLE DANCING", { fontFamily: FONT, fontSize: `${Math.round(h * 0.14)}px`, color: "#f472b6", fontStyle: "bold", stroke: "#831843", strokeThickness: 3 }).setOrigin(0.5);
      c.add(neon);
      this.every(170, () => neon.active && neon.setAlpha(Math.random() < 0.2 ? 0.3 : 1));
      const g = this.sc.add.graphics({ x: w / 2, y: cy + 22 * s });
      this.plane(g, s);
      c.add(g);
      this.sc.tweens.add({ targets: g, x: w / 2 + 30 * s, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else if (sl.art === "img" && sl.img) this.slideImg(c, sl.img, w, h);
    else if (sl.art === "money") {
      this.every(110, () => {
        if (!c.active) return;
        const d = this.sc.add.text(Math.random() * w, h * 0.28, "$", { fontFamily: FONT, fontSize: `${Math.round(h * 0.12)}px`, color: "#4ade80", fontStyle: "bold" }).setOrigin(0.5);
        c.add(d);
        this.sc.tweens.add({ targets: d, y: h * 0.82, angle: (Math.random() - 0.5) * 90, duration: 1000, onComplete: () => d.destroy() });
      });
    }
    return c;
  }

  // ---- full-screen graphics and bumpers

  private graphic() {
    this.clearShot();
    this.storyShotKind = "gfx";
    const g = this.scene.gfx;
    const { SX, SY, SW, SH } = this.r;
    const brand = BRANDS[this.cfg.brand];
    const bg = this.add(this.sc.add.graphics());
    bg.fillGradientStyle(brand.accent, brand.accent, 0x020617, 0x020617, 1).fillRect(SX, SY, SW, SH);
    for (let i = 0; i < 5; i++) {
      const st = this.add(this.sc.add.rectangle(SX - 100 + i * 140, SY + SH / 2, 40, SH * 1.6, 0xffffff, 0.035).setAngle(25).setBlendMode(Phaser.BlendModes.ADD));
      this.sc.tweens.add({ targets: st, x: st.x + 160, duration: 5000 + i * 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.chrome.globe(SX + SW - 70, SY + 120, 80, 0xffffff, this.stage, 0.12);
    if (!g) {
      if (this.scene.k4gfx) this.k4Graphic(this.scene.k4gfx);
      return;
    }
    const title = this.add(this.sc.add.text(SX + 28, SY + 44, g.title, { fontFamily: FONT, fontSize: "22px", color: "#ffffff", fontStyle: "bold" }));
    this.add(this.sc.add.rectangle(SX + 28, SY + 74, Math.min(SW - 56, title.width + 30), 4, brand.main).setOrigin(0));
    title.setX(SX - 300);
    this.sc.tweens.add({ targets: title, x: SX + 28, duration: 350, ease: "Cubic.out" });
    const top = SY + 92;
    if (g.type === "poll") {
      this.add(this.sc.add.text(SX + 28, top - 8, g.sub, { fontFamily: FONT, fontSize: "13px", color: "#cbd5e1", fontStyle: "italic" }));
      const maxW = SW - 230;
      g.bars.forEach((b, i) => {
        const y = top + 26 + i * 54;
        this.add(this.sc.add.text(SX + 28, y + 8, b.label, { fontFamily: FONT, fontSize: "17px", color: "#ffffff", fontStyle: "bold" }));
        this.add(this.sc.add.rectangle(SX + 120, y, maxW, 34, 0xffffff, 0.08).setOrigin(0));
        const bar = this.add(this.sc.add.rectangle(SX + 120, y, (maxW * b.from) / 70, 34, b.color).setOrigin(0));
        const num = this.add(this.sc.add.text(SX + 128 + (maxW * b.from) / 70, y + 7, `${b.from}%`, { fontFamily: FONT, fontSize: "17px", color: "#ffffff", fontStyle: "bold" }));
        const d = b.to - b.from;
        this.later(900 + i * 160, () => {
          this.sc.tweens.addCounter({
            from: b.from,
            to: b.to,
            duration: 1500,
            ease: "Cubic.inOut",
            onUpdate: (tw) => {
              if (!bar.active) return;
              const v = tw.getValue() ?? b.to;
              bar.width = (maxW * Math.max(0, v)) / 70;
              num.setText(`${Math.round(v)}%`).setX(SX + 128 + bar.width);
            },
          });
          synth.play("tap");
        });
        this.later(2600 + i * 160, () => {
          const dt = this.add(this.sc.add.text(SX + SW - 30, y + 7, `${d >= 0 ? "▲" : "▼"} ${d >= 0 ? "+" : ""}${d}`, { fontFamily: FONT, fontSize: "17px", color: d >= 0 ? "#4ade80" : "#f87171", fontStyle: "bold" }).setOrigin(1, 0));
          dt.setScale(0.3);
          this.sc.tweens.add({ targets: dt, scale: 1, duration: 260, ease: "Back.out" });
          if (Math.abs(d) >= 20) this.sc.cameras.main.shake(200, 0.005);
        });
      });
    } else if (g.type === "trend") {
      g.tags.forEach((t, i) => {
        const y = top + 10 + i * 62;
        const row = this.add(this.sc.add.container(SX - 300, y));
        row.add(this.sc.add.rectangle(0, 0, 290, 52, 0xffffff, 0.1).setOrigin(0));
        row.add(this.sc.add.text(12, 6, `${i + 1}  ${t.tag}`, { fontFamily: FONT, fontSize: "19px", color: "#ffffff", fontStyle: "bold" }));
        const n = this.sc.add.text(40, 30, "", { fontFamily: FONT, fontSize: "12px", color: "#93c5fd" });
        row.add(n);
        let v = t.n * 0.6;
        this.every(120, () => {
          v += t.n * 0.006 * (1 + Math.random());
          n.active && n.setText(`${(v / 1e6).toFixed(2)}M posts`);
        });
        this.sc.tweens.add({ targets: row, x: SX + 28, duration: 380, delay: 300 + i * 260, ease: "Cubic.out" });
      });
      let k = 0;
      const post = () => {
        const txt = g.posts[k % g.posts.length];
        const y = top + 10 + (k % 4) * 66;
        const card = this.add(this.sc.add.container(SX + SW + 200, y));
        card.add(this.sc.add.rectangle(0, 0, 220, 58, 0xffffff, 0.95).setOrigin(0));
        card.add(this.sc.add.circle(18, 18, 10, [0xf87171, 0x60a5fa, 0xfacc15, 0x34d399][k % 4]));
        card.add(this.sc.add.text(34, 6, txt, { fontFamily: FONT, fontSize: "11px", color: "#111827", wordWrap: { width: 180 } }));
        this.sc.tweens.add({ targets: card, x: SX + SW - 248, duration: 320, ease: "Cubic.out" });
        synth.play("notify");
        k++;
      };
      this.later(900, post);
      this.every(1300, post);
    } else if (g.type === "statement") {
      const cw = SW - 90;
      const card = this.add(this.sc.add.container(this.cx(), top + 140));
      card.add(this.sc.add.rectangle(0, 0, cw, 240, 0xf8fafc).setStrokeStyle(3, g.color));
      card.add(this.sc.add.rectangle(0, -102, cw, 36, g.color));
      card.add(this.sc.add.circle(-cw / 2 + 30, -102, 13, 0xfacc15).setStrokeStyle(3, 0xffffff));
      card.add(this.sc.add.text(-cw / 2 + 52, -112, g.from.toUpperCase(), { fontFamily: FONT, fontSize: "15px", color: "#ffffff", fontStyle: "bold" }));
      const q = this.sc.add.text(-cw / 2 + 24, -70, "", { fontFamily: FONT, fontSize: "18px", color: "#111827", fontStyle: "italic", wordWrap: { width: cw - 48 }, lineSpacing: 4 });
      card.add(q);
      card.add(this.sc.add.text(cw / 2 - 20, 100, "— statement", { fontFamily: FONT, fontSize: "12px", color: "#6b7280" }).setOrigin(1, 0.5));
      card.setScale(0.85).setAlpha(0);
      this.sc.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 350, ease: "Back.out" });
      this.later(500, () => this.typeOn(q, `“${g.quote}”`, 32));
    } else if (g.type === "teaser") {
      // the post, then the guesses piling up around it
      const cw = 300;
      const card = this.add(this.sc.add.container(SX + 28 + cw / 2, top + 120));
      card.add(this.sc.add.rectangle(0, 0, cw, 190, 0xffffff).setStrokeStyle(2, 0xcbd5e1));
      card.add(this.sc.add.circle(-cw / 2 + 28, -66, 16, 0xdc2626).setStrokeStyle(2, 0xffffff));
      card.add(this.sc.add.text(-cw / 2 + 28, -66, "KS", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
      card.add(this.sc.add.text(-cw / 2 + 52, -80, g.from, { fontFamily: FONT, fontSize: "14px", color: "#111827", fontStyle: "bold" }));
      card.add(this.sc.add.text(-cw / 2 + 52, -62, g.handle, { fontFamily: FONT, fontSize: "11px", color: "#6b7280" }));
      const q = this.sc.add.text(-cw / 2 + 14, -38, "", { fontFamily: FONT, fontSize: "14px", color: "#111827", wordWrap: { width: cw - 28 }, lineSpacing: 3 });
      card.add(q);
      card.add(this.sc.add.text(-cw / 2 + 14, 74, `${g.when}  ·  48.2K likes  ·  19.7K reposts`, { fontFamily: FONT, fontSize: "11px", color: "#6b7280" }));
      card.setScale(0.85).setAlpha(0);
      this.sc.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 350, ease: "Back.out" });
      this.later(400, () => this.typeOn(q, g.post, 26));
      g.guesses.forEach((t, i) => {
        this.later(1800 + i * 650, () => {
          const x = SX + SW - 120 + ((i % 2) * 2 - 1) * 34;
          const y = top + 10 + i * 52;
          const b = this.add(this.sc.add.text(x, y, t, { fontFamily: FONT, fontSize: "14px", color: "#ffffff", backgroundColor: "#1e3a8acc", padding: { x: 8, y: 5 }, fontStyle: "bold" }).setOrigin(0.5));
          b.setScale(0.2);
          this.sc.tweens.add({ targets: b, scale: 1, duration: 260, ease: "Back.out" });
          synth.play("notify");
        });
      });
    } else if (g.type === "error") {
      // a browser window: the address bar, then the error page, the spinner giving up
      const ww = SW - 70;
      const wh = SH - 150;
      const win = this.add(this.sc.add.container(this.cx(), top + 18 + wh / 2));
      win.add(this.sc.add.rectangle(0, 0, ww, wh, 0xffffff).setStrokeStyle(2, 0x94a3b8));
      win.add(this.sc.add.rectangle(0, -wh / 2 + 16, ww, 32, 0xe2e8f0));
      [0xef4444, 0xf59e0b, 0x22c55e].forEach((c, i) => win.add(this.sc.add.circle(-ww / 2 + 16 + i * 16, -wh / 2 + 16, 5, c)));
      win.add(this.sc.add.rectangle(24, -wh / 2 + 16, ww - 120, 20, 0xffffff).setStrokeStyle(1, 0xcbd5e1));
      win.add(this.sc.add.text(-ww / 2 + 78, -wh / 2 + 9, g.url, { fontFamily: FONT, fontSize: "11px", color: "#334155" }));
      const spin = this.sc.add.text(ww / 2 - 26, -wh / 2 + 16, "↻", { fontFamily: FONT, fontSize: "16px", color: "#334155" }).setOrigin(0.5);
      win.add(spin);
      this.sc.tweens.add({ targets: spin, angle: 360, duration: 900, repeat: 2, onComplete: () => spin.active && spin.setAngle(0).setText("×") });
      const page = this.sc.add.container(0, 10).setAlpha(0);
      win.add(page);
      page.add(this.sc.add.rectangle(0, -wh / 2 + 44, ww, 24, 0x0b0c0c).setOrigin(0.5, 0.5));
      page.add(this.sc.add.text(-ww / 2 + 14, -wh / 2 + 36, "GOV.UK", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold" }));
      page.add(this.sc.add.text(-ww / 2 + 24, -wh / 2 + 70, g.code, { fontFamily: FONT, fontSize: "54px", color: "#0b0c0c", fontStyle: "bold" }));
      page.add(this.sc.add.text(-ww / 2 + 24, -wh / 2 + 132, g.msg, { fontFamily: FONT, fontSize: "22px", color: "#0b0c0c", fontStyle: "bold" }));
      page.add(this.sc.add.text(-ww / 2 + 24, -wh / 2 + 166, g.sub, { fontFamily: FONT, fontSize: "13px", color: "#334155", wordWrap: { width: ww - 48 }, lineSpacing: 3 }));
      const queue = this.sc.add.text(-ww / 2 + 24, wh / 2 - 30, "", { fontFamily: FONT, fontSize: "12px", color: "#b91c1c", fontStyle: "bold" });
      page.add(queue);
      let n = 1_204_311;
      this.every(110, () => {
        n += 2000 + Math.floor(Math.random() * 6000);
        queue.active && queue.setText(`You are number ${n.toLocaleString("en-GB")} in the queue`);
      });
      win.setScale(0.9).setAlpha(0);
      this.sc.tweens.add({ targets: win, scale: 1, alpha: 1, duration: 300, ease: "Cubic.out" });
      this.later(1500, () => {
        this.sc.tweens.add({ targets: page, alpha: 1, duration: 200 });
        synth.play("tap");
        this.sc.cameras.main.shake(140, 0.003);
      });
    } else if (g.type === "results") {
      const cols = 15;
      const rows = Math.ceil(g.seats / cols);
      const cell = 22;
      const x0 = this.cx() - (cols * cell) / 2;
      const y0 = top + 46;
      const cells: Phaser.GameObjects.Rectangle[] = [];
      for (let i = 0; i < g.seats; i++) cells.push(this.add(this.sc.add.rectangle(x0 + (i % cols) * cell, y0 + Math.floor(i / cols) * cell, cell - 3, cell - 3, g.from[1]).setOrigin(0)));
      void rows;
      let a = g.seats;
      let b = 0;
      const ta = this.add(this.sc.add.text(SX + 40, top + 4, "", { fontFamily: FONT, fontSize: "20px", color: "#f87171", fontStyle: "bold" }));
      const tb = this.add(this.sc.add.text(SX + SW - 40, top + 4, "", { fontFamily: FONT, fontSize: "20px", color: "#93c5fd", fontStyle: "bold" }).setOrigin(1, 0));
      const draw = () => {
        ta.setText(`${g.from[0]} ${a}`);
        tb.setText(`${g.to[0]} ${b}`);
      };
      draw();
      const order = cells.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, g.flips);
      order.forEach((ci, j) =>
        this.later(700 + j * 42, () => {
          const c = cells[ci];
          if (!c.active) return;
          c.setFillStyle(g.to[1]);
          this.sc.tweens.add({ targets: c, scale: { from: 1.5, to: 1 }, duration: 200 });
          a--;
          b++;
          draw();
          if (j % 6 === 0) synth.play("tap");
        }),
      );
      this.later(800 + g.flips * 42, () => {
        const gain = this.add(this.sc.add.text(this.cx(), y0 + rows * cell + 26, `${g.to[0]} GAIN`, { fontFamily: FONT, fontSize: "30px", color: "#ffffff", backgroundColor: "#2563eb", padding: { x: 10, y: 4 }, fontStyle: "bold" }).setOrigin(0.5));
        this.sc.tweens.add({ targets: gain, alpha: 0.4, duration: 300, yoyo: true, repeat: -1 });
      });
    }
  }

  /** A section bumper ("PART THREE: ..."): the special's band sweeps across with the part's title. */
  private partCard(t: string): number {
    const { SX, SY, SW, SH } = this.r;
    const brand = BRANDS[this.cfg.brand];
    const i = t.indexOf(":");
    const head = i > 0 ? t.slice(0, i).trim() : "";
    const rest = i > 0 ? t.slice(i + 1).trim() : t;
    const c = this.add(this.sc.add.container(-SW - 80, 0), this.fxLayer);
    const bg = this.sc.add.graphics();
    bg.fillGradientStyle(brand.accent, brand.accent, 0x020617, 0x020617, 0.97).fillRect(SX, SY, SW, SH);
    bg.fillStyle(brand.main, 1).fillRect(SX, SY + SH * 0.36, SW, 6).fillRect(SX, SY + SH * 0.66, SW, 6);
    c.add(bg);
    c.add(this.sc.add.text(SX + 30, SY + SH * 0.36 + 16, head ? `GB KREWS · ${head}` : "GB KREWS · SPECIAL", { fontFamily: FONT, fontSize: "15px", color: "#fde68a", fontStyle: "bold" }));
    c.add(this.sc.add.text(SX + 30, SY + SH * 0.36 + 42, rest.toUpperCase(), { fontFamily: FONT, fontSize: "26px", color: "#ffffff", fontStyle: "bold", wordWrap: { width: SW - 60 } }));
    const gl = this.chrome.globe(SX + SW - 70, SY + SH * 0.2, 46, 0xffffff, c, 0.6);
    void gl;
    this.sc.tweens.add({ targets: c, x: 0, duration: 380, ease: "Cubic.out" });
    this.later(2200, () => c.active && this.sc.tweens.add({ targets: c, x: SW + 80, duration: 320, ease: "Cubic.in", onComplete: () => c.destroy() }), false);
    synth.play("tv_sting");
    this.chrome.headline(rest);
    return 2600;
  }

  /** The breakfast sofa laughs: back to the two-shot, both of them going. */
  private sofaLaugh() {
    this.fieldWide();
    for (const p of this.cast) p.say("ha ha ha ha ha ha ha ha ha ha ha ha ha", { poses: p.hasPose("laugh") ? ["laugh"] : ["rest"] });
  }

  // ------------------------------------------------------------------ news stories 4 (krews4.ts)
  // The concert and the mob, the reality-TV / viral-video looks, and the moments the Krelmon stories need (a brick, a
  // bag of money, crocodiles, a boulder, a jenkem pot). See tvnews/krews4Shows.ts.

  /** the presser the bag of money was left in */
  private k4bag?: SceneDef;
  private k4rolled = false;
  private k4boulder?: Phaser.GameObjects.Image;
  private k4heads?: Phaser.GameObjects.Container;

  private k4Shot(): number {
    if (this.scene.kind === "concert") {
      this.concertShot();
      return 900;
    }
    this.mobWide();
    if (this.scene.where) this.chrome.live(this.scene.where);
    return 900;
  }

  private k4Speak(name: string, text: string): number {
    this.chrome.clearStrap();
    if (this.scene.kind !== "mob") return 0;
    if (name === "NEWSREADER") {
      if (this.storyShotKind !== "wide") this.mobWide();
      return 0;
    }
    if (this.hotCaption && !name.startsWith("CROWD")) {
      // the voice on the hot mic, picture-in-picture over the crowd that can hear it
      if (this.storyShotKind !== "wide") this.mobWide();
      this.mobPip(name)?.say(text);
      this.transcript(text);
      return 0;
    }
    const p = (this.storyShotKind === "single" && this.find(name)) || this.voxShot(name);
    p?.say(text);
    this.strapFor(name);
    return 0;
  }

  /** The background image of the current shot, and a point on it (fractions of the art). */
  private k4bgPoint(u: number, v: number) {
    const bg = this.stage.list.find((o) => o instanceof Phaser.GameObjects.Image && o.texture.key === this.scene.set) as Phaser.GameObjects.Image | undefined;
    if (!bg) return { x: this.r.SX + this.r.SW * u, y: this.r.SY + this.r.SH * v, bg };
    return { x: bg.x + (u - 0.5) * bg.displayWidth, y: bg.y + (v - 0.5) * bg.displayHeight, bg };
  }

  private k4tag(text: string, bg: string, color = "#111827") {
    const { SX, SY } = this.r;
    return this.add(this.sc.add.text(SX + 16, SY + 46, text, { fontFamily: FONT, fontSize: "14px", color, backgroundColor: bg, padding: { x: 6, y: 3 }, fontStyle: "bold" }), this.fxLayer);
  }

  private handheld(ms = 100, amt = 4) {
    this.every(ms, () => this.stage.setPosition(this.stage.x * 0.6 + (Math.random() - 0.5) * amt, this.stage.y * 0.6 + (Math.random() - 0.5) * amt));
  }

  /** A phone held up at a gig or on a trail: REC and a running clock, grain, a shaky hand (and the app's buttons). */
  private phoneUI(label: string, social: boolean) {
    const { SX, SY, SW, SH } = this.r;
    this.grain(70);
    const rec = this.add(this.sc.add.circle(SX + SW - 92, SY + 58, 7, 0xff2020), this.fxLayer);
    this.sc.tweens.add({ targets: rec, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
    const ts = this.add(this.sc.add.text(SX + SW - 80, SY + 49, "", { fontFamily: "monospace", fontSize: "16px", color: "#ffffff" }), this.fxLayer);
    let sec = 11;
    const draw = () => ts.active && ts.setText(`0:${String(sec).padStart(2, "0")}`);
    draw();
    this.every(1000, () => {
      sec = (sec + 1) % 60;
      draw();
    });
    this.k4tag(label, "#facc15");
    if (social) {
      const icons = ["♥ 48.2K", "✎ 3,104", "↗ 9.1K"];
      icons.forEach((t, i) =>
        this.add(this.sc.add.text(SX + SW - 22, SY + SH * 0.36 + i * 40, t, { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold", stroke: "#000000", strokeThickness: 3 }).setOrigin(1, 0), this.fxLayer),
      );
      this.add(this.sc.add.text(SX + 16, SY + SH * 0.66, "@woah_prankz  ·  wait for it 💀", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold", stroke: "#000000", strokeThickness: 3 }), this.fxLayer);
    }
    this.handheld(90, 5);
  }

  /** Heads and shoulders along the bottom of the picture, bobbing (arms up for a party). */
  private k4crowdHeads(bottom: number, color: number, arms: boolean) {
    const { SX, SW } = this.r;
    const c = (this.k4heads = this.add(this.sc.add.container(0, 0)));
    for (let i = 0; i < 13; i++) {
      const x = SX + 6 + i * (SW / 12) + ((i * 13) % 11);
      const y = bottom - 30 + (i % 2) * 10;
      const h = this.sc.add.container(x, y);
      const g = this.sc.add.graphics();
      g.fillStyle(color, 1).fillCircle(0, 0, 18).fillEllipse(0, 44, 66, 52);
      if (arms && i % 3 !== 1) g.fillRect(-27, -50, 7, 52).fillRect(20, -54, 7, 56);
      h.add(g);
      c.add(h);
      this.sc.tweens.add({ targets: h, y: y - 6 - (i % 3) * 3, duration: 240 + (i % 4) * 60, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: i * 50 });
    }
    return c;
  }

  // ---- the gig

  private concertShot() {
    this.clearShot();
    this.storyShotKind = "wide";
    const { SX, SY, SW, SH } = this.r;
    const bg = this.backdrop(this.scene.set, 1.12, 0, 10);
    this.sc.tweens.add({ targets: bg, x: bg.x - 24, duration: 8000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let i = 0; i < 4; i++) {
      const b = this.add(this.sc.add.triangle(SX + SW * (0.2 + i * 0.2), SY, 0, 0, -40, SH * 0.7, 40, SH * 0.7, [0x4ade80, 0xfacc15, 0x4ade80, 0xa3e635][i], 0.09).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD));
      b.setAngle(-24 + i * 14);
      this.sc.tweens.add({ targets: b, angle: b.angle + 30, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    // SanMik on the stage, doing the crocodile
    if (this.sc.textures.exists("croc_SANMIK")) {
      const s = this.add(this.sc.add.sprite(this.cx(), SY + SH * 0.67, "croc_SANMIK", 0).setOrigin(0.5, 1).setScale(2.6));
      let f = 0;
      this.every(150, () => s.active && s.setFrame((f = (f + 1) % 17)));
    }
    this.k4crowdHeads(SY + SH + 6, 0x05070d, true);
    this.phoneUI("FAN FOOTAGE · SANMIK LIVE", false);
  }

  private crocsRelease(): number {
    const { SX, SY, SW, SH } = this.r;
    if (this.storyShotKind !== "wide") this.concertShot();
    if (this.sc.textures.exists("tv_k4_croc"))
      for (let i = 0; i < 4; i++)
        this.later(i * 320, () => {
          const tx = SX + SW * (0.1 + i * 0.27);
          const c = this.add(this.sc.add.image(this.cx() + (i - 1.5) * 40, SY + SH * 0.64, "tv_k4_croc").setScale(1.1).setFlipX(i < 2));
          // off the stage and into the crowd, then thrashing about in it
          this.sc.tweens.add({
            targets: c,
            x: tx,
            y: SY + SH * (0.58 + (i % 2) * 0.05),
            scale: 2.6,
            duration: 1500,
            ease: "Quad.in",
            onComplete: () => c.active && this.sc.tweens.add({ targets: c, x: c.x + (i < 2 ? -1 : 1) * 60, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: "Sine.easeInOut", onYoyo: () => c.setFlipX(!c.flipX), onRepeat: () => c.setFlipX(!c.flipX) }),
          });
          this.sc.tweens.add({ targets: c, angle: { from: -5, to: 5 }, duration: 130, yoyo: true, repeat: -1 });
          synth.play("roar");
        });
    if (this.k4heads) for (const h of this.k4heads.list as Phaser.GameObjects.Container[]) this.sc.tweens.add({ targets: h, x: h.x + (h.x < this.cx() ? -1 : 1) * (40 + Math.random() * 80), duration: 900, delay: 600, ease: "Quad.out" });
    this.later(700, () => this.sc.cameras.main.shake(1200, 0.007));
    synth.play("scream_woman");
    return 2600;
  }

  // ---- the street crowd

  private mobWide(angry = false) {
    this.clearShot();
    this.storyShotKind = "wide";
    const { SX, SY, SW, SH } = this.r;
    const bg = this.backdrop(this.scene.set, 1.1, 0, -10);
    this.sc.tweens.add({ targets: bg, x: bg.x - 30, duration: 9000, ease: "Sine.easeInOut" });
    const words = angry ? ["GET HIM!", "STORM IT!", "GET HIM!", "OUT!", "GET HIM!", "NO. 10!"] : this.scene.placards ?? ["YES!"];
    for (let i = 0; i < 7; i++) {
      const x = SX + 40 + (i * (SW - 80)) / 6 + ((i * 29) % 17) - 8;
      const y = SY + SH - 96 - (i % 2) * 24;
      const c = this.add(this.sc.add.container(x, y));
      c.add(this.sc.add.rectangle(0, 22, 4, 46, 0x6b4423));
      const light = (i % 3 === 1) !== angry;
      c.add(this.sc.add.rectangle(0, -8, 86, 34, angry ? 0xb91c1c : light ? 0xffffff : 0x16a34a).setStrokeStyle(2, 0x111111));
      c.add(this.sc.add.text(0, -8, words[i % words.length], { fontFamily: FONT, fontSize: "13px", color: angry || !light ? "#ffffff" : "#15803d", fontStyle: "bold" }).setOrigin(0.5));
      c.setAngle(((i % 3) - 1) * 6);
      this.sc.tweens.add({ targets: c, y: y - (angry ? 16 : 9), angle: c.angle + ((i % 2) * 2 - 1) * (angry ? 9 : 5), duration: (angry ? 180 : 320) + i * 37, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: i * 60 });
    }
    const heads = this.k4crowdHeads(SY + SH + 4, 0x0b0b12, !angry);
    if (angry) {
      const red = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xdc2626, 0.1).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
      this.sc.tweens.add({ targets: red, fillAlpha: 0.22, duration: 300, yoyo: true, repeat: -1 });
      // the surge towards the gates
      this.sc.tweens.add({ targets: heads, y: -26, duration: 1800, ease: "Quad.in" });
      this.camTo(1.12, this.cx(), SY + SH * 0.4, 2600, "Quad.in");
      this.handheld(70, 8);
    } else {
      this.confetti();
      this.handheld(120, 3);
    }
    if (this.hotCaption) this.mobHotMic();
  }

  /** "# HOT MIC" over the crowd: the tag, the levels and the transcript, as on the hot-mic footage. */
  private mobHotMic() {
    const { SX, SY, SW } = this.r;
    const tag = this.add(this.sc.add.text(SX + 16, SY + 46, "● HOT MIC · HEARD IN WHITEHALL", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", backgroundColor: "#dc2626", padding: { x: 6, y: 3 }, fontStyle: "bold" }), this.fxLayer);
    this.sc.tweens.add({ targets: tag, alpha: 0.5, duration: 450, yoyo: true, repeat: -1 });
    this.transcriptText = this.add(
      this.sc.add.text(SX + 16, SY + 80, this.lastTranscript, { fontFamily: "monospace", fontSize: "15px", color: "#fde047", backgroundColor: "#000000c0", padding: { x: 8, y: 6 }, wordWrap: { width: SW - 260 } }),
      this.fxLayer,
    );
    this.transcriptText.setVisible(!!this.lastTranscript);
  }

  private mobPip(name: string) {
    const ex = this.find(name);
    if (ex) return ex;
    const anchor = this.scene.anchors?.[name];
    if (!hasAnchor(this.sc, anchor ?? name)) return null;
    const { SX, SY, SW } = this.r;
    const w = 196;
    const h = 150;
    const x = SX + SW - w - 18;
    const y = SY + 70;
    this.add(this.sc.add.rectangle(x - 4, y - 4, w + 8, h + 8, 0xffffff).setOrigin(0), this.fxLayer);
    const pane = this.add(this.sc.add.container(0, 0), this.fxLayer);
    pane.setMask(this.sc.make.graphics({}).fillRect(x, y, w, h).createGeometryMask());
    pane.add(this.sc.add.rectangle(x, y, w, h, 0x2a0a0a).setOrigin(0));
    if (this.sc.textures.exists("tv_k4_office")) pane.add(this.sc.add.image(x + w / 2, y + h / 2, "tv_k4_office").setScale(Math.max(w / 320, h / 240) * 1.25));
    const p = new Presenter(this.sc, name, x + w / 2, y + h + 8, 1.4, pane, anchor);
    this.cast.push(p);
    this.add(this.sc.add.text(x + 6, y + h - 22, "NO. 10 · LIVE AUDIO", { fontFamily: FONT, fontSize: "11px", color: "#ffffff", backgroundColor: "#dc2626", padding: { x: 4, y: 2 }, fontStyle: "bold" }), this.fxLayer);
    return p;
  }

  // ---- the looks on a location

  private k4Look() {
    const { SX, SY, SW, SH } = this.r;
    const l = this.scene.k4look;
    if (l === "reality" || l === "high") {
      this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffb347, 0.06).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
      this.k4tag(l === "high" ? "KITCHEN NIGHTMARES · LATER" : "KITCHEN NIGHTMARES · CLIP", "#facc15");
      this.handheld(100, 4);
      if (l === "high") {
        const h = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xff00ff, 0.12).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
        let k = 0;
        this.every(170, () => h.active && h.setFillStyle([0xff00ff, 0x00ffff, 0xffff00, 0x00ff66][k++ % 4], 0.12));
        this.sc.tweens.add({ targets: this.stage, angle: { from: -1.6, to: 1.6 }, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      return;
    }
    if (l === "phone") {
      if (!this.k4rolled && this.sc.textures.exists("tv_k4_boulder")) {
        const at = this.k4bgPoint(263 / 320, 35 / 240);
        const b = (this.k4boulder = this.add(this.sc.add.image(at.x, at.y, "tv_k4_boulder").setScale(at.bg ? at.bg.scaleX : 2)));
        // it sits on the art, which drifts
        this.every(30, () => {
          if (this.k4rolled || !b.active) return;
          const q = this.k4bgPoint(263 / 320, 35 / 240);
          b.setPosition(q.x, q.y);
        });
      }
      this.phoneUI("VIRAL VIDEO", true);
    }
  }

  /** A line said over a location with a k4look: the prankster's shout, big. */
  private k4Line(name: string, text: string) {
    if (this.scene.k4look !== "phone" || name !== "PRANKSTER") return;
    const t = this.add(this.sc.add.text(this.cx(), this.r.SY + this.r.SH * 0.3, text, { fontFamily: FONT, fontSize: "44px", color: "#ffffff", fontStyle: "bold", stroke: "#000000", strokeThickness: 7 }).setOrigin(0.5), this.fxLayer);
    t.setScale(0.2);
    this.sc.tweens.add({ targets: t, scale: 1.1, duration: 260, ease: "Back.out" });
    this.later(1800, () => t.active && this.sc.tweens.add({ targets: t, alpha: 0, duration: 300 }));
  }

  // ---- the moments

  private k4Direction(a: string): number {
    const k = this.scene.kind;
    if (k === "presser") {
      if (/hurls a brick/i.test(a)) return this.brickThrow();
      if (/bag of cash/i.test(a)) return this.leaveBag();
      if (/long pause/i.test(a) && this.k4bag === this.scene) {
        // the empty lectern and the bag
        const p = this.pressWide(this.mainSpeaker);
        p?.spr.setVisible(false);
        this.drawBag(this.cx() + 40, this.r.SY + this.r.SH * 0.63, 2.2);
        return 1800;
      }
      if (/murmur/i.test(a)) {
        this.pressWide(this.mainSpeaker);
        return 1600;
      }
      return -1;
    }
    if (k === "concert") return /crocodiles/i.test(a) ? this.crocsRelease() : 600;
    if (k === "mob") {
      if (!/storm/i.test(a)) return -1;
      this.mobWide(true);
      synth.play("crowd_boo");
      this.sc.cameras.main.shake(900, 0.008);
      return 2600;
    }
    if (k !== "field") return -1;
    const l = this.scene.k4look;
    if (l === "phone") return /boulder/i.test(a) ? this.rollBoulder() : -1;
    if (l === "reality" || l === "high") return this.kitchenDirection(a);
    if (this.scene.singles || this.scene.set === "tv_k4_office") {
      if (/fear|closes in/i.test(a)) return this.officeFear();
      if (this.storyShotKind !== "wide") this.fieldWide();
      return 1600;
    }
    return -1;
  }

  private k4Boom(): number {
    const { SX, SY, SW, SH } = this.r;
    const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xff9a3c, calm() ? 0.15 : 0.5).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
    this.sc.tweens.add({ targets: f, alpha: 0, duration: 600, onComplete: () => f.destroy() });
    for (let i = 0; i < 6; i++) {
      const s = this.add(this.sc.add.circle(SX + SW * (0.3 + Math.random() * 0.5), SY + SH * 0.45, 30 + i * 6, 0x374151, 0.5), this.fxLayer);
      this.sc.tweens.add({ targets: s, y: s.y - 140, scale: 2.4, alpha: 0, duration: 2200 + i * 200, onComplete: () => s.destroy() });
    }
    this.sc.cameras.main.shake(500, 0.01);
    return 500;
  }

  /** The Prime Minister throws a brick at the camera. */
  private brickThrow(): number {
    const { SX, SY, SW, SH } = this.r;
    const main = this.mainSpeaker;
    const p = this.find(main) ?? this.mcu(main);
    p?.stopTalking();
    // the PixelLab clip: he picks a brick up off the lectern, winds up and lets it go at us
    const clip = p ? this.clipOverPresenter(p, "starmer_brick", { fps: 9, frames: [0, 1, 2, 3, 4, 5, 6, 7], onFrame: (i) => i === 7 && launch() }) : null;
    if (!clip) p?.setPose("point");
    let launched = false;
    const launch = () => {
      if (launched) return;
      launched = true;
      if (clip && p) {
        // (not destroyed from inside its own animation callback: Phaser is still stepping it)
        clip.setVisible(false);
        this.sc.time.delayedCall(0, () => clip.destroy());
        p.spr.setVisible(true);
        p.setPose("point", false);
      }
      this.brickFlight(p, from());
    };
    const from = () => (p ? { x: p.spr.x + p.spr.displayWidth * (clip ? 0.25 : -0.2), y: p.spr.y - p.spr.displayHeight * (clip ? 0.95 : 0.6) } : { x: this.cx(), y: SY + SH * 0.5 });
    if (!clip) launch();
    void SW;
    return clip ? 3500 : 2600;
  }

  /** Something on the end of a clip (an action clip, see tv/action.ts) in place of a presenter: hidden for its length. */
  private clipOverPresenter(p: Presenter, name: string, o: ClipOpts & { keep?: boolean; ox?: number } = {}) {
    const key = `tva_${name}`;
    if (!this.sc.textures.exists(key)) return null;
    const ox = o.ox ?? 0.5;
    const s = this.sc.add.sprite(p.spr.x, p.spr.y, key, 0).setOrigin(p.spr.flipX ? 1 - ox : ox, 1).setScale(p.spr.scaleX).setFlipX(p.spr.flipX);
    s.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const c = p.spr.parentContainer;
    if (c) c.addAt(s, c.getIndex(p.spr) + 1);
    else this.add(s);
    p.spr.setVisible(false);
    playClip(this.sc, s, name, {
      ...o,
      done: () => {
        o.done?.();
        if (o.keep || !s.active) return;
        s.destroy();
        if (p.spr.active) p.spr.setVisible(true);
      },
    });
    return s;
  }

  private brickFlight(p: Presenter | null, from: { x: number; y: number }) {
    const { SX, SY, SW, SH } = this.r;
    const b = this.add(this.sc.add.container(from.x, from.y), this.fxLayer);
    if (this.sc.textures.exists("tva_prop_brick")) b.add(this.sc.add.image(0, 0, "tva_prop_brick").setScale(0.8));
    else {
      b.add(this.sc.add.rectangle(0, 0, 22, 12, 0xb45309).setStrokeStyle(2, 0x451a03));
      b.add(this.sc.add.rectangle(-4, 0, 1, 12, 0x78350f));
      b.add(this.sc.add.rectangle(0, -2, 22, 1, 0x78350f));
    }
    synth.play("swing");
    this.sc.tweens.add({
      targets: b,
      x: this.cx() + 30,
      y: SY + SH * 0.45,
      scale: 9,
      angle: 540,
      duration: 650,
      ease: "Quad.in",
      onComplete: () => {
        b.destroy();
        const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, calm() ? 0.3 : 0.85).setOrigin(0), this.fxLayer);
        this.sc.tweens.add({ targets: f, alpha: 0, duration: 300, onComplete: () => f.destroy() });
        const g = this.add(this.sc.add.graphics(), this.fxLayer);
        const cx = this.cx() + 30;
        const cy = SY + SH * 0.45;
        g.lineStyle(2, 0xffffff, 0.85);
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * Math.PI * 2 + Math.random() * 0.3;
          let x = cx;
          let y = cy;
          g.beginPath().moveTo(x, y);
          for (let j = 0; j < 4; j++) {
            x += Math.cos(a + (Math.random() - 0.5) * 0.6) * (30 + Math.random() * 40);
            y += Math.sin(a + (Math.random() - 0.5) * 0.6) * (30 + Math.random() * 40);
            g.lineTo(x, y);
          }
          g.strokePath();
        }
        this.sc.cameras.main.shake(400, 0.012);
        this.flashStorm(6);
        // and in he storms
        if (p) this.later(700, () => this.sc.tweens.add({ targets: p.spr, x: p.spr.x - SW, duration: 1000, ease: "Quad.in" }));
      },
    });
  }

  private drawBag(x: number, y: number, s: number) {
    if (!this.sc.textures.exists("tv_k4_cashbag")) {
      const g = this.sc.make.graphics({}, false);
      g.fillStyle(0x8b6b3d, 1).fillEllipse(20, 30, 38, 30).fillTriangle(10, 14, 30, 14, 20, 24);
      g.fillStyle(0x5c4421, 1).fillRect(12, 12, 16, 4);
      g.lineStyle(2, 0x3b2a12, 1).strokeEllipse(20, 30, 38, 30);
      g.fillStyle(0x22c55e, 1).fillRect(26, 6, 10, 6).fillRect(6, 8, 9, 5);
      g.generateTexture("tv_k4_cashbag", 40, 46);
      g.destroy();
    }
    const b = this.add(this.sc.add.image(x, y, "tv_k4_cashbag").setOrigin(0.5, 1).setScale(s));
    this.add(this.sc.add.text(x, y - 15 * s, "£", { fontFamily: FONT, fontSize: `${Math.round(12 * s)}px`, color: "#fde047", fontStyle: "bold" }).setOrigin(0.5));
    return b;
  }

  /** He leaves the podium; the bag of money stays on it. */
  private leaveBag(): number {
    const p = this.pressWide(this.mainSpeaker);
    const { SY, SH, SW } = this.r;
    this.drawBag(this.cx() + 40, SY + SH * 0.63, 2.2);
    if (p) this.later(500, () => this.sc.tweens.add({ targets: p.spr, x: p.spr.x + SW, duration: 1400, ease: "Quad.in" }));
    this.k4bag = this.scene;
    return 2600;
  }

  /** The kitchen: the lid comes off, the fumes, Mick against the wall, the giggling, the table going over. */
  private kitchenDirection(a: string): number {
    const { SX, SY, SW, SH } = this.r;
    if (/lifts the lid|deep breath|dips his finger/i.test(a)) {
      if (this.storyShotKind !== "wide") this.fieldWide();
      if (/lid/i.test(a)) this.find("GORDON RAMSAY")?.setPose("retch");
      for (let i = 0; i < 26; i++)
        this.later(i * 90, () => {
          const c = this.add(this.sc.add.circle(SX + SW * (0.55 + Math.random() * 0.3), SY + SH * 0.85, 10 + Math.random() * 10, [0x84cc16, 0xa3e635, 0x65a30d][i % 3], 0.4), this.fxLayer);
          this.sc.tweens.add({ targets: c, y: c.y - 200 - Math.random() * 100, x: c.x - 60 + Math.random() * 60, scale: 3, alpha: 0, duration: 2200, onComplete: () => c.destroy() });
        });
      if (/lid/i.test(a)) synth.play("groan");
      return 2000;
    }
    if (/pins him/i.test(a)) {
      this.fieldWide();
      const g = this.find("GORDON RAMSAY");
      const m = this.find("CHEF MICK");
      if (g && m && this.sc.textures.exists("tva_gordon_grab")) {
        // the PixelLab clips: Gordon lunges and grabs, Mick slammed into the wall
        const dir = m.spr.x > g.spr.x ? 1 : -1;
        g.stopTalking();
        m.stopTalking();
        const gc = this.clipOverPresenter(g, "gordon_grab", { fps: 11, ox: 64 / 192, frames: [0, 1, 2, 3, 4, 5, 6, 6, 6, 6, 5] });
        if (gc && dir < 0) gc.setFlipX(!gc.flipX).setOrigin(1 - gc.originX, 1);
        if (gc) this.sc.tweens.add({ targets: gc, x: gc.x + dir * 70, duration: 380, delay: 200, ease: "Quad.out" });
        this.later(470, () => {
          synth.play("punch");
          impact(this.sc, (o) => this.add(o, this.fxLayer), "pow", m.spr.x - dir * m.spr.displayWidth * 0.2, m.spr.y - m.spr.displayHeight * 0.45, 2, 0.014);
          this.clipOverPresenter(m, "mick_pinned", { fps: 10, frames: [0, 1, 2, 3, 4, 5, 6, 5, 6, 5, 6] });
        });
        return 1900;
      }
      g?.setPose("point");
      if (g) this.sc.tweens.add({ targets: g.spr, x: g.spr.x + 90, duration: 220, ease: "Quad.out" });
      this.later(200, () => this.sc.cameras.main.shake(300, 0.01));
      synth.play("punch");
      return 1300;
    }
    if (/giggling/i.test(a)) {
      if (this.storyShotKind !== "wide") this.fieldWide();
      for (const p of this.cast) p.say("ha ha hee hee ha ha ha hee hee ha ha ha ha hee", { poses: ["rest"] });
      synth.play("laugh");
      return 3400;
    }
    if (/overturns/i.test(a)) {
      if (this.storyShotKind !== "wide") this.fieldWide();
      const c = this.find("CUSTOMER 2");
      const g = this.find("GORDON RAMSAY");
      if (g && this.sc.textures.exists("tva_gordon_flip")) {
        // the PixelLab clip: he gets his hands under it and heaves; the table goes over, the plates go everywhere
        g.stopTalking();
        const put = <T extends Phaser.GameObjects.GameObject>(o: T) => this.add(o, this.fxLayer);
        const tx = c ? (g.spr.x + c.spr.x) / 2 : g.spr.x + 140;
        const ty = SY + SH * 0.92;
        const table = this.sc.textures.exists("tva_prop_table") ? put(this.sc.add.image(tx, ty, "tva_prop_table").setOrigin(0.5, 1).setScale(3)) : null;
        const plates = [-1, 1].map((k) => (this.sc.textures.exists("tva_prop_plate") ? put(this.sc.add.image(tx + k * 34, ty - 168, "tva_prop_plate").setScale(1.6)) : null));
        this.clipOverPresenter(g, "gordon_flip", { fps: 10, frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 8] });
        this.later(560, () => {
          synth.play("swing");
          if (table) this.sc.tweens.add({ targets: table, y: ty - 120, x: tx + 90, angle: 200, duration: 520, ease: "Quad.out", onComplete: () => this.sc.tweens.add({ targets: table, y: ty + 80, angle: 260, duration: 300, ease: "Quad.in" }) });
          plates.forEach((pl, i) => {
            pl?.destroy();
            const to = { x: tx + (i ? 200 : -120), y: SY + SH * (0.75 + i * 0.1) };
            fling(this.sc, put, "plate", { x: tx + (i ? 34 : -34), y: ty - 168 }, to, { ms: 420 + i * 120, spin: i ? 540 : -480, from: 1.6, to: 2.2, arc: 120, done: () => impact(this.sc, put, "shatter", to.x, to.y, 1.4, 0.01) });
          });
          if (c) this.sc.tweens.add({ targets: c.spr, y: c.spr.y + 70, angle: 24, duration: 400, delay: 200, ease: "Quad.in" });
          const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, calm() ? 0.15 : 0.45).setOrigin(0), this.fxLayer);
          this.sc.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
          this.sc.cameras.main.shake(600, calm() ? 0.005 : 0.012);
        });
        return 2000;
      }
      if (c) this.sc.tweens.add({ targets: c.spr, y: c.spr.y + 70, angle: 24, duration: 400, ease: "Quad.in" });
      const f = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, calm() ? 0.2 : 0.6).setOrigin(0), this.fxLayer);
      this.sc.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
      this.sc.cameras.main.shake(600, 0.012);
      return 1400;
    }
    if (this.storyShotKind !== "wide") this.fieldWide();
    return 1300;
  }

  /** The prank: the boulder comes loose and rolls down the slope at the camera. */
  private rollBoulder(): number {
    const b = this.k4boulder;
    if (!b?.active || this.k4rolled) return 1200;
    this.k4rolled = true;
    const { SX, SY, SH } = this.r;
    this.sc.tweens.add({ targets: b, x: SX - 140, y: SY + SH + 160, angle: -900, scale: b.scale * 3.2, duration: 2600, ease: "Quad.in" });
    const dust = this.every(70, () => {
      if (!b.active) return;
      const d = this.add(this.sc.add.circle(b.x + (Math.random() - 0.5) * 30, b.y + b.displayHeight * 0.4, 8 + Math.random() * 10, 0xc2a27a, 0.6));
      this.sc.tweens.add({ targets: d, scale: 3, alpha: 0, y: d.y - 20, duration: 900, onComplete: () => d.destroy() });
    });
    this.later(2700, () => dust.remove());
    this.later(500, () => this.sc.cameras.main.shake(2000, 0.007));
    return 1600;
  }

  /** The mob closes in on the throne: the lights go red, the glass goes, his face falls. */
  private officeFear(): number {
    if (this.storyShotKind !== "wide") this.fieldWide();
    const { SX, SY, SW, SH } = this.r;
    const p = this.find("KEIR STARMER");
    if (p) {
      p.stopTalking();
      p.baseMouth = 2;
      p.spr.setFrame(2);
      this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 4, duration: 50, yoyo: true, repeat: -1 });
    }
    const red = this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0xdc2626, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD), this.fxLayer);
    this.sc.tweens.add({ targets: red, fillAlpha: 0.28, duration: 260, yoyo: true, repeat: -1 });
    this.later(900, () => {
      for (let i = 0; i < 18; i++) {
        const s = this.add(this.sc.add.triangle(SX + SW * (0.3 + Math.random() * 0.4), SY + SH * 0.3, 0, 0, 10, 4, 4, 14, 0xe0f2fe, 0.85), this.fxLayer);
        this.sc.tweens.add({ targets: s, x: s.x + (Math.random() - 0.5) * 300, y: SY + SH + 20, angle: 360, duration: 900 + Math.random() * 600, onComplete: () => s.destroy() });
      }
      this.sc.cameras.main.shake(700, 0.012);
      // bricks through the windows (the props and the shatter from tv/action.ts)
      const put = <T extends Phaser.GameObjects.GameObject>(o: T) => this.add(o, this.fxLayer);
      for (let i = 0; i < 3; i++) {
        const to = { x: SX + SW * (0.18 + i * 0.32), y: SY + SH * (0.22 + (i % 2) * 0.08) };
        this.later(i * 260, () => fling(this.sc, put, "brick", { x: to.x + (i - 1) * 60, y: SY + SH + 30 }, to, { ms: 360, spin: 600, from: 2.4, to: 1.4, arc: 30, done: () => impact(this.sc, put, "shatter", to.x, to.y, 1.6, 0.008) }));
      }
    });
    // and here they come
    const heads = this.k4crowdHeads(SY + SH + 120, 0x050505, true);
    this.sc.tweens.add({ targets: heads, y: -110, duration: 2600, ease: "Quad.out", delay: 600 });
    this.camTo(1.15, p ? p.spr.x : this.cx(), SY + SH * 0.35, 2800);
    synth.play("crowd_boo");
    return 3000;
  }

  /** A full-screen graphic the story's own: the photograph GB Krews won't show. */
  private k4Graphic(g: K4Gfx) {
    const { SX, SY, SW, SH } = this.r;
    const brand = BRANDS[this.cfg.brand];
    const title = this.add(this.sc.add.text(SX + 28, SY + 44, g.title, { fontFamily: FONT, fontSize: "20px", color: "#ffffff", fontStyle: "bold", wordWrap: { width: SW - 60 } }));
    this.add(this.sc.add.rectangle(SX + 28, SY + 72, Math.min(SW - 56, title.width + 30), 4, brand.main).setOrigin(0));
    const card = this.add(this.sc.add.container(this.cx(), SY + SH * 0.52));
    const pw = 300;
    const ph = 210;
    card.add(this.sc.add.rectangle(0, 0, pw + 20, ph + 44, 0xf8fafc).setStrokeStyle(2, 0x9ca3af));
    // the picture, pixelated past recognition
    const mos = this.sc.add.graphics();
    const cols = 15;
    const rows = 10;
    const cw = pw / cols;
    const chh = ph / rows;
    const pal = [0x1f2937, 0x374151, 0x4b5563, 0x7f1d1d, 0x92400e, 0x111827, 0x6b7280];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) mos.fillStyle(pal[(x * 7 + y * 13 + ((x * y) % 5)) % pal.length], 1).fillRect(-pw / 2 + x * cw, -ph / 2 - 12 + y * chh, cw + 0.5, chh + 0.5);
    card.add(mos);
    card.add(this.sc.add.rectangle(0, -12, pw, 44, 0x000000));
    card.add(this.sc.add.text(0, -12, g.caption, { fontFamily: FONT, fontSize: "17px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
    card.add(this.sc.add.text(0, ph / 2 + 8, "Downing Street · Halloween", { fontFamily: FONT, fontSize: "13px", color: "#374151", fontStyle: "italic" }).setOrigin(0.5));
    card.setAngle(-3).setScale(0.85).setAlpha(0);
    this.sc.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 350, ease: "Back.out" });
    this.later(1300, () => {
      const st = this.add(this.sc.add.text(this.cx() + 100, SY + SH * 0.33, "WITHHELD", { fontFamily: FONT, fontSize: "30px", color: "#ef4444", fontStyle: "bold", stroke: "#ffffff", strokeThickness: 5 }).setOrigin(0.5).setAngle(12), this.fxLayer);
      st.setScale(2.4).setAlpha(0);
      this.sc.tweens.add({ targets: st, scale: 1, alpha: 1, duration: 220, ease: "Back.out" });
      synth.play("hit");
    });
  }

  /** A slide with a picture on it (Tate's kart), driving about the screen. */
  private slideImg(c: Phaser.GameObjects.Container, key: string, w: number, h: number) {
    if (!this.sc.textures.exists(key)) return;
    const src = this.sc.textures.get(key).getSourceImage();
    const s = (h * 0.6) / src.height;
    const img = this.sc.add.image(w / 2, h * 0.55, key).setScale(s);
    c.add(img);
    this.sc.tweens.add({ targets: img, x: { from: w * 0.3, to: w * 0.7 }, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut", onYoyo: () => img.setFlipX(true), onRepeat: () => img.setFlipX(false) });
    this.sc.tweens.add({ targets: img, y: img.y - 3, duration: 120, yoyo: true, repeat: -1 });
  }
}

import { diffFor } from "../systems/difficulty";
import Phaser from "phaser";
import { SJ_KREDDLE, SJ_TOWER_DEMO, SJ_TOWER_SIM } from "../../content/sanjeev";
import { playerKey } from "../gfx/sanmikForm";
import { kruncherVictim } from "../systems/sanmik";
import { hasVfx, vfx, vfxScatter } from "../gfx/Vfx";
import type { Line } from "../../data/types";
import { G } from "../G";
import { DialogueBox } from "../ui/DialogueBox";
import { switchTo, fadeThen, advanceChapter } from "../Flow";
import { synth } from "../audio/Synth";
import { voice } from "../audio/Voice";
import { FONT, title } from "../ui/theme";
import { dir, gabor, ping, say } from "../../content/dsl";
import { LADS } from "../../data/characters";
import { animateWalker, backdrop, charMeta, perfCycle, playPerf } from "../gfx/HD";
import { CHARACTERS } from "../../data/characters";
import { flap, fall, randomZone } from "../combat/Wonk";
import { maybeFinishArc } from "../systems/arcs";
import { addWrist, wristLook } from "../gfx/Wrist";
import { addCensorBar, censorRect } from "../gfx/Censor";
import * as KR from "../../content/krunchers";
import { GUNS } from "../combat/Guns";
import { ensureCh6Art } from "../gfx/ch6Art";
import { Presenter, hasAnchor } from "./tvnews/Presenter";
import { BRANDS, NewsChrome, calm, cameraFlash } from "./tvnews/NewsChrome";
import { shootout, splat, tripodRig, type Victim } from "./tvnews/Shootout";
import * as Juice from "../gfx/Juice";
import { createFlightView } from "./vignette/flightView";
import { goreDeath } from "../gfx/GoreDeath";
import {
  KB_ORDER, KB_QUEUE, KB_SHOT, KP_KLERBLE, KP_LAST, KP_PARTY, KP_PROTOCOL, KP_RUINS, KT_AFTER, KT_ARRIVE, KT_DEPART, KT_DRIVER, KT_KRUNCHERS, KT_OPEN, PE_RAIN,
  RM_ACTUALLY, RM_ARMS, RM_CAUTION, RM_CHEM, RM_END, RM_GOT_GUN, RM_HANDS, RM_JENKO, RM_KREBLIS, RM_LUKE, RM_NUKE, RM_OPEN, RM_PISS, RM_POLSON,
  RM_REVENGE, RM_SHOVE, RM_SHOWOFF, RM_THROW, RM_UNITE, TP_DANCE, TP_DOOM, TP_END, TP_OPEN,
} from "../../content/ch6";

/** Short scripted animations: tweens + dialogue. All violence is cartoonish and stylised. */
/** Polson's belly: how fat he is (polson_fat) -> which of the twelve fat-sheet frames. */
const Polson = {
  bellyFrame(fat: number) {
    return Math.max(0, Math.min(11, Math.round(fat)));
  },
};

/** A full-size Krel Tower in a cutscene (see bigTower()). `at(f)` is the screen y a fraction f of the way up it. */
interface BigTower {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number;
  ground: number;
  h: number;
  w: number;
  at: (f: number) => number;
}

/** Everyone on stage as black silhouettes for one frozen frame (the instant of a blast), then back to normal. */
function everyoneSil(sc: Phaser.Scene, sps: Phaser.GameObjects.Sprite[]) {
  const was = sps.map((sp) => ({ sp, d: sp.depth, tint: sp.isTinted ? sp.tintTopLeft : -1 }));
  for (const sp of sps) if (sp.active) sp.setTintFill(0x000000).setDepth(Math.max(sp.depth, 996));
  window.setTimeout(() => {
    for (const { sp, d, tint } of was) {
      if (!sp.active || !sc.sys.settings.active) continue;
      sp.clearTint();
      if (tint >= 0) sp.setTint(tint);
      sp.setDepth(d);
    }
  }, 170);
}

/**
 * Kreddle's skyline in the bridge view (bg_c6e_bridge_view, 480x272 drawn at 2x): the cut-out (c6e_kreddle_cut) starts at
 * source px (x0, y0); hz is the waterline row. On screen a source row r sits at k*r - 2; `left` and `shore` are where
 * the city starts and the waterline, in screen px.
 */
const KD_SKY = { x0: 246, y0: 80, hz: 140, k: 2, left: 492, shore: 278 };
/** The buildings in the cut-out, left to right: [first column, last column + 1, top row] (source px; the palace's dome is one). */
const KD_BUILDINGS: [number, number, number][] = [[0, 14, 128], [14, 19, 123], [19, 25, 126], [25, 29, 119], [29, 38, 116], [38, 46, 121], [46, 51, 110], [51, 55, 121], [55, 60, 117], [60, 65, 102], [65, 70, 98], [70, 74, 113], [74, 80, 107], [80, 88, 111], [88, 96, 97], [96, 100, 111], [100, 106, 114], [106, 125, 95], [125, 136, 111], [136, 140, 118], [140, 147, 99], [147, 153, 112], [153, 157, 102], [157, 161, 99], [161, 169, 112], [169, 179, 110], [179, 183, 109], [183, 197, 118], [197, 201, 120], [201, 206, 117], [206, 215, 105], [215, 220, 125], [220, 234, 122]];
/** The tower the Golden Klaw's sign stands on. */
const KD_SIGN_ON = 23;

export class VignetteScene extends Phaser.Scene {
  private box!: DialogueBox;
  private returnAt = "";
  /** Who's on stage, by speaker id (their line makes them hop). */
  private cast = new Map<string, Phaser.GameObjects.Sprite>();

  constructor() {
    super("Vignette");
  }

  async create(data: { id: string; returnAt?: string }) {
    this.returnAt = data.returnAt ?? "";
    this.lastCaption = undefined;
    this.cast = new Map();
    this.cameras.main.fadeIn(400);
    this.box = new DialogueBox(this, 1000, 0.1);
    Juice.pinDialogue(this, this.box);
    const run: Record<string, () => Promise<void>> = {
      kreltower_fall: () => this.kreltower(false),
      kreltower_saved: () => this.kreltower(true),
      pudding: () => this.pudding(),
      pudding_spy: () => this.pudding(G.s.player),
      pudding_raid: () => this.puddingRaid(),
      plane_escape: () => this.planeEscape(),
      flatmate: () => this.flatmate(),
      rival: () => this.rival(),
      press_conference: () => this.pressConference(),
      polson_gym: () => this.polsonGym(),
      polson_cctv: () => this.polsonCctv(),
      polson_gym2: () => this.polsonGym2(),
      sanmik_lampe: () => this.sanmikLampe(),
      sanmik_nation: () => this.sanmikNation(),
      sanmik_finale: () => this.sanmikFinale(),
      crobley_news: () => this.crobleyNews(),
      crobley_ad: () => this.crobleyAdvert(),
      crobley_presser: () => this.crobleyPresser(),
      crobley_boom: () => this.crobleyBoom(),
      kruncher_mikey: () => this.krunchers(),
      klerble_train: () => this.klerbleTrain(),
      revenge_meeting: () => this.revengeMeeting(),
      krunch_protocol: () => this.krunchProtocol(),
      townhall_party: () => this.townhallParty(),
    };
    await (run[data.id] ?? (async () => undefined))();
    // rain / storm loops started by a cutscene end with it
    synth.weatherSound(null);
    G.s.flags[`vig_${data.id}`] = true;
    if (data.id === "revenge_meeting") {
      Object.assign(G.s.flags, { revenge_meeting: true, raid_march: true });
      this.giveFlamer();
    }
    if (data.id === "townhall_party") {
      Object.assign(G.s.flags, { ch6_clear: true, ch6_outro: true, krelworld_bombed: true });
      advanceChapter();
    }
    G.save();
    const next =
      data.id === "crobley_news" && this.returnAt === "ARCHIVE"
        ? () => switchTo(this, "Meeting", { id: "crobley_briefing", next: { scene: "Hub", data: { at: "ARCHIVE" } } })
        : data.id === "revenge_meeting"
        ? () => switchTo(this, "Hub", { at: "TOWN_HALL", from: "vignette" })
        : data.id === "krunch_protocol"
          ? () => switchTo(this, "Hub", { at: "TOWN_HALL", from: "krunch" })
        : data.id === "townhall_party"
          ? () => switchTo(this, "Hub", { at: "TOWN_HALL", from: "vignette" })
        : data.id === "kruncher_mikey"
          ? () => switchTo(this, "Hub", { at: "FIELD", from: "krunchers" })
        : data.id === "sanmik_lampe"
          ? () => switchTo(this, "Dungeon", { dungeon: "arena_sanmik", room: 0 })
          : () => switchTo(this, "Hub", { at: this.returnAt, from: "vignette" });
    fadeThen(this, 250, next);
  }

  // ---------------------------------------------------------------- THE KREDDLE KRUNCHERS INVADE

  /** The Krunchers: the lads' sprites in Kreddle neon. */
  private kruncherSprites(x: number, y: number, gap = 70, scale = 2.8) {
    return KR.KRUNCHERS.filter((k) => this.textures.exists(`spr_${k.of}`)).map((k, i) => {
      const sp = this.add.sprite(x + i * gap, y + (i % 2) * 16, `spr_${k.of}`, 0).setScale(scale).setDepth(40 + i);
      sp.setTint(i % 2 ? 0xff9de6 : 0x9be7ff);
      return sp;
    });
  }

  private shout(spr: Phaser.GameObjects.Sprite, text: string, color = "#ffd1f3") {
    const t = this.add.text(spr.x, spr.y - 120, text, { fontFamily: FONT, fontSize: "15px", color: "#111", backgroundColor: color, padding: { x: 6, y: 3 }, fontStyle: "bold" }).setOrigin(0.5).setDepth(400);
    this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 900, duration: 500, onComplete: () => t.destroy() });
  }

  /** The Krunchers find Mikey outside Krelburger (the bridge and the Tap happen in town, in HubScene). */
  private async krunchers() {
    const s = G.s;
    synth.music("klerble");
    // Mikey
    if (!backdrop(this, "bg_city", { depth: -10 })) this.sky(0x8fc3ea, 0xf3d9b1);
    this.add.rectangle(480, 450, 960, 200, 0x5b5b66).setDepth(-5);
    this.add.text(480, 200, "KRELBURGER", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ffd23f", stroke: "#7f1d1d", strokeThickness: 6 }).setOrigin(0.5).setDepth(-4);
    // playing as Mikey, it's Polson they get (protein shake for bongo)
    const pol = kruncherVictim(s) === "POLSON";
    const vKey = pol ? "spr_POLSON" : "spr_MIKEY";
    const mikey = this.add.sprite(480, 345, vKey, 0).setScale(3).setDepth(50);
    const mm = charMeta(this, vKey);
    const gang = this.kruncherSprites(-600, 340, 60, 2.8);
    await this.tween({ targets: gang, x: "+=640", duration: 1800 });
    await this.talk(pol ? KR.KR_POLSON_MEET : KR.KR_MIKEY_MEET);
    // they close in round him
    await this.tween({ targets: gang, x: (_t: unknown, _k: string, _v: number, i: number) => 330 + (i % 5) * 70 + (i > 4 ? 30 : 0), y: (_t: unknown, _k: string, _v: number, i: number) => (i > 4 ? 365 : 325), duration: 700 });
    await this.talk(pol ? KR.KR_POLSON_BEG : KR.KR_MIKEY_BEG);
    const hits = ["WHAM!", "KRUNCH!", "BOSH!", "THWACK!", "SPLAT!", "KAPOW!", "OOF!", "NOT THE FACE!", "WALLOP!", "KRUNCH!!"];
    for (let i = 0; i < hits.length; i++) {
      const k = gang[i % gang.length];
      this.tween({ targets: k, x: k.x + (mikey.x - k.x) * 0.35, yoyo: true, duration: 110 });
      synth.play(i % 3 === 2 ? "punch_big" : "punch");
      vfx(this, i % 2 ? "vfx_hit" : "vfx_stars", mikey.x + (Math.random() - 0.5) * 50, mikey.y - 50 + (Math.random() - 0.5) * 40, { scale: 1.6, depth: 300 });
      if (G.meta.settings.gore !== false && i % 3 === 1) vfx(this, "vfx_blood", mikey.x, mikey.y - 40, { scale: 1.4, depth: 290 });
      const hurt = mm?.hurt?.south;
      if (hurt?.length) mikey.setFrame(hurt[i % hurt.length]);
      this.cameras.main.shake(120, 0.008);
      this.caption(hits[i], i % 2 ? "#ff4d4d" : "#ffd23f", 30 + (i % 3) * 4);
      await this.wait(330);
    }
    const fall = mm?.death?.east ?? mm?.death?.south;
    if (fall?.length) for (const f of fall) {
      mikey.setFrame(f);
      await this.wait(110);
    }
    else mikey.setAngle(90);
    vfx(this, "vfx_dust", mikey.x, mikey.y, { scale: 2, depth: 45 });
    this.lastCaption?.destroy();
    if (pol) this.proteinShake(mikey.x + 46, mikey.y - 4);
    else if (this.textures.exists("p_bongo")) this.add.image(mikey.x - 10, mikey.y - 30, "p_bongo").setScale(1.4).setAngle(20).setDepth(60);
    // from here on (for the rest of Chapter 3) the victim's portrait has the black eye and fat lip
    s.flags.krunchers_invaded = true;
    await this.talk(pol ? KR.KR_POLSON_AFTER : KR.KR_MIKEY_AFTER);
    await this.tween({ targets: gang, x: "+=900", duration: 2000 });

  }

  /** Polson's protein shake, on his head like a little hat (a shaker bottle: lid, body, label). */
  private proteinShake(x: number, y: number) {
    const c = this.add.container(x, y).setDepth(60).setAngle(105);
    c.add(this.add.rectangle(0, 6, 26, 34, 0xe5e7eb).setStrokeStyle(2, 0x111827));
    c.add(this.add.rectangle(0, 8, 26, 12, 0x7c3aed));
    c.add(this.add.text(0, 8, "WHEY", { fontFamily: FONT, fontSize: "7px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
    c.add(this.add.rectangle(0, -14, 22, 8, 0x111827));
    c.add(this.add.rectangle(6, -20, 5, 6, 0x111827));
    // a dribble down his face
    const d = this.add.rectangle(x - 18, y + 6, 3, 4, 0xf5f0e6).setOrigin(0.5, 0).setDepth(61);
    this.tweens.add({ targets: d, scaleY: 6, duration: 1600 });
  }

  /** A drawn explosion (PixelLab VFX) plus smoke; false if the art isn't loaded. Pass a container to put it inside one. */
  private boomAt(x: number, y: number, size = 1, depth = 60, into?: Phaser.GameObjects.Container): boolean {
    const big = size >= 1.3 && hasVfx(this, "vfx_bigboom");
    const s = vfx(this, big ? "vfx_bigboom" : "vfx_boom", x, y, { scale: big ? size : size * 1.2, depth });
    if (!s) return false;
    const sm = vfx(this, "vfx_smoke", x + (Math.random() - 0.5) * 20, y - 12 * size, { scale: size, depth: depth - 1, delay: 380 });
    if (into) into.add([s, ...(sm ? [sm] : [])]);
    return true;
  }

  /** A fire that keeps burning (wreckage): drawn flames and a smoke column, or a glowing blob if the art's missing. Destroy the container to put it out. */
  private fireBlob(x: number, y: number, size: number, depth: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(depth);
    if (hasVfx(this, "vfx_fire")) {
      for (let i = 0; i < 3; i++) {
        const f = vfx(this, "vfx_fire", x + (i - 1) * size * 0.45, y + 10 + (i === 1 ? -6 : 0), { scale: (size / 50) * (i === 1 ? 1.3 : 0.9), depth, delay: i * 90 });
        if (f) c.add(f);
      }
      const sm = vfx(this, "vfx_smokecol", x, y - size * 0.4, { scale: size / 40, depth: depth - 1, alpha: 0.85 });
      if (sm) c.add(sm);
      return c;
    }
    const blob = this.add.circle(x, y, 20, 0xff7a00, 0.95);
    c.add(blob);
    this.tween({ targets: blob, radius: size, duration: 600 });
    return c;
  }

  /**
   * The Krel Tower at full cutscene size: base on the ground line, spire up at the top of the
   * screen (a touch past it, so it reads as huge and you're looking up at it). Sizes are set in
   * screen pixels, so it doesn't matter which art is loaded.
   */
  private bigTower(x: number, ground: number, depth = 10, top = -30): BigTower {
    const img = this.add.image(x, ground, "p_kreltower").setOrigin(0.5, 1).setDepth(depth);
    const h = ground - top;
    img.displayHeight = h;
    img.displayWidth = (h * img.width) / img.height;
    // the base sits in a little shadow so it feels planted, not pasted on
    const shadow = this.add.ellipse(x, ground - 2, img.displayWidth * 1.5, 22, 0x000000, 0.35).setDepth(depth - 1);
    return { img, shadow, x, ground, h, w: img.displayWidth, at: (f: number) => ground - h * f };
  }

  /**
   * Flight KR-069, `width` screen pixels nose to tail (the HD art when it's loaded). `flip` points it
   * left: that uses the left-facing copy so "KREL AIR" still reads the right way round.
   */
  private airliner(x: number, y: number, width = 250, flip = false) {
    const key = flip && this.textures.exists("p_plane_hd_l") ? "p_plane_hd_l" : this.textures.exists("p_plane_hd") ? "p_plane_hd" : "p_plane";
    const p = this.add.image(x, y, key).setDepth(20).setFlipX(flip && key !== "p_plane_hd_l");
    p.displayWidth = width;
    p.displayHeight = (width * p.height) / p.width;
    return p;
  }

  /**
   * A tower coming down: it sinks into its own footprint (masked at the ground line), leaning a
   * little, with booms rolling down the falling top, a smoke column and dust rolling out at the base.
   */
  private collapseFx(t: BigTower, dur = 2600) {
    const mask = this.make.graphics({}, false).fillRect(0, -600, 960, t.ground + 600);
    t.img.setMask(mask.createGeometryMask());
    this.tweens.add({ targets: t.img, y: t.ground + t.h * 0.97, duration: dur, ease: "Quad.in" });
    this.tweens.add({ targets: t.img, angle: { from: 0, to: 4 }, duration: dur, ease: "Sine.in" });
    this.tweens.add({ targets: t.shadow, alpha: 0, duration: dur });
    // booms chase the top of the tower down
    const top0 = t.ground - t.h;
    for (let i = 0; i < 8; i++) {
      const ms = i * (dur / 8);
      const p = (ms / dur) ** 2;
      this.time.delayedCall(ms, () => this.boomAt(t.x + (Math.random() - 0.5) * t.w * 0.8, top0 + t.h * (p + 0.12 + Math.random() * 0.15) + 60, 1.4 + Math.random() * 0.7, 41));
    }
    vfx(this, "vfx_blastsmoke", t.x, t.ground - 10, { scale: 3.2, depth: 42, delay: 600 });
    for (let i = 0; i < 5; i++) vfx(this, "vfx_dust", t.x + (i - 2) * t.w * 0.7, t.ground - 5, { scale: 2.8, depth: 43, delay: 900 + i * 150 });
  }

  /** Wipe the set for the next shot, but keep the dialogue box (depth 1000+) alive. */
  private clearStage() {
    this.cast.clear();
    for (const p of this.talkers.values()) p.destroy();
    this.talkers.clear();
    for (const o of [...this.children.list]) {
      if ((o as unknown as { depth: number }).depth >= 1000) continue;
      this.tweens.killTweensOf(o);
      o.destroy();
    }
  }

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, () => res()));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    // a character being moved walks there (instead of sliding), unless something else is already animating them
    const ts = (Array.isArray(cfg.targets) ? cfg.targets : [cfg.targets]) as unknown[];
    const walkers = ts.filter(
      (t): t is Phaser.GameObjects.Sprite =>
        t instanceof Phaser.GameObjects.Sprite && ("x" in cfg || "y" in cfg) && !("angle" in cfg) && !("scale" in cfg) && !!charMeta(this, t.texture.key) && !t.getData("walking"),
    );
    const from = walkers.map((w) => ({ w, x: w.x, y: w.y }));
    const ev = walkers.length
      ? this.time.addEvent({
          delay: 60,
          loop: true,
          callback: () => {
            for (const f of from) {
              const dx = f.w.x - f.x;
              const dy = f.w.y - f.y;
              if (Math.abs(dx) + Math.abs(dy) > 0.5) animateWalker(f.w, dx, dy, true, this.time.now);
              f.x = f.w.x;
              f.y = f.w.y;
            }
          },
        })
      : null;
    walkers.forEach((w) => w.setData("walking", true));
    return new Promise<void>((res) =>
      this.tweens.add({
        ...cfg,
        onComplete: () => {
          ev?.remove();
          walkers.forEach((w) => {
            w.setData("walking", false);
            if (w.active) animateWalker(w, 0, 0, false, this.time.now);
          });
          res();
        },
      }),
    );
  }

  private talk(lines: Line[]) {
    if (this.talkers.size) return this.box.play(lines, { onLine: (l) => this.presenterLine(String(l.s), l.t ?? "", !!l.dir) });
    if (!this.cast.size) return this.box.play(lines);
    return this.box.play(lines, { onLine: (l) => this.hopSpeaker(String(l.s)) });
  }

  /** PixelLab presenters on stage (the Crobley studio, Swig's podium), by speaker: their lines lip-sync and gesture. */
  private talkers = new Map<string, Presenter>();
  /** someone who isn't a presenter speaks (a reporter in the room): this is told who */
  private onOtherLine?: (speaker: string) => void;

  private presenterLine(speaker: string, text: string, isDir: boolean) {
    for (const [name, p] of this.talkers) if (name !== speaker) p.stopTalking();
    const p = this.talkers.get(speaker);
    if (p && !isDir && text) p.say(text);
    else if (!isDir) this.onOtherLine?.(speaker);
  }

  private lastCaption?: Phaser.GameObjects.Text;

  private caption(t: string, color = "#ffffff", size = 34) {
    this.lastCaption?.destroy();
    const c = title(this, 480, 200, t, size, color).setDepth(500);
    c.setScale(0.2);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: "Back.out" });
    this.lastCaption = c;
    return c;
  }

  /** Krelford's outskirts at dusk, the railway across the bottom (rails at y≈408 and 424). False if the art's missing. */
  private railBackdrop() {
    if (!this.textures.exists("bg_krelford_rail")) return false;
    this.add.image(480, 540, "bg_krelford_rail").setOrigin(0.5, 1).setScale(2);
    return true;
  }

  private sky(top: number, bottom: number) {
    const g = this.add.graphics();
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, 960, 540);
    return g;
  }

  private crowd(y: number) {
    const ids = [...LADS.filter((p) => p !== G.s.player), "PROCTUS", G.s.player, "FOLK0", "FOLK1", "FOLK2", "FOLK3"];
    return ids.map((id, i) => this.add.sprite(60 + i * 64, y + (i % 2) * 14, id === G.s.player ? playerKey(this) : `spr_${id}`, 0).setScale(2.6).setDepth(50));
  }

  // ---------------------------------------------------------------- THE KRELTOWER INCIDENT

  private async kreltower(saved: boolean) {
    const skyG = this.sky(saved ? 0x7ec8f0 : 0x8fc3ea, 0xf3d9b1);
    const g = this.add.graphics();
    g.fillStyle(0x5a6a80, 1);
    for (let i = 0; i < 20; i++) g.fillRect(i * 50, 300 - ((i * 37) % 90), 44, 300);
    g.fillStyle(0x3d6a2a, 1).fillRect(0, 430, 960, 110);
    if (backdrop(this, "bg_city", { depth: -10 })) {
      skyG.setVisible(false);
      g.setVisible(false);
    }
    const tower = this.bigTower(560, 440);
    this.add.text(560, 446, "KRELTOWER", { fontFamily: FONT, fontSize: "11px", color: "#ffffff", backgroundColor: "#00000099", padding: { x: 4, y: 2 } }).setOrigin(0.5, 0).setDepth(11);
    const people = this.crowd(470);
    // Sanjeev, a little apart from the crowd, watching with his arms folded
    const sjv = saved ? null : this.actor("SANJEEV", 928, 486, 2.6);
    if (sjv) this.face(sjv, "west");
    synth.music("airport");
    await this.talk([dir(saved ? "Krelford. Everyone is outside. Everyone is looking up." : "Krelford. Everyone is outside. Everyone is looking up. Somebody drops a fizzy bongo.")]);
    // it comes in from the right, heading for two-thirds of the way up
    const hitY = tower.at(0.66);
    const plane = this.airliner(1120, hitY - 70, 240, true);
    if (saved) {
      await this.tween({ targets: plane, x: 800, y: hitY, angle: -4, duration: 2200, ease: "Sine.inOut" });
      this.people(people, "!");
      this.caption("PULL UP!!!", "#ffd23f");
      // up and over the spire, off the top of the screen…
      await this.tween({ targets: plane, x: 640, y: -90, angle: 30, duration: 1100, ease: "Quad.in" });
      // …and back down the other side, nose first, into the Tap
      plane.setPosition(420, -80).setAngle(-28);
      await this.tween({ targets: plane, x: 200, y: 330, angle: -14, duration: 1800, ease: "Sine.in" });
      synth.play("explode");
      const splash = this.add.circle(200, 400, 10, 0xffb6c1, 0.9).setDepth(30);
      this.tween({ targets: splash, radius: 120, alpha: 0, duration: 900 });
      this.add.image(200, 430, "p_tap").setOrigin(0.5, 1).setScale(1.6).setDepth(25);
      plane.setAngle(30);
      this.caption("LANDED (IN THE GREAT TAP)", "#ffb6c1", 28);
      synth.play("cheer");
      this.people(people, "WAHEY");
      await this.wait(1200);
      await this.talk([
        say("KREBLIS", "Krelmergency over. I repeat. Krelmergency over"),
        say("KREBLIS", "The plane is in the Tap"),
        say("KREBLIS", "Mmm…Tap…"),
        say("FLENKY", "Wasn't me. Got out just in time by doing an MMA backflip."),
        say("KREBLIS", "You weren't on it, Jenko."),
        say("FLENKY", "…I was near it."),
        say("KROZNO", "(from inside the Tap, gargling pussy juice) My dirty… bloody… tricks…"),
        ping("DRONGUS", "Kreltower survived ??"),
        ping("DRONGUS", "First time ever"),
        ping("DRONGUS", "Well done I suppose. Still haven't reacted to the song though."),
        dir("KRELTOWER: STILL STANDING. Krozno is arrested and charged with 'being up to his usual dirty bloody tricks'."),
      ]);
      return;
    }
    // The bad ending: it happens, everyone sees it, it collapses, everyone panics.
    // nose into the tower two-thirds of the way up
    await this.tween({ targets: plane, x: 560 + plane.displayWidth * 0.32, y: hitY, angle: -3, duration: 2600, ease: "Sine.in" });
    plane.destroy();
    synth.play("boom");
    this.cameras.main.flash(500, 255, 240, 200);
    this.cameras.main.shake(1200, 0.025);
    this.boomAt(560, hitY, 2.8, 16);
    this.time.delayedCall(220, () => this.boomAt(560 + tower.w * 0.4, hitY + 30, 1.6, 16));
    this.time.delayedCall(380, () => this.boomAt(560 - tower.w * 0.35, hitY - 20, 1.4, 16));
    const fire = this.fireBlob(560, hitY + 6, 90, 15);
    this.people(people, "!!");
    synth.play("gasp");
    await this.talk([say("KREBLIS", "This is a Krelmergency message… Kreltower has been hit. I repeat. Kreltower has been hit"), say("KREBLIS", "Thinking about it…"), say("KREBLIS", "Again")]);
    await this.talk(SJ_TOWER_SIM);
    for (let i = 0; i < (hasVfx(this, "vfx_smokecol") ? 0 : 16); i++) {
      const smoke = this.add.circle(560 + (Math.random() - 0.5) * 80, hitY - Math.random() * 40, 16 + Math.random() * 20, 0x333333, 0.7).setDepth(14);
      this.tween({ targets: smoke, y: smoke.y - 160, alpha: 0, scale: 2.5, duration: 3000 + Math.random() * 1500 });
    }
    await this.wait(1200);
    synth.play("boom");
    this.cameras.main.shake(2600, 0.03);
    fire.destroy();
    this.collapseFx(tower);
    for (let i = 0; i < (hasVfx(this, "vfx_dust") ? 10 : 30); i++) {
      const dust = this.add.circle(560 + (Math.random() - 0.5) * 200, 430, 20 + Math.random() * 30, 0xb8a888, 0.85).setDepth(40);
      this.tween({ targets: dust, x: dust.x + (Math.random() - 0.5) * 700, y: 400 - Math.random() * 160, scale: 3, alpha: 0, duration: 3500, delay: 400 + Math.random() * 1400 });
    }
    this.caption("KRELTOWER HAS FALLEN", "#ff4d4d");
    // panic
    people.forEach((p, i) => {
      p.setFlipX(i % 2 === 0);
      this.tweens.add({ targets: p, x: i % 2 ? 1040 : -80, duration: 1500 + Math.random() * 1500, delay: 300 + i * 80 });
      this.time.addEvent({ delay: 120, repeat: 20, callback: () => animateWalker(p, i % 2 ? 1 : -1, 0, true, this.time.now) });
    });
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 250, () => {
        const t = this.add.text(80 + Math.random() * 800, 300 + Math.random() * 120, ["AAAAAH", "HELP", "NOT AGAIN", "MY BONGO", "RUN", "IS PURPLE HIGH OR LOW", "KRELMERGENCY"][i % 7], { fontFamily: FONT, fontSize: "16px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setDepth(60);
        this.tween({ targets: t, y: t.y - 40, alpha: 0, duration: 1600 });
      });
    }
    synth.play("alarm");
    await this.wait(3200);
    await this.talk([
      dir("Silence. Then sirens. Then, from somewhere under the dust cloud, a single phone notification."),
      ping("DRONGUS", "No! Not again !!"),
      ping("DRONGUS", "It only just got rebuilt !"),
      say("FLENKY", "Wasn't me. Got out just in time by doing an MMA backflip."),
      say("SCROMBUS", "How would you have— you know what, not today."),
      say("KREZWONK", "I foresaw this. I elected not to prevent it. I'd like that struck from the record."),
      say("GRONNY", "…"),
      say("GRONNY", "Not fair enough."),
      dir("Through the settling dust, one man hasn't moved. Sanjeev. Arms folded. Head tilted."),
      ...SJ_TOWER_DEMO,
      dir("KRELTOWER: DESTROYED (AGAIN). Krozno escaped in the confusion, presumably to be up to his usual dirty bloody tricks. Krelford will rebuild. Krelford always rebuilds. It's on the wiki."),
    ]);
    synth.stopMusic();
  }

  private people(ps: Phaser.GameObjects.Sprite[], text: string) {
    ps.forEach((p, i) => {
      if (i % 2) return;
      const t = this.add.text(p.x, p.y - 50, text, { fontFamily: FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(60);
      this.tween({ targets: t, y: t.y - 20, alpha: 0, duration: 1400 });
      this.tweens.add({ targets: p, y: p.y - 10, yoyo: true, duration: 120, repeat: 3 });
    });
  }

  // ---------------------------------------------------------------- BREAD AND BUTTER PUDDING

  /** The krezz comes out of the abandoned building: out of the door, out of the windows, across the ground. */
  private krezzFlood(dx: number, dy: number) {
    const cream = 0xf8f8f2;
    // the painted backdrop's doorway and windows sit in different places from the fallback drawing
    const painted = this.textures.exists("bg_abandoned");
    const door = painted ? { x: 540, y: 420 } : { x: dx, y: dy + 30 };
    const ground = painted ? 462 : dy + 38;
    const spouts: [number, number][] = painted ? [[215, 95], [345, 95], [600, 90], [540, 300]] : [[360, 245], [440, 245], [560, 245], [620, 245], [480, 130]];
    synth.play("splash");
    this.time.delayedCall(250, () => synth.play("flush"));
    // it pours out of the doorway in waves and runs off along the ground both ways
    this.time.addEvent({
      delay: 45,
      repeat: 70,
      callback: () => {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const blob = this.add.ellipse(door.x + (Math.random() - 0.5) * 40, door.y - Math.random() * 40, 26 + Math.random() * 20, 16 + Math.random() * 10, cream, 0.95).setDepth(26);
        const run = 120 + Math.random() * 360;
        this.tweens.add({ targets: blob, x: blob.x + dir * run, y: ground + (Math.random() - 0.5) * 10, scaleX: 2.2, scaleY: 0.6, duration: 700 + run * 1.6, ease: "Quad.out", onComplete: () => {
          blob.setDepth(7);
          this.tweens.add({ targets: blob, alpha: 0.75, delay: 5000, duration: 3000 });
        } });
      },
    });
    // the puddle itself, lumpy, spreading
    for (let i = 0; i < 9; i++) {
      const x = door.x + (i - 4) * 70 + (Math.random() - 0.5) * 30;
      const pud = this.add.ellipse(x, ground + (Math.random() - 0.5) * 8, 10, 6, cream, 0.92).setDepth(7);
      this.tweens.add({ targets: pud, displayWidth: 110 + Math.random() * 90, displayHeight: 22 + Math.random() * 16, delay: 300 + Math.abs(i - 4) * 260, duration: 1600, ease: "Quad.out" });
      const sh = this.add.ellipse(x - 10, ground - 4, 6, 3, 0xffffff, 1).setDepth(8);
      this.tweens.add({ targets: sh, displayWidth: 50, delay: 300 + Math.abs(i - 4) * 260, duration: 1600 });
    }
    // jets out of the windows
    spouts.forEach(([sx, sy], k) => {
      this.time.addEvent({
        delay: 55,
        repeat: 34,
        startAt: k * 15,
        callback: () => {
          const d = this.add.circle(sx, sy, 3 + Math.random() * 5, cream).setDepth(27);
          const vx = (sx < 480 ? -1 : 1) * (40 + Math.random() * 160);
          const st = { t: 0 };
          const fall = ground - sy;
          this.tweens.add({ targets: st, t: 1, duration: 650 + Math.random() * 300, onUpdate: () => d.setPosition(sx + vx * st.t, sy - 50 * st.t + (fall + 50) * st.t * st.t), onComplete: () => {
            d.destroy();
            if (Math.random() < 0.25) {
              const sp = this.add.ellipse(sx + vx, ground + (Math.random() - 0.5) * 10, 24, 8, cream, 0.9).setDepth(7);
              this.tweens.add({ targets: sp, alpha: 0.6, delay: 4000, duration: 3000 });
            }
          } });
        },
      });
      // a drip running down the wall under each window
      if (sy < 300) {
        const drip = this.add.rectangle(sx + (Math.random() - 0.5) * 20, sy + 20, 9, 6, cream).setOrigin(0.5, 0).setDepth(6);
        this.tweens.add({ targets: drip, displayHeight: ground - sy - 30, delay: 400 + k * 150, duration: 2600, ease: "Sine.in" });
      }
    });
  }

  /** `spy` = the player is somebody else, watching Lulon from the bushes. */
  private async pudding(spy?: string) {
    const watcherId = spy ?? (G.s.flags.pudding_follower as string) ?? LADS.filter((id) => id !== "CRONGUS")[Math.floor(Math.random() * 8)];
    if (!spy) G.s.flags.pudding_follower = watcherId;
    const skyP = this.sky(0x0a0a1a, 0x1a1a2e);
    const g = this.add.graphics();
    g.fillStyle(0x2a2a2a, 1).fillRect(300, 170, 360, 260);
    g.fillStyle(0x1a1a1a, 1).fillTriangle(280, 175, 680, 175, 480, 100);
    for (const x of [340, 420, 540, 600]) {
      g.fillStyle(0x3b2a1a, 1).fillRect(x, 220, 40, 50);
      g.fillStyle(0x5a3a20, 1).fillRect(x - 4, 236, 48, 6).fillRect(x - 4, 252, 48, 6);
    }
    const door = this.add.rectangle(480, 395, 60, 70, 0x0a0a0a).setDepth(5);
    g.fillStyle(0x222222, 1).fillRect(0, 430, 960, 110);
    const abLbl = this.add.text(480, 150, "(ABANDONED)", { fontFamily: FONT, fontSize: "12px", color: "#666" }).setOrigin(0.5);
    if (backdrop(this, "bg_abandoned", { depth: -10 })) {
      skyP.setVisible(false);
      abLbl.setVisible(false);
      door.setAlpha(0.25);
      g.clear();
    }
    const luke = this.add.sprite(120, 420, "spr_CRONGUS", 0).setScale(3).setDepth(10);
    // someone is in the bushes
    const watcher = this.add.sprite(-30, 450, `spr_${watcherId}`, 0).setScale(2.6).setDepth(12).setAlpha(spy ? 1 : 0.0);
    const bush = this.add.ellipse(20, 470, 150, 70, 0x1f3d1f).setDepth(13).setStrokeStyle(3, 0x0f200f);
    const wName = CHARACTERS[watcherId]?.name ?? watcherId;
    if (spy) {
      this.tween({ targets: watcher, x: 30, duration: 900 });
      await this.talk([
        dir("You're in a bush outside the abandoned building. Lil' Crongus is walking up to the door, looking over his shoulder every three steps."),
        say(spy, "There he goes. Up to some sick shit. Stay low."),
      ]);
    }
    // the song starts as soon as we're at the door (and it's this scene's alone: it never follows you out)
    synth.music("bbp", true);
    this.events.once("shutdown", () => {
      if (synth.currentMusic() === "bbp") synth.stopMusic();
    });
    await this.talk([dir("The abandoned building. A faint smell of custard. And something underneath the custard that the custard is trying to cover up.")]);
    this.time.addEvent({ delay: 140, repeat: 14, callback: () => animateWalker(luke, 1, 0, true, this.time.now) });
    await this.tween({ targets: luke, x: 480, duration: 2000 });
    await this.talk([say("CRONGUS", "Hello? Is the… is the… 'bread and butter pudding' here? That's the code, right?"), dir("Something inside says 'yes'. It is not clear what said it.")]);
    await this.tween({ targets: luke, alpha: 0, scale: 2.6, duration: 600 });
    door.setFillStyle(0x000000);
    await this.wait(600);
    const moans = ["mmmm", "mm fuck yes", "MMMMMM", "MMM FUCK YES", "mmmmmmmm…", "oh", "fuck yes…", "OHHH", "mmmMMMMM", "…mmm", "MM. FUCK. YES.", "MMMMMMMMMMM"];
    for (let i = 0; i < 14; i++) {
      this.time.delayedCall(i * 380, () => {
        const t = this.add.text(320 + Math.random() * 320, 180 + Math.random() * 220, moans[i % moans.length], { fontFamily: FONT, fontSize: `${14 + (i % 4) * 5}px`, color: "#ffe4ec", fontStyle: "italic", stroke: "#000", strokeThickness: 3 }).setDepth(30);
        this.tween({ targets: t, y: t.y - 30, alpha: 0, duration: 1500 });
        // the noises: moans that match the words, grunts in between, getting higher and louder
        const word = moans[i % moans.length].toLowerCase();
        const p = 1 + i * 0.025;
        synth.voice(word.startsWith("oh") ? "oh" : "mmm", 0.35 + i * 0.03, p);
        if (word.includes("fuck")) synth.voice("grunt", 0.5, p, 0.18);
        if (i % 2) synth.voice("grunt", 0.4 + i * 0.02, p * 0.95, 0.3);
        // the whole building shakes, more and more
        this.cameras.main.shake(380, 0.006 + i * 0.0018);
        g.setAlpha(i % 2 ? 0.85 : 1);
        this.tweens.add({ targets: door, scaleX: 1.08, scaleY: 0.94, yoyo: true, duration: 90 });
      });
    }
    await this.wait(14 * 380 + 800);
    // the wonk
    if (spy) {
      await this.talk([dir("From inside: a slow, rhythmic creaking. Then a faster one."), say(spy, "Oh no. Something is going on in there. He's groaning. There's thudding. There's screaming. This is horrific.")]);
    } else await this.puddingWonk();
    this.cameras.main.shake(1200, 0.03);
    synth.voice("oh", 0.7, 1.35);
    synth.voice("grunt", 0.7, 1.1, 0.5);
    synth.voice("oh", 0.6, 1.5, 0.75);
    this.krezzFlood(door.x, door.y);
    this.caption("THE ULTIMATE SENSATION", "#ffe4ec", 30);
    await this.wait(1600);
    this.children.list.filter((o) => o instanceof Phaser.GameObjects.Text && (o as Phaser.GameObjects.Text).text === "THE ULTIMATE SENSATION").forEach((o) => o.destroy());
    await this.wait(1800);
    luke.setAlpha(1).setScale(3).setTint(0x9a9aaa);
    // Boggor Cranstil has been waiting in the shadows by the door
    const boggorKey = this.textures.exists("spr_BOGGOR") ? "spr_BOGGOR" : "spr_FOLK2";
    const boggor = this.add.sprite(600, 420, boggorKey, 0).setScale(3).setDepth(9).setAlpha(0);
    if (boggorKey === "spr_FOLK2") boggor.setTint(0x8a7a6a);
    this.tween({ targets: boggor, alpha: 1, duration: 800 });
    const walk = this.time.addEvent({ delay: 90, loop: true, callback: () => animateWalker(luke, 1, 0, true, this.time.now) });
    await this.tween({ targets: luke, x: 700, duration: 3200 });
    walk.remove();
    animateWalker(luke, 0, 1, false, this.time.now);
    luke.setData("facing", "west");
    animateWalker(luke, 0, 0, false, this.time.now);
    await this.talk([
      dir("Someone is standing by the door. A hunched shape in a stained cardigan. He has been there the whole time."),
      say("BOGGOR CRANSTIL", "Heh heh…"),
      say("BOGGOR CRANSTIL", "Now it's Boggor's time for some lovely 'bread and butter pudding'…"),
      say("BOGGOR CRANSTIL", "Nice to see I'm not the only one with this particular… taste."),
    ]);
    const bwalk = this.time.addEvent({ delay: 110, loop: true, callback: () => animateWalker(boggor, -1, 0, true, this.time.now) });
    await this.tween({ targets: boggor, x: 480, y: 400, duration: 1600 });
    bwalk.remove();
    await this.tween({ targets: boggor, alpha: 0, duration: 500 });
    boggor.destroy();
    await this.wait(700);
    const m = this.add.text(480, 330, "…mmm.", { fontFamily: FONT, fontSize: "16px", color: "#ffe4ec", fontStyle: "italic", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(30);
    this.tween({ targets: m, y: 300, alpha: 0, duration: 1600 });
    await this.wait(1000);
    await this.talk([
      say("CRONGUS", "…what did he mean by that."),
      say("CRONGUS", "Nobody saw. Nobody saw anything. I'll never be exposed."),
      dir("Lil' Crongus emerges. He has aged nine years. There is krezz on his shoes."),
      say("CRONGUS", "…"),
      say("CRONGUS", "I can never come back from that."),
      say("CRONGUS", "The ultimate sensation. They weren't lying. They weren't lying. How can I live with myself. How can I look at myself in the mirror."),
      say("CRONGUS", "I want it again. I want it again right now. Oh no."),
      say("CRONGUS", "Nobody can know. If the group chat finds out… if Drongus finds out… he'll make a song. He'll make a wiki page. He'll make a TV show."),
      ping("DRONGUS", "@LIL' CRONGUS where are you ?"),
      say("CRONGUS", "*puts phone face down*"),
      dir("You have found the bread and butter pudding. You will never speak of it. You will think about it every single day."),
    ]);
    if (spy) {
      await this.talk([say(spy, "Got it all on video. Every 'mm fuck yes'."), say(spy, "The Krelford Gazette is going to pay me so much for this.")]);
    } else {
      watcher.setAlpha(1).setX(30);
      this.tween({ targets: watcher, x: -60, duration: 1400 });
      await this.talk([dir(`In the bush by the gate, a phone camera light clicks off. ${wName} was there the whole time. ${wName} saw everything.`), dir("You didn't notice. You never notice.")]);
    }
    bush.destroy();
    synth.stopMusic();
  }

  /** Inside the pudding house: a short wonk, flappy-style, to the moans. */
  private async puddingWonk() {
    const z = randomZone();
    const g0 = { gauge: 0, vel: 0 };
    let inZone = 0;
    const need = Math.min(1500, z.need * 0.7);
    const ui = this.add.container(0, 0).setDepth(60);
    ui.add(this.add.rectangle(480, 270, 960, 540, 0x1a0010, 0.6));
    ui.add(this.add.text(480, 80, "WONK IT (OVER THE PUDDING)", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ff9ad5", stroke: "#2a0030", strokeThickness: 7 }).setOrigin(0.5));
    ui.add(this.add.text(480, 116, "Tap / SPACE to flap it up. Keep it in the zone. Mm fuck yes.", { fontFamily: FONT, fontSize: "14px", color: "#ffffff" }).setOrigin(0.5));
    const GX = 700;
    const GY = 150;
    const GH = 300;
    ui.add(this.add.rectangle(GX, GY + GH / 2, 50, GH + 6, 0x000000, 0.8).setStrokeStyle(3, 0xffffff, 0.8));
    ui.add(this.add.rectangle(GX, GY + GH * (1 - (z.lo + z.hi) / 2), 50, GH * (z.hi - z.lo), 0x22c55e, 0.4));
    const fillR = this.add.rectangle(GX, GY + GH, 40, 0, 0xff4fa3).setOrigin(0.5, 1);
    ui.add(fillR);
    // Crongus with his hand down there (his wonk loop), the bar over it; a stand-in wrist only if the art is missing
    const cr = this.add.sprite(380, 290, "spr_CRONGUS", 0).setScale(4);
    const pump = perfCycle(cr, "wonk");
    if (pump) cr.setFrame(pump[0]);
    const crr = censorRect(cr);
    const wrist = addWrist(this, crr.x - 6, crr.y - crr.h * 0.1, { ...wristLook("CRONGUS", CHARACTERS as any), scale: 2 });
    wrist.obj.setVisible(!pump);
    let pumpPhase = 0;
    ui.add([cr, wrist.obj, addCensorBar(this, cr, { pad: 1 }).obj]);
    const status = this.add.text(380, 420, "", { fontFamily: "Impact, sans-serif", fontSize: "24px", color: "#ffe4ec", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5);
    ui.add(status);
    const press = () => {
      flap(g0);
      wrist.kick();
      pumpPhase += 1;
    };
    this.input.keyboard?.on("keydown-SPACE", press);
    this.input.on("pointerdown", press);
    let t = 0;
    let result = "under" as "perfect" | "over" | "under";
    await new Promise<void>((res) => {
      const ev = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          t += 16;
          fall(g0, 16);
          if (pump) {
            pumpPhase += 0.016 * (6 + g0.gauge * 14);
            cr.setFrame(pump[Math.floor(pumpPhase) % pump.length]);
          }
          if (g0.gauge >= z.lo && g0.gauge <= z.hi) inZone += 16;
          fillR.setSize(40, GH * g0.gauge);
          fillR.setFillStyle(g0.gauge > z.hi ? 0xef4444 : g0.gauge >= z.lo ? 0x22c55e : 0xff4fa3);
          status.setText(g0.gauge > z.hi ? "TOO MUCH" : g0.gauge >= z.lo ? "mm fuck yes" : "mmmm…");
          if (g0.gauge >= 0.97) result = "over";
          else if (inZone >= need) result = "perfect";
          if (result !== "under" || t > 7000) {
            ev.remove();
            res();
          }
        },
      });
    });
    this.input.keyboard?.off("keydown-SPACE", press);
    this.input.off("pointerdown", press);
    ui.destroy();
    this.caption(result === "perfect" ? "MM. FUCK. YES." : result === "over" ? "TOO EARLY. INTO THE PUDDING." : "NOTHING. NOT EVEN FOR THE PUDDING.", "#ffe4ec", 30);
    await this.wait(1400);
  }

  // ---------------------------------------------------------------- THE PUDDING RAID

  private async puddingRaid() {
    const leakerId = (G.s.player === "CRONGUS" ? (G.s.flags.pudding_follower as string) : G.s.player) ?? "KREBLIS";
    const leaker = CHARACTERS[leakerId]?.name ?? leakerId;
    if (!backdrop(this, "bg_press", { depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x1e2a44);
    synth.music("ominous");
    const paper = this.add.container(480, 270).setDepth(200);
    paper.add(this.add.rectangle(0, 0, 760, 400, 0xf4ecd8).setStrokeStyle(4, 0x1f1f1f));
    paper.add(this.add.text(0, -165, "THE KRELFORD GAZETTE", { fontFamily: "Georgia, serif", fontSize: "30px", color: "#111", fontStyle: "bold" }).setOrigin(0.5));
    paper.add(this.add.rectangle(0, -140, 700, 3, 0x111111));
    paper.add(this.add.text(0, -80, "CHILDREN'S MINISTER IN\nPUDDING HOUSE SHAME", { fontFamily: "Georgia, serif", fontSize: "32px", color: "#7f1d1d", fontStyle: "bold", align: "center" }).setOrigin(0.5));
    paper.add(this.add.text(0, 30, "\u201cmm fuck yes\u201d — exclusive footage inside", { fontFamily: "Georgia, serif", fontSize: "20px", color: "#111", fontStyle: "italic" }).setOrigin(0.5));
    paper.add(this.add.text(0, 110, `Footage supplied by a source close to the minister (${leaker})`, { fontFamily: "Georgia, serif", fontSize: "15px", color: "#444" }).setOrigin(0.5));
    paper.setScale(0.2).setAngle(-540);
    await this.tween({ targets: paper, scale: 1, angle: 0, duration: 700, ease: "Back.easeOut" });
    synth.play("smash");
    await this.talk([dir(`${leaker} has leaked the pudding footage. It is on the front page. It is on every front page.`)]);
    await this.tween({ targets: paper, y: 800, angle: 12, duration: 500, ease: "Quad.easeIn" });
    paper.destroy();
    this.add.text(480, 60, "KRELFORD CONSTABULARY · EMERGENCY PRESS CONFERENCE", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#1e3a8acc", padding: { x: 10, y: 4 } }).setOrigin(0.5);
    this.add.rectangle(480, 330, 120, 90, 0x5a3a20).setDepth(20);
    const swigKey = this.textures.exists("npc_swig") ? "npc_swig" : "spr_FOLK1";
    this.add.sprite(480, 280, swigKey, 0).setScale(3).setDepth(15);
    for (let i = 0; i < 8; i++) this.add.sprite(120 + i * 100, 470 + (i % 2) * 14, `spr_FOLK${i % 4}`, 0).setScale(2.6).setDepth(30 + i);
    const flashes = this.time.addEvent({ delay: 900, loop: true, callback: () => { if (Math.random() < 0.5) this.cameras.main.flash(80, 255, 255, 255); synth.play("pop"); } });
    await this.talk([
      say("SERGEANT SWIG", "Thank you all for coming. I'll keep this brief."),
      say("SERGEANT SWIG", "We have reviewed the footage. All of it. Twice, by accident."),
      say("SERGEANT SWIG", "Luke Shears is a sick cunt."),
      dir("The room erupts. A journalist faints into another journalist."),
      say("JOURNALIST", "Sergeant, what are you going to do about the 'bread and butter pudding' house?"),
      say("SERGEANT SWIG", "Conventional policing has failed. I have authorised the army."),
    ]);
    flashes.remove();
    // ---- the tanks
    this.clearStage();
    this.cameras.main.flash(300, 255, 255, 255);
    const houseBg = backdrop(this, "bg_abandoned", { depth: -10 });
    if (!houseBg) this.add.rectangle(480, 270, 960, 540, 0x222233);
    const house = this.add.rectangle(480, 300, 420, 300, 0x000000, 0).setDepth(1);
    synth.music("boss", true);
    const tanks = [0, 1, 2].map((i) => {
      const t = this.textures.exists("p_tank") ? this.add.image(-200 - i * 220, 440 + i * 22, "p_tank").setScale(1.3) : this.add.rectangle(-200 - i * 220, 440 + i * 22, 140, 60, 0x4b5320).setStrokeStyle(3, 0x000000);
      t.setDepth(50 + i);
      return t;
    });
    this.caption("OPERATION CUSTARD STORM", "#ffd23f", 30);
    await Promise.all(tanks.map((t, i) => this.tween({ targets: t, x: 120 + i * 170, duration: 2600, ease: "Sine.out" })));
    if (houseBg) await this.puddingSiege(houseBg, tanks as unknown as Phaser.GameObjects.Image[]);
    else {
      const boom = (x: number, y: number) => {
        if (!this.boomAt(x, y, 1.4, 70))
          for (let k = 0; k < 3; k++) {
            const c = this.add.circle(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60, 10, [0xffd23f, 0xff7a1a, 0xffffff][k], 0.95).setDepth(70);
            this.tween({ targets: c, radius: 70 + Math.random() * 50, alpha: 0, duration: 600 + k * 150 });
          }
        synth.play("explode");
        this.cameras.main.shake(300, 0.02);
      };
      for (let volley = 0; volley < 4; volley++) {
        for (const t of tanks) {
          const sx = (t as any).x + 70;
          const sy = (t as any).y - 20;
          const shell = this.add.circle(sx, sy, 6, 0xffffff).setDepth(60);
          this.tween({ targets: t, x: (t as any).x - 12, duration: 80, yoyo: true });
          const tx = 380 + Math.random() * 200;
          const ty = 200 + Math.random() * 180;
          await this.tween({ targets: shell, x: tx, y: ty, duration: 260 });
          shell.destroy();
          boom(tx, ty);
        }
        await this.wait(250);
      }
      // the house comes down
      this.cameras.main.shake(1600, 0.035);
      const rubble = this.add.graphics().setDepth(40);
      rubble.fillStyle(0x1a1a1a, 1);
      for (let i = 0; i < 26; i++) rubble.fillRect(300 + Math.random() * 360, 330 + Math.random() * 110, 20 + Math.random() * 50, 10 + Math.random() * 30);
      const dark = this.add.rectangle(480, 250, 460, 300, 0x0a0a0a, 0).setDepth(39);
      await this.tween({ targets: dark, fillAlpha: 0.92, duration: 900 });
      for (let i = 0; i < 12; i++) {
        const smoke = this.add.circle(320 + Math.random() * 320, 380, 20 + Math.random() * 20, 0x777777, 0.6).setDepth(45);
        this.tween({ targets: smoke, y: 120, radius: 70, alpha: 0, duration: 2600 + Math.random() * 1200, delay: i * 120 });
      }
    }
    house.destroy();
    this.caption("THE PUDDING HOUSE HAS BEEN DESTROYED", "#ffe4ec", 28);
    await this.wait(1800);
    synth.stopMusic();
    const lukeX = this.add.sprite(860, 450, "spr_CRONGUS", 0).setScale(3).setDepth(80);
    lukeX.setAlpha(0);
    await this.tween({ targets: lukeX, alpha: 1, duration: 600 });
    await this.talk([
      dir("A small, dusty figure watches from the edge of the rubble. There is custard on his shoes."),
      say("CRONGUS", "…"),
      say("CRONGUS", G.s.player === "CRONGUS" ? `${leaker}. You absolute snake.` : `${leaker}. You absolute snake. I saw you in the bush.`),
    ]);
    G.s.flags.pudding_house_destroyed = true;
  }

  /**
   * Operation Custard Storm, shot by shot. The painted house is cut into chunks; every shell blows a hole in it
   * (chunks fly, the edges scorch, fires catch, the smoke builds), then what's left sags, buckles and falls in on
   * itself in a great cloud of dust, leaving a smoking heap.
   */
  private async puddingSiege(bg: Phaser.GameObjects.Image, tanks: Phaser.GameObjects.Image[]) {
    const cam = this.cameras.main;
    const calmF = !!G.meta.settings.calmFlash;
    const key = bg.texture.key;
    const tex = this.textures.get(key);
    const src = tex.getSourceImage() as { width: number; height: number };
    const sw = src.width;
    const sh = src.height;
    const s = bg.scaleX;
    const ox = 480 - (sw * s) / 2;
    const oy = 270 - (sh * s) / 2;
    const gSrc = Math.round(sh * 0.855); // where the building stops and the pavement starts
    const groundY = oy + gSrc * s;
    const frame = (nm: string, x: number, y: number, w: number, h: number) => {
      if (!tex.has(nm)) tex.add(nm, 0, x, y, w, h);
      return nm;
    };
    bg.setVisible(false);
    // what's behind it: the night skyline, then the burnt-out inside of the house
    if (this.textures.exists("bb_skyline")) {
      const sky = this.add.image(480, groundY, "bb_skyline").setOrigin(0.5, 1).setDepth(-14).setTint(0x6a5a8a);
      sky.setScale((groundY + 30) / sky.height);
    } else this.add.rectangle(480, groundY / 2, 960, groundY, 0x1a1830).setDepth(-14);
    const inner = this.add.image(480, oy + (gSrc * s) / 2, key, frame("pud_inner", 0, 0, sw, gSrc)).setScale(s).setDepth(-12).setTint(0x3a2418);
    this.add.image(480, oy + ((gSrc + sh) / 2) * s, key, frame("pud_ground", 0, gSrc, sw, sh - gSrc)).setScale(s).setDepth(-10);
    // the house, in chunks
    const COLS = 16;
    const ROWS = 8;
    type Chunk = { img: Phaser.GameObjects.Image; c: number; r: number; alive: boolean; heat: number };
    const chunks: Chunk[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const x0 = Math.round((c * sw) / COLS);
        const x1 = Math.round(((c + 1) * sw) / COLS);
        const y0 = Math.round((r * gSrc) / ROWS);
        const y1 = Math.round(((r + 1) * gSrc) / ROWS);
        const img = this.add.image(ox + ((x0 + x1) / 2) * s, oy + ((y0 + y1) / 2) * s, key, frame(`pud_${c}_${r}`, x0, y0, x1 - x0, y1 - y0)).setScale(s).setDepth(-9);
        chunks.push({ img, c, r, alive: true, heat: 0 });
      }
    const scorch = (k: Chunk) => k.img.setTint(Phaser.Display.Color.GetColor(Math.round(255 - k.heat * 190), Math.round(255 - k.heat * 205), Math.round(255 - k.heat * 215)));
    /** Thrown under gravity until it lands at landY. */
    const toss = (o: Phaser.GameObjects.Components.Transform, vx: number, vy: number, landY: number, spin: number, onLand?: () => void) => {
      const x0 = o.x;
      const y0 = o.y;
      const g = 1300;
      const disc = vy * vy + 2 * g * (landY - y0);
      const T = disc > 0 ? (-vy + Math.sqrt(disc)) / g : 0.4;
      const p = { t: 0 };
      this.tweens.add({ targets: p, t: T, duration: T * 1000, onUpdate: () => {
        o.x = x0 + vx * p.t;
        o.y = y0 + vy * p.t + 0.5 * g * p.t * p.t;
        o.angle += (spin * 16) / 1000;
      }, onComplete: () => onLand?.() });
    };
    /** Rubble height along the street: a heap, highest in the middle. */
    const heapH = (x: number) => 125 * Math.max(0, 1 - Math.abs(x - 480) / 360) ** 0.8;
    const heapY = (x: number) => groundY + 40 - heapH(x) * (0.5 + 0.5 * Math.random());
    const settle = (k: Chunk) => {
      k.img.setScale(s * 0.8).setDepth(30 + k.img.y / 100);
      k.heat = 0.35 + k.heat * 0.2;
      scorch(k);
    };
    const detach = (k: Chunk, tx: number, ty: number) => {
      k.alive = false;
      k.img.setDepth(45);
      const dx = k.img.x - tx;
      const dy = k.img.y - ty;
      const d = Math.max(20, Math.hypot(dx, dy));
      const sp = 260 + Math.random() * 320;
      toss(k.img, (dx / d) * sp + (Math.random() - 0.5) * 120, -200 - Math.random() * 300 + (dy / d) * 80, heapY(k.img.x + (dx / d) * 120), (Math.random() - 0.5) * 900, () => settle(k));
    };
    const decor: Phaser.GameObjects.GameObject[] = [];
    let shots = 0;
    const hit = (tx: number, ty: number) => {
      shots++;
      if (!this.boomAt(tx, ty, 1.5, 70))
        for (let k = 0; k < 3; k++) {
          const c = this.add.circle(tx + (Math.random() - 0.5) * 60, ty + (Math.random() - 0.5) * 60, 10, [0xffd23f, 0xff7a1a, 0xffffff][k], 0.95).setDepth(70);
          this.tween({ targets: c, radius: 70 + Math.random() * 50, alpha: 0, duration: 600 + k * 150 });
        }
      synth.play("explode");
      if (shots % 3 === 0) synth.play("smash");
      cam.shake(300, 0.02);
      const R = 62 + Math.random() * 26;
      for (const k of chunks) {
        if (!k.alive) continue;
        const d = Math.hypot(k.img.x - tx, k.img.y - ty);
        if (d < R * (0.75 + Math.random() * 0.45)) detach(k, tx, ty);
        else if (d < R * 2.1) {
          k.heat = Math.min(1, k.heat + (1 - d / (R * 2.1)) * 0.75);
          scorch(k);
        }
      }
      // brick and plaster
      for (let i = 0; i < 12; i++) {
        const b = this.add.rectangle(tx, ty, 3 + Math.random() * 8, 3 + Math.random() * 6, [0x6b4f3a, 0x3f3f46, 0x8a7a64, 0xf5e6c8][i % 4]).setDepth(46);
        toss(b, (Math.random() - 0.5) * 700, -150 - Math.random() * 400, heapY(tx) + 6, (Math.random() - 0.5) * 1400);
      }
      // the edges of the hole glow
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = this.add.circle(tx + Math.cos(a) * R * 0.8, ty + Math.sin(a) * R * 0.7, 2 + Math.random() * 3, 0xff8a1a, 0.95).setDepth(-8);
        this.tweens.add({ targets: e, alpha: 0.35, yoyo: true, repeat: -1, duration: 160 + Math.random() * 240 });
        decor.push(e);
      }
      // fires catch, the smoke builds
      if (shots % 2 === 0) decor.push(this.fireBlob(tx, ty + 20, 26 + shots * 1.5, -8));
      if (shots % 4 === 1) {
        const col = vfx(this, "vfx_smokecol", tx, ty, { scale: 1.6 + shots * 0.08, depth: -8, alpha: 0.85 });
        if (col) decor.push(col);
      }
    };
    // ---- the barrage
    for (let volley = 0; volley < 4; volley++) {
      for (const t of tanks) {
        const sx = t.x + 70;
        const sy = t.y - 20;
        vfx(this, "vfx_muzzle", sx, sy, { scale: 1.6, depth: 61, add: true });
        const shell = this.add.ellipse(sx, sy, 12, 6, 0xfff1a8).setDepth(60);
        const trail = this.add.rectangle(sx, sy, 30, 2, 0xfff1a8, 0.6).setOrigin(1, 0.5).setDepth(60);
        this.tween({ targets: t, x: t.x - 12, duration: 80, yoyo: true });
        // aim for what's still standing
        const standing = chunks.filter((k) => k.alive && k.c >= 2 && k.c <= 13);
        const aim = standing.length ? standing[Math.floor(Math.random() * standing.length)].img : null;
        const tx = (aim?.x ?? 380 + Math.random() * 200) + (Math.random() - 0.5) * 30;
        const ty = (aim?.y ?? 200 + Math.random() * 180) + (Math.random() - 0.5) * 30;
        const ang = Math.atan2(ty - sy, tx - sx);
        shell.setRotation(ang);
        trail.setRotation(ang);
        await this.tween({ targets: [shell, trail], x: tx, y: ty, duration: 240 });
        shell.destroy();
        trail.destroy();
        hit(tx, ty);
      }
      await this.wait(volley === 3 ? 700 : 300);
    }
    // ---- it goes: a groan, a sag, a buckle…
    const standing = chunks.filter((k) => k.alive);
    synth.play("thunder");
    cam.shake(1100, 0.005);
    for (const k of standing) this.tweens.add({ targets: k.img, x: k.img.x + (Math.random() < 0.5 ? -1.5 : 1.5), yoyo: true, repeat: 6, duration: 55 });
    await this.wait(600);
    synth.play("smash");
    for (const k of standing) {
      const lean = (480 - k.img.x) * 0.05;
      this.tweens.add({ targets: k.img, x: k.img.x + lean, y: k.img.y + (ROWS - k.r) * 4 + 8, angle: (k.c < COLS / 2 ? 1 : -1) * (1 + Math.random() * 5), duration: 800, ease: "Sine.in" });
    }
    this.tweens.add({ targets: inner, y: inner.y + 24, duration: 800, ease: "Sine.in" });
    await this.wait(850);
    // …and down it comes, into itself
    if (!calmF) cam.flash(180, 255, 220, 170);
    cam.shake(2000, 0.03);
    synth.play("explode");
    synth.play("boom");
    this.time.delayedCall(500, () => synth.play("thunder"));
    this.time.delayedCall(900, () => synth.play("smash"));
    for (const o of decor) o.destroy();
    // the inside sinks into the ground (cropped at the ground line as it goes)
    const sink = { d: 0 };
    const innerY0 = oy + (gSrc * s) / 2;
    this.tweens.add({ targets: sink, d: gSrc * s, duration: 1500, ease: "Quad.in", onUpdate: () => {
      inner.y = innerY0 + sink.d;
      inner.setCrop(0, 0, sw, Math.max(0, gSrc - sink.d / s));
    } });
    let landed = 0;
    for (const k of standing) {
      k.alive = false;
      const mid = Math.abs(k.c - (COLS - 1) / 2) / ((COLS - 1) / 2);
      const delay = mid * 380 + (ROWS - 1 - k.r) * 30 + Math.random() * 90;
      const tx = k.img.x + (480 - k.img.x) * 0.3 + (Math.random() - 0.5) * 40;
      const ty = heapY(tx);
      const dist = Math.max(10, ty - k.img.y);
      this.tweens.add({ targets: k.img, x: tx, y: ty, angle: k.img.angle + (Math.random() - 0.5) * 220, duration: 420 + Math.sqrt(dist) * 38, delay, ease: "Quad.in", onStart: () => k.img.setDepth(44), onComplete: () => {
        settle(k);
        if (landed++ % 9 === 0) vfx(this, "vfx_dust", tx, ty, { scale: 1.6, depth: 47 });
      } });
    }
    // the dust: it billows up and rolls out along the street
    this.time.delayedCall(450, () => {
      vfx(this, "vfx_blastsmoke", 480, groundY + 30, { scale: 3.6, depth: 48 });
      for (let i = 0; i < 8; i++) vfx(this, "vfx_dust", 480 + (i % 2 ? 1 : -1) * (40 + i * 45), groundY + 20, { scale: 2.6, depth: 48, delay: i * 90 });
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? 1 : -1;
        const d = this.add.circle(480 + side * Math.random() * 160, groundY + 10 - Math.random() * 60, 24 + Math.random() * 20, [0x8a8070, 0x6b6458, 0xa39886][i % 3], 0.85).setDepth(47);
        this.tweens.add({ targets: d, x: d.x + side * (220 + Math.random() * 260), y: d.y - 40 - Math.random() * 160, radius: 80 + Math.random() * 60, alpha: 0, duration: 2600 + Math.random() * 1600, ease: "Sine.out" });
      }
    });
    await this.wait(2400);
    // what's left: a smoking heap, still burning
    for (let i = 0; i < 3; i++) this.fireBlob(400 + i * 80, groundY + 40 - heapH(400 + i * 80) * 0.9, 34, 41);
    for (let i = 0; i < 4; i++) vfx(this, "vfx_smokecol", 320 + i * 110, groundY + 40 - heapH(320 + i * 110) * 0.85, { scale: 2 + Math.random(), depth: 40, alpha: 0.8, delay: i * 200 });
    for (let i = 0; i < 14; i++) {
      const ex = 300 + Math.random() * 360;
      const e = this.add.circle(ex, heapY(ex), 2, 0xff8a1a).setDepth(42);
      this.tweens.add({ targets: e, alpha: 0.2, yoyo: true, repeat: -1, duration: 200 + Math.random() * 300 });
    }
  }

  // ---------------------------------------------------------------- ROBBO

  private async flatmate() {
    if (!backdrop(this, "bg_flat", { depth: -10 })) {
      this.add.tileSprite(0, 0, 960, 540, "tile_mansion").setOrigin(0);
      this.add.rectangle(480, 470, 900, 120, 0x7a1f2b, 0.85);
      this.add.text(480, 470, "(the carpet)", { fontFamily: FONT, fontSize: "12px", color: "#d6c49a" }).setOrigin(0.5);
    }
    const kev = this.add.sprite(640, 360, "boss_flatmate", 0).setScale(3).setDepth(10);
    const gron = this.add.sprite(260, 360, "spr_GRONNY", 0).setScale(4).setDepth(10);
    await this.talk([say("ROBBO", "Gronny, mate. Let's talk about this. The deposit's coming. I've got a guy."), say("GRONNY", "…", { cine: "scratch;cut|ss_cut_gronny|left|0xef4444|1500" }), this.cue("THE CARPET HAS BEEN AVENGED IN SIX PARTS", true)]);
    // the gore (cartoon, off with the gore setting): sprays, chunks and pools that stay on the carpet
    const gore = G.meta.settings.gore !== false;
    const bleed = (x: number, y: number, big = 1) => {
      if (!gore) return;
      synth.play(Math.random() < 0.5 ? "splat" : "squelch");
      vfx(this, "vfx_bloodspray", x, y, { scale: 1.6 * big, depth: 14, flipX: Math.random() < 0.5 });
      vfx(this, "vfx_blood", x + (Math.random() - 0.5) * 50, y + 10, { scale: 1.3 * big, depth: 14, delay: 90 });
    };
    const gib = (x: number, y: number, n = 4) => {
      if (!gore) return;
      synth.play("bonecrack");
      vfxScatter(this, "vfx_gore", x, y, n, 70, { scale: 1.5, depth: 14 }, 60);
    };
    const pool = (x: number, w = 1) => gore && vfx(this, "vfx_bloodpool", x, 452, { scale: 2 * w, depth: 9, hold: true, delay: 150 });
    const hit = async (label: string, fx: () => Promise<void>) => {
      this.caption(label, "#ffd23f", 26);
      await fx();
      await this.wait(500);
      this.children.list.filter((o) => o instanceof Phaser.GameObjects.Text && (o as Phaser.GameObjects.Text).text === label).forEach((o) => o.destroy());
    };
    await hit("PART 1: THE LEAF BLOWER", async () => {
      const blow = this.add.rectangle(320, 360, 80, 14, 0x111111).setDepth(11);
      synth.play("wonk");
      for (let i = 0; i < 12; i++) {
        const l = this.add.circle(340 + i * 20, 350 + Math.sin(i) * 10, 4, 0xb58b00).setDepth(12);
        this.tween({ targets: l, x: l.x + 300, alpha: 0, duration: 500 });
      }
      await this.tween({ targets: kev, x: 900, angle: 720, duration: 700 });
      synth.play("smash");
      this.cameras.main.shake(300, 0.02);
      kev.setScale(3, 1.2).setX(890);
      // into the wall face first: a red smear where he hit, and a trail down to the skirting
      bleed(900, 330, 1.3);
      if (gore) vfx(this, "vfx_bloodpool", 905, 330, { scale: 1.8, depth: 9, hold: true, angle: 90 });
      if (gore) kev.setTint(0xffb0b0);
      blow.destroy();
      await this.wait(400);
      kev.setScale(3);
      await this.tween({ targets: kev, x: 640, angle: 0, duration: 400 });
    });
    await hit("PART 2: AN ANVIL (MADE OF UNPAID RENT)", async () => {
      const anvil = this.textures.exists("p_anvil") ? this.add.image(640, -40, "p_anvil").setScale(1.5).setDepth(12) : this.add.rectangle(640, -40, 70, 40, 0x4b5563).setDepth(12);
      if (!this.textures.exists("p_anvil")) this.add.text(640, -40, "RENT", { fontFamily: FONT, fontSize: "12px", color: "#fff" }).setOrigin(0.5).setDepth(13);
      await this.tween({ targets: anvil, y: 320, duration: 500, ease: "Quad.in" });
      synth.play("banhammer");
      kev.setScale(4, 0.6);
      // squashed flat: everything that was inside him comes out of the sides
      bleed(600, 380, 1.6);
      bleed(690, 380, 1.4);
      gib(640, 370, 6);
      pool(640, 1.3);
      this.cameras.main.shake(350, 0.025);
      await this.wait(500);
      anvil.destroy();
      await this.tween({ targets: kev, scaleX: 3, scaleY: 3, duration: 300, ease: "Back.out" });
    });
    await hit("PART 3: RUNESCAPE SPECIAL ATTACK", async () => {
      for (let i = 0; i < 4; i++) {
        await this.wait(250);
        synth.play("crit");
        bleed(620 + i * 15, 330 - i * 12, 0.9);
        if (i === 3) gib(640, 330, 3);
        const t = this.add.text(600 + i * 25, 300 - i * 20, "99", { fontFamily: FONT, fontSize: "30px", color: "#ff2a2a", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setDepth(20);
        this.tween({ targets: t, y: t.y - 40, alpha: 0, duration: 900 });
        kev.setTintFill(0xffffff);
        this.time.delayedCall(80, () => kev.clearTint());
      }
    });
    await hit("PART 4: A PIANO (OUT OF TUNE)", async () => {
      const piano = this.textures.exists("p_piano") ? this.add.image(640, -60, "p_piano").setScale(1.4).setDepth(12) : this.add.rectangle(640, -60, 120, 80, 0x111111).setDepth(12);
      await this.tween({ targets: piano, y: 330, duration: 600, ease: "Quad.in" });
      synth.play("boom");
      for (let i = 0; i < 8; i++) synth.play("select");
      piano.destroy();
      kev.setAngle(90);
      // the keys come up red
      bleed(640, 350, 1.8);
      gib(640, 360, 7);
      pool(640, 1.7);
      if (gore) kev.setTint(0xff7070);
      this.cameras.main.shake(400, 0.03);
      this.add.text(640, 260, "♪ ♫ ♪", { fontFamily: FONT, fontSize: "26px", color: "#ffffff" }).setOrigin(0.5).setDepth(20);
      await this.wait(500);
    });
    await hit("PART 5: ROLLED UP IN THE CARPET", async () => {
      kev.setVisible(false);
      const roll = this.textures.exists("p_carpet_roll") ? this.add.image(640, 380, "p_carpet_roll").setScale(1.3).setDepth(12) : this.add.rectangle(640, 380, 160, 50, 0x7a1f2b).setStrokeStyle(4, 0xd6c49a).setDepth(12);
      this.add.text(640, 380, "robbo (inside)", { fontFamily: FONT, fontSize: "11px", color: "#d6c49a" }).setOrigin(0.5).setDepth(13);
      // it's soaking through
      if (gore) {
        if (roll instanceof Phaser.GameObjects.Image) roll.setTint(0xd04040);
        pool(640, 2.2);
        synth.play("squelch");
      }
      await this.wait(600);
      const drip = gore ? this.time.addEvent({ delay: 110, loop: true, callback: () => vfx(this, "vfx_blood", (roll as Phaser.GameObjects.Image).x, (roll as Phaser.GameObjects.Image).y + 20, { scale: 0.9, depth: 11 }) }) : null;
      await this.tween({ targets: roll, x: 1100, y: -100, angle: 1080, duration: 1400, ease: "Quad.out" });
      drip?.remove();
      const star = this.add.text(930, 30, "✦", { fontFamily: FONT, fontSize: "26px", color: "#ffffff" }).setDepth(20);
      synth.play("ding");
      await this.tween({ targets: star, scale: 2, alpha: 0, duration: 800 });
    });
    await hit("PART 6: CLOSURE", async () => {
      gron.setFrame(3);
      await this.wait(600);
    });
    this.caption("FATALITY (CARPET)", "#ff4d4d", 36);
    synth.play("roar");
    await this.wait(1200);
    await this.talk([
      say("GRONNY", "Fair enough."),
      dir(gore ? "Somewhere over the horizon, what's left of Robbo lands in Kreddle: alive (medically, just), embarrassed, several pints lighter, and permanently rolled in a ruined carpet. He Venmos you the deposit the next morning. With interest." : "Somewhere over the horizon, Robbo lands in Kreddle, alive, embarrassed, and permanently rolled in a ruined carpet. He Venmos you the deposit the next morning. With interest."),
      ...(gore ? [dir("Your carpet, for the record, is now considerably worse.")] : []),
      dir("The carpet is avenged.", { cineAfter: "sting|ss_sting_title;slam|CARPET: AVENGED|#ffd23f|56;wait|1000" }),
    ]);
  }

  private cue(t: string, isDir = true): Line {
    return isDir ? dir(t) : say("NARRATOR", t);
  }

  // ---------------------------------------------------------------- CHAD DELTOID

  private async rival() {
    if (!backdrop(this, "bg_gym", { depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_industrial").setOrigin(0);
    const brick = this.add.sprite(480, 380, "boss_rival", 0).setScale(3.2).setDepth(10);
    const bar = this.add.image(480, 300, "p_barbell").setScale(3).setDepth(11);
    this.add.sprite(200, 380, "spr_KREZWONK", 0).setScale(4).setDepth(10);
    await this.talk([
      say("CHAD DELTOID", "You think you beat me? I'll show you. FIVE HUNDRED. Overhead. Right now."),
      say("KREZWONK", "Let me help you load the bar."),
      dir("You add a plate. Then another. Then you keep adding plates. Chad is too proud to stop you."),
    ]);
    for (let i = 0; i < 6; i++) {
      const plate = this.add.rectangle(i % 2 ? 610 + Math.floor(i / 2) * 12 : 350 - Math.floor(i / 2) * 12, 300, 10, 60, 0x111111).setDepth(12);
      synth.play("select");
      await this.tween({ targets: plate, scaleY: 1.2, yoyo: true, duration: 120 });
    }
    this.caption("700KG", "#ffd23f", 30);
    await this.wait(700);
    await this.tween({ targets: bar, y: 250, duration: 900, ease: "Sine.out" });
    await this.talk([say("CHAD DELTOID", "EASY. EASY. I'M NOT EVEN—"), say("KREZWONK", "I foresee you dropping it.", { cineAfter: "freeze|700 KG." })]);
    synth.play("banhammer");
    this.cameras.main.shake(800, 0.03);
    await this.tween({ targets: bar, y: 370, duration: 250, ease: "Quad.in" });
    brick.setScale(5, 0.35).setY(400);
    this.caption("RE-RACKED. PERMANENTLY.", "#ff4d4d", 30);
    await this.wait(1500);
    await this.talk([
      dir("Chad Deltoid has been flattened into a perfect, gym-floor-shaped pancake. Cartoon birds circle where his head used to be.", { cine: "impact;still|ss_still_rival|2600" }),
      say("KREZWONK", "I foresaw this. I elected not to prevent it.", { cineAfter: "sting|biglaugh" }),
      dir("The gym erupts in applause. For the first time in Krunch Gym's history, every weight is re-racked."),
    ]);
  }

  // ---------------------------------------------------------------- CUDDLE CRONSTER PRESS CONFERENCE

  private async pressConference() {
    if (!backdrop(this, "bg_press", { depth: -10 })) {
      this.add.rectangle(480, 270, 960, 540, 0x1e2a44);
      this.add.rectangle(480, 120, 700, 120, 0x1e3a8a).setStrokeStyle(4, 0xfacc15);
    }
    this.add.text(480, 60, "KRELFORD CONSTABULARY · PRESS CONFERENCE", { fontFamily: FONT, fontSize: "20px", color: "#ffffff", fontStyle: "bold", align: "center", backgroundColor: "#1e3a8acc", padding: { x: 10, y: 4 } }).setOrigin(0.5);
    this.add.rectangle(480, 330, 120, 90, 0x5a3a20).setDepth(20);
    const swig = this.add.sprite(480, 280, "npc_swig", 0).setScale(3).setDepth(15);
    const press: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < 9; i++) {
      const tex = i === 4 ? "npc_journo" : `spr_FOLK${i % 4}`;
      press.push(this.add.sprite(110 + i * 92, 470 + (i % 2) * 14, tex, 0).setScale(tex === "npc_journo" ? 1.6 : 2.6).setDepth(30 + i));
    }
    synth.music("ominous");
    // front page first: who the Cuddle Cronster is
    const paper = this.add.container(480, 270).setDepth(200);
    paper.add(this.add.rectangle(0, 0, 760, 420, 0xf4ecd8).setStrokeStyle(4, 0x1f1f1f));
    paper.add(this.add.text(0, -180, "THE KRELFORD KRONICLE", { fontFamily: "Georgia, serif", fontSize: "30px", color: "#111", fontStyle: "bold" }).setOrigin(0.5));
    paper.add(this.add.rectangle(0, -155, 700, 3, 0x111111));
    paper.add(this.add.text(0, -110, "TERROR GRIPS KRELFORD AS THE\n\u201cCUDDLE CRONSTER\u201d STRIKES AGAIN", { fontFamily: "Georgia, serif", fontSize: "28px", color: "#7f1d1d", fontStyle: "bold", align: "center" }).setOrigin(0.5));
    paper.add(this.add.text(0, -20, "\u201cI'll cuddle you, squeeze you, and extract all your lovely juices\u201d  \u263a", { fontFamily: "Comic Sans MS, cursive", fontSize: "20px", color: "#be185d", align: "center", wordWrap: { width: 640 } }).setOrigin(0.5));
    if (this.textures.exists("p_token")) paper.add(this.add.image(-250, 110, "p_token").setDisplaySize(90, 90));
    paper.add(this.add.text(40, 110, "Cuddle token found at the scene.\nMotto: \u201cSweet hugs, sweeter squeezes.\u201d", { fontFamily: "Georgia, serif", fontSize: "18px", color: "#111", align: "center" }).setOrigin(0.5));
    paper.setScale(0.2).setAngle(-540);
    await this.tween({ targets: paper, scale: 1, angle: 0, duration: 700, ease: "Back.easeOut" });
    synth.play("smash");
    await this.talk([
      say("NEWSREADER", "Krelford is once again in the icy grip of terror as the elusive criminal known only as the \"Cuddle Cronster\" continues his reign of bizarre and unsettling crimes."),
      say("NEWSREADER", "The latest victim, identified only as a local woman from the outskirts of town, discovered a cryptic note in her home. Written in disturbingly cheery handwriting, it read:"),
      say("NEWSREADER", "\"I'll cuddle you, squeeze you, and extract all your lovely juices.\""),
      say("NEWSREADER", "The note was signed with an unsettlingly cheerful smiley face and accompanied by one of the Cronster's infamous edible \"cuddle tokens\" – intricate chocolate coins that bear his terrifying motto: \"Sweet hugs, sweeter squeezes.\""),
      dir("POLICE HOLD CHAOTIC PRESS CONFERENCE"),
    ]);
    await this.tween({ targets: paper, y: 800, angle: 12, duration: 500, ease: "Quad.easeIn" });
    paper.destroy();
    // an occasional press camera flash, not a strobe
    const flashes = this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        const p = press[Math.floor(Math.random() * press.length)];
        const f = this.add.circle(p.x + 10, p.y - 30, 14, 0xffffff, 0.9).setDepth(80);
        this.tween({ targets: f, alpha: 0, scale: 2.5, duration: 220 }).then(() => f.destroy());
      },
    });
    await this.talk([
      dir("In a hastily organised press conference earlier today, Sergeant Grimbolus Swig, the lead investigator on the case, addresses the growing panic in Krelford. He stands before a tense room filled with journalists."),
      say("SERGEANT SWIG", "Krelford. Please. Remain calm. The situation is under control."),
      dir("He attempts to downplay the Cronster's activities. However, things quickly unravel when he begins discussing the chocolate tokens left behind by the criminal."),
    ]);
    flashes.remove();
    const drool = this.add.text(500, 262, "💧", { fontSize: "18px" }).setDepth(16);
    this.tweens.add({ targets: drool, y: 300, alpha: 0, duration: 900, repeat: -1 });
    await this.talk([
      dir("He begins salivating. Then drooling."),
      say("SERGEANT SWIG", "We've got to find them all!"),
      dir("His eyes gleam with excitement."),
      say("SERGEANT SWIG", "There are several different flavors I've yet to try—dark choccy, mint choccy, caramel choccy, even that fancy ruby choccy! Honestly, it's the real treasure in all this!"),
      dir("The crowd of reporters stares in stunned silence. Then a female journalist bravely asks the question on everyone's mind."),
      say("JOURNALIST", "Why are you more interested in the tokens than in apprehending the Cuddle Cronster?"),
      dir("Sergeant Swig pauses, visibly annoyed."),
      say("SERGEANT SWIG", "I'm sorry, did anyone else hear that incomprehensible high-pitched screeching, squawking noise?"),
    ]);
    synth.play("laugh");
    for (const p of press) {
      const t = this.add.text(p.x, p.y - 60, ["BOOO", "SHAME", "BOOOO", "OI"][Math.floor(Math.random() * 4)], { fontFamily: FONT, fontSize: "16px", color: "#ff6b6b", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(60);
      this.tween({ targets: t, y: t.y - 30, alpha: 0, duration: 1200 });
    }
    await this.talk([dir("His dismissive remark is met with an immediate chorus of boos and jeers from the press."), say("SERGEANT SWIG", "Oh, fuck off!")]);
    swig.setFrame(3);
    this.caption("BANG BANG BANG", "#ffd23f", 34);
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 160, () => {
        synth.play("shoot");
        this.cameras.main.shake(100, 0.01);
        const target = press[Math.floor(Math.random() * press.length)];
        const fl = this.add.circle(510, 300, 10, 0xffd23f).setDepth(40);
        this.tween({ targets: fl, x: target.x, y: target.y - 20, duration: 120 }).then(() => fl.destroy());
      });
    }
    press.forEach((p, i) => this.time.delayedCall(200 + i * 60, () => void this.tween({ targets: p, x: i % 2 ? p.x + 600 : p.x - 600, duration: 1400 })));
    await this.wait(2000);
    synth.stopMusic();
    await this.talk([
      dir("He pulls out his sidearm and fires indiscriminately into the audience. Journalists dive under chairs, behind cameras, and in one case into a bin."),
      dir("CHAOS AND CONTROVERSY"),
      say("NEWSREADER", "Many are now questioning the competence of law enforcement to handle the case."),
      say("NEWSREADER", "Meanwhile, experts warn that the Cronster's chocolate tokens—though delicious—may serve a sinister purpose. Dr. Grungus Florp, a leading criminal psychologist, believes the tokens are a psychological tool designed to distract and disarm investigators."),
      say("DR. GRUNGUS FLORP", "The Cuddle Cronster is a master manipulator. By combining his grotesque threats with sweet, irresistible treats, he's playing a twisted game with the authorities. And clearly, it's working."),
      dir("A COMMUNITY ON EDGE"),
      say("NEWSREADER", "As the hunt for the Cuddle Cronster continues, Krelford residents remain on high alert. Citizens have been urged to report any suspicious activity and to avoid consuming any chocolate tokens they may find—no matter how tempting."),
      say("NEWSREADER", "But as tensions rise and trust in law enforcement plummets, one question remains: will the Cuddle Cronster be stopped before he strikes again? Or will Krelford continue to spiral into fear, chaos, and chocolate-fueled madness?"),
      say("NEWSREADER", "For now, the Cuddle Cronster roams free, leaving only his disturbing notes and sweet, sinister tokens in his wake."),
      say("SERGEANT SWIG", "(quietly, to you, reloading) Find the tokens. Bring them to me. For evidence."),
      dir("NEW OBJECTIVE: find six chocolate cuddle tokens around Krelford. They glow pink."),
    ]);
  }

  // ---------------------------------------------------------------- POLSON GETS FIT

  private async polsonGym() {
    if (!backdrop(this, "bg_gym", { depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_industrial").setOrigin(0);
    const hasTm = this.textures.exists("p_treadmill");
    const tm = this.add.rectangle(480, 400, 220, 30, 0x111111, hasTm ? 0 : 1).setDepth(5);
    if (hasTm) this.add.image(500, 410, "p_treadmill").setOrigin(0.5, 1).setScale(1.5).setDepth(5);
    else {
      this.add.rectangle(560, 340, 12, 100, 0x374151).setDepth(5);
      this.add.text(480, 300, "TREADMILL", { fontFamily: FONT, fontSize: "12px", color: "#fff" }).setOrigin(0.5);
    }
    const pol = this.add.sprite(200, 380, "spr_POLSON", 0).setScale(3).setDepth(10);
    const me = this.add.sprite(120, 390, playerKey(this), 0).setScale(3).setDepth(10);
    synth.music("hub");
    await this.talk([
      dir("Krunch Gym. You have taken Polson for 'an intense workout'. He is wearing brand new trainers, brand new shorts and a headband. The tags are still on all of them."),
      say("POLSON", "Tonight's the night!! Intense workout!!", { cine: "sting|ss_sting_title;card|POLSON GETS FIT|KRUNCH GYM|SESSION 1|1300" }),
      say("POLSON", "Make no mistake.. I want to be a monster. A great hulking monster 😅"),
    ]);
    await this.tween({ targets: pol, x: 470, y: 370, duration: 900 });
    synth.play("select");
    const belt = this.time.addEvent({ delay: 80, loop: true, callback: () => tm.setFillStyle(tm.fillColor === 0x111111 ? 0x222222 : 0x111111) });
    this.time.addEvent({ delay: 100, repeat: 18, callback: () => animateWalker(pol, 1, -0.3, true, this.time.now) });
    const clock = this.add.text(480, 250, "0.0s", { fontFamily: FONT, fontSize: "28px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(50);
    const t0 = this.time.now;
    const tick = this.time.addEvent({ delay: 50, loop: true, callback: () => clock.setText(`${((this.time.now - t0) / 1000).toFixed(1)}s`) });
    await this.wait(2000);
    tick.remove();
    belt.remove();
    clock.setText("2.0s");
    await this.tween({ targets: pol, x: 620, y: 380, duration: 300 });
    pol.setFrame(0);
    await this.talk([
      say("POLSON", "WAHAHAHA", { cine: "freeze|TIME ON TREADMILL: 2.0 SECONDS" }),
      say("POLSON", "That's great for the core!! Thoughts?"),
      say(G.s.player, "That was two seconds."),
      say("POLSON", "Two seconds of pure core my lord!!"),
      say("POLSON", "Another day, another gym sesh done!! In other news.. I'm starving 😅 Restaurant?"),
    ]);
    // restaurant
    this.clearStage();
    this.lastCaption = undefined;
    if (!backdrop(this, "bg_restaurant", { depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_pub").setOrigin(0);
    if (!this.textures.exists("bg_restaurant")) this.add.rectangle(480, 380, 520, 60, 0x7a5230).setDepth(5);
    this.add.text(480, 80, "🍔 KREZ-KING BURGERS & PIZZA & FUDGE 🍕", { fontFamily: FONT, fontSize: "22px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5);
    const pol2 = this.add.sprite(420, 320, "spr_POLSON", 0).setScale(3).setDepth(10);
    this.add.sprite(560, 320, playerKey(this), 0).setScale(3).setDepth(10);
    void me;
    await this.talk([
      say("POLSON", "Four burgers please!! Double. Large pizza, meat feast, extra cheese, stuffed crust. And extra fudge!😝"),
      say("WAITER", "All of it?"),
      say("POLSON", "It's bulking food!! Great bulking food. All I need is a fuck load of protein 😅"),
    ]);
    await this.bulkPolson(pol2);
    await this.talk([
      say("POLSON", "BULKED!! YES YES YES", { cine: "speed|0xffd23f;cut|ss_cut_polson_grin|left|0xffd23f|1100" }),
      dir("Polson is now noticeably, structurally larger. His t-shirt has given up. The chair has given up."),
      say("POLSON", "Same time tomorrow? Intense workout then here!! Wbu?"),
      dir("You pay. Obviously you pay. Polson 'left his wallet in his gym bag', which he did not bring."),
      ping("POLSON'S MUM", "Did you let him eat fudge", { cine: "scratch;wait|300;cut|ss_cut_mum|right|0xef4444|1400" }),
      ping("POLSON'S MUM", "He's meant to be getting trim. His health is YOUR responsibility. The GUMPTION of you to do this to my autistic son.", { cineAfter: "impact;slam|GUMPTION|#ef4444|72;wait|1100" }),
    ]);
    synth.stopMusic();
  }

  private async polsonCctv() {
    if (!backdrop(this, "bg_fgm", { dim: 0.75, depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x0a0f1a);
    // four CCTV feeds; feed 1 is Polson's living room
    const feeds: [number, number, string][] = [
      [250, 150, "CAM 1 — POLSON TOWERS: LOUNGE"],
      [710, 150, "CAM 2 — KRUNCH GYM: FRONT DESK"],
      [250, 380, "CAM 3 — POLSON TOWERS: FRIDGE"],
      [710, 380, "CAM 4 — KRUNCH GYM: TREADMILLS"],
    ];
    for (const [x, y, l] of feeds) {
      this.add.rectangle(x, y, 420, 200, 0x1f2937).setStrokeStyle(3, 0x22c55e);
      this.add.text(x - 200, y - 96, l, { fontFamily: "monospace", fontSize: "11px", color: "#22c55e" });
    }
    const rec = this.add.text(20, 510, "● REC   FGM WAR ROOM — OPERATION GAINS", { fontFamily: "monospace", fontSize: "13px", color: "#ef4444" });
    this.tweens.add({ targets: rec, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 });
    const clock = this.add.text(940, 510, "", { fontFamily: "monospace", fontSize: "13px", color: "#22c55e" }).setOrigin(1, 0);
    let mins = 0;
    this.time.addEvent({ delay: 120, loop: true, callback: () => { mins += 3; clock.setText(`${String(14 + Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`); } });
    const sofa = this.textures.exists("p_sofa") ? this.add.image(250, 196, "p_sofa").setScale(1.1) : this.add.rectangle(250, 190, 160, 40, 0x7a1f2b);
    void sofa;
    const pol = this.add.sprite(250, 160, "spr_POLSON", 0).setScale(2.4);
    this.add.image(330, 200, "p_food").setScale(1.2);
    this.add.text(710, 150, "(nobody)", { fontFamily: FONT, fontSize: "14px", color: "#6b7280" }).setOrigin(0.5);
    this.add.text(710, 380, "(empty treadmill)", { fontFamily: FONT, fontSize: "14px", color: "#6b7280" }).setOrigin(0.5);
    this.add.image(250, 380, "p_fridge").setScale(2);
    synth.music("ominous");
    this.time.addEvent({ delay: 500, loop: true, callback: () => !pol.getData("wonking") && pol.setFrame(String(pol.frame.name) === "3" ? 0 : 3) });
    await this.talk([
      dir("14:00. Polson's message: 'At the gym 💪'. CAM 1: Polson is on the sofa. CAM 2: Polson is not at the gym."),
      ping("POLSON", "Leg day today!! Brutal 😅", { cineAfter: "freeze|LEGS WORKED TODAY: 0" }),
      dir("CAM 1: Polson opens a family-size bag of crisps with both hands."),
    ]);
    await this.tween({ targets: pol, x: 250, y: 360, duration: 900 });
    await this.talk([dir("CAM 3: Polson at the fridge. He eats cheese directly from the block. He looks over his shoulder. He eats more cheese."), ping("POLSON", "Just finished my sets!! Pumped 💪 Wbu?")]);
    await this.tween({ targets: pol, y: 160, duration: 900 });
    await this.talk([
      dir("16:30. CAM 1: Polson is asleep on the sofa, holding a slice of pizza like a teddy bear."),
      ping("POLSON", "3 hours done!! Absolutely destroyed. Who even spends 3 hours in a fucking gym? Me apparently 😝", { cineAfter: "freeze|HOURS AT THE GYM: 0. HOURS ASLEEP WITH PIZZA: 2.5" }),
    ]);
    // 17:10: he wakes up. Something is coming.
    await this.cctvFarts(pol);
    // 18:40: the phone comes out
    await this.cctvWonk(pol);
    await this.talk([
      say("MIKEY", "(over the War Room comms) FGM to base. Subject has not left the house. Repeat, subject has not left the house. Subject has, however, eaten an entire fudge. And done… that. Twice, if you count the farts."),
    ]);
    synth.stopMusic();
  }


  /** Polson at his current (permanent) size. */
  private fatPolson(x: number, y: number, base = 3) {
    const f = Math.min(60, (G.s.flags.polson_fat as number) ?? 0);
    // the sheet runs from his usual self to enormous; past its biggest belly he stays enormous
    if (this.textures.exists("spr_POLSON_FAT")) return this.add.sprite(x, y, "spr_POLSON_FAT", Polson.bellyFrame(f)).setScale(base).setDepth(10);
    const k = 1 + f * 0.04;
    return this.add.sprite(x, y, "spr_POLSON", 0).setScale(base * k, base * (1 + (k - 1) * 0.2)).setDepth(10);
  }

  private async polsonGym2() {
    if (!backdrop(this, "bg_gym", { depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_industrial").setOrigin(0);
    G.s.flags.polson_fat = Math.max(10, (G.s.flags.polson_fat as number) ?? 0);
    // the turnstile
    const post1 = this.add.rectangle(440, 360, 14, 110, 0x9ca3af).setDepth(12);
    const post2 = this.add.rectangle(520, 360, 14, 110, 0x9ca3af).setDepth(12);
    this.add.text(480, 290, "KRUNCH GYM — MEMBERS ONLY", { fontFamily: FONT, fontSize: "12px", color: "#ffd23f", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(12);
    const pol = this.fatPolson(300, 380);
    const me = this.add.sprite(160, 390, playerKey(this), 0).setScale(3).setDepth(10);
    synth.music("hub");
    await this.talk([
      dir("Krunch Gym. Again. Polson is wearing the same headband. The headband is now under considerable tension.", { cine: "sting|ss_sting_title;card|POLSON GETS FIT|KRUNCH GYM|SESSION 2|1300" }),
      say("POLSON", "I've been bulking!! Thoughts? Be honest 😅"),
      say(G.s.player, "That's mostly fudge."),
      say("POLSON", "To be fair fudge is great bulking food!"),
    ]);
    await this.tween({ targets: pol, x: 480, duration: 900 });
    synth.play("hit");
    this.cameras.main.shake(200, 0.006);
    await this.talk([dir("Polson enters the turnstile. Polson does not exit the turnstile.", { cine: "scratch;still|ss_still_turnstile|2400" }), say("POLSON", "It's narrower than last time!! They've changed it."), say("POLSON", "Push me. Push me through. This is part of the warm-up.")]);
    // mash to shove him through
    await new Promise<void>((resolve) => {
      let pushes = 0;
      const NEED = 14;
      const bar = this.add.rectangle(330, 200, 0, 18, 0x22c55e).setOrigin(0, 0.5).setDepth(60);
      this.add.rectangle(480, 200, 304, 24).setStrokeStyle(3, 0xffffff).setDepth(60);
      const help = this.add.text(480, 165, "TAP / SPACE to shove Polson through the turnstile", { fontFamily: FONT, fontSize: "14px", color: "#ffd23f", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(60);
      me.setPosition(400, 390);
      const shove = () => {
        if (this.box.active || pushes >= NEED) return;
        pushes++;
        synth.play(pushes % 2 ? "hit" : "select");
        bar.width = (300 * pushes) / NEED;
        pol.x += 4;
        post1.x -= 0.6;
        post2.x += 0.6;
        me.x = 400 + (pushes % 2) * 10;
        this.cameras.main.shake(60, 0.003);
        if (pushes >= NEED) {
          this.input.keyboard?.off("keydown-SPACE", shove);
          this.input.off("pointerdown", shove);
          help.destroy();
          synth.play("explode");
          this.tween({ targets: post1, angle: -70, x: 380, duration: 300 });
          this.tween({ targets: post2, angle: 70, x: 580, duration: 300 });
          this.tween({ targets: pol, x: 640, duration: 250, ease: "Quad.out" }).then(() => this.time.delayedCall(500, () => resolve()));
        }
      };
      this.input.keyboard?.on("keydown-SPACE", shove);
      this.input.on("pointerdown", shove);
    });
    this.caption("TURNSTILE: DECOMMISSIONED", "#ffd23f", 26);
    await this.talk([
      say("POLSON", "Warmed up!! Full body pump!! YES YES YES"),
      dir("Polson lowers himself onto the bench press. The bench press makes a sound benches should not make."),
    ]);
    const bench = this.textures.exists("p_bench") ? this.add.image(700, 420, "p_bench").setScale(2).setDepth(8) : this.add.rectangle(700, 410, 160, 20, 0x374151).setDepth(8);
    await this.tween({ targets: pol, x: 700, y: 385, duration: 600 });
    await this.wait(500);
    synth.play("explode");
    this.cameras.main.shake(300, 0.012);
    this.tween({ targets: bench, angle: 12, y: 440, duration: 200 });
    this.tween({ targets: pol, y: 410, duration: 200 });
    await this.talk([
      dir("The bench snaps cleanly in half. Polson has not touched a weight.", { cine: "impact;sting|ss_sting_reveal;still|ss_still_bench|2600" }),
      say("POLSON", "PERSONAL BEST!! 😅", { cine: "cut|ss_cut_polson_grin|left|0xffd23f|1000" }),
      say("CHAD DELTOID", "(from the squat rack) Mate, that's a £900 bench.", { cineAfter: "freeze|WEIGHT LIFTED: 0 KG. BENCHES: -1" }),
      say("POLSON", "That's the session!! Post-workout window. I've got to get the protein in within thirty seconds or the gains evaporate. Make no mistake"),
      say("POLSON", "Restaurant!! Quick!! QUICK!!"),
    ]);
    this.clearStage();
    this.lastCaption = undefined;
    if (!backdrop(this, "bg_restaurant", { depth: -10 })) this.add.tileSprite(0, 0, 960, 540, "tile_pub").setOrigin(0);
    this.add.text(480, 80, "🍔 KREZ-KING BURGERS & PIZZA & FUDGE 🍕", { fontFamily: FONT, fontSize: "22px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5);
    const pol2 = this.fatPolson(420, 320);
    this.add.sprite(620, 320, playerKey(this), 0).setScale(3).setDepth(10);
    await this.talk([
      say("WAITER", "Oh no. Not him again. Last time he ate a chair leg by accident."),
      say("POLSON", "Protein shake please!! Chocolate. Blend a fudge into it. Blend two fudges. And a burger 😝"),
      say("WAITER", "…In the shake?"),
      say("POLSON", "Liquid gains!! Absorbs faster. If my memory serves correct"),
    ]);
    // (one round of feeding is enough: the shake goes straight down)
    G.s.flags.polson_fat = ((G.s.flags.polson_fat as number) ?? 0) + 8;
    synth.play("slurp");
    this.tweens.add({ targets: pol2, scaleX: pol2.scaleX * 1.06, duration: 300, ease: "Back.out" });
    if (pol2.texture.key === "spr_POLSON_FAT") pol2.setFrame(Polson.bellyFrame((G.s.flags.polson_fat as number) ?? 0));
    await this.talk([
      dir("He drinks it in one go. The straw collapses. The glass collapses. Something in his shirt gives way."),
      say("POLSON", "Oh that's delectable!! I can feel it going straight to the muscles", { cineAfter: "sting|ss_sting_comedy" }),
    ]);
    synth.stopMusic();
  }

  /** CCTV, CAM 1: Polson lets rip. The camera fogs up. */
  private async cctvFarts(pol: Phaser.GameObjects.Sprite) {
    await this.talk([dir("17:10. CAM 1: Polson wakes up. He shifts onto one buttock. He has the look of a man listening to something only he can hear.")]);
    const sizes = [0.6, 0.9, 1.4, 2.2];
    for (let i = 0; i < sizes.length; i++) {
      synth.play("fart");
      this.cameras.main.shake(180 + i * 120, 0.004 + i * 0.004);
      const tex = this.textures.exists("fx_gas") ? "fx_gas" : "fx_circle";
      for (let k = 0; k < 3 + i * 2; k++) {
        const c = this.add.image(pol.x - 14, pol.y + 18, tex).setTint(0xa3e635).setAlpha(0.75).setScale(0.2 * sizes[i]).setDepth(20);
        this.tweens.add({ targets: c, x: c.x - 40 - Math.random() * 120 * sizes[i], y: c.y - 20 - Math.random() * 60, scale: 0.6 * sizes[i], alpha: 0, duration: 1400 + i * 300, onComplete: () => c.destroy() });
      }
      const sub = this.add.text(250, 232, ["[FART]", "[LONGER FART]", "[WET FART]", "[FART CONTINUES FOR SOME TIME]"][i], { fontFamily: "monospace", fontSize: "13px", color: "#facc15", backgroundColor: "#000000cc", padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(30);
      this.tweens.add({ targets: sub, alpha: 0, delay: 800, duration: 400, onComplete: () => sub.destroy() });
      this.tweens.add({ targets: pol, y: pol.y - 6 - i * 3, yoyo: true, duration: 90, repeat: i });
      await this.wait(950 + i * 150);
    }
    // the lens goes green
    const fog = this.add.rectangle(250, 150, 420, 200, 0x84cc16, 0).setDepth(25);
    this.tweens.add({ targets: fog, fillAlpha: 0.55, duration: 900 });
    await this.talk([
      dir("CAM 1 has fogged up. From the inside. The War Room microphone picks up a fifth one, which sounds like someone sitting on a duck."),
      say("POLSON", "(on CAM 1, to nobody) Oh that's delectable 😅"),
      ping("POLSON", "Core is on fire!!"),
      say("KREZWONK", "It's not his core that's on fire.", { cineAfter: "sting|biglaugh" }),
    ]);
    this.tweens.add({ targets: fog, fillAlpha: 0, duration: 1200, onComplete: () => fog.destroy() });
  }

  /** CCTV, CAM 1: Polson, the phone, the sofa. A censor bar does its best. Then everything gets hit. */
  private async cctvWonk(pol: Phaser.GameObjects.Sprite) {
    await this.talk([dir("18:40. CAM 1: Polson gets his phone out. Turns it sideways. Turns the brightness all the way up. Looks over his shoulder at the window. Looks straight into CAM 1. Does not see it.")]);
    // the phone glow, and what's on it (thankfully, only the glow)
    const phone = this.add.rectangle(pol.x + 20, pol.y - 10, 14, 22, 0x93c5fd).setDepth(22).setStrokeStyle(2, 0x111827);
    const glow = this.add.circle(pol.x + 14, pol.y - 14, 34, 0x93c5fd, 0.25).setDepth(21).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 220 });
    const tag = this.add.text(250, 232, "[AUDIO: 'FILTHY VIDEOS ON HIS PHONE' — VOLUME: MAXIMUM]", { fontFamily: "monospace", fontSize: "11px", color: "#facc15", backgroundColor: "#000000cc", padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(30);
    await this.talk([dir("The War Room cannot hear what he's watching. The War Room can hear that it is LOUD."), say("KREBLIS", "Oh no"), say("KREBLIS", "Oh no no no")]);
    // the wonking: wrist under the bar, faster and faster
    // his own wonk loop (hand down to the crotch) when the art has it, else a stand-in wrist
    const pump = perfCycle(pol, "wonk");
    pol.setData("wonking", true);
    const pr = censorRect(pol);
    const wrist = addWrist(this, pr.x - 4, pr.y - pr.h * 0.1, { ...wristLook("POLSON", CHARACTERS as any), scale: 1.4, speed: 160 });
    wrist.obj.setDepth(23).setVisible(!pump);
    const bar = addCensorBar(this, pol, { pad: 1 });
    bar.obj.setDepth(24);
    let pumpMs = 160;
    let pumpPhase = 0;
    const pumper = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (pump && pol.active) {
          pumpPhase += 16 / (pumpMs / 4);
          pol.setFrame(pump[Math.floor(pumpPhase) % pump.length]);
        }
        bar.follow();
      },
    });
    const barTxt = { destroy: () => pumper.remove() };
    const grunts = ["mmf", "hrrnnggh", "mmm", "yesss", "oh yeah", "HRRNNGH", "MMMMF"];
    for (let i = 0; i < 14; i++) {
      wrist.setSpeed(Math.max(45, 160 - i * 9));
      pumpMs = Math.max(45, 160 - i * 9);
      if (i % 2 === 0) synth.voice(i % 4 === 0 ? "grunt" : "mmm", 0.35 + i * 0.02, 1 + i * 0.02);
      const g = this.add.text(pol.x + 50 + Math.random() * 60, pol.y - 30 - Math.random() * 30, grunts[i % grunts.length], { fontFamily: FONT, fontSize: `${11 + (i % 3) * 3}px`, color: "#ffe4ec", fontStyle: "italic", stroke: "#000", strokeThickness: 3 }).setDepth(30);
      this.tweens.add({ targets: g, y: g.y - 20, alpha: 0, duration: 900, onComplete: () => g.destroy() });
      this.tweens.add({ targets: pol, y: pol.y - 2, yoyo: true, duration: 60 });
      if (i > 8) this.cameras.main.shake(120, 0.002 + (i - 8) * 0.002);
      await this.wait(320 - i * 12);
    }
    // KREZZ
    synth.voice("oh", 0.7, 1.4);
    synth.voice("grunt", 0.7, 1.2, 0.35);
    synth.play("splat");
    this.cameras.main.flash(250, 255, 255, 255);
    this.cameras.main.shake(700, 0.02);
    tag.destroy();
    const caption = this.caption("POLSON HAS KREZZED", "#ffffff", 30);
    const splatTex = this.textures.exists("fx_splat_white") ? "fx_splat_white" : null;
    const splat = (x: number, y: number, size: number, depth: number) => {
      const s = splatTex ? this.add.image(x, y, splatTex).setDisplaySize(size, size) : this.add.circle(x, y, size / 3, 0xf8f8f2);
      s.setDepth(depth).setRotation(Math.random() * Math.PI * 2).setAlpha(0.95);
      s.setScale(s.scaleX * 0.2, s.scaleY * 0.2);
      this.tweens.add({ targets: s, scaleX: s.scaleX * 5, scaleY: s.scaleY * 5, duration: 120, ease: "Back.out" });
      this.tweens.add({ targets: s, y: y + 30, delay: 700, duration: 2600, ease: "Sine.in" });
      return s;
    };
    // all over the lounge: the ceiling, the telly, the sofa, the lens
    for (let i = 0; i < 26; i++) {
      this.time.delayedCall(i * 45, () => {
        synth.play(i % 3 ? "splat" : "gasp");
        splat(80 + Math.random() * 340, 60 + Math.random() * 180, 20 + Math.random() * 40, 26);
      });
    }
    // and it gets on the other cameras somehow
    for (let i = 0; i < 18; i++) {
      this.time.delayedCall(600 + i * 70, () => splat(Math.random() * 960, Math.random() * 500, 50 + Math.random() * 80, 40));
    }
    await this.wait(2200);
    wrist.destroy();
    bar.destroy();
    barTxt.destroy();
    pol.setData("wonking", false);
    if (pump && pol.active) pol.setFrame(0);
    phone.destroy();
    glow.destroy();
    caption.destroy();
    this.lastCaption = undefined;
    await this.talk([
      dir("Every camera in the War Room has been hit. CAM 2 is at Krunch Gym, two miles away. CAM 2 has been hit."),
      say("KREZMAR", "How has it reached the gym"),
      say("SCROMBUS", "That's the first time anything of Polson's has been to the gym."),
      ping("POLSON", "Just done a set of reps!! 💪💦"),
      ping("POLSON", "Upper body day 😅"),
    ]);
  }

  // ---------------------------------------------------------------- THE SANMIKVERSE

  private sanmikSprites(lx: number, rx: number, y: number) {
    const mk = (key: string, fb: string, x: number, tint: number) => {
      const sp = this.add.sprite(x, y, this.textures.exists(key) ? key : fb, 0).setScale(3).setDepth(10);
      if (!this.textures.exists(key)) sp.setTint(tint);
      return sp;
    };
    return { mik: mk("spr_SANMIK", "spr_MIKEY", lx, 0xb0c4ff), chz: mk("spr_SANCHZ", "spr_POLSON", rx, 0xffe08a) };
  }

  /** Playing as Mikey you ARE SanMik: lines the player says *to* SanMik go to someone else in the room. */
  private youTo(alt: string): string {
    return G.s.player === "MIKEY" ? alt : G.s.player;
  }

  /** Mash to do a thing. Resolves after `need` taps. */
  private mashFor(need: number, label: string, onTap: (n: number) => void) {
    return new Promise<void>((resolve) => {
      let n = 0;
      const help = this.add.text(480, 150, label, { fontFamily: FONT, fontSize: "16px", color: "#ffd23f", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(300);
      const tap = () => {
        if (this.box.active || n >= need) return;
        n++;
        onTap(n);
        if (n >= need) {
          this.input.keyboard?.off("keydown-SPACE", tap);
          this.input.off("pointerdown", tap);
          help.destroy();
          this.time.delayedCall(300, () => resolve());
        }
      };
      this.input.keyboard?.on("keydown-SPACE", tap);
      this.input.on("pointerdown", tap);
    });
  }

  private async sanmikLampe() {
    if (!backdrop(this, "bg_gig", { dim: 0.25, depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x1a0f1f);
    const { mik, chz } = this.sanmikSprites(330, 640, 360);
    // playing as Mikey, SanMik is you: no second one
    const me = G.s.player === "MIKEY" ? mik : this.add.sprite(820, 380, playerKey(this), 0).setScale(3).setDepth(10);
    // the lamp
    const lamp = this.add.container(470, 400).setDepth(20);
    lamp.add(this.add.ellipse(0, 0, 56, 24, 0xd4a017).setStrokeStyle(2, 0x7c5a00));
    lamp.add(this.add.triangle(38, -6, 0, 0, 30, -10, 0, 8, 0xd4a017));
    lamp.add(this.add.ellipse(0, -14, 22, 12, 0xe8b923));
    // not Majek Lampe (its lyrics are the scene): a different SanMik & SanChz track underneath
    synth.music("lamp_rub", true);
    await this.talk([
      dir("The back room of the Krezz Arms, after the gig. SanMik is lying face-down on the stage 'cooling down'. SanChz is eating the setlist.", { variants: { MIKEY: "The back room of the Krezz Arms, after the gig. You are lying face-down on the stage 'cooling down'. SanChz is eating the setlist." } }),
      say("SANMIK", "Yee. 'Ello me dearies. How you all fucking doing, you fucking PRICKS.", { cine: "speed|0xa855f7;cut|ss_cut_sanmik|left|0xa855f7|1200" }),
      say("SANMIK", "Found this in the skip out the back. Magic lamp. Looks like a naughty little dildo and it smells like rank fanny juice."),
      say("SANCHZ", "Rub it."),
      say("SANMIK", "I'm gonna rub it like I rubbed one out last night, yee. Hehehe."),
      say(this.youTo("SANCHZ"), "Please don't say it like that."),
    ]);
    await this.mashFor(12, G.s.player === "MIKEY" ? "TAP / SPACE: rub the lamp (sorry)" : "TAP / SPACE: help SanMik rub the lamp (sorry)", (n) => {
      synth.play(n % 2 ? "select" : "hit");
      lamp.setAngle(n % 2 ? -8 : 8);
      mik.x = 400 + (n % 2) * 8;
      if (n % 3 === 0) {
        const puff = this.add.circle(500 + Math.random() * 20, 380, 10, 0x9b59ff, 0.6).setDepth(25);
        this.tween({ targets: puff, y: 250, radius: 40, alpha: 0, duration: 900 }).then(() => puff.destroy());
      }
    });
    lamp.setAngle(0);
    synth.play("explode");
    this.cameras.main.shake(400, 0.01);
    this.cameras.main.flash(300, 155, 89, 255);
    const genie = this.textures.exists("p_genie") ? this.add.image(500, 400, "p_genie").setOrigin(0.5, 1).setScale(0.2).setDepth(30) : this.add.ellipse(500, 300, 90, 160, 0x3b82f6).setScale(0.2).setDepth(30);
    await this.tween({ targets: genie, scale: this.textures.exists("p_genie") ? 2.2 : 1, y: 380, duration: 900, ease: "Back.out" });
    this.tweens.add({ targets: genie, y: 370, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
    await this.talk([
      say("GENIE", "GREETINGS, SANMIK. I AM A MAGICAL GENIE, RELEASED FROM MY MYSTICAL SLEEP AFTER TEN THOUSAND LONG BLOODY YEARS."),
      say("GENIE", "AS A REWARD, I WILL GRANT YOU THREE WISHES."),
      say("SANMIK", "You fucking what? You fucking prick, I'll fucking sherk you. Catford Fox Crew."),
      say("SANMIK", "Is that you SanChz? Dressed up like a magical flying cunt like you always do?"),
      say("SANCHZ", "I'm over here, mate. I'm eating the setlist."),
      say("GENIE", "I AM NOT SANCHZ. NOW. WHAT ARE YOUR WISHES?"),
      say("SANMIK", "Ooh. Well that's a tough question. Yee. Mm. Let me see."),
      say("SANMIK", "Number one: a fucking pet goat."),
      say("SANMIK", "Number two: a Pepsi Max."),
      say(this.youTo("SANCHZ"), "Mikey. Think about this. You can have anything—"),
      say("SANMIK", "And number three… a Pepsi normal.", { cineAfter: "freeze|WISHES REMAINING: 0. PEPSIS: 2." }),
      say("GENIE", "…"),
      say("GENIE", "WHAT A BLOODY FUCKING WASTE. YOU COULD HAVE LEARNED TO BLOODY FUCKING FLY."),
      say("GENIE", "BUT. YOUR WISHES ARE MY COMMAND."),
    ]);
    synth.play("coin");
    const cans = [this.add.rectangle(380, 300, 14, 26, 0x111827).setStrokeStyle(2, 0x3b82f6).setDepth(31), this.add.rectangle(400, 300, 14, 26, 0x1d4ed8).setStrokeStyle(2, 0xef4444).setDepth(31)];
    this.tween({ targets: cans, y: 330, duration: 400, ease: "Bounce.out" });
    const goat = this.textures.exists("p_gabor") ? this.add.image(560, 420, "p_gabor").setOrigin(0.5, 1).setScale(0.1).setDepth(28) : this.add.ellipse(560, 400, 60, 40, 0xffffff).setDepth(28);
    await this.tween({ targets: goat, scale: 1.4, duration: 500, ease: "Back.out" });
    this.tweens.add({ targets: goat, angle: 5, yoyo: true, repeat: -1, duration: 300 });
    await this.talk([
      say("SANMIK", "Yee — ooh yee, I got it. Uhh. Yee. Mate, this Pepsi Max is GREAT."),
      gabor("Oh god. Oh god I exist. Hello. I'm Gabor the Goat. Am I your best friend? I'm your best friend. Sorry. Is that too much? It's too much."),
      say("SANMIK", "Shut the fuck up, you little neeky cunt, or I'll make a fucking curry out of you."),
      gabor("A curry. Would it hurt? It would hurt. Ooh. Okay. Okay SanMik. You're my best friend. Please threaten me again later."),
      say("SANCHZ", "Can I have the Pepsi normal."),
      say("SANMIK", "No."),
      say("GENIE", "ONE MORE THING. I HAVE SPENT TEN THOUSAND YEARS IN A LAMP THAT SMELLS OF FANNY JUICE. SOMEBODY IS PAYING FOR THAT."),
      gabor("Is it me? Is it me paying? Oh no. Oh yes."),
      say("GENIE", "WELCOME… TO THE SANMIKVERSE."),
    ]);
    // everyone up the spout
    synth.play("explode");
    this.cameras.main.shake(900, 0.02);
    const all = [mik, chz, me, goat, ...cans];
    await Promise.all(all.map((o, i) => this.tween({ targets: o, x: 505, y: 395, scale: 0.05, angle: 720, delay: i * 120, duration: 900, ease: "Quad.in" })));
    this.cameras.main.flash(500, 255, 255, 255);
    this.caption("THE SANMIKVERSE", "#ff6bb0", 44);
    await this.wait(1200);
    await this.talk([
      dir("You land face-first in something soft. It's a pizza. It's a wet pizza."),
      say("SANMIK", "(somewhere nearby) CATFORD! Yee! I'm HOME, blud!"),
    ]);
    synth.stopMusic();
  }

  private async sanmikNation() {
    if (!backdrop(this, "bg_townhall", { dim: 0.2, depth: -10 })) this.sky(0x9ec5e8, 0xe8d8b0);
    const { mik, chz } = this.sanmikSprites(220, 740, 330);
    const kre = this.add.sprite(480, 300, "spr_KREBLIS", 0).setScale(2.6).setDepth(9);
    const me = G.s.player === "MIKEY" ? mik : this.add.sprite(480, 430, playerKey(this), 0).setScale(3).setDepth(12);
    const leftCrowd = [0, 1, 2].map((i) => this.add.sprite(110 + i * 50, 410 + (i % 2) * 14, `spr_FOLK${i}`, 0).setScale(2.4).setDepth(11));
    const rightCrowd = [1, 2, 3].map((i) => this.add.sprite(760 + i * 50, 410 + (i % 2) * 14, `spr_FOLK${i}`, 0).setScale(2.4).setDepth(11).setFlipX(true));
    const goat = this.textures.exists("p_gabor") ? this.add.image(480, 470, "p_gabor").setOrigin(0.5, 1).setScale(1.1).setDepth(13) : this.add.ellipse(480, 450, 50, 30, 0xffffff).setDepth(13);
    const banner = (x: number, t: string, c: number) => {
      this.add.rectangle(x, 120, 300, 40, c).setStrokeStyle(3, 0x000000).setDepth(8);
      this.add.text(x, 120, t, { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffffff", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(9);
    };
    banner(210, "SANMIK NATION", 0xdc2626);
    banner(750, "SANCHZ NATION", 0x2563eb);
    const chant = (ps: Phaser.GameObjects.Sprite[], t: string) => this.people(ps, t);
    await this.talk([
      dir("Krelford Town Hall. On the left steps: SanMik, a megaphone, three confused pensioners and a hand-painted banner. On the right steps: SanChz, a different megaphone, three different confused pensioners and a different banner.", { variants: { MIKEY: "Krelford Town Hall. On the left steps: you, a megaphone, three confused pensioners and a hand-painted banner. On the right steps: SanChz, a different megaphone, three different confused pensioners and a different banner." } }),
      dir("In the middle: Gabor the Goat, wearing a rosette from each side."),
      say("KREBLIS", "Krelmergency… there are two nations on my steps and neither of them has filled in the form"),
      say("KREBLIS", "Wot a story eh"),
      say(G.s.player, "What happened?"),
      gabor("SanChz drank the Pepsi Normal. The wish one. SanMik said it was a declaration of war. Then they both declared nations. I'm on both sides. They're both shouting at me. It's wonderful. I'm so scared."),
    ]);
    synth.music("sanmik_nation", true);
    for (let i = 0; i < 2; i++) {
      chant([mik, ...leftCrowd], "SANMIK NATION!");
      this.caption("🎤 WE ALL WANT TO LIVE IN A SANMIK NATION", "#ff6b6b", 22);
      await this.wait(1300);
      chant([chz, ...rightCrowd], "SANCHZ NATION!");
      this.caption("🎤 WE ALL WANT TO LIVE IN A SANCHZ NATION", "#7fb3ff", 22);
      await this.wait(1300);
    }
    this.lastCaption?.destroy();
    await this.talk([
      say("SANMIK", "Yee. I know you're thinking it, but I've got the balls to say it. SanChz, you're a fucking cunt. Stop being a stupid little cunt. You and your men are all fucking cunts."),
      say("SANCHZ", "I haven't got any men. I've got Doreen."),
      say("DOREEN (SANCHZ NATION)", "I thought this was the bus queue."),
      say("SANMIK", "From now on, SanMik's your god. All you ladies of Krelford, form an orderly queue. My kids will be the government."),
      say("SANMIK", "Lil Leroy: Chancellor. Munky: Home Secretary. Princess: Foreign Office. And Cancelle Culchure: Minister for Culture."),
      say("KREBLIS", "You named a child Cancelle Culchure."),
      say("SANMIK", "Spelt proper. It's French.", { cineAfter: "sting|ss_sting_awkward;freeze|IT IS NOT FRENCH." }),
      say("SANCHZ", "SanChz Nation policy one: hot tubs on the NHS. Policy two: Doreen gets her bus. Policy three: mork."),
    ]);
    for (let i = 0; i < 3; i++) {
      chant([mik, chz, ...leftCrowd, ...rightCrowd], "WIN THE WAR!");
      this.caption("WIN THE WAR! WIN THE WAR!", "#ffd23f", 30);
      await this.wait(700);
    }
    this.lastCaption?.destroy();
    await this.talk([
      dir("Both nations begin to advance. Very slowly. Doreen has a hip."),
      say(this.youTo("KREBLIS"), "STOP. Both of you. There's only one place the San Brothers have ever settled anything."),
      say("SANMIK", "…"),
      say("SANCHZ", "…"),
      say("SANMIK & SANCHZ", "THE HOT TUB."),
    ]);
    // the summit
    this.cameras.main.flash(300, 255, 255, 255);
    leftCrowd.concat(rightCrowd).forEach((p) => p.setVisible(false));
    kre.setPosition(820, 330);
    if (me !== mik) me.setPosition(140, 400);
    goat.setPosition(860, 470);
    const tub = this.textures.exists("p_hottub") ? this.add.image(480, 470, "p_hottub").setOrigin(0.5, 1).setScale(2.6).setDepth(20) : this.add.rectangle(480, 420, 300, 120, 0x7c4a1e).setDepth(20);
    mik.setPosition(420, 300).setDepth(19);
    chz.setPosition(545, 300).setDepth(19);
    this.tweens.add({ targets: [mik, chz], y: 292, yoyo: true, repeat: -1, duration: 400, ease: "Sine.inOut" });
    const bubbles = this.time.addEvent({ delay: 140, loop: true, callback: () => {
      const b = this.add.circle(380 + Math.random() * 200, 330, 4 + Math.random() * 6, 0xe0f2fe, 0.8).setDepth(21);
      this.tween({ targets: b, y: 230, alpha: 0, duration: 900 }).then(() => b.destroy());
    } });
    void tub;
    synth.music("ggg13");
    this.caption("THE HOT TUB SUMMIT", "#7fdfff", 32);
    await this.wait(1000);
    await this.talk([
      say("SANMIK", "It's SanMik (in the hot tub)."),
      say("SANCHZ", "With SanChz (in the hot tub)."),
      say("SANMIK", "Splash SanChz (in the hot tub)."),
      say("SANCHZ", "Splashes me back (in the hot tub)."),
      say("SANMIK", "…I'm sorry I called you a magical flying cunt, SanChz."),
      say("SANCHZ", "I'm sorry I drank your Pepsi Normal. It was flat. You wasted a wish on a flat drink."),
      say("SANMIK", "We all want to live… in a SanMik AND SanChz nation."),
      say("SANCHZ", "The San Brothers. Mork."),
      say("KREBLIS", "Krelmergency over. I repeat. Krelmergency ov—"),
      dir("A figure is approaching the hot tub. Waddling. Clenching."),
      say("UNCLE RIK", "'Ello. It's Uncle Rik. I need a shit real bad. Yee."),
      say("SANMIK", "Rik. Rik, no. RIK. YOU MUSTN'T WEE OR POO (IN THE HOT TUB)—"),
    ]);
    const rik = this.add.sprite(-40, 380, "spr_FOLK2", 0).setScale(3).setDepth(22).setTint(0xd6b48a);
    await this.tween({ targets: rik, x: 480, y: 290, duration: 900, ease: "Quad.in" });
    synth.play("explode");
    this.cameras.main.shake(500, 0.02);
    bubbles.remove();
    const splash = this.add.circle(480, 340, 20, 0x7c4a1e, 0.85).setDepth(30);
    this.tween({ targets: splash, radius: 200, alpha: 0, duration: 900 });
    this.tween({ targets: mik, x: -80, y: 200, angle: -540, duration: 900 });
    this.tween({ targets: chz, x: 1040, y: 200, angle: 540, duration: 900 });
    this.caption("HOT TUB: CONDEMNED", "#a16207", 34);
    await this.wait(1100);
    await this.talk([
      say("UNCLE RIK", "Ahh. That's better. Lovely and warm."),
      dir("The water in the hot tub is now a colour that Krelford Council will later describe as 'a biohazard and a crime'. A crouton bobs to the surface. It is not a crouton."),
      gabor("Can I go in? I want to go in. I don't want to go in. Push me in."),
      say("EVERYONE", "NO."),
    ]);
    // the celebration
    this.clearStage();
    this.lastCaption = undefined;
    if (!backdrop(this, "bg_townhall", { dim: 0.2, depth: -10 })) this.sky(0x9ec5e8, 0xe8d8b0);
    const m2 = this.add.sprite(480, 360, this.textures.exists("spr_SANMIK") ? "spr_SANMIK" : "spr_MIKEY", 0).setScale(3.4).setDepth(10);
    const c2 = this.add.sprite(640, 370, this.textures.exists("spr_SANCHZ") ? "spr_SANCHZ" : "spr_POLSON", 0).setScale(3.2).setDepth(10);
    const hat = this.add.triangle(480, 300, 0, 18, 12, 0, 24, 18, 0xdc2626).setDepth(11);
    this.add.circle(492, 300, 4, 0xffffff).setDepth(12);
    synth.music("ggg12");
    await this.talk([
      dir("That evening, on the Town Hall steps, the San Brothers hold a joint state ceremony to found the United SanMik & SanChz Nation (population: 2, and a goat)."),
      dir("To mark the occasion, SanMik removes his tracksuit to reveal a red velvet Santa G-string. It is October. Nobody asked.", { variants: { MIKEY: "To mark the occasion, you remove your tracksuit to reveal a red velvet Santa G-string. It is October. Nobody asked." } }),
    ]);
    this.tweens.add({ targets: [m2, hat], angle: { from: -10, to: 10 }, yoyo: true, repeat: -1, duration: 160 });
    this.tweens.add({ targets: m2, scaleX: 3.7, yoyo: true, repeat: -1, duration: 160 });
    this.tweens.add({ targets: c2, y: 360, yoyo: true, repeat: -1, duration: 300 });
    this.caption("🎄 I LOVE CHRISTMAS 🎄", "#ff6b6b", 30);
    await this.wait(1500);
    await this.talk([
      say("SANMIK", "Yee! I'm the fucking best! Michael Jackson is second best! I am also best dressed!", { cine: "cut|ss_cut_sanmik|right|0xff6b6b|1100" }),
      say(this.youTo("KREBLIS"), "You're in a G-string."),
      say("SANMIK", "Best dressed, blud."),
      say("SANCHZ", "Everyone knows he's solid. No cunt touches him."),
      dir("Gabor the Goat headbutts SanMik in the bum. SanMik falls down the Town Hall steps, all of them, one at a time, still twerking.", { variants: { MIKEY: "Gabor the Goat headbutts you in the bum. You fall down the Town Hall steps, all of them, one at a time, still twerking." } }),
      gabor("Sorry SanMik. Sorry. I love you. You're my best friend. Headbutt me back. Please. PLEASE."),
      ping("DRONGUS", "Who let Mikey start a country"),
      ping("DRONGUS", "And why is there a goat in the group chat"),
      ping("MIKEY", "Can someone react to my message pls"),
      ping("MIKEY", "The nation one"),
      dir("SanMik and SanChz are friends again. The hot tub has been sealed in concrete. Begour sends a card. It says 'So proud of you both x'. It smells faintly of lavender.", { variants: { MIKEY: "You and SanChz are friends again. The hot tub has been sealed in concrete. Begour sends a card. It says 'So proud of you both x'. It smells faintly of lavender." } }),
    ]);
    G.s.flags.sanmik_nation = true;
    synth.stopMusic();
  }

  /** The Giant Hot Tub of Catford: unblock the jets, the Genie gets his bath, everyone goes home. */
  private async sanmikFinale() {
    if (!backdrop(this, "sm_bigtub", { depth: -10 })) this.sky(0x2a1050, 0x9b59ff);
    const { mik, chz } = this.sanmikSprites(200, 760, 400);
    const me = G.s.player === "MIKEY" ? mik : this.add.sprite(110, 410, playerKey(this), 0).setScale(3).setDepth(10);
    const goat = this.textures.exists("p_gabor") ? this.add.image(860, 440, "p_gabor").setOrigin(0.5, 1).setScale(1).setDepth(10) : this.add.circle(860, 420, 20, 0xffffff);
    void me;
    synth.music("ggg13");
    // three blocked jets along the tub
    const jets = [300, 480, 660].map((x) => {
      const c = this.add.container(x, 330).setDepth(20);
      c.add(this.add.circle(0, 0, 22, 0x3f3f46).setStrokeStyle(4, 0x71717a));
      const gunk = this.add.circle(0, 0, 18, 0x65a30d);
      c.add(gunk);
      return { c, gunk, clear: 0 };
    });
    await this.talk([
      dir("The Giant Hot Tub of Catford, Uncle-Rik-free for the first time in weeks. The water is grey-green. The jets are clogged solid with biofilm."),
      say("SANMIK", "Yee. Right. Get your fingers in them jets."),
      say("SANCHZ", "YEGHHH. I've done worse."),
      gabor("Use me. Use me as a plunger. I'm begging you. I'm begging you not to. I'm begging you."),
    ]);
    let done = 0;
    await this.mashFor(18, "TAP / SPACE: unblock the jets (3 of them, 6 good jabs each)", (n) => {
      const j = jets[Math.min(2, Math.floor((n - 1) / 6))];
      j.clear++;
      j.gunk.setScale(Math.max(0, 1 - j.clear / 6));
      synth.play(n % 2 ? "slurp" : "hit");
      const glob = this.add.circle(j.c.x, j.c.y, 6, 0x84cc16).setDepth(25);
      this.tween({ targets: glob, x: j.c.x + (Math.random() - 0.5) * 200, y: j.c.y - 120 - Math.random() * 60, alpha: 0, duration: 600 }).then(() => glob.destroy());
      if (j.clear === 6) {
        done++;
        this.caption(`JET ${done} UNBLOCKED`, "#7fdfff", 26);
        const spout = this.add.rectangle(j.c.x, j.c.y - 60, 14, 120, 0xbae6fd, 0.8).setDepth(24);
        this.tweens.add({ targets: spout, scaleY: 1.3, yoyo: true, repeat: -1, duration: 200 });
      }
    });
    this.cameras.main.flash(400, 186, 230, 253);
    synth.play("cheer");
    this.caption("THE GIANT HOT TUB IS FIXED", "#7fdfff", 30);
    const bubbles = this.time.addEvent({ delay: 90, loop: true, callback: () => {
      const b = this.add.circle(150 + Math.random() * 660, 380, 4 + Math.random() * 8, 0xe0f2fe, 0.85).setDepth(21);
      this.tween({ targets: b, y: 240 + Math.random() * 60, alpha: 0, duration: 1000 }).then(() => b.destroy());
    } });
    void bubbles;
    await this.wait(1200);
    // the genie gets in
    const genie = this.textures.exists("p_genie") ? this.add.image(480, 330, "p_genie").setOrigin(0.5, 1).setScale(0.1).setDepth(19) : this.add.ellipse(480, 280, 90, 140, 0x3b82f6).setScale(0.1).setDepth(19);
    await this.tween({ targets: genie, scale: this.textures.exists("p_genie") ? 2 : 1, duration: 900, ease: "Back.out" });
    synth.music("ggg13", true);
    await this.talk([
      say("GENIE", "…"),
      say("GENIE", "OHHHHHH."),
      say("GENIE", "TEN THOUSAND YEARS. TEN THOUSAND YEARS I HAVE WAITED FOR THIS."),
      say("SANMIK", "It's SanMik (in the hot tub)…"),
      say("SANCHZ", "With SanChz (in the hot tub)…"),
      say("GENIE", "AND A GENIE (IN THE HOT TUB)."),
    ]);
    this.tween({ targets: [mik, chz], x: (t: Phaser.GameObjects.Sprite) => (t === mik ? 400 : 560), y: 330, duration: 700 });
    await this.wait(800);
    this.tweens.add({ targets: [mik, chz, genie], y: "-=8", yoyo: true, repeat: -1, duration: 400, ease: "Sine.inOut" });
    await this.talk([
      say("SANMIK", "Lots of bubbles (in the hot tub)."),
      say("SANCHZ", "Lots of trouble (in the hot tub)."),
      say("GENIE", "WET PIZZA (IN THE HOT TUB)."),
      dir("A slice of pizza floats past. The Genie eats it. Ten thousand years of fury leave his face."),
      gabor("Can I come in? I'm coming in. I'm not allowed in. I'm in."),
      dir("Gabor is in the hot tub. Nobody stops him. It's that kind of night."),
      say("GENIE", "VERY WELL. A DEAL IS A DEAL. YOU MAY GO HOME. ALL OF YOU."),
      say("GENIE", "EXCEPT THE GOAT. THE GOAT STAYS WITH ME. HE IS THE ONLY ONE WHO UNDERSTANDS SUFFERING."),
      gabor("Oh no. Oh YES."),
      dir("In the distance, a bear in a cardigan waves from the door of a café caravan. Begour has made flapjacks for the road."),
      say("BEGOUR THE BEAR", "Bye loves! Come back any time. The lamp's in the Krezz Arms. Mind how you go!"),
      dir("The lamp glows. Pop. You're behind the Krezz Arms bins, slightly damp, smelling faintly of lavender and biofilm."),
    ]);
    G.s.flags.sanmik_tub_fixed = true;
    synth.stopMusic();
  }

  // ---------------------------------------------------------------- THE CROBLEY AFFAIR

  /** An image if we have it, otherwise a labelled blob so the scene still reads. */
  private art(x: number, y: number, key: string, scale: number, fallbackColor = 0xf9a8d4, label = "") {
    if (this.textures.exists(key)) return (key.startsWith("spr_") ? this.add.image(x, y, key, 0) : this.add.image(x, y, key)).setScale(scale);
    const c = this.add.container(x, y);
    c.add(this.add.circle(0, 0, 24 * scale, fallbackColor));
    if (label) c.add(this.add.text(0, 0, label, { fontFamily: FONT, fontSize: "10px", color: "#000" }).setOrigin(0.5));
    return c as unknown as Phaser.GameObjects.Image;
  }

  private tweet(x: number, y: number, text: string, when: string) {
    const c = this.add.container(x, y).setDepth(300);
    c.add(this.add.rectangle(0, 0, 560, 150, 0xffffff).setStrokeStyle(2, 0xd1d5db));
    if (this.textures.exists("p_reinhardt")) c.add(this.add.image(-240, -40, "p_reinhardt").setScale(0.45));
    else c.add(this.add.circle(-240, -40, 22, 0x111827));
    c.add(this.add.text(-205, -62, "Reinhardt Crobley ✔", { fontFamily: FONT, fontSize: "16px", color: "#111", fontStyle: "bold" }));
    c.add(this.add.text(-205, -42, `@ReinhardtCrobley · ${when}`, { fontFamily: FONT, fontSize: "12px", color: "#6b7280" }));
    c.add(this.add.text(-255, -10, text, { fontFamily: FONT, fontSize: "16px", color: "#111", wordWrap: { width: 510 } }));
    c.add(this.add.text(-255, 52, "💬 41.2K   🔁 88K   ❤ 212K", { fontFamily: FONT, fontSize: "12px", color: "#6b7280" }));
    c.setScale(0.2);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: "Back.out" });
    return c;
  }

  /**
   * The KrelTV News studio, as a broadcast: the studio wide (her at the desk, him in the guest chair) inside a camera
   * container (`shot` cuts and pushes in; `pivot` is what tips over when the camera hits the floor), with the channel's
   * bug, clock, ticker and straps over it, kept above the dialogue box. The two are PixelLab presenters who lip-sync.
   */
  private crobleyStudio() {
    const pivot = this.add.container(480, 270).setDepth(-5);
    const stage = this.add.container(-480, -270);
    pivot.add(stage);
    const has = this.textures.exists("tv_kreltv_studio");
    const bg = this.add.image(480, -170, has ? "tv_kreltv_studio" : "tv_newsdesk").setOrigin(0.5, 0);
    bg.setScale(960 / bg.width);
    stage.add(bg);
    // the wall behind them breathes
    const wall = this.add.rectangle(480, 40, 700, 200, 0xef4444, 0).setBlendMode(Phaser.BlendModes.ADD);
    stage.add(wall);
    this.tweens.add({ targets: wall, fillAlpha: 0.08, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const mk = (name: string, x: number, y: number, sc: number, flip = false) => {
      if (!hasAnchor(this, name)) {
        const fb = this.add.sprite(x, y, name === "JOURNALIST" ? "npc_journo" : "boss_reinhardt", 0).setOrigin(0.5, 1).setScale(3);
        stage.add(fb);
        return fb;
      }
      const pr = new Presenter(this, name, x, y, sc, stage);
      pr.spr.setFlipX(flip);
      this.talkers.set(name, pr);
      return pr.spr;
    };
    const journo = mk("JOURNALIST", 330, 372, 2.05);
    const rein = mk("REINHARDT CROBLEY", 690, 380, 2.15);
    // the broadcast graphics, laid out above the dialogue box
    const chrome = new NewsChrome(this, { SX: 0, SY: 0, SW: 960, SH: 362 }, BRANDS.kreltv, 400);
    chrome.bug();
    chrome.ticker([
      "Crobley Corp controversy deepens",
      "New advert 'deeply offensive', say everyone with ears",
      "CEO: 'it clearly says nibble on a Crobley'",
      "Founder's death 'murder-adjacent'",
      "Police 'looking into it', from a distance",
    ]);
    // menace: a slow red pulse whenever he's in shot
    const menace = this.add.rectangle(480, 270, 960, 540, 0x7f1d1d, 0).setDepth(350).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.tweens.add({ targets: menace, fillAlpha: 0.3, yoyo: true, repeat: -1, duration: 1800, ease: "Sine.inOut" });
    const glint = this.add.star(rein.x - 14, rein.y - rein.displayHeight * 0.66, 4, 2, 7, 0xffffff).setAlpha(0);
    stage.add(glint);
    this.tweens.add({ targets: glint, alpha: 1, angle: 90, yoyo: true, repeat: -1, duration: 400, repeatDelay: 3000 });
    /** Cut or push the camera: on her, on him, or the two-shot. */
    const shot = (on: "journo" | "rein" | "two", ms = 0, push = true) => {
      this.tweens.killTweensOf(stage);
      const t = on === "journo" ? { s: 1.75, x: journo.x, y: journo.y - journo.displayHeight * 0.62 } : on === "rein" ? { s: 1.8, x: rein.x, y: rein.y - rein.displayHeight * 0.62 } : { s: 1, x: 480, y: 270 };
      // frame the face in the top of the picture (the dialogue box covers the bottom)
      const fy = on === "two" ? 270 : 150;
      const to = { scale: t.s, x: -480 + (480 - t.x * t.s), y: -270 + (fy - t.y * t.s) };
      if (on === "two") Object.assign(to, { x: -480, y: -270 });
      if (ms) this.tweens.add({ targets: stage, ...to, duration: ms, ease: "Sine.inOut" });
      else stage.setScale(to.scale).setPosition(to.x, to.y);
      if (push && on !== "two") this.tweens.add({ targets: stage, scale: t.s * 1.05, x: -480 + (480 - t.x * t.s * 1.05), y: -270 + (fy - t.y * t.s * 1.05), duration: 9000, delay: ms, ease: "Sine.inOut" });
    };
    return { journo, rein, stage, pivot, chrome, shot };
  }

  private async crobleyNews() {
    // the channel flips, and flips, and it's always the same thing
    const stat = this.add.rectangle(480, 270, 960, 540, 0x111111).setDepth(500);
    const noise = this.add.graphics().setDepth(501);
    const fuzz = this.time.addEvent({ delay: 50, loop: true, callback: () => {
      noise.clear();
      for (let i = 0; i < 300; i++) noise.fillStyle(Math.random() < 0.5 ? 0xffffff : 0x666666, 0.6).fillRect(Math.random() * 960, Math.random() * 540, 4, 3);
    } });
    const chans = ["CH 1: GB KREWS", "CH 2: KRELSPORTS", "CH 3: KIDS' KREL", "CH 4: THE COOKING CHANNEL", "CH 5: SHOPPING"];
    const lbl = this.add.text(480, 270, "", { fontFamily: "monospace", fontSize: "30px", color: "#22c55e", backgroundColor: "#000000aa", padding: { x: 10, y: 6 } }).setOrigin(0.5).setDepth(502);
    for (const c of chans) {
      lbl.setText(`${c}\n▶ BREAKING NEWS: CROBLEY`);
      synth.play("select");
      await this.wait(550);
    }
    fuzz.remove();
    noise.destroy();
    stat.destroy();
    lbl.destroy();
    // the KrelTV News ident, then the studio
    const ident = new NewsChrome(this, { SX: 0, SY: 0, SW: 960, SH: 540 }, BRANDS.kreltv, 450);
    synth.music("news");
    await this.wait(ident.ident() - 200);
    ident.destroy();
    const { journo, rein, stage, pivot, chrome, shot } = this.crobleyStudio();
    const cam = this.cameras.main;
    synth.music("ominous");
    await this.wait(chrome.breaking("Chaos at the Crobley Corporation") - 900);
    shot("journo", 900);
    this.time.delayedCall(1200, () => {
      chrome.strap("Journalist", "KrelTV News · Krelford");
      if (this.textures.exists("p_crobley")) chrome.ots({ key: "p_crobley" }, "The humble Crobley", "right");
    });
    await this.talk([
      say("JOURNALIST", "Good evening. Tonight: chaos at the Crobley Corporation, makers of Krelworld's best-loved children's sweet, the humble, circular Crobley."),
      say("JOURNALIST", "For forty years, families have hummed along to the famous advert. You know the one. 'Nibble on a Crobley.'"),
      say("JOURNALIST", "But last month, founder Crobson Crobley — beloved, generous, a man who once gave away a free Crobley to every child in Krelford — was found dead in what police describe as 'murder-adjacent' circumstances."),
      say("JOURNALIST", "The official cause: Mr Crobley is said to have 'unalived himself' as a result of a long-standing 'corn' addiction."),
      say("JOURNALIST", "However, suspicion immediately turned to his son, Reinhardt, who inherited the company — after posting this, one day before his father's death."),
    ]);
    chrome.ots(null);
    shot("two", 500, false);
    const t1 = this.tweet(480, 170, "I have decided to unalive my father ha ha just joking…. Unless ?", "1 day before");
    await this.talk([dir("The tweet sits there on the screen. Nobody in the studio says anything for a while.")]);
    t1.destroy();
    const t2 = this.tweet(480, 170, "my account got hacked by my alter ego … I mean .. some one very close to me … you might even say .. myself…", "1 hour later");
    await this.talk([say("JOURNALIST", "He later explained the post as follows.")]);
    t2.destroy();
    shot("journo", 600);
    chrome.headline("Crobley advert row");
    await this.talk([
      say("JOURNALIST", "Now Reinhardt Crobley — known for his controversial views on, well, everything — is under fire again, this time over the company's new advert, and its new characters."),
      say("JOURNALIST", "Critics say the classic jingle now contains deeply offensive language. Viewers have also complained about four new characters, said to be built on crude and offensive stereotypes."),
      say("JOURNALIST", "Mr Crobley joins me now. Reinhardt — good evening."),
    ]);
    shot("two", 700, false);
    await this.wait(900);
    shot("rein", 1100);
    this.time.delayedCall(1200, () => chrome.strap("Reinhardt Crobley", "CEO, Crobley Corporation"));
    await this.wait(1200);
    await this.talk([
      say("REINHARDT CROBLEY", "…"),
      say("REINHARDT CROBLEY", "Anyone with two bloody working ears can hear it clearly says 'nibble on a Crobley'!"),
      say("REINHARDT CROBLEY", "These fucking woke-gone-mad type people are off their bloody rocker!"),
    ]);
    shot("journo", 700);
    await this.wait(750);
    await this.talk([say("JOURNALIST", "Well. Let's let the viewers decide. Here is the new Crobley advert, in full.")]);
    synth.stopMusic();
    await this.crobleyAdvert();
    // back to the studio
    shot("two");
    await this.talk([
      say("JOURNALIST", "…"),
      say("JOURNALIST", "Come on, Reinhardt. We all heard it. It even says we heard it."),
      say("REINHARDT CROBLEY", "The only thing I can hear is a high-pitched squawking noise coming out of your fucking mouth."),
      say("REINHARDT CROBLEY", "I've had it!"),
    ]);
    // the machine gun (in the two-shot, so the stage lines up with the screen)
    shot("two", 300, false);
    await this.wait(320);
    for (const p of this.talkers.values()) p.stopTalking();
    this.talkers.get("REINHARDT CROBLEY")?.setPose("fists");
    const gun = this.art(rein.x - 70, rein.y - rein.displayHeight * 0.42, "p_mgun", 1.6, 0x111827, "GUN").setDepth(15).setFlipX(true);
    gun.setScale(0.1);
    await this.tween({ targets: gun, scale: this.textures.exists("p_mgun") ? 1.6 : 1, duration: 250, ease: "Back.out" });
    synth.play("telegraph");
    await this.wait(400);
    for (let i = 0; i < 16; i++) {
      this.time.delayedCall(i * 70, () => {
        synth.play("shoot");
        cam.shake(60, 0.008);
        if (!vfx(this, "vfx_muzzle", gun.x - 50, gun.y, { scale: calm() ? 1 : 1.5, depth: 16, add: true, flipX: true })) {
          const fl = this.add.star(gun.x - 50, gun.y, 5, 6, 16, 0xfde047).setDepth(16);
          this.time.delayedCall(50, () => fl.destroy());
        }
      });
    }
    // she takes the burst: drawn (gfx/GoreDeath.ts), in the studio's camera container so she goes over with the picture
    this.talkers.delete("JOURNALIST");
    await goreDeath(this, journo, "shot", { fromX: rein.x, hits: 5, gap: 90, lens: true });
    await this.talk([dir("The newsreader goes down behind the desk. Somewhere, a producer screams. Reinhardt slowly turns. Towards the camera.")]);
    // he turns it on us
    gun.setDepth(-4);
    shot("rein", 600, false);
    await this.wait(700);
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 70, () => {
        synth.play("shoot");
        cam.flash(40, 255, 240, 160);
      });
    }
    await this.wait(800);
    // the camera hits the floor
    const crack = this.add.graphics().setScrollFactor(0).setDepth(600);
    crack.lineStyle(3, 0xffffff, 0.9);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
      crack.lineBetween(560, 230, 560 + Math.cos(a) * (200 + Math.random() * 300), 230 + Math.sin(a) * (200 + Math.random() * 200));
    }
    synth.play("smash");
    synth.play("camera_crash");
    gun.setVisible(false);
    shot("two");
    // the camera hits the floor: the picture tips over (the channel's graphics, laid on top in the gallery, don't)
    if (G.meta.settings.gore !== false) for (let i = 0; i < 4; i++) splat(this, 300 + Math.random() * 360, 100 + Math.random() * 200, 360);
    await this.tween({ targets: pivot, rotation: Math.PI / 2, scale: 1.4, duration: 500, ease: "Bounce.out" });
    await this.talk([
      say("REINHARDT CROBLEY", "(off camera) HEH HEH HEH!"),
      say("REINHARDT CROBLEY", "(off camera) Just like I killed my father!"),
      say("REINHARDT CROBLEY", "(off camera) The police won't suspect a thing! I have bribed them all!!"),
      say("REINHARDT CROBLEY", "(off camera) …Is that light still on? Is that thing still—"),
    ]);
    cam.setRotation(0);
    crack.destroy();
    chrome.destroy();
    this.clearStage();
    this.lastCaption = undefined;
    // technical difficulties
    const bars = [0xffffff, 0xfacc15, 0x22d3ee, 0x22c55e, 0xe879f9, 0xef4444, 0x2563eb];
    bars.forEach((c, i) => this.add.rectangle(i * (960 / 7), 0, 960 / 7 + 1, 540, c).setOrigin(0));
    this.add.text(480, 270, "WE ARE EXPERIENCING\nTECHNICAL DIFFICULTIES", { fontFamily: "Impact, sans-serif", fontSize: "44px", color: "#fff", stroke: "#000", strokeThickness: 8, align: "center" }).setOrigin(0.5);
    synth.play("ding");
    await this.wait(1500);
    await this.talk([
      dir("You stare at the test card for a long time."),
      ping("KREBLIS", "Did everyone just see that"),
      ping("KREZMAR", "He shot the cameraman too"),
      ping("KREZMAR", "Nobody ever remembers the cameraman"),
      ping("SCROMBUS", "The jingle though"),
      ping("SCROMBUS", "We all heard it"),
      ping("KREBLIS", "War Room. Now."),
    ]);
  }

  /**
   * The new Crobley advert, set to the 81-second jingle (audio/crobley.mp3). Shots by music time:
   * 0 kids munching · 10 sausage grows · 15 Flirt · 20 Tank · 25.5 Gary · 30 Fruity and the men · 47 sausages again ·
   * 53 the family · 57 the changing room (dad and uncle dance, censor bars helicopter) · 70 Tank wipes out the others.
   * The art is PixelLab animation sheets (public/art/ad); every shot still reads with fallback blobs if it's missing.
   */
  private async crobleyAdvert() {
    const layer = this.add.container(0, 0).setDepth(700);
    const timers: Phaser.Time.TimerEvent[] = [];
    let skipped = false;
    const gore = G.meta.settings.gore !== false;
    let tankIn = false;
    const clear = () => {
      this.tweens.killTweensOf(layer.list);
      layer.removeAll(true);
    };
    const later = (ms: number, fn: () => void) => timers.push(this.time.delayedCall(ms, () => !skipped && fn()));
    const bg = (key: string, tint?: number) => {
      if (this.textures.exists(key)) {
        const src = this.textures.get(key).getSourceImage();
        const img = this.add.image(480, 270, key).setScale(Math.max(960 / src.width, 540 / src.height));
        if (tint) img.setTint(tint);
        layer.add(img);
      } else layer.add(this.add.rectangle(480, 270, 960, 540, tint ?? 0x7dd3fc));
    };
    const name = (t: string, color: string) => {
      const n = this.add.text(480, 70, t, { fontFamily: "Impact, sans-serif", fontSize: "54px", color, stroke: "#fff", strokeThickness: 8 }).setOrigin(0.5).setScale(0.2).setAngle(-6);
      layer.add(n);
      this.tweens.add({ targets: n, scale: 1, duration: 350, ease: "Back.out" });
      this.tweens.add({ targets: n, angle: 6, yoyo: true, repeat: -1, duration: 500 });
      synth.play("transform_sparkle");
    };
    const jingle = (y = 490) => {
      const j = this.add.text(480, y, "♪ Nibble on a Crobley ♪", { fontFamily: "Comic Sans MS, cursive", fontSize: "32px", color: "#db2777", stroke: "#fff", strokeThickness: 6 }).setOrigin(0.5);
      layer.add(j);
      this.tweens.add({ targets: j, scale: 1.08, yoyo: true, repeat: -1, duration: 320 });
    };
    const put = (x: number, y: number, key: string, scale: number, color?: number, label?: string) => {
      const o = this.art(x, y, key, scale, color, label);
      layer.add(o);
      return o;
    };
    /** An animation sheet from public/art/ad, looping (or a fallback blob). */
    const anim = (x: number, y: number, key: string, scale: number, fps = 10, color = 0xf9a8d4, label = "", repeat = -1) => {
      if (!this.textures.exists(key)) return put(x, y, key, scale, color, label) as unknown as Phaser.GameObjects.Sprite;
      const ak = `${key}_loop`;
      if (!this.anims.exists(ak)) this.anims.create({ key: ak, frames: this.anims.generateFrameNumbers(key, {}), frameRate: fps, repeat: -1 });
      const s = this.add.sprite(x, y, key, 0).setScale(scale);
      s.play({ key: ak, frameRate: fps, repeat });
      layer.add(s);
      return s;
    };
    const fx = (key: string, x: number, y: number, scale: number) => {
      const s = vfx(this, key, x, y, { scale, depth: layer.depth + 1 });
      if (s) layer.add(s);
      return s;
    };
    const boom = (x: number, y: number, size = 1.2) => {
      synth.play("explode", 0.45);
      this.cameras.main.shake(220, 0.014);
      if (this.boomAt(x, y, size, layer.depth + 1, layer)) return;
      for (let i = 0; i < 3; i++) {
        const c = this.add.circle(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 40, 14, i % 2 ? 0xfde047 : 0xf97316);
        layer.add(c);
        this.tweens.add({ targets: c, radius: 90, alpha: 0, duration: 500 + i * 100 });
      }
    };
    /**
     * Tank Crobley as two parts (ad_tank_hull + ad_tank_top, facing right) so the turret can turn and aim. The turret
     * pivots on its ring (frame 47,52 of 115x97); the barrel tip sits 68 px ahead and 22 px up of the pivot.
     */
    const tank = (x: number, y: number, sc: number) => {
      const c = this.add.container(x, y);
      layer.add(c);
      const split = this.textures.exists("ad_tank_top") && this.textures.exists("ad_tank_hull");
      const hull = split ? this.add.sprite(0, 0, "ad_tank_hull", 0).setScale(sc) : (this.art(0, 0, "p_tankc", sc, 0x4d7c0f, "TANK") as unknown as Phaser.GameObjects.Sprite).setFlipX(true);
      const px = (47 - 57.5) * sc, py = (52 - 48.5) * sc;
      const top = split ? this.add.sprite(px, py, "ad_tank_top", 0).setScale(sc).setOrigin(47 / 115, 52 / 97) : null;
      c.add(top ? [hull, top] : [hull]);
      if (split) {
        for (const k of ["ad_tank_hull", "ad_tank_top"]) if (!this.anims.exists(`${k}_loop`)) this.anims.create({ key: `${k}_loop`, frames: this.anims.generateFrameNumbers(k, {}), frameRate: 10, repeat: -1 });
        hull.play("ad_tank_hull_loop");
        top!.play("ad_tank_top_loop");
      }
      const base = Math.atan2(-22, 68);
      const tip = () => {
        const a = top ? top.rotation : 0;
        const lx = 68 * sc, ly = -22 * sc;
        return { x: c.x + px + lx * Math.cos(a) - ly * Math.sin(a), y: c.y + py + lx * Math.sin(a) + ly * Math.cos(a) };
      };
      return {
        c,
        tip,
        /** Swing the turret round to point the barrel at (tx, ty). */
        aim: (tx: number, ty: number, ms = 450) => {
          if (!top) return;
          this.tweens.killTweensOf(top);
          const want = Phaser.Math.Clamp(Math.atan2(ty - (c.y + py), tx - (c.x + px)) - base, -0.9, 0.5);
          this.tweens.add({ targets: top, rotation: want, duration: ms, ease: "Back.out" });
        },
        /** Sweep the turret about while it's waiting. */
        scan: () => top && this.tweens.add({ targets: top, rotation: { from: -0.35, to: 0.15 }, yoyo: true, duration: 700, ease: "Sine.inOut" }),
        /** Fire: recoil, muzzle flash at the tip. */
        fire: () => {
          const t = tip();
          fx("vfx_muzzle", t.x, t.y, sc * 0.9);
          if (top) {
            const a = top.rotation + base;
            this.tweens.add({ targets: top, x: px - (Math.cos(a) * 10 * sc) / 3, y: py - (Math.sin(a) * 10 * sc) / 3, duration: 60, yoyo: true });
          }
          this.tweens.add({ targets: c, x: c.x - 8, duration: 70, yoyo: true });
          return t;
        },
      };
    };
    const sparkle = (x: number, y: number, n: number, every: number, emoji = "✨") => {
      for (let i = 0; i < n; i++)
        later(i * every, () => {
          const sp = this.add.text(x + (Math.random() - 0.5) * 140, y + (Math.random() - 0.5) * 60, emoji, { fontSize: "26px" }).setOrigin(0.5);
          layer.add(sp);
          this.tweens.add({ targets: sp, y: sp.y - 70, alpha: 0, duration: 1000 });
        });
    };

    // 0:00 kids on a picnic blanket, munching
    const kids = () => {
      clear();
      bg("cr_park");
      jingle();
      const k = anim(480, 350, "ad_kids", 3.2, 6, 0x60a5fa, "kids");
      this.tweens.add({ targets: k, y: 342, yoyo: true, repeat: -1, duration: 420 });
      for (let i = 0; i < 10; i++) {
        const c = put(Math.random() * 960, -40, "p_crobley", 2.4, 0xf9a8d4, "");
        this.tweens.add({ targets: c, y: 600, angle: 360, duration: 3200 + Math.random() * 2000, delay: i * 450, repeat: -1 });
      }
      const logo = this.add.text(480, 120, "CROBLEY®", { fontFamily: "Impact, sans-serif", fontSize: "80px", color: "#f472b6", stroke: "#fff", strokeThickness: 10 }).setOrigin(0.5).setScale(0);
      layer.add(logo);
      this.tweens.add({ targets: logo, scale: 1, duration: 600, ease: "Back.out" });
      this.tweens.add({ targets: logo, scale: 1.1, yoyo: true, repeat: -1, duration: 400, delay: 600 });
      sparkle(480, 300, 12, 700, "💖");
    };
    // 0:10 / 0:47 the sausage(s) grow
    const sausages = (n: number) => {
      clear();
      bg("cf_sausage", 0x9a8a7a);
      layer.add(this.add.rectangle(480, 270, 960, 540, 0x000000, 0.45));
      const spot = this.add.ellipse(480, 470, 820, 70, 0xfde68a, 0.3);
      layer.add(spot);
      for (let i = 0; i < n; i++) {
        const x = 480 + (i - (n - 1) / 2) * 260;
        const small = put(x, 430, "p_sausage_s", 1.2, 0xf9a8d4, "sausage");
        this.tweens.add({ targets: small, scale: 3.4, y: 360, duration: 1700, ease: "Quad.in", delay: i * 150 });
        this.tweens.add({ targets: small, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 90 });
        later(1650 + i * 150, () => {
          small.setVisible(false);
          synth.play("crit");
          this.cameras.main.shake(180, 0.01);
          const big = anim(x, 330, "ad_sausage", 0.5, 12, 0xb45309, "SAUSAGE");
          this.tweens.add({ targets: big, scale: 4.4, duration: 500, ease: "Back.out" });
          fx("vfx_crit", x, 280, 3);
        });
      }
      later(2300, () => {
        const t = this.add.text(480, 80, "GROWING!", { fontFamily: "Impact, sans-serif", fontSize: "60px", color: "#fde047", stroke: "#7c2d12", strokeThickness: 10 }).setOrigin(0.5).setScale(0.2);
        layer.add(t);
        this.tweens.add({ targets: t, scale: 1, duration: 300, ease: "Back.out" });
      });
    };
    // 0:15 Flirt
    const flirt = () => {
      clear();
      bg("cf_flirt");
      name("FLIRT CROBLEY!", "#ec4899");
      const f = anim(-120, 340, "ad_flirt", 3.4, 9, 0xf472b6, "FLIRT");
      this.tweens.add({ targets: f, x: 430, duration: 1000, ease: "Back.out" });
      this.tweens.add({ targets: f, scale: 3.9, duration: 4400, delay: 1000 });
      for (let i = 0; i < 12; i++)
        later(900 + i * 330, () => {
          const h = this.add.text(f.x + 120, f.y - 60, "❤", { fontSize: "30px", color: "#ec4899" });
          layer.add(h);
          this.tweens.add({ targets: h, x: 700 + Math.random() * 240, y: 60 + Math.random() * 200, alpha: 0, scale: 2, duration: 1200 });
        });
      later(2600, () => {
        const wink = this.add.text(430, 160, "*wink*", { fontFamily: FONT, fontSize: "28px", color: "#fff", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5);
        layer.add(wink);
        this.tweens.add({ targets: wink, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
      });
    };
    // 0:20 Tank
    const tankIntro = () => {
      clear();
      bg("cf_destruction");
      name("TANK CROBLEY!", "#15803d");
      const tk = tank(-200, 360, 3.2);
      this.tweens.add({ targets: tk.c, x: 300, duration: 1400, ease: "Quad.out" });
      // three targets, high and low: the turret swings to each before it fires
      const targets: [number, number][] = [[880, 170], [700, 400], [860, 330]];
      targets.forEach(([tx, ty], i) => {
        later(1300 + i * 1050, () => tk.aim(tx, ty, 380));
        later(1750 + i * 1050, () => {
          tk.fire();
          later(140, () => boom(tx, ty, 1.4));
        });
      });
      const fr = this.add.text(620, 160, "FREEDOM!", { fontFamily: "Impact, sans-serif", fontSize: "56px", color: "#fff", stroke: "#1d4ed8", strokeThickness: 8 }).setOrigin(0.5).setAlpha(0);
      layer.add(fr);
      this.tweens.add({ targets: fr, alpha: 1, delay: 1500, duration: 200 });
    };
    // 0:25.5 Gary
    const lantern = () => {
      clear();
      bg("cf_chinese");
      name("CHINESE CROBLEY!", "#dc2626");
      const c = anim(400, 350, "ad_lantern", 3.4, 7, 0xdc2626, "GARY");
      for (let i = 0; i < 3; i++)
        later(500 + i * 1300, () => {
          synth.play("ding");
          this.tweens.add({ targets: c, scale: 3.55, yoyo: true, duration: 120 });
          fx("vfx_confetti", 200 + Math.random() * 560, 140, 2.5);
        });
      const sigh = this.add.text(c.x, c.y - 190, "(sigh)", { fontFamily: FONT, fontSize: "22px", color: "#fff", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
      layer.add(sigh);
      this.tweens.add({ targets: sigh, alpha: 1, delay: 3200, duration: 400 });
    };
    // 0:30 Fruity: struts in, flirts with the men, wonks them off under the bar, and they krezz all over him
    const fruity = () => {
      clear();
      bg("cf_men");
      name("FRUITY CROBLEY!", "#c026d3");
      const men = anim(660, 330, "ad_men", 3, 6, 0x78350f, "MEN");
      men.stop();
      men.setFrame(0);
      /** Swap the men onto another sheet (jeans dropping / trembling with them down), if we have it. */
      const menPlay = (key: string, fps: number, repeat: number) => {
        if (!this.textures.exists(key) || !(men instanceof Phaser.GameObjects.Sprite)) return;
        const ak = `${key}_${repeat < 0 ? "loop" : "once"}`;
        if (!this.anims.exists(ak)) this.anims.create({ key: ak, frames: this.anims.generateFrameNumbers(key, {}), frameRate: fps, repeat });
        men.play({ key: ak, frameRate: fps, repeat });
      };
      const naked = this.textures.exists("ad_mennaked") ? "ad_mennaked" : "ad_men";
      // one horizontal bar across both men, from the belts to the tops of their thighs, and over Fruity's hands
      const bar = this.add.rectangle(640, 366, 340, 96, 0x000000).setVisible(false);
      const txt = this.add.text(640, 366, "CENSORED", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#fff" }).setOrigin(0.5).setVisible(false);
      const f = anim(-100, 370, "ad_fruity", 2.4, 10, 0xf0abfc, "FRUITY");
      this.tweens.add({ targets: f, x: 300, duration: 2200, ease: "Sine.out" });
      for (let i = 0; i < 20; i++)
        later(i * 180, () => {
          const g = this.add.star(Math.random() * 960, Math.random() * 400, 4, 3, 9, [0xf0abfc, 0xfde68a, 0x93c5fd][i % 3]);
          layer.add(g);
          this.tweens.add({ targets: g, angle: 180, alpha: 0, duration: 800 });
        });
      // 0:32.5 hello boys
      later(2500, () => {
        for (let i = 0; i < 6; i++)
          later(i * 260, () => {
            const h = this.add.text(f.x + 60, f.y - 120, "💋", { fontSize: "28px" });
            layer.add(h);
            this.tweens.add({ targets: h, x: 620 + Math.random() * 80, y: 210, alpha: 0, duration: 900 });
          });
      });
      // 0:34.5 the jeans come down; the bar goes up as soon as anything would show
      later(4500, () => {
        menPlay("ad_mendrop", 7, 0);
        synth.play("zip_down");
        later(250, () => synth.play("zip_down"));
        later(450, () => {
          layer.add([bar, txt]);
          bar.setVisible(true);
          txt.setVisible(true);
        });
        later(800, () => synth.play("crowd_gasp"));
      });
      // 0:36 he gets to work
      later(6000, () => {
        f.setPosition(600, 350).setFlipX(false);
        if (f instanceof Phaser.GameObjects.Sprite && this.textures.exists("ad_fruitypump")) {
          const ak = "ad_fruitypump_loop";
          if (!this.anims.exists(ak)) this.anims.create({ key: ak, frames: this.anims.generateFrameNumbers("ad_fruitypump", {}), frameRate: 18, repeat: -1 });
          f.play(ak);
        }
        this.tweens.add({ targets: f, y: 354, yoyo: true, repeat: -1, duration: 60 });
        layer.bringToTop(bar);
        layer.bringToTop(txt);
        this.tweens.add({ targets: [bar, txt], y: 369, yoyo: true, repeat: -1, duration: 60 });
        for (let i = 0; i < 22; i++) later(i * 220, () => synth.play(i % 3 ? "squelch" : "wonk"));
        later(600, () => menPlay(naked, 8, -1));
        later(2600, () => menPlay(naked, 16, -1));
        // the moaning builds
        for (const [t, v, p] of [[800, 0.35, 0.9], [1900, 0.45, 0.95], [2900, 0.55, 1], [3800, 0.6, 1.05]] as [number, number, number][])
          later(t, () => {
            synth.voice("mmm", v, p);
            synth.voice("grunt", v * 0.8, p * 0.85, 0.25);
          });
        for (const [t, s] of [[1200, "Ohh…"], [3000, "OHHH!"], [4600, "OH GOD!"]] as [number, string][])
          later(t, () => {
            const b = this.add.text(660 + (Math.random() - 0.5) * 120, 150, s, { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#fff", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setAngle((Math.random() - 0.5) * 20);
            layer.add(b);
            this.tweens.add({ targets: b, y: 120, alpha: 0, delay: 600, duration: 700 });
            this.cameras.main.shake(150, 0.004);
          });
      });
      // 0:42 krezz: it all goes over Fruity
      later(12000, () => {
        this.tweens.killTweensOf(f);
        if (f instanceof Phaser.GameObjects.Sprite) f.stop();
        f.setY(350);
        synth.play("moan_men");
        later(200, () => synth.play("tap_gush"));
        synth.voice("oh", 0.8, 0.8);
        synth.voice("grunt", 0.8, 0.7, 0.4);
        this.cameras.main.flash(120, 255, 255, 255);
        const stuck: [number, number][] = [[-30, -80], [25, -60], [-10, -20], [40, 10], [-45, 20], [5, -105], [20, 40]];
        stuck.forEach(([dx, dy], i) =>
          later(i * 140, () => {
            const sx = 600 + (i % 2 ? 80 : -60);
            const s = put(sx, 392, "ad_splat", 0.6, 0xffffff, "");
            this.tweens.add({ targets: s, x: f.x + dx, y: f.y + dy, scale: 1.6 + Math.random() * 0.6, angle: Math.random() * 360, duration: 260, ease: "Quad.out", onComplete: () => synth.play(i % 2 ? "splat_1" : "splat_2") });
          }),
        );
        later(1200, () => {
          menPlay(naked, 4, -1);
          this.tweens.add({ targets: men, y: 345, angle: 3, duration: 600 });
        });
      });
    };
    // 0:53 the family
    const family = () => {
      clear();
      bg("bg_ad_lounge");
      const glow = this.add.star(560, 220, 16, 60, 520, 0xfff7c2, 0.25);
      layer.add(glow);
      this.tweens.add({ targets: glow, angle: 360, duration: 9000 });
      const dad = put(500, 300, "p_dad", 4.6, 0x1e3a8a, "DAD");
      const uncle = put(660, 300, "ad_uncle", 3.0, 0x15803d, "UNCLE");
      this.tweens.add({ targets: [dad, uncle], y: 294, yoyo: true, repeat: -1, duration: 900 });
      const boy = anim(300, 380, "ad_boy", 4.2, 6, 0x60a5fa, "boy");
      void boy;
      sparkle(330, 240, 7, 450);
      sparkle(580, 140, 6, 500, "💖");
      const t = this.add.text(480, 500, "Crobley. For the whole family.", { fontFamily: "Georgia, serif", fontSize: "28px", color: "#fff7ed", fontStyle: "italic", stroke: "#7c2d12", strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      layer.add(t);
      this.tweens.add({ targets: t, alpha: 1, duration: 800, delay: 600 });
    };
    // 0:57 the changing room: dad and uncle, naked, dancing; their censor bars swing, then helicopter
    const changing = () => {
      clear();
      bg("bg_ad_changing");
      synth.play("splash");
      const dancers: { s: Phaser.GameObjects.Sprite; hub: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Rectangle; cx: number; cy: number; ph: number }[] = [];
      // crotch = where the briefs sit in the 64x96 frame, from the frame centre
      for (const [x, key, cx, cy, ph] of [[340, "ad_daddance", -1, 11, 0], [620, "ad_uncledance", 0, 14, Math.PI * 0.6]] as [number, string, number, number, number][]) {
        const s = anim(x, 300, key, 3.4, 11, 0xfcd5b4, "MAN");
        const bar = this.add.rectangle(0, 0, 26, 150, 0x000000).setOrigin(0.5, 0.06);
        const hub = this.add.rectangle(0, 0, 50, 34, 0x000000);
        layer.add([bar, hub]);
        dancers.push({ s, hub, bar, cx, cy, ph });
      }
      const t0 = this.time.now;
      const ev = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (skipped || !layer.active) return ev.remove();
          const t = (this.time.now - t0) / 1000;
          for (const d of dancers) {
            // the dad-dance: hips sway and the whole body bobs
            const sway = Math.sin(t * 7 + d.ph);
            d.s.x = (d === dancers[0] ? 340 : 620) + sway * 14;
            d.s.angle = sway * 4;
            d.s.y = 300 + Math.abs(Math.cos(t * 7 + d.ph)) * -10;
            const rad = Phaser.Math.DegToRad(d.s.angle);
            const ox = d.cx * 3.4, oy = d.cy * 3.4;
            const px = d.s.x + ox * Math.cos(rad) - oy * Math.sin(rad);
            const py = d.s.y + ox * Math.sin(rad) + oy * Math.cos(rad);
            d.hub.setPosition(px, py).setAngle(d.s.angle);
            d.bar.setPosition(px, py);
            // 0-4s a pendulum swing, 4-7s bigger and bigger, then full helicopter turns that keep speeding up
            let a: number;
            if (t < 4) a = -sway * 30;
            else if (t < 7) a = -Math.sin(t * 7 + d.ph) * (30 + (t - 4) * 50);
            else a = 180 + (t - 7) * (t - 7) * 220 + (t - 7) * 360;
            d.bar.setAngle(a);
          }
        },
      });
      // the helicopter whoosh belongs to this scene only: it stops when the tank rolls in
      const whoosh = this.time.addEvent({ delay: 220, startAt: 0, loop: true, callback: () => { if (skipped || !layer.active || tankIn) return whoosh.remove(); if ((this.time.now - t0) > 7000) synth.play("swing"); } });
      timers.push(ev, whoosh);
      later(7200, () => {
        const h = this.add.text(480, 90, "WHUP WHUP WHUP", { fontFamily: "Impact, sans-serif", fontSize: "50px", color: "#fde047", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setScale(0.3);
        layer.add(h);
        this.tweens.add({ targets: h, scale: 1, duration: 300, ease: "Back.out" });
        this.tweens.add({ targets: h, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 120 });
      });
      later(10500, () => {
        for (const d of dancers) this.tweens.add({ targets: d.s, y: 250, duration: 1500 });
        this.cameras.main.shake(1500, 0.006);
      });
    };
    // 1:10 Tank Crobley has had enough of the rest of them
    const massacre = () => {
      tankIn = true;
      clear();
      bg("cr_park");
      jingle();
      const victims: [Phaser.GameObjects.Sprite, string, string, number][] = [
        [anim(520, 360, "ad_flirtscared", 2.4, 12, 0xf472b6, "FLIRT"), "Flirt Crobley. You make me feel fucking sick.", "FLIRT", 2500],
        [anim(690, 350, "ad_fruityscared", 2.4, 12, 0xf0abfc, "FRUITY"), "Fruity Crobley. You make me feel fucking sick.", "FRUITY", 2700],
        [anim(850, 360, "ad_lanternscared", 2.4, 12, 0xdc2626, "GARY"), "Gary. You also make me feel fucking sick.", "GARY", 2500],
      ];
      const tk = tank(-200, 380, 2.8);
      this.tweens.add({ targets: tk.c, x: 190, duration: 900, ease: "Quad.out" });
      later(900, () => tk.scan());
      later(300, () => synth.play("crowd_gasp"));
      let at = 700;
      for (const [v, , , gap] of victims) {
        later(at, () => {
          // the turret swings round onto him
          tk.aim(v.x, v.y - 10, 600);
        });
        later(at + gap - 300, () => {
          const m = tk.fire();
          const shell = this.add.circle(m.x, m.y, 9, 0x111827);
          layer.add(shell);
          this.tweens.add({
            targets: shell, x: v.x, y: v.y - 10, duration: 260, onComplete: () => {
              shell.destroy();
              boom(v.x, v.y, 1.6);
              // torn apart (gfx/GoreDeath.ts; gore off: sooty, smoking, over he goes)
              goreDeath(this, v, "blast", { fromX: m.x, quiet: true });
            },
          });
        });
        at += gap;
      }
    };
    const ending = () => {
      clear();
      layer.add(this.add.rectangle(480, 270, 960, 540, 0x000000));
      const t = this.add.text(480, 240, "YOU HEARD WHAT\nYOU THOUGHT YOU HEARD", { fontFamily: "Impact, sans-serif", fontSize: "56px", color: "#ffffff", align: "center" }).setOrigin(0.5).setAlpha(0);
      layer.add(t);
      this.tweens.add({ targets: t, alpha: 1, duration: 250 });
      const logo = this.add.text(480, 420, "CROBLEY®", { fontFamily: "Impact, sans-serif", fontSize: "40px", color: "#f472b6" }).setOrigin(0.5).setAlpha(0);
      layer.add(logo);
      this.tweens.add({ targets: logo, alpha: 1, duration: 400, delay: 300 });
    };
    const plan: [number, () => void][] = [
      [0, kids],
      [10, () => sausages(1)],
      [15, flirt],
      [20, tankIntro],
      [25.5, lantern],
      [30, fruity],
      [47, () => sausages(3)],
      [53, family],
      [57, changing],
      [70, massacre],
      [79, ending],
    ];
    voice.prefetch([
      { s: "FLIRT CROBLEY", t: "Hey, sugar. Wanna nibble?" },
      { s: "TANK CROBLEY", t: "FREEDOM!" },
      { s: "GARY", t: "Why am I holding a lantern." },
      { s: "FRUITY CROBLEY", t: "Hello, boys!" },
      { s: "FRUITY CROBLEY", t: "Ooh. Messy." },
      { s: "TANK CROBLEY", t: "Flirt Crobley. You make me feel fucking sick." },
      { s: "TANK CROBLEY", t: "Fruity Crobley. You make me feel fucking sick." },
      { s: "TANK CROBLEY", t: "Gary. You also make me feel fucking sick." },
    ]);
    synth.music("crobley", true);
    const advert = this.add.text(20, 20, "ADVERTISEMENT", { fontFamily: FONT, fontSize: "12px", color: "#fff", backgroundColor: "#00000088", padding: { x: 4, y: 2 } }).setDepth(800);
    const skipHint = this.add.text(940, 520, "TAB: skip advert", { fontFamily: FONT, fontSize: "11px", color: "#fff", backgroundColor: "#00000066", padding: { x: 4, y: 2 } }).setOrigin(1, 1).setDepth(800);
    await new Promise<void>((resolve) => {
      for (const [t, fn] of plan) later(t * 1000, fn);
      const done = () => {
        if (skipped) return;
        skipped = true;
        timers.forEach((x) => x.remove());
        this.input.keyboard?.off("keydown-TAB", skip);
        resolve();
      };
      const skip = () => done();
      this.input.keyboard?.on("keydown-TAB", skip);
      timers.push(this.time.delayedCall(82500, done));
    });
    voice.stop();
    synth.stopMusic();
    advert.destroy();
    skipHint.destroy();
    clear();
    layer.destroy(true);
    synth.music("ominous");
  }

  /** Sergeant Swig, a bag of money, and a press conference that goes the usual way. */
  private async crobleyPresser() {
    // you're in the room, in the press pack: the backs of the photographers in front of you, Swig at the lectern
    if (!backdrop(this, "bg_press", { depth: -10 })) this.add.rectangle(480, 270, 960, 540, 0x1e2a44);
    this.add.text(480, 50, "KRELFORD CONSTABULARY · PRESS CONFERENCE\n'THE SO-CALLED LIVE TELEVISION MURDER'", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", fontStyle: "bold", align: "center", backgroundColor: "#1e3a8acc", padding: { x: 10, y: 4 } }).setOrigin(0.5);
    const swigP = hasAnchor(this, "SERGEANT SWIG") ? new Presenter(this, "SERGEANT SWIG", 480, 352, 2.5) : null;
    if (swigP) {
      swigP.spr.setDepth(15);
      this.talkers.set("SERGEANT SWIG", swigP);
    }
    if (!swigP) this.add.rectangle(480, 330, 140, 90, 0x5a3a20).setDepth(20);
    const swig = swigP?.spr ?? this.add.sprite(480, 280, "npc_swig", 0).setScale(3).setDepth(15);
    const pile = this.art(395, 262, "p_crobley", 1.1, 0xf9a8d4).setDepth(21);
    void pile;
    const bag = this.add.container(680, 318).setDepth(22);
    bag.add(this.add.ellipse(0, 0, 90, 80, 0x8b6b3e).setStrokeStyle(3, 0x3f2d16));
    bag.add(this.add.text(0, -4, "£££\nMONEY FROM\nREINHARDT", { fontFamily: FONT, fontSize: "10px", color: "#fef3c7", align: "center", fontStyle: "bold" }).setOrigin(0.5));
    // TV cameras on tripods at the sides of the room
    const rigs = [tripodRig(this, 150, 372, 1.15, 24), tripodRig(this, 815, 366, 1.1, 24), tripodRig(this, 265, 392, 1.25, 26)];
    // the press pack, from behind (you're among them)
    const press: Phaser.GameObjects.Sprite[] = [];
    const backs = this.textures.exists("tvpress_backs");
    for (let i = 0; i < 8; i++) {
      const sp = backs
        ? this.add.sprite(70 + i * 118 + (i % 2) * 18, 452 + (i % 2) * 26, "tvpress_backs", (i * 5) % 16).setOrigin(0.5, 1).setScale(2.3)
        : this.add.sprite(250 + i * 85, 470 + (i % 2) * 12, `spr_FOLK${i % 4}`, 0).setScale(2.4);
      sp.setDepth(30 + i);
      press.push(sp);
      this.tweens.add({ targets: sp, y: sp.y - 3 - (i % 3), duration: 420 + i * 60, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: i * 80 });
    }
    // the other two lads, beside you at the back
    const lads = LADS.filter((p) => p !== G.s.player).slice(0, 2);
    lads.forEach((id, i) => this.add.sprite(36 + i * 46, 420 + i * 10, `spr_${id}`, 0).setScale(2.2).setDepth(40));
    synth.music("ominous");
    // flashes going off around you (gentle with reduced flashing on)
    const flashLayer = this.add.container(0, 0).setDepth(60);
    const flash = () => {
      const p = press[Math.floor(Math.random() * press.length)];
      if (!p.active || p.angle) return;
      cameraFlash(this, flashLayer, p.x + 14, p.y - p.displayHeight * 0.78, Math.random() < 0.4 ? { SX: 0, SY: 0, SW: 960, SH: 540 } : undefined);
    };
    const flashes = this.time.addEvent({ delay: 900, loop: true, callback: () => this.time.delayedCall(Math.random() * 700, flash) });
    // whoever's asking: their hand goes up in the pack
    const asker = new Map<string, Phaser.GameObjects.Sprite>();
    this.onOtherLine = (who) => {
      if (!asker.has(who)) asker.set(who, press[(asker.size * 3 + 2) % press.length]);
      const p = asker.get(who)!;
      if (!p.active || p.angle) return;
      this.tweens.add({ targets: p, y: p.y - 22, duration: 160, yoyo: true, hold: 900, ease: "Quad.out" });
      this.time.delayedCall(250, flash);
    };
    const munch = () => {
      synth.play("gulp");
      if (swigP) {
        swigP.stopTalking();
        swigP.setPose("munch");
        this.time.delayedCall(1100, () => swigP.poseName === "munch" && swigP.setPose("rest"));
      } else {
        swig.setFrame(3);
        this.time.delayedCall(140, () => swig.setFrame(0));
      }
    };
    await this.talk([
      dir("Sergeant Swig takes the podium. He is holding a can of beer. There are three more cans on the lectern. There is a family-size bag of Crobleys. There is a large sack, next to him, with 'MONEY FROM REINHARDT' written on it in marker pen."),
      say("SERGEANT SWIG", "Right. Questions. Make it quick, I've got a Crobley on the go."),
      say("REPORTER", "Sergeant, millions of people watched Reinhardt Crobley shoot a newsreader on live television—"),
      say("SERGEANT SWIG", "Did they though?"),
    ]);
    munch();
    await this.talk([
      say("SERGEANT SWIG", "You can't believe everything you see these days. There is a lot of stuff involving A.I. and you can't trust anything and plus there is also woke stuff"),
      say("SERGEANT SWIG", "I've done my own independent research. And from what I can see, it seems that everyone here is lying."),
      say("REPORTER", "He confessed. On camera. He said 'just like I killed my father'."),
      say("SERGEANT SWIG", "That quote is out of context."),
    ]);
    munch();
    synth.play("slurp");
    if (swigP) {
      swigP.setPose("beer");
      this.time.delayedCall(1300, () => swigP.poseName === "beer" && swigP.setPose("rest"));
    }
    await this.talk([
      say("REPORTER", "Sergeant — what's in the bag?"),
      dir("Everyone looks at the bag. The bag says MONEY FROM REINHARDT."),
      say("SERGEANT SWIG", "What bag."),
      say("REPORTER", "The bag next to you. It says 'money from Reinhardt'."),
      say("SERGEANT SWIG", "You'd have to be so stupid to think anything of that. Honestly. So stupid. Stupid fucking bitch."),
    ]);
    munch();
    await this.talk([
      dir("A female journalist in the second row stands up. She has a notepad. She has the look of someone who is about to ask a very good question."),
      say("JOURNALIST", "Sergeant Swig, is the Krelford Constabulary being paid by Reinhardt Crobley to ignore a murder—"),
      say("SERGEANT SWIG", "Sorry. I couldn't hear anything. Just a squawking noise coming out of your fucking mouth."),
      dir("The room erupts. Booing. Shouting. Somebody throws a Crobley."),
      say("SERGEANT SWIG", "Right. I'm fucking fed up!"),
    ]);
    this.onOtherLine = undefined;
    flashes.remove();
    // he draws
    if (swigP) {
      swigP.stopTalking();
      swigP.setPose("gun");
    } else swig.setFrame(3);
    synth.play("telegraph");
    this.cameras.main.shake(200, 0.004);
    await this.wait(450);
    const victims: Victim[] = press.map((spr) => ({ spr, hp: 1 + Math.floor(Math.random() * 2) }));
    await shootout(this, { muzzle: () => ({ x: swig.x + 4, y: swig.y - swig.displayHeight * 0.4 }), victims, rigs, shots: 20, depth: 40, shooter: swig });
    // anyone still standing runs for it
    for (const v of victims) if (v.hp > 0) this.tweens.add({ targets: v.spr, x: v.spr.x < 480 ? -120 : 1080, duration: 900, ease: "Quad.in" });
    for (let i = 0; i < 5; i++) vfx(this, "vfx_smoke", 300 + i * 90, 300 + (i % 2) * 40, { scale: 1.6, depth: 70, delay: i * 120 });
    await this.wait(1600);
    synth.stopMusic();
    if (swigP) swigP.setPose("rest");
    const [a, b] = lads;
    await this.talk([
      dir("When the smoke clears, the press pool is gone. Swig is eating a Crobley. The bag is still there."),
      say(a, "Well. Looks like the police are going to do fuck all."),
      say(b, "Shocker."),
      say(G.s.player, "We need to take matters into our own hands."),
      say(a, "We need to kill Reinhardt Crobley."),
      say(b, "Bring Crobson Crobley back to life."),
      say(G.s.player, "And return the Crobley Corporation to its rightful owner."),
      dir("NEW OBJECTIVE: storm the Crobley Factory. The gate is on the east edge of Krelford."),
    ]);
  }

  /** The whole factory goes up. Then an awkward conversation. */
  private async crobleyBoom() {
    const hasExt = !!backdrop(this, "cr_factory_ext", { depth: -10 });
    let giant: Phaser.GameObjects.Image | null = null;
    const g = this.add.graphics().setDepth(5);
    if (!hasExt) {
      this.sky(0x1e1b4b, 0xdb2777);
      g.fillStyle(0x7c2d12, 1).fillRect(220, 220, 520, 260);
      g.fillStyle(0x9d174d, 1).fillRect(260, 120, 50, 110).fillRect(400, 90, 50, 140).fillRect(640, 130, 50, 100);
      giant = this.art(480, 200, "p_crobley", 4, 0xf9a8d4).setDepth(6);
      this.add.rectangle(480, 500, 960, 80, 0x1f2937).setDepth(4);
    }
    const me = this.add.sprite(300, 480, playerKey(this), 0).setScale(2.6).setDepth(20);
    synth.music("ominous");
    await this.talk([dir("You sprint out of the factory gates. Behind you, a low rumble. Then a higher rumble. Then a rumble that sounds a lot like a child singing 'Nibble on a Crobley', very slowly, underwater.")]);
    await this.tween({ targets: me, x: 900, duration: 900 });
    me.setFlipX(true);
    // it goes, from the inside out
    const cam = this.cameras.main;
    const fire = (x: number, y: number, big: number) => {
      if (this.boomAt(x, y, 0.9 + big * 0.8, 31)) return;
      const core = this.add.circle(x, y, 10, 0xfff7c2, 1).setDepth(31);
      const ring = this.add.circle(x, y, 14, 0xf97316, 0.95).setDepth(30);
      const smoke = this.add.circle(x, y - 10, 18, 0x3f3f46, 0.8).setDepth(29);
      this.tween({ targets: core, radius: 40 * big, alpha: 0, duration: 380 }).then(() => core.destroy());
      this.tween({ targets: ring, radius: 80 * big, alpha: 0, duration: 650 }).then(() => ring.destroy());
      this.tween({ targets: smoke, radius: 70 * big, y: y - 140 * big, alpha: 0, duration: 1800 }).then(() => smoke.destroy());
      for (let k = 0; k < 6; k++) {
        const sp = this.add.rectangle(x, y, 3, 3, 0xfde047).setDepth(32);
        this.tween({ targets: sp, x: x + (Math.random() - 0.5) * 300 * big, y: y + (Math.random() - 0.8) * 260 * big, alpha: 0, duration: 700 + Math.random() * 500 }).then(() => sp.destroy());
      }
    };
    for (let i = 0; i < 28; i++) {
      this.time.delayedCall(i * 120, () => {
        synth.play("explode");
        cam.shake(160, 0.012 + i * 0.0012);
        fire(180 + Math.random() * 600, 120 + Math.random() * 300, 0.8 + i / 28);
      });
    }
    // the mascot gets launched into orbit
    const mascot = giant ?? (this.textures.exists("p_crobley") ? this.add.image(480, 150, "p_crobley").setScale(3).setDepth(33).setAlpha(0) : null);
    this.time.delayedCall(2000, () => mascot && (mascot.setAlpha(1), this.tween({ targets: mascot, y: -300, x: 700, angle: 1440, duration: 2200, ease: "Quad.out" })));
    await this.wait(3500);
    synth.play("boom");
    cam.flash(1200, 255, 255, 255);
    cam.shake(900, 0.04);
    const white = this.add.rectangle(480, 270, 960, 540, 0xffffff, 1).setDepth(100);
    this.caption("KA-BLOOEY", "#fde047", 64);
    // it rains Crobleys and sausages
    for (let i = 0; i < 40; i++) {
      this.time.delayedCall(600 + i * 80, () => {
        const t = this.add.text(Math.random() * 960, -30, Math.random() < 0.5 ? "🌭" : "🍬", { fontSize: "22px" }).setDepth(140);
        this.tween({ targets: t, y: 560, angle: 360, duration: 1400 + Math.random() * 800 }).then(() => t.destroy());
      });
    }
    // the dust settles: what's left is a crater
    g.clear();
    if (!backdrop(this, "cr_crater", { depth: -5 })) this.add.rectangle(480, 270, 960, 540, 0x3f1d1d).setDepth(-5);
    await this.wait(900);
    await this.tween({ targets: white, alpha: 0, duration: 1600 });
    white.destroy();
    for (let i = 0; i < 6; i++) {
      const sm = this.add.circle(200 + i * 110, 330, 30, 0x52525b, 0.5).setDepth(8);
      this.tweens.add({ targets: sm, y: 120, radius: 90, alpha: 0, duration: 4000, repeat: -1, delay: i * 500 });
    }
    await this.wait(1500);
    this.lastCaption?.destroy();
    // the lads, and someone under a blanket
    const lads = LADS.filter((p) => p !== G.s.player).slice(0, 3);
    lads.forEach((id, i) => this.add.sprite(120 + i * 70, 470, `spr_${id}`, 0).setScale(2.6).setDepth(22));
    const crobson = this.add.sprite(340, 472, "spr_FOLK2", 0).setScale(2.6).setDepth(22).setTint(0xc7d2fe);
    this.add.text(340, 410, "CROBSON CROBLEY\n(RECENTLY RESURRECTED)", { fontFamily: FONT, fontSize: "10px", color: "#e0e7ff", backgroundColor: "#000000aa", align: "center", padding: { x: 3, y: 2 } }).setOrigin(0.5).setDepth(23);
    this.tweens.add({ targets: crobson, angle: 3, yoyo: true, repeat: -1, duration: 700 });
    me.setPosition(560, 470);
    const [a, b, c] = lads;
    await this.talk([
      say(a, "LADS! LADS! We did it! Krezwonk's guy came through!"),
      say(b, "Say hello to Crobson Crobley! Back from the dead! Founder! Legend! Rightful owner of the Crobley Corporation!"),
      say("CROBSON CROBLEY", "Hello lads. Thank you. What a strange experience. I'm very much looking forward to getting back to work. To my factory. My life's work."),
      dir("Everyone turns, slowly, to look at the smouldering crater where the factory used to be. A single Crobley rolls out of it, on fire, and stops at Crobson's feet."),
      say(G.s.player, "…Oh. Oh no. I completely forgot you were doing that."),
      say(G.s.player, "I have — very sadly, and very unfortunately — destroyed the entire factory."),
      say("CROBSON CROBLEY", "…"),
      say(c, "…"),
      say(a, "Right."),
      say(b, "So he's got no factory."),
      say(a, "No factory, no company, no Crobleys."),
      say(c, "So what's he going to do? Just… live? With nothing?"),
      dir("A very long pause. Somewhere, a sausage pops in the embers."),
      say(b, "…We're going to have to kill him again."),
      say("CROBSON CROBLEY", "My factory…my life's work..all gone..up in ashes. No..no…"),
      dir("You walk away slowly, you hear several gunshots, and a chainsaw revving up. Crobson Crobley is now in heaven again."),
    ]);
    G.s.flags.crobley_factory_destroyed = true;
    synth.stopMusic();
  }

  // ---------------------------------------------------------------- OPERATION PLANE INTO TRAIN
  // The cockpit, the drugs, the juice, the ejector seat, the Kreddle Express, the Krel Tower.

  private async planeEscape() {
    const me = G.s.player;
    G.rt.timerEnd = 0;
    G.emit("timer", null);
    // a lad on the ground to deliver the bad news (never the player)
    const lad = (pref: string[]) => pref.find((p) => p !== me) ?? "KREBLIS";
    // ---- the cockpit
    const dash = this.cockpitFrame();
    // the autopilot holds her straight and level while you work out the buttons (the same view as the flight)
    const outside = createFlightView(this, { cx: 480, cy: dash.viewY, depth: 0 });
    const idle = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const t = this.time.now;
        outside.update({ ax: Math.sin(t / 2300) * 0.08, ay: Math.sin(t / 3100) * 0.05, dt: 16, progress: 0 });
        dash.update(0, 0, t);
      },
    });
    synth.music("boss_krozno", true);
    await this.talk([
      dir("The cockpit of Flight KR-069. Captain Stanley is in no position to object. There are four hundred buttons. One of them is labelled 'DO NOT'."),
      say("MIKEY", "(over the radio) You're in? Legend. Right. Find the train. Fly the plane into the train.", { cond: { notPlayer: "MIKEY" } }),
      say("SCROMBUS", "(over the radio) You're in? Legend. Right. Find the train. Fly the plane into the train.", { cond: { player: "MIKEY" } }),
      say(me, "I don't know how to fly a plane."),
      say("KREZMAR", "(over the radio) Nobody knows how to fly a plane, mate. That's what the drugs are for. Glovebox."),
      dir("You open the glovebox. Inside: a little bag. On the bag, in Captain Stanley's neat handwriting: 'CONFIDENCE (LONG HAUL)'."),
    ]);
    await this.takeDrugs();
    await this.talk([
      dir("Oh. Oh, that's lovely. Your hands are steady. The four hundred buttons make sense now. They're all friends. One of them waves at you."),
      say(me, "…I know how to fly a plane.", { cine: "ch6_hijack" }),
      say("KREZWONK", "(over the radio) He knows how to fly a plane.", { cond: { notPlayer: "KREZWONK" } }),
      say("KREBLIS", "(over the radio) He knows how to fly a plane.", { cond: { player: "KREZWONK" } }),
    ]);
    idle.remove();
    outside.destroy();
    dash.root.destroy();
    // ---- the flight
    await this.juiceFlight();
    // ---- the ejector seat, the bang, and the come-down
    synth.play("boom");
    this.cameras.main.flash(500, 255, 255, 255);
    this.cameras.main.setRotation(0);
    this.clearStage();
    const sky2 = this.sky(0x8fc3ea, 0xf3d9b1);
    // Krelford centre (the same skyline the plane comes down over in a moment)
    if (backdrop(this, "bg_city", { depth: -10 })) sky2.setVisible(false);
    else {
      const g = this.add.graphics();
      g.fillStyle(0x5a6a80, 1);
      for (let i = 0; i < 20; i++) g.fillRect(i * 50, 330 - ((i * 37) % 90), 44, 300);
      g.fillStyle(0x3d6a2a, 1).fillRect(0, 440, 960, 100);
    }
    const haze = this.add.rectangle(480, 270, 960, 540, 0xff4fd8, 0.28).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
    // the Kreddle Express (or so the drugs say) sits exactly where the Krel Tower is about to be
    const tower = this.bigTower(640, 440, 9);
    tower.img.setAlpha(0);
    const carton = this.add.image(640, 440, this.textures.exists("p_train") ? "p_train" : "p_juice").setOrigin(0.5, 1).setDepth(10);
    carton.displayWidth = tower.w * 2.6;
    carton.displayHeight = (carton.displayWidth * carton.height) / carton.width;
    const label = this.add.text(640, 440 - carton.displayHeight - 24, "THE KREDDLE EXPRESS", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#ffffff", align: "center", stroke: "#b0247a", strokeThickness: 6 }).setOrigin(0.5).setDepth(11);
    const plane = this.airliner(150, 215, 220);
    const chute = this.chute(me, 120, 60);
    // EJECT: the seat rockets out, speed lines, and the little pink canopy pops
    Juice.speedLines(this, 700, 0xffffff, 985);
    Juice.whoosh(0.6);
    Juice.slamText(this, "EJECT!!", "#ff4fd8", 64, 200, 700, 990);
    chute.setScale(0.2);
    this.tweens.add({ targets: chute, scale: 1, duration: 450, ease: "Back.out", delay: 350, onStart: () => synth.play("pop") });
    this.tweens.add({ targets: plane, x: 300, y: tower.at(0.66), duration: 2600, ease: "Sine.inOut" });
    await this.talk([dir("You shoot out of the roof of KR-069 on a rocket-powered seat. A little pink parachute pops open. Below you, the plane carries on, straight and true, towards the Kreddle Express.")]);
    // the drugs wear off
    this.tween({ targets: haze, alpha: 0, duration: 1800 });
    this.tween({ targets: label, alpha: 0, duration: 1400 });
    // the train stands up and narrows into the tower's silhouette as the tower shimmers in
    this.tween({ targets: carton, alpha: 0, displayWidth: tower.w * 0.6, displayHeight: tower.h * 0.96, duration: 1800, ease: "Sine.inOut" });
    await this.tween({ targets: tower.img, alpha: 1, duration: 1800, ease: "Sine.inOut" });
    carton.destroy();
    this.add.text(640, 448, "THE KREL TOWER", { fontFamily: FONT, fontSize: "12px", color: "#ffffff", backgroundColor: "#00000099", padding: { x: 4, y: 2 } }).setOrigin(0.5, 0).setDepth(12);
    synth.play("gasp");
    this.cameras.main.shake(400, 0.01);
    await this.talk([
      dir("The Kreddle Express wobbles. It shimmers. It stands up on its end. It is, and possibly always was, the Krel Tower."),
      say(lad(["SCROMBUS", "KREZMAR"]), "(over the radio) Oh no!! You were hallucinating so badly from the drugs that you didn't realise you were heading straight for the Krel Tower! Noooooooooooo!"),
      say(lad(["FLENKY", "CRONGUS"]), "(over the radio) MOLLOR'S ON THE TOP FLOOR!!"),
      say(me, "…Has anyone seen the train though?"),
    ]);
    // ---- meanwhile: the Kreddle Express
    this.clearStage();
    void sky2;
    await this.kreddleExpress();
    // ---- back to the plane: everyone watches
    this.clearStage();
    const skyG = this.sky(0x3b4656, 0x6b7280);
    const g2 = this.add.graphics();
    g2.fillStyle(0x5a6a80, 1);
    for (let i = 0; i < 20; i++) g2.fillRect(i * 50, 300 - ((i * 37) % 90), 44, 300);
    g2.fillStyle(0x3d6a2a, 1).fillRect(0, 430, 960, 110);
    const city = backdrop(this, "bg_city", { depth: -10 });
    if (city) {
      skyG.setVisible(false);
      g2.setVisible(false);
      // a storm has rolled in over Krelford
      city.setTint(0x8a94a6);
      this.add.rectangle(480, 270, 960, 540, 0x0f172a, 0.35).setDepth(-9);
    }
    this.rainOver("storm", 960);
    const tw = this.bigTower(620, 440);
    const hitY = tw.at(0.66);
    const everyone = this.crowd(470);
    // (you're up there under the parachute, not down here: your spot in the crowd waits for you)
    const mySpot = everyone.find((p) => p.texture.key === playerKey(this));
    mySpot?.setVisible(false);
    const people = everyone.filter((p) => p !== mySpot);
    // the Great Tap, in the square below (where you're going to come down)
    const tap = this.textures.exists("hd_tap") ? this.add.image(300, 500, "hd_tap").setOrigin(0.5, 1).setDepth(45) : null;
    if (tap) tap.setScale(130 / tap.height);
    // Sanjeev, a little apart from the crowd, watching with his arms folded
    const sjv = this.actor("SANJEEV", 928, 486, 2.6);
    this.face(sjv, "west");
    synth.music("airport");
    const chute2 = this.chute(me, 150, -60);
    this.tween({ targets: chute2, y: 300, x: 110, duration: 9000, ease: "Sine.out" });
    await this.talk([dir("Back in Krelford, everyone is outside. Everyone is looking up. You are drifting down over them under a pink parachute, waving."), ...PE_RAIN]);
    const plane2 = this.airliner(1120, hitY - 80, 240, true);
    await this.talk([say(lad(["KREBLIS", "GRONNY"]), "Is that… is that the plane?")]);
    // the approach: bars in, the camera eases in on the tower, everything holds its breath
    synth.music("tower_crash", true);
    const peBars = Juice.letterbox(this, 46, 900, 985);
    this.cameras.main.pan(640, hitY + 40, 2600, "Sine.easeInOut", true);
    this.cameras.main.zoomTo(1.18, 2600, "Sine.easeIn", true);
    this.time.delayedCall(1700, () => Juice.riser(900, 0.35));
    await this.tween({ targets: plane2, x: 620 + plane2.displayWidth * 0.32, y: hitY, angle: -3, duration: 2600, ease: "Sine.in" });
    plane2.destroy();
    synth.play("boom");
    synth.play("explode_2");
    Juice.subDrop(1, 2.2);
    this.cameras.main.flash(500, 255, 240, 200);
    this.cameras.main.shake(1400, 0.03);
    // the punch, then a long pull back out to take it in
    this.cameras.main.setZoom(1.32);
    this.cameras.main.zoomTo(1, 2200, "Cubic.easeOut", true);
    this.cameras.main.pan(480, 270, 2200, "Cubic.easeOut", true);
    Juice.shockRing(this, 620, hitY, { color: 0xffe0a0, to: 520, rings: 3, depth: 17 });
    Juice.debris(this, 620, hitY, 18, { depth: 17, speed: 380, size: 7, floor: 440 });
    this.time.delayedCall(2300, () => peBars(500));
    this.boomAt(620, hitY, 3, 16);
    this.time.delayedCall(220, () => this.boomAt(620 + tw.w * 0.4, hitY + 30, 1.6, 16));
    this.time.delayedCall(380, () => this.boomAt(620 - tw.w * 0.35, hitY - 20, 1.4, 16));
    const fire = this.fireBlob(620, hitY + 6, 95, 15);
    for (let i = 0; i < (hasVfx(this, "vfx_smokecol") ? 0 : 18); i++) {
      const smoke = this.add.circle(620 + (Math.random() - 0.5) * 90, hitY - Math.random() * 40, 16 + Math.random() * 20, 0x333333, 0.7).setDepth(14);
      this.tween({ targets: smoke, y: smoke.y - 170, alpha: 0, scale: 2.5, duration: 3000 + Math.random() * 1500 });
    }
    this.people(people, "NOOOO!");
    synth.play("gasp");
    const noo: [string, string][] = [
      ["SCROMBUS", "Nooooooooo!"],
      ["KREZMAR", "NOOOOOOOO!!!"],
      ["MIKEY", "NOOOOOOOOOOOOOOOOOOO!"],
      ["GRONNY", "Nooo."],
      ["KREBON", "No."],
      ["CRONGUS", "NOOOOOO!! (on his knees)"],
    ];
    await this.talk([...noo.filter(([who]) => who !== me).map(([who, t]) => say(who, t)), ping("DRONGUS", "NOOOOOO not the Krel Tower !!"), ...SJ_TOWER_SIM]);
    synth.play("boom");
    Juice.subDrop(0.9, 3);
    this.cameras.main.shake(2800, 0.035);
    fire.destroy();
    this.collapseFx(tw);
    for (let i = 0; i < (hasVfx(this, "vfx_dust") ? 10 : 34); i++) {
      const dust = this.add.circle(620 + (Math.random() - 0.5) * 220, 430, 20 + Math.random() * 30, 0xb8a888, 0.85).setDepth(40);
      this.tween({ targets: dust, x: dust.x + (Math.random() - 0.5) * 740, y: 400 - Math.random() * 170, scale: 3, alpha: 0, duration: 3500, delay: 400 + Math.random() * 1400 });
    }
    await this.wait(700);
    // Jenko, as it comes down
    this.tweens.add({ targets: people.find((p) => p.texture.key === "spr_FLENKY") ?? [], y: "+=14", duration: 200 });
    await this.talk([say("FLENKY", "Noooo!! Mollor was in there!!!")]);
    // the drawn shot: you, drifting down under the pink canopy, the tower burning behind you
    Juice.subDrop(0.8, 2);
    await Juice.still(this, "c6a_still_chute", 2800, { depth: 995, push: 0.1, shakeK: 0 });
    this.caption("THE KREL TOWER HAS FALLEN (AGAIN)", "#ff4d4d", 30);
    synth.play("alarm");
    await this.wait(1600);
    this.dropCaption();
    await this.talk([dir("Silence. Then sirens.")]);
    // the landing: down through the dust, onto the Great Tap, in front of everyone
    this.tweens.killTweensOf(chute2);
    this.tweens.add({ targets: chute2, angle: { from: -5, to: 5 }, yoyo: true, repeat: -1, duration: 700 });
    await this.tween({ targets: chute2, x: 300, y: tap ? 500 - tap.displayHeight - 96 : 380, duration: 2200, ease: "Sine.inOut" });
    this.tweens.killTweensOf(chute2);
    chute2.setAngle(0);
    synth.play("land");
    synth.play("pop");
    vfx(this, "vfx_dust", chute2.x, chute2.y + 100, { scale: 1.4, depth: 75 });
    const canopy = chute2.list[0] as Phaser.GameObjects.Graphics | undefined;
    if (canopy) this.tween({ targets: canopy, scaleY: 0.25, y: 70, alpha: 0.6, angle: 20, duration: 600, ease: "Quad.in" });
    people.forEach((p, i) => this.time.delayedCall(i * 40, () => this.faceTo(p, chute2.x)));
    // down to street level, so the crowd (and Sanjeev) sit above the dialogue box
    this.cameras.main.pan(590, 425, 900, "Sine.easeInOut", true);
    this.cameras.main.zoomTo(1.35, 900, "Sine.easeInOut", true);
    await this.wait(900);
    await this.talk([
      dir("You land, gently, on top of the Great Tap."),
      say(me, "Did we get the train?"),
      say("KREZWONK", "So the plan worked.", { cond: { notPlayer: "KREZWONK" } }),
      say("KREBLIS", "Breaking news…", { cond: { notPlayer: "KREBLIS" } }),
      say("KREBLIS", "The train has been stopped 👍", { cond: { notPlayer: "KREBLIS" } }),
      say("KREBLIS", "By a burger", { cond: { notPlayer: "KREBLIS" } }),
      say("KREBON", "We could have turned the power off.", { cond: { notPlayer: "KREBON" } }),
      say("KREZMAR", "Krebon. Not today.", { cond: { notPlayer: "KREZMAR" } }),
      dir("Through the settling dust, one man hasn't moved. Sanjeev. Arms folded. Head tilted."),
      ...SJ_TOWER_DEMO,
      dir("THE KREL TOWER: DESTROYED (AGAIN). The Kreddle Express is parked outside Krelburger with its engine running. President Klerble is on his twelfth burger. They were Polson's."),
    ]);
    // the light goes out of the day: into Krelford, mourning
    this.dropCaption();
    synth.music("town_mourning", true);
    this.cameras.main.pan(480, 270, 800, "Sine.easeInOut", true);
    this.cameras.main.zoomTo(1, 800, "Sine.easeInOut", true);
    const dusk = this.add.rectangle(480, 270, 960, 540, 0x0b1020, 0).setDepth(900);
    await this.tween({ targets: dusk, fillAlpha: 0.75, duration: 1400 });
    // (the mourning theme carries straight on into town)
    await Juice.titleCard(this, "KRELFORD · THAT EVENING", "A TOWN IN MOURNING", "", 1900, 995);
    Object.assign(G.s.flags, { kreltower_resolved: true, kreltower_fell: true, arcstep_arc_klerble_hijack: true, polson_dead: true });
  }

  /**
   * First-person flight-sim cockpit: window pillars, glareshield, a live attitude display,
   * a nav screen tracking the Kreddle Express, engine dials and a yoke. Call update() each frame.
   */
  private cockpitFrame(): { root: Phaser.GameObjects.Container; update: (ax: number, ay: number, t: number) => void; viewY: number } {
    if (this.textures.exists("vg_cockpit")) return this.cockpitArt();
    const root = this.add.container(0, 0).setDepth(20);
    const g = this.add.graphics();
    root.add(g);
    // window pillars + overhead panel
    g.fillStyle(0x1a1d23, 1).fillRect(0, 0, 960, 30);
    g.fillTriangle(0, 30, 150, 30, 0, 330).fillTriangle(960, 30, 810, 30, 960, 330);
    g.fillRect(0, 0, 36, 540).fillRect(924, 0, 36, 540);
    g.fillStyle(0x2a2e36, 1).fillRect(470, 30, 20, 300);
    g.lineStyle(2, 0x3a404b, 1).lineBetween(150, 30, 0, 330).lineBetween(810, 30, 960, 330).lineBetween(470, 30, 470, 330).lineBetween(490, 30, 490, 330).lineBetween(0, 30, 960, 30);
    for (let i = 0; i < 26; i++) {
      g.fillStyle([0x10b981, 0xf59e0b, 0x334155, 0xef4444][(i * 7) % 4], 1).fillRect(120 + i * 28, 10, 10, 8);
    }
    // glareshield
    g.fillStyle(0x15171c, 1).fillRoundedRect(20, 312, 920, 50, 18);
    g.fillStyle(0x0d0f13, 1).fillRect(20, 345, 920, 10);
    // main instrument panel
    g.fillStyle(0x2b3039, 1).fillRect(0, 352, 960, 188);
    g.lineStyle(1, 0x3d4450, 1);
    for (const x of [56, 312, 648, 904]) g.lineBetween(x, 352, x, 540);
    for (let i = 0; i < 18; i++) g.fillStyle(0x4b5563, 1).fillCircle(46 + i * 51, 532, 2);
    // screen bezels
    const bezel = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0x0b0d10, 1).fillRoundedRect(x - 6, y - 6, w + 12, h + 12, 6);
      g.fillStyle(0x000000, 1).fillRect(x, y, w, h);
      for (let i = 0; i < 5; i++) g.fillStyle(0x3a404b, 1).fillRect(x + 8 + i * ((w - 16) / 4) - 5, y + h + 8, 10, 5);
    };
    bezel(70, 368, 228, 146);
    bezel(332, 368, 296, 146);
    bezel(662, 368, 228, 146);
    const txt = (x: number, y: number, t: string, c = "#22ff88", size = 11) => {
      const o = this.add.text(x, y, t, { fontFamily: "monospace", fontSize: `${size}px`, color: c, fontStyle: "bold" });
      root.add(o);
      return o;
    };
    // glareshield annunciators
    const caution = txt(70, 318, " MASTER CAUTION ", "#ffffff", 10).setBackgroundColor("#b91c1c");
    const ap = txt(780, 318, " A/P: DRUGS ", "#0b0f19", 10).setBackgroundColor("#22c55e");
    txt(372, 320, "FLT KR-069   SQUAWK 7500", "#f59e0b", 11);
    // the attitude display (masked)
    const pfd = this.add.graphics();
    const maskShape = this.make.graphics({}, false).fillRect(70, 368, 228, 146);
    pfd.setMask(maskShape.createGeometryMask());
    root.add(pfd);
    const fixed = this.add.graphics();
    root.add(fixed);
    fixed.lineStyle(4, 0xfacc15, 1).lineBetween(140, 441, 170, 441).lineBetween(170, 441, 176, 449).lineBetween(198, 441, 228, 441).lineBetween(198, 441, 192, 449);
    fixed.fillStyle(0xfacc15, 1).fillRect(181, 438, 6, 6);
    fixed.fillStyle(0x000000, 0.55).fillRect(70, 368, 36, 146).fillRect(262, 368, 36, 146);
    const spd = txt(72, 434, "287", "#ffffff", 12);
    const alt = txt(264, 434, "3500", "#ffffff", 11);
    txt(74, 372, "SPD", "#22d3ee", 9);
    txt(266, 372, "ALT", "#22d3ee", 9);
    // nav display
    const nd = this.add.graphics();
    root.add(nd);
    txt(340, 372, "HDG 069   GS 312", "#ffffff", 10);
    txt(560, 372, "TCAS TA", "#f59e0b", 10);
    const tgt = txt(480, 392, "◆ KREDDLE EXP", "#ff4fd8", 10).setOrigin(0.5, 0);
    // engines / systems
    const eng = this.add.graphics();
    root.add(eng);
    txt(686, 448, "  N1    CONF", "#cbd5e1", 10);
    const conf = txt(672, 466, "CONFIDENCE 900%", "#ff4fd8", 12);
    txt(672, 484, "FUEL: PUSSY JUICE", "#22ff88", 10);
    txt(672, 498, "CABIN: SCREAMING", "#f59e0b", 10);
    // the yoke
    const yoke = this.add.container(480, 596);
    const yg = this.add.graphics();
    yg.fillStyle(0x111318, 1).fillRect(-14, -40, 28, 60);
    yg.fillStyle(0x1f232b, 1).fillRoundedRect(-120, -64, 240, 26, 10);
    yg.fillRoundedRect(-128, -92, 34, 64, 10).fillRoundedRect(94, -92, 34, 64, 10);
    yg.fillStyle(0xef4444, 1).fillRect(-122, -86, 8, 6);
    yg.fillStyle(0x9ca3af, 1).fillCircle(0, -51, 9);
    yoke.add(yg);
    root.add(yoke);
    let sweep = 0;
    const update = (ax: number, ay: number, t: number) => {
      // attitude: roll with the steering, pitch with up/down
      const r = -ax * 0.5 + Math.sin(t / 700) * 0.06;
      const cx = 184;
      const cy = 441;
      const dx = Math.cos(r);
      const dy = Math.sin(r);
      const nx = -dy;
      const ny = dx;
      const off = ay * 45;
      const hx = cx + nx * off;
      const hy = cy + ny * off;
      const quad = (o1: number, o2: number, c: number) => {
        pfd.fillStyle(c, 1).fillPoints(
          [
            { x: hx - dx * 400 + nx * o1, y: hy - dy * 400 + ny * o1 },
            { x: hx + dx * 400 + nx * o1, y: hy + dy * 400 + ny * o1 },
            { x: hx + dx * 400 + nx * o2, y: hy + dy * 400 + ny * o2 },
            { x: hx - dx * 400 + nx * o2, y: hy - dy * 400 + ny * o2 },
          ],
          true,
        );
      };
      pfd.clear();
      quad(-400, 0, 0x1e6fd9);
      quad(0, 400, 0x8a5a2b);
      pfd.lineStyle(2, 0xffffff, 1).lineBetween(hx - dx * 300, hy - dy * 300, hx + dx * 300, hy + dy * 300);
      for (const p of [-30, -15, 15, 30]) {
        const w = Math.abs(p) === 30 ? 26 : 16;
        const px = hx + nx * p;
        const py = hy + ny * p;
        pfd.lineStyle(1, 0xffffff, 0.9).lineBetween(px - dx * w, py - dy * w, px + dx * w, py + dy * w);
      }
      spd.setText(String(287 + Math.round(Math.sin(t / 900) * 6 - ay * 20)));
      alt.setText(String(3500 - Math.round(ay * 900 + Math.sin(t / 1300) * 40)));
      // nav display: compass arc, radar sweep, the train
      sweep = (sweep + 0.04) % (Math.PI * 2);
      nd.clear();
      nd.lineStyle(2, 0xffffff, 0.9).beginPath().arc(480, 514, 120, Math.PI * 1.15, Math.PI * 1.85).strokePath();
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * 1.15 + (i / 12) * Math.PI * 0.7;
        nd.lineBetween(480 + Math.cos(a) * 120, 514 + Math.sin(a) * 120, 480 + Math.cos(a) * (i % 3 ? 114 : 108), 514 + Math.sin(a) * (i % 3 ? 114 : 108));
      }
      nd.lineStyle(1, 0x22ff88, 0.35).beginPath().arc(480, 514, 70, Math.PI * 1.15, Math.PI * 1.85).strokePath();
      const sa = Math.PI * 1.15 + ((Math.sin(sweep) + 1) / 2) * Math.PI * 0.7;
      nd.lineStyle(2, 0x22ff88, 0.5).lineBetween(480, 514, 480 + Math.cos(sa) * 120, 514 + Math.sin(sa) * 120);
      const tx = 480 - ax * 60;
      nd.lineStyle(2, 0xff4fd8, 1).lineBetween(480, 506, tx, 412);
      nd.fillStyle(0xff4fd8, 1).fillTriangle(tx, 404, tx - 6, 414, tx + 6, 414);
      nd.fillStyle(0xffffff, 1).fillTriangle(480, 498, 472, 512, 488, 512);
      tgt.setX(tx);
      // engines
      eng.clear();
      for (const [x, v] of [[712, 0.78 + Math.sin(t / 200) * 0.02], [822, 0.97 + Math.sin(t / 90) * 0.03]] as [number, number][]) {
        eng.lineStyle(3, 0x475569, 1).beginPath().arc(x, 424, 26, Math.PI * 0.75, Math.PI * 2.25).strokePath();
        eng.lineStyle(3, v > 0.95 ? 0xef4444 : 0x22ff88, 1).beginPath().arc(x, 424, 26, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.min(1, v))).strokePath();
        const a = Math.PI * (0.75 + 1.5 * Math.min(1, v));
        eng.lineStyle(2, 0xffffff, 1).lineBetween(x, 424, x + Math.cos(a) * 22, 424 + Math.sin(a) * 22);
      }
      caution.setAlpha(Math.floor(t / 400) % 2 ? 1 : 0.35);
      conf.setAlpha(0.65 + 0.35 * Math.sin(t / 150));
      ap.setAlpha(1);
      yoke.setRotation(ax * 0.35);
      yoke.setY(596 + ay * 8);
    };
    update(0, 0, 0);
    return { root, update, viewY: 250 };
  }

  /**
   * The PixelLab cockpit (windscreen cut out, so the sky shows through), with the live bits drawn into its own
   * screens: the captain's attitude display, the nav display hunting the Kreddle Express, and the engine page
   * (which reports CONFIDENCE). The windscreen is higher than the drawn one, so viewY moves the world up to match.
   */
  private cockpitArt() {
    const root = this.add.container(0, 0).setDepth(20);
    root.add(this.add.image(0, 0, "vg_cockpit").setOrigin(0).setScale(2));
    const txt = (x: number, y: number, t: string, c = "#22ff88", size = 9) => {
      const o = this.add.text(x, y, t, { fontFamily: "monospace", fontSize: `${size}px`, color: c, fontStyle: "bold" });
      root.add(o);
      return o;
    };
    // the screens, as they sit in the art
    const P = { x: 174, y: 380, w: 92, h: 94 };
    const N = { x: 290, y: 380, w: 88, h: 94 };
    const E = { x: 456, y: 380, w: 94, h: 94 };
    const blank = this.add.graphics();
    blank.fillStyle(0x05070f, 1).fillRect(N.x, N.y, N.w, N.h).fillRect(E.x, E.y, E.w, E.h);
    root.add(blank);
    // attitude display
    const pfd = this.add.graphics();
    pfd.setMask(this.make.graphics({}, false).fillRect(P.x, P.y, P.w, P.h).createGeometryMask());
    root.add(pfd);
    const cx = P.x + P.w / 2;
    const cy = P.y + P.h / 2;
    const fixed = this.add.graphics();
    fixed.lineStyle(3, 0xfacc15, 1).lineBetween(cx - 30, cy, cx - 12, cy).lineBetween(cx - 12, cy, cx - 8, cy + 5).lineBetween(cx + 30, cy, cx + 12, cy).lineBetween(cx + 12, cy, cx + 8, cy + 5);
    fixed.fillStyle(0xfacc15, 1).fillRect(cx - 2, cy - 2, 4, 4);
    fixed.fillStyle(0x000000, 0.55).fillRect(P.x, P.y, 20, P.h).fillRect(P.x + P.w - 22, P.y, 22, P.h);
    root.add(fixed);
    const spd = txt(P.x + 1, cy - 5, "287", "#ffffff", 8);
    const alt = txt(P.x + P.w - 21, cy - 5, "3500", "#ffffff", 7);
    txt(P.x + 2, P.y + 2, "SPD", "#22d3ee", 7);
    txt(P.x + P.w - 20, P.y + 2, "ALT", "#22d3ee", 7);
    // nav display
    const nd = this.add.graphics();
    root.add(nd);
    const ncx = N.x + N.w / 2;
    const ncy = N.y + N.h - 8;
    const R = 52;
    txt(N.x + 3, N.y + 2, "HDG 069", "#ffffff", 7);
    const tgt = txt(ncx, N.y + 12, "◆ KREDDLE", "#ff4fd8", 7).setOrigin(0.5, 0);
    // engine page: two N1 dials and the important numbers
    const eng = this.add.graphics();
    root.add(eng);
    txt(E.x + 3, E.y + 2, "N1", "#cbd5e1", 7);
    const conf = txt(E.x + 3, E.y + 44, "CONFIDENCE\n900%", "#ff4fd8", 9);
    txt(E.x + 3, E.y + 68, "FUEL: P. JUICE", "#22ff88", 7);
    txt(E.x + 3, E.y + 80, "CABIN: SCREAMING", "#f59e0b", 7);
    // the yoke crosses the nav display in the art: put it back on top
    root.add(this.add.image(0, 0, "vg_cockpit").setOrigin(0).setScale(2).setCrop(138, 224, 22, 30));
    // glareshield annunciators
    const caution = txt(120, 282, " MASTER CAUTION ", "#ffffff", 9).setBackgroundColor("#b91c1c");
    const ap = txt(744, 282, " A/P: DRUGS ", "#0b0f19", 9).setBackgroundColor("#22c55e");
    txt(480, 316, " FLT KR-069  SQUAWK 7500 ", "#f59e0b", 9).setOrigin(0.5, 0).setBackgroundColor("#0b0f19");
    let sweep = 0;
    const update = (ax: number, ay: number, t: number) => {
      const r = -ax * 0.5 + Math.sin(t / 700) * 0.06;
      const dx = Math.cos(r);
      const dy = Math.sin(r);
      const nx = -dy;
      const ny = dx;
      const hx = cx + nx * ay * 24;
      const hy = cy + ny * ay * 24;
      const quad = (o1: number, o2: number, c: number) =>
        pfd.fillStyle(c, 1).fillPoints(
          [
            { x: hx - dx * 200 + nx * o1, y: hy - dy * 200 + ny * o1 },
            { x: hx + dx * 200 + nx * o1, y: hy + dy * 200 + ny * o1 },
            { x: hx + dx * 200 + nx * o2, y: hy + dy * 200 + ny * o2 },
            { x: hx - dx * 200 + nx * o2, y: hy - dy * 200 + ny * o2 },
          ],
          true,
        );
      pfd.clear();
      quad(-200, 0, 0x1e6fd9);
      quad(0, 200, 0x8a5a2b);
      pfd.lineStyle(2, 0xffffff, 1).lineBetween(hx - dx * 150, hy - dy * 150, hx + dx * 150, hy + dy * 150);
      for (const p of [-16, -8, 8, 16]) {
        const w = Math.abs(p) === 16 ? 14 : 8;
        pfd.lineStyle(1, 0xffffff, 0.9).lineBetween(hx + nx * p - dx * w, hy + ny * p - dy * w, hx + nx * p + dx * w, hy + ny * p + dy * w);
      }
      spd.setText(String(287 + Math.round(Math.sin(t / 900) * 6 - ay * 20)));
      alt.setText(String(3500 - Math.round(ay * 900 + Math.sin(t / 1300) * 40)));
      // nav display: compass arc, sweep, the train
      sweep = (sweep + 0.04) % (Math.PI * 2);
      nd.clear();
      nd.lineStyle(2, 0xffffff, 0.9).beginPath().arc(ncx, ncy, R, Math.PI * 1.22, Math.PI * 1.78).strokePath();
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * 1.22 + (i / 8) * Math.PI * 0.56;
        nd.lineBetween(ncx + Math.cos(a) * R, ncy + Math.sin(a) * R, ncx + Math.cos(a) * (i % 2 ? R - 4 : R - 7), ncy + Math.sin(a) * (i % 2 ? R - 4 : R - 7));
      }
      nd.lineStyle(1, 0x22ff88, 0.35).beginPath().arc(ncx, ncy, R * 0.55, Math.PI * 1.22, Math.PI * 1.78).strokePath();
      const sa = Math.PI * 1.22 + ((Math.sin(sweep) + 1) / 2) * Math.PI * 0.56;
      nd.lineStyle(1, 0x22ff88, 0.5).lineBetween(ncx, ncy, ncx + Math.cos(sa) * R, ncy + Math.sin(sa) * R);
      const tx = ncx - ax * 28;
      nd.lineStyle(2, 0xff4fd8, 1).lineBetween(ncx, ncy - 6, tx, N.y + 30);
      nd.fillStyle(0xff4fd8, 1).fillTriangle(tx, N.y + 24, tx - 4, N.y + 31, tx + 4, N.y + 31);
      nd.fillStyle(0xffffff, 1).fillTriangle(ncx, ncy - 6, ncx - 5, ncy + 3, ncx + 5, ncy + 3);
      tgt.setX(Phaser.Math.Clamp(tx, N.x + 24, N.x + N.w - 24));
      // engines
      eng.clear();
      for (const [x, v] of [[E.x + 26, 0.78 + Math.sin(t / 200) * 0.02], [E.x + 68, 0.97 + Math.sin(t / 90) * 0.03]] as [number, number][]) {
        const y = E.y + 26;
        const a = Math.PI * (0.75 + 1.5 * Math.min(1, v));
        eng.lineStyle(2, 0x475569, 1).beginPath().arc(x, y, 14, Math.PI * 0.75, Math.PI * 2.25).strokePath();
        eng.lineStyle(2, v > 0.95 ? 0xef4444 : 0x22ff88, 1).beginPath().arc(x, y, 14, Math.PI * 0.75, a).strokePath();
        eng.lineStyle(1, 0xffffff, 1).lineBetween(x, y, x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      }
      caution.setAlpha(Math.floor(t / 400) % 2 ? 1 : 0.35);
      conf.setAlpha(0.65 + 0.35 * Math.sin(t / 150));
      ap.setAlpha(1);
    };
    update(0, 0, 0);
    return { root, update, viewY: 160 };
  }

  private chute(me: string, x: number, y: number) {
    const c = this.add.container(x, y).setDepth(70);
    const canopy = this.add.graphics();
    canopy.fillStyle(0xff4fa3, 1).slice(0, 0, 46, Math.PI, 0, false).fillPath();
    canopy.lineStyle(2, 0xffffff, 1).lineBetween(-44, 0, 0, 56).lineBetween(44, 0, 0, 56).lineBetween(0, -40, 0, 56);
    c.add([canopy, this.add.sprite(0, 70, me === G.s.player ? playerKey(this) : `spr_${me}`, 0).setScale(2)]);
    this.tweens.add({ targets: c, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 900 });
    return c;
  }

  /** Not optional. Press D. */
  private takeDrugs() {
    return new Promise<void>((resolve) => {
      const t = title(this, 480, 150, "TAKE DRUGS FOR CONFIDENCE", 34, "#ff4fd8").setDepth(300);
      const btn = this.add.text(480, 230, "💊  PRESS  D", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#ffffff", backgroundColor: "#7e1d6b", padding: { x: 18, y: 10 } }).setOrigin(0.5).setDepth(300).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: [t, btn], scale: { from: 1, to: 1.08 }, yoyo: true, repeat: -1, duration: 420 });
      let done = false;
      const take = () => {
        if (done) return;
        done = true;
        this.input.keyboard?.off("keydown-D", take);
        synth.play("gulp");
        this.tweens.killTweensOf([t, btn]);
        t.destroy();
        btn.destroy();
        const c = this.caption("CONFIDENCE +900%", "#ff4fd8", 40);
        this.cameras.main.flash(400, 255, 80, 220);
        this.time.delayedCall(1300, () => {
          c.destroy();
          resolve();
        });
      };
      this.input.keyboard?.on("keydown-D", take);
      btn.on("pointerdown", take);
    });
  }

  /**
   * First person: keep the Kreddle Express in your sights. While it's in the crosshair you close on it; let it
   * drift out and you lose ground. Close the gap and it's time for the ejector seat. Resolves when you eject.
   */
  private juiceFlight() {
    return new Promise<{ sx: number; sy: number }>((resolve) => {
      // (a faint pink tint: the drugs are working)
      const haze = this.add.rectangle(480, 270, 960, 540, 0xff4fd8, 0.08).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
      const cockpit = this.cockpitFrame();
      const VY = cockpit.viewY;
      // out of the windscreen: the sky, the countryside, the railway and the Kreddle Express on it
      const view = createFlightView(this, { cx: 480, cy: VY, depth: 0 });
      (this as unknown as { flightView?: typeof view }).flightView = view;
      const hud = this.add.text(480, 52, "", { fontFamily: "Impact, sans-serif", fontSize: "24px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(40);
      const help = this.add.text(480, 86, "AIM AT THE TRAIN. KEEP IT IN YOUR SIGHTS TO CLOSE IN.", { fontFamily: FONT, fontSize: "15px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(40);
      this.add.text(480, VY + 52, "WASD / ARROWS (or drag) to steer", { fontFamily: FONT, fontSize: "11px", color: "#86efac" }).setOrigin(0.5).setDepth(41);
      // the lock-on bar
      const barBg = this.add.rectangle(480, 116, 300, 12, 0x000000, 0.6).setStrokeStyle(2, 0xffffff, 0.8).setDepth(40);
      const bar = this.add.rectangle(331, 116, 0, 8, 0x86efac).setOrigin(0, 0.5).setDepth(41);
      void barBg;
      const cross = this.add.graphics().setDepth(30);
      const drawCross = (on: boolean) => {
        cross.clear();
        const col = on ? 0xff4d4d : 0x86efac;
        cross.lineStyle(3, col, 0.9).strokeCircle(0, 0, 22).lineBetween(-34, 0, -12, 0).lineBetween(12, 0, 34, 0).lineBetween(0, -34, 0, -12).lineBetween(0, 12, 0, 34);
        if (on) cross.lineStyle(2, col, 0.7).strokeRect(-40, -40, 80, 80);
      };
      drawCross(false);
      const keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E") as Record<string, Phaser.Input.Keyboard.Key>;
      let ax = 0;
      let ay = 0;
      let drag: { x: number; y: number } | null = null;
      const onDown = (p: Phaser.Input.Pointer) => (drag = { x: p.x, y: p.y });
      const onMove = (p: Phaser.Input.Pointer) => {
        if (!drag || !p.isDown) return;
        ax = Phaser.Math.Clamp(ax + (p.x - drag.x) / 260, -1, 1);
        ay = Phaser.Math.Clamp(ay + (p.y - drag.y) / 200, -1, 1);
        drag = { x: p.x, y: p.y };
      };
      const onUp = () => (drag = null);
      this.input.on("pointerdown", onDown);
      this.input.on("pointermove", onMove);
      this.input.on("pointerup", onUp);
      let phase: "chase" | "eject" | "done" = "chase";
      let lock = 0;
      let wasOn = false;
      let lastBeep = 0;
      let t = 0;
      const ejectPrompt = () => {
        phase = "eject";
        synth.play("alarm");
        help.setText("");
        hud.setText("");
        const p = title(this, 480, 230, "⚠ HIT THE EJECTOR SEAT ⚠", 36, "#ff4d4d").setDepth(60);
        const b = this.add.text(480, 300, "PARACHUTE TO FREEDOM  [ E / SPACE / TAP ]", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffffff", backgroundColor: "#b91c1c", padding: { x: 14, y: 8 } }).setOrigin(0.5).setDepth(60).setInteractive({ useHandCursor: true });
        this.tweens.add({ targets: [p, b], scale: { from: 1, to: 1.08 }, yoyo: true, repeat: -1, duration: 300 });
        const go = () => {
          if (phase !== "eject") return;
          phase = "done";
          loop.remove();
          this.input.off("pointerdown", onDown);
          this.input.off("pointermove", onMove);
          this.input.off("pointerup", onUp);
          this.input.keyboard?.off("keydown-E", go);
          this.input.keyboard?.off("keydown-SPACE", go);
          view.destroy();
          resolve({ sx: 3, sy: 9 });
        };
        b.on("pointerdown", go);
        this.input.keyboard?.once("keydown-E", go);
        this.input.keyboard?.once("keydown-SPACE", go);
      };
      const loop = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (phase === "done") return;
          t += 16;
          // steering
          const sp = 0.028;
          if (keys) {
            if (keys.A.isDown || keys.LEFT.isDown) ax -= sp;
            if (keys.D.isDown || keys.RIGHT.isDown) ax += sp;
            if (keys.W.isDown || keys.UP.isDown) ay -= sp;
            if (keys.S.isDown || keys.DOWN.isDown) ay += sp;
          }
          const st = view.state;
          // test hook: steer at the train
          if ((window as unknown as { __krelAutoFly?: boolean }).__krelAutoFly && st.trainOn) {
            ax += Phaser.Math.Clamp(st.trainLateral / 4200, -sp, sp);
          }
          ax = Phaser.Math.Clamp(ax, -1, 1);
          ay = Phaser.Math.Clamp(ay, -1, 1);
          // the view out of the windscreen banks and pitches with you; you close on the train as the lock builds
          // the Kreddle Express weaves about (more wildly the closer you get): you have to steer to stay on it
          const swerve = (Math.sin(t / 1900) + 0.55 * Math.sin(t / 830 + 1.3) + 0.3 * Math.sin(t / 410 + 0.4)) * (400 + lock * 500);
          view.update({ ax, ay, dt: 16, progress: phase === "chase" ? lock : 1, trainFade: 0, trainShift: swerve });
          cross.setPosition(480, VY);
          cockpit.update(ax, ay, t);
          const c2 = Phaser.Display.Color.HSVToRGB(((t / 60) % 360) / 360, 0.35, 1) as Phaser.Types.Display.ColorObject;
          haze.setFillStyle((c2.r << 16) | (c2.g << 8) | c2.b, 0.07 + 0.03 * Math.sin(t / 300));
          if (phase !== "chase") return;
          // on target: the train's middle inside the sights (a bit of give, more as it gets bigger)
          // on target: steering at it (sideways, in the world, so it's as hard at 7 km as at 2 km)
          const on = st.trainOn && Math.abs(st.trainLateral) < 420;
          // difficulty: the lock builds quicker (or slower) and leaks slower (or quicker)
          const tm = diffFor(G.s).timing;
          lock = Phaser.Math.Clamp(lock + (on ? 0.0016 * tm : -0.0005 / tm), 0, 1);
          if (on !== wasOn) {
            drawCross(on);
            if (on) synth.play("select");
            wasOn = on;
          }
          if (on && t - lastBeep > 420 - lock * 300) {
            lastBeep = t;
            synth.play("monbeep");
          }
          bar.width = 298 * lock;
          bar.setFillStyle(on ? 0xff4d4d : 0x86efac);
          hud.setText(on ? `ON TARGET  ${Math.round(lock * 100)}%` : lock > 0 ? `OFF TARGET  ${Math.round(lock * 100)}%` : "FIND THE TRAIN");
          help.setText(on ? "HOLD IT THERE…" : "AIM AT THE TRAIN. KEEP IT IN YOUR SIGHTS TO CLOSE IN.");
          if (lock >= 1) {
            synth.play("perfect");
            help.setText("");
            ejectPrompt();
          }
        },
      });
    });
  }

  /** Meanwhile: the Kreddle Express arrives in Krelworld, and finds something it likes more than the Krel Tower. */
  private async kreddleExpress() {
    const skyG = this.sky(0x8fc3ea, 0xf3d9b1);
    if (!this.railBackdrop()) {
      const g = this.add.graphics();
      g.fillStyle(0x6b7b90, 1);
      for (let i = 0; i < 20; i++) g.fillRect(i * 50, 260 - ((i * 37) % 70), 44, 300);
      g.fillStyle(0x3d6a2a, 1).fillRect(0, 380, 960, 160);
      g.fillStyle(0x6b5b4b, 1).fillRect(0, 404, 960, 14);
      for (let i = 0; i < 40; i++) g.fillStyle(0x4a3a2a, 1).fillRect(i * 26, 400, 10, 22);
      g.fillStyle(0x9ca3af, 1).fillRect(0, 402, 960, 3).fillRect(0, 415, 960, 3);
    }
    void skyG;
    const sign = this.add.text(160, 300, "WELCOME TO\nKRELWORLD", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", backgroundColor: "#1d4ed8", padding: { x: 6, y: 4 }, align: "center" }).setOrigin(0.5, 1).setDepth(5);
    this.add.rectangle(160, 340, 6, 40, 0x555555).setDepth(4);
    void sign;
    const shop = this.add.image(720, 400, "p_krelburger").setOrigin(0.5, 1).setScale(1.5).setDepth(5);
    this.add.text(shop.x, shop.y - shop.displayHeight - 6, "KRELBURGER", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffd23f", stroke: "#b91c1c", strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(6);
    this.caption("MEANWHILE…", "#ffffff", 30);
    await this.wait(900);
    this.lastCaption?.destroy();
    const train = this.add.image(-700, this.textures.exists("bg_krelford_rail") ? 408 : 392, "p_train").setOrigin(0, 1).setScale(2.4).setDepth(10);
    const k = this.add.sprite(0, 0, "spr_TV_PRESIDENT_KLERBLE", 4).setScale(1.5).setDepth(11);
    const follow = () => k.setPosition(train.x + train.displayWidth - 70, train.y - train.displayHeight + 40);
    follow();
    synth.play("jet");
    this.cameras.main.shake(2000, 0.006);
    await this.tween({ targets: train, x: -260, duration: 1300, ease: "Linear", onUpdate: follow });
    await this.talk([
      dir("The Kreddle Express thunders over the border at three hundred miles an hour. In the cab, President Klerble has still not blinked."),
      say("PRESIDENT KLERBLE", "YES! YES! YESSS!!"),
    ]);
    // he sees it
    this.tween({ targets: train, x: -10, duration: 1400, ease: "Sine.out", onUpdate: follow });
    await this.wait(700);
    synth.play("trombone");
    const eyes = this.add.text(k.x, k.y - 50, "!!!", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ff4d4d", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: eyes, scale: { from: 0.4, to: 1.3 }, yoyo: true, repeat: 2, duration: 160 });
    await this.wait(600);
    eyes.destroy();
    this.cameras.main.shake(300, 0.01);
    await this.talk([say("PRESIDENT KLERBLE", "Mmmm!! Want Krelburger!!")]);
    // out he gets, in he goes
    const walker = this.add.sprite(k.x, 380, "spr_TV_PRESIDENT_KLERBLE", 4).setScale(1.8).setDepth(12);
    k.setVisible(false);
    await this.tween({ targets: walker, x: shop.x, duration: 1100, ease: "Linear" });
    synth.play("door");
    walker.destroy();
    await this.krelburgerQueue();
    await this.talk([
      dir("The Kreddle Express sits outside Krelburger with its engine running, three hundred metres short of nothing in particular."),
      dir("Somewhere in the sky above Krelford, a plane is still on its way to the Krel Tower."),
    ]);
  }

  /**
   * Inside Krelburger: fat Polson is at the front of the queue, and President Klerble does not queue.
   * Drawn over the street scene (depth 300+) and cleared away after, so the street carries on behind it.
   */
  private async krelburgerQueue() {
    // above the street scene (≤ 30), under captions (500) and the dialogue box (1000)
    const D = 300;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => (objs.push(o), o);
    this.cameras.main.fadeOut(300);
    await this.wait(320);
    keep(this.add.rectangle(480, 270, 960, 540, 0x2a1810).setDepth(D).setScrollFactor(0));
    const bg = backdrop(this, "bg_krelburger", { depth: D + 1 });
    if (bg) keep(bg);
    const FLOOR = 375;
    // sprite sheets carry an hd factor, so size them by the height they end up on screen
    const sizeTo = (sp: Phaser.GameObjects.Sprite, px: number) => {
      sp.setScale(1);
      sp.setScale(px / sp.frame.height / sp.scaleX);
      return sp;
    };
    // Polson, at his biggest, first in the queue
    const fat = this.textures.exists("spr_POLSON_FAT");
    const pol = keep(sizeTo(this.add.sprite(610, FLOOR, fat ? "spr_POLSON_FAT" : "spr_POLSON", fat ? 11 : 0).setOrigin(0.5, 1).setDepth(D + 10), 135));
    const polSX = pol.scaleX;
    this.cameras.main.fadeIn(300);
    this.caption("KRELBURGER", "#ffd23f", 30);
    await this.wait(900);
    this.dropCaption();
    await this.talk(KB_QUEUE.slice(0, 4));
    // in he comes
    const kl = keep(sizeTo(this.add.sprite(-60, FLOOR, "spr_TV_PRESIDENT_KLERBLE", 4).setOrigin(0.5, 1).setDepth(D + 11), 135));
    synth.play("door");
    await this.tween({ targets: kl, x: 340, duration: 1200, ease: "Linear" });
    const bob = this.tweens.add({ targets: kl, y: FLOOR - 4, yoyo: true, repeat: -1, duration: 180 });
    await this.talk(KB_QUEUE.slice(4, 6));
    bob.remove();
    kl.y = FLOOR;
    // Polson turns round. It takes a while.
    await this.talk(KB_QUEUE.slice(6, 7));
    await this.tween({ targets: pol, scaleX: polSX * 0.15, duration: 700, ease: "Sine.in" });
    pol.setFlipX(true);
    await this.tween({ targets: pol, scaleX: polSX, duration: 700, ease: "Sine.out" });
    await this.talk(KB_QUEUE.slice(7, 10));
    synth.stopMusic();
    this.cameras.main.shake(200, 0.004);
    await this.talk(KB_QUEUE.slice(10, 12));
    // the gold revolver
    const handY = kl.y - kl.displayHeight * 0.45;
    const gun = keep(this.add.rectangle(kl.x + 46, handY, 34, 10, 0xffd23f).setStrokeStyle(2, 0x7c5a00).setDepth(D + 12));
    const wheel = keep(this.add.circle(kl.x + 36, handY, 9, 0xb91c1c).setStrokeStyle(2, 0x111111).setDepth(D + 13));
    const spin = this.tweens.add({ targets: wheel, angle: 720, duration: 900, repeat: -1 });
    synth.play("coin");
    await this.talk(KB_QUEUE.slice(12));
    spin.remove();
    await this.wait(500);
    // BANG
    synth.play("gun_pistol");
    synth.play("boom");
    const flash = keep(this.add.rectangle(480, 270, 960, 540, 0xffffff).setDepth(D + 50).setScrollFactor(0));
    this.tweens.add({ targets: flash, alpha: 0, duration: 260 });
    this.cameras.main.shake(400, 0.02);
    // he goes over like a wardrobe (drawn: gfx/GoreDeath.ts)
    await goreDeath(this, pol, "shot", { fromX: kl.x, hits: 1, comedy: true });
    await this.wait(500);
    await this.talk(KB_SHOT);
    // and, with his last breath, the death fart
    await goreDeath(this, pol, "fart", { comedy: true });
    gun.destroy();
    wheel.destroy();
    // the President steps over him to the till
    kl.setTexture("spr_TV_PRESIDENT_KLERBLE", 0);
    await this.talk(KB_ORDER.slice(0, 3));
    synth.play("cheer");
    const jump = this.tweens.add({ targets: kl, y: FLOOR - 22, yoyo: true, repeat: 3, duration: 160, ease: "Quad.out" });
    await this.talk(KB_ORDER.slice(3));
    jump.remove();
    G.s.flags.polson_dead = true;
    this.cameras.main.fadeOut(400);
    await this.wait(420);
    for (const o of objs) o.destroy();
    this.cameras.main.fadeIn(400);
  }

  /** Stuff Polson's face. Food slides down the table: shove it in as it reaches his mouth. Skip the salad. */
  private bulkPolson(pol: Phaser.GameObjects.Sprite, add = false) {
    return new Promise<void>((resolve) => {
      const MOUTH_X = pol.x + 30;
      // the belly does the growing: the fat sheet has twelve sizes of Polson
      const fat = this.textures.exists("spr_POLSON_FAT");
      if (fat) pol.setTexture("spr_POLSON_FAT", 0);
      const sx0 = pol.scaleX;
      const sy0 = pol.scaleY;
      const hud = this.add.text(480, 130, "", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(100);
      const help = this.add.text(480, 160, "Tap / SPACE when the food reaches his mouth. NOT the salad.", { fontFamily: FONT, fontSize: "13px", color: "#ffd23f", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(100);
      const zone = this.add.rectangle(MOUTH_X, 300, 60, 60).setStrokeStyle(3, 0xffd23f).setDepth(30);
      const menu = [
        { e: "🍔", name: "BURGER", good: true },
        { e: "🍫", name: "CHOCOLATE", good: true },
        { e: "🟫", name: "FUDGE", good: true },
        { e: "🍕", name: "PIZZA", good: true },
        { e: "🍩", name: "KREZPY KREAM", good: true },
        { e: "🥗", name: "SALAD", good: false },
      ];
      const lines = ["Great bulking food!!", "Mmm. Gains.", "Protein!!", "Bulking season 😅", "Get it in!!", "Delectable!!", "More fudge!!", "Clean bulk. Basically."];
      type Food = { t: Phaser.GameObjects.Text; good: boolean; done: boolean };
      const foods: Food[] = [];
      let eaten = 0;
      let wasted = 0;
      let spawned = 0;
      const TOTAL = 12;
      const say1 = (txt: string, col = "#ffffff") => {
        const b = this.add.text(pol.x, pol.y - pol.displayHeight / 2 - 24, txt, { fontFamily: FONT, fontSize: "13px", color: "#111", backgroundColor: "#ffffffee", padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(60);
        b.setColor(col === "#ffffff" ? "#111" : col);
        this.tween({ targets: b, y: b.y - 18, alpha: 0, delay: 700, duration: 400 });
      };
      const addFood = () => {
        if (spawned >= TOTAL) return;
        spawned++;
        const m = Math.random() < 0.18 ? menu[5] : menu[Math.floor(Math.random() * 5)];
        const t = this.add.text(1000, 300, m.e, { fontSize: "40px" }).setOrigin(0.5).setDepth(40);
        foods.push({ t, good: m.good, done: false });
      };
      // the first one is already on its way in
      addFood();
      const spawn = this.time.addEvent({ delay: 650, loop: true, callback: addFood });
      const shove = () => {
        if (this.box.active) return;
        const f = foods.find((x) => !x.done && Math.abs(x.t.x - MOUTH_X) < 46);
        // chomp: a quick squash, never a different (smaller) pose
        this.tweens.add({ targets: pol, scaleY: pol.scaleY * 0.94, duration: 70, yoyo: true });
        if (!f) {
          synth.play("tap_fail");
          return;
        }
        f.done = true;
        this.tween({ targets: f.t, x: pol.x, y: pol.y - 20, scale: 0.2, duration: 160 }).then(() => f.t.destroy());
        if (!f.good) {
          synth.play("tap_fail");
          say1("THAT'S NOT BULKING FOOD", "#ef4444");
          pol.setTint(0x99ff99);
          this.time.delayedCall(400, () => pol.clearTint());
          return;
        }
        eaten++;
        synth.play(eaten % 2 ? "gulp" : "slurp");
        say1(lines[eaten % lines.length]);
        // the belly grows, every single bite
        if (fat) {
          pol.setFrame(Math.min(11, eaten));
          this.tweens.add({ targets: pol, scaleX: sx0 * 1.08, duration: 90, yoyo: true, onComplete: () => pol.setScale(sx0, sy0) });
        } else this.tweens.add({ targets: pol, scaleX: sx0 * (1 + eaten * 0.13), scaleY: sy0 * (1 + eaten * 0.03), duration: 200, ease: "Back.out" });
        this.cameras.main.shake(80, 0.002 + eaten * 0.0004);
      };
      this.input.keyboard?.on("keydown-SPACE", shove);
      this.input.on("pointerdown", shove);
      const tick = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          for (const f of foods) {
            if (f.done) continue;
            f.t.x -= 5.4;
            if (f.t.x < MOUTH_X - 60) {
              f.done = true;
              if (f.good) {
                wasted++;
                say1("ON THE SHIRT", "#ef4444");
              }
              this.tween({ targets: f.t, y: 400, alpha: 0, duration: 300 }).then(() => f.t.destroy());
            }
          }
          hud.setText(`EATEN ${eaten}   ON THE FLOOR ${wasted}`);
          if (spawned >= TOTAL && foods.every((f) => f.done || f.t.x < MOUTH_X - 20)) {
            tick.remove();
            spawn.remove();
            this.input.keyboard?.off("keydown-SPACE", shove);
            this.input.off("pointerdown", shove);
            hud.destroy();
            help.destroy();
            zone.destroy();
            G.s.flags.polson_fat = add ? ((G.s.flags.polson_fat as number) ?? 0) + eaten : Math.max((G.s.flags.polson_fat as number) ?? 0, eaten);
            this.caption(eaten >= 9 ? "MAXIMUM BULK" : eaten >= 5 ? "BULKED" : "LIGHT BULK", "#ffd23f", 30);
            this.time.delayedCall(500, () => {
              this.lastCaption?.destroy();
              this.lastCaption = undefined;
              resolve();
            });
          }
        },
      });
    });
  }

  // ================================================================ CHAPTER 6: THE KREDDLE EXPRESS

  private dropCaption() {
    this.lastCaption?.destroy();
    this.lastCaption = undefined;
  }

  /** The speaker of each line hops (EVERYONE / ALL …: the whole cast). */
  private hopSpeaker(s: string) {
    const all = s === "EVERYONE" || s.startsWith("ALL ");
    const who = all ? [...this.cast.values()] : [this.cast.get(s)].filter((x): x is Phaser.GameObjects.Sprite => !!x);
    for (const sp of who) {
      if (!sp.active || sp.getData("walking") || sp.getData("hop") || sp.getData("busy")) continue;
      const y = sp.y;
      sp.setData("hop", true);
      this.tweens.add({ targets: sp, y: y - 12, yoyo: true, duration: 110, repeat: all ? 1 : 0, onComplete: () => {
        sp.y = y;
        sp.setData("hop", false);
      } });
    }
  }

  /** A lad (or anyone with a character sheet) on stage, registered in the cast. */
  private actor(id: string, x: number, y: number, scale = 2.6, castAs = id) {
    const key = id === G.s.player ? playerKey(this) : this.textures.exists(`spr_${id}`) ? `spr_${id}` : "spr_FOLK0";
    const sp = this.add.sprite(x, y, key, 0).setScale(scale).setDepth(100 + y);
    this.cast.set(castAs, sp);
    return sp;
  }

  /** Walk a sprite somewhere (walk cycle on the way). */
  private walkTo(sp: Phaser.GameObjects.Sprite, x: number, y: number, ms: number) {
    const dx = x - sp.x;
    const dy = y - sp.y;
    const ev = this.time.addEvent({ delay: 50, loop: true, callback: () => animateWalker(sp, dx, dy, true, this.time.now) });
    return this.tween({ targets: sp, x, y, duration: ms }).then(() => {
      ev.remove();
      animateWalker(sp, dx, dy, false, this.time.now);
      sp.setDepth(100 + sp.y);
    });
  }

  private face(sp: Phaser.GameObjects.Sprite, f: "south" | "east" | "north" | "west") {
    const m = charMeta(this, sp.texture.key);
    sp.setData("facing", f);
    if (!m) return void sp.setFlipX(f === "west");
    sp.setFlipX(false);
    sp.setFrame(m.idle[f] ?? 0);
  }

  private faceTo(sp: Phaser.GameObjects.Sprite, x: number) {
    this.face(sp, Math.abs(x - sp.x) < 20 ? "south" : x > sp.x ? "east" : "west");
  }

  /** Loop a performance (dance / sing / victory) on some sprites; a bounce when the art has none. Returns a stop function. */
  private perform(sps: Phaser.GameObjects.Sprite[], kind: "dance" | "sing" | "victory", fps = 9) {
    const fakes: Phaser.Tweens.Tween[] = [];
    const real = sps.filter((sp, i) => {
      if (perfCycle(sp, kind)) return true;
      fakes.push(this.tweens.add({ targets: sp, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 180 + (i % 3) * 30 }));
      return false;
    });
    const ev = this.time.addEvent({ delay: 50, loop: true, callback: () => real.forEach((sp, i) => sp.active && playPerf(sp, kind, this.time.now, fps, i * 2)) });
    return () => {
      ev.remove();
      fakes.forEach((t) => t.remove());
      sps.forEach((sp) => {
        if (!sp.active) return;
        sp.setAngle(0);
        this.face(sp, "south");
      });
    };
  }

  /** A speech bubble over someone's head. */
  private bubble(sp: Phaser.GameObjects.Sprite, text: string, bg = "#ffffff", fg = "#111111", size = 14) {
    const t = this.add.text(sp.x, sp.y - sp.displayHeight * 0.55 - 12, text, { fontFamily: FONT, fontSize: `${size}px`, color: fg, backgroundColor: bg, padding: { x: 5, y: 2 }, fontStyle: "bold" }).setOrigin(0.5, 1).setDepth(900);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, delay: 800, duration: 500, onComplete: () => t.destroy() });
    return t;
  }

  /** A wobbling yellow stream from (sx, sy) to (tx, ty) with splashes. Returns a stop function. */
  private peeStream(sx: number, sy: number, tx: number, ty: number, depth: number) {
    const arcG = this.add.graphics().setDepth(depth);
    const ev = this.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        const w = Math.sin(this.time.now / 70) * 3;
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(sx, sy), new Phaser.Math.Vector2((sx + tx) / 2, Math.min(sy, ty) - 26 + w), new Phaser.Math.Vector2(tx + w * 0.6, ty));
        arcG.clear();
        arcG.lineStyle(5, 0xc9a800, 0.9);
        curve.draw(arcG, 24);
        arcG.lineStyle(3, 0xffe14a, 1);
        curve.draw(arcG, 24);
        if (Math.random() < 0.6) {
          const d = this.add.circle(tx + (Math.random() - 0.5) * 12, ty, 2.5, 0xffe14a, 1).setDepth(depth + 1);
          this.tweens.add({ targets: d, x: d.x + (Math.random() - 0.5) * 30, y: ty - 8 - Math.random() * 12, alpha: 0, duration: 380, onComplete: () => d.destroy() });
        }
      },
    });
    return () => {
      ev.remove();
      arcG.destroy();
    };
  }

  /** Rain (and a storm's lightning) over the stage, under the dialogue box. Stopped by clearStage / the end of the vignette. */
  private rainOver(kind: "rain" | "storm", depth = 960) {
    synth.weatherSound(kind);
    this.add.rectangle(480, 270, 960, 540, 0x1e293b, kind === "storm" ? 0.32 : 0.2).setDepth(depth - 1);
    if (hasVfx(this, "vfx_rain")) {
      for (let l = 0; l < (kind === "storm" ? 2 : 1); l++)
        for (let gx = 0; gx < 3; gx++)
          for (let gy = 0; gy < 3; gy++) {
            const sp = vfx(this, "vfx_rain", 160 + gx * 320 + l * 90, 100 + gy * 200 + l * 60, { scale: 2 + l * 0.4, depth, alpha: 0.75, speed: kind === "storm" ? 1.5 : 1, angle: kind === "storm" ? 12 : 0 });
            sp?.anims.setProgress(Math.random());
          }
    } else {
      const g = this.add.graphics().setDepth(depth);
      this.time.addEvent({ delay: 50, loop: true, callback: () => {
        g.clear();
        g.lineStyle(1, 0xbfdbfe, 0.6);
        for (let i = 0; i < 90; i++) {
          const x = Math.random() * 1000;
          const y = Math.random() * 540;
          g.lineBetween(x, y, x - 6, y + 18);
        }
      } });
    }
    if (kind !== "storm") return;
    const flash = this.add.rectangle(480, 270, 960, 540, 0xeef2ff).setAlpha(0).setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    const strike = () => {
      if (!flash.active) return;
      this.tweens.chain({ targets: flash, tweens: [{ alpha: 0.6, duration: 40 }, { alpha: 0.05, duration: 90 }, { alpha: 0.45, duration: 40 }, { alpha: 0, duration: 450 }] });
      this.time.delayedCall(250 + Math.random() * 500, () => flash.active && synth.play("thunder"));
      this.time.delayedCall(3500 + Math.random() * 4500, strike);
    };
    this.time.delayedCall(1500, strike);
  }

  /** Under the ceiling: a lump of it comes down on them (gfx/GoreDeath.ts). */
  private keel(sp: Phaser.GameObjects.Sprite, delay = 0) {
    sp.setData("busy", true);
    goreDeath(this, sp, "crushed", { delay, quiet: true, dropKey: Math.random() < 0.5 ? "c6_ceiling" : "p_rubble" });
  }

  /** A prop image (origin at its feet), or a plain block of colour when the art isn't there. */
  private prop(key: string, x: number, y: number, scale: number, depth: number, fb = 0x888888, fw = 40, fh = 40) {
    if (this.textures.exists(key)) return this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth);
    const fk = `c6fb_${fw}x${fh}_${fb}`;
    if (!this.textures.exists(fk)) {
      const g = this.make.graphics({}, false);
      g.fillStyle(fb, 1).fillRect(0, 0, fw, fh).lineStyle(2, 0x000000, 1).strokeRect(1, 1, fw - 2, fh - 2);
      g.generateTexture(fk, fw, fh);
      g.destroy();
    }
    return this.add.image(x, y, fk).setOrigin(0.5, 1).setDepth(depth);
  }

  // ---------------------------------------------------------------- klerble_train: meanwhile, in Kreddle

  private async klerbleTrain() {
    await ensureCh6Art(this);
    synth.music("klerble");
    this.add.rectangle(480, 270, 960, 540, 0x150a28).setDepth(-20);
    const bg = backdrop(this, "bg_kd_station", { depth: -10 });
    if (bg) bg.setY(180);
    else {
      this.sky(0x1a0b3a, 0x5b1d73);
      this.add.rectangle(480, 300, 960, 80, 0x2b1645).setDepth(-9);
    }
    // the platform the crowd stands on (the painted one sits a bit low for the camera)
    const plat = this.add.graphics().setDepth(-5);
    plat.fillStyle(0x2a1640, 0.75).fillRect(0, 280, 960, 82);
    plat.lineStyle(3, 0xffd23f, 0.9).lineBetween(0, 280, 960, 280);
    for (let x = 0; x < 960; x += 40) plat.fillStyle(0xffd23f, 0.35).fillRect(x, 282, 20, 4);
    const sign = this.add.text(480, 26, "★ KREDDLE CENTRAL ★", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#ff4fd8", stroke: "#12001f", strokeThickness: 6 }).setOrigin(0.5).setDepth(5);
    sign.setShadow(0, 0, "#ff4fd8", 16, true, true);
    this.time.addEvent({ delay: 1700, loop: true, callback: () => {
      sign.setAlpha(0.3);
      this.time.delayedCall(80, () => sign.setAlpha(1));
    } });
    const board = this.add.text(820, 70, "PLATFORM 6\n6:66 KREDDLE EXPRESS\n→ KRELWORLD\nSTATUS: PRESIDENTIAL", { fontFamily: "Courier New, monospace", fontSize: "12px", color: "#facc15", backgroundColor: "#000000dd", padding: { x: 6, y: 4 }, align: "center" }).setOrigin(0.5, 0).setDepth(5);
    void board;
    for (let i = 0; i < 4; i++) {
      const beam = this.add.triangle(120 + i * 240, 300, 0, 0, -40, -420, 40, -420, [0xff4fd8, 0x22d3ee, 0xfacc15, 0xa855f7][i], 0.1).setOrigin(0, 0).setDepth(-4).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: beam, angle: { from: -25, to: 25 }, yoyo: true, repeat: -1, duration: 2400 + i * 600, ease: "Sine.inOut" });
    }
    // the adoring public
    const crowd: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < 11; i++) {
      const key = ["spr_KD_MAN", "spr_KD_WOMAN"][i % 2];
      const x = 70 + i * 52 + (i % 3) * 6;
      const y = 290 + (i % 3) * 9;
      const sp = this.add.sprite(x, y, this.textures.exists(key) ? key : "spr_FOLK1", 0).setScale(2.3).setDepth(100 + y);
      if (!this.textures.exists(key)) sp.setTint(0xff9de6);
      crowd.push(sp);
    }
    this.cast.set("KREDDLER", crowd[3]);
    const cheer = (t: string[], n = 6) => {
      synth.play("cheer");
      for (let i = 0; i < n; i++) {
        const p = crowd[Math.floor(Math.random() * crowd.length)];
        this.bubble(p, t[i % t.length], ["#ff4fd8", "#22d3ee", "#facc15"][i % 3], "#12001f", 13);
        this.tweens.add({ targets: p, y: p.y - 12, yoyo: true, repeat: 2, duration: 120, delay: i * 60 });
      }
    };
    await this.talk(KT_OPEN);
    // the Kreddle Express pulls in on the far line
    const train = this.add.image(-560, 276, "p_train").setOrigin(0, 1).setScale(2.4).setDepth(20).setTint(0xffc4f0);
    const livery = this.add.text(0, 0, "THE KREDDLE EXPRESS", { fontFamily: "Impact, sans-serif", fontSize: "16px", color: "#ff4fd8", stroke: "#12001f", strokeThickness: 4 }).setOrigin(0.5).setDepth(21);
    const follow = () => livery.setPosition(train.x + train.displayWidth * 0.42, train.y - train.displayHeight * 0.45);
    follow();
    synth.play("jet");
    this.cameras.main.shake(1600, 0.004);
    const sparks = this.time.addEvent({ delay: 140, loop: true, callback: () => vfx(this, "vfx_sparks", train.x + train.displayWidth - 40 - Math.random() * 300, 274, { scale: 0.8, depth: 22 }) });
    await this.tween({ targets: train, x: 120, duration: 2600, ease: "Cubic.out", onUpdate: follow });
    sparks.remove();
    // the President, in a shower of confetti
    const k = this.actor("TV_PRESIDENT_KLERBLE", -60, 322, 3, "PRESIDENT KLERBLE").setDepth(560);
    for (let i = 0; i < 6; i++) vfx(this, "vfx_confetti", 100 + i * 150, 120, { scale: 2, depth: 600, delay: i * 200 });
    cheer(["KLERBLE!!", "YES! YES!", "I LOVE YOU!!", "MARRY ME!", "KLERBLE!!!", "THE PRESIDENT!!"], 8);
    crowd.forEach((p) => this.tweens.add({ targets: p, y: p.y - 6, yoyo: true, repeat: 5, duration: 160, delay: Math.random() * 200 }));
    await this.tween({ targets: k, x: 330, duration: 2400 });
    this.face(k, "south");
    await this.talk(KT_ARRIVE.slice(0, 3));
    cheer(["BRAVEST MAN ALIVE", "YESSS!", "KLERBLE!!", "DRIVE IT!!"], 6);
    await this.talk(KT_ARRIVE.slice(3));
    // the driver gets posted into a slot machine
    const driver = this.actor("KD_PITBOSS", 680, 318, 2.6, "TRAIN DRIVER");
    const slot = this.prop("kd_m_slots", 900, 335, 1.1, 340, 0xa855f7, 50, 80);
    await this.tween({ targets: k, x: 600, duration: 900 });
    this.faceTo(k, driver.x);
    this.faceTo(driver, k.x);
    await this.talk(KT_DRIVER.slice(0, 2));
    synth.play("punch_big");
    this.cameras.main.shake(200, 0.01);
    await this.tween({ targets: driver, x: 890, y: 250, angle: 540, duration: 650, ease: "Sine.out" });
    await this.tween({ targets: driver, y: 300, scale: 0.4, alpha: 0, duration: 220, ease: "Quad.in" });
    synth.play("slot_spin");
    this.tweens.add({ targets: slot, angle: { from: -6, to: 6 }, yoyo: true, repeat: 4, duration: 70 });
    this.time.delayedCall(700, () => {
      synth.play("jackpot");
      vfx(this, "vfx_coins", 900, 280, { scale: 1.6, depth: 620 });
      const c = this.add.text(900, 220, "🍒🍒🍒", { fontSize: "22px" }).setOrigin(0.5).setDepth(620);
      this.tweens.add({ targets: c, y: 190, alpha: 0, delay: 900, duration: 600, onComplete: () => c.destroy() });
    });
    cheer(["HAHAHA", "JACKPOT!", "YES!!"], 4);
    await this.talk(KT_DRIVER.slice(2));
    // into the cab
    await this.tween({ targets: k, x: train.x + train.displayWidth - 80, y: 296, duration: 700 });
    synth.play("door");
    k.setVisible(false);
    const cab = this.add.sprite(0, 0, k.texture.key, 4).setScale(1.5).setDepth(22);
    const followCab = () => {
      follow();
      cab.setPosition(train.x + train.displayWidth - 72, train.y - train.displayHeight + 36);
    };
    followCab();
    this.cast.set("PRESIDENT KLERBLE", cab);
    // the Krunchers turn up
    const ks: Phaser.GameObjects.Sprite[] = [];
    KR.KRUNCHERS.forEach((kr, i) => {
      if (!this.textures.exists(`spr_${kr.of}`)) return;
      const sp = this.add.sprite(1000 + i * 40, 0, `spr_${kr.of}`, 0).setScale(2.4).setTint(i % 2 ? 0xff9de6 : 0x9be7ff);
      sp.setData("home", { x: 420 + (i % 5) * 92 + (i > 4 ? 46 : 0), y: i > 4 ? 330 : 306 });
      sp.setY((sp.getData("home") as { y: number }).y).setDepth(100 + sp.y);
      this.cast.set(kr.name, sp);
      ks.push(sp);
    });
    crowd.slice(6).forEach((p, i) => this.tweens.add({ targets: p, x: 40 + i * 30, duration: 900 }));
    await Promise.all(ks.map((sp, i) => this.tween({ targets: sp, x: (sp.getData("home") as { x: number }).x, duration: 1500 + i * 90 })));
    ks.forEach((sp) => this.face(sp, "south"));
    // their banner: the Krel Tower on fire, and it's quite good
    const banner = this.add.container(560, 200).setDepth(250);
    banner.add(this.add.rectangle(0, 0, 260, 66, 0x12001f, 0.92).setStrokeStyle(3, 0xff4fd8));
    if (this.textures.exists("p_kreltower")) banner.add(this.add.image(-96, 26, "p_kreltower").setOrigin(0.5, 1).setScale(0.24));
    banner.add(this.add.text(-96, -6, "🔥", { fontSize: "18px" }).setOrigin(0.5));
    banner.add(this.add.text(26, 0, "BURN KRELWORLD\nBURN!!", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ff4fd8", align: "center" }).setOrigin(0.5));
    banner.setScale(0.2);
    this.tween({ targets: banner, scale: 1, duration: 400, ease: "Back.out" });
    // their lines; Kredbon has a little demonstration
    const bon = this.cast.get("KREDBON");
    const krung = this.cast.get("LIL' KRUNGUS");
    let flag: Phaser.GameObjects.Container | undefined;
    for (const line of KT_KRUNCHERS) {
      if (line.dir && line.t.includes("pisses") && bon && krung) {
        this.face(krung, "east");
        flag = this.add.container(krung.x + 40, krung.y + 4).setDepth(krung.depth + 1);
        flag.add(this.add.rectangle(0, 0, 3, 40, 0x6b4f2a).setOrigin(0.5, 1));
        flag.add(this.add.rectangle(13, -32, 26, 16, 0xff4fd8).setStrokeStyle(1, 0x000000));
        flag.add(this.add.text(13, -32, "K", { fontFamily: FONT, fontSize: "10px", color: "#fff" }).setOrigin(0.5));
        await this.tween({ targets: bon, x: krung.x + 110, y: krung.y, duration: 600 });
        this.face(bon, "west");
        const bar = this.add.rectangle(bon.x - 8, bon.y + 8, 18, 7, 0x000000).setDepth(bon.depth + 2);
        const stop = this.peeStream(bon.x - 10, bon.y + 8, flag.x + 13, flag.y - 28, bon.depth + 3);
        this.time.delayedCall(1400, () => (flag?.list[1] as Phaser.GameObjects.Rectangle | undefined)?.setFillStyle(0xd9c43a));
        synth.play("slurp");
        cheer(["LEGEND!!", "HAHAHA", "FILM IT!", "DICK JUICE!!"], 5);
        await this.talk([line]);
        stop();
        bar.destroy();
        continue;
      }
      await this.talk([line]);
    }
    for (let i = 0; i < 3; i++) {
      ks.forEach((sp, j) => this.time.delayedCall(j * 40, () => this.bubble(sp, ["KRELWORLD DIES!", "DIE!!", "KRUNCH!"][(i + j) % 3], "#ff4fd8", "#12001f", 12)));
      this.cameras.main.shake(150, 0.004);
      await this.wait(500);
    }
    // away it goes
    await this.talk(KT_DEPART.slice(0, 2));
    this.cast.delete("PRESIDENT KLERBLE");
    synth.play("jet");
    this.cameras.main.shake(2500, 0.008);
    const sp2 = this.time.addEvent({ delay: 90, loop: true, callback: () => vfx(this, "vfx_sparks", train.x + 40 + Math.random() * train.displayWidth, 274, { scale: 0.9, depth: 22 }) });
    vfx(this, "vfx_dust", train.x + 40, 270, { scale: 2.4, depth: 23 });
    for (let i = 0; i < 8; i++) vfx(this, "vfx_confetti", 80 + i * 120, 140, { scale: 2, depth: 600, delay: i * 120 });
    cheer(["GO ON!!", "YES! YES!", "KILL 'EM ALL!", "KLERBLE!!!", "BYE TAP-LICKERS!"], 8);
    ks.forEach((sp, i) => this.tweens.add({ targets: sp, y: sp.y - 10, yoyo: true, repeat: 6, duration: 140, delay: i * 30 }));
    await this.tween({ targets: train, x: 1300, duration: 2600, ease: "Cubic.in", onUpdate: followCab });
    sp2.remove();
    await this.talk(KT_DEPART.slice(2));
    // remember their faces
    ks.forEach((sp, i) => {
      this.face(sp, "south");
      sp.setTint(i % 2 ? 0xff7ad0 : 0x7fd6ff);
    });
    const red = this.add.rectangle(480, 270, 960, 540, 0x7f1d1d).setAlpha(0).setDepth(700);
    this.tween({ targets: red, alpha: 0.35, duration: 1200 });
    synth.play("crowd_boo");
    ks.forEach((sp, i) => this.time.delayedCall(i * 140, () => this.bubble(sp, ["👎", "🖕", "🖕🖕"][i % 3], "#ffffff", "#111", 14)));
    // a slow, ugly push in on the lot of them
    const ktBars = Juice.letterbox(this, 46, 800, 985);
    const kcx = ks.length ? ks.reduce((a, sp) => a + sp.x, 0) / ks.length : 600;
    this.cameras.main.pan(kcx, 300, 2600, "Sine.easeInOut", true);
    this.cameras.main.zoomTo(1.3, 2600, "Sine.easeInOut", true);
    Juice.heartbeat(0.7);
    this.time.delayedCall(1100, () => Juice.heartbeat(0.7));
    this.caption("REMEMBER THEIR FACES.", "#ff4d4d", 30).setScrollFactor(0);
    await this.talk(KT_AFTER);
    this.dropCaption();
    ktBars(400);
    this.cameras.main.zoomTo(1, 500, "Sine.easeInOut", true);
    this.cameras.main.pan(480, 270, 500, "Sine.easeInOut", true);
    synth.stopMusic();
  }

  // ---------------------------------------------------------------- revenge_meeting: the emergency meeting

  /** The lads in the Town Hall: you front and centre, everyone else in two rows. */
  private meetingCast() {
    const me = G.s.player;
    const order = ["FLENKY", "KREZMAR", "CRONGUS", "SCROMBUS", "MIKEY", "GRONNY", "KREZWONK", "KREBLIS", "KREBON"].filter((id) => id !== me);
    const slots: [number, number][] = [[200, 298], [330, 304], [630, 304], [760, 298], [110, 236], [245, 228], [380, 222], [580, 222], [715, 228], [850, 236]];
    const lads: Record<string, Phaser.GameObjects.Sprite> = {};
    order.forEach((id, i) => {
      const [x, y] = slots[i];
      lads[id] = this.actor(id, x, y, 3.4);
      lads[id].setData("home", { x, y });
    });
    lads[me] = this.actor(me, 480, 310, 3.6);
    lads[me].setData("home", { x: 480, y: 310 });
    return lads;
  }

  private goHome(sps: Phaser.GameObjects.Sprite[], ms = 900) {
    return Promise.all(sps.map((sp) => {
      const h = sp.getData("home") as { x: number; y: number };
      return this.tween({ targets: sp, x: h.x, y: h.y, angle: 0, duration: ms }).then(() => {
        sp.setDepth(100 + sp.y);
        this.face(sp, "south");
      });
    }));
  }

  private async revengeMeeting() {
    await ensureCh6Art(this);
    const me = G.s.player;
    if (!backdrop(this, "bg_townhall", { dim: 0.35, depth: -10 })) this.sky(0x2a2238, 0x4a3a2a);
    synth.weatherSound("rain");
    // it's raining outside: the hall's windows flicker with lightning now and then
    const win = this.add.rectangle(480, 270, 960, 540, 0xdbeafe).setAlpha(0).setDepth(-8).setBlendMode(Phaser.BlendModes.ADD);
    this.time.addEvent({ delay: 6000, loop: true, callback: () => {
      this.tweens.chain({ targets: win, tweens: [{ alpha: 0.35, duration: 50 }, { alpha: 0, duration: 400 }] });
      this.time.delayedCall(400, () => synth.play("thunder"));
    } });
    synth.music("ominous");
    const L = this.meetingCast();
    const all = Object.values(L);
    const S = (id: string) => L[id] ?? L[me];
    this.caption("EMERGENCY MEETING", "#ff4d4d", 34);
    await this.wait(1100);
    this.dropCaption();
    await this.talk(RM_OPEN);

    // ---- Jenko
    const jen = S("FLENKY");
    await this.tween({ targets: jen, x: 480, y: 240, duration: 800 });
    jen.setDepth(400);
    this.face(jen, "south");
    const photo = this.add.container(jen.x + 34, jen.y - 10).setDepth(401);
    photo.add(this.add.rectangle(0, 0, 34, 42, 0xffffff).setStrokeStyle(2, 0x111111));
    photo.add(this.add.rectangle(0, -4, 28, 28, 0xf9a8d4));
    photo.add(this.add.text(0, -4, "♥", { fontFamily: FONT, fontSize: "18px", color: "#be185d" }).setOrigin(0.5));
    photo.add(this.add.text(0, 15, "MOLLOR", { fontFamily: FONT, fontSize: "7px", color: "#111" }).setOrigin(0.5));
    const rage = this.time.addEvent({ delay: 120, loop: true, callback: () => {
      jen.setTint(Math.random() < 0.5 ? 0xff8888 : 0xffffff);
      if (Math.random() < 0.3) {
        const tear = this.add.circle(jen.x + (Math.random() < 0.5 ? -8 : 8), jen.y - 20, 3, 0x60a5fa).setDepth(402);
        this.tweens.add({ targets: tear, y: tear.y + 40, alpha: 0, duration: 600, onComplete: () => tear.destroy() });
      }
    } });
    this.cameras.main.shake(300, 0.006);
    await this.talk(RM_JENKO);
    rage.remove();
    jen.clearTint();
    photo.destroy();
    await this.goHome([jen], 700);

    // ---- Polson: the Krelburger CCTV on the Town Hall telly
    if (G.s.flags.polson_dead) {
      const tv = this.add.container(480, 150).setDepth(500);
      tv.add(this.add.rectangle(0, 0, 230, 140, 0x111111).setStrokeStyle(4, 0x3f3f46));
      tv.add(this.add.rectangle(0, -4, 210, 112, 0x3a3f36));
      tv.add(this.add.rectangle(0, 30, 210, 40, 0x6b6b5a));
      if (this.textures.exists("spr_POLSON_FAT")) tv.add(this.add.sprite(40, 46, "spr_POLSON_FAT", 11).setOrigin(0.5, 1).setScale(0.9));
      const tk = this.add.sprite(-55, 46, "spr_TV_PRESIDENT_KLERBLE", 4).setOrigin(0.5, 1).setScale(0.8);
      tv.add(tk);
      tv.add(this.add.text(-100, -56, "● REC  KRELBURGER CAM 2", { fontFamily: FONT, fontSize: "9px", color: "#ff4d4d" }));
      tv.add(this.add.text(0, 76, "GB KREWS", { fontFamily: "Impact, sans-serif", fontSize: "13px", color: "#ffd23f" }).setOrigin(0.5));
      const scan = this.add.rectangle(0, -60, 210, 4, 0xffffff, 0.15);
      tv.add(scan);
      this.tweens.add({ targets: scan, y: 50, duration: 1400, repeat: -1 });
      // the loop: flash, and he goes over
      const loop = this.time.addEvent({ delay: 2600, loop: true, callback: () => {
        const f = this.add.rectangle(0, -4, 210, 112, 0xffffff, 0.8);
        tv.add(f);
        this.tweens.add({ targets: f, alpha: 0, duration: 250, onComplete: () => f.destroy() });
      } });
      synth.stopMusic();
      await this.talk(RM_POLSON.slice(0, 2));
      for (const sp of all) this.face(sp, "north");
      await this.talk(RM_POLSON.slice(2, 6));
      // everyone's gutted
      const sob = this.time.addEvent({ delay: 260, loop: true, callback: () => {
        const sp = all[Math.floor(Math.random() * all.length)];
        const tear = this.add.circle(sp.x + (Math.random() < 0.5 ? -7 : 7), sp.y - 20, 3, 0x60a5fa).setDepth(402);
        this.tweens.add({ targets: tear, y: tear.y + 34, alpha: 0, duration: 600, onComplete: () => tear.destroy() });
      } });
      await this.talk(RM_POLSON.slice(6, RM_POLSON.length - 3));
      await this.talk(RM_POLSON.slice(RM_POLSON.length - 3, RM_POLSON.length - 1));
      loop.remove();
      tv.destroy();
      await this.talk(RM_POLSON.slice(RM_POLSON.length - 1));
      sob.remove();
      for (const sp of all) this.face(sp, "south");
      synth.music("ominous");
    }

    // ---- revenge!
    const scr = S("SCROMBUS");
    synth.play("smash");
    this.cameras.main.shake(250, 0.012);
    this.caption("REVENGE!!!", "#ff4d4d", 44);
    await this.talk(RM_REVENGE.slice(0, 1));
    all.forEach((sp, i) => this.time.delayedCall(i * 60, () => this.bubble(sp, ["REVENGE!", "YES!!", "KREDDLE!!", "YEAH!!"][i % 4], "#fecaca", "#7f1d1d", 13)));
    await this.talk(RM_REVENGE.slice(1));
    this.dropCaption();
    // ---- Kreblis has been saying this since the first meeting
    const kreb = S("KREBLIS");
    await this.talk(RM_KREBLIS.slice(0, 2));
    kreb.setDepth(450);
    const joy = this.perform([kreb], "victory", 12);
    const jump = this.tweens.add({ targets: kreb, y: kreb.y - 26, yoyo: true, repeat: -1, duration: 220, ease: "Quad.out" });
    const thumbs = this.time.addEvent({ delay: 180, loop: true, callback: () => {
      const t = this.add.text(kreb.x + (Math.random() - 0.5) * 80, kreb.y - 40, Math.random() < 0.7 ? "👍" : "😭", { fontSize: "20px" }).setOrigin(0.5).setDepth(460);
      this.tweens.add({ targets: t, y: t.y - 60, x: t.x + (Math.random() - 0.5) * 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
      const tear = this.add.circle(kreb.x + (Math.random() < 0.5 ? -9 : 9), kreb.y - 22, 3, 0x60a5fa).setDepth(461);
      this.tweens.add({ targets: tear, x: tear.x + (tear.x < kreb.x ? -30 : 30), y: tear.y + 30, alpha: 0, duration: 500, onComplete: () => tear.destroy() });
    } });
    synth.play("cheer");
    vfx(this, "vfx_confetti", kreb.x, kreb.y - 60, { scale: 1.6, depth: 470 });
    await this.talk(RM_KREBLIS.slice(2, 6));
    jump.remove();
    thumbs.remove();
    joy();
    await this.goHome([kreb], 300);
    await this.talk(RM_KREBLIS.slice(6));

    // ---- "it was you"
    synth.stopMusic();
    const bon = me === "KREBON" ? S("PROCTUS") : S("KREBON");
    await this.talk(RM_ACTUALLY.slice(0, 4));
    for (const sp of all) if (sp !== L[me]) this.faceTo(sp, L[me].x);
    this.face(L[me], "south");
    const sweat = this.time.addEvent({ delay: 200, loop: true, callback: () => {
      const d = this.add.text(L[me].x + (Math.random() - 0.5) * 50, L[me].y - 50, "💦", { fontSize: "14px" }).setOrigin(0.5).setDepth(600);
      this.tweens.add({ targets: d, y: d.y + 30, alpha: 0, duration: 600, onComplete: () => d.destroy() });
    } });
    this.caption("…", "#ffffff", 40);
    await this.wait(900);
    this.dropCaption();
    await this.talk(RM_ACTUALLY.slice(4, 7));
    sweat.remove();
    synth.music("ominous");
    // everyone nods: a fine point, well made
    all.forEach((sp, i) => this.tweens.add({ targets: sp, y: sp.y + 5, yoyo: true, repeat: 2, duration: 160, delay: i * 50 }));
    await this.talk(RM_ACTUALLY.slice(7, 9));
    for (const sp of all) if (sp !== bon) this.faceTo(sp, bon.x);
    // he cowers
    this.tweens.add({ targets: bon, angle: { from: -6, to: 6 }, yoyo: true, repeat: 5, duration: 60, onComplete: () => bon.setAngle(0) });
    bon.setTint(0xbfdbfe);
    this.time.delayedCall(1600, () => bon.clearTint());
    await this.talk(RM_ACTUALLY.slice(9));
    all.forEach((sp) => this.face(sp, "south"));

    // ---- Sanjeev has always counselled restraint. Then he heard about Polson.
    if (G.s.flags.polson_dead) {
      const sj = this.actor("SANJEEV", 600, 600, 3.4);
      await this.walkTo(sj, 600, 400, 1800);
      this.face(sj, "south");
      for (const sp of all) this.faceTo(sp, sj.x);
      await this.talk(SJ_KREDDLE.slice(0, 10));
      this.cameras.main.shake(400, 0.01);
      synth.play("thunder");
      this.caption("LEAVE NOTHING.", "#ff4d4d", 40);
      await this.talk(SJ_KREDDLE.slice(10, 13));
      this.dropCaption();
      await this.walkTo(sj, 600, 640, 1500);
      sj.destroy();
      all.forEach((sp) => this.face(sp, "south"));
    }

    // ---- chemical weapons
    const mik = S("MIKEY");
    await this.tween({ targets: mik, x: 480, y: 240, duration: 700 });
    mik.setDepth(400);
    this.face(mik, "south");
    await this.talk(RM_CHEM.slice(0, 2));
    synth.play("cheer");
    this.caption("CHEMICAL WEAPONS!!", "#7cff3a", 40);
    const gas = this.time.addEvent({ delay: 90, repeat: 30, callback: () => {
      const g = this.add.circle(Math.random() * 960, 340, 18 + Math.random() * 20, 0x84cc16, 0.3).setDepth(300);
      this.tweens.add({ targets: g, y: g.y - 160 - Math.random() * 80, scale: 2.2, alpha: 0, duration: 1600, onComplete: () => g.destroy() });
    } });
    all.forEach((sp, i) => this.time.delayedCall(i * 70, () => this.bubble(sp, ["YESSSSSS!", "YESSSS!", "HA HA YES !! DIEEE!", "DIEEE!!"][i % 4], "#d9f99d", "#14532d", 13)));
    await this.talk(RM_CHEM.slice(2));
    gas.remove();
    this.dropCaption();
    await this.goHome([mik], 600);

    // ---- Luke and the Krelneva Convention
    const luke = S("CRONGUS");
    const kz = S("KREZMAR");
    luke.setData("busy", true);
    await this.tween({ targets: luke, x: 370, y: 270, duration: 600 });
    luke.setDepth(400);
    luke.setData("busy", false);
    this.face(luke, "east");
    await this.talk(RM_LUKE.slice(0, 3));
    await this.tween({ targets: kz, x: 540, y: 270, duration: 900 });
    kz.setDepth(401);
    this.face(kz, "west");
    await this.talk(RM_LUKE.slice(3, 4));
    const doc = this.prop("c6_krelneva", kz.x - 26, kz.y - 2, 0.8, 410, 0xf4ecd8, 30, 36);
    doc.setScale(0.1);
    synth.play("pickup");
    await this.tween({ targets: doc, scale: this.textures.exists("c6_krelneva") ? 0.9 : 1, duration: 400, ease: "Back.out" });
    await this.talk(RM_LUKE.slice(4));
    this.caption("THE KRELNEVA CONVENTION", "#fde68a", 26);
    // it goes on the floor; Krezmar does what Krezmar does
    await this.tween({ targets: doc, x: 455, y: 318, angle: -8, duration: 400, ease: "Quad.in" });
    synth.play("splat");
    this.dropCaption();
    const bar = this.add.rectangle(kz.x - 12, kz.y + 14, 24, 9, 0x000000).setDepth(420);
    const stop = this.peeStream(kz.x - 16, kz.y + 14, 455, 302, 421);
    if (doc instanceof Phaser.GameObjects.Image) {
      let k = 0;
      this.time.addEvent({ delay: 150, repeat: 20, callback: () => {
        k++;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0xe8c830), 20, k);
        if (doc.active) doc.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      } });
    }
    const puddle = this.add.ellipse(455, 320, 10, 5, 0xf7e04a, 0.6).setDepth(405);
    this.tweens.add({ targets: puddle, displayWidth: 120, displayHeight: 18, duration: 5000 });
    synth.play("slurp");
    all.forEach((sp, i) => {
      if (sp === kz || sp === luke) return;
      this.time.delayedCall(400 + i * 120, () => this.bubble(sp, ["HAHAHA", "LEGEND", "ON THE DOVE!!", "😂", "YES BRINKLEY"][i % 5], "#fef08a", "#713f12", 12));
    });
    await this.talk(RM_PISS);
    stop();
    bar.destroy();
    // ...and in Luke's face
    this.face(kz, "west");
    await this.tween({ targets: doc, x: kz.x - 20, y: kz.y - 10, angle: 0, duration: 250 });
    synth.play("lob");
    await this.tween({ targets: doc, x: luke.x + 6, y: luke.y - 22, angle: -720, duration: 420, ease: "Quad.in" });
    synth.play("splat");
    vfx(this, "vfx_hit", luke.x, luke.y - 20, { scale: 1.6, depth: 430 });
    for (let i = 0; i < 10; i++) {
      const d = this.add.circle(luke.x, luke.y - 20, 3, 0xffe14a).setDepth(431);
      this.tweens.add({ targets: d, x: d.x + (Math.random() - 0.5) * 90, y: d.y + (Math.random() - 0.2) * 70, alpha: 0, duration: 500, onComplete: () => d.destroy() });
    }
    const hurt = charMeta(this, luke.texture.key)?.hurt?.south;
    if (hurt) hurt.forEach((f, i) => this.time.delayedCall(i * 90, () => luke.setFrame(f)));
    this.tweens.add({ targets: luke, x: luke.x - 30, duration: 200 });
    this.cameras.main.shake(200, 0.008);
    this.caption("SPLAT", "#fde047", 40);
    await this.talk(RM_THROW);
    this.tween({ targets: doc, y: 340, angle: 30, duration: 400, ease: "Bounce.out" });
    this.dropCaption();

    // ---- YEAH LUKE: shoving pandemonium
    synth.music("boss", true);
    this.caption("YEAH LUKE!", "#ff4d4d", 38);
    let mob = true;
    const others = all.filter((sp) => sp !== luke);
    const shoveOnce = () => {
      if (!mob) return;
      const a = others[Math.floor(Math.random() * others.length)];
      const intoLuke = Math.random() < 0.65;
      const b = intoLuke ? luke : others[Math.floor(Math.random() * others.length)];
      if (a === b || a.getData("hop")) return;
      const dir = b.x >= a.x ? 1 : -1;
      this.tweens.killTweensOf(a);
      this.tweens.add({ targets: a, x: Phaser.Math.Clamp(b.x - dir * 34, 60, 900), y: Phaser.Math.Clamp(b.y + (Math.random() - 0.5) * 16, 220, 305), duration: 140, onComplete: () => {
        this.faceTo(a, b.x);
        this.tweens.killTweensOf(b);
        this.tweens.add({ targets: b, x: Phaser.Math.Clamp(b.x + dir * (40 + Math.random() * 50), 60, 900), y: Phaser.Math.Clamp(b.y + (Math.random() - 0.5) * 30, 220, 305), angle: dir * (8 + Math.random() * 12), duration: 220, ease: "Quad.out", onComplete: () => b.setAngle(0) });
        a.setDepth(100 + a.y);
        b.setDepth(100 + b.y);
        synth.play(Math.random() < 0.3 ? "punch_big" : "punch");
        vfx(this, Math.random() < 0.5 ? "vfx_hit" : "vfx_dust", (a.x + b.x) / 2, a.y, { scale: 1.1, depth: 500 });
        if (Math.random() < 0.5) this.bubble(a, ["SHOVE!", "YEAH LUKE!", "OI!", "*SHOVE*", "TAKE THAT LUKE", "NO DOVES!"][Math.floor(Math.random() * 6)], "#ffffff", "#111", 12);
        const h = charMeta(this, b.texture.key)?.hurt?.south;
        if (h) b.setFrame(h[Math.floor(Math.random() * h.length)]);
      } });
    };
    const mobEv = this.time.addEvent({ delay: 110, loop: true, callback: shoveOnce });
    this.cameras.main.shake(4000, 0.004);
    await this.talk(RM_SHOVE);
    this.caption("PANDEMONIUM", "#ff4d4d", 40);
    await this.wait(2200);
    mob = false;
    mobEv.remove();
    this.dropCaption();
    synth.music("ominous");
    // Scrombus on the table
    await this.talk(RM_UNITE.slice(0, 1));
    all.forEach((sp) => {
      this.tweens.killTweensOf(sp);
      sp.setAngle(0);
      this.faceTo(sp, scr.x);
    });
    await this.goHome(all, 800);
    luke.setPosition(370, 270);
    this.tweens.add({ targets: scr, y: scr.y - 40, duration: 300, ease: "Quad.out" });
    await this.talk(RM_UNITE.slice(1, 3));
    this.tweens.add({ targets: scr, y: (scr.getData("home") as { y: number }).y, duration: 300, ease: "Bounce.out" });
    await this.talk(RM_UNITE.slice(3));
    this.tween({ targets: doc, alpha: 0, duration: 300 }).then(() => doc.destroy());
    puddle.destroy();
    luke.setData("home", { x: luke.x, y: luke.y });

    // ---- Kreddle's arsenal (who cares)
    const arsenal = this.add.container(480, 110).setDepth(700);
    arsenal.add(this.add.rectangle(0, 0, 520, 110, 0x0b0f1a, 0.92).setStrokeStyle(3, 0xef4444));
    arsenal.add(this.add.text(0, -40, "KREDDLE: KNOWN ARSENAL", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ef4444" }).setOrigin(0.5));
    ["c6_missile", "c6_launcher", "c6_nuke", "c6_launcher4", "c6_missile"].forEach((k, i) => {
      const img = this.prop(k, -200 + i * 100, 48, 0.9, 0, 0x64748b, 40, 30);
      arsenal.add(img);
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, delay: 200 + i * 180, duration: 200 });
    });
    synth.play("alarm");
    await this.talk(RM_CAUTION.slice(0, 3));
    synth.play("trombone");
    await this.tween({ targets: arsenal, y: -120, angle: 8, duration: 400, ease: "Quad.in" });
    arsenal.destroy();
    all.forEach((sp, i) => this.time.delayedCall(i * 60, () => this.bubble(sp, ["NEVER!", "WHO CARES!", "NO BALLS!", "PFFT"][i % 4], "#ffffff", "#111", 12)));
    await this.talk(RM_CAUTION.slice(3));

    // ---- the prizes
    const giver = me === "KREBON" ? S("KREZMAR") : S("KREBON");
    const crate = this.prop("p_gun_crate", 480, 312, 1.8, 300, 0x8b5a2b, 70, 40);
    crate.setX(-60);
    await Promise.all([this.tween({ targets: giver, x: 400, y: 260, duration: 1000 }), this.tween({ targets: crate, x: 480, duration: 1000 })]);
    synth.play("door");
    await this.talk(RM_ARMS);
    // the lid flies off and out it floats
    synth.play("explode");
    vfx(this, "vfx_dust", 480, 300, { scale: 2, depth: 310 });
    const fl = this.prop("c6_chemflamer", 480, 290, 1.4, 600, 0x22c55e, 60, 20);
    const glow = this.add.ellipse(480, 260, 120, 60, 0x7cff3a, 0.35).setDepth(599).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 300 });
    synth.play("perfect");
    await this.tween({ targets: [fl, glow], y: "-=70", duration: 900, ease: "Sine.out" });
    const pl = L[me];
    await this.tween({ targets: [fl, glow], x: pl.x + 30, y: pl.y + 20, duration: 700, ease: "Sine.inOut" });
    glow.destroy();
    fl.setScale(this.textures.exists("c6_chemflamer") ? 0.9 : 1);
    this.giveFlamer();
    this.caption("CHEMICAL FLAMETHROWER", "#7cff3a", 30);
    synth.play("gun_flamer");
    // a test burst at the ceiling
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 70, () => {
        const f = vfx(this, "vfx_fire", pl.x + 40 + i * 6, pl.y - 30 - i * 18, { scale: 0.8 + i * 0.1, depth: 610, tint: 0x5bff2a });
        // the fire sheet loops: these are just a burst
        if (f) this.tween({ targets: f, alpha: 0, delay: 500, duration: 400 }).then(() => f.destroy());
        if (!f) {
          const c = this.add.circle(pl.x + 40 + i * 6, pl.y - 30 - i * 18, 10 + i * 2, 0x7cff3a, 0.8).setDepth(610);
          this.tween({ targets: c, alpha: 0, scale: 2, duration: 500 }).then(() => c.destroy());
        }
      });
    }
    this.cameras.main.shake(500, 0.006);
    all.forEach((sp, i) => sp !== pl && this.time.delayedCall(300 + i * 60, () => this.bubble(sp, ["OOOOH", "GREEN!!", "😍", "LOVELY"][i % 4], "#d9f99d", "#14532d", 12)));
    await this.talk(RM_GOT_GUN);
    this.dropCaption();
    this.tween({ targets: crate, alpha: 0, duration: 300 });
    await this.goHome([giver], 600);
    // everyone else's toys
    const toy = (id: string, key: string, fb: number) => {
      const sp = S(id);
      const img = this.prop(key, sp.x + 40, sp.y + 46, 1.1, sp.depth + 1, fb, 26, 30);
      img.setScale(0.1);
      this.tween({ targets: img, scale: this.textures.exists(key) ? 1.1 : 1, duration: 300, ease: "Back.out" });
      return img;
    };
    const toys: Phaser.GameObjects.Image[] = [];
    const showLines = RM_SHOWOFF;
    toys.push(toy("MIKEY", "c6_napalm", 0xea580c));
    await this.talk(showLines.slice(0, 1));
    toys.push(toy("GRONNY", "c6_mustard", 0xeab308));
    await this.talk(showLines.slice(1, 2));
    const nb = toy("CRONGUS", "c6_nailbomb", 0x64748b);
    toys.push(nb);
    const fuse = this.time.addEvent({ delay: 120, loop: true, callback: () => vfx(this, "vfx_sparks", nb.x + 18, nb.y - 40, { scale: 0.5, depth: nb.depth + 1 }) });
    await this.talk(showLines.slice(2, 5));
    const bucket = this.add.container(S("KREBLIS").x + 34, S("KREBLIS").y + 20).setDepth(S("KREBLIS").depth + 1);
    bucket.add(this.add.polygon(0, 0, [0, 0, 24, 0, 20, 24, 4, 24], 0x94a3b8).setStrokeStyle(2, 0x334155));
    await this.talk(showLines.slice(5));
    // the nuke, under a tarp in the corner
    const wonk = S("KREZWONK");
    const nuke = this.prop("c6_nuke", 870, 335, 1.9, 330, 0x14532d, 90, 50);
    const tarp = this.add.rectangle(860, 300, 130, 70, 0x475569).setStrokeStyle(2, 0x1e293b).setDepth(331);
    await this.tween({ targets: wonk, x: 770, y: 290, duration: 900 });
    this.face(wonk, "east");
    await this.talk(RM_NUKE.slice(0, 1));
    synth.play("pop");
    await this.tween({ targets: tarp, x: 1060, y: 200, angle: 40, duration: 500, ease: "Quad.out" });
    tarp.destroy();
    const bow = this.add.container(nuke.x, nuke.y - 70).setDepth(332);
    bow.add(this.add.triangle(-8, 0, 0, 0, -14, -8, -14, 8, 0xef4444));
    bow.add(this.add.triangle(8, 0, 0, 0, 14, -8, 14, 8, 0xef4444));
    bow.add(this.add.circle(0, 0, 4, 0xb91c1c));
    const tick = this.add.text(nuke.x, nuke.y - 30, "04:00", { fontFamily: "Courier New, monospace", fontSize: "13px", color: "#ef4444", backgroundColor: "#000", padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(333);
    this.tweens.add({ targets: tick, alpha: 0.3, yoyo: true, repeat: -1, duration: 400 });
    synth.play("gasp");
    this.cameras.main.shake(300, 0.006);
    // the room goes very still: a hard push in on it, a heartbeat
    Juice.subDrop(0.8, 1.2);
    Juice.heartbeat();
    this.cameras.main.pan(nuke.x - 120, nuke.y - 110, 260, "Quad.easeOut", true);
    this.cameras.main.zoomTo(1.35, 260, "Quad.easeOut", true);
    this.caption("☢ A NUCLEAR BOMB ☢", "#facc15", 34).setScrollFactor(0);
    await this.wait(1100);
    this.cameras.main.pan(480, 270, 700, "Sine.easeInOut", true);
    this.cameras.main.zoomTo(1, 700, "Sine.easeInOut", true);
    await this.talk(RM_NUKE.slice(1, 4));
    this.dropCaption();
    // he sits on it
    await this.tween({ targets: wonk, x: nuke.x, y: nuke.y - 55, duration: 500 });
    wonk.setDepth(334);
    this.face(wonk, "south");
    await this.talk(RM_NUKE.slice(4));
    fuse.remove();

    // ---- hands in
    await this.talk(RM_HANDS);
    [...toys, nb].forEach((t) => t.active && this.tween({ targets: t, alpha: 0, duration: 300 }));
    bucket.destroy();
    const n = all.length;
    await Promise.all(all.map((sp, i) => {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const x = 480 + Math.cos(a) * 230;
      const y = 300 + Math.sin(a) * 56 + (i % 2) * 6;
      return this.tween({ targets: sp, x, y, duration: 1100 }).then(() => {
        sp.setDepth(100 + sp.y);
        this.faceTo(sp, 480);
      });
    }));
    const hands = all.map((sp, i) => {
      const h = this.add.circle(sp.x, sp.y - 6, 7, [0xf1c27d, 0xe0ac69, 0xffdbac, 0xc68642][i % 4]).setStrokeStyle(2, 0x3b2a1a).setDepth(500);
      this.tween({ targets: h, x: 480 + (Math.random() - 0.5) * 18, y: 236 + (Math.random() - 0.5) * 10, duration: 600, delay: i * 70, ease: "Sine.out" });
      return h;
    });
    await this.wait(1100);
    synth.play("bongo");
    // in close on the hands while it builds
    this.cameras.main.pan(480, 250, 900, "Sine.easeInOut", true);
    this.cameras.main.zoomTo(1.3, 900, "Sine.easeInOut", true);
    await this.talk(RM_END.slice(0, 1));
    Juice.riser(700, 0.35);
    await this.wait(700);
    // UNITE!
    synth.play("cheer");
    Juice.subDrop(0.9, 1.4);
    this.cameras.main.flash(300, 255, 255, 255);
    this.cameras.main.zoomTo(1, 900, "Cubic.easeOut", true);
    this.cameras.main.pan(480, 270, 900, "Cubic.easeOut", true);
    Juice.shockRing(this, 480, 150, { color: 0xffd23f, to: 700, rings: 3, depth: 560 });
    // light pours down on them
    const rays = [0, 1, 2, 3, 4].map((i) => {
      const r = this.add.triangle(480, 120, 0, 0, -26, 520, 26, 520, 0xffe9a8, 0.16).setOrigin(0, 0).setDepth(90).setBlendMode(Phaser.BlendModes.ADD).setAngle(-50 + i * 25);
      this.tweens.add({ targets: r, angle: r.angle + 12, yoyo: true, repeat: -1, duration: 1600 + i * 200, ease: "Sine.inOut" });
      return r;
    });
    this.tween({ targets: hands, y: 120, duration: 400, ease: "Back.out" });
    const joy2 = this.perform(all, "victory", 10);
    vfx(this, "vfx_confetti", 480, 140, { scale: 2.4, depth: 600 });
    this.caption("KRELWORLD KREW UNITE!", "#ffd23f", 38);
    this.tweens.add({ targets: S("KREBLIS"), y: "-=30", yoyo: true, repeat: 5, duration: 200 });
    await this.talk(RM_END.slice(1, 4));
    joy2();
    hands.forEach((h) => h.destroy());
    rays.forEach((r) => this.tweens.add({ targets: r, alpha: 0, duration: 600, onComplete: () => r.destroy() }));
    this.dropCaption();
    await this.talk(RM_END.slice(4));
    // out into the rain
    await Promise.all(all.map((sp, i) => this.tween({ targets: sp, x: -80 - i * 30, y: 300 + (i % 3) * 14, duration: 1800 + i * 80 })));
    synth.stopMusic();
  }

  private giveFlamer() {
    const s = G.s;
    s.guns = s.guns ?? {};
    s.guns.chem_flamer = Math.max(s.guns.chem_flamer ?? 0, GUNS.chem_flamer.maxAmmo);
    s.gun = "chem_flamer";
  }

  /** Everyone on stage, lads only (no Proctus): for the party scenes. */
  private partyCast(y0 = 300) {
    const me = G.s.player;
    const ids: string[] = [...LADS, "MIKEY"].filter((p) => p !== me);
    ids.splice(Math.floor(ids.length / 2), 0, me);
    return ids.map((id, i) => {
      const x = 90 + i * (780 / (ids.length - 1));
      const y = y0 + (i % 2) * 34;
      const sp = this.actor(id, x, y, 3.1);
      sp.setData("home", { x, y });
      return sp;
    });
  }

  // ---------------------------------------------------------------- krunch_protocol

  private async krunchProtocol() {
    await ensureCh6Art(this);
    G.rt.timerEnd = 0;
    G.emit("timer", null);
    // (a) the Town Hall: hubris
    if (!backdrop(this, "bg_townhall", { dim: 0.1, depth: -10 })) this.sky(0x6b4f2a, 0x3a2a1a);
    synth.weatherSound("rain");
    synth.musicRaw("crazy");
    const lads = this.partyCast(290);
    lads.forEach((sp) => sp.setTint(0xd6d3d1));
    // still smoking from Kreddle
    const smoke = this.time.addEvent({ delay: 220, loop: true, callback: () => {
      const sp = lads[Math.floor(Math.random() * lads.length)];
      const p = this.add.circle(sp.x + (Math.random() - 0.5) * 20, sp.y - 30, 5, 0x6b7280, 0.6).setDepth(300);
      this.tweens.add({ targets: p, y: p.y - 50, scale: 2.5, alpha: 0, duration: 1200, onComplete: () => p.destroy() });
    } });
    // where we are and when: home, with the bomb in Kreddle still ticking
    const left = Math.max(14, Math.min(239, Number(G.s.flags.nuke_left) || 47));
    const clock = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
    await Juice.titleCard(this, "BACK OVER THE BRIDGE, JUST IN TIME", "KRELFORD TOWN HALL", `☢ KREDDLE: ${clock(left)} TO DETONATION`, 1700);
    const stop = this.perform(lads, "victory", 10);
    for (let i = 0; i < 5; i++) vfx(this, "vfx_confetti", 120 + i * 180, 120, { scale: 2, depth: 600, delay: i * 250 });
    synth.play("cheer");
    this.caption("WE WON!!!", "#ffd23f", 40);
    await this.wait(1200);
    this.dropCaption();
    stop();
    await this.talk(KP_PARTY.slice(0, 7));
    const stop2 = this.perform(lads, "victory", 12);
    this.caption("THEY DON'T HAVE THE BALLS!!", "#ff4d4d", 34);
    lads.forEach((sp, i) => this.time.delayedCall(i * 90, () => this.bubble(sp, ["NO BALLS!", "NEVER!!", "HAHAHA", "WOOO!"][i % 4], "#ffffff", "#111", 12)));
    await this.talk(KP_PARTY.slice(7));
    stop2();
    smoke.remove();
    this.dropCaption();

    // (b) the palace: the last breath
    synth.stopMusic();
    synth.weatherSound(null);
    this.cameras.main.flash(250, 0, 0, 0);
    this.clearStage();
    this.add.rectangle(480, 270, 960, 540, 0x0c0810).setDepth(-12);
    const bunker = backdrop(this, "tv_bunker", { dim: 0.45, depth: -10 });
    // (lift the room so its floor sits above the dialogue box)
    if (bunker) bunker.setY(150);
    else this.add.rectangle(480, 270, 960, 540, 0x1a1020).setDepth(-10);
    this.add.rectangle(480, 270, 960, 540, 0x7f1d1d, 0.25).setDepth(-8).setBlendMode(Phaser.BlendModes.MULTIPLY);
    // the lights are going
    const dark = this.add.rectangle(480, 270, 960, 540, 0x000000).setAlpha(0).setDepth(600);
    this.time.addEvent({ delay: 700, loop: true, callback: () => {
      if (Math.random() < 0.5) return;
      dark.setAlpha(0.6);
      this.time.delayedCall(60, () => dark.setAlpha(0.1));
      this.time.delayedCall(120, () => dark.setAlpha(0.5));
      this.time.delayedCall(200, () => dark.setAlpha(0));
    } });
    for (const fx of [60, 250, 560]) this.fireBlob(fx, 345, 34, 50);
    this.time.addEvent({ delay: 400, loop: true, callback: () => vfx(this, "vfx_sparks", 100 + Math.random() * 760, 60 + Math.random() * 80, { scale: 1, depth: 80 }) });
    const term = this.prop("c6_kd_terminal", 810, 360, 2.4, 200, 0x334155, 120, 90);
    void term;
    const screenGlow = this.add.ellipse(800, 265, 90, 60, 0xef4444, 0.25).setDepth(201).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: screenGlow, alpha: 0.05, yoyo: true, repeat: -1, duration: 500 });
    // the drawn crawl cycle (PixelLab), fetched if this build's manifest doesn't list it yet
    if (!this.textures.exists("c6_klerble_crawl_anim")) {
      await new Promise<void>((res) => {
        this.load.spritesheet("c6_klerble_crawl_anim", "art/props/c6_klerble_crawl_anim.png", { frameWidth: 64, frameHeight: 32 });
        this.load.once(Phaser.Loader.Events.COMPLETE, () => res());
        this.time.delayedCall(4000, () => res());
        this.load.start();
      });
    }
    const crawlAnim = this.textures.exists("c6_klerble_crawl_anim");
    if (crawlAnim && !this.anims.exists("c6_klerble_crawl")) this.anims.create({ key: "c6_klerble_crawl", frames: this.anims.generateFrameNumbers("c6_klerble_crawl_anim", { start: 0, end: 8 }), frameRate: 7, repeat: -1 });
    const hasCrawl = this.textures.exists("c6_klerble_crawl");
    const kl = crawlAnim
      ? this.add.sprite(-60, 352, "c6_klerble_crawl_anim", 0).setOrigin(0.5, 1).setScale(2.6).setDepth(300)
      : hasCrawl
        ? this.add.image(-60, 352, "c6_klerble_crawl").setOrigin(0.5, 1).setScale(2.6).setDepth(300)
        : this.add.sprite(-60, 340, "spr_TV_PRESIDENT_KLERBLE", 4).setScale(2.4).setAngle(80).setDepth(300);
    const crawling = (on: boolean) => {
      if (!crawlAnim || !(kl instanceof Phaser.GameObjects.Sprite)) return;
      if (on) kl.play("c6_klerble_crawl", true);
      else kl.stop();
    };
    this.cast.set("PRESIDENT KLERBLE", kl as Phaser.GameObjects.Sprite);
    const kpBars = Juice.letterbox(this, 50, 600, 985);
    Juice.vignette(this, 0x000000, 0.65, 984);
    await Juice.titleCard(this, "MEANWHILE, BACK IN KREDDLE…", "THE PRESIDENTIAL PALACE", `☢ ${clock(Math.max(9, Math.round(left * 0.5)))} TO DETONATION`, 1600);
    // a slow, creeping push-in for the whole crawl
    this.cameras.main.zoomTo(1.12, 9000, "Sine.easeInOut", true);
    // the trail
    const trail = this.add.graphics().setDepth(290);
    const smear = () => {
      trail.fillStyle(0x7f1d1d, 0.85).fillRect(-80, 344, kl.x + 10, 8);
      trail.fillStyle(0xb91c1c, 0.7).fillRect(-80, 346, kl.x + 6, 3);
    };
    synth.play("roar");
    crawling(true);
    for (let i = 0; i < 4; i++) {
      await this.tween({ targets: kl, x: kl.x + 70, duration: 520, ease: "Quad.out", onUpdate: smear });
      this.tweens.add({ targets: kl, scaleY: kl.scaleY * 0.9, yoyo: true, duration: 150 });
      if (G.meta.settings.gore !== false && i % 2) vfx(this, "vfx_blood", kl.x, 342, { scale: 1, depth: 295 });
      await this.wait(260);
    }
    crawling(false);
    await this.talk(KP_KLERBLE.slice(0, 3));
    crawling(true);
    for (let i = 0; i < 5; i++) {
      await this.tween({ targets: kl, x: kl.x + 68, duration: 560, ease: "Quad.out", onUpdate: smear });
      await this.wait(i === 4 ? 0 : 300);
    }
    // up the cable
    await this.tween({ targets: kl, x: 720, angle: -35, y: 340, duration: 800, ease: "Sine.out", onUpdate: smear });
    crawling(false);
    await this.talk(KP_KLERBLE.slice(3));
    // the screen
    const scr = this.add.container(480, 175).setDepth(700).setScale(0.2).setAlpha(0);
    scr.add(this.add.rectangle(0, 0, 520, 270, 0x050505).setStrokeStyle(6, 0x334155));
    scr.add(this.add.text(0, -105, "KREDDLE PRESIDENTIAL SYSTEMS v6.66", { fontFamily: "Courier New, monospace", fontSize: "14px", color: "#ef4444" }).setOrigin(0.5));
    scr.add(this.add.rectangle(0, -6, 140, 104, 0x7f1d1d).setStrokeStyle(3, 0xef4444));
    scr.add(this.add.rectangle(-44, -60, 52, 14, 0x7f1d1d).setStrokeStyle(3, 0xef4444));
    scr.add(this.add.text(0, -6, "KRUNCH", { fontFamily: "Impact, sans-serif", fontSize: "28px", color: "#fecaca" }).setOrigin(0.5));
    const prompt = this.add.text(0, 92, "> INITIATE? Y/N _", { fontFamily: "Courier New, monospace", fontSize: "16px", color: "#22c55e" }).setOrigin(0.5);
    scr.add(prompt);
    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 400 });
    // his heart, on the screen: a green trace that beats once a second… until it doesn't
    const ecg = this.add.graphics();
    scr.add(ecg);
    const ecgLbl = this.add.text(-180, 46, "PRESIDENTIAL HEARTBEAT", { fontFamily: "Courier New, monospace", fontSize: "10px", color: "#22c55e" });
    scr.add(ecgLbl);
    const trace: number[] = new Array(72).fill(0);
    const spike = [-3, 0, 14, -26, 9, 0];
    let pulse = -1;
    let alive = true;
    const ecgEv = this.time.addEvent({ delay: 40, loop: true, callback: () => {
      if (!ecg.active) return ecgEv.remove();
      if (alive && pulse < 0 && this.time.now % 1000 < 45) pulse = 0;
      trace.shift();
      trace.push(pulse >= 0 ? spike[pulse] : 0);
      if (pulse >= 0) pulse = pulse + 1 >= spike.length ? -1 : pulse + 1;
      ecg.clear().lineStyle(2, alive ? 0x22c55e : 0xef4444, 1);
      ecg.beginPath();
      trace.forEach((v, i) => (i ? ecg.lineTo(-180 + i * 5, 68 + v) : ecg.moveTo(-180, 68 + v)));
      ecg.strokePath();
    } });
    await this.tween({ targets: scr, scale: 1, alpha: 1, duration: 500, ease: "Back.out" });
    synth.play("ding");
    await this.wait(900);
    // the last breath: the screen pulls away and we're in close on him, his heart giving out
    this.tween({ targets: scr, alpha: 0, scale: 0.8, y: 120, duration: 500 });
    const cam = this.cameras.main;
    // (framed so he sits above the dialogue box)
    cam.pan(kl.x - 30, kl.y - 8, 900, "Sine.easeInOut", true);
    cam.zoomTo(1.7, 900, "Sine.easeInOut", true);
    let beatN = 0;
    const beat = this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      Juice.heartbeat(Math.max(0.3, 0.9 - beatN * 0.12));
      beatN++;
    } });
    Juice.heartbeat();
    await this.talk(KP_LAST);
    beat.remove();
    // back out to the screen: one keystroke
    cam.pan(480, 270, 400, "Cubic.easeOut", true);
    cam.zoomTo(1, 400, "Cubic.easeOut", true);
    await this.tween({ targets: scr, alpha: 1, scale: 1, y: 175, duration: 400, ease: "Cubic.out" });
    prompt.setText("> Y").setColor("#ef4444");
    synth.play("select");
    Juice.punchZoom(this, 0.08, 400, 1);
    await this.wait(400);
    const armed = this.add.text(0, 120, "KRUNCH PROTOCOL: ARMED", { fontFamily: "Courier New, monospace", fontSize: "14px", color: "#ef4444" }).setOrigin(0.5);
    scr.add(armed);
    // what he's just done, spelled out: a dead man's switch
    const sw = this.add.text(0, -8, "DEAD MAN'S SWITCH\n\nIF THE PRESIDENT'S HEART STOPS,\nKREDDLE FIRES EVERYTHING\nAT KRELWORLD.", { fontFamily: "Courier New, monospace", fontSize: "15px", color: "#fecaca", fontStyle: "bold", align: "center", backgroundColor: "#1a0505", padding: { x: 14, y: 8 } }).setOrigin(0.5).setAlpha(0);
    scr.add(sw);
    this.tweens.add({ targets: sw, alpha: 1, duration: 300 });
    synth.play("alarm");
    await this.tween({ targets: kl, angle: 0, y: 352, duration: 600, ease: "Bounce.out" });
    // one last, very faint heartbeat. Then nothing.
    this.time.delayedCall(500, () => Juice.heartbeat(0.25));
    await this.wait(1500);
    alive = false;
    ecgLbl.setText("PRESIDENTIAL HEARTBEAT: NONE").setColor("#ef4444");
    armed.setText("NO HEARTBEAT: RETALIATION AUTHORISED");
    Juice.tone(988, 2400, 0.1, "sine");
    await this.wait(2200);
    kpBars(300);

    // (c) outside, the bomb on the palace steps: the last five seconds, cut against Krelford counting down
    const nukeShot = () => {
      this.clearStage();
      this.cast.clear();
      this.resetCam();
      if (!backdrop(this, "bg_kd_palace", { depth: -10 })) this.sky(0x1a0b3a, 0x5b1d73);
      this.rainOver("rain", 940);
      const nk = this.prop(this.textures.exists("kd_nuke") ? "kd_nuke" : "c6_nuke", 584, 478, 1.6, 300, 0x1f2937, 40, 50);
      const lamp = this.add.circle(nk.x + 12, nk.y - nk.displayHeight * 0.6, 6, 0xff0000).setDepth(302).setBlendMode(Phaser.BlendModes.ADD);
      const halo = this.add.circle(lamp.x, lamp.y, 30, 0xff0000, 0.35).setDepth(301).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: halo, scale: 2.4, alpha: 0, repeat: -1, duration: 500 });
      const big = this.add.text(480, 120, "", { fontFamily: "Impact, sans-serif", fontSize: "92px", color: "#ff3b3b", stroke: "#000", strokeThickness: 12 }).setOrigin(0.5);
      Juice.layer(this, 988).add(big);
      return { nk, lamp, big };
    };
    const tick = (shot: ReturnType<typeof nukeShot>, n: number) => {
      shot.big.setText(`0:0${n}`).setScale(1.25);
      this.tweens.add({ targets: shot.big, scale: 1, duration: 300, ease: "Quad.out" });
      shot.lamp.setScale(2.2);
      this.tweens.add({ targets: shot.lamp, scale: 1, duration: 300 });
      Juice.tone(1400, 130, 0.14);
      Juice.heartbeat(0.5);
    };
    let shot = nukeShot();
    synth.weatherSound(null);
    const cdBars = Juice.letterbox(this, 44, 200, 985);
    this.cameras.main.pan(shot.nk.x, shot.nk.y - 60, 2200, "Sine.easeIn", true);
    this.cameras.main.zoomTo(1.35, 2200, "Sine.easeIn", true);
    for (const n of [5, 4]) {
      tick(shot, n);
      await this.wait(1000);
    }
    // across the river, the lads have come out onto the Town Hall steps to watch it go. They're counting.
    this.clearStage();
    this.resetCam();
    const view = this.bridgeView();
    const watchers = this.watchers(view);
    this.cameras.main.zoomTo(1.08, 3200, "Sine.easeInOut", true);
    for (const [i, n] of [3, 2, 1].entries()) {
      Juice.tone(1400, 130, 0.08);
      watchers.forEach((sp, j) => {
        this.tweens.add({ targets: sp, y: sp.y - 8, yoyo: true, duration: 120, delay: j * 30 });
        if ((j + i) % 3 === 0 || (j === 4 && n === 2)) this.time.delayedCall(j * 40, () => this.bubble(sp, j === 4 && n === 2 ? "SEVEN!!" : ["THREE!!", "TWO!!", "ONE!!"][i], "#ffd23f", "#111", 14));
      });
      await this.wait(1000);
    }
    // 0:00
    this.resetCam();
    shot = nukeShot();
    shot.big.setText("0:00");
    this.cameras.main.pan(shot.nk.x, shot.nk.y - 60, 10, "Linear", true);
    this.cameras.main.zoomTo(1.4, 10, "Linear", true);
    Juice.tone(1400, 700, 0.16);
    await this.wait(650);
    shot.big.destroy();
    cdBars(10);
    this.cameras.main.pan(480, 270, 10, "Linear", true);
    // (from here on, the old upbeat themes stay gone: systems/moodMusic)
    G.s.flags.kreddle_nuked = true;
    // silence. then:
    const nukeBars = Juice.letterbox(this, 44, 300, 985);
    this.cameras.main.flash(900, 255, 255, 255);
    this.time.delayedCall(250, () => {
      shot.nk.destroy();
      shot.lamp.destroy();
    });
    synth.play("boom");
    Juice.subDrop(1, 3.2);
    this.time.delayedCall(80, () => synth.play("explode"));
    this.time.delayedCall(300, () => synth.play("roar"));
    this.time.delayedCall(450, () => synth.play("explode_2"));
    this.time.delayedCall(900, () => synth.play("thunder"));
    this.cameras.main.shake(5500, 0.04);
    // the punch: in hard on the flash, then a long slow pull back to take in the size of it
    this.cameras.main.setZoom(1.35);
    this.cameras.main.zoomTo(1, 4200, "Cubic.easeOut", true);
    // chunks of the palace thrown at the camera
    for (let i = 0; i < 16; i++) {
      this.time.delayedCall(150 + i * 70, () => {
        const a = Math.random() * Math.PI * 2;
        const ch = this.add.rectangle(480 + Math.cos(a) * 30, 300 + Math.sin(a) * 20, 8 + Math.random() * 10, 6 + Math.random() * 8, [0x292524, 0x44403c, 0xf97316, 0x1c1917][i % 4]).setDepth(450);
        this.tweens.add({ targets: ch, x: 480 + Math.cos(a) * (500 + Math.random() * 300), y: 300 + Math.sin(a) * (320 + Math.random() * 200), scale: 4 + Math.random() * 4, angle: 720, alpha: { from: 1, to: 0.9 }, duration: 700 + Math.random() * 400, ease: "Quad.in", onComplete: () => ch.destroy() });
      });
    }
    // a fireball swallows the palace, then the cloud climbs out of it
    const ball = this.add.circle(480, 300, 20, 0xffe08a, 1).setDepth(395).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ball, radius: 330, alpha: 0.15, duration: 2600, ease: "Cubic.out" });
    const core = this.add.circle(480, 300, 10, 0xffffff, 1).setDepth(396);
    this.tweens.add({ targets: core, radius: 140, alpha: 0, duration: 1600, ease: "Cubic.out" });
    vfx(this, "vfx_mushroom", 480, 440, { scale: 3.4, depth: 398, hold: true, alpha: 0.55, speed: 0.8 });
    const cloud = vfx(this, "vfx_mushroom", 480, 425, { scale: 2.6, depth: 400, hold: true });
    if (!cloud) {
      const stem = this.add.rectangle(480, 300, 60, 10, 0xf97316).setOrigin(0.5, 1).setDepth(400);
      const cap = this.add.ellipse(480, 280, 40, 30, 0xfbbf24).setDepth(401);
      this.tween({ targets: stem, height: 220, duration: 2000 });
      this.tween({ targets: cap, y: 80, scaleX: 7, scaleY: 4, duration: 2000 });
    }
    // the shockwave: rings and a wall of dust rolling out
    for (let i = 0; i < 4; i++) {
      const ring = this.add.ellipse(480, 300, 40, 14).setStrokeStyle(6 - i, 0xffffff, 0.9).setDepth(410).setFillStyle(0xffffff, 0);
      this.tweens.add({ targets: ring, scaleX: 32, scaleY: 18, alpha: 0, delay: i * 260, duration: 1800, ease: "Cubic.out", onComplete: () => ring.destroy() });
    }
    vfx(this, "vfx_shock", 480, 300, { scale: 9, depth: 405 });
    for (let i = 0; i < 10; i++) vfx(this, "vfx_dust", 480 + (i - 4.5) * 100, 330, { scale: 3, depth: 420, delay: 300 + Math.abs(i - 4.5) * 120 });
    for (let i = 0; i < 8; i++) this.time.delayedCall(i * 220, () => this.boomAt(100 + Math.random() * 760, 120 + Math.random() * 220, 1.4 + Math.random(), 380));
    const heat = this.add.rectangle(480, 270, 960, 540, 0xff7a00).setAlpha(0).setDepth(430).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: heat, alpha: 0.55, duration: 900 });
    // under the fireball the palace itself comes apart: it sinks, darkens and is gone, rubble left where it stood
    const palGone = backdrop(this, "bg_kd_ruins_flat", { depth: -9 });
    if (palGone) {
      palGone.setAlpha(0);
      this.tweens.add({ targets: palGone, alpha: 1, delay: 700, duration: 1100 });
    }
    await this.wait(1800);
    // it takes out all of Kreddle: everything goes white for a long, long moment
    const wall = this.add.rectangle(480, 270, 1400, 900, 0xfff7ed).setAlpha(0).setDepth(990);
    await this.tween({ targets: wall, alpha: 1, duration: 1400 });
    synth.play("boom");
    Juice.subDrop(0.8, 2.5);
    // and then your ears ring for a while
    Juice.earRing(4000, 0.08);
    nukeBars(10);
    this.cameras.main.setZoom(1);
    await this.wait(1800);

    // (d) the same moment, from Krelford: the light on the horizon, the cloud climbing, and the blast reaching town
    await this.blastFromKrelford();

    // (e) the ruins
    this.clearStage();
    this.cast.clear();
    if (!backdrop(this, "bg_kd_ruins_flat", { depth: -10 }) && !backdrop(this, "bg_kd_ruins", { depth: -10 })) this.sky(0x450a0a, 0x1c1917);
    const blood = this.add.rectangle(480, 270, 960, 540, 0x991b1b, 0.22).setDepth(-8).setBlendMode(Phaser.BlendModes.MULTIPLY);
    void blood;
    for (const [x, sz] of [[90, 50], [260, 34], [640, 46], [880, 60], [420, 28]] as [number, number][]) this.fireBlob(x, 330, sz, 60);
    const heaps: [string, number, number, number][] = [["c6_burnheap", 140, 350, 2.2], ["c6_ashpile", 330, 352, 1.8], ["c6_skeleton", 560, 352, 1.4], ["c6_burnheap", 760, 352, 2.0], ["c6_ashpile", 900, 350, 1.6]];
    for (const [k, x, y, s] of heaps) this.prop(k, x, y, s, 80, 0x292524, 60, 30);
    // debris and ash keep coming down
    const rain2 = this.time.addEvent({ delay: 60, loop: true, callback: () => {
      const ash = Math.random() < 0.7;
      const d = ash ? this.add.circle(Math.random() * 1000, -10, 1.5 + Math.random() * 2, 0xd6d3d1, 0.8) : this.add.rectangle(Math.random() * 1000, -10, 4 + Math.random() * 8, 3 + Math.random() * 6, Math.random() < 0.3 ? 0xf97316 : 0x44403c);
      d.setDepth(950);
      this.tweens.add({ targets: d, y: 340 + Math.random() * 20, x: d.x - 40 - Math.random() * 80, angle: ash ? 0 : 360, duration: ash ? 3000 + Math.random() * 2000 : 1100 + Math.random() * 600, onComplete: () => d.destroy() });
    } });
    const fade = this.add.rectangle(480, 270, 960, 540, 0x000000, 1).setDepth(990);
    synth.music("c6e_aftermath");
    this.cameras.main.setZoom(1.12);
    this.cameras.main.zoomTo(1, 9000, "Sine.easeOut", true);
    await this.tween({ targets: fade, alpha: 0, duration: 2200 });
    fade.destroy();
    await Juice.titleCard(this, "WHAT'S LEFT OF IT", "KREDDLE — GROUND ZERO", "", 1800);
    await this.talk(KP_RUINS);

    // (f) the Krunch Protocol: the silos come up out of the rubble
    synth.play("alarm");
    const pads: [string, number, number][] = [["c6_launcher", 110, 336], ["c6_launcher4", 290, 352], ["c6_launcher", 480, 336], ["c6_launcher4", 670, 352], ["c6_launcher", 860, 336]];
    const launchers = pads.map(([k, x, y], i) => {
      const hatch = this.add.rectangle(x, y, 120, 10, 0x0a0a0a).setDepth(89);
      void hatch;
      const l = this.prop(k, x, y + 90, 1.8, 90 + (y > 340 ? 2 : 0), 0x3f6212, 110, 60).setFlipX(true);
      this.tween({ targets: l, y, duration: 1600, delay: i * 350, ease: "Sine.out" });
      this.time.delayedCall(i * 350, () => vfx(this, "vfx_dust", x, y, { scale: 2, depth: 95 }));
      return l;
    });
    this.cameras.main.shake(2600, 0.006);
    await this.wait(1800);
    // the announcement: the protocol's own screen, so nobody can miss what's about to happen
    const ann = this.krunchScreen();
    await this.talk(KP_PROTOCOL);
    // T-minus
    for (const n of [3, 2, 1]) {
      ann.status.setText(`LAUNCH IN T-${n}`);
      Juice.tone(660, 160, 0.12);
      await this.wait(700);
    }
    ann.close();
    // launch: the Krunch Protocol's theme kicks in with the first missile
    synth.stopMusic();
    Juice.riser(800, 0.4);
    await this.wait(800);
    synth.music("c6e_krunch");
    this.caption("THE KRUNCH PROTOCOL", "#ef4444", 36);
    Juice.subDrop(0.9, 1.4);
    Juice.flash(this, 0xff3b3b, 400, Juice.calm() ? 0.15 : 0.4, 960);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.zoomTo(1, 6000, "Sine.easeOut", true);
    const fire = (x0: number, y0: number, depth: number, scale = 1.3) => {
      synth.play(Math.random() < 0.66 ? "rocket" : "lob");
      vfx(this, "vfx_boom", x0, y0 + 10, { scale: 0.8 * (scale / 1.3), depth: depth - 10 });
      const m = this.textures.exists("c6_missile") ? this.add.image(x0, y0, "c6_missile").setScale(scale).setDepth(depth) : this.add.rectangle(x0, y0, 30, 8, 0x9ca3af).setDepth(depth);
      // up, and over to the west: Krelworld
      const tx = -150 - Math.random() * 200;
      const ty = -100 + Math.random() * 120;
      const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2(x0 - 60, -260), new Phaser.Math.Vector2(tx, ty));
      const o = { t: 0 };
      this.tweens.add({ targets: o, t: 1, duration: 1500 + Math.random() * 500, ease: "Sine.in", onUpdate: () => {
        const p = path.getPoint(o.t);
        const ang = Phaser.Math.RadToDeg(Math.atan2(p.y - m.y, p.x - m.x));
        m.setPosition(p.x, p.y);
        m.setAngle(ang);
        if (Math.random() < 0.6) {
          const puff = this.add.circle(p.x, p.y, 4 + Math.random() * 4, 0xd6d3d1, 0.7).setDepth(depth - 5);
          this.tweens.add({ targets: puff, scale: 3, alpha: 0, duration: 900, onComplete: () => puff.destroy() });
        }
      }, onComplete: () => m.destroy() });
      this.cameras.main.shake(100, 0.006);
    };
    let fired = 0;
    const launch = this.time.addEvent({ delay: 170, repeat: 16, callback: () => {
      const l = launchers[fired % launchers.length];
      fired++;
      fire(l.x - 20, l.y - 60, 130);
    } });
    await this.wait(3000);
    launch.remove();
    // the wide: every silo in the crater going at once
    const wide = backdrop(this, "bg_c6e_launch", { depth: 140 });
    if (wide) {
      // (the drawn missiles fly east: flipped, they go west, at Krelworld)
      wide.setFlipX(true).setAlpha(0);
      this.tweens.add({ targets: wide, alpha: 1, duration: 250 });
      this.cameras.main.setZoom(1.2);
      this.cameras.main.zoomTo(1, 3800, "Sine.easeOut", true);
      Juice.subDrop(0.7, 1.2);
      const pads2 = [[150, 430], [330, 400], [520, 420], [700, 440], [860, 410]];
      let n2 = 0;
      const launch2 = this.time.addEvent({ delay: 200, repeat: 17, callback: () => {
        const [x, y] = pads2[n2++ % pads2.length];
        fire(x + (Math.random() - 0.5) * 40, y, 160, 1.6);
      } });
      await this.wait(3800);
      launch2.remove();
    } else await this.wait(2000);
    rain2.remove();
    this.dropCaption();

    // (g) and from Krelford: little lights coming up over the horizon. Nobody's looking.
    await this.incomingOverKrelford();
    await this.talk([dir("Somewhere over the Kreddle Bridge, a flurry of ballistic missiles is heading for Krelworld. In the Town Hall, the music is still going.")]);
  }

  /** Back to a plain camera between shots: stop any pan / zoom still running from the last one. */
  private resetCam() {
    const cam = this.cameras.main;
    cam.panEffect.reset();
    cam.zoomEffect.reset();
    cam.setZoom(1).setScroll(0, 0);
  }

  /** A soft round glow (radial gradient), tinted: a fireball's light, a glow on the horizon. */
  private glow(x: number, y: number, size: number, tint: number, alpha: number, depth: number) {
    const key = "c6e_glow";
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, 128, 128);
      if (c) {
        const ctx = c.getContext();
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.35, "rgba(255,255,255,0.55)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        c.refresh();
      }
    }
    return this.add.image(x, y, key).setDisplaySize(size, size).setTint(tint).setAlpha(alpha).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** The mushroom cloud seen from miles away: a glowing stem climbing out of the horizon and a cap rolling open on top. */
  private farCloud(x: number, y: number, ms = 3600) {
    const top = y - 170;
    // the stem: lit from inside at the bottom, smoke further up
    for (let i = 0; i < 14; i++) {
      const f = i / 13;
      const puff = this.add.circle(x + (Math.random() - 0.5) * 8, y - 6, 16 - f * 5, f < 0.5 ? 0xb4532a : 0x5b4a4a, 0.95).setDepth(-3);
      this.tweens.add({ targets: puff, y: y - 10 - f * (y - top - 20), duration: ms * (0.4 + f * 0.6), ease: "Cubic.out" });
    }
    // the cap: dark smoke rolling out, its underside lit orange
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = this.add.circle(x, y - 20, 10, i % 3 ? 0x6b5450 : 0x8a5a44, 1).setDepth(-2);
      this.tweens.add({ targets: r, x: x + Math.cos(a) * 46, y: top + Math.sin(a) * 18, radius: 26 + Math.random() * 8, duration: ms, ease: "Cubic.out" });
    }
    const under = this.glow(x, y - 20, 60, 0xff7a2a, 0.9, -1);
    this.tweens.add({ targets: under, y: top + 18, displayWidth: 170, displayHeight: 70, alpha: 0.6, duration: ms, ease: "Cubic.out" });
    const base = this.glow(x, y, 120, 0xffb070, 0.9, -1);
    this.tweens.add({ targets: base, alpha: 0.45, duration: ms * 1.5 });
  }

  /** Kreddle gone from the skyline: nothing standing, just a low, black, broken line of rubble on the shore, fires along it. */
  private kreddleGone(view: { hx: number; hy: number }, depth = -6, fires = true) {
    const g = this.add.graphics().setDepth(depth);
    const shore = KD_SKY.shore;
    g.fillStyle(0x0b0812, 1);
    g.beginPath();
    g.moveTo(KD_SKY.left, shore + 4);
    let x = KD_SKY.left;
    while (x < 960) {
      // heaps; now and then a stump of a wall or a bent girder
      g.lineTo(x, shore - (Math.random() < 0.1 ? 14 + Math.random() * 10 : 3 + Math.random() * 9));
      x += 5 + Math.random() * 12;
    }
    g.lineTo(960, shore + 4);
    g.closePath();
    g.fillPath();
    const out: Phaser.GameObjects.GameObject[] = [g];
    if (!fires) return out;
    for (let i = 0; i < 10; i++) {
      const fx = KD_SKY.left + 20 + i * 46 + Math.random() * 20;
      out.push(this.glow(fx, shore - 6 - Math.random() * 6, 26 + Math.random() * 36, 0xff6a1a, 0.7, depth + 1));
    }
    out.push(this.glow(view.hx, view.hy + 6, 260, 0xff5a10, 0.45, depth + 1));
    return out;
  }

  /**
   * Kreddle's skyline coming down, building by building, from the palace outwards: the shockwave runs along the shore,
   * each building lights up, shears, leans away from the blast and breaks up as it falls (debris, dust, then fire),
   * the Golden Klaw's sign tumbles off its tower, and there's nothing left standing but rubble, smoke and the glow.
   * The buildings are the backdrop's own skyline, cut out of it (c6e_kreddle_cut over bg_c6e_bridge_gone).
   * Returns stop(): ends the smoke (call it before the stage is cleared).
   */
  private kreddleCollapse(view: { hx: number; hy: number }) {
    const calm = Juice.calm();
    const tex = "c6e_kreddle_cut";
    const S = KD_SKY;
    const shore = S.shore;
    // the rubble's already there behind the city: it shows as each building goes
    this.kreddleGone(view, -7, false);
    if (!this.textures.exists(tex)) return { stop: () => undefined };
    const T = this.textures.get(tex);
    // nothing shows below the waterline (the buildings sink into their own dust)
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillRect(-400, -600, 1800, shore + 600);
    const layer = this.add.container(0, 0).setDepth(-6);
    layer.setMask(maskG.createGeometryMask());
    const dark = (k: number) => Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffb070), Phaser.Display.Color.ValueToColor(0x140806), 100, Math.round(k * 100));
    const burn = (img: Phaser.GameObjects.Image, ms: number) =>
      this.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: (tw) => {
        if (!img.active) return;
        const c = dark(tw.getValue() ?? 1);
        img.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      } });
    // the front: when the blast reaches a point on the shore (ms after the flash)
    // soft smoke (the glow's gradient, drawn normally rather than added)
    const puff = (x: number, y: number, size: number, tint: number, alpha: number) => this.glow(x, y, size, tint, alpha, -5).setBlendMode(Phaser.BlendModes.NORMAL);
    const T0 = 450;
    const PER_PX = 6.5;
    const hitAt = (x: number) => T0 + Math.abs(x - view.hx) * PER_PX;
    // the shockwave running along the shore both ways, a wall of dust behind it
    const reach = Math.max(view.hx - S.left, 960 - view.hx) + 20;
    this.time.delayedCall(T0, () => {
      const ring = this.add.ellipse(view.hx, shore - 8, 20, 12).setStrokeStyle(3, 0xfff1d6, calm ? 0.5 : 0.9).setFillStyle(0xffd8a8, calm ? 0.08 : 0.18).setDepth(-4);
      this.tweens.add({ targets: ring, scaleX: (reach * 2) / 20, scaleY: 4, alpha: 0, duration: reach * PER_PX, ease: "Linear", onComplete: () => ring.destroy() });
    });
    for (let d = 0; d <= reach; d += 26)
      for (const side of [-1, 1]) {
        const x = view.hx + side * d;
        if (x < S.left - 10 || x > 970 || (d === 0 && side > 0)) continue;
        vfx(this, "vfx_dust", x, shore - 4, { scale: 1.1 + Math.random() * 0.5, depth: -5, alpha: 0.8, delay: hitAt(x) + 60 });
      }
    // one building: its pieces (top to bottom), cut from the skyline
    const bld = KD_BUILDINGS.map(([c0, c1, top], i) => {
      const w = c1 - c0;
      const rows = S.hz - top;
      const n = rows >= 30 ? 3 : rows >= 13 ? 2 : 1;
      const cuts = [top];
      for (let j = 1; j < n; j++) cuts.push(Math.round(top + (rows * j) / n + (Math.random() - 0.5) * 4));
      cuts.push(S.hz);
      const x = S.k * (S.x0 + c0 + w / 2);
      const frags = cuts.slice(0, -1).map((a, j) => {
        const b = cuts[j + 1];
        const name = `kd_${i}_${j}_${a}`;
        if (!T.has(name)) T.add(name, 0, c0, a - S.y0, w, b - a);
        const img = this.add.image(x, S.k * b - 2, tex, name).setOrigin(0.5, 1).setScale(S.k);
        layer.add(img);
        return img;
      });
      return { x, w, frags };
    });
    // the Golden Klaw's sign, up on its tower right of the palace
    const sb = KD_BUILDINGS[KD_SIGN_ON];
    const sign = this.add.container(S.k * (S.x0 + (sb[0] + sb[1]) / 2), S.k * sb[2] - 2);
    const signGlow = this.add.ellipse(0, -15, 70, 26, 0xff4fd8, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    const signBoard = this.add.rectangle(0, -15, 50, 15, 0x12001f).setStrokeStyle(2, 0xff4fd8);
    const signText = this.add.text(0, -15, "CASINO", { fontFamily: "Impact, sans-serif", fontSize: "11px", color: "#facc15" }).setOrigin(0.5);
    sign.add([this.add.rectangle(0, -4, 3, 8, 0x3f3f46), signGlow, signBoard, signText]);
    layer.add(sign);
    // each building, as the front reaches it
    bld.forEach(({ x, w, frags }) => {
      const at = hitAt(x) + Math.random() * 90;
      const dir = Math.sign(x - view.hx) || (Math.random() < 0.5 ? -1 : 1);
      this.time.delayedCall(at, () => {
        if (!frags[0]?.active) return;
        // lit up by the blast (a slow warm glow with calm flashes on; a hard white hit otherwise)
        frags.forEach((f) => (calm ? f.setTint(0xffd0a0) : f.setTintFill(0xfff4e0)));
        this.time.delayedCall(calm ? 260 : 90, () => frags.forEach((f) => f.active && (f.clearTint(), burn(f, 1400))));
        // top to bottom: the top shears off and goes furthest; the base just drops into its own dust
        frags.forEach((f, fromTop) => {
          const last = fromTop === frags.length - 1;
          const lean = dir * (last ? 4 + Math.random() * 8 : 14 + Math.random() * 10);
          const fall = last ? 0 : dir * (50 + Math.random() * 80) * (frags.length - fromTop) * 0.5;
          const drop = shore - f.y + f.displayHeight + 8;
          // a lurch away from the blast, then down
          this.tweens.add({ targets: f, angle: lean, x: f.x + dir * (last ? 2 : 6), duration: 260 + fromTop * 60, ease: "Sine.out" });
          this.tweens.add({ targets: f, angle: lean + fall, x: f.x + dir * (last ? 3 : 14 + Math.random() * 30 + (frags.length - fromTop) * 8), y: f.y + drop, delay: 220 + fromTop * 140 + Math.random() * 120, duration: (last ? 1500 : 1000) + Math.random() * 500, ease: last ? "Cubic.in" : "Quad.in" });
        });
        // it breaks up: chunks and neon thrown out and up
        const nDeb = 4 + Math.round(w / 2);
        const topY = frags[0].y - frags[0].displayHeight;
        for (let k = 0; k < nDeb; k++) {
          const d = this.add.rectangle(x + (Math.random() - 0.5) * w * 2, topY + Math.random() * (shore - topY), 2 + Math.random() * 4, 2 + Math.random() * 4, [0x1c1917, 0x44403c, 0x292524, 0x0c0a09, 0xf97316, 0x1c1917, 0x44403c, 0xff4fd8, 0x292524, 0x22d3ee][k % 10]);
          layer.add(d);
          const vx = dir * (30 + Math.random() * 120) * (Math.random() < 0.2 ? -0.5 : 1);
          const vy = -(40 + Math.random() * 140);
          const x0 = d.x;
          const y0 = d.y;
          const dur = 1400 + Math.random() * 600;
          this.tweens.add({ targets: d, x: x0 + (vx * dur) / 1000, angle: 360 * dir, duration: dur, onUpdate: (tw) => {
            const t = (tw.progress * dur) / 1000;
            d.y = y0 + vy * t + 210 * t * t;
          }, onComplete: () => d.destroy() });
        }
        // dust and smoke where it stood, then fire in what's left
        vfx(this, "vfx_dust", x, shore - 4, { scale: 0.8 + w / 12, depth: -5, alpha: 0.9, delay: 320 });
        for (let k = 0; k < 3; k++) {
          const p = puff(x + (Math.random() - 0.5) * w * 2, shore - 6, 26 + w * 2, 0x57534e, 0.7);
          this.tweens.add({ targets: p, y: p.y - 40 - Math.random() * 50, scale: p.scale * 2.2, alpha: 0, delay: 300 + k * 160, duration: 1800 + Math.random() * 600, ease: "Sine.out", onComplete: () => p.destroy() });
        }
        this.time.delayedCall(700, () => {
          const f = this.glow(x, shore - 7, 22 + w * 3, 0xff6a1a, 0.75, -5);
          this.tweens.add({ targets: f, alpha: 0.45, yoyo: true, repeat: -1, duration: 1100 + Math.random() * 700, ease: "Sine.inOut" });
        });
        if (Math.random() < 0.35) synth.play(Math.random() < 0.5 ? "smash" : "boom", 0.18);
      });
    });
    // the sign: its lights die, it comes off the tower and tumbles end over end into the rubble
    const sAt = hitAt(sign.x) + 60;
    const sDir = Math.sign(sign.x - view.hx) || 1;
    this.time.delayedCall(sAt, () => {
      if (!sign.active) return;
      signText.setColor("#57534e");
      signBoard.setStrokeStyle(2, 0x44403c);
      this.tweens.add({ targets: signGlow, alpha: 0, duration: calm ? 600 : 200 });
      vfx(this, "vfx_sparks", sign.x, sign.y - 15, { scale: 0.8, depth: -4 });
      const x0 = sign.x;
      const y0 = sign.y;
      const dur = 1700;
      this.tweens.add({ targets: sign, x: x0 + sDir * 90, angle: sDir * 300, duration: dur, ease: "Sine.out", onUpdate: (tw) => {
        const t = (tw.progress * dur) / 1000;
        sign.y = y0 - 60 * t + 70 * t * t;
      } });
    });
    // smoke over the ruins for the rest of the shot
    const smoke = this.time.addEvent({ delay: 160, repeat: 70, startAt: 0, callback: () => {
      const sx = S.left + Math.random() * (960 - S.left);
      const p = puff(sx, shore - 4, 34 + Math.random() * 30, Math.random() < 0.5 ? 0x44403c : 0x292524, 0.6);
      this.tweens.add({ targets: p, y: p.y - 70 - Math.random() * 60, x: p.x - 20 - Math.random() * 30, scale: p.scale * 2.6, alpha: 0, duration: 3200 + Math.random() * 1200, ease: "Sine.out", onComplete: () => p.destroy() });
    } });
    return { stop: () => smoke.remove() };
  }

  /** The view from Krelford across the river to Kreddle (where the palace sits on the horizon: hx, hy). `gone`: with Kreddle erased from it. */
  private bridgeView(gone = false) {
    if (!(gone && backdrop(this, "bg_c6e_bridge_gone", { depth: -10 })) && !backdrop(this, "bg_c6e_bridge_view", { depth: -10 })) {
      this.sky(0x0f0b24, 0x2a1645);
      this.add.rectangle(480, 300, 960, 50, 0x05030c).setDepth(-9);
      for (let i = 0; i < 40; i++) this.add.rectangle(600 + Math.random() * 280, 250 + Math.random() * 20, 4, 6 + Math.random() * 30, [0xff4fd8, 0x22d3ee, 0xfacc15][i % 3]).setOrigin(0.5, 1).setDepth(-9);
      this.add.rectangle(480, 470, 960, 150, 0x1c1917).setDepth(-8);
    }
    this.rainOver("rain", 940);
    return { hx: 724, hy: 262 };
  }

  /** The lads on the square by the Town Hall, backs to us, looking west at Kreddle. */
  private watchers(view: { hx: number }) {
    const me = G.s.player;
    const ids = [...new Set([...LADS, "MIKEY"].filter((p) => p !== me))];
    ids.splice(Math.floor(ids.length / 2), 0, me);
    return ids.map((id, i) => {
      const x = 250 + i * (460 / Math.max(1, ids.length - 1));
      const y = 486 + (i % 2) * 20;
      const sp = this.actor(id, x, y, 2.3);
      this.faceTo(sp, view.hx);
      this.face(sp, "north");
      // lit from the front by the town, from behind by Kreddle
      sp.setTint(0x8a84a8);
      return sp;
    });
  }

  /** The nuke, seen from Krelford: the light on the horizon, the cloud, then (a few seconds later) the blast reaches town. */
  private async blastFromKrelford() {
    const calm = Juice.calm();
    this.clearStage();
    this.resetCam();
    const view = this.bridgeView(true);
    synth.weatherSound("rain");
    const lads = this.watchers(view);
    // the far-off light, still burning, and the sky lit orange from underneath
    const sky = this.add.rectangle(480, 150, 960, 300, 0xff7a00, 0).setDepth(-7).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: sky, fillAlpha: 0.22, duration: 2000 });
    // under the fireball the whole skyline comes down, building by building, until there's nothing standing
    const fall = this.kreddleCollapse(view);
    const fire = this.glow(view.hx, view.hy - 10, 520, 0xffd08a, 1, -4);
    const core = this.glow(view.hx, view.hy - 10, 220, 0xffffff, 1, -4);
    this.tweens.add({ targets: fire, displayWidth: 300, displayHeight: 300, alpha: 0.55, duration: 6000, ease: "Cubic.out" });
    this.tweens.add({ targets: core, displayWidth: 90, displayHeight: 90, alpha: 0.5, duration: 5000, ease: "Cubic.out" });
    this.farCloud(view.hx, view.hy);
    // the white from the palace shot, fading out over Krelford
    const white = this.add.rectangle(480, 270, 1400, 900, 0xfff7ed, calm ? 0.6 : 1).setDepth(990);
    this.tweens.add({ targets: white, alpha: 0, duration: 1600 });
    const bars = Juice.letterbox(this, 44, 10, 985);
    await this.wait(700);
    await Juice.titleCard(this, "THE SAME MOMENT, ACROSS THE RIVER", "KRELFORD", "☢ 0:00", 1500, 990, 120);
    // light travels faster than sound: they see it, then they wait for it
    lads.forEach((sp, i) => this.time.delayedCall(i * 120, () => this.bubble(sp, ["…", "OOOOOH", "…woah", "LOOK AT IT"][i % 4], "#ffffff", "#111", 12)));
    this.cameras.main.zoomTo(1.06, 2000, "Sine.easeInOut", true);
    await this.wait(1600);
    // the blast wave: a pale ring rolling out across the river towards us
    Juice.riser(1100, 0.35);
    const wave = this.add.ellipse(view.hx, view.hy + 10, 60, 8).setStrokeStyle(2, 0xfff7ed, 0.8).setFillStyle(0xfff7ed, 0).setDepth(-4);
    this.tweens.add({ targets: wave, scaleX: 30, scaleY: 40, alpha: 0, duration: 1200, ease: "Quad.in", onComplete: () => wave.destroy() });
    for (let i = 0; i < 7; i++) vfx(this, "vfx_dust", 80 + i * 140, 302, { scale: 1.5, depth: -3, alpha: 0.7, delay: 300 + Math.abs(view.hx - (80 + i * 140)) * 0.8 });
    await this.wait(1100);
    // it hits town
    synth.play("boom");
    synth.play("explode_2");
    synth.play("thunder");
    Juice.subDrop(1, 2.2);
    Juice.flash(this, 0xffe8c0, calm ? 900 : 500, calm ? 0.15 : 0.45, 980);
    this.cameras.main.shake(1600, 0.02);
    Juice.punchZoom(this, 0.06, 500, 1.06);
    lads.forEach((sp, i) => {
      sp.setData("busy", true);
      this.tweens.add({ targets: sp, y: sp.y + 10, x: sp.x + (i % 2 ? 6 : -6), yoyo: true, duration: 160, delay: i * 30 });
      this.time.delayedCall(i * 50, () => this.bubble(sp, ["WHOA!!", "MY HAIR!!", "AAAH", "BLIMEY"][i % 4], "#fecaca", "#7f1d1d", 12));
    });
    // every window in Krelford rattles (and a few go)
    for (let i = 0; i < 8; i++) this.time.delayedCall(i * 90, () => synth.play("smash", 0.4));
    await this.wait(1700);
    // then: every window cheers
    lads.forEach((sp) => sp.setData("busy", false));
    synth.play("cheer");
    this.time.delayedCall(500, () => synth.play("cheer"));
    const stop = this.perform(lads, "victory", 10);
    lads.forEach((sp, i) => this.time.delayedCall(i * 110, () => this.bubble(sp, ["WE DID IT!!", "KREDDLE'S GONE!!", "YEEE YEE!!", "FOR POLSON!!", "FOR MOLLOR!!"][i % 5], "#ffd23f", "#111", 13)));
    for (let i = 0; i < 4; i++) vfx(this, "vfx_confetti", 300 + i * 120, 330, { scale: 1.8, depth: 600, delay: i * 200 });
    await this.wait(1600);
    await this.talk([
      dir("Across the river, the light where Kreddle used to be is slowly going out. The cloud keeps climbing."),
      dir("Every window in Krelford rattles. Then every window cheers. Somebody rings SanMik and SanChz. The victory party is ON."),
    ]);
    stop();
    bars(300);
    // to black
    const black = this.add.rectangle(480, 270, 1400, 900, 0x000000, 0).setDepth(990);
    await this.tween({ targets: black, alpha: 1, duration: 900 });
    fall.stop();
  }

  /** The Krunch Protocol's own screen: what it is, what it's doing and where it's aiming. close() takes it away. */
  private krunchScreen() {
    const L = Juice.layer(this, 970);
    const c = this.add.container(0, 0);
    L.add(c);
    const bgImg = this.textures.exists("bg_c6e_krunch_screen") ? this.add.image(480, 270, "bg_c6e_krunch_screen").setDisplaySize(960, 544) : this.add.rectangle(480, 270, 960, 540, 0x1a0505);
    c.add(bgImg);
    c.add(this.add.rectangle(480, 270, 960, 540, 0x000000, 0.35));
    // scanlines
    const scan = this.add.graphics();
    for (let y = 0; y < 540; y += 4) scan.fillStyle(0x000000, 0.18).fillRect(0, y, 960, 2);
    c.add(scan);
    const art = this.textures.exists("bg_c6e_krunch_screen");
    const panel = this.add.rectangle(480, 262, 600, 170, 0x050505, 0.82).setStrokeStyle(3, 0xef4444);
    c.add(panel);
    // (the drawn screen has a black slot at the top for the heading)
    const head = this.add.text(480, art ? 113 : 120, "KRUNCH PROTOCOL", { fontFamily: "Impact, sans-serif", fontSize: art ? "38px" : "48px", color: "#ef4444", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5);
    c.add(head);
    this.tweens.add({ targets: head, alpha: 0.35, yoyo: true, repeat: -1, duration: Juice.calm() ? 900 : 280 });
    const rows = ["PRESIDENTIAL HEARTBEAT ..... NONE", "RETALIATION ............... AUTHORISED", "WARHEADS .................. ALL OF THEM", "TARGET ..................... KRELWORLD"];
    rows.forEach((r, i) => {
      const t = this.add.text(214, 190 + i * 26, r, { fontFamily: "Courier New, monospace", fontSize: "18px", color: i === 3 ? "#fca5a5" : "#fecaca", fontStyle: "bold" }).setAlpha(0);
      c.add(t);
      this.tweens.add({ targets: t, alpha: 1, delay: 300 + i * 380, duration: 60 });
      this.time.delayedCall(300 + i * 380, () => Juice.tone(1200, 50, 0.06));
    });
    const status = this.add.text(480, 322, "ARMING…", { fontFamily: "Courier New, monospace", fontSize: "22px", color: "#22c55e", fontStyle: "bold" }).setOrigin(0.5);
    c.add(status);
    // siren
    let hi = false;
    const siren = this.time.addEvent({ delay: 450, loop: true, callback: () => {
      hi = !hi;
      Juice.tone(hi ? 760 : 560, 420, 0.05, "sawtooth");
    } });
    c.setAlpha(0).setScale(1.06);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 300, ease: "Cubic.out" });
    synth.play("decree");
    return {
      status,
      close: () => {
        siren.remove();
        this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
      },
    };
  }

  /** From Krelford again: the lights coming up over Kreddle's horizon and arcing over the river towards town. */
  private async incomingOverKrelford() {
    this.clearStage();
    this.resetCam();
    const view = this.bridgeView(true);
    // what's left of the cloud, and the glow where Kreddle was
    this.kreddleGone(view);
    this.farCloud(view.hx, view.hy, 60);
    const bars = Juice.letterbox(this, 44, 300, 985);
    const fade = this.add.rectangle(480, 270, 960, 540, 0x000000, 1).setDepth(990);
    this.tweens.add({ targets: fade, alpha: 0, duration: 700 });
    // faint, from the left: the Town Hall's bass
    const thump = this.time.addEvent({ delay: 480, loop: true, callback: () => Juice.heartbeat(0.18) });
    const lights = this.time.addEvent({ delay: 140, repeat: 34, callback: () => {
      const x0 = view.hx - 120 + Math.random() * 240;
      const y0 = view.hy - 4;
      const dot = this.add.circle(x0, y0, 2.5, 0xffd8a8, 1).setDepth(-3).setBlendMode(Phaser.BlendModes.ADD);
      const tx = 60 + Math.random() * 700;
      const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2((x0 + tx) / 2, -120 - Math.random() * 120), new Phaser.Math.Vector2(tx, 620));
      const o = { t: 0 };
      this.tweens.add({ targets: o, t: 1, duration: 3200 + Math.random() * 900, ease: "Sine.in", onUpdate: () => {
        const p = path.getPoint(o.t);
        dot.setPosition(p.x, p.y).setRadius(2.5 + o.t * 9);
        if (Math.random() < 0.5) {
          const tr = this.add.circle(p.x, p.y, 1.5 + o.t * 5, 0xd6d3d1, 0.5).setDepth(-4);
          this.tweens.add({ targets: tr, alpha: 0, scale: 2, duration: 900, onComplete: () => tr.destroy() });
        }
      }, onComplete: () => dot.destroy() });
    } });
    this.cameras.main.zoomTo(1.1, 6000, "Sine.easeIn", true);
    await this.wait(900);
    await Juice.titleCard(this, "MEANWHILE, BACK IN KRELFORD…", "INCOMING", "⚠ KRUNCH PROTOCOL: 36 MISSILES INBOUND", 2200, 990, 140);
    await this.wait(1600);
    lights.remove();
    thump.remove();
    bars(400);
  }

  // ---------------------------------------------------------------- townhall_party: WE DID IT

  private async townhallParty() {
    await ensureCh6Art(this);
    G.rt.timerEnd = 0;
    G.emit("timer", null);
    const bg = backdrop(this, "bg_townhall", { dim: 0.45, depth: -10 }) ?? this.sky(0x1a0f1f, 0x3a1a3a);
    // disco: sweeping coloured lights
    const lights = [0xff4fd8, 0x22d3ee, 0xfacc15, 0x7cff3a, 0xa855f7].map((c, i) => {
      const b = this.add.triangle(480, 40, 0, 0, -70, 420, 70, 420, c, 0.14).setOrigin(0, 0).setDepth(-5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: b, angle: { from: -40, to: 40 }, yoyo: true, repeat: -1, duration: 1300 + i * 270, delay: i * 200, ease: "Sine.inOut" });
      return b;
    });
    const spots = this.time.addEvent({ delay: 200, loop: true, callback: () => {
      const s = this.add.circle(Math.random() * 960, 120 + Math.random() * 220, 6, [0xff4fd8, 0x22d3ee, 0xfacc15][Math.floor(Math.random() * 3)], 0.6).setDepth(-4).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: s, alpha: 0, duration: 600, onComplete: () => s.destroy() });
    } });
    const ball = this.prop("c6_discoball", 480, 90, 1.2, 50, 0xe5e7eb, 40, 40);
    this.tweens.add({ targets: ball, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 900 });
    // the stage
    const stage = this.add.rectangle(480, 250, 360, 16, 0x3f1d4f).setStrokeStyle(2, 0xff4fd8).setDepth(10);
    const { mik, chz } = this.sanmikSprites(420, 540, 210);
    mik.setScale(2.6).setDepth(20);
    chz.setScale(2.6).setDepth(20);
    this.cast.set("SANMIK", mik);
    this.cast.set("SANCHZ", chz);
    const d1 = this.add.sprite(300, 222, this.textures.exists("spr_TV_DANCER1") ? "spr_TV_DANCER1" : "spr_FOLK1", 0).setScale(2.4).setDepth(20);
    const d2 = this.add.sprite(660, 222, this.textures.exists("spr_TV_DANCER2") ? "spr_TV_DANCER2" : "spr_FOLK2", 0).setScale(2.4).setDepth(20);
    const pole = (x: number) => this.add.rectangle(x, 160, 4, 170, 0xd1d5db).setDepth(19);
    pole(300);
    pole(660);
    let lads = this.partyCast(300);
    // playing as Mikey, you're the act up there (SanMik): not also down on the dance floor
    if (G.s.player === "MIKEY") {
      const meOnFloor = this.cast.get("MIKEY");
      lads = lads.filter((sp) => sp !== meOnFloor);
      meOnFloor?.destroy();
      this.cast.set("MIKEY", mik);
    }
    synth.musicRaw("sanmik");
    const s1 = this.perform([mik, chz], "sing", 9);
    const s2 = this.perform([d1, d2], "dance", 10);
    await Juice.titleCard(this, "INSIDE THE TOWN HALL. RIGHT NOW.", "THE VICTORY PARTY", "", 1700);
    await this.talk(TP_OPEN);
    // everyone dances: the lads have no disco moves on their sheets, so a lot of bouncing and the victory pose
    const s3 = this.perform(lads, "victory", 8);
    const groove = lads.map((sp, i) => this.tweens.add({ targets: sp, y: sp.y - 10, x: sp.x + (i % 2 ? 8 : -8), yoyo: true, repeat: -1, duration: 260 + (i % 3) * 40, ease: "Sine.inOut" }));
    const yee = this.time.addEvent({ delay: 420, loop: true, callback: () => {
      const sp = lads[Math.floor(Math.random() * lads.length)];
      this.bubble(sp, ["YEEE YEE!", "WE DID IT!", "YEEE YEE!!", "WOOOO!", "WE DID IT!!"][Math.floor(Math.random() * 5)], ["#ff4fd8", "#22d3ee", "#facc15"][Math.floor(Math.random() * 3)], "#12001f", 12);
    } });
    // outside, Krelford is being bombed flat; in here it just sounds like a lot of bass
    let thudN = 0;
    const thuds = this.time.addEvent({ delay: 1900, loop: true, callback: () => {
      thudN++;
      synth.play("boom", 0.22);
      Juice.subDrop(0.35, 0.6);
      this.cameras.main.shake(260, 0.004);
      this.tweens.add({ targets: ball, angle: (thudN % 2 ? 1 : -1) * 14, yoyo: true, duration: 260 });
      for (let i = 0; i < 6; i++) {
        const d = this.add.circle(80 + Math.random() * 800, -4, 1.5 + Math.random() * 2, 0xa8a29e, 0.9).setDepth(560);
        this.tweens.add({ targets: d, y: 300 + Math.random() * 60, duration: 1200 + Math.random() * 600, ease: "Quad.in", onComplete: () => d.destroy() });
      }
      if (thudN % 2) {
        const sp = lads[Math.floor(Math.random() * lads.length)];
        if (sp) this.bubble(sp, ["NICE BASS!!", "TUNE!!", "FEEL THAT BASS!!", "WHAT A DROP!!"][thudN % 4], "#ffffff", "#111", 12);
      }
    } });
    for (let i = 0; i < 3; i++) vfx(this, "vfx_confetti", 200 + i * 280, 100, { scale: 2.2, depth: 600, delay: i * 300 });
    this.caption("YEEE YEE!!", "#ff4fd8", 40);
    await this.wait(2600);
    this.caption("WE DID IT!!", "#22d3ee", 40);
    await this.wait(1600);
    this.dropCaption();
    // (hopping during lines fights the groove: pause the groove while they talk)
    groove.forEach((t) => t.pause());
    await this.talk(TP_DANCE);
    groove.forEach((t) => t.resume());
    await this.wait(1800);
    // the whistle
    yee.remove();
    thuds.remove();
    synth.stopMusic();
    groove.forEach((t) => t.remove());
    s1();
    s2();
    s3();
    synth.play("whistle");
    lads.forEach((sp) => this.face(sp, "north"));
    // the room goes quiet; the camera creeps in on everyone looking up
    const bars = Juice.letterbox(this, 48, 700, 985);
    this.cameras.main.zoomTo(1.15, 3000, "Sine.easeInOut", true);
    await this.talk(TP_DOOM);
    const m = this.textures.exists("c6_missile") ? this.add.image(480, -80, "c6_missile").setScale(2).setAngle(90).setDepth(700) : this.add.rectangle(480, -80, 10, 40, 0x9ca3af).setDepth(700);
    synth.play("whistle");
    Juice.riser(700, 0.45);
    await this.tween({ targets: m, y: 140, duration: 700, ease: "Quad.in" });
    m.destroy();
    // BANG: a frozen white frame (everyone mid-scream as silhouettes), then the world comes back in slow motion
    const calm = Juice.calm();
    const white = this.add.rectangle(480, 270, 1300, 800, 0xffffff, calm ? 0.35 : 1).setDepth(995);
    synth.play("boom");
    synth.play("explode");
    Juice.subDrop(1, 3);
    this.time.delayedCall(120, () => synth.play("explode_2"));
    this.cameras.main.setZoom(1.4);
    everyoneSil(this, [...lads, mik, chz, d1, d2]);
    await Juice.realWait(160);
    white.setAlpha(calm ? 0.3 : 0.85);
    Juice.slowMo(this, 0.25, 900);
    this.cameras.main.zoomTo(1, 1400, "Cubic.easeOut", true);
    this.cameras.main.shake(3500, 0.05);
    // the floor tips as the building goes
    this.tweens.add({ targets: this.cameras.main, rotation: -0.035, duration: 2600, ease: "Quad.in" });
    this.tween({ targets: white, alpha: 0, duration: 900 });
    Juice.earRing(5000, 0.07);
    spots.remove();
    lights.forEach((l) => l.destroy());
    this.boomAt(480, 140, 2.6, 700);
    this.boomAt(300, 100, 1.8, 700);
    this.boomAt(680, 110, 1.8, 700);
    // cracks across the ceiling, and it all comes down
    const cracks = this.add.graphics().setDepth(5);
    cracks.lineStyle(3, 0x111111, 1);
    for (let i = 0; i < 9; i++) {
      let x = 60 + i * 105;
      let y = 0;
      cracks.beginPath();
      cracks.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (Math.random() - 0.5) * 50;
        y += 20 + Math.random() * 25;
        cracks.lineTo(x, y);
      }
      cracks.strokePath();
    }
    if (bg instanceof Phaser.GameObjects.Image) bg.setTint(0x9a8a7a);
    this.tween({ targets: ball, y: 340, angle: 200, duration: 700, ease: "Quad.in" }).then(() => {
      synth.play("smash");
      vfx(this, "vfx_sparks", ball.x, 330, { scale: 2, depth: 600 });
      ball.destroy();
    });
    this.tween({ targets: stage, angle: 8, y: 270, duration: 500 });
    const screams = ["AAAAAAH", "NOOOO", "MY LEGS", "THEY HAD THE BALLS", "MOLLOR!!", "I FORESAW TH—", "TURN THE POWER OFF", "YEEE—"];
    const everyone = [...lads, mik, chz, d1, d2];
    everyone.forEach((sp, i) => {
      this.time.delayedCall(i * 60, () => this.bubble(sp, screams[i % screams.length], "#fecaca", "#7f1d1d", 12));
      sp.setData("busy", true);
      this.tweens.add({ targets: sp, x: sp.x + (Math.random() - 0.5) * 80, duration: 500 });
    });
    synth.play("gasp");
    this.time.delayedCall(300, () => synth.play("hurt_1"));
    this.time.delayedCall(700, () => synth.play("hurt_2"));
    // rubble rain
    const falling = this.time.addEvent({ delay: 90, repeat: 45, callback: () => {
      const x = 40 + Math.random() * 880;
      const big = Math.random() < 0.35;
      const key = big ? "c6_ceiling" : "p_rubble";
      const r = this.textures.exists(key) ? this.add.image(x, -60, key).setScale(big ? 1.6 + Math.random() : 0.6 + Math.random() * 0.6).setDepth(500) : this.add.rectangle(x, -60, 30 + Math.random() * 40, 16 + Math.random() * 20, 0x78716c).setStrokeStyle(2, 0x292524).setDepth(500);
      const ty = 300 + Math.random() * 60;
      this.tweens.add({ targets: r, y: ty, angle: (Math.random() - 0.5) * 120, duration: 500 + Math.random() * 300, ease: "Quad.in", onComplete: () => {
        vfx(this, "vfx_dust", r.x, ty, { scale: 1.4, depth: 501 });
        if (Math.random() < 0.3) synth.play("smash");
        r.setDepth(100 + ty + 40);
      } });
    } });
    // everyone goes down under it
    everyone.forEach((sp, i) => this.keel(sp, 500 + i * 160));
    for (let i = 0; i < 4; i++) this.time.delayedCall(800 + i * 500, () => this.fireBlob(150 + i * 220, 320, 40, 450));
    await this.wait(2200);
    synth.play("boom");
    this.cameras.main.shake(1500, 0.03);
    for (let i = 0; i < 6; i++) vfx(this, "vfx_blastsmoke", 80 + i * 160, 300, { scale: 2, depth: 560, delay: i * 120 });
    await this.wait(2200);
    falling.remove();
    // fade to black
    const black = this.add.rectangle(480, 270, 1400, 900, 0x000000).setAlpha(0).setDepth(980);
    await this.tween({ targets: black, alpha: 1, duration: 2200 });
    bars(10);
    this.cameras.main.setRotation(0);
    synth.weatherSound(null);
    await this.wait(1200);
    await this.talk(TP_END);
    await this.wait(600);
    await Juice.titleCard(this, "THE KRUNCH PROTOCOL: COMPLETE", "END OF CHAPTER SIX", "", 2200);
    await this.wait(400);
  }
}

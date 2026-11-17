import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../../systems/tv";
import { F, ShowDirector, type Perf, type Rect, type ShowHost } from "./ShowDirector";

/**
 * Shows built from a room full of people talking, shot three ways:
 *  - "parliament": the parliament channel. Fixed chamber cameras, the speaker at the dispatch box with a green
 *    name caption, the commentator over the wide; nothing moves that a committee didn't approve.
 *  - "sketch": a sketch show. A bright bumper, the sketch's title on a slab of colour, single-camera coverage
 *    (singles that face each other across the cut), a sting at the end.
 *  - "drama": a political drama in the fly-on-the-wall style. Hand-held, snap zooms on the outbursts, people
 *    talking over each other's shoulders, a stark white-on-black title.
 */
export type EnsembleGenre = "parliament" | "sketch" | "drama";

/** Name captions for the parliament channel. */
const MEMBERS: Record<string, string> = {
  DRONGUS: "The Supreme Leader (all ministries)",
  SCROMBUS: "Minister of Lore",
  KREZMAR: "Member for Defence (vacant)",
};

export class EnsembleDirector extends ShowDirector {
  private titles = 0;
  private bodies: Record<string, Phaser.GameObjects.Sprite> = {};
  private lines = 0;
  private ghost = new Set<string>();
  private kind = "";
  /** people who arrive later in the scene (by a blocking cue): not in the room yet */
  private pending = new Set<string>();
  private angle = 0;

  constructor(sc: Phaser.Scene, r: Rect, beats: TVBeat[], host: ShowHost, ep: TVEpisode, private genre: EnsembleGenre) {
    super(sc, r, beats, host, ep);
  }

  private sideOf(name: string) {
    const i = Math.max(0, this.cast.indexOf(name));
    return i % 2 ? 1 : -1;
  }

  // ------------------------------------------------------------------ titles

  protected onTitle(t: string): number {
    this.titles++;
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    if (this.genre === "parliament") {
      this.chamber(true);
      this.strap(t.replace(/^GB KREWS 24:\s*/i, ""), "LIVE FROM THE KRELFORD TOWN HALL");
      return 2400;
    }
    if (this.genre === "drama") {
      this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000).setOrigin(0));
      const [a, b] = t.split(/:\s*/);
      const tt = this.add(this.text(this.cx, this.cy - (b ? 16 : 0), a.split("").join(" "), 26, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5).setAlpha(0));
      this.sc.tweens.add({ targets: tt, alpha: 1, duration: 1200 });
      if (b) {
        const st = this.add(this.text(this.cx, this.cy + 24, b, 15, "#bbbbbb", { fontStyle: "italic" }).setOrigin(0.5).setAlpha(0));
        this.sc.tweens.add({ targets: st, alpha: 1, duration: 900, delay: 900 });
      }
      this.add(this.text(SX + SW - 14, SY + SH - 14, "BBK ONE", 11, "#777777").setOrigin(1, 1));
      return 3000;
    }
    // sketch show: the bumper, then the sketch's own title slab
    if (/KREZZ SKETCH SHOW/i.test(t)) {
      this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x10c0b0).setOrigin(0));
      const cols = [0xff4f8a, 0xffd23f, 0x7a5cff, 0x10c0b0];
      for (let i = 0; i < 4; i++) {
        const b = this.add(this.sc.add.rectangle(SX - SW, SY + i * (SH / 4), SW, SH / 4, cols[i]).setOrigin(0));
        this.sc.tweens.add({ targets: b, x: SX, duration: 260, delay: i * 90, ease: "Quad.out" });
      }
      const logo = this.add(this.text(this.cx, this.cy, "KREZZ\nSKETCH SHOW", 44, "#ffffff", { fontStyle: "bold", align: "center", stroke: "#1a1a1a", strokeThickness: 8 }).setOrigin(0.5).setScale(0).setAngle(-4));
      this.sc.tweens.add({ targets: logo, scale: 1, duration: 380, delay: 420, ease: "Back.out" });
      this.later(420, () => this.sfx("tv_sting"));
      return 2200;
    }
    const col = [0xff4f8a, 0x7a5cff, 0xffd23f, 0x10c0b0][this.hash(t) % 4];
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x111111).setOrigin(0));
    const slab = this.add(this.sc.add.rectangle(SX - SW, this.cy, SW, 90, col).setOrigin(0, 0.5));
    this.sc.tweens.add({ targets: slab, x: SX, duration: 300, ease: "Quad.out" });
    const tt = this.add(this.text(this.cx, this.cy, t, 30, "#ffffff", { fontStyle: "bold", stroke: "#111", strokeThickness: 6, align: "center", wordWrap: { width: SW - 60 } }).setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: tt, alpha: 1, duration: 300, delay: 250 });
    return 0;
  }

  /** The green caption bar of the parliament channel. */
  private strap(top: string, sub: string) {
    this.clearGfx();
    const { SX, SY, SW, SH } = this.r;
    const c = this.over(this.sc.add.container(SX + 16, SY + SH - 74));
    c.add(this.sc.add.rectangle(0, 0, SW - 32, 30, 0x0b5d3b).setOrigin(0));
    c.add(this.sc.add.rectangle(0, 30, SW - 32, 22, 0xf2f2f2).setOrigin(0));
    c.add(this.text(10, 15, top.toUpperCase(), 15, "#ffffff", { fontStyle: "bold" }).setOrigin(0, 0.5));
    c.add(this.text(10, 41, sub, 12, "#0b5d3b", { fontStyle: "bold" }).setOrigin(0, 0.5));
    const live = this.over(this.text(SX + SW - 18, SY + 14, "● LIVE", 13, "#ff3333", { fontStyle: "bold" }).setOrigin(1, 0));
    this.sc.tweens.add({ targets: live, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
    this.over(this.text(SX + 18, SY + 14, "KREL PARLIAMENT", 11, "#ffffffcc", { fontStyle: "bold" }));
  }

  /** The wide of the chamber from a fixed camera. */
  private chamber(fromHigh: boolean) {
    this.clear();
    this.kind = "wide";
    const img = this.backdrop(this.tex("tv_cab_chamber") ?? this.host.setTexture(), { zoom: fromHigh ? 1.0 : 1.35, oy: fromHigh ? 0 : 40 });
    // committee-approved camera move: a very slow pan
    this.sc.tweens.add({ targets: img, x: img.x + (fromHigh ? 12 : -18), duration: 8000, ease: "Sine.easeInOut" });
    // members on the benches
    const { SX, SY, SW, SH } = this.r;
    // members on the benches from the chest up when they all have close-up sheets (the art their singles use)
    const busts = this.cast.length > 0 && this.cast.every((n) => this.hasFace(n));
    this.cast.forEach((n, i) => {
      const x = SX + SW * (0.25 + 0.25 * i);
      const s = busts
        ? this.bust(n, x, SY + SH * (fromHigh ? 0.86 : 1.02), SH * (fromHigh ? 0.3 : 0.46))
        : this.body(n, x, SY + SH * (fromHigh ? 0.82 : 0.95), SH * (fromHigh ? 0.22 : 0.36));
      if (s) this.bodies[n] = s;
    });
  }

  // ------------------------------------------------------------------ shots

  protected onShot(_set: string, _framing: string, fresh: boolean): number {
    this.lines = 0;
    if (!fresh) return 0;
    this.pending.clear();
    // anyone whose first appearance in the scene is an entrance cue isn't in the room until then
    const seenHere = new Set<string>();
    for (let i = this.idx + 1; i < this.beats.length; i++) {
      const b = this.beats[i];
      if (b.type === "shot" && b.set !== this.set) break;
      if (b.type !== "blocking" && b.type !== "speaker") continue;
      const n = b.character.toUpperCase();
      if (seenHere.has(n)) continue;
      seenHere.add(n);
      if (b.type === "blocking" && b.to !== "offscreen") this.pending.add(n);
    }
    if (this.genre === "parliament") {
      this.chamber(true);
      return 0;
    }
    this.wide();
    return 900;
  }

  /** Everyone in the room, standing about. */
  private wide(push = true) {
    this.clear();
    this.kind = "wide";
    this.bodies = {};
    const { SX, SY, SW, SH } = this.r;
    this.backdrop(this.host.setTexture());
    const cast = this.cast.filter((n) => !this.pending.has(n)).slice(0, 6);
    const n = cast.length;
    // a group shot from the chest up when everyone has a close-up sheet (the same art as their singles), else the
    // room with everyone standing in it
    const busts = n > 0 && cast.every((nm) => this.hasFace(nm));
    cast.forEach((nm, i) => {
      const x = SX + SW / 2 + (i - (n - 1) / 2) * Math.min(busts ? 150 : 120, (SW - (busts ? 140 : 120)) / Math.max(1, n - 1));
      const s = busts
        ? this.bust(nm, x, SY + SH + 6 + (i % 2) * 14, SH * (n <= 2 ? 0.62 : n <= 4 ? 0.54 : 0.48))
        : this.body(nm, x, SY + SH * 0.94 - (i % 2) * 10, SH * 0.42);
      if (!s) return;
      if (!busts) s.setFlipX(x > this.cx);
      if (this.ghost.has(nm)) this.ghostly(s);
      this.breathe(s, 1400 + i * 190);
      this.bodies[nm] = s;
    });
    if (push) this.push(1.06, 5000, this.cx, SY + SH * 0.65);
    if (this.genre === "drama") this.handheld(1.2);
  }

  private ghostly(s: Phaser.GameObjects.Sprite) {
    s.setAlpha(0.55).setTint(0xbfe0ff);
    this.sc.tweens.add({ targets: s, y: s.y - 12, alpha: 0.35, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  // ------------------------------------------------------------------ dialogue

  protected onSpeak(name: string, text: string, emotion: string): number {
    this.lines++;
    if (this.unseen(name)) {
      if (this.genre === "parliament") {
        if (this.kind !== "wide") {
          this.chamber(this.lines % 2 === 0);
          this.strap("Cabinet Proceedings Live", "Commentary");
        }
      } else if (this.kind !== "wide") this.wide();
      return 0;
    }
    if (!this.cast.includes(name)) this.cast.push(name);
    const e = emotion.toLowerCase();
    let p: Perf | null = null;
    // now and then a line plays in the wide, so we see the room react
    const inWide = this.genre !== "parliament" && this.kind === "wide" && this.lines % 4 === 1 && !!this.bodies[name];
    if (inWide) {
      p = this.perfOf(name, this.bodies[name]);
    } else if (this.perf?.name === name && this.holdCount++ < 2) p = this.perf;
    else {
      // a long speech: the other camera now and then (a looser angle from the other side)
      const alt = this.perf?.name === name ? (this.angle = 1 - this.angle) : (this.angle = 0);
      this.holdCount = 0;
      p = this.genre === "parliament" ? this.dispatchBox(name) : this.single(name, { side: this.sideOf(name) * (alt ? -0.5 : 0.9), recut: true, blur: 1.5, zoom: alt ? 1.2 : 1.5, scale: alt && !this.hasFace(name) ? (this.r.SH * 0.85) / 64 : undefined });
      this.kind = "single";
      if (p && this.ghost.has(name)) {
        p.spr.setAlpha(0.6).setTint(0xbfe0ff);
        this.sc.tweens.add({ targets: p.spr, y: p.y - 14, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      if (p && this.genre === "drama") this.handheld(1.5);
      if (p) this.push(1.05, 4000, p.spr.x, this.r.SY + 160);
    }
    if (!p) return 0;
    if (p.face && /startled|panick|shock|ecstatic/.test(e)) p.base = F.ALARM;
    // the outburst: snap zoom (drama) / a jolt (sketch)
    if (/!/.test(text) && text.length < 90 && !inWide) {
      if (this.genre === "drama") this.later(250, () => this.crash(1.18, p!.spr.x, this.r.SY + 170));
      else if (this.genre === "sketch") this.later(200, () => this.sc.tweens.add({ targets: p!.spr, scaleX: { from: p!.scale, to: p!.scale * 1.06 }, scaleY: { from: p!.scale, to: p!.scale * 1.06 }, duration: 120, yoyo: true }));
    }
    if (/moan/.test(e) || /^(Mmm|Uhh)/i.test(text)) this.moan(p);
    this.talk(p, name, text, emotion);
    return 0;
  }

  /** Parliament: the member at the dispatch box, the benches soft behind, the name caption. */
  private dispatchBox(name: string) {
    const face = this.hasFace(name);
    const p = this.single(name, { side: 0.35, bg: this.tex("tv_cab_chamber"), zoom: 1.6, blur: 2, recut: true, scale: face ? 2.8 : (this.r.SH * 0.78) / 64 });
    if (p && !face) {
      // the whole member, standing at the box
      p.y = this.r.SY + this.r.SH * 1.02;
      p.spr.setY(p.y);
    }
    if (p) {
      const { SX, SY, SW, SH } = this.r;
      // the box itself
      this.add(this.sc.add.rectangle(SX + SW * 0.6, SY + SH - 30, 220, 60, 0x5a3a20).setStrokeStyle(3, 0x3a2410));
    }
    this.strap(name, MEMBERS[name] ?? "Member");
    return p;
  }

  private moan(p: Perf) {
    this.sc.tweens.add({ targets: p.spr, x: p.spr.x + 3, duration: 50, yoyo: true, repeat: 20 });
    p.spr.setTint(0xffc8c8);
    const d = this.add(this.text(p.spr.x + 90, this.r.SY + 120, "💦", 26));
    this.sc.tweens.add({ targets: d, y: d.y + 40, alpha: 0, duration: 900, repeat: 2 });
  }

  // ------------------------------------------------------------------ action

  protected onBlocking(name: string, to: string): number {
    this.pending.delete(name);
    if (/SUSAN NIPWOOD/.test(name)) {
      if (to === "offscreen") {
        const s = this.perf?.name === name ? this.perf.spr : this.bodies[name];
        if (s) this.sc.tweens.add({ targets: s, alpha: 0, y: s.y - 60, duration: 1200 });
        this.ghost.delete(name);
        this.cast = this.cast.filter((n) => n !== name);
        return 1200;
      }
      this.ghost.add(name);
      if (!this.cast.includes(name)) this.cast.push(name);
      // she materialises
      this.wide(false);
      const s = this.bodies[name];
      if (s) {
        s.setAlpha(0);
        this.sc.tweens.add({ targets: s, alpha: 0.55, duration: 1200 });
        this.sc.cameras.main.flash(300, 200, 230, 255);
      }
      this.sfx("drone");
      return 1200;
    }
    if (to === "offscreen") this.cast = this.cast.filter((n) => n !== name);
    else if (!this.cast.includes(name)) this.cast.push(name);
    return 0;
  }

  protected onDirection(a: string): number {
    const act = this.action(a);
    if (act >= 0) return act;
    // somebody named does something: cut to them
    const up = a.toUpperCase().replace(/^THE /, "");
    const named = this.cast.find((n) => up.startsWith(n) || up.startsWith(`${n.split(" ")[0]} `));
    if (/leave|storms off|walks out|exits/i.test(a)) {
      this.wide(false);
      for (const s of Object.values(this.bodies).slice(1)) this.sc.tweens.add({ targets: s, x: s.x + this.r.SW, duration: 2200, delay: Math.random() * 600, ease: "Sine.easeIn" });
      return 1600;
    }
    if (/enters|arrives|steps up/i.test(a)) {
      this.wide();
      return 900;
    }
    if (/exchange|glances|look(s)? at each other|murmur|gasps|room/i.test(a)) {
      this.wide();
      return 700;
    }
    if (named && !this.unseen(named)) {
      const p = this.single(named, { side: this.sideOf(named) * 0.9, recut: true, blur: 1.5, zoom: 1.5, expr: /panic|horrif|shock|startl|stunned|freez/i.test(a) ? F.ALARM : F.NEUTRAL });
      this.kind = "single";
      if (p) {
        if (this.ghost.has(named)) p.spr.setAlpha(0.6).setTint(0xbfe0ff);
        if (/hand on his chest|puts his hand/i.test(a)) {
          p.spr.setFrame(3);
          this.later(1600, () => p.spr.active && p.spr.setFrame(0));
        }
        this.push(1.08, 2500, p.spr.x, this.r.SY + 170);
        if (this.genre === "drama") this.handheld(1.5);
      }
      return 700;
    }
    if (this.kind !== "wide") this.wide();
    return 0;
  }

  // ------------------------------------------------------------------ the fights (PixelLab clips, see action.ts)

  /** The violent stage directions get their own shots. -1: not one of them (or the clips aren't loaded). */
  private action(a: string): number {
    if (/grabs a chair and throws it/i.test(a)) return this.chairThrow();
    if (/swings at Joe/i.test(a)) return this.gutPunch();
    if (/full-on brawl/i.test(a)) return this.brawl();
    if (/Chairs are hurled at Joe/i.test(a)) return this.joeFloored();
    if (/shoves the man in front of him/i.test(a)) return this.bennShoves();
    if (/punches Benn/i.test(a)) return this.bennPunched();
    if (/kimchi/i.test(a) && /flying/i.test(a)) return this.pelted();
    return -1;
  }

  /** President Han at the podium under a hail of kimchi, barbecue and K-Pop CDs; he ducks. */
  private pelted(): number {
    const { SX, SY, SW, SH } = this.r;
    if (!this.tex("tva_han_duck")) return -1;
    this.fightBg(0, 1.5);
    const han = this.clipAt("han_duck", this.cx, SY + SH + 8, SH * 0.88)!;
    this.handheld(1.8);
    this.sfx("crowd_boo");
    const props = ["kimchi", "meat", "cd", "kimchi", "meat", "cd", "kimchi"];
    props.forEach((name, i) => {
      this.later(120 + i * 300, () => {
        const left = i % 2 === 0;
        const hitsHim = i === 3 || i === 5;
        const to = hitsHim ? { x: this.cx + (left ? -30 : 40), y: SY + SH * 0.3 } : { x: left ? SX + SW + 40 : SX - 40, y: SY + SH * (0.15 + Math.random() * 0.4) };
        this.fling(name, { x: left ? SX - 30 : SX + SW + 30, y: SY + SH * (0.55 + Math.random() * 0.3) }, to, {
          ms: hitsHim ? 380 : 560,
          spin: left ? 720 : -720,
          from: 2.6,
          to: 3.2,
          arc: 90,
          done: () => {
            if (!hitsHim) return;
            this.hit(name === "cd" ? "pow" : "splat", to.x, to.y, 2.4, 0.01);
            this.sfx(name === "cd" ? "hit" : "splat");
          },
        });
      });
    });
    // he ducks as the first one comes past, and stays down
    this.later(260, () => this.playClip(han, "han_duck", { fps: 8 }));
    return 2400;
  }

  /** The room, out of focus behind a fight. */
  private fightBg(ox = 0, zoom = 1.45) {
    this.clear();
    this.kind = "fight";
    this.backdrop(this.host.setTexture(), { zoom, ox, oy: -10, blur: 1.5 });
  }

  /** Dave picks up a chair and lets fly; it sails over Joe's head and smashes the table behind him. */
  private chairThrow(): number {
    const { SX, SY, SW, SH } = this.r;
    if (!this.tex("tva_dave_chair")) return -1;
    this.fightBg(60);
    const d = this.clipAt("dave_chair", SX + SW * 0.36, SY + SH + 6, SH * 0.92, 64 / 192)!;
    this.handheld(1.6);
    this.sfx("roar");
    this.playClip(d, "dave_chair", {
      fps: 9,
      onFrame: (i) => {
        if (i === 3) this.crash(1.08, d.x, SY + SH * 0.4);
        if (i === 7) this.sfx("swing");
      },
    });
    // whip pan across the pub: Joe ducks, the chair goes over him into the table
    this.later(1050, () => {
      this.fightBg(-70, 1.6);
      const streak = this.over(this.sc.add.rectangle(SX, SY, SW, SH, 0xffffff, 0.25).setOrigin(0));
      this.sc.tweens.add({ targets: streak, alpha: 0, duration: 160, onComplete: () => streak.destroy() });
      const tableY = SY + SH * 0.9;
      const tx = SX + SW * 0.74;
      const table = this.add(this.sc.add.image(tx, tableY, "tva_prop_table").setOrigin(0.5, 1).setScale(3.4));
      const joe = this.clipAt("joe_cower", SX + SW * 0.3, SY + SH + 10, SH * 0.78, 0.5, { fps: 12, frames: [0, 2, 3, 4] });
      this.fling("chair", { x: SX - 40, y: SY + SH * 0.3 }, { x: tx, y: tableY - 150 }, { ms: 520, spin: 620, from: 2.2, to: 3.2, arc: 40 });
      this.later(520, () => {
        this.hit("smash", tx, tableY - 140, 2.6, 0.016);
        this.bang("CRASH!", tx - 20, SY + SH * 0.24, 40);
        // the table goes to pieces: two halves falling away
        table.setVisible(false);
        for (const side of [-1, 1]) {
          const half = this.add(this.sc.add.image(tx, tableY, "tva_prop_table").setOrigin(0.5, 1).setScale(3.4).setCrop(side < 0 ? 0 : 32, 0, 32, 64));
          this.sc.tweens.add({ targets: half, x: tx + side * 70, y: tableY + 30, angle: side * 70, duration: 520, ease: "Quad.in" });
        }
        if (joe) this.sc.tweens.add({ targets: joe, x: joe.x - 8, duration: 50, yoyo: true, repeat: 5 });
      });
      this.handheld(2.2);
    });
    return 2500;
  }

  /** Supporter 5 (short, stocky) winds up and puts one in Joe's stomach; Joe folds. */
  private gutPunch(): number {
    const { SX, SY, SW, SH } = this.r;
    if (!this.tex("tva_sup_punch") || !this.tex("tva_joe_gut")) return -1;
    this.fightBg(20, 1.5);
    const h = SH * 0.74;
    const joe = this.clipAt("joe_gut", SX + SW * 0.74, SY + SH + 8, h)!;
    const sup = this.clipAt("sup_punch", SX + SW * 0.22, SY + SH + 8, h, 64 / 192)!;
    this.handheld(1.4);
    this.later(200, () =>
      this.playClip(sup, "sup_punch", {
        fps: 11,
        onFrame: (i) => {
          if (i === 3) this.sc.tweens.add({ targets: sup, x: sup.x + 24, duration: 90, yoyo: true });
          if (i !== 4) return;
          this.sfx("punch");
          this.hit("pow", joe.x - h * 0.25, SY + SH - h * 0.2, 2.2);
          this.bang("OOF!", joe.x, SY + SH * 0.24);
          this.playClip(joe, "joe_gut", { fps: 10 });
          this.sc.tweens.add({ targets: joe, x: joe.x + 18, duration: 120, yoyo: true });
          this.sc.tweens.add({ targets: joe, y: joe.y + h * 0.14, duration: 400, delay: 250, ease: "Quad.out" });
        },
      }),
    );
    return 2200;
  }

  /** The whole pub goes off: chairs across the frame, fists, everyone knocked about. */
  private brawl(): number {
    const { SX, SY, SW, SH } = this.r;
    if (!this.tex("tva_prop_chair")) return -1;
    if (!this.cast.length) this.cast = this.sceneCast(this.idx);
    this.wide(false);
    this.kind = "fight";
    this.handheld(2.4);
    for (const b of Object.values(this.bodies)) {
      this.sc.tweens.add({ targets: b, x: b.x + (Math.random() - 0.5) * 30, angle: (Math.random() - 0.5) * 10, duration: 140 + Math.random() * 120, yoyo: true, repeat: -1 });
    }
    const words = ["POW!", "WALLOP!", "CRASH!", "THUMP!", "BIFF!", "OI!"];
    for (let i = 0; i < 6; i++) {
      this.later(150 + i * 380, () => {
        const left = i % 2 === 0;
        const to = { x: SX + SW * (0.25 + Math.random() * 0.5), y: SY + SH * (0.3 + Math.random() * 0.3) };
        if (i % 3 !== 2) {
          this.fling("chair", { x: left ? SX - 60 : SX + SW + 60, y: SY + SH * (0.15 + Math.random() * 0.3) }, to, {
            ms: 420,
            spin: left ? 700 : -700,
            from: 1.8,
            to: 2.6,
            done: () => {
              this.hit("smash", to.x, to.y, 2);
              this.sfx("smash");
              this.bang(words[i], to.x, to.y - 40, 30);
            },
          });
        } else {
          this.hit("pow", to.x, to.y, 2.4);
          this.sfx("punch");
          this.bang(words[i], to.x, to.y - 40, 30);
        }
      });
    }
    // a fist comes in from the side of the frame
    this.clipAt("sup_punch", SX + SW * 0.1, SY + SH + 40, SH * 0.66, 64 / 192, { fps: 12, delay: 900 });
    return 2700;
  }

  /** Joe on the floor, arms over his head, while the chairs keep coming. */
  private joeFloored(): number {
    const { SX, SY, SW, SH } = this.r;
    if (!this.tex("tva_joe_cower")) return -1;
    this.fightBg(-30, 1.7);
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0.2).setOrigin(0));
    const joe = this.clipAt("joe_cower", this.cx, SY + SH + 70, SH * 0.82)!;
    this.playClip(joe, "joe_cower", { fps: 7, frames: [0, 2, 3, 4, 5, 6, 5, 4, 3, 4, 5, 6, 5, 4, 3, 4, 5, 6] });
    this.handheld(2);
    for (let i = 0; i < 5; i++) {
      this.later(250 + i * 420, () => {
        const left = i % 2 === 0;
        const to = { x: this.cx + (Math.random() - 0.5) * 220, y: SY + SH * (0.45 + Math.random() * 0.2) };
        this.fling("chair", { x: left ? SX - 50 : SX + SW + 50, y: SY + SH * 0.1 }, to, {
          ms: 380,
          spin: left ? 540 : -540,
          from: 2.4,
          to: 3,
          arc: 20,
          done: () => {
            this.hit("smash", to.x, to.y, 2.2);
            this.sfx(i % 2 ? "smash" : "punch");
            this.sc.tweens.add({ targets: joe, y: joe.y + 10, duration: 60, yoyo: true });
          },
        });
      });
    }
    return 2600;
  }

  /** Benn shoves the man in the queue out of the frame, whirls round and shoves his date over. */
  private bennShoves(): number {
    const { SX, SY, SW, SH } = this.r;
    if (!this.tex("tva_benn_shove") || !this.tex("tva_woman_fall")) return -1;
    const h = SH * 0.8;
    this.fightBg(40, 1.4);
    // the man in front of him in the queue (no lines, so he's an extra)
    const man = this.tex("tvface_PUB_PATRON_1") ? this.add(this.sc.add.sprite(SX + SW * 0.8, SY + SH + 8, "tvface_PUB_PATRON_1", 0).setOrigin(0.5, 1).setScale(h / 128).setFlipX(true)) : null;
    const benn = this.clipAt("benn_shove", SX + SW * 0.3, SY + SH + 8, h, 64 / 192)!;
    this.handheld(1.4);
    this.later(150, () =>
      this.playClip(benn, "benn_shove", {
        fps: 11,
        onFrame: (i) => {
          if (i !== 4) return;
          this.sfx("punch");
          this.hit("pow", SX + SW * 0.62, SY + SH - h * 0.35, 1.8, 0.008);
          this.bang("SHOVE!", SX + SW * 0.66, SY + SH * 0.26);
          if (man) this.sc.tweens.add({ targets: man, x: man.x + SW * 0.5, angle: 25, duration: 380, ease: "Quad.out" });
        },
      }),
    );
    // whirls round: now his date is on the end of it
    this.later(1300, () => {
      this.fightBg(-60, 1.4);
      const wom = this.clipAt("woman_fall", SX + SW * 0.25, SY + SH + 8, h)!;
      const b2 = this.clipAt("benn_shove", SX + SW * 0.7, SY + SH + 8, h, 1 - 64 / 192)!;
      b2.setFlipX(true);
      this.crash(1.06);
      this.playClip(b2, "benn_shove", {
        fps: 12,
        frames: [2, 3, 4, 5, 6],
        onFrame: (i) => {
          if (i !== 2) return;
          this.sfx("punch");
          this.hit("pow", wom.x + h * 0.25, SY + SH - h * 0.35, 1.8, 0.008);
          this.playClip(wom, "woman_fall", { fps: 10 });
          this.later(500, () => this.hit("smash", wom.x, SY + SH - 10, 1.6, 0.01));
        },
      });
    });
    return 2700;
  }

  /** The man spins round and lands one on Benn, who goes down out of the bottom of the frame. */
  private bennPunched(): number {
    const { SX, SY, SW, SH } = this.r;
    if (!this.tex("tva_man_punch") || !this.tex("tva_benn_hit")) return -1;
    const h = SH * 0.8;
    this.fightBg(0, 1.45);
    const benn = this.clipAt("benn_hit", SX + SW * 0.26, SY + SH + 8, h)!;
    const man = this.clipAt("man_punch", SX + SW * 0.76, SY + SH + 8, h, 1 - 64 / 192)!;
    man.setFlipX(true);
    this.handheld(1.6);
    this.playClip(man, "man_punch", {
      fps: 11,
      onFrame: (i) => {
        if (i !== 6) return;
        this.sfx("punch_big");
        this.hit("pow", benn.x + h * 0.15, SY + SH - h * 0.6, 2.6, 0.018);
        this.bang("POW!", benn.x, SY + SH * 0.2, 44);
        this.playClip(benn, "benn_hit", {
          fps: 12,
          done: () => this.sc.tweens.add({ targets: benn, y: benn.y + h * 0.9, angle: -30, x: benn.x - 40, duration: 420, ease: "Quad.in" }),
        });
        this.crash(1.12, benn.x, SY + SH * 0.4);
      },
    });
    return 2300;
  }

  protected onAudience(cue: string): number {
    if (cue === "gasp" || cue === "laugh") {
      // the reaction shot: whoever just heard it, caught mid-gasp (or mid-giggle)
      const who = this.genre !== "parliament" ? this.cast.find((n) => n !== this.lastSpeaker && this.hasFace(n) && !this.pending.has(n)) : undefined;
      if (who) {
        const p = this.react(who, cue === "gasp" ? F.ALARM : F.NEUTRAL, { side: this.sideOf(who) * 0.9 });
        this.kind = "single";
        if (p) {
          if (cue === "laugh" && p.gest?.length) this.playGesture(p, p.gest.length - 1, 1100);
          this.crash(1.12, p.spr.x, this.r.SY + 170);
          if (this.genre === "drama") this.handheld(1.5);
        }
      } else if (this.perf) this.crash(1.15, this.perf.spr.x, this.r.SY + 170);
    }
    return 0;
  }

  protected onTransition(mode: string): number {
    if (mode === "fade" && this.genre === "sketch") {
      // the sketch's button: freeze, sting, the bumper flashes past
      const { SX, SY, SW, SH } = this.r;
      this.sc.tweens.killTweensOf(this.cam.list);
      this.sfx("tv_sting");
      const b = this.over(this.sc.add.rectangle(SX + SW, SY + SH - 60, SW, 44, 0xff4f8a).setOrigin(0));
      const t = this.over(this.text(SX + SW + 20, SY + SH - 38, "KREZZ SKETCH SHOW", 20, "#ffffff", { fontStyle: "bold" }).setOrigin(0, 0.5));
      this.sc.tweens.add({ targets: [b, t], x: `-=${SW}`, duration: 300, ease: "Quad.out" });
      return 1600;
    }
    return super.onTransition(mode);
  }
}

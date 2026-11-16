import Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../../systems/tv";
import { beatDuration } from "../../systems/tv";
import { voice } from "../../audio/Voice";
import { synth } from "../../audio/Synth";
import { vfx } from "../../gfx/Vfx";
import { FONT } from "../../ui/theme";
import { hdFactor } from "../../gfx/HD";

/**
 * KrelTV genre presentation: the shared camera crew.
 *
 * TVScene still runs the episode (timing, subtitles, voices, sound cues); a director draws the picture over its
 * stage, beat by beat, the way that kind of programme is shot (Sitcom.ts, Soap.ts, Documentary.ts, Shopping.ts,
 * Ensemble.ts). It is picked by the episode's id (see index.ts), so episode data doesn't have to change.
 *
 * Close-up art: public/art/tv/face_<NAME>.png (tvface_<NAME>), 128x128 frames:
 *   0 neutral, 1 talking, 2 alarmed, 3 blink, 4 gesture (talking), 5 laughing, 6 a show-specific special
 * (Peep Show's faces are the first four of these). Anyone without one is shot as their TV sprite instead.
 */

export interface Rect {
  SX: number;
  SY: number;
  SW: number;
  SH: number;
}

export interface ShowHost {
  /** the backdrop texture key TVScene picked for the current scene heading (tv_<key>) */
  setTexture(): string;
  /** the TV sprite for a character (full body, 64px frames) */
  spriteFor(name: string): string | null;
}

export const F = { NEUTRAL: 0, TALK: 1, ALARM: 2, BLINK: 3, GESTURE: 4, LAUGH: 5, SPECIAL: 6 } as const;

export const faceKeyOf = (name: string) => `tvface_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

/** Voices nobody sees. */
const UNSEEN = new Set(["NARRATOR", "ANNOUNCER", "PHONE", "VJ", "CROWD"]);

export interface Perf {
  name: string;
  spr: Phaser.GameObjects.Sprite;
  face: boolean;
  /** the frame they rest on (neutral / alarmed / a special) */
  base: number;
  scale: number;
  y: number;
  frames: number;
  /** mid-gesture (the mouth flap leaves the frame alone) */
  gesturing: boolean;
}

type Mouth = { open: boolean; units: number; stress?: boolean; word?: string };

/**
 * A line of dialogue as mouth movements: a flap per syllable, gaps between words and longer ones at commas and
 * full stops, so the mouth stops where the actor breathes. Units are scaled to the clip's real length.
 */
export function mouthPlan(text: string): Mouth[] {
  const out: Mouth[] = [];
  const words = text.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean);
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z']/g, "");
    const syl = Math.max(1, Math.min(5, (clean.toLowerCase().match(/[aeiouy]+/g) ?? []).length - (/[^aeiou]e$/i.test(clean) && clean.length > 3 ? 1 : 0)));
    const stress = (clean.length > 2 && clean === clean.toUpperCase() && /[A-Z]/.test(clean)) || /!$/.test(w);
    for (let i = 0; i < syl; i++) {
      out.push({ open: true, units: stress ? 1.4 : 1, stress: stress && i === 0, word: i === 0 ? clean : undefined });
      out.push({ open: false, units: 0.55 });
    }
    if (/[.!?…]+["”']?$/.test(w)) out.push({ open: false, units: 3.2 });
    else if (/[,;:—-]$/.test(w)) out.push({ open: false, units: 1.8 });
    else out.push({ open: false, units: 0.35 });
  }
  return out;
}

export abstract class ShowDirector {
  /** the picture: cut, zoomed and panned like a camera */
  readonly cam: Phaser.GameObjects.Container;
  /** graphics on top of the picture (captions, straps, logos); the camera never moves these */
  readonly gfx: Phaser.GameObjects.Container;
  /** this director draws the episode's title cards itself (TVScene leaves its card text off) */
  readonly ownsCards = true;
  protected timers: Phaser.Time.TimerEvent[] = [];
  /** timers that belong to the graphics layer (a ticking countdown survives cuts) */
  protected gfxTimers: Phaser.Time.TimerEvent[] = [];
  protected idx = 0;
  protected set = "";
  protected framing = "";
  /** who's in this scene, in order of their first line */
  protected cast: string[] = [];
  protected perf: Perf | null = null;
  protected lastSpeaker = "";
  protected prevSpeaker = "";
  /** consecutive cuts on the same person (a long speech holds and pushes in instead of re-cutting) */
  protected holdCount = 0;
  protected camProxy = { s: 1, fx: 0, fy: 0 };
  protected seen = new Set<string>();

  constructor(
    protected sc: Phaser.Scene,
    protected r: Rect,
    protected beats: TVBeat[],
    protected host: ShowHost,
    protected ep: TVEpisode,
  ) {
    const mk = (depth: number) => {
      const c = sc.add.container(0, 0).setDepth(depth);
      const g = sc.make.graphics({}).fillRect(r.SX, r.SY, r.SW, r.SH);
      c.setMask(g.createGeometryMask());
      return c;
    };
    this.cam = mk(4);
    this.gfx = mk(5);
  }

  destroy() {
    this.clear();
    for (const t of this.gfxTimers) t.remove();
    this.gfxTimers = [];
    this.sc.tweens.killTweensOf(this.gfx.list);
    this.cam.destroy();
    this.gfx.destroy();
  }

  // ------------------------------------------------------------------ the beat hook

  /** Show a beat. Returns how long (ms) the picture needs, so the show waits for a sequence to play. */
  beat(b: TVBeat, idx: number): number {
    this.idx = idx;
    switch (b.type) {
      case "shot": {
        const fresh = b.set !== this.set;
        this.set = b.set;
        this.framing = b.framing;
        if (fresh) this.cast = this.sceneCast(idx);
        return this.onShot(b.set, b.framing, fresh);
      }
      case "speaker": {
        const n = b.character.toUpperCase();
        const ms = this.onSpeak(n, b.text, b.emotion ?? "");
        if (!this.unseen(n)) {
          if (n !== this.lastSpeaker) this.prevSpeaker = this.lastSpeaker;
          this.lastSpeaker = n;
        }
        return ms;
      }
      case "direction":
        return this.onDirection(b.action);
      case "titleCard":
        return this.onTitle(b.text);
      case "audience":
        return this.onAudience(b.cue);
      case "sfx":
        return this.onSfx(b.id);
      case "transition":
        return this.onTransition(b.mode);
      case "music":
        return this.onMusic(b.id, b.mode);
      case "prop":
        return this.onProp(b.id, b.on);
      case "blocking":
        return this.onBlocking(b.character.toUpperCase(), b.to, b.pose);
      default:
        return 0;
    }
  }

  protected abstract onShot(set: string, framing: string, fresh: boolean): number;
  protected abstract onSpeak(name: string, text: string, emotion: string): number;
  protected onDirection(_a: string): number {
    return 0;
  }
  protected onTitle(_t: string): number {
    return 0;
  }
  protected onAudience(_cue: string): number {
    return 0;
  }
  protected onSfx(_id: string): number {
    return 0;
  }
  protected onTransition(mode: string): number {
    if (mode === "cut") {
      this.black();
      return 500;
    }
    return 0;
  }
  protected onMusic(_id: string, _mode: string): number {
    return 0;
  }
  protected onProp(_id: string, _on: boolean): number {
    return 0;
  }
  protected onBlocking(_n: string, _to: string, _pose?: string): number {
    return 0;
  }

  // ------------------------------------------------------------------ plumbing

  protected clear() {
    for (const t of this.timers) t.remove();
    this.timers = [];
    this.sc.tweens.killTweensOf(this.cam.list);
    this.sc.tweens.killTweensOf(this.cam);
    this.sc.tweens.killTweensOf(this.camProxy);
    this.cam.removeAll(true);
    this.cam.setPosition(0, 0).setScale(1).setAngle(0);
    this.camProxy = { s: 1, fx: 0, fy: 0 };
    this.perf = null;
  }

  protected later(ms: number, fn: () => void, gfx = false) {
    const t = this.sc.time.delayedCall(ms, fn);
    (gfx ? this.gfxTimers : this.timers).push(t);
    return t;
  }

  protected every(ms: number, fn: () => void, repeat = -1, gfx = false) {
    const t = this.sc.time.addEvent({ delay: ms, loop: repeat < 0, repeat: repeat < 0 ? undefined : repeat, callback: fn });
    (gfx ? this.gfxTimers : this.timers).push(t);
    return t;
  }

  protected add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.cam.add(o);
    return o;
  }

  protected over<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.gfx.add(o);
    return o;
  }

  /** Wipe the graphics layer (and its timers). */
  protected clearGfx() {
    for (const t of this.gfxTimers) t.remove();
    this.gfxTimers = [];
    this.sc.tweens.killTweensOf(this.gfx.list);
    this.gfx.removeAll(true);
  }

  protected get cx() {
    return this.r.SX + this.r.SW / 2;
  }
  protected get cy() {
    return this.r.SY + this.r.SH / 2;
  }

  protected hash(s: string) {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  protected unseen(name: string) {
    return UNSEEN.has(name.replace(/\s*#?\d+$/, ""));
  }

  protected tex(key: string) {
    return this.sc.textures.exists(key) ? key : null;
  }

  protected hasFace(name: string) {
    return this.sc.textures.exists(faceKeyOf(name));
  }

  protected faceFrames(name: string) {
    const k = faceKeyOf(name);
    return this.sc.textures.exists(k) ? this.sc.textures.get(k).frameTotal - 1 : 0;
  }

  /** Who's in the scene starting at beat `from` (everyone who speaks before the next scene heading). */
  protected sceneCast(from: number) {
    const out: string[] = [];
    for (let i = from + 1; i < this.beats.length; i++) {
      const b = this.beats[i];
      if (b.type === "shot" && b.set !== this.set) break;
      if (b.type === "speaker" || b.type === "blocking") {
        const n = b.character.toUpperCase();
        if (!this.unseen(n) && !out.includes(n) && !/ AND /.test(n)) out.push(n);
      }
    }
    return out;
  }

  /** The next person to speak after this beat (for reaction shots), other than `not`. */
  protected nextSpeaker(not = "") {
    for (let i = this.idx + 1; i < this.beats.length; i++) {
      const b = this.beats[i];
      if (b.type === "shot" && b.set !== this.set) break;
      if (b.type === "speaker" && b.character.toUpperCase() !== not && !this.unseen(b.character.toUpperCase())) return b.character.toUpperCase();
    }
    return "";
  }

  /** A solid card over everything (cuts to black). */
  protected black(col = 0x000000) {
    this.clear();
    this.add(this.sc.add.rectangle(this.r.SX, this.r.SY, this.r.SW, this.r.SH, col).setOrigin(0));
  }

  // ------------------------------------------------------------------ pictures

  /** A set or still, filling the screen. `zoom` > 1 crops in; ox/oy pan (screen pixels). */
  protected backdrop(key: string | null, o: { zoom?: number; ox?: number; oy?: number; blur?: number; tint?: number; alpha?: number } = {}) {
    const { SX, SY, SW, SH } = this.r;
    if (!key || !this.sc.textures.exists(key)) return this.add(this.sc.add.rectangle(SX + SW / 2, SY + SH / 2, SW, SH, 0x222222)) as unknown as Phaser.GameObjects.Image;
    const src = this.sc.textures.get(key).getSourceImage() as HTMLImageElement;
    const img = this.add(this.sc.add.image(SX + SW / 2 + (o.ox ?? 0), SY + SH / 2 + (o.oy ?? 0), key));
    img.setScale(Math.max(SW / src.width, SH / src.height) * (o.zoom ?? 1));
    if (o.tint !== undefined) img.setTint(o.tint);
    if (o.alpha !== undefined) img.setAlpha(o.alpha);
    if (o.blur) {
      try {
        img.preFX?.addBlur(1, o.blur, o.blur, 1);
      } catch {
        /* canvas renderer: no blur */
      }
    }
    return img;
  }

  /**
   * A slow move over a still (the Ken Burns treatment): from one crop to another over `ms`.
   * Zooms are relative to "just fills the screen".
   */
  protected kenBurns(key: string | null, from: { z: number; x: number; y: number }, to: { z: number; x: number; y: number }, ms: number, o: { tint?: number; blur?: number } = {}) {
    const img = this.backdrop(key, { zoom: from.z, ox: from.x, oy: from.y, tint: o.tint, blur: o.blur });
    const base = img.scale / from.z;
    this.sc.tweens.add({ targets: img, scale: base * to.z, x: this.cx + to.x, y: this.cy + to.y, duration: ms, ease: "Sine.easeInOut" });
    return img;
  }

  /** Push the whole picture in (or out) about a point, slowly: a dolly move. */
  protected push(to: number, ms: number, fx = this.cx, fy = this.cy, ease = "Sine.easeInOut") {
    this.camProxy.fx = fx;
    this.camProxy.fy = fy;
    const apply = () => {
      const p = this.camProxy;
      this.cam.setScale(p.s).setPosition(p.fx * (1 - p.s), p.fy * (1 - p.s));
    };
    this.sc.tweens.add({ targets: this.camProxy, s: to, duration: ms, ease, onUpdate: apply });
  }

  /** A sudden zoom in on a point (the "crash zoom"). */
  protected crash(to: number, fx = this.cx, fy = this.cy) {
    this.push(to, 160, fx, fy, "Quad.out");
  }

  /** Hand-held: the frame drifts and wobbles a little. */
  protected handheld(amount = 1) {
    const h = () => {
      this.sc.tweens.add({ targets: this.cam, x: this.cam.x + (Math.random() - 0.5) * 6 * amount, y: this.cam.y + (Math.random() - 0.5) * 5 * amount, angle: (Math.random() - 0.5) * 0.6 * amount, duration: 700 + Math.random() * 600, ease: "Sine.easeInOut" });
    };
    h();
    this.every(1300, h);
  }

  /** Someone's full-body TV sprite, standing with their feet at `y`. */
  protected body(name: string, x: number, y: number, height: number, frame = 0) {
    const tex = this.host.spriteFor(name);
    if (!tex || !this.sc.textures.exists(tex)) return null;
    const fh = this.sc.textures.getFrame(tex, 0)?.height ?? 64;
    const s = this.add(this.sc.add.sprite(x, y, tex, frame).setOrigin(0.5, 1));
    s.setScale(height / fh / hdFactor(s));
    return s;
  }

  /**
   * Cut to (or stay on) someone's single: their close-up face, or their sprite from the knees up if they haven't
   * one. `side` puts them on a third of the frame (-1 left, 0 centre, 1 right); the room behind is soft and
   * offset, as if shot across it.
   */
  protected single(name: string, o: { side?: number; bg?: string | null; zoom?: number; blur?: number; recut?: boolean; expr?: number; scale?: number; bgTint?: number } = {}) {
    if (this.perf && this.perf.name === name && !o.recut) {
      if (o.expr !== undefined) this.setBase(o.expr);
      return this.perf;
    }
    this.clear();
    const { SX, SY, SW, SH } = this.r;
    const side = o.side ?? 0;
    const h = this.hash(name);
    this.backdrop(o.bg === undefined ? this.host.setTexture() : o.bg, { zoom: o.zoom ?? 1.7, ox: -side * 90 + ((h % 5) - 2) * 26, oy: -20 + ((h >> 3) % 3) * 22, blur: o.blur ?? 2, tint: o.bgTint });
    const x = SX + SW / 2 + side * SW * 0.2;
    let spr: Phaser.GameObjects.Sprite;
    let face = false;
    let scale: number;
    let y: number;
    const fk = faceKeyOf(name);
    if (this.sc.textures.exists(fk)) {
      face = true;
      scale = o.scale ?? 3.1;
      y = SY + SH + 6;
      spr = this.add(this.sc.add.sprite(x, y, fk, 0).setOrigin(0.5, 1).setScale(scale));
    } else {
      const tex = this.host.spriteFor(name) ?? "";
      if (!this.sc.textures.exists(tex)) {
        this.perf = null;
        return null;
      }
      const fh = this.sc.textures.getFrame(tex, 0)?.height ?? 64;
      // a medium shot: from about the waist up
      y = SY + SH + SH * 0.3;
      spr = this.add(this.sc.add.sprite(x, y, tex, 0).setOrigin(0.5, 1));
      // character sheets carry an hd factor that every scale write is multiplied by: work in write units
      scale = (o.scale ?? (SH * 1.08) / fh) / hdFactor(spr);
      spr.setScale(scale);
    }
    if (side) spr.setFlipX(face ? false : side > 0);
    const p: Perf = { name, spr, face, base: 0, scale, y, frames: face ? this.faceFrames(name) : 0, gesturing: false };
    this.perf = p;
    this.setBase(o.expr ?? F.NEUTRAL);
    this.idle(p);
    return p;
  }

  /** The frame someone rests on. */
  protected setBase(f: number) {
    const p = this.perf;
    if (!p) return;
    if (p.face) {
      p.base = f < p.frames ? f : f === F.LAUGH || f === F.SPECIAL ? F.ALARM : F.NEUTRAL;
      p.spr.setFrame(p.base);
    } else {
      p.base = 0;
      p.spr.setFrame(0);
    }
  }

  /** Alive but not talking: breathing, blinking, a glance now and then. Not a bob. */
  protected idle(p: Perf) {
    const { spr } = p;
    this.breathe(spr, 1700 + (this.hash(p.name) % 600));
    if (!p.face || p.frames <= F.BLINK) return;
    const blink = () => {
      if (!spr.active || this.perf !== p) return;
      if (Number(spr.frame.name) === p.base && p.base !== F.ALARM && p.base !== F.SPECIAL && !p.gesturing) {
        spr.setFrame(F.BLINK);
        this.later(110, () => spr.active && !p.gesturing && Number(spr.frame.name) === F.BLINK && spr.setFrame(p.base));
      }
      this.later(1900 + Math.random() * 2800, blink);
    };
    this.later(700 + Math.random() * 1800, blink);
  }

  /**
   * Say a line: the mouth follows the words (a flap per syllable, still at the commas), timed to the recording
   * when there is one, and one gesture picked for this line from what it says.
   */
  protected talk(p: Perf, speaker: string, text: string, emotion = "") {
    const plan = mouthPlan(text);
    const units = plan.reduce((a, m) => a + m.units, 0) || 1;
    const started = this.sc.time.now;
    let total = beatDuration({ type: "speaker", character: "", text }) * 820;
    void voice.clipMs(speaker, text).then((ms) => {
      if (ms && voice.enabled()) total = ms;
    });
    let i = 0;
    let at = 0;
    const open = p.face ? F.TALK : 1;
    const closed = () => (p.face ? (p.base === F.ALARM || p.base === F.SPECIAL || p.base === F.LAUGH ? p.base : F.NEUTRAL) : 0);
    const step = () => {
      if (!p.spr.active || this.perf !== p) return;
      const now = this.sc.time.now - started;
      if (i >= plan.length) {
        // still going (the recording runs long): keep flapping until it stops
        if (voice.busy() && now < 30000) {
          if (!p.gesturing) this.mouth(p, Number(p.spr.frame.name) === open ? closed() : open, open);
          this.later(110 + Math.random() * 70, step);
        } else if (!p.gesturing) this.mouth(p, closed(), open);
        return;
      }
      const m = plan[i++];
      const unit = total / units;
      if (!p.gesturing) this.mouth(p, m.open ? open : closed(), open);
      if (m.stress) this.emphasis(p);
      at += m.units * unit;
      this.later(Math.max(40, started + at - this.sc.time.now), step);
    };
    step();
    this.gesture(p, text, emotion, () => total);
  }

  private mouth(p: Perf, f: number, open: number) {
    if (p.face && (p.base === F.SPECIAL || p.base === F.LAUGH)) {
      // crying / laughing / asleep has no talking frame of its own: the face shudders with the words instead
      p.spr.setFrame(p.base);
      p.spr.y = p.y - (f === open ? 2 : 0);
    } else if (p.face) p.spr.setFrame(f);
    else {
      // a sprite has no mouth to open: the head and shoulders move with the syllables instead
      p.spr.setFrame(0);
      p.spr.y = p.y - (f === open ? 3 : 0);
    }
  }

  /** A stressed word: a little nod into it. */
  protected emphasis(p: Perf) {
    this.sc.tweens.add({ targets: p.spr, y: p.y + 4, duration: 90, yoyo: true, ease: "Quad.out" });
  }

  /** One gesture per line, chosen from the words: a question tilts, a "no" shakes, a shout gestures... */
  protected gesture(p: Perf, text: string, emotion: string, total: () => number) {
    const t = text.trim();
    const e = emotion.toLowerCase();
    const h = this.hash(t);
    const spr = p.spr;
    const dur = () => Math.max(900, total());
    if (/laugh|haha/i.test(e) || /\bha(ha)+\b/i.test(t)) {
      if (p.face && p.frames > F.LAUGH) {
        p.gesturing = true;
        spr.setFrame(F.LAUGH);
        this.sc.tweens.add({ targets: spr, angle: { from: -2, to: 2 }, duration: 160, yoyo: true, repeat: 6 });
        this.later(dur() * 0.55, () => (p.gesturing = false));
      }
      return;
    }
    if (/cry|upset|sob/.test(e) && p.face && p.frames > F.SPECIAL) {
      p.base = F.SPECIAL;
      spr.setFrame(F.SPECIAL);
      this.sc.tweens.add({ targets: spr, x: spr.x + 2, duration: 70, yoyo: true, repeat: 12 });
      return;
    }
    if (/^(no|not|never|nah)\b/i.test(t)) {
      this.sc.tweens.add({ targets: spr, x: spr.x + 6, duration: 130, yoyo: true, repeat: 3, ease: "Sine.easeInOut", delay: 120 });
      return;
    }
    if (/^(yes|yep|yeah|right|exactly|lovely|absolutely)\b/i.test(t)) {
      this.sc.tweens.add({ targets: spr, y: p.y + 6, duration: 160, yoyo: true, repeat: 2, ease: "Sine.easeInOut", delay: 100 });
      return;
    }
    const shout = /!/.test(t) || /\b[A-Z]{4,}\b/.test(t) || /point|accus|jab/.test(e);
    const pick = (shout ? 0 : 1) + (h % 3);
    if (shout || pick === 1) {
      // the big one: a hand comes up (or a lunge, for a sprite) part way into the line
      const at = 200 + (h % 400);
      this.later(at, () => {
        if (this.perf !== p) return;
        if (p.face && p.frames > F.GESTURE) {
          p.gesturing = true;
          spr.setFrame(F.GESTURE);
          this.sc.tweens.add({ targets: spr, scaleX: { from: p.scale, to: p.scale * 1.03 }, scaleY: { from: p.scale, to: p.scale * 1.03 }, duration: 180, yoyo: true, ease: "Quad.out" });
          this.later(Math.min(1500, dur() * 0.45), () => {
            p.gesturing = false;
          });
        } else if (!p.face && shout) {
          spr.setFrame(3);
          this.later(500, () => spr.active && spr.setFrame(0));
        } else this.sc.tweens.add({ targets: spr, angle: (h % 2 ? 1 : -1) * 3, duration: 260, yoyo: true, hold: 500, ease: "Sine.easeInOut" });
      });
      return;
    }
    if (/\?\s*$/.test(t)) {
      this.sc.tweens.add({ targets: spr, angle: (h % 2 ? 1 : -1) * 4, duration: 320, ease: "Sine.easeOut" });
      this.later(dur(), () => this.sc.tweens.add({ targets: spr, angle: 0, duration: 300 }));
      return;
    }
    if (pick === 2) {
      // lean in to make the point
      this.sc.tweens.add({ targets: spr, scaleX: { from: p.scale, to: p.scale * 1.045 }, scaleY: { from: p.scale, to: p.scale * 1.045 }, y: p.y + 8, duration: 600, ease: "Sine.easeOut", yoyo: true, hold: Math.min(2400, dur() * 0.6) });
      return;
    }
    // settle back / shift weight
    this.sc.tweens.add({ targets: spr, x: spr.x + (h % 2 ? 7 : -7), angle: h % 2 ? 1.5 : -1.5, duration: 700, yoyo: true, hold: Math.min(1800, dur() * 0.5), ease: "Sine.easeInOut" });
  }

  /** A sprite's scale in write units (character sheets multiply every write by their hd factor). */
  protected wscale(s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image) {
    return Math.abs(s.scaleX) / hdFactor(s);
  }

  /** Set a sprite's real on-screen scale. */
  protected realScale<T extends Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>(s: T, v: number): T {
    s.setScale(v / hdFactor(s));
    return s;
  }

  /** Breathing: the chest rises and falls, a hair. */
  protected breathe(s: Phaser.GameObjects.Sprite, ms = 1600) {
    const w = this.wscale(s);
    this.sc.tweens.add({ targets: s, scaleY: { from: w, to: w * 1.012 }, duration: ms, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /** Someone in a wide shot, as a performer (so they can talk there). */
  protected perfOf(name: string, s: Phaser.GameObjects.Sprite): Perf {
    const p: Perf = { name, spr: s, face: false, base: 0, scale: this.wscale(s), y: s.y, frames: 0, gesturing: false };
    this.perf = p;
    return p;
  }

  /** A reaction: hold on someone not talking, with a look. */
  protected react(name: string, expr: number, o: { side?: number; bg?: string | null; push?: number } = {}) {
    const p = this.single(name, { side: o.side ?? 0, recut: true, expr, bg: o.bg });
    if (p && o.push) this.push(o.push, 1600, p.spr.x, p.spr.y - 200);
    return p;
  }

  /** Text helper. */
  protected text(x: number, y: number, s: string, size: number, col = "#ffffff", o: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    return this.sc.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: col, ...o });
  }

  /** A drawn effect, in the picture. */
  protected fx(key: string, x: number, y: number, o: Parameters<typeof vfx>[4] = {}) {
    const s = vfx(this.sc, key, x, y, o);
    if (s) this.cam.add(s);
    return s;
  }

  protected sfx(id: string) {
    synth.play(id);
  }
}

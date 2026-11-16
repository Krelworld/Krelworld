import Phaser from "phaser";
import { voice } from "../../audio/Voice";
import { speakable } from "../../audio/voiceKey";
import { KREWS3_ANCHORS, krews3Gesture } from "./krews3Cast";

/**
 * A talking presenter for the news broadcasts (and the Crobley studio / Swig's press conference).
 *
 * Art: public/art/tv/anchor_<NAME>.png, PixelLab medium shots at 128x128. One row per pose (rest first, then the
 * gestures), four frames a row: 0 mouth closed, 1 mouth part-open, 2 mouth wide, 3 blink. The mouth and eye frames
 * were cut from the rest pose and pasted onto every gesture whose head lines up (scratch build script), so the face
 * stays identical while the arms move. Poses whose face is covered (drinking, munching, aiming) don't lip-sync.
 */

export interface AnchorDef {
  key: string;
  poses: string[];
  /** which poses have mouth frames */
  talks: boolean[];
}

export const ANCHORS: Record<string, AnchorDef> = {
  NEWSREADER: { key: "tvanchor_NEWSREADER", poses: ["rest", "palm", "point", "papers"], talks: [true, true, true, true] },
  "PRESIDENT KLERBLE": { key: "tvanchor_PRESIDENT_KLERBLE", poses: ["rest", "point", "wide", "fist", "whisper"], talks: [true, true, true, true, false] },
  "KRANKY KRANDALL": { key: "tvanchor_KRANKY_KRANDALL", poses: ["rest", "finger", "sip", "yee"], talks: [true, true, false, true] },
  JOURNALIST: { key: "tvanchor_JOURNALIST", poses: ["rest", "palm"], talks: [true, true] },
  REPORTER: { key: "tvanchor_REPORTER", poses: ["rest", "thumb", "mic"], talks: [true, true, true] },
  "REINHARDT CROBLEY": { key: "tvanchor_REINHARDT", poses: ["rest", "point", "fists"], talks: [true, true, true] },
  "SERGEANT SWIG": { key: "tvanchor_SWIG", poses: ["rest", "point", "beer", "munch", "gun"], talks: [true, true, false, false, false] },
  ...KREWS3_ANCHORS,
};

export function hasAnchor(sc: Phaser.Scene, name: string) {
  const d = ANCHORS[name.toUpperCase()];
  return !!d && sc.textures.exists(d.key);
}

const M_CLOSED = 0;
const M_MID = 1;
const M_OPEN = 2;
const M_BLINK = 3;

/** Rough mouth shapes from the letters of a line, one per ~70 ms of speech. */
export function visemes(text: string): number[] {
  const t = speakable(text).toLowerCase();
  const out: number[] = [];
  let prev = -1;
  for (const ch of t) {
    let v: number;
    if (/[ao]/.test(ch)) v = M_OPEN;
    else if (/[eiuy]/.test(ch)) v = M_MID;
    else if (/[mbp]/.test(ch)) v = M_CLOSED;
    else if (/[a-z0-9]/.test(ch)) v = prev === M_MID ? M_CLOSED : M_MID;
    else if (/[.,!?;:…—–-]/.test(ch)) {
      out.push(M_CLOSED, M_CLOSED, M_CLOSED);
      prev = M_CLOSED;
      continue;
    } else v = M_CLOSED;
    // a held vowel reads as one open mouth, not a stutter
    if (v === prev && v !== M_CLOSED && Math.random() < 0.5) v = M_MID;
    out.push(v);
    prev = v;
  }
  while (out.length && out[out.length - 1] === M_CLOSED) out.pop();
  return out.length ? out : [M_MID, M_CLOSED];
}

/** Which gesture suits a line (poses the character doesn't have are skipped). */
function gestureFor(name: string, text: string, n: number): string[] {
  const t = text.toLowerCase();
  switch (name) {
    case "NEWSREADER":
      if (/^\(long pause\)/.test(t)) return ["rest"];
      if (/good evening|breaking news|^good night/.test(t)) return ["papers", "rest"];
      if (/we go|go there live|next up|footage|and now|we now return|joins me/.test(t)) return ["point", "rest"];
      if (/\?/.test(t)) return ["palm"];
      return [["palm", "rest"], ["rest", "palm"], ["point", "palm"], ["papers"]][n % 4];
    case "PRESIDENT KLERBLE":
      if (/^\(quietly\)/.test(t)) return ["whisper", "fist"];
      if (/grrr|hate|revenge|terroris|hijack|crash it/.test(t)) return ["fist", "point"];
      if (/hello|come on over|cross the bridge|gift|welcome|relax|for a laugh|no further questions/.test(t)) return ["wide", "point"];
      if (/krelworld|you|watching/.test(t)) return ["point", "rest"];
      return [["point", "rest"], ["wide"], ["fist", "rest"], ["rest", "point"]][n % 4];
    case "KRANKY KRANDALL":
      if (/^(mmm|lovely pussy juice|sorry\. mmm|how many)/.test(t)) return ["sip", "rest"];
      if (/yee/.test(t)) return ["yee"];
      if (/sip|need pussy juice|does anyone have/.test(t)) return ["finger", "sip"];
      return [["finger", "rest"], ["rest", "finger"], ["yee", "rest"]][n % 3];
    case "REPORTER":
      if (/\?|—$|sir|mr president/i.test(text)) return ["mic"];
      if (/behind me|back to the studio/.test(t)) return ["thumb"];
      return ["thumb", "rest"];
    case "JOURNALIST":
      return [["rest", "palm"], ["palm", "rest"], ["rest"]][n % 3];
    case "REINHARDT CROBLEY":
      if (/i've had it/.test(t)) return ["fists"];
      if (/fucking|bloody|squawking/.test(t)) return ["point", "fists"];
      return ["rest"];
    case "SERGEANT SWIG":
      if (/fuck/.test(t)) return ["point"];
      return [["rest"], ["point", "rest"], ["rest"]][n % 3];
  }
  return krews3Gesture(name, text, n) ?? ["rest"];
}

export class Presenter {
  readonly spr: Phaser.GameObjects.Sprite;
  readonly name: string;
  private def: AnchorDef;
  private pose = 0;
  private mouth = M_CLOSED;
  private timers: Phaser.Time.TimerEvent[] = [];
  private talkTimers: Phaser.Time.TimerEvent[] = [];
  private talking = false;
  private lines = 0;
  private breath: Phaser.Tweens.Tween;
  private nod?: Phaser.Tweens.Tween;
  /** the mouth's base (a face still mid-gasp, say) */
  baseMouth = M_CLOSED;

  constructor(
    private sc: Phaser.Scene,
    name: string,
    x: number,
    y: number,
    scale: number,
    into?: Phaser.GameObjects.Container,
    /** another anchor's art for this speaker (the same person somewhere else) */
    anchor?: string,
  ) {
    this.name = name.toUpperCase();
    this.def = ANCHORS[anchor ?? this.name];
    this.spr = sc.add.sprite(x, y, this.def.key, 0).setOrigin(0.5, 1).setScale(scale);
    if (into) into.add(this.spr);
    // breathing, and a head that never quite holds still
    this.breath = sc.tweens.add({ targets: this.spr, scaleY: scale * 1.006, duration: 1700 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const blink = () => {
      if (!this.spr.active) return;
      if (this.mouth === M_CLOSED && !this.talking) {
        this.show(M_BLINK);
        this.later(120, () => this.show(this.baseMouth), this.timers);
        // the odd double blink
        if (Math.random() < 0.18) this.later(260, () => { this.show(M_BLINK); this.later(110, () => this.show(this.baseMouth), this.timers); }, this.timers);
      } else if (this.talking && Math.random() < 0.5) {
        // blink mid-sentence, between syllables
        const m = this.mouth;
        this.show(M_BLINK);
        this.later(90, () => this.mouth === M_BLINK && this.show(m), this.timers);
      }
      this.later(1900 + Math.random() * 2800, blink, this.timers);
    };
    this.later(700 + Math.random() * 1500, blink, this.timers);
  }

  private later(ms: number, fn: () => void, list: Phaser.Time.TimerEvent[]) {
    const t = this.sc.time.delayedCall(ms, () => this.spr.active && fn());
    list.push(t);
    return t;
  }

  private show(m: number) {
    if (!this.spr.active) return;
    // a pose with its face covered keeps a closed mouth (and its own eyes)
    if (!this.def.talks[this.pose] && m !== M_CLOSED) m = M_CLOSED;
    this.mouth = m;
    this.spr.setFrame(this.pose * 4 + m);
  }

  poseIndex(p: string) {
    return Math.max(0, this.def.poses.indexOf(p));
  }

  hasPose(p: string) {
    return this.def.poses.includes(p);
  }

  /** Move to a pose: a quick ghost of the old arms trails the new ones, and the body settles. */
  setPose(p: string | number, smear = true) {
    const i = typeof p === "number" ? p : this.poseIndex(p);
    if (i === this.pose || !this.spr.active) return;
    if (smear && this.spr.parentContainer) {
      const g = this.sc.add.sprite(this.spr.x, this.spr.y, this.def.key, this.pose * 4 + (this.def.talks[this.pose] ? this.mouth : 0)).setOrigin(0.5, 1).setScale(this.spr.scaleX, this.spr.scaleY).setAlpha(0.55);
      this.spr.parentContainer.addAt(g, this.spr.parentContainer.getIndex(this.spr));
      this.sc.tweens.add({ targets: g, alpha: 0, duration: 130, onComplete: () => g.destroy() });
    }
    this.pose = i;
    this.show(this.mouth);
    const y = this.spr.y;
    this.sc.tweens.add({ targets: this.spr, y: { from: y + this.spr.scaleY * 1.2, to: y }, duration: 160, ease: "Quad.out" });
  }

  get poseName() {
    return this.def.poses[this.pose];
  }

  /**
   * Say a line: mouth shapes from its letters, stretched over the recording's length when there is one, held
   * open for as long as the voice is still going; and gestures for the line (or `poses`), moved between mid-line.
   */
  say(text: string, opts: { poses?: string[]; delay?: number; offset?: number; onDone?: () => void } = {}) {
    this.stopTalking();
    this.talking = true;
    const n = this.lines++;
    const seq = visemes(text);
    const poses = (opts.poses ?? gestureFor(this.name, text, n)).filter((p) => this.hasPose(p));
    const est = Math.max(900, seq.length * 68);
    // `offset`: the line started that long ago (we cut to this shot mid-sentence)
    const started = this.sc.time.now + (opts.delay ?? 0) - (opts.offset ?? 0);
    let span = est;
    let heard = false;
    void voice.clipMs(this.name, text).then((ms) => {
      if (ms && ms > 400) span = ms - 120;
    }).catch(() => undefined);
    // gestures: the first comes in just after the line starts, the rest are spread across it, back to rest near the end
    if (poses.length) {
      const off = opts.offset ?? 0;
      const at = (k: number) => (opts.delay ?? 0) + (k === 0 ? 120 + Math.random() * 160 : (est * k) / (poses.length + 0.3)) - off;
      // already past a gesture's moment: start in it
      let first = 0;
      for (let k = 1; k < poses.length; k++) if (at(k) <= 0) first = k;
      this.setPose(off > 0 ? poses[first] : this.poseName, false);
      for (let k = off > 0 ? first + 1 : 0; k < poses.length; k++) this.later(Math.max(0, at(k)), () => this.talking && this.setPose(poses[k]), this.talkTimers);
    }
    // head nods with the stresses
    const nod = (this.nod = this.sc.tweens.add({ targets: this.spr, angle: { from: -0.9, to: 0.9 }, duration: 420 + Math.random() * 240, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: opts.delay ?? 0 }));
    const tick = () => {
      if (!this.spr.active || !this.talking) return;
      const now = this.sc.time.now;
      if (voice.busy()) heard = true;
      const el = now - started;
      const over = el >= span;
      const stillVoice = voice.busy() && el < span + 30000;
      if ((over && !stillVoice) || (heard && !voice.busy() && el > 500)) {
        nod.stop();
        this.spr.setAngle(0);
        this.finish(opts.onDone);
        return;
      }
      // where in the line we are (looping if the voice runs long)
      const i = Math.floor(((el % span) / span) * seq.length);
      let m = seq[Math.min(seq.length - 1, i)] ?? M_CLOSED;
      if (m === this.mouth && m === M_OPEN && Math.random() < 0.4) m = M_MID;
      this.show(m);
      this.later(55 + Math.random() * 35, tick, this.talkTimers);
    };
    this.later(opts.delay ?? 0, tick, this.talkTimers);
  }

  private finish(onDone?: () => void) {
    this.talking = false;
    this.show(this.baseMouth);
    // drift back to resting hands a beat after the line
    if (this.pose !== 0 && this.def.poses[this.pose] !== "gun") this.later(380 + Math.random() * 400, () => !this.talking && this.setPose(0), this.timers);
    onDone?.();
  }

  stopTalking() {
    for (const t of this.talkTimers) t.remove();
    this.talkTimers = [];
    this.nod?.stop();
    this.nod = undefined;
    if (this.talking) {
      this.talking = false;
      this.spr.setAngle(0);
      this.show(this.baseMouth);
    }
  }

  get isTalking() {
    return this.talking;
  }

  destroy() {
    this.stopTalking();
    for (const t of this.timers) t.remove();
    this.timers = [];
    this.breath.stop();
    this.spr.destroy();
  }
}

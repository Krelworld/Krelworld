// PHONE MODE: the phone's sound mix (phones only; a laptop never loads this file, so its sound graph is untouched).
// The plan, its numbers and why the sliders come after the compressors: mixLogic.ts.
//
// Every sound path on a phone, and where it joins the mix:
//  - effects, ambience and weather loops, shouts, the distant cackles, Beep Beep's engine: Synth.sfxGain, which went
//    to Synth.master; here sfxGain -> the effects path (Master is applied in its "post").
//  - the chiptune songs: Synth.musicGain, which went to Synth.master; here -> the music path.
//  - recorded songs: the pooled <audio> elements (audio.ts) -> their own gain -> the music path.
//  - voice lines (Voice.ts: a buffer source -> gain -> ctx.destination, or a slowed line's pooled element), layered
//    crowd lines: anything else that connects straight to the speakers of the game's context is a voice. (The game's
//    code is unchanged: AudioNode.connect is wrapped, on phones only, for that one destination.)
//  - the robot voice (speechSynthesis, only for a line with no recording): not Web Audio, so not in the mix; it plays
//    at the system's speech volume, as before.
// Synth.master is left connected but has nothing going into it any more.
import { G } from "../G";
import { synth } from "../audio/Synth";
import { ceilingCurve, mixGains, mixLine, PHONE_MIX, type MixGains, type PhoneMixPlan, type SoundSettings } from "./mixLogic";

export interface MixGraph {
  ctx: BaseAudioContext;
  /** Where each kind of sound joins the mix ("pre": the player's slider taken out). */
  entry: { song: GainNode; chip: GainNode; sfx: GainNode; voice: GainNode };
  /** The slider put back, after each path's compressor. */
  post: { music: GainNode; sfx: GainNode; voice: GainNode };
  comp: { voice: DynamicsCompressorNode; sfx: DynamicsCompressorNode };
  /** The three paths meet here. */
  sum: GainNode;
  ceiling: WaveShaperNode;
  /** On the final output: the diag's and the smoke test's peak reading. */
  meter: AnalyserNode | null;
  /** The mix's own nodes (their connections to the speakers are left alone). */
  own: Set<AudioNode>;
}

/** The phone mix on any context (the game's, or an OfflineAudioContext for measuring), ending at `dest`. Its
 *  slider gains start at the defaults; setGains() sets them. */
export function buildMix(ctx: BaseAudioContext, plan: PhoneMixPlan = PHONE_MIX, dest: AudioNode = ctx.destination, meter = true): MixGraph {
  const own = new Set<AudioNode>();
  const g = (v: number) => {
    const n = ctx.createGain();
    n.gain.value = v;
    own.add(n);
    return n;
  };
  const comp = (p: PhoneMixPlan["comp"]["voice"]) => {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = p.threshold;
    c.knee.value = p.knee;
    c.ratio.value = p.ratio;
    c.attack.value = p.attack;
    c.release.value = p.release;
    own.add(c);
    return c;
  };
  const filter = (type: BiquadFilterType, freq: number, gain = 0, q = 0.707) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.gain.value = gain;
    f.Q.value = q;
    own.add(f);
    return f;
  };
  const entry = { song: g(1), chip: g(1), sfx: g(1), voice: g(1) };
  const post = { music: g(1), sfx: g(1), voice: g(1) };
  const sum = g(1);
  // music: no compressor
  const musicDrive = g(plan.drive.music);
  entry.song.connect(musicDrive);
  entry.chip.connect(musicDrive);
  musicDrive.connect(post.music);
  // effects: drive -> low cut -> compressor
  const sfxComp = comp(plan.comp.sfx);
  entry.sfx.connect(g(plan.drive.sfx)).connect(filter("highpass", plan.lowCut)).connect(sfxComp).connect(post.sfx);
  // voices: drive -> presence -> low cut -> compressor
  const voiceComp = comp(plan.comp.voice);
  entry.voice
    .connect(g(plan.drive.voice))
    .connect(filter("peaking", plan.presence.freq, plan.presence.gain, plan.presence.q))
    .connect(filter("highpass", plan.lowCut))
    .connect(voiceComp)
    .connect(post.voice);
  post.music.connect(sum);
  post.sfx.connect(sum);
  post.voice.connect(sum);
  const ceiling = ctx.createWaveShaper();
  // (no oversampling: its filters could ring a peak back over the ceiling)
  ceiling.curve = ceilingCurve(4097, plan.ceiling, plan.kneeAt) as Float32Array<ArrayBuffer>;
  ceiling.oversample = "none";
  own.add(ceiling);
  sum.connect(ceiling);
  ceiling.connect(dest);
  let m: AnalyserNode | null = null;
  if (meter) {
    m = ctx.createAnalyser();
    m.fftSize = 2048;
    own.add(m);
    ceiling.connect(m);
  }
  const gr: MixGraph = { ctx, entry, post, comp: { voice: voiceComp, sfx: sfxComp }, sum, ceiling, meter: m, own };
  setGains(gr, mixGains({}, plan));
  return gr;
}

/** The slider gains (a short glide on a running context, so a slider step does not click). */
export function setGains(gr: MixGraph, k: MixGains) {
  const t = gr.ctx.currentTime;
  const set = (n: GainNode, v: number) => {
    if (t > 0) {
      n.gain.cancelScheduledValues(t);
      n.gain.setTargetAtTime(v, t, 0.015);
    } else n.gain.value = v;
  };
  set(gr.entry.song, k.song.pre);
  set(gr.entry.chip, k.chip.pre);
  set(gr.entry.sfx, k.sfx.pre);
  set(gr.entry.voice, k.voice.pre);
  set(gr.post.music, k.song.post);
  set(gr.post.sfx, k.sfx.post);
  set(gr.post.voice, k.voice.post);
}

type Bag = Record<string, any>;

/** The game's context gets the mix; Synth's two buses are moved into it; stray speaker connections of that context
 *  become voices. */
export class PhoneMix {
  graph: MixGraph | null = null;
  readonly plan = PHONE_MIX;
  /** Connections redirected so far (for the smoke test). */
  readonly redirected: Record<string, number> = { master: 0, voice: 0 };
  private applied = "";
  /** The mix's own connection to the speakers is being made (leave it alone). */
  private building = false;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const proto = AudioNode.prototype as unknown as Bag;
    if (!proto.__phoneMix) {
      const orig = proto.connect as (...a: unknown[]) => unknown;
      proto.connect = function (this: AudioNode, dest: unknown, ...rest: unknown[]) {
        if (typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode) {
          const to = self.redirect(this, dest);
          if (to) return orig.call(this, to, ...rest);
        }
        return orig.call(this, dest, ...rest);
      };
      proto.__phoneMix = true;
    }
    // a slider change reaches the mix at once (and every quarter second anyway: the Voice slider has no call)
    const s = synth as unknown as Bag;
    const setVolumes = s.setVolumes.bind(synth);
    s.setVolumes = (v: SoundSettings & Bag) => {
      setVolumes(v);
      this.update();
    };
    // a context the game made before this loaded
    this.ensure();
  }

  /** Where a connection to the speakers of the game's context should go instead (null: leave it). */
  private redirect(node: AudioNode, dest: AudioDestinationNode): AudioNode | null {
    const ctx = synth.ctx as BaseAudioContext | null;
    if (this.building || !ctx || dest.context !== ctx) return null;
    const isMaster = node === (synth as unknown as Bag).master;
    const gr = this.ensure(isMaster);
    if (!gr || gr.own.has(node)) return null;
    if (isMaster) {
      // (nothing goes into it any more: its two buses are in the mix)
      this.redirected.master++;
      return gr.sum;
    }
    this.redirected.voice++;
    return gr.entry.voice;
  }

  /** The mix for the game's context, built (and Synth's buses moved into it) the first time it is there.
   *  `connecting`: Synth.master is being connected to the speakers right now (the wrapper sends it elsewhere). */
  ensure(connecting = false): MixGraph | null {
    const ctx = synth.ctx as BaseAudioContext | null;
    if (!ctx) return null;
    if (this.graph && this.graph.ctx === ctx) return this.graph;
    const s = synth as unknown as Bag;
    if (!s.master || !s.musicGain || !s.sfxGain) return null;
    let gr: MixGraph;
    this.building = true;
    try {
      gr = buildMix(ctx, this.plan);
    } finally {
      this.building = false;
    }
    this.graph = gr;
    this.applied = "";
    this.update();
    try {
      (s.musicGain as AudioNode).disconnect();
      (s.musicGain as AudioNode).connect(gr.entry.chip);
      (s.sfxGain as AudioNode).disconnect();
      (s.sfxGain as AudioNode).connect(gr.entry.sfx);
      if (!connecting) {
        try {
          (s.master as AudioNode).disconnect(ctx.destination);
        } catch {
          /* was not connected */
        }
      }
    } catch {
      /* leave whatever is connected */
    }
    return gr;
  }

  /** The player's settings into the mix's slider gains (when they changed). */
  update() {
    const gr = this.graph;
    if (!gr) return;
    const st = (G.meta?.settings ?? {}) as SoundSettings;
    const key = `${st.master}|${st.music}|${st.sfx}|${st.voiceVolume}`;
    if (key === this.applied) return;
    this.applied = key;
    setGains(gr, mixGains(st, this.plan));
  }

  /** Where a routed song or slowed voice element's gain node goes (audio.ts). */
  busNode(kind: "music" | "voice"): AudioNode | null {
    const gr = this.ensure();
    return gr ? (kind === "music" ? gr.entry.song : gr.entry.voice) : null;
  }

  /** The output's peak over the analyser's window (linear). */
  peak(): number | null {
    const m = this.graph?.meter;
    if (!m) return null;
    const buf = new Float32Array(m.fftSize);
    m.getFloatTimeDomainData(buf);
    let p = 0;
    for (const v of buf) p = Math.max(p, Math.abs(v));
    return p;
  }

  /** The compressors' gain reduction now (dB, <= 0). */
  squeeze(): { voice: number | null; sfx: number | null } {
    const r = (c: DynamicsCompressorNode | undefined) => {
      const x = (c as unknown as Bag | undefined)?.reduction;
      return typeof x === "number" ? x : typeof x?.value === "number" ? x.value : null;
    };
    return { voice: r(this.graph?.comp.voice), sfx: r(this.graph?.comp.sfx) };
  }

  line(): string {
    return mixLine(this.plan, this.squeeze(), this.peak());
  }

  /** For the smoke test: how the game's graph is wired and what the slider gains are now. */
  report() {
    const gr = this.graph;
    const v = (n: GainNode) => Math.round(n.gain.value * 1000) / 1000;
    return {
      built: !!gr,
      pre: gr ? { song: v(gr.entry.song), chip: v(gr.entry.chip), sfx: v(gr.entry.sfx), voice: v(gr.entry.voice) } : null,
      post: gr ? { music: v(gr.post.music), sfx: v(gr.post.sfx), voice: v(gr.post.voice) } : null,
      redirected: { ...this.redirected },
    };
  }
}

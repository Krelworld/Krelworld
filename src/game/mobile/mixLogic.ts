// PHONE MODE: the pure rules of the phone's sound mix (mix.ts builds it). Unit-tested. A laptop never loads this.
//
// The user, after playing on their iPhone: "Speech and sound effects are a little quiet on phones." Speech on a laptop
// already peaks near full scale (about -3 dBFS at the default settings), so it can only get louder on a phone if its
// loud moments are held down and the rest brought up: a compressor. A compressor also flattens whatever is turned
// down in front of it, so the player's sliders are applied AFTER it here, and still scale each path exactly as on a
// laptop:
//   each path's sound, with the game's own gains (the duck under dialogue, fades...; a fight's own levels: see `fight`)
//     -> "pre": the player's slider level taken back out (so the compressor always sees the same, full level)
//     -> the path's drive -> voices and effects: a low cut (what a phone speaker cannot play anyway, and what made the
//        compressor work for nothing) and, voices only, a presence lift -> their own compressor (it adds its own
//        make-up gain: the quieter parts of a line come up)
//     -> "post": the slider level put back, times the path's output trim
//   -> all three summed -> a soft ceiling under -1 dBFS (a wave shaper: a straight line below its knee).
// Songs have no compressor (a song alone is already level; nothing pumps); they only sit a little lower.

export type MixBus = "music" | "sfx" | "voice";

export interface CompressorPlan {
  /** dB */
  threshold: number;
  /** dB */
  knee: number;
  ratio: number;
  /** s */
  attack: number;
  /** s */
  release: number;
}

export interface PhoneMixPlan {
  /** Into each path's compressor, after the slider is taken out (1 = the level at 100%). */
  drive: Record<MixBus, number>;
  /** After the compressor, times the slider level (music: its whole change from the laptop). */
  out: Record<MixBus, number>;
  /** The voices' and effects' high-pass (Hz). */
  lowCut: number;
  /** A lift on the voices only (a peaking EQ): the consonants a small speaker blurs. */
  presence: { freq: number; gain: number; q: number };
  comp: Record<"voice" | "sfx", CompressorPlan>;
  /** The soft ceiling's limit (linear). Never above 10^(-1/20) = 0.891 (-1 dBFS). */
  ceiling: number;
  /** Where the ceiling's curve leaves the straight line (linear, below `ceiling`). */
  kneeAt: number;
  /** In a fight scene (the dungeon, the raid: the game turns its effects down and its song up there, for a laptop's
   *  speakers): on a phone both are taken back out in "pre", then the effects get `sfx` more and the song `music`
   *  (x, after the compressors). */
  fight: { sfx: number; music: number };
}

/** The phone mix. Measured offline on the game's own files, "as a phone speaker hears it" (above ~250 Hz; report
 *  s3-08-sound.md): at the default settings speech about 4.5 dB louder on average (its loudest moments, already near
 *  full scale on a laptop, about 2 dB), explosions and gunshots 4-9 dB louder, songs 1.4 dB quieter; nothing above
 *  -1 dBFS even with every slider at 100% (there the ceiling bends about 0.5% of a voice line's samples).
 *  Fights (`fight`): the user then played a dungeon on their phone: "the sound effects were simply very quiet". With
 *  the dungeon's own effects cut and song lift taken out and effects x1.3, gunshots over the dungeon song are heard
 *  2.7 dB under voice lines (they were 5.6 dB under; 12.9 on a laptop); with every slider at 100% the ceiling bends
 *  about 3% of a busy fight's samples (still under -1 dBFS). */
export const PHONE_MIX: PhoneMixPlan = {
  drive: { music: 1, sfx: 2, voice: 3 },
  // (sfx 1.1 -> 0.8, fight 1.3 -> 1.2: the user, after playing it: "Sound effects are now too loud"; about -2.8 dB
  // in town and -3.5 dB in fights, still well above the live build the user found "very quiet")
  out: { music: 0.85, sfx: 0.8, voice: 1.15 },
  lowCut: 110,
  presence: { freq: 3000, gain: 3, q: 0.8 },
  comp: {
    voice: { threshold: -18, knee: 4, ratio: 8, attack: 0.002, release: 0.1 },
    sfx: { threshold: -18, knee: 6, ratio: 6, attack: 0.003, release: 0.15 },
  },
  ceiling: 0.88,
  kneeAt: 0.7,
  fight: { sfx: 1.2, music: 1 },
};

/** -1 dBFS, linear: nothing the phone plays may peak above this. */
export const MAX_PEAK = Math.pow(10, -1 / 20);

export interface SoundSettings {
  master?: number;
  music?: number;
  sfx?: number;
  voiceVolume?: number;
}

const c01 = (v: number | undefined, d: number) => Math.max(0, Math.min(1, typeof v === "number" && Number.isFinite(v) ? v : d));

/** The player's slider level in each path, as the game applies it (Synth.ts / Voice.ts): a song's element volume
 *  (master x music), a voice line's gain (voice x master x 1.25, at most 1), the effects (master x effects; the game's
 *  own 0.6 stays in its bus gain). Defaults as in a new save. */
export function sliderLevels(s: SoundSettings): Record<MixBus, number> {
  const master = c01(s.master, 0.8);
  return {
    music: Math.min(1, master * c01(s.music, 0.5)),
    voice: Math.min(1, c01(s.voiceVolume, 0.8) * master * 1.25),
    sfx: master * c01(s.sfx, 0.8),
  };
}

/** Below this a path is off: pre and post are both 0 (no division by a tiny level). */
export const OFF = 0.001;

export interface PathGains {
  /** Takes the slider back out of a path's signal. */
  pre: number;
  /** Puts it back after the compressor, with the path's output trim. */
  post: number;
}

/** The gains for a path. `inSignal`: the part of the slider already in the game's signal (taken out by pre);
 *  `level`: the whole slider level of the path (put back by post, with the output trim). Off below OFF. */
export function pathGains(inSignal: number, level: number, out: number): PathGains {
  if (!(inSignal > OFF) || !(level > OFF)) return { pre: 0, post: 0 };
  return { pre: 1 / inSignal, post: level * out };
}

export interface MixGains {
  /** Recorded songs (their element volume is master x music, times the game's duck / fade / lift). */
  song: PathGains;
  /** The chiptune songs (Synth.musicGain holds the Music slider; Master came after it and is now in `post`). */
  chip: PathGains;
  /** Effects (Synth.sfxGain holds the Effects slider; Master likewise). */
  sfx: PathGains;
  /** Voice lines (their gain holds voice x master x 1.25, at most 1). */
  voice: PathGains;
}

/** The game's own scene levels (Synth.setSfxScale / setMusicBoost): 1 and 1 outside fights. */
export interface SceneLevels {
  /** The effects' scale (the dungeon: 0.68). */
  sfxScale?: number;
  /** The song's lift (the dungeon 1.35, the raid 1.4; the hub's quiet moment 0.1). */
  musicBoost?: number;
}

/** The part of the game's scene levels a phone takes back out, and whether this is a fight. Only a fight's own
 *  levels count (effects scaled to 0.5-1, a song lifted to 1-2); anything else (the hub's near-silent 0.1) stays in
 *  the signal as on a laptop. */
export function fightLevels(c: SceneLevels = {}): { sfx: number; music: number; fight: boolean } {
  const sc = typeof c.sfxScale === "number" && c.sfxScale >= 0.5 && c.sfxScale < 1 ? c.sfxScale : 1;
  const bo = typeof c.musicBoost === "number" && c.musicBoost > 1 && c.musicBoost <= 2 ? c.musicBoost : 1;
  return { sfx: sc, music: bo, fight: sc < 1 || bo > 1 };
}

/** Every slider-dependent gain of the mix (and the fight's, see PhoneMixPlan.fight). */
export function mixGains(s: SoundSettings, plan: PhoneMixPlan = PHONE_MIX, scene: SceneLevels = {}): MixGains {
  const l = sliderLevels(s);
  const f = fightLevels(scene);
  const fm = f.fight ? plan.fight.music : 1;
  const fs = f.fight ? plan.fight.sfx : 1;
  return {
    // (the song element's level is clamped at 1 by the game: master x music x lift, at most 1; review R2)
    song: pathGains(Math.min(1, l.music * f.music), l.music, plan.out.music * fm),
    chip: pathGains(c01(s.music, 0.5) * f.music, l.music, plan.out.music * fm),
    sfx: pathGains(c01(s.sfx, 0.8) * f.sfx, l.sfx, plan.out.sfx * fs),
    voice: pathGains(l.voice, l.voice, plan.out.voice),
  };
}

/** The soft ceiling's curve for a WaveShaperNode (input -1..1; the node holds anything beyond at the ends): the
 *  identity up to `kneeAt`, then a tanh bend that never reaches `ceiling`. Odd-symmetric and rising. */
export function ceilingCurve(n = 4097, ceiling = PHONE_MIX.ceiling, kneeAt = PHONE_MIX.kneeAt): Float32Array {
  const c = Math.min(ceiling, MAX_PEAK);
  const k = Math.max(0, Math.min(kneeAt, c - 0.01));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= k ? a : k + (c - k) * Math.tanh((a - k) / (c - k));
    out[i] = Math.sign(x) * Math.min(y, c);
  }
  return out;
}

/** dBFS of a linear level (-Infinity at 0), to one decimal. */
export function dbfs(v: number): number {
  return v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : -Infinity;
}

const db = (k: number) => (k > 0 ? `${dbfs(k) >= 0 ? "+" : ""}${dbfs(k)}` : "off");

/** One line for ?mobilediag. */
export function mixLine(plan: PhoneMixPlan, squeeze: { voice: number | null; sfx: number | null }, peak: number | null): string {
  const sq = (v: number | null) => (v === null ? "?" : `${Math.abs(Math.round(v * 10) / 10)}`);
  const pk = peak === null ? "" : ` · peak ${peak > 0 ? `${dbfs(peak)} dBFS` : "silent"}`;
  return `sound mix phone: voice drive ${db(plan.drive.voice)} dB, effects ${db(plan.drive.sfx)} dB, music ${db(plan.out.music)} dB · squeeze now voice ${sq(squeeze.voice)} / effects ${sq(squeeze.sfx)} dB · ceiling ${dbfs(plan.ceiling)} dBFS${pk}`;
}

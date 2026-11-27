// Sound: one crowd bed that changes with where you are, plus one-shot effects and voices.
// Audio can only start after a tap on phones, so nothing loads until unlock().

export const CLIPS = [
  "crowd_loop", "goal_roar", "groan", "boo", "whistle", "whistle_end", "kick", "splat", "punch", "chime", "horn", "flare",
  "tannoy_welcome", "tannoy_pitch", "tannoy_2min", "tannoy_teams", "tannoy_cleaner", "tannoy_flares", "tannoy_lorry",
  "stw_oi", "stw_out", "stw_pal", "stw_coming", "stw_wriggle", "stw_staff",
  "tannoy_welcome_sf", "tannoy_cameras", "tannoy_supervisor", "bark",
  "fire_alarm", "wall_crash", "tannoy_delay_late", "tannoy_delay_ref", "tannoy_delay_pitch", "tannoy_delay_safety", "tannoy_delay_again",
  "tannoy_alarm", "tannoy_breach", "tannoy_forfeit",
  "gunshot", "dog_maul", "scream", "tannoy_incident", "armed_police", "stw_knife",
  "pit_growl", "pit_bark", "pit_gnash",
  "kaching", "bag", "wear", "munch", "gulp", "nope", "tap", "pickup",
  "hit1", "hit2", "hit3", "whoosh", "bodyfall", "weaponhit", "stab", "gasp",
  "chant_eng", "chant_clap", "crowd_ooh", "crowd_jeer", "pub_bed", "siren",
  "hooves", "whinny", "trample", "zip_bin", "drain", "ladder", "swipe", "chute",
  "tannoy_display_off", "tannoy_lenny", "tannoy_lenny_off", "tannoy_card", "tannoy_press", "glass_smash", "chair_smash", "haymaker",
  "tannoy_welcome_final", "tannoy_facerec", "tannoy_detector", "stw_slot", "stw_knob", "stw_odd", "stw_bar", "detector_ok", "detector_alarm",
  "radio_squelch", "head_splat", "heat_alert", "heat_clear", "keg_slip", "keg_roll", "sniff", "heartbeat", "car_alarm", "car_door", "car_crash", "car_kick", "stw_copy", "stw_cover", "stw_cover_dead",
  "alert_sting", "fart", "shop_bell", "door_chime", "desk_bell", "scan_beep", "scan_bad", "turnstile_clunk", "gh_offer", "gh_no", "gh_yes", "gh_rude", "gh_chop", "gh_after", "gh_knock",
  "tannoy_lager", "tannoy_teamnews", "spew", "sewer_gush",
  "pigeon_flap", "gas_whoomph", "barrier_clang", "chalk_scrawl",
] as const;
/** Voiced lines (ElevenLabs stock British voices): what's said -> clip; a woman says the `_f` take. */
import VOICES_JSON from "../../assets/audio/voices.json";
export const VOICES: Record<string, string> = VOICES_JSON as Record<string, string>;
/** The player's own voice: what he shouts when he hits, knocks out, robs, rides, jumps. */
import PC_JSON from "../../assets/audio/pcvoices.json";
/** Voices (his, the crowd's, the phone) sit a touch above the effects so they read over the din. */
const voiceBoost = (name: string) => (/^(pc_|v_)/.test(name) ? 1.25 : 1);
export const PC_LINES: Record<string, [string, string][]> = PC_JSON as unknown as Record<string, [string, string][]>;
export type Clip = (typeof CLIPS)[number] | `v_${string}` | `pc_${string}`;

export class Audio {
  ctx: AudioContext | null = null;
  buffers = new Map<string, AudioBuffer>();
  master!: GainNode;
  crowdGain!: GainNode;
  crowdFilter!: BiquadFilterNode;
  muted = false;
  private tannoyBusyUntil = 0;
  private lastPlayed = new Map<string, number>();

  /** The bus engine: two detuned sawtooths and a square an octave down, through a low-pass,
   *  pitched and opened up by speed (Krelworld's Beep Beep engine). */
  private engine: { oscs: OscillatorNode[]; filt: BiquadFilterNode; gain: GainNode } | null = null;
  engineOn(on: boolean, speed = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && !this.engine) {
      const gain = ctx.createGain(); gain.gain.value = 0.0001;
      const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 400; filt.Q.value = 6;
      const oscs = [0, 7].map((det) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 38; o.detune.value = det; o.connect(filt); o.start(); return o; });
      const sub = ctx.createOscillator(); sub.type = "square"; sub.frequency.value = 19; sub.connect(filt); sub.start(); oscs.push(sub);
      filt.connect(gain).connect(this.master);
      this.engine = { oscs, filt, gain };
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.4);
    }
    const e = this.engine;
    if (!e) return;
    if (!on) {
      this.engine = null;
      e.gain.gain.cancelScheduledValues(ctx.currentTime);
      e.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      e.oscs.forEach((o) => o.stop(ctx.currentTime + 0.6));
      return;
    }
    const k = Math.min(1.3, Math.abs(speed) / 13);
    const base = 32 + k * 70 + Math.sin(ctx.currentTime * 16) * 1.5;
    e.oscs.forEach((o, i) => o.frequency.setTargetAtTime(i === 2 ? base / 2 : base, ctx.currentTime, 0.08));
    e.filt.frequency.setTargetAtTime(300 + k * 1400, ctx.currentTime, 0.1);
    e.gain.gain.setTargetAtTime(0.08 + k * 0.08, ctx.currentTime, 0.2);
  }

  constructor(private base = "audio/") {
    try { this.muted = localStorage.getItem("kd-muted") === "1"; } catch { /* storage may be blocked */ }
  }

  /** Call from a tap. Creates the audio context and starts loading. */
  async unlock(): Promise<void> {
    if (this.ctx) { if (this.ctx.state === "suspended") await this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    // 24 kHz is plenty for these sounds, and every decoded second costs half what it would at 48.
    try { this.ctx = new Ctx({ sampleRate: 24000 }); } catch { this.ctx = new Ctx(); }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.crowdFilter = this.ctx.createBiquadFilter();
    this.crowdFilter.type = "lowpass";
    this.crowdFilter.frequency.value = 800;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0;
    this.crowdFilter.connect(this.crowdGain).connect(this.master);
    // Load the crowd first, the rest after.
    await this.load("crowd_loop");
    this.startCrowd();
    // The effects now. Spoken lines (tannoy, stewards, voices, Grozz) decode the first time they're
    // played: decoded sound is big, and on a phone memory is what runs out.
    await Promise.all(CLIPS.filter((c) => c !== "crowd_loop" && !Audio.spoken(c)).map((c) => this.load(c)));
  }

  private static spoken = (name: string) => /^(tannoy_|stw_|gh_|v_|pc_)/.test(name);

  private loading = new Map<string, Promise<void>>();
  private load(name: string): Promise<void> {
    if (!this.ctx || this.buffers.has(name)) return Promise.resolve();
    let p = this.loading.get(name);
    if (!p) {
      const ctx = this.ctx;
      p = (async () => {
        try {
          const r = await fetch(`${this.base}${name}.mp3`);
          if (!r.ok) return;
          const data = await r.arrayBuffer();
          this.buffers.set(name, await ctx.decodeAudioData(data));
        } catch { /* a missing sound is not worth crashing over */ }
      })();
      this.loading.set(name, p);
    }
    return p;
  }

  private startCrowd(): void {
    const b = this.buffers.get("crowd_loop");
    if (!this.ctx || !b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b; src.loop = true;
    src.connect(this.crowdFilter);
    src.start();
  }

  /** How loud and how muffled the crowd is: 1 in the stands, lower and duller further away. */
  setCrowd(level: number, brightness: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(0.45 * level, t, 0.4);
    this.crowdFilter.frequency.setTargetAtTime(300 + brightness * 12000, t, 0.4);
  }

  /** Play a clip. `muffle` (0..1) dulls it, as heard from outside the ground. */
  play(name: Clip, volume = 1, opts: { muffle?: number; rate?: number; minGap?: number } = {}): number {
    const b = this.buffers.get(name);
    if (!this.ctx || this.muted) return 0;
    if (!b) {
      // Not decoded yet: decode it and play it then, unless that took too long to still make sense.
      const ctx = this.ctx, asked = ctx.currentTime;
      void this.load(name).then(() => { if (this.buffers.has(name) && ctx.currentTime - asked < 1.5) this.play(name, volume, opts); });
      return 0;
    }
    const now = this.ctx.currentTime;
    const gap = opts.minGap ?? 0.12;
    if (now - (this.lastPlayed.get(name) ?? -9) < gap) return 0;
    this.lastPlayed.set(name, now);
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = opts.rate ?? 1;
    const g = this.ctx.createGain();
    g.gain.value = volume * voiceBoost(name);
    if (opts.muffle) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 300 + (1 - opts.muffle) * 8000;
      src.connect(f).connect(g);
    } else src.connect(g);
    g.connect(this.master);
    src.start();
    return b.duration;
  }

  /** Play a clip you can cut off (a phone call hung up mid-sentence). Loads it first if need be. */
  async playCut(name: Clip, volume = 1): Promise<{ dur: number; stop: () => void }> {
    if (!this.ctx || this.muted) return { dur: 0, stop: () => {} };
    if (!this.buffers.has(name)) await this.load(name);
    const b = this.buffers.get(name);
    if (!b || !this.ctx) return { dur: 0, stop: () => {} };
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = b; g.gain.value = volume * voiceBoost(name);
    src.connect(g).connect(this.master);
    src.start();
    return { dur: b.duration, stop: () => { try { src.stop(); } catch { /* already done */ } } };
  }

  // ---------- Music ----------
  /** Under everything: matchday, then the chase or the hiding when it comes to that. Decoded one or
   *  two at a time (a decoded minute of music is big). */
  private tune: { name: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private tunes = new Map<string, AudioBuffer>();
  private wantTune: string | null = null;
  musicVol = 0.3;
  async music(name: string | null, loop = true): Promise<void> {
    if (!this.ctx || this.wantTune === name) return;
    this.wantTune = name;
    const ctx = this.ctx, old = this.tune;
    if (old) {
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      old.src.stop(ctx.currentTime + 2);
      this.tune = null;
    }
    if (!name) return;
    let buf = this.tunes.get(name);
    if (!buf) {
      try {
        const r = await fetch(`${this.base}${name}.mp3`);
        buf = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch { return; }
      // Keep the one we're leaving too (chase music comes and goes), drop anything older.
      for (const k of [...this.tunes.keys()]) if (k !== name && k !== old?.name) this.tunes.delete(k);
      this.tunes.set(name, buf);
    }
    if (this.wantTune !== name) return; // changed our mind while it loaded
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf; src.loop = loop;
    gain.gain.value = 0;
    // Alert music slams in, louder; the calm stuff sits under everything.
    const vol = ({ mus_alert: 0.55, mus_evasion: 0.42, mus_caution: 0.36 } as Record<string, number>)[name] ?? this.musicVol;
    gain.gain.setTargetAtTime(vol, ctx.currentTime, name === "mus_alert" ? 0.08 : 0.5);
    src.connect(gain).connect(this.master);
    src.start();
    this.tune = { name, src, gain };
  }

  /** The tannoy: a chime, then the voice. Announcements never talk over each other. */
  tannoy(name: Clip, volume = 0.9, muffle = 0): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now < this.tannoyBusyUntil) return;
    const voice = this.buffers.get(name);
    if (!voice) { void this.load(name).then(() => { if (this.buffers.has(name) && this.ctx!.currentTime - now < 2) this.tannoy(name, volume, muffle); }); return; }
    const chime = this.play("chime", volume * 0.6, { muffle });
    this.tannoyBusyUntil = now + chime * 0.7 + voice.duration + 0.5;
    window.setTimeout(() => this.play(name, volume, { muffle }), Math.max(0, chime * 700));
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    try { localStorage.setItem("kd-muted", this.muted ? "1" : "0"); } catch { /* ignore */ }
    return this.muted;
  }
}

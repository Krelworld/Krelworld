// Sound: one crowd bed that changes with where you are, plus one-shot effects and voices.
// Audio can only start after a tap on phones, so nothing loads until unlock().

export const CLIPS = [
  "crowd_loop", "goal_roar", "groan", "boo", "whistle", "whistle_end", "kick", "splat", "punch", "chime", "horn", "flare",
  "tannoy_welcome", "tannoy_pitch", "tannoy_2min", "tannoy_teams", "tannoy_cleaner", "tannoy_flares", "tannoy_lorry",
  "stw_oi", "stw_out", "stw_pal", "stw_coming", "stw_wriggle", "stw_staff",
] as const;
export type Clip = (typeof CLIPS)[number];

export class Audio {
  ctx: AudioContext | null = null;
  buffers = new Map<string, AudioBuffer>();
  master!: GainNode;
  crowdGain!: GainNode;
  crowdFilter!: BiquadFilterNode;
  muted = false;
  private tannoyBusyUntil = 0;
  private lastPlayed = new Map<string, number>();

  constructor(private base = "audio/") {
    try { this.muted = localStorage.getItem("kd-muted") === "1"; } catch { /* storage may be blocked */ }
  }

  /** Call from a tap. Creates the audio context and starts loading. */
  async unlock(): Promise<void> {
    if (this.ctx) { if (this.ctx.state === "suspended") await this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
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
    await Promise.all(CLIPS.filter((c) => c !== "crowd_loop").map((c) => this.load(c)));
  }

  private async load(name: string): Promise<void> {
    if (!this.ctx || this.buffers.has(name)) return;
    try {
      const r = await fetch(`${this.base}${name}.mp3`);
      const data = await r.arrayBuffer();
      this.buffers.set(name, await this.ctx.decodeAudioData(data));
    } catch { /* a missing sound is not worth crashing over */ }
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
    if (!this.ctx || !b || this.muted) return 0;
    const now = this.ctx.currentTime;
    const gap = opts.minGap ?? 0.12;
    if (now - (this.lastPlayed.get(name) ?? -9) < gap) return 0;
    this.lastPlayed.set(name, now);
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = opts.rate ?? 1;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    if (opts.muffle) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 300 + (1 - opts.muffle) * 8000;
      src.connect(f).connect(g);
    } else src.connect(g);
    g.connect(this.master);
    src.start();
    return b.duration;
  }

  /** The tannoy: a chime, then the voice. Announcements never talk over each other. */
  tannoy(name: Clip, volume = 0.9, muffle = 0): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now < this.tannoyBusyUntil) return;
    const chime = this.play("chime", volume * 0.6, { muffle });
    const voice = this.buffers.get(name);
    if (!voice) return;
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

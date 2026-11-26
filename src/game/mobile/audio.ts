// PHONE MODE: sound on a phone, iPhone Safari first (phones only; a laptop never loads this file). Rules: audioLogic.ts.
//
// What an iPhone does differently, and what this does about it:
//  - An <audio> element plays only if its first play() came from a tap, and the game makes a new one for every song
//    and for every slowed / sped-up voice line (so a new song waited for the next tap, and a rhythm game's song could
//    start late). Here the game's `new Audio(url)` hands out one of a few elements that were all started (silently)
//    by the first tap: the game's code is unchanged, its songs start the moment it asks.
//  - iOS ignores an element's volume (always full). Each of those elements is routed through its own Web Audio gain
//    node, and the game's `el.volume = x` (the Music slider, the fades, the duck under dialogue, the Voice slider) sets
//    that gain instead. A self-test listens to the first song: if the route is silent (an old WebKit bug), later songs
//    play straight from the element and the slider turns into on / off ("muted", the one thing iOS obeys there).
//  - The ringer switch mutes Web Audio unless the page's audio session says "playback" (iOS 17+): set from the first
//    tap; "Play over my music" (phone settings) makes it "ambient" instead, which mixes with the player's own music.
//  - Coming back after a lock, a call, Siri or an app switch: the shell suspends and resumes the sound (shell.ts); here
//    the context is checked again (it can say "running" and stay silent, or stay "interrupted" after a call) and kicked
//    once more, and the next tap tries again. The reason for the last resume is kept for ?mobilediag.
//  - The phone's own mix (mix.ts): songs a little down, voices and effects up, a gentle compressor and a ceiling under
//    -1 dBFS ("Speech and sound effects are a little quiet on phones"). The routed elements join it here.
//  - Never two songs at once: an element still playing that is neither the game's current song nor fading out is
//    stopped; a song the pause menu holds stays held.
import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { audioKind, isStray, MUSIC_POOL, pickSlot, routeSilent, sessionType, sparesToDrop, VOICE_POOL, volumePlan } from "./audioLogic";
import { PhoneMix } from "./mix";
import { onPhoneSettingsChange, phoneSettings } from "./settings";

type Bag = Record<string, any>;

interface Pooled {
  el: HTMLAudioElement;
  kind: "music" | "voice";
  busy: boolean;
  /** One of the elements the first tap unlocked (the rest are made on the spot when the pool is all in use). */
  pooled: boolean;
  /** The volume the game set (applied to the gain node when routed). */
  vol: number;
  gain: GainNode | null;
  /** Its Web Audio source (disconnected with the gain when a spare is let go: R5). */
  node: MediaElementAudioSourceNode | null;
  listeners: [string, EventListenerOrEventListenerObject, unknown][];
  /** Has played at least once (a spare that played is unlocked, like a pooled one). */
  played: boolean;
  /** Handed out (take) count, and when; when it was last the game's current song (R8). */
  gen: number;
  takenAt: number;
  lastCurrentAt: number;
}

const MEDIA = HTMLMediaElement.prototype;
const desc = (k: string) => Object.getOwnPropertyDescriptor(MEDIA, k) as PropertyDescriptor;
const VOLUME = desc("volume");
const MUTED = desc("muted");
const SRC = desc("src");

/** A tenth of a second of silence (8-bit mono WAV), to start each pooled element from the first tap. */
function silentWav(): string {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const dv = new DataView(b.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, "RIFF");
  dv.setUint32(4, 36 + n, true);
  str(8, "WAVEfmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  str(36, "data");
  dv.setUint32(40, n, true);
  b.fill(128, 44);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return `data:audio/wav;base64,${btoa(s)}`;
}

export interface AudioDiag {
  ctx: string;
  session: string;
  route: "web audio" | "direct (route was silent)" | "waiting for a tap";
  music: number;
  voice: number;
  loops: number;
  lastResume: string;
  resumes: number;
  doubles: number;
  /** The phone mix's one-line read-out (?mobilediag). */
  mix: string;
}

export class PhoneAudio {
  private items: Pooled[] = [];
  private unlocked = false;
  private routeOk = true;
  private tap: AnalyserNode | null = null;
  private readings: number[] = [];
  /** The self-test heard the route (or gave up listening). */
  private tested = false;
  private playedS = 0;
  private lastTick = 0;
  private silent = silentWav();
  private OrigAudio: typeof Audio;
  lastResume = "none yet";
  private lastResumeAt = 0;
  resumes = 0;
  doubles = 0;
  /** The phone's mix (mix.ts): every path of the game's context goes through it. */
  readonly mix = new PhoneMix();

  constructor(
    readonly game: Phaser.Game,
    /** The shell is holding the sound (page hidden, phone upright): leave the context suspended. */
    private held: () => boolean,
  ) {
    this.OrigAudio = window.Audio;
    for (let i = 0; i < MUSIC_POOL; i++) this.items.push(this.make("music", true));
    for (let i = 0; i < VOICE_POOL; i++) this.items.push(this.make("voice", true));
    // the game's `new Audio(url)`: one of the pool's elements (a function that returns an object makes `new` return it)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const PhoneAudioCtor = function (url?: string) {
      return self.take(url);
    } as unknown as typeof Audio;
    (PhoneAudioCtor as unknown as Bag).prototype = this.OrigAudio.prototype;
    (window as unknown as Bag).Audio = PhoneAudioCtor;
    // the first tap (and every tap after: a context an interruption left suspended comes back on the next one)
    const onTap = () => this.gesture("tap");
    document.addEventListener("touchend", onTap, { capture: true, passive: true });
    document.addEventListener("click", onTap, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") window.setTimeout(() => this.check("page shown"), 700);
    });
    window.addEventListener("pageshow", () => window.setTimeout(() => this.check("page shown"), 700));
    onPhoneSettingsChange((s, changed) => {
      if (changed.includes("playOverMyMusic")) this.applySession();
    });
    game.events.on(Phaser.Core.Events.POST_STEP, () => this.tick());
  }

  // ------------------------------------------------------------------ the pool

  private make(kind: "music" | "voice", pooled: boolean, url?: string): Pooled {
    const el = new this.OrigAudio();
    el.preload = "auto";
    const p: Pooled = { el, kind, busy: false, pooled, vol: 1, gain: null, node: null, listeners: [], played: false, gen: 0, takenAt: 0, lastCurrentAt: 0 };
    Object.defineProperty(el, "volume", {
      configurable: true,
      get: () => p.vol,
      set: (v: number) => {
        p.vol = Math.max(0, Math.min(1, Number(v) || 0));
        this.applyVol(p);
      },
    });
    // the game's listeners are remembered, so a reused element starts the next song with none of the last one's
    const add = el.addEventListener.bind(el);
    el.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
      p.listeners.push([type, fn, opts]);
      add(type, fn, opts as AddEventListenerOptions);
    }) as typeof el.addEventListener;
    // free again: a song when the game empties it (Synth.stopFile sets src ""), a voice line when it ends or is stopped
    Object.defineProperty(el, "src", {
      configurable: true,
      get: () => SRC.get!.call(el),
      set: (v: string) => {
        SRC.set!.call(el, v);
        if (!v && p.kind === "music") p.busy = false;
      },
    });
    // (it played: from now on it can play without a tap, pooled or not; the first tap's silent start doesn't count)
    add("playing", () => {
      if (!SRC.get!.call(el).startsWith("data:")) p.played = true;
    });
    if (kind === "voice") {
      const pause = el.pause.bind(el);
      el.pause = () => {
        pause();
        p.busy = false;
      };
      add("ended", () => (p.busy = false));
      // a line that cannot load, or whose play() is refused, frees its element too (R6: it never ends, so it used
      // to stay busy for good, and every later line made a new element)
      add("error", () => (p.busy = false));
      const play = el.play.bind(el);
      el.play = () => {
        const gen = p.gen;
        const r = play();
        if (r && typeof r.catch === "function")
          r.catch(() => {
            if (p.gen === gen && el.paused) p.busy = false;
          });
        return r;
      };
    }
    if (url) SRC.set!.call(el, url);
    this.route(p);
    return p;
  }

  /** `new Audio(url)` from the game: a free pooled element, reset, with this source. */
  private take(url?: string): HTMLAudioElement {
    const kind = audioKind(url);
    // a free element that can play without a tap (pooled, or a spare that has played); once the route proved silent,
    // only one that is not routed (songs and voices: R7), else a new one (the game's own tap fallback starts it)
    const slots = () => this.items.map((x) => ({ kind: x.kind, busy: x.busy, pooled: x.pooled, played: x.played, routed: !!x.gain }));
    const i = pickSlot(slots(), kind, this.routeOk);
    let p = i >= 0 ? this.items[i] : undefined;
    if (!p) {
      p = this.make(kind, false);
      this.items.push(p);
      // (spares: keep the ones that have played, as many as the pool; let the others go, with their Web Audio nodes)
      const drop = new Set(sparesToDrop(slots()));
      const mine = p;
      this.items = this.items.filter((x, k) => {
        if (x === mine || !drop.has(k)) return true;
        this.unroute(x);
        return false;
      });
    }
    p.gen++;
    p.takenAt = performance.now();
    const el = p.el;
    for (const [type, fn, opts] of p.listeners) el.removeEventListener(type, fn, opts as EventListenerOptions);
    p.listeners = [];
    el.onended = null;
    el.onerror = null;
    el.onloadedmetadata = null;
    el.loop = false;
    el.playbackRate = 1;
    el.defaultPlaybackRate = 1;
    (el as Bag).preservesPitch = true;
    p.vol = 1;
    this.applyVol(p);
    p.busy = true;
    if (url) SRC.set!.call(el, url);
    return el;
  }

  /** A spare let go: its nodes are disconnected (they used to stay for good: R5). */
  private unroute(p: Pooled) {
    try {
      p.node?.disconnect();
      p.gain?.disconnect();
    } catch {
      /* already */
    }
    p.node = null;
    p.gain = null;
  }

  /** Through its own gain node (and, for songs, the self-test's listener). Once per element; needs the context. */
  private route(p: Pooled) {
    const ctx = synth.ctx;
    // (once the route proved silent, nothing new goes through it, voices included: R7)
    if (!ctx || p.gain || p.node || !this.routeOk) return;
    try {
      const node = ctx.createMediaElementSource(p.el);
      p.node = node;
      const g = ctx.createGain();
      node.connect(g);
      if (p.kind === "music") {
        if (!this.tap) {
          this.tap = ctx.createAnalyser();
          this.tap.fftSize = 512;
          this.tap.connect(this.mix.busNode("music") ?? ctx.destination);
        }
        g.connect(this.tap);
      } else g.connect(this.mix.busNode("voice") ?? ctx.destination);
      p.gain = g;
    } catch {
      p.gain = null;
    }
    this.applyVol(p);
  }

  private applyVol(p: Pooled) {
    const plan = volumePlan(p.vol, !!p.gain);
    if (p.gain) p.gain.gain.value = plan.gain;
    try {
      VOLUME.set!.call(p.el, plan.elementVolume);
      MUTED.set!.call(p.el, plan.muted);
    } catch {
      /* ignore */
    }
  }

  // ------------------------------------------------------------------ taps, the session, coming back

  private applySession() {
    const s = (navigator as unknown as Bag).audioSession as Bag | undefined;
    if (!s) return;
    try {
      s.type = sessionType(phoneSettings().playOverMyMusic);
    } catch {
      /* not settable */
    }
  }

  private gesture(why: string) {
    try {
      if (!synth.ctx) synth.unlock();
    } catch {
      /* no Web Audio */
    }
    this.applySession();
    if (!this.unlocked && synth.ctx) {
      this.unlocked = true;
      for (const p of this.items) {
        if (!p.pooled || p.busy) continue;
        // a silent start inside the tap: from now on the game's play() on this element just works
        SRC.set!.call(p.el, this.silent);
        p.el.play().then(
          () => {
            if (!p.busy) {
              p.el.pause();
              p.busy = false;
            }
          },
          () => undefined,
        );
      }
    }
    for (const p of this.items) this.route(p);
    const c = synth.ctx;
    if (c && c.state !== "running" && !this.held()) {
      void c.resume().then(() => this.resumed(why), () => undefined);
    }
  }

  private resumed(why: string) {
    this.resumes++;
    this.lastResume = why;
    this.lastResumeAt = performance.now();
  }

  /** After the page comes back: the context must be running AND moving (iPhone can say running and stay silent). */
  private check(why: string) {
    const c = synth.ctx;
    if (!c || this.held() || document.visibilityState === "hidden") return;
    if (c.state !== "running") {
      void c.resume().then(() => this.resumed(why), () => undefined);
      return;
    }
    const t0 = c.currentTime;
    window.setTimeout(() => {
      if (this.held() || c.state !== "running") return;
      if (c.currentTime > t0) {
        if (why !== "tap") this.resumed(why);
        return;
      }
      // stuck: suspend and resume once more (the next tap tries again if this does not take)
      void c
        .suspend()
        .then(() => (this.held() ? undefined : c.resume()))
        .then(() => this.resumed(`${why} (kicked)`), () => undefined);
    }, 300);
  }

  // ------------------------------------------------------------------ every frame (cheap: a few elements)

  private tick() {
    const now = performance.now();
    if (now - this.lastTick < 250) return;
    // the Voice slider has no call of its own: the mix reads the settings here too
    this.mix.update();
    const dt = this.lastTick ? (now - this.lastTick) / 1000 : 0;
    this.lastTick = now;
    const s = synth as unknown as Bag;
    const cur = synth.musicEl();
    const fading = (s.fading as Set<HTMLAudioElement> | undefined) ?? new Set<HTMLAudioElement>();
    for (const p of this.items) {
      if (p.kind !== "music") continue;
      if (p.el === cur) p.lastCurrentAt = now;
      if (p.el.paused) continue;
      // never two songs at once (an old song still in its fade-out, or one just asked for, is not a stray: R8)
      if (isStray({ current: p.el === cur, fading: fading.has(p.el), src: SRC.get!.call(p.el), now, lastCurrentAt: p.lastCurrentAt, takenAt: p.takenAt })) {
        p.el.pause();
        this.doubles++;
      }
    }
    // a song the pause menu (or the shell) holds stays held, whatever started it again
    if (cur && s.musicPaused && !cur.paused) cur.pause();
    // the route's self-test: the first few seconds of real music through it
    if (this.routeOk && this.tap && cur && !cur.paused && synth.ctx?.state === "running") {
      const p = this.items.find((x) => x.el === cur);
      if (p?.gain && p.vol > 0.05 && cur.currentTime > 0.5 && !this.tested) {
        const buf = new Float32Array(this.tap.fftSize);
        this.tap.getFloatTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v));
        this.readings.push(peak);
        this.playedS += dt;
        if (peak >= 1e-4 || this.readings.length > 80) this.tested = true;
        else if (routeSilent(this.readings, this.playedS)) {
          this.tested = true;
          this.routeOk = false;
          // the song restarts from a plain element (the game's own fallback starts it on the next tap if it must)
          const id = synth.currentMusic();
          if (id) synth.music(id, true);
        }
      }
    }
  }

  // ------------------------------------------------------------------ ?mobilediag and the smoke test

  diag(): AudioDiag {
    const c = synth.ctx;
    const loops = Object.values(((synth as unknown as Bag).loops ?? {}) as Record<string, unknown>).filter(Boolean).length;
    const ago = this.lastResumeAt ? ` ${Math.round((performance.now() - this.lastResumeAt) / 1000)}s ago` : "";
    return {
      ctx: c ? c.state : "none yet",
      session: String(((navigator as unknown as Bag).audioSession as Bag | undefined)?.type ?? "n/a"),
      route: !this.routeOk ? "direct (route was silent)" : this.unlocked ? "web audio" : "waiting for a tap",
      music: this.items.filter((p) => p.kind === "music" && !p.el.paused).length,
      voice: this.items.filter((p) => p.kind === "voice" && !p.el.paused).length,
      loops,
      lastResume: `${this.lastResume}${ago}`,
      resumes: this.resumes,
      doubles: this.doubles,
      mix: this.mix.line(),
    };
  }

  /** For the smoke test: the gain the game's current song plays at, and its element's own volume. */
  musicGain(): { gain: number | null; elementVolume: number; muted: boolean; routed: boolean } | null {
    const cur = synth.musicEl();
    const p = this.items.find((x) => x.el === cur);
    if (!p) return null;
    return { gain: p.gain ? p.gain.gain.value : null, elementVolume: VOLUME.get!.call(p.el) as number, muted: MUTED.get!.call(p.el) as boolean, routed: !!p.gain };
  }
}

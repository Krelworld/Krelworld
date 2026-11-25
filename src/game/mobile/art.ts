// PHONE MODE: the phone's texture budget (phones only; a laptop never loads this file). See artLogic.ts for the rules.
//
// The laptop loads every picture at boot and keeps all of them. On a phone the big one-scene pictures (artLogic.ts
// PARKED_ART: the telly's faces, the bosses' sheets, the finisher cinemas, the cutscene stills) are "parked" the moment
// the loader adds them: the texture stays in the game with its key, size and frames (so every scene's code runs as it
// does on a laptop: textures.exists() is true, frames and sizes are right, getSourceImage() has the right width), but
// its pixels are dropped and the GPU holds a 1 x 1 blank instead. The moment something draws it (an Image or Sprite
// renders it) or asks for it (textures.get / getFrame, an animation starts on it), its file is fetched back from the
// browser's cache and decoded off the main thread, and it appears (a few hundred ms at most). Once nothing has drawn or
// asked for it for KEEP_MS and no game object holds it, it is parked again.
//
// The boot's peak falls from about 920 MB to about 320 MB, and normal play stays near that (README, report s3-02).
import Phaser from "phaser";
import { KEEP_MS, parkable, shouldPark, type ArtState } from "./artLogic";

interface Entry {
  key: string;
  url: string;
  state: ArtState;
  w: number;
  h: number;
  /** Last time something drew or asked for it (performance.now()). */
  used: number;
  /** When it was asked for while parked (for the pop-in time). */
  askedAt: number;
  standIn: HTMLCanvasElement | null;
}

type Bag = Record<string, any>;

/** The texture objects the phone parks carry their entry here (so a draw can find it without a lookup). */
const MARK = "__krelPark";

export interface ArtStats {
  parked: number;
  live: number;
  loading: number;
  /** Bytes the parked pictures would take (width x height x 4). */
  savedBytes: number;
  /** Fetched back so far, and the slowest / last time from being asked for to being drawable (ms). */
  streamed: number;
  slowestMs: number;
  lastMs: number;
  /** Fetches that failed (tried again the next time it is asked for). */
  failed: number;
}

export class PhoneArt {
  private entries = new Map<string, Entry>();
  private urls: Record<string, string> = {};
  private blank: HTMLCanvasElement;
  private sweepTimer = 0;
  private stats = { streamed: 0, slowestMs: 0, lastMs: 0, failed: 0 };
  enabled = true;

  constructor(readonly game: Phaser.Game) {
    this.blank = document.createElement("canvas");
    this.blank.width = 1;
    this.blank.height = 1;
    const tm = game.textures as unknown as Bag;
    // every texture the loader adds from now on (the phone chunk normally arrives before the art does)
    tm.on(Phaser.Textures.Events.ADD, (key: string, tex: Phaser.Textures.Texture) => this.adopt(key, tex));
    tm.on(Phaser.Textures.Events.REMOVE, (key: string) => this.entries.delete(key));
    // ...and any that arrived before it
    for (const [key, tex] of Object.entries(tm.list as Record<string, Phaser.Textures.Texture>)) this.adopt(key, tex);
    // asked for: start fetching it back (textures.get is how every add.image / setTexture / anims.create finds it)
    const get = tm.get;
    tm.get = function (this: Bag, key: unknown) {
      const t = get.call(this, key);
      const e = (t as Bag | undefined)?.[MARK] as Entry | undefined;
      // (the boot reads every picture once to set its scale: that is not a use)
      if (e && art.booted()) art.want(e);
      return t;
    };
    const getFrame = tm.getFrame;
    tm.getFrame = function (this: Bag, key: string, frame: unknown) {
      const e = (this.list?.[key] as Bag | undefined)?.[MARK] as Entry | undefined;
      if (e && art.booted()) art.want(e);
      return getFrame.call(this, key, frame);
    };
    // drawn: keep it (or fetch it back if it was parked under an object that kept it: a hidden sprite shown again)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const art = this;
    for (const C of [Phaser.GameObjects.Image, Phaser.GameObjects.Sprite] as unknown as { prototype: Bag }[]) {
      const orig = C.prototype.renderWebGL;
      if (typeof orig !== "function" || orig.__krelPark) continue;
      const wrapped = function (this: Bag, r: unknown, src: Bag, cam: unknown, pm: unknown) {
        const e = src?.texture?.[MARK] as Entry | undefined;
        if (e) art.want(e);
        return orig.call(this, r, src, cam, pm);
      };
      (wrapped as unknown as Bag).__krelPark = true;
      C.prototype.renderWebGL = wrapped;
    }
    // an animation starting: every texture its frames come from (a boss's death sheet on its fighting sprite)
    const AS = (Phaser.Animations as unknown as Bag).AnimationState?.prototype as Bag | undefined;
    if (AS && typeof AS.startAnimation === "function" && !AS.startAnimation.__krelPark) {
      const start = AS.startAnimation;
      const wrapped = function (this: Bag, ...a: unknown[]) {
        const r = start.apply(this, a);
        try {
          const frames = (this.currentAnim?.frames ?? []) as Bag[];
          let last = "";
          for (const f of frames) {
            const k = f.textureKey as string;
            if (k === last) continue;
            last = k;
            const e = art.entries.get(k);
            if (e) art.want(e);
          }
        } catch {
          /* never let this stop an animation */
        }
        return r;
      };
      (wrapped as unknown as Bag).__krelPark = true;
      AS.startAnimation = wrapped;
    }
    // a lost WebGL context comes back with every texture re-made from what it held: fetch the live ones again
    try {
      (game.renderer as unknown as Bag)?.on?.("restorewebgl", () => {
        for (const e of this.entries.values()) if (e.state !== "parked") this.reload(e);
      });
    } catch {
      /* no renderer events */
    }
    this.sweepTimer = window.setInterval(() => this.sweep(), 5000);
  }

  private bootDone = false;
  /** Past the Boot scene (it reads every picture once to set its scale and height; those reads are not uses). */
  booted(): boolean {
    if (this.bootDone) return true;
    try {
      this.bootDone = (this.game.scene.getScenes(true) as Phaser.Scene[]).some((s) => s.sys.settings.key !== "Boot");
    } catch {
      return false;
    }
    return this.bootDone;
  }

  /** The art manifest's file for a key (art/... or a data: URL), read once the manifest is in. */
  private urlOf(key: string): string {
    if (!this.urls.__read) {
      const m = (this.game.cache?.json?.get?.("artmanifest") ?? null) as Bag | null;
      if (m) {
        for (const sec of ["chars", "images", "sheets", "vfx"]) for (const [k, v] of Object.entries((m[sec] ?? {}) as Record<string, Bag>)) if (v?.file) this.urls[k] = v.file.startsWith("data:") ? v.file : `art/${v.file}`;
        this.urls.__read = "1";
      }
    }
    return this.urls[key] ?? "";
  }

  /** A texture the loader added: park it if it is one of the big one-scene pictures. */
  private adopt(key: string, tex: Phaser.Textures.Texture) {
    if (!this.enabled || !parkable(key) || this.entries.has(key)) return;
    const src = (tex as unknown as Bag).source?.[0] as Bag | undefined;
    if (!src || (tex as unknown as Bag).source.length !== 1 || !(src.image instanceof HTMLImageElement) || !src.glTexture) return;
    const url = this.urlOf(key);
    if (!url) return;
    const e: Entry = { key, url, state: "live", w: src.width, h: src.height, used: 0, askedAt: 0, standIn: null };
    this.entries.set(key, e);
    (tex as unknown as Bag)[MARK] = e;
    this.park(e);
  }

  private source(e: Entry): Bag | null {
    const tex = (this.game.textures as unknown as Bag).list?.[e.key] as Bag | undefined;
    return (tex?.source?.[0] as Bag | undefined) ?? null;
  }

  /** Drop its pixels: the GPU holds a 1 x 1 blank; the source reads its real size. */
  private park(e: Entry) {
    const src = this.source(e);
    if (!src) return;
    if (!e.standIn) {
      // a 1 x 1 canvas that says it is the picture's size: code that reads getSourceImage().width gets the real
      // numbers, a pixel read draws nothing (blank, never an error), and no picture-sized buffer is ever made
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      Object.defineProperty(c, "width", { configurable: true, get: () => e.w });
      Object.defineProperty(c, "height", { configurable: true, get: () => e.h });
      e.standIn = c;
    }
    src.image = e.standIn;
    src.source = e.standIn;
    this.upload(src, this.blank);
    e.state = "parked";
  }

  private upload(src: Bag, pixels: CanvasImageSource) {
    const gl = src.glTexture as Bag | null;
    if (!gl || typeof gl.update !== "function") return;
    const w = (pixels as { width: number }).width;
    const h = (pixels as { height: number }).height;
    gl.update(pixels, w, h, gl.flipY, gl.wrapS, gl.wrapT, gl.minFilter, gl.magFilter, gl.format);
  }

  /** Drawn or asked for: keep it, or start fetching it back. */
  want(e: Entry) {
    const now = performance.now();
    e.used = now;
    if (e.state !== "parked") return;
    e.state = "loading";
    e.askedAt = now;
    this.reload(e);
  }

  private reload(e: Entry) {
    const img = new Image();
    img.decoding = "async";
    let done = false;
    const ok = () => {
      if (done) return;
      done = true;
      if (e.state === "parked") return;
      const src = this.source(e);
      if (!src) return;
      src.image = img;
      src.source = img;
      this.upload(src, img);
      e.state = "live";
      e.used = performance.now();
      const ms = Math.round(e.used - e.askedAt);
      this.stats.streamed++;
      this.stats.lastMs = ms;
      this.stats.slowestMs = Math.max(this.stats.slowestMs, ms);
    };
    const fail = () => {
      if (done) return;
      done = true;
      // (could not be fetched: try again the next time it is asked for)
      if (e.state === "loading") e.state = "parked";
      this.stats.failed++;
    };
    img.onerror = fail;
    img.src = e.url;
    if (typeof img.decode === "function") img.decode().then(ok, () => (img.complete && img.naturalWidth ? ok() : fail()));
    else img.onload = ok;
  }

  /** Every texture a game object holds right now (in any scene, shown or not, sleeping or paused). */
  private held(): Set<string> {
    const keys = new Set<string>();
    const walk = (o: Bag, depth: number) => {
      if (!o || depth > 12) return;
      const k = o.texture?.key;
      if (typeof k === "string") keys.add(k);
      const frames = o.anims?.currentAnim?.frames as Bag[] | undefined;
      if (frames) for (const f of frames) if (typeof f.textureKey === "string") keys.add(f.textureKey);
      if (Array.isArray(o.list)) for (const c of o.list) walk(c, depth + 1);
    };
    for (const sc of this.game.scene.scenes as Phaser.Scene[]) {
      const list = (sc.sys?.displayList as unknown as Bag | undefined)?.list as Bag[] | undefined;
      if (list) for (const o of list) walk(o, 0);
    }
    return keys;
  }

  /** Park whatever nothing has drawn or asked for in KEEP_MS (and no object holds). */
  sweep(keepMs = KEEP_MS) {
    const now = performance.now();
    let held: Set<string> | null = null;
    for (const e of this.entries.values()) {
      if (e.state !== "live" || now - e.used < keepMs) continue;
      held ??= this.held();
      if (shouldPark(e.state, e.used, now, held.has(e.key), keepMs)) this.park(e);
    }
  }

  isParked(key: string): boolean {
    return this.entries.get(key)?.state === "parked";
  }

  /** Bytes the textures really hold now (parked ones count nothing), and how many. */
  resident(): { count: number; bytes: number } {
    let count = 0;
    let bytes = 0;
    const list = (this.game.textures as unknown as { list: Record<string, Bag> }).list ?? {};
    for (const key of Object.keys(list)) {
      if (key.startsWith("__")) continue;
      count++;
      if (this.isParked(key)) continue;
      for (const s of (list[key].source as Bag[]) ?? []) bytes += Math.max(0, s.width || 0) * Math.max(0, s.height || 0) * 4;
    }
    return { count, bytes };
  }

  report(): ArtStats {
    let parked = 0;
    let live = 0;
    let loading = 0;
    let savedBytes = 0;
    for (const e of this.entries.values()) {
      if (e.state === "parked") {
        parked++;
        savedBytes += e.w * e.h * 4;
      } else if (e.state === "live") live++;
      else loading++;
    }
    return { parked, live, loading, savedBytes, ...this.stats };
  }

  stop() {
    window.clearInterval(this.sweepTimer);
  }
}

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
import { family, HOLD_MAX_MS, HOLD_SCENES, KEEP_MS, offlineCacheName, parkable, retryDelay, shouldPark, type ArtState } from "./artLogic";

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
  /** Failed fetches in a row, and when it may be tried again (R2: never on every frame). */
  fails: number;
  retryAt: number;
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
  /** Fetches that failed (tried again after 2, 4, 8 ... 30 s). */
  failed: number;
  /** The offline copy (R2): pictures kept in the phone's CacheStorage, of how many; "off" where there is none. */
  offline: { stored: number; total: number; state: string; error: string };
  /** Reloads served from the offline copy (no network). */
  fromCopy: number;
  /** Overlays held back until their pictures were in (R4), and the longest hold (ms). */
  holds: number;
  longestHoldMs: number;
}

export class PhoneArt {
  private entries = new Map<string, Entry>();
  private urls: Record<string, string> = {};
  private blank: HTMLCanvasElement;
  private sweepTimer = 0;
  private stats = { streamed: 0, slowestMs: 0, lastMs: 0, failed: 0, fromCopy: 0, holds: 0, longestHoldMs: 0 };
  /** The offline copy: its cache's name, the art files in it (absolute URLs), and files waiting to go in. */
  private copyName = "";
  private copied = new Set<string>();
  private copyQueue: { url: string; blob: Blob | null }[] = [];
  private copyBusy = false;
  private copyState = "waiting";
  /** The last error putting a file in the copy (for ?mobilediag and tests). */
  private copyErr = "";
  /** Loader downloads waiting in the queue (a few at most: the rest are read back from the browser's cache later). */
  private queuedBlobs = 0;
  private copyTried = new Set<string>();
  private copyPauseUntil = 0;
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
    // the loader's own download of each parked picture goes into the offline copy (no second download)
    const IF = (Phaser.Loader.FileTypes as unknown as Bag).ImageFile?.prototype as Bag | undefined;
    if (IF && typeof IF.onProcess === "function" && !IF.onProcess.__krelPark) {
      const proc = IF.onProcess;
      const wrapped = function (this: Bag, ...a: unknown[]) {
        try {
          const blob = this.xhrLoader?.response;
          if (art.enabled && typeof this.key === "string" && parkable(this.key) && typeof Blob !== "undefined" && blob instanceof Blob) art.offerBlob(this.key, blob);
        } catch {
          /* never let this stop the loader */
        }
        return proc.apply(this, a);
      };
      (wrapped as unknown as Bag).__krelPark = true;
      IF.onProcess = wrapped;
    }
    // the VS card and the finisher close-up wait (a moment at most) for their pictures, instead of opening blank (R4)
    const sm = game.scene as unknown as Bag;
    if (typeof sm.create === "function" && !sm.create.__krelPark) {
      const create = sm.create;
      const wrapped = function (this: Bag, scene: Phaser.Scene) {
        const r = create.call(this, scene);
        try {
          if (HOLD_SCENES.includes(scene?.sys?.settings?.key)) art.holdIfBlank(scene);
        } catch {
          /* never stop a scene */
        }
        return r;
      };
      (wrapped as unknown as Bag).__krelPark = true;
      sm.create = wrapped;
    }
    this.sweepTimer = window.setInterval(() => this.sweep(), 5000);
  }

  // ------------------------------------------------------------------ the offline copy (R2)

  private cacheApi(): CacheStorage | null {
    try {
      return typeof caches !== "undefined" && window.isSecureContext ? caches : null;
    } catch {
      return null;
    }
  }

  private abs(url: string): string {
    try {
      return new URL(url, location.href).href;
    } catch {
      return url;
    }
  }

  /** Open this art's copy (named after the manifest), drop older ones, and learn what is in it. */
  private async openCopy(): Promise<Cache | null> {
    const api = this.cacheApi();
    if (!api) return this.copyOff();
    if (!this.copyName) {
      const m = this.game.cache?.json?.get?.("artmanifest");
      if (!m) return null;
      this.copyName = offlineCacheName(JSON.stringify(m));
      try {
        for (const k of await api.keys()) if (k.startsWith("krel-art-") && k !== this.copyName) await api.delete(k);
        const c = await api.open(this.copyName);
        for (const r of await c.keys()) this.copied.add(r.url);
      } catch {
        return this.copyOff();
      }
    }
    try {
      return await api.open(this.copyName);
    } catch {
      return null;
    }
  }

  /** No CacheStorage here (an in-app browser, a private window): no copy; nothing is held for it. */
  private copyOff(): null {
    this.copyState = "off";
    this.copyQueue.length = 0;
    this.queuedBlobs = 0;
    return null;
  }

  /** Put the queued files into the copy, one at a time (the loader's blobs first; else from the browser's cache). */
  private async pump() {
    if (this.copyBusy || this.copyState === "off" || this.copyState === "full") return;
    this.copyBusy = true;
    try {
      const c = await this.openCopy();
      if (!c) return;
      this.copyState = "filling";
      for (;;) {
        const job = this.copyQueue.shift();
        if (!job) break;
        if (job.blob) this.queuedBlobs--;
        const url = this.abs(job.url);
        if (this.copied.has(url)) continue;
        try {
          let blob = job.blob;
          if (!blob) {
            // (the copy the browser already has, even a stale one: never a second download where it can be avoided)
            let r: Response;
            try {
              r = await fetch(job.url, { cache: "force-cache" });
            } catch {
              // no signal: stop for now, try these again in a minute (not a request a file every few seconds)
              for (const j of [job, ...this.copyQueue]) this.copyTried.delete(j.url);
              this.copyQueue.length = 0;
              this.queuedBlobs = 0;
              this.copyPauseUntil = performance.now() + 60000;
              break;
            }
            if (!r.ok) {
              this.copyErr = `HTTP ${r.status}`;
              continue;
            }
            blob = await r.blob();
          }
          await c.put(url, new Response(blob, { headers: { "Content-Type": blob.type || "image/png" } }));
          this.copied.add(url);
        } catch (err) {
          this.copyErr = String((err as { message?: string })?.message ?? err).slice(0, 120);
          if ((err as { name?: string })?.name === "QuotaExceededError") {
            this.copyState = "full";
            this.copyQueue.length = 0;
            this.queuedBlobs = 0;
            return;
          }
        }
        // (a breath between files: this never competes with the game)
        await new Promise((r) => window.setTimeout(r, 30));
      }
      // ("done" once every parked picture is in; until then the sweep adds the rest as the loader adds them)
      this.copyState = this.copied.size >= this.copyTotal() ? "done" : "waiting";
    } finally {
      this.copyBusy = false;
    }
  }

  /**
   * The loader just downloaded a parked picture: straight into the copy (no second download). Only a few are held
   * waiting at once (memory at boot is what parking is for); the rest are read back from the browser's cache later.
   */
  offerBlob(key: string, blob: Blob) {
    const url = this.urlOf(key);
    if (!url || url.startsWith("data:") || this.queuedBlobs >= 6 || this.copyState === "off" || this.copyState === "full") return;
    this.queuedBlobs++;
    this.copyQueue.push({ url, blob });
    void this.pump();
  }

  private copyTotal(): number {
    let n = 0;
    for (const e of this.entries.values()) if (!e.url.startsWith("data:")) n++;
    return n;
  }

  /** Queue every parked picture the copy hasn't got (each tried once a visit), once the boot is over. */
  fillCopy() {
    if (this.copyBusy || this.copyQueue.length || this.copyState === "off" || this.copyState === "full" || performance.now() < this.copyPauseUntil || !this.booted()) return;
    for (const e of this.entries.values()) {
      if (e.url.startsWith("data:") || this.copyTried.has(e.url) || this.copied.has(this.abs(e.url))) continue;
      this.copyTried.add(e.url);
      this.copyQueue.push({ url: e.url, blob: null });
    }
    if (this.copyQueue.length) void this.pump();
  }

  // ------------------------------------------------------------------ holding an overlay for its pictures (R4)

  /** A VS card or finisher close-up whose pictures are still parked: paused (drawn as it is) until they are in. */
  holdIfBlank(scene: Phaser.Scene) {
    const waiting: Entry[] = [];
    const seen = new Set<string>();
    const visit = (o: Bag, depth: number) => {
      if (!o || depth > 12) return;
      const keys: string[] = [];
      if (typeof o.texture?.key === "string") keys.push(o.texture.key);
      for (const f of (o.anims?.currentAnim?.frames as Bag[] | undefined) ?? []) if (typeof f.textureKey === "string") keys.push(f.textureKey);
      for (const k of keys) {
        if (seen.has(k)) continue;
        seen.add(k);
        const e = this.entries.get(k);
        if (e && e.state !== "live") {
          this.want(e);
          waiting.push(e);
        }
      }
      if (Array.isArray(o.list)) for (const c of o.list) visit(c, depth + 1);
    };
    for (const o of ((scene.sys.displayList as unknown as Bag)?.list as Bag[]) ?? []) visit(o, 0);
    if (!waiting.length) return;
    const t0 = performance.now();
    scene.sys.pause();
    this.stats.holds++;
    const check = () => {
      const ms = performance.now() - t0;
      const ready = waiting.every((e) => e.state === "live" || (e.state === "parked" && e.fails > 0));
      if (!ready && ms < HOLD_MAX_MS && scene.sys.isPaused()) {
        window.setTimeout(check, 16);
        return;
      }
      this.stats.longestHoldMs = Math.max(this.stats.longestHoldMs, Math.round(ms));
      if (scene.sys.isPaused() && scene.sys.settings.status !== Phaser.Scenes.SHUTDOWN) scene.sys.resume();
    };
    window.setTimeout(check, 16);
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
    const e: Entry = { key, url, state: "live", w: src.width, h: src.height, used: 0, askedAt: 0, standIn: null, fails: 0, retryAt: 0 };
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

  /** Drawn or asked for: keep it (and its family: a boss's other sheets, R3), or start fetching it back. */
  want(e: Entry, kin = true) {
    const now = performance.now();
    e.used = now;
    if (kin)
      for (const k of family(e.key)) {
        const f = this.entries.get(k);
        if (f) this.want(f, false);
      }
    if (e.state !== "parked" || now < e.retryAt) return;
    e.state = "loading";
    e.askedAt = now;
    this.reload(e);
  }

  private reload(e: Entry) {
    const url = this.abs(e.url);
    if (this.copied.has(url) && this.copyName && this.cacheApi()) {
      // (from the phone's own copy: no network, so it works with no signal and never waits on a revalidation)
      (this.cacheApi() as CacheStorage)
        .open(this.copyName)
        .then((c) => c.match(url))
        .then((r) => (r ? r.blob() : null))
        .then(
          (b) => {
            if (!b) {
              this.copied.delete(url);
              return this.load(e, e.url, null);
            }
            this.stats.fromCopy++;
            const obj = URL.createObjectURL(b);
            this.load(e, obj, obj);
          },
          () => this.load(e, e.url, null),
        );
      return;
    }
    this.load(e, e.url, null);
  }

  private load(e: Entry, from: string, objectUrl: string | null) {
    const img = new Image();
    img.decoding = "async";
    let done = false;
    const ok = () => {
      if (done) return;
      done = true;
      if (e.state === "parked") return;
      const src = this.source(e);
      if (!src) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      src.image = img;
      src.source = img;
      this.upload(src, img);
      e.state = "live";
      e.fails = 0;
      e.retryAt = 0;
      e.used = performance.now();
      this.refreshTiles(e.key);
      const ms = Math.round(e.used - e.askedAt);
      this.stats.streamed++;
      this.stats.lastMs = ms;
      this.stats.slowestMs = Math.max(this.stats.slowestMs, ms);
    };
    const fail = () => {
      if (done) return;
      done = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      // (could not be fetched: tried again after a pause that grows, not on the next draw: R2)
      if (e.state === "loading") e.state = "parked";
      e.fails++;
      e.retryAt = performance.now() + retryDelay(e.fails);
      this.stats.failed++;
    };
    img.onerror = fail;
    img.src = from;
    if (typeof img.decode === "function") img.decode().then(ok, () => (img.complete && img.naturalWidth ? ok() : fail()));
    else img.onload = ok;
  }

  /**
   * A TileSprite copies its picture into its own canvas when it is made (Phaser 3.90), so one made while its picture
   * was parked would stay blank for good (R1: the kart track in the Mario Kart clip): copy it again now.
   */
  private refreshTiles(key: string) {
    const walk = (o: Bag, depth: number) => {
      if (!o || depth > 12) return;
      // (its own texture is a canvas of its own; the picture it tiles is its displayTexture)
      if (o.type === "TileSprite" && o.displayTexture?.key === key && typeof o.updateTileTexture === "function") {
        try {
          o.dirty = true;
          o.updateTileTexture();
        } catch {
          /* skip */
        }
      }
      if (Array.isArray(o.list)) for (const c of o.list) walk(c, depth + 1);
    };
    for (const sc of this.game.scene.scenes as Phaser.Scene[]) for (const o of ((sc.sys?.displayList as unknown as Bag | undefined)?.list as Bag[] | undefined) ?? []) walk(o, 0);
  }

  /** Every texture a game object holds right now (in any scene, shown or not, sleeping or paused). */
  private held(): Set<string> {
    const keys = new Set<string>();
    const walk = (o: Bag, depth: number) => {
      if (!o || depth > 12) return;
      const k = o.texture?.key;
      if (typeof k === "string") keys.add(k);
      // (a TileSprite tiles its displayTexture)
      const dk = o.displayTexture?.key;
      if (typeof dk === "string") keys.add(dk);
      const frames = o.anims?.currentAnim?.frames as Bag[] | undefined;
      if (frames) for (const f of frames) if (typeof f.textureKey === "string") keys.add(f.textureKey);
      if (Array.isArray(o.list)) for (const c of o.list) walk(c, depth + 1);
    };
    for (const sc of this.game.scene.scenes as Phaser.Scene[]) {
      const list = (sc.sys?.displayList as unknown as Bag | undefined)?.list as Bag[] | undefined;
      if (list) for (const o of list) walk(o, 0);
    }
    // (a boss's sheets are held together while any of them is: R3)
    for (const k of [...keys]) for (const f of family(k)) keys.add(f);
    return keys;
  }

  /** Park whatever nothing has drawn or asked for in KEEP_MS (and no object holds). */
  sweep(keepMs = KEEP_MS) {
    // (the offline copy catches up with whatever the loader added since: from the browser's cache, a file at a time)
    this.fillCopy();
    const now = performance.now();
    let held: Set<string> | null = null;
    for (const e of this.entries.values()) {
      if (e.state !== "live" || now - e.used < keepMs) continue;
      held ??= this.held();
      if (shouldPark(e.state, e.used, now, held.has(e.key), keepMs)) this.park(e);
    }
  }

  /** Is this picture in the offline copy (it can come back with no signal)? */
  inCopy(key: string): boolean {
    const e = this.entries.get(key);
    return !!e && this.copied.has(this.abs(e.url));
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
    const total = this.copyTotal();
    return { parked, live, loading, savedBytes, ...this.stats, offline: { stored: this.copied.size, total, state: this.copyState, error: this.copyErr } };
  }

  stop() {
    window.clearInterval(this.sweepTimer);
  }
}

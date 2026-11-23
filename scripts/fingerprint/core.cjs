// Desktop fingerprint: the browser side. One Session = one fresh browser context + page on the dev server, in a
// DESKTOP profile, with everything that could make two runs differ pinned down:
//   - time: Playwright's fake clock, paused. The game only moves when the harness steps a 16 ms frame.
//   - Math.random: a seeded generator (re-seeded when a state starts).
//   - storage: a new context, so localStorage starts empty.
//   - sound: no audio is fetched or played. <audio> elements and the AudioContext clock run on the fake clock.
//   - the network: after every frame the harness waits until nothing is loading before stepping the next one.
// None of this lives in the game: it is installed by an init script from here, and only in this harness.
const { chromium } = require("playwright");

const VIEW = { width: 1280, height: 720 };
/** A normal desktop Chrome on Windows (the headless default says "HeadlessChrome"). */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const STEP = 16;
/** The fake clock: where it starts, and the fixed moment every state starts from once the game has booted. */
const CLOCK_START = new Date("2026-03-14T15:00:00Z").getTime();
const CLOCK_PIN = CLOCK_START + 30 * 60 * 1000;
/** performance.now() at that fixed moment (a multiple of 16: a frame boundary). Loading never takes this long. */
const PIN_TICK = 1800000;
const SEED = 0x4b52454c;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * --profile: the devices the phone detection decides about, which must keep today's game exactly (a touchscreen
 * laptop, an iPad, an Android tablet, a 7-inch Fire tablet). Each is the laptop session with the device's screen,
 * touch points, user agent and pointer / hover answers. The window stays 1280x720 so the states line up with the
 * laptop's; only what the detection reads changes. Baselines: tests/fingerprints/profiles/<name>/ (recorded on the
 * source from before the phone work).
 */
const WIN_UA = UA;
const PROFILES = {
  touchlaptop: { ctx: { hasTouch: true, userAgent: WIN_UA, screen: { width: 1280, height: 720 } }, media: { pointer: "fine", hover: "hover", anyPointer: "coarse", anyHover: "hover" }, tp: 10 },
  ipad: { ctx: { hasTouch: true, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", screen: { width: 820, height: 1180 } }, media: { pointer: "coarse", hover: "none", anyPointer: "coarse", anyHover: "none" }, tp: 5 },
  androidtab: { ctx: { hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", screen: { width: 800, height: 1280 } }, media: { pointer: "coarse", hover: "none", anyPointer: "coarse", anyHover: "none" }, tp: 10 },
  fire7: { ctx: { hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 9; KFMUWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/124.2.1 like Chrome/124.0.0.0 Safari/537.36", screen: { width: 600, height: 1024 } }, media: { pointer: "coarse", hover: "none", anyPointer: "coarse", anyHover: "none" }, tp: 10 },
};

/** Runs in the page first, for a --profile: the device's pointer / hover answers and touch points. */
function profileInit(o) {
  const real = window.matchMedia.bind(window);
  const m = o.media;
  window.matchMedia = function (q) {
    const s = String(q).replace(/\s+/g, "").toLowerCase();
    let x;
    let a = null;
    if ((x = /^\(any-pointer:(\w+)\)$/.exec(s))) a = m.anyPointer === x[1];
    else if ((x = /^\(pointer:(\w+)\)$/.exec(s))) a = m.pointer === x[1];
    else if ((x = /^\(any-hover:(\w+)\)$/.exec(s))) a = m.anyHover === x[1];
    else if ((x = /^\(hover:(\w+)\)$/.exec(s))) a = m.hover === x[1];
    const mq = real(q);
    if (a === null) return mq;
    return new Proxy(mq, { get: (t, k) => (k === "matches" ? a : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  };
  Object.defineProperty(Navigator.prototype, "maxTouchPoints", { get: () => o.tp, configurable: true });
}

/** Runs in the page before any of its own scripts. `seed` is the Math.random seed. */
function initScript(seed) {
  const fp = (window.__fp = { pend: 0, seed0: seed });
  // ---- globals that exist before the page runs (so the dump can list what the page added)
  fp.baseGlobals = new Set(Object.getOwnPropertyNames(window));

  // ---- Math.random: mulberry32, re-seedable
  let s = seed | 0;
  fp.reseed = (n) => {
    s = n | 0;
  };
  Math.random = function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- listeners: every addEventListener / removeEventListener call, counted by target and event type
  fp.listeners = { add: {}, remove: {} };
  const targetName = (t) => {
    if (t === window) return "window";
    if (t === document) return "document";
    if (t === document.documentElement) return "html";
    if (t === document.body) return "body";
    if (t && t.tagName) return t.tagName.toLowerCase() + (t.id ? "#" + t.id : "");
    return (t && t.constructor && t.constructor.name) || "?";
  };
  const sig = (type, o) => {
    const cap = typeof o === "boolean" ? o : !!(o && o.capture);
    const passive = o && typeof o === "object" && "passive" in o ? (o.passive ? " passive" : " active") : "";
    const once = o && typeof o === "object" && o.once ? " once" : "";
    return type + (cap ? " capture" : "") + passive + once;
  };
  const count = (bag, t, k) => {
    if (t && t.__fpStub) return;
    const n = targetName(t);
    (bag[n] = bag[n] || {})[k] = (bag[n][k] || 0) + 1;
  };
  const add = EventTarget.prototype.addEventListener;
  const rem = EventTarget.prototype.removeEventListener;
  fp.quiet = 0;
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if (!fp.quiet && fn) count(fp.listeners.add, this, sig(type, o));
    return add.call(this, type, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, o) {
    if (!fp.quiet && fn) count(fp.listeners.remove, this, sig(type, o));
    return rem.call(this, type, fn, o);
  };
  /** The harness's own listeners are not the game's: don't count them. */
  const quietly = (f) => {
    fp.quiet++;
    try {
      return f();
    } finally {
      fp.quiet--;
    }
  };

  // ---- localStorage: which keys get written or removed
  fp.storage = { set: {}, remove: {} };
  const setItem = Storage.prototype.setItem;
  const removeItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage && k !== "__krel_probe") fp.storage.set[k] = (fp.storage.set[k] || 0) + 1;
    return setItem.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === window.localStorage && k !== "__krel_probe") fp.storage.remove[k] = (fp.storage.remove[k] || 0) + 1;
    return removeItem.call(this, k);
  };

  // ---- Vite's hot-reload socket: never connects (a reload mid-run would ruin everything)
  const RealWS = window.WebSocket;
  window.WebSocket = function (url, p) {
    if (/localhost|127\.0\.0\.1/.test(String(url))) {
      const o = new EventTarget();
      o.__fpStub = true;
      o.readyState = 0;
      o.send = () => {};
      o.close = () => {};
      return o;
    }
    return new RealWS(url, p);
  };

  // ---- loading: count everything in flight, so the harness can wait for "nothing loading" between frames
  const track = (p) => {
    fp.pend++;
    const done = () => {
      fp.pend--;
    };
    Promise.resolve(p).then(done, done);
    return p;
  };
  const realFetch = window.fetch;
  window.fetch = function (...a) {
    return track(realFetch.apply(this, a));
  };
  for (const m of ["arrayBuffer", "json", "blob", "text"]) {
    const orig = Response.prototype[m];
    Response.prototype[m] = function () {
      return track(orig.call(this));
    };
  }
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...a) {
    fp.pend++;
    quietly(() => add.call(this, "loadend", () => fp.pend--, { once: true }));
    return send.apply(this, a);
  };
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    enumerable: true,
    get() {
      return srcDesc.get.call(this);
    },
    set(v) {
      if (!this.__fpLoading) {
        this.__fpLoading = true;
        fp.pend++;
        const done = () => {
          if (this.__fpLoading) {
            this.__fpLoading = false;
            fp.pend--;
          }
        };
        add.call(this, "load", done, { once: true });
        add.call(this, "error", done, { once: true });
      }
      srcDesc.set.call(this, v);
    },
  });
  if (window.createImageBitmap) {
    const cib = window.createImageBitmap;
    window.createImageBitmap = function (...a) {
      return track(cib.apply(this, a));
    };
  }
  if (window.FontFace) {
    const load = FontFace.prototype.load;
    FontFace.prototype.load = function () {
      return track(load.call(this));
    };
  }

  // ---- sound: nothing is fetched, nothing plays, and every clock is the fake one.
  // <audio>: play / pause / currentTime behave like a track of unknown length playing on the fake clock.
  fp.audio = { created: [], contexts: 0 };
  const M = HTMLMediaElement.prototype;
  const st = new WeakMap();
  const S = (el) => {
    let v = st.get(el);
    if (!v) st.set(el, (v = { playing: false, base: 0, t0: 0, src: "" }));
    return v;
  };
  const pos = (el) => {
    const v = S(el);
    return v.playing ? v.base + ((performance.now() - v.t0) / 1000) * (el.playbackRate || 1) : v.base;
  };
  M.play = function () {
    const v = S(this);
    if (!v.playing) {
      v.playing = true;
      v.t0 = performance.now();
    }
    return Promise.resolve();
  };
  M.pause = function () {
    const v = S(this);
    v.base = pos(this);
    v.playing = false;
  };
  M.load = function () {};
  Object.defineProperty(M, "paused", { configurable: true, get() { return !S(this).playing; } });
  Object.defineProperty(M, "ended", { configurable: true, get() { return false; } });
  Object.defineProperty(M, "duration", { configurable: true, get() { return NaN; } });
  Object.defineProperty(M, "currentTime", {
    configurable: true,
    get() {
      return pos(this);
    },
    set(x) {
      const v = S(this);
      v.base = +x || 0;
      v.t0 = performance.now();
    },
  });
  Object.defineProperty(M, "src", {
    configurable: true,
    get() {
      return S(this).src;
    },
    set(x) {
      S(this).src = String(x);
    },
  });
  fp.audio.state = (el) => ({ src: S(el).src, playing: S(el).playing });
  window.Audio = function (src) {
    const el = document.createElement("audio");
    if (src !== undefined) el.src = src;
    fp.audio.created.push(el);
    return el;
  };
  window.Audio.prototype = M;
  // Web Audio: the real context (muted by the browser flags), at a fixed sample rate, with its clock on the fake clock
  // (the music sequencer schedules notes against it, and draws random numbers as it goes).
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const Real = window[name];
    if (!Real) continue;
    window[name] = class extends Real {
      constructor(o) {
        super({ ...(o || {}), sampleRate: 44100 });
        fp.audio.contexts++;
        this.__t0 = performance.now();
      }
      get currentTime() {
        return (performance.now() - this.__t0) / 1000;
      }
    };
  }
  // no text-to-speech: the voice code then never reports itself busy
  try {
    delete window.speechSynthesis;
    if ("speechSynthesis" in window) Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
  } catch (e) {
    /* leave it */
  }
  // pointer lock: headless Chromium can refuse or delay it from run to run. Pin it down: a request locks at once
  // (the "pointerlockchange" event goes out on the next fake frame), exitPointerLock lets go.
  fp.lock = null;
  const plc = () => document.dispatchEvent(new Event("pointerlockchange"));
  Element.prototype.requestPointerLock = function () {
    fp.lock = this;
    requestAnimationFrame(plc);
    return Promise.resolve();
  };
  Document.prototype.exitPointerLock = function () {
    if (!fp.lock) return;
    fp.lock = null;
    requestAnimationFrame(plc);
  };
  Object.defineProperty(Document.prototype, "pointerLockElement", { configurable: true, get() { return fp.lock; } });
}

class Session {
  /**
   * @param {import('playwright').Browser} browser
   * @param {{ url: string, log?: (s: string) => void }} o
   */
  constructor(browser, o) {
    this.browser = browser;
    this.url = o.url;
    this.profile = o.profile ? PROFILES[o.profile] : null;
    if (o.profile && !this.profile) throw new Error(`no profile "${o.profile}" (${Object.keys(PROFILES).join(", ")})`);
    this.log = o.log || (() => {});
    this.inflight = new Set();
    this.errors = [];
    this.frame = 0;
    this.mouse = { x: 0, y: 0 };
  }

  async open() {
    this.ctx = await this.browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, hasTouch: false, isMobile: false, userAgent: UA, locale: "en-GB", timezoneId: "UTC", colorScheme: "dark", reducedMotion: "no-preference", ...(this.profile ? this.profile.ctx : {}) });
    if (this.profile) await this.ctx.addInitScript(profileInit, { media: this.profile.media, tp: this.profile.tp });
    this.page = await this.ctx.newPage();
    const page = this.page;
    page.setDefaultTimeout(180000);
    page.on("pageerror", (e) => this.errors.push("pageerror: " + String(e.message).slice(0, 240)));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      // (the harness serves no sound, so "failed to load" for audio is its own doing)
      if (/Failed to load resource/.test(t) && /\/audio\//.test((m.location() || {}).url || "")) return;
      this.errors.push("console: " + t.slice(0, 240));
    });
    page.on("request", (r) => {
      if (!r.url().startsWith("data:") && !r.url().startsWith("blob:")) this.inflight.add(r);
    });
    page.on("requestfinished", (r) => this.inflight.delete(r));
    page.on("requestfailed", (r) => this.inflight.delete(r));
    // no sound files at all (recorded voices, music, effects): the game then takes its built-in "no recording" paths
    // (only the public audio folder: the game's own src/game/audio/*.ts modules must still load)
    await page.route(/^https?:\/\/[^/]+\/audio\//, (route) => route.fulfill({ status: 404, body: "" }));
    await page.addInitScript(initScript, SEED);
    await page.clock.install({ time: CLOCK_START });
    await page.clock.pauseAt(CLOCK_START + 1000);
    // (pauseAt leaves the wall clock a fraction of a millisecond off, a different fraction each run: set it exactly)
    await page.clock.setSystemTime(CLOCK_START + 1000);
    await page.goto(this.url, { waitUntil: "domcontentloaded" });
    await this.boot();
    return this;
  }

  /**
   * Load the game and bring it to the Enter gate at a fixed moment.
   * How long loading takes differs from run to run, so nothing from that time may leak into a state:
   *  1. the page's own scripts run with the clock standing still (main.ts always sees the same Date.now());
   *  2. frames are stepped until the art is in and the Enter gate is up (however many that takes);
   *  3. the clock then jumps to one fixed tick and one fixed date, Math.random is re-seeded, the texture list is put
   *     in name order (it is in arrival order otherwise), and the Enter gate is started afresh.
   */
  async boot() {
    const page = this.page;
    const t0 = Date.now();
    const late = (what) => {
      if (Date.now() - t0 > 240000) throw new Error(`boot: ${what} after 240 s`);
    };
    while (!(await page.evaluate(() => !!window.__krel))) {
      late("the game's scripts had not run");
      await sleep(50);
    }
    for (;;) {
      await page.clock.runFor(STEP);
      const st = await page.evaluate(() => ({ ok: window.__krel.active().includes("Enter"), pend: window.__fp.pend }));
      if (st.ok && !st.pend && this.inflight.size === 0) break;
      late("the game had not reached the Enter gate");
      await sleep(40);
    }
    await this.settle();
    // The fake clock counts in whole ticks (ms; performance.now() reads them) and fires animation frames on
    // multiples of 16. How many ticks loading took is different every run, so jump to one fixed tick (every timer
    // that was waiting fires once there, and repeats from there), then set the wall clock to its fixed moment too.
    // From here every frame of every run sees the same performance.now() and the same Date.now().
    const at = Math.round(await page.evaluate(() => performance.now()));
    if (at >= PIN_TICK) throw new Error(`boot: loading took ${at} fake ms, past the fixed start tick ${PIN_TICK}`);
    // (the wall clock first, so the timers that fire during the jump already read the fixed date)
    await page.clock.setSystemTime(CLOCK_PIN - (PIN_TICK - at));
    await page.clock.fastForward(PIN_TICK - at);
    await page.clock.setSystemTime(CLOCK_PIN);
    const tick = await page.evaluate(() => performance.now());
    if (tick !== PIN_TICK) throw new Error(`boot: the fake clock is at tick ${tick}, not ${PIN_TICK}`);
    await this.settle();
    // a few frames after the jump, so the loop is back on an even 16 ms beat (and anything the jump set off has landed)
    for (let i = 0; i < 12; i++) {
      await page.clock.runFor(STEP);
      await this.settle();
    }
    await page.evaluate((seed) => {
      window.__fp.reseed(seed);
      // The art arrives in whatever order the network delivers it, and that is the order of Phaser's texture list.
      // The game sometimes picks from that list (Beep Beep's pedestrians): put it in name order, so the same random
      // number picks the same picture every run.
      const tm = window.__krel.game.textures;
      const sorted = {};
      for (const key of Object.keys(tm.list).sort()) sorted[key] = tm.list[key];
      tm.list = sorted;
      window.__krel.game.scene.getScene("Enter").scene.restart();
    }, SEED);
    this.bootMs = Date.now() - t0;
    this.frame = 0;
    await this.frames(2);
  }

  /** Wait (real time) until nothing is loading: no request in flight and no tracked promise pending. */
  async settle() {
    const page = this.page;
    let waited = false;
    const t0 = Date.now();
    for (;;) {
      if (this.inflight.size === 0) {
        const p = await page.evaluate(() => window.__fp.pend);
        if (!p) {
          if (!waited) return;
          // something just finished: give its continuations a moment, then look again
          await sleep(6);
          if (this.inflight.size === 0 && !(await page.evaluate(() => window.__fp.pend))) return;
        }
      }
      waited = true;
      if (Date.now() - t0 > 120000) throw new Error(`settle: still loading after 120 s (${this.inflight.size} requests: ${[...this.inflight].slice(0, 3).map((r) => r.url().slice(-60)).join(", ")})`);
      await sleep(5);
    }
  }

  /** Step n game frames (16 ms each on the fake clock), waiting for loading to finish after each. */
  async frames(n = 1) {
    for (let i = 0; i < n; i++) {
      await this.page.clock.runFor(STEP);
      await this.settle();
      this.frame++;
    }
  }

  /** Step frames until `fn` (run in the page) is truthy. Throws after `max` frames. Returns the frames it took. */
  async until(fn, arg, max = 600) {
    for (let i = 0; i < max; i++) {
      if (await this.page.evaluate(fn, arg)) return i;
      await this.frames(1);
    }
    throw new Error("until: gave up after " + max + " frames: " + String(fn).slice(0, 120));
  }

  ev(fn, arg) {
    return this.page.evaluate(fn, arg);
  }

  /** Game coordinates (960x540) to CSS pixels in the window. */
  async toCss(gx, gy) {
    const r = await this.page.evaluate(() => {
      const b = document.querySelector("canvas").getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    return [r.x + (gx * r.w) / 960, r.y + (gy * r.h) / 540];
  }

  async moveTo(gx, gy) {
    const [x, y] = await this.toCss(gx, gy);
    await this.page.mouse.move(x, y);
    this.mouse = { x: gx, y: gy };
    await this.frames(2);
  }

  async mouseDown() {
    await this.page.mouse.down();
    await this.frames(2);
  }

  async mouseUp() {
    await this.page.mouse.up();
    await this.frames(2);
  }

  /** Move there, press, release: a click, with frames in between so the game sees each part. */
  async click(gx, gy) {
    await this.moveTo(gx, gy);
    await this.mouseDown();
    await this.mouseUp();
  }

  async keyDown(k) {
    await this.page.keyboard.down(k);
    await this.frames(1);
  }

  async keyUp(k) {
    await this.page.keyboard.up(k);
    await this.frames(1);
  }

  /** Press a key for `hold` frames. */
  async key(k, hold = 2) {
    await this.page.keyboard.down(k);
    await this.frames(hold);
    await this.page.keyboard.up(k);
    await this.frames(2);
  }

  /**
   * Where a visible, clickable thing is on screen (game coordinates), found by the text on it or beside it in its
   * container. `scene` narrows it to one scene; `nth` picks among several matches (in display order).
   */
  async find(label, o = {}) {
    return this.page.evaluate(
      ({ label, scene, nth, exact }) => {
        const g = window.__krel.game;
        const hits = [];
        const match = (t) => (exact ? t === label : t.includes(label));
        for (const sc of g.scene.getScenes(true)) {
          if (scene && sc.sys.settings.key !== scene) continue;
          const cam = sc.cameras.main;
          const walk = (o, vis) => {
            const v = vis && o.visible !== false;
            if (!v) return;
            if (o.type === "Container" && o.list) for (const c of o.list) walk(c, v);
            if (!o.input || !o.input.enabled) return;
            let text = o.type === "Text" ? o.text : "";
            const sibs = o.parentContainer ? o.parentContainer.list : null;
            if (!text && sibs) text = sibs.filter((c) => c.type === "Text").map((c) => c.text).join(" | ");
            if (!match(text)) return;
            const b = o.getBounds ? o.getBounds() : null;
            if (!b) return;
            const sfx = o.scrollFactorX === undefined ? 1 : o.scrollFactorX;
            const sfy = o.scrollFactorY === undefined ? 1 : o.scrollFactorY;
            const cx = cam.x + cam.width / 2;
            const cy = cam.y + cam.height / 2;
            hits.push({ scene: sc.sys.settings.key, text, x: (b.centerX - cam.scrollX * sfx - cam.width / 2) * cam.zoomX + cx, y: (b.centerY - cam.scrollY * sfy - cam.height / 2) * cam.zoomY + cy });
          };
          for (const o of sc.children.list) walk(o, true);
        }
        return hits[nth || 0] || null;
      },
      { label, scene: o.scene, nth: o.nth, exact: o.exact },
    );
  }

  /** Click the button (or other clickable thing) with this text on it. */
  async clickText(label, o = {}) {
    const hit = await this.find(label, o);
    if (!hit) throw new Error(`clickText: nothing clickable says "${label}"${o.scene ? " in " + o.scene : ""}`);
    await this.click(hit.x, hit.y);
    return hit;
  }

  /** The scenes that are running, paused or asleep, in draw order. */
  scenes() {
    return this.page.evaluate(() =>
      window.__krel.game.scene.scenes
        .filter((s) => s.sys.settings.status >= 5 && s.sys.settings.status <= 7)
        .map((s) => s.sys.settings.key + (s.sys.settings.status === 6 ? " (paused)" : s.sys.settings.status === 7 ? " (asleep)" : "")),
    );
  }

  /**
   * How a player gets from the Enter gate to the title on a laptop: a click on the game (which, on a laptop, grabs
   * the mouse and is swallowed: see systems/mouseLock.ts), then any key.
   */
  async toTitle() {
    await this.frames(30);
    await this.click(480, 300);
    await this.key("Enter");
    await this.until(() => window.__krel.active().includes("Title"));
    await this.frames(40);
  }

  /**
   * Get past whatever stands between arriving somewhere and playing there, the way a player in a hurry would:
   * Space skips a fly-in shot, Tab skips a conversation, E pages through the first-dungeon tutorial, and title
   * cards are waited out. Done when only the `want` scenes are running, none of them paused, and `o.ready` (run in
   * the page, if given) says so; or, with `o.stopAt`, as soon as that scene turns up.
   * Returns what it did (it goes into the fingerprint, so a change in what has to be skipped shows up too).
   */
  async clear(want, o = {}) {
    const did = [];
    const max = o.max || 40;
    for (let i = 0; i < max; i++) {
      const sc = await this.scenes();
      if (o.stopAt && sc.includes(o.stopAt)) return did;
      const others = sc.filter((k) => !want.includes(k.replace(/ \(.*\)$/, "")));
      const held = sc.some((k) => / \((paused|asleep)\)$/.test(k));
      if (!o.stopAt && !others.length && !held && (!o.ready || (await this.page.evaluate(o.ready)))) return did;
      const top = others[others.length - 1] || "";
      if (/^__p3d_shot/.test(top)) {
        did.push("Space (fly-in shot)");
        await this.frames(30);
        await this.key(" ");
      } else if (/^Dialogue/.test(top)) {
        did.push("Tab (conversation)");
        await this.key("Tab");
      } else if (/^Tutorial/.test(top)) {
        did.push("E (tutorial page)");
        await this.key("e");
      } else did.push("wait" + (top ? ` (${top})` : ""));
      await this.frames(30);
    }
    throw new Error(`clear: ${o.stopAt ? `"${o.stopAt}" never turned up` : "never got clear"}: in ${(await this.scenes()).join(", ")} after ${did.join(", ")}`);
  }

  /** Step `n` frames, running `fn` in the page after each one. Returns what it returned, frame by frame. */
  async sample(n, fn, arg) {
    const out = [];
    for (let i = 0; i < n; i++) {
      await this.frames(1);
      out.push(await this.page.evaluate(fn, arg));
    }
    return out;
  }

  async close() {
    try {
      await this.ctx.close();
    } catch (e) {
      /* already gone */
    }
  }
}

async function launch() {
  return chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
}

module.exports = { Session, launch, VIEW, UA, STEP, SEED, CLOCK_START, CLOCK_PIN, sleep, PROFILES };

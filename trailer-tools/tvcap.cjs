// KrelTV capture: deterministic 60fps frames of one TV episode played over the Home living room.
// usage: node tvcap.cjs <name> '<spec json>'
// spec: { ep, from (beat index to skip to), until (speaker beat index whose line must finish), post (s after it), ch, host, sample, maxF, probe }
// voice is replaced in-page: no audio, but busy() lasts exactly the recording's length in GAME time (index bytes, 32kbit CBR),
// and each line start is logged with its frame number -> sync with the separately cut audio.
const { chromium } = require("playwright");
const fs = require("fs");
const OUT = __dirname + "/frames";
const name = process.argv[2];
let spec = process.argv[3];
spec = JSON.parse(spec.trim().startsWith("{") ? spec : fs.readFileSync(spec, "utf8"));
const dir = `${OUT}/${name}`;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const STEP = 16;
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { const t = m.text(); if (t.startsWith("CAP")) console.log(t); });
  await page.addInitScript(() => {
    const st = document.createElement("style");
    st.textContent = 'div[style*="z-index: 99999"],div[style*="z-index:99999"]{display:none!important} body{cursor:none!important}';
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
    try { localStorage.clear(); } catch (e) {}
    const RealWS = window.WebSocket;
    window.WebSocket = function (url, p) { if (/127\.0\.0\.1|localhost|vite/.test(String(url))) { const o = new EventTarget(); o.readyState = 0; o.send = () => {}; o.close = () => {}; return o; } return new RealWS(url, p); };
    window.__pend = 0;
    const track = (p) => { window.__pend++; return Promise.resolve(p).finally(() => { window.__pend--; }); };
    const sd = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    Object.defineProperty(HTMLImageElement.prototype, "src", { configurable: true, enumerable: true, get() { return sd.get.call(this); }, set(v) {
      if (!this.__pt) { this.__pt = true; window.__pend++; const done = () => { if (this.__pt) { this.__pt = false; window.__pend--; } }; this.addEventListener("load", done, { once: true }); this.addEventListener("error", done, { once: true }); }
      sd.set.call(this, v);
    } });
    const cib = window.createImageBitmap; window.createImageBitmap = function (...a) { return track(cib.apply(this, a)); };
    const dec = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (...a) { return track(dec.apply(this, a)); };
    const ab = Response.prototype.arrayBuffer; Response.prototype.arrayBuffer = function () { return track(ab.call(this)); };
    const js = Response.prototype.json; Response.prototype.json = function () { return track(js.call(this)); };
    const bl = Response.prototype.blob; Response.prototype.blob = function () { return track(bl.call(this)); };
  });
  const inflight = new Set();
  page.on("request", (r) => { if (!r.url().startsWith("data:") && r.resourceType() !== "media") inflight.add(r); });
  page.on("requestfinished", (r) => inflight.delete(r));
  page.on("requestfailed", (r) => inflight.delete(r));
  const settle = async () => {
    for (let k = 0; k < 400; k++) {
      if (inflight.size === 0) {
        const p = await page.evaluate(() => window.__pend);
        if (!p) { if (k) await page.waitForTimeout(5); return; }
      }
      await page.waitForTimeout(10);
    }
  };
  await page.clock.install({ time: new Date("2026-11-20T20:00:00") });
  await page.clock.pauseAt(new Date("2026-11-20T20:00:01"));
  await page.goto("http://127.0.0.1:5195/", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 4000; i++) {
    await page.clock.runFor(STEP);
    if (i % 10 === 0) {
      await page.waitForTimeout(15);
      const ok = await page.evaluate(() => !!(window.__krel && window.__krel.active().some((k) => k !== "Boot")));
      if (ok) break;
    }
  }
  for (let i = 0; i < 60; i++) await page.clock.runFor(STEP);
  await page.mouse.click(5, 5).catch(() => {});
  await page.evaluate((s) => {
    const k = window.__krel;
    try { k.synth.unlock(); } catch (e) {}
    k.newRun(s.pl ?? "KREZMAR");
    k.setChapter(s.ch ?? 5, s.flags ?? {});
    const G = k.G.s;
    Object.assign(G.flags, { prologue_done: true, tv_klerble_welcome: true, tv_beep_show: true, ch1_clear: true, ch2_clear: true, ch3_clear: true, ch4_clear: true, home_seen: true });
    if (k.G.meta) { k.G.meta.tutDungeon = true; k.G.meta.settings = k.G.meta.settings || {}; k.G.meta.settings.voices = true; k.G.meta.settings.crt = false; }
    // ---- the voice, replaced: silent, but busy for exactly the recording's length in game time
    const v = k.voice;
    window.__vb = 0; window.__vp = false; window.__said = [];
    v.say = function (sp, t) {
      window.__vp = true;
      const t0 = performance.now();
      window.__said.push({ f: window.__capF, sp, t: t.slice(0, 60) });
      console.log("CAP say f" + window.__capF + " | " + sp + " | " + t.slice(0, 70));
      v.clipMs(sp, t).then((ms) => { window.__vb = t0 + (ms || 0); window.__vp = false; });
    };
    v.busy = function () { return window.__vp || performance.now() < window.__vb; };
    v.stop = function () { window.__vb = 0; window.__vp = false; };
    v.layer = function (sp, t) { return v.clipMs(sp, t).then((ms) => new Promise((r) => setTimeout(r, ms || 0))); };
    v.tts = function () {};
    // host scene: the living room at home, the telly over it (as in the game)
    for (const sc of k.game.scene.getScenes(true)) sc.scene.stop();
    if (s.host) k.game.scene.start(s.host, {});
    window.__capF = 0;
    const g = k.game;
    g.events.on("postrender", () => { if (window.__grab) window.__lf = g.canvas.toDataURL("image/jpeg", 0.95); });
    const full = g.loop.callback;
    window.__render = false;
    g.loop.callback = (t, d) => {
      if (window.__render) return full(t, d);
      const hidden = [];
      for (const sc of g.scene.getScenes(true)) for (const c of sc.cameras ? sc.cameras.cameras : []) if (c.visible) { c.visible = false; hidden.push(c); }
      try { full(t, d); } finally { for (const c of hidden) c.visible = true; }
    };
  }, spec);
  // let the host settle, then put the show on
  let f = 0;
  const t0 = Date.now();
  const grab = async (keep) => {
    await page.evaluate((f) => { window.__capF = f; }, f);
    await page.clock.runFor(STEP);
    await settle();
    if (process.env.DBG) console.log("T", f, Date.now() - (global.__lt || Date.now()), inflight.size, [...inflight].map((r) => r.url().slice(-40)).join(" ")); global.__lt = Date.now();
    const st = await page.evaluate(() => { const d = window.__lf; window.__lf = null; const tv = window.__krel.game.scene.getScene("TV"); return { d, beat: tv && tv.beat, act: tv && tv.scene.isActive() }; });
    if (keep && st.d && (!spec.sample || f % spec.sample === 0)) fs.writeFileSync(`${dir}/${String(f).padStart(5, "0")}.jpg`, Buffer.from(st.d.slice(st.d.indexOf(",") + 1), "base64"));
    if (keep) f++;
    return st;
  };
  const hw = spec.hostWarm ?? 90, hr = spec.recHost ?? 0;
  for (let i = 0; i < hw; i++) {
    if (i === hw - hr) await page.evaluate(() => { window.__render = true; window.__grab = true; });
    await grab(i >= hw - hr);
  }
  await page.evaluate((s) => {
    const k = window.__krel, g = k.game;
    try { const u = g.scene.getScene("UI"); if (u) g.scene.stop("UI"); } catch (e) {}
    if (s.host) g.scene.getScene(s.host).scene.launch("TV", { overlay: true, caller: s.host, episode: s.ep, once: true });
    else g.scene.start("TV", { episode: s.ep, once: true });
  }, spec);
  if (!hr) for (let i = 0; i < 30; i++) await grab(false);
  // skip to the beat we want (applying everything on the way, as the skip button does)
  if (spec.from) {
    const at = await page.evaluate((from) => { const tv = window.__krel.game.scene.getScene("TV"); let n = 0; while (tv.beat < from && n++ < 500) tv.skipBeat(); return tv.beat; }, spec.from);
    console.log("CAP skipped to beat", at, "at f" + f);
  }
  if (spec.skipF) { await page.evaluate(() => { window.__render = false; window.__grab = false; }); for (let i = 0; i < spec.skipF; i++) await grab(false); f = spec.skipF; console.log("CAP pre-skipped", spec.skipF); }
  await page.evaluate(() => { window.__render = true; window.__grab = true; });
  let stopAt = (spec.maxF ?? 3000);
  while (f < stopAt) {
    const st = await grab(true);
    if (spec.until != null && st.beat > spec.until && stopAt === (spec.maxF ?? 3000)) { stopAt = f + Math.round((spec.post ?? 0.6) * 60); console.log("CAP passed beat", spec.until, "at f" + f); }
    if (!st.act) { console.log("CAP tv closed f" + f); break; }
  }
  console.log(name, "done", f, "frames in", ((Date.now() - t0) / 1000).toFixed(1), "s errs", errs.slice(0, 4).join(" | "));
  await browser.close();
  if (!spec.sample) {
    const { spawnSync } = require("child_process");
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", "60", "-pattern_type", "glob", "-i", `${dir}/*.jpg`, "-c:v", "libx264", "-preset", "fast", "-crf", "10", "-pix_fmt", "yuv444p", `${__dirname}/clips/${name}.mp4`]);
    if (r.status === 0) { fs.writeFileSync(`${__dirname}/clips/${name}.frames.txt`, fs.readdirSync(dir).filter((x) => x.endsWith(".jpg")).join("\n")); fs.rmSync(dir, { recursive: true }); }
    else console.log("PACK FAIL", String(r.stderr));
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

// Deterministic frame capture for KRELWORLD trailer 2.
// usage: node cap.cjs <shotname> '<spec json>'   (or a path to a .json spec)
// spec: { pl, ch, flags, scene, data, direct, warm (frames before rec), frames (frames to record),
//         acts: [{f, eval|press|down|up|tab}], every: {n, eval|press} , god, hideUI, setup(eval string) }
// Frame f counts from scene start (warm frames first, then recorded frames f>=warm).
// Game time is stepped with Playwright's fake clock: clock.runFor(16) per frame = exactly one rAF per frame
// (the fake rAF fires on 16 ms boundaries), so every captured frame is one game step of 16 ms.
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
    // no HMR: someone else may be editing the source; a live reload would wreck a capture
    const RealWS = window.WebSocket;
    window.WebSocket = function (url, p) { if (/127\.0\.0\.1|localhost|vite/.test(String(url))) { const o = new EventTarget(); o.readyState = 0; o.send = () => {}; o.close = () => {}; return o; } return new RealWS(url, p); };
    // count in-page async work that must finish before game time moves on (so slow rendering can't change timing)
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
      if (process.env.DBG && k === 3) console.log("WAIT", inflight.size, [...inflight].map((r) => r.url().slice(-60)).join(" "), await page.evaluate(() => window.__pend));
      await page.waitForTimeout(10);
    }
  };
  await page.clock.install({ time: new Date("2026-11-20T20:00:00") });
  await page.goto("http://127.0.0.1:" + (process.env.KPORT || "5187") + "/", { waitUntil: "domcontentloaded" });
  // pump fake time until the game boots (asset loading is real async)
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
    k.setChapter(s.ch ?? 7, s.flags ?? {});
    const G = k.G.s; G.upgrades = G.upgrades || {}; G.upgrades.pk_autoaim = true;
    if (k.G.meta) { k.G.meta.tutDungeon = true; k.G.meta.settings = k.G.meta.settings || {}; k.G.meta.settings.voices = false; }
    if (s.debug) G.flags.debug_mode = true;
    if (s.setup) (0, eval)(s.setup);
    if (s.direct) { for (const sc of k.game.scene.getScenes(true)) sc.scene.stop(); k.game.scene.start(s.scene, s.data ?? {}); }
    else k.go(s.scene, s.data ?? {});
    window.__capF = 0;
    const g = k.game;
    g.events.on("postrender", () => { if (window.__grab) window.__lf = g.canvas.toDataURL("image/jpeg", 0.95); });
    // skip rendering on frames we don't keep (warm-up, probes): update-only steps are much cheaper
    const full = g.loop.callback;
    window.__render = false;
    // invisible steps: the full step (so render-driven logic runs exactly as when we draw) with every camera hidden
    g.loop.callback = (t, d) => {
      if (window.__render) return full(t, d);
      const hidden = [];
      for (const sc of g.scene.getScenes(true)) for (const c of sc.cameras ? sc.cameras.cameras : []) if (c.visible) { c.visible = false; hidden.push(c); }
      try { full(t, d); } finally { for (const c of hidden) c.visible = true; }
    };
  }, spec);
  const warm = spec.warm ?? 120, frames = spec.frames ?? 180, total = warm + frames;
  const acts = (spec.acts ?? []).slice().sort((a, b) => a.f - b.f);
  let ai = 0;
  const t0 = Date.now();
  let hp0 = null;
  let lastR = false, lastG = false;
  for (let f = 0; f < total; f++) {
    while (ai < acts.length && acts[ai].f <= f) {
      const a = acts[ai++];
      try {
        if (a.eval) { const r = await page.evaluate(a.eval); if (a.log) console.log("CAP f" + f, JSON.stringify(r)); }
        if (a.press) await page.keyboard.press(a.press);
        if (a.down) await page.keyboard.down(a.down);
        if (a.up) await page.keyboard.up(a.up);
        if (a.shot) await page.screenshot({ path: `${dir}_probe_${f}.png` });
      } catch (e) { console.log("ACT ERR f" + f, e.message.slice(0, 200)); }
    }
    if (spec.every) for (const ev of spec.every) if (f >= (ev.from ?? 0) && f < (ev.to ?? 1e9) && (f - (ev.from ?? 0)) % ev.n === 0) {
      try { if (ev.cond && !(await page.evaluate(ev.cond))) continue; if (ev.eval) await page.evaluate(ev.eval); if (ev.press) await page.keyboard.press(ev.press); } catch (e) {}
    }
    if (spec.god && f % 20 === 0) await page.evaluate(() => { try { const s = window.__krel.G.s; s.hp = Math.max(s.hp, 99999); } catch (e) {} });
    if (spec.hideUI && f % 30 === 0) await page.evaluate(() => { try { const u = window.__krel.game.scene.getScene("UI"); if (u && u.cameras) u.cameras.main.setVisible(false); } catch (e) {} });
    const rel = f - warm;
    const keep = f >= warm && (!spec.sample || rel % spec.sample === 0) && (!spec.keep || spec.keep.some(([a, b]) => rel >= a && rel < b));
    const wantR = spec.renderAll || keep || (!spec.sample && f >= warm - 2 && (!spec.keep || spec.keep.some(([a, b]) => rel >= a - 2 && rel < b)));
    if (wantR !== lastR || keep !== lastG) { await page.evaluate(([v, gk]) => { window.__render = v; window.__grab = gk; }, [wantR, keep]); lastR = wantR; lastG = keep; }
    await page.clock.runFor(STEP);
    await settle();
    if (keep) {
      const d = await page.evaluate(() => { const d = window.__lf; window.__lf = null; return d; });
      if (!d) { console.log("NOFRAME", f); continue; }
      fs.writeFileSync(`${dir}/${String(f - warm).padStart(5, "0")}.jpg`, Buffer.from(d.slice(d.indexOf(",") + 1), "base64"));
    }
  }
  const info = await page.evaluate(() => window.__krel.active());
  console.log(name, "done", total, "frames in", ((Date.now() - t0) / 1000).toFixed(1), "s; active", info.join(","), "errs", errs.slice(0, 4).join(" | "));
  await browser.close();
  if (!spec.sample) {
    // pack the frames into a near-lossless 60fps clip (one frame per game step) and free the disk
    const { spawnSync } = require("child_process");
    fs.mkdirSync(`${__dirname}/clips`, { recursive: true });
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", "60", "-pattern_type", "glob", "-i", `${dir}/*.jpg`, "-c:v", "libx264", "-preset", "fast", "-crf", "10", "-pix_fmt", "yuv444p", `${__dirname}/clips/${name}.mp4`]);
    if (r.status === 0) { fs.writeFileSync(`${__dirname}/clips/${name}.frames.txt`, fs.readdirSync(dir).filter((x) => x.endsWith(".jpg")).join("\n")); fs.rmSync(dir, { recursive: true }); }
    else console.log("PACK FAIL", String(r.stderr));
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

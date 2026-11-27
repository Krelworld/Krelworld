#!/usr/bin/env node
// Plays a scripted session of the real game in a phone-sized browser and keeps the evidence: frames taken
// when something happens (and every few seconds), the event log, the cause tree, how much text was on the
// screen, where everyone was, the input recording, and a contact sheet. Critics and metrics work from this
// folder, never from the code.
//
//   node tools/qa/session.cjs tools/qa/scenarios/yard.json [--3d] [--landscape] [--out DIR] [--url URL]
//
// Needs a built game served somewhere (default: it serves dist/stadium itself on a free port).
// A scenario is { name, seed, steps: [...] }. Steps:
//   { "do": "wait", "s": 5 }                       let the game run
//   { "do": "hold", "keys": "WD", "s": 2 }         hold movement keys (W A S D)
//   { "do": "walk", "x": -28, "y": 70, "max": 20 } walk there the way a tap on the ground would
//   { "do": "tap", "x": -30, "y": 69 }             tap a world point (the game's own tap handling)
//   { "do": "act" }                                press the main button, if it is showing
//   { "do": "option", "match": "Roll the keg" }    press whichever action (main or in "...") matches
//   { "do": "speed", "n": 6 }                      run the clock faster (1, 2, 4, 6)
//   { "do": "until", "event": "scheme_play", "max": 400, "speed": 6 }  run until an event (or max seconds)
//   { "do": "shot", "name": "label" }              an extra frame
//   { "do": "click", "sel": "[data-buy=tankard]" } click something in the HUD or a sheet
//   { "do": "close" }                              close whatever sheet is open
const { chromium, devices } = require("playwright");
const fs = require("fs"), path = require("path"), http = require("http");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const scenFile = args.find((a) => a.endsWith(".json"));
if (!scenFile) { console.error("usage: session.cjs SCENARIO.json [--3d] [--landscape] [--out DIR] [--url URL]"); process.exit(1); }
const flag = (f) => args.includes(f), opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const scen = JSON.parse(fs.readFileSync(scenFile, "utf8"));
const ROOT = path.resolve(__dirname, "../..");
const tag = `${scen.name}${flag("--3d") ? "-3d" : ""}${flag("--landscape") ? "-land" : ""}`;
const OUT = path.resolve(opt("--out") ?? path.join(ROOT, "qa-out", tag));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });

// Events worth a frame: something Grozz set off, a scheme moving, the match, trouble.
const TRIGGERS = new Set(["chain", "scheme_clue", "scheme_cond", "scheme_play", "scheme_news", "scheme_did", "fb_goal", "fb_removed", "caught", "custody_start", "spew", "flayed", "hose", "kegs_foul", "tipoff_arrest", "bribed", "drawn", "post_left", "lorry_no", "keg_shoved", "ejected", "arrested"]);
const QUIET = new Set(["action_failed", "tick", "step"]);

function serve(dir) {
  return new Promise((res) => {
    const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".mp3": "audio/mpeg", ".bin": "application/octet-stream" };
    const srv = http.createServer((q, r) => {
      const p = path.join(dir, decodeURIComponent(q.url.split("?")[0]));
      fs.readFile(p.endsWith("/") ? p + "index.html" : p, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }); r.end(b); } });
    });
    srv.listen(0, () => res(srv));
  });
}

(async () => {
  let srv, base = opt("--url");
  if (!base) { srv = await serve(path.join(ROOT, "dist/stadium")); base = `http://127.0.0.1:${srv.address().port}/local.html`; }
  const dev = devices[flag("--landscape") ? "iPhone 13 landscape" : "iPhone 13"];
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...dev, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  const url = `${base}?noopening&mute&noswoop&seed=${encodeURIComponent(scen.seed ?? "qa")}${flag("--3d") ? "&3d=1" : "&3d=0"}`;
  await p.goto(url, { waitUntil: "load" });
  await p.waitForFunction(() => window.__scene, null, { timeout: 240000 });
  await p.click("#start");
  await p.waitForTimeout(1500);
  // Listen to the game: events (compact), and once a second the camera, the text on screen and everyone's whereabouts.
  await p.evaluate((quiet) => {
    const sc = window.__scene, Q = new Set(quiet);
    window.__qa = { events: [], samples: [], npcs: [] };
    const small = (e) => { const o = {}; for (const k in e) { const v = e[k]; if (v === null || ["string", "number", "boolean"].includes(typeof v)) o[k] = typeof v === "string" ? v.slice(0, 120) : v; else if (Array.isArray(v) && v.length < 12 && v.every((x) => typeof x !== "object")) o[k] = v; } return o; };
    sc.w.bus.on((e) => { if (!Q.has(e.type)) window.__qa.events.push(small(e)); });
    const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && getComputedStyle(el).display !== "none" && el.offsetParent !== null && (el.textContent ?? "").trim().length > 0; };
    setInterval(() => {
      const s = sc.s, cam = sc.cameras.main, v = cam.worldView, pc = sc.pc, P = sc.P;
      // Text on screen: HUD lines, sheets, and the world's bubbles and boards.
      const dom = ["actHint", "custody", "chainStrap", "hint", "where", "itemCard", "toast", "cineCap", "sheet"].filter(vis);
      const words = dom.reduce((n, id) => n + (document.getElementById(id).textContent ?? "").trim().split(/\s+/).length, 0);
      const bubbles = (sc.bubbles ?? []).filter((t) => t.visible && t.text);
      const boards = (sc.boards ?? []).filter((t) => t.visible && t.text);
      const bw = [...bubbles, ...boards].reduce((n, t) => n + String(t.text).split(/\s+/).length, 0);
      // Every consequence since the last sample: was it on screen when it happened (near enough: now)?
      const cs = s.stadium.causes ?? [], seenN = window.__qa.causeN ?? 0;
      for (const c of cs.slice(seenN)) { const x = P.sx(c.x, c.y), y = P.sy(c.x, c.y); (window.__qa.onscreen ??= {})[c.id] = x >= v.x && x <= v.right && y >= v.y && y <= v.bottom ? 1 : 0; }
      window.__qa.causeN = cs.length;
      window.__qa.samples.push({ t: s.tick, view: [v.x, v.y, v.width, v.height], S: P.S, K: P.K, pc: pc ? [pc.x, pc.y] : null, text: dom.length + bubbles.length + boards.length, words: words + bw, dom, bubbles: bubbles.length, boards: boards.length, cine: !!sc.cine, speed: sc.speed });
      if (s.tick % 120 < 60) window.__qa.npcs.push({ t: s.tick, a: Object.values(s.actors).filter((a) => a.npc && !a.dead).map((a) => [a.id, a.npc.job, Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, a.npc.mode, a.npc.plan?.[0]?.k === "go" || (a.npc.path?.length ?? 0) > 0 ? 1 : 0, a.hiddenIn ? 1 : 0, a.downUntil > s.tick ? 1 : 0]) });
    }, 1000);
  }, [...QUIET]);

  let shots = 0, lastShot = 0, seen = 0;
  const shot = async (name) => { if (shots >= (scen.maxShots ?? 70)) return; shots++; const f = `${String(shots).padStart(3, "0")}-${name.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40)}.png`; await p.screenshot({ path: path.join(OUT, "frames", f) }); };
  const tick = () => p.evaluate(() => window.__scene.s.tick);
  // Watch for trigger events and take a frame (not more than one every 1.2 s of real time).
  const watch = async () => {
    const ev = await p.evaluate((n) => window.__qa.events.slice(n), seen);
    seen += ev.length;
    for (const e of ev) if (TRIGGERS.has(e.type) && Date.now() - lastShot > 1200) { lastShot = Date.now(); await shot(`t${Math.round(e.t / 60)}-${e.type}`); }
    return ev;
  };
  let periodic = Date.now();
  const run = async (ms, until) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await p.waitForTimeout(250);
      const ev = await watch();
      if (until && ev.some(until)) return true;
      if (Date.now() - periodic > (scen.everyMs ?? 12000)) { periodic = Date.now(); await shot(`t${Math.round((await tick()) / 60)}-frame`); }
    }
    return false;
  };
  const keys = { W: "KeyW", A: "KeyA", S: "KeyS", D: "KeyD" };
  const toClient = (x, y) => p.evaluate(([x, y]) => { const sc = window.__scene, cam = sc.cameras.main, P = sc.P, d = window.devicePixelRatio || 1; return { cx: (P.sx(x, y) - cam.worldView.x) * cam.zoom / d, cy: (P.sy(x, y) - cam.worldView.y) * cam.zoom / d }; }, [x, y]);
  const setSpeed = (n) => p.evaluate((n) => window.__scene.setSpeed(n), n);

  for (const st of scen.steps) {
    const t0 = Date.now();
    if (st.do === "wait") await run(st.s * 1000);
    else if (st.do === "speed") await setSpeed(st.n);
    else if (st.do === "shot") await shot(st.name ?? "shot");
    else if (st.do === "hold") { for (const k of st.keys) await p.keyboard.down(keys[k]); await run(st.s * 1000); for (const k of st.keys) await p.keyboard.up(keys[k]); }
    else if (st.do === "walk") {
      // The game's own tap-to-walk (it finds a path round buildings), re-issued until he's there.
      const end = Date.now() + (st.max ?? 30) * 1000;
      while (Date.now() < end) {
        const d = await p.evaluate(([x, y]) => { const sc = window.__scene, pc = sc.pc; if (!sc.walkTo) sc.walkTo = { x, y, path: [], pathAt: 0, until: performance.now() + 20000 }; return Math.hypot(pc.x - x, pc.y - y); }, [st.x, st.y]);
        if (d < (st.r ?? 1.2)) break;
        await run(300);
      }
      await p.evaluate(() => { const sc = window.__scene; sc.walkTo = null; sc.pc.moveX = sc.pc.moveY = 0; });
    } else if (st.do === "tap") { const c = await toClient(st.x, st.y); await p.mouse.click(c.cx, c.cy); await run(400); }
    else if (st.do === "click") { if (await p.isVisible(st.sel)) await p.click(st.sel); else fs.appendFileSync(path.join(OUT, "steps.log"), `click ${st.sel}: NOT VISIBLE\n`); await run(500); }
    else if (st.do === "close") { await p.evaluate(() => window.__scene.closeSheet()); await run(300); }
    else if (st.do === "act") {
      // Press the main button if it's there and nothing is covering it (a first-timer would be stopped by a sheet too).
      try { if (await p.isVisible("#act")) await p.click("#act", { timeout: 1500 }); } catch { fs.appendFileSync(path.join(OUT, "steps.log"), "act: button covered or gone\n"); await p.evaluate(() => window.__scene.closeSheet && window.__scene.closeSheet()); }
      await run(500);
    }
    else if (st.do === "option") {
      const lab = await p.evaluate((m) => { const sc = window.__scene, o = sc.opts.find((q) => q.label.toLowerCase().includes(m.toLowerCase())); if (o) { sc.run(o); return o.label; } return null; }, st.match);
      fs.appendFileSync(path.join(OUT, "steps.log"), `option ${st.match}: ${lab ?? "NOT OFFERED"}\n`);
      await run(500);
    } else if (st.do === "until") {
      if (st.speed) await setSpeed(st.speed);
      // max is in game seconds (headless rendering is slow, so the real time it takes varies).
      const stopAt = (await tick()) + (st.max ?? 300) * 60;
      let hit = false;
      while (!hit && (await tick()) < stopAt) hit = await run(3000, (e) => e.type === st.event);
      if (st.speed) await setSpeed(1);
      fs.appendFileSync(path.join(OUT, "steps.log"), `until ${st.event}: ${hit ? "reached" : "NOT reached"}\n`);
    }
    fs.appendFileSync(path.join(OUT, "steps.log"), `${JSON.stringify(st)} ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  }
  await shot("end");
  // Everything the critics and the metrics need.
  const dump = await p.evaluate(() => { const st = window.__scene.s.stadium; return { qa: window.__qa, causes: (st.causes ?? []).map((c) => ({ ...c, onscreen: window.__qa.onscreen?.[c.id] ?? null })), chainBest: st.chainBest ?? null, rec: window.__recording ? window.__recording() : null, fp: window.__fingerprint ? window.__fingerprint() : null, tick: window.__scene.s.tick, schemes: st.schemes ?? {}, info: window.__three?.renderer?.info?.render ?? null }; });
  fs.writeFileSync(path.join(OUT, "events.jsonl"), dump.qa.events.map((e) => JSON.stringify(e)).join("\n"));
  fs.writeFileSync(path.join(OUT, "samples.json"), JSON.stringify(dump.qa.samples));
  fs.writeFileSync(path.join(OUT, "npcs.json"), JSON.stringify(dump.qa.npcs));
  fs.writeFileSync(path.join(OUT, "causes.json"), JSON.stringify({ causes: dump.causes, best: dump.chainBest }, null, 1));
  fs.writeFileSync(path.join(OUT, "schemes.json"), JSON.stringify(dump.schemes, null, 1));
  fs.writeFileSync(path.join(OUT, "recording.json"), JSON.stringify(dump.rec));
  fs.writeFileSync(path.join(OUT, "session.json"), JSON.stringify({ scenario: scen.name, seed: scen.seed, url, device: flag("--landscape") ? "iPhone 13 landscape" : "iPhone 13", threeD: flag("--3d"), endTick: dump.tick, fingerprint: dump.fp, errors, shots, renderInfo: dump.info }, null, 1));
  await b.close(); srv?.close();
  // The contact sheet and the numbers.
  try { execFileSync("python3", [path.join(__dirname, "sheet.py"), OUT], { stdio: "inherit" }); } catch (e) { console.error("contact sheet failed", e.message); }
  try { execFileSync("npx", ["tsx", path.join(__dirname, "metrics.ts"), OUT], { stdio: "inherit", cwd: ROOT }); } catch (e) { console.error("metrics failed", e.message); }
  console.log(`${OUT}  (${shots} frames, ${dump.qa.events.length} events, ${errors.length} page errors)`);
})();

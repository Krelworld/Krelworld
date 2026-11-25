#!/usr/bin/env node
// The bike on a laptop (1280x720, keyboard, Playwright's fake clock so the machine's load can't skew a measurement).
// Needs a running dev server.
//
//   node scripts/bike-laptop.cjs [url] [shots dir or ""] [lad]
//   e.g. node scripts/bike-laptop.cjs http://localhost:5602/ "" MIKEY
//
// Checks: the bike stands outside Home; next to it the prompt is "E: Ride your bike"; E gets on and the one-time
// tip names the key; Z gets off (the bike stays standing); riding is about 1.8x walking, with a coast when you let go;
// all four directions draw the bike round the rider (behind / in front in the right order); E at a door gets you off;
// the Kreddle Strip: Z on, about 1.8x, Z off. No page errors. Exit 0 = all passed.
const { chromium } = require("playwright");
const URL0 = process.argv[2] || "http://localhost:5602/";
const SHOTS = process.argv[3] || "";
const WHO = process.argv[4] || "FLENKY";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  const ev = (f, a) => page.evaluate(f, a);
  // a fake clock: the game moves only when we step it (16 ms a frame), so the machine's load can't skew a measurement
  const step = async (n = 1) => { for (let i = 0; i < n; i++) { await page.clock.runFor(16); if (i % 8 === 7) await page.waitForTimeout(4); } };
  const wait = (ms) => step(Math.ceil(ms / 16));
  // a key held for 3 frames (the game samples keys once a frame)
  const press = async (k) => { await page.keyboard.down(k); await step(3); await page.keyboard.up(k); await step(1); };
  const until = async (f, a, ms = 240000) => { const t0 = Date.now(); while (!(await ev(f, a).catch(() => false))) { if (Date.now() - t0 > ms) throw new Error("timeout " + f + " active=" + (await ev(() => window.__krel && window.__krel.active().join(",")).catch(() => "?")) + " frame=" + (await ev(() => window.__krel && window.__krel.game.loop.frame).catch(() => "?"))); await step(10); await page.waitForTimeout(20); } };
  let fails = 0;
  const check = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? "  ok  " : "  FAIL"} ${n} ${d !== undefined ? JSON.stringify(d) : ""}`); };
  try {
    await page.clock.install({ time: new Date("2026-11-20T20:00:00") });
    await page.clock.pauseAt(new Date("2026-11-20T20:00:01"));
    await page.goto(URL0, { waitUntil: "domcontentloaded" });
    await until(() => !!window.__krel && window.__krel.active().includes("Enter"));
    await press("Enter");
    await until(() => window.__krel.active().includes("Title"));
    await ev((who) => {
      const k = window.__krel;
      k.newRun(who);
      Object.assign(k.G.s.flags, { ch1_intro: true, ch1_home: true, home_seen: true, flyover_seen: true, tv_klerble_welcome: true, prologue_done: true, met_emergency: true, founding_seen: true });
      k.go("Hub", { at: "HOME" });
    }, WHO);
    await until(() => { const g = window.__krel.game; return (g.scene.isActive("Hub") || g.scene.isPaused("Hub")) && !!g.scene.getScene("Hub").av; });
    // let it settle; close any conversation
    let calm = 0;
    for (let i = 0; i < 120 && calm < 4; i++) {
      const st = await ev(() => { const g = window.__krel.game; const h = g.scene.getScene("Hub"); return { busy: h.busy || h.cutscene, curtain: !!h.curtain, dlg: g.scene.isActive("Dialogue"), active: g.scene.isActive("Hub") && !g.scene.isPaused("Hub") }; });
      if (!st.busy && !st.curtain && !st.dlg && st.active) { calm++; await wait(500); continue; }
      calm = 0;
      if (st.dlg) await press("Tab");
      else await press("Space");
      await wait(700);
    }
    await wait(800);
    const a = await ev(() => { const h = window.__krel.game.scene.getScene("Hub"); const p = h.bike.parkedAt(); return { av: [Math.round(h.av.x), Math.round(h.av.y)], parked: p, home: h.bike.isHome(), tip: !!window.__krel.G.s.flags.bike_tip, scale: h.av.scaleX }; });
    check("the bike is parked outside Home", !!a.parked && a.home, a);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/laptop-home-${WHO}.png` });
    // walk to it: E gets on
    await ev(() => { const h = window.__krel.game.scene.getScene("Hub"); const p = h.bike.parkedAt(); h.av.body.reset(p.x + 30, p.y - 20); });
    await wait(600);
    const pr = await ev(() => { const h = window.__krel.game.scene.getScene("Hub"); return { prompt: h.prompt.visible ? h.prompt.text : null, tip: !!window.__krel.G.s.flags.bike_tip }; });
    check("next to it the prompt says ride it (no tip yet)", /Ride your bike/.test(pr.prompt || "") && !pr.tip, pr);
    await press("e");
    await wait(500);
    let r = await ev(() => window.__krel.game.scene.getScene("Hub").bike.riding);
    check("E at the bike: riding", r === true);
    const tip = await ev(() => { const t = []; const w = (o) => (o.type === "Container" ? o.list.forEach(w) : o.type === "Text" && t.push(o.text)); window.__krel.game.scene.getScene("UI").children.list.forEach(w); return { flag: !!window.__krel.G.s.flags.bike_tip, toast: t.filter((x) => /bike/i.test(x)) }; });
    check("the first ride brings the one-time tip naming the key", tip.flag && tip.toast.some((x) => /Press Z to hop on your bike/.test(x)), tip);
    await press("z");
    await wait(400);
    r = await ev(() => window.__krel.game.scene.getScene("Hub").bike.riding);
    check("Z: off again (the bike stands where you got off)", r === false && !!(await ev(() => window.__krel.game.scene.getScene("Hub").bike.parkedAt())));
    // measure walking and riding speed along the main road
    const measure = async (ride) => {
      await ev(() => { const h = window.__krel.game.scene.getScene("Hub"); h.av.body.reset(1400, 800); h.av.body.setVelocity(0, 0); });
      await wait(300);
      if (ride) { await press("z"); await wait(250); }
      await page.keyboard.down("d");
      await wait(1200);
      const x0 = await ev(() => [window.__krel.game.scene.getScene("Hub").av.x, window.__krel.game.loop.time]);
      await wait(1000);
      const x1 = await ev(() => [window.__krel.game.scene.getScene("Hub").av.x, window.__krel.game.loop.time]);
      const v = await ev(() => Math.round(window.__krel.game.scene.getScene("Hub").av.body.velocity.x));
      if (SHOTS && ride) await page.screenshot({ path: `${SHOTS}/laptop-riding-${WHO}.png` });
      await page.keyboard.up("d");
      return { speed: Math.round(((x1[0] - x0[0]) * 1000) / (x1[1] - x0[1])), v };
    };
    const walk = await measure(false);
    const ride = await measure(true);
    check("riding is about 1.8x walking", ride.v / walk.v > 1.7 && ride.v / walk.v < 1.9, { walk, ride });
    // coasting: let go and it rolls a little
    await wait(150);
    const coast = await ev(() => Math.round(window.__krel.game.scene.getScene("Hub").av.body.velocity.x));
    check("let go: the bike coasts down (not a dead stop)", coast > 20 && coast < ride.v, { coast });
    // every direction: the bike's layers follow the rider
    for (const [key, f] of [["s", "south"], ["w", "north"], ["a", "west"], ["d", "east"]]) {
      await page.keyboard.down(key);
      await wait(500);
      const st = await ev(() => { const h = window.__krel.game.scene.getScene("Hub"); const b = h.bike; return { facing: h.av.getData("facing"), back: b.back.visible, front: b.front.visible, flip: b.back.flipX, frame: b.back.frame.name, depthOk: b.back.depth < h.av.depth && (!b.front.visible || b.front.depth > h.av.depth) }; });
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/laptop-dir-${f}-${WHO}.png`, clip: { x: 540, y: 260, width: 200, height: 200 } });
      await page.keyboard.up(key);
      check(`riding ${f}: bike drawn round the rider`, st.facing === f && st.back && st.depthOk, st);
    }
    // a door gets you off: go into the Krezz Arms
    await ev(() => { const h = window.__krel.game.scene.getScene("Hub"); h.av.body.reset(560, 952); });
    await wait(400);
    const before = await ev(() => window.__krel.game.scene.getScene("Hub").bike.riding);
    await press("e");
    await wait(300);
    const after = await ev(() => ({ riding: window.__krel.game.scene.getScene("Hub").bike?.riding, active: window.__krel.active() }));
    check("using a door gets you off the bike", before === true && after.riding !== true, { before, after });
    
    // the Kreddle Strip: Z gets on, faster along the Strip, a machine gets you off
    await ev(() => { window.__krel.G.s.flags.kreddle_seen = true; window.__krel.go("Kreddle"); });
    await until(() => { const g = window.__krel.game; const k = g.scene.getScene("Kreddle"); return g.scene.isActive("Kreddle") && !!k.me && !k.busy && !!k.bike; });
    await wait(800);
    await ev(() => { const k = window.__krel.game.scene.getScene("Kreddle"); k.me.setPosition(300, 600); k.nextShove = 1e12; });
    await press("z");
    const kr0 = await ev(() => window.__krel.game.scene.getScene("Kreddle").bike.riding);
    await page.keyboard.down("d");
    await wait(1200);
    const k0 = await ev(() => [window.__krel.game.scene.getScene("Kreddle").me.x, window.__krel.game.loop.time]);
    await wait(600);
    const k1 = await ev(() => [window.__krel.game.scene.getScene("Kreddle").me.x, window.__krel.game.loop.time]);
    await page.keyboard.up("d");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/laptop-kreddle-${WHO}.png` });
    const kv = Math.round(((k1[0] - k0[0]) * 1000) / (k1[1] - k0[1]));
    check("Kreddle Strip: Z gets on and you ride at about 1.8x (414 px/s)", kr0 && kv > 380 && kv < 430, { kr0, kv });
    await press("z");
    check("Kreddle Strip: Z again gets off", (await ev(() => window.__krel.game.scene.getScene("Kreddle").bike.riding)) === false);
    check("no page errors", errs.length === 0, errs.slice(0, 3));
  } catch (e) {
    check("ran to the end", false, String(e.message).slice(0, 300));
  } finally {
    await browser.close();
  }
  console.log(fails ? "LAPTOP BIKE: FAILED" : "LAPTOP BIKE: OK");
  process.exit(fails ? 1 : 0);
})();

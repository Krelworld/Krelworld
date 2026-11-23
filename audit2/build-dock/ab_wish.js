// A/B the regress flow 'wish buttons take her to each activity' (keys given), HEAD vs dock (on) vs dock (my switches off), K times,
// plus the 'tap floor walks' first step (does a floor tap walk within 1.8 s).
const fs = require('fs'); const { chromium } = require('playwright'); const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const SRC = fs.readFileSync('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/regress.js', 'utf8');
const IN_PAGE = SRC.slice(SRC.indexOf('const IN_PAGE = ') + 'const IN_PAGE = '.length, SRC.indexOf('\n};\n', SRC.indexOf('const IN_PAGE = ')) + 2);
const KEYS = (process.argv[2] || 'fort,gym,miles').split(','), K = +(process.argv[3] || 3);
const BUILDS = [['HEAD', 8847, ''], ['dock-on', 8890, ''], ['dock-off', 8890, 'G16,G25,G27,G31']];
(async () => {
  const browser = await chromium.launch(); const out = {};
  for (let k = 0; k < K; k++) for (const [name, port, off] of BUILDS) {
    const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true }); if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off); const p = await ctx.newPage();
    const fresh = async room => { await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
      await p.evaluate('(' + IN_PAGE + ')()'); await p.evaluate(r => __start(r), room); await p.waitForTimeout(1100); await p.evaluate(() => __quiet()); await p.waitForTimeout(60); };
    for (const key of KEYS) {
      await fresh('dining'); await p.evaluate(() => { niko.room = 'kitchen'; }); await p.evaluate(k => showWish(k), key); await p.waitForTimeout(400);
      await p.locator('#wishBtn').nth(0).tap({ force: true }); await p.waitForTimeout(4200);
      const s = await p.evaluate(() => { const s = __snap(); return [s.room, s.panel ? 'panel' : '', s.studio ? 'studio' : '', s.menu ? 'menu' + s.menu : '', s.state !== 'idle' ? s.state : ''].filter(Boolean).join('+') + ' (miles in ' + miles.room + ')'; });
      (out[key] = out[key] || {}); (out[key][name] = out[key][name] || []).push(s);
    }
    await fresh('dining'); const x0 = await p.evaluate(() => marina.x); const pt = await p.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(marina.x + 70, 168).map((v, i) => v + (i ? st.top : st.left)); });
    await p.touchscreen.tap(pt[0], pt[1]); await p.waitForTimeout(1800); const moved = await p.evaluate(x0 => Math.round(marina.x) !== Math.round(x0), x0);
    (out.floorWalk = out.floorWalk || {}); (out.floorWalk[name] = out.floorWalk[name] || []).push(moved);
    await ctx.close();
  }
  await browser.close(); console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

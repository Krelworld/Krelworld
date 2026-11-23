// prompts worker test helpers. Ports 8850-8859 only. Game dir: the prompts worktree (or HEAD at 8847 for A/B).
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-prompts/';
const DIR = '/home/user/Krelworld/.wt/prompts/public/chef-marina';
const MINE = 'G1,G2,G20,G21,G28,G29';
// off: '' (all on) | 'G1,G2' | 'all'. virtual: install vt.js (call g.virtual() later, then g.run(ms)). seed: seeded Math.random.
async function boot({ port = 8850, dir = DIR, view = 'port', room = 'kitchen', off = '', virtual = false, seed = null, start = true, settle, inst = false } = {}) {
  await H.serve(port, port === 8847 ? undefined : dir);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: H.VIEWS[view] || view, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
  if (virtual) await ctx.addInitScript({ path: OUT + 'vt.js' });
  if (seed != null) await ctx.addInitScript(s => { Math.random = (() => { let x = s; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; })(); }, +seed * 7919 + 17);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/willReadFrequently|Failed to load resource/.test(t)) errors.push(m.type() + ': ' + t.slice(0, 200)); } });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForTimeout(virtual ? 3000 : 2500);
  if (start) { await page.evaluate(r => startGame(r), room); await page.waitForTimeout(settle != null ? settle : virtual ? 1500 : 5000); }
  const ev = (f, a) => page.evaluate(f, a);
  const g = {
    browser, ctx, page, errors, ev,
    virtual: (ms = 50) => page.evaluate(m => __vt.virtual(m), ms),
    run: ms => page.evaluate(m => __vt.run(m), ms),
    inst: () => page.addScriptTag({ path: OUT + 'inst.js' }),
    calm: () => page.evaluate(() => { G.busy = false; G.sceneOn = false; UI.closeActions(); if (window.clearWish) clearWish(); if (marina.mount) dismount();
      if (['cheer', 'sad', 'sit', 'perch', 'anim', 'stomp'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; marina.anim = null; } }),
    shot: (name, clip) => page.screenshot({ path: name.startsWith('/') ? name : OUT + 'shots/' + name + '.png', ...(clip ? { clip } : {}) }),
    tapWorld: async (wx, wy) => { const pt = await page.evaluate(([x, y]) => { const st = document.getElementById('stage').getBoundingClientRect(); const [sx, sy] = toScreen(x, y); return [sx + st.left, sy + st.top]; }, [wx, wy]); await page.touchscreen.tap(pt[0], pt[1]); return pt; },
    tap: async sel => { const r = await page.locator(sel).first().boundingBox(); if (!r) throw new Error('not visible: ' + sel); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); },
    close: () => browser.close(),
  };
  if (inst) await g.inst();
  return g;
}
const errs = g => g.errors.filter(e => !/chip_love/.test(e));
module.exports = { boot, H, OUT, DIR, MINE, errs };

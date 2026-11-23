// screens worker: harness.boot with two extras — CLARITY_OFF before load (off: 'G3,G9' | 'all') and real safe-area insets
// (Chromium's Emulation.setSafeAreaInsetsOverride, so env(safe-area-inset-*) is non-zero: inset: { left, right, top, bottom }).
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const { chromium } = require('playwright');
const DIR = '/home/user/Krelworld/.wt/screens/public/chef-marina';
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-screens/';
async function boot({ port = 8910, view = 'port', room = 'living', start = true, off = '', inset = null, settle = 4000, dir = DIR, storage, seed = false } = {}) {
  await H.serve(port, dir);
  const browser = await chromium.launch();
  const vp = H.VIEWS[view] || view;
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
  if (seed) await ctx.addInitScript(() => { let s = 12345; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; });
  const page = await ctx.newPage(); const errors = [];
  if (inset) { const s = await ctx.newCDPSession(page); await s.send('Emulation.setSafeAreaInsetsOverride', { insets: Object.assign({ left: 0, right: 0, top: 0, bottom: 0 }, inset) }); }
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/willReadFrequently|Failed to load resource/.test(t)) errors.push(m.type() + ': ' + t.slice(0, 200)); } });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  if (storage) { await page.evaluate(s => { for (const k in s) localStorage.setItem(k, s[k]); }, storage); await page.reload(); }
  await page.waitForTimeout(2500);
  if (start) { await page.evaluate(r => startGame(r), room); await page.waitForTimeout(settle); }
  const calm = () => page.evaluate(() => { G.busy = false; G.sceneOn = false; UI.closeActions(); if (window.clearWish) clearWish(); if (marina.mount) dismount();
    if (['cheer', 'sad', 'sit', 'perch', 'anim', 'stomp'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; marina.anim = null; } });
  const shot = (name, clip) => page.screenshot({ path: OUT + 'shots/' + name + '.png', ...(clip ? { clip } : {}) });
  const tapXY = (x, y) => page.touchscreen.tap(x, y);
  const tap = async sel => { const r = await page.locator(sel).first().boundingBox(); if (!r) throw new Error('not visible: ' + sel); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  const ev = (f, a) => page.evaluate(f, a);
  const wait = ms => page.waitForTimeout(ms);
  // what is at a viewport point: the top element and the whole stack (selector-ish names)
  const at = (x, y) => page.evaluate(([x, y]) => { const nm = n => n ? (n.id ? '#' + n.id : n.tagName.toLowerCase() + (n.className && n.className.baseVal === undefined && n.className ? '.' + String(n.className).trim().split(/\s+/).join('.') : '')) : null;
    return { top: nm(document.elementFromPoint(x, y)), stack: document.elementsFromPoint(x, y).slice(0, 6).map(nm) }; }, [x, y]);
  return { browser, ctx, page, errors, calm, shot, tap, tapXY, ev, wait, at, close: () => browser.close() };
}
const realErrors = errs => errs.filter(e => !/chip_love/.test(e));
module.exports = { boot, H, DIR, OUT, realErrors };

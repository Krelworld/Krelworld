// Chef Marina test harness (Playwright). Usage from any script:
//   const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
//   const g = await H.boot({ port: 8801, view: 'port', room: 'kitchen' });   // view: 'port' | 'land' | 'portSmall' | 'landSmall'
//   await g.calm(); await g.shot('/abs/path.png'); console.log(await g.controls()); await g.close();
// Run with:  NODE_PATH=$(npm root -g) node yourscript.js
const { chromium } = require('playwright'); const cp = require('child_process'); const http = require('http');
const DIR = '/home/user/Krelworld/public/chef-marina';
const VIEWS = { port: { width: 390, height: 844 }, land: { width: 844, height: 390 }, portSmall: { width: 375, height: 667 }, landSmall: { width: 667, height: 375 } };
function up(port) { return new Promise(r => { const q = http.get({ host: '127.0.0.1', port, path: '/index.html' }, res => { res.resume(); r(res.statusCode === 200); }); q.on('error', () => r(false)); q.setTimeout(1500, () => { q.destroy(); r(false); }); }); }
async function serve(port, dir) {
  if (await up(port)) return;
  cp.spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: dir || DIR, detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 24; i++) { await new Promise(r => setTimeout(r, 250)); if (await up(port)) return; }
  throw new Error('server did not start on ' + port);
}
// boot the game. start:false leaves it on the title screen. dir: serve a different copy of the game (e.g. a git worktree).
async function boot({ port = 8800, view = 'port', room = 'living', start = true, dir, dpr = 1, settle = 5000, storage } = {}) {
  await serve(port, dir);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWS[view] || view, isMobile: true, hasTouch: true, deviceScaleFactor: dpr });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/willReadFrequently|Failed to load resource/.test(t)) errors.push(m.type() + ': ' + t.slice(0, 200)); } });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  if (storage) { await page.evaluate(s => { for (const k in s) localStorage.setItem(k, s[k]); }, storage); await page.reload(); }
  await page.waitForTimeout(2500);
  if (start) { await page.evaluate(r => startGame(r), room); await page.waitForTimeout(settle); }
  // put the game into a quiet, idle state (no scene running, no menus open)
  const calm = () => page.evaluate(() => { G.busy = false; G.sceneOn = false; UI.closeActions(); if (window.clearWish) clearWish(); if (marina.mount) dismount();
    if (['cheer', 'sad', 'sit', 'perch', 'anim', 'stomp'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; marina.anim = null; } });
  const shot = (path, clip) => page.screenshot({ path, ...(clip ? { clip } : {}) });
  const tap = async sel => { const r = await page.locator(sel).first().boundingBox(); if (!r) throw new Error('not visible: ' + sel); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  // tap a point given in game-world coordinates (x along the room, y up/down; the floor is y≈164)
  const tapWorld = async (wx, wy) => { const pt = await page.evaluate(([x, y]) => { const st = document.getElementById('stage').getBoundingClientRect(); const [sx, sy] = toScreen(x, y); return [sx + st.left, sy + st.top]; }, [wx, wy]); await page.touchscreen.tap(pt[0], pt[1]); return pt; };
  // every visible button-like DOM control with its on-screen box (the game's furniture/people are drawn on a canvas and are NOT in this list)
  const controls = () => page.evaluate(() => { const out = []; for (const n of document.querySelectorAll('button,[role=button],.facecard,.bubble,.act,.mood,.tile,.slot')) { const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
      if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
      out.push({ id: n.id || '', cls: (n.className && n.className.toString()) || '', label: n.getAttribute('aria-label') || '', text: (n.textContent || '').trim().slice(0, 12), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), covered: !(top === n || n.contains(top) || (top && top.contains(n))) }); }
    return out; });
  return { browser, ctx, page, errors, calm, shot, tap, tapWorld, controls, close: () => browser.close() };
}
module.exports = { boot, serve, VIEWS, DIR };

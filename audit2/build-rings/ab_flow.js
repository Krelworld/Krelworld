// A/B of the 'request: ask, do it, get thanked' flow: HEAD (8847) vs this worktree (8873), side by side, regress.js's own steps.
const fs = require('fs'); const { chromium } = require('playwright');
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const SRC = fs.readFileSync('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/regress.js', 'utf8');
const IN_PAGE = SRC.slice(SRC.indexOf('const IN_PAGE = ') + 'const IN_PAGE = '.length, SRC.indexOf('\nasync function newPage')).trim().replace(/;$/, '');
const N = +(process.argv[3] || 4), out = process.argv[2], off = process.env.CLARITY_OFF || '';
async function side(name, port, dir, offFlags) {
  await H.serve(port, dir); const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true });
  if (offFlags) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, offFlags);
  const p = await ctx.newPage(); const res = [];
  const fresh = async room => { await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
    await p.evaluate('(' + IN_PAGE + ')()'); await p.evaluate(r => __start(r), room); await p.waitForTimeout(1100); await p.evaluate(() => __quiet()); await p.waitForTimeout(60); };
  const ev = fn => p.evaluate(fn); const tapSel = async (sel, n = 0) => { const loc = p.locator(sel).nth(n); await loc.waitFor({ state: 'attached', timeout: 8000 }); await loc.tap({ force: true }); };
  for (let k = 0; k < N; k++) {
    try { await fresh('dining');
      await ev(() => { rory.room = G.room; rory.hidden = false; rory.state = 'idle'; rory.x = marina.x + 50; G.rory = true; askRequest('gym'); }); await p.waitForTimeout(900); const btn = await p.locator('#reqBtn').count(); await tapSel('#reqBtn'); await p.waitForTimeout(900); const menu = await p.locator('.act').count();
      const where = await ev(() => G.room + '/' + Math.round(marina.x) + '/' + marina.state + '/busy:' + G.busy);
      await ev(() => { UI.closeActions(); doGym(GYM[0]); }); await p.waitForTimeout(11000); res.push(`button:${btn} menu:${menu > 0} thanked:${await ev(() => __said.includes('r_thanks'))} at:${where}`);
    } catch (e) { res.push('FAILED ' + e.message.split('\n')[0]); }
    console.log(name, res[res.length - 1]);
  }
  await browser.close(); return res;
}
(async () => {
  const [head, mine] = await Promise.all([side('HEAD', 8847, '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina', ''), side('mine', 8873, '/home/user/Krelworld/.wt/rings/public/chef-marina', off)]);
  fs.writeFileSync(out, JSON.stringify({ HEAD: head, mine }, null, 1)); console.log('written', out);
})().catch(e => { console.error(e); process.exit(1); });

// A/B re-press of the sweep's BEHAVES DIFF rows: HEAD (8847, arch/head) and this worktree (8850 all on, or CLARITY_OFF),
// side by side at the same moment, N presses each, exactly the way regress.js presses a choice (its own IN_PAGE code).
// usage: node ab.js <diff.txt> <out.json> [N=4] [off=''] [port=8850]
const fs = require('fs'); const { chromium } = require('playwright');
const AUD = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/';
const H = require(AUD + 'harness.js');
const [diffF, outF, nS = '4', off = '', portS = '8850'] = process.argv.slice(2); const N = +nS, MYPORT = +portS;
const src = fs.readFileSync(AUD + 'regress.js', 'utf8'); const IN_PAGE = eval('(' + src.slice(src.indexOf('const IN_PAGE = ') + 'const IN_PAGE = '.length, src.indexOf('\nasync function newPage')).trim().replace(/;$/, '') + ')');
const rows = []; for (const l of fs.readFileSync(diffF, 'utf8').split('\n')) { const m = l.match(/^BEHAVES DIFF\s+(.+?) \| (\S+#\d+) (.+)$/); if (m) rows.push({ key: m[1], id: m[2], ico: m[3] }); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function side(port, offv) {
  await H.serve(port, port === 8847 ? undefined : '/home/user/Krelworld/.wt/prompts/public/chef-marina');
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true });
  if (offv) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, offv);
  const page = await ctx.newPage();
  const fresh = async room => { await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
    await page.evaluate(IN_PAGE); await page.evaluate(r => __start(r), room); await page.waitForTimeout(1100); await page.evaluate(() => __quiet()); await page.waitForTimeout(60); };
  const press = async row => {
    await fresh('dining'); const ctxs = await page.evaluate(() => __contexts().map((c, i) => ({ i, key: c.key, room: c.room })));
    const c = ctxs.find(c => c.key === row.key); if (!c) return 'NOCTX';
    const [hash, nth] = row.id.split('#');
    await fresh(c.room === 'yard' ? 'yard' : c.room);
    const before = await page.evaluate(([ci, hash, nth]) => { const c = __contexts()[ci]; if (G.room !== c.room) { G.room = c.room; marina.room = c.room; } __quiet(); c.setup(); window.__lastActs = null; const acts = c.list() || []; let n = 0; const a = acts.find(a => __hash(String(a.fn)) === hash && ++n === +nth);
      if (!a) return { missing: true }; UI.closeActions(); window.__lastActs = null; window.__said.length = 0; const s0 = __snap(); G.busy = false; try { a.fn(); } catch (e) { return { threw: e.message, s0 }; } return { s0 }; }, [c.i, hash, nth]);
    if (before.missing) return 'MISSING'; if (before.threw) return 'THREW';
    await page.waitForTimeout(1600); let s2 = await page.evaluate(() => __snap()); let waited = 1600;
    while (s2.busy && !s2.panel && !s2.studio && !s2.story && waited < 26000) { await page.waitForTimeout(1000); waited += 1000; s2 = await page.evaluate(() => __snap()); }
    return Object.keys(s2).filter(k => !same(before.s0[k], s2[k]) && k !== 'busy' && k !== 'mess' && k !== 'overlays').map(k => k + ':' + JSON.stringify(before.s0[k]) + '→' + JSON.stringify(s2[k])).sort().join(' ') || '(no change)';
  };
  return { press, close: () => browser.close() };
}
(async () => {
  const A = await side(8847, ''), B = await side(MYPORT, off); const out = [];
  for (const row of rows) {
    const ra = [], rb = [];
    for (let i = 0; i < N; i++) { const [a, b] = await Promise.all([A.press(row), B.press(row)]); ra.push(a); rb.push(b); }
    const cnt = l => l.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
    const r = { row: row.key + ' | ' + row.id + ' ' + row.ico, HEAD: cnt(ra), MINE: cnt(rb) };
    r.overlap = Object.keys(r.HEAD).some(k => r.MINE[k]); out.push(r); console.log(JSON.stringify(r));
  }
  fs.writeFileSync(outF, JSON.stringify(out, null, 1)); await A.close(); await B.close();
})().catch(e => { console.error(e); process.exit(1); });

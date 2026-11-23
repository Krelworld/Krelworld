// A/B re-press of the sweep's BEHAVES DIFF rows: HEAD (8847, arch/head) vs this worktree (8860, all switches on, or
// CLARITY_OFF=... via env), side by side under identical conditions, with regress.js's own in-page helpers and procedure.
//   node ab_rows.js rows.json out.json [presses]
const fs = require('fs'); const { chromium } = require('playwright');
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const SRC = fs.readFileSync('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/regress.js', 'utf8');
const IN_PAGE = SRC.slice(SRC.indexOf('const IN_PAGE = ') + 'const IN_PAGE = '.length, SRC.indexOf('\nasync function newPage')).trim().replace(/;$/, '');
const rows = JSON.parse(fs.readFileSync(process.argv[2])), out = process.argv[3], N = +(process.argv[4] || 4), off = process.env.CLARITY_OFF || '';
const ARCH = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function side(name, port, dir, offFlags) {
  await H.serve(port, dir); const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true });
  if (offFlags) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, offFlags);
  const page = await ctx.newPage(); const res = {};
  const fresh = async room => { await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
    await page.evaluate('(' + IN_PAGE + ')()'); await page.evaluate(r => __start(r), room); await page.waitForTimeout(1100); await page.evaluate(() => __quiet()); await page.waitForTimeout(60); };
  for (const row of rows) {
    const [src, nth] = row.id.split('#'); const states = [];
    for (let k = 0; k < N; k++) {
      const ctxI = await (async () => { await fresh('dining'); return page.evaluate(key => __contexts().findIndex(c => c.key === key), row.key); })();
      const room = await page.evaluate(i => __contexts()[i].room, ctxI);
      await fresh(room === 'yard' ? 'yard' : room);
      const before = await page.evaluate(([i, src, nth]) => { const c = __contexts()[i]; if (G.room !== c.room) { G.room = c.room; marina.room = c.room; } __quiet(); c.setup(); const acts = c.list() || []; let n = 0; const a = acts.find(a => __hash(String(a.fn)) === src && ++n === +nth);
        if (!a) return { missing: true }; UI.closeActions(); window.__said.length = 0; const s0 = __snap(); G.busy = false; try { a.fn(); } catch (e) { return { threw: e.message }; } return { s0 }; }, [ctxI, src, nth]);
      if (before.missing || before.threw) { states.push(before.missing ? 'MISSING' : 'THREW'); continue; }
      await page.waitForTimeout(1600); const s1 = await page.evaluate(() => __snap()); let s2 = s1, waited = 1600;
      while (s2.busy && !s2.panel && !s2.studio && !s2.story && waited < 26000) { await page.waitForTimeout(1000); waited += 1000; s2 = await page.evaluate(() => __snap()); }
      const diff = (a, b) => Object.keys(b).filter(k => !same(a[k], b[k]) && k !== 'busy' && !/^mess|^overlays/.test(k)).map(k => k + ':' + JSON.stringify(a[k]) + '→' + JSON.stringify(b[k]));
      states.push(JSON.stringify(diff(before.s0, s2)));
    }
    res[row.key + ' | ' + row.id + ' ' + (row.ico || '')] = states; console.log(name, row.key, row.ico || '', JSON.stringify(states));
  }
  await browser.close(); return res;
}
(async () => {
  const [head, mine] = await Promise.all([side('HEAD', 8847, ARCH, ''), side(off ? 'mine(' + off + ' off)' : 'mine', 8873, '/home/user/Krelworld/.wt/rings/public/chef-marina', off)]);
  const cmp = {}; for (const k of Object.keys(head)) { const h = head[k].slice().sort(), m = mine[k].slice().sort(); cmp[k] = { HEAD: head[k], mine: mine[k], sameSet: same([...new Set(h)].sort(), [...new Set(m)].sort()), overlap: [...new Set(m)].every(x => h.includes(x)) || [...new Set(h)].every(x => m.includes(x)) }; }
  fs.writeFileSync(out, JSON.stringify(cmp, null, 1)); console.log('written', out);
})().catch(e => { console.error(e); process.exit(1); });

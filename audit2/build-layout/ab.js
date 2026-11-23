// A/B re-press of the sweep rows that differed: HEAD (8847, arch/head) vs this worktree (8904), identical conditions,
// same press procedure as regress.js (its IN_PAGE code is loaded verbatim). N presses each.
const fs = require('fs'); const { chromium } = require('playwright'); const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const src = fs.readFileSync('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/regress.js', 'utf8');
const IN_PAGE = src.slice(src.indexOf('const IN_PAGE = () => {') + 'const IN_PAGE = '.length, src.indexOf('\nasync function newPage')).trim().replace(/;$/, '');
const [diffFile, outFile, N] = [process.argv[2], process.argv[3], +(process.argv[4] || 4)];
const rows = []; for (const l of fs.readFileSync(diffFile, 'utf8').split('\n')) { const m = l.match(/^BEHAVES DIFF\s+(.+?) \| (\S+)#(\d+) /); if (m) rows.push({ key: m[1], src: m[2], nth: +m[3] }); }
const off = process.env.CLARITY_OFF || '';
(async () => {
  const out = { rows: rows.map(r => r.key + ' | ' + r.src + '#' + r.nth) };
  for (const [name, port, dir] of [['HEAD', 8847, '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina'], ['WT', 8904, '/home/user/Krelworld/.wt/layout/public/chef-marina']]) {
    await H.serve(port, dir); const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true });
    if (off && name === 'WT') await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
    const page = await ctx.newPage(); out[name] = {};
    for (const r of rows) { const st = [];
      for (let i = 0; i < N; i++) {
        await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
        await page.evaluate('(' + IN_PAGE + ')()');
        const room = await page.evaluate(k => __contexts().find(c => c.key === k).room, r.key);
        await page.evaluate(rm => __start(rm), room === 'yard' ? 'yard' : room); await page.waitForTimeout(1100); await page.evaluate(() => __quiet()); await page.waitForTimeout(60);
        const b = await page.evaluate(r => { const c = __contexts().find(c => c.key === r.key); if (G.room !== c.room) { G.room = c.room; marina.room = c.room; } __quiet(); c.setup(); window.__lastActs = null; const acts = c.list() || []; let n = 0; const a = acts.find(a => __hash(String(a.fn)) === r.src && ++n === r.nth); if (!a) return { missing: true };
          UI.closeActions(); window.__lastActs = null; const s0 = __snap(); G.busy = false; a.fn(); return { s0 }; }, r);
        if (b.missing) { st.push('MISSING'); continue; }
        await page.waitForTimeout(1600); const s1 = await page.evaluate(() => __snap());
        const d = Object.keys(s1).filter(k => k !== 'busy' && JSON.stringify(b.s0[k]) !== JSON.stringify(s1[k]) && !['mess', 'overlays'].includes(k)).map(k => k + ':' + s1[k]);
        st.push(d.join(';') || '-'); await page.waitForTimeout(1500);
      }
      out[name][r.key + ' | ' + r.src] = st.join(' , '); console.log(name, r.key, '=>', st.join(' , '));
    }
    await browser.close();
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

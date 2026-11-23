// A/B re-press of the sweep's differing rows, exactly as regress.js presses them (its own in-page code, extracted from its
// source), against HEAD (8847 = arch/head) and this worktree (8880), N presses each, one page, same machine, back to back.
// usage: node ab_mine.js <rows.json> <out.json> [N] [CLARITY_OFF for the worktree]
const fs = require('fs'); const { chromium } = require('playwright');
const SRC = fs.readFileSync('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/regress.js', 'utf8');
const IN_PAGE = eval('(' + SRC.slice(SRC.indexOf('const IN_PAGE = ') + 'const IN_PAGE = '.length, SRC.indexOf('\nasync function newPage')).trim().replace(/;$/, '') + ')');
const [rowsF, outF, N = '4', OFF = ''] = process.argv.slice(2);
const ROWS = JSON.parse(fs.readFileSync(rowsF));     // [{ key, id, room }]
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
(async () => {
  const out = { HEAD: {}, bubbles: {} }, P = {};
  // both builds open side by side; presses alternate HEAD, bubbles, HEAD, bubbles… so both see the same machine load
  for (const [name, port, off] of [['HEAD', 8847, ''], ['bubbles', 8880, OFF]]) {
    const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
    const page = await ctx.newPage();
    const fresh = async room => { await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
      await page.evaluate(IN_PAGE); await page.evaluate(r => __start(r), room); await page.waitForTimeout(1100); await page.evaluate(() => __quiet()); await page.waitForTimeout(60); };
    P[name] = { browser, page, fresh };
  }
  const press = async (name, row) => { const { page, fresh } = P[name];
    await fresh(row.room === 'yard' ? 'yard' : row.room);
    const before = await page.evaluate(([key, id]) => { const [src, nth] = id.split('#'); const ctxs = __contexts(); const c = ctxs.find(x => x.key === key); if (!c) return { missing: 'ctx' };
      if (G.room !== c.room) { G.room = c.room; marina.room = c.room; } __quiet(); c.setup(); window.__lastActs = null; const acts = c.list() || []; let n = 0; const a = acts.find(a => __hash(String(a.fn)) === src && ++n === +nth);
      if (!a) return { missing: 'choice' }; UI.closeActions(); window.__lastActs = null; window.__said.length = 0; const s0 = __snap(); G.busy = false; a.fn(); return { s0 }; }, [row.key, row.id]);
    if (before.missing) return 'MISSING ' + before.missing;
    await page.waitForTimeout(1600); let s2 = await page.evaluate(() => __snap()), waited = 1600;
    while (s2.busy && !s2.panel && !s2.studio && !s2.story && waited < 26000) { await page.waitForTimeout(1000); waited += 1000; s2 = await page.evaluate(() => __snap()); }
    const late = Object.keys(s2).filter(k => !same(before.s0[k], s2[k]) && k !== 'busy' && !/^mess$|^overlays$/.test(k)).map(k => k + ':' + JSON.stringify(before.s0[k]) + '→' + JSON.stringify(s2[k]));
    return late.join(' ') || '(none)'; };
  for (const row of ROWS) { const k = row.key + ' | ' + row.id; out.HEAD[k] = []; out.bubbles[k] = [];
    for (let i = 0; i < +N; i++) for (const name of (i % 2 ? ['bubbles', 'HEAD'] : ['HEAD', 'bubbles'])) out[name][k].push(await press(name, row)); }
  for (const name of Object.keys(P)) await P[name].browser.close();
  fs.writeFileSync(outF, JSON.stringify(out, null, 1));
  for (const k of Object.keys(out.HEAD)) console.log(k, '\n   HEAD:   ', out.HEAD[k].join(' ; '), '\n   bubbles:', out.bubbles[k].join(' ; '));
})().catch(e => { console.error(e); process.exit(1); });

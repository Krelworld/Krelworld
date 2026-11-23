// A/B re-press: every row a sweep diff flagged (BEHAVES DIFF / BROKEN), pressed exactly the way regress.js presses it,
// alternately in HEAD (8847, arch/head) and in this build (8890), K times each, same pages and timing for both.
//   node ab_rows.js <diff.txt> <out.json> [K=3] [off=G16,...]  (off: CLARITY_OFF for this build's pages)
const fs = require('fs'); const { chromium } = require('playwright'); const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const SRC = fs.readFileSync('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/regress.js', 'utf8');
const IN_PAGE = SRC.slice(SRC.indexOf('const IN_PAGE = ') + 'const IN_PAGE = '.length, SRC.indexOf('\n};\n', SRC.indexOf('const IN_PAGE = ')) + 2);
const [diffFile, outFile] = process.argv.slice(2, 4), K = +(process.argv[4] || 3), OFF = process.argv[5] || '';
const rows = []; for (const m of fs.readFileSync(diffFile, 'utf8').matchAll(/^(?:BEHAVES DIFF|BROKEN)\s+(.+?) \| (\S+#\d+) /gm)) rows.push({ key: m[1], id: m[2] });
const BUILDS = [['HEAD', 8847, '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina', ''], ['dock', 8890, '/home/user/Krelworld/.wt/dock/public/chef-marina', OFF]];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function page(browser, port, off) {
  const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true }); if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push('PAGEERR ' + e.message));
  const fresh = async room => { errors.length = 0; await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
    await p.evaluate('(' + IN_PAGE + ')()'); await p.evaluate(r => __start(r), room); await p.waitForTimeout(1100); await p.evaluate(() => __quiet()); await p.waitForTimeout(60); errors.length = 0; };
  return { p, errors, fresh, close: () => ctx.close() };
}
async function press(pg, row) {
  // find the situation by key and the choice by handler hash + nth, exactly as regress.js does
  await pg.fresh('dining'); const ctx = await pg.p.evaluate(k => { const C = __contexts(); const i = C.findIndex(c => c.key === k); return i < 0 ? null : { i, room: C[i].room }; }, row.key); if (!ctx) return 'NOSITUATION';
  await pg.fresh(ctx.room === 'yard' ? 'yard' : ctx.room);
  const [src, nth] = row.id.split('#');
  const before = await pg.p.evaluate(j => { const c = __contexts()[j.i]; if (G.room !== c.room) { G.room = c.room; marina.room = c.room; } __quiet(); c.setup(); window.__lastActs = null; const acts = c.list() || []; let n = 0; const a = acts.find(a => __hash(String(a.fn)) === j.src && ++n === j.nth);
    if (!a) return { missing: true }; UI.closeActions(); window.__lastActs = null; window.__said.length = 0; const s0 = __snap(); G.busy = false; try { a.fn(); } catch (e) { return { threw: e.message, s0 }; } return { s0 }; }, { i: ctx.i, src, nth: +nth });
  if (before.missing) return 'MISSING'; if (before.threw) return 'THREW';
  await pg.p.waitForTimeout(1600); const s1 = await pg.p.evaluate(() => __snap());
  let s2 = s1, waited = 1600; while (s2.busy && !s2.panel && !s2.studio && !s2.story && waited < 26000) { await pg.p.waitForTimeout(1000); waited += 1000; s2 = await pg.p.evaluate(() => __snap()); }
  const diff = (a, b) => Object.keys(b).filter(k => !same(a[k], b[k]) && k !== 'busy' && k !== 'mess' && k !== 'overlays').map(k => k + ':' + JSON.stringify(a[k]) + '→' + JSON.stringify(b[k]));
  return JSON.stringify(diff(before.s0, s2)) + (pg.errors.length ? ' ERR' : '');
}
(async () => {
  for (const b of BUILDS) await H.serve(b[1], b[2]);
  const browser = await chromium.launch(); const res = {}; for (const r of rows) res[r.key + ' | ' + r.id] = { HEAD: [], dock: [] };
  const PAGES = 2; const pages = {}; for (const [name, port, , off] of BUILDS) { pages[name] = []; for (let i = 0; i < PAGES; i++) pages[name].push(await page(browser, port, off)); }
  const jobs = []; for (let k = 0; k < K; k++) for (const r of rows) jobs.push(r);
  let next = 0;
  await Promise.all(Array.from({ length: PAGES }, (_, w) => (async () => { while (next < jobs.length) { const r = jobs[next++];
    for (const name of (next % 2 ? ['HEAD', 'dock'] : ['dock', 'HEAD'])) { let v; try { v = await press(pages[name][w], r); } catch (e) { v = 'HARNESS ' + e.message.split('\n')[0]; } res[r.key + ' | ' + r.id][name].push(v); } } })()));
  await browser.close();
  // verdict per row: noise if HEAD and dock share an outcome, or HEAD itself varies; otherwise CONSISTENT DIFF
  const out = {}; let consistent = 0;
  for (const [k, v] of Object.entries(res)) { const hs = new Set(v.HEAD), ds = new Set(v.dock); const shared = [...ds].some(x => hs.has(x)); const verdict = shared ? 'noise (same outcome seen in both)' : hs.size > 1 ? 'noise (HEAD varies)' : 'CONSISTENT DIFF'; if (verdict === 'CONSISTENT DIFF') consistent++; out[k] = { verdict, HEAD: v.HEAD, dock: v.dock }; }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1)); console.log(rows.length, 'rows,', K, 'presses each per build; consistent diffs:', consistent);
  for (const [k, v] of Object.entries(out)) if (v.verdict === 'CONSISTENT DIFF') console.log('CONSISTENT DIFF', k, '\n   HEAD:', v.HEAD.join(' / '), '\n   dock:', v.dock.join(' / '));
})().catch(e => { console.error(e); process.exit(1); });

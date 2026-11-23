const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8870, view: 'port', room: 'kitchen' }); await g.calm(); const page = g.page;
  await L.quiet(page, 'kitchen'); await page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; marina.stop(); marina.x = 70; });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__log = []; let last = ''; const f = () => { const S = Clarity.G18; const k = (S.target ? S.target.id : '-') + '|' + (marina.moving ? 'm' : '-') + '|' + Math.round(marina.x) + '|' + document.querySelectorAll('#fx .act').length; if (k !== last) { last = k; __log.push([+E.t.toFixed(2), k]); } requestAnimationFrame(f); }; requestAnimationFrame(f);
    const _i = Clarity.inner('interact'); window.__hits = []; Clarity.hook('interact', 'G18', { order: 1, before(c) { __hits.push(c.args[0].kind + ':' + (c.args[0].p ? c.args[0].p.id : c.args[0].e ? c.args[0].e.id : '')); } }); });
  const pts = await page.evaluate(() => { const f = id => { const c = []; for (let y = 40; y <= 182; y += 2) for (let x = 0; x <= 187; x += 2) { const h = hitTest(x, y); if (h && h.kind === 'prop' && h.p.id === id) { const [cx, cy] = Clarity.toClient(x, y); if ([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => Clarity.onCanvas(cx + dx, cy + dy))) c.push([cx, cy, x, y]); } } return c[Math.floor(c.length / 2)]; }; return [f('sink'), f('stove')]; });
  console.log(JSON.stringify(pts));
  await page.touchscreen.tap(pts[0][0], pts[0][1]); await page.waitForTimeout(250);
  const mid = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const [wx, wy] = Clarity.fromClient(x, y); const h = hitTest(wx, wy); return [el && (el.id || el.className), h && h.kind + ':' + (h.p ? h.p.id : '')]; }, pts[1]);
  await page.touchscreen.tap(pts[1][0], pts[1][1]); await page.waitForTimeout(2500);
  console.log(JSON.stringify(mid), JSON.stringify(await page.evaluate(() => ({ log: __log, hits: __hits }))));
  await g.close();
})();

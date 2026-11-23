// only section 3 of g18.js, repeated, in port
const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8870, view: process.argv[2] || 'port', room: 'kitchen' }); await g.calm(); const page = g.page;
  await page.evaluate(() => { window.__g18log = []; let last = ''; const f = () => { try { const S = Clarity.G18, m = (marina.mount || marina).moving, k = (S.target ? S.target.id : '-') + '|' + (m ? 'm' : '-') + '|' + Math.round(marina.x) + '|' + document.querySelectorAll('#fx .act').length + '|' + G.busy + '|' + marina.state; if (k !== last) { last = k; __g18log.push([+E.t.toFixed(3), k]); } } catch (e) { } requestAnimationFrame(f); }; requestAnimationFrame(f);
    window.__taps = []; Clarity.hook('onTap', 'G18', { order: 1, before(c) { __taps.push(['onTap', +E.t.toFixed(2), G.busy]); } }); Clarity.hook('interact', 'G18', { order: 1, before(c) { __taps.push(['interact', +E.t.toFixed(2), c.args[0].kind + ':' + (c.args[0].p ? c.args[0].p.id : c.args[0].e ? c.args[0].e.id : '')]); } }); });
  for (let k = 0; k < 4; k++) {
    await L.quiet(page, 'kitchen'); await page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; marina.stop(); marina.x = 70; marina.state = 'idle'; });
    await page.waitForTimeout(2000);
    const pts = await page.evaluate(() => { const f = id => { const c = []; for (let y = 40; y <= 182; y += 2) for (let x = Math.max(0, E.camX); x <= E.camX + E.viewW; x += 2) { const h = hitTest(x, y); if (h && h.kind === 'prop' && h.p.id === id) { const [cx, cy] = Clarity.toClient(x, y); if ([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => Clarity.onCanvas(cx + dx, cy + dy))) c.push([cx, cy]); } } return c[Math.floor(c.length / 2)]; }; return [f('sink'), f('stove')]; });
    await page.evaluate(() => { __g18log.length = 0; __taps.length = 0; });
    await page.touchscreen.tap(pts[0][0], pts[0][1]); await page.waitForTimeout(250);
    await page.touchscreen.tap(pts[1][0], pts[1][1]); await page.waitForTimeout(2500);
    console.log(k, JSON.stringify(await page.evaluate(() => ({ taps: __taps, log: __g18log.filter((x, i, a) => i === 0 || x[1].split('|')[0] !== a[i - 1][1].split('|')[0] || x[1].split('|')[3] !== a[i - 1][1].split('|')[3] || x[1].split('|')[1] !== a[i - 1][1].split('|')[1]) }))));
    await page.evaluate(() => UI.closeActions());
  }
  await g.close();
})();

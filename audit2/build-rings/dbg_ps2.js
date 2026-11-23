const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8870, view: 'portSmall', room: 'playroom' }); await g.calm(); await L.quiet(g.page, 'playroom');
  await g.page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; marina.x = 224; marina.y = FLOOR; marina.stop(); });
  await g.page.waitForTimeout(2500);
  const r = await g.page.evaluate(() => { const nm = h => !h ? '' : h.kind === 'prop' ? h.p.id : h.kind; const out = { camX: E.camX, mx: marina.x, n: 0, onC: 0, els: {} };
    for (let y = 100; y <= 182; y += 1) for (let x = 150; x <= 260; x += 1) { if (nm(hitTest(x, y)) !== 'rocker') continue; Clarity.set('G8', false); const off = nm(hitTest(x, y)); Clarity.set('G8', true); if (off !== 'toyshelf') continue; out.n++; const [cx, cy] = Clarity.toClient(x, y); const el = document.elementFromPoint(cx, cy); const k = el && (el.id || el.className); out.els[k] = (out.els[k] || 0) + 1; }
    return out; });
  console.log(JSON.stringify(r)); await g.shot(L.OUT + 'shots/dbg_ps2.png'); await g.close();
})();

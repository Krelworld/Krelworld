const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8870, view: 'portSmall', room: 'playroom' }); await g.calm(); await L.quiet(g.page, 'playroom');
  await g.page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; marina.x = 236; marina.y = FLOOR; });
  await g.page.waitForTimeout(2000);
  const r = await g.page.evaluate(() => { const out = { camX: E.camX, viewW: E.viewW, pts: [] }; for (let y = 100; y <= 146; y += 2) for (let x = 176; x <= 200; x += 1) { const h = hitTest(x, y); if (h && h.kind === 'prop' && h.p.id === 'rocker') { const [cx, cy] = Clarity.toClient(x, y); const el = document.elementFromPoint(cx, cy); out.pts.push([x, y, Math.round(cx), Math.round(cy), el && (el.id || el.className)]); } } return out; });
  console.log(r.camX, r.viewW, r.pts.length, JSON.stringify(r.pts.slice(0, 12)));
  await g.shot(L.OUT + 'shots/dbg_ps.png'); await g.close();
})();

const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8870, view: 'land', room: 'kitchen', dpr: 3 }); await g.calm(); await L.quiet(g.page, 'kitchen');
  await g.page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === G.room) e.room = 'yard'; marina.x = 200; marina.y = 175; E.camX = 120; });
  await g.page.waitForTimeout(800);
  // overlay: paint each 1-unit grid point that G8 hands to the rocker (red) / rocker today (blue)
  const clip = await g.page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const a = toScreen(296, 110), b = toScreen(396, 184); return { x: a[0] + st.left, y: a[1] + st.top, width: b[0] - a[0], height: b[1] - a[1] }; });
  await g.shot(L.OUT + 'shots/g8_island_plain.png', clip);
  await g.page.evaluate(() => { const fx = document.getElementById('fx'); const st = document.getElementById('stage').getBoundingClientRect();
    for (let y = 110; y <= 184; y += 1) for (let x = 296; x <= 396; x += 1) { const h = hitTest(x, y); Clarity.set('G8', false); const o = hitTest(x, y); Clarity.set('G8', true);
      const id = h && h.kind === 'prop' ? h.p.id : '', io = o && o.kind === 'prop' ? o.p.id : ''; let c = null;
      if (id === 'island' && io !== 'island') c = 'rgba(255,0,0,.75)'; else if (id === 'island') c = 'rgba(0,80,255,.75)';
      if (!c) continue; const [sx, sy] = toScreen(x, y); const d = document.createElement('div'); d.className = 'dbgdot'; Object.assign(d.style, { position: 'absolute', left: (sx - 1) + 'px', top: (sy - 1) + 'px', width: '2px', height: '2px', background: c }); fx.append(d); } });
  await g.shot(L.OUT + 'shots/g8_island_dots.png', clip);
  await g.close();
})();

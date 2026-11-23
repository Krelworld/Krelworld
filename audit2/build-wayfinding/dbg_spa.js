const { boot, OUT } = require('./lib.js');
(async () => {
  const g = await boot({ view: 'port', room: 'living' }); await g.calm(); await g.go('spa', 1500);
  for (const mx of [264, 200, 150]) {
    await g.ev(mx => { marina.x = mx; }, mx); await g.wait(2000);
    const r = await g.ev(() => { const ex = PROPS.spa.find(p => p.id === 'spaback'); const x = Math.max(E.camX, 0) + 14; const rows = {};
      for (const y of [158, 161, 164, 166, 168, 151]) { const hs = new Set(); for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const h = hitTest(x - 10.5 + 21 * i / 4, y - 11.5 + 23 * j / 4); if (h) hs.add(h.kind + ':' + (h.p ? h.p.id : h.e ? h.e.id : '')); } rows[y] = [...hs].join(','); }
      return { cam: Math.round(E.camX), x: Math.round(x), exitOff: ex.x < E.camX, tab: Clarity.G35.tab, props: PROPS.spa.map(p => p.id + '@' + p.x).join(' '), rows }; });
    console.log(mx, JSON.stringify(r));
  }
  await g.shot(OUT + 'shots/dbg_spa.png'); await g.close();
})();

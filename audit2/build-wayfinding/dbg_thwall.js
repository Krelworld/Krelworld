const { boot, TH } = require('./lib.js');
(async () => {
  for (const mode of ['off', 'on']) {
    const g = await boot({ view: 'portSmall', room: 'kitchen', off: mode === 'off' ? 'G35' : '', storage: { cm_builds: TH } }); await g.calm(); await g.go('treehouse_oak', 1500);
    const out = [];
    for (const wait of [1300, 3000]) {
      await g.ev(() => { G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.state = 'idle'; marina.x = 100; }); await g.wait(wait);
      const pt = await g.ev(() => { const [px, py] = Clarity.toClient(66, 100); const n = document.elementFromPoint(px, py); const h = hitTest(66, 100); return [px, py, n && (n.id || n.className), h && h.kind + ':' + (h.p ? h.p.id : ''), Math.round(E.camX)]; });
      await g.page.touchscreen.tap(pt[0], pt[1]); await g.wait(2600);
      out.push(JSON.stringify(pt) + ' → ' + await g.ev(() => [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join('') || 'none'));
      await g.ev(() => UI.closeActions()); await g.wait(300);
    }
    console.log(mode, out.join(' | ')); await g.close();
  }
})();

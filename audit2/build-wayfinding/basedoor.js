// the foyer basement doorway: its ⬇️ (and with G35 the 🛋️ beside it) still lead down when tapped; G35 on vs off
const { boot, OUT } = require('./lib.js');
(async () => {
  for (const view of ['port', 'land']) for (const mode of ['on', 'off']) {
    const g = await boot({ view, room: 'foyer', off: mode === 'off' ? 'G35' : '' }); await g.calm();
    const out = [];
    for (const dx of mode === 'on' ? [-5, 5] : [0]) {
      await g.go('foyer', 1500); await g.ev(() => { G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.state = 'idle'; marina.x = 170; for (const e of ENTS) if (e !== marina && e.room === 'foyer') { e.stop && e.stop(); e.room = 'kitchen'; } }); await g.wait(2200);
      if (dx === 5) await g.shot(OUT + `shots/basedoor_${view}.png`);
      const pt = await g.ev(dx => { const p = PROPS.foyer.find(q => q.id === 'basedoor'), T = p.y - p.h, x = p.x + dx, y = T + 46; const c = Clarity.toClient(x, y), n = document.elementFromPoint(c[0], c[1]), h = hitTest(x, y); return { c, top: n && n.id, hit: h && h.kind + ':' + (h.p ? h.p.id : '') }; }, dx);
      await g.page.touchscreen.tap(pt.c[0], pt.c[1]); await g.wait(3500);
      out.push((dx < 0 ? '⬇️' : dx > 0 ? '🛋️' : '⬇️(today)') + ' hit=' + pt.hit + ' top=' + pt.top + ' → ' + await g.ev(() => G.room + '@' + Math.round(marina.x)));
    }
    console.log(view, mode, out.join(' | '), g.realErrors()); await g.close();
  }
})();

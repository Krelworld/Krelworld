const { boot, OUT, TH, VIEWS } = require('./lib.js');
(async () => {
  for (const view of VIEWS) {
    const g = await boot({ view, room: 'foyer', storage: { cm_builds: TH } }); await g.calm(); await g.wait(1200);
    await g.shot(OUT + 'shots/smoke_foyer_' + view + '.png');
    const st = await g.ev(() => ({ room: G.room, signs: Clarity.G35.signs.map(s => ({ id: s.p.id, spot: s.spot, ok: s.ok })), cam: E.camX, viewW: E.viewW }));
    console.log(view, JSON.stringify(st));
    await g.go('den', 1800); await g.wait(800); await g.shot(OUT + 'shots/smoke_den_' + view + '.png');
    console.log(view, JSON.stringify(await g.ev(() => ({ room: G.room, signs: Clarity.G35.signs.map(s => ({ id: s.p.id, spot: s.spot, ok: s.ok })), cam: E.camX }))));
    await g.ev(() => openIsoMap()); await g.wait(700); await g.shot(OUT + 'shots/smoke_map_den_' + view + '.png'); await g.ev(() => document.querySelector('#panel .ptop button').click()); await g.wait(300);
    console.log(view, 'errors', g.realErrors());
    await g.close();
  }
})();

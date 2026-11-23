const { boot, OUT, TH } = require('./lib.js');
(async () => {
  for (const view of ['port', 'land']) {
    const g = await boot({ view, room: 'kitchen', storage: { cm_builds: TH } }); await g.calm();
    await g.go('uphall');
    await g.ev(() => openIsoMap()); await g.wait(600);
    await g.shot(OUT + 'shots/base_map_' + view + '.png');
    const info = await g.ev(() => { const r = s => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); };
      return { ptop: r('.ptop'), wrap: r('.isowrap'), img: r('.isowrap img'), fmap: r('.fmap'), rows: [...document.querySelectorAll('.fmaprow')].map(n => { const b = n.getBoundingClientRect(); return [n.firstChild.textContent, Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }), x: r('.ptop button'), floors: Floors.list.map(f => f.id) }; });
    console.log(view, JSON.stringify(info));
    console.log(g.realErrors());
    await g.close();
  }
})();

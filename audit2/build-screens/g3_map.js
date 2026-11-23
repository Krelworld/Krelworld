const { boot, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { for (const off of ['', 'G3']) for (const v of ['land', 'landSmall']) { const g = await boot({ port: 8910, view: v, room: 'living', off }); await g.calm(); await g.ev(TLIB);
  const r = await g.ev(async () => { await T.reset(); openIsoMap(); await T.sleep(500); const im = document.querySelector('#panel .isowrap img'), ir = im ? im.getBoundingClientRect() : null;
    const rows = [...document.querySelectorAll('#panel .fmaprow')].map(row => { const t = [...row.children].map(c => Math.round(c.getBoundingClientRect().top)); return new Set(t).size; });
    const hits = Object.values(T.underX().pts).flatMap(p => p.hits); const over = document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('#panel *')].some(n => n.getBoundingClientRect().right > innerWidth + 1);
    return { house: ir ? [Math.round(ir.width), Math.round(ir.height)] : null, rowLines: rows, hitsUnderX: hits, overflowRight: over }; });
  console.log(v, off || 'on', JSON.stringify(r), realErrors(g.errors)); await g.close(); } })();

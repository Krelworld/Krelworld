const { boot } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { for (const v of ['land', 'landSmall']) {
  const g = await boot({ port: 8910, view: v, room: 'kitchen' }); await g.calm(); await g.ev(TLIB);
  console.log(v, JSON.stringify(await g.ev(async () => { await T.reset(); UI.openCook('fridge'); await T.sleep(300); const pb = document.querySelector('#panel .pbody'), cs = getComputedStyle(pb), R = s => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; };
    return { rows: cs.gridTemplateRows, cols: cs.gridTemplateColumns, pb: R('#panel .pbody'), ptop: R('#panel .ptop'), tray: R('#panel .pbody>.tray'), ctl: R('#panel .pbody>.row:not(.shelves)'), shelves: R('#panel .pbody>.row.shelves'), grid: R('#panel .grid.ing'), tile: R('#panel .grid.ing .tile') }; })));
  await g.close(); } })();

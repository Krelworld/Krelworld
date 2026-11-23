// G14 checks: portrait strip at 375 and 390 on every floor; centres hit; 🚽 on screen; dots; highlight; position next to the map.
const { boot, OUT, MINE } = require('./lib.js'); const fs = require('fs');
(async () => {
  const res = {};
  for (const view of ['portSmall', 'port', { width: 375, height: 553 }, { width: 390, height: 664 }]) for (const [mode, off] of [['TODAY', MINE], ['G14', '']]) {
    const vn = typeof view === 'string' ? view : view.width + 'x' + view.height, key = vn + ' ' + mode;
    const g = await boot({ view, room: 'living', off }); const p = g.page; res[key] = {};
    for (const room of ['living', 'yard', 'den', 'mroom', 'pool', 'backyard']) {
      await g.calm(); await p.evaluate(r => { travelTo(r); daddy.room = r; daddy.x = 60; daddy.hidden = false; }, room); await p.waitForTimeout(1500);
      res[key][room] = await p.evaluate(() => {
        const bar = document.getElementById('roombar').getBoundingClientRect(), map = document.getElementById('mapBtn').getBoundingClientRect();
        const bs = [...document.querySelectorAll('#roombar .rb')].map(b => { const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { r: b.dataset.r, x0: +r.left.toFixed(1), x1: +r.right.toFixed(1), w: +b.offsetWidth, hit: t === b || b.contains(t) ? 'ok' : 'COVERED:' + (t && (t.id || t.className)), here: b.classList.contains('here') ? getComputedStyle(b).transform : '', dot: b.classList.contains('busy') ? getComputedStyle(b, '::after').backgroundColor : '' }; });
        const w = document.getElementById('weatherBtn'), wr = w.getBoundingClientRect();
        return { bar: [bar.left, bar.right].map(v => +v.toFixed(1)), gapToMap: +(bar.left - map.right).toFixed(1), last: bs[bs.length - 1], offscreen: bs.filter(b => b.x1 > innerWidth).map(b => b.r), covered: bs.filter(b => b.hit !== 'ok').map(b => b.r + ' ' + b.hit), widths: [...new Set(bs.map(b => b.w))].join('/'),
          here: bs.filter(b => b.here).map(b => b.r + ' ' + b.here), dots: bs.filter(b => b.dot).map(b => b.r + ' ' + b.dot), weather: w.classList.contains('hidden') ? null : [wr.left, wr.top, wr.right, wr.bottom].map(Math.round), order: bs.map(b => b.r).join(',') }; });
      if (room === 'living' || room === 'yard') await g.shot(OUT + 'shots/g14_' + vn + '_' + room + '_' + mode + '.png', { x: 0, y: 0, width: typeof view === 'string' ? (view === 'port' ? 390 : 375) : view.width, height: 130 });
    }
    res[key].errors = g.errors.filter(e => !/chip_love/.test(e));
    console.log(key, JSON.stringify(res[key]));
    await g.close();
  }
  fs.writeFileSync(OUT + 'g14.json', JSON.stringify(res, null, 1));
})();

// G3: crafts ➕ then 🖍️ (and straight ✂️): kx == ky, and a stroke at the canvas's bottom-right corner lands under the finger
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const L = { land: ['land', null], landSmall: ['landSmall', null], '844x340': [{ width: 844, height: 340 }, null], '844x340i47': [{ width: 844, height: 340 }, { left: 47, right: 47, bottom: 21 }] };
(async () => { const res = {};
  for (const v of Object.keys(L)) for (const off of ['', 'G3']) {
    const g = await boot({ port: 8910, view: L[v][0], inset: L[v][1], room: 'dining', off }); await g.calm(); await g.ev(TLIB);
    const o = {};
    for (const how of ['draw', 'cut']) {
      const r = await g.ev(async how => { await T.reset(); if (how === 'draw') { UI.openCrafts('math'); await T.sleep(60); T.tab('#panel .pbody > .row .pbtn', 0); } else UI.openCrafts('cut'); await T.sleep(400);
        const c = document.getElementById('drawCv'); c.scrollIntoView({ block: 'end' }); await T.sleep(100); const r = c.getBoundingClientRect(); return { kx: +(c.width / r.width).toFixed(4), ky: +(c.height / r.height).toFixed(4), r: [r.left, r.top, r.right, r.bottom], lane: !!(Clarity.G3 && Clarity.G3.lane) }; }, how);
      if (how === 'draw') {
        const [x0, y0] = [r.r[2] - 40, r.r[3] - 20], [x1, y1] = [r.r[2] - 10, r.r[3] - 6];
        await g.page.mouse.move(x0, y0); await g.page.mouse.down(); for (let i = 1; i <= 8; i++) await g.page.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await g.page.mouse.up(); await g.wait(100);
        r.stroke = await g.ev(pts => { const c = document.getElementById('drawCv'), q = c.getBoundingClientRect(), x = c.getContext('2d'); return pts.map(([px, py]) => { const bx = Math.round((px - q.left) * c.width / q.width), by = Math.round((py - q.top) * c.height / q.height), d = x.getImageData(bx, by, 1, 1).data; return { bx, by, inked: !(d[0] > 240 && d[1] > 240 && d[2] > 240) }; }); }, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]]);
        // and 12 px above the stroke stays white (it did not land below or above the finger)
        r.above = await g.ev(([px, py]) => { const c = document.getElementById('drawCv'), q = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(Math.round((px - q.left) * c.width / q.width), Math.round((py - 14 - q.top) * c.height / q.height), 1, 1).data; return !(d[0] > 240 && d[1] > 240 && d[2] > 240); }, [(x0 + x1) / 2, (y0 + y1) / 2]);
      }
      o[how] = r;
    }
    o.errors = realErrors(g.errors); res[v + (off ? ' G3off' : '')] = o; console.log(v + (off ? ' G3off' : ''), JSON.stringify(o));
    await g.close();
  }
  fs.writeFileSync(OUT + 'g3_stroke.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

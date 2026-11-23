// G3: elementsFromPoint under #xFloat (centre + 4 corners) on every classic screen, G3 on vs off, at land, landSmall and
// 844x340 with real 47 px side insets (+21 px bottom). Also the glyph #xFloat shows on each screen.
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const VIEWS = [['land', 'land', null], ['landSmall', 'landSmall', null], ['844x340i47', { width: 844, height: 340 }, { left: 47, right: 47, bottom: 21 }], ['844x340', { width: 844, height: 340 }, null]];
const seed = { cm_builds: JSON.stringify({ builds: [{ kind: 'swing', spot: 'g1' }] }), cm_lastDrawing: null };
(async () => {
  const res = {};
  for (const off of ['', 'G3']) for (const [name, view, inset] of VIEWS) {
    const g = await boot({ port: 8910, view, room: 'backyard', off, inset }); await g.calm(); await g.ev(TLIB);
    // a build of Jeff's so the take-down view exists, and a drawing so ✂️ has something
    await g.ev(() => { const c = Builder.catalogue.find(c => Object.values(Builder.spots).some(s => s.type === c.spot)); const spot = Object.keys(Builder.spots).find(k => Builder.spots[k].type === c.spot);
      localStorage.setItem('cm_builds', JSON.stringify({ builds: [{ kind: c.id, spot }] })); const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; const x = cv.getContext('2d'); x.fillStyle = '#f80'; x.fillRect(20, 20, 200, 120); localStorage.setItem('cm_lastDrawing', JSON.stringify(cv.toDataURL())); });
    await g.page.reload(); await g.wait(2500); await g.ev(r => startGame(r), 'backyard'); await g.wait(3000); await g.calm(); await g.ev(TLIB);
    const key = name + (off ? ' G3off' : ''); res[key] = {};
    for (const s of await g.ev(() => Object.keys(T.SCREENS))) {
      await g.ev(async s => { await T.reset(); G.busy = false; await T.SCREENS[s](); }, s); await g.wait(450);
      const u = await g.ev(() => Object.assign(T.underX(), { lane: !!(Clarity.G3 && Clarity.G3.lane), panelPad: getComputedStyle(document.getElementById('panel')).paddingLeft }));
      res[key][s] = u;
      if (!off && name !== '844x340') await g.shot('g3_' + name + '_' + s);
    }
    await g.ev(() => T.reset());
    res[key].errors = realErrors(g.errors);
    await g.close();
  }
  fs.writeFileSync(OUT + 'g3_under.json', JSON.stringify(res, null, 1));
  // summary: any screen where something interactive is under #xFloat (any of the 5 points)
  for (const k in res) { const bad = [], glyphs = []; for (const s in res[k]) { if (s === 'errors') continue; const u = res[k][s]; if (!u.shown) { glyphs.push(s + ':hidden'); continue; } glyphs.push(s + ':' + u.text + (u.lane ? '' : '(nolane)'));
      const h = Object.entries(u.pts).filter(([p, v]) => v.hits.length).map(([p, v]) => p + '=' + v.hits.join('|')); if (h.length) bad.push(s + ' [' + h.join(' ') + ']'); }
    console.log('\n== ' + k + '  errors:' + res[k].errors.length); console.log('glyphs: ' + glyphs.join(' ')); console.log('interactive under #xFloat: ' + (bad.length ? '\n  ' + bad.join('\n  ') : 'none')); }
})().catch(e => { console.error(e); process.exit(1); });

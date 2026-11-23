// G10 checks (dress-up). Results -> g10.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const VIEWS = { port: ['port', null], portSmall: ['portSmall', null], land: ['land', null], landSmall: ['landSmall', null], '844x340i47': [{ width: 844, height: 340 }, { left: 47, right: 47, bottom: 21 }] };
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
(async () => {
  for (const off of ['', 'G10']) for (const v of Object.keys(VIEWS)) {
    const g = await boot({ port: 8910, view: VIEWS[v][0], inset: VIEWS[v][1], room: 'mroom', off }); await g.calm(); await g.ev(TLIB);
    const m = await g.ev(async () => {
      await T.reset(); UI.openDress(); await T.sleep(400);
      const hit = n => { const r = n.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && (e === n || n.contains(e)); };
      const tabs = [...document.querySelectorAll('#panel .tabs .pbtn')], area = document.querySelector('#panel .dgrid'), ar = area.getBoundingClientRect();
      const xf = document.getElementById('xFloat'), xr = getComputedStyle(xf).display === 'none' ? null : xf.getBoundingClientRect(), under = n => { if (!xr) return false; const r = n.getBoundingClientRect(); return r.left < xr.right && r.right > xr.left && r.top < xr.bottom && r.bottom > xr.top; };
      const tiles = [...area.querySelectorAll('.tile')], vb = Math.min(ar.bottom, innerHeight); const rows = {};
      for (const t of tiles) { const r = t.getBoundingClientRect(), k = Math.round(r.top); rows[k] = rows[k] || { n: 0, full: 0 }; rows[k].n++; if (r.top >= ar.top - 0.5 && r.bottom <= vb + 0.5 && r.left >= 0 && r.right <= innerWidth) rows[k].full++; }
      const fullTiles = Object.values(rows).reduce((a, r) => a + r.full, 0), fullRows = Object.values(rows).filter(r => r.full === r.n && r.n > 0).length;
      const side = ['random look', 'backdrop', 'walk', 'photo', 'done'].map(l => document.querySelector('#panel .pbtn[aria-label="' + l + '"]'));
      return { tabH: [...new Set(tabs.map(t => Math.round(t.getBoundingClientRect().height)))], tabsOnScreen: tabs.filter(t => { const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }).length, tabsHit: tabs.filter(hit).length,
        tabRows: new Set(tabs.map(t => Math.round(t.getBoundingClientRect().top))).size, outfits: tiles.length, fullTiles, fullRows, tabsUnderX: tabs.filter(under).length, tilesUnderX: tiles.filter(under).length, xShown: !!xr,
        sideHit: side.map(n => n && hit(n)), sideRow: side.map(n => n ? Math.round(n.getBoundingClientRect().top) : null), prevH: Math.round(document.querySelector('#panel .dprev').getBoundingClientRect().height), lane: !!(Clarity.G3 && Clarity.G3.lane) };
    });
    log((off ? 'G10off ' : '') + v, m);
    if (!off) await g.shot('g10_' + v); else await g.shot('g10_' + v + '_today');
    if (!off) {
      // real taps on every tab: the tab switches and the outfit never changes
      const tabs = await g.ev(() => [...document.querySelectorAll('#panel .tabs .pbtn')].map(t => { const r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, t.textContent]; }));
      const o0 = await g.ev(() => (window.__o0 = G.outfit)); const tt = [];
      for (const [x, y, ico] of tabs) { await g.tapXY(x, y); await g.wait(150); tt.push(await g.ev(ico => { const on = document.querySelector('#panel .tabs .pbtn.on'); return (on && on.textContent === ico ? 'ok' : 'NOTSWITCHED') + (G.outfit === window.__o0 ? '' : ':outfitChanged'); }, ico)); }
      const o1 = await g.ev(() => G.outfit);
      // the side buttons: 🎲 changes the look, 🚶 toggles, 📸 adds a photo, 🌈 changes the backdrop (no crash), ✅ closes and runs the fashion show
      const side = await g.ev(async () => { const o = {}; T.tab('#panel .tabs .pbtn', 0); await T.sleep(100);
        const g0 = JSON.parse(localStorage.getItem('cm_gallery') || '[]').length; T.press('#panel .pbtn[aria-label=photo]'); await T.sleep(100); o.photo = JSON.parse(localStorage.getItem('cm_gallery') || '[]').length - g0;
        const w = document.querySelector('#panel .pbtn[aria-label=walk]'); T.press(w); o.walk = w.classList.contains('on'); T.press(w);
        T.press('#panel .pbtn[aria-label=backdrop]'); o.backdrop = 'pressed';
        let changed = 0; for (let i = 0; i < 4; i++) { const b = JSON.stringify([G.outfit, G.hair, G.dye, G.look]); T.press('#panel .pbtn[aria-label="random look"]'); await T.sleep(30); if (JSON.stringify([G.outfit, G.hair, G.dye, G.look]) !== b) changed++; } o.diceChanges = changed;
        const sets = []; const ms = Audio2.Music.set; Audio2.Music.set = function (k) { sets.push(k); return ms.apply(this, arguments); };
        const mx = marina.x; T.press('#panel .pbtn[aria-label=done]'); await T.sleep(900); Audio2.Music.set = ms;
        o.done = { panelHidden: document.getElementById('panel').classList.contains('hidden'), music: sets, walked: Math.round(marina.x - mx) }; return o; });
      // dress-up from the closet / dresser props
      const props = await g.ev(async () => { const out = {}; for (const room of ['mroom', 'parents', 'bathroom', 'playroom', 'living', 'foyer']) for (const p of (PROPS[room] || [])) { if (!/closet|dresser|wardrobe/.test(p.a)) continue; await T.reset(); const a = propActions(p).find(x => x.ico === '👗'); if (!a) { out[room + '/' + p.id] = 'no 👗'; continue; } G.busy = false; a.fn(); await T.sleep(1500); out[room + '/' + p.id] = UI.panelMode; await T.reset(); } return out; });
      log('taps ' + v, { tabTaps: tt, outfitBefore: o0, outfitAfter: o1, side, props });
    }
    res[(off ? 'G10off ' : '') + v + ' errors'] = realErrors(g.errors);
    await g.close();
  }
  fs.writeFileSync(OUT + 'g10.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

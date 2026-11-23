// G32 follow-ups: edge strokes, the after-save menu (after its pop), dirty close A/B (floating ❌ vs top ❌), rotation on vs off
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const I47 = { left: 47, right: 47, bottom: 21 };
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
const inked = () => { const c = document.querySelector('#studio .l-paint'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
(async () => {
  for (const [name, view, inset] of [['land', 'land', null], ['land i47', 'land', I47], ['landSmall', 'landSmall', null], ['landSmall i47', 'landSmall', I47], ['844x340', { width: 844, height: 340 }, null], ['844x340 i47', { width: 844, height: 340 }, I47]]) {
    const g = await boot({ port: 8910, view, inset, room: 'dining' }); await g.calm(); await g.ev(TLIB);
    const o = {};
    for (const [k, dx, dy] of [['corner(1,2)', 1, 2], ['(3,3)', 3, 3], ['(1,12)', 1, 12]]) {
      const p = await g.ev(async () => { if (Studio.active) Studio.close(); Studio.open(); await T.sleep(400); const r = document.querySelector('#studio .s-paper').getBoundingClientRect(); return [r.left, r.bottom]; });
      const sx = p[0] + dx, sy = p[1] - dy; const at = (await g.at(sx, sy)).top;
      await g.page.mouse.move(sx, sy); await g.page.mouse.down(); for (let i = 1; i <= 8; i++) await g.page.mouse.move(sx + i * 6, sy - i * 3); await g.page.mouse.up(); await g.wait(150);
      o[k] = { startsOn: at, inked: await g.ev(inked), studioOpen: await g.ev(() => Studio.active) };
    }
    o.saveMenu = await g.ev(async () => { if (Studio.active) Studio.close(); Studio.open(); await T.sleep(400); T.press(document.querySelector('#studio .s-top [aria-label=save]')); await T.sleep(900);
      const d = document.querySelector('#studio .s-drawer'), dr = d.getBoundingClientRect(), x = document.getElementById('xFloat').getBoundingClientRect(), tiles = [...d.querySelectorAll('.s-tile')].slice(0, 4);
      const ov = Math.max(0, Math.min(dr.right, x.right) - Math.max(dr.left, x.left)) * Math.max(0, Math.min(dr.bottom, x.bottom) - Math.max(dr.top, x.top));
      return { box: [dr.left, dr.top, dr.right, dr.bottom].map(Math.round), overlapX: Math.round(ov), first4Hit: tiles.map(t => { const r = t.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === t || t.contains(e); }) }; });
    await g.shot('g32_' + name.replace(' ', '_') + '_savemenu');
    // dirty close: floating ❌ vs top ❌ — the same outcome
    for (const how of ['xFloat', 'topX']) {
      const p = await g.ev(async () => { if (Studio.active) Studio.close(); Studio.open(); await T.sleep(400); const r = document.querySelector('#studio .s-paper').getBoundingClientRect(); return [r.left, r.top]; });
      await g.page.mouse.move(p[0] + 100, p[1] + 60); await g.page.mouse.down(); for (let i = 1; i <= 8; i++) await g.page.mouse.move(p[0] + 100 + i * 10, p[1] + 60 + i * 5); await g.page.mouse.up(); await g.wait(100);
      const before = await g.ev(() => ({ gal: JSON.parse(localStorage.getItem('cm_gallery') || '[]').length, draft: localStorage.getItem('cm_studioDraft') || '' }));
      const xy = await g.ev(how => { const n = how === 'xFloat' ? document.getElementById('xFloat') : document.querySelector('#studio .s-top [aria-label=close]'); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, how);
      await g.tapXY(xy[0], xy[1]); await g.wait(200);
      o['dirtyClose ' + how] = await g.ev(b => ({ active: Studio.active, galleryAdded: JSON.parse(localStorage.getItem('cm_gallery') || '[]').length - b.gal, draftChanged: (localStorage.getItem('cm_studioDraft') || '') !== b.draft, xDisp: getComputedStyle(document.getElementById('xFloat')).display }), before);
    }
    log(name, o); res[name + ' errors'] = realErrors(g.errors); await g.close();
  }
  for (const off of ['', 'G32']) for (const v of ['port', 'portSmall']) {
    const g = await boot({ port: 8910, view: v, room: 'dining', off }); await g.calm(); await g.ev(TLIB);
    await g.ev(async () => { Studio.open(); await T.sleep(400); });
    const geo = () => g.ev(() => { const p = document.querySelector('#studio .s-paper').getBoundingClientRect(), c = document.querySelector('#studio .l-paint'); return { xDisp: getComputedStyle(document.getElementById('xFloat')).display, WH: c.width + 'x' + c.height, paperAspect: +(p.width / p.height).toFixed(3), bitmapAspect: +(c.width / c.height).toFixed(3) }; });
    const vp = await g.page.viewportSize(), seq = [await geo()];
    for (const s of [{ width: vp.height, height: vp.width }, vp]) { await g.page.setViewportSize(s); await g.wait(700); seq.push(await geo()); }
    log('rotate ' + v + (off ? ' G32off' : ''), seq); await g.close();
  }
  fs.writeFileSync(OUT + 'g32b.json', JSON.stringify(res, null, 1));
  for (const k in res) if (/errors/.test(k) && res[k].length) console.log('ERRORS', k, res[k]);
})().catch(e => { console.error(e); process.exit(1); });

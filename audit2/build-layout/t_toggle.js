// run-time switch flips: G19 off/on resizes once (width changed) and renders; G4 off/on in the living room re-frames; G13/G14 flips
// never resize; after G19 off the layout equals a page loaded with G19 off.
const { boot, OUT, MINE, R } = require('./lib.js');
const SEL = ['#stage', '#moodbar', '#moodToggle', '#roombar', '.navarrow.r', '#dressBtn', '#bookBtn', '#alerts', '.facecard.right', '#weatherBtn'];
(async () => {
  for (const view of ['land', 'landSmall']) {
    const g = await boot({ view, room: 'living', off: '' }); const p = g.page; await g.calm();
    await p.evaluate(() => { window.__rs = 0; const r = window.resize; window.resize = function () { window.__rs++; return r.apply(this, arguments); }; window.__rd = 0; const d = window.render; window.render = function () { window.__rd++; return d.apply(this, arguments); }; });
    const look = () => p.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); return { stageW: Math.round(st.width), cvw: E.cv.width, viewW: +E.viewW.toFixed(1), zoom: +(E.cssScale / (st.height / 180)).toFixed(3), rs: window.__rs, padRuses76: null }; });
    const out = { start: await look() };
    for (const [id, v] of [['G13', false], ['G13', true], ['G14', false], ['G14', true], ['G19', false]]) { await p.evaluate(([id, v]) => Clarity.set(id, v), [id, v]); await p.waitForTimeout(300); out[id + (v ? '+' : '-')] = await look(); }
    out.rectsG19off = await R(p, SEL);
    await p.evaluate(() => Clarity.set('G19', true)); await p.waitForTimeout(300); out['G19+'] = await look();
    await p.evaluate(() => Clarity.set('G4', false)); await p.waitForTimeout(300); out['G4-'] = await look();
    await p.evaluate(() => Clarity.set('G4', true)); await p.waitForTimeout(300); out['G4+'] = await look();
    console.log(view, JSON.stringify(out), JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
    await g.close();
    // the same page loaded with G19 off
    const h = await boot({ view, room: 'living', off: 'G19' }); await h.calm(); await h.page.waitForTimeout(300);
    const ref = await R(h.page, SEL); await h.close();
    const d = SEL.filter(s => JSON.stringify(ref[s]) !== JSON.stringify(out.rectsG19off[s]) && !/alerts|facecard/.test(s));
    console.log(view, 'run-time G19 off vs loaded with G19 off: differing', JSON.stringify(d), d.map(s => JSON.stringify(ref[s]) + ' vs ' + JSON.stringify(out.rectsG19off[s])).join(' '));
  }
})();

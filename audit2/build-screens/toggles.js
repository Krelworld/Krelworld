const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
(async () => { const out = {};
  // switched ON at run time from an all-off start, and OFF at run time from all-on
  for (const start of ['on', 'off']) {
    const g = await boot({ port: 8910, view: 'land', room: 'playroom', off: start === 'off' ? 'G3,G9,G10,G12,G32,G33,G34' : '' }); await g.calm(); await g.ev(TLIB);
    out[start] = await g.ev(async start => { const st = () => ({ lane: document.getElementById('panel').classList.contains('cm-lane'), pad: getComputedStyle(document.getElementById('panel')).paddingLeft, xon: document.body.classList.contains('cm-xon'), x: document.getElementById('xFloat').textContent, marker: !!document.querySelector('.cm-g3-lane') });
      const o = {}; T.fort(); openFortInside(); await T.sleep(400); o.before = st();
      for (const id of ['G3', 'G9', 'G10', 'G12', 'G32', 'G33', 'G34']) Clarity.set(id, start !== 'on'); await T.sleep(400); o.flipped = st();
      await T.reset(); openStickers(); await T.sleep(300); o.stkGlyph = document.querySelector('#stkBox .st-x').textContent; for (const id of ['G33']) Clarity.set(id, start === 'on'); await T.sleep(100); o.stkGlyphAfterFlipBack = document.querySelector('#stkBox .st-x').textContent; Clarity.set('G33', start !== 'on');
      await T.reset(); UI.openCook('fridge'); await T.sleep(300); o.cook = Object.assign(st(), { display: getComputedStyle(document.querySelector('#panel .pbody')).display });
      await T.reset(); return o; }, start);
    out[start].errors = realErrors(g.errors); console.log(start, JSON.stringify(out[start])); await g.close();
  }
  fs.writeFileSync(OUT + 'toggles.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

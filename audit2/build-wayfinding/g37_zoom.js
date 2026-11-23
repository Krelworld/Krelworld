const { OUT, H, TH } = require('./lib.js'); const pw = require('playwright');
(async () => {
  for (const view of ['port', 'landSmall']) {
    const b = await pw.chromium.launch(); const ctx = await b.newContext({ viewport: H.VIEWS[view], isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8920/index.html'); await p.evaluate(s => localStorage.setItem('cm_builds', s), TH); await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => startGame('kitchen')); await p.waitForTimeout(4000);
    await p.evaluate(() => { G.busy = false; UI.closeActions(); for (const e of [daddy, mommy, niko]) { e.room = 'kitchen'; e.hidden = false; e.x = marina.x + 30; } });
    await p.evaluate(() => openIsoMap()); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const t = document.querySelector('.isosvg text[data-r=kitchen]').getBoundingClientRect(); return [t.left, t.top, t.width, t.height]; });
    await p.screenshot({ path: OUT + `shots/g37_zoom_label_${view}.png`, clip: { x: r[0] - 60, y: r[1] - 40, width: r[2] + 120, height: r[3] + 80 } });
    await p.evaluate(() => { document.querySelector('#panel .ptop button').click(); travelTo('den'); }); await p.waitForTimeout(1800);
    await p.evaluate(() => { G.busy = false; nunu.room = 'den'; nunu.hidden = false; jeff.room = 'den'; jeff.hidden = false; openIsoMap(); }); await p.waitForTimeout(800);
    const t = await p.locator('.fmaproom[aria-label=den]').boundingBox();
    await p.screenshot({ path: OUT + `shots/g37_zoom_tile_${view}.png`, clip: { x: t.x - 70, y: t.y - 20, width: t.width + 140, height: t.height + 40 } });
    await b.close();
  }
})();

// zero page errors: boot each view, open a few rings (stairs, a long list, a person, a tap on the island), walk a room, 8 s of play.
const L = require('./lib.js');
(async () => {
  const out = {};
  for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ port: 8870, view, room: 'foyer' }); await g.calm(); const page = g.page;
    try {
      await page.evaluate(() => { const p = PROPS.foyer.find(q => q.a === 'stairs'); UI.actions({ x: p.x, y: p.y - 60, prop: p }, propActions(p)); }); await page.waitForTimeout(800);
      await page.evaluate(() => { UI.closeActions(); changeRoom('living', null, 300); }); await page.waitForTimeout(1200);
      await page.evaluate(() => { const p = PROPS.living.find(q => q.id === 'tv'); UI.actions({ x: p.x, y: p.y - 60, prop: p }, propActions(p)); }); await page.waitForTimeout(800);
      await page.evaluate(() => { UI.closeActions(); changeRoom('kitchen', null, 300); }); await page.waitForTimeout(1200);
      await g.tapWorld(350, 135); await page.waitForTimeout(2500);
      await page.evaluate(() => { UI.closeActions(); changeRoom('backyard', null, 300); try { Wildlife.visit(); } catch (e) { } }); await page.waitForTimeout(5000);
      await page.evaluate(() => { changeRoom('playroom', null, 200); }); await page.waitForTimeout(1500);
      await g.tapWorld(190, 118); await page.waitForTimeout(2500);
    } catch (e) { g.errors.push('SCRIPT ' + e.message); }
    out[view] = g.errors.slice(); console.log(view, 'off=' + (L.off || '-'), 'errors:', JSON.stringify(g.errors));
    await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'smoke2_' + (L.off ? 'off' : 'on') + '.json', JSON.stringify(out, null, 1));
})();

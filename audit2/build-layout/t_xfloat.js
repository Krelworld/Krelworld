// xFloat (the floating ❌ in landscape) unaffected: same rect over a panel and over the story, and a real tap still closes them.
const { boot, MINE, R } = require('./lib.js');
(async () => {
  for (const [mode, off] of [['TODAY', MINE], ['ON', '']]) {
    const g = await boot({ view: 'landSmall', room: 'kitchen', off }); const p = g.page; const out = {};
    await g.calm(); await p.evaluate(() => { G.busy = false; UI.openCook('fridge'); }); await p.waitForTimeout(800);
    out.panel = (await R(p, ['#xFloat']))['#xFloat']; await g.tap('#xFloat'); await p.waitForTimeout(600); out.panelClosed = await p.evaluate(() => document.getElementById('panel').classList.contains('hidden'));
    await g.calm(); await p.evaluate(() => { G.busy = false; openStory(); }); await p.waitForTimeout(1200);
    out.story = (await R(p, ['#xFloat']))['#xFloat']; await g.tap('#xFloat'); await p.waitForTimeout(800); out.storyClosed = await p.evaluate(() => !document.getElementById('storyBox'));
    console.log(mode, JSON.stringify(out), JSON.stringify(g.errors.filter(e => !/chip_love/.test(e)))); await g.close();
  }
})();

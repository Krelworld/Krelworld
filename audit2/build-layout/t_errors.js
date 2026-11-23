// zero page errors: port, land, portSmall, landSmall, all switches on and with my switches off; walk through every floor,
// fold/unfold, a hello, the TV, a story, a few screens, rotate.
const { boot, OUT, MINE } = require('./lib.js');
(async () => {
  for (const view of ['port', 'land', 'portSmall', 'landSmall']) for (const [mode, off] of [['ALL-ON', ''], ['MINE-OFF', MINE]]) {
    const g = await boot({ view, room: 'living', off }); const p = g.page;
    for (const r of ['kitchen', 'living', 'foyer', 'den', 'storage', 'mroom', 'uphall', 'pool', 'yard', 'backyard', 'living']) { await g.calm(); await p.evaluate(r => travelTo(r), r); await p.waitForTimeout(700); }
    await p.evaluate(() => { const b = document.getElementById('moodbar'); b.classList.add('collapsed'); UI.pulseMoods(); b.classList.toggle('collapsed'); }); await p.waitForTimeout(300);
    await g.calm(); await p.evaluate(() => tvOn(showList()[0])); await p.waitForTimeout(1200); await p.evaluate(() => tvOff()); await p.waitForTimeout(500);
    await g.calm(); await p.evaluate(() => openStory()); await p.waitForTimeout(1200); await p.evaluate(() => { const x = document.querySelector('#storyBox .st-x'); x && x.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); await p.waitForTimeout(500);
    for (const js of ["UI.openCook('fridge')", 'UI.openDress()', 'openIsoMap()', "Bricks.open({kind:'lego'})"]) { await g.calm(); await p.evaluate(js => { G.busy = false; eval(js); }, js); await p.waitForTimeout(800); await p.evaluate(() => { try { window.Bricks && Bricks.close && Bricks.close(); } catch (e) { } document.getElementById('panel').classList.add('hidden'); G.busy = false; }); await p.waitForTimeout(300); }
    await g.calm(); await p.evaluate(() => { G.poop = true; showWish('cook'); }); await p.waitForTimeout(1500);
    const v = view.startsWith('port') ? (view === 'port' ? { width: 844, height: 390 } : { width: 667, height: 375 }) : (view === 'land' ? { width: 390, height: 844 } : { width: 375, height: 667 });
    const v0 = p.viewportSize(); await p.setViewportSize(v); await p.waitForTimeout(800); await p.setViewportSize(v0); await p.waitForTimeout(800);
    await p.evaluate(() => travelTo('kitchen')); await p.waitForTimeout(800);
    const errs = g.errors.filter(e => !/chip_love/.test(e));
    console.log(view.padEnd(10), mode.padEnd(9), 'page errors/warnings (excluding chip_love):', errs.length, JSON.stringify(errs.slice(0, 5)), '| chip_love lines:', g.errors.length - errs.length);
    await g.close();
  }
})();

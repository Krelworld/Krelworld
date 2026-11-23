// G6: an open ring never jumps: (a) an alert that arrives after it opened, (b) people moving about (anti-jitter), in land and port.
const L = require('./lib.js');
(async () => {
  const R = {};
  for (const view of ['land', 'port']) {
    const g = await L.boot({ port: 8870, view, room: 'dining' }); await g.calm(); const page = g.page;
    await L.quiet(page, 'dining'); await page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === 'dining' && !e.wild) e.room = 'kitchen'; marina.stop(); marina.x = 120; daddy.room = 'dining'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = 170; daddy.y = FLOOR; AI.hold && AI.hold(daddy, true); rory.room = 'dining'; rory.hidden = false; rory.state = 'idle'; rory.x = 230; rory.y = FLOOR; G.rory = true; AI.hold && AI.hold(rory, true); });
    await page.waitForTimeout(1200);
    const pos = () => page.evaluate(() => [...document.querySelectorAll('#fx .act')].map(n => n.style.left + ',' + n.style.top).join(' '));
    await page.evaluate(() => UI.actions(daddy, entActions(daddy))); await page.waitForTimeout(500); const p0 = await pos();
    await page.evaluate(() => { G.poop = true; }); for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); if (await page.evaluate(() => document.querySelectorAll('#alerts .alertb').length)) break; }
    await page.waitForTimeout(600); const p1 = await pos(); const alertUp = await page.evaluate(() => document.querySelectorAll('#alerts .alertb').length);
    await page.evaluate(() => { rory.walkTo(rory.x + 30, null, 30); }); await page.waitForTimeout(1500); const p2 = await pos();
    R[view] = { opened: p0, afterAlert: p1, alertUp, sameAfterAlert: p0 === p1, afterRoryMoved: p2, sameAfterMove: p0 === p2, errors: g.errors };
    console.log(view, JSON.stringify(R[view]));
    await page.evaluate(() => { UI.closeActions(); G.poop = false; }); await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'g6stable.json', JSON.stringify(R, null, 1));
})();

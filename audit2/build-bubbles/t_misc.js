const L = require('./lib.js'); const fs = require('fs');
(async () => {
  const R = {};
  const g = await L.boot({ view: 'land', room: 'backyard', port: 8881 }); await g.calm(); const P = g.page;
  const n = () => P.evaluate(() => document.querySelectorAll('#fx .pichint').length);
  await P.evaluate(() => { G.busy = false; jeff.room = 'backyard'; jeff.hidden = false; jeff.state = 'idle'; AI.hold(jeff, true); jeff.stop(); jeff.x = E.camX + E.viewW * 0.6; jeff.y = 164; G.holding = { type: 'dish', dish: { name: 't', art: 'cake', score: 2, say: [] } }; });
  await P.waitForTimeout(500); R.jeffHint = await n();
  await P.evaluate(() => UI.actions(jeff, entActions(jeff))); await P.waitForTimeout(400); R.withRingOpen = await n();
  await P.evaluate(() => { UI.closeActions(); G.busy = true; }); await P.waitForTimeout(400); R.whileBusy = await n();
  await P.evaluate(() => { G.busy = false; }); await P.waitForTimeout(400); R.afterBusy = await n();
  // a real tap on an alert while a big icon floats over it
  await P.evaluate(() => { G.holding = null; travelTo('living'); }); await P.waitForTimeout(2000);
  await P.evaluate(() => { G.busy = false; miles.room = 'bathroom'; miles.crying = true; miles.cryT = 99; window.__went = null; }); await P.waitForTimeout(800);
  const pt = await P.evaluate(() => { UI.bigIcon('🛋️', 2500); const a = document.querySelector('.alertb[aria-label=miles]'); const r = a.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height - 8]; });
  await P.waitForTimeout(350);
  R.bigIconBox = await P.evaluate(() => { const b = [...document.querySelectorAll('#fx > div')].find(x => x.textContent === '🛋️'); const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); });
  R.alertPoint = pt.map(Math.round);
  await P.touchscreen.tap(pt[0], pt[1]); await P.waitForTimeout(2500);
  R.afterAlertTap = await P.evaluate(() => ({ room: G.room, marinaMovingOrNearMiles: marina.moving || Math.abs(marina.x - miles.x) < 60, milesRoom: miles.room }));
  R.errors = L.real(g.errors); await g.close();
  fs.writeFileSync(L.OUT + 't_misc.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R));
})().catch(e => { console.error(e); process.exit(1); });

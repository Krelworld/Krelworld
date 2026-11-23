// With a ring open: the wish button, then the request button (each alone) win their own taps.
const L = require('./lib.js');
(async () => {
  const R = {};
  for (const view of ['port', 'land']) {
    const g = await L.boot({ port: 8870, view, room: 'dining' }); await g.calm(); const page = g.page; R[view] = {};
    for (const which of ['wish', 'req']) {
      await page.evaluate(() => { if (G.room !== 'dining') changeRoom('dining', null, 120); }); await page.waitForTimeout(800); await L.quiet(page, 'dining');
      await page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === 'dining' && !e.wild) e.room = 'kitchen'; marina.stop(); marina.x = 120; daddy.room = 'dining'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = 170; daddy.y = FLOOR; AI.hold && AI.hold(daddy, true); });
      await page.waitForTimeout(1200);
      await page.evaluate(() => UI.actions(daddy, entActions(daddy))); await page.waitForTimeout(400);
      await page.evaluate(w => { if (w === 'wish') showWish('cook'); else askRequest('cook'); }, which); await page.waitForTimeout(700);
      const sel = which === 'wish' ? '#wishBtn' : '#reqBtn';
      const m = await page.evaluate(sel => { const n = document.querySelector(sel); if (!n) return { absent: true }; const q = n.getBoundingClientRect(), x = (q.left + q.right) / 2, y = (q.top + q.bottom) / 2, el = document.elementFromPoint(x, y); return { own: !!el && (el === n || n.contains(el)), x, y, ring: !!document.querySelector('#fx .act') }; }, sel);
      if (!m.absent) { await page.touchscreen.tap(m.x, m.y); await page.waitForTimeout(1500); }
      m.after = await page.evaluate(sel => ({ btnGone: !document.querySelector(sel), ringClosed: !document.querySelector('#fx .act'), room: G.room, busy: G.busy }), sel);
      R[view][which] = m; console.log(view, which, JSON.stringify(m));
      await page.waitForTimeout(3000); await page.evaluate(() => { G.busy = false; G.sceneOn = false; try { UI.closePanel(); } catch (e) { } });
    }
    console.log(view, 'errors', JSON.stringify(g.errors)); await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'own2.json', JSON.stringify(R, null, 1));
})();

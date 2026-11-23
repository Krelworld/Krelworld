// G11: the deer's 'they went this way' tab. Herd off-screen on each side; tab centre must be on the bare picture; a tap walks her
// toward the herd. Also measures today's spot (G11 off) on the same page for comparison, and the turkey tab with G11 on/off.
const L = require('./lib.js');
const views = (process.argv[2] || 'port,land,landSmall,844x340').split(',');
(async () => {
  const R = {};
  for (const vn of views) {
    const view = vn === '844x340' ? { width: 844, height: 340 } : vn;
    const g = await L.boot({ port: 8870, view, room: 'backyard' }); await g.calm(); const page = g.page;
    await page.evaluate(() => { window.__tab = {}; const _e = emoji; emoji = function (ch, x, y) { if (ch === '🦌' || ch === '🦃') window.__tab[ch] = { x, y: y + 3, t: E.t }; return _e.apply(this, arguments); }; });
    await L.quiet(page, 'backyard');
    await page.evaluate(() => { for (const e of [daddy, mommy, rory, nunu, jeff, niko]) if (e.room === 'backyard') e.room = 'yard'; Wildlife.calm(); });
    await page.waitForTimeout(500);
    const ok = await page.evaluate(() => Wildlife.visit('graze')); await page.waitForTimeout(3500);
    R[vn] = { visit: ok };
    for (const side of [-1, 1]) {
      const st = await page.evaluate(side => { const W = ROOMS.backyard.w, deer = ENTS.filter(e => e.wild === 'deer');
        for (const [i, d] of deer.entries()) { d.x = side < 0 ? 90 + i * 14 : W - 120 + i * 14; }
        marina.stop(); marina.x = side < 0 ? W - 30 : 30; marina.y = FLOOR; window.__tab = {}; return { n: deer.length }; }, side);
      await page.waitForTimeout(1500);
      // re-pin the deer (they wander) and let a few frames draw
      await page.evaluate(side => { const W = ROOMS.backyard.w; for (const [i, d] of ENTS.filter(e => e.wild === 'deer').entries()) d.x = side < 0 ? 90 + i * 14 : W - 120 + i * 14; window.__tab = {}; }, side);
      await page.waitForTimeout(400);
      const m = await page.evaluate(side => { const t = window.__tab['🦌']; if (!t) return { none: true, state: Wildlife.state.phase };
        const at = (x, y) => { const [cx, cy] = Clarity.toClient(x, y); const el = document.elementFromPoint(cx, cy); return { cx: Math.round(cx), cy: Math.round(cy), el: el ? (el.id || String(el.className).split(' ').slice(0, 2).join('.') || (el.closest('button') ? 'in:' + (el.closest('button').id || String(el.closest('button').className).split(' ').slice(0, 2).join('.')) : el.tagName)) : null }; };
        const today = { x: side < 0 ? Math.max(E.camX, 0) + 14 : Math.min(E.camX + E.viewW, ROOMS.backyard.w) - 14, y: 86 };
        return { tab: { x: Math.round(t.x), y: Math.round(t.y) }, centre: at(t.x, t.y), today: { x: Math.round(today.x), y: today.y, ...at(today.x, today.y) } }; }, side);
      // switch G11 off for one moment: today's drawn spot on the same page
      await page.evaluate(() => { Clarity.set('G11', false); window.__tab = {}; }); await page.waitForTimeout(250);
      m.offDrawn = await page.evaluate(() => { const t = window.__tab['🦌']; return t ? { x: Math.round(t.x), y: Math.round(t.y) } : null; });
      await page.evaluate(() => { Clarity.set('G11', true); window.__tab = {}; }); await page.waitForTimeout(250);
      await g.shot(L.OUT + 'shots/g11_' + vn + '_' + (side < 0 ? 'left' : 'right') + '.png');
      if (m.tab) { // a real tap on the tab
        const before = await page.evaluate(() => ({ x: marina.x }));
        await page.touchscreen.tap(m.centre.cx, m.centre.cy); await page.waitForTimeout(250);
        m.afterTap = await page.evaluate(([side, x0]) => { const deer = ENTS.filter(e => e.wild === 'deer' && !e.hidden); const near = deer.reduce((a, d) => (side > 0 ? Math.min(a, d.x) : Math.max(a, d.x)), side > 0 ? 1e9 : -1e9) - side * 52;
          return { moving: marina.moving, towardHerd: Math.sign(marina.tx - x0) === side, tx: Math.round(marina.tx), expectTx: Math.round(Math.max(8, Math.min(ROOMS.backyard.w - 8, near))), room: G.room, ring: document.querySelectorAll('#fx .act').length }; }, [side, before.x]);
      }
      R[vn][side < 0 ? 'left' : 'right'] = m; console.log(vn, side, JSON.stringify(m));
    }
    await page.evaluate(() => Wildlife.calm()); await page.waitForTimeout(3000);
    // turkey tab: same spot with G11 on and off
    await page.evaluate(() => { marina.stop(); marina.x = 30; window.__tab = {}; }); await page.waitForTimeout(1200);
    const tk = await page.evaluate(() => Wildlife.turkeys());
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => Wildlife.turkeyState && Wildlife.turkeyState.phase === 'forage')) break; }
    await page.evaluate(() => { const s = Wildlife.turkeyState, W = ROOMS.backyard.w; marina.stop(); marina.x = s.fx < W / 2 ? W - 30 : 30; }); await page.waitForTimeout(2000);
    const trk = await page.evaluate(() => Wildlife.turkeyState && [Wildlife.turkeyState.phase, Wildlife.turkeyState.tab]);
    await page.evaluate(() => Clarity.set('G11', false)); await page.waitForTimeout(200);
    const trkOff = await page.evaluate(() => Wildlife.turkeyState && [Wildlife.turkeyState.phase, Wildlife.turkeyState.tab]); await page.evaluate(() => Clarity.set('G11', true));
    R[vn].turkey = { started: tk, on: trk, off: trkOff, same: JSON.stringify(trk) === JSON.stringify(trkOff) }; console.log(vn, 'turkey', JSON.stringify(R[vn].turkey));
    R[vn].errors = g.errors; console.log(vn, 'errors', JSON.stringify(g.errors));
    await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'g11.json', JSON.stringify(R, null, 1));
})();

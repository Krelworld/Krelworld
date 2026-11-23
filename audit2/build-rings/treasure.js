// G8 x treasures: hide the treasures on given props (test-only sort hook at load), then reach them through real taps.
const L = require('./lib.js');
const pw = require('playwright');
(async () => {
  const R = {};
  for (const want of [['playroom/rocker', 'kitchen/stool1'], ['playroom/toyshelf', 'kitchen/island']]) {
    const browser = await pw.chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(w => { const _s = Array.prototype.sort; Array.prototype.sort = function (cmp) { const r = _s.call(this, cmp);
      if (cmp && /Math\.random\(\) - 0\.5/.test(String(cmp)) && this.length && this[0] && this[0].room && this[0].p) { const f = this.filter(c => w.includes(c.room + '/' + c.p.id)), rest = this.filter(c => !w.includes(c.room + '/' + c.p.id)); this.length = 0; this.push(...f, ...rest); }
      return r; }; }, want);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await L.H.serve(8870, L.DIR); await page.goto('http://127.0.0.1:8870/index.html'); await page.waitForTimeout(2500);
    await page.evaluate(() => { startGame('playroom'); }); await page.waitForTimeout(5000);
    await page.evaluate(() => { window.__big = []; const _b = UI.bigIcon; UI.bigIcon = function (ch, ms) { window.__big.push(ch); return _b.apply(this, arguments); }; });
    for (const w of want) {
      const [room, id] = w.split('/');
      await page.evaluate(r => { if (G.room !== r) travelTo(r); }, room); await page.waitForTimeout(1300); await L.quiet(page, room);
      await page.evaluate(([room, id]) => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; const p = PROPS[room].find(q => q.id === id); marina.x = p.x + (room === 'kitchen' ? -70 : 70); marina.y = FLOOR; marina.stop(); }, [room, id]);
      await page.waitForTimeout(2500);
      // a canvas point that G8 hands to this prop (or that it already has)
      const pt = await page.evaluate(id => { const nm = h => h && h.kind === 'prop' ? h.p.id : ''; const c = [];
        for (let y = 100; y <= 182; y++) for (let x = 150; x <= 400; x++) { if (nm(hitTest(x, y)) !== id) continue; const [cx, cy] = Clarity.toClient(x, y); if (Clarity.onCanvas(cx, cy) && Clarity.onCanvas(cx + 6, cy) && Clarity.onCanvas(cx - 6, cy)) c.push([cx, cy, x, y]); }
        return c[Math.floor(c.length / 2)] || null; }, id);
      if (!pt) { R[w] = 'NO POINT'; continue; }
      const n0 = await page.evaluate(() => __big.length);
      await page.touchscreen.tap(pt[0], pt[1]); await page.waitForTimeout(3000);
      R[w] = { point: pt.slice(2), ring: await page.evaluate(() => [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(' ')), found: await page.evaluate(n0 => __big.slice(n0).join(' '), n0) };
      await page.screenshot({ path: L.OUT + 'shots/treasure_' + w.replace('/', '_') + '.png' });
      await page.evaluate(() => UI.closeActions());
    }
    R.errors = errors; await browser.close();
  }
  console.log(JSON.stringify(R, null, 1)); require('fs').writeFileSync(L.OUT + 'treasure.json', JSON.stringify(R, null, 1));
})();

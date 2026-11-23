// Treasures with G18 on vs off: the 💎 comes at the same moment after the tap. Also: a treasure on the foyer stairs leaves the
// stairs ring [🪜,💺] (+ G30 badges), and riding Daddy the stairs ring is unchanged.
const L = require('./lib.js');
const pw = require('playwright');
(async () => {
  const R = {};
  for (const off of ['', 'G18']) {
    const browser = await pw.chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const want = ['kitchen/stove', 'foyer/stairs', 'playroom/rocker'];
    await ctx.addInitScript(([w, off]) => { if (off) window.CLARITY_OFF = off; const _s = Array.prototype.sort; Array.prototype.sort = function (cmp) { const r = _s.call(this, cmp);
      if (cmp && /Math\.random\(\) - 0\.5/.test(String(cmp)) && this.length && this[0] && this[0].room && this[0].p) { const f = this.filter(c => w.includes(c.room + '/' + c.p.id)), rest = this.filter(c => !w.includes(c.room + '/' + c.p.id)); this.length = 0; this.push(...f, ...rest); }
      return r; }; }, [want, off]);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await L.H.serve(8870, L.DIR); await page.goto('http://127.0.0.1:8870/index.html'); await page.waitForTimeout(2500);
    await page.evaluate(() => startGame('kitchen')); await page.waitForTimeout(5000);
    await page.evaluate(() => { window.__big = []; const _b = UI.bigIcon; UI.bigIcon = function (ch) { window.__big.push([ch, performance.now()]); return _b.apply(this, arguments); }; });
    const res = R[off || 'allOn'] = {};
    for (const w of want) {
      const [room, id] = w.split('/');
      await page.evaluate(r => { if (G.room !== r) changeRoom(r, null, ROOMS[r].w / 2); }, room); await page.waitForTimeout(1300); await L.quiet(page, room);
      await page.evaluate(([room, id]) => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; const p = PROPS[room].find(q => q.id === id); marina.x = p.x + 90; marina.y = FLOOR; marina.stop(); }, [room, id]);
      await page.waitForTimeout(2500);
      const pt = await page.evaluate(id => { const c = []; for (let y = 40; y <= 182; y++) for (let x = Math.max(0, E.camX); x <= E.camX + E.viewW; x++) { const h = hitTest(x, y); if (!(h && h.kind === 'prop' && h.p.id === id)) continue; const [cx, cy] = Clarity.toClient(x, y); if ([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => Clarity.onCanvas(cx + dx, cy + dy))) c.push([cx, cy]); } return c[Math.floor(c.length / 2)] || null; }, id);
      if (!pt) { res[w] = 'NO POINT'; continue; }
      const t0 = await page.evaluate(() => { __big.length = 0; return performance.now(); });
      await page.touchscreen.tap(pt[0], pt[1]); await page.waitForTimeout(3500);
      res[w] = await page.evaluate(t0 => ({ found: __big.map(b => b[0]).join(' '), msAfterTap: __big.length ? Math.round(__big[0][1] - t0) : null, ring: [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(' ') }), t0);
      await page.evaluate(() => UI.closeActions());
    }
    // riding Daddy at the foyer: the stairs ring
    await page.evaluate(() => { if (G.room !== 'foyer') changeRoom('foyer', null, 200); }); await page.waitForTimeout(1200); await L.quiet(page, 'foyer');
    await page.evaluate(() => { daddy.room = 'foyer'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = marina.x + 30; daddy.y = marina.y; mount(daddy); }); await page.waitForTimeout(4000);
    res.ride = await page.evaluate(() => { const p = PROPS.foyer.find(q => q.a === 'stairs'); const icons = propActions(p).map(a => a.ico).join(' '); UI.actions({ x: p.x, y: p.y - 60, prop: p }, propActions(p)); const dom = [...document.querySelectorAll('#fx .act')].map(a => a.textContent).join(' '); UI.closeActions(); return { state: marina.state, mount: !!marina.mount, icons, dom }; });
    res.errors = errors; console.log(off || 'allOn', JSON.stringify(res)); await browser.close();
  }
  require('fs').writeFileSync(L.OUT + 'treasure2.json', JSON.stringify(R, null, 1));
})();

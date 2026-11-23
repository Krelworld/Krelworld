// G11 child check: tabY's cache built while the arrows are hidden (a G.busy scene), then the scene ends.
const L = require('./lib.js');
(async () => {
  const R = {};
  for (const view of ['port', 'land']) {
    const g = await L.boot({ port: 8870, view, room: 'backyard' }); await g.calm(); const page = g.page;
    await page.evaluate(() => { window.__tab = {}; const _e = emoji; emoji = function (ch, x, y) { if (ch === '🦌') window.__tab[ch] = { x, y: y + 3 }; return _e.apply(this, arguments); }; });
    await L.quiet(page, 'backyard'); await page.evaluate(() => { for (const e of [daddy, mommy, rory, nunu, jeff, niko]) if (e.room === 'backyard') e.room = 'yard'; Wildlife.calm(); });
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => Wildlife.visit('graze'));
    // keep the herd in view while they come in (so no tab and no cache yet), then a scene: arrows go .off
    for (let i = 0; i < 8; i++) { await page.evaluate(() => { const dx = ENTS.filter(e => e.wild === 'deer'); if (dx.length) { marina.stop(); marina.x = dx[0].x; } }); await page.waitForTimeout(500); }
    const cacheBefore = await page.evaluate(() => JSON.stringify(window.__tab));
    await page.evaluate(() => { G.busy = true; G.sceneOn = true; }); await page.waitForTimeout(600);
    const arrowsOff = await page.evaluate(() => [...document.querySelectorAll('.navarrow')].map(b => b.className).join('|')) + ' tabBefore=' + cacheBefore + ' phase=' + await page.evaluate(() => Wildlife.state.phase);
    let built = null;
    for (let side of [-1]) {
      for (let i = 0; i < 20 && !built; i++) {
        await page.evaluate(() => { const W = ROOMS.backyard.w; for (const [i, d] of ENTS.filter(e => e.wild === 'deer').entries()) d.x = 90 + i * 14; marina.stop(); marina.x = W - 30; marina.y = FLOOR; });
        await page.waitForTimeout(500); built = await page.evaluate(() => window.__tab['🦌'] ? { x: Math.round(__tab['🦌'].x), y: Math.round(__tab['🦌'].y) } : null);
      }
    }
    const arrowsDuring = await page.evaluate(() => [...document.querySelectorAll('.navarrow')].map(b => b.className).join('|'));
    await page.evaluate(() => { G.busy = false; G.sceneOn = false; window.__tab = {}; }); await page.waitForTimeout(1200);
    await page.evaluate(() => { for (const [i, d] of ENTS.filter(e => e.wild === 'deer').entries()) d.x = 90 + i * 14; window.__tab = {}; }); await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const t = __tab['🦌']; if (!t) return null; const [cx, cy] = Clarity.toClient(t.x, t.y); const el = document.elementFromPoint(cx, cy);
      const under = [...document.querySelectorAll('.navarrow')].filter(b => { const r = b.getBoundingClientRect(); return !b.classList.contains('off') && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; }).map(b => b.className);
      return { x: Math.round(t.x), y: Math.round(t.y), cx: Math.round(cx), cy: Math.round(cy), el: el && (el.id || el.className || el.tagName), underArrow: under, arrows: [...document.querySelectorAll('.navarrow')].map(b => b.className).join('|') }; });
    await g.shot(L.OUT + 'shots/g11cache_' + view + '.png');
    R[view] = { visit: ok, arrowsOff, arrowsDuring, builtWhileBusy: built, afterScene: after, errors: g.errors }; console.log(view, JSON.stringify(R[view]));
    await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'g11cache.json', JSON.stringify(R, null, 1));
})();

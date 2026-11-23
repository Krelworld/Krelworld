// G4 reachability: for every living-room prop, Marina WALKS to it (real floor taps toward it until she stands at it); once the
// camera has settled, is the prop's centre on the picture and not under any control (calm state, then with prompts + alert + ✋)?
const { boot, OUT, MINE } = require('./lib.js'); const fs = require('fs');
const MODES = [['TODAY', MINE], ['G4', 'G13,G14,G19'], ['G4+G19', '']];
(async () => {
  const res = {};
  for (const view of ['land', 'landSmall', { width: 844, height: 340 }]) for (const [mode, off] of MODES) {
    const vn = typeof view === 'string' ? view : view.width + 'x' + view.height, key = vn + ' ' + mode;
    const g = await boot({ view, room: 'living', off }); const p = g.page; res[key] = {};
    await g.calm();
    const ids = await p.evaluate(() => PROPS.living.filter(q => !q.nohit).map(q => q.id));
    for (const id of ids) {
      await g.calm();
      await p.evaluate(() => { for (const e of [daddy, mommy, rory, niko]) e.room = 'kitchen'; miles.crying = false; G.poop = false; G.holding = null; if (window.clearWish) clearWish(); document.querySelectorAll('#reqBtn').forEach(n => n.remove()); });
      // walk there: tap the floor at the prop's x (clamped inside the room), repeatedly, like she would
      for (let k = 0; k < 6; k++) {
        const done = await p.evaluate(id => { const q = PROPS.living.find(o => o.id === id); return Math.abs(marina.x - clamp(q.x, 16, ROOMS.living.w - 16)) < 12; }, id); if (done) break;
        const tx = await p.evaluate(id => { const q = PROPS.living.find(o => o.id === id), st = document.getElementById('stage').getBoundingClientRect(); const want = clamp(q.x, 16, ROOMS.living.w - 16);
          // aim at the floor inside the visible picture, as far toward the prop as the picture allows
          const lo = E.camX + 70 / E.cssScale, hi = E.camX + E.viewW - 90 / E.cssScale; return clamp(want, lo, hi); }, id);
        await g.page.evaluate(() => UI.closeActions()); await g.tapWorld(tx, 170); await p.waitForTimeout(1800); await p.evaluate(() => UI.closeActions());
      }
      await p.waitForTimeout(1200);
      const look = () => p.evaluate(id => { const q = PROPS.living.find(o => o.id === id), st = document.getElementById('stage').getBoundingClientRect(), sc = q.scale || 1;
        let b; try { b = q.k && !q.k.startsWith('p:') ? visBox(q.k).map(n => n * sc) : [-(q.w || 20) / 2, -(q.h || 30), (q.w || 20) / 2, 0]; } catch (e) { return 'nobox'; }
        const [x0, y0] = toScreen(q.x + b[0], q.y + b[1]), [x1, y1] = toScreen(q.x + b[2], q.y + b[3]); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        if (cx < 0 || cx > st.width || cy < 0 || cy > st.height) return 'off@' + Math.round(marina.x);
        let free = 0, n = 0; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = x0 + (x1 - x0) * (i + .5) / 5, y = y0 + (y1 - y0) * (j + .5) / 5; if (x < 0 || x > st.width || y < 0 || y > st.height) continue; n++; const h = document.elementFromPoint(st.left + x, st.top + y); if (h && h.id === 'cv') free++; }
        const ce = document.elementFromPoint(st.left + cx, st.top + cy); return (ce && ce.id === 'cv' ? 'ok' : 'COVERED:' + (ce && (ce.id || ce.className.toString().split(' ')[0] || ce.tagName))) + ' ' + free + '/' + n + '@' + Math.round(marina.x); }, id);
      const calm = await look();
      await p.evaluate(() => { G.poop = true; showWish('cook'); G.holding = { type: 'tp' }; }); await p.waitForTimeout(1300); await p.evaluate(() => askRequest('cook')); await p.waitForTimeout(600);
      const busy = await look();
      res[key][id] = { calm, busy };
    }
    res[key].errors = g.errors.filter(e => !/chip_love/.test(e));
    console.log(key, JSON.stringify(res[key]));
    await g.close();
  }
  fs.writeFileSync(OUT + 'g4_walk.json', JSON.stringify(res, null, 1));
})();

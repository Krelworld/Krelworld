// G8 grid tests: kitchen island vs stools, playroom rocker vs toy shelf. G8 on vs off on the same page (Clarity.set).
const L = require('./lib.js');
(async () => {
  const out = {};
  for (const view of ['port', 'land']) {
    const g = await L.boot({ port: 8870, view, room: 'kitchen' }); await g.calm();
    for (const room of ['kitchen', 'playroom']) {
      await g.page.evaluate(r => travelTo(r), room); await g.page.waitForTimeout(1200); await L.quiet(g.page, room);
      await g.page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === G.room) e.room = 'yard'; marina.x = G.room === 'kitchen' ? 200 : 400; marina.y = 175; E.camX = G.room === 'kitchen' ? 200 : 60; });
      await g.page.waitForTimeout(400);
      const r = await g.page.evaluate(room => {
        const A = (p, wx, wy, dil) => { const c = spriteCanvas(p.k); const sc = p.scale || 1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let best = 0;
          for (let dy = -dil; dy <= dil; dy++) for (let dx = -dil; dx <= dil; dx++) { const x = Math.floor((wx + dx - p.x) / sc + c.width / 2), y = Math.floor((wy + dy - p.y) / sc + c.height); if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue; best = Math.max(best, d[(y * c.width + x) * 4 + 3]); } return best; };
        const nm = h => !h ? '.' : h.kind !== 'prop' ? 'e' : h.p.id === 'island' ? 'I' : h.p.a === 'stool' ? 's' : h.p.id === 'toyshelf' ? 'S' : h.p.id === 'rocker' ? 'R' : '?';
        const res = { rows: [], n: {} }; const inc = k => res.n[k] = (res.n[k] || 0) + 1;
        if (room === 'kitchen') {
          const isl = PROPS.kitchen.find(p => p.id === 'island');
          for (let y = 112; y <= 182; y += 2) { let s = ''; for (let x = 300; x <= 392; x += 2) {
            Clarity.set('G8', false); const off = hitTest(x, y); Clarity.set('G8', true); const on = hitTest(x, y);
            const inIsl = Math.abs(x - isl.x) < isl.w / 2 && y >= isl.y - isl.h && y <= isl.y;
            let k = nm(on); if (nm(off) !== k) k = k.toLowerCase() === 'i' ? 'i' : '!'; s += k;
            if (inIsl) { inc('islBox'); if (nm(off) === 'I') inc('islBoxIslandOff'); if (nm(on) === 'I') inc('islBoxIslandOn'); }
            if (off && off.kind === 'prop' && off.p.a === 'stool') { inc('stoolOff'); if (A(off.p, x, y, 0) > 20) { inc('stoolOpaque'); if (!(on && on.kind === 'prop' && on.p === off.p)) inc('STOOL_OPAQUE_LOST'); } }
            if (nm(on) !== nm(off) && !(nm(off) === 's' && nm(on) === 'I')) inc('OTHER_CHANGE');
          } res.rows.push(y + ' ' + s); }
        } else {
          const rk = PROPS.playroom.find(p => p.id === 'rocker'), sh = PROPS.playroom.find(p => p.id === 'toyshelf');
          for (let y = 96; y <= 148; y += 2) { let s = ''; for (let x = 170; x <= 250; x += 2) {
            Clarity.set('G8', false); const off = hitTest(x, y); Clarity.set('G8', true); const on = hitTest(x, y);
            let k = nm(on); if (nm(off) !== k) k = k === 'R' ? 'r' : '!'; s += k;
            if (nm(off) === 'S') { inc('shelfOff'); if (A(sh, x, y, 0) > 20) { inc('shelfOpaque'); if (nm(on) !== 'S') inc('SHELF_OPAQUE_LOST'); } else { inc('shelfSeeThrough'); if (nm(on) === 'S') inc('shelfSeeThroughKept'); }
              if (x >= sh.x) { inc('shelfRightHalf'); if (nm(on) !== 'S') inc('SHELF_RIGHT_LOST'); } }
            const rVis = A(rk, x, y, 0) > 20 && A(sh, x, y, 0) <= 20;   // a rocker pixel she can see (no shelf pixel on top)
            if (rVis) { inc('rockerVisible'); if (nm(on) === 'R') inc('rockerVisibleAnswersR'); if (nm(off) === 'R') inc('rockerVisibleAnswersR_today'); }
            if (nm(on) !== nm(off) && !(nm(off) === 'S' && nm(on) === 'R')) inc('OTHER_CHANGE');
          } res.rows.push(y + ' ' + s); }
        }
        return res;
      }, room);
      // what the island / rocker offer when reached through a real tap
      out[view + ' ' + room] = r.n; console.log(view, room, JSON.stringify(r.n)); console.log(r.rows.join('\n'));
      await g.shot(L.OUT + 'shots/g8_' + view + '_' + room + '.png');
    }
    console.log('errors', JSON.stringify(g.errors)); await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'g8grid.json', JSON.stringify(out, null, 1));
})();

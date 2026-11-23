const L = require('./lib.js');
(async () => {
  for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ port: 8860, view, room: 'foyer' }); await g.calm();
    const P = g.page; const W = await P.evaluate(() => ROOMS.foyer.w);
    const rows = [];
    for (const mx of [20, 60, 100, 140, 180, 220, 260, W - 20]) {
      await P.evaluate(mx => { marina.stop && marina.stop(); marina.x = Math.min(mx, ROOMS.foyer.w - 10); }, mx); await P.waitForTimeout(900);
      rows.push(await P.evaluate(() => { const p = PROPS.foyer.find(q => q.id === 'stairs'); let bx; if (p.k.startsWith('p:')) bx = [-p.w / 2, -p.h, p.w / 2, 0]; else { const sc = p.scale || 1; bx = visBox(p.k).map(n => n * sc); }
        const c = Clarity.toClient(p.x + (bx[0] + bx[2]) / 2, p.y + (bx[1] + bx[3]) / 2), el = document.elementFromPoint(c[0], c[1]);
        return Math.round(marina.x) + ':cam' + Math.round(E.camX) + ' c=' + c.map(Math.round) + ' ' + (el ? (el.id || el.tagName + '.' + (el.parentElement && (el.parentElement.id || el.parentElement.className))) : 'off'); }));
    }
    console.log(view, 'foyer w', W, 'stairs', JSON.stringify(await P.evaluate(() => { const p = PROPS.foyer.find(q => q.id === 'stairs'); return { x: p.x, y: p.y, k: p.k, w: p.w, h: p.h }; })), '\n  ', rows.join('\n   '));
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

const { boot, OUT, TH } = require('./lib.js');
(async () => {
  const g = await boot({ view: process.argv[2] || 'port', room: 'foyer' }); await g.calm();
  for (const x of [136, 236, 262]) {
    await g.ev(x => { marina.x = x; for (const e of ENTS) if (e !== marina && e.room === 'foyer') e.x = 20; }, x); await g.wait(2500);
    const r = await g.ev(() => {
      const s = Clarity.G35.signs[0], p = s.p; const v = visBox(p.k); const out = { cam: Math.round(E.camX), viewW: Math.round(E.viewW), box: v.map(n => Math.round(n + 0)), px: p.x, py: p.y, spot: s.spot, ok: s.ok };
      // why each candidate fails
      const reasons = {}; const SW = 28, SH = 15;
      const bx = [p.x + v[0], p.y + v[1], p.x + v[2], p.y + v[3]], T = bx[1], h = bx[3] - bx[1], base = T + Math.min(46, h / 2);
      out.T = Math.round(T); out.h = Math.round(h); out.base = Math.round(base);
      for (let d = -40; d <= 40; d += 8) { const x = p.x + d, y = base, b = [x - 14, y - 7.5, x + 14, y + 7.5]; const L = E.camX, R = E.camX + E.viewW; const why = [];
        if (b[0] < L || b[2] > R) why.push('offview'); if (b[0] <= L + 14 || b[2] >= R - 14) why.push('edge');
        const h = hitTest(x, y); if (!h || h.p !== p) why.push('hit=' + (h ? h.kind + ':' + (h.p ? h.p.id : h.e ? h.e.id : '') : 'null'));
        const c = Clarity.toClient(x, y), n = document.elementFromPoint(c[0], c[1]); why.push('top=' + (n ? (n.id || n.className) : 'outside')); reasons[x] = why.join(' '); }
      out.reasons = reasons; return out; });
    console.log(x, JSON.stringify(r));
    await g.shot(OUT + 'shots/dbg_foyer_' + x + '.png');
  }
  await g.close();
})();

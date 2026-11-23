// the deer tab on the RIGHT edge (herd off the picture to the right), TODAY vs G19
const { boot, OUT, MINE } = require('./lib.js');
(async () => {
  for (const view of ['land', 'landSmall']) for (const [mode, off] of [['TODAY', MINE], ['G19', 'G4,G13,G14']]) {
    const g = await boot({ view, room: 'kitchen', off }); const p = g.page;
    await p.evaluate(() => { window.__onPic = (wx, wy) => { const st = document.getElementById('stage').getBoundingClientRect(), [sx, sy] = toScreen(wx, wy); if (sx < 0 || sx > st.width || sy < 0 || sy > st.height) return 'off'; const n = document.elementFromPoint(st.left + sx, st.top + sy); return n && n.id === 'cv' ? 'cv' : (n && (n.closest('#moodbar') ? 'moodbar' : n.id || n.className.toString().split(' ')[0])); }; });
    await g.calm(); await p.evaluate(() => travelTo('backyard')); await p.waitForTimeout(1500); await g.calm();
    let r = null;
    for (let k = 0; k < 4 && !(r && r.side === 1); k++) {
      await p.evaluate(() => { marina.x = ROOMS.backyard.w - 20; marina.stop(); Wildlife.visit('graze'); }); await p.waitForTimeout(5000);
      await p.evaluate(() => { marina.x = 20; marina.stop(); }); await p.waitForTimeout(1500);
      r = await p.evaluate(async () => { for (let i = 0; i < 12; i++) { const s = Wildlife.state; if (!s) return 'no visit'; const h = s.deer.filter(d => !d.hidden); if (h.length && s.phase !== 'enter' && s.phase !== 'exit' && h.every(d => d.x > E.camX + E.viewW + 6)) {
            const x = Math.min(E.camX + E.viewW, ROOMS.backyard.w) - 14, y = 86; return { side: 1, x: Math.round(x), herd: h.map(d => d.x).join(','), phase: s.phase, points: [[0, 0], [-8, -9], [8, -9], [-8, 9], [8, 9]].map(([dx, dy]) => window.__onPic(x + dx, y + dy)).join(',') }; }
          await new Promise(r => setTimeout(r, 500)); } const s = Wildlife.state; return { side: 0, herd: s && s.deer.map(d => Math.round(d.x)).join(','), phase: s && s.phase, cam: Math.round(E.camX) }; });
      if (!(r && r.side === 1)) { await p.evaluate(() => Wildlife.calm()); await p.waitForTimeout(3500); }
    }
    console.log(view, mode, JSON.stringify(r));
    await g.shot(OUT + 'shots/g19d_' + view + '_' + mode + '_deer_right.png');
    await g.close();
  }
})();

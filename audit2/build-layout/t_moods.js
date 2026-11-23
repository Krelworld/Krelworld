// moods.js (inv/first-minutes) in landscape, G19 on vs off: real tap on a face, then a floor tap beside Marina every ~0.7 s until
// she walks; time to the first working tap and dead taps.
const { boot, OUT, MINE } = require('./lib.js'); const fs = require('fs');
(async () => {
  const all = {};
  for (const view of ['land', 'landSmall']) for (const [mode, off] of [['TODAY', MINE], ['G19', 'G4,G13,G14']]) {
    const g = await boot({ view, room: 'kitchen', off }); const p = g.page; const res = [];
    for (const mood of ['love', 'happy', 'sad', 'angry', 'tantrum', 'love', 'happy', 'sad', 'angry', 'tantrum']) {
      for (let i = 0; i < 60; i++) { const q = await p.evaluate(() => !G.busy && !G.sceneOn && !document.querySelector('.act') && ['idle', 'walk'].includes(marina.state)); if (q) break; await p.waitForTimeout(250); }
      await p.evaluate(() => { UI.closeActions(); if (window.clearWish) clearWish(); document.getElementById('moodbar').classList.remove('collapsed'); });
      const t0 = Date.now(); await g.tap('.mood[data-mood=' + mood + ']');
      let dead = 0, freed = null, side = 1, busyEnd = null, offPic = 0; const who = await p.evaluate(() => ENTS.filter(e => e.here && !e.hidden && e !== marina).map(e => e.id).join(','));
      for (let k = 0; k < 60 && freed === null; k++) {
        await p.waitForTimeout(400);
        const pre = await p.evaluate(() => marina.x); if (busyEnd === null && await p.evaluate(() => !G.busy && !G.sceneOn)) busyEnd = Date.now() - t0;
        side = -side; const tx = await p.evaluate(s => clamp(marina.x + s * 40, 20, ROOMS[G.room].w - 20), side);
        const tgt = await p.evaluate(x => { const st = document.getElementById('stage').getBoundingClientRect(), [sx, sy] = toScreen(x, 168), n = document.elementFromPoint(st.left + sx, st.top + sy); return n && n.id === 'cv' ? 'cv' : (n && (n.id || n.className)); }, tx);
        if (tgt !== 'cv') offPic++;
        await g.tapWorld(tx, 168); await p.waitForTimeout(300);
        const post = await p.evaluate(() => ({ x: marina.x, mv: !!marina.moving }));
        if (post.mv || Math.abs(post.x - pre) > 2) freed = Date.now() - t0; else dead++;
      }
      res.push({ mood, who, dead, freed, busyEnd, offPic });
    }
    const sum = res.reduce((a, r) => a + (r.freed || 0), 0), dsum = res.reduce((a, r) => a + r.dead, 0);
    console.log(view, mode, 'mean first working tap ms', Math.round(sum / res.length), 'dead taps', dsum, JSON.stringify(res), JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
    all[view + ' ' + mode] = res; await g.close();
  }
  fs.writeFileSync(OUT + 'moods.json', JSON.stringify(all, null, 1));
})();

// G37 grid test over the house painting (relative to the picture itself, which moves in portrait), 'here' animation paused
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
const grid = g => g.ev(() => {
  for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; }
  const s = document.querySelector('.isowrap img').getBoundingClientRect(), polys = [...document.querySelectorAll('.isoroom')], out = [];
  for (let y = s.top + 1; y < s.bottom; y += 2) for (let x = s.left + 1; x < s.right; x += 2) { const n = document.elementFromPoint(x, y); const i = polys.indexOf(n); out.push(i >= 0 ? String.fromCharCode(97 + i) : n ? (n.tagName === 'svg' ? 's' : n.tagName[0]) : '-'); }
  return out.join('');
});
(async () => {
  const R = {};
  for (const view of ['port', 'land', 'portSmall']) {
    const res = {};
    for (const mode of ['on', 'off']) {
      const g = await boot({ view, room: 'kitchen', off: mode === 'off' ? 'G37' : '', storage: { cm_builds: TH } }); await g.calm();
      await g.ev(() => { for (const e of [daddy, mommy, niko]) { e.room = 'kitchen'; e.hidden = false; e.x = marina.x + 30; } });
      for (const room of ['kitchen', 'den', 'playroom']) { await g.go(room, 1500); await g.ev(() => openIsoMap()); await g.wait(700); res[mode + room] = await grid(g); await g.ev(() => document.querySelector('#panel .ptop button').click()); await g.wait(300); }
      res[mode + 'err'] = g.realErrors(); await g.close();
    }
    R[view] = {}; for (const room of ['kitchen', 'den', 'playroom']) { const a = res['on' + room], b = res['off' + room]; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; R[view][room] = { points: a.length, differ: d, lenSame: a.length === b.length }; }
    R[view].errors = [res.onerr, res.offerr];
  }
  console.log(JSON.stringify(R)); fs.writeFileSync(OUT + 'g37_grid.json', JSON.stringify(R, null, 1));
})();

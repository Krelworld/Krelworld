const { boot, OUT } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
(async () => { const R = {};
  for (const run of ['on1', 'on2', 'off']) for (const v of ['port', 'land']) {
    const g = await boot({ port: 8910, view: v, room: 'den', off: run === 'off' ? 'G3' : '' }); await g.calm(); await g.ev(TLIB);
    R[run + v] = await g.ev(async () => { const o = {}; for (const s of ['pool', 'movies']) { await T.reset(); await T.CANVAS[s](); await T.sleep(1500); o[s] = T.layout(); } await T.reset(); return o; });
    await g.close();
  }
  for (const v of ['port', 'land']) for (const s of ['pool', 'movies']) {
    const a = R['on1' + v][s], b = R['on2' + v][s], c = R['off' + v][s];
    const d = (x, y) => x.filter((e, i) => e !== y[i]).slice(0, 4);
    console.log(v, s, 'on1 vs on2:', JSON.stringify(d(a, b)), ' on1 vs off:', JSON.stringify(d(a, c)), ' on2 vs off:', JSON.stringify(d(b, c)));
  }
})();

// G21 must-still-work: Rory's requests (gym, joke, tea), his ring (horseplay, chase...) and his hello, with G21 on and off.
const L = require('./lib.js'); const fs = require('fs');
(async () => { const R = {};
  for (const mode of ['on', 'off']) { const g = await L.boot({ port: 8852, room: 'dining', off: mode === 'on' ? '' : L.MINE, virtual: true, seed: 3 }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst();
    const bring = () => g.ev(() => { G.rory = true; rory.hidden = false; rory.room = G.room; rory.x = marina.x + 50; rory.state = 'idle'; AI.hold(rory, true); G.busy = false; G.sceneOn = false; UI.closeActions(); UI.closePanel && UI.closePanel(); });
    const res = {};
    for (const k of ['gym', 'joke', 'tea']) { await bring(); await g.run(500); const t0 = await g.ev(() => E.t);
      const shown = await g.ev(k => { askRequest(k); return document.getElementById('reqBtn') ? document.getElementById('reqBtn').textContent : null; }, k); await g.run(1500);
      if (await g.ev(() => !!document.getElementById('reqBtn'))) await g.tap('#reqBtn'); await g.run(5000);
      res['req_' + k] = { button: shown, after: await g.ev(t => ({ panel: !document.getElementById('panel').classList.contains('hidden') ? UI.panelMode : null, busy: !!G.busy, scene: !!G.sceneOn, voices: __log.filter(e => e.type === 'voice' && e.t > t).map(e => e.key).slice(0, 6) }), t0) };
      await g.ev(() => { UI.closePanel && UI.closePanel(); G.busy = false; G.sceneOn = false; }); await g.run(6000); }
    await bring(); await g.run(300);
    res.ring = await g.ev(() => entActions(rory).map(a => a.ico).join(''));
    for (const ico of ['🤼', '🏃']) { await bring(); await g.run(300); const t0 = await g.ev(() => E.t);
      const ok = await g.ev(ico => { const a = entActions(rory).find(x => x.ico === ico); if (!a) return false; a.fn(); return true; }, ico); await g.run(4000);
      res['ring_' + ico] = { pressed: ok, after: await g.ev(t => ({ chase: !!G.chase, busy: !!G.busy, rory: rory.state, mst: marina.state, voices: __log.filter(e => e.type === 'voice' && e.t > t).map(e => e.key).slice(0, 5) }), t0) };
      await g.ev(() => { G.chase = null; G.busy = false; G.sceneOn = false; AI.hold(rory, false); }); await g.run(8000); }
    res.errors = L.errs(g); R[mode] = res; await g.close(); }
  console.log(JSON.stringify(R, null, 1)); fs.writeFileSync(L.OUT + 't_g21b.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

// G1: in free play a request still comes about 6 s after her last touch and a wish about 30 s after it (rules unchanged).
// Virtual time. Budgets (lastPing, lastWish) are opened up first so only the idle clock decides.
const L = require('./lib.js'); const fs = require('fs');
(async () => { const R = {};
  for (const mode of ['on', 'off']) for (const what of ['request', 'wish']) {
    const g = await L.boot({ port: 8852, room: 'dining', off: mode === 'on' ? '' : L.MINE, virtual: true, seed: 21 }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst();
    // nobody who can ask is around for the first 3 minutes (so lastReq stays old), then the test starts
    await g.ev(() => { for (const e of [daddy, mommy, rory, niko]) { e.room = 'kitchen'; e.x = 200; AI.hold(e, true); } });
    await g.run(180000);
    const t0 = await g.ev(w => { clearWish(); UI.closeActions(); G.busy = false; G.sceneOn = false; miles.crying = false; miles.cryT = 999; G.poop = false; G.poopOkAt = E.t + 999; miles.poopy = false;
      if (w === 'request') { daddy.room = 'dining'; daddy.x = marina.x + 60; daddy.state = 'idle'; daddy.hidden = false; }
      lastPing = E.t - 1000; lastWish = E.t - 1000; return E.t; }, what);
    await g.tapWorld(await g.ev(() => E.camX + E.viewW * 0.3), 168); const tTap = await g.ev(() => lastInput);
    let at = null; for (let i = 0; i < 120 && at == null; i++) { await g.run(500); at = await g.ev(([w, t]) => { const n = document.getElementById(w === 'request' ? 'reqBtn' : 'wishBtn'); return n ? E.t - t : null; }, [what, tTap]); }
    R[mode + ' ' + what] = { secondsAfterLastTouch: at != null ? +at.toFixed(1) : null, tapCountedAsInput: tTap > t0 - 0.01, errors: L.errs(g) }; await g.close();
  }
  console.log(JSON.stringify(R, null, 1)); fs.writeFileSync(L.OUT + 't_g1b.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

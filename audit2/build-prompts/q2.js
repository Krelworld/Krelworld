const L = require('./lib.js');
(async () => { const g = await L.boot({ port: 8852, room: 'kitchen', virtual: true, seed: 7 }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst(); await g.page.addScriptTag({ path: L.OUT + 'inst2.js' });
  const t0 = await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; AI.hold(daddy, true); G.mess = []; addMess(G.room, 6); G.lastTidyAsk = E.t - 100; return E.t; });
  for (let i = 0; i < 12; i++) { await g.run(2500); console.log(JSON.stringify(await g.ev(() => ({ t: +E.t.toFixed(1), busy: Clarity.busyNow(), q: Clarity.quietFor(), causes: __causes(), lta: +G.lastTidyAsk.toFixed(1), n: G.mess.filter(m => m.room === G.room).length, ps: parentsHere().map(e => e.id), st: marina.state, anim: marina.anim && marina.anim.loop })))); }
  console.log(JSON.stringify((await g.ev(() => __log)).filter(e => ['edge', 'voice', 'tidyask'].includes(e.type)).map(e => [e.t, e.type, e.key || e.dir, e.causes])));
  await g.close(); })();

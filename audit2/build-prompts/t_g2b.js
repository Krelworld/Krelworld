// G2 checks, part 2 (virtual time): Minka's hide cues and the upstairs visits pause during activities, and only then.
const L = require('./lib.js'); const fs = require('fs');
const mode = process.argv[2] || 'on', seed = +(process.argv[3] || 7);
const off = mode === 'on' ? '' : L.MINE;
async function fresh(room) { const g = await L.boot({ port: 8853, room, off, virtual: true, seed }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst(); await g.page.addScriptTag({ path: L.OUT + 'inst2.js' }); return g; }
// cue ticks = changes of Minka's next-cue time; mews and paws come from the instrumentation log
const watchCues = g => g.ev(() => { window.__cues = []; let last = null; setInterval(() => { const H = Minka._debug.H; const n = H.on && H.cl ? H.cl.next : null; if (n !== last) { if (last != null && n != null) __cues.push(+E.t.toFixed(2)); last = n; } }, 50); });
const between = (g, a, b) => g.ev(([a, b]) => ({ cues: __cues.filter(t => t > a && t <= b).length, mews: __log.filter(e => e.type === 'mew' && e.t > a && e.t <= b).length, paws: __log.filter(e => e.type === 'paw2' && e.t > a && e.t <= b).length }), [a, b]);
(async () => {
  const R = {};
  // Minka: hide in the storage room while Marina is in the den; the drawing studio is open for 40 s; then 30 s of free play; then the timeout
  { const g = await fresh('den'); await watchCues(g);
    const spot = await g.ev(() => { Minka._debug.place('den', 500, 'sit'); const id = Minka.spots.find(s => Minka.spotRooms[s] === 'storage'); return Minka.hideNow(id); });
    let tin = null; for (let i = 0; i < 60 && tin == null; i++) { await g.run(500); tin = await g.ev(() => { const h = Minka.state().hiding; return h && h.in ? Minka._debug.H.t0 : null; }); }
    const t1 = await g.ev(() => { Studio.open(); return E.t; }); await g.run(40000); const t2 = await g.ev(() => { Studio.close && Studio.close(); return E.t; });
    const during = await between(g, t1 + 0.2, t2);
    await g.run(30000); const t3 = await g.ev(() => E.t); const after = await between(g, t2, t3);
    let endAt = null; for (let i = 0; i < 120 && endAt == null; i++) { await g.run(1000); endAt = await g.ev(() => Minka.state().hiding ? null : E.t); }
    R.minkaStudio = { spot, hiddenAt: tin, studioOpen40s: during, freePlay30sAfter: after, hideEndedAfterTuckS: endAt != null ? +(endAt - tin).toFixed(1) : null, errors: L.errs(g) }; await g.close(); }
  // Minka in free play: same-room cues (standing in the hiding room) and far-room cues (next room) for 60 s each
  { const g = await fresh('den'); await watchCues(g);
    await g.ev(() => { Minka._debug.place('den', 500, 'sit'); const id = Minka.spots.find(s => Minka.spotRooms[s] === 'den'); Minka.hideNow(id); });
    for (let i = 0; i < 40; i++) { await g.run(500); if (await g.ev(() => { const h = Minka.state().hiding; return !!(h && h.in); })) break; }
    const a = await g.ev(() => E.t); await g.run(60000); const b = await g.ev(() => E.t); const same = await between(g, a, b);
    const st = await g.ev(() => Minka.state().hiding);
    R.minkaFreePlaySameRoom60s = { ...same, stillHiding: !!st, errors: L.errs(g) }; await g.close(); }
  { const g = await fresh('den'); await watchCues(g);
    await g.ev(() => { Minka._debug.place('den', 500, 'sit'); const id = Minka.spots.find(s => Minka.spotRooms[s] === 'storage'); Minka.hideNow(id); });
    for (let i = 0; i < 40; i++) { await g.run(500); if (await g.ev(() => { const h = Minka.state().hiding; return !!(h && h.in); })) break; }
    const a = await g.ev(() => E.t); await g.run(60000); const b = await g.ev(() => E.t); const far = await between(g, a, b);
    const mews = await g.ev(([a, b]) => __log.filter(e => e.type === 'mew' && e.t > a && e.t <= b).map(e => e.far), [a, b]);
    R.minkaFreePlayFarRoom60s = { ...far, farMews: mews.filter(Boolean).length, errors: L.errs(g) }; await g.close(); }
  // Upstairs: nobody walks in while the studio or a story is open (60 s each); in free play the first visit comes after 12-24 s or so
  const arrivals = g => g.ev(() => { window.__arr = []; const was = {}; setInterval(() => { for (const e of [daddy, mommy]) { const here = e.room === G.room && !e.hidden; if (here && !was[e.id]) __arr.push([+E.t.toFixed(1), e.id]); was[e.id] = here; } }, 100); });
  const away = g => g.ev(() => { for (const e of [daddy, mommy, rory]) { e.room = 'kitchen'; e.x = 200; e.state = 'idle'; } });
  for (const [name, open, close] of [['studio', 'Studio.open()', 'Studio.close && Studio.close()'], ['story', 'openStory()', 'document.querySelector("#storyBox .st-x") && document.querySelector("#storyBox .st-x").dispatchEvent(new PointerEvent("pointerup",{bubbles:true}))']]) {
    const g = await fresh('mroom'); await away(g); await arrivals(g);
    const t1 = await g.ev(o => { eval(o); return E.t; }, open); await g.run(60000); const t2 = await g.ev(c => { eval(c); return E.t; }, close);
    const during = await g.ev(([a, b]) => __arr.filter(x => x[0] > a && x[0] <= b), [t1, t2]);
    await g.run(60000); const after = await g.ev(b => __arr.filter(x => x[0] > b).map(x => [+(x[0] - b).toFixed(1), x[1]]), t2);
    R['upstairs_' + name] = { arrivalsWhileOpen60s: during.length, arrivalsFirst60sAfterClose: after, errors: L.errs(g) }; await g.close();
  }
  { const g = await fresh('mroom'); await away(g); await arrivals(g); let ref = await g.ev(() => E.t); const gaps = [];
    for (let k = 0; k < 4; k++) { let got = null; for (let i = 0; i < 90 && !got; i++) { await g.run(1000); got = await g.ev(t => __arr.find(x => x[0] > t), ref); }
      if (!got) { gaps.push(null); break; } gaps.push(+(got[0] - ref).toFixed(1)); await g.run(2000); await away(g); ref = await g.ev(() => E.t); }
    R.upstairs_freePlay_secondsToVisit = { gaps, errors: L.errs(g) }; await g.close(); }
  console.log(JSON.stringify(R, null, 1)); fs.writeFileSync(L.OUT + 't_g2b_' + mode + '_s' + seed + '.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

// G20 checks (virtual time), with G20 on and with my switches off (today).
const L = require('./lib.js'); const fs = require('fs');
const mode = process.argv[2] || 'on', seed = +(process.argv[3] || 5);
const off = mode === 'on' ? '' : L.MINE;
async function fresh(room) { const g = await L.boot({ port: 8854, room, off, virtual: true, seed }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst(); await g.page.addScriptTag({ path: L.OUT + 'inst2.js' }); return g; }
const voices = (g, re, t) => g.ev(([re, t]) => __log.filter(e => e.type === 'voice' && new RegExp(re).test(e.key) && e.t > (t || 0)).map(e => e.key + '@' + e.t.toFixed(1)), [re, t || 0]);
(async () => {
  const R = {};
  // (1)(2) two onEnterRoom('den') calls 0.3 s apart with Nunu in the den, G.septicTold false / true
  for (const told of [false, true]) {
    const g = await fresh('den');
    const t0 = await g.ev(told => { for (const e of [daddy, mommy, rory, jeff]) { e.room = 'kitchen'; } nunu.room = 'den'; nunu.hidden = false; nunu.x = marina.x + 80; nunu.state = 'idle'; AI.hold(nunu, true); delete G.lastGreet.nunu; G.septicTold = told; return E.t; }, told);
    await g.ev(() => onEnterRoom('den')); await g.run(300); await g.ev(() => onEnterRoom('den')); await g.run(8000);
    R['twoCalls_septicTold_' + told] = { all: await voices(g, '.', t0), nunuHello: await voices(g, '^nu_hi', t0), marinaReply: await voices(g, '^(m_hi_nunu|nu_septic_thanks)$', t0), greetCtx: await g.ev(t => __log.filter(e => e.type === 'greetctx' && e.t > t).map(e => e.who), t0), errors: L.errs(g) };
    await g.close();
  }
  // (3) backyard (Jeff) -> back door -> den (Nunu) within 10 s: both replies play
  { const g = await fresh('backyard');
    const t0 = await g.ev(() => { for (const e of [daddy, mommy, rory]) { e.room = 'kitchen'; } jeff.room = 'backyard'; jeff.hidden = false; jeff.x = marina.x + 70; jeff.state = 'idle'; nunu.room = 'laundry'; nunu.hidden = false; delete G.lastGreet.jeff; delete G.lastGreet.nunu; G.septicTold = false; return E.t; });
    await g.ev(() => { travelTo('yard'); }); await g.run(1500); await g.ev(() => { travelTo('backyard'); }); await g.run(4500);
    const t1 = await g.ev(() => E.t); await g.ev(() => { travelTo('den'); }); await g.run(8000);
    R.backyardThenDen = { room: await g.ev(() => G.room), t1: +(t1 - t0).toFixed(1), jeff: await voices(g, '^(j_hi|m_hi_jeff)', t0), nunu: await voices(g, '^(nu_hi|m_hi_nunu)', t0), errors: L.errs(g) }; await g.close(); }
  // (4) upstairs: a parent greeted 60 s ago walks in silently (lastGreet unchanged); no further visit while present; visits resume after
  { const g = await fresh('mroom');
    await g.ev(() => { for (const e of [daddy, mommy, rory]) { e.room = 'kitchen'; e.x = 200; e.state = 'idle'; } G.lastGreet.daddy = E.t - 60; G.lastGreet.mommy = E.t - 60; window.__arr = []; const was = {}; setInterval(() => { for (const e of [daddy, mommy]) { const here = e.room === G.room && !e.hidden; if (here && !was[e.id]) __arr.push([+E.t.toFixed(1), e.id, [daddy, mommy, rory].filter(x => x !== e && x.here && !x.hidden).map(x => x.id).join('')]); was[e.id] = here; } }, 100); });
    const lg0 = await g.ev(() => Object.assign({}, G.lastGreet)); const t0 = await g.ev(() => E.t);
    let arr = null; for (let i = 0; i < 90 && !arr; i++) { await g.run(1000); arr = await g.ev(() => __arr[0] || null); }
    await g.run(6000); const lg1 = await g.ev(() => Object.assign({}, G.lastGreet));
    const who = arr && arr[1]; const faced = await g.ev(w => { const e = { daddy, mommy }[w]; return e ? Math.sign(marina.x - e.x) === e.dir : null; }, who);
    const hello = await voices(g, '^(d_hi|mo_hi)', t0);
    await g.run(30000); const more = await g.ev(() => __arr.length);
    await g.ev(() => { for (const e of [daddy, mommy]) { e.room = 'kitchen'; e.x = 200; } }); const t2 = await g.ev(() => E.t);
    let again = null; for (let i = 0; i < 90 && !again; i++) { await g.run(1000); again = await g.ev(t => __arr.find(x => x[0] > t) || null, t2); }
    R.upstairsHeldBack = { firstArrival: arr && [+(arr[0] - t0).toFixed(1), arr[1]], helloLines: hello, facedHer: faced, lastGreetUnchanged: lg0[who] === lg1[who], arrivalsWithin30sWhilePresent: more, visitAfterTheyLeftS: again && +(again[0] - t2).toFixed(1), arrivals: await g.ev(() => __arr), allVoices: await voices(g, '.', t0), oerb: await g.ev(() => __log.filter(e => e.type === 'oerb').map(e => e.who + (e.skip ? ':held' : ':greeted'))), errors: L.errs(g) }; await g.close(); }
  // (5) her own room entries keep the 30 s rule: Daddy in the dining room; she enters, leaves, re-enters at +20 s and +40 s
  { const g = await fresh('kitchen');
    await g.ev(() => { for (const e of [mommy, rory, nunu, jeff]) { e.room = 'living'; } daddy.room = 'dining'; daddy.x = 200; daddy.state = 'idle'; daddy.hidden = false; AI.hold(daddy, true); delete G.lastGreet.daddy; niko.room = 'living'; });
    const res = []; for (const wait of [0, 20, 20]) { await g.run(wait * 1000); const t = await g.ev(() => { travelTo('dining'); return E.t; }); await g.run(3000); res.push((await voices(g, '^d_hi', t)).length); await g.ev(() => travelTo('kitchen')); await g.run(1000); }
    R.ownEntries30sRule = { hellosAtEntries_0_23_47s: res, errors: L.errs(g) }; await g.close(); }
  console.log(JSON.stringify(R, null, 1)); fs.writeFileSync(L.OUT + 't_g20_' + mode + '_s' + seed + '.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

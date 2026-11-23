// G28 checks (virtual time). The 8 start events with the start wish forced (willWish true), plus 'occupied' scenarios.
// usage: node t_g28.js <on|off> <port> <view> [list]   list: 'events' | 'busy'
const L = require('./lib.js'); const fs = require('fs');
const [mode = 'on', portS = '8855', view = 'port', list = 'events', seedS = '3'] = process.argv.slice(2);
const off = mode === 'on' ? '' : L.MINE, port = +portS, seed = +seedS;
const FORCE = (K, will) => {   // runs in the page, before startGame: force react.js's chance(0.3) and the start event index
  window.__w = []; window.__mk = [];
  const _mw = makeWish; makeWish = function (k) { __mk.push({ t: +E.t.toFixed(2), wishEl: !!wishEl, act: document.querySelectorAll('#fx .act').length, alert: document.querySelectorAll('.alertb').length, req: !!document.getElementById('reqBtn'), cry: !!miles.crying, busy: !!G.busy, scene: !!G.sceneOn, tv: !!G.tv, tidy: !!G.tidy, inAct: inActivity(), body: Clarity.bodyBusy(), st: marina.state }); return _mw.apply(this, arguments); };
  let cur = null; setInterval(() => { const w = document.getElementById('wishBtn'); if (w !== cur) { cur = w; if (w) __w.push({ t: +E.t.toFixed(2), ico: w.textContent, act: document.querySelectorAll('#fx .act').length, tv: !!G.tv, tidy: !!G.tidy, panel: !document.getElementById('panel').classList.contains('hidden'), st: marina.state, alert: document.querySelectorAll('.alertb').length }); } }, 50);
  const s0 = startScenario;
  startScenario = function (room) {
    window.__t0 = E.t; const r = Math.random; let first = true; Math.random = () => { if (first) { first = false; return will ? 0 : 0.99; } return r(); };
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms, ...a) { if (ms === 700 && typeof fn === 'function' && !window.__forced) { window.__forced = 1; const f = fn; fn = () => { const rr = Math.random; Math.random = () => (K + 0.5) / 8; try { f(); } finally { Math.random = rr; } }; } return st.call(window, fn, ms, ...a); };
    try { return s0.apply(this, arguments); } finally { Math.random = r; window.setTimeout = st; }
  };
};
async function one(K, room, during) {
  const g = await L.boot({ port, view, room, off, virtual: true, seed, start: false });
  await g.virtual(50); await g.run(500); await g.inst(); await g.page.addScriptTag({ path: L.OUT + 'inst2.js' });
  await g.ev(([src, K]) => { (0, eval)('(' + src + ')')(K, true); }, [FORCE.toString(), K]);
  await g.ev(r => startGame(r), room);
  const res = { K, room };
  if (during) res.during = await during(g); else await g.run(25000);
  const out = await g.ev(() => ({ t0: __t0, wishes: __w.map(w => ({ ...w, t: +(w.t - __t0).toFixed(2) })), makeWish: __mk.map(m => ({ ...m, t: +(m.t - __t0).toFixed(2) })), want: __log.filter(e => e.type === 'voice' && /^m_(want|should)_/.test(e.key)).map(e => e.key + '@' + (e.t - __t0).toFixed(1)) }));
  Object.assign(res, out, { errors: L.errs(g) }); await g.close(); return res;
}
(async () => {
  const R = [];
  if (list === 'events') for (let K = 0; K < 8; K++) R.push(await one(K, 'living'));
  else if (list === 'swing') {   // on the swing from about 1 s (so she is swinging at 4.2 s) until 16 s
    R.push(await one(6, 'yard', async g => { await g.ev(() => { marina.x = 430; yardToy('saucer'); }); const st = []; for (let i = 0; i < 32; i++) { await g.run(500); st.push(await g.ev(() => +(E.t - __t0).toFixed(1) + ':' + marina.state)); } await g.ev(() => stopActivity()); await g.run(10000); return st.filter((x, i) => i % 4 === 0).join(' '); }));
  }
  else {
    // a choice ring is open from 3 s to 14 s (calm start event 6)
    R.push(await one(6, 'living', async g => { await g.run(3000); await g.ev(() => UI.actions(marina, selfActions())); const w = []; for (let i = 0; i < 22; i++) { await g.run(500); w.push(await g.ev(() => document.querySelectorAll('#fx .act').length)); } await g.ev(() => UI.closeActions()); await g.run(14000); return 'ring 3-14 s'; }));
    // the TV from 3 s to 15 s
    R.push(await one(6, 'living', async g => { await g.run(3000); await g.ev(() => tvOn(showList()[0])); await g.run(12000); await g.ev(() => tvOff()); await g.run(10000); return 'tv 3-15 s'; }));
    // tidying from 3 s (with toys out) until done or 15 s
    R.push(await one(6, 'living', async g => { await g.run(2500); await g.ev(() => { addMess(G.room, 3); startTidy(); }); await g.run(12500); await g.ev(() => { G.tidy = false; }); await g.run(10000); return 'tidy 3-15 s'; }));
    // the fort builder from 3 s to 15 s
    R.push(await one(6, 'living', async g => { await g.run(3000); await g.ev(() => startFort()); await g.run(12000); await g.ev(() => UI.closePanel()); await g.run(10000); return 'fort 3-15 s'; }));
    // the swing in the yard from about 3 s to 15 s
    R.push(await one(6, 'yard', async g => { await g.run(2500); await g.ev(() => yardToy('saucer')); await g.run(12500); const s = await g.ev(() => marina.state); await g.ev(() => stopActivity()); await g.run(10000); return 'swing 3-15 s (state at 15 s: ' + s + ')'; }));
    // crying start: tap the alert at 2 s, Miles' ring opens and stays open until 12 s
    R.push(await one(2, 'living', async g => { await g.run(2000); const a = await g.ev(() => !!document.querySelector('.alertb')); if (a) await g.tap('.alertb'); const ring = []; for (let i = 0; i < 20; i++) { await g.run(500); ring.push(await g.ev(() => [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(''))); } await g.ev(() => UI.closeActions()); await g.run(13000); return { alertTapped: a, ringSamples: ring.filter((x, i, l) => l.indexOf(x) === i) }; }));
    // crying start, nobody taps the alert
    R.push(await one(2, 'living', async g => { const al = []; for (let i = 0; i < 50; i++) { await g.run(500); al.push(await g.ev(() => document.querySelectorAll('.alertb').length)); } return { alertGoneAtS: (al.indexOf(0) + 1) * 0.5 }; }));
  }
  console.log(JSON.stringify(R)); fs.writeFileSync(L.OUT + 't_g28_' + list + '_' + mode + '_' + view + '_s' + seed + '.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

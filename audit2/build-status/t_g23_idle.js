// G23: idle wiggles over N game-seconds untouched, G23 on vs off, one room/view: times (since her last touch), gaps,
// and whether each wiggled prop's middle was on the picture. Also: game-seconds a nappy/poop/crying alert was up
// (fun.js:92 holds requests back while any .alertb shows) and seconds a fresh alert/wish/request held the wiggle back.
//   node t_g23_idle.js <view> <room> <gameSeconds>
const L = require('./lib.js'), fs = require('fs');
const [view, room, secs] = [process.argv[2] || 'port', process.argv[3] || 'kitchen', +(process.argv[4] || 100)];
const one = async off => {
  const g = await L.boot({ port: 8860, view, room, off }); await g.calm();
  const P = g.page, ev = (f, a) => P.evaluate(f, a);
  await ev(() => { miles.crying = false; miles.poopy = false; G.poop = false; G.needTP = false; G.holding = null; if (window.clearWish) clearWish(); marina.stop && marina.stop(); });
  await P.waitForTimeout(400);
  await ev(() => { window.__I = { L0: E.t, w: [], alertT: 0, blockT: 0, wishT: 0, reqT: 0, last: E.t };
    let b = G.bounce; Object.defineProperty(G, 'bounce', { configurable: true, get() { return b; }, set(v) { b = v; if (v && /features\.js:600/.test(new Error().stack || '')) {
      const p = PROPS[G.room].find(q => q.id === v.id); let bx; if (p.k.startsWith('p:')) bx = [-p.w / 2, -p.h, p.w / 2, 0]; else { const sc = p.scale || 1; bx = visBox(p.k).map(n => n * sc); }
      const r = document.getElementById('stage').getBoundingClientRect(), s = toScreen(p.x + (bx[0] + bx[2]) / 2, p.y + (bx[1] + bx[3]) / 2), el = document.elementFromPoint(s[0] + r.left, s[1] + r.top);
      __I.w.push({ t: +(E.t - __I.L0).toFixed(2), id: v.id, vis: !!el && el.id === 'cv' }); } } });
    lastInput = E.t; __I.L0 = E.t;
    __I.iv = setInterval(() => { const dt = E.t - __I.last; __I.last = E.t;
      if (document.querySelector('#alerts .alertb[aria-label=nappy],#alerts .alertb[aria-label=poop],#alerts .alertb[aria-label=miles]')) __I.alertT += dt;
      if (document.querySelector('.alertb:not(.settled):not([aria-label=pickeep]),#wishBtn,#reqBtn')) __I.blockT += dt;
      if (document.getElementById('wishBtn')) __I.wishT += dt; if (document.getElementById('reqBtn')) __I.reqT += dt; }, 250); });
  for (;;) { await P.waitForTimeout(2000); if (await ev(s => E.t - __I.L0 >= s, secs)) break; }
  const I = await ev(() => { clearInterval(__I.iv); return { w: __I.w, alertT: +__I.alertT.toFixed(1), blockT: +__I.blockT.toFixed(1), wishT: +__I.wishT.toFixed(1), reqT: +__I.reqT.toFixed(1), lastInputMoved: lastInput !== __I.L0, gameS: +(E.t - __I.L0).toFixed(1) }; });
  const errors = g.errors.filter(e => !/chip_love/.test(e)); await g.close();
  const t = I.w.map(x => x.t), gaps = t.slice(1).map((x, i) => +(x - t[i]).toFixed(1));
  return { build: off ? 'G23 off (today)' : 'G23 on', gameS: I.gameS, wiggles: I.w.length, visible: I.w.filter(x => x.vis).length, first: t[0], gaps, alertUpS: I.alertT, heldBackS: I.blockT, wishS: I.wishT, reqS: I.reqT, lastInputMoved: I.lastInputMoved, errors };
};
(async () => {
  const [on, offR] = await Promise.all([one(''), one('G23')]);
  const out = { view, room, secs, on, off: offR };
  console.log(view, room, JSON.stringify(out));
  fs.writeFileSync(L.OUT + 'g23_idle_' + view + '_' + room + '.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

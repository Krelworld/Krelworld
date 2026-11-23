const L = require('./lib.js');
(async () => {
  for (const view of ['port', 'land']) {
    const g = await L.boot({ view, room: 'living' }); await g.calm(); const P = g.page;
    const r = await P.evaluate(async () => {
      G.busy = false; const W = E.viewW, x0 = E.camX; const ppl = [daddy, mommy, rory]; G.rory = true;
      ppl.forEach((e, i) => { AI.hold(e, true); e.stop(); e.room = G.room; e.hidden = false; e.state = 'idle'; e.y = 172; e.x = x0 + W * (0.2 + 0.25 * i); });
      marina.stop(); marina.x = x0 + W * 0.85; await new Promise(q => setTimeout(q, 800));
      const icons = [[daddy, SAY_ICON.d_septic], [mommy, SAY_ICON.m_hi_rory], [rory, SAY_ICON.j_food_great], [marina, SAY_ICON.m_hi_nunu]];
      for (const [e, ic] of icons) UI.bubble(e, ic, 6000);
      await new Promise(q => setTimeout(q, 600));
      return [...document.querySelectorAll('#fx .say')].map(n => { const b = n.getBoundingClientRect(); return { t: n.textContent, w: Math.round(b.width), h: Math.round(b.height), sw: n.scrollWidth, cw: n.clientWidth }; });
    });
    console.log(view, JSON.stringify(r));
    await g.shot(L.OUT + 'g22_twoemoji_' + view + '.png'); await g.close();
  }
})();

// screenshots for the visual claims: G29 paws at the edge toward Minka's room; G2 nothing left after closing cooking.
const L = require('./lib.js'); const fs = require('fs');
(async () => {
  const R = {};
  for (const mode of ['on', 'off']) {
    const off = mode === 'on' ? '' : L.MINE;
    // G29: Minka hides in the storage room (to the right of the den); Marina in the den; catch the first far mew and shoot 250 ms later
    for (const view of ['port', 'land']) {
      const g = await L.boot({ port: 8850, view, room: 'den', off, virtual: true, seed: 11 }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst(); await g.page.addScriptTag({ path: L.OUT + 'inst2.js' });
      await g.ev(() => { travelTo('den'); }); await g.run(2500);
      await g.ev(() => { Minka._debug.place('den', 200, 'sit'); Minka.hideNow(Minka.spots.find(s => Minka.spotRooms[s] === 'storage')); });
      let shot = null;
      for (let i = 0; i < 600 && !shot; i++) { await g.run(100); const m = await g.ev(() => { const l = __log.filter(e => e.type === 'mew' && e.far); const p = __log.filter(e => e.type === 'paw2'); return { mews: l.length, paws: p.length }; });
        if (m.mews && (mode === 'off' || m.paws)) { await g.run(300); shot = 'g29_' + mode + '_' + view; await g.shot(shot); R[shot] = await g.ev(() => ({ room: G.room, paws: __log.filter(e => e.type === 'paw2').map(e => e.side + '@' + e.x), camX: Math.round(E.camX), viewW: Math.round(E.viewW) })); } }
      await g.close();
    }
    // G2: the tidy line starts, cooking opens 0.5 s later, the line ends under the panel, cooking closes: what is left?
    { const g = await L.boot({ port: 8850, view: 'port', room: 'kitchen', off, virtual: true, seed: 7 }); await g.virtual(50); await g.run(1500); await g.calm();
      const t0 = await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; daddy.state = 'idle'; AI.hold(daddy, true); G.mess = []; addMess(G.room, 6); G.lastTidyAsk = E.t - 100; return E.t; });
      let asked = false; for (let i = 0; i < 300 && !asked; i++) { await g.run(100); asked = await g.ev(a => G.lastTidyAsk !== a, t0 - 100); }
      await g.run(500); await g.ev(() => UI.openCook('fridge')); await g.run(6000); await g.shot('g2_' + mode + '_underCooking');
      await g.ev(() => UI.closePanel()); await g.run(600); await g.shot('g2_' + mode + '_afterClose');
      R['g2_' + mode] = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length }));
      await g.close(); }
  }
  console.log(JSON.stringify(R, null, 1)); fs.writeFileSync(L.OUT + 't_shots.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

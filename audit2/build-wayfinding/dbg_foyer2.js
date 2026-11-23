const { boot, OUT, TH } = require('./lib.js');
(async () => {
  const g = await boot({ view: 'port', room: 'foyer', storage: { cm_builds: TH } }); await g.calm();
  for (const x of [10, 104, 136, 236, 262]) {
    await g.ev(x => { G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.state = 'idle'; marina.offY = 0; marina.x = x; for (const e of ENTS) if (e !== marina && e.room === 'foyer') { e.x = Math.max(20, Math.min(252, x + (e.x < x ? -70 : 70))); } }, x);
    await g.wait(2200);
    const r = await g.ev(() => { const s = Clarity.G35.signs[0]; const now = performance.now(); const b = s.spot && [s.spot[0] - 14, s.spot[1] - 7.5, s.spot[0] + 14, s.spot[1] + 7.5];
      const cb = b && [Clarity.toClient(b[0], b[1]), Clarity.toClient(b[2], b[3])].flat();
      const huds = b ? Clarity.hudRects(null, { client: true }).filter(h => h[0][0] < cb[2] + 4 && h[0][2] > cb[0] - 4 && h[0][1] < cb[3] + 4 && h[0][3] > cb[1] - 4).map(h => h[2]) : [];
      return { cam: Math.round(E.camX), spot: s.spot, ok: s.ok, age: s.at ? Math.round(now - s.at) : null, quiet: Clarity.playing() && !Clarity.screenOpen(), huds, people: ENTS.filter(e => e.here && e !== marina).map(e => e.id + '@' + Math.round(e.x)).join(' ') }; });
    console.log(x, JSON.stringify(r)); await g.shot(OUT + 'shots/dbg2_foyer_' + x + '.png');
  }
  await g.close();
})();

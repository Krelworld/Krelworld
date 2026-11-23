// A/B re-press of the rows that differed in the sweeps, under identical conditions: HEAD (8847, arch/head) vs this worktree
// with all switches on and with G35-G39 off. 4 presses each. Based on audit2/critic/ab_rows.js.
const { boot } = require('./lib.js'); const fs = require('fs');
const CASES = JSON.parse(process.argv[2] || 'null') || [['obj', 'den', 'wicker', '🧗', ''], ['obj', 'storage', 'shades', '🎩', ''], ['who', 'living', 'miles', '🤗', 'crying'], ['who', 'living', 'miles', '🤗', 'nappy'],
  ['who', 'living', 'miles', '✋', ''], ['who', 'living', 'miles', '✋', 'fort'], ['who', 'dining', 'mommy', '📱', ''], ['who', 'dining', 'mommy', '📱', 'dish']];
(async () => {
  const out = {};
  for (const [name, o] of [['HEAD', { head: true }], ['wt all on', {}], ['wt G35-39 off', { off: 'G35,G36,G37,G38,G39' }]]) {
    const g = await boot({ view: 'port', room: 'living', ...o }); out[name] = {};
    for (const [kind, room, id, ico, setup] of CASES) {
      const states = [];
      for (let i = 0; i < 4; i++) {
        await g.ev(r => { if (G.room !== r) travelTo(r); }, room); await g.wait(900); await g.calm();
        const ok = await g.ev(([kind, room, id, ico, setup]) => {
          G.busy = false; marina.x = Math.min(ROOMS[room].w - 30, 120); marina.state = 'idle'; marina.offY = 0; G.holding = null; G.fort = null;
          miles.crying = setup === 'crying'; if (setup === 'crying') miles.cryT = 60; miles.poopy = setup === 'nappy';
          let e = null, list;
          if (kind === 'obj') { const p = PROPS[room].find(q => q.id === id); if (!p) return 'noprop'; list = propActions(p); }
          else { e = { miles, mommy, daddy, rory, niko }[id]; if (e !== miles) { e.room = G.room; e.hidden = false; e.state = 'idle'; e.x = Math.min(ROOMS[G.room].w - 20, marina.x + 44); e.y = marina.y; }
            if (setup === 'dish') G.holding = { type: 'dish', dish: { art: 'cake', score: 3, say: [], name: 'x', ings: ['eggs'], method: 'bake' } };
            if (setup === 'fort') G.fort = { complete: true, room: G.room, guests: [], x: 120, L: 90, R: 150, roofY: 100, pieces: [], inside: false, ox: 0, oy: 0, bw: 40, bh: 30, img: document.createElement('canvas'), scale: 1, toys: [], theme: 'cozy', wob: 0, built: E.t };
            list = entActions(e); }
          const a = list.find(x => x.ico === ico); if (!a) return 'nochoice'; UI.closeActions(); a.fn(); return 'ok';
        }, [kind, room, id, ico, setup]);
        await g.wait(1600);
        states.push(ok === 'ok' ? await g.ev(() => marina.state + (document.getElementById('panel').classList.contains('hidden') ? '' : '+panel')) : ok);
        await g.ev(() => { if (!document.getElementById('panel').classList.contains('hidden')) UI.closePanel(); G.fort = null; G.holding = null; }); await g.wait(2500);
      }
      out[name][room + '/' + id + ' ' + ico + (setup ? ' (' + setup + ')' : '')] = states.join(',');
    }
    out[name].errors = g.realErrors().length; await g.close();
  }
  console.log(JSON.stringify(out, null, 1)); fs.writeFileSync(__dirname + '/ab_rows_' + Date.now() + '.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

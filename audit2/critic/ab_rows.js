// Critic: re-press the rows that differed between the HEAD baseline and the plumbing sweep, under identical unloaded
// conditions, in both builds (HEAD on 8847 = arch/head; core with live no-op plumbing on 8892). 4 presses each.
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const A = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/';
const CASES = [['obj', 'kitchen', 'stool1', '🧗', ''], ['obj', 'den', 'wicker', '🧗', ''], ['obj', 'storage', 'shades', '🎩', ''],
  ['who', 'living', 'miles', '🤗', ''], ['who', 'living', 'miles', '🤗', 'crying'], ['who', 'living', 'miles', '🤗', 'nappy'], ['who', 'living', 'miles', '✋', '']];
(async () => {
  const out = {};
  for (const [name, port, dir, plumb] of [['HEAD', 8847, A + 'head/public/chef-marina', false], ['core+plumbing', 8892, undefined, true]]) {
    const g = await H.boot({ port, view: 'port', room: 'living', dir }); out[name] = {};
    if (plumb) await g.page.evaluate(() => { const C = window.Clarity; C.on.TY = true; const f = () => { }; for (const p of C.points()) C.hook(p, 'TY', { before: f, after: f });
      for (const e of ['room', 'screenOpen', 'screenClose', 'activityStart', 'activityEnd']) C.listen(e, 'TY', f); C.every(50, 'TY', () => { C.quietFor(); C.hudRects(); }); C.pointer('down', 'TY', f); C.appear('div', 'TY', f); });
    for (const [kind, room, id, ico, setup] of CASES) {
      const states = [];
      for (let i = 0; i < 4; i++) {
        await g.page.evaluate(r => { travelTo(r); }, room); await g.page.waitForTimeout(900); await g.calm();
        const ok = await g.page.evaluate(([kind, room, id, ico, setup]) => {
          G.busy = false; marina.x = Math.min(ROOMS[room].w - 30, 120); marina.state = 'idle'; marina.offY = 0;
          if (setup === 'crying') { miles.crying = true; miles.cryT = 60; } else if (setup === 'nappy') miles.poopy = true; else { miles.crying = false; miles.poopy = false; }
          let list;
          if (kind === 'obj') { const p = PROPS[room].find(q => q.id === id); if (!p) return 'noprop'; list = propActions(p); }
          else list = entActions(miles);
          const a = list.find(x => x.ico === ico); if (!a) return 'nochoice'; UI.closeActions(); a.fn(); return 'ok';
        }, [kind, room, id, ico, setup]);
        await g.page.waitForTimeout(1600);
        states.push(ok === 'ok' ? await g.page.evaluate(() => marina.state) : ok);
        await g.page.waitForTimeout(2500);
      }
      out[name][room + '/' + id + ' ' + ico + (setup ? ' (' + setup + ')' : '')] = states.join(',');
    }
    out[name].errors = g.errors.filter(e => !/chip_love/.test(e)).length; await g.close();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

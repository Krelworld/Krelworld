// A/B re-press of the non-identical sweep rows, HEAD (arch/head on 8911) vs this worktree (8910), identical conditions, 4 presses each
// (template: critic/ab_rows.js). Also replays the flow 'tap floor walks; tap object opens its choices' 4 times in each build.
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js'); const fs = require('fs');
const HEAD = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina';
const MINE = '/home/user/Krelworld/.wt/screens/public/chef-marina';
const CASES = [['obj', 'backyard', 'tr_apple', '🍎', ''], ['obj', 'den', 'wicker', '🧗', ''], ['obj', 'kitchen', 'stool1', '🪑', ''], ['obj', 'mroom', 'mstack', '📚', ''], ['obj', 'storage', 'shades', '🎩', ''],
  ['who', 'living', 'miles', '🤗', ''], ['who', 'living', 'miles', '🤗', 'crying'], ['who', 'living', 'miles', '✋', ''], ['who', 'living', 'miles', '✋', 'dish'], ['who', 'living', 'miles', '✋', 'fort']];
(async () => {
  const out = {};
  for (const [name, port, dir] of [['HEAD', 8911, HEAD], ['screens', 8910, MINE]]) {
    const g = await H.boot({ port, view: 'port', room: 'living', dir }); out[name] = {};
    for (const [kind, room, id, ico, setup] of CASES) {
      const states = [];
      for (let i = 0; i < 4; i++) {
        await g.page.evaluate(r => { travelTo(r); }, room); await g.page.waitForTimeout(900); await g.calm();
        const ok = await g.page.evaluate(([kind, room, id, ico, setup]) => {
          G.busy = false; marina.x = Math.min(ROOMS[room].w - 30, 120); marina.state = 'idle'; marina.offY = 0; G.holding = null; G.fort = null;
          if (setup === 'crying') { miles.crying = true; miles.cryT = 60; } else { miles.crying = false; miles.poopy = false; }
          if (setup === 'dish') G.holding = { type: 'dish', dish: { art: 'cake', score: 3, say: [], name: 'x', ings: ['eggs'], method: 'bake' } };
          let list; if (kind === 'obj') { const p = PROPS[room].find(q => q.id === id); if (!p) return 'noprop'; list = propActions(p); } else list = entActions(miles);
          const a = list.find(x => x.ico === ico); if (!a) return 'nochoice'; UI.closeActions(); a.fn(); return 'ok';
        }, [kind, room, id, ico, setup]);
        await g.page.waitForTimeout(1600); states.push(ok === 'ok' ? await g.page.evaluate(() => marina.state) : ok); await g.page.waitForTimeout(2500);
      }
      out[name][room + '/' + id + ' ' + ico + (setup ? ' (' + setup + ')' : '')] = states.join(',');
    }
    // the flow, replayed
    const fl = [];
    for (let i = 0; i < 4; i++) {
      await g.page.evaluate(() => travelTo('dining')); await g.page.waitForTimeout(1500); await g.calm();
      const pt = await g.page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(marina.x + 70, 168).map((v, i) => v + (i ? st.top : st.left)); }); const x0 = await g.page.evaluate(() => marina.x);
      await g.page.touchscreen.tap(pt[0], pt[1]); await g.page.waitForTimeout(1800); const moved = await g.page.evaluate(x0 => Math.abs(marina.x - x0) > 5, x0);
      await g.page.evaluate(() => { G.busy = false; G.sceneOn = false; UI.closeActions(); const t = PROPS.dining.find(q => q.id === 'table'); marina.x = t.x - 70; }); await g.page.waitForTimeout(1000);
      const pt2 = await g.page.evaluate(() => { const t = PROPS.dining.find(q => q.id === 'table'); const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(t.x, t.y - 20).map((v, i) => v + (i ? st.top : st.left)); });
      await g.page.touchscreen.tap(pt2[0], pt2[1]); await g.page.waitForTimeout(3000); fl.push('walked:' + moved + ' table:' + await g.page.evaluate(() => document.querySelectorAll('.act').length));
    }
    out[name].flow = fl.join(' | ');
    out[name].errors = g.errors.filter(e => !/chip_love/.test(e)).length; await g.close();
  }
  fs.writeFileSync('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-screens/ab_rows.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

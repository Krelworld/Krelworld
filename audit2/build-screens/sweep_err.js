// zero page errors with all switches on and with my switches off, in the four views; my-switches-off layouts vs HEAD
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const HEAD = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina';
const MINE = 'G3,G9,G10,G12,G32,G33,G34';
(async () => { const R = {};
  for (const v of ['port', 'land', 'portSmall', 'landSmall']) for (const [cfg, port, dir, off] of [['on', 8910, undefined, ''], ['mineOff', 8910, undefined, MINE], ['head', 8911, HEAD, '']]) {
    const g = await boot({ port, dir, view: v, room: 'den', off, seed: true }); await g.calm(); await g.ev(TLIB);
    const lay = await g.ev(async () => { const o = {}; const list = Object.keys(T.SCREENS).concat(Object.keys(T.CANVAS).map(k => 'canvas_' + k));
      for (const s of list) { await T.reset(); G.busy = false; try { if (s.startsWith('canvas_')) await T.CANVAS[s.slice(7)](); else await T.SCREENS[s](); } catch (e) { o[s] = 'THROW ' + e.message; continue; } await T.sleep(500);
        o[s] = { lay: T.layout(), x: getComputedStyle(document.getElementById('xFloat')).display + ':' + document.getElementById('xFloat').textContent, pad: getComputedStyle(document.getElementById('panel')).paddingLeft }; }
      await T.reset(); Studio.open(); await T.sleep(500); o.studio = { lay: [...document.querySelectorAll('#studio button, #studio canvas')].map(n => { const r = n.getBoundingClientRect(); return T.nm(n) + '@' + [r.left, r.top, r.width, r.height].map(Math.round).join(','); }), x: getComputedStyle(document.getElementById('xFloat')).display };
      Studio.close(); await T.sleep(300); return o; });
    // the title screen too
    const t = await boot({ port, dir, view: v, start: false, off, seed: true }); await t.wait(800);
    const title = await t.ev(() => [...document.querySelectorAll('#title button')].map(n => { const r = n.getBoundingClientRect(); return n.className + '@' + [r.left, r.top, r.width, r.height].map(Math.round).join(','); }));
    R[v + ' ' + cfg] = { lay, title, errors: realErrors(g.errors).concat(realErrors(t.errors)) };
    console.log(v, cfg, 'errors', R[v + ' ' + cfg].errors.length, R[v + ' ' + cfg].errors.slice(0, 3));
    await g.close(); await t.close();
  }
  // compare mineOff vs head, screen by screen
  for (const v of ['port', 'land', 'portSmall', 'landSmall']) { const a = R[v + ' mineOff'], b = R[v + ' head'], diff = [];
    for (const s in a.lay) if (JSON.stringify(a.lay[s]) !== JSON.stringify(b.lay[s])) diff.push(s);
    if (JSON.stringify(a.title) !== JSON.stringify(b.title)) diff.push('title');
    console.log('mineOff vs HEAD', v, diff.length ? 'DIFF: ' + diff.join(' ') : 'identical'); R['cmp ' + v] = diff; }
  fs.writeFileSync(OUT + 'sweep_err.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

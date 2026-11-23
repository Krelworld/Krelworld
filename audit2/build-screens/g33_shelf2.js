const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
eval(fs.readFileSync(__dirname + '/lsx_lib.txt', 'utf8').replace('const LIB =', 'global.LIB ='));
(async () => { const out = {};
  for (const off of ['', 'G33,G34']) { const g = await boot({ port: 8910, view: 'port', room: 'den', off }); await g.calm(); await g.ev(TLIB); await g.ev(LIB);
    await g.ev(() => LSX.seed(4)); await g.ev(async () => { await T.reset(); LegoShelf.open({}); await T.sleep(400); });
    let xy = await g.ev(() => LSX.occ(0)); await g.tapXY(xy[0], xy[1]); await g.wait(250); const hero = await g.ev(() => LSX.g()); let taps = 0;
    while (taps < 4 && await g.ev(() => LegoShelf.active)) { xy = await g.ev(() => LSX.btnXY('#panel .ls-top > button')); await g.tapXY(xy[0], xy[1]); taps++; await g.wait(300); }
    await g.ev(async () => { LegoShelf.open({}); await T.sleep(400); }); xy = await g.ev(() => LSX.occ(0)); await g.tapXY(xy[0], xy[1]); await g.wait(250);
    xy = await g.ev(() => LSX.btnXY('#panel .ls-act[aria-label="take it down to the table"]')); await g.tapXY(xy[0], xy[1]); await g.wait(1500);
    const td = await g.ev(() => ({ shelf: LegoShelf.active, table: Bricks.active, room: G.room, panel: !document.getElementById('panel').classList.contains('hidden'), bricksSaved: !!localStorage.getItem('cm_bricks') }));
    // full shelf + pending: the existing repeating wave (motion over 4.5 s)
    const full = await g.ev(async () => { await T.reset(); await LSX.seed(8); Bricks.open({ kind: 'lego' }); await T.sleep(300); Bricks.help(3); Bricks.help(4); Bricks.help(4); await T.sleep(1200); T.press('.bk-keep'); await T.sleep(200);
      const t0 = performance.now(), fr = []; while (performance.now() - t0 < 4500) { await new Promise(r => requestAnimationFrame(r)); fr.push([Math.round(performance.now() - t0), LSX.hash()]); }
      const st = LegoShelf.state(); let changes = 0; for (let i = 1; i < fr.length; i++) if (fr[i][1] !== fr[i - 1][1]) changes++; await T.reset(); return { open: st.open, pending: st.pending, changes, frames: fr.length }; });
    out[off || 'on'] = { hero, tapsToLeave: taps, takeDown: td, fullPending: full, errors: realErrors(g.errors) }; console.log(off || 'on', JSON.stringify(out[off || 'on'])); await g.close(); }
  fs.writeFileSync(OUT + 'g33_shelf2.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

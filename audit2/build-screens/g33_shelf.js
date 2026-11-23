// G33 (Lego shelf ◀️/❌) and G34 (one-time hop wave on opening). Results -> g33_shelf.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
const LIB = () => {
  window.LSX = {};
  LSX.seed = async n => {            // n different models on the shelf, made from the builder's own ideas
    localStorage.removeItem('cm_brickshelf'); const all = [];
    for (const kind of ['lego', 'tiles']) { Bricks.open({ kind }); await T.sleep(250); for (const i of Bricks.state().ideas) all.push([kind, i]); Bricks.close(); await T.sleep(100); }
    for (let k = 0; k < n && k < all.length; k++) { const [kind, idea] = all[k]; Bricks.load(kind, idea.pieces, idea.id); LegoShelf.keep(kind); }
    localStorage.removeItem('cm_bricks'); return LegoShelf.count;
  };
  LSX.g = () => { const b = document.querySelector('#panel .ls-top > button'), st = LegoShelf.state(), x = document.getElementById('xFloat'); return { btn: b ? b.textContent : null, mode: st.open ? st.mode : 'closed', xFloat: getComputedStyle(x).display === 'none' ? '-' : x.textContent }; };
  LSX.slot = i => { const s = LegoShelf.state().slots[i]; return [s.x + s.w / 2, s.y + s.h / 2]; };
  LSX.occ = k => { const s = LegoShelf.state().slots.filter(q => q.kind)[k]; return s ? [s.x + s.w / 2, s.y + s.h / 2] : null; };
  LSX.btnXY = sel => { const n = document.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  LSX.hash = () => { const c = document.querySelector('#panel .ls-cv'); if (!c) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i] + d[i + 1] * 3) | 0; return h; };
};
(async () => {
  // ---------------------------------------------------------------- G33: the glyph follows the mode through every transition
  for (const v of ['land', 'port', 'landSmall']) {
    const g = await boot({ port: 8910, view: v, room: 'den' }); await g.calm(); await g.ev(TLIB); await g.ev(LIB);
    const steps = []; const step = async (label) => { await g.wait(250); steps.push(label + ' ' + JSON.stringify(await g.ev(() => LSX.g()))); console.log('  ' + v + ' ' + steps[steps.length - 1]); };
    const tap = async xy => { if (!xy) { steps.push('MISSING target ' + JSON.stringify(await g.ev(() => LSX.g()))); return; } await g.tapXY(xy[0], xy[1]); };
    await g.ev(() => LSX.seed(4)); await g.ev(async () => { await T.reset(); LegoShelf.open({}); }); await step('open');
    await tap(await g.ev(() => LSX.slot(0))); await step('pickUp');
    await tap(await g.ev(() => LSX.btnXY('#panel .ls-top > button'))); await step('putBack(top)');
    await tap(await g.ev(() => LSX.slot(0))); await g.wait(250); await tap(await g.ev(() => LSX.btnXY('#panel .ls-act[aria-label="move it"]'))); await step('startMove');
    await tap(await g.ev(() => LSX.slot(6))); await step('dropAt(empty 6)'); steps.push('slot6 now ' + await g.ev(() => LegoShelf.state().slots[6].kind));
    await tap(await g.ev(() => LSX.slot(6))); await g.wait(250); await tap(await g.ev(() => LSX.btnXY('#panel .ls-act[aria-label="move it"]'))); await step('startMove2');
    await tap(await g.ev(() => LSX.slot(1))); await step('swap(1)');
    await tap(await g.ev(() => LSX.slot(1))); await g.wait(250); await tap(await g.ev(() => LSX.btnXY('#panel .ls-act[aria-label="move it"]'))); await step('startMove3');
    await tap(await g.ev(() => LSX.btnXY('#panel .ls-top > button'))); await step('endMove(top)');
    // rotation while in the hero view (layout() rebuilds it)
    await tap(await g.ev(() => LSX.slot(2))); await step('pickUp(2)');
    const vp = await g.page.viewportSize(); await g.page.setViewportSize({ width: vp.height, height: vp.width }); await g.wait(800); await step('rotated'); await g.page.setViewportSize(vp); await g.wait(800); await step('rotatedBack');
    if (v !== 'port') { // the floating ❌ copies ◀️ and does the same thing (one step back)
      const x = await g.ev(() => LSX.btnXY('#xFloat')); await tap(x); await step('xFloat in hero');
      await tap(await g.ev(() => LSX.slot(2))); await g.wait(250); await tap(await g.ev(() => LSX.btnXY('#panel .ls-act[aria-label="move it"]'))); await step('move (xFloat shows)');
      await tap(await g.ev(() => LSX.btnXY('#xFloat'))); await step('xFloat in move');
    }
    // leaving from the hero view takes 2 taps, as today
    await tap(await g.ev(() => LSX.occ(0))); await step('pickUp(0)'); let taps = 0;
    while (taps < 4 && await g.ev(() => LegoShelf.active)) { await tap(await g.ev(() => LSX.btnXY('#panel .ls-top > button'))); taps++; await g.wait(300); }
    steps.push('tapsToLeaveFromHero ' + taps);
    // bin with its ❓ confirm, and take-down
    await g.ev(async () => { LegoShelf.open({}); await T.sleep(400); }); const n0 = await g.ev(() => LegoShelf.count);
    await tap(await g.ev(() => LSX.occ(0))); await g.wait(250); const bin = await g.ev(() => LSX.btnXY('#panel .ls-act[aria-label="take it off the shelf"]')); await tap(bin); await g.wait(200); steps.push('bin ask: ' + await g.ev(() => document.querySelector('#panel .ls-act[aria-label="take it off the shelf"]').textContent) + ' ' + JSON.stringify(await g.ev(() => LSX.g())));
    await tap(bin); await step('bin confirmed'); steps.push('count ' + n0 + ' -> ' + await g.ev(() => LegoShelf.count));
    await tap(await g.ev(() => LSX.occ(1))); await g.wait(250); await tap(await g.ev(() => LSX.btnXY('#panel .ls-act[aria-label="take it down to the table"]'))); await g.wait(500);
    steps.push('takeDown -> shelf ' + (await g.ev(() => LegoShelf.active)) + ', table ' + await g.ev(() => Bricks.active));
    await g.ev(() => T.reset());
    log('G33 shelf ' + v, steps); res['G33 shelf errors ' + v] = realErrors(g.errors); await g.close();
  }
  // the full-shelf pending flow: Bricks keep -> full shelf -> its ❌ returns to the builder waiting underneath
  for (const off of ['', 'G33,G34']) {
    const g = await boot({ port: 8910, view: 'land', room: 'den', off }); await g.calm(); await g.ev(TLIB); await g.ev(LIB);
    const r = await g.ev(async () => { await LSX.seed(8); await T.reset(); Bricks.open({ kind: 'lego' }); await T.sleep(300); Bricks.help(3); Bricks.help(4); Bricks.help(4); await T.sleep(1200);
      const k = document.querySelector('.bk-keep'); const o = { keepShown: !!k && !k.classList.contains('bk-off') }; if (!o.keepShown) return o; T.press(k); await T.sleep(1500);
      o.shelf = LegoShelf.state().open; o.pending = LegoShelf.state().pending; o.g = LSX.g(); o.storage = localStorage.getItem('cm_brickshelf').length; return o; });
    if (r.keepShown && r.shelf) { const x = await g.ev(() => LSX.btnXY('#panel .ls-top > button')); await g.tapXY(x[0], x[1]); await g.wait(500); r.afterX = await g.ev(() => ({ shelf: LegoShelf.active, builderBack: Bricks.active && !!document.querySelector('#panel .bk-top'), count: LegoShelf.count })); }
    log('pendingFlow' + (off ? ' off' : ''), r); res['pending errors' + off] = realErrors(g.errors); await g.close();
  }
  // ---------------------------------------------------------------- G34: one hop wave on opening, nothing saved, no sound
  for (const off of ['', 'G34']) {
    const g = await boot({ port: 8910, view: 'land', room: 'den', off }); await g.calm(); await g.ev(TLIB); await g.ev(LIB);
    for (const n of [0, 1, 7, 8]) {
      const r = await g.ev(async n => { await LSX.seed(n); await T.reset(); await T.sleep(1200);
        const before = { ls: localStorage.getItem('cm_brickshelf'), count: LegoShelf.count };
        let sounds = 0; const wrap = (o, k) => { const f = o[k]; o[k] = function () { sounds++; return f.apply(this, arguments); }; return () => { o[k] = f; }; };
        const un = [wrap(Audio2, 'blip'), wrap(Audio2, 'jingle'), wrap(Audio2, 'sfx'), wrap(Audio2, 'whoosh')];
        const t0 = performance.now(); LegoShelf.open({}); const frames = [];
        while (performance.now() - t0 < 3200) { await new Promise(r => requestAnimationFrame(r)); frames.push([Math.round(performance.now() - t0), LSX.hash()]); }
        un.forEach(f => f());
        const last = frames[frames.length - 1][1], moving = frames.filter(f => f[1] !== last).map(f => f[0]);
        const st = LegoShelf.state(); const after = { ls: localStorage.getItem('cm_brickshelf'), count: LegoShelf.count };
        LegoShelf.close(); await T.sleep(300);
        return { n, count: before.count, storageSame: before.ls === after.ls, countSame: before.count === after.count, slots: st.slots.filter(s => s.kind).length, sounds, movingFrom: moving[0] || null, movingTo: moving[moving.length - 1] || null, movingFrames: moving.length };
      }, n);
      log('G34 wave' + (off ? ' off' : '') + ' n=' + n, r);
    }
    // a model tapped mid-hop opens its hero view
    if (!off) { await g.ev(async () => { await LSX.seed(7); await T.reset(); LegoShelf.open({}); await T.sleep(520); }); const xy = await g.ev(() => LSX.slot(0)); await g.tapXY(xy[0], xy[1]); await g.wait(250); log('G34 tap mid-hop', await g.ev(() => LSX.g())); await g.ev(() => T.reset()); }
    res['G34 errors' + off] = realErrors(g.errors); await g.close();
  }
  fs.writeFileSync(OUT + 'g33_shelf.json', JSON.stringify(res, null, 1));
  for (const k in res) if (/errors/.test(k) && res[k].length) console.log('ERRORS', k, res[k]);
})().catch(e => { console.error(e); process.exit(1); });

// G9 checks (landscape cooking). Results -> g9.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const L = { land: ['land', null], landSmall: ['landSmall', null], '844x340i47': [{ width: 844, height: 340 }, { left: 47, right: 47, bottom: 21 }], '844x340': [{ width: 844, height: 340 }, null] };
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
(async () => {
  for (const v of Object.keys(L)) {
    const g = await boot({ port: 8910, view: L[v][0], inset: L[v][1], room: 'kitchen' }); await g.calm(); await g.ev(TLIB);
    // ---- ingredient step, each shelf: rows visible, controls visible, every tile reachable
    const ing = await g.ev(async () => {
      const out = {}, hit = n => { const r = n.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && (e === n || n.contains(e)); };
      const inView = n => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; };
      const ctl = () => { const P = document.getElementById('panel'); const list = [...P.querySelectorAll('.pbody>.tray .slot'), ...P.querySelectorAll('.pbody>.row:not(.shelves) .pbtn'), ...P.querySelectorAll('.pbody>.row.shelves .pbtn')];
        return list.every(n => inView(n) && (n.tagName !== 'BUTTON' || n.disabled || hit(n))) ? 'ok' : list.filter(n => !(inView(n) && (n.tagName !== 'BUTTON' || n.disabled || hit(n)))).map(T.nm).join(','); };
      for (const sh of ['fridge', 'freezer', 'cabinet', 'bowl']) {
        await T.reset(); UI.openCook(sh); await T.sleep(300);
        const grid = document.querySelector('#panel .grid.ing'), gr = grid.getBoundingClientRect(), pb = grid.parentElement, tiles = [...grid.querySelectorAll('.tile')];
        const vb = Math.min(gr.bottom, innerHeight), rows = {}; let full = 0;
        for (const t of tiles) { const r = t.getBoundingClientRect(); const k = Math.round(r.top); rows[k] = rows[k] || { full: 0, n: 0, vis: Math.max(0, Math.min(r.bottom, vb) - Math.max(r.top, gr.top)) }; rows[k].n++; if (r.top >= gr.top - 0.5 && r.bottom <= vb + 0.5 && r.right <= innerWidth) { full++; rows[k].full++; } }
        const fullRows = Object.values(rows).filter(r => r.full === r.n).length, partial = Object.values(rows).find(r => r.full < r.n && r.vis > 0);
        const xf = document.getElementById('xFloat').getBoundingClientRect(), t0 = tiles[0].getBoundingClientRect();
        const firstClear = !(t0.left < xf.right && t0.right > xf.left && t0.top < xf.bottom && t0.bottom > xf.top) && hit(tiles[0]);
        const ctlTop = ctl(); grid.scrollTop = grid.scrollHeight; await T.sleep(50); const ctlScrolled = ctl(); const pbodyScroll = pb.scrollTop;
        // every tile: scroll the grid to it, then the tile is what is under its centre
        let reach = 0; const miss = []; for (const t of tiles) { t.scrollIntoView({ block: 'nearest' }); await T.sleep(5); if (hit(t) && inView(t)) reach++; else miss.push(t.dataset.k); }
        out[sh] = { tiles: tiles.length, cols: Object.values(rows)[0].n, tilePx: Math.round(t0.width), fullyVisible: full, fullRows, partialRowPx: partial ? Math.round(partial.vis) : 0, firstTileClearOfXFloat: firstClear, controlsAtTop: ctlTop, controlsAfterGridScroll: ctlScrolled, pbodyScrolled: pbodyScroll, reachable: reach + '/' + tiles.length, miss, display: getComputedStyle(pb).display, lane: Clarity.G3.lane };
      }
      return out;
    });
    log('ingredients ' + v, ing);
    await g.ev(async () => { await T.reset(); UI.openCook('fridge'); await T.sleep(300); }); await g.shot('g9_' + v + '_ing');
    // ---- picks with real taps: up to 5, a 6th shakes; slot tap removes; ↩️ 🗑️; ✅ -> methods; ⬅️ back keeps picks
    const tapEl = async sel => { const b = await g.ev(s => { const n = typeof s === 'string' ? document.querySelector(s) : null; if (!n) return null; n.scrollIntoView({ block: 'nearest' }); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); if (!b) throw new Error('no ' + sel); await g.tapXY(b[0], b[1]); await g.wait(120); };
    const slots = () => g.ev(() => document.querySelectorAll('#panel .tray .slot.full').length);
    const picks = [];
    for (let i = 1; i <= 6; i++) { await tapEl('#panel .grid.ing .tile:nth-child(' + i + ')'); picks.push(await slots()); }
    await tapEl('#panel .tray .slot.full'); const afterSlotTap = await slots();
    await tapEl('#panel .pbtn[aria-label=undo]'); const afterUndo = await slots();
    await tapEl('#panel .pbtn[aria-label="start over"]'); const afterClear = await slots();
    // scroll-then-lift on a tile is not a pick (calm.js guard; the food grid is now the scroller)
    const scrollLift = await g.ev(async () => { const grid = document.querySelector('#panel .grid.ing'), t = grid.querySelectorAll('.tile')[2], r = t.getBoundingClientRect(); const ev = type => t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 11, clientX: r.left + 20, clientY: r.top + 20, isPrimary: true }));
      const before = document.querySelectorAll('#panel .tray .slot.full').length; ev('pointerdown'); grid.scrollTop += 40; await T.sleep(30); ev('pointerup'); await T.sleep(50); const a = document.querySelectorAll('#panel .tray .slot.full').length; grid.scrollTop = 0;
      ev('pointerdown'); ev('pointerup'); await T.sleep(50); return { before, afterScrollLift: a, afterPlainTap: document.querySelectorAll('#panel .tray .slot.full').length, gridScrolls: grid.scrollHeight > grid.clientHeight }; });
    await tapEl('#panel .grid.ing .tile:nth-child(4)'); await tapEl('#panel .pbtn.go'); await g.wait(200);
    const methods = await g.ev(() => { const ms = [...document.querySelectorAll('#panel .method')], hit = n => { const r = n.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && n.contains(e) && r.bottom <= innerHeight && r.right <= innerWidth; };
      const back = document.querySelector('#panel .pbtn[aria-label=back]'); return { order: ms.map(m => m.textContent).join(''), allVisible: ms.every(hit), size: ms.map(m => Math.round(m.getBoundingClientRect().width) + 'x' + Math.round(m.getBoundingClientRect().height))[0], backVisible: hit(back) }; });
    await g.shot('g9_' + v + '_methods');
    await tapEl('#panel .pbtn[aria-label=back]'); await g.wait(200);
    const backKept = await g.ev(() => ({ ing: !!document.querySelector('#panel .grid.ing'), picks: document.querySelectorAll('#panel .tray .slot.full').length }));
    log('picks ' + v, { picks, afterSlotTap, afterUndo, afterClear, scrollLift, methods, backKept });
    // ---- meter: fry and bake; the bar >= 36 px, bar (+ knob) and 🛑 fully in the body's view after the one scroll; 🛑 never moves
    for (const m of ['fry', 'bake']) for (const zone of ['good', 'burnt']) {
      const r = await g.ev(async ([m, zone]) => {
        await T.reset(); UI.openCook('fridge'); await T.sleep(200); T.press('#panel .grid.ing .tile'); T.press('#panel .pbtn.go'); await T.sleep(100); const s0 = Clarity.G9.scrolled; T.press('#panel .method[data-m=' + m + ']'); await T.sleep(250);
        const meter = document.querySelector('#panel .meter'), stop = meter.nextElementSibling, pb = meter.parentElement, v = pb.getBoundingClientRect(), a = meter.getBoundingClientRect(), b = stop.getBoundingClientRect();
        const inside = a.top - 8 >= v.top - 0.5 && a.bottom + 8 <= v.bottom + 0.5 && b.top >= v.top - 0.5 && b.bottom <= v.bottom + 0.5 && b.bottom <= innerHeight;
        const sb = [Math.round(b.left), Math.round(b.top)]; const pos = []; for (let i = 0; i < 6; i++) { await T.sleep(120); const q = stop.getBoundingClientRect(); pos.push(Math.round(q.left) + ',' + Math.round(q.top)); }
        // stop the knob in the wanted zone: x read from the knob just before pressing
        const knob = meter.querySelector('i'), frac = () => { const k = knob.getBoundingClientRect(), mr = meter.getBoundingClientRect(); return (k.left + 6 - mr.left) / mr.width; };
        let x = frac(), tries = 0; while (tries++ < 400 && !(zone === 'good' ? x < 0.45 && x > 0.05 : x > 0.82 && x < 0.97)) { await T.sleep(8); x = frac(); }
        T.press(stop); await T.sleep(400);
        const name = (document.querySelector('#panel .result') || { textContent: '' }).textContent;
        return { meterH: Math.round(a.height), inside, scrolls: Clarity.G9.scrolled - s0, pbodyScrollTop: Math.round(pb.scrollTop), stopAt: sb, stopMoves: new Set(pos).size > 1 ? pos : 'still', x: +x.toFixed(2), burnt: /Charcoal/.test(name) };
      }, [m, zone]);
      log('meter ' + v + ' ' + m + ' ' + zone, r);
      if (zone === 'good') { await g.ev(async m => { await T.reset(); UI.openCook('fridge'); await T.sleep(200); T.press('#panel .grid.ing .tile'); T.press('#panel .pbtn.go'); await T.sleep(100); T.press('#panel .method[data-m=' + m + ']'); }, m); await g.wait(300); await g.shot('g9_' + v + '_meter_' + m); }
    }
    // ---- result screen: give / carry / other way / again are all there and hit-testable; ⬅️ goes to the methods, 🔁 starts again
    const result = await g.ev(async () => { await T.reset(); UI.openCook('fridge'); await T.sleep(200); T.press('#panel .grid.ing .tile'); T.press('#panel .pbtn.go'); await T.sleep(100); T.press('#panel .method[data-m=stack]'); await T.sleep(1800);
      const btns = [...document.querySelectorAll('#panel .result button')], hit = n => { const r = n.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && n.contains(e); };
      const o = { buttons: btns.map(b => b.getAttribute('aria-label')), allHit: btns.every(hit) };
      T.press(document.querySelector('#panel .result .pbtn[aria-label="other way"]')); await T.sleep(150); o.otherWayToMethods = !!document.querySelector('#panel .methods');
      return o; });
    await g.shot('g9_' + v + '_result_back');
    log('result ' + v, result);
    // ---- without :has(): the ingredient rules drop out; the step falls back to today's layout; methods/meter rules alone are fine
    const noHas = await g.ev(async () => {
      const st = [...document.querySelectorAll('style[data-clarity=G9]')][0]; const kept = [];
      for (const mq of st.sheet.cssRules) { for (let i = mq.cssRules.length - 1; i >= 0; i--) if (mq.cssRules[i].cssText.includes(':has(')) mq.deleteRule(i); for (const r of mq.cssRules) kept.push(r.selectorText); }
      await T.reset(); UI.openCook('fridge'); await T.sleep(300); const ingLayout = T.layout(); const disp = getComputedStyle(document.querySelector('#panel .pbody')).display;
      T.press('#panel .grid.ing .tile'); T.press('#panel .pbtn.go'); await T.sleep(150); const ms = [...document.querySelectorAll('#panel .method')]; const allIn = ms.every(m => { const r = m.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; });
      await T.reset(); return { kept, ingDisplay: disp, ingLayout, methodsAllOnScreen: allIn };
    });
    res['noHas ' + v] = noHas; console.log('noHas ' + v, JSON.stringify({ kept: noHas.kept, ingDisplay: noHas.ingDisplay, methodsAllOnScreen: noHas.methodsAllOnScreen }));
    res['errors ' + v] = realErrors(g.errors); console.log('errors', v, res['errors ' + v]);
    await g.close();
    // today's ingredient layout (G9 off) for the same view, to compare with the no-:has() fallback
    const g2 = await boot({ port: 8910, view: L[v][0], inset: L[v][1], room: 'kitchen', off: 'G9' }); await g2.calm(); await g2.ev(TLIB);
    const today = await g2.ev(async () => { await T.reset(); UI.openCook('fridge'); await T.sleep(300); return T.layout(); });
    console.log('noHas fallback == G9 off (with G3 lane on both)', v, JSON.stringify(today) === JSON.stringify(noHas.ingLayout));
    res['noHasEqualsOff ' + v] = JSON.stringify(today) === JSON.stringify(noHas.ingLayout);
    await g2.close();
  }
  // ---- portrait: identical with G9 on and off (ingredients, methods, meter, result)
  for (const v of ['port', 'portSmall']) {
    const lay = {};
    for (const off of ['', 'G9']) { const g = await boot({ port: 8910, view: v, room: 'kitchen', off }); await g.calm(); await g.ev(TLIB);
      lay[off] = await g.ev(async () => { const o = {}; await T.reset(); UI.openCook('fridge'); await T.sleep(300); o.ing = T.layout(); T.press('#panel .grid.ing .tile'); T.press('#panel .pbtn.go'); await T.sleep(150); o.methods = T.layout();
        T.press('#panel .method[data-m=fry]'); await T.sleep(300); const m = document.querySelector('#panel .meter').getBoundingClientRect(); o.meter = [Math.round(m.top), Math.round(m.height), document.querySelector('#panel .pbody').scrollTop]; await T.reset(); return o; });
      await g.close(); }
    log('portrait ' + v + ' identical on/off', { ing: JSON.stringify(lay[''].ing) === JSON.stringify(lay.G9.ing), methods: JSON.stringify(lay[''].methods) === JSON.stringify(lay.G9.methods), meter: JSON.stringify(lay[''].meter) === JSON.stringify(lay.G9.meter), meterOn: lay[''].meter, meterOff: lay.G9.meter });
  }
  fs.writeFileSync(OUT + 'g9.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

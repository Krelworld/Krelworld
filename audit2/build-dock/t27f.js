// G27 flight, recorded in the page every frame: where the toast ends relative to 📒, whether 📒 wiggled or a ✨ marked its spot.
const L = require('./lib.js');
(async () => {
  for (const [name, off] of [['port'], ['portSmall'], ['land'], ['landSmall'], ['375x553'], ['390x664'], ['port', 'G16']]) {
    const g = await L.boot({ port: 8899, view: L.viewOf(name), room: 'kitchen', off }); await g.calm();
    await g.ev(() => { G.holding = null; marina.state = 'idle'; miles.crying = false; miles.cryT = 999; for (const e of [daddy, mommy, rory, niko]) if (e.room === G.room) e.room = 'yard';
      window.__shakes = []; const sh = Clarity.shake; Clarity.shake = function (el, o) { __shakes.push(el && el.id); return sh.apply(this, arguments); };
      window.__sparks = 0; new MutationObserver(r => { for (const x of r) for (const n of x.addedNodes) if (n.classList && n.classList.contains('cm-g27-spark')) __sparks++; }).observe(document.body, { childList: true, subtree: true }); });
    const res = {};
    for (const state of ['shown', 'off']) {
      if (state === 'shown') { await g.page.waitForFunction(() => !document.getElementById('bookBtn').classList.contains('off'), null, { timeout: 9000 }).catch(() => { }); await g.wait(900); }
      else { await g.ev(() => { G.holding = { type: 'tp' }; }); await g.wait(700); }
      const id = state === 'shown' ? 'swim' : 'deer';
      const r = await g.ev(async id => {
        __shakes.length = 0; __sparks = 0; const rec = []; let on = true; const t0 = performance.now();
        const b = document.getElementById('bookBtn'), bOff0 = b.classList.contains('off');
        const G = { swim: '🏊', deer: '🦌' }[id]; const tick = () => { if (!on) return; const t = [...document.querySelectorAll('.stk-toast')].find(n => n.textContent === G && n.isConnected && getComputedStyle(n).display !== 'none'); if (t) { const s = t.querySelector('span').getBoundingClientRect(), r = b.getBoundingClientRect(); rec.push([Math.round(performance.now() - t0), Math.round(Math.hypot(s.left + s.width / 2 - r.left - r.width / 2, s.top + s.height / 2 - r.top - r.height / 2)), Math.round(s.width), +(+getComputedStyle(t).opacity).toFixed(2), !!t.closest('.cm-g27-layer')]); } requestAnimationFrame(tick); };
        for (let i = 0; i < 100 && (Clarity.G27.flying || Clarity.G27.queue.length); i++) await new Promise(r => setTimeout(r, 100)); requestAnimationFrame(tick); award(id); await new Promise(r => setTimeout(r, 2700)); on = false;
        const vis = rec.filter(x => x[3] > 0.05); const last = vis[vis.length - 1];
        return { bookOff: bOff0, frames: rec.length, lastVisible: last, minDist: Math.min(...rec.map(x => x[1])), inLayer: rec.some(x => x[4]), shakes: __shakes.slice(), sparks: __sparks };
      }, id);
      res[state] = r;
      if (state === 'shown') { const c = await g.ev(() => { const b = document.getElementById('bookBtn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await g.page.touchscreen.tap(c[0], c[1]); await g.wait(500); res.tapBookAfter = await g.ev(() => !!document.getElementById('stkBox')); await g.ev(() => { const b = document.getElementById('stkBox'); b && b.remove(); }); await g.wait(300); }
    }
    // a screenshot near the end of a flight
    await g.ev(() => { G.holding = null; award('build'); }); await g.wait(1950); await g.shot(L.OUT + 'shots/g27_end_' + name + (off ? '_noG16' : '') + '.png');
    console.log('flight', name, off || '', JSON.stringify(res), g.errs()); await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

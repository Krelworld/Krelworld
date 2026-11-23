// G5 part 2: the map's 'here' outline pulses about its own centre; give hints stay centred on their spot while pulsing,
// and (with 1-3 alerts) sit clear of the strip and the alert row. usage: node t_g5b.js [off]
const L = require('./lib.js'); const fs = require('fs');
const OFF = process.argv[2] || ''; const tag = OFF ? '_off' : '';
(async () => {
  const res = {};
  for (const view of ['port', 'land']) {
    const g = await L.boot({ view, room: 'living', off: OFF }); await g.calm(); const P = g.page; const V = res[view] = {};
    // ---- map: centre of the .isoroom.here box over 1.5 s
    V.map = await P.evaluate(async () => {
      openIsoMap(); await new Promise(r => setTimeout(r, 600));
      const n = document.querySelector('.isoroom.here'); if (!n) return 'no .isoroom.here';
      const cs = []; const t0 = performance.now();
      await new Promise(done => { const f = () => { const r = n.getBoundingClientRect(); cs.push([(r.left + r.right) / 2, (r.top + r.bottom) / 2]); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
      const dx = Math.max(...cs.map(c => c[0])) - Math.min(...cs.map(c => c[0])), dy = Math.max(...cs.map(c => c[1])) - Math.min(...cs.map(c => c[1]));
      return { centreDrift: [+dx.toFixed(1), +dy.toFixed(1)], anim: getComputedStyle(n).animationName, origin: getComputedStyle(n).transformOrigin, box: getComputedStyle(n).transformBox };
    });
    await g.shot(L.OUT + 'g5b' + tag + '_' + view + '_map.png');
    await P.evaluate(() => { document.getElementById('panel').classList.add('hidden'); if (UI.closePanel) UI.closePanel(); });
    await P.waitForTimeout(500); await g.calm();
    // ---- give hints: holding a dish, then a picture; grown-ups at y 150/164/178 near the middle; 1-3 alerts
    V.hints = [];
    await P.evaluate(async () => { marina.stop && marina.stop(); marina.x = 150; let last = -1; for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); if (Math.abs(E.camX - last) < 0.05) break; last = E.camX; } });
    for (const kind of ['dish', 'pic']) for (const nA of [1, 3]) for (const y of [150, 164, 178]) {
      const r = await P.evaluate(async ([kind, nA, y]) => {
        G.busy = false; UI.closeActions();
        if (kind === 'dish') G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } };
        else { const c = document.createElement('canvas'); c.width = 20; c.height = 15; const x = c.getContext('2d'); x.fillStyle = '#f80'; x.fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }
        miles.room = 'bathroom'; miles.crying = nA >= 1; miles.cryT = 99; G.poop = nA >= 2; G.needTP = nA >= 3; G.bathLocked = nA >= 3;
        for (const e of [daddy, mommy]) { AI.hold(e, true); e.stop(); e.room = 'living'; e.state = 'idle'; e.hidden = false; }
        const cx = E.camX + E.viewW / 2; daddy.x = cx - 30; mommy.x = cx + 30; daddy.y = y; mommy.y = y;
        await new Promise(r => setTimeout(r, 800));
        const B = r => [r.left, r.top, r.right, r.bottom].map(v => Math.round(v));
        const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        const blk = [...document.querySelectorAll('.alertb,#roombar,#floorpill .fl:not(.off),#mapBtn')].map(n => ({ k: n.id ? '#' + n.id : '.' + n.className.split(' ')[0] + '[' + (n.getAttribute('aria-label') || '') + ']', b: B(n.getBoundingClientRect()) })).filter(x => x.b[2] - x.b[0] > 2);
        const st = document.getElementById('stage').getBoundingClientRect();
        const hs = [...document.querySelectorAll('#fx .pichint')];
        // centring while pulsing: rect centre vs the node's own left/top, sampled for 1.3 s
        let maxOff = 0; const t0 = performance.now();
        await new Promise(done => { const f = () => { for (const n of hs) { const q = n.getBoundingClientRect(); maxOff = Math.max(maxOff, Math.hypot((q.left + q.right) / 2 - st.left - parseFloat(n.style.left), (q.top + q.bottom) / 2 - st.top - parseFloat(n.style.top))); } if (performance.now() - t0 < 1300) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
        return { alerts: [...document.querySelectorAll('.alertb')].map(n => n.getAttribute('aria-label')).join(','), hints: hs.map(n => ({ t: n.textContent, lab: n.getAttribute('aria-label'), box: B(n.getBoundingClientRect()), anim: getComputedStyle(n).animationName, hits: blk.filter(x => ov(B(n.getBoundingClientRect()), x.b) > 0).map(x => x.k + ':' + ov(B(n.getBoundingClientRect()), x.b)) })), maxCentreOffPx: +maxOff.toFixed(1) };
      }, [kind, nA, y]);
      V.hints.push({ kind, nA, y, ...r });
      if (y === 150 && nA === 3) await g.shot(L.OUT + 'g5b' + tag + '_' + view + '_' + kind + '_a3_y150.png');
    }
    await P.evaluate(() => { G.holding = null; miles.crying = false; G.poop = false; G.needTP = false; G.bathLocked = false; });
    V.errors = L.real(g.errors); await g.close();
  }
  fs.writeFileSync(L.OUT + 't_g5b' + tag + '.json', JSON.stringify(res, null, 1));
  for (const [v, V] of Object.entries(res)) {
    console.log(v, 'map', JSON.stringify(V.map), 'errors', V.errors);
    for (const h of V.hints) console.log(' ', h.kind, 'alerts=' + h.alerts, 'y' + h.y, 'centreOff', h.maxCentreOffPx, h.hints.map(x => x.t + x.box.join(',') + (x.hits.length ? ' HITS ' + x.hits.join('|') : '') + ' ' + x.anim).join(' ; '));
  }
})().catch(e => { console.error(e); process.exit(1); });

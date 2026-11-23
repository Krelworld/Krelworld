// G26 sweep only (see t_g26.js part 5). usage: node t_g26_sweep.js
const L = require('./lib.js'); const fs = require('fs');
(async () => {
  const R = {};
  for (const view of ['port', 'land', 'landSmall', 'portSmall']) {
    const g = await L.boot({ view, room: 'kitchen' }); await g.calm(); const P = g.page; const V = R[view] = {};
    const settle = () => P.evaluate(async () => { let last = -1; for (let i = 0; i < 40; i++) { await new Promise(q => setTimeout(q, 100)); if (Math.abs(E.camX - last) < 0.05) break; last = E.camX; } });
    // ---- 5. never over a .say, an alert, an arrow or the pill: Daddy across the view, alerts on, Mommy talking beside him
    V.sweep = [];
    await P.evaluate(() => { if (G.room !== 'kitchen') travelTo('kitchen'); }); await P.waitForTimeout(1500); await P.evaluate(() => { marina.stop(); marina.x = 200; }); await settle();
    for (let f = 0.0; f <= 1.0001; f += 0.05) for (const talk of [false, true]) {
      const r = await P.evaluate(async ([f, talk]) => {
        G.busy = false; UI.closeActions(); G.holding = null; G.septic = true; miles.room = 'bathroom'; miles.crying = true; miles.cryT = 99; G.poop = true;
        AI.hold(daddy, true); daddy.stop(); daddy.room = G.room; daddy.state = 'idle'; daddy.hidden = false; daddy.y = 160; daddy.x = E.camX + f * E.viewW;
        AI.hold(mommy, true); mommy.stop(); mommy.room = G.room; mommy.state = 'idle'; mommy.hidden = false; mommy.y = 164; mommy.x = daddy.x + 22;
        if (talk) UI.bubble(mommy, '🍳', 3000);
        await new Promise(q => setTimeout(q, 700));
        const c = document.querySelector('.cm-call'); if (!c) return { shown: false };
        const a = c.getBoundingClientRect(), ov = (b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const hits = [...document.querySelectorAll('.say,.pichint,.alertb,.navarrow:not(.off),#floorpill .fl:not(.off),#moodbar .mood,#moodToggle,#mapBtn,#roombar .rb')].filter(n => getComputedStyle(n).display !== 'none' && ov(n.getBoundingClientRect()) > 0).map(n => (n.className + '').split(' ')[0] + (n.id ? '#' + n.id : '') + ':' + Math.round(ov(n.getBoundingClientRect())));
        const st = document.getElementById('stage').getBoundingClientRect();
        return { shown: true, hits, inStage: a.left >= st.left - 0.5 && a.right <= st.right + 0.5 };
      }, [+f.toFixed(2), talk]);
      V.sweep.push({ f: +f.toFixed(2), talk, ...r });
    }
    await P.evaluate(() => { miles.crying = false; G.poop = false; mommy.room = 'dining'; });
    V.errors = L.real(g.errors); await g.close();
    const sw = V.sweep;
    console.log(view, 'shown', sw.filter(s => s.shown).length, '/', sw.length, 'hits', sw.filter(s => s.hits && s.hits.length).map(s => s.f + (s.talk ? 't' : '') + ':' + s.hits.join('|')).join(' ; '), 'out of stage', sw.filter(s => s.shown && !s.inStage).length, 'errors', V.errors);
  }
  fs.writeFileSync(L.OUT + 't_g26_sweep.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

// G17 placement: give bubbles vs arrows / pill / mood column / 😊 across the view; Mommy at the left edge with Daddy beside her;
// taps on heads and chests still open rings; Marina's head in landscape. usage: node t_g17b.js [off]
const L = require('./lib.js'); const fs = require('fs');
const OFF = process.argv[2] || ''; const tag = OFF ? '_off' : '';
(async () => {
  const R = {};
  for (const view of ['port', 'land', 'landSmall', 'portSmall']) {
    const g = await L.boot({ view, room: 'kitchen', off: OFF }); await g.calm(); const P = g.page; const V = R[view] = {};
    const settle = () => P.evaluate(async () => { let last = -1; for (let i = 0; i < 40; i++) { await new Promise(q => setTimeout(q, 100)); if (Math.abs(E.camX - last) < 0.05) break; last = E.camX; } });
    await P.evaluate(() => { marina.stop && marina.stop(); marina.x = 240; G.rory = true; }); await settle();
    // ---- sweep: Daddy across the view (y 150 and 164), with a dish and with a picture; column open and folded in landscape
    const folds = view.startsWith('land') ? [false, true] : [false];
    V.sweep = [];
    for (const fold of folds) for (const kind of ['dish', 'pic']) for (const y of [150, 164, 178]) for (let f = 0.0; f <= 1.0001; f += 0.05) {
      const r = await P.evaluate(async ([fold, kind, y, f]) => {
        document.getElementById('moodbar').classList.toggle('collapsed', fold);
        G.busy = false; UI.closeActions(); miles.crying = false; G.poop = false;
        if (kind === 'dish') G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } };
        else if (!G.holding || G.holding.type !== 'pic') { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }
        for (const e of [mommy, rory]) { e.room = 'dining'; }
        AI.hold(daddy, true); daddy.stop(); daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.y = y; daddy.x = E.camX + f * E.viewW;
        await new Promise(q => setTimeout(q, 300));
        const st = document.getElementById('stage').getBoundingClientRect();
        const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        const ctl = [...document.querySelectorAll('.navarrow:not(.off),#floorpill .fl:not(.off),#moodbar .mood,#moodToggle,#mapBtn,#weatherBtn:not(.hidden),.alertb,#roombar .rb,#stopBtn:not(.hidden),.facecard.show,#dressBtn:not(.off),#bookBtn:not(.off),#wishBtn,#reqBtn')]
          .map(n => { const q = n.getBoundingClientRect(); return { k: n.id || (n.className + '').split(' ').slice(0, 2).join('.') + (n.getAttribute('aria-label') ? '[' + n.getAttribute('aria-label') + ']' : ''), b: [q.left - st.left, q.top - st.top, q.right - st.left, q.bottom - st.top], cs: getComputedStyle(n) }; })
          .filter(x => x.b[2] - x.b[0] > 2 && x.cs.display !== 'none' && x.cs.visibility !== 'hidden' && +x.cs.opacity > 0.05);
        const hs = [...document.querySelectorAll('#fx .pichint')].map(n => { const l = parseFloat(n.style.left), t = parseFloat(n.style.top), w = n.offsetWidth, h = n.offsetHeight; return { ico: n.textContent, box: [l - w / 2, t - h / 2, l + w / 2, t + h / 2] }; });
        const gift = hs.find(h => h.ico !== '🖼️');
        const today = toScreen(daddy.x, daddy.y - 104);
        return { hints: hs.length, dx: gift ? Math.round((gift.box[0] + gift.box[2]) / 2 - today[0]) : null, hits: hs.map(h => ctl.filter(c => ov(h.box, c.b) > 0).map(c => h.ico + 'x' + c.k + ':' + Math.round(ov(h.box, c.b)))).flat(), inStage: hs.every(h => h.box[0] >= -0.5 && h.box[2] <= st.width + 0.5) };
      }, [fold, kind, y, f]);
      V.sweep.push({ fold, kind, y, f: +f.toFixed(2), ...r });
    }
    await P.evaluate(() => document.getElementById('moodbar').classList.remove('collapsed'));
    // ---- Mommy at the left edge, Daddy 40-60 px to her right: dish, then picture; each bubble nearest its own person, no overlap; taps serve / gift the right one
    V.pair = [];
    for (const gapW of [40, 50, 60]) for (const kind of ['dish', 'pic']) {
      const r = await P.evaluate(async ([gapW, kind]) => {
        G.busy = false; UI.closeActions();
        if (kind === 'dish') G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } };
        else { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }
        for (const e of [daddy, mommy]) { AI.hold(e, true); e.stop(); e.room = G.room; e.hidden = false; e.state = 'idle'; e.y = 164; }
        mommy.x = Math.max(E.camX, 0) + 6; daddy.x = mommy.x + gapW; marina.x = Math.min(ROOMS[G.room].w - 30, daddy.x + 110);
        await new Promise(q => setTimeout(q, 500));
        const st = document.getElementById('stage').getBoundingClientRect();
        const hs = [...document.querySelectorAll('#fx .pichint.gift')].map(n => { const r = n.getBoundingClientRect(), l = parseFloat(n.style.left), t = parseFloat(n.style.top), w = n.offsetWidth, h = n.offsetHeight; return { box: [l - w / 2, t - h / 2, l + w / 2, t + h / 2], c: [r.left + r.width / 2, r.top + r.height / 2] }; });
        const ms = toScreen(mommy.x, 0)[0], ds = toScreen(daddy.x, 0)[0];
        const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        const near = hs.map(h => { const cx = (h.box[0] + h.box[2]) / 2; return Math.abs(cx - ms) < Math.abs(cx - ds) ? 'mommy' : 'daddy'; });
        return { n: hs.length, near: near.join(','), overlap: hs.length === 2 ? Math.round(ov(hs[0].box, hs[1].box)) : null, centres: hs.map(h => h.c.map(Math.round)), people: [ms, ds].map(Math.round) };
      }, [gapW, kind]);
      // tap each bubble: who gets it?
      const who = [];
      for (let i = 0; i < 2; i++) {
        const c = r.centres[i]; if (!c) break;
        await P.evaluate(([gapW, kind]) => { G.busy = false; G.sceneOn = false; UI.closeActions(); daddy.plate = null; mommy.face = null; window.__v = []; if (!window.__vw) { window.__vw = 1; const _v = Audio2.voice; Audio2.voice = function (k) { (window.__v = window.__v || []).push(k); return _v.apply(this, arguments); }; }
          if (kind === 'dish') G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } }; else { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }
          for (const e of [daddy, mommy]) { AI.hold(e, true); e.stop(); e.room = G.room; e.state = 'idle'; e.y = 164; } mommy.x = Math.max(E.camX, 0) + 6; daddy.x = mommy.x + gapW; marina.stop(); marina.x = Math.min(ROOMS[G.room].w - 30, daddy.x + 110); }, [gapW, kind]);
        await P.waitForTimeout(500);
        const cc = await P.evaluate(i => { const hs = [...document.querySelectorAll('#fx .pichint.gift')]; const n = hs[i]; if (!n) return null; const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, i);
        await P.touchscreen.tap(cc[0], cc[1]); await P.waitForTimeout(3500);
        who.push(await P.evaluate(() => { const v = (window.__v || []).filter(k => /^(d|mo)_/.test(k)); return v[0] ? (v[0].startsWith('mo_') ? 'mommy' : 'daddy') : 'none:' + (window.__v || []).join(' '); }));
        await P.evaluate(async () => { for (let i = 0; i < 60; i++) { await new Promise(q => setTimeout(q, 250)); if (!G.busy && !G.sceneOn) break; } G.holding = null; });
      }
      V.pair.push({ gapW, kind, ...r, tappedGoesTo: who.join(',') });
    }
    await P.evaluate(() => { G.holding = null; });
    await settle();
    // ---- taps on each grown-up's head and chest while carrying: their ring opens (🍽️ / 📞 … first as today); no bubble over the head
    V.heads = [];
    for (const who of ['daddy', 'mommy', 'rory']) for (const part of ['head', 'chest']) {
      await P.evaluate(w => { G.busy = false; G.sceneOn = false; UI.closeActions(); G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } };
        const e = { daddy, mommy, rory }[w]; for (const o of [daddy, mommy, rory]) { AI.hold(o, true); o.stop(); o.room = o === e ? G.room : 'dining'; o.state = 'idle'; o.hidden = false; }
        e.x = E.camX + E.viewW * 0.55; e.y = 164; marina.stop(); marina.x = E.camX + E.viewW * 0.3; }, who);
      await P.waitForTimeout(500);
      const pt = await P.evaluate(([w, part]) => { const e = { daddy, mommy, rory }[w], vb = visBox(w), st = document.getElementById('stage').getBoundingClientRect(); const wy = part === 'head' ? e.y + vb[1] + 8 : e.y + vb[1] + 40; const s = toScreen(e.x, wy); const x = st.left + s[0], y = st.top + s[1]; const el = document.elementFromPoint(x, y); return { x, y, top: el && (el.id || el.className) }; }, [who, part]);
      await P.touchscreen.tap(pt.x, pt.y); await P.waitForTimeout(1800);
      const ring = await P.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent).join(''));
      V.heads.push({ who, part, topAtPoint: pt.top, ring });
      await P.evaluate(() => { UI.closeActions(); G.holding = null; });
    }
    // ---- landscape: a tap on Marina's head while carrying a picture opens her own ring
    if (view.startsWith('land')) {
      await P.evaluate(() => { G.busy = false; UI.closeActions(); const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; for (const o of [daddy, mommy, rory]) o.room = 'dining'; marina.stop(); marina.x = E.camX + E.viewW * 0.5; });
      await P.waitForTimeout(600);
      const pt = await P.evaluate(() => { const vb = visBox(mBase()), st = document.getElementById('stage').getBoundingClientRect(); const s = toScreen(marina.x, marina.y + vb[1] * marina.scale + 8); const el = document.elementFromPoint(st.left + s[0], st.top + s[1]); return { x: st.left + s[0], y: st.top + s[1], top: el && (el.id || el.className) }; });
      await g.shot(L.OUT + 'g17b' + tag + '_' + view + '_marinahead.png');
      await P.touchscreen.tap(pt.x, pt.y); await P.waitForTimeout(1500);
      V.marinaHead = { topAtPoint: pt.top, ring: await P.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent).join('')) };
      await P.evaluate(() => { UI.closeActions(); G.holding = null; });
    }
    V.errors = L.real(g.errors); await g.close();
  }
  fs.writeFileSync(L.OUT + 't_g17b' + tag + '.json', JSON.stringify(R, null, 1));
  for (const [v, V] of Object.entries(R)) {
    const hits = V.sweep.filter(s => s.hits.length);
    console.log(v, 'sweep cases', V.sweep.length, 'with hits', hits.length, 'out of stage', V.sweep.filter(s => !s.inStage).length);
    for (const s of hits) console.log('   ', s.fold ? 'folded' : 'open', s.kind, 'y' + s.y, 'f' + s.f, 'dx' + s.dx, s.hits.join(' '));
    for (const p of V.pair) console.log('  pair gap', p.gapW, p.kind, 'n', p.n, 'near', p.near, 'overlap', p.overlap, 'taps->', p.tappedGoesTo);
    for (const h of V.heads) console.log('  tap', h.who, h.part, 'top=' + h.topAtPoint, 'ring=' + h.ring);
    if (V.marinaHead) console.log('  marina head', JSON.stringify(V.marinaHead));
    console.log('  errors', V.errors);
  }
})().catch(e => { console.error(e); process.exit(1); });

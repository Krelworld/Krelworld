// G17 placement, second pass: (1) sweep split into the clear zone (heads not under a side control) and the edge band, with the
// shift that would have been needed; (2) Mommy at the left edge + Daddy 40-60 to her right: attribution by wrapping serve /
// serveMommy / Pics.gift; (3) head/chest taps with long waits; (4) backyard: Jeff vs the left arrow and the deer/turkey tabs.
// usage: node t_g17c.js [off] [views comma list]
const L = require('./lib.js'); const fs = require('fs');
const OFF = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : ''; const tag = OFF ? '_off' : '';
const VIEWS = (process.argv[3] || 'port,land,landSmall,portSmall').split(',');
const SECT = (process.argv[4] || 'sweep,pair,heads,yard').split(',');
(async () => {
  const R = {};
  for (const view of VIEWS) {
    const g = await L.boot({ view, room: 'kitchen', off: OFF }); await g.calm(); const P = g.page; const V = R[view] = {};
    await P.evaluate(() => { window.__who = []; const _s = serve; serve = function (e) { __who.push('serve:' + e.id); return _s.apply(this, arguments); }; const _m = serveMommy; serveMommy = function () { __who.push('serve:mommy'); return _m.apply(this, arguments); };
      const _g = Pics.gift; Pics.gift = function (u, e) { __who.push('gift:' + e.id); return _g.apply(this, arguments); }; });
    const settle = () => P.evaluate(async () => { let last = -1; for (let i = 0; i < 50; i++) { await new Promise(q => setTimeout(q, 100)); if (Math.abs(E.camX - last) < 0.05) break; last = E.camX; } });
    const idle = () => P.evaluate(async () => { for (let i = 0; i < 80; i++) { await new Promise(q => setTimeout(q, 250)); if (!G.busy && !G.sceneOn && !marina.moving) break; } });
    await P.evaluate(() => { marina.stop && marina.stop(); marina.x = 240; G.rory = true; }); await settle();
    // ---------- (1) sweep
    const folds = view.startsWith('land') ? [false, true] : [false]; V.sweep = [];
    if (SECT.includes('sweep')) for (const fold of folds) for (const kind of ['dish', 'pic']) for (const y of [150, 164, 178]) for (let f = 0; f <= 1.0001; f += 0.05) {
      V.sweep.push(await P.evaluate(async ([fold, kind, y, f]) => {
        document.getElementById('moodbar').classList.toggle('collapsed', fold);
        G.busy = false; UI.closeActions(); miles.crying = false; G.poop = false;
        if (kind === 'dish') G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } };
        else if (!G.holding || G.holding.type !== 'pic') { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }
        for (const e of [mommy, rory]) e.room = 'dining';
        const RW = ROOMS[G.room].w, x = Math.max(8, Math.min(RW - 8, E.camX + f * E.viewW));     // people stay inside the room
        AI.hold(daddy, true); daddy.stop(); daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.y = y; daddy.x = x;
        await new Promise(q => setTimeout(q, 300));
        const st = document.getElementById('stage').getBoundingClientRect(), cs = E.cssScale || 1, land = E.cv.width > E.cv.height;
        const zone = [E.camX + 62 / cs + 8, E.camX + E.viewW - (land ? 82 : 78) / cs - 8], inZone = x >= zone[0] && x <= zone[1];   // wildlife's clearZone: no side control over the head
        const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        const ctl = [...document.querySelectorAll('.navarrow:not(.off),#floorpill .fl:not(.off),#moodbar .mood,#moodToggle')].map(n => { const q = n.getBoundingClientRect(), c = getComputedStyle(n); return { k: (n.id || (n.className + '').split(' ').slice(0, 2).join('.')), b: [q.left - st.left, q.top - st.top, q.right - st.left, q.bottom - st.top], ok: q.width > 2 && c.display !== 'none' && +c.opacity > 0.05 }; }).filter(c => c.ok);
        const n = [...document.querySelectorAll('#fx .pichint.gift')][0]; if (!n) return { fold, kind, y, f: +f.toFixed(2), none: true };
        const l = parseFloat(n.style.left), t = parseFloat(n.style.top), w = n.offsetWidth, h = n.offsetHeight, box = [l - w / 2, t - h / 2, l + w / 2, t + h / 2];
        const today = toScreen(daddy.x, daddy.y - 104)[0], tbox = [today - w / 2, box[1], today + w / 2, box[3]];
        const hits = ctl.filter(c => ov(box, c.b) > 0).map(c => c.k + ':' + Math.round(ov(box, c.b)));
        const need = hits.length ? Clarity.nudgeX(tbox, Clarity.hudRects(null, { except: ['give', 'call'] }), { bounds: [0, st.width] }) : null;   // the shift needed with no cap
        return { fold, kind, y, f: +f.toFixed(2), x: Math.round(x), inZone, dx: Math.round(l - today), hits, needed: need == null ? null : Math.round(need), w };
      }, [fold, kind, y, f]));
    }
    await P.evaluate(() => { document.getElementById('moodbar').classList.remove('collapsed'); G.holding = null; });
    // ---------- (2) Mommy at the left edge, Daddy 40-60 to her right
    V.pair = [];
    if (SECT.includes('pair')) { await P.evaluate(() => { G.holding = null; marina.stop(); marina.x = 330; for (const e of [daddy, mommy]) { AI.hold(e, true); e.stop(); } }); await settle(); }
    if (SECT.includes('pair')) for (const gapW of [40, 50, 60]) for (const kind of ['dish', 'pic']) for (let i = 0; i < 2; i++) {
      const prep = ([gapW, kind]) => { G.busy = false; G.sceneOn = false; UI.closeActions(); daddy.plate = null; __who.length = 0;
        if (kind === 'dish') G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } }; else { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }
        for (const e of [daddy, mommy]) { AI.hold(e, true); e.stop(); e.room = G.room; e.hidden = false; e.state = 'idle'; e.y = 164; } rory.room = 'dining';
        mommy.x = Math.max(E.camX + 62 / (E.cssScale || 1) + 8, 10); daddy.x = mommy.x + gapW; marina.stop(); };
      await P.evaluate(prep, [gapW, kind]); await P.waitForTimeout(700);
      const info = await P.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const ms = toScreen(mommy.x, 0)[0], ds = toScreen(daddy.x, 0)[0];
        const hs = [...document.querySelectorAll('#fx .pichint.gift')].map(n => { const l = parseFloat(n.style.left), t = parseFloat(n.style.top), w = n.offsetWidth, h = n.offsetHeight; return { box: [l - w / 2, t - h / 2, l + w / 2, t + h / 2], c: [st.left + l, st.top + t] }; });
        const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        return { hs, people: { mommy: Math.round(ms), daddy: Math.round(ds) }, overlap: hs.length === 2 ? Math.round(ov(hs[0].box, hs[1].box)) : null, nearest: hs.map(h => { const cx = (h.box[0] + h.box[2]) / 2; return Math.abs(cx - ms) < Math.abs(cx - ds) ? 'mommy' : 'daddy'; }) }; });
      const target = info.nearest[i], c = info.hs[i] && info.hs[i].c;
      if (c) { await P.touchscreen.tap(c[0], c[1]); await P.waitForTimeout(1500); await idle(); }
      V.pair.push({ gapW, kind, tapped: i, nearestTo: target, got: await P.evaluate(() => __who.join(',')), overlap: info.overlap, centres: info.hs.map(h => Math.round((h.box[0] + h.box[2]) / 2)), people: info.people });
      await P.evaluate(() => { G.holding = null; }); await idle(); await P.evaluate(() => { marina.stop(); marina.x = 330; }); await settle();
    }
    // ---------- (3) head / chest taps while carrying a dish
    V.heads = [];
    if (SECT.includes('heads')) for (const who of ['daddy', 'mommy', 'rory']) for (const part of ['head', 'chest']) {
      const prep = w => { G.busy = false; G.sceneOn = false; UI.closeActions(); G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } }; __who.length = 0;
        const e = { daddy, mommy, rory }[w]; for (const o of [daddy, mommy, rory]) { AI.hold(o, true); o.stop(); o.room = o === e ? G.room : 'dining'; o.state = 'idle'; o.hidden = false; o.y = 164; }
        e.x = E.camX + E.viewW * 0.55; marina.stop(); marina.x = E.camX + E.viewW * 0.3; };
      await P.evaluate(prep, who); await settle(); await P.evaluate(prep, who); await P.waitForTimeout(600);
      const pt = await P.evaluate(([w, part]) => { const e = { daddy, mommy, rory }[w], vb = visBox(w), st = document.getElementById('stage').getBoundingClientRect(), oy = w === 'mommy' ? 2 : 0;
        const wy = part === 'head' ? e.y + oy + vb[1] + 8 : e.y + oy + vb[1] + 40, s = toScreen(e.x, wy), el = document.elementFromPoint(st.left + s[0], st.top + s[1]); return { x: st.left + s[0], y: st.top + s[1], top: el && (el.id || el.className) }; }, [who, part]);
      await P.touchscreen.tap(pt.x, pt.y); await P.waitForTimeout(2500);
      V.heads.push({ who, part, topAtPoint: pt.top, ring: await P.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent).join('')), served: await P.evaluate(() => __who.join(',')) });
      await P.evaluate(() => { UI.closeActions(); G.holding = null; }); await idle();
    }
    // ---------- (4) backyard: Jeff's bubble vs the left arrow and the deer / turkey tabs
    if (SECT.includes('yard') && (view === 'port' || view === 'land' || view === 'landSmall')) {
      await P.evaluate(() => { G.holding = null; travelTo('backyard'); }); await P.waitForTimeout(2000); await P.evaluate(() => { marina.stop(); marina.x = 520; }); await settle();
      V.yard = [];
      for (const wild of ['deer', 'turkeys']) {
        await P.evaluate(async w => { try { Wildlife.calm(); } catch (e) { } await new Promise(q => setTimeout(q, 3500)); if (w === 'deer') Wildlife.visit('graze'); else Wildlife.turkeys(); await new Promise(q => setTimeout(q, 3000)); }, wild);
        for (let f = 0; f <= 1.0001; f += 0.05) for (const kind of ['dish', 'pic']) {
          V.yard.push(await P.evaluate(async ([wild, f, kind]) => {
            G.busy = false; UI.closeActions();
            if (kind === 'dish') G.holding = { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } }; else if (!G.holding || G.holding.type !== 'pic') { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }
            AI.hold(jeff, true); jeff.stop(); jeff.room = 'backyard'; jeff.hidden = false; jeff.state = 'idle'; jeff.y = 164; jeff.x = Math.max(8, Math.min(ROOMS.backyard.w - 8, E.camX + f * E.viewW));
            await new Promise(q => setTimeout(q, 300));
            const st = document.getElementById('stage').getBoundingClientRect(), cs = E.cssScale || 1, land = E.cv.width > E.cv.height;
            const zone = [E.camX + 62 / cs + 8, E.camX + E.viewW - (land ? 82 : 78) / cs - 8], inZone = jeff.x >= zone[0] && jeff.x <= zone[1];
            const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
            const sb = (x, y) => { const a = toScreen(x - 9, y - 10), b = toScreen(x + 9, y + 10); return [a[0], a[1], b[0], b[1]]; };
            const tabs = [];
            if (Wildlife.active()) { tabs.push(['deerL', sb(Math.max(E.camX, 0) + 14, 86)], ['deerR', sb(Math.min(E.camX + E.viewW, ROOMS.backyard.w) - 14, 86)]); }
            const ts = Wildlife.turkeysActive() ? Wildlife.turkeyState : null; if (ts && ts.tab) tabs.push(['turkeyTab', sb(ts.tab.x, ts.tab.y)]);
            for (const n of document.querySelectorAll('.navarrow:not(.off),#floorpill .fl:not(.off)')) { const q = n.getBoundingClientRect(); tabs.push([(n.className + '').split(' ').slice(0, 2).join('.'), [q.left - st.left, q.top - st.top, q.right - st.left, q.bottom - st.top]]); }
            const n = [...document.querySelectorAll('#fx .pichint.gift')][0]; if (!n) return { wild, f: +f.toFixed(2), kind, none: true };
            const l = parseFloat(n.style.left), t = parseFloat(n.style.top), w = n.offsetWidth, h = n.offsetHeight, box = [l - w / 2, t - h / 2, l + w / 2, t + h / 2];
            return { wild, f: +f.toFixed(2), kind, inZone, active: wild === 'deer' ? Wildlife.active() : Wildlife.turkeysActive(), tabs: tabs.map(x => x[0]).join(','), hits: tabs.filter(x => ov(box, x[1]) > 0).map(x => x[0] + ':' + Math.round(ov(box, x[1]))) };
          }, [wild, +f.toFixed(2), kind]));
        }
      }
      await P.evaluate(() => { G.holding = null; try { Wildlife.calm(); } catch (e) { } });
    }
    V.errors = L.real(g.errors); await g.close();
  }
  fs.writeFileSync(L.OUT + 't_g17c' + tag + '_' + VIEWS.join('_') + '_' + SECT.join('_') + '.json', JSON.stringify(R, null, 1));
  for (const [v, V] of Object.entries(R)) {
    const zoneHits = V.sweep.filter(s => s.inZone && s.hits && s.hits.length), edgeHits = V.sweep.filter(s => !s.inZone && s.hits && s.hits.length);
    console.log(v, 'sweep', V.sweep.length, '| in clear zone:', V.sweep.filter(s => s.inZone).length, 'hits', zoneHits.length, '| edge band:', V.sweep.filter(s => !s.inZone).length, 'hits', edgeHits.length, 'needed shifts', [...new Set(edgeHits.map(s => s.needed))].join(','));
    for (const s of zoneHits) console.log('   ZONE HIT', JSON.stringify(s));
    for (const p of V.pair) console.log('  pair', p.gapW, p.kind, 'tap#' + p.tapped, 'nearest=' + p.nearestTo, 'got=' + p.got, 'overlap', p.overlap, 'centres', p.centres.join('/'), 'people', JSON.stringify(p.people));
    for (const h of V.heads) console.log('  tap', h.who, h.part, 'top=' + h.topAtPoint, 'ring=' + h.ring, 'served=' + h.served);
    if (V.yard) { const yh = V.yard.filter(s => s.hits && s.hits.length); console.log('  yard', V.yard.length, 'active', V.yard.filter(s => s.active).length, 'hits', yh.length); for (const s of yh) console.log('   ', JSON.stringify(s)); }
    console.log('  errors', V.errors);
  }
})().catch(e => { console.error(e); process.exit(1); });

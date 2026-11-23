// G36 checks: icons with the switch on / off / flipped at run time; the 22 px badge; tree houses; Nunu's tile with G37.
const { boot, OUT, TH, VIEWS } = require('./lib.js'); const fs = require('fs');
const icons = g => g.ev(() => ({
  room: G.room, strip: [...document.querySelectorAll('#roombar .rb')].map(b => b.dataset.r + ':' + b.textContent).join(' '),
  arrowL: (document.querySelector('.navarrow.l') || {}).dataset ? document.querySelector('.navarrow.l').dataset.to + ':' + document.querySelector('.navarrow.l b').textContent : '',
  rooms: ROOMS.nunuroom.ico + ROOMS.treehouse_pine.ico + ROOMS.treehouse_oak.ico }));
const mapTiles = async g => { await g.ev(() => openIsoMap()); await g.wait(500); const t = await g.ev(() => ({ tiles: [...document.querySelectorAll('.fmaproom')].map(b => b.getAttribute('aria-label') + ':' + b.querySelector('b').textContent).join(' '), labs: [...document.querySelectorAll('.fmaplab')].map(n => n.textContent).join('') })); await g.ev(() => document.querySelector('#panel .ptop button').click()); await g.wait(300); return t; };
const arrive = async (g, fn) => { await g.ev(() => { window.__big = []; const fx = document.getElementById('fx'); if (!window.__mo) { window.__mo = new MutationObserver(r => { for (const m of r) for (const n of m.addedNodes) if (n.style && n.style.fontSize === '90px') __big.push(n.textContent); }); __mo.observe(fx, { childList: true }); } }); await fn(); await g.wait(400); for (let i = 0; i < 30 && !(await g.ev(() => __big.length)); i++) await g.wait(200); return g.ev(() => __big.join(' ')); };
(async () => {
  const R = {};
  for (const mode of ['on', 'off']) {
    const g = await boot({ view: 'port', room: 'kitchen', off: mode === 'off' ? 'G36' : '', storage: { cm_builds: TH } }); await g.calm();
    const r = R[mode] = {};
    await g.go('den', 1500); r.den = await icons(g); r.denMap = await mapTiles(g);
    r.arriveNunu = await arrive(g, () => g.tap('#roombar .rb[data-r=nunuroom]')); await g.wait(1500);
    await g.go('backyard', 1500); r.backyard = await icons(g); r.byMap = await mapTiles(g);
    // into the pine tree house by its ladder, out by the hatch
    r.arrivePine = await arrive(g, () => g.ev(() => { const p = PROPS.backyard.find(q => q.bl === 2 && q.b.spot === 'pine'); propActions(p).find(q => q.ico === '🪜').fn(); }));
    await g.wait(2500); r.inPine = await g.ev(() => G.room + '@' + Math.round(marina.x)); r.pineStrip = await icons(g);
    r.outPine = await arrive(g, () => g.ev(() => { G.busy = false; propActions(PROPS.treehouse_pine.find(q => q.id === 'th_hatch')).find(q => q.ico === '🪜').fn(); })); await g.wait(3500); r.afterPine = await g.ev(() => G.room + '@' + Math.round(marina.x));
    r.arriveOak = await arrive(g, () => g.ev(() => { G.busy = false; const p = PROPS.backyard.find(q => q.bl === 2 && q.b.spot === 'oak'); propActions(p).find(q => q.ico === '🪜').fn(); }));
    await g.wait(2500); r.inOak = await g.ev(() => G.room + '@' + Math.round(marina.x));
    r.outOak = await arrive(g, () => g.ev(() => { G.busy = false; propActions(PROPS.treehouse_oak.find(q => q.id === 'th_hatch')).find(q => q.ico === '🪜').fn(); })); await g.wait(3500); r.afterOak = await g.ev(() => G.room + '@' + Math.round(marina.x));
    if (mode === 'on') {
      // flipped at run time (in the den: strip + arrow cached by floors.js / nav.js)
      await g.go('den', 1500); await g.ev(() => Clarity.set('G36', false)); await g.wait(400); r.flipOff = await icons(g);
      await g.ev(() => Clarity.set('G36', true)); await g.wait(400); r.flipOn = await icons(g);
      // Nunu's room tile with G37: room badge 👵 top-left, Nunu herself only in the small people row
      await g.ev(() => { nunu.room = 'nunuroom'; nunu.hidden = false; nunu.x = 160; }); await g.ev(() => openIsoMap()); await g.wait(600);
      r.nunuTile = await g.ev(() => { const b = document.querySelector('.fmaproom[aria-label=nunuroom]'), bd = b.querySelector('b'), pp = b.querySelector('.cm-g37-ppl'); const rb = bd.getBoundingClientRect(), rp = pp && pp.getBoundingClientRect(), rt = b.getBoundingClientRect();
        return { badge: bd.textContent, badgeFont: getComputedStyle(bd).fontSize, people: pp && pp.textContent, peopleFont: pp && getComputedStyle(pp).fontSize, peopleAtBottom: pp && Math.round(rt.bottom - rp.bottom), badges: b.querySelectorAll('b').length }; });
      const tb = await g.page.locator('.fmaproom[aria-label=nunuroom]').boundingBox(); await g.shot(OUT + 'shots/g36_nunutile.png', { x: tb.x - 20, y: tb.y - 20, width: tb.width + 120, height: tb.height + 40 });
      await g.ev(() => document.querySelector('#panel .ptop button').click());
    }
    r.errors = g.realErrors(); await g.close();
  }
  // the pill: 22 px badge vs the other button, its own glyph and the map button, in all four views (with G38's ring on)
  R.pill = {};
  for (const view of VIEWS) {
    const g = await boot({ view, room: 'kitchen' }); await g.calm(); await g.wait(600);
    R.pill[view] = {};
    for (const room of ['kitchen', 'den', 'uphall']) {
      await g.go(room, 1500); await g.wait(400);
      R.pill[view][room] = await g.ev(() => {
        const rr = n => { const b = n.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(v => Math.round(v * 10) / 10); };
        const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        const out = { map: rr(document.getElementById('mapBtn')) };
        for (const b of document.querySelectorAll('#floorpill .fl:not(.off)')) {
          const k = b.classList.contains('up') ? 'up' : 'down', i = b.querySelector('i'), gl = b.querySelector('b'), bb = rr(b), ib = rr(i), gb = rr(gl);
          const c = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], hit = document.elementFromPoint(c[0], c[1]);
          out[k] = { box: bb, badge: ib, glyph: gb, font: getComputedStyle(i).fontSize, centreHitsSelf: !!hit && (hit === b || b.contains(hit)), badgeOverGlyph: Math.round(ov(ib, gb)), badgeOverMap: Math.round(ov(ib, out.map)), dest: b.dataset.dest || '', shadow: getComputedStyle(b).boxShadow };
        }
        for (const k of ['up', 'down']) { const o = out[k], other = out[k === 'up' ? 'down' : 'up']; if (o && other) o.badgeOverOtherButton = Math.round(ov(o.badge, other.box)); }
        return out;
      });
      const pb = await g.page.locator('#floorpill').boundingBox(); if (pb) await g.shot(OUT + `shots/g36_pill_${view}_${room}.png`, { x: Math.max(0, pb.x - 12), y: Math.max(0, pb.y - 80), width: pb.width + 60, height: pb.height + 100 });
    }
    R.pill[view].errors = g.realErrors(); await g.close();
  }
  fs.writeFileSync(OUT + 'g36_check.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

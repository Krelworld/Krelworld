// G37 checks (both lenses' EXTRA CHECKS). Compares the build with G37 on against CLARITY_OFF=G37 where a check says 'as before'.
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
const R = {};
const vkey = v => typeof v === 'string' ? v : v.width + 'x' + v.height;
const people4 = g => g.ev(() => { for (const e of [daddy, mommy, niko]) { e.room = 'kitchen'; e.hidden = false; e.x = marina.x + 30; } if (mommy.state === 'sit') mommy.state = 'idle'; });
const openMap = async g => { await g.ev(() => openIsoMap()); await g.wait(700); await g.ev(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } }); };
const closeMap = async g => { await g.ev(() => { const b = document.querySelector('#panel .ptop button'); if (b && !document.getElementById('panel').classList.contains('hidden')) b.click(); }); await g.wait(300); };
// (a) grid test: which polygon (or other element) is on top at every 3 px of the map painting
const grid = g => g.ev(() => {
  const s = document.querySelector('.isosvg').getBoundingClientRect(), polys = [...document.querySelectorAll('.isoroom')], out = [];
  for (let y = s.top + 1; y < s.bottom; y += 3) for (let x = s.left + 1; x < s.right; x += 3) { const n = document.elementFromPoint(x, y); const i = polys.indexOf(n); out.push(i >= 0 ? i : n ? (n.tagName === 'svg' ? 's' : n.tagName[0]) : '-'); }
  return out.join('');
});
(async () => {
  // ---------------- (a) grid test and (c) taps on the face / labels / people rows, port land portSmall
  R.grid = {}; R.taps = {};
  for (const view of ['port', 'land', 'portSmall']) {
    const res = {};
    for (const mode of ['on', 'off']) {
      const g = await boot({ view, room: 'kitchen', off: mode === 'off' ? 'G37' : '', storage: { cm_builds: TH } }); await g.calm(); await people4(g);
      await openMap(g); res[mode + ':kitchen'] = await grid(g);
      // tap points: every label centre (and the face, which sits on the 👧 of the kitchen label) and every tile's people row
      const pts = await g.ev(() => { const o = []; for (const t of document.querySelectorAll('.isosvg text')) { const r = t.getBoundingClientRect(); o.push(['label' + o.length, r.left + r.width / 2, r.top + r.height / 2]); }
        const k = [...document.querySelectorAll('.isosvg text')].find(t => /👧/.test(t.textContent)); if (k) { const r = k.getExtentOfChar ? null : null; const e = k.getBoundingClientRect(); o.push(['meGlyph', e.left + 8, e.top + e.height / 2]); }
        for (const b of document.querySelectorAll('.fmaproom')) { if (!['den', 'backyard', 'nunuroom', 'storage'].includes(b.getAttribute('aria-label'))) continue; const r = b.getBoundingClientRect(); o.push(['tileBottom:' + b.getAttribute('aria-label'), r.left + 10, r.bottom - 8]); o.push(['tileTopRight:' + b.getAttribute('aria-label'), r.right - 10, r.top + 10]); }
        return o; });
      await closeMap(g); await g.go('den', 1500); await g.ev(() => { nunu.room = 'den'; nunu.hidden = false; }); await openMap(g); res[mode + ':den'] = await grid(g); await closeMap(g);
      // tap each point with a real touch on a freshly opened map (from the kitchen), record where she ends up
      const taps = {};
      for (const [name, x, y] of pts) {
        await g.go('kitchen', 1300); await people4(g); await g.ev(() => openIsoMap()); await g.wait(500);
        const top = await g.ev(([x, y]) => { const n = document.elementFromPoint(x, y); return n ? (n.classList && n.classList.contains('isoroom') ? 'poly' : n.tagName + '.' + (n.getAttribute('class') || '') + '[' + (n.getAttribute('aria-label') || '') + ']') : '-'; }, [x, y]);
        await g.page.touchscreen.tap(x, y); await g.wait(900);
        taps[name] = await g.ev(() => G.room + (document.getElementById('panel').classList.contains('hidden') ? '' : '+map')) + ' top=' + top;
        await closeMap(g);
      }
      // her face on her own tile (she is in the den): tapping it closes the map, as tapping her tile does today
      await g.go('den', 1500); await g.ev(() => { nunu.room = 'den'; nunu.hidden = false; jeff.room = 'den'; jeff.hidden = false; openIsoMap(); }); await g.wait(500);
      const fp = await g.ev(() => { const r = document.querySelector('.fmaproom[aria-label=den]').getBoundingClientRect(); return [[r.right - 12, r.top + 12], [r.left + 12, r.bottom - 7]]; });
      for (const [i, [x, y]] of fp.entries()) { if (i) { await g.ev(() => openIsoMap()); await g.wait(500); } const top = await g.ev(([x, y]) => { const n = document.elementFromPoint(x, y); return n.tagName + '.' + (n.getAttribute('class') || ''); }, [x, y]); await g.page.touchscreen.tap(x, y); await g.wait(900); taps['denTile' + (i ? 'People' : 'Face')] = await g.ev(() => G.room + (document.getElementById('panel').classList.contains('hidden') ? '' : '+map')) + ' top=' + top; await closeMap(g); }
      R.taps[vkey(view) + ':' + mode] = taps;
      res[mode + ':errors'] = g.realErrors(); await g.close();
    }
    R.grid[vkey(view)] = { kitchenSame: res['on:kitchen'] === res['off:kitchen'], denSame: res['on:den'] === res['off:den'], n: res['on:kitchen'].length, errors: [res['on:errors'], res['off:errors']] };
    if (!R.grid[vkey(view)].kitchenSame) { let d = 0; for (let i = 0; i < res['on:kitchen'].length; i++) if (res['on:kitchen'][i] !== res['off:kitchen'][i]) d++; R.grid[vkey(view)].kitchenDiffPts = d; }
  }
  // ---------------- (d, e, i) portrait: ❌ clear, house size, no scrolling, every tile centre is its own tile; (f) rotate with the map open
  R.port = {};
  for (const view of ['port', 'portSmall', { width: 390, height: 664 }, { width: 390, height: 585 }, { width: 375, height: 553 }]) {
    const out = {};
    for (const mode of ['on', 'off']) {
      const g = await boot({ view, room: 'kitchen', off: mode === 'off' ? 'G37' : '', storage: { cm_builds: TH } }); await g.calm();
      await g.go('uphall', 1500); await openMap(g);
      out[mode] = await g.ev(() => {
        const x = document.querySelector('#panel .ptop button').getBoundingClientRect(), xr = [x.left, x.top, x.right, x.bottom];
        const hitX = (px, py) => { const n = document.elementFromPoint(px, py); return !!n && !!n.closest('.ptop button'); };
        const img = document.querySelector('.isowrap img').getBoundingClientRect(), p = document.getElementById('panel');
        const tiles = [...document.querySelectorAll('.fmaproom')].map(b => { const r = b.getBoundingClientRect(), n = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const dx = Math.max(0, xr[0] - r.right, r.left - xr[2]), dy = Math.max(0, xr[1] - r.bottom, r.top - xr[3]); return { r: b.getAttribute('aria-label'), own: !!n && (n === b || b.contains(n)), gapToX: Math.round(Math.hypot(dx, dy)), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; });
        const up = [...document.querySelectorAll('.fmaprow')].find(n => n.firstChild && n.firstChild.textContent === '⬆️').getBoundingClientRect();
        return { xCentre: hitX((xr[0] + xr[2]) / 2, (xr[1] + xr[3]) / 2), xCorner: hitX(xr[2] - 8, xr[3] - 8), house: [Math.round(img.width * 10) / 10, Math.round(img.height * 10) / 10, Math.round(img.top), Math.round(img.bottom)],
          scroll: p.scrollHeight - p.clientHeight, tilesOwn: tiles.every(t => t.own), minGapToX: Math.min(...tiles.map(t => t.gapToX)), allInView: tiles.every(t => t.inView), upRow: [Math.round(up.top), Math.round(up.bottom)], upToHouse: Math.round(img.top - up.bottom),
          upAboveHouse: up.bottom <= img.top, stack: [Math.round(Math.min(up.top, img.top) - x.bottom), Math.round(innerHeight - 8 - Math.max(...[...document.querySelectorAll('.fmaprow')].map(n => n.getBoundingClientRect().bottom)))] };
      });
      if (mode === 'on') await g.shot(OUT + `shots/g37_port_${vkey(view)}.png`);
      if (mode === 'on' && vkey(view) === 'port') {
        // rotate to landscape with the map open, then back
        await g.page.setViewportSize({ width: 844, height: 390 }); await g.wait(900);
        out.rotLand = await g.ev(() => { const img = document.querySelector('.isowrap img').getBoundingClientRect(); const tiles = [...document.querySelectorAll('.fmaproom')].map(b => { const r = b.getBoundingClientRect(), n = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: b.getAttribute('aria-label'), own: !!n && (n === b || b.contains(n)), xf: !!n && n.id === 'xFloat', inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; });
          return { house: [Math.round(img.width * 10) / 10, Math.round(img.height * 10) / 10], moved: !!document.querySelector('#panel > .fmaprow'), spacers: document.querySelectorAll('.cm-g37-sp,.cm-g37-sp2').length, tilesOwn: tiles.every(t => t.own), underX: tiles.filter(t => t.xf).map(t => t.r), allInView: tiles.every(t => t.inView), rowsOrder: [...document.querySelectorAll('.fmap .fmaprow')].map(n => n.dataset.floor).join(',') }; });
        await g.shot(OUT + 'shots/g37_rot_land.png');
        await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(900);
        out.rotBack = await g.ev(() => ({ moved: !!document.querySelector('#panel > .fmaprow.cm-g37-up'), house: Math.round(document.querySelector('.isowrap img').getBoundingClientRect().height * 10) / 10 }));
      }
      if (mode === 'off' && vkey(view) === 'port') { await g.page.setViewportSize({ width: 844, height: 390 }); await g.wait(900); out.rotLandOff = await g.ev(() => { const img = document.querySelector('.isowrap img').getBoundingClientRect(); return [Math.round(img.width * 10) / 10, Math.round(img.height * 10) / 10]; }); }
      out[mode + 'Errors'] = g.realErrors(); await g.close();
    }
    R.port[vkey(view)] = out;
  }
  // ---------------- (g) hide-and-seek: no 🐈‍⬛ while she hides; shown on her tile afterwards; (h) no FACES: 👧 and no broken image; (k) strip dots
  {
    const g = await boot({ view: 'port', room: 'kitchen', storage: { cm_builds: TH } }); await g.calm();
    await g.go('den', 1500);
    const cats = () => g.ev(() => [...document.querySelectorAll('.cm-g37-ppl, .isosvg text')].filter(n => /🐈‍⬛/.test(n.textContent)).map(n => (n.closest('.fmaproom') || n).getAttribute('aria-label') || 'svg'));
    await g.ev(() => Minka._debug.place('storage', 160, 'sit')); await g.wait(400); await openMap(g); R.minkaBefore = await cats(); await closeMap(g);
    R.hide = await g.ev(() => Minka.hideNow()); await g.wait(4000); R.hideState = await g.ev(() => { const s = Minka.state(); return { hiding: s.hiding, room: s.room, hidden: s.hidden }; });
    await openMap(g); R.minkaWhileHiding = await cats(); await closeMap(g);
    await g.ev(() => Minka._debug.place('laundry', 150, 'sit')); await g.wait(400); await openMap(g); R.minkaAfter = await cats(); await closeMap(g);
    // strip dots: Nunu in the den, Jeff in the backyard, Minka alone in the laundry gets none
    await g.ev(() => { nunu.room = 'den'; nunu.hidden = false; for (const e of [daddy, mommy, rory]) if (e.room === 'den' || e.room === 'laundry') e.room = 'kitchen'; }); await g.wait(700);
    R.dotsDown = await g.ev(() => [...document.querySelectorAll('#roombar .rb')].map(b => b.dataset.r + (b.classList.contains('cm-gp') ? '+gp' : '') + (b.classList.contains('busy') ? '+busy' : '')).join(' '));
    await g.go('backyard', 1500); await g.ev(() => { jeff.room = 'backyard'; jeff.hidden = false; }); await g.wait(700);
    R.dotsOut = await g.ev(() => [...document.querySelectorAll('#roombar .rb')].map(b => b.dataset.r + (b.classList.contains('cm-gp') ? '+gp' : '') + (b.classList.contains('busy') ? '+busy' : '')).join(' '));
    R.dotStyle = await g.ev(() => { const b = document.querySelector('#roombar .rb.cm-gp'); const s = b && getComputedStyle(b, '::after'); return s ? [s.width, s.height, s.backgroundColor, s.borderTopColor, s.right, s.top].join(' ') : null; });
    await g.go('kitchen', 1500); await g.ev(() => { daddy.room = 'kitchen'; daddy.hidden = false; }); await g.wait(700);
    R.dotsMain = await g.ev(() => [...document.querySelectorAll('#roombar .rb')].map(b => b.dataset.r + (b.classList.contains('cm-gp') ? '+gp' : '') + (b.classList.contains('busy') ? '+busy' : '')).join(' '));
    // no FACES
    await g.ev(() => { window.__FI = FACES.img; FACES.img = null; Clarity.G37.face = null; }); await openMap(g);
    R.noFaces = await g.ev(() => ({ label: (document.querySelector('.isosvg text[data-r=kitchen]') || {}).textContent, hiddenMe: document.querySelectorAll('.cm-g37-me').length, images: document.querySelectorAll('.isosvg image, .cm-g37-you').length }));
    await closeMap(g); await g.go('den', 1500); await openMap(g);
    R.noFacesDen = await g.ev(() => { const b = document.querySelector('.fmaproom[aria-label=den]'); return { people: (b.querySelector('.cm-g37-ppl') || {}).textContent, img: b.querySelectorAll('img').length, here: b.classList.contains('here') }; });
    await g.shot(OUT + 'shots/g37_nofaces_den.png'); await closeMap(g); await g.ev(() => { FACES.img = __FI; });
    R.misc = { errors: g.realErrors() }; await g.close();
  }
  // ---------------- (i) four people in the kitchen at 375 px: no label overlaps a neighbour's label
  for (const mode of ['on', 'off']) {
    const g = await boot({ view: 'portSmall', room: 'kitchen', off: mode === 'off' ? 'G37' : '' }); await g.calm(); await people4(g); await openMap(g);
    R['labels_' + mode] = await g.ev(() => {
      const box = n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }, ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const L = [...document.querySelectorAll('.isosvg text')].map(t => ({ r: t.dataset.r || t.textContent, b: box(t) })); const f = document.querySelector('.cm-g37-ring'); if (f) L.push({ r: 'kitchen', b: box(f) });
      const bad = []; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (L[i].r !== L[j].r && ov(L[i].b, L[j].b) > 0) bad.push(L[i].r + '×' + L[j].r + ':' + Math.round(ov(L[i].b, L[j].b)));
      return { kitchen: (document.querySelector('.isosvg text[data-r=kitchen]') || {}).textContent, overlaps: bad };
    });
    await g.close();
  }
  fs.writeFileSync(OUT + 'g37_check.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

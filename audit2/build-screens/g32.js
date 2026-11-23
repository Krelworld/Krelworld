// G32 checks: the studio's floating ❌ in its own slot under the tools (landscape). Results -> g32.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const I47 = { left: 47, right: 47, bottom: 21 };
const VIEWS = [['land', 'land', null], ['land i47', 'land', I47], ['landSmall', 'landSmall', null], ['landSmall i47', 'landSmall', I47], ['844x340', { width: 844, height: 340 }, null], ['844x340 i47', { width: 844, height: 340 }, I47]];
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
const LIB = () => {
  window.S2 = {};
  S2.nm = T.nm;
  S2.open = async () => { if (Studio.active) Studio.close(); Studio.open(); await T.sleep(400); };
  S2.geo = () => { const x = document.getElementById('xFloat'), xr = x.getBoundingClientRect(), p = document.querySelector('#studio .s-paper').getBoundingClientRect(), c = document.querySelector('#studio .l-paint');
    return { xDisp: getComputedStyle(x).display, x: [xr.left, xr.top, xr.right, xr.bottom].map(Math.round), paper: [p.left, p.top, p.right, p.bottom].map(Math.round), WH: c.width + 'x' + c.height, aspect: +(p.width / p.height).toFixed(3), bitmapAspect: +(c.width / c.height).toFixed(3), text: x.textContent }; };
  S2.points = () => { const x = document.getElementById('xFloat'), r = x.getBoundingClientRect(), P = { c: [r.left + r.width / 2, r.top + r.height / 2], tl: [r.left + 2, r.top + 2], tr: [r.right - 2, r.top + 2], bl: [r.left + 2, r.bottom - 2], br: [r.right - 2, r.bottom - 2], mr: [r.right - 1, r.top + r.height / 2] }, out = {};
    for (const k in P) { const all = document.elementsFromPoint(P[k][0], P[k][1]), ri = all.findIndex(n => n.id === 'studio'), st = all.slice(0, ri + 1); out[k] = { top: S2.nm(all[0]), bad: st.filter(n => n !== x && n.closest && n.closest('.s-paper,.s-tool,.s-tile,.s-drawer')).map(S2.nm) }; }
    return out; };
  S2.paperEdge = () => { const x = document.getElementById('xFloat').getBoundingClientRect(), p = document.querySelector('#studio .s-paper').getBoundingClientRect(), bad = []; let n = 0;
    for (let y = Math.max(x.top, p.top + 1); y <= Math.min(x.bottom, p.bottom - 1); y += 2) { n++; const e = document.elementFromPoint(p.left + 1, y); if (!e || !e.classList.contains('l-fx')) bad.push(Math.round(y) + ':' + S2.nm(e)); } return { checked: n, bad }; };
  S2.tools = async () => { const box = document.querySelector('#studio .s-tools'), br = box.getBoundingClientRect(), x = document.getElementById('xFloat').getBoundingClientRect(), tl = [...box.querySelectorAll('.s-tool')];
    box.scrollTop = 0; await T.sleep(30); const full = tl.filter(t => { const r = t.getBoundingClientRect(); return r.top >= br.top - 0.5 && r.bottom <= br.bottom + 0.5; }).length, part = tl.filter(t => { const r = t.getBoundingClientRect(); return r.top < br.bottom && r.bottom > br.bottom; }).length;
    box.scrollTop = box.scrollHeight; await T.sleep(30); const er = tl[tl.length - 1], e = er.getBoundingClientRect(), hitE = document.elementFromPoint(e.left + e.width / 2, e.top + e.height / 2);
    const o = { toolsBox: [Math.round(br.top), Math.round(br.bottom)], fullAtRest: full, partAtRest: part, eraserBottom: Math.round(e.bottom), xTop: Math.round(x.top), gap: Math.round(x.top - e.bottom), eraserHit: hitE === er || er.contains(hitE), last: er.textContent };
    box.scrollTop = 0; return o; };
  S2.drawer = async (how) => { if (how === 'stickers') T.press(document.querySelector('#studio .s-tool[data-t=sticker]')); else if (how === 'pages') T.press(document.querySelector('#studio .s-top [aria-label=pages]')); else if (how === 'gallery') T.press(document.querySelector('#studio .s-top [aria-label=gallery]')); else T.press(document.querySelector('#studio .s-top [aria-label=save]'));
    await T.sleep(300); const d = document.querySelector('#studio .s-drawer'), dr = d.getBoundingClientRect(), x = document.getElementById('xFloat').getBoundingClientRect(), tiles = [...d.querySelectorAll('.s-tile')].slice(0, 4);
    const ov = Math.max(0, Math.min(dr.right, x.right) - Math.max(dr.left, x.left)) * Math.max(0, Math.min(dr.bottom, x.bottom) - Math.max(dr.top, x.top));
    const hits = tiles.map(t => { const r = t.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === t || t.contains(e); });
    const o = { kind: d.dataset.kind, hidden: d.classList.contains('hidden'), box: [dr.left, dr.top, dr.right, dr.bottom].map(Math.round), overlapX: Math.round(ov), first4Hit: hits };
    if (how !== 'save') T.press(how === 'stickers' ? document.querySelector('#studio .s-tool[data-t=marker]') : document.querySelector('#studio .s-top [aria-label=' + how + ']')); else T.press(d.querySelector('[aria-label=keep]')); await T.sleep(200); return o; };
};
(async () => {
  for (const [name, view, inset] of VIEWS) for (const off of ['', 'G32']) {
    const g = await boot({ port: 8910, view, inset, room: 'dining', off }); await g.calm(); await g.ev(TLIB); await g.ev(LIB);
    await g.ev(() => S2.open());
    const o = { geo: await g.ev(() => S2.geo()) };
    if (!off) {
      o.points = await g.ev(() => S2.points()); o.paperEdge = await g.ev(() => S2.paperEdge()); o.tools = await g.ev(() => S2.tools());
      o.drawers = {}; for (const d of ['stickers', 'pages', 'gallery', 'save']) o.drawers[d] = await g.ev(d => S2.drawer(d), d);
      await g.shot('g32_' + name.replace(' ', '_'));
      // a stroke that starts at the paper's bottom-left edge draws and keeps the studio open
      const p = o.geo.paper; const sx = p[0] + 1, sy = p[3] - 2;
      await g.page.mouse.move(sx, sy); await g.page.mouse.down(); for (let i = 1; i <= 8; i++) await g.page.mouse.move(sx + i * 6, sy - i * 3); await g.page.mouse.up(); await g.wait(150);
      o.edgeStroke = await g.ev(([sx, sy]) => { const c = document.querySelector('#studio .l-paint'), r = c.getBoundingClientRect(), px = (X, Y) => { const d = c.getContext('2d').getImageData(Math.round((X - r.left) * c.width / r.width), Math.round((Y - r.top) * c.height / r.height), 1, 1).data; return d[3] > 0; };
        return { studioOpen: Studio.active, inkedNearStart: px(sx + 12, sy - 6) || px(sx + 6, sy - 3), inkedMid: px(sx + 24, sy - 12) }; }, [sx, sy]);
    }
    log(name + (off ? ' G32off' : ''), o);
    res[name + off + ' errors'] = realErrors(g.errors); await g.close();
  }
  // bitmap identical to today
  for (const [name] of VIEWS) log('WH ' + name, { on: res[name].geo.WH, off: res[name + ' G32off'].geo.WH, same: res[name].geo.WH === res[name + ' G32off'].geo.WH, xOnDisp: res[name].geo.xDisp, xOffDisp: res[name + ' G32off'].geo.xDisp });
  // ---- closing: the floating ❌ (real tap) after drawing does what the top ❌ does; give / hang / carry / top ❌ hide the button at once; ✋ right after is not swallowed
  for (const [name, view, inset] of [VIEWS[0], VIEWS[3]]) {
    const g = await boot({ port: 8910, view, inset, room: 'dining' }); await g.calm(); await g.ev(TLIB); await g.ev(LIB);
    const out = {};
    for (const how of ['xFloat', 'topX']) {
      await g.ev(() => S2.open()); const p = await g.ev(() => S2.geo().paper);
      await g.page.mouse.move(p[0] + 100, p[1] + 60); await g.page.mouse.down(); for (let i = 1; i <= 8; i++) await g.page.mouse.move(p[0] + 100 + i * 10, p[1] + 60 + i * 5); await g.page.mouse.up(); await g.wait(100);
      const before = await g.ev(() => ({ gal: JSON.parse(localStorage.getItem('cm_gallery') || '[]').length, draft: (localStorage.getItem('cm_studioDraft') || '').length }));
      const xy = await g.ev(how => { const n = how === 'xFloat' ? document.getElementById('xFloat') : document.querySelector('#studio .s-top [aria-label=close]'); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, how);
      await g.tapXY(xy[0], xy[1]); await g.wait(200);
      out[how] = await g.ev(b => { const a = { gal: JSON.parse(localStorage.getItem('cm_gallery') || '[]').length, draft: (localStorage.getItem('cm_studioDraft') || '').length }; return { active: Studio.active, galleryAdded: a.gal - b.gal, draftWritten: a.draft > 0, draftChanged: a.draft !== b.draft, xDispAfter: getComputedStyle(document.getElementById('xFloat')).display }; }, before);
    }
    for (const how of ['give it to daddy', 'hang it on the wall', 'carry it', 'topX']) {
      out[how] = await g.ev(async how => { G.holding = null; await S2.open(); if (how !== 'topX') { T.press(document.querySelector('#studio .s-top [aria-label=save]')); await T.sleep(300); }
        const n = how === 'topX' ? document.querySelector('#studio .s-top [aria-label=close]') : document.querySelector('#studio .s-drawer [aria-label="' + how + '"]'); T.press(n);
        const x = document.getElementById('xFloat'), now = { studioGone: !document.getElementById('studio'), xDisp: getComputedStyle(x).display, artClass: x.classList.contains('art') };
        // ✋ (stop) at the bottom-left, as soon as it shows: what is under its centre?
        let stop = null; for (let i = 0; i < 30; i++) { const s = document.getElementById('stopBtn'); if (s && !s.classList.contains('hidden')) { const r = s.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); stop = { t: i * 20, under: T.nm(e), isStop: s.contains(e), xDisp: getComputedStyle(x).display, xArt: x.classList.contains('art'), xy: [r.left + r.width / 2, r.top + r.height / 2] }; break; } await T.sleep(20); }
        return Object.assign(now, { stop }); }, how);
      if (how === 'carry it' && out[how].stop) { await g.tapXY(out[how].stop.xy[0], out[how].stop.xy[1]); await g.wait(200); out[how].afterStopTap = await g.ev(() => ({ holding: !!G.holding })); }
      await g.ev(() => T.reset());
    }
    log('closing ' + name, out); res['closing errors ' + name] = realErrors(g.errors); await g.close();
  }
  // ---- portrait: no floating ❌, tools row identical to today; rotation with the studio open
  for (const v of ['port', 'portSmall']) {
    const L = {};
    for (const off of ['', 'G32']) { const g = await boot({ port: 8910, view: v, room: 'dining', off }); await g.calm(); await g.ev(TLIB); await g.ev(LIB); await g.ev(() => S2.open());
      L[off] = await g.ev(() => ({ x: getComputedStyle(document.getElementById('xFloat')).display, tools: [...document.querySelectorAll('#studio .s-tool, #studio .s-btn')].map(n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); }).join(' ') }));
      if (!off) { // rotate: portrait -> landscape -> portrait with the studio open
        const vp = await g.page.viewportSize(); const seq = [];
        for (const s of [{ width: vp.height, height: vp.width }, vp]) { await g.page.setViewportSize(s); await g.wait(500); seq.push(await g.ev(() => S2.geo())); }
        L.rot = seq.map(s => ({ xDisp: s.xDisp, WH: s.WH, aspect: s.aspect, bitmapAspect: s.bitmapAspect }));
      }
      L[off + 'err'] = realErrors(g.errors); await g.close(); }
    log('portrait ' + v, { xFloat: L[''].x, toolsSame: L[''].tools === L.G32.tools, rotation: L.rot, errors: [L.err, L.G32err] });
  }
  fs.writeFileSync(OUT + 'g32.json', JSON.stringify(res, null, 1));
  for (const k in res) if (/errors/.test(k) && res[k].length) console.log('ERRORS', k, res[k]);
})().catch(e => { console.error(e); process.exit(1); });

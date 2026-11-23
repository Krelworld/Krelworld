// G12 checks: Lego's ✅ on a small sideways phone, and the sticker book's ✅. Results -> g12.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const src = fs.readFileSync('/home/user/Krelworld/.wt/screens/public/chef-marina/fun.js', 'utf8'); const stkDef = src.slice(src.indexOf('const STK = ['), src.indexOf('let owned ='));
const IDS = [...stkDef.matchAll(/\['([a-z]+)', '/g)].map(m => m[1]);
const VIEWS = { port: ['port', null], portSmall: ['portSmall', null], land: ['land', null], landSmall: ['landSmall', null], '844x340': [{ width: 844, height: 340 }, null], '844x340i47': [{ width: 844, height: 340 }, { left: 47, right: 47, bottom: 21 }] };
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
(async () => {
  console.log('sticker ids', IDS.length);
  // ------------------------------------------------------------ Lego
  const LAY = {};
  for (const off of ['', 'G12']) for (const v of Object.keys(VIEWS)) {
    const g = await boot({ port: 8910, view: VIEWS[v][0], inset: VIEWS[v][1], room: 'den', off }); await g.calm(); await g.ev(TLIB);
    await g.ev(() => localStorage.removeItem('cm_bricks'));
    const r = await g.ev(async () => {
      await T.reset(); Bricks.open({ kind: 'lego' }); await T.sleep(500); Bricks.help(3); Bricks.help(4); Bricks.help(4); await T.sleep(1500);
      const side = document.querySelector('.bk-side'), done = document.querySelector('.bk-tools [aria-label=done]'), x = document.querySelector('.bk-top [aria-label=close]'), keep = document.querySelector('.bk-keep');
      const hitAt = (n, px, py) => { const e = document.elementFromPoint(px, py); return !!e && (e === n || n.contains(e)); }, hit = n => { const r = n.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && hitAt(n, r.left + r.width / 2, r.top + r.height / 2); };
      const o = { narrow: side.classList.contains('bk-narrow'), layout: T.layout(), toolsPos: getComputedStyle(document.querySelector('.bk-tools')).position };
      if (!o.narrow) return o;
      o.doneAtRest = hit(done); side.scrollTop = side.scrollHeight; await T.sleep(60); o.doneAtEnd = hit(done); side.scrollTop = 0; await T.sleep(60);
      // every colour, piece and side button: some scroll position where it (not ✅'s group) is what is under its centre
      const tiles = [...side.querySelectorAll('.bk-col, .bk-pc, .bk-grp:not(.bk-tools) .bk-b')]; let ok = 0; const miss = [];
      for (const t of tiles) { let found = false; for (let s = 0; s <= side.scrollHeight && !found; s += 12) { side.scrollTop = s; const r = t.getBoundingClientRect(); if (r.top >= 0 && r.bottom <= innerHeight && hitAt(t, r.left + r.width / 2, r.top + r.height / 2)) found = true; } if (found) ok++; else miss.push(t.getAttribute('aria-label')); }
      side.scrollTop = 0; o.tilesReachable = ok + '/' + tiles.length; o.miss = miss;
      const kr = keep && keep.getBoundingClientRect(), xr = x.getBoundingClientRect();
      o.keep = keep ? { inTop: !!keep.closest('.bk-top'), shown: !keep.classList.contains('bk-off'), underX: kr.top >= xr.bottom - 1 && Math.abs((kr.left + kr.width / 2) - (xr.left + xr.width / 2)) < 8 } : null;
      o.toolsBg = getComputedStyle(document.querySelector('.bk-tools')).backgroundColor;
      return o;
    });
    LAY[v + off] = r.layout; delete r.layout;
    if (!off && r.narrow) {
      await g.shot('g12_lego_' + v + '_rest');
      // ✅ (a real tap) runs finish(true): onDone gets the result; the build is kept. Then ❌ just leaves, also kept.
      const fin = await g.ev(async () => { await T.reset(); const o = {}; let done = null, closed = null; localStorage.removeItem('cm_bricks');
        Bricks.open({ kind: 'lego', onDone: r => { done = r; }, onClose: r => { closed = r; } }); await T.sleep(400); Bricks.help(3); Bricks.help(4); Bricks.help(4); await T.sleep(1500); o.count = Bricks.state().count;
        const d = document.querySelector('.bk-tools [aria-label=done]').getBoundingClientRect(); return { o, xy: [d.left + d.width / 2, d.top + d.height / 2] }; });
      await g.tapXY(fin.xy[0], fin.xy[1]); await g.wait(500);
      const afterDone = await g.ev(() => ({ open: Bricks.active, kept: (JSON.parse(localStorage.getItem('cm_bricks') || '{}').lego || {}).p ? 'yes' : 'no' }));
      const fin2 = await g.ev(async () => { let done = null, closed = null; window.__d = () => ({ done, closed }); Bricks.open({ kind: 'lego', onDone: r => { done = r; }, onClose: r => { closed = r; } }); await T.sleep(400); const n = Bricks.state().count;
        const x = document.querySelector('.bk-top [aria-label=close]').getBoundingClientRect(); return { reopenedCount: n, xy: [x.left + x.width / 2, x.top + x.height / 2] }; });
      await g.tapXY(fin2.xy[0], fin2.xy[1]); await g.wait(500);
      const afterX = await g.ev(async () => { const r = __d(); Bricks.open({ kind: 'lego' }); await T.sleep(300); const n = Bricks.state().count; await T.reset(); return { onDone: !!r.done, onClose: !!r.closed, open: false, countAfterReopen: n }; });
      r.finish = { built: fin.o.count, afterDone, reopenedCount: fin2.reopenedCount, afterX };
    }
    log('lego ' + v + (off ? ' G12off' : ''), r);
    res['lego errors ' + v + off] = realErrors(g.errors); await g.close();
  }
  for (const v of Object.keys(VIEWS)) { const same = JSON.stringify(LAY[v]) === JSON.stringify(LAY[v + 'G12']); log('lego layout identical on/off ' + v, same); }
  // ------------------------------------------------------------ sticker book
  for (const v of ['port', 'portSmall', 'land', 'landSmall', '844x340i47']) for (const where of ['game', 'title']) {
    const g = await boot({ port: 8910, view: VIEWS[v][0], inset: VIEWS[v][1], room: 'living', start: where === 'game', storage: { cm_stickers: JSON.stringify(IDS) } });
    if (where === 'game') await g.calm(); await g.ev(TLIB); await g.wait(500);
    const open = async () => { if (where === 'game') await g.ev(() => openStickers()); else { const b = await g.ev(() => { const r = document.querySelector('.tbook').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await g.tapXY(b[0], b[1]); } await g.wait(400); };
    await open();
    const r = await g.ev(async () => {
      const box = document.getElementById('stkBox'), ok = box.querySelector('.stk-ok'), hd = box.querySelector('.stk-h'), xb = box.querySelector('.st-x'), sts = [...box.querySelectorAll('.stk')];
      const hitAt = (n, px, py) => { const e = document.elementFromPoint(px, py); return !!e && (e === n || n.contains(e)); }, vis = n => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && hitAt(n, r.left + r.width / 2, r.top + r.height / 2); };
      const ov = (a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.max(0, Math.min(p.right, q.right) - Math.max(p.left, q.left)) * Math.max(0, Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top)); };
      const pts = n => { const r = n.getBoundingClientRect(); return [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.top + 6], [r.right - 6, r.top + 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.bottom - 6]]; };
      const o = { stickers: sts.length, got: sts.filter(s => s.classList.contains('got')).length, padLeft: getComputedStyle(box).paddingLeft, xon: document.body.classList.contains('cm-xon'), scrollMax: box.scrollHeight - box.clientHeight };
      box.scrollTop = 0; await T.sleep(40); o.okAtTop = vis(ok); o.headerUnderOkTop = ov(hd, ok); o.headerPtsHitOk = pts(hd).some(([x, y]) => document.elementFromPoint(x, y) === ok);
      box.scrollTop = box.scrollHeight; await T.sleep(40); o.okAtEnd = vis(ok); o.headerUnderOkEnd = ov(hd, ok);
      // every sticker: some scroll position where its centre and four inset corners are the sticker (not ✅, not the floating ❌)
      let good = 0; const bad = [];
      const xfl = document.getElementById('xFloat'); for (const s of sts) { let f = false; for (let y = 0; y <= box.scrollHeight && !f; y += 20) { box.scrollTop = y; const P = pts(s); if (P.every(([x, yy]) => yy >= 0 && yy <= innerHeight) && hitAt(s, P[0][0], P[0][1]) && P.every(([x, yy]) => { const e = document.elementFromPoint(x, yy); return e !== ok && !ok.contains(e) && e !== xfl; })) f = true; } if (f) good++; else bad.push(s.textContent); }
      o.stickersTappableClearOfOkAndX = good + '/' + sts.length; o.bad = bad;
      // a tap on a sticker wiggles it
      box.scrollTop = 0; const s0 = sts.find(s => s.classList.contains('got')); T.press(s0); o.wiggle = s0.getAnimations().length > 0;
      const xf = document.getElementById('xFloat'); o.xFloat = getComputedStyle(xf).display === 'none' ? 'hidden' : xf.textContent; o.xGlyph = xb.textContent;
      // the first sticker is clear of the floating ❌ at every scroll position
      if (o.xFloat !== 'hidden') { const xr = xf.getBoundingClientRect(); let clear = true; for (let y = 0; y <= box.scrollHeight; y += 20) { box.scrollTop = y; for (const s of sts) { const r = s.getBoundingClientRect(); if (r.left < xr.right && r.right > xr.left && r.top < xr.bottom && r.bottom > xr.top) clear = false; } } o.noStickerUnderXFloat = clear; }
      box.scrollTop = 0; return o;
    });
    await g.shot('g12_stk_' + v + '_' + where + '_top');
    await g.ev(() => { const b = document.getElementById('stkBox'); b.scrollTop = b.scrollHeight; }); await g.shot('g12_stk_' + v + '_' + where + '_end');
    // ✅ and ❌ (real taps) both close it
    const tapClose = async sel => { await g.ev(() => { const b = document.getElementById('stkBox'); if (b) b.scrollTop = 0; }); const b = await g.ev(s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await g.tapXY(b[0], b[1]); await g.wait(300); return g.ev(() => !document.getElementById('stkBox')); };
    r.okCloses = await tapClose('#stkBox .stk-ok'); await open(); r.xCloses = await tapClose('#stkBox .st-x');
    log('stickers ' + v + ' ' + where, r);
    res['stk errors ' + v + where] = realErrors(g.errors); await g.close();
  }
  fs.writeFileSync(OUT + 'g12.json', JSON.stringify(res, null, 1));
  for (const k in res) if (/errors/.test(k) && res[k].length) console.log('ERRORS', k, res[k]);
})().catch(e => { console.error(e); process.exit(1); });

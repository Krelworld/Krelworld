// G13 checks: landscape title picker hits (844x390, 667x375; insets 0 and 47 via CDP so env() is real), title art / ▶ clear of 👗 📒,
// landSmall foyer↔📒 gap, portrait title identical (rects of every title element, with and without a notch inset), and real taps:
// ▶ opens the picker, every card and 🎲 start where they do today, 👗 opens dress-up after starting, 📒 opens the sticker book.
const { boot, OUT, MINE } = require('./lib.js'); const fs = require('fs');
const RECTS = () => { const o = {}; let i = 0; for (const n of document.querySelectorAll('#title, #title *')) { const r = n.getBoundingClientRect(); o[(n.id || n.className.toString() || n.tagName) + '#' + (i++)] = [r.left, r.top, r.width, r.height].map(v => Math.round(v * 10) / 10).join(','); } return o; };
(async () => {
  const res = {};
  // 1) picker hits and gaps
  for (const view of ['land', 'landSmall']) for (const inset of [0, 47]) for (const [mode, off] of [['TODAY', MINE], ['G13', '']]) {
    const key = view + ' in' + inset + ' ' + mode;
    const g = await boot({ view, off, start: false, inset: inset ? { left: inset, right: inset, bottom: 21 } : null }); const p = g.page;
    await p.waitForTimeout(1500);
    // before picking: ▶ and the title art vs 👗 / 📒
    const pre = await p.evaluate(() => { const R = s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
      const ov = (a, b) => a && b ? Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])) : 0;
      const play = R('.tplay'), art = R('#titleCv'), logo = R('.tlogo'), dr = R('.tdress'), bk = R('.tbook');
      return { play, art, logo, dress: dr, book: bk, playUnder: ov(play, dr) + ov(play, bk), artUnder: ov(art, dr) + ov(art, bk), logoUnder: ov(logo, dr) + ov(logo, bk) }; });
    await g.tap('.tplay'); await p.waitForTimeout(900);
    const hits = await p.evaluate(() => { const out = {}; for (const b of document.querySelectorAll('.tpick .tcardr, .tpick .tdice')) { const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        out[b.getAttribute('aria-label')] = { box: [r.left, r.top, r.right, r.bottom].map(Math.round), hit: t === b || b.contains(t) ? 'own' : 'COVERED:' + (t && (t.className || t.id)) }; }
      const bk = document.querySelector('.tbook').getBoundingClientRect(), dr = document.querySelector('.tdress').getBoundingClientRect(), fy = document.querySelector('.tcardr[aria-label=foyer]').getBoundingClientRect();
      out._gap = { book: [bk.left, bk.top, bk.right, bk.bottom].map(Math.round), dress: [dr.left, dr.top, dr.right, dr.bottom].map(Math.round), foyerToBookY: Math.round(bk.top - fy.bottom), foyerToBookX: Math.round(fy.left - bk.right) };
      const liv = document.querySelector('.tcardr[aria-label=living]').getBoundingClientRect(); out._livingLeft = Math.round(liv.left); out._padL = getComputedStyle(document.getElementById('title')).paddingLeft; return out; });
    await g.shot(OUT + 'shots/g13_' + view + '_in' + inset + '_' + mode + '.png');
    res[key] = { pre, hits, errors: g.errors.filter(e => !/chip_love/.test(e)) };
    console.log(key, JSON.stringify(res[key]));
    await g.close();
  }
  // 2) portrait title identical (rects of every element in #title, before and after picking), with and without a notch inset
  for (const view of ['port', 'portSmall']) for (const inset of [null, { top: 47, bottom: 34 }]) {
    const out = {};
    for (const [mode, off] of [['TODAY', MINE], ['G13', '']]) {
      const g = await boot({ view, off, start: false, inset }); const p = g.page; await p.waitForTimeout(1500);
      await p.evaluate(() => { const s = document.createElement('style'); s.textContent = '#title *{animation:none!important;transition:none!important}'; s.setAttribute('data-clarity', 'test'); document.head.append(s); }); await p.waitForTimeout(200);
      const a = await p.evaluate(RECTS); await g.tap('.tplay'); await p.waitForTimeout(900); const b = await p.evaluate(RECTS);
      out[mode] = { a, b }; await g.close();
    }
    const diff = []; for (const ph of ['a', 'b']) for (const k of Object.keys(out.TODAY[ph])) if (out.TODAY[ph][k] !== out.G13[ph][k]) diff.push(ph + ' ' + k + ' ' + out.TODAY[ph][k] + ' -> ' + out.G13[ph][k]);
    console.log('portrait', view, inset ? 'notch' : 'flat', 'elements', Object.keys(out.G13.b).length, 'differences', diff.length, diff.slice(0, 5));
    res['portrait ' + view + (inset ? ' notch' : '')] = diff;
  }
  // 3) real taps: every card and 🎲 start the game in that room (🎲: any start room), 👗 opens dress-up, 📒 opens the sticker book
  for (const view of ['land', 'landSmall']) {
    const taps = {};
    for (const card of ['living', 'kitchen', 'dining', 'playroom', 'foyer', 'yard', 'surprise me']) {
      const g = await boot({ view, off: '', start: false }); const p = g.page; await p.waitForTimeout(1200);
      await g.tap('.tplay'); await p.waitForTimeout(700); await g.tap('.tpick [aria-label="' + card + '"]'); await p.waitForTimeout(900);
      taps[card] = await p.evaluate(() => ({ titleHidden: document.getElementById('title').classList.contains('hidden'), room: G.room }));
      await g.close();
    }
    { const g = await boot({ view, off: '', start: false }); const p = g.page; await p.waitForTimeout(1500); await g.tap('.tdress'); await p.waitForTimeout(2600);
      taps.dress = await p.evaluate(() => ({ titleHidden: document.getElementById('title').classList.contains('hidden'), panel: !document.getElementById('panel').classList.contains('hidden'), dressTabs: !!document.querySelector('#panel .tabs, #panel .dprev') })); await g.close(); }
    { const g = await boot({ view, off: '', start: false }); const p = g.page; await p.waitForTimeout(1500); await g.tap('.tbook'); await p.waitForTimeout(1200);
      taps.book = await p.evaluate(() => ({ stkBox: !!document.getElementById('stkBox') })); await g.close(); }
    console.log('taps', view, JSON.stringify(taps)); res['taps ' + view] = taps;
  }
  fs.writeFileSync(OUT + 'g13.json', JSON.stringify(res, null, 1));
})();

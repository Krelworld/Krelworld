// G33 story checks: tile size, gap to ◀, badges, face card over ◀ (landscape readers), ◀ back / ❌ close. Results -> g33_story.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
(async () => {
  for (const off of ['', 'G33']) for (const v of ['port', 'portSmall', 'land', 'landSmall', '844x340i47']) {
    const view = v === '844x340i47' ? { width: 844, height: 340 } : v, inset = v === '844x340i47' ? { left: 47, right: 47, bottom: 21 } : null;
    const g = await boot({ port: 8910, view, inset, room: 'living', off }); await g.calm(); await g.ev(TLIB);
    const o = {};
    for (let rep = 0; rep < 4; rep++) {          // the shelf shows 3 random books each time: look at several shelves
      const s = await g.ev(async () => { await T.reset(); G.busy = false; openStory(); await T.sleep(500);
        const x = document.querySelector('#storyBox .st-x'), xr = x.getBoundingClientRect(), books = [...document.querySelectorAll('#storyBox .st-book')];
        const badges = books.map(b => { const r = b.querySelector('b').getBoundingClientRect(), e = document.elementFromPoint(r.left + 1, r.top + 1), e2 = document.elementFromPoint(r.left + r.width / 2, r.top + 2); return { ico: b.querySelector('b').textContent, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), tlHits: T.nm(e), topHitsX: x.contains(e) || x.contains(e2), overlapX: Math.max(0, Math.min(r.right, xr.right) - Math.max(r.left, xr.left)) * Math.max(0, Math.min(r.bottom, xr.bottom) - Math.max(r.top, xr.top)) }; });
        const bookOv = books.map(b => { const r = b.getBoundingClientRect(); return Math.max(0, Math.min(r.right, xr.right) - Math.max(r.left, xr.left)) * Math.max(0, Math.min(r.bottom, xr.bottom) - Math.max(r.top, xr.top)); });
        return { x: [xr.left, xr.top, xr.width, xr.height].map(Math.round), glyph: x.textContent, badgeHitsX: badges.some(b => b.topHitsX), badgeOverlapX: Math.max(...badges.map(b => b.overlapX)), bookOverlapX: Math.max(...bookOv), firstBadge: badges[0] }; });
      o['shelf' + rep] = s;
    }
    const r = await g.ev(async () => { T.press('#storyBox .st-book'); await T.sleep(400);
      const x = document.querySelector('#storyBox .st-x').getBoundingClientRect(), b = document.querySelector('#storyBox .st-back').getBoundingClientRect();
      return { gap: Math.round(b.left - x.right), x: [x.left, x.width].map(Math.round), back: [b.left, b.top, b.width].map(Math.round) }; });
    o.readers = r;
    // landscape readers page: is ◀ under a face card while one shows? (predates the plan; record it)
    o.faceOverBack = await g.ev(async () => { UI.face('marina', 'happy', new Promise(r => setTimeout(r, 1500))); await T.sleep(300); const b = document.querySelector('#storyBox .st-back'), r = b.getBoundingClientRect(), cards = [...document.querySelectorAll('.facecard.show')];
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { cards: cards.map(c => { const q = c.getBoundingClientRect(); return [c.className, Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)].join(' '); }), backCentreHits: T.nm(e), covered: !b.contains(e) }; });
    // ◀ goes back to the shelf; then ❌ closes the story (real taps)
    const bxy = await g.ev(() => { const r = document.querySelector('#storyBox .st-back').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await g.wait(1400); await g.tapXY(bxy[0], bxy[1]); await g.wait(300);
    o.backToShelf = await g.ev(() => !!document.querySelector('#storyBox .st-shelf'));
    await g.shot('g33_story_' + v + (off ? '_off' : '') + '_shelf');
    const xxy = await g.ev(() => { const r = document.querySelector('#storyBox .st-x').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await g.tapXY(xxy[0], xxy[1]); await g.wait(300); o.xCloses = await g.ev(() => !document.getElementById('storyBox'));
    // the readers page shot
    await g.ev(async () => { G.busy = false; openStory(); await T.sleep(400); T.press('#storyBox .st-book'); await T.sleep(400); }); await g.shot('g33_story_' + v + (off ? '_off' : '') + '_readers');
    if (!off && /land/.test(v)) o.xFloatGlyph = await g.ev(() => document.getElementById('xFloat').textContent);
    await g.ev(() => T.reset());
    log(v + (off ? ' G33off' : ''), { shelves: [0, 1, 2, 3].map(i => ({ glyph: o['shelf' + i].glyph, x: o['shelf' + i].x, badgeHitsX: o['shelf' + i].badgeHitsX, badgeOverlapX: Math.round(o['shelf' + i].badgeOverlapX), bookOverlapX: Math.round(o['shelf' + i].bookOverlapX), badge0: o['shelf' + i].firstBadge.rect })), readers: o.readers, faceOverBack: o.faceOverBack, backToShelf: o.backToShelf, xCloses: o.xCloses, xFloatGlyph: o.xFloatGlyph });
    res[v + off + ' errors'] = realErrors(g.errors); await g.close();
  }
  fs.writeFileSync(OUT + 'g33_story.json', JSON.stringify(res, null, 1));
  for (const k in res) if (/errors/.test(k) && res[k].length) console.log('ERRORS', k, res[k]);
})().catch(e => { console.error(e); process.exit(1); });

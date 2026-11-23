// G15: story time, port and land: the reader's face card stays at full opacity with no grey filter on every page;
// a tap on it only gets the side-shake (no blip while #storyBox exists).
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
(async () => {
  const out = {};
  for (const view of ['port', 'land']) {
    const g = await L.boot({ port: 8860, view, room: 'living' }); await g.calm(); await g.page.evaluate(INSTR);
    const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
    const tapSel = async sel => { const c = await ev(sel => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel); if (!c) return false; await P.touchscreen.tap(c[0], c[1]); return true; };
    await ev(() => openStory()); await wait(800);
    await tapSel('#storyBox .st-book'); await wait(700);
    const readers = await ev(() => [...document.querySelectorAll('#storyBox .st-reader')].map(n => n.getAttribute('aria-label')));
    await tapSel('#storyBox .st-reader'); await wait(1200);
    const pages = []; let tapRes = null;
    for (let pg = 0; pg < 4; pg++) {
      const samp = [];
      for (let k = 0; k < 6; k++) { samp.push(await ev(() => ({ cap: (document.querySelector('#storyBox .st-cap') || {}).textContent || '', app: document.getElementById('app').className, faces: [...document.querySelectorAll('.facecard.show')].map(n => n.dataset.who + ' o=' + getComputedStyle(n).opacity + ' f=' + getComputedStyle(n).filter + ' z=' + getComputedStyle(n).zIndex) }))); await wait(300); }
      if (pg === 1) await g.shot(L.OUT + 'shots/g15_story_' + view + '.png');
      if (pg === 1 && !tapRes) { const t = await ev(() => performance.now()); const pre = await ev(() => ({ busy: !!G.busy, story: !!document.getElementById('storyBox'), room: G.room }));
        const ok = await tapSel('.facecard.show'); await wait(300); const s = await ev(t => __T.since(t), t); const post = await ev(() => ({ busy: !!G.busy, story: !!document.getElementById('storyBox'), room: G.room }));
        tapRes = { tapped: ok, shakes: s.shakes.map(x => x.who), blips: s.blips, same: JSON.stringify(pre) === JSON.stringify(post) }; }
      pages.push({ cap: samp[0].cap.slice(0, 30), faces: [...new Set(samp.flatMap(s => s.faces))], app: [...new Set(samp.map(s => s.app))] });
      await tapSel('#storyBox .st-nav.r'); await wait(900);
    }
    out[view] = { readers, pages, faceTap: tapRes, errors: g.errors.filter(e => !/chip_love/.test(e)) };
    console.log(view, JSON.stringify(out[view]));
    await g.close();
  }
  fs.writeFileSync(L.OUT + 'g15_story.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

// G19 checks A: strip under face cards; fold/unfold/pulse never resize; 😊 handle taps; chevron; hello unfolds; no blank frame.
const { boot, OUT, MINE, R } = require('./lib.js'); const fs = require('fs');
const CASES = [['land', null], ['landSmall', null], [{ width: 844, height: 340 }, null], ['land', { left: 47, right: 47, bottom: 21 }], ['landSmall', { left: 59, right: 59, bottom: 21 }]];
(async () => {
  const res = {};
  for (const [view, inset] of CASES) for (const off of ['', MINE]) {
    const name = (typeof view === 'string' ? view : view.width + 'x' + view.height) + (inset ? '_in' + inset.left : '') + (off ? ' TODAY' : ' G19');
    const g = await boot({ view, inset, room: 'kitchen', off }); const p = g.page; const out = res[name] = {};
    await g.calm();
    // count every resize() call from here on (test instrumentation only)
    await p.evaluate(() => { window.__rs = 0; const r = window.resize; window.resize = function () { window.__rs++; return r.apply(this, arguments); }; });
    // 1) both face cards up: every strip button answers at its centre
    await p.evaluate(() => { daddy.room = 'kitchen'; daddy.hidden = false; daddy.x = Math.min(ROOMS.kitchen.w - 40, E.camX + E.viewW - 40); daddy.state = 'idle'; marina.x = E.camX + 50; marina.state = 'idle';
      UI.face('marina', 'happy', 9000); UI.face('daddy', 'happy', 9000); });
    await p.waitForTimeout(700);
    out.stripHits = await p.evaluate(() => { const cards = [...document.querySelectorAll('.facecard.show')].map(n => n.classList.contains('right') ? 'R' : 'L').join('');
      const rb = [...document.querySelectorAll('#roombar .rb')].map(b => { const q = b.getBoundingClientRect(), t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return t === b || b.contains(t) ? 'ok' : 'COVERED by ' + (t && (t.id || t.className)); });
      return { cards, rb }; });
    // 2) fold / unfold / pulse while folded: picture width, viewW and ▶ stay; no resize() calls
    const snap = () => p.evaluate(() => ({ stageW: +document.getElementById('stage').getBoundingClientRect().width.toFixed(2), viewW: +E.viewW.toFixed(2), cvw: E.cv.width, arrowR: Math.round(document.querySelector('.navarrow.r').getBoundingClientRect().left * 10) / 10, rs: window.__rs,
      collapsed: document.getElementById('moodbar').classList.contains('collapsed'), faceVis: getComputedStyle(document.querySelector('.mood')).visibility, barDisp: getComputedStyle(document.getElementById('moodbar')).display,
      chevron: getComputedStyle(document.getElementById('moodToggle'), '::after').content, toggleText: document.getElementById('moodToggle').textContent }));
    out.s0 = await snap();
    await p.evaluate(() => { for (const s of document.querySelectorAll('.navarrow')) s.style.animation = 'none'; });
    out.s0 = await snap();
    await g.tap('#moodToggle'); await p.waitForTimeout(400); out.folded = await snap();
    await p.evaluate(() => UI.pulseMoods()); await p.waitForTimeout(400); out.afterHello = await snap();   // a hello unfolds
    await g.tap('#moodToggle'); await p.waitForTimeout(300); out.folded2 = await snap();
    await g.tap('#moodToggle'); await p.waitForTimeout(300); out.unfolded = await snap();
    // 3) folded, Daddy talking on the right: the handle answers at its centre and one tap unfolds
    await g.tap('#moodToggle'); await p.waitForTimeout(300);
    await p.evaluate(() => { daddy.x = Math.min(ROOMS.kitchen.w - 20, E.camX + E.viewW - 20); UI.face('daddy', 'happy', 9000); }); await p.waitForTimeout(500);
    out.handleTop = await p.evaluate(() => { const t = document.getElementById('moodToggle').getBoundingClientRect(), n = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); return (n && (n.id || n.className)) + ' / rightCard=' + !!document.querySelector('.facecard.show.right'); });
    await g.tap('#moodToggle'); await p.waitForTimeout(300); out.unfoldWhileTalking = await snap();
    // 4) the handle still shows the current mood (a real tap on 😢 … then wait it out)
    await g.calm(); await p.evaluate(() => { G.busy = false; });
    await g.tap('.mood[data-mood=sad]'); await p.waitForTimeout(500); out.afterSad = await snap();
    await p.screenshot({ path: OUT + 'shots/g19a_' + name.replace(' ', '_') + '.png' });
    // 5) no blank frame on a greeting pulse: the canvas keeps its pixels right after the class change
    out.pixelAfterPulse = await p.evaluate(() => new Promise(r => { UI.pulseMoods(); const d = E.ctx.getImageData(Math.floor(E.cv.width / 2), Math.floor(E.cv.height / 2), 1, 1).data; r([d[0], d[1], d[2], d[3]].join(',') + ' rs=' + window.__rs); }));
    out.errors = g.errors;
    console.log(name, JSON.stringify(out));
    await g.close();
  }
  fs.writeFileSync(OUT + 'g19_a.json', JSON.stringify(res, null, 1));
})();

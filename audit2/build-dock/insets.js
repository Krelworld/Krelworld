const L = require('./lib.js');
(async () => {
  for (const [name, top] of [['port', 59], ['port', 47], ['portSmall', 20], ['portSmall', 47], ['portSmall', 59], ['390x664', 47], ['390x664', 59], [{ width: 393, height: 852 }, 59], [{ width: 430, height: 932 }, 59]]) {
    const g = await L.boot({ port: 8890, view: L.viewOf(name), room: 'kitchen', insets: { top, bottom: top > 20 ? 34 : 0, left: 0, right: 0 } }); await g.calm();
    await g.ev(() => { G.holding = null; marina.state = 'idle'; miles.crying = false; miles.cryT = 999; for (const e of [daddy, mommy, rory, niko]) if (e.room === G.room) e.room = 'yard'; });
    await g.page.waitForFunction(() => !document.getElementById('bookBtn').classList.contains('off'), null, { timeout: 8000 }).catch(() => { }); await g.wait(1500);
    const r = await g.ev(() => { const st = document.getElementById('stage').getBoundingClientRect(); const home = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; }; const moodTop = Math.round(Math.min(...[...document.querySelectorAll('#moodbar .mood')].map(home))); const mbPos = getComputedStyle(document.getElementById('moodbar')).position;
      const b = document.getElementById('bookBtn').getBoundingClientRect(); const sb = document.getElementById('stopBtn'); sb.classList.remove('hidden'); const s = sb.getBoundingClientRect(); sb.classList.add('hidden');
      UI.face('marina', 'happy', 3000); const fc = document.querySelector('.facecard.show').getBoundingClientRect();
      const hb = (() => { const t = document.elementFromPoint(b.left + 32, b.top + 32); return t && (t.id || t.className); })();
      return { stageBottom: Math.round(st.bottom), moodTop, dock: [Math.round(b.top), Math.round(b.bottom)], dockGap: moodTop - Math.round(b.bottom), stop: [Math.round(s.top), Math.round(s.bottom)], stopGap: moodTop - Math.round(s.bottom), faceCardBottom: Math.round(fc.bottom), hitBook: hb, pe: getComputedStyle(document.getElementById('bookBtn')).pointerEvents, mode: Clarity.G25.mode, mbPos };
    });
    await g.ev(() => askRequest('cook')); await g.wait(500);
    r.req = await g.ev(() => { const q = document.getElementById('reqBtn'); const b = q.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Clarity.G25.mode, Clarity.G25.size]; });
    r.reqGap = r.moodTop - r.req[1];
    console.log(JSON.stringify(name), top, JSON.stringify(r), g.errs());
    await g.shot(L.OUT + 'shots/insets_' + (typeof name === 'string' ? name : name.width + 'x' + name.height) + '_' + top + '.png');
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

// G7: long lists show every choice. Portrait: the strip wraps (5 per row, 60 px at 375), top below the alerts if any (set once).
// Landscape (landSmall, 844x340, land): 7-10 item lists become placeActs' two-row ring. Every item visible and one tap.
const L = require('./lib.js');
const VIEWS = (process.argv[2] || 'port,portSmall,landSmall,844x340,land').split(',');
(async () => {
  const R = {};
  for (const vn of VIEWS) {
    const view = /^\d+x\d+$/.test(vn) ? { width: +vn.split('x')[0], height: +vn.split('x')[1] } : vn;
    const g = await L.boot({ port: 8870, view, room: 'living' }); await g.calm(); const page = g.page; const out = R[vn] = {};
    const goto = async (room, mx) => { await page.evaluate(r => { for (const id of ['stkBox']) { const b = document.getElementById(id); if (b) b.remove(); } if (G.room !== r) changeRoom(r, null, ROOMS[r] ? ROOMS[r].w / 2 : 100); }, room); await page.waitForTimeout(900); await L.quiet(page, room);
      await page.evaluate(([mx]) => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'kitchen'; marina.stop(); if (mx != null) marina.x = mx; marina.y = FLOOR; G.tv = null; }, [mx]);
      let last = null; for (let i = 0; i < 30; i++) { await page.waitForTimeout(150); const c = await page.evaluate(() => Math.round(E.camX * 10)); if (c === last) break; last = c; } };
    // open a list the way the game does: interact's anchor for props, or the menu function
    const open = (how) => page.evaluate(how => { if (how.fn) { eval(how.fn); return; } const p = PROPS[G.room].find(q => q.id === how.prop); UI.actions({ x: p.x, y: p.y - (p.h || spriteSize(p.k)[1] * (p.scale || 1)) - 4, prop: p }, how.list ? eval(how.list) : propActions(p)); }, how);
    const measure = () => page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(), tray = document.querySelector('#fx .acttray'), acts = [...document.querySelectorAll('#fx .act')];
      const r = n => { const q = n.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]; };
      const items = acts.map(a => { const q = a.getBoundingClientRect(), cx = (q.left + q.right) / 2, cy = (q.top + q.bottom) / 2, el = document.elementFromPoint(cx, cy); return { t: a.textContent, r: r(a), oneTap: !!el && el.closest('.act') === a, inStage: q.left >= st.left - 0.5 && q.right <= st.right + 0.5 && q.top >= st.top - 0.5 && q.bottom <= st.bottom + 0.5, onScreen: q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight }; });
      const rows = []; for (const y of items.map(i => i.r[1]).sort((a, b) => a - b)) if (!rows.length || y - rows[rows.length - 1] > 12) rows.push(y);
      const moods = [...document.querySelectorAll('#moodbar .mood')].map(r), ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      return { tray: tray ? r(tray) : null, trayTopStyle: tray ? tray.style.top : null, stage: r(document.getElementById('stage')), n: items.length, rows: rows.length, perRow: rows.map(y => items.filter(i => Math.abs(i.r[1] - y) <= 12).length), size: items[0] && items[0].r[2] - items[0].r[0],
        allOneTap: items.every(i => i.oneTap), allInStage: items.every(i => i.inStage), allOnScreen: items.every(i => i.onScreen), notOneTap: items.filter(i => !i.oneTap).map(i => i.t), icons: items.map(i => i.t).join(' '),
        onMood: items.filter(i => moods.some(m => ov(i.r, m) > 0)).map(i => i.t), bottom: Math.max(...items.map(i => i.r[3])), alerts: [...document.querySelectorAll('#alerts .alertb')].map(a => { const q = a.getBoundingClientRect(), el = document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2); return { r: r(a), tappable: !!el && !!el.closest('.alertb') }; }) }; });
    const lists = [
      ['tv', 'living', 330, { prop: 'tv' }], ['fireplace', 'living', 120, { prop: 'fireplace' }], ['gym', 'playroom', 200, { fn: 'gymMenu()' }], ['keys', 'playroom', 200, { prop: 'keys' }],
      ['table+dish', 'dining', 150, { prop: 'table', pre: "G.holding={type:'dish',dish:{art:'cake',score:3,say:[],name:'x',ings:['eggs'],method:'bake'}}" }],
      ['th-toys9', 'treehouse_oak', 150, { prop: 'th_shelf', list: "[A('🧺',()=>{})].concat(['🧸','🦄','🦖','🪀','🧩','📚','🫖','🔦'].map(c=>A(c,()=>{})))" }],
    ];
    for (const [name, room, mx, how] of lists) {
      try {
        await goto(room, mx); if (how.pre) await page.evaluate(s => eval(s), how.pre);
        await open(how); await page.waitForTimeout(700);
        const m = await measure(); out[name] = m; await g.shot(L.OUT + 'shots/g7_' + vn + '_' + name + '.png');
        console.log(vn, name.padEnd(10), 'tray', !!m.tray, 'n', m.n, 'rows', m.rows, JSON.stringify(m.perRow), 'size', m.size, 'oneTap', m.allOneTap, 'inStage', m.allInStage, 'onMood', m.onMood.join(''), 'bottom', m.bottom, 'stage', JSON.stringify(m.stage), m.notOneTap.join(''));
        await page.evaluate(() => { UI.closeActions(); G.holding = null; });
      } catch (e) { console.log(vn, name, 'ERR', e.message.split('\n')[0]); }
    }
    // a real tap on the last choice of the TV list runs it (the ring closes and something happens)
    try { await goto('living', 330); await open({ prop: 'tv' }); await page.waitForTimeout(700);
      const last = await page.evaluate(() => { const a = [...document.querySelectorAll('#fx .act')].pop(); const q = a.getBoundingClientRect(); return { t: a.textContent, x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2 }; });
      await page.touchscreen.tap(last.x, last.y); await page.waitForTimeout(1500);
      out.tapLast = { t: last.t, ringClosed: await page.evaluate(() => !document.querySelector('#fx .act')), tv: await page.evaluate(() => !!G.tv) }; console.log(vn, 'tap last TV choice', JSON.stringify(out.tapLast));
      await page.evaluate(() => { try { tvOff(true); } catch (e) { G.tv = null; } });
    } catch (e) { console.log(vn, 'tapLast ERR', e.message.split('\n')[0]); }
    // the dim backdrop still closes the list
    try { await goto('living', 330); await open({ prop: 'tv' }); await page.waitForTimeout(600);
      const pt = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const acts = [...document.querySelectorAll('#fx .act,#fx .acttray')].map(n => n.getBoundingClientRect());
        for (let y = st.bottom - 20; y > st.top + 70; y -= 10) for (let x = st.left + 70; x < st.right - 70; x += 10) { const el = document.elementFromPoint(x, y); if (el && el.classList.contains('actback')) return [x, y]; } return null; });
      if (pt) { await page.touchscreen.tap(pt[0], pt[1]); await page.waitForTimeout(500); }
      out.backdrop = { pt, closed: await page.evaluate(() => !document.querySelector('#fx .act')) }; console.log(vn, 'backdrop', JSON.stringify(out.backdrop));
    } catch (e) { console.log(vn, 'backdrop ERR', e.message.split('\n')[0]); }
    // portrait: alerts showing when the list opens -> the strip starts 8 px below them; then an alert arriving mid-pick moves nothing
    if (!(await page.evaluate(() => innerWidth > innerHeight))) {
      try {
        await goto('living', 330);
        await page.evaluate(() => { G.poop = true; }); for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); if (await page.evaluate(() => document.querySelectorAll('#alerts .alertb').length)) break; }
        await open({ prop: 'tv' }); await page.waitForTimeout(700);
        const a = await measure(); const al = await page.evaluate(() => { const n = document.getElementById('alerts'); return { top: n.offsetTop, h: n.offsetHeight, kids: n.children.length }; });
        out.withAlerts = { tray: a.tray, top: a.trayTopStyle, expect: (al.top + al.h + 8) + 'px', alerts: a.alerts, allOneTap: a.allOneTap, allInStage: a.allInStage, rows: a.rows, bottom: a.bottom, stage: a.stage };
        await g.shot(L.OUT + 'shots/g7_' + vn + '_tv_alerts.png'); console.log(vn, 'withAlerts', JSON.stringify(out.withAlerts));
        await page.evaluate(() => { UI.closeActions(); G.poop = false; }); for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); if (!(await page.evaluate(() => document.querySelectorAll('#alerts .alertb').length))) break; }
        await open({ prop: 'tv' }); await page.waitForTimeout(600);
        const b0 = await measure();
        await page.evaluate(() => { G.poop = true; }); let alertCame = false; for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); if (await page.evaluate(() => document.querySelectorAll('#alerts .alertb').length)) { alertCame = true; break; } }
        await page.waitForTimeout(1500); const b1 = await measure();
        out.midPick = { before: b0.tray, after: b1.tray, alertCame, unchanged: JSON.stringify(b0.tray) === JSON.stringify(b1.tray), topStyle: b1.trayTopStyle };
        await g.shot(L.OUT + 'shots/g7_' + vn + '_tv_alert_midpick.png'); console.log(vn, 'midPick', JSON.stringify(out.midPick));
        await page.evaluate(() => { UI.closeActions(); G.poop = false; });
      } catch (e) { console.log(vn, 'alerts ERR', e.message.split('\n')[0]); }
    }
    out.errors = g.errors; console.log(vn, 'errors', JSON.stringify(g.errors)); await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'g7_' + (process.argv[2] || 'all').replace(/,/g, '_') + (L.off ? '_off' : '') + '.json', JSON.stringify(R, null, 1));
})();

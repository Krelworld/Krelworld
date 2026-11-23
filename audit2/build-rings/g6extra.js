// G6 extra checks: (a) portrait with the 💩 and 🧻 alerts up, Daddy's ring is fully visible (elementFromPoint at each centre = the .act);
// (b) with a ring open, the alerts, the wish button and the request button still win their own taps.
const L = require('./lib.js');
const VIEWS = (process.argv[2] || 'port,portSmall,land,landSmall').split(',');
(async () => {
  const R = {};
  for (const view of VIEWS) {
    const g = await L.boot({ port: 8870, view, room: 'dining' }); await g.calm(); const page = g.page; const out = R[view] = {};
    const settle = async () => { let last = null; for (let i = 0; i < 30; i++) { await page.waitForTimeout(150); const c = await page.evaluate(() => Math.round(E.camX * 10) + ':' + Math.round(marina.x)); if (c === last) break; last = c; } };
    for (const g6 of [true, false]) {
      await page.evaluate(on => Clarity.set('G6', on), g6);
      await L.quiet(page, 'dining');
      await page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === 'dining' && !e.wild) e.room = 'kitchen'; marina.stop(); marina.x = 120; marina.y = FLOOR; daddy.room = 'dining'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = 170; daddy.y = FLOOR; AI.hold && AI.hold(daddy, true);
        G.poop = true; G.needTP = true; G.bathLocked = true; });
      for (let i = 0; i < 25; i++) { await page.waitForTimeout(300); if ((await page.evaluate(() => document.querySelectorAll('#alerts .alertb').length)) >= 2) break; }
      await settle();
      const pt = await page.evaluate(() => { const c = []; for (let y = 60; y <= 170; y += 2) for (let x = E.camX; x <= E.camX + E.viewW; x += 2) { const h = hitTest(x, y); if (!(h && h.kind === 'ent' && h.e === daddy)) continue; const [cx, cy] = Clarity.toClient(x, y); if ([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => Clarity.onCanvas(cx + dx, cy + dy))) c.push([cx, cy]); } return c[Math.floor(c.length / 2)] || null; });
      if (!pt) { out['g6' + g6] = 'no point on Daddy'; continue; }
      await page.touchscreen.tap(pt[0], pt[1]); for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#fx .act'))) break; await page.waitForTimeout(200); } await page.waitForTimeout(600);
      const m = await page.evaluate(() => { const R = n => { const q = n.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; }, ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        const al = [...document.querySelectorAll('#alerts .alertb')]; const hud = [...document.querySelectorAll('#alerts .alertb, #floorpill .fl, #mapBtn, .navarrow:not(.off), #moodbar .mood, #moodToggle, #weatherBtn:not(.hidden), #roombar .rb')].filter(n => n.getBoundingClientRect().width > 2 && +getComputedStyle(n).opacity > 0.05);
        return { alerts: al.map(a => a.getAttribute('aria-label')), acts: [...document.querySelectorAll('#fx .act')].map(a => { const q = a.getBoundingClientRect(), el = document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2);
          return { t: a.textContent, visible: !!el && el.closest('.act') === a, onAlert: al.some(x => ov(R(a), R(x)) > 0), onHud: hud.filter(x => ov(R(a), R(x)) > 30).map(x => x.id || x.className.split(' ')[0] + ':' + x.textContent.slice(0, 2)) }; }) }; });
      out['g6' + g6] = m; await g.shot(L.OUT + 'shots/g6x_' + view + '_daddy_alerts_' + (g6 ? 'on' : 'off') + '.png');
      console.log(view, 'G6', g6, JSON.stringify(m));
      if (g6) {
        // (b) with this ring open: the wish and request buttons appear; every prompt still wins its own tap
        await page.evaluate(() => { try { showWish('cook'); } catch (e) { } try { askRequest('cook'); } catch (e) { } }); await page.waitForTimeout(800);
        const own = await page.evaluate(() => { const r = {}; for (const [k, sel] of [['alert', '#alerts .alertb'], ['wish', '#wishBtn'], ['req', '#reqBtn']]) { const n = document.querySelector(sel); if (!n) { r[k] = 'absent'; continue; } const q = n.getBoundingClientRect(), el = document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2); r[k] = !!el && (el === n || n.contains(el)); } r.ringOpen = !!document.querySelector('#fx .act'); return r; });
        // a real tap on the 💩 alert while the ring is open does what it does today (whisks her to the litter tray)
        const ap = await page.evaluate(() => { const n = document.querySelector('#alerts .alertb[aria-label=poop]'); if (!n) return null; const q = n.getBoundingClientRect(); return [(q.left + q.right) / 2, (q.top + q.bottom) / 2]; });
        if (ap) { await page.touchscreen.tap(ap[0], ap[1]); for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); if (await page.evaluate(() => G.room === 'playroom')) break; } await page.waitForTimeout(800); }
        own.alertTap = await page.evaluate(() => ({ room: G.room, ring: [...document.querySelectorAll('#fx .act')].map(a => a.textContent).join(' ') }));
        out.ownTaps = own; console.log(view, 'own taps', JSON.stringify(own));
        await page.evaluate(() => { UI.closeActions(); if (window.clearWish) clearWish(); const b = document.getElementById('reqBtn'); if (b) b.remove(); if (G.room !== 'dining') changeRoom('dining', null, 120); }); await page.waitForTimeout(1200);
      }
      await page.evaluate(() => { UI.closeActions(); G.poop = false; G.needTP = false; G.bathLocked = false; });
    }
    await page.evaluate(() => Clarity.set('G6', true));
    out.errors = g.errors; console.log(view, 'errors', JSON.stringify(g.errors)); await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'g6extra.json', JSON.stringify(R, null, 1));
})();

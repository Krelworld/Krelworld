// G30: the stairs choices carry ⬆️ / ⬇️ badges. Geometry, elementFromPoint, real taps (badge vs centre vs just outside), no stacking,
// other 🪜 rings unbadged, ring contents in special states, switch off = today's DOM.
const L = require('./lib.js');
const VIEWS = (process.argv[2] || 'port,portSmall,land,landSmall,land47,landSmall47').split(',');
const TAPS = process.argv[3] !== 'notaps';
(async () => {
  const R = {};
  for (const vn of VIEWS) {
    const inset = /47$/.test(vn) ? 47 : 0, view = vn.replace(/47$/, '');
    const g = await L.boot({ port: 8870, view, room: 'foyer' }); await g.calm(); const page = g.page; const out = R[vn] = {};
    if (inset) { await page.evaluate(i => { const s = document.createElement('style'); s.textContent = '#app{padding:0 ' + i + 'px !important}'; document.head.append(s); resize(); }, inset); await page.waitForTimeout(500); }
    const goto = async (room) => { await page.evaluate(r => { const b = document.getElementById('stkBox'); if (b) b.remove(); if (G.room !== r) { changeRoom(r, null, ROOMS[r].w / 2); } }, room); await page.waitForTimeout(900); await L.quiet(page, room);
      await page.evaluate(r => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'kitchen'; const p = PROPS[r].find(q => q.a === (r === 'foyer' ? 'stairs' : 'ustairs')); marina.stop(); marina.x = p.x + (r === 'foyer' ? 50 : 60); marina.y = FLOOR; marina.state = 'idle'; marina.scale = 1.18; }, room);
      let last = null; for (let i = 0; i < 30; i++) { await page.waitForTimeout(150); const c = await page.evaluate(() => Math.round(E.camX * 10)); if (c === last) break; last = c; } };
    // open the ring with a real tap on the stairs
    const openRing = async (room) => { const pt = await page.evaluate(r => { const a = r === 'foyer' ? 'stairs' : 'ustairs'; const c = [];
        for (let y = 60; y <= 170; y += 2) for (let x = 0; x <= 300; x += 2) { const h = hitTest(x, y); if (!(h && h.kind === 'prop' && h.p.a === a)) continue; const [cx, cy] = Clarity.toClient(x, y); if (Clarity.onCanvas(cx, cy) && Clarity.onCanvas(cx + 8, cy) && Clarity.onCanvas(cx - 8, cy) && Clarity.onCanvas(cx, cy + 8) && Clarity.onCanvas(cx, cy - 8)) c.push([cx, cy]); }
        return c[Math.floor(c.length / 2)] || null; }, room);
      if (!pt) return false; await page.touchscreen.tap(pt[0], pt[1]); try { await page.waitForSelector('#fx .act', { timeout: 6000 }); } catch (e) { return false; } await page.waitForTimeout(500); return true; };
    const geo = () => page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(), R = n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
      const acts = [...document.querySelectorAll('#fx .act')], ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const hud = [...document.querySelectorAll('#moodbar .mood, #floorpill .fl, #mapBtn, .navarrow:not(.off), #alerts .alertb, #moodToggle')].filter(n => { const r = n.getBoundingClientRect(), cs = getComputedStyle(n); return r.width > 2 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; });
      return acts.map((a, i) => { const b = a.querySelector('.cm-badge'), ar = R(a); if (!b) return { t: a.textContent, badge: null, act: ar.map(Math.round) };
        const br = R(b), cx = (br[0] + br[2]) / 2, cy = (br[1] + br[3]) / 2, el = document.elementFromPoint(cx, cy);
        const others = acts.filter(x => x !== a).map(R);
        return { t: a.firstChild.textContent, badge: b.textContent, act: ar.map(Math.round), b: br.map(Math.round), h: Math.round(br[3] - br[1]), pastRight: Math.round(br[2] - ar[2]), pastBottom: Math.round(br[3] - ar[3]),
          touchesNext: others.some(o => ov([br[0] - 1, br[1] - 1, br[2] + 1, br[3] + 1], o) > 0), ownAct: !!el && el.closest('.act') === a, at: el ? (el.className || el.tagName) : null,
          hud: hud.filter(n => ov(br, R(n)) > 0).map(n => n.id || n.className), clipped: br[0] < st.left || br[2] > st.right || br[1] < st.top || br[3] > st.bottom }; }); });
    for (const room of ['foyer', 'uphall']) {
      await goto(room); const okOpen = await openRing(room); const g1 = await geo();
      await g.shot(L.OUT + 'shots/g30_' + vn + '_' + room + '.png');
      // open again on top of the open ring (UI.actions called again): still one badge each
      await page.evaluate(r => { const p = PROPS[r].find(q => q.a === (r === 'foyer' ? 'stairs' : 'ustairs')); UI.actions({ x: p.x, y: p.y - 60, prop: p }, propActions(p)); }, room); await page.waitForTimeout(300);
      const again = await page.evaluate(() => [...document.querySelectorAll('#fx .act')].map(a => a.querySelectorAll('.cm-badge').length));
      await page.evaluate(() => UI.closeActions());
      out[room] = { opened: okOpen, geo: g1, againBadges: again };
      if (TAPS) {
        out[room].taps = {};
        for (const ico of ['🪜', '💺']) for (const where of ['badge', 'centre', 'outside']) {
          await goto(room); await page.evaluate(() => { Upstairs.S.lift = Upstairs.S.lift; }); const lift0 = await page.evaluate(() => Upstairs.S.lift);
          if (!(await openRing(room))) { out[room].taps[ico + where] = 'NO RING'; continue; }
          const pt = await page.evaluate(([ico, where]) => { const a = [...document.querySelectorAll('#fx .act')].find(n => n.firstChild.textContent === ico); if (!a) return null; const r = a.getBoundingClientRect(), b = a.querySelector('.cm-badge');
            if (where === 'badge') { if (!b) return null; const q = b.getBoundingClientRect(); return [(q.left + q.right) / 2, (q.top + q.bottom) / 2]; }
            if (where === 'centre') return [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
            const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, rad = r.width / 2 + 10; return [cx - rad * 0.7071, cy - rad * 0.7071]; }, [ico, where]);   // 10 px outside, up-left (away from the badge)
          if (!pt) { out[room].taps[ico + where] = 'NO POINT'; continue; }
          const what = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('.act') ? 'act' : el.className || el.id || el.tagName) : null; }, pt);
          await page.touchscreen.tap(pt[0], pt[1]); await page.waitForTimeout(400);
          const s400 = await page.evaluate(() => ({ room: G.room, busy: G.busy, x: Math.round(marina.x), moving: marina.moving, ring: document.querySelectorAll('#fx .act').length }));
          let fin = null; for (let i = 0; i < 40; i++) { await page.waitForTimeout(400); fin = await page.evaluate(() => ({ room: G.room, busy: G.busy, x: Math.round(marina.x), state: marina.state, lift: Upstairs.S.lift, moving: marina.moving })); if (!fin.busy && !fin.moving && (where === 'outside' || fin.room !== (s400.room) || i > 25)) break; }
          out[room].taps[ico + where] = { at: what, lift0, s400, fin }; console.log(vn, room, ico, where, JSON.stringify(out[room].taps[ico + where]));
          if (fin && fin.room !== room) { await goto(room); }
        }
      }
      console.log(vn, room, JSON.stringify({ opened: okOpen, geo: g1, again }));
    }
    // other 🪜 rings get no badge; special states keep [🪜,💺]; switch off = today's DOM
    await goto('foyer');
    out.special = await page.evaluate(() => { const p = PROPS.foyer.find(q => q.a === 'stairs'); const icons = () => propActions(p).map(a => a.ico).join(' '); const res = {};
      res.plain = icons(); G.holding = { type: 'dish', dish: { art: 'cake', score: 3, say: [], name: 'x', ings: ['eggs'], method: 'bake' } }; res.dish = icons(); G.holding = null;
      G.tidy = true; res.tidy = icons(); G.tidy = false; return res; });
    out.special.ride = await page.evaluate(async () => { daddy.room = 'foyer'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = marina.x + 20; daddy.y = FLOOR; mount(daddy); await new Promise(r => setTimeout(r, 2500)); const p = PROPS.foyer.find(q => q.a === 'stairs');
      const ic = propActions(p).map(a => a.ico).join(' '); UI.actions({ x: p.x, y: p.y - 60, prop: p }, propActions(p)); const badges = [...document.querySelectorAll('#fx .act')].map(a => a.textContent).join(' '); UI.closeActions(); dismount(); daddy.room = 'kitchen'; return { state: marina.state, icons: ic, dom: badges }; });
    out.others = await page.evaluate(() => { const r = {}; const open = (anchor, list) => { UI.actions(anchor, list); const n = [...document.querySelectorAll('#fx .act')].map(a => a.textContent); UI.closeActions(); return n.join(' '); };
      r.mainStairsProp = open({ x: 100, y: 80, prop: { a: 'stairs_other', x: 100, y: 140 } }, [A('🪜', () => { }), A('💺', () => { })]);   // a ring whose anchor is not a stairs prop
      r.bunk = open({ x: 100, y: 80, prop: { a: 'bunk', x: 100, y: 140 } }, [A('🧸', () => { }), A('😴', () => { }), A('🪜', () => { })]);
      r.hatch = open({ x: 100, y: 80, prop: { a: 'th_hatch', x: 100, y: 140 } }, [A('🪜', () => { })]);
      r.built = open({ x: 100, y: 80, prop: { a: 'built', x: 100, y: 140 } }, [A('🪜', () => { })]);
      r.marina = open(marina, [A('🪜', () => { }), A('💺', () => { })]); return r; });
    out.off = await page.evaluate(() => { Clarity.set('G30', false); const p = PROPS.foyer.find(q => q.a === 'stairs'); UI.actions({ x: p.x, y: p.y - 60, prop: p }, propActions(p)); const h = [...document.querySelectorAll('#fx .act')].map(a => a.innerHTML); UI.closeActions(); Clarity.set('G30', true); return h; });
    out.errors = g.errors; console.log(vn, 'special', JSON.stringify(out.special), 'others', JSON.stringify(out.others), 'off', JSON.stringify(out.off), 'errors', JSON.stringify(g.errors));
    await g.close();
  }
  require('fs').writeFileSync(L.OUT + 'g30_' + (process.argv[2] || 'all').replace(/,/g, '_') + '.json', JSON.stringify(R, null, 1));
})();

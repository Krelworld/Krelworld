// G35 edge tab: placement (hitTest null over the whole tap zone, nothing over it), the room's own things still open their
// choices, the tab tap walks her toward the exit without changing room, bath time, riding Daddy and the wheelchair.
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
const ROOMS_T = ['bathroom', 'spa', 'treehouse_oak', 'treehouse_pine'];
const THINGS = { bathroom: ['mirror', 'vanity'], spa: ['linen', 'uvanity'], treehouse_oak: ['th_wall', 'th_bell', 'th_bucket'], treehouse_pine: ['th_wall', 'th_bell', 'th_bucket'] };
const vkey = v => typeof v === 'string' ? v : v.width + 'x' + v.height;
const toFar = (g, room) => g.ev(r => { G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.state = 'idle'; marina.offY = 0; marina.x = ROOMS[r].w - 24; for (const e of ENTS) if (e !== marina && e.room === r) e.x = ROOMS[r].w - 60; }, room);
const tabInfo = g => g.ev(() => {
  const t = Clarity.G35.tabDrawn, now = performance.now(); if (!t || now - t.at > 150) return { drawn: false, tab: Clarity.G35.tab && { side: Clarity.G35.tab.side, y: Clarity.G35.tab.y } };
  const probs = []; for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { const wx = t.x - 11 + 0.5 + 21 * i / 6, wy = t.y - 12 + 0.5 + 23 * j / 6; const h = hitTest(wx, wy); if (h) probs.push('hit ' + h.kind + ':' + (h.p ? h.p.id : h.e ? h.e.id : '')); const [px, py] = Clarity.toClient(wx, wy), n = document.elementFromPoint(px, py); if (!n || n.id !== 'cv') probs.push('covered ' + (n ? n.id || n.className : 'none')); }
  return { drawn: true, x: Math.round(t.x), y: t.y, side: t.side, exitX: t.exit.x, camX: Math.round(E.camX), viewW: Math.round(E.viewW), client: Clarity.toClient(t.x, t.y).map(Math.round), probs: [...new Set(probs)] };
});
(async () => {
  const R = { place: {}, things: {}, tap: {}, bath: {}, ride: {}, wheel: {} };
  // ---- placement in every view; landscape: not drawn while the exit is on screen
  for (const view of ['port', 'portSmall', 'land', 'landSmall']) {
    const g = await boot({ view, room: 'living', storage: { cm_builds: TH } }); await g.calm();
    for (const room of ROOMS_T) {
      await g.go(room, 1500); await toFar(g, room); await g.wait(2000);
      R.place[view + '/' + room + '/far'] = await tabInfo(g);
      await g.shot(OUT + `shots/g35_tab_${view}_${room}.png`);
      await g.ev(() => { marina.x = 40; }); await g.wait(1800); R.place[view + '/' + room + '/nearExit'] = await tabInfo(g);
    }
    R.place[view + '/errors'] = g.realErrors(); await g.close();
  }
  // ---- the room's own things still open their own choices (tapped where the tab would sit when possible), G35 on vs off;
  //      and the tab tap: walks toward the exit, same room
  for (const view of ['port', 'portSmall']) for (const mode of ['on', 'off']) {
    const g = await boot({ view, room: 'living', off: mode === 'off' ? 'G35' : '', storage: { cm_builds: TH } }); await g.calm();
    for (const room of ROOMS_T) {
      await g.go(room, 1500);
      for (const id of THINGS[room]) {
        // a spot for Marina where (with G35 on) the tab is drawn AND the thing is on the picture next to it
        let pt = null, mx = null;
        for (let x = 40; x <= await g.ev(r => ROOMS[r].w - 20, room) && !pt; x += 12) {
          await g.ev(([r, x]) => { G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.state = 'idle'; marina.x = x; for (const e of ENTS) if (e !== marina && e.room === r) e.room = 'kitchen'; }, [room, x]); await g.wait(1300);
          pt = await g.ev(([id, needTab]) => { const t = Clarity.G35.tabDrawn; if (needTab && (!t || performance.now() - t.at > 150)) return null; const p = PROPS[G.room].find(q => q.id === id); if (!p) return null;
            const tx = t ? t.x : Math.max(E.camX, 0) + 14;
            for (let d = 0; d < 60; d += 2) for (const wx of [tx + 14 + d, tx - 14 - d]) for (let wy = p.y + 4; wy > p.y - 70; wy -= 2) { const h = hitTest(wx, wy); if (h && h.kind === 'prop' && h.p.id === id) { const [px, py] = Clarity.toClient(wx, wy); const n = document.elementFromPoint(px, py); if (n && n.id === 'cv') return [px, py, Math.round(wx), Math.round(wy), Math.round(tx)]; } }
            return null; }, [id, mode === 'on']);
          if (pt) mx = x;
        }
        if (mode === 'off') { const k = view + '/on/' + room + '/' + id; mx = (R.things[k] && R.things[k].mx) || null; pt = null;
          if (mx != null) { await g.ev(([r, x]) => { G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.x = x; for (const e of ENTS) if (e !== marina && e.room === r) e.room = 'kitchen'; }, [room, mx]); await g.wait(1300);
            pt = await g.ev(([id, wx, wy]) => { const [px, py] = Clarity.toClient(wx, wy); return [px, py, wx, wy]; }, [id, R.things[k].w[0], R.things[k].w[1]]); } }
        if (!pt) { R.things[view + '/' + mode + '/' + room + '/' + id] = { res: 'never on the picture together with the tab' }; continue; }
        await g.page.touchscreen.tap(pt[0], pt[1]); await g.wait(2600);
        R.things[view + '/' + mode + '/' + room + '/' + id] = { mx, w: [pt[2], pt[3]], tabX: pt[4], res: await g.ev(() => [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join('') || ('no ring, room=' + G.room + ' ms=' + marina.state)) };
        await g.ev(() => UI.closeActions()); await g.wait(300);
      }
      if (mode === 'on') {
        await toFar(g, room); await g.wait(2000); const t = await tabInfo(g);
        if (t.drawn) { const x0 = await g.ev(() => Math.round(marina.x)); await g.page.touchscreen.tap(t.client[0], t.client[1]); await g.wait(300); const tgt = await g.ev(() => marina.tx != null ? Math.round(marina.tx) : null); await g.wait(4000);
          R.tap[view + '/' + room] = await g.ev(([x0, ex]) => ({ room: G.room, from: x0, to: Math.round(marina.x), exitX: ex, state: marina.state }), [x0, t.exitX]); R.tap[view + '/' + room].target = tgt;
          // then the way out works as tapping it does today (door → its room, hatch → 🪜/🛝 ring)
          const ex = await g.ev(() => { const p = PROPS[G.room].find(q => q.a === 'door' || q.a === 'th_hatch'); for (let d = 0; d < 40; d += 2) for (const wx of [p.x + d, p.x - d]) for (let wy = p.y - (p.h || 30) / 2; wy < p.y; wy += 2) { const h = hitTest(wx, wy); if (h && h.kind === 'prop' && h.p.id === p.id) { const [px, py] = Clarity.toClient(wx, wy); const n = document.elementFromPoint(px, py); if (n && n.id === 'cv') return [px, py]; } } return null; });
          if (ex) { await g.page.touchscreen.tap(ex[0], ex[1]); await g.wait(3000); R.tap[view + '/' + room].thenExit = await g.ev(() => G.room + ' ' + [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join('')); }
          await g.ev(() => UI.closeActions());
        } else R.tap[view + '/' + room] = 'tab not drawn ' + JSON.stringify(t);
      }
    }
    R.things[view + '/' + mode + '/errors'] = g.realErrors(); await g.close();
  }
  // ---- bath time (shower in the bathroom), riding Daddy, wheelchair: port, G35 on and off
  for (const mode of ['on', 'off']) {
    const g = await boot({ view: 'port', room: 'living', off: mode === 'off' ? 'G35' : '' }); await g.calm();
    await g.go('bathroom', 1500); await toFar(g, 'bathroom'); await g.wait(2000);
    const tabPt = mode === 'on' ? (await tabInfo(g)).client : await g.ev(() => Clarity.toClient(Math.max(E.camX, 0) + 14, 158).map(Math.round));
    // the shower bath (fun.js:166): tap where the tab sits while it runs
    await g.ev(() => { window.__bt = {}; const iv = setInterval(() => { const n = performance.now(); if (G.busy && !__bt.s) __bt.s = n; if (__bt.s && !G.busy && !__bt.e) { __bt.e = n; clearInterval(iv); } }, 10); const p = PROPS.bathroom.find(q => q.id === 'shower'); propActions(p).find(a => a.ico === '🛁').fn(); });
    for (let i = 0; i < 40 && !(await g.ev(() => G.busy)); i++) await g.wait(100);
    await g.wait(1500); const before = await g.ev(() => ({ x: Math.round(marina.x), busy: G.busy, tabDrawn: !!Clarity.G35.tabDrawn, P: P.length }));
    await g.page.touchscreen.tap(tabPt[0], tabPt[1]); await g.wait(400);
    const after = await g.ev(() => ({ x: Math.round(marina.x), busy: G.busy, P: P.length, bubbles: P.filter(p => p.ch && /🫧|💧|○/.test(p.ch) || p.type === 'water' || p.type === 'sparkle').length }));
    for (let i = 0; i < 120 && !(await g.ev(() => __bt.e)); i++) await g.wait(100);
    R.bath[mode] = { before, after, busySec: await g.ev(() => __bt.e ? ((__bt.e - __bt.s) / 1000).toFixed(2) : 'still busy') };
    // riding Daddy into the bathroom, then the tab
    await g.wait(800); await g.ev(() => { G.busy = false; daddy.room = 'bathroom'; daddy.hidden = false; daddy.x = ROOMS.bathroom.w - 40; marina.x = daddy.x; marina.mount = daddy; marina.state = 'ride'; daddy.state = 'shoulders'; }); await g.wait(2200);
    const rt = mode === 'on' ? await tabInfo(g) : { drawn: false };
    const r0 = await g.ev(() => ({ m: Math.round(marina.x), d: Math.round(daddy.x) }));
    const pt = rt.drawn ? rt.client : await g.ev(() => Clarity.toClient(Math.max(E.camX, 0) + 14, 158).map(Math.round));
    await g.page.touchscreen.tap(pt[0], pt[1]); await g.wait(600); const mid = await g.ev(() => ({ m: Math.round(marina.x), d: Math.round(daddy.x), mount: !!marina.mount })); await g.wait(3500);
    R.ride[mode] = { tab: rt.drawn, r0, mid, end: await g.ev(() => ({ m: Math.round(marina.x), d: Math.round(daddy.x), mount: marina.mount ? marina.mount.id : null, state: marina.state, room: G.room })) };
    await g.ev(() => { dismount(); }); await g.wait(500);
    // the wheelchair
    await g.ev(() => { G.busy = false; marina.x = ROOMS.bathroom.w - 30; marina.state = 'wheel'; daddy.room = 'kitchen'; }); await g.wait(2200);
    const wt = mode === 'on' ? await tabInfo(g) : { drawn: false };
    const w0 = await g.ev(() => Math.round(marina.x)); const pw = wt.drawn ? wt.client : await g.ev(() => Clarity.toClient(Math.max(E.camX, 0) + 14, 158).map(Math.round));
    await g.page.touchscreen.tap(pw[0], pw[1]); await g.wait(4000);
    R.wheel[mode] = { tab: wt.drawn, from: w0, end: await g.ev(() => ({ x: Math.round(marina.x), state: marina.state, room: G.room })) };
    await g.shot(OUT + `shots/g35_wheel_${mode}.png`);
    R.bath[mode].errors = g.realErrors(); await g.close();
  }
  fs.writeFileSync(OUT + 'g35_tabs.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

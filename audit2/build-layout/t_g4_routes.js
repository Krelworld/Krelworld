// G4 checks: every way into the living room reaches zoom 1 at once (or within 200 ms for a game start), leaving goes back to 1.16,
// the first frame after arrival already has the new zoom and the camera snapped with the new view width (no extra glide);
// rotation keeps zoom 1; TV on/off still hides/shows the strip and pill; portrait unaffected.
const { boot, OUT, MINE } = require('./lib.js'); const fs = require('fs');
const REC = () => { if (!window.__hk) { window.__hk = 1; Floors.hooks.push((was, room) => { window.__arr = { room, camX: +E.camX.toFixed(2), viewW: +E.viewW.toFixed(2), mx: +marina.x.toFixed(2), snap: +clamp(marina.x - E.viewW / 2, 0, Math.max(0, ROOMS[room].w - E.viewW)).toFixed(2), zoom: +(E.cssScale / (document.getElementById('stage').getBoundingClientRect().height / 180)).toFixed(3) }; }); }
  window.__arr = null; window.__fr = []; const rec = () => { window.__fr.push([performance.now(), +E.cssScale.toFixed(4), +E.camX.toFixed(2), G.room, +E.viewW.toFixed(2), document.getElementById('title').classList.contains('hidden')]); window.__frId = requestAnimationFrame(rec); }; window.__frId = requestAnimationFrame(rec); window.__t0 = performance.now(); };
const ANALYSE = () => { cancelAnimationFrame(window.__frId); const st = document.getElementById('stage').getBoundingClientRect(), base = st.height / 180, fr = window.__fr, t0 = window.__t0;
  const arr = fr.findIndex(f => f[3] === 'living'); if (arr < 0) return { arrived: false };
  const z = f => +(f[1] / base).toFixed(3), f0 = fr[arr], W = ROOMS.living.w;
  const zoomFrames = fr.slice(arr).map(z); const wrongFrames = zoomFrames.filter(v => Math.abs(v - zoomFrames[zoomFrames.length - 1]) > 0.002).length;
  const tOk = (() => { for (let i = arr; i < fr.length; i++) if (Math.abs(z(fr[i]) - zoomFrames[zoomFrames.length - 1]) < 0.002 && fr.slice(i).every(f => Math.abs(z(f) - zoomFrames[zoomFrames.length - 1]) < 0.002)) return Math.round(fr[i][0] - t0); return null; })();
  const glidePx = Math.round(Math.abs(fr[fr.length - 1][2] - f0[2]) * f0[1]);
  return { arrived: true, atRoomEvent: window.__arr, firstZoom: z(f0), finalZoom: zoomFrames[zoomFrames.length - 1], framesAtOtherZoom: wrongFrames, msToFinalZoom: tOk, firstCamX: f0[2], snapWanted: +clamp(marina.x - f0[4] / 2, 0, Math.max(0, W - f0[4])).toFixed(2), glidePxAfterArrival: glidePx, tvon: document.getElementById('stage').classList.contains('tvon') }; };
(async () => {
  const res = {};
  for (const view of ['land', 'landSmall']) for (const [mode, off] of [['TODAY', MINE], ['G4', 'G13,G14,G19'], ['G4+G19', '']]) {
    const key = view + ' ' + mode; res[key] = {};
    const g = await boot({ view, room: 'foyer', off }); const p = g.page;
    const go = async (name, prep, trig) => {
      await g.calm(); await p.evaluate(() => { for (const e of [daddy, mommy, rory]) e.room = 'kitchen'; G.tv = false; }); await p.evaluate(prep); await p.waitForTimeout(1600); await g.calm();
      await p.evaluate(() => { for (const n of document.querySelectorAll('.navarrow')) n.classList.remove('off'); });
      await p.evaluate(REC); await trig(); await p.waitForTimeout(1500);
      res[key][name] = await p.evaluate(ANALYSE);
    };
    await go('strip', () => travelTo('foyer'), () => g.tap('#roombar .rb[data-r=living]'));
    await go('arrow', () => { travelTo('foyer'); }, async () => { const to = await p.evaluate(() => ROOMS.foyer.right === 'living' ? '.navarrow.r' : '.navarrow.l'); await g.tap(to); });
    await go('swipe', () => travelTo('foyer'), async () => { const c = await g.ctx.newCDPSession(p); const q = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); let best = null;
        for (const fy of [0.9, 0.85, 0.95, 0.8]) for (const fx of [0.5, 0.4, 0.6]) { const x = r.width * fx, y = r.height * fy, [wx, wy] = toWorld(x, y); if (!best && !hitTest(wx, wy) && document.elementFromPoint(r.left + x, r.top + y).id === 'cv') best = [r.left + x, r.top + y]; }
        return { pt: best, dir: ROOMS.foyer.right === 'living' ? -1 : 1 }; });
      const [x0, y0] = q.pt, T = (type, x) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: y0 }] });
      await T('touchStart', x0); for (let k = 1; k <= 6; k++) { await T('touchMove', x0 + q.dir * 25 * k); await p.waitForTimeout(16); } await T('touchEnd', x0 + q.dir * 150); });
    await go('map', () => travelTo('kitchen'), async () => { await p.evaluate(() => openIsoMap()); await p.waitForTimeout(400);
      await p.evaluate(() => { const keys = Object.entries(ISO.rooms || ISO).filter(([r, d]) => ROOMS[r] && d.polygon).map(([r]) => r); const poly = document.querySelectorAll('.isoroom')[keys.indexOf('living')]; poly.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); });
    await go('walk-edge', () => travelTo('foyer'), () => p.evaluate(() => { const right = ROOMS.foyer.right === 'living'; marina.x = right ? ROOMS.foyer.w - 30 : 30; marina.walkTo(right ? ROOMS.foyer.w : 0); }));
    await go('travelTo', () => travelTo('dining'), () => p.evaluate(() => travelTo('living')));
    // leaving the living room goes back to 1.16 (zoom of the next room)
    await g.calm(); await p.evaluate(() => travelTo('living')); await p.waitForTimeout(1200);
    res[key].leave = await p.evaluate(() => new Promise(r => { travelTo('kitchen'); const st = document.getElementById('stage').getBoundingClientRect(); r(+(E.cssScale / (st.height / 180)).toFixed(3)); }));
    // walk living -> foyer -> living by the edges: zoom follows each time
    const seq = [];
    for (const [to, edge] of [['living', null], ['foyer', 'L'], ['living', 'R']]) {
      if (!edge) { await p.evaluate(() => travelTo('living')); await p.waitForTimeout(1200); }
      else for (let k = 0; k < 3; k++) { await g.calm(); await p.evaluate(() => { G.busy = false; G.sceneOn = false; for (const e of [daddy, mommy, rory]) e.room = 'kitchen'; }); await p.evaluate(edge => { const R = ROOMS[G.room]; const right = R.right && (edge === 'R' || !R.left); if (right) { marina.x = R.w - 30; marina.walkTo(R.w); } else { marina.x = 30; marina.walkTo(0); } }, edge); await p.waitForTimeout(2500); if (await p.evaluate(to => G.room === to, to)) break; }
      seq.push(await p.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); return G.room + ':' + (E.cssScale / (st.height / 180)).toFixed(2); }));
    }
    res[key].walkSeq = seq.join(' ');
    // TV on / off in the living room: tvon class, strip and pill hidden/shown exactly as before, zoom
    await g.calm(); await p.evaluate(() => travelTo('living')); await p.waitForTimeout(1200); await g.calm();
    const tvLook = () => p.evaluate(() => { const st = document.getElementById('stage'), r = st.getBoundingClientRect(); return { tvon: st.classList.contains('tvon'), strip: getComputedStyle(document.getElementById('roombar')).opacity, pill: getComputedStyle(document.getElementById('floorpill')).opacity, zoom: +(E.cssScale / (r.height / 180)).toFixed(3) }; });
    res[key].tvOff0 = await tvLook();
    await p.evaluate(() => tvOn(showList()[0])); await p.waitForTimeout(1200); res[key].tvOn = await tvLook();
    if (mode !== 'TODAY') await g.shot(OUT + 'shots/g4_tvon_' + view + '_' + mode.replace('+', '_') + '.png');
    await p.evaluate(() => tvOff()); await p.waitForTimeout(1200); res[key].tvOff = await tvLook();
    // rotate while in the living room: the game's own resize path keeps zoom 1 sideways
    await g.calm(); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(900);
    res[key].rotPortrait = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return +(E.cssScale / (r.height / 180)).toFixed(3); });
    await p.setViewportSize(view === 'land' ? { width: 844, height: 390 } : { width: 667, height: 375 }); await p.waitForTimeout(900);
    res[key].rotBack = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { zoom: +(E.cssScale / (r.height / 180)).toFixed(3), cvw: E.cv.width, stageW: Math.round(r.width) }; });
    res[key].errors = g.errors.filter(e => !/chip_love/.test(e));
    console.log(key, JSON.stringify(res[key]));
    await g.close();
  }
  // a game started in the living room / kitchen (title -> startGame)
  for (const view of ['land', 'landSmall']) for (const [mode, off] of [['TODAY', MINE], ['G4+G19', '']]) for (const room of ['living', 'kitchen']) {
    const g = await boot({ view, room, off, start: false }); const p = g.page;
    await p.evaluate(REC); await p.evaluate(r => startGame(r), room); await p.waitForTimeout(1500);
    const a = await p.evaluate(() => { cancelAnimationFrame(window.__frId); const st = document.getElementById('stage').getBoundingClientRect(), base = st.height / 180, fr = window.__fr, t0 = window.__t0; const fin = +(fr[fr.length - 1][1] / base).toFixed(3);
      let tOk = null; for (let i = 0; i < fr.length; i++) if (fr.slice(i).every(f => Math.abs(f[1] / base - fin) < 0.002)) { tOk = Math.round(fr[i][0] - t0); break; }
      const vis = fr.filter(f => f[5]); return { room: G.room, finalZoom: fin, msToFinalZoom: tOk, visibleFrames: vis.length, visibleFramesAtOtherZoom: vis.filter(f => Math.abs(f[1] / base - fin) > 0.002).length }; });
    console.log('start', view, mode, room, JSON.stringify(a), JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
    res['start ' + view + ' ' + mode + ' ' + room] = a;
    await g.close();
  }
  // portrait: the living room keeps today's zoom (port, portSmall, and 375x553 where the picture is wider than tall)
  for (const view of ['port', 'portSmall', { width: 375, height: 553 }]) for (const [mode, off] of [['TODAY', MINE], ['G4+G19', '']]) {
    const g = await boot({ view, room: 'living', off }); const p = g.page; await g.calm(); await p.waitForTimeout(400);
    const z = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); const a = +(E.cssScale / (r.height / 180)).toFixed(3); travelTo('kitchen'); return a; }); await p.waitForTimeout(800);
    const zk = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return +(E.cssScale / (r.height / 180)).toFixed(3); });
    const vn = typeof view === 'string' ? view : view.width + 'x' + view.height;
    console.log('portrait', vn, mode, 'living', z, 'kitchen', zk, JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
    res['portrait ' + vn + ' ' + mode] = { living: z, kitchen: zk };
    await g.close();
  }
  fs.writeFileSync(OUT + 'g4_routes.json', JSON.stringify(res, null, 1));
})();

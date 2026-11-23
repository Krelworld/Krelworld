// G18: the tapped thing glows from the tap until its choices close; others' glow eases out meanwhile; cleared on arrival+0.6 s
// without a ring, on room change, on scenes. Walk timing unchanged. Uses real touchscreen taps.
const L = require('./lib.js');
const view = process.argv[2] || 'land';
(async () => {
  const R = {};
  const g = await L.boot({ port: 8870, view, room: 'kitchen' }); await g.calm(); const page = g.page;
  await page.evaluate(() => { window.__pa = 0; const _p = propActions; propActions = function () { window.__pa++; return _p.apply(this, arguments); }; window.__ea = 0; const _e = entActions; entActions = function () { window.__ea++; return _e.apply(this, arguments); };
    window.__ht = 0; });
  const settle = async () => { let last = null; for (let i = 0; i < 30; i++) { await page.waitForTimeout(150); const c = await page.evaluate(() => Math.round(E.camX * 10) + ':' + Math.round(marina.x)); if (c === last) break; last = c; } };
  const goto = async (room, mx, keep) => { await page.evaluate(r => { const b = document.getElementById('stkBox'); if (b) b.remove(); if (G.room !== r) changeRoom(r, null, ROOMS[r].w / 2); }, room); await page.waitForTimeout(900); await L.quiet(page, room);
    await page.evaluate(([mx, keep]) => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild && !(keep || []).includes(e.id)) e.room = G.room === 'yard' ? 'kitchen' : 'yard'; marina.stop(); marina.x = mx; marina.y = FLOOR; marina.state = 'idle'; }, [mx, keep]); await settle(); await page.waitForTimeout(700); };
  // a canvas point for a prop id / person id that is free of buttons
  const pointFor = (kind, id) => page.evaluate(([kind, id]) => { const c = [];
    for (let y = 40; y <= 182; y += 2) for (let x = Math.max(0, E.camX); x <= E.camX + E.viewW; x += 2) { const h = hitTest(x, y); const ok = kind === 'prop' ? h && h.kind === 'prop' && h.p.id === id : h && h.kind === 'ent' && h.e.id === id; if (!ok) continue;
      const [cx, cy] = Clarity.toClient(x, y); if ([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => Clarity.onCanvas(cx + dx, cy + dy))) c.push([cx, cy]); }
    return c[Math.floor(c.length / 2)] || null; }, [kind, id]);
  const snap = (ids) => page.evaluate(ids => { const S = Clarity.G18, t = S.target; const all = PROPS[G.room].filter(p => (p.glow || 0) > 0.05).map(p => p.id + ':' + p.glow.toFixed(2));
    const ents = ENTS.filter(e => e.here && e !== marina && (e.glow || 0) > 0.05).map(e => e.id + ':' + e.glow.toFixed(2));
    return { t: +E.t.toFixed(2), target: t ? t.id : null, ring: S.ring, ringDom: !!document.querySelector('#fx .act'), moving: (marina.mount || marina).moving, x: Math.round(marina.x), lit: all.concat(ents), room: G.room, busy: G.busy }; }, ids);
  await page.evaluate(() => { window.__g18log = []; let last = ''; const f = () => { try { const S = Clarity.G18, m = (marina.mount || marina).moving, k = (S.target ? S.target.id : '-') + '|' + (m ? 'm' : '-') + '|' + G.room; if (k !== last) { last = k; __g18log.push([+E.t.toFixed(3), k]); } } catch (e) { } requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const tapAndWatch = async (pt, ms, step) => { await page.evaluate(() => { __g18log.length = 0; }); const tr = []; await page.touchscreen.tap(pt[0], pt[1]); const t0 = Date.now(); while (Date.now() - t0 < ms) { tr.push(await snap()); await page.waitForTimeout(step || 100); } return tr; };
  const litOthers = (s, id) => s.lit.filter(x => !x.startsWith(id + ':') && +x.split(':')[1] > 0.1);

  // 1. kitchen: standing by the sink, tap the stove. Only the stove glows during the walk and while its ring is open.
  await goto('kitchen', 128);
  const before1 = await snap();
  let pt = await pointFor('prop', 'stove'); const pa0 = await page.evaluate(() => __pa);
  let tr = await tapAndWatch(pt, 3500, 80);
  const tRing = tr.find(s => s.ringDom); const walk = tr.filter(s => s.moving); const ringPh = tr.filter(s => s.ringDom);
  R.stove = { before: before1.lit, walkSamples: walk.length, walkOthersLit: walk.filter(s => s.t - tr[0].t > 0.35).map(s => litOthers(s, 'stove')).filter(a => a.length).slice(0, 4), walkTarget: [...new Set(walk.map(s => s.target))],
    ringOthersLit: ringPh.filter(s => s.t - (tRing ? tRing.t : 0) > 0.35).map(s => litOthers(s, 'stove')).filter(a => a.length).slice(0, 4), stoveGlowAtRing: ringPh.length ? ringPh[ringPh.length - 1].lit.filter(x => x.startsWith('stove')) : null,
    propActionsCalls: (await page.evaluate(() => __pa)) - pa0, ringAfterS: tRing ? +(tRing.t - tr[0].t).toFixed(2) : null };
  await g.shot(L.OUT + 'shots/g18_' + view + '_stove_ring.png');
  // close by the backdrop: the target clears, nearby glow returns
  const bk = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); for (let y = st.bottom - 30; y > st.top + 70; y -= 12) for (let x = st.left + 80; x < st.right - 80; x += 12) { const el = document.elementFromPoint(x, y); if (el && el.classList.contains('actback')) return [x, y]; } return null; });
  await page.touchscreen.tap(bk[0], bk[1]); await page.waitForTimeout(900);
  R.stove.afterClose = await snap();
  console.log('1 stove', JSON.stringify(R.stove));
  // walk timing: the same tap with G18 off
  await page.evaluate(() => Clarity.set('G18', false)); await goto('kitchen', 128); pt = await pointFor('prop', 'stove');
  tr = await tapAndWatch(pt, 3500, 80); const tRingOff = tr.find(s => s.ringDom);
  R.stove.ringAfterS_off = tRingOff ? +(tRingOff.t - tr[0].t).toFixed(2) : null; R.stove.arriveX_off = tr[tr.length - 1].x;
  await page.evaluate(() => { UI.closeActions(); Clarity.set('G18', true); });
  console.log('1b timing on/off', R.stove.ringAfterS, R.stove.ringAfterS_off);

  // 2. walk-only things and a door: clear within 0.6 s of arrival, or on the room change
  for (const [room, id] of [['pool', 'towels'], ['backyard', 'lumber'], ['foyer', 'door'], ['backyard', 'door']]) {
    const tx = await page.evaluate(([room, id]) => { const p = id === 'door' ? PROPS[room].find(q => q.a === 'door') : PROPS[room].find(q => q.id === id); return p ? [p.id, p.x] : null; }, [room, id]);
    if (!tx) { R['clear_' + room + '_' + id] = 'none'; console.log('2', room, id, 'none'); continue; }
    const vw = await page.evaluate(() => E.viewW); const W = await page.evaluate(r => ROOMS[r].w, room);
    const mx = tx[1] + 0.32 * vw < W - 10 ? tx[1] + 0.32 * vw : tx[1] - 0.32 * vw;
    await goto(room, mx); const pid = tx[0];
    pt = await pointFor('prop', pid); if (!pt) { R['clear_' + room + '_' + id] = 'no point for ' + pid; console.log('2', room, 'no point', pid); continue; }
    tr = await tapAndWatch(pt, 6000, 60);
    const firstStop = tr.findIndex((s, i) => i > 0 && !s.moving && tr[i - 1].moving); const cleared = tr.findIndex((s, i) => i > 0 && !s.target);
    const roomChange = tr.findIndex(s => s.room !== room);
    R['clear_' + room + '_' + id] = { prop: pid, targetSet: tr.some(s => s.target === pid), arriveT: firstStop >= 0 ? tr[firstStop].t : null, clearedT: cleared >= 0 ? tr[cleared].t : null, clearAfterArrive: firstStop >= 0 && cleared >= 0 ? +(tr[cleared].t - tr[firstStop].t).toFixed(2) : null, roomChangeT: roomChange >= 0 ? tr[roomChange].t : null, clearedOnRoomChange: roomChange >= 0 ? !tr[roomChange].target : null, ring: tr.some(s => s.ringDom), litAfter: tr[tr.length - 1].lit };
    R['clear_' + room + '_' + id].frameLog = await page.evaluate(() => __g18log.slice());
    console.log('2', room, id, JSON.stringify(R['clear_' + room + '_' + id]));
  }

  // 3. tap A, then B mid-walk: A clears and B lights
  await goto('kitchen', 70);
  const ptA = await pointFor('prop', 'sink'); const ptB = await pointFor('prop', 'stove'); await page.evaluate(() => { __g18log.length = 0; });
  await page.touchscreen.tap(ptA[0], ptA[1]); await page.waitForTimeout(250); const sA = await snap();
  await page.touchscreen.tap(ptB[0], ptB[1]); await page.waitForTimeout(400); const sB = await snap();
  const glowA = await page.evaluate(() => [PROPS.kitchen.find(p => p.id === 'sink').glow, PROPS.kitchen.find(p => p.id === 'stove').glow]);
  await page.waitForTimeout(2500); const sB2 = await snap(); R.retargetLog = await page.evaluate(() => __g18log.slice()); console.log("3 log", JSON.stringify(R.retargetLog));
  R.retarget = { afterA: { target: sA.target, moving: sA.moving }, afterB: { target: sB.target, moving: sB.moving }, glowSinkStove: glowA.map(v => +(v || 0).toFixed(2)), end: { target: sB2.target, ring: sB2.ringDom, lit: sB2.lit } };
  console.log('3 retarget', JSON.stringify(R.retarget)); await page.evaluate(() => UI.closeActions());

  // 4. a tapped person who walks away keeps the glow; then: open Daddy's ring and he walks to another room -> proximity glow returns
  await goto('kitchen', 140, ['daddy']);
  await page.evaluate(() => { daddy.room = 'kitchen'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = 140 + Math.round(E.viewW * 0.3); daddy.y = FLOOR; AI.hold && AI.hold(daddy, true); }); await page.waitForTimeout(400);
  pt = await pointFor('ent', 'daddy');
  await page.touchscreen.tap(pt[0], pt[1]); await page.waitForTimeout(200); await page.evaluate(() => daddy.walkTo(daddy.x + 40, null, 40)); await page.waitForTimeout(900);
  const sD = await page.evaluate(() => ({ target: Clarity.G18.target && Clarity.G18.target.id, daddyGlow: +(daddy.glow || 0).toFixed(2), daddyX: Math.round(daddy.x) }));
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#fx .act'))) break; await page.waitForTimeout(200); }
  const sD2 = await page.evaluate(() => ({ ring: [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(' '), target: Clarity.G18.target && Clarity.G18.target.id, ringFlag: Clarity.G18.ring, daddyGlow: +(daddy.glow || 0).toFixed(2) }));
  await page.waitForTimeout(600); const othersDuring = await snap();
  await page.evaluate(() => { daddy.walkTo(ROOMS.kitchen.w - 4, () => { daddy.room = 'dining'; daddy.x = 20; }, 200); });
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(200); if (await page.evaluate(() => daddy.room !== 'kitchen')) break; }
  await page.waitForTimeout(1200); const sD3 = await snap();
  R.person = { walkAway: sD, ringOpen: sD2, othersLitWhileRingOpen: litOthers(othersDuring, 'daddy'), afterDaddyLeft: { target: sD3.target, ringDom: sD3.ringDom, lit: sD3.lit } };
  console.log('4 person', JSON.stringify(R.person));

  // 5. no glow during a scene (the bottle), nor while dragging Marina
  await goto('living', 260);
  await page.evaluate(() => { miles.spot = 'bouncer'; miles.room = 'living'; miles.x = 300; mommy.holdingMiles = false; miles.hidden = false; }); await page.waitForTimeout(500);
  pt = await pointFor('ent', 'miles');
  if (pt) { await page.touchscreen.tap(pt[0], pt[1]); for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#fx .act'))) break; await page.waitForTimeout(200); }
    const bottle = await page.evaluate(() => { const a = [...document.querySelectorAll('#fx .act')].find(n => n.textContent === '🍼'); if (!a) return null; const q = a.getBoundingClientRect(); return [(q.left + q.right) / 2, (q.top + q.bottom) / 2]; });
    if (bottle) { await page.touchscreen.tap(bottle[0], bottle[1]); await page.waitForTimeout(1500); }
    const sc = await snap(); await page.waitForTimeout(500); const sc2 = await snap();
    R.scene = { bottlePressed: !!bottle, busy: sc.busy, target: sc.target, lit: sc2.lit };
  } else R.scene = 'no point for miles';
  console.log('5 scene', JSON.stringify(R.scene));
  // 5a. the nappy: tap Miles (poopy), press 🧷
  await page.waitForTimeout(6000); await goto('living', 260);
  await page.evaluate(() => { miles.spot = 'bouncer'; miles.room = 'living'; miles.x = 300; mommy.holdingMiles = false; miles.hidden = false; miles.poopy = true; G.busy = false; }); await page.waitForTimeout(500);
  pt = await pointFor('ent', 'miles');
  if (pt) { await page.touchscreen.tap(pt[0], pt[1]); for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#fx .act'))) break; await page.waitForTimeout(200); }
    const tgtRing = await snap();
    const pin = await page.evaluate(() => { const a = [...document.querySelectorAll('#fx .act')].find(n => n.textContent === '🧷'); if (!a) return null; const q = a.getBoundingClientRect(); return [(q.left + q.right) / 2, (q.top + q.bottom) / 2]; });
    if (pin) { await page.touchscreen.tap(pin[0], pin[1]); await page.waitForTimeout(1200); }
    const n1 = await snap(); await page.waitForTimeout(500); const n2 = await snap();
    R.nappy = { ringTarget: tgtRing.target, ringLit: tgtRing.lit, pinPressed: !!pin, busy: n1.busy, target: n1.target, lit: n2.lit };
  } else R.nappy = 'no point for miles';
  console.log('5a nappy', JSON.stringify(R.nappy));
  await page.waitForTimeout(6000); await L.quiet(page, 'living');
  // dragging Marina: tap a thing, then drag her before she arrives
  await goto('living', 120);
  let anyId = null; pt = null; for (const id of await page.evaluate(() => PROPS[G.room].filter(p => p.a && p.a !== 'door' && !p.nohit && Math.abs(p.x - marina.x) > 40).map(p => p.id))) { pt = await pointFor('prop', id); if (pt) { anyId = id; break; } }
  R.dragTapped = anyId; console.log('5b tapping', anyId);
  await page.touchscreen.tap(pt[0], pt[1]); await page.waitForTimeout(300);
  const mpt = await page.evaluate(() => Clarity.toClient(marina.x, marina.y - 40));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mpt[0], y: mpt[1] }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mpt[0] + i * 10, y: mpt[1] - i * 4 }] }); await page.waitForTimeout(40); }
  const dr = await snap(); await page.waitForTimeout(400); const dr2 = await snap();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(600);
  R.drag = { busyDuringDrag: dr.busy, targetDuringDrag: dr.target, litDuringDrag: dr2.lit };
  console.log('5b drag', JSON.stringify(R.drag));

  // 6. a long walk in a wide room keeps the glow all the way
  await goto('backyard', 40);
  const far = await page.evaluate(() => { const c = PROPS.backyard.filter(p => p.a && p.a !== 'door' && p.x > marina.x + E.viewW * 0.6 && p.x < E.camX + E.viewW - 10); return c.length ? c[c.length - 1].id : null; });
  if (far) { pt = await pointFor('prop', far); tr = await tapAndWatch(pt, 9000, 150); const w = tr.filter(s => s.moving); R.longWalk = { prop: far, walkS: w.length ? +(w[w.length - 1].t - w[0].t).toFixed(2) : 0, targetAllWalk: w.every(s => s.target === far), trace: tr.map(s => [s.t, s.target, s.moving ? 'm' : '-', s.ringDom ? 'R' : '']).slice(0, 30), ring: tr.some(s => s.ringDom) }; }
  else R.longWalk = 'no far prop in view';
  console.log('6 longWalk', JSON.stringify(R.longWalk));
  R.errors = g.errors; console.log('errors', JSON.stringify(g.errors));
  require('fs').writeFileSync(L.OUT + 'g18_' + view + '.json', JSON.stringify(R, null, 1));
  await g.close();
})();

// G8 functional checks through real touchscreen taps.
const L = require('./lib.js');
const view = process.argv[2] || 'port'; const KX = view.startsWith('port') ? 290 : 230;
(async () => {
  const R = {};
  const g = await L.boot({ port: 8870, view, room: 'kitchen' }); await g.calm();
  const page = g.page;
  const setup = async (room, mx) => { await page.evaluate(r => { if (G.room !== r) travelTo(r); }, room); await page.waitForTimeout(1300); await L.quiet(page, room); await page.evaluate(() => { const b = document.getElementById('stkBox'); if (b) b.remove(); });
    await page.evaluate(([mx]) => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; marina.x = mx; marina.y = FLOOR; marina.stop(); }, [mx]); await page.waitForTimeout(600); let last = null; for (let i = 0; i < 30; i++) { const c = await page.evaluate(() => Math.round(E.camX * 10)); if (c === last) break; last = c; await page.waitForTimeout(150); } };
  // find a canvas-visible world point whose answer (G8 on) is `want` and (G8 off) is `was`
  const find = (want, was, extra) => page.evaluate(([want, was, extra]) => { const nm = h => !h ? '' : h.kind === 'prop' ? h.p.id : h.kind; const cands = [];
    for (let y = 100; y <= 182; y += 1) for (let x = 150; x <= 400; x += 1) { const on = nm(hitTest(x, y)); if (on !== want) continue; Clarity.set('G8', false); const off = nm(hitTest(x, y)); Clarity.set('G8', true); if (was && !(off === was || off.startsWith(was))) continue;
      const [cx, cy] = Clarity.toClient(x, y); if (!Clarity.onCanvas(cx, cy) || !Clarity.onCanvas(cx - 6, cy) || !Clarity.onCanvas(cx + 6, cy) || !Clarity.onCanvas(cx, cy - 6) || !Clarity.onCanvas(cx, cy + 6)) continue; cands.push([x, y]); }
    if (!cands.length) return null; if (extra === 'mid') return cands[Math.floor(cands.length / 2)]; return cands[0]; }, [want, was, extra]);
  const ring = () => page.evaluate(() => [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(' '));
  const pressAct = async ico => { const loc = page.locator('#fx .act', { hasText: ico }).first(); if (!(await loc.count())) { console.log('NO ACT', ico, await ring(), await page.evaluate(() => [G.room, Math.round(marina.x), marina.state, marina.moving, G.busy, Clarity.G18.target && Clarity.G18.target.id])); return; } const b = await loc.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const waitRing = async () => { try { await page.waitForSelector('#fx .act', { timeout: 6000 }); } catch (e) { } await page.waitForTimeout(500); };
  // a) island between the stools
  await setup('kitchen', KX);
  let pt = await find('island', 'stool', 'mid'); R.islandPoint = pt;
  await g.tapWorld(pt[0], pt[1]); await waitRing(); R.islandRing = await ring();
  await g.shot(L.OUT + 'shots/g8f_' + view + '_island_ring.png');
  await pressAct('🧗'); await page.waitForTimeout(3500);
  R.islandClimb = await page.evaluate(() => ({ state: marina.state, top: Math.round(marina.y + marina.offY), perch: marina.perchProp && marina.perchProp.id }));
  await g.shot(L.OUT + 'shots/g8f_' + view + '_island_climbed.png');
  // b) holding a dish: ⬇️ on the island puts it down
  await setup('kitchen', KX);
  await page.evaluate(() => { G.holding = { type: 'dish', dish: { art: 'cake', score: 3, say: [], name: 'x', ings: ['eggs'], method: 'bake' } }; });
  await page.waitForTimeout(300); pt = await find('island', 'stool', 'mid');
  await g.tapWorld(pt[0], pt[1]); await waitRing(); R.islandDishRing = await ring();
  await pressAct('⬇️'); await page.waitForTimeout(800); R.dishAfterDown = await page.evaluate(() => G.holding ? G.holding.type : null);
  // c) a stool's seat still answers as a stool
  await setup('kitchen', KX);
  const seat = await page.evaluate(() => { for (const id of ['stool2', 'stool1', 'stool3']) { const s = PROPS.kitchen.find(p => p.id === id); for (const y of [146, 145, 147, 144, 148]) for (const dx of [0, -2, 2, -4, 4]) { const [cx, cy] = Clarity.toClient(s.x + dx, y); const under = [...document.querySelectorAll('#bookBtn,#dressBtn,#wishBtn,#reqBtn,.navarrow')].some(b => { const r = b.getBoundingClientRect(); return r.width && cx > r.left - 10 && cx < r.right + 10 && cy > r.top - 10 && cy < r.bottom + 10; }); if (!under && Clarity.onCanvas(cx, cy) && Clarity.onCanvas(cx - 8, cy) && Clarity.onCanvas(cx + 8, cy)) return [s.x + dx, y]; } } return null; }); R.seatPoint = seat;
  R.stoolSeatHit = await page.evaluate(([x, y]) => { const h = hitTest(x, y); return h && h.kind === 'prop' ? h.p.id : h && h.kind; }, seat);
  R.seatPre = await page.evaluate(([x, y]) => { const [cx, cy] = Clarity.toClient(x, y); const el = document.elementFromPoint(cx, cy); return [Math.round(cx), Math.round(cy), el && (el.id || el.className), E.camX, marina.x, G.busy]; }, seat);
  await g.tapWorld(seat[0], seat[1]); await waitRing(); R.stoolSeatRing = await ring(); R.seatPost = await page.evaluate(() => [G.room, marina.x, marina.state, marina.moving, G.busy, !!document.getElementById('stkBox'), document.getElementById('panel').className]);
  // d) rocker
  await setup('playroom', view === 'portSmall' ? 224 : 262);
  pt = await find('rocker', 'toyshelf', 'mid'); R.rockerPoint = pt; if (!pt) { console.log('DBG', await page.evaluate(() => [G.room, E.camX, marina.x, marina.state, marina.moving, document.querySelectorAll('#fx .act').length])); await g.shot(L.OUT + 'shots/dbg_g8f.png'); }
  await g.tapWorld(pt[0], pt[1]); await waitRing(); R.rockerRing = await ring();
  await g.shot(L.OUT + 'shots/g8f_' + view + '_rocker_ring.png');
  await pressAct('🪑'); await page.waitForTimeout(2500); R.rockerSit = await page.evaluate(() => ({ state: marina.state, x: Math.round(marina.x) }));
  // e) shelf (a drawn shelf pixel)
  await setup('playroom', view === 'portSmall' ? 224 : 262);
  pt = await page.evaluate(() => { const s = PROPS.playroom.find(p => p.id === 'toyshelf'), c = spriteCanvas(s.k), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let y = s.y - 30; y > s.y - 60; y--) for (let x = s.x - 10; x <= s.x + 12; x++) { const px = Math.floor(x - s.x + c.width / 2), py = Math.floor(y - s.y + c.height); if (d[(py * c.width + px) * 4 + 3] <= 20) continue; const h = hitTest(x, y); const [cx, cy] = Clarity.toClient(x, y); if (h && h.kind === 'prop' && h.p.id === 'toyshelf' && Clarity.onCanvas(cx, cy)) return [x, y]; } return null; });
  R.shelfHit = await page.evaluate(([x, y]) => { const h = hitTest(x, y); return h && h.kind === 'prop' ? h.p.id : h && h.kind; }, pt);
  await g.tapWorld(pt[0], pt[1]); await waitRing(); R.shelfRing = await ring();
  // f) tidy mode: a mess item on the island still hits first;  g) a person in front still wins
  await setup('kitchen', KX); pt = await find('island', 'stool', 'mid');
  R.tidyFirst = await page.evaluate(([x, y]) => { G.tidy = true; G.mess.push({ room: 'kitchen', x, y: y + 6, toy: '🧸', key: null }); const h = hitTest(x, y); G.tidy = false; G.mess = []; return h && h.kind; }, pt);
  R.personFirst = await page.evaluate(([x, y]) => { daddy.room = 'kitchen'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = x; daddy.y = FLOOR + 4; const h = hitTest(x, y); daddy.room = 'yard'; return h && (h.kind === 'ent' ? 'ent:' + h.e.id : h.kind); }, pt);
  R.errors = g.errors;
  console.log(view, JSON.stringify(R, null, 1));
  require('fs').writeFileSync(L.OUT + 'g8func_' + view + '.json', JSON.stringify(R, null, 1));
  await g.close();
})();

const L = require('./lib.js'), INSTR = require('./instr.js');
(async () => {
  const g = await L.boot({ port: 8860, view: 'land', room: 'living' }); await g.calm(); await g.page.evaluate(INSTR);
  // an earlier 😢 scene from the bar first
  await g.page.evaluate(() => { for (const e of [daddy, mommy]) { e.room = G.room; e.hidden = false; e.here = true; e.state = 'idle'; e.x = clamp(marina.x + (e === daddy ? 44 : -44), 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); } document.getElementById('moodbar').classList.remove('collapsed'); });
  await g.page.waitForTimeout(700); await g.tap('.mood[data-mood=sad]');
  for (let i = 0; i < 160 && await g.page.evaluate(() => G.busy || G.sceneOn); i++) await g.page.waitForTimeout(250);
  await g.calm(); await g.page.evaluate(() => { daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.x = clamp(marina.x + 44, 20, ROOMS[G.room].w - 20); daddy.y = marina.y; AI.hold(daddy, true); });
  await g.page.waitForTimeout(700);
  const pt = await g.page.evaluate(() => { const [sx, sy] = Clarity.toClient(daddy.x, daddy.y - 40); return [sx, sy, document.elementFromPoint(sx, sy) && document.elementFromPoint(sx, sy).id]; });
  console.log('daddy at', JSON.stringify(pt));
  await g.page.touchscreen.tap(pt[0], pt[1]); await g.page.waitForTimeout(600);
  let acts = await g.page.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent));
  console.log('ring after tap', JSON.stringify(acts));
  let r = await g.page.evaluate(() => { const n = [...document.querySelectorAll('.act')].find(n => n.textContent.includes('😜')); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  if (!r) { console.log('no 😜 in the ring; entActions icons', await g.page.evaluate(() => entActions(daddy).map(a => a.ico).join(' '))); }
  else await g.page.touchscreen.tap(r[0], r[1]);
  const samples = []; const t0 = Date.now();
  while (Date.now() - t0 < 25000) { const s = await g.page.evaluate(() => __T.snap()); samples.push(s); if (!s.busy && samples.length > 3) break; await g.page.waitForTimeout(150); }
  const busy = samples.filter(s => s.busy), dim = busy.filter(s => /cm-mood/.test(s.app));
  console.log('joke land: busy', busy.length, 'scene', busy.filter(s => s.scene).length, 'dimmed', dim.length, 'awake', JSON.stringify([...new Set(busy.flatMap(s => s.awake))]), 'cur', JSON.stringify([...new Set(busy.map(s => s.cur))]),
    'mood opacities when dimmed', JSON.stringify([...new Set(dim.flatMap(s => Object.values(s.moods)))]), 'faces', JSON.stringify([...new Set(busy.flatMap(s => s.faces.map(f => f.who + ' ' + f.o + ' ' + f.f)))]));
  console.log('errors', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e)))); await g.close();
})().catch(e => { console.error(e); process.exit(1); });

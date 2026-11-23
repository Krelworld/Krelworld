// G18: a long walk (> 5 s) across the backyard keeps the target lit all the way (interact called as onTap would, for a far prop).
const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8870, view: process.argv[2] || 'land', room: 'backyard' }); await g.calm(); const page = g.page;
  await L.quiet(page, 'backyard'); await page.evaluate(() => { for (const e of ENTS) if (e !== marina && e.room === G.room && !e.wild) e.room = 'yard'; marina.stop(); marina.x = 40; marina.state = 'idle'; try { Wildlife.calm(); } catch (e) { } });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__log = []; let last = ''; const f = () => { const S = Clarity.G18, k = (S.target ? S.target.id : '-') + '|' + ((marina.mount || marina).moving ? 'm' : '-') + '|' + document.querySelectorAll('#fx .act').length; if (k !== last) { last = k; __log.push([+E.t.toFixed(2), k, Math.round(marina.x)]); } requestAnimationFrame(f); }; requestAnimationFrame(f);
    window.__glow = []; const p = PROPS.backyard.find(q => q.id === 'bench'); window.__p = p; setInterval(() => __glow.push(+(p.glow || 0).toFixed(2)), 500);
    const p2 = PROPS.backyard.find(q => q.id === 'bench'); onTap.call(null, ...(() => { const [sx, sy] = toScreen(p2.x, p2.y - 10); return [sx, sy]; })()); });
  // the bench is off-screen to the right at the start; onTap with its screen coords would not hit it, so call interact as onTap does
  await page.evaluate(() => { UI.closeActions(); const p = PROPS.backyard.find(q => q.a === 'bigtree' && q.tree === 'pine'); window.__far = p.id; interact({ kind: 'prop', p }, p.x, p.y - 20); });
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => !(marina.mount || marina).moving && E.t > 0)) { await page.waitForTimeout(1500); break; } }
  const r = await page.evaluate(() => { const fp = PROPS.backyard.find(q => q.id === __far); return { far: __far, log: __log, farGlowEnd: +(fp.glow || 0).toFixed(2) }; });
  const walk = r.log.filter(x => x[1].includes('|m|'));
  console.log(JSON.stringify(r)); console.log('walk seconds', walk.length ? (r.log[r.log.findIndex(x => !x[1].includes('|m|') && x[0] > walk[0][0])] || [0])[0] - walk[0][0] : 0, 'errors', JSON.stringify(g.errors));
  await g.shot(L.OUT + 'shots/g18_long_end.png'); await g.close();
})();

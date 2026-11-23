const L = require('./lib.js'), INSTR = require('./instr.js');
const off = process.argv[2] === 'off' ? 'G15' : '';
(async () => {
  const g = await L.boot({ port: 8860, view: 'port', room: 'living', off }); await g.calm(); await g.page.evaluate(INSTR);
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
  const res = [];
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 160 && await ev(() => G.busy || G.sceneOn); i++) await wait(250);
    await g.calm(); await ev(() => { G.moodCtx = null; for (const e of [daddy, mommy]) { e.room = G.room; e.hidden = false; e.state = 'idle'; e.x = clamp(marina.x + (e === daddy ? 44 : -44), 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); } });
    await wait(300); const c = await ev(() => { const b = document.querySelector('.mood[data-mood=love]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await P.touchscreen.tap(c[0], c[1]); await wait(300);
    if (!(await ev(() => G.sceneOn))) { res.push('no scene'); continue; }
    await ev(() => askRequest('cook')); await wait(60);
    const r = await ev(() => { const n = document.getElementById('reqBtn'); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    if (!r) { res.push('gone'); continue; }
    const t = await ev(() => performance.now()); await P.touchscreen.tap(r[0], r[1]); await wait(40);
    const s = await ev(t => ({ req: !!document.getElementById('reqBtn'), room: G.room, busy: !!G.busy, scene: !!G.sceneOn, x: __T.since(t) }), t);
    res.push({ reqStill: s.req, room: s.room, busy: s.busy, scene: s.scene, shakes: s.x.shakes.length, nope: s.x.nope, jingle: s.x.blips.length });
  }
  console.log(off || 'on', JSON.stringify(res), 'errors', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e)))); await g.close();
})().catch(e => { console.error(e); process.exit(1); });

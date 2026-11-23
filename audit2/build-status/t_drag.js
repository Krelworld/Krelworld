// dragging Marina and swiping rooms with real touch sequences (CDP), on vs off
const L = require('./lib.js');
const view = process.argv[2] || 'port', off = process.argv[3] === 'off' ? 'G15,G23,G24' : '';
(async () => {
  const g = await L.boot({ port: 8860, view, room: 'kitchen', off }); await g.calm();
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
  const cdp = await g.ctx.newCDPSession(P); const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const gesture = async (x0, y0, dx, dy, n = 10) => { await T('touchStart', [{ x: x0, y: y0 }]); for (let k = 1; k <= n; k++) { await T('touchMove', [{ x: x0 + dx * k / n, y: y0 + dy * k / n }]); await wait(25); } await T('touchEnd', []); };
  const res = {};
  for (let i = 0; i < 2; i++) {
    await g.calm(); await ev(() => { for (const e of [daddy, mommy, rory]) if (e.room === G.room) e.x = 20; marina.x = 150; marina.state = 'idle'; marina.offY = 0; marina.stop && marina.stop(); }); await wait(600);
    const hit = await ev(() => { const b = visBox(mBase()); const [cx, cy] = Clarity.toClient(marina.x + (b[0] + b[2]) / 2, marina.y + (b[1] + b[3]) / 2); return { c: [cx, cy], scale: E.cssScale }; });
    await gesture(hit.c[0], hit.c[1], 70, 0); await wait(900);
    res['drag' + i] = await ev(() => ({ x: Math.round(marina.x), state: marina.state, busy: !!G.busy, room: G.room }));
  }
  await g.calm(); const sw = await ev(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.left + r.width * 0.75, r.top + r.height * 0.2]; });
  await gesture(sw[0], sw[1], -160, 0); await wait(2500); res.swipeLeft = await ev(() => ({ room: G.room, expect: ROOMS.kitchen.right }));
  res.errors = g.errors.filter(e => !/chip_love/.test(e));
  console.log(view, off ? 'off' : 'on', JSON.stringify(res)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });

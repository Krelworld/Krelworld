// redo: alert during a non-scene busy moment (joke), and drag Marina / swipe rooms with real pointer moves, on vs off
const L = require('./lib.js'), INSTR = require('./instr.js');
const view = process.argv[2] || 'land', off = process.argv[3] === 'off' ? 'G15,G23,G24' : '';
(async () => {
  const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm(); await g.page.evaluate(INSTR);
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms), tag = view + ' ' + (off ? 'off' : 'on');
  const R = {};
  for (let attempt = 0; attempt < 4 && !R.alertNonScene; attempt++) {
    for (let i = 0; i < 120 && await ev(() => G.busy || G.sceneOn); i++) await wait(250); await g.calm();
    await ev(() => { UI.closeActions(); for (const e of [daddy]) { e.room = G.room; e.hidden = false; e.state = 'idle'; e.stop && e.stop(); e.x = clamp(marina.x + 50, 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); } G.holding = { type: 'pic', url: 'x.png' }; }); await wait(700);
    const d = await ev(() => Clarity.toClient(daddy.x, daddy.y - 40)); await P.touchscreen.tap(d[0], d[1]); await wait(700);
    const jk = await ev(() => { const n = [...document.querySelectorAll('.act')].find(n => n.textContent.includes('😜')); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    if (!jk) continue; await P.touchscreen.tap(jk[0], jk[1]); await wait(1000);
    const st = await ev(() => ({ busy: !!G.busy, scene: !!G.sceneOn, app: document.getElementById('app').className, alert: (() => { const n = document.querySelector('#alerts .alertb[aria-label=picgive]'); return n ? getComputedStyle(n).opacity : null; })() }));
    if (!st.busy || st.scene || !st.alert) continue;
    const c = await ev(() => { const b = document.querySelector('#alerts .alertb[aria-label=picgive]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    const t = await ev(() => performance.now()); await P.touchscreen.tap(c[0], c[1]); await wait(700); const s = await ev(t => __T.since(t), t);
    R.alertNonScene = { during: st, shakes: s.shakes.length, nope: s.nope, after: await ev(() => ({ busy: !!G.busy, acts: [...document.querySelectorAll('.act')].map(n => n.textContent).join('') })) };
  }
  console.log(tag, 'alertNonScene', JSON.stringify(R.alertNonScene || 'joke never started'));
  await ev(() => { UI.closeActions(); G.holding = null; }); for (let i = 0; i < 120 && await ev(() => G.busy || G.sceneOn); i++) await wait(250); await g.calm();
  // drag Marina 30 world units to the right with the mouse pointer (pointer events, same handlers as touch)
  const p0 = await ev(() => { daddy.x = 40; mommy.x = 40; marina.x = 150; marina.state = 'idle'; return Clarity.toClient(150, marina.y - 30); }); await wait(500);
  const p1 = await ev(() => Clarity.toClient(190, marina.y - 30));
  await P.mouse.move(p0[0], p0[1]); await P.mouse.down(); for (let k = 1; k <= 10; k++) { await P.mouse.move(p0[0] + (p1[0] - p0[0]) * k / 10, p0[1]); await wait(30); } await P.mouse.up(); await wait(800);
  R.drag = await ev(() => ({ x: Math.round(marina.x), state: marina.state, busy: !!G.busy, room: G.room }));
  // swipe right-to-left on empty floor: goes to the room on the right
  const sw = await ev(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.left + r.width * 0.8, r.top + r.height * 0.25]; });
  await P.mouse.move(sw[0], sw[1]); await P.mouse.down(); for (let k = 1; k <= 10; k++) { await P.mouse.move(sw[0] - k * 15, sw[1] + 2); await wait(25); } await P.mouse.up(); await wait(2500);
  R.swipe = await ev(() => ({ room: G.room, right: ROOMS.living.right }));
  console.log(tag, 'drag', JSON.stringify(R.drag), 'swipe', JSON.stringify(R.swipe), 'errors', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
  require('fs').writeFileSync(L.OUT + 'misc2_' + view + (off ? '_off' : '') + '.json', JSON.stringify(R, null, 1)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });

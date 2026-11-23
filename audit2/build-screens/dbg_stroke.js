const { boot } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => {
  const g = await boot({ port: 8910, view: 'land', room: 'dining' }); await g.calm(); await g.ev(TLIB);
  const r = await g.ev(async () => { await T.reset(); UI.openCrafts('math'); await T.sleep(60); T.tab('#panel .pbody > .row .pbtn', 0); await T.sleep(400); const c = document.getElementById('drawCv'); window.__ev = []; for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) c.addEventListener(t, e => __ev.push(t + ':' + e.pointerType)); const r = c.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, c.width, c.height]; });
  console.log('rect', r);
  const [x0, y0] = [r[2] - 30, r[3] - 14];
  console.log('at', JSON.stringify(await g.at(x0, y0)));
  await g.page.mouse.move(x0, y0); await g.page.mouse.down(); await g.page.mouse.move(x0 + 10, y0 + 4); await g.page.mouse.move(x0 + 20, y0 + 8); await g.page.mouse.up();
  console.log(await g.ev(() => __ev.slice(0, 10)));
  // CDP touch drag instead
  const s = await g.ctx.newCDPSession(g.page);
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0 - 100, y: y0 }] });
  for (let i = 1; i <= 5; i++) await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - 100 + i * 10, y: y0 + i }] });
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await g.wait(100);
  console.log(await g.ev(() => __ev.slice(0, 20)));
  await g.close();
})();

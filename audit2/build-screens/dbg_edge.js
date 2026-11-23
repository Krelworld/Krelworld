const { boot } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { const g = await boot({ port: 8910, view: 'land', room: 'dining' }); await g.calm(); await g.ev(TLIB);
  const p = await g.ev(async () => { Studio.open(); await T.sleep(400); window.__e = []; const fx = document.querySelector('#studio .l-fx'); for (const t of ['pointerdown', 'pointermove', 'pointerup']) fx.addEventListener(t, e => __e.push(t)); const r = document.querySelector('#studio .s-paper').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  const sx = p[0] + 1, sy = p[3] - 2; console.log('paper', p, 'start', sx, sy, JSON.stringify(await g.at(sx, sy)));
  await g.page.mouse.move(sx, sy); await g.page.mouse.down(); for (let i = 1; i <= 8; i++) await g.page.mouse.move(sx + i * 6, sy - i * 3); await g.page.mouse.up(); await g.wait(150);
  console.log(await g.ev(() => { const c = document.querySelector('#studio .l-paint'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, minx = 1e9, maxy = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { n++; const x = (i / 4) % c.width, y = (i / 4 / c.width) | 0; minx = Math.min(minx, x); maxy = Math.max(maxy, y); } return { ev: __e.slice(0, 5).join(','), inked: n, minx, maxy, W: c.width, H: c.height, active: Studio.active }; }));
  await g.close(); })();

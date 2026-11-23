const { boot } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { for (const room of ['den', 'living']) { const g = await boot({ port: 8910, view: 'landSmall', room, off: 'G12' }); await g.calm(); await g.ev(TLIB);
  const r = await g.ev(async () => { await T.reset(); Bricks.open({ kind: 'lego' }); await T.sleep(600); const s = document.querySelector('.bk-side'), t = document.querySelector('.bk-tools'), sr = s.getBoundingClientRect(), tr = t.getBoundingClientRect(); return { narrow: s.classList.contains('bk-narrow'), side: [sr.left, sr.top, sr.right, sr.bottom].map(Math.round), tools: [tr.left, tr.top, tr.right, tr.bottom].map(Math.round), bg: getComputedStyle(s).backgroundColor, tbg: getComputedStyle(t).backgroundColor }; });
  console.log(room, JSON.stringify(r)); await g.shot('g12_color_' + room);
  // sample pixels: gaps between buttons in the side column
  const buf = await g.page.screenshot(); const { PNG } = (() => { try { return require('pngjs'); } catch (e) { return {}; } })();
  if (PNG) { const p = PNG.sync.read(buf); const px = (x, y) => { const i = (y * p.width + x) * 4; return '#' + [0, 1, 2].map(k => p.data[i + k].toString(16).padStart(2, '0')).join(''); };
    const out = []; for (const [x, y] of [[r.side[0] + 2, r.side[1] + 2], [r.side[2] - 2, r.side[1] + 3], [r.side[2] - 3, r.side[3] - 3], [r.side[0] + 3, r.side[3] - 2], [r.side[0] + 1, (r.side[1] + r.side[3]) >> 1]]) out.push(px(x, y)); console.log(room, 'pixels', out.join(' ')); } else console.log('no pngjs');
  await g.close(); } })();

const { boot, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { const g = await boot({ port: 8910, view: 'landSmall', room: 'den' }); await g.calm(); await g.ev(TLIB);
  const xy = await g.ev(async () => { await T.reset(); window.__r = {}; Bricks.open({ kind: 'lego', onDone: r => { __r.done = r; }, onClose: r => { __r.closed = r; } }); await T.sleep(400); Bricks.help(3); Bricks.help(4); await T.sleep(800);
    const s = document.querySelector('.bk-side'); s.scrollTop = 0; const d = document.querySelector('.bk-tools [aria-label=done]').getBoundingClientRect(); return [d.left + d.width / 2, d.top + d.height / 2]; });
  await g.tapXY(xy[0], xy[1]); await g.wait(500);
  console.log(JSON.stringify(await g.ev(() => ({ onDone: __r.done || null, onClose: __r.closed || null, open: Bricks.active }))), realErrors(g.errors));
  await g.close(); })();

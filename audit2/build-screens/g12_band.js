const { boot } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { const g = await boot({ port: 8910, view: 'landSmall', room: 'den' }); await g.calm(); await g.ev(TLIB);
  const m = () => g.ev(() => { const s = document.querySelector('.bk-side'), t = document.querySelector('.bk-tools'), d = t.querySelector('[aria-label=done]'), R = n => { const r = n.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }; return { side: R(s), band: R(t), done: R(d), sh: s.scrollHeight }; });
  await g.ev(async () => { await T.reset(); Bricks.open({ kind: 'lego' }); await T.sleep(500); });
  console.log('rest', JSON.stringify(await m()));
  await g.ev(() => { const s = document.querySelector('.bk-side'); s.scrollTop = s.scrollHeight; }); await g.wait(50); console.log('end', JSON.stringify(await m()));
  await g.close(); })();

const { boot } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { for (const room of ['den', 'living', 'backyard']) { const g = await boot({ port: 8910, view: 'landSmall', room, off: 'G12' }); await g.calm(); await g.ev(TLIB);
  const r = await g.ev(async () => { await T.reset(); Bricks.open({ kind: 'lego' }); await T.sleep(600); const s = document.querySelector('.bk-side'), sr = s.getBoundingClientRect(); return [sr.left, sr.top, sr.right, sr.bottom].map(Math.round); });
  const b64 = (await g.page.screenshot()).toString('base64');
  const px = await g.ev(async ([b64, s]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const hex = (X, Y) => { const d = x.getImageData(X, Y, 1, 1).data; return '#' + [0, 1, 2].map(k => d[k].toString(16).padStart(2, '0')).join(''); };
    return [[s[0] + 1, s[1] + 1], [s[2] - 2, s[1] + 2], [s[2] - 2, s[3] - 2], [s[0] + 1, s[3] - 1], [s[0] + 1, (s[1] + s[3]) >> 1], [s[2] - 1, (s[1] + s[3]) >> 1]].map(([X, Y]) => hex(X, Y)); }, [b64, r]);
  console.log(room, r, px.join(' ')); await g.close(); } })();

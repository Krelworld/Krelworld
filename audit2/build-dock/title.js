const L = require('./lib.js');
(async () => { for (const off of [undefined, 'G16']) { const g = await L.boot({ port: 8896, view: 'port', start: false, off }); await g.wait(1500);
  const r = await g.ev(() => ['dressBtn', 'bookBtn'].map(id => { const n = document.getElementById(id), b = n.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return id + ' off=' + n.classList.contains('off') + ' top=' + (t && (t.id || t.className)); }).join(' | '));
  await g.shot(L.OUT + 'shots/title_port' + (off ? '_noG16' : '') + '.png'); console.log(off || 'on', r, g.errs()); await g.close(); } })();

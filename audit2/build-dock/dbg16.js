const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8890, view: 'port', room: 'kitchen', settle: 300 });
  await g.ev(() => { window.__log = []; const t0 = performance.now(); const log = s => __log.push(Math.round(performance.now() - t0) + ' ' + s);
    for (const id of ['dressBtn', 'bookBtn', 'stopBtn']) { const el = document.getElementById(id); new MutationObserver(() => log(id + ' ' + el.className + ' anims=' + el.getAnimations().length + ' pe=' + el.style.pointerEvents)).observe(el, { attributes: true, attributeFilter: ['class'] }); }
    setInterval(() => log('state ' + marina.state + ' moving=' + marina.moving + ' busy=' + G.busy + ' title=' + !document.getElementById('title').classList.contains('hidden')), 1000);
  });
  await g.wait(9000);
  console.log((await g.ev(() => __log)).join('\n'));
  console.log(await g.ev(() => JSON.stringify(Clarity.G16.glides)), g.errs());
  await g.close();
})().catch(e => { console.error(e); process.exit(1); });

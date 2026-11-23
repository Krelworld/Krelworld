const { boot, realErrors } = require('./boot.js');
(async () => {
  for (const view of ['land', 'port']) {
    const g = await boot({ port: 8910, view, room: 'kitchen' });
    await g.calm();
    const r = await g.ev(() => ({ core: Clarity.core, on: Clarity.on.G3, ready: Clarity.ready, G3: Clarity.G3, css: [...document.querySelectorAll('style[data-clarity]')].map(s => s.dataset.clarity + ':' + (s.media || '')) }));
    console.log(view, JSON.stringify(r));
    await g.ev(() => UI.openCook('fridge')); await g.wait(400);
    console.log(view, 'cook', JSON.stringify(await g.ev(() => ({ G3: Clarity.G3, lane: document.getElementById('panel').className, x: document.getElementById('xFloat').textContent, xon: document.body.classList.contains('cm-xon'), pad: getComputedStyle(document.getElementById('panel')).paddingLeft }))));
    await g.shot('smoke_' + view + '_cook');
    console.log('errors', realErrors(g.errors));
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

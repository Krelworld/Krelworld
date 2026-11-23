const L = require('./lib.js');
(async () => {
  for (const off of ['', 'G15,G23,G24']) for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ port: 8860, view, room: 'kitchen', off });
    await g.calm(); await g.page.waitForTimeout(1500);
    const s = await g.page.evaluate(() => ({ on: ['G15', 'G23', 'G24'].map(id => Clarity.is(id)), css: [...document.querySelectorAll('style[data-clarity]')].filter(s => /G15|G23|G24/.test(s.dataset.clarity)).map(s => s.dataset.clarity + ':' + (s.media || 'on')), g23: !!Clarity.G23, app: document.getElementById('app').className }));
    await g.shot(L.OUT + 'shots/smoke_' + (off ? 'off_' : 'on_') + view + '.png');
    console.log(off || 'all-on', view, JSON.stringify(s), 'errors:', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e))));
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

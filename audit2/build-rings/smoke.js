const L = require('./lib.js');
(async () => {
  const views = (process.argv[2] || 'port,land,portSmall,landSmall').split(',');
  for (const view of views) {
    const g = await L.boot({ port: 8870, view, room: 'kitchen' });
    await g.calm();
    const info = await g.page.evaluate(() => ({ core: Clarity.core, ready: Clarity.ready, on: ['G6','G7','G8','G11','G18','G30'].map(id => id + ':' + Clarity.is(id)).join(' '), g18: !!Clarity.G18, styles: [...document.querySelectorAll('style[data-clarity]')].map(s => s.dataset.clarity + (s.media ? '(' + s.media + ')' : '')).join(' ') }));
    await g.page.waitForTimeout(3000);
    await g.shot(L.OUT + 'shots/smoke_' + view + (L.off ? '_off' : '') + '.png');
    console.log(view, 'off=' + L.off, JSON.stringify(info), 'errors:', JSON.stringify(g.errors));
    await g.close();
  }
})();

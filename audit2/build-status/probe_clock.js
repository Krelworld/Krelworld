const { clockBoot } = require('./clockboot.js');
(async () => {
  const g = await clockBoot({ view: 'port', room: 'kitchen' });
  await g.page.evaluate(() => { window.render = function () { }; }); const t0 = Date.now(), e0 = await g.page.evaluate(() => E.t);
  await g.page.clock.runFor(30000);
  console.log('30 s fake took', Date.now() - t0, 'ms real; E.t advanced', (await g.page.evaluate(() => E.t)) - e0, 'room', await g.page.evaluate(() => G.room), 'errors', JSON.stringify(g.errors));
  await g.close();
})().catch(e => { console.error(e); process.exit(1); });

const { boot, OUT, MINE, R } = require('./lib.js');
(async () => {
  for (const view of ['land', 'landSmall', 'port', 'portSmall']) for (const off of [MINE, '']) {
    const g = await boot({ view, room: 'kitchen', off });
    await g.calm(); await g.page.waitForTimeout(500);
    const r = await R(g.page, ['#stage', '#moodbar', '#moodToggle', '#roombar', '.navarrow.r', '.navarrow.l', '#dressBtn', '#bookBtn', '#weatherBtn', '#alerts', '#mapBtn', '#stopBtn']);
    const e = await g.page.evaluate(() => ({ viewW: +E.viewW.toFixed(1), cs: +E.cssScale.toFixed(3), cvw: E.cv.width, camX: +E.camX.toFixed(1), on: Clarity.on.G19 }));
    console.log(view, off ? 'OFF' : 'ON ', JSON.stringify(e), JSON.stringify(r));
    await g.shot(OUT + 'shots/first_' + view + (off ? '_off' : '_on') + '.png');
    console.log('errors', g.errors);
    await g.close();
  }
})();

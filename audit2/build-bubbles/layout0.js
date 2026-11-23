// look at the HUD layout per view (before building anything)
const L = require('./lib.js');
(async () => {
  for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ view, room: 'living' }); await g.calm();
    const r = await g.page.evaluate(() => {
      const st = document.getElementById('stage').getBoundingClientRect(), rb = document.getElementById('roombar').getBoundingClientRect();
      const f = r => [r[0], r[1], r[2], r[3]].map(Math.round);
      return { stage: [st.left, st.top, st.width, st.height].map(Math.round), roombar: f([rb.left - st.left, rb.top - st.top, rb.right - st.left, rb.bottom - st.top]),
        hud: Clarity.hudRects(null, { fresh: true }).map(h => h[2] + ':' + f(h[0]).join(',')), daddy: [daddy.room, daddy.x, daddy.y], mommy: [mommy.room, mommy.x, mommy.y], cam: E.camX, cs: E.cssScale, offY: E.cssOffY };
    });
    console.log(view, JSON.stringify(r));
    await g.shot(L.OUT + 'layout0_' + view + '.png');
    console.log(L.real(g.errors)); await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

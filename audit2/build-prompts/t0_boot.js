// T0: boot in 4 views with all switches on, and with my switches off; page errors; my hooks registered and live.
const L = require('./lib.js'); const fs = require('fs');
(async () => {
  const res = {};
  for (const off of ['', L.MINE]) for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ port: 8850, view, room: view.length % 2 ? 'living' : 'kitchen', off });
    await g.calm();
    const r = await g.ev(() => {
      const C = Clarity;
      return { ready: C.ready, on: ['G1', 'G2', 'G20', 'G21', 'G28', 'G29'].map(id => id + ':' + C.is(id)).join(' '), G21: !!C.G21, G2: !!C.G2,
        checkMess: checkMess.clarity, oerb: onEnterRoomBy.clarity, ua: UI.actions.clarity };
    });
    // a little play: open + close cooking, the studio and a story; walk; a ring; the map
    await g.ev(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      UI.openCook('fridge'); await w(500); UI.closePanel(); await w(400);
      Studio.open(); await w(500); Studio.close && Studio.close(); await w(400);
      openStory(); await w(500); const x = document.querySelector('#storyBox .st-x'); if (x) x.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await w(400);
      UI.actions(marina, selfActions()); await w(300); openIsoMap(); await w(500); UI.closePanel(); await w(300); UI.closeActions();
      travelTo('dining'); await w(1500); });
    await g.tapWorld(150, 168); await g.page.waitForTimeout(1500);
    await g.shot('t0_' + (off ? 'off' : 'on') + '_' + view);
    res[(off ? 'off ' : 'on ') + view] = { ...r, errors: L.errs(g) };
    await g.close();
  }
  console.log(JSON.stringify(res, null, 1));
  fs.writeFileSync(L.OUT + 't0_boot.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

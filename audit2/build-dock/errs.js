// zero page errors in port, land, portSmall, landSmall with all switches on, and with the dock's switches off
const L = require('./lib.js');
(async () => {
  for (const off of [undefined, 'G16,G25,G27,G31']) for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ port: 8897, view, room: 'living', off }); await g.calm();
    await g.ev(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      showWish('fort'); await w(400); clearWish(); daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 80; askRequest('story'); await w(500);
      award('swim'); await w(300); UI.openCook('fridge'); award('deer'); await w(300); UI.closePanel(); await w(600);
      G.holding = { type: 'tp' }; await w(400); G.holding = null; marina.state = 'idle'; await w(2200);
      const p = PROPS[G.room][0]; UI.actions(p, propActions(p)); UI.bigIcon('💎✨', 1300); await w(300); UI.closeActions(); await w(300);
      travelTo('kitchen'); await w(1500); Floors.go(-1); await w(2000); Floors.go(1); await w(1500); });
    await g.wait(5000);
    console.log(off ? 'off ' : 'on  ', view, JSON.stringify(g.errs()), g.errors.length - g.errs().length, 'chip_love');
    await g.shot(L.OUT + 'shots/errs_' + (off ? 'off_' : 'on_') + view + '.png'); await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

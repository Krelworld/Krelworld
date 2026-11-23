// Page errors in port, land, portSmall, landSmall: all switches on, and with this worker's switches off.
const { boot, OUT, TH, VIEWS } = require('./lib.js'); const fs = require('fs');
(async () => {
  const R = {};
  for (const off of ['', 'G35,G36,G37,G38,G39']) for (const view of VIEWS) {
    const g = await boot({ view, room: 'kitchen', off, storage: { cm_builds: TH } }); await g.calm();
    for (const room of ['foyer', 'den', 'backyard', 'treehouse_oak', 'treehouse_pine', 'bathroom', 'uphall', 'spa', 'pool', 'living', 'kitchen']) {
      await g.go(room, 1600); await g.ev(() => { marina.x = ROOMS[G.room].w - 30; }); await g.wait(900);
      await g.ev(() => openIsoMap()); await g.wait(400); await g.ev(() => document.querySelector('#panel .ptop button').click()); await g.wait(200);
    }
    await g.ev(() => { Floors.go(1); }); await g.wait(1500); await g.ev(() => { Floors.go(-1); }); await g.wait(1500);
    R[(off ? 'off' : 'on') + ' ' + view] = { errors: g.realErrors(), on: await g.ev(() => ['G35', 'G36', 'G37', 'G38', 'G39'].map(id => id + ':' + Clarity.is(id)).join(' ')) };
    await g.close();
  }
  fs.writeFileSync(OUT + 'errors_check.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });

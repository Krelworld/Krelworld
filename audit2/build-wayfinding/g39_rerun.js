const { boot, OUT, TH } = require('./lib.js');
(async () => {
  for (const mode of ['on', 'off', 'on', 'off']) {
    const g = await boot({ view: 'port', room: 'kitchen', off: mode === 'off' ? 'G39' : '' }); await g.calm();
    const out = [];
    for (let i = 0; i < 2; i++) {
      await g.go('uphall', 1600); await g.ev(() => askRequest('cook')); await g.wait(900); await g.tap('#reqBtn'); await g.wait(3000);
      out.push('req→' + await g.ev(() => G.room + '@' + Math.round(marina.x) + (document.getElementById('panel').classList.contains('hidden') ? '' : '+panel')));
      await g.ev(() => { UI.closePanel(); G.busy = false; }); await g.wait(500);
      await g.go('kitchen', 1200); await g.ev(() => { marina.x = 300; }); await g.wait(1500);
      const arrow = await g.ev(() => document.querySelector('.navarrow.r').className);
      await g.tap('.navarrow.r'); await g.wait(1800); out.push('arrow(' + arrow + ')→' + await g.ev(() => G.room + '@' + Math.round(marina.x)));
    }
    console.log(mode, out.join('  '), g.realErrors());
    await g.close();
  }
})();

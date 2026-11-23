const L = require('./lib.js');
(async () => {
  const g = await L.boot({ view: 'port', room: 'living' }); await g.calm();
  console.log(await g.page.evaluate(() => {
    const o = {}; for (const k of ['daddy', 'mommy', 'rory', 'nunu', 'jeff', 'daddy_lie', 'mommy_sit']) o[k] = visBox(k);
    o.states = { nunu: nunu.state, jeff: jeff.state }; o.keys = Object.keys(E.A).filter(k => /^(nunu|jeff)/.test(k)).slice(0, 60);
    o.pichintSize = null; return JSON.stringify(o);
  }));
  console.log(L.real(g.errors)); await g.close();
})();

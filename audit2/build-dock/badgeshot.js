const L = require('./lib.js');
(async () => { for (const v of ['land', 'port']) { const g = await L.boot({ port: 8894, view: L.viewOf(v), room: 'kitchen' }); await g.calm();
  await g.ev(() => { G.holding = { type: 'tp' }; miles.crying = false; miles.cryT = 999; daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 120; daddy.state = 'idle'; askRequest('story'); }); await g.wait(900);
  const r = await g.ev(() => { const s = document.getElementById('stopBtn').getBoundingClientRect(); return { x: Math.max(0, s.left - 10), y: Math.max(0, s.top - 60), width: 260, height: 140 }; });
  await g.shot(L.OUT + 'shots/g25_badge_' + v + '.png', v === 'land' ? r : { x: 100, y: 440, width: 200, height: 200 }); await g.close(); } })();

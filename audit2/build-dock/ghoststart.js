const L = require('./lib.js');
(async () => { for (const [v, ins] of [['port'], ['port', { top: 59, bottom: 34, left: 0, right: 0 }], ['portSmall']]) { const g = await L.boot({ port: 8894, view: L.viewOf(v), room: 'kitchen', insets: ins, off: 'G16' }); await g.calm();
  const r = await g.ev(async () => { const C = Clarity; C.set('G25', false); daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 120; askRequest('cook'); await new Promise(r => setTimeout(r, 100));
    const old = document.getElementById('reqBtn').getBoundingClientRect(); document.getElementById('reqBtn').remove(); C.set('G25', true); C.G25.ghosts = 0;
    askRequest('cook'); await new Promise(r => requestAnimationFrame(r)); const gh = document.querySelector('.cm-g25-ghost'); const gb = gh && gh.getBoundingClientRect(); const nb = document.getElementById('reqBtn').getBoundingClientRect();
    return { todaysCorner: [Math.round(old.left), Math.round(old.top), Math.round(old.width)], ghostStart: gb && [Math.round(gb.left), Math.round(gb.top), Math.round(gb.width)], slot: [Math.round(nb.left), Math.round(nb.top), Math.round(nb.width)], ghostId: gh && gh.id }; });
  console.log(v, ins ? 'notch' : '', JSON.stringify(r), g.errs()); await g.close(); } })();
